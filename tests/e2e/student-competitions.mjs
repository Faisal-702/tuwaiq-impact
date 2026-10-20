/**
 * Competitions, Manage Projects and the students-only Explore Projects page.
 *
 *   BASE_URL=http://localhost:3000 DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/student-competitions.mjs
 *
 * End to end, through the real pages and database:
 *  - two students submit projects with the form; one picks SAIF, the other
 *    "Other" with their own competition name; a third keeps a draft only;
 *  - the administrator's Manage Projects lists exactly the submitted
 *    projects (student name + Preview Project), and the read-only preview
 *    shows the project, its competition and no identity/contact details;
 *  - administrators search Manage Projects by student name (seeded students
 *    and 2,000 seeded projects);
 *  - signed-in students filter Explore Projects by competition, together
 *    with search and category; visitors and administrators can not open
 *    Explore Projects, project pages or project search.
 * Values carry this run's marker; everything the run created is removed at the end.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, completeProfile, ensureStudentCode, randomClientIp, studentLogin, validNationalId } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const S1 = "Demo Student E"; // SAIF
const S2 = "Demo Student F"; // Other: own competition name
const S3 = "Demo Student G"; // draft only, then browses Explore Projects

const RUN = `R${Date.now().toString(36).toUpperCase()}`;
const results = [];
const errors = [];
let current = null;
const check = async (name, fn) => {
  try {
    await fn();
    results.push(true);
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push(false);
    console.log(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n")[0]}`);
    if (process.env.QA_SHOTS && current) await current.screenshot({ path: `${process.env.QA_SHOTS}/fail-${results.length}.png`, fullPage: true }).catch(() => {});
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
const shot = async (p, name, fullPage = false) => {
  if (process.env.QA_SHOTS) await p.screenshot({ path: `${process.env.QA_SHOTS}/${name}.png`, fullPage, caret: "initial" }).catch(() => {});
};

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is required (the run checks stored rows and removes what it created).");
  process.exit(1);
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

const P1 = {
  title: `مشروع درون ذكي ${RUN}`,
  field: "ai",
  competition: "saif",
  summary: `نظام درون ذكي لرصد المحاصيل ${RUN}`,
  problem: `مشكلة متابعة المزارع ${RUN}`,
  tools: `درون وكاميرا ${RUN}`,
  supervisor: `أ. محمد ${RUN}`,
};
const CUSTOM = `بطولة الابتكار الطلابي ${RUN}`;
const P2 = {
  title: `تطبيق مساعد المذاكرة ${RUN}`,
  field: "web-mobile",
  competition: "other",
  competitionOther: CUSTOM,
  summary: `تطبيق جوال ينظم وقت المذاكرة ${RUN}`,
  problem: `تنظيم الوقت ${RUN}`,
  tools: `حاسب وبرمجيات ${RUN}`,
  supervisor: `أ. سارة ${RUN}`,
};
const DRAFT_TITLE = `مسودة لم ترسل ${RUN}`;
const IDS = {};
for (const s of [S1, S2, S3]) IDS[s] = { nationalId: validNationalId(), phone: "05" + String(Math.floor(10000000 + Math.random() * 89999999)), email: `qa.${s.slice(-1).toLowerCase()}.${RUN.toLowerCase()}@example.com` };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
async function newContext(lang = "ar", viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  return context;
}
const watch = (page) => {
  current = page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to fetch|ERR_ABORTED|net::ERR/.test(m.text())) return;
    errors.push(m.text());
  });
};

// A cover image rendered by the browser.
const art = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await art.setContent(`<div style="width:1200px;height:750px;background:linear-gradient(135deg,#5b3df5,#14b8a6);display:grid;place-items:center;font:700 60px sans-serif;color:#fff">${RUN}</div>`);
const coverPng = await art.screenshot({ type: "png" });
await art.close();

const codes = {};
for (const s of [S1, S2, S3]) codes[s] = await ensureStudentCode(browser, { base: BASE, admin: ADMIN, student: s });
// Clean slate for these students (drafts and profiles of earlier runs).
await sql`delete from project_submissions where status in ('draft', 'editing') and student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
await sql`delete from student_profiles where student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
const [{ before }] = await sql`select count(*)::int as before from projects`;
const studentName = async (s) => {
  const [row] = await sql`select coalesce(nullif(name_ar, ''), name_en) as ar, coalesce(nullif(name_en, ''), name_ar) as en from students where name_en = ${s}`;
  return row;
};

async function signIn(s, lang = "ar") {
  const context = await newContext(lang);
  const page = await context.newPage();
  watch(page);
  await studentLogin(page, BASE, codes[s]);
  await completeProfile(page, BASE, { fullName: `طالب ${s.slice(-1)} ${RUN}`, ...IDS[s], grade: "11", section: "2" });
  return { context, page };
}

const step = (page, id) => page.locator(`[data-step="${id}"]`);
const next = async (page, to) => {
  await page.getByTestId("wizard-next").click();
  if (to) await step(page, to).waitFor();
};
const choose = (page, name, value) => page.locator(`label:has(input[name="${name}"][value="${value}"])`).click();

/** Fills the first two steps of the form. */
async function startForm(page, p) {
  await page.goto(BASE + "/add-project");
  await step(page, "details-1").waitFor();
  await choose(page, "projectType", "individual");
  await page.locator("#title").fill(p.title);
  await page.locator("#description").fill(`وصف ${p.title}`);
  await next(page, "details-2");
  await page.locator("#goals").fill(`أهداف ${RUN}`);
  await page.locator("#idea").fill(`فكرة ${RUN}`);
  await next(page, "details-3");
  await choose(page, "competition", "no");
  await page.locator("#summary").fill(p.summary);
  await next(page, "classification-1");
}

/** Completes the form from the classification step and submits it. */
async function finishForm(page, p) {
  await page.locator("#problem").fill(p.problem);
  await page.locator("#tools").fill(p.tools);
  await next(page, "classification-2");
  await page.locator("#toolsCost").fill("800");
  await page.locator("#requestedAmount").fill("1500");
  await next(page, "attachments-1");
  await choose(page, "projectStatus", "incomplete");
  await page.locator("#supervisor").fill(p.supervisor);
  await page.getByTestId("cover-input").setInputFiles({ name: `cover-${RUN}.png`, mimeType: "image/png", buffer: coverPng });
  await page.getByTestId("cover-change").or(page.getByRole("button", { name: "تغيير الصورة" })).first().waitFor({ timeout: 60000 });
  await next(page, "attachments-2");
  await next(page, "attachments-3");
  await page.locator('label[for="acknowledged"]').click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("review").waitFor();
}

// ---------------------------------------------------------------------------
// Student 1: the competition field, validation, drafts and SAIF
// ---------------------------------------------------------------------------

const s1 = await signIn(S1);
let page = s1.page;

