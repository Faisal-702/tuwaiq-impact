import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary:
    "bg-purple text-white shadow-[0_8px_20px_-10px_rgb(109_74_255/0.8)] hover:bg-purple-strong active:bg-purple-ink",
  secondary:
    "bg-white text-purple ring-1 ring-inset ring-purple/35 hover:bg-lavender-soft hover:ring-purple/60",
  teal: "bg-teal-deep text-white hover:bg-[#0c625b] shadow-[0_8px_20px_-12px_rgb(15_118_110/0.8)]",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink",
  subtle: "bg-canvas text-ink ring-1 ring-inset ring-line hover:bg-white hover:ring-[#d6d9df]",
  danger: "bg-danger-ink text-white hover:bg-[#962016]",
  "danger-ghost": "text-danger-ink hover:bg-danger-soft",
} as const;

const SIZES = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[0.9375rem] gap-2 rounded-xl",
  lg: "h-13 px-7 text-base gap-2.5 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
};

export function buttonClasses(variant: keyof typeof VARIANTS = "primary", size: keyof typeof SIZES = "md") {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform] duration-200 ease-out-soft active:translate-y-px disabled:pointer-events-none disabled:opacity-55",
    VARIANTS[variant],
    SIZES[size],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", asChild, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonClasses(variant, size), className)}
      {...props}
    />
  );
});
