"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORY_ACCENT_KEYS, CATEGORY_ICON_KEYS } from "@/lib/categories";
import { logActivity } from "../activity";
import { requireAdmin } from "../auth";
import { sql } from "../db";
import { uniqueSlug, type ActionResult } from "./shared";

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  nameEn: z.string().trim().min(1).max(80),
  nameAr: z.string().trim().min(1).max(80),
  keywords: z.string().trim().max(400),
  icon: z.string().refine((v) => CATEGORY_ICON_KEYS.includes(v)),
  accent: z.string().refine((v) => (CATEGORY_ACCENT_KEYS as string[]).includes(v)),
  kind: z.enum(["project", "activity"]),
});

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const c = parsed.data;
  if (c.id) {
    const [row] = await sql<{ id: string }[]>`
      update categories set name_en = ${c.nameEn}, name_ar = ${c.nameAr}, keywords = ${c.keywords},
             icon = ${c.icon}, accent = ${c.accent}, kind = ${c.kind}
       where id = ${c.id} returning id`;
    if (!row) return { ok: false, error: "not found" };
    await logActivity({ action: "category.edited", targetType: "category", targetId: c.id, targetLabel: c.nameEn });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: c.id } };
  }
  const slug = await uniqueSlug("categories", c.nameEn, "category");
  const [row] = await sql<{ id: string }[]>`
    insert into categories (slug, name_en, name_ar, keywords, icon, accent, kind, sort_order)
    values (${slug}, ${c.nameEn}, ${c.nameAr}, ${c.keywords}, ${c.icon}, ${c.accent}, ${c.kind},
            (select coalesce(max(sort_order), 0) + 10 from categories))
    returning id`;
  await logActivity({ action: "category.created", targetType: "category", targetId: row.id, targetLabel: c.nameEn });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: row.id } };
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const [row] = await sql<{ name_en: string }[]>`
    update categories set archived_at = ${archived ? sql`now()` : null} where id = ${id} returning name_en`;
  if (!row) return { ok: false, error: "not found" };
  await logActivity({
    action: archived ? "category.archived" : "category.restored",
    targetType: "category",
    targetId: id,
    targetLabel: row.name_en,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
