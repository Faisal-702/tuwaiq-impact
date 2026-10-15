/**
 * Student project submission ("إضافة مشروع") and project discovery.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/project-submission.mjs
 *
 * A student signs in with a real code (issued through the admin UI), fills in
 * every question of the form, uploads a cover image and supporting files,
 * and submits. The project must then appear on Explore Projects with only
 * its public information, never with private answers. Values carry this run's
 * marker; with DATABASE_URL set the run checks stored rows and removes the
 * project and submissions it created afterwards.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, completeProfile, ensureStudentCode, randomClientIp, studentLogin, validNationalId } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const STUDENT = process.env.QA_STUDENT ?? "Demo Student C";
const OTHER_STUDENT = process.env.QA_OTHER_STUDENT ?? "Demo Student D";

const RUN = `R${Date.now().toString(36).toUpperCase()}`;
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
    // Optional evidence for debugging: QA_SHOTS=<dir> saves a screenshot per failure.
    if (process.env.QA_SHOTS && typeof page !== "undefined") {
      await page.screenshot({ path: `${process.env.QA_SHOTS}/fail-${results.length}.png`, fullPage: true, caret: "initial" }).catch(() => {});
    }
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
async function until(fn, message, timeout = 20000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(message);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** With QA_SHOTS=<dir>, saves a screenshot of the given page for visual review. */
const shot = async (p, name, fullPage = true) => {
  if (process.env.QA_SHOTS) await p.screenshot({ path: `${process.env.QA_SHOTS}/${name}.png`, fullPage, caret: "initial" }).catch(() => {});
};

/** A random Saudi national ID with a valid check digit. */
function nationalId() {
  const body = "1" + Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(body[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return body + String((10 - (sum % 10)) % 10);
}

const A = {
  nationalId: nationalId(),
  phone: "05" + String(Math.floor(10000000 + Math.random() * 89999999)),
  email: `qa.${RUN.toLowerCase()}@example.com`,
  participants: `QA Partner ${RUN}`,
  title: `QA Submission ${RUN}`,
  description: `QA description ${RUN}`,
  goals: `QA goals ${RUN}`,
  idea: `QA idea ${RUN}`,
  competitionName: `QA Competition ${RUN}`,
  fieldOther: `QAField${RUN}`,
  problem: `QA problem ${RUN}`,
  tools: `QA tools ${RUN}`,
  supervisor: `QA Supervisor ${RUN}`,
  evidenceName: `qa-evidence-${RUN}.pdf`,
};
// The summary is cut at 300 characters; the stored and shown text is the first 300.
const LONG_SUMMARY = `ملخص ${RUN} ` + "مشروع طلابي يعالج مشكلة حقيقية. ".repeat(14);
const SUMMARY = LONG_SUMMARY.slice(0, 300);
// Values that must never be visible publicly.
const SECRETS = [A.nationalId, A.phone, A.email, A.supervisor, A.problem, A.goals, A.idea, A.tools, A.participants, A.competitionName, A.evidenceName];

let sql = null;
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import("postgres");
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

async function newContext(lang = "ar", viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  return context;
}
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Leaving a page mid-request aborts it; that is not an application error.
    if (/Failed to fetch|ERR_ABORTED|net::ERR/.test(text)) return;
    errors.push(text);
  });
};

// Files: a cover image rendered by the browser, a small PDF and a PNG.
const shotPage = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await shotPage.setContent(
  `<div style="width:1200px;height:750px;background:linear-gradient(135deg,#6d4aff,#14b8a6);display:grid;place-items:center;font:700 64px sans-serif;color:#fff">${RUN}</div>`,
);
const coverPng = await shotPage.screenshot({ type: "png" });
await shotPage.close();
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const studentCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: STUDENT });
const otherCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: OTHER_STUDENT });

// Start from a clean slate for the students used here (drafts and saved
// profiles from earlier runs; a saved profile would pre-fill the form).
if (sql) {
  await sql`
    delete from project_submissions where status in ('draft', 'editing')
       and student_id in (select id from students where name_en in (${STUDENT}, ${OTHER_STUDENT}))`;
  await sql`delete from student_profiles where student_id in (select id from students where name_en in (${STUDENT}, ${OTHER_STUDENT}))`;
}

