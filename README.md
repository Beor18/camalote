# camalote 🌿

**Traé tus USDC de Base a Solana en segundos.** Login con email, gas
patrocinado, comisión mínima y todo a la vista. PWA instalable.

- **Sin fricción cripto**: el usuario entra con su email (Privy crea las
  billeteras embebidas de Base y Solana solas). Nunca ve seed phrases ni paga gas.
- **USDC nativos de punta a punta**: el viaje usa **CCTP v2 de Circle**
  (burn en Base → certificación de Circle → mint en Solana). Sin bridges de
  terceros ni tokens envueltos.
- **Gas $0 para el usuario**: en Base lo patrocina el **Paymaster de Coinbase**
  (vía smart wallets de Privy); en Solana lo paga nuestro **relayer**.
- **Transparencia**: la cotización muestra la comisión de Camalote (0,45 %,
  nunca más de $0,50 por cruce), la tarifa de envío rápido de Circle y
  "gas $0" antes de confirmar.

## Cómo funciona por dentro

```
 Usuario (email → Privy)
   │  1. UNA operación patrocinada (Coinbase Paymaster, ERC-4337):
   │     approve + transfer(comisión) + depositForBurn(fast)
   ▼
 Base ──── quema USDC ────► Circle (Iris) certifica en segundos
                                 │
                                 ▼  2. /api/relay (nuestro relayer paga el gas)
                           Solana: crea la token account si falta
                           y ejecuta receive_message → USDC acuñados
```

- **Depósito**: la app muestra la dirección de la smart wallet de Base del
  usuario (modal con QR y advertencias) para fondearla desde Coinbase o
  cualquier billetera.
- **Retiro en Solana**: el usuario puede mandar sus USDC a cualquier dirección
  de Solana sin tener SOL: firma con su billetera embebida y el relayer
  cofirma como fee payer (`/api/withdraw`). Antes de cofirmar, el servidor
  valida estructuralmente la transacción (solo "crear cuenta destino si
  falta + transferencia de USDC del firmante", ver
  `src/lib/solana/withdrawTx.ts`, con tests de los casos de abuso).
- El `mintRecipient` es la **token account de USDC del usuario** en Solana
  (se crea idempotente en la misma transacción del mint).
- `destinationCaller` va en cero: si nuestro relayer muriera, **cualquiera**
  puede completar la entrega. Los fondos nunca quedan atrapados.
- El relayer **verifica la certificación con Circle por su cuenta** (no confía
  en el cliente) y chequea que el mensaje sea USDC Base→Solana hacia la
  billetera declarada.
- Los PDAs de `receive_message` están validados por test de integración contra
  devnet (`pnpm test:integration`), con los IDLs oficiales de Circle vendoreados
  en `src/lib/cctp/idl/`.

## Comisión

Regla vigente: **0,45 % con tope de $0,50 por cruce** (piso 0,01; cruce mínimo
0,50 USDC; retiros gratis). Aparte, Circle cobra su envío exprés (~0,013 %).
Todo configurable por env: `NEXT_PUBLIC_FEE_BPS`, `NEXT_PUBLIC_FEE_MIN_UNITS`,
`NEXT_PUBLIC_FEE_MAX_UNITS`, `NEXT_PUBLIC_MIN_TRANSFER_UNITS`.

| Cruce | Comisión Camalote | % efectivo |
|---|---|---|
| $20 | $0,09 | 0,45 % |
| $100 | $0,45 | 0,45 % |
| $500 | $0,50 (tope) | 0,10 % |
| $1.000 | $0,50 (tope) | 0,05 % |
| $10.000 | $0,50 (tope) | 0,005 % |

Contra las alternativas (estimaciones ago 2026; deBridge cobra ~$0,50 fijo +
spread del solver, Binance $0,80 fijo hacia Solana):

| Monto | Camalote | deBridge | Binance | Coinbase | CCTP a mano |
|---|---|---|---|---|---|
| $50 | **$0,23** | ~$0,52 | $0,80 | $0 | ~$0,05 |
| $100 | **$0,45** | ~$0,55 | $0,80 | $0 | ~$0,05 |
| $500 | **$0,50** | ~$0,70 | $0,80 | $0 | ~$0,05 |
| $1.000 | **$0,50** | ~$0,86 | $0,80 | $0 | ~$0,05 |
| $10.000 | **$0,50** | ~$2-5 | $0,80 | $0 | ~$0,05 |

