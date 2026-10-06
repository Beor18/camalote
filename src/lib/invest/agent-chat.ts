import { BUY_MIN_UNITS, INVEST_MIN_UNITS } from "@/lib/config";
import { XSTOCKS, assetName, findXStock, isXStockSymbol, kindOf, type AssetKind, type XStockSymbol } from "@/lib/invest/catalog";
import { neededPerMonth, paymentsToGo, type GoalProgress } from "@/lib/invest/goals";
import type { MarketMap } from "@/lib/invest/guards";
import { isEligible } from "@/lib/invest/eligibility";
import { PERCENT_OPTIONS, type PortfolioSummary } from "@/lib/invest/rules";
import type { InvestGoal, InvestRule, Purchase } from "@/lib/invest/types";
import type { YieldMap } from "@/lib/invest/yields";

/**
 * Hablarle al agente: el usuario le escribe y el agente de IA responde con
 * los datos reales de su cuenta y, si se lo pide, actúa. Acá vive lo que
 * comparten el navegador y el servidor, todo puro:
 *
 * - el estado de la cuenta que la app le pasa al agente (`buildAgentContext`);
 * - las herramientas, validadas contra ese estado (`runChatTool`): cambiar la
 *   regla o la meta, dejar lista una compra o una venta, revisar ahora y
 *   prender o apagar el agente;
 * - cómo un cambio pedido se vuelve regla, con lo necesario para deshacerlo
 *   (`rulePatchFor`).
 *
 * El agente nunca mueve plata desde el chat: las compras y ventas quedan
 * listas en la hoja de siempre y el usuario confirma.
 */

const USDC = 1_000_000;
const MAX_GOAL_NAME = 40;
const MAX_GOAL_USDC = 10_000_000;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Un activo como lo ve el agente. */
export interface AssetRef {
  symbol: XStockSymbol;
  name: string;
  kind: AssetKind;
}

/** El estado de la cuenta, en dólares y con nombres, para que el agente responda sin inventar. */
export interface AgentChatContext {
  now: string;
  rule: {
    enabled: boolean;
    /** Confirmó que puede invertir desde donde vive. Sin eso, aparta pero no invierte. */
    eligible: boolean;
    percent: number;
    asset: AssetRef;
    /** Solo acciones: si esperan a que abra Wall Street. null en dólares y privadas. */
    waitForMarketOpen: boolean | null;
    /** Apartado y todavía sin invertir. */
    setAsideUsdc: number;
    buysAtUsdc: number;
    /** Por qué lo apartado no se compró todavía, si está esperando. */
    waiting: string | null;
    lastPayment: { amountUsdc: number; setAsideUsdc: number; at: string } | null;
  };
  goal: {
    name: string;
    targetUsdc: number;
    doneUsdc: number;
    remainingUsdc: number;
    pct: number;
    reached: boolean;
    dueMonth: string | null;
    paymentsToGo: number | null;
    neededPerMonthUsdc: number | null;
  } | null;
  balanceUsdc: number | null;
  portfolio: {
    valueUsdc: number;
    investedUsdc: number;
    gainUsdc: number;
    gainPct: number | null;
    assets: { symbol: XStockSymbol; name: string; valueUsdc: number }[];
  };
  operations: { kind: "buy" | "sell"; symbol: XStockSymbol; usdc: number; at: string; by: "rule" | "manual"; status: string }[];
  agent: { available: boolean; on: boolean; recent: { kind: string; message: string; at: string }[] };
  market: { wallStreetOpen: boolean | null; nextOpen: string | null };
  /** Rendimiento anual de hoy (%) de los dólares que rinden. */
  yields: Partial<Record<XStockSymbol, number>>;
  /** Precio de hoy en USD por unidad, como lo muestra la app. */
  prices: Partial<Record<XStockSymbol, number>>;
}

/**
 * Unidades de USDC → dólares con dos decimales, cortando en el centavo como
 * la app (formatUsdc): si la pantalla dice 0,21, el agente también.
 */
