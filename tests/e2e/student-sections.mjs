/**
 * Student sections ("الشعبة") and bulk student creation.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_CODE=… node --env-file-if-exists=.env.local tests/e2e/student-sections.mjs
 *
 * Creates students whose names carry this run's unique marker. With
 * DATABASE_URL set it also checks stored values and removes those students
 * afterwards (their codes go with them).
 */
import { chromium } from "playwright";
import { adminLogin, randomClientIp } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!CODE) throw new Error("ADMIN_CODE is required");

const RUN = `S${Date.now().toString(36).toUpperCase()}`;
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
async function until(fn, message, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(message);
    await new Promise((r) => setTimeout(r, 200));
  }
}

let sql = null;
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import("postgres");
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function open(lang = "en") {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await adminLogin(page, BASE, CODE);
  return { context, page };
}

const SINGLE = `QA Single ${RUN}`;
// Arabic names (stored as name_ar) with this run's marker.
const BULK = [1, 2, 3, 4, 5].map((i) => `طالب اختبار ${RUN} ${["أ", "ب", "ج", "د", "هـ"][i - 1]}`);

const { context, page: A } = await open("en");
const codesBefore = new Map();

// ---------------------------------------------------------------------------
// Existing codes snapshot
// ---------------------------------------------------------------------------
await A.goto(BASE + "/admin/student-codes");
await A.selectOption("#code-page-size", "100");
for (const row of await A.getByTestId("code-row").all()) {
  const code = await row.getByTestId("student-code").count() ? (await row.getByTestId("student-code").innerText()).trim() : null;
  codesBefore.set(await row.getAttribute("data-student"), code);
}

// ---------------------------------------------------------------------------
// One student with grade + section
// ---------------------------------------------------------------------------
await check("Add Student modal: Section field under Grade, saved with the student", async () => {
  await A.goto(BASE + "/admin/students");
  await A.getByRole("button", { name: "Add Student", exact: true }).click();
  const dlg = A.getByRole("dialog", { name: "New Student" });
  const labels = (await dlg.locator("label").allInnerTexts()).map((t) => t.trim());
  assert(labels.indexOf("Section") === labels.indexOf("Grade") + 1, JSON.stringify(labels));
  const options = await dlg.locator("#student-section-input option").allTextContents();
  assert(JSON.stringify(options) === JSON.stringify(["Not set", "1", "2", "3"]), JSON.stringify(options));
  await dlg.locator("#student-name-en").fill(SINGLE);
  await dlg.locator("#student-grade-input").selectOption("10");
  await dlg.locator("#student-section-input").selectOption("3");
  await dlg.getByRole("button", { name: "Create" }).click();
  await A.getByText("Student created").first().waitFor();
  if (sql) {
    const [row] = await sql`select grade, section from students where name_en = ${SINGLE}`;
    assert(row?.grade === 10 && row?.section === 3, JSON.stringify(row));
  }
});

await check("Edit Student: section is pre-filled, can be changed, and persists after refresh", async () => {
  await A.goto(BASE + "/admin/students?q=" + encodeURIComponent(SINGLE));
  await A.getByRole("button", { name: `Edit: ${SINGLE}` }).click();
  const dlg = A.getByRole("dialog", { name: "Edit Student" });
  assert((await dlg.locator("#student-section-input").inputValue()) === "3", "section not pre-filled");
  await dlg.locator("#student-section-input").selectOption("1");
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await A.getByText("Student updated").first().waitFor();
  await A.reload();
  await A.getByRole("button", { name: `Edit: ${SINGLE}` }).click();
  assert((await A.getByRole("dialog", { name: "Edit Student" }).locator("#student-section-input").inputValue()) === "1", "section not saved");
  await A.keyboard.press("Escape");
});

// ---------------------------------------------------------------------------
// Bulk add
// ---------------------------------------------------------------------------
const pasted = ["", `  ${BULK[0]}  `, BULK[1], "", BULK[2], BULK[1], "   ", BULK[3], BULK[4], ""].join("\n");

