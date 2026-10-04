/**
 * Suggestions: nav item + form (desktop popover, mobile dialog),
 * validation, persistence, admin-only reading. Runs as a signed-in student.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_CODE=… node --env-file-if-exists=.env.local tests/e2e/suggestions.mjs
 *
 * With DATABASE_URL set (e.g. from .env.local) it also checks the stored rows,
 * the table's RLS/grants and the rate limit, and removes the rows it created
 * (only rows carrying this run's unique marker).
 */
import { chromium } from "playwright";
import { studentSessionCookies } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
if (!CODE) throw new Error("ADMIN_CODE is required");

const RUN = `qa-${Date.now().toString(36)}`;
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

let sql = null;
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import("postgres");
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
}
const rowsForRun = () => sql`select name, grade, suggestion from suggestions where suggestion like ${"%" + RUN + "%"} order by created_at`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
// A distinct client address per run keeps the per-visitor rate limit from
// carrying over between test runs.
const ips = new Map();
const ip = (n) => {
  if (!ips.has(n)) ips.set(n, `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`);
  return ips.get(n);
};
const replayHeaders = (sender) => {
  const h = { ...actionRequest.headers, "x-forwarded-for": sender };
  delete h["content-length"];
  return h;
};

// The platform requires a student session: sign a demo student in once.
const { cookies: studentCookies } = await studentSessionCookies(browser, { base: BASE, adminCode: CODE });

async function open(lang, { viewport = { width: 1440, height: 900 }, guest = true, n = 0, ...extra } = {}) {
  const context = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip(n) }, ...extra });
  const cookies = [{ name: "ti_lang", value: lang, url: BASE }];
  if (guest) cookies.push(...studentCookies);
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}

const STR = {
  en: {
    nav: "Suggestions",
    title: "Send a Suggestion",
    subtitle: "Share your suggestion to help improve Tuwaiq Impact.",
    name: "Name",
    namePh: "Enter your full name",
    grade: "Grade",
    suggestion: "Your suggestion",
    suggestionPh: "Write your suggestion here...",
    submit: "Send Suggestion",
    cancel: "Cancel",
    close: "Close",
    success: "Your suggestion was sent successfully",
    grades: ["Grade 10", "Grade 11", "Grade 12"],
    order: ["Home", "Explore Projects", "Students", "Leaderboard", "Suggestions", "About"],
  },
  ar: {
    nav: "اقتراحات",
    title: "إرسال اقتراح",
    subtitle: "شاركنا اقتراحك لتطوير منصة أثر طويق.",
    name: "الاسم",
    namePh: "أدخل اسمك الكامل",
    grade: "الصف",
    suggestion: "اقتراحك",
    suggestionPh: "اكتب اقتراحك هنا...",
    submit: "إرسال الاقتراح",
    cancel: "إلغاء",
    close: "إغلاق",
    success: "تم إرسال اقتراحك بنجاح",
    grades: ["أولى ثانوي", "ثاني ثانوي", "ثالث ثانوي"],
    order: ["الرئيسية", "استكشف المشاريع", "الطلاب", "لوحة الصدارة", "اقتراحات", "عن المنصة"],
  },
};

/** Captured from a real submission, replayed to probe server-side validation. */
let actionRequest = null;

