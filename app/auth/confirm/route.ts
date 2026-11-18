import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getRequestContext,
  getSupabaseConfig,
  GUARDAI_COOKIES,
} from "@/lib/supabase/config";
import { resolveOrProvisionIdentity } from "@/lib/auth/provisioning";

const VALID_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { origin, isHttps } = getRequestContext(request);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const rawType = searchParams.get("type");
  const type: EmailOtpType = VALID_TYPES.includes(rawType as EmailOtpType)
    ? (rawType as EmailOtpType)
    : "email";
  const nextParam = searchParams.get("next");

  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured || (!tokenHash && !code)) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", origin));
  }

  const cookiesToApply: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookiesToApply.push(...cookies);
      },
    },
  });

  const result = tokenHash
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(
        code as string,
        flowId ? { flowId } : undefined
      );

  if (result.error) {
    // If PKCE code verifier is absent (e.g. email link opened on a different browser/device),
    // Supabase already verified the email address before redirecting here with `?code=`.
    if (code && !tokenHash && type !== "recovery") {
      return NextResponse.redirect(new URL("/login?verified=true", origin));
    }

    return NextResponse.redirect(
      new URL(
        `/login?error=token_verification_failed&reason=${encodeURIComponent(
          result.error.message.slice(0, 180)
        )}`,
        origin
      )
    );
  }

  if (type === "recovery") {
    const res = NextResponse.redirect(new URL("/reset-password", origin));
    cookiesToApply.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, {
        ...options,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
      });
    });
    res.cookies.set(GUARDAI_COOKIES.recoveryVerified, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 10,
    });
    return res;
  }

  if (result.data.session && result.data.user) {
    await resolveOrProvisionIdentity(result.data.user, supabase);
    const res = NextResponse.redirect(new URL(safeNext, origin));
    cookiesToApply.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, {
        ...options,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
      });
    });
    res.cookies.set(
      GUARDAI_COOKIES.accessToken,
      result.data.session.access_token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: result.data.session.expires_in ?? 3600,
      }
    );
    res.cookies.set(
      GUARDAI_COOKIES.refreshToken,
      result.data.session.refresh_token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );
    return res;
  }

  return NextResponse.redirect(new URL("/login?verified=true", origin));
}
