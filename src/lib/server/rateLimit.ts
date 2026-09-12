import "server-only";

/** Límite simple por IP en memoria (una instancia). Para producción, Redis. */
export function makeRateLimiter(maxPerWindow: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return function limited(ip: string): boolean {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(ip, { count: 1, windowStart: now });
      return false;
    }
    entry.count += 1;
    return entry.count > maxPerWindow;
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
