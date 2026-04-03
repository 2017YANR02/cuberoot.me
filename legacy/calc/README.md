# HTH Grapher

Head-to-Head Average of 5 Calculator — 魔方比赛两位选手五次平均对比可视化工具。

源自 [carykh/hthgrapher](https://github.com/carykh/hthgrapher)，重构为模块化 ES Module + SVG 架构。

## 使用方式

- **在线**：`www.cuberoot.me/calc/`
- **本地**：`pnpm --filter @cuberoot/client dev` → `localhost:5173/legacy/calc/`

## 功能

- **输入**：点击/Tab 输入成绩，支持 numpad，自动格式化（`536` → `5.36`）
- **秒表**：空格键开始/停止计时，实时柱状图增长
- **图表**：SVG 柱状图 + 扇形统计曲线 + BPA/WPA 范围 + 连接线
- **指标表**：17 项对比指标（Best / Avg / BAo5 / WAo5 / Mo2-5 / Variance 等）
- **URL 同步**：成绩自动编码到 URL 参数，支持分享链接（500ms debounce）
- **Seeds**：支持多组选手对比（`<` / `>` 导航）
- **勾选框**：控制单个选手是否参与计时
- **Clear**：一键清空所有数据

## 文件结构

```
calc/
  index.html        ← HTML 骨架（~90行）
  style.css         ← 全部样式（~330行）
  README.md         ← 本文件
  js/
    calc_engine.js  ← 纯计算引擎 + 时间格式化（无 UI 依赖）
    state.js        ← 集中状态管理 + 观察者模式
    chart.js        ← SVG 图表渲染（柱状图 + 扇形曲线 + 菱形标签）
    input_grid.js   ← 原生 <input> 网格 + 键盘导航 + numpad
    calc_table.js   ← 指标对比表格
    url_sync.js     ← URL 参数同步（向后兼容）
    app.js          ← 入口编排 + 秒表逻辑
```

## 架构

```
URL 参数 → url_sync.load() → state
                                ↓
              app.js onChange 观察者
              ↓        ↓         ↓        ↓
          chart    inputGrid  calcTable  urlSync
          .render  .refresh   .render    .save
```

- **单向数据流**：所有模块通过 `state.js` 的 `onChange()` 订阅变更
- **前后端分离**：`calc_engine.js` 是纯函数，不引用 DOM
- **ES Module**：`<script type="module">` 加载，浏览器原生支持

## 键盘快捷键

| 键 | 功能 |
|----|------|
| 数字 0-9 | 输入成绩 |
| Enter | 保存并跳到同选手下一格 |
| Tab | A↔B 交替跳转 |
| Backspace | 删除；空格跨单元格删 |
| Delete | 跳到下一格清空 |
| Escape | 取消编辑 |
| 空格 | 秒表开始/停止 |

## URL 参数格式

```
?comp=比赛名&n0=选手A&n1=选手B&t0=446,397,526,424,443&t1=423,679,401,443,446
```

- `comp` — 比赛名称
- `n{i}` — 选手名字
- `t{i}` — 5 个成绩（centiseconds，逗号分隔）
- `seed` — 当前 seed 偏移量（可选）
