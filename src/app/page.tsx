"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  HeartHandshake,
  Lock,
  Mail,
  Minus,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { CamaloteLogo, CamaloteMark } from "@/components/logo";
import { BaseMark, SolanaMark } from "@/components/chain-logos";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MiniCalc } from "@/components/landing/mini-calc";
import { DEMO_MODE } from "@/lib/config";
import { LangToggle, useLang } from "@/lib/i18n";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Showdown />
        <WhySolana />
        <HowItWorks />
        <Pricing />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

const ctaClasses =
  "inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-primary-foreground transition-[background-color,transform] duration-100 ease-out hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const navLinkClasses =
  "hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex";

function Header() {
  const { t } = useLang();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <CamaloteLogo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
          <a href="#convenceme" className={navLinkClasses}>
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

function Hero() {
  const { t } = useLang();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        {DEMO_MODE && (
          <div className="mb-5 animate-fade-up">
            <Badge tone="warning">{t.landing.badgeDemo}</Badge>
          </div>
        )}
        <h1 className="animate-fade-up font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {t.landing.heroLine1}
          <br />
          {t.landing.heroLine2Pre}
          <span className="text-gradient">{t.landing.heroLine2Highlight}</span>
          {t.landing.heroLine2Post}
        </h1>
        <p className="animate-fade-up-delay mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          {t.landing.heroSub}
        </p>
        <div className="animate-fade-up-delay mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/app" className={ctaClasses}>
            {t.landing.heroCta}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <a
            href="#por-que-solana"
            className="inline-flex h-13 items-center rounded-xl px-5 text-base text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.landing.heroSecondary}
          </a>
        </div>
      </div>

      <BridgeVisual />
    </section>
  );
}

/** Banda de agua ondulada, 1120 de ancho (2 períodos de 560) para loopear. */
function wavePath(y: number, amp: number): string {
  const half = 70;
  let d = `M 0 ${y} Q ${half / 2} ${y - amp} ${half} ${y}`;
  for (let x = half * 2; x <= 1120; x += half) d += ` T ${x} ${y}`;
  return `${d} V 220 H 0 Z`;
}

function surfacePath(y: number, amp: number): string {
  const half = 70;
  let d = `M 0 ${y} Q ${half / 2} ${y - amp} ${half} ${y}`;
  for (let x = half * 2; x <= 560; x += half) d += ` T ${x} ${y}`;
  return d;
}

function BridgeVisual() {
  const { t } = useLang();
  return (
    <figure className="mx-auto mt-16 w-full max-w-3xl">
      <div
        className="flex w-full justify-center overflow-hidden"
        aria-hidden="true"
      >
        {/* bloque de 560px fijos: en pantallas angostas se escala completo
            para que el offset-path no se desalinee; flex lo centra aunque
            desborde, cosa que mx-auto no hace */}
        <div
          className="relative h-[220px] w-[560px] shrink-0 origin-top max-[639px]:scale-[0.8] max-[639px]:-mb-11 max-[430px]:scale-[0.62] max-[430px]:-mb-[84px]"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent 0, black 7%, black 93%, transparent 100%)",
          }}
        >
          <svg
            viewBox="0 0 560 220"
            fill="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient
                id="rio-g"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="150"
                x2="560"
                y2="150"
              >
                <stop offset="0%" stopColor="var(--base-blue)" />
                <stop offset="55%" stopColor="var(--solana-purple)" />
                <stop offset="100%" stopColor="var(--solana-green)" />
              </linearGradient>
            </defs>
            {/* capas de agua de atrás: derivan hacia la orilla verde */}
            <g className="wave wave-slow" opacity="0.09" fill="var(--base-blue)">
              <path d={wavePath(154, 6)} />
            </g>
            <g
              className="wave wave-mid"
              opacity="0.08"
              fill="var(--solana-purple)"
            >
              <path d={wavePath(164, 7)} />
            </g>
          </svg>

          {/* el camalote navega con su tripulación a bordo */}
          <span className="camalote-sail absolute">
            <span className="camalote-bob relative block w-[170px]">
              <Image
                src="/img/camalote-tripulacion-480.png"
                alt=""
                width={480}
                height={336}
                priority
                className="h-auto w-full"
              />
            </span>
          </span>

          {/* agua de adelante: tapa las raíces para que el camalote quede
              metido en el río en vez de flotando encima */}
          <svg
            viewBox="0 0 560 220"
            fill="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {/* superficie del río con el gradiente de marca */}
            <path
              d={surfacePath(150, 5)}
              stroke="url(#rio-g)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* cuerpo del agua: opaco, tapa lo que queda bajo la superficie */}
            <g className="wave wave-mid" opacity="0.92" fill="var(--background)">
              <path d={wavePath(158, 6)} />
            </g>
            <g
              className="wave wave-mid"
              opacity="0.12"
              fill="var(--solana-purple)"
            >
              <path d={wavePath(158, 6)} />
            </g>
            <g
              className="wave wave-fast"
              opacity="0.16"
              fill="var(--solana-green)"
            >
              <path d={wavePath(172, 8)} />
            </g>
          </svg>

          {/* las orillas */}
          <div className="absolute bottom-2 left-3 flex flex-col items-center gap-1.5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
              <BaseMark className="size-6 rounded-[5px]" />
            </span>
            <span className="rounded bg-surface/80 px-1.5 text-xs font-medium text-muted-foreground">
              Base
            </span>
          </div>
          <div className="absolute bottom-2 right-3 flex flex-col items-center gap-1.5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
              <SolanaMark className="size-6" />
            </span>
            <span className="rounded bg-surface/80 px-1.5 text-xs font-medium text-muted-foreground">
              Solana
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mx-auto mt-4 max-w-xl px-4 text-center text-sm text-muted-foreground sm:px-6">
        {t.landing.heroStory}
      </figcaption>
    </figure>
  );
}

