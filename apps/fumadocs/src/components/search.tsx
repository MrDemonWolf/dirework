"use client";

// Docs search dialog. The site is a static export (no server), so search runs in the browser
// over the ZBSearch index exported at build by app/api/search/route.ts (`staticGET`). Loaded
// by components/provider.tsx (next/dynamic, ssr: false) after hydration and mounted closed
// (fumadocs' `preload`), so it opens at once; the index itself is fetched on the first open.

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
import { useEffect, useRef } from "react";

// The static index is exported under next.config's basePath, which the default "/api/search"
// ignores; on a GitHub Pages project site (/dirework) search would fetch a 404 without this.
const SEARCH_INDEX = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`;

/** Fumadocs search dialog wired to the static search index; props come from RootProvider. */
export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  // No `initDB`: the exported index carries its tokenizer language (English, set in the
  // route), and the client restores it on load.
  const search = useStaticSearch({ from: SEARCH_INDEX, locale });

  // fumadocs requests the index (~1.4 MB of JSON) only for the first non-empty query, so that
  // query used to wait for the whole download. Start it when the dialog first opens instead:
  // it runs while the reader types, and the query's own fetch of the same URL is answered
  // from the HTTP cache (GitHub Pages sends max-age=600). The body is read to the end so the
  // cached copy is complete. A failure is ignored; the query's fetch reports its own.
  const warmed = useRef(false);
  useEffect(() => {
    if (!props.open || warmed.current) return;
    warmed.current = true;
    fetch(SEARCH_INDEX)
      .then((response) => response.arrayBuffer())
      .catch(() => {});
  }, [props.open]);

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
