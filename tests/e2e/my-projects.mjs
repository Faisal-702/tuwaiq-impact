/**
 * "مشاريعي" (My Projects): student profile reuse, several supervisors,
 * editing, manually recorded funding support, and the public funding display.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/my-projects.mjs
 *
 * Uses Demo Student G (owner) and Demo Student H (another student). Needs
 * DATABASE_URL (from .env.local) for storage checks. Projects created here are
 * titled "QA MyProj …" and removed at the start and the end, together with
 * the two students' saved profiles and drafts.
 */
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { adminCredentials, adminLogin, ensureStudentCode, randomClientIp, studentLogin } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const OWNER = "Demo Student G";
const OTHER = "Demo Student H";
const RUN = Date.now().toString(36).toUpperCase();

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
    if (process.env.QA_SHOTS) await page?.screenshot({ path: `${process.env.QA_SHOTS}/mp-fail-${results.length}.png`, fullPage: true, caret: "initial" }).catch(() => {});
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
const shot = async (p, name, fullPage = true) => {
  if (process.env.QA_SHOTS) await p.screenshot({ path: `${process.env.QA_SHOTS}/${name}.png`, fullPage, caret: "initial" }).catch(() => {});
};

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is required (storage checks).");
  process.exit(1);
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });

async function cleanup() {
  const students = await sql`select id from students where name_en in (${OWNER}, ${OTHER})`;
  const ids = students.map((s) => s.id);
  const projects = await sql`
    select distinct p.id from projects p
      join project_submissions ps on ps.project_id = p.id
     where ps.student_id = any(${ids}) and p.title like 'QA MyProj%'`;
  const projectIds = projects.map((p) => p.id);
  await sql`delete from project_submissions where student_id = any(${ids}) and (status in ('draft', 'editing') or project_id = any(${projectIds}))`;
  await sql`delete from projects where id = any(${projectIds})`;
  await sql`delete from student_profiles where student_id = any(${ids})`;
  await sql`delete from student_project_activity where student_id = any(${ids})`;
}
await cleanup();

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

const PROFILE = {
  name: `طالب المشاريع ${RUN}`,
  nationalId: nationalId(),
  phone: "05" + String(Math.floor(10000000 + Math.random() * 89999999)),
  email: `qa.myproj.${RUN.toLowerCase()}@example.com`,
};
const SUP1 = `أ. سعد ${RUN}`;
const SUP2 = `أ. نورة ${RUN}`;
const P1 = { title: `QA MyProj ${RUN} الري الذكي`, field: "ai", type: "individual", amount: "500", status: "complete" };
const P2 = { title: `QA MyProj ${RUN} الأمن`, field: "cybersecurity", type: "group", amount: "1000", status: "incomplete" };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const ownerCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: OWNER });
const otherCode = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: OTHER });

