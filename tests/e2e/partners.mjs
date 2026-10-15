/**
 * Landing page, partnership applications and the admin Partners page.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/partners.mjs
 *
 * Journey: a visitor opens the site → landing page → Sign in opens the
 * existing entry page; Partners → application form → submit → stored once →
 * the admin opens Partners (right below Student Codes) → sees the request →
 * views every answer → searches, filters and pages. Also: validation,
 * anti-spam, privacy (nothing public), AR/EN switching and small screens.
 *
 * Needs DATABASE_URL (from .env.local) for the storage checks; test rows are
 * marked "QA Partner" and removed at the start and the end.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, randomClientIp } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const RUN = Date.now().toString(36);

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

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is required (storage checks).");
  process.exit(1);
}
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const cleanup = () => sql`delete from partner_applications where full_name like 'QA Partner%'`;
await cleanup();

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

async function newPage(lang = "ar", { viewport = { width: 1440, height: 900 }, ip = randomClientIp() } = {}) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to fetch|ERR_ABORTED|net::ERR|status of 4\d\d/.test(m.text())) return;
    errors.push(m.text());
  });
  return { context, page };
}

const path = (page) => new URL(page.url()).pathname;
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1);

const ORG = {
  fullName: `QA Partner ${RUN} Org`,
  organizationName: `QA Org ${RUN} Advanced Tech`,
  category: "other",
  categoryOther: "Professional association",
  jobTitle: "Partnerships Manager",
  phone: "+966 55 123 4567",
  storedPhone: "0551234567",
  email: `qa.partner.${RUN}@Example.com`,
  city: "Riyadh",
  support: ["technical", "mentorship", "other"],
  supportOther: "Laboratory access",
  interests: ["ai", "iot", "other"],
  interestOther: "Space technology",
  proposal: `We can offer equipment and mentoring for student robotics teams (${RUN}).\nSecond line of the proposal.`,
};

/** Opens a multi-select, toggles the options, closes it with "Done". */
async function choose(page, field, values) {
  await page.getByTestId(`${field}-trigger`).click();
  const list = page.getByTestId(`${field}-list`);
  for (const v of values) await list.locator(`[data-option="${v}"]`).click();
  await page.getByTestId(`${field}-done`).click();
  await list.waitFor({ state: "detached" });
}

async function fillForm(page, d) {
  await page.locator(`[data-partner-type="${d.type ?? "organization"}"]`).click();
  await page.locator("#fullName").fill(d.fullName);
  if ((d.type ?? "organization") === "organization") {
    await page.locator("#organizationName").fill(d.organizationName);
    await page.locator("#jobTitle").fill(d.jobTitle);
    await page.locator("#organizationCategory").selectOption(d.category);
    if (d.categoryOther) await page.locator("#organizationCategoryOther").fill(d.categoryOther);
  }
  await page.locator("#email").fill(d.email);
  await page.locator("#phone").fill(d.phone);
  await page.locator("#city").fill(d.city);
  await choose(page, "supportTypes", d.support);
  if (d.supportOther) await page.locator("#supportOther").fill(d.supportOther);
  await choose(page, "interestFields", d.interests);
  if (d.interestOther) await page.locator("#interestOther").fill(d.interestOther);
  await page.locator("#proposal").fill(d.proposal);
  await page.locator('label[for="consent"]').click();
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

await check("visitor opening the site sees the public landing page (no redirect to sign-in)", async () => {
  const { context, page } = await newPage("ar");
  const res = await page.goto(BASE + "/");
  assert(res.status() === 200 && path(page) === "/", `landed on ${page.url()}`);
  const hero = page.getByTestId("landing-hero");
  const text = (await hero.innerText()).replace(/\s+/g, " ");
  for (const s of ["نُوثِّق أفكار طلابنا...", "لتصنع فرصًا أكبر", "منصة أثر تساعد طلاب المدارس على توثيق مشاريعهم وأفكارهم، وإبراز إنجازاتهم، وربطهم بالفرص والدعم من الجهات التعليمية والقطاعين الحكومي والخاص."]) {
    assert(text.includes(s), `hero is missing "${s}"`);
  }
  assert((await page.locator("h1").count()) === 1, "one h1");
  // The أثـ — ـر wordmark: drawn (SVG paths), read as the correctly spelled word.
  const mark = hero.getByRole("img", { name: "أثر", exact: true });
  await mark.waitFor();
  assert((await mark.evaluate((el) => el.tagName.toLowerCase())) === "svg" && (await mark.locator("path").count()) === 6, "wordmark drawn as paths");
  // Header: the official MoE logo and the school's name as text; no Tuwaiq Academy logo.
  const logos = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="landing-header"] img')].map((i) => ({ alt: i.alt, ok: i.naturalWidth > 0, src: i.currentSrc })),
  );
  assert(logos.length === 1 && logos[0].alt === "وزارة التعليم" && logos[0].ok && /moe-logo/.test(logos[0].src), JSON.stringify(logos));
  assert((await page.getByTestId("landing-school").innerText()).trim() === "ثانوية الموهوبين التقنية", "school name text");
  assert((await page.getByTestId("landing-brand").locator("svg").count()) === 0, "no icon beside the school name");
  // Cairo is the landing page's Arabic typeface.
  assert(/Cairo/.test(await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)), "Cairo font");
  await context.close();
});

