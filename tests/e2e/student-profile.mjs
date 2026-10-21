/**
 * "الملف الشخصي" (student profile) end to end:
 *  - the account menu links to the profile page
 *  - an incomplete profile blocks adding a project (redirect + clear message),
 *    on the page, in the server actions and in the database
 *  - the profile page validates, saves to the database and shows its status
 *  - a complete profile: the project form has no personal questions, the
 *    project is linked to the profile, data is the same on any device
 *  - privacy between students; existing projects keep working
 *
 * Usage: node --env-file-if-exists=.env.local tests/e2e/student-profile.mjs
 * Needs DATABASE_URL and the admin variables (see README → Verification).
 */
import { chromium } from "playwright";
import { adminCredentials, ensureStudentCode, randomClientIp, studentLogin, validNationalId } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const OWNER = "Demo Student F";
const OTHER = "Demo Student E";
const RUN = `PF${Date.now().toString(36).toUpperCase()}`;
const results = [];
const errors = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function check(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push(false);
    console.log(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`);
  }
}
async function until(fn, msg, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out: ${msg}`);
}

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is required for this suite.");
  process.exit(1);
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

const [owner] = await sql`select id from students where name_en = ${OWNER}`;
const [other] = await sql`select id from students where name_en = ${OTHER}`;
assert(owner && other, "demo students missing (run the seed)");

async function cleanup() {
  const ids = [owner.id, other.id];
  const projects = await sql`
    select distinct p.id from projects p join project_submissions ps on ps.project_id = p.id
     where ps.student_id = any(${ids}) and p.title like 'QA Profile%'`;
  const projectIds = projects.map((p) => p.id);
  await sql`delete from project_submissions where student_id = any(${ids}) and (status in ('draft', 'editing') or project_id = any(${projectIds}))`;
  await sql`delete from projects where id = any(${projectIds})`;
  await sql`delete from student_profiles where student_id = any(${ids})`;
  await sql`delete from student_project_activity where student_id = any(${ids})`;
}
await cleanup();

const PROFILE = {
  fullName: `طالب الملف ${RUN} الزهراني`,
  nationalId: validNationalId(),
  phone: "05" + String(Math.floor(10000000 + Math.random() * 89999999)),
  email: `qa.profile.${RUN.toLowerCase()}@example.com`,
  grade: "11",
  section: "3",
};
const TITLE = `QA Profile ${RUN} مشروع`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ownerCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: OWNER });
const otherCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: OTHER });

async function newPage(lang = "ar", viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to fetch|ERR_ABORTED|net::ERR|status of 404/.test(m.text())) return;
    errors.push(m.text());
  });
  return { context, page: p };
}

const profileRow = async (id = owner.id) =>
  (await sql`select full_name, national_id, phone, email, grade, section, is_complete from student_profiles where student_id = ${id}`)[0] ?? null;
const draftOf = async (id = owner.id) => (await sql`select id, status from project_submissions where student_id = ${id} and status = 'draft'`)[0] ?? null;

// Captured server action requests (real calls made by the pages), replayed to
// show that the server enforces the rules without the browser's checks.
const captured = {};
function capture(page, name, match) {
  page.on("request", (r) => {
    if (captured[name] || r.method() !== "POST" || !r.headers()["next-action"]) return;
    if (match(r.postData() ?? "")) captured[name] = { url: r.url(), headers: r.headers(), body: r.postData() };
  });
}
async function replay(onPage, name, mutate) {
  const req = captured[name];
  assert(req, `${name} request captured`);
  const args = JSON.parse(req.body);
  mutate(args);
  return onPage.evaluate(
    async ({ url, headers, body }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { accept: headers.accept, "next-action": headers["next-action"], "content-type": headers["content-type"], "next-router-state-tree": headers["next-router-state-tree"] ?? "" },
        body,
      });
      return { status: res.status, text: await res.text() };
    },
    { url: req.url, headers: req.headers, body: JSON.stringify(args) },
  );
}

let { context: ownerContext, page } = await newPage();
capture(page, "saveProfile", (body) => body.includes('"nationalId"') && body.includes('"fullName"'));
capture(page, "saveDraft", (body) => body.includes('"projectType"') && body.includes('"summary"'));
await studentLogin(page, BASE, ownerCode);

