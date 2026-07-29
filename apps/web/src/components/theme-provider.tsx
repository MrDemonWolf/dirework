"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * next-themes injects its anti-FOUC theme script via
 * React.createElement("script"), which React 19 flags with a dev-only
 * "Encountered a script tag while rendering React component" warning. The
 * script itself is fine — it ships in the SSR HTML and runs before paint;
 * the warning is a known false positive (next-themes #385/#387, unmaintained
 * upstream). Filter exactly that message, dev only, and pass everything
 * else through untouched.
 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering")
    ) {
      return;
    }
    originalError(...args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
