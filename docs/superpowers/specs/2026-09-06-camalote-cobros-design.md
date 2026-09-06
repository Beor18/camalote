# Camalote Cobros: diseño del pivot (2026-09-06)

Estado: implementado en un solo sprint autónomo mientras Fernando dormía la siesta.
Revisalo y ajustá lo que no te cierre.

## Por qué pivotear

Deep dive con Colosseum Copilot (6 búsquedas en 4 hackathons, archivos, The Grid, web):

- Los bridges como proyecto de hackathon no ganan (ValueRouter, Solana Bridge Bot,
  Lunarys, Omnivault: cero premios). Ganan las billeteras y rieles de pago en
  stablecoins para mercados emergentes (LocalPay 3°, DOLLAR, Amp Pay, Bando).
- El cluster "Stablecoin Payment Rails" tiene 9,9 % de tasa de premio contra
  5,8 % del corpus. Sus tags: "high remittance fees", "slow cross-border
  payments", "complex crypto onboarding".
- Ningún incumbente (Phantom, Relay, deBridge, Mayan, Circle Bridge) atiende al
  usuario "solo email, sin SOL, sin ETH, sin seed phrase".
- El tope de 0,50 hace que el bridge solo no sea negocio: el valor está en el
  caso de uso y en la distribución.

## Qué es Camalote ahora

**Tu link para cobrar en dólares.** Creás un link con monto y concepto, lo
mandás por WhatsApp, y el que paga entra con su email, paga desde Coinbase o
Base, y los USDC te llegan a tu cuenta de Solana. Sin billeteras, sin gas,
sin letra chica. El número que pediste es el que llega.

El bridge existente ("Llevar a Solana") sigue: es el motor, y es el caso
"pagate a vos mismo".

Loop de crecimiento sin presupuesto: cada pantalla de "¡Pagado!" termina con
"Creá tu propio link de cobro". Cada pagador es un cobrador potencial.

## Alcance de este sprint

1. Comisión sobre lo que llega: el pagador manda el número del link tal cual,
   sin recargos. `computeQuote` desglosa comisión y envío exprés;
   `minReceiveUnits` reconoce el cobro por lo que llega.
2. Links de cobro sin base de datos: todo viaja en la URL
   (`/p?to=<solana>&a=<monto>&c=<concepto>&n=<nombre>&b=<base>`). El cobrador guarda sus
   links en el dispositivo y los marca "Pagado" cuando llega un ingreso que
   coincide (en red real: historial de la cuenta USDC; en demo: libro local).
3. Pestaña "Cobrar" en la app: formulario, link + QR + compartir, lista de links.
4. Página `/p`: el pagador ve el pedido, entra con email, ve su saldo en Base,
   carga si le falta (modal de depósito existente), paga en una operación
   patrocinada, ve el progreso y el comprobante, y recibe la invitación a crear
   su propio link.
5. Motor compartido: `useEngine()` (demo o real) alimenta tanto la app como `/p`.
   El pago real usa el mismo `depositForBurn` con `mintRecipient` = token
   account del cobrador; el relayer ya crea esa cuenta si no existe.
6. Demo con paridad: saldos por cuenta (email), libro de pagos local, mismos
   estados y tiempos.
7. Landing: hero y sección "Cobrar" nuevos; el resto se ajusta al pivot.
8. README, doc de submission para Colosseum, video de demo grabado con
   Playwright + ffmpeg, capturas.

Fuera de alcance: rampas fiat (regulatorio), base de datos, notificaciones push,
montos en otra moneda, hookData de CCTP para identificar pagos on-chain.

## Componentes

- `src/lib/cctp/quote.ts`: `computeQuote` (existente) y `minReceiveUnits(amountUnits)`.
- `src/lib/paylink.ts`: `encodePayLink`, `decodePayLink`, `savePayLink`,
  `loadPayLinks`, `markPaidFromIncoming`.
- `src/lib/demo.ts`: saldos por cuenta, `runDemoPayment`, libro `camalote.demo.ledger`.
- `src/components/engine.tsx`: `useEngine()` → `{ session, balances, actions }`.
  `actions.runBridge(quote, onUpdate, { recipientOwner })`.
