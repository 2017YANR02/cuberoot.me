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
│   │   │   ├── App.tsx                # 路由配置（React Router, basename=/app）
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
│   │   │   │   ├── ZblsTimerPage.tsx  # ZBLS 计时页：计时器 + Recap + Again
│   │   │   │   ├── AuthCallbackPage.tsx  # WCA OAuth 回调页（Implicit Grant token 处理）
│   │   │   │   └── recon/             # Recon 复盘模块
│   │   │   │       ├── ReconListPage.tsx    # 列表页（表格+筛选+排序+分页）
│   │   │   │       ├── ReconDetailPage.tsx  # 详情页（twisty+视频+统计+评论）
│   │   │   │       ├── ReconSubmitPage.tsx  # 提交/编辑页（表单+搜索+实时统计）
│   │   │   │       ├── recon_detail.css     # 详情页样式
│   │   │   │       └── recon_submit.css     # 提交页样式
│   │   │   │   ├── wca_stats/         # WCA 统计模块
│   │   │   │   │   ├── WcaStatsIndex.tsx    # 统计指标索引页（分组卡片导航）
│   │   │   │   │   └── WcaStatsPage.tsx     # 单个统计详情页（Tab+图表）
│   │   │   │   ├── LandingPage.tsx    # 全站入口主页（1:1 复刻原版 index.html，粒子+10卡片）
│   │   │   │   ├── UpcomingCompsPage.tsx # 顶尖选手近期比赛（时间轴+搜索+国家过滤）
│   │   │   │   ├── IframePage.tsx     # 通用 iframe 包装页（Solver/Alg Trainer/csTimer）
│   │   │   │   └── landing.css        # 主页样式
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
│   │   │   │   ├── zbls_preset_store.ts    # ZBLS 预设（localStorage）
│   │   │   │   ├── recon_store.ts           # Recon 列表缓存 + 筛选/排序/分页
│   │   │   │   └── auth_store.ts            # WCA OAuth 认证状态（Implicit Grant + 跨 tab 同步）
│   │   │   ├── hooks/
│   │   │   │   ├── useTimer.ts        # 高精度计时器（performance.now + rAF）
│   │   │   │   └── useKeyboard.ts     # 键盘事件（keydown/keyup 分离）
│   │   │   ├── utils/
│   │   │   │   ├── adaptiveQueue.ts   # 自适应队列（慢的 case 重复更多次）
│   │   │   │   ├── zbllHelpers.ts     # ZBLL 工具函数（打乱生成/时间格式化/SVG 路径/数据操作）
│   │   │   │   ├── zbls_helpers.ts    # ZBLS 工具函数（打乱+AUF/PNG 路径/分组数据）
│   │   │   │   ├── recon_stats.ts     # Recon 统计引擎（STM/TPS/阶段解析）
│   │   │   │   ├── recon_norm_cross.ts # Recon Cross 标准化
│   │   │   │   ├── recon_alg_utils.ts # Recon 公式工具（twisty-player 清洗）
│   │   │   │   ├── recon_utils.ts     # Recon 格式化工具（国旗/时间/事件/i18n）
│   │   │   │   └── recon_api.ts       # Recon API 客户端（20+ 端点）
│   │   │   ├── recon.css               # Recon 列表页样式
│   │   │   ├── zbll.css               # ZBLL 专用样式（选择页 + 计时页 + 响应式）
│   │   │   ├── zbls.css               # ZBLS 专用样式（F2L 组列表 + 计时页 + 响应式）
│   │   │   └── i18n/
│   │   │       ├── index.ts           # i18n 初始化（URL > localStorage > 浏览器语言）
│   │   │       ├── zh.json            # 中文翻译（含 ZBLL/ZBLS 翻译 keys）
│   │   │       └── en.json            # 英文翻译（含 ZBLL/ZBLS 翻译 keys）
│   │   └── vite.config.ts             # Vite 配置（base=/app/，API 代理 + Jekyll dev 路径代理）
│   │
│   ├── server/                # Hono + MariaDB 后端
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
│   ├── stats-ui/              # Stats 前端 TypeScript 源码（编译后覆盖 Jekyll 路径）
│   │   ├── src/
│   │   │   ├── stats_ui.ts            # Metric/Tab/Source 交互 + initStatsUI() 自动生成按钮
│   │   │   ├── wr_history_chart.ts    # WR 历史折线图（Canvas 绘制）
│   │   │   ├── distribution_chart.ts  # 分布图：直方图/KDE/箱线图（SVG）
│   │   │   ├── event_selector.ts      # WCA 项目选择器 + URL hash 状态持久化
│   │   │   └── logo_nav.ts            # 全站 Logo 导航
│   │   ├── tsconfig.json              # 独立配置（ES2017 + DOM + strict，不继承 base）
│   │   └── build.ps1                  # tsc 编译 + 复制产物到 Jekyll assets/js/ 和 i18n/
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

