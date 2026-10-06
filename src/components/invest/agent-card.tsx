"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Clock, MessageCircle, PiggyBank, Power, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import type { AgentControls, AgentEventView } from "@/components/bridge/types";

/** En la tarjeta, las últimas tres cosas que importan. El resto, en "Ver todo". */
const SHOWN_EVENTS = 3;
/** Prender y apagar no ocupan lugar en la tarjeta: el interruptor ya lo dice. */
const NOISE = new Set<AgentEventView["kind"]>(["enabled", "disabled"]);

/** "5 min", "2 h", "3 d" en el idioma de la app. */
export function relativeTime(at: number, now: number, lang: "es" | "en"): string | null {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return lang === "es" ? `${days} d` : `${days}d`;
}

const KIND_STYLE: Record<AgentEventView["kind"], { Icon: typeof Bot; tone: string }> = {
  bought: { Icon: CheckCircle2, tone: "bg-success/10 text-success" },
  set_aside: { Icon: PiggyBank, tone: "bg-primary/10 text-primary" },
  waiting: { Icon: Clock, tone: "bg-warning/10 text-warning" },
  error: { Icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
  enabled: { Icon: Power, tone: "bg-muted text-muted-foreground" },
  disabled: { Icon: Power, tone: "bg-muted text-muted-foreground" },
};

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Una línea de la bitácora: ícono, qué fue, cuándo, y el detalle en dos líneas como mucho. */
function EventRow({ event, now, clamp }: { event: AgentEventView; now: number; clamp: boolean }) {
  const { lang, t } = useLang();
  const { Icon, tone } = KIND_STYLE[event.kind] ?? KIND_STYLE.enabled;
  const ago = relativeTime(event.createdAt, now, lang);
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{t.agent.kinds[event.kind] ?? event.kind}</p>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago ? t.agent.ago(ago) : t.agent.justNow}</p>
        </div>
        <p className={`text-xs leading-relaxed text-muted-foreground ${clamp ? "line-clamp-2" : ""}`}>{event.message}</p>
      </div>
    </li>
  );
}

