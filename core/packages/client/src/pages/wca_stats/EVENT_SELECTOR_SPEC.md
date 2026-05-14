# WCA 项目选择器 — React 移植规格书

> **目标**：在 React `WcaStatsPage.tsx` 中实现与 Legacy Jekyll 版完全一致的 WCA 项目图标选择器。
> 本文档包含所有实现所需的信息，下个 AI 可直接上手。

## 零、项目背景

### 仓库概况

仓库 `cuberoot.me` 是一个魔方工具站（CubeRoot），部署在 GitHub Pages 上。核心结构：

```
cuberoot.me/
├── _site/                  # Jekyll 构建输出（GitHub Pages 部署）
├── _stats_build/           # [LEGACY] Ruby 版 WCA 统计构建脚本（已迁移，仅保留参考）
├── i18n/                   # [LEGACY] 原版 JS 国际化 + 项目选择器
│   └── event_selector.js   # ★ 原版项目选择器（约 600 行原生 JS）
├── assets/
│   ├── js/stats_ui.js      # ★ 原版 stats 页面 UI（tab/metric/source 切换）
│   └── css/stats_ui.css    # ★ 原版 stats 页面样式
├── stats/             # 统计 JSON 数据（由 stats-build 生成）
│   ├── wr_current.json     # rows 模式示例
│   ├── most_completed_solves.json  # sections 模式示例
│   ├── wr_dominance.json   # panels 模式示例
│   └── wr_metric.json      # metricPanels 模式示例
└── core/                # React monorepo（pnpm workspace）
    └── packages/
        ├── client/         # React 19 前端（Vite + TypeScript）
        │   └── src/pages/wca_stats/
        │       ├── WcaStatsPage.tsx   # ★ 需要修改的 React 页面
        │       ├── WcaStatsIndex.tsx   # 统计列表首页
        │       └── wca_stats.css       # ★ 需要修改的样式
        ├── stats-build/    # TS 版统计构建工具（替代 _stats_build/）
        │   └── src/
        │       ├── core/events.ts      # 项目映射 + 中英文翻译
        │       ├── core/statistic.ts   # Base class
        │       ├── statistics/         # 88 个统计实现
        │       └── bin/compute_all.ts  # 批量生成 JSON
        └── stats-ui/       # Legacy JS 的 TS 化版本（仅供 Legacy 页面使用）
```

### 技术栈

- **前端**：React 19 + TypeScript + Vite，使用 react-router-dom 客户端路由
- **样式**：Vanilla CSS（深色主题），**不使用 Tailwind**
- **构建**：pnpm monorepo，`@cuberoot/client` 是前端包
- **部署**：GitHub Pages，`/app/` 路径下是 React SPA

### WCA Stats 数据流

```
MySQL (wca_statistics DB)
  ↓ SQL 查询
stats-build/src/statistics/*.ts (88 个统计实现)
  ↓ compute_all.ts 批量执行
stats/*.json (4 种输出模式)
  ↓ fetch('/stats/xxx.json')
WcaStatsPage.tsx (React 通用渲染器)
```

### 4 种 JSON 输出模式

| 模式 | JSON 字段 | 用途 | 示例统计 |
|------|-----------|------|----------|
| `rows` | `data.rows[][]` | 单张扁平表格 | wr_current（当前世界纪录） |
| `sections` | `data.sections[]` | 按项目分节（每节一表） | most_completed_solves（最多完成次数） |
| `panels` | `data.panels[]` | Ranking + History 双视图 | wr_dominance |
| `metricPanels` | `data.metricPanels[]` | 指标选择 + Ranking/History | wr_metric（WR 指标总览） |

### 当前状态

88 个统计的 Ruby→TS 迁移已 100% 完成。React 前端 `WcaStatsPage.tsx` 能正确渲染 4 种模式的 JSON 数据。**但缺少 Legacy 版的项目选择器 UI**——这是本规格书要解决的问题。

### Legacy 版 vs React 版的差异

