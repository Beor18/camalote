/**
 * El pitch del video demo, una frase por escena. `demo-video.mjs` genera la
 * voz de cada escena, sostiene la pantalla el tiempo que dura la frase y
 * mezcla todo al final. Los nombres tienen que coincidir con las escenas
 * del script de grabación.
 *
 * "U.S.D.C." con puntos para que la voz lo deletree.
 */
export const PITCH = {
  en: [
    {
      name: "landing",
      text:
        "You get paid in dollars. How much did you keep last month? Camalote is a Solana account that invests part of every payment you receive, on its own.",
    },
    {
      name: "login",
      text:
        "You sign in with your email. That's your Solana account, where U.S.D.C. land from a client, an exchange or a bounty. No seed phrase, no broker.",
    },
    {
      name: "rule",
      text:
        "You set one rule. Thirty percent of whatever comes in goes to the S and P 500. Or to Nvidia. Or to SpaceX and OpenAI before they go public, through PreStocks. For listed stocks, the rule waits for Wall Street to open, using Pyth's market hours.",
    },
    {
      name: "incoming",
      text:
        "A client pays forty U.S.D.C. You don't touch anything. Camalote sets aside the thirty percent and buys the tokenized stock through Jupiter. It stays in your own account.",
    },
    {
      name: "portfolio",
      text: "Your portfolio shows today's value, your return, and the dividends the token reinvested for you.",
    },
    {
      name: "receipt",
      text:
        "Every operation has a receipt on Solscan. The fee is zero point four five percent per purchase, never more than fifty cents, shown before you confirm. Selling is free.",
    },
    {
      name: "closing",
      text: "Next time you get paid, let part of it already be invested. Camalote, on Solana.",
    },
  ],
};

/** Voz de Edge (neural, gratis, pide internet). */
export const VOICES = { en: "en-US-AndrewMultilingualNeural" };
