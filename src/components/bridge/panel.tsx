"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CircleCheck,
  ExternalLink,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { DepositModal } from "@/components/bridge/deposit-modal";
import { WithdrawModal } from "@/components/bridge/withdraw-modal";
import { formatUsdc, parseUsdc, truncateAddress } from "@/lib/format";
import { baseExplorerTx, solanaExplorerTx } from "@/lib/config";
import { MIN_TRANSFER_UNITS } from "@/lib/config";
import { useLang, type Dictionary, type Lang } from "@/lib/i18n";
import type { Quote } from "@/lib/cctp/quote";
import {
  loadHistory,
  saveTransfer,
  type TransferRecord,
} from "@/lib/history";
import { syncSolanaHistory } from "@/lib/solana/historySync";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
  BridgeStep,
  RunUpdate,
} from "@/components/bridge/types";

interface RunState extends RunUpdate {
  quote?: Quote;
  startedAt?: number;
}

export function BridgePanel({
  session,
  balances,
  actions,
}: {
  session: BridgeSession;
  balances: BridgeBalances;
  actions: BridgeActions;
}) {
  const { lang, t } = useLang();
  const [amountText, setAmountText] = useState("");
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote?: Quote;
    error?: string;
  } | null>(null);
  const [run, setRun] = useState<RunState>({ step: "idle" });
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Lectura inicial de localStorage: sincronización con un sistema externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  const amountUnits = useMemo(() => parseUsdc(amountText), [amountText]);

  const inputError = useMemo(() => {
    if (amountText.trim() === "") return null;
    if (amountUnits === null) return t.app.amountInvalid;
    if (amountUnits === 0n) return null;
    if (amountUnits < MIN_TRANSFER_UNITS) return t.app.amountMin;
    if (balances.baseUnits !== null && amountUnits > balances.baseUnits)
      return t.app.amountInsufficient(formatUsdc(balances.baseUnits, 2, lang));
    return null;
  }, [amountText, amountUnits, balances.baseUnits, t, lang]);

  const quoteKey =
    amountUnits !== null && amountUnits >= MIN_TRANSFER_UNITS && !inputError
      ? amountUnits.toString()
      : null;

  // Cotización con debounce: el desglose aparece mientras escribís.
  useEffect(() => {
    if (quoteKey === null) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = await actions.getQuote(BigInt(quoteKey));
        if (!cancelled) setQuoteResult({ key: quoteKey, quote: q });
      } catch {
        if (!cancelled) setQuoteResult({ key: quoteKey, error: "quote" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteKey, actions]);

  // Estados derivados: la cotización vale solo si coincide con el monto actual.
  const quote =
    quoteKey !== null && quoteResult?.key === quoteKey
      ? (quoteResult.quote ?? null)
      : null;
  const quoteError =
    quoteKey !== null && quoteResult?.key === quoteKey && quoteResult.error
      ? t.app.quoteError
      : null;
  const quoteLoading = quoteKey !== null && quoteResult?.key !== quoteKey;

  // Reintento desde el historial: una transferencia cuyo burn en Base ya
  // salió se puede entregar siempre; si otro intento ya la entregó, el
  // servidor lo dice y acá solo se marca completada.
  const [retryState, setRetryState] = useState<{
    id: string;
    error?: string;
  } | null>(null);

  // El historial local se pierde si el usuario limpia el navegador, pero la
  // red lo recuerda todo: al entrar, reconstruimos llegadas y retiros desde
  // la cuenta USDC de Solana y los mezclamos con lo que ya haya guardado.
  const chainSyncRef = useRef(false);
  useEffect(() => {
    if (chainSyncRef.current || session.demo) return;
    if (!session.authenticated || !session.solanaAddress) return;
    chainSyncRef.current = true;
    const solanaAddress = session.solanaAddress;
    void (async () => {
      try {
        const synced = await syncSolanaHistory(solanaAddress);
        const known = new Set(
          loadHistory().flatMap((r) =>
            [r.id, r.solanaSignature].filter(Boolean)
          )
        );
        const fresh = synced.filter((r) => !known.has(r.id));
        if (fresh.length === 0) return;
        for (const r of [...fresh].sort((a, b) => a.createdAt - b.createdAt)) {
          saveTransfer(r);
        }
        setHistory(loadHistory());
      } catch {
        // el RPC público puede limitar; el historial local sigue valiendo
      }
    })();
  }, [session.authenticated, session.demo, session.solanaAddress]);

  // "Cerrá la app: cuando vuelvas, va a estar." Al abrir, las transferencias
  // que quedaron a medias se verifican y completan solas; el botón Reintentar
  // queda solo para cuando esta pasada automática no pudo.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (reconciledRef.current) return;
    if (!session.authenticated) return;
    if (!session.demo && !session.solanaAddress) return;
    const pending = loadHistory().filter(
      (r) => r.status !== "done" && r.baseTxHash && !r.demo
    );
    if (pending.length === 0) return;
    reconciledRef.current = true;
    void (async () => {
      for (const item of pending) {
        try {
          const sig = await actions.retryDelivery(item.baseTxHash as string);
          saveTransfer({
            ...item,
            status: "done",
            solanaSignature: sig ?? item.solanaSignature,
          });
          setHistory(loadHistory());
          balances.refresh();
        } catch {
          // sigue pendiente de verdad: el botón Reintentar queda a mano
        }
      }
    })();
  }, [session.authenticated, session.demo, session.solanaAddress, actions, balances]);

  const retryFromHistory = useCallback(
    async (item: TransferRecord) => {
      if (!item.baseTxHash) return;
      setRetryState({ id: item.id });
      try {
        const sig = await actions.retryDelivery(item.baseTxHash);
        saveTransfer({
          ...item,
          status: "done",
          solanaSignature: sig ?? item.solanaSignature,
        });
        setHistory(loadHistory());
        setRetryState(null);
        balances.refresh();
      } catch (err) {
        setRetryState({
          id: item.id,
          error:
            err instanceof Error && err.message
              ? err.message
              : t.app.quoteError,
        });
      }
    },
    [actions, balances, t]
  );

  const persistRun = useCallback(
    (update: RunState, q: Quote) => {
      const id = runIdRef.current;
      if (!id) return;
      const record: TransferRecord = {
        id,
        createdAt: Date.now(),
        amountUnits: q.amountUnits.toString(),
        receiveUnits: q.receiveUnits.toString(),
        baseTxHash: update.baseTxHash,
        solanaSignature: update.solanaSignature,
        status: update.step === "idle" ? "sending" : update.step,
        demo: session.demo,
      };
      saveTransfer(record);
      setHistory(loadHistory());
    },
    [session.demo]
  );

  const startBridge = useCallback(async () => {
    if (!quote || run.step !== "idle") return;
    runIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let latest: RunState = {
      step: "sending",
      quote,
      startedAt: Date.now(),
    };
    setRun(latest);
    try {
      await actions.runBridge(quote, (update) => {
        latest = { ...latest, ...update };
        setRun(latest);
        persistRun(latest, quote);
      });
      balances.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : t.app.genericRunError;
      latest = { ...latest, step: "error", errorMessage: message };
      setRun(latest);
      persistRun(latest, quote);
    }
  }, [quote, run.step, actions, balances, persistRun, t]);

  const reset = useCallback(() => {
    setRun({ step: "idle" });
    setAmountText("");
    setQuoteResult(null);
    balances.refresh();
  }, [balances]);

  const running =
    run.step === "sending" || run.step === "attesting" || run.step === "minting";

  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const closeModal = useCallback(() => {
    setModal(null);
    balances.refresh();
  }, [balances]);

  return (
    <div className="flex w-full flex-col gap-6">
      <BalancesRow
        session={session}
        balances={balances}
        onDeposit={() => setModal("deposit")}
        onWithdraw={() => setModal("withdraw")}
        lang={lang}
        t={t}
      />

      <DepositModal
        open={modal === "deposit"}
        onClose={closeModal}
        address={session.baseAddress}
        demo={session.demo}
      />
      <WithdrawModal
        open={modal === "withdraw"}
        onClose={closeModal}
        balanceUnits={balances.solanaUnits}
        ownAddress={session.solanaAddress}
        demo={session.demo}
        onWithdraw={async (destination, amountUnits) => {
          const sig = await actions.withdrawSolana(destination, amountUnits);
          saveTransfer({
            id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            kind: "withdraw",
            amountUnits: amountUnits.toString(),
            receiveUnits: amountUnits.toString(),
            destination,
            solanaSignature: sig,
            status: "done",
            demo: session.demo,
          });
          setHistory(loadHistory());
          balances.refresh();
          return sig;
        }}
      />

      <Card className="p-6 sm:p-8">
        {run.step === "idle" || run.step === "error" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startBridge();
            }}
            className="flex flex-col gap-5"
          >
            {run.step === "error" && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">
                    {t.app.errorTitle}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {run.errorMessage}
                    {run.baseTxHash ? t.app.errorAfterBurn : ""}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="amount" className="text-sm font-medium">
                {t.app.amountLabel}
              </label>
              <div className="relative">
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t.app.amountPlaceholder}
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  aria-invalid={inputError ? "true" : undefined}
                  aria-describedby={inputError ? "amount-error" : "amount-hint"}
                  className="h-14 w-full rounded-xl border border-border bg-surface px-4 pr-28 font-mono text-2xl tabular-nums text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                />
                <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (balances.baseUnits !== null)
                        setAmountText(
                          formatUsdc(balances.baseUnits, 2, lang).replace(
                            lang === "es" ? /\./g : /,/g,
                            ""
                          )
                        );
                    }}
                    className="rounded-lg px-2.5 py-2 text-xs font-semibold text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    {t.common.max}
                  </button>
                  <span className="text-sm font-medium text-muted-foreground">
                    {t.common.usdc}
                  </span>
                </div>
              </div>
              {inputError ? (
                <p id="amount-error" className="text-xs text-destructive">
                  {inputError}
                </p>
              ) : (
                <p id="amount-hint" className="text-xs text-muted-foreground">
                  {t.app.amountHint}
                </p>
              )}
            </div>

            <QuoteBreakdown
              quote={quote}
              loading={quoteLoading}
              error={quoteError}
              lang={lang}
              t={t}
            />

            <Button
              type="submit"
              size="lg"
              disabled={!quote || inputError !== null || quoteLoading}
              className="w-full"
            >
              {run.step === "error" ? t.app.retry : t.app.submit}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.app.submitHint}
            </p>
          </form>
        ) : (
          <RunProgress run={run} onReset={reset} demo={session.demo} lang={lang} t={t} />
        )}
      </Card>

      {history.length > 0 && !running && (
        <HistoryList
          history={history}
          lang={lang}
          t={t}
          retryState={retryState}
          onRetry={retryFromHistory}
        />
      )}
    </div>
  );
}

