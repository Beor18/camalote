"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnectWallet, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  useCreateWallet,
  useSignTransaction,
  useWallets as useSolanaWallets,
  type ConnectedStandardSolanaWallet,
} from "@privy-io/react-auth/solana";
import { createPublicClient, erc20Abi, http } from "viem";
import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ADDRESSES,
  BASE_RPC_URL,
  FEE_RECIPIENT_SOLANA,
  SOLANA_RPC_URL,
} from "@/lib/config";
import { base64ToBytes, bytesToBase64 } from "@/lib/base64";
import { bytesToHex } from "@/lib/cctp/message";
import { buildBridgeCalls } from "@/lib/cctp/evmCalls";
import { quoteFromJson, type Quote } from "@/lib/cctp/quote";
import { xStockByMint, type XStockSymbol } from "@/lib/invest/catalog";
import { startCloudSync } from "@/lib/invest/cloud-sync";
import { useRealAgent } from "@/components/bridge/use-agent";
import { FUEL_UNITS, buyLamportsNeeded, needsFuel, orderWithoutOpening } from "@/lib/invest/fuel";
import { fetchPrices } from "@/lib/invest/prices";
import { feeBpsFor, investFee } from "@/lib/invest/rules";
import type { Holding } from "@/lib/invest/types";
import { sendFromExternalWallet } from "@/lib/solana/externalSend";
import { syncSolanaHistory } from "@/lib/solana/historySync";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
  Engine,
} from "@/components/bridge/types";

