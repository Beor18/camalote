import { chromium } from "playwright-core";
const OUT = process.argv[2];
const BASE = "http://localhost:3001";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

// 1. Fer crea un link de cobro
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("#cobro-amount", { timeout: 15000 });
await shot("01-cobrar-form");
await page.fill("#cobro-amount", "40");
await page.fill("#cobro-concept", "Diseño de logo");
await page.click("button[type=submit]");
await page.waitForSelector("text=Tu link está listo", { timeout: 10000 });
await page.waitForTimeout(600);
await shot("02-link-listo");
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("camalote.paylinks.v1")));
const url = saved[0].url;
console.log("LINK:", url);

// 2. El cliente abre el link, entra con su email y paga
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await shot("03-pay-como-fer");
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await shot("04-pay-login");
await page.fill("#email", "cliente@gmail.com");
await page.click("button[type=submit]");
await page.waitForSelector("button[type=submit]:has-text('Pagar')", { timeout: 15000 });
await page.waitForTimeout(1500);
await shot("05-pay-quote");
const btn = page.locator("button[type=submit]:has-text('Pagar')");
console.log("PAY BUTTON:", await btn.textContent(), "disabled:", await btn.isDisabled());
await btn.click();
await page.waitForTimeout(3500);
await shot("06-pay-progress");
await page.waitForSelector("text=¡Pagado!", { timeout: 25000 });
await page.waitForTimeout(600);
await shot("07-pay-done");

// 3. Fer vuelve y ve el cobro pagado
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
if (await page.locator("#email").count()) { /* sesión de cliente activa: salir */ }
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("text=Pagado", { timeout: 20000 });
await page.waitForTimeout(1200);
await shot("08-cobrar-pagado");
const balance = await page.locator("span.font-mono.text-2xl").first().textContent();
console.log("FER SOLANA BALANCE:", balance);

// 4. historial del cliente muestra el pago
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email");
await page.fill("#email", "cliente@gmail.com");
await page.click("button[type=submit]");
await page.waitForSelector("#amount", { timeout: 15000 });
await page.waitForTimeout(1200);
await shot("09-cliente-historial");
console.log("HISTORY HAS PAYMENT:", (await page.locator("text=Pago a Fer").count()) > 0);

await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n - " + errors.join("\n - ") : "Sin errores de consola.");
