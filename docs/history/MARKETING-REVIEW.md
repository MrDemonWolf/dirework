# UI/UX Review: DireWork marketing homepage

**Reviewed:** 2026-10-02 · **Input:** local source, rendered localhost site, desktop and mobile screenshots · **Method:** NN/g heuristic evaluation + guideline review

## Executive summary

**Revision status:** The first split homepage layout was rejected by the project owner. It has been revised to a centered product headline and actions above a straight preview, following the references below. Previous measurements below describe the first draft unless explicitly labeled as follow-up validation; they are not design approval.

- Rebuilt the public Fumadocs homepage around the co-working stream experience: a timer, viewer tasks, and chat together. The existing app dashboard and authentication flows are unchanged.
- The biggest accessibility issue found was an automatically updating preview countdown without a pause control. This is now corrected.
- Three severity-2 findings were corrected during implementation. No remaining severity-3 or severity-4 findings were observed in the tested flows. This is a scoped review, not a full accessibility certification.
- Tested desktop at 1280 × 720 in light and dark themes, and mobile viewport emulation at 390 × 844 and 320 × 740. Tested theme selection, countdown pause, keyboard FAQ activation, visible focus, the primary setup link, heading structure, and overflow.

**Findings remaining:** 🟥 0 catastrophic · 🟧 0 major · 🟨 0 minor · ⬜ 0 cosmetic within the tested scope

## Findings

### 🟨 Severity 2 — Minor, corrected

#### 1. Preview countdown could not be paused

- **What:** The original overlay preview updated once per second with no user control to stop it. A reduced-motion preference alone does not give every visitor control over automatic updates.
- **Where:** `apps/fumadocs/src/app/(home)/_widgets/TimerOverlayWidget.tsx` and `OverlayThemePreview.tsx`.
- **Guideline:** Give users control over information that updates automatically alongside other content.
- **Evidence:** [WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) describes the need for a mechanism to pause automatic updates when they are not essential.
- **Fix:**
  - [x] Add an explicit pause/resume control with a pressed state.
  - [x] Stop the preview interval when paused.
  - [x] Remove the nonessential repeating chat-status pulse.
- **Verification:** Selecting Pause changed the button to Resume and held the timer at 17:10 across subsequent observations. The existing reduced-motion behavior remains in source.

#### 2. Narrow-screen theme preview could extend beyond its column

- **What:** At a 320px viewport, DOM measurements reported theme-preview elements beyond the right edge even though the document width stayed at 320px. The page's clipped overflow could conceal part of the preview.
- **Where:** The marketing overlay grid and task-list preview.
- **Guideline:** Content should reflow into a small viewport without losing information.
- **Evidence:** [WCAG 2.2: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) explains the requirement to preserve content at a width equivalent to 320 CSS pixels.
- **Fix:**
  - [x] Allow grid children to shrink with `min-width: 0`.
  - [x] Bound the task-list widget to its available width.
- **Verification:** After the correction, the document width equaled the viewport at 320px and 390px, and no marketing descendant extended beyond the right edge.

#### 3. The original hero showed only part of the product experience

