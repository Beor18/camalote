# Pitch y demo en inglés (2026-10-06)

Después del informe de Superteam Argentina (5/10). El pitch sigue los
bloques que pide el informe (15/15/30/15/20/15/10 s): 236 palabras, 1:50
a un ritmo tranquilo, con lugar para las pausas. Grabalo con tu voz, no
con voz sintética.

## Pitch (máximo 2:00)

| Tramo | Bloque | Qué decís |
| --- | --- | --- |
| 0:00–0:15 | Problem | "I got paid 400 USDC for a job. Rent on the 5th, the card on the 12th. At the end of the month, I had invested zero. Like every month." |
| 0:15–0:30 | Insight | "The problem isn't the money, it's the moment. There's one moment when there's always money: when it lands. Investing apps wait for you to remember." |
| 0:30–1:00 | Product | "Camalote is an AI agent that invests for you. You set one rule, once: thirty percent of every payment, for the trip, in the S&P 500. When a payment lands, your agent sees it within seconds, invests your share in your own wallet and tells you what it did. Its permission has limits: it can only invest what your rule says, never withdraw." |
| 1:00–1:15 | Evidence | "What's real: it's live on Solana mainnet, and every order is simulated before it's signed. What's missing: users. Today that's zero, and this week I'm changing it." |
| 1:15–1:35 | Customer and price | "We start with Argentine freelancers: more than half of those working for clients abroad get paid in USDC or USDT. The first ones, one by one, through Superteam Argentina. We charge 0.45% per buy, capped at 50 cents." |
| 1:35–1:50 | Team | "I'm Fernando, a fullstack developer from Corrientes, and I live this problem. I built the whole circuit, and I'm looking for a cofounder with a finance or regulatory background." |
| 1:50–2:00 | Next milestone | "Next: twenty freelancers with an active rule and their first payment invested on mainnet. Then, the platforms that pay in USDC. Pay yourself first." |

Lo que no se dice nunca: que "nadie lo hace", o números sin fuente
(están en el README).

## Demo (máximo 3:00, apuntá a 2:00)

Regla del informe: en 10 segundos quién es el usuario y qué tarea hace;
después entrada (un cobro), acción (el agente compra) y resultado (el token
en la cuenta y la transacción). Nada de pantallas de configuración.

| Tramo | Pantalla | Qué decís |
| --- | --- | --- |
| 0:00–0:10 | La app abierta, la regla como titular | "This is Ana, a freelancer paid in USDC. Her rule: 30% of every payment goes to the trip, in the S&P 500." |
| 0:10–0:35 | Entra el cobro | "A client pays her. Within seconds, her AI agent sees the payment and sets her share aside." |
| 0:35–1:05 | "Tu agente" cuenta la compra | "It invests her share on its own, and tells her what it did, in plain words." |
| 1:05–1:25 | Cartera y meta | "It's in her own account, toward the trip: how much is in, how many payments to go, today's value." |
| 1:25–2:05 | "Hablale a tu agente": pregunta cuánto falta, pide subir la regla a 30 %, pide comprar 20 de Nvidia | "She can also just talk to her agent. It answers with her real numbers, changes her rule when she asks, and leaves a buy ready for her to confirm." |
| 2:05–2:25 | El comprobante en Solscan | "Every buy has its receipt on Solana. The fee was shown before: never more than 50 cents." |
| 2:25–2:40 | El permiso del agente | "It can only buy what her rule says, never withdraw. And she can turn it off anytime." |

**Si el cobro no es real** (sin plata para la compra en mainnet), la parte
simulada lleva un rótulo fijo en pantalla: "Demo mode: simulated payment.
Mainnet buy pending." El informe lo acepta así; lo que no acepta es
esconderlo. Lo real que sí se puede mostrar sin plata: entrar en
producción, armar la regla, prender el agente, `/api/health` y
`/api/stats` en vivo.

## Slide de riesgo regulatorio (para responder en 20 s)

En el deck es el anexo después del cierre (`#regulacion`), fuera de los
2 minutos. Países verificados el 06/10/2026 en los términos de cada
emisor; los links están en el README, sección "Regulation and
jurisdictions".

**Regulation, plainly.**

1. Non-custodial: each user holds their own account; Camalote never holds or can withdraw the money.
2. The AI agent executes the user's own rule on third-party protocols; it doesn't recommend assets.
3. Each issuer sets its countries: stocks aren't available in the US, UK,
   Canada or Australia; pre-IPO companies, US Treasuries and secured loans
   aren't available in the US either. Argentina isn't excluded by any of
   them, and the app states the restrictions before every buy.

What's missing, said plainly: blocking excluded countries at sign-up, and a
legal opinion on whether executing the rule requires registering as a PSAV
with Argentina's CNV. That's the first thing we fund.

Respuesta hablada: "We're non-custodial and the agent executes the user's
own rule; we don't advise. Each issuer excludes its countries, Argentina
isn't on any list, and the app says so before buying. Whether that needs a
PSAV registration in Argentina, we don't know yet: a legal opinion is the
first thing we'd pay for."

## Convocatoria para t.me/superteamar

> ¡Hola! Soy Fernando, de Corrientes. Estoy construyendo Camalote para el
> Colosseum: cada vez que te pagan en USDC, una parte se invierte sola en
> tu propia cuenta de Solana (S&P 500, Nvidia, SpaceX antes de salir a
> bolsa, o dólares que rinden).
>
> Busco a los primeros 20 que cobren en USDC (bounties o clientes de
> afuera). Dame 10 minutos por llamada y tu próximo cobro se invierte solo.
> Para armar tu regla no tenés que poner plata.
>
> Si te copa, respondeme acá o escribime por privado.
> camalote.vercel.app