// ---------------------------------------------------------------------------
// Menu and the blocked path
// ---------------------------------------------------------------------------

await check("account menu: name, الملف الشخصي, مشاريعي, تسجيل الخروج; الملف الشخصي opens /profile", async () => {
  await page.goto(BASE + "/home");
  await page.getByRole("button", { name: /الحساب|طالب/ }).first().click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const items = await menu.getByRole("menuitem").allInnerTexts();
  const labels = items.map((s) => s.trim());
  assert(labels.indexOf("الملف الشخصي") >= 0 && labels.indexOf("الملف الشخصي") < labels.indexOf("مشاريعي"), JSON.stringify(labels));
  assert(labels.some((l) => l.includes("تسجيل الخروج")), "sign out");
  await page.getByTestId("menu-profile").click();
  await page.waitForURL(BASE + "/profile");
  await page.getByTestId("profile-form").waitFor();
});

await check("incomplete profile: status غير مكتمل with every missing field; values suggested from the school record are not saved", async () => {
  const status = page.getByTestId("profile-status");
  assert((await status.getAttribute("data-complete")) === "false", "incomplete");
  assert((await page.getByTestId("profile-badge").innerText()).includes("غير مكتمل"), "badge");
  const missing = await page.getByTestId("profile-missing").locator("li").evaluateAll((els) => els.map((e) => e.getAttribute("data-field")));
  assert(JSON.stringify(missing) === JSON.stringify(["fullName", "nationalId", "phone", "email", "grade", "section"]), JSON.stringify(missing));
  assert((await profileRow()) === null, "nothing stored by opening the page");
  assert((await page.getByTestId("profile-add-project").count()) === 0, "no add-project button while incomplete");
});

await check("adding a project is blocked: /add-project, the homepage button and My Projects lead to the profile with a clear message", async () => {
  await page.goto(BASE + "/add-project");
  await page.waitForURL(/\/profile\?required=project$/);
  const alert = page.getByTestId("profile-required");
  await alert.waitFor();
  assert((await alert.innerText()).includes("يجب استكمال بياناتك الشخصية أولًا"), "message");
  assert((await page.locator("[data-step]").count()) === 0, "the project form is not shown");
  await page.goto(BASE + "/home");
  await page.getByTestId("hero-add-project").click();
  await page.waitForURL(/\/profile\?required=project$/);
  await page.goto(BASE + "/my-projects");
  const notice = page.locator('[data-testid="notifications-list"] li[data-kind="profile"]');
  await notice.waitFor();
  assert((await notice.innerText()).includes("أكمل ملفك الشخصي"), "My Projects notice");
  await page.getByTestId("add-new-project").click();
  await page.waitForURL(/\/profile\?required=project$/);
  assert((await draftOf()) === null, "no draft created");
});

await check("the database refuses a new draft or a submission for an incomplete profile (even if the server were bypassed)", async () => {
  let refused = false;
  try {
    await sql`insert into project_submissions (student_id, answers) values (${owner.id}, '{}'::jsonb)`;
  } catch (e) {
    refused = e.hint === "profile_incomplete";
  }
  assert(refused, "draft insert refused");
  // An incomplete profile row is still incomplete.
  await sql`insert into student_profiles (student_id, full_name, phone) values (${owner.id}, ${PROFILE.fullName}, ${PROFILE.phone})`;
  refused = false;
  try {
    await sql`insert into project_submissions (student_id, answers, status) values (${owner.id}, '{}'::jsonb, 'submitted')`;
  } catch (e) {
    refused = e.hint === "profile_incomplete";
  }
  assert(refused, "submitted insert refused");
  assert((await profileRow()).is_complete === false, "computed as incomplete");
  await sql`delete from student_profiles where student_id = ${owner.id}`;
});

// ---------------------------------------------------------------------------
// The profile page
// ---------------------------------------------------------------------------

