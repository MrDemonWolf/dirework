"use client";

// "Set up streaming" — the dashboard's first-run checklist. Step 1 (bot account) is read
// from `user.me`; steps 2-4 are explicit owner confirmations ("I added it to OBS"), never
// detected from overlay or bot-page traffic. Costs: no polling and no queries of its own
// beyond the bot page URL (`bot.getIngestInfo`), which loads only while that step is open.
// A confirm is one UPDATE; its result is patched into the `user.me` cache, never refetched.

import {
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Palette } from "lucide-react";
import { toast } from "sonner";

import type { SetupStep } from "@dirework/api/routers/input-schemas";

import { cn } from "@/lib/utils";
import { overlayPath } from "@/lib/overlay-view";
import {
  captureAllDoneAtLoad,
  SETUP_STEPS,
  STEP_STATE_LABELS,
  isSetupCollapsed,
  readSetupCollapsed,
  setupProgress,
  stepState,
  withSetupStep,
  writeSetupCollapsed,
  type SetupSource,
  type SetupStepId,
  type SetupStepState,
  type SetupStorage,
} from "@/lib/setup-steps";
import { describeTrpcError } from "@/lib/trpc-errors";
import { ConsoleRule } from "@/components/console-rule";
import { QueryError } from "@/components/query-error";
import { SecretUrlRow } from "@/components/secret-url-row";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

/** The `user.me` fields the checklist reads (overlay tokens build the URLs it hands off). */
export interface SetupMe extends SetupSource {
  botAccount: { displayName: string } | null;
  overlayTimerToken: string | null;
  overlayTasksToken: string | null;
}

// ── "Finish later" persistence ──────────────────────────────────────────────
// Component state is the source of truth for this page; localStorage only carries the
// choice to the next load (read on mount, written best-effort). The server render (no
// storage) uses the default, so hydration always matches.

/** `window.localStorage`, or null where even touching it throws (blocked site data). */
function browserStorage(): SetupStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

/**
 * Collapsed state of the checklist, shared by the card and the header's "Setup" button.
 * A click sets it immediately, even when storage is blocked. With no choice yet the card
 * starts collapsed only if every step was already done when the dashboard loaded —
 * finishing the last step in this visit keeps it open.
 */
export function useSetupCollapsed(
  allDone: boolean | undefined,
): [boolean, (collapsed: boolean) => void] {
  // `allDone` is undefined until `user.me` loads; the default is decided from the first
  // loaded value (adjusted during render, so there is no extra commit).
  const [capturedAllDone, setCapturedAllDone] = useState(allDone);
  const allDoneAtLoad = captureAllDoneAtLoad(capturedAllDone, allDone);
  if (allDoneAtLoad !== capturedAllDone) setCapturedAllDone(allDoneAtLoad);
  const [choice, setChoice] = useState<boolean | null>(null);
  // Read on the client only (null during SSR and hydration); never re-read after a click.
  const stored = useSyncExternalStore(
    noSubscribe,
    () => readSetupCollapsed(browserStorage()),
    () => null,
  );
  const setCollapsed = useCallback((collapsed: boolean) => {
    setChoice(collapsed);
    writeSetupCollapsed(browserStorage(), collapsed);
  }, []);
  return [choice ?? isSetupCollapsed(stored, allDoneAtLoad ?? false), setCollapsed];
}

// ── Rows ────────────────────────────────────────────────────────────────────

const STATE_TONES: Record<SetupStepState, StatusTone> = {
  done: "live",
  confirmed: "live",
  todo: "idle",
};

/** Number disc: the step number, or a check once done. */
function StepMarker({ index, done, open }: { index: number; done: boolean; open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs tabular-nums transition-colors",
        done
          ? "border-success/40 bg-success/10 text-success"
          : open
            ? "border-primary/60 text-primary"
            : "border-border text-muted-foreground",
      )}
    >
      {done ? <Check className="size-3.5" /> : index + 1}
    </span>
  );
}

