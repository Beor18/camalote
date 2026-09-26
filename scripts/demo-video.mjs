/**
 * Graba el recorrido de Camalote en modo demo, como en un teléfono, con la
 * voz del pitch encima: la landing, entrar con el email, armar la regla,
 * llegan USDC y una parte se compra sola, la cartera, la operación con su
 * comprobante y el cierre.
 *
 * Uso: node scripts/demo-video.mjs <carpeta-salida> [http://localhost:3001]
 * Requiere el dev server en modo demo y ffmpeg para el MP4 final.
 *
 * La voz sale de edge-tts (`pip3 install --user edge-tts`, usa internet) con
 * el guion de `scripts/demo-pitch.mjs`; cada escena dura al menos lo que
 * dura su frase. Sin edge-tts, o con CAMALOTE_VOICE=off, el video sale mudo.
 * Sale en inglés, como abre la app. Para la versión en castellano (muda,
 * no hay guion en castellano): CAMALOTE_LANG=es node scripts/demo-video.mjs docs/demo
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { PITCH, VOICES } from "./demo-pitch.mjs";

const OUT = process.argv[2] ?? "docs/demo";
const BASE = process.argv[3] ?? "http://localhost:3001";
const LANG = process.env.CAMALOTE_LANG === "es" ? "es" : "en";
const WANT_VOICE = process.env.CAMALOTE_VOICE !== "off";
/** Silencio después de cada frase antes de pasar a la siguiente escena. */
const BREATH_MS = 700;
mkdirSync(OUT, { recursive: true });

// --- La voz: un clip por escena, cacheado por texto -------------------------

function clipMs(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]).toString().trim();
  return Math.round(Number(out) * 1000);
}

function prepareVoice() {
  const lines = PITCH[LANG];
  if (!WANT_VOICE || !lines) return null;
  const dir = join(OUT, "voice");
  mkdirSync(dir, { recursive: true });
  const clips = [];
  for (const [i, line] of lines.entries()) {
    const base = join(dir, `${String(i + 1).padStart(2, "0")}-${line.name}`);
    const mp3 = `${base}.mp3`;
    const txt = `${base}.txt`;
    const key = `${VOICES[LANG]}\n${line.text}`;
    const cached = existsSync(mp3) && existsSync(txt) && readFileSync(txt, "utf8") === key;
    if (!cached) {
      try {
        execFileSync("python3", [
          "-m", "edge_tts", "--voice", VOICES[LANG],
          "--text", line.text, "--write-media", mp3,
        ], { stdio: ["ignore", "ignore", "pipe"] });
        writeFileSync(txt, key);
      } catch (err) {
        console.log("sin voz: edge-tts falló", String(err.stderr ?? err.message).trim().split("\n").pop());
        return null;
      }
    }
    clips.push({ name: line.name, file: mp3, ms: clipMs(mp3) });
  }
  const total = clips.reduce((s, c) => s + c.ms, 0);
  console.log(`voz: ${clips.length} frases, ${(total / 1000).toFixed(1)} s`);
  return clips;
}

const voice = prepareVoice();

// --- La grabación ----------------------------------------------------------

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
  locale: LANG === "es" ? "es-AR" : "en-US",
});
// El idioma se fija como lo haría el usuario con el toggle (queda en el dispositivo).
await context.addInitScript((lang) => localStorage.setItem("camalote.lang", lang), LANG);
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
// El video arranca con la página: los tiempos de las escenas se miden desde acá.
const t0 = Date.now();
const hold = (ms) => page.waitForTimeout(ms);
const type = (sel, text) => page.type(sel, text, { delay: 55 });

/** Marca de tiempo de cada escena (para ubicar su frase en el audio). */
const marks = [];
let sceneIdx = -1;
let sceneStart = t0;
function scene(name) {
  sceneIdx += 1;
  sceneStart = Date.now();
  marks.push({ name, at: sceneStart - t0 });
  if (voice && voice[sceneIdx]?.name !== name) {
    throw new Error(`la escena ${name} no coincide con el guion (${voice[sceneIdx]?.name})`);
  }
}
/** Sostiene la escena hasta que su frase terminó (más un respiro). */
async function endScene(minMs = 0) {
  const spoken = voice ? voice[sceneIdx].ms + BREATH_MS : 0;
  const remaining = Math.max(minMs, spoken) - (Date.now() - sceneStart);
  if (remaining > 0) await hold(remaining);
}

