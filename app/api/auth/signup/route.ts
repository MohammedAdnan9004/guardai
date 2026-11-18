import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkIpRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { signupSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:signup", 10, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many signup requests. Please wait ${ipLimit.retryAfterSeconds}s and try again.`,
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

  const parsed = signupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed. Please review the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
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

  const { fullName, email, workspaceName, password, invitationToken } =
    parsed.data;
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stateless token_hash confirmation works even when opened in a different browser/device
      emailRedirectTo: `${appOrigin}/auth/confirm?type=signup`,
      data: {
        full_name: fullName,
        workspace_name: workspaceName,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      },
    },
  });

  if (error) {
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.signup.failed",
      severity: "warning",
      metadata: { reason: error.message, code: error.code ?? null },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    const isSmtpFailure =
      /error sending confirmation email|over_email_send_rate_limit|rate limit/i.test(
        error.message
      );

    if (isSmtpFailure) {
      return NextResponse.json(
        {
          error:
            "Supabase Auth failed to send the confirmation email (Error sending confirmation email). If using Gmail SMTP, verify: (1) Enable Custom SMTP is ON & saved, (2) Sender email matches your Gmail address, (3) App Password has NO spaces (16 chars), and (4) Port is 465 (or 587) on smtp.gmail.com. Check Supabase Logs → Auth Logs for the exact SMTP rejection.",
          details: error.message,
          code: "smtp_delivery_failed",
        },
        { status: 503 }
      );
    }

    if (error.code === "user_already_exists" || error.status === 422) {
      return NextResponse.json(
        {
          error:
            "An account with this work email already exists. Sign in or recover your password.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Unable to complete registration." },
      { status: 400 }
    );
  }

  // Supabase returns empty identities when email already exists with confirmation enabled
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "An account with this work email already exists (via email or Google OAuth). Sign in with Google, or use Forgot Password to set a password.",
      },
      { status: 409 }
    );
  }

  await recordAuditEvent({
    actorId: data.user?.id ?? null,
    actorEmail: email,
    action: "auth.signup.completed",
    targetType: "user",
    targetId: data.user?.id ?? null,
    severity: "info",
    metadata: {
      workspace_name: workspaceName,
      requires_email_confirmation: !data.session,
      assigned_role: "tenant_admin",
    },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    {
      ok: true,
      requiresEmailConfirmation: !data.session,
      email,
      redirectTo: data.session
        ? "/dashboard"
        : `/check-email?email=${encodeURIComponent(email)}`,
      message: data.session
        ? "Workspace provisioned and Tenant Admin session initialized."
        : "Account created. Check your work email to confirm your address before signing in.",
    },
    { status: 201 }
  );
}
