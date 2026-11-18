"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { logFileIntegritySchema } from "@/lib/security/validation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export function LogsBaselineView({ workspaceName }: { workspaceName: string }) {
  const [checkResult, setCheckResult] = React.useState<{
    ok: boolean;
    filename: string;
    message: string;
  } | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const slice = await file.slice(0, 2048).text();
    const parsed = logFileIntegritySchema.safeParse({
      filename: file.name,
      sizeBytes: file.size,
      sampleHeader: slice,
    });

    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      setCheckResult({
        ok: false,
        filename: file.name,
        message:
          errs.filename?.[0] ??
          errs.sizeBytes?.[0] ??
          errs.sampleHeader?.[0] ??
          "Log integrity validation failed.",
      });
      return;
    }

    setCheckResult({
      ok: true,
      filename: file.name,
      message: `Passed Zod + RegEx integrity check (${(file.size / 1024).toFixed(
        1
      )} KB). Ready for Phase 2 RAG stream ingestion.`,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
          SOC ANALYST & ADMIN • LOG INGESTION BASELINE
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Security Log Integrity Pre-Check
        </h1>
        <p className="text-sm text-muted-foreground">
          Every log payload uploaded to{" "}
          <span className="font-medium text-foreground">{workspaceName}</span>{" "}
          undergoes filename RegEx, extension allowlist, and XSS/binary
          sanitization checks.
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-4 w-4 text-primary" />
            <span>Validate Log Payload Integrity</span>
          </CardTitle>
          <CardDescription>
            Allowed formats: <code className="font-mono">.json</code>,{" "}
            <code className="font-mono">.jsonl</code>,{" "}
            <code className="font-mono">.log</code>,{" "}
            <code className="font-mono">.csv</code>,{" "}
            <code className="font-mono">.syslog</code>,{" "}
            <code className="font-mono">.txt</code> (max 50MB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/50 p-10 text-center transition-colors hover:border-primary/50 hover:bg-accent/30">
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Click to test a security log file against GuardAI Zod rules
            </span>
            <span className="text-xs text-muted-foreground">
              Client-side integrity preview • Zero server upload in Phase 1
            </span>
            <input
              type="file"
              className="sr-only"
              onChange={(e) => void handleFileSelect(e)}
            />
          </label>

          {checkResult && (
            <Alert variant={checkResult.ok ? "success" : "destructive"}>
              {checkResult.ok ? (
                <FileCheck2 className="h-4 w-4 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0" />
              )}
              <div className="text-xs">
                <p className="font-mono font-semibold">{checkResult.filename}</p>
                <p>{checkResult.message}</p>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ThreatsBaselineView({
  workspaceName,
  alertThreshold,
}: {
  workspaceName: string;
  alertThreshold: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
          SOC ANALYST & ADMIN • THREAT INTELLIGENCE
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI Threat Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Tenant-isolated threat correlation view for{" "}
          <span className="font-medium text-foreground">{workspaceName}</span>{" "}
          (Alert Threshold: <span className="font-mono uppercase">{alertThreshold}</span>).
        </p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            <span>Autonomous RAG Engine Status</span>
          </CardTitle>
          <CardDescription>
            Phase 1 Authentication, Multi-Tenancy, and RLS Isolation verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-3.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>
              Threat reports generated in Phase 2 will automatically filter by{" "}
              <code className="font-mono text-foreground">
                workspace_id = public.current_workspace_id()
              </code>
              .
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