async function newPage(lang = "ar", viewport = { width: 1672, height: 941 }) {
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

// A cover image drawn by the browser.
const art = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await art.setContent(`<div style="width:1200px;height:750px;background:linear-gradient(135deg,#5c3bfc,#5cc5c2)"></div>`);
const coverPng = await art.screenshot({ type: "png" });
await art.close();

let { context: ownerContext, page } = await newPage();
await studentLogin(page, BASE, ownerCode);

const step = (id) => page.locator(`[data-step="${id}"]`);
const next = async (to) => {
  await page.getByTestId("wizard-next").click();
  if (to) await step(to).waitFor();
};
const choose = (name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();

/** Fills the project part of the form (from the second section on) and submits. */
async function fillProjectAndSubmit(p, { extraSupervisors = [], removeExtra = null, expectSupervisors = null } = {}) {
  await choose("projectType", p.type);
  if (p.type === "group") await page.locator("#participants").fill(`QA participants ${RUN}`);
  await page.locator("#title").fill(p.title);
  await page.locator("#description").fill(`وصف ${p.title}`);
  await next("details-2");
  await page.locator("#goals").fill("أهداف المشروع");
  await page.locator("#idea").fill("فكرة المشروع");
  await next("details-3");
  await choose("competition", "no");
  await page.locator("#summary").fill(`ملخص ${p.title}`);
  await next("classification-1");
  await page.locator("#field").selectOption(p.field);
  await page.locator("#problem").fill("المشكلة");
  await page.locator("#tools").fill("الأدوات");
  await next("classification-2");
  await page.locator("#toolsCost").fill("100");
  await page.locator("#requestedAmount").fill(p.amount);
  await next("attachments-1");
  await choose("projectStatus", p.status);
  await page.locator("#supervisor").fill(SUP1);
  for (const name of extraSupervisors) {
    await page.getByTestId("add-supervisor").click();
    await page.locator('[data-testid="extra-supervisor"] input').last().fill(name);
  }
  if (removeExtra !== null) await page.getByTestId("remove-supervisor").nth(removeExtra).click();
  await page.getByTestId("cover-input").setInputFiles({ name: `cover-${RUN}.png`, mimeType: "image/png", buffer: coverPng });
  await page.getByTestId("cover-input").locator("xpath=..").waitFor();
  await until(async () => (await page.locator("main").innerText()).includes("تغيير الصورة"), "cover uploaded", 60000);
  await next("attachments-2");
  await next("attachments-3");
  await page.locator('label[for="acknowledged"]').click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
  if (expectSupervisors) {
    const review = await page.getByTestId("review").innerText();
    for (const s of expectSupervisors) assert(review.includes(s), `review missing supervisor ${s}`);
  }
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("submit-success").waitFor({ timeout: 30000 });
}

const projectId = async (title) => (await sql`select id from projects where title = ${title}`)[0]?.id;
const card = (id) => page.locator(`[data-testid="my-project-card"][data-project="${id}"]`);

// ---------------------------------------------------------------------------
// Account menu, empty state
// ---------------------------------------------------------------------------

await check("account menu shows the name, الملف الشخصي, مشاريعي and تسجيل الخروج; مشاريعي opens /my-projects", async () => {
  await page.goto(BASE + "/home");
  await page.getByTestId("student-menu").click();
  const menu = page.locator('[role="menu"]');
  const text = (await menu.innerText()).replace(/\s+/g, " ");
  assert(text.includes("مشاريعي") && text.includes("تسجيل الخروج"), text);
  const order = await menu.locator('[role="menuitem"]').allInnerTexts();
  assert(order[0].includes("الملف الشخصي") && order[1].includes("مشاريعي") && order[2].includes("تسجيل الخروج"), order.join(" | "));
  await page.getByTestId("menu-my-projects").click();
  await page.waitForURL((u) => u.pathname === "/my-projects");
  await page.getByRole("heading", { level: 1, name: "مشاريعي" }).waitFor();
});

await check("empty state: no projects, zero totals, calm sidebar, working add button", async () => {
  await page.getByTestId("my-projects-empty").waitFor();
  assert((await page.getByTestId("stat-projects").locator("[data-value]").innerText()) === "0", "0 projects");
  assert((await page.getByTestId("summary-center").innerText()) === "0", "0 collected");
  await page.getByTestId("activity-empty").waitFor();
  // The only notice: the profile must be completed before adding a project.
  const notices = await page.locator('[data-testid="notifications-list"] li').evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  assert(JSON.stringify(notices) === JSON.stringify(["profile"]), JSON.stringify(notices));
  assert((await page.getByTestId("add-new-project").getAttribute("href")) === "/add-project", "add button");
});

// ---------------------------------------------------------------------------
// First project: personal details, several supervisors, publish without approval
// ---------------------------------------------------------------------------

await check("first project: the profile is completed first (once); several supervisors added and one removed", async () => {
  await page.getByTestId("add-new-project").click();
  await page.waitForURL((u) => u.pathname === "/profile" && u.search === "?required=project");
  await page.getByTestId("profile-required").waitFor();
  await page.locator("#fullName").fill(PROFILE.name);
  await page.locator("#nationalId").fill(PROFILE.nationalId);
  await page.locator("#phone").fill(PROFILE.phone);
  await page.locator("#email").fill(PROFILE.email);
  await choose("grade", "11");
  await choose("section", "2");
  await page.getByTestId("profile-save").click();
  await page.waitForURL((u) => u.pathname === "/add-project");
  await step("details-1").waitFor();
  await fillProjectAndSubmit(P1, { extraSupervisors: [SUP2, `مؤقت ${RUN}`], removeExtra: 1, expectSupervisors: [SUP1, SUP2] });
});

let p1;
await check("published at once (no approval); supervisors stored in order and kept private", async () => {
  p1 = await projectId(P1.title);
  const [row] = await sql`select status, supervisors, supervisor, requested_amount::float8 as amount from projects where id = ${p1}`;
  assert(row.status === "published", `status ${row.status}`);
  assert(JSON.stringify(row.supervisors) === JSON.stringify([SUP1, SUP2]) && row.supervisor === null, JSON.stringify(row));
  assert(row.amount === 500, "amount");
  const [profile] = await sql`select full_name, national_id, phone, email, grade, section from student_profiles where student_id = (select id from students where name_en = ${OWNER})`;
  assert(profile && profile.national_id === PROFILE.nationalId && profile.phone === PROFILE.phone && profile.email === PROFILE.email && profile.grade === 11 && profile.section === 2, JSON.stringify(profile));
  const res = await page.goto(BASE + `/projects/${(await sql`select slug from projects where id = ${p1}`)[0].slug}`);
  assert(res.status() === 200, "public page");
  // As before this feature, a supervisor entered by the student stays private.
  const html = await page.content();
  assert(!html.includes(SUP1) && !html.includes(SUP2), "supervisor shown on the public page");
});

await check("second project: straight to the form, no personal questions (the saved profile is used)", async () => {
  await page.goto(BASE + "/add-project");
  await step("details-1").waitFor();
  assert((await page.locator("#nationalId").count()) === 0, "personal details asked again");
  assert((await page.getByTestId("profile-notice").innerText()).includes(PROFILE.name), "profile linked");
  await fillProjectAndSubmit(P2);
});

const p2 = await projectId(P2.title);

await check("another device (new session): the same profile; a correction made there is saved for later projects", async () => {
  const { context, page: other } = await newPage("ar", { width: 390, height: 844 });
  await studentLogin(other, BASE, ownerCode);
  await other.goto(BASE + "/profile");
  await other.locator('[data-testid="profile-status"][data-complete="true"]').waitFor();
  assert((await other.locator("#nationalId").inputValue()) === PROFILE.nationalId, "same profile on the other device");
  const newPhone = "05" + String(Math.floor(10000000 + Math.random() * 89999999));
  await other.locator("#phone").fill(newPhone);
  await other.getByTestId("profile-save").click();
  await until(async () => (await sql`select phone from student_profiles where student_id = (select id from students where name_en = ${OWNER})`)[0]?.phone === newPhone, "profile updated");
  await other.goto(BASE + "/add-project");
  await other.locator('[data-step="details-1"]').waitFor();
  PROFILE.phone = newPhone;
  await context.close();
});

await check("another student never sees these private details or projects", async () => {
  const { context, page: other } = await newPage();
  await studentLogin(other, BASE, otherCode);
  await other.goto(BASE + "/profile");
  await other.getByTestId("profile-form").waitFor();
  for (const id of ["nationalId", "phone", "email"]) assert((await other.locator(`#${id}`).inputValue()) !== PROFILE[id], `${id} leaked`);
  await other.goto(BASE + "/my-projects");
  await other.getByTestId("my-projects-empty").waitFor();
  assert(!(await other.content()).includes(P1.title), "project listed for another student");
  const res = await other.goto(BASE + `/my-projects/${p1}/edit`);
  assert(res.status() === 404, `edit page status ${res.status()}`);
  await context.close();
});

// ---------------------------------------------------------------------------
// My Projects: list, totals, search, filters, sort
// ---------------------------------------------------------------------------

await check("My Projects lists exactly the student's two projects with real totals", async () => {
  await page.goto(BASE + "/my-projects");
  await page.getByTestId("my-projects-list").waitFor();
  assert((await page.getByTestId("my-project-card").count()) === 2, "two cards");
  const stat = async (id) => (await page.getByTestId(id).locator("[data-value]").innerText()).trim();
  assert((await stat("stat-projects")) === "2", "projects");
  assert((await stat("stat-remaining")) === "1,500", `remaining ${await stat("stat-remaining")}`);
  assert((await stat("stat-supervisors")) === "2", `supervisors ${await stat("stat-supervisors")}`);
  assert((await stat("stat-last-update")) === "اليوم", "last update today");
  const c1 = (await card(p1).innerText()).replace(/\s+/g, " ");
  for (const s of [P1.title, SUP1, SUP2, "الذكاء الاصطناعي", "500", "مكتمل", "إضافة رصيد", "تعديل المشروع", "عرض التفاصيل"]) assert(c1.includes(s), `card missing ${s}`);
  assert(!/بانتظار الموافقة|مرفوض|تمت الموافقة|قيد المراجعة/.test(await page.locator("main").innerText()), "approval wording");
  await shot(page, "my-projects-two");
});

await check("search, field and type filters, and sorting work", async () => {
  const titles = async () => page.locator('[data-testid="my-project-card"] [data-testid="card-title"]').allInnerTexts();
  await page.locator("#my-search").fill("الأمن");
  await until(async () => (await titles()).length === 1 && (await titles())[0] === P2.title, "search");
  await page.locator("#my-search").fill("لا يوجد هذا الاسم");
  await page.getByTestId("my-projects-empty").waitFor();
  await page.locator("#my-search").fill("");
  await page.locator("#my-field").selectOption("ai");
  await until(async () => (await titles()).join() === P1.title, "field filter");
  await page.locator("#my-field").selectOption("");
  await page.locator("#my-type").selectOption("group");
  await until(async () => (await titles()).join() === P2.title, "type filter");
  await page.locator("#my-type").selectOption("");
  await page.locator("#my-sort").selectOption("created_asc");
  await until(async () => (await titles())[0] === P1.title, "oldest first");
  await page.locator("#my-sort").selectOption("created_desc");
  await until(async () => (await titles())[0] === P2.title, "newest first");
  await page.locator("#my-sort").selectOption("updated_desc");
});

// ---------------------------------------------------------------------------
// Add funds
// ---------------------------------------------------------------------------

let captured = null;
const dialog = () => page.getByTestId("funds-dialog");
async function addFunds(amount, { dbl = false } = {}) {
  await page.getByTestId("support-amount").fill(amount);
  if (dbl) await page.getByTestId("support-confirm").dblclick();
  else await page.getByTestId("support-confirm").click();
}
const entries = async (id) => sql`select amount::float8 as amount, reversed_at, client_token from project_support_entries where project_id = ${id} order by created_at`;

await check("Add Funds: invalid, zero, negative and over-target amounts are refused", async () => {
  await card(p1).getByTestId("action-add-funds").click();
  await dialog().waitFor();
  assert((await page.getByTestId("funds-requested").innerText()).includes("500"), "requested");
  assert((await page.getByTestId("funds-recorded").innerText()).includes("0"), "recorded 0");
  for (const bad of ["0", "-5", "abc", "1.234"]) {
    await addFunds(bad);
    await page.getByTestId("support-error").waitFor();
  }
  await addFunds("600");
  assert((await page.getByTestId("support-error").innerText()).includes("المتبقي"), "over target");
  assert((await entries(p1)).length === 0, "nothing stored");
});

await check("30 SAR on a 500 SAR target: 470 remaining, 6% — the bar grows", async () => {
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"] && (r.postData() ?? "").includes('"token"') && !captured) {
      captured = { url: r.url(), headers: r.headers(), body: r.postData() };
    }
  });
  await addFunds("30");
  await until(async () => (await page.getByTestId("funds-remaining").innerText()).includes("470"), "dialog remaining 470");
  await page.keyboard.press("Escape");
  await until(async () => (await card(p1).getByTestId("card-remaining").innerText()).includes("470"), "card remaining 470");
  assert((await card(p1).getByTestId("funding-bar").getAttribute("data-percent")) === "6", "6%");
  assert((await card(p1).getByTestId("card-raised").innerText()).includes("30"), "raised 30");
});

