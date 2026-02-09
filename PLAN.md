# Dirework — Pomodoro Timer & Task Tracker with Twitch Integration

Self-hosted Pomodoro timer and task list with Twitch chat integration. Streamers login with Twitch, connect a bot account, configure overlays, and add them to OBS. Viewers interact via `!pomo`, `!task`, `!done`.

---

## Key Design Decisions

- **Self-hosted & open-source** — Each streamer deploys their own instance
- **Single user per instance** — Controlled via `ALLOWED_TWITCH_IDS` env var
- **Better Auth** — Handles Twitch OAuth via social provider plugin
- **tRPC API** — Type-safe API via Next.js API routes
- **Bot runs in overlays** — No separate bot service; @twurple runs inside OBS browser sources
- **Multiple tasks per user** — Viewers can have multiple active tasks simultaneously
- **Co-working stream focused** — Designed for body doubling / focus streams

---

## Tech Stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Frontend      | Next.js (App Router), React, Tailwind, shadcn/ui |
| Backend       | Next.js API routes + tRPC                        |
| Auth          | Better Auth (Twitch social provider)             |
| Database      | PostgreSQL (Docker) + Prisma ORM                 |
| Chat Bot      | @twurple (runs inside overlay browser sources)   |
| Documentation | Fumadocs                                         |
| Monorepo      | Turborepo + pnpm workspaces                      |
| Deployment    | Coolify (Docker Compose)                         |

---

## Database Setup (Docker)

### docker-compose.yml (development)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: dirework
      POSTGRES_PASSWORD: dirework
      POSTGRES_DB: dirework
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Environment Variables

**`.env`** (root):

```bash
# Database
DATABASE_URL="postgresql://dirework:dirework@localhost:5432/dirework"

# Better Auth
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL="http://localhost:3000" # Next.js app URL

# Twitch OAuth (from dev.twitch.tv)
TWITCH_CLIENT_ID="<your_client_id>"
TWITCH_CLIENT_SECRET="<your_client_secret>"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# User allowlist (comma-separated Twitch user IDs)
# Leave empty to allow all users
ALLOWED_TWITCH_IDS="12345678,87654321"
```

### Dev Commands

```bash
docker compose up -d          # Start PostgreSQL
pnpm db:push                  # Push Prisma schema to DB
pnpm db:studio                # Open Prisma Studio
pnpm dev                      # Start all apps (Turborepo)
```

---

## Prisma Schema

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Better Auth tables ───────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String
  email         String?   @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]

  // Dirework-specific
  twitchId         String?  @unique
  displayName      String?
  overlayTimerToken String  @default(uuid())
  overlayTasksToken String  @default(uuid())

  botAccount    BotAccount?
  timerState    TimerState?
  config        Config?
  tasks         Task[]       @relation("TaskOwner")

  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("account")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}

// ─── Dirework tables ──────────────────────────────────────────

model BotAccount {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  twitchId     String
  username     String
  displayName  String
  accessToken  String
  refreshToken String
  expiresAt    DateTime
  scopes       String[] @default(["chat:read", "chat:edit"])
  connectedAt  DateTime @default(now())

  @@map("bot_account")
}

model Task {
  id                 String    @id @default(cuid())
  ownerId            String
  owner              User      @relation("TaskOwner", fields: [ownerId], references: [id], onDelete: Cascade)

  // Task author (viewer who created the task)
  authorTwitchId     String
  authorUsername     String
  authorDisplayName  String
  authorColor        String?

  // Task content
  text               String
  status             String    @default("pending") // "pending" | "done"
  order              Int

  createdAt          DateTime  @default(now())
  completedAt        DateTime?

  @@index([ownerId, status])
  @@index([ownerId, order])
  @@index([ownerId, authorTwitchId])
  @@map("task")
}

model TimerState {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status               String   @default("idle") // "idle" | "starting" | "work" | "break" | "longBreak" | "paused" | "finished"
  targetEndTime        DateTime?
  pausedWithRemaining  Int?     // milliseconds remaining when paused
  currentCycle         Int      @default(1)
  totalCycles          Int      @default(4)
  lastUpdated          DateTime @default(now())

  @@map("timer_state")
}

