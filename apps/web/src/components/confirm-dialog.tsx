"use client";

import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Shared destructive-action confirm (audit M7). Every irreversible action —
 * token regenerate, bot disconnect, timer stop/reset, clear all/done — routes
 * through this dialog instead of firing silently.
 *
 * Render either with a `trigger` element (uncontrolled) or drive it with
 * `open`/`onOpenChange` (controlled).
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  confirmDisabled,
}: {
  trigger?: ReactElement<Record<string, unknown>>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger != null && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" size="sm" />}>
            {cancelLabel}
          </AlertDialogClose>
          <AlertDialogClose
            render={
              <Button
                variant={destructive ? "destructive" : "default"}
                size="sm"
                disabled={confirmDisabled}
                onClick={onConfirm}
              />
            }
          >
            {confirmLabel}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
