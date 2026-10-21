"use client";

import { MotionConfig } from "motion/react";
import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { NavigationLoader } from "@/components/ui/navigation-loader";

export function AppProviders({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <MotionConfig reducedMotion="user">
        {children}
        <NavigationLoader />
        <Toaster
          dir={dir}
          position={dir === "rtl" ? "bottom-left" : "bottom-right"}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-2xl !border !border-line !bg-white !text-ink !shadow-lift !font-[inherit] !text-[0.9375rem]",
              description: "!text-muted",
            },
          }}
        />
      </MotionConfig>
    </Direction.Provider>
  );
}
