import type { Metadata } from "next";
import { requireWorkspaceAccess } from "@/lib/auth/dal";
import { ThreatsBaselineView } from "@/components/dashboard/logs-threats-views";

export const metadata: Metadata = {
  title: "AI Threat Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardThreatsPage() {
  const session = await requireWorkspaceAccess([
    "tenant_admin",
    "member",
    "super_admin",
  ]);

  return (
    <ThreatsBaselineView
      workspaceName={session.workspace?.name ?? "GuardAI Workspace"}
      alertThreshold={session.workspace?.soc_settings?.alert_threshold ?? "high"}
    />
  );
}
