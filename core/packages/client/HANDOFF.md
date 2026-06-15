# Handoff:Vite SPA → Next.js 16 全站迁移

接手 AI 上手第一件事:**完整读完本文档**,再决定下一步。CLAUDE.md / MEMORY.md / skills 都自动加载了,这里只补它们没说的迁移上下文。

## 目标(用户授权范围)

把 `D:\cube\cuberoot.me\core\packages\client`(Vite + React 19 SPA)**整站迁移**到 Next.js 16 App Router,保留所有现有功能。完工后:

- 12 个一级模块 + 28+ 路由,**全部**搬到 `packages/client/`
- 主域名 `cuberoot.me` / `www.cuberoot.me` 切到 Next.js 部署
- 旧 `packages/client/` 删除
- 测试覆盖 + 部署 pipeline 重写

**用户原话**:"从头做到尾,把我整个网站从 vite 全换成 next.js"。

## 当前状态(2026-05-25 移交时刻)

| 项 | 状态 |
|---|---|
| 工作 branch | `poc/nextjs-frame-count`(已 push 到 origin) |
| main branch | 完整 Vite SPA,**任何时刻必须能跑**,不要碰 |
| `packages/client/` | 原 Vite 代码,**只读**,需要时复制内容到 client-next |
| `packages/client/` | Next.js 16.2.6 + React 19.2.4 + Turbopack POC,已跑通 /frame-count |
| 远程 Hono server (`api.cuberoot.me`) | 不迁,**不要碰** |
| `?only=auto` partial 优化 | 已合 main,server 端待 deploy 才生效(`server-deploy` skill) |

## 立刻读(顺序)

1. `D:\cube\cuberoot.me\CLAUDE.md` — 项目规则(自动加载)
2. `C:\Users\CubeRoot\.claude\CLAUDE.md` — 用户全局规则(自动加载)
3. `MEMORY.md` 索引 + 相关 feedback_* / project_* / reference_* 条目(自动加载)
4. **本文档**(你正在读)
5. `packages/client/README.md` — POC 已验证 + 已踩坑清单
6. `packages/client/app/frame-count/page.tsx` — 唯一 POC 页参考
7. `packages/client/src/pages/frame-count/*` — 原 Vite 版本(对照源)
8. `packages/client/src/App.tsx` — 看完整路由清单
9. `core/turbo.json` + `core/pnpm-workspace.yaml` — workspace 配置

## 测试资源

- **frame-count 测试视频**:`D:\cube\cuberoot.me\.tmp\mp4\1 0.688.mp4`(用户提供。4K H.265,~4040 帧,33.7s)
- 验证标准:打开 `http://127.0.0.1:3000/frame-count` → 上传该视频 → status 走到 `Done.` → `totalSamples == decodedFrames` → canvas 显示最后一帧
- 其它页测试视频 / 数据用户手头有,可以问

## 验证工具

| 场景 | 工具 |
|---|---|
| 跑 dev server | `pnpm --filter @cuberoot/client dev`(端口 3000,127.0.0.1)|
| typecheck | `pnpm --filter @cuberoot/client typecheck` |
| build | `pnpm --filter @cuberoot/client build` |
| UI 验证 / 自动测试 | playwright MCP(`mcp__playwright__browser_*`)— 用户允许主动开 |
| 文件上传测试 | `mcp__playwright__browser_file_upload` + 上述测试视频 |
| 服务器端验证(API、nginx 配置) | `ssh root@cuberoot`(免密,见 memory `reference_cuberoot_ssh`)|
| 本地 PG | docker `pg13` 5433/dev/cuberoot_db(见 memory `reference_local_pg_docker`)|
| WCA MySQL | 127.0.0.1:3306(见 memory `reference_local_wca_db`)|
| 网络 / API | `curl` 即可,api.cuberoot.me 是 prod |
| Lighthouse / 性能 | `perf-test` skill(三件套)|

## 子 agent 策略(用户支持并行)

用户**明确允许**开多 agent,只要能加速。建议时机:

- **页迁移并行**:阶段 2 数据页(`/wca/comp/*`、`/wca/persons/*`、`/algdb`、`/wca/calendar` 等)互相独立,可 4-6 个 subagent 同时跑
- **每个页的研究阶段**:`Explore` agent 扫原 Vite 文件、找出依赖
- **大块代码改造**:`general-purpose` agent 改一个完整模块,主线 orchestrator 收尾合并 typecheck
- **不要并行**:阶段 1 基础设施(workspace 配置、共享组件抽取、路由根 layout)— 这些是单线依赖,并行会冲突

