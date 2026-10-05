/**
 * Administrator sign-in with email + password (Supabase Auth users).
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *     node --env-file-if-exists=.env.local tests/e2e/admin-login.mjs
 *
 * Optional: MOCK_AUTH_URL=http://127.0.0.1:54399 when the server runs against
 * tests/e2e/mock-supabase-auth.mjs (checks the Supabase session is revoked);
 * DATABASE_URL to check the stored session.
 */
import { chromium } from "playwright";
import { adminCredentials, fillAdminLogin, randomClientIp } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const MOCK = process.env.MOCK_AUTH_URL;

const results = [];
const errors = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(true);
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push(false);
    console.log(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`);
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const path = (page) => new URL(page.url()).pathname;

let sql = null;
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import("postgres");
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function open(lang = "en", ip = randomClientIp()) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": ip } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}
/** Submits the admin form and waits until the answer has been rendered. */
async function submit(page, creds) {
  const form = page.locator("form[data-attempt]");
  const before = Number(await form.getAttribute("data-attempt"));
  await fillAdminLogin(page, creds);
  await page.waitForFunction((n) => Number(document.querySelector("form[data-attempt]")?.getAttribute("data-attempt")) > n, before);
}
const message = (page) => page.locator("#admin-login-message");

for (const [lang, L] of [
  ["en", { tab: "Admin Access", email: "Email", password: "Password", submit: "Access Dashboard", invalid: "Incorrect email or password." }],
  ["ar", { tab: "دخول المسؤول", email: "البريد الإلكتروني", password: "كلمة المرور", submit: "الدخول إلى لوحة التحكم", invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة." }],
]) {
  const { context, page } = await open(lang);
  await check(`${lang.toUpperCase()} · Admin Access shows Email and Password (no access code)`, async () => {
    await page.goto(BASE + "/welcome");
    await page.getByRole("tab", { name: L.tab }).click();
    await page.getByLabel(L.email, { exact: true }).waitFor();
    await page.getByLabel(L.password, { exact: true }).waitFor();
    assert((await page.locator("#admin-email").getAttribute("type")) === "email", "email type");
    assert((await page.locator("#admin-password").getAttribute("type")) === "password", "password masked");
    assert((await page.locator("#admin-password").getAttribute("autocomplete")) === "current-password", "autocomplete");
    assert((await page.locator("#access-code").count()) === 0, "old access code field still present");
    await page.getByRole("button", { name: L.submit }).waitFor();
  });
  await check(`${lang.toUpperCase()} · wrong password: generic error, email kept, no session`, async () => {
    await submit(page, { email: ADMIN.email, password: "definitely-wrong" });
    await message(page).filter({ hasText: L.invalid }).waitFor();
    assert(path(page) === "/welcome", page.url());
    assert(!(await context.cookies()).some((c) => c.name === "ti_admin_sid"), "admin cookie set");
  });
  await context.close();
}

await check("Unknown email gets the same generic error (no account enumeration)", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await submit(page, { email: "nobody-here@example.com", password: ADMIN.password });
  assert((await message(page).innerText()).trim() === "Incorrect email or password.", "different message");
  await submit(page, { email: "not-an-email", password: "x" });
  assert((await message(page).innerText()).trim() === "Incorrect email or password.", "malformed email message");
  await context.close();
});

await check("Empty fields show a prompt", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await page.getByRole("button", { name: "Access Dashboard" }).click();
  await message(page).filter({ hasText: "Please enter your email and password." }).waitFor();
  await context.close();
});

await check("Show/hide password toggle", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await page.locator("#admin-password").fill("abc");
  await page.getByRole("button", { name: "Show password" }).click();
  assert((await page.locator("#admin-password").getAttribute("type")) === "text", "not shown");
  await page.getByRole("button", { name: "Hide password" }).click();
  assert((await page.locator("#admin-password").getAttribute("type")) === "password", "not hidden");
  await context.close();
});

let logoutsBefore = 0;
if (MOCK) logoutsBefore = (await (await fetch(MOCK + "/__stats")).json()).logout;

await check("Correct email + password opens the dashboard (email is case-insensitive)", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, { email: `  ${ADMIN.email.toUpperCase()} `, password: ADMIN.password });
  await page.waitForURL(BASE + "/admin");
  await page.getByRole("heading", { name: "Overview" }).waitFor();
  const sid = (await context.cookies()).find((c) => c.name === "ti_admin_sid");
  assert(sid && sid.httpOnly && sid.expires === -1 && sid.sameSite === "Lax", JSON.stringify(sid));
  // No Supabase tokens reach the browser.
  const names = (await context.cookies()).map((c) => c.name);
  assert(!names.some((n) => n.startsWith("sb-")), `supabase cookies: ${names}`);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  assert(!storage.includes("access_token"), "token in localStorage");
  // Activity log names the administrator.
  await page.goto(BASE + "/admin/activity");
  await page.getByText(ADMIN.email.toLowerCase()).first().waitFor();
  if (sql) {
    const [row] = await sql`select email, auth_user_id from admin_sessions order by created_at desc limit 1`;
    assert(row.email === ADMIN.email.toLowerCase() && row.auth_user_id, JSON.stringify(row));
  }
  await context.close();
});

if (MOCK) {
  await check("The temporary Supabase session is revoked right after sign-in", async () => {
    const end = Date.now() + 5000;
    let logouts = logoutsBefore;
    while (Date.now() < end && logouts <= logoutsBefore) {
      logouts = (await (await fetch(MOCK + "/__stats")).json()).logout;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(logouts > logoutsBefore, "no logout call");
  });
}

await check("Repeated failures are throttled per client (even the right password is refused)", async () => {
  const ip = randomClientIp();
  const { context, page } = await open("en", ip);
  await page.goto(BASE + "/welcome?mode=admin");
  let attempts = 0;
  let locked = false;
  while (!locked && attempts < 10) {
    attempts++;
    await submit(page, { email: ADMIN.email, password: `wrong-${attempts}` });
    locked = (await message(page).innerText()).includes("Too many attempts");
  }
  assert(locked && attempts === 10, `locked=${locked} after ${attempts}`);
  await submit(page, ADMIN);
  assert((await message(page).innerText()).includes("Too many attempts"), "valid password accepted while locked");
  assert(path(page) === "/welcome", "signed in while locked");
  await context.close();
  // Another client is unaffected.
  const other = await open("en");
  await other.page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(other.page, ADMIN);
  await other.page.waitForURL(BASE + "/admin");
  await other.context.close();
});

await browser.close();
if (sql) await sql.end();

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