const publicClient = createPublicClient({ transport: http(BASE_RPC_URL) });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** La billetera embebida de Privy (la cuenta de Camalote), no una externa como Phantom. */
function isPrivyWallet(wallet: ConnectedStandardSolanaWallet): boolean {
  return (wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet === true;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/** Espera de la certificación de Circle: rápida al principio, paciente después. */
const ATTESTATION_TIMEOUT_MS = 25 * 60 * 1000;

async function fetchQuote(query: string): Promise<Quote> {
  const res = await fetch(`/api/quote?${query}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de cotización");
  return quoteFromJson(data.quote);
}

/**
 * Motor real: Privy (email → billeteras embebidas + smart wallet en Base),
 * CCTP v2 de Circle y nuestro relayer en Solana. Sirve para cruces propios
 * y para pagar links de cobro (mismo camino, otro destinatario).
 */
export function useRealEngine(): Engine {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { initOAuth } = useLoginWithOAuth();
  const { client: smartWalletClient } = useSmartWallets();
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const { signTransaction } = useSignTransaction();
  const creatingSolanaWallet = useRef(false);

  const baseAddress = smartWalletClient?.account?.address ?? null;

  // La cuenta de Camalote es siempre la billetera de Privy: ahí firma el
  // agente. Una Phantom conectada solo sirve para entrar, cargar y retirar.
  const embeddedWallet = useMemo(() => solanaWallets.find(isPrivyWallet) ?? null, [solanaWallets]);
  const phantomWallet = useMemo(
    () => solanaWallets.find((wallet) => !isPrivyWallet(wallet)) ?? null,
    [solanaWallets]
  );

  const solanaAddress = useMemo(() => {
    if (embeddedWallet) return embeddedWallet.address;
    const linked = user?.linkedAccounts?.find(
      (account) =>
        account.type === "wallet" &&
        account.chainType === "solana" &&
        account.walletClientType === "privy"
    );
    return linked && "address" in linked ? (linked.address as string) : null;
  }, [embeddedWallet, user]);

  // Si la cuenta todavía no tiene billetera de Privy (por ejemplo, entró con
  // Phantom), la creamos una sola vez.
  useEffect(() => {
    if (
      authenticated &&
      solanaReady &&
      !solanaAddress &&
      !creatingSolanaWallet.current
    ) {
      creatingSolanaWallet.current = true;
      createWallet().catch(() => {
        creatingSolanaWallet.current = false;
      });
    }
  }, [authenticated, solanaReady, solanaAddress, createWallet]);

  // La regla y las operaciones se guardan también en la base (Supabase), así
  // sobreviven a otro dispositivo o a borrar el navegador.
  const getAccessTokenRef = useRef(getAccessToken);
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  });
  useEffect(() => {
    if (!authenticated || !solanaAddress) return;
    return startCloudSync(solanaAddress, () => getAccessTokenRef.current());
  }, [authenticated, solanaAddress]);

  const [baseUnits, setBaseUnits] = useState<bigint | null>(null);
  const [solanaUnits, setSolanaUnits] = useState<bigint | null>(null);
  const [solanaLamports, setSolanaLamports] = useState<bigint | null>(null);

  // Mientras los saldos son null, la UI muestra esqueletos; después los
  // refrescos actualizan los números en su lugar (sin parpadeo).
  const refresh = useCallback(async () => {
    if (!baseAddress && !solanaAddress) return;
    const [baseResult, solanaResult, lamportsResult] = await Promise.allSettled([
      baseAddress
        ? publicClient.readContract({
            address: ADDRESSES.base.usdc,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [baseAddress as `0x${string}`],
          })
        : Promise.resolve(null),
      solanaAddress ? fetchSolanaUsdcBalance(solanaAddress) : Promise.resolve(null),
      solanaAddress ? fetchSolLamports(solanaAddress) : Promise.resolve(null),
    ]);
    if (baseResult.status === "fulfilled" && baseResult.value !== null) {
      setBaseUnits(baseResult.value);
    }
    if (solanaResult.status === "fulfilled" && solanaResult.value !== null) {
      setSolanaUnits(solanaResult.value);
    }
    if (lamportsResult.status === "fulfilled" && lamportsResult.value !== null) {
      setSolanaLamports(lamportsResult.value);
    }
  }, [baseAddress, solanaAddress]);

  useEffect(() => {
    // refresh() solo hace setState después de await (nunca sincrónicamente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const session: BridgeSession = {
    ready,
    authenticated,
    accountLabel:
      user?.email?.address ??
      user?.google?.email ??
      (user?.wallet?.address ? `Phantom ${shortAddress(user.wallet.address)}` : null),
    baseAddress,
    solanaAddress,
    demo: false,
    login: () => login({ loginMethods: ["email", "google"] }),
    loginWithGoogle: () => initOAuth({ provider: "google" }),
    loginWithWallet: () => login({ loginMethods: ["wallet"], walletChainType: "solana-only" }),
    logout: () => logout(),
    externalWallet: phantomWallet
      ? { name: phantomWallet.standardWallet.name, address: phantomWallet.address }
      : null,
    connectExternal: () => connectWallet({ walletChainType: "solana-only", walletList: ["phantom"] }),
    disconnectExternal: async () => {
      await phantomWallet?.disconnect();
    },
  };

  const balances: BridgeBalances = {
    baseUnits,
    solanaUnits,
    solanaLamports,
    loading: false,
    refresh,
  };

  const actions: BridgeActions = useMemo(
    () => ({
      getQuote: (units: bigint) => fetchQuote(`units=${units.toString()}`),
      runBridge: async (quote, onUpdate, options) => {
        const recipientOwner = options?.recipientOwner ?? solanaAddress;
        if (!smartWalletClient || !recipientOwner) {
          throw new Error(
            "Tu cuenta todavía se está preparando. Esperá unos segundos y probá de nuevo."
          );
        }

        // La cuenta de destino es la token account de USDC del receptor en
        // Solana (la del propio usuario en un cruce; la del cobrador en un pago).
        const owner = new PublicKey(recipientOwner);
        const usdcMint = new PublicKey(ADDRESSES.solana.usdcMint);
        const ata = getAssociatedTokenAddressSync(usdcMint, owner, true);
        const mintRecipient = bytesToHex(ata.toBytes());

        onUpdate({ step: "sending" });
        const calls = buildBridgeCalls(quote, mintRecipient);
        const txHash = await smartWalletClient.sendTransaction(
          { calls },
          { uiOptions: { showWalletUIs: false } }
        );

        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 120_000,
        });
        onUpdate({ step: "attesting", baseTxHash: txHash });
        await waitForAttestation(txHash);
        onUpdate({ step: "minting", baseTxHash: txHash });
        const result = await relayWithRetries(txHash, recipientOwner);
        onUpdate({
          step: "done",
          baseTxHash: txHash,
          solanaSignature: result.signature,
        });
      },
      retryDelivery: async (baseTxHash, recipientOwner) => {
        const owner = recipientOwner ?? solanaAddress;
        if (!owner) {
          throw new Error(
            "Tu cuenta de Solana todavía se está preparando. Probá en unos segundos."
          );
        }
        const res = await fetch(`/api/attestation?txHash=${baseTxHash}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.status !== "complete") {
          throw new Error(
            "Circle todavía está certificando la transferencia. Probá en un rato."
          );
        }
        const result = await relayWithRetries(baseTxHash, owner);
        return result.signature ?? null;
      },
      withdrawSolana: async (destination, amountUnits, onStep) => {
        const wallet = embeddedWallet;
        const owner = requireAccount(solanaAddress);
        if (!wallet) throw new Error(ACCOUNT_PENDING);
        const sign = (transaction: Uint8Array) =>
          signTransaction({ transaction, wallet, chain: "solana:mainnet" }).then(
            (r) => r.signedTransaction
          );
        // Sin SOL no hay con qué pagar la red: primero la reserva.
        await ensureFuel(owner, sign, onStep);
        onStep?.("signing");
        const built = await buildTransfer(owner, destination, amountUnits, "withdraw");
        const signed = await sign(base64ToBytes(built.transactionBase64));
        onStep?.("sending");
        return submitTransfer(signed, built, "withdraw");
      },
      readExternalUsdc: async () =>
        phantomWallet ? fetchSolanaUsdcBalance(phantomWallet.address) : 0n,
      fundFromExternal: async (amountUnits, onStep) => {
        const owner = requireAccount(solanaAddress);
        if (!phantomWallet) throw new Error("Conectá tu Phantom para cargar.");
        // Misma transferencia que un retiro, al revés: de Phantom a la cuenta
        // de Camalote. La red la paga Phantom, que además la manda ella misma.
        const built = await buildTransfer(phantomWallet.address, owner, amountUnits, "withdraw");
        onStep?.("signing");
        return sendFromExternalWallet(
          phantomWallet,
          base64ToBytes(built.transactionBase64),
          built,
          new Connection(SOLANA_RPC_URL, "confirmed"),
          () => onStep?.("sending")
        );
      },
      listIncoming: async () => {
        if (!solanaAddress) return [];
        const records = await syncSolanaHistory(solanaAddress);
        return records
          .filter((r) => r.kind === "bridge" && r.solanaSignature)
          .map((r) => ({
            signature: r.solanaSignature as string,
            amountUnits: r.amountUnits,
            createdAt: r.createdAt,
          }));
      },
      readBaseBalance: (address) =>
        publicClient.readContract({
          address: ADDRESSES.base.usdc,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
      listHoldings: async () => {
        if (!solanaAddress) return [];
        return fetchXStockHoldings(solanaAddress);
      },
      quoteStock: async (asset, usdcUnits) => {
        const taker = requireAccount(solanaAddress);
        const camaloteFeeUnits = investFee(usdcUnits, { feeBps: feeBpsFor(asset) });
        const swapUnits = usdcUnits - camaloteFeeUnits;
        const [order, { multipliers }, network] = await Promise.all([
          fetchUltraOrder({ side: "buy", asset, units: swapUnits, taker }),
          fetchPrices(),
          fetchBuyNetwork(asset, taker),
        ]);
        // Si es la primera compra de esta inversión, la cuenta se abre antes
        // con la reserva: Jupiter ya no cobra esa apertura en el precio.
        const priced =
          network.openLamports > 0n
            ? orderWithoutOpening({
                outAmount: BigInt(order.outAmount),
                feeBps: order.feeBps,
                platformFeeBps: order.platformFeeBps ?? 0,
                rentFeeLamports: BigInt(order.rentFeeLamports ?? "0"),
                signatureFeeLamports: BigInt(order.signatureFeeLamports ?? "0"),
                prioritizationFeeLamports: BigInt(order.prioritizationFeeLamports ?? "0"),
              })
            : { outAmount: BigInt(order.outAmount), feeBps: order.feeBps };
        return {
          asset,
          usdcUnits,
          camaloteFeeUnits,
          swapUnits,
          expectedTokenUnits: priced.outAmount,
          jupiterFeeBps: priced.feeBps,
          gasless: order.gasless,
          multiplier: multipliers[asset] ?? 1,
          fuelUnits: network.fuelUnits,
          openLamports: network.openLamports,
          order: {
            transaction: order.transaction,
            requestId: order.requestId,
            expiresAt: order.expireAt ? Number(order.expireAt) * 1000 : null,
          },
        };
      },
      buyStock: async (quote, onStep) => {
        const wallet = embeddedWallet;
        const owner = requireAccount(solanaAddress);
        if (!wallet) throw new Error(ACCOUNT_PENDING);
        if (!quote.order) throw new Error("El precio venció. Pedilo de nuevo.");

        const sign = (transaction: Uint8Array) =>
          signTransaction({ transaction, wallet, chain: "solana:mainnet" }).then(
            (r) => r.signedTransaction
          );

        // Primero la red: la reserva si el SOL de la cuenta no alcanza, y la
        // cuenta de la inversión si es la primera compra. Después se vuelve a
        // pedir la orden, siempre: Jupiter vence la cotizada en menos de un
        // minuto, y si se abrió la cuenta, la cotizada cobraba esa apertura.
        let order = quote.order;
        let feeBps = quote.jupiterFeeBps;
        const fuelUnits =
          quote.fuelUnits > 0n
            ? await ensureFuel(owner, sign, onStep, buyLamportsNeeded(quote.openLamports))
            : 0n;
        const opened = quote.openLamports > 0n && (await openAccount(owner, quote.asset, sign, onStep));
        try {
          const fresh = await fetchUltraOrder({
            side: "buy",
            asset: quote.asset,
            units: quote.swapUnits,
            taker: owner,
          });
          order = { transaction: fresh.transaction, requestId: fresh.requestId, expiresAt: null };
          feeBps = fresh.feeBps;
        } catch (err) {
          // Con la cuenta ya abierta, la orden cotizada cobraría la apertura otra vez.
          if (quote.openLamports > 0n) {
            throw new Error("El precio cambió mientras abríamos tu cuenta. Pedilo de nuevo.");
          }
          // Si no, se prueba con la cotizada: si venció, Jupiter la rechaza sin mover nada.
          console.warn("[invest] no se pudo pedir la orden de nuevo", err);
        }
        const result = await signAndExecute(order, sign, onStep);

        // La comisión se cobra después de que la compra salió bien: si esto
        // falla, la pierde Camalote, no el usuario.
        let feeSignature: string | undefined;
        if (quote.camaloteFeeUnits > 0n) {
          onStep?.("fee");
          try {
            feeSignature = await collectFee(owner, quote.camaloteFeeUnits, sign);
          } catch (err) {
            console.warn("[invest] la comisión no se pudo cobrar", err);
          }
        }
        return {
          signature: result.signature,
          usdcUnits: quote.usdcUnits,
          tokenUnits: BigInt(result.outputAmountResult ?? quote.expectedTokenUnits.toString()),
          feeBps,
          camaloteFeeUnits: feeSignature ? quote.camaloteFeeUnits : 0n,
          feeSignature,
          multiplier: quote.multiplier,
          fuelUnits,
          openLamports: opened ? quote.openLamports : 0n,
        };
      },
      quoteSell: async (asset, tokenUnits) => {
        const taker = requireAccount(solanaAddress);
        const [order, { multipliers }] = await Promise.all([
          fetchUltraOrder({ side: "sell", asset, units: tokenUnits, taker }),
          fetchPrices(),
        ]);
        return {
          asset,
          tokenUnits,
          expectedUsdcUnits: BigInt(order.outAmount),
          jupiterFeeBps: order.feeBps,
          gasless: order.gasless,
          multiplier: multipliers[asset] ?? 1,
          order: {
            transaction: order.transaction,
            requestId: order.requestId,
            expiresAt: order.expireAt ? Number(order.expireAt) * 1000 : null,
          },
        };
      },
      sellStock: async (quote, onStep) => {
        const wallet = embeddedWallet;
        const owner = requireAccount(solanaAddress);
        if (!wallet) throw new Error(ACCOUNT_PENDING);
        if (!quote.order) throw new Error("El precio venció. Pedilo de nuevo.");
        const sign = (transaction: Uint8Array) =>
          signTransaction({ transaction, wallet, chain: "solana:mainnet" }).then(
            (r) => r.signedTransaction
          );
        // La cotizada es para mirar: Jupiter la vence en menos de un minuto.
        // Al confirmar se pide la orden de nuevo, por la misma cantidad.
        let order = quote.order;
        let feeBps = quote.jupiterFeeBps;
        try {
          const fresh = await fetchUltraOrder({
            side: "sell",
            asset: quote.asset,
            units: quote.tokenUnits,
            taker: owner,
          });
          order = { transaction: fresh.transaction, requestId: fresh.requestId, expiresAt: null };
          feeBps = fresh.feeBps;
        } catch (err) {
          console.warn("[invest] no se pudo pedir la venta de nuevo", err);
        }
        const result = await signAndExecute(order, sign, onStep);
        return {
          signature: result.signature,
          usdcUnits: BigInt(result.outputAmountResult ?? quote.expectedUsdcUnits.toString()),
          tokenUnits: quote.tokenUnits,
          feeBps,
          multiplier: quote.multiplier,
        };
      },
    }),
    [smartWalletClient, solanaAddress, embeddedWallet, phantomWallet, signTransaction]
  );

  const agent = useRealAgent(solanaAddress, authenticated, getAccessToken);

  return { session, balances, actions, agent };
}

