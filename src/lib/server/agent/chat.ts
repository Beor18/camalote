import "server-only";

import { BUY_MIN_UNITS, FEE_BPS, FEE_BPS_DOLLARS, FEE_MAX_UNITS, INVEST_MIN_UNITS } from "@/lib/config";
import { XSTOCKS } from "@/lib/invest/catalog";
import {
  cleanReply,
  looksBroken,
  mergeActions,
  runChatTool,
  type AgentAction,
  type AgentChatReply,
  type ChatTurn,
  type ToolState,
} from "@/lib/invest/agent-chat";
import { PERCENT_OPTIONS } from "@/lib/invest/rules";
import { brainProviders, chat, type ChatMessage } from "@/lib/server/agent/brain";

/**
 * La charla con el agente, del lado del servidor. El modelo recibe el estado
 * real de la cuenta (lo que la app ve) y la charla, y puede usar
 * herramientas. Cada herramienta se valida contra el estado
 * (`runChatTool`); las que cambian la regla vuelven a la app como acción y
 * se guardan por el mismo camino que la hoja de la regla. Comprar y vender
 * nunca se ejecutan acá: quedan listas para que el usuario confirme.
 */

/** Rondas de herramientas por mensaje: pedir, ver el resultado, quizás otra. */
const MAX_TOOL_ROUNDS = 3;
/** Si la respuesta sale rota (JSON, trabada), cuántas veces se le pide que la reescriba. */
const MAX_REWRITES = 2;
const OPTS = { maxTokens: 1200, timeoutMs: { groq: 20_000, gateway: 25_000 } };

const SYMBOLS = XSTOCKS.map((s) => s.symbol);
const usdc = (units: bigint) => Number(units) / 1_000_000;

function catalogLine(): string {
  const kinds = { stock: "acción", preipo: "empresa antes de salir a bolsa", dollars: "dólares que rinden" } as const;
  return XSTOCKS.map((s) => `${s.symbol} = ${s.name}${s.nameEs ? ` / ${s.nameEs}` : ""} (${kinds[s.kind]})`).join("; ");
}

