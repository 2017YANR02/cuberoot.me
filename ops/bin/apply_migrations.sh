#!/bin/bash
# apply_migrations.sh — schema migration runner
# 用法: apply_migrations.sh <migrations_dir>
# 跑 dir/*.sql 按字母序; ledger 跳过已应用; 每个一个事务
# sha256 校验防止已应用文件被改后 silent skip
set -euo pipefail

[ $# -eq 1 ] || { echo "usage: apply_migrations.sh <dir>" >&2; exit 2; }
DIR="$1"
[ -d "$DIR" ] || { echo "$DIR not a dir" >&2; exit 1; }

load_db_password() {
  if [ -n "${PGPASSWORD:-}" ]; then
    return
  fi
  if [ -z "${DB_PASS:-}" ]; then
    DB_ENV_FILE="${CUBEROOT_DB_ENV_FILE:-/root/core-api/.env}"
    [ -r "$DB_ENV_FILE" ] || {
      echo "database credentials unavailable: set PGPASSWORD or DB_PASS, or provide readable CUBEROOT_DB_ENV_FILE" >&2
      exit 1
    }
    command -v node >/dev/null 2>&1 || {
      echo "database credentials unavailable: node is required to read CUBEROOT_DB_ENV_FILE" >&2
      exit 1
    }
    # Node's dotenv parser accepts the same unquoted values (including spaces)
    # as the API runtime without executing the env file as shell code.
    DB_PASS="$(env -u DB_PASS node --env-file="$DB_ENV_FILE" \
      -e 'process.stdout.write(process.env.DB_PASS || "")')"
  fi
  [ -n "${DB_PASS:-}" ] || { echo "database credentials unavailable: DB_PASS is empty" >&2; exit 1; }
  export PGPASSWORD="$DB_PASS"
}

load_db_password
PG=( psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 )

"${PG[@]}" -c "CREATE TABLE IF NOT EXISTS _schema_migrations (filename TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());" >/dev/null

shopt -s nullglob
for f in $(printf '%s\n' "$DIR"/*.sql | sort); do
  base=$(basename "$f")
  sha=$(sha256sum "$f" | awk '{print $1}')
  ledger_sha=$("${PG[@]}" -tAc "SELECT sha256 FROM _schema_migrations WHERE filename='$base';")
  if [ -n "$ledger_sha" ]; then
    if [ "$ledger_sha" != "$sha" ]; then
      echo "::error::$base sha256 mismatch (ledger=$ledger_sha, file=$sha) — 已应用 migration 不可改,要回滚请写新 migration"
      exit 1
    fi
    echo "skip $base"
    continue
  fi
  echo "::group::apply $base (sha256: ${sha:0:12})"
  "${PG[@]}" -e <<SQL
BEGIN;
\i $f
INSERT INTO _schema_migrations (filename, sha256) VALUES ('$base', '$sha');
COMMIT;
SQL
  echo "::endgroup::"
done
echo "OK"
