"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The page origin on the client; "" during SSR so hydration matches. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
