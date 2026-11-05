import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The segmented-control recipe, shared by every "pick one of a few" control: the tab lists,
 * the Theme Center's Timer / Tasks preview toggle and the bot page handoff's Widget / Dock
 * radios. One look, so a selected segment can't read one way on a tab and the opposite way
 * on the control beside it (the tabs once drew lighter than their track in dark while the
 * other two drew darker). A neutral `bg-muted` track and muted idle labels; the selected
 * segment wears the blue accent, the same in both themes with no `dark:` override: a
 * `border-primary` edge (3:1 on the track, so the state reads without its color), a
 * `primary/10` wash and a `link` label. Not a solid `--primary` fill: the amber UnsavedDot
 * sits on the selected tab, and `--warning` on light `--primary` is 1.03:1.
 *
 * It is keyed on each control's own state: `data-active` (a Base UI Tab), `aria-pressed`
 * (a toggle button) and `data-checked` (a Base UI Radio). Layout (flex or grid, gaps, sizes)
 * stays with each control. tokens-contrast.test.ts measures the label, the edge and the dot.
 */
const segmentedTrack = "rounded-xl bg-muted p-0.75";

const segmentedItem =
  "rounded-lg border border-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11 motion-reduce:transition-none data-active:border-primary data-active:bg-primary/10 data-active:text-link aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-link data-checked:border-primary data-checked:bg-primary/10 data-checked:text-link";

/**
 * The unsaved-changes marker: an amber dot, plus "(unsaved changes)" for screen readers, which
 * read it as part of the control's name ("Timer style (unsaved changes)"). The one copy:
 * TabsTrigger shows it for a dirty tab, the Replies editor for a group holding an edit.
 */
function UnsavedDot() {
  return (
    <>
      <span
        aria-hidden
        data-slot="unsaved-dot"
        className="size-1.5 shrink-0 rounded-full bg-warning"
      />
      <span className="sr-only">(unsaved changes)</span>
    </>
  );
}

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("gap-2 group/tabs flex data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group-data-[orientation=horizontal]/tabs:h-8 pointer-coarse:group-data-[orientation=horizontal]/tabs:h-auto group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: segmentedTrack,
        line: "gap-1 bg-transparent p-0.75",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * A segment of the shared recipe. On coarse pointers a horizontal list drops its fixed height
 * and each trigger is at least 44px tall (touch-targets.test.ts), the same floor buttons and
 * inputs use.
 */
function TabsTrigger({
  className,
  dirty = false,
  children,
  ...props
}: TabsPrimitive.Tab.Props & {
  /** Marks a tab with edits: the UnsavedDot, read as "(unsaved changes)". */
  dirty?: boolean;
}) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        segmentedItem,
        "gap-1.5 px-1.5 py-0.5 text-xs font-medium group-data-[orientation=vertical]/tabs:py-1.25 [&_svg:not([class*='size-'])]:size-4 relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        // The line variant marks the active tab with an underline instead of the wash and edge.
        "group-data-[variant=line]/tabs-list:data-active:border-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:-bottom-1.25 group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
      {dirty && <UnsavedDot />}
    </TabsPrimitive.Tab>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  // Base UI makes the panel a Tab stop (tabIndex 0, the ARIA tabs pattern), so it needs its
  // own visible focus ring (WCAG 2.4.7), offset so it never sits on the panel's content.
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "text-xs/relaxed flex-1 rounded-md outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  segmentedTrack,
  segmentedItem,
  UnsavedDot,
};
