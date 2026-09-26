# Camalote es Invertir: diseño del pivot (2026-09-12)

Estado: implementado. Decisión de Fernando: "sacá todo lo de Base, ocultá
Cobrar y Llevar a Solana, adaptá la narrativa a Invertir y pensá el modelo
de negocio sobre invertir. No me vendas humo."

## Qué queda

Un solo producto: **tu cuenta de Solana que invierte sola**. Entrás con tu
email, tenés una cuenta donde te llegan USDC (de quien te paga, de un
exchange, de un bounty), y una regla: "el X % de lo que me llega va a tal
acción". Cuando lo apartado junta 10 USDC, se compra por Jupiter sin gas.
Cartera con valor de hoy, comprar y vender a mano, comprobantes.

Lo que se oculta (no se borra): los links de cobro, la dirección de cobro en
Base, el cruce Base→Solana por CCTP, el Paymaster de Coinbase. Flag
`NEXT_PUBLIC_SHOW_HIDDEN_VIEWS`. Las rutas `/app/cobrar`, `/app/invertir` y
`/p` redirigen. `/app` es Invertir.

## Modelo de negocio (sin humo)

- **Misma regla de siempre, sobre la compra**: 0,45 % con tope de 0,50 USDC
  y piso de 0,01, descontada de lo que se invierte y a la vista antes de
  confirmar. Vender: gratis. Sin suscripción, sin spread escondido.
- **Cómo se cobra**: después de que la compra salió bien, una transferencia
  de USDC del usuario a `NEXT_PUBLIC_FEE_RECIPIENT_SOLANA`, firmada y
  pagada por el usuario desde su reserva de SOL (`/api/withdraw` con
  `purpose: "fee"` arma, valida y reenvía; el servidor solo acepta ese
  destino y ese mínimo y no firma nada). Si falla, la pierde Camalote. Si
  la cuenta de comisiones no tiene abierta su cuenta de USDC, no se cobra:
  esa cuenta no se la cobramos al usuario. Hasta el 2026-09-15 la
  cofirmaba un relayer nuestro como fee payer.
- **Por qué no la tarifa de referido de Jupiter**: la doc de tarifas de
  integradores de Ultra desapareció (404 el 2026-09-15) y la nota anterior
  decía que rompía el modo sin gas, que sigue haciendo falta para cargar
  la reserva. Queda como palanca si Jupiter lo aclara.

## Stocklana: PreStocks y Pyth (2026-09-21)

Stocklana corrió el cierre al 25 de septiembre y sumó bounties. Fernando
eligió cubrir PreStocks y Pyth y saltear Tessera (excluyente con PreStocks)
y los que piden lanzar un token (Clawpump, Meteora DBC).

- Catálogo (`catalog.ts`): `kind: "stock" | "preipo"`, `issuer`, `pyth`
  (símbolo del feed), `transferFeeBps`. Ocho PreStocks con 9 decimales; la
  matemática de tokens toma los decimales del activo (`decimalsOf`).
- `/api/invest/prices` suma `market` (horario de Wall Street por acción,
  de `hermes.pyth.network/v2/price_feeds`, que no pide clave) y
  `reference` (valor de referencia y precio del token de
  `prestocks.com/api/prestocks`, con la distancia en puntos básicos).
  Además: Jupiter ya no manda `usdPricePrescaled`, así que el precio por
  unidad cruda es precio visible × multiplicador (SpaceX va ×5).
- `guards.ts` (puro, testeado): `buyBlockedBy` frena la regla si la
  acción está fuera de horario y el usuario pidió esperar
  (`rule.waitForMarketOpen`, por defecto sí), o si la pre-IPO está más de
  5 % arriba de su referencia (`MAX_PREMIUM_BPS`). Sin datos no frena. La
  regla guarda `waiting` y el río dice por qué espera. En demo el horario
  no frena (si no, un fin de semana no habría nada que mostrar).
- UI: el selector de activos tiene dos pestañas; la hoja de la regla trae
  el interruptor de horario o la nota de pre-IPO; comprar y vender muestran
  `MarketNote` (horario, o referencia + 1 % de transferencia); la cartera
  muestra la referencia por fila. Dividendos solo para acciones.

## Metas con nombre (2026-09-26)

Fernando: "nadie se emociona con el S&P 500; se emociona con la compu
nueva". Metas tienen todas las fintech; la diferencia acá es que la meta se
llena sola cada vez que te pagan, con acciones. Una meta activa por vez.

