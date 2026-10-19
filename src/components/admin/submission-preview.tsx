import { CalendarDays, Download, Eye, FileText, Film, GraduationCap, ImageIcon, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatBytes, formatDateTime, formatNumber, gradeLabel, localName } from "@/i18n/format";
import { competitionLabel, fieldLabel, parseAmount } from "@/lib/submission";
import type { AdminSubmissionPreview } from "@/server/submissions";

const KIND_ICON = { image: ImageIcon, video: Film, document: FileText } as const;

type Row = { key: string; label: string; value: string; multiline?: boolean };

/**
 * A student's submitted project as they sent it, for administrators: read
 * only (no edit or delete actions). Shows what the form collected about the
 * project; the student's identity and contact details (national ID, mobile,
 * email) are left out on the server and never reach this view.
 */
export function SubmissionPreview({ submission, t, locale }: { submission: AdminSubmissionPreview; t: Dictionary; locale: Locale }) {
  const a = submission.answers;
  const q = t.submit.questions;
  const pv = t.admin.projects.preview;
  const name = (submission.studentRecord ? localName(submission.studentRecord, locale) : "") || submission.profileName;
  const field = fieldLabel(a.field, a.fieldOther, locale);
  const competition = competitionLabel(a.targetCompetition, null, locale);
  const amount = (raw: string) => {
    const n = parseAmount(raw);
    return n === null ? raw : `${formatNumber(n, locale)} ${t.submit.currency}`;
  };
  const list = (items: string[]) => items.join(locale === "ar" ? "، " : ", ");

  const overview: Row[] = [
    { key: "title", label: q.title, value: a.title },
    { key: "field", label: q.field, value: fieldLabel(a.field, null, locale) ?? "" },
    ...(a.field === "other" ? [{ key: "fieldOther", label: q.fieldOther, value: a.fieldOther }] : []),
    { key: "targetCompetition", label: q.targetCompetition, value: competition ?? "" },
    ...(a.targetCompetition === "other" ? [{ key: "targetCompetitionOther", label: q.targetCompetitionOther, value: a.targetCompetitionOther }] : []),
    { key: "projectType", label: q.projectType, value: t.submit.options.projectType[a.projectType as keyof typeof t.submit.options.projectType] ?? "" },
    { key: "projectStatus", label: q.projectStatus, value: t.submit.options.projectStatus[a.projectStatus as keyof typeof t.submit.options.projectStatus] ?? "" },
  ];
  const details: Row[] = [
    { key: "summary", label: q.summary, value: a.summary, multiline: true },
    { key: "description", label: q.description, value: a.description, multiline: true },
    { key: "idea", label: q.idea, value: a.idea, multiline: true },
    { key: "goals", label: q.goals, value: a.goals, multiline: true },
    { key: "problem", label: q.problem, value: a.problem, multiline: true },
  ];
  const requirements: Row[] = [
    { key: "tools", label: q.tools, value: a.tools, multiline: true },
    { key: "toolsCost", label: q.toolsCost, value: a.toolsCost ? amount(a.toolsCost) : "" },
    { key: "requestedAmount", label: q.requestedAmount, value: a.requestedAmount ? amount(a.requestedAmount) : "" },
  ];
  const team: Row[] = [
    { key: "participants", label: q.participants, value: a.participants, multiline: true },
    { key: "supervisor", label: q.supervisor, value: list(submission.supervisors) },
  ];
  const previous: Row[] = [
    { key: "competition", label: q.competition, value: a.competition === "yes" ? t.submit.options.yes : a.competition === "no" ? t.submit.options.no : "" },
    ...(a.competition === "yes" ? [{ key: "competitionName", label: q.competitionName, value: a.competitionName }] : []),
  ];

  return (
    <div className="space-y-6" data-testid="submission-preview-view">
      {/* Summary card: the project, its student and the key facts at a glance. */}
      <section className="overflow-hidden rounded-[1.5rem] bg-white shadow-soft ring-1 ring-line-soft">
        <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender-soft px-3 py-1 text-xs font-semibold text-purple-ink ring-1 ring-inset ring-purple/15">
              <Eye className="size-3.5" aria-hidden />
              {pv.readOnly}
            </span>
            <h2 dir="auto" className="mt-4 text-2xl font-bold leading-snug tracking-tight text-ink rtl:tracking-normal" data-testid="preview-title">
              {a.title || "—"}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {field ? (
                <span className="inline-flex items-center rounded-full bg-lavender-soft px-3 py-1 text-xs font-semibold text-purple-ink ring-1 ring-inset ring-purple/15" dir="auto">
                  {field}
                </span>
              ) : null}
              {competition ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-3 py-1 text-xs font-semibold text-teal-deep ring-1 ring-inset ring-teal-deep/15"
                  data-testid="preview-competition"
                >
                  <Trophy className="size-3.5" aria-hidden />
                  <span dir="auto">{competitionLabel(a.targetCompetition, a.targetCompetitionOther, locale)}</span>
                </span>
              ) : null}
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
              <Fact icon={UserRound} label={pv.student} value={name || "—"} testId="preview-student" />
              <Fact
                icon={GraduationCap}
                label={pv.grade}
                value={[a.grade ? gradeLabel(Number(a.grade), t.grades) : "", a.section ? fmt(t.submit.options.section, { n: formatNumber(Number(a.section), locale) }) : ""].filter(Boolean).join(" · ") || "—"}
              />
              <Fact
                icon={CalendarDays}
                label={t.submit.panel.submittedAt}
                value={submission.submittedAt ? formatDateTime(submission.submittedAt, locale) : "—"}
              />
            </dl>
          </div>
          <figure className="overflow-hidden rounded-2xl bg-canvas ring-1 ring-line-soft">
            {submission.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage URL
              <img src={submission.coverUrl} alt={pv.cover} className="aspect-[16/10] w-full object-cover" data-testid="preview-cover" />
            ) : (
              <div className="grid aspect-[16/10] place-items-center px-4 text-center text-sm text-muted">{pv.noCover}</div>
            )}
          </figure>
        </div>
        <p className="flex items-center gap-2 border-t border-line-soft bg-canvas/60 px-6 py-3 text-xs text-muted sm:px-7">
          <ShieldCheck className="size-4 shrink-0 text-teal-deep" aria-hidden />
          {pv.privacyNote}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Rows title={pv.overview} rows={overview} empty={pv.empty} />
        <Rows title={pv.team} rows={team} empty={pv.empty} />
      </div>
      <Rows title={pv.details} rows={details} empty={pv.empty} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Rows title={pv.requirements} rows={requirements} empty={pv.empty} />
        <Rows title={pv.previous} rows={previous} empty={pv.empty} />
      </div>

      <Panel title={t.submit.panel.files}>
        {submission.evidence.length === 0 ? (
          <p className="text-sm text-muted">{t.submit.panel.noFiles}</p>
        ) : (
          <ul className="space-y-2">
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
                    <a href={e.href} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-purple hover:bg-lavender-soft">
                      <Download className="size-4" aria-hidden />
                      {t.submit.panel.download}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Fact({ icon: Icon, label, value, testId }: { icon: typeof UserRound; label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-purple ring-1 ring-line-soft">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd dir="auto" className="mt-0.5 font-semibold text-ink" data-testid={testId}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function Rows({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <Panel title={title} bodyClassName="px-6 py-2">
      <dl className="divide-y divide-line-soft">
        {rows.map((r) => (
          <div key={r.key} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted">{r.label}</dt>
            <dd
              dir="auto"
              className={r.value.trim() ? `min-w-0 break-words text-ink ${r.multiline ? "whitespace-pre-line leading-relaxed" : "font-medium"}` : "text-muted"}
              data-answer={r.key}
            >
              {r.value.trim() || empty}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
