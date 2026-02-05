# Dirework — Pomodoro Timer & Task Tracker with Twitch Integration

An open-source, self-hosted Pomodoro timer and task list that integrates with Twitch chat. Streamers log in with Twitch, connect a bot account, configure their overlays, and add them to OBS. Viewers interact via chat commands like `!pomo`, `!task`, `!done`.

---

## Project Context

- **Self-hosted & open-source** — Not a SaaS. Each streamer deploys their own instance.
- **Documentation site** — Fumadocs-powered docs (`apps/docs/`) explain setup, self-hosting, and configuration.
- **Single user per instance** — The deployment serves one streamer (though the schema supports multiple users if someone wanted to run a shared instance).

---

## Tech Stack & Scaffolding

### Scaffold Command

```bash
pnpm create better-t-stack@latest dirework \
  --frontend next \
  --backend convex \
  --runtime none \
  --api none \
  --auth better-auth \
  --payments none \
  --database none \
  --orm none \
  --db-setup none \
  --package-manager pnpm \
  --no-git \
  --web-deploy none \
  --server-deploy none \
  --install \
  --addons fumadocs turborepo \
  --examples none
```

This produces a monorepo with:

```
dirework/
├── apps/
│   ├── web/          # Next.js app (dashboard, overlays, auth)
│   └── docs/         # Fumadocs documentation site
├── packages/         # Shared packages (if needed)
├── convex/           # Convex backend (schema, functions, crons)
├── turbo.json
└── pnpm-workspace.yaml
```

### Stack

