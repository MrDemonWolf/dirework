#!/bin/sh
set -e

echo "Running database migrations..."
prisma migrate deploy --config /app/packages/db/prisma.docker.config.ts
echo "Migrations complete."

echo "Starting application..."
exec node apps/web/server.js
