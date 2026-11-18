import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Authenticate to your GuardAI Autonomous SOC Workspace.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back, Defender"
      subtitle="Sign in to access your isolated SOC workspace and threat intelligence console."
      badgeText="ZERO-TRUST ACCESS GATEWAY"
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
