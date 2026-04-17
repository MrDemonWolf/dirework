#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Setting up Dirework development environment..."
echo ""

# Check bun
if ! command -v bun &> /dev/null; then
  echo "Error: bun is not installed. Install it from https://bun.sh"
  exit 1
fi

# Check docker
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed. Install it from https://docs.docker.com/get-docker/"
  exit 1
fi

# Copy .env if missing
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "[1/4] Creating .env from .env.example..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo ".env created. Fill in TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET before starting."
else
  echo "[1/4] .env already exists, skipping."
fi

# Install dependencies
echo "[2/4] Installing dependencies..."
cd "$ROOT_DIR" && bun install

# Start database and wait
echo "[3/4] Starting database..."
docker compose -f "$ROOT_DIR/packages/db/docker-compose.yml" up -d

TIMEOUT=30
ELAPSED=0
until docker compose -f "$ROOT_DIR/packages/db/docker-compose.yml" exec -T db \
  pg_isready -U "${POSTGRES_USER:-dirework}" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "Error: Database did not become ready within ${TIMEOUT}s."
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
echo "Database ready."

# Push schema
echo "[4/4] Pushing database schema..."
cd "$ROOT_DIR" && bun run db:push

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and set TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET"
echo "     (Get credentials at https://dev.twitch.tv/console/apps)"
echo "  2. Run: bun run dev:full"
echo ""
