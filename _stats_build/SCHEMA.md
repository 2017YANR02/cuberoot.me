# 数据库 Schema 参考

数据库：`wca_statistics`（从 [WCA Developer Export](https://www.worldcubeassociation.org/export/developer) 导入，详见 `DEPLOYMENT.md`）

---

## 项目使用的表（共 11 张）

数据库总计 121 张表，统计脚本只用到以下这些：

| 表名 | 行数 | 大小 | 用途 |
|------|-----:|-----:|------|
| `results` | 609 万 | 798 MB | 核心：所有比赛成绩 |
| `persons` | 28 万 | 24 MB | 选手信息 |
| `competitions` | 1.3 万 | 40 MB | 比赛信息 |
| `countries` | 207 | — | 国家名称 |
| `continents` | 7 | — | 洲名称 |
| `events` | 21 | — | 项目定义（333、444 等） |
| `formats` | 7 | — | 比赛格式（Ao5、Mo3 等） |
| `round_types` | 11 | — | 轮次类型（初赛、决赛等） |
| `championships` | 858 | — | 锦标赛标记（世锦赛相关统计用） |
| `preferred_formats` | 26 | — | 各项目首选格式 |
| `users` | 51 万 | 68 MB | 用户信息 |

> `ranks_single` / `ranks_average` 在 WCA 导出中数据为空，排名需从 `results` 手动计算。

---

## 各表列结构

### `results`（609 万行，798 MB）

| 列名 | 类型 | 可空 | 索引 | 说明 |
|------|------|:----:|:----:|------|
| `id` | int | NO | PRI | 主键（自增）|
| `average` | int | NO | MUL | 平均成绩（厘秒，-1=DNF）|
| `best` | int | NO | MUL | 最佳单次（厘秒）|
| `competition_id` | varchar(32) | NO | MUL | 比赛 ID → `competitions.id` |
| `country_id` | varchar(50) | NO | MUL | 选手国籍（冗余字段）|
| `event_id` | varchar(6) | NO | MUL | 项目（如 `333`、`444bf`）|
| `format_id` | varchar(1) | NO | MUL | 比赛格式（`a`=Ao5，`m`=Mo3）|
| `person_id` | varchar(10) | NO | MUL | 选手 WCA ID → `persons.wca_id` |
| `person_name` | varchar(80) | NO | — | 选手姓名（冗余字段）|
| `pos` | smallint | NO | — | 该轮名次 |
| `regional_average_record` | varchar(3) | YES | MUL | 平均记录（`WR`/`CR`/`NR`/NULL）|
| `regional_single_record` | varchar(3) | YES | MUL | 单次记录（`WR`/`CR`/`NR`/NULL）|
| `round_id` | int | NO | MUL | 轮次 ID |
| `round_type_id` | varchar(1) | NO | MUL | 轮次类型 → `round_types.id` |
| `updated_at` | timestamp | NO | — | 最后更新时间 |
| `value1` | int | NO | — | 第 1 次成绩 |
| `value2` | int | NO | — | 第 2 次成绩 |
| `value3` | int | NO | — | 第 3 次成绩 |
| `value4` | int | NO | — | 第 4 次成绩（Mo3 项目为 0）|
| `value5` | int | NO | — | 第 5 次成绩（Mo3 项目为 0）|

**成绩值编码**：`正整数` = 厘秒（0.01 秒），`-1` = DNF，`-2` = DNS，`0` = 无此次

---

### `persons`（28 万行）

| 列名 | 类型 | 可空 | 索引 | 说明 |
|------|------|:----:|:----:|------|
| `id` | int | NO | PRI | 主键（自增）|
| `comments` | varchar(40) | NO | — | 管理员备注 |
| `country_id` | varchar(50) | NO | MUL | 国籍 → `countries.id` |
| `dob` | date | YES | — | 出生日期 |
| `gender` | varchar(1) | YES | — | 性别（`m`/`f`）|
| `incorrect_wca_id_claim_count` | int | NO | — | 错误认领次数 |
| `name` | varchar(80) | YES | MUL | 选手姓名 |
| `sub_id` | tinyint | NO | — | 子 ID（1=当前有效，>1=历史记录）|
| `wca_id` | varchar(10) | NO | MUL | WCA ID（如 `2017XURU04`）|

> **注意**：`sub_id = 1` 才是当前有效选手，查询时必须加 `AND person.sub_id = 1`

---

### `competitions`（1.3 万行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(32) | 主键（如 `LyonOpen2007`）|
| `cell_name` | varchar(45) | 显示名称（短名）|
| `name` | varchar(50) | 完整名称 |
| `country_id` | varchar(50) | 国家 |
| `city_name` | varchar(50) | 城市 |
| `start_date` | date | 开始日期 |
| `end_date` | date | 结束日期 |
| `venue` | varchar(240) | 场馆 |
| `latitude` / `longitude` | int | 坐标（微度）|
| *(其余 60+ 列)* | — | 报名/费用/配置等运营字段，统计脚本不使用 |

---

### `countries`（207 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(50) | 主键（如 `China`）|
| `continent_id` | varchar(50) | 所属洲 → `continents.id` |
| `iso2` | varchar(2) | ISO 2 字母代码（如 `CN`）|
| `name` | varchar(50) | 国家名称 |

---

### `continents`（7 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(50) | 主键（如 `_Asia`）|
| `name` | varchar(50) | 洲名称 |
| `record_name` | varchar(3) | 记录缩写（如 `AsR`）|
| `latitude` / `longitude` / `zoom` | int/tinyint | 地图展示用 |

---

### `events`（21 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(6) | 主键（如 `333`、`minx`）|
| `format` | varchar(10) | 格式类型 |
| `name` | varchar(54) | 项目全名（如 `3x3x3 Cube`）|
| `rank` | int | 显示排序 |

---

### `formats`（7 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(1) | 主键（`a`=Ao5，`m`=Mo3，`3`=Bo3 等）|
| `expected_solve_count` | int | 预期还原次数 |
| `name` | varchar(50) | 格式名称 |
| `sort_by` | varchar(255) | 排名依据（`average`/`single`）|
| `sort_by_second` | varchar(255) | 次排名依据 |
| `trim_fastest_n` | int | 去掉最快 N 次 |
| `trim_slowest_n` | int | 去掉最慢 N 次 |

---

### `round_types`（11 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | varchar(1) | 主键（如 `1`=第一轮，`f`=决赛）|
| `cell_name` | varchar(45) | 简短名称 |
| `name` | varchar(50) | 完整名称 |
| `final` | tinyint(1) | 是否为决赛轮 |
| `rank` | int | 显示排序 |

---

### `championships`（858 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | int | 主键 |
| `championship_type` | varchar(191) | 类型（`world`/`continental`/国家代码）|
| `competition_id` | varchar(191) | 比赛 ID → `competitions.id` |

---

### `preferred_formats`（26 行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `event_id` | varchar(191) | 项目 ID（联合主键）|
| `format_id` | varchar(191) | 格式 ID（联合主键）|
| `ranking` | int | 优先级（1=首选）|

---

### `users`（51 万行）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | int | 主键 |
| `wca_id` | varchar(191) | WCA ID（可关联 `persons.wca_id`）|
| `name` | varchar(255) | 姓名 |
| `email` | varchar(191) | 邮箱（唯一）|
| `country_iso2` | varchar(255) | 国家 ISO2 |
| `gender` | varchar(255) | 性别 |
| `dob` | date | 出生日期 |
| *(其余 30+ 列)* | — | 认证/会话/通知等系统字段，统计脚本不使用 |

---

## 常用查询示例

```sql
-- 查某选手三阶成绩
SELECT value1, value2, value3, value4, value5, best, average, competition_id
FROM results
WHERE person_id = '2017XURU04' AND event_id = '333'
ORDER BY average;

-- 查所有平均 WR 轮次
SELECT person_id, event_id, average, competition_id, start_date
FROM results
JOIN competitions ON competitions.id = competition_id
WHERE regional_average_record = 'WR'
ORDER BY start_date;

-- 手动计算某人全球单次排名（ranks_single 为空，需手动算）
SELECT COUNT(DISTINCT person_id) + 1 AS world_rank
FROM (
  SELECT person_id, MIN(best) AS pb
  FROM results
  WHERE event_id = '333' AND best > 0
  GROUP BY person_id
) others
WHERE pb < (
  SELECT MIN(best) FROM results
  WHERE person_id = '2017XURU04' AND event_id = '333' AND best > 0
);
```