/** Four LED cells, lit per finished step: the card's progress readout. */
function ProgressCells({ done, total }: { done: number; total: number }) {
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, position is the identity
          key={i}
          className={cn(
            "h-2 w-5 rounded-full transition-colors",
            i < done ? "bg-success" : "bg-muted-foreground/20",
          )}
        />
      ))}
    </span>
  );
}

/** "I added it to OBS" / "Mark as not added" for an owner-confirmed step. */
function ConfirmControls({
  confirmed,
  pending,
  onConfirm,
}: {
  confirmed: boolean;
  pending: boolean;
  onConfirm: (confirmed: boolean) => void;
}) {
  return confirmed ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm text-muted-foreground">You marked this as added.</p>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => onConfirm(false)}>
        Mark as not added
      </Button>
    </div>
  ) : (
    <Button size="sm" disabled={pending} onClick={() => onConfirm(true)}>
      <Check className="size-3.5" />I added it to OBS
    </Button>
  );
}

/** Step 2's URL. Mounted only while the step is open, so the query never runs collapsed. */
function BotPageHandoff() {
  const ingestInfo = useQuery(trpc.bot.getIngestInfo.queryOptions());
  if (ingestInfo.isPending) return <Skeleton className="h-9 w-full" />;
  if (!ingestInfo.data) {
    return (
      <QueryError
        title="Couldn't load the bot page URL"
        onRetry={() => ingestInfo.refetch()}
        retrying={ingestInfo.isFetching}
      />
    );
  }
  return <SecretUrlRow label="Bot page" path={`/bot/${ingestInfo.data.botToken}`} />;
}

