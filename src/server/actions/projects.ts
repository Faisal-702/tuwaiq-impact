"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_VIDEO_SECONDS, MIME_RULES, UPLOAD_LIMITS, VARIANT_MIME } from "@/lib/media-rules";
import { safeHttpUrl } from "@/lib/utils";
import { logActivity } from "../activity";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { isSafeObjectPath, storage } from "../storage";
import { isArabicText, uniqueSlug, type ActionResult } from "./shared";

const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional();

const mediaSchema = z.object({
  id: uuid.optional(),
  key: z.string().max(100),
  kind: z.enum(["image", "video", "document"]),
  caption: optionalText(300),
  storagePath: z.string().refine(isSafeObjectPath),
  previewPath: z.string().refine(isSafeObjectPath).nullable().optional(),
  thumbPath: z.string().refine(isSafeObjectPath).nullable().optional(),
  fileName: z.string().max(255),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().nonnegative().max(MAX_VIDEO_SECONDS + 0.99).nullable().optional(),
});

const projectSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(20000),
  categoryId: uuid,
  grade: z.number().int().min(1).max(12).nullable(),
  className: optionalText(40),
  academicYear: optionalText(40),
  supervisor: optionalText(120),
  award: optionalText(200),
  points: z.number().int().min(0).max(100000),
  featured: z.boolean(),
  students: z
    .array(z.union([z.object({ id: uuid }), z.object({ name: z.string().trim().min(1).max(120) })]))
    .min(1)
    .max(30),
  media: z.array(mediaSchema).max(60),
  links: z.array(z.object({ id: uuid.optional(), url: z.string().max(2000), caption: optionalText(200) })).max(20),
  coverKey: z.string().max(100).nullable(),
});

export type ProjectInput = z.input<typeof projectSchema>;

function validateMedia(media: z.infer<typeof mediaSchema>): string | null {
  const rule = MIME_RULES[media.mimeType];
  if (!rule || rule.kind !== media.kind) return "unsupported";
  if (media.sizeBytes > UPLOAD_LIMITS[rule.kind]) return "too large";
  if (media.kind === "video" && media.durationSeconds && media.durationSeconds > MAX_VIDEO_SECONDS) return "too long";
  return null;
}

/**
 * Creates or updates a project. `intent` decides the resulting status:
 * "draft" keeps it admin-only, "publish" makes it public.
 */
