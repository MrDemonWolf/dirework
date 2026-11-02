// Rehype pass (runs after Fumadocs' rehype-code, see source.config.ts) that gives the two
// pieces of generated markup axe flags an accessible name:
//
// - Code blocks: Fumadocs' CodeBlock renders a scrollable `role="region"` viewport, and
//   several unnamed regions on one page are indistinguishable landmarks. Each `pre` gets
//   `data-code-label` (its title, else "Code: <first line>", made unique per page), which
//   `mdx-components.tsx` passes on as the viewport's aria-label.
// - GFM task lists (`- [ ] …`): the disabled checkbox has no label. It gets the item's own
//   text (nested lists excluded) as its aria-label, so the name matches what is shown.
//
// Typed structurally so the docs app needs no @types/hast dependency.

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const LABEL_MAX = 60;

function textOf(node: HastNode, skip?: (n: HastNode) => boolean): string {
  if (skip?.(node)) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map((c) => textOf(c, skip)).join("");
}

function hasClass(node: HastNode, name: string): boolean {
  const cls = node.properties?.className;
  return Array.isArray(cls) ? cls.includes(name) : cls === name;
}

function clamp(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX - 1).trimEnd()}…` : flat;
}

/** "Code: <first non-empty line>" (or the block's title), unique within `used`. */
export function codeBlockLabel(pre: HastNode, used: Map<string, number>): string {
  const title = pre.properties?.title;
  let base: string;
  if (typeof title === "string" && title.trim()) {
    base = clamp(title);
  } else {
    const code = pre.children?.find((c) => c.tagName === "code") ?? pre;
    const firstLine = textOf(code)
      .split("\n")
      .find((line) => line.trim());
    base = firstLine ? `Code: ${clamp(firstLine)}` : "Code";
  }
  const seen = (used.get(base) ?? 0) + 1;
  used.set(base, seen);
  return seen === 1 ? base : `${base} (${seen})`;
}

/** The task item's visible text, without its nested lists. */
export function taskItemLabel(li: HastNode): string {
  return clamp(textOf(li, (n) => n.tagName === "ul" || n.tagName === "ol"));
}

export function rehypeA11y() {
  return (tree: HastNode) => {
    const used = new Map<string, number>();
    const visit = (node: HastNode) => {
      if (node.tagName === "pre") {
        node.properties = { ...node.properties, "data-code-label": codeBlockLabel(node, used) };
      } else if (node.tagName === "li" && hasClass(node, "task-list-item")) {
        const input = node.children?.find(
          (c) => c.tagName === "input" && c.properties?.type === "checkbox",
        );
        const label = taskItemLabel(node);
        if (input && label) input.properties = { ...input.properties, ariaLabel: label };
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
