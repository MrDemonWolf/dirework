import type { VariantProps } from "class-variance-authority";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // ≥16px text on touch viewports, 14px minimum on md+ (audit M9)
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-base md:text-sm font-medium focus-visible:ring-1 aria-invalid:ring-1 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        // Unscoped hover — native buttons get feedback too (audit M10)
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        // Dark rest tint /15: at /20 the label measured 4.44:1 (axe, Bot account Disconnect).
        // The deeper hover tints take `destructive-strong` (plain red fell to 3.9:1 there),
        // and keyboard focus is a full-strength red border, not a faint /40 one (1.4.11).
        destructive:
          "bg-destructive/10 hover:bg-destructive/20 hover:text-destructive-strong focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40 dark:bg-destructive/15 text-destructive focus-visible:border-destructive dark:hover:bg-destructive/30",
        link: "text-link underline-offset-4 hover:underline",
      },
      // Touch-first pointers (pointer-coarse) get bigger minimum hit areas: 44px for the
      // default and large sizes, scaled down for the compact ones. Mouse layouts keep the
      // dense instrument-panel sizing.
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 pointer-coarse:min-h-11",
        xs: "h-6 gap-1 rounded-md px-2 text-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3 pointer-coarse:min-h-9",
        sm: "h-7 gap-1 rounded-md px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 pointer-coarse:min-h-10",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 pointer-coarse:min-h-11",
        icon: "size-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        "icon-xs":
          "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3 pointer-coarse:min-h-9 pointer-coarse:min-w-9",
        "icon-sm": "size-7 rounded-md pointer-coarse:min-h-10 pointer-coarse:min-w-10",
        "icon-lg": "size-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Red icon-only actions on a ghost or outline button (overlay/bot URL Reset, alias delete,
 * task row Remove, timer Stop): red icon, a /10 red hover tint, and keyboard focus in red
 * (`border-destructive` + `ring-destructive/40`) instead of the blue `ring`, like the
 * destructive menu rows. `cn` lets these focus classes replace the base recipe's blue ones.
 */
const destructiveIconButton =
  "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

/**
 * Keyboard focus for hand-rolled controls that aren't a `Button` (links, collapsible
 * triggers, chips, checkboxes, nav tabs): a 2px `--ring` ring in place of the browser
 * outline. `--ring` clears 3:1 on every surface (tokens-contrast.test.ts), and 80-a11y's
 * Tab walk requires a visible ring or outline on every stop. Add `ring-inset` (full-bleed
 * rows), a `ring-offset-*` or `rounded-*` beside it at the call site when needed.
 */
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Inline text links. `prose`: a link inside a sentence or notice, link-blue (`text-link`,
 * AAA as text; never `text-primary`, the fill) and always underlined, so it is told apart
 * from the copy by more than color. `proseOnTint`: the same underlined link in `foreground`,
 * for a link on a tinted box (the destructive Callout), where `text-link` would drop to AA in
 * light mode; foreground stays AAA there. `quiet`: AGENTS.md's Footer Convention, no
 * underline, `font-medium`, a hover highlight to `foreground`, for links in muted chrome.
 */
const linkVariants = cva(
  `rounded-sm font-medium transition-colors motion-reduce:transition-none ${focusRing}`,
  {
    variants: {
      variant: {
        prose: "text-link underline underline-offset-4 hover:decoration-2",
        proseOnTint: "text-foreground underline underline-offset-4 hover:decoration-2",
        quiet: "hover:text-foreground",
      },
    },
    defaultVariants: { variant: "prose" },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, destructiveIconButton, focusRing, linkVariants };