export async function saveProject(
  input: ProjectInput,
  intent: "draft" | "publish",
): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  const data = parsed.data;

  for (const m of data.media) {
    const problem = validateMedia(m);
    if (problem) return { ok: false, error: `${m.fileName}: ${problem}` };
  }
  const links = data.links
    .map((l) => ({ ...l, url: safeHttpUrl(l.url) }))
    .filter((l): l is typeof l & { url: string } => l.url !== null);

  const [category] = await sql`select id from categories where id = ${data.categoryId}`;
  if (!category) return { ok: false, error: "category" };

  const publish = intent === "publish";
  const featured = publish && data.featured;

  const previous = data.id
    ? (
        await sql<{ id: string; slug: string; status: string; is_featured: boolean; points: number; title: string }[]>`
          select id, slug, status, is_featured, points, title from projects where id = ${data.id} and deleted_at is null`
      )[0]
    : null;
  if (data.id && !previous) return { ok: false, error: "not found" };

  const removedPaths: string[] = [];
  const createdStudents: { id: string; name: string }[] = [];

  const result = await sql.begin(async (tx) => {
    // Students: link existing records and create new ones typed inline.
    const studentIds: string[] = [];
    for (const s of data.students) {
      if ("id" in s) {
        const [row] = await tx`select id from students where id = ${s.id}`;
        if (row) studentIds.push(s.id);
      } else {
        const arabic = isArabicText(s.name);
        const slug = await uniqueSlug("students", arabic ? null : s.name, "student");
        const [row] = await tx<{ id: string }[]>`
          insert into students (slug, name_en, name_ar, grade)
          values (${slug}, ${arabic ? null : s.name}, ${arabic ? s.name : null}, ${data.grade})
          returning id`;
        studentIds.push(row.id);
        createdStudents.push({ id: row.id, name: s.name });
      }
    }
    const uniqueStudents = [...new Set(studentIds)];
    if (uniqueStudents.length === 0) throw new Error("students");

    let projectId: string;
    let slug: string;
    if (previous) {
      projectId = previous.id;
      slug = previous.slug;
      await tx`
        update projects set
          title = ${data.title}, description = ${data.description ?? null}, category_id = ${data.categoryId},
          grade = ${data.grade}, class_name = ${data.className ?? null}, academic_year = ${data.academicYear ?? null},
          supervisor = ${data.supervisor ?? null}, award = ${data.award ?? null}, points = ${data.points},
          status = ${publish ? "published" : "draft"}, is_featured = ${featured},
          published_at = ${publish ? sql`coalesce(published_at, now())` : sql`published_at`}
        where id = ${projectId}`;
    } else {
      slug = await uniqueSlug("projects", data.title, "project");
      const [row] = await tx<{ id: string }[]>`
        insert into projects (slug, title, description, category_id, grade, class_name, academic_year, supervisor,
                              award, points, status, is_featured, published_at)
        values (${slug}, ${data.title}, ${data.description ?? null}, ${data.categoryId}, ${data.grade},
                ${data.className ?? null}, ${data.academicYear ?? null}, ${data.supervisor ?? null},
                ${data.award ?? null}, ${data.points}, ${publish ? "published" : "draft"}, ${featured},
                ${publish ? new Date() : null})
        returning id`;
      projectId = row.id;
    }

    await tx`delete from project_students where project_id = ${projectId}`;
    for (const [position, studentId] of uniqueStudents.entries()) {
      await tx`insert into project_students (project_id, student_id, position) values (${projectId}, ${studentId}, ${position})`;
    }

    // Media: keep, update, insert, and remove what the editor dropped.
    const existing = await tx<{ id: string; kind: string; storage_path: string | null; preview_path: string | null; thumb_path: string | null }[]>`
      select id, kind, storage_path, preview_path, thumb_path from project_media where project_id = ${projectId}`;
    const keptIds = new Set(data.media.filter((m) => m.id).map((m) => m.id!));
    const keptLinkIds = new Set(data.links.filter((l) => l.id).map((l) => l.id!));
    for (const row of existing) {
      const keep = row.kind === "link" ? keptLinkIds.has(row.id) : keptIds.has(row.id);
      if (!keep) {
        removedPaths.push(...[row.storage_path, row.preview_path, row.thumb_path].filter((p): p is string => !!p));
        await tx`delete from project_media where id = ${row.id}`;
      }
    }

    let coverId: string | null = null;
    let position = 0;
    for (const m of data.media) {
      let mediaId = m.id && existing.some((e) => e.id === m.id) ? m.id : null;
      if (mediaId) {
        await tx`update project_media set position = ${position}, caption = ${m.caption ?? null} where id = ${mediaId}`;
      } else {
        const [row] = await tx<{ id: string }[]>`
          insert into project_media (project_id, kind, position, caption, storage_path, preview_path, thumb_path,
                                     file_name, mime_type, size_bytes, width, height, duration_seconds)
          values (${projectId}, ${m.kind}, ${position}, ${m.caption ?? null}, ${m.storagePath}, ${m.previewPath ?? null},
                  ${m.thumbPath ?? null}, ${m.fileName}, ${m.mimeType}, ${m.sizeBytes}, ${m.width ?? null},
                  ${m.height ?? null}, ${m.durationSeconds ?? null})
          returning id`;
        mediaId = row.id;
      }
      if (data.coverKey && (data.coverKey === m.key || data.coverKey === m.id) && m.kind !== "document") {
        coverId = mediaId;
      }
      position += 1;
    }
    for (const l of links) {
      if (l.id && existing.some((e) => e.id === l.id)) {
        await tx`update project_media set position = ${position}, url = ${l.url}, caption = ${l.caption ?? null} where id = ${l.id}`;
      } else {
        await tx`insert into project_media (project_id, kind, position, url, caption)
                 values (${projectId}, 'link', ${position}, ${l.url}, ${l.caption ?? null})`;
      }
      position += 1;
    }
    await tx`update projects set cover_media_id = ${coverId} where id = ${projectId}`;
    return { id: projectId, slug };
  });

  if (removedPaths.length > 0) {
    await storage().remove(removedPaths).catch((e) => console.error("Media cleanup failed", e));
  }

  for (const s of createdStudents) {
    await logActivity({ action: "student.created", targetType: "student", targetId: s.id, targetLabel: s.name });
  }
  const label = data.title;
  if (!previous) {
    await logActivity({ action: "project.created", targetType: "project", targetId: result.id, targetLabel: label });
    if (publish) await logActivity({ action: "project.published", targetType: "project", targetId: result.id, targetLabel: label });
    if (featured) await logActivity({ action: "project.featured", targetType: "project", targetId: result.id, targetLabel: label });
  } else {
    await logActivity({ action: "project.edited", targetType: "project", targetId: result.id, targetLabel: label });
    if (previous.status !== "published" && publish)
      await logActivity({ action: "project.published", targetType: "project", targetId: result.id, targetLabel: label });
    if (previous.status === "published" && !publish)
      await logActivity({ action: "project.unpublished", targetType: "project", targetId: result.id, targetLabel: label });
    if (!previous.is_featured && featured)
      await logActivity({ action: "project.featured", targetType: "project", targetId: result.id, targetLabel: label });
    if (previous.is_featured && !featured)
      await logActivity({ action: "project.unfeatured", targetType: "project", targetId: result.id, targetLabel: label });
    if (previous.points !== data.points)
      await logActivity({
        action: "project.points_changed",
        targetType: "project",
        targetId: result.id,
        targetLabel: label,
        details: { from: previous.points, to: data.points },
      });
  }

  revalidatePath("/", "layout");
  return { ok: true, data: result };
}

