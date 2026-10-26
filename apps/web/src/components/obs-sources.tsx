"use client";

// Dashboard "OBS sources": both overlay URLs in one place, under the timer controls, with a
// Timer / Tasks tab each. A tab holds the masked URL row (Show / Copy / Reset), the
// recommended browser-source size and a Live preview toggle. Only the selected tab's panel is
// mounted. The selected tab and the preview switch live in the timer console
// (`useObsPreview`, dashboard.tsx), because from `lg` the preview opens as the console's own
// right-hand column (`ObsPreviewColumn`) and the other columns narrow to make room; below
// `lg` it stays inline under the URL row. Either way exactly one preview iframe exists, and
// only while the switch is on: a preview is a live overlay that polls the api on the overlay
// cadence for as long as it is shown.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsoleRule } from "@/components/console-rule";
import { SecretUrlRow } from "@/components/secret-url-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { overlayPath } from "@/lib/overlay-view";
import { type Size, TASKS_SOURCE, TIMER_SOURCE_FALLBACK } from "@/lib/preview-session";
import { describeTrpcError } from "@/lib/trpc-errors";
import { LG_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
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

/** The selected tab and the preview switch, shared by `ObsSources` and the side column. */
export interface ObsPreviewState {
  tab: OverlayKind;
  setTab: (tab: OverlayKind) => void;
  preview: boolean;
  setPreview: (on: boolean) => void;
  /** From `lg` the preview is the console's right-hand column, not inline. */
  side: boolean;
}

/**
 * State for the timer console's OBS sources. The preview starts off and is one switch for
 * both tabs, so switching tabs while it is on swaps the overlay shown (never two iframes).
 */
export function useObsPreview(): ObsPreviewState {
  const [tab, setTab] = useState<OverlayKind>("timer");
  const [preview, setPreview] = useState(false);
  const side = useMediaQuery(LG_MEDIA_QUERY);
  return { tab, setTab, preview, setPreview, side };
}

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

/** The overlay page in a stage at its OBS source's aspect ratio (1 / 1, 7 / 8). */
function PreviewStage({ kind, src }: { kind: OverlayKind; src: string }) {
  const { tab, source } = SOURCES.find((s) => s.kind === kind) ?? SOURCES[0];
  return (
    <div
      className="panel-inset bg-grain relative w-full overflow-hidden"
      style={{ aspectRatio: `${source.width} / ${source.height}` }}
    >
      <iframe
        src={src}
        title={`${tab} overlay preview`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ border: "none", background: "transparent" }}
      />
    </div>
  );
}

/** Both overlay URLs from `user.me` (the page's batch filled the cache; never fetches). */
function useOverlayPaths(): Record<OverlayKind, string | null> {
  const me = useQuery(trpc.user.me.queryOptions());
  return {
    timer: overlayPath("timer", me.data?.overlayTimerToken),
    tasks: overlayPath("tasks", me.data?.overlayTasksToken),
  };
}

/**
 * The "OBS sources" block: an `h3` rule over the Timer / Tasks tabs. The URLs come from
 * `user.me`; until it lands each row stays masked and disabled at the same size.
 */
export function ObsSources({ state }: { state: ObsPreviewState }) {
  const { tab: selected, setTab, preview, setPreview, side } = state;
  const queryClient = useQueryClient();
  const paths = useOverlayPaths();

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

  return (
    <section aria-labelledby="obs-sources-heading" className="space-y-3">
      <ConsoleRule as="h3" id="obs-sources-heading" label="OBS sources" />
      <Tabs
        value={selected}
        onValueChange={(value) => setTab(value as OverlayKind)}
        className="gap-3"
      >
        <TabsList aria-label="Overlay" className="w-full">
          {SOURCES.map(({ kind, tab }) => (
            <TabsTrigger key={kind} value={kind}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        {SOURCES.map(({ kind, tab, source, sizeHint }) => {
          const label = `${tab} overlay`;
          const src = paths[kind];
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
                onClick={() => setPreview(!preview)}
                aria-pressed={preview}
                disabled={!src}
                data-obs-preview-toggle
                // Pulled left by its own padding so the label lines up with the hint above.
                className="-ml-2 gap-1.5"
              >
                {preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                Live preview
                <span className="sr-only"> of the {kind} overlay</span>
              </Button>
              {/* Below lg only; from lg the console renders ObsPreviewColumn instead. */}
              {preview && !side && src && <PreviewStage kind={kind} src={src} />}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}

/**
 * The live preview as the timer console's right-hand column (lg and up, while the preview
 * is on): the selected overlay's name, a close button that turns the preview off, and the
 * stage. Mounted only while shown, so its iframe polls only then.
 */
export function ObsPreviewColumn({ state }: { state: ObsPreviewState }) {
  const paths = useOverlayPaths();
  const { tab } = SOURCES.find((s) => s.kind === state.tab) ?? SOURCES[0];
  const src = paths[state.tab];
  return (
    <aside aria-label="Live preview" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="console-label">{tab} overlay</h3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            state.setPreview(false);
            // The close button unmounts with the column: hand focus back to the switch.
            document.querySelector<HTMLElement>("[data-obs-preview-toggle]")?.focus();
          }}
          aria-label="Close live preview"
        >
          <X />
        </Button>
      </div>
      {src && <PreviewStage kind={state.tab} src={src} />}
    </aside>
  );
}
