import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber } from "@/i18n/format";

const TZ = "Asia/Riyadh";
const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");

/** "470 ر.س" / "470 SAR". */
export const money = (n: number, t: Dictionary, locale: Locale) => `${formatNumber(n, locale)} ${t.submit.currency}`;

/** Calendar day in Riyadh, for "today" / "yesterday". */
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** "Today" / "Yesterday" / "14 Oct 2026", and the time ("at 11:24 AM"). */
export function dayAndTime(iso: string, now: string, t: Dictionary, locale: Locale) {
  const date = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const day =
    dayKey(date) === dayKey(today)
      ? t.myProjects.stats.today
      : dayKey(date) === dayKey(yesterday)
        ? t.myProjects.stats.yesterday
        : new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(date);
  return { day, time };
}

/** "2 hours ago" / "منذ ساعتين", relative to the server's time (stable between server and browser). */
export function relativeTime(iso: string, now: string, locale: Locale) {
  const seconds = Math.round((new Date(iso).getTime() - new Date(now).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  if (abs < 365 * 86_400) return rtf.format(Math.round(seconds / (30 * 86_400)), "month");
  return rtf.format(Math.round(seconds / (365 * 86_400)), "year");
}

export function fullDateTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
