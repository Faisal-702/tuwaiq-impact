import {
  ArrowRight,
  Bot,
  ChartColumnIncreasing,
  ChartNoAxesColumn,
  ChevronRight,
  CircleCheck,
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
import heroImage from "../../../public/images/hero-students.webp";
import skylineImage from "../../../public/images/entry-scene-right.webp";
import { Mosaic } from "./decor";
import { LandingHeader } from "./landing-header";

/* ------------------------------------------------------------------------- */
/* Hero                                                                      */
/* ------------------------------------------------------------------------- */

export function LandingHero({ t, locale }: { t: Dictionary; locale: Locale }) {
  const l = t.landing;
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#f5f3ff] via-[#fbfaff] to-white" data-testid="landing-hero">
      {/* Imagery: end side on large screens, under the text on small ones. */}
      <div className="pointer-events-none absolute inset-y-0 end-0 -z-10 hidden w-[62%] lg:block">
        <Image
          src={heroImage}
          alt={l.heroImageAlt}
          fill
          preload
          sizes="62vw"
          className="object-cover object-[58%_30%] ltr:[mask-image:linear-gradient(to_left,#000_62%,transparent_98%)] rtl:[mask-image:linear-gradient(to_right,#000_62%,transparent_98%)]"
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#f5f3ff]/80 to-transparent" />
      </div>
      <Mosaic className="absolute -start-6 top-28 -z-10 hidden opacity-70 lg:block" />
      <Mosaic flip className="absolute -end-4 bottom-10 -z-10 opacity-60" />

      <LandingHeader t={t} />

      <div className="container-page grid lg:min-h-[34rem] lg:grid-cols-2 lg:items-center">
        <div className="relative pb-10 pt-4 sm:pt-8 lg:py-14">
          <p className="flex flex-col items-start leading-none" data-testid="landing-name">
            {locale === "ar" ? (
              <>
                <span className="text-2xl font-semibold text-purple-ink sm:text-[1.75rem]">{l.heroPlatform}</span>
                <span className="mt-1 text-[4.25rem] font-bold leading-[1.15] text-gradient-athar sm:text-[5rem]">{l.heroName}</span>
              </>
            ) : (
              <>
                <span className="text-[3.75rem] font-bold leading-[1.05] tracking-tight text-gradient-athar sm:text-[4.5rem]">{l.heroName}</span>
                <span className="mt-1 text-2xl font-semibold text-purple-ink sm:text-[1.75rem]">{l.heroPlatform}</span>
              </>
            )}
            <span aria-hidden className="mt-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-teal to-purple rtl:bg-gradient-to-l" />
          </p>
          <h1 className="mt-6 text-[1.875rem] font-bold leading-[1.4] text-navy sm:text-[2.375rem] lg:text-[2.625rem] ltr:lg:text-[2.375rem] rtl:leading-[1.55]">
            <span className="block">{l.heroTitle1}</span>
            <span className="block">{l.heroTitle2}</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-[1.9] text-ink-soft sm:text-[1.0625rem]">{l.heroBody}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/welcome"
              className="inline-flex h-13 min-w-40 items-center justify-center gap-2.5 rounded-xl bg-purple-ink px-8 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgb(51_36_143/0.9)] transition hover:bg-[#2a1d78]"
              data-testid="hero-login"
            >
              <UserRound className="size-5" aria-hidden />
              {l.ctaLogin}
            </Link>
            <Link
              href="/partners"
              className="inline-flex h-13 min-w-40 items-center justify-center gap-2.5 rounded-xl bg-white px-7 text-base font-semibold text-purple-ink ring-1 ring-inset ring-purple-ink/35 transition hover:bg-lavender-soft hover:ring-purple-ink/60"
              data-testid="hero-partner"
            >
              <Handshake className="size-5" aria-hidden />
              {l.ctaPartner}
            </Link>
          </div>
        </div>

        {/* Small screens: the image under the text. */}
        <div className="relative mb-10 aspect-[16/10] overflow-hidden rounded-3xl ring-1 ring-line-soft lg:hidden">
          <Image src={heroImage} alt="" fill sizes="(min-width: 640px) 90vw, 100vw" className="object-cover object-[60%_30%]" />
          <HeroCard t={t} className="absolute bottom-4 start-4" />
        </div>
        <div className="relative hidden h-full lg:block">
          <HeroCard t={t} className="absolute bottom-16 end-[8%]" />
        </div>
      </div>
    </section>
  );
}

