# CubeRoot Trainer

公式识别训练器 · React + Vite + TypeScript

## 项目结构

```
core/
├── packages/
│   ├── client/          # React 19 + Vite 8 前端
│   │   ├── src/
│   │   │   ├── pages/       # 页面组件（WCA Stats / Calc / Viz / Battle / Recon / ZBLL / ZBLS）
│   │   │   ├── stores/      # Zustand 状态管理（训练/计时/设置/认证）
│   │   │   ├── hooks/       # React Hooks（计时器/键盘）
│   │   │   ├── utils/       # 工具函数（国旗/统计/API/公式处理）
│   │   │   ├── components/  # 共享组件（CubeView）
│   │   │   └── i18n/        # 国际化（中/英）
│   │   └── public/          # 静态资源（cubing-icons 字体/打乱图/ZBLL SVG）
│   │
│   ├── server/              # Hono + MariaDB API（WCA OAuth + 训练数据）
│   │
│   ├── stats-build/         # WCA 统计数据生成管道（88 个统计，TypeScript 实现）
│   │
│   ├── stats-ui/            # [Legacy] Jekyll 前端 TS 源码（React 迁移完成后移除）
│   │
│   └── shared/              # 共享类型与算法数据（PLL/ZBLL/ZBLS JSON）
```

> 每个源文件头部都有 TSDoc `@module` 注释说明职责。
> 使用 `gitnexus_query` / `gitnexus_context` 查找代码关系和用法。

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
# NOTE: vite.config.ts 已设置 host: '127.0.0.1'，确保浏览器能通过 IPv4 访问
# （Vite 默认只绑定 IPv6 [::1]，Windows Chrome 可能无法访问 localhost:5173）

# TypeScript 类型检查
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/server typecheck

# Stats UI 构建（编译 TS → 复制到 Jekyll 路径）
cd packages/stats-ui
.\build.ps1
```

> **注意**：Recon API 通过 Vite proxy 转发到 ECS 线上后端（`toolkit.cuberoot.me`），本地开发**不需要**启动 Hono 后端。
> 
> 若需要 Calc/Upcoming Comps 模块的 WR/比赛数据，或测试 Solver/Alg core/csTimer 的 iframe 嵌入效果，需额外启动 `bundle exec jekyll serve`（`http://localhost:4000`）。Vite dev server 已配置 proxy 自动转发这些路径。

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
| **Deploy Trainer** | push main 且 `core/` 有变更 | pnpm install → build client + server → rsync + pm2 restart |
| **Deploy Mirror** | push main（已有） | Jekyll build + rsync（core/ 已在 `_config.yml` exclude 中排除）|

```
push core/ 变更 → GitHub Actions → build → rsync → ECS
  ├── toolkit.cuberoot.me/app/        ← 前端
  └── toolkit.cuberoot.me:3001/api/   ← 后端 API
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

## Stats Build 使用方式

```powershell
cd core/packages/stats-build

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
```

> 完整迁移文档见 [MIGRATION_PLAN.md](packages/stats-build/MIGRATION_PLAN.md)

