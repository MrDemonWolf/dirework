"use client";

// The data gate for every Bot settings sub-page. It holds `config.get` and `user.me` (both
// hydrated from the (sections) layout's prefetch) and hands them to the pages through
// context, so each page renders finished, and a page switch fetches nothing: the gate stays
// mounted in the layout while the pages below it change.

import { createContext, use } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@dirework/api/routers/index";

import { BotSettingsSkeleton } from "@/components/bot-settings-skeleton";
import { QueryError } from "@/components/query-error";
import { trpc } from "@/utils/trpc";

export type BotConfigData = inferRouterOutputs<AppRouter>["config"]["get"];
export type BotUserData = NonNullable<inferRouterOutputs<AppRouter>["user"]["me"]>;

interface BotData {
  config: BotConfigData;
  user: BotUserData;
}

const BotDataContext = createContext<BotData | null>(null);

/** The live config and user for a Bot settings page. Only valid under `BotDataGate`. */
export function useBotData(): BotData {
  const data = use(BotDataContext);
  if (!data) throw new Error("useBotData must be used under BotDataGate");
  return data;
}

export function BotDataGate({ children }: { children: React.ReactNode }) {
  const config = useQuery(trpc.config.get.queryOptions());
  const user = useQuery(trpc.user.me.queryOptions());

  // Wait for BOTH queries — rendering on config alone flashed a false
  // "Not connected / Not configured" while the user query was still loading.
  if (config.isPending || user.isPending) return <BotSettingsSkeleton />;

  // Never render the editors over defaults after a failed load: saving them
  // would overwrite the streamer's real messages and aliases.
  if (!config.data || !user.data) {
    const failed = !config.data ? config : user;
    return (
      <QueryError
        title="Couldn't load bot settings"
        onRetry={() => failed.refetch()}
        retrying={failed.isFetching}
      />
    );
  }

  return (
    <BotDataContext value={{ config: config.data, user: user.data }}>{children}</BotDataContext>
  );
}
