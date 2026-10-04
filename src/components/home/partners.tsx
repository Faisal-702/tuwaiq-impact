import Image, { type StaticImageData } from "next/image";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import tuwaiqLogo from "../../../public/brand/tuwaiq-academy-logo.png";

type Partner = {
  id: string;
  name: Record<Locale, string>;
  /** Secondary line under the name (official full name or the other language). */
  detail: Record<Locale, string>;
  /**
   * Official logo. When set, it replaces the placeholder mark. To add one,
   * put the file in /public/brand/partners/ and import it here.
   */
  logo?: StaticImageData;
  /** The logo artwork already includes the partner's name (no text beside it). */
  logoHasName?: boolean;
  /** Short monogram shown in the placeholder mark until a logo is added. */
  mark: string;
};

/** Display order is fixed (first partner appears first in reading direction). */
const PARTNERS: Partner[] = [
  {
    id: "alj",
    name: { ar: "عبداللطيف جميل", en: "Abdul Latif Jameel" },
    detail: { ar: "Abdul Latif Jameel", en: "عبداللطيف جميل" },
    mark: "ALJ",
  },
  {
    id: "tuwaiq",
    name: { ar: "أكاديمية طويق", en: "Tuwaiq Academy" },
    detail: { ar: "Tuwaiq Academy", en: "أكاديمية طويق" },
    logo: tuwaiqLogo,
    logoHasName: true,
    mark: "TA",
  },
  {
    id: "sdaia",
    name: { ar: "سدايا", en: "SDAIA" },
    detail: { ar: "الهيئة السعودية للبيانات والذكاء الاصطناعي", en: "Saudi Data & AI Authority" },
    mark: "SDAIA",
  },
  {
    id: "etec",
    name: { ar: "ETEC", en: "ETEC" },
    detail: { ar: "هيئة تقويم التعليم والتدريب", en: "Education & Training Evaluation Commission" },
    mark: "ETEC",
  },
];

function PartnerCard({ partner, locale }: { partner: Partner; locale: Locale }) {
  const name = partner.name[locale];
  return (
    <article
      data-testid="partner-card"
      aria-label={name}
      className="group relative isolate flex h-[6.5rem] items-center overflow-hidden rounded-[1.25rem] bg-white px-6 shadow-soft ring-1 ring-line-soft transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift"
    >
      {/* Soft corner washes in the brand colours. */}
      <span aria-hidden className="absolute -start-10 -top-12 -z-10 size-32 rounded-full bg-lavender/70 blur-2xl" />
      <span aria-hidden className="absolute -bottom-14 -end-8 -z-10 size-36 rounded-full bg-mint/80 blur-2xl" />

      {partner.logo && partner.logoHasName ? (
        <Image src={partner.logo} alt={name} className="h-10 w-auto max-w-full object-contain" sizes="220px" />
      ) : (
        <div className="flex min-w-0 items-center gap-4">
          {partner.logo ? (
            <Image src={partner.logo} alt="" className="h-12 w-12 shrink-0 object-contain" sizes="48px" />
          ) : (
            <span
              aria-hidden
              data-placeholder-logo={partner.id}
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-mint-soft to-lavender-soft text-[0.6875rem] font-bold tracking-wide text-teal-deep ring-1 ring-inset ring-teal/15"
              dir="ltr"
            >
              {partner.mark}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-tight text-ink">{name}</p>
            <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted">
              <span dir="auto">{partner.detail[locale]}</span>
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export function Partners({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <section aria-labelledby="partners-title" className="container-page pt-14 sm:pt-16">
      <Reveal>
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-0.5 w-8 rounded-full bg-teal" />
          <h2 id="partners-title" className="text-2xl font-bold tracking-tight text-ink rtl:tracking-normal">
            {t.home.partnersTitle}
          </h2>
        </div>
        <p className="mt-1.5 ps-11 text-[0.9375rem] text-muted">{t.home.partnersBody}</p>
      </Reveal>
      <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {PARTNERS.map((p, i) => (
          <Reveal as="li" key={p.id} delay={i * 0.05}>
            <PartnerCard partner={p} locale={locale} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
