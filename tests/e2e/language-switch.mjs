/**
 * Language switching (EN ⇄ العربية) without a manual refresh.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/language-switch.mjs
 *
 * For each kind of page (entry, student pages, admin pages) the switch must
 * update the text, the direction, `lang` and the tab title without reloading
 * the page, and the page must never show one language in the other's
 * direction while it switches. The choice must hold when navigating (also to
 * pages prefetched in the old language), after a reload and in a new tab.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, randomClientIp, studentSessionCookies } from "./lib/student.mjs";

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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const { cookies: studentCookies } = await studentSessionCookies(browser, { base: BASE, admin: ADMIN, student: "Demo Student A" });

async function newPage(lang, extraCookies = []) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([...extraCookies, { name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to fetch|ERR_ABORTED|net::ERR/.test(m.text())) return;
    errors.push(m.text());
  });
  return { context, page };
}

/** A text on the page that must be in the page's language, per language. */
const PROBES = {
  "/": { selector: "h1", en: "We document our students", ar: "نُوثِّق أفكار طلابنا" },
  "/welcome": { selector: "main header > p", en: "Welcome to", ar: "مرحبًا بكم في" },
  "/home": { selector: "header nav", en: "Explore Projects", ar: "استكشف المشاريع" },
  "/projects": { selector: "main h1", en: "Explore Projects", ar: "استكشف المشاريع" },
  "/students": { selector: "main h1", en: "Students", ar: "الطلاب" },
  "/leaderboard": { selector: "main h1", en: "Leaderboard", ar: "لوحة الصدارة" },
  "/profile": { selector: "main h1", en: "Profile", ar: "الملف الشخصي" },
  "/admin": { selector: "aside nav", en: "Manage Projects", ar: "إدارة المشاريع" },
  "/admin/projects": { selector: "main h1", en: "Manage Projects", ar: "إدارة المشاريع" },
};

/** Current language of the page as seen by the user. */
const read = (page, selector) =>
  page.evaluate((sel) => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    text: document.querySelector(sel)?.innerText.replace(/\s+/g, " ") ?? "",
    title: document.title,
    marker: window.__langSwitchMarker === true,
  }), selector);

/**
 * Clicks the language switch and samples the page until it has switched.
 * Every sample must be consistent: the probe text in the language that
 * `lang` and `dir` announce. The page must not reload.
 */
async function switchTo(page, path, to, timeout = 8000) {
  const probe = PROBES[path];
  await page.evaluate(() => (window.__langSwitchMarker = true));
  const label = to === "en" ? "EN" : "العربية";
  await page.locator('[role="group"] button').filter({ hasText: label }).first().click();
  const end = Date.now() + timeout;
  for (;;) {
    const s = await read(page, probe.selector);
    const expectedDir = s.lang === "ar" ? "rtl" : "ltr";
    assert(s.dir === expectedDir, `lang ${s.lang} with dir ${s.dir}`);
    assert(s.text.includes(probe[s.lang]), `half-switched: lang=${s.lang} but "${s.text.slice(0, 60)}"`);
    if (s.lang === to) {
      assert(s.marker, "the page reloaded");
      return s;
    }
    if (Date.now() > end) throw new Error(`still ${s.lang} after ${timeout} ms`);
    await page.waitForTimeout(50);
  }
}

await check("entry page (signed out): AR → EN → AR, text, direction and title switch in place", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/welcome");
  await page.locator("#student-code").waitFor();
  const en = await switchTo(page, "/welcome", "en");
  assert(en.title.startsWith("Athar Platform"), `title ${en.title}`);
  assert((await page.locator("#student-code").getAttribute("placeholder")) === "Enter student code", "placeholder not English");
  const ar = await switchTo(page, "/welcome", "ar");
  assert(ar.title.startsWith("منصة أثر"), `title ${ar.title}`);
  await context.close();
});

await check("entry page keeps typed input while switching", async () => {
  const { context, page } = await newPage("en");
  await page.goto(BASE + "/welcome?mode=admin");
  await page.locator("#admin-email").fill("someone@example.com");
  await switchTo(page, "/welcome", "ar");
  assert((await page.locator("#admin-email").inputValue()) === "someone@example.com", "typed email lost");
  await context.close();
});

for (const path of ["/home", "/projects", "/students", "/leaderboard", "/profile"]) {
  await check(`student ${path}: AR → EN → AR without reloading`, async () => {
    const { context, page } = await newPage("ar", studentCookies);
    await page.goto(BASE + path);
    await page.locator(PROBES[path].selector).first().waitFor();
    await switchTo(page, path, "en");
    await switchTo(page, path, "ar");
    await context.close();
  });
}

await check("home: switching back and forth five times stays consistent", async () => {
  const { context, page } = await newPage("ar", studentCookies);
  await page.goto(BASE + "/home");
  await page.locator("header nav").waitFor();
  for (let i = 0; i < 5; i++) {
    await switchTo(page, "/home", "en");
    await switchTo(page, "/home", "ar");
  }
  await context.close();
});