function StepHandoff({
  id,
  me,
  pending,
  onConfirm,
}: {
  id: SetupStepId;
  me: SetupMe;
  pending: boolean;
  onConfirm: (step: SetupStep, confirmed: boolean) => void;
}) {
  if (id === "botAccount") {
    return me.botAccount ? (
      <p className="text-sm">
        Connected as <span className="font-mono font-medium">{me.botAccount.displayName}</span>.
      </p>
    ) : (
      <Button
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href={"/dashboard/bot" as const} />}
      >
        Connect bot account
        <ArrowRight className="size-3.5" />
      </Button>
    );
  }

  if (id === "botSource" && !me.botAccount) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect the bot account first: the bot page signs in to chat as that account.
      </p>
    );
  }

  return (
    <>
      {id === "botSource" ? (
        <BotPageHandoff />
      ) : (
        <SecretUrlRow
          label={id === "timerOverlay" ? "OBS timer overlay" : "OBS tasks overlay"}
          path={
            id === "timerOverlay"
              ? overlayPath("timer", me.overlayTimerToken)
              : overlayPath("tasks", me.overlayTasksToken)
          }
        />
      )}
      <ConfirmControls
        confirmed={me.setup[id]}
        pending={pending}
        onConfirm={(confirmed) => onConfirm(id, confirmed)}
      />
    </>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

/**
 * The checklist card. Renders nothing while collapsed — the dashboard header's "Setup"
 * button (`SetupReopenButton`) brings it back.
 */
export function SetupChecklist({
  me,
  collapsed,
  onCollapse,
}: {
  me: SetupMe;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const queryClient = useQueryClient();
  const progress = setupProgress(me);
  const allDone = progress.nextStep === null;
  // Accordion: one step open at a time, starting on the next one to do.
  const [openStep, setOpenStep] = useState<SetupStepId | null>(progress.nextStep);
  const [showSteps, setShowSteps] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasCollapsed = useRef(collapsed);
  const baseId = useId();

  // Reopened from the header button: move focus into the card it revealed.
  useEffect(() => {
    if (wasCollapsed.current && !collapsed) headingRef.current?.focus();
    wasCollapsed.current = collapsed;
  }, [collapsed]);

  const meKey = trpc.user.me.queryKey();
  // Optimistic: the chip and the count move on the click. No refetch afterwards, the
  // mutation returns the whole checklist.
  const confirmStep = useMutation(
    trpc.user.confirmSetupStep.mutationOptions({
      onMutate: async ({ step, confirmed }) => {
        await queryClient.cancelQueries({ queryKey: meKey });
        // Remember only this step's flag: a rollback must not restore a whole stale `me`
        // (another mutation may have refetched it meanwhile, e.g. a rotated overlay token).
        const previousConfirmed = queryClient.getQueryData(meKey)?.setup[step];
        queryClient.setQueryData(meKey, (old) => (old ? withSetupStep(old, step, confirmed) : old));
        return { previousConfirmed };
      },
      onSuccess: ({ setup }) => {
        queryClient.setQueryData(meKey, (old) => (old ? { ...old, setup } : old));
      },
      onError: (err, { step }, context) => {
        const previousConfirmed = context?.previousConfirmed;
        if (previousConfirmed !== undefined) {
          queryClient.setQueryData(meKey, (current) =>
            current ? withSetupStep(current, step, previousConfirmed) : current,
          );
        }
        toast.error(`Couldn't save that step: ${describeTrpcError(err)}`);
      },
    }),
  );

  if (collapsed) return null;

  const stepsVisible = !allDone || showSteps;

  return (
    <section aria-labelledby={`${baseId}-title`} className="panel mb-6">
      <div className="px-5 pt-4 pb-3">
        <ConsoleRule label="Setup" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2
            id={`${baseId}-title`}
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-lg font-semibold tracking-tight outline-none"
          >
            Set up streaming
          </h2>
          <p className="flex items-center gap-2.5">
            <ProgressCells done={progress.done} total={progress.total} />
            <span className="font-mono text-sm tabular-nums">
              {progress.done} of {progress.total}
            </span>
          </p>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {allDone
            ? "Everything is in OBS. You're ready to go live."
            : "Get the bot and both overlays into OBS. Each step takes a minute."}
        </p>
      </div>

      {stepsVisible && (
        <ol className="border-t border-border/40">
          {SETUP_STEPS.map((step, index) => {
            const state = stepState(me, step.id);
            const open = openStep === step.id;
            const panelId = `${baseId}-${step.id}`;
            return (
              <li key={step.id} className="border-b border-border/40 last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenStep(open ? null : step.id)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <StepMarker index={index} done={state !== "todo"} open={open} />
                  {/* Title and chip share a wrapping row: on a phone the chip drops under
                      the title instead of squeezing it, and stays in the button's name. */}
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 basis-40 text-sm font-medium">
                      {step.title}
                    </span>
                    <StatusChip
                      size="sm"
                      tone={STATE_TONES[state]}
                      label={STEP_STATE_LABELS[state]}
                      className="shrink-0"
                    />
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <div id={panelId} className="space-y-3 pr-5 pb-4 pl-15">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{step.why}</p>
                      <p className="text-sm">{step.action}</p>
                    </div>
                    <StepHandoff
                      id={step.id}
                      me={me}
                      pending={confirmStep.isPending}
                      onConfirm={(s, confirmed) => confirmStep.mutate({ step: s, confirmed })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-3 border-t border-border/40 px-5 py-3 sm:flex-row sm:items-center">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
          <Palette aria-hidden className="size-4 shrink-0 text-chart-2" />
          <span>
            Optional:{" "}
            <Link
              href={"/dashboard/styles" as const}
              className="font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
            >
              personalize the overlays
            </Link>{" "}
            to match your stream.
          </span>
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          {allDone && (
            <Button variant="outline" size="sm" onClick={() => setShowSteps((v) => !v)}>
              {showSteps ? "Hide steps" : "Show steps"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCollapse}>
            {allDone ? "Close" : "Finish later"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Header-band button that reopens a collapsed checklist; shows how far setup got. */
export function SetupReopenButton({
  me,
  onOpen,
  buttonRef,
}: {
  me: SetupSource;
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const { done, total } = setupProgress(me);
  return (
    <Button ref={buttonRef} variant="outline" size="sm" onClick={onOpen} className="gap-2">
      Setup
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
    </Button>
  );
}
