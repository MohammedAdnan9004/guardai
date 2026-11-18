import type { Metadata } from "next";
import { requireWorkspaceAccess } from "@/lib/auth/dal";
import { ProfileView } from "@/components/dashboard/profile-view";

export const metadata: Metadata = {
  title: "Profile & Security",
};

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  const session = await requireWorkspaceAccess([
    "tenant_admin",
    "member",
    "super_admin",
  ]);

  return <ProfileView session={session} />;
}
