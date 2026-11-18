"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditLogRecord, GuardSessionContext } from "@/lib/auth/types";

interface OverviewViewProps {
  session: GuardSessionContext;
  memberCount: number;
  auditLogs: AuditLogRecord[];
}

export function OverviewView({
  session,
  memberCount,
  auditLogs,
}: OverviewViewProps) {
  const isTenantAdmin = session.effectiveRole === "tenant_admin";
  const workspace = session.workspace;

  const statCards = [
    {
      label: "Tenant Isolation",
      value: "PostgreSQL RLS",
      subtext: "Workspace-scoped claims enforced",
      icon: Database,
      badge: "VERIFIED",
    },
    {
      label: "Assigned Role",
      value: isTenantAdmin ? "Tenant Admin" : "SOC Analyst",
      subtext: isTenantAdmin
        ? "Full workspace & team governance"
        : "Least-privilege operational access",
      icon: ShieldCheck,
      badge: session.claims.account_status.toUpperCase(),
    },
    {
      label: "Plan & Seats",
      value: `${(workspace?.plan ?? "free").toUpperCase()} Tier`,
      subtext: `${memberCount} / ${workspace?.seat_limit ?? 5} seats allocated`,
      icon: KeyRound,
      badge: (workspace?.subscription_status ?? "active").toUpperCase(),
    },
    {
      label: "Auth Perimeter",
      value: "Redis Shield",
      subtext: "5-attempt lockout & 3/15m OTP guard",
      icon: Activity,
      badge: session.profile.mfa_enabled ? "MFA ON" : "MFA READY",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Reveal trigger="mount">
        <SpotlightCard
          inert
          className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyber" className="font-mono text-[10px]">
                PHASE 1 · WORKSPACE CONSOLE
              </Badge>
              <Badge variant="success" className="font-mono text-[10px]">
                RLS ISOLATED
              </Badge>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {workspace?.name ?? "GuardAI SOC Workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Operator:{" "}
              <span className="font-medium text-foreground">
                {session.profile.full_name}
              </span>{" "}
              ({session.user.email})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/dashboard/profile">
                <Lock className="size-3.5" />
                <span>Security &amp; MFA</span>
              </Link>
            </Button>
            {isTenantAdmin && (
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-primary/20 hover:brightness-110"
              >
                <Link href="/dashboard/team">
                  <Users className="size-3.5" />
                  <span>Manage Team</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </SpotlightCard>
      </Reveal>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Reveal key={card.label} trigger="mount" index={idx}>
              <SpotlightCard className="h-full p-0">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="font-mono text-[0.7rem] uppercase tracking-wider">
                    {card.label}
                  </CardDescription>
                  <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-xl font-semibold text-foreground">
                      {card.value}
                    </p>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {card.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{card.subtext}</p>
                </CardContent>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>

      {/* Claims & RBAC Verification + Audit Trail */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <SpotlightCard inert className="h-full p-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Embedded JWT Claims &amp; RBAC
                </CardTitle>
                <Lock className="size-4 text-primary" />
              </div>
              <CardDescription>
                Cryptographically bound tenant identity used by PostgreSQL RLS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="overflow-x-auto rounded-xl border border-border/70 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-cyan-300">
{JSON.stringify(
  {
    user_id: session.user.id,
    workspace_id: session.claims.workspace_id,
    workspace_role: session.claims.workspace_role,
    global_role: session.claims.global_role,
    account_status: session.claims.account_status,
  },
  null,
  2
)}
              </pre>

              <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-3.5 text-xs">
                <p className="font-semibold text-foreground">
                  Phase 1 Role Access Matrix
                </p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  <span>Log Baseline, Threat Readiness &amp; Profile/MFA: Permitted</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {isTenantAdmin ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-rose-500" />
                  )}
                  <span>
                    Billing, Team Invites &amp; Workspace Settings:{" "}
                    {isTenantAdmin ? "Permitted (Tenant Admin)" : "Strictly Blocked"}
                  </span>
                </div>
              </div>
            </CardContent>
          </SpotlightCard>
        </Reveal>

        <Reveal index={1} className="lg:col-span-7">
          <SpotlightCard inert className="h-full p-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Workspace Security Activity
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {isTenantAdmin ? "ADMIN AUDIT FEED" : "SESSION TELEMETRY"}
                </Badge>
              </div>
              <CardDescription>
                {isTenantAdmin
                  ? "Recent authentication, provisioning, and RBAC events inside your tenant."
                  : "Workspace-wide audit feeds are restricted to Tenant Admins."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  {isTenantAdmin
                    ? "No audit events recorded in this workspace yet."
                    : "Your account operates under least-privilege SOC Analyst isolation."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono font-medium text-foreground">
                          {log.action}
                        </p>
                        <p className="truncate text-muted-foreground">
                          {log.actor_email ?? "system"} ·{" "}
                          {log.ip_address ?? "internal"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            log.severity === "critical"
                              ? "destructive"
                              : log.severity === "warning"
                              ? "warning"
                              : "secondary"
                          }
                          className="font-mono text-[10px]"
                        >
                          {log.severity}
                        </Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </SpotlightCard>
        </Reveal>
      </div>
    </div>
  );
}
