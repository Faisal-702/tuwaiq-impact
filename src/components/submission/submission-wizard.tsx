"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  FileStack,
  FileText,
  Home,
  Info,
  Loader2,
  PieChart,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonClasses, Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { useI18n } from "@/i18n/client";
import { fmt, formatNumber, gradeLabel } from "@/i18n/format";
import {
  PROJECT_FIELDS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  SUPERVISOR_MAX_LENGTH,
  SUPERVISORS_MAX,
  SUBMISSION_GRADES,
  SUBMISSION_SECTIONS,
  SUBMISSION_SECTIONS_LIST,
  SUBMISSION_STEPS,
  SUMMARY_MAX,
  validateSubmission,
  YES_NO,
  type AnswerKey,
  type EvidenceFile,
  type FieldError,
  type StepField,
  type SubmissionAnswers,
  type SubmissionSection,
} from "@/lib/submission";
import { cn } from "@/lib/utils";
import { discardSubmissionDraft, saveProjectEdit, saveSubmissionDraft, submitProject } from "@/server/actions/submissions";
import type { DraftView } from "@/server/submissions";
import { Checkbox, ChoiceCards, describedBy, FieldShell, SelectInput, TextArea, TextInput } from "./fields";
import { SubmissionReview } from "./review";
import { CoverUpload, EvidenceUpload, SubmissionTargetProvider } from "./uploads";

const SECTION_ICONS: Record<SubmissionSection, LucideIcon> = {
  student: UserRound,
  details: FileText,
  classification: PieChart,
  attachments: FileStack,
};

const REVIEW = SUBMISSION_STEPS.length;
const AUTOSAVE_MS = 2500;

type Errors = Partial<Record<StepField, FieldError>>;
type SaveState = { status: "idle" | "saving" | "saved" | "error"; at?: string };

/** Editing one of the student's published projects (the same form, applied on "Save changes"). */
export type WizardEdit = { projectId: string; slug: string; published: boolean };

