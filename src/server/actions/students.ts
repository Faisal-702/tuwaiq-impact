"use server";

import { revalidatePath } from "next/cache";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { logActivity } from "../activity";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { BULK_MAX_STUDENTS, normalizeStudentName, parseNameList, STUDENT_SECTIONS } from "@/lib/students";
import { slugify } from "@/lib/utils";
import { isArabicText, uniqueSlug, type ActionResult } from "./shared";

const sectionSchema = z
  .number()
  .int()
  .refine((v) => (STUDENT_SECTIONS as readonly number[]).includes(v))
  .nullable();

const studentSchema = z
  .object({
    id: z.string().uuid().optional(),
    nameEn: z.string().trim().max(120),
    nameAr: z.string().trim().max(120),
    grade: z.number().int().min(1).max(12).nullable(),
    // Optional so older callers keep working; null = not set.
    section: sectionSchema.optional(),
  })
  .refine((v) => v.nameEn.length > 0 || v.nameAr.length > 0, { message: "name" });

export async function saveStudent(input: z.input<typeof studentSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "name" };
  const { id, nameEn, nameAr, grade } = parsed.data;
  const section = parsed.data.section ?? null;
  const label = nameEn || nameAr;
  if (id) {
    const [row] = await sql<{ id: string }[]>`
      update students set name_en = ${nameEn || null}, name_ar = ${nameAr || null}, grade = ${grade}, section = ${section}
       where id = ${id} returning id`;
    if (!row) return { ok: false, error: "not found" };
    await logActivity({ action: "student.edited", targetType: "student", targetId: id, targetLabel: label });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  }
  const slug = await uniqueSlug("students", nameEn || null, "student");
  const [row] = await sql<{ id: string }[]>`
    insert into students (slug, name_en, name_ar, grade, section)
    values (${slug}, ${nameEn || null}, ${nameAr || null}, ${grade}, ${section}) returning id`;
  await logActivity({ action: "student.created", targetType: "student", targetId: row.id, targetLabel: label });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: row.id } };
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const [linked] = await sql`select 1 from project_students where student_id = ${id} limit 1`;
  if (linked) return { ok: false, error: "linked" };
  const [row] = await sql<{ name: string }[]>`
    delete from students where id = ${id} returning coalesce(name_en, name_ar) as name`;
  if (!row) return { ok: false, error: "not found" };
  await logActivity({ action: "student.deleted", targetType: "student", targetId: id, targetLabel: row.name });
  revalidatePath("/admin/students");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk add: many students with one grade + section
// ---------------------------------------------------------------------------

const bulkSchema = z.object({
  text: z.string().max(BULK_MAX_STUDENTS * 130),
  grade: z.number().int().min(1).max(12),
  section: z.number().int().refine((v) => (STUDENT_SECTIONS as readonly number[]).includes(v)),
});

/** Names (from `names`) that already exist as students in the same grade and section. */
async function existingInClass(db: typeof sql | TransactionSql, names: string[], grade: number, section: number) {
  const rows = await db<{ name_en: string | null; name_ar: string | null }[]>`
    select name_en, name_ar from students where grade = ${grade} and section = ${section}`;
  const taken = new Set<string>();
  for (const r of rows) {
    if (r.name_ar) taken.add(normalizeStudentName(r.name_ar));
    if (r.name_en) taken.add(normalizeStudentName(r.name_en));
  }
  return names.filter((n) => taken.has(normalizeStudentName(n)));
}

/** Admin: preview a bulk add — which pasted names already exist in that grade + section. */
export async function checkBulkStudents(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ existing: string[] }>> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { names } = parseNameList(parsed.data.text);
  if (names.length === 0) return { ok: true, data: { existing: [] } };
  return { ok: true, data: { existing: await existingInClass(sql, names, parsed.data.grade, parsed.data.section) } };
}

export type BulkCreateResult = { created: number; skipped: string[] };

/**
 * Admin: creates every pasted name as a student with the chosen grade and
 * section, in ONE transaction and ONE multi-row insert. Blank lines are
 * ignored, repeated lines count once, and names that already exist in the
 * same grade + section are skipped, so submitting the same list twice never
 * creates duplicates. Arabic names go to name_ar, others to name_en.
 */
export async function bulkCreateStudents(input: z.input<typeof bulkSchema>): Promise<ActionResult<BulkCreateResult>> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { grade, section } = parsed.data;
  const { names, tooLong } = parseNameList(parsed.data.text);
  if (tooLong.length > 0) return { ok: false, error: "too_long" };
  if (names.length === 0) return { ok: false, error: "empty" };
  if (names.length > BULK_MAX_STUDENTS) return { ok: false, error: "too_many" };

  const result = await sql.begin(async (tx) => {
    // Serialise bulk adds so two simultaneous submissions cannot both insert.
    await tx`select pg_advisory_xact_lock(hashtext('ti_students_bulk_add'))`;
    const skipped = await existingInClass(tx, names, grade, section);
    const skip = new Set(skipped.map(normalizeStudentName));
    const toCreate = names.filter((n) => !skip.has(normalizeStudentName(n)));
    if (toCreate.length === 0) return { created: 0, skipped };

    // Slugs: English names get a readable slug, Arabic names a random one
    // (same rule as single creation); collisions are resolved in-memory
    // against one lookup instead of one query per student.
    const rand = () => Math.random().toString(36).slice(2, 8);
    const base = toCreate.map((n) => (isArabicText(n) ? "" : slugify(n)) || `student-${rand()}`);
    const taken = new Set(
      (await tx<{ slug: string }[]>`select slug from students where slug = any(${base})`).map((r) => r.slug),
    );
    const rows = toCreate.map((name, i) => {
      let slug = base[i];
      while (taken.has(slug)) slug = `${base[i]}-${rand()}`;
      taken.add(slug);
      const arabic = isArabicText(name);
      return { slug, name_en: arabic ? null : name, name_ar: arabic ? name : null, grade, section };
    });
    await tx`insert into students ${tx(rows, "slug", "name_en", "name_ar", "grade", "section")}`;
    return { created: rows.length, skipped };
  });

  if (result.created > 0) {
    await logActivity({
      action: "student.bulk_created",
      targetType: "student",
      targetLabel: String(result.created),
      details: { created: result.created, skipped: result.skipped.length, grade, section },
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, data: result };
}