/** El historial completo, agrupado por día, con su propio scroll. */
function HistorySheet({
  open,
  events,
  onClose,
}: {
  open: boolean;
  events: AgentEventView[];
  onClose: () => void;
}) {
  const { lang, t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const now = useNow();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dayLabel = (at: number) => {
    const d = new Date(at);
    const today = new Date(now);
    const yesterday = new Date(now - 86_400_000);
    if (d.toDateString() === today.toDateString()) return t.agent.today;
    if (d.toDateString() === yesterday.toDateString()) return t.agent.yesterday;
    return d.toLocaleDateString(lang === "es" ? "es" : "en", { weekday: "long", day: "numeric", month: "long" });
  };
  const groups: { label: string; items: AgentEventView[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(event);
    else groups.push({ label, items: [event] });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="agent-history-title"
      className="m-auto max-h-[min(40rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-md open:flex open:flex-col rounded-2xl border border-border bg-surface p-0 text-foreground"
      data-testid="agent-history"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="agent-history-title" className="font-display text-lg font-semibold">
          {t.agent.historyTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.agent.close}
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="overflow-y-auto px-5 pb-5">
        {groups.map((group) => (
          <section key={group.label} className="pt-4">
            <h3 className="text-xs font-medium capitalize text-muted-foreground">{group.label}</h3>
            <ul className="divide-y divide-border">
              {group.items.map((event) => (
                <EventRow key={event.id} event={event} now={now} clamp={false} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}

/** Si el agente puede hablar (hay IA en el servidor). Mientras no se sabe, no se ofrece. */
function useCanTalk(): boolean {
  const [canTalk, setCanTalk] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/agent/chat", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data: { available?: boolean }) => alive && setCanTalk(Boolean(data.available)))
      .catch(() => alive && setCanTalk(false));
    return () => {
      alive = false;
    };
  }, []);
  return canTalk;
}

/** La entrada a la charla: parece un campo de texto, abre la hoja. */
function TalkButton({ onTalk }: { onTalk: () => void }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={onTalk}
      className="mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer"
      data-testid="agent-talk"
    >
      <MessageCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-foreground">{t.agentChat.open}</span>
        <span className="truncate text-xs text-muted-foreground">{t.agentChat.openHint}</span>
      </span>
    </button>
  );
}

/**
 * Tu agente, activo: un interruptor (como el de la regla) y las últimas
 * tres cosas que hizo, cada una en una línea con su ícono. "Ver todo" abre
 * el historial completo. Apagado: una línea de qué hace y un solo botón
 * para activarlo (abre el permiso). En los dos casos, abajo, la entrada
 * para hablarle.
 */
export function AgentCard({
  agent,
  hasRule,
  onEnable,
  onTalk,
}: {
  agent: AgentControls;
  hasRule: boolean;
  onEnable: () => void;
  onTalk: () => void;
}) {
  const { t } = useLang();
  const now = useNow();
  const canTalk = useCanTalk();
  const [running, setRunning] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [history, setHistory] = useState(false);

  if (!agent.available) return null;

  const relevant = agent.events.filter((e) => !NOISE.has(e.kind));

  const runNow = async () => {
    setRunning(true);
    try {
      await agent.runNow();
    } catch {
      // la bitácora dice lo que pasó
    } finally {
      setRunning(false);
    }
  };

  // El interruptor solo se ve con el agente activo: apagarlo.
  const toggle = async () => {
    setSwitching(true);
    try {
      await agent.disable();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Card className="p-5" data-testid="agent-card">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4 text-primary" aria-hidden="true" />
          {t.agent.title}
        </p>
        {agent.ready && agent.enabled && (
          <button
            type="button"
            role="switch"
            aria-checked={agent.enabled}
            aria-label={t.agent.toggleLabel}
            disabled={switching}
            onClick={toggle}
            data-testid="agent-toggle"
            className="-mr-1 inline-flex h-10 items-center gap-2 rounded-full pl-3 pr-1 text-sm font-medium transition-colors duration-100 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 cursor-pointer"
          >
            <span className={agent.enabled ? "text-foreground" : "text-muted-foreground"} data-testid="agent-state">
              {agent.enabled ? t.agent.on : t.agent.off}
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-out ${
                agent.enabled ? "bg-primary" : "bg-border"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
                  agent.enabled ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
        )}
      </div>

      {!agent.ready ? (
        <Skeleton className="mt-3 h-16" />
      ) : agent.enabled ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{t.agent.onSub}</p>
          {relevant.length === 0 ? (
            <p className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t.agent.empty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border" data-testid="agent-events">
              {relevant.slice(0, SHOWN_EVENTS).map((event) => (
                <EventRow key={event.id} event={event} now={now} clamp />
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={runNow} loading={running} className="-ml-3.5" data-testid="agent-run">
              {!running && <RefreshCw className="size-4" aria-hidden="true" />}
              {running ? t.agent.running : t.agent.runNow}
            </Button>
            {agent.events.length > Math.min(relevant.length, SHOWN_EVENTS) && (
              <Button variant="ghost" size="sm" onClick={() => setHistory(true)} className="-mr-3.5" data-testid="agent-see-all">
                {t.agent.seeAll(agent.events.length)}
              </Button>
            )}
          </div>
          <HistorySheet open={history} events={agent.events} onClose={() => setHistory(false)} />
          {canTalk && <TalkButton onTalk={onTalk} />}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t.agent.offSub}</p>
          {hasRule ? (
            <Button variant="secondary" onClick={onEnable} className="mt-4 w-full" data-testid="agent-enable">
              <Bot className="size-4" aria-hidden="true" />
              {t.agent.enable}
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t.agent.needsRule}</p>
          )}
          {canTalk && hasRule && <TalkButton onTalk={onTalk} />}
        </>
      )}
    </Card>
  );
}
