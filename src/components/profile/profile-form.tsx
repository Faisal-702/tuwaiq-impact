"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, FolderOpen, Loader2, Lock, Plus, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChoiceCards, describedBy, FieldShell, TextInput } from "@/components/submission/fields";
import Link from "@/components/ui/link";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime, formatNumber, gradeLabel } from "@/i18n/format";
import { EMAIL_MAX, FULL_NAME_MAX, PROFILE_FIELDS, validateProfile, type ProfileField, type ProfileValues } from "@/lib/profile";
import type { FieldError } from "@/lib/submission";
import { SUBMISSION_GRADES, SUBMISSION_SECTIONS } from "@/lib/submission";
import { cn } from "@/lib/utils";
import { saveProfile } from "@/server/actions/profile";
import type { ProfileStatus } from "@/server/profiles";

type Errors = Partial<Record<ProfileField, FieldError>>;

/**
 * The student's profile: every field is required. The status card shows
 * what the server last saved (complete or not, and what is missing); the
 * server validates again on save.
 */
export function ProfileForm({ initial, required, next }: { initial: ProfileStatus; required: boolean; next: string | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const p = t.profile;
  const [values, setValues] = useState<ProfileValues>(initial.values);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState({ complete: initial.complete, missing: initial.missing, updatedAt: initial.updatedAt, saved: initial.saved });
  const [saving, setSaving] = useState(false);
  const suggested = !initial.saved && (values.fullName !== "" || values.grade !== "" || values.section !== "");

  const set = (key: ProfileField, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const focusFirst = (errs: Errors) => {
    const first = PROFILE_FIELDS.find((f) => errs[f]);
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateProfile(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirst(errs);
      return;
    }
    setSaving(true);
    try {
      const res = await saveProfile(values);
      if (!res.ok) {
        if (res.error === "validation" && res.fields) {
          setErrors(res.fields);
          focusFirst(res.fields);
        } else toast.error(res.error === "unauthorized" ? t.submit.errors.session : t.submit.errors.server);
        return;
      }
      setStatus({ complete: res.data.complete, missing: [], updatedAt: res.data.updatedAt, saved: true });
      if (res.data.complete && next) {
        toast.success(p.savedContinue);
        router.push(next);
        return;
      }
      toast.success(p.saved);
      router.refresh();
    } catch {
      toast.error(t.submit.errors.server);
    } finally {
      setSaving(false);
    }
  }

  const error = (key: ProfileField) => (errors[key] ? t.submit.errors[errors[key]!] : undefined);
  const hint = (key: ProfileField) => (p.hints as Partial<Record<ProfileField, string>>)[key];
  const text = (key: ProfileField) => ({
    shell: { id: key, label: p.fields[key], error: error(key), hint: hint(key), required: true },
    input: {
      id: key,
      value: values[key],
      onChange: (v: string) => set(key, v),
      invalid: Boolean(errors[key]),
      describedById: describedBy(key, error(key), hint(key)),
      placeholder: (p.placeholders as Partial<Record<ProfileField, string>>)[key],
    },
  });

  const done = PROFILE_FIELDS.length - status.missing.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      {/* Status (first on small screens: it says what is missing). */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:order-2">
        <section
          className="rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-line-soft sm:p-6"
          aria-labelledby="profile-status-title"
          data-testid="profile-status"
          data-complete={status.complete}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="profile-status-title" className="text-base font-bold text-ink">
              {p.statusTitle}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                status.complete ? "bg-mint-soft text-teal-deep" : "bg-[#fef4ec] text-[#b45e3e]",
              )}
              data-testid="profile-badge"
            >
              {status.complete ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
              {status.complete ? p.statusComplete : p.statusIncomplete}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{fmt(p.progress, { done: formatNumber(done, locale), total: formatNumber(PROFILE_FIELDS.length, locale) })}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e7f3]"
              role="progressbar"
              aria-label={p.statusTitle}
              aria-valuemin={0}
              aria-valuemax={PROFILE_FIELDS.length}
              aria-valuenow={done}
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", status.complete ? "bg-[#5cc5c2]" : "bg-[#f0a36b]")}
                style={{ width: `${(done / PROFILE_FIELDS.length) * 100}%` }}
              />
            </div>
          </div>
          {status.complete ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{p.completeBody}</p>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{p.incompleteBody}</p>
              <ul className="mt-2.5 space-y-1.5" data-testid="profile-missing">
                {status.missing.map((f) => (
                  <li key={f} data-field={f} className="flex items-center gap-2 text-sm font-medium text-[#b45e3e]">
                    <span className="size-1.5 shrink-0 rounded-full bg-[#f0a36b]" aria-hidden />
                    {p.fields[f]}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 border-t border-line-soft pt-3 text-xs text-muted" data-testid="profile-saved-at">
            {status.updatedAt ? fmt(p.lastSaved, { time: formatDateTime(status.updatedAt, locale) }) : p.notSaved}
          </p>
          {status.complete ? (
            <div className="mt-4 grid gap-2">
              <Link
                href="/add-project"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5c3bfc] px-4 text-sm font-bold text-white transition hover:bg-[#4c2ee0]"
                data-testid="profile-add-project"
              >
                <Plus className="size-4" aria-hidden />
                {next ? p.continueToProject : p.addProject}
              </Link>
              <Link
                href="/my-projects"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#5c3bfc] ring-1 ring-inset ring-[#d9d2fe] transition hover:bg-[#f2f0fe]"
              >
                <FolderOpen className="size-4" aria-hidden />
                {p.myProjects}
              </Link>
            </div>
          ) : null}
        </section>
      </aside>

      <div className="min-w-0 space-y-4 lg:order-1">
        {required ? (
          <div className="flex items-start gap-3 rounded-2xl bg-[#fef4ec] px-4 py-4 ring-1 ring-inset ring-[#f6d9c3] sm:px-5" role="alert" data-testid="profile-required">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#d9822b]" aria-hidden />
            <div>
              <p className="font-bold text-[#b45e3e]">{p.requiredTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#7a4a33]">{p.requiredBody}</p>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-line-soft sm:p-8" data-testid="profile-form">
          <header className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lavender-soft text-purple">
              <UserRound className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-ink sm:text-[1.375rem]">{p.sectionTitle}</h2>
              <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {p.privacy}
              </p>
            </div>
          </header>
          {suggested ? (
            <p className="mt-5 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft" data-testid="profile-suggested">
              {p.suggested}
            </p>
          ) : null}
          <div className="my-6 h-px bg-line-soft" />

          <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {(() => {
              const f = text("fullName");
              return (
                <FieldShell {...f.shell} className="sm:col-span-2">
                  <TextInput {...f.input} icon={UserRound} autoComplete="name" maxLength={FULL_NAME_MAX} />
                </FieldShell>
              );
            })()}
            {(() => {
              const f = text("nationalId");
              return (
                <FieldShell {...f.shell}>
                  <TextInput {...f.input} inputMode="numeric" autoComplete="off" dir="ltr" className="rtl:text-right" maxLength={12} />
                </FieldShell>
              );
            })()}
            {(() => {
              const f = text("phone");
              return (
                <FieldShell {...f.shell}>
                  <TextInput {...f.input} inputMode="tel" autoComplete="tel-national" dir="ltr" className="rtl:text-right" maxLength={16} />
                </FieldShell>
              );
            })()}
            {(() => {
              const f = text("email");
              return (
                <FieldShell {...f.shell} className="sm:col-span-2">
                  <TextInput {...f.input} type="email" inputMode="email" autoComplete="email" dir="ltr" className="rtl:text-right" maxLength={EMAIL_MAX} />
                </FieldShell>
              );
            })()}
            <div className="sm:col-span-2">
              <FieldShell id="grade" label={p.fields.grade} required error={error("grade")}>
                <ChoiceCards
                  name="grade"
                  labelledBy="grade-label"
                  value={values.grade}
                  onChange={(v) => set("grade", v)}
                  options={SUBMISSION_GRADES.map((g) => ({ value: String(g), label: gradeLabel(g, t.grades) }))}
                  invalid={Boolean(errors.grade)}
                  describedById={describedBy("grade", error("grade"))}
                />
              </FieldShell>
            </div>
            <div className="sm:col-span-2">
              <FieldShell id="section" label={p.fields.section} required error={error("section")}>
                <ChoiceCards
                  name="section"
                  labelledBy="section-label"
                  value={values.section}
                  onChange={(v) => set("section", v)}
                  options={SUBMISSION_SECTIONS.map((n) => ({ value: String(n), label: fmt(t.submit.options.section, { n: formatNumber(n, locale) }) }))}
                  invalid={Boolean(errors.section)}
                  describedById={describedBy("section", error("section"))}
                />
              </FieldShell>
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              <span className="text-danger-ink" aria-hidden>
                *
              </span>{" "}
              {p.requiredNote}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-xl bg-[#5c3bfc] px-6 text-[0.9375rem] font-bold text-white shadow-[0_16px_30px_-16px_rgb(92_59_252/0.95)] transition hover:bg-[#4c2ee0] disabled:opacity-70"
              data-testid="profile-save"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {saving ? p.saving : p.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
