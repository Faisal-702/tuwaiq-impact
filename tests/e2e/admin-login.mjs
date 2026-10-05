/**
 * Administrator sign-in: email + password (Supabase Auth users), then the
 * administrator's personal 8-digit verification code.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/admin-login.mjs
 *
 * Optional: MOCK_AUTH_URL=http://127.0.0.1:54399 when the server runs against
 * tests/e2e/mock-supabase-auth.mjs (checks the Supabase session is revoked,
 * and uses the mock's second administrator for first-sign-in and reset
 * checks); DATABASE_URL (+ SESSION_SECRET) to check stored rows and to clear
 * this run's failed attempts afterwards.
 */
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { adminCredentials, enterAdminCode, fillAdminLogin, randomClientIp, signInAdmin } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const MOCK = process.env.MOCK_AUTH_URL;
/** The mock's second administrator (see tests/e2e/mock-supabase-auth.mjs). */
const SECOND = { email: "second-admin@example.com", password: "Tuwaiq-Second-2026", code: "40718395" };
const OTHER_CODE = ADMIN.code === "62950417" ? "62950418" : "62950417";

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
const step = (page) => page.locator("form[data-step]").getAttribute("data-step");
const hasCookie = async (context, name) => (await context.cookies()).some((c) => c.name === name);
/** Submits the code step and waits until the answer has been rendered. */
async function submitCode(page, code, confirm) {
  const form = page.locator("form[data-attempt]");
  const before = Number(await form.getAttribute("data-attempt"));
  await page.locator("#admin-code").fill(code);
  if (confirm !== undefined) await page.locator("#admin-code-confirm").fill(confirm);
  await page.locator("#admin-code").press("Enter");
  await page.waitForFunction((n) => Number(document.querySelector("form[data-attempt]")?.getAttribute("data-attempt")) > n, before);
}

/** Per-account throttle keys (same derivation as src/server/admin-auth.ts). */
const accountKey = (userId) => createHash("sha256").update(`${process.env.SESSION_SECRET}|admin-account|${userId}`).digest("hex");
async function clearAccountFailures() {
  if (!sql || !process.env.SESSION_SECRET) return;
  const ids = await sql`select auth_user_id from admin_verification_codes`;
  const keys = ids.map((r) => accountKey(r.auth_user_id));
  if (keys.length) await sql`delete from admin_login_attempts where client_hash in ${sql(keys)}`;
}
await clearAccountFailures();

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
    assert((await step(page)) === "credentials", "code step shown after a wrong password");
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

