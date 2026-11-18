import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkWorkspaceRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import {
  inviteMemberSchema,
  REGEX,
  updateMemberRoleSchema,
} from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { getSessionContext } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    session.effectiveRole !== "tenant_admin" &&
    session.effectiveRole !== "super_admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.workspace) {
    return NextResponse.json({ members: [], invitations: [] });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 503 }
    );
  }

  const [{ data: members }, { data: invitations }] = await Promise.all([
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

  return NextResponse.json({
    members: members ?? [],
    invitations: invitations ?? [],
  });
}

export async function POST(request: NextRequest) {
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
      { error: "Forbidden: Only Tenant Admins can invite SOC analysts." },
      { status: 403 }
    );
  }
  if (!session.workspace) {
    return NextResponse.json({ error: "Workspace missing." }, { status: 404 });
  }

  const wsLimit = await checkWorkspaceRateLimit(
    session.workspace.id,
    "workspace:invite",
    20,
    60
  );
  if (!wsLimit.allowed) {
    return NextResponse.json(
      { error: "Invite rate limit exceeded. Please wait before sending more." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = inviteMemberSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid invitation payload.",
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

  // Enforce workspace seat allocation (Super Admin exempted)
  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspace.id),
    supabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspace.id)
      .eq("status", "pending"),
  ]);

  const usedSeats = (memberCount ?? 0) + (pendingCount ?? 0);
  if (
    session.effectiveRole !== "super_admin" &&
    usedSeats >= session.workspace.seat_limit
  ) {
    return NextResponse.json(
      {
        error: `Workspace seat limit (${session.workspace.seat_limit}) reached on ${session.workspace.plan.toUpperCase()} plan.`,
      },
      { status: 403 }
    );
  }

  const { email, role } = parsed.data;
  const { data: invite, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: session.workspace.id,
      email,
      role,
      invited_by: session.user.id,
      status: "pending",
    })
    .select("id, workspace_id, email, role, status, expires_at, created_at, token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAuditEvent({
    workspaceId: session.workspace.id,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "member.invited",
    targetType: "workspace_invitation",
    targetId: invite.id,
    severity: "info",
    metadata: { invited_email: email, role },
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, invitation: invite }, { status: 201 });
}

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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.workspace) {
    return NextResponse.json({ error: "Workspace missing." }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = updateMemberRoleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid member role update request." },
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

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("id, user_id, workspace_role")
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (targetMember.user_id === session.workspace.owner_id) {
    return NextResponse.json(
      { error: "Workspace owner role cannot be downgraded." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ workspace_role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("workspace_id", session.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAuditEvent({
    workspaceId: session.workspace.id,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "member.role_updated",
    targetType: "workspace_member",
    targetId: parsed.data.memberId,
    severity: "info",
    metadata: { new_role: parsed.data.role },
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.workspace) {
    return NextResponse.json({ error: "Workspace missing." }, { status: 404 });
  }

  const id = request.nextUrl.searchParams.get("id");
  const kind = request.nextUrl.searchParams.get("kind") ?? "member";
  if (!id || !REGEX.uuid.test(id)) {
    return NextResponse.json({ error: "Invalid identifier." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 503 }
    );
  }

  if (kind === "invitation") {
    const { error } = await supabase
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("workspace_id", session.workspace.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recordAuditEvent({
      workspaceId: session.workspace.id,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "member.invitation_revoked",
      targetType: "workspace_invitation",
      targetId: id,
      severity: "warning",
      ipAddress: extractClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  }

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("id, user_id")
    .eq("id", id)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (targetMember.user_id === session.workspace.owner_id) {
    return NextResponse.json(
      { error: "Workspace owner cannot be removed." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", id)
    .eq("workspace_id", session.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAuditEvent({
    workspaceId: session.workspace.id,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "member.removed",
    targetType: "workspace_member",
    targetId: id,
    severity: "warning",
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