- La regla guarda `goal` (`InvestGoal`: nombre, emoji, ficha, monto, mes
  opcional, `startedAt`, `contributedUnits`, `celebratedAt`) y
  `lastIncoming` (suma, apartado, cantidad y fecha del último lote de
  cobros que contó). `planInvestments` mantiene los dos.
- `goals.ts` (puro, testeado): seis fichas (`GOAL_PRESETS`: compu, viaje,
  colchón de 3 meses, mudanza, curso, otra), `goalProgress` (lo comprado
  desde `startedAt` menos lo vendido, nunca más de lo que hay, a precio de
  hoy, más lo apartado), `paymentsToGo` ("faltan unos N cobros como el
  último"), `etaFromPace` (recién después de una semana, tope 30 años),
  `neededPerMonth` (si hay mes), `formatMonth`, `monthKey`.
- Hoja de la regla: paso "¿Para qué?" (`GoalEditor`, se monta en cada
  apertura) con fichas, nombre, monto (el colchón pide lo que necesitás por
  mes y multiplica por tres), mes opcional y la nota de que sube y baja.
- Río: la orilla derecha pasa a ser la meta (nombre, juntado, "de 300 ·
  3,9 %", barra). El camalote sigue cruzando por compra. Debajo, una línea
  de ritmo (mes pedido, ritmo real o cobros que faltan, en ese orden) y,
  durante tres días, "Te llegaron 40. 12 ya son de la meta: vas por el
  3,9 %". Sin meta, el río queda como estaba.
- Llegar: `GoalReachedSheet`, una vez, con la hoja de la regla cerrada y
  las tenencias leídas. Seguir juntando, elegir la próxima (la meta se
  borra y se abre la hoja; la siguiente arranca de cero) o vender y retirar
  (abre vender). "Contarlo" usa `navigator.share` o el portapapeles.
- `useNow`: el "ahora" como estado, para no llamar `Date.now()` en el render.
- E2E: viaje de 300, cobro de 40, bajar la meta a 10, festejo, próxima meta.

## Inglés por defecto (2026-09-23)

Fernando: "necesito que el inglés sea el idioma por default". La app abre
en inglés para todos, sin mirar el idioma del navegador; el castellano
queda en el toggle EN/ES y se recuerda en el dispositivo
(`camalote.lang`). Cambian también `<html lang>`, los metadatos, el
manifiesto y el `aria-label` de las pestañas ocultas. Los scripts corren
en inglés: `e2e-demo.mjs` verifica ese camino y `demo-video.mjs` graba en
inglés (con `CAMALOTE_LANG=es` sale `camalote-demo-es.mp4`).

Desde el 2026-09-25 el video lleva el pitch hablado: `scripts/demo-pitch.mjs`
tiene una frase por escena, `demo-video.mjs` genera cada clip con `edge-tts`
(voz neural de Microsoft Edge, gratis, pide internet; cacheado por texto en
`docs/demo/voice/`), sostiene cada escena hasta que termina su frase, anota
el segundo en que empezó cada escena (`camalote-demo.scenes.json`) y mezcla
los clips en ese segundo con ffmpeg (`adelay` + `amix` + `loudnorm`). Sin
`apad` ni `-shortest`: en ffmpeg 4.4 esa combinación no termina nunca.

## La reserva de red (2026-09-15)

Fernando: "ocultá lo del relayer y dejá que el usuario pague, o que se
pague a través de Jupiter". Sin relayer, cada cuenta paga su propia red:

- `src/lib/invest/fuel.ts`: 1 USDC se cambia por SOL con Ultra (sin gas,
  Jupiter lo arma desde 1 USDC; probado dos veces) cuando la cuenta tiene
  menos de 0,004 SOL. `needsFuel`, `fuelUnitsFor`, `fitBuyToBalance`.
- La cotización de compra trae `fuelUnits` (1 USDC o 0) y el ticket lo
  muestra como "Reserva de red (una vez)". Al comprar: primero la reserva,
  después se vuelve a pedir la orden (con SOL, Jupiter arma la compra
  normal, más barata que la sin gas), después la comisión.
- Retiros: misma reserva primero si falta; el usuario es fee payer y paga
  la cuenta destino si no existe. El servidor arma y reenvía, no cofirma.
- La regla: si el saldo no alcanza para la compra y la reserva, invierte
  lo que entra y deja el resto apartado.
- Demo: misma secuencia con `solLamports` simulados.
- Costo real por compra con reserva: Jupiter 0,10 % + red < 1 centavo +
  ~0,0025 SOL la primera vez por acción (cuenta del token).
- **Unit economics**: 0,045 por compra de 10; 0,50 desde 111. Un usuario
  que invierte 200 por mes en compras de 50 paga 0,90 por mes. Mil usuarios
  así: 900 por mes. La meta de 500 por mes pide unos 550 usuarios activos
  o más volumen por usuario. Es un negocio de volumen; no hay otra fuente
  construida hoy.
- **Lo que no prometemos**: rendimiento. Es el mercado, para arriba y para
  abajo, y la app lo dice.

## Narrativa de la landing ("vendeme una pluma")

1. Necesidad: "Cobrás en dólares. ¿Cuánto te quedó el mes pasado?"
2. Falta: invertir "cuando sobre" no pasa nunca; abrir un broker desde acá
   tampoco. Columnas: como hasta ahora vs. con Camalote. Nota de tus dólares.
3. Por qué en Solana: acá viven las acciones tokenizadas, mover plata
   cuesta una fracción de centavo, hay laburo que paga en USDC acá,
   Argentina juega de local.
4. Respuesta: tres pasos (email, elegí cuánto y en qué, cobrá como siempre).
5. Prueba: números ciertos (mínimo 10, tope 0,50, vender gratis, 5
   acciones), calculadora con la misma comisión de la app, confianza.
6. FAQ honesto: qué comprás, puede bajar, cuánto cuesta, vender, si no te
   pagan en Solana, cuándo compra (solo con la app abierta), qué es Solana,
   legal desde Argentina.
7. Cierre: "Que la próxima vez que cobres, una parte ya esté invertida."

## La app es tu río (rediseño del 2026-09-13)

Fernando: "la UI/UX no me está cerrando del todo en la page app, necesito
que me sorprendas". El problema: seis tarjetas iguales apiladas, parecía un
panel de configuración y el camalote de la landing desaparecía en la app.

- `river-hero.tsx` + `river.tsx`: arriba las dos orillas con los dos números
  que importan (USDC en tu cuenta, ya en acciones). En el medio el agua con
  el camalote **donde está lo apartado**: en la orilla izquierda cuando la
  regla arranca, cruza a medida que junta (`pendingUnits / INVEST_MIN_UNITS`)
  y llega a la otra orilla mientras la regla compra. Apagada: amarrado y
  atenuado. Debajo, la regla en una frase con su interruptor y "Cambiar".
- `rule-sheet.tsx`: el editor (porcentaje y acción) en una hoja que se abre
  sola la primera vez que se prende la regla.
- `buy-sheet.tsx`: comprar a mano en una hoja desde "Tus acciones".
- `portfolio-card.tsx` → `StocksSection`: filas con Vender, botón Comprar.
- El aviso "Lo que tenés que saber" queda plegado en un `<details>`.
- Resultado: la página en teléfono con una compra pasó de 2.613 a 1.155 px.

## Componentes nuevos o cambiados

- `src/components/invest/account-card.tsx`: cuenta de Solana, saldo,
  depositar (modal con QR), retirar, y en demo "simular que te llegan 40".
- `buy-card.tsx`: compra en dos pasos, con ticket (invertís, comisión de
  Camalote, Jupiter y red, recibís) y confirmación.
- `sell-modal.tsx`: vender cantidad o todo, precio a la vista, sin comisión.
- `portfolio-card.tsx`: botón Vender por fila; rendimiento sobre lo neto.
  Desde el 2026-09-13: cantidades como las muestra cualquier billetera
  (cruda × multiplicador "scaled UI amount" de xStocks) y renglón
  "Dividendos reinvertidos" por acción, calculado con el multiplicador
  guardado en cada operación (`multiplier.ts`, `dividendsSummary`).
- `purchases-list.tsx`: compras y ventas.
- Motor: `quoteStock`/`buyStock`/`quoteSell`/`sellStock`/`simulateIncoming`.
  Real: Ultra (`side=buy|sell`), firma con Privy, cobro de comisión.
  Demo: mismos pasos, 1 % de costo simulado, precios reales.
- Servidor: `/api/invest/order` con `side`; `/api/withdraw` con `purpose`
  (`withdrawTx.ts` ahora devuelve el destino validado).
- La regla ignora lo que vuelve de ventas propias (firmas conocidas).

## Riesgos que se dicen

- Permanent delegate de Backed; países restringidos; sin voto.
- La regla corre en el navegador: con la app cerrada no compra.
- Ultra: Jupiter menciona migración a Swap v2; lite-api Ultra responde
  hoy con órdenes sin gas.
- Argentina: Backed no restringe; Bybit sí. Camalote no custodia ni
  intermedia: el usuario firma cada operación. Impuestos: su contador.
