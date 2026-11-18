import type { Metadata } from "next";
import { requireWorkspaceAccess } from "@/lib/auth/dal";
import { LogsBaselineView } from "@/components/dashboard/logs-threats-views";

export const metadata: Metadata = {
  title: "Log Ingestion Baseline",
};

export const dynamic = "force-dynamic";

export default async function DashboardLogsPage() {
  const session = await requireWorkspaceAccess([
    "tenant_admin",
    "member",
    "super_admin",
  ]);

  return (
    <LogsBaselineView
      workspaceName={session.workspace?.name ?? "GuardAI Workspace"}
    />
  );
}
