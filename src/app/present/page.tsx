import type { Metadata } from "next";
import { PresentationDeck } from "@/components/present/presentation-deck";
import { getI18n } from "@/i18n/server";
import { getFeaturedProjects, getHomeStats, getLeaderboard, searchProjects } from "@/server/queries/public";
import { requireViewer } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.present.title };
}

export default async function PresentPage() {
  // The session check and the page's queries run concurrently; nothing is
  // rendered unless the check passes (requireViewer redirects otherwise).
  const [, stats, featured, latest, leaders] = await Promise.all([
    requireViewer(),
    getHomeStats(),
    getFeaturedProjects(4),
    searchProjects({ sort: "points", limit: 6 }),
    getLeaderboard(null, 5),
  ]);
  const featuredIds = new Set(featured.map((p) => p.id));
  const selected = latest.items.filter((p) => !featuredIds.has(p.id)).slice(0, 6);
  return <PresentationDeck stats={stats} featured={featured} selected={selected.length > 0 ? selected : latest.items} leaders={leaders} />;
}