La letra chica de cada uno: deBridge exige billetera propia con gas en Base;
Binance y Coinbase solo mueven plata que ya está dentro del exchange (con
cuenta y KYC); CCTP a mano es para desarrolladores (dos billeteras, SOL para
el gas, ejecutar el mint uno mismo). Camalote: email y listo. El tope de $0,50
está elegido a propósito: es el piso del fijo de deBridge, así no existe monto
en el que nos ganen.

## Correr el proyecto

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

**Sin configurar nada corre en MODO DEMO**: misma UX, flujo completo simulado,
saldos persistentes, badge "Modo demo". Ideal para mostrar el producto sin
depender de faucets ni terceros.

```bash
pnpm test              # unit tests (cotización, mensajes CCTP, calldata)
pnpm test:integration  # verifica los PDAs contra Solana devnet (requiere red)
pnpm build             # build de producción
```

## Pasar a testnet real (Base Sepolia + Solana devnet)

1. **Privy** — [dashboard.privy.io](https://dashboard.privy.io)
   - Creá una app y copiá el App ID → `NEXT_PUBLIC_PRIVY_APP_ID`.
   - Login methods: Email (y Google si querés).
   - Embedded wallets: activá **Ethereum** y **Solana**, "create on login".
   - **Smart wallets**: activá (Coinbase Smart Wallet o Kernel) y pegá las URLs
     del paso 2. Elegí la red **Base Sepolia**.
2. **Coinbase Developer Platform** — [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
   - Creá un proyecto → "Paymaster & Bundler" → red **Base Sepolia**.
   - Copiá la **RPC URL** (sirve de bundler y paymaster) en la config de smart
     wallets de Privy. Activá la gas policy (los límites que quieras).
3. **Relayer de Solana**
   ```bash
   pnpm relayer        # genera la clave y pide airdrop en devnet
   ```
   Pegá la línea `RELAYER_SOLANA_SECRET=...` en `.env.local`.
4. **USDC de prueba**: [faucet.circle.com](https://faucet.circle.com) → red
   "Base Sepolia" → mandalos a la dirección "En Base" que muestra la app.
5. `cp .env.example .env.local`, completá los valores y reiniciá `pnpm dev`.

## Checklist para mainnet

Cuando todo dé OK en testnet:

- [ ] `NEXT_PUBLIC_NETWORK=mainnet` (cambia solo direcciones/APIs: Base
      mainnet, Solana mainnet, Iris de producción — ya están en
      `src/lib/cctp/constants.ts`, verificadas contra la docs de Circle).
- [ ] En Privy: agregá la red **Base** (mainnet) a smart wallets, con el
      Paymaster de CDP de **Base mainnet** y una gas policy con límites.
- [ ] Fondeá el relayer con SOL real (`pnpm relayer -- --mainnet` muestra el
      saldo; ~0,05 SOL alcanza para cientos de entregas).
- [ ] `NEXT_PUBLIC_FEE_RECIPIENT_BASE=0x…` (billetera que cobra la comisión;
      si queda vacía, la app cobra $0 y lo muestra). Ya configurada:
      `0x710550622Ed3eC820Eb63240E10492498C5848e2`. La ganancia final vive en
      Solana: cruzala con Camalote mismo hasta
      `9b66VaiZWtVnXVJ8ekXA99i8CaPuPp8CdPxV4kAHk786`.
- [ ] RPCs dedicados (Alchemy/Helius) en vez de los públicos.
- [ ] Deploy (Vercel: las API routes usan runtime Node; `maxDuration=60` en
      `/api/relay`).
- [ ] Probá una transferencia chica (0,50 USDC) de punta a punta.

## Seguridad y límites conocidos

- El relayer solo firma `receive_message` de mensajes **certificados por
  Circle** que sean USDC Base→Solana; no puede mover otros fondos.
- `/api/relay` tiene rate-limit simple por IP en memoria; para producción
  multi-instancia conviene un rate-limit compartido (Upstash/Redis).
- La comisión se cobra en Base *antes* del burn, en el mismo lote atómico
  patrocinado: si el burn falla, la comisión no se cobra.
- Si Circle demora (congestión), la UI lo explica y la entrega se completa
  igual: el mensaje certificado no expira para `receiveMessage` estándar.

## Stack

Next.js 16 (App Router) · Tailwind v4 · Privy (auth + embedded + smart
wallets) · viem · @solana/web3.js + Anchor (IDLs oficiales de Circle) ·
CCTP v2 (fast transfers) · PWA (manifest + service worker) · Vitest.
