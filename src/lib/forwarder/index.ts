import { getCreate2Address, type Address, type Hex } from "viem";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ADDRESSES, FEE_BPS, NETWORK } from "@/lib/config";
import { computeQuote } from "@/lib/cctp/quote";
import { bytesToHex } from "@/lib/cctp/message";
import { FORWARDER_INIT_CODE_HASH } from "@/lib/forwarder/generated";

/**
 * Dirección de cobro no custodial en Base.
 *
 * Para cada cuenta de USDC en Solana existe una dirección en Base (CREATE2,
 * conocida antes de existir) donde cualquiera puede mandar USDC desde
 * Coinbase o cualquier billetera, sin registrarse. Un contrato garantiza que
 * esa plata solo puede salir hacia esa cuenta de Solana, por el camino
 * oficial de Circle. Nadie la puede desviar: ni el que paga, ni nosotros.
 *
 * Contrato: contracts/src/CamaloteForwarder.sol
 */

const DEFAULT_FACTORY: Record<"testnet" | "mainnet", "" | Address> = {
  testnet: "",
  mainnet: "",
};

/** Fábrica desplegada en la red actual. Vacío = función apagada. */
export const FORWARDER_FACTORY = (process.env.NEXT_PUBLIC_FORWARDER_FACTORY ??
  DEFAULT_FACTORY[NETWORK]) as "" | Address;

export const forwarderFactoryAbi = [
  {
    type: "function",
    name: "forward",
    stateMutability: "nonpayable",
    inputs: [{ name: "mintRecipient", type: "bytes32" }],
    outputs: [
      { name: "sent", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "forwarderFor",
    stateMutability: "view",
    inputs: [{ name: "mintRecipient", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isDeployed",
    stateMutability: "view",
    inputs: [{ name: "mintRecipient", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "feeFor",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "minAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "INIT_CODE_HASH",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

/** Token account de USDC del dueño en Solana, como bytes32 (mintRecipient de CCTP). */
export function mintRecipientFor(owner: string): Hex {
  const ata = getAssociatedTokenAddressSync(
    new PublicKey(ADDRESSES.solana.usdcMint),
    new PublicKey(owner),
    true
  );
  return bytesToHex(ata.toBytes());
}

/** Misma cuenta que hace CamaloteForwarderFactory.forwarderFor en la cadena. */
export function computeForwarderAddress(factory: Address, mintRecipient: Hex): Address {
  return getCreate2Address({
    from: factory,
    salt: mintRecipient,
    bytecodeHash: FORWARDER_INIT_CODE_HASH,
  });
}

/** Dirección de cobro en Base de una cuenta de Solana; null si la función está apagada. */
export function forwarderAddressFor(
  owner: string,
  factory: "" | Address = FORWARDER_FACTORY
): Address | null {
  if (!factory) return null;
  return computeForwarderAddress(factory, mintRecipientFor(owner));
}

/** Tarifa de envío exprés holgada, solo para estimar lo que llega (texto). */
const ESTIMATE_EXPRESS_BPS = 2;

/**
 * Estimación de lo que llega a Solana cuando sale `amountUnits` de la
 * dirección de cobro: el contrato descuenta la comisión y Circle el envío.
 */
export function estimateDeliveredUnits(amountUnits: bigint): bigint {
  try {
    return computeQuote(amountUnits, ESTIMATE_EXPRESS_BPS, {
      feeBps: FEE_BPS,
      feeEnabled: true,
    }).receiveUnits;
  } catch {
    return amountUnits;
  }
}
