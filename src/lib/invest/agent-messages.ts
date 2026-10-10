import { assetName, isDollars, kindOf } from "@/lib/invest/catalog";
import { formatUsdc } from "@/lib/format";

/**
 * Lo que el agente le cuenta al usuario, en frases cortas y sin jerga. Es el
 * plan B cuando el modelo de IA no responde, y lo que usa el modo demo.
 * Mismo tono que la app: voseo, una idea por frase, nada de "—".
 */

export type Lang = "es" | "en";

/** El mismo mensaje en los dos idiomas: la bitácora se lee en el idioma de la app. */
export type Messages = Record<Lang, string>;

export function inBothLangs(write: (lang: Lang) => string): Messages {
  return { es: write("es"), en: write("en") };
}

/**
 * Lo que muestra la bitácora: el mensaje en el idioma de la app si se guardó
 * en los dos; si no (lo escribió la IA, en el idioma de la cuenta), tal cual.
 */
export function eventText(event: { message: string; messages?: Partial<Messages> | null }, lang: Lang): string {
  return event.messages?.[lang] ?? event.message;
}

const usd = (units: bigint, lang: Lang) => formatUsdc(units, 2, lang);

export function setAsideMessage(
  o: { receivedUnits: bigint; setAsideUnits: bigint; pendingUnits: bigint; goalName?: string },
  lang: Lang
): string {
  if (lang === "es") {
    const where = o.goalName ? ` para ${o.goalName}` : "";
    return `Te llegaron ${usd(o.receivedUnits, lang)} USDC. Aparté ${usd(o.setAsideUnits, lang)}${where}. Ya junté ${usd(o.pendingUnits, lang)} de 10 para la próxima compra.`;
  }
  const where = o.goalName ? ` for ${o.goalName}` : "";
  return `You got ${usd(o.receivedUnits, lang)} USDC. I set aside ${usd(o.setAsideUnits, lang)}${where}. ${usd(o.pendingUnits, lang)} of 10 saved for the next buy.`;
}

/**
 * Qué compró y por qué: lo apartado llegó al mínimo y, si es una acción y
 * se sabe, Wall Street está abierto.
 */
export function boughtMessage(
  o: { usdcUnits: bigint; asset: string; goalName?: string; marketOpen?: boolean },
  lang: Lang
): string {
  const name = assetName(o.asset, lang);
  const dollars = isDollars(o.asset);
  const open = o.marketOpen === true && kindOf(o.asset) === "stock";
  if (lang === "es") {
    const why = open ? "Lo apartado llegó a 10 USDC y Wall Street está abierto" : "Lo apartado llegó a 10 USDC";
    const what = dollars
      ? `puse ${usd(o.usdcUnits, lang)} USDC a rendir en dólares`
      : `compré ${usd(o.usdcUnits, lang)} USDC de ${name}`;
    const goal = o.goalName ? ` para ${o.goalName}` : "";
    return `${why}, así que ${what}${goal}.`;
  }
  const why = open ? "What you set aside reached 10 USDC and Wall Street is open" : "What you set aside reached 10 USDC";
  const what = dollars
    ? `I put ${usd(o.usdcUnits, lang)} USDC to earn in dollars`
    : `I bought ${usd(o.usdcUnits, lang)} USDC of ${name}`;
  const goal = o.goalName ? ` for ${o.goalName}` : "";
  return `${why}, so ${what}${goal}.`;
}

export function waitingMarketMessage(o: { asset: string; nextOpen: string | null }, lang: Lang): string {
  const name = assetName(o.asset, lang);
  if (lang === "es") {
    return o.nextOpen
      ? `Wall Street está cerrado. Compro ${name} cuando abra, ${o.nextOpen}.`
      : `Wall Street está cerrado. Compro ${name} cuando abra.`;
  }
  return o.nextOpen
    ? `Wall Street is closed. I'll buy ${name} when it opens, ${o.nextOpen}.`
    : `Wall Street is closed. I'll buy ${name} when it opens.`;
}

export function waitingPremiumMessage(o: { asset: string; premium: string }, lang: Lang): string {
  const name = assetName(o.asset, lang);
  return lang === "es"
    ? `${name} está ${o.premium} arriba de su referencia. Espero a que baje para comprar.`
    : `${name} is ${o.premium} above its reference. I'll wait for it to come down.`;
}

export function waitingEligibilityMessage(lang: Lang): string {
  return lang === "es"
    ? "Tu parte está lista para invertir. Antes, confirmá en la app que podés invertir desde donde vivís."
    : "Your share is ready to invest. First, confirm in the app that you can invest from where you live.";
}

export function waitingBalanceMessage(lang: Lang): string {
  return lang === "es"
    ? "Lo apartado está listo, pero el saldo no alcanza todavía. Compro con el próximo cobro."
    : "What I set aside is ready, but the balance isn't enough yet. I'll buy with the next payment.";
}

export function errorMessage(lang: Lang): string {
  return lang === "es"
    ? "No pude completar la compra. Lo apartado sigue guardado y pruebo de nuevo en 10 minutos."
    : "I couldn't finish the buy. What I set aside is still saved and I'll try again in 10 minutes.";
}

export function enabledMessage(lang: Lang): string {
  return lang === "es"
    ? "Listo, ya estoy a cargo. Cuando te paguen, aparto tu parte y compro."
    : "Done, I'm on it. When you get paid, I set aside your share and buy.";
}

export function disabledMessage(lang: Lang): string {
  return lang === "es"
    ? "Me apagaste. Ya no puedo firmar nada por vos."
    : "You turned me off. I can't sign anything for you anymore.";
}
