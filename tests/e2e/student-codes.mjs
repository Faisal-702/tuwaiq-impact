/**
 * Student access codes: Student Login on /welcome, protected routes, student
 * sessions, and Admin → Student Codes (generate, regenerate, remove, bulk,
 * search/filters, print).
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/e2e/student-codes.mjs
 *
 * Uses the demo students (npm run demo:seed). Their codes are changed by this
 * test; nothing else is modified.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, randomClientIp, studentLogin } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();

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
async function until(fn, message, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(message);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Submits the Student Login form and waits for the server's answer. */
async function submitCode(page, code) {
  await page.locator("#student-code").fill(code);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"])),
    page.locator("#student-code").press("Enter"),
  ]);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
/** Console errors expected from deliberately refused requests (401s). */
const expectedNoise = /Failed to load resource: the server responded with a status of 401/;
async function open(lang = "en", { viewport = { width: 1440, height: 900 }, cookies = [], ip = randomClientIp(), ...extra } = {}) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip }, ...extra });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }, ...cookies]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !expectedNoise.test(m.text()) && errors.push(m.text()));
  return { context, page };
}

const EN = {
  studentTab: "Student Login",
  adminTab: "Admin Access",
  label: "Student Code",
  placeholder: "Enter student code",
  hint: "You can obtain your student code from the school.",
  submit: "Enter Platform",
  note: "This platform is for Technical Talented High School students only.",
  invalid: "Incorrect student code.",
  required: "Please enter your student code.",
  locked: "Too many attempts. Please try again in a few minutes.",
};
const AR = {
  studentTab: "دخول الطالب",
  adminTab: "دخول المسؤول",
  label: "كود الطالب",
  placeholder: "أدخل كود الطالب",
  hint: "يمكنك الحصول على كود الطالب من المدرسة.",
  submit: "الدخول إلى المنصة",
  note: "هذه المنصة مخصصة لطلاب ثانوية الموهوبين التقنية فقط.",
  invalid: "كود الطالب غير صحيح.",
};

// ---------------------------------------------------------------------------
// Welcome page
// ---------------------------------------------------------------------------
for (const [lang, L] of [
  ["en", EN],
  ["ar", AR],
]) {
  const { context, page } = await open(lang);
  await check(`${lang.toUpperCase()} · welcome shows Student Login (default) and Admin Access; no guest option`, async () => {
    await page.goto(BASE + "/welcome");
    const tabs = (await page.getByRole("tab").allInnerTexts()).map((t) => t.trim());
    assert(JSON.stringify(tabs) === JSON.stringify([L.studentTab, L.adminTab]), JSON.stringify(tabs));
    assert((await page.getByRole("tab", { name: L.studentTab }).getAttribute("aria-selected")) === "true", "student tab not default");
    assert(!/guest|زائر/i.test(await page.locator("body").innerText()), "guest option still present");
    const input = page.getByLabel(L.label, { exact: true });
    assert((await input.getAttribute("placeholder")) === L.placeholder, "placeholder");
    await page.getByText(L.hint, { exact: true }).waitFor();
    await page.getByRole("button", { name: L.submit }).waitFor();
    await page.getByText(L.note, { exact: true }).waitFor();
    const dir = await page.evaluate(() => document.documentElement.dir);
    assert(dir === (lang === "ar" ? "rtl" : "ltr"), dir);
  });
  await check(`${lang.toUpperCase()} · invalid code shows the generic error and grants nothing`, async () => {
    await page.getByLabel(L.label, { exact: true }).fill("00000001");
    await page.getByRole("button", { name: L.submit }).click();
    await page.getByText(L.invalid, { exact: true }).waitFor();
    assert(path(page) === "/welcome", page.url());
    assert(!(await context.cookies()).some((c) => c.name === "ti_student_sid"), "session cookie set");
  });
  await context.close();
}

await check("EN · empty and malformed codes are rejected with generic messages", async () => {
  const { context, page } = await open("en");
  await page.goto(BASE + "/welcome");
  await page.getByRole("button", { name: EN.submit }).click();
  await page.getByText(EN.required, { exact: true }).waitFor();
  for (const bad of ["abc", "1234567", "123456789", "' or 1=1 --"]) {
    await submitCode(page, bad);
    // The response has arrived; wait for React to render its message.
    await page.locator("#student-code-message").filter({ hasText: EN.invalid }).waitFor({ timeout: 5000 });
  }
  await context.close();
});

