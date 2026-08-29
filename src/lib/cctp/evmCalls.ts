import { encodeFunctionData, erc20Abi, type Hex } from "viem";
import { ADDRESSES, FEE_RECIPIENT_BASE } from "@/lib/config";
import { DOMAIN_SOLANA, FINALITY_FAST } from "@/lib/cctp/constants";
import type { Quote } from "@/lib/cctp/quote";

export const tokenMessengerV2Abi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

export interface EvmCall {
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
}

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/**
 * Arma el lote de llamadas que la smart wallet ejecuta en UNA operación
 * (gas patrocinado por el Paymaster de Coinbase, configurado en Privy):
 *
 *   1. approve(TokenMessengerV2, burnAmount)
 *   2. transfer(feeRecipient, camaloteFee)        — solo si hay comisión
 *   3. depositForBurn(...)                      — quema y despacha hacia Solana
 *
 * `mintRecipientBytes32` es la token account de USDC del usuario en Solana
 * (32 bytes, hex). `destinationCaller` va en cero: cualquiera puede completar
 * la entrega, así los fondos nunca dependen de nuestro relayer.
 */
export function buildBridgeCalls(
  quote: Quote,
  mintRecipientBytes32: `0x${string}`
): EvmCall[] {
  const { base } = ADDRESSES;
  const calls: EvmCall[] = [];

  calls.push({
    to: base.usdc,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [base.tokenMessengerV2, quote.burnAmountUnits],
    }),
  });

  if (quote.camaloteFeeUnits > 0n && FEE_RECIPIENT_BASE !== "") {
    calls.push({
      to: base.usdc,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [FEE_RECIPIENT_BASE, quote.camaloteFeeUnits],
      }),
    });
  }

  calls.push({
    to: base.tokenMessengerV2,
    data: encodeFunctionData({
      abi: tokenMessengerV2Abi,
      functionName: "depositForBurn",
      args: [
        quote.burnAmountUnits,
        DOMAIN_SOLANA,
        mintRecipientBytes32,
        base.usdc,
        ZERO_BYTES32,
        quote.circleFeeUnits,
        FINALITY_FAST,
      ],
    }),
  });

  return calls;
}
