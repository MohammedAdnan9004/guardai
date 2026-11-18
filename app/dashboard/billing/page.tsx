import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenantAdmin } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingView } from "@/components/dashboard/billing-view";

export const metadata: Metadata = {
  title: "Billing & Subscriptions",
};

export const dynamic = "force-dynamic";

export default async function DashboardBillingPage() {
  const session = await requireTenantAdmin();
  if (!session.workspace) {
    redirect("/dashboard");
  }

  let memberCount = 1;
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspace.id);
    memberCount = count ?? 1;
  }

  return (
    <BillingView workspace={session.workspace} memberCount={memberCount} />
  );
}