// ---------------------------------------------------------------------------
// Protected routes without a student session
// ---------------------------------------------------------------------------
const PROTECTED = [
  "/home",
  "/projects",
  "/students",
  "/leaderboard",
  "/about",
  "/present",
  "/projects/demo-smart-irrigation-prototype",
  "/students/demo-student-a",
];
await check("No session: every student-facing route redirects to /welcome", async () => {
  const { context, page } = await open("en");
  for (const p of PROTECTED) {
    await page.goto(BASE + p);
    assert(path(page) === "/welcome", `${p} → ${page.url()}`);
  }
  await context.close();
});

await check("No session: public APIs refuse (search, view counter)", async () => {
  const { context } = await open("en");
  const search = await context.request.get(BASE + "/api/search?q=demo");
  assert(search.status() === 401, `search ${search.status()}`);
  const view = await context.request.post(BASE + "/api/projects/00000000-0000-0000-0000-000000000000/view");
  assert(view.status() === 401, `view ${view.status()}`);
  await context.close();
});

await check("Old guest cookie and forged student cookies do not grant access", async () => {
  for (const cookies of [
    [{ name: "ti_visit", value: "1", url: BASE }],
    [{ name: "ti_student_sid", value: "forged-token-forged-token-forged-token", url: BASE }],
  ]) {
    const { context, page } = await open("en", { cookies });
    for (const p of ["/home", "/projects", "/students/demo-student-a"]) {
      await page.goto(BASE + p);
      assert(path(page) === "/welcome", `${cookies[0].name}: ${p} → ${page.url()}`);
    }
    const res = await context.request.get(BASE + "/api/search?q=demo");
    assert(res.status() === 401, `${cookies[0].name}: search ${res.status()}`);
    if (cookies[0].name === "ti_visit") {
      assert(!(await context.cookies()).some((c) => c.name === "ti_visit"), "legacy guest cookie not removed");
    }
    await context.close();
  }
});

// ---------------------------------------------------------------------------
// Admin: login, sidebar, Student Codes page
// ---------------------------------------------------------------------------
const admin = await open("en", { viewport: { width: 1600, height: 1000 } });
const A = admin.page;
await A.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });

await check("Existing admin login still works (Admin Access tab)", async () => {
  await A.goto(BASE + "/welcome");
  await A.getByRole("tab", { name: EN.adminTab }).click();
  await A.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await A.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await A.getByRole("button", { name: "Access Dashboard" }).click();
  await A.getByLabel("Verification code", { exact: true }).fill(ADMIN.code);
  await A.getByRole("button", { name: "Verify and continue" }).click();
  await A.waitForURL(BASE + "/admin");
  await A.getByRole("heading", { name: "Overview" }).waitFor();
});

await check("Sidebar: Student Codes sits between Suggestions and Leaderboard", async () => {
  const items = (await A.locator("aside nav").first().locator("li").allInnerTexts()).map((t) => t.trim());
  const i = items.indexOf("Student Codes");
  assert(i > 0, JSON.stringify(items));
  assert(
    JSON.stringify(items.slice(i - 3, i + 3)) ===
      JSON.stringify(["Students", "Categories", "Suggestions", "Student Codes", "Leaderboard", "Analytics"]),
    JSON.stringify(items),
  );
});

const rowOf = (name) => A.locator(`[data-testid="code-row"][data-student="${name}"]`);
const codeOf = async (name) => {
  const cell = rowOf(name).getByTestId("student-code");
  return (await cell.count()) ? (await cell.innerText()).trim() : null;
};
async function showAll() {
  await A.locator("#code-search").fill("");
  await A.selectOption("#code-grade", "");
  await A.selectOption("#code-status", "");
  await A.selectOption("#code-page-size", "100");
}
async function allCodes() {
  await showAll();
  return (await A.getByTestId("student-code").allInnerTexts()).map((c) => c.trim());
}
async function removeCodeOf(name) {
  if (!(await codeOf(name))) return;
  await rowOf(name).getByRole("button", { name: `More actions: ${name}` }).click();
  await A.getByRole("menuitem", { name: "Remove code" }).click();
  const dlg = A.getByRole("alertdialog", { name: "Remove this code?" });
  await dlg.getByRole("button", { name: "Remove" }).click();
  await until(async () => (await codeOf(name)) === null, `code of ${name} not removed`);
}

