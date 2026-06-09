#!/bin/bash
# dump_sor_inputs.sh — SOR 预计算 (core/sorcalc) 的输入矩阵导出,TSV 到 stdout。
# 用法: dump_sor_inputs.sh pe | persons | hrs <year> | no_podium
# 由 sor.yml CI 经 ssh 调用。数据源全部由每日 stats.yml 刷新:
#   pe        ← wca_person_ranks.ranks_world (21 项世界排名矩阵;排名当输入对 sorcalc
#               等价 —— 对排名做 competition ranking 结果不变,且口径直接对齐主榜单)
#   persons   ← wca_persons (wca_id, name)
#   hrs       ← historical_ranks_snapshot 单年 (census 历史冻结,只导当前年)
#   no_podium ← wca_person_ranks best_final_pos∈{0,>3} 名单 (census_np 用)
# 任何 SQL 失败必须非零退出 (CI fail-fast),不像 dump_fingerprints.sh 那样吞错。
set -euo pipefail

run_psql() {
  PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db \
    -tA -F $'\t' -v ON_ERROR_STOP=1 -c "$1"
}

case "${1:-}" in
  pe)
    # ev(i) 顺序必须与 sorcalc main.rs RANK_EVENTS / wca_stats_extra_build.ts RANK_EVENTS
    # 完全一致 (17 活跃 + 4 废止);ranks_world 是 1-based PG 数组,下标即该顺序。
    run_psql "
      WITH ev(event_id, i) AS (VALUES
        ('333',1),('222',2),('444',3),('555',4),('666',5),('777',6),
        ('333bf',7),('333fm',8),('333oh',9),('minx',10),('pyram',11),('clock',12),
        ('skewb',13),('sq1',14),('444bf',15),('555bf',16),('333mbf',17),
        ('333ft',18),('magic',19),('mmagic',20),('333mbo',21)),
      p AS (
        SELECT wca_id, s.ranks_world AS sr, a.ranks_world AS ar
        FROM (SELECT wca_id, ranks_world FROM wca_person_ranks WHERE NOT is_avg) s
        FULL JOIN (SELECT wca_id, ranks_world FROM wca_person_ranks WHERE is_avg) a USING (wca_id)
      )
      SELECT e.event_id, p.wca_id, COALESCE(p.sr[e.i], 0), COALESCE(p.ar[e.i], 0)
      FROM p CROSS JOIN ev e
      WHERE COALESCE(p.sr[e.i], 0) > 0 OR COALESCE(p.ar[e.i], 0) > 0"
    ;;
  persons)
    run_psql "SELECT wca_id, name FROM wca_persons"
    ;;
  hrs)
    year="${2:-}"
    if ! [[ "$year" =~ ^[0-9]{4}$ ]]; then
      echo "usage: dump_sor_inputs.sh hrs <year>" >&2
      exit 2
    fi
    run_psql "
      SELECT event_id, year, wca_id, single_world_rank, avg_world_rank
      FROM historical_ranks_snapshot WHERE year = $year"
    ;;
  no_podium)
    # 与 census_np 口径一致: 从未在 final 拿过前三 (同主榜单 hidePodium, migration 0013)
    run_psql "SELECT wca_id, is_avg FROM wca_person_ranks WHERE best_final_pos = 0 OR best_final_pos > 3"
    ;;
  *)
    echo "usage: dump_sor_inputs.sh pe | persons | hrs <year> | no_podium" >&2
    exit 2
    ;;
esac
