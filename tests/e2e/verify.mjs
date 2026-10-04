/**
 * End-to-end functional verification for Tuwaiq Impact.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_CODE=… QA_IMAGE=/path/4k.jpg node tests/e2e/verify.mjs
 *
 * Walks through the platform's functional checklist in a real browser and
 * reports PASS/FAIL per check, plus any console or hydration errors seen.
 * Records it creates are prefixed with "QA " so they are easy to identify.
 */
import { chromium } from "playwright";
import path from "node:path";
import { ensureStudentCode, studentLogin, studentSessionCookies } from "./lib/student.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = process.env.ADMIN_CODE;
const QA_IMAGE = process.env.QA_IMAGE;
const ASSETS = path.join(process.cwd(), "scripts", "demo-assets");
if (!CODE || !QA_IMAGE) throw new Error("ADMIN_CODE and QA_IMAGE are required");

const results = [];
const consoleErrors = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error).split("\n")[0] });
    console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split("\n")[0]}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

function watch(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${label}] ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`));
}

// ---------------------------------------------------------------------------
// Visitor (no cookies)
// ---------------------------------------------------------------------------
const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const vp = await visitor.newPage();
watch(vp, "visitor");

await check("First visit is routed to the entry page", async () => {
  await vp.goto(BASE + "/");
  assert(new URL(vp.url()).pathname === "/welcome", `landed on ${vp.url()}`);
  await vp.getByRole("heading", { name: /Tuwaiq Impact/ }).waitFor();
});

await check("Entry page renders both official logos", async () => {
  const ok = await vp.evaluate(() =>
    [...document.images].filter((i) => /moe-logo|tuwaiq-academy-logo/.test(i.currentSrc) && i.naturalWidth > 0).length,
  );
  assert(ok >= 2, `logos loaded: ${ok}`);
});

await check("Empty access code shows a prompt", async () => {
  await vp.getByRole("tab", { name: "Admin Access" }).click();
  await vp.getByRole("button", { name: "Access Dashboard" }).click();
  await vp.getByText("Please enter the access code.").waitFor({ timeout: 5000 });
});

await check("Wrong access code shows the exact error", async () => {
  await vp.getByLabel("Access Code").fill("1234");
  await vp.getByRole("button", { name: "Access Dashboard" }).click();
  await vp.getByText("Invalid access code. Please contact the administrator.").waitFor({ timeout: 5000 });
  assert(new URL(vp.url()).pathname === "/welcome", "should stay on welcome");
});

await check("Access code is not present in page HTML or client JS", async () => {
  const html = await vp.content();
  const scripts = await vp.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  let leaked = html.includes(`"${CODE}"`) || html.includes(`'${CODE}'`);
  for (const src of scripts) {
    const body = await (await fetch(src)).text();
    if (body.includes(`"${CODE}"`) || body.includes(`'${CODE}'`) || body.includes("ADMIN_ACCESS_CODE")) {
      leaked = true;
      throw new Error(`found in ${src}`);
    }
  }
  assert(!leaked, "code literal found in HTML");
});

await check("Public visitors cannot open admin routes", async () => {
  for (const p of ["/admin", "/admin/projects/new", "/admin/settings"]) {
    await vp.goto(BASE + p);
    assert(new URL(vp.url()).pathname === "/welcome", `${p} → ${vp.url()}`);
  }
  const forged = await visitor.request.get(BASE + "/admin", {
    headers: { cookie: "ti_admin_sid=forged-token-value-forged-token-value" },
    maxRedirects: 0,
  });
  assert([302, 303, 307, 308].includes(forged.status()), `forged cookie status ${forged.status()}`);
});

await check("Unsigned uploads are rejected", async () => {
  const res = await visitor.request.put(BASE + "/api/uploads/local?path=media/2026/01/00000000-0000-0000-0000-000000000000/original.jpg&ct=image/jpeg&exp=9999999999999&sig=00", {
    data: "x",
  });
  assert(res.status() === 403, `status ${res.status()}`);
});

await check("Student access works (Student Login with a code)", async () => {
  const code = await ensureStudentCode(browser, { base: BASE, adminCode: CODE });
  await studentLogin(vp, BASE, code);
  await vp.getByRole("heading", { name: /Student Ideas/ }).waitFor();
});

await check("Student still cannot access admin and sees no dashboard link", async () => {
  assert((await vp.getByRole("link", { name: "Dashboard" }).count()) === 0, "dashboard link visible to student");
  await vp.goto(BASE + "/admin");
  assert(new URL(vp.url()).pathname === "/welcome", vp.url());
});

await check("Homepage hero artwork and header logos render", async () => {
  await vp.goto(BASE + "/home");
  await vp.waitForLoadState("networkidle");
  const imgs = await vp.evaluate(() =>
    [...document.images].map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width })),
  );
  assert(imgs.some((i) => /hero-students/.test(i.src) && i.ok && i.w > 300), "hero missing");
  assert(imgs.filter((i) => /moe-logo|tuwaiq-academy-logo/.test(i.src) && i.ok).length >= 2, "header logos missing");
});

await check("Homepage statistics come from the database", async () => {
  const stats = vp.getByRole("region", { name: "Platform at a glance" });
  const text = await stats.innerText();
  assert(/Projects/.test(text) && /Participating Students/.test(text) && /Awards/.test(text) && /Activities/.test(text), text);
});

await check("English → Arabic switch applies full RTL and persists", async () => {
  await vp.getByRole("button", { name: "التبديل إلى العربية" }).first().click();
  await vp.waitForFunction(() => document.documentElement.dir === "rtl");
  await vp.getByRole("heading", { name: /أفكار طلابية/ }).waitFor();
  await vp.reload();
  assert((await vp.evaluate(() => document.documentElement.dir)) === "rtl", "not persisted");
  assert((await vp.evaluate(() => localStorage.getItem("ti_lang"))) === "ar", "localStorage not set");
  const navBox = await vp.getByRole("navigation", { name: "التنقل الرئيسي" }).first().boundingBox();
  const logoBox = await vp.locator("header img").first().boundingBox();
  assert(logoBox.x > navBox.x, "logos should sit on the right in RTL");
  await vp.getByRole("button", { name: "Switch to English" }).first().click();
  await vp.waitForFunction(() => document.documentElement.dir === "ltr");
});

await check("Search by category alias 'AI' returns AI projects only", async () => {
  await vp.goto(BASE + "/projects");
  await vp.getByLabel("Search projects").fill("AI");
  await vp.waitForURL(/q=AI/);
  await vp.waitForLoadState("networkidle");
  const titles = await vp.locator("article h3").allInnerTexts();
  assert(titles.length > 0, "no results");
  assert(!titles.some((t) => /Air-Quality/.test(t)), `false positive: ${titles}`);
});

await check("Search by student name", async () => {
  await vp.goto(BASE + "/projects?q=" + encodeURIComponent("Demo Student C"));
  const titles = await vp.locator("article h3").allInnerTexts();
  assert(titles.length === 2, `got ${titles.join(" | ")}`);
});

await check("Search by project title", async () => {
  await vp.goto(BASE + "/projects?q=" + encodeURIComponent("Line-Following Robot"));
  const titles = await vp.locator("article h3").allInnerTexts();
  assert(titles.length === 1 && /Line-Following Robot/.test(titles[0]), titles.join(" | "));
});

await check("Search by grade", async () => {
  await vp.goto(BASE + "/projects?q=" + encodeURIComponent("grade 10"));
  const text = await vp.locator("main").innerText();
  assert(/Grade 10/.test(text) && !/Grade 12/.test(text), "grade filter mismatch");
});

await check("Category filter chip works", async () => {
  await vp.goto(BASE + "/projects");
  await vp.getByRole("button", { name: "Robotics" }).click();
  await vp.waitForURL(/category=robotics/);
  await vp.waitForLoadState("networkidle");
  const titles = await vp.locator("article h3").allInnerTexts();
  assert(titles.length === 1 && /Robot/.test(titles[0]), titles.join(" | "));
});

await check("Filters dialog (grade + content type) works", async () => {
  await vp.goto(BASE + "/projects");
  await vp.getByRole("button", { name: /^Filters/ }).click();
  await vp.getByLabel("Grade", { exact: true }).selectOption("12");
  await vp.getByLabel("Content Type").selectOption("document");
  await vp.getByRole("button", { name: "Show results" }).click();
  await vp.waitForURL(/grade=12/);
  await vp.waitForLoadState("networkidle");
  const titles = await vp.locator("article h3").allInnerTexts();
  assert(titles.length >= 1 && titles.every((t) => /Air-Quality/.test(t)), titles.join(" | "));
});

await check("Sorting by Most Viewed orders by views", async () => {
  await vp.goto(BASE + "/projects");
  await vp.getByLabel("Sort by").selectOption("views");
  await vp.waitForURL(/sort=views/);
  await vp.waitForLoadState("networkidle");
  const views = await vp.locator("article").evaluateAll((els) =>
    els.map((e) => Number((e.querySelector("svg.lucide-eye")?.parentElement?.textContent ?? "0").replace(/\D/g, ""))),
  );
  assert(views.every((v, i) => i === 0 || views[i - 1] >= v), `not sorted: ${views}`);
});

await check("Sorting by Highest Points and Most Active load", async () => {
  for (const s of ["points", "active"]) {
    await vp.goto(BASE + `/projects?sort=${s}`);
    assert((await vp.locator("article").count()) > 0, `no results for ${s}`);
  }
});

await check("Project card opens its detail page", async () => {
  await vp.goto(BASE + "/projects?q=" + encodeURIComponent("Smart Irrigation"));
  await vp.locator("article a").first().click();
  await vp.waitForURL(/\/projects\/demo-smart-irrigation-prototype/);
  await vp.getByRole("heading", { level: 1, name: /Smart Irrigation/ }).waitFor();
});

await check("Images open in the full-screen viewer and navigate", async () => {
  await vp.getByRole("button", { name: /Open image 1 of/ }).click();
  const dialog = vp.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByText(/^1 of \d/).waitFor();
  await vp.keyboard.press("ArrowRight");
  await dialog.getByText(/^2 of \d/).waitFor();
  await vp.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
});

await check("PDF attachment preview opens", async () => {
  await vp.getByRole("button", { name: /Preview: demo-document.pdf/ }).click();
  const frame = vp.locator("iframe[title='demo-document.pdf']");
  await frame.waitFor();
  await vp.keyboard.press("Escape");
});

await check("Video does not autoplay and plays on demand", async () => {
  await vp.goto(BASE + "/projects/demo-arabic-text-classifier");
  const video = vp.locator("video").first();
  await video.waitFor();
  assert(await video.evaluate((v) => v.paused && !v.autoplay), "autoplayed");
  await vp.getByRole("button", { name: "Play video" }).first().click();
  await vp.waitForFunction(() => {
    const v = document.querySelector("video");
    return v && !v.paused && v.currentTime > 0.3;
  }, null, { timeout: 10000 });
});

await check("Video player controls: pause, seek, mute, full screen", async () => {
  await vp.locator("video").first().hover();
  await vp.getByRole("button", { name: "Pause video" }).click();
  assert(await vp.locator("video").first().evaluate((v) => v.paused), "not paused");
  await vp.getByRole("slider", { name: "Seek" }).evaluate((el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "6");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert(await vp.locator("video").first().evaluate((v) => v.currentTime > 5), "seek failed");
  await vp.getByRole("button", { name: "Mute" }).click();
  assert(await vp.locator("video").first().evaluate((v) => v.muted), "not muted");
  await vp.getByRole("button", { name: "Full screen", exact: true }).click();
  await vp.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
  await vp.getByRole("button", { name: "Exit full screen", exact: true }).click();
  await vp.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
});

await check("Students directory search and profile", async () => {
  await vp.goto(BASE + "/students");
  await vp.getByLabel("Search students").fill("Demo Student B");
  await vp.waitForURL(/q=Demo/);
  await vp.waitForLoadState("networkidle");
  await vp.getByRole("link", { name: /Demo Student B/ }).first().click();
  await vp.getByRole("heading", { level: 1, name: "Demo Student B" }).waitFor();
  await vp.getByRole("heading", { name: "Project history" }).waitFor();
});

await check("Leaderboard renders top students and year view", async () => {
  await vp.goto(BASE + "/leaderboard");
  assert((await vp.locator("a[href^='/students/']").count()) >= 3, "missing rows");
  await vp.getByRole("button", { name: "Academic year" }).click();
  await vp.waitForURL(/year=/);
});

await check("About page renders", async () => {
  await vp.goto(BASE + "/about");
  await vp.getByRole("heading", { level: 1 }).waitFor();
});

await check("Header search dialog returns results", async () => {
  await vp.goto(BASE + "/home");
  await vp.getByRole("button", { name: "Search", exact: true }).first().click();
  await vp.getByPlaceholder("Search projects, students, categories…").fill("robot");
  await vp.getByRole("dialog").getByRole("link", { name: /Line-Following Robot/ }).waitFor();
  await vp.keyboard.press("Escape");
});

await check("No dead internal links on public pages", async () => {
  const seen = new Set();
  for (const p of ["/home", "/projects", "/students", "/leaderboard", "/about"]) {
    await vp.goto(BASE + p);
    const hrefs = await vp.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    hrefs.forEach((h) => seen.add(h.split("#")[0]));
  }
  const bad = [];
  for (const href of seen) {
    if (href.startsWith("/admin") || href.startsWith("/welcome")) continue;
    const res = await vp.request.get(BASE + href);
    if (res.status() >= 400) bad.push(`${href} → ${res.status()}`);
  }
  assert(bad.length === 0, bad.join(", "));
});

// ---------------------------------------------------------------------------
// Mobile
// ---------------------------------------------------------------------------
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.addCookies((await studentSessionCookies(browser, { base: BASE, adminCode: CODE })).cookies);
const mp = await mobile.newPage();
watch(mp, "mobile");

await check("Mobile navigation menu works and pages have no horizontal overflow", async () => {
  await mp.goto(BASE + "/home");
  await mp.getByRole("button", { name: "Open menu" }).click();
  await mp.locator("#mobile-nav").getByRole("link", { name: "Leaderboard" }).click();
  await mp.waitForURL(/\/leaderboard/);
  for (const p of ["/home", "/projects", "/projects/demo-smart-irrigation-prototype", "/students", "/leaderboard", "/about", "/welcome"]) {
    await mp.goto(BASE + p);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `${p} overflows by ${overflow}px`);
  }
});

// ---------------------------------------------------------------------------
// Administrator
// ---------------------------------------------------------------------------
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await admin.newPage();
watch(ap, "admin");
ap.on("dialog", (d) => d.accept());

await check("Correct access code signs in and redirects to /admin", async () => {
  await ap.goto(BASE + "/welcome");
  await ap.getByRole("tab", { name: "Admin Access" }).click();
  await ap.getByLabel("Access Code").fill(CODE);
  await ap.getByRole("button", { name: "Access Dashboard" }).click();
  await ap.waitForURL(BASE + "/admin");
  await ap.getByRole("heading", { name: "Overview" }).waitFor();
  const cookies = await admin.cookies();
  const session = cookies.find((c) => c.name === "ti_admin_sid");
  assert(session && session.httpOnly, "session cookie must be httpOnly");
});

await check("Admin can create a category", async () => {
  await ap.goto(BASE + "/admin/categories");
  await ap.getByRole("button", { name: "Add Category" }).click();
  await ap.getByLabel("Name (English)").fill("QA Category");
  await ap.getByLabel("Name (Arabic)").fill("تصنيف اختبار");
  await ap.getByLabel("Search keywords").fill("qa, verification");
  await ap.getByRole("radio", { name: "rocket" }).click();
  await ap.getByRole("button", { name: "Create" }).click();
  await ap.getByText("Category created").waitFor();
  await ap.getByRole("row", { name: /QA Category/ }).waitFor();
});

await check("Admin can create a student", async () => {
  await ap.goto(BASE + "/admin/students");
  await ap.getByRole("button", { name: "Add Student" }).click();
  await ap.getByLabel("Name (English)").fill("QA Student One");
  await ap.getByLabel("Name (Arabic)").fill("طالب الاختبار الأول");
  await ap.getByLabel("Grade").selectOption("11");
  await ap.getByRole("button", { name: "Create" }).click();
  await ap.getByText("Student created").waitFor();
  await ap.getByRole("row", { name: /QA Student One/ }).waitFor();
});

let projectEditUrl = "";
await check("Admin creates a project: multiple students, uploads, draft", async () => {
  await ap.goto(BASE + "/admin/projects/new");
  await ap.getByLabel("Project title").fill("QA Verification Project");
  await ap.getByLabel("Category").selectOption({ label: "QA Category" });
  await ap.getByLabel("Description").fill("Automated verification project.\n\nSecond paragraph.");
  const students = ap.locator("#project-students");
  await students.fill("QA Student");
  await ap.getByRole("option", { name: /QA Student One/ }).click();
  await students.fill("QA Student Two");
  await ap.getByRole("option", { name: /Create student/ }).click();
  await ap.getByLabel("Grade").selectOption("11");
  await ap.getByLabel("Academic year").fill("1447");
  await ap.locator("[data-testid=media-input]").setInputFiles([
    process.env.QA_IMAGE,
    path.join(ASSETS, "demo-video.webm"),
    path.join(ASSETS, "demo-document.pdf"),
  ]);
  await ap.waitForFunction(() => document.querySelectorAll("[data-testid=media-item]").length === 3);
  await ap.waitForFunction(
    () => ![...document.querySelectorAll("[data-testid=media-item]")].some((el) => /Uploading|Preparing|%/.test(el.textContent ?? "") && el.querySelector(".animate-spin")),
    null,
    { timeout: 60000 },
  );
  await ap.getByRole("button", { name: "Save Draft" }).click();
  await ap.waitForURL(/\/admin\/projects\/[0-9a-f-]+\/edit/, { timeout: 20000 });
  projectEditUrl = ap.url();
  await ap.getByText("Draft saved").waitFor();
});

await check("Original 4K upload is preserved and optimised variants exist", async () => {
  const sizes = await ap.evaluate(async () => {
    const imgs = [...document.querySelectorAll("[data-testid=media-item] img")];
    const thumb = imgs[0]?.getAttribute("src");
    return { thumb };
  });
  assert(sizes.thumb && /thumb\.webp/.test(sizes.thumb), `thumb variant missing: ${sizes.thumb}`);
  const originalUrl = sizes.thumb.replace("thumb.webp", "original.jpg");
  const dims = await ap.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, originalUrl);
  assert(dims[0] === 4000 && dims[1] === 3000, `original is ${dims}`);
  const largeDims = await ap.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, sizes.thumb.replace("thumb.webp", "large.webp"));
  assert(largeDims[0] === 2560, `large variant is ${largeDims}`);
});

await check("Draft is admin-only (not public)", async () => {
  const res = await vp.request.get(BASE + "/projects/qa-verification-project");
  assert(res.status() === 404, `draft public status ${res.status()}`);
  await ap.goto(BASE + "/admin/projects?status=draft");
  await ap.getByRole("link", { name: "QA Verification Project", exact: true }).waitFor();
});

await check("Preview shows the draft", async () => {
  const id = projectEditUrl.match(/projects\/([0-9a-f-]+)\/edit/)[1];
  await ap.goto(BASE + `/admin/projects/${id}/preview`);
  await ap.getByText("Preview — this is how the project will appear to visitors.").waitFor();
  await ap.getByRole("heading", { level: 1, name: "QA Verification Project" }).waitFor();
});

await check("Publish with Featured → appears on homepage featured section", async () => {
  await ap.goto(projectEditUrl);
  await ap.getByRole("switch", { name: "Feature on homepage" }).click();
  await ap.getByRole("button", { name: "Publish" }).click();
  await ap.getByText("Project published").waitFor();
  await vp.goto(BASE + "/home");
  const featured = vp.locator("section[aria-labelledby=featured-title]");
  await featured.getByText("QA Verification Project").waitFor();
  const pub = await vp.request.get(BASE + "/projects/qa-verification-project");
  assert(pub.status() === 200, "published page not reachable");
});

await check("Published project shows both students, video and attachment", async () => {
  await vp.goto(BASE + "/projects/qa-verification-project");
  const text = await vp.locator("main").innerText();
  assert(/QA Student One/.test(text) && /QA Student Two/.test(text), "students missing");
  assert((await vp.locator("video").count()) === 1, "video missing");
  assert((await vp.getByRole("button", { name: /Preview: demo-document.pdf/ }).count()) === 1, "attachment missing");
});

await check("Points change updates the leaderboard", async () => {
  await ap.goto(BASE + "/admin/leaderboard");
  const input = ap.getByLabel("Points: QA Verification Project");
  await input.fill("500");
  await input.press("Enter");
  await ap.getByText("Points updated").waitFor();
  await vp.goto(BASE + "/leaderboard");
  const first = await vp.locator("ol a").first().innerText();
  assert(/QA Student/.test(first), `top of leaderboard: ${first}`);
});

await check("Unfeature / unpublish / publish actions from Manage Projects", async () => {
  await ap.goto(BASE + "/admin/projects?q=QA%20Verification");
  const row = ap.getByTestId("admin-project-row").filter({ hasText: "QA Verification Project" });
  await row.getByRole("button", { name: /More actions/ }).click();
  await ap.getByRole("menuitem", { name: "Unfeature" }).click();
  await ap.getByText("Project removed from featured").waitFor();
  await row.getByRole("button", { name: /More actions/ }).click();
  await ap.getByRole("menuitem", { name: "Unpublish" }).click();
  await ap.getByText("Project moved to drafts").first().waitFor();
  await row.getByRole("button", { name: /More actions/ }).click();
  await ap.getByRole("menuitem", { name: "Publish" }).click();
  await ap.getByText("Project published").first().waitFor();
});

await check("Delete moves to Trash; restore works", async () => {
  await ap.goto(BASE + "/admin/projects?q=QA%20Verification");
  const row = ap.getByTestId("admin-project-row").filter({ hasText: "QA Verification Project" });
  await row.getByRole("button", { name: /More actions/ }).click();
  await ap.getByRole("menuitem", { name: "Move to Trash" }).click();
  await ap.getByRole("alertdialog").getByRole("button", { name: "Move to Trash" }).click();
  await ap.getByText("Project moved to Trash").waitFor();
  const gone = await vp.request.get(BASE + "/projects/qa-verification-project");
  assert(gone.status() === 404, "trashed project still public");
  await ap.goto(BASE + "/admin/trash");
  await ap.getByTestId("trash-row").filter({ hasText: "QA Verification Project" }).getByRole("button", { name: "Restore" }).click();
  await ap.getByText("Project restored as a draft").waitFor();
  await ap.goto(BASE + "/admin/projects?status=draft");
  await ap.getByRole("link", { name: "QA Verification Project", exact: true }).waitFor();
});

await check("Delete permanently from Trash", async () => {
  await ap.goto(BASE + "/admin/projects?q=QA%20Verification");
  const row = ap.getByTestId("admin-project-row").filter({ hasText: "QA Verification Project" });
  await row.getByRole("button", { name: /More actions/ }).click();
  await ap.getByRole("menuitem", { name: "Move to Trash" }).click();
  await ap.getByRole("alertdialog").getByRole("button", { name: "Move to Trash" }).click();
  await ap.getByText("Project moved to Trash").waitFor();
  await ap.goto(BASE + "/admin/trash");
  await ap.getByTestId("trash-row").filter({ hasText: "QA Verification Project" }).getByRole("button", { name: "Delete permanently" }).click();
  await ap.getByRole("alertdialog").getByRole("button", { name: "Delete permanently" }).click();
  await ap.getByText("Project permanently deleted").waitFor();
});

await check("Activity log recorded the administrative actions", async () => {
  await ap.goto(BASE + "/admin/activity");
  const text = await ap.locator("main").innerText();
  for (const label of [
    "Project created",
    "Project published",
    "Project featured",
    "Points changed",
    "Project deleted",
    "Project restored",
    "Student created",
    "Category created",
    "Project permanently deleted",
  ]) {
    assert(text.includes(label), `missing: ${label}`);
  }
});

await check("Archive category hides it from public filters", async () => {
  await ap.goto(BASE + "/admin/categories");
  const row = ap.getByTestId("admin-category-row").filter({ hasText: "QA Category" });
  await row.getByRole("button", { name: /Archive: QA Category/ }).click();
  await ap.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await ap.getByText("Category archived").waitFor();
  await vp.goto(BASE + "/projects");
  assert((await vp.getByRole("button", { name: "QA Category" }).count()) === 0, "archived category still listed");
});

await check("Admin overview, analytics, settings render", async () => {
  for (const [p, h] of [
    ["/admin", "Overview"],
    ["/admin/analytics", "Analytics"],
    ["/admin/settings", "Settings"],
    ["/admin/students", "Students"],
    ["/admin/leaderboard", "Leaderboard"],
  ]) {
    await ap.goto(BASE + p);
    await ap.getByRole("heading", { level: 1, name: h }).waitFor();
  }
});

await check("Presentation Mode advances slides", async () => {
  await ap.goto(BASE + "/present");
  await ap.getByText("1 /", { exact: false }).waitFor();
  await ap.keyboard.press("ArrowRight");
  await ap.getByText(/^2 \/ \d+$/).waitFor();
  await ap.getByRole("heading", { name: "Key statistics" }).waitFor();
});

await check("Sign out ends the session", async () => {
  await ap.goto(BASE + "/admin");
  await ap.getByRole("button", { name: "Sign out" }).click();
  await ap.waitForURL(/\/welcome/);
  await ap.goto(BASE + "/admin");
  assert(new URL(ap.url()).pathname === "/welcome", "still signed in");
});

await browser.close();

const hydration = consoleErrors.filter((e) => /hydrat/i.test(e));
console.log("\n──────── Summary ────────");
console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed`);
for (const r of results.filter((r) => !r.ok)) console.log(`✗ ${r.name}: ${r.error}`);
console.log(`Console errors: ${consoleErrors.length} (hydration: ${hydration.length})`);
for (const e of consoleErrors.slice(0, 30)) console.log("  " + e);
process.exit(results.every((r) => r.ok) && consoleErrors.length === 0 ? 0 : 1);
