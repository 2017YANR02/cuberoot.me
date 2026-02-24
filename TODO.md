# Stats 前端架构 TODO

## 已完成 ✅

- [x] JS 提取：内联 `<script>` → `assets/js/stats_ui.js`（6 个函数）
- [x] Bug 修复：switchTab/switchSource/restoreFromHash 作用域联动
- [x] wr_newcomer marshal 缓存（359s → 47s，7.6× 加速）
- [x] Source hash 追踪（`#source=1st-comp`）
- [x] `DEPLOYMENT.md` 项目结构更新

---

## 任务：JS 驱动 UI 重构

### 目标

改完 JS/CSS 后**不再需要重新跑 `compute_all.rb`**。
Ruby 只输出数据面板（`<div>` + `<table>`），JS 自动生成按钮和样式。

### 5 种页面布局模式

| 模式 | 页面 | 当前 Ruby 生成的 UI |
|------|------|---------------------|
| **A: 简单双 tab** | `round_metric`(×13)、`ao_rounds`(×4)、`consecutive_sub_5_average` | `tab_styles` + `tab_buttons` |
| **B: metric 分段 + tab** | `wr_dominance`、`wr_aoxr` | `segmented_selector_*` + `metric_tab_wrap_*` + `tab_*` |
| **C: metric 下拉 + 全局 tab** | `wr_metric` | `metric_dropdown_*` + `global_tab_buttons` + `tab_styles` |
| **D: 三级嵌套** | `wr_newcomer` | `segmented_selector_*(metric+source)` + `metric_tab_wrap_*` + `tab_*` |
| **E: metric 分段 (无 tab)** | `average_of` | `segmented_selector_*` only |

### Ruby 方法处置清单

**可删除（9 个纯 UI 方法，将由 JS/CSS 替代）：**

| 方法 | 文件 | 功能 |
|------|------|------|
| `segmented_btn_styles` | `core/segmented_btn.rb` | 药丸按钮 CSS |
| `segmented_selector_styles(prefix)` | `core/metric_selector.rb` | `.{prefix}-selector` CSS |
| `segmented_selector_buttons(items, ...)` | `core/metric_selector.rb` | 按钮 HTML + onclick |
| `metric_tab_wrap_start` | `core/metric_selector.rb` | flex 容器 `<div>` + CSS |
| `metric_tab_wrap_end` | `core/metric_selector.rb` | 闭合 `</div>` |
| `metric_dropdown_styles` | `core/metric_selector.rb` | 下拉菜单 CSS（60 行） |
| `metric_dropdown_html(groups, meta)` | `core/metric_selector.rb` | 下拉菜单 HTML |
| `tab_styles` | `core/tab_ui.rb` | `.stat-panel` CSS |
| `tab_buttons(en1, zh1, id1, ...)` | `core/tab_ui.rb` | Tab 按钮 HTML |
| `global_tab_buttons(en1, zh1, ...)` | `core/tab_ui.rb` | 全局 Tab 按钮 HTML |

**保留（6 个数据方法，必须由 Ruby 生成）：**

| 方法 | 文件 | 功能 |
|------|------|------|
| `grouped_panel(id, active, data, header)` | `core/tab_ui.rb` | `<div class="stat-panel"><table>...</table></div>` |
| `html_table_header(header_hash)` | `core/tab_ui.rb` | `<tr><th>...</th></tr>` |
| `html_table_row(row, header_hash)` | `core/tab_ui.rb` | `<tr><td>...</td></tr>` |
| `tabbed_grouped_markdown(...)` | `core/tab_ui.rb` | 组合调用上面 3 个 |
| `md_link_to_html(text)` | `core/tab_ui.rb` | markdown link → `<a>` |
| `ranking_to_arrays(rows, keys:)` | `core/tab_ui.rb` | 数据格式转换 |

### Data 属性约定（Ruby 输出的 HTML 需遵守）

**metric-panel**（多 metric 时 JS 自动生成选择器）：
```html
<div class="metric-panel active" id="metric-single"
     data-label-en="Single" data-label-zh="单次">
```

**source-panel**（仅 wr_newcomer，多 source 时 JS 自动生成选择器）：
```html
<div class="source-panel active" id="source-single-1st-solve"
     data-label-en="First Solve" data-label-zh="首次还原">
```

**stat-panel**（多 tab 时 JS 自动生成 tab 按钮）：
```html
<div class="stat-panel active" id="ranking"
     data-label-en="Current Ranking" data-label-zh="排名">
```

**下拉菜单模式**（wr_metric 专用，在容器上标记）：
```html
<div class="stats-container" data-ui="dropdown">
  <div class="metric-panel active" id="metric-bpa"
       data-label-en="BPA" data-group="Average" data-group-zh="平均">
```

### JS 自动生成逻辑（`stats_ui.js` 中新增 `initStatsUI()`）

```
DOMContentLoaded → initStatsUI()
  │
  ├── 找到所有 .metric-panel
  │   ├── ≥ 2 个 → 判断 data-ui="dropdown" ?
  │   │   ├── 是 → createMetricDropdown()（生成分组下拉菜单）
  │   │   └── 否 → createMetricButtons()（生成药丸按钮，onclick=switchMetric）
  │   └── 1 个 → 不生成选择器
  │
  ├── 每个 metric-panel 内部：
  │   ├── 找到所有 .source-panel
  │   │   └── ≥ 2 个 → createSourceButtons()（生成 source 药丸，onclick=switchSource）
  │   │
  │   └── 每个 scope（source-panel 或 metric-panel）内：
  │       └── 找到所有 .stat-panel
  │           └── ≥ 2 个 → createTabButtons()（生成 tab 药丸，onclick=switchTab）
  │
  └── 完成后调用 restoreFromHash()（在 event_selector.js 中）
```

