import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-xl border border-line bg-white px-4 text-[0.9375rem] text-ink placeholder:text-[#9aa1ad] shadow-[inset_0_1px_1px_rgb(16_24_40/0.03)] transition-[border-color,box-shadow] duration-200 hover:border-[#d3d7de] focus:border-purple/60 focus:outline-none focus:ring-4 focus:ring-purple/10 disabled:bg-canvas disabled:text-muted aria-invalid:border-danger-ink/60 aria-invalid:ring-danger-ink/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputBase, "min-h-32 py-3 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(inputBase, "h-11 cursor-pointer appearance-none pe-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-purple" aria-hidden>
            *
          </span>
        ) : optionalLabel ? (
          <span className="text-xs font-normal text-muted">{optionalLabel}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
