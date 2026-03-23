# CubeRoot Trainer

公式识别训练器 · React + Vite + TypeScript

## 项目结构

```
trainer/
├── pnpm-workspace.yaml        # pnpm monorepo 工作空间定义
├── package.json               # 根 package.json（dev/build/typecheck 脚本）
├── tsconfig.base.json         # 共享 TypeScript 基础配置
├── .gitignore                 # trainer 专用 gitignore
│
├── packages/
│   ├── client/                # React 19 + Vite 8 前端
│   │   ├── src/
│   │   │   ├── App.tsx                # 路由配置（React Router, basename=/trainer）
│   │   │   ├── main.tsx               # 入口（引入 CSS + i18n + App）
│   │   │   ├── index.css              # 暗色系全局样式
│   │   │   ├── components/
│   │   │   │   └── CubeView.tsx       # cubing.js twisty-player 封装（2D 顶面俯视）
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.tsx       # 首页：公式集卡片列表
│   │   │   │   ├── CaseSelectPage.tsx # Case 选择：分组网格 + 全选/单选
│   │   │   │   ├── TrainingPage.tsx   # 训练页：魔方图 + 计时 + 键盘控制
│   │   │   │   ├── StatsPage.tsx      # 统计页：表格（次数/最近/Ao5/Ao12/最佳）
│   │   │   │   ├── ZbllSelectPage.tsx # ZBLL 选择页：3 级网格（OLL→COLL→ZBLL）+ Modal + 预设
│   │   │   │   ├── ZbllTimerPage.tsx  # ZBLL 计时页：5 状态计时器 + 结果/统计/设置
│   │   │   │   ├── ZblsSelectPage.tsx # ZBLS 选择页：F2L 分组列表 + 折叠 + 预设
│   │   │   │   └── ZblsTimerPage.tsx  # ZBLS 计时页：计时器 + Recap + Again
│   │   │   ├── stores/
│   │   │   │   ├── sessionStore.ts    # 训练状态机（idle→caseShown→timing→stopped→complete）
│   │   │   │   ├── settingsStore.ts   # 用户设置（localStorage 持久化）
│   │   │   │   ├── statsStore.ts      # 训练统计（Ao5/Ao12 计算 + 持久化）
│   │   │   │   ├── zbllSelectedStore.ts  # ZBLL 已选 case 管理（OLL/COLL/ZBLL 三级增删）
│   │   │   │   ├── zbllSessionStore.ts   # ZBLL 计时状态机（5 状态 + recap 模式）
│   │   │   │   ├── zbllPresetStore.ts    # ZBLL 预设 + 收藏（localStorage）
│   │   │   │   ├── zbllSettingsStore.ts  # ZBLL 设置（字号/字体/精度/延迟/视角）
│   │   │   │   ├── zbllNotesStore.ts     # ZBLL per-case 笔记（localStorage）
│   │   │   │   ├── zbls_selected_store.ts  # ZBLS 已选 case 管理（F2L 组级 + case 级）
│   │   │   │   ├── zbls_session_store.ts   # ZBLS 计时状态机（5 状态 + recap + again）
│   │   │   │   └── zbls_preset_store.ts    # ZBLS 预设（localStorage）
│   │   │   ├── hooks/
│   │   │   │   ├── useTimer.ts        # 高精度计时器（performance.now + rAF）
│   │   │   │   └── useKeyboard.ts     # 键盘事件（keydown/keyup 分离）
│   │   │   ├── utils/
│   │   │   │   ├── adaptiveQueue.ts   # 自适应队列（慢的 case 重复更多次）
│   │   │   │   ├── zbllHelpers.ts     # ZBLL 工具函数（打乱生成/时间格式化/SVG 路径/数据操作）
│   │   │   │   └── zbls_helpers.ts    # ZBLS 工具函数（打乱+AUF/PNG 路径/分组数据）
│   │   │   ├── zbll.css               # ZBLL 专用样式（选择页 + 计时页 + 响应式）
│   │   │   ├── zbls.css               # ZBLS 专用样式（F2L 组列表 + 计时页 + 响应式）
│   │   │   └── i18n/
│   │   │       ├── index.ts           # i18n 初始化（URL > localStorage > 浏览器语言）
│   │   │       ├── zh.json            # 中文翻译（含 ZBLL/ZBLS 翻译 keys）
│   │   │       └── en.json            # 英文翻译（含 ZBLL/ZBLS 翻译 keys）
│   │   └── vite.config.ts             # Vite 配置（base=/trainer/, API 代理）
│   │
│   ├── server/                # Fastify + MariaDB 后端
│   │   ├── src/
│   │   │   ├── index.ts               # 服务器入口（CORS + 路由注册）
│   │   │   ├── db/
│   │   │   │   ├── schema.sql         # DDL（train_results, user_settings, wca_users）
│   │   │   │   └── connection.ts      # MariaDB 连接池（环境变量配置）
│   │   │   └── routes/
│   │   │       ├── auth.ts            # WCA OAuth → JWT 签发（login/callback/me）
│   │   │       ├── progress.ts        # 训练进度 CRUD（GET/POST /api/progress/:algSetId）
│   │   │       └── health.ts          # 健康检查（/api/health）
│   │   └── .env.example               # 环境变量模板
│   │
│   └── shared/                # 共享类型与数据
│       ├── src/
│       │   ├── types.ts               # AlgCase, TrainResult, UserProgress, UserSettings
│       │   └── index.ts               # 导出入口
│       └── data/
│           ├── pll.json               # 21 个 PLL case（name/group/algorithms/scramble）
│           ├── zbll.json              # 493 个 ZBLL case（algs/scrambles，1.5MB）
│           └── zbls.json              # 302 个 ZBLS case（f2lGroup/algs/scrambles）
```

