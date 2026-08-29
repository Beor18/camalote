#!/usr/bin/env node
/**
 * Genera los íconos PWA de Camalote (PNG) sin dependencias externas:
 * un encoder PNG mínimo (zlib de Node) + dibujo por píxel del isologo.
 *
 * Uso: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

// ——— PNG encoder ———
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ——— dibujo ———
const BG = [0x12, 0x10, 0x0e];
const STOPS = [
  [0x00, 0x52, 0xff], // Base
  [0x8b, 0x5c, 0xf6], // violeta Solana
  [0x14, 0xf1, 0x95], // verde Solana
];

function gradientAt(t) {
  const seg = t < 0.55 ? 0 : 1;
  const local = seg === 0 ? t / 0.55 : (t - 0.55) / 0.45;
  const [a, b] = [STOPS[seg], STOPS[seg + 1]];
  return a.map((v, i) => Math.round(v + (b[i] - v) * local));
}

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Distancia al arco (bezier cuadrática muestreada) y avance t sobre la curva. */
function arcDistance(px, py, p0, p1, p2, samples = 200) {
  let best = Infinity;
  let bestT = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    const d = Math.hypot(px - x, py - y);
    if (d < best) {
      best = d;
      bestT = t;
    }
  }
  return [best, bestT];
}

/** Distancia de un punto a un segmento vertical. */
function segDistance(px, py, x, y0, y1) {
  const cy = Math.min(Math.max(py, y0), y1);
  return Math.hypot(px - x, py - cy);
}

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  // zona segura maskable: el arte se encoge al 72 %
  const scale = maskable ? 0.72 : 1;
  const offset = (size * (1 - scale)) / 2;

  const u = (v) => offset + (v / 32) * size * scale; // coords del SVG (viewBox 32)
  // el agua: dos ondas encadenadas, azul Base → verde Solana
  const waveL = [[u(3), u(25)], [u(9.5), u(22.4)], [u(16), u(25)]];
  const waveR = [[u(16), u(25)], [u(22.5), u(27.6)], [u(29), u(25)]];
  const waveW = ((2.5 / 32) * size * scale) / 2;
  // la hoja que flota
  const leaf = { cx: u(17), cy: u(19), rx: (8 / 32) * size * scale, ry: (3.8 / 32) * size * scale };
  const LEAF = [0x14, 0xf1, 0x95];
  // tallo y flor violeta
  const stem = { x: u(17), y0: u(12.6), y1: u(16), w: ((1.8 / 32) * size * scale) / 2 };
  const flower = { cx: u(17), cy: u(10), r: (3 / 32) * size * scale };
  const VIOLET = [0x8b, 0x5c, 0xf6];
  const aa = Math.max(1, size / 256);

  const mix = (base, color, cov) => base.map((v, i) => Math.round(v + (color[i] - v) * cov));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // máscara de esquinas redondeadas
      let alpha = 1;
      if (radius > 0) {
        const cx = Math.min(Math.max(x, radius), size - radius);
        const cy = Math.min(Math.max(y, radius), size - radius);
        const d = Math.hypot(x - cx, y - cy);
        alpha = 1 - smoothstep(radius - aa, radius + aa, d);
      }
      const px = x + 0.5;
      const py = y + 0.5;
      let rgb = [...BG];

      // agua con gradiente a lo largo de las dos ondas
      const [dL, tL] = arcDistance(px, py, ...waveL, 60);
      const [dR, tR] = arcDistance(px, py, ...waveR, 60);
      const [wDist, wT] = dL <= dR ? [dL, tL / 2] : [dR, 0.5 + tR / 2];
      const waveCov = 1 - smoothstep(waveW - aa, waveW + aa, wDist);
      if (waveCov > 0) rgb = mix(rgb, gradientAt(wT), waveCov);

      // hoja (elipse): distancia aproximada en píxeles al borde
      const ev = Math.hypot((px - leaf.cx) / leaf.rx, (py - leaf.cy) / leaf.ry);
      const eDist = (ev - 1) * Math.min(leaf.rx, leaf.ry);
      const leafCov = 1 - smoothstep(-aa, aa, eDist);
      if (leafCov > 0) rgb = mix(rgb, LEAF, leafCov);

      // tallo
      const sDist = segDistance(px, py, stem.x, stem.y0, stem.y1);
      const stemCov = 1 - smoothstep(stem.w - aa, stem.w + aa, sDist);
      if (stemCov > 0) rgb = mix(rgb, VIOLET, stemCov);

      // flor
      const fDist = Math.hypot(px - flower.cx, py - flower.cy);
      const flowerCov = 1 - smoothstep(flower.r - aa, flower.r + aa, fDist);
      if (flowerCov > 0) rgb = mix(rgb, VIOLET, flowerCov);

      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

/** ICO conteniendo un único PNG (válido en todos los browsers modernos). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  // ICONDIR: reserved=0, type=1 (ícono), count=1
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  // ICONDIRENTRY
  header[6] = size === 256 ? 0 : size; // ancho
  header[7] = size === 256 ? 0 : size; // alto
  header.writeUInt16LE(1, 10); // planos de color
  header.writeUInt16LE(32, 12); // bits por píxel
  header.writeUInt32LE(png.length, 14); // tamaño de la imagen
  header.writeUInt32LE(22, 18); // offset de la imagen
  return Buffer.concat([header, png]);
}

const outputs = [
  ["icon-192.png", drawIcon(192)],
  ["icon-512.png", drawIcon(512)],
  ["icon-maskable-512.png", drawIcon(512, { maskable: true })],
  ["apple-touch-icon.png", drawIcon(180)],
];

for (const [name, buf] of outputs) {
  writeFileSync(join(OUT_DIR, name), buf);
  console.log(`✓ public/icons/${name} (${(buf.length / 1024).toFixed(1)} KiB)`);
}

const favicon = pngToIco(drawIcon(32), 32);
writeFileSync(join(OUT_DIR, "..", "..", "src", "app", "favicon.ico"), favicon);
console.log(`✓ src/app/favicon.ico (${(favicon.length / 1024).toFixed(1)} KiB)`);
