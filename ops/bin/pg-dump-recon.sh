#!/bin/sh
# Daily pg_dump of cuberoot_db — 只备「不可重建」的用户数据。
#
# 为什么排除派生表:整库 12G 里 ~99% 是 CI 从上游 WCA dump 每晚重算的派生统计
# (wca_results_flat / historical_* / wca_fs_* / sor_* 等),备它们纯浪费盘
# (旧实现每天 874M,4 天就 3.3G,直接把盘顶爆 → historical_ranks 灌库 ENOSPC)。
# 这里用 --exclude-table-data 只丢这些表的「数据」,保留「schema」:
# 恢复时结构在,CI 下一轮自动重灌 → dump 缩到 ~9M。
# 真正不可重建的(recons / 公式库 alg_* / 社区 article*/wiki_* / 用户成绩 timer_*/train_results /
# 账号+OAuth token wca_users / 监控 watched_*/monitor_* / 运维 ops_commands / nav_sites /
# 分析历史 pageviews/traffic_daily / 管道状态 *_dump_state / 迁移账本 _schema_migrations)
# 全部照备。新增「用户表」无需登记(默认就备,只有派生大表才需加进下面排除列表)。
#
# 加密用 PGPASSWORD env;不写 pgpass 文件。
# 留 7 天滚动覆盖,过期自动删(本机每日拉副本另留 30 天)。同时备份 /root/core-api/.env (含 DB 密码 / JWT / WCA OAuth)。
set -e
ARCHIVE=/root/archive
DATE=$(date -u +%Y-%m-%d)
mkdir -p "$ARCHIVE"

PGPASSWORD=314159 pg_dump -U recon_user -h 127.0.0.1 -d cuberoot_db \
  --exclude-table-data='wca_results_flat' \
  --exclude-table-data='wca_results_cache' \
  --exclude-table-data='wca_scrambles_cache' \
  --exclude-table-data='wca_competitions' \
  --exclude-table-data='wca_comp_updated_at' \
  --exclude-table-data='wca_persons' \
  --exclude-table-data='wca_countries' \
  --exclude-table-data='wca_continents' \
  --exclude-table-data='wca_person_ranks' \
  --exclude-table-data='wca_cohort_ranks' \
  --exclude-table-data='wca_success_rate' \
  --exclude-table-data='wca_all_events_done' \
  --exclude-table-data='wca_grand_slam' \
  --exclude-table-data='wca_fs_*' \
  --exclude-table-data='historical_*' \
  --exclude-table-data='sor_*' \
  --exclude-table-data='comp_snapshots' \
  --exclude-table-data='comp_schedule_cache' \
  --exclude-table-data='cubing_attempts_cache' \
  --exclude-table-data='meta_historical' \
  | gzip -9 > "$ARCHIVE/pg-recon-$DATE.sql.gz.tmp"

# 验证 dump 不为空 (gzip 后 < 1KB 则 fail)
SIZE=$(stat -c %s "$ARCHIVE/pg-recon-$DATE.sql.gz.tmp")
if [ "$SIZE" -lt 1024 ]; then
  echo "ERROR: dump too small ($SIZE bytes), aborting"
  rm "$ARCHIVE/pg-recon-$DATE.sql.gz.tmp"
  exit 1
fi

mv "$ARCHIVE/pg-recon-$DATE.sql.gz.tmp" "$ARCHIVE/pg-recon-$DATE.sql.gz"

# 删 7 天前的备份
find "$ARCHIVE" -name "pg-recon-*.sql.gz" -mtime +7 -delete

echo "OK: $ARCHIVE/pg-recon-$DATE.sql.gz ($SIZE bytes)"

# .env 备份 (含 DB pass / JWT / WCA OAuth 等;丢了 = 全部 secrets 重生成)
if [ -f /root/core-api/.env ]; then
  cp /root/core-api/.env "$ARCHIVE/env-$DATE"
  chmod 600 "$ARCHIVE/env-$DATE"
  find "$ARCHIVE" -name "env-*" -mtime +7 -delete
  echo "OK: $ARCHIVE/env-$DATE"
fi
