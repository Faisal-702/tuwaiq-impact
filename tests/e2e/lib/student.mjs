/**
 * Shared helpers for signing in as a student in end-to-end tests.
 *
 * A code is issued through the real admin UI (Admin → Student Codes), never by
 * writing to the database, so the helpers work against any running server.
 */

/** A random client address, so per-client login throttling never carries over between runs. */
export const randomClientIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

/**
 * Administrator credentials for the tests: a user registered in Supabase Auth
 * (or in tests/e2e/mock-supabase-auth.mjs when running without Supabase), and
 * that administrator's 8-digit verification code. When the account has no
 * code yet, the first sign-in of a test run creates it with this value.
 */
export function adminCredentials() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const code = process.env.ADMIN_VERIFICATION_CODE;
  if (!email || !password || !code) throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_VERIFICATION_CODE are required");
  if (!/^\d{8}$/.test(code)) throw new Error("ADMIN_VERIFICATION_CODE must be 8 digits");
  return { email, password, code };
}

/** Fills and submits the first Admin Access step (email + password) on /welcome. */
export async function fillAdminLogin(page, admin) {
  await page.locator("#admin-email").fill(admin.email);
  await page.locator("#admin-password").fill(admin.password);
  await page.locator("#admin-password").press("Enter");
}

/**
 * Completes the verification code step that follows a correct password:
 * enters the code, or creates it (code + confirmation) on a first sign-in.
 */
export async function enterAdminCode(page, admin, code = admin.code) {
  const form = page.locator('form[data-step="verify"], form[data-step="setup"]');
  await form.waitFor();
  const step = await form.getAttribute("data-step");
  await page.locator("#admin-code").fill(code);
  if (step === "setup") await page.locator("#admin-code-confirm").fill(code);
  await page.locator("#admin-code").press("Enter");
}

/** Both sign-in steps: email + password, then the verification code. */
export async function signInAdmin(page, admin) {
  await fillAdminLogin(page, admin);
  await enterAdminCode(page, admin);
}

/** Signs in as admin on the given page (English or Arabic UI). */
export async function adminLogin(page, base, admin) {
  await page.goto(base + "/welcome?mode=admin");
  await signInAdmin(page, admin);
  await page.waitForURL(base + "/admin");
}

/**
 * Returns the student's current code, generating one if they have none.
 * `student` is the student's English name as shown in the admin list.
 */
export async function ensureStudentCode(browser, { base, admin, student = "Demo Student A" }) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: "en", url: base }]);
  const page = await context.newPage();
  await adminLogin(page, base, admin);
  await page.goto(base + "/admin/student-codes");
  await page.locator("#code-search").fill(student);
  const row = page.locator(`[data-testid="code-row"][data-student="${student}"]`);
  await row.waitFor();
  if ((await row.getByTestId("student-code").count()) === 0) {
    await row.getByRole("button", { name: "Generate Code" }).click();
    await row.getByTestId("student-code").waitFor({ timeout: 15000 });
  }
  const code = (await row.getByTestId("student-code").innerText()).trim();
  await context.close();
  if (!/^\d{8}$/.test(code)) throw new Error(`unexpected code for ${student}: ${code}`);
  return code;
}

/** Fills the Student Login form on /welcome and waits for the homepage. */
export async function studentLogin(page, base, code) {
  await page.goto(base + "/welcome");
  await page.locator("#student-code").fill(code);
  await page.locator("#student-code").press("Enter");
  await page.waitForURL(base + "/home");
}

/**
 * Signs a student in once and returns the session cookie(s), to be added to
 * other browser contexts with `context.addCookies(...)`.
 */
export async function studentSessionCookies(browser, { base, admin, student }) {
  const code = await ensureStudentCode(browser, { base, admin, student });
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  const page = await context.newPage();
  await studentLogin(page, base, code);
  const cookies = (await context.cookies()).filter((c) => c.name === "ti_student_sid");
  await context.close();
  if (cookies.length !== 1) throw new Error("student session cookie missing");
  return { code, cookies };
}
