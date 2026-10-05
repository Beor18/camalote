import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";

/**
 * La cabeza del agente: un modelo de IA (gpt-oss 120B) que recibe los hechos
 * de la cuenta, decide si compra ahora y le escribe al usuario. Tiene dos
 * herramientas y ninguna le deja elegir cuánto ni en qué:
 *
 *   comprar_segun_regla()   compra lo apartado, en el destino de la regla
 *   esperar(motivo)         deja lo apartado para la próxima vuelta
 *
 * El código ya decidió si se puede comprar (horario, referencia, saldo); si
 * no se puede, la herramienta de comprar ni se ofrece.
 *
 * Responde Groq. Si Groq falla, el mismo modelo va por AI Gateway de Vercel,
 * que lo prueba en otros proveedores y, si tampoco, en otros dos modelos. Si
 * nadie responde, se equivoca de formato o tarda, decide la regla sola
 * (plan B) y el mensaje sale de las plantillas. La plata nunca depende del
 * modelo.
 */

type Provider = "groq" | "gateway";

const URLS: Record<Provider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gateway: "https://ai-gateway.vercel.sh/v1/chat/completions",
};
const MODELS: Record<Provider, string> = {
  groq: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  gateway: "openai/gpt-oss-120b",
};
/** Si el modelo no responde en ningún proveedor de AI Gateway, estos, en orden. */
const GATEWAY_FALLBACKS = ["google/gemini-3.1-flash-lite", "anthropic/claude-haiku-4.5"];
/** Groq es rápido: si tarda, se pasa al respaldo antes. */
const TIMEOUT_MS: Record<Provider, number> = { groq: 8_000, gateway: 12_000 };
const MAX_MESSAGE = 280;

/** En Vercel alcanza con el token OIDC del deploy; fuera de Vercel, una clave. */
function gatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

/** Los proveedores configurados, en el orden en que se prueban. */
export function brainProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GROQ_API_KEY) list.push("groq");
  if (gatewayConfigured()) list.push("gateway");
  return list;
}

export function brainConfigured(): boolean {
  return brainProviders().length > 0;
}

async function credential(provider: Provider): Promise<string> {
  if (provider === "groq") return process.env.GROQ_API_KEY as string;
  return process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
}

export interface BrainFacts {
  lang: "es" | "en";
  /** Lo que pasó en esta vuelta, en datos. */
  facts: Record<string, unknown>;
  /** Si el código permite comprar ahora. */
  canBuy: boolean;
}

