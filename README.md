# camalote 🌿

**Invertí una parte de cada cobro.** Elegís un porcentaje y una acción.
Cada vez que te llegan USDC a tu cuenta de Solana, esa parte compra
acciones tokenizadas, sola. Desde 2 dólares, sin broker, con la comisión
a la vista.

- **Una regla, una sola vez**: «el 20 % de lo que me llega, al S&P 500».
  Cinco acciones para empezar: SPYx, QQQx, AAPLx, NVDAx y TSLAx (xStocks,
  de las 60+ que existen en Solana).
- **Se compra sola cuando te pagan**: la app mira tu cuenta y, cuando lo
  apartado junta 10 USDC, compra por **Jupiter Ultra**. La red la pagás vos
  desde una reserva de SOL que la app carga sola con 1 USDC la primera vez.
  Los cobros chicos se van juntando.
- **Cartera y comprobantes**: valor de hoy con precios de Jupiter,
  rendimiento sobre lo que pusiste, los dividendos que xStocks reinvirtió
  por vos (leídos del multiplicador del token en la cadena), cada operación
  con su link a Solscan.
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

Aparte, Jupiter cobra 0,10 % y la red la paga el usuario desde su reserva
de SOL: menos de un centavo por operación, más unos 0,0025 SOL la primera
vez que compra cada acción (abre la cuenta del token). La reserva se carga
sola: 1 USDC cambiado a SOL por Ultra, sin gas, la primera vez y cada vez
que baja de 0,004 SOL. Todo se muestra en el ticket.

**Cómo se cobra.** Después de que la compra salió bien, una transferencia
de USDC a la cuenta de comisiones (`NEXT_PUBLIC_FEE_RECIPIENT_SOLANA`) que
el usuario firma y paga desde su reserva: `/api/withdraw` con
`purpose: "fee"` arma la transferencia y, ya firmada, la valida y la
reenvía (el servidor no firma nada). Si falla, la pierde Camalote, no el
usuario, y la app lo dice en el comprobante. Si la cuenta de comisiones no
tiene abierta su cuenta de USDC, no se cobra: esa cuenta la abre Camalote,
no el usuario. La comisión no se apaga por configuración.

**Números honestos.** Un usuario que invierte 200 dólares por mes en
compras de 50 paga 0,90 por mes. Mil usuarios así son 900 dólares por mes.
El negocio es volumen. Las palancas siguientes (más activos, canastas, la
tarifa de referido de Jupiter) no están construidas.

## Cómo funciona por dentro

```
 Usuario (email → Privy → billetera de Solana)
   │
   ├─ le llegan USDC (cobro, depósito)  ──►  useAutoInvest mira la cuenta
   │                                          planInvestments: aparta el %
   │                                          junta hasta 10 USDC
   │                                                 │
   ▼                                                 ▼
 /api/invest/order side=fuel ── sin SOL en la cuenta: 1 USDC → SOL (Ultra, sin gas)
 /api/invest/order  ◄── quoteStock ── Jupiter Ultra arma la orden
 firma con la billetera embebida
 /api/invest/execute ── Jupiter ejecuta (la red sale de la reserva del usuario)
 /api/withdraw purpose=fee ── comisión a la cuenta de Camalote (el usuario paga la red)
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
- **Dividendos** (`src/lib/invest/multiplier.ts`): xStocks los reinvierte
  subiendo el multiplicador "scaled UI amount" del mint. El mismo endpoint
  de precios lo lee; la app muestra cantidades como cualquier billetera
  (cruda × multiplicador), guarda el multiplicador en cada operación y la
  cartera muestra "Dividendos reinvertidos" con la diferencia. En demo la
  compra se registra como anterior al último dividendo real, etiquetada.
- **Solo mainnet**: la app corre únicamente en la red principal de Solana,
  sin interruptor de red (xStocks no existen en devnet). En demo todo se
  simula con precios reales.
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
2. **Nada para la red**: no hay relayer. El usuario paga la red desde su
   reserva de SOL, que la app carga sola. (`pnpm relayer` y
   `RELAYER_SOLANA_SECRET` quedan solo para el módulo oculto de cobros.)
3. **Comisión**: `NEXT_PUBLIC_FEE_RECIPIENT_SOLANA=<tu cuenta>` (si falta,
   usa la cuenta por defecto de `src/lib/config.ts`). Siempre se cobra.
   Esa cuenta tiene que tener abierta su cuenta de USDC (recibir USDC una
   vez alcanza); mientras no la tenga, la compra sale igual y la comisión
   se marca como no cobrada.
4. **Jupiter** (opcional): `JUPITER_API_KEY` de portal.jup.ag para
   `api.jup.ag`; sin clave usa `lite-api.jup.ag`.
5. RPC dedicado (`SOLANA_RPC_URL`) en vez del público.

Prueba: entrá con tu email, mandá USDC a tu cuenta de Solana, armá la
regla o comprá a mano. Verificá el comprobante en Solscan y la
transferencia de la comisión a tu cuenta.

**Mínimos.** La compra a mano acepta desde 2 USDC (`NEXT_PUBLIC_BUY_MIN_UNITS`).
La reserva de red lleva 1 USDC más la primera vez (queda en la cuenta como
SOL). Con la reserva cargada, Jupiter cobra 0,10 % y la red menos de un
centavo, así que el costo ya no depende del monto; el ticket lo muestra
antes de confirmar. (Referencia: sin reserva, en modo sin gas, Jupiter
descontaba de la compra 7,65 % en 2 USDC y 1,61 % en 10, medido el
2026-09-12; por eso la reserva.) La regla junta hasta 10 USDC
(`NEXT_PUBLIC_INVEST_MIN_UNITS`).

**Prueba mínima, con 3 USDC.** Opcional, un RPC dedicado en vez del público:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

Con 3 USDC probás comprar a mano y vender (el mismo camino que usa la
regla): 1 va a la reserva de red y 2 a la compra. Para ver la regla hacen
falta 22 USDC al 50 %, o bajar `NEXT_PUBLIC_INVEST_MIN_UNITS`.

## Seguridad y límites conocidos

- Cada compra y venta la firma el usuario con su billetera embebida y paga
  la red desde su reserva de SOL. `/api/withdraw` arma y reenvía
  transferencias de USDC del firmante (retiros) o hacia la cuenta de
  comisiones (fee), validadas estructuralmente (`withdrawTx.ts`); el
  servidor no firma nada. No hay relayer en invertir.
- `/api/invest/order` solo arma órdenes entre USDC y el catálogo, más el
  cambio fijo de 1 USDC a SOL de la reserva: no es un proxy genérico. Rate
  limit simple por IP en memoria.
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
