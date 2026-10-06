# ¿Camalote está apto para ganar el Crypto World's Fair? (análisis del 2026-09-29)

Hecho con el Copilot de Colosseum (proyectos, ganadores y clusters de sus
hackathons anteriores), las páginas oficiales del World's Fair y del
hackathon, y la lista de ganadores del Frontier (2026).

## Veredicto corto

- **Apto: sí.** Cumple todo lo que piden: producto que funciona, repo,
  fundador solo permitido, pista de Solana, sin restricción para Argentina.
- **Para ganar: hoy está en el pelotón, no adelante.** La idea es distinta
  a todo lo que hay en el corpus y el producto está pulido, pero le faltan
  las dos cosas que más pesan para los jueces: **tracción** (cero) y
  **prueba real con plata** (nunca se hizo). Con las cinco cosas del plan
  de abajo hechas antes del 12/10, tiene chances reales de uno de los diez
  premios de la pista de Solana. Sin eso, no.

## Cómo juzgan (datos, no opinión)

- Siete criterios oficiales: fit fundador-mercado, insight, producto y
  ejecución, tamaño de mercado, comunicación del fundador, viabilidad
  ("¿puede ser un negocio escalable y sostenible?") y **tracción**
  ("demanda, ingresos o usuarios, y qué tan durables"). Los seleccionados
  pasan a una entrevista de 15 minutos por Zoom.
- Materiales: repo en GitHub, **video de presentación de 2 a 3 minutos**,
  **video demo de hasta 3 minutos**, estrategia de salida al mercado,
  validación de demanda y plan de distribución, y credenciales del equipo.
- Fundador solo: permitido, pero lo dicen explícito: "teaming is
  recommended". Cada persona, un solo producto.
- **Se juzga solo el trabajo hecho entre el 14/9 y el 12/10.** Hay que
  declarar todo el desarrollo previo. Ocultarlo es descalificación.
- Premios: 30.000 al mejor, 20 premios de 15.000, **pista Solana: 10
  premios de 10.000**, más 5.000 bien público y 5.000 universitario.
  Ganar da entrevista para el acelerador (250.000 de pre-seed, 12 semanas
  en San Francisco).
- Escala: el Frontier (2026) tuvo 2.857 entregas y 26 ganadores. Menos del
  1 %. Entre los ganadores hubo fintech de consumo: Peaks (inversión con
  IA), Cesto (canastas temáticas de inversión), KinnectFi (neobanco de
  stablecoins). La categoría de Camalote sí gana.

## Dónde está parado, criterio por criterio

**1. Insight: fuerte.** En la búsqueda que hicimos en el corpus de
Colosseum Copilot (29/09), no encontramos un proyecto igual a "invertir en
el momento del cobro, con una meta con nombre". Eso no prueba que no
exista: el informe de Superteam Argentina (5/10) suma precedentes cercanos
sin premio (Rail Money, EarnFlow, Paycheck). Lo más cercano que vimos:
- Buybak (Renaissance, marzo 2024): fracciones de acciones como premio por
  cada compra. Misma intuición ("hacé plata mientras gastás"), otro evento.
- Bitsave (Cypherpunk, sept. 2025): ahorro on-chain para los que cobran en
  cripto. Ahorro, no inversión; sin meta ni destino.
- Myfye (Breakout, abril 2025, premio universitario 2.500): "el Robinhood
  de mercados emergentes", Privy + Jupiter + RWAs. Es una billetera de
  inversión; no tiene la regla.
- STAIPY, Flexvest, Corre: facturar, cobrar y ahorrar en stablecoins. Sin
  el gatillo del cobro.
- Los clusters donde caen todos estos están llenos: "Stablecoin Payment
  Rails" (202 proyectos) y "Yield and DeFi Optimization" (257). El cruce
  de Camalote (cobro → regla → meta → acciones o dólares que rinden) es
  espacio abierto dentro de un barrio saturado. Eso es bueno: hay demanda
  demostrada y un ángulo propio.
- Contexto de mercado a favor: el boom de acciones tokenizadas (a16z:
  NYSE con OKX; Galaxy, Q2 2026: Jupiter Lend y Kamino lideran el mercado
  de acciones tokenizadas; Backpack con acciones 24/7; Ondo con emisión y
  rescate 24/7).

**2. Producto y ejecución: bueno, con dos agujeros.** Funciona en demo y
está listo para mainnet con la reserva de red; la UI quedó clara hoy; 101
tests; recorrido completo verificado. Pero un juez técnico va a preguntar
dos cosas y hoy la respuesta es floja: la regla corre solo con la app
abierta, y lo apartado vive en el navegador (se pierde con los datos).
Y lo más grave: **nunca se probó con plata real**.

