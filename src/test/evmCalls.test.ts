import { describe, expect, it } from "vitest";
import { decodeFunctionData, erc20Abi } from "viem";
import { buildBridgeCalls, tokenMessengerV2Abi } from "@/lib/cctp/evmCalls";
import { computeQuote } from "@/lib/cctp/quote";
import { ADDRESSES } from "@/lib/config";
import { DOMAIN_SOLANA, FINALITY_FAST } from "@/lib/cctp/constants";

const MINT_RECIPIENT =
  "0x0202020202020202020202020202020202020202020202020202020202020202" as const;

describe("buildBridgeCalls", () => {
  it("arma approve + depositForBurn consistentes con la cotización", () => {
    const quote = computeQuote(100_000_000n, 1, { feeEnabled: false });
    const calls = buildBridgeCalls(quote, MINT_RECIPIENT);

    // Sin billetera de comisiones configurada: no hay transfer de fee.
    expect(calls).toHaveLength(2);

    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    expect(calls[0].to).toBe(ADDRESSES.base.usdc);
    expect(approve.functionName).toBe("approve");
    expect(approve.args?.[0]).toBe(ADDRESSES.base.tokenMessengerV2);
    expect(approve.args?.[1]).toBe(quote.burnAmountUnits);

    const deposit = decodeFunctionData({
      abi: tokenMessengerV2Abi,
      data: calls[1].data,
    });
    expect(calls[1].to).toBe(ADDRESSES.base.tokenMessengerV2);
    expect(deposit.functionName).toBe("depositForBurn");
    const [amount, domain, mintRecipient, burnToken, caller, maxFee, finality] =
      deposit.args;
    expect(amount).toBe(quote.burnAmountUnits);
    expect(domain).toBe(DOMAIN_SOLANA);
    expect(mintRecipient).toBe(MINT_RECIPIENT);
    expect(burnToken.toLowerCase()).toBe(ADDRESSES.base.usdc.toLowerCase());
    expect(BigInt(caller)).toBe(0n);
    expect(maxFee).toBe(quote.circleFeeUnits);
    expect(finality).toBe(FINALITY_FAST);
  });
});
