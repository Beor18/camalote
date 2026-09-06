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


// 5. Pago sin registrarse: el cliente manda USDC a la dirección de cobro del link
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("#cobro-amount", { timeout: 15000 });
console.log("DEPOSIT ADDRESS CARD (Fer):", (await page.locator("[data-testid=deposit-address]").count()) > 0);
await shot("10-cobrar-con-direccion");
await page.fill("#cobro-amount", "25");
await page.fill("#cobro-concept", "Clases de inglés");
await page.click("button[type=submit]");
await page.waitForSelector("text=Tu link está listo", { timeout: 10000 });
const saved2 = JSON.parse(await page.evaluate(() => localStorage.getItem("camalote.paylinks.v1")));
const url2 = saved2.find((l) => l.concept === "Clases de inglés").url;
console.log("LINK 2:", url2);
await page.goto(url2, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await page.waitForSelector("[data-testid=direct-address]", { timeout: 10000 });
await page.waitForTimeout(800);
await shot("11-pay-sin-registro");
console.log("DIRECT ADDRESS:", await page.locator("[data-testid=direct-address]").textContent());
console.log("SEND LINE:", await page.locator("text=Mandá exactamente").textContent());
await page.click("button:has-text('Simular el envío desde Coinbase')");
await page.waitForTimeout(2500);
await shot("12-pay-sin-registro-progreso");
await page.waitForSelector("text=¡Pagado!", { timeout: 25000 });
await page.waitForTimeout(600);
await shot("13-pay-sin-registro-pagado");

// 6. Fer ve los dos cobros pagados
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.waitForSelector("#email", { timeout: 10000 });
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForFunction(() => document.body.innerText.split("Pagado").length - 1 >= 2, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await shot("14-cobrar-dos-pagados");
console.log("PAID BADGES:", await page.getByText("Pagado", { exact: true }).count());
console.log("FER SOLANA BALANCE 2:", await page.locator("span.font-mono.text-2xl").first().textContent());

await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n - " + errors.join("\n - ") : "Sin errores de consola.");
