"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Severity = "synced" | "guarded" | "throttled" | "blocked";

interface SecurityTick {
  id: number;
  status: Severity;
  rule: string;
  detail: string;
}

const TICKS: SecurityTick[] = [
  {
    id: 1,
    status: "synced",
    rule: "Trigger · on_auth_user_created",
    detail: "Profile & Tenant Admin workspace synced in 3.8ms",
  },
  {
    id: 2,
    status: "guarded",
    rule: "Redis · Brute-Force Lockout",
    detail: "5-attempt threshold armed with 15-minute cooldown",
  },
  {
    id: 3,
    status: "throttled",
    rule: "OTP · 6-Digit Recovery Gate",
    detail: "Upstash window enforcing max 3 sends per 15m",
  },
  {
    id: 4,
    status: "blocked",
    rule: "PostgreSQL · RLS Boundary",
    detail: "Cross-tenant query denied on JWT claim mismatch",
  },
  {
    id: 5,
    status: "synced",
    rule: "JWT · custom_access_token_hook",
    detail: "Embedded workspace_id & workspace_role claims",
  },
];

const STATUS_STYLE: Record<Severity, { dot: string; chip: string }> = {
  synced: {
    dot: "bg-emerald-400",
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  guarded: {
    dot: "bg-cyan-400",
    chip: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  },
  throttled: {
    dot: "bg-amber-400",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  blocked: {
    dot: "bg-rose-400",
    chip: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  },
};

export function AuthSecurityTicker({ className }: { className?: string }) {
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setCursor((current) => (current + 1) % TICKS.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  const visible = Array.from(
    { length: 3 },
    (_, offset) => TICKS[(cursor + offset) % TICKS.length]
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[0.65rem] tracking-[0.16em] text-white/50 uppercase">
          Security baseline stream
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[0.65rem] text-white/50">
            enforcing
          </span>
        </span>
      </div>

      <div className="relative h-[10.5rem] overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((event, index) => {
            const styles = STATUS_STYLE[event.status];
            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 26, scale: 0.97 }}
                animate={{
                  opacity: 1 - index * 0.28,
                  y: index * 56,
                  scale: 1 - index * 0.02,
                }}
                exit={{ opacity: 0, y: -20, scale: 0.97 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-0"
              >
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      styles.dot
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[0.7rem] text-white/85">
                      {event.rule}
                    </p>
                    <p className="truncate text-[0.7rem] text-white/55">
                      {event.detail}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[0.58rem] tracking-wide uppercase",
                      styles.chip
                    )}
                  >
                    {event.status}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#060a14] to-transparent" />
      </div>
    </div>
  );
}
