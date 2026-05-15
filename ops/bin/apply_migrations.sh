#!/bin/bash
# apply_migrations.sh — schema migration runner
# 用法: apply_migrations.sh <migrations_dir>
# 跑 dir/*.sql 按字母序; ledger 跳过已应用; 每个一个事务
# sha256 校验防止已应用文件被改后 silent skip
set -euo pipefail

[ $# -eq 1 ] || { echo "usage: apply_migrations.sh <dir>" >&2; exit 2; }
DIR="$1"
[ -d "$DIR" ] || { echo "$DIR not a dir" >&2; exit 1; }

export PGPASSWORD=314159
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
