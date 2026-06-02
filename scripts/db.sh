#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Bringing the database up..."

# Start database
echo "[1/3] Starting database..."
docker compose -f "$ROOT_DIR/packages/db/docker-compose.yml" up -d

# Wait for PostgreSQL to be ready
echo "[2/3] Waiting for database to be ready..."
TIMEOUT=30
ELAPSED=0
until docker compose -f "$ROOT_DIR/packages/db/docker-compose.yml" exec -T postgres \
  pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "Error: Database did not become ready within ${TIMEOUT}s."
    exit 1
  fi
done
echo "Database ready."

# Push schema (idempotent)
echo "[3/3] Syncing database schema..."
cd "$ROOT_DIR" && bun run db:push

echo ""
echo "Database is up and the schema is in sync. Run 'bun run dev' to start the apps."
