FROM oven/bun:1-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/fumadocs/package.json ./apps/fumadocs/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/env/package.json ./packages/env/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile

# Build the application
FROM base AS build
COPY --from=deps /app ./
COPY . .
ENV SKIP_ENV_VALIDATION=true
RUN bun build packages/db/src/migrate.ts --outfile packages/db/migrate.js --target node
RUN bun --filter web build
RUN if [ -d apps/web/public ]; then cp -r apps/web/public apps/web/.next/standalone/apps/web/public; fi
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

# Production runner
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/packages/db/migrate.js ./packages/db/migrate.js
COPY --from=build /app/packages/db/drizzle ./packages/db/drizzle
COPY docker-entrypoint.sh ./
RUN chown -R node:node /app && chmod +x /app/docker-entrypoint.sh
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
