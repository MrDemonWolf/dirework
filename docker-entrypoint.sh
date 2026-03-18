#!/bin/sh

echo "Running database migrations..."
if node /app/packages/db/migrate.js; then
  echo "Database migrations completed successfully."
else
  echo "WARNING: Database migrations failed. The app will still start."
  echo "Check your DATABASE_URL and ensure the database is reachable."
fi

echo "Starting application..."
exec node apps/web/server.js