await check("form: the competition dropdown sits right under «مجال المشروع», before the problem question", async () => {
  await startForm(page, P1);
  const fields = await step(page, "classification-1").locator("[data-field]").evaluateAll((els) => els.map((e) => e.getAttribute("data-field")));
  assert(JSON.stringify(fields) === JSON.stringify(["field", "targetCompetition", "problem", "tools"]), `order ${fields}`);
  const label = await page.locator('[data-field="targetCompetition"] label').first().innerText();
  assert(label.includes("المسابقة التي ترغب بالمشاركة فيها"), `label ${label}`);
  const options = await page.locator("#targetCompetition option:not([disabled])").evaluateAll((els) => els.map((o) => [o.value, o.textContent.trim()]));
  assert(
    JSON.stringify(options) ===
      JSON.stringify([["saif", "سيف"], ["ibdaa", "إبداع"], ["robotics", "الروبوتات"], ["hackathons", "الهاكاثونات"], ["programming", "مسابقات البرمجة"], ["other", "أخرى"]]),
    `options ${JSON.stringify(options)}`,
  );
  assert((await page.locator("#targetCompetitionOther").count()) === 0, "custom name shown before أخرى");
});

await check("form: the competition is required, with a clear message", async () => {
  await page.locator("#field").selectOption(P1.field);
  await page.locator("#problem").fill(P1.problem);
  await page.locator("#tools").fill(P1.tools);
  await page.getByTestId("wizard-next").click();
  await page.locator("#targetCompetition-error").waitFor();
  assert((await page.locator("#targetCompetition-error").innerText()).includes("اختر المسابقة"), "message");
  assert(await step(page, "classification-1").isVisible(), "stayed on the step");
});

await check("form: «سيف» survives Save as draft, a reload, Previous and Next", async () => {
  await page.locator("#targetCompetition").selectOption("saif");
  assert((await page.locator("#targetCompetition-error").count()) === 0, "error cleared");
  await shot(page, "C-competition-dropdown");
  await page.getByTestId("wizard-save").click();
  await until(async () => /حُفظت المسودة/.test(await page.getByTestId("save-status").innerText()), "saved");
  const [d] = await sql`select answers from project_submissions ps join students s on s.id = ps.student_id where s.name_en = ${S1} and ps.status = 'draft'`;
  assert(d?.answers.targetCompetition === "saif", `stored draft ${d?.answers.targetCompetition}`);
  await page.reload();
  await page.getByTestId("draft-restored").waitFor();
  for (const id of ["details-2", "details-3", "classification-1"]) await next(page, id);
  assert((await page.locator("#targetCompetition").inputValue()) === "saif", "restored after reload");
  await next(page, "classification-2");
  await page.getByTestId("wizard-previous").click();
  await step(page, "classification-1").waitFor();
  assert((await page.locator("#targetCompetition").inputValue()) === "saif", "kept on Previous");
});

await check("form: «أخرى» reveals a required name field; the name persists; switching back drops it", async () => {
  await page.locator("#targetCompetition").selectOption("other");
  await page.locator("#targetCompetitionOther").waitFor();
  const label = await page.locator('[data-field="targetCompetitionOther"] label').first().innerText();
  assert(label.includes("اكتب اسم المسابقة أو المشاركة"), `label ${label}`);
  assert((await page.locator("#targetCompetitionOther").getAttribute("placeholder")).includes("بطولة الابتكار الطلابي"), "placeholder");
  await page.getByTestId("wizard-next").click();
  await page.locator("#targetCompetitionOther-error").waitFor();
  assert((await page.locator("#targetCompetitionOther-error").innerText()).includes("اكتب اسم المسابقة"), "custom name message");
  await page.locator("#targetCompetitionOther").fill(`  مسابقة مؤقتة ${RUN}  `);
  await shot(page, "D-competition-other");
  await next(page, "classification-2");
  await page.getByTestId("wizard-previous").click();
  await step(page, "classification-1").waitFor();
  assert((await page.locator("#targetCompetitionOther").inputValue()).includes(`مسابقة مؤقتة ${RUN}`), "custom name kept");
  await page.locator("#targetCompetition").selectOption("saif");
  assert((await page.locator("#targetCompetitionOther").count()) === 0, "custom field hidden");
  await page.locator("#targetCompetition").selectOption("other");
  assert((await page.locator("#targetCompetitionOther").inputValue()) === "", "stale custom name cleared");
  await page.locator("#targetCompetition").selectOption("saif");
});

await check("submit: the project is stored with competition «saif» and linked to the student", async () => {
  await finishForm(page, P1);
  assert((await page.getByTestId("review").innerText()).includes("سيف"), "review shows the competition");
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("submit-success").waitFor({ timeout: 30000 });
  const [p] = await sql`select p.competition, p.competition_other, p.status, ps.answers, st.name_en
                          from projects p join project_submissions ps on ps.project_id = p.id and ps.status = 'submitted'
                          join students st on st.id = ps.student_id where p.title = ${P1.title}`;
  assert(p, "project row");
  assert(p.competition === "saif" && p.competition_other === null, `competition ${p.competition}/${p.competition_other}`);
  assert(p.answers.targetCompetition === "saif" && p.answers.targetCompetitionOther === "", "questionnaire");
  assert(p.name_en === S1 && p.status === "published", "linked to the signed-in student and published");
});
await s1.context.close();

// ---------------------------------------------------------------------------
// Student 2: Other with the student's own competition name
// ---------------------------------------------------------------------------

await check("submit: «أخرى» stores the trimmed custom competition name", async () => {
  const s2 = await signIn(S2);
  page = s2.page;
  await startForm(page, P2);
  await page.locator("#field").selectOption(P2.field);
  await page.locator("#targetCompetition").selectOption("other");
  await page.locator("#targetCompetitionOther").fill(`   ${CUSTOM}   `);
  await finishForm(page, P2);
  assert((await page.getByTestId("review").innerText()).includes(CUSTOM), "review shows the custom name");
  await page.getByTestId("wizard-submit").click();
  await page.getByTestId("submit-success").waitFor({ timeout: 30000 });
  const [p] = await sql`select competition, competition_other from projects where title = ${P2.title}`;
  assert(p?.competition === "other" && p.competition_other === CUSTOM, `stored ${p?.competition}/${p?.competition_other}`);
  await s2.context.close();
});

// ---------------------------------------------------------------------------
// Student 3: a draft only (must never be listed or explored)
// ---------------------------------------------------------------------------

const s3 = await signIn(S3);
await check("a draft is saved for student 3 (not submitted)", async () => {
  page = s3.page;
  await page.goto(BASE + "/add-project");
  await step(page, "details-1").waitFor();
  await page.locator("#title").fill(DRAFT_TITLE);
  await page.getByTestId("wizard-save").click();
  await until(async () => /حُفظت المسودة/.test(await page.getByTestId("save-status").innerText()), "saved");
});