await check("Bulk add: button next to Add Student; blank lines ignored, duplicates counted once", async () => {
  await A.goto(BASE + "/admin/students");
  const header = await A.locator("main").getByRole("button").allInnerTexts();
  assert(header.some((t) => t.includes("Add students in bulk")), JSON.stringify(header));
  await A.getByRole("button", { name: "Add students in bulk" }).click();
  const dlg = A.getByRole("dialog", { name: "Add students in bulk" });
  await dlg.getByText("Enter student names, one name per line").waitFor();
  await dlg.getByLabel("Student names").fill(pasted);
  const status = dlg.getByTestId("bulk-status");
  await status.getByText("5 students detected").waitFor();
  assert((await status.innerText()).includes("repeated in the list"), "duplicate not reported");
  assert(await dlg.getByRole("button", { name: /Add all students/ }).isDisabled(), "enabled before grade/section");
  const sections = await dlg.locator("#bulk-student-section option").allTextContents();
  assert(JSON.stringify(sections.slice(1)) === JSON.stringify(["1", "2", "3"]), JSON.stringify(sections));
  await dlg.locator("#bulk-student-grade").selectOption("10");
  await dlg.locator("#bulk-student-section").selectOption("2");
  await dlg.getByRole("button", { name: "Add all students (5)" }).waitFor();
  await until(async () => (await status.getAttribute("data-tone")) === "warning", "status not settled");
});

await check("Bulk add: creates every student in one go with the chosen grade + section", async () => {
  const dlg = A.getByRole("dialog", { name: "Add students in bulk" });
  await dlg.getByRole("button", { name: "Add all students (5)" }).click();
  await A.getByText("5 students added").first().waitFor({ timeout: 20000 });
  await dlg.waitFor({ state: "hidden" });
  if (sql) {
    const rows = await sql`select name_en, name_ar, grade, section from students where name_ar like ${"%" + RUN + "%"} order by name_ar`;
    assert(rows.length === 5, `rows ${rows.length}`);
    assert(rows.every((r) => r.grade === 10 && r.section === 2 && r.name_en === null && r.name_ar), JSON.stringify(rows[0]));
    assert(rows.some((r) => r.name_ar === BULK[0]), "whitespace not trimmed");
  }
});

await check("Bulk add: pasting the same list again creates nothing (already in that class)", async () => {
  await A.getByRole("button", { name: "Add students in bulk" }).click();
  const dlg = A.getByRole("dialog", { name: "Add students in bulk" });
  await dlg.getByLabel("Student names").fill(pasted);
  await dlg.locator("#bulk-student-grade").selectOption("10");
  await dlg.locator("#bulk-student-section").selectOption("2");
  await dlg.getByTestId("bulk-status").getByText(/already in this grade and section/).waitFor();
  assert(await dlg.getByRole("button", { name: "Add all students (0)" }).isDisabled(), "button enabled for duplicates");
  await A.keyboard.press("Escape");
  if (sql) {
    const [{ n }] = await sql`select count(*)::int as n from students where name_ar like ${"%" + RUN + "%"}`;
    assert(n === 5, `duplicates created: ${n}`);
  }
});

await check("Bulk add: 120 names are added in one submit", async () => {
  const many = Array.from({ length: 120 }, (_, i) => `QA Bulk ${RUN} ${String(i + 1).padStart(3, "0")}`).join("\n");
  await A.getByRole("button", { name: "Add students in bulk" }).click();
  const dlg = A.getByRole("dialog", { name: "Add students in bulk" });
  await dlg.getByLabel("Student names").fill(many);
  await dlg.locator("#bulk-student-grade").selectOption("12");
  await dlg.locator("#bulk-student-section").selectOption("1");
  await dlg.getByRole("button", { name: "Add all students (120)" }).click();
  await A.getByText("120 students added").first().waitFor({ timeout: 30000 });
  if (sql) {
    const [{ n }] = await sql`select count(*)::int as n from students where name_en like ${"QA Bulk " + RUN + "%"} and grade = 12 and section = 1`;
    assert(n === 120, `stored ${n}`);
  }
});

