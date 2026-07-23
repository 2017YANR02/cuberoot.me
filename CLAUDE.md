# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库布局

仓库 `2017YANR02/cuberoot.me`(域名 `cuberoot.me`):

1. **根目录** — static.cuberoot.me 服的共享静态(`tools/` forks + `stats/` WCA JSON)+ 仓库基建(`ops/` `docs/` workflows)。
2. **`core/`** — pnpm + Turbo monorepo,所有新开发在这里:
   - `packages/client` — React 19 + Next.js 16(App Router)← **唯一前端工作区**
   - `packages/server` — Hono + PostgreSQL 13(WCA OAuth + recon + alg 库,部署云服务器)
   - `packages/shared` — 共享类型;公式数据在 PG `alg_sets/alg_cases`,`loadAlg` 走 `/api/alg/sets/:p/:s`
   - `packages/visualcube` — 自有封装;CI/server bundle 前必须先 `pnpm -F @cuberoot/visualcube build`
   - `packages/stats-build` — WCA 统计管道(stats.yml 日更 cron)
3. **`solver/`** — workspace 外,Rust 求解引擎:产 native 分析器喂 `/scramble/*`(`update_cross_stats.ps1` 的 `$SolverDir`)+ 编 WASM。`target/ tables/(~34GB) pkg-*` 只本机有。
4. **`reconer/`** — workspace 外,速拧视频自动复盘。TS 流水线自带 package.json(reconer/ 里 `pnpm test`/`pnpm typecheck`);Python 链冻结;`videos/` 只本机。背景必读 `reconer/CLAUDE.md`/`roadmap.md`。

## 模块归属(fork 不能改)

| 模块 | 路由 | 位置 | 来源 | 可改? |
|------|------|------|------|-------|
| Solver | `/solver` | 根目录静态(Vercel 走 `tools/[...slug]` 反代) | fork of or18/RubiksSolverDemo | ❌ |
| Alg Trainer | `/alg-trainers` | 同上 | fork of mihlefeld/Alg-Trainers | ❌ |
| csTimer | `/cstimer` | iframe → `/tools/cstimer/` | cs0x7f/cstimer | ❌ |
| WCA Stats | `/wca` | `packages/stats-build` | jonatanklosko/wca_statistics TS 重写 | ⚠️ 管道重写,UI 自有 |
| Score Calculator | `/calc` | client `app/[lang]/calc/` | ported from carykh/hthgrapher | ✅ |
| 1v1 Battle | `/battle` | client | ported from MatteoColombo/cube_challenge_timer | ✅ |
| Recon | `/recon` | client | 自有 | ✅ |
| Trainer | `/alg`(公式库内,`/alg/:p/:s/select` + `/alg/{3bld,roux,skewb-trainer}`) | client | 自有 | ✅ |
| Recognize | `/recognize/pll` | client | 自有 | ✅ |
| Frame Count | `/frame-count` | client | 自有 | ✅ |
| Distribution | `/wca/viz` | client | 自有 | ✅ |
| Comp 比赛中心 | `/wca/comp` | client | 自有 | ✅ |
| Scramble | `/scramble/stats` | client + `stats/scramble/*.json` | 自有 | ✅ |
| Mosaic | `/mosaic` | client | ported from Roman-/mosaic | ✅ |
| Blog | blog.cuberoot.me | 独立 repo `cuberoot-blog` | 外部 | — |

改 upstream 模块先问用户;要改只改 fork 后新增/包装部分。

## 部署

> **push = 上线(默认只 commit 不 push)**:push 即触发 Vercel + 服务器自动重建。仅以下情形 push 且先告知用户:①用户明说;②DB 迁移需线上生效;③改 nginx/systemd/服务器 env/后端 API;④bug 仅生产复现;⑤线上紧急修。