function HeroCard({ t, className }: { t: Dictionary; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex items-center gap-3 rounded-2xl bg-white/80 p-3 pe-5 shadow-lift ring-1 ring-white/90 backdrop-blur-md", className)}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-purple to-purple-ink text-white">
        <Lightbulb className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-navy">{t.landing.cardProject}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-deep">
          <CircleCheck className="size-3.5" />
          {t.landing.cardDocumented}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Why Athar Platform?                                                       */
/* ------------------------------------------------------------------------- */

const WHY: { key: keyof Dictionary["landing"]["why"]; icon: LucideIcon; tile: string; title: string }[] = [
  { key: "empower", icon: GraduationCap, tile: "bg-lavender text-purple-ink", title: "text-purple-ink" },
  { key: "rights", icon: ShieldCheck, tile: "bg-mint text-teal-deep", title: "text-teal-deep" },
  { key: "showcase", icon: UsersRound, tile: "bg-[#e3efff] text-[#2456b8]", title: "text-[#1f3f99]" },
  { key: "opportunities", icon: ChartNoAxesColumn, tile: "bg-lavender text-purple", title: "text-purple-ink" },
];

export function WhySection({ t }: { t: Dictionary }) {
  const l = t.landing;
  return (
    <section aria-labelledby="why-title" className="relative overflow-hidden py-14 lg:py-16" data-testid="landing-why">
      <Mosaic className="absolute -start-10 top-10 hidden opacity-50 md:block" />
      <Mosaic flip className="absolute -end-10 bottom-4 hidden opacity-40 md:block" />
      <div className="container-page relative">
        <div className="flex flex-col items-center gap-3 text-center xl:relative xl:block xl:min-h-12">
          <h2 id="why-title" className="flex items-center justify-center gap-4 text-[1.75rem] font-bold text-navy sm:text-[2rem]">
            <span aria-hidden className="h-0.5 w-10 rounded-full bg-teal/70" />
            {l.whyTitle}
            <span aria-hidden className="h-0.5 w-10 rounded-full bg-teal/70" />
          </h2>
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted xl:absolute xl:start-0 xl:top-1/2 xl:max-w-[26rem] xl:-translate-y-1/2 xl:text-start">
            {l.whyIntro}
          </p>
        </div>
        <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ key, icon: Icon, tile, title }) => (
            <li key={key} className="relative rounded-2xl bg-white/90 p-6 text-center shadow-soft ring-1 ring-line-soft backdrop-blur" data-why={key}>
              <span aria-hidden className={cn("absolute start-5 top-5 grid size-12 place-items-center rounded-xl", tile)}>
                <Icon className="size-6" strokeWidth={1.9} />
              </span>
              <h3 className={cn("mt-14 text-lg font-bold", title)}>{l.why[key].title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{l.why[key].body}</p>
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

const STEPS: { key: keyof Dictionary["landing"]["how"]; icon: LucideIcon }[] = [
  { key: "upload", icon: CloudUpload },
  { key: "organize", icon: FileText },
  { key: "impact", icon: ChartColumnIncreasing },
];

export function HowSection({ t, locale }: { t: Dictionary; locale: Locale }) {
  const l = t.landing;
  return (
    <section
      aria-labelledby="how-title"
      className="relative overflow-hidden bg-gradient-to-b from-[#f2f0fe] via-[#f6f5ff] to-[#f2f0fe] py-12 lg:py-14"
      data-testid="landing-how"
    >
      <div className="container-page">
        <h2 id="how-title" className="text-center text-[1.75rem] font-bold text-navy sm:text-[2rem]">
          {l.howTitle}
        </h2>
        <div className="mt-9 grid items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <ol className="grid gap-4 md:grid-cols-3 md:gap-12">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <li key={key} className="relative rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line-soft" data-step={i + 1}>
                <div className="flex items-start gap-3.5">
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-lavender-soft text-purple ring-1 ring-inset ring-purple/10">
                    <Icon className="size-5.5" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-purple-ink">
                      <span className="sr-only">{fmt(l.stepLabel, { n: formatNumber(i + 1, locale) })}: </span>
                      <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    </p>
                    <h3 className="text-base font-bold text-navy">{l.how[key].title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{l.how[key].body}</p>
                {i < STEPS.length - 1 ? (
                  <ChevronRight
                    aria-hidden
                    className="absolute -end-9 top-1/2 hidden size-6 -translate-y-1/2 text-purple-ink/70 md:block rtl:rotate-180"
                  />
                ) : null}
              </li>
            ))}
          </ol>
          <HowIllustration t={t} />
        </div>
      </div>
    </section>
  );
}

/** Layered project cards (decorative). */
function HowIllustration({ t }: { t: Dictionary }) {
  return (
    <div aria-hidden className="relative mx-auto hidden h-52 w-full max-w-[18rem] lg:block">
      <div className="absolute end-0 top-2 h-36 w-44 -rotate-6 rounded-2xl bg-white/70 p-3 shadow-soft ring-1 ring-white">
        <div className="flex h-full items-end justify-end gap-2 px-2 pb-1">
          {[35, 55, 45, 75, 60, 90].map((h, i) => (
            <span key={i} className="w-3 rounded-sm bg-gradient-to-t from-purple/50 to-violet/40" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="absolute start-0 top-10 w-52 rotate-3 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-line-soft">
        <div className="grid h-24 place-items-center rounded-xl bg-gradient-to-br from-[#e9e5ff] via-[#dff7f1] to-[#e3efff]">
          <Bot className="size-12 text-purple-ink/80" strokeWidth={1.5} />
        </div>
        <div className="mt-3 space-y-1.5">
          <span className="block h-2 w-3/4 rounded-full bg-line" />
          <span className="block h-2 w-1/2 rounded-full bg-line-soft" />
        </div>
      </div>
      <span className="absolute bottom-4 end-2 -rotate-6 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-purple-ink shadow-lift ring-1 ring-line-soft">
        {t.landing.illustrationProject}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* For partners                                                              */
/* ------------------------------------------------------------------------- */

const PARTNER_ITEMS: { key: keyof Dictionary["landing"]["partners"]; icon: LucideIcon; tone: string }[] = [
  { key: "opportunities", icon: Handshake, tone: "text-teal-deep" },
  { key: "talent", icon: UsersRound, tone: "text-purple" },
  { key: "innovation", icon: Lightbulb, tone: "text-teal-deep" },
  { key: "impact", icon: ChartNoAxesColumn, tone: "text-purple" },
];

export function PartnersBand({ t }: { t: Dictionary }) {
  const l = t.landing;
  return (
    <section
      aria-labelledby="partners-title"
      className="relative isolate overflow-hidden bg-gradient-to-b from-white to-[#f7f6ff]"
      data-testid="landing-partners-section"
    >
      <div className="absolute inset-y-0 end-0 -z-10 hidden w-[30%] lg:block">
        <Image
          src={skylineImage}
          alt={l.skylineAlt}
          fill
          sizes="30vw"
          className="object-cover object-[50%_38%] ltr:[clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,62%_0,100%_100%,0_100%)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-purple-ink/25 via-purple/5 to-transparent ltr:[clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)] rtl:[clip-path:polygon(0_0,62%_0,100%_100%,0_100%)]" />
      </div>
      <div className="container-page py-12 lg:py-14">
        <div className="lg:max-w-[72%]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-10">
            <div className="shrink-0">
              <h2 id="partners-title" className="text-[1.75rem] font-bold text-navy sm:text-[2rem]">
                {l.partnersTitle}
              </h2>
              <span aria-hidden className="mt-2 block h-1 w-16 rounded-full bg-gradient-to-r from-purple-ink to-teal rtl:bg-gradient-to-l" />
            </div>
            <p className="max-w-2xl text-[0.9375rem] leading-[1.9] text-ink-soft lg:pt-2">{l.partnersBody}</p>
          </div>
          <div className="mt-9 flex flex-col gap-8 lg:mt-10 lg:flex-col-reverse lg:items-start">
            <Link
              href="/partners"
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-teal-deep px-8 text-[1.0625rem] font-bold text-white shadow-[0_16px_32px_-16px_rgb(15_118_110/0.9)] transition hover:bg-[#0c625b] sm:w-auto"
              data-testid="become-partner"
            >
              {l.partnersCta}
              <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
            </Link>
            <ul className="grid w-full grid-cols-2 gap-y-7 md:grid-cols-4 md:divide-x md:divide-line rtl:md:divide-x-reverse">
              {PARTNER_ITEMS.map(({ key, icon: Icon, tone }) => (
                <li key={key} className="px-3 text-center">
                  <Icon aria-hidden className={cn("mx-auto size-8", tone)} strokeWidth={1.6} />
                  <h3 className="mt-2.5 text-[0.9375rem] font-bold text-navy">{l.partners[key].title}</h3>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{l.partners[key].body}</p>
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
      <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-center text-sm text-muted sm:flex-row sm:text-start">
        <p className="font-semibold text-navy">{t.brand.name}</p>
        <p>
          © {year} {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
