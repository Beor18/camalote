/**
 * Pasa el pitch deck a PDF: una página por slide visible, 1920×1080, con
 * fondos. Las notas privadas no se cargan, así que nunca entran al archivo.
 *
 * Los títulos con degradé (background-clip:text) no salen igual en todos los
 * lectores de PDF: según el motor dejan una línea alrededor de la caja, se
 * vuelven un rectángulo o desaparecen (probado con PDFium, MuPDF, Poppler y
 * Ghostscript; en SVG pasa lo mismo). Para el PDF se capturan como imagen a 3x,
 * con fondo transparente, tal como los dibuja Chrome en pantalla. Todo lo demás
 * sigue siendo texto.
 *
 * Uso: node scripts/pitch-pdf.mjs   (deja docs/hackathon/pitch/camalote-pitch.pdf)
 */
import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DECK = resolve("docs/hackathon/pitch/index.html");
const OUT = resolve("docs/hackathon/pitch/camalote-pitch.pdf");

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/notas-privadas.js", (route) => route.abort());
await page.goto(pathToFileURL(DECK).href, { waitUntil: "networkidle" });
await page.addStyleTag({ content: ".slide { transition: none !important; }" });
// Sin fondo de página mientras se capturan los títulos; el PDF lo pone la regla de impresión.
const capture = await page.addStyleTag({ content: "html, body { background: transparent !important; }" });

const gradients = await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
  const found = [...document.querySelectorAll(".slide *")].filter((el) => {
    const css = getComputedStyle(el);
    return css.webkitBackgroundClip === "text" || css.backgroundClip === "text";
  });
  found.forEach((el, k) => el.setAttribute("data-pdf-gradient", String(k)));
  return found.length;
});

for (let k = 0; k < gradients; k += 1) {
  const target = page.locator(`[data-pdf-gradient="${k}"]`);
  // Se muestra solo esa slide, sin su fondo, para que la imagen quede transparente.
  await target.evaluate((el) => {
    const slide = el.closest(".slide");
    document.querySelectorAll(".slide").forEach((s) => s.classList.toggle("on", s === slide));
    slide.dataset.pdfBackground = slide.style.background;
    slide.style.background = "transparent";
  });
  const png = await target.screenshot({ omitBackground: true });
  await target.evaluate((el, src) => {
    const slide = el.closest(".slide");
    slide.style.background = slide.dataset.pdfBackground;
    delete slide.dataset.pdfBackground;
    const box = el.getBoundingClientRect();
    const img = document.createElement("img");
    img.src = src;
    img.alt = el.textContent;
    img.width = box.width;
    img.height = box.height;
    img.style.display = "block";
    el.style.background = "none";
    el.replaceChildren(img);
  }, `data:image/png;base64,${png.toString("base64")}`);
}

await capture.evaluate((el) => el.remove());

const report = await page.evaluate(async () => {
  await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
  return {
    slides: [...document.querySelectorAll(".slide")].map((s) => s.id),
    brokenImages: [...document.images].filter((img) => !img.naturalWidth).map((img) => img.src.slice(0, 80)),
  };
});

await page.emulateMedia({ media: "print" });
await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });
await browser.close();

console.log(`${report.slides.length} slides: ${report.slides.join(", ")}`);
console.log(`títulos con degradé pasados a imagen: ${gradients}`);
if (report.brokenImages.length) console.log("imágenes que no cargaron:", report.brokenImages);
if (errors.length) console.log("errores en la página:", errors);
console.log(`listo: ${OUT}`);