await check("landing sections: Why (4 cards), How (01–03), For partners (4 items + CTA)", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/");
  const why = page.getByTestId("landing-why");
  await why.getByRole("heading", { name: "لماذا منصة أثر؟" }).waitFor();
  for (const s of ["تمكين الطلاب", "حفظ الحقوق الفكرية", "عرض احترافي للمشاريع", "فرص وشراكات أوسع"]) await why.getByRole("heading", { name: s }).waitFor();
  const how = page.getByTestId("landing-how");
  await how.getByRole("heading", { name: "كيف تعمل المنصة؟" }).waitFor();
  const steps = (await how.locator("ol > li").allInnerTexts()).map((s) => s.replace(/\s+/g, " "));
  assert(steps.length === 3 && steps[0].includes("01") && steps[0].includes("رفع المشروع") && steps[1].includes("تنظيمه وتقييمه") && steps[2].includes("صناعة الأثر"), steps.join(" | "));
  const band = page.getByTestId("landing-partners-section");
  await band.getByRole("heading", { name: "للشركاء" }).waitFor();
  for (const s of ["فرص واعدة", "اكتشاف المواهب", "مواكبة الابتكار", "أثر تعليمي واقتصادي"]) await band.getByRole("heading", { name: s }).waitFor();
  const cta = band.getByRole("link", { name: "كن شريكًا في أثر" });
  await cta.waitFor();
  // The lower section uses the upper palette: the CTA is the brand indigo, not dark green.
  const ctaColor = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
  assert(ctaColor === "rgb(66, 31, 190)", `CTA colour ${ctaColor}`);
  // Accurate wording: documentation and attribution, no legal registration claims.
  const body = await page.locator("main").innerText();
  assert(!/براءة|تسجيل الملكية|patent|legally registered/i.test(body), "no legal IP registration claims");
  await context.close();
});

await check("Sign in buttons (header and hero) open the existing entry page", async () => {
  const { context, page } = await newPage("ar");
  for (const id of ["landing-login", "hero-login"]) {
    await page.goto(BASE + "/");
    await page.getByTestId(id).click();
    await page.waitForURL((u) => u.pathname === "/welcome");
    await page.locator("#student-code").waitFor();
  }
  await context.close();
});

await check("Partners buttons (header, hero, partners section) open the application form", async () => {
  const { context, page } = await newPage("ar");
  for (const id of ["landing-partners", "hero-partner", "become-partner"]) {
    await page.goto(BASE + "/");
    await page.getByTestId(id).click();
    await page.waitForURL((u) => u.pathname === "/partners");
    await page.getByTestId("partner-form").waitFor();
  }
  // A clear way back to the landing page.
  await page.getByTestId("partners-back-home").click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(BASE + "/partners");
  await page.locator('[data-testid="landing-header"] a[href="/"]').click();
  await page.waitForURL((u) => u.pathname === "/");
  await context.close();
});

