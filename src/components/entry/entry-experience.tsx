"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { Tabs } from "radix-ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { adminLogin, enterAsGuest, type AdminLoginState } from "@/app/welcome/actions";
import { LanguageSwitcher } from "@/components/brand/language-switcher";
import { PartnerLogos } from "@/components/brand/partner-logos";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { EntryScene } from "./entry-scene";

const EASE = [0.22, 1, 0.36, 1] as const;

export function EntryExperience({
  next,
  initialMode,
  expired,
}: {
  next: string | null;
  initialMode: "admin" | "guest";
  expired: boolean;
}) {
  const { t, dir } = useI18n();
  const [mode, setMode] = useState<"admin" | "guest">(initialMode);

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <EntryScene />

      <div className="absolute end-4 top-4 z-20 sm:end-8 sm:top-7">
        <LanguageSwitcher />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-10 pt-[4.5rem] sm:pt-14 lg:pt-[clamp(1.25rem,4.5vh,3.25rem)]">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <PartnerLogos
            size="lg"
            priority
            moeAlt={t.brand.moeAlt}
            tuwaiqAlt={t.brand.tuwaiqAlt}
          />
        </motion.div>

        <motion.section
          aria-labelledby="entry-title"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
          className="relative mt-7 w-full max-w-[34.5rem] rounded-[1.75rem] border border-white/80 bg-white/[0.86] px-5 pb-6 pt-7 shadow-panel backdrop-blur-xl sm:px-12 sm:pb-8 sm:pt-10 lg:mt-[clamp(1.25rem,4vh,2.75rem)] [@media(max-height:820px)]:sm:pt-7 [@media(max-height:820px)]:sm:pb-5"
        >
          <header className="text-center">
            <p className="text-[1.0625rem] text-muted sm:text-xl">{t.entry.welcomeTo}</p>
            <h1 id="entry-title" className="mt-1.5">
              <span
                lang="en"
                dir="ltr"
                className="block text-[2.4rem] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[3.25rem] [@media(max-height:820px)]:sm:text-[2.75rem]"
                style={{ fontFamily: '"Inter Variable", ui-sans-serif, system-ui' }}
              >
                <span className="text-gradient-brand">Tuwaiq</span>{" "}
                <span className="text-gradient-purple">Impact</span>
              </span>
              <span
                lang="ar"
                dir="rtl"
                className="mt-1 block text-[2rem] font-bold leading-tight text-[#0c4a5a] sm:text-[2.5rem] [@media(max-height:820px)]:sm:text-[2.125rem]"
                style={{ fontFamily: "var(--font-arabic)" }}
              >
                أثر طويق
              </span>
            </h1>
            <div className="mt-5 space-y-1 [@media(max-height:820px)]:mt-3">
              <p lang="en" className="text-[1.0625rem] font-medium text-ink-soft">
                Technical Talented High School
              </p>
              <p
                lang="ar"
                dir="rtl"
                className="text-[1.0625rem] font-semibold text-ink"
                style={{ fontFamily: "var(--font-arabic)" }}
              >
                ثانوية الموهوبين التقنية
              </p>
            </div>
            <p className="mx-auto mt-4 max-w-[26rem] text-[0.9375rem] leading-relaxed text-muted [@media(max-height:820px)]:mt-2.5">
              {t.entry.subtitle}
            </p>
          </header>

          <Tabs.Root
            value={mode}
            onValueChange={(v) => setMode(v as "admin" | "guest")}
            dir={dir}
            className="mt-7 [@media(max-height:820px)]:mt-5"
          >
            <Tabs.List
              aria-label={t.entry.accessModes}
              className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f1f3f7] p-1 ring-1 ring-inset ring-line-soft"
            >
              <EntryTab value="admin" active={mode === "admin"} icon={ShieldCheck} label={t.entry.adminTab} />
              <EntryTab value="guest" active={mode === "guest"} icon={UserRound} label={t.entry.guestTab} />
            </Tabs.List>

            <AnimatePresence mode="wait" initial={false}>
              {mode === "admin" ? (
                <Tabs.Content key="admin" value="admin" forceMount asChild>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <AdminForm next={next} expired={expired} />
                  </motion.div>
                </Tabs.Content>
              ) : (
                <Tabs.Content key="guest" value="guest" forceMount asChild>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <GuestPanel next={next} />
                  </motion.div>
                </Tabs.Content>
              )}
            </AnimatePresence>
          </Tabs.Root>
        </motion.section>
      </main>
    </div>
  );
}

