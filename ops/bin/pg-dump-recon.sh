#!/bin/bash
# Daily pg_dump of cuberoot_db — 只备「不可重建」的用户数据。
#
# 为什么排除派生表:整库 12G 里 ~99% 是 CI 从上游 WCA dump 每晚重算的派生统计
# (wca_results_flat / historical_* / wca_fs_* / sor_* 等),备它们纯浪费盘
# (旧实现每天 874M,4 天就 3.3G,直接把盘顶爆 → historical_ranks 灌库 ENOSPC)。
# 这里用 --exclude-table-data 只丢这些表的「数据」,保留「schema」:
# 恢复时结构在,CI 下一轮自动重灌 → dump 缩到 ~5M。
# (2026-06-28:补全漏掉的 wca_scrambles 810M / wca_scramble_optimal 483M / *_dump_state 等,
#  此前因列表残缺实际仍 ~156M/天,非注释所说的 9M。)
# 真正不可重建的(recons / 公式库 alg_* / 社区 article*/wiki_* / 用户成绩 timer_*/train_results /
# 账号+OAuth token wca_users / 监控 watched_*/monitor_* / 运维 ops_commands / nav_sites /
# 管道状态 *_dump_state / 迁移账本 _schema_migrations)
# 全部照备。新增「用户表」无需登记(默认就备,只有派生大表才需加进下面排除列表)。
#
# 凭据用 PGPASSWORD env;不写 pgpass 文件。备份本身不是加密文件。
# 只保留最近两份成功的每日备份及对应 .env；失败不轮换已有备份。
set -euo pipefail
umask 077
ARCHIVE="${CUBEROOT_BACKUP_DIR:-/root/archive}"
DB_ENV_FILE="${CUBEROOT_DB_ENV_FILE:-/root/core-api/.env}"
DATE=$(date -u +%Y-%m-%d)
mkdir -p "$ARCHIVE"
# 定时任务与人工补跑不能同时写入或轮换。
exec 9>"$ARCHIVE/.pg-dump-recon.lock"
flock -n 9 || { echo 'backup already running' >&2; exit 1; }
DUMP_TMP=$(mktemp "$ARCHIVE/.pg-recon-XXXXXXXX.sql.gz")
ENV_TMP=$(mktemp "$ARCHIVE/.env-XXXXXXXX")
trap 'rm -f -- "$DUMP_TMP" "$ENV_TMP"' EXIT

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
pg_dump -U recon_user -h 127.0.0.1 -d cuberoot_db \
  --exclude-table-data='wca_results_flat' \
  --exclude-table-data='wca_results_cache' \
  --exclude-table-data='wca_scrambles' \
  --exclude-table-data='wca_scrambles_cache' \
  --exclude-table-data='wca_scramble_steps' \
  --exclude-table-data='wca_scramble_steps_meta' \
  --exclude-table-data='wca_scramble_optimal' \
  --exclude-table-data='wca_competitions' \
  --exclude-table-data='wca_comp_updated_at' \
  --exclude-table-data='wca_persons' \
  --exclude-table-data='wca_person_results_snapshot' \
  --exclude-table-data='wca_countries' \
  --exclude-table-data='wca_continents' \
  --exclude-table-data='wca_person_ranks' \
  --exclude-table-data='wca_cohort_ranks' \
  --exclude-table-data='wca_success_rate' \
  --exclude-table-data='wca_all_events_done' \
  --exclude-table-data='wca_grand_slam' \
  --exclude-table-data='wca_championship_podiums' \
  --exclude-table-data='wca_fs_*' \
  --exclude-table-data='historical_*' \
  --exclude-table-data='sor_*' \
  --exclude-table-data='comp_snapshots' \
  --exclude-table-data='comp_schedule_cache' \
  --exclude-table-data='cubing_attempts_cache' \
  --exclude-table-data='meta_historical' \
  --exclude-table-data='person_dump_state' \
  --exclude-table-data='comp_dump_state' \
  | gzip -9 > "$DUMP_TMP"

# 验证 dump 不为空 (gzip 后 < 1KB 则 fail)
SIZE=$(wc -c < "$DUMP_TMP")
if [ "$SIZE" -lt 1024 ]; then
  echo "ERROR: dump too small ($SIZE bytes), aborting"
  exit 1
fi
gzip -t "$DUMP_TMP"
# grep 不用 -q，必须读完整流，避免 pipefail 将 gzip 的 SIGPIPE 误判为失败。
gzip -dc "$DUMP_TMP" | grep -F -- '-- PostgreSQL database dump complete' > /dev/null
# .env 与 dump 均准备好后再发布；缺失配置不清理旧备份。
cp "$DB_ENV_FILE" "$ENV_TMP"
chmod 600 "$DUMP_TMP" "$ENV_TMP"
mv "$ENV_TMP" "$ARCHIVE/env-$DATE"
mv "$DUMP_TMP" "$ARCHIVE/pg-recon-$DATE.sql.gz"

shopt -s nullglob
export LC_ALL=C
backups=("$ARCHIVE"/pg-recon-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].sql.gz)
for ((i=0; i<${#backups[@]}-2; i++)); do
  old_date=${backups[i]##*/pg-recon-}
  old_date=${old_date%.sql.gz}
  rm -f -- "${backups[i]}" "$ARCHIVE/env-$old_date"
done
# 只清理此备份任务的日期命名配置副本，保留与现有 dump 对应的两份。
for env_file in "$ARCHIVE"/env-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]; do
  env_date=${env_file##*/env-}
  [ -f "$ARCHIVE/pg-recon-$env_date.sql.gz" ] || rm -f -- "$env_file"
done
echo "OK: $ARCHIVE/pg-recon-$DATE.sql.gz ($SIZE bytes); retained at most 2 daily backups"
echo "OK: $ARCHIVE/env-$DATE"
