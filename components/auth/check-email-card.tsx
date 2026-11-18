"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function CheckEmailCard({ email }: { email: string }) {
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  async function handleResend() {
    if (!email || cooldown > 0 || resending) return;
    setErrorMsg(null);
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setErrorMsg(payload.error ?? "Unable to resend confirmation email.");
        return;
      }
      setCooldown(60);
      toast.success(payload.message ?? "Confirmation link re-sent.");
    } catch {
      setErrorMsg("Network error while resending confirmation.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-semibold">Workspace Provisioned via Database Trigger</p>
          <p className="mt-1">
            We sent an activation link to{" "}
            <span className="font-mono font-semibold text-foreground">
              {email || "your work email"}
            </span>
            . Click the link to confirm your address and enter as{" "}
            <span className="font-semibold">Tenant Admin</span>.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="text-xs leading-relaxed">
          {errorMsg}
        </Alert>
      )}

      <div className="flex flex-col gap-2.5">
        <Button
          asChild
          size="lg"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 font-semibold text-white shadow-lg shadow-primary/20 hover:brightness-110"
        >
          <Link href="/login?verified=pending">
            <Mail className="size-4" />
            <span>Proceed to Sign In</span>
          </Link>
        </Button>

        {email && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="h-11 w-full rounded-xl"
          >
            {resending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span>
              {cooldown > 0
                ? `Resend confirmation in ${cooldown}s`
                : "Resend confirmation email"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
