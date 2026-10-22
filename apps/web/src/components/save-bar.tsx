"use client";

// Sticky "unsaved changes" bar shared by the Theme Center and bot settings editors.

import { Loader2, RotateCcw, Save } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";

/**
 * Shared sticky save bar — rises from the bottom edge when a page has
 * unsaved changes. The warn chip carries the LED dirty-state semantics;
 * pages keep their own conditional bottom padding (pb-24) while visible.
 */
export function SaveBar({
  visible,
  saving,
  onSave,
  onReset,
  label = "Unsaved changes",
  saveHint,
  blockedReason,
  onBlockedReasonClick,
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  label?: string;
  /** What Save does, beside the button and as its description (e.g. where the change goes live). */
  saveHint?: string;
  /** Why Save is unavailable (a field the server would reject); disables Save while set. */
  blockedReason?: string | null;
  /** When set, the blocked reason is a button that takes the owner to the field at fault. */
  onBlockedReasonClick?: () => void;
}) {
  return (
    <>
      {/* Always mounted, so screen readers announce the change of state; the
          bar itself holds buttons and must not be a live region. */}
      <div role="status" aria-live="polite" className="sr-only">
        {visible ? label : ""}
      </div>
      {visible && (
        <SaveBarPanel
          saving={saving}
          onSave={onSave}
          onReset={onReset}
          label={label}
          saveHint={saveHint ?? null}
          blockedReason={blockedReason ?? null}
          onBlockedReasonClick={onBlockedReasonClick}
        />
      )}
    </>
  );
}

/** The visible bar; mounted only while `visible`, so its enter animation replays each time. */
function SaveBarPanel({
  saving,
  onSave,
  onReset,
  label,
  saveHint,
  blockedReason,
  onBlockedReasonClick,
}: {
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  label: string;
  saveHint: string | null;
  blockedReason: string | null;
  onBlockedReasonClick?: () => void;
}) {
  // The blocked reason wins: it is why Save is disabled. The hint stays in the
  // accessible description even where it is hidden on narrow screens.
  const describedBy = blockedReason ? "save-bar-blocked" : saveHint ? "save-bar-hint" : undefined;
  return (
    <div
      data-save-bar
      className="fixed inset-x-0 bottom-0 z-(--z-save-bar) save-bar-enter border-t border-border/40 bg-background/80 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] backdrop-blur-2xl"
    >
      <div className="container mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusChip tone="warn" label={label} />
          {blockedReason &&
            (onBlockedReasonClick ? (
              // Takes the owner to the field at fault (the page switches tab and focuses it).
              <button
                id="save-bar-blocked"
                type="button"
                onClick={onBlockedReasonClick}
                className="truncate rounded text-left text-xs text-destructive underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {blockedReason}
              </button>
            ) : (
              <p id="save-bar-blocked" className="truncate text-xs text-destructive">
                {blockedReason}
              </p>
            ))}
        </div>
        <div className="flex items-center gap-2">
          {saveHint && !blockedReason && (
            <p id="save-bar-hint" className="mr-1 hidden text-xs text-muted-foreground md:block">
              {saveHint}
            </p>
          )}
          {/* Reset discards edits, so it confirms first (destructive-action rule). */}
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={saving}>
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            }
            title="Discard unsaved changes?"
            description="Every edit since your last save is discarded. This can't be undone."
            confirmLabel="Discard changes"
            onConfirm={onReset}
          />
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || Boolean(blockedReason)}
            aria-describedby={describedBy}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
