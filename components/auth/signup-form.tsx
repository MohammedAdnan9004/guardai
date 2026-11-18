"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { signupSchema } from "@/lib/security/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";

interface SignupFormProps {
  invitationToken?: string;
}

export function SignupForm({ invitationToken }: SignupFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      fullName,
      email,
      workspaceName,
      password,
      confirmPassword,
      invitationToken,
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setErrorMsg("Please resolve the validation errors highlighted below.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: Record<string, string[]>;
        requiresEmailConfirmation?: boolean;
        redirectTo?: string;
        email?: string;
      };

      if (!response.ok) {
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors);
        setErrorMsg(payload.error ?? "Unable to register workspace.");
        return;
      }

      if (payload.requiresEmailConfirmation) {
        toast.success("Confirmation email sent. Verify your work email to proceed.");
        router.push(
          payload.redirectTo ??
            `/check-email?email=${encodeURIComponent(parsed.data.email)}`
        );
        return;
      }

      toast.success("Workspace created! Tenant Admin session active.");
      router.replace(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setErrorMsg("Network error while provisioning your workspace.");
    } finally {
      setLoading(false);
    }
  }

  const googleSignupHref = invitationToken
    ? `/api/auth/google?next=${encodeURIComponent("/dashboard")}`
    : "/api/auth/google";

  return (
    <div className="space-y-5">
      {errorMsg && (
        <Alert variant="destructive" className="text-xs leading-relaxed">
          {errorMsg}
        </Alert>
      )}

      <Button
        asChild
        variant="outline"
        className={
          oauthLoading || loading
            ? "pointer-events-none h-11 w-full rounded-xl font-medium opacity-50"
            : "h-11 w-full rounded-xl font-medium"
        }
      >
        <a
          href={googleSignupHref}
          onClick={() => {
            setErrorMsg(null);
            setOauthLoading(true);
          }}
        >
          {oauthLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
          )}
          <span>Sign up with Google (Auto-Provision Workspace)</span>
        </a>
      </Button>

      <div className="relative flex items-center py-0.5">
        <div className="flex-grow border-t border-border/70" />
        <span className="mx-3 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Or Work Email
        </span>
        <div className="flex-grow border-t border-border/70" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Alex Mercer"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 rounded-xl pl-10"
                required
              />
            </div>
            {fieldErrors.fullName?.[0] && (
              <p className="text-xs text-destructive">
                {fieldErrors.fullName[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspaceName">Workspace Name</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
              <Input
                id="workspaceName"
                name="workspaceName"
                type="text"
                placeholder="Acme Cyber Defense"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="h-11 rounded-xl pl-10"
                required
              />
            </div>
            {fieldErrors.workspaceName?.[0] && (
              <p className="text-xs text-destructive">
                {fieldErrors.workspaceName[0]}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="alex@acmesecurity.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl pl-10"
              required
            />
          </div>
          {fieldErrors.email?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create fortified password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
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
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <ShieldCheck className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter password"
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
              className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
          {fieldErrors.confirmPassword?.[0] && (
            <p className="text-xs text-destructive">
              {fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading || oauthLoading}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Provisioning Workspace...</span>
            </>
          ) : (
            <span>Create SOC Workspace</span>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have a GuardAI tenant?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
