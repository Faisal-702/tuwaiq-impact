"use client";

import { AlertCircle, Eye, FileStack, FileText, Lock, PencilLine, PieChart, UserRound, type LucideIcon } from "lucide-react";
import Link from "@/components/ui/link";
import type { RefObject } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatBytes, formatNumber, gradeLabel } from "@/i18n/format";
import {
  cleanSupervisors,
  fieldLabel,
  parseAmount,
  SUBMISSION_SECTIONS_LIST,
  SUBMISSION_STEPS,
  type AnswerKey,
  type EvidenceFile,
  type FieldError,
  type StepField,
  type SubmissionAnswers,
  type SubmissionSection,
} from "@/lib/submission";
import type { ProfileValues } from "@/lib/profile";
import { cn } from "@/lib/utils";
import type { DraftView } from "@/server/submissions";
import { Checkbox } from "./fields";

const SECTION_ICONS: Record<SubmissionSection, LucideIcon> = {
  details: FileText,
  classification: PieChart,
  attachments: FileStack,
};

/** Answers that never leave the school's records. */
const PRIVATE: StepField[] = ["nationalId", "phone", "email", "toolsCost", "evidence"];
/** Answers shown on the public project card. */
const PUBLIC: StepField[] = ["title", "summary", "field", "requestedAmount", "cover", "grade"];

