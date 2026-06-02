# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库布局

仓库 `RuiminYan/cuberoot.me`(自定义域名 `cuberoot.me`),同时托管：

1. **根目录的静态 HTML/JS**（来自多个 fork + Phase 4 前 deploy_mirror.yml 同步的 Vite build 残留）—— 只读，不改;deploy_mirror 已停,残留长期会清。
2. **`core/`** — pnpm + Turbo monorepo，所有新开发都在这里：
   - `packages/client-next` — **React 19 + Next.js 16 (App Router, Turbopack)** ← **主要工作区** (Phase 4 2026-05-27 切完)
   - `packages/client` — React 19 + Vite 8 SPA (已退役,仅本地 `localhost:5173` 对比/兜底用,新功能不动;线上 vite.cuberoot.me 已下线)
   - `packages/server` — Hono + **PostgreSQL 13**（WCA OAuth + recon + alg 公式库 + 训练数据，部署到云服务器;2026-05-06 从 MariaDB 迁过来,MariaDB 服务 + 数据已完整卸载)
   - `packages/shared` — 共享类型(`shared/src/alg.ts` 等);**公式数据全部在 PG `alg_sets/alg_cases` 两张表** (2026-05-06 从 JSON 迁过来),`loadAlg(puzzle, set)` 走 `/api/alg/sets/:p/:s` fetch
   - `packages/visualcube` — 自有 visualcube 封装;CI/server bundle 前必须先 build (`pnpm -F @cuberoot/visualcube build`,产 `dist/index.js`),否则 esbuild/Vercel build 找不到 export
   - `packages/stats-build` — WCA 统计生成管道（独立 CI 周更）
3. **`solver/`** — 顶层(pnpm workspace 外,非 package)。魔方求解引擎(Rust,2026-05-31 从已退役的 cube-solver-rust 导入,monorepo 为唯一源)。产 native 分析器喂 `/scramble/*` 数据管道(`update_cross_stats.ps1` 的 `$SolverDir` 指这)+ 编 WASM 给浏览器端。`target/ tables/(~34GB) pkg-web/ pkg-node/` 本地 gitignored(只本机有,repo/CI/线上都没有)。

## 12 个模块的归属（重要）