model Config {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  timer           Json     // Timer config object
  timerStyles     Json     // Timer CSS values
  taskStyles      Json     // Task list CSS values
  messages        Json     // Bot response messages
  commandAliases  Json     @default("{}")
  updatedAt       DateTime @updatedAt

  @@map("config")
}
```

---

## Authentication

### Overview

**Better Auth** handles the entire auth flow via its Twitch social provider. The Next.js app hosts the Better Auth API routes, and the frontend uses the Better Auth client.

### Better Auth Server Config

**`packages/auth/server.ts`**:

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@dirework/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    twitch: {
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
});

export type Auth = typeof auth;
```

### Better Auth Client Config

**`packages/auth/client.ts`**:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
});

export const { signIn, signOut, useSession } = authClient;
```

### Auth Flow

1. User clicks "Sign in with Twitch" on landing page
2. `authClient.signIn.social({ provider: "twitch" })` redirects to Twitch OAuth
3. Twitch redirects back to Better Auth callback on Next.js
4. Better Auth creates/updates user, creates session
5. Post-login hook checks `ALLOWED_TWITCH_IDS` allowlist
6. Redirects to `/dashboard` (or `/?error=unauthorized` if not in allowlist)

### Next.js Auth Route

**`apps/web/src/app/api/auth/[...all]/route.ts`**:

```typescript
import { auth } from "@dirework/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Client Auth Usage

```typescript
// Sign in
import { signIn } from "@dirework/auth/client";
<button onClick={() => signIn.social({ provider: "twitch" })}>
  Sign in with Twitch
</button>

// In components
import { useSession } from "@dirework/auth/client";
const { data: session, isPending } = useSession();
```

---

## tRPC Setup

### Router

**`apps/web/src/server/trpc/router.ts`**:

```typescript
import { router } from "./trpc";
import { userRouter } from "./routers/user";
import { taskRouter } from "./routers/task";
import { timerRouter } from "./routers/timer";
import { configRouter } from "./routers/config";
import { overlayRouter } from "./routers/overlay";

export const appRouter = router({
  user: userRouter,
  task: taskRouter,
  timer: timerRouter,
  config: configRouter,
  overlay: overlayRouter,
});

export type AppRouter = typeof appRouter;
```

### Context & Auth Middleware

**`apps/web/src/server/trpc/trpc.ts`**:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@dirework/auth/server";
import { prisma } from "@dirework/db";

export const createContext = async (opts: { req: Request }) => {
  const session = await auth.api.getSession({ headers: opts.req.headers });
  return { session, prisma };
};

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

### Real-Time (tRPC Subscriptions via SSE)

Timer and task list overlays subscribe to changes via tRPC subscriptions using Server-Sent Events:

```typescript
// apps/web/src/server/trpc/routers/overlay.ts
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { EventEmitter } from "events";

const ee = new EventEmitter();

export const overlayRouter = router({
  onTimerUpdate: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(({ input }) => {
      return observable((emit) => {
        const handler = (data: any) => emit.next(data);
        ee.on(`timer:${input.token}`, handler);
        return () => ee.off(`timer:${input.token}`, handler);
      });
    }),

  onTasksUpdate: publicProcedure
    .input(z.object({ token: z.string() }))
    .subscription(({ input }) => {
      return observable((emit) => {
        const handler = (data: any) => emit.next(data);
        ee.on(`tasks:${input.token}`, handler);
        return () => ee.off(`tasks:${input.token}`, handler);
      });
    }),
});

// Emit from mutations
export function emitTimerUpdate(token: string, data: any) {
  ee.emit(`timer:${token}`, data);
}

export function emitTasksUpdate(token: string, data: any) {
  ee.emit(`tasks:${token}`, data);
}
```

---

## Landing Page

Minimal, clean design. Just the essentials.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                                 │
│              ┌─────────────────┐                │
│              │     [Logo]      │                │
│              │    Dirework     │                │
│              └─────────────────┘                │
│                                                 │
│        Focus timer for your Twitch stream       │
│                                                 │
│         ┌───────────────────────────┐           │
│         │   Sign in with Twitch     │           │
│         └───────────────────────────┘           │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

Features:

