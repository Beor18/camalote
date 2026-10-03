# camalote 🌿

**Invertí una parte de cada cobro.** Elegís un porcentaje y una acción.
Cada vez que te llegan USDC a tu cuenta de Solana, esa parte compra
acciones tokenizadas, sola. Desde 2 dólares, sin broker, con la comisión
a la vista.

- **Una regla, una sola vez**: «el 20 % de lo que me llega, al S&P 500».
  Cinco acciones para empezar: SPYx, QQQx, AAPLx, NVDAx y TSLAx (xStocks,
  de las 60+ que existen en Solana). Ocho empresas antes de salir a bolsa
  (PreStocks): SpaceX, OpenAI, Anthropic, Kalshi, Neuralink, Anduril,
  Figure AI y Polymarket, con su riesgo dicho en la app. Y para el que no
  quiere el sube y baja, **dólares que rinden**: USDY de Ondo, respaldados
  por letras del Tesoro de Estados Unidos (3,6 % anual al 2026-09-29, varía),
  con comisión de 0,10 %. El colchón de tres meses va ahí por defecto.
- **Se compra sola cuando te pagan**: la app mira tu cuenta y, cuando lo
  apartado junta 10 USDC, compra por **Jupiter Ultra**. La red la pagás vos
  desde una reserva de SOL que la app carga sola con 1 USDC la primera vez.
  Los cobros chicos se van juntando.
- **Una meta con nombre**: «la compu nueva, 1.500», «el viaje», «tres meses
  de colchón». La regla la va llenando sola cada vez que te pagan, y la app
  te dice cuánto falta en cobros («faltan unos 6 cobros como el último») o
  cuándo llegás a este ritmo. Al llegar, festejás y decidís: seguir, la
  próxima meta, o vender y retirar.
- **Cartera y comprobantes**: valor de hoy con precios de Jupiter,
  rendimiento sobre lo que pusiste, los dividendos que xStocks reinvirtió
  por vos (leídos del multiplicador del token en la cadena), cada operación
  con su link a Solscan.
- **Una sola cosa que hacer al entrar**: «Armar mi regla», tres preguntas
  (qué parte, para qué, en qué) de a una por pantalla, y la regla queda
  prendida. Después, la regla es el titular de la app: «El 30 % de cada
  cobro va a El viaje», con su interruptor («Prendida» / «En pausa») y
  «Editar». Dos columnas en pantallas anchas, una en el teléfono.
- **Comprar una vez y vender a mano**: fuera de la regla, con precio,
  comisión y costo de red a la vista antes de confirmar. Vender no tiene
  comisión de Camalote.
- **Tu cuenta es tuya**: entrás con tu email (Privy) y tenés una billetera
  embebida de Solana. Nadie más que vos puede retirar tus USDC o tus
  acciones; el agente, si lo activás, solo compra lo que dice tu regla.
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
- **La meta** (`src/lib/invest/goals.ts`, puro y testeado): lo comprado
  desde que arrancó la meta menos lo vendido, nunca más de lo que hay en la
  cuenta, a precio de hoy, más lo apartado. El ritmo sale de lo que la
  regla apartó desde entonces; los cobros que faltan, del último cobro.
- **La comisión** (`investFee`): FEE_BPS con piso y tope, descontada antes
  de ir al mercado. En dólares que rinden es `FEE_BPS_DOLLARS` (10, o sea
  0,10 %): sobre un 3,6 % anual, el 0,45 % se comía un mes y medio de
  rendimiento por compra.
- **Dólares que rinden** (USDY): token clásico (SPL) de 6 decimales, se
  compra y se vende por Jupiter como las acciones (0,14 % de costo total
  en una compra de 10, probado el 2026-09-29). Sin horario ni referencia:
  la regla nunca espera. Las tenencias se leen de los dos programas de
  tokens (Token-2022 para acciones y pre-IPO, clásico para USDY).
- **Compra**: `quoteStock` pide la orden a Ultra por `usdc − comisión`;
  el usuario ve el ticket; `buyStock` firma, ejecuta y después cobra la
  comisión. **Venta**: lado `sell`, sin comisión.
- **Tenencias** desde la cadena: cuentas Token-2022 del usuario filtradas
  por el catálogo (`src/lib/invest/catalog.ts`, mints verificados contra
  la API de tokens de Jupiter). **Precios**: `/api/invest/prices` (cache
  30 s). Jupiter cotiza por unidad visible; el precio por unidad cruda es
  ese × multiplicador (o `usdPricePrescaled` cuando Jupiter lo manda, que
  desde septiembre de 2026 no lo hace). SpaceX, por ejemplo, va ×5.
- **Empresas antes de salir a bolsa** (PreStocks, 9 decimales, 1 % de
  transferencia del emisor): mismo camino de compra y venta por Ultra. El
  mismo endpoint lee de `prestocks.com/api/prestocks` el valor de referencia
  de cada empresa y a cuánto cotiza el token; la app muestra la distancia
  ("el token está +14 %") y la regla no compra si está más de 5 % arriba
  (`src/lib/invest/guards.ts`, `MAX_PREMIUM_BPS`). Sin dividendos.
