# ZBLS Trainer 移植任务提示词

## 目标

将 `D:\cube\trainer\zbls-trainer` 中的 ZBLS Trainer（纯 HTML/CSS/JS）完整复刻到 CubeRoot Trainer monorepo（`d:\cube\ruiminyan.github.io\trainer`），使用 React 19 + TypeScript + Zustand 技术栈。

**要求：尽可能完全复刻，功能和布局对齐上游。**

---

## 上下文文件（必须先读）

在开始工作前，**必须先阅读以下文件**以了解项目架构和已有代码模式：

1. **`d:\cube\ruiminyan.github.io\trainer\README.md`** — monorepo 结构、技术栈、开发命令
2. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\App.tsx`** — 路由配置
3. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\pages\HomePage.tsx`** — 首页卡片列表
4. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\i18n\en.json`** — 现有翻译 keys
5. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\i18n\zh.json`** — 现有翻译 keys

### ZBLL Trainer 作为参考模板（已完成的成功移植）

ZBLL Trainer 是同类移植的完整先例，结构和模式应直接复用：

6. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\pages\ZbllSelectPage.tsx`** — 选择页模板
7. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\pages\ZbllTimerPage.tsx`** — 计时页模板
8. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\stores\zbllSessionStore.ts`** — 计时器状态机模板
9. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\stores\zbllSelectedStore.ts`** — 选中状态管理模板
10. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\stores\zbllPresetStore.ts`** — 预设系统模板
11. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\stores\zbllSettingsStore.ts`** — 设置 store 模板
12. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\stores\zbllNotesStore.ts`** — 笔记 store 模板
13. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\utils\zbllHelpers.ts`** — 工具函数模板
14. **`d:\cube\ruiminyan.github.io\trainer\packages\client\src\zbll.css`** — CSS 模板

---

## 上游 ZBLS Trainer 源码分析

### 项目位置

`D:\cube\trainer\zbls-trainer`

### 技术栈

**纯 HTML/CSS/JS**（无框架），使用 `sessionStorage` 在页面之间传递数据，`localStorage` 持久化选中状态和预设。

### 文件结构

```
zbls-trainer/
├── index.html                           # 选择页（111KB！全部 HTML 内联）
├── trainer.html                         # 训练页（1.7KB）
├── Scripts/
│   ├── home-screen.js                   # 选择页逻辑（502 行）
│   └── trainer-screen.js                # 训练页逻辑（403 行）
├── Classes and Data Files/
│   ├── zblsCase.js                      # 数据类（172 行）
│   ├── algorithms.js                    # 算法数据（24KB）
│   └── scrambles.js                     # 打乱数据（42KB）
├── Styles/
│   ├── home-style.css                   # 选择页样式（6KB）
│   └── trainer-style.css                # 训练页样式（2.8KB）
└── Images/
    └── F2L *.png                        # 303 个 PNG 图片（~18KB 每个）
```

### 核心数据结构

- **F2L Groups**: 41 个 F2L case（编号 1-41），每个 F2L case 有 2-8 个 ZBLS 变体
- **ZBLS Case**: 共 302 个 case，每个包含：
  - `name`: 如 `"ZBLS 1-1"`
  - `img`: 图片路径 `"Images/F2L 1-1.png"`
  - `setups`: 打乱数组（随机选一个 + 随机 AUF）
  - `algs`: 解法算法数组
  - `selected`: 是否被选中

### 功能清单（必须完整复刻）

| 功能 | 上游实现 | 移植策略 |
|------|---------|---------|
| F2L 分组折叠 | CSS `maxHeight` + `collapsible` class | React `useState` 控制展开/折叠 |
| 按 F2L 组全选/取消 | `toggleGroup` checkbox | Zustand store 方法 |
| 全选/取消全部 | `toggleAll(true/false)` | store `selectAll()`/`deselectAll()` |
| 展开/收起全部 | `toggleExpand(true/false)` | React state |
| 选中数量显示 | `showChecked()` + 颜色变化 | computed from store |
| F2L 组颜色 | 全选=#40B5AD, 部分=#F4C430, 无=#C0C0C0 | CSS class 切换 |
| 预设系统 | dropdown select + localStorage | Zustand persist store |
| 计时器 | `setInterval(10ms)` + 3 状态（Stop/Start/Paused） | 参考 ZBLL 的 5 状态计时器 |
| Space 启停 | keydown 变绿, keyup 开始; 再次 keydown 暂停+变红, keyup 停止 | 参考 ZBLL 的 keyboard handler |
| 触摸事件 | `touchstart`/`touchend` | 参考 ZBLL |
| Recap 模式 | 每个 case 出一次，完成后 alert 重置 | 参考 ZBLL 的 recap |
| Again 按钮 | recap 模式下可重做上一个 case | 新增功能 |
| Backspace 快捷键 | recap 模式下等于 Again | 新增 |
| 结果显示 | Result #N, 时间, case 名, 图片, 算法列表 | 参考 ZBLL ResultCard |
| 页面间数据 | sessionStorage 传递 | 不需要，React Router 共享 store |
| checkbox 持久化 | localStorage by id | Zustand persist |

