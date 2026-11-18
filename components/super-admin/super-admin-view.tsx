"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Ban,
  Building2,
  CheckCircle2,
  LogOut,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils";
import type { AuditLogRecord, UserProfile, Workspace } from "@/lib/auth/types";

interface SuperAdminViewProps {
  currentUserId: string;
  tenants: Workspace[];
  users: UserProfile[];
  auditLogs: AuditLogRecord[];
}

export function SuperAdminView({
  currentUserId,
  tenants: initialTenants,
  users: initialUsers,
  auditLogs,
}: SuperAdminViewProps) {
  const router = useRouter();
  const [tenants, setTenants] = React.useState(initialTenants);
  const [users, setUsers] = React.useState(initialUsers);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const activeUsersCount = users.filter((u) => u.status === "active").length;
  const suspendedTenantsCount = tenants.filter(
    (t) => t.subscription_status === "suspended"
  ).length;

  async function handleTenantAction(
    workspaceId: string,
    action: "suspend" | "activate"
  ) {
    setBusyId(workspaceId);
    try {
      const response = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action }),
      });

      const payload = (await response.json()) as {
        error?: string;
        workspace?: { subscription_status: Workspace["subscription_status"] };
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Failed to update workspace status.");
        return;
      }

      setTenants((prev) =>
        prev.map((t) =>
          t.id === workspaceId
            ? {
                ...t,
                subscription_status:
                  payload.workspace?.subscription_status ??
                  (action === "activate" ? "active" : "suspended"),
              }
            : t
        )
      );
      toast.success(
        action === "suspend"
          ? "Workspace suspended across RLS & Proxy guards."
          : "Workspace reactivated."
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUserAction(
    userId: string,
    action: "suspend" | "activate" | "ban" | "force_logout" | "delete"
  ) {
    setBusyId(userId);
    try {
      const response = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        status?: UserProfile["status"];
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Super Admin user action failed.");
        return;
      }

      if (action === "delete") {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else if (payload.status) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, status: payload.status! } : u
          )
        );
      }

      toast.success(payload.message ?? `User action '${action}' executed.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/30 p-6 sm:flex-row sm:items-center">
        <div>
          <Badge variant="warning" className="font-mono text-[10px] mb-1.5">
            PLATFORM OWNER • SUBSCRIPTION EXEMPT
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            GuardAI Super Admin Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Global tenant governance, user security actions, and immutable
            audit oversight.
          </p>
        </div>
        <Badge variant="success" className="font-mono text-xs self-start sm:self-center">
          UNLIMITED SYSTEM ACCESS
        </Badge>
      </div>

      {/* Platform Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-mono text-xs uppercase">
              Total Tenants
            </CardDescription>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{tenants.length}</p>
            <p className="text-xs text-muted-foreground">
              {suspendedTenantsCount} suspended workspace(s)
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-mono text-xs uppercase">
              Active Users
            </CardDescription>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{activeUsersCount}</p>
            <p className="text-xs text-muted-foreground">
              {users.length} total registered profiles
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-mono text-xs uppercase">
              System API & AI Tokens
            </CardDescription>
            <Activity className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">Phase 1 Ready</p>
            <p className="text-xs text-muted-foreground">
              RAG token metering activates in Phase 2
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-mono text-xs uppercase">
              Global Audit Events
            </CardDescription>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold">{auditLogs.length}</p>
            <p className="text-xs text-muted-foreground">
              Recent platform security logs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Governance Tabs */}
      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">
            Tenants ({tenants.length})
          </TabsTrigger>
          <TabsTrigger value="users">
            Global Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            Global Audit Logs ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Tenant Workspaces</CardTitle>
              <CardDescription>
                One-click suspend or reactivate any workspace across the
                platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenants.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tenant workspaces provisioned yet.
                </p>
              ) : (
                tenants.map((tenant) => {
                  const isSuspended =
                    tenant.subscription_status === "suspended";
                  return (
                    <div
                      key={tenant.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {tenant.name}
                          </p>
                          <Badge
                            variant={isSuspended ? "destructive" : "success"}
                            className="font-mono text-[10px]"
                          >
                            {tenant.subscription_status.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {tenant.plan.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          slug: {tenant.slug} • seats: {tenant.seat_limit}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant={isSuspended ? "outline" : "destructive"}
                        size="sm"
                        disabled={busyId === tenant.id}
                        onClick={() =>
                          void handleTenantAction(
                            tenant.id,
                            isSuspended ? "activate" : "suspend"
                          )
                        }
                      >
                        {isSuspended ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Activate Tenant</span>
                          </>
                        ) : (
                          <>
                            <Ban className="h-3.5 w-3.5" />
                            <span>Suspend Tenant</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">
                Global User Administration
              </CardTitle>
              <CardDescription>
                Force global logout, suspend, ban, or delete user identities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <div
                    key={user.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-background/60 p-4 lg:flex-row lg:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {user.full_name}
                        </p>
                        <Badge
                          variant={
                            user.global_role === "super_admin"
                              ? "warning"
                              : "cyber"
                          }
                          className="font-mono text-[10px]"
                        >
                          {user.global_role.toUpperCase()}
                        </Badge>
                        <Badge
                          variant={
                            user.status === "active"
                              ? "success"
                              : "destructive"
                          }
                          className="font-mono text-[10px]"
                        >
                          {user.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {user.email} • Last login:{" "}
                        {formatRelativeTime(user.last_login_at)}
                      </p>
                    </div>

                    {!isSelf && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === user.id}
                          onClick={() =>
                            void handleUserAction(user.id, "force_logout")
                          }
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Force Logout</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === user.id}
                          onClick={() =>
                            void handleUserAction(
                              user.id,
                              user.status === "active" ? "suspend" : "activate"
                            )
                          }
                        >
                          <span>
                            {user.status === "active" ? "Suspend" : "Activate"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busyId === user.id}
                          onClick={() => void handleUserAction(user.id, "ban")}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Ban</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === user.id}
                          onClick={() =>
                            void handleUserAction(user.id, "delete")
                          }
                          className="text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">
                Global Security Audit Logs
              </CardTitle>
              <CardDescription>
                Comprehensive trail of authentication, RBAC, and administrative
                events across all tenants.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-foreground">
                      {log.action}
                    </p>
                    <p className="truncate text-muted-foreground">
                      Actor: {log.actor_email ?? "system"} • IP:{" "}
                      {log.ip_address ?? "internal"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={
                        log.severity === "critical"
                          ? "destructive"
                          : log.severity === "warning"
                          ? "warning"
                          : "secondary"
                      }
                      className="font-mono text-[10px]"
                    >
                      {log.severity}
                    </Badge>
                    <span className="font-mono text-muted-foreground">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
