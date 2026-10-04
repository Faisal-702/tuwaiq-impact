import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectView } from "@/components/projects/detail/project-view";
import { ViewTracker } from "@/components/projects/detail/view-tracker";
import { getI18n } from "@/i18n/server";
import { excerpt } from "@/lib/utils";
import { getPublicProject, getRelatedProjects } from "@/server/queries/public";
import { getViewer, requireViewer } from "@/server/auth";

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  if (!(await getViewer())) return {};
  const { slug } = await props.params;
  const project = await getPublicProject(decodeURIComponent(slug));
  if (!project) return {};
  return {
    title: project.title,
    description: excerpt(project.description, 160) || undefined,
    openGraph: project.cover ? { images: [project.cover.url] } : undefined,
  };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  await requireViewer();
  const { slug } = await props.params;
  const { t, locale } = await getI18n();
  const project = await getPublicProject(decodeURIComponent(slug));
  if (!project) notFound();
  const related = await getRelatedProjects(project.id, project.category_id, 3);
  return (
    <>
      <ViewTracker projectId={project.id} />
      <ProjectView project={project} related={related} t={t} locale={locale} />
    </>
  );
}
