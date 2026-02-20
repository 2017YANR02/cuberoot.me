# CI 性能基准数据

环境: GitHub Actions (Ubuntu 24.04, Ruby 3.4.8, MySQL)
数据库: WCA Developer Export (~630 万行 results)

---

## Run #37: 17f1c2b — 全量运行（84 个统计）

日期: 2026-02-20 | 总 CI: **1h 44m 40s** | compute_all: **94m 28s**

### 全部统计耗时明细

| 统计 | 耗时 | 类型 |
|------|------|------|
| wr_ao1r | 9m 31s | AoRounds（触发计算） |
| wr_dominance | 8m 26s | 独立 |
| average_of_25 | 8m 13s | AverageOfX |
| wr_bao5 | 7m 50s | RoundMetric（触发计算） |
| average_of_100 | 4m 50s | AverageOfX |
| average_of_50 | 4m 32s | AverageOfX |
| longest_streak_of_podiums | 3m 6s | 独立 |
| best_single_counting_into_average | 2m 21s | 独立 |
| most_completed_solves | 2m 20s | 独立 |
| wr_single_history | 2m 12s | RoundMetric |
| most_competitions_before_winning | 2m 10s | 独立 |
| smallest_diff_between_single_and_average | 2m 3s | 独立 |
| moving_average | 2m 0s | 独立 |
| longest_streak_of_personal_records | 2m 0s | 独立 |
| best_round | 1m 56s | 独立 |
| wr_average_history | 1m 56s | RoundMetric |
| longest_streak_of_competitions_in_own_country | 1m 54s | 独立 |
| shortest_time_to_get_all_singles_and_averages | 1m 43s | 独立 |
| best_result_off_podium | 1m 34s | 独立 |
| best_first_single | 1m 33s | 独立 |
| best_first_average | 1m 32s | 独立 |
| current_world_records_by_country | 1m 26s | 独立 |
| wr_newcomer | 1m 17s | 独立 |
| most_frequent_results | 1m 10s | 独立 |
| yearly_rankings | 1m 9s | 独立 |
| most_distinct_dates_competed_on | 1m 6s | 独立 |
| consecutive_sub_5_average | 1m 5s | 独立 |
| average_of_12 | 53s | AverageOfX |
| average_of_5 | 54s | AverageOfX |
| shortest_time_to_get_all_singles | 51s | 独立 |
| winned_week_count | 50s | 独立 |
| longest_time_to_sub_10 | 43s | 独立 |
| shortest_time_to_reach_milestone_in_comps_count | 41s | 独立 |
| worst_result_on_podium | 40s | 独立 |
| dnf_rate_by_event | 37s | 独立 |
| world_records_by_person | 34s | 独立 |
| longest_competitions_path | 34s | 独立 |
| competitions_per_year_by_person | 32s | 独立 |
| most_finals | 31s | 独立 |
| most_podiums_together | 29s | 独立 |
| most_visited_continents | 29s | 独立 |
| most_visited_countries | 26s | 独立 |
| average_event_count_by_competition | 23s | 独立 |
| potentially_seen_world_records | 24s | 独立 |
| most_attended_competitions_in_single_month | 21s | 独立 |
| records_in_most_events | 19s | 独立 |
| wr_first_comp_wr | 19s | 独立 |
| most_competitions_abroad | 17s | 独立 |
| complete_competition_winners | 17s | 独立 |
| world_records_by_country | 15s | 独立 |
| most_attended_competitions_in_single_week | 13s | 独立 |
| most_solves_before_bld_success | 9s | 独立 |
| most_4th_places | 9s | 独立 |
| most_podiums_at_single_competition | 6s | 独立 |
| fewest_competitors_contest | 6s | 独立 |
| competitions_per_year_by_country | 5s | 独立 |
| best_medal_collection_from_abroad_by_person | 5s | 独立 |
| best_medal_collection_from_abroad_by_country | 4s | 独立 |
| name_parts_count | 4s | 独立 |
| longest_standing_records | 2s | 独立 |
| most_delegated_competitions | 2s | 独立 |
| most_records_at_single_competition | 1s | 独立 |
| world_championship_records | 1s | 独立 |
| delegated_competition_per_year | 1s | 独立 |
| world_championship_podiums_by_person | 1s | 独立 |
| wr_median | 1s | RoundMetric（缓存） |
| wr_worst_counting | 1s | RoundMetric（缓存） |
| wr_mo5 | 0s | RoundMetric（缓存） |
| wr_bpa | 0s | RoundMetric（缓存） |
| wr_variance | 0s | RoundMetric（缓存） |
| wr_wao5 | 0s | RoundMetric（缓存） |
| wr_wpa | 0s | RoundMetric（缓存） |
| wr_worst | 0s | RoundMetric（缓存） |
| wr_best_counting | 0s | RoundMetric（缓存） |
| wr_best_average_ratio | 0s | RoundMetric（缓存） |
| wr_current | 0s | 独立 |
| best_potential_fmc_mean | 0s | 独立 |
| competitions_count_by_week | 0s | 独立 |
| competition_days_count_by_region | 0s | 独立 |
| longest_streak_of_world_records | 0s | 独立 |
| world_championship_podiums_by_country | 0s | 独立 |
| wr_ao2r | 0s | AoRounds（缓存） |
| wr_ao3r | 0s | AoRounds（缓存） |
| wr_ao4r | 0s | AoRounds（缓存） |

### 缓存机制验证

| 缓存组 | 触发者 | 触发耗时 | 缓存命中数 | 缓存耗时 |
|--------|--------|----------|-----------|---------|
| RoundMetric (@@precomputed_rankings) | wr_bao5 | 7m 50s | 10 个 | 各 <1s |
| AoRounds (@@precomputed) | wr_ao1r | 9m 31s | 3 个 | 各 <1s |
| AverageOfX (@@query_results) | average_of_5 | 54s | 4 个 | 各自独立 |

> wr_single_history (2m12s) 和 wr_average_history (1m56s) 虽属 RoundMetric，
> 但使用独立查询路径（`batch_ranking?` = false），不走 @@precomputed_rankings。

---

## Run #38: 65c4438 — 聚合运行（STATS_FILTER=wr_metric,wr_aoxr）

日期: 2026-02-20 | 总 CI: **29m 43s** | compute_all: **19m 31s**

| 聚合统计 | 耗时 | 内含子类 |
|----------|------|---------|
| wr_metric | 11m 32s | 13 个 RoundMetric |
| wr_aoxr | 7m 58s | 4 个 AoRounds |
| **合计** | **19m 31s** | |

### 聚合前后对比

| 指标 | Run #37（17 个独立文件） | Run #38（2 个聚合文件） |
|------|--------------------------|--------------------------|
| RoundMetric 耗时 | ~13m 17s | 11m 32s |
| AoRounds 耗时 | ~9m 31s | 7m 58s |
| **合计** | **~22m 48s** | **19m 31s** |
| 加速比 | — | **~1.17x** |
| 生成文件数 | 17 个 .md | 2 个 .md |
| 索引页面数 | 21 个 | 6 个 |

> 耗时略快 ~14%。主要收益在用户体验：17 个碎片页面 → 2 个聚合页面，指标选择器切换比翻页更流畅。
