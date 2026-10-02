/**
 * Arabic grade labels: 10 → أولى ثانوي, 11 → ثاني ثانوي, 12 → ثالث ثانوي.
 * English must stay "Grade 10/11/12".
 *
 *   BASE_URL=http://localhost:3000 ADMIN_CODE=… node tests/e2e/grades-ar.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!CODE) throw new Error("ADMIN_CODE is required");

const AR = ["أولى ثانوي", "ثاني ثانوي", "ثالث ثانوي"];
const OLD_AR = /الصف\s*1[012]/;
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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

async function session(lang) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE + "/welcome");
  return { context, page };
}
async function enterAsGuest(page, guestTab, guestButton) {
  await page.getByRole("tab", { name: guestTab }).click();
  await page.getByRole("button", { name: guestButton }).click();
  await page.waitForURL(BASE + "/home");
}
/** All visible text plus <option> labels (which innerText omits). */
async function pageText(page) {
  return page.evaluate(
    () => document.body.innerText + "\n" + [...document.querySelectorAll("option")].map((o) => o.textContent).join("\n"),
  );
}
async function expectArabicGrades(page, path, { min = 1 } = {}) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  const text = await pageText(page);
  const found = AR.filter((l) => text.includes(l));
  assert(found.length >= min, `${path}: expected Arabic grade labels, found ${JSON.stringify(found)}`);
  assert(!OLD_AR.test(text), `${path}: old "الصف 1x" label still shown`);
  assert(!/Grade 1[012]/.test(text), `${path}: English grade label shown in Arabic`);
}

// ---------------------------------------------------------------------------
// Arabic — public / guest pages
// ---------------------------------------------------------------------------
const ar = await session("ar");
await enterAsGuest(ar.page, "المتابعة كزائر", "المتابعة كزائر");

for (const [name, path, min] of [
  ["Homepage (project cards, leaderboard preview)", "/home", 2],
  ["Projects list (cards)", "/projects", 3],
  ["Projects list + grade filter options", "/projects", 3],
  ["Search/filter results (?grade=12)", "/projects?grade=12", 1],
  ["Project details page", "/projects/demo-smart-irrigation-prototype", 1],
  ["Students directory (cards + grade filter)", "/students", 3],
  ["Student profile page", "/students/demo-student-a", 1],
  ["Leaderboard", "/leaderboard", 3],
]) {
  await check(`AR · ${name}`, () => expectArabicGrades(ar.page, path, { min }));
}

await check("AR · Active grade filter pill shows Arabic label", async () => {
  await ar.page.goto(BASE + "/projects?grade=11");
  await ar.page.getByRole("button", { name: /ثاني ثانوي/ }).first().waitFor();
});

await check("AR · Filters dialog grade options", async () => {
  await ar.page.goto(BASE + "/projects");
  await ar.page.getByRole("button", { name: /عوامل التصفية/ }).click();
  const options = await ar.page.locator("#f-grade option").allTextContents();
  for (const l of AR) assert(options.includes(l), `missing ${l} in ${options}`);
  // Values sent to the server stay 10/11/12.
  const values = await ar.page.locator("#f-grade option").evaluateAll((os) => os.map((o) => o.value));
  assert(["10", "11", "12"].every((v) => values.includes(v)), `option values ${values}`);
  await ar.page.keyboard.press("Escape");
});

await check("AR · Header search shows Arabic grade for students", async () => {
  await ar.page.goto(BASE + "/home");
  await ar.page.getByRole("button", { name: "بحث", exact: true }).first().click();
  await ar.page.getByPlaceholder("ابحث عن مشاريع أو طلاب أو تصنيفات…").fill("Demo Student");
  await ar.page.getByRole("dialog").getByText(/أولى ثانوي|ثاني ثانوي|ثالث ثانوي/).first().waitFor();
  await ar.page.keyboard.press("Escape");
});