await check("Email + password + verification code opens the dashboard (email is case-insensitive)", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await signInAdmin(page, { ...ADMIN, email: `  ${ADMIN.email.toUpperCase()} ` });
  await page.waitForURL(BASE + "/admin");
  assert(!(await hasCookie(context, "ti_admin_challenge")), "challenge cookie left behind");
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

for (const [lang, L] of [
  ["en", { title: "Additional Verification", label: "Personal verification code", submit: "Verify and continue", account: "Account" }],
  ["ar", { title: "التحقق الإضافي", label: "رمز التحقق الشخصي", submit: "تحقق ومتابعة", account: "الحساب" }],
]) {
  await check(`${lang.toUpperCase()} · Password alone does not open the dashboard: the code step follows`, async () => {
    const { context, page } = await open(lang);
    await page.goto(BASE + "/welcome?mode=admin");
    await fillAdminLogin(page, ADMIN);
    await page.locator('form[data-step="verify"]').waitFor();
    await page.getByRole("heading", { name: L.title }).waitFor();
    await page.getByLabel(L.label, { exact: true }).waitFor();
    await page.getByRole("button", { name: L.submit }).waitFor();
    assert((await page.getByTestId("admin-code-account").innerText()).includes(ADMIN.email.toLowerCase()), "account not shown");
    assert((await page.locator("#admin-code").getAttribute("type")) === "password", "code not masked");
    assert(!(await hasCookie(context, "ti_admin_sid")), "admin session before the code");
    const challenge = (await context.cookies()).find((c) => c.name === "ti_admin_challenge");
    assert(challenge?.httpOnly && challenge.sameSite === "Lax", JSON.stringify(challenge));
    // The dashboard stays closed; the entry page returns to the code step.
    await page.goto(BASE + "/admin");
    assert(path(page) === "/welcome", page.url());
    await page.locator('form[data-step="verify"]').waitFor();
    await context.close();
  });
}

await check("8-box code input: digits only, next box / Backspace, paste, max 8, active box", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  const boxes = page.locator("#admin-code + div > div");
  assert((await boxes.count()) === 8, "not 8 boxes");
  const filled = () => boxes.evaluateAll((bs) => bs.filter((b) => b.hasAttribute("data-filled")).length);
  const activeIndex = () => boxes.evaluateAll((bs) => bs.findIndex((b) => b.hasAttribute("data-active")));
  const input = page.locator("#admin-code");
  await input.focus();
  assert((await activeIndex()) === 0, "first box not highlighted");
  await page.keyboard.type("12a3");
  assert((await input.inputValue()) === "123" && (await filled()) === 3, "non-digits accepted or boxes not filled");
  assert((await activeIndex()) === 3, `active box ${await activeIndex()}`);
  await page.keyboard.press("Backspace");
  assert((await input.inputValue()) === "12" && (await filled()) === 2, "Backspace");
  await input.fill("\u0661\u0662\u0663\u0664 \u0665\u0666\u0667\u0668");
  assert((await input.inputValue()) === "12345678", `paste of Arabic digits with a space: ${await input.inputValue()}`);
  await page.keyboard.type("9");
  assert((await input.inputValue()).length === 8, "more than 8 digits");
  // Digits read left to right in both languages.
  assert((await page.locator("#admin-code").evaluate((el) => getComputedStyle(el.parentElement).direction)) === "ltr", "boxes not LTR");
  const text = await page.locator("form").innerText();
  assert(!/resend|sent to|code sent/i.test(text), "mentions sending a code");
  await context.close();
});

await check("AR · mobile (320 px): the 8 boxes fit without horizontal scrolling", async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: "ar", url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, `page scrolls horizontally by ${overflow}px`);
  const last = await page.locator("#admin-code + div > div").last().boundingBox();
  assert(last.x + last.width <= 320, "last box outside the screen");
  assert(!/أُرسل|إعادة الإرسال|تم إرسال/.test(await page.locator("form").innerText()), "mentions sending a code");
  await context.close();
});

await check("Wrong, malformed or empty code: refused, no session", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  await submitCode(page, "");
  assert((await message(page).innerText()).trim() === "Please enter your 8-digit verification code.", "empty");
  await submitCode(page, "1234");
  assert((await message(page).innerText()).trim() === "The verification code must be exactly 8 digits.", "format");
  await submitCode(page, ADMIN.code === "90817263" ? "90817264" : "90817263");
  assert((await message(page).innerText()).trim() === "Incorrect verification code.", "wrong");
  assert((await step(page)) === "verify", "left the code step after one wrong code");
  assert(!(await hasCookie(context, "ti_admin_sid")), "admin cookie set");
  // Reloading keeps the pending step; the right code still works.
  await page.reload();
  await page.locator('form[data-step="verify"]').waitFor();
  await enterAdminCode(page, ADMIN);
  await page.waitForURL(BASE + "/admin");
  await context.close();
});

await check("Arabic-Indic digits are accepted for the code", async () => {
  const { context, page } = await open("ar");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  await enterAdminCode(page, ADMIN, ADMIN.code.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d))));
  await page.waitForURL(BASE + "/admin");
  await context.close();
});

await check("“Back to sign in” ends the pending step", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.locator('form[data-step="credentials"]').waitFor();
  assert((await page.locator("#admin-email").inputValue()) === ADMIN.email.toLowerCase(), "email not kept");
  assert(!(await hasCookie(context, "ti_admin_challenge")), "challenge cookie kept");
  await page.reload();
  await page.locator('form[data-step="credentials"]').waitFor();
  await context.close();
});