export const usd = (units: bigint | string | number | null | undefined): number => {
  let value: bigint;
  try {
    value = BigInt(units ?? 0);
  } catch {
    return 0;
  }
  return Number(value / BigInt(USDC / 100)) / 100;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const iso = (ms: number) => new Date(ms).toISOString();
const ref = (symbol: XStockSymbol, lang: "es" | "en"): AssetRef => ({ symbol, name: assetName(symbol, lang), kind: kindOf(symbol) });

export function buildAgentContext(input: {
  lang: "es" | "en";
  now: number;
  rule: InvestRule;
  goal: GoalProgress | null;
  summary: PortfolioSummary;
  balanceUnits: bigint | null;
  purchases: Purchase[];
  agent: { available: boolean; enabled: boolean; events: { kind: string; message: string; createdAt: number }[] };
  prices: Record<string, number>;
  multipliers: Record<string, number>;
  market: MarketMap;
  yields: YieldMap;
}): AgentChatContext {
  const { lang, now, rule } = input;
  const waiting =
    rule.waiting?.reason === "market"
      ? `wall_street_closed${rule.waiting.nextOpen ? `_until_${iso(rule.waiting.nextOpen * 1000)}` : ""}`
      : rule.waiting?.reason === "premium"
        ? `pre_ipo_premium_${(rule.waiting.premiumBps / 100).toFixed(1)}%`
        : null;
  const marketStatus = Object.values(input.market).find((m) => m !== undefined) ?? null;
  const goal = rule.goal && input.goal ? goalContext(rule.goal, input.goal, rule, now) : null;
  const prices: Partial<Record<XStockSymbol, number>> = {};
  for (const s of XSTOCKS) {
    const raw = input.prices[s.symbol];
    if (raw && Number.isFinite(raw)) prices[s.symbol] = round2(raw / (input.multipliers[s.symbol] || 1));
  }
  return {
    now: iso(now),
    rule: {
      enabled: rule.enabled,
      eligible: isEligible(rule),
      percent: rule.percent,
      asset: ref(rule.asset, lang),
      waitForMarketOpen: kindOf(rule.asset) === "stock" ? (rule.waitForMarketOpen ?? true) : null,
      setAsideUsdc: usd(rule.pendingUnits),
      buysAtUsdc: usd(INVEST_MIN_UNITS),
      waiting,
      lastPayment: rule.lastIncoming
        ? { amountUsdc: usd(rule.lastIncoming.amountUnits), setAsideUsdc: usd(rule.lastIncoming.setAsideUnits), at: iso(rule.lastIncoming.at) }
        : null,
    },
    goal,
    balanceUsdc: input.balanceUnits === null ? null : usd(input.balanceUnits),
    portfolio: {
      valueUsdc: usd(input.summary.valueUnits),
      investedUsdc: usd(input.summary.investedUnits),
      gainUsdc: usd(input.summary.pnlUnits),
      gainPct: input.summary.pnlPct,
      assets: input.summary.rows.map((r) => ({ symbol: r.asset, name: assetName(r.asset, lang), valueUsdc: usd(r.valueUnits) })),
    },
    operations: input.purchases.slice(0, 8).map((p) => ({
      kind: p.kind === "sell" ? "sell" : "buy",
      symbol: p.asset,
      usdc: usd(p.usdcUnits),
      at: iso(p.createdAt),
      by: p.source,
      status: p.status,
    })),
    agent: {
      available: input.agent.available,
      on: input.agent.enabled,
      recent: input.agent.events
        .filter((e) => e.kind !== "enabled" && e.kind !== "disabled")
        .slice(0, 5)
        .map((e) => ({ kind: e.kind, message: e.message, at: iso(e.createdAt) })),
    },
    market: {
      wallStreetOpen: marketStatus ? marketStatus.open : null,
      nextOpen: marketStatus?.nextOpen ? iso(marketStatus.nextOpen * 1000) : null,
    },
    yields: Object.fromEntries(Object.entries(input.yields).map(([k, v]) => [k, round2(v as number)])),
    prices,
  };
}

function goalContext(goal: InvestGoal, progress: GoalProgress, rule: InvestRule, now: number): NonNullable<AgentChatContext["goal"]> {
  const perMonth = goal.dueMonth ? neededPerMonth(progress.remainingUnits, goal.dueMonth, now) : null;
  return {
    name: goal.name,
    targetUsdc: usd(progress.targetUnits),
    doneUsdc: usd(progress.doneUnits),
    remainingUsdc: usd(progress.remainingUnits),
    pct: progress.pct,
    reached: progress.reached,
    dueMonth: goal.dueMonth ?? null,
    paymentsToGo: paymentsToGo(progress.remainingUnits, BigInt(rule.lastIncoming?.setAsideUnits ?? "0")),
    neededPerMonthUsdc: perMonth === null ? null : usd(perMonth),
  };
}

/* ------------------------------------------------------------------ */
/* Lo que el agente puede hacer                                        */
/* ------------------------------------------------------------------ */

export interface GoalChange {
  name: string;
  targetUnits: string;
  dueMonth?: string;
}

/** Un cambio de regla pedido en el chat. Solo los campos que cambian. */
export interface RuleChange {
  percent?: number;
  asset?: XStockSymbol;
  enabled?: boolean;
  waitForMarketOpen?: boolean;
  /** null = sacar la meta. */
  goal?: GoalChange | null;
}

export type AgentAction =
  | { type: "rule"; change: RuleChange }
  | { type: "buy"; asset: XStockSymbol; usdcUnits: string }
  | { type: "sell"; asset: XStockSymbol }
  | { type: "check" }
  | { type: "agent_on" }
  | { type: "agent_off" };

export interface AgentChatReply {
  reply: string;
  actions: AgentAction[];
}

/** Lo que la app le manda al agente en cada mensaje. */
export interface AgentChatRequest {
  lang: "es" | "en";
  messages: ChatTurn[];
  context: AgentChatContext;
}

/** El agente no pudo responder: el código HTTP dice por qué (429 = muchos seguidos, 401 = sesión). */
export class AgentChatError extends Error {
  constructor(readonly status: number) {
    super(`agent chat ${status}`);
  }
}

/** POST a /api/agent/chat; con token en red real, sin token en demo. */
export async function postAgentChat(
  address: string,
  request: AgentChatRequest,
  token: string | null
): Promise<AgentChatReply> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ address, ...request }),
    cache: "no-store",
  });
  if (!res.ok) throw new AgentChatError(res.status);
  const data = (await res.json()) as Partial<AgentChatReply>;
  if (typeof data.reply !== "string") throw new AgentChatError(502);
  return { reply: data.reply, actions: Array.isArray(data.actions) ? data.actions : [] };
}

