/**
 * XSS & Input Sanitization Utilities
 * Part of GuardAI's Global Security Baseline.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
};

/**
 * Escapes HTML special characters to neutralize XSS vectors when
 * text might be rendered outside React JSX auto-escaping contexts.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`/]/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

/**
 * Strips HTML tags, null bytes, and ASCII control characters from plain text fields.
 */
export function sanitizePlainText(input: string, maxLength = 256): string {
  return input
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalizes and sanitizes email strings before lookup or Redis key generation.
 */
export function sanitizeEmail(input: string): string {
  return sanitizePlainText(input, 254).toLowerCase();
}

/**
 * Extracts a trustworthy client IP string from Next.js request headers.
 */
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first && /^[0-9a-fA-F.:]+$/.test(first)) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && /^[0-9a-fA-F.:]+$/.test(realIp)) {
    return realIp;
  }

  return "127.0.0.1";
}
