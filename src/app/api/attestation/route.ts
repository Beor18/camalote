import { NextRequest, NextResponse } from "next/server";
import { fetchAttestation } from "@/lib/server/circle";

export const runtime = "nodejs";

/**
 * GET /api/attestation?txHash=0x…
 * Proxy a la API de Circle: devuelve "pending" hasta que el mensaje esté
 * certificado, y luego el mensaje + la certificación.
 */
export async function GET(req: NextRequest) {
  const txHash = req.nextUrl.searchParams.get("txHash");
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "txHash inválido." }, { status: 400 });
  }
  try {
    const result = await fetchAttestation(txHash);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Circle no respondió. Reintentamos enseguida." },
      { status: 502 }
    );
  }
}
