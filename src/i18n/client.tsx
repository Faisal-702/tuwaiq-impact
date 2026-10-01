"use client";

import { createContext, useContext, type ReactNode } from "react";
import { dirOf, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; t: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dir: dirOf(locale), t: dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
