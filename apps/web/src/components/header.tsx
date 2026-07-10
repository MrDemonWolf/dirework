"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, Menu, Palette, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const navItems = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/styles" as const, label: "Theme Center", icon: Palette },
  { href: "/dashboard/bot" as const, label: "Bot", icon: Bot },
];

export default function Header() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <path d="M14 30L20 8l10 18"/>
              <path d="M50 30L44 8l-10 18"/>
              <path d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22"/>
              <circle cx="23" cy="36" r="2.5" fill="currentColor" stroke="none"/>
              <circle cx="41" cy="36" r="2.5" fill="currentColor" stroke="none"/>
              <path d="M28 46l4 4 4-4"/>
              <circle cx="32" cy="24" r="7" strokeWidth="2.5"/>
              <line x1="32" y1="24" x2="32" y2="19" strokeWidth="2.5"/>
              <line x1="32" y1="24" x2="36" y2="24" strokeWidth="2.5"/>
            </svg>
            DireWork
          </Link>

          {/* Desktop nav */}
          {session && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          {/* UserMenu renders its own signed-out Twitch sign-in button, so the
              sticky header always offers an entry point — not just the hero CTA. */}
          <UserMenu />
          {/* Mobile hamburger */}
          {session && (
            <Button
              variant="ghost"
              size="icon"
              className="relative after:absolute after:-inset-1.5 md:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {session && mobileMenuOpen && (
        <nav className="animate-[console-rise_0.2s_cubic-bezier(0.22,1,0.36,1)_both] border-t border-border/40 bg-background/80 backdrop-blur-2xl md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