export async function setProjectState(
  id: string,
  change: "publish" | "unpublish" | "feature" | "unfeature",
): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const [project] = await sql<{ title: string }[]>`
    update projects set
      status = ${change === "unpublish" ? "draft" : change === "publish" || change === "feature" ? "published" : sql`status`},
      is_featured = ${change === "feature" ? true : change === "unpublish" || change === "unfeature" ? false : sql`is_featured`},
      published_at = ${change === "publish" || change === "feature" ? sql`coalesce(published_at, now())` : sql`published_at`}
    where id = ${id} and deleted_at is null
    returning title`;
  if (!project) return { ok: false, error: "not found" };
  const action = (
    { publish: "project.published", unpublish: "project.unpublished", feature: "project.featured", unfeature: "project.unfeatured" } as const
  )[change];
  await logActivity({ action, targetType: "project", targetId: id, targetLabel: project.title });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProjectPoints(id: string, points: number): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success || !Number.isInteger(points) || points < 0 || points > 100000) {
    return { ok: false, error: "invalid" };
  }
  const [before] = await sql<{ points: number; title: string }[]>`select points, title from projects where id = ${id}`;
  if (!before) return { ok: false, error: "not found" };
  if (before.points === points) return { ok: true };
  await sql`update projects set points = ${points} where id = ${id}`;
  await logActivity({
    action: "project.points_changed",
    targetType: "project",
    targetId: id,
    targetLabel: before.title,
    details: { from: before.points, to: points },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Soft delete: moves the project to Trash. */
export async function trashProject(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const [p] = await sql<{ title: string }[]>`
    update projects set deleted_at = now(), is_featured = false where id = ${id} and deleted_at is null returning title`;
  if (!p) return { ok: false, error: "not found" };
  await logActivity({ action: "project.deleted", targetType: "project", targetId: id, targetLabel: p.title });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Restores a trashed project as a draft so it is reviewed before going live again. */
export async function restoreProject(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const [p] = await sql<{ title: string }[]>`
    update projects set deleted_at = null, status = 'draft' where id = ${id} and deleted_at is not null returning title`;
  if (!p) return { ok: false, error: "not found" };
  await logActivity({ action: "project.restored", targetType: "project", targetId: id, targetLabel: p.title });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Permanently deletes a trashed project and its stored media. */
export async function purgeProject(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const media = await sql<{ storage_path: string | null; preview_path: string | null; thumb_path: string | null }[]>`
    select m.storage_path, m.preview_path, m.thumb_path from project_media m
      join projects p on p.id = m.project_id where p.id = ${id} and p.deleted_at is not null`;
  const [p] = await sql<{ title: string }[]>`delete from projects where id = ${id} and deleted_at is not null returning title`;
  if (!p) return { ok: false, error: "not found" };
  const paths = media.flatMap((m) => [m.storage_path, m.preview_path, m.thumb_path]).filter((x): x is string => !!x);
  await storage().remove(paths).catch((e) => console.error("Media cleanup failed", e));
  await logActivity({ action: "project.purged", targetType: "project", targetId: id, targetLabel: p.title });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(120),
  size: z.number().int().positive(),
  variants: z.array(z.enum(["large", "thumb", "poster"])).max(3),
});

/**
 * Issues short-lived direct-upload targets for one media item (the original
 * plus optional optimised variants). Files go straight from the browser to
 * storage; nothing large passes through the application server.
 */
export async function prepareUpload(input: z.input<typeof uploadSchema>): Promise<
  ActionResult<{
    original: { path: string; url: string; headers: Record<string, string> };
    variants: Record<string, { path: string; url: string; headers: Record<string, string> }>;
  }>
> {
  await requireAdmin();
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { contentType, size, variants } = parsed.data;
  const rule = MIME_RULES[contentType];
  if (!rule) return { ok: false, error: "unsupported" };
  if (size > UPLOAD_LIMITS[rule.kind]) return { ok: false, error: "too large" };

  const now = new Date();
  const dir = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}`;
  const driver = storage();
  const originalPath = `${dir}/original.${rule.ext}`;
  const original = { path: originalPath, ...(await driver.createUploadTarget(originalPath, contentType)) };
  const out: Record<string, { path: string; url: string; headers: Record<string, string> }> = {};
  for (const v of variants) {
    const path = `${dir}/${v}.webp`;
    out[v] = { path, ...(await driver.createUploadTarget(path, VARIANT_MIME)) };
  }
  return { ok: true, data: { original, variants: out } };
}

/** Lets the editor show previews of freshly uploaded (unsaved) files. */
export async function resolveMediaUrls(paths: string[]): Promise<Record<string, string>> {
  await requireAdmin();
  const driver = storage();
  return Object.fromEntries(paths.filter(isSafeObjectPath).map((p) => [p, driver.publicUrl(p)]));
}

/** Removes uploads that were discarded in the editor before being saved. */
export async function discardUploads(paths: string[]): Promise<ActionResult> {
  await requireAdmin();
  const safe = paths.filter(isSafeObjectPath).slice(0, 20);
  if (safe.length === 0) return { ok: true };
  // Never delete anything that is referenced by a saved project.
  const referenced = await sql<{ p: string }[]>`
    select unnest(array[storage_path, preview_path, thumb_path]) as p from project_media
     where storage_path = any(${safe}) or preview_path = any(${safe}) or thumb_path = any(${safe})`;
  const used = new Set(referenced.map((r) => r.p));
  await storage()
    .remove(safe.filter((p) => !used.has(p)))
    .catch((e) => console.error("Discard failed", e));
  return { ok: true };
}
