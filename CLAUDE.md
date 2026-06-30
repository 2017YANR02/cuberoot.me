# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库布局

仓库 `RuiminYan/cuberoot.me`(自定义域名 `cuberoot.me`),同时托管：

1. **根目录** —— static.cuberoot.me 服的共享静态(`tools/` forks + `stats/` WCA JSON)+ 顶层 `solver/`/`fmc/`(Rust)+ 仓库基建(`ops/` `docs/` workflows)。早期 Vite build 残留 + GH Pages 镜像已于 2026-06-14 全部清除(GH Pages 站已禁用,DNS 本就不走它)。
2. **`core/`** — pnpm + Turbo monorepo，所有新开发都在这里：
   - `packages/client` — **React 19 + Next.js 16 (App Router, Turbopack)** ← **唯一前端工作区** (Phase 4 2026-05-27 切完;退役的 Vite `packages/client` + Capacitor 移动壳已于 2026-06-14 整包移除)
   - `packages/server` — Hono + **PostgreSQL 13**（WCA OAuth + recon + alg 公式库 + 训练数据，部署到云服务器;2026-05-06 从 MariaDB 迁过来,MariaDB 服务 + 数据已完整卸载)
   - `packages/shared` — 共享类型(`shared/src/alg.ts` 等);**公式数据全部在 PG `alg_sets/alg_cases` 两张表** (2026-05-06 从 JSON 迁过来),`loadAlg(puzzle, set)` 走 `/api/alg/sets/:p/:s` fetch
   - `packages/visualcube` — 自有 visualcube 封装;CI/server bundle 前必须先 build (`pnpm -F @cuberoot/visualcube build`,产 `dist/index.js`),否则 esbuild/Vercel build 找不到 export
   - `packages/stats-build` — WCA 统计生成管道（独立 CI 日更，stats.yml `cron 0 20 * * *`，跟 WCA dump 上游天更）
3. **`solver/`** — 顶层(pnpm workspace 外,非 package)。魔方求解引擎(Rust,2026-05-31 从已退役的 cube-solver-rust 导入,monorepo 为唯一源)。产 native 分析器喂 `/scramble/*` 数据管道(`update_cross_stats.ps1` 的 `$SolverDir` 指这)+ 编 WASM 给浏览器端。`target/ tables/(~34GB) pkg-web/ pkg-node/` 本地 gitignored(只本机有,repo/CI/线上都没有)。

## 12 个模块的归属（重要）

