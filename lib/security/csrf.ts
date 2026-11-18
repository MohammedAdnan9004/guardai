import { NextRequest } from "next/server";

/**
 * Verifies same-origin requests on state-changing HTTP handlers (POST, PATCH, PUT, DELETE)
 * to complement HTTP-only SameSite cookies for defense-in-depth CSRF protection.
 */
export function verifyCsrfOrigin(request: NextRequest): {
  valid: boolean;
  reason?: string;
} {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { valid: true };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite === "cross-site") {
    return {
      valid: false,
      reason: "Cross-site state-changing request rejected by CSRF policy.",
    };
  }

  if (!host) {
    return {
      valid: false,
      reason: "Missing Host header on mutating request.",
    };
  }

  const expectedOrigins = new Set<string>([
    `http://${host}`,
    `https://${host}`,
  ]);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      expectedOrigins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // Ignore malformed env var
    }
  }

  if (origin) {
    if (!expectedOrigins.has(origin)) {
      return {
        valid: false,
        reason: "Origin mismatch detected by CSRF protection.",
      };
    }
    return { valid: true };
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!expectedOrigins.has(refererOrigin)) {
        return {
          valid: false,
          reason: "Referer origin mismatch detected by CSRF protection.",
        };
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        reason: "Invalid Referer header.",
      };
    }
  }

  // Same-origin fetch from Server/Browser without Origin is blocked unless explicitly same-origin
  if (fetchSite === "same-origin" || fetchSite === "none") {
    return { valid: true };
  }

  return {
    valid: false,
    reason: "Missing Origin/Referer verification headers.",
  };
}
