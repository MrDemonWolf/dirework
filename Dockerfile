FROM node:24-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/fumadocs/package.json ./apps/fumadocs/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/env/package.json ./packages/env/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN corepack install
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild @prisma/engines esbuild sharp

# Build the application
FROM base AS build
COPY --from=deps /app ./
COPY . .
ENV SKIP_ENV_VALIDATION=true
RUN pnpm --filter @dirework/db exec prisma generate
RUN pnpm --filter web build
RUN if [ -d apps/web/public ]; then cp -r apps/web/public apps/web/.next/standalone/apps/web/public; fi
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

# Production runner
FROM node:24-slim AS runner
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g prisma@7
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/packages/db/prisma/schema ./packages/db/prisma/schema
COPY --from=build /app/packages/db/prisma/migrations ./packages/db/prisma/migrations
COPY docker-entrypoint.sh ./

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
