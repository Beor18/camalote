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

## Dólares que rinden (2026-09-29)

Fernando: "¿cómo aplicamos el mecanismo para los que no quieren riesgo de
acciones pero puedan generar rendimiento con sus USDC?". Cerrar el círculo
también contesta la duda de fondo: si eligen dólares, el problema era
apartar; si eligen acciones, la apuesta original.

- Destino nuevo en el catálogo: USDY de Ondo (`kind: "dollars"`, token
  clásico SPL, 6 decimales, mint `A1KL…Eto6`, verificado en Jupiter:
  8.272 tenedores, 2 M de liquidez). Dólares respaldados por letras del
  Tesoro de Estados Unidos, 3,6 % anual el 2026-09-29 (varía con la tasa),
  el precio sube a diario; solo personas fuera de Estados Unidos (Reg S).
  Compra de 10 USDC por Ultra: 0,14 % total, sin gas; venta 0,09 %.
- Comisión: `FEE_BPS_DOLLARS` = 10 (Fernando eligió 0,10 % sobre 0,45 y
  0,25: "diez días de rendimiento por compra, no un mes y medio").
  `feeBpsFor(asset)` en `rules.ts`; la cotización real y la demo la usan; el
  ticket muestra el porcentaje del activo.
- `buyBlockedBy` nunca frena dólares; `dividendsSummary` solo cuenta
  acciones; `assetName(symbol, lang)` da "Dólares que rinden" / "Dollars
  that earn" (sin el ticker en la ficha).
- Tenencias reales: `fetchXStockHoldings` lee Token-2022 y el programa
  clásico. El multiplicador de un mint clásico queda en 1.
- UI: tercera pestaña "Dólares" en el selector con una sola ficha y su nota
  honesta; nota en la hoja de la regla y en comprar/vender (`MarketNote`);
  el colchón de tres meses pone el destino en USDY al elegirlo; FAQ "¿Y si
  no quiero acciones?"; línea en "Lo que tenés que saber"; landing lo
  nombra en las columnas y en los pasos.
- E2E: compra de 10 USDC de USDY en demo con el ticket a 0,10 %.

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

## La landing vende como una startup (2026-09-29)

Fernando: "la narrativa de la landing no me convence, no vende, somos una
startup". La versión anterior seguía el pitch golpe por golpe (pregunta,
servilleta, «después» no llega nunca, carta de tus dólares) y se leía como
un manifiesto. La nueva vende como producto:

- **Hero**: eyebrow "Para los que cobran en USDC", la promesa en una línea
  ("Una parte de cada cobro **se invierte sola.**"), el cómo en dos frases,
  "Armar mi regla" (mismo verbo que la app) + "Ver cómo funciona", y tres
  pruebas cortas (desde 2 dólares, sin broker ni papeles, lo apagás cuando
  quieras). Al lado, **el producto** (`landing/phone-mock.tsx`): la tarjeta
  de la regla tal cual se ve en la app, con números de ejemplo, el río y
  "te llegaron 40". En desktop, dos columnas; en teléfono, debajo.
- **Corre sobre**: Solana, Jupiter, xStocks · Backed, Ondo, Pyth, Privy.
  Nombres, no promesas.
- **El problema en un golpe**: "Te pagan 40. Se van 40." con el antes y
  después (las dos columnas quedaron; la carta manuscrita se fue).
- **Lo armás en un minuto**: tres pasos con las fichas de la app (10/20/30 %,
  ✈️ El viaje, Acciones/Privadas/Dólares).
- **¿En qué?**: tres destinos con su comisión a la vista (0,45 / 0,45 /
  0,10 %).
- "Hacé la cuenta", "Sin letra chica" y las preguntas quedan. "¿Por qué en
  Solana?" pasó a ser la última pregunta (sin el link a Superteam).
- Sin nombres de activos en la venta (regla de Fernando). Teléfono: 8,4
  pantallas a 375 px (7,7 a 420); desktop: 6,1.

