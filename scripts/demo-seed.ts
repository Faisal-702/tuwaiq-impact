/**
 * DEVELOPMENT / DEMO data for verifying the interface.
 * All names and titles are explicitly labelled "Demo" and every row is
 * flagged is_demo = true. Nothing here represents real students or awards.
 */
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { db, purgeDemo, putObject } from "./demo-lib";

const ASSETS = path.join(process.cwd(), "scripts", "demo-assets");
const sql = db();

const LETTERS_AR = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const LETTERS_EN = ["A", "B", "C", "D", "E", "F", "G", "H"];

type Media =
  | { kind: "image"; n: number }
  | { kind: "video" }
  | { kind: "pdf" }
  | { kind: "link"; url: string };

const PROJECTS: {
  title: string;
  category: string;
  students: number[];
  grade: number;
  year: string;
  points: number;
  featured?: boolean;
  draft?: boolean;
  award?: string;
  media: Media[];
  monthsAgo: number;
}[] = [
  { title: "Demo: Smart Irrigation Prototype", category: "innovation", students: [0, 1], grade: 11, year: "1447", points: 30, featured: true, award: "Sample award (demo data)", media: [{ kind: "image", n: 1 }, { kind: "image", n: 2 }, { kind: "image", n: 3 }, { kind: "pdf" }], monthsAgo: 1 },
  { title: "Demo: Campus Air-Quality Monitor", category: "research", students: [2], grade: 12, year: "1447", points: 25, featured: true, media: [{ kind: "image", n: 3 }, { kind: "pdf" }], monthsAgo: 2 },
  { title: "Demo: Arabic Text Classifier", category: "artificial-intelligence", students: [3, 4], grade: 12, year: "1447", points: 20, featured: true, media: [{ kind: "image", n: 4 }, { kind: "video" }, { kind: "link", url: "https://example.com/demo" }], monthsAgo: 0 },
  { title: "Demo: Secure Login Workshop", category: "cybersecurity", students: [5], grade: 10, year: "1447", points: 15, media: [{ kind: "image", n: 5 }], monthsAgo: 3 },
  { title: "Demo: Line-Following Robot", category: "robotics", students: [6, 0], grade: 11, year: "1446", points: 20, media: [{ kind: "video" }], monthsAgo: 7 },
  { title: "Demo: School Event Highlights Film", category: "media", students: [7], grade: 10, year: "1446", points: 10, media: [{ kind: "image", n: 6 }], monthsAgo: 8 },
  { title: "Demo: Beach Clean-up Volunteering", category: "volunteering", students: [1, 2, 5], grade: 11, year: "1447", points: 10, media: [{ kind: "image", n: 2 }, { kind: "image", n: 5 }], monthsAgo: 4 },
  { title: "Demo: National Day Exhibition Booth", category: "national-day", students: [3], grade: 12, year: "1447", points: 10, media: [], monthsAgo: 0 },
  { title: "Demo: Founding Day Heritage Quiz", category: "founding-day", students: [4, 6], grade: 12, year: "1446", points: 10, media: [{ kind: "link", url: "https://example.com/demo-quiz" }], monthsAgo: 6 },
  { title: "Demo: Mobile Study Planner App", category: "programming", students: [7], grade: 10, year: "1447", points: 10, draft: true, media: [{ kind: "image", n: 1 }], monthsAgo: 0 },
];

const DESCRIPTION =
  "Development sample record used to verify the interface (demo data — not real student work).\n\nThis placeholder text exists only so that layouts, search, filters and media viewers can be tested before real projects are published.";

async function upload(dir: string, variant: string, file: string, type: string) {
  const objectPath = `${dir}/${variant}.${file.split(".").pop()}`;
  await putObject(objectPath, path.join(ASSETS, file), type);
  return objectPath;
}

