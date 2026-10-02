/**
 * Session & entry behaviour checks.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_CODE=… node tests/e2e/session.mjs
 *
 * "Closing and reopening the browser" is simulated the way browsers do it:
 * the next context keeps only cookies that have an expiry (persistent
 * cookies) and drops browser-session cookies.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!CODE) throw new Error("ADMIN_CODE is required");

const results = [];
const errors = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`);
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const path = (page) => new URL(page.url()).pathname;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function newBrowserSession(cookies = []) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  if (cookies.length) await context.addCookies(cookies);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}
/** Cookies a real browser would keep after being closed and reopened. */
const survivingRestart = (cookies) => cookies.filter((c) => c.expires !== -1);

async function adminLogin(page) {
  await page.goto(BASE + "/welcome");
  await page.getByLabel("Access Code").fill(CODE);
  await page.getByRole("button", { name: "Access Dashboard" }).click();
  await page.waitForURL(BASE + "/admin");
  await page.getByRole("heading", { name: "Overview" }).waitFor();
}

// ---------------------------------------------------------------------------
let s = await newBrowserSession();

await check("/ redirects to /welcome", async () => {
  await s.page.goto(BASE + "/");
  assert(path(s.page) === "/welcome", s.page.url());
  await s.page.getByRole("button", { name: "Access Dashboard" }).waitFor();
});

await check("/welcome shows the entry page", async () => {
  const res = await s.page.goto(BASE + "/welcome");
  assert(res.status() === 200 && path(s.page) === "/welcome", s.page.url());
  await s.page.getByRole("tab", { name: "Continue as Guest" }).waitFor();
});

await check("Any public page on a new visit starts at /welcome", async () => {
  await s.page.goto(BASE + "/projects");
  assert(path(s.page) === "/welcome", s.page.url());
});

await check("Direct /admin without login redirects to /welcome", async () => {
  await s.page.goto(BASE + "/admin");
  assert(path(s.page) === "/welcome", s.page.url());
  await s.page.goto(BASE + "/admin/projects/new");
  assert(path(s.page) === "/welcome", s.page.url());
});

await check("Wrong code does not grant access", async () => {
  await s.page.goto(BASE + "/welcome");
  await s.page.getByLabel("Access Code").fill("0000-wrong");
  await s.page.getByRole("button", { name: "Access Dashboard" }).click();
  await s.page.getByText("Invalid access code. Please contact the administrator.").waitFor();
  assert(!(await s.context.cookies()).some((c) => c.name === "ti_admin_sid"), "admin cookie set");
});

await check("Continue as Guest opens the public website (not admin)", async () => {
  await s.page.goto(BASE + "/welcome");
  await s.page.getByRole("tab", { name: "Continue as Guest" }).click();
  await s.page.getByRole("button", { name: "Continue as Guest" }).click();
  await s.page.waitForURL(BASE + "/home");
  await s.page.getByRole("heading", { name: /Student Ideas/ }).waitFor();
  assert((await s.page.getByRole("link", { name: "Dashboard" }).count()) === 0, "dashboard link shown to guest");
  await s.page.goto(BASE + "/projects");
  assert(path(s.page) === "/projects", "guest cannot browse");
});

await check("Guest cannot open /admin", async () => {
  await s.page.goto(BASE + "/admin");
  assert(path(s.page) === "/welcome", s.page.url());
});

await check("Guest entry is a browser-session cookie", async () => {
  const visit = (await s.context.cookies()).find((c) => c.name === "ti_visit");
  assert(visit && visit.expires === -1 && visit.httpOnly, JSON.stringify(visit));
});

await check("Guest: closing and reopening the browser starts at /welcome", async () => {
  const kept = survivingRestart(await s.context.cookies());
  await s.context.close();
  s = await newBrowserSession(kept);
  await s.page.goto(BASE + "/home");
  assert(path(s.page) === "/welcome", s.page.url());
});

// ---------------------------------------------------------------------------
await check("Admin login with the configured code opens /admin", async () => {
  await adminLogin(s.page);
});

