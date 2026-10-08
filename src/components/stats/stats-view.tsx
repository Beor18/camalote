"use client";

import Link from "next/link";
import { ArrowRight, CircleDollarSign, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CamaloteLogo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { LangToggle, useLang } from "@/lib/i18n";
import { argentinaTime, parseTraction, type Traction } from "@/lib/invest/traction";
import { Odometer } from "./odometer";
import { Receipt } from "./receipt";
import { agoText, usdcText } from "./stats-format";

/** El servidor guarda los números un minuto: pedirlos más seguido no trae nada nuevo. */
const REFRESH_MS = 60_000;

/*
 * Un reloj de a un segundo para "actualizado hace 12 s". En el servidor (y
 * al hidratar) vale 0 y se muestra la hora fija, así el HTML no cambia.
 */
let clockNow = 0;
function subscribeClock(onChange: () => void): () => void {
  const tick = () => {
    clockNow = Date.now();
    onChange();
  };
  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
const readClock = () => clockNow;
const readServerClock = () => 0;

const primaryClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-[background-color,transform] duration-100 ease-out hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * /stats: los números de /api/stats, para mirar. El número grande rueda al
 * cargar, el recorrido muestra cuántos llegan a cada paso y las compras van
 * en un ticket con su link. Se actualiza solo cada minuto mientras la
 * pestaña está a la vista.
 */
export function StatsView({ initial }: { initial: Traction | null }) {
  const [data, setData] = useState<Traction | null>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  // los datos del servidor cuentan como el primer pedido
  const lastFetch = useRef(initial ? Date.parse(initial.asOf) : 0);

  const refresh = useCallback(async () => {
    lastFetch.current = Date.now();
    setStatus("loading");
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const next = parseTraction(await res.json().catch(() => null));
      if (!res.ok || !next) throw new Error("stats unavailable");
      setData(next);
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(refresh, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - lastFetch.current >= REFRESH_MS) void refresh();
      start();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        {data ? (
          <>
            <Hero data={data} failed={status === "failed"} />
            <Path data={data} />
            <Closing />
          </>
        ) : (
          <LoadError loading={status === "loading"} onRetry={refresh} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Camalote"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CamaloteLogo />
        </Link>
        <nav className="flex items-center gap-2" aria-label="Principal">
          <LangToggle />
          <Link href="/app" className={`${primaryClasses} h-10 px-4 text-sm`}>
            {t.landing.navOpenApp}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function LiveLine({ asOf, failed }: { asOf: string; failed: boolean }) {
  const { lang, t } = useLang();
  const now = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  const updated =
    now > 0
      ? t.stats.updatedAgo(agoText(now - Date.parse(asOf), lang))
      : t.stats.updatedAt(argentinaTime(asOf, lang).time);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 lg:justify-start">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        {t.stats.live}
      </span>
      <span className="text-sm text-muted-foreground">{updated}</span>
      {/* solo se anuncia si falla: el "hace 12 s" cambia cada segundo */}
      <span role="status" className="text-sm text-warning empty:sr-only">
        {failed ? t.stats.refreshFailed : ""}
      </span>
    </div>
  );
}

/** El número grande y el ticket. */
function Hero({ data, failed }: { data: Traction; failed: boolean }) {
  const { lang, t } = useLang();
  const invested = usdcText(data.usdcInvested, lang);
  return (
    <section className="relative isolate overflow-hidden">
      {/* un halo de marca detrás del número, apenas */}
      <div
        className="pointer-events-none absolute -left-32 -top-40 -z-10 size-[36rem] rounded-full bg-brand-gradient opacity-[0.12] blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <div className="text-center lg:text-left">
          <div className="animate-fade-up">
            <LiveLine asOf={data.asOf} failed={failed} />
          </div>
          <h1 className="animate-fade-up mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            {t.stats.title} <span className="text-gradient">{t.stats.titleHighlight}</span>
          </h1>
          <p className="animate-fade-up-delay mx-auto mt-4 max-w-lg text-lg text-muted-foreground lg:mx-0">
            {t.stats.sub}
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 lg:items-start">
            <div className="flex items-end gap-3">
              <Odometer
                value={invested}
                label={t.stats.investedSr(invested)}
                className="font-display text-7xl font-semibold tracking-tight sm:text-8xl"
              />
              <span className="pb-1 font-display text-2xl font-semibold text-muted-foreground sm:text-3xl" aria-hidden="true">
                USDC
              </span>
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground" aria-hidden="true">
              <CircleDollarSign className="size-4 text-success" />
              {t.stats.investedLabel}
            </p>
          </div>
        </div>

        <Receipt data={data} />
      </div>
    </section>
  );
}

const STEP_KEYS = ["accounts", "rulesOn", "agentsOn"] as const;

/**
 * Del email al agente: tres números grandes que ruedan como el principal,
 * unidos por la correntada de puntos. Debajo de cada paso, qué parte de las
 * cuentas llegó hasta ahí (se calcula en vivo, como todo lo demás).
 */
function Path({ data }: { data: Traction }) {
  const { t } = useLang();
  return (
    <section className="border-t border-border bg-muted/40 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.stats.pathTitle}
        </h2>

        <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-border bg-surface px-3 py-10 sm:mt-14 sm:px-10 sm:py-14">
          <ol className="grid grid-cols-3">
            {STEP_KEYS.map((key, i) => {
              const value = data[key];
              const pct = i > 0 && data.accounts > 0 ? Math.round((value / data.accounts) * 100) : null;
              return (
                <li key={key} className="relative flex flex-col items-center gap-3 px-1 text-center">
                  {i < STEP_KEYS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="path-flow absolute left-[calc(50%+2rem)] right-[calc(-50%+2rem)] top-[23px] h-0.5 sm:left-[calc(50%+3.5rem)] sm:right-[calc(-50%+3.5rem)] sm:top-[35px]"
                    />
                  )}
                  <Odometer
                    value={String(value)}
                    label={String(value)}
                    className="font-display text-5xl font-semibold tracking-tight sm:text-7xl"
                  />
                  {/* en el celular los nombres ocupan dos renglones, así las fichas quedan a la misma altura */}
                  <span className="flex min-h-10 items-start text-sm font-medium text-muted-foreground sm:min-h-0 sm:text-base">
                    {t.stats.steps[key]}
                  </span>
                  {pct !== null && (
                    <span className="whitespace-nowrap rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-success">
                      <span className="sm:hidden" aria-hidden="true">
                        {pct} %
                      </span>
                      <span className="sr-only sm:not-sr-only">{t.stats.ofAccounts(pct)}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  const { t } = useLang();
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
        <div className="rounded-[calc(1.5rem-1px)] bg-surface px-6 py-10 text-center sm:py-14">
          <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.stats.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t.stats.ctaSub}</p>
          <Link href="/app" className={`${primaryClasses} mt-8 h-13 px-7 text-base`}>
            {t.stats.cta}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function LoadError({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  const { t } = useLang();
  return (
    <section className="mx-auto w-full max-w-md px-4 py-20 sm:py-28">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t.stats.errorTitle}</h1>
        <p className="text-muted-foreground">{t.stats.errorBody}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className={`${primaryClasses} mt-3 h-11 cursor-pointer px-5 text-sm disabled:cursor-wait disabled:opacity-70`}
        >
          <RefreshCw className={`size-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
          {loading ? t.stats.retrying : t.stats.retry}
        </button>
      </Card>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
        <CamaloteLogo />
        <p className="text-xs text-muted-foreground">{t.landing.footerMadeIn}</p>
      </div>
    </footer>
  );
}
