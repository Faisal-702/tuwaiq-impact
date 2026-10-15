"use client";

import { type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/**
 * EN | العربية segmented switch. Remembers the choice in this browser. The
 * pressed state follows the choice at once; the page switches as a whole
 * when the server has rendered it in the new language (see I18nProvider).
 */
export function LanguageSwitcher({
  className,
  variant = "pill",
}: {
  className?: string;
  /**
   * "adaptive": compact on small screens, pill from the `sm` breakpoint.
   * "landing": like "adaptive", larger from `xl` (public landing header).
   */
  variant?: "pill" | "compact" | "adaptive" | "landing";
}) {
  const { t, targetLocale, switching, switchLocale } = useI18n();

  const options: { value: Locale; label: string; aria: string }[] = [
    { value: "en", label: "EN", aria: t.common.switchToEnglish },
    { value: "ar", label: "العربية", aria: t.common.switchToArabic },
  ];

  return (
    <div
      role="group"
      aria-label={t.common.language}
      aria-busy={switching || undefined}
      dir="ltr"
      className={cn(
        "inline-flex items-center rounded-full bg-white/90 p-1 ring-1 ring-line backdrop-blur",
        variant === "pill" ? "shadow-soft" : variant === "adaptive" || variant === "landing" ? "sm:shadow-soft" : "",
        variant === "landing" && "xl:p-1.5 xl:ring-[#e2e0ee]",
        switching && "opacity-70",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === targetLocale;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            aria-label={o.aria}
            onClick={() => switchLocale(o.value)}
            className={cn(
              "rounded-full font-medium transition-colors duration-200",
              variant === "pill"
                ? "px-4 py-1.5 text-sm"
                : variant === "adaptive"
                  ? "px-3 py-1 text-[0.8125rem] sm:px-4 sm:py-1.5 sm:text-sm"
                  : variant === "landing"
                    ? "px-3 py-1 text-[0.8125rem] font-bold sm:px-4 sm:py-1.5 sm:text-sm xl:px-[1.125rem] xl:py-[0.4375rem] xl:text-base"
                    : "px-3 py-1 text-[0.8125rem]",
              o.value === "ar" && (variant === "landing" ? "font-[family-name:'Cairo_Variable']" : "font-[family-name:var(--font-arabic)]"),
              active ? (variant === "landing" ? "bg-[#2e1793] text-white shadow-sm" : "bg-purple-ink text-white shadow-sm") : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
