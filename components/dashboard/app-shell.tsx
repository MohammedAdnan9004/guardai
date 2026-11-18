"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronDown,
  CreditCard,
  FileWarning,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useGuardLogout } from "@/components/auth/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import type { EffectiveRole } from "@/lib/auth/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  effectiveRole: EffectiveRole;
  workspaceName: string | null;
  workspacePlan: string | null;
}

export function AppShell({
  children,
  userName,
  userEmail,
  effectiveRole,
  workspaceName,
  workspacePlan,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isLoggingOut } = useGuardLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Prevent BFCache restore of authenticated views after logout
  React.useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const navItems: NavItem[] = React.useMemo(() => {
    if (effectiveRole === "super_admin") {
      return [
        {
          href: "/super-admin",
          label: "Platform Command",
          icon: ShieldAlert,
          badge: "OWNER",
        },
        {
          href: "/super-admin/profile",
          label: "Profile & MFA",
          icon: UserCog,
        },
      ];
    }

    const baseItems: NavItem[] = [
      {
        href: "/dashboard",
        label: "Workspace Overview",
        icon: LayoutDashboard,
      },
      {
        href: "/dashboard/logs",
        label: "Log Baseline",
        icon: FileWarning,
      },
      {
        href: "/dashboard/threats",
        label: "Threat Readiness",
        icon: Activity,
      },
    ];

    if (effectiveRole === "tenant_admin") {
      baseItems.push(
        {
          href: "/dashboard/team",
          label: "Team & RBAC",
          icon: Users,
        },
        {
          href: "/dashboard/billing",
          label: "Plan & Seats",
          icon: CreditCard,
        },
        {
          href: "/dashboard/settings",
          label: "Workspace Settings",
          icon: Settings,
        }
      );
    }

    baseItems.push({
      href: "/dashboard/profile",
      label: "Profile & MFA",
      icon: UserCog,
    });

    return baseItems;
  }, [effectiveRole]);

  const roleBadgeLabel =
    effectiveRole === "super_admin"
      ? "SUPER ADMIN"
      : effectiveRole === "tenant_admin"
      ? "TENANT ADMIN"
      : "SOC ANALYST";

  const roleBadgeVariant =
    effectiveRole === "super_admin"
      ? "warning"
      : effectiveRole === "tenant_admin"
      ? "cyber"
      : "success";

  const profileHref =
    effectiveRole === "super_admin"
      ? "/super-admin/profile"
      : "/dashboard/profile";

  const workspaceTitle =
    effectiveRole === "super_admin"
      ? "Platform Console"
      : workspaceName ?? "Isolated Workspace";

  const SidebarContent = (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <BrandLogo
            href={effectiveRole === "super_admin" ? "/super-admin" : "/dashboard"}
            tagline={
              effectiveRole === "super_admin" ? "Platform" : "Phase 1 · Console"
            }
          />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent lg:hidden cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace Monogram Badge */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/70 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-1/25 via-brand-2/25 to-brand-3/25 font-heading text-xs font-semibold text-foreground ring-1 ring-inset ring-border">
            {workspaceTitle.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {workspaceTitle}
            </p>
            <p className="truncate font-mono text-[0.6rem] tracking-wide text-muted-foreground uppercase">
              {effectiveRole === "super_admin"
                ? "All tenants · Unlimited"
                : `${(workspacePlan ?? "free").toUpperCase()} plan`}
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1" aria-label="Primary Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/super-admin" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/10"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                </span>
                {item.badge && (
                  <span className="relative z-10 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-600 dark:text-amber-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Logout Trigger (Placement #2) */}
      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2 px-2 font-mono text-[0.65rem] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>RLS &amp; JWT Claims Active</span>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-300 cursor-pointer disabled:opacity-50"
        >
          <LogOut className="size-4 shrink-0" />
          <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 dot-bg opacity-65"
      />

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/75 p-4 backdrop-blur-xl lg:flex">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 border-r border-border bg-card p-4 shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden"
          >
            <Menu className="size-4" />
          </Button>

          <BrandLogo
            showWordmark={false}
            href={effectiveRole === "super_admin" ? "/super-admin" : "/dashboard"}
            className="lg:hidden"
          />

          <div className="ml-auto flex items-center gap-2.5">
            <Badge
              variant={roleBadgeVariant}
              className="hidden font-mono text-[0.6rem] sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {roleBadgeLabel}
            </Badge>

            <ThemeToggle compact />

            {/* User Avatar Dropdown (Logout Placement #1) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 py-1 pl-1.5 pr-2.5 text-left transition-colors hover:bg-accent cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <Avatar className="size-7">
                    <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium text-foreground md:inline">
                    {userName}
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {userName}
                  </p>
                  <p className="truncate font-mono text-[11px] font-normal text-muted-foreground">
                    {userEmail}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={profileHref}>
                    <UserCog className="size-4 text-primary" />
                    <span>Profile &amp; MFA</span>
                  </Link>
                </DropdownMenuItem>
                {effectiveRole === "tenant_admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="size-4 text-primary" />
                      <span>Workspace Settings</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void logout();
                  }}
                  disabled={isLoggingOut}
                  className="text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-300"
                >
                  <LogOut className="size-4" />
                  <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