function Showdown() {
  const { t } = useLang();
  return (
    <section
      id="convenceme"
      className="border-t border-border bg-muted/40 py-20"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.showdownTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          {t.landing.showdownSub}
        </p>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <Card className="p-6 opacity-80">
            <div className="flex items-center gap-2">
              <BaseMark className="size-3.5 rounded-[2px]" />
              <h3 className="font-medium text-muted-foreground">
                {t.landing.baseColTitle}
              </h3>
            </div>
            <ul className="mt-5 flex flex-col gap-3">
              {t.landing.baseCol.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <Minus
                    className="mt-0.5 size-4 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <div className="overflow-hidden rounded-2xl bg-brand-gradient p-[1px]">
            <div className="h-full rounded-[calc(1rem-1px)] bg-surface p-6">
              <div className="flex items-center gap-2">
                <SolanaMark className="size-3.5" />
                <h3 className="font-medium">{t.landing.solanaColTitle}</h3>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {t.landing.solanaCol.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <figure className="mx-auto mt-14 max-w-md -rotate-1">
          <blockquote className="rounded-2xl border border-border bg-surface p-8 font-hand text-2xl leading-snug shadow-sm sm:text-3xl">
            {t.landing.letter.map((line, i) => (
              <span key={i}>
                {line}
                {i < t.landing.letter.length - 1 && <br />}
              </span>
            ))}
          </blockquote>
        </figure>
      </div>
    </section>
  );
}

function WhySolana() {
  const { t } = useLang();
  return (
    <section id="por-que-solana" className="border-t border-border py-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.whyTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          {t.landing.whySub}
        </p>
        <div className="mt-12 flex flex-col">
          {t.landing.whyItems.map((reason, i) => (
            <div
              key={reason.claim}
              className="grid gap-3 border-t border-border py-8 first:border-t-0 sm:grid-cols-[80px_1fr] sm:gap-6"
            >
              <span
                className="font-mono text-sm text-muted-foreground"
                aria-hidden="true"
              >
                0{i + 1}
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold sm:text-2xl">
                  {reason.claim}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {reason.body}
                </p>
                {i === t.landing.whyItems.length - 1 && (
                  <a
                    href="https://superteam.ar"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 transition-colors duration-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t.landing.whyLink}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEP_ICONS = [Mail, Wallet, Zap];

function HowItWorks() {
  const { t } = useLang();
  return (
    <section id="como-funciona" className="py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.stepsTitle}
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {t.landing.steps.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <Card key={step.title} className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-sm font-semibold text-muted-foreground">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useLang();
  return (
    <section id="precio" className="border-t border-border bg-muted/40 py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.landing.pricingTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{t.landing.pricingSub}</p>
        </div>
        <MiniCalc />
      </div>
    </section>
  );
}

const TRUST_ICONS = [ShieldCheck, Lock, HeartHandshake];

function Trust() {
  const { t } = useLang();
  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.trustTitle}
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {t.landing.trust.map((point, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <div key={point.title} className="text-center sm:text-left">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-medium">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {point.body}
                </p>
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
    <section className="py-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.landing.faqTitle}
        </h2>
        <div className="mt-10 flex flex-col gap-3">
          {t.landing.faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-border bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
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
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-brand-gradient p-[1px]">
        <div className="rounded-[calc(1.5rem-1px)] bg-surface px-6 py-14 text-center">
          <CamaloteMark className="mx-auto mb-5 size-16" />
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.landing.finalTitle1} {t.landing.finalTitle2}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {t.landing.finalSub}
          </p>
          <Link href="/app" className={`${ctaClasses} mt-8`}>
            {t.landing.finalCta}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
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
        <p className="text-xs text-muted-foreground">
          {t.landing.footerMadeIn}{" "}
          <a
            href="https://superteam.ar"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Superteam AR
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
