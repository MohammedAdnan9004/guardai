"use client";

import * as React from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EffectiveRole } from "@/lib/auth/types";

const NAV_LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#workflow", label: "How it works" },
  { href: "#rbac", label: "RBAC & RLS" },
];

interface SiteHeaderProps {
  isAuthenticated: boolean;
  userRole: EffectiveRole | null;
}

export function SiteHeader({ isAuthenticated, userRole }: SiteHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  const consoleHref =
    userRole === "super_admin" ? "/super-admin" : "/dashboard";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6">
      <motion.div
        initial={false}
        animate={{
          maxWidth: scrolled ? "62rem" : "76rem",
          paddingTop: scrolled ? "0.5rem" : "0.75rem",
          paddingBottom: scrolled ? "0.5rem" : "0.75rem",
        }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mx-auto flex items-center gap-4 rounded-2xl px-4 transition-colors duration-300",
          scrolled
            ? "glass shadow-lg shadow-black/5"
            : "border border-transparent"
        )}
      >
        <BrandLogo />

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle compact />

          {isAuthenticated ? (
            <Button
              asChild
              size="sm"
              className="h-8 rounded-lg bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-primary/20 hover:brightness-110"
            >
              <Link href={consoleHref}>
                <span>Open Console</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden h-8 rounded-lg sm:inline-flex"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="h-8 rounded-lg bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-primary/20 hover:brightness-110"
              >
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="glass mx-auto mt-2 max-w-3xl overflow-hidden rounded-2xl p-2 md:hidden"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            {!isAuthenticated && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground sm:hidden"
              >
                Sign in
              </Link>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
