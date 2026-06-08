import type { ReactNode } from 'react';

export interface Layer {
  num: string;
  zh: { name: string; one: string; tech: ReactNode };
  en: { name: string; one: string; tech: ReactNode };
}
export const LAYERS: Layer[] = [
  {
    num: '01',
    zh: { name: '边缘',     one: 'TLS 终止 + 静态文件 + 反向代理',      tech: <>nginx · CloudFlare DNS · Let's Encrypt</> },
    en: { name: 'Edge',     one: 'TLS termination + static + reverse proxy', tech: <>nginx · CloudFlare DNS · Let's Encrypt</> },
  },
  {
    num: '02',
    zh: { name: '前端',     one: 'Next.js App Router, 24+ 工具页, /[lang] 路径前缀切语言', tech: <>React 19 · Next.js 16 (Turbopack) · TypeScript · cubing.js · nuqs (URL 状态) · Tailwind 4 (base 层)</> },
    en: { name: 'Frontend', one: 'Next.js App Router, 24+ tool pages, /[lang] path-prefix locale',     tech: <>React 19 · Next.js 16 (Turbopack) · TypeScript · cubing.js · nuqs (URL state) · Tailwind 4 (base layer)</> },
  },
  {
    num: '03',
    zh: { name: 'API',      one: '小而轻的 Hono, 跑在 pm2 上',           tech: <>Hono · Node 22 · pm2</> },
    en: { name: 'API',      one: 'Small, light Hono, run under pm2',     tech: <>Hono · Node 22 · pm2</> },
  },
  {
    num: '04',
    zh: { name: '存储',     one: 'recon · alg 公式库 · 训练数据 · WCA stats 衍生', tech: <>PostgreSQL 13 · pg_dump nightly</> },
    en: { name: 'Storage',  one: 'recon · alg library · training data · WCA stats derivatives', tech: <>PostgreSQL 13 · pg_dump nightly</> },
  },
];

export interface Pkg {
  name: string;
  size: string;
  zh: { role: string; bullet: string[] };
  en: { role: string; bullet: string[] };
}
export const PACKAGES: Pkg[] = [
  {
    name: 'client-next', size: '~140k LOC',
    zh: { role: 'Next.js 16 App Router — 整个前端',     bullet: ['app/[lang]/* 一个工具一目录, /[lang] 路径前缀切语言', 'components/ 跨页复用', 'lib/ 工具函数 (apiUrl / flag / format_result)', 'Zustand 11 个 store (auth / settings / sessions / 等)'] },
    en: { role: 'Next.js 16 App Router — the whole frontend', bullet: ['app/[lang]/* — one folder per tool, /[lang] path-prefix locale', 'components/ — shared widgets', 'lib/ — helpers (apiUrl / flag / format_result)', '11 Zustand stores (auth / settings / sessions / etc.)'] },
  },
  {
    name: 'client', size: '~120k LOC',
    zh: { role: '已退役 SPA — 仅本地 localhost:5173 兜底', bullet: ['Phase 4 (2026-05-27) 切到 client-next', '不再加新功能', '本地 dev 对比 / 回滚源码留存'] },
    en: { role: 'Retired SPA — local localhost:5173 only', bullet: ['Phase 4 (2026-05-27) cut over to client-next', 'No new features land here', 'Kept locally for dev comparison / rollback source'] },
  },
  {
    name: 'server', size: '~8k LOC',
    zh: { role: 'Hono API + PG 访问',       bullet: ['WCA OAuth + 会话', 'recon / alg / 训练数据 CRUD', '跨域 allowlist 白名单'] },
    en: { role: 'Hono API + PG access',     bullet: ['WCA OAuth + sessions', 'recon / alg / training-data CRUD', 'CORS allowlist'] },
  },
  {
    name: 'shared', size: '~1k LOC',
    zh: { role: '前后端共享类型',           bullet: ['纯 TypeScript 类型, 零运行时', '不能引 client utils', '改一处, 前后端同步收紧'] },
    en: { role: 'Shared types',             bullet: ['Pure TS types, zero runtime', 'Must not import client utils', 'One source for both ends'] },
  },
  {
    name: 'stats-build', size: '~5k LOC',
    zh: { role: 'WCA 统计独立管道',         bullet: ['80+ SQL-driven 统计', '周更 CI, ~2 小时跑完', '基于 jonatanklosko/wca_statistics 重写'] },
    en: { role: 'WCA stats standalone pipeline', bullet: ['80+ SQL-driven stats', 'Weekly CI, ~2h end to end', 'TS rewrite of jonatanklosko/wca_statistics'] },
  },
];

export interface Mod {
  route: string;
  zh: string;
  en: string;
  origin: 'own' | 'port' | 'fork';
  zhDesc: string;
  enDesc: string;
}
export const MODULES: Mod[] = [
  { route: '/recon',          zh: '复盘',        en: 'Recon',        origin: 'own',  zhDesc: '比赛复盘 + 同轮自动带入',       enDesc: 'Result review + same-round autofill'
},
  { route: '/trainer',        zh: '公式训练',    en: 'Trainer',      origin: 'own',  zhDesc: '41 套公式计时训练',              enDesc: '41 algorithm sets with timing'
},
  { route: '/frame-count',    zh: '逐帧',        en: 'Frame Count',  origin: 'own',  zhDesc: 'WebCodecs + mp4box.js',          enDesc: 'WebCodecs + mp4box.js'
},
  { route: '/wca/viz',            zh: '成绩分布',    en: 'Distribution', origin: 'own',  zhDesc: '成绩分布可视化',                 enDesc: 'Result distribution viz'
},
  { route: '/wca/calendar',       zh: '比赛日历',    en: 'Calendar',     origin: 'own',  zhDesc: '全球比赛日历',                   enDesc: 'Global comp calendar'
},
  { route: '/scramble-stats', zh: '打乱难度',    en: 'Scramble',     origin: 'own',  zhDesc: '打乱难度分布',                   enDesc: 'Scramble difficulty'
},
  { route: '/wca',      zh: 'WCA 统计',    en: 'WCA Stats',    origin: 'own',  zhDesc: '80+ 统计页, 周更',               enDesc: '80+ pages, weekly'
},
  { route: '/recognize/pll',  zh: 'PLL 识别',    en: 'Recognize',    origin: 'own',  zhDesc: '看图答字母训练',                 enDesc: 'Image-to-letter drill'
},
  { route: '/calc',           zh: 'HTH 计算',    en: 'HTH Calc',     origin: 'port', zhDesc: 'port: carykh/hthgrapher',        enDesc: 'port: carykh/hthgrapher'
},
  { route: '/timer?mode=duo', zh: '1v1',         en: 'Battle',       origin: 'port', zhDesc: 'port: MatteoColombo',            enDesc: 'port: MatteoColombo' },
  { route: '/mosaic',         zh: '马赛克',      en: 'Mosaic',       origin: 'port', zhDesc: 'port: Roman-/mosaic',            enDesc: 'port: Roman-/mosaic'
},
  { route: '/cstimer',        zh: 'csTimer',     en: 'csTimer',      origin: 'fork', zhDesc: 'fork: cs0x7f/cstimer',           enDesc: 'fork: cs0x7f/cstimer' },
  { route: '/solver',         zh: '复原器',      en: 'Solver',       origin: 'fork', zhDesc: 'fork: or18/RubiksSolverDemo',    enDesc: 'fork: or18/RubiksSolverDemo'
},
  { route: '/alg-trainers',   zh: '公式训练器',  en: 'Alg Trainers', origin: 'fork', zhDesc: 'fork: mihlefeld/Alg-Trainers',   enDesc: 'fork: mihlefeld/Alg-Trainers'
},
];

export interface Decision {
  topic: string;
  pick: string;
  alt: string;
  zh: string;
  en: string;
}
export const DECISIONS: Decision[] = [
  { topic: 'UI library',  pick: 'React 19',         alt: 'Vue / Svelte / Solid',  zh: '生态最广;cubing.js / sr-puzzlegen 等魔方库的示例都是 React;团队熟。',                en: 'Widest ecosystem; cubing.js / sr-puzzlegen samples are React; team familiarity.'
},
  { topic: 'Framework',   pick: 'Next.js 16 (App Router)', alt: 'Remix / TanStack Start / 纯 Vite SPA', zh: 'App Router + RSC + 服务端 streaming 一体, Turbopack dev/build; 双部署 (systemd standalone + Vercel) 同一份代码。Phase 4 (2026-05) 从 React Router SPA 整体切过来。', en: 'App Router + RSC + server streaming in one; Turbopack dev/build; one codebase deploys to both systemd standalone and Vercel. Cut over from React Router SPA in Phase 4 (2026-05).'
},
  { topic: 'Bundler',     pick: 'Turbopack',        alt: 'Webpack / Vite',        zh: 'Next.js 16 自带, dev incremental compile + prod build 都走它;首次冷编 30-90s, 之后增量 sub-second。',                          en: 'Bundled with Next.js 16, drives both dev incremental compile and prod build; first cold compile 30-90s, then sub-second incremental.'
},
  { topic: 'Styling',     pick: '手写语义化 CSS + Tailwind 4 base', alt: '纯 Tailwind / CSS-in-JS', zh: '主样式每页一份手写 CSS (compare.css / stack_landing.css 这类, 用 .compare-card 这种页面前缀语义名)。Tailwind 4 通过 @tailwindcss/postcss 装着, app/globals.css 一行 @import "tailwindcss" 拉进 preflight + utility 命名空间作 base 层兜底, 不写 className="flex p-4"。主题 token 走 shadcn 命名 + CSS 变量。', en: 'Per-page hand-written semantic CSS is the primary style layer (compare.css / stack_landing.css etc., page-prefixed names like .compare-card). Tailwind 4 is wired via @tailwindcss/postcss + a single @import "tailwindcss" in app/globals.css — it supplies preflight + a utility namespace as the base layer, but className="flex p-4" is not the idiom. Theme tokens use shadcn naming + CSS custom properties.'
},
  { topic: 'API server',  pick: 'Hono',             alt: 'Express / Fastify',     zh: 'TypeScript 一等公民;路由声明式;5 MB 依赖比 express 干净一个量级。',                en: 'TS-first; declarative routing; ~5MB deps vs Express noisy stack.'
},
  { topic: 'Database',    pick: 'PostgreSQL 13',    alt: 'MariaDB / MongoDB',     zh: '2026-05 从 MariaDB 整体迁过来。jsonb / window function / partial index 比 MariaDB 强一档。', en: 'Migrated from MariaDB 2026-05. jsonb, window functions, partial indexes — a tier above MariaDB.'
},
  { topic: 'Monorepo',    pick: 'pnpm + Turbo',     alt: 'npm / yarn workspaces', zh: '4 个核心 workspace (client / server / shared / stats-build), 一份 pnpm-lock。硬链接 node_modules 省盘;Turbo 缓存只跑改动到的 package。底层 registry 仍是 npm (registry.npmjs.org), pnpm 只是更快的客户端。', en: 'Four core workspaces (client / server / shared / stats-build), one pnpm-lock. Hard-linked node_modules saves disk; Turbo runs only changed packages. The underlying registry is still npm (registry.npmjs.org) — pnpm is just a faster client.'
},
  { topic: 'State mgmt',  pick: 'Zustand',          alt: 'Redux Toolkit / Jotai / Context', zh: '11 个 store (6 全局 + 5 页面级)。无 Provider, create() 返回 hook, 选 selector 拿切片。auth 走 storage 事件跨标签同步, settings/sessions 用 persist 中间件落 localStorage。打包后约 1 KB。', en: '11 stores (6 global + 5 page-local). No Provider — create() returns a hook, components select slices. auth syncs across tabs via the storage event; settings/sessions persist to localStorage via middleware. ~1 KB bundle cost.'
},
  { topic: 'URL state',   pick: 'nuqs',             alt: '手写 history.pushState / router.replace / useState', zh: '页内"在哪个视图 / tab / 筛选 / 搜索"统一进 URL search params, 一处声明 useQueryState / useQueryStates。视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。替掉全站各写各的 history.pushState/replaceState + 手写 popstate;一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。', en: 'In-page "which view / tab / filter / search" lives in URL search params, declared once via useQueryState / useQueryStates. Views / tabs / modes / overlays push to history (back returns); filters / sort / search replace (no pile-up). Replaced the site-wide grab-bag of raw history.pushState/replaceState + hand-rolled popstate; a PreToolUse hook blocks at write time and a vitest guard backstops CI, with a few exemptions (maplibre, zustand data serialization).'
},
  { topic: 'Hosting',     pick: '自有 VM nginx + Vercel (DNS 分线路)', alt: '单 Vercel / 单 nginx', zh: 'DNS 按线路分流, 同一份 Next.js 代码两边跑。一条线路 → 自有 VM nginx → systemd Next standalone (反代 :3002, deploy_next.yml CI 自动 scp + 原子 swap);另一条线路 → Vercel Hobby edge (push GitHub 自动部署)。后端 Hono+PG 始终在同一台 VM, Vercel 端通过 api.cuberoot.me 调。', en: 'Split-horizon DNS, same Next.js codebase on both. One line → self-hosted VM nginx → systemd Next standalone (reverse-proxy :3002, deploy_next.yml CI auto scp + atomic swap); the other line → Vercel Hobby edge (push-to-GitHub auto-deploy). Backend Hono+PG stays on the same VM; Vercel side hits it via api.cuberoot.me.'
},
  { topic: 'Theme tokens', pick: 'shadcn 命名 + hex + color-mix', alt: 'oklch / Material 3 / Radix Colors', zh: '8 页双主题切换。命名跟 OSS 标准 shadcn (AI 写代码命中率高);色值 hex (调研 30+ 大厂含 Anthropic console 自己,0 家把 oklch 当主品牌 token);衍生用 color-mix(in srgb) 跟 Anthropic CDS 实战用法 (644 处) 对齐。', en: 'Dark/light across 8 pages. Naming follows shadcn (OSS standard, friendly to AI code-gen); hex values (surveyed 30+ big-co incl. Anthropic console — zero use oklch as primary brand tokens); derivations via color-mix(in srgb) aligning with Anthropic CDS (644 production uses).'
},
];

export interface Detail {
  title: string;
  zh: ReactNode;
  en: ReactNode;
}
export const DETAILS: Detail[] = [
  {
    title: 'SharedArrayBuffer · COOP/COEP',
    zh: <><strong>/scramble/solver</strong> 和 <strong>/scramble/analyzer</strong> 跑 cubeopt-wasm, 需要 <code>SharedArrayBuffer</code>。仅这两条 route 由 nginx 注入 <code>COOP=same-origin</code> + <code>COEP=require-corp</code> 进 cross-origin isolated。其它 24 张卡完全干净, 登录回调不受影响。</>,
    en: <><strong>/scramble/solver</strong> and <strong>/scramble/analyzer</strong> run cubeopt-wasm and require <code>SharedArrayBuffer</code>. Only those two routes get nginx-injected <code>COOP=same-origin</code> + <code>COEP=require-corp</code> for cross-origin isolation. Every other page stays clean — login callbacks unaffected.</>,
  },
  {
    title: 'apiUrl() 是唯一的 fetch 入口',
    zh: <>客户端不能硬编码 origin。<code>lib/api-base.ts</code> 的 <code>apiUrl()</code> 用 <code>import.meta.env.DEV</code> 切换:dev 走 <code>next.config.ts</code> 里 <code>rewrites()</code> 反代 <code>api.cuberoot.me</code>, prod 直打 <code>api.cuberoot.me</code>。<code>hostname</code> 检测会被 Tailscale / LAN IP 骗到, 绝对禁用。</>,
    en: <>Client never hardcodes origin. <code>lib/api-base.ts</code> uses <code>import.meta.env.DEV</code>: dev → <code>next.config.ts</code> <code>rewrites()</code> proxy to <code>api.cuberoot.me</code>, prod → direct <code>api.cuberoot.me</code>. <code>hostname</code> checks get fooled by Tailscale / LAN IP — banned.</>,
  },
  {
    title: 'cubing.js + sr-puzzlegen + visualcube 三件套',
    zh: <><strong>cubing.js</strong> 渲染动画 (TwistyPlayer)、跑 3x3 / 4x4 求解器。<strong>sr-puzzlegen</strong> 出 sq1 / megaminx / pyraminx / skewb 静态 SVG。<strong>visualcube</strong> 出 NxN 状态图 (F2L / OLL / PLL / ZBLL)。三者各管一块, <strong>禁止手写魔方 SVG</strong>。</>,
    en: <><strong>cubing.js</strong> for animation (TwistyPlayer) and 3x3/4x4 solvers. <strong>sr-puzzlegen</strong> for sq1 / megaminx / pyraminx / skewb SVGs. <strong>visualcube</strong> for NxN state images (F2L / OLL / PLL / ZBLL). Three libs, three lanes — <strong>hand-written cube SVG is banned</strong>.</>,
  },
  {
    title: 'i18n — 两种 pattern 并存',
    zh: <>大段文案走 <code>t()</code> + <code>en.json</code> / <code>zh.json</code>;组件内零散文案走 <code>isZh ? 'X' : 'Y'</code> 三元。<code>LangToggle</code> 每页右上角, 默认跟系统语言。WCA 比赛中文名独立走 <code>comp_names_zh.json</code>。</>,
    en: <>Long blocks → <code>t()</code> + <code>en.json</code>/<code>zh.json</code>; inline strings → <code>isZh ? 'X' : 'Y'</code> ternary. <code>LangToggle</code> sits top-right on every page. Chinese comp names live in a separate <code>comp_names_zh.json</code>.</>,
  },
  {
    title: 'Theme — dark / light / system 三态',
    zh: <>shadcn 风 token (<code>--background --foreground --muted-foreground --accent --signal-*</code>) 在 <code>:root</code>, light 默认 + <code>@media (prefers-color-scheme: dark)</code> + <code>html[data-theme]</code> 双轨反盖。衍生色一律 <code>color-mix(in srgb, var(--base) X%, transparent)</code>, 改 base 一处自动跟。<code>ThemeToggle</code> 每页右上角循环 system → light → dark, 存 <code>localStorage.theme</code>, 启动 <code>bootstrapTheme()</code> 挂 <code>html[data-theme]</code>。8 页支持切换 (3 双主题 + 4 dark-locked + 1 light-locked), 其它老页跑 legacy <code>--bg-primary --text-primary</code> 不动。</>,
    en: <>shadcn-style tokens (<code>--background --foreground --muted-foreground --accent --signal-*</code>) live in <code>:root</code>, light defaults + <code>@media (prefers-color-scheme: dark)</code> + <code>html[data-theme]</code> dual override. Derivations always go through <code>color-mix(in srgb, var(--base) X%, transparent)</code> so changing one base ripples to all. <code>ThemeToggle</code> sits top-right and cycles system → light → dark, persists to <code>localStorage.theme</code>, applied via <code>bootstrapTheme()</code> at startup. 8 pages support switching (3 dual-theme + 4 dark-locked + 1 light-locked); legacy pages still use the old <code>--bg-primary --text-primary</code> tokens untouched.</>,
  },
  {
    title: 'WCA 统计的脆弱三角',
    zh: <>新增一个 stat 表要同步改三处:<code>stats-build/src/bin/*.ts</code> (写 TSV)、<code>.github/workflows/stats.yml</code> (scp 清单)、<code>ops/sql/load.sql</code> (<code>\copy</code> 引用)。漏一处, 服务器表静默为空, nginx 还缓存 24 小时。dry-run grep 三段对照是唯一保险。</>,
    en: <>Adding a stat table needs three coordinated edits: <code>stats-build/src/bin/*.ts</code> (writes TSV), <code>.github/workflows/stats.yml</code> (scp manifest), <code>ops/sql/load.sql</code> (<code>\copy</code> reference). Miss one and the server table silently empties — nginx still caches 24h. The only safety net: a 30-second grep dry-run across all three.</>,
  },
  {
    title: 'fork / port / own 三种治理',
    zh: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream 静态资源原样托管, 只改外层包装。<strong>port</strong> (Calc / Battle / Mosaic) = 把别人的 React / HTML 重写一遍。<strong>own</strong> (其它 11 个) = 自己设计 + 实现。改 fork / port 前必须确认 upstream。</>,
    en: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream assets hosted as-is, only the outer shell is ours. <strong>port</strong> (Calc / Battle / Mosaic) = someone else's React / HTML, rewritten in this repo. <strong>own</strong> (the other 11) = designed and built here. Touching a fork or port? Check upstream first.</>,
  },
  {
    title: '状态管理 — Zustand(内存)+ nuqs(URL)',
    zh: <>客户端内存 / 持久化状态走 <strong>Zustand</strong>:<code>auth_store</code> (WCA OAuth 用户)、<code>settingsStore</code> (主题 / 语言, persist)、<code>sessionStore</code> (当前 solve 会话, persist)、<code>statsStore</code> (WCA stats 查询)、<code>trainerStore</code> (训练状态, persist)、<code>recon_store</code> (复盘缓存);页面级 store 跟着各自 page 走 (battle / calc / mosaic / viz)。模式统一:<code>create()</code> 返回 hook, 不用 Provider, 不写 reducer。<strong>URL 状态</strong>(在哪个视图 / tab / 筛选 / 搜索)统一走 <strong>nuqs</strong> 的 <code>useQueryState</code> 写进 query params — 刷新可恢复、能分享深链、前进后退正常:大视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。禁裸 <code>history.pushState/replaceState</code> + 手写 popstate, 一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫在 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。</>,
    en: <>In-memory / persisted client state uses <strong>Zustand</strong>: <code>auth_store</code> (WCA OAuth user), <code>settingsStore</code> (theme / lang, persisted), <code>sessionStore</code> (active solve session, persisted), <code>statsStore</code> (WCA stats query), <code>trainerStore</code> (drill state, persisted), <code>recon_store</code> (recon cache); page-local stores live next to their pages (battle / calc / mosaic / viz). One pattern throughout: <code>create()</code> returns a hook — no Provider, no reducer. <strong>URL state</strong> (which view / tab / filter / search) goes through <strong>nuqs</strong> <code>useQueryState</code> into the query params — survives refresh, shareable deep links, correct back/forward: big views / tabs / modes / overlays push to history (back returns), filters / sort / search replace (no history pile-up). Raw <code>history.pushState/replaceState</code> and hand-rolled popstate are banned — a PreToolUse hook blocks them at write time and a vitest guard backstops CI, with only a few exemptions (maplibre, zustand data serialization).</>,
  },
  {
    title: 'npm registry — 我们用 pnpm 但拉的是 npm',
    zh: <><code>pnpm install</code> 跑的是从 <code>registry.npmjs.org</code> 下 tarball 这件事。yarn / pnpm / bun 都是同一 registry 的不同客户端, 都共享 <code>package.json</code> + <code>semver</code> + lockfile 这套 npm 定义的协议。选 pnpm 是因为硬链接 store 省盘 + Turbo cache 友好 + monorepo workspaces 体验好;但 4M+ 包 + 周下载几千亿次的护城河, 始终在 npm 那一头。</>,
    en: <><code>pnpm install</code> still fetches tarballs from <code>registry.npmjs.org</code>. yarn / pnpm / bun are different clients of the same registry, all sharing the <code>package.json</code> + <code>semver</code> + lockfile protocol that npm defined. We pick pnpm for hard-linked store (disk savings), Turbo-cache friendliness, and good workspaces — but the moat (4M+ packages, hundreds of billions of weekly downloads) is at npm's end.</>,
  },
];

export type StageId = 'browser' | 'edge' | 'spa' | 'fetch' | 'api' | 'hono' | 'pg';

export interface Stage { id: StageId; zh: string; en: string; sub: string; }
export const TRACER_STAGES: Stage[] = [
  { id: 'browser', zh: '浏览器',           en: 'Browser',           sub: 'fetch / nav'
},
  { id: 'edge',    zh: 'cuberoot.me nginx', en: 'cuberoot.me nginx', sub: 'static + try_files' },
  { id: 'spa',     zh: 'Next 启动',         en: 'Next boot',         sub: 'App Router + RSC'
},
  { id: 'fetch',   zh: 'apiUrl() fetch',    en: 'apiUrl() fetch',    sub: 'utils/api_base.ts' },
  { id: 'api',     zh: 'api.cuberoot.me nginx', en: 'api.cuberoot.me nginx', sub: 'proxy_cache 24h' },
  { id: 'hono',    zh: 'Hono server',       en: 'Hono server',       sub: 'pm2 · :3001' },
  { id: 'pg',      zh: 'PostgreSQL',        en: 'PostgreSQL',        sub: ':5432' },
];

export interface Pattern {
  id: string;
  zh: { label: string; detail: string };
  en: { label: string; detail: string };
  route: string;
  lit: StageId[];
  cacheHit: boolean;
  eta: string;
}
export const TRACER_PATTERNS: Pattern[] = [
  {
    id: 'home',
    route: '/',
    lit: ['browser', 'edge', 'spa'],
    cacheHit: false,
    eta: '~200ms 首次  ·  完全不打 API',
    zh: { label: '打开首页', detail: 'LandingPage 是构建期静态预渲染 (SSG) 的 HTML, 由 CDN / nginx 直出, 不进 Next 函数; 客户端 hydrate 后再 client 端取动态数据 (近期比赛 / 纪录)。' },
    en: { label: 'Open home', detail: 'LandingPage is build-time static (SSG) HTML served straight from CDN / nginx — no Next function runs; the client hydrates and then fetches dynamic data (upcoming comps / records) client-side.' },
  },
  {
    id: 'recon-fresh',
    route: '/recon/abc',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api', 'hono', 'pg'],
    cacheHit: false,
    eta: '~40ms (API 部分)',
    zh: { label: '首次打开复盘', detail: 'Next 服端渲染 shell 返回后, 客户端 hydrate 调 apiUrl("/v1/recon/abc")。/v1/recon/* 不在 24h cache 白名单, 整条管道穿透:Hono 查 PG, 反序列化, 返回 JSON。' },
    en: { label: 'First-time recon view', detail: 'After Next streams the SSR shell back, the client hydrates and fetches apiUrl("/v1/recon/abc"). /v1/recon/* is not in the 24h proxy_cache allowlist, so the request flows through to Hono → PG, deserializes, returns JSON.' },
  },
  {
    id: 'wca-cached',
    route: '/wca/all-results?show=persons',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api'],
    cacheHit: true,
    eta: '< 10ms (cache hit)',
    zh: { label: '回访 WCA 统计', detail: '24h 内重复访问 stat 数据。nginx proxy_cache 在 :api 这一层 hit, 直接吐 JSON, 不打 Hono、不打 PG。每天首次访问才真正穿透。' },
    en: { label: 'Revisit WCA stat', detail: 'Repeat visit within 24h. nginx proxy_cache hits at the :api stage, returns JSON directly — Hono and PG untouched. Only the first request each day pierces the cache.' },
  },
  {
    id: 'iframe-fork',
    route: '/tools/cstimer/index.html',
    lit: ['browser', 'edge'],
    cacheHit: false,
    eta: '< 10ms (静态)',
    zh: { label: '打开 fork 内部页', detail: 'fork 项目的内部页面 (iframe src)。nginx 直接服 /tools/cstimer/ 静态 HTML, 不打 Next, 不打 API。从 Next 路由 /cstimer 进来时再加一层 Next page + iframe 套娃。' },
    en: { label: 'Fork inner page', detail: 'Inside-iframe page of a forked project. nginx serves /tools/cstimer/ static HTML directly — no Next, no API. From the Next route /cstimer, you wrap an extra Next page + iframe around this.' },
  },
];

export interface TLEntry {
  date: string;
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
export const TIMELINE: TLEntry[] = [
  {
    date: '2026-05-28',
    tag: 'infra',
    zh: {
      title: 'Vercel 用量优化: 页面静态化 (SSG) + 大文件不过函数',
      body: '固定页从动态 SSR 改成构建期静态预渲染 (SSG, ~128 组走 CDN 零计算);/stats/* 大 JSON 在 Vercel 改 307 重定向到 static.cuberoot.me (不再经函数中转, 顺带消掉大文件 502);首页链接关预取。函数调用 / CPU / 内存预期降到约 1/4。',
      expand: '根因: 根 layout 渲染时 await cookies()/headers() 读语言, 把整树钉成动态, 每个页面每次访问都进 serverless 函数。改法: 语言归属下移到 [lang]/layout (I18nProvider initialLang + generateStaticParams en/zh), 根 layout 去动态 API 转静态, html[lang] 由内联脚本按 URL 设。踩到两个静态化坑: (1) react-i18next 默认 useSuspense + 异步 init, prerender 时 useTranslation suspend → 空 HTML, 改 initImmediate:false + useSuspense:false; (2) 全局挂载的 LangToggle 在 render 调 useSearchParams, 让每页 BAILOUT_TO_CLIENT_SIDE_RENDERING 出空壳, 改成 click 时读 window.location.search。~18 个查询驱动页 (WCA 统计表 / 打乱工具 / sim 等) 维持 SSG client-shell, 数据仍 client 端从 api.cuberoot.me 取。',
    },
    en: {
      title: 'Vercel usage optimization: static prerender (SSG) + offload big files from functions',
      body: 'Fixed pages move from per-request SSR to build-time static prerender (SSG; ~128 route-groups served from CDN, zero compute). On Vercel, /stats/* big JSON now 307-redirects to static.cuberoot.me (no longer proxied through a function, also clearing the big-file 502s); landing links drop prefetch. Function invocations / CPU / memory expected to drop to ~1/4.',
      expand: 'Root cause: the root layout did await cookies()/headers() in render to resolve locale, opting the whole tree into dynamic rendering — every page hit a serverless function on each request. Fix: move locale ownership to [lang]/layout (I18nProvider initialLang + generateStaticParams en/zh), strip dynamic APIs from the root layout, set html[lang] via an inline script from the URL. Two SSG gotchas: (1) react-i18next defaults to useSuspense + async init, so useTranslation suspended during prerender → empty HTML; fixed with initImmediate:false + useSuspense:false. (2) the globally-mounted LangToggle called useSearchParams at render, forcing every page to BAILOUT_TO_CLIENT_SIDE_RENDERING (empty shell); switched to reading window.location.search on click. ~18 query-driven pages stay SSG client-shells; data still fetched client-side from api.cuberoot.me.',
    },
  },
  {
    date: '2026-05-27',
    tag: 'migration',
    zh: {
      title: 'Phase 4 完成: 主域从 Vite SPA 切到 Next.js',
      body: 'cuberoot.me 主域换底:一条线路 → 自有 VM nginx → systemd cuberoot-next (Next standalone),另一条线路 → Vercel edge → 同份 Next 代码。DNS provider 自带分流。旧 Vite SPA 同期下线(2026-05-27),只保留本地 localhost:5173 作对比。GH Pages 镜像不再用。',
      expand: '架构骨架不变(后端 Hono+PG 不动),前端框架换 React Router → Next.js App Router + Turbopack,新代码在 packages/client-next/。同一份 Next 代码两边跑:一条线路 = systemd 标准 next standalone(deploy_next.yml CI build + tar + scp + 原子 swap + 健康检查),另一条 = Vercel Hobby 自动从 GitHub 部署。Vercel 上踩到 3 个坑:(1) standalone + outputFileTracingRoot 跟 Vercel Turbopack 撞 manifest ENOENT (vercel/next.js#88579), VERCEL=1 env gate 跳过;(2) /stats/* /tools/* 在 Vercel 没打进 bundle, route handler 加 fallback fetch static.cuberoot.me;(3) /zh/wca/comp/[slug] 必须 force-dynamic 否则 useSearchParams 抛 DYNAMIC_SERVER_USAGE 500。cert HTTP-01 challenge 1 分钟内签发, 全程零 downtime。',
    },
    en: {
      title: 'Phase 4: main domain swapped from Vite SPA to Next.js',
      body: 'cuberoot.me cuts over: one DNS line → self-hosted VM nginx → systemd cuberoot-next (Next standalone); the other line → Vercel edge → same Next code. DNS provider handles the split. The retired Vite SPA is taken down (2026-05-27), only local localhost:5173 kept for comparison. GH Pages mirror is now disabled.',
      expand: 'Backend skeleton unchanged (Hono+PG); front-end framework swaps React Router → Next.js App Router + Turbopack, new code lives in packages/client-next/. One Next codebase runs in two places: one DNS line = standard Next standalone on systemd (deploy_next.yml CI build + tar + scp + atomic swap + health check), the other = Vercel Hobby auto-deploy from GitHub. Three Vercel-specific gotchas: (1) standalone + outputFileTracingRoot trip Vercel Turbopack into manifest ENOENT (vercel/next.js#88579) — gated by VERCEL=1 env; (2) /stats/* and /tools/* are not bundled into Vercel functions — route handlers fall back to static.cuberoot.me; (3) /zh/wca/comp/[slug] needs force-dynamic or useSearchParams throws DYNAMIC_SERVER_USAGE 500. HTTP-01 cert issued under a minute, zero user-visible downtime.',
    },
  },
  {
    date: '2026-05-14',
    tag: 'feature',
    zh: {
      title: '单日 5 件并发: /sim + /comp + 主题 token + blog 子域 + Nemesizer SaaS',
      body: '(1) /sim 虚拟魔方 Playground 上线 (port huazhechen/cuber, three.js 引擎 + 4 模式 free play / replay / algs / record); (2) /comp cubing.com 直播比赛镜像 (直 WS 实时推送); (3) shadcn-style 主题 token 系统 + ThemeToggle (light/dark/system) + theme-tokens skill; (4) blog.cuberoot.me 子域 DNS 分线路 (nginx alias / GH Pages,WP 旧 slug 重定向); (5) Nemesizer server-side 化 (dataset+algo 移入 Hono,6 端点 + nginx 24h cache)。',
      expand: '/sim 总 14 文件 ~1400 行新增, cuber 引擎 ~2200 行 TS 完整 port + WCA 标准配色 + cubelet thickness 立体贴片 + AmbientLight ×π 修 r155+ 物理光照, 配 redo 栈 / 全键盘 / 设置抽屉 / 移动 24 键盘 / Player 回放 / Algs 库 (复用现有 /api/alg/sets) / Director (PNG 截图 + canvas captureStream MediaRecorder)。/comp 直 WS 取代 polling, 选手成绩即时更新 + flag/record badge/i18n。shadcn 主题用 hex token + color-mix 衍生 (禁硬码 #888 等), light-locked / dark-locked 页用 page-scope color-scheme 锁。blog 子域 acme.sh dns_ali 自动续, 同期 ruiminyan.github.io → cuberoot.me 全仓引用替换。Nemesizer 之前是 client 9MB bundle, 现在 server 启动加载 .bin.gz 进内存 + nginx /v1/nemesizer/* 24h 缓存 + pm2 reload on stats refresh。同日 landing 右上角 cluster 统一 + /about 页扩 + upstream logos + credits 单源 JSON (credits_data.json 驱动 README + /about) + RegionPicker 255 行新组件 + DESIGN.md 338 行 + THEMING.md 194 行图设/主题文档体系。',
    },
    en: {
      title: 'Five concurrent launches in one day: /sim + /comp + theme tokens + blog subdomain + Nemesizer SaaS',
      body: '(1) /sim virtual cube Playground (port of huazhechen/cuber, three.js engine + 4 modes: free play / replay / algs / record); (2) /comp cubing.com live-competition mirror (direct WS push); (3) shadcn-style theme token system + ThemeToggle (light/dark/system) + theme-tokens skill; (4) blog.cuberoot.me subdomain split-horizon DNS (nginx alias / GH Pages, WP legacy slug redirect); (5) Nemesizer goes server-side (dataset + algo into Hono, six endpoints + 24h nginx cache).',
      expand: '/sim: 14 files / ~1400 lines added; cuber\'s ~2200-line TS engine fully ported + WCA standard sticker colors + cubelet thickness for 3D tiles + AmbientLight ×π fix for r155+ physical lighting; redo stack / full keyboard map / settings drawer / 24-key mobile keypad / Player replay / Algs browser (reuses existing /api/alg/sets) / Director (PNG snapshot + canvas captureStream MediaRecorder). /comp uses direct WS instead of polling — live finishes + flag / record badge / i18n. shadcn theme uses hex tokens + color-mix derivations (no hand-coded #888 etc.); light-locked / dark-locked pages get page-scope color-scheme locks. Blog subdomain on acme.sh dns_ali auto-renew; same day finalised ruiminyan.github.io → cuberoot.me references repo-wide. Nemesizer was previously a 9MB client bundle; now the server preloads .bin.gz at startup + 24h nginx /v1/nemesizer/* cache + pm2 reload on stats refresh. Same day also: top-right cluster unified + /about expanded + upstream logos + credits single-source JSON (credits_data.json drives README + /about) + 255-line RegionPicker + 338-line DESIGN.md + 194-line THEMING.md documentation.',
    },
  },
  {
    date: '2026-05-12',
    tag: 'dx',
    zh: {
      title: 'HMR 三入口 + dev.cuberoot.me 隧道 + /code/architecture 重写',
      body: 'PC localhost / 同 WiFi 手机 (ts.net) / 蜂窝外网手机 (dev.cuberoot.me) 三端实时 HMR — 不同反代,同一份 vite client。这页同日从纯文字改成图文长版, 一边写一边在三端验证。',
      expand: '蜂窝下原来 ts.net Funnel 因 PC 跨境路由不稳, 新加 dev.cuberoot.me 走 frp 反向隧道 → 自有云服务器 nginx, 强制 TLS + token, 公网开放 7000 但安全。本页第 09 节有 HMR 三入口完整推导:写死 clientPort 等于全员遵守一个入口, 删掉让 client 跟着 page URL 自己算 — 三端各自正确, 浏览器自己规范化空端口。',
    },
    en: {
      title: 'HMR triple entry + dev.cuberoot.me tunnel + /code/architecture rewrite',
      body: 'PC localhost / same-WiFi phone (ts.net) / cellular phone (dev.cuberoot.me) all hot-reload — three reverse proxies, one vite client. This page (/code/architecture) was rewritten from plain prose into illustrated long-form, validated live on all three.',
      expand: 'Cellular previously couldn\'t use ts.net Funnel (PC behind cross-border routing, relay flaky); added dev.cuberoot.me over frp reverse tunnel → self-hosted VM nginx, forced TLS + token, port 7000 public but safe. Section 09 has the full triple-entry derivation: a hardcoded clientPort forces everyone through one entry. Delete it, let the client derive from its own page URL — three entries each compute their own correct values, browser normalizes the empty port.',
    },
  },
  {
    date: '2026-05-10',
    tag: 'feature',
    zh: {
      title: '/alg/commutator 换位分解工具上线',
      body: '3x3 commutator 分解器 (CommutatorPage 723 行 + engine.ts 1131 行 + 497 行 CSS)。同日 /site 后端化 (从硬编 sites.ts 改成 nav_sites 表 + admin 编辑)。',
      expand: '换位分解是 BLD / FMC 圈高频需求, 之前要去外站。同期把 /site 站点导航从静态 ts 数组迁到 PG 后端 + admin 编辑 UI。基础设施侧上线自写 39 行 schema migration runner (不装 Flyway 等重型工具) + ssh keepalive + healthcheck.yml workflow。',
    },
    en: {
      title: '/alg/commutator decomposition tool launches',
      body: '3x3 commutator analyzer (723-line CommutatorPage + 1131-line engine.ts + 497-line CSS). Same day /site goes backend (hardcoded sites.ts → nav_sites table + admin editor).',
      expand: 'Commutator decomposition is a high-demand BLD/FMC tool previously requiring third-party sites. /site nav migrated from static TS array to PG-backed with an admin editor. Infrastructure also gained a self-hosted 39-line schema migration runner (no Flyway etc.) + ssh keepalive + healthcheck.yml workflow.',
    },
  },
  {
    date: '2026-05-08',
    tag: 'feature',
    zh: {
      title: '单日 7 个独立功能上线 (/memo / /scramble Hub / 7 张 stat 子页 / /recognize 路由 / +3 lang)',
      body: '(1) /memo Hub + /memo/colpi 记忆训练页 (314 行初版 → 同日后端化到 PG colpi_words/votes 双表 + 投票 API + 11.7k 词镜像); (2) /scramble 统一 Hub + /scramble/solver (cubeopt-wasm port); (3) /wca/historical + 7 张 cubing.pro 风格 stat 子页 (大满贯/全部/当年/届别/成功率/全达成/名次和) 同 commit 上线; (4) /recognize/:algSetId 通用识别路由挂上, trainer 改造为 41-set 通用入口; (5) /code 加 Java / JavaScript / Mojo + CompareScramble。',
      expand: 'colpi 是 colored-pi 记忆训练 (CFOP/blindfolded 圈用 11.7k 词从 bestsiteever.net 镜像)。/scramble/solver 是 cs0x7f/cubeopt-wasm 的 React port + 9 套 wasm worker (sw.ts 注 COOP/COEP for SAB)。7 张 stat 配套 6 张新 PG 表 + 5M+ rows / 382 MB 初始灌库。/recognize 通用化后旧的 OllTrainingPage / Zbll* / Zbls* 共 4713 行废代码删除。后端 historical_ranks 走 build → scp → PG → Hono → nginx 24h cache 五层管道。',
    },
    en: {
      title: 'Seven features in one day (/memo, /scramble hub, 7 stat subpages, /recognize, +3 lang)',
      body: '(1) /memo + /memo/colpi memory training (314-line v1 → same-day PG backend with colpi_words/votes + voting API + 11.7k-word mirror); (2) /scramble unified hub + /scramble/solver (cubeopt-wasm port); (3) /wca/historical + 7 cubing.pro-style stat subpages (grand slam / all / year / cohort / success rate / all events done / sum of ranks) shipped in one commit; (4) /recognize/:algSetId generic recognition route wired, trainer reworked as 41-set entry; (5) /code adds Java / JavaScript / Mojo + CompareScramble.',
      expand: 'colpi = colored-pi memory training (used by CFOP/blindfolded community, 11.7k words mirrored from bestsiteever.net). /scramble/solver is a React port of cs0x7f/cubeopt-wasm + 9 wasm workers (sw.ts COOP/COEP for SAB). The 7 stat pages are backed by 6 new PG tables + 5M+ rows / 382 MB initial load. After /recognize generalisation, legacy OllTrainingPage / Zbll* / Zbls* (4713 lines total) were removed. historical_ranks now flows through build → scp → PG → Hono → nginx 24h cache.',
    },
  },
  {
    date: '2026-05-07',
    tag: 'feature',
    zh: {
      title: '/code 编程语言入门站上线 (9 种语言一次上)',
      body: '一次 24-file commit 把 9 种语言同时上线: C / C++ / Go / Kotlin / TypeScript / Rust / Python / Zig / Swift, 加 CodeLandingPage + CompareAo5Page, 共 22294 行新增。',
      expand: '内容方向是"魔方 + 这门语言" — 每页用速拧场景做例子 (eg. Ao5 计算用 C / Rust / TS 各写一遍)。同日 Alg admin 加 DnD 排序 + X-Admin-Key 通道。5/8 又加 Java / JavaScript / Mojo, 5/12 再加 C# / Ruby / PHP / Lua / Haskell + HTML / CSS / Bash / SQL 共 9 页, 总计 21 种语言/标记。',
    },
    en: {
      title: '/code programming-language intro hub launches (9 languages at once)',
      body: 'Single 24-file commit shipping 9 languages: C / C++ / Go / Kotlin / TypeScript / Rust / Python / Zig / Swift, plus CodeLandingPage + CompareAo5Page — 22294 lines added.',
      expand: 'Each page uses speedcubing scenarios as examples (e.g. computing Ao5 in C / Rust / TS). Same day: Alg admin gains drag-reorder + X-Admin-Key channel. 5/8 added Java / JavaScript / Mojo; 5/12 added another 9 (C# / Ruby / PHP / Lua / Haskell + HTML / CSS / Bash / SQL), totalling 21 languages/markup.',
    },
  },
  {
    date: '2026-05-06',
    tag: 'migration',
    zh: {
      title: '三件迁移同日完成 (PG / alg DB / 卸宝塔)',
      body: '同一天: MariaDB → PG 13 整体迁移 + 41 个 alg JSON → DB + 宝塔 + PHP + WP 全卸。云服务器只剩 nginx + Node + PG。',
      expand: 'PG 迁移用 jsonb / window function / partial index 让 recon / alg / stats 代码全简化一档。pg_dump systemd timer 每天 03:00 UTC 备份留 30 天。Alg 网页可直接编辑 (X-Admin-Key 或 OAuth), 不用 commit + redeploy。Blog 从 WordPress 整站静态化归档 (后来 2026-05-14 又拆出 blog.cuberoot.me 子域 + GH Pages 镜像)。',
    },
    en: {
      title: 'Three migrations the same day (PG / alg DB / wipe baota)',
      body: 'Same day: MariaDB → PG 13 + 41 alg JSONs into PG + wipe baota + PHP + WP. The VM now runs only nginx + Node + PG.',
      expand: 'PG migration uses jsonb / window functions / partial indexes to simplify recon / alg / stats across the board. pg_dump on a systemd timer at 03:00 UTC, 30-day retention. Algs now editable directly in the browser (X-Admin-Key or OAuth) — no commit + redeploy. Blog was statically archived from WordPress (later split into blog.cuberoot.me subdomain + GH Pages mirror on 2026-05-14).',
    },
  },
  {
    date: '2026-05-03',
    tag: 'feature',
    zh: {
      title: '5 个新页同日上线 + VisualCube 服务化',
      body: '5 个新路由: /visualcube 全功能图片编辑器 + /patterns 花式图样库 + /average + /gen + /today。同时 /alg → /tutorial 整体改名 + VisualCube 服务化 (esbuild + Node 渲染 + /v1/visualcube.svg + service worker)。',
      expand: '/visualcube 是仿 visualcube.roudai.net 的 React 重写, ICubeOptions 全参 + URL query state sync + 5 个 export action。/patterns 是收藏的"花式图样"。VisualCube 服务化让浏览器不用再现场跑 visualcube 算面位置, 统一服务端渲染 + 缓存。同期把 sq1/megaminx/pyraminx/skewb 也接 sr-puzzlegen, 手写魔方 SVG 一律禁。',
    },
    en: {
      title: '5 new pages same day + VisualCube as a service',
      body: '5 new routes: /visualcube full-feature image editor + /patterns library + /average + /gen + /today. Same day /alg → /tutorial wholesale rename + VisualCube as a service (esbuild + Node + /v1/visualcube.svg + service worker).',
      expand: '/visualcube is a React rewrite mimicking visualcube.roudai.net: full ICubeOptions parameter set + URL query state sync + 5 export actions. /patterns collects fancy puzzle patterns. VisualCube SaaS means browsers no longer compute facelet positions live — everything renders server-side and caches. sq1/megaminx/pyraminx/skewb also wired up via sr-puzzlegen — no more hand-written cube SVG.',
    },
  },
  {
    date: '2026-04-30 ~ 05-01',
    tag: 'feature',
    zh: {
      title: '/wca/prediction + /algdb + /calendar 列表视图上线',
      body: '4-30 上 /prediction 项目理论极限与预测页 (667 行 PredictionPage + 317 行 EventSection + 315 行 charts.tsx)。5-1 上 /algdb 公式库 (从 speedcubedb scrape) + /prediction 完成 TheoreticalLimitView。同期 /calendar 加列表视图 + 范围过滤 + 每项目轮次 chip。',
      expand: '/wca/prediction 是用 WCA 历史数据估每项目"理论极限"再外推。/algdb 是 3x3 公式查询库 (OLL / PLL / F2L), 同期 Recon submit 加 cubedb.net 风格自动补全 + cubing.js cube3 阶段识别。ClearButton 抽组件统一所有 input 的清除 × 按钮, CuberSearchInput 207 行独立组件后续被多页复用。',
    },
    en: {
      title: '/wca/prediction + /algdb + /calendar list view launch',
      body: '4-30: /prediction event theoretical-limits + forecasts (667-line PredictionPage + 317-line EventSection + 315-line charts.tsx). 5-1: /algdb (scrape from speedcubedb) + /prediction completed with TheoreticalLimitView. Concurrently /calendar gains list view + range filter + per-event round chips.',
      expand: '/wca/prediction uses WCA history to estimate each event\'s "theoretical limit" then extrapolates. /algdb is a 3x3 algorithm reference (OLL / PLL / F2L); meanwhile Recon submit gains cubedb.net-style autofill + cubing.js cube3 stage detection. ClearButton component unifies all input × buttons; the 207-line CuberSearchInput later reused across pages.',
    },
  },
  {
    date: '2026-04-26 ~ 27',
    tag: 'feature',
    zh: {
      title: '/timer 速拧计时器上线 (TS 重写 + 116 commits 增强日)',
      body: '4-26 把 /timer 从零做 TS 重写 (Kociemba + 2D 预览 + 直方图 + cstimer JSON I/O + 全项目)。4-27 一天打了 116 commits 把 BLD / 分阶段 timing / 智能立方蓝牙 / 3D 预览 / WCA inspection / share URL / 全套移动适配 / CFOP 多阶段 / cstimer 算法引擎 port / 5 个蓝牙协议全做了。',
      expand: 'cstimer iframe 仍保留, /timer 是 nativeReact + 站点 i18n + WCA 登录 + 云同步的速拧计时器。5 个蓝牙协议指 GAN / Moyu / QY / GiiKER / Heykube。同日 shared components 第一波 (EventIcon / EventSelect / RecordSelect / RecordBadge) 抽出, WcaAuth + AuthCallbackPage 重做。',
    },
    en: {
      title: '/timer launches (TS rewrite + 116-commit polish day)',
      body: '4-26: /timer rewritten in TypeScript from scratch (Kociemba + 2D preview + histogram + cstimer JSON I/O + full event coverage). 4-27: 116 commits in one day adding BLD / stage timing / smartcube BT / 3D preview / WCA inspection / share URL / mobile polish / CFOP multi-stage / cstimer gSolver port / 5 BLE protocols.',
      expand: 'csTimer iframe is still retained — /timer is the native-React, site-i18n, WCA-login, cloud-sync timer. The 5 BLE protocols are GAN / Moyu / QiYi / GiiKER / Heykube. Same day: shared components first wave (EventIcon / EventSelect / RecordSelect / RecordBadge) extracted; WcaAuth + AuthCallbackPage rebuilt.',
    },
  },
  {
    date: '2026-04-24 ~ 25',
    tag: 'feature',
    zh: {
      title: '5 个新页两天上线 (/sites / /mosaic / /nemesizer / /wca/persons / /wb)',
      body: '4-24: /sites 站点导航 (2539 行 sites.ts) + /mosaic 魔方马赛克生成器 (port from Roman-/mosaic) + /nemesizer 初版 + /alg 内部 AlgCategoryPage。4-25: Nemesizer 完工 (port speedsolving wiki) + /wca/persons 与 /wca/persons/:wcaId (WcaPersonPicker 280k 本地索引 <20ms 搜索) + /wb 全球非官方纪录排名。',
      expand: 'Nemesizer 概念来自 speedsolving wiki: "你的克星" = 在你某项目区域内, 名次紧追你但还没超过你的人。/wca/persons 是 WCA 选手主页查询, 配 Hero card + PR table + 最近 12 场。这两天还顺手抽了 WheelPicker (354 行) 和 RecordBadge 通用组件。',
    },
    en: {
      title: 'Five new pages over two days (/sites / /mosaic / /nemesizer / /wca/persons / /wb)',
      body: '4-24: /sites navigation (2539-line sites.ts) + /mosaic generator (port from Roman-/mosaic) + /nemesizer v1 + /alg internal AlgCategoryPage. 4-25: Nemesizer completed (port from speedsolving wiki) + /wca/persons + /wca/persons/:wcaId (WcaPersonPicker 280k local index <20ms) + /wb world unofficial rankings.',
      expand: 'Nemesizer concept from speedsolving wiki: "your nemesis" = the cuber regionally ranked just behind you in an event who hasn\'t passed you yet. /wca/persons is a WCA cuber profile lookup with Hero card + PR table + last 12 comps. Same two-day window also extracted WheelPicker (354 lines) and RecordBadge generic components.',
    },
  },
  {
    date: '2026-04-22',
    tag: 'feature',
    zh: {
      title: '/scramble-stats 打乱难度分布页上线',
      body: 'ScrambleStatsPage 389 行 + DiscreteHistogram 208 行离散直方图 + 新建 core/packages/scramble-stats-build/ 包 (CSV → distribution.json 240 行 builder)。',
      expand: '数据源是 D:\\cube\\solver 这个 C++ 分析器跑出来的 CSV (每个项目 1M+ 打乱, 含 cross / x-cross / EO / 朝向 等阶段分布), 转成可视化分布。后续 5-3 加 sq1 / megaminx / pyraminx / skewb 多面体支持。',
    },
    en: {
      title: '/scramble-stats scramble-difficulty distribution page launches',
      body: '389-line ScrambleStatsPage + 208-line DiscreteHistogram + new core/packages/scramble-stats-build/ package (240-line CSV → distribution.json builder).',
      expand: 'Data comes from D:\\cube\\solver — a C++ analyzer producing CSVs (1M+ scrambles per event, with cross / x-cross / EO / orientation stage distributions), turned into visualisations. Later (5-3) extended to sq1 / megaminx / pyraminx / skewb non-cube puzzles.',
    },
  },
  {
    date: '2026-04-23',
    tag: 'feature',
    zh: {
      title: '/alg 教程 SPA 上线 (docx → SPA, 后改名 /tutorial)',
      body: 'AlgIndexPage 列表 + AlgPostPage 详情 + AlgArticleView/Card/Chip/Content + useAlgCatalog hook + 681 行 alg.css + 5 个 CaseCard/Modal/AlgsetView 组件。',
      expand: '当时数据源是 docx 解析出的 JSON, 两周后 (5-6) 才整体进 PG。5-3 把 /alg URL 整体改名为 /tutorial, 把 /alg 让给后来的 /algdb 公式库。',
    },
    en: {
      title: '/alg tutorial SPA launches (docx → SPA, later renamed /tutorial)',
      body: 'AlgIndexPage list + AlgPostPage detail + AlgArticleView/Card/Chip/Content + useAlgCatalog hook + 681-line alg.css + 5 CaseCard/Modal/AlgsetView components.',
      expand: 'Initial data came from docx-parsed JSON; two weeks later (5-6) it moved into PG. On 5-3 the URL was wholesale renamed from /alg to /tutorial, freeing /alg for the later /algdb algorithm reference.',
    },
  },
  {
    date: '2026-04-16 ~ 18',
    tag: 'feature',
    zh: {
      title: '/wca/globe 地球页 + Landing 重写',
      body: '4-16 上 /globe (903 行 GlobePage 用 three.js 转动地球展未来比赛点) + Landing 重写 (-283/+155 行减重 + LandingCubeHero 装饰 3D 魔方)。4-17 ~ 18 继续重写 372 行 + 949 行, 加银河系背景纹理 + 比赛 marker 聚合 + 搜索 (368 行)。',
      expand: '/wca/globe 是项目从"数据展示"到"沉浸式可视化"的跃迁。同期 LandingCubeHero 在 Landing 顶部循环跑 S\' U\' M\' y2 装饰动画, cubing/twisty 懒加载。4-20 再加 world_records_by_country 统计 + cn_disputed_patches.geojson 修中印 / 中尼争议边界。',
    },
    en: {
      title: '/wca/globe page + Landing rewrite',
      body: '4-16: /globe launches (903-line three.js earth showing upcoming comps) + Landing rewrite (-283/+155 lines slim-down + LandingCubeHero decorative 3D cube). 4-17 ~ 18: another 372 + 949 lines of rewriting, plus Milky Way background, marker clustering, search (368 lines).',
      expand: '/wca/globe was the leap from "data display" to "immersive visualisation". LandingCubeHero loops S\' U\' M\' y2 at the top of Landing, with cubing/twisty lazy-loaded. 4-20 added world_records_by_country stat + cn_disputed_patches.geojson correcting Sino-Indian / Sino-Nepalese disputed borders.',
    },
  },
  {
    date: '2026-04-06 ~ 16',
    tag: 'feature',
    zh: {
      title: '/frame-count 数帧工具上线 (10 天迭代成型)',
      body: '4-6 从零起步 (819 行页面 + 800 行 CSS + WebCodecs 帧缓冲 hook). 4-7 接 @ffmpeg/ffmpeg + WebCodecs GPU 零丢帧硬件管线. 4-8 与 Gemini 协作做两层渲染修丢帧. 4-13 加 A 键去重 + IndexedDB MRU 目录记忆 + 两阶段缩略图 + pinch 缩放. 4-14 加 timestamp 起表帧反推法 + Mark + Solve bands. 4-15 加 VideoInfoPanels codec/audio/VFR 诊断面板.',
      expand: 'Frame Count 是给比赛裁判 / 选手用的精确数帧工具 — 视频 fps 不稳 / VFR / iOS Safari 兼容是真实痛点。10 天里几乎每天都有具体的功能或 bug 修, 不是水的"持续迭代"。WebCodecs 是 Chrome 94+ API, 用硬件解码 + OffscreenCanvas crop + VideoEncoder + mp4-muxer 做零丢帧导出管线。',
    },
    en: {
      title: '/frame-count tool launches (10-day iteration to maturity)',
      body: '4-6 from zero (819-line page + 800-line CSS + WebCodecs frame buffer hook). 4-7 wires up @ffmpeg/ffmpeg + WebCodecs GPU zero-drop hardware pipeline. 4-8 two-tier render fix with Gemini collaboration. 4-13 adds A-key dedup + IndexedDB MRU dir memory + two-phase thumbnails + pinch zoom. 4-14 timestamp-based start-frame back-calc + Mark + Solve bands. 4-15 VideoInfoPanels codec/audio/VFR diagnostics.',
      expand: 'Frame Count is a precise frame-counting tool for competition judges / cubers — video FPS instability / VFR / iOS Safari compatibility are real pain points. Almost every day in those 10 days shipped a concrete feature or bug fix, not vague "iteration". WebCodecs is a Chrome 94+ API; combined with OffscreenCanvas crop + VideoEncoder + mp4-muxer it gives a zero-drop hardware export pipeline.',
    },
  },
  {
    date: '2026-04',
    tag: 'dx',
    zh: {
      title: 'typecheck 切到 tsc -b',
      body: '之前 references-only 根 tsconfig 让 tsc --noEmit 静默空跑, typo 永远过。',
      expand: '验证手段:故意写个不存在的标识符, 跑 typecheck 看会不会报。现在 typecheck 12s 增量、CI 用 --force 清缓存全量。',
    },
    en: {
      title: 'typecheck switched to tsc -b',
      body: 'Previously the references-only root tsconfig made tsc --noEmit silently no-op — typos passed forever.',
      expand: 'Detection: insert a fake identifier and run typecheck. Now incremental ~12s; CI uses --force to clear cache and re-check fully.',
    },
  },
  {
    date: '2026-03-24',
    tag: 'migration',
    zh: {
      title: 'Fastify → Hono (24 小时内换)',
      body: '前一天 (-03-23) 刚把 Fastify 接好, 第二天就整体换成 Hono, 22 个端点全转。',
      expand: '换 Hono 是因为 TS-first + 路由声明式 + 依赖 ~5MB (比 Fastify/Express 一个量级干净)。跑在 pm2 下, nginx 反代到 :3001。半个月时间里后端栈换了三次:Firestore → PHP/MariaDB (3-04) → Fastify (3-23) → Hono (3-24)。',
    },
    en: {
      title: 'Fastify → Hono (within 24h)',
      body: 'Fastify was wired up on -03-23; replaced wholesale by Hono the next day, all 22 endpoints converted.',
      expand: 'Hono chosen for TS-first + declarative routing + ~5MB deps (an order cleaner than Fastify/Express). Runs under pm2, nginx reverse-proxies to :3001. The backend stack changed three times in two weeks: Firestore → PHP/MariaDB (3-04) → Fastify (3-23) → Hono (3-24).',
    },
  },
  {
    date: '2026-03-23',
    tag: 'migration',
    zh: {
      title: 'React + TS monorepo 上线 + cubing.js',
      body: '从一堆 jQuery / 静态 HTML 工具整体迁到 React 19 + Vite + pnpm/Turbo monorepo。同一天接 cubing.js TwistyPlayer。',
      expand: '初始 4 个包:client + server + shared + stats-build。client 一开始迁了 12 个工具页 (calc / recon / viz / battle 等), 后续半年涨到 24+。cubing.js 落地后所有 PLL / OLL / scramble 动画统一走 TwistyPlayer, 手写魔方 SVG 全废。这是项目结构最大的一次跃变。',
    },
    en: {
      title: 'React + TS monorepo lands + cubing.js',
      body: 'Migrated a pile of jQuery / static-HTML tools onto a React 19 + Vite + pnpm/Turbo monorepo. cubing.js TwistyPlayer adopted the same day.',
      expand: 'Initial four packages: client + server + shared + stats-build. Client launched with 12 tool pages (calc / recon / viz / battle ...), grew to 24+ over six months. Once cubing.js landed, all PLL / OLL / scramble animations standardized on TwistyPlayer; hand-written cube SVG was retired. The single biggest structural leap in the project.',
    },
  },
  {
    date: '2026-03-21',
    tag: 'feature',
    zh: {
      title: '/wca/viz 成绩分布页上线',
      body: 'KDE / 直方图 / 山脊图 / 折线 4 种视图 + 多选手对比 + zoom/pan。3-22 再加累积直方图 + tooltip 卡片化 + 折线 zoom/pan + Non-PR WR 统计。',
      expand: '/wca/viz 是"看 cuber 群体成绩分布"的可视化页 — KDE 看哪个时段最厚, ridgeline 看进阶轨迹。多选手对比可以把你和顶级 cuber 同框看分布差。3-24 这页接着被 React 化收编进 monorepo。',
    },
    en: {
      title: '/wca/viz distribution page launches',
      body: 'KDE / histogram / ridgeline / line — 4 views + multi-player comparison + zoom/pan. 3-22 adds cumulative histogram + card tooltips + line zoom/pan + Non-PR WR stat.',
      expand: '/wca/viz visualises distributions across the cuber population — KDE shows where the mass concentrates, ridgeline shows progression. Multi-cuber comparison lets you overlay your distribution against top cubers. On 3-24 the page was Reactified into the monorepo.',
    },
  },
  {
    date: '2026-03-12 ~ 15',
    tag: 'feature',
    zh: {
      title: '第一轮工具集成 (HTH Calc / Alg-Trainers / csTimer / 1v1 Battle)',
      body: '4 天内集成 4 个 fork / port: HTH Calc (carykh/hthgrapher), Alg-Trainers (mihlefeld), csTimer (cs0x7f, GPL-3.0 self-hosted), 1v1 Battle (MatteoColombo/cube_challenge_timer)。',
      expand: 'csTimer 是 self-hosted (整个项目 vendor 进 /cstimer/) 不是 iframe; 其它 3 个当时还是静态嵌入。后来 (2026-03-23 monorepo 上线后) Calc / Battle 被重写成 React, Alg-Trainers 保留 fork 形态。',
    },
    en: {
      title: 'First wave of integrations (HTH Calc / Alg-Trainers / csTimer / 1v1 Battle)',
      body: 'Four forks / ports in four days: HTH Calc (carykh/hthgrapher), Alg-Trainers (mihlefeld), csTimer (cs0x7f, GPL-3.0 self-hosted), 1v1 Battle (MatteoColombo/cube_challenge_timer).',
      expand: 'csTimer is self-hosted (the whole upstream vendored into /cstimer/), not iframed; the other three were embedded statically at the time. After the monorepo landed (2026-03-23) Calc and Battle were rewritten in React; Alg-Trainers stayed in fork form.',
    },
  },
  {
    date: '2026-03-04',
    tag: 'migration',
    zh: {
      title: 'Firestore → PHP + MariaDB (自有云服务器)',
      body: '上线没几天的 Firestore 后端就被换成自有云服务器上自建的 PHP + MariaDB。第一次"自己运维一台机器"。',
      expand: 'Firestore 跨区延迟太高 + 配额太复杂, 不适合主要用户群单一地理位置的站点。这台 VM 后来也是现役那台的雏形 (2026-05 才把宝塔 panel 和 PHP 一起拆掉)。',
    },
    en: {
      title: 'Firestore → PHP + MariaDB (self-hosted VM)',
      body: 'Firestore — adopted only days earlier — was replaced with self-hosted PHP + MariaDB on a cloud VM. The first "run my own machine" moment.',
      expand: 'Firestore had cross-region latency issues plus complicated quotas — wrong fit for a site whose audience is concentrated in one geography. This VM later evolved into the current cloud-server (2026-05 finally stripped out baota panel + PHP together).',
    },
  },
  {
    date: '2026-02-27',
    tag: 'feature',
    zh: {
      title: '/recon Phase 1 + WCA OAuth',
      body: '/recon 上线: csv → JSON 复盘库 2017 条, 89 个选手。同一天接 WCA OAuth 登录 + Firestore 社区复盘存储。',
      expand: '一开始用 implicit grant 绕 CORS。Phase 1 的成绩库是 CSV 静态文件, 后来 (2026-03-04) 才进 MariaDB, (2026-05-06) 又进 PG。Recon 是项目第一个有"登录 + 写入"的功能, 把站点从展示性质拉到协作性质。',
    },
    en: {
      title: '/recon Phase 1 + WCA OAuth',
      body: '/recon launches: a CSV-to-JSON solve library with 2017 solves from 89 cubers. Same day: WCA OAuth login + Firestore community storage.',
      expand: 'Initially used the implicit grant to bypass CORS. Phase 1 stored data in static CSV; later went into MariaDB (2026-03-04), then PG (2026-05-06). Recon was the first feature with "login + write", which pulled the site from a showcase into a collaborative tool.',
    },
  },
  {
    date: '2026-02-26',
    tag: 'feature',
    zh: {
      title: 'Upcoming Comps 比赛追踪器上线',
      body: 'Upcoming Comps 页 (后来叫 /calendar): 列未来比赛 + 顶级选手 + 现/前 WR badge + 24h 缓存。',
      expand: '数据源: WCA API + 部分非官方比赛接 cubing.com (WCA API 不覆盖非官方 NF 比赛)。这是站点第一个"有时效性"的页 — 不只看历史成绩, 还展望未来。后续 4-30 加列表视图, 4-28 加 /calendar/stats 子页。',
    },
    en: {
      title: 'Upcoming Comps tracker launches',
      body: 'Upcoming Comps page (later renamed /calendar): lists future competitions + top cubers attending + current/former WR badges + 24h cache.',
      expand: 'Data sources: WCA API + cubing.com for non-WCA comps (the WCA API doesn\'t include unofficial NF events). This was the site\'s first "time-sensitive" page — not just historical data, but a forward view. Later 4-30 adds list view, 4-28 adds /calendar/stats subpage.',
    },
  },
  {
    date: '2026-02-18',
    tag: 'feature',
    zh: {
      title: '第一个 Landing 页 — Solver + WCA Stats 双卡',
      body: '从单页 index.html 变成有真正"首页"的站点。Solver 和 WCA Stats 两张入口卡, 配 i18n (en/zh)。',
      expand: '同期把 Solver (or18/RubiksSolverDemo fork) 的 UI 文字也翻译成中文。这是站点开始有"产品形态"的起点。后来 26 张卡片都从这里长出来。',
    },
    en: {
      title: 'First landing page — Solver + WCA Stats',
      body: 'The site evolved from a single index.html into one with a real homepage. Two entry cards (Solver / WCA Stats), plus i18n (en/zh).',
      expand: 'Solver (forked from or18/RubiksSolverDemo) had its UI translated to Chinese the same day. This is when the site started to feel like a product. Eventually 26 cards grew out of this layout.',
    },
  },
  {
    date: '2026-02-17',
    tag: 'infra',
    zh: {
      title: 'WCA Statistics 数据管道 (CI 周更)',
      body: 'GitHub Actions 每周从 WCA 公开 dump 拉数据, 跑统计脚本, 产物入仓。第一次"自动化数据流水线"。',
      expand: '当时是 Ruby 脚本, 后来 (2026-03-23 monorepo) 整体重写为 TS 跑在 stats-build 包里。原项目灵感来自 jonatanklosko/wca_statistics, 后来扩到 80+ 张统计页。',
    },
    en: {
      title: 'WCA Statistics data pipeline (weekly CI)',
      body: 'GitHub Actions pulls the WCA public dump weekly, runs statistics scripts, commits the artifacts. The site\'s first automated data pipeline.',
      expand: 'Originally a set of Ruby scripts, later rewritten in TypeScript inside the stats-build package (2026-03-23 monorepo). Inspired by jonatanklosko/wca_statistics; grew into 80+ stat pages.',
    },
  },
  {
    date: '2025-12-13',
    tag: 'infra',
    zh: {
      title: '项目诞生 — 一个 index.html',
      body: 'GitHub Pages 上的一个 repo, 一个空的 index.html, 一份 README。完。',
      expand: '初次 push 那天没有任何工具 / 后端 / 数据, 就是个壳。后两个月里慢慢往里塞 fork 的工具页 (Solver / Alg-Trainers 等)。整站第一个有数据的功能要等到 2026-02-17 的 WCA Statistics 才出现 — 也就是说前 65 天基本只在排版。',
    },
    en: {
      title: 'Day zero — one index.html',
      body: 'A repo on GitHub Pages, an empty index.html, a README. That\'s it.',
      expand: 'The day-one push had no tools, no backend, no data — just a shell. Over the next two months it slowly accumulated forked tool pages (Solver, Alg-Trainers, etc.). The first feature with real data didn\'t arrive until 2026-02-17 (WCA Statistics), meaning the first 65 days were essentially layout work.',
    },
  },
];
