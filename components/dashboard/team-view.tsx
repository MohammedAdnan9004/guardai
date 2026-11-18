"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Loader2,
  MailPlus,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { inviteMemberSchema } from "@/lib/security/validation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import type {
  Workspace,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
} from "@/lib/auth/types";

interface TeamViewProps {
  workspace: Workspace;
  currentUserId: string;
  initialMembers: WorkspaceMemberRecord[];
  initialInvitations: WorkspaceInvitationRecord[];
}

export function TeamView({
  workspace,
  currentUserId,
  initialMembers,
  initialInvitations,
}: TeamViewProps) {
  const router = useRouter();
  const [members, setMembers] = React.useState(initialMembers);
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<WorkspaceRole>("member");
  const [inviting, setInviting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [latestInviteLink, setLatestInviteLink] = React.useState<string | null>(
    null
  );

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteMemberSchema.safeParse({
      email: inviteEmail,
      role: inviteRole,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.flatten().fieldErrors.email?.[0] ??
          "Enter a valid work email."
      );
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as {
        error?: string;
        invitation?: WorkspaceInvitationRecord & { token?: string };
      };

      if (!response.ok || !payload.invitation) {
        toast.error(payload.error ?? "Unable to create invitation.");
        return;
      }

      setInvitations((prev) => [payload.invitation!, ...prev]);
      setInviteEmail("");
      if (payload.invitation.token) {
        setLatestInviteLink(
          `${window.location.origin}/signup?invite=${payload.invitation.token}`
        );
      }
      toast.success(`Invitation created for ${parsed.data.email}`);
      router.refresh();
    } catch {
      toast.error("Network error while creating invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, role: WorkspaceRole) {
    setBusyId(memberId);
    try {
      const response = await fetch("/api/workspace/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Failed to update role.");
        return;
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, workspace_role: role } : m
        )
      );
      toast.success("Member role updated.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string, kind: "member" | "invitation") {
    setBusyId(id);
    try {
      const response = await fetch(
        `/api/workspace/members?id=${encodeURIComponent(id)}&kind=${kind}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Action failed.");
        return;
      }

      if (kind === "member") {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        toast.success("Member removed from workspace.");
      } else {
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: "revoked" } : inv
          )
        );
        toast.success("Invitation revoked.");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Badge variant="cyber" className="font-mono text-[10px] mb-1.5">
            TENANT ADMIN ONLY • TEAM RBAC
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Workspace Team & Analyst Onboarding
          </h1>
          <p className="text-sm text-muted-foreground">
            Invite SOC Analysts to{" "}
            <span className="font-medium text-foreground">{workspace.name}</span>{" "}
            and manage workspace roles under strict seat enforcement.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/80 px-4 py-2 text-xs">
          <span className="font-mono text-muted-foreground">Seats Used: </span>
          <span className="font-mono font-bold text-foreground">
            {members.length} / {workspace.seat_limit}
          </span>
        </div>
      </div>

      {/* Invite Analyst Form */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            <span>Invite SOC Analyst or Admin</span>
          </CardTitle>
          <CardDescription>
            Invited users automatically link to this workspace via the{" "}
            <code className="font-mono">on_auth_user_created</code> database
            trigger when signing up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleInvite}
            className="grid gap-4 sm:grid-cols-12 sm:items-end"
          >
            <div className="space-y-1.5 sm:col-span-6">
              <Label htmlFor="invite-email">Analyst Work Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="soc.analyst@company.io"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="invite-role">Workspace Role</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="member">Member / SOC Analyst</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <Button
                type="submit"
                variant="cyber"
                disabled={inviting}
                className="w-full"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailPlus className="h-4 w-4" />
                )}
                <span>Send Invite</span>
              </Button>
            </div>
          </form>

          {latestInviteLink && (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Onboarding Invite Link Ready
                </p>
                <p className="truncate font-mono text-muted-foreground">
                  {latestInviteLink}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(latestInviteLink);
                  toast.success("Invite URL copied to clipboard.");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Members */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            <span>Active Workspace Members ({members.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const isOwner = member.user_id === workspace.owner_id;
              const isSelf = member.user_id === currentUserId;
              const name = member.profile?.full_name ?? "Workspace Member";
              const email = member.profile?.email ?? "—";

              return (
                <div
                  key={member.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background/60 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{getInitials(name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {name}
                        </p>
                        {isOwner && (
                          <Badge variant="cyber" className="font-mono text-[10px]">
                            OWNER
                          </Badge>
                        )}
                        {isSelf && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            YOU
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Role for ${name}`}
                      value={member.workspace_role}
                      disabled={isOwner || busyId === member.id}
                      onChange={(e) =>
                        void handleRoleChange(
                          member.id,
                          e.target.value as WorkspaceRole
                        )
                      }
                      className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground disabled:opacity-60"
                    >
                      <option value="tenant_admin">Tenant Admin</option>
                      <option value="member">SOC Analyst</option>
                    </select>

                    {!isOwner && !isSelf && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === member.id}
                        onClick={() => void handleRemove(member.id, "member")}
                        className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invitations */}
      {invitations.length > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              <span>Workspace Invitations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-mono font-medium text-foreground">
                    {inv.email}
                  </p>
                  <p className="text-muted-foreground">
                    Role: {inv.role} • Created {formatRelativeTime(inv.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      inv.status === "pending"
                        ? "warning"
                        : inv.status === "accepted"
                        ? "success"
                        : "secondary"
                    }
                    className="font-mono text-[10px]"
                  >
                    {inv.status.toUpperCase()}
                  </Badge>
                  {inv.status === "pending" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === inv.id}
                      onClick={() => void handleRemove(inv.id, "invitation")}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