> 注意：`initStatsUI()` 必须在 `restoreFromHash()` 之前执行，因为 hash 恢复需要 click 按钮。

### 实施 Phase

#### Phase 1：前端（纯加法，不动 Ruby，不破坏现有功能）

- [ ] 创建 `assets/css/stats_ui.css`
  - 将 `segmented_btn_styles` CSS 移入
  - 将 `segmented_selector_styles` CSS 移入（参数化 prefix → 用 metric/source 两份）
  - 将 `tab_styles` CSS 移入
  - 将 `metric_tab_wrap_start` 中的 CSS 移入
  - 将 `metric_dropdown_styles` CSS 移入（约 60 行）
  - 将 wr_newcomer 的 `.source-panel` CSS 移入
- [ ] 在 `_layouts/default.html` 中 `<head>` 添加 `<link rel="stylesheet" href="/assets/css/stats_ui.css">`
- [ ] 扩展 `assets/js/stats_ui.js`
  - 新增 `initStatsUI()`
  - 新增 `createMetricButtons(container, panels)`
  - 新增 `createSourceButtons(metricPanel, panels)`
  - 新增 `createTabButtons(scope, panels)`
  - 新增 `createMetricDropdown(container, panels)`
  - DOMContentLoaded 事件中调用 `initStatsUI()`
- [ ] 在 `stats/test_ui.md` 中写测试用例
  - 手写带 `data-label-*` 的面板 div（不含任何按钮）
  - 验证 JS 自动生成按钮且交互正常

#### Phase 2：修改 Ruby 输出（需 `STATS_USE_CACHE=1` 重新生成一次）

**保留的方法需修改**：
- [ ] `grouped_panel`：给 `<div class="stat-panel">` 添加 `data-label-en` / `data-label-zh`

**按模式删除 UI 调用**：

| 文件 | 模式 | 删除的调用 | 添加的 data 属性 |
|------|------|-----------|-----------------|
| `tabbed_grouped_markdown`（tab_ui.rb） | A | `tab_styles` + `tab_buttons` | stat-panel 加 `data-label-*` |
| `wr_dominance.rb` | B | `segmented_selector_*` + `metric_tab_wrap_*` + `tab_*` | metric-panel 加 `data-label-*` |
| `wr_aoxr.rb` | B | 同上 | 同上 |
| `wr_metric.rb` | C | `metric_dropdown_*` + `global_tab_buttons` + `tab_styles` | metric-panel 加 `data-label-*` + `data-group` + `data-group-zh`，外层加 `data-ui="dropdown"` |
| `wr_newcomer.rb` | D | `segmented_selector_*` + `metric_tab_wrap_*` + `tab_*` | metric-panel 和 source-panel 加 `data-label-*` |
| `average_of.rb` | E | `segmented_selector_*` | metric-panel 加 `data-label-*` |

**重新生成所有页面**（最后一次需要跑 compute）：
```powershell
$env:STATS_USE_CACHE = "1"
cd _stats_build
ruby bin/compute_all.rb
```

#### Phase 3：清理

- [ ] 删除 `core/segmented_btn.rb`（整个文件）
- [ ] 删除 `core/metric_selector.rb` 中的 9 个 UI 方法
- [ ] 删除 `core/tab_ui.rb` 中的 `tab_styles` / `tab_buttons` / `global_tab_buttons`
- [ ] 所有 Ruby 文件 `ruby -c` 语法检查
- [ ] 更新 `DEPLOYMENT.md` 架构描述
- [ ] Git commit

### 风险评估

- **Phase 1 零风险**：纯加法，CSS 外置后与内联 CSS 共存（重复但不冲突）
- **Phase 2 中风险**：修改 Ruby 输出后必须验证所有 5 种布局模式
- **Phase 3 低风险**：纯删除，Phase 2 验证通过后执行

### 工作量预估

| Phase | 文件数 | 复杂度 | 耗时 |
|-------|--------|--------|------|
| Phase 1（前端） | 3 个新/改 | 中 | ~1 小时 |
| Phase 2（Ruby + 全量重生成） | ~10 个 Ruby | 高 | ~2 小时 |
| Phase 3（清理） | ~5 个 Ruby | 低 | ~30 分钟 |

---

## 开发环境

```powershell
# Jekyll 本地预览（改 JS/CSS 保存即生效）
cd d:\cube\ruiminyan.github.io
bundle exec jekyll serve
# → http://127.0.0.1:4000

# 重新生成统计页面（用缓存，无需 MySQL）
$env:STATS_USE_CACHE = "1"
cd _stats_build
ruby bin/compute_all.rb

# 只跑单个统计（需 MySQL，wr_newcomer 已有缓存）
$env:STATS_FILTER = "wr_newcomer"
ruby bin/compute_all.rb

# UI 测试页（无需数据库）
# http://127.0.0.1:4000/stats/test_ui
```
