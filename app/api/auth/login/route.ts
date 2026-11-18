import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import {
  checkIpRateLimit,
  checkLoginBruteForce,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { loginSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { resolveOrProvisionIdentity } from "@/lib/auth/provisioning";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";
import { getHomeRouteForRole, resolveEffectiveRole } from "@/lib/auth/rbac";
import type { GlobalRole, WorkspaceRole } from "@/lib/auth/types";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:login", 25, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login requests from this IP. Retry in ${ipLimit.retryAfterSeconds}s.`,
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please enter a valid work email and password.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email, password, rememberMe } = parsed.data;

  // Enforce Redis brute-force protection BEFORE contacting auth provider
  const bruteForceStatus = await checkLoginBruteForce(email, ip);
  if (bruteForceStatus.locked) {
    const minutes = Math.ceil(bruteForceStatus.retryAfterSeconds / 60);
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.login.blocked_bruteforce",
      severity: "critical",
      metadata: { retry_after_seconds: bruteForceStatus.retryAfterSeconds },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error: `Account temporarily locked after 5 failed attempts. Try again in ${minutes} minute(s).`,
        locked: true,
        retryAfterSeconds: bruteForceStatus.retryAfterSeconds,
        remainingAttempts: 0,
      },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are not configured. Copy .env.example to .env.local and add your Supabase project URL & keys.",
      },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user || !data.session) {
    const failureState = await recordFailedLoginAttempt(email, ip);
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.login.failed",
      severity: failureState.locked ? "critical" : "warning",
      metadata: {
        attempts: failureState.attempts,
        locked: failureState.locked,
        reason: error?.message ?? "invalid_credentials",
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    if (failureState.locked) {
      return NextResponse.json(
        {
          error:
            "Maximum failed attempts reached (5/5). Account locked for 15 minutes for security protection.",
          locked: true,
          retryAfterSeconds: failureState.retryAfterSeconds,
          remainingAttempts: 0,
        },
        { status: 429 }
      );
    }

    const isEmailNotConfirmed = error?.message
      ?.toLowerCase()
      .includes("email not confirmed");

    return NextResponse.json(
      {
        error: isEmailNotConfirmed
          ? "Your work email is not verified yet. Check your inbox for the confirmation link."
          : `Invalid email or password. ${failureState.remainingAttempts} attempt(s) remaining before 15-minute lockout.`,
        remainingAttempts: failureState.remainingAttempts,
        locked: false,
      },
      { status: 401 }
    );
  }

  // Successful credential validation -> clear Redis failure counters
  await clearFailedLoginAttempts(email, ip);

  // Resolve RBAC profile & workspace role (self-healing if public tables were cleared)
  const admin = createSupabaseAdminClient();
  const dbClient = admin ?? supabase;
  const { profile, membership } = await resolveOrProvisionIdentity(
    data.user,
    supabase
  );

  if (profile?.status === "banned" || profile?.status === "suspended") {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actorId: data.user.id,
      actorEmail: email,
      action: "auth.login.denied_account_status",
      severity: "critical",
      metadata: { status: profile.status },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error: `This account has been ${profile.status} by a platform administrator.`,
      },
      { status: 403 }
    );
  }

  const globalRole: GlobalRole =
    profile?.global_role === "super_admin" ? "super_admin" : "user";
  const workspaceRole: WorkspaceRole | null =
    membership?.workspace_role === "tenant_admin" ||
    membership?.workspace_role === "member"
      ? (membership.workspace_role as WorkspaceRole)
      : null;

  if (globalRole !== "super_admin" && membership?.workspace_id) {
    const { data: ws } = await dbClient
      .from("workspaces")
      .select("subscription_status")
      .eq("id", membership.workspace_id)
      .maybeSingle();

    if (ws?.subscription_status === "suspended") {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error:
            "Your organization workspace is currently suspended. Contact GuardAI support.",
        },
        { status: 403 }
      );
    }
  }

  // Update last_login_at
  await dbClient
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  const effectiveRole = resolveEffectiveRole(globalRole, workspaceRole);
  const redirectTo = getHomeRouteForRole(effectiveRole);

  await recordAuditEvent({
    workspaceId: membership?.workspace_id ?? null,
    actorId: data.user.id,
    actorEmail: email,
    action: "auth.login.success",
    targetType: "session",
    targetId: data.user.id,
    severity: "info",
    metadata: { effective_role: effectiveRole, remember_me: rememberMe },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    ok: true,
    redirectTo,
    role: effectiveRole,
  });

  const persistentOpts = rememberMe
    ? { maxAge: 60 * 60 * 24 * 30 }
    : {};

  // Set explicit HTTP-only cookies for strict session termination & remember-me tracking
  response.cookies.set(GUARDAI_COOKIES.rememberMe, rememberMe ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    ...persistentOpts,
  });

  response.cookies.set(
    GUARDAI_COOKIES.accessToken,
    data.session.access_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      ...(rememberMe ? { maxAge: data.session.expires_in ?? 3600 } : {}),
    }
  );

  response.cookies.set(
    GUARDAI_COOKIES.refreshToken,
    data.session.refresh_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      ...persistentOpts,
    }
  );

  return response;
}
