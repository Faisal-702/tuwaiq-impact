import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";
import { buttonClasses } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getI18n } from "@/i18n/server";
import { requireViewer } from "@/server/auth";
import { loadProfileStatus } from "@/server/profiles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.profile.metaTitle };
}

/**
 * "الملف الشخصي": the signed-in student's personal details, kept once and
 * used for every project. Read and saved for the session's student only.
 */
export default async function ProfilePage(props: PageProps<"/profile">) {
  const [sp, viewer, { t }] = await Promise.all([props.searchParams, requireViewer(), getI18n()]);
  const p = t.profile;

  if (viewer.kind !== "student") {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl rounded-[1.5rem] bg-white p-8 text-center shadow-soft ring-1 ring-line-soft" data-testid="admin-notice">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-lavender-soft text-purple">
            <ShieldAlert className="size-7" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 className="mt-5 text-xl font-bold text-ink">{p.title}</h1>
          <p className="mt-2 leading-relaxed text-muted">{p.adminNotice}</p>
          <Link href="/admin/students" className={`${buttonClasses("primary", "md")} mt-6`}>
            {t.admin.nav.students}
          </Link>
        </div>
      </div>
    );
  }

  const status = await loadProfileStatus(viewer.student.studentId);
  // Only known reasons are honoured (no open redirects).
  const required = sp.required === "project" && !status.complete;
  const next = sp.required === "project" ? "/add-project" : null;

  return (
    <div className="pb-16">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_100%_0%,rgba(237,233,254,0.75),transparent_65%),radial-gradient(45%_70%_at_0%_10%,rgba(209,250,229,0.5),transparent_60%)]"
        />
        <div className="container-page pb-8 pt-10 sm:pt-14">
          <nav aria-label="breadcrumb" className="text-sm text-muted">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/home" className="transition-colors hover:text-purple">
                  {p.breadcrumbHome}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-ink">
                {p.title}
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-ink sm:text-[2.5rem] rtl:tracking-normal">{p.title}</h1>
          <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-muted">{p.intro}</p>
        </div>
      </section>

      <div className="container-page">
        <ProfileForm initial={status} required={required} next={next} />
      </div>
    </div>
  );
}