function BalancesRow({
  session,
  balances,
  onDeposit,
  onWithdraw,
  lang,
  t,
}: {
  session: BridgeSession;
  balances: BridgeBalances;
  onDeposit: () => void;
  onWithdraw: () => void;
  lang: Lang;
  t: Dictionary;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <BalanceCard
        title={t.app.baseCard}
        subtitle={t.app.baseCardSub}
        units={balances.baseUnits}
        loading={balances.loading}
        address={session.baseAddress}
        dotClass="bg-base-blue"
        lang={lang}
        t={t}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={onDeposit}
            disabled={!session.baseAddress}
          >
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            {t.app.deposit}
          </Button>
        }
      />
      <BalanceCard
        title={t.app.solanaCard}
        subtitle={t.app.solanaCardSub}
        units={balances.solanaUnits}
        loading={balances.loading}
        address={session.solanaAddress}
        dotClass="bg-solana-green"
        lang={lang}
        t={t}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={onWithdraw}
            disabled={
              !session.solanaAddress ||
              balances.solanaUnits === null ||
              balances.solanaUnits === 0n
            }
          >
            <ArrowUpFromLine className="size-4" aria-hidden="true" />
            {t.app.withdraw}
          </Button>
        }
      />
    </div>
  );
}

function BalanceCard({
  title,
  subtitle,
  units,
  loading,
  address,
  dotClass,
  action,
  lang,
  t,
}: {
  title: string;
  subtitle: string;
  units: bigint | null;
  loading: boolean;
  address: string | null;
  dotClass: string;
  action?: React.ReactNode;
  lang: Lang;
  t: Dictionary;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">· {subtitle}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        {loading || units === null ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {formatUsdc(units, 2, lang)}
            </span>
            <span className="text-sm text-muted-foreground">
              {t.common.usdc}
            </span>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {address ? (
          <div className="flex min-w-0 items-center gap-1">
            <span className="font-mono text-xs text-muted-foreground" title={address}>
              {truncateAddress(address)}
            </span>
            <CopyButton value={address} label={t.app.copyAddress(title)} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t.app.addressPending}
          </span>
        )}
        {action}
      </div>
    </Card>
  );
}