await check("another 70 SAR (double click): 100 recorded, 400 remaining, 20%; stored once", async () => {
  await card(p1).getByTestId("action-add-funds").click();
  await dialog().waitFor();
  await until(async () => (await page.getByTestId("funds-recorded").innerText()).includes("30"), "fresh totals");
  await addFunds("70", { dbl: true });
  await until(async () => (await page.getByTestId("funds-remaining").innerText()).includes("400"), "remaining 400");
  await page.waitForTimeout(800);
  const list = await entries(p1);
  assert(list.length === 2 && list.reduce((s, e) => s + e.amount, 0) === 100, `entries ${JSON.stringify(list.map((e) => e.amount))}`);
  await page.keyboard.press("Escape");
  await until(async () => (await card(p1).getByTestId("funding-bar").getAttribute("data-percent")) === "20", "20%");
});

/** Replays the captured Add Funds request (a real server action call) with other values. */
async function replay(onPage, { projectId: id, amount, token }) {
  const args = JSON.parse(captured.body);
  args[0] = { ...args[0], projectId: id, amount, token };
  return onPage.evaluate(
    async ({ url, headers, body }) => {
      const res = await fetch(url, { method: "POST", headers: { accept: headers.accept, "next-action": headers["next-action"], "content-type": headers["content-type"], "next-router-state-tree": headers["next-router-state-tree"] ?? "" }, body });
      return { status: res.status, text: await res.text() };
    },
    { url: captured.url, headers: captured.headers, body: JSON.stringify(args) },
  );
}

