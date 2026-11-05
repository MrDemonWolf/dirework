// The app's 404: every unmatched URL (Next's prerendered /_not-found) and any notFound()
// without a closer boundary. For an unmatched URL it renders inside the root layout only, with
// no (app) header or footer, so it brings its own <main> and one way home. (A notFound() thrown
// inside the (app) group, i.e. a claimed /setup, renders it inside the (app) shell instead.)
//
// Static on purpose: no headers(), cookies() or session read, so /_not-found stays
// prerendered and a 404 costs one Worker invocation and no api request. The home link never
// prefetches, because a prefetch of `/` renders the (app) layout, whose session check is an
// api request.
//
// A truncated OBS URL (`/overlay/t` with no token) lands here too, without the (overlay)
// layout's transparent override. lib/theme-init.ts marks those paths
// data-surface="overlay" before first paint, index.css keeps their canvas and body
// transparent, and `on-overlay:hidden` drops this content, so OBS composites nothing.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PAGE_TITLE_CLASS } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

// One <title> through the root layout's "%s | DireWork" template.
export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center on-overlay:hidden">
      <h1 className={PAGE_TITLE_CLASS}>Page not found</h1>
      <p className="mt-3 max-w-md text-pretty text-muted-foreground">
        The link may have a typo, or the page no longer exists.
      </p>
      {/* A real link styled as a ghost button (button.md): Base UI's Button with
          nativeButton={false} would announce it as a button. The link color is its cue at
          rest, since a lone ghost button has no border or fill until hover. */}
      <Link
        href="/"
        prefetch={false}
        className={buttonVariants({ variant: "ghost", className: "mt-6 text-link" })}
      >
        <ArrowLeft data-icon="inline-start" aria-hidden />
        Back to home
      </Link>
    </main>
  );
}
