"use client";

import { Check, ExternalLink, Info, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { solanaExplorerTx } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { formatTokens } from "@/lib/invest/rules";
import type { Purchase } from "@/lib/invest/types";

/** Cada compra con su comprobante: por regla o a mano, en Solana o simulada. */
export function PurchasesList({ purchases }: { purchases: Purchase[] }) {
  const { lang, t } = useLang();
  const sorted = [...purchases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  if (sorted.length === 0) return null;

  return (
    <section aria-label={t.invest.purchasesTitle} data-testid="invest-purchases">
      <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
        {t.invest.purchasesTitle}
      </h2>
      <Card className="divide-y divide-border">
        {sorted.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  p.status === "done"
                    ? "bg-success/10 text-success"
                    : p.status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                }`}
                aria-hidden="true"
              >
                {p.status === "done" ? (
                  <Check className="size-4" />
                ) : p.status === "error" ? (
                  <Info className="size-4" />
                ) : (
                  <Loader2 className="size-4 animate-spin" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium tabular-nums">
                  {p.status === "done"
                    ? `${formatTokens(BigInt(p.tokenUnits), lang)} ${p.asset}`
                    : p.asset}
                  <span className="font-sans font-normal text-muted-foreground">
                    {" "}
                    · {formatUsdc(BigInt(p.usdcUnits), 2, lang)} {t.common.usdc}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString(lang === "es" ? "es" : "en", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {p.source === "rule" ? t.invest.sourceRule : t.invest.sourceManual}
                  {p.demo ? t.invest.sim : ""}
                  {p.status === "error" && p.errorMessage ? ` · ${p.errorMessage}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {p.status === "done"
                  ? t.invest.purchaseDone
                  : p.status === "error"
                    ? t.invest.purchaseError
                    : t.invest.purchaseBuying}
              </span>
              {p.status === "done" && p.signature && !p.demo && (
                <a
                  href={solanaExplorerTx(p.signature)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.invest.viewOnSolana}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
