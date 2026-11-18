import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkIpRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { resetPasswordSchema } from "@/lib/security/validation";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:reset-password", 10, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many password reset requests. Retry in ${ipLimit.retryAfterSeconds}s.`,
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

  const parsed = resetPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Password does not meet security policy requirements.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const recoveryVerified =
    request.cookies.get(GUARDAI_COOKIES.recoveryVerified)?.value === "1";

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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !recoveryVerified) {
    return NextResponse.json(
      {
        error:
          "Recovery verification session expired or invalid. Please verify a new 6-digit OTP code.",
      },
      { status: 401 }
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Unable to update password." },
      { status: 400 }
    );
  }

  await recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "auth.password.reset_completed",
    targetType: "user",
    targetId: user.id,
    severity: "info",
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
  });

  // Terminate recovery session so user signs in cleanly with new credentials
  await supabase.auth.signOut({ scope: "global" });

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    ok: true,
    redirectTo: "/login?reset=success",
    message: "Password updated successfully. Sign in with your new credentials.",
  });

  const cookiesToClear = new Set<string>([
    GUARDAI_COOKIES.accessToken,
    GUARDAI_COOKIES.refreshToken,
    GUARDAI_COOKIES.rememberMe,
    GUARDAI_COOKIES.recoveryVerified,
    GUARDAI_COOKIES.recoveryEmail,
  ]);
  request.cookies.getAll().forEach((c) => {
    if (c.name.startsWith("sb-")) cookiesToClear.add(c.name);
  });

  cookiesToClear.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  });

  return response;
}
