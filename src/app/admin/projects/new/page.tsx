import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProjectEditor } from "@/components/admin/project-editor/project-editor";
import { getI18n } from "@/i18n/server";
import { getSettings, listAcademicYears, listAllStudents, listCategoriesAdmin } from "@/server/queries/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.editor.newTitle };
}

export default async function NewProjectPage() {
  const { t } = await getI18n();
  const [categories, students, settings, years] = await Promise.all([
    listCategoriesAdmin(),
    listAllStudents(),
    getSettings(),
    listAcademicYears(),
  ]);
  return (
    <>
      <AdminPageHeader title={t.admin.editor.newTitle} description={t.admin.editor.intro} />
      <ProjectEditor
        categories={categories.map((c) => ({ id: c.id, name_en: c.name_en, name_ar: c.name_ar, archived: !!c.archived_at }))}
        students={students}
        years={years}
        initial={{
          status: "draft",
          featured: false,
          title: "",
          description: "",
          categoryId: "",
          grade: null,
          className: "",
          academicYear: settings.currentAcademicYear ?? "",
          supervisor: "",
          award: "",
          points: settings.defaultPoints,
          students: [],
          media: [],
          links: [],
          coverKey: null,
        }}
      />
    </>
  );
}
