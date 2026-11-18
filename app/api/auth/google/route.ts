import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Initiates Google OAuth PKCE flow server-side so PKCE code-verifier cookies
 * are attached directly to the redirect response without browser-state races.
 */
export async function GET(request: NextRequest) {
  const { url, anonKey, configured } = getSupabaseConfig();
  const { origin, isHttps } = getRequestContext(request);

  if (!configured) {
    return NextResponse.redirect(new URL("/login?setup=required", origin));
  }

  const nextParam = request.nextUrl.searchParams.get("next");

  const cookiesToWrite: Array<{
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
        cookiesToWrite.push(...cookies);
      },
    },
  });

  const callbackUrl = new URL("/auth/callback", origin);
  if (
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes("\\")
  ) {
    callbackUrl.searchParams.set("next", nextParam);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data?.url) {
    const errUrl = new URL("/login", origin);
    errUrl.searchParams.set("error", "oauth_init_failed");
    if (error?.message) {
      errUrl.searchParams.set("reason", error.message.slice(0, 180));
    }
    return NextResponse.redirect(errUrl);
  }

  const response = NextResponse.redirect(data.url);
  cookiesToWrite.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
    });
  });

  return response;
}
