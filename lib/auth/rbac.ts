import type { EffectiveRole, GlobalRole, WorkspaceRole } from "./types";

/**
 * GuardAI 3-Tier Multi-Tenant RBAC Engine
 * Centralizes role resolution, post-auth routing, and strict route permissions.
 */

export const TENANT_ADMIN_ONLY_PATHS = [
  "/dashboard/billing",
  "/dashboard/team",
  "/dashboard/settings",
] as const;

export const SUPER_ADMIN_BASE_PATH = "/super-admin";
export const WORKSPACE_BASE_PATH = "/dashboard";

export function resolveEffectiveRole(
  globalRole: GlobalRole | null | undefined,
  workspaceRole: WorkspaceRole | null | undefined
): EffectiveRole {
  if (globalRole === "super_admin") {
    return "super_admin";
  }
  return workspaceRole === "tenant_admin" ? "tenant_admin" : "member";
}

export function getHomeRouteForRole(role: EffectiveRole): string {
  return role === "super_admin" ? SUPER_ADMIN_BASE_PATH : WORKSPACE_BASE_PATH;
}

export function isTenantAdminOnlyPath(pathname: string): boolean {
  return TENANT_ADMIN_ONLY_PATHS.some(
    (restricted) => pathname === restricted || pathname.startsWith(`${restricted}/`)
  );
}

export function canAccessRoute(
  pathname: string,
  role: EffectiveRole
): boolean {
  if (pathname.startsWith(SUPER_ADMIN_BASE_PATH)) {
    return role === "super_admin";
  }

  if (pathname.startsWith(WORKSPACE_BASE_PATH)) {
    if (isTenantAdminOnlyPath(pathname)) {
      return role === "tenant_admin" || role === "super_admin";
    }
    return true;
  }

  return true;
}

export interface PermissionMatrix {
  canViewGlobalAnalytics: boolean;
  canManageAllTenants: boolean;
  canManageGlobalUsers: boolean;
  canManageBilling: boolean;
  canManageTeam: boolean;
  canManageWorkspaceSettings: boolean;
  canUploadLogs: boolean;
  canViewThreatReports: boolean;
  canManageOwnProfile: boolean;
}

export function getPermissionsForRole(role: EffectiveRole): PermissionMatrix {
  if (role === "super_admin") {
    return {
      canViewGlobalAnalytics: true,
      canManageAllTenants: true,
      canManageGlobalUsers: true,
      canManageBilling: true,
      canManageTeam: true,
      canManageWorkspaceSettings: true,
      canUploadLogs: true,
      canViewThreatReports: true,
      canManageOwnProfile: true,
    };
  }

  if (role === "tenant_admin") {
    return {
      canViewGlobalAnalytics: false,
      canManageAllTenants: false,
      canManageGlobalUsers: false,
      canManageBilling: true,
      canManageTeam: true,
      canManageWorkspaceSettings: true,
      canUploadLogs: true,
      canViewThreatReports: true,
      canManageOwnProfile: true,
    };
  }

  return {
    canViewGlobalAnalytics: false,
    canManageAllTenants: false,
    canManageGlobalUsers: false,
    canManageBilling: false,
    canManageTeam: false,
    canManageWorkspaceSettings: false,
    canUploadLogs: true,
    canViewThreatReports: true,
    canManageOwnProfile: true,
  };
}