function QuoteBreakdown({
  quote,
  loading,
  error,
  lang,
  t,
}: {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  lang: Lang;
  t: Dictionary;
}) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }
  if (!quote) return null;

  const formatFee = (units: bigint) => {
    if (units > 0n && units < 10000n) return lang === "es" ? "< 0,01" : "< 0.01";
    return formatUsdc(units, 2, lang);
  };

  return (
    <dl className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
      <Row label={t.app.rowSend}>
        {formatUsdc(quote.amountUnits, 2, lang)} {t.common.usdc}
      </Row>
      <Row
        label={
          quote.feeBps > 0
            ? t.app.rowFee(
                (quote.feeBps / 100).toLocaleString(
                  lang === "es" ? "es" : "en",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )
              )
            : t.app.rowFeeNoPct
        }
      >
        {quote.camaloteFeeUnits === 0n
          ? t.common.free
          : `− ${formatFee(quote.camaloteFeeUnits)} ${t.common.usdc}`}
      </Row>
      <Row label={t.app.rowExpress}>
        {quote.circleFeeUnits === 0n
          ? t.common.free
          : `− ${formatFee(quote.circleFeeUnits)} ${t.common.usdc}`}
      </Row>
      <Row label={t.app.rowNetwork}>
        <span className="text-success">{t.app.rowNetworkValue}</span>
      </Row>
      <div className="my-1 border-t border-border" role="presentation" />
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-medium">{t.app.rowReceive}</dt>
        <dd className="font-mono text-base font-semibold tabular-nums">
          ~{formatUsdc(quote.receiveUnits, 2, lang)} {t.common.usdc}
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{children}</dd>
    </div>
  );
}