// ---------------------------------------------------------------------------
// Desktop, English and Arabic
// ---------------------------------------------------------------------------
for (const lang of ["en", "ar"]) {
  const L = lang.toUpperCase();
  const s = STR[lang];
  const { context, page } = await open(lang, { n: lang === "en" ? 1 : 2 });
  await page.goto(BASE + "/home");
  const trigger = page.getByTestId("nav-suggestions");
  const dialog = page.getByRole("dialog", { name: s.title });

  await check(`${L} · nav shows "${s.nav}" between Leaderboard and About; other links unchanged`, async () => {
    const items = await page.locator("header nav").first().locator("li").allInnerTexts();
    assert(JSON.stringify(items.map((t) => t.trim())) === JSON.stringify(s.order), JSON.stringify(items));
    assert((await page.locator("header nav").first().locator("a").count()) === 5, "page links changed");
    assert((await trigger.getAttribute("class")).includes("nav-link"), "not using the shared nav styling");
  });

  await check(`${L} · opens the form without navigating; name field focused`, async () => {
    const before = page.url();
    await trigger.click();
    await dialog.waitFor();
    assert(page.url() === before, `navigated to ${page.url()}`);
    assert((await trigger.getAttribute("aria-expanded")) === "true", "aria-expanded");
    await dialog.getByText(s.subtitle, { exact: true }).waitFor();
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    assert(focused === "name", `focus on ${focused}`);
    for (const [label, ph] of [
      [s.name, s.namePh],
      [s.suggestion, s.suggestionPh],
    ]) {
      const field = dialog.getByLabel(label, { exact: true });
      assert((await field.getAttribute("placeholder")) === ph, `placeholder for ${label}`);
    }
    await dialog.getByRole("button", { name: s.submit }).waitFor();
    await dialog.getByRole("button", { name: s.cancel }).waitFor();
    await dialog.getByRole("button", { name: s.close, exact: true }).waitFor();
    assert((await dialog.getByTestId("suggestion-counter").innerText()).trim() === "0 / 500", "counter");
  });

  await check(`${L} · form follows the page direction`, async () => {
    const dir = await dialog.evaluate((el) => getComputedStyle(el).direction);
    assert(dir === (lang === "ar" ? "rtl" : "ltr"), dir);
    const align = await dialog.getByLabel(s.name, { exact: true }).evaluate((el) => getComputedStyle(el).direction);
    assert(align === dir, `empty input direction ${align}`);
  });

  await check(`${L} · Escape closes and returns focus to the nav item`, async () => {
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await trigger.evaluate((el) => el === document.activeElement), "focus not restored");
    assert((await trigger.getAttribute("aria-expanded")) === "false", "still expanded");
  });

  await check(`${L} · required fields are validated before sending`, async () => {
    await trigger.click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: s.submit }).click();
    const alerts = await dialog.getByRole("alert").count();
    assert(alerts === 3, `expected 3 field errors, got ${alerts}`);
    assert((await dialog.getByLabel(s.name, { exact: true }).getAttribute("aria-invalid")) === "true", "name aria-invalid");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
    assert(focused === "name", `focus on ${focused}`);
    // Whitespace-only is still empty.
    await dialog.getByLabel(s.name, { exact: true }).fill("   ");
    await dialog.getByRole("button", { name: s.submit }).click();
    assert((await dialog.getByRole("alert").count()) === 3, "whitespace accepted");
  });

  await check(`${L} · grade dropdown lists the three grades (stored as 10/11/12)`, async () => {
    await dialog.getByRole("combobox").click();
    const options = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    assert(JSON.stringify(options) === JSON.stringify(s.grades), JSON.stringify(options));
    await page.getByRole("option", { name: s.grades[2] }).click();
    assert((await dialog.getByRole("combobox").innerText()).includes(s.grades[2]), "selection not shown");
    assert(await dialog.isVisible(), "picking a grade closed the form");
  });

  await check(`${L} · suggestion is capped at 500 characters with a live counter`, async () => {
    const box = dialog.getByLabel(s.suggestion, { exact: true });
    await box.fill("abc");
    assert((await dialog.getByTestId("suggestion-counter").innerText()).trim() === "3 / 500", "counter after typing");
    await box.fill("x".repeat(520));
    assert((await box.inputValue()).length === 500, "accepted more than 500");
    assert((await dialog.getByTestId("suggestion-counter").innerText()).trim() === "500 / 500", "counter at limit");
  });

  await check(`${L} · valid suggestion is sent, success shown, form cleared`, async () => {
    if (lang === "en") {
      page.on("request", (r) => {
        if (r.method() === "POST" && r.headers()["next-action"] && !actionRequest)
          actionRequest = { url: r.url(), headers: r.headers(), body: r.postData() };
      });
    }
    const name = lang === "en" ? "QA Visitor" : "زائر الاختبار";
    await dialog.getByLabel(s.name, { exact: true }).fill(name);
    await dialog.getByLabel(s.suggestion, { exact: true }).fill(`${lang === "en" ? "Add a dark gallery view" : "إضافة عرض للمعرض"} ${RUN}`);
    await dialog.getByRole("button", { name: s.submit }).click();
    await dialog.getByRole("status").getByText(s.success, { exact: true }).waitFor({ timeout: 15000 });
    // Close, reopen: a fresh, empty form.
    await dialog.getByRole("button", { name: s.close, exact: true }).first().click();
    await dialog.waitFor({ state: "hidden" });
    await trigger.click();
    await dialog.waitFor();
    assert((await dialog.getByLabel(s.name, { exact: true }).inputValue()) === "", "name not cleared");
    assert((await dialog.getByLabel(s.suggestion, { exact: true }).inputValue()) === "", "suggestion not cleared");
    await dialog.getByRole("button", { name: s.cancel }).click();
    await dialog.waitFor({ state: "hidden" });
  });

  await check(`${L} · navigation and hover still work after using the form`, async () => {
    await page.locator("header nav").first().getByRole("link", { name: s.order[3], exact: true }).click();
    await page.waitForURL(/\/leaderboard$/);
  });
  await context.close();
}