await check("landing page switches AR ⇄ EN immediately, in place", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/");
  await page.evaluate(() => (window.__marker = true));
  await page.locator('[role="group"] button').filter({ hasText: "EN" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 8000 });
  const s = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    h1: document.querySelector("h1")?.innerText ?? "",
    marker: window.__marker === true,
    title: document.title,
  }));
  assert(s.dir === "ltr" && s.h1.includes("We document our students") && s.marker && s.title.startsWith("Athar Platform"), JSON.stringify(s));
  await page.locator('[role="group"] button').filter({ hasText: "العربية" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "ar" && document.querySelector("h1")?.innerText.includes("نُوثِّق"), null, { timeout: 8000 });
  await context.close();
});

// ---------------------------------------------------------------------------
// Application form
// ---------------------------------------------------------------------------

await check("form: empty submit shows accessible errors and focuses the first field", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/partners");
  await page.getByTestId("partner-submit").click();
  await page.getByTestId("partner-error-summary").waitFor();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
  assert(focused === "partnerType", `focused ${focused}`);
  const alerts = await page.locator('[data-testid="partner-form"] [role="alert"]').count();
  assert(alerts >= 9, `error messages: ${alerts}`);
  assert((await page.locator("#fullName").getAttribute("aria-invalid")) === "true", "aria-invalid");
  assert((await page.locator("#fullName").getAttribute("aria-describedby")) === "fullName-error", "describedby");
  assert((await page.getByTestId("organization-fields").count()) === 0, "organization fields hidden before choosing a type");
  await context.close();
});

await check("form: organization fields appear only for organizations; invalid phone and email are rejected", async () => {
  const { context, page } = await newPage("en");
  await page.goto(BASE + "/partners");
  await page.locator('[data-partner-type="individual"]').click();
  assert((await page.getByTestId("organization-fields").count()) === 0, "shown for individuals");
  await page.locator('[data-partner-type="organization"]').click();
  await page.getByTestId("organization-fields").waitFor();
  await page.locator("#phone").fill("12345");
  await page.locator("#email").fill("not-an-email");
  await page.getByTestId("partner-submit").click();
  await page.getByText("Enter a valid Saudi mobile number (05XXXXXXXX).").waitFor();
  await page.getByText("Enter a valid email address.").waitFor();
  assert((await page.locator('[data-field="organizationName"] [role="alert"]').count()) === 1, "organization name required");
  assert((await page.locator('[data-field="jobTitle"] [role="alert"]').count()) === 1, "job title required");
  assert((await page.locator('[data-field="organizationCategory"] [role="alert"]').count()) === 1, "organization type required");
  // "Other" asks for words, and only while it is chosen.
  assert((await page.locator("#organizationCategoryOther").count()) === 0, "specify field shown too early");
  await page.locator("#organizationCategory").selectOption("other");
  await page.locator("#organizationCategoryOther").waitFor();
  assert((await page.locator('[data-field="organizationCategoryOther"] [role="alert"]').count()) === 1, "organization type in words required");
  await page.locator("#organizationCategory").selectOption("government");
  await page.locator("#organizationCategoryOther").waitFor({ state: "detached" });
  // Multi-selects: a dropdown list, the choices shown inside the field; "Other" asks for words.
  assert((await page.locator('[data-field="supportTypes"] [data-option]').count()) === 0, "support options spread on the page");
  await choose(page, "supportTypes", ["financial", "other"]);
  const chosen = await page.locator('[data-testid="supportTypes-trigger"] [data-chosen]').evaluateAll((els) => els.map((e) => e.dataset.chosen));
  assert(JSON.stringify(chosen) === '["financial","other"]', `chosen ${chosen}`);
  await page.locator("#supportOther").waitFor();
  await choose(page, "supportTypes", ["other"]);
  await page.locator("#supportOther").waitFor({ state: "detached" });
  await page.getByTestId("interestFields-trigger").click();
  const options = await page.locator('[data-testid="interestFields-list"] [data-option]').count();
  assert(options === 21, `interest options ${options}`);
  await page.getByTestId("interestFields-list").getByRole("searchbox").fill("Cyber");
  assert((await page.locator('[data-testid="interestFields-list"] [data-option]').count()) === 1, "search in the list");
  await page.keyboard.press("Escape");
  await page.getByTestId("interestFields-list").waitFor({ state: "detached" });
  // Individuals: the organization fields are gone and not required.
  await page.locator('[data-partner-type="individual"]').click();
  assert((await page.getByTestId("organization-fields").count()) === 0, "organization fields kept for individuals");
  await context.close();
});

