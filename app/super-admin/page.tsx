import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { SuperAdminView } from "@/components/super-admin/super-admin-view";
import type { AuditLogRecord, UserProfile, Workspace } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Super Admin Command Center",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await requireSuperAdmin();

  const admin = createSupabaseAdminClient();
  const db = admin ?? (await createSupabaseServerClient());

  let tenants: Workspace[] = [];
  let users: UserProfile[] = [];
  let auditLogs: AuditLogRecord[] = [];

  if (db) {
    const [{ data: wsData }, { data: profileData }, { data: logData }] =
      await Promise.all([
        db
          .from("workspaces")
          .select("*")
          .order("created_at", { ascending: false }),
        db
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        db
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

    tenants = (wsData as Workspace[] | null) ?? [];
    users = (profileData as UserProfile[] | null) ?? [];
    auditLogs = (logData as AuditLogRecord[] | null) ?? [];
  }

  return (
    <SuperAdminView
      currentUserId={session.user.id}
      tenants={tenants}
      users={users}
      auditLogs={auditLogs}
    />
  );
}
