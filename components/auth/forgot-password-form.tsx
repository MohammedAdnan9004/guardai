"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { forgotPasswordSchema } from "@/lib/security/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMsg(
        parsed.error.flatten().fieldErrors.email?.[0] ??
          "Please enter a valid work email address."
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        remaining?: number;
        maxAttempts?: number;
      };

      if (!response.ok) {
        setErrorMsg(payload.error ?? "Unable to send OTP verification code.");
        return;
      }

      toast.success("6-digit OTP sent! Check your work email inbox.");
      router.push(
        `/verify-otp?email=${encodeURIComponent(parsed.data.email)}&rem=${payload.remaining ?? 2}`
      );
    } catch {
      setErrorMsg("Network error while requesting OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-xs text-muted-foreground">
        <KeyRound className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Step 1 of 3 • Redis-protected recovery allows up to{" "}
          <strong className="text-foreground">3 OTP dispatches</strong> per 15
          minutes.
        </span>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="recovery-email">Work Email Address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="recovery-email"
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
              <span>Dispatching 6-Digit OTP...</span>
            </>
          ) : (
            <span>Send 6-Digit Verification OTP</span>
          )}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}