let orgId = null;
await check("form: an organization submits → success → stored once with normalised values", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/partners");
  await fillForm(page, ORG);
  // A double click must not store the application twice.
  await page.getByTestId("partner-submit").dblclick();
  await page.getByTestId("partner-success").waitFor({ timeout: 15000 });
  await page.getByRole("heading", { name: "تم استلام طلب الشراكة بنجاح" }).waitFor();
  await page.getByText("وسيتم مراجعته من قبل فريق المنصة والتواصل معكم لاحقًا.").waitFor();
  const rows = await sql`select * from partner_applications where full_name = ${ORG.fullName}`;
  assert(rows.length === 1, `stored ${rows.length} times`);
  const r = rows[0];
  orgId = r.id;
  assert(r.partner_type === "organization" && r.organization_name === ORG.organizationName && r.organization_category === "other", "organization");
  assert(r.organization_category_other === ORG.categoryOther && r.support_other === ORG.supportOther && r.interest_other === ORG.interestOther, "other answers");
  assert(r.job_title === ORG.jobTitle && r.city === ORG.city, "job title / city");
  assert(r.phone === ORG.storedPhone, `phone ${r.phone}`);
  assert(r.email === ORG.email.toLowerCase(), `email ${r.email}`);
  assert(JSON.stringify(r.support_types) === '["technical","mentorship","other"]', `support ${r.support_types}`);
  assert(JSON.stringify(r.interest_fields) === '["ai","iot","other"]', `interests ${r.interest_fields}`);
  assert(r.proposal === ORG.proposal && r.consent_at && r.locale === "ar" && r.ip_hash.length === 64, "proposal / consent / locale / ip hash");
  await context.close();
});

await check("form: an individual is stored without organization details", async () => {
  const { context, page } = await newPage("en");
  await page.goto(BASE + "/partners");
  // Organization answers typed before switching to Individual are not stored.
  await page.locator('[data-partner-type="organization"]').click();
  await page.locator("#organizationName").fill("Should not be stored");
  await fillForm(page, {
    type: "individual",
    fullName: `QA Partner ${RUN} Individual`,
    phone: "0509876543",
    email: `qa.individual.${RUN}@example.com`,
    city: "Jeddah",
    support: ["financial"],
    interests: ["cybersecurity"],
    proposal: "I would like to sponsor a student innovation award.",
  });
  await page.getByTestId("partner-submit").click();
  await page.getByTestId("partner-success").waitFor({ timeout: 15000 });
  const [r] = await sql`select * from partner_applications where full_name = ${`QA Partner ${RUN} Individual`}`;
  assert(r && r.partner_type === "individual" && r.organization_name === null && r.organization_category === null && r.job_title === null, JSON.stringify(r));
  assert(r.locale === "en" && JSON.stringify(r.interest_fields) === '["cybersecurity"]', "locale / interests");
  assert(r.organization_category_other === null && r.support_other === null && r.interest_other === null, "no other answers");
  await context.close();
});

await check("anti-spam: honeypot submissions are dropped silently; one address is rate limited", async () => {
  const ip = randomClientIp();
  const { context, page } = await newPage("en", { ip });
  await page.goto(BASE + "/partners");
  const bot = { fullName: `QA Partner ${RUN} Bot`, phone: "0500000001", email: `qa.bot.${RUN}@example.com`, city: "Dammam", support: ["training"], interests: ["cloud"], proposal: "Automated spam text here." };
  await fillForm(page, { ...bot, type: "individual" });
  await page.locator("#partner-website").evaluate((el) => (el.value = "https://spam.example"));
  await page.getByTestId("partner-submit").click();
  await page.getByTestId("partner-success").waitFor({ timeout: 15000 });
  assert((await sql`select 1 from partner_applications where full_name = ${bot.fullName}`).length === 0, "honeypot row stored");
  // Five applications per address per hour; the sixth is refused.
  for (let i = 1; i <= 6; i++) {
    await page.goto(BASE + "/partners");
    await fillForm(page, { ...bot, type: "individual", fullName: `QA Partner ${RUN} Limit ${i}`, email: `qa.limit${i}.${RUN}@example.com`, proposal: `Rate limit check number ${i}.` });
    await page.getByTestId("partner-submit").click();
    if (i <= 5) await page.getByTestId("partner-success").waitFor({ timeout: 15000 });
    else await page.getByText("Too many requests were sent from this connection. Please try again later.").waitFor({ timeout: 15000 });
  }
  const [{ n }] = await sql`select count(*)::int as n from partner_applications where full_name like ${`QA Partner ${RUN} Limit%`}`;
  assert(n === 5, `stored ${n}`);
  await context.close();
});

