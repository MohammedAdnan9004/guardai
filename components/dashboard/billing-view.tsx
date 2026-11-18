"use client";

import { CheckCircle2, CreditCard, Sparkles, Users } from "lucide-react";
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
import { Alert } from "@/components/ui/alert";
import type { Workspace } from "@/lib/auth/types";

interface BillingViewProps {
  workspace: Workspace;
  memberCount: number;
}

export function BillingView({ workspace, memberCount }: BillingViewProps) {
  const isPro = workspace.plan === "pro";

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
          TENANT ADMIN ONLY • SUBSCRIPTIONS
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Billing & Subscription Lifecycle
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage plan tiers and team seat allocations for{" "}
          <span className="font-medium text-foreground">{workspace.name}</span>.
          Strictly inaccessible to standard SOC Analyst members.
        </p>
      </div>

      <Alert variant="info" className="text-xs">
        <CreditCard className="h-4 w-4 shrink-0" />
        <span>
          Phase 1 Baseline: Tenant plan status is tracked securely in{" "}
          <code className="font-mono">public.workspaces</code> with database
          triggers preventing client-side plan escalation. Stripe Sandbox
          checkout hooks activate in the Billing Phase.
        </span>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Reveal>
          <SpotlightCard
            className={`h-full p-0 ${
              !isPro ? "border-primary/50 shadow-lg" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Free SOC Starter</CardTitle>
                {!isPro && <Badge variant="success">ACTIVE PLAN</Badge>}
              </div>
              <CardDescription>
                Zero-trust RBAC &amp; multi-tenant security baseline for small teams.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold font-mono">
                $0{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / month
                </span>
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Up to {workspace.seat_limit} workspace analyst seats ({memberCount} used)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  30-day audit log &amp; telemetry retention
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Strict PostgreSQL RLS + Redis Brute-Force Shield
                </li>
              </ul>
            </CardContent>
          </SpotlightCard>
        </Reveal>

        <Reveal index={1}>
          <SpotlightCard
            className={`h-full p-0 ${
              isPro ? "border-primary/50 shadow-lg" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Enterprise Pro SOC</span>
                </CardTitle>
                {isPro ? (
                  <Badge variant="success">ACTIVE PLAN</Badge>
                ) : (
                  <Badge variant="cyber">PHASE 2 BILLING</Badge>
                )}
              </div>
              <CardDescription>
                Expanded seat allocations &amp; extended audit retention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold font-mono">
                $199{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / workspace / mo
                </span>
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  25+ SOC Analyst seats &amp; priority processing
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  365-day immutable compliance audit retention
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Database-enforced billing triggers active
                </li>
              </ul>
              <Button
                type="button"
                variant="outline"
                disabled
                className="w-full rounded-xl"
              >
                {isPro
                  ? "Current Enterprise Plan"
                  : "Stripe Checkout Activates in Billing Phase"}
              </Button>
            </CardContent>
          </SpotlightCard>
        </Reveal>
      </div>
    </div>
  );
}
