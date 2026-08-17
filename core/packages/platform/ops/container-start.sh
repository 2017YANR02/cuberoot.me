#!/bin/sh
set -eu

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_nonblank() (
  name="$1"
  value="$2"
  compact="$(printf '%s' "$value" | tr -d "[:space:]'\"")"
  test -n "$compact" || fail "$name is required and cannot be blank"
)

TEACHING_SECRET="${TEACHING_PLATFORM_SECRET:-}"
test "${#TEACHING_SECRET}" -eq 64 || fail "TEACHING_PLATFORM_SECRET must be exactly 64 hex characters"
case "$TEACHING_SECRET" in
  *[!0-9A-Fa-f]*) fail "TEACHING_PLATFORM_SECRET must be hexadecimal" ;;
esac

case "${TEACHING_API_BASE_URL:-}" in
  https://*) ;;
  *) fail "TEACHING_API_BASE_URL must be an HTTPS URL" ;;
esac

case "${SMS_PROVIDER:-}" in
  aliyun)
    require_nonblank SMS_ALIYUN_ACCESS_KEY_ID "${SMS_ALIYUN_ACCESS_KEY_ID:-}"
    require_nonblank SMS_ALIYUN_ACCESS_KEY_SECRET "${SMS_ALIYUN_ACCESS_KEY_SECRET:-}"
    require_nonblank SMS_ALIYUN_SIGN_NAME "${SMS_ALIYUN_SIGN_NAME:-}"
    require_nonblank SMS_ALIYUN_TEMPLATE_CODE "${SMS_ALIYUN_TEMPLATE_CODE:-}"
    ;;
  tencent)
    require_nonblank SMS_TENCENT_SECRET_ID "${SMS_TENCENT_SECRET_ID:-}"
    require_nonblank SMS_TENCENT_SECRET_KEY "${SMS_TENCENT_SECRET_KEY:-}"
    require_nonblank SMS_TENCENT_SDK_APP_ID "${SMS_TENCENT_SDK_APP_ID:-}"
    require_nonblank SMS_TENCENT_SIGN_NAME "${SMS_TENCENT_SIGN_NAME:-}"
    require_nonblank SMS_TENCENT_TEMPLATE_ID "${SMS_TENCENT_TEMPLATE_ID:-}"
    ;;
  *) fail "production SMS_PROVIDER must select a supported provider" ;;
esac

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