await check("database: a draft can not become submitted without a valid competition", async () => {
  const [d] = await sql`select ps.id from project_submissions ps join students s on s.id = ps.student_id where s.name_en = ${S3} and ps.status = 'draft'`;
  for (const answers of [{ title: "x" }, { targetCompetition: "aisf" }, { targetCompetition: "other", targetCompetitionOther: "  " }]) {
    let hint = null;
    try {
      await sql.begin(async (tx) => {
        await tx`update project_submissions set status = 'submitted', submitted_at = now(), answers = ${tx.json(answers)} where id = ${d.id}`;
        throw new Error("rollback");
      });
    } catch (e) {
      hint = e.hint ?? e.message;
    }
    assert(hint === "competition_required", `answers ${JSON.stringify(answers)} → ${hint}`);
  }
  const [{ n }] = await sql`select count(*)::int as n from project_submissions where id = ${d.id} and status = 'draft'`;
  assert(n === 1, "draft unchanged");
});

// ---------------------------------------------------------------------------
// Administrator: Manage Projects and the read-only preview
// ---------------------------------------------------------------------------

const adminContext = await newContext("ar");
const ap = await adminContext.newPage();
watch(ap);
await adminLogin(ap, BASE, ADMIN);
const n1 = await studentName(S1);
const n2 = await studentName(S2);

await check("admin: Manage Projects has no Add Project button, old filters, tabs or old columns; sidebar has no Add Project", async () => {
  await ap.goto(BASE + "/admin/projects");
  await ap.getByRole("heading", { name: "إدارة المشاريع", level: 1 }).waitFor();
  const main = await ap.locator("main").innerText();
  for (const gone of ["إضافة مشروع", "البحث في المشاريع", "المسودات", "المنشورة", "المميزة", "التصنيف", "النقاط", "المشاهدات", "آخر تحديث"]) {
    assert(!main.includes(gone), `still shows «${gone}»`);
  }
  // The only search is the student-name search (checked below), not the old project filters.
  assert((await ap.locator('main input[type="search"], main select').count()) === 1, "old search or filters");
  const sidebar = ap.locator("aside").first();
  assert((await sidebar.locator('a[href="/admin/projects/new"]').count()) === 0, "sidebar Add Project");
  assert((await sidebar.getByRole("link", { name: "إدارة المشاريع" }).count()) === 1, "sidebar Manage Projects");
  assert((await ap.locator('a[href="/admin/projects/new"]').count()) === 0, "any link to admin creation");
  await shot(ap, "A-admin-projects");
});

await check("admin: exactly two columns — student name and Preview Project — one row per submitted project", async () => {
  const heads = await ap.locator('[data-testid="admin-submissions"] thead th').allInnerTexts();
  assert(JSON.stringify(heads.map((h) => h.trim())) === JSON.stringify(["اسم الطالب", "معاينة المشروع"]), `headers ${heads}`);
  const cells = await ap.locator('[data-testid="admin-submission-row"]').first().locator("td").count();
  assert(cells === 2, `cells ${cells}`);
  const rows = await ap.locator('[data-testid="admin-submission-row"]').evaluateAll((els) =>
    els.map((r) => ({ id: r.getAttribute("data-submission"), name: r.querySelector('[data-testid="submission-student"]').textContent.trim(), button: r.querySelector('[data-testid="submission-preview"]')?.textContent.trim() })),
  );
  const submitted = await sql`select ps.id, st.name_en, ps.answers->>'title' as title from project_submissions ps join students st on st.id = ps.student_id where ps.status = 'submitted'`;
  assert(rows.length === submitted.length, `rows ${rows.length} vs submitted ${submitted.length}`);
  for (const r of rows) assert(r.button === "معاينة المشروع", "preview button label");
  const mine = submitted.filter((s) => s.title === P1.title || s.title === P2.title);
  assert(mine.length === 2, "both submissions stored");
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.name]));
  assert(byId[mine.find((s) => s.title === P1.title).id] === n1.ar, `student 1 name ${byId[mine.find((s) => s.title === P1.title).id]}`);
  assert(byId[mine.find((s) => s.title === P2.title).id] === n2.ar, "student 2 name");
  assert(!(await ap.locator("main").innerText()).includes(DRAFT_TITLE), "draft listed");
});

await check("admin: the old Add Project address leads back to Manage Projects", async () => {
  await ap.goto(BASE + "/admin/projects/new");
  await ap.waitForURL((u) => u.pathname === "/admin/projects");
});

await check("admin: Preview Project shows the student's real submission, read only, without identity details", async () => {
  await ap.goto(BASE + "/admin/projects");
  const [sub] = await sql`select ps.id from project_submissions ps join projects p on p.id = ps.project_id where p.title = ${P2.title} and ps.status = 'submitted'`;
  await ap.locator(`[data-submission="${sub.id}"] [data-testid="submission-preview"]`).click();
  await ap.waitForURL((u) => u.pathname === `/admin/projects/submissions/${sub.id}`);
  const view = ap.getByTestId("submission-preview-view");
  await view.waitFor();
  assert((await ap.getByTestId("preview-title").innerText()).trim() === P2.title, "title");
  assert((await ap.getByTestId("preview-student").innerText()).trim() === n2.ar, "student name");
  assert((await ap.getByTestId("preview-competition").innerText()).includes(CUSTOM), "custom competition");
  const text = await view.innerText();
  for (const v of [P2.summary, P2.problem, P2.tools, P2.supervisor, "تطوير تطبيقات الويب والجوال", "أخرى", CUSTOM, "للعرض فقط"]) assert(text.includes(v), `missing ${v}`);
  assert((await ap.getByTestId("preview-cover").count()) === 1, "cover image");
  const html = await ap.content();
  for (const secret of [IDS[S2].nationalId, IDS[S2].phone, IDS[S2].email]) assert(!html.includes(secret), `exposes ${secret}`);
  // Read only: no form, no input, no edit/delete action.
  assert((await view.locator("form, input, textarea, select, button").count()) === 0, "interactive controls in the preview");
  for (const word of ["تعديل", "حذف", "نشر", "Edit", "Delete"]) assert(!text.includes(word), `action «${word}»`);
  await shot(ap, "B-admin-preview", true);
});

await check("admin: Explore Projects, project pages and project search are not for administrators", async () => {
  await ap.goto(BASE + "/projects");
  await ap.waitForURL((u) => u.pathname === "/admin/projects");
  const [{ slug }] = await sql`select slug from projects where title = ${P1.title}`;
  await ap.goto(BASE + `/projects/${slug}`);
  await ap.waitForURL((u) => u.pathname === "/admin/projects");
  const res = await adminContext.request.get(BASE + `/api/search?q=${encodeURIComponent(RUN)}`);
  assert((await res.json()).projects.length === 0, "search returned projects");
  await ap.goto(BASE + "/home");
  assert((await ap.locator('header a[href="/projects"], footer a[href="/projects"]').count()) === 0, "explore link shown to admin");
});

await check("old records are kept: only the two new projects were added", async () => {
  const [{ after }] = await sql`select count(*)::int as after from projects`;
  assert(after === before + 2, `projects before ${before}, after ${after}`);
});

