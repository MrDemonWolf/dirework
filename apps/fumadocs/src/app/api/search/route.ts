import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  // ZBSearch tokenizer language (fumadocs-core's default is "multilingual"). It is saved in
  // the exported index and restored by the browser client in components/search.tsx.
  // https://zbsearch.dev/docs/zbsearch/text-analysis/stemming
  language: "english",
});
