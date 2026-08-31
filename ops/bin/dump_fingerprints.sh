#!/bin/bash
# dump_fingerprints.sh — 输出 wca_comp_updated_at 的 per-comp 内容指纹到 stdout。
# 格式: comp_id<TAB>content_hash 每行一条,无表头无行数脚注。
# 供 stats.yml 在 wca_stats_extra 增量 build 前拉「旧指纹」做 diff:
#   只重灌指纹变动的比赛行,wca_results_flat 不再每天全量 DROP+重建翻倍撑爆磁盘。
# 表不存在 / 查询失败 → 空输出(builder 检测到无旧指纹 → 退回全量重建,安全兜底)。
set -u

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
  -tA -F $'\t' -c "SELECT comp_id, content_hash FROM wca_comp_updated_at" 2>/dev/null || true
