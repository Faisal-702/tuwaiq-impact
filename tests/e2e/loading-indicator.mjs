/**
 * Shared loading animation (public/lottie/loading.json).
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_VERIFICATION_CODE=… \
 *     node --env-file-if-exists=.env.local tests/e2e/loading-indicator.mjs
 *
 * Slow pages are simulated in the browser by holding back the page data
 * (RSC) responses, so the checks work against any server. Depending on
 * whether the page's loading state was prefetched (production, on hover), a
 * slow navigation shows the route loader (loading.tsx) or the navigation
 * loader; the checks accept either, but always exactly one.
 */
import { chromium } from "playwright";
import { adminCredentials, adminLogin, ensureStudentCode, randomClientIp, studentLogin } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = adminCredentials();
const SLOW_MS = 1500;

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
async function open(lang, { reducedMotion = "no-preference", viewport = { width: 1440, height: 1000 } } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, extraHTTPHeaders: { "x-forwarded-for": randomClientIp() } });
  await context.addCookies([{ name: "ti_lang", value: lang, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}
/** Holds back page-data responses for matching URLs (simulates a slow server). */
async function slowDown(page, match = () => true) {
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (r.headers()["rsc"] && !r.headers()["next-router-prefetch"] && match(r.url())) await new Promise((res) => setTimeout(res, SLOW_MS));
    await route.continue();
  });
}
/** Samples, every animation frame, whether a loading animation is visible. Call stop() to get the result. */
async function watchLoader(page) {
  await page.evaluate(() => {
    window.__loader = { seen: false, svg: false, firstAt: null, t0: performance.now() };
    const tick = () => {
      if (!window.__loader) return;
      for (const el of document.querySelectorAll('[data-testid="loading-animation"]')) {
        let node = el, opacity = 1;
        while (node && node !== document.body) {
          opacity *= Number(getComputedStyle(node).opacity);
          node = node.parentElement;
        }
        const box = el.getBoundingClientRect();
        if (opacity > 0.05 && box.width > 0) {
          window.__loader.seen = true;
          window.__loader.firstAt ??= Math.round(performance.now() - window.__loader.t0);
          if (el.querySelector("svg")) window.__loader.svg = true;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return async () => page.evaluate(() => { const r = window.__loader; window.__loader = null; return r; });
}
/** Hovers a link long enough for its loading state to be prefetched, then clicks it. */
async function hoverAndClick(page, link) {
  await link.hover();
  await page.waitForTimeout(800);
  await link.click();
}
/** Waits until no route loading state is on screen (the page has finished loading). */
const settled = (page) => page.waitForFunction(() => !document.querySelector('[data-testid="page-loading"]'), null, { timeout: 30000 });
/** The loader shown for the current wait (route or navigation), once its animation is rendered. */
async function currentLoader(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="page-loading"] svg, [data-testid="navigation-loading"] svg'));
  return page.evaluate(() => {
    const route = document.querySelector('[data-testid="page-loading"]');
    const host = route ?? document.querySelector('[data-testid="navigation-loading"]');
    const anim = host.querySelector('[data-testid="loading-animation"]').getBoundingClientRect();
    const area = route ? route.getBoundingClientRect() : { x: 0, width: innerWidth };
    return {
      kind: route ? "route" : "navigation",
      role: host.getAttribute("role"),
      label: host.innerText,
      count: document.querySelectorAll('[data-testid="page-loading"], [data-testid="navigation-loading"]').length,
      size: Math.max(anim.width, anim.height),
      offCenter: Math.abs(anim.x + anim.width / 2 - (area.x + area.width / 2)),
    };
  });
}
const visibleLoaders = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="loading-animation"]')].filter((el) => el.getBoundingClientRect().width > 0).length);

// ---------------------------------------------------------------------------
const admin = await open("en");
await adminLogin(admin.page, BASE, ADMIN);
const A = admin.page;

await check("Fast admin navigation never flashes the loader", async () => {
  await A.goto(BASE + "/admin");
  await settled(A);
  for (const name of ["Students", "Categories", "Trash", "Overview"]) {
    const stop = await watchLoader(A);
    await A.locator("aside").getByRole("link", { name, exact: true }).click();
    await A.locator("main h1").filter({ hasText: name === "Overview" ? "Overview" : name }).first().waitFor();
    await A.waitForTimeout(300);
    const r = await stop();
    assert(!r.seen, `loader shown navigating to ${name} (at ${r.firstAt} ms)`);
  }
});

await check("Slow admin navigation (not prefetched): the navigation loader shows, then the page", async () => {
  await slowDown(A);
  await A.goto(BASE + "/admin/categories");
  const stop = await watchLoader(A);
  const t0 = Date.now();
  await A.locator("aside").getByRole("link", { name: "Analytics", exact: true }).click();
  await A.locator("main h1").filter({ hasText: "Analytics" }).waitFor({ timeout: 15000 });
  const r = await stop();
  await A.unrouteAll({ behavior: "ignoreErrors" });
  assert(r.seen && r.svg, `animation not shown (${JSON.stringify(r)})`);
  assert(r.firstAt >= 350, `shown too early: ${r.firstAt} ms`);
  assert((await visibleLoaders(A)) === 0, "loader still visible after the page loaded");
  assert(Date.now() - t0 >= SLOW_MS, "navigation was not slowed down");
});

await check("Slow admin page (hovered first): one centered, labelled loader", async () => {
  await slowDown(A);
  await A.goto(BASE + "/admin");
  await settled(A);
  await hoverAndClick(A, A.locator("aside").getByRole("link", { name: "Settings", exact: true }));
  const l = await currentLoader(A);
  assert(l.count === 1, `${l.count} loaders`);
  assert(l.role === "status" && l.label.includes("Loading"), "no status role / label");
  assert(l.size <= 100, `too big: ${l.size}px`);
  assert(l.offCenter < 40, `not centered (${l.kind} loader off by ${l.offCenter}px)`);
  await A.locator("main h1").filter({ hasText: "Settings" }).waitFor({ timeout: 15000 });
  await A.unrouteAll({ behavior: "ignoreErrors" });
});
await admin.context.close();

// Public site (student session), Arabic RTL.
const code = await ensureStudentCode(browser, { base: BASE, admin: ADMIN });
for (const lang of ["ar", "en"]) {
  const s = await open(lang);
  await studentLogin(s.page, BASE, code);
  const P = s.page;
  const L = lang === "ar" ? { projects: "استكشف المشاريع", students: "الطلاب" } : { projects: "Explore Projects", students: "Students" };

  await check(`${lang.toUpperCase()} · fast public navigation never flashes the loader`, async () => {
    await settled(P);
    for (const name of [L.projects, L.students]) {
      const stop = await watchLoader(P);
      await P.locator("header nav").getByRole("link", { name, exact: true }).click();
      await P.waitForFunction(() => !document.querySelector('[data-testid="page-loading"]'));
      await P.waitForTimeout(400);
      const r = await stop();
      assert(!r.seen, `loader shown (at ${r.firstAt} ms)`);
    }
  });

  await check(`${lang.toUpperCase()} · slow public list page: one centered loader`, async () => {
    await slowDown(P);
    await P.goto(BASE + "/home");
    await settled(P);
    const stop = await watchLoader(P);
    await hoverAndClick(P, P.locator("header nav").getByRole("link", { name: L.projects, exact: true }));
    const l = await currentLoader(P);
    assert(l.count === 1, `${l.count} loaders`);
    assert(l.offCenter < 40, `not centered (${l.kind} loader off by ${l.offCenter}px)`);
    await P.waitForURL((u) => u.pathname === "/projects", { timeout: 15000 });
    await settled(P);
    const r = await stop();
    await P.unrouteAll({ behavior: "ignoreErrors" });
    assert(r.seen && r.svg, "animation not shown");
  });

  await check(`${lang.toUpperCase()} · slow page without a route loading state (project page): navigation loader`, async () => {
    await slowDown(P, (url) => new URL(url).pathname.startsWith("/projects/"));
    await P.goto(BASE + "/projects");
    const href = await P.locator('main a[href^="/projects/"]').first().getAttribute("href");
    const stop = await watchLoader(P);
    // A click without hovering first (as on a touch screen): nothing was prefetched.
    await P.evaluate((h) => document.querySelector(`main a[href="${h}"]`).click(), href);
    await P.locator('[data-testid="navigation-loading"]').waitFor({ timeout: 5000 });
    await P.waitForURL((u) => u.pathname === href, { timeout: 15000 });
    await P.locator('[data-testid="navigation-loading"]').waitFor({ state: "detached" });
    const r = await stop();
    await P.unrouteAll({ behavior: "ignoreErrors" });
    assert(r.seen && r.svg, "animation not shown");
  });
  await s.context.close();
}

await check("Reduced motion: the animation is shown still", async () => {
  const s = await open("en", { reducedMotion: "reduce" });
  await adminLogin(s.page, BASE, ADMIN);
  await slowDown(s.page);
  await s.page.goto(BASE + "/admin");
  await settled(s.page);
  await hoverAndClick(s.page, s.page.locator("aside").getByRole("link", { name: "Analytics", exact: true }));
  await currentLoader(s.page);
  const svg = s.page.locator('[data-testid="loading-animation"] svg').first();
  await s.page.waitForTimeout(150);
  const a = await svg.innerHTML();
  await s.page.waitForTimeout(400);
  const b = await svg.innerHTML().catch(() => a);
  assert(a === b, "animation is playing");
  await s.context.close();
});

await check("The player is not part of the first page load (loaded on demand, or when idle)", async () => {
  const s = await open("en");
  const scripts = [];
  s.page.on("response", (r) => r.request().resourceType() === "script" && scripts.push(r));
  await s.page.goto(BASE + "/welcome", { waitUntil: "domcontentloaded" });
  const dev = await s.page.evaluate(() => [...document.scripts].some((x) => x.src.includes("next-devtools")));
  if (dev) {
    console.log("      (skipped: the dev server bundles differently)");
  } else {
    const early = [...scripts];
    for (const r of early) {
      const body = await r.text().catch(() => "");
      assert(!body.includes("bodymovin"), `player loaded with the page: ${r.url()}`);
    }
    // ...but it is fetched once the page is idle, so the first loader is ready.
    await s.page.waitForResponse((r) => r.url().endsWith("/lottie/loading.json"), { timeout: 15000 });
  }
  await s.context.close();
});

await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
