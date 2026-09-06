import { describe, expect, it } from "vitest";
import { computeForwarderAddress, mintRecipientFor } from "@/lib/forwarder";
import { FORWARDER_INIT_CODE_HASH } from "@/lib/forwarder/generated";

/**
 * Vector impreso por contracts/test/CamaloteForwarder.t.sol (test_printVector):
 * la cuenta CREATE2 del front tiene que dar exactamente lo mismo que el contrato.
 */
describe("dirección de cobro (forwarder)", () => {
  it("usa el mismo código de creación que Foundry", () => {
    expect(FORWARDER_INIT_CODE_HASH).toBe(
      "0xdc3aabd4a0465cbf53368cd94e8834ab9bb26bb1fb0de1b5b1215bc0778d54ad"
    );
  });

  it("calcula la misma dirección que la fábrica en la cadena", () => {
    expect(
      computeForwarderAddress(
        "0xF62849F9A0B5Bf2913b396098F7c7019b51A820a",
        "0x5d85096bea42cff6d3cd7059572574cbab9624490c93e70acec4b8475c72891d"
      )
    ).toBe("0x35Fcca45170ed9D85616216Dfda7E1cb78d2e7a8");
  });

  it("el destino es la token account de USDC del cobrador (32 bytes)", () => {
    const recipient = mintRecipientFor("9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786");
    expect(recipient).toMatch(/^0x[0-9a-f]{64}$/);
    // distinta cuenta, distinta dirección de cobro
    const other = mintRecipientFor("DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy");
    expect(other).not.toBe(recipient);
    expect(
      computeForwarderAddress("0xF62849F9A0B5Bf2913b396098F7c7019b51A820a", recipient)
    ).not.toBe(
      computeForwarderAddress("0xF62849F9A0B5Bf2913b396098F7c7019b51A820a", other)
    );
  });
});