# Stats UI 构建（编译 TS → 复制到 Jekyll 路径）
cd packages/stats-ui
.\build.ps1
```

> **注意**：Recon API 通过 Vite proxy 转发到 ECS 线上后端（`toolkit.cuberoot.me`），本地开发**不需要**启动 Hono 后端。
> 
> 若需要 Calc/Upcoming Comps 模块的 WR/比赛数据，或测试 Solver/Alg Trainer/csTimer 的 iframe 嵌入效果，需额外启动 `bundle exec jekyll serve`（`http://localhost:4000`）。Vite dev server 已配置 proxy 自动转发这些路径。

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
| 后端框架 | Hono | 4.x |
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

## Viz（分布演变可视化）

从 `viz/` 目录迁移的选手成绩分布演变可视化工具。
原版为纯 ES module 架构（`viz/viz.js` 等 6 文件），React 版 1:1 复刻全部功能。

### 文件结构

```
pages/viz/
├── VizPage.tsx                # 页面容器（toolbar + canvas + ridgeline + stats）
├── viz.css                    # 全量样式（深色主题 + glassmorphism + 控件 + WcaPersonPicker 覆盖）
├── components/
│   ├── VizCanvas.tsx          # 主 Canvas 组件（setupCanvas + drawFrame + subscribe throttle）
│   ├── RidgelineCanvas.tsx    # 山脊图 Canvas 组件
│   ├── ModeSelector.tsx       # 数据模式选择器（17 种：Singles/Mo3/Ao5/…/BestC/WorstC/Worst）
│   ├── PlayControls.tsx       # 播放控制（Play/Pause + 速度 + 帧滑块）
│   ├── PlayerChips.tsx        # 选手标签 chips（多选手颜色标识 + 删除）
│   ├── StatsBar.tsx           # 底部统计信息栏
│   └── LegendPanel.tsx        # 图例面板
├── engine/
│   ├── data_fetch.ts          # WCA API 数据抓取 + 缓存
│   ├── kde.ts                 # 核密度估计（Gaussian KDE）
│   ├── sync.ts                # 帧同步 + 动画引擎
│   ├── rolling_stats.ts       # 滚动统计（Mo3/Ao5/…/Ao100）
│   ├── round_metrics.ts       # 轮次指标（Avg/BPA/WPA/Median/BestC/WorstC）
│   └── csv_export.ts          # CSV 导出
├── renderers/
│   ├── histogram_view.ts      # 直方图渲染
│   ├── cumhist_view.ts        # 累积直方图渲染
│   ├── line_view.ts           # 折线图渲染
│   ├── ridgeline_renderer.ts  # 山脊图渲染
│   └── draw_utils.ts          # 绘图工具函数（网格/标签/色彩）
└── stores/
    └── viz_store.ts           # Zustand 状态（选手/帧/模式/播放/canvas 尺寸）
```

### 关键设计

| 设计点 | 说明 |
|--------|------|
| 状态订阅 | 使用 `useVizStore.subscribe()` + `requestAnimationFrame` 节流，避免 React re-render 循环 |
| Delta 历史 | 用 `useRef` 本地跟踪 mean 历史，不写入 store，防止无限渲染 |
| 字体 | Google Fonts（Inter + JetBrains Mono），在 `index.html` 全局加载 |
| WcaPersonPicker | 共享组件，viz 内通过 CSS 覆盖为深色主题（`position:static` 覆盖 inline 模式的 absolute 定位） |

## Battle（对战计时器）

