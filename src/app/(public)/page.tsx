import type { Metadata } from "next";
import { HowSection, LandingHero, PartnersBand, WhySection } from "@/components/landing/landing-sections";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t.meta.title }, description: t.landing.heroBody };
}

/** The public landing page: the platform's entry point for every visitor. */
export default async function LandingPage() {
  const { t, locale } = await getI18n();
  return (
    <>
      <LandingHero t={t} locale={locale} />
      <WhySection t={t} />
      <HowSection t={t} locale={locale} />
      <PartnersBand t={t} />
    </>
  );
}
