/**
 * Graba el recorrido de Camalote en modo demo, como en un teléfono: la
 * landing, entrar con el email, armar la regla, llegan USDC y una parte se
 * compra sola, la cartera y la operación con su comprobante.
 *
 * Uso: node scripts/demo-video.mjs <carpeta-salida> [http://localhost:3001]
 * Requiere el dev server en modo demo y ffmpeg para el MP4 final.
 */
import { chromium } from "playwright-core";
import { mkdirSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const OUT = process.argv[2] ?? "docs/demo";
const BASE = process.argv[3] ?? "http://localhost:3001";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  // Playwright graba en píxeles CSS y no escala hacia arriba: para un video
  // nítido de 780x1688 hay que forzar el factor de escala en Chrome.
  args: ["--no-sandbox", "--force-device-scale-factor=2"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: { width: 780, height: 1688 } },
  locale: "es-AR",
});
// El botón "N" de las herramientas de desarrollo de Next no va en el video.
await context.addInitScript(() => {
  const hide = () =>
    document
      .querySelectorAll("nextjs-portal")
      .forEach((el) => (el.style.display = "none"));
  const start = () => {
    hide();
    new MutationObserver(hide).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start);
});
const page = await context.newPage();
const hold = (ms) => page.waitForTimeout(ms);
const type = (sel, text) => page.type(sel, text, { delay: 55 });

// Escena 1: la landing, un vistazo
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await hold(1800);
await page.mouse.wheel(0, 500);
await hold(1400);

// Escena 2: Fer entra con su email
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await hold(700);
await page.click("#email");
await type("#email", "fer@camalote.xyz");
await hold(400);
await page.click("button[type=submit]");
await page.waitForSelector("[data-testid=rule-toggle]", { timeout: 15000 });
await hold(1600);

// Escena 3: arma su regla, el 30 % de lo que le llega al S&P 500
await page.click("[data-testid=rule-toggle]");
await hold(900);
await page.click("[data-testid=rule-percent-30]");
await hold(700);
await page.click("[data-testid=rule-asset-SPYx]");
await hold(2200);

// Escena 4: le llegan 40 USDC y el 30 % se compra solo
await page.locator("[data-testid=invest-account]").scrollIntoViewIfNeeded();
await hold(600);
await page.click("[data-testid=simulate-incoming]");
await page.waitForFunction(
  () =>
    Object.entries(localStorage).some(
      ([k, v]) => k.startsWith("camalote.invest.purchases.v1:") && v.includes('"status":"done"')
    ),
  null,
  { timeout: 40000 }
);
await hold(1200);

// Escena 5: la cartera y la operación con su comprobante
await page.locator("[data-testid=invest-portfolio]").scrollIntoViewIfNeeded();
await hold(2600);
await page.locator("[data-testid=invest-purchases]").scrollIntoViewIfNeeded();
await hold(3200);

await context.close();
await browser.close();

const webm = await page.video().path();
const finalWebm = join(OUT, "camalote-demo.webm");
renameSync(webm, finalWebm);
const mp4 = join(OUT, "camalote-demo.mp4");
try {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", finalWebm,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    mp4,
  ]);
  console.log("✓ video:", mp4);
} catch {
  console.log("ffmpeg no disponible; quedó el webm:", finalWebm);
}
