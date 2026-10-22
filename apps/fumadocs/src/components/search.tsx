"use client";

// Docs search dialog. The site is a static export (no server), so search runs in the browser
// over the ZBSearch index exported at build by app/api/search/route.ts (`staticGET`). Lazily
// loaded by components/provider.tsx (next/dynamic, ssr: false) the first time search opens.

import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useI18n } from "fumadocs-ui/contexts/i18n";

/** Fumadocs search dialog wired to the static search index; props come from RootProvider. */
export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  // No `initDB`: the exported index carries its tokenizer language (English, set in the
  // route), and the client restores it on load.
  const search = useStaticSearch({
    // The static index is exported under next.config's basePath, which the
    // default "/api/search" ignores; on a GitHub Pages project site
    // (/dirework) search would fetch a 404 without this.
    from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`,
    locale,
  });

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        {/* Lists the results of the last search (SearchDialog's `data`). */}
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
