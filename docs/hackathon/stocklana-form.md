# Stocklana: formulario, paso 1 (Project Info)

Pegar tal cual. Contadores del formulario: Short Description hasta 280,
Full Description hasta 5000 (Markdown). Antes de pegar, reemplazar los dos
links marcados con `<...>` al final de la descripción.

## Project Name

Camalote

## Short Description

Pay yourself first. Camalote is a Solana account that turns a share of every USDC payment you receive into tokenized stocks (xStocks) or pre-IPO tokens (PreStocks), on its own, through Jupiter. Email login, no broker, no seed phrase. Built for freelancers paid in USDC.

## Full Description (Markdown)

```markdown
# Camalote

**Pay yourself first.** A Solana account that turns part of every USDC payment you receive into tokenized stocks, on its own.

## The problem

Freelancers in Argentina and Latin America get paid in USDC, but not on a schedule. "I'll invest what's left" never happens, because nothing is left. Calendar DCA assumes a salary. Opening a broker from here means paperwork, minimums and a wire. So the dollars sit in a wallet, or get spent.

## What Camalote does

1. Sign in with your email. You get a Solana account (Privy embedded wallet). No seed phrase.
2. Set one rule: "20% of whatever comes in goes to the S&P 500".
3. Get paid as usual. Every time USDC land, that share is set aside. When it adds up to 10 USDC, Camalote buys the token through Jupiter Ultra and leaves it in your own account.

You also get a portfolio with today's value and your return, the dividends xStocks reinvested for you (read from the Token-2022 Scaled UI Amount multiplier on-chain), buy and sell by hand with price and fees shown before you confirm, a Solscan receipt for every operation, and a rule you can switch off in one tap.

Catalog: xStocks by Backed (SPYx, QQQx, AAPLx, NVDAx, TSLAx) and the eight PreStocks pre-IPO tokens (SpaceX, OpenAI, Anthropic, Kalshi, Neuralink, Anduril, Figure AI, Polymarket).

## Market data decides when the rule acts

- **Pyth market hours.** For listed stocks, Pyth's public feed metadata (`market_hours`) tells the app whether Wall Street is open. Tokenized stocks trade 24/7 but drift from the underlying when the market is closed, so by default the rule waits for the open: "Waiting for Wall Street to open (Tuesday 10:30)". Buying and selling by hand show the same status.
- **PreStocks reference value.** For pre-IPO tokens, the app reads PreStocks' reference price on the server and shows the gap next to the token price on the picker, the ticket and the portfolio ("PreStocks reference: $995 · the token is +14.5%"). The rule refuses to buy while the token trades more than 5% above the reference; it keeps accumulating and says why it's waiting. On September 21, OpenAI was +14% and SpaceX −23%.

## How it works

- Next.js 16, Privy (email login, embedded Solana wallet), mainnet only.
- Jupiter Ultra for buy and sell. The first time, 1 USDC is swapped to SOL gasless by Ultra; that reserve pays the network from then on (under a cent per buy). No relayer, no custody, no program of our own: withdrawals and the fee are plain USDC transfers the user signs and pays.
- Jupiter Price API for portfolio value. Token-2022 multipliers are read from each mint (SpaceX runs ×5 on-chain; amounts are shown as any wallet shows them).

## Business model, in plain sight

0.45% per purchase, capped at 0.50 USDC, taken from the purchase and shown on the ticket. Selling is free. The fee is a USDC transfer to Camalote's account, collected on-chain after the swap succeeds. No subscription, no hidden spread. A user investing 200 dollars a month pays about 0.90 a month. It's a volume business, and the app says so.

## Honest limits, stated in the app

- xStocks carry Backed's permanent delegate and are not available to US/UK/CA/AU residents. Prices go up and down.
- PreStocks tokens carry no rights and no dividends, have a 1% issuer transfer fee, and can drift from the reference.
- The rule runs while the app is open: it buys when you open it if USDC landed meanwhile. A delegated signer with limits is the next step.
- Pyth price updates need an API key since August 26 and equities need Pyth Pro, so the price comparison against the underlying is not built. The market-hours data is what Pyth publishes freely.
- The demo link runs in demo mode: same screens, same steps, simulated balances, real prices. Try the whole flow without funding an account.

## Tracks

Investing (main), Best Use of PreStocks, Best Use of Pyth Market Data.

## Links

- Repo: https://github.com/Beor18/camalote
- Demo: <URL de Vercel>
- Video: <URL del video>
```
