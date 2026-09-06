import { chromium } from "playwright-core";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
for (const [name, w, h, dark] of [["landing-desktop", 1280, 900, false], ["landing-mobile", 390, 844, false], ["landing-dark", 1280, 900, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? "dark" : "light" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(name + ": " + m.text()); });
  page.on("pageerror", (e) => errors.push(name + " pageerror: " + e.message));
  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name !== "landing-desktop" });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "landing ok, sin errores");
