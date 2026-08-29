/**
 * Direcciones oficiales de Circle CCTP v2, verificadas contra
 * https://developers.circle.com/cctp/evm-smart-contracts y
 * https://developers.circle.com/cctp/solana-programs (2026-08).
 *
 * CCTP v2 usa la misma dirección de programa en Solana para devnet y mainnet.
 */

export const DOMAIN_BASE = 6;
export const DOMAIN_SOLANA = 5;

/** Umbral de finalidad para "fast transfer" (~segundos) vs estándar. */
export const FINALITY_FAST = 1000;
export const FINALITY_STANDARD = 2000;

export const USDC_DECIMALS = 6;

export interface NetworkAddresses {
  /** "testnet" = Base Sepolia + Solana devnet */
  network: "testnet" | "mainnet";
  base: {
    chainId: number;
    usdc: `0x${string}`;
    tokenMessengerV2: `0x${string}`;
    messageTransmitterV2: `0x${string}`;
    rpcUrl: string;
    explorer: string;
  };
  solana: {
    cluster: "devnet" | "mainnet-beta";
    usdcMint: string;
    messageTransmitterV2: string;
    tokenMessengerMinterV2: string;
    rpcUrl: string;
  };
  circleIrisApi: string;
}

export const TESTNET: NetworkAddresses = {
  network: "testnet",
  base: {
    chainId: 84532, // Base Sepolia
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
  },
  solana: {
    cluster: "devnet",
    usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    messageTransmitterV2: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
    tokenMessengerMinterV2: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
    rpcUrl: "https://api.devnet.solana.com",
  },
  circleIrisApi: "https://iris-api-sandbox.circle.com",
};

export const MAINNET: NetworkAddresses = {
  network: "mainnet",
  base: {
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
  solana: {
    cluster: "mainnet-beta",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    messageTransmitterV2: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
    tokenMessengerMinterV2: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
    rpcUrl: "https://api.mainnet-beta.solana.com",
  },
  circleIrisApi: "https://iris-api.circle.com",
};
