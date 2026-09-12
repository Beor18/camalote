# Camalote Invest: diseño (2026-09-11)

Estado: implementado en un solo sprint ("dale en one shot") para Stocklana
(Solana Foundation, cierra 18 sep 2026) y Crypto World's Fair (Colosseum,
14 sep a 12 oct 2026).

## Por qué

- Stocklana pide apps de inversión que la gente use de verdad. Su categoría
  "Investing" nombra compras recurrentes y carteras automáticas.
- En los 5.400 proyectos de Colosseum no hay ninguno que invierta al
  recibir un pago. Los cercanos son planes por calendario (siphere, qist-1),
  emisores (shift-stocks) o préstamos contra xStocks (xvaultfi). El que ganó,
  myfye-1 (Breakout 2025), es "el Robinhood de mercados emergentes" con Privy.
- Jupiter ya tiene órdenes recurrentes por calendario. El freelancer no cobra
  por calendario: cobra cuando le pagan. Invertir por evento de ingreso
  ("pagate a vos primero") es el diferenciador, y Camalote ya sabe cuándo
  llega un cobro.
- Volumen de acciones tokenizadas en Solana: 4.900 millones en el primer
  semestre de 2026, más de 300.000 tenedores. Bitso lanzó xStocks en
  Argentina, pero custodial y sin retirar. Camalote: email, tu billetera, 24/7.

## Qué es

Pestaña **Invertir** en la app, con cuatro piezas:

1. **La regla**: interruptor, porcentaje (5, 10, 20, 30, 50) y acción
   (SPYx, QQQx, AAPLx, NVDAx, TSLAx). "De cada cobro, el 20 % va a SPYx.
   Cuando esa parte junta 10 USDC, se compra sola." Barra de "Juntando".
2. **La cartera**: valor de hoy, invertido, rendimiento; una fila por acción
   con cantidad, precio y valor. Precios de Jupiter, con referencia si falla.
3. **Comprar ahora**: monto (mínimo 10 USDC) y acción; mismo camino que la regla.
4. **Tus compras**: cada compra con origen (por regla o a mano), comprobante
   en Solscan y, en demo, la marca de simulación.

Más una tarjeta "Lo que tenés que saber" (Backed, permanent delegate,
países restringidos, sin consejo de inversión, sin comisión de Camalote).
En Cobrar, una línea "Regla activa: el 30 % de cada cobro va a SPYx" lleva
a Invertir. En la landing, una sección corta después de "Cobrar es así de
fácil" y una pregunta en el FAQ.

## Decisiones

- **Se invierte por evento de ingreso, no por calendario.** El motor
  (`useAutoInvest`, en el shell) mira los ingresos de la cuenta de Solana
  cada 20 s y cuando Cobrar avisa que llegó algo (`camalote:incoming`).
- **Acumulación**: si el porcentaje de un cobro no llega a 10 USDC, se
  guarda en `pendingUnits` y se compra todo junto cuando llega. Así los
  cobros chicos también invierten. 10 USDC es el piso del modo sin gas de
  Jupiter Ultra.
- **Sin gas para el usuario**: Ultra cofirma y paga la red, descontándola
  de la compra (`feeBps` en la orden). La billetera embebida de Solana
  firma con Privy, igual que el retiro.
- **Sin contratos propios ni custodia**: la orden la arma Jupiter, la firma
  el usuario, los tokens quedan en su cuenta.
- **Camalote no cobra por invertir.** El negocio sigue siendo la comisión
  del cobro. (Ultra admite referral fee; queda como palanca futura.)
- **Solo mainnet**: xStocks no existen en devnet. En real+devnet se puede
  armar la regla y se explica que las compras se activan en mainnet. En
  demo todo se simula con precios reales y 1 % de costo.
- **Solo cuentan los ingresos posteriores a prender la regla**, cada uno
  una sola vez (firmas vistas). Si una compra falla, lo apartado vuelve y
  se pausa 10 minutos (sin loops contra Jupiter).

## Componentes

- `src/lib/invest/catalog.ts`: las cinco xStocks (mints verificados contra
  la API de tokens de Jupiter), USDC mainnet, precios de referencia.
- `src/lib/invest/rules.ts`: `planInvestments`, `tokensForUsdc`,
  `valueOfTokens`, `portfolioSummary`, formato de cantidades. Puro, con tests.
- `src/lib/invest/storage.ts`: regla y compras por cuenta en localStorage;
  eventos `camalote:invest` y `camalote:incoming`.
- `src/lib/invest/execute.ts`: una compra de punta a punta con registro.
- `src/lib/invest/prices.ts`: precios vía `/api/invest/prices` con fallback.
- `src/lib/server/jupiter.ts`: Ultra order/execute y price v3 (clave
  opcional `JUPITER_API_KEY`). Los precios usan `usdPricePrescaled` porque
  xStocks escalan la cantidad visible con los dividendos.
- `src/app/api/invest/{order,execute,prices}/route.ts`.
- Motor (`BridgeActions`): `listHoldings()` y `buyStock(asset, units, onStep)`.
  Demo en `src/lib/demo.ts` (`runDemoBuy`, `loadDemoHoldings`); real en
  `real.tsx` (cuentas Token-2022 del usuario, Ultra + Privy).
- UI: `src/components/invest/{panel,rule-card,portfolio-card,buy-card,
  purchases-list,asset-picker}.tsx` y `use-auto-invest.ts`.
- Ruta `/app/invertir`; tercera pestaña en el shell.

## Flujo real de una compra

1. `GET /api/invest/order?asset=SPYx&units=…&taker=<cuenta>`: el servidor
   valida (solo USDC → catálogo, mínimo 10) y pide la orden a Ultra.
2. El cliente firma la transacción (bytes) con `useSignTransaction` de Privy.
3. `POST /api/invest/execute { signedTransaction, requestId }`: Jupiter
   cofirma (sin gas) y envía. Devuelve firma y unidades recibidas.
4. Se guarda la compra (USDC, unidades, `feeBps`, firma) y se refrescan
   tenencias y saldos.

## Errores

- Orden o ejecución fallida: la compra queda "No se completó" con el mensaje;
  los USDC no se movieron. La regla se pausa 10 minutos y conserva lo apartado.
- Precios sin respuesta: precios de referencia y aviso en la cartera.
- RPC limitado: las tenencias se reintentan en el próximo evento.

## Tests

- `src/test/invest.test.ts`: catálogo (mints válidos y únicos), plan
  (porcentaje, acumulación, ingresos previos, vistos, tope de la lista),
  cuentas (tokens por USDC, valor, resumen de cartera, formato).
- `scripts/e2e-demo.mjs` pasos 7 a 10: regla 30 % SPYx, cobro de 40 con
  email, compra automática visible en Cobrar e Invertir, compra a mano de
  NVDAx.

## Riesgos (para decir en el pitch)

- Permanent delegate de Backed: no es self-custody pleno. La app lo dice.
- Bybit restringe Argentina; Backed no. En Argentina, ofrecer acciones del
  exterior a minoristas roza a la CNV: se presenta como herramienta de
  autogestión, sin recomendar activos.
- Ultra: la doc de Jupiter menciona migración a Swap v2; lite-api Ultra
  responde hoy (probado 2026-09-11 con orden sin gas para un taker sin SOL).
- Liquidez de fin de semana y spread del RFQ en montos chicos (2 % en 10 USDC).