// ---------------------------------------------------------------------------
// Visitors: no project discovery without a student session
// ---------------------------------------------------------------------------

await check("visitor: Explore Projects, project pages and search are blocked; sign-in returns to the page", async () => {
  const anon = await newContext("ar");
  const vp = await anon.newPage();
  watch(vp);
  const [{ slug }] = await sql`select slug from projects where title = ${P1.title}`;
  for (const url of ["/projects", "/projects?competition=saif", `/projects/${slug}`]) {
    const res = await anon.request.get(BASE + url, { maxRedirects: 0 });
    assert([302, 303, 307, 308].includes(res.status()), `${url} → ${res.status()}`);
    assert(new URL(res.headers().location, BASE).pathname === "/welcome", `${url} → ${res.headers().location}`);
    const body = await (await anon.request.get(BASE + url)).text();
    assert(!body.includes(P1.title) && !body.includes(P1.summary), `${url} leaks the project`);
  }
  const api = await anon.request.get(BASE + `/api/search?q=${encodeURIComponent(RUN)}`);
  assert(api.status() === 401, `search API ${api.status()}`);
  // Signing in from the redirect lands back on the requested view.
  await vp.goto(BASE + "/projects?competition=saif");
  await vp.waitForURL((u) => u.pathname === "/welcome" && u.searchParams.get("next") === "/projects?competition=saif");
  await vp.locator("#student-code").fill(codes[S1]);
  await vp.getByRole("button", { name: "الدخول إلى المنصة" }).click();
  await vp.waitForURL((u) => u.pathname === "/projects" && u.searchParams.get("competition") === "saif", { timeout: 30000 });
  await anon.close();
});

// ---------------------------------------------------------------------------
// Student 3 explores: competition filters with search and category
// ---------------------------------------------------------------------------

page = s3.page;
current = page;
const cards = () => page.locator('[data-testid="explore-card"]').evaluateAll((els) => els.map((e) => ({ title: e.querySelector("h3").textContent.trim(), competition: e.querySelector('[data-testid="card-competition"]')?.getAttribute("data-competition") ?? null, badge: e.querySelector('[data-testid="card-competition"]')?.textContent.trim() ?? null })));
const pickCompetition = async (key) => {
  await page.locator(`[data-testid="competition-filter"] [data-competition="${key}"]`).click();
  await until(async () => (key === "all" ? !page.url().includes("competition=") : page.url().includes(`competition=${key}`)), `url for ${key}`);
  await page.waitForLoadState("networkidle");
  await until(async () => (await page.locator('main [aria-busy="true"]').count()) === 0, "results updated");
};

await check("student: Explore Projects shows the «المسابقة» filter (الكل + 6 competitions) beside the existing filters", async () => {
  await page.goto(BASE + "/projects");
  await page.getByTestId("competition-filter").waitFor();
  const chips = await page.locator('[data-testid="competition-filter"] button').allInnerTexts();
  assert(JSON.stringify(chips.map((c) => c.trim())) === JSON.stringify(["الكل", "سيف", "إبداع", "الروبوتات", "الهاكاثونات", "مسابقات البرمجة", "أخرى"]), `chips ${chips}`);
  assert((await page.getByTestId("competition-filter").innerText()).includes("المسابقة"), "label");
  assert((await page.locator("#project-search").count()) === 1 && (await page.getByRole("button", { name: "عوامل التصفية" }).count()) === 1, "search and filters kept");
  const all = await cards();
  assert(all.some((c) => c.title === P1.title) && all.some((c) => c.title === P2.title), "both new projects under الكل");
  assert(!all.some((c) => c.title === DRAFT_TITLE), "draft shown");
  // Older projects have no competition and get no badge.
  const [legacy] = await sql`select title from projects where competition is null and status = 'published' and deleted_at is null order by published_at desc limit 1`;
  if (legacy) {
    const card = all.find((c) => c.title === legacy.title);
    if (card) assert(card.competition === null, "legacy project got a competition badge");
  }
  await shot(page, "E-explore");
});

await check("student: «سيف» shows only SAIF projects, with their badge", async () => {
  await pickCompetition("saif");
  const list = await cards();
  assert(list.length > 0 && list.every((c) => c.competition === "saif"), JSON.stringify(list));
  assert(list.some((c) => c.title === P1.title && c.badge.includes("سيف")), "SAIF project");
  assert(!list.some((c) => c.title === P2.title), "other project shown");
  assert((await page.locator('[data-competition="saif"][aria-pressed="true"]').count()) === 1, "chip pressed");
  await shot(page, "F-explore-saif");
});

await check("student: «أخرى» shows custom competitions with the student's own name", async () => {
  await pickCompetition("other");
  const list = await cards();
  assert(list.every((c) => c.competition === "other"), JSON.stringify(list));
  const card = list.find((c) => c.title === P2.title);
  assert(card && card.badge.includes(CUSTOM), `custom badge ${card?.badge}`);
});

await check("student: إبداع / الروبوتات / الهاكاثونات / مسابقات البرمجة filter by their own competition", async () => {
  for (const key of ["ibdaa", "robotics", "hackathons", "programming"]) {
    await pickCompetition(key);
    const list = await cards();
    assert(list.every((c) => c.competition === key), `${key}: ${JSON.stringify(list)}`);
    const [{ n }] = await sql`select count(*)::int as n from projects where competition = ${key} and status = 'published' and deleted_at is null`;
    if (n === 0) {
      await page.getByText("لا توجد مشاريع مطابقة للمسابقة المحددة").waitFor();
    } else {
      assert(list.length === Math.min(n, 12), `${key}: ${list.length} of ${n}`);
    }
  }
  await page.getByTestId("show-all-competitions").click();
  await until(async () => !page.url().includes("competition="), "show all");
  await page.locator(`[data-testid="explore-card"]:has-text("${P2.title}")`).waitFor();
});

await check("student: competition works together with search and category", async () => {
  await page.goto(BASE + `/projects?competition=saif&q=${encodeURIComponent("درون " + RUN)}`);
  let list = await cards();
  assert(list.length === 1 && list[0].title === P1.title, `search + saif ${JSON.stringify(list)}`);
  await page.goto(BASE + `/projects?competition=other&q=${encodeURIComponent("درون " + RUN)}`);
  await page.getByText("لا توجد مشاريع مطابقة للمسابقة المحددة").waitFor();
  await page.goto(BASE + "/projects?category=artificial-intelligence&competition=saif");
  list = await cards();
  assert(list.some((c) => c.title === P1.title) && list.every((c) => c.competition === "saif"), `category + saif ${JSON.stringify(list)}`);
  await page.goto(BASE + "/projects?category=artificial-intelligence&competition=other");
  list = await cards();
  assert(!list.some((c) => c.title === P2.title), "category filter ignored");
  // Changing the competition starts again from the first page.
  await page.goto(BASE + "/projects?page=3");
  await pickCompetition("saif");
  assert(!page.url().includes("page="), "page kept after changing the competition");
});

