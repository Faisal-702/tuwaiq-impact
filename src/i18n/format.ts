import type { Locale } from "./config";

/** Replaces {name} placeholders. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US").format(value);
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  style: "long" | "short" = "long",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

export function formatMonth(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "ar" ? intlLocale(locale) : "en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatBytes(bytes: number, locale: Locale): string {
  const units = locale === "ar" ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Picks the name in the active language, falling back to the other one. */
export function localName(
  item: { name_en: string | null; name_ar: string | null },
  locale: Locale,
): string {
  const en = item.name_en?.trim();
  const ar = item.name_ar?.trim();
  return (locale === "ar" ? ar || en : en || ar) ?? "";
}

export function gradeLabel(grade: number | null | undefined, template: string): string {
  if (grade === null || grade === undefined) return "";
  return fmt(template, { n: grade });
}

/** "1 project" / "3 projects" with Arabic dual and plural forms. */
export function projectCount(n: number, locale: Locale): string {
  if (locale === "ar") {
    if (n === 1) return "مشروع واحد";
    if (n === 2) return "مشروعان";
    if (n >= 3 && n <= 10) return `${formatNumber(n, locale)} مشاريع`;
    return `${formatNumber(n, locale)} مشروعًا`;
  }
  return `${formatNumber(n, locale)} ${n === 1 ? "project" : "projects"}`;
}
