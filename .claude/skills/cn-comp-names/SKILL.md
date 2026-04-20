---
name: cn-comp-names
description: "Use when rendering or localizing Chinese competition names (in Chinese UI mode, CN comps should show Chinese like \"2015WCA北京魔方公开赛\" not \"Beijing Open 2015\"). Also use when regenerating `stats/data/comp_names_zh.json` or debugging missing translations. Triggers: \"中国比赛中文\", \"localizeCompName\", \"comp_names_zh\", \"fetch_comp_names_zh\", 比赛名本地化."
---

# 中国比赛名中文化

中文模式下，中国大陆比赛名应显示中文（`2015WCA北京魔方公开赛`），而非英文（`Beijing Open 2015`）。

## 前端工具：`localizeCompName(id, name)`

定义在 `core/packages/client/src/pages/GlobePage.tsx`（搜 `localizeCompName`）。

查表优先级：
1. `upcoming_comps.json` 的 `id → name_zh`（覆盖追踪选手的近期赛）
2. `comp_names_zh.json` 的英文名 → 中文名
3. OpenCC 繁 → 简（名字本身含 CJK 时）
4. 兜底原英文名

**所有渲染比赛名的地方都要调用 `localizeCompName`**——包括 hover popup、click 弹窗、selectedComps 面板、search 结果。**不要直接用 `c.name` / `p.name`**。

### MapLibre 闭包内用法

`map.on('mouseenter', ...)` 是一次性注册，拿不到最新 React state。已有 `localizeCompNameRef`（在 GlobePage.tsx 里搜），闭包里通过 `localizeCompNameRef.current(id, name)` 调用。

## 数据来源：`stats/data/comp_names_zh.json`

由 `scripts/fetch_comp_names_zh.py` 生成：
- **键**：WCA 英文 `name`（完整，如 "Beijing Open 2015"）**和** `short_name`（如 "Beijing 2015"），两者都作 key
- **值**：cubing.com 中文名（如 "2015WCA北京魔方公开赛"）
- **匹配策略**（两级）：
  1. 主路径：cubing.com URL alias 生成多个 WCA ID 候选（原始 / 去掉 "Open" / 去掉 "Cubing" 前缀）→ 查 WCA API
  2. 回退：候选都失败时，按 `start_date` + `country=CN` 在 WCA API 里唯一匹配（cubing.com list 已含开始日期；CN 同日极少多场，可靠）。专门处理老比赛词序反转的 alias（如 `WCA-2011-February-Beijing-Open` ↔ `BeijingFebruary2011`）。

## 更新数据

```bash
python scripts/fetch_comp_names_zh.py           # 全量（首次或缓存过期）
python scripts/fetch_comp_names_zh.py --refresh # 增量（只刷新第 1 页 + WCA API 缓存）
```

缓存目录 `.comp_names_zh_cache/`（.gitignore）。首次 ~30 秒，后续 ~1 秒。

## 常见坑

- **漏词**：cubing.com URL alias 保留 `Open` 等词，WCA ID 常省略 —— 所以需要候选生成器 `_alias_to_wca_id_candidates`
- **short_name vs name**：WCA API 同一比赛两种英文名（如 `short_name="Beijing 2013"` 和 `name="Beijing Winter Open 2013"`），scraper 必须两者都作 key，否则 `all_past_comps.json`（用 `name`）查不到
- **页面显示未更新**：大多是 CI `Deploy Core` build 失败 → `dist/` 没重建。先看 `_assets/GlobePage-*.js` 是否含 `localizeCompNameRef` 等新代码

## 不相关的本地化

这份 JSON 只管**大陆比赛**的中文名。TW/HK/海外比赛不在这里。其他语言也不在这里。