await check("profile page: every field is required and validated (accessible errors, focus on the first)", async () => {
  await page.goto(BASE + "/profile");
  for (const id of ["fullName", "nationalId", "phone", "email"]) await page.locator(`#${id}`).fill("");
  await page.getByTestId("profile-save").click();
  await page.locator("#fullName-error").waitFor();
  for (const id of ["nationalId", "phone", "email"]) assert(await page.locator(`#${id}-error`).isVisible(), `${id} error`);
  assert((await page.evaluate(() => document.activeElement?.id)) === "fullName", "focus on the first error");
  await page.locator("#fullName").fill(PROFILE.fullName);
  await page.locator("#nationalId").fill("1234567890");
  await page.locator("#phone").fill("0412");
  await page.locator("#email").fill("not-an-email");
  await page.getByTestId("profile-save").click();
  assert((await page.locator("#nationalId-error").innerText()).includes("رقم الهوية غير صحيح"), "national ID check digit");
  assert((await page.locator("#phone-error").innerText()).includes("رقم جوال"), "phone format");
  assert((await page.locator("#email-error").innerText()).includes("بريد"), "email format");
  assert((await profileRow()) === null, "nothing saved while invalid");
});

await check("saving a complete profile stores it in the database and continues to the project form", async () => {
  await page.goto(BASE + "/add-project");
  await page.waitForURL(/required=project/);
  await page.locator("#fullName").fill(`  ${PROFILE.fullName}  `);
  // Arabic-Indic digits and an international phone format are normalised.
  await page.locator("#nationalId").fill(PROFILE.nationalId.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]));
  await page.locator("#phone").fill("+966 " + PROFILE.phone.slice(1));
  await page.locator("#email").fill(PROFILE.email.toUpperCase());
  await page.locator(`label:has(input[name="grade"][value="${PROFILE.grade}"])`).click();
  await page.locator(`label:has(input[name="section"][value="${PROFILE.section}"])`).click();
  await page.getByTestId("profile-save").click();
  await page.waitForURL(BASE + "/add-project");
  await page.locator('[data-step="details-1"]').waitFor();
  const row = await profileRow();
  assert(
    row &&
      row.is_complete &&
      row.full_name === PROFILE.fullName &&
      row.national_id === PROFILE.nationalId &&
      row.phone === PROFILE.phone &&
      row.email === PROFILE.email &&
      row.grade === 11 &&
      row.section === 3,
    JSON.stringify({ ...row, national_id: row?.national_id ? "set" : null }),
  );
});

await check("the project form has no personal questions; it shows the profile and starts with the project details", async () => {
  const notice = page.getByTestId("profile-notice");
  await notice.waitFor();
  assert((await notice.innerText()).includes(PROFILE.fullName), "name from the profile");
  for (const id of ["studentName", "nationalId", "phone", "email"]) assert((await page.locator(`#${id}`).count()) === 0, `${id} asked again`);
  assert((await page.locator('input[name="grade"], input[name="section"]').count()) === 0, "grade/section asked again");
  assert((await page.getByTestId("section-of").innerText()).includes("1 من 3"), "three sections");
});

await check("the server refuses an invalid profile sent directly (browser checks bypassed)", async () => {
  const before = await profileRow();
  const res = await replay(page, "saveProfile", (args) => {
    args[0] = { ...args[0], nationalId: "1234567890", email: "x" };
  });
  assert(res.status === 200 && res.text.includes('"validation"'), `response ${res.status}`);
  const after = await profileRow();
  assert(after.national_id === before.national_id && after.email === before.email, "profile unchanged");
});

// ---------------------------------------------------------------------------
// Submitting: profile linked to the project
// ---------------------------------------------------------------------------

const art = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await art.setContent(`<div style="width:1200px;height:750px;background:linear-gradient(135deg,#5c3bfc,#5cc5c2)"></div>`);
const coverPng = await art.screenshot({ type: "png" });
await art.close();

