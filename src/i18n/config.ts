export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ti_lang";
export const LOCALE_STORAGE_KEY = "ti_lang";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
