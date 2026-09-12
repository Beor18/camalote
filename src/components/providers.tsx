"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { base, baseSepolia } from "viem/chains";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import { ADDRESSES, DEMO_MODE, PRIVY_APP_ID } from "@/lib/config";

/**
 * En modo demo (sin App ID de Privy) no montamos el proveedor: la app usa el
 * simulador local con exactamente la misma UX.
 *
 * El gas patrocinado no lleva código acá: se configura en el Dashboard de
 * Privy (Smart Wallets) pegando las URLs del Paymaster/Bundler de Coinbase
 * Developer Platform. Ver README.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (DEMO_MODE) return <>{children}</>;

  const chain = ADDRESSES.network === "mainnet" ? base : baseSepolia;

  // Privy necesita saber a qué RPC de Solana hablar cuando la billetera
  // embebida firma (retiros); sin esto tira "No RPC configuration found".
  const solanaChain =
    ADDRESSES.network === "mainnet"
      ? ("solana:mainnet" as const)
      : ("solana:devnet" as const);
  // El público de mainnet se satura rápido: con NEXT_PUBLIC_SOLANA_RPC_URL
  // (Helius gratis alcanza) Privy firma contra ese mismo RPC.
  const solanaHttp =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    (ADDRESSES.network === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "light",
          accentColor: "#7c3aed",
          logo: "/icons/icon-192.png",
        },
        embeddedWallets: {
          // La app muestra su propio desglose antes de cada firma; el modal
          // de confirmación de Privy encima es doble fricción.
          showWalletUIs: false,
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: chain,
        supportedChains: [chain],
        solana: {
          rpcs: {
            [solanaChain]: {
              rpc: createSolanaRpc(solanaHttp),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                solanaHttp.replace("https", "wss")
              ),
            },
          },
        },
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
