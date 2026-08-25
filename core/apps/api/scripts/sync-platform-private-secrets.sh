#!/bin/sh
set -eu

ENV_FILE="${1:-/root/core-api/.env}"
IFS= read -r DATA_KEY
IFS= read -r MEDIA_SECRET

test -n "$DATA_KEY" || { echo "ERROR: PLATFORM_DATA_ENCRYPTION_KEY_V1 secret missing"; exit 1; }
test -n "$MEDIA_SECRET" || { echo "ERROR: PLATFORM_MEDIA_SIGNING_SECRET secret missing"; exit 1; }
test -s "$ENV_FILE" || { echo "ERROR: Runtime env file is missing"; exit 1; }

EXISTING_DATA_KEY="$(sed -n "s/^PLATFORM_DATA_ENCRYPTION_KEY_V1=//p" "$ENV_FILE" | tail -1)"
if [ -n "$EXISTING_DATA_KEY" ] && [ "$EXISTING_DATA_KEY" != "$DATA_KEY" ]; then
  echo "ERROR: Existing PLATFORM_DATA_ENCRYPTION_KEY_V1 does not match the immutable v1 deploy secret"
  exit 1
fi

DATA_KEY_TO_WRITE="${EXISTING_DATA_KEY:-$DATA_KEY}"
TMP_FILE="$(mktemp "${ENV_FILE}.platform.XXXXXX")"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT HUP INT TERM

awk 'index($0, "PLATFORM_DATA_ENCRYPTION_KEY_V1=") != 1 && index($0, "PLATFORM_MEDIA_SIGNING_SECRET=") != 1 { print }' "$ENV_FILE" > "$TMP_FILE"
printf "%s=%s\n" PLATFORM_DATA_ENCRYPTION_KEY_V1 "$DATA_KEY_TO_WRITE" >> "$TMP_FILE"
printf "%s=%s\n" PLATFORM_MEDIA_SIGNING_SECRET "$MEDIA_SECRET" >> "$TMP_FILE"
chmod --reference="$ENV_FILE" "$TMP_FILE"
chown --reference="$ENV_FILE" "$TMP_FILE"
mv "$TMP_FILE" "$ENV_FILE"
trap - EXIT HUP INT TERM
