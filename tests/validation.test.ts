import { describe, expect, it } from "vitest";
import {
  evaluatePasswordStrength,
  logFileIntegritySchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from "@/lib/security/validation";

describe("GuardAI Zod & RegEx Security Baseline", () => {
  it("validates strong passwords and scores all 5 RegEx rules", () => {
    const weak = evaluatePasswordStrength("password");
    expect(weak.isValid).toBe(false);
    expect(weak.score).toBeLessThan(5);

    const strong = evaluatePasswordStrength("CyberGuard!2026");
    expect(strong.isValid).toBe(true);
    expect(strong.score).toBe(5);
    expect(strong.label).toBe("Fortified");
  });

  it("enforces signup schema rules and strips XSS from text fields", () => {
    const mismatch = signupSchema.safeParse({
      fullName: "Alex Mercer",
      email: "alex@company.io",
      workspaceName: "Acme SOC",
      password: "Password!1",
      confirmPassword: "Password!2",
    });
    expect(mismatch.success).toBe(false);

    const valid = signupSchema.safeParse({
      fullName: "<b>Alex Mercer</b>",
      email: "  Alex@Company.IO ",
      workspaceName: "Acme Cyber Defense",
      password: "Password!1",
      confirmPassword: "Password!1",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.fullName).toBe("Alex Mercer");
      expect(valid.data.email).toBe("alex@company.io");
    }
  });

  it("validates 6-digit numeric OTP strictly", () => {
    expect(
      verifyOtpSchema.safeParse({ email: "soc@acme.io", otp: "123456" }).success
    ).toBe(true);
    expect(
      verifyOtpSchema.safeParse({ email: "soc@acme.io", otp: "12345a" }).success
    ).toBe(false);
    expect(
      verifyOtpSchema.safeParse({ email: "soc@acme.io", otp: "12345" }).success
    ).toBe(false);
  });

  it("enforces password reset match and complexity", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "NewPassword#9",
        confirmPassword: "NewPassword#9",
      }).success
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: "weak",
        confirmPassword: "weak",
      }).success
    ).toBe(false);
  });

  it("enforces log file integrity check against dangerous extensions and scripts", () => {
    expect(
      logFileIntegritySchema.safeParse({
        filename: "firewall-2026.jsonl",
        sizeBytes: 4096,
        sampleHeader: '{"event":"auth_success","ip":"10.0.0.1"}',
      }).success
    ).toBe(true);

    expect(
      logFileIntegritySchema.safeParse({
        filename: "../etc/passwd.log",
        sizeBytes: 120,
        sampleHeader: "root:x:0:0",
      }).success
    ).toBe(false);

    expect(
      logFileIntegritySchema.safeParse({
        filename: "payload.exe",
        sizeBytes: 120,
        sampleHeader: "MZ",
      }).success
    ).toBe(false);

    expect(
      logFileIntegritySchema.safeParse({
        filename: "xss.log",
        sizeBytes: 120,
        sampleHeader: "<script>alert(1)</script>",
      }).success
    ).toBe(false);
  });
});
