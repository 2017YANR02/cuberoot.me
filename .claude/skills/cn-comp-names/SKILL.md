---
name: cn-comp-names
description: "Use when rendering or localizing Chinese competition names or city names (in Chinese UI mode, CN comps show \"2015北京魔方公开赛\" not \"Beijing Open 2015\"; cities show \"上海\" not \"Shanghai\"). Comp names go through `localizeCompName` (utils/comp_localize.ts) or `localizeName` (UpcomingCompsPage); cities through `utils/city_localize.ts::localizeCity`. Display layer auto-strips \"WCA \" via `stripWcaPrefix`. Also use when regenerating `stats/data/comp_names_zh.json` or debugging missing translations. Triggers: \"中国比赛中文\", \"localizeCompName\", \"comp_names_zh\", \"fetch_comp_names_zh\", \"比赛名本地化\", \"城市名中文\", \"localizeCity\", \"CITY_ZH\", \"stripWcaPrefix\"."
---

# 中国比赛名中文化

## 前端显示

- 渲染比赛名一律走 `localizeCompName(id, name, isZh)`（`utils/comp_localize.ts`），或同语义的 `localizeName(c, isZh)`（`UpcomingCompsPage.tsx`）。禁止裸 `c.name`。
- 4 级查表：`upcomingNameZhById` → `comp_names_zh.json`（`compNameZh`）→ OpenCC 繁→简（含 CJK 时）→ 原英文名。
- 调用前先 `await loadFlagData()`，否则 `compNameZh` 永远 miss。
- `GlobePage` MapLibre 闭包用 `localizeCompNameRef.current(id, name)`，不能直接用 React state。

## display-only 去 "WCA "

- `stripWcaPrefix(s)`（`utils/comp_localize.ts`）：`/WCA /gi` + trim。`localizeCompName` / `localizeName` 已内置；其它直接用 `compNameZh()` 显示的地方手动包一层。
- 仅显示层走，搜索 / 表单提交 / 数据存储路径保留原名（`comp_search`、`UpcomingCompsPage` searchName、`ReconSubmitPage::applyPickedComp` 等）。
- 不动 JSON 数据。

## 数据：`stats/data/comp_names_zh.json`

由 `scripts/fetch_comp_names_zh.py` 生成。

```bash
python scripts/fetch_comp_names_zh.py           # 全量
python scripts/fetch_comp_names_zh.py --refresh # 增量（清第 1 页 + WCA API 缓存）
```

- 键同时存 WCA `name` 和 `short_name`；值是 cubing.com 中文名。
- 匹配：`_alias_to_wca_id_candidates`（原始 / 去 "Open" / 去 "Cubing" 前缀）→ 失败回退 `start_date + country=CN`；强差异比赛靠 `ALIAS_TO_WCA_ID_OVERRIDE` 硬编码。
- 缓存目录 `.comp_names_zh_cache/`（.gitignore）。

## 常见坑

- cubing.com 临近开赛会把 URL 从 `/competition/` 切到 `/live/`，scraper 正则两种都要收。
- WCA API `name`（全名）vs `short_name`（短名）两套必须都作 key，否则 `all_past_comps.json`（用 `name`）查不到。
- 页面没更新？看 `Deploy Core` 是否失败、`dist/_assets/*.js` 是否含新代码。

## 城市名（兄弟模块）

`utils/city_localize.ts::localizeCity(city, isZh)`，新增城市直接往 `CITY_ZH` 加键。不要在新页面再写一份表。
