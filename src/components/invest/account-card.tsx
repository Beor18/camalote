"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { SolanaMark } from "@/components/chain-logos";
import { WithdrawModal } from "@/components/bridge/withdraw-modal";
import { SolanaDepositModal } from "@/components/invest/deposit-solana-modal";
import { formatUsdc, truncateAddress } from "@/lib/format";
import { saveTransfer } from "@/lib/history";
import { useLang } from "@/lib/i18n";
import { notifyIncoming } from "@/lib/invest/storage";
import type { Engine } from "@/components/bridge/types";

/** En demo, "te llegan 40 USDC" con un toque: como si te pagaran ahora. */
const DEMO_INCOMING_UNITS = 40_000_000n;

/**
 * La cuenta de Solana del usuario: acá llegan los USDC (de quien le paga,
 * de un exchange, de donde sea) y acá quedan las acciones. Depositar y
 * retirar USDC; nada más que eso.
 */
export function AccountCard({ session, balances, actions }: Engine) {
  const { lang, t } = useLang();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const address = session.solanaAddress;

  const close = () => {
    setModal(null);
    balances.refresh();
  };

  return (
    <>
      <Card className="p-4 sm:p-5" data-testid="invest-account">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SolanaMark className="size-3.5" />
              <span className="text-sm font-medium">{t.invest.accountTitle}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.invest.accountSub}</p>
            {address ? (
              <div className="mt-1 flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground" title={address}>
                  {truncateAddress(address)}
                </span>
                <CopyButton value={address} label={t.invest.copyAddress} />
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t.app.addressPending}</p>
            )}
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            {balances.solanaUnits === null ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <span
                  className="font-mono text-2xl font-semibold tabular-nums"
                  data-testid="usdc-balance"
                >
                  {formatUsdc(balances.solanaUnits, 2, lang)}
                </span>
                <span className="text-sm text-muted-foreground">{t.common.usdc}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setModal("deposit")}
            disabled={!address}
            data-testid="deposit-open"
          >
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            {t.invest.deposit}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setModal("withdraw")}
            disabled={!address || !balances.solanaUnits}
            data-testid="withdraw-open"
          >
            <ArrowUpFromLine className="size-4" aria-hidden="true" />
            {t.invest.withdraw}
          </Button>
          {session.demo && actions.simulateIncoming && address && (
            <button
              type="button"
              data-testid="simulate-incoming"
              onClick={() => {
                actions.simulateIncoming?.(address, DEMO_INCOMING_UNITS);
                balances.refresh();
                notifyIncoming();
              }}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t.invest.simulateIncoming}
            </button>
          )}
        </div>
      </Card>

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
        ownAddress={address}
        demo={session.demo}
        onWithdraw={async (destination, amountUnits) => {
          const sig = await actions.withdrawSolana(destination, amountUnits);
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
    </>
  );
}