async function fetchSolanaUsdcBalance(owner: string): Promise<bigint> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const ata = getAssociatedTokenAddressSync(
    new PublicKey(ADDRESSES.solana.usdcMint),
    new PublicKey(owner),
    true
  );
  try {
    const balance = await connection.getTokenAccountBalance(ata);
    return BigInt(balance.value.amount);
  } catch {
    // la token account todavía no existe: saldo cero
    return 0n;
  }
}

/** SOL de la cuenta: la reserva con la que el usuario paga la red. */
async function fetchSolLamports(owner: string): Promise<bigint> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  return BigInt(await connection.getBalance(new PublicKey(owner), "confirmed"));
}

const ACCOUNT_PENDING =
  "Tu cuenta de Solana todavía se está preparando. Probá en unos segundos.";

/** Devuelve la cuenta de Solana lista para operar. */
function requireAccount(solanaAddress: string | null): string {
  if (!solanaAddress) throw new Error(ACCOUNT_PENDING);
  return solanaAddress;
}

interface UltraOrderJson {
  transaction: string;
  requestId: string;
  outAmount: string;
  feeBps: number;
  gasless: boolean;
  expireAt: string | number | null;
  /** Sin gas: la parte de Jupiter dentro de feeBps y lo que adelanta (en lamports). */
  platformFeeBps?: number;
  signatureFeeLamports?: string;
  prioritizationFeeLamports?: string;
  rentFeeLamports?: string;
}

