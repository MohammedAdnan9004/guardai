import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext, getSupabaseConfig, GUARDAI_COOKIES } from "./config";
import {
  canAccessRoute,
  getHomeRouteForRole,
  resolveEffectiveRole,
} from "@/lib/auth/rbac";
import type { GlobalRole, WorkspaceRole } from "@/lib/auth/types";

const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-otp",
  "/reset-password",
  "/check-email",
];

const PROTECTED_PREFIXES = ["/dashboard", "/super-admin"];

function applyNoCacheHeaders(response: NextResponse): void {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

function applySecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
}

function isSupabaseAuthSessionCookie(name: string): boolean {
  return (
    name.startsWith("sb-") &&
    name.includes("auth-token") &&
    !name.includes("code-verifier")
  );
}

function createRedirectResponse(
  target: URL,
  fromResponse: NextResponse,
  { noCache = false }: { noCache?: boolean } = {}
): NextResponse {
  const redirectRes = NextResponse.redirect(target);
  fromResponse.cookies.getAll().forEach((cookie) => {
    redirectRes.cookies.set(cookie);
  });
  if (noCache) {
    applyNoCacheHeaders(redirectRes);
  }
  applySecurityHeaders(redirectRes);
  return redirectRes;
}

/**
 * Clears stale Supabase auth-token and GuardAI session cookies while leaving
 * OAuth PKCE code-verifier cookies untouched.
 */
function clearStaleAuthCookies(
  request: NextRequest,
  response: NextResponse,
  isHttps: boolean
): void {
  const httpOnlyCookies = [
    GUARDAI_COOKIES.accessToken,
    GUARDAI_COOKIES.refreshToken,
    GUARDAI_COOKIES.rememberMe,
  ];

  httpOnlyCookies.forEach((name) => {
    if (request.cookies.has(name)) {
      response.cookies.set(name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });

  request.cookies.getAll().forEach((cookie) => {
    if (isSupabaseAuthSessionCookie(cookie.name)) {
      response.cookies.set(cookie.name, "", {
        httpOnly: false,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });
}

export async function updateSessionAndGuardRoutes(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  applySecurityHeaders(response);

  const pathname = request.nextUrl.pathname;

  // OAuth callback & email confirmation handlers must run untouched
  if (pathname.startsWith("/auth/")) {
    applyNoCacheHeaders(response);
    return response;
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthPage = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    applyNoCacheHeaders(response);
  }

  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) {
    if (isProtected) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("setup", "required");
      const redirectRes = NextResponse.redirect(loginUrl);
      applyNoCacheHeaders(redirectRes);
      applySecurityHeaders(redirectRes);
      return redirectRes;
    }
    return response;
  }

  const { origin, isHttps } = getRequestContext(request);
  const rememberMe =
    request.cookies.get(GUARDAI_COOKIES.rememberMe)?.value === "1";

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        applySecurityHeaders(response);
        if (isProtected) {
          applyNoCacheHeaders(response);
        }
        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOpts = {
            ...options,
            sameSite: "lax" as const,
            secure: isHttps,
            path: "/",
          };
          if (
            !rememberMe &&
            value !== "" &&
            cookieOpts.maxAge &&
            cookieOpts.maxAge > 0
          ) {
            delete cookieOpts.maxAge;
            delete cookieOpts.expires;
          }
          response.cookies.set(name, value, cookieOpts);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => isSupabaseAuthSessionCookie(cookie.name));

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims ?? null;
  let userId: string | null = claims?.sub ?? null;
  let clearedStaleSession = false;

  // Verify the user still exists in Supabase Auth whenever a JWT or session cookie
  // is present on guarded/auth/landing routes so deleted accounts never loop.
  if ((userId || hasSessionCookie) && (isProtected || isAuthPage || pathname === "/")) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      userId = null;
      clearedStaleSession = hasSessionCookie || Boolean(claims?.sub);
      clearStaleAuthCookies(request, response, isHttps);
    } else {
      userId = userData.user.id;
    }
  }

  const isRecoveryOnlySession =
    request.cookies.get(GUARDAI_COOKIES.recoveryVerified)?.value === "1";

  if (isProtected && isRecoveryOnlySession) {
    return createRedirectResponse(
      new URL("/reset-password", origin),
      response,
      { noCache: true }
    );
  }

  if (isProtected && !userId) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", pathname);
    if (clearedStaleSession) {
      loginUrl.searchParams.set("error", "session_expired");
    }
    const redirectRes = createRedirectResponse(loginUrl, response, {
      noCache: true,
    });
    if (clearedStaleSession || hasSessionCookie) {
      clearStaleAuthCookies(request, redirectRes, isHttps);
    }
    return redirectRes;
  }

  if (userId && (isProtected || isAuthPage)) {
    const rawClaims = (claims ?? {}) as Record<string, unknown>;
    const appMeta =
      typeof rawClaims.app_metadata === "object" &&
      rawClaims.app_metadata !== null
        ? (rawClaims.app_metadata as Record<string, unknown>)
        : {};

    const [{ data: profileRow }, { data: memberRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("global_role, status")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("workspace_members")
        .select("workspace_role")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const accountStatus =
      (profileRow?.status as string | undefined) ??
      (rawClaims.account_status as string | undefined) ??
      "active";
    if (
      isProtected &&
      (accountStatus === "suspended" || accountStatus === "banned")
    ) {
      const forbiddenUrl = new URL("/forbidden", origin);
      forbiddenUrl.searchParams.set("reason", accountStatus);
      return createRedirectResponse(forbiddenUrl, response, { noCache: true });
    }

    const globalRole: GlobalRole =
      profileRow?.global_role === "super_admin" ||
      rawClaims.global_role === "super_admin" ||
      appMeta.role === "super_admin"
        ? "super_admin"
        : "user";

    const rawWorkspaceRole =
      memberRow?.workspace_role ??
      rawClaims.workspace_role ??
      appMeta.role;
    const workspaceRole: WorkspaceRole | undefined =
      rawWorkspaceRole === "tenant_admin" || rawWorkspaceRole === "member"
        ? (rawWorkspaceRole as WorkspaceRole)
        : undefined;

    if (
      isProtected &&
      (profileRow || rawClaims.global_role || rawClaims.workspace_role || appMeta.role)
    ) {
      const effectiveRole = resolveEffectiveRole(globalRole, workspaceRole);
      if (!canAccessRoute(pathname, effectiveRole)) {
        const target =
          effectiveRole === "super_admin" && pathname.startsWith("/dashboard")
            ? "/super-admin"
            : "/forbidden";
        return createRedirectResponse(new URL(target, origin), response, {
          noCache: true,
        });
      }
    }

    const isRecoveryPage = pathname.startsWith("/reset-password");
    const hasExplicitAuthFeedback =
      request.nextUrl.searchParams.has("error") ||
      request.nextUrl.searchParams.has("loggedOut") ||
      request.nextUrl.searchParams.has("setup") ||
      request.nextUrl.searchParams.has("reason");

    if (
      isAuthPage &&
      !isRecoveryPage &&
      !isRecoveryOnlySession &&
      !hasExplicitAuthFeedback
    ) {
      if (accountStatus === "suspended" || accountStatus === "banned") {
        const forbiddenUrl = new URL("/forbidden", origin);
        forbiddenUrl.searchParams.set("reason", accountStatus);
        return createRedirectResponse(forbiddenUrl, response);
      }

      const effectiveRole = resolveEffectiveRole(globalRole, workspaceRole);
      const home = getHomeRouteForRole(effectiveRole);
      return createRedirectResponse(new URL(home, origin), response);
    }
  }

  return response;
}