- Dark background (`bg-zinc-950`)
- Centered vertically and horizontally
- Logo + "Dirework" text
- One-line tagline
- Twitch purple login button (`#9146FF`)
- Shows error toast if `?error=unauthorized`
- Auto-redirects to `/dashboard` if already authenticated

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    NEXT.JS (apps/web)                       │
├────────────────────────────────────────────────────────────┤
│  Pages:                                                    │
│  /                        Landing page (Sign in button)    │
│  /dashboard               Config UI + overlay preview      │
│  /overlay/t/[token]       Timer overlay (OBS browser src)  │
│  /overlay/l/[token]       Task list overlay (OBS browser)  │
├────────────────────────────────────────────────────────────┤
│  API Routes:                                               │
│  /api/auth/[...all]       Better Auth (Twitch OAuth)       │
│  /api/trpc/[trpc]         tRPC router                      │
│  /api/bot/*               Bot OAuth routes                 │
├────────────────────────────────────────────────────────────┤
│  tRPC Routers:                                             │
│    user      → Profile, bot account management             │
│    task      → CRUD for viewer tasks                       │
│    timer     → State machine mutations + queries           │
│    config    → Style/message/command config                 │
│    overlay   → Public queries by token + subscriptions     │
└────────────────────────────────────────────────────────────┘
         ↕ Prisma ORM

┌────────────────────────────────────────────────────────────┐
│                   POSTGRESQL (Docker)                       │
├────────────────────────────────────────────────────────────┤
│  Tables: user, session, account, verification,             │
│          bot_account, task, timer_state, config             │
└────────────────────────────────────────────────────────────┘
```

---

## Bot Account OAuth

Separate OAuth flow for the bot account (via Next.js API routes):

1. Dashboard shows "Connect Bot Account" button
2. Links to `/api/bot/authorize` which redirects to Twitch OAuth
3. Twitch OAuth with `force_verify: true` and scopes `chat:read chat:edit`
4. Callback at `/api/bot/callback` stores tokens in PostgreSQL
5. Redirects back to `/dashboard?bot=connected`

**`apps/web/src/app/api/bot/authorize/route.ts`**:

```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@dirework/auth/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/?error=not_authenticated");

  const state = Buffer.from(JSON.stringify({ userId: session.user.id })).toString("base64");

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/bot/callback`,
    response_type: "code",
    scope: "chat:read chat:edit",
    force_verify: "true",
    state,
  });

  redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
}
```

**`apps/web/src/app/api/bot/callback/route.ts`**:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dirework/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard?bot=error", request.url));
  }

  const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

  // Exchange code for tokens
  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/bot/callback`,
    }),
  });
  const tokens = await tokenRes.json();

  // Get bot user info
  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });
  const { data: [botUser] } = await userRes.json();

  // Upsert bot account
  await prisma.botAccount.upsert({
    where: { userId },
    update: {
      twitchId: botUser.id,
      username: botUser.login,
      displayName: botUser.display_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    create: {
      userId,
      twitchId: botUser.id,
      username: botUser.login,
      displayName: botUser.display_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return NextResponse.redirect(new URL("/dashboard?bot=connected", request.url));
}
```

---

## Chat Commands

### Task Commands (All Viewers)

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `!task <text>`          | Add a new task (multiple tasks allowed per user) |
| `!done`                 | Mark your oldest pending task as done            |
| `!done <number>`        | Mark a specific task by number as done           |
| `!edit <text>`          | Edit your oldest pending task                    |
| `!edit <number> <text>` | Edit a specific task by number                   |
| `!remove`               | Remove your oldest pending task                  |
| `!remove <number>`      | Remove a specific task by number                 |
| `!check`                | Show your current tasks                          |
| `!check @user`          | Show another user's tasks                        |

### Task Commands (Mods Only)

| Command       | Description                           |
| ------------- | ------------------------------------- |
| `!clear`      | Clear all tasks from the list         |
| `!cleardone`  | Clear all completed tasks             |
| `!adel @user` | Remove all tasks from a specific user |

### Timer Commands

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `!timer start`      | Start the timer with default settings              |
| `!timer <minutes>`  | Set timer to specific duration (e.g., `!timer 25`) |
| `!timer pause`      | Pause the timer                                    |
| `!timer resume`     | Resume the timer                                   |
| `!timer skip`       | Skip current session                               |
| `!timer goal <num>` | Set number of pomodoro cycles                      |
| `!time`             | Show remaining time                                |
| `!eta`              | Show when timer ends (local time)                  |

---

## Overlay Styling (Tailwind + shadcn/ui)

Inspired by [Chat-Task-Tic](https://github.com/liyunze-coding/Chat-Task-Tic-Overlay-Infinity) and [Minimal-Pomo-Timer](https://github.com/mohamed-tayeh/Minimal-Pomo-Timer).

### Timer Overlay

Clean, minimal circular or rectangular timer display:

```tsx
// components/timer-display.tsx
export function TimerDisplay({ config, state }: TimerDisplayProps) {
  const remaining = useTimerCountdown(state.targetEndTime);
  const { minutes, seconds } = formatTime(remaining);

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: config.dimensions.width,
        height: config.dimensions.height,
        backgroundColor: `${config.background.color}${toHexOpacity(config.background.opacity)}`,
        borderRadius: config.background.borderRadius,
        fontFamily: config.text.fontFamily,
      }}
    >
      {/* Status label */}
      <span
        className="font-medium uppercase tracking-wide"
        style={{
          fontSize: config.fontSizes.label,
          color: config.text.color,
          textShadow:
            config.text.outlineSize !== "0px"
              ? `0 0 ${config.text.outlineSize} ${config.text.outlineColor}`
              : "none",
        }}
      >
        {config.labels[state.status] ?? state.status}
      </span>

      {/* Time */}
      <span
        className="font-bold tabular-nums"
        style={{
          fontSize: config.fontSizes.time,
          color: config.text.color,
          textShadow:
            config.text.outlineSize !== "0px"
              ? `0 0 ${config.text.outlineSize} ${config.text.outlineColor}`
              : "none",
        }}
      >
        {minutes}:{seconds}
      </span>

      {/* Cycle count */}
      <span
        className="font-medium"
        style={{
          fontSize: config.fontSizes.cycle,
          color: config.text.color,
        }}
      >
        {state.currentCycle}/{state.totalCycles}
      </span>
    </div>
  );
}
```

### Task List Overlay

Scrolling task list with header showing count:

```tsx
// components/task-list-display.tsx
export function TaskListDisplay({ config, tasks }: TaskListDisplayProps) {
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const displayTasks = config.display.showDone
    ? [...pendingTasks, ...doneTasks]
    : pendingTasks;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        fontFamily: config.fonts.body,
        borderRadius: config.body.border.radius,
        borderWidth: config.body.border.width,
        borderColor: config.body.border.color,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: `${config.header.background.color}${toHexOpacity(config.header.background.opacity)}`,
          borderBottomWidth: config.header.border.width,
          borderColor: config.header.border.color,
        }}
      >
        <span
          className="font-semibold"
          style={{
            fontFamily: config.fonts.header,
            fontSize: config.header.fontSize,
            color: config.header.fontColor,
          }}
        >
          Tasks
        </span>
        {config.display.showCount && (
          <span
            className="text-sm opacity-75"
            style={{ color: config.header.fontColor }}
          >
            {doneTasks.length}/{tasks.length}
          </span>
        )}
      </div>

      {/* Task list with infinite scroll */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: `${config.body.background.color}${toHexOpacity(config.body.background.opacity)}`,
          padding: `${config.body.padding.vertical} ${config.body.padding.horizontal}`,
        }}
      >
        <InfiniteScroll
          pixelsPerSecond={config.scroll.pixelsPerSecond}
          gap={config.scroll.gapBetweenLoops}
        >
          {displayTasks.map((task, idx) => (
            <TaskItem
              key={task.id}
              task={task}
              index={idx + 1}
              config={config}
            />
          ))}
        </InfiniteScroll>
      </div>
    </div>
  );
}