await check("concurrent submissions never exceed the target (totals computed under a lock)", async () => {
  assert(captured, "action request captured");
  const [a, b] = await Promise.all([
    replay(page, { projectId: p1, amount: "300", token: randomUUID() }),
    replay(page, { projectId: p1, amount: "300", token: randomUUID() }),
  ]);
  assert(a.status === 200 && b.status === 200, `status ${a.status}/${b.status}`);
  const list = (await entries(p1)).filter((e) => !e.reversed_at);
  const total = list.reduce((s, e) => s + e.amount, 0);
  assert(total === 400 && list.length === 3, `total ${total} after two concurrent 300s`);
});

await check("a student can not record support on another student's project", async () => {
  const { context, page: other } = await newPage();
  await studentLogin(other, BASE, otherCode);
  await other.goto(BASE + "/my-projects");
  const token = randomUUID();
  const res = await replay(other, { projectId: p1, amount: "10", token });
  assert(res.text.includes("not_found"), "refused");
  assert((await sql`select 1 from project_support_entries where client_token = ${token}`).length === 0, "stored for another student");
  await context.close();
});

await check("a mistaken entry is reversed with an audit trail (not deleted)", async () => {
  await page.reload();
  await card(p1).getByTestId("action-add-funds").click();
  await dialog().waitFor();
  await page.getByTestId("support-history").waitFor();
  await page.getByTestId("support-reverse").first().click();
  await page.getByTestId("reverse-dialog").locator("input").fill("أُدخل بالخطأ");
  await page.getByTestId("reverse-confirm").click();
  await until(async () => (await page.getByTestId("funds-recorded").innerText()).includes("100"), "back to 100");
  const all = await entries(p1);
  assert(all.length === 3 && all.filter((e) => e.reversed_at).length === 1, "entry kept, marked reversed");
  assert((await page.locator('[data-reversed="true"]').count()) === 1, "history shows the reversal");
  await shot(page, "funds-dialog", false);
  await page.keyboard.press("Escape");
});