const step = (id) => page.locator(`[data-step="${id}"]`);
const next = async (to) => {
  await page.getByTestId("wizard-next").click();
  if (to) await step(to).waitFor();
};
const choose = (name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();

async function fillProject() {
  await choose("projectType", "individual");
  await page.locator("#title").fill(TITLE);
  await page.locator("#description").fill(`وصف ${RUN}`);
  await next("details-2");
  await page.locator("#goals").fill(`أهداف ${RUN}`);
  await page.locator("#idea").fill(`فكرة ${RUN}`);
  await next("details-3");
  await choose("competition", "no");
  await page.locator("#summary").fill(`ملخص ${RUN}`);
  await next("classification-1");
  await page.locator("#field").selectOption("ai");
  await page.locator("#targetCompetition").selectOption("saif");
  await page.locator("#problem").fill(`مشكلة ${RUN}`);
  await page.locator("#tools").fill(`أدوات ${RUN}`);
  await next("classification-2");
  await page.locator("#toolsCost").fill("100");
  await page.locator("#requestedAmount").fill("700");
  await next("attachments-1");
  await choose("projectStatus", "complete");
  await page.locator("#supervisor").fill(`أ. مشرف ${RUN}`);
  await page.getByTestId("cover-input").setInputFiles({ name: `cover-${RUN}.png`, mimeType: "image/png", buffer: coverPng });
  await until(async () => (await page.locator("main").innerText()).includes("تغيير الصورة"), "cover uploaded", 60000);
  await next("attachments-2");
  await next("attachments-3");
  await page.locator('label[for="acknowledged"]').click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
}

await check("the server refuses to submit when the profile became incomplete; the student is sent to the profile", async () => {
  await fillProject();
  const review = page.locator('[data-review-section="profile"]');
  await review.waitFor();
  assert((await review.innerText()).includes(PROFILE.email), "review shows the profile details that will be linked");
  // The profile loses a required field (e.g. edited elsewhere) before submitting.
  await sql`update student_profiles set email = null where student_id = ${owner.id}`;
  await page.getByTestId("wizard-submit").click();
  await page.waitForURL(/\/profile\?required=project$/);
  const draft = await draftOf();
  assert(draft, "draft kept for later");
  const created = await sql`select id from projects where title = ${TITLE}`;
  assert(created.length === 0, "no project created");
});

await check("the server action also refuses to save a new draft while the profile is incomplete", async () => {
  await sql`delete from project_submissions where id = (select id from project_submissions where student_id = ${owner.id} and status = 'draft')`;
  const res = await replay(page, "saveDraft", (args) => {
    args[2] = null;
  });
  assert(res.status === 200 && res.text.includes("profile_incomplete"), `response ${res.status}`);
  assert((await draftOf()) === null, "no draft created");
});

await check("with the profile completed again, the project is submitted and linked to the profile (snapshot, grade, student)", async () => {
  await page.locator("#email").fill(PROFILE.email);
  await page.getByTestId("profile-save").click();
  await page.waitForURL(BASE + "/add-project");
  await step("details-1").waitFor();
  await fillProject();
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("submit-success").waitFor({ timeout: 30000 });
  const [p] = await sql`select id, grade from projects where title = ${TITLE}`;
  assert(p && p.grade === 11, `project grade ${p?.grade}`);
  const [s] = await sql`select student_id, answers from project_submissions where project_id = ${p.id} and status = 'submitted'`;
  assert(s.student_id === owner.id, "linked to the student's profile");
  const a = s.answers;
  assert(
    a.studentName === PROFILE.fullName && a.nationalId === PROFILE.nationalId && a.phone === PROFILE.phone && a.email === PROFILE.email && a.grade === "11" && a.section === "3",
    "submission carries the profile details",
  );
  const linked = await sql`select 1 from project_students where project_id = ${p.id} and student_id = ${owner.id}`;
  assert(linked.length === 1, "project linked to the student");
});

await check("profile details stay private: not on the public project page", async () => {
  const [{ slug }] = await sql`select slug from projects where title = ${TITLE}`;
  await page.goto(BASE + `/projects/${slug}`);
  const html = await page.content();
  for (const v of [PROFILE.nationalId, PROFILE.phone, PROFILE.email]) assert(!html.includes(v), "private value on a public page");
});

// ---------------------------------------------------------------------------
// Any device, other students, existing projects
// ---------------------------------------------------------------------------

await check("another device (new session): the saved profile is shown and adding a project goes straight to the form", async () => {
  const { context, page: other } = await newPage();
  await studentLogin(other, BASE, ownerCode);
  await other.goto(BASE + "/profile");
  await other.locator('[data-testid="profile-status"][data-complete="true"]').waitFor();
  assert((await other.locator("#nationalId").inputValue()) === PROFILE.nationalId, "national ID");
  assert((await other.locator("#email").inputValue()) === PROFILE.email, "email");
  assert(await other.locator('input[name="section"][value="3"]').isChecked(), "section");
  await other.goto(BASE + "/add-project");
  await other.locator('[data-step="details-1"]').waitFor();
  assert(other.url() === BASE + "/add-project", "not redirected");
  await context.close();
});

await check("another student never sees this profile and is still asked to complete their own", async () => {
  const { context, page: other } = await newPage();
  await studentLogin(other, BASE, otherCode);
  await other.goto(BASE + "/profile");
  await other.getByTestId("profile-form").waitFor();
  for (const id of ["nationalId", "phone", "email"]) assert((await other.locator(`#${id}`).inputValue()) !== PROFILE[id], `${id} leaked`);
  assert(!(await other.content()).includes(PROFILE.nationalId), "national ID in the page");
  await other.goto(BASE + "/add-project");
  await other.waitForURL(/required=project/);
  await context.close();
});

await check("existing projects keep working: editing one is not blocked by an incomplete profile, and keeps its stored details", async () => {
  const [p] = await sql`select id from projects where title = ${TITLE}`;
  await sql`update student_profiles set phone = null where student_id = ${owner.id}`;
  await page.goto(BASE + `/my-projects/${p.id}/edit`);
  await page.locator('[data-step="details-1"]').waitFor();
  await page.locator("#title").fill(`${TITLE} معدل`);
  await page.getByTestId("wizard-next").click();
  await page.locator('[data-step="details-2"]').waitFor();
  await until(async () => (await sql`select 1 from project_submissions where project_id = ${p.id} and status = 'editing'`).length === 1, "edit draft saved");
  await page.getByTestId("wizard-cancel").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "تجاهل التعديلات" }).click();
  await page.waitForURL(BASE + "/my-projects");
  const [s] = await sql`select answers from project_submissions where project_id = ${p.id} and status = 'submitted'`;
  assert(s.answers.phone === PROFILE.phone, "stored details unchanged");
  await sql`update student_profiles set phone = ${PROFILE.phone} where student_id = ${owner.id}`;
});

