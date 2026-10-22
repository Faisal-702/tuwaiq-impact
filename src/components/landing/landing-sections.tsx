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
import { preload } from "react-dom";
import Link from "@/components/ui/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import heroArt from "../../../public/images/landing/athar-hero-approved.webp";
import howArt from "../../../public/images/landing/landing-how-robot.webp";
import skylineArt from "../../../public/images/landing/landing-partners-skyline.webp";
import { AtharWordmark } from "@/components/brand/athar-wordmark";
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
  // The large-screen artwork is the page's main image: fetch it early, but only where it is shown
  // (phones load the smaller card image below instead).
  preload(heroArt.src, { as: "image", fetchPriority: "high", media: "(min-width: 1280px)" });
  return (
    <section className="lp-hero relative isolate overflow-hidden bg-[#fbfbfe] font-landing" data-testid="landing-hero">
      {/* Large screens: the approved artwork behind the hero, at the reference's framing; the text on its light side.
          Served as the original file (unoptimized): it is never shown wider than its own width on 1× screens,
          and re-encoding an already compressed image only loses detail. "lazy" keeps hidden copies (small screens)
          from loading at all; on large screens the preload above has already fetched it. */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden xl:block">
        <div className="lp-hero-art absolute" data-testid="landing-hero-art">
          <Image src={heroArt} alt={l.heroImageAlt} fill unoptimized loading="lazy" className="object-cover" />
        </div>
        <div className="lp-hero-wash absolute inset-0" />
        {/* A soft white veil behind the text (always on the right, where the artwork is light). */}
        <div className="absolute inset-y-0 right-[3%] w-[44%] bg-gradient-to-l from-white/55 via-white/30 to-transparent" />
      </div>

      <LandingHeader t={t} />

      <div className="lp-container container-page flex max-w-[96rem] xl:ltr:justify-end">
        <div className="lp-hero-text w-full pb-10 pt-2 sm:max-w-xl sm:pt-4" data-testid="landing-hero-text">
          <p className="flex flex-col items-start leading-none" data-testid="landing-name">
            <AtharWordmark locale={locale} className="lp-wordmark h-[4.75rem] sm:h-[5.75rem]" />
            {locale === "en" ? <span className="mt-1 block text-[1.375rem] font-semibold text-[#5d6076]">{t.brand.name}</span> : null}
          </p>
          <h1 className="lp-headline mt-2 text-[1.875rem] font-bold leading-[1.35] text-[#0f1747] sm:text-[2.25rem]">
            <span className="block">{l.heroTitle1}</span>
            <span className="block">{l.heroTitle2}</span>
          </h1>
          <p className="lp-lede mt-3 text-base leading-[1.75] text-[#575c74]">{l.heroBody}</p>
          <div className="lp-actions mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/welcome"
              className="lp-cta lp-cta-login inline-flex h-12 items-center justify-center gap-2.5 rounded-[0.625rem] bg-[#3a14c8] px-6 text-base font-bold text-white shadow-[0_16px_30px_-16px_rgb(58_20_200/0.95)] transition hover:bg-[#2f0fae] sm:min-w-[11rem]"
              data-testid="hero-login"
            >
              <UserRound className="size-5" strokeWidth={1.9} aria-hidden />
              {l.ctaLogin}
            </Link>
            <Link
              href="/partners"
              className="lp-cta lp-cta-partner inline-flex h-12 items-center justify-center gap-2.5 rounded-[0.625rem] bg-white/95 px-6 text-base font-bold text-[#2a1590] ring-1 ring-inset ring-[#a79fd6] transition hover:bg-lavender-soft sm:min-w-[11rem]"
              data-testid="hero-partner"
            >
              <Handshake className="size-5 text-[#3a14c8]" strokeWidth={1.9} aria-hidden />
              {l.ctaPartner}
            </Link>
          </div>
        </div>
      </div>

      {/* Smaller screens: the artwork under the text (both students, the robot and the laptop in frame), resized
          for the screen by the image optimizer (always downscaled from the original, at high quality). */}
      <div className="container-page max-w-[96rem] pb-10 xl:hidden">
        <div className="relative aspect-[2/1] overflow-hidden rounded-2xl ring-1 ring-line-soft sm:aspect-[2.6/1]">
          <Image src={heroArt} alt={l.heroImageAlt} fill quality={90} sizes="(min-width: 96rem) 96rem, 100vw" className="object-cover object-[50%_70%] sm:object-[50%_75%]" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Why Athar Platform?                                                       */
/* ------------------------------------------------------------------------- */

const WHY: { key: keyof Dictionary["landing"]["why"]; icon: LucideIcon; card: string; tile: string; tone: string; title: string; filled?: boolean }[] = [
  { key: "empower", icon: GraduationCap, card: "from-[#fcfbff] to-[#fbfaff]", tile: "bg-[#ece5ff]", tone: "text-[#3d1bc6]", title: "text-[#3216b4]", filled: true },
  { key: "rights", icon: ShieldCheck, card: "from-[#fbfffd] to-[#fcfefe]", tile: "bg-[#c4f3df]", tone: "text-[#1a7c66]", title: "text-[#16876d]" },
  { key: "showcase", icon: UsersRound, card: "from-[#fbfdff] to-[#fbfcfe]", tile: "bg-[#d5edff]", tone: "text-[#1440b5]", title: "text-[#1638a6]", filled: true },
  { key: "opportunities", icon: ChartNoAxesColumn, card: "from-[#fcfbfe] to-[#fbfbfe]", tile: "bg-[#e6dcfb]", tone: "text-[#4a2bc3]", title: "text-[#2a1b8c]" },
];

export function WhySection({ t }: { t: Dictionary }) {
  const l = t.landing;
  return (
    <section aria-labelledby="why-title" className="lp-why relative overflow-hidden bg-[#fcfbfe] pb-10 pt-6 font-landing" data-testid="landing-why">
      <Mosaic className="absolute -start-12 top-20 hidden opacity-45 md:block" flip />
      <Mosaic className="absolute -end-12 top-10 hidden opacity-45 md:block" />
      <div className="lp-container container-page relative max-w-[96rem]">
        {/* Large screens: the introduction on the start side, the title centred (a grid, so they never overlap). */}
        <div className="lp-why-head flex flex-col items-center gap-2 text-center xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
          <h2 id="why-title" className="lp-why-title flex items-center justify-center gap-5 text-[1.75rem] font-bold leading-tight text-[#0d1a4a] sm:text-[2rem] xl:col-start-2 xl:row-start-1">
            <span aria-hidden className="h-0.5 w-9 rounded-full bg-[#1b7a61]" />
            {l.whyTitle}
            <span aria-hidden className="h-0.5 w-9 rounded-full bg-[#1b7a61]" />
          </h2>
          <p className="lp-why-intro max-w-2xl text-[0.9375rem] leading-relaxed text-[#5b6075] xl:col-start-1 xl:row-start-1 xl:text-start">{l.whyIntro}</p>
        </div>
        <ul className="lp-cards mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ key, icon: Icon, card, tile, tone, title, filled }) => (
            <li
              key={key}
              className={cn(
                "lp-card relative flex flex-col rounded-2xl bg-gradient-to-b px-5 pb-5 pt-4 text-center shadow-[0_12px_32px_-22px_rgb(40_30_120/0.35)] ring-1 ring-[#ebe8f4]",
                card,
              )}
              data-why={key}
            >
              <span aria-hidden className={cn("lp-card-tile me-auto grid size-[3.375rem] place-items-center rounded-xl", tile)}>
                <Icon className={cn("size-[1.625rem]", tone)} strokeWidth={filled ? 1.6 : 2} fill={filled ? "currentColor" : "none"} />
              </span>
              <h3 className={cn("lp-card-title mt-2 text-[1.25rem] font-bold leading-snug", title)}>{l.why[key].title}</h3>
              <p className="lp-card-body mt-2 text-[0.9375rem] leading-[1.85] text-[#5b6075]">{l.why[key].body}</p>
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
          quality={90}
          sizes="30rem"
          className="object-cover object-[50%_44%] rtl:[mask-image:linear-gradient(to_left,transparent,#000_16%)] ltr:[mask-image:linear-gradient(to_right,transparent,#000_16%)]"
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
          <Image src={howArt} alt="" fill quality={90} sizes="28rem" className="object-cover object-[50%_44%]" />
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
          quality={90}
          sizes="29rem"
          className="object-cover object-[0%_36%] [mask-image:linear-gradient(to_left,transparent,#000_10%)] ltr:-scale-x-100"
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
