import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  escapeHtml,
  extractClientIp,
  sanitizeEmail,
  sanitizePlainText,
} from "@/lib/security/sanitize";
import { verifyCsrfOrigin } from "@/lib/security/csrf";

describe("XSS Sanitization & CSRF Verification", () => {
  it("escapes HTML entities and strips active XSS payloads", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
    expect(
      sanitizePlainText('<img src=x onerror="alert(1)">Hello SOC')
    ).toBe("Hello SOC");
    expect(sanitizeEmail("  Admin@GuardAI.SEC ")).toBe("admin@guardai.sec");
  });

  it("extracts valid client IP addresses safely", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.19, 10.0.0.1",
    });
    expect(extractClientIp(headers)).toBe("203.0.113.19");

    const invalidHeaders = new Headers({
      "x-forwarded-for": "not-an-ip<script>",
    });
    expect(extractClientIp(invalidHeaders)).toBe("127.0.0.1");
  });

  it("enforces same-origin CSRF checks on mutating requests", () => {
    const getReq = new NextRequest("http://localhost:3000/api/workspace/members", {
      method: "GET",
    });
    expect(verifyCsrfOrigin(getReq).valid).toBe(true);

    const validPost = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(verifyCsrfOrigin(validPost).valid).toBe(true);

    const crossOriginPost = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.attacker.com",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(verifyCsrfOrigin(crossOriginPost).valid).toBe(false);
  });
});