从 `battle/` 目录迁移的双人对战 / 单人计时器。
原版为 `battle.js`（3596 行）+ `scramble_module.js`（567 行），React 版 1:1 复刻全部功能。

### 文件结构

```
pages/battle/
├── BattlePage.tsx              # 页面容器（TimerArea × 2 + MiddleBar + BottomNav + Settings + History）
├── battle.css                  # 全量样式（AMOLED 黑 + Segment7 字体 + 响应式 + 底部导航）
├── HistoryPanel.tsx            # 历史面板（趋势图 + 分布图 + 成绩列表 + 工具按钮）
├── AdvancedFeatures.tsx        # 高级功能（里程碑 Toast / Ao 详情 / 手动输入 / 模拟赛 / 热力图 / 导入导出 / 分享）
└── engine/
    ├── battle_store.ts         # Zustand 状态机（1v1/Solo 模式 + WCA Inspection + 罚时 + 多阶段计时 + 持久化）
    ├── scramble_engine.ts      # 打乱引擎封装（通过 public/scramble_module.js 加载）
    └── stats.ts                # 统计计算（Ao5/Ao12/Mo3 + PB 检测 + 趋势分析）
```

### 关键设计

| 设计点 | 说明 |
|--------|------|
| 计时动画 | `useRef` + `requestAnimationFrame` 直接操作 DOM，避免 React re-render |
| 触控隔离 | `setPointerCapture` 确保多点触控独立计时 |
| 打乱引擎 | 全局 `window.scrMgr` + jQuery shim + kernel 配色注入 |
| 字体 | Segment7Standard.otf 七段 LCD 字体（`/app/fonts/`） |
| 里程碑通知 | `window` 自定义事件 `battle-milestone`，UI 组件监听 Toast |
| 数据持久化 | localStorage 存储 Session 列表 + 成绩记录 |
| 底部导航 | Solo 模式：Timer / Results / Settings 三 tab 切换（原版 icon_timer.png + SVG 图标） |
| 中间栏 | 1v1 模式：比分 + 键盘提示 + 全屏 + CubeRoot logo + 设置 |

## Recon（复盘数据库）

从 `recon/` 目录迁移的复盘（Reconstruction）系统。
原版为 PHP 后端 + 纯 JS 前端（`recon_detail.js` 1586 行 + `recon_submit_page.js` 2432 行 + 共享模块），React 版移植核心功能。

### 文件结构

```
utils/
├── recon_stats.ts             # 统计引擎（STM/TPS/阶段解析 Cross/F2L/LL/OLL/PLL）
├── recon_norm_cross.ts        # Cross 标准化（宽转动分解 + 旋转吸收）
├── recon_alg_utils.ts         # 公式工具（twisty-player 清洗 + 光标磁吸）
├── recon_utils.ts             # 格式化工具（国旗/时间/事件映射/纪录徽章/i18n）
└── recon_api.ts               # API 客户端（20+ 端点，fetch + Bearer token）

stores/
└── recon_store.ts             # Zustand Store（列表缓存 + 多维度筛选/排序/分页）

pages/recon/
├── ReconListPage.tsx          # 列表页（表格 + 工具栏 + 纪录徽章 + 分页）
├── ReconDetailPage.tsx        # 详情页（twisty 动画 + YouTube/Bilibili 视频 + 统计 + 评论）
├── ReconSubmitPage.tsx        # 提交/编辑页（表单 + 选手搜索 + 实时统计 + 重复检测）
├── recon_detail.css           # 详情页样式（两列布局 + 视频 facade + 统计网格）
└── recon_submit.css           # 提交页样式（表单 + 搜索下拉 + 实时统计预览）

recon.css                      # 列表页样式（表格 + 工具栏 + 纪录徽章）
```

### 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/recon` | ReconListPage | 列表页（筛选/排序/分页） |
| `/recon/:id` | ReconDetailPage | 详情页（twisty/视频/评论） |
| `/recon/submit` | ReconSubmitPage | 新增复盘 |
| `/recon/submit/:editId` | ReconSubmitPage | 编辑已有复盘 |

### 关键设计

