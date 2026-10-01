import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntryExperience } from "@/components/entry/entry-experience";
import { getI18n } from "@/i18n/server";
import { safeNextPath } from "@/lib/safe-next";
import { isAdmin } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t.meta.title } };
}

export default async function WelcomePage(props: PageProps<"/welcome">) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const mode = params.mode === "guest" ? "guest" : "admin";

  // An administrator who is already signed in goes straight to the dashboard.
  if (mode === "admin" && params.expired !== "1" && (await isAdmin())) {
    redirect(next && next.startsWith("/admin") ? next : "/admin");
  }

  return <EntryExperience next={next} initialMode={mode} expired={params.expired === "1"} />;
}
