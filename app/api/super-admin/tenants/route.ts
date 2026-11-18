import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { extractClientIp } from "@/lib/security/sanitize";
import { superAdminTenantActionSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { getSessionContext } from "@/lib/auth/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.effectiveRole !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: Super Admin access required." },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = superAdminTenantActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tenant governance request." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for Super Admin mutations." },
      { status: 503 }
    );
  }

  const { workspaceId, action, reason } = parsed.data;
  const nextStatus = action === "activate" ? "active" : "suspended";

  const { data: updated, error } = await admin
    .from("workspaces")
    .update({ subscription_status: nextStatus })
    .eq("id", workspaceId)
    .select("id, name, subscription_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAuditEvent({
    workspaceId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: `super_admin.tenant.${action}`,
    targetType: "workspace",
    targetId: workspaceId,
    severity: action === "activate" ? "info" : "critical",
    metadata: { reason, workspace_name: updated.name },
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, workspace: updated });
}
