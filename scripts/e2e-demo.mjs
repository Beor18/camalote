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
console.log("SEND LINE:", await page.locator("text=Mandá 25,00").textContent());
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
// la app de Fer ve los USDC nuevos en su cuenta de Base y los lleva a Solana sola
await page.waitForSelector("text=Llegaron 25,00 USDC a tu dirección de cobro", { timeout: 20000 });
await shot("14a-cobrar-llegaron");
await page.waitForFunction(() => document.body.innerText.split("Pagado").length - 1 >= 2, null, { timeout: 45000 });
await page.waitForTimeout(1200);
await shot("14-cobrar-dos-pagados");
console.log("PAID BADGES:", await page.getByText("Pagado", { exact: true }).count());
console.log("FER SOLANA BALANCE 2:", await page.locator("span.font-mono.text-2xl").first().textContent());

// 7. Fer arma su regla: el 30 % de cada cobro va al S&P 500
await page.goto(`${BASE}/app/invertir`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=invest-rule]", { timeout: 15000 });
await page.click("[data-testid=rule-toggle]");
await page.click("[data-testid=rule-percent-30]");
await page.click("[data-testid=rule-asset-SPYx]");
await page.waitForTimeout(1000);
await shot("15-invertir-regla");
console.log("RULE:", await page.locator("[data-testid=invest-rule] p").first().textContent());
console.log("PORTFOLIO BEFORE:", await page.locator("[data-testid=portfolio-value]").textContent());

// 8. Un cliente paga 40 con su email: el 30 % se compra solo
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.waitForSelector("#cobro-amount", { timeout: 15000 });
console.log("RULE HINT:", await page.locator("[data-testid=rule-hint]").textContent());
await page.fill("#cobro-amount", "40");
await page.fill("#cobro-concept", "Sitio web");
await page.click("button[type=submit]");
await page.waitForSelector("text=Tu link está listo", { timeout: 10000 });
const saved3 = JSON.parse(await page.evaluate(() => localStorage.getItem("camalote.paylinks.v1")));
const url3 = saved3.find((l) => l.concept === "Sitio web").url;
await page.goto(url3, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await page.fill("#email", "cliente@gmail.com");
await page.click("button[type=submit]");
await page.waitForSelector("button[type=submit]:has-text('Pagar')", { timeout: 15000 });
await page.waitForTimeout(1200);
await page.locator("button[type=submit]:has-text('Pagar')").click();
await page.waitForSelector("text=¡Pagado!", { timeout: 25000 });

// 9. Fer vuelve: el cobro está pagado y la compra ya se hizo sola
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await page.fill("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("text=Regla activa", { timeout: 20000 });
await page.waitForTimeout(1200);
await shot("16-cobrar-regla-activa");
// la compra por regla corre en cualquier pestaña: esperamos a que termine antes de cambiar de página
await page.waitForFunction(
  () => Object.entries(localStorage).some(
    ([k, v]) => k.startsWith("camalote.invest.purchases.v1:") && v.includes('"status":"done"')
  ),
  null,
  { timeout: 40000 }
);
await page.goto(`${BASE}/app/invertir`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-testid=invest-purchases]", { timeout: 20000 });
await page.waitForFunction(
  () => document.querySelector("[data-testid=invest-purchases]")?.textContent?.includes("Comprada"),
  null,
  { timeout: 40000 }
);
await page.waitForTimeout(1200);
await shot("17-invertir-compra-por-regla");
console.log("PURCHASE:", (await page.locator("[data-testid=invest-purchases] p").first().textContent())?.trim());
console.log("PORTFOLIO AFTER:", await page.locator("[data-testid=portfolio-value]").textContent());
console.log("PENDING:", await page.locator("[data-testid=rule-pending]").textContent());

// 10. Compra a mano: 10 USDC de NVIDIA
await page.click("[data-testid=buy-asset-NVDAx]");
await page.fill("#buy-amount", "10");
await page.click("[data-testid=buy-submit]");
await page.waitForTimeout(1500);
await shot("18-invertir-comprando");
await page.waitForSelector("text=¡Compraste!", { timeout: 30000 });
await page.waitForTimeout(800);
await shot("19-invertir-comprado");
console.log("MANUAL BUY:", (await page.locator("[data-testid=invest-buy] p").first().textContent())?.trim());
console.log("PORTFOLIO FINAL:", await page.locator("[data-testid=portfolio-value]").textContent());
console.log("FER SOLANA BALANCE 3:", await page.evaluate(() => localStorage.getItem("camalote.demo.balances.v2:fer@camalote.xyz")));

await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n - " + errors.join("\n - ") : "Sin errores de consola.");
