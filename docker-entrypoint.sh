#!/bin/sh

echo "Running database migrations..."
cd /app/packages/db

# Replace config file with minimal production version (original imports prisma SDK not available in image)
cat > prisma.config.ts << 'CONF'
export default {
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
};
CONF

if prisma migrate deploy; then
  echo "Database migrations completed successfully."
else
  echo "WARNING: Database migrations failed. The app will still start."
  echo "Check your DATABASE_URL and ensure the database is reachable."
fi
cd /app

echo "Starting application..."
exec node apps/web/server.js