await check("The code is refused without a valid password step (server-side)", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  await context.addCookies([{ name: "ti_admin_challenge", value: "x".repeat(43), url: BASE }]);
  await submitCode(page, ADMIN.code);
  assert((await message(page).innerText()).includes("The verification step has ended"), await message(page).innerText());
  assert((await step(page)) === "credentials", "still on the code step");
  assert(!(await hasCookie(context, "ti_admin_sid")), "admin cookie set");
  await context.close();
});

await check("Five wrong codes end the step: the password is needed again", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(page, ADMIN);
  await page.locator('form[data-step="verify"]').waitFor();
  for (let i = 1; i <= 5; i++) await submitCode(page, `5918273${i}` === ADMIN.code ? "59182739" : `5918273${i}`);
  assert((await step(page)) === "credentials", "still on the code step");
  assert((await message(page).innerText()).includes("The verification step has ended"), await message(page).innerText());
  assert(!(await hasCookie(context, "ti_admin_challenge")), "challenge kept");
  await context.close();
});

if (sql && process.env.SESSION_SECRET) {
  await check("Wrong codes are throttled per account across clients", async () => {
    // 6 failures so far for this account; 4 more from other clients lock it.
    for (let i = 0; i < 4; i++) {
      const { context, page } = await open("en");
      await page.goto(BASE + "/welcome?mode=admin");
      await fillAdminLogin(page, ADMIN);
      await page.locator('form[data-step="verify"]').waitFor();
      await submitCode(page, `7302946${i}` === ADMIN.code ? "73029469" : `7302946${i}`);
      await context.close();
    }
    const { context, page } = await open("en");
    await page.goto(BASE + "/welcome?mode=admin");
    await fillAdminLogin(page, ADMIN);
    await page.locator('form[data-step="verify"]').waitFor();
    await submitCode(page, ADMIN.code);
    assert((await message(page).innerText()).includes("Too many attempts"), "right code accepted while the account is locked");
    assert(!(await hasCookie(context, "ti_admin_sid")), "signed in while locked");
    await context.close();
    await clearAccountFailures();
  });
}

await check("Settings: change own code (current code required), then sign in with it", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await signInAdmin(page, ADMIN);
  await page.waitForURL(BASE + "/admin");
  await page.goto(BASE + "/admin/settings");
  await page.getByRole("heading", { name: "Verification codes" }).waitFor();
  const own = page.locator(`[data-testid="admin-code-row"][data-email="${ADMIN.email.toLowerCase()}"]`);
  await own.getByText("You").waitFor();
  assert((await own.getByRole("button", { name: /Reset code/ }).count()) === 0, "reset offered for own code");
  const change = async (current, next, confirm = next) => {
    await page.getByRole("button", { name: "Change code" }).click();
    await page.locator("#code-current").fill(current);
    await page.locator("#code-new").fill(next);
    await page.locator("#code-confirm").fill(confirm);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  };
  await change(OTHER_CODE, "48151623");
  await page.getByText("The current code is incorrect.").waitFor();
  await page.keyboard.press("Escape");
  await change(ADMIN.code, "87654321");
  await page.getByText("This code is too easy to guess", { exact: false }).first().waitFor();
  await page.keyboard.press("Escape");
  await change(ADMIN.code, OTHER_CODE, "11112222");
  await page.getByText("The new codes do not match.").waitFor();
  await page.keyboard.press("Escape");
  await change(ADMIN.code, OTHER_CODE);
  await page.getByText("Verification code changed").waitFor();
  await context.close();

  // The new code works; the old one no longer does.
  const s2 = await open("en");
  await s2.page.goto(BASE + "/welcome?mode=admin");
  await fillAdminLogin(s2.page, ADMIN);
  await s2.page.locator('form[data-step="verify"]').waitFor();
  await submitCode(s2.page, ADMIN.code);
  assert((await message(s2.page).innerText()).trim() === "Incorrect verification code.", "old code still accepted");
  await enterAdminCode(s2.page, ADMIN, OTHER_CODE);
  await s2.page.waitForURL(BASE + "/admin");
  // Change it back for the other suites.
  await s2.page.goto(BASE + "/admin/settings");
  await s2.page.getByRole("button", { name: "Change code" }).click();
  await s2.page.locator("#code-current").fill(OTHER_CODE);
  await s2.page.locator("#code-new").fill(ADMIN.code);
  await s2.page.locator("#code-confirm").fill(ADMIN.code);
  await s2.page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await s2.page.getByText("Verification code changed").waitFor();
  await s2.page.goto(BASE + "/admin/activity");
  // (The action filter's <option> has the same text; only visible entries count.)
  await s2.page.getByText("Verification code changed", { exact: true }).filter({ visible: true }).first().waitFor();
  await s2.context.close();
  await clearAccountFailures();
});