await check("Student Codes page loads every existing student record", async () => {
  await A.locator("aside nav").first().getByRole("link", { name: "Student Codes", exact: true }).click();
  await A.waitForURL(BASE + "/admin/student-codes");
  await A.getByRole("heading", { name: "Student Codes", exact: true }).waitFor();
  await showAll();
  const rows = await A.getByTestId("code-row").count();
  const total = Number((await A.getByTestId("code-stats").locator("dd").first().innerText()).replace(/\D/g, ""));
  assert(rows === total && rows >= 8, `rows ${rows} vs total ${total}`);
  // Same records as Admin → Students (no separate student list).
  const students = await A.context().newPage();
  await students.goto(BASE + "/admin/students");
  const listed = await students.getByTestId("admin-student-row").count();
  await students.close();
  assert(listed === total, `students page ${listed} vs codes page ${total}`);
  const heads = (await A.locator('[data-testid="codes-table"] thead th').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(heads) === JSON.stringify(["#", "Student name", "Grade", "Section", "Student code", "Status", "Actions"]), JSON.stringify(heads));
});

await check("Generate code for one student: 8 random digits, shown as Active", async () => {
  await showAll();
  await removeCodeOf("Demo Student B");
  const row = rowOf("Demo Student B");
  await row.getByText("No code", { exact: true }).waitFor();
  await row.getByRole("button", { name: "Generate Code" }).click();
  const code = await until(() => codeOf("Demo Student B"), "no code generated");
  assert(/^\d{8}$/.test(code), code);
  await row.getByText("Active", { exact: true }).waitFor();
});

await check("All codes are unique and exactly 8 digits", async () => {
  // Make sure every student has one, then check the whole set.
  const codes = await allCodes();
  assert(codes.length >= 1 && codes.every((c) => /^\d{8}$/.test(c)), JSON.stringify(codes));
  assert(new Set(codes).size === codes.length, "duplicate codes");
});

let bulkBefore = {};
await check("Bulk generation fills only missing codes and never overwrites existing ones", async () => {
  // Bulk once so everyone has a code; then remove two codes and bulk again.
  await showAll();
  await A.getByRole("button", { name: "Generate Codes for All" }).click();
  const first = A.getByRole("alertdialog", { name: "Generate codes for all students?" });
  if (await first.isVisible().catch(() => false)) {
    await first.getByRole("button", { name: "Generate" }).click();
    await A.getByTestId("bulk-result").waitFor();
    await A.getByTestId("bulk-result").getByRole("button").click();
  }
  await removeCodeOf("Demo Student C");
  await removeCodeOf("Demo Student D");
  await showAll();
  const names = await A.getByTestId("code-row").evaluateAll((rs) => rs.map((r) => r.dataset.student));
  bulkBefore = {};
  for (const n of names) bulkBefore[n] = await codeOf(n);
  const existing = Object.values(bulkBefore).filter(Boolean).length;
  assert(bulkBefore["Demo Student C"] === null && bulkBefore["Demo Student D"] === null, "setup failed");

  await A.getByRole("button", { name: "Generate Codes for All" }).click();
  const dlg = A.getByRole("alertdialog", { name: "Generate codes for all students?" });
  await dlg.getByText(/Existing codes will not change/).waitFor();
  await dlg.getByRole("button", { name: "Generate" }).click();
  const banner = A.getByTestId("bulk-result");
  await banner.getByText("2 new codes created", { exact: true }).waitFor();
  await banner.getByText(`${existing} students already had codes`, { exact: true }).waitFor();
  await until(async () => (await codeOf("Demo Student C")) && (await codeOf("Demo Student D")), "missing codes not filled");
  for (const [n, c] of Object.entries(bulkBefore)) {
    if (c) assert((await codeOf(n)) === c, `existing code of ${n} changed`);
  }
});

await check("Bulk generation when everyone has a code changes nothing", async () => {
  const before = await allCodes();
  await A.getByRole("button", { name: "Generate Codes for All" }).click();
  await A.getByText("Every student already has a code.").first().waitFor();
  assert(!(await A.getByRole("alertdialog").isVisible().catch(() => false)), "dialog opened");
  assert(JSON.stringify(await allCodes()) === JSON.stringify(before), "codes changed");
});

