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
│   │   │   │   └── StatsPage.tsx      # 统计页：表格（次数/最近/Ao5/Ao12/最佳）
│   │   │   ├── stores/
│   │   │   │   ├── sessionStore.ts    # 训练状态机（idle→caseShown→timing→stopped→complete）
│   │   │   │   ├── settingsStore.ts   # 用户设置（localStorage 持久化）
│   │   │   │   └── statsStore.ts      # 训练统计（Ao5/Ao12 计算 + 持久化）
│   │   │   ├── hooks/
│   │   │   │   ├── useTimer.ts        # 高精度计时器（performance.now + rAF）
│   │   │   │   └── useKeyboard.ts     # 键盘事件（keydown/keyup 分离）
│   │   │   ├── utils/
│   │   │   │   └── adaptiveQueue.ts   # 自适应队列（慢的 case 重复更多次）
│   │   │   └── i18n/
│   │   │       ├── index.ts           # i18n 初始化（URL > localStorage > 浏览器语言）
│   │   │       ├── zh.json            # 中文翻译
│   │   │       └── en.json            # 英文翻译
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
│           └── pll.json               # 21 个 PLL case（name/group/algorithms/scramble）
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
# → http://localhost:5173/trainer/

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
