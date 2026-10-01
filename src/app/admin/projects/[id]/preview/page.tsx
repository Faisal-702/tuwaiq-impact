import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/detail/project-view";
import { getI18n } from "@/i18n/server";
import { getProjectForPreview } from "@/server/queries/public";

export default async function PreviewProjectPage(props: PageProps<"/admin/projects/[id]/preview">) {
  const { id } = await props.params;
  const { t, locale } = await getI18n();
  const project = await getProjectForPreview(id);
  if (!project) notFound();
  return (
    <div className="-mx-4 -my-8 bg-white sm:-mx-8 lg:-my-10">
      <div className="px-4 pt-4 sm:px-8">
        <Link
          href={`/admin/projects/${id}/edit`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.admin.editor.editTitle}
        </Link>
      </div>
      <ProjectView project={project} related={[]} t={t} locale={locale} preview />
    </div>
  );
}
