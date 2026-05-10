#!/bin/bash
# historical_ranks_apply.sh — 由 GH Actions 触发,从 /tmp/wca_import/ 灌进 PG
# 输入:/tmp/wca_import/{load.sql, *.copy.tsv}
# 输出:replaced historical_ranks_snapshot etc; 清空 /tmp/wca_import
set -euo pipefail

IMPORT_DIR="/tmp/wca_import"
LOG_TAG="historical_ranks_apply"

if [ ! -f "$IMPORT_DIR/load.sql" ]; then
  echo "[$LOG_TAG] load.sql missing in $IMPORT_DIR; abort" >&2
  logger -t "$LOG_TAG" "load.sql missing in $IMPORT_DIR; abort"
  exit 1
fi

# 必备文件预检 — 任一缺失立即 abort,避免 \copy 静默跳过
REQUIRED=(
  load.sql
  wca_continents.copy.tsv
  wca_countries.copy.tsv
  wca_persons.copy.tsv
  historical_ranks_snapshot.copy.tsv
  historical_ranks_monthly_snapshot.copy.tsv
)
for f in "${REQUIRED[@]}"; do
  if [ ! -s "$IMPORT_DIR/$f" ]; then
    echo "[$LOG_TAG] $f missing or empty; abort" >&2
    logger -t "$LOG_TAG" "$f missing or empty; abort"
    exit 1
  fi
done

echo "[$LOG_TAG] preflight OK; files in $IMPORT_DIR:"
ls -lh "$IMPORT_DIR"
echo "[$LOG_TAG] applying load.sql"
logger -t "$LOG_TAG" "applying load.sql"
START_TS=$(date +%s)

cd "$IMPORT_DIR"
# psql -e 回显 server 收到的每条 SQL(\copy / TRUNCATE / CREATE INDEX 等)
# tee >(logger) 让 stdout 走 ssh client 同时 syslog 留备份
PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d recon_db \
  -e -v ON_ERROR_STOP=1 -f load.sql 2>&1 \
  | tee >(logger -t "$LOG_TAG")

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
echo "[$LOG_TAG] psql done in ${ELAPSED}s; cleaning up"
logger -t "$LOG_TAG" "psql done in ${ELAPSED}s; cleaning up"

rm -rf "$IMPORT_DIR"

logger -t "$LOG_TAG" "success"
echo "OK ${ELAPSED}s"
