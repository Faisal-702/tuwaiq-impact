import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, Panel } from "@/components/admin/page-header";
import { ProjectThumb } from "@/components/admin/project-thumb";
import { StudentDialog } from "@/components/admin/student-dialog";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/chip";
import { getI18n } from "@/i18n/server";
import { formatNumber, gradeLabel, localName } from "@/i18n/format";
import { getStudentAdmin } from "@/server/queries/admin";

export default async function AdminStudentPage(props: PageProps<"/admin/students/[id]">) {
  const { id } = await props.params;
  const { t, locale } = await getI18n();
  const data = await getStudentAdmin(id);
  if (!data) notFound();
  const { student, projects } = data;
  const name = localName(student, locale);

  return (
    <>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.admin.students.title}
      </Link>
      <AdminPageHeader
        title={name}
        description={[student.grade ? gradeLabel(student.grade, t.grades) : null, `${formatNumber(student.points, locale)} ${t.common.points}`]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <StudentDialog trigger="edit" student={student} />
            {student.published > 0 ? (
              <Link href={`/students/${student.slug}`} target="_blank" className={buttonClasses("subtle", "sm")}>
                <ExternalLink className="size-4" aria-hidden />
                {t.admin.students.viewProfile}
              </Link>
            ) : null}
          </>
        }
      />
      <Panel title={t.admin.students.projectList} bodyClassName="">
        {projects.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">{t.admin.students.noProjects}</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/projects/${p.id}/edit`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-canvas/60">
                  <ProjectThumb src={p.thumb} icon={p.category_icon} />
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate font-medium text-ink">{p.title}</p>
                    <p className="text-sm text-muted">{locale === "ar" ? p.category_ar : p.category_en}</p>
                  </div>
                  {p.status === "published" ? <Badge tone="teal">{t.admin.projects.status.published}</Badge> : <Badge>{t.admin.projects.status.draft}</Badge>}
                  <span className="w-16 text-end text-sm font-medium tabular-nums text-ink">
                    {formatNumber(p.points, locale)} <span className="text-muted">{t.common.pointsShort}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
