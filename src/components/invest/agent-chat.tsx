"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bot, Check, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { assetName, isDollars, type XStockSymbol } from "@/lib/invest/catalog";
import {
  AgentChatError,
  trimHistory,
  type AgentAction,
  type AgentChatContext,
  type ChatTurn,
  type RuleChange,
} from "@/lib/invest/agent-chat";
import type { InvestRule } from "@/lib/invest/types";
import type { AgentControls } from "@/components/bridge/types";

const STORAGE_PREFIX = "camalote.agent.chat.v1:";
const MAX_STORED = 30;

type ActionStatus = "idle" | "busy" | "done" | "undone" | "error";

interface ActionView {
  action: AgentAction;
  status: ActionStatus;
  /** Para deshacer un cambio de regla: lo que había antes. */
  before?: Partial<InvestRule> | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ActionView[];
  /** El agente no respondió: se muestra con "Reintentar". */
  failed?: boolean;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** La charla queda en este dispositivo, solo el texto (las acciones valen en el momento). */
function loadStored(address: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address);
    const list = raw ? (JSON.parse(raw) as ChatTurn[]) : [];
    return Array.isArray(list)
      ? list
          .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
          .map((t) => ({ id: newId(), role: t.role, content: t.content }))
      : [];
  } catch {
    return [];
  }
}

function store(address: string, messages: Message[]): void {
  try {
    const turns = messages.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.content }));
    localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(turns.slice(-MAX_STORED)));
  } catch {
    // sin almacenamiento, la charla vale mientras la hoja está abierta
  }
}

export interface AgentChatHandlers {
  /** El estado de la cuenta ahora, para que el agente responda con datos reales. */
  context: () => AgentChatContext;
  /** Aplica un cambio de regla; devuelve lo de antes para deshacerlo. */
  onRuleChange: (change: RuleChange) => Partial<InvestRule> | null;
  onUndo: (before: Partial<InvestRule>) => void;
  onBuy: (asset: XStockSymbol, usdcUnits: bigint) => void;
  onSell: (asset: XStockSymbol) => void;
  onAgentOn: () => void;
}

/**
 * Hablarle al agente: una hoja con la charla. Lo que el agente cambia de la
 * regla se aplica al toque, con "Deshacer". Comprar, vender, activar o
 * apagar el agente quedan como una tarjeta con su botón: lo confirma el
 * usuario, en la hoja de siempre.
 */
