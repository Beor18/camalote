# camalote 🌿

**Cobrá en dólares desde cualquier lado.** Creás un link, lo mandás por
WhatsApp y te pagan desde Coinbase o Base con solo un email. Los USDC te
llegan a tu cuenta de Solana. Sin billeteras, sin gas, sin letra chica.
El número que pediste es el que llega.

- **Link de cobro sin registro**: entrás con tu email, ponés cuánto y por
  qué, y ya tenés un link y un QR para compartir. Sin base de datos: todo lo
  que hace falta para pagar viaja en la URL.
- **El que paga tampoco necesita saber nada**: entra con su email, ve tu
  pedido, carga USDC en Base si le faltan (desde Coinbase es gratis) y paga
  en una sola operación patrocinada.
- **USDC nativos de punta a punta**: el viaje usa **CCTP v2 de Circle**
  (burn en Base, certificación de Circle, mint en Solana). Sin bridges de
  terceros ni tokens envueltos.
- **Gas $0 para todos**: en Base lo patrocina el **Paymaster de Coinbase**
  (vía smart wallets de Privy); en Solana lo paga nuestro **relayer**, que
  además crea la cuenta de USDC del cobrador si no existe.
- **Transparencia**: el pagador ve la comisión (0,45 %, nunca más de $0,50),
  el envío rápido de Circle y "gas $0" antes de confirmar. El cobrador
  recibe exactamente lo que pidió.
- **Y también podés llevar tus propios USDC** de Base a Solana: es el
  mismo motor, pagándote a vos mismo.

Cada pantalla de "¡Pagado!" termina con "Creá tu propio link": cada persona
que paga es alguien que mañana cobra. Así crece Camalote sin presupuesto.

## Por qué esto y no un bridge

Investigamos con Colosseum Copilot 5.400 proyectos de hackathons de Solana
(ver `docs/hackathon/`): los bridges no ganan; ganan los productos de pago en
stablecoins para mercados emergentes, con un "para quién" claro. Argentina
mueve el 94 % de su volumen cripto en stablecoins. Ningún incumbente
(Phantom, Relay, deBridge, Mayan, Circle Bridge) atiende al usuario que solo
tiene un email. Camalote sí.

## Cómo funciona por dentro

```
 Cobrador (email → Privy)                    Pagador (email → Privy)
   crea /p?to=<su cuenta Solana>&a=40 ───────►  abre el link, ve el pedido
                                                 │  UNA operación patrocinada
                                                 │  (Coinbase Paymaster, ERC-4337):
                                                 │  approve + transfer(comisión)
                                                 │  + depositForBurn(fast, mintRecipient
                                                 │    = token account del cobrador)
                                                 ▼
                                    Base ── quema USDC ──► Circle (Iris) certifica
                                                                     │
                                                                     ▼  /api/relay
                                                               Solana: crea la token
                                                               account del cobrador si
   la app del cobrador lo marca "Pagado"  ◄────────────────── falta y ejecuta
   (lee los ingresos de su cuenta)                            receive_message → USDC
```

- **Links de cobro**: `/p?to=<cuenta>&a=<monto>&c=<concepto>&n=<nombre>&b=<cuenta de Base>`.
  El monto es opcional (el pagador elige). `src/lib/paylink.ts` codifica,
  valida y cruza los ingresos de la cuenta con los links pendientes.
- **La comisión sale de lo que llega**: el pagador manda el número del link
  tal cual, sin recargos. `computeQuote` desglosa comisión y envío exprés, y
  `minReceiveUnits` reconoce un cobro por lo que llega (nunca menos que eso).
- **Un solo motor** (`useEngine`): demo o real, alimenta la app y la página
  de pago. El pago real es el mismo `depositForBurn` del cruce, con el
  `mintRecipient` apuntando a la token account del cobrador.
- `destinationCaller` va en cero: si nuestro relayer muriera, **cualquiera**
  puede completar la entrega. Los fondos nunca quedan atrapados.
- El relayer **verifica la certificación con Circle por su cuenta** (no confía
  en el cliente) y chequea que el mensaje sea USDC Base→Solana hacia la cuenta
  declarada.
- **Retiro en Solana sin SOL**: firmás con tu billetera embebida y el relayer
  cofirma como fee payer, después de validar estructuralmente la transacción
  (`src/lib/solana/withdrawTx.ts`, con tests de los casos de abuso).
- Los PDAs de `receive_message` están validados por test de integración contra
  devnet (`pnpm test:integration`), con los IDLs oficiales de Circle vendoreados
  en `src/lib/cctp/idl/`.

## Pagar sin registrarse: la cuenta de Base del cobrador

Además del pago con email, el link lleva la **cuenta de Base del cobrador**
(la billetera embebida que Privy ya le da, parámetro `b`). El que paga manda
USDC ahí desde Coinbase o cualquier billetera, sin crear cuenta en ningún
lado. Cuando el cobrador abre Camalote, la app ve el saldo nuevo y lo lleva a
Solana sola, por el mismo cruce de siempre (una operación patrocinada, sin
tocar nada). Nada en el medio: es la billetera del cobrador desde el primer
segundo.

- `/p` muestra la cuenta con QR y monto, y avisa cuando el saldo subió por lo
  menos ese monto ("¡Pagado!").
- El panel de Cobrar recuerda el último saldo en Base que ya era del usuario
  (`camalote.cobros.baseSeen.v1:<cuenta>`). Lo que aparece de más se lleva a
  Solana automáticamente; la comisión se descuenta en ese viaje, como en
  cualquier cruce.
- El link se marca "Pagado" con el mismo cruce de ingresos que el pago con
  email: llega por lo menos `minReceiveUnits(monto)`.

