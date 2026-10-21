"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Form controls for the project submission wizard. Every control renders a
 * real <label>, describes its hint/error through aria-describedby, and marks
 * itself invalid with aria-invalid, so the form works with a keyboard and a
 * screen reader. Logical properties (ps/pe, start/end) keep RTL and LTR right.
 */

const controlBase =
  "w-full rounded-xl border bg-white text-[0.9375rem] text-ink placeholder:text-[#9aa1ad] transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-4 disabled:bg-canvas";
const controlState = (invalid: boolean) =>
  invalid
    ? "border-danger-ink/50 focus:border-danger-ink/60 focus:ring-danger-ink/10"
    : "border-line hover:border-[#cfd3da] focus:border-purple/60 focus:ring-purple/10";

export function FieldShell({
  id,
  label,
  required,
  optional,
  hint,
  error,
  counter,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  optional?: string;
  hint?: ReactNode;
  error?: string;
  counter?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)} data-field={id}>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} id={`${id}-label`} className="block text-[0.9375rem] font-semibold leading-snug text-ink">
          {label}
          {required ? (
            <span className="ms-1 text-danger-ink" aria-hidden>
              *
            </span>
          ) : optional ? (
            <span className="ms-2 text-xs font-normal text-muted">{optional}</span>
          ) : null}
        </label>
        {counter}
      </div>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextInput({
  id,
  value,
  onChange,
  icon: Icon,
  invalid,
  describedById,
  suffix,
  className,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  invalid: boolean;
  describedById?: string;
  suffix?: ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" strokeWidth={1.8} />
      ) : null}
      <input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
                {...rest}
        className={cn(controlBase, controlState(invalid), "h-12", Icon ? "ps-11" : "ps-4", suffix ? "pe-14" : "pe-4", className)}
      />
      {suffix ? (
        <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">{suffix}</span>
      ) : null}
    </div>
  );
}

export function TextArea({
  id,
  value,
  onChange,
  invalid,
  describedById,
  rows = 4,
  className,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedById?: string;
  rows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "id">) {
  return (
    <textarea
      id={id}
      name={id}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      {...rest}
      className={cn(controlBase, controlState(invalid), "min-h-28 resize-y px-4 py-3 leading-relaxed", className)}
    />
  );
}

export function SelectInput({
  id,
  value,
  onChange,
  invalid,
  describedById,
  placeholder,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedById?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        className={cn(controlBase, controlState(invalid), "h-12 cursor-pointer appearance-none pe-11 ps-4", !value && "text-[#9aa1ad]")}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** Single choice shown as cards with a radio mark (native radio inputs underneath). */
export function ChoiceCards({
  name,
  labelledBy,
  value,
  onChange,
  options,
  invalid,
  describedById,
  columns = 3,
}: {
  name: string;
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  invalid: boolean;
  describedById?: string;
  columns?: 2 | 3;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      aria-describedby={describedById}
      className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "grid-cols-2")}
    >
      {options.map((o, i) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 text-[0.9375rem] transition-[border-color,box-shadow,background-color] duration-200",
              checked
                ? "border-purple/60 bg-lavender-soft/60 text-purple-ink shadow-[0_0_0_3px_rgb(109_74_255/0.08)]"
                : invalid
                  ? "border-danger-ink/50 text-ink hover:border-danger-ink/70"
                  : "border-line text-ink hover:border-[#cfd3da]",
              "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-purple/15",
            )}
          >
            <input
              type="radio"
              name={name}
              id={i === 0 ? name : undefined}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                checked ? "border-purple bg-purple" : "border-[#c5cad3] bg-white",
              )}
            >
              {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
            </span>
            <span className="font-medium">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  invalid,
  describedById,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  invalid?: boolean;
  describedById?: string;
}) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-3 text-[0.9375rem] font-semibold text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-purple/15",
          checked ? "border-purple bg-purple text-white" : invalid ? "border-danger-ink/60 bg-white" : "border-[#c5cad3] bg-white",
        )}
      >
        {checked ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
      {label}
    </label>
  );
}