- 主域 DNS 分线路:一路自有服务器 nginx→127.0.0.1:3002(systemd `cuberoot-next`;vhost `ops/nginx/`,改 nginx 走 `deploy_nginx.yml`);一路 Vercel(push 自动 build)。
- `static.cuberoot.me`:服 `{tools,stats}/`,CORS:*。`next.cuberoot.me`:staging 别名,同 :3002。
- Next standalone:`deploy_next.yml`(push client/shared/visualcube 触发)CI build→scp→原子换+健康检查+失败回滚;unit `ops/systemd/cuberoot-next.service`。
- Vercel 用 `VERCEL=1` gate 跳过 standalone;`app/{stats,tools}/[...slug]/route.ts` 在 Vercel fallback 拉 static.cuberoot.me。
- Vercel CLI 本机已登录:`vercel logs https://www.cuberoot.me` 自查 5xx,免截图。
- CORS allowlist:server `src/index.ts`,函数式放行 `*.vercel.app` + 主域。
- 后端 Hono 服 api.cuberoot.me(nginx→127.0.0.1:3001)。
- DB 迁移随 push 自动跑(`deploy_core.yml` reload 前 `apply_migrations.sh`),禁说要手动 ssh。
- 主域 `/blog` redirect → blog.cuberoot.me(独立 repo)。
- 前端调 API 必用 `apiUrl()`(client `lib/api-base.ts`),禁硬编码 origin;`/stats/*.json` 走 `statsUrl()`,禁相对路径。
- API 缓存头:可变数据浏览器 `max-age≤3600`,长缓存只给 nginx `s-maxage`;空/暂态 `no-store`;改响应 shape 必 bump `v=`。CI `tests/server-cache-headers.test.ts`。
- Pattern B:英文裸 URL,中文 `/zh`;内部链接用 `components/AppLink`;非 Link 导航手动 `${lang==='zh'?'/zh':''}`,禁硬编码 `/${lang}`;新路由免登记。
- dev/prod API base 用 `import.meta.env.DEV`,禁 `hostname==='localhost'` 判断(LAN/隧道域名会错走 prod 被 CORS 拦)。
- COOP/COEP 仅 `/scramble/solver` 发;Next `headers()` 与 nginx map 两处同步改。
- client 页面默认 SSG:根 layout 禁动态 API(cookies/headers),全局组件禁 render 调 `useSearchParams`;语言归属在 `[lang]/layout`。
- 省 Vercel 配额:①高基数/响应式 href/离开本页的 `<Link>` 必 `prefetch={false}`;②无 SEO 的动态 `[param]` 页走静态哨兵壳(`dynamicParams=false` + `generateStaticParams` 返 `['_']` + beforeFiles rewrite + client 读 `window.location`);③`public/` 大资产必设 `Cache-Control`;④取证看 `/www/wwwlogs/www.cuberoot.me.log`(全 IP+UA)。

## 开发命令

pnpm 11,pwsh。CWD 已在 `core/`;`pnpm install` 报 `ERR_PNPM_NO_PKG_MANIFEST` = 在仓库根,`Set-Location core`。

- shell 路径相对 `core/` 写(`packages/...`),禁加 `core/` 前缀(会变 `core/core/`)。含 `[lang]` 等方括号的路径一律单引号,必要时 `git add ':(literal)packages/.../[lang]/x.tsx'`。

```bash
pnpm --filter @cuberoot/client dev            # http://127.0.0.1:3000/
pnpm --filter @cuberoot/client typecheck      # tsgo,日常用这个
pnpm --filter @cuberoot/client typecheck:tsc  # 怀疑 tsgo 漏报时
pnpm --filter @cuberoot/client build
pnpm --filter @cuberoot/client lint
```

- 禁 `tsc --noEmit` 走根 tsconfig(references-only 壳,typo 静默过)。
- dev server 常驻 `http://127.0.0.1:3000/`(绑 127.0.0.1),别再 `pnpm dev`(端口占用即挂);验证用 playwright 直接开。Windows 关窗可能留孤儿 node,改 globals/layout/config 看 chunk hash 是否变。
- **dev 在跑时禁本地 `next build`**(共用 `.next/` 撕裂 manifest → 全站 500;PreToolUse hook 硬拦;坏了删 `.next` 重启)。验证走 `typecheck`。
- 本地 dev 调 `/v1/*` 走 rewrites 反代线上 api,不需要跑后端。
- 磁盘不够先 `df -h` 告诉我,别静默换方案。
- 凭据:给用户服务器/DB 命令时从 `.password.md`(gitignored)读真实密码嵌入,不写 `<password>` 占位;命令不 commit。
- 本地 PG:docker `pg13`(5433,pwd `dev`,db `cuberoot_db`);schema/load.sql 先本地验。
- 本地改某域 DB 数据并预览:`seed:local <表>` 拉那域的表进 pg13 + `dev:local` 跑本地 API + `$env:LOCAL_DOMAINS='<域>'` 起前端(只该域走本地,登录/别的域/WCA 大表仍反代线上);禁默认全局连本地。范本 alg,详 `packages/server/scripts/README.md`。

## 测试

- `pnpm --filter @cuberoot/client test` 全集;单文件 `pnpm --filter @cuberoot/client exec vitest run <path>`(**禁** `test -- <path>`,pnpm 透传会被 vitest 吞、跑全集)。
- `tests/analyzer_worker.test.ts` ~225s(占全集 99%),只改别处就单跑其它文件。
- 测试统一 `packages/client/tests/*.test.ts`(不与源码并排),源文件 `@/` alias import。
- 改 worker/kociemba/scramble 生成器/utils 必配 fixture 测试,先看同类怎么写;worker 回归走 `_*_runner.cjs` 模式(见 `tests/analyzer_worker.test.ts`)。
- 回归 baseline 用 `toBe()` 锁数值,改算法主动改 baseline 当 review 信号,禁放宽成 `toBeGreaterThan`。
- CI `.github/workflows/test.yml`(PR + push main:typecheck + test)。

## 代码风格