async function main() {
  await purgeDemo(sql);

  const studentIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const [row] = await sql<{ id: string }[]>`
      insert into students (slug, name_en, name_ar, grade, is_demo)
      values (${`demo-student-${LETTERS_EN[i].toLowerCase()}`}, ${`Demo Student ${LETTERS_EN[i]}`},
              ${`طالب تجريبي ${LETTERS_AR[i]}`}, ${[10, 11, 12][i % 3]}, true)
      returning id`;
    studentIds.push(row.id);
  }

  const categories = Object.fromEntries(
    (await sql<{ id: string; slug: string }[]>`select id, slug from categories`).map((c) => [c.slug, c.id]),
  );

  for (const [index, p] of PROJECTS.entries()) {
    const published = new Date();
    published.setMonth(published.getMonth() - p.monthsAgo);
    published.setDate(Math.max(1, published.getDate() - index));
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [project] = await sql<{ id: string }[]>`
      insert into projects (slug, title, description, category_id, grade, class_name, academic_year, supervisor,
                            award, points, status, is_featured, published_at, view_count, is_demo)
      values (${slug}, ${p.title}, ${DESCRIPTION}, ${categories[p.category]}, ${p.grade}, ${`${p.grade - 9}/2`},
              ${p.year}, ${"Demo Supervisor"}, ${p.award ?? null}, ${p.points},
              ${p.draft ? "draft" : "published"}, ${!!p.featured}, ${p.draft ? null : published},
              ${p.draft ? 0 : 40 + ((index * 37) % 160)}, true)
      returning id`;
    for (const [pos, sIdx] of p.students.entries()) {
      await sql`insert into project_students (project_id, student_id, position) values (${project.id}, ${studentIds[sIdx]}, ${pos})`;
    }
    for (const [pos, m] of p.media.entries()) {
      const now = new Date();
      const dir = `media/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
      if (m.kind === "image") {
        const original = await upload(dir, "original", `demo-${m.n}-original.jpg`, "image/jpeg");
        const large = await upload(dir, "large", `demo-${m.n}-large.webp`, "image/webp");
        const thumb = await upload(dir, "thumb", `demo-${m.n}-thumb.webp`, "image/webp");
        await sql`
          insert into project_media (project_id, kind, position, storage_path, preview_path, thumb_path, file_name,
                                     mime_type, size_bytes, width, height, caption)
          values (${project.id}, 'image', ${pos}, ${original}, ${large}, ${thumb}, ${`demo-image-${m.n}.jpg`},
                  'image/jpeg', 98000, 2400, 1500, ${"Demo image"})`;
      } else if (m.kind === "video") {
        const original = await upload(dir, "original", "demo-video.webm", "video/webm");
        const poster = await upload(dir, "poster", "demo-video-poster.webp", "image/webp");
        await sql`
          insert into project_media (project_id, kind, position, storage_path, thumb_path, file_name, mime_type,
                                     size_bytes, width, height, duration_seconds)
          values (${project.id}, 'video', ${pos}, ${original}, ${poster}, 'demo-video.webm', 'video/webm', 165962,
                  1280, 720, 12)`;
      } else if (m.kind === "pdf") {
        const original = await upload(dir, "original", "demo-document.pdf", "application/pdf");
        await sql`
          insert into project_media (project_id, kind, position, storage_path, file_name, mime_type, size_bytes)
          values (${project.id}, 'document', ${pos}, ${original}, 'demo-document.pdf', 'application/pdf', 79902)`;
      } else {
        await sql`
          insert into project_media (project_id, kind, position, url, caption)
          values (${project.id}, 'link', ${pos}, ${m.url}, ${"Demo link"})`;
      }
    }
    // Spread a few anonymous demo views over the last 30 days for analytics.
    if (!p.draft) {
      for (let d = 0; d < 30; d += 1 + (index % 3)) {
        const visitors = 1 + ((index + d) % 4);
        for (let v = 0; v < visitors; v++) {
          const hash = createHash("sha256").update(`demo-${index}-${d}-${v}`).digest("hex");
          await sql`
            insert into project_views (project_id, visitor_hash, viewed_on)
            values (${project.id}, ${hash}, current_date - ${d}::int) on conflict do nothing`;
        }
      }
    }
  }
  console.log(`Seeded ${studentIds.length} demo students and ${PROJECTS.length} demo projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
