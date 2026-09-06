"use client";

import Link from "next/link";
import { HandCoins } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Cada pago termina con una invitación a cobrar: así crece Camalote. */
export function ViralCta() {
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