export function SubmissionReview({
  headingRef,
  answers,
  cover,
  evidence,
  acknowledged,
  onAcknowledge,
  onEdit,
  missing,
  extraSupervisors = [],
  profile,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  answers: SubmissionAnswers;
  cover: DraftView["cover"];
  evidence: EvidenceFile[];
  acknowledged: boolean;
  onAcknowledge: (checked: boolean) => void;
  onEdit: (section: SubmissionSection) => void;
  missing: Partial<Record<StepField, FieldError>>;
  /** Supervisors after the first one. */
  extraSupervisors?: string[];
  /** The student's profile, linked to a new project when it is submitted. */
  profile?: ProfileValues;
}) {
  const { t, locale } = useI18n();
  const q = t.submit.questions;

  const amount = (raw: string) => {
    const n = parseAmount(raw);
    return n === null ? raw : `${formatNumber(n, locale)} ${t.submit.currency}`;
  };

  function display(field: StepField): React.ReactNode {
    const a = answers;
    switch (field) {
      case "grade":
        return a.grade ? gradeLabel(Number(a.grade), t.grades) : "";
      case "section":
        return a.section ? fmt(t.submit.options.section, { n: formatNumber(Number(a.section), locale) }) : "";
      case "projectType":
        return t.submit.options.projectType[a.projectType as keyof typeof t.submit.options.projectType] ?? "";
      case "competition":
        return a.competition === "yes" ? t.submit.options.yes : a.competition === "no" ? t.submit.options.no : "";
      case "projectStatus":
        return t.submit.options.projectStatus[a.projectStatus as keyof typeof t.submit.options.projectStatus] ?? "";
      case "field":
        return fieldLabel(a.field, null, locale) ?? "";
      case "toolsCost":
      case "requestedAmount":
        return a[field] ? amount(a[field]) : "";
      case "cover":
        return cover?.uploaded && cover.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URL
          <img src={cover.thumbUrl} alt="" className="aspect-[16/10] w-40 rounded-lg object-cover ring-1 ring-line" />
        ) : (
          ""
        );
      case "evidence": {
        const ready = evidence.filter((e) => e.uploaded);
        return ready.length ? (
          <ul className="space-y-1">
            {ready.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2" dir="auto">
                <span className="break-all">{e.name}</span>
                <span className="text-muted">({formatBytes(e.size, locale)})</span>
              </li>
            ))}
          </ul>
        ) : (
          ""
        );
      }
      case "acknowledged":
        return null;
      case "supervisor":
        return cleanSupervisors(a.supervisor, extraSupervisors).join(locale === "ar" ? "، " : ", ");
      default:
        return a[field as AnswerKey];
    }
  }

  const missingCount = Object.keys(missing).filter((k) => k !== "acknowledged").length;

  return (
    <div data-testid="review">
      <header>
        <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink focus:outline-none sm:text-[1.375rem]">
          {t.submit.reviewTitle}
        </h2>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{t.submit.reviewIntro}</p>
      </header>

      {missingCount > 0 ? (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink" role="status">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.submit.errors.fixErrors}
        </p>
      ) : null}

      <div className="mt-6 space-y-5">
        {profile ? <ProfileReview profile={profile} /> : null}
        {SUBMISSION_SECTIONS_LIST.map((section) => {
          const Icon = SECTION_ICONS[section];
          const fields = SUBMISSION_STEPS.filter((s) => s.section === section)
            .flatMap((s) => s.fields)
            .filter(
              (f) =>
                f !== "acknowledged" &&
                !(f === "competitionName" && answers.competition !== "yes") &&
                !(f === "fieldOther" && answers.field !== "other"),
            );
          return (
            <section key={section} className="overflow-hidden rounded-2xl ring-1 ring-line" data-review-section={section}>
              <div className="flex items-center justify-between gap-3 bg-canvas px-4 py-3 sm:px-5">
                <h3 className="flex items-center gap-2 text-[0.9375rem] font-bold text-ink">
                  <Icon className="size-4.5 text-purple" strokeWidth={1.9} aria-hidden />
                  {t.submit.sections[section]}
                </h3>
                <button
                  type="button"
                  onClick={() => onEdit(section)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-purple transition-colors hover:bg-lavender-soft"
                  aria-label={`${t.submit.edit}: ${t.submit.sections[section]}`}
                >
                  <PencilLine className="size-4" aria-hidden />
                  {t.submit.edit}
                </button>
              </div>
              <dl className="divide-y divide-line-soft">
                {fields.map((f) => {
                  const value = display(f);
                  const empty = value === "" || value === null || value === undefined;
                  const isMissing = Boolean(missing[f]);
                  return (
                    <div key={f} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4 sm:px-5" data-review-field={f}>
                      <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                        <span>{q[f as keyof typeof q]}</span>
                        {PRIVATE.includes(f) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f0] px-2 py-0.5 text-[0.6875rem] font-semibold text-danger-ink">
                            <Lock className="size-3" aria-hidden />
                            {t.submit.privateTag}
                          </span>
                        ) : PUBLIC.includes(f) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-teal-deep">
                            <Eye className="size-3" aria-hidden />
                            {t.submit.publicTag}
                          </span>
                        ) : null}
                      </dt>
                      <dd className={cn("min-w-0 whitespace-pre-line break-words text-[0.9375rem] text-ink", isMissing && "text-danger-ink")}>
                        {empty ? (isMissing ? t.submit.errors[missing[f]!] : t.submit.notAnswered) : value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-canvas/70 p-5 sm:p-6">
        <h3 className="text-base font-bold text-ink">{t.submit.ackTitle}</h3>
        <p className="mt-2 text-sm leading-[1.9] text-ink-soft" id="review-ack-text">
          {t.submit.ackText}
        </p>
        <div className="mt-4">
          <Checkbox id="review-acknowledged" checked={acknowledged} onChange={onAcknowledge} label={t.submit.ackCheckbox} describedById="review-ack-text" />
        </div>
      </div>
    </div>
  );
}

/** "Student details from your profile": read-only here, edited on the profile page. */
export function ProfileNotice({ profile }: { profile: ProfileValues }) {
  const { t, locale } = useI18n();
  const p = t.profile;
  const classLine = [
    profile.grade ? gradeLabel(Number(profile.grade), t.grades) : null,
    profile.section ? fmt(t.submit.options.section, { n: formatNumber(Number(profile.section), locale) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-lavender-soft/60 px-4 py-3.5 ring-1 ring-inset ring-purple/10 sm:flex-row sm:items-center" data-testid="profile-notice">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-purple shadow-sm">
        <UserRound className="size-5" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {p.fromProfile}: <span dir="auto">{profile.fullName}</span>
          {classLine ? <span className="font-normal text-muted"> — {classLine}</span> : null}
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{p.fromProfileBody}</p>
      </div>
      <Link href="/profile" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg px-3 text-sm font-semibold text-purple transition-colors hover:bg-white sm:self-center">
        <PencilLine className="size-4" aria-hidden />
        {p.editProfile}
      </Link>
    </div>
  );
}

/** The profile details as they will be linked to the project (private). */
function ProfileReview({ profile }: { profile: ProfileValues }) {
  const { t, locale } = useI18n();
  const p = t.profile;
  const rows: { key: string; label: string; value: string; ltr?: boolean }[] = [
    { key: "fullName", label: p.fields.fullName, value: profile.fullName },
    { key: "nationalId", label: p.fields.nationalId, value: profile.nationalId, ltr: true },
    { key: "phone", label: p.fields.phone, value: profile.phone, ltr: true },
    { key: "email", label: p.fields.email, value: profile.email, ltr: true },
    { key: "grade", label: p.fields.grade, value: profile.grade ? gradeLabel(Number(profile.grade), t.grades) : "" },
    { key: "section", label: p.fields.section, value: profile.section ? fmt(t.submit.options.section, { n: formatNumber(Number(profile.section), locale) }) : "" },
  ];
  return (
    <section className="overflow-hidden rounded-2xl ring-1 ring-line" data-review-section="profile">
      <div className="flex items-center justify-between gap-3 bg-canvas px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-bold text-ink">
          <UserRound className="size-4.5 text-purple" strokeWidth={1.9} aria-hidden />
          {p.fromProfile}
        </h3>
        <Link
          href="/profile"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-purple transition-colors hover:bg-lavender-soft"
        >
          <PencilLine className="size-4" aria-hidden />
          {p.editProfile}
        </Link>
      </div>
      <dl className="divide-y divide-line-soft">
        {rows.map((r) => (
          <div key={r.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4 sm:px-5" data-review-field={r.key}>
            <dt className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
              <span>{r.label}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f0] px-2 py-0.5 text-[0.6875rem] font-semibold text-danger-ink">
                <Lock className="size-3" aria-hidden />
                {t.submit.privateTag}
              </span>
            </dt>
            <dd className={cn("min-w-0 break-words text-[0.9375rem] text-ink", r.ltr && "rtl:text-right")} dir={r.ltr ? "ltr" : "auto"}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
