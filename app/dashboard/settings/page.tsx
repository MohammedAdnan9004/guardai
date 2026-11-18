import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenantAdmin } from "@/lib/auth/dal";
import { SettingsView } from "@/components/dashboard/settings-view";

export const metadata: Metadata = {
  title: "Workspace Settings",
};

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const session = await requireTenantAdmin();
  if (!session.workspace) {
    redirect("/dashboard");
  }

  return <SettingsView workspace={session.workspace} />;
}
