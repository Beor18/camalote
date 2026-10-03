#!/usr/bin/env node
/**
 * Prepara en Privy lo que necesita el agente de Camalote, por API (con el
 * secreto de la app, sin tocar el panel):
 *
 *   1. Una llave P-256 propia del agente (la privada queda solo en .env.local).
 *   2. Un "key quorum" 1 de 1 con esa llave: es el firmante que el usuario
 *      agrega a su billetera cuando activa el agente.
 *   3. La política que limita qué puede firmar ese firmante.
 *
 * Escribe en .env.local: PRIVY_AGENT_AUTH_KEY, NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID
 * y NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID. No imprime la llave privada.
 *
 *   node scripts/agent-setup.mjs            crea lo que falte
 *   node scripts/agent-setup.mjs --policy   vuelve a crear solo la política
 *
 * La política (cada instrucción de la transacción tiene que cumplir alguna regla):
 *   - Programas de presupuesto de cómputo y de cuentas de token asociadas.
 *   - Los programas por los que Jupiter Ultra arma nuestras compras (vistos en
 *     órdenes reales el 2026-10-03): Jupiter v6 (Metis), Jupiter Z (RFQ) y DFlow.
 *   - Cerrar una cuenta de token (Jupiter desenvuelve SOL así).
 *   - Transferir USDC solo a la cuenta de comisiones de Camalote, hasta 0,50.
 * Nada más: ni transferencias de SOL ni de otros tokens a otras cuentas.
 */
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PrivyClient } from "@privy-io/node";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FEE_MAX_UNITS = "500000";
const PROGRAMS = [
  "ComputeBudget111111111111111111111111111111",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH",
  "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH",
];

function readEnv() {
  const text = readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return { text, env };
}

function setEnv(key, value) {
  const { text } = readEnv();
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, "m").test(text)) {
    writeFileSync(ENV_PATH, text.replace(new RegExp(`^${key}=.*$`, "m"), line));
  } else {
    appendFileSync(ENV_PATH, `${text.endsWith("\n") ? "" : "\n"}${line}\n`);
  }
}

const { env } = readEnv();
const appId = env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = env.PRIVY_APP_SECRET;
const feeRecipient = env.NEXT_PUBLIC_FEE_RECIPIENT_SOLANA || "9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786";
if (!appId || !appSecret) {
  console.error("Faltan NEXT_PUBLIC_PRIVY_APP_ID y PRIVY_APP_SECRET en .env.local.");
  process.exit(1);
}
const privy = new PrivyClient({ appId, appSecret });
const onlyPolicy = process.argv.includes("--policy");

if (!onlyPolicy) {
  if (env.PRIVY_AGENT_AUTH_KEY && env.NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID) {
    console.log("La llave y el firmante del agente ya existen:", env.NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID);
  } else {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const priv = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const quorum = await privy.keyQuorums().create({
      public_keys: [pub],
      authorization_threshold: 1,
      display_name: "Camalote agent",
    });
    setEnv("PRIVY_AGENT_AUTH_KEY", priv);
    setEnv("NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID", quorum.id);
    console.log("Firmante del agente creado:", quorum.id);
  }
}

if (onlyPolicy || !readEnv().env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID) {
  const feeAta = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), new PublicKey(feeRecipient), true).toBase58();
  const policy = await privy.policies().create({
    version: "1.0",
    name: "Camalote agent: rule buys only",
    chain_type: "solana",
    rules: [
      {
        name: "Programas de las compras por Jupiter",
        method: "signTransaction",
        action: "ALLOW",
        conditions: [
          { field_source: "solana_program_instruction", field: "programId", operator: "in", value: PROGRAMS },
        ],
      },
      {
        name: "Cerrar cuentas de token (desenvolver SOL)",
        method: "signTransaction",
        action: "ALLOW",
        conditions: [
          { field_source: "solana_token_program_instruction", field: "instructionName", operator: "eq", value: "CloseAccount" },
        ],
      },
      {
        name: "Comision: USDC a la cuenta de Camalote, max 0,50",
        method: "signTransaction",
        action: "ALLOW",
        conditions: [
          { field_source: "solana_token_program_instruction", field: "instructionName", operator: "eq", value: "TransferChecked" },
          { field_source: "solana_token_program_instruction", field: "TransferChecked.destination", operator: "eq", value: feeAta },
          { field_source: "solana_token_program_instruction", field: "TransferChecked.mint", operator: "eq", value: USDC_MINT },
          { field_source: "solana_token_program_instruction", field: "TransferChecked.amount", operator: "lte", value: FEE_MAX_UNITS },
        ],
      },
    ],
  });
  setEnv("NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID", policy.id);
  console.log("Política del agente creada:", policy.id);
}

console.log("Listo. Las variables quedaron en .env.local (reiniciá el servidor para que las tome).");