// ---------------------------------------------------------------------------
// Server-side validation, persistence, database access model
// ---------------------------------------------------------------------------
await check("Server rejects invalid payloads sent directly (bypassing the form)", async () => {
  assert(actionRequest, "no server action request captured");
  const original = JSON.parse(actionRequest.body);
  const { context: ctx } = await open("en", { n: 3 });
  const bad = [
    { ...original[0], suggestion: `${"y".repeat(501)} ${RUN}` },
    { ...original[0], grade: 13, suggestion: `bad grade ${RUN}` },
    { ...original[0], name: "   ", suggestion: `no name ${RUN}` },
    { ...original[0], suggestion: "   " },
  ];
  for (const payload of bad) {
    const res = await ctx.request.post(actionRequest.url, {
      headers: replayHeaders(ip(3)),
      data: JSON.stringify([payload]),
    });
    const text = await res.text();
    assert(text.includes('"invalid"'), `not rejected: ${JSON.stringify(payload).slice(0, 80)} → ${text.slice(-120)}`);
  }
  await ctx.close();
  if (sql) {
    const rows = await rowsForRun();
    assert(rows.length === 2, `expected only the 2 valid rows, found ${rows.length}`);
  }
});

if (sql) {
  await check("DB · submissions are stored with the internal grade value", async () => {
    const rows = await rowsForRun();
    assert(rows.length === 2, `rows ${rows.length}`);
    assert(rows[0].name === "QA Visitor" && rows[0].grade === 12, JSON.stringify(rows[0]));
    assert(rows[1].name === "زائر الاختبار" && rows[1].grade === 12, JSON.stringify(rows[1]));
  });

  await check("DB · RLS enabled, no policies, no public-role privileges", async () => {
    const [t] = await sql`select relrowsecurity from pg_class where oid = 'public.suggestions'::regclass`;
    assert(t.relrowsecurity === true, "RLS disabled");
    const [p] = await sql`select count(*)::int as n from pg_policies where schemaname = 'public' and tablename = 'suggestions'`;
    assert(p.n === 0, `${p.n} policies`);
    const grants = await sql`
      select grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'suggestions' and grantee in ('anon', 'authenticated', 'PUBLIC')`;
    assert(grants.length === 0, JSON.stringify(grants));
  });

  await check("DB · constraints reject invalid rows even if validation were bypassed", async () => {
    for (const [name, grade, suggestion] of [
      ["x", 13, "ok"],
      ["", 10, "ok"],
      ["x", 10, "z".repeat(501)],
      ["x", 10, "  "],
    ]) {
      // Inside a transaction that always rolls back: nothing is ever kept.
      const outcome = await sql
        .begin(async (tx) => {
          await tx`insert into suggestions (name, grade, suggestion) values (${name}, ${grade}, ${suggestion})`;
          throw new Error("accepted");
        })
        .catch((e) => e.message);
      assert(outcome !== "accepted", `accepted ${JSON.stringify(name)}/${grade}/${suggestion.length} chars`);
    }
  });

  await check("Rate limit: a visitor cannot flood the table", async () => {
    const { context: ctx } = await open("en", { n: 4 });
    const original = JSON.parse(actionRequest.body);
    const sender = ip(4);
    const outcomes = [];
    for (let i = 0; i < 6; i++) {
      const res = await ctx.request.post(actionRequest.url, {
        headers: replayHeaders(sender),
        data: JSON.stringify([{ ...original[0], suggestion: `flood ${i} ${RUN}` }]),
      });
      outcomes.push((await res.text()).includes('"rate_limited"'));
    }
    await ctx.close();
    await sql`delete from suggestions where suggestion like ${"flood % " + RUN}`;
    assert(outcomes.slice(0, 5).every((x) => !x) && outcomes[5], JSON.stringify(outcomes));
  });
}

// ---------------------------------------------------------------------------
// Admin-only reading
// ---------------------------------------------------------------------------
await check("Student cannot open /admin/suggestions (redirected to /welcome)", async () => {
  const { context, page } = await open("en", { n: 5 });
  await page.goto(BASE + "/admin/suggestions");
  assert(new URL(page.url()).pathname === "/welcome", page.url());
  assert(!(await page.content()).includes(RUN), "suggestion text leaked");
  await context.close();
});

