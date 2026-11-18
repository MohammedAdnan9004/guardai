"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

export function flushClientAuthStorage(): void {
  if (typeof window === "undefined") return;

  const clearStore = (storage: Storage) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (
        key.startsWith("sb-") ||
        key.includes("supabase") ||
        key.startsWith("guardai_")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  };

  try {
    clearStore(window.localStorage);
    clearStore(window.sessionStorage);
  } catch {
    // Storage access may be restricted in hardened browser modes
  }
}

export function useGuardLogout() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const logout = React.useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => undefined);
      }

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      flushClientAuthStorage();
      router.refresh();
      window.location.replace("/login?loggedOut=true");
    } catch {
      toast.error("Failed to terminate session cleanly. Redirecting to login.");
      flushClientAuthStorage();
      window.location.replace("/login?loggedOut=true");
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  return { logout, isLoggingOut };
}

interface LogoutButtonProps extends Omit<ButtonProps, "onClick"> {
  label?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  label = "Sign Out",
  showIcon = true,
  variant = "destructive",
  size = "default",
  className,
  ...props
}: LogoutButtonProps) {
  const { logout, isLoggingOut } = useGuardLogout();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={logout}
      disabled={isLoggingOut}
      className={className}
      {...props}
    >
      {showIcon &&
        (isLoggingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        ))}
      <span>{isLoggingOut ? "Terminating Session..." : label}</span>
    </Button>
  );
}
