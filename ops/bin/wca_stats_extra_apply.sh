#!/bin/bash
# wca_stats_extra_apply.sh — 由 GH Actions 触发,从 /tmp/wca_stats_extra/ 灌进 PG
# 输入:/tmp/wca_stats_extra/{load.sql, *.copy.tsv}
# 输出:替换 wca_competitions/wca_grand_slam/... 等 8 张表;清空 /tmp/wca_stats_extra
#
# 部署:scp 此文件到 /usr/local/bin/wca_stats_extra_apply.sh; chmod +x.
set -euo pipefail

IMPORT_DIR="/tmp/wca_stats_extra"
LOG_TAG="wca_stats_extra_apply"

if [ ! -f "$IMPORT_DIR/load.sql" ]; then
  logger -t "$LOG_TAG" "load.sql missing in $IMPORT_DIR; abort"
  exit 1
fi

REQUIRED=(
  load.sql
  wca_competitions.copy.tsv
  wca_grand_slam.copy.tsv
  wca_results_top.copy.tsv
  wca_year_results_top.copy.tsv
  wca_cohort_ranks.copy.tsv
  wca_success_rate.copy.tsv
  wca_all_events_done.copy.tsv
  wca_person_ranks.copy.tsv
)
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$IMPORT_DIR/$f" ]; then
    logger -t "$LOG_TAG" "$f missing; abort"
    exit 1
  fi
done

logger -t "$LOG_TAG" "applying load.sql"
START_TS=$(date +%s)

cd "$IMPORT_DIR"
PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d recon_db -f load.sql -v ON_ERROR_STOP=1 2>&1 | logger -t "$LOG_TAG"

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
logger -t "$LOG_TAG" "psql done in ${ELAPSED}s; cleaning up"

rm -rf "$IMPORT_DIR"

logger -t "$LOG_TAG" "success"
echo "OK ${ELAPSED}s"
