"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftRight,
  HandCoins,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CamaloteLogo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
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
export function BridgeShell({
  session,
  balances,
  actions,
  view = "invest",
}: Engine & { view?: ShellView }) {
  const { t } = useLang();
  // La regla de inversión corre mientras la app está abierta.
  useAutoInvest({ session, balances, actions });
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
              <Badge tone="warning" title={t.common.demoBadge}>
                <Sparkles className="size-3" aria-hidden="true" />
                <span className="hidden sm:inline">{t.common.demoBadge}</span>
                <span className="sr-only sm:hidden">{t.common.demoBadge}</span>
              </Badge>
            )}
            {session.authenticated && (
              <button
                type="button"
                onClick={session.logout}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
              >
                <span className="hidden max-w-40 truncate sm:inline">
                  {session.accountLabel}
                </span>
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.app.logout}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {!session.ready ? (
          <LoadingState />
        ) : session.authenticated ? (
          <div className="flex flex-col gap-6">
            {SHOW_HIDDEN_VIEWS && <ViewTabs view={view} />}
            {view === "cobros" ? (
              <CobrosPanel session={session} balances={balances} actions={actions} />
            ) : view === "invest" ? (
              <InvestPanel session={session} balances={balances} actions={actions} />
            ) : (
              <BridgePanel session={session} balances={balances} actions={actions} />
            )}
          </div>
        ) : (
          <LoginCard session={session} />
        )}
      </main>

      <footer className="border-t border-border py-6">
        <p className="mx-auto max-w-3xl px-4 text-center text-xs text-muted-foreground sm:px-6">
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
      aria-label="Secciones"
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72" />
    </div>
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 animate-fade-up">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {title ?? t.app.loginTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">{sub ?? t.app.loginSub}</p>
      </div>

      <Card className="p-6">
        {session.demo ? (
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
                placeholder={t.app.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              <Mail className="size-4" aria-hidden="true" />
              {t.app.continue}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.app.demoLoginNote}
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <Button size="lg" className="w-full" onClick={() => session.login()}>
              <Mail className="size-4" aria-hidden="true" />
              {button ?? t.app.loginButton}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t.app.loginHint}
            </p>
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
