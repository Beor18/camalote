import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BUY_MIN_UNITS, FEE_RECIPIENT_SOLANA, SOLANA_RPC_URL } from "@/lib/config";
import { findXStock, USDC_MAINNET_MINT, type XStock } from "@/lib/invest/catalog";
import { FUEL_UNITS, SOL_MINT, fitBuyToBalance } from "@/lib/invest/fuel";
import { buyBlockedBy, formatNextOpen, formatPremium } from "@/lib/invest/guards";
import { feeBpsFor, investFee, planInvestments } from "@/lib/invest/rules";
import type { InvestRule, Purchase } from "@/lib/invest/types";
import {
  boughtMessage,
  errorMessage,
  inBothLangs,
  type Lang,
  setAsideMessage,
  waitingBalanceMessage,
  waitingEligibilityMessage,
  waitingMarketMessage,
  waitingPremiumMessage,
} from "@/lib/invest/agent-messages";
import { isEligible } from "@/lib/invest/eligibility";
import { syncSolanaHistory } from "@/lib/solana/historySync";
import { readState, writeState } from "@/lib/server/account-store";
import { ultraExecute, ultraOrder } from "@/lib/server/jupiter";
import { getMarketData } from "@/lib/server/market";
import { buildOpenAccount, planBuyNetwork, submitOpenAccount, type BuyNetwork } from "@/lib/server/open-account";
import { buildWithdraw, submitWithdraw } from "@/lib/server/withdraw";
import { agentTurn } from "@/lib/server/agent/brain";
import { signAsUser } from "@/lib/server/agent/privy";
import { addEvent, getAgentAccount, listEvents, tryLock, unlock } from "@/lib/server/agent/store";
import { assertAllowedPrograms, decodeTx, simulateOrder } from "@/lib/server/agent/verify";

/**
 * El agente que ejecuta, del lado del servidor. Corre cuando Helius avisa
 * que entró plata, cuando pasa el reloj de respaldo, o cuando el usuario
 * aprieta "revisar ahora". Hace lo mismo que la regla en el navegador, pero
 * sin que la app esté abierta:
 *
 *   cobros nuevos → apartar el porcentaje → al juntar 10 USDC, decidir
 *   (la cabeza, o la regla sola) → reserva de red si el SOL no alcanza →
 *   abrir la cuenta de la inversión si es la primera compra → comprar por
 *   Jupiter → cobrar la comisión → anotar y avisar.
 *
 * Cada firma pasa por tres controles: la orden la pide este servidor (solo
 * nuestros pares, con el usuario como comprador), se revisa y se simula
 * antes de firmar, y Privy la firma solo si cumple la política del permiso.
 */

const HISTORY_LIMIT = 25;
const PAUSE_AFTER_ERROR_MS = 10 * 60 * 1000;
/** Si la cabeza eligió esperar, a las 6 horas compra igual: la regla manda. */
const MAX_AGENT_WAIT_MS = 6 * 60 * 60 * 1000;

export type RunOutcome =
  | "disabled"
  | "busy"
  | "no_rule"
  | "paused"
  | "nothing_new"
  | "not_eligible"
  | "set_aside"
  | "waiting"
  | "bought"
  | "error";

function rpcUrl(): string {
  const helius = process.env.HELIUS_API_KEY;
  if (helius && !process.env.SOLANA_RPC_URL) return `https://mainnet.helius-rpc.com/?api-key=${helius}`;
  return SOLANA_RPC_URL;
}

