import type { ReactNode } from "react";
import { requireWorkspaceAccess } from "@/lib/auth/dal";
import { AppShell } from "@/components/dashboard/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireWorkspaceAccess([
    "tenant_admin",
    "member",
    "super_admin",
  ]);

  return (
    <AppShell
      userName={session.profile.full_name}
      userEmail={session.user.email}
      effectiveRole={session.effectiveRole}
      workspaceName={session.workspace?.name ?? null}
      workspacePlan={session.workspace?.plan ?? null}
    >
      {children}
    </AppShell>
  );
}
