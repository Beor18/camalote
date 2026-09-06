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

1. `computeQuoteForReceive`: cotización inversa. Dado lo que tiene que llegar,
   calcula lo que paga el pagador (comisión + envío exprés incluidos).
2. Links de cobro sin base de datos: todo viaja en la URL
   (`/p?to=<solana>&a=<monto>&c=<concepto>&n=<nombre>`). El cobrador guarda sus
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

- `src/lib/cctp/quote.ts`: `computeQuoteForReceive(receiveUnits, circleFastBps)`.
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
2. `computeQuoteForReceive(a)` → `quote.amountUnits` es lo que sale de Base.
3. `runBridge(quote, onUpdate, { recipientOwner: to })`: `mintRecipient` =
   ATA(USDC, to). Lote patrocinado: approve + transfer(comisión) + depositForBurn.
4. Circle certifica. `/api/relay { txHash, solanaOwner: to }`: el relayer valida
   que `mintRecipient` del mensaje sea ATA(to), crea la cuenta si falta y acuña.
5. El cobrador, al abrir la app, sincroniza su historial desde la cadena: un
   ingreso ≥ monto y posterior a la creación marca el link como pagado.

## Errores

- Link inválido o incompleto: página explica y ofrece crear un link propio.
- Saldo insuficiente: botón "Cargar USDC en Base" y refresco automático.
- Fallo después del burn: mismo tratamiento que el bridge (entrega garantizada,
  reintento desde historial).

## Tests

- Unit: cotización inversa (redondeos, tope, mínimo), codificación de links,
  matching de pagos.
- Existentes: calldata, mensaje CCTP, validación de retiro, PDAs (devnet).
- Manual/Playwright: flujo demo completo grabado en video.
