#!/bin/sh

echo "Running database migrations..."
cd /app/packages/db
if prisma migrate deploy --schema prisma/schema; then
  echo "Database migrations completed successfully."
else
  echo "WARNING: Database migrations failed. The app will still start."
  echo "Check your DATABASE_URL and ensure the database is reachable."
fi
cd /app

echo "Starting application..."
exec node apps/web/server.js
