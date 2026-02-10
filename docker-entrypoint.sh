#!/bin/sh
set -e

echo "Running database migrations..."
NODE_PATH=/usr/local/lib/node_modules prisma migrate deploy --config /app/packages/db/prisma.docker.config.ts
echo "Migrations complete."

echo "Starting application..."
exec node apps/web/server.js
