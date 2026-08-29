"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { MIN_WITHDRAW_UNITS, solanaExplorerTx } from "@/lib/config";
import { useLang } from "@/lib/i18n";

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Retiro de USDC desde la cuenta Solana del usuario hacia cualquier
 * dirección (su Phantom, un amigo, un exchange). El costo de red lo
 * cubre Camalote.
 */
export function WithdrawModal({
  open,
  onClose,
  balanceUnits,
  ownAddress,
  demo,
  onWithdraw,
}: {
  open: boolean;
  onClose: () => void;
  balanceUnits: bigint | null;
  ownAddress: string | null;
  demo: boolean;
  onWithdraw: (destination: string, amountUnits: bigint) => Promise<string>;
}) {
  const { lang, t } = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState("");
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setDestination("");
    setAmountText("");
    setSignature(null);
    setError(null);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const amountUnits = useMemo(() => parseUsdc(amountText), [amountText]);

  const destinationError = useMemo(() => {
    const clean = destination.trim();
    if (clean === "") return null;
    if (!SOLANA_ADDRESS_RE.test(clean)) return t.withdrawModal.destInvalid;
    if (ownAddress && clean === ownAddress) return t.withdrawModal.destOwn;
    return null;
  }, [destination, ownAddress, t]);

  const amountError = useMemo(() => {
    if (amountText.trim() === "") return null;
    if (amountUnits === null) return t.withdrawModal.amountInvalid;
    if (amountUnits === 0n) return null;
    if (amountUnits < MIN_WITHDRAW_UNITS) return t.withdrawModal.amountMin;
    if (balanceUnits !== null && amountUnits > balanceUnits)
      return t.withdrawModal.amountInsufficient(
        formatUsdc(balanceUnits, 2, lang)
      );
    return null;
  }, [amountText, amountUnits, balanceUnits, t, lang]);

  const canSubmit =
    destination.trim() !== "" &&
    destinationError === null &&
    amountUnits !== null &&
    amountUnits >= MIN_WITHDRAW_UNITS &&
    amountError === null &&
    !submitting;

  const submit = async () => {
    if (!canSubmit || amountUnits === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const sig = await onWithdraw(destination.trim(), amountUnits);
      setSignature(sig);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t.withdrawModal.genericError
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby="withdraw-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground"
    >
      {signature ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center animate-pop">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient">
            <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
          </span>
          <div>
            <h2 id="withdraw-title" className="font-display text-xl font-semibold">
              {t.withdrawModal.doneTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {amountUnits !== null
                ? t.withdrawModal.doneBody(formatUsdc(amountUnits, 2, lang))
                : t.withdrawModal.doneBodyNoAmount}
            </p>
          </div>
          {demo ? (
            <p className="text-xs text-muted-foreground">
              {t.common.demoNote}
            </p>
          ) : (
            <a
              href={solanaExplorerTx(signature)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-1 text-sm text-primary underline-offset-4 transition-colors duration-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.withdrawModal.viewOnSolana}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <Button onClick={close} variant="secondary" className="mt-1">
            {t.withdrawModal.done}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5 p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="withdraw-title" className="font-display text-xl font-semibold">
                {t.withdrawModal.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.withdrawModal.sub}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="withdraw-destination" className="text-sm font-medium">
              {t.withdrawModal.destLabel}
            </label>
            <input
              id="withdraw-destination"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              aria-invalid={destinationError ? "true" : undefined}
              aria-describedby={destinationError ? "withdraw-destination-error" : undefined}
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
            {destinationError && (
              <p id="withdraw-destination-error" className="text-xs text-destructive">
                {destinationError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="withdraw-amount" className="text-sm font-medium">
              {t.withdrawModal.amountLabel}
            </label>
            <div className="relative">
              <input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder="10"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                aria-invalid={amountError ? "true" : undefined}
                aria-describedby={amountError ? "withdraw-amount-error" : "withdraw-amount-hint"}
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 pr-28 font-mono text-lg tabular-nums text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
              <div className="absolute inset-y-0 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (balanceUnits !== null)
                      setAmountText(
                        formatUsdc(balanceUnits, 2, lang).replace(
                          lang === "es" ? /\./g : /,/g,
                          ""
                        )
                      );
                  }}
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-primary transition-colors duration-100 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  {t.common.max}
                </button>
                <span className="text-sm font-medium text-muted-foreground">
                  {t.common.usdc}
                </span>
              </div>
            </div>
            {amountError ? (
              <p id="withdraw-amount-error" className="text-xs text-destructive">
                {amountError}
              </p>
            ) : (
              <p id="withdraw-amount-hint" className="text-xs text-muted-foreground">
                {t.withdrawModal.hint}
              </p>
            )}
          </div>

          <Button type="submit" loading={submitting} disabled={!canSubmit} className="w-full">
            {submitting ? t.withdrawModal.submitting : t.withdrawModal.submit}
          </Button>
        </form>
      )}
    </dialog>
  );
}
