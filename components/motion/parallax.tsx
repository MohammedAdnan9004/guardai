"use client";

import * as React from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  useIsMounted,
  usePrefersReducedMotion,
} from "@/lib/hooks/use-client-state";
import { cn } from "@/lib/utils";

interface ParallaxProps {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  direction?: "up" | "down";
}

function ParallaxInner({
  children,
  className,
  distance = 44,
  direction = "up",
}: ParallaxProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  const travel = direction === "up" ? -distance : distance;
  const y = useTransform(smooth, [0, 1], [-travel, travel]);

  return (
    <div ref={ref} className={cn(className)}>
      <motion.div style={{ y }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}

export function Parallax({
  children,
  className,
  distance = 44,
  direction = "up",
}: ParallaxProps) {
  const mounted = useIsMounted();
  const reducedMotion = usePrefersReducedMotion();

  if (!mounted || reducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <ParallaxInner
      className={className}
      distance={distance}
      direction={direction}
    >
      {children}
    </ParallaxInner>
  );
}

export function WordReveal({
  text,
  className,
  wordClassName,
  delay = 0,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <span className={cn("inline", wordClassName, className)}>{text}</span>;
  }

  const words = text.split(" ");

  return (
    <span className={cn("inline", className)}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="inline-block overflow-hidden align-bottom"
        >
          <span
            className={cn("animate-word-rise inline-block", wordClassName)}
            style={{ animationDelay: `${delay + index * 0.045}s` }}
          >
            {word}
            {index < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
