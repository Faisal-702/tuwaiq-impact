"use client";

import { AlertCircle, Building2, CircleCheckBig, FileCheck2, Handshake, Loader2, Lock, MapPin, Phone, Send, UserRound, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Checkbox, describedBy, FieldShell, SelectInput, TextArea, TextInput } from "@/components/submission/fields";
import Link from "@/components/ui/link";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import {
  EMPTY_PARTNER_FORM,
  INTEREST_FIELDS,
  ORGANIZATION_CATEGORIES,
  otherApplies,
  PARTNER_FIELD_ORDER,
  PARTNER_LIMITS,
  SUPPORT_TYPES,
  validatePartnerForm,
  type PartnerError,
  type PartnerField,
  type PartnerForm as PartnerFormValues,
  type PartnerType,
} from "@/lib/partners";
import { cn } from "@/lib/utils";
import { submitPartnerApplication } from "@/server/actions/partners";
import { MultiSelect } from "./multi-select";

type Errors = Partial<Record<PartnerField, PartnerError>>;

const newToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      );

/**
 * Public partnership application form. Validates as the visitor goes (after
 * the first attempt), and again on the server. A submission is sent once:
 * the button is locked while sending and every attempt of one application
 * carries the same token, so a retry can never store it twice.
 */
export function PartnerApplicationForm() {
  const { t, locale } = useI18n();
  const p = t.partners;
  const [form, setForm] = useState<PartnerFormValues>(EMPTY_PARTNER_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<"rate_limited" | "server" | null>(null);
  const token = useRef<string | null>(null);
  const sending = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = <K extends keyof PartnerFormValues>(key: K, value: PartnerFormValues[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (attempted) setErrors(validatePartnerForm(next));
    setFailure(null);
  };

  /** Validates one field when the visitor leaves it (only fields with an answer). */
  const blur = (field: PartnerField) => {
    if (attempted) return;
    const value = form[field];
    if (typeof value === "string" && !value.trim()) return;
    const error = validatePartnerForm(form)[field];
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const message = (field: PartnerField): string | undefined => {
    const error = errors[field];
    if (!error) return undefined;
    if (error === "choose" && (field === "supportTypes" || field === "interestFields")) return p.errors.chooseMany;
    return p.errors[error];
  };

  function focusFirstError(errs: Errors) {
    const first = PARTNER_FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-focus="${first}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || status === "sent") return;
    setAttempted(true);
    setFailure(null);
    const errs = validatePartnerForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    sending.current = true;
    setStatus("sending");
    token.current ??= newToken();
    try {
      const result = await submitPartnerApplication({ form, token: token.current, website: honeypot.current?.value ?? "" });
      if (result.ok) {
        setStatus("sent");
        requestAnimationFrame(() => {
          successHeading.current?.focus();
          successHeading.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
        return;
      }
      setStatus("idle");
      if (result.error === "invalid") {
        setErrors(result.fields);
        focusFirstError(result.fields);
      } else {
        setFailure(result.error);
      }
    } catch {
      setStatus("idle");
      setFailure("server");
    } finally {
      sending.current = false;
    }
  }

  function reset() {
    setForm(EMPTY_PARTNER_FORM);
    setErrors({});
    setAttempted(false);
    setFailure(null);
    token.current = null;
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div className="rounded-[1.5rem] bg-white p-8 text-center shadow-panel ring-1 ring-line-soft sm:p-12" role="status" data-testid="partner-success">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#c5f6e1] text-[#198c7a] ring-8 ring-[#f3fcfb]">
          <CircleCheckBig className="size-8" aria-hidden />
        </span>
        <h2 ref={successHeading} tabIndex={-1} className="mt-6 text-2xl font-bold text-indigo-ink focus:outline-none">
          {p.successTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] leading-[1.9] text-copy">{p.successBody}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo px-7 text-[0.9375rem] font-semibold text-white transition hover:bg-[#3418a6]"
          >
            {p.backHome}
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-[0.9375rem] font-semibold text-indigo-ink ring-1 ring-inset ring-[#8d81bc] transition hover:bg-lavender-soft"
          >
            {p.another}
          </button>
        </div>
      </div>
    );
  }

  const org = form.partnerType === "organization";
  const other = otherApplies(form);
  const errorCount = Object.keys(errors).length;
  const proposalLength = form.proposal.trim().length;
  const multiLabels = p.multi;

  /** A single-line text field of this form. */
  const text = (
    field: "fullName" | "organizationName" | "jobTitle" | "organizationCategoryOther" | "email" | "phone" | "city" | "supportOther" | "interestOther",
    opts: { max: number; icon?: LucideIcon; autoComplete?: string; type?: string; inputMode?: "tel" | "email"; ltr?: boolean; hint?: string; className?: string },
  ) => (
    <FieldShell id={field} label={p.fields[field]} required hint={opts.hint} error={message(field)} className={opts.className}>
      <TextInput
        id={field}
        data-focus={field}
        type={opts.type}
        inputMode={opts.inputMode}
        icon={opts.icon}
        value={form[field]}
        onChange={(v) => update(field, v)}
        onBlur={() => blur(field)}
        invalid={Boolean(errors[field])}
        describedById={describedBy(field, message(field), opts.hint)}
        placeholder={p.placeholders[field]}
        autoComplete={opts.autoComplete}
        maxLength={opts.max}
        aria-required="true"
        dir={opts.ltr ? "ltr" : "auto"}
        className={opts.ltr ? "text-start rtl:text-right" : undefined}
      />
    </FieldShell>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6" data-testid="partner-form" aria-describedby="partner-required-note">
      <p id="partner-required-note" className="text-sm text-copy">
        {p.requiredNote}
      </p>

      {attempted && errorCount > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink" role="alert" data-testid="partner-error-summary">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {p.errors.fixErrors}
        </p>
      ) : null}

      {/* Honeypot: invisible to people, tempting for bots. */}
      <div aria-hidden className="sr-only">
        <label htmlFor="partner-website">Website</label>
        <input ref={honeypot} id="partner-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* A — Applicant */}
      <Section title={p.sections.applicant} icon={UserRound} letter="A">
        <fieldset aria-describedby={describedBy("partnerType", message("partnerType"))} data-field="partnerType">
          <legend className="text-[0.9375rem] font-semibold text-ink">
            {p.fields.partnerType}
            <span className="ms-1 text-danger-ink" aria-hidden>
              *
            </span>
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["individual", "organization"] as PartnerType[]).map((type, i) => {
              const checked = form.partnerType === type;
              const Icon = type === "individual" ? UserRound : Building2;
              return (
                <label
                  key={type}
                  className={cn(
                    "flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white p-4 transition-[border-color,box-shadow,background-color] duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-indigo/15",
                    checked
                      ? "border-indigo/60 bg-lavender-soft/70 shadow-[0_0_0_3px_rgb(66_31_190/0.08)]"
                      : errors.partnerType
                        ? "border-danger-ink/50"
                        : "border-line hover:border-[#cfd3da]",
                  )}
                  data-partner-type={type}
                >
                  <input
                    type="radio"
                    name="partnerType"
                    value={type}
                    checked={checked}
                    onChange={() => update("partnerType", type)}
                    required
                    className="sr-only"
                    data-focus={i === 0 ? "partnerType" : undefined}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
                      checked ? "bg-indigo text-white" : "bg-canvas text-indigo ring-1 ring-inset ring-line",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-bold text-ink">{p.types[type]}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-copy">{p.typeHints[type]}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "ms-auto grid size-5 shrink-0 place-items-center rounded-full border-2",
                      checked ? "border-indigo bg-indigo" : "border-[#c5cad3]",
                    )}
                  >
                    {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
                  </span>
                </label>
              );
            })}
          </div>
          <ErrorText id="partnerType" text={message("partnerType")} />
        </fieldset>

        {text("fullName", { max: PARTNER_LIMITS.fullName[1], autoComplete: "name" })}

        {org ? (
          <div className="grid gap-5 sm:grid-cols-2" data-testid="organization-fields">
            {text("organizationName", { max: PARTNER_LIMITS.organizationName[1], icon: Building2, autoComplete: "organization", className: "sm:col-span-2" })}
            {text("jobTitle", { max: PARTNER_LIMITS.jobTitle[1], autoComplete: "organization-title" })}
            <FieldShell id="organizationCategory" label={p.fields.organizationCategory} required error={message("organizationCategory")}>
              <FocusMark id="organizationCategory" selector="select">
                <SelectInput
                  id="organizationCategory"
                  value={form.organizationCategory}
                  onChange={(v) => update("organizationCategory", v as PartnerFormValues["organizationCategory"])}
                  invalid={Boolean(errors.organizationCategory)}
                  describedById={describedBy("organizationCategory", message("organizationCategory"))}
                  placeholder={p.placeholders.organizationCategory}
                  options={ORGANIZATION_CATEGORIES.map((c) => ({ value: c, label: p.categories[c] }))}
                />
              </FocusMark>
            </FieldShell>
            {other.organizationCategoryOther
              ? text("organizationCategoryOther", { max: PARTNER_LIMITS.other[1], className: "sm:col-span-2" })
              : null}
          </div>
        ) : null}
      </Section>

      {/* B — Contact */}
      <Section title={p.sections.contact} icon={Phone} letter="B">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("email", { max: PARTNER_LIMITS.email[1], type: "email", inputMode: "email", autoComplete: "email", ltr: true })}
          {text("phone", { max: 20, type: "tel", inputMode: "tel", autoComplete: "tel", ltr: true, hint: p.hints.phone })}
          {text("city", { max: PARTNER_LIMITS.city[1], icon: MapPin, autoComplete: "address-level2", className: "sm:col-span-2" })}
        </div>
      </Section>

      {/* C — Partnership */}
      <Section title={p.sections.partnership} icon={Handshake} letter="C">
        <FieldShell id="supportTypes" label={p.fields.supportTypes} required hint={p.hints.multi} error={message("supportTypes")}>
          <MultiSelect
            id="supportTypes"
            value={form.supportTypes}
            options={SUPPORT_TYPES.map((s) => ({ value: s, label: p.support[s] }))}
            onChange={(v) => update("supportTypes", v as PartnerFormValues["supportTypes"])}
            placeholder={p.placeholders.supportTypes}
            invalid={Boolean(errors.supportTypes)}
            describedById={describedBy("supportTypes", message("supportTypes"), p.hints.multi)}
            labels={multiLabels}
          />
        </FieldShell>
        {other.supportOther ? text("supportOther", { max: PARTNER_LIMITS.other[1] }) : null}

        <FieldShell id="interestFields" label={p.fields.interestFields} required hint={p.hints.multi} error={message("interestFields")}>
          <MultiSelect
            id="interestFields"
            value={form.interestFields}
            options={INTEREST_FIELDS.map((s) => ({ value: s, label: p.interests[s] }))}
            onChange={(v) => update("interestFields", v as PartnerFormValues["interestFields"])}
            placeholder={p.placeholders.interestFields}
            invalid={Boolean(errors.interestFields)}
            describedById={describedBy("interestFields", message("interestFields"), p.hints.multi)}
            labels={multiLabels}
            searchable
          />
        </FieldShell>
        {other.interestOther ? text("interestOther", { max: PARTNER_LIMITS.other[1] }) : null}

        <FieldShell
          id="proposal"
          label={p.fields.proposal}
          required
          error={message("proposal")}
          counter={
            <span className={cn("shrink-0 text-xs tabular-nums", proposalLength > PARTNER_LIMITS.proposal[1] ? "text-danger-ink" : "text-muted")} aria-hidden>
              {formatNumber(proposalLength, locale)} / {formatNumber(PARTNER_LIMITS.proposal[1], locale)}
            </span>
          }
        >
          <TextArea
            id="proposal"
            data-focus="proposal"
            value={form.proposal}
            onChange={(v) => update("proposal", v)}
            onBlur={() => blur("proposal")}
            invalid={Boolean(errors.proposal)}
            describedById={describedBy("proposal", message("proposal"))}
            placeholder={p.placeholders.proposal}
            rows={5}
            maxLength={PARTNER_LIMITS.proposal[1] + 200}
            aria-required="true"
            dir="auto"
          />
        </FieldShell>
      </Section>

      {/* D — Declaration */}
      <Section title={p.sections.declaration} icon={FileCheck2} letter="D">
        <div data-field="consent">
          <p id="consent-note" className="flex items-start gap-2 text-sm leading-relaxed text-copy">
            <Lock className="mt-0.5 size-4 shrink-0 text-[#198c7a]" aria-hidden />
            {p.privacyNote}
          </p>
          <div className="mt-4">
            <FocusMark id="consent" selector="input">
              <Checkbox
                id="consent"
                checked={form.consent}
                onChange={(v) => update("consent", v)}
                label={<span className="font-medium leading-relaxed">{p.consentText}</span>}
                invalid={Boolean(errors.consent)}
                describedById={errors.consent ? "consent-error" : "consent-note"}
              />
            </FocusMark>
          </div>
          <ErrorText id="consent" text={message("consent")} />
        </div>
      </Section>

      {failure ? (
        <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink" role="alert" data-testid="partner-failure">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {failure === "rate_limited" ? p.errors.rateLimited : p.errors.server}
        </p>
      ) : null}

      {/* E — Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "sending"}
          aria-disabled={status === "sending" || undefined}
          className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-indigo px-10 text-base font-bold text-white shadow-[0_16px_30px_-16px_rgb(66_31_190/0.95)] transition hover:bg-[#3418a6] disabled:cursor-wait disabled:opacity-80 sm:w-auto"
          data-testid="partner-submit"
        >
          {status === "sending" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          {status === "sending" ? p.submitting : p.submit}
        </button>
      </div>
    </form>
  );
}

function Section({ title, icon: Icon, letter, children }: { title: string; icon: LucideIcon; letter: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] bg-white p-5 shadow-[0_10px_30px_-20px_rgb(40_30_120/0.35)] ring-1 ring-[#eceaf5] sm:p-7" data-section={letter}>
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-indigo-ink">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-[#e3dbff] text-indigo">
          <Icon className="size-4.5" />
        </span>
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function ErrorText({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger-ink">
      {text}
    </p>
  );
}

/** Marks a control inside a shared field component as the target for "focus the first error". */
function FocusMark({ id, selector, children }: { id: string; selector: string; children: ReactNode }) {
  return (
    <div
      ref={(el) => {
        el?.querySelector(selector)?.setAttribute("data-focus", id);
      }}
    >
      {children}
    </div>
  );
}
