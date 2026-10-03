"use client";

import { CheckCircle2, ChevronDown, MessageSquareText, Send, X } from "lucide-react";
import { Select as S } from "radix-ui";
import { useId, useRef, useState, useTransition, type ElementType, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputBase, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { fmt, gradeLabel } from "@/i18n/format";
import { SUGGESTION_GRADES, SUGGESTION_MAX_LENGTH, SUGGESTION_NAME_MAX_LENGTH } from "@/lib/suggestions";
import { cn } from "@/lib/utils";
import { submitSuggestion, type SuggestionField } from "@/server/actions/suggestions";

type Errors = Partial<Record<SuggestionField, string>>;

/**
 * "Send a Suggestion" panel shared by the desktop popover and the mobile
 * dialog. `TitleAs`/`DescriptionAs` let a Radix Dialog supply its own
 * accessible title components; `titleId` labels a popover.
 */
export function SuggestionPanel({
  titleId,
  descriptionId,
  TitleAs = "h2",
  DescriptionAs = "p",
  onClose,
  nameRef,
}: {
  titleId: string;
  descriptionId: string;
  TitleAs?: ElementType;
  DescriptionAs?: ElementType;
  onClose: () => void;
  nameRef?: React.Ref<HTMLInputElement>;
}) {
  const { t, dir } = useI18n();
  const s = t.suggestions;
  const uid = useId();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const ids = { name: `${uid}-name`, grade: `${uid}-grade`, suggestion: `${uid}-suggestion` };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = s.errors.name;
    if (!SUGGESTION_GRADES.some((g) => String(g) === grade)) next.grade = s.errors.grade;
    if (!suggestion.trim()) next.suggestion = s.errors.suggestion;
    else if (suggestion.length > SUGGESTION_MAX_LENGTH) next.suggestion = fmt(s.errors.tooLong, { max: SUGGESTION_MAX_LENGTH });
    return next;
  };

  const focusField = (field: SuggestionField) =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(ids[field])}`)?.focus());

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    const first = (["name", "grade", "suggestion"] as const).find((f) => found[f]);
    if (first) return focusField(first);

    startTransition(async () => {
      const res = await submitSuggestion({ name, grade: Number(grade), suggestion, website }).catch(() => null);
      if (res?.ok) {
        setName("");
        setGrade("");
        setSuggestion("");
        setErrors({});
        setSent(true);
      } else if (res && res.error === "invalid") {
        const next: Errors = {};
        for (const f of res.fields) next[f] = s.errors[f];
        setErrors(next);
        if (res.fields[0]) focusField(res.fields[0]);
      } else {
        setFormError(res?.error === "rate_limited" ? s.errors.rateLimited : s.errors.server);
      }
    });
  };

  const clear = (field: SuggestionField) => errors[field] && setErrors((e) => ({ ...e, [field]: undefined }));
  const describedBy = (field: SuggestionField, extra?: string) =>
    [errors[field] ? `${ids[field]}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <div className="p-6 sm:p-7">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lavender text-purple">
          <MessageSquareText className="size-5" aria-hidden strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <TitleAs id={titleId} className="text-xl font-bold leading-tight text-ink">
            {s.title}
          </TitleAs>
          <DescriptionAs id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted">
            {s.subtitle}
          </DescriptionAs>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {sent ? (
        <div role="status" className="mt-6 flex flex-col items-center rounded-2xl bg-mint-soft px-6 py-8 text-center ring-1 ring-inset ring-teal/20">
          <span className="grid size-12 place-items-center rounded-full bg-white text-teal-deep shadow-soft">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold text-teal-deep">{s.success}</p>
          <p className="mt-1 text-sm text-ink-soft">{s.successBody}</p>
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <Button variant="primary" onClick={() => setSent(false)}>
              {s.sendAnother}
            </Button>
            <Button variant="subtle" onClick={onClose}>
              {s.close}
            </Button>
          </div>
        </div>
      ) : (
        <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-6 space-y-5" aria-busy={pending}>
          {/* Honeypot: invisible to people and assistive tech, often filled by bots. */}
          <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
            </label>
          </div>

          <div className="space-y-2">
            <label htmlFor={ids.name} className="block text-sm font-semibold text-ink">
              {s.name}
            </label>
            <Input
              ref={nameRef}
              id={ids.name}
              name="name"
              autoComplete="name"
              dir={name ? "auto" : undefined}
              value={name}
              maxLength={SUGGESTION_NAME_MAX_LENGTH}
              placeholder={s.namePlaceholder}
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name")}
              onChange={(e) => {
                setName(e.target.value);
                clear("name");
              }}
            />
            <FieldError id={`${ids.name}-error`} message={errors.name} />
          </div>

          <div className="space-y-2">
            <span id={`${ids.grade}-label`} className="block text-sm font-semibold text-ink">
              {s.grade}
            </span>
            <S.Root
              dir={dir}
              value={grade}
              onValueChange={(v) => {
                setGrade(v);
                clear("grade");
              }}
            >
              <S.Trigger
                id={ids.grade}
                aria-labelledby={`${ids.grade}-label`}
                aria-required="true"
                aria-invalid={errors.grade ? true : undefined}
                aria-describedby={describedBy("grade")}
                className={cn(
                  inputBase,
                  "flex h-11 cursor-pointer items-center justify-between gap-2 text-start data-[placeholder]:text-[#9aa1ad] data-[state=open]:border-purple/60 data-[state=open]:ring-4 data-[state=open]:ring-purple/10",
                )}
              >
                <S.Value placeholder={s.gradePlaceholder} />
                <S.Icon asChild>
                  <ChevronDown className="size-4 shrink-0 text-ink-soft" aria-hidden />
                </S.Icon>
              </S.Trigger>
              <S.Portal>
                <S.Content
                  position="popper"
                  align="start"
                  sideOffset={6}
                  className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line data-[state=open]:animate-[fade-in_140ms_ease-out] sm:min-w-60"
                >
                  <S.Viewport>
                    {SUGGESTION_GRADES.map((g) => (
                      <S.Item
                        key={g}
                        value={String(g)}
                        className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] text-ink outline-none data-[highlighted]:bg-lavender-soft data-[state=checked]:font-semibold data-[state=checked]:text-purple-ink"
                      >
                        <S.ItemText>{gradeLabel(g, t.grades)}</S.ItemText>
                        <S.ItemIndicator>
                          <CheckCircle2 className="size-4 text-purple" aria-hidden />
                        </S.ItemIndicator>
                      </S.Item>
                    ))}
                  </S.Viewport>
                </S.Content>
              </S.Portal>
            </S.Root>
            <FieldError id={`${ids.grade}-error`} message={errors.grade} />
          </div>

          <div className="space-y-2">
            <label htmlFor={ids.suggestion} className="block text-sm font-semibold text-ink">
              {s.suggestion}
            </label>
            <div className="relative">
              <Textarea
                id={ids.suggestion}
                name="suggestion"
                dir={suggestion ? "auto" : undefined}
                rows={4}
                value={suggestion}
                maxLength={SUGGESTION_MAX_LENGTH}
                placeholder={s.suggestionPlaceholder}
                aria-required="true"
                aria-invalid={errors.suggestion ? true : undefined}
                aria-describedby={describedBy("suggestion", `${ids.suggestion}-count`)}
                onChange={(e) => {
                  setSuggestion(e.target.value.slice(0, SUGGESTION_MAX_LENGTH));
                  clear("suggestion");
                }}
                className="min-h-32 resize-none pb-8"
              />
              <span
                id={`${ids.suggestion}-count`}
                dir="ltr"
                data-testid="suggestion-counter"
                className={cn(
                  "pointer-events-none absolute bottom-2.5 end-3.5 text-xs tabular-nums",
                  suggestion.length >= SUGGESTION_MAX_LENGTH ? "font-medium text-danger-ink" : "text-muted",
                )}
              >
                {suggestion.length} / {SUGGESTION_MAX_LENGTH}
              </span>
            </div>
            <FieldError id={`${ids.suggestion}-error`} message={errors.suggestion} />
          </div>

          {formError ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink ring-1 ring-inset ring-danger-ink/15">
              {formError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              <Send className="size-4 rtl:-scale-x-100" aria-hidden />
              {pending ? s.sending : s.submit}
            </Button>
            <Button variant="subtle" onClick={onClose} className="bg-white">
              {s.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger-ink">
      {message}
    </p>
  );
}