await check("navigation after switching keeps the language (also for pages prefetched before)", async () => {
  const { context, page } = await newPage("ar", studentCookies);
  await page.goto(BASE + "/home");
  // Hovering prefetches these pages in Arabic before the switch.
  for (const href of ["/projects", "/students", "/leaderboard"]) {
    await page.locator(`header a[href="${href}"]`).first().hover();
    await page.waitForTimeout(300);
  }
  await switchTo(page, "/home", "en");
  for (const href of ["/projects", "/students", "/leaderboard"]) {
    await page.locator(`header a[href="${href}"]`).first().click();
    await page.waitForURL((u) => u.pathname === href);
    await page.waitForFunction(
      ({ sel, text }) => document.querySelector(sel)?.innerText.includes(text),
      { sel: PROBES[href].selector, text: PROBES[href].en },
      { timeout: 8000 },
    );
    const s = await read(page, PROBES[href].selector);
    assert(s.lang === "en" && s.dir === "ltr", `${href}: ${s.lang}/${s.dir}`);
  }
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/students");
  const back = await read(page, PROBES["/students"].selector);
  assert(back.lang === "en" && back.text.includes("Students"), "back button showed the old language");
  await context.close();
});

await check("the choice survives a reload and a new tab", async () => {
  const { context, page } = await newPage("ar", studentCookies);
  await page.goto(BASE + "/home");
  await switchTo(page, "/home", "en");
  await page.reload();
  let s = await read(page, "header nav");
  assert(s.lang === "en" && s.text.includes("Explore Projects"), "reload lost the choice");
  const second = await context.newPage();
  await second.goto(BASE + "/projects");
  s = await read(second, "main h1");
  assert(s.lang === "en" && s.dir === "ltr" && s.text.includes("Explore Projects"), "new tab lost the choice");
  assert((await context.cookies()).find((c) => c.name === "ti_lang")?.expires > Date.now() / 1000 + 300 * 86400, "preference cookie is not long-lived");
  await context.close();
});

await check("admin dashboard and pages: EN → AR → EN without reloading", async () => {
  const { context, page } = await newPage("en");
  await adminLogin(page, BASE, ADMIN);
  await switchTo(page, "/admin", "ar");
  await switchTo(page, "/admin", "en");
  await page.goto(BASE + "/admin/projects");
  await switchTo(page, "/admin/projects", "ar");
  await page.locator('aside a[href="/admin"]').first().click();
  await page.waitForURL((u) => u.pathname === "/admin");
  const s = await read(page, "aside nav");
  assert(s.lang === "ar" && s.text.includes("إدارة المشاريع"), "admin navigation lost Arabic");
  await switchTo(page, "/admin", "en");
  await context.close();
});

await check("slow server: never half-switched, switch shows the choice at once, loader appears", async () => {
  const { context, page } = await newPage("ar", studentCookies);
  await page.goto(BASE + "/home");
  await page.locator("header nav").waitFor();
  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const loaderSeen = page.locator('[data-testid="navigation-loading"]').waitFor({ timeout: 4000 }).then(() => true, () => false);
  // The switch reflects the choice right after the click, long before the server answers.
  const pressedEn = page
    .waitForFunction(() => document.querySelector('[role="group"] button[aria-pressed="true"]')?.textContent === "EN", null, { timeout: 600 })
    .then(() => true, () => false);
  await switchTo(page, "/home", "en", 10000);
  assert(await pressedEn, "the switch did not show the choice while waiting");
  assert(await loaderSeen, "no loading indicator during a slow switch");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
});

/** The landing page's wordmark as drawn: its language, accessible name, box and the headline under it. */
const wordmark = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('[data-testid="landing-hero"] [data-testid="athar-wordmark"]');
    const box = svg.getBoundingClientRect();
    return {
      locale: svg.dataset.locale,
      name: svg.getAttribute("aria-label"),
      paths: svg.querySelectorAll("path").length,
      viewBox: svg.getAttribute("viewBox"),
      height: Math.round(box.height),
      width: Math.round(box.width),
      fits: box.right <= document.documentElement.clientWidth && box.left >= 0,
      h1Top: Math.round(document.querySelector("h1").getBoundingClientRect().top),
    };
  });