首页(`app/[lang]/page.tsx` 渲染 `components/LandingPage`)列出多入口。部分 fork 不能改:

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态 HTML(只本机 nginx serve,Vercel 上走 `tools/[...slug]` 反代 static.cuberoot.me) | fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) | ❌ upstream |
| Alg Trainer | `/alg-trainers` | 根目录静态 HTML(同上) | fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) | ❌ upstream |
| csTimer | `/cstimer` | iframe → `/tools/cstimer/`(同上 fallback) | integrated from [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | ❌ upstream |
| WCA Stats（数据管道） | `/wca` | `core/packages/stats-build` | 基于 [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics) 的 TS 重写 | ⚠️ 管道已重写，UI 自有 |
| Score Calculator (HTH) | `/calc` | `core/packages/client-next/app/[lang]/calc/` | ported from [carykh/hthgrapher](https://github.com/carykh/hthgrapher) | ✅ |
| 1v1 Battle | `/battle` | `core/packages/client-next/app/[lang]/battle/` | ported from [MatteoColombo/cube_challenge_timer](https://github.com/MatteoColombo/cube_challenge_timer) | ✅ |
| Recon | `/recon` | `core/packages/client-next/app/[lang]/recon/` | 自有 | ✅ |
| Trainer（公式计时训练，全 41 套） | `/trainer` | `core/packages/client-next/app/[lang]/trainer/` | 自有 | ✅ |
| Recognize（PLL 识别训练，看图答字母） | `/recognize/pll` | `core/packages/client-next/app/[lang]/recognize/[algSetId]/` | 自有 | ✅ |
| Frame Count | `/frame-count` | `core/packages/client-next/app/[lang]/frame-count/` | 自有（WebCodecs + mp4box.js） | ✅ |
| Distribution | `/wca/viz` | `core/packages/client-next/app/[lang]/wca/viz/` | 自有 | ✅ |
| Calendar (比赛日历) | `/wca/calendar` | `core/packages/client-next/app/[lang]/wca/calendar/` | 自有 | ✅ |
| Scramble（打乱难度分布） | `/scramble/stats` | `core/packages/client-next/app/[lang]/scramble/stats/` + 数据 `stats/scramble/*.json` | 自有（源自 `D:\cube\solver` C++ 分析器产出的 CSV） | ✅ |
| Mosaic（魔方马赛克生成） | `/mosaic` | `core/packages/client-next/app/[lang]/mosaic/` | ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) | ✅ |
| Blog | `blog.cuberoot.me`(`/blog` redirect 过去) | 独立 repo `RuiminYan/cuberoot-blog` | 外部托管 | — |

改 upstream 模块前先问用户；要改就只改 fork 后新增/包装的部分。同名 Vite 版本在 `packages/client/src/pages/*` 还在,但只作回滚兜底,**新功能只改 client-next**。

## 部署拓扑 (Phase 4 后 — 2026-05-27)

- **主域 `cuberoot.me` / `www.cuberoot.me`** 走 **DNS 分线路** (provider 自带分流):
  - 一条线路 → 自有服务器 IP → nginx `proxy_pass 127.0.0.1:3002` → systemd `cuberoot-next` (Next standalone)。vhost `ops/nginx/www.cuberoot.me.conf`,改 nginx 走 `deploy_nginx.yml`(scp + `nginx -t` + reload + 失败回滚 .bak)。
  - 另一条线路 → Vercel Hobby `cuberoot-me` project → 同一份 Next 代码 + Vercel edge。Vercel 自动从 GitHub main 跑 build,部署是 push-triggered。
- **`static.cuberoot.me`** — 自有服务器 nginx 独立 vhost,只服 `/www/wwwroot/toolkit/{tools,stats}/`(forks 静态资源 + WCA stats JSON),CORS:* 给 Vercel function fallback。2026-05-27 替代退役的 `vite.cuberoot.me`。
- **`next.cuberoot.me`** — 同一套 systemd `cuberoot-next` 反代 :3002,作 staging 子域 / 别名。
- **systemd Next standalone 部署**:`deploy_next.yml`(push `core/packages/{client-next,shared,visualcube}/**` 触发) CI build → tar `.next/standalone/`(自带 node_modules) → scp → 服务器原子换 `/www/wwwroot/toolkit-next/` + 健康检查 :3002,挂了自动回滚 .bak。`start.sh` 包装定位 standalone entry,systemd unit 在 `ops/systemd/cuberoot-next.service`。
- **Vercel build 特殊处理**:`next.config.ts` 用 `VERCEL=1` env gate,Vercel 上跳过 `output: standalone` + `outputFileTracingRoot`(否则 vercel/next.js#88579 撞 manifest ENOENT)。`app/stats/[...slug]/route.ts` 和 `app/tools/[...slug]/route.ts` 在 Vercel 上 fallback 拉 `static.cuberoot.me/{stats,tools}/*`(stats 数据 + forks 没打进 Vercel bundle,CORS 已开)。
- **Vercel CLI 已装本机**(`ruiminyan` 登录态):`vercel logs https://www.cuberoot.me` 拉最近 100 条 function log,`| grep ' 5[0-9]{2} '` 过 5xx。用户报"vercel 报错"直接 CLI 自查,免截图。详见 memory `project_vercel_deployment`。
- **CORS allowlist** 在 `core/packages/server/src/index.ts`,函数形式放行 `*.vercel.app`(Vercel preview 每 PR 一个 URL)+ 主域 + `next.cuberoot.me`。
- **后端 API**:Hono 服 `api.cuberoot.me`(同一台自有服务器,nginx 反代到 127.0.0.1:3001)。
- **Blog (`/blog/` + `blog.cuberoot.me`)**:独立 `cuberoot-blog` repo 静态归档,blog.cuberoot.me 双轨(自有 nginx alias / GH Pages)按 DNS 分线路。主域 `/blog` 走 next.config.ts redirect → blog.cuberoot.me。详 memory `reference_blog_subdomain`。
- 前端调 API **必须**用 `utils/api_base.ts` 的 `apiUrl()`(client-next 在 `lib/api-base.ts`),不要硬编码 origin。
- 切 dev/prod API base 永远用 `import.meta.env.DEV`,**禁** `hostname === 'localhost'` 检查 — LAN IP / Tailscale `*.ts.net` / 隧道域名都不匹配,会错走 prod 跨域被 CORS 拦死。`shared/` 包不能 import client utils,直接 `(import.meta as { env?: { DEV?: boolean } }).env?.DEV`。
- **COOP/COEP (cubeopt-wasm SAB)**:仅 `/scramble/solver` 在 Next config `headers()` 发(Phase 4 缩到只 solver — analyzer 用 classic worker COEP 会拦死)。nginx vhost 顶 `map $request_uri` 同样匹配 `/scramble/(solver|analyzer)`(历史保留,实际 Next 自己也发)。新增 SAB 页面同步改两处。
- **client-next 页面默认 SSG**(2026-05-28 起,~128 组静态走 CDN):根 `app/layout.tsx` 禁动态 API(cookies/headers),全局组件禁在 render 调 `useSearchParams`,否则整站退回动态 / CSR 空壳;语言归属在 `[lang]/layout`,i18n 走 `initImmediate:false` + `useSuspense:false`。
- **deploy_mirror.yml** 已禁(Phase 4 前 GH Pages 镜像用),保留 workflow_dispatch 短期回滚兜底。

## 开发命令

包管理用 **pnpm 11**（不是 npm）。Windows 下按全局规则用 `pwsh`。

**CWD 前提**:用户启动 Claude Code 前已 `cd D:\cube\cuberoot.me\core`(pnpm workspace 根)。所有 pnpm 命令直接跑。若 `pnpm install` 报 `ERR_PNPM_NO_PKG_MANIFEST` = CWD 在仓库根了,用 PowerShell tool `Set-Location core` 一次(别用 Bash tool 写 Windows 反斜杠路径,会被吞)。

```bash
pnpm install
pnpm --filter @cuberoot/client-next dev            # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client-next typecheck      # tsgo (native Go port，~3s 冷 / ~1.2s 暖)
pnpm --filter @cuberoot/client-next typecheck:tsc  # tsc -b incremental
pnpm --filter @cuberoot/client-next build          # 会自动 prebuild @cuberoot/shared + visualcube
pnpm --filter @cuberoot/client-next lint
# 旧 Vite (回滚兜底，不日常开):
pnpm --filter @cuberoot/client dev                 # http://127.0.0.1:5173/
```

> **重要:**
> 1. 日常用 `typecheck` (tsgo,native Go,3s 冷 / 1s 暖,Microsoft 官方 preview);怀疑 tsgo 漏报时用 `typecheck:tsc` (老 tsc -b)。**禁** `tsc --noEmit` 走根 tsconfig (references-only 壳,typo 静默过)。
> 2. **Dev server 永远在 `http://127.0.0.1:3000/` (Next) 或 `127.0.0.1:5173/` (Vite,兜底)**,不要 `pnpm dev`(端口占用立刻挂)。要验证用 playwright 直接开。
> 3. Windows Next dev 关窗口/Ctrl+C 可能留孤儿 node.exe (memory `feedback_windows_next_dev_restart`),改 globals/layout/next.config 看 chunk hash 是否变。
> 4. 磁盘不够 (worktree / pnpm install / build 失败时) 先 `df -h` 告诉我,别静默换方案。

- Next dev 绑定 `127.0.0.1` (Windows Chrome IPv6 解析问题)
- 本地 Next dev 调 `/v1/*` 走 next.config rewrites 反代 `https://api.cuberoot.me`,**本地开发不需要跑后端**
- `app/stats/[...slug]/route.ts` 和 `app/tools/[...slug]/route.ts` 是 dev 服仓库根 stats/tools/ 用的 catch-all (mirror Vite `serveRepoRoot` 插件),Vercel 上 fallback static.cuberoot.me
- **凭据展开**：给用户云服务器 / DB shell 命令时，从 `.password.md` 读真实密码直接嵌入，**不要写 `<password>` 占位**（`.password.md` 已 gitignore，不会进 repo；用户每次都得手动替换占位太烦）。命令本身不要 commit。
- **本地 PG**:docker `pg13`(5433 pwd `dev` db `cuberoot_db`,PG 13)。schema / load.sql 先本地验。

## 测试

- vitest 在 `@cuberoot/client-next`(CI 跑这个),跑 `pnpm --filter @cuberoot/client-next test`(全集)或 `test:watch`。测试全在 `packages/client-next/tests/`,源文件走 `@/` alias import(`vitest.config.ts` 配的)。退役的 `@cuberoot/client` 仍保留同一份测试作回滚兜底,但不进 CI
- **`tests/analyzer_worker.test.ts` 跑 ~225s**(占全集 99%,CFOP 分析器全空间枚举 53×7457×42664×21380)。只改它以外的东西用 `pnpm --filter @cuberoot/client-next exec vitest run <path>` 单跑;**禁** `pnpm --filter X test -- <path>`(pnpm 透传 `--` 会被 vitest 吞掉、跑全集)
- 测试统一放 `packages/client-next/tests/*.test.ts`(不与源码并排,避开 Next App Router 的 `app/` 路由目录),纯函数 / 算法回归同一套
- worker / 算法回归走 `tests/*.test.ts` + 一个 `_*_runner.cjs`(node:worker_threads + classic-worker globals shim),典型例子见 `tests/analyzer_worker.test.ts`
- 改 worker / kociemba / scramble 生成器 / utils 必须配一组 fixture 测试,改前先看现有 `tests/` 里同类怎么写
- CI 在 `.github/workflows/test.yml`,PR + push main 触发 typecheck + test
- 回归 baseline(如 analyzer fixed totals)用 `expect().toBe()` 锁住具体数值,改算法时**主动改 baseline 当作一种 review 信号**,而不是改宽容到 `toBeGreaterThan` 蒙混

## 代码风格

- 响应简洁，不加多余注释，不做超出需求的抽象
- 不新建文件除非必要，优先编辑已有文件
- 改完跑 `pnpm --filter @cuberoot/client-next typecheck`
- UI 不用 emoji，用 lucide-react 图标
- 不放页面级"返回"按钮，浏览器自带 back 即可（wizard 步骤间 / 模式切换不算）
- 选择型 / 搜索型输入框非空时必须显示 `×` 清除按钮：统一用 `components/ClearButton.tsx`（`variant='inline'` 浮在 input 内，`'standalone'` 流式独立圆），别再写一份局部 `.xxx-clear` CSS
- 切换器默认下拉，不堆 chip / tab；chip 仅当选项 ≤ 4 且需要左右对比时才用
- 全局固定按钮 (theme/lang/auth toggle) 跟内容容器右沿对齐,不贴视口:`right: max(16px, calc((100vw - <content-max-width>) / 2))`
- chip / tab / 下拉项上不显示数量计数（`(25)` / badge 之类一律不要）
- WCA 历史时间锚点：第 1 场比赛 1982-06-05（WC1982），第 2 场 2003-08-23~24（WC2003）；任何"时间序列展示"（折线 / 热力图 / 时间轴 / bar chart race）默认视图从 **2003-08-22** 起步（WC2003 前夜：第 0 帧 = 1982 那场的全部成绩快照，再往后才是 WCA 复办之后的逐日演化），但**统计聚合（总数 / 国家排行 / 项目场次等）必须包含 1982 那场**（用户没主动缩放时口径=全时段，不要把"默认视图≠全数据"的不一致带到数字上）
- 调试时不主动 `git log` / `git status`;删文件 / 配置前先确认
- 报根因 / "修好了" / "done" 前必须有实证(日志 / EXPLAIN ANALYZE / 实际 run 输出 / playwright);未证实的诊断显式标「假设」;性能 / 502 / OOM 类先 profile 取数,禁直接猜架构
- UI 验证走项目内 Playwright MCP;fixtures 跑全集别采样
- 新路由 / 新顶层 page 前先 grep routes config 防撞名

## 主题 / 颜色

写任何 CSS 色值 (背景 / 文字 / 边框 / hover) 前调 `theme-tokens` skill —— token 表 + dark-locked 页清单 + color-mix 衍生规则在那里。禁 `#888 #aaa` 等硬码灰阶。

## Skill 路由

主题命中 trigger 时主动调对应 skill,不要凭记忆。skill 描述 + triggers 已由 harness 自动加载,触发即可,**不要在此再列索引表**(双倍信息,白付 token)。