if (MOCK && sql) {
  await check("First sign-in creates the code (weak and mismatching codes refused; stored hashed)", async () => {
    await sql`delete from admin_verification_codes where email = ${SECOND.email}`;
    const { context, page } = await open("ar");
    await page.goto(BASE + "/welcome?mode=admin");
    await fillAdminLogin(page, SECOND);
    await page.locator('form[data-step="setup"]').waitFor();
    await page.getByRole("heading", { name: "إنشاء رمز التحقق" }).waitFor();
    await page.getByLabel("تأكيد الرمز", { exact: true }).waitFor();
    await submitCode(page, "12345678", "12345678");
    assert((await message(page).innerText()).includes("سهل التخمين"), await message(page).innerText());
    await submitCode(page, "44444444", "44444444");
    assert((await message(page).innerText()).includes("سهل التخمين"), "repeated digits accepted");
    await submitCode(page, SECOND.code, "40718396");
    assert((await message(page).innerText()).trim() === "الرمزان غير متطابقين.", await message(page).innerText());
    assert(!(await hasCookie(context, "ti_admin_sid")), "session before the code was created");
    await page.locator("#admin-code").fill(SECOND.code);
    await page.locator("#admin-code-confirm").fill(SECOND.code);
    await page.locator("#admin-code").press("Enter");
    await page.waitForURL(BASE + "/admin");
    const [row] = await sql`select code_hash from admin_verification_codes where email = ${SECOND.email}`;
    assert(row && row.code_hash.startsWith("scrypt$") && !row.code_hash.includes(SECOND.code), "code not stored hashed");
    await context.close();
    // From now on the second administrator gets the normal code step.
    const s2 = await open("en");
    await s2.page.goto(BASE + "/welcome?mode=admin");
    await fillAdminLogin(s2.page, SECOND);
    await s2.page.locator('form[data-step="verify"]').waitFor();
    await enterAdminCode(s2.page, SECOND);
    await s2.page.waitForURL(BASE + "/admin");
    await s2.context.close();
  });

  await check("Settings: resetting another administrator's code makes them create a new one", async () => {
    const { context, page } = await open("en");
    await page.goto(BASE + "/welcome?mode=admin");
    await signInAdmin(page, ADMIN);
    await page.waitForURL(BASE + "/admin");
    await page.goto(BASE + "/admin/settings");
    const row = page.locator(`[data-testid="admin-code-row"][data-email="${SECOND.email}"]`);
    await row.getByRole("button", { name: /Reset code/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reset code" }).click();
    await page.getByText("Verification code reset").waitFor();
    await row.waitFor({ state: "detached" });
    await context.close();
    const s2 = await open("en");
    await s2.page.goto(BASE + "/welcome?mode=admin");
    await fillAdminLogin(s2.page, SECOND);
    await s2.page.locator('form[data-step="setup"]').waitFor();
    await enterAdminCode(s2.page, SECOND);
    await s2.page.waitForURL(BASE + "/admin");
    await s2.context.close();
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
  await signInAdmin(other.page, ADMIN);
  await other.page.waitForURL(BASE + "/admin");
  await other.context.close();
});

await browser.close();
await clearAccountFailures();
if (sql) await sql.end();

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
