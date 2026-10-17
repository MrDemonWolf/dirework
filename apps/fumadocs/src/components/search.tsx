"use client";

// Docs search dialog. The site is a static export (no server), so search is client-side Orama
// over the index exported at build by app/api/search/route.ts (`staticGET`). Lazily loaded by
// components/provider.tsx (next/dynamic, ssr: false) the first time search opens.

import { create } from "@orama/orama";
import { useDocsSearch } from "fumadocs-core/search/client";
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

/** Empty Orama instance the static index is loaded into (English stemming/tokenizing). */
function initOrama() {
  return create({
    schema: { _: "string" },
    // https://docs.orama.com/docs/orama-js/supported-languages
    language: "english",
  });
}

/** Fumadocs search dialog wired to the static Orama index; props come from RootProvider. */
export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const { search, setSearch, query } = useDocsSearch({
    type: "static",
    // The static index is exported under next.config's basePath, which the
    // default "/api/search" ignores; on a GitHub Pages project site
    // (/dirework) search would fetch a 404 without this.
    from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`,
    initOrama,
    locale,
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
