"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Clock,
  ExternalLink,
  Link2,
  MessageCircle,
  Plus,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { SolanaMark } from "@/components/chain-logos";
import { formatUsdc, parseUsdc, truncateAddress } from "@/lib/format";
import { MIN_TRANSFER_UNITS, solanaExplorerTx } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import {
  encodePayLink,
  loadPayLinks,
  matchIncomingPayments,
  newPayLinkId,
  replacePayLinks,
  savePayLink,
  type SavedPayLink,
} from "@/lib/paylink";
import type { Engine } from "@/components/bridge/types";

const POLL_MS = 10_000;

const inputClasses =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Cobrar: creás un link (monto, concepto, nombre), lo compartís, y esta
 * misma pantalla lo marca "Pagado" cuando el ingreso aparece en tu cuenta
 * de Solana. Sin base de datos: los links viven en el dispositivo y en la URL.
 */
export function CobrosPanel({ session, balances, actions }: Engine) {
  const { lang, t } = useLang();
  const [links, setLinks] = useState<SavedPayLink[]>([]);
  const [created, setCreated] = useState<SavedPayLink | null>(null);

  useEffect(() => {
    // Lectura inicial de localStorage: sincronización con un sistema externo.
    setLinks(loadPayLinks());
  }, []);

  // Las acciones y el refresco cambian de identidad en cada render; el
  // chequeo periódico solo depende de la cuenta.
  const actionsRef = useRef(actions);
  const refreshRef = useRef(balances.refresh);
  useEffect(() => {
    actionsRef.current = actions;
    refreshRef.current = balances.refresh;
  });
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current || !session.solanaAddress) return;
    const current = loadPayLinks();
    if (!current.some((l) => !l.paidAt)) return;
    checking.current = true;
    try {
      const incoming = await actionsRef.current.listIncoming();
      const next = matchIncomingPayments(current, incoming);
      const newlyPaid = next.some(
        (l) => l.paidAt && !current.find((c) => c.id === l.id)?.paidAt
      );
      if (newlyPaid) {
        replacePayLinks(next);
        setLinks(next);
        refreshRef.current();
      }
    } catch {
      // el RPC público puede limitar: probamos de nuevo en la próxima vuelta
    } finally {
      checking.current = false;
    }
  }, [session.solanaAddress]);

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), POLL_MS);
    // Otra pestaña del mismo navegador (el pagador, en la demo) también avisa.
    const onStorage = () => {
      setLinks(loadPayLinks());
      void check();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, [check]);

  const local = session.accountLabel?.split("@")[0] ?? "";
  const defaultName = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";

  const onCreate = (link: SavedPayLink) => {
    setLinks(savePayLink(link));
    setCreated(link);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <SolanaBalance session={session} balances={balances} />

      {created ? (
        <LinkReady link={created} onNew={() => setCreated(null)} />
      ) : (
        <>
          {links.length > 0 && <LinksList links={links} demo={session.demo} />}
          <CreateLinkForm
            solanaAddress={session.solanaAddress}
            defaultName={defaultName}
            onCreate={onCreate}
          />
        </>
      )}
      {created && <LinksList links={links} demo={session.demo} />}
    </div>
  );

  function SolanaBalance({
    session,
    balances,
  }: Pick<Engine, "session" | "balances">) {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SolanaMark className="size-3.5" />
            <span className="text-sm font-medium">{t.cobros.solanaBalance}</span>
          </div>
          {session.solanaAddress ? (
            <div className="mt-1 flex items-center gap-1">
              <span className="font-mono text-xs text-muted-foreground" title={session.solanaAddress}>
                {truncateAddress(session.solanaAddress)}
              </span>
              <CopyButton value={session.solanaAddress} label={t.app.copyAddress(t.app.solanaCard)} />
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t.app.addressPending}</p>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          {balances.solanaUnits === null ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {formatUsdc(balances.solanaUnits, 2, lang)}
              </span>
              <span className="text-sm text-muted-foreground">{t.common.usdc}</span>
            </>
          )}
        </div>
      </Card>
    );
  }
}