await check("Search, grade filter and status filter", async () => {
  await showAll();
  await A.locator("#code-search").fill("Demo Student A");
  assert((await A.getByTestId("code-row").count()) === 1, "search");
  await A.locator("#code-search").fill("");
  await A.selectOption("#code-grade", "12");
  const grades = await A.locator('[data-testid="code-row"] td:nth-child(3)').allInnerTexts();
  assert(grades.length > 0 && grades.every((g) => g.trim() === "Grade 12"), JSON.stringify(grades));
  await A.selectOption("#code-grade", "");
  await removeCodeOf("Demo Student E");
  await A.selectOption("#code-status", "none");
  const none = await A.getByTestId("code-row").evaluateAll((rs) => rs.map((r) => r.dataset.student));
  assert(none.includes("Demo Student E") && none.every((n) => n !== "Demo Student A"), JSON.stringify(none));
  await A.selectOption("#code-status", "has");
  const statuses = await A.locator('[data-testid="code-row"] td:nth-child(6)').allInnerTexts();
  assert(statuses.length > 0 && statuses.every((t) => t.trim() === "Active"), JSON.stringify(statuses));
  await showAll();
  await rowOf("Demo Student E").getByRole("button", { name: "Generate Code" }).click();
  await until(() => codeOf("Demo Student E"), "regenerate E");
});

await check("Copy code puts the code on the clipboard", async () => {
  await showAll();
  const code = await codeOf("Demo Student A");
  await rowOf("Demo Student A").getByRole("button", { name: "Copy code: Demo Student A" }).click();
  await A.getByText("Code copied").first().waitFor();
  const clip = await A.evaluate(() => navigator.clipboard.readText());
  assert(clip === code, `clipboard ${clip}`);
});

await check("Print: one sheet grouped first → second → third year, without admin UI", async () => {
  await A.locator("#print-root").waitFor({ state: "attached" });
  await A.emulateMedia({ media: "print" });
  const root = A.locator("#print-root");
  assert(await root.isVisible(), "print root hidden in print");
  assert(!(await A.locator("aside").first().isVisible()), "admin sidebar visible in print");
  const sheet = root.getByTestId("codes-sheet");
  const headings = (await sheet.locator('[data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(headings.slice(0, 3)) === JSON.stringify(["Grade 10 students", "Grade 11 students", "Grade 12 students"]), JSON.stringify(headings));
  const text = await sheet.innerText();
  assert(text.includes("Technical Talented High School") && text.includes("Student Login Codes") && /Printed on \d/.test(text), "header/date");
  const a = await codeOf("Demo Student A");
  assert(text.includes(a), "codes missing from sheet");
  await A.emulateMedia({ media: "screen" });
  assert(!(await root.isVisible()), "print root visible on screen");
});

await check("Print one student's code (card)", async () => {
  await A.evaluate(() => {
    window.print = () => {
      window.__printed = document.querySelector("#print-root")?.innerText ?? "";
    };
  });
  await rowOf("Demo Student A").getByRole("button", { name: "More actions: Demo Student A" }).click();
  await A.getByRole("menuitem", { name: "Print code" }).click();
  const printed = await until(() => A.evaluate(() => window.__printed), "print not triggered");
  const code = await codeOf("Demo Student A");
  assert(printed.includes("Student Login Code") && printed.includes("Demo Student A") && printed.includes(code), printed.slice(0, 200));
  assert(!printed.includes("Grade 11 students"), "printed the whole sheet");
});

// ---------------------------------------------------------------------------
// Student login, session, protection
// ---------------------------------------------------------------------------
await showAll();
let codeA = await codeOf("Demo Student A");
const student = await open("en");
const S = student.page;

await check("Valid code signs the student in and lands on the homepage", async () => {
  await studentLogin(S, BASE, codeA);
  await S.getByRole("heading", { name: /Student Ideas/ }).waitFor();
  assert(!S.url().includes(codeA), "code in URL");
  assert((await S.getByTestId("student-menu").getAttribute("aria-label")) === "Account: Demo Student A", "student name in header");
  assert((await S.getByRole("link", { name: "Dashboard" }).count()) === 0, "dashboard link shown to student");
});

await check("Student session works across navigation; cookie is httpOnly + browser-session", async () => {
  for (const p of PROTECTED) {
    await S.goto(BASE + p);
    assert(path(S) === p, `${p} → ${S.url()}`);
  }
  const res = await S.context().request.get(BASE + "/api/search?q=demo");
  assert(res.status() === 200, `search ${res.status()}`);
  const sid = (await S.context().cookies()).find((c) => c.name === "ti_student_sid");
  assert(sid && sid.httpOnly && sid.expires === -1 && sid.sameSite === "Lax", JSON.stringify(sid));
  assert(sid.value !== codeA && !sid.value.includes(codeA), "code stored in cookie");
});

await check("Student pages never contain access codes", async () => {
  const codes = await allCodes();
  for (const p of ["/home", "/students", "/students/demo-student-a", "/leaderboard", "/projects"]) {
    const html = await (await S.context().request.get(BASE + p)).text();
    const leaked = codes.filter((c) => html.includes(c));
    assert(leaked.length === 0, `${p} contains codes ${leaked}`);
  }
});

await check("Student cannot open admin pages", async () => {
  for (const p of ["/admin", "/admin/student-codes", "/admin/students"]) {
    await S.goto(BASE + p);
    assert(path(S) === "/welcome", `${p} → ${S.url()}`);
  }
  await S.goto(BASE + "/home");
  assert(path(S) === "/home", "student session lost after admin attempt");
});

let actionRequest = null;
await check("Regenerate (with confirmation): old code stops working, new code works", async () => {
  await showAll();
  A.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && r.postData()?.includes("-") && !actionRequest)
      actionRequest = { url: r.url(), headers: r.headers(), body: r.postData() };
  });
  await rowOf("Demo Student A").getByRole("button", { name: "Regenerate code: Demo Student A" }).click();
  const dlg = A.getByRole("alertdialog", { name: "Regenerate this code?" });
  await dlg.getByText(/will stop working immediately/).waitFor();
  await dlg.getByRole("button", { name: "Regenerate" }).click();
  const fresh = await until(async () => {
    const c = await codeOf("Demo Student A");
    return c && c !== codeA ? c : null;
  }, "code not regenerated");
  assert(/^\d{8}$/.test(fresh), fresh);

  // The student's existing session ends with the old code.
  await S.goto(BASE + "/projects");
  assert(path(S) === "/welcome", "old session still valid: " + S.url());
  // Old code is rejected with the generic error.
  const old = await open("en");
  await old.page.goto(BASE + "/welcome");
  await old.page.locator("#student-code").fill(codeA);
  await old.page.locator("#student-code").press("Enter");
  await old.page.getByText(EN.invalid, { exact: true }).waitFor();
  await old.context.close();
  // The new code works.
  await studentLogin(S, BASE, fresh);
  codeA = fresh;
});

