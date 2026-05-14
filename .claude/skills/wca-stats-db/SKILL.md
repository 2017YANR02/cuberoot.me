---
name: wca-stats-db
description: "Use whenever writing SQL against the local wca_statistics MySQL dump (in stats-build statistics, ad-hoc validation, or debugging). Covers schema (snake_case! not camelCase), key tables (results / competitions / persons / events / round_types / formats / result_attempts / countries / continents), join idioms (sub_id=1, rank<900), special value encodings (DNF=-1, DNS=-2, FMC, multi-blind), regional records markers, table-name case quirk on Windows. Triggers: \"WCA SQL\", \"WCA dump\", \"WCA schema\", \"results 表\", \"competitions 表\", \"event_id\", \"person_id\", \"result_attempts\", \"regional_single_record\", \"sub_id\"."
---

# WCA Statistics DB

本仓库本地的 WCA dump：`E:\mysql_data\wca_statistics`，连接配置在 `core/packages/stats-build/database.yml`。**写 SQL 前先看这个文件**，凭对 WCA 公开 TSV 的肌肉记忆会踩坑。

## 🔥 头号坑:`results` 表没有 `value1..value5`

WCA 公开 TSV / 老 Ruby 代码 / 训练数据里到处是 `r.value1, r.value2, ..., r.value5`。**本 dump 把 5 次 attempt 拆出去了**。要 attempt 值用:

- `result_attempts`(长格式,推荐):`(SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) FROM result_attempts ra WHERE ra.result_id = r.id) AS atts`,client 端 `attsStr.split(',').map(Number)`
- `result_values`(宽格式,本地有但**不在 CI REQUIRED_TABLES**,stats-build 里禁用)

写 `r.value[1-5]` 的 SQL = 必挂(本地 + CI 都挂)。

## ⚠️ 本地 dump ≠ CI 可用表

本地 dump 是 WCA 全量；CI (`update_database.ts`) 只导入 `REQUIRED_TABLES` 15 张：

```
championships, competitions, competition_delegates, continents,
countries, events, formats, persons, preferred_formats,
ranks_single, ranks_average, result_attempts, results,
round_types, users
```

**本地能 join 到的 `competition_events` / `rounds` / `rounds_*` / `championships_*` 关联表 / `posts` / 任何 `_metadata` 表 → CI 没有。**

写新 SQL（stats、bin 脚本、validate）前必须确认所用表在 `REQUIRED_TABLES`（`core/packages/stats-build/src/core/database.ts`）。要新增表就同时改 `REQUIRED_TABLES`，否则本地通过 / CI 红。

## 命名约定（最常见的坑）

- **所有列名 snake_case**：`event_id` / `person_id` / `competition_id` / `country_id` / `start_date`。**不是** camelCase（WCA 公开 TSV 是 `eventId`）。
- 表名在 Windows MySQL 上**大小写不敏感**（`lower_case_table_names=1`）：`Results` / `results` 都能查到同一张表。本仓库代码混用，写新代码统一用小写更稳。
- 反引号裹保留字：`\`rank\`` 必须 quote，否则语法错。

## 关键表速查

### `results`（6.4M 行，主表）
```
id              bigint        主键
person_id       varchar(10)   选手 WCA ID（→ persons.wca_id，不是 persons.id）
person_name     varchar(80)   冗余存的名字
country_id      varchar(50)   选手当时国籍（→ countries.id）
competition_id  varchar(32)   比赛 ID（→ competitions.id）
event_id        varchar(6)    项目（→ events.id，如 '333' '333fm'）
round_type_id   varchar(1)    轮次类型（→ round_types.id，如 '1' '2' 'f'）
format_id       varchar(1)    赛制（→ formats.id，如 'a' 'm' '3'）
round_id        int           rounds 表外键
pos             smallint      该轮排名
best            int           单次最好成绩（特殊值见下）
average         int           平均成绩（0 = 该轮无平均）
regional_single_record  varchar(3)   'WR' / 'NR' / 'AsR' / 'AfR' / 'ER' / 'NAR' / 'OcR' / 'SAR' / NULL — 大洲精确到 6 个,没有通用 'CR'
regional_average_record varchar(3)   同上
```

> ⚠️ **没有 `value1..value5` 列**！每次具体成绩在另两张表（见下）。

### `result_attempts`（长格式，每次一行）/ `result_values`（宽格式 v1..v5）

两张都有，按需选：
- 聚合多个 attempt（DNF 率、avg of N 重算）→ `result_attempts`，`JOIN result_attempts ra ON ra.result_id = r.id`
- 想要 `(v1,v2,v3,v4,v5)` 平铺 → `result_values`，`JOIN result_values rv ON rv.result_id = r.id`

`result_attempts.value` 用 `attempt_number ASC` 还原顺序。

### `competitions`（17k 行）
```
id              varchar(32)   字符串 ID（如 'WC2003'）
name            varchar(50)
start_date      DATE          ✅ 直接用，不要 CONCAT(year,month,day)
end_date        DATE
country_id      varchar(50)   → countries.id
city_name       varchar(50)
```
> 老 Ruby 代码用 `CONCAT(c.year,'-',c.month,'-',c.day)` —— 本 dump 没有 year/month/day 列，**只有 start_date**。

### `persons`（283k 行，注意有重复）
```
id        int           自增数字主键（很少用）
wca_id    varchar(10)   ✅ 真正的 WCA ID
name      varchar(80)   带括号本地名（如 "Yiheng Wang (王艺衡)"）
country_id varchar(50)
sub_id    tinyint       同一选手可能多行；canonical 行 sub_id=1
```
**join 模板**：
```sql
JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
```
忘了 `sub_id = 1` 会重复算（每个改过国籍的选手都有 ≥2 行）。

