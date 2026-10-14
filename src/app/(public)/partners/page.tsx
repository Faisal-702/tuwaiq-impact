import { ChartNoAxesColumn, Handshake, Lightbulb, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { Mosaic } from "@/components/landing/decor";
import { LandingHeader } from "@/components/landing/landing-header";
import { PartnerApplicationForm } from "@/components/partners/partner-form";
import type { Dictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import skylineImage from "../../../../public/images/entry-scene-right.webp";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.partners.metaTitle, description: t.landing.partnersBody };
}

const BENEFITS: { key: keyof Dictionary["landing"]["partners"]; icon: LucideIcon; tone: string }[] = [
  { key: "opportunities", icon: Handshake, tone: "bg-mint text-teal-deep" },
  { key: "talent", icon: UsersRound, tone: "bg-lavender text-purple-ink" },
  { key: "innovation", icon: Lightbulb, tone: "bg-mint text-teal-deep" },
  { key: "impact", icon: ChartNoAxesColumn, tone: "bg-lavender text-purple-ink" },
];

/** Public partnership application (no sign-in needed). */
export default async function PartnersPage() {
  const { t } = await getI18n();
  const p = t.partners;
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-b from-[#f5f3ff] via-[#faf9ff] to-white">
      <Mosaic className="absolute -start-8 top-40 -z-10 hidden opacity-60 lg:block" />
      <Mosaic flip className="absolute -end-8 top-[34rem] -z-10 hidden opacity-50 lg:block" />
      <LandingHeader t={t} />

      <div className="container-page pb-16 pt-6 sm:pt-10 lg:pb-24">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-teal-deep ring-1 ring-inset ring-teal/25">
            <Handshake className="size-4" aria-hidden />
            {p.eyebrow}
          </p>
          <h1 className="mt-4 text-[2rem] font-bold leading-tight text-navy sm:text-[2.5rem]">{p.title}</h1>
          <span aria-hidden className="mt-3 block h-1.5 w-20 rounded-full bg-gradient-to-r from-purple-ink to-teal rtl:bg-gradient-to-l" />
          <p className="mt-5 text-base leading-[1.9] text-ink-soft sm:text-[1.0625rem]">{p.intro}</p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
          <PartnerApplicationForm />

          <aside className="lg:sticky lg:top-6" aria-labelledby="partner-aside-title">
            <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-line-soft">
              <div className="relative h-36">
                <Image src={skylineImage} alt={t.landing.skylineAlt} fill sizes="22rem" className="object-cover object-[50%_40%]" />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
              </div>
              <div className="px-5 pb-6">
                <h2 id="partner-aside-title" className="text-lg font-bold text-navy">
                  {p.asideTitle}
                </h2>
                <ul className="mt-4 space-y-4">
                  {BENEFITS.map(({ key, icon: Icon, tone }) => (
                    <li key={key} className="flex gap-3">
                      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                        <Icon className="size-5" strokeWidth={1.8} />
                      </span>
                      <div>
                        <h3 className="text-[0.9375rem] font-bold text-ink">{t.landing.partners[key].title}</h3>
                        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{t.landing.partners[key].body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
