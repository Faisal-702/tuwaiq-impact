import { ArrowRight, GraduationCap, Lightbulb, Presentation, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { PartnerLogos } from "@/components/brand/partner-logos";
import { DotMotif } from "@/components/brand/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { requireViewer } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.about.title, description: t.about.lead };
}

export default async function AboutPage() {
  await requireViewer();
  const { t } = await getI18n();
  const pillars = [
    { icon: Target, title: t.about.purposeTitle, body: t.about.purposeBody },
    { icon: GraduationCap, title: t.about.schoolTitle, body: t.about.schoolBody },
    { icon: Lightbulb, title: t.about.innovationTitle, body: t.about.innovationBody },
    { icon: Presentation, title: t.about.showcaseTitle, body: t.about.showcaseBody },
  ];

  return (
    <div className="pb-8">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_0%_0%,rgba(209,250,229,0.5),transparent_60%),radial-gradient(45%_60%_at_100%_10%,rgba(237,233,254,0.7),transparent_65%)]"
        />
        <DotMotif className="pointer-events-none absolute end-[8%] top-16 hidden w-44 opacity-60 lg:block" />
        <div className="container-page pb-16 pt-14 sm:pb-20 sm:pt-20">
          <Reveal>
            <p className="eyebrow">{t.about.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.03em] text-ink sm:text-6xl rtl:tracking-normal">
              <span dir="ltr" className="inline-block">
                <span className="text-gradient-brand">Tuwaiq</span> <span className="text-gradient-purple">Impact</span>
              </span>
              <span className="mx-3 text-line">|</span>
              <span lang="ar" className="font-[family-name:var(--font-arabic)] text-[#0c4a5a]">
                أثر طويق
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">{t.about.lead}</p>
          </Reveal>
        </div>
      </section>

      <section className="container-page">
        <ul className="grid gap-5 md:grid-cols-2">
          {pillars.map((p, i) => (
            <Reveal as="li" key={p.title} delay={(i % 2) * 0.06}>
              <div className="h-full rounded-[1.5rem] bg-white p-8 ring-1 ring-line-soft shadow-soft">
                <span className={`grid size-12 place-items-center rounded-2xl ${i % 2 === 0 ? "bg-mint-soft text-teal-deep" : "bg-lavender-soft text-purple"}`}>
                  <p.icon className="size-5.5" strokeWidth={1.8} aria-hidden />
                </span>
                <h2 className="mt-6 text-xl font-semibold text-ink">{p.title}</h2>
                <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="container-page mt-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.75rem] bg-canvas px-8 py-12 ring-1 ring-line-soft sm:px-12">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink">{t.about.identityTitle}</h2>
                <p className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-muted">{t.about.identityBody}</p>
                <Link href="/projects" className={buttonClasses("primary", "md") + " mt-8"}>
                  {t.about.explore}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
              <div className="flex justify-center rounded-2xl bg-white px-6 py-10 ring-1 ring-line-soft lg:justify-center">
                <PartnerLogos size="md" moeAlt={t.brand.moeAlt} tuwaiqAlt={t.brand.tuwaiqAlt} className="scale-110 sm:scale-125" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