await check("student: a project page opens for a signed-in student", async () => {
  const [{ slug }] = await sql`select slug from projects where title = ${P1.title}`;
  const res = await page.goto(BASE + `/projects/${slug}`);
  assert(res.status() === 200 && new URL(page.url()).pathname === `/projects/${slug}`, `status ${res.status()}`);
  await page.getByRole("heading", { name: P1.title }).waitFor();
});

await check("English labels and mobile layout (Explore Projects, form, Manage Projects)", async () => {
  const en = await newContext("en", { width: 390, height: 844 });
  await en.addCookies((await s3.context.cookies()).filter((c) => c.name === "ti_student_sid"));
  const mp = await en.newPage();
  watch(mp);
  await mp.goto(BASE + "/projects?competition=saif");
  await mp.getByTestId("competition-filter").waitFor();
  await mp.getByTestId("results-count").waitFor();
  const chips = await mp.locator('[data-testid="competition-filter"] button').allInnerTexts();
  assert(JSON.stringify(chips.map((c) => c.trim())) === JSON.stringify(["All", "SAIF", "Ibdaa", "Robotics", "Hackathons", "Programming Competitions", "Other"]), `chips ${chips}`);
  assert((await mp.getByTestId("competition-filter").innerText()).includes("Competition"), "label");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `explore overflows by ${overflow}px`);
  await shot(mp, "G-explore-mobile");
  await mp.goto(BASE + "/projects?competition=hackathons");
  await mp.getByTestId("results-count").waitFor();
  if ((await mp.locator('[data-testid="explore-card"]').count()) === 0) {
    assert((await mp.locator("main").innerText()).includes("No Projects Match the Selected Competition"), "English empty state");
  }
  await en.close();

  const ea = await newContext("en", { width: 390, height: 844 });
  await ea.addCookies((await adminContext.cookies()).filter((c) => /admin/.test(c.name)));
  const ma = await ea.newPage();
  watch(ma);
  await ma.goto(BASE + "/admin/projects");
  await ma.getByTestId("admin-submissions").waitFor();
  const heads = await ma.locator('[data-testid="admin-submissions"] thead th').allInnerTexts();
  assert(JSON.stringify(heads.map((h) => h.trim())) === JSON.stringify(["Student Name", "Preview Project"]), `headers ${heads}`);
  const overflow2 = await ma.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow2 <= 0, `admin overflows by ${overflow2}px`);
  await shot(ma, "G-admin-mobile");
  await ea.close();
});

// ---------------------------------------------------------------------------
// Administrator: Delete Project (only this run's own projects are deleted)
// ---------------------------------------------------------------------------

const [sub1] = await sql`select ps.id from project_submissions ps join projects p on p.id = ps.project_id where p.title = ${P1.title} and ps.status = 'submitted'`;
const [sub2] = await sql`select ps.id, ps.project_id, ps.student_id from project_submissions ps join projects p on p.id = ps.project_id where p.title = ${P2.title} and ps.status = 'submitted'`;
const [{ slug: slug2 }] = await sql`select slug from projects where title = ${P2.title}`;
let actionId = null;
current = ap;
const row2 = () => ap.locator(`[data-submission="${sub2.id}"]`);

// ---------------------------------------------------------------------------
// Administrator: search by student name (this run's own students and projects)
// ---------------------------------------------------------------------------
// Seeded straight into the database: three named students (one with three
// projects; one whose name differs only in hamza spelling) and a load of 2,000
// submitted projects from 400 more students, all carrying this run's marker.

const SEARCH = {
  multi: { ar: `إبراهيم خالد الحربي ${RUN}`, en: `Ibrahim Khalid Alharbi ${RUN}`, titles: [1, 2, 3].map((i) => `مشروع البحث ${i} ${RUN}`) },
  variant: { ar: `ابراهيم سالم القحطاني ${RUN}`, en: `Ebrahim Salem Alqahtani ${RUN}`, titles: [`مشروع الطاقة ${RUN}`] },
  other: { ar: `سارة محمد العمري ${RUN}`, en: `Sara Mohammed Alomari ${RUN}`, titles: [`مشروع المياه ${RUN}`] },
};
const LOAD = { students: 400, perStudent: 5 };
const seedSlug = `qa-search-${RUN.toLowerCase()}`;
async function removeSearchSeed() {
  await sql`delete from project_submissions where student_id in (select id from students where slug like ${seedSlug + "-%"})`;
  await sql`delete from students where slug like ${seedSlug + "-%"}`;
}
async function seedStudent(key, s, minutesAgo) {
  const [{ id }] = await sql`insert into students (slug, name_ar, name_en, grade, section) values (${`${seedSlug}-${key}`}, ${s.ar}, ${s.en}, 11, 2) returning id`;
  await sql`insert into student_profiles (student_id, full_name, national_id, phone, email, grade, section)
            values (${id}, ${s.ar}, ${validNationalId()}, '0500000000', ${`${key}.${RUN.toLowerCase()}@example.com`}, 11, 2)`;
  s.ids = [];
  for (const [i, title] of s.titles.entries()) {
    const answers = { title, studentName: s.ar, targetCompetition: "saif", field: "ai", summary: `ملخص ${title}` };
    const [row] = await sql`insert into project_submissions (student_id, status, answers, submitted_at)
                            values (${id}, 'submitted', ${sql.json(answers)}, now() - make_interval(mins => ${minutesAgo + i})) returning id`;
    s.ids.push(row.id);
  }
}
await removeSearchSeed();
await seedStudent("multi", SEARCH.multi, 1);
await seedStudent("variant", SEARCH.variant, 10);
await seedStudent("other", SEARCH.other, 20);
await sql`insert into students (slug, name_ar, name_en, grade, section)
          select ${seedSlug} || '-load-' || g, 'طالب أداء ' || g || ' ' || ${RUN}, 'Load Student ' || g || ' ' || ${RUN}, 10, 1
            from generate_series(1, ${LOAD.students}) g`;
await sql`insert into student_profiles (student_id, full_name, national_id, phone, email, grade, section)
          select id, name_ar, ${validNationalId()}, '0500000000', 'load@example.com', 10, 1 from students where slug like ${seedSlug + "-load-%"}`;
await sql`insert into project_submissions (student_id, status, answers, submitted_at)
          select s.id, 'submitted',
                 jsonb_build_object('title', 'مشروع حمل ' || n || ' ' || s.name_en, 'studentName', s.name_ar, 'targetCompetition', 'saif', 'field', 'ai'),
                 now() - interval '1 day' - make_interval(mins => n)
            from students s cross join generate_series(1, ${LOAD.perStudent}) n
           where s.slug like ${seedSlug + "-load-%"}`;

const searchRows = (page) =>
  page.locator('[data-testid="admin-submission-row"]').evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-submission"), name: e.querySelector('[data-testid="submission-student"]').textContent.trim(), href: e.querySelector('[data-testid="submission-preview"]').getAttribute("href"), del: !!e.querySelector('[data-testid="submission-delete"]') })),
  );
