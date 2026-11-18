import { z } from "zod";
import { sanitizeEmail, sanitizePlainText } from "./sanitize";

/**
 * GuardAI Global Validation & RegEx Baseline
 * Used consistently across both Client Forms and Server API Endpoints.
 */

export const REGEX = {
  email:
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
  fullName: /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]{1,79}$/u,
  workspaceName:
    /^[a-zA-Z0-9](?:[a-zA-Z0-9\s._&-]{0,78}[a-zA-Z0-9])?$/,
  otp6: /^\d{6}$/,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9\s]/,
  controlChars: /[\x00-\x1F\x7F]/,
  safeLogFilename: /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

export const ALLOWED_LOG_EXTENSIONS = [
  ".json",
  ".jsonl",
  ".ndjson",
  ".log",
  ".csv",
  ".syslog",
  ".txt",
] as const;

export interface PasswordRuleCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 5
  label: "Critical" | "Weak" | "Fair" | "Strong" | "Fortified";
  checks: PasswordRuleCheck[];
  isValid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks: PasswordRuleCheck[] = [
    {
      id: "length",
      label: "At least 8 characters",
      passed: password.length >= 8 && password.length <= 128,
    },
    {
      id: "upper",
      label: "One uppercase letter (A-Z)",
      passed: REGEX.upper.test(password),
    },
    {
      id: "lower",
      label: "One lowercase letter (a-z)",
      passed: REGEX.lower.test(password),
    },
    {
      id: "number",
      label: "One numeric digit (0-9)",
      passed: REGEX.number.test(password),
    },
    {
      id: "special",
      label: "One special symbol (!@#$%^&*)",
      passed: REGEX.special.test(password),
    },
  ];

  const score = checks.filter((c) => c.passed).length;
  const labelMap: Record<number, PasswordStrengthResult["label"]> = {
    0: "Critical",
    1: "Critical",
    2: "Weak",
    3: "Fair",
    4: "Strong",
    5: "Fortified",
  };

  return {
    score,
    label: labelMap[score] ?? "Critical",
    checks,
    isValid: score === 5 && !REGEX.controlChars.test(password),
  };
}

export const emailSchema = z
  .string()
  .trim()
  .transform(sanitizeEmail)
  .refine((val) => val.length >= 5 && val.length <= 254, {
    message: "Work email must be between 5 and 254 characters.",
  })
  .refine((val) => REGEX.email.test(val), {
    message: "Enter a valid work email address (e.g. analyst@company.com).",
  });

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password cannot exceed 128 characters.")
  .refine((val) => !REGEX.controlChars.test(val), {
    message: "Password contains invalid control characters.",
  })
  .refine((val) => REGEX.upper.test(val), {
    message: "Password must include at least one uppercase letter.",
  })
  .refine((val) => REGEX.lower.test(val), {
    message: "Password must include at least one lowercase letter.",
  })
  .refine((val) => REGEX.number.test(val), {
    message: "Password must include at least one number.",
  })
  .refine((val) => REGEX.special.test(val), {
    message: "Password must include at least one special character.",
  });

export const fullNameSchema = z
  .string()
  .transform((val) => sanitizePlainText(val, 80))
  .refine((val) => val.length >= 2, {
    message: "Full name must be at least 2 characters.",
  })
  .refine((val) => REGEX.fullName.test(val), {
    message: "Full name contains unsupported characters.",
  });

export const workspaceNameSchema = z
  .string()
  .transform((val) => sanitizePlainText(val, 80))
  .refine((val) => val.length >= 2, {
    message: "Workspace name must be at least 2 characters.",
  })
  .refine((val) => REGEX.workspaceName.test(val), {
    message:
      "Workspace name may contain letters, numbers, spaces, hyphens, dots, underscores, and &.",
  });

export const otpSchema = z
  .string()
  .trim()
  .refine((val) => REGEX.otp6.test(val), {
    message: "Enter the complete 6-digit numeric verification code.",
  });

export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    workspaceName: workspaceNameSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    invitationToken: z
      .string()
      .trim()
      .max(128)
      .optional()
      .transform((val) => (val ? sanitizePlainText(val, 128) : undefined)),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password exceeds maximum length."),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "New passwords do not match.",
  });

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(128),
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "New passwords do not match.",
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "New password must differ from your current password.",
  });

export const updateWorkspaceSettingsSchema = z.object({
  name: workspaceNameSchema,
  alertThreshold: z.enum(["low", "medium", "high", "critical"]),
  retentionDays: z.number().int().min(7).max(365),
  autoQuarantine: z.boolean(),
  realtimeRagEnabled: z.boolean(),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(["tenant_admin", "member"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().regex(REGEX.uuid, "Invalid member ID."),
  role: z.enum(["tenant_admin", "member"]),
});

export const superAdminTenantActionSchema = z.object({
  workspaceId: z.string().regex(REGEX.uuid, "Invalid workspace ID."),
  action: z.enum(["suspend", "activate", "ban"]),
  reason: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizePlainText(val, 240) : "Admin policy action")),
});

export const superAdminUserActionSchema = z.object({
  userId: z.string().regex(REGEX.uuid, "Invalid user ID."),
  action: z.enum(["suspend", "activate", "ban", "force_logout", "delete"]),
  reason: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizePlainText(val, 240) : "Admin security action")),
});

export const logFileIntegritySchema = z.object({
  filename: z
    .string()
    .trim()
    .refine((name) => REGEX.safeLogFilename.test(name), {
      message: "Unsafe or malformed log filename.",
    })
    .refine(
      (name) =>
        ALLOWED_LOG_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
      {
        message: "Unsupported log format. Allowed: .json, .jsonl, .log, .csv, .syslog, .txt.",
      }
    ),
  sizeBytes: z
    .number()
    .int()
    .positive("Log file cannot be empty.")
    .max(50 * 1024 * 1024, "Log file exceeds 50MB ingestion limit."),
  sampleHeader: z
    .string()
    .max(2048)
    .refine((content) => !content.includes("\0") && !/<script[\s>]/i.test(content), {
      message: "Log integrity check failed: binary null bytes or active script payload detected.",
    }),
});
