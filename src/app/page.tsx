"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  HeartHandshake,
  Landmark,
  Lock,
  Minus,
  Rocket,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { CamaloteLogo, CamaloteMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Napkin } from "@/components/landing/napkin";
import { PhoneMock } from "@/components/landing/phone-mock";
import { InstallCta } from "@/components/install-cta";
import { DEMO_MODE } from "@/lib/config";
import { LangToggle, useLang } from "@/lib/i18n";

/**
 * La landing vende como una startup: la promesa en una línea con el
 * producto al lado, el problema en un golpe (te pagan 40,
 * se van 40), cómo se arma en un minuto, los tres destinos, la cuenta hecha
 * en un toque, sin letra chica, preguntas (ahí va "¿por qué Solana?") y el
 * cierre.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Destinations />
        <Napkin />
        <NoFinePrint />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

const ctaClasses =
  "inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-primary-foreground transition-[background-color,transform] duration-100 ease-out hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const secondaryClasses =
  "inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-base font-medium transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const navLinkClasses =
  "hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex";

const sectionTitle = "text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl";

function Header() {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <CamaloteLogo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <a href="#como-funciona" className={navLinkClasses}>
            {t.landing.navWhy}
          </a>
          <a href="#precio" className={navLinkClasses}>
            {t.landing.navPrice}
          </a>
          <LangToggle />
          <Link
            href="/app"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-100 hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.landing.navOpenApp}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** La promesa en una línea, con el producto al lado. */
function Hero() {
  const { t } = useLang();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
        <div className="text-center lg:text-left">
          <div className="animate-fade-up flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <Badge>{t.landing.heroEyebrow}</Badge>
            {DEMO_MODE && <Badge tone="warning">{t.landing.badgeDemo}</Badge>}
          </div>
          <h1 className="animate-fade-up mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.5rem]">
            {t.landing.heroLine1}
            <br />
            <span className="text-gradient">{t.landing.heroHighlight}</span>
          </h1>
          <p className="animate-fade-up-delay mx-auto mt-5 max-w-xl text-lg text-muted-foreground lg:mx-0">
            {t.landing.heroSub}
          </p>
          <div className="animate-fade-up-delay mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/app" className={ctaClasses}>
              {t.landing.heroCta}
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <a href="#como-funciona" className={secondaryClasses}>
              {t.landing.heroSecondary}
            </a>
          </div>
          <ul className="animate-fade-up-delay mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start">
            {t.landing.heroProof.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <InstallCta className="mt-5 lg:items-start" />
        </div>

        <div className="animate-fade-up-delay">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

/** El problema en un golpe, y el antes y después. */
function Problem() {
  const { t } = useLang();
  return (
    <section id="convenceme" className="border-t border-border py-10 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className={sectionTitle}>{t.landing.problemTitle}</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">{t.landing.problemSub}</p>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6">
          <Card className="p-5 opacity-80 sm:p-6">
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-medium text-muted-foreground">{t.landing.oldWayTitle}</h3>
            </div>
            <ul className="mt-5 flex flex-col gap-3">
              {t.landing.oldWay.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Minus className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <div className="overflow-hidden rounded-2xl bg-brand-gradient p-[1px]">
            <div className="h-full rounded-[calc(1rem-1px)] bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <CamaloteMark className="size-4" />
                <h3 className="font-medium">{t.landing.newWayTitle}</h3>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {t.landing.newWay.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Las fichas de cada paso, como se ven en la app. */
function StepVisual({ index }: { index: number }) {
  const { t } = useLang();
  const v = t.landing.stepsVisual;
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center whitespace-nowrap rounded-lg border px-2 text-xs font-semibold ${
      active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"
    }`;
  if (index === 0) {
    return (
      <div className="flex gap-1.5" aria-hidden="true">
        {v.percents.map((p, k) => (
          <span key={p} className={`${chip(k === 2)} font-mono tabular-nums`}>
            {p}
          </span>
        ))}
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="flex gap-1.5" aria-hidden="true">
        {v.goals.map((g, k) => (
          <span key={g} className={chip(k === 0)}>
            {g}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" aria-hidden="true">
      {v.tabs.map((tab, k) => (
        <span
          key={tab}
          className={`flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium ${
            k === 0 ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

function HowItWorks() {
  const { t } = useLang();
  return (
    <section id="como-funciona" className="border-t border-border bg-muted/40 py-10 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className={sectionTitle}>{t.landing.stepsTitle}</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">{t.landing.stepsSub}</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {t.landing.steps.map((step, i) => (
            <Card key={step.title} className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="font-medium">{step.title}</h3>
              </div>
              <StepVisual index={i} />
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <span className="block">{t.landing.stepsNote}</span>
          <Link
            href="/app"
            className="mt-1 inline-flex items-center gap-1 rounded-md font-medium text-primary underline-offset-4 transition-colors duration-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.landing.stepsLink}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}

const PICK_ICONS = [TrendingUp, Rocket, Landmark];

/** Los tres destinos, con su comisión a la vista. */
function Destinations() {
  const { t } = useLang();
  return (
    <section id="en-que" className="border-t border-border py-10 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className={sectionTitle}>{t.landing.pickTitle}</h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">{t.landing.pickSub}</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          {t.landing.picks.map((pick, i) => {
            const Icon = PICK_ICONS[i];
            return (
              <Card key={pick.title} className="flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge>{pick.tag}</Badge>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{pick.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pick.body}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const TRUST_ICONS = [ShieldCheck, Lock, HeartHandshake];

/** Sin letra chica: los números ciertos y las tres promesas que sí hacemos. */
function NoFinePrint() {
  const { t } = useLang();
  return (
    <section id="precio" className="border-t border-border bg-muted/40 py-10 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className={sectionTitle}>{t.landing.factsTitle}</h2>
        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-8 text-center sm:mt-12 sm:grid-cols-4">
          {t.landing.facts.map((cell) => (
            <div key={cell.label} className="flex flex-col-reverse gap-1">
              <dt className="text-sm text-muted-foreground">{cell.label}</dt>
              <dd className="font-mono text-2xl font-semibold sm:text-3xl">{cell.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground">
          {t.landing.factsNote}
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-5 border-t border-border pt-10 sm:mt-14 sm:grid-cols-3 sm:gap-6 sm:pt-14">
          {t.landing.trust.map((point, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <div key={point.title} className="flex items-start gap-4 text-left sm:block">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-medium sm:mt-4">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useLang();
  return (
    <section className="py-10 sm:py-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <h2 className={sectionTitle}>{t.landing.faqTitle}</h2>
        <div className="mt-10 flex flex-col gap-3">
          {t.landing.faqs.map((faq) => (
            <details key={faq.q} className="group rounded-2xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { t } = useLang();
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
        <div className="rounded-[calc(1.5rem-1px)] bg-surface px-6 py-10 text-center sm:py-14">
          <CamaloteMark className="mx-auto mb-5 size-16" />
          <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            <span className="block">{t.landing.finalTitle1}</span>
            <span className="text-gradient block">{t.landing.finalTitle2}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t.landing.finalSub}</p>
          <Link href="/app" className={`${ctaClasses} mt-8`}>
            {t.landing.finalCta}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <InstallCta className="mt-4" />
        </div>
      </div>
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
        <Link
          href="/stats"
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
          {t.landing.footerStats}
        </Link>
        <p className="max-w-xl text-xs text-muted-foreground">{t.landing.footerNote}</p>
      </div>
    </footer>
  );
}
