"use client";
import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// The dialog and the search engine (ZBSearch) stay out of every page's initial scripts. Their
// chunks still load right after hydration: fumadocs' `preload` (on by default) mounts the
// dialog closed, so it opens at once. The index loads on the first open (components/search.tsx).
const SearchDialog = dynamic(() => import("@/components/search"), { ssr: false });

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider search={{ SearchDialog }}>{children}</RootProvider>;
}