并行命令示例:一条 message 里多个 `Agent` tool_use(运行时自动并行)。

**关键**:子 agent 报"完成 + typecheck pass"不能直转,主线必须 Read 1-2 个被改文件抽查(memory `feedback_subagent_pattern_copy_verify`)。

## 阶段路径(用户已批准,可微调)

### 阶段 0:基础设施(本阶段 = 当前 POC 后立即做)
- FFmpeg WASM POC(独立验,黄灯 #1)— 加 `@ffmpeg/ffmpeg + @ffmpeg/util`,做 5 行 demo 验 toBlobURL + coreURL 能在 Next 加载,**1 天内有结论**
- `next.config.ts` 完善:
  - `transpilePackages` 收齐(visualcube / sr-puzzlegen / 各 cjs 包)
  - COOP/COEP map(SAB 页与非 SAB 页分开,见 main `ops/nginx/www.cuberoot.me.conf` 的 `$cross_origin_*` map)
  - 复刻 Vite `serveRepoRoot` plugin → Next `rewrites()` 把 `/stats/`、`/tools/`、根目录 upstream 静态指到正确位置
- 抽 `packages/ui/`(从 `packages/client/src/components/` 抽共享组件 + theme tokens),client + client-next 都 import
- 复制 `packages/client/src/utils/*` 到 client-next,适配 router/i18n import 差异
- 共享 i18n config(en.json / zh.json)— 用 `next-intl` 或自家方案,选一个

### 阶段 1:简单页 + 部署 pipeline 验证(1 周)
迁移这批(纯展示,无重交互):
- `/timeline`、`/code/*`、`/legal/*`、`/credits`、`/about`、`/timer/help`、`/recognize/about` 等
- 写 GH Actions workflow `deploy_next.yml`:build Next static export + scp 部署
- 调通 nginx 路由分发:`/timeline` 等先打到 client-next 静态目录,其它仍 Vite
- 验证主域名双 framework 并行能跑

### 阶段 2:数据驱动页(2-3 周)— SSG/SSR 价值最大
- `/wca/comp/*`(17k 比赛,`getStaticPaths fallback: 'blocking'` 按需 SSG)
- `/wca/persons/*`(数十万选手,同 fallback)
- `/wca/calendar`、`/wca/historical*`、`/wca/viz`、WCA Stats 各 tab
- `/algdb`(~2000 公式)
- `/scramble-stats`、`/nemesizer`
- 验证 LCP 跨洋 < 1s

### 阶段 3:工具页(2-3 周)— 最痛
- `/timer`、`/sim`、`/recon`、`/trainer`、`/recognize/pll`、`/frame-count`(已 POC,补全)、`/calc`、`/battle`、`/mosaic`、`/scramble/(gen|analyzer|solver)`、`/unit_distance`
- 每个都要 `'use client'` 顶层 + 处理 cubing.js / WebCodecs / Worker / WASM
- `/scramble/solver` 走 cubeopt-wasm + SAB,**优先早做**(黄灯 #2)

### 阶段 4:收尾(1 周)
- upstream 静态 (`/solver`、`/alg-trainers`、`/cstimer`) 切到 next public 目录或 nginx alias
- 完整端到端回归(playwright 跑遍所有路由)
- 删 `packages/client/`,改 `deploy_core.yml` 指向 client-next
- 更新 CLAUDE.md 删 Vite 相关、加 Next 相关
- 主域名完全切到 Next.js 部署
- merge `poc/nextjs-frame-count` → main

## 已验证 ✅ / 待验证 ⚠️ / 红灯 ❌

### ✅ POC 已验
- Next 16.2.6 + React 19.2.4 + Turbopack scaffold
- pnpm 11 workspace 集成(注意 `allowBuilds.sharp: false`)
- mp4box.js import + Turbopack build
- `'use client'` page render(0 console errors)
- WebCodecs VideoDecoder(H.265 description bytes 通过 mp4box `DataStream` + Endianness.BIG_ENDIAN 提取)
- COOP/COEP headers via `next.config.ts`
- TypeScript strict + Turbopack HMR + 二次编译 36ms

### ⚠️ 黄灯(需独立 POC)
1. **`@ffmpeg/ffmpeg` WASM 加载**:`toBlobURL` + `coreURL` + multi-threaded worker。frame-count 导出功能依赖,迁完整 frame-count 前必须先验
2. **cubeopt-wasm + SharedArrayBuffer**:`/scramble/solver` 用。COOP/COEP 已 ready,但 WASM 加载方式可能要调
3. **`new Worker(new URL('./x.ts', import.meta.url))` 模式**:Next 16 支持但路径解析跟 Vite 不一样。`/scramble/analyzer`、scramble-stats worker 用到
4. **`import.meta.glob({ eager: true })`**:Vite 特性,EventIcon SVG 加载用。Next 改 dynamic `import()` 或 `require.context`
5. **Service Worker**(`packages/client/src/sw.ts` 拦 `/v1/visualcube.svg`):Next 自带 PWA mode 或手写 sw register
6. **`vite.config.ts` 自定义 plugins**(serveRepoRoot / sq1 svg dev render / megaminx svg dev render / visualcube SSR):每个 plugin 都要找等价 Next 方案

### ❌ 红灯
**目前未发现致命阻塞**。POC 跑通的最大信号是 mp4box + WebCodecs 4K H.265 完整解码无误。

## 关键约束(从 CLAUDE.md + MEMORY 摘出来强化)

- **禁** 改 main 上的 `packages/client/`,需要参考源代码就 Read,不 Edit
- **禁** 改 server (`packages/server/`),迁移期 client-next 调现有 Hono API
- **禁** 改 PG schema / nginx vhost / SSL,除非阶段 4 切流量必要
- **禁** 凭记忆瞎写,关键值走 WebFetch 核(memory `feedback_fetch_docs_dont_recall`)
- **禁** 用 emoji,UI 用 lucide-react 图标
- **禁** 主动开浏览器(memory `feedback_dont_open_browser`)— 但本任务用户**明确允许** playwright 自动验证
- **commit**:用户没说"提交"前不动(memory `feedback_commit_when_asked`)— **本任务交接后默认连续 commit**,每阶段收尾必 commit,英文 commit message
- **push**:`git pull --rebase --autostash origin main` 再 push(memory `feedback_pull_before_push`)— 但 push 的是 `poc/nextjs-frame-count` 分支,不是 main。main 只在阶段 4 merge 时碰
- **基建身份保密**:回复禁出现公网 IP / 云厂商品牌 / 机房地名
- **缩写展开**:首次出现的技术缩写要给全称 + 一句话(memory `feedback_expand_acronyms`)
- **PSI key 0/day quota**:WebSearch / playwright 替代
- **dev server 端口冲突**:Vite 5173,Next 3000,server 3001 — 别撞

## 回退方式(任何阶段卡住都能用)

```bash
# 完全放弃迁移
git checkout main
git branch -D poc/nextjs-frame-count           # 本地分支
git push origin --delete poc/nextjs-frame-count   # 远程分支
rm -rf packages/client
pnpm install
# main 上的 Vite SPA 没受影响,网站继续跑
```

## 完工标准(阶段 4 结束确认)

- [ ] `pnpm --filter @cuberoot/client build` 干净
- [ ] `pnpm --filter @cuberoot/client typecheck` 干净
- [ ] playwright 跑遍 28+ 路由,全部渲染成功 + 关键功能可用
- [ ] frame-count 上传测试视频 → totalSamples == decodedFrames
- [ ] `/scramble/solver` 解 3x3 / 4x4 / 5x5 scramble 成功
- [ ] `/recon` 提交 + 自动补全成功
- [ ] `/timer` 计时正常 + cubing.js 渲染正常
- [ ] WCA OAuth 登录跑通
- [ ] LCP(`/wca/comp/WC2025` 跨洋测)< 1s
- [ ] 主域名切流量后 24h 无回滚
- [ ] `packages/client/` 删除,`packages/client/` 改名 `packages/client`(或保留双名)
- [ ] CLAUDE.md 更新

## 给接手 AI 的开场动作建议

1. `git log --oneline -5` + `git status` 确认当前 branch 是 `poc/nextjs-frame-count`
2. `pnpm --filter @cuberoot/client dev`(背景跑)
3. 用 playwright 打开 `http://127.0.0.1:3000/frame-count`,上传 `D:\cube\cuberoot.me\.tmp\mp4\1 0.688.mp4`,确认 4040 帧解码通过(基线复现)
4. 阶段 0 第一步:FFmpeg WASM POC,独立验证
5. 验完后写 progress 报告,继续阶段 1

记住:**用户希望连续迭代,不要每步等确认**。明显错误才 stop。
