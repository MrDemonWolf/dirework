"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer } from "lucide-react";
import { Authenticated } from "convex/react";

import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const navLinks = [
  { href: "/dashboard", label: "General" },
  { href: "/dashboard/timer", label: "Timer" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/styles", label: "Styles" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/commands", label: "Commands" },
  { href: "/dashboard/overlays", label: "Overlays" },
  { href: "/dashboard/analytics", label: "Analytics" },
] as const;

export default function Header() {
  const pathname = usePathname();

  // Don't show nav on login page or overlay pages
  const isLoginPage = pathname === "/";
  const isOverlayPage = pathname.startsWith("/overlay");
  if (isLoginPage || isOverlayPage) return null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        {/* Logo */}
        <Link href="/dashboard" className="mr-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Timer className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Dirework</span>
        </Link>

        {/* Nav Links */}
        <Authenticated>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navLinks.map(({ href, label }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle & User Menu */}
          <div className="ml-4 flex shrink-0 items-center gap-1">
            <ModeToggle />
            <UserMenu />
          </div>
        </Authenticated>
      </div>
    </header>
  );
}
