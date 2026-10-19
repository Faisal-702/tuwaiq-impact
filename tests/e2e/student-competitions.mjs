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

await check("admin: Manage Projects has no Add Project button, search, tabs or old columns; sidebar has no Add Project", async () => {
  await ap.goto(BASE + "/admin/projects");
  await ap.getByRole("heading", { name: "إدارة المشاريع", level: 1 }).waitFor();
  const main = await ap.locator("main").innerText();
  for (const gone of ["إضافة مشروع", "البحث في المشاريع", "المسودات", "المنشورة", "المميزة", "التصنيف", "النقاط", "المشاهدات", "آخر تحديث"]) {
    assert(!main.includes(gone), `still shows «${gone}»`);
  }
  assert((await ap.locator('main input[type="search"], main [role="search"]').count()) === 0, "search box");
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
  const heads = await ma.locator('[data-testid="admin-submissions"] thead th').allInnerTexts();
  assert(JSON.stringify(heads.map((h) => h.trim())) === JSON.stringify(["Student Name", "Preview Project"]), `headers ${heads}`);
  const overflow2 = await ma.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow2 <= 0, `admin overflows by ${overflow2}px`);
  await shot(ma, "G-admin-mobile");
  await ea.close();
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
await sql`delete from project_submissions where status in ('draft', 'editing') and student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
await sql`delete from student_profiles where student_id in (select id from students where name_en in (${S1}, ${S2}, ${S3}))`;
await sql.end();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
