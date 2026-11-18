"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { loginSchema } from "@/lib/security/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = React.useState(0);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const loggedOut = searchParams.get("loggedOut") === "true";
  const resetSuccess = searchParams.get("reset") === "success";
  const verifiedStatus = searchParams.get("verified");
  const setupRequired = searchParams.get("setup") === "required";
  const oauthError = searchParams.get("error");
  const oauthReason = searchParams.get("reason");

  React.useEffect(() => {
    if (loggedOut) {
      toast.success("Successfully signed out. Session tokens invalidated.");
    }
  }, [loggedOut]);

  React.useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({
      email,
      password,
      rememberMe,
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setErrorMsg("Enter a valid work email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        locked?: boolean;
        retryAfterSeconds?: number;
        redirectTo?: string;
        fieldErrors?: Record<string, string[]>;
      };

      if (!response.ok) {
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors);
        if (payload.locked && payload.retryAfterSeconds) {
          setLockSeconds(payload.retryAfterSeconds);
        }
        setErrorMsg(payload.error ?? "Authentication failed.");
        return;
      }

      toast.success("Identity verified. Launching GuardAI console...");
      const target = payload.redirectTo ?? "/dashboard";
      router.replace(target);
      router.refresh();
    } catch {
      setErrorMsg("Network error while authenticating. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const nextUrl = searchParams.get("next");
  const googleAuthHref = nextUrl
    ? `/api/auth/google?next=${encodeURIComponent(nextUrl)}`
    : "/api/auth/google";

  return (
    <div className="space-y-5">
      {loggedOut && (
        <Alert variant="success" className="text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            You have been securely logged out. All session cookies and local
            caches were cleared.
          </span>
        </Alert>
      )}

      {resetSuccess && (
        <Alert variant="success" className="text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Password updated successfully. Sign in using your new credentials.
          </span>
        </Alert>
      )}

      {verifiedStatus === "true" && (
        <Alert variant="success" className="text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Work email verified! Sign in below to enter your GuardAI workspace.
          </span>
        </Alert>
      )}

      {verifiedStatus === "pending" && (
        <Alert variant="info" className="text-xs">
          <Mail className="h-4 w-4 shrink-0" />
          <span>
            Check your work email for the confirmation link before signing in.
          </span>
        </Alert>
      )}

      {setupRequired && (
        <Alert variant="warning" className="text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Protected route blocked: Configure Supabase credentials in{" "}
            <code className="font-mono">.env.local</code> first.
          </span>
        </Alert>
      )}

      {(errorMsg || oauthError) && (
        <Alert variant="destructive" className="text-xs leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              {errorMsg ??
                (oauthError === "session_expired"
                  ? "Your previous session expired or is no longer active. Sign in again to continue."
                  : oauthReason
                  ? `OAuth error (${oauthError}): ${oauthReason}`
                  : `Authentication error: ${oauthError}`)}
            </p>
            {lockSeconds > 0 && (
              <p className="font-mono font-semibold">
                Brute-force lockout active: {formatCountdown(lockSeconds)}
              </p>
            )}
          </div>
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
          href={googleAuthHref}
          onClick={() => {
            setErrorMsg(null);
            setOauthLoading(true);
          }}
        >
          {oauthLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
          <span>Continue with Google</span>
        </a>
      </Button>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Or Authenticate With Credentials
        </span>
        <div className="flex-grow border-t border-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Work Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="analyst@company.io"
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
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
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
        </div>

        <div className="flex items-center justify-between pt-1">
          <label
            htmlFor="rememberMe"
            className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none"
          >
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <span>Remember me for 30 days</span>
          </label>
          <span className="font-mono text-[10px] text-muted-foreground">
            5-Attempt Shield
          </span>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading || oauthLoading || lockSeconds > 0}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying Identity...</span>
            </>
          ) : lockSeconds > 0 ? (
            <span>Locked ({formatCountdown(lockSeconds)})</span>
          ) : (
            <span>Sign In to GuardAI</span>
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        New organization?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary hover:underline"
        >
          Create a GuardAI workspace
        </Link>
      </p>
    </div>
  );
}
