import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { toEditorInitial } from "@/components/admin/project-editor/load";
import { ProjectEditor } from "@/components/admin/project-editor/project-editor";
import { buttonClasses } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { getProjectForEdit, listAcademicYears, listAllStudents, listCategoriesAdmin } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.editor.editTitle };
}

export default async function EditProjectPage(props: PageProps<"/admin/projects/[id]/edit">) {
  const { id } = await props.params;
  const { t } = await getI18n();
  const [project, categories, students, years] = await Promise.all([
    getProjectForEdit(id),
    listCategoriesAdmin(),
    listAllStudents(),
    listAcademicYears(),
  ]);
  if (!project) notFound();
  return (
    <>
      <AdminPageHeader
        title={t.admin.editor.editTitle}
        description={project.title}
        actions={
          project.status === "published" ? (
            <Link href={`/projects/${project.slug}`} target="_blank" className={buttonClasses("subtle", "sm")}>
              <ExternalLink className="size-4" aria-hidden />
              {t.admin.projects.actions.view}
            </Link>
          ) : null
        }
      />
      <ProjectEditor
        key={project.updated_at}
        initial={toEditorInitial(project)}
        categories={categories.map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, archived: !!c.archived_at }))}
        students={students}
        years={years}
      />
    </>
  );
}