await check("funding persists across sessions; summary, donut and activity use real data", async () => {
  await ownerContext.close();
  ({ context: ownerContext, page } = await newPage());
  await studentLogin(page, BASE, ownerCode);
  await page.goto(BASE + "/my-projects");
  await until(async () => (await card(p1).getByTestId("card-remaining").innerText()).includes("400"), "remaining 400 after sign-in");
  assert((await page.getByTestId("summary-target").locator("[data-value]").getAttribute("data-value")) === "1500", "target 1500");
  assert((await page.getByTestId("summary-raised").locator("[data-value]").getAttribute("data-value")) === "100", "raised 100");
  assert((await page.getByTestId("summary-remaining").locator("[data-value]").getAttribute("data-value")) === "1400", "remaining 1400");
  assert((await page.getByTestId("summary-center").innerText()) === "100", "center 100");
  const kinds = await page.locator('[data-testid="activity-list"] li').evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  assert(kinds.includes("support_added") && kinds.includes("support_reversed"), kinds.join());
  await shot(page, "my-projects-desktop", false);
});

await check("Explore Projects and the project page show the same figures (0 for no support)", async () => {
  await page.goto(BASE + `/projects?q=${encodeURIComponent(`QA MyProj ${RUN}`)}`);
  const c1 = page.locator('[data-testid="explore-card"]').filter({ hasText: P1.title });
  await c1.waitFor();
  assert((await c1.getByTestId("card-amount").innerText()).includes("500"), "requested");
  assert((await c1.getByTestId("card-raised").innerText()).includes("100"), "raised");
  assert((await c1.getByTestId("card-remaining").innerText()).includes("400"), "remaining");
  assert((await c1.getByTestId("card-funding").getAttribute("data-percent")) === "20", "20%");
  const c2 = page.locator('[data-testid="explore-card"]').filter({ hasText: P2.title });
  assert((await c2.getByTestId("card-raised").innerText()).includes("0") && (await c2.getByTestId("card-funding").getAttribute("data-percent")) === "0", "0% for no support");
  const html = await page.content();
  assert(!html.includes("أُدخل بالخطأ") && !html.includes(PROFILE.nationalId), "private details on a public page");
  await shot(page, "explore-funding", false);
});

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