## 本地开发

### 首次搭建

```powershell
# 1. 安装 pnpm（如果没有）
irm https://get.pnpm.io/install.ps1 | iex

# 2. 安装依赖
cd D:\cube\ruiminyan.github.io\trainer
pnpm install
pnpm approve-builds esbuild   # 首次需要批准 esbuild 构建脚本
```

### 日常开发

```powershell
# 启动前端 dev server（HMR 自动热更新，改代码后无需重启）
pnpm --filter @cuberoot/client dev
# → http://localhost:5173/app/

# TypeScript 类型检查
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/server typecheck
```

### 后端开发（需要 MariaDB）

```powershell
# 1. 创建数据库（在 MariaDB 中执行 schema.sql）
mysql -u root -p < packages/server/src/db/schema.sql

# 2. 配置环境变量
copy packages\server\.env.example packages\server\.env
# 编辑 .env 填入数据库密码和 WCA OAuth 凭据

# 3. 启动后端
pnpm --filter @cuberoot/server dev
# → http://localhost:3001/api/health
```

## CI 部署

| Workflow | 触发条件 | 执行内容 |
|----------|----------|----------|
| **Deploy Trainer** | push main 且 `trainer/` 有变更 | pnpm install → build client + server → rsync + pm2 restart |
| **Deploy Mirror** | push main（已有） | Jekyll build + rsync（trainer/ 已在 `_config.yml` exclude 中排除）|

### 部署架构

```
push trainer/ 变更
  ↓
GitHub Actions
  ↓
1. pnpm install + build client + build server
2. rsync 前端静态文件 → ECS /trainer/ 子路径
3. rsync 后端代码 → ECS /trainer-api/
4. pm2 restart trainer-api
  ↓
线上可用
  ├── toolkit.cuberoot.me/trainer/     ← 前端
  └── toolkit.cuberoot.me:3001/api/    ← 后端 API
```

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | React | 19 |
| 构建工具 | Vite | 8 |
| 语言 | TypeScript | 5.8 |
| 状态管理 | Zustand | 5.x（persist middleware） |
| 路由 | React Router | 7.x |
| 国际化 | react-i18next | 15.x |
| 魔方渲染 | cubing.js | twisty-player Web Component |
| 后端框架 | Fastify | 5.x |
| 数据库 | MariaDB | 10.5（复用 ECS 现有实例） |
| 认证 | WCA OAuth + JWT | jsonwebtoken |
| 包管理 | pnpm | 10.x |
| CI/CD | GitHub Actions | rsync + pm2 |

## 核心设计

### 训练状态机

```
idle → caseShown → timing → stopped → caseShown → ... → complete
       (空格开始)  (空格停止) (空格下一个)
       (Esc 退出)
```

### 自适应队列算法

基于上一轮表现自动调整重复频率：

| 排名 | 重复次数 |
|------|---------|
| 最慢 15% | 4 次 |
| 次慢 15% | 3 次 |
| 中间 20% | 2 次 |
| 剩余 | 1 次 |
| 未尝试 | 1 次 |

### 数据持久化

| 场景 | 存储 |
|------|------|
| 未登录用户 | localStorage（完整功能） |
| 已登录用户 | localStorage + 后端 MariaDB 同步 |

## ZBLL Trainer

