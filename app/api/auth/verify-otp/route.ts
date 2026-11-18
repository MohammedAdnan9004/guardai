import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import {
  checkIpRateLimit,
  checkOtpVerifyAttempt,
  clearOtpVerifyLimits,
  recordOtpVerifyFailure,
} from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { verifyOtpSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:verify-otp", 20, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many OTP verification attempts. Wait ${ipLimit.retryAfterSeconds}s.`,
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

  const parsed = verifyOtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid work email and 6-digit numeric OTP.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email, otp } = parsed.data;

  const verifyLock = await checkOtpVerifyAttempt(email);
  if (verifyLock.locked) {
    const minutes = Math.ceil(verifyLock.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        error: `Too many incorrect OTP attempts. Try again in ${minutes} minute(s).`,
        retryAfterSeconds: verifyLock.retryAfterSeconds,
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

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "recovery",
  });

  if (error || !data.user || !data.session) {
    const remaining = await recordOtpVerifyFailure(email);
    await recordAuditEvent({
      actorEmail: email,
      action: "auth.otp.verify_failed",
      severity: remaining === 0 ? "critical" : "warning",
      metadata: { remaining_attempts: remaining, reason: error?.message },
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Invalid or expired 6-digit OTP code. ${remaining} attempt(s) remaining.`
            : "OTP verification locked for 15 minutes due to repeated invalid codes.",
        remaining,
      },
      { status: remaining > 0 ? 400 : 429 }
    );
  }

  await clearOtpVerifyLimits(email);

  await recordAuditEvent({
    actorId: data.user.id,
    actorEmail: email,
    action: "auth.otp.verified",
    severity: "info",
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    ok: true,
    redirectTo: "/reset-password",
  });

  response.cookies.set(GUARDAI_COOKIES.recoveryVerified, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 10, // 10-minute window to complete password reset
  });

  return response;
}
