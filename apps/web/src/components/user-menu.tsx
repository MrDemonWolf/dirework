"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronDown, LayoutDashboard, LogOut, Palette } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { TwitchIcon } from "@/components/icons/twitch-icon";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

const menuLinks = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/styles" as const, label: "Theme Center", icon: Palette },
  { href: "/dashboard/bot" as const, label: "Bot", icon: Bot },
];

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
    <div
      aria-hidden
      className={`${className} flex items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground`}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!session) {
    return (
      <Button
        className="bg-twitch text-white hover:bg-twitch-hover"
        onClick={() =>
          authClient.signIn.social({
            provider: "twitch",
            callbackURL: "/dashboard",
          })
        }
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
        {/* Identity header — non-interactive */}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar image={session.user.image} name={session.user.name} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{session.user.name}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
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
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/");
                },
              },
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