await check("privacy: the public cannot list or open applications; nothing is shown publicly", async () => {
  const { context, page } = await newPage("en");
  await page.goto(BASE + "/admin/partners");
  assert(path(page) === "/welcome" && page.url().includes("mode=admin"), page.url());
  await page.goto(BASE + `/admin/partners/${orgId}`);
  assert(path(page) === "/welcome", page.url());
  for (const p of ["/", "/partners"]) {
    await page.goto(BASE + p);
    const html = await page.content();
    assert(!html.includes(ORG.email.toLowerCase()) && !html.includes(ORG.organizationName), `${p} shows submitted data`);
  }
  // The database repeats the rules: "other" without words is refused even if validation were bypassed.
  const refused = await sql`
    insert into partner_applications (partner_type, full_name, phone, email, city, support_types, interest_fields, proposal, consent_at, client_token, ip_hash)
    values ('individual', ${`QA Partner ${RUN} Constraint`}, '0500000002', 'qa.constraint@example.com', 'Riyadh', array['other'], array['cloud'],
            'Constraint check proposal.', now(), gen_random_uuid(), 'qa')`.then(() => false, (e) => /other_specified/.test(e.message));
  assert(refused, "support type 'other' without words was stored");
  const [{ rls }] = await sql`select relrowsecurity as rls from pg_class where relname = 'partner_applications'`;
  assert(rls === true, "row level security is off");
  for (const role of ["anon", "authenticated"]) {
    const [exists] = await sql`select 1 from pg_roles where rolname = ${role}`;
    if (!exists) continue;
    const [{ ok }] = await sql`select has_table_privilege(${role}, 'public.partner_applications', 'select') or has_table_privilege(${role}, 'public.partner_applications', 'insert') as ok`;
    assert(!ok, `${role} has access`);
  }
  await context.close();
});

// ---------------------------------------------------------------------------
// Admin Partners page
// ---------------------------------------------------------------------------

const { context: adminContext, page: admin } = await newPage("ar");
await adminLogin(admin, BASE, ADMIN);

const rowCount = () => admin.locator('[data-testid="partner-row"]').count();
const waitRows = async (n) => {
  try {
    await admin.waitForFunction((n) => document.querySelectorAll('[data-testid="partner-row"]').length === n && !document.querySelector('[aria-busy="true"]'), n, { timeout: 10000 });
  } catch {
    throw new Error(`expected ${n} rows, found ${await rowCount()} at ${admin.url()}`);
  }
};

