import { CategoryIcon, categoryAccent } from "@/lib/categories";
import type { ProjectCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Card thumbnail. Uses the optimised thumbnail variant generated at upload
 * time (never the full-resolution original). Projects without imagery get a
 * calm branded cover based on their category.
 */
export function ProjectCover({
  project,
  className,
  eager,
}: {
  project: Pick<ProjectCardData, "cover" | "title" | "category">;
  className?: string;
  eager?: boolean;
}) {
  if (project.cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- pre-optimised variant from storage
      <img
        src={project.cover.url}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.035]",
          className,
        )}
      />
    );
  }
  const accent = categoryAccent(project.category.accent);
  return (
    <div
      aria-hidden
      className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br", accent.tint, className)}
    >
      <div className="dot-grid absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(70%_70%_at_70%_30%,#000,transparent)]" />
      <div className="absolute -bottom-10 -end-10 size-48 rounded-full bg-white/50 blur-2xl" />
      <div className="relative grid size-16 place-items-center rounded-2xl bg-white/80 shadow-soft ring-1 ring-white transition-transform duration-500 ease-out-soft group-hover:scale-105">
        <CategoryIcon name={project.category.icon} className={cn("size-7", accent.icon)} strokeWidth={1.6} />
      </div>
    </div>
  );
}
