#!/usr/bin/env node
/**
 * Crea (o muestra) la billetera relayer de Solana que paga la red de los
 * retiros y del cobro de la comisión. Camalote corre solo en mainnet: el
 * relayer necesita SOL real (0,01 SOL alcanza para empezar).
 *
 * Uso: node scripts/setup-relayer.mjs
 */
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");

let secret = process.env.RELAYER_SOLANA_SECRET;
if (!secret && existsSync(envPath)) {
  const match = readFileSync(envPath, "utf8").match(
    /^RELAYER_SOLANA_SECRET=(.+)$/m
  );
  if (match) secret = match[1].trim();
}

let keypair;
if (secret) {
  keypair = secret.startsWith("[")
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
    : Keypair.fromSecretKey(bs58.decode(secret));
  console.log("Relayer existente:", keypair.publicKey.toBase58());
} else {
  keypair = Keypair.generate();
  console.log("Nuevo relayer generado.");
  console.log("\nAgregá esta línea a tu .env.local:\n");
  console.log(`RELAYER_SOLANA_SECRET=${bs58.encode(keypair.secretKey)}\n`);
  console.log("Dirección pública:", keypair.publicKey.toBase58());
}

const rpc =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpc, "confirmed");
const balance = await connection.getBalance(keypair.publicKey);
console.log(`\nSaldo en mainnet: ${balance / LAMPORTS_PER_SOL} SOL`);

if (balance === 0) {
  console.log(
    "⚠ Mandale SOL a esa dirección: sin saldo no se pueden pagar retiros ni cobrar la comisión (0,01 SOL alcanza para empezar)."
  );
}
