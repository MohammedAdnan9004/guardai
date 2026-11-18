import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { extractClientIp } from "@/lib/security/sanitize";
import { superAdminUserActionSchema } from "@/lib/security/validation";
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

  const parsed = superAdminUserActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user governance request." },
      { status: 400 }
    );
  }

  const { userId, action, reason } = parsed.data;
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Super Admin cannot suspend, ban, or delete their own account." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for Super Admin user actions." },
      { status: 503 }
    );
  }

  const ip = extractClientIp(request.headers);

  if (action === "force_logout") {
    const { error } = await admin.auth.admin.signOut(userId, "global");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await recordAuditEvent({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "super_admin.user.force_logout",
      targetType: "user",
      targetId: userId,
      severity: "warning",
      metadata: { reason },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, message: "User session terminated globally." });
  }

  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await recordAuditEvent({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "super_admin.user.deleted",
      targetType: "user",
      targetId: userId,
      severity: "critical",
      metadata: { reason },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, message: "User account permanently deleted." });
  }

  const nextStatus =
    action === "activate"
      ? "active"
      : action === "suspend"
      ? "suspended"
      : "banned";

  const { error } = await admin
    .from("profiles")
    .update({ status: nextStatus })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (nextStatus !== "active") {
    await admin.auth.admin.signOut(userId, "global");
  }

  await recordAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: `super_admin.user.${action}`,
    targetType: "user",
    targetId: userId,
    severity: nextStatus === "active" ? "info" : "critical",
    metadata: { reason, status: nextStatus },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
