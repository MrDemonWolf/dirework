"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useOrigin } from "@/lib/use-origin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A secret, token-bearing URL (overlay or bot page): masked by default with a
 * visible fingerprint, plus Show / Copy / Reset. `path` is null until the
 * token has loaded; the row then stays masked and its actions are disabled.
 */
export function SecretUrlRow({
  label,
  path,
  onRegenerate,
  regenerating,
  resetDescription,
}: {
  label: string;
  path: string | null;
  onRegenerate: () => void;
  regenerating: boolean;
  /** What breaks when the URL is reset, shown in the confirm dialog. */
  resetDescription: string;
}) {
  const origin = useOrigin();
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevPath = useRef(path);

  // A changed token used to be invisible behind the mask — regen looked
  // broken. Now the row reveals the fresh URL and flashes to prove it changed.
  useEffect(() => {
    if (prevPath.current === path) return;
    const hadPath = prevPath.current !== null;
    prevPath.current = path;
    // The first load (null → path) is not a reset.
    if (!hadPath || path === null) return;
    setRevealed(true);
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(timer);
  }, [path]);

  const ready = path !== null;
  const shown = revealed && ready;
  // Show the full origin-prefixed URL — what the user pastes into OBS.
  const fullUrl = path === null ? "" : origin ? `${origin}${path}` : path;
  // Last 6 chars of the token stay visible while masked, so the current
  // token is identifiable (and visibly different after a regenerate).
  const fingerprint = path === null ? "" : path.slice(-6);

  const copyUrl = async () => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — click Show, then copy the URL yourself");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        readOnly
        value={shown ? fullUrl : `${"•".repeat(34)}${fingerprint}`}
        className={`panel-inset h-9 min-w-0 flex-1 truncate px-3 font-mono text-base transition-shadow md:text-sm ${
          flash ? "ring-2 ring-success" : ""
        }`}
        aria-hidden={shown ? undefined : true}
        tabIndex={shown ? undefined : -1}
        aria-label={shown ? `${label} URL` : undefined}
      />
      {!shown && <span className="sr-only">{`${label} URL hidden — press Show to reveal`}</span>}
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => setRevealed((v) => !v)}
        disabled={!ready}
        aria-pressed={shown}
        aria-label={`Show ${label} URL`}
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        onClick={copyUrl}
        disabled={!ready}
        aria-label={`Copy ${label} URL`}
      >
        <Copy className="size-3.5" />
      </Button>
      <div aria-hidden className="mx-1 w-px self-stretch bg-border/40" />
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex">
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={regenerating || !ready}
                    aria-label={`Reset ${label} URL`}
                  >
                    <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                  </Button>
                }
                title={`Reset the ${label.toLowerCase()} URL?`}
                description={resetDescription}
                confirmLabel="Reset URL"
                onConfirm={onRegenerate}
              />
            </span>
          }
        />
        <TooltipContent>Reset URL — the current one stops working</TooltipContent>
      </Tooltip>
    </div>
  );
}