async function fetchUltraOrder(params: {
  side: "buy" | "sell" | "fuel";
  asset?: XStockSymbol;
  units: bigint;
  taker: string;
}): Promise<UltraOrderJson> {
  const query = new URLSearchParams({
    side: params.side,
    units: params.units.toString(),
    taker: params.taker,
  });
  if (params.asset) query.set("asset", params.asset);
  const res = await fetch(`/api/invest/order?${query}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.order?.transaction) {
    const fallback =
      params.side === "buy"
        ? "No pudimos cotizar la compra."
        : params.side === "sell"
          ? "No pudimos cotizar la venta."
          : "No pudimos preparar la reserva de red.";
    throw new Error(data.error ?? fallback);
  }
  return data.order as UltraOrderJson;
}

/**
 * Con qué se paga la red de una compra: el SOL de la cuenta o 1 USDC de
 * reserva, y cuánto SOL lleva abrir la cuenta de la inversión (0 si ya está).
 */
async function fetchBuyNetwork(
  asset: XStockSymbol,
  owner: string
): Promise<{ fuelUnits: bigint; openLamports: bigint }> {
  const res = await fetch(`/api/invest/account?${new URLSearchParams({ asset, owner })}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.fuelUnits !== "string" || typeof data.openLamports !== "string") {
    throw new Error(data.error ?? "No pudimos revisar tu cuenta.");
  }
  return { fuelUnits: BigInt(data.fuelUnits), openLamports: BigInt(data.openLamports) };
}

