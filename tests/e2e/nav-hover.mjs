/**
 * Top navigation hover interaction (desktop only).
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/nav-hover.mjs
 *   MEASURE_ONLY=1 … prints nav item boxes (for before/after layout comparison)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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

const TEAL_DEEP = "rgb(15, 118, 110)";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

async function open(lang, viewport = { width: 1440, height: 900 }, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  await context.addCookies([
    { name: "ti_lang", value: lang, url: BASE },
    { name: "ti_visit", value: "1", url: BASE },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page };
}

const desktopLinks = (page) => page.locator("header nav").first().locator("a");

/** Computed visual state of one nav link (after transitions settle). */
async function state(link) {
  return link.evaluate((a) => {
    const cs = (el) => getComputedStyle(el);
    const pill = a.querySelector(".nav-link__pill");
    const label = a.querySelector(".nav-link__label");
    const line = a.querySelector(".nav-link__line");
    const m = (t) => (t === "none" ? [1, 0, 0, 1, 0, 0] : t.match(/-?[\d.]+/g).map(Number));
    return {
      color: cs(a).color,
      pillOpacity: Number(cs(pill).opacity),
      pillScale: m(cs(pill).transform)[0],
      pillBg: cs(pill).backgroundImage,
      labelY: m(cs(label).transform)[5],
      lineOpacity: Number(cs(line).opacity),
      lineScaleX: m(cs(line).transform)[0],
      lineColor: cs(line).backgroundColor,
      lineOrigin: cs(line).transformOrigin,
      duration: cs(pill).transitionDuration,
    };
  });
}

