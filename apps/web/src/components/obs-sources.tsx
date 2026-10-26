"use client";

// Dashboard "OBS sources": both overlay URLs in one place, under the timer controls, with a
// Timer / Tasks tab each. A tab holds the masked URL row (Show / Copy / Reset), the
// recommended browser-source size and a Live preview toggle. Only the selected tab's panel is
// mounted, and its preview iframe exists only while the toggle is on: a preview is a live
// overlay that polls the api on the overlay cadence for as long as it is shown.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsoleRule } from "@/components/console-rule";
import { SecretUrlRow } from "@/components/secret-url-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { overlayPath } from "@/lib/overlay-view";
import { type Size, TASKS_SOURCE, TIMER_SOURCE_FALLBACK } from "@/lib/preview-session";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

type OverlayKind = "timer" | "tasks";

/**
 * One tab per overlay: its name (the URL row's label is "<tab> overlay") and the recommended
 * OBS source, the same sizes the Theme Center preview draws (lib/preview-session.ts).
 */
const SOURCES = [
  {
    kind: "timer",
    tab: "Timer",
    source: TIMER_SOURCE_FALLBACK,
    sizeHint: "Square OBS browser source — the timer scales to fill it",
  },
  {
    kind: "tasks",
    tab: "Tasks",
    source: TASKS_SOURCE,
    sizeHint: "OBS browser source — the list fills it and scrolls when tasks overflow",
  },
] as const satisfies readonly {
  kind: OverlayKind;
  tab: string;
  source: Size;
  sizeHint: string;
}[];

/** Confirm-dialog body for resetting either overlay URL (the old token stops working). */
const OVERLAY_RESET_DESCRIPTION =
  "The current URL stops working immediately: any OBS browser source still using it goes blank (fully transparent) until you paste the new URL into OBS.";

/** Recommended OBS browser-source dimensions, beside the "add it in OBS" hint. */
function SizeChip({ size, hint }: { size: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Recommended size ${size}: ${hint}`}
            className="shrink-0 cursor-default rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {size}
          </button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The "OBS sources" block: an `h3` rule over the Timer / Tasks tabs. The URLs come from
 * `user.me`; until it lands each row stays masked and disabled at the same size.
 */
export function ObsSources() {
  const queryClient = useQueryClient();
  const me = useQuery(trpc.user.me.queryOptions());
  // Previews start hidden; the choice survives a tab switch, the iframe does not.
  const [previews, setPreviews] = useState<Record<OverlayKind, boolean>>({
    timer: false,
    tasks: false,
  });

  const regenerate = useMutation({
    ...trpc.user.regenerateOverlayToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("New overlay URL ready — paste it into OBS");
    },
    onError: (err) => {
      toast.error(`Couldn't reset the URL: ${describeTrpcError(err)}`);
    },
  });

  const tokens: Record<OverlayKind, string | null | undefined> = {
    timer: me.data?.overlayTimerToken,
    tasks: me.data?.overlayTasksToken,
  };

  return (
    <section aria-labelledby="obs-sources-heading" className="space-y-3">
      <ConsoleRule as="h3" id="obs-sources-heading" label="OBS sources" />
      <Tabs defaultValue="timer" className="gap-3">
        <TabsList aria-label="Overlay" className="w-full">
          {SOURCES.map(({ kind, tab }) => (
            <TabsTrigger key={kind} value={kind}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        {SOURCES.map(({ kind, tab, source, sizeHint }) => {
          const label = `${tab} overlay`;
          const src = overlayPath(kind, tokens[kind]);
          const show = previews[kind];
          return (
            <TabsContent key={kind} value={kind} className="space-y-2.5">
              <SecretUrlRow
                label={label}
                path={src}
                onRegenerate={() => regenerate.mutate({ type: kind })}
                regenerating={regenerate.isPending && regenerate.variables?.type === kind}
                resetDescription={OVERLAY_RESET_DESCRIPTION}
              />
              {/* Wraps under the hint on a 320px phone rather than squeezing it. */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-xs text-muted-foreground">
                  Add the URL as a browser source in OBS
                </p>
                <SizeChip size={`${source.width} × ${source.height}`} hint={sizeHint} />
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPreviews((prev) => ({ ...prev, [kind]: !show }))}
                aria-pressed={show}
                disabled={!src}
                // Pulled left by its own padding so the label lines up with the hint above.
                className="-ml-2 gap-1.5"
              >
                {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                Live preview
                <span className="sr-only"> of the {kind} overlay</span>
              </Button>
              {show && src && (
                <div
                  className="panel-inset bg-grain relative w-full overflow-hidden"
                  style={{ aspectRatio: `${source.width} / ${source.height}` }}
                >
                  <iframe
                    src={src}
                    title={`${label} preview`}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    style={{ border: "none", background: "transparent" }}
                  />
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