function CreateLinkForm({
  solanaAddress,
  defaultName,
  onCreate,
}: {
  solanaAddress: string | null;
  defaultName: string;
  onCreate: (link: SavedPayLink) => void;
}) {
  const { t } = useLang();
  const [amountText, setAmountText] = useState("");
  const [concept, setConcept] = useState("");
  const [name, setName] = useState("");

  const amountUnits = useMemo(
    () => (amountText.trim() === "" ? null : parseUsdc(amountText)),
    [amountText]
  );
  const amountError =
    amountText.trim() === ""
      ? null
      : amountUnits === null
        ? t.cobros.amountInvalid
        : amountUnits < MIN_TRANSFER_UNITS
          ? t.cobros.amountMin
          : null;

  const canSubmit = solanaAddress !== null && amountError === null;

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t.cobros.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.cobros.sub}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || !solanaAddress) return;
          const finalName = name.trim() || defaultName;
          const url = encodePayLink(
            { to: solanaAddress, amountUnits, concept: concept.trim(), name: finalName },
            window.location.origin
          );
          onCreate({
            id: newPayLinkId(),
            createdAt: Date.now(),
            to: solanaAddress,
            amountUnits: amountUnits?.toString() ?? null,
            concept: concept.trim(),
            name: finalName,
            url,
          });
          setAmountText("");
          setConcept("");
        }}
        className="mt-6 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cobro-amount" className="text-sm font-medium">
            {t.cobros.amountLabel}
          </label>
          <div className="relative">
            <input
              id="cobro-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.cobros.amountPlaceholder}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-invalid={amountError ? "true" : undefined}
              aria-describedby={amountError ? "cobro-amount-error" : "cobro-amount-hint"}
              className={`${inputClasses} h-14 pr-20 font-mono text-2xl tabular-nums`}
            />
            <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
              {t.common.usdc}
            </span>
          </div>
          {amountError ? (
            <p id="cobro-amount-error" className="text-xs text-destructive">
              {amountError}
            </p>
          ) : (
            <p id="cobro-amount-hint" className="text-xs text-muted-foreground">
              {t.cobros.amountHint}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cobro-concept" className="text-sm font-medium">
            {t.cobros.conceptLabel}
          </label>
          <input
            id="cobro-concept"
            type="text"
            maxLength={80}
            autoComplete="off"
            placeholder={t.cobros.conceptPlaceholder}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cobro-name" className="text-sm font-medium">
            {t.cobros.nameLabel}
          </label>
          <input
            id="cobro-name"
            type="text"
            maxLength={40}
            autoComplete="name"
            placeholder={defaultName || t.cobros.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClasses}
          />
          <p className="text-xs text-muted-foreground">{t.cobros.nameHint}</p>
        </div>

        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
          <Link2 className="size-4" aria-hidden="true" />
          {t.cobros.create}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t.cobros.exactNote}
        </p>
      </form>
    </Card>
  );
}

function LinkReady({ link, onNew }: { link: SavedPayLink; onNew: () => void }) {
  const { lang, t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // navigator existe solo en el cliente: decidimos después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, link.url, {
        width: 200,
        margin: 1,
        color: { dark: "#1c1917", light: "#ffffff" },
      }).catch(() => {
        // sin QR igual queda el link en texto
      });
    }
  }, [link.url]);

  const amount = link.amountUnits ? formatUsdc(BigInt(link.amountUnits), 2, lang) : null;
  const shareText = t.cobros.shareText(amount, link.concept, link.url);

  return (
    <Card className="p-6 sm:p-8 animate-pop">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-gradient">
          <Check className="size-7 text-white" strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold">{t.cobros.linkReady}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.cobros.linkReadySub}</p>

        <div className="mt-6 rounded-2xl bg-white p-3">
          <canvas ref={canvasRef} aria-label={t.cobros.qrAlt} />
        </div>

        <p className="mt-5 font-mono text-3xl font-semibold tabular-nums">
          {amount ?? (
            <span className="text-lg font-medium text-muted-foreground">
              {t.cobros.openAmount}
            </span>
          )}{" "}
          {amount && <span className="text-base font-normal text-muted-foreground">{t.common.usdc}</span>}
        </p>
        {link.concept && <p className="mt-1 text-muted-foreground">“{link.concept}”</p>}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 rounded-xl bg-muted p-3">
        <span className="truncate font-mono text-xs" title={link.url}>
          {link.url.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={link.url} label={t.cobros.copyLink} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-100 hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {t.cobros.shareWhatsapp}
        </a>
        {canShare ? (
          <Button
            variant="secondary"
            onClick={() => {
              navigator.share({ title: "Camalote", text: shareText, url: link.url }).catch(() => {
                // el usuario cerró el diálogo
              });
            }}
          >
            <Share2 className="size-4" aria-hidden="true" />
            {t.cobros.share}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onNew}>
            <Plus className="size-4" aria-hidden="true" />
            {t.cobros.newLink}
          </Button>
        )}
      </div>
      {canShare && (
        <button
          type="button"
          onClick={onNew}
          className="mt-3 w-full rounded-lg py-2 text-center text-sm text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          {t.cobros.newLink}
        </button>
      )}
    </Card>
  );
}

function LinksList({ links, demo }: { links: SavedPayLink[]; demo: boolean }) {
  const { lang, t } = useLang();
  const sorted = useMemo(
    () => [...links].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10),
    [links]
  );

  return (
    <section aria-label={t.cobros.listTitle}>
      <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
        {t.cobros.listTitle}
      </h2>
      <Card className="divide-y divide-border">
        {sorted.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{t.cobros.emptyList}</p>
        )}
        {sorted.map((item) => {
          const paid = Boolean(item.paidAt);
          return (
            <div key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    paid ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  }`}
                  aria-hidden="true"
                >
                  {paid ? (
                    <Check className="size-4" />
                  ) : (
                    <Clock className="size-4 animate-soft-pulse" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium tabular-nums">
                    {item.amountUnits
                      ? `${formatUsdc(BigInt(item.amountUnits), 2, lang)} ${t.common.usdc}`
                      : t.cobros.openAmount}
                    {item.concept ? (
                      <span className="font-sans font-normal text-muted-foreground"> · {item.concept}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString(lang === "es" ? "es" : "en", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {paid && item.paidAmountUnits && !item.amountUnits
                      ? ` · ${t.cobros.paidAmount(formatUsdc(BigInt(item.paidAmountUnits), 2, lang))}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {paid ? (
                  <Badge tone="success">{t.cobros.statusPaid}</Badge>
                ) : (
                  <Badge tone="neutral">{t.cobros.statusPending}</Badge>
                )}
                {paid && item.paidSignature && !demo ? (
                  <a
                    href={solanaExplorerTx(item.paidSignature)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t.cobros.viewPayment}
                    className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <CopyButton value={item.url} label={t.cobros.copyLink} />
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