### index.html 注意事项

> ⚠️ `index.html` 有 111KB，因为所有 302 个 case 的 HTML 都是内联写死的。
> 你**不应该**逐行读这个文件，只需从 `algorithms.js` 和 `scrambles.js` 提取数据即可。

从 `algorithms.js` 和 `scrambles.js` 中读取数据结构。它们是扁平数组格式：
```
[count, alg1, alg2, ..., count, alg1, ...]
```
每个 case 前面有一个数字表示该 case 有几个算法/打乱。

### 关键差异（ZBLS vs ZBLL）

| 方面 | ZBLL | ZBLS |
|------|------|------|
| 分组层级 | 3 级（OLL→COLL→ZBLL） | 2 级（F2L Group→ZBLS Case） |
| 图片格式 | SVG（top+3D 两种视角） | PNG（单一视角，303 个文件） |
| case 总数 | 493 | 302 |
| 数据格式 | 单个 JSON | 3 个 JS 文件（algorithms.js + scrambles.js + index.html） |
| 打乱生成 | 从 scrambles 数组随机选 | 从 setups 数组随机选 + 随机 AUF（U/U'/U2/无） |
| 设置面板 | 字号/字体/精度/延迟/视角等 | 无（可选移植） |
| 统计 | 成绩列表 + 清除 | 仅当前结果显示 |
| Again 功能 | 无 | recap 模式下有 Again 按钮 + Backspace 快捷键 |

---

## 实施步骤

### 1. 数据准备

- 从 `algorithms.js` 和 `scrambles.js` 提取数据，合并为 `zbls.json`
- 每个 case 结构：`{ name, f2lGroup, variant, algs, scrambles }`
- 将 `zbls.json` 放到 `packages/shared/data/`
- 将 303 个 PNG 复制到 `packages/client/public/zbls_img/`

### 2. Stores（参考 ZBLL 同名 stores）

- `zbls_selected_store.ts` — F2L 组级 + case 级选中
- `zbls_session_store.ts` — 计时器状态机 + recap + again
- `zbls_preset_store.ts` — 预设持久化
- `zbls_settings_store.ts`（可选，ZBLS 上游没有设置面板）

### 3. 页面

- `ZblsSelectPage.tsx` — F2L 分组网格 + 折叠 + 颜色
- `ZblsTimerPage.tsx` — 计时器 + 结果 + recap

### 4. 路由

在 `App.tsx` 添加：
- `/select/zbls` → `ZblsSelectPage`
- `/train/zbls` → `ZblsTimerPage`

### 5. 首页

在 `HomePage.tsx` 的 `algSets` 数组添加 ZBLS 入口（302 cases）。

### 6. CSS

创建 `zbls.css`，复用 ZBLL 的暗色主题模式。

### 7. i18n

在 `en.json` 和 `zh.json` 中添加 `zbls` 命名空间。

### 8. README

更新 `trainer/README.md` 添加 ZBLS 文件条目。

---

## 约束

1. **TypeScript**：所有代码使用 TS，不使用 `enum`（用 `const as const` 替代）
2. **Zustand**：状态管理用 Zustand + persist middleware
3. **CSS**：使用 `zbls.css` 独立文件，复用 ZBLL 的 CSS 变量
4. **i18n**：所有文本用 `useTranslation` 的 `t()` 调用
5. **命名**：变量 camelCase，组件 PascalCase，常量 UPPER_SNAKE_CASE
6. **注释**：中文，解释"为什么"不是"是什么"
7. **增量开发**：每完成一个小模块就编译验证
8. **不要开浏览器**：用户自行验证，你只写代码
9. **git 提交**：每个逻辑阶段 commit，英文 message

---

## 验证

1. `pnpm --filter @cuberoot/client build` 编译通过
2. 用户自行在 `http://localhost:5173/app/select/zbls` 和 `/train/zbls` 验证
3. 提交后 push，CI 自动部署
