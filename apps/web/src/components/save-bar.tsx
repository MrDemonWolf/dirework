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
  blockedReason,
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  label?: string;
  /** Why Save is unavailable (a field the server would reject); disables Save while set. */
  blockedReason?: string | null;
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
          blockedReason={blockedReason ?? null}
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
  blockedReason,
}: {
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  label: string;
  blockedReason: string | null;
}) {
  return (
    <div
      data-save-bar
      className="fixed inset-x-0 bottom-0 z-(--z-save-bar) save-bar-enter border-t border-border/40 bg-background/80 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] backdrop-blur-2xl"
    >
      <div className="container mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <StatusChip tone="warn" label={label} />
          {blockedReason && (
            <p id="save-bar-blocked" className="truncate text-xs text-destructive">
              {blockedReason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            aria-describedby={blockedReason ? "save-bar-blocked" : undefined}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
