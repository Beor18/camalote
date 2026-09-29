"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { WithdrawModal } from "@/components/bridge/withdraw-modal";
import { SolanaDepositModal } from "@/components/invest/deposit-solana-modal";
import { saveTransfer } from "@/lib/history";
import { formatUsdc } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { fuelUnitsFor } from "@/lib/invest/fuel";
import type { Engine } from "@/components/bridge/types";

/**
 * Tu cuenta: el saldo en USDC, la dirección donde te pagan, depositar y
 * retirar. Lo que llega acá cuenta para la regla.
 */
export function AccountCard({ session, balances, actions }: Engine) {
  const { lang, t } = useLang();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const address = session.solanaAddress;
  const shortAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const close = () => {
    setModal(null);
    balances.refresh();
  };

  return (
    <Card className="p-5 sm:p-6" data-testid="invest-account">
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => setModal("deposit")}
          disabled={!address}
          data-testid="deposit-open"
        >
          <ArrowDownToLine className="size-4" aria-hidden="true" />
          {t.invest.deposit}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setModal("withdraw")}
          disabled={!address || !balances.solanaUnits}
          data-testid="withdraw-open"
        >
          <ArrowUpFromLine className="size-4" aria-hidden="true" />
          {t.invest.withdraw}
        </Button>
      </div>

      {address && shortAddress && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted py-1 pl-3 pr-1">
          <p className="min-w-0 text-xs text-muted-foreground">
            {t.invest.accountAddress}{" "}
            <span className="font-mono text-foreground" title={address}>
              {shortAddress}
            </span>
          </p>
          <CopyButton value={address} label={t.invest.copyAddress} />
        </div>
      )}

      <SolanaDepositModal
        open={modal === "deposit"}
        onClose={close}
        address={address}
        demo={session.demo}
      />
      <WithdrawModal
        open={modal === "withdraw"}
        onClose={close}
        balanceUnits={balances.solanaUnits}
        fuelUnits={fuelUnitsFor(balances.solanaLamports)}
        ownAddress={address}
        demo={session.demo}
        onWithdraw={async (destination, amountUnits, onStep) => {
          const sig = await actions.withdrawSolana(destination, amountUnits, onStep);
          saveTransfer({
            id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            kind: "withdraw",
            amountUnits: amountUnits.toString(),
            receiveUnits: amountUnits.toString(),
            destination,
            solanaSignature: sig,
            status: "done",
            demo: session.demo,
          });
          balances.refresh();
          return sig;
        }}
      />
    </Card>
  );
}
