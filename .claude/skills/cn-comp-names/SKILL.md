---
name: cn-comp-names
description: "Use when regenerating `stats/comp_names_zh.json`, debugging Chinese comp names, or displaying comp name in new code (must go through `utils/comp_localize.ts`, never raw `c.name`). Triggers: \"中国比赛中文\", \"localizeCompName\", \"comp_names_zh\", \"fetch_comp_names_zh\", \"比赛名本地化\", \"stripWcaPrefix\", \"localizeCity\", \"CITY_ZH\"."
---

# 中国比赛名中文化

前端显示规则全在 `core/packages/client/src/utils/comp_localize.ts` 的 JSDoc（`localizeCompName` / `stripWcaPrefix`）。新代码渲染比赛名一律走它，禁止裸 `c.name`。`compNameZh()` 命中前先 `await loadFlagData()`。

## 数据：`stats/comp_names_zh.json`

由 `scripts/fetch_comp_names_zh.py` 生成。

```bash
python scripts/fetch_comp_names_zh.py           # 全量
python scripts/fetch_comp_names_zh.py --refresh # 增量（清第 1 页 + WCA API 缓存）
```

- 键同时存 WCA `name` 和 `short_name`，值是 cubing.com 中文名。
- 匹配：`_alias_to_wca_id_candidates`（原始 / 去 "Open" / 去 "Cubing" 前缀）→ 失败回退 `start_date + country=CN`；强差异老比赛靠 `ALIAS_TO_WCA_ID_OVERRIDE` 硬编码。
- 缓存目录 `.comp_names_zh_cache/`（.gitignore）。

## 爬虫已知坑

- cubing.com 临近开赛会把 URL 从 `/competition/` 切到 `/live/`，scraper 正则两种都要收。
- 日期格式有三种：`~DD`（同月）/ `~MM-DD`（同年跨月）/ `~YYYY-MM-DD`（跨年，如 `2025-12-31~2026-01-01`）—— 正则三种都要兼容。
- WCA API `name`（全名）vs `short_name`（短名）必须都作 key，否则 `all_past_comps.json`（用 `name`）查不到。
- 页面没更新？看 `Deploy Core` 是否失败、`dist/_assets/*.js` 是否含新代码。

## 城市名（兄弟模块）

`utils/city_localize.ts::localizeCity(city, isZh)`，新增城市直接往 `CITY_ZH` 加键。
