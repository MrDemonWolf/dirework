"use client";

// The signed-in owner's account dropdown in the header: Docs and Report a problem (both open
// in a new tab), then Sign out. The dashboard links live in the header nav (and its phone
// menu), so the menu does not repeat them. UserMenu loads this module with next/dynamic and
// renders it only with a session, so signed-out pages (`/`, `/setup`) never download Base UI
// Menu or floating-ui.

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Bug, ChevronDown, ExternalLink, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountLinks } from "@/lib/landing-links";
import { loadAuthClient } from "@/lib/load-auth-client";
import type { ServerSession } from "@/lib/server-session";
import { confirmDiscardIfDirty } from "@/lib/unsaved-changes";

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

/** Trailing "leaves DireWork" mark, plus the same warning for screen readers. */
function OpensInNewTab() {
  return (
    <>
      <ExternalLink aria-hidden className="ml-auto size-3.5 text-muted-foreground" />
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}

/**
 * Avatar trigger + dropdown for a signed-in session. `links` comes from the (app) layout
 * (`landingLinks(process.env.DOCS_URL)`), so Docs points at this deploy's docs.
 */
export default function AccountMenu({
  session,
  links,
}: {
  session: ServerSession;
  links: AccountLinks;
}) {
  const router = useRouter();

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
      {/* Sized to its rows (the primitive defaults to the trigger's width), never narrower
          than min-w-48 so the rows don't crowd the trailing icons. */}
      <DropdownMenuContent className="w-auto min-w-48" align="end">
        <DropdownMenuItem
          render={<a href={links.docs} target="_blank" rel="noopener noreferrer" />}
        >
          <BookOpen className="size-3.5" />
          Docs
          <OpensInNewTab />
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={links.reportProblem} target="_blank" rel="noopener noreferrer" />}
        >
          <Bug className="size-3.5" />
          Report a problem
          <OpensInNewTab />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Neutral, not destructive: signing out deletes nothing. */}
        <DropdownMenuItem
          onClick={() => {
            // Signing out leaves the page, so an open editor with unsaved
            // edits gets the same discard confirmation as navigation.
            confirmDiscardIfDirty(() => {
              void loadAuthClient().then((auth) =>
                auth?.authClient.signOut({
                  fetchOptions: {
                    // The header's session comes from the server layout, so
                    // refresh it as well as leaving the page.
                    onSuccess: () => {
                      startTransition(() => {
                        router.push("/");
                        router.refresh();
                      });
                    },
                  },
                }),
              );
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
