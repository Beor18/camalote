"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithdrawModal } from "@/components/bridge/withdraw-modal";
import { SolanaDepositModal } from "@/components/invest/deposit-solana-modal";
import { saveTransfer } from "@/lib/history";
import { useLang } from "@/lib/i18n";
import type { Engine } from "@/components/bridge/types";

/**
 * Depositar y retirar USDC de la cuenta de Solana, con sus modales. Viven
 * debajo del saldo, en la orilla izquierda del río.
 */
export function AccountActions({ session, balances, actions }: Engine) {
  const { t } = useLang();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const address = session.solanaAddress;

  const close = () => {
    setModal(null);
    balances.refresh();
  };

  return (
    <>
      <div className="-ml-2 flex flex-wrap items-center">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-primary"
          onClick={() => setModal("deposit")}
          disabled={!address}
          data-testid="deposit-open"
        >
          <ArrowDownToLine className="size-4" aria-hidden="true" />
          {t.invest.deposit}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-primary"
          onClick={() => setModal("withdraw")}
          disabled={!address || !balances.solanaUnits}
          data-testid="withdraw-open"
        >
          <ArrowUpFromLine className="size-4" aria-hidden="true" />
          {t.invest.withdraw}
        </Button>
      </div>

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
