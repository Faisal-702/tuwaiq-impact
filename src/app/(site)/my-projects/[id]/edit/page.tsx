import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmissionWizard } from "@/components/submission/submission-wizard";
import Link from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { requireViewer } from "@/server/auth";
import { loadEditView } from "@/server/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.myProjects.edit.metaTitle };
}

/**
 * Edit one of the student's own projects with the same form used to add it.
 * Ownership is checked on the server from the student session: another
 * student's project (or a project in the trash) is "not found".
 */
export default async function EditMyProjectPage(props: PageProps<"/my-projects/[id]/edit">) {
  const [{ id }, viewer, { t }] = await Promise.all([props.params, requireViewer(), getI18n()]);
  if (viewer.kind !== "student") redirect("/my-projects");
  const loaded = await loadEditView(viewer.student.studentId, id);
  if (!loaded) notFound();
  const { view, stored, project } = loaded;

  return (
    <div className="pb-16">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_100%_0%,rgba(237,233,254,0.75),transparent_65%),radial-gradient(45%_70%_at_0%_10%,rgba(209,250,229,0.5),transparent_60%)]"
        />
        <div className="container-page pb-8 pt-10 sm:pt-14">
          <nav aria-label={t.myProjects.breadcrumb} className="text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/home" className="transition-colors hover:text-purple">
                  {t.myProjects.breadcrumbHome}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/my-projects" className="transition-colors hover:text-purple">
                  {t.myProjects.title}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-ink">
                {t.myProjects.edit.title}
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-ink sm:text-[2.5rem] rtl:tracking-normal">{t.myProjects.edit.title}</h1>
          <p className="mt-2 text-lg font-semibold text-purple-ink" dir="auto" data-testid="edit-project-title">
            {project.title}
          </p>
          <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{t.myProjects.edit.intro}</p>
        </div>
      </section>
      <div className="container-page">
        <SubmissionWizard
          initial={view}
          restored={stored}
          edit={{ projectId: project.id, slug: project.slug, published: project.status === "published" }}
        />
      </div>
    </div>
  );
}
