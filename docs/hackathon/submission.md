# Camalote: paquete de submission

Actualizado el 2026-09-21: Camalote es Invertir. Dos eventos, en este orden:

1. **Stocklana** (Solana Foundation, hackathons.solana.com/hackathons/stocklana):
   126.000 en premios, cierra el **viernes 25 de septiembre de 2026 a las
   16:00 ET** (17:00 en Argentina; se corrió desde el 18), judging hasta el
   2 de octubre. Categoría: **Investing** (compras recurrentes, carteras
   automáticas). Criterio: "¿esto puede ser una app real que la gente
   use?". Hace falta al menos un link (GitHub, demo o video).
   Tracks a los que va Camalote: **principal** (100.000), **Best Use of
   PreStocks** (10.000: las ocho empresas pre-IPO están en el catálogo con
   su referencia y el freno de la regla) y **Best Use of Pyth Market Data**
   (tres meses de Pyth Pro: el horario de Wall Street por acción, con la
   regla que espera a la apertura). No va a Tessera (excluyente con
   PreStocks), ni a Clawpump y Meteora DBC (piden lanzar un token propio).
2. **Crypto World's Fair** (Colosseum, colosseum.com/worldsfair): del 14 de
   septiembre al 12 de octubre de 2026. Tracks y premios se publican el 14.
   Camalote va a la pista de Solana.

## Formulario de Stocklana

El paso 1 (Project Name, Short Description, Full Description en Markdown)
está listo para pegar en `docs/hackathon/stocklana-form.md`, con los
contadores verificados (269 de 280 y 3.977 de 5.000).

## Campos (en inglés, listos para pegar)

**Project name**: Camalote

**Category**: Investing

**One-liner** (100 caracteres):
Pay yourself first: a rule that turns part of every USDC payment into tokenized stocks, on its own.

**Description**:

Camalote is a Solana account that invests on its own. You sign in with an
email, you get an account where USDC land (from a client, an exchange, a
bounty), and you set one rule: "20% of whatever comes in goes to the
S&P 500". Every time USDC arrive, that share is set aside; once it adds up
to 10 USDC, Camalote buys the tokenized stock (xStocks by Backed: SPYx,
QQQx, AAPLx, NVDAx, TSLAx) or the pre-IPO token (PreStocks: SpaceX, OpenAI,
Anthropic, Kalshi, Neuralink, Anduril, Figure AI, Polymarket) through
Jupiter Ultra and leaves it in your own account. No broker, no seed phrase;
the network is paid from a 1-USDC SOL reserve the app loads on its own.

Market data does real work here. For listed stocks, Pyth's public feed
metadata tells the app whether Wall Street is open; by default the rule
waits for the open, because outside market hours the token can drift from
the stock. For pre-IPO tokens, PreStocks' reference value is compared with
the token price on every screen, and the rule refuses to buy while the
token trades more than 5% above it (OpenAI was +14% and SpaceX −23% on
September 21).

Why the income event and not a calendar: freelancers in Argentina and Latin
America don't earn on a schedule, they earn when they get paid. Calendar
DCA assumes a salary. "Pay yourself first" only works if it happens before
you spend, and that is the moment the money lands. Small payments add up,
so a 25-dollar gig still invests.

What you get: a portfolio with today's value (Jupiter prices) and return on
what you put in, the dividends xStocks reinvested for you (read from the
token's Scaled UI Amount multiplier on-chain, compared with the multiplier
the day you bought), buy and sell by hand with the price and fees shown
before you confirm, a receipt on Solscan for every operation, and a rule
you can switch off in one tap.