const context = await newContext("ar");
const page = await context.newPage();
watch(page);
await studentLogin(page, BASE, studentCode);
// Personal details live in the student profile (الملف الشخصي), entered once.
const STUDENT_NAME = `طالب اختبار ${RUN}`;
await completeProfile(page, BASE, { fullName: STUDENT_NAME, nationalId: A.nationalId, phone: A.phone, email: A.email, grade: "12", section: "2" });

const step = (id) => page.locator(`[data-step="${id}"]`);
const next = async (to) => {
  await page.getByTestId("wizard-next").click();
  if (to) await step(to).waitFor();
};
const choose = (name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();
const fieldError = (id) => page.locator(`#${id}-error`);

await check("homepage hero button reads إضافة مشروع and opens the form; nav unchanged", async () => {
  await page.goto(BASE + "/home");
  const hero = page.getByTestId("hero-add-project");
  assert((await hero.innerText()).includes("إضافة مشروع"), "hero label");
  assert((await hero.getAttribute("href")) === "/add-project", "hero href");
  const nav = await page.locator("header").first().innerText();
  assert(nav.includes("استكشف المشاريع") && nav.includes("لوحة الصدارة"), "navigation items");
  await hero.click();
  await page.waitForURL(BASE + "/add-project");
  await step("details-1").waitFor();
});

await check("the form starts with the project details (no personal questions); progress shows 1 من 3; the profile is linked", async () => {
  const fields = await step("details-1").locator("[data-field]").evaluateAll((els) => els.map((e) => e.getAttribute("data-field")));
  assert(JSON.stringify(fields) === JSON.stringify(["projectType", "participants", "title", "description"]), `fields ${fields}`);
  assert((await page.getByTestId("section-of").innerText()).includes("1 من 3"), "section indicator");
  for (const id of ["studentName", "nationalId", "phone", "email"]) assert((await page.locator(`#${id}`).count()) === 0, `${id} asked in the form`);
  assert((await page.getByTestId("profile-notice").innerText()).includes(STUDENT_NAME), "profile shown");
});

await check("validation blocks Next and explains each problem", async () => {
  await page.getByTestId("wizard-next").click();
  await fieldError("projectType").waitFor();
  assert(await fieldError("title").isVisible(), "title error");
  assert(await fieldError("description").isVisible(), "description error");
  assert(await step("details-1").isVisible(), "stayed on the step");
  await page.locator("#title").fill(A.title);
  assert((await fieldError("title").count()) === 0, "error cleared on edit");
});

await check("project details: group project requires participants", async () => {
  for (const label of ["هل المشروع فردي أم جماعي؟", "فردي", "جماعي", "أخرى", "أسماء الطلاب المشاركين في المشروع – إن وجدوا", "اسم المشروع أو الابتكار", "وصف مختصر للمشروع"]) {
    assert((await page.locator("main").innerText()).includes(label), `missing ${label}`);
  }
  await choose("projectType", "group");
  await page.locator("#title").fill(A.title);
  await page.locator("#description").fill(A.description);
  await page.getByTestId("wizard-next").click();
  await fieldError("participants").waitFor();
  await page.locator("#participants").fill(A.participants);
  await next("details-2");
  // Previous keeps every answer.
  await page.getByTestId("wizard-previous").click();
  await step("details-1").waitFor();
  assert((await page.locator("#title").inputValue()) === A.title, "title kept");
  assert((await page.locator("#participants").inputValue()) === A.participants, "participants kept");
  await next("details-2");
  await page.locator("#goals").fill(A.goals);
  await page.locator("#idea").fill(A.idea);
  await next("details-3");
});

await check("competition name appears only for نعم; summary capped at 300 with a live counter", async () => {
  assert((await page.locator("#competitionName").count()) === 0, "hidden before yes");
  await choose("competition", "yes");
  await page.locator("#competitionName").fill(A.competitionName);
  await page.locator("#summary").fill("abc");
  assert((await page.getByTestId("summary-counter").innerText()).replace(/\s/g, "") === "3/300", "counter 3/300");
  await page.locator("#summary").fill(LONG_SUMMARY);
  await shot(page, "details-3");
  const value = await page.locator("#summary").inputValue();
  assert(value.length === 300, `summary length ${value.length}`);
  assert((await page.getByTestId("summary-counter").innerText()).replace(/\s/g, "") === "300/300", "counter 300/300");
  await next("classification-1");
});

await check("classification: 22 project fields, أخرى asks for the field", async () => {
  const options = await page.locator("#field option:not([disabled])").count();
  assert(options === 22, `field options ${options}`);
  await page.locator("#field").selectOption("other");
  await page.locator("#fieldOther").waitFor();
  await page.locator("#problem").fill(A.problem);
  await page.locator("#tools").fill(A.tools);
  await page.getByTestId("wizard-next").click();
  await fieldError("fieldOther").waitFor();
  await page.locator("#fieldOther").fill(A.fieldOther);
  await next("classification-2");
});

await check("amounts must be valid non-negative SAR values", async () => {
  await page.locator("#toolsCost").fill("-5");
  await page.locator("#requestedAmount").fill("abc");
  await page.getByTestId("wizard-next").click();
  await fieldError("toolsCost").waitFor();
  await fieldError("requestedAmount").waitFor();
  await page.locator("#toolsCost").fill("1500");
  await page.locator("#requestedAmount").fill("2,500.50");
  await next("attachments-1");
});

await check("save draft, reload and resume with answers restored", async () => {
  await page.getByTestId("wizard-save").click();
  await until(async () => /حُفظت المسودة/.test(await page.getByTestId("save-status").innerText()), "save status");
  await page.reload();
  await page.getByTestId("draft-restored").waitFor();
  assert((await page.locator("#title").inputValue()) === A.title, "title restored");
  for (const id of ["details-2", "details-3", "classification-1", "classification-2", "attachments-1"]) await next(id);
  assert((await page.locator("#summary").count()) === 0, "on attachments step");
});

await check("cover image is required, uploads and previews", async () => {
  await choose("projectStatus", "complete");
  await page.locator("#supervisor").fill(A.supervisor);
  await page.getByTestId("wizard-next").click();
  await fieldError("cover").waitFor();
  await page.getByTestId("cover-input").setInputFiles({ name: `cover-${RUN}.png`, mimeType: "image/png", buffer: coverPng });
  await page.getByRole("button", { name: "تغيير الصورة" }).waitFor({ timeout: 60000 });
  assert((await fieldError("cover").count()) === 0, "cover error cleared");
  await shot(page, "attachments-1");
  await next("attachments-2");
});

await check("supporting files upload privately (PDF + image) and can be removed", async () => {
  await page.getByTestId("evidence-input").setInputFiles([
    { name: A.evidenceName, mimeType: "application/pdf", buffer: pdf },
    { name: `qa-photo-${RUN}.png`, mimeType: "image/png", buffer: coverPng },
  ]);
  await until(async () => (await page.locator('[data-testid="evidence-list"] li').count()) === 2 && !(await page.getByTestId("evidence-list").innerText()).includes("جارٍ الرفع"), "two files uploaded", 60000);
  await shot(page, "attachments-2");
  await page.getByRole("button", { name: `حذف: qa-photo-${RUN}.png` }).click();
  await until(async () => (await page.locator('[data-testid="evidence-list"] li').count()) === 1, "file removed");
  await page.getByTestId("evidence-input").setInputFiles({ name: "notes.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await until(async () => (await page.locator("main").innerText()).includes("نوع الملف غير مدعوم"), "unsupported type rejected");
  await next("attachments-3");
});

await check("acknowledgment text and checkbox are required", async () => {
  const text = await page.locator("main").innerText();
  assert(text.includes("أقر أنا الطالب بأن البيانات الواردة في هذه الاستمارة صحيحة"), "acknowledgment statement");
  assert(text.includes("أقر بصحة البيانات"), "checkbox label");
  await page.getByTestId("wizard-next").click();
  await fieldError("acknowledged").waitFor();
  await page.locator('label[for="acknowledged"]').click();
  assert((await page.getByTestId("form-error").count()) === 0, "error banner cleared once fixed");
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
});

await check("review shows every answer, marks private ones; submit disabled until acknowledged", async () => {
  const review = await page.getByTestId("review").innerText();
  for (const v of [A.title, A.nationalId, A.email, A.supervisor, A.fieldOther, "ثالث ثانوي", "الشعبة 2", "جماعي", "مكتمل", A.evidenceName]) {
    assert(review.includes(v), `review missing ${v}`);
  }
  assert(review.includes("سري"), "private tag");
  await shot(page, "review");
  await page.locator('label[for="review-acknowledged"]').click();
  assert(await page.getByTestId("wizard-submit").isDisabled(), "submit disabled without acknowledgment");
  await page.locator('label[for="review-acknowledged"]').click();
  assert(await page.getByTestId("wizard-submit").isEnabled(), "submit enabled");
});

let projectId = null;
let slug = null;
await check("submit saves to the database and shows the confirmation", async () => {
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("submit-success").waitFor({ timeout: 30000 });
  assert((await page.getByTestId("submit-success").innerText()).includes(A.title), "confirmation names the project");
  await shot(page, "success");
  if (!sql) return;
  const [p] = await sql`select id, slug, title, summary, requested_amount::float8 as amount, field, field_other, status, grade, points, supervisor, cover_media_id
                          from projects where title = ${A.title}`;
  assert(p, "project row");
  projectId = p.id;
  slug = p.slug;
  assert(p.summary === SUMMARY, "summary stored exactly");
  assert(p.amount === 2500.5 && p.field === "other" && p.field_other === A.fieldOther, "amount / field stored");
  assert(p.status === "published" && p.grade === 12 && p.cover_media_id, "published with grade and cover");
  assert(p.supervisor === null, "supervisor not copied to the public project");
  const [s] = await sql`select status, answers, evidence from project_submissions where project_id = ${p.id}`;
  assert(s?.status === "submitted", "submission row");
  assert(s.answers.nationalId === A.nationalId && s.answers.phone === A.phone && s.answers.email === A.email, "private answers kept");
  assert(s.answers.acknowledged === true && s.answers.acknowledgedAt, "acknowledgment recorded");
  assert(s.evidence.length === 1 && s.evidence[0].name === A.evidenceName, "one supporting file kept");
  const [{ drafts }] = await sql`select count(*)::int as drafts from project_submissions ps join students st on st.id = ps.student_id
                                  where st.name_en = ${STUDENT} and ps.status = 'draft'`;
  assert(drafts === 0, "draft consumed");
});

await check("Explore Projects lists the card with only public information", async () => {
  await page.goto(BASE + "/projects");
  const card = page.locator(`[data-testid="explore-card"]:has-text("${A.title}")`);
  await card.waitFor();
  assert((await page.locator('[data-testid="explore-card"]').first().innerText()).includes(A.title), "newest first");
  await shot(page, "explore");
  const text = await card.innerText();
  assert((await card.getByTestId("card-summary").innerText()) === SUMMARY.trim() || (await card.getByTestId("card-summary").innerText()) === SUMMARY, "exact summary");
  assert(text.includes(A.fieldOther), "field label");
  assert(text.includes("ثالث ثانوي"), "grade");
  assert(text.includes("المبلغ المطلوب") && (await card.getByTestId("card-amount").innerText()).includes("2,500.5") && text.includes("ر.س"), "requested amount");
  assert((await card.locator("img").count()) === 1, "cover image");
  assert((await card.locator("a, button").count()) === 0, "card has no links or buttons");
  const pageText = await page.locator("main").innerText();
  for (const word of ["ادعم المشروع", "عرض المشروع", "تبرع"]) assert(!pageText.includes(word), `unexpected "${word}"`);
  // The funding indicator (added with My Projects) starts at 0 recorded support.
  assert((await card.getByTestId("card-funding").getAttribute("data-percent")) === "0", "funding starts at 0%");
});

await check("no private answer appears in public HTML or payloads", async () => {
  const urls = ["/projects", `/projects?q=${encodeURIComponent(A.fieldOther)}`, "/home", "/leaderboard", "/students"];
  if (slug) urls.push(`/projects/${slug}`);
  for (const url of urls) {
    for (const headers of [{}, { RSC: "1" }]) {
      const res = await context.request.get(BASE + url, { headers });
      const body = await res.text();
      for (const secret of SECRETS) assert(!body.includes(secret), `${url} ${headers.RSC ? "(RSC)" : ""} exposes ${secret}`);
    }
  }
});

await check("search, field filter, category chip and count", async () => {
  await page.locator("#project-search").fill(A.fieldOther);
  await until(async () => page.url().includes("q="), "search applied");
  await until(async () => (await page.locator('[data-testid="explore-card"]').count()) === 1, "one search result");
  assert((await page.getByTestId("results-count").innerText()).includes("مشروع واحد"), "count text");
  await page.goto(BASE + `/projects?q=${encodeURIComponent("zzqq" + RUN)}`);
  await page.getByText("لم يتم العثور على مشاريع.").waitFor();
  await page.goto(BASE + "/projects?field=other");
  await page.locator(`[data-testid="explore-card"]:has-text("${A.title}")`).waitFor();
  await page.goto(BASE + "/projects?field=robotics");
  assert((await page.locator(`[data-testid="explore-card"]:has-text("${A.title}")`).count()) === 0, "field filter excludes");
  await page.goto(BASE + "/projects");
  await page.getByRole("button", { name: "الابتكار", exact: true }).click();
  await until(async () => page.url().includes("category=innovation"), "category chip");
  await page.locator(`[data-testid="explore-card"]:has-text("${A.title}")`).waitFor();
});

await check("supporting files: admin-only download route", async () => {
  if (!sql || !projectId) throw new Error("needs DATABASE_URL");
  const [s] = await sql`select evidence from project_submissions where project_id = ${projectId}`;
  const href = `/api/admin/submission-files?${new URLSearchParams({ path: s.evidence[0].path })}`;
  const asStudent = await context.request.get(BASE + href, { maxRedirects: 0 });
  assert(asStudent.status() === 401, `student got ${asStudent.status()}`);
  const anon = await browser.newContext();
  const asAnon = await anon.request.get(BASE + href, { maxRedirects: 0 });
  assert(asAnon.status() === 401 || asAnon.status() === 307, `anonymous got ${asAnon.status()}`);
  await anon.close();
});

await check("another student gets their own empty form (no access to others' answers)", async () => {
  const other = await newContext("ar");
  const p2 = await other.newPage();
  watch(p2);
  await studentLogin(p2, BASE, otherCode);
  await completeProfile(p2, BASE, {
    fullName: `طالب آخر ${RUN}`,
    nationalId: validNationalId(),
    phone: "0551234567",
    email: `qa.other.${RUN.toLowerCase()}@example.com`,
    grade: "10",
    section: "1",
  });
  await p2.goto(BASE + "/add-project");
  await p2.locator('[data-step="details-1"]').waitFor();
  assert((await p2.locator("#title").inputValue()) === "", "empty title");
  assert(!(await p2.getByTestId("profile-notice").innerText()).includes(STUDENT_NAME), "not the first student's profile");
  assert(!(await p2.content()).includes(A.nationalId), "first student's ID not in the page");
  // Cancel deletes the draft and returns home.
  await p2.locator("#title").fill(`QA other ${RUN}`);
  await p2.getByTestId("wizard-save").click();
  await until(async () => /حُفظت المسودة/.test(await p2.getByTestId("save-status").innerText()), "saved");
  await p2.getByTestId("wizard-cancel").click();
  await p2.getByRole("button", { name: "نعم، إلغاء" }).click();
  await p2.waitForURL(BASE + "/home");
  if (sql) {
    const [{ n }] = await sql`select count(*)::int as n from project_submissions ps join students st on st.id = ps.student_id
                               where st.name_en = ${OTHER_STUDENT} and ps.status = 'draft'`;
    assert(n === 0, "draft deleted on cancel");
  }
  await other.close();
});

await check("server enforces the 300-character summary", async () => {
  if (!sql) throw new Error("needs DATABASE_URL");
  let failed = false;
  try {
    await sql`update projects set summary = ${"x".repeat(301)} where id = ${projectId}`;
  } catch {
    failed = true;
  }
  assert(failed, "database constraint rejects 301 characters");
});

await check("English UI and mobile layout", async () => {
  const en = await newContext("en", { width: 390, height: 844 });
  await en.addCookies((await context.cookies()).filter((c) => c.name === "ti_student_sid"));
  const p3 = await en.newPage();
  watch(p3);
  await p3.goto(BASE + "/add-project");
  await p3.getByRole("heading", { name: "Add a Project", level: 1 }).waitFor();
  assert((await p3.getByTestId("section-of").innerText()).includes("1 of 3"), "English progress");
  const overflow = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `add-project overflows by ${overflow}px`);
  await p3.goto(BASE + "/projects");
  await p3.locator('[data-testid="explore-card"]').first().waitFor();
  const overflow2 = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow2 <= 0, `projects overflows by ${overflow2}px`);
  await en.close();
  // Throw away the draft this visit created.
  if (sql) await sql`delete from project_submissions ps using students st where st.id = ps.student_id and st.name_en = ${STUDENT} and ps.status = 'draft'`;
});

await check("admin sees the private form and files, can download and hide the project", async () => {
  const adminContext = await newContext("en");
  const ap = await adminContext.newPage();
  watch(ap);
  await adminLogin(ap, BASE, ADMIN);
  await ap.goto(BASE + "/add-project");
  await ap.getByTestId("admin-notice").waitFor();
  if (!projectId) throw new Error("no project");
  await ap.goto(BASE + `/admin/projects/${projectId}/edit`);
  const details = ap.getByTestId("submission-details");
  await details.waitFor();
  await shot(ap, "admin-edit");
  const text = await details.innerText();
  for (const v of [A.nationalId, A.phone, A.email, A.supervisor, A.problem, A.evidenceName]) assert(text.includes(v), `admin view missing ${v}`);
  assert((await ap.locator("#project-summary").inputValue()) === SUMMARY, "editor shows summary");
  assert((await ap.locator("#project-requested-amount").inputValue()) === "2500.5", "editor shows amount");
  const href = await ap.getByTestId("evidence-download").getAttribute("href");
  const res = await adminContext.request.get(BASE + href);
  assert(res.status() === 200 && (await res.body()).subarray(0, 5).toString() === "%PDF-", "admin downloads the file");
  // Hide it with the existing unpublish action.
  await ap.goto(BASE + `/admin/projects?q=${encodeURIComponent(A.title)}`);
  await ap.getByRole("button", { name: `More actions: ${A.title}` }).click();
  await ap.getByRole("menuitem", { name: "Unpublish" }).click();
  await until(async () => {
    const [p] = await sql`select status from projects where id = ${projectId}`;
    return p.status === "draft";
  }, "unpublished");
  await page.goto(BASE + "/projects");
  assert((await page.locator(`[data-testid="explore-card"]:has-text("${A.title}")`).count()) === 0, "hidden from Explore Projects");
  await adminContext.close();
});

await check("no browser errors", async () => {
  assert(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await context.close();
await browser.close();

if (sql) {
  // Remove what this run created (the project, its media rows and links, and submissions).
  const projects = await sql`select id from projects where title = ${A.title}`;
  for (const p of projects) {
    await sql`delete from project_submissions where project_id = ${p.id}`;
    await sql`delete from projects where id = ${p.id}`;
  }
  await sql`delete from project_submissions ps using students st where st.id = ps.student_id and st.name_en in (${STUDENT}, ${OTHER_STUDENT}) and ps.status = 'draft'`;
  await sql`delete from student_profiles where student_id in (select id from students where name_en in (${STUDENT}, ${OTHER_STUDENT}))`;
  await sql.end();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
