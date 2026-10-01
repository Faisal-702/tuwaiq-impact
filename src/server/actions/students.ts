"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "../activity";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { uniqueSlug, type ActionResult } from "./shared";

const studentSchema = z
  .object({
    id: z.string().uuid().optional(),
    nameEn: z.string().trim().max(120),
    nameAr: z.string().trim().max(120),
    grade: z.number().int().min(1).max(12).nullable(),
  })
  .refine((v) => v.nameEn.length > 0 || v.nameAr.length > 0, { message: "name" });

export async function saveStudent(input: z.input<typeof studentSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "name" };
  const { id, nameEn, nameAr, grade } = parsed.data;
  const label = nameEn || nameAr;
  if (id) {
    const [row] = await sql<{ id: string }[]>`
      update students set name_en = ${nameEn || null}, name_ar = ${nameAr || null}, grade = ${grade}
       where id = ${id} returning id`;
    if (!row) return { ok: false, error: "not found" };
    await logActivity({ action: "student.edited", targetType: "student", targetId: id, targetLabel: label });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  }
  const slug = await uniqueSlug("students", nameEn || null, "student");
  const [row] = await sql<{ id: string }[]>`
    insert into students (slug, name_en, name_ar, grade)
    values (${slug}, ${nameEn || null}, ${nameAr || null}, ${grade}) returning id`;
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
