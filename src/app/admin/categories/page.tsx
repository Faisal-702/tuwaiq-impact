import type { Metadata } from "next";
import { ArchiveCategoryButton, CategoryDialog } from "@/components/admin/category-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge, CategoryChip } from "@/components/ui/chip";
import { getI18n } from "@/i18n/server";
import { formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { listCategoriesAdmin } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.categories.title };
}

export default async function AdminCategoriesPage() {
  const { t, locale } = await getI18n();
  const categories = await listCategoriesAdmin();
  return (
    <>
      <AdminPageHeader title={t.admin.categories.title} description={t.admin.categories.intro} actions={<CategoryDialog />} />
      <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-line-soft text-xs uppercase tracking-wider text-muted rtl:tracking-normal">
            <tr>
              <th scope="col" className="px-5 py-3 text-start font-medium">{t.admin.common.name}</th>
              <th scope="col" className="hidden px-3 py-3 text-start font-medium md:table-cell">{t.admin.categories.kind}</th>
              <th scope="col" className="px-3 py-3 text-end font-medium">{t.admin.categories.projects}</th>
              <th scope="col" className="hidden px-3 py-3 text-start font-medium sm:table-cell">{t.admin.common.status}</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">{t.admin.common.actions}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {categories.map((c) => (
              <tr key={c.id} className={cn("hover:bg-canvas/60", c.archived_at && "opacity-60")} data-testid="admin-category-row">
                <td className="px-5 py-3.5">
                  <CategoryChip name={locale === "ar" ? c.name_ar : c.name_en} icon={c.icon} accent={c.accent} />
                  <p className="mt-1.5 text-xs text-muted">{locale === "ar" ? c.name_en : c.name_ar}</p>
                </td>
                <td className="hidden px-3 py-3.5 text-ink-soft md:table-cell">{t.admin.categories.kinds[c.kind]}</td>
                <td className="px-3 py-3.5 text-end tabular-nums">{formatNumber(c.project_count ?? 0, locale)}</td>
                <td className="hidden px-3 py-3.5 sm:table-cell">
                  {c.archived_at ? <Badge>{t.admin.categories.archived}</Badge> : <Badge tone="teal">{t.admin.categories.active}</Badge>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <CategoryDialog category={c} />
                    <ArchiveCategoryButton category={c} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
