import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const OUT = "/tmp/claude-1000/-home-fernando/14e3c200-1bda-4d2d-aad8-678a21009852/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});

const errors = [];

async function shot(name, { width, height, dark = false, drive } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${name}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[${name}] pageerror: ${err.message}`));
  await page.goto("http://localhost:3000" + (name.startsWith("app") ? "/app" : "/"), {
    waitUntil: "networkidle",
  });
  if (drive) await drive(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !name.startsWith("app") });
  await context.close();
  console.log("✓", name);
}


async function demoLogin(page) {
  await page.fill("#email", "demo@camalote.xyz");
  await page.click("button[type=submit]");
  await page.waitForSelector("#amount", { timeout: 10000 });
}

await shot("landing-desktop", { width: 1280, height: 900 });
await shot("landing-mobile", { width: 375, height: 800 });
await shot("landing-dark", { width: 1280, height: 900, dark: true });
await shot("app-login-mobile", { width: 375, height: 800 });

// flujo demo completo: login → monto → cotización
await shot("app-quote-desktop", {
  width: 1280,
  height: 900,
  drive: async (page) => {
    await demoLogin(page);
    await page.fill("#amount", "25");
    await page.waitForTimeout(1200);
  },
});

await shot("app-progress-mobile", {
  width: 375,
  height: 800,
  drive: async (page) => {
    await demoLogin(page);
    await page.fill("#amount", "25");
    await page.waitForTimeout(1200);
    await page.click("button[type=submit]");
    await page.waitForTimeout(3500); // en pleno paso "Circle certifica"
  },
});

await shot("app-done-desktop", {
  width: 1280,
  height: 900,
  drive: async (page) => {
    await demoLogin(page);
    await page.fill("#amount", "25");
    await page.waitForTimeout(1200);
    await page.click("button[type=submit]");
    await page.waitForSelector("text=¡Llegaron!", { timeout: 20000 });
  },
});

await shot("app-dark-desktop", {
  width: 1280,
  height: 900,
  dark: true,
  drive: async (page) => {
    await demoLogin(page);
    await page.fill("#amount", "120,50");
    await page.waitForTimeout(1200);
  },
});

await browser.close();
if (errors.length) {
  console.log("\nCONSOLE ERRORS:");
  for (const e of errors) console.log(" -", e);
} else {
  console.log("\nSin errores de consola.");
}
