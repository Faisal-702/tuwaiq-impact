import type { Metadata } from "next";
import { EntryExperience } from "@/components/entry/entry-experience";
import { getI18n } from "@/i18n/server";
import { safeNextPath } from "@/lib/safe-next";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t.meta.title } };
}

export default async function WelcomePage(props: PageProps<"/welcome">) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const mode = params.mode === "guest" ? "guest" : "admin";

  // The entry page is always shown: a previous admin login never skips it.

  return <EntryExperience next={next} initialMode={mode} expired={params.expired === "1"} />;
}