// ---------------------------------------------------------------------------
// Student Codes: column, filters, print
// ---------------------------------------------------------------------------
const rowOf = (name) => A.locator(`[data-testid="code-row"][data-student="${name}"]`);

await check("Student Codes: Section column beside Grade shows each student's section", async () => {
  await A.goto(BASE + "/admin/student-codes");
  const heads = (await A.locator('[data-testid="codes-table"] thead th').allInnerTexts()).map((t) => t.trim());
  assert(heads.indexOf("Section") === heads.indexOf("Grade") + 1, JSON.stringify(heads));
  await A.locator("#code-search").fill(RUN);
  await A.selectOption("#code-page-size", "100");
  assert((await rowOf(BULK[0]).getByTestId("student-section").innerText()).trim() === "2", "bulk section");
  assert((await rowOf(SINGLE).getByTestId("student-section").innerText()).trim() === "1", "single section");
  // Existing students without a section show "Not set".
  await A.locator("#code-search").fill("Demo Student A");
  assert((await rowOf("Demo Student A").getByTestId("student-section").innerText()).trim() === "Not set", "not set label");
});

await check("Student Codes: section filter sits between grade and status and combines with them + search", async () => {
  const order = await A.locator("#code-grade, #code-section, #code-status").evaluateAll((els) => els.map((e) => e.id));
  assert(JSON.stringify(order) === JSON.stringify(["code-grade", "code-section", "code-status"]), JSON.stringify(order));
  const opts = await A.locator("#code-section option").allTextContents();
  assert(JSON.stringify(opts) === JSON.stringify(["All sections", "1", "2", "3"]), JSON.stringify(opts));
  await A.locator("#code-search").fill(RUN);
  await A.selectOption("#code-grade", "10");
  await A.selectOption("#code-section", "2");
  let names = await A.getByTestId("code-row").evaluateAll((rs) => rs.map((r) => r.dataset.student));
  assert(names.length === 5 && names.every((n) => n.includes(RUN) && !n.startsWith("QA")), JSON.stringify(names));
  await A.selectOption("#code-section", "1");
  names = await A.getByTestId("code-row").evaluateAll((rs) => rs.map((r) => r.dataset.student));
  assert(JSON.stringify(names) === JSON.stringify([SINGLE]), JSON.stringify(names));
  // Status filter still works with them: none of these has a code yet.
  await A.selectOption("#code-status", "has");
  assert((await A.getByTestId("code-row").count()) === 0, "status filter ignored");
  await A.selectOption("#code-status", "none");
  assert((await A.getByTestId("code-row").count()) === 1, "status none");
  await A.selectOption("#code-status", "");
});

await check("Generate codes for the new students (existing codes untouched)", async () => {
  await A.locator("#code-search").fill(RUN);
  await A.selectOption("#code-grade", "10");
  await A.selectOption("#code-section", "");
  for (const name of [...BULK, SINGLE]) {
    const row = rowOf(name);
    if ((await row.getByTestId("student-code").count()) === 0) {
      await row.getByRole("button", { name: "Generate Code" }).click();
      await row.getByTestId("student-code").waitFor({ timeout: 15000 });
    }
  }
});