const STEP_ORDER: BridgeStep[] = ["sending", "attesting", "minting"];

function RunProgress({
  run,
  onReset,
  demo,
  lang,
  t,
}: {
  run: RunState;
  onReset: () => void;
  demo: boolean;
  lang: Lang;
  t: Dictionary;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (run.step === "done") return;
    const interval = setInterval(() => {
      if (run.startedAt) setElapsed(Math.floor((Date.now() - run.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [run.step, run.startedAt]);

  const stepCopy: Record<string, { title: string; detail: string }> = {
    sending: { title: t.app.stepSending, detail: t.app.stepSendingDetail },
    attesting: { title: t.app.stepAttesting, detail: t.app.stepAttestingDetail },
    minting: { title: t.app.stepMinting, detail: t.app.stepMintingDetail },
  };

  if (run.step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center animate-pop">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-gradient">
          <Check className="size-8 text-white" strokeWidth={3} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {t.app.doneTitle}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {run.quote
              ? t.app.doneBody(formatUsdc(run.quote.receiveUnits, 2, lang))
              : t.app.doneBodyNoAmount}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {run.baseTxHash && !demo && (
            <ExplorerLink href={baseExplorerTx(run.baseTxHash)}>
              {t.app.doneViewBase}
            </ExplorerLink>
          )}
          {run.solanaSignature && !demo && (
            <ExplorerLink href={solanaExplorerTx(run.solanaSignature)}>
              {t.app.doneViewSolana}
            </ExplorerLink>
          )}
          {demo && (
            <p className="text-xs text-muted-foreground">{t.common.demoNote}</p>
          )}
        </div>
        <Button onClick={onReset} variant="secondary" className="mt-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          {t.app.doneAgain}
        </Button>
      </div>
    );
  }

  const activeIndex = STEP_ORDER.indexOf(run.step);

  return (
    <div aria-live="polite" className="flex flex-col gap-6 py-2">
      <ol className="flex flex-col gap-4">
        {STEP_ORDER.map((step, i) => {
          const state =
            i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
          const copy = stepCopy[step];
          return (
            <li key={step} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border ${
                  state === "done"
                    ? "border-success/40 bg-success/10 text-success"
                    : state === "active"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground/50"
                }`}
                aria-hidden="true"
              >
                {state === "done" ? (
                  <CircleCheck className="size-4" />
                ) : state === "active" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    state === "pending" ? "text-muted-foreground/60" : ""
                  }`}
                >
                  {copy.title}
                </p>
                {state === "active" && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {copy.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {run.step === "attesting" && elapsed > 120 && (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {t.app.slowNote}
        </p>
      )}

      {run.baseTxHash && !demo && (
        <div className="text-center text-sm">
          <ExplorerLink href={baseExplorerTx(run.baseTxHash)}>
            {t.app.viewBaseTx}
          </ExplorerLink>
        </div>
      )}
    </div>
  );
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-primary underline-offset-4 transition-colors duration-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function HistoryList({
  history,
  lang,
  t,
  retryState,
  onRetry,
}: {
  history: TransferRecord[];
  lang: Lang;
  t: Dictionary;
  retryState: { id: string; error?: string } | null;
  onRetry: (item: TransferRecord) => void;
}) {
  return (
    <section aria-label={t.app.historyTitle}>
      <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
        {t.app.historyTitle}
      </h2>
      <Card className="divide-y divide-border">
        {[...history]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5)
          .map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-8 items-center justify-center rounded-full ${
                  item.status === "done"
                    ? "bg-success/10 text-success"
                    : item.status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                }`}
                aria-hidden="true"
              >
                {item.status === "done" ? (
                  <Check className="size-4" />
                ) : item.status === "error" ? (
                  <Info className="size-4" />
                ) : (
                  <Loader2 className="size-4" />
                )}
              </span>
              <div>
                <p className="font-mono text-sm font-medium tabular-nums">
                  {formatUsdc(BigInt(item.amountUnits), 2, lang)} {t.common.usdc}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString(
                    lang === "es" ? "es" : "en",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                  {item.kind === "withdraw" && item.destination
                    ? ` · ${t.app.historyWithdrawTo(truncateAddress(item.destination))}`
                    : ""}
                  {item.demo ? t.app.historySim : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {item.status !== "done" && item.baseTxHash && !item.demo ? (
                <Button
                  variant="secondary"
                  loading={retryState?.id === item.id && !retryState.error}
                  onClick={() => onRetry(item)}
                  className="h-9 px-3 text-xs"
                >
                  {retryState?.id === item.id && !retryState.error
                    ? t.app.historyRetrying
                    : t.app.historyRetry}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {item.status === "done"
                    ? t.app.historyDone
                    : item.status === "error"
                      ? item.baseTxHash
                        ? t.app.historyError
                        : t.app.historyNotSent
                      : t.app.historyPending}
                </span>
              )}
              {retryState?.id === item.id && retryState.error && (
                <p role="alert" className="max-w-56 text-right text-xs text-destructive">
                  {retryState.error}
                </p>
              )}
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
