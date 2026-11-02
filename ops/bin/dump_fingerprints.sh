#!/bin/bash
# dump_fingerprints.sh — 输出 wca_comp_updated_at 的 per-comp 内容指纹到 stdout。
# SQL comes from the checked-out stats builder on stdin: one canonical row
# projection is shared by export, comparison and regression tests. Fail closed.
set -euo pipefail

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
    # Parse the runtime env file without executing shell syntax from its values.
    DB_PASS="$(env -u DB_PASS node --env-file="$DB_ENV_FILE" \
      -e 'process.stdout.write(process.env.DB_PASS || "")')"
  fi
  [ -n "${DB_PASS:-}" ] || { echo "database credentials unavailable: DB_PASS is empty" >&2; exit 1; }
  export PGPASSWORD="$DB_PASS"
}

load_db_password
psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
  -X -qAt -v ON_ERROR_STOP=1 -F $'\t' -f -