| Layer          | Technology                                       |
| -------------- | ------------------------------------------------ |
| Frontend       | Next.js (App Router), React, Tailwind, [shadcn/ui](https://ui.shadcn.com/) (all UI) |
| Backend        | Convex (**self-hosted**) — real-time DB + functions |
| Auth           | better-auth with Convex adapter, Twitch OAuth    |
| Chat Bot       | tmi.js (runs inside overlay browser sources)     |
| Documentation  | Fumadocs                                         |
| Monorepo       | Turborepo + pnpm workspaces                      |
| Deployment     | Coolify (Docker Compose) — self-hosted            |

### Self-Hosted Convex

Convex runs as a **self-hosted instance** on Coolify (not Convex Cloud). This affects the development workflow:

#### Development Environment (`.env.local`)

```bash
# Point CLI tools at your self-hosted Convex instance
CONVEX_SELF_HOSTED_URL='https://convex.yourdomain.com'   # Your Coolify-hosted Convex URL
CONVEX_SELF_HOSTED_ADMIN_KEY='<generated admin key>'      # See below

# Next.js env vars
NEXT_PUBLIC_CONVEX_URL='https://convex.yourdomain.com'    # Same as above (public, for client WebSocket)
NEXT_PUBLIC_CONVEX_SITE_URL='https://convex.yourdomain.com' # Convex HTTP actions URL (same for self-hosted)
NEXT_PUBLIC_SITE_URL='http://localhost:3000'               # Next.js app URL (localhost in dev)
```

#### Generating Admin Key

On the Coolify server where Convex is running:

```bash
docker compose exec backend ./generate_admin_key.sh
```

Copy the output into `.env.local` as `CONVEX_SELF_HOSTED_ADMIN_KEY`.

#### Dev Workflow

Once `.env.local` is configured, standard Convex commands work the same as cloud:

```bash
npx convex dev       # Watches for changes, deploys to self-hosted instance
npx convex deploy    # Deploy functions to self-hosted instance (production)
```

The CLI detects `CONVEX_SELF_HOSTED_URL` and routes to your instance instead of Convex Cloud. It prevents mixing cloud and self-hosted credentials.

### Additional Dependencies (post-scaffold)

```bash
# In apps/web
pnpm add tmi.js uuid                    # Bot chat + token generation
pnpm add -D @types/tmi.js

# In root (Convex) — requires convex@1.25.0+
pnpm add @convex-dev/better-auth        # better-auth <-> Convex adapter
pnpm add better-auth@1.4.9 --save-exact # Pinned version for compatibility
```

---

## Architecture

### Bot-in-Overlay Model

The Twitch bot runs **inside each overlay** (OBS browser source), not as a separate service:

1. Streamer logs in with their **streamer** Twitch account
2. Clicks "Connect Bot Account" → OAuth with their **bot** Twitch account
3. Bot tokens stored in Convex, fetched by overlays using their overlay token
4. Each overlay connects to Twitch chat via tmi.js and handles its own commands
5. **Overlay URLs must be kept private** (they grant access to bot credentials)

```
┌──────────────────────────────────────────────────────────────┐
│                      NEXT.JS (apps/web)                      │
├──────────────────────────────────────────────────────────────┤
│  /                      Login page (Sign in with Twitch)     │
│  /dashboard             Config UI + overlay preview          │
│  /dashboard/analytics   Pomodoro stats & history             │
│  /auth/twitch/bot       Bot account OAuth redirect           │
│  /api/auth/[...all]     better-auth handlers                 │
├──────────────────────────────────────────────────────────────┤
│  /overlay/t/[token]     Timer overlay (OBS browser source)   │
│    └─ tmi.js: !pomo, !pause, !resume, !skip, !time          │
│  /overlay/l/[token]     Task list overlay (OBS browser source│
│    └─ tmi.js: !task, !done, !edit, !delete, !clear          │
└──────────────────────────────────────────────────────────────┘
           ↕ WebSocket (Convex real-time)    ↕ IRC (tmi.js)
┌──────────────────────────────────────────────────────────────┐
│                      CONVEX BACKEND                          │
├──────────────────────────────────────────────────────────────┤
│  Tables: users, tasks, timerState, config, pomodoroHistory   │
│  Scheduled: Timer transitions, bot token refresh             │
│  Crons: Token refresh every 30 min                           │
└──────────────────────────────────────────────────────────────┘
```

### Why Bot-in-Overlay?

- **No separate bot service** to deploy or maintain
- **Separation of concerns** — Timer overlay handles timer commands, task overlay handles task commands
- **Self-contained** — Each overlay works independently
- **Direct Convex access** — Overlays talk to Convex via WebSocket (authenticated by token)

---

## Authentication

### better-auth + Convex Integration (Self-Hosted)

Uses `@convex-dev/better-auth` — the official Convex component for better-auth. Works identically on self-hosted Convex as on Convex Cloud.

#### Convex-Side Files

**`convex/convex.config.ts`** — Register the better-auth component:
```typescript
import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp();
app.use(betterAuth);

export default app;
```

**`convex/auth.config.ts`** — Auth provider config:
```typescript
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
```

**`convex/auth.ts`** — Auth instance with Twitch provider:
```typescript
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    socialProviders: {
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID!,
        clientSecret: process.env.TWITCH_CLIENT_SECRET!,
      },
    },
    plugins: [convex({ authConfig })],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
```

**`convex/http.ts`** — Mount auth HTTP routes:
```typescript
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);

export default http;
```

#### Convex Environment Variables

Set on the self-hosted Convex instance:

```bash
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
npx convex env set SITE_URL=https://dirework.yourdomain.com
npx convex env set TWITCH_CLIENT_ID=<from dev.twitch.tv>
npx convex env set TWITCH_CLIENT_SECRET=<from dev.twitch.tv>
```

#### Next.js Client-Side Files

**`lib/auth-client.ts`**:
```typescript
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

**`lib/auth-server.ts`**:
```typescript
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
```

**`app/api/auth/[...all]/route.ts`**:
```typescript
import { handler } from "@/lib/auth-server";
export const { GET, POST } = handler;
```

**`components/convex-client-provider.tsx`**:
```typescript
"use client";
import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

#### Auth Flow

1. User visits `/` → sees "Sign in with Twitch" button
2. `authClient.signIn.social({ provider: "twitch" })` → redirects to Twitch OAuth
3. Twitch redirects back → better-auth validates via Convex HTTP routes
4. User session created, stored in Convex (via better-auth component)
5. User lands on `/dashboard`
6. All Convex queries/mutations have access to `ctx.auth`

### Bot Account OAuth (Separate Flow)

The streamer connects a **separate** Twitch account as their bot. This is a custom OAuth flow (not through better-auth) since it needs different scopes and a different account:

1. Dashboard shows "Connect Bot Account" button
2. Redirects to Twitch OAuth with `force_verify: true` (allows different account) and scopes `chat:read chat:edit`
3. Callback at `/auth/twitch/bot/callback` exchanges code for tokens
4. Bot credentials stored in Convex `users.botAccount`
5. Overlays fetch these credentials via their overlay token

---

## Schema

5 tables with nested Convex validators:

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const cssValue = v.string(); // "10px", "#ffffff", etc.

export default defineSchema({
  // ─── USERS ───
  users: defineTable({
    twitchId: v.string(),
    username: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),

    overlayTokens: v.object({
      timer: v.string(),   // UUID v4
      tasks: v.string(),   // UUID v4
      createdAt: v.number(),
    }),

    botAccount: v.optional(v.object({
      twitchId: v.string(),
      username: v.string(),
      displayName: v.string(),
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
      scopes: v.array(v.string()),
      connectedAt: v.number(),
    })),

    botStatus: v.optional(v.object({
      timerConnected: v.boolean(),
      tasksConnected: v.boolean(),
      lastSeen: v.number(),
      error: v.optional(v.string()),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_twitchId", ["twitchId"])
    .index("by_timerToken", ["overlayTokens.timer"])
    .index("by_tasksToken", ["overlayTokens.tasks"]),

  // ─── TASKS ───
  tasks: defineTable({
    userId: v.id("users"),
    text: v.string(),
    authorUsername: v.string(),
    authorColor: v.string(),
    status: v.union(v.literal("pending"), v.literal("done")),
    order: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_order", ["userId", "order"]),

  // ─── TIMER STATE (live, mutable) ───
  timerState: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("idle"),
      v.literal("starting"),
      v.literal("work"),
      v.literal("break"),
      v.literal("longBreak"),
      v.literal("paused"),
      v.literal("finished"),
    ),
    targetEndTime: v.optional(v.number()),      // Unix ms — null when paused/idle
    pausedWithRemaining: v.optional(v.number()), // ms remaining when paused
    currentCycle: v.number(),
    totalCycles: v.number(),
    lastUpdated: v.number(),
  }).index("by_userId", ["userId"]),

  // ─── CONFIG (one doc per user, all settings) ───
  config: defineTable({
    userId: v.id("users"),

    timer: v.object({
      workDuration: v.number(),        // seconds
      breakDuration: v.number(),
      longBreakDuration: v.number(),
      longBreakInterval: v.number(),
      startingDuration: v.number(),
      defaultCycles: v.number(),
      labels: v.object({
        work: v.string(),
        break: v.string(),
        longBreak: v.string(),
        starting: v.string(),
        finished: v.string(),
      }),
      sounds: v.object({
        work: v.string(),
        break: v.string(),
        longBreak: v.string(),
      }),
      showHours: v.boolean(),
      noLastBreak: v.boolean(),
      workRemindSeconds: v.number(),
      sendWorkRemind: v.boolean(),
    }),

    timerStyles: v.object({
      dimensions: v.object({ width: cssValue, height: cssValue }),
      background: v.object({ color: cssValue, opacity: v.number(), borderRadius: cssValue }),
      text: v.object({ color: cssValue, outlineColor: cssValue, outlineSize: cssValue, fontFamily: v.string() }),
      fontSizes: v.object({ label: cssValue, time: cssValue, cycle: cssValue }),
      spacing: v.object({
        labelTop: cssValue, labelLeft: cssValue,
        timeTop: cssValue, timeLeft: cssValue,
        cycleTop: cssValue, cycleRight: cssValue,
      }),
      layout: v.union(v.literal("row"), v.literal("column")),
    }),

    taskStyles: v.object({
      display: v.object({
        showDone: v.boolean(),
        showCount: v.boolean(),
        useCheckboxes: v.boolean(),
        crossOnDone: v.boolean(),
        reverseOrder: v.boolean(),
        maxLines: v.number(),
      }),
      fonts: v.object({ header: v.string(), body: v.string() }),
      scroll: v.object({ pixelsPerSecond: v.number(), gapBetweenLoops: v.number() }),
      header: v.object({
        height: cssValue,
        background: v.object({ color: cssValue, opacity: v.number() }),
        border: v.object({ color: cssValue, width: cssValue, radius: cssValue }),
        fontSize: cssValue, fontColor: cssValue, padding: cssValue,
      }),
      body: v.object({
        background: v.object({ color: cssValue, opacity: v.number() }),
        border: v.object({ color: cssValue, width: cssValue, radius: cssValue }),
        padding: v.object({ vertical: cssValue, horizontal: cssValue }),
      }),
      task: v.object({
        background: v.object({ color: cssValue, opacity: v.number() }),
        border: v.object({ color: cssValue, width: cssValue, radius: cssValue }),
        fontSize: cssValue, fontColor: cssValue, usernameColor: cssValue,
        padding: cssValue, marginBottom: cssValue, maxWidth: cssValue,
      }),
      taskDone: v.object({
        background: v.object({ color: cssValue, opacity: v.number() }),
        fontColor: cssValue,
      }),
      checkbox: v.object({
        size: cssValue,
        background: v.object({ color: cssValue, opacity: v.number() }),
        border: v.object({ color: cssValue, width: cssValue, radius: cssValue }),
        margin: v.object({ top: cssValue, left: cssValue, right: cssValue }),
        tickChar: v.string(), tickSize: cssValue, tickColor: cssValue,
      }),
      bullet: v.object({
        char: v.string(), size: cssValue, color: cssValue,
        margin: v.object({ top: cssValue, left: cssValue, right: cssValue }),
      }),
    }),

    messages: v.object({
      timer: v.object({
        workStart: v.string(), breakStart: v.string(), longBreakStart: v.string(),
        workRemind: v.string(), finished: v.string(), eta: v.string(),
        notRunning: v.string(), alreadyRunning: v.string(), notMod: v.string(),
      }),
      tasks: v.object({
        added: v.string(), edited: v.string(), deleted: v.string(),
        finished: v.string(), next: v.string(), check: v.string(),
        checkOther: v.string(), noTask: v.string(), noTaskOther: v.string(),
        alreadyHasTask: v.string(), noContent: v.string(),
        clearedAll: v.string(), clearedDone: v.string(),
        notMod: v.string(), help: v.string(),
      }),
    }),

    // Flat map: alias -> action. Example: { "!pomo": "timer:start", "!task": "task:add" }
    commandAliases: v.record(v.string(), v.string()),

    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // ─── POMODORO HISTORY (analytics) ───
  pomodoroHistory: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("work"), v.literal("break"), v.literal("longBreak")),
    durationSeconds: v.number(),
    completedAt: v.number(),
    wasSkipped: v.boolean(),
  }).index("by_user_date", ["userId", "completedAt"]),
});
```

### Default Config Values

Define in `convex/defaults.ts` — seeded into `config` table when a user first signs up. This includes sensible defaults:

- Work: 25 min, Break: 5 min, Long Break: 15 min, Long Break Interval: 4, Default Cycles: 4
- Default command aliases: `!pomo` → `timer:start`, `!pause` → `timer:pause`, `!resume` → `timer:resume`, `!skip` → `timer:skip`, `!time` → `timer:time`, `!task` → `task:add`, `!done` → `task:finish`, `!edit` → `task:edit`, `!delete` → `task:delete`, `!clear` → `task:clear`
- Default messages with `{user}` placeholders
- Default styles (dark background, white text, etc.)

---

## Timer Synchronization

Server-authoritative with `targetEndTime`:

### How It Works

1. `timerState.targetEndTime` = Unix timestamp when timer hits 0
2. Client calculates: `remaining = targetEndTime - Date.now()`
3. On pause: `pausedWithRemaining = targetEndTime - Date.now()`, clear `targetEndTime`
4. On resume: `targetEndTime = Date.now() + pausedWithRemaining`

### Timer State Machine

```
idle ──(start)──> starting ──(auto)──> work ──(expire)──> break ──(expire)──> work ──> ...
                                        │                   │
                                        v                   v
                                      paused              paused
                                        │                   │
                                        v                   v
                                    (resume)> work      (resume)> break

After longBreakInterval cycles: work ──> longBreak ──> work
After all cycles complete: ──> finished ──> idle
```

### Convex Scheduled Functions

When a timer phase starts, schedule `scheduleTimerTransition` to fire after the phase duration. This function:

1. Checks if timer is still running (not paused/cancelled)
2. Determines next phase (work → break, break → work, etc.)
3. Logs completed phase to `pomodoroHistory`
4. Updates `timerState` with new phase and new `targetEndTime`
5. Schedules the next transition

On pause: cancel the scheduled function. On resume: schedule a new one with remaining time.

### Client Display Hook (`useTimerDisplay`)

- Runs `setInterval` at 100ms for smooth countdown
- Reads `targetEndTime` from Convex subscription
- When `remaining <= 0`, the scheduled function handles the transition (no client action needed)
- Survives page refresh — just recalculates from `targetEndTime`

---

## Overlay Bot Integration

Each overlay page connects to Twitch chat via tmi.js:

### Connection Flow

1. Overlay loads at `/overlay/t/[token]` or `/overlay/l/[token]`
2. Convex query fetches user data + bot credentials using the overlay token
3. tmi.js connects to streamer's Twitch channel using bot account credentials
4. On message: look up `command` in `config.commandAliases`, dispatch to mutation
5. Send response back to chat

### Command Routing

Timer overlay only handles `timer:*` actions, task overlay only handles `task:*` actions. Both overlays can be active simultaneously without conflict.

### Reconnection

- tmi.js has built-in reconnection
- On disconnect: update `botStatus` in Convex
- On reconnect: update `botStatus` again
- Dashboard shows real-time bot connection status via Convex subscription

### Rate Limiting

- Add a cooldown map in the bot hook (e.g., 1 command per user per 2 seconds)
- Convex mutations validate and reject if needed

---

## Dashboard

### Layout

The dashboard is the main UI after login. Top navigation bar with tab links, content below:

```
┌──────────────────────────────────────────────────────────┐
│  [Logo] Dirework   General Timer Tasks Styles ...  [👤 ▾]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Active tab content]                                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │                                                │      │
│  │         Live Overlay Preview                   │      │
│  │         (renders actual component)             │      │
│  │                                                │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tabs

1. **General** — Bot account connection, profile info
2. **Timer** — Duration settings, labels, sounds, display options
3. **Tasks** — Display options (checkboxes vs bullets, show done, max lines), fonts, scroll speed
4. **Styles** — Timer styles (colors, fonts, sizes, spacing) + Task list styles (header, body, task items, checkbox/bullet)
5. **Messages** — Customize all bot response messages (with `{user}` placeholder preview)
6. **Commands** — Alias editor: table of command → action mappings, add/remove/edit
7. **Overlays** — Show overlay URLs (with copy button), security warning, token regeneration button
8. **Analytics** — Pomodoro history stats (see below)

### Live Overlay Preview

Each style/config tab includes a live preview panel:

- Renders the actual overlay component (same React component, not an iframe) with current config
- Updates in real-time as the user changes settings
- Shows sample data (mock timer at "12:34", mock task list with 3 items)
- Toggle between "Timer Preview" and "Tasks Preview"

### Login Page (`/`)

Full-page centered layout, dark themed, welcoming and clear:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│                      [Logo Image]                        │
│                       Dirework                           │
│                                                          │
│          Focus timer & task tracker for your stream       │
│                                                          │
│       ┌──────────────────────────────────────┐           │
│       │  🟣  Sign in with Twitch             │           │
│       └──────────────────────────────────────┘           │
│                                                          │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│     │  ⏱️     │  │  ✅     │  │  💬     │               │
│     │ Pomodoro│  │  Tasks  │  │  Chat   │               │
│     │ Timer   │  │  List   │  │  Bot    │               │
│     │         │  │         │  │         │               │
│     │ Stay    │  │ Let     │  │ Your    │               │
│     │ focused │  │ viewers │  │ viewers │               │
│     │ with    │  │ track   │  │ control │               │
│     │ timed   │  │ their   │  │ it all  │               │
│     │ work    │  │ goals   │  │ via     │               │
│     │ sessions│  │ on      │  │ chat    │               │
│     │         │  │ stream  │  │ cmds    │               │
│     └─────────┘  └─────────┘  └─────────┘               │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Hero:** Logo + app name + one-line tagline
- **CTA:** Large, obvious "Sign in with Twitch" button (Twitch purple `#9146FF`)
- **Feature cards:** Three small cards below showing what the app does — Pomodoro Timer, Task List, Chat Bot — each with an icon and 2-line description. Helps non-techy users understand the app at a glance before signing in.
- **Dark theme** to match typical streamer aesthetics
- If already logged in, auto-redirects to `/dashboard`

### Top Navigation Bar

Persistent across all authenticated pages (dashboard, analytics):

```
┌──────────────────────────────────────────────────────────┐
│  [Logo] Dirework     General  Timer  Tasks  ...   [Avatar ▾] │
└──────────────────────────────────────────────────────────┘
```

- **Left:** Logo (placeholder image) + "Dirework" text
- **Center/Right:** Dashboard tab navigation links (General, Timer, Tasks, Styles, Messages, Commands, Overlays, Analytics)
- **Far Right:** User avatar + dropdown (Sign Out)

The nav replaces the sidebar layout — tabs live in the top bar for a cleaner look.

### Onboarding Flow (First Login)

1. User signs in with Twitch → redirected to `/dashboard`
2. Convex `users.getOrCreate` mutation runs — creates user + default config + overlay tokens
3. Dashboard detects no bot account → shows prominent "Connect Bot Account" card
4. After connecting bot → shows overlay URLs with instructions:
   - "Copy this URL and add it as a Browser Source in OBS"
   - "Set width/height to match your overlay dimensions"
   - Security warning: "Keep these URLs private!"
5. Once overlays are active in OBS → bot status shows "Connected" badges

---

## Analytics Page (`/dashboard/analytics`)

Shows pomodoro history from the `pomodoroHistory` table:

### Stats Displayed

- **Today:** Work sessions completed, total focus time, breaks taken
- **This Week:** Same as above, plus daily breakdown bar chart
- **This Month:** Same as above, plus weekly totals
- **Streak:** Consecutive days with at least 1 completed work session
- **Average:** Average work session duration, average sessions per day

### Implementation

- Convex query: `pomodoroHistory.getStats({ userId, range: "today" | "week" | "month" })`
- Aggregation done server-side in the query (filter by `completedAt` range, count, sum)
- Simple card layout with numbers, small bar charts with CSS/Tailwind (no heavy charting library for MVP)

---

## Deployment (Self-Hosted via Coolify)

### Convex Backend

Already running on Coolify as a self-hosted Convex instance. The Convex backend uses Docker with SQLite by default (Postgres optional for production scale).

Admin key generated via:
```bash
docker compose exec backend ./generate_admin_key.sh
```

### Next.js Service (on Coolify)

- Build: `pnpm build`
- Start: `pnpm start`
- Environment variables:
  - `NEXT_PUBLIC_CONVEX_URL=https://convex.yourdomain.com` — public URL to self-hosted Convex
  - `NEXT_PUBLIC_CONVEX_SITE_URL=https://convex.yourdomain.com` — same as above for self-hosted
  - `NEXT_PUBLIC_SITE_URL=https://dirework.yourdomain.com` — the Next.js app URL
  - Auth secrets (`BETTER_AUTH_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`) are set on the Convex instance, not Next.js

### Deploying Convex Functions to Production

```bash
# Uses CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY from .env.local
npx convex deploy
```

### Fumadocs Setup Guide

The `apps/docs/` site should cover:

1. **Prerequisites** — Coolify (or Docker), Twitch Developer App
2. **Twitch App Setup** — How to create a Twitch application at dev.twitch.tv, get client ID/secret, set redirect URLs
3. **Deployment** — Clone repo, configure env vars, deploy with Coolify
4. **Bot Account** — How to create a separate Twitch account for the bot
5. **OBS Setup** — How to add overlay Browser Sources, recommended dimensions
6. **Chat Commands** — Full command reference
7. **Customization** — Dashboard settings explained
8. **Troubleshooting** — Common issues (bot not connecting, token expired, etc.)

---

## Security

| Concern                        | Mitigation                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| **Overlay token = bot access** | Dashboard warns: "Keep your overlay URLs private!"                      |
| Overlay token leakage          | UUID v4 tokens, regeneration available in dashboard                     |
| Rate limiting (chat spam)      | Cooldown map in bot hooks + Convex mutation validation                  |
| XSS in task text               | Sanitize on insert, React escapes by default                            |
| Twitch OAuth scope creep       | Minimal scopes: `user:read:email` (login), `chat:read chat:edit` (bot)  |
| Bot token storage              | Stored in Convex, fetched only via overlay token                        |
| Bot token refresh              | Convex cron job refreshes expiring tokens every 30 minutes              |
| Config tampering               | Convex mutations validate against schema, require auth                  |

---

## Error Handling

### Bot Disconnection

- tmi.js fires `disconnected` event → overlay updates `botStatus` in Convex
- Dashboard shows real-time status badges (Connected / Offline)
- tmi.js auto-reconnects; on reconnect, update status back to connected

### Token Expiry

- Convex cron runs every 30 min, refreshes tokens expiring within 1 hour
- If refresh fails (token revoked), sets `botStatus.error` with message
- Dashboard shows error alert: "Bot token revoked. Please reconnect."
- User clicks "Reconnect Bot" → goes through bot OAuth flow again

### Overlay Errors

- If overlay can't reach Convex → show nothing (transparent, for OBS)
- If overlay token is invalid → render nothing
- Console errors logged for debugging

---

## File Structure

All UI built with [shadcn/ui](https://ui.shadcn.com/) components.

```
dirework/
├── apps/
│   ├── web/                                      # Next.js app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx                      # Login page (Sign in with Twitch)
│   │   │   │   ├── layout.tsx                    # Root layout with Providers
│   │   │   │   ├── api/auth/[...all]/route.ts    # better-auth API handlers
│   │   │   │   ├── auth/twitch/bot/
│   │   │   │   │   ├── route.ts                  # Bot OAuth redirect
│   │   │   │   │   └── callback/route.ts         # Bot OAuth callback
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── page.tsx                  # General tab (bot connection)
│   │   │   │   │   ├── timer/page.tsx            # Timer config
│   │   │   │   │   ├── tasks/page.tsx            # Tasks config
│   │   │   │   │   ├── styles/page.tsx           # Styles config
│   │   │   │   │   ├── messages/page.tsx         # Messages config
│   │   │   │   │   ├── commands/page.tsx         # Commands config
│   │   │   │   │   ├── overlays/page.tsx         # Overlay URLs
│   │   │   │   │   └── analytics/page.tsx        # Analytics
│   │   │   │   └── overlay/
│   │   │   │       ├── t/[token]/
│   │   │   │       │   ├── page.tsx              # Timer overlay
│   │   │   │       │   └── use-timer-bot.ts      # Timer bot hook (tmi.js)
│   │   │   │       └── l/[token]/
│   │   │   │           ├── page.tsx              # Task list overlay
│   │   │   │           └── use-tasks-bot.ts      # Tasks bot hook (tmi.js)
│   │   │   ├── components/
│   │   │   │   ├── header.tsx                    # Top nav bar with tab links
│   │   │   │   ├── user-menu.tsx                 # Avatar dropdown (sign out)
│   │   │   │   ├── providers.tsx                 # Convex + auth + theme wrapper
│   │   │   │   ├── theme-provider.tsx            # Dark/light mode
│   │   │   │   ├── timer-display.tsx             # Timer overlay component
│   │   │   │   ├── task-list-display.tsx          # Task list overlay component
│   │   │   │   └── ui/                           # shadcn/ui components
│   │   │   └── lib/
│   │   │       ├── auth-client.ts                # better-auth client instance
│   │   │       ├── auth-server.ts                # better-auth server helpers
│   │   │       ├── utils.ts                      # cn() helper
│   │   │       └── use-timer-display.ts          # Timer countdown hook
│   │   └── components.json                       # shadcn/ui config
│   └── fumadocs/                                 # Fumadocs documentation site
│       ├── src/app/
│       └── content/docs/
├── packages/
│   ├── backend/                                  # Convex backend
│   │   ├── convex/
│   │   │   ├── schema.ts                         # Full schema
│   │   │   ├── auth.config.ts                    # Convex auth config
│   │   │   ├── convex.config.ts                  # Register better-auth component
│   │   │   ├── auth.ts                           # better-auth instance (Twitch provider)
│   │   │   ├── http.ts                           # HTTP routes for better-auth
│   │   │   ├── defaults.ts                       # Default config values
│   │   │   ├── users.ts                          # User CRUD + bot account management
│   │   │   ├── tasks.ts                          # Task CRUD mutations + queries
│   │   │   ├── timer.ts                          # Timer state machine + scheduled transitions
│   │   │   ├── config.ts                         # Config CRUD mutations + queries
│   │   │   ├── overlay.ts                        # Token-based queries for overlays
│   │   │   ├── analytics.ts                      # History aggregation queries
│   │   │   ├── bot.ts                            # Token refresh logic
│   │   │   ├── crons.ts                          # Scheduled jobs (token refresh)
│   │   │   └── _generated/
│   │   └── .env.local                            # Self-hosted Convex credentials
│   ├── config/                                   # Shared TypeScript config
│   └── env/                                      # Environment variable validation (t3-env)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Implementation Phases

### Phase 1: Project Setup

**Goal:** Monorepo scaffolded, self-hosted Convex connected, better-auth working with Twitch login.

**Steps:**
1. Run the `create-better-t-stack` scaffold command (see above)
2. Configure `.env.local` with self-hosted Convex credentials:
   - `CONVEX_SELF_HOSTED_URL` — your Coolify-hosted Convex URL
   - `CONVEX_SELF_HOSTED_ADMIN_KEY` — generated via `docker compose exec backend ./generate_admin_key.sh` on Coolify
   - `NEXT_PUBLIC_CONVEX_URL` — same as self-hosted URL
   - `NEXT_PUBLIC_CONVEX_SITE_URL` — same as self-hosted URL
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
3. Verify `npx convex dev` connects to self-hosted instance and `pnpm dev` starts Next.js
4. Register a Twitch application at dev.twitch.tv with redirect URI `http://localhost:3000/api/auth/callback/twitch`
5. Set Convex environment variables on self-hosted instance (`BETTER_AUTH_SECRET`, `SITE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`)
6. Configure better-auth Convex component with Twitch provider (see Authentication section for exact files)
7. Create login page (`/`) with "Sign in with Twitch" button
8. Create protected `/dashboard` page (redirects to `/` if not authenticated)
9. Verify: sign in with Twitch → land on dashboard → sign out → redirect to login

**Files created:**
- `.env.local` (gitignored — self-hosted Convex credentials)
- `convex/convex.config.ts`, `convex/auth.config.ts`, `convex/auth.ts`, `convex/http.ts`
- `apps/web/app/page.tsx` (login), `apps/web/app/dashboard/page.tsx`, `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/api/auth/[...all]/route.ts`
- `apps/web/components/convex-client-provider.tsx`
- `apps/web/lib/auth-client.ts`, `apps/web/lib/auth-server.ts`

**Acceptance:** User can sign in with Twitch and see the dashboard. Convex (self-hosted) has the user record.

---

### Phase 2: Schema & Defaults

**Goal:** Full schema deployed, default config seeded on user creation.

**Steps:**
1. Write complete `convex/schema.ts` (as defined above)
2. Create `convex/defaults.ts` with all default values for config
3. Write `convex/users.ts` with `getOrCreate` mutation that:
   - Checks if user exists by `twitchId`
   - If not, creates user + generates overlay tokens (UUID v4) + inserts default config + creates idle `timerState`
4. Wire `getOrCreate` into the auth flow (called after successful login)
5. Deploy schema: `npx convex dev` (auto-deploys in dev mode)

**Files created:**
- `convex/schema.ts`, `convex/defaults.ts`, `convex/users.ts`

**Acceptance:** After login, user has a `users` doc, a `config` doc with defaults, and a `timerState` doc set to `idle`.

---

### Phase 3: Bot OAuth Flow

**Goal:** Streamer can connect a bot Twitch account from the dashboard.

**Steps:**
1. Create bot OAuth redirect route: `apps/web/app/auth/twitch/bot/route.ts`
   - Verify user is logged in
   - Redirect to Twitch OAuth with `force_verify: true`, scopes `chat:read chat:edit`
2. Create bot OAuth callback: `apps/web/app/auth/twitch/bot/callback/route.ts`
   - Exchange code for tokens
   - Fetch bot user info from Twitch API
   - Call `convex/users.connectBotAccount` mutation
   - Redirect to `/dashboard?bot=connected`
3. Build dashboard General tab with bot connection card:
   - Shows bot username + avatar when connected
   - Shows connection status badges (from `botStatus`)
   - Connect / Disconnect buttons
4. Write `convex/users.ts` mutations: `connectBotAccount`, `disconnectBotAccount`, `updateBotStatus`

**Files created:**
- `apps/web/app/auth/twitch/bot/route.ts`
- `apps/web/app/auth/twitch/bot/callback/route.ts`
- `apps/web/app/dashboard/components/general-tab.tsx`
- Updates to `convex/users.ts`

**Acceptance:** Streamer can connect a bot account, see its info in the dashboard, and disconnect it.

---

### Phase 4: Timer State Machine

**Goal:** Full timer lifecycle working in Convex with scheduled transitions.

**Steps:**
1. Write `convex/timer.ts` with mutations:
   - `start({ token, cycles })` — Set status to `starting`, then to `work` with `targetEndTime`, schedule transition
   - `pause({ token })` — Calculate remaining, store in `pausedWithRemaining`, cancel scheduled function
   - `resume({ token })` — Set new `targetEndTime` from remaining, reschedule transition
   - `skip({ token })` — Immediately transition to next phase
   - `getByToken({ token })` — Query for overlay
2. Write `scheduleTimerTransition` internal mutation:
   - Handles all transitions: work→break, break→work, work→longBreak, longBreak→work, last cycle→finished
   - Logs each completed phase to `pomodoroHistory`
   - Schedules the next transition
3. Handle edge cases:
   - `noLastBreak` config option — skip final break, go straight to finished
   - `starting` phase — brief countdown before first work session
   - Cancel all scheduled functions on `stop` or `skip`

**Files created:**
- `convex/timer.ts`

**Acceptance:** Timer can be started, paused, resumed, skipped. Transitions happen automatically. History is logged.

---

### Phase 5: Timer Overlay + Bot

**Goal:** Timer overlay renders in OBS and responds to Twitch chat commands.

**Steps:**
1. Create `apps/web/lib/use-timer-display.ts` — countdown hook using `targetEndTime`
2. Create `apps/web/components/timer-display.tsx` — renders time, status label, cycle count with configurable styles
3. Create `apps/web/app/overlay/t/[token]/page.tsx` — transparent background, no layout chrome
4. Create `apps/web/app/overlay/t/[token]/use-timer-bot.ts` — tmi.js hook:
   - Connects to Twitch chat with bot credentials
   - Routes commands via `commandAliases`
   - Handles `timer:start`, `timer:pause`, `timer:resume`, `timer:skip`, `timer:time`
   - Updates `botStatus`
5. Write `convex/overlay.ts` query: `getTimerData({ token })` — returns user data + bot credentials

**Files created:**
- `apps/web/lib/use-timer-display.ts`
- `apps/web/components/timer-display.tsx`
- `apps/web/app/overlay/t/[token]/page.tsx`
- `apps/web/app/overlay/t/[token]/use-timer-bot.ts`
- `convex/overlay.ts`

**Acceptance:** Opening `/overlay/t/[token]` shows a timer. Typing `!pomo` in Twitch chat starts it. Timer counts down and transitions.

---

### Phase 6: Tasks CRUD + Overlay + Bot

**Goal:** Task list overlay renders and responds to chat commands.

**Steps:**
1. Write `convex/tasks.ts` with mutations:
   - `add({ token, text, authorUsername, authorColor })` — add task at end
   - `finish({ token, authorUsername })` — mark user's first pending task as done
   - `edit({ token, authorUsername, newText })` — edit user's pending task
   - `delete({ token, authorUsername })` — remove user's pending task
   - `clear({ token, doneOnly })` — mod-only, clear all or done tasks
   - `getByToken({ token })` — query all tasks for overlay
2. Create `apps/web/components/task-list-display.tsx` — renders task list with configurable styles
3. Create `apps/web/app/overlay/l/[token]/page.tsx` — transparent background
4. Create `apps/web/app/overlay/l/[token]/use-tasks-bot.ts` — tmi.js hook for task commands
5. Add to `convex/overlay.ts`: `getTasksData({ token })`

**Files created:**
- `convex/tasks.ts`
- `apps/web/components/task-list-display.tsx`
- `apps/web/app/overlay/l/[token]/page.tsx`
- `apps/web/app/overlay/l/[token]/use-tasks-bot.ts`
- Updates to `convex/overlay.ts`

**Acceptance:** Opening `/overlay/l/[token]` shows task list. `!task Buy milk` adds a task. `!done` completes it.

---

### Phase 7: Dashboard Config UI

**Goal:** All settings configurable through the dashboard with live overlay preview.

**Steps:**
1. Write `convex/config.ts` with mutations:
   - `getByUserId({ userId })` — fetch config
   - `updateTimer({ userId, timer })` — update timer settings
   - `updateTimerStyles({ userId, timerStyles })` — update timer styles
   - `updateTaskStyles({ userId, taskStyles })` — update task styles
   - `updateMessages({ userId, messages })` — update messages
   - `updateCommandAliases({ userId, commandAliases })` — update aliases
   - `getByToken({ token })` — for overlay use
2. Build dashboard tabs:
   - **Timer Config:** Forms for durations, labels, sounds, display options
   - **Tasks Config:** Forms for display options, fonts, scroll speed
   - **Styles:** Color pickers, size inputs, font selectors — split into timer styles and task styles sections
   - **Messages:** Text inputs for each message with `{user}` / `{task}` placeholder docs
   - **Commands:** Table with alias → action mapping, add/remove rows
   - **Overlays:** Display URLs, copy buttons, regenerate tokens button
3. Build `overlay-preview.tsx`:
   - Renders `<TimerDisplay>` and `<TaskListDisplay>` with current config values
   - Uses mock data (sample time, sample tasks)
   - Updates live as user changes settings
   - Tab to switch between timer and task preview
4. Each config form auto-saves on change (debounced Convex mutation)

**Files created:**
- `convex/config.ts`
- `apps/web/app/dashboard/components/` — all tab components
- `apps/web/app/dashboard/components/overlay-preview.tsx`

**Acceptance:** All settings can be changed in dashboard, preview updates live, changes persist and show in actual overlays.

---

### Phase 8: Analytics

**Goal:** Basic pomodoro stats displayed on analytics page.

**Steps:**
1. Write `convex/analytics.ts` with queries:
   - `getStats({ userId, range })` — aggregate `pomodoroHistory` for today/week/month
   - `getStreak({ userId })` — count consecutive days with completed work sessions
2. Create `apps/web/app/dashboard/analytics/page.tsx`
3. Create `apps/web/app/dashboard/components/analytics-cards.tsx`:
   - Today card: sessions, total focus time, breaks
   - Week card: daily breakdown (simple CSS bars), totals
   - Month card: weekly breakdown, totals
   - Streak card: current streak + longest streak
   - Average card: avg session duration, avg sessions/day

**Files created:**
- `convex/analytics.ts`
- `apps/web/app/dashboard/analytics/page.tsx`
- `apps/web/app/dashboard/components/analytics-cards.tsx`

**Acceptance:** Analytics page shows accurate stats from `pomodoroHistory` data.

---

### Phase 9: Token Refresh Cron + Error Handling

**Goal:** Bot tokens auto-refresh, errors surface to the user.

**Steps:**
1. Write `convex/bot.ts`:
   - `refreshExpiringTokens` internal action — find tokens expiring within 1 hour, refresh via Twitch API
   - Handle refresh failure: set `botStatus.error`
2. Write `convex/crons.ts`:
   - `crons.interval("refresh-bot-tokens", { minutes: 30 }, internal.bot.refreshExpiringTokens)`
3. Write `convex/users.ts` helpers: `getUsersWithExpiringTokens`, `updateBotTokens`, `setBotError`
4. Dashboard General tab: show error alerts from `botStatus.error`

**Files created:**
- `convex/bot.ts`
- `convex/crons.ts`
- Updates to `convex/users.ts`

**Acceptance:** Bot tokens refresh automatically. If a token is revoked, dashboard shows the error.

---

### Phase 10: Documentation Site

**Goal:** Fumadocs site with self-hosting guide.

**Steps:**
1. Configure Fumadocs in `apps/docs/` (should be scaffolded by better-t-stack)
2. Write documentation pages:
   - Getting Started: prerequisites, Twitch app setup
   - Deployment: Coolify/Docker setup, env vars
   - Bot Setup: creating bot account, connecting via dashboard
   - OBS Setup: browser source dimensions, URL configuration
   - Commands Reference: full list of commands and actions
   - Customization: dashboard settings guide
   - Troubleshooting: common issues and fixes
3. Add link to docs from dashboard footer/navbar

**Files created:**
- `apps/docs/content/docs/` — all MDX files

**Acceptance:** Documentation site builds and serves, covers full setup from zero to working.

---

### Phase 11: Polish

**Goal:** Final cleanup and quality of life improvements.

**Steps:**
1. Overlay token regeneration in dashboard (with confirmation dialog)
2. Rate limiting in bot hooks (cooldown per user per command)
3. Loading states and skeletons for dashboard
4. Responsive dashboard layout (works on tablet, adequate on mobile)
5. Dark mode support for dashboard (Tailwind dark mode)
6. Meta tags and favicon
7. Error boundaries for overlay pages (render nothing on error — transparent for OBS)