await check("Admin session cookie is httpOnly and browser-session only", async () => {
  const sid = (await s.context.cookies()).find((c) => c.name === "ti_admin_sid");
  assert(sid && sid.httpOnly && sid.expires === -1 && sid.sameSite === "Lax", JSON.stringify(sid));
});

await check("Returning to the site in the same session shows /welcome, not /admin", async () => {
  await s.page.goto(BASE + "/");
  assert(path(s.page) === "/welcome", s.page.url());
  await s.page.goto(BASE + "/welcome");
  await s.page.waitForTimeout(500);
  assert(path(s.page) === "/welcome", "welcome auto-redirected to " + s.page.url());
  await s.page.getByRole("button", { name: "Access Dashboard" }).waitFor();
});

await check("Valid current session keeps admin access during the browser session", async () => {
  await s.page.goto(BASE + "/admin/projects");
  assert(path(s.page) === "/admin/projects", s.page.url());
});

let previousAdminCookies = [];
await check("Admin: closing and reopening the browser requires the code again", async () => {
  previousAdminCookies = await s.context.cookies();
  const kept = survivingRestart(previousAdminCookies);
  assert(!kept.some((c) => c.name === "ti_admin_sid"), "admin cookie survived restart");
  await s.context.close();
  s = await newBrowserSession(kept);
  await s.page.goto(BASE + "/");
  assert(path(s.page) === "/welcome", s.page.url());
  await s.page.goto(BASE + "/admin");
  assert(path(s.page) === "/welcome", s.page.url());
});

await check("Logout clears the session and redirects to /welcome", async () => {
  await adminLogin(s.page);
  const token = (await s.context.cookies()).find((c) => c.name === "ti_admin_sid")?.value;
  await s.page.getByRole("button", { name: "Sign out" }).click();
  await s.page.waitForURL(BASE + "/welcome");
  const names = (await s.context.cookies()).map((c) => c.name);
  assert(!names.includes("ti_admin_sid") && !names.includes("ti_visit"), `cookies left: ${names}`);
  await s.page.goto(BASE + "/admin");
  assert(path(s.page) === "/welcome", s.page.url());
  // The old token is revoked server-side, even if someone kept a copy.
  const replay = await newBrowserSession([{ name: "ti_admin_sid", value: token, url: BASE }]);
  await replay.page.goto(BASE + "/admin");
  assert(path(replay.page) === "/welcome", "revoked token still works: " + replay.page.url());
  await replay.context.close();
});

await check("Continue as Guest after an admin login ends the admin session", async () => {
  await adminLogin(s.page);
  await s.page.goto(BASE + "/welcome");
  await s.page.getByRole("tab", { name: "Continue as Guest" }).click();
  await s.page.getByRole("button", { name: "Continue as Guest" }).click();
  await s.page.waitForURL(BASE + "/home");
  assert(!(await s.context.cookies()).some((c) => c.name === "ti_admin_sid"), "admin cookie kept");
  await s.page.goto(BASE + "/admin");
  assert(path(s.page) === "/welcome", s.page.url());
});

await check("Old persistent cookies from the previous version are ignored and removed", async () => {
  const legacy = await newBrowserSession([
    { name: "ti_entry", value: "1", url: BASE, expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 300 },
    { name: "ti_admin_session", value: "legacy-token-legacy-token-legacy-token", url: BASE, expires: Math.floor(Date.now() / 1000) + 3600 },
  ]);
  await legacy.page.goto(BASE + "/home");
  assert(path(legacy.page) === "/welcome", legacy.page.url());
  await legacy.page.goto(BASE + "/admin");
  assert(path(legacy.page) === "/welcome", legacy.page.url());
  const names = (await legacy.context.cookies()).map((c) => c.name);
  assert(!names.includes("ti_entry") && !names.includes("ti_admin_session"), `legacy cookies left: ${names}`);
  await legacy.context.close();
});

await s.context.close();
await browser.close();

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} session checks passed`);
console.log(`Console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
