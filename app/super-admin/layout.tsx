import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/components/dashboard/app-shell";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSuperAdmin();

  return (
    <AppShell
      userName={session.profile.full_name}
      userEmail={session.user.email}
      effectiveRole={session.effectiveRole}
      workspaceName="GuardAI Platform Control"
      workspacePlan="UNLIMITED"
    >
      {children}
    </AppShell>
  );
}
