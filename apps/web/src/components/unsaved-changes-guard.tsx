"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Unsaved-changes guard (audit M8).
 *
 * While `dirty` is true:
 * - `beforeunload` warns on tab close / hard refresh / external nav.
 * - In-app link clicks (Next `<Link>` renders plain anchors) are intercepted
 *   in the capture phase and routed through a confirm dialog instead of
 *   silently discarding the user's edits.
 *
 * Render it once on any page with a dirty working state.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

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
      setPendingHref(href);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) setPendingHref(null);
      }}
      title="Discard unsaved changes?"
      description="You have edits that haven't been saved yet. If you leave this page now, they'll be lost."
      confirmLabel="Discard and leave"
      cancelLabel="Stay"
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href as Route);
      }}
    />
  );
}
