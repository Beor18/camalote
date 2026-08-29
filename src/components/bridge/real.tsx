"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  useCreateWallet,
  useSignTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { createPublicClient, erc20Abi, http } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ADDRESSES, BASE_RPC_URL, SOLANA_RPC_URL } from "@/lib/config";
import { base64ToBytes, bytesToBase64 } from "@/lib/base64";
import { bytesToHex } from "@/lib/cctp/message";
import { buildBridgeCalls } from "@/lib/cctp/evmCalls";
import { quoteFromJson, type Quote } from "@/lib/cctp/quote";
import { BridgeShell } from "@/components/bridge/shell";
import type {
  BridgeActions,
  BridgeBalances,
  BridgeSession,
} from "@/components/bridge/types";

const publicClient = createPublicClient({ transport: http(BASE_RPC_URL) });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera de la certificación de Circle: rápida al principio, paciente después. */
const ATTESTATION_TIMEOUT_MS = 25 * 60 * 1000;

export function RealBridgeApp() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();
  const { wallets: solanaWallets, ready: solanaReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const { signTransaction } = useSignTransaction();
  const creatingSolanaWallet = useRef(false);

  const baseAddress = smartWalletClient?.account?.address ?? null;

  const solanaAddress = useMemo(() => {
    const fromWallets = solanaWallets[0]?.address;
    if (fromWallets) return fromWallets;
    const linked = user?.linkedAccounts?.find(
      (account) =>
        account.type === "wallet" && account.chainType === "solana"
    );
    return linked && "address" in linked ? (linked.address as string) : null;
  }, [solanaWallets, user]);

  // Si la cuenta todavía no tiene billetera de Solana, la creamos una sola vez.
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

  const [baseUnits, setBaseUnits] = useState<bigint | null>(null);
  const [solanaUnits, setSolanaUnits] = useState<bigint | null>(null);

  // Mientras los saldos son null, la UI muestra esqueletos; después los
  // refrescos actualizan los números en su lugar (sin parpadeo).
  const refresh = useCallback(async () => {
    if (!baseAddress && !solanaAddress) return;
    const [baseResult, solanaResult] = await Promise.allSettled([
      baseAddress
        ? publicClient.readContract({
            address: ADDRESSES.base.usdc,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [baseAddress as `0x${string}`],
          })
        : Promise.resolve(null),
      solanaAddress ? fetchSolanaUsdcBalance(solanaAddress) : Promise.resolve(null),
    ]);
    if (baseResult.status === "fulfilled" && baseResult.value !== null) {
      setBaseUnits(baseResult.value);
    }
    if (solanaResult.status === "fulfilled" && solanaResult.value !== null) {
      setSolanaUnits(solanaResult.value);
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
    accountLabel: user?.email?.address ?? user?.google?.email ?? null,
    baseAddress,
    solanaAddress,
    demo: false,
    login: () => login(),
    logout: () => logout(),
  };

  const balances: BridgeBalances = {
    baseUnits,
    solanaUnits,
    loading: false,
    refresh,
  };

  const actions: BridgeActions = useMemo(
    () => ({
      getQuote: async (units: bigint): Promise<Quote> => {
        const res = await fetch(`/api/quote?units=${units.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error de cotización");
        return quoteFromJson(data.quote);
      },
      runBridge: async (quote, onUpdate) => {
        if (!smartWalletClient || !solanaAddress) {
          throw new Error(
            "Tu cuenta todavía se está preparando. Esperá unos segundos y probá de nuevo."
          );
        }

        // La cuenta de destino es tu token account de USDC en Solana.
        const owner = new PublicKey(solanaAddress);
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

        // Circle certifica el mensaje (fast transfer ≈ segundos).
        const deadline = Date.now() + ATTESTATION_TIMEOUT_MS;
        let attested = false;
        while (Date.now() < deadline) {
          const res = await fetch(`/api/attestation?txHash=${txHash}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "complete") {
              attested = true;
              break;
            }
          }
          await wait(3000);
        }
        if (!attested) {
          throw new Error(
            "Circle está tardando más de lo esperado en certificar la transferencia."
          );
        }

        onUpdate({ step: "minting", baseTxHash: txHash });
        const result = await relayWithRetries(txHash, solanaAddress);
        onUpdate({
          step: "done",
          baseTxHash: txHash,
          solanaSignature: result.signature,
        });
      },
      retryDelivery: async (baseTxHash) => {
        if (!solanaAddress) {
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
        const result = await relayWithRetries(baseTxHash, solanaAddress);
        return result.signature ?? null;
      },
      withdrawSolana: async (destination, amountUnits) => {
        const wallet = solanaWallets[0];
        if (!wallet || !solanaAddress) {
          throw new Error(
            "Tu cuenta de Solana todavía se está preparando. Probá en unos segundos."
          );
        }

        const buildRes = await fetch("/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "build",
            owner: solanaAddress,
            destination,
            amountUnits: amountUnits.toString(),
          }),
        });
        const built = await buildRes.json();
        if (!buildRes.ok) {
          throw new Error(built.error ?? "No pudimos preparar el retiro.");
        }

        const { signedTransaction } = await signTransaction({
          transaction: base64ToBytes(built.transactionBase64),
          wallet,
          chain:
            ADDRESSES.solana.cluster === "devnet"
              ? "solana:devnet"
              : "solana:mainnet",
        });

        const submitRes = await fetch("/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            transaction: bytesToBase64(signedTransaction),
            blockhash: built.blockhash,
            lastValidBlockHeight: built.lastValidBlockHeight,
          }),
        });
        const result = await submitRes.json();
        if (!submitRes.ok) {
          throw new Error(result.error ?? "No pudimos completar el retiro.");
        }
        return result.signature as string;
      },
    }),
    [smartWalletClient, solanaAddress, solanaWallets, signTransaction]
  );

  return <BridgeShell session={session} balances={balances} actions={actions} />;
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
