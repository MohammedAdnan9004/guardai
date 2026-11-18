import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import {
  checkAndConsumeOtpRateLimit,
  checkIpRateLimit,
} from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { forgotPasswordSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:forgot-password", 15, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many password recovery requests. Retry in ${ipLimit.retryAfterSeconds}s.`,
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

  const parsed = forgotPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid work email address.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Enforce Upstash Redis limit: max 3 OTP requests/resends per 15 minutes
  const otpLimit = await checkAndConsumeOtpRateLimit(email, ip);
  if (!otpLimit.allowed) {
    const minutes = Math.ceil(otpLimit.retryAfterSeconds / 60);
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.otp.rate_limited",
      severity: "warning",
      metadata: {
        attempts_used: otpLimit.attemptsUsed,
        retry_after_seconds: otpLimit.retryAfterSeconds,
      },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error: `Maximum 3 OTP requests per 15 minutes exceeded. Wait ${minutes} minute(s) before requesting another code.`,
        retryAfterSeconds: otpLimit.retryAfterSeconds,
        remaining: 0,
        maxAttempts: otpLimit.maxAttempts,
      },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are not configured. Copy .env.example to .env.local and add your Supabase credentials.",
      },
      { status: 503 }
    );
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appOrigin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.otp.dispatch_error",
      severity: "warning",
      metadata: { reason: error.message },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    // Surface Supabase rate-limit errors clearly while avoiding account enumeration
    if (error.status === 429) {
      return NextResponse.json(
        {
          error:
            "Email provider cooldown active. Please wait 60 seconds before retrying.",
          retryAfterSeconds: 60,
        },
        { status: 429 }
      );
    }
  } else {
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.otp.dispatched",
      severity: "info",
      metadata: { remaining_in_window: otpLimit.remaining },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
  }

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    ok: true,
    email,
    remaining: otpLimit.remaining,
    maxAttempts: otpLimit.maxAttempts,
    message:
      "If an account exists for this work email, a 6-digit verification OTP has been dispatched.",
  });

  response.cookies.set(GUARDAI_COOKIES.recoveryEmail, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
