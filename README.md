# camalote 🌿

**Invertí una parte de cada cobro.** Elegís un porcentaje y una acción.
Cada vez que te llegan USDC a tu cuenta de Solana, esa parte compra
acciones tokenizadas, sola. Desde 10 dólares, sin broker, con la comisión
a la vista.

- **Una regla, una sola vez**: «el 20 % de lo que me llega, al S&P 500».
  Cinco acciones para empezar: SPYx, QQQx, AAPLx, NVDAx y TSLAx (xStocks,
  de las 60+ que existen en Solana).
- **Se compra sola cuando te pagan**: la app mira tu cuenta y, cuando lo
  apartado junta 10 USDC, compra por **Jupiter Ultra** en modo sin gas. No
  necesitás SOL. Los cobros chicos se van juntando.
- **Cartera y comprobantes**: valor de hoy con precios de Jupiter,
  rendimiento sobre lo que pusiste, cada operación con su link a Solscan.
- **Comprar y vender a mano**: precio, comisión y costo de red a la vista
  antes de confirmar. Vender no tiene comisión de Camalote.
- **Tu cuenta es tuya**: entrás con tu email (Privy) y tenés una billetera
  embebida de Solana. Nosotros no podemos mover ni tus USDC ni tus acciones.
- **Sin humo**: son tokens de Backed que siguen el precio de la acción y
  tienen *permanent delegate*; no disponibles para residentes de EE. UU.,
  Reino Unido, Canadá y Australia; suben y bajan; la regla corre mientras
  la app está abierta. Todo eso lo dice la app.

## Modelo de negocio

**0,45 % por compra, nunca más de medio dólar, piso un centavo.** Se
descuenta de lo que se invierte y se muestra antes de confirmar. Vender es
gratis. No hay suscripción ni spread escondido.

| Compra | Comisión | % efectivo |
|---|---|---|
| $10 | $0,045 | 0,45 % |
| $50 | $0,225 | 0,45 % |
| $120 | $0,50 (tope) | 0,42 % |
| $500 | $0,50 (tope) | 0,10 % |

Aparte, Jupiter cobra su tarifa y, en modo sin gas, descuenta la red de la
compra: cerca de 2 % en compras de 10 USDC (incluye crear la cuenta del
token la primera vez), menos en montos más grandes. Se muestra en el ticket.

**Cómo se cobra.** Después de que la compra salió bien, una transferencia
de USDC a la cuenta de comisiones (`NEXT_PUBLIC_FEE_RECIPIENT_SOLANA`) con
la red pagada por nuestro relayer: `/api/withdraw` con `purpose: "fee"`,
que solo cofirma transferencias hacia esa cuenta y desde 0,01 USDC. Si
falla, la pierde Camalote, no el usuario. Sin cuenta configurada, la
comisión es 0 y así se muestra.

**Números honestos.** Un usuario que invierte 200 dólares por mes en
compras de 50 paga 0,90 por mes. Mil usuarios así son 900 dólares por mes.
El negocio es volumen. Las palancas siguientes (más activos, canastas, la
tarifa de referido de Jupiter fuera del modo sin gas) no están construidas.

## Cómo funciona por dentro

```
 Usuario (email → Privy → billetera de Solana)
   │
   ├─ le llegan USDC (cobro, depósito)  ──►  useAutoInvest mira la cuenta
   │                                          planInvestments: aparta el %
   │                                          junta hasta 10 USDC
   │                                                 │
   ▼                                                 ▼
 /api/invest/order  ◄── quoteStock ── Jupiter Ultra arma la orden (sin gas)
 firma con la billetera embebida
 /api/invest/execute ── Jupiter cofirma, paga la red y ejecuta
 /api/withdraw purpose=fee ── comisión a la cuenta de Camalote (relayer paga la red)
   │
   ▼
 xStocks (Token-2022) en la cuenta del usuario · cartera desde la cadena
```

- **Motor único** (`useEngine`): demo o real, misma interfaz
  (`BridgeActions`): `listIncoming`, `listHoldings`, `quoteStock`,
  `buyStock`, `quoteSell`, `sellStock`, `withdrawSolana`.
- **La regla** (`src/lib/invest/rules.ts`, puro y testeado):
  `planInvestments` cruza los ingresos de la cuenta con la regla. Solo
  cuentan los posteriores a prenderla, cada uno una sola vez, y lo que
  vuelve de una venta propia no cuenta.
- **La comisión** (`investFee`): FEE_BPS con piso y tope, descontada antes
  de ir al mercado.
- **Compra**: `quoteStock` pide la orden a Ultra por `usdc − comisión`;
  el usuario ve el ticket; `buyStock` firma, ejecuta y después cobra la
  comisión. **Venta**: lado `sell`, sin comisión.
