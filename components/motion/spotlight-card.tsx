"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends React.ComponentProps<"div"> {
  inert?: boolean;
}

export function SpotlightCard({
  className,
  children,
  inert = false,
  ...props
}: SpotlightCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (inert || event.pointerType !== "mouse") return;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      node.style.setProperty("--my", `${event.clientY - rect.top}px`);
    },
    [inert]
  );

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn(
        "group/spotlight relative overflow-hidden rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl",
        !inert && "spotlight lift hover:border-primary/35",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