首页(`app/[lang]/page.tsx` 渲染 `components/LandingPage`)列出多入口。部分 fork 不能改:

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态 HTML(只本机 nginx serve,Vercel 上走 `tools/[...slug]` 反代 static.cuberoot.me) | fork of [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) | ❌ upstream |
| Alg Trainer | `/alg-trainers` | 根目录静态 HTML(同上) | fork of [mihlefeld/Alg-Trainers](https://github.com/mihlefeld/Alg-Trainers) | ❌ upstream |
| csTimer | `/cstimer` | iframe → `/tools/cstimer/`(同上 fallback) | integrated from [cs0x7f/cstimer](https://github.com/cs0x7f/cstimer) | ❌ upstream |
| WCA Stats（数据管道） | `/wca` | `core/packages/stats-build` | 基于 [jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics) 的 TS 重写 | ⚠️ 管道已重写，UI 自有 |
| Score Calculator (HTH) | `/calc` | `core/packages/client/app/[lang]/calc/` | ported from [carykh/hthgrapher](https://github.com/carykh/hthgrapher) | ✅ |
| 1v1 Battle | `/battle` | `core/packages/client/app/[lang]/battle/` | ported from [MatteoColombo/cube_challenge_timer](https://github.com/MatteoColombo/cube_challenge_timer) | ✅ |
| Recon | `/recon` | `core/packages/client/app/[lang]/recon/` | 自有 | ✅ |
| Trainer（公式计时训练，全 41 套） | `/trainer` | `core/packages/client/app/[lang]/trainer/` | 自有 | ✅ |
| Recognize（PLL 识别训练，看图答字母） | `/recognize/pll` | `core/packages/client/app/[lang]/recognize/[algSetId]/` | 自有 | ✅ |
| Frame Count | `/frame-count` | `core/packages/client/app/[lang]/frame-count/` | 自有（WebCodecs + mp4box.js） | ✅ |
| Distribution | `/wca/viz` | `core/packages/client/app/[lang]/wca/viz/` | 自有 | ✅ |
| Comp (比赛中心:搜索/日历/地球/实时成绩) | `/wca/comp` | `core/packages/client/app/[lang]/wca/comp/` | 自有 | ✅ |
| Scramble（打乱难度 / 长度分布） | `/scramble/stats` | `core/packages/client/app/[lang]/scramble/stats/` + 数据 `stats/scramble/*.json`（长度走 CI 日更 `build_scramble_lengths.ts`） | 自有 | ✅ |
| Mosaic（魔方马赛克生成） | `/mosaic` | `core/packages/client/app/[lang]/mosaic/` | ported from [Roman-/mosaic](https://github.com/Roman-/mosaic) | ✅ |
| Blog | `blog.cuberoot.me`(`/blog` redirect 过去) | 独立 repo `RuiminYan/cuberoot-blog` | 外部托管 | — |

改 upstream 模块前先问用户；要改就只改 fork 后新增/包装的部分。**前端只有 client 一个工作区**。

## 部署拓扑 (Phase 4 后 — 2026-05-27)

> **push = 上线(默认别 push)**:`git push origin main` 会让 Vercel + 服务器**立刻自动重建上线**;`git commit` 只是本地(免费、不部署、多 AI 共仓也能互见)。**默认只 commit + 本地验证(dev/typecheck/test/Playwright),不 push**。仅这些情形才 push,且**先告知用户**:① 用户明说上线 / push;② DB 迁移要在线上库生效(本地能测,线上只在服务器部署重启时自动 apply);③ 改 nginx / systemd / 服务器 env / 后端 API 行为(仅生产存在,本地无等价);④ bug 只在生产复现需部署验证;⑤ 线上正坏的紧急修。普通功能 / bug / 重构 / UI / 文案做完 commit 即停,攒着等用户说上线。

- **主域 `cuberoot.me` / `www.cuberoot.me`** 走 **DNS 分线路** (provider 自带分流):
  - 一条线路 → 自有服务器 IP → nginx `proxy_pass 127.0.0.1:3002` → systemd `cuberoot-next` (Next standalone)。vhost `ops/nginx/www.cuberoot.me.conf`,改 nginx 走 `deploy_nginx.yml`(scp + `nginx -t` + reload + 失败回滚 .bak)。
  - 另一条线路 → Vercel Hobby `cuberoot-me` project → 同一份 Next 代码 + Vercel edge。Vercel 自动从 GitHub main 跑 build,部署是 push-triggered。
- **`static.cuberoot.me`** — 自有服务器 nginx 独立 vhost,只服 `/www/wwwroot/toolkit/{tools,stats}/`(forks 静态资源 + WCA stats JSON),CORS:* 给 Vercel function fallback。2026-05-27 替代退役的 `vite.cuberoot.me`。
- **`next.cuberoot.me`** — 同一套 systemd `cuberoot-next` 反代 :3002,作 staging 子域 / 别名。
- **systemd Next standalone 部署**:`deploy_next.yml`(push `core/packages/{client,shared,visualcube}/**` 触发) CI build → tar `.next/standalone/`(自带 node_modules) → scp → 服务器原子换 `/www/wwwroot/toolkit-next/` + 健康检查 :3002,挂了自动回滚 .bak。`start.sh` 包装定位 standalone entry,systemd unit 在 `ops/systemd/cuberoot-next.service`。
- **Vercel build 特殊处理**:`next.config.ts` 用 `VERCEL=1` env gate,Vercel 上跳过 `output: standalone` + `outputFileTracingRoot`(否则 vercel/next.js#88579 撞 manifest ENOENT)。`app/stats/[...slug]/route.ts` 和 `app/tools/[...slug]/route.ts` 在 Vercel 上 fallback 拉 `static.cuberoot.me/{stats,tools}/*`(stats 数据 + forks 没打进 Vercel bundle,CORS 已开)。
- **Vercel CLI 已装本机**(`ruiminyan` 登录态):`vercel logs https://www.cuberoot.me` 拉最近 100 条 function log,`| grep ' 5[0-9]{2} '` 过 5xx。用户报"vercel 报错"直接 CLI 自查,免截图。详见 memory `project_vercel_deployment`。
- **CORS allowlist** 在 `core/packages/server/src/index.ts`,函数形式放行 `*.vercel.app`(Vercel preview 每 PR 一个 URL)+ 主域 + `next.cuberoot.me`。
- **后端 API**:Hono 服 `api.cuberoot.me`(同一台自有服务器,nginx 反代到 127.0.0.1:3001)。
- **Blog (`/blog/` + `blog.cuberoot.me`)**:独立 `cuberoot-blog` repo 静态归档,blog.cuberoot.me 双轨(自有 nginx alias / GH Pages)按 DNS 分线路。主域 `/blog` 走 next.config.ts redirect → blog.cuberoot.me。详 memory `reference_blog_subdomain`。
- 前端调 API **必须**用 `utils/api_base.ts` 的 `apiUrl()`(client 在 `lib/api-base.ts`),不要硬编码 origin。
- **API 缓存头分层**:可变数据端点浏览器层 `max-age≤3600`,长缓存只给 nginx 用 `s-maxage`;空/暂态 payload 发 `no-store`;改响应 shape 必须 bump fetch URL 的 `v=` 参数。仅天然不可变数据(已结束比赛/确定性计算)可浏览器长缓存。CI 守卫 `tests/server-cache-headers.test.ts`。
- `/stats/*.json` fetch 走 `statsUrl()`(`lib/stats-base.ts` / `shared/src/api/stats-base.ts`),别写相对路径(Vercel 上相对 `/stats/*` 多一跳 307,白吃 edge request)。
- **Pattern B 英文落裸地址**(2026-06-08):英文走裸 URL,中文走 `/zh`;裸路径 proxy rewrite 到 `/en`(零跳转),中文环境裸→307→`/zh`;无 MIGRATED_PATHS 白名单,新路由免登记。内部 `<Link>` 用 `components/AppLink`(en 出裸、zh 补 `/zh`),别裸 `next/link`;非 Link 导航(`router.push`/服务端 `redirect`/raw `<a>`)手动 `${lang==='zh'?'/zh':''}` 前缀,别硬编码 `/${lang}`。
- 切 dev/prod API base 永远用 `import.meta.env.DEV`,**禁** `hostname === 'localhost'` 检查 — LAN IP / 隧道域名(dev.cuberoot.me)都不匹配,会错走 prod 跨域被 CORS 拦死。`shared/` 包不能 import client utils,直接 `(import.meta as { env?: { DEV?: boolean } }).env?.DEV`。
- **COOP/COEP (cubeopt-wasm SAB)**:仅 `/scramble/solver` 在 Next config `headers()` 发(Phase 4 缩到只 solver — analyzer 用 classic worker COEP 会拦死)。nginx vhost 顶 `map $request_uri` 同样匹配 `/scramble/(solver|analyzer)`(历史保留,实际 Next 自己也发)。新增 SAB 页面同步改两处。
- **client 页面默认 SSG**(2026-05-28 起,~128 组静态走 CDN):根 `app/layout.tsx` 禁动态 API(cookies/headers),全局组件禁在 render 调 `useSearchParams`,否则整站退回动态 / CSR 空壳;语言归属在 `[lang]/layout`,i18n 走 `initImmediate:false` + `useSuspense:false`。
- **省 Vercel 配额(写页/链接默认遵守)**:① 高基数 / 响应式 href / 离开本页的 `<Link>` 必 `prefetch={false}`(预取只省导航延迟、不影响页面加载;Next 默认全量预取会爆 Edge Request,实测占大头)。② 无 SEO 价值的动态 `[param]` 页(编辑表单 / 纯客户端详情壳)走 persons 式静态哨兵壳:`dynamicParams=false` + `generateStaticParams` 返 `['_']` + next.config beforeFiles rewrite `/:lang(en|zh)/x/:id→/:lang/x/_` + client 从 `window.location` 读真 id,别按 id SSR(否则每 id 一次 Function 渲染)。③ `public/` 大资产(wasm / 字体 / 图)必设 `Cache-Control`,别留默认 `max-age=0`(每次 304 = 1 Edge Request);analyzer worker 资产禁发 COEP。④ 取证:`/www/wwwlogs/www.cuberoot.me.log` 有全 IP+UA(`_rsc=` = Link 预取),Vercel json log 无 IP/UA。详见 memory `project_vercel_edge_requests_optimization`。
## 开发命令

包管理用 **pnpm 11**（不是 npm）。Windows 下按全局规则用 `pwsh`。

**CWD 前提**:用户启动 Claude Code 前已 `cd D:\cube\cuberoot.me\core`(pnpm workspace 根)。所有 pnpm 命令直接跑。若 `pnpm install` 报 `ERR_PNPM_NO_PKG_MANIFEST` = CWD 在仓库根了,用 PowerShell tool `Set-Location core` 一次(别用 Bash tool 写 Windows 反斜杠路径,会被吞)。

```bash
pnpm install
pnpm --filter @cuberoot/client dev            # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client typecheck      # tsgo (native Go port，~3s 冷 / ~1.2s 暖)
pnpm --filter @cuberoot/client typecheck:tsc  # tsc -b incremental
pnpm --filter @cuberoot/client build          # 会自动 prebuild @cuberoot/shared + visualcube
pnpm --filter @cuberoot/client lint
```

> **重要:**
> 1. 日常用 `typecheck` (tsgo,native Go,3s 冷 / 1s 暖,Microsoft 官方 preview);怀疑 tsgo 漏报时用 `typecheck:tsc` (老 tsc -b)。**禁** `tsc --noEmit` 走根 tsconfig (references-only 壳,typo 静默过)。
> 2. **Dev server 永远在 `http://127.0.0.1:3000/` (Next)**,不要 `pnpm dev`(端口占用立刻挂)。要验证用 playwright 直接开。
> 3. Windows Next dev 关窗口/Ctrl+C 可能留孤儿 node.exe (memory `feedback_windows_next_dev_restart`),改 globals/layout/next.config 看 chunk hash 是否变。
> 4. 磁盘不够 (worktree / pnpm install / build 失败时) 先 `df -h` 告诉我,别静默换方案。
> 5. **dev 在跑时禁本地 `next build`**:build 和 dev 共用 `.next/`,并发写撕裂 manifest JSON → 全站 500。验证走 `typecheck`(不碰 `.next/`),真要本地 build 先停 dev。已有 PreToolUse hook (`.claude/hooks/block-next-build-while-dev.ps1`) 在 dev 活着时硬拦 build;坏了删 `.next` 重启即恢复。

- Next dev 绑定 `127.0.0.1` (Windows Chrome IPv6 解析问题)
- 本地 Next dev 调 `/v1/*` 走 next.config rewrites 反代 `https://api.cuberoot.me`,**本地开发不需要跑后端**
- `app/stats/[...slug]/route.ts` 和 `app/tools/[...slug]/route.ts` 是 dev 服仓库根 stats/tools/ 用的 catch-all,Vercel 上 fallback static.cuberoot.me
- **凭据展开**：给用户云服务器 / DB shell 命令时，从 `.password.md` 读真实密码直接嵌入，**不要写 `<password>` 占位**（`.password.md` 已 gitignore，不会进 repo；用户每次都得手动替换占位太烦）。命令本身不要 commit。
- **本地 PG**:docker `pg13`(5433 pwd `dev` db `cuberoot_db`,PG 13)。schema / load.sql 先本地验。

## 测试

- vitest 在 `@cuberoot/client`(CI 跑这个),跑 `pnpm --filter @cuberoot/client test`(全集)或 `test:watch`。测试全在 `packages/client/tests/`,源文件走 `@/` alias import(`vitest.config.ts` 配的)
- **`tests/analyzer_worker.test.ts` 跑 ~225s**(占全集 99%,CFOP 分析器全空间枚举 53×7457×42664×21380)。只改它以外的东西用 `pnpm --filter @cuberoot/client exec vitest run <path>` 单跑;**禁** `pnpm --filter X test -- <path>`(pnpm 透传 `--` 会被 vitest 吞掉、跑全集)
- 测试统一放 `packages/client/tests/*.test.ts`(不与源码并排,避开 Next App Router 的 `app/` 路由目录),纯函数 / 算法回归同一套
- worker / 算法回归走 `tests/*.test.ts` + 一个 `_*_runner.cjs`(node:worker_threads + classic-worker globals shim),典型例子见 `tests/analyzer_worker.test.ts`
- 改 worker / kociemba / scramble 生成器 / utils 必须配一组 fixture 测试,改前先看现有 `tests/` 里同类怎么写
- CI 在 `.github/workflows/test.yml`,PR + push main 触发 typecheck + test
- 回归 baseline(如 analyzer fixed totals)用 `expect().toBe()` 锁住具体数值,改算法时**主动改 baseline 当作一种 review 信号**,而不是改宽容到 `toBeGreaterThan` 蒙混

## 代码风格

- 响应简洁，不加多余注释，不做超出需求的抽象
- 不新建文件除非必要，优先编辑已有文件
- 改完跑 `pnpm --filter @cuberoot/client typecheck`
- UI 不用 emoji，用 lucide-react 图标
- 不放页面级"返回"按钮，浏览器自带 back 即可（wizard 步骤间 / 模式切换不算）
- 按钮式交互（选择/开关/点击单元）必须真 `<button>`（剥 UA 样式 `appearance:none;background:none;border:none;font:inherit`）或 `AppLink`，禁 `<div/span onClick>` 当按钮：iOS Safari 不可靠把 tap 合成 click，`cursor:pointer` 也救不了（点不动 + `:hover` 灰色伪装选中）。例外 div 须加 `role="button"`+`tabIndex`+`onKeyDown`。双守卫：写入即拦 hook `block-static-onclick-button.ps1` + CI `tests/no-static-element-onclick-button.test.ts`（ratchet，只降不升）；豁免加行内注释 `allow-static-onclick`
- 选择型 / 搜索型输入框非空时必须显示 `×` 清除按钮：统一用 `components/ClearButton.tsx`（`variant='inline'` 浮在 input 内，`'standalone'` 流式独立圆），别再写一份局部 `.xxx-clear` CSS
- 切换器默认下拉，不堆 chip / tab；chip 仅当选项 ≤ 4 且需要左右对比时才用
- 布尔开关(开/关单个东西)用 `components/BoolToggle`(左滑钮 + 右文字);二选一(A/B 各有义)用 `PillToggle` 文字内嵌、主/默认项置绿(onLabel)。禁裸 `<input type="checkbox">`(☑),多选网格特例行内注释 `allow-checkbox: <理由>`。双守卫:hook `block-raw-checkbox.ps1` + CI `tests/no-raw-checkbox.test.ts`(ratchet)
- 表头排序指示一律 `components/SortArrow`(↑/↓ 在表头文字**右侧**、仅当前排序列显示);禁 `ChevronsUpDown` / `ChevronUp/Down` 自造排序箭头。CI `tests/sort-arrow-unified.test.ts`
- 下拉 / 菜单宽度贴合内容(`width: fit-content`,别钉 `min-width` 把短选项拉成长条);column flex 里加 `align-self: flex-start` 防 stretch
- 大型 / 可滚动统计表的列头吸顶(滚动时表头悬浮)走共用 `components/sticky-table.css`：外层容器加 `.sticky-scroll` + `<table>` 加 `.sticky-thead`,禁各页手写 `position:sticky` thead;契约见文件头注(th 须不透明背景 + wrapper 原 `overflow-x:auto` 改 `:not(.sticky-scroll)` + 下划线色用 `--sticky-thead-border`)
- 新建可复用组件后，在 `/code/components` 组件库登记一条（改 `app/[lang]/code/components/_catalog.tsx`，自包含的顺手写个实时 Demo）；新建可复用 hook / 工具函数同理登记到 `/code/utils`（改 `app/[lang]/code/utils/_catalog.tsx`），方便人 / AI 查阅复用。CI 守卫：`tests/code-catalog-sync.test.ts`（hooks 必登记 + catalog import 路径必须真实存在）、`tests/code-tokens-drift.test.ts`（设计令牌页 `tokens/_tokens.ts` 必须跟 `globals.css` 一致），漏登记 / 改了不同步直接红
- 全局固定按钮 (theme/lang/auth toggle) 跟内容容器右沿对齐,不贴视口:`right: max(16px, calc((100vw - <content-max-width>) / 2))`
- chip / tab / 下拉项上不显示数量计数（`(25)` / badge 之类一律不要）
- WCA 历史时间锚点：第 1 场比赛 1982-06-05（WC1982），第 2 场 2003-08-23~24（WC2003）；任何"时间序列展示"（折线 / 热力图 / 时间轴 / bar chart race）默认视图从 **2003-08-22** 起步（WC2003 前夜：第 0 帧 = 1982 那场的全部成绩快照，再往后才是 WCA 复办之后的逐日演化），但**统计聚合（总数 / 国家排行 / 项目场次等）必须包含 1982 那场**（用户没主动缩放时口径=全时段，不要把"默认视图≠全数据"的不一致带到数字上）
- 调试时不主动 `git log` / `git status`;删文件 / 配置前先确认
- 报根因 / "修好了" / "done" 前必须有实证(日志 / EXPLAIN ANALYZE / 实际 run 输出 / playwright);未证实的诊断显式标「假设」;性能 / 502 / OOM 类先 profile 取数,禁直接猜架构
- UI 验证走项目内 Playwright MCP;fixtures 跑全集别采样
- 新路由 / 新顶层 page 前先 grep routes config 防撞名
- 路由重命名 / 合并后旧路径直接弃用,不为老链接加 redirect(老 URL 404 可接受)

## URL 状态 / 后退导航(全站统一 nuqs)

页内状态进 URL 一律 `nuqs` 的 `useQueryState`,**禁裸 `history.pushState/replaceState` + 手写 `popstate`**(maplibre/canvas/video 等重组件例外,加注释豁免)。后退/前进由 nuqs 自动同步,不手写监听。
- 大视图 / 大 tab / 大 mode / 打开全屏浮层 → `.withOptions({ history: 'push' })`(后退能返回)
- 筛选 / 排序 / 搜索词 / 子开关 → 默认 replace(不堆历史,后退跳过)
- 默认值 `.withDefault(x)` 自动从 URL 省略(clearOnDefault v2 默认开);枚举用 `parseAsStringEnum`
- 沉浸浮层的返回件用 `history.back()`,`history.length<=1`(深链直进)时 fallback 硬导航父路由
- `NuqsAdapter` 已挂 root layout(经 `components/AppNuqsAdapter.tsx` client 包装);`useQueryState` 只在页级 client 组件用,禁进全局 chrome(同 useSearchParams 的 SSG 约束)
- 想重排 query key 顺序(把某 key 钉最前等):nuqs `set()` 只原地更新/末尾追加,**别裸 `history`**,走 `AppNuqsAdapter` 的 `processUrlSearchParams`(每次写 URL 前后处理 searchParams,已用它把 `puzzle` 钉首)
- 范本:`app/[lang]/wca/comp/page.tsx` 的 `viewMode`
- CI 守卫:`tests/url-state-no-raw-history.test.ts`(vitest,CI 跑 vitest 不跑 eslint)禁裸 history.*/popstate;确属特殊(zustand data-blob / 自定义编码 / 全局 infra)才豁免:加进该测试 ALLOWLIST + 文件内 `// eslint-disable-next-line no-restricted-syntax, no-restricted-globals` + 理由

## 主题 / 颜色

写任何 CSS 色值 (背景 / 文字 / 边框 / hover) 前调 `theme-tokens` skill —— token 表 + dark-locked 页清单 + color-mix 衍生规则在那里。禁 `#888 #aaa` 等硬码灰阶。

## 繁体字(zh-Hant)已移除

2026-06-14 起全站只服 **en + zh-Hans(简体)**,繁体彻底移除(生成器 / `zh-Hant.json` / `zhHant` 字段 / `i18n.language==='zh-Hant'` 分支全删)。**源码禁写任何繁体字**,双层守卫:写入即拦 PreToolUse hook `.claude/hooks/block-handwritten-trad.ps1`(→ `scripts/hook-detect-traditional.mjs`)+ CI `tests/i18n-removal-guard.test.ts`(无繁体字形 / 无 `zhHant` 标识符 / en.json↔zh.json key 对齐)。文案走 `tr({en,zh})` / `<T en zh/>` / `useT()` 的 `t(zh,en)`;长文 / 复用走 `t()` + `en.json`/`zh.json`。HTML lang 用 `en` / `zh-Hans`。**禁内联 `isZh`/`i18n.language` 文案三元**(`isZh ? '中' : 'EN'` 一类):双守卫 hook `hook-detect-traditional.mjs` + CI ratchet `tests/i18n-no-isz-text-ternary.test.ts`(计数只降不升);`isZh` 仅可作 util 函数参数。细则调 skill `i18n`。

## Skill 路由

主题命中 trigger 时主动调对应 skill,不要凭记忆。skill 描述 + triggers 已由 harness 自动加载,触发即可,**不要在此再列索引表**(双倍信息,白付 token)。

## 造求解器 loop

`/loop 继续造求解器`(或"造求解器")= 读 `solver/SOLVER_LOOP.md` 全文,按 §0 LOOP PROTOCOL 推进 §1 backlog 下一个未完成单元;规则/backlog/进度全在那文件,别在此展开。

## 造 SQ1 最优求解器 loop

`/loop 继续造 SQ1 最优求解器`(或"造 SQ1 最优""SQ1 WCA loop")= 读 `solver/SQ1_WCA_LOOP.md` + `solver/SQ1_WCA_GODS_NUMBER.md` 全文,按前者 §0 协议推进 §1 backlog;终极目标=SQ1 WCA 12c4 最优求解器 + 算出 `D_WCA`;允许 ≤15GB 大表、严禁 OOM、线程 12/14;规则/backlog/进度/坑全在那两文件,别在此展开。

## 造非 WCA 小魔方求解器 loop

`/loop 继续造小魔方求解器`(或"造非 WCA 求解器""继续造 puzzle 求解器")= 读 `solver/NONWCA_PUZZLE_LOOP.md` 全文,按 §0 协议推进 §1 backlog;纯 TS 路线(Ivy 范式,**非** Rust),给 `/scramble/gen` 非 WCA 魔方依次造求解器,能最优就最优、否则近最优;分档(A 现场 BFS / B 预算表 / C 单实例 IDA* / D 近最优)+ backlog + 进度全在那文件,TIER D 前有 soft-gate,别在此展开。
