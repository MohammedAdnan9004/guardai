import type { Metadata } from "next";
import { requireWorkspaceAccess } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OverviewView } from "@/components/dashboard/overview-view";
import type { AuditLogRecord } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "SOC Workspace Overview",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireWorkspaceAccess([
    "tenant_admin",
    "member",
    "super_admin",
  ]);

  let memberCount = 1;
  let auditLogs: AuditLogRecord[] = [];

  const supabase = await createSupabaseServerClient();
  if (supabase && session.workspace) {
    const [{ count }, { data: logs }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", session.workspace.id),
      session.effectiveRole === "tenant_admin"
        ? supabase
            .from("audit_logs")
            .select("*")
            .eq("workspace_id", session.workspace.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);
    memberCount = count ?? 1;
    auditLogs = (logs as AuditLogRecord[] | null) ?? [];
  }

  return (
    <OverviewView
      session={session}
      memberCount={memberCount}
      auditLogs={auditLogs}
    />
  );
}
