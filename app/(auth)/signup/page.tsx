import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create SOC Workspace",
  description:
    "Provision your isolated GuardAI tenant and assume Tenant Admin control.",
};

export default async function SignupPage(props: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await props.searchParams;

  return (
    <AuthShell
      title="Provision your SOC Tenant"
      subtitle="Create an isolated enterprise workspace with instant profile sync and Tenant Admin RBAC."
      badgeText="TENANT ONBOARDING"
    >
      <SignupForm invitationToken={params.invite} />
    </AuthShell>
  );
}
