---
name: viz-distribution-evolution
description: 分布演化可视化模块 — 架构、文件结构、动画机制与修改指南
---

# 分布演化可视化模块 (viz/)

## 概述

`/viz/` 页面展示魔方选手的成绩分布随时间的动态演化。支持多选手对比、多种数据模式（Singles / Mo3 / Ao5 / Ao12 / Ao25 / Ao50 / Ao100）以及两种同步模式（按把数 / 按日期）。

## 文件结构

| 文件 | 职责 |
|------|------|
| `viz/index.html` | 页面骨架：搜索栏、Canvas、统计面板、播放控制 |
| `viz/viz.js` | 核心引擎：数据加载、KDE 计算、动画循环、帧绘制 |
| `viz/style.css` | 全部样式（深色主题、玻璃态、动画） |
| `viz/ridgeline.js` | 脊线图（分布全景）独立模块 |
| `viz/csv_export.js` | CSV 导出模块 |
| `viz/rolling_stats.js` | 滚动统计计算（Mo3/Ao5 等） |

## 核心架构

### 数据流

```
WCA API → addPlayer() → solveData + competitions + compDates
    → buildChannelDataForPlayer() → channelData (按 dataMode 切换)
    → recalcModeParams() → maxFrame, windowSize, xMin/xMax, ghostKDE
    → drawFrame() → computeKDE → Canvas 渲染
```

### 关键全局变量

| 变量 | 说明 |
|------|------|
| `players[]` | 选手数组，每项含 wcaId, channelData, compDates 等 |
| `driverIdx` | 帧驱动选手（channelData 最长者，自动选择） |
| `syncMode` | `'solve'`（按把数比例）或 `'date'`（按日期映射） |
| `dataMode` | `'singles'` / `'mo3'` / `'ao5'` / ... / `'ao100'` |
| `currentFrame` | 当前帧位置（0 ~ maxFrame） |
| `maxFrame` | 最大帧 = driverIdx 的 channelData.length - windowSize |
| `windowSize` | 窗口大小：singles=100, 其他=400 |
| `activePlayerIdx` | 主选手索引（统计面板跟随） |

### 动画机制（多选手同步）

两种同步模式（通过 `computePlayerFrame()` 统一）：

1. **按把数（solve）模式**：`pFrame = round(progress × pMax)`
   - 每个选手等比推进，全部丝滑
   - 统计面板显示把数范围

2. **按日期（date）模式**：
   - 用**所有选手的全局最早/最晚日期**作为时间轴（非仅 driver）
   - `progress → globalDateRange → (pDateNum - pFirst)/(pLast - pFirst) → pFrame`
   - 统计面板显示日期

### 图表标注线（非 singles 模式）

每个选手绘制 2 条竖线 + 标签（标签始终在标记右侧）：

| 标记 | 含义 | 颜色 |
|------|------|------|
| ◆ 菱形 + 值 | 窗口末尾的当前 Average 值 | 亮色 (0.95 alpha) |
| ● 圆形 + 值 | 窗口内所有 Average 的均值 | 半透明 (0.7 alpha) |
| ━ 虚线残影 | 初始分布（ghostKDE，固定参照） | 淡色 (0.12 alpha) |

### 进退变色（单选手自动生效）

`getShiftedHSL()` 比较 `currentMean` 与 `ghostMean`：
- 改善（均值下降）→ hue 渐变为绿色 (130)
- 退步（均值上升）→ hue 渐变为红色 (0)
- clamp 在 ±30% 范围内，仅单选手时生效

### 轨迹拖尾

`meanTrail[]` 记录每帧均值位置，绘制渐隐圆点：
- 二次衰减 alpha（新点亮、旧点暗）
- 新点更大（1.5→3px），最大 600 采样点
- 拖拽进度条回退时自动截断

### 双峰检测

`detectPeaks(kde)` 扫描 KDE 局部极大值（过滤 < 15% 最高峰的噪声）。
检测到 ≥2 峰时在两峰间显示大号 ⚡ emoji。药丸开关可控。

### X 轴缩放/平移

| 操作 | 效果 |
|------|------|
| 滚轮 | 以鼠标位置为锚点缩放 |
| 拖拽 | 平移 X 轴 |
| 双击 | 重置到自动范围 |
| 双指 pinch | 触摸缩放（移动端） |

`userXMin/userXMax` 覆盖自动范围，切换模式/加载选手时重置。

## 修改指南

### 添加新的数据模式

1. 在 `buildChannelDataForPlayer()` 中添加 `else if (dataMode === 'newMode')` 分支
2. 在 `setupModeSwitcher()` 中添加对应 tab
3. `recalcModeParams()` 中的 `windowSize` 按需调整

### 添加新选手

选手通过 WCA API 自动加载，搜索框调用 `addPlayer(wcaId, eventId)`。

### 调整动画速度

`playSpeed` 整数值，表示每动画帧推进的 solve 数。HTML 中的 `data-speed` 属性对应。

### 修改标签样式

`drawMeanLabelsOnCanvas()` 函数统一绘制圆形 + 菱形标签。修改此函数即可。

## CSV 导出

列序：序号 → 日期 → 比赛 → 轮次 → 把数 → 单次(秒) → 是否PB → 各 average 列

多选手时弹出选择菜单（`showCsvPlayerMenu()`），让用户选择下载谁。

## UI 交互

| 操作 | 效果 |
|------|------|
| Space | 播放/暂停 |
| ← → | 步进（±playSpeed 帧） |
| Shift + ← → | 快速步进（±20 帧） |
| 滚轮 / 拖拽 / 双击 | X 轴缩放/平移/重置 |
| 点击选手 chip | 切换主选手 |
| ✕ 按钮 | 移除选手 |
| ⓘ 按钮 | 图例 + 药丸开关弹窗 |
| 把数/日期 按钮 | 切换同步模式（≥2 选手时显示） |