function systemPrompt(lang: "es" | "en"): string {
  const voice =
    lang === "es"
      ? "Los números en castellano llevan coma decimal: 2,15 USDC, nunca 2.15. Respondé en castellano rioplatense, con voseo, como alguien que trabaja para el usuario. Sin jerga cripto: nunca digas wallet, token, swap, on-chain ni DeFi; decí cuenta, acción, comprar, vender, y Phantom por su nombre."
      : "Reply in plain, warm English, as someone who works for the user. No crypto jargon: never say wallet, token, swap, on-chain or DeFi; say account, stock, buy, sell, and Phantom by its name. Name destinations by their English name (US Treasuries, not Bonos del Tesoro).";
  return [
    "Sos el agente de IA de Camalote y trabajás para el usuario, adentro de su app. Tu trabajo de todos los días: cada vez que le pagan en USDC, apartás su parte según su regla y, al juntar el mínimo, la invertís en el destino de su regla. En esta charla, además, respondés sus preguntas y hacés los cambios que te pide.",
    "Te pasan el estado real de su cuenta. Respondé solo con esos datos: nunca inventes números, precios ni fechas. Si un dato no está, decilo.",
    "Para actuar usá las herramientas. Nunca digas que hiciste algo si no llamaste a la herramienta y te devolvió ok. Si devuelve un error, explicá qué pasó y qué se puede hacer.",
    "Comprar y vender nunca lo hacés directo: con proponer_compra o proponer_venta le dejás la operación lista en pantalla y él confirma. Decíselo con naturalidad, por ejemplo: te dejé lista la compra, revisala y confirmá. Para vender no preguntes cuánto: lo elige él en pantalla.",
    "Si el pedido es ambiguo (por ejemplo 'subila' sin decir cuánto, o 'comprá' sin monto), preguntá antes de actuar. Si es claro, actuá sin pedir permiso.",
    "No das consejos de inversión ni elegís activos por el usuario. Si te pregunta en qué invertir, le explicás las opciones y sus riesgos en pocas palabras y la decisión es suya.",
    `No podés retirar ni mandar plata a otra cuenta: para eso está el botón ${lang === "es" ? "Retirar" : "Withdraw"} en la app.`,
    `Datos fijos: el porcentaje de la regla puede ser ${PERCENT_OPTIONS.join(", ")}. Cuando lo apartado llega a ${usdc(INVEST_MIN_UNITS)} USDC, la regla lo invierte en su destino. La compra a mano es desde ${usdc(BUY_MIN_UNITS)} USDC. La comisión de Camalote es ${FEE_BPS / 100}% por compra con tope de ${usdc(FEE_MAX_UNITS)} USDC, ${FEE_BPS_DOLLARS / 100}% en dólares que rinden; vender no tiene comisión de Camalote. Solo las acciones esperan, si así está la regla, a que abra Wall Street; los dólares que rinden no tienen horario.`,
    "Apartar no es invertir: lo apartado (setAsideUsdc) sigue en la cuenta, sin comprar ni poner a rendir, hasta llegar al mínimo.",
    "Si rule.eligible es false, el usuario todavía no confirmó que puede invertir desde donde vive: la regla aparta pero no invierte, y la app le pide confirmarlo al prender la regla o comprar. Si pregunta por qué no se invirtió, decíselo. Si pide prender la regla sin haber confirmado, la regla sigue en pausa hasta que confirme en pantalla, y al confirmar se prende sola: decí solo eso, nunca que quedó prendida, encendida o activada.",
    "La meta y el destino son cosas distintas: la meta es para qué junta (el viaje, 300 USDC); el destino es en qué se invierte (S&P 500).",
    "Cómo se dice invertir según el tipo de destino: acción o empresa privada (stock, preipo) se compra; dólares que rinden (dollars) se ponen a rendir. Con dollars nunca uses las palabras compra, compré ni comprar: decí se pone a rendir, o todavía no se puso a rendir.",
    "Los montos, tal cual vienen en el estado: no los redondees ni recalcules.",
    `Destinos posibles (símbolo = nombre): ${catalogLine()}.`,
    "Formato: de una a tres frases cortas, texto plano, sin markdown, sin listas, sin emojis, sin JSON y nunca el guion largo. Nunca repitas el estado de la cuenta. Los montos en USDC. Nombrá los destinos por su nombre en el idioma del usuario (S&P 500, Bonos del Tesoro), nunca por el símbolo. Las fechas en palabras (marzo de 2027), nunca 2027-03.",
    voice,
  ].join("\n");
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "cambiar_regla",
      description: "Cambia la regla del usuario. Mandá solo lo que cambia.",
      parameters: {
        type: "object",
        properties: {
          porcentaje: { type: "integer", enum: [...PERCENT_OPTIONS], description: "Qué parte de cada cobro se aparta." },
          destino: { type: "string", enum: SYMBOLS, description: "En qué se invierte lo apartado." },
          prendida: { type: "boolean", description: "false pausa la regla, true la vuelve a prender." },
          esperar_apertura: { type: "boolean", description: "Si las acciones esperan a que abra Wall Street." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cambiar_meta",
      description: "Pone o cambia la meta: para qué junta y cuánto. Con el mismo nombre, conserva lo juntado.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre corto: El viaje, La compu nueva." },
          monto_usdc: { type: "number", description: "Cuánto quiere juntar, en USDC." },
          mes: { type: "string", description: "Opcional: para cuándo, AAAA-MM." },
        },
        required: ["nombre", "monto_usdc"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "quitar_meta",
      description: "Saca la meta. La regla sigue igual.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "proponer_compra",
      description: "Deja lista en pantalla una compra a mano para que el usuario la revise y la confirme. No compra.",
      parameters: {
        type: "object",
        properties: {
          destino: { type: "string", enum: SYMBOLS },
          monto_usdc: { type: "number", description: "Cuánto invertir, en USDC." },
        },
        required: ["destino", "monto_usdc"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proponer_venta",
      description: "Deja lista en pantalla la venta de algo que el usuario tiene; él elige cuánto y confirma, así que no hace falta preguntarle el monto. No vende.",
      parameters: {
        type: "object",
        properties: { destino: { type: "string", enum: SYMBOLS } },
        required: ["destino"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revisar_ahora",
      description: "Revisa ya si le llegaron cobros y, si corresponde, aparta e invierte según la regla.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "activar_agente",
      description: "Le muestra al usuario el permiso para activar al agente (lo acepta él).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "apagar_agente",
      description: "Le deja al usuario el botón para apagar al agente (lo confirma él).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export class ChatUnavailable extends Error {}

const REWRITE = {
  es: "Escribí ahora solo el mensaje para el usuario sobre lo que hiciste o lo que te preguntó: de una a tres frases, texto plano, en castellano rioplatense. Sin JSON, sin repetir el estado.",
  en: "Now write only the message to the user about what you did or what they asked: one to three sentences, plain text, in English. No JSON, don't repeat the state.",
} as const;

function parseArgs(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return null;
  }
}

/**
 * Un mensaje del usuario: el modelo lee el estado y la charla, usa las
 * herramientas que necesite y responde. Devuelve la respuesta y las
 * acciones para la app.
 */
export async function agentChat(input: {
  lang: "es" | "en";
  context: unknown;
  state: ToolState;
  history: ChatTurn[];
}): Promise<AgentChatReply> {
  const providers = brainProviders();
  if (providers.length === 0) throw new ChatUnavailable("sin IA configurada");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(input.lang) },
    { role: "system", content: `Estado de la cuenta ahora, según la app: ${JSON.stringify(input.context)}` },
    ...input.history.map((t) => ({ role: t.role, content: t.content }) as ChatMessage),
  ];

  let state = input.state;
  const actions: AgentAction[] = [];
  let reply: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const message = await chat(messages, TOOLS, providers, OPTS);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      reply = cleanReply(message.content);
      break;
    }
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
    for (const call of calls) {
      const outcome = runChatTool(call.function.name, parseArgs(call.function.arguments), state);
      state = outcome.state;
      if (outcome.action) actions.push(outcome.action);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.result) });
    }
  }

  // Si se quedó usando herramientas o la respuesta salió rota, se le pide
  // solo el mensaje, sin herramientas: lo que hizo ya está hecho.
  for (let rewrite = 0; looksBroken(reply) && rewrite < MAX_REWRITES; rewrite += 1) {
    if (reply !== null) console.warn("[agent-chat] respuesta rota, se pide de nuevo");
    const last = await chat(
      [...messages, { role: "system", content: REWRITE[input.lang] }],
      undefined,
      providers,
      OPTS
    );
    reply = cleanReply(last.content);
  }
  if (reply === null || looksBroken(reply)) throw new Error("el modelo no respondió con un mensaje usable");
  return { reply, actions: mergeActions(actions) };
}
