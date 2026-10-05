import { cn } from "@/lib/utils";

/**
 * Lightweight placeholder shown by the route `loading.tsx` files while a
 * page's data loads, so navigation responds immediately instead of waiting
 * for the server to finish rendering.
 */
export function PageLoading({ label, variant }: { label: string; variant: "admin" | "site" }) {
  const block = "rounded-[1.25rem] bg-white ring-1 ring-line-soft";
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="page-loading"
      className={cn("animate-pulse motion-reduce:animate-none", variant === "site" && "container-page pb-8 pt-10 sm:pt-14")}
    >
      <span className="sr-only">{label}</span>
      <div className="h-8 w-56 max-w-full rounded-lg bg-line-soft" />
      <div className="mt-3 h-4 w-96 max-w-full rounded-md bg-line-soft/70" />
      {variant === "admin" ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(block, "h-28")} />
            ))}
          </div>
          <div className={cn(block, "mt-6 h-80")} />
        </>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn(block, "h-56")} />
          ))}
        </div>
      )}
    </div>
  );
}