type Signer = (transaction: Uint8Array) => Promise<Uint8Array>;

/**
 * La reserva de red: si la cuenta tiene menos SOL del que pide la operación,
 * cambia 1 USDC por SOL con Jupiter (sin gas, que para eso no hay) y devuelve
 * lo que salió del saldo. Con SOL suficiente no hace nada.
 */
async function ensureFuel(
  owner: string,
  sign: Signer,
  onStep?: (step: "fuel") => void,
  neededLamports?: bigint
): Promise<bigint> {
  const lamports = await fetchSolLamports(owner);
  if (!needsFuel(lamports, neededLamports)) return 0n;
  onStep?.("fuel");
  const order = await fetchUltraOrder({ side: "fuel", units: FUEL_UNITS, taker: owner });
  await signAndExecute({ transaction: order.transaction, requestId: order.requestId }, sign);
  return FUEL_UNITS;
}

/**
 * Abre la cuenta de la inversión con la reserva de SOL, antes de la primera
 * compra. Devuelve false si ya estaba abierta (por ejemplo, de un intento
 * anterior que no terminó).
 */
async function openAccount(
  owner: string,
  asset: XStockSymbol,
  sign: Signer,
  onStep?: (step: "open") => void
): Promise<boolean> {
  onStep?.("open");
  const res = await fetch("/api/invest/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "build", owner, asset }),
  });
  const built = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(built.error ?? "No pudimos abrir tu cuenta.");
  if (built.open) return false;
  const signed = await sign(base64ToBytes(built.transactionBase64));
  const sent = await fetch("/api/invest/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit",
      transaction: bytesToBase64(signed),
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    }),
  });
  const result = await sent.json().catch(() => ({}));
  if (!sent.ok || !result.signature) throw new Error(result.error ?? "No pudimos abrir tu cuenta.");
  return true;
}

