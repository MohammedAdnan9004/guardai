"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/lib/security/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";

interface ResetPasswordFormProps {
  hasRecoverySession: boolean;
}

export function ResetPasswordForm({
  hasRecoverySession,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const parsed = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setErrorMsg("Password does not satisfy security complexity requirements.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setErrorMsg(payload.error ?? "Unable to update password.");
        return;
      }

      toast.success("Password updated! Sign in with your new credentials.");
      router.replace(payload.redirectTo ?? "/login?reset=success");
    } catch {
      setErrorMsg("Network error while resetting password.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasRecoverySession) {
    return (
      <div className="space-y-4">
        <Alert variant="warning" className="text-xs leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            No verified OTP recovery session detected. Complete the 6-digit OTP
            verification step before setting a new password.
          </span>
        </Alert>
        <Button asChild variant="cyber" className="w-full">
          <Link href="/forgot-password">Request Verification OTP</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
        Step 3 of 3 • OTP verified. Create a strong new password for your
        GuardAI account.
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter new fortified password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password?.[0] && (
            <p className="text-xs text-destructive">
              {fieldErrors.password[0]}
            </p>
          )}
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm New Password</Label>
          <div className="relative">
            <ShieldCheck className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirm-new-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 rounded-xl pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword ? "Hide confirm password" : "Show confirm password"
              }
              className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-destructive">New passwords do not match.</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating Credentials...</span>
            </>
          ) : (
            <span>Save New Password</span>
          )}
        </Button>
      </form>
    </div>
  );
}
