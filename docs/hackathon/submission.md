# Camalote: paquete de submission

Actualizado el 2026-09-12: Camalote es Invertir. Dos eventos, en este orden:

1. **Stocklana** (Solana Foundation, hackathons.solana.com/hackathons/stocklana):
   100.000 en premios, cierra el **viernes 18 de septiembre de 2026 a las
   16:00 ET**, judging hasta el 2 de octubre. Categoría: **Investing**
   (compras recurrentes, carteras automáticas). Criterio: "¿esto puede ser
   una app real que la gente use?". Hace falta al menos un link (GitHub,
   demo o video).
2. **Crypto World's Fair** (Colosseum, colosseum.com/worldsfair): del 14 de
   septiembre al 12 de octubre de 2026. Tracks y premios se publican el 14.
   Camalote va a la pista de Solana.

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
QQQx, AAPLx, NVDAx, TSLAx) through Jupiter Ultra in gasless mode and leaves
it in your own account. No broker, no SOL, no seed phrase.

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
Camalote's account, network paid by our relayer). No subscription, no
hidden spread. Honest numbers: a user investing 200 dollars a month pays
about 0.90 a month; this is a volume business.

Honest about the limits, in the app itself: xStocks carry Backed's
permanent delegate, they aren't available to US/UK/CA/AU residents, prices
go up and down, and the rule runs while the app is open (it buys when you
open it if USDC landed meanwhile).

**Links**: repo https://github.com/Beor18/camalote · demo (Vercel, demo mode)
→ completar · video → completar.

**Tech**: Next.js 16, Privy (email login, embedded Solana wallet), Jupiter
Ultra (gasless swaps, buy and sell) and Price API, Token-2022 (xStocks:
amounts shown with the Scaled UI Amount multiplier, dividends derived from
it), a small Solana relayer that co-signs fee and withdrawal transfers.

**Country**: Argentina

**Team**: Fernando (Beor18). Solo founder. Built tuneport.xyz (indie music
on Base with email login). Lives the LatAm freelancer reality from
Corrientes, Argentina.

## Guion del video (55 s, castellano)

0:00 Landing: "Cobrás en dólares. ¿Cuánto te quedó el mes pasado?"
0:06 Fer entra con su email. Su cuenta de Solana aparece: 12,34 USDC.
0:12 Arma la regla: 30 %, S&P 500. "Cuando esa parte junta 10 USDC, se
     compra sola."
0:22 Le llegan 40 USDC (un cliente le pagó). Sin tocar nada, la compra
     aparece: 0,0154 SPYx por 12 USDC, comisión de Camalote 0,05.
0:38 La cartera: vale hoy, puesto, rendimiento. La operación con su
     comprobante.
0:50 "Que la próxima vez que cobres, una parte ya esté invertida."

Grabar: `node scripts/demo-video.mjs docs/demo` (dev server en demo, :3001).

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
