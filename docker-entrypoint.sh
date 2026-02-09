#!/bin/sh
set -e

echo "Running database migrations..."
prisma migrate deploy --schema /app/packages/db/prisma/schema --url "$DATABASE_URL"
echo "Migrations complete."

echo "Starting application..."
exec node apps/web/server.js
