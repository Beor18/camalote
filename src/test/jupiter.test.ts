import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isTransientOrderError } from "@/lib/server/jupiter";

describe("errores de Jupiter que se reintentan", () => {
  it("reintenta los que van y vienen con montos chicos", () => {
    expect(isTransientOrderError("Minimum $10 for gasless")).toBe(true);
    expect(isTransientOrderError("Failed to get quotes")).toBe(true);
    expect(isTransientOrderError("Jupiter respondió 503.")).toBe(true);
    expect(isTransientOrderError("Jupiter respondió 429.")).toBe(true);
  });

  it("no reintenta los que no cambian solos", () => {
    expect(isTransientOrderError("Insufficient funds")).toBe(false);
    expect(isTransientOrderError("Order not found, it might have expired")).toBe(false);
    expect(isTransientOrderError("Jupiter respondió 400.")).toBe(false);
  });
});
