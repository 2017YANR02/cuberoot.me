#!/bin/bash
# apply_load.sh — 通用 PG 加载器,由 GH Actions 通过 ssh 触发
# 用法: MIN_FREE_BYTES=<bytes> apply_load.sh <import_dir> <log_tag>
# 输入: $IMPORT_DIR/{load.sql, *.copy.tsv}
# 输出: 按 load.sql 内容替换/插入 PG 表;退出时清空 IMPORT_DIR
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: apply_load.sh <import_dir> <log_tag>" >&2
  exit 2
fi
IMPORT_DIR="$1"
LOG_TAG="$2"
MIN_FREE_BYTES="${MIN_FREE_BYTES:-0}"

case "$IMPORT_DIR" in
  /tmp/*) ;;
  *)
    echo "[$LOG_TAG] import directory must be an absolute child of /tmp: $IMPORT_DIR" >&2
    exit 2
    ;;
esac

RESOLVED_IMPORT_DIR="$(readlink -f -- "$IMPORT_DIR" 2>/dev/null || true)"
if [ "$RESOLVED_IMPORT_DIR" != "$IMPORT_DIR" ] || [ ! -d "$IMPORT_DIR" ] || [ -L "$IMPORT_DIR" ]; then
  echo "[$LOG_TAG] unsafe or missing import directory: $IMPORT_DIR" >&2
  exit 2
fi

cleanup_import_dir() {
  local status=$?
  trap - EXIT
  set +e
  cd /
  if [ -d "$IMPORT_DIR" ] && [ ! -L "$IMPORT_DIR" ] && [ "$(readlink -f -- "$IMPORT_DIR")" = "$IMPORT_DIR" ]; then
    rm -rf -- "$IMPORT_DIR"
  fi
  if [ "$status" -ne 0 ]; then
    logger -t "$LOG_TAG" "failed with status $status; cleaned $IMPORT_DIR"
    echo "[$LOG_TAG] failed with status $status; cleaned $IMPORT_DIR" >&2
  fi
  exit "$status"
}
trap cleanup_import_dir EXIT

if ! [[ "$MIN_FREE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "[$LOG_TAG] MIN_FREE_BYTES must be a non-negative integer" >&2
  exit 2
fi

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

AVAILABLE_BYTES="$(LC_ALL=C df -B1 --output=avail "$IMPORT_DIR" | tail -n 1 | tr -d '[:space:]')"
if ! [[ "$AVAILABLE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "[$LOG_TAG] could not determine free disk space" >&2
  exit 1
fi
if (( AVAILABLE_BYTES < MIN_FREE_BYTES )); then
  echo "[$LOG_TAG] insufficient disk space: available=${AVAILABLE_BYTES}, required=${MIN_FREE_BYTES}; abort" >&2
  logger -t "$LOG_TAG" "insufficient disk space: available=${AVAILABLE_BYTES}, required=${MIN_FREE_BYTES}; abort"
  exit 1
fi

echo "[$LOG_TAG] preflight OK; available=${AVAILABLE_BYTES}, required=${MIN_FREE_BYTES}; files in $IMPORT_DIR:"
ls -lh "$IMPORT_DIR"
logger -t "$LOG_TAG" "applying load.sql"
START_TS=$(date +%s)

cd "$IMPORT_DIR"
# GitHub Actions 折叠 marker — 几千行 SQL 回显默认折叠,点开看详情
echo "::group::[$LOG_TAG] psql -e -f load.sql"
# psql -e 回显 server 收到的每条 SQL(\copy / TRUNCATE / CREATE INDEX 等)
# tee >(logger) 让 stdout 走 ssh client (Actions 实时日志) 同时 syslog 留备份
psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
  -e -v ON_ERROR_STOP=1 -f load.sql 2>&1 \
  | tee >(logger -t "$LOG_TAG")
echo "::endgroup::"

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
echo "[$LOG_TAG] psql done in ${ELAPSED}s; cleaning up on exit"
logger -t "$LOG_TAG" "psql done in ${ELAPSED}s; cleaning up on exit"

logger -t "$LOG_TAG" "success"
echo "OK ${ELAPSED}s"
