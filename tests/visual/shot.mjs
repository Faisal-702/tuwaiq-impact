// Usage: node tests/visual/shot.mjs <url-path> <out.png> [width] [height] [lang] [fullPage] [cookies]
import { chromium } from "playwright";

const [, , path = "/", out = "shot.png", w = "1440", h = "900", lang = "en", full = "0", entry = "1"] = process.argv;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const cookies = [{ name: "ti_lang", value: lang, url: base }];
if (entry === "1") cookies.push({ name: "ti_entry", value: "1", url: base });
if (process.env.ADMIN_TOKEN) cookies.push({ name: "ti_admin_session", value: process.env.ADMIN_TOKEN, url: base });
await context.addCookies(cookies);
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(base + path, { waitUntil: "networkidle" });
if (full === "1") {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
}
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: full === "1" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(JSON.stringify({ url: page.url(), overflowX: overflow, errors }, null, 1));
await browser.close();