- **Horario de Wall Street** (Pyth): de los metadatos públicos del feed de
  cada acción (`hermes.pyth.network/v2/price_feeds`, `market_hours`), que
  no piden clave. La regla espera a la apertura si el usuario lo pide (por
  defecto sí), y comprar y vender avisan si el mercado está cerrado. El
  precio del feed necesita Pyth Pro, así que no se usa.
- **Dividendos** (`src/lib/invest/multiplier.ts`): xStocks los reinvierte
  subiendo el multiplicador "scaled UI amount" del mint. El mismo endpoint
  de precios lo lee; la app muestra cantidades como cualquier billetera
  (cruda × multiplicador), guarda el multiplicador en cada operación y la
  cartera muestra "Dividendos reinvertidos" con la diferencia. En demo la
  compra se registra como anterior al último dividendo real, etiquetada.
- **Solo mainnet**: la app corre únicamente en la red principal de Solana,
  sin interruptor de red (xStocks no existen en devnet). En demo todo se
  simula con precios reales.
- **Regla y operaciones** se guardan en Supabase por cuenta, con una copia
  rápida en el navegador (`camalote.invest.rule.v1:<cuenta>`,
  `camalote.invest.purchases.v1:<cuenta>`). Al entrar se trae lo de la
  base y se junta con lo local: gana la regla guardada último y los cobros
  ya contados se suman, para que ninguno se invierta dos veces. El
  navegador no le habla a Supabase: pasa por `/api/account/state`, que
  verifica el token de Privy y que la cuenta de Solana sea de ese usuario.
  Las tablas tienen RLS sin políticas (la clave pública no lee nada). En
  demo, o sin las variables de Supabase, todo queda en el navegador.
  Esquema en `supabase/migrations/`. Una operación interrumpida (pestaña
  cerrada) se cierra al volver.

## El agente: compra aunque la app esté cerrada

El usuario lo activa una vez (en el onboarding o desde su cuenta) y desde
ahí la regla se cumple en el servidor:

```
Te pagan → Helius avisa → /api/agent/webhook → runAgent()
  cobros nuevos → aparta el % → al juntar 10 USDC:
  la cabeza (Groq, Kimi K2) decide con una sola herramienta, "comprar según la regla"
  (no elige monto ni destino) → si no responde, decide la regla sola (plan B)
  → reserva de red si falta → orden de Jupiter → revisión + simulación
  → Privy firma con el permiso del usuario → comisión → bitácora
```

- **El permiso** es un firmante de sesión de Privy con política: solo los
  programas por los que Jupiter arma nuestras compras (Metis, Jupiter Z,
  DFlow; vistos en órdenes reales), cerrar cuentas de token, y USDC
  únicamente a la cuenta de comisiones, hasta 0,50. Privy revisa cada
  instrucción antes de firmar: aunque el servidor quisiera otra cosa, no
  la firma. Lo crea `node scripts/agent-setup.mjs` por API (llave P-256,
  key quorum y política) y deja las variables en `.env.local`.
- **Antes de firmar**, el servidor revisa los programas de la orden y la
  **simula**: tiene que sacar como mucho lo apartado y dejar lo comprado en
  la cuenta del usuario. La política no ve adentro de una ruta de Jupiter;
  la simulación sí.
- **La cabeza no toca la plata.** Si elige esperar, a las 6 horas compra
  igual. El horario de Wall Street, la referencia de PreStocks y el saldo
  los decide el código antes de preguntarle nada.
- **Un candado por cuenta** en la base (`agent_try_lock`) evita compras
  dobles si llegan dos avisos juntos. Con el agente activo, la regla del
  navegador no corre.
- **Bitácora** (`agent_events`): lo que hizo y le dijo al usuario, con quién
  decidió (IA o regla). La app la muestra en "Tu agente".
- **Avisos**: Helius (`node scripts/helius-setup.mjs https://tu-dominio`)
  y un reloj de respaldo, `GET /api/agent/tick` con
  `Authorization: Bearer $CRON_SECRET`, cada 5 minutos desde cualquier cron
  (Vercel Pro, Supabase pg_cron o cron-job.org). Atrapa lo que el aviso no
  trajo y las compras que esperaban la apertura.
- **En demo** todo se simula en el navegador con la misma pantalla.

Variables nuevas (servidor salvo las públicas): `PRIVY_AGENT_AUTH_KEY`,
`NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID`, `NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID`,
`GROQ_API_KEY` (opcional, sin ella decide la regla), `GROQ_MODEL`,
`HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`, `HELIUS_WEBHOOK_SECRET`, `CRON_SECRET`.
Esquema en `supabase/migrations/20261003000000_agent.sql`.

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
- Sin agente, la regla corre en el navegador: si la app está cerrada, no
  compra. Con el agente activo, el servidor firma con el permiso limitado
  de Privy (ver "El agente"). Lo apartado vive en la base.
- El agente firma desde el servidor: si alguien robara la llave del
  agente, lo máximo que puede firmar es lo que permite la política
  (compras por Jupiter y la comisión). La política no ve el destino dentro
  de una ruta de Jupiter: eso lo cubre la simulación en nuestro servidor.
  Es un límite real y está dicho.
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
