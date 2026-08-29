#!/usr/bin/env node
/**
 * Crea (o muestra) la billetera relayer de Solana que paga el gas de la
 * entrega. En testnet además pide un airdrop de SOL en devnet.
 *
 * Uso: node scripts/setup-relayer.mjs [--mainnet]
 */
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mainnet = process.argv.includes("--mainnet");
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

const rpc = mainnet
  ? "https://api.mainnet-beta.solana.com"
  : "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const balance = await connection.getBalance(keypair.publicKey);
console.log(`\nSaldo en ${mainnet ? "mainnet" : "devnet"}: ${balance / LAMPORTS_PER_SOL} SOL`);

if (!mainnet && balance < 0.5 * LAMPORTS_PER_SOL) {
  console.log("Pidiendo airdrop de 1 SOL en devnet…");
  try {
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig, "confirmed");
    console.log("✓ Airdrop confirmado.");
  } catch {
    console.log(
      "El airdrop falló (los grifos de devnet tienen cupos). Probá en https://faucet.solana.com con la dirección de arriba."
    );
  }
}

if (mainnet && balance === 0) {
  console.log(
    "⚠ En mainnet tenés que fondear el relayer con SOL real (~0,05 SOL alcanza para cientos de entregas)."
  );
}
