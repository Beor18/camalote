"use client";

import { Check, ExternalLink, Info, Loader2 } from "lucide-react";
import { AssetIcon } from "@/components/invest/asset-icon";
import { Card } from "@/components/ui/card";
import { solanaExplorerTx } from "@/lib/config";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { assetName, decimalsOf, isDollars } from "@/lib/invest/catalog";
import { formatTokens, toDisplayUnits } from "@/lib/invest/rules";
import type { MultiplierMap, Purchase } from "@/lib/invest/types";

/** Cada operación con su comprobante: compra por regla o a mano, o venta. */
export function PurchasesList({
  purchases,
  multipliers,
}: {
  purchases: Purchase[];
  multipliers?: MultiplierMap;
}) {
  const { lang, t } = useLang();
  const sorted = [...purchases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  if (sorted.length === 0) return null;

  return (
    <section aria-label={t.invest.purchasesTitle} data-testid="invest-purchases">
      <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
        {t.invest.purchasesTitle}
      </h2>
      <Card className="divide-y divide-border">
        {sorted.map((p) => {
          const sell = p.kind === "sell";
          // Cantidad como la mostraba la billetera ese día (multiplicador de entonces).
          const multiplier = p.multiplier ?? multipliers?.[p.asset] ?? 1;
          const tokens = formatTokens(
            toDisplayUnits(BigInt(p.tokenUnits), multiplier),
            lang,
            decimalsOf(p.asset)
          );
          const usdc = `${formatUsdc(BigInt(p.usdcUnits), 2, lang)} ${t.common.usdc}`;
          const camaloteFee = BigInt(p.camaloteFeeUnits ?? "0");
          const feeText =
            !sell && p.status === "done" && camaloteFee > 0n
              ? ` · ${t.invest.rowFeeShort(formatUsdc(camaloteFee, camaloteFee < 100_000n ? 3 : 2, lang))}`
              : "";
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* El ícono del activo y, en la esquina, cómo salió (el texto está a la derecha).
                    Blanco sobre verde o rojo: esos fondos no tienen token de texto propio. */}
                <span className="relative shrink-0" aria-hidden="true">
                  <AssetIcon symbol={p.asset} className="size-8" />
                  <span
                    className={`absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full ring-2 ring-surface ${
                      p.status === "done"
                        ? "bg-success text-white"
                        : p.status === "error"
                          ? "bg-destructive text-white"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {p.status === "done" ? (
                      <Check className="size-2.5" strokeWidth={3} />
                    ) : p.status === "error" ? (
                      <Info className="size-2.5" strokeWidth={3} />
                    ) : (
                      <Loader2 className="size-2.5 animate-spin motion-reduce:animate-none" strokeWidth={3} />
                    )}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {sell
                      ? `${isDollars(p.asset) ? t.invest.kindTakeOut : t.invest.kindSell} ${assetName(p.asset, lang)}`
                      : assetName(p.asset, lang)}
                    <span className="font-mono font-normal tabular-nums text-muted-foreground"> · {usdc}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString(lang === "es" ? "es" : "en", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {sell ? "" : ` · ${p.source === "rule" ? t.invest.sourceRule : t.invest.sourceManual}`}
                    {p.status === "done" ? ` · ${tokens} ${p.asset}` : ""}
                    {feeText}
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
          );
        })}
      </Card>
    </section>
  );
}