| 设计点 | 说明 |
|--------|------|
| API 兼容 | 前端直连现有 PHP 后端，通过 `VITE_RECON_API_BASE` 环境变量切换；开发环境走 Vite proxy |
| twisty-player | 动态 `import('cubing/twisty')` + `useRef` DOM 注入，按需加载（~1MB） |
| 视频 facade | YouTube 用缩略图 + 播放按钮，Bilibili 用异步封面（`getBiliCover`）+ 品牌 logo overlay |
| 外部链接 | alg.cubing.net / cubedb.net / 分享链接（`buildExternalLinks` 工具函数） |
| 统计网格 | 17 项完整字段（method/STM/TPS/exec/memo/Cross/F2L/LL/crossType/freePair/yRot/regrip/lockup/sMove/crossColor/OLL/PLL） |
| crossColor 着色 | 使用 `FACE_COLORS` 映射为彩色文字 |
| 评论 CRUD | 添加/编辑/删除评论，仅作者可操作自己的评论（需 `wca_wcaId` in localStorage） |
| 编辑历史 | 折叠式 before/after diff 面板，字段级变更着色（红删除线→绿新值） |
| 同轮次导航 | 异步查询同 comp+event+round 的其他 solve，当前高亮 + 链接跳转 |
| 实时统计 | 提交页输入解法时即时计算 STM/TPS/OLL/PLL 并预览 |
| 重复检测 | 提交时自动检查相同比赛+轮次+选手是否已有复盘 |
| 统计引擎 | 纯函数实现，支持 STM/TPS/阶段 STM/OLL/PLL 提取/注解计数 |
| 虚拟键盘 | 双页布局（魔方符号/QWERTY）、长按变体弹出、上下滑手势（逆时针/双层）、双击 180°、长按 180°'、iOS Shift 三态、() 三态、修饰键自动禁用、公式联想 |

### 后续工作

| 事项 | 说明 |
|------|------|
| ECS 部署 | 将 `packages/server`（Hono）部署到 ECS，配置 `DB_*` 环境变量；前端改 `VITE_RECON_API_BASE` 指向 Hono 并删除 Vite PHP proxy |

## Stats UI（统计页前端 TypeScript）

将 Jekyll 静态站的 5 个前端 JS 文件（原手写 ES2017）迁移到 TypeScript，编译后覆盖到原始 Jekyll 路径。

### 文件结构

```
packages/stats-ui/
├── src/
│   ├── stats_ui.ts              # 核心交互：Metric/Tab/Source 面板切换 + URL hash 同步
│   ├── wr_history_chart.ts      # WR 历史折线图：DOM 表格数据提取 + Canvas 绘制
│   ├── distribution_chart.ts    # 分布图：直方图/KDE/箱线图（SVG）+ 自动 bin 宽度
│   ├── event_selector.ts       # WCA 项目选择器 + 21 图标栏 + URL hash 状态持久化
│   └── logo_nav.ts              # 全站 Logo 导航（亮度检测自动切换 logo）
├── dist/                        # tsc 编译产物（.gitignore）
├── tsconfig.json                # ES2017 + DOM + strict（独立配置，不继承 base）
├── build.ps1                    # 编译 + 复制到 Jekyll assets/js/ 和 i18n/
└── package.json                 # @cuberoot/stats-ui
```

### 设计要点

| 要点 | 说明 |
|------|------|
| tsconfig 独立 | 不继承 `tsconfig.base.json`（base 用 ESNext 模块，stats-ui 需要无模块 IIFE 输出） |
| 编译产物 = 运行时 | `tsc` 直接输出 JS，无 bundler。产物覆盖 `assets/js/stats_ui.js` 等原路径 |
| 全局函数 | `switchMetric`/`switchTab` 等不包在 IIFE 内（Ruby `onclick` 直接引用） |
| 原始 JS 保留 | git 历史中保留原始版本（`git show HEAD~1:assets/js/stats_ui.js`） |

### 开发流程

```powershell
# 1. 编辑 src/*.ts
# 2. 编译 + 复制到 Jekyll 路径
cd packages/stats-ui
.\build.ps1
# 3. 刷新 http://localhost:4000/stats/ 验证
```

## Stats Build（WCA 统计数据生成 · Ruby → TypeScript 迁移）

将 `_stats_build/statistics/*.rb` 中的 88 个 Ruby 统计脚本全部改写为 TypeScript，直连 MySQL 输出 JSON，供 React 前端渲染。

