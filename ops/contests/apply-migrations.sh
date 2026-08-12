#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${1:?usage: apply-migrations.sh <migrations-directory>}"

for variable in DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "ERROR: $variable is not configured" >&2
    exit 1
  fi
done

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: migrations directory does not exist: $MIGRATIONS_DIR" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"
trap 'unset PGPASSWORD' EXIT

PSQL=(
  psql
  --host "$DB_HOST"
  --port "$DB_PORT"
  --username "$DB_USERNAME"
  --dbname "$DB_NAME"
  --no-password
  --no-psqlrc
  --set ON_ERROR_STOP=1
)

"${PSQL[@]}" <<'SQL'
CREATE SCHEMA IF NOT EXISTS record_ranks;
CREATE TABLE IF NOT EXISTS public.cuberoot_recordranks_migrations (
  migration_name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

while IFS= read -r migration_file; do
  migration_name="$(basename "$(dirname "$migration_file")")"
  checksum="$(sha256sum "$migration_file" | cut -d ' ' -f 1)"

  if [[ ! "$migration_name" =~ ^[0-9A-Za-z_.+-]+$ ]] || [[ ! "$checksum" =~ ^[0-9a-f]{64}$ ]]; then
    echo "ERROR: unsafe migration metadata for $migration_file" >&2
    exit 1
  fi

  applied_checksum="$("${PSQL[@]}" --tuples-only --no-align --command \
    "SELECT checksum FROM public.cuberoot_recordranks_migrations WHERE migration_name = '$migration_name';")"

  if [ -n "$applied_checksum" ]; then
    if [ "$applied_checksum" != "$checksum" ]; then
      echo "ERROR: applied migration changed: $migration_name" >&2
      exit 1
    fi
    echo "Migration already applied: $migration_name"
    continue
  fi

  echo "Applying migration: $migration_name"
  {
    echo "BEGIN;"
    cat "$migration_file"
    printf "\nINSERT INTO public.cuberoot_recordranks_migrations (migration_name, checksum) VALUES ('%s', '%s');\n" \
      "$migration_name" "$checksum"
    echo "COMMIT;"
  } | "${PSQL[@]}"
done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -type f -name migration.sql | sort)
