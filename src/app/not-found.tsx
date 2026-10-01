import { Compass } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 py-24">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-lavender-soft text-purple">
          <Compass className="size-7" aria-hidden />
        </div>
        <p className="mt-6 text-sm font-semibold text-teal-deep">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{t.common.notFoundTitle}</h1>
        <p className="mt-3 text-muted">{t.common.notFoundBody}</p>
        <Link href="/" className={buttonClasses("primary", "md") + " mt-8"}>
          {t.common.goHome}
        </Link>
      </div>
    </div>
  );
}