export function AgentChatSheet({
  open,
  onClose,
  address,
  agent,
  goalName,
  ruleEnabled,
  handlers,
}: {
  open: boolean;
  onClose: () => void;
  address: string;
  agent: AgentControls;
  goalName: string | null;
  ruleEnabled: boolean;
  handlers: AgentChatHandlers;
}) {
  const { lang, t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setMessages((prev) => prev ?? loadStored(address));
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, address]);

  useEffect(() => {
    if (messages) store(address, messages);
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, address]);

  // Lo que el agente pidió hacer: los cambios de regla y revisar ahora van al toque.
  const applyActions = useCallback(
    (actions: AgentAction[]): ActionView[] =>
      actions.map((action) => {
        if (action.type === "rule") {
          const before = handlers.onRuleChange(action.change);
          return { action, status: before ? "done" : "error", before };
        }
        if (action.type === "check") {
          void agent.runNow().catch(() => undefined);
          return { action, status: "done" };
        }
        return { action, status: "idle" };
      }),
    [handlers, agent]
  );

  const request = useCallback(
    async (history: Message[]) => {
      setLoading(true);
      try {
        const turns = trimHistory(history.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.content })));
        const reply = await agent.ask({ lang, messages: turns, context: handlers.context() });
        const views = applyActions(reply.actions);
        setMessages((prev) => [...(prev ?? []), { id: newId(), role: "assistant", content: reply.reply, actions: views }]);
      } catch (err) {
        const status = err instanceof AgentChatError ? err.status : 0;
        const content = status === 429 ? t.agentChat.slowDown : status === 401 ? t.agentChat.session : t.agentChat.error;
        setMessages((prev) => [...(prev ?? []), { id: newId(), role: "assistant", content, failed: true }]);
      } finally {
        setLoading(false);
      }
    },
    [agent, lang, handlers, applyActions, t]
  );

  const send = (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...(messages ?? []).filter((m) => !m.failed), { id: newId(), role: "user" as const, content }];
    setMessages(next);
    setInput("");
    void request(next);
  };

  const retry = () => {
    if (loading || !messages) return;
    const next = messages.filter((m) => !m.failed);
    setMessages(next);
    void request(next);
  };

  const setStatus = (messageId: string, index: number, patch: Partial<ActionView>) =>
    setMessages((prev) =>
      (prev ?? []).map((m) =>
        m.id === messageId && m.actions
          ? { ...m, actions: m.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)) }
          : m
      )
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const suggestions = [
    goalName ? t.agentChat.suggestGoal(goalName) : t.agentChat.suggestInvested,
    t.agentChat.suggestLast,
    ruleEnabled ? t.agentChat.suggestPause : t.agentChat.suggestResume,
  ];

  const ruleSummary = (change: RuleChange): string => {
    const parts: string[] = [];
    if (change.percent !== undefined) parts.push(t.agentChat.rulePercent(String(change.percent)));
    if (change.asset !== undefined) parts.push(t.agentChat.ruleAsset(assetName(change.asset, lang)));
    if (change.enabled !== undefined) parts.push(change.enabled ? t.agentChat.ruleOn : t.agentChat.ruleOff);
    if (change.waitForMarketOpen !== undefined) parts.push(change.waitForMarketOpen ? t.agentChat.ruleWaitOn : t.agentChat.ruleWaitOff);
    if (change.goal !== undefined) {
      parts.push(
        change.goal === null
          ? t.agentChat.ruleNoGoal
          : t.agentChat.ruleGoal(change.goal.name, formatUsdc(BigInt(change.goal.targetUnits), 0, lang))
      );
    }
    return parts.join(", ");
  };

  const renderAction = (message: Message, view: ActionView, index: number) => {
    const { action, status } = view;
    const key = `${message.id}-${index}`;
    if (action.type === "rule") {
      return (
        <div key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="agent-chat-rule">
          <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          <span className="text-foreground">{status === "undone" ? t.agentChat.undone : t.agentChat.ruleDone(ruleSummary(action.change))}</span>
          {status === "done" && view.before && (
            <button
              type="button"
              onClick={() => {
                handlers.onUndo(view.before as Partial<InvestRule>);
                setStatus(message.id, index, { status: "undone" });
              }}
              className="-my-2 inline-flex min-h-10 items-center rounded-md px-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              data-testid="agent-chat-undo"
            >
              {t.agentChat.undo}
            </button>
          )}
        </div>
      );
    }
    if (action.type === "check") {
      return (
        <p key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" />
          {t.agentChat.checking}
        </p>
      );
    }
    const card = (title: string, cta: string, onClick: () => void, testId: string) => (
      <div key={key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" data-testid={testId}>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {status === "done" && action.type === "agent_off" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" aria-hidden="true" />
            {t.agentChat.agentOffDone}
          </p>
        ) : (
          <Button size="sm" variant="secondary" loading={status === "busy"} onClick={onClick} className="w-full">
            {cta}
          </Button>
        )}
      </div>
    );
    switch (action.type) {
      case "buy": {
        const amount = formatUsdc(BigInt(action.usdcUnits), 2, lang);
        const name = assetName(action.asset, lang);
        return card(
          isDollars(action.asset) ? t.agentChat.buyDollars(amount, name) : t.agentChat.buy(amount, name),
          t.agentChat.buyCta,
          () => handlers.onBuy(action.asset, BigInt(action.usdcUnits)),
          "agent-chat-buy"
        );
      }
      case "sell":
        return card(t.agentChat.sell(assetName(action.asset, lang)), t.agentChat.sellCta, () => handlers.onSell(action.asset), "agent-chat-sell");
      case "agent_on":
        return card(t.agentChat.agentOn, t.agentChat.agentOnCta, handlers.onAgentOn, "agent-chat-agent-on");
      case "agent_off":
        return card(
          t.agentChat.agentOff,
          t.agentChat.agentOffCta,
          async () => {
            setStatus(message.id, index, { status: "busy" });
            try {
              await agent.disable();
              setStatus(message.id, index, { status: "done" });
            } catch {
              setStatus(message.id, index, { status: "idle" });
            }
          },
          "agent-chat-agent-off"
        );
    }
  };

  const list = messages ?? [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="agent-chat-title"
      className="m-auto h-[min(42rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-md open:flex open:flex-col rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="agent-chat"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border py-2 pl-5 pr-2">
        <h2 id="agent-chat-title" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Bot className="size-5 text-primary" aria-hidden="true" />
          {t.agentChat.title}
        </h2>
        <div className="flex items-center">
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={loading}
              aria-label={t.agentChat.clear}
              className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 cursor-pointer"
              data-testid="agent-chat-clear"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.agentChat.close}
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" data-testid="agent-chat-messages">
        {list.length === 0 && !loading ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t.agentChat.intro}</p>
            <div className="flex flex-col items-start gap-2">
              {suggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => send(text)}
                  className="min-h-10 rounded-full border border-border px-3.5 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  data-testid="agent-chat-suggestion"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {list.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                    <span className="sr-only">{t.agentChat.you}: </span>
                    {message.content}
                  </p>
                </li>
              ) : (
                <li key={message.id} className="flex flex-col items-start gap-2" data-testid="agent-chat-reply">
                  <p
                    className={`max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ${
                      message.failed ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
                    }`}
                  >
                    <span className="sr-only">{t.agentChat.agent}: </span>
                    {message.content}
                  </p>
                  {message.failed && (
                    <Button size="sm" variant="ghost" onClick={retry} disabled={loading} className="-ml-3.5" data-testid="agent-chat-retry">
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t.agentChat.retry}
                    </Button>
                  )}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex w-full max-w-[90%] flex-col gap-2">
                      {message.actions.map((view, i) => renderAction(message, view, i))}
                    </div>
                  )}
                </li>
              )
            )}
            {loading && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="agent-chat-thinking">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse" />
                  <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse [animation-delay:300ms]" />
                </span>
                {t.agentChat.thinking}
              </li>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-3">
        <label htmlFor="agent-chat-input" className="sr-only">
          {t.agentChat.inputLabel}
        </label>
        <input
          ref={inputRef}
          id="agent-chat-input"
          type="text"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={500}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.agentChat.placeholder}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          data-testid="agent-chat-input"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={t.agentChat.send}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors duration-100 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          data-testid="agent-chat-send"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </form>
    </dialog>
  );
}
