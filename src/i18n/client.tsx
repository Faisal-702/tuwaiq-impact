"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type ReactNode } from "react";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, dirOf, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import type { Dictionary } from "./dictionaries/en";

type I18nValue = {
  /** The language the page is rendered in (server and client agree on it). */
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  /** The language the user chose; differs from `locale` only while switching. */
  targetLocale: Locale;
  switching: boolean;
  switchLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/** Remembers the choice: the cookie is read by the server, localStorage survives cookie clean-ups. */
function persistLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Provides the active language. The dictionaries ship with the client bundle,
 * so pages no longer carry a copy of the dictionary in every server response.
 *
 * Switching language is one React transition: the cookie is updated, the
 * server components re-render in the new language (router.refresh), and the
 * whole page (text, direction and lang) commits together when they arrive.
 * Nothing is ever shown half-switched, and the switch reflects the choice at
 * once through `targetLocale`.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const [targetLocale, setTargetLocale] = useOptimistic(locale);

  const switchLocale = useCallback(
    (next: Locale) => {
      if (next === targetLocale) return;
      persistLocale(next);
      startTransition(() => {
        setTargetLocale(next);
        router.refresh();
      });
    },
    [router, targetLocale, setTargetLocale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, dir: dirOf(locale), t: getDictionary(locale), targetLocale, switching, switchLocale }),
    [locale, targetLocale, switching, switchLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
