import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Verify 6-Digit OTP",
  description: "Verify your 6-digit numeric recovery code.",
};

export default async function VerifyOtpPage() {
  const cookieStore = await cookies();
  const savedEmail = cookieStore.get(GUARDAI_COOKIES.recoveryEmail)?.value ?? "";

  return (
    <AuthShell
      title="Verify Security OTP"
      subtitle="Enter the 6-digit numeric code dispatched to your work email."
      badgeText="RECOVERY • STEP 2 OF 3"
    >
      <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-muted/40" />}>
        <VerifyOtpForm initialEmail={savedEmail} />
      </Suspense>
    </AuthShell>
  );
}