/** Firma la orden de Jupiter con la billetera embebida y la manda a ejecutar. */
async function signAndExecute(
  order: { transaction: string; requestId: string },
  sign: Signer,
  onStep?: (step: "signing" | "sending") => void
): Promise<{ signature: string; outputAmountResult: string | null }> {
  onStep?.("signing");
  const signed = await sign(base64ToBytes(order.transaction));
  onStep?.("sending");
  const res = await fetch("/api/invest/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction: bytesToBase64(signed),
      requestId: order.requestId,
    }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.signature) {
    throw new Error(result.error ?? "No pudimos completar la operación.");
  }
  return {
    signature: result.signature as string,
    outputAmountResult: (result.outputAmountResult as string | null) ?? null,
  };
}

type TransferPurpose = "withdraw" | "fee";

interface BuiltTransfer {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Una transferencia de USDC del usuario (retiro o comisión), con la red
 * pagada por él desde su reserva de SOL. El servidor la arma y, ya firmada,
 * la valida y la reenvía: nunca firma nada.
 */
async function buildTransfer(
  owner: string,
  destination: string,
  amountUnits: bigint,
  purpose: TransferPurpose
): Promise<BuiltTransfer> {
  const res = await fetch("/api/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "build",
      purpose,
      owner,
      destination,
      amountUnits: amountUnits.toString(),
    }),
  });
  const built = await res.json();
  if (!res.ok) {
    throw new Error(
      built.error ?? (purpose === "fee" ? "No pudimos preparar la comisión." : "No pudimos preparar el retiro.")
    );
  }
  return built as BuiltTransfer;
}

