"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
        "bg-gradient-to-br from-brand-1/20 via-brand-2/20 to-brand-3/20",
        "ring-1 ring-inset ring-brand-1/30 shadow-[0_0_20px_-6px_var(--glow)]",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
        <defs>
          <linearGradient id="guardai-aegis" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="var(--brand-1)" />
            <stop offset="52%" stopColor="var(--brand-2)" />
            <stop offset="100%" stopColor="var(--brand-3)" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.4 4.4 5.7v6c0 4.8 3.2 8.5 7.6 10 4.4-1.5 7.6-5.2 7.6-10v-6L12 2.4Z"
          stroke="url(#guardai-aegis)"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        <path
          d="M8.4 12.1h2l1.2-2.5 1.5 4.4 1.2-1.9h1.8"
          stroke="url(#guardai-aegis)"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pulse"
        />
      </svg>
    </span>
  );
}

interface BrandLogoProps {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  showTagline?: boolean;
  tagline?: string;
  className?: string;
}

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = true,
  showTagline = false,
  tagline = "Phase 1 · Identity & RBAC",
  className,
}: BrandLogoProps) {
  const iconSize = size === "sm" ? "size-8" : size === "lg" ? "size-10" : "size-9";
  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-[1.05rem]";

  const content = (
    <span className={cn("group inline-flex items-center gap-2.5 select-none", className)}>
      <BrandMark
        className={cn(
          iconSize,
          "transition-transform duration-300 group-hover:scale-105"
        )}
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-heading font-semibold tracking-tight text-foreground",
              textSize
            )}
          >
            Guard<span className="text-gradient">AI</span>
          </span>
          {(showTagline || tagline !== "Phase 1 · Identity & RBAC") && (
            <span className="mt-0.5 font-mono text-[0.58rem] tracking-[0.18em] text-muted-foreground uppercase">
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="GuardAI home" className="inline-flex">
      {content}
    </Link>
  );
}