export interface BrainResult {
  /** "buy" solo si canBuy y el modelo llamó a comprar. */
  action: "buy" | "wait" | "none";
  waitReason?: string;
  /** Lo que el modelo quiere decirle al usuario, ya validado (o null). */
  message: string | null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

function systemPrompt(lang: "es" | "en"): string {
  const voice =
    lang === "es"
      ? "Escribís en castellano rioplatense, con voseo. Frases cortas, una idea por frase. Sin jerga cripto (nada de wallet, token, swap, on-chain, DeFi). Nunca uses el guion largo."
      : "Write in plain, warm English. Short sentences, one idea each. No crypto jargon (no wallet, token, swap, on-chain, DeFi). Never use em dashes.";
  return [
    "Sos el agente de Camalote. Cumplís la regla de inversión del usuario: cada vez que le pagan, una parte se aparta y, al juntar 10 USDC, se compra lo que eligió.",
    "No das consejos de inversión, no recomendás activos y no cambiás la regla. No inventás números: usás solo los datos que te pasan.",
    "Si te ofrecen la herramienta comprar_segun_regla y hay algo apartado listo para comprar, la usás. Solo esperás si los datos dicen que no conviene ahora.",
    "Después de actuar, le escribís al usuario un mensaje de una o dos frases, menos de 200 caracteres. Decís cuánto pusiste y en qué (el destino, con su nombre). Si hay meta, decís que es para esa meta, por su nombre. El destino y la meta son cosas distintas: nunca llames meta al destino.",
    "Si el destino son dólares que rinden, no decís que compraste: decís que los pusiste a rendir.",
    "Sin comillas, sin signos de pesos, sin emojis. Los montos en USDC.",
    voice,
  ].join(" ");
}

const BUY_TOOL = {
  type: "function" as const,
  function: {
    name: "comprar_segun_regla",
    description: "Compra ahora lo apartado, en el destino de la regla del usuario. El monto y el destino los fija la regla.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const WAIT_TOOL = {
  type: "function" as const,
  function: {
    name: "esperar",
    description: "No compra ahora. Lo apartado queda guardado para la próxima vez.",
    parameters: {
      type: "object",
      properties: { motivo: { type: "string", description: "Por qué esperar, en pocas palabras." } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
};

const LABEL: Record<Provider, string> = { groq: "Groq", gateway: "AI Gateway" };

async function ask(provider: Provider, messages: ChatMessage[], tools: unknown[] | undefined): Promise<ChatMessage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[provider]);
  try {
    const res = await fetch(URLS[provider], {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await credential(provider)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELS[provider],
        messages,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
        temperature: 0.3,
        max_tokens: 400,
        ...(provider === "gateway" ? { providerOptions: { gateway: { models: GATEWAY_FALLBACKS } } } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${LABEL[provider]} respondió ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error(`${LABEL[provider]} no devolvió mensaje`);
    return message;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prueba los proveedores en orden. El que falla queda afuera del resto del
 * turno, así el segundo mensaje no vuelve a esperar al que ya no respondió.
 */
async function chat(messages: ChatMessage[], tools: unknown[] | undefined, providers: Provider[]): Promise<ChatMessage> {
  let lastError: unknown = new Error("sin proveedor de IA");
  while (providers.length > 0) {
    try {
      return await ask(providers[0], messages, tools);
    } catch (err) {
      lastError = err;
      console.warn(`[agent] ${LABEL[providers[0]]} no respondió:`, err instanceof Error ? err.message : err);
      providers.shift();
    }
  }
  throw lastError;
}

/** Una pregunta mínima a cada proveedor, para saber si responde. No toca cuentas. */
export async function probeBrain(): Promise<Partial<Record<Provider, string>>> {
  const out: Partial<Record<Provider, string>> = {};
  for (const provider of brainProviders()) {
    const started = Date.now();
    try {
      await ask(provider, [{ role: "user", content: "Respondé solo: ok" }], undefined);
      out[provider] = `ok (${Date.now() - started} ms)`;
    } catch (err) {
      out[provider] = err instanceof Error ? err.message : "error";
    }
  }
  return out;
}

/** Limpia el mensaje del modelo; null si no sirve (vacío, largo, con guion largo). */
export function cleanMessage(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
  if (!clean || clean.length > MAX_MESSAGE || clean.includes("—")) return null;
  return clean;
}

/**
 * Un turno del agente. `act` ejecuta la herramienta elegida y devuelve el
 * resultado en datos, que el modelo usa para escribir el mensaje.
 */
export async function agentTurn(
  input: BrainFacts,
  act: (action: "buy" | "wait", waitReason?: string) => Promise<Record<string, unknown>>
): Promise<BrainResult & { acted: boolean }> {
  const providers = brainProviders();
  if (providers.length === 0) return { action: "none", message: null, acted: false };
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(input.lang) },
    { role: "user", content: JSON.stringify({ hechos: input.facts, puede_comprar_ahora: input.canBuy }) },
  ];
  const tools = input.canBuy ? [BUY_TOOL, WAIT_TOOL] : undefined;

  let action: BrainResult["action"] = "none";
  let waitReason: string | undefined;
  let acted = false;
  try {
    const first = await chat(messages, tools, providers);
    const call = first.tool_calls?.[0];
    if (call && input.canBuy) {
      if (call.function.name === "comprar_segun_regla") action = "buy";
      else if (call.function.name === "esperar") {
        action = "wait";
        try {
          waitReason = String((JSON.parse(call.function.arguments || "{}") as { motivo?: unknown }).motivo ?? "").slice(0, 120);
        } catch {
          waitReason = undefined;
        }
      }
    }
    if (action === "none") {
      // Sin herramienta: el mensaje ya es la respuesta.
      return { action, message: cleanMessage(first.content), acted };
    }
    const result = await act(action, waitReason);
    acted = true;
    messages.push({ role: "assistant", content: first.content ?? null, tool_calls: [call!] });
    messages.push({ role: "tool", tool_call_id: call!.id, content: JSON.stringify(result) });
    const second = await chat(messages, undefined, providers);
    return { action, waitReason, message: cleanMessage(second.content), acted };
  } catch (err) {
    console.warn("[agent] la IA no respondió:", err instanceof Error ? err.message : err);
    return { action, waitReason, message: null, acted };
  }
}
