# Nemesizer 移植设计

**Date:** 2026-04-24
**Scope:** 将 https://nemesizer.com 的全部功能移植到本站，新顶级路由 `/nemesizer`，从 `/wca-stats` 入口页链接过去。纯静态（GitHub Pages），数据和计算全部 client-side。

## 1. 术语与定义

- **rank**:WCA 世界排名（`RanksSingle.worldRank` / `RanksAverage.worldRank`），整数，越小越强
- **(event, kind)**: `kind ∈ {single, average}`，本文简写为 `ek`
- **P 的 nemesis Q**: 两人至少共享 1 个 `ek`，且在所有共同 `ek` 上 `rank_Q < rank_P`
- **nearly nemesis Q of P**: 共同 `ek` 中 Q 的 rank 只在 1 项上 ≥ P；其他项全部 `<`
- **only just nemesis Q of P**: 共同 `ek` 中 Q 最差的那项 `rank_Q == rank_P − 1`（即 Q 把该项再差 1 名就不是 nemesis 了）
- **nemesizer.com 反向视图（who I nemesize）**: P 去 nemesize Q ⇔ Q 是 P 的 reverse-nemesis ⇔ P 在共同 ek 全部比 Q 好

## 2. 路由 & URL

顶级路由 `/nemesizer`，通过 query 切视图（全状态可分享）：

| mode | URL 参数 | 说明 |
|---|---|---|
| `standard`（默认） | `?person=<id\|name>&view=myNem\|iNem\|nearlyMe\|iNearly\|onlyJustMe\|iOnlyJust&scope=world\|continent\|country&show=people\|countries&sort=<col>&dir=up\|down` | 搜索 + 六种 nemesis 列表 |
| `h2h` | `?p1=<id>&p2=<id>&show=ranks\|results` | 两人对比 |
| `whatif` | `?person=<id>&show=myNem\|iNem&showUnit=ranks\|results&what=people\|countries&ev.<eventId>_<kind>=<rank>` (多个 ev 参数叠加) | 假设 rank 重算 nemesis |
| `stats` | `?tab=most\|few\|people\|biggest\|countries&scope=world\|continent\|country` | 全局统计 5 个 tab |

入口：`WcaStatsIndex.tsx` 顶部加一张"Nemesizer"入口卡片（和已有 stat 卡片并列）。

## 3. 数据管道

### 3.1 生成（stats-build）

在 `core/packages/stats-build/src/` 加新命令 `nemesizer`，从 WCA Postgres 导出：

**输出到 `stats/nemesizer/`：**

1. **`persons.bin`** — 有至少 1 条 rank 记录的所有 person，按 `personId` 升序：
   ```
   header: magic "NEMP" | version u32 | count u32
   record (variable length):
     wcaId    10 bytes ASCII (right-padded with \0 if <10)
     countryIso2  2 bytes ASCII
     nameLen  u16
     nameUtf8 nameLen bytes
   ```
   Index in file = `personIdx`（后续所有表引用这个 u32）

2. **`ranks.bin`** — `RanksSingle ∪ RanksAverage`：
   ```
   header: magic "NEMR" | version u32 | count u32
   record (10 bytes, packed):
     personIdx u32
     eventIdx  u8   (enum: 333=0, 222=1, 444=2, ... 18 个 event)
     kind      u8   (0=single, 1=average)
     worldRank u32
   ```

3. **`stats.bin`** — 预计算的全局统计（避免 client N² 算）：
   ```
   header: magic "NEMS" | version u32
   每个 person 的 nemesisCount / nemesizedCount / 平均 rank 等
   section: most_nemeses_world top-N (N=5000)
   section: few_nemeses_world top-N
   section: biggest_nemesizers_world top-N
   section: continents lookup + top-N per continent
   section: countries lookup + top-N per country
   ```
   N=5000 对所有 tab / scope 组合。

