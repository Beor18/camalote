/**
 * Recorre Camalote en modo demo con Playwright y saca capturas:
 * landing, entrar, armar la regla (onboarding con agente), llegan USDC y se compra sola, compra a
 * mano con ticket, venta, depósito, y las rutas ocultas.
 *
 * Uso: node scripts/e2e-demo.mjs <carpeta-salida>   (dev server demo en :3001)
 * Corre en inglés, tal como abre la app para alguien que nunca eligió idioma.
 */
import { chromium } from "playwright-core";
const OUT = process.argv[2];
const BASE = "http://localhost:3001";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
// El botón "N" de las herramientas de desarrollo de Next no va en las capturas.
await context.addInitScript(() => {
  const hide = () => document.querySelectorAll("nextjs-portal").forEach((el) => (el.style.display = "none"));
  const start = () => {
    hide();
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start);
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const text = async (sel) => (await page.locator(sel).first().textContent())?.trim();
/** Espera a que haya al menos `n` operaciones hechas guardadas en el dispositivo. */
const purchasesDone = (n) =>
  page.waitForFunction(
    (min) => {
      const raw = Object.entries(localStorage).find(([k]) => k.startsWith("camalote.invest.purchases.v1:"))?.[1];
      return raw ? JSON.parse(raw).filter((p) => p.status === "done").length >= min : false;
    },
    n,
    { timeout: 40000 }
  );

// 1. La landing
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("01-landing");
const h = await page.evaluate(() => document.documentElement.scrollHeight);
console.log("LANDING:", h, "px,", (h / 860).toFixed(2), "pantallas");

// 2. Fer entra con su email
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
// El email está detrás del link, debajo de Google y Phantom.
await page.click("[data-testid=login-email]");
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("[data-testid=invest-welcome]", { timeout: 15000 });
await page.waitForTimeout(900);
await shot("02-app");
console.log("LANG:", await page.evaluate(() => document.documentElement.lang));
console.log("TABS VISIBLES:", await page.locator("nav[aria-label=Sections]").count());
console.log("WELCOME CTA:", await text("[data-testid=rule-setup]"), "· primary buttons:", await page.locator("button.bg-primary").count());

// 3. Arma su regla en tres pasos: el 30 % de lo que le llega, para el viaje (300), al S&P 500
await page.click("[data-testid=rule-setup]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await page.click("[data-testid=rule-percent-30]");
console.log("STEP 1:", await text("[data-testid=rule-percent-example]"));
await shot("03a-regla-paso1");
await page.click("[data-testid=rule-next]");
await page.click("[data-testid=rule-goal-trip]");
await page.fill("#rule-goal-target", "300");
await shot("03b-regla-paso2");
await page.click("[data-testid=rule-next]");
await page.click("[data-testid=rule-asset-SPYx]");
console.log("SUMMARY:", await text("[data-testid=rule-summary]"));
await shot("03c-regla-paso3");
await page.click("[data-testid=rule-done]");
// 3c'. Antes de prender la regla, confirma que puede invertir desde donde vive.
await page.waitForSelector("[data-testid=eligibility-sheet][open]", { timeout: 10000 });
await shot("03c2-confirmacion");
await page.click("[data-testid=eligibility-check]");
await page.click("[data-testid=eligibility-confirm]");
// 3d. Onboarding: activa su agente (el permiso dice qué puede y qué no) y ve dónde le pagan.
await page.waitForSelector("[data-testid=onboarding][data-step=agent]", { timeout: 10000 });
await shot("03d-onboarding-agente");
await page.click("[data-testid=onb-agent-enable]");
await page.waitForSelector("[data-testid=agent-sheet][open]", { timeout: 10000 });
await shot("03e-permiso-agente");
console.log("AGENT CAN:", (await page.locator("[data-testid=agent-sheet] ul").first().innerText()).replace(/\n+/g, " | "));
await page.click("[data-testid=agent-confirm]");
await page.waitForSelector("[data-testid=onboarding][data-step=fund]", { timeout: 10000 });
await shot("03f-onboarding-cobro");
console.log("FUND ADDRESS:", await text("[data-testid=onb-address]"));
await page.click("[data-testid=onb-finish]");
await page.waitForSelector("[data-testid=rule-headline]", { timeout: 10000 });
await page.waitForTimeout(800);
await shot("03-regla");
console.log("AGENT:", await text("[data-testid=agent-state]"));
console.log("BALANCE:", await text("[data-testid=usdc-balance]"));
console.log("RULE:", (await text("[data-testid=rule-headline]"))?.replace(/\s+/g, " "), "·", await text("[data-testid=rule-state]"));
console.log("GOAL:", await text("[data-testid=goal-name]"), "·", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));
console.log("PENDING 0:", await text("[data-testid=rule-pending]"));

// 4. Le llegan 40 USDC (demo): el 30 % se compra solo y la meta avanza
await page.click("[data-testid=simulate-incoming]");
await purchasesDone(1);
await page.waitForTimeout(1200);
await shot("04-compra-por-regla");
// Los movimientos: la compra de la regla dice "por tu regla" y nada más.
await page.locator("[data-testid=invest-purchases]").scrollIntoViewIfNeeded();
await page.locator("[data-testid=invest-purchases]").screenshot({ path: `${OUT}/04-movimientos.png` });
console.log("MOVEMENTS:", (await text("[data-testid=invest-purchases]"))?.replace(/\s+/g, " "));
console.log("PURCHASE:", await text("[data-testid=invest-purchases] p"));
console.log("GOAL 2:", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));
console.log("MOMENT:", await text("[data-testid=rule-moment]"));
console.log("PACE:", await text("[data-testid=goal-pace]"));
await page.waitForFunction(() => document.querySelectorAll("[data-testid=agent-events] li").length >= 1, null, { timeout: 15000 });
console.log("AGENT SAID:", await text("[data-testid=agent-events] li p.text-xs.leading-relaxed"));

// 4b. Edita: abre en el resumen, toca "Para qué" y baja la meta a 10: ya llegó.
// Festejo y elige la próxima (el curso), que abre directo en ese paso.
await page.click("[data-testid=rule-edit]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await shot("04a-regla-resumen");
console.log("REVIEW:", (await text("[data-testid=rule-review-goal]"))?.replace(/\s+/g, " "));
await page.click("[data-testid=rule-review-goal]");
await page.fill("#rule-goal-target", "10");
await page.click("[data-testid=rule-step-done]");
await page.click("[data-testid=rule-done]");
await page.waitForSelector("[data-testid=goal-reached][open]", { timeout: 10000 });
await page.waitForTimeout(500);
await shot("04c-meta-cumplida");
console.log("REACHED:", (await text("[data-testid=goal-reached] h2")), "·", await text("[data-testid=goal-reached] p.text-sm"));
await page.click("[data-testid=goal-next]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await page.click("[data-testid=rule-goal-course]");
await page.click("[data-testid=rule-step-done]");
await page.click("[data-testid=rule-done]");
await page.waitForTimeout(500);
console.log("GOAL 3:", await text("[data-testid=goal-name]"), "·", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));
// El multiplicador viene de un RPC público de mainnet: si no responde, el renglón no está (por diseño).
try {
  await page.waitForSelector("[data-testid=dividends-SPYx]", { timeout: 8000 });
  console.log("DIVIDENDS:", await text("[data-testid=dividends-SPYx]"));
  await page.locator("[data-testid=invest-portfolio]").screenshot({ path: `${OUT}/04b-cartera.png` });
} catch {
  console.log("DIVIDENDS: sin renglón (no se pudo leer el multiplicador)");
}
console.log("PENDING:", await text("[data-testid=rule-pending]"));
console.log("BALANCE 2:", await text("[data-testid=usdc-balance]"));

// 5. Compra a mano: 10 USDC de NVIDIA, con el ticket a la vista (en su hoja)
await page.click("[data-testid=buy-open]");
await page.waitForSelector("[data-testid=buy-sheet][open]", { timeout: 10000 });
console.log("BUY HINT:", await text("#buy-amount-hint"));
console.log("BUY DEFAULT:", await page.inputValue("#buy-amount"));
// 5a. Primero 10 USDC de dólares que rinden: la nota honesta y el ticket con 0,10 %.
await page.click("[data-testid=buy-group-dollars]");
await page.click("[data-testid=buy-asset-USDY]");
// La hoja cambia de verbo: no se "compran dólares", se ponen a rendir.
console.log("DOLLARS TITLE:", await text("[data-testid=buy-title]"), "·", await text("[data-testid=buy-quote]"));
console.log("DOLLARS:", await text("[data-testid=buy-dollars-note]"));
await page.fill("#buy-amount", "10");
await page.click("[data-testid=buy-quote]");
await page.waitForSelector("[data-testid=buy-ticket]", { timeout: 15000 });
await page.waitForTimeout(400);
await shot("05a-dolares-ticket");
console.log("DOLLARS TICKET:", (await text("[data-testid=buy-ticket]"))?.replace(/\s+/g, " "));
await page.click("[data-testid=buy-confirm]");
await page.waitForSelector("text=Earning!", { timeout: 30000 });
console.log("DOLLARS BUY:", await text("[data-testid=invest-buy] p"));
await page.click("[data-testid=buy-close]");
await page.waitForTimeout(600);
console.log("DOLLARS ROW:", await text("[data-testid=invest-portfolio] li:has-text('US Treasuries')"));

// 5b. Después 10 USDC de NVIDIA, como siempre.
await page.click("[data-testid=buy-open]");
await page.waitForSelector("[data-testid=buy-sheet][open]", { timeout: 10000 });
await page.click("[data-testid=buy-group-stock]");
await page.click("[data-testid=buy-asset-NVDAx]");
await page.fill("#buy-amount", "10");
await page.click("[data-testid=buy-quote]");
await page.waitForSelector("[data-testid=buy-ticket]", { timeout: 15000 });
await page.waitForTimeout(500);
await shot("05-ticket");
console.log("TICKET:", (await text("[data-testid=buy-ticket]"))?.replace(/\s+/g, " "));
await page.click("[data-testid=buy-confirm]");
await page.waitForSelector("text=Bought!", { timeout: 30000 });
await page.waitForTimeout(800);
await shot("06-comprado");
console.log("MANUAL BUY:", await text("[data-testid=invest-buy] p"));
console.log("FEE LINE:", await page.locator("[data-testid=invest-buy] p").nth(1).textContent());
await page.click("[data-testid=buy-close]");
await page.waitForTimeout(400);

// 6. Vende todo su S&P 500
await page.click("[data-testid=sell-SPYx]");
await page.waitForSelector("[data-testid=sell-modal][open]", { timeout: 10000 });
await page.click("[data-testid=sell-all]");
await page.click("[data-testid=sell-quote]");
await page.waitForSelector("[data-testid=sell-ticket]", { timeout: 15000 });
await page.waitForTimeout(400);
await shot("07-vender-ticket");
console.log("SELL TICKET:", (await text("[data-testid=sell-ticket]"))?.replace(/\s+/g, " "));
await page.click("[data-testid=sell-confirm]");
await page.waitForSelector("text=Sold!", { timeout: 30000 });
await page.waitForTimeout(800);
await shot("08-vendido");
await page.click("[data-testid=sell-modal] button:has-text('Done')");
await page.waitForTimeout(1000);
console.log("GOAL 4:", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));
console.log("BALANCE 3:", await text("[data-testid=usdc-balance]"));
console.log("OPERATIONS:", await page.locator("[data-testid=invest-purchases] > div > div").count());

// 6b. Pausa la regla desde el interruptor y la reanuda
await page.click("[data-testid=rule-toggle]");
await page.waitForTimeout(300);
console.log("PAUSED:", await text("[data-testid=rule-state]"), "·", await text("[data-testid=rule-pending]"));
await shot("08b-en-pausa");
await page.click("[data-testid=rule-resume]");
await page.waitForTimeout(300);
console.log("RESUMED:", await text("[data-testid=rule-state]"));

// 7. Depositar: la cuenta de Solana con QR
await page.locator("[data-testid=invest-account]").scrollIntoViewIfNeeded();
await page.click("[data-testid=deposit-open]");
await page.waitForSelector("[data-testid=solana-address]", { timeout: 10000 });
await page.waitForTimeout(500);
await shot("09-depositar");
console.log("DEPOSIT ADDRESS:", await text("[data-testid=solana-address]"));
await page.keyboard.press("Escape");

// 8. Las rutas ocultas redirigen
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
console.log("/app/cobrar ->", new URL(page.url()).pathname);
await page.goto(`${BASE}/p?to=obJNzRWf6BhbUPqezjX1v6Knjbyuin7Kxw3fcqu5qTp&a=40`, { waitUntil: "networkidle" });
console.log("/p ->", new URL(page.url()).pathname);
await page.goto(`${BASE}/app/invertir`, { waitUntil: "networkidle" });
console.log("/app/invertir ->", new URL(page.url()).pathname);

await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n - " + errors.join("\n - ") : "Sin errores de consola.");
