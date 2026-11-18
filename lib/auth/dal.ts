import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { resolveOrProvisionIdentity } from "@/lib/auth/provisioning";
import {
  getHomeRouteForRole,
  resolveEffectiveRole,
} from "@/lib/auth/rbac";
import type {
  EffectiveRole,
  GlobalRole,
  GuardSessionContext,
  UserProfile,
  Workspace,
  WorkspaceRole,
} from "@/lib/auth/types";

/**
 * Server-side Data Access Layer (DAL)
 * Authoritatively verifies the active Supabase Auth user, extracts JWT custom claims,
 * and resolves profile + tenant membership + workspace directly under PostgreSQL RLS.
 */
export const getSessionContext = cache(
  async (): Promise<GuardSessionContext | null> => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: claimsData } = await supabase.auth.getClaims();
    const rawClaims = (claimsData?.claims ?? {}) as Record<string, unknown>;

    // Fetch profile under authenticated session RLS
    let { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Fallback safety: if service role is present and public rows are missing
    // (e.g., manual table reset while auth.users persisted), self-heal identity.
    if (!profileData) {
      await resolveOrProvisionIdentity(user, supabase);
      const admin = createSupabaseAdminClient();
      const lookupClient = admin ?? supabase;
      const { data: healedProfile } = await lookupClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profileData = healedProfile;
    }

    if (!profileData) {
      return null;
    }

    const profile = profileData as UserProfile;

    // Fetch workspace membership
    const { data: membershipData } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspace_role, joined_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let workspace: Workspace | null = null;
    const workspaceId =
      (membershipData?.workspace_id as string | undefined) ??
      (typeof rawClaims.workspace_id === "string"
        ? rawClaims.workspace_id
        : null);

    if (workspaceId) {
      const { data: workspaceData } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();
      workspace = (workspaceData as Workspace | null) ?? null;
    }

    const workspaceRole =
      (membershipData?.workspace_role as WorkspaceRole | undefined) ??
      (rawClaims.workspace_role === "tenant_admin" ||
      rawClaims.workspace_role === "member"
        ? (rawClaims.workspace_role as WorkspaceRole)
        : null);

    const globalRole: GlobalRole =
      profile.global_role === "super_admin" ? "super_admin" : "user";

    const effectiveRole: EffectiveRole = resolveEffectiveRole(
      globalRole,
      workspaceRole
    );

    return {
      user: {
        id: user.id,
        email: user.email ?? profile.email,
      },
      profile,
      workspace,
      workspaceRole,
      effectiveRole,
      claims: {
        workspace_id: workspaceId,
        workspace_role: workspaceRole,
        global_role: globalRole,
        account_status: profile.status,
      },
    };
  }
);

export async function verifySession(): Promise<GuardSessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/login?error=session_expired");
  }

  if (session.profile.status === "banned" || session.profile.status === "suspended") {
    redirect(`/forbidden?reason=${session.profile.status}`);
  }

  if (
    session.effectiveRole !== "super_admin" &&
    session.workspace?.subscription_status === "suspended"
  ) {
    redirect("/forbidden?reason=workspace_suspended");
  }

  return session;
}

export async function requireWorkspaceAccess(
  allowedRoles: EffectiveRole[] = ["tenant_admin", "member", "super_admin"]
): Promise<GuardSessionContext> {
  const session = await verifySession();

  if (
    session.effectiveRole === "super_admin" &&
    !allowedRoles.includes("super_admin")
  ) {
    redirect("/super-admin");
  }

  if (!allowedRoles.includes(session.effectiveRole)) {
    redirect("/forbidden");
  }

  return session;
}

export async function requireTenantAdmin(): Promise<GuardSessionContext> {
  const session = await verifySession();
  if (session.effectiveRole !== "tenant_admin" && session.effectiveRole !== "super_admin") {
    redirect("/forbidden");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<GuardSessionContext> {
  const session = await verifySession();
  if (session.effectiveRole !== "super_admin") {
    redirect(getHomeRouteForRole(session.effectiveRole) === "/dashboard" ? "/forbidden" : "/login");
  }
  return session;
}
