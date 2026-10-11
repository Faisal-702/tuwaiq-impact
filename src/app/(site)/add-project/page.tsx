import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { SubmissionWizard } from "@/components/submission/submission-wizard";
import { buttonClasses } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { ANSWER_KEYS } from "@/lib/submission";
import { requireViewer } from "@/server/auth";
import { loadDraftView } from "@/server/submissions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.submit.metaTitle };
}

/** Answers the platform pre-fills from the student's record. */
const PREFILLED = new Set(["studentName", "grade", "section"]);

export default async function AddProjectPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);

  return (
    <div className="pb-16">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_100%_0%,rgba(237,233,254,0.75),transparent_65%),radial-gradient(45%_70%_at_0%_10%,rgba(209,250,229,0.5),transparent_60%)]"
        />
        <div className="container-page pb-8 pt-10 sm:pt-14">
          <nav aria-label="breadcrumb" className="text-sm text-muted">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/home" className="transition-colors hover:text-purple">
                  {t.submit.breadcrumbHome}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-ink">
                {t.submit.title}
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-ink sm:text-[2.5rem] rtl:tracking-normal">{t.submit.title}</h1>
          <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{t.submit.intro}</p>
        </div>
      </section>

      <div className="container-page">
        {viewer.kind === "student" ? (
          <StudentForm studentId={viewer.student.studentId} />
        ) : (
          <div className="mx-auto max-w-xl rounded-[1.5rem] bg-white p-8 text-center shadow-soft ring-1 ring-line-soft" data-testid="admin-notice">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lavender-soft text-purple">
              <ShieldAlert className="size-7" strokeWidth={1.8} aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-bold text-ink">{t.submit.adminTitle}</h2>
            <p className="mt-2 leading-relaxed text-muted">{t.submit.adminBody}</p>
            <Link href="/admin/projects/new" className={`${buttonClasses("primary", "md")} mt-6`}>
              {t.submit.adminCta}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

async function StudentForm({ studentId }: { studentId: string }) {
  const { view, stored } = await loadDraftView(studentId);
  const restored =
    stored &&
    (ANSWER_KEYS.some((k) => !PREFILLED.has(k) && view.answers[k].trim() !== "") || Boolean(view.cover) || view.evidence.length > 0);
  return <SubmissionWizard initial={view} restored={restored} />;
}