- 优先编辑已有文件;改完跑 typecheck。
- 改动先定位根因,禁止在症状点打补丁;根因定位后落地用最小实现,不臆造抽象层/翻译层。
- UI 可用 lucide-react;不放页面级"返回"按钮(wizard 步骤间不算)。
- 按钮式交互必须真 `<button>`(剥 UA 样式)或 `AppLink`,禁 `<div/span onClick>`(iOS Safari tap 不可靠);例外 div 加 `role="button"`+`tabIndex`+`onKeyDown`;豁免注释 `allow-static-onclick`。守卫:hook + CI ratchet。
- 选择/搜索输入框非空时显示清除按钮,统一 `components/ClearButton`。
- 切换器默认下拉;chip 仅当选项 ≤4 且需左右对比。
- 布尔开关用 `BoolToggle`,二选一用 `PillToggle`(主项置绿);禁裸 checkbox,特例注释 `allow-checkbox: <理由>`。守卫:hook + CI ratchet。
- 表头排序一律 `components/SortArrow`(文字右侧,仅当前列显示)。CI 守卫。
- 下拉/菜单宽度 fit-content,column flex 加 `align-self:flex-start`;禁钉 `min-width`。
- 锚定下拉面板(absolute + top:100%)必挂 `hooks/usePanelClamp` 钳视口,CSS 注明 `anchored-panel: clamped`;确证安全注明 `anchored-panel: safe (<理由>)`。守卫:hook + CI ratchet;实测 `audit:overflow` popup pass。
- 吸顶表头走 `components/sticky-table.css`(`.sticky-scroll` + `.sticky-thead`),禁手写 sticky thead;契约见文件头注。
- 新可复用组件/hook 登记 `/code` catalog(`_catalog.tsx`)。CI 守卫:`code-catalog-sync` + `code-tokens-drift`。
- 全局固定按钮对齐内容右沿:`right: max(16px, calc((100vw - <content-max-width>) / 2))`。
- chip/tab/下拉项不显示数量计数。
- WCA 时间锚点:时间序列默认视图从 2003-08-22 起步(第 0 帧 = 1982 快照),统计聚合必含 1982 场。
- 调试不主动 `git log`/`git status`;删文件/配置先确认。
- 报根因/"修好了"/done 前必须实证(日志/EXPLAIN/run 输出/playwright);未证实标「假设」;性能/502/OOM 先 profile 禁猜。
- UI 验证走项目内 Playwright MCP;fixtures 全集别采样。
- 新路由先 grep 防撞名;路由改名/合并不为旧路径加 redirect。

## URL 状态(全站统一 nuqs)

- 页内状态进 URL 一律 `useQueryState`,禁裸 `history.pushState/replaceState` + 手写 `popstate`(maplibre/canvas/video 重组件例外加注释豁免)。CI `tests/url-state-no-raw-history.test.ts`(豁免加 ALLOWLIST + eslint-disable + 理由)。
- 大视图/大 tab/全屏浮层 → `.withOptions({ history: 'push' })`;筛选/排序/搜索 → 默认 replace;默认值 `.withDefault(x)`;枚举 `parseAsStringEnum`。
- 沉浸浮层返回用 `history.back()`,`history.length<=1` fallback 硬导航父路由。
- `useQueryState` 只在页级 client 组件用,禁进全局 chrome;重排 query key 顺序走 `AppNuqsAdapter` 的 `processUrlSearchParams`。
- 范本:`app/[lang]/wca/comp/page.tsx` 的 `viewMode`。

## 主题/颜色

写任何 CSS 色值前调 `theme-tokens` skill(token 表 + dark-locked 页清单 + color-mix 规则);禁 `#888 #aaa` 等硬码灰阶。

## i18n(繁体已移除)

- 全站只 en + zh-Hans。守卫:hook `block-handwritten-trad` + CI `i18n-removal-guard`(含 en/zh key 对齐)。
- 文案走 `tr({en,zh})` / `<T en zh/>` / `useT()`;长文/复用走 `t()` + `en.json`/`zh.json`;HTML lang `en`/`zh-Hans`。
- 禁内联 `isZh`/`i18n.language` 文案三元(`isZh ? '中' : 'EN'`);`isZh` 仅可作 util 参数。守卫:hook + CI ratchet。细则调 skill `i18n`。
- 魔方术语 zh 以 `client/app/[lang]/wiki/glossary.json` 为准,禁直译;陷阱表+黑名单守卫见 skill `i18n`。

## Skill 路由

主题命中 trigger 时主动调对应 skill,不凭记忆(描述已由 harness 加载,不在此列索引)。

## 造求解器 loop

`/loop 继续造求解器`(或"造求解器")= 读 `solver/SOLVER_LOOP.md` 全文,按 §0 推进 §1 backlog 下一个未完成单元。

## 造 SQ1 最优求解器 loop

`/loop 继续造 SQ1 最优求解器`(或"造 SQ1 最优")= 读 `solver/SQ1_WCA_LOOP.md` + `solver/SQ1_WCA_GODS_NUMBER.md` 全文,按前者 §0 推进;≤15GB 大表、禁 OOM、线程 12/14。

## 造非 WCA 小魔方求解器 loop

`/loop 继续造小魔方求解器`(或"造非 WCA 求解器")= 读 `solver/NONWCA_PUZZLE_LOOP.md` 全文,按 §0 推进;纯 TS 路线(Ivy 范式,非 Rust),TIER D 前有 soft-gate。
