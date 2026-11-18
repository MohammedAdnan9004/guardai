"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AuthSecurityTicker } from "@/components/auth/auth-security-ticker";

interface AuthShellProps {
  title: string;
  subtitle: string;
  badgeText?: string;
  children: ReactNode;
}

const PROOF_POINTS = [
  {
    icon: ShieldCheck,
    title: "Tenant isolation by default",
    body: "PostgreSQL Row Level Security scopes every query to your workspace_id.",
  },
  {
    icon: Zap,
    title: "Instant profile & role sync",
    body: "on_auth_user_created binds profile, workspace, and Tenant Admin atomically.",
  },
  {
    icon: LockKeyhole,
    title: "Hardened auth perimeter",
    body: "Upstash Redis brute-force lockout, OTP throttling, and HTTP-only cookies.",
  },
];

export function AuthShell({
  title,
  subtitle,
  badgeText = "PHASE 1 • SECURITY BASELINE",
  children,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* Left Decorative Obsidian Showcase Panel */}
      <aside className="relative hidden w-[46%] max-w-[40rem] overflow-hidden bg-[#060a14] lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-0 grid-bg opacity-70" />
          <div className="absolute -top-32 -left-24 size-[32rem] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,var(--brand-1),transparent_62%)] opacity-25 blur-3xl" />
          <div
            className="absolute right-[-8rem] bottom-[-10rem] size-[30rem] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,var(--brand-2),transparent_62%)] opacity-25 blur-3xl"
            style={{ animationDelay: "-7s" }}
          />
          <div className="absolute inset-x-0 top-0 h-px animate-scanline bg-gradient-to-r from-transparent via-brand-1/60 to-transparent" />
        </div>

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <BrandLogo
            tagline="Phase 1 · Identity & RBAC"
            className="[&_span]:text-white"
          />

          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[0.65rem] tracking-[0.16em] text-white/75 uppercase">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Zero-Trust Access Engine
              </span>

              <h2 className="max-w-md font-heading text-[2.1rem] leading-[1.15] font-semibold text-white xl:text-[2.4rem]">
                Every tenant{" "}
                <span className="text-gradient">cryptographically isolated</span>{" "}
                at sign-in.
              </h2>

              <p className="max-w-sm text-sm leading-relaxed text-white/55">
                GuardAI validates inputs with Zod, protects endpoints with
                Upstash Redis, and embeds RBAC claims directly into every JWT
                session.
              </p>
            </div>

            <AuthSecurityTicker />
          </div>

          <ul className="space-y-3.5">
            {PROOF_POINTS.map(({ icon: Icon, title: ptTitle, body }) => (
              <li key={ptTitle} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="size-3.5 text-brand-1" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-white/90">
                    {ptTitle}
                  </p>
                  <p className="text-xs leading-relaxed text-white/45">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right Clean Form Panel */}
      <main className="relative flex flex-1 flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 dot-bg opacity-70 lg:hidden"
        />

        <header className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </Link>

          <div className="flex items-center gap-3">
            <BrandLogo showWordmark={false} className="lg:hidden" />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[27rem] space-y-6"
          >
            <div className="space-y-2">
              <p className="font-mono text-[0.65rem] font-medium tracking-[0.18em] text-primary uppercase">
                {badgeText}
              </p>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </div>

            {children}
          </motion.div>
        </div>

        <footer className="px-5 pb-6 text-center text-[0.7rem] text-muted-foreground sm:px-8">
          Protected by Zod validation, Upstash Redis rate limiting &amp;
          Supabase RLS
        </footer>
      </main>
    </div>
  );
}
