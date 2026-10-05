import { LoadingAnimation } from "@/components/ui/loading-animation";
import { cn } from "@/lib/utils";

/**
 * Route loading state (used by the `loading.tsx` files): the shared loading
 * animation, centered in the page area. It fades in only if the page takes
 * a noticeable time to load.
 */
export function PageLoading({ label, variant }: { label: string; variant: "admin" | "site" }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="page-loading"
      className={cn(
        "grid place-items-center",
        variant === "site" ? "container-page min-h-[60vh] py-10" : "min-h-[60vh]",
      )}
    >
      <span className="sr-only">{label}</span>
      <LoadingAnimation size={88} className="loading-reveal" />
    </div>
  );
}
