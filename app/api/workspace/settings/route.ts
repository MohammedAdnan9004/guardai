import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkWorkspaceRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { updateWorkspaceSettingsSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { getSessionContext } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.effectiveRole !== "tenant_admin" &&
    session.effectiveRole !== "super_admin"
  ) {
    return NextResponse.json(
      { error: "Forbidden: Only Tenant Admins can modify workspace settings." },
      { status: 403 }
    );
  }

  if (!session.workspace) {
    return NextResponse.json(
      { error: "No active workspace found for this account." },
      { status: 404 }
    );
  }

  const wsLimit = await checkWorkspaceRateLimit(
    session.workspace.id,
    "workspace:settings",
    30,
    60
  );
  if (!wsLimit.allowed) {
    return NextResponse.json(
      { error: "Workspace API rate limit reached. Try again shortly." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = updateWorkspaceSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid workspace settings payload.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 503 }
    );
  }

  const { name, alertThreshold, retentionDays, autoQuarantine, realtimeRagEnabled } =
    parsed.data;

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update({
      name,
      soc_settings: {
        alert_threshold: alertThreshold,
        retention_days: retentionDays,
        auto_quarantine: autoQuarantine,
        realtime_rag_enabled: realtimeRagEnabled,
      },
    })
    .eq("id", session.workspace.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAuditEvent({
    workspaceId: session.workspace.id,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "workspace.settings.updated",
    targetType: "workspace",
    targetId: session.workspace.id,
    severity: "info",
    metadata: { name, alertThreshold, retentionDays },
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, workspace: updated });
}
