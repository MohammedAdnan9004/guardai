export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  configured: boolean;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  const configured = Boolean(
    url &&
      anonKey &&
      url.startsWith("http") &&
      !url.includes("your-project-ref") &&
      !anonKey.includes("your-supabase-anon-key")
  );

  return { url, anonKey, configured };
}

export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key.includes("your-supabase-service-role-key")) {
    return null;
  }
  return key;
}

export const GUARDAI_COOKIES = {
  accessToken: "sb-access-token",
  refreshToken: "sb-refresh-token",
  rememberMe: "guardai_remember_me",
  recoveryVerified: "guardai_recovery_verified",
  recoveryEmail: "guardai_recovery_email",
} as const;

const SAFE_HOST_PATTERN =
  /^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::\d{1,5})?$/;

/**
 * Resolves the effective request origin and protocol so cookie Secure flags and
 * OAuth redirect URLs stay consistent across localhost, 127.0.0.1, and proxies.
 */
export function getRequestContext(request: {
  nextUrl: { origin: string; protocol: string };
  headers: { get(name: string): string | null };
}): { origin: string; isHttps: boolean } {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : request.nextUrl.protocol.replace(/:$/, "").toLowerCase();

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = forwardedHost || request.headers.get("host")?.trim();
  const origin =
    hostHeader && SAFE_HOST_PATTERN.test(hostHeader)
      ? `${protocol}://${hostHeader}`
      : request.nextUrl.origin;

  return {
    origin,
    isHttps: protocol === "https",
  };
}
