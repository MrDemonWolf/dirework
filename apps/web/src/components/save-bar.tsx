"use client";

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
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-40 animate-[console-rise_0.25s_cubic-bezier(0.22,1,0.36,1)_both] border-t border-border/40 bg-background/80 backdrop-blur-2xl"
    >
      <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <StatusChip tone="warn" label={label} />
        <div className="flex items-center gap-2">
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={saving}>
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            }
            title="Discard unsaved changes?"
            description="All edits since your last save will be reverted. This cannot be undone."
            confirmLabel="Discard changes"
            onConfirm={onReset}
          />
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