async function measure(lang) {
  const { context, page } = await open(lang);
  await page.goto(BASE + "/projects");
  const boxes = await desktopLinks(page).evaluateAll((as) =>
    as.map((a) => {
      const r = a.getBoundingClientRect();
      return [a.textContent.trim(), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }),
  );
  const header = await page.locator("header").first().evaluate((h) => h.getBoundingClientRect().height);
  await context.close();
  return { boxes, header };
}

if (process.env.MEASURE_ONLY) {
  console.log(JSON.stringify({ en: await measure("en"), ar: await measure("ar") }));
  await browser.close();
  process.exit(0);
}

for (const lang of ["en", "ar"]) {
  const L = lang.toUpperCase();
  const { context, page } = await open(lang);
  await page.goto(BASE + "/projects"); // "Explore Projects" is the current page
  const links = desktopLinks(page);
  const count = await links.count();

  await check(`${L} · desktop nav has 5 items, document dir correct`, async () => {
    assert(count === 5, `found ${count}`);
    const dir = await page.evaluate(() => document.documentElement.dir);
    assert(dir === (lang === "ar" ? "rtl" : "ltr"), dir);
  });

  await check(`${L} · resting state: inactive items show no pill/underline`, async () => {
    await page.mouse.move(5, 600);
    await page.waitForTimeout(400);
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      if ((await link.getAttribute("aria-current")) === "page") continue;
      const s = await state(link);
      assert(s.pillOpacity === 0 && s.lineOpacity === 0 && s.lineScaleX === 0, `item ${i}: ${JSON.stringify(s)}`);
    }
  });

  await check(`${L} · current page has a calmer persistent indicator`, async () => {
    const active = page.locator('header nav a[aria-current="page"]').first();
    const s = await state(active);
    assert(s.color === TEAL_DEEP, s.color);
    assert(s.pillOpacity > 0.4 && s.pillOpacity < 0.8, `pill ${s.pillOpacity}`);
    assert(s.lineScaleX === 1 && s.lineOpacity < 1, `line ${s.lineOpacity}/${s.lineScaleX}`);
    assert(s.labelY === 0, "active label should not lift at rest");
  });

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const label = (await link.innerText()).trim();
    await check(`${L} · hover "${label}"`, async () => {
      await link.hover();
      await page.waitForTimeout(450);
      const s = await state(link);
      assert(s.color === TEAL_DEEP, `text ${s.color}`);
      assert(s.pillOpacity === 1 && s.pillScale === 1, `pill ${s.pillOpacity}/${s.pillScale}`);
      assert(s.pillBg.includes("rgb(223, 248, 244)"), `pill bg ${s.pillBg}`);
      assert(s.labelY <= -1 && s.labelY >= -2, `lift ${s.labelY}`);
      assert(s.lineOpacity === 1 && s.lineScaleX === 1, `line ${s.lineOpacity}/${s.lineScaleX}`);
      assert(s.lineColor === "rgb(20, 184, 166)", `line color ${s.lineColor}`);
      assert(/50%/.test(s.lineOrigin) || s.lineOrigin.split(" ")[0] !== "0px", `origin ${s.lineOrigin}`);
      assert(s.duration.split(",").every((d) => d.trim() === "0.26s"), `duration ${s.duration}`);

      // Other items stay calm while this one is hovered.
      for (let j = 0; j < count; j++) {
        if (j === i) continue;
        const o = await state(links.nth(j));
        assert(o.labelY === 0 && o.pillOpacity < 1, `item ${j} reacted to hovering ${i}`);
      }

      // Mouse leaves → returns smoothly to its resting state.
      await page.mouse.move(5, 600);
      await page.waitForTimeout(450);
      const r = await state(link);
      const isActive = (await link.getAttribute("aria-current")) === "page";
      assert(r.labelY === 0, `lift after leave ${r.labelY}`);
      if (isActive) assert(r.pillOpacity < 0.8 && r.lineOpacity < 1, "active did not calm down");
      else assert(r.pillOpacity === 0 && r.lineScaleX === 0, `did not reset: ${JSON.stringify(r)}`);
    });
  }

  await check(`${L} · transition is mid-flight shortly after hover (smooth, not instant)`, async () => {
    const link = links.nth(0);
    await page.mouse.move(5, 600);
    await page.waitForTimeout(400);
    await link.hover();
    await page.waitForTimeout(60);
    const mid = await state(link);
    assert(mid.pillOpacity > 0 && mid.pillOpacity < 1, `pill opacity mid-flight ${mid.pillOpacity}`);
    await page.mouse.move(5, 600);
  });

  await check(`${L} · keyboard focus shows a visible focus ring + highlight`, async () => {
    await page.mouse.move(5, 600);
    const first = links.nth(0);
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
    const f = await first.evaluate((a) => {
      const cs = getComputedStyle(a);
      return { focused: document.activeElement === a, outline: cs.outlineStyle, width: cs.outlineWidth };
    });
    assert(f.focused && f.outline !== "none" && f.width !== "0px", JSON.stringify(f));
    const s = await state(first);
    assert(s.pillOpacity === 1 && s.lineScaleX === 1, "focus highlight missing");
  });

  await check(`${L} · navigation still works (semantic links)`, async () => {
    await page.mouse.move(5, 600);
    await links.nth(2).click();
    await page.waitForURL(/\/students$/);
    const current = await page.locator('header nav a[aria-current="page"]').first().getAttribute("href");
    assert(current === "/students", current);
  });

  await context.close();
}

// Mobile: no hover styling, menu unchanged.
const mobile = await open("en", { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
await check("Mobile · touch device does not match the hover media query", async () => {
  await mobile.page.goto(BASE + "/home");
  const fine = await mobile.page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
  assert(!fine, "touch device matched hover query");
  assert(!(await mobile.page.locator("header nav").first().isVisible()), "desktop nav visible on mobile");
});
await check("Mobile · menu opens and its links are unchanged (no nav-link styling)", async () => {
  await mobile.page.getByRole("button", { name: "Open menu" }).click();
  const menuLinks = mobile.page.locator("#mobile-nav a");
  assert((await menuLinks.count()) >= 5, "menu links missing");
  const classes = await menuLinks.evaluateAll((as) => as.map((a) => a.className));
  assert(classes.every((c) => !c.includes("nav-link")), "mobile links got desktop hover classes");
  await menuLinks.filter({ hasText: "Leaderboard" }).click();
  await mobile.page.waitForURL(/\/leaderboard$/);
});
await mobile.context.close();
await browser.close();

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed · console/page errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log("  " + e));
process.exit(results.every(Boolean) && errors.length === 0 ? 0 : 1);