/** Lo que el servidor sigue de la cuenta mientras el agente usa herramientas en un turno. */
export interface ToolState {
  percent: number;
  asset: XStockSymbol;
  enabled: boolean;
  waitForMarketOpen: boolean;
  goal: { name: string; targetUsdc: number; dueMonth: string | null } | null;
  balanceUsdc: number | null;
  holdings: XStockSymbol[];
  agentAvailable: boolean;
  agentOn: boolean;
  /** Confirmó que puede invertir desde donde vive; si no, prender la regla espera esa confirmación. */
  eligible: boolean;
  /** "2026-10": para no aceptar metas en meses que ya pasaron. */
  currentMonth: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Lo mínimo del estado que mandó el navegador, revisado campo por campo. */
export function toolStateFrom(ctx: unknown): ToolState | null {
  if (!isObj(ctx) || !isObj(ctx.rule) || !isObj(ctx.rule.asset) || !isObj(ctx.agent) || !isObj(ctx.portfolio)) return null;
  const asset = ctx.rule.asset.symbol;
  const percent = num(ctx.rule.percent);
  if (!isXStockSymbol(asset) || percent === null) return null;
  const goal = isObj(ctx.goal) && typeof ctx.goal.name === "string" ? ctx.goal : null;
  const now = typeof ctx.now === "string" && !Number.isNaN(Date.parse(ctx.now)) ? new Date(ctx.now) : new Date();
  const assets = Array.isArray(ctx.portfolio.assets) ? ctx.portfolio.assets : [];
  return {
    percent,
    asset,
    enabled: ctx.rule.enabled === true,
    waitForMarketOpen: ctx.rule.waitForMarketOpen !== false,
    goal: goal
      ? {
          name: String(goal.name).slice(0, MAX_GOAL_NAME),
          targetUsdc: num(goal.targetUsdc) ?? 0,
          dueMonth: typeof goal.dueMonth === "string" ? goal.dueMonth : null,
        }
      : null,
    balanceUsdc: num(ctx.balanceUsdc),
    holdings: assets
      .map((a) => (isObj(a) ? a.symbol : null))
      .filter((s): s is XStockSymbol => isXStockSymbol(s)),
    agentAvailable: ctx.agent.available === true,
    agentOn: ctx.agent.on === true,
    eligible: ctx.rule.eligible === true,
    currentMonth: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

export interface ToolOutcome {
  /** Lo que ve el modelo. */
  result: { ok: true; done: string } | { ok: false; error: string };
  action?: AgentAction;
  state: ToolState;
}

const fail = (state: ToolState, error: string): ToolOutcome => ({ result: { ok: false, error }, state });

/** Nombres de las herramientas, como las ve el modelo. */
export const TOOL_NAMES = [
  "cambiar_regla",
  "cambiar_meta",
  "quitar_meta",
  "proponer_compra",
  "proponer_venta",
  "revisar_ahora",
  "activar_agente",
  "apagar_agente",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Un nombre de activo o símbolo como lo escribe el modelo ("NVDAx", "nvdax") → símbolo del catálogo. */
function symbolFrom(value: unknown): XStockSymbol | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (isXStockSymbol(clean)) return clean;
  const found = XSTOCKS.find((s) => s.symbol.toLowerCase() === clean.toLowerCase());
  return found?.symbol ?? null;
}

/**
 * Corre una herramienta contra el estado: valida los argumentos y, si está
 * todo bien, devuelve la acción para la app y el estado como queda. Nunca
 * toca plata: comprar y vender solo quedan listas para confirmar.
 */
export function runChatTool(name: string, args: unknown, state: ToolState): ToolOutcome {
  const a = isObj(args) ? args : {};
  switch (name) {
    case "cambiar_regla": {
      const change: RuleChange = {};
      const next = { ...state };
      if (a.porcentaje !== undefined) {
        const p = num(a.porcentaje);
        if (p === null || !(PERCENT_OPTIONS as readonly number[]).includes(p)) {
          return fail(state, `invalid percent: allowed ${PERCENT_OPTIONS.join(", ")}`);
        }
        if (p !== state.percent) {
          change.percent = p;
          next.percent = p;
        }
      }
      if (a.destino !== undefined) {
        const s = symbolFrom(a.destino);
        if (!s) return fail(state, "invalid asset: use a symbol from the list");
        if (s !== state.asset) {
          change.asset = s;
          next.asset = s;
        }
      }
      if (a.prendida !== undefined) {
        if (typeof a.prendida !== "boolean") return fail(state, "prendida must be true or false");
        if (a.prendida !== state.enabled) {
          change.enabled = a.prendida;
          next.enabled = a.prendida;
        }
      }
      if (a.esperar_apertura !== undefined) {
        if (typeof a.esperar_apertura !== "boolean") return fail(state, "esperar_apertura must be true or false");
        if (a.esperar_apertura !== state.waitForMarketOpen) {
          change.waitForMarketOpen = a.esperar_apertura;
          next.waitForMarketOpen = a.esperar_apertura;
        }
      }
      if (Object.keys(change).length === 0) return fail(state, "the rule was already like that: nothing changed");
      if (change.enabled === true && !state.eligible) {
        // La app pide la confirmación antes de prenderla: todavía no está prendida.
        next.enabled = false;
        const rest = { ...change };
        delete rest.enabled;
        return {
          result: {
            ok: true,
            done: `${Object.keys(rest).length > 0 ? `rule updated: ${JSON.stringify(rest)}. ` : ""}The rule is NOT on yet, it is still paused. The app is now showing the user a confirmation that they can invest from where they live; the rule turns on only after they confirm it. Don't say it's on.`,
          },
          action: { type: "rule", change },
          state: next,
        };
      }
      return { result: { ok: true, done: `rule updated: ${JSON.stringify(change)}` }, action: { type: "rule", change }, state: next };
    }
    case "cambiar_meta": {
      const typed = typeof a.nombre === "string" ? a.nombre.replace(/\s+/g, " ").trim() : "";
      // "la moto" → "La moto", como las fichas de la app.
      const nameText = typed.charAt(0).toLocaleUpperCase() + typed.slice(1);
      if (!nameText || nameText.length > MAX_GOAL_NAME) return fail(state, `invalid name: 1 to ${MAX_GOAL_NAME} characters`);
      const amount = num(a.monto_usdc);
      if (amount === null || amount < 1 || amount > MAX_GOAL_USDC) return fail(state, "invalid amount: between 1 and 10,000,000 USDC");
      let dueMonth: string | undefined;
      if (a.mes !== undefined && a.mes !== null && a.mes !== "") {
        if (typeof a.mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(a.mes)) return fail(state, "invalid month: use YYYY-MM");
        if (a.mes < state.currentMonth) return fail(state, "that month already passed");
        dueMonth = a.mes;
      }
      const goal: GoalChange = { name: nameText, targetUnits: String(Math.round(amount * 100) * 10_000), ...(dueMonth ? { dueMonth } : {}) };
      return {
        result: { ok: true, done: `goal updated: ${nameText}, ${amount} USDC${dueMonth ? `, by ${dueMonth}` : ""}` },
        action: { type: "rule", change: { goal } },
        state: { ...state, goal: { name: nameText, targetUsdc: amount, dueMonth: dueMonth ?? null } },
      };
    }
    case "quitar_meta": {
      if (!state.goal) return fail(state, "there is no goal to remove");
      return { result: { ok: true, done: "goal removed; the rule stays the same" }, action: { type: "rule", change: { goal: null } }, state: { ...state, goal: null } };
    }
    case "proponer_compra": {
      const s = symbolFrom(a.destino);
      if (!s) return fail(state, "invalid asset: use a symbol from the list");
      const amount = num(a.monto_usdc);
      const min = Number(BUY_MIN_UNITS) / USDC;
      if (amount === null || amount < min) return fail(state, `invalid amount: minimum ${min} USDC`);
      if (state.balanceUsdc !== null && amount > state.balanceUsdc) {
        return fail(state, `not enough: the user has ${state.balanceUsdc} USDC available`);
      }
      const units = String(Math.floor(amount * 100) * 10_000);
      return {
        result: { ok: true, done: "the buy is ready on screen for the user to review and confirm; nothing was bought yet" },
        action: { type: "buy", asset: s, usdcUnits: units },
        state,
      };
    }
    case "proponer_venta": {
      const s = symbolFrom(a.destino);
      if (!s) return fail(state, "invalid asset: use a symbol from the list");
      if (!state.holdings.includes(s)) return fail(state, `the user has no ${findXStock(s)?.name ?? s} to sell`);
      return {
        result: { ok: true, done: "the sale is ready on screen; the user picks how much and confirms; nothing was sold yet" },
        action: { type: "sell", asset: s },
        state,
      };
    }
    case "revisar_ahora": {
      if (!state.agentOn) return fail(state, "the agent is off: it has to be turned on first");
      return { result: { ok: true, done: "checking for new payments now; whatever happens shows in the agent history" }, action: { type: "check" }, state };
    }
    case "activar_agente": {
      if (!state.agentAvailable) return fail(state, "the agent is not available right now");
      if (state.agentOn) return fail(state, "the agent is already on");
      return {
        result: { ok: true, done: "the permission to turn it on is shown on screen; the user has to accept it" },
        action: { type: "agent_on" },
        state,
      };
    }
    case "apagar_agente": {
      if (!state.agentOn) return fail(state, "the agent is already off");
      return {
        result: { ok: true, done: "the button to turn it off is on screen; the user has to confirm it" },
        action: { type: "agent_off" },
        state,
      };
    }
    default:
      return fail(state, `unknown tool ${name}`);
  }
}

/** Varios cambios de regla en un turno viajan como uno solo; el resto, en orden y sin repetir. */
export function mergeActions(actions: AgentAction[]): AgentAction[] {
  const change: RuleChange = {};
  const rest: AgentAction[] = [];
  for (const action of actions) {
    if (action.type === "rule") Object.assign(change, action.change);
    else if (!rest.some((r) => JSON.stringify(r) === JSON.stringify(action))) rest.push(action);
  }
  return Object.keys(change).length > 0 ? [{ type: "rule", change }, ...rest] : rest;
}

/* ------------------------------------------------------------------ */
/* En la app                                                           */
/* ------------------------------------------------------------------ */

/**
 * El cambio pedido, como parche de la regla, y lo que había antes para
 * deshacerlo. Una meta con el mismo nombre conserva su avance; una meta
 * nueva arranca de cero, como al elegirla en la hoja.
 */
export function rulePatchFor(
  rule: InvestRule,
  change: RuleChange,
  now: number
): { patch: Partial<InvestRule>; before: Partial<InvestRule> } {
  const patch: Partial<InvestRule> = {};
  const before: Partial<InvestRule> = {};
  if (change.percent !== undefined) {
    patch.percent = change.percent;
    before.percent = rule.percent;
  }
  if (change.asset !== undefined) {
    patch.asset = change.asset;
    before.asset = rule.asset;
  }
  if (change.enabled !== undefined) {
    patch.enabled = change.enabled;
    before.enabled = rule.enabled;
  }
  if (change.waitForMarketOpen !== undefined) {
    patch.waitForMarketOpen = change.waitForMarketOpen;
    before.waitForMarketOpen = rule.waitForMarketOpen ?? true;
  }
  if (change.goal !== undefined) {
    before.goal = rule.goal;
    if (change.goal === null) {
      patch.goal = undefined;
    } else {
      const same = rule.goal && rule.goal.name.trim().toLowerCase() === change.goal.name.trim().toLowerCase();
      patch.goal = same && rule.goal
        ? { ...rule.goal, targetUnits: change.goal.targetUnits, dueMonth: change.goal.dueMonth ?? rule.goal.dueMonth }
        : {
            name: change.goal.name,
            emoji: "✨",
            preset: "custom",
            targetUnits: change.goal.targetUnits,
            dueMonth: change.goal.dueMonth,
            startedAt: now,
            contributedUnits: "0",
          };
    }
  }
  return { patch, before };
}

/** La respuesta del modelo, lista para mostrar: texto plano, sin guion largo ni markdown. */
export function cleanReply(text: string | null | undefined, max = 700): string | null {
  if (!text) return null;
  const clean = text
    // Los espacios y guiones especiales que a veces mete el modelo, como los normales.
    .replace(/[\u00a0\u2007\u2009\u202f]/g, " ")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * Una respuesta que no se le puede mostrar a nadie: el modelo a veces
 * devuelve el estado en JSON, o se traba repitiendo puntos suspensivos o
 * palabras. El servidor le pide que la vuelva a escribir.
 */
export function looksBroken(text: string | null): boolean {
  if (!text) return true;
  return (
    /^\s*[[{]/.test(text) ||
    /"\w+"\s*:/.test(text) ||
    /(…\s*){2,}/.test(text) ||
    /(\.\s*){4,}/.test(text) ||
    // \b no entiende tildes: los bordes de palabra, con letras de cualquier idioma.
    /(?<!\p{L})(\p{L}{3,})\s+\1(?!\p{L})/iu.test(text)
  );
}

/** Los últimos turnos de la charla, recortados, para mandar al servidor. */
export function trimHistory(turns: readonly ChatTurn[], max = 12, maxChars = 600): ChatTurn[] {
  return turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-max)
    .map((t) => ({ role: t.role, content: t.content.slice(0, maxChars) }));
}
