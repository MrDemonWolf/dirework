"use client";

// Fumadocs' DocsPage with its table of contents inside landmarks. DocsPage renders <main>
// around the article; the TOC sits beside it, outside every landmark, and the mobile popover
// wraps its toggle in a bare <header>, which counts as a second banner. Wrapping both TOC
// slots in a <nav> (display: contents, so the grid placement is the TOC's own) names them as
// navigation landmarks and scopes that header. Both exist in the DOM at every width (CSS hides
// one), so they carry different names.
//
// A client component because slots are functions, which a server page can't hand to the
// (client) DocsPage.

import type { ComponentProps } from "react";

import { DocsPage as FumadocsDocsPage } from "fumadocs-ui/layouts/docs/page";
import { TOC, TOCPopover, TOCProvider } from "fumadocs-ui/layouts/docs/page/slots/toc";

function TocNav(props: ComponentProps<typeof TOC>) {
  return (
    <nav aria-label="On this page" className="contents">
      <TOC {...props} />
    </nav>
  );
}

function TocPopoverNav(props: ComponentProps<typeof TOCPopover>) {
  return (
    <nav aria-label="Table of contents" className="contents">
      <TOCPopover {...props} />
    </nav>
  );
}

const slots = { toc: { provider: TOCProvider, main: TocNav, popover: TocPopoverNav } };

export function DocsPage(props: Omit<ComponentProps<typeof FumadocsDocsPage>, "slots">) {
  return <FumadocsDocsPage {...props} slots={slots} />;
}