async function submitTransfer(
  signed: Uint8Array,
  built: BuiltTransfer,
  purpose: TransferPurpose
): Promise<string> {
  const res = await fetch("/api/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit",
      purpose,
      transaction: bytesToBase64(signed),
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    }),
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(
      result.error ?? (purpose === "fee" ? "No pudimos cobrar la comisión." : "No pudimos completar el retiro.")
    );
  }
  return result.signature as string;
}

/** Cobra la comisión de Camalote: USDC del usuario a la cuenta de comisiones. */
async function collectFee(owner: string, feeUnits: bigint, sign: Signer): Promise<string> {
  const built = await buildTransfer(owner, FEE_RECIPIENT_SOLANA, feeUnits, "fee");
  const signed = await sign(base64ToBytes(built.transactionBase64));
  return submitTransfer(signed, built, "fee");
}

/**
 * Lo del catálogo que hay en la cuenta del usuario: las acciones y pre-IPO
 * son Token-2022, los dólares que rinden (USDY) son del programa clásico.
 * Dos lecturas, filtradas por nuestro catálogo. Las unidades son las
 * "crudas" de cada token.
 */
async function fetchXStockHoldings(owner: string): Promise<Holding[]> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const ownerKey = new PublicKey(owner);
  const [token2022, tokenClassic] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(ownerKey, { programId: TOKEN_2022_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(ownerKey, { programId: TOKEN_PROGRAM_ID }),
  ]);
  const out: Holding[] = [];
  for (const { account } of [...token2022.value, ...tokenClassic.value]) {
    const info = (account.data as ParsedAccountData).parsed?.info as
      | { mint?: string; tokenAmount?: { amount?: string } }
      | undefined;
    const stock = xStockByMint(info?.mint);
    const amount = info?.tokenAmount?.amount;
    if (!stock || !amount || !/^\d+$/.test(amount)) continue;
    const tokenUnits = BigInt(amount);
    if (tokenUnits > 0n) out.push({ asset: stock.symbol, tokenUnits });
  }
  return out;
}

/** Circle certifica el mensaje (fast transfer ≈ segundos; esperamos con paciencia). */
async function waitForAttestation(txHash: string): Promise<void> {
  const deadline = Date.now() + ATTESTATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/attestation?txHash=${txHash}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "complete") return;
    }
    await wait(3000);
  }
  throw new Error(
    "Circle está tardando más de lo esperado en certificar la transferencia."
  );
}

async function relayWithRetries(
  txHash: string,
  solanaOwner: string
): Promise<{ signature?: string }> {
  let lastError = "No pudimos completar la entrega en Solana.";
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch("/api/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, solanaOwner }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.status === "complete" || data.status === "already_delivered")) {
      return { signature: data.signature };
    }
    if (res.status === 202) {
      await wait(3000);
      continue;
    }
    lastError = data.error ?? lastError;
    await wait(4000);
  }
  throw new Error(
    `${lastError} Tus USDC ya salieron de Base y no se pierden: reintentá en unos minutos.`
  );
}