- **Tenencias** desde la cadena: cuentas Token-2022 del usuario filtradas
  por el catálogo (`src/lib/invest/catalog.ts`, mints verificados contra
  la API de tokens de Jupiter). **Precios**: `/api/invest/prices` (cache
  30 s) usa `usdPricePrescaled` porque xStocks escalan la cantidad visible.
- **Solo mainnet**: xStocks no existen en devnet. En testnet real se arma
  la regla y la app lo explica; en demo todo se simula con precios reales.
- **Regla y operaciones** viven en el dispositivo por cuenta
  (`camalote.invest.rule.v1:<cuenta>`, `camalote.invest.purchases.v1:<cuenta>`).
  Una operación interrumpida (pestaña cerrada) se cierra al volver.

## Correr el proyecto

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

**Sin configurar nada corre en MODO DEMO**: misma UX, todo simulado con
precios reales de Jupiter, un botón para simular que te llegan USDC. Para
forzarlo aunque haya claves: `NEXT_PUBLIC_DEMO_MODE=true`.

```bash
pnpm test              # unit tests (regla, comisión, cartera, retiros, CCTP)
pnpm build             # build de producción
node scripts/e2e-demo.mjs <carpeta>   # recorre todo en demo con Playwright y saca capturas
node scripts/demo-video.mjs <carpeta> # graba el video de demo (requiere ffmpeg)
```

## Pasar a real

1. **Privy** ([dashboard.privy.io](https://dashboard.privy.io)): app con
   login por email y embedded wallets de **Solana** ("create on login").
   `NEXT_PUBLIC_PRIVY_APP_ID`.
2. **Relayer de Solana**: `pnpm relayer` genera la clave;
   `RELAYER_SOLANA_SECRET` en `.env.local`. Paga la red de retiros y de
   la comisión (~0,00001 SOL cada uno).
3. **Mainnet**: `NEXT_PUBLIC_NETWORK=mainnet` (las acciones tokenizadas
   existen solo ahí). Fondeá el relayer con algo de SOL.
4. **Comisión**: `NEXT_PUBLIC_FEE_RECIPIENT_SOLANA=<tu cuenta>`. Vacía =
   sin comisión, y la app lo muestra.
5. **Jupiter** (opcional): `JUPITER_API_KEY` de portal.jup.ag para
   `api.jup.ag`; sin clave usa `lite-api.jup.ag`.
6. RPC dedicado (`SOLANA_RPC_URL`) en vez del público.

Prueba: entrá con tu email, mandá 10 a 20 USDC a tu cuenta de Solana, armá
la regla o comprá a mano. Verificá el comprobante en Solscan y la
transferencia de la comisión a tu cuenta.

## Seguridad y límites conocidos

- Cada compra y venta la firma el usuario con su billetera embebida. Jupiter
  cofirma solo para pagar la red. Nuestro relayer cofirma únicamente
  transferencias de USDC del firmante (retiros) o hacia la cuenta de
  comisiones (fee), validadas estructuralmente (`withdrawTx.ts`).
- `/api/invest/order` solo arma órdenes entre USDC y el catálogo: no es un
  proxy genérico. Rate limit simple por IP en memoria.
- La regla corre en el navegador: si la app está cerrada, no compra. Es
  una limitación real y se dice en la app y en el FAQ.
- xStocks: *permanent delegate* de Backed (puede congelar o retirar),
  restricción por países, liquidez más fina en fin de semana, spread del
  RFQ en montos chicos (2 % en 10 USDC).
- El rendimiento se calcula sobre lo comprado y vendido desde Camalote;
  acciones compradas en otro lado aparecen en la cartera pero no en lo
  "puesto".

## Módulos ocultos: cobrar con links y cruce desde Base

Antes de este pivot (2026-09-12), Camalote era un link de cobro en USDC
(te pagaban desde Coinbase o Base y llegaba a Solana por CCTP v2). Ese
código sigue en el repo pero no se muestra: pestañas Cobrar y Llevar a
Solana, rutas `/app/cobrar` y `/p`, contratos de Circle, Paymaster de
Coinbase. Vuelve con `NEXT_PUBLIC_SHOW_HIDDEN_VIEWS=true`. La
documentación de esa versión está en el historial (commit `1421d41`).

## Stack

Next.js 16 (App Router) · Tailwind v4 · Privy (auth + embedded wallets) ·
@solana/web3.js + spl-token (Token-2022) · Jupiter Ultra y Price API
(xStocks) · PWA (manifest + service worker) · Vitest · Playwright para el
recorrido de demo.
