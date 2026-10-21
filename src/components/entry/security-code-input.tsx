"use client";

import { motion } from "motion/react";
import { useState, type RefObject } from "react";
import { normalizeAdminCode } from "@/lib/admin-code";
import { cn } from "@/lib/utils";

const LENGTH = 8;

/** Keeps digits only (Arabic-Indic digits become ASCII), at most 8. */
const sanitize = (raw: string) => normalizeAdminCode(raw).replace(/\D/g, "").slice(0, LENGTH);

/**
 * The administrator's 8-digit security code, shown as 8 separate boxes.
 *
 * One real input (transparent, covering the boxes) holds the whole value, so
 * typing moves on to the next box, Backspace goes back, pasting a full code
 * works, and screen readers and password managers see a single field. The
 * boxes only mirror its value. Digits always run left to right, as numbers
 * do in Arabic too.
 */
export function SecurityCodeInput({
  id,
  name,
  inputRef,
  visible,
  invalid,
  shake,
  describedBy,
  autoComplete,
}: {
  id: string;
  name: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Show the digits instead of dots. */
  visible: boolean;
  invalid: boolean;
  shake?: boolean;
  describedBy?: string;
  autoComplete: string;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, LENGTH - 1);

  // Editing always happens at the end of the code (like typing box by box).
  const keepCaretAtEnd = (input: HTMLInputElement) => {
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
  };

  return (
    <motion.div
      dir="ltr"
      className="relative"
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(sanitize(e.target.value))}
        onFocus={(e) => {
          setFocused(true);
          keepCaretAtEnd(e.currentTarget);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
        type={visible ? "text" : "password"}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        spellCheck={false}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="absolute inset-0 z-10 size-full cursor-text appearance-none bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
      <div aria-hidden className="grid grid-cols-8 gap-1.5 sm:gap-2.5">
        {Array.from({ length: LENGTH }, (_, i) => {
          const filled = i < value.length;
          const current = focused && i === active;
          return (
            <div
              key={i}
              data-active={current || undefined}
              data-filled={filled || undefined}
              className={cn(
                "grid h-11 place-items-center rounded-xl border bg-white text-[1.25rem] font-semibold tabular-nums text-ink transition-[border-color,box-shadow,background-color] duration-150 sm:h-[3.25rem] sm:rounded-2xl",
                invalid
                  ? "border-danger-ink/45"
                  : current
                    ? "border-purple/70 shadow-[0_0_0_4px_rgb(109_74_255/0.12)]"
                    : filled
                      ? "border-[#d9d4f5]"
                      : "border-line shadow-[inset_0_1px_2px_rgb(16_24_40/0.04)]",
              )}
            >
              {filled ? (
                visible ? (
                  value[i]
                ) : (
                  <span className="size-2.5 rounded-full bg-ink" />
                )
              ) : current ? (
                <span className="h-5 w-0.5 rounded-full bg-purple motion-safe:animate-[caret-blink_1s_steps(1)_infinite]" />
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
