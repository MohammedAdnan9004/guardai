"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { verifyOtpSchema } from "@/lib/security/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface VerifyOtpFormProps {
  initialEmail?: string;
}

export function VerifyOtpForm({ initialEmail = "" }: VerifyOtpFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email") ?? initialEmail;

  const [email, setEmail] = React.useState(queryEmail);
  const [digits, setDigits] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = React.useState(60);
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const lastAutoSubmittedRef = React.useRef<string>("");

  React.useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const submitCode = React.useCallback(
    async (code: string) => {
      setErrorMsg(null);

      const parsed = verifyOtpSchema.safeParse({ email, otp: code });
      if (!parsed.success) {
        const errs = parsed.error.flatten().fieldErrors;
        setErrorMsg(
          errs.email?.[0] ?? errs.otp?.[0] ?? "Invalid email or 6-digit OTP."
        );
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/auth/verify-otp", {
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
          setErrorMsg(payload.error ?? "Invalid or expired OTP code.");
          return;
        }

        toast.success("OTP verified! Choose your new GuardAI password.");
        router.replace(payload.redirectTo ?? "/reset-password");
      } catch {
        setErrorMsg("Network error while verifying OTP.");
      } finally {
        setLoading(false);
      }
    },
    [email, router]
  );

  React.useEffect(() => {
    const joined = digits.join("");
    if (
      joined.length === 6 &&
      /^\d{6}$/.test(joined) &&
      joined !== lastAutoSubmittedRef.current &&
      email.trim().length > 0 &&
      !loading
    ) {
      lastAutoSubmittedRef.current = joined;
      void submitCode(joined);
    }
  }, [digits, email, loading, submitCode]);

  function handleDigitChange(index: number, rawValue: string) {
    const cleaned = rawValue.replace(/\D/g, "");
    if (cleaned.length > 1) {
      // Handle multi-char input / paste into a single cell
      const next = [...digits];
      for (let i = 0; i < 6; i += 1) {
        next[i] = cleaned[i] ?? "";
      }
      setDigits(next);
      const focusIdx = Math.min(cleaned.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    lastAutoSubmittedRef.current = "";

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] ?? "");
    setDigits(next);
    lastAutoSubmittedRef.current = "";
    const focusIdx = Math.min(pasted.length - 1, 5);
    if (focusIdx >= 0) inputRefs.current[focusIdx]?.focus();
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setErrorMsg(null);
    setResending(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as {
        error?: string;
        remaining?: number;
      };

      if (!response.ok) {
        setErrorMsg(payload.error ?? "Unable to resend OTP.");
        return;
      }

      setCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      lastAutoSubmittedRef.current = "";
      inputRefs.current[0]?.focus();
      toast.success(
        `New 6-digit OTP dispatched (${payload.remaining ?? 0} resend(s) remaining in window).`
      );
    } catch {
      setErrorMsg("Network error while resending OTP.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(digits.join(""));
        }}
        className="space-y-5"
        noValidate
      >
        {!queryEmail && (
          <div className="space-y-1.5">
            <Label htmlFor="otp-email">Work Email</Label>
            <Input
              id="otp-email"
              type="email"
              placeholder="analyst@company.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

        {queryEmail && (
          <div className="rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-xs text-muted-foreground">
            Step 2 of 3 • Enter the 6-digit numeric code sent to{" "}
            <span className="font-mono font-medium text-foreground">
              {email}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label>6-Digit Verification Code</Label>
          <div className="grid grid-cols-6 gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <motion.div
                key={index}
                whileFocus={{ scale: 1.04 }}
                className="relative"
              >
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  aria-label={`OTP digit ${index + 1}`}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={cn(
                    "h-12 w-full rounded-xl border bg-background/80 text-center font-mono text-lg font-bold text-foreground shadow-xs transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring sm:h-14 sm:text-xl",
                    digit ? "border-primary/70 bg-primary/5" : "border-input"
                  )}
                />
              </motion.div>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading || digits.join("").length !== 6}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying Code...</span>
            </>
          ) : (
            <span>Verify 6-Digit Code</span>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Change email
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cooldown > 0 || resending}
          onClick={handleResend}
          className="h-8 text-xs"
        >
          {resending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span>
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
          </span>
        </Button>
      </div>
    </div>
  );
}
