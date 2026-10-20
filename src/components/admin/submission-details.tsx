import { Download, FileText, Film, ImageIcon, Lock } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatBytes, formatDateTime, formatNumber, gradeLabel, localName } from "@/i18n/format";
import { competitionLabel, fieldLabel, parseAmount, PERSONAL_FIELDS, QUESTIONNAIRE_SECTIONS, SUBMISSION_STEPS, type AnswerKey, type StepField } from "@/lib/submission";
import type { AdminSubmissionView } from "@/server/submissions";

const KIND_ICON = { image: ImageIcon, video: Film, document: FileText } as const;

/**
 * The full questionnaire behind a student-submitted project, including the
 * private identity answers and supporting files. Rendered only on admin
 * pages (the admin layout requires an administrator session).
 */
export function SubmissionDetails({ submission, t, locale }: { submission: AdminSubmissionView; t: Dictionary; locale: Locale }) {
  const a = submission.answers;
  const q = t.submit.questions;

  const value = (field: StepField): string => {
    switch (field) {
      case "grade":
        return a.grade ? gradeLabel(Number(a.grade), t.grades) : "";
      case "section":
        return a.section ? fmt(t.submit.options.section, { n: formatNumber(Number(a.section), locale) }) : "";
      case "projectType":
        return t.submit.options.projectType[a.projectType as keyof typeof t.submit.options.projectType] ?? a.projectType;
      case "competition":
        return a.competition === "yes" ? t.submit.options.yes : a.competition === "no" ? t.submit.options.no : "";
      case "projectStatus":
        return t.submit.options.projectStatus[a.projectStatus as keyof typeof t.submit.options.projectStatus] ?? a.projectStatus;
      case "field":
        return fieldLabel(a.field, null, locale) ?? a.field;
      case "targetCompetition":
        return competitionLabel(a.targetCompetition, null, locale) ?? a.targetCompetition;
      case "toolsCost":
      case "requestedAmount": {
        const n = parseAmount(a[field]);
        return n === null ? a[field] : `${formatNumber(n, locale)} ${t.submit.currency}`;
      }
      case "supervisor":
        return submission.supervisors.join(locale === "ar" ? "، " : ", ");
      case "cover":
      case "evidence":
      case "acknowledged":
        return "";
      default:
        return a[field as AnswerKey] ?? "";
    }
  };

  return (
    <Panel
      title={t.submit.panel.title}
      description={t.submit.panel.intro}
      action={
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f0] px-2.5 py-1 text-xs font-semibold text-danger-ink">
          <Lock className="size-3.5" aria-hidden />
          {t.submit.privateTag}
        </span>
      }
      className="mt-6"
      bodyClassName="p-0"
    >
      <div data-testid="submission-details">
        <dl className="grid gap-x-6 gap-y-3 border-b border-line-soft px-6 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t.submit.panel.submittedAt}</dt>
            <dd className="mt-0.5 font-medium text-ink">{submission.submittedAt ? formatDateTime(submission.submittedAt, locale) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.submit.panel.acknowledgedAt}</dt>
            <dd className="mt-0.5 font-medium text-ink">{a.acknowledgedAt ? formatDateTime(a.acknowledgedAt, locale) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.submit.panel.account}</dt>
            <dd className="mt-0.5 font-medium text-ink">{submission.studentRecord ? localName(submission.studentRecord, locale) : "—"}</dd>
          </div>
        </dl>

        {QUESTIONNAIRE_SECTIONS.map((section) => {
          const fields = (section === "student" ? PERSONAL_FIELDS : SUBMISSION_STEPS.filter((s) => s.section === section).flatMap((s) => s.fields)).filter(
            (f) => f !== "cover" && f !== "evidence" && f !== "acknowledged",
          );
          if (fields.length === 0) return null;
          return (
            <section key={section} className="border-b border-line-soft px-6 py-4">
              <h3 className="text-sm font-semibold text-purple-ink">{t.submit.sections[section]}</h3>
              <dl className="mt-3 divide-y divide-line-soft">
                {fields.map((f) => (
                  <div key={f} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-muted">{q[f as keyof typeof q]}</dt>
                    <dd dir="auto" className="min-w-0 whitespace-pre-line break-words text-ink" data-answer={f}>
                      {value(f) || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}

        <section className="px-6 py-4">
          <h3 className="text-sm font-semibold text-purple-ink">{t.submit.panel.files}</h3>
          {submission.evidence.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t.submit.panel.noFiles}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {submission.evidence.map((e) => {
                const Icon = KIND_ICON[e.kind] ?? FileText;
                return (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <Icon className="size-5 shrink-0 text-purple" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink" dir="auto">
                      {e.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatBytes(e.size, locale)}</span>
                    {e.href ? (
                      // A plain link: the route checks the admin session and streams the file.
                      <a
                        href={e.href}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-purple hover:bg-lavender-soft"
                        data-testid="evidence-download"
                      >
                        <Download className="size-4" aria-hidden />
                        {t.submit.panel.download}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
