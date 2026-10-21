import { Award, CalendarHeart, FolderKanban, Users } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatNumber } from "@/i18n/format";
import type { HomeStats } from "@/lib/types";

export function StatsBar({ stats, t, locale }: { stats: HomeStats; t: Dictionary; locale: Locale }) {
  const items = [
    { value: stats.projects, label: t.home.stats.projects, icon: FolderKanban, tone: "bg-mint-soft text-teal-deep" },
    { value: stats.students, label: t.home.stats.students, icon: Users, tone: "bg-lavender-soft text-purple" },
    { value: stats.awards, label: t.home.stats.awards, icon: Award, tone: "bg-mint-soft text-teal-deep" },
    { value: stats.activities, label: t.home.stats.activities, icon: CalendarHeart, tone: "bg-lavender-soft text-purple" },
  ];
  return (
    <section aria-label={t.home.statsLabel} className="container-page relative z-10 -mt-16 lg:-mt-20">
      <Reveal>
        <dl className="grid grid-cols-2 overflow-hidden rounded-[1.5rem] bg-white/95 shadow-lift ring-1 ring-line-soft backdrop-blur lg:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={[
                "flex items-center gap-4 px-5 py-6 sm:px-7 sm:py-7",
                i % 2 === 1 ? "border-s border-line-soft" : "",
                i >= 2 ? "border-t border-line-soft lg:border-t-0" : "",
                i === 2 ? "lg:border-s" : "",
              ].join(" ")}
            >
              <span className={`hidden size-12 shrink-0 place-items-center rounded-2xl sm:grid ${item.tone}`}>
                <item.icon className="size-[1.375rem]" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <dd className="text-[1.75rem] font-bold leading-none tracking-tight text-ink sm:text-[2rem]">
                  {formatNumber(item.value, locale)}
                </dd>
                <dt className="mt-1.5 text-sm text-muted">{item.label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
