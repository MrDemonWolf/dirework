import type { ComponentProps } from "react";
import type { MDXComponents } from "mdx/types";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import defaultMdxComponents from "fumadocs-ui/mdx";

type PreProps = ComponentProps<"pre"> & { "data-code-label"?: string };

/**
 * Fumadocs' code block, with its scrollable `role="region"` viewport named after the block
 * (`data-code-label`, set by `lib/rehype-a11y.ts`) so a page's code regions are distinct.
 */
function LabelledPre({ "data-code-label": label, ref: _ref, ...props }: PreProps) {
  return (
    <CodeBlock {...props} viewportProps={label ? { "aria-label": label } : undefined}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: LabelledPre,
    ...components,
  };
}
