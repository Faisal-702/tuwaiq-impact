import { Eye, FolderKanban } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { fmt, localName } from "@/i18n/format";
import { requireAdmin } from "@/server/auth";
import { listStudentSubmissions } from "@/server/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.projects.title };
}

/**
 * Projects submitted by students through the project form ("إضافة مشروع"),
 * newest first: one row per submitted project with the student's name and a
 * read-only preview. Projects are created by students only.
 */
export default async function AdminProjectsPage() {
  const { t, locale } = await getI18n();
  await requireAdmin();
  const submissions = await listStudentSubmissions();
  const p = t.admin.projects;

  return (
    <>
      <AdminPageHeader title={p.title} description={p.intro} />

      {submissions.length === 0 ? (
        <EmptyState icon={FolderKanban} title={p.submissionsEmptyTitle} body={p.submissionsEmptyBody} className="bg-white" />
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
          <table className="w-full text-sm" data-testid="admin-submissions">
            <caption className="sr-only">{p.submissionsLabel}</caption>
            <thead className="border-b border-line-soft bg-canvas/60 text-xs font-semibold text-muted">
              <tr>
                <th scope="col" className="px-5 py-3.5 text-start font-semibold sm:px-6">
                  {p.studentName}
                </th>
                <th scope="col" className="w-0 whitespace-nowrap px-5 py-3.5 text-end font-semibold sm:px-6">
                  {p.previewProject}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {submissions.map((s) => {
                const name = (s.studentName ? localName(s.studentName, locale) : "") || s.profileName;
                return (
                  <tr key={s.id} className="transition-colors hover:bg-canvas/60" data-testid="admin-submission-row" data-submission={s.id}>
                    <td className="px-5 py-4 sm:px-6">
                      <span dir="auto" className="font-semibold text-ink" data-testid="submission-student">
                        {name || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-end sm:px-6">
                      <Link
                        href={`/admin/projects/submissions/${s.id}`}
                        className={buttonClasses("primary", "sm")}
                        aria-label={fmt(p.previewOf, { title: s.title || name })}
                        data-testid="submission-preview"
                      >
                        <Eye className="size-4" aria-hidden />
                        {p.previewProject}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
