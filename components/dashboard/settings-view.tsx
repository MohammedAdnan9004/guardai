"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { updateWorkspaceSettingsSchema } from "@/lib/security/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Workspace } from "@/lib/auth/types";

interface SettingsViewProps {
  workspace: Workspace;
}

export function SettingsView({ workspace }: SettingsViewProps) {
  const router = useRouter();
  const [name, setName] = React.useState(workspace.name);
  const [alertThreshold, setAlertThreshold] = React.useState(
    workspace.soc_settings?.alert_threshold ?? "high"
  );
  const [retentionDays, setRetentionDays] = React.useState(
    workspace.soc_settings?.retention_days ?? 30
  );
  const [autoQuarantine, setAutoQuarantine] = React.useState(
    workspace.soc_settings?.auto_quarantine ?? false
  );
  const [realtimeRagEnabled, setRealtimeRagEnabled] = React.useState(
    workspace.soc_settings?.realtime_rag_enabled ?? true
  );
  const [saving, setSaving] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = updateWorkspaceSettingsSchema.safeParse({
      name,
      alertThreshold,
      retentionDays: Number(retentionDays),
      autoQuarantine,
      realtimeRagEnabled,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.flatten().fieldErrors.name?.[0] ??
          "Invalid workspace settings."
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Unable to save workspace settings.");
        return;
      }

      toast.success("Workspace & SOC rule configuration saved.");
      router.refresh();
    } catch {
      toast.error("Network error while updating settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
          TENANT ADMIN ONLY • WORKSPACE CONFIG
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Workspace Settings & SOC Rules
        </h1>
        <p className="text-sm text-muted-foreground">
          Rename your tenant workspace and govern autonomous SOC response
          thresholds.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="glass-panel lg:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              <span>Tenant Configuration</span>
            </CardTitle>
            <CardDescription>
              Protected by Zod schema validation and PostgreSQL{" "}
              <code className="font-mono">is_tenant_admin()</code> RLS policy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ws-name">Workspace Name</Label>
                  <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-slug">Tenant Slug (Immutable)</Label>
                  <Input
                    id="ws-slug"
                    value={workspace.slug}
                    disabled
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="alert-threshold">SOC Alert Threshold</Label>
                  <select
                    id="alert-threshold"
                    value={alertThreshold}
                    onChange={(e) =>
                      setAlertThreshold(
                        e.target.value as "low" | "medium" | "high" | "critical"
                      )
                    }
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="low">Low (All Anomalies)</option>
                    <option value="medium">Medium (Suspicious Patterns)</option>
                    <option value="high">High (Confirmed Indicators)</option>
                    <option value="critical">Critical Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="retention-days">Log Retention (Days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    min={7}
                    max={365}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Autonomous Quarantine Proposals
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Automatically generate remediation playbooks on critical
                      alerts.
                    </p>
                  </div>
                  <Switch
                    checked={autoQuarantine}
                    onCheckedChange={setAutoQuarantine}
                    aria-label="Toggle autonomous quarantine proposals"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Real-Time RAG Stream Indexing
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Correlate incoming security logs against vector threat
                      context.
                    </p>
                  </div>
                  <Switch
                    checked={realtimeRagEnabled}
                    onCheckedChange={setRealtimeRagEnabled}
                    aria-label="Toggle real-time RAG indexing"
                  />
                </div>
              </div>

              <Button type="submit" variant="cyber" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Workspace Settings</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-panel lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Ingestion API Scope</span>
            </CardTitle>
            <CardDescription>
              Workspace-scoped log collector identifier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="rounded-xl border border-border bg-background/70 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Workspace ID
              </p>
              <p className="mt-1 break-all font-mono text-foreground">
                {workspace.id}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-3">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Collector Key Prefix
              </p>
              <p className="mt-1 font-mono text-foreground">
                gai_live_{workspace.id.slice(0, 8)}••••••••••••••••
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
