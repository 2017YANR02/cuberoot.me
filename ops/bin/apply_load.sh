#!/bin/bash
# apply_load.sh — 通用 PG 加载器,由 GH Actions 通过 ssh 触发
# 用法: apply_load.sh <import_dir> <log_tag>
# 输入: $IMPORT_DIR/{load.sql, *.copy.tsv}
# 输出: 按 load.sql 内容替换/插入 PG 表;成功后清空 IMPORT_DIR
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: apply_load.sh <import_dir> <log_tag>" >&2
  exit 2
fi
IMPORT_DIR="$1"
LOG_TAG="$2"

if [ ! -f "$IMPORT_DIR/load.sql" ]; then
  echo "[$LOG_TAG] load.sql missing in $IMPORT_DIR; abort" >&2
  logger -t "$LOG_TAG" "load.sql missing in $IMPORT_DIR; abort"
  exit 1
fi

# 预检: 目录下必须有 *.copy.tsv,且任一不能为空(防 scp 漏传 / build 空写)
shopt -s nullglob
TSV_FILES=("$IMPORT_DIR"/*.copy.tsv)
if [ ${#TSV_FILES[@]} -eq 0 ]; then
  echo "[$LOG_TAG] no *.copy.tsv in $IMPORT_DIR; abort" >&2
  logger -t "$LOG_TAG" "no *.copy.tsv in $IMPORT_DIR; abort"
  exit 1
fi
for f in "${TSV_FILES[@]}"; do
  if [ ! -s "$f" ]; then
    echo "[$LOG_TAG] $(basename "$f") is empty; abort" >&2
    logger -t "$LOG_TAG" "$(basename "$f") is empty; abort"
    exit 1
  fi
done

echo "[$LOG_TAG] preflight OK; files in $IMPORT_DIR:"
ls -lh "$IMPORT_DIR"
logger -t "$LOG_TAG" "applying load.sql"
START_TS=$(date +%s)

cd "$IMPORT_DIR"
# GitHub Actions 折叠 marker — 几千行 SQL 回显默认折叠,点开看详情
echo "::group::[$LOG_TAG] psql -e -f load.sql"
# psql -e 回显 server 收到的每条 SQL(\copy / TRUNCATE / CREATE INDEX 等)
# tee >(logger) 让 stdout 走 ssh client (Actions 实时日志) 同时 syslog 留备份
PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
  -e -v ON_ERROR_STOP=1 -f load.sql 2>&1 \
  | tee >(logger -t "$LOG_TAG")
echo "::endgroup::"

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
echo "[$LOG_TAG] psql done in ${ELAPSED}s; cleaning up"
logger -t "$LOG_TAG" "psql done in ${ELAPSED}s; cleaning up"

rm -rf "$IMPORT_DIR"

logger -t "$LOG_TAG" "success"
echo "OK ${ELAPSED}s"