function TaskItem({ task, index, config }: TaskItemProps) {
  const isDone = task.status === "done";

  return (
    <div
      className="flex items-start gap-2 transition-opacity"
      style={{
        backgroundColor: isDone
          ? `${config.taskDone.background.color}${toHexOpacity(config.taskDone.background.opacity)}`
          : `${config.task.background.color}${toHexOpacity(config.task.background.opacity)}`,
        borderRadius: config.task.border.radius,
        borderWidth: config.task.border.width,
        borderColor: config.task.border.color,
        padding: config.task.padding,
        marginBottom: config.task.marginBottom,
        maxWidth: config.task.maxWidth,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      {/* Checkbox or bullet */}
      {config.display.useCheckboxes ? (
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: config.checkbox.size,
            height: config.checkbox.size,
            backgroundColor: `${config.checkbox.background.color}${toHexOpacity(config.checkbox.background.opacity)}`,
            borderRadius: config.checkbox.border.radius,
            borderWidth: config.checkbox.border.width,
            borderColor: config.checkbox.border.color,
            marginTop: config.checkbox.margin.top,
          }}
        >
          {isDone && (
            <span
              style={{
                fontSize: config.checkbox.tickSize,
                color: config.checkbox.tickColor,
              }}
            >
              {config.checkbox.tickChar}
            </span>
          )}
        </div>
      ) : (
        <span
          className="flex-shrink-0"
          style={{
            fontSize: config.bullet.size,
            color: config.bullet.color,
            marginTop: config.bullet.margin.top,
          }}
        >
          {config.bullet.char}
        </span>
      )}

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <span
          className="font-medium"
          style={{
            color: task.authorColor || config.task.usernameColor,
            fontSize: config.task.fontSize,
          }}
        >
          {task.authorDisplayName}
        </span>
        <span style={{ color: config.task.fontColor }}>: </span>
        <span
          className={isDone && config.display.crossOnDone ? "line-through" : ""}
          style={{
            color: isDone ? config.taskDone.fontColor : config.task.fontColor,
            fontSize: config.task.fontSize,
          }}
        >
          {task.text}
        </span>
      </div>
    </div>
  );
}
```

### Default Style Config

```typescript
// packages/db/src/defaults.ts
export const defaultTaskStyles = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    reverseOrder: false,
    maxLines: 2,
  },
  fonts: {
    header: "Inter",
    body: "Inter",
  },
  scroll: {
    pixelsPerSecond: 30,
    gapBetweenLoops: 50,
  },
  header: {
    height: "48px",
    background: { color: "#18181b", opacity: 0.9 },
    border: { color: "#27272a", width: "1px", radius: "8px 8px 0 0" },
    fontSize: "18px",
    fontColor: "#ffffff",
    padding: "12px",
  },
  body: {
    background: { color: "#09090b", opacity: 0.85 },
    border: { color: "#27272a", width: "1px", radius: "0 0 8px 8px" },
    padding: { vertical: "12px", horizontal: "12px" },
  },
  task: {
    background: { color: "#18181b", opacity: 0.8 },
    border: { color: "#27272a", width: "1px", radius: "6px" },
    fontSize: "14px",
    fontColor: "#e4e4e7",
    usernameColor: "", // Empty = use Twitch color
    padding: "8px 12px",
    marginBottom: "8px",
    maxWidth: "100%",
  },
  taskDone: {
    background: { color: "#18181b", opacity: 0.5 },
    fontColor: "#71717a",
  },
  checkbox: {
    size: "18px",
    background: { color: "#27272a", opacity: 1 },
    border: { color: "#3f3f46", width: "2px", radius: "4px" },
    margin: { top: "2px", left: "0", right: "8px" },
    tickChar: "✓",
    tickSize: "12px",
    tickColor: "#22c55e",
  },
  bullet: {
    char: "•",
    size: "18px",
    color: "#a1a1aa",
    margin: { top: "0", left: "0", right: "8px" },
  },
};

