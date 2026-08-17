#!/bin/sh
set -eu

mkdir -p "$(dirname "$DB_PATH")" /data/uploads
if [ ! -f "$DB_PATH" ]; then
  cp /app/seed-data.db "$DB_PATH"
fi

DB_PATH="$DB_PATH" MIGRATIONS_DIR=/app/db-migrations node /app/migrate.cjs

ENTRY_DIR="$(dirname "$(find /app -name server.js -not -path '*/node_modules/*' | head -1)")"
test -f "$ENTRY_DIR/server.js"
if [ -d "$ENTRY_DIR/public/uploads" ] && [ ! -L "$ENTRY_DIR/public/uploads" ]; then
  mv "$ENTRY_DIR/public/uploads" "$ENTRY_DIR/public/uploads.image"
fi
if [ ! -e "$ENTRY_DIR/public/uploads" ]; then
  ln -s /data/uploads "$ENTRY_DIR/public/uploads"
fi

cd "$ENTRY_DIR"
exec node server.js