> 完整迁移文档见 [MIGRATION_PLAN.md](packages/stats-build/MIGRATION_PLAN.md)

### 迁移进度（✅ 全部完成）

| 阶段 | 数量 | 状态 |
|------|------|------|
| 88/88 统计实现 | 88 | ✅ |
| 内存管理与 Ruby 对齐 | — | ✅ |
| 批量执行 CLI (`compute_all.ts`) | — | ✅ |
| WR ID 生成 (`gen_wr_ids.ts`) | — | ✅ |
| 索引页生成 (`compute_index.ts`) | — | ✅ |
| 数据库导入 (`update_database.ts`) | — | ✅ |
| CI workflow 切换（已完全移除 Ruby） | — | ✅ |
| 前端 4 种渲染模式 + 索引页 | — | ✅ |

### 文件结构

```
packages/stats-build/
├── MIGRATION_PLAN.md              # 完整迁移文档（AI 交接用）
├── run_all_tests.ps1              # 批量测试脚本
├── package.json                   # @cuberoot/stats-build
├── tsconfig.json                  # ESNext + NodeNext
├── src/
│   ├── core/
│   │   ├── database.ts            # MySQL 连接池 + DB_CONFIG/REQUIRED_TABLES/INDICES 常量
│   │   ├── statistic.ts           # Statistic 基类
│   │   ├── grouped_statistic.ts   # GroupedStatistic 基类
│   │   ├── round_metric.ts        # RoundMetric 基类（双视图 panels）
│   │   ├── ao_rounds.ts           # AoRounds 基类（跨轮次均值）
│   │   ├── average_of_x.ts        # AverageOfX 基类（滑动窗口均值）
│   │   ├── rankings.ts            # Rankings 基类（年度排名）
│   │   ├── solve_time.ts          # WCA 成绩格式化
│   │   ├── format_date.ts         # 共享日期格式化（统一输出 YYYY-MM-DD，修复 String(Date).slice(0,10) bug）
│   │   └── events.ts              # 项目映射 + 表头翻译
│   ├── statistics/                # 88 个统计实现（1:1 对应 Ruby）
│   │   └── *.ts
│   └── bin/
│       ├── compute.ts             # CLI：npx tsx src/bin/compute.ts <stat_id>
│       ├── compute_all.ts         # CLI：批量执行 88 个统计（串行 + GC）
│       ├── gen_wr_ids.ts          # CLI：介 WR 排名提取 top2 ID
│       ├── compute_index.ts       # CLI：生成 6 分类索引 JSON
│       ├── update_database.ts     # CLI：下载 + 导入 WCA 数据库（替代 Ruby update_database.rb）
│       └── validate.ts            # Ruby MD vs TS JSON 对比验证
```

### 使用方式

```powershell
cd trainer/packages/stats-build

# 需要设置 Node 参数（内存管理 + GC）
$env:NODE_OPTIONS='--expose-gc --max-old-space-size=6144'

# 计算单个统计
npx tsx src/bin/compute.ts world_championship_podiums_by_person

# 查看所有可用统计
npx tsx src/bin/compute.ts

# 批量执行所有统计（串行 + GC）
npx tsx src/bin/compute_all.ts

# 指定统计过滤
$env:STATS_FILTER='wr_metric,wr_aoxr'
npx tsx src/bin/compute_all.ts

# 生成 WR ID（依赖 compute_all 输出）
npx tsx src/bin/gen_wr_ids.ts

# 生成索引页（依赖 compute_all 输出）
npx tsx src/bin/compute_index.ts

# TypeScript 编译检查
npx tsc --noEmit

# 批量测试（需要 MySQL 运行）
.\run_all_tests.ps1
```

### JSON 输出

输出到 `stats/data/<stat_id>.json`，支持 4 种模式：

| 模式 | 字段 | 使用者 |
|------|------|--------|
| 普通统计 | `rows` | `Statistic` |
| 分组统计 | `sections` | `GroupedStatistic` |
| 双视图 | `panels` (ranking + history) | `RoundMetric` / `AoRounds` / `AverageOfX` |
| 聚合页面 | `metricPanels` | `wr_metric` / `wr_aoxr` / `average_of` |

