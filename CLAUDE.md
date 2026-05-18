# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库布局

仓库 `RuiminYan/cuberoot.me`(自定义域名 `cuberoot.me` 走 GH Pages CNAME),同时托管：

1. **根目录的静态 HTML/JS**（来自多个 fork）—— 只读，不改。
2. **`core/`** — pnpm + Turbo monorepo，所有新开发都在这里：
   - `packages/client` — React 19 + Vite 8 SPA（主要工作区）
   - `packages/server` — Hono + **PostgreSQL 13**（WCA OAuth + recon + alg 公式库 + 训练数据，部署到云服务器;2026-05-06 从 MariaDB 迁过来,MariaDB 服务 + 数据已完整卸载)
   - `packages/shared` — 共享类型(`shared/src/alg.ts` 等);**公式数据全部在 PG `alg_sets/alg_cases` 两张表** (2026-05-06 从 JSON 迁过来),`loadAlg(puzzle, set)` 走 `/api/alg/sets/:p/:s` fetch
   - `packages/stats-build` — WCA 统计生成管道（独立 CI 周更）
   - `packages/stats-ui` — 统计页 UI

## 12 个模块的归属（重要）

首页（`LandingPage.tsx`）列出 12 个入口。部分是 fork 来的别人的代码，**不能改**：

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态 HTML | fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) | ❌ upstream |
| Alg Trainer | `/alg-trainers` | 根目录静态 HTML | fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) | ❌ upstream |
| csTimer | `/cstimer` | 根目录 `/cstimer/` | integrated from [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | ❌ upstream |
| WCA Stats（数据管道） | `/wca` | `core/packages/stats-build` | 基于 [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics) 的 TS 重写 | ⚠️ 管道已重写，UI 自有 |
| Score Calculator (HTH) | `/calc` | `core/packages/client/src/pages/calc/` | ported from [carykh/hthgrapher](https://github.com/carykh/hthgrapher) | ✅ 已 port 为 React |
| 1v1 Battle | `/battle` | `core/packages/client/src/pages/battle/` | ported from [MatteoColombo/cube_challenge_timer](https://github.com/MatteoColombo/cube_challenge_timer) | ✅ 已 port 为 React |
| Recon | `/recon` | `core/packages/client/src/pages/recon/` | 自有 | ✅ |
| Trainer（公式计时训练，全 41 套） | `/trainer` | `core/packages/client/src/pages/trainer/` (Landing/Select/Run + components + trainer.css) | 自有 | ✅ |
| Recognize（PLL 识别训练，看图答字母） | `/recognize/pll` | `core/packages/client/src/pages/TrainingPage.tsx` | 自有 | ✅ |
| Frame Count | `/frame-count` | `core/packages/client/src/pages/frame-count/` | 自有（WebCodecs + mp4box.js） | ✅ |
| Distribution | `/wca/viz` | `core/packages/client/src/pages/viz/` | 自有 | ✅ |
| Calendar (比赛日历) | `/wca/calendar` | `core/packages/client/src/pages/CalendarPage.tsx` | 自有 | ✅ |
| Scramble（打乱难度分布） | `/scramble-stats` | `core/packages/client/src/pages/scramble_stats/` + 数据 `stats/scramble/*.json` | 自有（源自 `D:\cube\solver` C++ 分析器产出的 CSV） | ✅ |
| Mosaic（魔方马赛克生成） | `/mosaic` | `core/packages/client/src/pages/mosaic/` | ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) | ✅ 已 port 为 React |
| Blog | `cuberoot.me/blog/` | 不在本仓库 | 外部托管 | — |

改 upstream 模块前先问用户；要改就只改 fork 后新增/包装的部分。

## 部署拓扑

- **静态 SPA**:云服务器 nginx 服 `cuberoot.me` + `www.cuberoot.me`(apex 301 → www),vhost 见 `ops/nginx/www.cuberoot.me.conf`,root `/www/wwwroot/toolkit`。GH Pages 走 CNAME=`cuberoot.me`,境外 DNS 走 GH(同内容,deploy_mirror.yml rsync 同步)。改 nginx 走 `deploy_nginx.yml`(push `ops/nginx/**` 触发,scp + `nginx -t` + reload + 失败回滚 .bak)。
- **后端 API**:Hono 服 `api.cuberoot.me`(同一台云服务器,nginx 反代到 127.0.0.1:3001)。
- **Blog (`/blog/` + `blog.cuberoot.me`)**:WordPress 静态归档双轨;境内 nginx alias 主路径,境外 GH Pages (`RuiminYan/cuberoot-blog` repo)。SPA 兜底处理旧 WP slug + 子域 fallback。Cert acme.sh + dns_ali 自动续。详 memory `reference_blog_subdomain`。
- 前端调 API **必须**用 `utils/api_base.ts` 的 `apiUrl()`(跨域到 `api.cuberoot.me`),不要硬编码 origin。CORS allowlist 在 `core/packages/server/src/index.ts`。
- 切 dev/prod API base 永远用 `import.meta.env.DEV`,**禁** `hostname === 'localhost'` 检查 — LAN IP / Tailscale `*.ts.net` / 隧道域名都不匹配,会错走 prod 跨域被 CORS 拦死。`shared/` 包不能 import client utils,直接 `(import.meta as { env?: { DEV?: boolean } }).env?.DEV`。
- **COOP/COEP (cubeopt-wasm SAB)**:仅 `/scramble/(solver|analyzer)` 由 nginx 发 `COOP=same-origin` + `COEP=require-corp`(map `$request_uri` 控制,见 vhost),进 cross-origin isolated context;其它 24 张卡完全干净,登录回调 /me 不受影响。新增需要 SAB 的页面要更新 nginx map regex。SW (`src/sw.ts`) **不再注入 COI headers**,只剩 `/v1/visualcube.svg` 拦截那一条。

## 开发命令

包管理用 **pnpm 10**（不是 npm）。Windows 下按全局规则用 `pwsh`。

**CWD 前提**:用户启动 Claude Code 前已 `cd D:\cube\cuberoot.me\core`(pnpm workspace 根)。所有 pnpm 命令直接跑。若 `pnpm install` 报 `ERR_PNPM_NO_PKG_MANIFEST` = CWD 在仓库根了,用 PowerShell tool `Set-Location core` 一次(别用 Bash tool 写 Windows 反斜杠路径,会被吞)。

```bash
pnpm install
pnpm --filter @cuberoot/client dev            # http://127.0.0.1:5173/
pnpm --filter @cuberoot/client typecheck      # tsgo (native Go port，~3s 冷 / ~1.2s 暖)
pnpm --filter @cuberoot/client typecheck:tsc  # tsc -b incremental，对齐编辑器 TS server 行为
pnpm --filter @cuberoot/client typecheck:ci   # tsc -b --force（清缓存全量，对齐 CI）
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/client lint
```

> **重要:**
> 1. 日常用 `typecheck` (tsgo,native Go,3s 冷 / 1s 暖,Microsoft 官方 preview);怀疑 tsgo 漏报时用 `typecheck:tsc` (老 tsc -b);push 前 / CI 对齐用 `typecheck:ci` (`tsc -b --force`)。**禁** `tsc --noEmit` 走根 tsconfig (references-only 壳,typo 静默过)。
> 2. **Dev server 永远在 `http://127.0.0.1:5173/`,不要 `pnpm dev`** (端口占用立刻挂)。要验证用 playwright 直接开。
> 3. 磁盘不够 (worktree / pnpm install / build 失败时) 先 `df -h` 告诉我,别静默换方案。

- Dev server 绑定 `127.0.0.1`（Vite 默认 IPv6 `[::1]` 在 Windows Chrome 下打不开，已在 `vite.config.ts` 固定）
- Recon API 通过 Vite proxy 转发到 `www.cuberoot.me`，**本地开发不需要跑后端**
- `serveRepoRoot` Vite 插件从仓库根 serve `/tools/`、`/stats/`、以及 upstream 静态页
- **凭据展开**：给用户云服务器 / DB shell 命令时，从 `.password.md` 读真实密码直接嵌入，**不要写 `<password>` 占位**（`.password.md` 已 gitignore，不会进 repo；用户每次都得手动替换占位太烦）。命令本身不要 commit。
- **本地 PG**:docker `pg13`(5433 pwd `dev` db `cuberoot_db`,PG 13)。schema / load.sql 先本地验。

## 测试

- vitest 在 `@cuberoot/client`,跑 `pnpm --filter @cuberoot/client test`(全集)或 `test:watch`
- utils 纯函数测试放 `src/utils/*.test.ts`,跟源文件并排
- worker / 算法回归走 `tests/*.test.ts` + 一个 `_*_runner.cjs`(node:worker_threads + classic-worker globals shim),典型例子见 `tests/analyzer_worker.test.ts`
- 改 worker / kociemba / scramble 生成器 / utils 必须配一组 fixture 测试,改前先看现有 `tests/` 里同类怎么写
- CI 在 `.github/workflows/test.yml`,PR + push main 触发 typecheck + test
- 回归 baseline(如 analyzer fixed totals)用 `expect().toBe()` 锁住具体数值,改算法时**主动改 baseline 当作一种 review 信号**,而不是改宽容到 `toBeGreaterThan` 蒙混

## 代码风格

- 响应简洁，不加多余注释，不做超出需求的抽象
- 不新建文件除非必要，优先编辑已有文件
- 改完跑 `pnpm --filter @cuberoot/client typecheck`（push 前 `typecheck:ci`）
- UI 不用 emoji，用 lucide-react 图标
- 不放页面级"返回"按钮，浏览器自带 back 即可（wizard 步骤间 / 模式切换不算）
- 选择型 / 搜索型输入框非空时必须显示 `×` 清除按钮：统一用 `components/ClearButton.tsx`（`variant='inline'` 浮在 input 内，`'standalone'` 流式独立圆），别再写一份局部 `.xxx-clear` CSS
- 切换器默认下拉，不堆 chip / tab；chip 仅当选项 ≤ 4 且需要左右对比时才用
- 全局固定按钮 (theme/lang/auth toggle) 跟内容容器右沿对齐,不贴视口:`right: max(16px, calc((100vw - <content-max-width>) / 2))`
- chip / tab / 下拉项上不显示数量计数（`(25)` / badge 之类一律不要）
- WCA 历史时间锚点：第 1 场比赛 1982-06-05（WC1982），第 2 场 2003-08-23~24（WC2003）；任何"时间序列展示"（折线 / 热力图 / 时间轴 / bar chart race）默认视图从 **2003-08-22** 起步（WC2003 前夜：第 0 帧 = 1982 那场的全部成绩快照，再往后才是 WCA 复办之后的逐日演化），但**统计聚合（总数 / 国家排行 / 项目场次等）必须包含 1982 那场**（用户没主动缩放时口径=全时段，不要把"默认视图≠全数据"的不一致带到数字上）
- 调试时不主动 `git log` / `git status`;删文件 / 配置前先确认
- UI 验证走项目内 Playwright MCP;fixtures 跑全集别采样
- 新路由 / 新顶层 page 前先 grep routes config 防撞名

## 主题 / 颜色

写任何 CSS 色值 (背景 / 文字 / 边框 / hover) 前调 `theme-tokens` skill —— token 表 + dark-locked 页清单 + color-mix 衍生规则在那里。禁 `#888 #aaa` 等硬码灰阶。

## Skill 路由

主题命中 trigger 时主动调对应 skill,不要凭记忆。skill 描述 + triggers 已由 harness 自动加载,触发即可,**不要在此再列索引表**(双倍信息,白付 token)。