### `events`（21 行）
```
id        varchar(6)    '333' '222' ... 'magic' 'mmagic' '333mbo' '333ft'
name      varchar(54)
format    varchar(10)   'time' / 'number'(FMC) / 'multi'(MBLD)
rank      int           排序，**rank ≥ 900 = 已废除（magic/mmagic/333mbo/333ft）**
```
**惯用过滤**：现役项目 = `rank < 900`（17 个项目）。

### `round_types`（11 行）
```
id    varchar(1)   'h'/'0'(预赛) 'd'/'1'(首轮) 'e'/'2' 'g'/'3'(半决) 'b'(B Final) 'c'/'f'(决赛)
final tinyint      只有 'c' / 'f' = 1
rank  int          排序
```
**决赛**：`rt.final = 1` 或 `r.round_type_id IN ('c','f')`。

### `formats`（7 行）
`'1' '2' '3' '5' 'a'(avg of 5) 'm'(mean of 3) 'h'(head-to-head)`。`expected_solve_count`、`trim_fastest_n / trim_slowest_n` 决定 avg 计算。

### `countries` / `continents`
```sql
JOIN countries co ON co.id = r.country_id
JOIN continents ct ON ct.id = co.continent_id
```
- 特殊国家：`XW` = "Multiple Countries (World)"（接力等）
- 特殊大洲：`_Multiple Continents`（前缀下划线）
- `iso2` 可能 NULL；`continents.record_name` = 大洲记录代号（'AfR'/'AsR'/'ER'/'NAR'/'OcR'/'SAR'）

## 成绩值编码（`best` / `average` 的语义）

| 值 | 含义 |
|---|---|
| `>0` | 正常成绩。**计时项目**：厘秒（`val/100.0` 秒）；**FMC 单次**：步数（直接整数）；**FMC mean**：步数 × 100 |
| `0` | 该轮无成绩（如只比单次的轮没 average，或 DNS 之前的空槽） |
| `-1` | DNF |
| `-2` | DNS |

**惯用过滤**：「有效成绩」用 `best > 0`（自动排掉 0/DNF/DNS）。

**多盲（333mbf / 333mbo）特殊编码**：DDDTTTTTMM（new）或老格式。**别自己解**——用 `core/solve_time.ts` 的 `SolveTime` 类。

## 常用 SQL 片段

### 比赛日期
```sql
JOIN competitions c ON c.id = r.competition_id
-- 用 c.start_date 做时间过滤
WHERE c.start_date >= '2020-01-01'
```

### 选手 PB 流（每次刷 PB 一行）
```sql
WITH solves AS (
  SELECT r.person_id, r.best, c.start_date AS d
  FROM results r JOIN competitions c ON r.competition_id = c.id
  WHERE r.event_id = ? AND r.best > 0
),
running AS (
  SELECT person_id, best, d,
    MIN(best) OVER (
      PARTITION BY person_id ORDER BY d, best
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_min
  FROM solves
)
SELECT person_id, best, d FROM running
WHERE prev_min IS NULL OR best < prev_min;
```

### 每个选手该项目的 PB（最简）
```sql
SELECT person_id, MIN(best) AS pb
FROM results
WHERE event_id = '333' AND best > 0
GROUP BY person_id;
```

### 当前 WR（截至今天的最好）
```sql
SELECT MIN(r.best) FROM results r
JOIN competitions c ON c.id = r.competition_id
WHERE r.event_id = ? AND r.best > 0 AND c.start_date <= CURDATE();
```

### WR 沿革（历次破纪录）
直接走 `regional_single_record = 'WR'` / `regional_average_record = 'WR'`，已有标记，**不用自己重算**。

```sql
SELECT r.person_id, r.best, c.start_date
FROM results r JOIN competitions c ON c.id = r.competition_id
WHERE r.event_id = ? AND r.regional_single_record = 'WR'
ORDER BY c.start_date, r.best;
```

### 决赛
```sql
WHERE r.round_type_id IN ('c', 'f')
-- 或 JOIN round_types rt ON rt.id = r.round_type_id WHERE rt.final = 1
```

### 排除已废除项目
```sql
JOIN events e ON e.id = r.event_id AND e.rank < 900
```

## 常见错误 cheatsheet

| 错误写法 | 应该 |
|---|---|
| `r.eventId` | `r.event_id` |
| `c.year`/`c.month`/`c.day` 拼日期 | `c.start_date`（DATE 列） |
| `rank` 不加反引号 | `\`rank\`` |
| `JOIN persons p ON p.wca_id = r.person_id`（漏 sub_id） | 加 `AND p.sub_id = 1` |
| 想要 attempts 1..5 在 results 表里找 | 去 `result_attempts` 或 `result_values` |
| `r.best != -1`（想排除 DNF） | `r.best > 0`（连 0/DNS 一起排） |
| `JOIN events`（不过滤） | 加 `AND e.rank < 900` 排废除项目 |

## 排查 SQL 报错

凭据 / 端口都 OK 的情况下，typecheck 看不到 SQL 字符串里的错。改完 stat 的 `query()` **必须**：

```bash
pnpm --filter @cuberoot/stats-build run validate-queries
```

会对全部 stat 跑 `EXPLAIN`，秒级捕获列名 / 表名拼错。详见 stats-build skill。

## 参考

- 上游 schema 文档（公开 TSV 版，camelCase）：https://github.com/thewca/worldcubeassociation.org/blob/main/db/structure.sql
- Ruby 原版 `_stats_build/`：很多 stat 的查询模板源头（注意它仍用老 `c.year/month/day`，移植到本 dump 必须换 `start_date`）
