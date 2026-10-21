import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SubmissionPreview } from "@/components/admin/submission-preview";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/auth";
import { getSubmissionPreview } from "@/server/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.projects.previewProject };
}

/** Read-only preview of a project a student submitted (Manage Projects → Preview Project). */
export default async function SubmissionPreviewPage(props: PageProps<"/admin/projects/submissions/[id]">) {
  const { id } = await props.params;
  const { t, locale } = await getI18n();
  // The questionnaire is only ever loaded behind an admin check.
  await requireAdmin();
  const submission = await getSubmissionPreview(id);
  if (!submission) notFound();
  return (
    <>
      <Link
        href="/admin/projects"
        className="mb-4 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted transition hover:text-ink"
        data-testid="preview-back"
      >
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {t.admin.projects.preview.back}
      </Link>
      <AdminPageHeader title={t.admin.projects.previewProject} />
      <SubmissionPreview submission={submission} t={t} locale={locale} />
    </>
  );
}