// Escena 1: la landing, un vistazo
scene("landing");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await hold(1800);
await page.mouse.wheel(0, 500);
await endScene(3200);

// Escena 2: entra con su email
scene("login");
await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await hold(700);
await page.click("#email");
await type("#email", "fer@camalote.xyz");
await hold(400);
await page.click("button[type=submit]");
await page.waitForSelector("[data-testid=rule-toggle]", { timeout: 15000 });
await endScene(2300);

// Escena 3: arma su regla, el 30 % de lo que le llega al S&P 500 (y mira las pre-IPO)
scene("rule");
await page.click("[data-testid=rule-toggle]");
await page.waitForSelector("[data-testid=rule-sheet][open]", { timeout: 10000 });
await hold(900);
await page.click("[data-testid=rule-percent-30]");
await hold(900);
await page.click("[data-testid=rule-group-preipo]");
await hold(2200);
await page.click("[data-testid=rule-group-stock]");
await hold(600);
await page.click("[data-testid=rule-asset-SPYx]");
await endScene(4200);
await page.click("[data-testid=rule-done]");
await hold(1000);

// Escena 4: le llegan 40 USDC y el 30 % se compra solo
scene("incoming");
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
await endScene(3000);

// Escena 5: la cartera
scene("portfolio");
await page.locator("[data-testid=invest-portfolio]").scrollIntoViewIfNeeded();
await endScene(2600);

// Escena 6: la operación con su comprobante
scene("receipt");
await page.locator("[data-testid=invest-purchases]").scrollIntoViewIfNeeded();
await endScene(3200);

// Escena 7: el cierre de la landing
scene("closing");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.locator("a[href='/app']").last().scrollIntoViewIfNeeded();
await endScene(3000);
await hold(600);

await context.close();
await browser.close();

// --- El armado -------------------------------------------------------------

const webm = await page.video().path();
const suffix = LANG === "es" ? "-es" : "";
const finalWebm = join(OUT, `camalote-demo${suffix}.webm`);
renameSync(webm, finalWebm);
writeFileSync(join(OUT, `camalote-demo${suffix}.scenes.json`), JSON.stringify(marks, null, 2));
const mp4 = join(OUT, `camalote-demo${suffix}.mp4`);

const video = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
let args;
if (voice) {
  // Cada frase entra en el segundo en que empezó su escena, con una
  // sonoridad pareja. La pista de audio termina con la última frase; el
  // video sigue mudo hasta el final (sin `apad` + `-shortest`, que en
  // ffmpeg 4.4 no corta nunca).
  const inputs = voice.flatMap((c) => ["-i", c.file]);
  const delayed = voice
    .map((c, i) => `[${i + 1}:a]adelay=${marks[i].at}|${marks[i].at}[a${i + 1}]`)
    .join(";");
  const labels = voice.map((_, i) => `[a${i + 1}]`).join("");
  const filter =
    `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[v];${delayed};` +
    `${labels}amix=inputs=${voice.length}:normalize=0:dropout_transition=0,` +
    `loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
  args = [
    "-y", "-loglevel", "error", "-i", finalWebm, ...inputs,
    "-filter_complex", filter, "-map", "[v]", "-map", "[a]",
    ...video, "-c:a", "aac", "-b:a", "128k", mp4,
  ];
} else {
  args = [
    "-y", "-loglevel", "error", "-i", finalWebm,
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", ...video, mp4,
  ];
}
try {
  execFileSync("ffmpeg", args);
  console.log(`✓ video${voice ? " con voz" : " mudo"}:`, mp4);
} catch (err) {
  console.log("ffmpeg falló; quedó el webm:", finalWebm, String(err.stderr ?? "").trim());
}