| 功能 | Legacy Jekyll | React 当前状态 |
|------|---------------|----------------|
| 项目图标选择器 | ✅ `event_selector.js` 自动注入 | ❌ **缺失** — 本文档的目标 |
| Sections 折叠 | ❌ 无折叠 | ✅ 有折叠（可保留也可去掉） |
| Tab 切换 | ✅ `stats_ui.js` | ✅ `PanelsView` |
| Metric 切换 | ✅ `stats_ui.js` | ✅ `MetricPanelsView` |
| 搜索框 | ❌ 无（Legacy 无搜索） | ✅ 有搜索 |
| URL hash 持久化 | ✅ `#event=444&metric=bao5` | ❌ 无（可选实现） |

## 一、功能描述

在 `sections`（GroupedStatistic）、`panels`（RoundMetric/AoRounds/AverageOfX）、`metricPanels`（聚合页面）三种渲染模式下，页面顶部显示一行 **21 个 WCA 项目图标按钮**：

- 点击图标 → 只显示该项目的数据（其他项目的 section 隐藏）
- 当前统计 **没有数据的项目** → 按钮灰色（disabled），不可点击
- 默认选中第一个有数据的项目
- `rows` 模式**不需要**项目选择器（数据已在一张表中）

### 视觉参考

```
┌─────────────────────────────────────────────────────┐
│ [333] [222] [444] [555] [666] [777] [333bf] ...     │  ← 图标按钮行
│  ✅    ✅    ✅    ✅   (灰)  (灰)   ✅   ...     │
└─────────────────────────────────────────────────────┘
  ↓ 点击 [222]
┌─────────────────────────────────────────────────────┐
│ Single ▼                                            │  ← metricPanels 的指标选择器
│ [Ranking] [History]                                 │  ← panels 的 tab 切换
│ ┌─────────────────────────────────────────────────┐ │
│ │ 只显示 2x2x2 Cube 的数据表格                     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 二、现有代码清单

### 要修改的文件

| 文件 | 说明 |
|------|------|
| `core/packages/client/src/pages/wca_stats/WcaStatsPage.tsx` | 添加 EventSelector 组件 |
| `core/packages/client/src/pages/wca_stats/wca_stats.css` | 添加选择器样式 |

### 原版 Legacy 参考文件（原始行为的唯一权威来源）

| 文件 | 说明 |
|------|------|
| `i18n/event_selector.js` | **原版**项目选择器（原生 JS，约 600 行）— 所有行为以此为准 |
| `assets/js/stats_ui.js` | **原版** stats 页面 UI（tab 切换、metric 切换、source 切换的 DOM 操作） |
| `assets/css/stats_ui.css` | **原版** stats 页面样式（深色主题表格、tab、metric 按钮样式） |

### 已有 React 实现参考（可借鉴结构，但不是"原版"）

| 文件 | 说明 |
|------|------|
| `core/packages/client/src/pages/calc/components/EventSelector.tsx` | CalcPage 的项目选择器（与 calc_store 耦合，**不能直接 import**，但 JSX 结构可参考） |
| `core/packages/client/src/pages/calc/calc.css` L115-165 | `.event-btn` + `.cubing-icon` 样式（浅色主题，注意 stats 页面是深色！） |

### 外部依赖（已在 index.html 中加载，无需额外引入）

```html
<!-- cubing-icons 字体图标 CDN — 提供 .cubing-icon.event-333 等 class -->
<link rel="stylesheet" href="https://cdn.cubing.net/v0/css/@cubing/icons/css" />
```

## 三、核心数据结构

### 英文项目名 → Event ID 映射

JSON 中 sections 的 `title` 字段用**英文项目名**，需要映射到 WCA event ID：

```typescript
const EVENT_NAME_TO_ID: Record<string, string> = {
  "Rubik's Cube": "333",
  "2x2x2 Cube": "222",
  "4x4x4 Cube": "444",
  "5x5x5 Cube": "555",
  "6x6x6 Cube": "666",
  "7x7x7 Cube": "777",
  "3x3x3 Blindfolded": "333bf",
  "3x3x3 Fewest Moves": "333fm",
  "3x3x3 One-Handed": "333oh",
  "Megaminx": "minx",
  "Pyraminx": "pyram",
  "Rubik's Clock": "clock",
  "Skewb": "skewb",
  "Square-1": "sq1",
  "4x4x4 Blindfolded": "444bf",
  "5x5x5 Blindfolded": "555bf",
  "3x3x3 Multi-Blind": "333mbf",
  "3x3x3 With Feet": "333ft",
  "Rubik's Magic": "magic",
  "Master Magic": "mmagic",
  "Rubik's Cube: Multiple blind old style": "333mbo",
};
```

### 全部 21 个项目 ID（始终按此固定顺序显示）

```typescript
const ALL_EVENT_IDS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'minx', 'pyram', 'clock',
  'skewb', 'sq1', '444bf', '555bf', '333mbf',
  '333ft', 'magic', 'mmagic', '333mbo'
];
```

### 中文 tooltip 映射

```typescript
const EVENT_ZH: Record<string, string> = {
  "333": "三阶魔方", "222": "二阶魔方", "444": "四阶魔方",
  "555": "五阶魔方", "666": "六阶魔方", "777": "七阶魔方",
  "333bf": "三阶盲拧", "333fm": "三阶最少步", "333oh": "三阶单手",
  "minx": "五魔方", "pyram": "金字塔", "clock": "魔表",
  "skewb": "斜转魔方", "sq1": "SQ1", "444bf": "四阶盲拧",
  "555bf": "五阶盲拧", "333mbf": "三阶多盲", "333ft": "三阶脚拧",
  "magic": "八板", "mmagic": "十二板", "333mbo": "旧多盲"
};
```

## 四、三种渲染模式的集成方式

### 模式 1：`sections`（GroupedStatistic）

JSON 结构：`data.sections: StatSection[]`，每个 section 的 `title` 是英文项目名。

**行为**：
1. 从 `sections` 中提取所有项目名 → 映射为 event ID → 得到"有数据的项目集合"
2. 显示 21 个图标，无数据的灰掉
3. 选中某项目 → 只渲染该项目的 section（其余不渲染或隐藏）
4. 默认选中第一个有数据的项目

**实现要点**：在 `SectionsView` 组件上方添加 EventSelector，用 `selectedEvent` state 过滤 sections。

### 模式 2：`panels`（RoundMetric/AoRounds/AverageOfX）

JSON 结构：`data.panels: StatPanel[]`，每个 panel 有 `sections`，section 的 `title` 是英文项目名。

**行为**：
1. 合并所有 panels 的 sections，提取项目 ID 并集
2. 选中某项目 → 每个 panel 内只显示该项目的 section
3. panels 之间的 tab 切换（Ranking/History）不受影响

**实现要点**：在 `PanelsView` 组件上方添加 EventSelector，传入 `selectedEvent` 让内部的 `SectionsView` 过滤。

### 模式 3：`metricPanels`（聚合页面）

JSON 结构：`data.metricPanels: MetricPanel[]`，每个 MetricPanel 内有 `panels`，每个 panel 内有 `sections`。

**行为**：
1. 合并所有 metricPanels → 所有 panels → 所有 sections 的项目 ID
2. 选中某项目后，某些 metric（如 BAo5）对某些项目（如 777）没有数据 → **自动禁用该 metric 按钮**
3. 如果当前选中的 metric 因项目切换变成无数据 → **自动回退到第一个有数据的 metric**

**实现要点**：在 `MetricPanelsView` 组件上方添加 EventSelector。切换项目时需要：
- 重新计算每个 metricPanel 是否有该项目的数据
- 禁用没有数据的 metric 按钮
- 如果当前 metric 被禁用则自动切换

## 五、CSS 样式规格（深色主题）

直接从 `calc.css` / `event_selector.ts` 复制，适配 `.wca-stats-page` 作用域：

```css
/* 选择器容器 */
.wca-stats-event-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 单个按钮 */
.wca-stats-event-selector .event-btn {
  position: relative;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

/* 图标默认色 */
.wca-stats-event-selector .event-btn .cubing-icon {
  font-size: 22px;
  color: #aaa;
  transition: color 0.2s;
}

/* hover */
.wca-stats-event-selector .event-btn:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.12);
}
.wca-stats-event-selector .event-btn:hover .cubing-icon { color: #ddd; }

/* active（绿色高亮） */
.wca-stats-event-selector .event-btn.active {
  background: #2e7d32;
  border-color: #4caf50;
}
.wca-stats-event-selector .event-btn.active .cubing-icon { color: #fff; }

/* disabled（灰色半透明） */
.wca-stats-event-selector .event-btn.disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.wca-stats-event-selector .event-btn.disabled .cubing-icon { color: #666; }

/* CSS tooltip */
.wca-stats-event-selector .event-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #333;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  z-index: 100;
}
.wca-stats-event-selector .event-btn:hover::after { opacity: 1; }
.wca-stats-event-selector .event-btn.disabled::after { display: none; }
```

## 六、实现步骤清单

1. **创建常量文件** `wca_stats/event_constants.ts`：导出 `EVENT_NAME_TO_ID`、`ALL_EVENT_IDS`、`EVENT_ZH`
2. **创建组件** `wca_stats/WcaEventSelector.tsx`：
   - Props: `availableEvents: Set<string>`, `selectedEvent: string`, `onSelect: (id: string) => void`, `isZh: boolean`
   - 渲染 21 个按钮，不在 `availableEvents` 中的标记 `disabled`
   - tooltip 根据 `isZh` 切换中英文
3. **修改 `WcaStatsPage.tsx`**：
   - 添加 `selectedEvent` state
   - 在 `sections`/`panels`/`metricPanels` 模式下计算可用项目集合
   - 在渲染区域上方插入 `<WcaEventSelector />`
   - 传递 `selectedEvent` 到子组件进行过滤
4. **修改 `SectionsView`**：接受 `selectedEvent` prop，只渲染匹配的 section
5. **修改 `PanelsView`**：传递 `selectedEvent` 到内部 `SectionsView`
6. **修改 `MetricPanelsView`**：
   - 接受 `selectedEvent` prop
   - 切换项目时重新计算每个 metricPanel 是否有数据
   - 禁用没有数据的 metric 按钮
   - 如果当前 metric 被禁用则自动回退
7. **添加 CSS** 到 `wca_stats.css`

## 七、关键注意事项

1. **cubing-icons 字体已全局加载**：`<span className="cubing-icon event-333" />` 即可显示图标，无需引入额外 CSS
2. **Tailwind `::before` 冲突**：如果 cubing-icon 图标不显示，需要在 CSS 中添加 `.cubing-icon::before { content: revert; --tw-content: revert; }`（参考 `calc.css` L20）
3. **section title 匹配**：JSON 中 section 的 `title` 字段是英文全名（如 `"Rubik's Cube"`），用 `EVENT_NAME_TO_ID[title]` 映射；`titleZh` 是中文名
4. **metricPanels 的 disabled 联动**：这是最复杂的部分——当用户选择 777 时，BAo5/WAo5 等 Ao5 专属 metric 没有数据（因为 777 是 Mo3），需要灰掉对应的 metric 按钮

## 八、验证方式

```powershell
cd d:\cube\cuberoot.me\core
pnpm --filter @cuberoot/client dev
```

测试页面（需要 JSON 已生成）：
- **sections 模式**：http://localhost:5173/app/wca-stats/most_completed_solves
- **panels 模式**：http://localhost:5173/app/wca-stats/wr_dominance
- **metricPanels 模式**：http://localhost:5173/app/wca-stats/wr_metric
- **rows 模式**（不应显示选择器）：http://localhost:5173/app/wca-stats/wr_current

逐个检查：
1. 图标按钮行是否显示正确（21 个图标，无数据的灰色）
2. 点击图标是否只显示该项目的数据
3. metricPanels 模式下切换项目后，无数据的 metric 按钮是否灰掉
4. 默认是否选中第一个有数据的项目

