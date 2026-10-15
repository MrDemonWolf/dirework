"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { registerDiscardConfirm } from "@/lib/unsaved-changes";

/** Marks the history entry the guard pushes so it can tell it apart from real ones. */
const SENTINEL_KEY = "__direworkUnsavedGuard";

interface PendingLeave {
  proceed: () => void;
  cancel?: () => void;
}

function isSentinelEntry(): boolean {
  return Boolean((window.history.state as Record<string, unknown> | null)?.[SENTINEL_KEY]);
}

function pushSentinel() {
  window.history.pushState(
    { ...(window.history.state as Record<string, unknown> | null), [SENTINEL_KEY]: true },
    "",
    window.location.href,
  );
}

/**
 * Unsaved-changes guard (audit M8).
 *
 * While `dirty` is true:
 * - `beforeunload` warns on tab close / hard refresh / external nav.
 * - In-app link clicks (Next `<Link>` renders plain anchors) are intercepted
 *   in the capture phase and routed through a confirm dialog instead of
 *   silently discarding the user's edits.
 * - Browser Back is intercepted: a same-URL sentinel history entry absorbs the
 *   first Back, and its popstate is stopped before Next's router sees it.
 * - Actions outside links (Sign out) reach the same dialog through
 *   `confirmDiscardIfDirty` from `lib/unsaved-changes`.
 *
 * Render it once on any page with a dirty working state.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave | null>(null);
  // The confirm button also closes the dialog; this tells that close apart from "Stay".
  const confirmedRef = useRef<PendingLeave | null>(null);

  useEffect(() => {
    if (!dirty) return;

    let leaving = false;
    // The sentinel is pushed with this same URL, so popping it lands here.
    const guardedUrl = window.location.href;
    // True while the current entry is our sentinel; only popping it is a real leave.
    let onSentinel = false;
    const armSentinel = () => {
      pushSentinel();
      onSentinel = true;
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set for the native prompt
      e.returnValue = "";
    };

    const handleClickCapture = (e: MouseEvent) => {
      // Respect modified clicks (new tab etc.) and non-primary buttons
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href?.startsWith("/")) return; // external links hit beforeunload
      if (href === window.location.pathname + window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      setPending({
        proceed: () => {
          leaving = true;
          // Replace the sentinel rather than stacking the new page on top of it.
          if (isSentinelEntry()) router.replace(href as Route);
          else router.push(href as Route);
        },
      });
    };

    // Capture phase on window runs before Next's own (bubble) popstate listener.
    const handlePopStateCapture = (e: PopStateEvent) => {
      if (leaving) return;
      if (isSentinelEntry()) {
        onSentinel = true;
        return;
      }
      // Fragment navigations (e.g. the skip link) also fire popstate, with no
      // router state; so does a second Back while the dialog is already open.
      // A URL other than the guarded one means the flag went stale (e.g. the
      // previous guard's cleanup popped the sentinel): fail open and let Next
      // navigate, never strand the URL bar on another page over this editor.
      if (!onSentinel || e.state == null || window.location.href !== guardedUrl) {
        onSentinel = false;
        return;
      }
      // The sentinel was just popped: we're back on this page's real entry.
      onSentinel = false;
      e.stopImmediatePropagation();
      setPending({
        proceed: () => {
          leaving = true;
          window.history.back();
        },
        cancel: armSentinel,
      });
    };

    if (isSentinelEntry()) onSentinel = true;
    else armSentinel();
    const unregister = registerDiscardConfirm((proceed) =>
      setPending({
        proceed: () => {
          leaving = true;
          proceed();
        },
      }),
    );
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClickCapture, true);
    window.addEventListener("popstate", handlePopStateCapture, true);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("popstate", handlePopStateCapture, true);
      // Saved (or reset) while the sentinel is still current: drop it so the next
      // Back isn't a silent same-URL no-op. Its popstate is swallowed for Next.
      if (!leaving && isSentinelEntry()) {
        const swallow = (e: PopStateEvent) => e.stopImmediatePropagation();
        window.addEventListener("popstate", swallow, { capture: true, once: true });
        window.history.back();
      }
    };
  }, [dirty, router]);

  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (open) return;
        const closed = pending;
        setPending(null);
        // Deferred: the confirm click's own handler may run after this one.
        queueMicrotask(() => {
          if (confirmedRef.current !== closed) closed?.cancel?.();
        });
      }}
      title="Discard unsaved changes?"
      description="You have edits that haven't been saved yet. If you leave this page now, they'll be lost."
      confirmLabel="Discard and leave"
      cancelLabel="Stay"
      onConfirm={() => {
        const leave = pending;
        confirmedRef.current = leave;
        setPending(null);
        leave?.proceed();
      }}
    />
  );
}
