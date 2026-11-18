"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/security/validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GuardSessionContext } from "@/lib/auth/types";

interface ProfileViewProps {
  session: GuardSessionContext;
}

interface TotpFactorSummary {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

function toQrSrc(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^(data:|blob:|https?:)/i.test(value)) return value;
  if (!value.startsWith("<")) return null;
  const namespaced = /\sxmlns\s*=/i.test(value)
    ? value
    : value.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(namespaced)}`;
}

export function ProfileView({ session }: ProfileViewProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(session.profile.full_name);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);

  // Real Supabase TOTP MFA state
  const [factors, setFactors] = React.useState<TotpFactorSummary[]>([]);
  const [loadingFactors, setLoadingFactors] = React.useState(true);
  const [enrolling, setEnrolling] = React.useState(false);
  const [verifyingMfa, setVerifyingMfa] = React.useState(false);
  const [totpSetup, setTotpSetup] = React.useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");

  const refreshMfaFactors = React.useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.totp ?? []).filter((f) => f.status === "verified");
    setFactors(verified);
  }, []);

  React.useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      Promise.resolve().then(() => {
        if (active) setLoadingFactors(false);
      });
      return () => {
        active = false;
      };
    }

    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        if (!active) return;
        const verified = (data?.totp ?? []).filter(
          (f) => f.status === "verified"
        );
        setFactors(verified);
      })
      .finally(() => {
        if (active) setLoadingFactors(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStartTotp() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `GuardAI Authenticator ${new Date().toLocaleDateString()}`,
        issuer: "GuardAI",
      });
      if (error || !data) {
        toast.error(error?.message ?? "Could not start MFA enrollment.");
        return;
      }
      setTotpSetup({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setTotpCode("");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleCancelTotp() {
    const pending = totpSetup;
    setTotpSetup(null);
    setTotpCode("");
    if (!pending) return;
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => undefined);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!totpSetup || !/^\d{6}$/.test(totpCode)) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setVerifyingMfa(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpSetup.factorId,
        code: totpCode,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Authenticator MFA enrolled successfully!");
      setTotpSetup(null);
      setTotpCode("");
      await refreshMfaFactors();
      router.refresh();
    } finally {
      setVerifyingMfa(false);
    }
  }

  async function handleRemoveFactor(factorId: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MFA factor removed.");
    await refreshMfaFactors();
    router.refresh();
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = updateProfileSchema.safeParse({ fullName });
    if (!parsed.success) {
      toast.error(
        parsed.error.flatten().fieldErrors.fullName?.[0] ?? "Invalid full name."
      );
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Unable to update profile.");
        return;
      }

      toast.success(payload.message ?? "Profile updated.");
      router.refresh();
    } catch {
      toast.error("Network error while updating profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(
        errs.currentPassword?.[0] ??
          errs.newPassword?.[0] ??
          errs.confirmNewPassword?.[0] ??
          "Password validation failed."
      );
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "password",
          ...parsed.data,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Unable to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success(payload.message ?? "Password changed successfully.");
    } catch {
      toast.error("Network error while changing password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const qrSrc = totpSetup ? toQrSrc(totpSetup.qrCode) : null;
  const mfaActive = factors.length > 0 || session.profile.mfa_enabled;

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
          PERSONAL IDENTITY &amp; SECURITY
        </Badge>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Profile, Credentials &amp; MFA
        </h1>
        <p className="text-sm text-muted-foreground">
          Update your identity details, rotate credentials, enroll TOTP MFA, or
          terminate your active session.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Profile Details */}
        <SpotlightCard inert className="p-0 lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" />
              <span>Personal Profile</span>
            </CardTitle>
            <CardDescription>
              Synchronized across <code className="font-mono">profiles</code> and
              Supabase Auth metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Work Email</Label>
                <Input
                  id="profile-email"
                  value={session.user.email}
                  disabled
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3 text-xs">
                <span className="text-muted-foreground">Effective RBAC Role</span>
                <Badge variant="cyber" className="font-mono text-[10px]">
                  {session.effectiveRole.toUpperCase()}
                </Badge>
              </div>
              <Button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 text-white hover:brightness-110"
              >
                {savingProfile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>Update Profile</span>
              </Button>
            </form>
          </CardContent>
        </SpotlightCard>

        {/* Password Update */}
        <SpotlightCard inert className="p-0 lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" />
              <span>Update Password</span>
            </CardTitle>
            <CardDescription>
              Requires current password verification before rotation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cur-pw">Current Password</Label>
                <Input
                  id="cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">New Password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <PasswordStrengthMeter
                  password={newPassword}
                  showRules={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf-new-pw">Confirm New Password</Label>
                <Input
                  id="conf-new-pw"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={savingPassword}
                className="rounded-xl"
              >
                {savingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                <span>Rotate Password</span>
              </Button>
            </form>
          </CardContent>
        </SpotlightCard>

        {/* MFA Enrollment */}
        <SpotlightCard inert className="p-0 lg:col-span-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span>Multi-Factor Authentication (TOTP)</span>
              </CardTitle>
              <Badge
                variant={mfaActive ? "success" : "warning"}
                className="font-mono text-[10px]"
              >
                {mfaActive ? "ENROLLED" : "NOT ENROLLED"}
              </Badge>
            </div>
            <CardDescription>
              Protect your operator session with Google Authenticator, Authy, or
              1Password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingFactors ? (
              <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
            ) : (
              factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {factor.friendly_name || "Authenticator App"}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        TOTP · Verified
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveFactor(factor.id)}
                    className="text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}

            {totpSetup ? (
              <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    Scan QR Code &amp; Verify 6-Digit Code
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => void handleCancelTotp()}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  {qrSrc && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrSrc}
                      alt="TOTP QR code"
                      width={128}
                      height={128}
                      className="size-32 rounded-lg bg-white p-1.5"
                    />
                  )}
                  <div className="w-full space-y-2 text-xs">
                    <Label htmlFor="mfa-secret">Manual Setup Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="mfa-secret"
                        readOnly
                        value={totpSetup.secret}
                        className="h-9 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0"
                        onClick={() => {
                          void navigator.clipboard.writeText(totpSetup.secret);
                          toast.success("Setup key copied.");
                        }}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleVerifyTotp} className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-10 font-mono tracking-widest"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={verifyingMfa || totpCode.length !== 6}
                    className="rounded-xl"
                  >
                    {verifyingMfa ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleStartTotp()}
                disabled={enrolling}
                className="rounded-xl"
              >
                {enrolling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                <span>Enroll Authenticator App</span>
              </Button>
            )}
          </CardContent>
        </SpotlightCard>

        {/* Session Termination (Logout Placement #3) */}
        <SpotlightCard inert className="border-rose-500/25 p-0 lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-base text-rose-600 dark:text-rose-400">
              Global Session Termination
            </CardTitle>
            <CardDescription>
              Invokes Supabase global <code className="font-mono">signOut()</code>,
              clears HTTP-only <code className="font-mono">sb-access-token</code> &amp;{" "}
              <code className="font-mono">sb-refresh-token</code> cookies, flushes
              browser storage, and prevents Back-button cache restores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton label="Sign Out & Terminate All Sessions" />
          </CardContent>
        </SpotlightCard>
      </div>
    </div>
  );
}
