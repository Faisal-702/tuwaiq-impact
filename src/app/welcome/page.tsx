import type { Metadata } from "next";
import { EntryExperience } from "@/components/entry/entry-experience";
import { getI18n } from "@/i18n/server";
import { safeNextPath } from "@/lib/safe-next";
import { getAdminChallenge } from "@/server/admin-verification";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t.meta.title } };
}

export default async function WelcomePage(props: PageProps<"/welcome">) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  // Students are the default audience; /admin redirects arrive with ?mode=admin.
  // A reload during the verification code step returns to that step.
  const challenge = await getAdminChallenge();
  const mode = challenge || params.mode === "admin" ? "admin" : "student";

  // The entry page is always shown: a previous admin login never skips it.

  return (
    <EntryExperience
      next={next}
      initialMode={mode}
      expired={params.expired === "1"}
      pendingAdmin={challenge ? { step: challenge.purpose, email: challenge.email } : null}
    />
  );
}
