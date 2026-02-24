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
Ruby 只输出数据面板（`<div>` + `<table>` + `data-label-*`），JS 自动生成按钮和样式。

### Phase 1：前端 ✅

- [x] 创建 `assets/css/stats_ui.css`（迁移所有 UI CSS）
- [x] 在 `_layouts/default.html` 中添加 CSS link
- [x] 扩展 `assets/js/stats_ui.js`：新增 `initStatsUI()` 及子函数
- [x] 5 个独立测试页 `stats/test_ui_a~e.md`（无需数据库）

### Phase 2：修改 Ruby 输出 ✅

- [x] `core/segmented_btn.rb`：`segmented_btn_styles` 返回空
- [x] `core/tab_ui.rb`：`tab_styles` / `tab_buttons` / `global_tab_buttons` 返回空；`grouped_panel` 新增 `label_en:` / `label_zh:` 参数
- [x] `core/metric_selector.rb`：`segmented_selector_styles` / `segmented_selector_buttons` / `metric_dropdown_styles` 返回空；`metric_tab_wrap_start` 只输出 `<div>`
- [x] `core/statistic.rb`：`fetch_with_cache` 提升到基类（DRY）
- [x] 6 个消费方迁移 + 浏览器验证（Mode A/B/C/D/E）
- [x] `wr_dominance` / `ao_rounds` 新增缓存支持
- [x] 修复 bug：wr_metric 下拉菜单不应生成 metric 药丸按钮
- [x] 修复 bug：consecutive_sub_5_average 改用 `top()` 修复翻译
- [x] JS 清理：删除 `switchMetric` 向后兼容逻辑

### Phase 3：清理（合并到 Phase 2 完成）✅

> 注：按「返回空」代替「删除」策略，保持向后兼容，无需清理文件。

### 实际 data 属性约定（与最终实现一致）

**metric-panel**（JS 自动生成 metric 按钮，Mode B/D/E）：
```html
<div class="metric-panel active" id="metric-single"
     data-label-en="Single" data-label-zh="单次">
```

**source-panel**（仅 wr_newcomer，JS 自动生成 source 按钮）：
```html
<div class="source-panel active" id="source-single-1st-solve"
     data-label-en="First Solve" data-label-zh="首次还原">
```

**stat-panel**（JS 自动生成 tab 按钮）：
```html
<div class="stat-panel active" id="ranking"
     data-label-en="Current Ranking" data-label-zh="排名">
```

**下拉菜单模式**（wr_metric，JS 检测到 `.metric-dropdown` 跳过 metric 按钮）：
```html
<div class="metric-toolbar" data-tab-mode="global">
  <!-- .metric-dropdown → 不生成 metric 药丸按钮 -->
  <!-- data-tab-mode="global" → tab 用 switchGlobalTab -->
```

---

## 开发环境

```powershell
# Jekyll 本地预览（改 JS/CSS 保存即生效，无需重跑 Ruby）
cd d:\cube\ruiminyan.github.io
bundle exec jekyll serve
# → http://127.0.0.1:4000

# 重新生成统计页面（用缓存，无需 MySQL，约 1 分钟）
$env:STATS_USE_CACHE = "1"
cd _stats_build
ruby bin/compute_all.rb

# 只跑单个统计（用缓存）
$env:STATS_FILTER = "wr_dominance"; $env:STATS_USE_CACHE = "1"
ruby bin/compute_all.rb

# UI 测试页（无需数据库）
# http://127.0.0.1:4000/stats/test_ui
```
