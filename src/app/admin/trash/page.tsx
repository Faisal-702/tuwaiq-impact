import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProjectThumb } from "@/components/admin/project-thumb";
import { TrashActions } from "@/components/admin/trash-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { formatDateTime, localName } from "@/i18n/format";
import { listTrash } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.trash.title };
}

export default async function AdminTrashPage() {
  const { t, locale } = await getI18n();
  const items = await listTrash();
  return (
    <>
      <AdminPageHeader title={t.admin.trash.title} description={t.admin.trash.intro} />
      {items.length === 0 ? (
        <EmptyState icon={Trash2} title={t.admin.trash.empty} body={t.admin.trash.emptyBody} className="bg-white" />
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center" data-testid="trash-row">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <ProjectThumb src={p.thumb} icon={p.category_icon} />
                <div className="min-w-0">
                  <p dir="auto" className="truncate font-medium text-ink">{p.title}</p>
                  <p className="truncate text-sm text-muted">
                    {p.students.map((s) => localName(s, locale)).join(", ")} · {t.admin.trash.deletedAt}{" "}
                    {p.deleted_at ? formatDateTime(p.deleted_at, locale) : ""}
                  </p>
                </div>
              </div>
              <TrashActions id={p.id} title={p.title} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
