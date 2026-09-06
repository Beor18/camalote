# Camalote: paquete de submission (Colosseum)

Preparado el 2026-09-06 con datos de Colosseum Copilot, The Grid y web.
Dos vías, las dos desde tu cuenta de Arena (colosseum.com/arena):

1. **Eternal sprint (hoy mismo)**: apretás el cronómetro y tenés 4 semanas.
   Los ganadores entran a la consideración del acelerador junto con los del
   hackathon. No hay que esperar a nadie.
2. **Hackathon de otoño: 28 de septiembre al 2 de noviembre de 2026.** Sin
   tracks. 30.000 al Grand Champion, 10.000 a los siguientes 20, 10.000 al
   mejor proyecto de bienes públicos, y hasta 10 ganadores con 250.000 de
   pre-seed del acelerador (así fue en Frontier, abril-mayo 2026).

Registrate ya en las dos. El código de Camalote ya existe: lo que se juzga es
el producto y el progreso durante el sprint.

## Campos del formulario (en inglés, listos para pegar)

**Project name**: Camalote

**One-liner** (100 caracteres):
Get paid in dollars from anywhere: a payment link, an email, and native USDC lands on Solana.

**Description**:

Camalote is the payment link for people who get paid in dollars but live
outside the banking system that moves them: freelancers, creators and gig
workers in Argentina and Latin America.

You create a link with an amount and a concept, and share it on WhatsApp.
Whoever pays signs in with their email, tops up USDC on Base if they need to
(free from Coinbase), and pays in one sponsored operation. The USDC arrive as
native USDC in the payee's Solana account, gas-free on both sides, in under a
minute. The payer sends exactly the number on the link, no surcharges; the fee
(0.45%, capped at 50 cents) comes out of what arrives, and the payee sees that
number before sharing the link.

What makes it different: the payer doesn't need an account at all. Every
payment link also carries the payee's own **Base wallet address** (the
embedded wallet Camalote already gives them). Send USDC there from Coinbase or
any wallet, with no sign-up, and when the payee opens Camalote the app moves
it to their Solana account on its own. Nothing in between and nothing
custodial: it's the payee's wallet from the first second.

Under the hood, every payment is a Circle CCTP v2 fast transfer from Base to
Solana: burn on Base inside a Coinbase-Paymaster-sponsored smart wallet
operation, Circle attestation, and a mint on Solana executed by our relayer,
which also creates the payee's USDC token account when it doesn't exist.
`destinationCaller` is zero, so anyone can complete a delivery if our relayer
disappears: funds are never stuck. No wrapped tokens, no third-party bridge,
no seed phrases, no SOL, no ETH.

