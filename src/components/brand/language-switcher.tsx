"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, dirOf, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function setLocalePreference(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = next;
  document.documentElement.dir = dirOf(next);
}

/** EN | العربية segmented switch. Remembers the choice in this browser. */
export function LanguageSwitcher({
  className,
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "compact";
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === locale) return;
    setLocalePreference(next);
    startTransition(() => router.refresh());
  };

  const options: { value: Locale; label: string; aria: string }[] = [
    { value: "en", label: "EN", aria: t.common.switchToEnglish },
    { value: "ar", label: "العربية", aria: t.common.switchToArabic },
  ];

  return (
    <div
      role="group"
      aria-label={t.common.language}
      dir="ltr"
      className={cn(
        "inline-flex items-center rounded-full bg-white/90 p-1 ring-1 ring-line backdrop-blur",
        variant === "pill" ? "shadow-soft" : "",
        pending && "opacity-70",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            aria-label={o.aria}
            onClick={() => choose(o.value)}
            className={cn(
              "rounded-full font-medium transition-colors duration-200",
              variant === "pill" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-[0.8125rem]",
              o.value === "ar" && "font-[family-name:var(--font-arabic)]",
              active ? "bg-purple-ink text-white shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
