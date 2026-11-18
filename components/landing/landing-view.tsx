"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  Fingerprint,
  GaugeCircle,
  KeyRound,
  Layers,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { Parallax, WordReveal } from "@/components/motion/parallax";
import { TiltCard } from "@/components/motion/tilt-card";
import { Magnetic } from "@/components/motion/magnetic";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { Reveal } from "@/components/motion/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { IdentityGatewayPreview } from "@/components/landing/identity-gateway-preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EffectiveRole } from "@/lib/auth/types";

interface LandingViewProps {
  isAuthenticated: boolean;
  userRole: EffectiveRole | null;
  workspaceName: string | null;
}

const METRICS = [
  { value: "< 5ms", label: "Trigger-driven profile sync" },
  { value: "5 / 15m", label: "Redis brute-force lockout" },
  { value: "3 / 15m", label: "OTP spam prevention window" },
  { value: "0", label: "Cross-tenant RLS leak paths" },
];

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: "Strict Zod + RegEx Engine",
    body: "Symmetric client and server schema validation, fortified password complexity checks, XSS sanitization, and log integrity rules.",
  },
  {
    icon: GaugeCircle,
    title: "Upstash Redis Rate Shield",
    body: "Multi-layer IP and workspace rate limits, 5-attempt 15-minute login lockouts, and 3/15m OTP recovery anti-abuse controls.",
  },
  {
    icon: Fingerprint,
    title: "Instant Trigger Sync",
    body: "PostgreSQL on_auth_user_created trigger provisions profiles, workspaces, and Tenant Admin roles atomically on signup or Google OAuth.",
  },
  {
    icon: KeyRound,
    title: "6-Digit OTP Recovery",
    body: "Three-stage recovery flow with auto-focusing 6-digit numeric cells, 60-second resend cooldowns, and real-time password strength metering.",
  },
  {
    icon: DatabaseZap,
    title: "PostgreSQL RLS Isolation",
    body: "Custom JWT claims (workspace_id, workspace_role, global_role) isolate Workspace A from Workspace B at the database layer.",
  },
  {
    icon: LockKeyhole,
    title: "Hardened Session Lifecycle",
    body: "Next.js 16 Proxy route guards, HTTP-only SameSite cookies, CSRF Origin checks, and anti-BFCache logout invalidation.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Provision & Sync",
    body: "User signs up via Work Email or Google OAuth. The PostgreSQL trigger creates their profile, isolated workspace, and Tenant Admin membership in one atomic transaction.",
  },
  {
    step: "02",
    title: "Inject JWT Claims",
    body: "Supabase Auth executes custom_access_token_hook to embed workspace_id, workspace_role, and global_role directly into the signed JWT.",
  },
  {
    step: "03",
    title: "Enforce Everywhere",
    body: "Next.js 16 Proxy, Server Components DAL, API routes, and PostgreSQL RLS all evaluate the exact same RBAC policy—so least-privilege never drifts.",
  },
];

const RBAC_ROLES = [
  {
    id: "super_admin",
    label: "Super Admin",
    tier: "Platform Owner Level",
    route: "/super-admin",
    allowed: [
      "Unlimited system access (exempt from Free/Pro plan quotas)",
      "Global platform metrics, tenant suspend/activate & user ban/force-logout",
      "Cross-tenant oversight & global security audit logs",
    ],
    restricted: ["Cannot delete or ban own active Super Admin session"],
  },
  {
    id: "tenant_admin",
    label: "Tenant Admin",
    tier: "Workspace Owner Level",
    route: "/dashboard",
    allowed: [
      "Auto-assigned upon self-signup or Google OAuth provisioning",
      "Manage workspace settings, billing tier, and invite/revoke SOC Analysts",
      "Access log integrity baseline, threat dashboards & personal MFA",
    ],
    restricted: [
      "Strictly isolated to own workspace_id; no cross-tenant or Super Admin access",
    ],
  },
  {
    id: "member",
    label: "SOC Analyst",
    tier: "Team Member Level",
    route: "/dashboard",
    allowed: [
      "Log integrity pre-checks & AI Threat Intelligence baseline",
      "Personal profile management, password rotation & TOTP MFA enrollment",
      "Instant global logout across all protected tabs",
    ],
    restricted: [
      "Strictly blocked from Billing, Team Invites, and Workspace Settings",
    ],
  },
];

