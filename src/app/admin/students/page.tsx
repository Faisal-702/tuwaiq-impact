import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteStudentButton, StudentDialog } from "@/components/admin/student-dialog";
import { Badge } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { getI18n } from "@/i18n/server";
import { formatNumber, gradeLabel } from "@/i18n/format";
import { listStudentsAdmin } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.students.title };
}

export default async function AdminStudentsPage(props: PageProps<"/admin/students">) {
  const sp = await props.searchParams;
  const { t, locale } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const students = await listStudentsAdmin(q);

  return (
    <>
      <AdminPageHeader title={t.admin.students.title} description={t.admin.students.intro} actions={<StudentDialog trigger="add" />} />
      <form role="search" className="relative mb-5 max-w-sm">
        <label htmlFor="admin-student-search" className="sr-only">
          {t.admin.students.search}
        </label>
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="admin-student-search"
          name="q"
          type="search"
          defaultValue={q}
          dir="auto"
          placeholder={t.admin.students.search}
          className="h-11 w-full rounded-xl border border-line bg-white ps-10 pe-4 text-sm shadow-soft focus:border-purple/50 focus:outline-none focus:ring-4 focus:ring-purple/10"
        />
      </form>

      {students.length === 0 ? (
        <EmptyState icon={Users} title={t.admin.students.emptyTitle} body={t.admin.students.emptyBody} className="bg-white" />
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-line-soft text-xs uppercase tracking-wider text-muted rtl:tracking-normal">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-medium">{t.admin.common.name}</th>
                <th scope="col" className="hidden px-3 py-3 text-start font-medium sm:table-cell">{t.admin.students.grade}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t.admin.students.projects}</th>
                <th scope="col" className="hidden px-3 py-3 text-end font-medium sm:table-cell">{t.admin.students.points}</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">{t.admin.common.actions}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {students.map((s) => {
                const name = (locale === "ar" ? s.name_ar || s.name_en : s.name_en || s.name_ar) ?? "";
                const other = locale === "ar" ? s.name_en : s.name_ar;
                return (
                  <tr key={s.id} className="hover:bg-canvas/60" data-testid="admin-student-row">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/students/${s.id}`} className="font-medium text-ink hover:text-purple">
                        {name}
                      </Link>
                      {other && other !== name ? <p dir="auto" className="text-muted">{other}</p> : null}
                      {s.is_demo ? <Badge tone="amber" className="mt-1">{t.common.demo}</Badge> : null}
                    </td>
                    <td className="hidden px-3 py-3.5 text-ink-soft sm:table-cell">{s.grade ? gradeLabel(s.grade, t.grades) : "—"}</td>
                    <td className="px-3 py-3.5 text-end tabular-nums">{formatNumber(s.projects, locale)}</td>
                    <td className="hidden px-3 py-3.5 text-end font-medium tabular-nums sm:table-cell">{formatNumber(s.points, locale)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <StudentDialog trigger="edit" student={s} />
                        <DeleteStudentButton id={s.id} name={name} linked={s.projects > 0} />
                      </div>
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
