import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  getHomeRouteForRole,
  getPermissionsForRole,
  isTenantAdminOnlyPath,
  resolveEffectiveRole,
} from "@/lib/auth/rbac";
import {
  checkAndConsumeOtpRateLimit,
  checkLoginBruteForce,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from "@/lib/security/redis";

describe("3-Tier Multi-Tenant RBAC Engine", () => {
  it("routes roles to their designated landing destinations", () => {
    const superAdmin = resolveEffectiveRole("super_admin", "tenant_admin");
    const tenantAdmin = resolveEffectiveRole("user", "tenant_admin");
    const member = resolveEffectiveRole("user", "member");

    expect(superAdmin).toBe("super_admin");
    expect(getHomeRouteForRole(superAdmin)).toBe("/super-admin");

    expect(tenantAdmin).toBe("tenant_admin");
    expect(getHomeRouteForRole(tenantAdmin)).toBe("/dashboard");

    expect(member).toBe("member");
    expect(getHomeRouteForRole(member)).toBe("/dashboard");
  });

  it("strictly prevents Member/SOC Analyst from accessing billing, team, settings, and super-admin", () => {
    expect(isTenantAdminOnlyPath("/dashboard/billing")).toBe(true);
    expect(isTenantAdminOnlyPath("/dashboard/team")).toBe(true);
    expect(isTenantAdminOnlyPath("/dashboard/settings")).toBe(true);

    expect(canAccessRoute("/dashboard", "member")).toBe(true);
    expect(canAccessRoute("/dashboard/logs", "member")).toBe(true);
    expect(canAccessRoute("/dashboard/threats", "member")).toBe(true);
    expect(canAccessRoute("/dashboard/profile", "member")).toBe(true);

    expect(canAccessRoute("/dashboard/billing", "member")).toBe(false);
    expect(canAccessRoute("/dashboard/team", "member")).toBe(false);
    expect(canAccessRoute("/dashboard/settings", "member")).toBe(false);
    expect(canAccessRoute("/super-admin", "member")).toBe(false);

    expect(canAccessRoute("/dashboard/billing", "tenant_admin")).toBe(true);
    expect(canAccessRoute("/super-admin", "tenant_admin")).toBe(false);
    expect(canAccessRoute("/super-admin", "super_admin")).toBe(true);

    const memberPerms = getPermissionsForRole("member");
    expect(memberPerms.canManageBilling).toBe(false);
    expect(memberPerms.canManageTeam).toBe(false);
    expect(memberPerms.canUploadLogs).toBe(true);
  });
});

describe("Redis Security Protections (Brute-Force & OTP Limits)", () => {
  it("locks login for 15 minutes after 5 consecutive failed attempts and resets on clear", async () => {
    const email = `bf-${Date.now()}@guardai.sec`;
    const ip = "198.51.100.42";

    expect((await checkLoginBruteForce(email, ip)).locked).toBe(false);

    for (let i = 1; i <= 4; i += 1) {
      const state = await recordFailedLoginAttempt(email, ip);
      expect(state.locked).toBe(false);
      expect(state.remainingAttempts).toBe(5 - i);
    }

    const fifth = await recordFailedLoginAttempt(email, ip);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(800);

    const status = await checkLoginBruteForce(email, ip);
    expect(status.locked).toBe(true);

    await clearFailedLoginAttempts(email, ip);
    expect((await checkLoginBruteForce(email, ip)).locked).toBe(false);
  });

  it("enforces max 3 OTP requests per 15 minutes", async () => {
    const email = `otp-${Date.now()}@guardai.sec`;
    const ip = "198.51.100.77";

    expect((await checkAndConsumeOtpRateLimit(email, ip)).allowed).toBe(true);
    expect((await checkAndConsumeOtpRateLimit(email, ip)).allowed).toBe(true);
    expect((await checkAndConsumeOtpRateLimit(email, ip)).allowed).toBe(true);

    const fourth = await checkAndConsumeOtpRateLimit(email, ip);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });
});