await check("signed-out visitors are sent to sign in; administrators see a notice", async () => {
  const { context, page: anon } = await newPage();
  await anon.goto(BASE + "/profile");
  await anon.waitForURL(/\/welcome/);
  await context.close();
  const { context: ac, page: admin } = await newPage();
  const { adminLogin } = await import("./lib/student.mjs");
  await adminLogin(admin, BASE, ADMIN);
  await admin.goto(BASE + "/profile");
  await admin.getByTestId("admin-notice").waitFor();
  await ac.close();
});

await check("English: labels translated, left-to-right", async () => {
  const { context, page: en } = await newPage("en");
  await studentLogin(en, BASE, ownerCode);
  await en.goto(BASE + "/profile");
  await en.getByTestId("profile-form").waitFor();
  assert((await en.locator("html").getAttribute("dir")) === "ltr", "ltr");
  const text = await en.locator("main").innerText();
  for (const label of ["Profile", "Full name", "National ID / Iqama number", "Mobile number", "Complete"]) assert(text.includes(label), `missing ${label}`);
  await context.close();
});

await check("mobile and tablet: the profile page fits and the menu reaches الملف الشخصي", async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    const { context, page: m } = await newPage("ar", viewport);
    await studentLogin(m, BASE, ownerCode);
    await m.goto(BASE + "/profile");
    await m.getByTestId("profile-form").waitFor();
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `horizontal overflow ${overflow}px at ${viewport.width}`);
    if (viewport.width < 800) {
      await m.goto(BASE + "/home");
      await m.getByRole("button", { name: "فتح القائمة" }).click();
      await m.getByTestId("mobile-profile").click();
      await m.waitForURL(BASE + "/profile");
    }
    await context.close();
  }
});

await check("no browser errors (hydration or otherwise)", async () => {
  assert(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await ownerContext.close();
await browser.close();
if (!process.env.KEEP_QA_DATA) await cleanup();
await sql.end();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