完整复刻自 [bestsiteever.net/zbll](https://bestsiteever.net/zbll/)（Vue 3 → React 19 + TypeScript + Zustand）。

### 功能清单

| 功能 | 说明 |
|------|------|
| 三级选择网格 | OLL → COLL → ZBLL，点击图片全选/取消 |
| 计时器 | 5 状态（idle/awaiting/ready/running/stopping），Space 启停 |
| Recap 模式 | 每个 case 只出一次，直到全部完成 |
| 预设系统 | 用户自定义预设 + ⭐ 收藏预设 |
| 笔记 | 每个 case 可添加文字笔记 |
| 设置面板 | 字号/字体/精度/延迟/视角/打乱附录 |
| 键盘快捷键 | Alt+T/R/S/A/D/Z、Delete、箭头导航 |
| i18n | 中英文切换（`?lang=zh`） |
| 555 SVG 资源 | `client/public/zbll_svg/`（top + 3D 视角）|

### 数据来源

`zbll.json`（1.5MB）包含 493 个 ZBLL case，每个含：
- `name`：case 标识（如 `"H BBFF AsA"`）
- `algs`：算法列表（第一个为推荐算法）
- `scrambles`：打乱列表（随机选取）

## ZBLS Trainer

完整复刻自 [zbls-trainer](https://github.com/MorganYeh/zbls-trainer)（纯 HTML/CSS/JS → React 19 + TypeScript + Zustand）。

### 功能清单

| 功能 | 说明 |
|------|------|
| 两级选择列表 | F2L 组（41 组）→ ZBLS Case（302 个），可折叠 |
| 组级颜色标识 | 全选=绿 / 部分=金 / 无=默认 |
| 计时器 | 5 状态（idle/awaiting/ready/running/stopping），Space 启停 |
| Recap 模式 | 每个 case 只出一次，直到全部完成 |
| Again 功能 | Recap 模式下可重做上一个 case（按钮 + Backspace 快捷键） |
| 预设系统 | Save / Apply / Delete 用户自定义预设 |
| 打乱 + AUF | 随机选取 setup scramble + 随机 AUF（U/U'/U2/无） |
| i18n | 中英文切换（`?lang=zh`） |
| 302 PNG 资源 | `client/public/zbls_img/`（case 图片） |

### 数据来源

`zbls.json` 包含 302 个 ZBLS case，每个含：
- `f2lGroup`：所属 F2L 组号（1~41）
- `algs`：算法列表
- `scrambles`：setup scramble 列表（随机选取 + 随机 AUF）

## Calc（HTH 成绩计算器）

从 `calc/` 目录迁移的 Head-to-Head Average of 5 模拟 + PA 计算器。
原版为纯 ES module 架构（`calc/js/*.js`），React 版复刻全部功能。

### 文件结构

```
pages/calc/
├── CalcPage.tsx              # 页面容器（挂载 chart/drag/drum 的 useEffect 生命周期）
├── calc.css                  # 全量样式（深色输入格 + SVG 图表 + bar 交互 + handle 动画）
├── components/
│   ├── chart_renderer.ts     # SVG 图表渲染（柱状图 + 标签 + 网格 + Ao 菱形 + confetti）
│   ├── chart_drag_handler.ts # 柱子交互（tap 选中 / 长按拖拽 / 滚轮 / 键盘 / focusedCell 联动）
│   ├── InputGrid.tsx         # 输入网格（时间格 + Target + checkbox + 头像按钮）
│   ├── Numpad.tsx            # 数字键盘（Rand / Clear / DNF）
│   └── Drum.tsx              # 滚筒选择器（数值滚动 + 惯性 + 吸附）
├── engine/
│   └── calc_engine.ts        # 计算引擎（KDE 采样 + Monte Carlo + Ao5 排名）
└── stores/
    └── calc_store.ts         # Zustand 状态（times/focusedCell/playerEnabled/event/URL 同步）
```

### 柱子交互行为

| 操作 | 效果 |
|------|------|
| 单击柱子 | 选中高亮（其他柱子 opacity 0.35），松手保持 |
| 再次单击同一柱子（tap） | toggle 取消选中 |
| 对已选中柱子按住+拖动 | 进入拖拽模式，实时改值 |
| 对新柱子按住+拖动 | 选中并立即拖拽 |
| 拖拽松手 | 取消选中，恢复正常 |
| 选中 InputGrid 单元格 | 联动激活对应图表柱子 |

### 关键依赖

| 依赖 | 用途 |
|------|------|
| `canvas-confetti` | WR 庆祝烟花效果（向上喷射） |

### 与原版差异

- 原版用命令式 DOM 操作，React 版用 Zustand 状态 + 命令式 SVG 渲染（chart_renderer/chart_drag_handler 保持命令式）
- `registerPostRenderCallback` 机制：chartRender 重建 DOM 后自动重新标记 `bar-active` + `bar-selected`
- Both 模式下 drag handle 宽度跟随实际柱子宽度（内侧矮柱子 × 0.55）

