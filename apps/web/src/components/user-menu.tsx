"use client";

// Header account control: a Twitch sign-in button when signed out, otherwise an
// avatar dropdown with the dashboard links and sign-out.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, ChevronDown, LayoutDashboard, LogOut, Palette } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient, signInWithTwitch } from "@/lib/auth-client";
import { confirmDiscardIfDirty } from "@/lib/unsaved-changes";
import { TwitchIcon } from "@/components/icons/twitch-icon";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

/** Dashboard destinations listed in the dropdown, in display order. */
const menuLinks = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/styles" as const, label: "Theme Center", icon: Palette },
  { href: "/dashboard/bot" as const, label: "Bot", icon: Bot },
];

/** Round avatar image, or the name's first letter when there is no image. */
function Avatar({
  image,
  name,
  className,
}: {
  image?: string | null;
  name: string;
  className: string;
}) {
  return image ? (
    // biome-ignore lint/performance/noImgElement: Twitch-CDN avatar — next/image would need remotePatterns plus the Workers image optimizer; a plain img with no-referrer is smaller and safer.
    <img src={image} alt="" className={`${className} rounded-full`} referrerPolicy="no-referrer" />
  ) : (
    // The initial is drawn by CSS, not a text node: axe (WCAG 2.5.3) counts visible text,
    // even under aria-hidden, as the trigger's visible label, so a "D" here would not match
    // its aria-label. The letter is decorative; the name beside it is the real label.
    <div
      aria-hidden
      data-initial={name?.charAt(0).toUpperCase()}
      className={`${className} flex items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground before:content-[attr(data-initial)]`}
    />
  );
}

/**
 * Session-aware account menu. Renders a skeleton while the session loads, so
 * the header never flashes the sign-in button for a signed-in owner.
 */
export default function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!session) {
    return (
      <Button
        className="bg-twitch text-white hover:bg-twitch-hover"
        // A failed or refused sign-in returns to a page that renders the error
        // callout: /setup when starting there, otherwise the home page.
        onClick={() => signInWithTwitch(pathname === "/setup" ? "/setup" : "/")}
      >
        <TwitchIcon className="size-3.5" />
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Account menu — ${session.user.name}`}
            className="flex cursor-pointer items-center gap-2 rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Avatar image={session.user.image} name={session.user.name} className="h-8 w-8" />
        <span className="hidden text-xs font-medium sm:inline">{session.user.name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card" align="end">
        {menuLinks.map((item) => (
          <DropdownMenuItem key={item.href} nativeButton={false} render={<Link href={item.href} />}>
            <item.icon className="size-3.5" />
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            // Signing out leaves the page, so an open editor with unsaved
            // edits gets the same discard confirmation as navigation.
            confirmDiscardIfDirty(() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            });
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
