import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Authorization: Bearer CRON_SECRET, comparado en tiempo constante. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
