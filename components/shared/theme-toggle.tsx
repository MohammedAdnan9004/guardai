"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useIsMounted } from "@/lib/hooks/use-client-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "light", icon: SunIcon, label: "Light mode" },
  { id: "dark", icon: MoonIcon, label: "Dark mode" },
  { id: "system", icon: MonitorIcon, label: "System theme" },
] as const;

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  if (compact) {
    const isDark = mounted && resolvedTheme === "dark";
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          mounted
            ? isDark
              ? "Switch to light mode"
              : "Switch to dark mode"
            : "Toggle theme"
        }
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn("relative overflow-hidden rounded-full border border-border/60 bg-card/70", className)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ y: 12, opacity: 0, rotate: -35 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -12, opacity: 0, rotate: 35 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <MoonIcon className="size-4 text-brand-1" />
            ) : (
              <SunIcon className="size-4 text-amber-500" />
            )}
          </motion.span>
        </AnimatePresence>
      </Button>
    );
  }

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-[6.5rem] rounded-full border border-border/60 bg-muted/40",
          className
        )}
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/50 p-0.5 backdrop-blur-md",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.id)}
            className={cn(
              "relative inline-flex size-7 items-center justify-center rounded-full transition-colors cursor-pointer",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="guardai-theme-pill"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
              />
            )}
            <Icon className="relative z-10 size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