Business model, in plain sight: 0.45% per purchase, capped at 50 cents,
taken from the purchase and shown on the ticket. Selling is free. The fee
is collected on-chain after the swap succeeds (a USDC transfer to
Camalote's account, signed by the user and paid from their SOL reserve). No subscription, no
hidden spread. Honest numbers: a user investing 200 dollars a month pays
about 0.90 a month; this is a volume business.

Honest about the limits, in the app itself: xStocks carry Backed's
permanent delegate, they aren't available to US/UK/CA/AU residents, prices
go up and down, and the rule runs while the app is open (it buys when you
open it if USDC landed meanwhile).

**Links**: repo https://github.com/Beor18/camalote · demo (Vercel, demo mode)
→ completar · video → completar.

**Tech**: Next.js 16, Privy (email login, embedded Solana wallet), Jupiter
Ultra (buy and sell; a 1-USDC SOL reserve loaded gasless by Ultra the first
time pays the network from then on) and Price API, Token-2022 (xStocks:
amounts shown with the Scaled UI Amount multiplier, dividends derived from
it). No relayer and no custody: withdrawals and the fee are plain USDC
transfers the user signs and pays.

**Country**: Argentina

**Team**: Fernando (Beor18). Solo founder. Built tuneport.xyz (indie music
on Base with email login). Lives the LatAm freelancer reality from
Corrientes, Argentina.

## Video (en inglés, con voz)

Desde el 2026-09-25 el video lleva el pitch en inglés hablado encima
(voz neural de Edge, `edge-tts`; el guion está en `scripts/demo-pitch.mjs`
y cada escena dura lo que dura su frase). Grabar con el dev server en demo
en :3001: `node scripts/demo-video.mjs docs/demo` → `camalote-demo.mp4`
(alrededor de un minuto y medio). Mudo: `CAMALOTE_VOICE=off`. En castellano
(mudo, no hay guion en castellano): `CAMALOTE_LANG=es`.

El pitch, escena por escena (sirve también como descripción en YouTube):

1. Landing. "You get paid in dollars. How much did you keep last month?
   Camalote is a Solana account that invests part of every payment you
   receive, on its own."
2. Entra con su email. "You sign in with your email. That's your Solana
   account, where USDC land from a client, an exchange or a bounty. No seed
   phrase, no broker."
3. Arma la regla (30 %, mira las pre-IPO, elige S&P 500). "You set one rule.
   Thirty percent of whatever comes in goes to the S&P 500. Or to Nvidia. Or
   to SpaceX and OpenAI before they go public, through PreStocks. For listed
   stocks, the rule waits for Wall Street to open, using Pyth's market hours."
4. Le llegan 40 USDC y el camalote cruza. "A client pays forty USDC. You
   don't touch anything. Camalote sets aside the thirty percent and buys the
   tokenized stock through Jupiter. It stays in your own account."
5. La cartera. "Your portfolio shows today's value, your return, and the
   dividends the token reinvested for you."
6. La operación con su comprobante. "Every operation has a receipt on
   Solscan. The fee is 0.45% per purchase, never more than fifty cents, shown
   before you confirm. Selling is free."
7. El cierre de la landing. "Next time you get paid, let part of it already
   be invested. Camalote, on Solana."

## Preguntas que van a hacer los jurados

- **¿Esto no es un DCA más?** El DCA existente compra por calendario y
  asume un sueldo. Camalote compra por evento de ingreso, que es cuando el
  freelancer tiene la plata y antes de que la gaste.
- **¿Cómo ganan plata?** 0,45 % por compra, tope 0,50, a la vista y
  cobrado en la cadena. Vender gratis. Volumen.
- **¿Es self-custody?** Los USDC sí. Las acciones tokenizadas tienen el
  permanent delegate de Backed: la app lo dice tal cual.
- **¿Por qué solo mientras la app está abierta?** Porque la regla la firma
  el usuario con su billetera embebida; no custodiamos ni firmamos por él.
  Un firmante delegado con límites es el siguiente paso, y lo diremos como
  tal.
- **¿Regulación en Argentina?** Backed no restringe Argentina. Camalote no
  custodia ni intermedia: el usuario firma cada operación. Sin rampas fiat.
- **¿Y si Jupiter apaga Ultra?** El flujo es orden, firma, ejecución; se
  cambia el proveedor de la orden sin tocar el producto.

## Bounty tracks (en inglés, listos para pegar)

**Best Use of PreStocks.** Camalote makes pre-IPO exposure a habit instead
of a trade: "20% of every payment I get goes to SpaceX", bought on its own
from USDC that already sits on Solana, with no broker. All eight PreStocks
tokens are in the catalog (Token-2022, 9 decimals, the issuer's 1% transfer
fee shown on the ticket). The app reads prestocks.com/api on the server,
shows the reference value next to the token price on the picker, the ticket
and the portfolio ("PreStocks reference: $995 · the token is +14.5%"), and
the rule won't buy while the premium is above 5%: the user keeps
accumulating and the app says why it's waiting. Value to the ecosystem:
recurring, price-aware demand from people who get paid in USDC, and honest
disclosure (no rights, no dividends, transfer fee, drift) inside the product.

**Best Use of Pyth Market Data.** Pyth's feed metadata for SPY, QQQ, AAPL,
NVDA and TSLA (`market_hours`: is_open, next_open, next_close) decides when
the rule buys. Tokenized stocks trade 24/7 but drift from the underlying
when Wall Street is closed, so by default Camalote waits for the open and
tells the user "Waiting for Wall Street to open (Tuesday 10:30)"; buying and
selling by hand show the same status. Honest note: since August 26, 2026
Hermes price updates require an API key and equities need Pyth Pro, so the
price comparison against the underlying is not built; the market-hours
data is what Pyth publishes freely, and it's central to when the rule acts.

## Evidencia (para el pitch)

- Ningún proyecto de los 5.400 de Colosseum invierte al recibir un pago;
  los cercanos son SIPs por calendario (siphere, qist-1). myfye-1 (Breakout
  2025, ganador) validó "el Robinhood de mercados emergentes" con Privy.
- La case study oficial de Solana sobre xStocks (solana.com/news/case-study-xstocks,
  datos al 19 de enero de 2026): 3.000 millones de volumen en cadena, 57.000
  tenedores, 196 millones en xStocks y el 93 % de ese valor en Solana. Y el
  cliente que describe es el nuestro: "no residentes de EE. UU., mercados
  emergentes, gente sin cuenta de broker".
- Actualización: cerca del 95 % del volumen mundial de acciones tokenizadas,
  4.900 millones en el primer semestre de 2026, 300.000+ tenedores (KuCoin
  News, sep-2026).
- Los dividendos de xStocks se reinvierten por el multiplicador del token
  (Scaled UI Amount). Al 2026-09-12: SPYx 1,0057, AAPLx 1,0033, QQQx 1,0027,
  NVDAx 1,0017, TSLAx 1. Camalote lo lee del mint y lo muestra.
- Bitso lanzó xStocks en Argentina (custodial, sin retiro). Backed no
  restringe Argentina; Bybit sí.
- Argentina: 94 % del volumen cripto en pesos es stablecoin (a16z, ago-2026).
- Jupiter Ultra: modo sin gas para takers sin SOL, probado el 2026-09-11
  con una orden de 10 USDC a SPYx (feeBps 200, cuenta nueva).
- Jupiter Ultra: cambio USDC → SOL sin gas desde 1 USDC (feeBps 2), probado
  el 2026-09-15 en dos rondas de 1 a 5 USDC. Es lo que carga la reserva.
- PreStocks (2026-09-21): ocho tokens Token-2022 verificados en Jupiter,
  liquidez en Meteora DLMM de 113.000 a 776.000 USD, compra sin gas de 10
  USDC armada para SpaceX, OpenAI y Anthropic. Distancia a la referencia
  ese día: OpenAI +14,5 %, Neuralink +25 %, SpaceX −23 %, Kalshi −3 %.
  SpaceX tiene multiplicador ×5 en la cadena (cantidad visible = cruda × 5).
- Pyth (2026-09-21): `price_feeds` sigue siendo público y trae
  `market_hours` por acción; `updates/price/latest` devuelve 401 desde la
  actualización del 26 de agosto de 2026. Plan gratis sin API; acciones
  solo en Pro (2.500 USD por mes).
- Jupiter Price v3 dejó de mandar `usdPricePrescaled` (null el 2026-09-21):
  el precio por unidad cruda se calcula como precio visible × multiplicador.
