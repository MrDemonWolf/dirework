// The draft editors' save contract, in one home (Theme Center, Bot settings → Replies and
// Commands). Each holds a working copy (the draft) beside the last-saved snapshot; dirty is
// derived by comparing them, never tracked by hand, so an edit reverted by hand clears it.
// A save commits the snapshot it SENT, not the draft as it is when the answer lands, so an edit
// made while the request is in flight stays dirty. The answer is merged into `config.get` through
// `lib/config-cache.ts` (never invalidate-then-refetch).
//
// The state machine (`draftReducer`) and the save flow (`runSettingsSave`) are React-free, so
// they are tested in node; the two hooks only wire them to React.

import { type Dispatch, type SetStateAction, useCallback, useReducer } from "react";
import { type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { type ConfigMerge, applyConfigResult } from "@/lib/config-cache";
import { isDeepEqual } from "@/lib/utils";
import { toastMutationError } from "@/lib/validation-errors";
import { trpc } from "@/utils/trpc";

/** A draft beside the snapshot it is compared against. */
export interface DraftState<T> {
  draft: T;
  saved: T;
}

export type DraftAction<T> =
  | { type: "edit"; next: SetStateAction<T> }
  | { type: "reset" }
  | { type: "commit"; submitted: T };

/**
 * `edit` changes the draft (a value or an updater, like `setState`); `reset` puts the saved
 * snapshot back; `commit` records what a save sent as the saved snapshot and leaves the draft
 * alone, so whatever changed after the save left still differs from it.
 */
export function draftReducer<T>(state: DraftState<T>, action: DraftAction<T>): DraftState<T> {
  switch (action.type) {
    case "edit": {
      const next =
        typeof action.next === "function"
          ? (action.next as (prev: T) => T)(state.draft)
          : action.next;
      return next === state.draft ? state : { ...state, draft: next };
    }
    case "reset":
      return state.draft === state.saved ? state : { ...state, draft: state.saved };
    case "commit":
      return { ...state, saved: action.submitted };
  }
}

/** True when the draft differs from the saved snapshot under `equals`. */
export function isDraftDirty<T>(
  state: DraftState<T>,
  equals: (a: T, b: T) => boolean = isDeepEqual,
): boolean {
  return !equals(state.draft, state.saved);
}

export interface Draft<T> {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  saved: T;
  dirty: boolean;
  /** Back to the saved snapshot (the Save bar's Reset). */
  reset: () => void;
  /** Record what a save sent as saved; call it once the save has succeeded. */
  commit: (submitted: T) => void;
}

/**
 * A draft and its saved snapshot, both seeded in STATE from `initial` on mount (never copied in
 * from a later render): the editors mount once the streamed config has landed, so the saved
 * values are in the server HTML, and a later config update re-renders without touching the
 * draft. `equals` decides dirty (deep equality by default).
 */
export function useDraft<T>(
  initial: T | (() => T),
  equals: (a: T, b: T) => boolean = isDeepEqual,
): Draft<T> {
  const [state, dispatch] = useReducer(draftReducer<T>, initial, (seed): DraftState<T> => {
    const value = typeof seed === "function" ? (seed as () => T)() : seed;
    return { draft: value, saved: value };
  });
  const setDraft = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => dispatch({ type: "edit", next }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const commit = useCallback((submitted: T) => dispatch({ type: "commit", submitted }), []);
  return {
    draft: state.draft,
    setDraft,
    saved: state.saved,
    dirty: isDraftDirty(state, equals),
    reset,
    commit,
  };
}

/** The toasts a save raises; `sonner`'s (and `toastMutationError`) in the app, a fake in tests. */
export interface SaveToasts {
  error: (message: string) => void;
  success: (message: string) => void;
  /** A failed request: `toastMutationError(action)(err)`, so an outage shares one toast. */
  failed: (action: string, err: unknown) => void;
}

const SAVE_TOASTS: SaveToasts = {
  error: (message) => toast.error(message),
  success: (message) => toast.success(message),
  failed: (action, err) => toastMutationError(action)(err),
};

/**
 * One save: refused with a toast while `blockedReason` is set (the server's own schema would
 * reject the payload), otherwise sent; on success `submitted` is committed and "<Noun> saved"
 * toasts, on failure the error toasts and nothing is committed, so the Save bar keeps offering a
 * retry. Resolves true when the save went through. Never throws.
 */
export async function runSettingsSave<P, S>({
  noun,
  payload,
  submitted,
  blockedReason,
  send,
  commit,
  toasts,
}: {
  noun: string;
  payload: P;
  submitted: S;
  blockedReason: string | null;
  send: (payload: P) => Promise<unknown>;
  commit: (submitted: S) => void;
  toasts: SaveToasts;
}): Promise<boolean> {
  if (blockedReason) {
    toasts.error(`Couldn't save ${noun}: ${blockedReason}`);
    return false;
  }
  try {
    await send(payload);
  } catch (err) {
    toasts.failed(`save ${noun}`, err);
    return false;
  }
  commit(submitted);
  toasts.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} saved`);
  return true;
}

/**
 * The Save bar's save for a config editor. `mutationOptions` is the procedure's
 * (`trpc.config.updateStyles.mutationOptions()`), `merge` turns its answer (and what was sent)
 * into the `config.get` merge from `lib/config-cache.ts`, and `commit` is the draft's. The
 * mutation stays pending until the cache holds the answer, so the page never shows the old
 * value after "saved".
 */
export function useSettingsSave<TOutput, TError, TInput, S>({
  noun,
  mutationOptions,
  merge,
  commit,
}: {
  /** Lowercase plural the toasts name: "styles" → "Couldn't save styles: …" / "Styles saved". */
  noun: string;
  mutationOptions: UseMutationOptions<TOutput, TError, TInput>;
  merge: (saved: TOutput, sent: TInput) => ConfigMerge;
  commit: (submitted: S) => void;
}): {
  save: (payload: TInput, submitted: S, blockedReason: string | null) => Promise<boolean>;
  saving: boolean;
} {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...mutationOptions,
    onSuccess: (saved, sent) =>
      applyConfigResult(queryClient, trpc.config.get.queryKey(), merge(saved, sent)),
  });
  const { mutateAsync } = mutation;
  const save = useCallback(
    (payload: TInput, submitted: S, blockedReason: string | null) =>
      runSettingsSave({
        noun,
        payload,
        submitted,
        blockedReason,
        send: mutateAsync,
        commit,
        toasts: SAVE_TOASTS,
      }),
    [noun, mutateAsync, commit],
  );
  return { save, saving: mutation.isPending };
}
