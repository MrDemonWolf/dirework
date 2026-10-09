"use client";
import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Orama and the dialog load only when search is first opened, not on every page.
const SearchDialog = dynamic(() => import("@/components/search"), { ssr: false });

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider search={{ SearchDialog }}>{children}</RootProvider>;
}
