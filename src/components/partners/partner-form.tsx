"use client";

import {
  AlertCircle,
  Building2,
  Check,
  CircleCheckBig,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Send,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Checkbox, describedBy, FieldShell, SelectInput, TextArea, TextInput } from "@/components/submission/fields";
import Link from "@/components/ui/link";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import {
  EMPTY_PARTNER_FORM,
  INTEREST_FIELDS,
  ORGANIZATION_CATEGORIES,
  PARTNER_FIELD_ORDER,
  PARTNER_LIMITS,
  SUPPORT_TYPES,
  toggleInterest,
  toggleSupport,
  validatePartnerForm,
  type PartnerError,
  type PartnerField,
  type PartnerForm as PartnerFormValues,
  type PartnerType,
} from "@/lib/partners";
import { cn } from "@/lib/utils";
import { submitPartnerApplication } from "@/server/actions/partners";

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
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint text-teal-deep ring-8 ring-mint-soft">
          <CircleCheckBig className="size-8" aria-hidden />
        </span>
        <h2 ref={successHeading} tabIndex={-1} className="mt-6 text-2xl font-bold text-navy focus:outline-none">
          {p.successTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] leading-[1.9] text-ink-soft">{p.successBody}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-purple-ink px-7 text-[0.9375rem] font-semibold text-white transition hover:bg-[#2a1d78]"
          >
            {p.backHome}
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-[0.9375rem] font-semibold text-purple-ink ring-1 ring-inset ring-purple-ink/30 transition hover:bg-lavender-soft"
          >
            {p.another}
          </button>
        </div>
      </div>
    );
  }

  const org = form.partnerType === "organization";
  const errorCount = Object.keys(errors).length;
  const proposalLength = form.proposal.trim().length;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6" data-testid="partner-form" aria-describedby="partner-required-note">
      <p id="partner-required-note" className="text-sm text-muted">
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

      <Section title={p.sections.applicant} icon={UserRound}>
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
                    "flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white p-4 transition-[border-color,box-shadow,background-color] duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-purple/15",
                    checked
                      ? "border-purple/60 bg-lavender-soft/70 shadow-[0_0_0_3px_rgb(109_74_255/0.08)]"
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
                      checked ? "bg-purple text-white" : "bg-canvas text-purple-ink ring-1 ring-inset ring-line",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-bold text-ink">{p.types[type]}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-muted">{p.typeHints[type]}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "ms-auto grid size-5 shrink-0 place-items-center rounded-full border-2",
                      checked ? "border-purple bg-purple" : "border-[#c5cad3]",
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

        <FieldShell id="fullName" label={p.fields.fullName} required error={message("fullName")}>
          <TextInput
            id="fullName"
            data-focus="fullName"
            value={form.fullName}
            onChange={(v) => update("fullName", v)}
            onBlur={() => blur("fullName")}
            invalid={Boolean(errors.fullName)}
            describedById={describedBy("fullName", message("fullName"))}
            placeholder={p.placeholders.fullName}
            autoComplete="name"
            maxLength={PARTNER_LIMITS.fullName[1]}
            aria-required="true"
            dir="auto"
          />
        </FieldShell>

        {org ? (
          <div className="grid gap-5 sm:grid-cols-2" data-testid="organization-fields">
            <FieldShell id="organizationName" label={p.fields.organizationName} required error={message("organizationName")} className="sm:col-span-2">
              <TextInput
                id="organizationName"
                data-focus="organizationName"
                icon={Building2}
                value={form.organizationName}
                onChange={(v) => update("organizationName", v)}
                onBlur={() => blur("organizationName")}
                invalid={Boolean(errors.organizationName)}
                describedById={describedBy("organizationName", message("organizationName"))}
                placeholder={p.placeholders.organizationName}
                autoComplete="organization"
                maxLength={PARTNER_LIMITS.organizationName[1]}
                aria-required="true"
                dir="auto"
              />
            </FieldShell>
            <FieldShell id="organizationCategory" label={p.fields.organizationCategory} required error={message("organizationCategory")}>
              <SelectInputFocus
                id="organizationCategory"
                value={form.organizationCategory}
                onChange={(v) => update("organizationCategory", v as PartnerFormValues["organizationCategory"])}
                invalid={Boolean(errors.organizationCategory)}
                describedById={describedBy("organizationCategory", message("organizationCategory"))}
                placeholder={p.placeholders.organizationCategory}
                options={ORGANIZATION_CATEGORIES.map((c) => ({ value: c, label: p.categories[c] }))}
              />
            </FieldShell>
            <FieldShell id="jobTitle" label={p.fields.jobTitle} required error={message("jobTitle")}>
              <TextInput
                id="jobTitle"
                data-focus="jobTitle"
                value={form.jobTitle}
                onChange={(v) => update("jobTitle", v)}
                onBlur={() => blur("jobTitle")}
                invalid={Boolean(errors.jobTitle)}
                describedById={describedBy("jobTitle", message("jobTitle"))}
                placeholder={p.placeholders.jobTitle}
                autoComplete="organization-title"
                maxLength={PARTNER_LIMITS.jobTitle[1]}
                aria-required="true"
                dir="auto"
              />
            </FieldShell>
          </div>
        ) : null}
      </Section>

      <Section title={p.sections.contact} icon={Phone}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell id="phone" label={p.fields.phone} required hint={p.hints.phone} error={message("phone")}>
            <TextInput
              id="phone"
              data-focus="phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(v) => update("phone", v)}
              onBlur={() => blur("phone")}
              invalid={Boolean(errors.phone)}
              describedById={describedBy("phone", message("phone"), p.hints.phone)}
              placeholder={p.placeholders.phone}
              autoComplete="tel"
              maxLength={20}
              aria-required="true"
              dir="ltr"
              className="text-start rtl:text-right"
            />
          </FieldShell>
          <FieldShell id="email" label={p.fields.email} required error={message("email")}>
            <TextInput
              id="email"
              data-focus="email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(v) => update("email", v)}
              onBlur={() => blur("email")}
              invalid={Boolean(errors.email)}
              describedById={describedBy("email", message("email"))}
              placeholder={p.placeholders.email}
              autoComplete="email"
              maxLength={PARTNER_LIMITS.email[1]}
              aria-required="true"
              dir="ltr"
              className="text-start rtl:text-right"
            />
          </FieldShell>
          <FieldShell id="city" label={p.fields.city} required error={message("city")} className="sm:col-span-2">
            <TextInput
              id="city"
              data-focus="city"
              icon={MapPin}
              value={form.city}
              onChange={(v) => update("city", v)}
              onBlur={() => blur("city")}
              invalid={Boolean(errors.city)}
              describedById={describedBy("city", message("city"))}
              placeholder={p.placeholders.city}
              autoComplete="address-level2"
              maxLength={PARTNER_LIMITS.city[1]}
              aria-required="true"
              dir="auto"
            />
          </FieldShell>
        </div>
      </Section>

      <Section title={p.sections.partnership} icon={Send}>
        <ChipGroup
          id="supportTypes"
          legend={p.fields.supportTypes}
          hint={p.hints.multi}
          error={message("supportTypes")}
          options={SUPPORT_TYPES.map((s) => ({ value: s, label: p.support[s] }))}
          selected={form.supportTypes}
          onToggle={(v) => update("supportTypes", toggleSupport(form.supportTypes, v as (typeof SUPPORT_TYPES)[number]))}
        />
        <ChipGroup
          id="interestFields"
          legend={p.fields.interestFields}
          hint={p.hints.multi}
          error={message("interestFields")}
          options={INTEREST_FIELDS.map((s) => ({ value: s, label: p.interests[s] }))}
          selected={form.interestFields}
          onToggle={(v) => update("interestFields", toggleInterest(form.interestFields, v as (typeof INTEREST_FIELDS)[number]))}
        />
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

      <div className="rounded-2xl border border-line bg-canvas/70 p-5 sm:p-6" data-field="consent">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <Lock className="size-4 text-teal-deep" aria-hidden />
          {p.fields.consent}
        </p>
        <p id="consent-note" className="mt-2 text-sm leading-relaxed text-muted">
          {p.privacyNote}
        </p>
        <div className="mt-4" data-focus-wrap>
          <ConsentCheckbox
            checked={form.consent}
            onChange={(v) => update("consent", v)}
            label={<span className="font-medium leading-relaxed">{p.consentText}</span>}
            invalid={Boolean(errors.consent)}
            describedById={errors.consent ? "consent-error" : "consent-note"}
          />
        </div>
        <ErrorText id="consent" text={message("consent")} />
      </div>

      {failure ? (
        <p className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink" role="alert" data-testid="partner-failure">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {failure === "rate_limited" ? p.errors.rateLimited : p.errors.server}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "sending"}
          aria-disabled={status === "sending" || undefined}
          className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-purple-ink px-9 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgb(51_36_143/0.9)] transition hover:bg-[#2a1d78] disabled:cursor-wait disabled:opacity-80 sm:w-auto"
          data-testid="partner-submit"
        >
          {status === "sending" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          {status === "sending" ? p.submitting : p.submit}
        </button>
      </div>
    </form>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] bg-white p-5 shadow-soft ring-1 ring-line-soft sm:p-7">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-navy">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-lavender-soft text-purple ring-1 ring-inset ring-purple/10">
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

/** Multi-select shown as toggle chips (native checkboxes underneath). */
function ChipGroup({
  id,
  legend,
  hint,
  error,
  options,
  selected,
  onToggle,
}: {
  id: PartnerField;
  legend: string;
  hint: string;
  error?: string;
  options: { value: string; label: string }[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset aria-describedby={error ? `${id}-error` : `${id}-hint`} data-field={id}>
      <legend className="text-[0.9375rem] font-semibold text-ink">
        {legend}
        <span className="ms-1 text-danger-ink" aria-hidden>
          *
        </span>
      </legend>
      <p id={`${id}-hint`} className="mt-1 text-[0.8125rem] text-muted">
        {hint}
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {options.map((o, i) => {
          const checked = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-purple/15",
                checked
                  ? "border-purple bg-purple text-white"
                  : error
                    ? "border-danger-ink/50 bg-white text-ink hover:border-danger-ink/70"
                    : "border-line bg-white text-ink-soft hover:border-purple/40 hover:text-ink",
              )}
              data-option={o.value}
            >
              <input
                type="checkbox"
                name={id}
                value={o.value}
                checked={checked}
                onChange={() => onToggle(o.value)}
                aria-invalid={Boolean(error) || undefined}
                className="sr-only"
                data-focus={i === 0 ? id : undefined}
              />
              {checked ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : null}
              {o.label}
            </label>
          );
        })}
      </div>
      <ErrorText id={id} text={error} />
    </fieldset>
  );
}

function SelectInputFocus(props: React.ComponentProps<typeof SelectInput>) {
  // The shared select has no extra attributes; mark it for focusing errors.
  return (
    <div
      ref={(el) => {
        el?.querySelector("select")?.setAttribute("data-focus", props.id);
      }}
    >
      <SelectInput {...props} />
    </div>
  );
}

function ConsentCheckbox(props: Omit<React.ComponentProps<typeof Checkbox>, "id">) {
  return (
    <div
      ref={(el) => {
        el?.querySelector("input")?.setAttribute("data-focus", "consent");
      }}
    >
      <Checkbox id="consent" {...props} />
    </div>
  );
}