await check("admin: Partners is in the sidebar directly below Student Codes and opens the page", async () => {
  const hrefs = await admin.locator("aside nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const i = hrefs.indexOf("/admin/student-codes");
  assert(i >= 0 && hrefs[i + 1] === "/admin/partners", hrefs.join(", "));
  await admin.locator('aside nav a[href="/admin/partners"]').click();
  await admin.waitForURL((u) => u.pathname === "/admin/partners");
  await admin.getByRole("heading", { level: 1, name: "الشركاء" }).waitFor();
  await admin.getByText("إدارة طلبات الانضمام كشريك في منصة أثر").waitFor();
  assert((await admin.locator('aside nav a[href="/admin/partners"]').getAttribute("aria-current")) === "page", "active item");
  const head = (await admin.locator('[data-testid="partners-table"] thead').innerText()).replace(/\s+/g, " ");
  for (const c of ["الاسم الكامل", "الجهة / المؤسسة", "نوع الجهة", "نوع الشراكة", "رقم الجوال", "البريد الإلكتروني", "تاريخ الطلب", "الإجراءات"]) assert(head.includes(c), `column ${c}`);
  // No statuses or approval workflow.
  const page = await admin.locator("main").innerText();
  assert(!/قبول|رفض|مقبول|مرفوض|الحالة/.test(page), "status/approval wording on the page");
});

await check("admin: the new request appears with its details", async () => {
  await admin.locator("#partner-search").fill(ORG.organizationName);
  await admin.waitForURL((u) => u.searchParams.get("q") === ORG.organizationName);
  await waitRows(1);
  const row = admin.locator(`[data-testid="partner-row"][data-id="${orgId}"]`);
  await row.waitFor({ timeout: 10000 });
  const text = (await row.innerText()).replace(/\s+/g, " ");
  for (const s of [ORG.fullName, ORG.organizationName, ORG.categoryOther, "دعم تقني وتجهيزات", "+2", ORG.storedPhone, ORG.email.toLowerCase()]) assert(text.includes(s), `row is missing ${s}: ${text}`);
  assert(/\d{4}\/\d{2}\/\d{2}/.test(text), "date");
});

await check("admin: View shows every answer, the timestamp and copy buttons", async () => {
  await admin.locator(`[data-testid="partner-row"][data-id="${orgId}"] [data-testid="partner-view"]`).click();
  await admin.waitForURL((u) => u.pathname === `/admin/partners/${orgId}`);
  const d = admin.getByTestId("partner-details");
  const text = (await d.innerText()).replace(/\s+/g, " ");
  for (const s of [ORG.fullName, ORG.organizationName, "أخرى", ORG.categoryOther, ORG.jobTitle, ORG.storedPhone, ORG.email.toLowerCase(), ORG.city, "دعم تقني وتجهيزات", "إرشاد وخبرات", ORG.supportOther, "الذكاء الاصطناعي", "إنترنت الأشياء (IoT)", ORG.interestOther, "تاريخ الإرسال", "تمت الموافقة في", "العربية"]) {
    assert(text.includes(s), `details are missing ${s}`);
  }
  assert((await admin.getByTestId("detail-proposal").innerText()) === ORG.proposal, "proposal kept as written");
  await admin.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await d.getByRole("button", { name: "نسخ البريد الإلكتروني" }).click();
  await d.getByText("تم النسخ").waitFor();
  assert((await admin.evaluate(() => navigator.clipboard.readText())) === ORG.email.toLowerCase(), "clipboard");
  await admin.getByRole("link", { name: "العودة إلى الشركاء" }).click();
  await admin.waitForURL((u) => u.pathname === "/admin/partners" && u.searchParams.get("q") === ORG.organizationName);
});


await check("admin: search by name, organization and email", async () => {
  await admin.goto(BASE + "/admin/partners");
  for (const q of [`QA Partner ${RUN} Org`, `QA Org ${RUN}`, `qa.partner.${RUN}@`]) {
    await admin.locator("#partner-search").fill(q);
    await admin.waitForURL((u) => u.searchParams.get("q") === q);
    await waitRows(1);
  }
  await admin.locator("#partner-search").fill(`QA Partner ${RUN} nothing-matches`);
  await admin.getByTestId("partners-empty").waitFor();
  await admin.getByText("لا توجد طلبات مطابقة").waitFor();
});

await check("admin: filters by individual vs organization, category, support type and date range", async () => {
  await admin.goto(BASE + `/admin/partners?q=${encodeURIComponent(`QA Partner ${RUN}`)}`);
  await waitRows(7); // org + individual + 5 rate-limit rows
  await admin.locator("#partner-party").selectOption("individual");
  await waitRows(6);
  await admin.locator("#partner-party").selectOption("organization");
  await waitRows(1);
  await admin.locator("#partner-party").selectOption("category:government");
  await admin.getByTestId("partners-empty").waitFor();
  await admin.locator("#partner-party").selectOption("category:other");
  await waitRows(1);
  await admin.locator("#partner-party").selectOption("");
  await admin.locator("#partner-support").selectOption("financial");
  await waitRows(1);
  await admin.locator("#partner-support").selectOption("");
  await waitRows(7);
  // Date range through the picker: today includes them, an old range excludes them.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  await admin.getByTestId("period-trigger").click();
  await admin.locator('[data-testid="period-popover"] input[name="from"]').fill(today);
  await admin.locator('[data-testid="period-popover"] input[name="to"]').fill(today);
  await admin.getByTestId("period-apply").click();
  await admin.waitForURL((u) => u.searchParams.get("from") === today && u.searchParams.get("to") === today);
  await waitRows(7);
  await admin.goto(BASE + `/admin/partners?q=${encodeURIComponent(`QA Partner ${RUN}`)}&from=2020-01-01&to=2020-12-31`);
  await admin.getByTestId("partners-empty").waitFor();
  await admin.getByRole("link", { name: "مسح عوامل التصفية" }).click();
  await admin.waitForURL((u) => u.pathname === "/admin/partners" && !u.search);
});

await check("admin: pagination and page size", async () => {
  // Twelve more applications (direct inserts, like twelve visitors).
  for (let i = 1; i <= 12; i++) {
    await sql`
      insert into partner_applications (partner_type, full_name, phone, email, city, support_types, interest_fields, proposal, consent_at, locale, client_token, ip_hash, created_at)
      values ('individual', ${`QA Partner ${RUN} Bulk ${String(i).padStart(2, "0")}`}, '0501112233', ${`bulk${i}.${RUN}@example.com`}, 'Riyadh',
              array['training'], array['software_engineering'], 'Bulk application for pagination.', now(), 'ar', gen_random_uuid(), 'qa', now() - (${i} || ' minutes')::interval)`;
  }
  await admin.goto(BASE + `/admin/partners?q=${encodeURIComponent(`QA Partner ${RUN} Bulk`)}`);
  await waitRows(10);
  assert((await admin.getByTestId("partners-range").innerText()).replace(/\s+/g, " ") === "1 - 10 من 12 طلبات", await admin.getByTestId("partners-range").innerText());
  // Newest first.
  assert((await admin.locator('[data-testid="partner-row"]').first().innerText()).includes("Bulk 01"), "order");
  await admin.getByTestId("partners-pagination").getByRole("link", { name: "الصفحة التالية" }).click();
  await admin.waitForURL((u) => u.searchParams.get("page") === "2");
  await waitRows(2);
  assert((await admin.getByTestId("partners-range").innerText()).includes("11 - 12 من 12"), "page 2 range");
  await admin.locator("#partner-page-size").selectOption("20");
  await admin.waitForURL((u) => u.searchParams.get("size") === "20" && !u.searchParams.get("page"));
  await waitRows(12);
  assert((await rowCount()) === 12, "page size 20");
});

await check("admin: Partners page switches AR ⇄ EN immediately, in place", async () => {
  await admin.goto(BASE + "/admin/partners");
  await admin.evaluate(() => (window.__marker = true));
  await admin.locator('[role="group"] button').filter({ hasText: "EN" }).first().click();
  await admin.waitForFunction(() => document.documentElement.lang === "en" && document.querySelector("main h1")?.innerText.includes("Partners"), null, { timeout: 8000 });
  assert(await admin.evaluate(() => window.__marker === true && document.documentElement.dir === "ltr"), "reloaded or wrong direction");
  await admin.getByText("Manage requests to join Athar Platform as a partner").waitFor();
  await admin.locator('[role="group"] button').filter({ hasText: "العربية" }).first().click();
  await admin.waitForFunction(() => document.documentElement.lang === "ar" && document.querySelector("main h1")?.innerText.includes("الشركاء"), null, { timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Small screens
// ---------------------------------------------------------------------------

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["tablet", { width: 820, height: 1180 }],
  ["desktop", { width: 1280, height: 800 }],
]) {
  await check(`${name}: landing, form and admin Partners fit the screen`, async () => {
    const { context, page } = await newPage("ar", { viewport });
    await page.goto(BASE + "/");
    assert(await noHorizontalScroll(page), "landing scrolls sideways");
    await page.getByTestId("landing-partners").click();
    await page.waitForURL((u) => u.pathname === "/partners");
    assert(await noHorizontalScroll(page), "form scrolls sideways");
    await page.locator('[data-partner-type="organization"]').click();
    await page.getByTestId("organization-fields").waitFor();
    assert(await noHorizontalScroll(page), "form with organization fields scrolls sideways");
    await context.close();
    await admin.setViewportSize(viewport);
    await admin.goto(BASE + "/admin/partners");
    await admin.getByTestId("partners-table").waitFor();
    assert(await noHorizontalScroll(admin), "admin page scrolls sideways");
  });
}

await check("no browser errors (hydration or otherwise)", async () => {
  assert(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await adminContext.close();
await browser.close();
await cleanup();
await sql.end();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
