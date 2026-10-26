"use client";

// "How will you run the bot?" — the bot page handoff shared by the setup checklist's bot step
// and Bot settings' "Run the bot" card. One token, two views (lib/bot-view.ts): a segmented
// choice between the blank widget and the dock, then ONE URL row named for the chosen view and
// that view's own steps, so the owner never has to tell two look-alike masked URLs apart.
// The pick is remembered per browser (localStorage, best-effort); the server render and
// hydration use the default, so they always match. No requests of its own: the caller passes
// the token it already loaded.

import { type ReactNode, useCallback, useId, useState, useSyncExternalStore } from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { EyeOff, PanelRight } from "lucide-react";

import {
  BOT_RUN_MODES,
  DEFAULT_BOT_VIEW,
  botRunMode,
  readBotView,
  writeBotView,
  type BotRunMode,
} from "@/lib/bot-run-modes";
import { browserStorage, noSubscribe } from "@/lib/browser-storage";
import { botPagePath, type BotView } from "@/lib/bot-view";
import { SecretUrlRow } from "@/components/secret-url-row";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS: Record<BotView, ReactNode> = {
  widget: <EyeOff aria-hidden className="size-4" />,
  dock: <PanelRight aria-hidden className="size-4" />,
};

/** The owner's pick: a click wins at once; otherwise the stored pick, else the widget. */
function useBotView(): [BotView, (view: BotView) => void] {
  const [choice, setChoice] = useState<BotView | null>(null);
  // Read on the client only (null during SSR and hydration); never re-read after a click.
  const stored = useSyncExternalStore(
    noSubscribe,
    () => readBotView(browserStorage()),
    () => null,
  );
  const setView = useCallback((view: BotView) => {
    setChoice(view);
    writeBotView(browserStorage(), view);
  }, []);
  return [choice ?? stored ?? DEFAULT_BOT_VIEW, setView];
}

export function BotPageHandoff({
  botToken,
  reset,
  renderAction,
}: {
  /** The bot page token; null keeps the URL row masked with its actions off. */
  botToken: string | null;
  /** The URL row's Reset (the card only; the checklist hands the URL off without one). */
  reset?: { onRegenerate: () => void; regenerating: boolean; description: string };
  /** Rendered under the URL row for the chosen view (the card's Open button). */
  renderAction?: (path: string | null, mode: BotRunMode) => ReactNode;
}) {
  const [view, setView] = useBotView();
  const mode = botRunMode(view);
  const path = botToken ? botPagePath(botToken, view) : null;
  const baseId = useId();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p id={`${baseId}-question`} className="text-sm font-medium">
          How will you run the bot?
        </p>
        <RadioGroup
          aria-labelledby={`${baseId}-question`}
          value={view}
          onValueChange={(value) => setView(value as BotView)}
          className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
        >
          {BOT_RUN_MODES.map((option) => (
            <Radio.Root
              key={option.view}
              value={option.view}
              aria-labelledby={`${baseId}-${option.view}-title`}
              aria-describedby={`${baseId}-${option.view}-hint`}
              className="group flex min-w-0 cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 data-checked:border-input data-checked:bg-background data-checked:text-foreground motion-reduce:transition-none"
            >
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground group-data-checked:text-link">
                  {ICONS[option.view]}
                </span>
                <span id={`${baseId}-${option.view}-title`} className="text-sm font-medium">
                  {option.title}
                </span>
              </span>
              <span id={`${baseId}-${option.view}-hint`} className="text-xs text-muted-foreground">
                {option.hint}
              </span>
            </Radio.Root>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{mode.urlLabel} URL</p>
        {/* Keyed on the view: a switch mounts a fresh, masked row (a changed path would
            otherwise read as a reset and flash the new URL into view). */}
        <SecretUrlRow
          key={view}
          label={mode.urlLabel}
          path={path}
          onRegenerate={reset?.onRegenerate}
          regenerating={reset?.regenerating}
          resetTitle="Reset both bot page URLs?"
          resetDescription={reset?.description}
        />
      </div>

      {renderAction?.(path, mode)}

      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground marker:text-xs">
        {mode.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        Run one or the other, not both: every open bot page relays each chat command.
        {reset && " Reset gives the widget and the dock a new URL together."}
      </p>
    </div>
  );
}

/**
 * The handoff while its token loads, box for box: the question, the two options, the URL row,
 * the action (`withAction`, the card's Open button), the steps and the footnote.
 */
export function BotPageHandoffSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      {withAction && <Skeleton className="h-7 w-28" />}
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