**3. Tamaño de mercado: existe, pero hay que ponerlo en números.**
Freelancers y remotos de Latinoamérica que cobran en USDC (bounties de
Superteam, plataformas de pago en cripto), más el mercado de acciones
tokenizadas en Solana. En el video hace falta una cuenta concreta, no
"muchos".

**4. Viabilidad: honesta pero flaca.** 0,45 % con tope de medio dólar da
0,90 por usuario por mes con 200 de compras (README). Hay que mostrar el
camino a más: volumen, dólares que rinden al 0,10 %, y un canal B2B
(plataformas que pagan en USDC ofreciendo Camalote a los que cobran).

**5. Tracción: cero. Es el punto más débil.** Los jueces preguntan por
demanda existente. Hoy la landing no está online y nadie la usó.

**6. Fit fundador-mercado: bueno, pero solo.** Más de diez años de
desarrollo, un producto anterior en Base (tuneport), argentino que cobra
en dólares: vivís el problema. Ser uno solo pesa en contra por dos lados:
lo dicen los jueces y lo dice la lista de ganadores (casi todos equipos).

**7. Comunicación: bien.** El pitch de la pluma funciona. Falta grabarlo
en el formato que piden: presentación (2 a 3 min) y demo (hasta 3 min)
como dos videos, con la app y la landing nuevas.

## Riesgos a declarar en la entrega

- Trabajo previo: Camalote existe desde agosto. Dentro de la ventana
  (14/9 a 12/10) se hizo: metas con nombre, dólares que rinden, inglés por
  defecto, el rediseño de la app, la landing nueva y los videos. Es mucho
  y es verificable en el historial de git. Declararlo tal cual.
- Regulatorio: xStocks no está disponible para Estados Unidos, Reino
  Unido, Canadá y Australia; USDY es para personas fuera de Estados
  Unidos; Camalote no custodia ni recomienda. Ya está dicho en la app y en
  la landing; decirlo también en la entrega.

## Plan hasta el 12/10, en orden

1. **Prueba real en mainnet** con 10 a 20 USDC: una compra por regla, una
   a mano, una en dólares que rinden, una venta. Con comprobantes en
   Solscan en el video demo. Sin esto, todo es "simulación" y se nota.
2. **Tracción mínima y honesta**: landing y demo online (Vercel), 20
   conversaciones con gente que cobra en USDC, 10 personas que armen su
   regla. Anotar qué destino eligen. Contar los números reales, chicos y
   todo.
3. **Cerrar los dos agujeros técnicos**: que lo apartado sobreviva al
   dispositivo y que se lean más de 10 movimientos. Lo hago yo; son
   cambios chicos.
4. **Dos videos nuevos**: presentación (pitch de la pluma + números de
   mercado + modelo + cómo se distribuye) y demo (la app nueva, con la
   prueba real).
5. **La entrega completa**: salida al mercado (Superteam Argentina,
   comunidades de freelancers, plataformas que pagan en USDC), validación
   de demanda (las 20 charlas), credenciales, declaración del trabajo
   previo.
6. Si podés, **sumar a alguien**, aunque sea a tiempo parcial para
   distribución. Mejora dos criterios de golpe.

## Probabilidad honesta

- Pista de Solana (10 premios): con el plan hecho, chances reales. Sin la
  prueba real ni tracción, bajas.
- Top 20 general o gran premio: haría falta tracción de verdad (usuarios
  activos, volumen). No es realista para el 12/10.
- El acelerador entrevista a los ganadores; ahí lo que pesa es equipo y
  tracción, otra vez.

## Fuentes

- Colosseum, Crypto World's Fair: colosseum.com/worldsfair
- Colosseum, reglas y criterios del hackathon: colosseum.com/hackathon
- Ganadores del Frontier 2026: solanacompass.com (nota "Colosseum announces
  26 winners of the Solana Frontier Hackathon")
- Cobertura del lanzamiento: cryptobriefing.com y coindesk.cc (septiembre
  2026)
- Wiki de Superteam Brasil sobre el World's Fair (github.com/solanabr/wiki)
- Copilot de Colosseum: búsquedas de proyectos, ganadores, clusters y
  archivo (a16z "3 charts on the tokenized stocks boom", Galaxy "Solana Q2
  2026 Update", Solana News "Ecosystem Roundup July 2026")
