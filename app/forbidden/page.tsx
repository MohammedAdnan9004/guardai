import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { AuroraBackground } from "@/components/shared/aurora-background";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Access Denied (403)",
};

export default async function ForbiddenPage(props: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await props.searchParams;

  const isSuspended =
    reason === "suspended" ||
    reason === "banned" ||
    reason === "workspace_suspended";

  const message =
    reason === "banned"
      ? "This account has been permanently banned by a GuardAI Platform Administrator."
      : reason === "suspended"
      ? "This user account is currently suspended. Contact your organization admin or GuardAI support."
      : reason === "workspace_suspended"
      ? "This tenant workspace is currently suspended by platform governance."
      : "Your active RBAC role does not permit access to this route or resource.";

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      <AuroraBackground subtle />
      <div className="absolute right-6 top-6">
        <ThemeToggle compact />
      </div>

      <div className="glass-panel w-full max-w-md rounded-2xl border border-rose-500/30 p-8 text-center shadow-2xl space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <Badge variant="destructive" className="font-mono text-[10px]">
            403 • RBAC POLICY ENFORCED
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isSuspended ? "Access Suspended" : "Insufficient Permissions"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          {!isSuspended && (
            <Button asChild variant="cyber" className="w-full">
              <Link href="/dashboard">Return to Allowed Console</Link>
            </Button>
          )}
          <LogoutButton
            variant="outline"
            label="Sign Out & Switch Account"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
