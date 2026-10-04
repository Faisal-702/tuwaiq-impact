/**
 * Shared helpers for signing in as a student in end-to-end tests.
 *
 * A code is issued through the real admin UI (Admin → Student Codes), never by
 * writing to the database, so the helpers work against any running server.
 */

/** A random client address, so per-client login throttling never carries over between runs. */
export const randomClientIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

/** Signs in as admin on the given page (English or Arabic UI). */
export async function adminLogin(page, base, adminCode) {
  await page.goto(base + "/welcome?mode=admin");
  await page.locator("#access-code").fill(adminCode);
  await page.locator("#access-code").press("Enter");
  await page.waitForURL(base + "/admin");
}

/**
 * Returns the student's current code, generating one if they have none.
 * `student` is the student's English name as shown in the admin list.
 */
export async function ensureStudentCode(browser, { base, adminCode, student = "Demo Student A" }) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: "en", url: base }]);
  const page = await context.newPage();
  await adminLogin(page, base, adminCode);
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
export async function studentSessionCookies(browser, { base, adminCode, student }) {
  const code = await ensureStudentCode(browser, { base, adminCode, student });
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  const page = await context.newPage();
  await studentLogin(page, base, code);
  const cookies = (await context.cookies()).filter((c) => c.name === "ti_student_sid");
  await context.close();
  if (cookies.length !== 1) throw new Error("student session cookie missing");
  return { code, cookies };
}