await check("Edit opens the form pre-filled (supervisors, amount, cover) and can't go below recorded support", async () => {
  await page.goto(BASE + "/my-projects");
  await card(p1).getByTestId("action-edit").click();
  await page.waitForURL((u) => u.pathname === `/my-projects/${p1}/edit`);
  await step("details-1").waitFor();
  assert((await page.locator("#nationalId").count()) === 0, "no personal questions when editing");
  assert((await page.locator("#title").inputValue()) === P1.title, "title");
  await page.locator("#title").fill(`${P1.title} المطور`);
  for (const id of ["details-2", "details-3", "classification-1", "classification-2"]) await next(id);
  assert((await page.locator("#requestedAmount").inputValue()) === "500", "requested amount");
  await page.locator("#requestedAmount").fill("50");
  await next("attachments-1");
  assert((await page.locator("#supervisor").inputValue()) === SUP1, "first supervisor");
  assert((await page.locator('[data-testid="extra-supervisor"] input').inputValue()) === SUP2, "second supervisor");
  await page.getByTestId("add-supervisor").click();
  await page.locator('[data-testid="extra-supervisor"] input').last().fill(`أ. خالد ${RUN}`);
  assert((await page.locator("main").innerText()).includes("تغيير الصورة"), "saved cover shown");
  await page.getByTestId("cover-input").setInputFiles({ name: `cover2-${RUN}.png`, mimeType: "image/png", buffer: coverPng });
  await until(async () => (await page.locator("main").innerText()).includes("تغيير الصورة") && !(await page.locator("main").innerText()).includes("جارٍ"), "new cover", 60000);
  await next("attachments-2");
  await next("attachments-3");
  await page.locator('label[for="acknowledged"]').click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
  await page.getByTestId("wizard-submit").click();
  await until(async () => (await page.getByTestId("form-error").innerText().catch(() => "")).includes("لا يمكن أن يقل المبلغ المطلوب"), "below recorded refused");
  await page.locator("#requestedAmount").fill("800");
  for (const id of ["attachments-1", "attachments-2", "attachments-3"]) await next(id);
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("edit-success").waitFor({ timeout: 30000 });
});

await check("edits are saved in place: same project, support history intact, new figures everywhere", async () => {
  const [row] = await sql`select id, title, requested_amount::float8 as amount, supervisors, cover_media_id from projects where id = ${p1}`;
  assert(row.title === `${P1.title} المطور` && row.amount === 800, JSON.stringify(row));
  assert(row.supervisors.length === 3 && row.supervisors[2] === `أ. خالد ${RUN}`, "three supervisors");
  const count = await sql`select count(*)::int as n from projects where title like ${`QA MyProj ${RUN}%`}`;
  assert(count[0].n === 2, "no duplicate project");
  assert((await entries(p1)).length === 3, "support entries kept");
  assert((await sql`select count(*)::int as n from project_media where project_id = ${p1}`)[0].n === 1, "old cover replaced, not piled up");
  await page.goto(BASE + "/my-projects");
  await until(async () => (await card(p1).getByTestId("card-remaining").innerText()).includes("700"), "remaining 700");
  assert((await card(p1).getByTestId("funding-bar").getAttribute("data-percent")) === "12.5", "12.5%");
  const kinds = await page.locator('[data-testid="activity-list"] li').evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  assert(kinds.includes("edited") && kinds.includes("cover_changed"), kinds.join());
  const slug = (await sql`select slug from projects where id = ${p1}`)[0].slug;
  await page.goto(BASE + `/projects/${slug}`);
  await page.getByRole("heading", { level: 1, name: `${P1.title} المطور` }).waitFor();
  assert((await page.getByTestId("detail-funding-remaining").innerText()).includes("700"), "public page remaining 700");
});

