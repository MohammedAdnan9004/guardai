import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkIpRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import {
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/security/validation";
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

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "profile:update", 15, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many profile requests. Please wait shortly." },
      { status: 429 }
    );
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 503 }
    );
  }

  if (rawBody.intent === "password") {
    const parsedPw = changePasswordSchema.safeParse(rawBody);
    if (!parsedPw.success) {
      return NextResponse.json(
        {
          error: "Password update validation failed.",
          fieldErrors: parsedPw.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Re-authenticate current password before allowing password change
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: parsedPw.data.currentPassword,
    });

    if (verifyErr) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: parsedPw.data.newPassword,
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    await recordAuditEvent({
      workspaceId: session.workspace?.id ?? null,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "profile.password_changed",
      targetType: "user",
      targetId: session.user.id,
      severity: "info",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully.",
    });
  }

  const parsedProfile = updateProfileSchema.safeParse(rawBody);
  if (!parsedProfile.success) {
    return NextResponse.json(
      {
        error: "Invalid profile fields.",
        fieldErrors: parsedProfile.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsedProfile.data.fullName })
    .eq("id", session.user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await supabase.auth.updateUser({
    data: { full_name: parsedProfile.data.fullName },
  });

  await recordAuditEvent({
    workspaceId: session.workspace?.id ?? null,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "profile.updated",
    targetType: "profile",
    targetId: session.user.id,
    severity: "info",
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    fullName: parsedProfile.data.fullName,
    message: "Profile updated successfully.",
  });
}