export const defaultTimerStyles = {
  dimensions: { width: "250px", height: "250px" },
  background: { color: "#000000", opacity: 0.5, borderRadius: "50%" },
  text: {
    color: "#ffffff",
    outlineColor: "#000000",
    outlineSize: "0px",
    fontFamily: "Inter",
  },
  fontSizes: { label: "24px", time: "48px", cycle: "20px" },
  spacing: {
    labelTop: "0px",
    labelLeft: "auto",
    timeTop: "0px",
    timeLeft: "auto",
    cycleTop: "0px",
    cycleRight: "auto",
  },
  layout: "column" as const,
};
```

---

## Timer Synchronization

Server-authoritative timing using `targetEndTime`:

1. `timerState.targetEndTime` = timestamp when timer hits 0
2. Client calculates: `remaining = targetEndTime - Date.now()`
3. On pause: store `pausedWithRemaining`, clear `targetEndTime`
4. On resume: set new `targetEndTime` from remaining

### State Machine

```
idle ──(start)──> starting ──> work ──> break ──> work ──> ...
                                │          │
                                v          v
                             paused     paused
                                │          │
                            (resume)   (resume)

After longBreakInterval: work → longBreak → work
After all cycles: → finished → idle
```

---

## File Structure

```
dirework/
├── apps/
│   ├── web/                              # Next.js app (frontend + API)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx              # Landing page
│   │   │   │   ├── layout.tsx            # Root layout + providers
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...all]/route.ts  # Better Auth handler
│   │   │   │   │   ├── trpc/[trpc]/route.ts    # tRPC handler
│   │   │   │   │   └── bot/
│   │   │   │   │       ├── authorize/route.ts   # Bot OAuth redirect
│   │   │   │   │       └── callback/route.ts    # Bot OAuth callback
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── layout.tsx        # Dashboard layout
│   │   │   │   │   ├── page.tsx          # General tab
│   │   │   │   │   ├── timer/page.tsx
│   │   │   │   │   ├── tasks/page.tsx
│   │   │   │   │   ├── styles/page.tsx
│   │   │   │   │   ├── messages/page.tsx
│   │   │   │   │   ├── commands/page.tsx
│   │   │   │   │   └── overlays/page.tsx
│   │   │   │   └── overlay/
│   │   │   │       ├── t/[token]/page.tsx    # Timer overlay
│   │   │   │       └── l/[token]/page.tsx    # Task list overlay
│   │   │   ├── components/
│   │   │   │   ├── providers.tsx         # tRPC + auth providers
│   │   │   │   ├── header.tsx
│   │   │   │   ├── timer-display.tsx
│   │   │   │   ├── task-list-display.tsx
│   │   │   │   └── ui/                   # shadcn/ui
│   │   │   ├── server/
│   │   │   │   └── trpc/
│   │   │   │       ├── trpc.ts           # tRPC init + context
│   │   │   │       ├── router.ts         # Root router
│   │   │   │       └── routers/
│   │   │   │           ├── user.ts
│   │   │   │           ├── task.ts
│   │   │   │           ├── timer.ts
│   │   │   │           ├── config.ts
│   │   │   │           └── overlay.ts
│   │   │   └── lib/
│   │   │       ├── trpc.ts              # tRPC client
│   │   │       └── utils.ts
│   │   └── components.json
│   └── docs/                             # Fumadocs
├── packages/
│   └── db/                               # Prisma + defaults
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── index.ts                 # Prisma client export
│       │   └── defaults.ts             # Default configs
│       └── package.json
├── docker-compose.yml                    # PostgreSQL
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Implementation Phases

