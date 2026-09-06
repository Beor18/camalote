"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  HandCoins,
  Info,
  LogOut,
  Sparkles,
} from "lucide-react";
import { CamaloteLogo } from "@/components/logo";
import { SolanaMark } from "@/components/chain-logos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DepositModal } from "@/components/bridge/deposit-modal";
import { LoginCard } from "@/components/bridge/shell";
import { RunProgress, type RunState } from "@/components/bridge/panel";
import { useEngine } from "@/components/engine";
import { formatUsdc, parseUsdc, truncateAddress } from "@/lib/format";
import { MIN_TRANSFER_UNITS } from "@/lib/config";
import { LangToggle, useLang, type Dictionary, type Lang } from "@/lib/i18n";
import { saveTransfer } from "@/lib/history";
import { decodePayLink, type PayLink } from "@/lib/paylink";
import type { Quote } from "@/lib/cctp/quote";
import type { Engine } from "@/components/bridge/types";

const BALANCE_POLL_MS = 8_000;

/** Página de pago de un link de cobro: /p?to=…&a=…&c=…&n=… */
export function PayApp() {
  const params = useSearchParams();
  const link = useMemo(() => decodePayLink(params), [params]);
  const engine = useEngine();
  const { t } = useLang();
  const { session } = engine;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CamaloteLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            {session.demo && (
              <Badge tone="warning">
                <Sparkles className="size-3" aria-hidden="true" />
                {t.common.demoBadge}
              </Badge>
            )}
            {session.authenticated && (
              <button
                type="button"
                onClick={session.logout}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
              >
                <span className="hidden max-w-40 truncate sm:inline">{session.accountLabel}</span>
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.app.logout}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        {link ? <PayPanel link={link} {...engine} /> : <InvalidLink />}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-3xl px-4 text-center text-xs text-muted-foreground sm:px-6">
          {t.pay.footer}
        </p>
      </footer>
    </div>
  );
}

function InvalidLink() {
  const { t } = useLang();
  return (
    <Card className="p-6 text-center animate-fade-up">
      <h1 className="font-display text-2xl font-semibold">{t.pay.invalidTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.pay.invalidBody}</p>
      <Link
        href="/app/cobrar"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-100 hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <HandCoins className="size-4" aria-hidden="true" />
        {t.pay.viralCta}
      </Link>
    </Card>
  );
}