await check("Print: groups by grade then section, following the active filters", async () => {
  await A.locator("#print-root").waitFor({ state: "attached" });
  // Filter: Grade 10 + Section 2 → only that group is printed.
  await A.selectOption("#code-grade", "10");
  await A.selectOption("#code-section", "2");
  await A.emulateMedia({ media: "print" });
  let heads = (await A.locator('#print-root [data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(heads) === JSON.stringify(["Grade 10 students – Section 2"]), JSON.stringify(heads));
  const sheet = await A.locator("#print-root").innerText();
  assert(BULK.every((n) => sheet.includes(n)) && !sheet.includes(SINGLE), "wrong students printed");
  // Grade 10 only → sections in order.
  await A.emulateMedia({ media: "screen" });
  await A.selectOption("#code-section", "");
  await A.emulateMedia({ media: "print" });
  heads = (await A.locator('#print-root [data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(heads) === JSON.stringify(["Grade 10 students – Section 1", "Grade 10 students – Section 2"]), JSON.stringify(heads));
  // No filters → whole school, grade order first, section order inside.
  await A.emulateMedia({ media: "screen" });
  await A.locator("#code-search").fill("");
  await A.selectOption("#code-grade", "");
  await A.emulateMedia({ media: "print" });
  heads = (await A.locator('#print-root [data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  const rank = (h) => {
    const g = h.match(/Grade (\d+)/)?.[1] ?? "99";
    const s = h.match(/Section (\d)/)?.[1] ?? (h.includes("No section") ? "8" : "9");
    return Number(g) * 10 + Number(s);
  };
  const ranks = heads.map(rank);
  assert(ranks.every((r, i) => i === 0 || r >= ranks[i - 1]), JSON.stringify(heads));
  assert(heads.includes("Grade 10 students – Section 1") && heads.includes("Grade 10 students – Section 2"), JSON.stringify(heads));
  await A.emulateMedia({ media: "screen" });
});

await check("Existing student codes are unchanged", async () => {
  await A.reload();
  for (const [name, code] of codesBefore) {
    await A.locator("#code-search").fill(name);
    await rowOf(name).waitFor();
    const cell = rowOf(name).getByTestId("student-code");
    const now = (await cell.count()) ? (await cell.innerText()).trim() : null;
    assert(now === code, `${name}: ${code} → ${now}`);
  }
});

// ---------------------------------------------------------------------------
// Arabic labels
// ---------------------------------------------------------------------------
await check("AR · labels on Students and Student Codes pages", async () => {
  const ar = await open("ar");
  await ar.page.goto(BASE + "/admin/students");
  await ar.page.getByRole("button", { name: "إضافة طالب", exact: true }).click();
  await ar.page.getByRole("dialog").getByText("الشعبة", { exact: true }).waitFor();
  await ar.page.keyboard.press("Escape");
  await ar.page.getByRole("button", { name: "إضافة طلاب دفعة واحدة" }).click();
  const dlg = ar.page.getByRole("dialog", { name: "إضافة طلاب دفعة واحدة" });
  await dlg.getByText("أدخل أسماء الطلاب، كل اسم في سطر مستقل").waitFor();
  await dlg.getByLabel("أسماء الطلاب").fill("أنس العمري\nأنمار حلبي\n\nباسل الشهراني\nحسان العماري");
  await dlg.getByText("تم اكتشاف 4 طلاب").waitFor();
  await dlg.locator("#bulk-student-grade").selectOption("10");
  await dlg.locator("#bulk-student-section").selectOption("3");
  await dlg.getByRole("button", { name: "إضافة جميع الطلاب (4)" }).waitFor();
  await dlg.getByText("لا توجد أسماء مكررة أو أخطاء.").waitFor();
  await ar.page.keyboard.press("Escape");
  await ar.page.goto(BASE + "/admin/student-codes");
  const opts = await ar.page.locator("#code-section option").allTextContents();
  assert(JSON.stringify(opts) === JSON.stringify(["جميع الشعب", "1", "2", "3"]), JSON.stringify(opts));
  await ar.page.locator("#code-search").fill(RUN);
  await ar.page.selectOption("#code-grade", "10");
  await ar.page.selectOption("#code-section", "2");
  await ar.page.locator("#print-root").waitFor({ state: "attached" });
  await ar.page.emulateMedia({ media: "print" });
  const heads = (await ar.page.locator('#print-root [data-testid="print-group"] h2').allInnerTexts()).map((t) => t.trim());
  assert(JSON.stringify(heads) === JSON.stringify(["طلاب أولى ثانوي - الشعبة 2"]), JSON.stringify(heads));
  await ar.context.close();
});

await context.close();
await browser.close();

if (sql) {
  await sql`delete from students where name_en like ${"%" + RUN + "%"} or name_ar like ${"%" + RUN + "%"}`;
  await sql.end();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