await check("Arabic-Indic digits are accepted for the same code", async () => {
  const ar = await open("ar");
  const arabic = codeA.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  await ar.page.goto(BASE + "/welcome");
  await ar.page.locator("#student-code").fill(arabic);
  await ar.page.getByRole("button", { name: AR.submit }).click();
  await ar.page.waitForURL(BASE + "/home");
  await ar.context.close();
});

await check("A student session cannot run admin actions (replayed server action)", async () => {
  assert(actionRequest, "no admin action captured");
  const before = await codeOf("Demo Student A");
  const headers = { ...actionRequest.headers };
  delete headers["content-length"];
  delete headers.cookie;
  const res = await S.context().request.post(actionRequest.url, { headers, data: actionRequest.body, maxRedirects: 0 });
  const text = await res.text();
  assert(!text.includes('"ok":true'), `action ran for a student: ${text.slice(0, 120)}`);
  await A.reload();
  await showAll();
  assert((await codeOf("Demo Student A")) === before, "student changed a code");
  await S.goto(BASE + "/home");
  assert(path(S) === "/home", "student session lost");
});

await check("Sign out ends the student session (token revoked server-side)", async () => {
  const token = (await S.context().cookies()).find((c) => c.name === "ti_student_sid")?.value;
  await S.getByTestId("student-menu").click();
  await S.getByRole("menuitem", { name: "Sign out" }).click();
  await S.waitForURL(BASE + "/welcome");
  assert(!(await S.context().cookies()).some((c) => c.name === "ti_student_sid"), "cookie kept");
  await S.goto(BASE + "/home");
  assert(path(S) === "/welcome", S.url());
  const replay = await open("en", { cookies: [{ name: "ti_student_sid", value: token, url: BASE }] });
  await replay.page.goto(BASE + "/home");
  assert(path(replay.page) === "/welcome", "revoked token still works");
  await replay.context.close();
});

