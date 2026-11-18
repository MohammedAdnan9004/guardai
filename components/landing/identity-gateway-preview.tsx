"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { Check, ShieldCheck } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-client-state";
import { cn } from "@/lib/utils";

const GATEWAY_EVENTS = [
  {
    id: "AUTH-904",
    status: "Synced",
    title: "Tenant Admin Workspace Provisioned",
    meta: "on_auth_user_created · 3.8ms",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    id: "RDS-903",
    status: "Guarded",
    title: "Login Brute-Force Shield Active",
    meta: "Upstash Redis · 5 attempts / 15m",
    tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  },
  {
    id: "OTP-902",
    status: "Throttled",
    title: "6-Digit Recovery OTP Limit Check",
    meta: "2 of 3 dispatches remaining (15m)",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  {
    id: "RLS-901",
    status: "Blocked",
    title: "Cross-Tenant Query Rejected",
    meta: "Workspace B probe · JWT mismatch",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
];

const CLAIM_SYNTHESIS = `custom_access_token_hook minted JWT:
{
  "global_role": "user",
  "workspace_id": "ws_92a4e8c1-7d2b",
  "workspace_role": "tenant_admin",
  "rls_isolation": "strict"
}`;

const POLICY_CHECKS = [
  "Zod + RegEx verified on client & server",
  "HTTP-only SameSite cookies + Origin CSRF",
  "PostgreSQL RLS filters every tenant query",
];

function ClaimsSynthesizer({ active }: { active: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const [typed, setTyped] = React.useState(0);

  React.useEffect(() => {
    if (!active || reducedMotion) return;

    const interval = window.setInterval(() => {
      setTyped((curr) => {
        if (curr >= CLAIM_SYNTHESIS.length) {
          window.clearInterval(interval);
          return curr;
        }
        return curr + 3;
      });
    }, 18);

    return () => window.clearInterval(interval);
  }, [active, reducedMotion]);

  const visible = reducedMotion ? CLAIM_SYNTHESIS.length : typed;
  const done = visible >= CLAIM_SYNTHESIS.length;

  return (
    <div className="space-y-3 p-3.5">
      <p className="flex items-center gap-1.5 px-1 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
        <ShieldCheck className="size-3.5 text-primary" />
        JWT Claims &amp; RLS Verifier
      </p>

      <div className="min-h-[8.2rem] rounded-xl border border-border/60 bg-slate-950 p-3 font-mono text-[0.68rem] leading-relaxed text-cyan-300">
        <pre className="whitespace-pre-wrap break-all">
          {CLAIM_SYNTHESIS.slice(0, visible)}
          {!done && (
            <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-cyan-400 align-middle" />
          )}
        </pre>
      </div>

      <div className="space-y-1.5">
        <p className="px-1 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
          Enforced Security Baseline
        </p>
        {POLICY_CHECKS.map((step, index) => (
          <motion.div
            key={step}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ delay: index * 0.12, duration: 0.35 }}
            className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5"
          >
            <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" />
            <span className="text-[0.7rem] leading-relaxed text-muted-foreground">
              {step}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function IdentityGatewayPreview({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-1/20 via-brand-2/15 to-brand-3/20 blur-3xl"
      />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-2xl shadow-black/15 backdrop-blur-xl">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/45 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500/70" />
            <span className="size-2.5 rounded-full bg-amber-500/70" />
            <span className="size-2.5 rounded-full bg-emerald-500/70" />
          </span>
          <span className="ml-2 font-mono text-[0.65rem] text-muted-foreground">
            guardai · phase-1-identity-gateway
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-[0.6rem] text-muted-foreground">
              rls active
            </span>
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.05fr_1fr]">
          {/* Auth & RBAC Events */}
          <div className="space-y-2 border-b border-border/60 p-3.5 md:border-r md:border-b-0">
            <p className="px-1 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
              Security Gateways
            </p>

            {GATEWAY_EVENTS.map((ev, index) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -12 }}
                animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                transition={{ delay: 0.1 + index * 0.09, duration: 0.4 }}
                className={cn(
                  "rounded-xl border border-border/60 bg-background/60 p-2.5",
                  index === 0 && "border-primary/35 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.6rem] text-muted-foreground">
                    {ev.id}
                  </span>
                  <span
                    className={cn(
                      "ml-auto rounded border px-1.5 py-px font-mono text-[0.55rem] tracking-wide uppercase",
                      ev.tone
                    )}
                  >
                    {ev.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-medium text-foreground">
                  {ev.title}
                </p>
                <p className="truncate font-mono text-[0.6rem] text-muted-foreground">
                  {ev.meta}
                </p>
              </motion.div>
            ))}
          </div>

          <ClaimsSynthesizer active={inView} />
        </div>

        <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 bg-muted/35">
          {[
            { label: "Profile Sync", value: "< 5ms" },
            { label: "Login Lockout", value: "5 / 15m" },
            { label: "OTP Throttle", value: "3 / 15m" },
          ].map((metric) => (
            <div key={metric.label} className="px-3 py-2.5 text-center">
              <p className="font-heading text-sm font-semibold text-foreground">
                {metric.value}
              </p>
              <p className="font-mono text-[0.55rem] tracking-[0.14em] text-muted-foreground uppercase">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
