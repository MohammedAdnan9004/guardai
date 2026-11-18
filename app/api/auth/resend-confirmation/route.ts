import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { checkAndConsumeOtpRateLimit, checkIpRateLimit } from "@/lib/security/redis";
import { extractClientIp } from "@/lib/security/sanitize";
import { forgotPasswordSchema } from "@/lib/security/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = await checkIpRateLimit(ip, "auth:resend-confirm", 10, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Retry in ${ipLimit.retryAfterSeconds}s.` },
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
      { error: "Enter a valid work email address." },
      { status: 400 }
    );
  }

  const limit = await checkAndConsumeOtpRateLimit(parsed.data.email, ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Maximum ${limit.maxAttempts} resend attempts per 15 minutes exceeded.`,
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 503 }
    );
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${appOrigin}/auth/confirm?type=signup`,
    },
  });

  if (error) {
    return NextResponse.json(
      {
        error: /error sending|rate limit/i.test(error.message)
          ? "Supabase SMTP failed to dispatch the confirmation email. Verify Custom SMTP host (smtp.gmail.com), port (465 or 587), Sender Email = Gmail Username, and 16-char App Password without spaces in Supabase Auth Logs."
          : error.message,
        details: error.message,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    remaining: limit.remaining,
    message: "Confirmation email re-dispatched.",
  });
}
