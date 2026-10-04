import Image from "next/image";
import { cn } from "@/lib/utils";
import moeLogo from "../../../public/brand/moe-logo.png";

/**
 * Site header branding: the official Ministry of Education logo beside the
 * school's name (text only, no second logo).
 */
export function SchoolBrand({
  school,
  moeAlt,
  priority,
  className,
}: {
  school: string;
  moeAlt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3 sm:gap-4", className)}>
      <Image
        src={moeLogo}
        alt={moeAlt}
        loading={priority ? "eager" : undefined}
        className="h-[36px] w-auto max-w-none sm:h-[42px]"
        sizes="112px"
      />
      {/* Arabic name stays on one line; the longer English name forms a balanced two-line block. */}
      <span
        data-testid="school-brand"
        className="max-w-[9.5rem] text-balance text-[0.875rem] sm:max-w-[11rem] font-bold leading-[1.2] text-ink sm:text-base rtl:max-w-none rtl:whitespace-nowrap rtl:xl:text-lg 2xl:text-[1.0625rem] rtl:2xl:text-[1.1875rem]"
      >
        {school}
      </span>
    </span>
  );
}
