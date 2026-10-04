import { ArrowRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import tuwaiqLogo from "../../../public/brand/tuwaiq-academy-logo.png";

type Tone = "blue" | "lavender" | "mint" | "teal";

type Partner = {
  id: string;
  name: Record<Locale, string>;
  /** Second line beside the logo (the other-language name or the official name). */
  sub: Record<Locale, string>;
  /** Show the second line in the brand teal (e.g. "SDAIA"). */
  subAccent?: boolean;
  description: Record<Locale, string>;
  /** Official website, opened from the card's arrow button. */
  url: string;
  /**
   * Official logo. To add one, place the file in /public/brand/partners/,
   * import it here and set it. Until then a neutral monogram placeholder shows.
   */
  logo?: StaticImageData;
  /** The logo artwork already contains the partner's name (no text beside it). */
  logoHasName?: boolean;
  /** Monogram for the placeholder mark. */
  mark: string;
  /** Pastel colour of the card's corner wave. */
  tone: Tone;
};

/** Display order is fixed: the first partner appears first in reading direction. */
const PARTNERS: Partner[] = [
  {
    id: "alj",
    name: { ar: "عبداللطيف جميل", en: "Abdul Latif Jameel" },
    sub: { ar: "Abdul Latif Jameel", en: "عبداللطيف جميل" },
    description: {
      ar: "شريك في تمكين المواهب وصناعة الفرص المستقبلية",
      en: "A partner in empowering talent and creating future opportunities",
    },
    url: "https://alj.com",
    mark: "ALJ",
    tone: "blue",
  },
  {
    id: "tuwaiq",
    name: { ar: "أكاديمية طويق", en: "Tuwaiq Academy" },
    sub: { ar: "Tuwaiq Academy", en: "أكاديمية طويق" },
    description: {
      ar: "شريك في بناء القدرات الرقمية وصناعة المستقبل",
      en: "A partner in building digital capabilities and shaping the future",
    },
    url: "https://tuwaiq.edu.sa",
    logo: tuwaiqLogo,
    logoHasName: true,
    mark: "TA",
    tone: "lavender",
  },
  {
    id: "sdaia",
    name: { ar: "سدايا", en: "SDAIA" },
    sub: { ar: "SDAIA", en: "سدايا" },
    subAccent: true,
    description: {
      ar: "الهيئة السعودية للبيانات والذكاء الاصطناعي",
      en: "Saudi Data & Artificial Intelligence Authority",
    },
    url: "https://sdaia.gov.sa",
    mark: "SDAIA",
    tone: "mint",
  },
  {
    id: "etec",
    name: { ar: "ETEC", en: "ETEC" },
    sub: { ar: "هيئة تقويم التعليم والتدريب", en: "Education & Training Evaluation Commission" },
    description: {
      ar: "شريك في تطوير جودة التعليم وتمكين الكفاءات الوطنية",
      en: "A partner in advancing education quality and empowering national talent",
    },
    url: "https://www.etec.gov.sa",
    mark: "ETEC",
    tone: "teal",
  },
];

const WAVE: Record<Tone, [string, string]> = {
  blue: ["#cfe3fb", "#e4f1ff"],
  lavender: ["#ddd3fd", "#efe9ff"],
  mint: ["#bfeee0", "#def8ef"],
  teal: ["#b8ece4", "#dcf6f5"],
};

/** Soft pastel wave rising into the card's lower end corner. */
function CornerWave({ tone, id }: { tone: Tone; id: string }) {
  const [strong, soft] = WAVE[tone];
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 end-0 -z-10 h-[62%] w-[78%] rtl:-scale-x-100"
    >
      <defs>
        <linearGradient id={`wave-${id}`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={strong} stopOpacity="0.95" />
          <stop offset="0.55" stopColor={soft} stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 90 C 70 86, 120 70, 170 42 C 200 25, 222 10, 240 0 L 240 90 Z" fill={`url(#wave-${id})`} />
      <path d="M40 90 C 110 84, 165 62, 240 22" fill="none" stroke={strong} strokeOpacity="0.55" strokeWidth="1.2" />
    </svg>
  );
}

function PartnerCard({ partner, locale, visitLabel }: { partner: Partner; locale: Locale; visitLabel: string }) {
  const name = partner.name[locale];
  return (
    <article
      data-testid="partner-card"
      aria-label={name}
      className="relative isolate flex h-full min-h-[9.25rem] flex-col justify-between overflow-hidden rounded-[1.125rem] border border-[#ebe8f7] bg-white p-4 shadow-[0_1px_2px_rgb(16_24_40/0.03),0_10px_24px_-18px_rgb(45_35_120/0.25)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgb(16_24_40/0.04),0_16px_32px_-18px_rgb(45_35_120/0.35)] sm:p-5"
    >
      <CornerWave tone={partner.tone} id={partner.id} />

      {/* Logo and name */}
      <div className="flex min-h-14 items-center gap-3.5">
        {partner.logo && partner.logoHasName ? (
          <Image src={partner.logo} alt={name} className="h-11 w-auto max-w-full object-contain" sizes="240px" />
        ) : (
          <>
            {partner.logo ? (
              <Image src={partner.logo} alt="" className="size-14 shrink-0 object-contain" sizes="56px" />
            ) : (
              <span
                aria-hidden
                dir="ltr"
                data-placeholder-logo={partner.id}
                className="grid size-14 shrink-0 place-items-center rounded-2xl border border-dashed border-teal/30 bg-gradient-to-br from-mint-soft to-lavender-soft text-[0.6875rem] font-bold tracking-wide text-teal-deep"
              >
                {partner.mark}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[1.1875rem] font-bold leading-tight text-[#1b2559]">{name}</p>
              <p className={cn("mt-0.5 text-[0.8125rem] leading-snug", partner.subAccent ? "font-bold text-teal-deep" : "text-ink-soft")}>
                <span dir="auto">{partner.sub[locale]}</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Description and arrow */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="max-w-[15rem] text-[0.8125rem] leading-relaxed text-ink-soft">{partner.description[locale]}</p>
        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${visitLabel}: ${name}`}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-purple shadow-[0_2px_8px_-2px_rgb(45_35_120/0.25)] ring-1 ring-[#ebe8f7] transition hover:bg-lavender-soft hover:text-purple-strong"
        >
          <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={2.2} aria-hidden />
        </a>
      </div>
    </article>
  );
}

/** Thin teal + purple rule with a small square end, mirrored on each side of the title. */
function TitleOrnament({ side }: { side: "start" | "end" }) {
  return (
    <span aria-hidden className={cn("flex items-center gap-2", side === "end" && "flex-row-reverse")}>
      <span className="size-1.5 rotate-45 rounded-[1px] bg-purple" />
      <span className="h-px w-10 bg-purple/45 sm:w-20" />
      <span className="h-0.5 w-6 rounded-full bg-teal sm:w-8" />
    </span>
  );
}

export function Partners({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <section aria-labelledby="partners-title" className="container-page relative z-10 mt-4 sm:mt-5">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#e6e0fa] bg-gradient-to-b from-[#f2fbf9] via-white to-[#f7f5ff] px-3 pb-3 pt-4 shadow-[0_1px_2px_rgb(16_24_40/0.03),0_18px_40px_-34px_rgb(45_35_120/0.35)] sm:px-4 sm:pb-4 sm:pt-5">
          {/* Soft colour washes in the top corners. */}
          <span aria-hidden className="absolute -start-16 -top-24 -z-10 size-72 rounded-full bg-mint/60 blur-3xl" />
          <span aria-hidden className="absolute -end-16 -top-24 -z-10 size-72 rounded-full bg-lavender/80 blur-3xl" />

          <header className="text-center">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <TitleOrnament side="start" />
              <h2 id="partners-title" className="text-2xl font-bold leading-tight text-[#1b2559] sm:text-[1.75rem]">
                {t.home.partnersTitle}
              </h2>
              <TitleOrnament side="end" />
            </div>
            <p className="mt-1 text-[0.9375rem] text-ink-soft">{t.home.partnersBody}</p>
          </header>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {PARTNERS.map((p) => (
              <li key={p.id}>
                <PartnerCard partner={p} locale={locale} visitLabel={t.home.partnersVisit} />
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