const settled = (page) => until(async () => (await page.getByTestId("submission-results").getAttribute("aria-busy")) === null, "results still loading");
/** Types into the search (no Enter) and waits for the list of that search. */
async function searchFor(page, text) {
  await page.getByTestId("submission-search").fill(text);
  const want = text.trim().replace(/\s+/g, " ");
  await page.waitForURL((u) => (u.searchParams.get("q") ?? "") === want);
  await settled(page);
}
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
current = ap;

await check("search: «ابحث باسم الطالب...» sits above the table, with a search icon, in the Athar style", async () => {
  await ap.goto(BASE + "/admin/projects");
  const box = ap.getByTestId("submission-search");
  await box.waitFor();
  assert((await box.getAttribute("placeholder")) === "ابحث باسم الطالب...", "placeholder");
  assert((await box.evaluate((el) => getComputedStyle(el).direction)) === "rtl", "Arabic placeholder reads right to left");
  assert((await ap.getByLabel("البحث باسم الطالب").count()) === 1, "accessible label");
  const form = ap.locator('form[role="search"]');
  assert((await form.locator("svg.lucide-search").count()) === 1, "search icon");
  const [b, tbl] = await Promise.all([box.boundingBox(), ap.getByTestId("admin-submissions").boundingBox()]);
  assert(b.y + b.height <= tbl.y, "search box is not above the table");
  assert(Math.abs(b.width - tbl.width) < 2, `search box ${b.width}px vs table ${tbl.width}px`);
  const icon = await form.locator("svg.lucide-search").boundingBox();
  assert(icon.x > b.x + b.width / 2, "icon on the start (right) side in Arabic");
  const style = await box.evaluate((el) => getComputedStyle(el).borderRadius);
  assert(parseFloat(style) >= 12, `rounded corners ${style}`);
  await box.focus();
  const ring = await box.evaluate((el) => getComputedStyle(el).boxShadow);
  assert(ring !== "none", "focus ring");
  await box.blur();
  await shot(ap, "J-admin-search-bar");
});

await check("search: the full name lists all of that student's projects (one row each), and only theirs", async () => {
  await searchFor(ap, SEARCH.multi.ar);
  const rows = await searchRows(ap);
  assert(same(rows.map((r) => r.id), SEARCH.multi.ids), `rows ${rows.length}: ${rows.map((r) => r.name).join(" / ")}`);
  for (const r of rows) {
    assert(r.name === SEARCH.multi.ar, `name ${r.name}`);
    assert(r.href === `/admin/projects/submissions/${r.id}` && r.del, "each row keeps Preview and Delete for its own project");
  }
  const heads = await ap.locator('[data-testid="admin-submissions"] thead th').allInnerTexts();
  assert(JSON.stringify(heads.map((h) => h.trim())) === JSON.stringify(["اسم الطالب", "معاينة المشروع"]), `headers ${heads}`);
  assert((await ap.getByTestId("submission-search").inputValue()) === SEARCH.multi.ar, "the search stays in the field");
  await shot(ap, "K-admin-search-multiple-projects");
});

await check("search: part of a name, any word order, extra spaces and أ/إ/ا spellings all match", async () => {
  await searchFor(ap, `إبراه ${RUN}`);
  assert(same((await searchRows(ap)).map((r) => r.id), [...SEARCH.multi.ids, ...SEARCH.variant.ids]), "partial word: إبراه / ابراه");
  await searchFor(ap, `  الحربي    ${RUN}   خالد `);
  assert(same((await searchRows(ap)).map((r) => r.id), SEARCH.multi.ids), "words out of order with repeated spaces");
  await searchFor(ap, `ابراهيم خالد ${RUN}`);
  assert(same((await searchRows(ap)).map((r) => r.id), SEARCH.multi.ids), "ابراهيم finds إبراهيم");
  await searchFor(ap, `أبراهيم سالم ${RUN}`);
  assert(same((await searchRows(ap)).map((r) => r.id), SEARCH.variant.ids), "أبراهيم finds ابراهيم");
  await searchFor(ap, `ابراهيم ${RUN}`);
  const both = await searchRows(ap);
  assert(same(both.map((r) => r.id), [...SEARCH.multi.ids, ...SEARCH.variant.ids]), "both Ibrahims");
  for (const r of both) assert(r.name === (SEARCH.multi.ids.includes(r.id) ? SEARCH.multi.ar : SEARCH.variant.ar), "a row shows another student's name");
  // Words from two different names (or students) never combine into a match.
  await searchFor(ap, `إبراهيم العمري ${RUN}`);
  assert((await searchRows(ap)).length === 0, "words from different students matched");
  await searchFor(ap, `ابراهيم Alqahtani ${RUN}`);
  assert((await searchRows(ap)).length === 0, "words from the Arabic and the English name combined");
});

await check("search: updates while typing, shows a loading state, and the empty state for no match", async () => {
  await ap.getByTestId("submission-search").fill("");
  await ap.waitForURL((u) => !u.searchParams.has("q"));
  await settled(ap);
  // Slow the list down so the loading state can be seen.
  await ap.route((u) => u.pathname === "/admin/projects" && u.searchParams.has("q"), async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue().catch(() => {});
  });
  await ap.getByTestId("submission-search").pressSequentially(`سارة ${RUN}`, { delay: 30 });
  await ap.getByTestId("submission-search-loading").waitFor({ timeout: 5000 });
  assert((await ap.getByTestId("submission-results").getAttribute("aria-busy")) === "true", "results not marked busy");
  await ap.waitForURL((u) => u.searchParams.get("q") === `سارة ${RUN}`);
  await settled(ap);
  await ap.unrouteAll({ behavior: "wait" });
  assert(same((await searchRows(ap)).map((r) => r.id), SEARCH.other.ids), "typed search result");
  await searchFor(ap, `اسم غير موجود ${RUN}`);
  assert((await searchRows(ap)).length === 0, "rows for no match");
  const empty = await ap.getByTestId("submission-search-empty").innerText();
  assert(empty.includes("لا توجد مشاريع مطابقة لاسم الطالب"), `empty state: ${empty}`);
  await shot(ap, "L-admin-search-empty");
});

await check("search: clearing the field brings back every submitted project", async () => {
  await ap.getByTestId("submission-search-clear").click();
  await ap.waitForURL((u) => !u.searchParams.has("q"));
  await settled(ap);
  assert((await ap.getByTestId("submission-search").inputValue()) === "", "field not cleared");
  const [{ n }] = await sql`select count(*)::int as n from project_submissions where status = 'submitted'`;
  const rows = await searchRows(ap);
  assert(rows.length === n, `rows ${rows.length} vs submitted ${n}`);
  assert(rows.some((r) => r.id === sub1.id) && rows.some((r) => r.id === sub2.id), "the form-submitted projects are back");
});

