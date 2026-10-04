"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Engine } from "@/components/bridge/types";

/**
 * Tu cuenta: el saldo en USDC y la dirección donde te pagan. Recibir y
 * retirar están en la barra de abajo. Lo que llega acá cuenta para la regla.
 */
export function AccountCard({ session, balances }: Engine) {
  const { lang, t } = useLang();
  const address = session.solanaAddress;
  const shortAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  return (
    <Card className="p-5" data-testid="invest-account">
      <p className="text-xs font-medium text-muted-foreground">{t.invest.accountTitle}</p>
      {balances.solanaUnits === null ? (
        <Skeleton className="mt-1 h-9 w-32" />
      ) : (
        <p className="mt-0.5 font-display text-3xl font-semibold leading-tight tabular-nums">
          <span data-testid="usdc-balance">{formatUsdc(balances.solanaUnits, 2, lang)}</span>{" "}
          <span className="text-sm font-normal text-muted-foreground">{t.common.usdc}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{t.invest.accountSub}</p>

      {address && shortAddress && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-muted py-1 pl-3 pr-1">
          <p className="min-w-0 text-xs text-muted-foreground">
            {t.invest.accountAddress}{" "}
            <span className="font-mono text-foreground" title={address}>
              {shortAddress}
            </span>
          </p>
          <CopyButton value={address} label={t.invest.copyAddress} />
        </div>
      )}
    </Card>
  );
}