function EntryTab({
  value,
  active,
  icon: Icon,
  label,
}: {
  value: string;
  active: boolean;
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        "relative flex h-12 items-center justify-center gap-1.5 rounded-[0.8rem] px-1.5 text-[0.8125rem] font-medium leading-tight transition-colors duration-200 sm:gap-2 sm:px-2 sm:text-[0.9375rem]",
        active ? "text-purple-ink" : "text-muted hover:text-ink",
      )}
    >
      {active ? (
        <motion.span
          layoutId="entry-tab-bg"
          className="absolute inset-0 rounded-[0.8rem] bg-white shadow-[0_1px_2px_rgb(16_24_40/0.06),0_6px_16px_-8px_rgb(51_36_143/0.25)] ring-1 ring-line"
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      ) : null}
      <Icon
        aria-hidden
        className={cn("relative size-4 shrink-0 sm:size-[1.125rem]", active ? "text-purple" : "text-muted")}
        strokeWidth={active ? 2.2 : 1.8}
        fill={active && value === "admin" ? "currentColor" : "none"}
        fillOpacity={0.12}
      />
      <span className="relative text-center">{label}</span>
      {active ? (
        <motion.span
          layoutId="entry-tab-line"
          className="absolute bottom-1.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-purple"
        />
      ) : null}
    </Tabs.Trigger>
  );
}

function SubmitButton({ label, pendingLabel, icon = true }: { label: string; pendingLabel: string; icon?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#5b36f0] via-purple to-[#7a58ff] text-[1.0625rem] font-semibold text-white shadow-[0_14px_30px_-14px_rgb(91_54_240/0.9)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[0_18px_36px_-14px_rgb(91_54_240/0.95)] hover:brightness-[1.04] active:translate-y-px disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : null}
      <span>{pending ? pendingLabel : label}</span>
      {!pending && icon ? (
        <ArrowRight
          aria-hidden
          className="size-[1.125rem] transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        />
      ) : null}
    </button>
  );
}

function AdminForm({ next, expired }: { next: string | null; expired: boolean }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState<AdminLoginState, FormData>(adminLogin, {
    error: null,
    attempt: 0,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [state]);

  const message =
    state.error === "invalid"
      ? t.entry.invalid
      : state.error === "required"
        ? t.entry.codeRequired
        : expired
          ? t.admin.common.unauthorized
          : null;

  return (
    <form action={formAction} className="mt-7 [@media(max-height:820px)]:mt-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label htmlFor="access-code" className="block text-[0.9375rem] font-medium text-ink">
        {t.entry.codeLabel}
      </label>
      <div className="relative mt-2.5">
        <KeyRound
          aria-hidden
          className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
          strokeWidth={1.9}
        />
        <motion.input
          key={state.attempt}
          ref={inputRef}
          id="access-code"
          name="code"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={64}
          placeholder={t.entry.codePlaceholder}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={message ? "access-code-message" : undefined}
          animate={state.error === "invalid" ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className={cn(
            "h-14 w-full rounded-2xl border bg-white ps-14 pe-5 text-[1.0625rem] text-ink placeholder:text-[#9aa1ad] transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-4",
            state.error
              ? "border-danger-ink/45 focus:border-danger-ink/60 focus:ring-danger-ink/10"
              : "border-[#d9d4f5] shadow-[0_0_0_3px_rgb(109_74_255/0.06)] hover:border-violet focus:border-purple/70 focus:ring-purple/12",
          )}
        />
      </div>
      <div className="mt-5">
        <SubmitButton label={t.entry.submit} pendingLabel={t.entry.verifying} />
      </div>
      <p
        id="access-code-message"
        aria-live="polite"
        className={cn(
          "mt-4 min-h-5 text-center text-[0.875rem]",
          state.error ? "text-danger-ink" : "text-muted",
        )}
      >
        {message}
      </p>
    </form>
  );
}

function GuestPanel({ next }: { next: string | null }) {
  const { t } = useI18n();
  return (
    <form action={enterAsGuest} className="mt-7 [@media(max-height:820px)]:mt-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="rounded-2xl bg-gradient-to-br from-mint-soft via-white to-lavender-soft px-5 py-5 ring-1 ring-inset ring-line-soft">
        <p className="text-[0.9375rem] font-semibold text-ink">{t.entry.guestTitle}</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{t.entry.guestBody}</p>
      </div>
      <div className="mt-5">
        <SubmitButton label={t.entry.guestCta} pendingLabel={t.entry.entering} />
      </div>
      <p className="mt-4 min-h-5 text-center text-[0.8125rem] text-muted">{t.entry.adminNote}</p>
    </form>
  );
}
