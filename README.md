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

- **Links de cobro**: `/p?to=<cuenta>&a=<monto>&c=<concepto>&n=<nombre>`.
  El monto es opcional (el pagador elige). `src/lib/paylink.ts` codifica,
  valida y cruza los ingresos de la cuenta con los links pendientes.
- **Cotización inversa**: dado lo que tiene que llegar, calculamos lo que
  paga el pagador (`computeQuoteForReceive`). Comisión y envío exprés salen
  del pagador; el cobrador recibe el número que pidió.
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

## Dirección de cobro no custodial: pagar sin registrarse

Además del pago con email, cada cuenta de Solana tiene **una dirección de
cobro en Base**. El que paga manda USDC ahí desde Coinbase o cualquier
billetera, sin crear cuenta en ningún lado, y los USDC llegan solos a la
cuenta de Solana del cobrador.

```
 Pagador (Coinbase, cualquier billetera)      Contrato en Base (CREATE2)
   manda USDC a la dirección del link ─────►  CamaloteForwarder: solo puede
                                               hacer depositForBurn hacia UNA
                                               token account de Solana, fijada
                                               por la propia dirección
                                                  │  forward() lo dispara cualquiera
                                                  │  (nuestro sweeper paga el gas;
                                                  │   no puede cambiar el destino)
                                                  ▼
                                    Circle certifica ──► relayer entrega en Solana
```

- `contracts/src/CamaloteForwarder.sol`: la fábrica calcula la dirección de
  cada cuenta (`forwarderFor(mintRecipient)`) antes de que exista; `forward()`
  la despliega si hace falta y manda el saldo. La comisión (0,45 %, tope
  medio dólar) se descuenta en el contrato, con **techos grabados**: el dueño
  no puede subirla por encima de 1 % ni de 1 USDC, nunca.
- Los USDC no se pueden desviar: el destino está fijado por la dirección.
  Si alguien manda otro token por error, el dueño puede devolverlo
  (`rescueToken`); los USDC no, solo viajan a Solana.
- `src/lib/forwarder/`: la misma cuenta CREATE2 en TypeScript (test contra el
  vector de Foundry) y la estimación de lo que llega.
- `POST /api/sweep { owner }`: lee el saldo de la dirección y, si supera el
  mínimo, dispara `forward()` con `BASE_SWEEPER_PRIVATE_KEY` (centavos de gas).
  Después la entrega en Solana sigue el camino normal (certificación + relayer).
- La página de pago (`/p`) y el panel del cobrador miran la dirección cada
  pocos segundos: cualquiera de los dos completa la entrega. Si el pagador
  cierra la página, se entrega cuando el cobrador abre Camalote.
- Tests: `pnpm contracts:test` (12 unitarios con mocks) y, con
  `BASE_SEPOLIA_RPC_URL`, un test de fork contra el USDC y el TokenMessengerV2
  reales de Base Sepolia. Sin `NEXT_PUBLIC_FORWARDER_FACTORY` la función
  queda apagada y el link solo se paga con email.

## Comisión

Regla vigente: **0,45 % con tope de $0,50 por cobro o cruce** (piso 0,01;
mínimo 0,50 USDC; retiros gratis). La paga quien manda. Aparte, Circle cobra
su envío exprés (~0,013 %). Todo configurable por env: `NEXT_PUBLIC_FEE_BPS`,
`NEXT_PUBLIC_FEE_MIN_UNITS`, `NEXT_PUBLIC_FEE_MAX_UNITS`,
`NEXT_PUBLIC_MIN_TRANSFER_UNITS`.

| Cobro | Paga el pagador | Comisión | % efectivo |
|---|---|---|---|
| $20 | $20,09 | $0,09 | 0,45 % |
| $100 | $100,46 | $0,45 | 0,45 % |
| $500 | $500,57 | $0,50 (tope) | 0,10 % |
| $1.000 | $1.000,63 | $0,50 (tope) | 0,05 % |

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

### Dirección de cobro en testnet

1. `pnpm contracts:build` (necesita [Foundry](https://getfoundry.sh); clona
   `forge-std` en `contracts/lib` con `git clone --depth 1 https://github.com/foundry-rs/forge-std contracts/lib/forge-std`).
2. `DEPLOYER_PRIVATE_KEY=0x… pnpm contracts:deploy:testnet` con una cuenta con
   algo de ETH de Base Sepolia. Imprime la dirección de la fábrica.
3. En `.env.local`: `NEXT_PUBLIC_FORWARDER_FACTORY=<fábrica>` y
   `BASE_SWEEPER_PRIVATE_KEY=<cuenta con centavos de ETH>` (puede ser la misma).
4. Abrí un link de cobro, mandá USDC de prueba a la dirección que muestra y
   mirá cómo llegan a Solana sin tocar nada.

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
