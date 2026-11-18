import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfOrigin } from "@/lib/security/csrf";
import { extractClientIp } from "@/lib/security/sanitize";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";

export async function POST(request: NextRequest) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const supabase = await createSupabaseServerClient();

  let actorId: string | null = null;
  let actorEmail: string | null = null;
  let workspaceId: string | null = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      actorId = user.id;
      actorEmail = user.email ?? null;
      const { data: claimsData } = await supabase.auth.getClaims();
      const wsId = (claimsData?.claims as Record<string, unknown> | undefined)
        ?.workspace_id;
      if (typeof wsId === "string") {
        workspaceId = wsId;
      }
    }

    await supabase.auth.signOut({ scope: "global" });
  }

  if (actorId) {
    await recordAuditEvent({
      workspaceId,
      actorId,
      actorEmail,
      action: "auth.logout",
      targetType: "session",
      targetId: actorId,
      severity: "info",
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
  }

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    ok: true,
    redirectTo: "/login?loggedOut=true",
  });

  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  // Strict HTTP-only cookies managed by GuardAI server routes
  const httpOnlyCookies = new Set<string>([
    GUARDAI_COOKIES.accessToken,
    GUARDAI_COOKIES.refreshToken,
    GUARDAI_COOKIES.rememberMe,
    GUARDAI_COOKIES.recoveryVerified,
    GUARDAI_COOKIES.recoveryEmail,
  ]);

  httpOnlyCookies.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  });

  // Clear @supabase/ssr cookies without locking them as httpOnly
  request.cookies.getAll().forEach((c) => {
    if (
      !httpOnlyCookies.has(c.name) &&
      (c.name.startsWith("sb-") || c.name.startsWith("guardai_"))
    ) {
      response.cookies.set(c.name, "", {
        httpOnly: false,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });

  return response;
}
