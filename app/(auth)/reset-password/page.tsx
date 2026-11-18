import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { GUARDAI_COOKIES } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new fortified password for your GuardAI account.",
};

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const recoveryVerified =
    cookieStore.get(GUARDAI_COOKIES.recoveryVerified)?.value === "1";

  let hasRecoverySession = false;
  if (recoveryVerified) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      hasRecoverySession = Boolean(user);
    }
  }

  return (
    <AuthShell
      title="Rotate Account Password"
      subtitle="Create a strong password that satisfies GuardAI's RegEx complexity policy."
      badgeText="RECOVERY • STEP 3 OF 3"
    >
      <ResetPasswordForm hasRecoverySession={hasRecoverySession} />
    </AuthShell>
  );
}
