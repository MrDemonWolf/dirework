import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const base = baseOptions();
  // The landing-page anchors (and "Docs" itself) duplicate the page tree in the
  // sidebar; keep only external links such as Support.
  const links = base.links?.filter((link) => "url" in link && /^https?:\/\//.test(link.url ?? ""));
  return (
    <DocsLayout tree={source.getPageTree()} {...base} links={links}>
      {children}
    </DocsLayout>
  );
}
