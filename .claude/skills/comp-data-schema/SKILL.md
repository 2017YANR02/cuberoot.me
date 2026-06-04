---
name: comp-data-schema
description: "Use when touching WCA competition JSON (upcoming_comps/all_past_comps), their consumers, or any comp picker/search UI. Triggers: \"比赛 JSON\", \"upcoming_comps\", \"all_past_comps\", \"competition schema\", \"比赛数据源\", \"比赛搜索\", \"CompPicker\", \"comp picker\", \"搜比赛\"."
---

# Competition 数据源（预生成 JSON）

所有比赛相关静态 JSON 都在 `/stats/` 下，前端通过 `serveRepoRoot` Vite 插件在本地 serve。生产由 GH Actions 自动 commit，**不要手改**。

| JSON | 生成器 | 触发 | 用途 |
|---|---|---|---|
| `/stats/upcoming_comps.json` | `fetch_upcoming_comps.ts`（stats-build） | `.github/workflows/update_upcoming.yml`（每天 20:00 UTC） | UpcomingComps Top 模式（只含有顶尖选手参赛的比赛 + cubing.com 中国比赛） |
| `/stats/all_upcoming_comps.json` | 同上脚本第二段 | 同上 | Globe upcoming 模式 + UpcomingComps All 模式（WCA 全球全量 upcoming） |
| `/stats/all_past_comps.json` | `core/packages/stats-build/src/bin/gen_all_comps.ts` | `.github/workflows/stats.yml`（每周日 20:00 UTC） | Globe history 模式（WCA 历史所有已结束比赛） |

## `upcoming_comps.json`（Top 模式专用）

- 顶层：`updated_at`（ISO）、`total_cubers_tracked`（整数）、`competitions`（数组）
- **Competition 字段**：`id`、`name` / `name_zh`、`city` / `city_zh`、`country`（ISO alpha-2）、`start_date` / `end_date`、`events`（短名数组，见 `SHORT_TO_EVENT_ID`）、`competitor_limit`、`cubing_china_url?`、`top_cubers`
- **TopCuber**：`id`、`name`（英文，可含括号中文 `Yiheng Wang (王艺衡)`）、`events`（含 `wr: 'current'|'former'|null`）

## `all_upcoming_comps.json`（Globe + All 模式）

纯数组，每条：`id`、`name`、`city`、`country`（ISO alpha-2）、`start_date`、`end_date`、`events`（短名）、`competitor_limit`、`latitude_degrees`、`longitude_degrees`、`url`

## `all_past_comps.json`（History 模式）

纯数组（~14k 条），每条：`id`、`name`、`city`、`country`、`latitude_degrees`、`longitude_degrees`、`start_date`、`end_date`、`events`（短名）。无 url — 前端从 id 反推 `https://www.worldcubeassociation.org/competitions/{id}`。

## UI 比赛搜索（任何"输入比赛"的地方都用它）

- 组件：`components/CompPicker.tsx` —— 文本输入 + 自动补全下拉，允许自由文本（非 WCA 比赛仍可手填）
- 数据源：`utils/comp_search.ts::loadComps()` —— 合并 `all_past_comps` + `all_upcoming_comps`（按 id 去重），按需懒加载，模块级缓存。**不要再写一份本地搜索/缓存。**
- 父组件传 `onPick(comp)` 一次性回填 name / id / country / date 等字段（参考 ReconSubmitPage `applyPickedComp`）
- 中文模式 `isZh` 时显示 `compNameZh(c.name)`（country_flags.ts），落空则回退英文
- 日期统一走 `utils/date_range.ts::formatDateRangeIso`

## 通用规则

- `country === 'TW'` 特判：旗子用 `/tools/assets/images/ChineseTaipei.svg`，不用 `flag-icons`
- 事件短名约定见 `SHORT_TO_EVENT_ID`（UpcomingCompsPage） / `EVENT_DISPLAY_ORDER`（fetch_upcoming_comps.ts）
- 在 GlobePage 的 choropleth / WR 模式里，TW 的计数合并进 CN（参考现有 `countryCounts` / `wrCountryCounts` 里的 `iso === 'TW' ? 'CN' : iso`）

## 已知坑

- **WCA `/competitions` 分页会出现跨页重复**：分页中途 WCA API 排序会漂移（新增 / cancel 状态改变），同一 id 跨页重复。`build_all_upcoming_comps` 必须按 id 去重（已在 `fetch_upcoming_comps.ts` 处理）。新写任何分页聚合 WCA 数据的脚本都要记得这一点。
- **单个 JSON 内不应该有同 id 重复**：如果 upcoming / past JSON 自身出现同 id 多条，**这就是上游数据 bug**，去生成脚本修，**不要在前端兜底** —— 前端静默去重会盖住 bug、让下次再出同类问题无从察觉。
- **upcoming 和 past 数据源间的同 id 重叠是正常的**：年初刚结束 / 即将开赛的比赛在两个 JSON 里都出现 —— 这是两份独立数据源的自然交集，不是 bug。前端合并两源时按 id 去重（以 upcoming 为准）是合理行为，见 GlobePage `upcomingGeojson` 里的 `upcomingIds` 逻辑。
