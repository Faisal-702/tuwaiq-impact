/**
 * Performance probe: hard page loads, client-side navigations and a server
 * action, with the number of SQL statements each one runs (read from the
 * Postgres log when PG_LOG points to it and log_min_duration_statement = 0).
 *
 *   BASE_URL=http://localhost:3001 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     PG_LOG=/var/log/postgresql/postgresql-16-main.log node tests/perf/measure.mjs > result.json
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { adminCredentials, signInAdmin } from "../e2e/lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const PG_LOG = process.env.PG_LOG;
const ROUNDS = Number(process.env.ROUNDS ?? 3);

const logSize = () => (PG_LOG ? fs.statSync(PG_LOG).size : 0);
function queriesSince(offset) {
  if (!PG_LOG) return null;
  const fd = fs.openSync(PG_LOG, "r");
  const size = fs.statSync(PG_LOG).size;
  const buf = Buffer.alloc(Math.max(0, size - offset));
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  return buf.toString("utf8").split("\n").filter((l) => /duration: .* (statement|execute)/.test(l)).length;
}
const settle = () => new Promise((r) => setTimeout(r, 250));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
await context.addCookies([{ name: "ti_lang", value: "en", url: BASE }]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE + "/welcome?mode=admin");
await signInAdmin(page, ADMIN);
await page.waitForURL(BASE + "/admin");

const out = { base: BASE, hard: {}, nav: [], publicNav: [], action: {} };

// 1) Hard (full document) loads: server time to first byte.
const HARD = ["/admin", "/admin/projects", "/admin/students", "/admin/student-codes", "/admin/categories", "/admin/suggestions",
  "/admin/leaderboard", "/admin/analytics", "/admin/activity", "/admin/trash", "/admin/settings", "/home", "/projects", "/students", "/leaderboard"];
for (const path of HARD) await page.goto(BASE + path); // warm-up (dev compiles on first hit)
for (const path of HARD) {
  const ttfb = [], total = [], q = [];
  for (let i = 0; i < ROUNDS; i++) {
    await settle();
    const off = logSize();
    const t0 = Date.now();
    await page.goto(BASE + path, { waitUntil: "load" });
    total.push(Date.now() - t0);
    ttfb.push(await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return Math.round(n.responseStart - n.requestStart); }));
    await settle();
    q.push(queriesSince(off));
  }
  out.hard[path] = { ttfb: median(ttfb), load: median(total), queries: median(q) };
}

// 2) Client-side navigation through the admin sidebar (two rounds).
const SIDEBAR = ["Manage Projects", "Students", "Categories", "Suggestions", "Student Codes", "Leaderboard", "Analytics", "Activity Log", "Trash", "Settings", "Overview"];
/**
 * Clicks a navigation link and measures (a) the first visible reaction (URL
 * or page content changes) and (b) when the new page's content is rendered:
 * the old page's headings (tagged before the click) are gone and the new
 * page shows its own heading.
 */
async function clickNav(container, name, list) {
  const before = page.url();
  await page.evaluate(() => { for (const el of document.querySelectorAll("main h1, main h2")) el.setAttribute("data-perf-old", ""); });
  await settle();
  const off = logSize();
  const t0 = Date.now();
  await page.locator(container).getByRole("link", { name, exact: true }).first().click();
  const changed = "!document.querySelector('main h1, main h2')?.hasAttribute('data-perf-old')";
  await page.waitForFunction(`location.href !== ${JSON.stringify(before)} || ${changed}`, null, { polling: 16 });
  const feedback = Date.now() - t0;
  // Real content: a heading that was not on the old page, outside any loading skeleton.
  await page.waitForFunction(`(() => { const h = document.querySelector('main h1, main h2'); return h && !h.hasAttribute('data-perf-old') && !h.closest('[aria-busy="true"]') && h.textContent.trim() !== ''; })()`, null, { polling: 16 });
  const content = Date.now() - t0;
  await settle();
  list.push({ to: name, feedback, content, queries: queriesSince(off) });
}
await page.goto(BASE + "/admin");
for (let round = 1; round <= 2; round++) for (const name of SIDEBAR) await clickNav("aside", name, out.nav), (out.nav.at(-1).round = round);
await page.goto(BASE + "/admin/categories");

// 2b) A click after 25 s of inactivity (idle database connections may have been closed).
if (process.env.IDLE_CHECK !== "0") {
  await page.waitForTimeout(25000);
  await clickNav("aside", "Students", out.nav);
  out.nav.at(-1).round = "idle";
}

// 3) Client-side navigation on the public site.
await page.goto(BASE + "/home");
const PUBLIC = ["Explore Projects", "Students", "Leaderboard", "About", "Home"];
for (let round = 1; round <= 2; round++) for (const name of PUBLIC) await clickNav("header nav", name, out.publicNav), (out.publicNav.at(-1).round = round);

// 4) A server action: Settings → Save defaults (until the toast).
await page.goto(BASE + "/admin/settings");
// (Saving with an empty academic year fails on this codebase; use a value.)
if (!(await page.locator("#set-year").inputValue())) await page.locator("#set-year").fill("2025–2026");
const act = [];
for (let i = 0; i < ROUNDS; i++) {
  await settle();
  const off = logSize();
  const t0 = Date.now();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.getByText("Settings saved").last().waitFor();
  act.push({ ms: Date.now() - t0 });
  await page.waitForTimeout(1200);
  act.at(-1).queries = queriesSince(off);
  await page.getByText("Settings saved").last().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
}
out.action.settingsSave = { ms: median(act.map((a) => a.ms)), queries: median(act.map((a) => a.queries)) };

out.errors = errors;
await browser.close();
console.log(JSON.stringify(out, null, 2));
