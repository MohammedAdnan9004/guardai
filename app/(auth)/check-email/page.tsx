import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailCard } from "@/components/auth/check-email-card";

export const metadata: Metadata = {
  title: "Verify Your Work Email",
};

export default async function CheckEmailPage(props: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await props.searchParams;

  return (
    <AuthShell
      title="Check your work inbox"
      subtitle="Confirm your email address to activate your Tenant Admin session."
      badgeText="EMAIL VERIFICATION"
    >
      <CheckEmailCard email={email ?? ""} />
    </AuthShell>
  );
}
