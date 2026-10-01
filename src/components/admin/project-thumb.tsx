import { CategoryIcon } from "@/lib/categories";

export function ProjectThumb({ src, icon }: { src: string | null; icon: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-line-soft" />
  ) : (
    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-mint-soft to-lavender-soft ring-1 ring-line-soft">
      <CategoryIcon name={icon} className="size-5 text-teal-deep" aria-hidden />
    </span>
  );
}