await check("landing: the wordmark follows the language (أثـ — ـر ⇄ Atha-r) in place, after a reload and back", async () => {
  const { context, page } = await newPage("ar");
  await page.goto(BASE + "/");
  await page.locator('[data-testid="athar-wordmark"]').waitFor();
  const ar = await wordmark(page);
  assert(ar.locale === "ar" && ar.name === "أثر" && ar.paths === 6 && ar.viewBox === "0 -984 2478 1246.9", `Arabic wordmark ${JSON.stringify(ar)}`);
  await switchTo(page, "/", "en");
  const en = await wordmark(page);
  assert(en.locale === "en" && en.name === "Athar" && en.paths === 6 && en.viewBox === "0 -984 2810 1246.9", `English wordmark ${JSON.stringify(en)}`);
  // Same height (one baseline): switching never moves the text below it.
  assert(en.height === ar.height && en.fits, `English wordmark box ${JSON.stringify(en)} vs Arabic ${JSON.stringify(ar)}`);
  await page.reload();
  const reloaded = await wordmark(page);
  assert(reloaded.locale === "en" && reloaded.h1Top === en.h1Top, `after reload ${JSON.stringify(reloaded)}`);
  await switchTo(page, "/", "ar");
  const back = await wordmark(page);
  assert(back.locale === "ar" && back.viewBox === ar.viewBox && back.h1Top === ar.h1Top, `back to Arabic ${JSON.stringify(back)}`);
  await context.close();
});

/** Clicks Back to Home on /welcome and checks it lands (and stays) on the public landing page. */
async function backHome(page, lang) {
  const link = page.getByTestId("welcome-back-home");
  assert((await link.innerText()).trim() === (lang === "en" ? "Back to Home" : "العودة للرئيسية"), `label ${await link.innerText()}`);
  assert((await link.getAttribute("href")) === "/", "not a link to the landing page");
  await link.click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.getByTestId("landing-hero").waitFor();
  await page.waitForTimeout(800);
  assert(new URL(page.url()).pathname === "/", `redirected away to ${page.url()}`);
  assert((await page.evaluate(() => document.documentElement.lang)) === lang, "landing page in the wrong language");
}

await check("welcome: Back to Home sits in the start corner, its arrow pointing back, clear of the switch and logos", async () => {
  for (const [lang, viewport] of [["ar", { width: 1440, height: 900 }], ["en", { width: 1440, height: 900 }], ["ar", { width: 390, height: 844 }], ["en", { width: 390, height: 844 }], ["ar", { width: 700, height: 900 }], ["en", { width: 700, height: 900 }]]) {
    const { context, page } = await newPage(lang);
    await page.setViewportSize(viewport);
    await page.goto(BASE + "/welcome");
    await page.getByTestId("welcome-back-home").waitFor();
    const m = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect().toJSON();
      const link = document.querySelector('[data-testid="welcome-back-home"]');
      return {
        link: r(link),
        sw: r(document.querySelector('[role="group"][aria-label]')),
        logos: [...document.querySelectorAll("main img")].slice(0, 2).map(r),
        card: r(document.querySelector('section[aria-labelledby="entry-title"]')),
        arrow: getComputedStyle(link.querySelector("svg")).rotate,
        vw: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
    const where = `${lang} ${viewport.width}px`;
    if (lang === "ar") assert(m.vw - m.link.right <= 40 && m.link.top <= 40, `${where}: not in the top-right corner ${JSON.stringify(m.link)}`);
    else assert(m.link.left <= 40 && m.link.top <= 40, `${where}: not in the top-left corner ${JSON.stringify(m.link)}`);
    assert((lang === "en") === /180/.test(m.arrow), `${where}: arrow rotate=${m.arrow}`);
    assert(apart(m.link, m.sw) && m.logos.every((l) => apart(m.link, l)) && apart(m.link, m.card), `${where}: overlaps ${JSON.stringify(m)}`);
    assert(m.overflow === 0 && m.link.height >= 40, `${where}: overflow ${m.overflow}, height ${m.link.height}`);
    await context.close();
  }
});

await check("welcome: Back to Home goes to the landing page (from the landing page, opened directly, after switching mode, language and reloading)", async () => {
  // From the landing page's Sign in button.
  let { context, page } = await newPage("ar");
  await page.goto(BASE + "/");
  await page.getByTestId("hero-login").click();
  await page.waitForURL((u) => u.pathname === "/welcome");
  await backHome(page, "ar");
  await context.close();
  // /welcome opened directly in a new tab (nothing on the site to go back to).
  ({ context, page } = await newPage("en"));
  await page.goto(BASE + "/welcome");
  await backHome(page, "en");
  await context.close();
  // Admin mode, then Arabic, then a reload; also when redirected here from a protected page.
  ({ context, page } = await newPage("en"));
  await page.goto(BASE + "/projects");
  await page.waitForURL((u) => u.pathname === "/welcome");
  await page.getByRole("tab", { name: "Admin Access" }).click();
  await page.locator("#admin-email").waitFor();
  await switchTo(page, "/welcome", "ar");
  assert((await page.getByTestId("welcome-back-home").innerText()).trim() === "العودة للرئيسية", "label did not switch to Arabic");
  await page.reload();
  await page.getByRole("tab", { name: "دخول الطالب" }).click();
  await backHome(page, "ar");
  await context.close();
});

await check("no browser errors (hydration or otherwise)", async () => {
  assert(errors.length === 0, errors.slice(0, 3).join(" | "));
});

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
