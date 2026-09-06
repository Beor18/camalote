/**
 * Graba el recorrido completo de un cobro en modo demo, como en un teléfono:
 * Fer crea el link, el cliente lo paga con su email, Fer lo ve "Pagado".
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
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: { width: 780, height: 1688 } },
  locale: "es-AR",
});
const page = await context.newPage();
const hold = (ms) => page.waitForTimeout(ms);
const type = (sel, text) => page.type(sel, text, { delay: 55 });

// Escena 1: la landing, un vistazo
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await hold(1800);
await page.mouse.wheel(0, 500);
await hold(1400);

// Escena 2: Fer crea un link de cobro
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await hold(700);
await page.click("#email");
await type("#email", "fer@camalote.xyz");
await hold(400);
await page.click("button[type=submit]");
await page.waitForSelector("#cobro-amount", { timeout: 15000 });
await hold(900);
await page.click("#cobro-amount");
await type("#cobro-amount", "40");
await hold(300);
await page.click("#cobro-concept");
await type("#cobro-concept", "Diseño de logo");
await hold(500);
await page.click("button[type=submit]");
await page.waitForSelector("text=Tu link está listo", { timeout: 10000 });
await hold(2800);
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("camalote.paylinks.v1")));
const url = saved[0].url;

// Escena 3: el cliente abre el link y entra con su email
await page.goto(url, { waitUntil: "networkidle" });
await hold(600);
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await hold(900);
await page.click("#email");
await type("#email", "cliente@gmail.com");
await hold(400);
await page.click("button[type=submit]");
await page.waitForSelector("button[type=submit]:has-text('Pagar')", { timeout: 15000 });
await hold(2600);

// Escena 4: paga
await page.click("button[type=submit]:has-text('Pagar')");
await page.waitForSelector("text=¡Pagado!", { timeout: 30000 });
await hold(1200);
await page.mouse.wheel(0, 300);
await hold(2600);

// Escena 5: Fer ve el cobro pagado
await page.goto(`${BASE}/app/cobrar`, { waitUntil: "networkidle" });
await page.click("header button:has(svg.lucide-log-out)");
await page.waitForSelector("#email", { timeout: 10000 });
await hold(500);
await page.click("#email");
await type("#email", "fer@camalote.xyz");
await page.click("button[type=submit]");
await page.waitForSelector("text=Pagado", { timeout: 20000 });
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