export function LandingView({
  isAuthenticated,
  userRole,
  workspaceName,
}: LandingViewProps) {
  const consoleHref =
    userRole === "super_admin" ? "/super-admin" : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <SiteHeader isAuthenticated={isAuthenticated} userRole={userRole} />

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20 sm:pt-40 sm:pb-28">
        <AuroraBackground />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <Reveal trigger="mount" className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase backdrop-blur">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-emerald-500" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Phase 1 · Identity, RBAC &amp; Security Baseline
            </span>

            <h1 className="font-heading text-[2.5rem] leading-[1.06] font-semibold tracking-tight sm:text-[3.25rem] lg:text-[3.55rem]">
              <WordReveal text="Zero-trust access control built for" />{" "}
              <WordReveal
                text="autonomous SOC teams"
                wordClassName="text-gradient-animated"
                delay={0.1}
              />
              <WordReveal text="." delay={0.2} />
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              GuardAI establishes an enterprise-grade 3-Tier Multi-Tenant RBAC
              foundation—combining Zod &amp; RegEx input hardening, Upstash Redis
              brute-force defense, and PostgreSQL Row Level Security from day
              one.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Magnetic>
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:brightness-110"
                >
                  <Link href={isAuthenticated ? consoleHref : "/signup"}>
                    <span>
                      {isAuthenticated
                        ? `Open ${workspaceName ?? "Console"}`
                        : "Provision your workspace"}
                    </span>
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </Magnetic>

              {!isAuthenticated && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-border/70 bg-background/60 px-6 text-sm font-medium backdrop-blur"
                >
                  <Link href="/login">Sign in to console</Link>
                </Button>
              )}
            </div>

            <p className="font-mono text-[0.7rem] text-muted-foreground">
              Tenant Admin auto-assigned · Google OAuth ready · 6-digit OTP
              recovery
            </p>
          </Reveal>

          <Reveal trigger="mount" index={1}>
            <Parallax distance={24} direction="up">
              <TiltCard strength={6}>
                <IdentityGatewayPreview />
              </TiltCard>
            </Parallax>
          </Reveal>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="border-y border-border/60 bg-card/35">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
          {METRICS.map((metric, index) => (
            <Reveal key={metric.label} index={index}>
              <div className="px-6 py-8 text-center">
                <p className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  {metric.value}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Security Architecture Capabilities */}
      <section id="architecture" className="relative px-6 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-6xl space-y-14">
          <Reveal className="mx-auto max-w-2xl space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">
              Global Security Baseline
            </span>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Hardened from form input to PostgreSQL row
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Every authentication endpoint, session cookie, and database query
              enforces strict multi-tenant boundaries before any SOC data enters
              the system.
            </p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap, index) => {
              const Icon = cap.icon;
              return (
                <Reveal key={cap.title} index={index}>
                  <SpotlightCard className="h-full p-5">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-20 -right-20 size-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover/spotlight:opacity-100"
                    />
                    <div className="relative space-y-3">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/45 transition-colors group-hover/spotlight:border-primary/30 group-hover/spotlight:bg-primary/10">
                        <Icon className="size-4.5 text-primary" />
                      </span>
                      <h3 className="font-heading text-base font-semibold">
                        {cap.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {cap.body}
                      </p>
                    </div>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* How Phase 1 Works */}
      <section
        id="workflow"
        className="relative overflow-hidden border-y border-border/60 bg-card/35 px-6 py-24 sm:py-28"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid-bg opacity-60 mask-radial"
        />
        <div className="relative mx-auto w-full max-w-6xl space-y-14">
          <Reveal className="mx-auto max-w-2xl space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 font-mono text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">
              Identity Lifecycle
            </span>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Three atomic steps from sign-up to isolation
            </h2>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-3">
            {WORKFLOW_STEPS.map((item, index) => (
              <Reveal key={item.step} index={index}>
                <div className="relative h-full rounded-2xl border border-border/60 bg-background/70 p-6 backdrop-blur-xl">
                  <span className="font-mono text-4xl font-semibold text-primary/25">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-heading text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive 3-Tier RBAC & PostgreSQL RLS */}
      <section id="rbac" className="px-6 py-24 sm:py-28">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-14">
          <Reveal className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 font-mono text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">
              <Layers className="size-3 text-primary" />
              3-Tier RBAC Matrix
            </span>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Strict privilege separation across every tier
            </h2>

            <Tabs defaultValue="tenant_admin" className="pt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="super_admin" className="text-xs">
                  Super Admin
                </TabsTrigger>
                <TabsTrigger value="tenant_admin" className="text-xs">
                  Tenant Admin
                </TabsTrigger>
                <TabsTrigger value="member" className="text-xs">
                  SOC Analyst
                </TabsTrigger>
              </TabsList>

              {RBAC_ROLES.map((role) => (
                <TabsContent key={role.id} value={role.id}>
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-card/75 p-5 backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div>
                        <p className="font-heading text-base font-semibold">
                          {role.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {role.tier}
                        </p>
                      </div>
                      <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-primary">
                        {role.route}
                      </code>
                    </div>

                    <div className="space-y-2">
                      {role.allowed.map((item) => (
                        <p
                          key={item}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                          <span>{item}</span>
                        </p>
                      ))}
                      {role.restricted.map((item) => (
                        <p
                          key={item}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                          <span>{item}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Reveal>

          <Reveal index={1}>
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-slate-950 p-5 font-mono text-xs shadow-2xl">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -left-16 size-56 rounded-full bg-brand-2/20 blur-3xl"
              />
              <p className="relative mb-3 text-[0.6rem] tracking-[0.14em] text-slate-400 uppercase">
                postgresql rls · public.workspaces
              </p>
              <pre className="relative overflow-x-auto leading-relaxed text-cyan-300">
                <code>{`CREATE POLICY "workspaces_select_own_or_super"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_workspace_member(id)
  );

-- Workspace A can never query Workspace B.
-- Super Admin accounts bypass filters explicitly.`}</code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-24">
        <Reveal className="mx-auto w-full max-w-5xl">
          <div className="border-glow relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/90 via-card/70 to-primary/10 px-6 py-14 text-center backdrop-blur-xl sm:px-12">
            <div className="relative mx-auto max-w-xl space-y-5">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Launch your isolated SOC workspace
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Register as Tenant Admin, test brute-force Redis protection,
                verify 6-digit OTP recovery, and inspect live JWT claims.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:brightness-110"
                >
                  <Link href={isAuthenticated ? consoleHref : "/signup"}>
                    <span>
                      {isAuthenticated ? "Enter Console" : "Create free workspace"}
                    </span>
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-sm">
                  <Link href="/forgot-password">Test 6-Digit OTP Flow</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandLogo size="sm" />
          <p className="text-xs text-muted-foreground">
            GuardAI Phase 1 · Authentication, 3-Tier RBAC, Redis Rate Limits &amp;
            PostgreSQL RLS
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
            <Link href="/forgot-password" className="hover:text-foreground">
              Recovery
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
