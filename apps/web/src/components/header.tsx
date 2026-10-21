"use client";

// Sticky top bar for the (app) route group (rendered by app/(app)/layout.tsx): logo, the
// dashboard nav (desktop links + mobile dropdown), theme toggle, and the account menu.

import { useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, type LucideIcon, Menu, Palette, X } from "lucide-react";

import type { ServerSession } from "@/lib/server-session";
import { cn } from "@/lib/utils";
import { closeOnRouteChange, type MobileMenuState, onEscape } from "@/lib/mobile-menu";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

/** Dashboard sections, in nav order. `as const` hrefs keep them valid typed routes. */
const navItems = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/styles" as const, label: "Theme Center", icon: Palette },
  { href: "/dashboard/bot" as const, label: "Bot", icon: Bot },
];

/**
 * Nav item icon. Pulses while its link's navigation is pending (`useLinkStatus`, so it must
 * render inside the Link), giving the click feedback the moment it happens rather than after
 * the next page's server round trip. The pulse starts at full opacity, so a navigation that
 * finishes in under ~100ms never shows it.
 */
function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return <Icon className={cn("size-4", pending && "animate-led-pulse")} />;
}

/**
 * Site header. `session` is the (app) layout's server session (type-only import, so
 * next/headers never reaches the client bundle): the nav is in the server HTML instead of
 * appearing after a client session fetch, and sign-out refreshes the layout. The nav is
 * navigation, not access control — the pages call `requireSession()` and the API's
 * `ownerProcedure` does the real authorization.
 */
export default function Header({ session }: { session: ServerSession | null }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState<MobileMenuState>({ open: false, pathname });
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // A route change closes the menu. Adjusted during render (the reducer returns the
  // same object when the path is unchanged), so React re-renders before committing
  // and the stale open menu never paints on the new route.
  const routed = closeOnRouteChange(menu, pathname);
  if (routed !== menu) setMenu(routed);
  const mobileMenuOpen = routed.open;
  const setMenuOpen = (open: boolean) => setMenu((m) => ({ ...m, open }));

  // Escape (never mid-IME-composition) closes the open menu and hands focus back to
  // the hamburger, so a keyboard user is never left on a link that just disappeared.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    return onEscape(document, () => {
      setMenu((m) => ({ ...m, open: false }));
      menuButtonRef.current?.focus();
    });
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] backdrop-blur-2xl backdrop-saturate-150">
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
              <title>DireWork logo</title>
              <path d="M14 30L20 8l10 18" />
              <path d="M50 30L44 8l-10 18" />
              <path d="M12 30c-1 10 4 18 12 22l8 6 8-6c8-4 13-12 12-22" />
              <circle cx="23" cy="36" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="41" cy="36" r="2.5" fill="currentColor" stroke="none" />
              <path d="M28 46l4 4 4-4" />
              <circle cx="32" cy="24" r="7" strokeWidth="2.5" />
              <line x1="32" y1="24" x2="32" y2="19" strokeWidth="2.5" />
              <line x1="32" y1="24" x2="36" y2="24" strokeWidth="2.5" />
            </svg>
            DireWork
          </Link>

          {/* Desktop nav */}
          {session && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                // "/dashboard" must match exactly: every other item is nested under it.
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
                    <NavIcon icon={item.icon} />
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
          <UserMenu session={session} />
          {/* Mobile hamburger */}
          {session && (
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              // The ::after inset enlarges the touch target past the visible icon button.
              className="relative after:absolute after:-inset-1.5 md:hidden"
              onClick={() => setMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {session && mobileMenuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="save-bar-enter border-t border-border/40 bg-background/80 backdrop-blur-2xl md:hidden"
        >
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
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <NavIcon icon={item.icon} />
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
