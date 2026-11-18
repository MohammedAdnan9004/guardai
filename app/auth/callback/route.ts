import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getRequestContext,
  getSupabaseConfig,
  GUARDAI_COOKIES,
} from "@/lib/supabase/config";
import { resolveOrProvisionIdentity } from "@/lib/auth/provisioning";
import { getHomeRouteForRole, resolveEffectiveRole } from "@/lib/auth/rbac";
import { recordAuditEvent } from "@/lib/security/audit";
import { extractClientIp } from "@/lib/security/sanitize";
import type { GlobalRole, WorkspaceRole } from "@/lib/auth/types";

function isSafeRelativePath(path: string | null): path is string {
  return Boolean(
    path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { origin, isHttps } = getRequestContext(request);
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const nextParam = searchParams.get("next");
  const errorParam =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    const loginErr = new URL("/login", origin);
    loginErr.searchParams.set("error", "oauth_provider_error");
    loginErr.searchParams.set("reason", errorParam.slice(0, 180));
    return NextResponse.redirect(loginErr);
  }

  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured || !code) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_callback_failed", origin)
    );
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

  // Pass explicit sb_flow_id for @supabase/auth-js multi-flow PKCE support
  let exchangeResult = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  );

  if (exchangeResult.error && flowId) {
    exchangeResult = await supabase.auth.exchangeCodeForSession(code);
  }

  const { data, error } = exchangeResult;

  if (error || !data.user || !data.session) {
    console.error(
      "[auth/callback] exchangeCodeForSession failed:",
      error?.code,
      error?.message
    );
    const errUrl = new URL("/login", origin);
    errUrl.searchParams.set("error", "invalid_auth_code");
    if (error?.message) {
      errUrl.searchParams.set("reason", error.message.slice(0, 180));
    }
    return NextResponse.redirect(errUrl);
  }

  const { profile, membership } = await resolveOrProvisionIdentity(
    data.user,
    supabase
  );

  if (profile?.status === "banned" || profile?.status === "suspended") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(`/forbidden?reason=${profile.status}`, origin)
    );
  }

  const globalRole: GlobalRole =
    profile?.global_role === "super_admin" ? "super_admin" : "user";
  const workspaceRole: WorkspaceRole | null =
    membership?.workspace_role === "tenant_admin" ||
    membership?.workspace_role === "member"
      ? (membership.workspace_role as WorkspaceRole)
      : "tenant_admin";

  const effectiveRole = resolveEffectiveRole(globalRole, workspaceRole);
  const destination = isSafeRelativePath(nextParam)
    ? nextParam
    : getHomeRouteForRole(effectiveRole);

  const dbClient = createSupabaseAdminClient() ?? supabase;
  await dbClient
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  await recordAuditEvent({
    workspaceId: membership?.workspace_id ?? null,
    actorId: data.user.id,
    actorEmail: data.user.email ?? null,
    action: "auth.oauth_or_confirm.callback",
    severity: "info",
    metadata: { effective_role: effectiveRole },
    ipAddress: extractClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  const response = NextResponse.redirect(new URL(destination, origin));

  cookiesToApply.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
    });
  });

  response.cookies.set(
    GUARDAI_COOKIES.accessToken,
    data.session.access_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: data.session.expires_in ?? 3600,
    }
  );
  response.cookies.set(
    GUARDAI_COOKIES.refreshToken,
    data.session.refresh_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    }
  );
  response.cookies.set(GUARDAI_COOKIES.rememberMe, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