await check("Student and admin sessions are separate (one role per browser)", async () => {
  await studentLogin(S, BASE, codeA);
  await adminLogin(S, BASE, ADMIN);
  assert(!(await S.context().cookies()).some((c) => c.name === "ti_student_sid"), "student cookie kept after admin login");
  await studentLogin(S, BASE, codeA);
  assert(!(await S.context().cookies()).some((c) => c.name === "ti_admin_sid"), "admin cookie kept after student login");
  await S.goto(BASE + "/admin");
  assert(path(S) === "/welcome", "student reached admin");
});

await check("Repeated invalid codes are throttled (even a valid code is refused while locked)", async () => {
  const ip = randomClientIp();
  const t = await open("en", { ip });
  await t.page.goto(BASE + "/welcome");
  let locked = false;
  let attempts = 0;
  while (!locked && attempts < 10) {
    attempts++;
    // Malformed codes count as failures too, and can never match a real code.
    await submitCode(t.page, `x${attempts}`);
    locked = (await t.page.locator("#student-code-message").innerText()).includes("Too many");
  }
  assert(locked && attempts === 10, `locked=${locked} after ${attempts} failures`);
  await submitCode(t.page, codeA);
  assert((await t.page.locator("#student-code-message").innerText()).trim() === EN.locked, "valid code accepted while locked");
  assert(path(t.page) === "/welcome", "logged in while locked");
  await t.context.close();
  // Other clients are unaffected.
  const other = await open("en");
  await studentLogin(other.page, BASE, codeA);
  await other.context.close();
});

// ---------------------------------------------------------------------------
// Arabic admin page + mobile
// ---------------------------------------------------------------------------
await check("AR · Student Codes page labels, sidebar and print grouping", async () => {
  const ar = await open("ar", { viewport: { width: 1600, height: 1000 } });
  await adminLogin(ar.page, BASE, ADMIN);
  await ar.page.goto(BASE + "/admin/student-codes");
  await ar.page.getByRole("heading", { name: "أكواد الطلاب", exact: true }).waitFor();
  await ar.page.getByText("إنشاء وإدارة أكواد دخول الطلاب بشكل عشوائي وآمن.").waitFor();
  for (const b of ["إنشاء الأكواد للكل", "طباعة الأكواد"]) await ar.page.getByRole("button", { name: b }).waitFor();
  const items = (await ar.page.locator("aside nav").first().locator("li").allInnerTexts()).map((t) => t.trim());
  const i = items.indexOf("أكواد الطلاب");
  assert(JSON.stringify(items.slice(i - 3, i + 3)) === JSON.stringify(["الطلاب", "التصنيفات", "الاقتراحات", "أكواد الطلاب", "لوحة الصدارة", "التحليلات"]), JSON.stringify(items));
  const options = await ar.page.locator("#code-grade option").allTextContents();
  assert(JSON.stringify(options) === JSON.stringify(["جميع الصفوف", "أولى ثانوي", "ثاني ثانوي", "ثالث ثانوي"]), JSON.stringify(options));
  const status = await ar.page.locator("#code-status option").allTextContents();
  assert(status.includes("لديه كود") && status.includes("بدون كود"), JSON.stringify(status));
  await ar.page.locator("#print-root").waitFor({ state: "attached" });
  await ar.page.emulateMedia({ media: "print" });
  const headings = (await ar.page.locator('#print-root [data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(headings.slice(0, 3)) === JSON.stringify(["طلاب أولى ثانوي", "طلاب ثاني ثانوي", "طلاب ثالث ثانوي"]), JSON.stringify(headings));
  const sheet = await ar.page.locator("#print-root").innerText();
  assert(sheet.includes("ثانوية الموهوبين التقنية") && sheet.includes("أكواد دخول الطلاب") && sheet.includes("تاريخ الطباعة"), "AR sheet header");
  await ar.context.close();
});

await check("Mobile · student login and sign out from the menu", async () => {
  const m = await open("ar", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await studentLogin(m.page, BASE, codeA);
  await m.page.getByRole("button", { name: "فتح القائمة" }).click();
  await m.page.locator("#mobile-nav").getByRole("button", { name: "تسجيل الخروج" }).click();
  await m.page.waitForURL(BASE + "/welcome");
  await m.page.goto(BASE + "/home");
  assert(path(m.page) === "/welcome", m.page.url());
  await m.context.close();
});

await student.context.close();
await admin.context.close();
await browser.close();

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