Why this and why now: 94% of Argentina's peso crypto volume is already
stablecoins (a16z, Aug 2026). Solana moved $650B in stablecoins in a single
month (Feb 2026). USDC payments to Argentine contractors grew 289% YoY at
their peak. And yet every existing way to move USDC into Solana (Phantom,
Relay, deBridge, Mayan, Circle's own bridge) assumes you already have a
self-custodied wallet with gas on the source chain. Camalote assumes you have
an email.

Growth is built into the product: every "Paid!" screen ends with "Create your
own payment link". Every payer is tomorrow's payee. No ad budget needed.

Roadmap for the sprint: mainnet launch with Coinbase Paymaster on Base, card
and Apple Pay for payers without crypto (Coinbase Onramp delivering straight
into the payee's Base wallet), and a "Fund with Base" embeddable widget for
Solana apps (the Mayan playbook).

**Country**: Argentina

**Links**:
- Repo: https://github.com/Beor18/camalote
- Live demo: (Vercel, modo demo: sin claves, misma UX) → completar
- Demo video: (YouTube, 2 a 3 minutos) → completar
- Technical demo: mismo video o loom del flujo en testnet

**Team**: Fernando (Beor18). Solo founder. Built tuneport.xyz (indie music on
Base with email login). Lives the LatAm corridor from Corrientes, Argentina.

## Guion del video (2:30, en inglés; abajo la versión en castellano)

0:00 Cold open on the phone. "This is Fer, a designer in Corrientes,
Argentina. A client in the US owes him 40 dollars. Watch."
0:08 Fer opens Camalote, taps "Get paid", types 40, "Logo design", taps
"Create payment link". Link and QR appear. He shares it on WhatsApp.
0:25 Cut to the client's phone. Opens the link: "Fer is asking you for 40
USDC. Logo design." Taps "Pay with my email". Enters the email code.
0:40 "The client has USDC on Coinbase, like most people in the US. He tops
up his Base address for free." Deposit modal with QR. Balance appears.
0:55 The quote: "Fer receives 40.00. Fee 0.18. Express delivery under a cent.
Network cost: zero. You pay 40.18." Tap "Pay 40.18 USDC".
1:05 Progress: Leaving Base. Verifying with Circle. Arriving on Solana.
"That was one sponsored operation: approve, fee, and a Circle CCTP v2 burn.
Circle attests it. Our relayer mints native USDC into Fer's Solana account,
creating the account if needed. Nobody paid gas."
1:30 "Paid!" And the last screen: "Do you get paid in dollars too? Create
your link." "That's how Camalote grows: every payer becomes a payee."
1:40 Back to Fer's phone: the link flips to "Paid", balance goes from 12.34
to 52.34. "Exactly 40. Not 39.80."
1:50 Why Solana, in one breath: sub-second, sub-cent, $650B in stablecoins a
month, and where Argentina's community already builds.
2:05 The data: bridges don't win hackathons; payment rails for emerging
markets do (Colosseum Copilot, 5,400 projects). 94% of Argentina's crypto
volume is stablecoins. No incumbent serves the email-only user.
2:20 Close: "Camalote. Get paid in dollars from anywhere. Made in Argentina."

Versión en castellano (para grabar el audio si preferís):
"Este es Fer, diseñador en Corrientes. Un cliente en Estados Unidos le debe
40 dólares. Mirá." → crea el link → "El cliente abre el link, entra con su
email, carga USDC desde Coinbase gratis" → "Fer recibe 40,00. Comisión 0,18.
Gas cero. Pagás 40,18." → "Saliendo de Base. Circle certifica. Llegando a
Solana. Una sola operación patrocinada. Nadie pagó gas." → "¡Pagado! ¿Vos
también cobrás en dólares? Creá tu link." → "El link de Fer pasa a Pagado.
Llegaron 40 exactos." → "Camalote. Cobrá en dólares desde cualquier lado.
Hecho en Argentina."

Recursos para grabar: `node scripts/demo-video.mjs <carpeta>` graba el
recorrido en demo a 390x844 y deja un MP4; pegale la voz encima con
cualquier editor, o grabá la pantalla de tu teléfono con la PWA instalada.

## Preguntas que van a hacer los jurados (y las respuestas)

- **¿Esto no es un bridge?** El bridge es el motor, no el producto. El
  producto es el link de cobro y el usuario que solo tiene un email. Ningún
  bridge existente lo atiende.
- **¿Por qué no Coinbase directo?** Coinbase retira a Solana gratis, pero
  exige cuenta y KYC en las dos puntas y custodia. Camalote es self-custody,
  sin KYC, hacia cualquier dirección de Solana, y funciona para el que paga
  desde cualquier billetera de Base.
- **¿Y si Circle lo hace?** Circle tiene Programmable Wallets y Gateway.
  Nuestra ventaja es la distribución: español primero, WhatsApp primero, y
  el loop pagador → cobrador. Somos el "vehículo" sobre su "ruta".
- **¿Qué tiene de distinto de mandar USDC a Lemon o belo?** Que el que paga
  no se registra en nada y el que cobra no necesita un exchange ni
  verificación: la plata cae en su propia billetera y pasa sola a Solana. Y
  el link le dice al cliente cuánto y por qué.
- **¿Cómo ganan plata?** 0,45 % con tope de 0,50 por cobro, descontado de lo
  que llega y a la vista en el link y en la landing. El que paga nunca ve un
  recargo. El bridge solo no es negocio; el negocio es el volumen de cobros
  recurrentes y, después, el widget "Fondeá con Base" para apps de Solana.
- **¿Regulación?** Sin rampas fiat. Self-custody, no tocamos fondos. En
  Argentina el registro PSAV aplica a custodia e intermediación; un relayer
  no custodial es zona gris que vamos a consultar antes de mainnet.
- **¿Riesgo del relayer?** `destinationCaller` en cero: cualquiera completa
  la entrega. Los fondos nunca quedan atrapados.

## Plan de GTM sin presupuesto (primeras 4 semanas)

1. **Día 1**: Eternal sprint iniciado. Repo público. Deploy en Vercel en modo
   demo (URL para compartir sin claves).
2. **Semana 1**: testnet real de punta a punta con dos cuentas; video; hilo
   en X y Farcaster: "Cobrá en dólares desde cualquier lado" con el video.
   Post en Superteam Argentina y en el Discord de Base.
3. **Semana 2**: 10 freelancers argentinos usando links reales (mainnet con
   Paymaster de CDP). Cada uno trae a su cliente: el loop arranca.
4. **Semana 3**: widget "Fondeá con Base" para una app de Solana amiga
   (onboarding de sus usuarios desde Coinbase). Caso de estudio.
5. **Semana 4**: submission al hackathon de otoño con métricas reales: links
   creados, cobros completados, volumen, países.

## Evidencia (para el pitch)

- Cluster "Stablecoin Payment Rails" de Colosseum: 202 proyectos, 20
  ganadores (9,9 % contra 5,8 % del corpus).
- Ganadores cercanos: LocalPay (3° Stablecoins, Breakout abr-2025), DOLLAR y
  Amp Pay (menciones, Breakout), Bando (mención Payments, Radar sep-2024).
- Bridges sin premio: ValueRouter, Solana Bridge Bot, Lunarys, Omnivault.
- Argentina: 94 % del volumen en pesos es stablecoin (a16z, ago-2026).
- Solana: 650 mil millones en stablecoins en feb-2026 (Everstake).
- Phantom: 0,85 % de fee, 1,5 % sin gas. deBridge: 0,50 fijo más spread.
- Grid: 103 productos de bridge/cross-chain con tag Solana en 85 roots.
  Ninguno con login por email.
