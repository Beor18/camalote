/**
 * Recorre Camalote en modo demo con Playwright y saca capturas:
 * landing, entrar, armar la regla, llegan USDC y se compra sola, compra a
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
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("[data-testid=invest-account]", { timeout: 15000 });
await page.waitForTimeout(900);
await shot("02-app");
console.log("BALANCE:", await text("[data-testid=usdc-balance]"));
console.log("LANG:", await page.evaluate(() => document.documentElement.lang));
console.log("TABS VISIBLES:", await page.locator("nav[aria-label=Sections]").count());

// 3. Arma su regla: el 30 % de lo que le llega, para el viaje (300), al S&P 500
await page.click("[data-testid=rule-toggle]");
// Recién prendida, se abre la hoja para elegir qué parte, para qué y en qué.
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await page.click("[data-testid=rule-percent-30]");
await page.click("[data-testid=rule-goal-trip]");
await page.fill("#rule-goal-target", "300");
await page.click("[data-testid=rule-asset-SPYx]");
await shot("03-regla-hoja");
await page.click("[data-testid=rule-done]");
await page.waitForTimeout(800);
await shot("03-regla");
console.log("RULE:", await text("[data-testid=invest-rule] p"));
console.log("GOAL:", await text("[data-testid=goal-name]"), "·", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));

// 4. Le llegan 40 USDC (demo): el 30 % se compra solo y la meta avanza
await page.click("[data-testid=simulate-incoming]");
await purchasesDone(1);
await page.waitForTimeout(1200);
await shot("04-compra-por-regla");
console.log("PURCHASE:", await text("[data-testid=invest-purchases] p"));
console.log("GOAL 2:", await text("[data-testid=goal-progress]"), "·", await text("[data-testid=goal-pct]"));
console.log("MOMENT:", await text("[data-testid=rule-moment]"));
console.log("PACE:", await text("[data-testid=goal-pace]"));

// 4b. Baja la meta a 10: ya llegó. Festejo y elige la próxima (el curso).
await page.click("[data-testid=rule-edit]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await page.fill("#rule-goal-target", "10");
await page.click("[data-testid=rule-done]");
await page.waitForSelector("[data-testid=goal-reached][open]", { timeout: 10000 });
await page.waitForTimeout(500);
await shot("04c-meta-cumplida");
console.log("REACHED:", (await text("[data-testid=goal-reached] h2")), "·", await text("[data-testid=goal-reached] p.text-sm"));
await page.click("[data-testid=goal-next]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await page.click("[data-testid=rule-goal-course]");
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