await check(`search: ${LOAD.students * LOAD.perStudent + 5}+ projects — the server finds one student's projects quickly and exactly`, async () => {
  const [{ n }] = await sql`select count(*)::int as n from project_submissions where status = 'submitted'`;
  assert(n >= LOAD.students * LOAD.perStudent + 5, `only ${n} projects`);
  const name = `طالب اداء 137 ${RUN}`; // «أداء» stored with hamza
  const wanted = await sql`select ps.id from project_submissions ps join students s on s.id = ps.student_id where s.slug = ${seedSlug + "-load-137"} and ps.status = 'submitted'`;
  const t0 = Date.now();
  await searchFor(ap, name);
  const ms = Date.now() - t0;
  const rows = await searchRows(ap);
  assert(same(rows.map((r) => r.id), wanted.map((w) => w.id)), `rows ${rows.length}`);
  assert(rows.every((r) => r.name === `طالب أداء 137 ${RUN}`), "another student's row");
  assert(ms < 5000, `search took ${ms}ms`);
  const t1 = Date.now();
  const res = await adminContext.request.get(BASE + `/admin/projects?q=${encodeURIComponent("Load Student 250 " + RUN)}`);
  const serverMs = Date.now() - t1;
  assert(res.ok() && (await res.text()).includes(`طالب أداء 250 ${RUN}`), "server-rendered result");
  console.log(`      ${n} submitted projects: search in the browser ${ms}ms, server page ${serverMs}ms`);
  assert(serverMs < 3000, `server page took ${serverMs}ms`);
});

await check("search: Preview Project in the results opens that exact project", async () => {
  await searchFor(ap, SEARCH.multi.ar);
  const rows = await searchRows(ap);
  const target = rows[1];
  const i = SEARCH.multi.ids.indexOf(target.id);
  await ap.locator(`[data-submission="${target.id}"]`).getByTestId("submission-preview").click();
  await ap.waitForURL((u) => u.pathname === `/admin/projects/submissions/${target.id}`);
  assert((await ap.getByTestId("preview-title").innerText()).trim() === SEARCH.multi.titles[i], "preview of another project");
  assert((await ap.getByTestId("preview-student").innerText()).trim() === SEARCH.multi.ar, "preview student");
  await ap.goBack();
  await ap.waitForURL((u) => u.searchParams.get("q") === SEARCH.multi.ar);
  await ap.getByTestId("admin-submissions").waitFor();
  assert((await ap.getByTestId("submission-search").inputValue()) === SEARCH.multi.ar, "search kept after Back");
});

await check("search: Delete Project in the results deletes exactly that submission and keeps the search", async () => {
  await settled(ap);
  const victim = SEARCH.multi.ids[2];
  const i = 2;
  const row = ap.locator(`[data-submission="${victim}"]`);
  await row.getByTestId("submission-delete").click();
  await ap.getByTestId("delete-dialog").waitFor();
  assert((await ap.getByTestId("delete-title").innerText()).trim() === SEARCH.multi.titles[i], "dialog names another project");
  assert((await ap.getByTestId("delete-student").innerText()).trim() === SEARCH.multi.ar, "dialog names another student");
  const [{ before: total }] = await sql`select count(*)::int as before from project_submissions where status = 'submitted'`;
  await ap.getByTestId("delete-confirm").click();
  await ap.getByText(`تم حذف المشروع «${SEARCH.multi.titles[i]}».`).waitFor();
  await row.waitFor({ state: "detached" });
  const [{ gone }] = await sql`select count(*)::int as gone from project_submissions where id = ${victim}`;
  const [{ after }] = await sql`select count(*)::int as after from project_submissions where status = 'submitted'`;
  assert(gone === 0 && after === total - 1, `deleted ${total - after} submissions`);
  assert(new URL(ap.url()).searchParams.get("q") === SEARCH.multi.ar, "search lost after deleting");
  await settled(ap);
  assert(same((await searchRows(ap)).map((r) => r.id), SEARCH.multi.ids.slice(0, 2)), "the student's other projects");
});

await check("search: English names and labels, and the mobile layout", async () => {
  const en = await newContext("en", { width: 1440, height: 1000 });
  await en.addCookies((await adminContext.cookies()).filter((c) => /admin/.test(c.name)));
  const pe = await en.newPage();
  watch(pe);
  await pe.goto(BASE + "/admin/projects");
  const box = pe.getByTestId("submission-search");
  await box.waitFor();
  assert((await box.getAttribute("placeholder")) === "Search by student name...", "English placeholder");
  assert((await box.evaluate((el) => getComputedStyle(el).direction)) === "ltr", "English placeholder reads left to right");
  const [b, icon] = await Promise.all([box.boundingBox(), pe.locator('form[role="search"] svg.lucide-search').boundingBox()]);
  assert(icon.x < b.x + b.width / 2, "icon on the start (left) side in English");
  await searchFor(pe, `  ibrahim   KHALID ${RUN.toLowerCase()} `);
  const rows = await searchRows(pe);
  assert(same(rows.map((r) => r.id), SEARCH.multi.ids.slice(0, 2)), `English search rows ${rows.length}`);
  assert(rows.every((r) => r.name === SEARCH.multi.en), "English names");
  await searchFor(pe, `Nobody Here ${RUN}`);
  assert((await pe.getByTestId("submission-search-empty").innerText()).includes("No projects found for this student name."), "English empty state");
  await en.close();

  const m = await newContext("ar", { width: 390, height: 844 });
  await m.addCookies((await adminContext.cookies()).filter((c) => /admin/.test(c.name)));
  const pm = await m.newPage();
  watch(pm);
  await pm.goto(BASE + "/admin/projects?q=" + encodeURIComponent(SEARCH.multi.ar));
  await pm.getByTestId("admin-submissions").waitFor();
  assert((await pm.getByTestId("submission-search").inputValue()) === SEARCH.multi.ar, "search from the address");
  assert(same((await searchRows(pm)).map((r) => r.id), SEARCH.multi.ids.slice(0, 2)), "mobile rows");
  const overflow = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `overflows by ${overflow}px`);
  const [mb, mt] = await Promise.all([pm.getByTestId("submission-search").boundingBox(), pm.getByTestId("admin-submissions").boundingBox()]);
  assert(mb.y + mb.height <= mt.y && mb.width >= 300, "mobile search box");
  await shot(pm, "M-admin-search-mobile");
  await m.close();
  current = ap;
});

await removeSearchSeed();


await check("admin: Delete Project sits beside Preview Project in the same cell (still two columns)", async () => {
  await ap.goto(BASE + "/admin/projects");
  await row2().waitFor();
  const heads = await ap.locator('[data-testid="admin-submissions"] thead th').allInnerTexts();
  assert(heads.length === 2, `columns ${heads}`);
  const cells = row2().locator("td");
  assert((await cells.count()) === 2, "cells per row");
  const cell = cells.nth(1);
  assert((await cell.getByTestId("submission-preview").innerText()).trim() === "معاينة المشروع", "preview button unchanged");
  const del = cell.getByTestId("submission-delete");
  assert((await del.innerText()).trim() === "حذف المشروع", "delete label");
  assert(/bg-danger-ink/.test(await del.getAttribute("class")) && (await del.locator("svg").count()) === 1, "red button with a trash icon");
  const [a, b] = await Promise.all([cell.getByTestId("submission-preview").boundingBox(), del.boundingBox()]);
  assert(Math.abs(a.y - b.y) < 2, "buttons side by side");
  await shot(ap, "H-admin-delete-button");
});

