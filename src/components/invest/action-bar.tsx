"use client";

import { useState } from "react";
import { ArrowUpFromLine, Plus, QrCode } from "lucide-react";
import { WithdrawModal } from "@/components/bridge/withdraw-modal";
import { SolanaDepositModal } from "@/components/invest/deposit-solana-modal";
import { saveTransfer } from "@/lib/history";
import { useLang } from "@/lib/i18n";
import { fuelUnitsFor } from "@/lib/invest/fuel";
import type { Engine } from "@/components/bridge/types";

const side =
  "flex h-14 flex-col items-center justify-end gap-1 rounded-xl pb-1 text-xs font-medium text-muted-foreground transition-colors duration-100 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 cursor-pointer";

/**
 * Barra fija abajo, a mano con el pulgar: recibir (cómo entra la plata, al
 * centro), comprar una vez y retirar. Son las únicas entradas a esas acciones.
 */
export function ActionBar({ session, balances, actions, onBuy }: Omit<Engine, "agent"> & { onBuy: () => void }) {
  const { t } = useLang();
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);
  const address = session.solanaAddress;

  const close = () => {
    setModal(null);
    balances.refresh();
  };

  return (
    <>
      <nav
        aria-label={t.invest.barLabel}
        data-action-bar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 items-end px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          <button type="button" onClick={onBuy} className={side} data-testid="buy-open">
            <Plus className="size-5" aria-hidden="true" />
            {t.invest.barBuy}
          </button>

          <button
            type="button"
            onClick={() => setModal("deposit")}
            disabled={!address}
            className="group flex flex-col items-center gap-1 pb-1 text-xs font-semibold text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
            data-testid="deposit-open"
          >
            <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform duration-100 ease-out group-hover:bg-primary/90 group-active:scale-95 group-focus-visible:ring-ring">
              <QrCode className="size-6" aria-hidden="true" />
            </span>
            {t.invest.barReceive}
          </button>

          <button
            type="button"
            onClick={() => setModal("withdraw")}
            disabled={!address || !balances.solanaUnits}
            className={side}
            data-testid="withdraw-open"
          >
            <ArrowUpFromLine className="size-5" aria-hidden="true" />
            {t.invest.barWithdraw}
          </button>
        </div>
      </nav>

      <SolanaDepositModal open={modal === "deposit"} onClose={close} address={address} demo={session.demo} />
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
    </>
  );
}
