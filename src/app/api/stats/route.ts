import { NextResponse } from "next/server";
import { loadTraction } from "@/lib/server/traction";

export const dynamic = "force-dynamic";

/**
 * Números honestos, en vivo: cuentas, reglas armadas y prendidas, agentes
 * activos, compras de la regla con plata de verdad (sin demo) y USDC
 * invertidos, de la vista `traction` de la base. Las últimas compras van con
 * el link a su transacción para que cualquiera las verifique en la cadena.
 * La página /stats muestra lo mismo.
 */
export async function GET() {
  try {
    const body = await loadTraction();
    if (!body) return NextResponse.json({ error: "stats unavailable" }, { status: 503 });
    return NextResponse.json(body);
  } catch (err) {
    console.error("[stats]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "stats unavailable" }, { status: 503 });
  }
}
