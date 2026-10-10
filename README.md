# Camalote 🌿

**Camalote is an AI agent that invests your share of every USDC payment
the moment it lands, before you spend it. You set one rule, once; it works
for you inside that limit, in your own non-custodial Solana account.**

- Live app, Solana mainnet: [camalote.vercel.app](https://camalote.vercel.app)
- Colosseum Crypto World's Fair, Superteam Argentina track:
  [colosseum.com/arena/projects/camalote](https://colosseum.com/arena/projects/camalote)
- Live numbers: [camalote.vercel.app/stats](https://camalote.vercel.app/stats)
  (raw JSON: [`/api/stats`](https://camalote.vercel.app/api/stats))

## The problem

You get paid in USDC, but not on a schedule. The plan is to invest whatever
is left at the end of the month, and nothing is ever left: rent on the 5th,
the card on the 12th, zero invested on the 30th.

The problem isn't the money, it's the moment. The only time there is always
money is when it lands. Investing apps wait for you to remember; monthly
plans assume a salary. Freelancers get paid when they get paid.

In Argentina, 52% of freelancers working for clients abroad already get
paid in USDC (30%) or USDT (22%) ([sources](#sources)). We start there.

## What Camalote does

1. **One rule, set once.** Three questions, one per screen: what share
   (5 to 50%), what for (a goal with a name: "the trip, 300") and where:
   - 21 US stocks and ETFs, tokenized (xStocks): S&P 500, Nasdaq 100,
     Apple, Nvidia, Microsoft, gold and more.
   - 8 companies before their IPO (PreStocks): SpaceX, OpenAI, Anthropic
     and others, with their risks stated in the app.
   - Dollars that earn: US Treasuries (USDY) or secured loans (Jupiter
     Lend), with today's rate.
2. **Your rule decides what and how much; your AI agent decides when, and
   tells you.** USDC lands and your rule's share is set aside within
   seconds. Once it adds up to 10 USDC, the agent decides whether to invest
   now or wait, invests it in your own account and tells you why. Small
   payments add up.
3. **You see where it is.** The goal fills with every payment ("about 6
   more payments like the last one"), the portfolio shows today's value,
   the dividends xStocks reinvested for you, and a Solscan receipt for
   every operation. Buy and sell by hand too; selling is free.

Sign in with Google or email (embedded Solana wallet), or with Phantom.
Load USDC from Phantom and withdraw back to it.

## The AI agent

Your rule decides what and how much; the AI agent decides when, and tells
you. You turn it on once. Within seconds of a payment, code sets your
rule's share aside, with no AI involved. Once it adds up to 10 USDC, the
agent decides whether to invest now or wait, invests inside your rule, and
tells you in plain words what it did and why ("What you set aside reached
10 USDC and Wall Street is open, so I bought 12 USDC of S&P 500 for The
trip"). It writes in the language of your app, and "Your agent" shows
everything it did and who decided each step.

| Step | Who | The limit |
| --- | --- | --- |
| Notice the payment and set your share aside | Code, from your rule, within seconds | The share is the one in your rule |
| Decide whether to invest now or wait (Wall Street closed, a pre-IPO premium too high) | The AI agent | It waits 6 hours at most; code checks market hours, premium and balance first |
| Invest | The agent's signer | Only in the asset of your rule, only what was set aside, inside a limited permission |
| Tell you what it did and why | The AI agent | It never gives investment advice or changes your rule |

The model is gpt-oss-120b, with other models as fallback. If no model
answers, the rule keeps running on its own: your money never depends on the
model being up ([`brain.ts`](src/lib/server/agent/brain.ts)).

### Talk to your agent

"Talk to your agent" opens a chat in the app. The agent answers with the
real state of your account (rule, goal, balance, portfolio, today's prices
and yields, recent operations, what it did) and acts with tools when you
ask:

| You say | The agent |
| --- | --- |
| "How much is left for the trip?" | Answers from your goal's real numbers |
| "Raise my rule to 30% and switch it to Nvidia", "Pause my rule" | Changes the rule right away, with **Undo** |
| "New goal: the bike, 1,500 by March" | Sets the goal (same name keeps what you saved) |
| "Buy 20 of Apple", "Sell my S&P 500" | Leaves the buy or sale ready in the usual sheet: **you review and confirm** |
| "Check if I got paid", "Turn off my agent" | Runs now, or shows the button to turn it off |
| "Send everything to my Phantom" | Says no: it can't withdraw; that's the Withdraw button |

Every tool argument is validated on the server against your account
(allowed percents, catalog assets, balance, holdings) before anything
reaches the app ([`agent-chat.ts`](src/lib/invest/agent-chat.ts)). Rule
changes are saved through the same path as the rule sheet. If the model
returns something unusable, the server asks it to write the reply again;
the actions it already took are not repeated
([`chat.ts`](src/lib/server/agent/chat.ts)). The chat needs your Privy
session and is rate limited.

## How it uses Solana

```
You get paid (USDC lands in your wallet)
  │
  ├─ Helius webhook (seconds) ── backup: /api/agent/tick, from any cron
  ▼
runAgent(): new payments → set your % aside → at 10 USDC:
  code checks market hours / premium / balance
  AI agent: invest now or wait (no answer → the rule runs alone)
  network: your own SOL if it covers it, else 1 USDC → SOL (gasless)
  first buy of an asset: open its token account with that SOL
  Jupiter Ultra order: USDC → xStocks / PreStocks / USDY / jlUSDC
  verify: allowed programs only + simulation (spends ≤ set-aside, lands in your account)
  Privy session signer signs, inside the user's policy
  0.45% fee: USDC transfer to Camalote, capped at 0.50
  log to agent_events → "Your agent" in the app tells you what it did
  ▼
Tokens in your own account · portfolio read from the chain
```

- **USDC** (SPL) payments land in the user's own embedded wallet (Privy).
- **xStocks** are Token-2022 with the Scaled UI Amount extension: dividends
  are reinvested by raising the mint's multiplier. Camalote reads it
  on-chain and shows "dividends reinvested" since you bought.
- **PreStocks** are Token-2022 with a 1% transfer fee. The rule won't buy
  while the token trades more than 5% above the issuer's reference value.
- **Pyth** feed metadata tells whether Wall Street is open; by default the
  rule waits for the open, when the token tracks the stock best.
- **Jupiter Ultra** builds every buy and sell; **Jupiter Lend** and Ondo's
  **USDY** are the two "dollars that earn".
- **Network fees** come from a small SOL reserve in the user's account,
  loaded with 1 USDC when it runs low. No relayer, no custody.

## Security model

- **Non-custodial.** Each user has their own Solana wallet. Camalote never
  holds user funds.
- **The agent's permission** is a Privy session signer the user turns on
  (and off) in the app. Its policy, checked by Privy before every signature
  ([`agent-setup.mjs`](scripts/agent-setup.mjs)):
  - only the programs our buys use: Compute Budget, Associated Token
    Account, Jupiter (JUP6), JupiterZ and DFlow;
  - from the token program, only closing an account (unwrapping SOL);
  - a USDC transfer only to Camalote's fee account, at most 0.50 USDC;
  - nothing else: no withdrawals, no transfers to other accounts.
- **Before signing**, the server checks the programs again and **simulates**
  the order: it must spend at most what was set aside and the bought
  tokens must land in the user's account ([`verify.ts`](src/lib/server/agent/verify.ts)).
  The policy can't see inside a Jupiter route; the simulation can.
- **Proof, from the circuit test.** Jupiter is mocked to return an "order"
  that sends SOL to a stranger through the System Program. The server
  rejects it before signing: Privy's signer is never called, nothing is
  sent to Jupiter, the 10 USDC set aside stay saved and the rule pauses.

  ```
  $ npx vitest run src/test/agent-circuit.test.ts -t "no es una compra" --reporter=verbose

  stderr | src/test/agent-circuit.test.ts > el circuito completo: lo que el agente no hace > si Jupiter arma algo que no es una compra, no firma: lo apartado queda guardado y se pausa
  [agent] orden rechazada, no se firma: La orden usa un programa no permitido (11111111111111111111111111111111).

   ✓ src/test/agent-circuit.test.ts > el circuito completo: lo que el agente no hace > si Jupiter arma algo que no es una compra, no firma: lo apartado queda guardado y se pausa 23ms

   Test Files  1 passed (1)
        Tests  1 passed | 10 skipped (11)
  ```

  The server log, in English: "order rejected, not signed: the order uses
  a program that isn't allowed (11111111111111111111111111111111, the
  System Program)". The same line shows up in the production logs whenever
  an order fails the check.
- **One lock per account** in the database prevents double buys when two
  notifications arrive together.
- **The chat never moves money.** Buys and sales from the chat open the
  same ticket as a manual buy, with the fee shown, and the user confirms
  with their own wallet.
- **Known limit, stated plainly:** the permission is enforced by Privy's
  policy engine and our simulation, not by a Solana program. An SPL
  `approve` wouldn't help here, because the signer acts as the wallet
  itself. Making it verifiable on-chain needs our own program (a vault that
  can only swap into allowed mints for its owner). That is next, after the
  hackathon.
- **Issuer risks**, shown in the app before buying: xStocks carry Backed's
  permanent delegate and aren't available to residents of the US, UK,
  Canada and Australia; PreStocks give no shareholder rights; USDY is for
  people outside the US.
- No secrets in the repo; Supabase tables have RLS on with no policies (the
  public key reads nothing); the browser only talks to the database through
  `/api/account/state`, which verifies the Privy token.

## Regulation and jurisdictions

Camalote is non-custodial: each user holds their own wallet and Camalote
never holds funds. It executes the rule the user sets on third-party
protocols and doesn't recommend assets. Each asset has its issuer, and
each issuer excludes some countries (checked on 2026-10-06):

| Asset | Issuer | Not available in |
| --- | --- | --- |
| US stocks and ETFs (xStocks) | Backed | United States, United Kingdom, Canada, Australia and prohibited regions ([Kraken support](https://support.kraken.com/gb/articles/xstocks-availability), [xStocks legal overview](https://docs.xstocks.fi/docs/product-legal-overview)) |
| Pre-IPO companies (PreStocks) | PreStocks | United States, China (mainland), Singapore, Russia, Ukraine, Venezuela, Panama, Nicaragua and the rest of its list, plus sanctioned jurisdictions ([terms, updated 2026-09-08](https://prestocks.notion.site/terms-of-service)) |
| US Treasuries (USDY) | Ondo | United States, Canada and sanctioned jurisdictions; only qualified investors in Brazil, the EEA, the UK, Switzerland, Hong Kong, Singapore and Malaysia ([eligibility](https://docs.ondo.finance/general-access-products/usdy/eligibility)) |
| Secured loans (jlUSDC) | Jupiter Lend | United States, China, Singapore and sanctioned jurisdictions ([terms](https://station.jup.ag/docs/legal/terms-of-use)) |

**Argentina is not excluded by any of them.** Before the first investment,
the user confirms they're not a US citizen or resident and don't live in a
country excluded for what they choose (turning the rule on, or opening a
buy). Without that confirmation nothing is invested: the rule keeps setting
the share aside, the server agent doesn't buy and says why, and manual buys
don't open ([`eligibility.ts`](src/lib/invest/eligibility.ts)). It's an
attestation, not an IP block, so judges abroad can still try the app. Open
question: whether automatically executing the user's own rule requires
registration with Argentina's CNV (as a PSAV); a legal opinion is the first
thing we would fund.

## Status (2026-10-09)

- **Live on Solana mainnet**: [camalote.vercel.app](https://camalote.vercel.app);
  [`/api/health`](https://camalote.vercel.app/api/health) checks every
  dependency.
- **Numbers on 2026-10-09**, live at [`/stats`](https://camalote.vercel.app/stats):
  7 accounts, 3 rules on, 2 agents on and 4.28 USDC invested, in two buys
  of the S&P 500, each with its Solscan link. Rule buys: none yet. The
  first 20 users come one by one from Superteam Argentina.
- **Not yet on video:** a real payment triggering the automatic buy on
  mainnet. It needs 20 USDC (10 USDC minimum buy at a 50% rule).
- **225 tests** (Vitest) on the rule, goals, fees, guards, yields,
  merges, withdrawals, the stats and the agent's chat tools, plus the
  agent's full circuit end to end
  ([`src/test/agent-circuit.test.ts`](src/test/agent-circuit.test.ts)):
  a payment webhook sets the share aside and buys, the network reserve and
  the new account come first, repeated webhooks buy once, an order with a
  program outside the allow list is never signed, and the agent waits for
  Wall Street hours. Only Solana, Jupiter, Privy, the database and the AI
  are mocked.

## Business model

**0.45% per buy, never more than 50 cents, minimum one cent.** Taken from
what is invested and shown before you confirm. 0.10% for dollars that earn.
Selling is free. No subscription, no hidden spread.

| Buy | Fee | Effective |
| --- | --- | --- |
| $10 | $0.045 | 0.45% |
| $50 | $0.225 | 0.45% |
| $120 | $0.50 (cap) | 0.42% |
| $500 | $0.50 (cap) | 0.10% |

Honest numbers: a user investing 200 dollars a month in buys of 50 pays
0.90 a month. Per user that's small; scale comes from platforms that
already pay in USDC (bounties, payroll, marketplaces) offering the rule to
their users, with the fee shared. Not validated yet.

## Built during the hackathon

The hackathon started on 2026-09-14. More than two thirds of the commits
are from then on: from `ee2ba64` (Sep 15) to today, all of it in
[one diff](https://github.com/Beor18/camalote/compare/5016666...main)
(`git log --since=2026-09-14 --oneline`).

Before (Aug 28 to Sep 13): a USDC payment link bridged from Base by CCTP,
then the pivot to investing on Sep 12 (the rule, xStocks, buys through
Jupiter Ultra, dividends from the multiplier).

During:

- **Sep 15** Mainnet only; the user pays the network from a SOL reserve,
  no relayer.
- **Sep 21** Pre-IPO companies (PreStocks) with the premium guard, and Wall
  Street hours from Pyth.
- **Sep 26 to 29** Goals with a name; English by default; dollars that earn;
  one clear action on screen (welcome, the rule in three steps).
- **Oct 2 to 5** Rule and operations in Supabase; the server-side agent
  (Helius webhook, Privy session signer with policy, simulation before
  signing, AI with fallbacks); mobile-first app; sign in with Google or
  Phantom, load from and withdraw to Phantom.
- **Oct 6** 21 stocks with search, two "dollars that earn" options with
  live rates, a live traction counter, and "Talk to your agent": a chat
  where the AI agent answers with your real numbers and acts with tools.
- Pitch deck (`docs/hackathon/pitch/`), landing and demo videos.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

**With no keys it runs in demo mode**: same screens, real Jupiter prices,
everything else simulated, and a button to simulate a payment. To force it
even with keys: `NEXT_PUBLIC_DEMO_MODE=true`. Production is not in demo
mode.

```bash
pnpm test         # unit tests
pnpm build        # production build
node scripts/e2e-demo.mjs <folder>     # walks the demo with Playwright and takes screenshots
```

To run it for real you need, at minimum: `NEXT_PUBLIC_PRIVY_APP_ID` and
`PRIVY_APP_SECRET` (Solana embedded wallets), `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` (schema in `supabase/migrations/`), and for the
agent `PRIVY_AGENT_AUTH_KEY`, `NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID`,
`NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID` (created by
`node scripts/agent-setup.mjs`), `HELIUS_API_KEY`, `HELIUS_WEBHOOK_ID`,
`HELIUS_WEBHOOK_SECRET` (`node scripts/helius-setup.mjs https://your-domain`)
and `CRON_SECRET`. `GROQ_API_KEY` is optional: without it, the rule decides.
A dedicated `SOLANA_RPC_URL` is recommended.

Minimums: buying by hand from 2 USDC; the rule buys at 10 USDC
(`NEXT_PUBLIC_INVEST_MIN_UNITS`); the SOL reserve takes 1 USDC the first
time (it stays in the account as SOL).

## Sources

| Number | Source |
| --- | --- |
| 390 billion dollars in real stablecoin payments in 2025, more than double 2024 | McKinsey and Artemis Analytics, [Stablecoins find their niche](https://www.mckinsey.com/featured-insights/charts/stablecoins-find-their-niche) and [Stablecoins in payments: what the raw transaction numbers miss](https://www.mckinsey.com/industries/financial-services/our-insights/stablecoins-in-payments-what-the-raw-transaction-numbers-miss) |
| Tokenized stocks on Solana: 4.9 billion dollars in H1 2026, 6x the 775 million of H2 2025 | [Crypto Briefing](https://cryptobriefing.com/solana-tokenized-stocks-volume-surges-h1-2026/) |
| Latin America is about 10% of global crypto volume | Chainalysis, 2025 Geography of Cryptocurrency, via [Crowdfund Insider](https://www.crowdfundinsider.com/?p=254132) |
| 30% of Argentine freelancers are paid in USDC and 22% in USDT; 2,500 dollars a month on average | [iProUP](https://www.iproup.com/empleo/71195-cuantos-freelancers-argentinos-cobran-en-usdc-y-usdt) |
| More than half a million people work from Argentina for clients abroad | [iProfesional](https://www.iprofesional.com/economia/430510-gobierno-javier-milei-busca-captar-dolares-de-profesionales-argentinos-que-trabajan-para-exterior) |

Market sizing in the deck: 390 billion worldwide (TAM); about 39 billion in
Latin America at its ~10% share (SAM, an estimate); Argentina, 500,000
freelancers × 52% paid in stablecoins × 2,500 dollars × 12 months ≈ 7.8
billion dollars a year (SOM).

## Hidden modules

Before the pivot (2026-09-12), Camalote was a USDC payment link bridged
from Base by CCTP v2. That code is still in the repo but hidden; it comes
back with `NEXT_PUBLIC_SHOW_HIDDEN_VIEWS=true`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Privy (auth, embedded
wallets, session signers) · @solana/web3.js and spl-token (Token-2022) ·
Jupiter Ultra, Price and Lend APIs · Pyth Hermes (market hours) · Helius
webhooks · Supabase · Groq and Vercel AI Gateway · Vitest · Playwright.
