"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-client-state";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const VARIANTS: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 20 },
    shown: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -16 },
    shown: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -20 },
    shown: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 20 },
    shown: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.96 },
    shown: { opacity: 1, scale: 1 },
  },
};

export type RevealDirection = keyof typeof VARIANTS;

interface RevealProps {
  children: ReactNode;
  index?: number;
  direction?: RevealDirection;
  trigger?: "view" | "mount";
  duration?: number;
  className?: string;
}

const VIEWPORT = { once: true, amount: "some", margin: "0px 0px 90px 0px" } as const;

export function Reveal({
  children,
  index = 0,
  direction = "up",
  trigger = "view",
  duration = 0.5,
  className,
}: RevealProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  const variants = VARIANTS[direction];
  const delay = Math.min(index * 0.07, 0.42);
  const activation =
    trigger === "view"
      ? { whileInView: "shown", viewport: VIEWPORT }
      : { animate: "shown" };

  return (
    <motion.div
      initial="hidden"
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
      className={cn(className)}
      {...activation}
    >
      {children}
    </motion.div>
  );
}
