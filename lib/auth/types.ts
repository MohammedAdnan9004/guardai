export type GlobalRole = "super_admin" | "user";
export type WorkspaceRole = "tenant_admin" | "member";
export type EffectiveRole = "super_admin" | WorkspaceRole;
export type AccountStatus = "active" | "suspended" | "banned";
export type WorkspacePlan = "free" | "pro";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "suspended";

export interface SocSettings {
  auto_quarantine: boolean;
  retention_days: number;
  alert_threshold: "low" | "medium" | "high" | "critical";
  realtime_rag_enabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  global_role: GlobalRole;
  status: AccountStatus;
  avatar_url: string | null;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: WorkspacePlan;
  subscription_status: SubscriptionStatus;
  seat_limit: number;
  soc_settings: SocSettings;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  workspace_role: WorkspaceRole;
  joined_at: string;
  profile?: Pick<UserProfile, "id" | "email" | "full_name" | "status" | "mfa_enabled" | "last_login_at">;
}

export interface WorkspaceInvitationRecord {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  workspace_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface JwtClaimsContext {
  workspace_id: string | null;
  workspace_role: WorkspaceRole | null;
  global_role: GlobalRole;
  account_status: AccountStatus;
}

export interface GuardSessionContext {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
  workspace: Workspace | null;
  workspaceRole: WorkspaceRole | null;
  effectiveRole: EffectiveRole;
  claims: JwtClaimsContext;
}