## Comisión

Regla vigente: **0,45 % con tope de $0,50 por cobro o cruce** (piso 0,01;
mínimo 0,50 USDC; retiros gratis). Se descuenta de lo que llega: el que paga
manda el número del link tal cual, sin recargos. Aparte, Circle cobra su
envío exprés (~0,013 %). Todo configurable por env: `NEXT_PUBLIC_FEE_BPS`,
`NEXT_PUBLIC_FEE_MIN_UNITS`, `NEXT_PUBLIC_FEE_MAX_UNITS`,
`NEXT_PUBLIC_MIN_TRANSFER_UNITS`.

| Te pagan | Te llegan | Comisión | % efectivo |
|---|---|---|---|
| $20 | $19,91 | $0,09 | 0,45 % |
| $100 | $99,53 | $0,45 | 0,45 % |
| $500 | $499,44 | $0,50 (tope) | 0,10 % |
| $1.000 | $999,37 | $0,50 (tope) | 0,05 % |

Contra las alternativas para mover USDC a Solana (estimaciones 2026):
Phantom cobra 0,85 % (1,5 % sin gas) y exige seed phrase; deBridge 0,50 fijo
más spread del solver; los exchanges argentinos 0,8 a 1,5 % de spread. Todos
piden una billetera con gas. Camalote: email y listo.

## Correr el proyecto

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

**Sin configurar nada corre en MODO DEMO**: misma UX, flujo completo simulado,
saldos por cuenta persistentes, badge "Modo demo". Ideal para mostrar el
producto sin depender de faucets ni terceros. Para forzarlo aunque haya
claves: `NEXT_PUBLIC_DEMO_MODE=true`.

```bash
pnpm test              # unit tests (cotización, links de cobro, mensajes CCTP, calldata, retiros)
pnpm test:integration  # verifica los PDAs contra Solana devnet (requiere red)
pnpm build             # build de producción
node scripts/e2e-demo.mjs <carpeta>   # recorre el cobro completo en demo con Playwright y saca capturas
node scripts/demo-video.mjs <carpeta> # graba el video de demo (requiere ffmpeg)
```

## Pasar a testnet real (Base Sepolia + Solana devnet)

1. **Privy**: [dashboard.privy.io](https://dashboard.privy.io)
   - Creá una app y copiá el App ID → `NEXT_PUBLIC_PRIVY_APP_ID`.
   - Login methods: Email (y Google si querés).
   - Embedded wallets: activá **Ethereum** y **Solana**, "create on login".
   - **Smart wallets**: activá (Coinbase Smart Wallet o Kernel) y pegá las URLs
     del paso 2. Elegí la red **Base Sepolia**.
2. **Coinbase Developer Platform**: [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
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

Prueba de punta a punta con dos personas: A entra en `/app/cobrar` y crea un
link; B abre el link en otro dispositivo, entra con su email, carga USDC de
prueba y paga. La pantalla de A marca el cobro "Pagado" sola.

### Pagar sin registrarse, en testnet

Abrí un link de cobro sin entrar con email, mandá USDC de prueba (faucet de
Circle) a la cuenta de Base que muestra, y después abrí Camalote con la cuenta
del cobrador: la pestaña Cobrar los ve y los lleva a Solana sola.

## Checklist para mainnet

- [ ] `NEXT_PUBLIC_NETWORK=mainnet` (cambia solo direcciones/APIs: Base
      mainnet, Solana mainnet, Iris de producción, en
      `src/lib/cctp/constants.ts`, verificadas contra la docs de Circle).
- [ ] En Privy: agregá la red **Base** (mainnet) a smart wallets, con el
      Paymaster de CDP de **Base mainnet** y una gas policy con límites.
- [ ] Fondeá el relayer con SOL real (`pnpm relayer -- --mainnet` muestra el
      saldo; ~0,05 SOL alcanza para cientos de entregas).
- [ ] `NEXT_PUBLIC_FEE_RECIPIENT_BASE=0x…` (billetera que cobra la comisión;
      si queda vacía, la app cobra $0 y lo muestra).
- [ ] RPCs dedicados (Alchemy/Helius) en vez de los públicos.
- [ ] Deploy (Vercel: las API routes usan runtime Node; `maxDuration=60` en
      `/api/relay`).
- [ ] Probá un cobro chico (0,50 USDC) de punta a punta entre dos cuentas.

## Seguridad y límites conocidos

- El relayer solo firma `receive_message` de mensajes **certificados por
  Circle** que sean USDC Base→Solana; no puede mover otros fondos.
- `/api/relay` tiene rate-limit simple por IP en memoria; para producción
  multi-instancia conviene un rate-limit compartido (Upstash/Redis).
- La comisión se cobra en Base *antes* del burn, en el mismo lote atómico
  patrocinado: si el burn falla, la comisión no se cobra.
- Si Circle demora (congestión), la UI lo explica y la entrega se completa
  igual: el mensaje certificado no expira para `receiveMessage` estándar.
- Los links de cobro se marcan pagados por coincidencia de monto y fecha con
  los ingresos de la cuenta (no hay identificador on-chain del link). Dos
  links iguales creados al mismo tiempo se marcan en orden de creación.
- La primera entrega a una cuenta nueva paga el alquiler de la token account
  (~0,002 SOL); en cobros muy chicos ese costo supera la comisión.

## Stack

Next.js 16 (App Router) · Tailwind v4 · Privy (auth + embedded + smart
wallets) · viem · @solana/web3.js + Anchor (IDLs oficiales de Circle) ·
CCTP v2 (fast transfers) · PWA (manifest + service worker) · Vitest ·
Playwright para el recorrido de demo.
