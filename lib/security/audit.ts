import "server-only";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export interface RecordAuditInput {
  workspaceId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Records a tamper-evident security audit log entry using the Service Role client
 * (falling back to authenticated server client when appropriate).
 * Never throws so auth/security flows remain resilient.
 */
export async function recordAuditEvent(input: RecordAuditInput): Promise<void> {
  try {
    const client =
      createSupabaseAdminClient() ?? (await createSupabaseServerClient());
    if (!client) return;

    await client.from("audit_logs").insert({
      workspace_id: input.workspaceId ?? null,
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      severity: input.severity ?? "info",
      metadata: input.metadata ?? {},
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent?.slice(0, 250) ?? null,
    });
  } catch {
    // Non-blocking audit logging: never expose internal DB log failures to user auth paths
  }
}
