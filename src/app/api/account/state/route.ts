import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { MAX_OPERATIONS } from "@/lib/invest/merge";
import type { InvestRule, Purchase } from "@/lib/invest/types";
import {
  AuthError,
  assertOwner,
  readState,
  storeConfigured,
  userFromToken,
  writeState,
} from "@/lib/server/account-store";
import { clientIp, makeRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

const limited = makeRateLimiter(60);
/** Una regla con 200 firmas y 50 operaciones pesa unos 40 KB. */
const MAX_BODY_BYTES = 200_000;

function isAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function isRule(value: unknown): value is InvestRule {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<InvestRule>;
  return typeof r.percent === "number" && typeof r.asset === "string" && typeof r.enabled === "boolean";
}

function isPurchase(value: unknown): value is Purchase {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<Purchase>;
  return (
    typeof p.id === "string" &&
    p.id.length <= 80 &&
    typeof p.createdAt === "number" &&
    typeof p.asset === "string" &&
    typeof p.usdcUnits === "string" &&
    /^\d{1,20}$/.test(p.usdcUnits) &&
    typeof p.status === "string"
  );
}

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function fail(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[account/state]", error instanceof Error ? error.message : error);
  return NextResponse.json({ error: "No pudimos guardar en la base. Sigue en tu navegador." }, { status: 502 });
}

/** GET /api/account/state?address=… → { rule, purchases } de esa cuenta. */
export async function GET(req: NextRequest) {
  if (!storeConfigured()) return NextResponse.json({ error: "Sin base." }, { status: 503 });
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });
  const address = req.nextUrl.searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  try {
    const userId = await userFromToken(bearer(req));
    await assertOwner(userId, address);
    return NextResponse.json(await readState(address), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

/** PUT /api/account/state { address, rule, purchases } → estado final, ya juntado. */
export async function PUT(req: NextRequest) {
  if (!storeConfigured()) return NextResponse.json({ error: "Sin base." }, { status: 503 });
  if (limited(clientIp(req))) return NextResponse.json({ error: "Esperá un minuto." }, { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Demasiado grande." }, { status: 413 });
  let body: { address?: unknown; rule?: unknown; purchases?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const { address } = body;
  if (!isAddress(address)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  const rule = body.rule === null || body.rule === undefined ? null : body.rule;
  if (rule !== null && !isRule(rule)) return NextResponse.json({ error: "Regla inválida." }, { status: 400 });
  const purchases = Array.isArray(body.purchases) ? body.purchases : [];
  if (purchases.length > MAX_OPERATIONS || !purchases.every(isPurchase)) {
    return NextResponse.json({ error: "Operaciones inválidas." }, { status: 400 });
  }

  try {
    const userId = await userFromToken(bearer(req));
    await assertOwner(userId, address);
    return NextResponse.json(await writeState(address, { rule, purchases }));
  } catch (error) {
    return fail(error);
  }
}