function PayPanel({ link, session, balances, actions }: { link: PayLink } & Engine) {
  const { lang, t } = useLang();
  const payeeName = link.name || (lang === "es" ? "Alguien" : "Someone");

  const [amountText, setAmountText] = useState("");
  const typedUnits = useMemo(() => parseUsdc(amountText), [amountText]);
  const receiveUnits = link.amountUnits ?? typedUnits;

  const inputError =
    link.amountUnits !== null || amountText.trim() === ""
      ? null
      : typedUnits === null
        ? t.app.amountInvalid
        : typedUnits < MIN_TRANSFER_UNITS
          ? t.app.amountMin
          : null;

  const quoteKey =
    receiveUnits !== null && receiveUnits >= MIN_TRANSFER_UNITS && !inputError
      ? receiveUnits.toString()
      : null;

  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote?: Quote;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (quoteKey === null) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const q = await actions.getQuoteForReceive(BigInt(quoteKey));
        if (!cancelled) setQuoteResult({ key: quoteKey, quote: q });
      } catch {
        if (!cancelled) setQuoteResult({ key: quoteKey, error: "quote" });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteKey, actions]);

  const quote =
    quoteKey !== null && quoteResult?.key === quoteKey ? (quoteResult.quote ?? null) : null;
  const quoteError =
    quoteKey !== null && quoteResult?.key === quoteKey && quoteResult.error
      ? t.app.quoteError
      : null;
  const quoteLoading = quoteKey !== null && quoteResult?.key !== quoteKey;

  const [run, setRun] = useState<RunState>({ step: "idle" });
  const [depositOpen, setDepositOpen] = useState(false);
  const runIdRef = useRef<string | null>(null);

  // Mientras se espera el pago, el saldo se refresca solo: si el pagador
  // carga USDC desde Coinbase, el botón se habilita sin tocar nada.
  const refreshRef = useRef(balances.refresh);
  useEffect(() => {
    refreshRef.current = balances.refresh;
  });
  useEffect(() => {
    if (!session.authenticated || run.step !== "idle") return;
    const id = setInterval(() => refreshRef.current(), BALANCE_POLL_MS);
    return () => clearInterval(id);
  }, [session.authenticated, run.step]);

  const insufficient =
    quote !== null && balances.baseUnits !== null && quote.amountUnits > balances.baseUnits;
  const missingUnits =
    insufficient && quote && balances.baseUnits !== null
      ? quote.amountUnits - balances.baseUnits
      : 0n;

  const persist = useCallback(
    (state: RunState, q: Quote) => {
      const id = runIdRef.current;
      if (!id) return;
      saveTransfer({
        id,
        createdAt: Date.now(),
        kind: "payment",
        amountUnits: q.amountUnits.toString(),
        receiveUnits: q.receiveUnits.toString(),
        recipient: link.to,
        concept: link.concept || undefined,
        payeeName: link.name || undefined,
        baseTxHash: state.baseTxHash,
        solanaSignature: state.solanaSignature,
        status: state.step === "idle" ? "sending" : state.step,
        demo: session.demo,
      });
    },
    [link, session.demo]
  );

  const startPayment = useCallback(async () => {
    if (!quote || run.step !== "idle" && run.step !== "error") return;
    runIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let latest: RunState = { step: "sending", quote, startedAt: Date.now() };
    setRun(latest);
    try {
      await actions.runBridge(
        quote,
        (update) => {
          latest = { ...latest, ...update };
          setRun(latest);
          persist(latest, quote);
        },
        { recipientOwner: link.to }
      );
      balances.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : t.app.genericRunError;
      latest = { ...latest, step: "error", errorMessage: message };
      setRun(latest);
      persist(latest, quote);
    }
  }, [quote, run.step, actions, balances, persist, link.to, t]);

  const reset = useCallback(() => {
    setRun({ step: "idle" });
    setAmountText("");
    setQuoteResult(null);
    balances.refresh();
  }, [balances]);

  const doneAmount = formatUsdc(run.quote?.receiveUnits ?? receiveUnits ?? 0n, 2, lang);

  return (
    <>
      <RequestCard link={link} payeeName={payeeName} lang={lang} t={t} />

      {!session.ready ? (
        <Skeleton className="h-64" />
      ) : !session.authenticated ? (
        <LoginCard
          session={session}
          title={t.pay.loginTitle}
          sub={t.pay.loginSub}
          button={t.pay.loginButton}
        />
      ) : (
        <Card className="p-6 sm:p-8">
          {run.step === "idle" || run.step === "error" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startPayment();
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
                    <p className="font-medium text-destructive">{t.app.errorTitle}</p>
                    <p className="mt-1 text-muted-foreground">
                      {run.errorMessage}
                      {run.baseTxHash ? t.app.errorAfterBurn : ""}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t.pay.balanceLabel}</p>
                  {balances.baseUnits === null ? (
                    <Skeleton className="mt-1 h-6 w-24" />
                  ) : (
                    <p className="font-mono text-lg font-semibold tabular-nums">
                      {formatUsdc(balances.baseUnits, 2, lang)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDepositOpen(true)}
                  disabled={!session.baseAddress}
                >
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  {t.app.deposit}
                </Button>
              </div>

              {link.amountUnits === null && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pay-amount" className="text-sm font-medium">
                    {t.pay.amountLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="pay-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t.pay.amountPlaceholder}
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      aria-invalid={inputError ? "true" : undefined}
                      className="h-14 w-full rounded-xl border border-border bg-surface px-4 pr-20 font-mono text-2xl tabular-nums text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    />
                    <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                      {t.common.usdc}
                    </span>
                  </div>
                  <p className={`text-xs ${inputError ? "text-destructive" : "text-muted-foreground"}`}>
                    {inputError ?? t.pay.amountHint}
                  </p>
                </div>
              )}

              <PayBreakdown
                quote={quote}
                loading={quoteLoading}
                error={quoteError}
                payeeName={payeeName}
                lang={lang}
                t={t}
              />

              {insufficient && quote && (
                <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                  <p className="font-medium text-warning">
                    {t.pay.insufficient(formatUsdc(missingUnits, 2, lang))}
                  </p>
                  <p className="text-muted-foreground">{t.pay.insufficientHint}</p>
                  <Button type="button" variant="secondary" onClick={() => setDepositOpen(true)}>
                    <ArrowDownToLine className="size-4" aria-hidden="true" />
                    {t.pay.topUp}
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={!quote || insufficient || quoteLoading || inputError !== null}
                className="w-full"
              >
                {t.pay.submit(quote ? formatUsdc(quote.amountUnits, 2, lang) : "…")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t.pay.submitHint}</p>
            </form>
          ) : (
            <RunProgress
              run={run}
              onReset={reset}
              demo={session.demo}
              lang={lang}
              t={t}
              copy={{
                doneTitle: t.pay.doneTitle,
                doneBody: t.pay.doneBody(doneAmount, payeeName),
                again: t.pay.again,
              }}
              doneExtra={<ViralCta />}
            />
          )}
        </Card>
      )}

      <DepositModal
        open={depositOpen}
        onClose={() => {
          setDepositOpen(false);
          balances.refresh();
        }}
        address={session.baseAddress}
        demo={session.demo}
      />
    </>
  );
}

function RequestCard({
  link,
  payeeName,
  lang,
  t,
}: {
  link: PayLink;
  payeeName: string;
  lang: Lang;
  t: Dictionary;
}) {
  const initial = payeeName.trim().charAt(0).toUpperCase() || "?";
  return (
    <Card className="p-6 text-center animate-fade-up">
      <span
        className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-gradient font-display text-2xl font-semibold text-white"
        aria-hidden="true"
      >
        {initial}
      </span>
      <p className="mt-3 text-sm text-muted-foreground">
        {link.name ? t.pay.requestFrom(link.name) : t.pay.requestAnon}
      </p>
      {link.amountUnits !== null ? (
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">
          {formatUsdc(link.amountUnits, 2, lang)}{" "}
          <span className="text-base font-normal text-muted-foreground">{t.common.usdc}</span>
        </p>
      ) : (
        <p className="mt-1 font-display text-2xl font-semibold">{t.pay.chooseAmount}</p>
      )}
      {link.concept && <p className="mt-2 text-base">“{link.concept}”</p>}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <SolanaMark className="size-3" />
        {t.pay.receivesOn} · <span className="font-mono">{truncateAddress(link.to)}</span>
      </p>
    </Card>
  );
}

function PayBreakdown({
  quote,
  loading,
  error,
  payeeName,
  lang,
  t,
}: {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  payeeName: string;
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

  const fee = (units: bigint) =>
    units > 0n && units < 10000n ? (lang === "es" ? "< 0,01" : "< 0.01") : formatUsdc(units, 2, lang);
  const pct = (quote.feeBps / 100).toLocaleString(lang === "es" ? "es" : "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <dl className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-medium">{t.pay.theyReceive(payeeName)}</dt>
        <dd className="font-mono text-base font-semibold tabular-nums">
          {formatUsdc(quote.receiveUnits, 2, lang)} {t.common.usdc}
        </dd>
      </div>
      <div className="my-1 border-t border-border" role="presentation" />
      <Row label={quote.feeBps > 0 ? t.pay.fee(pct) : t.app.rowFeeNoPct}>
        {quote.camaloteFeeUnits === 0n ? t.common.free : `+ ${fee(quote.camaloteFeeUnits)} ${t.common.usdc}`}
      </Row>
      <Row label={t.pay.express}>
        {quote.circleFeeUnits === 0n ? t.common.free : `+ ${fee(quote.circleFeeUnits)} ${t.common.usdc}`}
      </Row>
      <Row label={t.pay.network}>
        <span className="text-success">{t.pay.networkValue}</span>
      </Row>
      <div className="my-1 border-t border-border" role="presentation" />
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">{t.pay.youPay}</dt>
        <dd className="font-mono tabular-nums">
          {formatUsdc(quote.amountUnits, 2, lang)} {t.common.usdc}
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

/** Cada pago termina con una invitación a cobrar: así crece Camalote. */
function ViralCta() {
  const { t } = useLang();
  return (
    <div className="mt-4 w-full overflow-hidden rounded-2xl bg-brand-gradient p-[1px]">
      <div className="rounded-[calc(1rem-1px)] bg-surface p-5 text-center">
        <p className="font-display text-lg font-semibold">{t.pay.viralTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.pay.viralBody}</p>
        <Link
          href="/app/cobrar"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-100 hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <HandCoins className="size-4" aria-hidden="true" />
          {t.pay.viralCta}
        </Link>
      </div>
    </div>
  );
}
