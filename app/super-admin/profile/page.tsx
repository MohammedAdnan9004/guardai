import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { ProfileView } from "@/components/dashboard/profile-view";

export const metadata: Metadata = {
  title: "Super Admin Profile",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminProfilePage() {
  const session = await requireSuperAdmin();
  return <ProfileView session={session} />;
}
