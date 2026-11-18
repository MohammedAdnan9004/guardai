import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recover Access",
  description: "Request a Redis-protected 6-digit recovery OTP.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recover Console Access"
      subtitle="Enter your work email to receive a 6-digit numeric verification OTP."
      badgeText="RECOVERY • STEP 1 OF 3"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
