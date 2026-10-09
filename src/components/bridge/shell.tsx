"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Ghost,
  HandCoins,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { CamaloteLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BridgePanel } from "@/components/bridge/panel";
import { CobrosPanel } from "@/components/cobros/panel";
import { InvestPanel } from "@/components/invest/panel";
import { useAutoInvest } from "@/components/invest/use-auto-invest";
import { SHOW_HIDDEN_VIEWS } from "@/lib/config";
import { LangToggle, useLang } from "@/lib/i18n";
import type { BridgeSession, Engine } from "@/components/bridge/types";

export type ShellView = "bridge" | "cobros" | "invest";

/**
 * La app es Invertir. Cobrar con links y el cruce desde Base quedaron
 * ocultos (SHOW_HIDDEN_VIEWS); el motor sigue siendo uno solo.
 */
/**
 * Mobile first en todas las pantallas: la app es una sola columna de teléfono,
 * centrada también en escritorio. Adentro no hay variantes por ancho de pantalla.
 */
export function BridgeShell({
  session,
  balances,
  actions,
  agent,
  view = "invest",
}: Engine & { view?: ShellView }) {
  const { t } = useLang();
  // La regla de inversión corre mientras la app está abierta.
  useAutoInvest({ session, balances, actions, agent });
  return (
    <div className="flex min-h-dvh flex-col [&:has([data-action-bar])]:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CamaloteLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            {session.authenticated && (
              <button
                type="button"
                onClick={session.logout}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.app.logout} ({session.accountLabel})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        {!session.ready ? (
          <LoadingState />
        ) : session.authenticated ? (
          <div className="flex flex-col gap-6">
            {SHOW_HIDDEN_VIEWS && <ViewTabs view={view} />}
            {view === "cobros" ? (
              <CobrosPanel session={session} balances={balances} actions={actions} agent={agent} />
            ) : view === "invest" ? (
              <InvestPanel session={session} balances={balances} actions={actions} agent={agent} />
            ) : (
              <BridgePanel session={session} balances={balances} actions={actions} />
            )}
          </div>
        ) : (
          <LoginCard session={session} />
        )}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-md px-4 text-center text-xs text-muted-foreground">
          {t.app.footer}
        </p>
      </footer>
    </div>
  );
}

/** Tres caras del mismo motor: cobrar, invertir una parte, o llevar tus USDC. */
function ViewTabs({ view }: { view: ShellView }) {
  const { t } = useLang();
  const tabs: {
    key: ShellView;
    href: string;
    label: string;
    shortLabel?: string;
    Icon: typeof HandCoins;
  }[] = [
    { key: "cobros", href: "/app/cobrar", label: t.app.tabCobros, Icon: HandCoins },
    { key: "invest", href: "/app/invertir", label: t.app.tabInvest, Icon: TrendingUp },
    {
      key: "bridge",
      href: "/app",
      label: t.app.tabBridge,
      shortLabel: t.app.tabBridgeShort,
      Icon: ArrowLeftRight,
    },
  ];
  return (
    <nav
      aria-label={t.app.sectionsLabel}
      className="mx-auto grid w-full max-w-lg grid-cols-3 rounded-xl border border-border bg-muted p-1"
    >
      {tabs.map(({ key, href, label, shortLabel, Icon }) => {
        const active = key === view;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:text-sm ${
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {shortLabel ? (
              <>
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              <span>{label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/** La G de Google, con sus colores de marca (por eso no salen de los tokens). */
function GoogleMark() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="size-4">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}

export function LoginCard({
  session,
  title,
  sub,
  button,
}: {
  session: BridgeSession;
  title?: string;
  sub?: string;
  button?: string;
}) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [withEmail, setWithEmail] = useState(false);
  const [google, setGoogle] = useState<"idle" | "going" | "error">("idle");

  // Si vuelve de Google con "atrás", el navegador restaura la página tal cual.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogle("idle");
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const startGoogle = async () => {
    setGoogle("going");
    try {
      await session.loginWithGoogle();
    } catch {
      setGoogle("error");
    }
  };

  // En el demo el email se escribe acá; en la app real lo pide la ventana de Privy.
  const emailForm = (primary: boolean) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (email.includes("@")) session.login(email);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {t.app.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          autoFocus={!primary}
          placeholder={t.app.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        />
      </div>
      <Button type="submit" size="lg" variant={primary ? "primary" : "secondary"} className="w-full">
        <Mail className="size-4" aria-hidden="true" />
        {t.app.continue}
      </Button>
    </form>
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 animate-fade-up">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {title ?? t.app.loginTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">{sub ?? t.app.loginSub}</p>
      </div>

      <Card className="p-6">
        {button ? (
          // Links de pago: siguen solo con email.
          <div className="flex flex-col gap-4">
            {session.demo ? (
              emailForm(true)
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={() => session.login()}>
                  <Mail className="size-4" aria-hidden="true" />
                  {button}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t.app.loginHint}</p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Button size="lg" className="w-full" onClick={startGoogle} disabled={google === "going"} data-testid="login-google">
              {google === "going" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              {t.app.loginGoogle}
            </Button>
            {google === "error" ? (
              <p className="text-center text-xs text-destructive" role="alert">
                {t.app.loginGoogleError}
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t.app.loginGoogleHint}</p>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              {t.app.loginOr}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={session.loginWithWallet} data-testid="login-phantom">
              <Ghost className="size-4" aria-hidden="true" />
              {t.app.loginPhantom}
            </Button>

            {session.demo && withEmail ? (
              emailForm(false)
            ) : (
              <button
                type="button"
                onClick={() => (session.demo ? setWithEmail(true) : session.login())}
                className="mx-auto min-h-10 cursor-pointer rounded-lg px-3 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-100 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="login-email"
              >
                {t.app.loginEmailLink}
              </button>
            )}
          </div>
        )}
      </Card>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {t.app.custodyNote}
      </p>
    </div>
  );
}
