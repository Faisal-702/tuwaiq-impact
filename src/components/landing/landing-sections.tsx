import {
  ArrowRight,
  ChartColumnIncreasing,
  ChartNoAxesColumn,
  ChevronRight,
  CloudUpload,
  FileText,
  GraduationCap,
  Handshake,
  Lightbulb,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "@/components/ui/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import heroArt from "../../../public/images/landing/landing-hero.webp";
import howArt from "../../../public/images/landing/landing-how.webp";
import skylineArt from "../../../public/images/landing/landing-skyline.webp";
import { Mosaic } from "./decor";
import { LandingHeader } from "./landing-header";

/*
 * The public landing page, built after the approved landing reference
 * (docs/references). The artwork is the reference's own (its baked-in text,
 * buttons and logos removed); every text, button and card is live HTML.
 * Colours are the reference's, sampled into the theme (indigo, navy, copy).
 */

/* ------------------------------------------------------------------------- */
/* Hero                                                                      */
/* ------------------------------------------------------------------------- */

export function LandingHero({ t, locale }: { t: Dictionary; locale: Locale }) {
  const l = t.landing;
  return (
    <section className="relative isolate overflow-hidden bg-[#fbfbfe] xl:min-h-[max(29.5rem,32.94vw)]" data-testid="landing-hero">
      {/* Large screens: the approved artwork fills the hero, the text sits on its light side. */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden xl:block">
        <Image src={heroArt} alt={l.heroImageAlt} fill preload sizes="100vw" className="object-cover object-[32%_50%]" />
        <div className="absolute inset-y-0 right-0 w-[48%] bg-gradient-to-l from-white/70 via-white/35 to-transparent" />
      </div>

      <LandingHeader t={t} />

      <div className="container-page flex xl:ltr:justify-end">
        <div className="w-full pb-10 pt-3 sm:pt-6 sm:max-w-xl xl:w-[24rem] xl:pb-8 xl:pt-0">
          <p className="flex flex-col items-start leading-none" data-testid="landing-name">
            {locale === "ar" ? (
              <>
                <span className="text-[1.625rem] font-medium text-[#5d6076]">{l.heroPlatform}</span>
                <span className="mt-0.5 text-[5.25rem] font-bold leading-[1.1] text-gradient-athar sm:text-[5.75rem]">أثـــر</span>
              </>
            ) : (
              <>
                <span className="text-[4.25rem] font-bold leading-[1.1] tracking-tight text-gradient-athar sm:text-[4.75rem]">{l.heroName}</span>
                <span className="mt-1 text-[1.625rem] font-medium text-[#5d6076]">{l.heroPlatform}</span>
              </>
            )}
          </p>
          <h1 className="mt-1 text-[1.875rem] font-bold leading-[1.45] text-navy sm:text-[2.125rem]">
            <span className="block">{l.heroTitle1}</span>
            <span className="block">{l.heroTitle2}</span>
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-[1.7] text-copy">{l.heroBody}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/welcome"
              className="inline-flex h-11 min-w-[9.5rem] items-center justify-center gap-2.5 rounded-lg bg-indigo px-7 text-base font-semibold text-white shadow-[0_14px_28px_-16px_rgb(66_31_190/0.95)] transition hover:bg-[#3418a6]"
              data-testid="hero-login"
            >
              <UserRound className="size-5" aria-hidden />
              {l.ctaLogin}
            </Link>
            <Link
              href="/partners"
              className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2.5 rounded-lg bg-white/90 px-6 text-base font-semibold text-indigo-ink ring-1 ring-inset ring-[#8d81bc] transition hover:bg-lavender-soft"
              data-testid="hero-partner"
            >
              <Handshake className="size-5 text-indigo" aria-hidden />
              {l.ctaPartner}
            </Link>
          </div>
        </div>
      </div>

      {/* Small screens: the artwork under the text. */}
      <div className="container-page pb-10 xl:hidden">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl ring-1 ring-line-soft">
          <Image src={heroArt} alt={l.heroImageAlt} fill sizes="(min-width: 640px) 90vw, 100vw" className="object-cover object-[12%_50%]" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Why Athar Platform?                                                       */
/* ------------------------------------------------------------------------- */

const WHY: { key: keyof Dictionary["landing"]["why"]; icon: LucideIcon; card: string; tile: string; tone: string; title: string; filled?: boolean }[] = [
  { key: "empower", icon: GraduationCap, card: "from-[#f7f3fe] to-white", tile: "bg-[#e3dbff]", tone: "text-[#4118c5]", title: "text-[#371793]", filled: true },
  { key: "rights", icon: ShieldCheck, card: "from-[#f3fcfb] to-white", tile: "bg-[#c5f6e1]", tone: "text-[#198c7a]", title: "text-[#197b6c]" },
  { key: "showcase", icon: UsersRound, card: "from-[#eff7fe] to-white", tile: "bg-[#cbe2ff]", tone: "text-[#062dad]", title: "text-[#062397]", filled: true },
  { key: "opportunities", icon: ChartNoAxesColumn, card: "from-[#f8f5fd] to-white", tile: "bg-[#e5ddfd]", tone: "text-[#4118c5]", title: "text-[#3b2080]" },
];

export function WhySection({ t }: { t: Dictionary }) {
  const l = t.landing;
  return (
    <section aria-labelledby="why-title" className="relative overflow-hidden bg-[#fcfbfe] pb-9 pt-5" data-testid="landing-why">
      <Mosaic className="absolute -start-12 top-6 hidden opacity-45 md:block" flip />
      <Mosaic className="absolute -end-12 top-24 hidden opacity-45 md:block" />
      <div className="container-page relative">
        <div className="flex flex-col items-center gap-2 text-center xl:relative xl:block xl:min-h-11">
          <h2 id="why-title" className="flex items-center justify-center gap-4 text-[1.75rem] font-bold text-[#041e47]">
            <span aria-hidden className="h-0.5 w-9 rounded-full bg-[#438e7a]" />
            {l.whyTitle}
            <span aria-hidden className="h-0.5 w-9 rounded-full bg-[#438e7a]" />
          </h2>
          <p className="max-w-2xl text-[0.875rem] leading-relaxed text-copy xl:absolute xl:start-0 xl:top-1/2 xl:max-w-[29rem] xl:-translate-y-1/2 xl:text-start">
            {l.whyIntro}
          </p>
        </div>
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ key, icon: Icon, card, tile, tone, title, filled }) => (
            <li
              key={key}
              className={cn("relative rounded-2xl bg-gradient-to-b px-4 pb-4 pt-3 text-center shadow-[0_10px_30px_-18px_rgb(40_30_120/0.35)] ring-1 ring-[#ece9f6]", card)}
              data-why={key}
            >
              <span aria-hidden className={cn("me-auto grid size-12 place-items-center rounded-xl", tile)}>
                <Icon className={cn("size-6", tone)} strokeWidth={filled ? 1.6 : 2.1} fill={filled ? "currentColor" : "none"} />
              </span>
              <h3 className={cn("mt-1.5 text-[1.0625rem] font-bold", title)}>{l.why[key].title}</h3>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-copy">{l.why[key].body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* How the platform works                                                    */
/* ------------------------------------------------------------------------- */

const STEPS: { key: keyof Dictionary["landing"]["how"]; icon: LucideIcon; tone: string }[] = [
  { key: "upload", icon: CloudUpload, tone: "text-[#367b84]" },
  { key: "organize", icon: FileText, tone: "text-[#1a6f94]" },
  { key: "impact", icon: ChartColumnIncreasing, tone: "text-[#196598]" },
];

export function HowSection({ t, locale }: { t: Dictionary; locale: Locale }) {
  const l = t.landing;
  return (
    <section
      aria-labelledby="how-title"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#f1f1fa] to-[#e9ecf6] pb-6"
      data-testid="landing-how"
    >
      {/* The approved illustration, on the end side of large screens. */}
      <div className="pointer-events-none absolute end-0 top-1/2 -z-10 hidden aspect-[418/156] h-[11rem] -translate-y-1/2 lg:block">
        <Image
          src={howArt}
          alt=""
          fill
          sizes="26rem"
          className="object-cover rtl:object-left ltr:object-right rtl:[mask-image:linear-gradient(to_left,transparent,#000_16%)] ltr:[mask-image:linear-gradient(to_right,transparent,#000_16%)]"
        />
      </div>
      <div className="container-page">
        <h2 id="how-title" className="text-center text-[1.625rem] font-bold leading-[2.75rem] text-[#180878]">
          {l.howTitle}
        </h2>
        <ol className="mt-2 grid gap-4 md:grid-cols-3 md:gap-12 lg:me-[26%] lg:gap-11">
          {STEPS.map(({ key, icon: Icon, tone }, i) => (
            <li key={key} className="relative rounded-2xl bg-white px-5 py-4 shadow-[0_10px_30px_-20px_rgb(40_30_120/0.35)] ring-1 ring-[#eceaf5]" data-step={i + 1}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4">
                <Icon aria-hidden className={cn("mt-1 size-7", tone)} strokeWidth={1.9} />
                <div>
                  <p className="text-[1.0625rem] font-bold tabular-nums text-[#1a0577]">
                    <span className="sr-only">{fmt(l.stepLabel, { n: formatNumber(i + 1, locale) })}: </span>
                    <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  </p>
                  <h3 className="text-[0.9375rem] font-bold text-[#170a69]">{l.how[key].title}</h3>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-copy">{l.how[key].body}</p>
                </div>
              </div>
              {i < STEPS.length - 1 ? (
                <ChevronRight aria-hidden className="absolute -end-9 top-1/2 hidden size-5 -translate-y-1/2 text-[#16066b] md:block lg:-end-8" strokeWidth={2.4} />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="container-page mt-5 lg:hidden">
        <div className="relative mx-auto h-36 max-w-md overflow-hidden rounded-xl">
          <Image src={howArt} alt="" fill sizes="28rem" className="object-cover" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* For partners (colours unified with the upper sections)                    */
/* ------------------------------------------------------------------------- */

const PARTNER_ITEMS: { key: keyof Dictionary["landing"]["partners"]; icon: LucideIcon; tone: string }[] = [
  { key: "opportunities", icon: Handshake, tone: "text-[#4118c5]" },
  { key: "talent", icon: UsersRound, tone: "text-[#062dad]" },
  { key: "innovation", icon: Lightbulb, tone: "text-[#198c7a]" },
  { key: "impact", icon: ChartNoAxesColumn, tone: "text-[#4118c5]" },
];

export function PartnersBand({ t }: { t: Dictionary }) {
  const l = t.landing;
  return (
    <section
      aria-labelledby="partners-title"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#fbfbfe] to-[#f4f2fd]"
      data-testid="landing-partners-section"
    >
      <div className="pointer-events-none absolute inset-y-0 end-0 -z-10 hidden w-[31%] max-w-[29rem] lg:block">
        <Image
          src={skylineArt}
          alt={l.skylineAlt}
          fill
          sizes="29rem"
          className="object-cover object-left [mask-image:linear-gradient(to_left,transparent,#000_10%)] ltr:-scale-x-100"
        />
      </div>
      <div className="container-page py-8 lg:py-7">
        <div className="lg:me-[26%] xl:me-[27%]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-8">
            <div className="shrink-0">
              <h2 id="partners-title" className="text-[1.625rem] font-bold text-indigo-ink">
                {l.partnersTitle}
              </h2>
              <span aria-hidden className="mt-1.5 block h-1 w-14 rounded-full bg-gradient-to-r from-indigo to-[#9abeff] rtl:bg-gradient-to-l" />
            </div>
            <p className="max-w-[27rem] text-[0.8125rem] leading-[1.8] text-copy lg:pt-1.5">{l.partnersBody}</p>
          </div>
          <div className="mt-6 grid gap-7 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-8">
            <Link
              href="/partners"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-indigo px-9 text-[1.0625rem] font-bold text-white shadow-[0_16px_30px_-16px_rgb(66_31_190/0.95)] transition hover:bg-[#3418a6] lg:min-w-[14.5rem]"
              data-testid="become-partner"
            >
              {l.partnersCta}
              <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
            </Link>
            <ul className="grid grid-cols-2 gap-y-6 md:grid-cols-4 md:divide-x md:divide-[#e3e1ee] rtl:md:divide-x-reverse">
              {PARTNER_ITEMS.map(({ key, icon: Icon, tone }) => (
                <li key={key} className="px-2 text-center">
                  <Icon aria-hidden className={cn("mx-auto size-8", tone)} strokeWidth={1.7} />
                  <h3 className="mt-2 text-[0.9375rem] font-bold text-[#190474]">{l.partners[key].title}</h3>
                  <p className="mt-1 text-[0.78125rem] leading-relaxed text-copy">{l.partners[key].body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Footer                                                                    */
/* ------------------------------------------------------------------------- */

export function LandingFooter({ t }: { t: Dictionary }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line-soft bg-white">
      <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-center text-sm text-copy sm:flex-row sm:text-start">
        <p className="font-semibold text-indigo-ink">{t.brand.name}</p>
        <p>
          © {year} {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