await check("AR · Presentation Mode (top students slide)", async () => {
  await ar.page.goto(BASE + "/present");
  for (let i = 0; i < 12; i++) {
    const text = await ar.page.locator("body").innerText();
    if (text.includes("الطلاب المتصدرون")) {
      assert(AR.some((l) => text.includes(l)) && !OLD_AR.test(text), "leaders slide labels");
      return;
    }
    await ar.page.keyboard.press("ArrowLeft"); // "next" in RTL
    await ar.page.waitForTimeout(800);
  }
  throw new Error("top students slide not reached");
});
await ar.context.close();

// ---------------------------------------------------------------------------
// Arabic — admin pages
// ---------------------------------------------------------------------------
const adm = await session("ar");
await check("AR · Admin login", async () => {
  await adm.page.getByLabel("رمز الدخول").fill(CODE);
  await adm.page.getByRole("button", { name: "الدخول إلى لوحة التحكم" }).click();
  await adm.page.waitForURL(BASE + "/admin");
});

await check("AR · Add Project form grade options", async () => {
  await adm.page.goto(BASE + "/admin/projects/new");
  const options = await adm.page.locator("#project-grade option").allTextContents();
  for (const l of AR) assert(options.includes(l), `missing ${l} in ${options}`);
  const values = await adm.page.locator("#project-grade option").evaluateAll((os) => os.map((o) => o.value));
  assert(["10", "11", "12"].every((v) => values.includes(v)), `values ${values}`);
  // Student picker suggestions show Arabic grades.
  await adm.page.locator("#project-students").fill("Demo");
  await adm.page.getByRole("listbox").getByText(/أولى ثانوي|ثاني ثانوي|ثالث ثانوي/).first().waitFor();
});

await check("AR · Edit Project form shows the saved grade in Arabic", async () => {
  await adm.page.goto(BASE + "/admin/projects?q=Smart%20Irrigation");
  await adm.page.getByRole("link", { name: "Demo: Smart Irrigation Prototype", exact: true }).click();
  await adm.page.waitForURL(/\/edit$/);
  const selected = await adm.page.locator("#project-grade").evaluate((s) => [s.value, s.options[s.selectedIndex].text]);
  assert(selected[0] === "11" && selected[1] === "ثاني ثانوي", JSON.stringify(selected));
});

for (const [name, path, min] of [
  ["Admin students list", "/admin/students", 3],
  ["Admin analytics (projects by grade)", "/admin/analytics", 3],
  ["Admin leaderboard", "/admin/leaderboard", 2],
  ["Admin overview leaderboard", "/admin", 2],
]) {
  await check(`AR · ${name}`, () => expectArabicGrades(adm.page, path, { min }));
}

await check("AR · Admin student detail + edit dialog options", async () => {
  await adm.page.goto(BASE + "/admin/students");
  await adm.page.getByTestId("admin-student-row").filter({ hasText: "Demo Student A" }).getByRole("link").first().click();
  await adm.page.waitForURL(/\/admin\/students\/[0-9a-f-]+$/);
  const header = await adm.page.locator("main").innerText();
  assert(header.includes("أولى ثانوي"), "student detail header");
  await adm.page.getByRole("button", { name: /تعديل/ }).first().click();
  const options = await adm.page.locator("#student-grade-input option").allTextContents();
  for (const l of AR) assert(options.includes(l), `missing ${l} in ${options}`);
  await adm.page.keyboard.press("Escape");
});
await adm.context.close();

// ---------------------------------------------------------------------------
// English is unchanged
// ---------------------------------------------------------------------------
const en = await session("en");
await enterAsGuest(en.page, "Continue as Guest", "Continue as Guest");
for (const path of ["/projects", "/students", "/leaderboard", "/projects/demo-smart-irrigation-prototype"]) {
  await check(`EN · ${path} still shows "Grade 1x"`, async () => {
    await en.page.goto(BASE + path);
    const text = await pageText(en.page);
    assert(/Grade 1[012]/.test(text), "English label missing");
    assert(!AR.some((l) => text.includes(l)), "Arabic label leaked into English");
  });
}
await en.context.close();
await browser.close();

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