await check("a single-supervisor project edits without extra inputs (legacy compatible)", async () => {
  await page.goto(BASE + `/my-projects/${p2}/edit`);
  await step("details-1").waitFor();
  for (const id of ["details-2", "details-3", "classification-1", "classification-2", "attachments-1"]) await next(id);
  assert((await page.locator("#supervisor").inputValue()) === SUP1, "supervisor");
  assert((await page.getByTestId("extra-supervisor").count()) === 0, "no extra inputs");
  await page.getByTestId("wizard-cancel").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "تجاهل التعديلات" }).click();
  await page.waitForURL((u) => u.pathname === "/my-projects");
});

// ---------------------------------------------------------------------------
// Admin, unauthenticated access, language, mobile
// ---------------------------------------------------------------------------

await check("admin sees the manual support entries and all supervisors; admin delete still works", async () => {
  const { context, page: admin } = await newPage("en");
  await adminLogin(admin, BASE, ADMIN);
  await admin.goto(BASE + `/admin/projects/${p1}/edit`);
  const table = admin.getByTestId("admin-support-entries");
  await table.waitFor();
  assert((await table.locator("tbody tr").count()) === 3 && (await table.locator('[data-reversed="true"]').count()) === 1, "three entries, one reversed");
  assert((await admin.locator("main").innerText()).includes("Amounts entered manually by the student"), "marked as manual");
  assert((await admin.locator("main").innerText()).includes(`أ. خالد ${RUN}`), "supervisors in the submission");
  // Move project 2 to the trash with the existing admin action.
  await admin.goto(BASE + `/admin/projects?q=${encodeURIComponent(`QA MyProj ${RUN}`)}`);
  const row = admin.getByTestId("admin-project-row").filter({ hasText: P2.title });
  await row.getByRole("button", { name: /More actions/ }).click();
  await admin.getByRole("menuitem", { name: "Move to Trash" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Move to Trash" }).click();
  await until(async () => (await sql`select deleted_at from projects where id = ${p2}`)[0].deleted_at !== null, "trashed");
  await context.close();
  await page.goto(BASE + "/my-projects");
  await until(async () => (await page.getByTestId("my-project-card").count()) === 1, "deleted project gone");
  assert((await page.getByTestId("summary-target").locator("[data-value]").getAttribute("data-value")) === "800", "totals follow the deletion");
});

await check("signed-out visitors can't open My Projects or edit pages", async () => {
  const { context, page: anon } = await newPage();
  await anon.goto(BASE + "/my-projects");
  assert(new URL(anon.url()).pathname === "/welcome", anon.url());
  await anon.goto(BASE + `/my-projects/${p1}/edit`);
  assert(new URL(anon.url()).pathname === "/welcome", anon.url());
  await context.close();
});

await check("English: labels translated, layout left-to-right", async () => {
  await page.goto(BASE + "/my-projects");
  await page.locator('[role="group"] button').filter({ hasText: "EN" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("main h1")?.textContent?.includes("My Projects"), null, { timeout: 10000 });
  const text = await page.locator("main").innerText();
  for (const s of ["Add New Project", "Add Funds", "Edit Project", "View Details", "Funding Summary", "Recent Activity", "Important Notifications", "Total Projects"]) assert(text.includes(s), `missing ${s}`);
  assert((await page.evaluate(() => document.documentElement.dir)) === "ltr", "ltr");
  await shot(page, "my-projects-en", false);
  await page.locator('[role="group"] button').filter({ hasText: "العربية" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "ar", null, { timeout: 10000 });
});

for (const [name, viewport] of [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 820, height: 1180 }],
]) {
  await check(`${name}: My Projects and the edit form fit the screen; menu reaches مشاريعي`, async () => {
    const { context, page: p } = await newPage("ar", viewport);
    await studentLogin(p, BASE, ownerCode);
    await p.goto(BASE + "/my-projects");
    await p.getByTestId("my-project-card").first().waitFor();
    assert(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), "no sideways scrolling");
    await shot(p, `my-projects-${name}`);
    await p.goto(BASE + `/my-projects/${p1}/edit`);
    await p.locator('[data-step="details-1"]').waitFor();
    assert(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), "edit form fits");
    if (viewport.width < 768) {
      await p.goto(BASE + "/home");
      await p.getByRole("button", { name: "فتح القائمة" }).click();
      await p.getByTestId("mobile-my-projects").click();
      await p.waitForURL((u) => u.pathname === "/my-projects");
    }
    await context.close();
  });
}

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
