"use client";

// A Bot settings control that saves the moment it changes (the mute switch, the Task and Timer
// command switches, "Who can add tasks"): something a streamer reaches for mid-stream, so it is
// never a draft. One request per change; the answer is merged into `config.get`
// (lib/config-cache.ts, no re-read), and the mutation stays pending until it is, so the control
// shows the value asked for and never flickers back.
//
// Both toasts come from the mutation's own callbacks, not from a per-call
// `mutate(vars, { onSuccess })`: those are dropped once the component that called `mutate`
// unmounts, so leaving the page mid-save used to swallow the confirmation (the save itself
// still landed). `use-instant-setting.test.ts` and e2e `50-bot-settings` pin it.

import { type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { applyConfigResult, type ConfigMerge } from "@/lib/config-cache";
import { toastMutationError } from "@/lib/validation-errors";
import { trpc } from "@/utils/trpc";

/**
 * The value an instant control shows: while a save is in flight, the value it asked for (when
 * that save carries this setting); otherwise the live `config.get` value. A finished save's
 * variables linger on the mutation, so they only count while it is pending.
 */
export function instantValue<TVariables, TValue>({
  pending,
  variables,
  live,
  pick,
}: {
  pending: boolean;
  variables: TVariables | undefined;
  live: TValue;
  pick: (variables: TVariables) => TValue | undefined;
}): TValue {
  if (!pending || variables === undefined) return live;
  return pick(variables) ?? live;
}

export interface InstantSettingOptions<TData, TError, TVariables, TValue> {
  /** The save procedure's `trpc.config.*.mutationOptions()`. */
  mutationOptions: UseMutationOptions<TData, TError, TVariables>;
  /** How the save's answer changes the cached config (lib/config-cache.ts). */
  merge: (saved: TData, sent: TVariables) => ConfigMerge;
  /** The live `config.get` value. */
  live: TValue;
  /** This setting's value in a save's variables (undefined when that save doesn't carry it). */
  pick: (variables: TVariables) => TValue | undefined;
  /** The failure toast's action: `Couldn't <errorAction>: <why>`. */
  errorAction: string;
  /** The success toast, from what was sent. */
  successText: (sent: TVariables) => string;
}

/**
 * One instant setting: `value` to show, `pending` while a save is in flight (the control is
 * disabled), and `set` to save a new value.
 */
export function useInstantSetting<TData, TError, TVariables, TValue>({
  mutationOptions,
  merge,
  live,
  pick,
  errorAction,
  successText,
}: InstantSettingOptions<TData, TError, TVariables, TValue>) {
  const queryClient = useQueryClient();
  const {
    mutate,
    isPending: pending,
    variables,
  } = useMutation({
    ...mutationOptions,
    // Returning the merge keeps the mutation pending until the cache holds the answer.
    onSuccess: (saved, sent) => {
      toast.success(successText(sent));
      return applyConfigResult(queryClient, trpc.config.get.queryKey(), merge(saved, sent));
    },
    onError: toastMutationError(errorAction),
  });

  return {
    value: instantValue({ pending, variables, live, pick }),
    pending,
    set: (vars: TVariables) => {
      mutate(vars);
    },
  };
}
