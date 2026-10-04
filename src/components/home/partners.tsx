import { ArrowRight } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";
import tuwaiqLogo from "../../../public/brand/tuwaiq-academy-logo.png";
import aljLogo from "../../../public/brand/partners/alj.png";
import etecLogo from "../../../public/brand/partners/etec.png";
import sdaiaLogo from "../../../public/brand/partners/sdaia.png";

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
  /** Partner logo (files in /public/brand/partners/ — replace with official artwork, same file names). */
  logo: StaticImageData;
  /** The logo artwork already contains the partner's name (no text beside it). */
  logoHasName?: boolean;
  /** Pastel colour of the card's corner wave. */
  tone: Tone;
};

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
    logo: aljLogo,
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
    logo: sdaiaLogo,
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
    logo: etecLogo,
    tone: "teal",
  },
];

const WAVE: Record<Tone, [string, string]> = {
  blue: ["#c7defa", "#e3efff"],
  lavender: ["#d9cdfd", "#eee8ff"],
  mint: ["#b5ebdc", "#dcf7ee"],
  teal: ["#aee8e2", "#d9f5f4"],
};

/** Soft pastel wave rising into the card's lower end corner. */
function CornerWave({ tone, id }: { tone: Tone; id: string }) {
  const [strong, soft] = WAVE[tone];
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 end-0 -z-10 h-[58%] w-[88%] rtl:-scale-x-100"
    >
      <defs>
        <linearGradient id={`wave-${id}`} x1="1" y1="1" x2="0" y2="0.2">
          <stop offset="0" stopColor={strong} stopOpacity="1" />
          <stop offset="0.5" stopColor={soft} stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 90 C 80 88, 130 74, 175 46 C 205 27, 225 12, 240 2 L 240 90 Z" fill={`url(#wave-${id})`} />
      <path d="M30 90 C 105 86, 160 66, 240 24" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.4" />
    </svg>
  );
}

function PartnerCard({ partner, locale, visitLabel }: { partner: Partner; locale: Locale; visitLabel: string }) {
  const name = partner.name[locale];
  return (
    <article
      data-testid="partner-card"
      aria-label={name}
      className="relative isolate flex h-full flex-col justify-between gap-2.5 overflow-hidden rounded-[1.125rem] border border-[#ebe8f7] bg-white px-4 pb-3 pt-3.5 shadow-[0_1px_2px_rgb(16_24_40/0.03),0_8px_20px_-16px_rgb(45_35_120/0.22)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgb(16_24_40/0.04),0_14px_28px_-16px_rgb(45_35_120/0.32)] sm:px-5"
    >
      <CornerWave tone={partner.tone} id={partner.id} />

      {/* Logo and name */}
      <div className="flex h-[3.25rem] items-center gap-3">
        {partner.logoHasName ? (
          <Image src={partner.logo} alt={name} className="h-10 w-auto max-w-full object-contain" sizes="240px" />
        ) : (
          <>
            <Image src={partner.logo} alt="" className="h-[3.25rem] w-auto shrink-0 object-contain" sizes="72px" />
            <div className="min-w-0">
              <p className="truncate text-[1.3125rem] font-extrabold leading-tight text-[#1b2559] ltr:text-[1.0625rem] ltr:xl:text-lg">{name}</p>
              <p
                className={cn(
                  "line-clamp-2 text-[0.8125rem] leading-snug ltr:text-xs ltr:leading-tight",
                  partner.subAccent ? "font-extrabold tracking-wide text-teal-deep" : "font-medium text-[#1b2559]/80",
                )}
              >
                <span dir="auto">{partner.sub[locale]}</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Description and arrow */}
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-[15.5rem] text-[0.8125rem] leading-[1.55] text-ink-soft">{partner.description[locale]}</p>
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

/** Thin teal + purple rule ending in a small square, mirrored on each side of the title. */
function TitleOrnament({ side }: { side: "start" | "end" }) {
  return (
    <span aria-hidden className={cn("flex items-center gap-2", side === "end" && "flex-row-reverse")}>
      <span className="size-[7px] rounded-[1.5px] bg-[#4f46e5]" />
      <span className="h-[1.5px] w-12 rounded-full bg-gradient-to-r from-[#6d4aff]/70 to-[#4f9bf5]/70 sm:w-24" />
      <span className="h-[3px] w-7 rounded-full bg-teal sm:w-10" />
    </span>
  );
}

/** Faint outline motif for the panel's top corners. */
function CornerMotif({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 60" className={cn("pointer-events-none absolute size-14 text-teal-deep/15", className)}>
      <path d="M30 6 52 18v24L30 54 8 42V18Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M30 16 43 23.5v15L30 46 17 38.5v-15Z" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function Partners({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <section aria-labelledby="partners-title" className="container-page relative z-10 mt-4 sm:mt-5">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#e3dcfa] bg-gradient-to-b from-[#effaf8] via-[#fbfcff] to-[#f7f5ff] px-3 pb-3 pt-3.5 shadow-[0_1px_2px_rgb(16_24_40/0.03),0_18px_40px_-34px_rgb(45_35_120/0.35)] sm:px-4 sm:pb-4">
          {/* Soft colour washes and outline motifs in the top corners. */}
          <span aria-hidden className="absolute -start-20 -top-28 -z-10 h-56 w-96 rounded-full bg-mint/70 blur-3xl" />
          <span aria-hidden className="absolute -end-20 -top-28 -z-10 h-56 w-96 rounded-full bg-[#c9f1ec]/70 blur-3xl" />
          <span aria-hidden className="absolute -top-24 left-1/2 -z-10 h-40 w-[28rem] -translate-x-1/2 rounded-full bg-lavender/60 blur-3xl" />
          <CornerMotif className="start-5 top-2 hidden sm:block" />
          <CornerMotif className="end-5 top-2 hidden sm:block" />

          <header className="text-center">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <TitleOrnament side="start" />
              <h2 id="partners-title" className="text-2xl font-extrabold leading-tight text-[#1b2559] sm:text-[1.75rem]">
                {t.home.partnersTitle}
              </h2>
              <TitleOrnament side="end" />
            </div>
            <p className="mt-0.5 text-[0.9375rem] font-medium text-ink-soft">{t.home.partnersBody}</p>
          </header>

          <ul className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4">
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