await check("admin: Delete asks for confirmation naming the project and student; Cancel changes nothing", async () => {
  await row2().getByTestId("submission-delete").click();
  const dialog = ap.getByTestId("delete-dialog");
  await dialog.waitFor();
  const text = await dialog.innerText();
  assert(text.includes("تأكيد حذف المشروع"), "title");
  assert(text.includes("هل أنت متأكد من حذف هذا المشروع؟ لا يمكن التراجع عن الحذف."), "message");
  assert((await ap.getByTestId("delete-title").innerText()).trim() === P2.title, "project title");
  assert((await ap.getByTestId("delete-student").innerText()).trim() === n2.ar, "student name");
  assert((await ap.getByTestId("delete-cancel").innerText()).trim() === "إلغاء" && (await ap.getByTestId("delete-confirm").innerText()).trim() === "تأكيد الحذف", "buttons");
  await ap.waitForTimeout(400); // let the opening animation finish before the screenshot
  await shot(ap, "I-admin-delete-dialog");
  await ap.getByTestId("delete-cancel").click();
  await dialog.waitFor({ state: "detached" });
  const [{ n }] = await sql`select count(*)::int as n from project_submissions where id = ${sub2.id}`;
  const [{ p }] = await sql`select count(*)::int as p from projects where id = ${sub2.project_id}`;
  assert(n === 1 && p === 1, "cancel deleted something");
});

await check("admin: a failed deletion shows an error message and deletes nothing", async () => {
  const seen = errors.length;
  await ap.route("**/*", async (route) => {
    const headers = route.request().headers();
    if (route.request().method() === "POST" && headers["next-action"]) {
      actionId = headers["next-action"];
      return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await row2().getByTestId("submission-delete").click();
  await ap.getByTestId("delete-confirm").click();
  await ap.getByText("تعذّر حذف المشروع. حاول مرة أخرى.").waitFor();
  assert(await ap.getByTestId("delete-dialog").isVisible(), "dialog closed on failure");
  await ap.unrouteAll({ behavior: "wait" });
  await ap.getByTestId("delete-cancel").click();
  const [{ n }] = await sql`select count(*)::int as n from project_submissions where id = ${sub2.id}`;
  assert(n === 1, "deleted despite the failure");
  assert(actionId, "action request captured");
  errors.splice(seen); // the forced 500 is logged by the browser on purpose
});

await check("admin: Confirm deletes exactly that project (once), refreshes the table and keeps everything else", async () => {
  const [{ before: projectsBefore }] = await sql`select count(*)::int as before from projects`;
  let calls = 0;
  ap.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) calls += 1;
  });
  await row2().getByTestId("submission-delete").click();
  await ap.getByTestId("delete-dialog").waitFor();
  // Two clicks in the same instant: only one request may go out.
  await ap.evaluate(() => {
    const b = document.querySelector('[data-testid="delete-confirm"]');
    b.click();
    b.click();
  });
  await ap.getByText(`تم حذف المشروع «${P2.title}».`).waitFor();
  await row2().waitFor({ state: "detached" });
  assert(calls === 1, `${calls} delete requests`);
  assert((await ap.locator(`[data-submission="${sub1.id}"]`).count()) === 1, "the other project's row");
  const [{ subs }] = await sql`select count(*)::int as subs from project_submissions where id = ${sub2.id} or project_id = ${sub2.project_id}`;
  const [{ projects }] = await sql`select count(*)::int as projects from projects where id = ${sub2.project_id}`;
  const [{ links }] = await sql`select (select count(*) from project_students where project_id = ${sub2.project_id}) + (select count(*) from project_media where project_id = ${sub2.project_id})::int as links`;
  assert(subs === 0 && projects === 0 && Number(links) === 0, `left behind: ${subs} submissions, ${projects} projects, ${links} links`);
  const [{ after: projectsAfter }] = await sql`select count(*)::int as after from projects`;
  assert(projectsAfter === projectsBefore - 1, `projects ${projectsBefore} → ${projectsAfter}`);
  const [{ student }] = await sql`select count(*)::int as student from students where id = ${sub2.student_id}`;
  const [{ profile }] = await sql`select count(*)::int as profile from student_profiles where student_id = ${sub2.student_id}`;
  assert(student === 1 && profile === 1, "student account or profile touched");
  const [{ other }] = await sql`select count(*)::int as other from project_submissions ps join projects p on p.id = ps.project_id where ps.id = ${sub1.id}`;
  assert(other === 1, "another student's project was touched");
});

await check("deleted project is gone for students (Explore Projects and its page)", async () => {
  const sp = s3.page;
  await sp.goto(BASE + "/projects");
  await sp.getByTestId("results-count").waitFor();
  assert((await sp.locator(`[data-testid="explore-card"]:has-text("${P2.title}")`).count()) === 0, "still listed");
  assert((await sp.locator(`[data-testid="explore-card"]:has-text("${P1.title}")`).count()) === 1, "other project missing");
  const res = await s3.context.request.get(BASE + `/projects/${slug2}`);
  assert(res.status() === 404, `project page ${res.status()}`);
});

await check("server: the delete action refuses a student and a visitor (checked on the server, not only in the page)", async () => {
  const replay = (context, path) =>
    context.request.post(BASE + path, {
      headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      data: JSON.stringify([sub1.id]),
      maxRedirects: 0,
    });
  await replay(s3.context, "/home");
  const anon = await newContext("ar");
  await replay(anon, "/");
  await anon.close();
  const [{ n }] = await sql`select count(*)::int as n from project_submissions ps join projects p on p.id = ps.project_id where ps.id = ${sub1.id}`;
  assert(n === 1, "a non-administrator deleted a project");
  // Control: the same request with the administrator's session does delete (this run's own project).
  await replay(adminContext, "/admin/projects");
  const [{ gone }] = await sql`select count(*)::int as gone from project_submissions where id = ${sub1.id}`;
  assert(gone === 0, "the replayed request never reached the action (the checks above prove nothing)");
});

await check("no browser errors", async () => {
  assert(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await s3.context.close();
await adminContext.close();
await browser.close();

// Remove what this run created.
for (const title of [P1.title, P2.title]) {
  const projects = await sql`select id from projects where title = ${title}`;
  for (const p of projects) {
    await sql`delete from project_submissions where project_id = ${p.id}`;
    await sql`delete from projects where id = ${p.id}`;
  }
}
await removeSearchSeed();
await sql`delete from project_submissions where status in ('draft', 'editing') and student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
await sql`delete from student_profiles where student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
await sql.end();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