function newId(): string {
  return `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function saveRule(address: string, rule: InvestRule): Promise<void> {
  await writeState(address, { rule: { ...rule, updatedAt: Date.now() }, purchases: [] });
}

async function savePurchase(address: string, purchase: Purchase): Promise<void> {
  await writeState(address, { rule: null, purchases: [purchase] });
}

/** Pide la orden a Jupiter, la revisa, la simula, la firma con el permiso y la ejecuta. */
async function signAndRun(opts: {
  connection: Connection;
  walletId: string;
  owner: string;
  outputMint: string | null;
  amount: bigint;
}): Promise<{ signature: string; outputUnits: bigint; feeBps: number }> {
  const order = await ultraOrder({
    inputMint: USDC_MAINNET_MINT,
    outputMint: opts.outputMint ?? SOL_MINT,
    amount: opts.amount,
    taker: opts.owner,
  });
  if (!order.transaction) throw new Error("Jupiter no armó la operación.");
  try {
    assertAllowedPrograms(decodeTx(order.transaction));
    await simulateOrder({
      connection: opts.connection,
      transactionBase64: order.transaction,
      owner: opts.owner,
      inputMint: USDC_MAINNET_MINT,
      outputMint: opts.outputMint,
      maxInputUnits: opts.amount,
    });
  } catch (err) {
    // Queda en el log del servidor: una orden que no pasa la revisión no se firma.
    console.warn("[agent] orden rechazada, no se firma:", err instanceof Error ? err.message : err);
    throw err;
  }
  const signed = await signAsUser(opts.walletId, order.transaction);
  const result = await ultraExecute({ signedTransaction: signed, requestId: order.requestId });
  if (result.status !== "Success" || !result.signature) {
    throw new Error(result.error ?? "Jupiter no pudo completar la operación.");
  }
  return {
    signature: result.signature,
    outputUnits: BigInt(result.outputAmountResult ?? order.outAmount ?? "0"),
    feeBps: order.feeBps ?? 0,
  };
}

/** La comisión de Camalote, firmada con el permiso. Si falla, la pierde Camalote. */
async function collectFee(walletId: string, owner: string, feeUnits: bigint): Promise<string | undefined> {
  if (feeUnits <= 0n) return undefined;
  try {
    const built = await buildWithdraw(owner, FEE_RECIPIENT_SOLANA, feeUnits, "fee");
    const signed = await signAsUser(walletId, built.transactionBase64);
    const { signature } = await submitWithdraw(signed, built.blockhash, built.lastValidBlockHeight, "fee");
    return signature;
  } catch (err) {
    console.warn("[agent] la comisión no se pudo cobrar:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * Abre la cuenta de la inversión con la reserva de SOL del usuario, firmada
 * con el permiso (la política deja: presupuesto de cómputo y cuentas de token
 * asociadas). Devuelve false si ya estaba abierta.
 */
async function openAccount(connection: Connection, walletId: string, owner: string, stock: XStock): Promise<boolean> {
  const built = await buildOpenAccount(connection, owner, stock);
  if (!built) return false;
  const signed = await signAsUser(walletId, built.transactionBase64);
  await submitOpenAccount(connection, signed, built.blockhash, built.lastValidBlockHeight);
  return true;
}

/** Una compra de punta a punta. Devuelve el registro final; nunca lanza. */
async function buy(opts: {
  connection: Connection;
  walletId: string;
  address: string;
  rule: InvestRule;
  usdcUnits: bigint;
  network: BuyNetwork;
}): Promise<Purchase> {
  const { connection, walletId, address, rule, usdcUnits } = opts;
  const stock = findXStock(rule.asset);
  let record: Purchase = {
    id: newId(),
    createdAt: Date.now(),
    kind: "buy",
    asset: rule.asset,
    usdcUnits: usdcUnits.toString(),
    tokenUnits: "0",
    feeBps: 0,
    status: "buying",
    source: "rule",
    demo: false,
  };
  await savePurchase(address, record);
  try {
    if (!stock) throw new Error("Ese destino ya no está disponible.");
    let fuelUnits = 0n;
    if (opts.network.fuelUnits > 0n) {
      await signAndRun({ connection, walletId, owner: address, outputMint: null, amount: FUEL_UNITS });
      fuelUnits = FUEL_UNITS;
    }
    // La cuenta se abre con la reserva antes de pedir la orden: si no, Jupiter
    // la abre en modo sin gas y la cobra en el precio.
    const opened =
      opts.network.openLamports > 0n && (await openAccount(connection, walletId, address, stock));
    const camaloteFeeUnits = investFee(usdcUnits, { feeBps: feeBpsFor(rule.asset) });
    const swapUnits = usdcUnits - camaloteFeeUnits;
    const swap = await signAndRun({ connection, walletId, owner: address, outputMint: stock.mint, amount: swapUnits });
    const feeSignature = await collectFee(walletId, address, camaloteFeeUnits);
    const market = await getMarketData().catch(() => null);
    record = {
      ...record,
      status: "done",
      tokenUnits: swap.outputUnits.toString(),
      feeBps: swap.feeBps,
      camaloteFeeUnits: feeSignature ? camaloteFeeUnits.toString() : "0",
      signature: swap.signature,
      feeSignature,
      fuelUnits: fuelUnits > 0n ? fuelUnits.toString() : undefined,
      openLamports: opened ? opts.network.openLamports.toString() : undefined,
      multiplier: market?.multipliers[rule.asset] ?? 1,
    };
  } catch (err) {
    record = {
      ...record,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "No se pudo completar la compra.",
    };
  }
  await savePurchase(address, record);
  return record;
}

async function readBalances(connection: Connection, owner: string): Promise<{ usdc: bigint }> {
  const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MAINNET_MINT), new PublicKey(owner), true);
  const usdc = await connection
    .getTokenAccountBalance(ata, "confirmed")
    .then((b) => BigInt(b.value.amount))
    .catch(() => 0n);
  return { usdc };
}

/** Corre el agente para una cuenta. Seguro de llamar varias veces seguidas. */
export async function runAgent(address: string, trigger: "webhook" | "tick" | "manual"): Promise<RunOutcome> {
  const account = await getAgentAccount(address);
  if (!account?.enabled || !account.walletId) return "disabled";
  if (!(await tryLock(address))) return "busy";
  const lang = account.lang;
  // Las plantillas se guardan en los dos idiomas: la bitácora se lee en el de la app.
  const say = (write: (l: Lang) => string) => {
    const messages = inBothLangs(write);
    return { message: messages[lang], messages };
  };
  try {
    const state = await readState(address);
    const rule = state.rule;
    if (!rule?.enabled) return "no_rule";
    if (rule.pausedUntil !== undefined && rule.pausedUntil > Date.now()) return "paused";

    const connection = new Connection(rpcUrl(), "confirmed");
    // Lo que vuelve de una venta propia no es un cobro: no se reinvierte.
    const ownSales = new Set(
      state.purchases.filter((p) => p.kind === "sell" && p.signature).map((p) => p.signature as string)
    );
    const records = await syncSolanaHistory(address, { limit: HISTORY_LIMIT, rpcUrl: rpcUrl() });
    const incoming = records
      .filter((r) => r.kind === "bridge" && r.solanaSignature && !ownSales.has(r.solanaSignature))
      .map((r) => ({ signature: r.solanaSignature as string, amountUnits: r.amountUnits, createdAt: r.createdAt }));

    const plan = planInvestments(rule, incoming);
    const changed =
      plan.setAsideUnits > 0n || plan.rule.seenSignatures.length !== rule.seenSignatures.length;
    let current = plan.rule;
    if (changed) await saveRule(address, current);

    const goalName = current.goal?.name;
    if (plan.setAsideUnits > 0n && plan.buyUnits === null) {
      await addEvent(address, {
        kind: "set_aside",
        decidedBy: "rule",
        ...say((l) =>
          setAsideMessage(
            {
              receivedUnits: BigInt(current.lastIncoming?.amountUnits ?? "0"),
              setAsideUnits: plan.setAsideUnits,
              pendingUnits: BigInt(current.pendingUnits),
              goalName,
            },
            l
          )
        ),
        data: { setAsideUnits: plan.setAsideUnits.toString(), trigger },
      });
      return "set_aside";
    }
    if (plan.buyUnits === null) return "nothing_new";

    // Sin la confirmación de que puede invertir desde donde vive, lo apartado
    // espera entero y se avisa una vez (no una por vuelta).
    if (!isEligible(current)) {
      await saveRule(address, { ...current, pendingUnits: plan.buyUnits.toString() });
      const last = (await listEvents(address, 1))[0];
      if (last?.kind !== "waiting") {
        await addEvent(address, {
          kind: "waiting",
          decidedBy: "rule",
          ...say(waitingEligibilityMessage),
          data: { blocked: { reason: "eligibility" }, trigger },
        });
      }
      return "not_eligible";
    }

    // Lo apartado llegó al mínimo. Primero, lo que no depende de nadie:
    // horario de Wall Street, referencia de PreStocks y saldo.
    const stock = findXStock(current.asset);
    const market = await getMarketData().catch(() => null);
    const blocked = stock
      ? buyBlockedBy({
          kind: stock.kind,
          waitForMarketOpen: current.waitForMarketOpen ?? true,
          market: market?.market[current.asset],
          reference: market?.reference[current.asset],
        })
      : null;
    // Con qué se paga la red: el SOL de la cuenta, si alcanza, o 1 USDC de reserva.
    const [balances, network] = await Promise.all([
      readBalances(connection, address),
      stock
        ? planBuyNetwork(connection, address, stock)
        : Promise.resolve<BuyNetwork>({ lamports: 0n, fuelUnits: 0n, openLamports: 0n }),
    ]);
    const fit = fitBuyToBalance({
      buyUnits: plan.buyUnits,
      balanceUnits: balances.usdc,
      fuelUnits: network.fuelUnits,
      minUnits: BUY_MIN_UNITS,
    });

    if (blocked || fit.buyUnits === 0n) {
      const waitingRule: InvestRule = blocked
        ? { ...current, pendingUnits: plan.buyUnits.toString(), waiting: blocked }
        : { ...current, pendingUnits: fit.leftoverUnits.toString(), waiting: undefined };
      await saveRule(address, waitingRule);
      const text = say((l) =>
        blocked
          ? blocked.reason === "market"
            ? waitingMarketMessage({ asset: current.asset, nextOpen: formatNextOpen(blocked.nextOpen, l) }, l)
            : waitingPremiumMessage({ asset: current.asset, premium: formatPremium(blocked.premiumBps, l) }, l)
          : waitingBalanceMessage(l)
      );
      // Un aviso por espera, no uno por vuelta.
      const last = (await listEvents(address, 1))[0];
      if (last?.kind !== "waiting") {
        await addEvent(address, { kind: "waiting", decidedBy: "rule", ...text, data: { blocked, trigger } });
      }
      return "waiting";
    }

    // Se puede comprar. Decide la cabeza; si no responde, la regla.
    const recentEvents = await listEvents(address, 5);
    const agentWaitedLongAgo = recentEvents.some(
      (e) => e.kind === "waiting" && e.decidedBy === "agent" && Date.now() - e.createdAt > MAX_AGENT_WAIT_MS
    );
    const facts = {
      regla: {
        porcentaje: current.percent,
        destino: stock ? (lang === "es" ? (stock.nameEs ?? stock.name) : stock.name) : current.asset,
        meta: current.goal ? { nombre: current.goal.name, objetivo_usdc: Number(current.goal.targetUnits) / 1e6 } : null,
      },
      ultimo_cobro_usdc: current.lastIncoming ? Number(current.lastIncoming.amountUnits) / 1e6 : null,
      apartado_ahora_usdc: plan.setAsideUnits > 0n ? Number(plan.setAsideUnits) / 1e6 : 0,
      listo_para_comprar_usdc: Number(fit.buyUnits) / 1e6,
      saldo_usdc: Number(balances.usdc) / 1e6,
      ya_esperaste_antes: recentEvents.some((e) => e.kind === "waiting" && e.decidedBy === "agent"),
    };

    let purchase: Purchase | null = null;
    const doBuy = async () => {
      purchase = await buy({
        connection,
        walletId: account.walletId as string,
        address,
        rule: current,
        usdcUnits: fit.buyUnits,
        network,
      });
      return purchase;
    };

    let decidedBy: "agent" | "rule" = "rule";
    let agentMessage: string | null = null;
    let agentWaitReason: string | undefined;
    if (!agentWaitedLongAgo) {
      const turn = await agentTurn({ lang, facts, canBuy: true }, async (action, reason) => {
        if (action === "buy") {
          const p = await doBuy();
          return p.status === "done"
            ? {
                resultado: stock?.kind === "dollars" ? "puesto a rendir" : "comprado",
                usdc: Number(p.usdcUnits) / 1e6,
                destino: facts.regla.destino,
                meta: current.goal?.name ?? null,
              }
            : { resultado: "fallo", detalle: "la compra no se completó; lo apartado sigue guardado" };
        }
        agentWaitReason = reason;
        return { resultado: "esperando" };
      });
      if (turn.acted) decidedBy = "agent";
      agentMessage = turn.message;
      if (turn.action === "wait" && turn.acted) {
        await saveRule(address, { ...current, pendingUnits: plan.buyUnits.toString() });
        await addEvent(address, {
          kind: "waiting",
          decidedBy: "agent",
          ...(agentMessage ? { message: agentMessage } : say(waitingBalanceMessage)),
          data: { reason: agentWaitReason, trigger },
        });
        return "waiting";
      }
    }
    // Plan B: la cabeza no respondió o no actuó. La regla compra sola.
    if (!purchase) await doBuy();
    const done = purchase as Purchase | null;
    if (!done) return "error";

    if (done.status === "error") {
      await saveRule(address, {
        ...current,
        pendingUnits: plan.buyUnits.toString(),
        pausedUntil: Date.now() + PAUSE_AFTER_ERROR_MS,
        lastError: done.errorMessage,
        waiting: undefined,
      });
      await addEvent(address, {
        kind: "error",
        decidedBy,
        ...say(errorMessage),
        data: { error: done.errorMessage, trigger },
      });
      return "error";
    }

    current = { ...current, pendingUnits: fit.leftoverUnits.toString(), pausedUntil: undefined, lastError: undefined, waiting: undefined };
    await saveRule(address, current);
    await addEvent(address, {
      kind: "bought",
      decidedBy,
      ...(agentMessage
        ? { message: agentMessage }
        : say((l) =>
            boughtMessage(
              {
                usdcUnits: fit.buyUnits,
                asset: current.asset,
                goalName,
                marketOpen: market?.market[current.asset]?.open,
              },
              l
            )
          )),
      data: { signature: done.signature, usdcUnits: done.usdcUnits, asset: done.asset, trigger },
    });
    return "bought";
  } catch (err) {
    console.error("[agent]", address, err instanceof Error ? err.message : err);
    return "error";
  } finally {
    await unlock(address);
  }
}