4. **`meta.json`** — 小 JSON：
   ```json
   {
     "generatedAt": "2026-04-24T...",
     "exportDate": "2026-04-20",     // WCA export 日期
     "personCount": 450000,
     "rankCount": 2100000,
     "events": [{"id":"333","name":"3x3x3 Cube","nameZh":"三阶"}, ...],
     "countries": [{"iso2":"CN","name":"China","continent":"Asia"}, ...]
   }
   ```

**体积预估（gzip 后）：persons 10 MB, ranks 6 MB, stats 1 MB, meta <10 KB。合计 ~17 MB gzip。**

### 3.2 部署白名单

`stats/nemesizer/**` 要加入两个 workflow 的 path filter（参考 skill `deploy-public-asset`）。

### 3.3 client 加载

- 首屏只渲染搜索框 + loading bar
- 后台 `fetch(..., {cache: 'force-cache'})` → `ArrayBuffer` → 解析成 `Persons`、`Ranks` typed arrays
- IndexedDB 缓存（key 带 `exportDate`，换数据自动失效）
- 服务化封装 `nemesizerData.ts`：`loadData()`、`getPerson(id)`、`searchPersons(query)`、`getRanks(personIdx)`

## 4. 核心算法（client-side）

### 4.1 索引（加载后一次性建）

- `nameIndex: Map<lowerCaseName, personIdx>`
- `wcaIdIndex: Map<wcaId, personIdx>`
- `byEk[ev][kind]: Uint32Array`（按 worldRank 升序排的 personIdx 列表 —— 直接就是 WCA 世界排名序）
- `ranksByPerson[personIdx]: {ev, kind, rank}[]`（person 的全部 rank 记录）
- `countryOfPerson[personIdx]: u16`（映射 → meta.countries 索引）

### 4.2 nemesisOf(P)

```
commonEks = ranksByPerson[P]  // P 参与的所有 ek
if commonEks.empty: return []

// 对每个 ek，取 byEk[ev][kind] 里 rank < rankOfP 的 person 集合（即该 ek 下排名比 P 好的所有人）
sets = commonEks.map(({ev, kind, rank}) => prefixSet(byEk[ev][kind], until=rank))

// 多集合交集（用最小的那个集合遍历，其他集合做哈希包含判断）
result = intersection(sets)

// 过滤：要求共享 ek 的条件自动满足（因为 Q 在某 ek 里 rank < P 就意味着 Q 有该 ek 的 rank）
// 但要剔除 P 自己
return result.filter(q => q != P)
```

"nemesize"（反向）对称：rank > P 的 prefix，然后交集。

### 4.3 nearly / only just

实现为 nemesisOf 的 soft 版本：

- **nearly nemesis of P**: Q 在 `|commonEks|−1` 个 ek 上 rank < rankP，且在恰好 1 个 ek 上 rank ≥ rankP
  算法：对每个 ek 允许"豁免"，枚举豁免哪一项 → 并集 → 去除严格 nemesis
- **only just**: Q 是 nemesis，且存在某共同 ek 使 `rank_Q == rank_P − 1`
  算法：nemesis 集合过滤

Scope 过滤（world/continent/country）在结果集上后过。

### 4.4 scope & show

- scope ∈ {world, continent(P), country(P)} — 对 nemesis 结果按 countryOfPerson 筛选
- show=countries — 对结果按 country 聚合计数

### 4.5 what-if

用户填 `(ev, kind) → newRank` 的 override map。复用 4.2，但：
- P 的 ranksByPerson 用 override 后的值
- 对没 override 但用户"新加"的 ek，prefix 取到 `newRank` 为止
- 其他人的数据不变（override 只影响 P 自己）

### 4.6 H2H

- ranks 视图：列两人各 ek 的 worldRank，较小者绿色背景
- results 视图：需要真实 `best` 时间。把 `best u32` 加进 `ranks.bin` 的 record（10 → 14 B/条），总体 ranks.bin +8 MB 原始 / +~3 MB gzip。

### 4.7 统计 tabs