- `src/components/bridge/real.tsx`, `demo.tsx`: exponen hooks, mantienen wrappers.
- `src/components/cobros/`: `create-link.tsx`, `links-list.tsx`.
- `src/components/pay/`: `pay-app.tsx`, `pay-panel.tsx`.
- `src/app/p/page.tsx`: página de pago (Suspense por `useSearchParams`).
- `src/lib/i18n.tsx`: textos es/en para cobros y pago.

## Flujo de datos del pago real

1. Pagador entra en `/p?to=…&a=…`. `decodePayLink` valida `to` como pubkey.
2. `computeQuote(a)`: `a` es lo que manda el pagador (sale de Base tal cual);
   `receiveUnits` es lo que llega al cobrador, ya con comisión y envío exprés
   descontados.
3. `runBridge(quote, onUpdate, { recipientOwner: to })`: `mintRecipient` =
   ATA(USDC, to). Lote patrocinado: approve + transfer(comisión) + depositForBurn.
4. Circle certifica. `/api/relay { txHash, solanaOwner: to }`: el relayer valida
   que `mintRecipient` del mensaje sea ATA(to), crea la cuenta si falta y acuña.
5. El cobrador, al abrir la app, sincroniza su historial desde la cadena: un
   ingreso ≥ `minReceiveUnits(monto)` y posterior a la creación marca el link
   como pagado.

## Errores

- Link inválido o incompleto: página explica y ofrece crear un link propio.
- Saldo insuficiente: botón "Cargar USDC en Base" y refresco automático.
- Fallo después del burn: mismo tratamiento que el bridge (entrega garantizada,
  reintento desde historial).

## Tests

- Unit: `minReceiveUnits` (piso de lo que llega), codificación de links,
  matching de pagos con la comisión descontada.
- Existentes: calldata, mensaje CCTP, validación de retiro, PDAs (devnet).
- Manual/Playwright: flujo demo completo grabado en video.

## Agregado (2026-09-06, tarde): pagar sin registrarse

**Por qué.** El pago con email exige que el pagador se registre. Un cliente
con Coinbase ya puede mandar USDC a cualquier dirección; el diferenciador es
que pueda pagar **sin registrarse en nada** y que la plata igual termine en la
cuenta de Solana del cobrador sin que este toque nada.

**Decisiones de Fernando.** Nada de contratos en el medio (una primera versión
con un forwarder CREATE2 se descartó: "al pedo"). Y nada de recargos al que
paga: la comisión sale de lo que llega.

**Diseño.**
- El link lleva la cuenta de Base del cobrador (`b`), que es la billetera
  embebida que Privy ya le da. `decodePayLink` la valida como dirección EVM.
- `/p` muestra esa cuenta con QR y el monto a mandar. Lee el saldo con
  `actions.readBaseBalance`; la primera lectura es el punto de partida y, si
  después sube por lo menos el monto pedido, muestra "¡Pagado!" y el CTA
  viral. En demo hay un botón que simula el envío desde Coinbase.
- El panel de Cobrar muestra la misma cuenta ("Tu dirección de cobro en Base")
  y guarda el último saldo que ya era del usuario. Si el saldo sube por lo
  menos el mínimo, cotiza la diferencia con `getQuote` y la lleva a Solana con
  `runBridge` (la misma operación patrocinada del cruce), guardando el
  movimiento en el historial. La comisión se descuenta en ese viaje.
- Motor (`BridgeActions`): `readBaseBalance(address)` y, solo en demo,
  `simulateDeposit(address, units)`.

**Errores.** Si el cruce automático falla después de salir de Base, el
historial lo reconcilia al volver a abrir la app (mismo camino que el cruce
manual). Si el cobrador movió plata por su cuenta, el punto de partida se
vuelve a fijar. Otra moneda u otra red: se pierde, y el link lo avisa.

**Tests.** Vitest: `minReceiveUnits`, links con `b`, matching con comisión
descontada. Recorrido E2E en demo (`scripts/e2e-demo.mjs`, pasos 5 y 6): el
cliente manda 25 a la cuenta de Base de Fer y la app de Fer los lleva a Solana.