## Narrativa de la landing ("vendeme una pluma")

Reescrita el 2026-09-28 para que siga el pitch de los videos golpe por
golpe ("pareciera que la landing no está equilibrada con el pitch"). Sin
nombres de acciones ni de empresas en la venta (pedido de Fernando): eso
queda en la app.

1. La servilleta: "Cobrás en dólares. ¿Cuánto de lo del año pasado sigue
   siendo tuyo?" y "Trabajaste todo el año para el alquiler, las cuentas,
   la tarjeta. Para vos quedó lo que sobró. Y nunca sobra." Bajo el río:
   "Te pagan 40. Ya no son 40: son 28 para el mes y 12 que ya están en tu
   meta."
2. "Hacé la cuenta." (`Napkin`): escribís lo que cobraste el año pasado,
   elegís 10/20/30 % y ves en letra manuscrita "Hoy tendrías 2.400 USD
   puestos en acciones, a tu nombre. Sin acordarte ni una vez." Solo lo
   puesto, no lo que valdría: sin promesas.
3. "«Después» no llega nunca.": la plata entra y ya tiene dueño; el que se
   salva es el que cobra primero. Columnas de decisiones (acordarte cada
   mes, cuarenta decisiones por año vs. decidís una vez, para algo
   concreto, se aparta antes de que lo veas). La nota de tus dólares:
   "llegamos 40, doce nos fuimos al viaje".
4. "Decidilo una sola vez": email; cuánto, para qué y en qué; cobrá como
   siempre y la app te dice cuántos cobros faltan.
5. "Sin letra chica.": los cuatro números (mínimo 2, 0,45 %, tope 0,50,
   vender gratis) y las tres promesas (tu cuenta es tuya, sin promesas, lo
   apagás cuando quieras). La calculadora de comisión salió de la landing
   (`MiniCalc` queda en el repo); la cuenta de la comisión está en la FAQ.
6. "¿Y por qué en Solana?", al final y en tres líneas, para el que ya está
   convencido.
7. FAQ (con "¿Qué es la meta?") y cierre: "El próximo cobro ya está en
   camino. ¿Qué va a pasar con él?"

En teléfono: 7,2 pantallas (6,9 antes de la servilleta).

## Una sola cosa que hacer (rediseño del 2026-09-29)

Fernando: "el de 'cambiar' y el de 'comprar' está muy confuso, el primer
usuario que entra no entiende qué hacer; 100 % responsive; decidí todo vos".
El diagnóstico sobre capturas en 375, 768 y 1280: el único botón violeta de
la pantalla era "Comprar" (la acción secundaria); la acción principal era
un interruptor chico al final de una tarjeta; "Cambiar" no decía qué
cambiaba; y en desktop la columna de teléfono quedaba estirada.

- **Bienvenida** (`welcome-card.tsx`): sin regla armada, la app muestra una
  sola idea ("Cada vez que cobrás, una parte va para vos primero") y un solo
  botón, "Armar mi regla". Debajo, las tres preguntas que vienen, para que
  nadie tenga que adivinar. Se sabe que la regla nunca se armó porque
  `InvestRule.configuredAt` está vacío.
