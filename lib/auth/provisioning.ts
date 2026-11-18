import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AccountStatus, GlobalRole, WorkspaceRole } from "@/lib/auth/types";

export interface ProvisionedIdentity {
  profile: {
    id: string;
    global_role: GlobalRole;
    status: AccountStatus;
  } | null;
  membership: {
    workspace_id: string;
    workspace_role: WorkspaceRole;
  } | null;
}

function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base.length >= 2 ? base : "soc-workspace"}-${rand}`;
}

/**
 * Resolves a verified auth user's profile and primary workspace membership,
 * self-healing public tables if they were manually cleared while auth.users persisted.
 */
export async function resolveOrProvisionIdentity(
  user: User,
  fallbackClient: SupabaseClient
): Promise<ProvisionedIdentity> {
  const admin = createSupabaseAdminClient();
  const dbClient = admin ?? fallbackClient;

  let [{ data: profile }, { data: membership }] = await Promise.all([
    dbClient
      .from("profiles")
      .select("id, global_role, status")
      .eq("id", user.id)
      .maybeSingle(),
    dbClient
      .from("workspace_members")
      .select("workspace_id, workspace_role")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (admin && (!profile || !membership)) {
    const email = (user.email ?? "").toLowerCase();
    const fullName =
      String(
        user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          email.split("@")[0] ??
          "SOC Operator"
      ).trim() || "SOC Operator";

    if (!profile && email) {
      const { data: healedProfile } = await admin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email,
            full_name: fullName,
            avatar_url:
              typeof user.user_metadata?.avatar_url === "string"
                ? user.user_metadata.avatar_url
                : null,
            global_role: "user",
            status: "active",
          },
          { onConflict: "id" }
        )
        .select("id, global_role, status")
        .single();
      profile = healedProfile;
    }

    if (!membership && profile) {
      const wsName =
        String(user.user_metadata?.workspace_name ?? "").trim() ||
        `${fullName}'s SOC Workspace`;

      const { data: ws } = await admin
        .from("workspaces")
        .insert({
          name: wsName.slice(0, 80),
          slug: slugifyWorkspaceName(wsName),
          owner_id: user.id,
          plan: "free",
          subscription_status: "active",
        })
        .select("id")
        .single();

      if (ws?.id) {
        const { data: healedMember } = await admin
          .from("workspace_members")
          .insert({
            workspace_id: ws.id,
            user_id: user.id,
            workspace_role: "tenant_admin",
            invited_by: user.id,
          })
          .select("workspace_id, workspace_role")
          .single();
        membership = healedMember;
      }
    }
  }

  return {
    profile: profile as ProvisionedIdentity["profile"],
    membership: membership as ProvisionedIdentity["membership"],
  };
}