### Phase 1: Setup + Auth

1. Scaffold with:
   ```bash
   pnpm create better-t-stack@latest my-better-t-app --frontend next --backend self --runtime none --api trpc --auth better-auth --payments none --database postgres --orm prisma --db-setup docker --package-manager pnpm --no-git --web-deploy none --server-deploy none --no-install --addons fumadocs turborepo --examples none
   ```
2. Configure PostgreSQL via Docker
3. Add Twitch social provider to Better Auth
4. Implement user allowlist check via `ALLOWED_TWITCH_IDS` env var
5. Create landing page with Twitch login button
6. Create protected dashboard (redirect if not authenticated)

**Acceptance:** Login works, unauthorized users see error, auth users reach dashboard.

### Phase 2: Schema + User Setup

1. Deploy full Prisma schema (`prisma db push`)
2. Create defaults for config
3. Seed overlay tokens on first login (Better Auth hook)

### Phase 3: Bot OAuth

1. Add bot OAuth API routes
2. Dashboard General tab with bot connection UI
3. Connect/disconnect bot account mutations via tRPC

### Phase 4: Timer

1. Timer state machine mutations (tRPC)
2. tRPC subscriptions for real-time overlay updates
3. Timer overlay + @twurple bot integration

### Phase 5: Tasks

1. Task CRUD mutations (tRPC)
2. Task list overlay + @twurple bot integration

### Phase 6: Dashboard Config

1. All config tabs with live preview
2. Auto-save on change via tRPC mutations

### Phase 7: Polish

1. Bot token refresh (scheduled job or cron)
2. Error handling
3. Documentation site (Fumadocs)

---

## Security

| Concern               | Mitigation                                           |
| --------------------- | ---------------------------------------------------- |
| Unauthorized access   | `ALLOWED_TWITCH_IDS` env var allowlist               |
| Overlay token leakage | UUID v4, regeneration in dashboard, security warning |
| Bot token storage     | Stored in PostgreSQL, fetched only via overlay token |
| Token refresh         | Scheduled job every 30 min                           |
| Rate limiting         | Cooldown in bot hooks                                |
| Session management    | Better Auth handles secure session tokens            |

---

## Dependencies

```bash
# Scaffolded by better-t-stack:
# Next.js, tRPC, Prisma, Better Auth, Tailwind, shadcn/ui,
# Fumadocs, Turborepo

# Additional (apps/web)
pnpm add @twurple/auth @twurple/chat --filter web
```