- **What:** The initial 1280 × 720 screenshot showed a standalone timer. Shared viewer tasks and Twitch commands were described in text but absent from the main visual.
- **Where:** The original public homepage hero.
- **Guideline:** Communicate the site's purpose quickly through explanatory copy and useful example content.
- **Evidence:** [113 Design Guidelines for Homepage Usability](https://www.nngroup.com/articles/113-design-guidelines-homepage-usability/) recommends a clear statement of purpose and example content that helps visitors understand what a site offers.
- **Fix:**
  - [x] Show timer, per-viewer tasks, and an example chat command together.
  - [x] Label the illustration as an example scene, rather than imply it is a live stream.
  - [x] State the self-hosting requirement next to the main setup action.
- **Verification:** Desktop and mobile screenshots show the new scene and clear product description. Whether this improves conversion remains a hypothesis until tested with visitors.

## Unverified (needs a different input to check)

- Physical iOS and Android touch behavior, Safari, and Firefox: tested with browser viewport emulation only.
- Screen-reader announcements and reading order: source and accessibility-tree inspection do not replace a screen-reader session.
- Reduced-motion runtime behavior: the CSS and timer guard were inspected; the operating-system preference was not changed during testing.
- Every overlay preset's contrast: the new hero colors were measured, and Default/Ocean Depths preview interactions were checked; custom overlay palettes need their own audit.
- Twitch sign-in, live bot connectivity, and OBS integration: illustrative marketing previews do not exercise those services.
- Conversion uplift or audience preference: design decisions are informed by research, not validated through an A/B test or interviews.
- Production deployment: this work is local and has not been published.

## What's working well

- The new hero explains the product and shows the primary setup action without requiring a scroll on the tested desktop and mobile entry viewports.
- One H1 and one main landmark. At 320px, the hero heading measured 58px, section headings 32px (closing heading 38px), and feature headings 23px. Main prose is 16–19px with comfortable line spacing.
- Primary CTA height measured 48.39px. FAQ keyboard focus has a visible 2px outline, and Enter expands the selected answer. [WCAG target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) defines a minimum of 24 CSS pixels, with exceptions for inline links.
- Hero scene contrast ratios were calculated from its actual hex colors: main text 15.30:1; secondary text 9.28:1; task text 13.09:1; task authors 8.47:1; completed task text 7.94:1; focus label 10.99:1. These exceed the 4.5:1 normal-text threshold for those pairs.

### Research and design decisions

#### Follow-up references and footer revision

- [Raycast Focus](https://www.raycast.com/core-features/focus): recommended layout reference. A centered, direct headline and two actions lead into one wide product preview. Use this structure with DireWork's existing navy/cyan tokens and typography.
- [Linear](https://linear.app/): reference for restrained dark surfaces and large, readable product UI. Avoid copying its scale, motion, or enterprise messaging.
- [Super Productivity](https://super-productivity.com/): reference for visible open-source ownership messaging and a practical product demonstration.
- Replaced the shared docs-site footer with the existing brand mark, a short product description, Product/Get started/Community navigation, and a separate attribution/legal row. All internal destinations correspond to existing documentation pages.
- Footer verified visually on desktop and at 320px width. The narrow viewport reported a 320px document width; navigation and legal links measured 44px tall. Keyboard focus was visible on Privacy Policy. Inline attribution links retain the required wording and destinations.

- [Pomofocus](https://pomofocus.io/) presents the timer and task workflow as its core experience. DireWork's differentiation is the shared Twitch room; the hero illustrates that difference instead of adding unrelated productivity claims.
- [OBS Browser Source documentation](https://obsproject.com/kb/browser-source) describes loading web content by URL. The page uses that familiar setup language and links to the existing overlay guide.
- [StreamElements overlay documentation](https://docs.streamelements.com/overlays) also centers its stream visuals around browser sources. The new page explains this workflow without making unverified competitor feature comparisons.
- [NN/g Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) supports using size and visual emphasis to guide attention. The new composition prioritizes product purpose and setup, then interactive examples, then prerequisites.
- Kept the existing wolf-and-clock mark, Montserrat/IBM Plex typography, and Focus Console color tokens. Added no external image service, new UI dependency, fake testimonials, or invented usage numbers.

### Validation

- Fumadocs TypeScript checking passed.
- Repository lint and `git diff --check` passed after formatting.
- Fumadocs production build and static export passed with the project's standard Turbopack build and network access.
- An initial sandboxed build stalled and was stopped. A Webpack diagnostic attempt failed on Fumadocs' virtual module scheme; it was not used as release evidence.
- Browser artifacts: `/private/tmp/dirework-marketing-desktop.png`, `/private/tmp/dirework-marketing-mobile.png`, `/private/tmp/dirework-marketing-light.png`.

## Quick wins

- [x] Put the shared-stream experience in the hero.
- [x] Keep self-hosting and setup prerequisites explicit.
- [x] Add preview pause and visible keyboard focus.
- [x] Fix the narrow-screen preview layout.
- [ ] Before publishing, check the final page on a physical phone and with a screen reader.
