import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenantAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/dashboard/team-view";
import type {
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
} from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Team & RBAC Management",
};

export const dynamic = "force-dynamic";

export default async function DashboardTeamPage() {
  const session = await requireTenantAdmin();
  if (!session.workspace) {
    redirect("/dashboard");
  }

  let members: WorkspaceMemberRecord[] = [];
  let invitations: WorkspaceInvitationRecord[] = [];

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select(
          "id, workspace_id, user_id, workspace_role, joined_at, profile:profiles(id, email, full_name, status, mfa_enabled, last_login_at)"
        )
        .eq("workspace_id", session.workspace.id)
        .order("joined_at", { ascending: true }),
      supabase
        .from("workspace_invitations")
        .select("id, workspace_id, email, role, status, expires_at, created_at")
        .eq("workspace_id", session.workspace.id)
        .order("created_at", { ascending: false }),
    ]);

    members = (memberRows as unknown as WorkspaceMemberRecord[] | null) ?? [];
    invitations = (inviteRows as WorkspaceInvitationRecord[] | null) ?? [];
  }

  return (
    <TeamView
      workspace={session.workspace}
      currentUserId={session.user.id}
      initialMembers={members}
      initialInvitations={invitations}
    />
  );
}
