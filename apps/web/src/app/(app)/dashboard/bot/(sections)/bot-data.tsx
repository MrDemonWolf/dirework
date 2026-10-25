"use client";

// Data for the Bot settings sub-pages. The (sections) layout streams `config.get` and
// `user.me` as ONE batch (lib/server-query.ts `streamBot`); each card of a page is a
// `BotSection` naming the queries it needs, so it renders the moment those have data and shows
// its placeholder only while one of them is still streaming (components/progressive-section.tsx,
// lib/progressive.ts). A card never waits for a query it does not read.

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@dirework/api/routers/index";

import { type BotQueryName, botSectionStatus } from "@/lib/bot-section";
import { ProgressiveSection } from "@/components/progressive-section";
import { QueryError } from "@/components/query-error";
import { trpc } from "@/utils/trpc";

export type BotConfigData = inferRouterOutputs<AppRouter>["config"]["get"];
export type BotUserData = NonNullable<inferRouterOutputs<AppRouter>["user"]["me"]>;

/**
 * `refetchOnMount: false`: the layout hydrates both queries once per visit, and every
 * sub-page switch mounts its cards' observers afresh. Past `QUERY_FRESH_MS` a mount would
 * refetch, so a page switch would start costing api requests. A query with no data still
 * loads on mount (after a failed stream), and invalidations after a save still refetch.
 */
const configOptions = () => ({ ...trpc.config.get.queryOptions(), refetchOnMount: false });
const userOptions = () => ({ ...trpc.user.me.queryOptions(), refetchOnMount: false });

const QUERY_KEYS = {
  config: () => trpc.config.get.queryKey(),
  user: () => trpc.user.me.queryKey(),
} satisfies Record<BotQueryName, () => unknown>;

/** The live config. Only valid inside a `BotSection` that needs `"config"`. */
export function useBotConfig(): BotConfigData {
  const { data } = useQuery(configOptions());
  if (!data) throw new Error("useBotConfig must be used inside a BotSection that needs config");
  return data;
}

/** The signed-in user (bot account). Only valid inside a `BotSection` that needs `"user"`. */
export function useBotUser(): BotUserData {
  const { data } = useQuery(userOptions());
  if (!data) throw new Error("useBotUser must be used inside a BotSection that needs user");
  return data;
}

function BotSectionGate({
  needs,
  fallback,
  children,
}: {
  needs: readonly BotQueryName[];
  fallback: ReactNode;
  children: ReactNode;
}) {
  // A query this card doesn't need is observed disabled: it is never fetched on its behalf.
  const config = useQuery({ ...configOptions(), enabled: needs.includes("config") });
  const user = useQuery({ ...userOptions(), enabled: needs.includes("user") });
  const status = botSectionStatus(needs.map((name) => (name === "config" ? config : user)));

  if (status.kind === "loading") return fallback;
  if (status.kind === "failed") {
    const failed = status.query;
    return (
      <QueryError
        title="Couldn't load bot settings"
        onRetry={() => failed.refetch()}
        retrying={failed.isFetching}
      />
    );
  }
  return children;
}

/**
 * One card (or group of cards) of a Bot settings page: `children` render once every query in
 * `needs` has data, reading it through `useBotConfig` / `useBotUser`. Until then, `fallback`,
 * which must be shaped exactly like the finished card. A query that failed shows a retry in
 * the card's place instead of editors seeded from defaults.
 */
export function BotSection({
  needs,
  fallback,
  children,
}: {
  needs: readonly BotQueryName[];
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <ProgressiveSection queryKeys={needs.map((name) => QUERY_KEYS[name]())} fallback={fallback}>
      <BotSectionGate needs={needs} fallback={fallback}>
        {children}
      </BotSectionGate>
    </ProgressiveSection>
  );
}