for (const lang of ["en", "ar"]) {
  const L = lang.toUpperCase();
  const A =
    lang === "en"
      ? {
          code: "Access Code",
          enter: "Access Dashboard",
          categories: "Categories",
          nav: "Suggestions",
          title: "Suggestions",
          intro: "View suggestions submitted through the Tuwaiq Impact platform.",
          cols: ["#", "Name", "Grade", "Suggestion", "Submission Date"],
          view: "View suggestion",
          all: "All grades",
        }
      : {
          code: "رمز الدخول",
          enter: "الدخول إلى لوحة التحكم",
          categories: "التصنيفات",
          nav: "الاقتراحات",
          title: "الاقتراحات",
          intro: "عرض جميع الاقتراحات المقدمة من الطلاب عبر منصة أثر طويق.",
          cols: ["#", "الاسم", "الصف", "الاقتراح", "تاريخ الإرسال"],
          view: "عرض الاقتراح",
          all: "جميع الصفوف",
        };
  const { context, page } = await open(lang, { guest: false, n: 6 });
  await check(`${L} · Admin sidebar: "${A.nav}" directly below "${A.categories}"`, async () => {
    await page.goto(BASE + "/welcome?mode=admin");
    await page.getByLabel(A.code).fill(CODE);
    await page.getByRole("button", { name: A.enter }).click();
    await page.waitForURL(BASE + "/admin");
    const items = (await page.locator("aside nav").first().locator("li").allInnerTexts()).map((t) => t.trim());
    const i = items.indexOf(A.categories);
    assert(i >= 0 && items[i + 1] === A.nav, JSON.stringify(items));
  });

  await check(`${L} · Admin page lists submissions newest first`, async () => {
    await page.locator("aside nav").first().getByRole("link", { name: A.nav, exact: true }).click();
    await page.waitForURL(/\/admin\/suggestions$/);
    await page.getByRole("heading", { name: A.title, exact: true }).waitFor();
    await page.getByText(A.intro, { exact: true }).waitFor();
    const heads = (await page.locator("thead th").allInnerTexts()).map((t) => t.trim());
    for (const c of A.cols) assert(heads.includes(c), `missing column ${c} in ${heads}`);
    const rows = page.getByTestId("admin-suggestion-row");
    const first = await rows.nth(0).innerText();
    const second = await rows.nth(1).innerText();
    assert(first.includes("زائر الاختبار") && first.includes(RUN), `first row: ${first}`);
    assert(second.includes("QA Visitor"), `second row: ${second}`);
    assert(first.includes(STR[lang].grades[2]), "grade badge label");
    assert(/\d{1,2}:\d{2}/.test(first), "time missing");
  });

  await check(`${L} · View dialog shows the full suggestion; grade filter works`, async () => {
    const row = page.getByTestId("admin-suggestion-row").filter({ hasText: "QA Visitor" }).first();
    await row.getByRole("button").click();
    await page.getByRole("menuitem", { name: A.view }).click();
    const dlg = page.getByRole("dialog", { name: A.view });
    await dlg.getByText(`Add a dark gallery view ${RUN}`).waitFor();
    await page.keyboard.press("Escape");
    await page.selectOption("#suggestion-grade-filter", "10");
    await page.waitForURL(/grade=10/);
    assert(!(await page.locator("main").innerText()).includes(RUN), "filter did not exclude grade 12 rows");
    await page.selectOption("#suggestion-grade-filter", "");
    await page.waitForURL(/\/admin\/suggestions$/);
  });
  await context.close();
}

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------
const mobile = await open("ar", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, n: 7 });
await check("Mobile · menu item opens the form in a dialog and submits", async () => {
  const { page } = mobile;
  await page.goto(BASE + "/home");
  await page.getByRole("button", { name: "فتح القائمة" }).click();
  const before = await page.locator("#mobile-nav a").count();
  assert(before >= 5, "menu links missing");
  await page.locator("#mobile-nav").getByRole("button", { name: STR.ar.nav }).click();
  const dlg = page.getByRole("dialog", { name: STR.ar.title });
  await dlg.waitFor();
  await page.waitForTimeout(400); // let the open animation settle
  const box = await dlg.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390, `overflows viewport: ${JSON.stringify(box)}`);
  await dlg.getByLabel(STR.ar.name, { exact: true }).fill("طالب الجوال");
  await dlg.getByRole("combobox").click();
  await page.getByRole("option", { name: STR.ar.grades[0] }).click();
  await dlg.getByLabel(STR.ar.suggestion, { exact: true }).fill(`اقتراح من الجوال ${RUN}`);
  await dlg.getByRole("button", { name: STR.ar.submit }).click();
  await dlg.getByText(STR.ar.success, { exact: true }).waitFor({ timeout: 15000 });
  await page.keyboard.press("Escape");
  await dlg.waitFor({ state: "hidden" });
  if (sql) {
    const rows = await rowsForRun();
    assert(rows.some((r) => r.name === "طالب الجوال" && r.grade === 10), "mobile row not stored");
  }
});
await mobile.context.close();
await browser.close();

if (sql) {
  await sql`delete from suggestions where suggestion like ${"%" + RUN + "%"}`;
  await sql.end();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