export function SubmissionWizard({ initial, restored, edit }: { initial: DraftView; restored: boolean; edit?: WizardEdit }) {
  const { t, locale, dir } = useI18n();
  const router = useRouter();
  const target = edit?.projectId ?? null;
  const [answers, setAnswers] = useState<SubmissionAnswers>(initial.answers);
  const [extraSupervisors, setExtraSupervisors] = useState<string[]>(initial.extraSupervisors);
  const [cover, setCover] = useState<DraftView["cover"]>(initial.cover);
  const [evidence, setEvidence] = useState<EvidenceFile[]>(initial.evidence);
  const [acknowledged, setAcknowledged] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(restored ? { status: "saved", at: initial.updatedAt } : { status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string } | null>(null);
  const [showRestored, setShowRestored] = useState(restored);
  const version = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const context = { hasCover: Boolean(cover?.uploaded), acknowledged };
  const isReview = stepIndex === REVIEW;
  const step = SUBMISSION_STEPS[Math.min(stepIndex, REVIEW - 1)];
  const sectionIndex = isReview ? SUBMISSION_SECTIONS_LIST.length - 1 : SUBMISSION_SECTIONS_LIST.indexOf(step.section);
  const sectionSteps = SUBMISSION_STEPS.filter((s) => s.section === step.section);
  const partIndex = sectionSteps.indexOf(step);
  const progress = Math.round(((isReview ? REVIEW : stepIndex) / REVIEW) * 100);

  const sessionError = useCallback(
    (code: string) => (code === "unauthorized" ? t.submit.errors.session : code === "limit" ? t.submit.errors.limit : t.submit.errors.server),
    [t],
  );

  const save = useCallback(
    async (mode: "auto" | "manual") => {
      const saving = version.current;
      setSaveState((s) => ({ ...s, status: "saving" }));
      try {
        const res = await saveSubmissionDraft(answers, extraSupervisors, target);
        if (!res.ok) throw new Error(res.error);
        if (version.current === saving) setDirty(false);
        setSaveState({ status: "saved", at: res.data.updatedAt });
        if (mode === "manual") toast.success(t.submit.draftSaved);
        return true;
      } catch (e) {
        setSaveState({ status: "error" });
        if (mode === "manual") toast.error(sessionError(e instanceof Error ? e.message : "server"));
        return false;
      }
    },
    [answers, extraSupervisors, target, t, sessionError],
  );

  // Autosave shortly after the student stops typing.
  useEffect(() => {
    if (!dirty || done) return;
    const id = setTimeout(() => void save("auto"), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [dirty, done, save]);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!dirty || done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, done]);

  function set(key: AnswerKey, value: string) {
    version.current += 1;
    setDirty(true);
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      // Conditional follow-up questions are cleared when they no longer apply.
      if (key === "competition" && value !== "yes") next.competitionName = "";
      if (key === "field" && value !== "other") next.fieldOther = "";
      return next;
    });
    setErrors((prev) => {
      if (!prev[key] && !(key === "projectType" && prev.participants)) return prev;
      const next = { ...prev };
      delete next[key];
      if (key === "projectType") delete next.participants;
      return next;
    });
  }

  /** Additional supervisor / teacher inputs (the first one is the "supervisor" answer). */
  function setSupervisors(update: (list: string[]) => string[]) {
    version.current += 1;
    setDirty(true);
    setExtraSupervisors((list) => update(list));
  }
  function addSupervisor() {
    if (extraSupervisors.length >= SUPERVISORS_MAX - 1) return;
    const index = extraSupervisors.length;
    setSupervisors((list) => [...list, ""]);
    requestAnimationFrame(() => document.getElementById(`supervisor-${index + 2}`)?.focus());
  }

  function clearError(key: StepField) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function go(index: number) {
    setFormError(null);
    setShowRestored(false);
    setStepIndex(index);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  function focusFirstError(errs: Errors, fields: StepField[]) {
    const first = fields.find((f) => errs[f]);
    if (!first) return;
    requestAnimationFrame(() => {
      const wrapper = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
      wrapper?.scrollIntoView({ block: "center", behavior: "smooth" });
      const el = document.getElementById(first) ?? wrapper?.querySelector<HTMLElement>("input,textarea,select,button");
      el?.focus({ preventScroll: true });
    });
  }

  function next() {
    const errs = validateSubmission(answers, context, step.fields);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setFormError(t.submit.errors.fixErrors);
      focusFirstError(errs, step.fields);
      return;
    }
    setErrors({});
    if (dirty) void save("auto");
    go(stepIndex + 1);
  }

  function previous() {
    setErrors({});
    if (dirty) void save("auto");
    go(Math.max(0, stepIndex - 1));
  }

  function editSection(section: SubmissionSection) {
    go(SUBMISSION_STEPS.findIndex((s) => s.section === section));
  }

  const allErrors = validateSubmission(answers, context);
  const canSubmit = Object.keys(allErrors).length === 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      // The server validates the stored answers, so store the latest first.
      const saved = await saveSubmissionDraft(answers, extraSupervisors, target);
      if (!saved.ok) throw new Error(saved.error);
      setDirty(false);
      const res = edit ? await saveProjectEdit({ projectId: edit.projectId, acknowledged }) : await submitProject({ acknowledged });
      if (res.ok) {
        setDone(res.data);
        requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
        router.refresh();
        return;
      }
      if ((res.error === "validation" || res.error === "below_recorded") && res.fields) {
        const errs = res.fields;
        const index = SUBMISSION_STEPS.findIndex((s) => s.fields.some((f) => errs[f]));
        setErrors(errs);
        if (index >= 0) {
          go(index);
          setFormError(
            res.error === "below_recorded"
              ? fmt(t.myProjects.edit.belowRecorded, { amount: `${formatNumber(res.recorded ?? 0, locale)} ${t.submit.currency}` })
              : t.submit.errors.fixErrors,
          );
          focusFirstError(errs, SUBMISSION_STEPS[index].fields);
        }
        return;
      }
      setFormError(sessionError(res.error));
    } catch (e) {
      setFormError(sessionError(e instanceof Error ? e.message : "server"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return edit ? <EditSuccessCard ref={topRef} title={done.title} edit={edit} /> : <SuccessCard ref={topRef} title={done.title} />;

  // "Correct the highlighted fields" goes away once nothing is highlighted.
  const aboutFields = formError === t.submit.errors.fixErrors || Boolean(formError?.startsWith(t.myProjects.edit.belowRecorded.split("{")[0]));
  const shownFormError = aboutFields && Object.keys(errors).length === 0 ? null : formError;

  const errorText = (field: StepField) => {
    const code = errors[field];
    return code ? t.submit.errors[code] : undefined;
  };

  /** Shared props for a text question. */
  const text = (key: AnswerKey) => {
    const error = errorText(key);
    const hint = (t.submit.hints as Partial<Record<string, string>>)[key];
    return {
      shell: { id: key, label: t.submit.questions[key as keyof typeof t.submit.questions], error, hint },
      input: {
        id: key,
        value: answers[key],
        onChange: (v: string) => set(key, v),
        invalid: Boolean(error),
        describedById: describedBy(key, error, hint),
        placeholder: (t.submit.placeholders as Partial<Record<string, string>>)[key],
      },
    };
  };

  const choice = (key: AnswerKey, options: { value: string; label: string }[], columns: 2 | 3 = 3) => {
    const error = errorText(key);
    return (
      <FieldShell id={key} label={t.submit.questions[key as keyof typeof t.submit.questions]} required error={error}>
        <ChoiceCards
          name={key}
          labelledBy={`${key}-label`}
          value={answers[key]}
          onChange={(v) => set(key, v)}
          options={options}
          invalid={Boolean(error)}
          describedById={describedBy(key, error)}
          columns={columns}
        />
      </FieldShell>
    );
  };

  const yesNo = YES_NO.map((v) => ({ value: v, label: t.submit.options[v] }));

  function renderField(field: StepField) {
    switch (field) {
      case "supervisor": {
        const p = text(field);
        return (
          <div key={field} className="space-y-3 sm:col-span-2" data-testid="supervisors">
            <FieldShell {...p.shell} required>
              <TextInput {...p.input} autoComplete="off" maxLength={SUPERVISOR_MAX_LENGTH} />
            </FieldShell>
            {extraSupervisors.map((name, i) => (
              <div key={i} className="flex items-center gap-2" data-testid="extra-supervisor">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`supervisor-${i + 2}`} className="sr-only">
                    {fmt(t.myProjects.supervisorN, { n: formatNumber(i + 2, locale) })}
                  </label>
                  <TextInput
                    id={`supervisor-${i + 2}`}
                    value={name}
                    onChange={(v) => setSupervisors((list) => list.map((x, j) => (j === i ? v : x)))}
                    invalid={false}
                    autoComplete="off"
                    maxLength={SUPERVISOR_MAX_LENGTH}
                    placeholder={fmt(t.myProjects.supervisorN, { n: formatNumber(i + 2, locale) })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSupervisors((list) => list.filter((_, j) => j !== i))}
                  className="grid size-12 shrink-0 place-items-center rounded-xl text-muted ring-1 ring-inset ring-line transition hover:bg-danger-soft hover:text-danger-ink"
                  aria-label={fmt(t.myProjects.removeSupervisor, { n: formatNumber(i + 2, locale) })}
                  data-testid="remove-supervisor"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {extraSupervisors.length < SUPERVISORS_MAX - 1 ? (
              <button
                type="button"
                onClick={addSupervisor}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-purple transition hover:bg-lavender-soft"
                data-testid="add-supervisor"
              >
                <Plus className="size-4" aria-hidden />
                {t.myProjects.addSupervisor}
              </button>
            ) : null}
          </div>
        );
      }
      case "studentName":
      case "title":
      case "competitionName":
      case "fieldOther": {
        const p = text(field);
        return (
          <FieldShell key={field} {...p.shell} required className="sm:col-span-2">
            <TextInput {...p.input} autoComplete={field === "studentName" ? "name" : "off"} maxLength={field === "fieldOther" ? 80 : field === "studentName" ? 120 : 150} />
          </FieldShell>
        );
      }
      case "nationalId":
      case "phone": {
        const p = text(field);
        return (
          <FieldShell key={field} {...p.shell} required>
            <TextInput
              {...p.input}
              inputMode="numeric"
              autoComplete={field === "phone" ? "tel-national" : "off"}
              dir="ltr"
              className="rtl:text-right"
              maxLength={field === "phone" ? 16 : 12}
            />
          </FieldShell>
        );
      }
      case "email": {
        const p = text(field);
        return (
          <FieldShell key={field} {...p.shell} required className="sm:col-span-2">
            <TextInput {...p.input} type="email" inputMode="email" autoComplete="email" dir="ltr" className="rtl:text-right" maxLength={254} />
          </FieldShell>
        );
      }
      case "grade":
        return (
          <div key={field} className="sm:col-span-2">
            {choice(
              "grade",
              SUBMISSION_GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, t.grades) })),
            )}
          </div>
        );
      case "section":
        return (
          <div key={field} className="sm:col-span-2">
            {choice(
              "section",
              SUBMISSION_SECTIONS.map((n) => ({ value: String(n), label: fmt(t.submit.options.section, { n: formatNumber(n, locale) }) })),
            )}
          </div>
        );
      case "projectType":
        return (
          <div key={field} className="sm:col-span-2">
            {choice("projectType", PROJECT_TYPES.map((v) => ({ value: v, label: t.submit.options.projectType[v] })))}
          </div>
        );
      case "competition":
        return (
          <div key={field} className="sm:col-span-2">
            {choice("competition", yesNo, 2)}
          </div>
        );
      case "projectStatus":
        return (
          <div key={field} className="sm:col-span-2">
            {choice("projectStatus", PROJECT_STATUSES.map((v) => ({ value: v, label: t.submit.options.projectStatus[v] })), 2)}
          </div>
        );
      case "participants": {
        const p = text(field);
        const required = answers.projectType === "group";
        return (
          <FieldShell key={field} {...p.shell} required={required} optional={required ? undefined : t.common.optional} className="sm:col-span-2">
            <TextArea {...p.input} rows={3} maxLength={1000} />
          </FieldShell>
        );
      }
      case "description":
      case "goals":
      case "idea":
      case "problem":
      case "tools": {
        const p = text(field);
        return (
          <FieldShell key={field} {...p.shell} required className="sm:col-span-2">
            <TextArea {...p.input} rows={field === "description" ? 3 : 4} maxLength={field === "description" ? 1500 : 2000} />
          </FieldShell>
        );
      }
      case "summary": {
        const p = text(field);
        const n = answers.summary.length;
        return (
          <FieldShell
            key={field}
            {...p.shell}
            required
            className="sm:col-span-2"
            counter={
              <span
                data-testid="summary-counter"
                aria-live="polite"
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                  n >= SUMMARY_MAX ? "bg-danger-soft text-danger-ink" : n >= SUMMARY_MAX * 0.9 ? "bg-[#fff7e6] text-[#9a6700]" : "bg-canvas text-muted",
                )}
              >
                <span dir="ltr">{fmt(t.submit.counter, { n: formatNumber(n, locale), max: formatNumber(SUMMARY_MAX, locale) })}</span>
              </span>
            }
          >
            <TextArea {...p.input} onChange={(v) => set("summary", v.slice(0, SUMMARY_MAX))} rows={4} maxLength={SUMMARY_MAX} />
          </FieldShell>
        );
      }
      case "field": {
        const error = errorText(field);
        return (
          <FieldShell key={field} id="field" label={t.submit.questions.field} required error={error} className="sm:col-span-2">
            <SelectInput
              id="field"
              value={answers.field}
              onChange={(v) => set("field", v)}
              invalid={Boolean(error)}
              describedById={describedBy("field", error)}
              placeholder={t.submit.placeholders.field}
              options={PROJECT_FIELDS.map((f) => ({ value: f.key, label: locale === "ar" ? f.ar : f.en }))}
            />
          </FieldShell>
        );
      }
      case "toolsCost":
      case "requestedAmount": {
        const p = text(field);
        return (
          <FieldShell key={field} {...p.shell} required>
            <TextInput {...p.input} inputMode="decimal" placeholder={t.submit.placeholders.amount} suffix={t.submit.currency} maxLength={20} autoComplete="off" />
          </FieldShell>
        );
      }
      case "cover": {
        const error = errorText("cover");
        return (
          <FieldShell key={field} id="cover" label={t.submit.questions.cover} required error={error} hint={t.submit.hints.cover} className="sm:col-span-2">
            <CoverUpload
              cover={cover}
              onChange={(c) => {
                setCover(c);
                if (c?.uploaded) clearError("cover");
              }}
              invalid={Boolean(error)}
              describedById={describedBy("cover", error, t.submit.hints.cover)}
            />
          </FieldShell>
        );
      }
      case "evidence":
        return (
          <FieldShell key={field} id="evidence" label={t.submit.questions.evidence} optional={t.common.optional} hint={t.submit.hints.evidence} className="sm:col-span-2">
            <EvidenceUpload files={evidence} onChange={setEvidence} describedById="evidence-hint" />
          </FieldShell>
        );
      case "acknowledged":
        return <Acknowledgment key={field} checked={acknowledged} onChange={(c) => { setAcknowledged(c); if (c) clearError("acknowledged"); }} error={errorText("acknowledged")} />;
    }
  }

  const visibleFields = step.fields.filter(
    (f) => !(f === "competitionName" && answers.competition !== "yes") && !(f === "fieldOther" && answers.field !== "other"),
  );
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <SubmissionTargetProvider value={target}>
    <div ref={topRef} className="scroll-mt-24">
      <StepsHeader current={sectionIndex} progress={progress} isReview={isReview} onSelect={(i) => editSection(SUBMISSION_SECTIONS_LIST[i])} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section
          aria-labelledby="step-heading"
          className="min-w-0 rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-line-soft sm:p-8"
          data-step={isReview ? "review" : step.id}
        >
          {showRestored ? (
            <p className="mb-6 flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-sm font-medium text-teal-deep" role="status" data-testid="draft-restored">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {edit ? t.myProjects.edit.pendingRestored : t.submit.draftRestored}
            </p>
          ) : null}
          {isReview ? (
            <SubmissionReview
              headingRef={headingRef}
              answers={answers}
              cover={cover}
              evidence={evidence}
              acknowledged={acknowledged}
              onAcknowledge={(c) => {
                setAcknowledged(c);
                if (c) clearError("acknowledged");
              }}
              onEdit={editSection}
              missing={allErrors}
              extraSupervisors={extraSupervisors}
            />
          ) : (
            <>
              <header className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lavender-soft text-purple">
                  {(() => {
                    const Icon = SECTION_ICONS[step.section];
                    return <Icon className="size-6" strokeWidth={1.8} aria-hidden />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold text-ink focus:outline-none sm:text-[1.375rem]">
                      {t.submit.sections[step.section]}
                    </h2>
                    {sectionSteps.length > 1 ? (
                      <span className="rounded-full bg-mint-soft px-2.5 py-0.5 text-xs font-semibold text-teal-deep" data-testid="part-of">
                        {fmt(t.submit.partOf, { current: formatNumber(partIndex + 1, locale), total: formatNumber(sectionSteps.length, locale) })}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{t.submit.sectionIntro[step.section]}</p>
                </div>
              </header>
              <div className="my-6 h-px bg-line-soft" />
              <div key={step.id} className="grid gap-x-5 gap-y-6 sm:grid-cols-2 motion-safe:animate-[fade-in_220ms_ease-out]">
                {visibleFields.map(renderField)}
              </div>
            </>
          )}

          {shownFormError ? (
            <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink" data-testid="form-error">
              {shownFormError}
            </p>
          ) : null}

          <footer className="mt-8 flex flex-col-reverse gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <Button variant="subtle" onClick={previous} disabled={submitting} data-testid="wizard-previous" className="flex-1 sm:flex-none">
                  <Back className="size-4" aria-hidden />
                  {t.submit.previous}
                </Button>
              ) : null}
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" disabled={submitting} data-testid="wizard-cancel" className="flex-1 sm:flex-none">
                    {t.submit.cancel}
                  </Button>
                }
                title={edit ? t.myProjects.edit.cancelTitle : t.submit.cancelTitle}
                body={edit ? t.myProjects.edit.cancelBody : t.submit.cancelBody}
                confirmLabel={edit ? t.myProjects.edit.cancelConfirm : t.submit.cancelConfirm}
                cancelLabel={t.submit.keepEditing}
                onConfirm={async () => {
                  await discardSubmissionDraft(target);
                  setDirty(false);
                  router.push(edit ? "/my-projects" : "/home");
                }}
              />
            </div>
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
              <SaveStatus state={saveState} dirty={dirty} />
              <Button variant="secondary" onClick={() => void save("manual")} disabled={submitting || saveState.status === "saving"} data-testid="wizard-save">
                <Save className="size-4" aria-hidden />
                {edit ? t.myProjects.edit.saveDraft : t.submit.saveDraft}
              </Button>
              {isReview ? (
                <Button onClick={submit} disabled={!canSubmit} aria-disabled={!canSubmit} data-testid="wizard-submit">
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                  {submitting ? (edit ? t.myProjects.edit.saving : t.submit.submitting) : edit ? t.myProjects.edit.save : t.submit.submitProject}
                </Button>
              ) : (
                <Button onClick={next} data-testid="wizard-next">
                  {stepIndex === REVIEW - 1 ? t.submit.toReview : t.submit.next}
                  <Arrow className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </footer>
        </section>

        <InfoPanel section={isReview ? "attachments" : step.section} />
      </div>
    </div>
    </SubmissionTargetProvider>
  );
}

// ---------------------------------------------------------------------------

function StepsHeader({
  current,
  progress,
  isReview,
  onSelect,
}: {
  current: number;
  progress: number;
  isReview: boolean;
  onSelect: (index: number) => void;
}) {
  const { t, locale } = useI18n();
  const total = SUBMISSION_SECTIONS_LIST.length;
  return (
    <nav aria-label={t.submit.progressLabel} className="rounded-[1.5rem] bg-white p-4 shadow-soft ring-1 ring-line-soft sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{t.submit.progressLabel}</p>
        <span className="rounded-full bg-lavender-soft px-3 py-1 text-xs font-bold text-purple-ink" data-testid="section-of">
          {fmt(t.submit.stepOf, { current: formatNumber(current + 1, locale), total: formatNumber(total, locale) })}
        </span>
      </div>
      <ol className="mt-5 grid grid-cols-4 gap-1 sm:gap-3">
        {SUBMISSION_SECTIONS_LIST.map((section, i) => {
          const Icon = SECTION_ICONS[section];
          const complete = i < current || (isReview && i === current);
          const active = i === current && !isReview;
          const reachable = i < current || isReview;
          return (
            <li key={section} className="relative flex flex-col items-center text-center">
              {i < total - 1 ? (
                // From this step's centre to the next one's (logical, so it follows RTL).
                <span
                  aria-hidden
                  className={cn("absolute start-1/2 top-[1.4375rem] h-0.5 w-full sm:top-[1.6875rem]", i < current || isReview ? "bg-teal" : "bg-line")}
                />
              ) : null}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className="group relative z-10 flex flex-col items-center gap-2 rounded-xl p-1 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "relative grid size-10 place-items-center rounded-full transition-colors sm:size-12",
                    active
                      ? "bg-purple text-white shadow-[0_8px_20px_-8px_rgb(109_74_255/0.7)]"
                      : complete
                        ? "bg-teal-deep text-white group-hover:bg-teal-strong"
                        : "bg-canvas text-muted ring-1 ring-line",
                  )}
                >
                  {complete ? <Check className="size-5" strokeWidth={2.5} aria-hidden /> : <Icon className="size-5" strokeWidth={1.8} aria-hidden />}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -top-1 -end-1 grid size-5 place-items-center rounded-full text-[0.6875rem] font-bold ring-2 ring-white",
                      active ? "bg-teal text-white" : complete ? "bg-white text-teal-deep" : "bg-white text-muted",
                    )}
                  >
                    {formatNumber(i + 1, locale)}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[0.6875rem] font-semibold leading-tight sm:text-sm",
                    active ? "text-purple-ink" : complete ? "text-teal-deep" : "text-muted",
                  )}
                >
                  {t.submit.sections[section]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-line-soft"
        role="progressbar"
        aria-label={t.submit.progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-purple to-teal transition-[width] duration-500 ease-out ltr:bg-gradient-to-r"
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
      </div>
    </nav>
  );
}

function SaveStatus({ state, dirty }: { state: SaveState; dirty: boolean }) {
  const { t, locale } = useI18n();
  let label: string | null = null;
  if (state.status === "saving") label = t.submit.saving;
  else if (state.status === "saved" && state.at && !dirty)
    label = fmt(t.submit.savedAt, {
      time: new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(state.at)),
    });
  return (
    <span className="text-center text-xs text-muted sm:text-end" aria-live="polite" data-testid="save-status">
      {label}
    </span>
  );
}

function Acknowledgment({ checked, onChange, error }: { checked: boolean; onChange: (c: boolean) => void; error?: string }) {
  const { t } = useI18n();
  return (
    <div className="sm:col-span-2" data-field="acknowledged">
      <div className="rounded-2xl border border-line bg-canvas/70 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <ShieldCheck className="size-5 text-teal-deep" aria-hidden />
          {t.submit.ackTitle}
        </h3>
        <p className="mt-3 text-[0.9375rem] leading-[1.9] text-ink-soft" id="ack-text">
          {t.submit.ackText}
        </p>
      </div>
      <div className={cn("mt-4 rounded-xl border px-4 py-3.5", error ? "border-danger-ink/40 bg-danger-soft/40" : checked ? "border-purple/40 bg-lavender-soft/60" : "border-line")}>
        <Checkbox id="acknowledged" checked={checked} onChange={onChange} label={t.submit.ackCheckbox} invalid={Boolean(error)} describedById={error ? "acknowledged-error" : "ack-text"} />
      </div>
      {error ? (
        <p id="acknowledged-error" role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InfoPanel({ section }: { section: SubmissionSection }) {
  const { t } = useI18n();
  return (
    <aside className="space-y-4 lg:sticky lg:top-24" aria-label={t.submit.infoTitle}>
      <div className="rounded-[1.5rem] bg-white p-6 shadow-soft ring-1 ring-line-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-mint-soft text-teal-deep">
            <Info className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <h2 className="text-base font-bold text-ink">{t.submit.infoTitle}</h2>
        </div>
        <p key={section} className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft motion-safe:animate-[fade-in_220ms_ease-out]" data-testid="info-text">
          {t.submit.info[section]}
        </p>
        <div className="mt-6 hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- static decorative art */}
          <img src="/images/entry-scene-left.webp" alt="" className="mx-auto h-44 w-full rounded-xl object-cover object-[50%_70%]" loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl bg-lavender-soft/70 p-4 text-[0.8125rem] leading-relaxed text-purple-ink ring-1 ring-purple/10">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{t.submit.privacyNote}</p>
      </div>
    </aside>
  );
}

function SuccessCard({ title, ref }: { title: string; ref: React.Ref<HTMLDivElement> }) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div ref={ref} className="scroll-mt-24">
      <section
        className="mx-auto max-w-2xl rounded-[1.75rem] bg-white px-6 py-12 text-center shadow-soft ring-1 ring-line-soft motion-safe:animate-[fade-in_300ms_ease-out] sm:px-12"
        data-testid="submit-success"
        aria-labelledby="success-heading"
      >
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-mint-soft text-teal-deep ring-8 ring-mint-soft/50">
          <CheckCircle2 className="size-10" strokeWidth={1.8} aria-hidden />
        </span>
        <h2 id="success-heading" ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-bold text-ink focus:outline-none sm:text-3xl">
          {t.submit.successTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[1.0625rem] leading-relaxed text-muted">{fmt(t.submit.successBody, { title })}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/projects" className={buttonClasses("primary", "md")}>
            <Compass className="size-4" aria-hidden />
            {t.submit.successExplore}
          </Link>
          {/* A full load starts a fresh draft. */}
          <a href="/add-project" className={buttonClasses("secondary", "md")}>
            <Plus className="size-4" aria-hidden />
            {t.submit.successAnother}
          </a>
          <Link href="/home" className={buttonClasses("ghost", "md")}>
            <Home className="size-4" aria-hidden />
            {t.submit.successHome}
          </Link>
        </div>
      </section>
    </div>
  );
}

function EditSuccessCard({ title, edit, ref }: { title: string; edit: WizardEdit; ref: React.Ref<HTMLDivElement> }) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div ref={ref} className="scroll-mt-24">
      <section
        className="mx-auto max-w-2xl rounded-[1.75rem] bg-white px-6 py-12 text-center shadow-soft ring-1 ring-line-soft motion-safe:animate-[fade-in_300ms_ease-out] sm:px-12"
        data-testid="edit-success"
        aria-labelledby="edit-success-heading"
      >
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-mint-soft text-teal-deep ring-8 ring-mint-soft/50">
          <CheckCircle2 className="size-10" strokeWidth={1.8} aria-hidden />
        </span>
        <h2 id="edit-success-heading" ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-bold text-ink focus:outline-none sm:text-3xl">
          {t.myProjects.edit.successTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[1.0625rem] leading-relaxed text-muted">{fmt(t.myProjects.edit.successBody, { title })}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/my-projects" className={buttonClasses("primary", "md")}>
            {t.myProjects.edit.backToMyProjects}
          </Link>
          {edit.published ? (
            <Link href={`/projects/${edit.slug}`} className={buttonClasses("secondary", "md")}>
              {t.myProjects.actions.view}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