| tab | 数据来源 |
|---|---|
| most nemeses | `stats.bin` 的 nemesisCount 排序，前 N |
| few nemeses | 同上反序 |
| people | 预计算每人 nemesis/nemesized count，用户自选排序 |
| biggest nemesizers | nemesizedCount 排序 |
| countries | 按国家聚合 |

全部支持 scope 切换，预计算时每个 scope 各一份。

## 5. 页面组件

```
core/packages/client/src/pages/nemesizer/
├── NemesizerPage.tsx          # 路由入口，按 mode 切子视图
├── NemesizerHeader.tsx        # 复刻 logo + 搜索框
├── modes/
│   ├── StandardMode.tsx
│   ├── H2HMode.tsx
│   ├── WhatIfMode.tsx
│   └── StatsMode.tsx
├── components/
│   ├── PersonSearch.tsx       # 支持 id / name / 中文名
│   ├── PersonSearchResults.tsx
│   ├── NemesisTable.tsx       # 通用 person 列表表格（复用所有 mode）
│   ├── ViewSwitch.tsx         # 6 个 radio + scope + show
│   ├── ExportCsvButton.tsx
│   └── H2HTable.tsx
├── data/
│   ├── nemesizerData.ts       # fetch + 解析 + IndexedDB 缓存
│   ├── nemesizerIndex.ts      # 运行时索引
│   ├── nemesisAlgo.ts         # 4.2 / 4.3 算法
│   └── whatIfAlgo.ts          # 4.5
└── types.ts
```

## 6. UI 风格

- **Top app bar**: 继续用本站的 `AppHeader`，不照搬 nemesizer.com 的紫色 bar（全站一致性优先）
- **Nemesizer logo 区**: 页内再放一个居中的 "Nemesizer" 标题 + 小 logo（复刻原站），保留识别度
- **粉色圆按钮**: 复刻，用作搜索 / 确认 / link 图标
- **表格**: 沿用现有 `wca-stats-table` 样式（白底、细 border、hover 高亮），不引入新的 CSS 框架
- **H2H 表格**: 较优格绿底、较差格红底，完全照搬原站色彩语义
- **drawer / 侧边栏**: nemesizer.com 左上角有 hamburger — **不做**。四个 mode 用 query 切换，页面顶部放 4 个 tab 按钮即可

## 7. i18n

- 全部 inline `isZh ? '中文' : 'English'` 模式
- 事件名：meta.json 里带 `name` / `nameZh`，直接用
- 选手名：`displayCuberName(rawName, isZh)`
- 国家名：复用本站已有 `country_flags.ts` 的映射
- 国旗：`<Flag iso2={...}>`

## 8. 测试

- `nemesisAlgo.test.ts` — 单测 nemesis / nearly / onlyJust，人工构造 5-10 人小数据集
- `nemesizerData.test.ts` — 二进制 encode/decode roundtrip
- H2H / What-if 各 1 个端到端场景

## 9. 实现分阶段

| 阶段 | 产出 |
|---|---|
| **阶段 1** — 数据管道 | stats-build 新命令、二进制格式、部署白名单、`meta.json` |
| **阶段 2** — 运行时数据层 | client fetch/解析/索引、IndexedDB 缓存、搜索、单测 |
| **阶段 3** — Standard mode | 搜索页 + 六种视图 + scope + people/countries + CSV 导出 |
| **阶段 4** — H2H / What-if / Stats | 其余三个 mode |

每阶段一个独立的 implementation plan + PR。

## 10. 开放问题（spec 阶段不解决，implementation 阶段再决定）

- `stats-build` 现在的 schedule（周更 CI）是否把 nemesizer 也包进去？建议是。
- "only just" 的严格定义 nemesizer.com 无文档，我按 "差 1 名" 实现，和原站对比后再校准
- Export CSV 的列结构严格对齐 nemesizer.com

## 11. 非目标

- 不做 drawer、不做"About Nemesizer"页（原站的展示页）
- 不做实时数据（用周更 WCA export 就够了）
- 不做账号 / 收藏 / 分享等 nemesizer.com 也没有的功能