- **La regla en tres pasos** (`rule-sheet.tsx`): una pregunta por pantalla,
  con la frase que se va armando en el encabezado ("El 30 % de cada cobro va
  a El viaje, en S&P 500"), barra de progreso y "Prender la regla" al final.
  Nada se guarda hasta ese botón: el asistente trabaja sobre un borrador
  (`RuleDraft`) y `onSave` solo escribe lo editable (parte, meta, destino,
  horario), nunca lo apartado ni las firmas contadas. Para cambiarla se abre
  en un **resumen** de tres filas (Qué parte / Para qué / En qué): tocás la
  fila, cambiás, "Listo", "Guardar". Abajo, "Apagar la regla". "Elegir la
  próxima meta" desde el festejo abre directo en el paso de la meta.
- **La regla como titular** (`rule-hero.tsx`, reemplaza a `river-hero.tsx`):
  "El 30 % de cada cobro / va a ✈️ El viaje / en S&P 500" en tipografía
  grande; la meta con su barra y el ritmo; el río con el camalote llevando
  la meta; y una línea de estado ("Apartado: 0,66 USDC. Compra al juntar
  10."). El interruptor dice su estado ("Prendida" / "En pausa") y "Editar"
  dice qué edita. En pausa aparece "Reanudar".
- **Tu cuenta** (`account-card.tsx`): saldo, "Acá te pagan. Lo que llega
  cuenta para tu regla", Depositar (secundario), Retirar (fantasma) y la
  dirección corta con copiar. Ya no hay dos números enfrentados arriba.
- **Lo que ya es tuyo** (`portfolio-card.tsx`): nombre primero, sigla como
  detalle; total "Vale hoy" con lo puesto y el rendimiento; Vender como
  botón discreto; **"Comprar una vez"** (antes "Comprar") como acción
  secundaria y explícitamente fuera de la regla. "Movimientos" con nombres.
- **Dos columnas desde 1024 px**: regla, cartera y movimientos a la
  izquierda; cuenta y "Lo que tenés que saber" a la derecha, pegajosos. En
  teléfono, el mismo DOM con `contents` + `order`: regla, cuenta, cartera,
  movimientos, aviso. Sin scroll horizontal en 375, 768 ni 1280.
- Textos nuevos en ES/EN (`welcome*`, `setupCta`, `ruleHeadline`,
  `ruleGoesTo`, `stepOf`, `next`, `back`, `turnOn`, `save`, `review*`,
  `percentExample`, `buyOnce`, `emptyPortfolioNoRule`); se fueron
  `heroLeft/Right`, `ruleChange`, `ruleOff`, `buyOpen`.
- **Dólares: otro verbo** (mismo día, "¿compro dólares o pongo a rendir
  dólares?"): con USDC en la mano no se "compran dólares". Cuando el
  destino es USDY, la hoja de compra dice "Poner dólares a rendir", "¿Cuánto
  ponés a rendir?", "Ver cuánto queda rindiendo", y el ticket muestra
  "Queda rindiendo ~9,89 USD" (la cantidad de USDY, como detalle), porque
  "ponés 10, recibís 8,61 USDY" parecía una pérdida. Vender es "Sacar los
  dólares": se escribe en USD, "Todo" saca exactamente lo que hay, y la
  fila de la cartera dice "Cerca del 4 % anual" con el botón "Sacar". En
  movimientos, "Sacaste Dólares que rinden".
- **La landing con el mismo verbo** (pedido de Fernando el mismo día): "Sin
  letra chica" suma la nota "En dólares que rinden, la comisión es 0,10 %.
  Sacarlos, gratis" y "Vender o sacar · Gratis"; la confianza habla de
  acciones y dólares; las preguntas "¿Y si no quiero acciones?", "¿Puede
  bajar?", "¿Cuánto cuesta?" y "¿Cuándo se mueve la plata?" cubren los dos
  destinos; "comprá a mano" pasa a "empezá a mano"; el pie nombra a Ondo.
- E2E y video: `rule-setup` → `rule-next` → `rule-done`; editar es
  `rule-edit` → `rule-review-goal` → `rule-step-done` → `rule-done`; pausa y
  reanudación (`rule-toggle`, `rule-resume`) cubiertas.

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

- `src/components/invest/account-card.tsx`: tu cuenta, saldo, dirección
  corta con copiar, depositar (modal con QR) y retirar. En demo, "simular
  que te llegan 40" vive en la tarjeta de la regla (`rule-hero.tsx`).
- `welcome-card.tsx` y `rule-hero.tsx` (2026-09-29): la bienvenida con un
  solo botón, y la regla como titular; ver "Una sola cosa que hacer".
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
