#!/usr/bin/env node
/**
 * Crea el webhook de Helius que despierta al agente cuando entra plata.
 *
 *   node scripts/helius-setup.mjs https://tu-dominio.vercel.app
 *
 * Necesita HELIUS_API_KEY en .env.local. Escribe HELIUS_WEBHOOK_ID y
 * HELIUS_WEBHOOK_SECRET en .env.local (copialos también a Vercel). Las cuentas
 * a vigilar se suman solas cuando cada usuario activa su agente.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const text = readFileSync(ENV_PATH, "utf8");
const env = Object.fromEntries(
  text.split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
function setEnv(key, value) {
  const current = readFileSync(ENV_PATH, "utf8");
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, "m").test(current)) writeFileSync(ENV_PATH, current.replace(new RegExp(`^${key}=.*$`, "m"), line));
  else appendFileSync(ENV_PATH, `${current.endsWith("\n") ? "" : "\n"}${line}\n`);
}

const base = process.argv[2];
if (!env.HELIUS_API_KEY || !base?.startsWith("https://")) {
  console.error("Uso: node scripts/helius-setup.mjs https://tu-dominio (y HELIUS_API_KEY en .env.local)");
  process.exit(1);
}
const secret = env.HELIUS_WEBHOOK_SECRET || randomBytes(24).toString("hex");
const res = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${env.HELIUS_API_KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    webhookURL: `${base.replace(/\/$/, "")}/api/agent/webhook`,
    transactionTypes: ["ANY"],
    accountAddresses: ["9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786"],
    webhookType: "enhanced",
    authHeader: secret,
  }),
});
const data = await res.json();
if (!res.ok) {
  console.error("Helius respondió", res.status, data);
  process.exit(1);
}
setEnv("HELIUS_WEBHOOK_ID", data.webhookID);
setEnv("HELIUS_WEBHOOK_SECRET", secret);
console.log("Webhook creado:", data.webhookID, "→", `${base}/api/agent/webhook`);
