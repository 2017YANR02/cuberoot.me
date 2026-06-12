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
    zhHant?: string;
}
export const MODULES: Mod[] = [
  { route: '/recon',          zh: '复盘',        en: 'Recon',        origin: 'own',  zhDesc: '比赛复盘 + 同轮自动带入',       enDesc: 'Result review + same-round autofill',
      zhHant: "覆盤"
},
  { route: '/trainer',        zh: '公式训练',    en: 'Trainer',      origin: 'own',  zhDesc: '41 套公式计时训练',              enDesc: '41 algorithm sets with timing',
      zhHant: "公式訓練"
},
  { route: '/frame-count',    zh: '逐帧',        en: 'Frame Count',  origin: 'own',  zhDesc: 'WebCodecs + mp4box.js',          enDesc: 'WebCodecs + mp4box.js',
      zhHant: "逐幀"
},
  { route: '/wca/viz',            zh: '成绩分布',    en: 'Distribution', origin: 'own',  zhDesc: '成绩分布可视化',                 enDesc: 'Result distribution viz',
      zhHant: "成績分佈"
},
  { route: '/wca/calendar',       zh: '比赛日历',    en: 'Calendar',     origin: 'own',  zhDesc: '全球比赛日历',                   enDesc: 'Global comp calendar',
      zhHant: "比賽日曆"
},
  { route: '/scramble-stats', zh: '打乱难度',    en: 'Scramble',     origin: 'own',  zhDesc: '打乱难度分布',                   enDesc: 'Scramble difficulty',
      zhHant: "打亂難度"
},
  { route: '/wca',      zh: 'WCA 统计',    en: 'WCA Stats',    origin: 'own',  zhDesc: '80+ 统计页, 周更',               enDesc: '80+ pages, weekly',
      zhHant: "WCA 統計"
},
  { route: '/recognize/pll',  zh: 'PLL 识别',    en: 'Recognize',    origin: 'own',  zhDesc: '看图答字母训练',                 enDesc: 'Image-to-letter drill',
      zhHant: "PLL 識別"
},
  { route: '/calc',           zh: 'HTH 计算',    en: 'HTH Calc',     origin: 'port', zhDesc: 'port: carykh/hthgrapher',        enDesc: 'port: carykh/hthgrapher',
      zhHant: "HTH 計算"
},
  { route: '/timer?players=2', zh: '1v1',         en: 'Battle',       origin: 'port', zhDesc: 'port: MatteoColombo',            enDesc: 'port: MatteoColombo' },
  { route: '/mosaic',         zh: '马赛克',      en: 'Mosaic',       origin: 'port', zhDesc: 'port: Roman-/mosaic',            enDesc: 'port: Roman-/mosaic',
      zhHant: "馬賽克"
},
  { route: '/cstimer',        zh: 'csTimer',     en: 'csTimer',      origin: 'fork', zhDesc: 'fork: cs0x7f/cstimer',           enDesc: 'fork: cs0x7f/cstimer' },
  { route: '/solver',         zh: '复原器',      en: 'Solver',       origin: 'fork', zhDesc: 'fork: or18/RubiksSolverDemo',    enDesc: 'fork: or18/RubiksSolverDemo',
      zhHant: "復原器"
},
  { route: '/alg-trainers',   zh: '公式训练器',  en: 'Alg Trainers', origin: 'fork', zhDesc: 'fork: mihlefeld/Alg-Trainers',   enDesc: 'fork: mihlefeld/Alg-Trainers',
      zhHant: "公式訓練器"
},
];

export interface Decision {
  topic: string;
  pick: string;
  alt: string;
  zh: string;
  en: string;
    zhHant?: string;
}
export const DECISIONS: Decision[] = [
  { topic: 'UI library',  pick: 'React 19',         alt: 'Vue / Svelte / Solid',  zh: '生态最广;cubing.js / sr-puzzlegen 等魔方库的示例都是 React;团队熟。',                en: 'Widest ecosystem; cubing.js / sr-puzzlegen samples are React; team familiarity.',
      zhHant: "生態最廣;cubing.js / sr-puzzlegen 等魔方庫的示例都是 React;團隊熟。"
},
  { topic: 'Framework',   pick: 'Next.js 16 (App Router)', alt: 'Remix / TanStack Start / 纯 Vite SPA', zh: 'App Router + RSC + 服务端 streaming 一体, Turbopack dev/build; 双部署 (systemd standalone + Vercel) 同一份代码。Phase 4 (2026-05) 从 React Router SPA 整体切过来。', en: 'App Router + RSC + server streaming in one; Turbopack dev/build; one codebase deploys to both systemd standalone and Vercel. Cut over from React Router SPA in Phase 4 (2026-05).',
      zhHant: "App Router + RSC + 服務端 streaming 一體, Turbopack dev/build; 雙部署 (systemd standalone + Vercel) 同一份程式碼。Phase 4 (2026-05) 從 React Router SPA 整體切過來。"
},
  { topic: 'Bundler',     pick: 'Turbopack',        alt: 'Webpack / Vite',        zh: 'Next.js 16 自带, dev incremental compile + prod build 都走它;首次冷编 30-90s, 之后增量 sub-second。',                          en: 'Bundled with Next.js 16, drives both dev incremental compile and prod build; first cold compile 30-90s, then sub-second incremental.',
      zhHant: "Next.js 16 自帶, dev incremental compile + prod build 都走它;首次冷編 30-90s, 之後增量 sub-second。"
},
  { topic: 'Styling',     pick: '手写语义化 CSS + Tailwind 4 base', alt: '纯 Tailwind / CSS-in-JS', zh: '主样式每页一份手写 CSS (compare.css / stack_landing.css 这类, 用 .compare-card 这种页面前缀语义名)。Tailwind 4 通过 @tailwindcss/postcss 装着, app/globals.css 一行 @import "tailwindcss" 拉进 preflight + utility 命名空间作 base 层兜底, 不写 className="flex p-4"。主题 token 走 shadcn 命名 + CSS 变量。', en: 'Per-page hand-written semantic CSS is the primary style layer (compare.css / stack_landing.css etc., page-prefixed names like .compare-card). Tailwind 4 is wired via @tailwindcss/postcss + a single @import "tailwindcss" in app/globals.css — it supplies preflight + a utility namespace as the base layer, but className="flex p-4" is not the idiom. Theme tokens use shadcn naming + CSS custom properties.',
      zhHant: "主樣式每頁一份手寫 CSS (compare.css / stack_landing.css 這類, 用 .compare-card 這種頁面字首語義名)。Tailwind 4 透過 @tailwindcss/postcss 裝著, app/globals.css 一行 @import \"tailwindcss\" 拉進 preflight + utility 名稱空間作 base 層兜底, 不寫 className=\"flex p-4\"。主題 token 走 shadcn 命名 + CSS 變數。"
},
  { topic: 'API server',  pick: 'Hono',             alt: 'Express / Fastify',     zh: 'TypeScript 一等公民;路由声明式;5 MB 依赖比 express 干净一个量级。',                en: 'TS-first; declarative routing; ~5MB deps vs Express noisy stack.',
      zhHant: "TypeScript 一等公民;路由宣告式;5 MB 依賴比 express 乾淨一個量級。"
},
  { topic: 'Database',    pick: 'PostgreSQL 13',    alt: 'MariaDB / MongoDB',     zh: '2026-05 从 MariaDB 整体迁过来。jsonb / window function / partial index 比 MariaDB 强一档。', en: 'Migrated from MariaDB 2026-05. jsonb, window functions, partial indexes — a tier above MariaDB.',
      zhHant: "2026-05 從 MariaDB 整體遷過來。jsonb / window function / partial index 比 MariaDB 強一檔。"
},
  { topic: 'Monorepo',    pick: 'pnpm + Turbo',     alt: 'npm / yarn workspaces', zh: '4 个核心 workspace (client / server / shared / stats-build), 一份 pnpm-lock。硬链接 node_modules 省盘;Turbo 缓存只跑改动到的 package。底层 registry 仍是 npm (registry.npmjs.org), pnpm 只是更快的客户端。', en: 'Four core workspaces (client / server / shared / stats-build), one pnpm-lock. Hard-linked node_modules saves disk; Turbo runs only changed packages. The underlying registry is still npm (registry.npmjs.org) — pnpm is just a faster client.',
      zhHant: "4 個核心 workspace (client / server / shared / stats-build), 一份 pnpm-lock。硬連結 node_modules 省盤;Turbo 快取只跑改動到的 package。底層 registry 仍是 npm (registry.npmjs.org), pnpm 只是更快的客戶端。"
},
  { topic: 'State mgmt',  pick: 'Zustand',          alt: 'Redux Toolkit / Jotai / Context', zh: '11 个 store (6 全局 + 5 页面级)。无 Provider, create() 返回 hook, 选 selector 拿切片。auth 走 storage 事件跨标签同步, settings/sessions 用 persist 中间件落 localStorage。打包后约 1 KB。', en: '11 stores (6 global + 5 page-local). No Provider — create() returns a hook, components select slices. auth syncs across tabs via the storage event; settings/sessions persist to localStorage via middleware. ~1 KB bundle cost.',
      zhHant: "11 個 store (6 全域性 + 5 頁面級)。無 Provider, create() 返回 hook, 選 selector 拿切片。auth 走 storage 事件跨標籤同步, settings/sessions 用 persist 中介軟體落 localStorage。打包後約 1 KB。"
},
  { topic: 'URL state',   pick: 'nuqs',             alt: '手写 history.pushState / router.replace / useState', zh: '页内"在哪个视图 / tab / 筛选 / 搜索"统一进 URL search params, 一处声明 useQueryState / useQueryStates。视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。替掉全站各写各的 history.pushState/replaceState + 手写 popstate;一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。', en: 'In-page "which view / tab / filter / search" lives in URL search params, declared once via useQueryState / useQueryStates. Views / tabs / modes / overlays push to history (back returns); filters / sort / search replace (no pile-up). Replaced the site-wide grab-bag of raw history.pushState/replaceState + hand-rolled popstate; a PreToolUse hook blocks at write time and a vitest guard backstops CI, with a few exemptions (maplibre, zustand data serialization).',
      zhHant: "頁內\"在哪個檢視 / tab / 篩選 / 搜尋\"統一進 URL search params, 一處宣告 useQueryState / useQueryStates。檢視 / tab / 模式 / 浮層 push 進歷史(後退能返回), 篩選 / 排序 / 搜尋 replace(不堆歷史)。替掉全站各寫各的 history.pushState/replaceState + 手寫 popstate;一個 PreToolUse hook 寫入即攔 + 一條 vitest 守衛 CI 兜底, 僅 maplibre / zustand 資料序列化等少數處豁免。"
},
  { topic: 'Hosting',     pick: '自有 VM nginx + Vercel (DNS 分线路)', alt: '单 Vercel / 单 nginx', zh: 'DNS 按线路分流, 同一份 Next.js 代码两边跑。一条线路 → 自有 VM nginx → systemd Next standalone (反代 :3002, deploy_next.yml CI 自动 scp + 原子 swap);另一条线路 → Vercel Hobby edge (push GitHub 自动部署)。后端 Hono+PG 始终在同一台 VM, Vercel 端通过 api.cuberoot.me 调。', en: 'Split-horizon DNS, same Next.js codebase on both. One line → self-hosted VM nginx → systemd Next standalone (reverse-proxy :3002, deploy_next.yml CI auto scp + atomic swap); the other line → Vercel Hobby edge (push-to-GitHub auto-deploy). Backend Hono+PG stays on the same VM; Vercel side hits it via api.cuberoot.me.',
      zhHant: "DNS 按線路分流, 同一份 Next.js 程式碼兩邊跑。一條線路 → 自有 VM nginx → systemd Next standalone (反代 :3002, deploy_next.yml CI 自動 scp + 原子 swap);另一條線路 → Vercel Hobby edge (push GitHub 自動部署)。後端 Hono+PG 始終在同一臺 VM, Vercel 端透過 api.cuberoot.me 調。"
},
  { topic: 'Theme tokens', pick: 'shadcn 命名 + hex + color-mix', alt: 'oklch / Material 3 / Radix Colors', zh: '8 页双主题切换。命名跟 OSS 标准 shadcn (AI 写代码命中率高);色值 hex (调研 30+ 大厂含 Anthropic console 自己,0 家把 oklch 当主品牌 token);衍生用 color-mix(in srgb) 跟 Anthropic CDS 实战用法 (644 处) 对齐。', en: 'Dark/light across 8 pages. Naming follows shadcn (OSS standard, friendly to AI code-gen); hex values (surveyed 30+ big-co incl. Anthropic console — zero use oklch as primary brand tokens); derivations via color-mix(in srgb) aligning with Anthropic CDS (644 production uses).',
      zhHant: "8 頁雙主題切換。命名跟 OSS 標準 shadcn (AI 寫程式碼命中率高);色值 hex (調研 30+ 大廠含 Anthropic console 自己,0 家把 oklch 當主品牌 token);衍生用 color-mix(in srgb) 跟 Anthropic CDS 實戰用法 (644 處) 對齊。"
},
];

export interface Detail {
  title: string;
  zh: ReactNode;
  en: ReactNode;
    zhHant?: ReactNode;
}
export const DETAILS: Detail[] = [
  {
    title: 'SharedArrayBuffer · COOP/COEP',
    zh: <><strong>/scramble/solver</strong> 和 <strong>/scramble/analyzer</strong> 跑 cubeopt-wasm, 需要 <code>SharedArrayBuffer</code>。仅这两条 route 由 nginx 注入 <code>COOP=same-origin</code> + <code>COEP=require-corp</code> 进 cross-origin isolated。其它 24 张卡完全干净, 登录回调不受影响。</>,
    en: <><strong>/scramble/solver</strong> and <strong>/scramble/analyzer</strong> run cubeopt-wasm and require <code>SharedArrayBuffer</code>. Only those two routes get nginx-injected <code>COOP=same-origin</code> + <code>COEP=require-corp</code> for cross-origin isolation. Every other page stays clean — login callbacks unaffected.</>,
      zhHant: <><strong>/scramble/solver</strong> 和 <strong>/scramble/analyzer</strong> 跑 cubeopt-wasm, 需要 <code>SharedArrayBuffer</code>。僅這兩條 route 由 nginx 注入 <code>COOP=same-origin</code> + <code>COEP=require-corp</code> 進 cross-origin isolated。其它 24 張卡完全乾淨, 登入回撥不受影響。</>
},
  {
    title: 'apiUrl() 是唯一的 fetch 入口',
    zh: <>客户端不能硬编码 origin。<code>lib/api-base.ts</code> 的 <code>apiUrl()</code> 用 <code>import.meta.env.DEV</code> 切换:dev 走 <code>next.config.ts</code> 里 <code>rewrites()</code> 反代 <code>api.cuberoot.me</code>, prod 直打 <code>api.cuberoot.me</code>。<code>hostname</code> 检测会被 Tailscale / LAN IP 骗到, 绝对禁用。</>,
    en: <>Client never hardcodes origin. <code>lib/api-base.ts</code> uses <code>import.meta.env.DEV</code>: dev → <code>next.config.ts</code> <code>rewrites()</code> proxy to <code>api.cuberoot.me</code>, prod → direct <code>api.cuberoot.me</code>. <code>hostname</code> checks get fooled by Tailscale / LAN IP — banned.</>,
      zhHant: <>客戶端不能硬編碼 origin。<code>lib/api-base.ts</code> 的 <code>apiUrl()</code> 用 <code>import.meta.env.DEV</code> 切換:dev 走 <code>next.config.ts</code> 裡 <code>rewrites()</code> 反代 <code>api.cuberoot.me</code>, prod 直打 <code>api.cuberoot.me</code>。<code>hostname</code> 檢測會被 Tailscale / LAN IP 騙到, 絕對禁用。</>
},
  {
    title: 'cubing.js + sr-puzzlegen + visualcube 三件套',
    zh: <><strong>cubing.js</strong> 渲染动画 (TwistyPlayer)、跑 3x3 / 4x4 求解器。<strong>sr-puzzlegen</strong> 出 sq1 / megaminx / pyraminx / skewb 静态 SVG。<strong>visualcube</strong> 出 NxN 状态图 (F2L / OLL / PLL / ZBLL)。三者各管一块, <strong>禁止手写魔方 SVG</strong>。</>,
    en: <><strong>cubing.js</strong> for animation (TwistyPlayer) and 3x3/4x4 solvers. <strong>sr-puzzlegen</strong> for sq1 / megaminx / pyraminx / skewb SVGs. <strong>visualcube</strong> for NxN state images (F2L / OLL / PLL / ZBLL). Three libs, three lanes — <strong>hand-written cube SVG is banned</strong>.</>,
      zhHant: <><strong>cubing.js</strong> 渲染動畫 (TwistyPlayer)、跑 3x3 / 4x4 求解器。<strong>sr-puzzlegen</strong> 出 sq1 / megaminx / pyraminx / skewb 靜態 SVG。<strong>visualcube</strong> 出 NxN 狀態圖 (F2L / OLL / PLL / ZBLL)。三者各管一塊, <strong>禁止手寫魔方 SVG</strong>。</>
},
  {
    title: 'i18n — 两种 pattern 并存',
    zh: <>大段文案走 <code>t()</code> + <code>en.json</code> / <code>zh.json</code>;组件内零散文案走 <code>isZh ? 'X' : 'Y'</code> 三元。<code>LangToggle</code> 每页右上角, 默认跟系统语言。WCA 比赛中文名独立走 <code>comp_names_zh.json</code>。</>,
    en: <>Long blocks → <code>t()</code> + <code>en.json</code>/<code>zh.json</code>; inline strings → <code>isZh ? 'X' : 'Y'</code> ternary. <code>LangToggle</code> sits top-right on every page. Chinese comp names live in a separate <code>comp_names_zh.json</code>.</>,
      zhHant: <>大段文案走 <code>t()</code> + <code>en.json</code> / <code>zh.json</code>;元件內零散文案走 <code>isZh ? 'X' : 'Y'</code> 三元。<code>LangToggle</code> 每頁右上角, 預設跟系統語言。WCA 比賽中文名獨立走 <code>comp_names_zh.json</code>。</>
},
  {
    title: 'Theme — dark / light / system 三态',
    zh: <>shadcn 风 token (<code>--background --foreground --muted-foreground --accent --signal-*</code>) 在 <code>:root</code>, light 默认 + <code>@media (prefers-color-scheme: dark)</code> + <code>html[data-theme]</code> 双轨反盖。衍生色一律 <code>color-mix(in srgb, var(--base) X%, transparent)</code>, 改 base 一处自动跟。<code>ThemeToggle</code> 每页右上角循环 system → light → dark, 存 <code>localStorage.theme</code>, 启动 <code>bootstrapTheme()</code> 挂 <code>html[data-theme]</code>。8 页支持切换 (3 双主题 + 4 dark-locked + 1 light-locked), 其它老页跑 legacy <code>--bg-primary --text-primary</code> 不动。</>,
    en: <>shadcn-style tokens (<code>--background --foreground --muted-foreground --accent --signal-*</code>) live in <code>:root</code>, light defaults + <code>@media (prefers-color-scheme: dark)</code> + <code>html[data-theme]</code> dual override. Derivations always go through <code>color-mix(in srgb, var(--base) X%, transparent)</code> so changing one base ripples to all. <code>ThemeToggle</code> sits top-right and cycles system → light → dark, persists to <code>localStorage.theme</code>, applied via <code>bootstrapTheme()</code> at startup. 8 pages support switching (3 dual-theme + 4 dark-locked + 1 light-locked); legacy pages still use the old <code>--bg-primary --text-primary</code> tokens untouched.</>,
      zhHant: <>shadcn 風 token (<code>--background --foreground --muted-foreground --accent --signal-*</code>) 在 <code>:root</code>, light 預設 + <code>@media (prefers-color-scheme: dark)</code> + <code>html[data-theme]</code> 雙軌反蓋。衍生色一律 <code>color-mix(in srgb, var(--base) X%, transparent)</code>, 改 base 一處自動跟。<code>ThemeToggle</code> 每頁右上角迴圈 system → light → dark, 存 <code>localStorage.theme</code>, 啟動 <code>bootstrapTheme()</code> 掛 <code>html[data-theme]</code>。8 頁支援切換 (3 雙主題 + 4 dark-locked + 1 light-locked), 其它老頁跑 legacy <code>--bg-primary --text-primary</code> 不動。</>
},
  {
    title: 'WCA 统计的脆弱三角',
    zh: <>新增一个 stat 表要同步改三处:<code>stats-build/src/bin/*.ts</code> (写 TSV)、<code>.github/workflows/stats.yml</code> (scp 清单)、<code>ops/sql/load.sql</code> (<code>\copy</code> 引用)。漏一处, 服务器表静默为空, nginx 还缓存 24 小时。dry-run grep 三段对照是唯一保险。</>,
    en: <>Adding a stat table needs three coordinated edits: <code>stats-build/src/bin/*.ts</code> (writes TSV), <code>.github/workflows/stats.yml</code> (scp manifest), <code>ops/sql/load.sql</code> (<code>\copy</code> reference). Miss one and the server table silently empties — nginx still caches 24h. The only safety net: a 30-second grep dry-run across all three.</>,
      zhHant: <>新增一個 stat 表要同步改三處:<code>stats-build/src/bin/*.ts</code> (寫 TSV)、<code>.github/workflows/stats.yml</code> (scp 清單)、<code>ops/sql/load.sql</code> (<code>\copy</code> 引用)。漏一處, 伺服器表靜默為空, nginx 還快取 24 小時。dry-run grep 三段對照是唯一保險。</>
},
  {
    title: 'fork / port / own 三种治理',
    zh: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream 静态资源原样托管, 只改外层包装。<strong>port</strong> (Calc / Battle / Mosaic) = 把别人的 React / HTML 重写一遍。<strong>own</strong> (其它 11 个) = 自己设计 + 实现。改 fork / port 前必须确认 upstream。</>,
    en: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream assets hosted as-is, only the outer shell is ours. <strong>port</strong> (Calc / Battle / Mosaic) = someone else's React / HTML, rewritten in this repo. <strong>own</strong> (the other 11) = designed and built here. Touching a fork or port? Check upstream first.</>,
      zhHant: <><strong>fork</strong> (csTimer / Solver / Alg Trainers) = upstream 靜態資源原樣託管, 只改外層包裝。<strong>port</strong> (Calc / Battle / Mosaic) = 把別人的 React / HTML 重寫一遍。<strong>own</strong> (其它 11 個) = 自己設計 + 實現。改 fork / port 前必須確認 upstream。</>
},
  {
    title: '状态管理 — Zustand(内存)+ nuqs(URL)',
    zh: <>客户端内存 / 持久化状态走 <strong>Zustand</strong>:<code>auth_store</code> (WCA OAuth 用户)、<code>settingsStore</code> (主题 / 语言, persist)、<code>sessionStore</code> (当前 solve 会话, persist)、<code>statsStore</code> (WCA stats 查询)、<code>trainerStore</code> (训练状态, persist)、<code>recon_store</code> (复盘缓存);页面级 store 跟着各自 page 走 (battle / calc / mosaic / viz)。模式统一:<code>create()</code> 返回 hook, 不用 Provider, 不写 reducer。<strong>URL 状态</strong>(在哪个视图 / tab / 筛选 / 搜索)统一走 <strong>nuqs</strong> 的 <code>useQueryState</code> 写进 query params — 刷新可恢复、能分享深链、前进后退正常:大视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。禁裸 <code>history.pushState/replaceState</code> + 手写 popstate, 一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫在 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。</>,
    en: <>In-memory / persisted client state uses <strong>Zustand</strong>: <code>auth_store</code> (WCA OAuth user), <code>settingsStore</code> (theme / lang, persisted), <code>sessionStore</code> (active solve session, persisted), <code>statsStore</code> (WCA stats query), <code>trainerStore</code> (drill state, persisted), <code>recon_store</code> (recon cache); page-local stores live next to their pages (battle / calc / mosaic / viz). One pattern throughout: <code>create()</code> returns a hook — no Provider, no reducer. <strong>URL state</strong> (which view / tab / filter / search) goes through <strong>nuqs</strong> <code>useQueryState</code> into the query params — survives refresh, shareable deep links, correct back/forward: big views / tabs / modes / overlays push to history (back returns), filters / sort / search replace (no history pile-up). Raw <code>history.pushState/replaceState</code> and hand-rolled popstate are banned — a PreToolUse hook blocks them at write time and a vitest guard backstops CI, with only a few exemptions (maplibre, zustand data serialization).</>,
      zhHant: <>客戶端記憶體 / 持久化狀態走 <strong>Zustand</strong>:<code>auth_store</code> (WCA OAuth 使用者)、<code>settingsStore</code> (主題 / 語言, persist)、<code>sessionStore</code> (當前 solve 會話, persist)、<code>statsStore</code> (WCA stats 查詢)、<code>trainerStore</code> (訓練狀態, persist)、<code>recon_store</code> (覆盤快取);頁面級 store 跟著各自 page 走 (battle / calc / mosaic / viz)。模式統一:<code>create()</code> 返回 hook, 不用 Provider, 不寫 reducer。<strong>URL 狀態</strong>(在哪個檢視 / tab / 篩選 / 搜尋)統一走 <strong>nuqs</strong> 的 <code>useQueryState</code> 寫進 query params — 重新整理可恢復、能分享深鏈、前進後退正常:大檢視 / tab / 模式 / 浮層 push 進歷史(後退能返回), 篩選 / 排序 / 搜尋 replace(不堆歷史)。禁裸 <code>history.pushState/replaceState</code> + 手寫 popstate, 一個 PreToolUse hook 寫入即攔 + 一條 vitest 守衛在 CI 兜底, 僅 maplibre / zustand 資料序列化等少數處豁免。</>
},
  {
    title: 'npm registry — 我们用 pnpm 但拉的是 npm',
    zh: <><code>pnpm install</code> 跑的是从 <code>registry.npmjs.org</code> 下 tarball 这件事。yarn / pnpm / bun 都是同一 registry 的不同客户端, 都共享 <code>package.json</code> + <code>semver</code> + lockfile 这套 npm 定义的协议。选 pnpm 是因为硬链接 store 省盘 + Turbo cache 友好 + monorepo workspaces 体验好;但 4M+ 包 + 周下载几千亿次的护城河, 始终在 npm 那一头。</>,
    en: <><code>pnpm install</code> still fetches tarballs from <code>registry.npmjs.org</code>. yarn / pnpm / bun are different clients of the same registry, all sharing the <code>package.json</code> + <code>semver</code> + lockfile protocol that npm defined. We pick pnpm for hard-linked store (disk savings), Turbo-cache friendliness, and good workspaces — but the moat (4M+ packages, hundreds of billions of weekly downloads) is at npm's end.</>,
      zhHant: <><code>pnpm install</code> 跑的是從 <code>registry.npmjs.org</code> 下 tarball 這件事。yarn / pnpm / bun 都是同一 registry 的不同客戶端, 都共享 <code>package.json</code> + <code>semver</code> + lockfile 這套 npm 定義的協議。選 pnpm 是因為硬連結 store 省盤 + Turbo cache 友好 + monorepo workspaces 體驗好;但 4M+ 包 + 周下載幾千億次的護城河, 始終在 npm 那一頭。</>
},
];

export type StageId = 'browser' | 'edge' | 'spa' | 'fetch' | 'api' | 'hono' | 'pg';

export interface Stage { id: StageId; zh: string; en: string; sub: string;
    zhHant?: string;
 }
export const TRACER_STAGES: Stage[] = [
  { id: 'browser', zh: '浏览器',           en: 'Browser',           sub: 'fetch / nav',
      zhHant: "瀏覽器"
},
  { id: 'edge',    zh: 'cuberoot.me nginx', en: 'cuberoot.me nginx', sub: 'static + try_files' },
  { id: 'spa',     zh: 'Next 启动',         en: 'Next boot',         sub: 'App Router + RSC',
      zhHant: "Next 啟動"
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
    zhHant?: { label: string; detail: string };
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
      zhHant: { label: '開啟首頁', detail: 'LandingPage 是構建期靜態預渲染 (SSG) 的 HTML, 由 CDN / nginx 直出, 不進 Next 函式; 客戶端 hydrate 後再 client 端取動態資料 (近期比賽 / 紀錄)。' }
},
  {
    id: 'recon-fresh',
    route: '/recon/abc',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api', 'hono', 'pg'],
    cacheHit: false,
    eta: '~40ms (API 部分)',
    zh: { label: '首次打开复盘', detail: 'Next 服端渲染 shell 返回后, 客户端 hydrate 调 apiUrl("/v1/recon/abc")。/v1/recon/* 不在 24h cache 白名单, 整条管道穿透:Hono 查 PG, 反序列化, 返回 JSON。' },
    en: { label: 'First-time recon view', detail: 'After Next streams the SSR shell back, the client hydrates and fetches apiUrl("/v1/recon/abc"). /v1/recon/* is not in the 24h proxy_cache allowlist, so the request flows through to Hono → PG, deserializes, returns JSON.' },
      zhHant: { label: '首次開啟復盤', detail: 'Next 服端渲染 shell 返回後, 客戶端 hydrate 調 apiUrl("/v1/recon/abc")。/v1/recon/* 不在 24h cache 白名單, 整條管道穿透:Hono 查 PG, 反序列化, 返回 JSON。' }
},
  {
    id: 'wca-cached',
    route: '/wca/all-results?show=persons',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api'],
    cacheHit: true,
    eta: '< 10ms (cache hit)',
    zh: { label: '回访 WCA 统计', detail: '24h 内重复访问 stat 数据。nginx proxy_cache 在 :api 这一层 hit, 直接吐 JSON, 不打 Hono、不打 PG。每天首次访问才真正穿透。' },
    en: { label: 'Revisit WCA stat', detail: 'Repeat visit within 24h. nginx proxy_cache hits at the :api stage, returns JSON directly — Hono and PG untouched. Only the first request each day pierces the cache.' },
      zhHant: { label: '回訪 WCA 統計', detail: '24h 內重複訪問 stat 資料。nginx proxy_cache 在 :api 這一層 hit, 直接吐 JSON, 不打 Hono、不打 PG。每天首次訪問才真正穿透。' }
},
  {
    id: 'iframe-fork',
    route: '/tools/cstimer/index.html',
    lit: ['browser', 'edge'],
    cacheHit: false,
    eta: '< 10ms (静态)',
    zh: { label: '打开 fork 内部页', detail: 'fork 项目的内部页面 (iframe src)。nginx 直接服 /tools/cstimer/ 静态 HTML, 不打 Next, 不打 API。从 Next 路由 /cstimer 进来时再加一层 Next page + iframe 套娃。' },
    en: { label: 'Fork inner page', detail: 'Inside-iframe page of a forked project. nginx serves /tools/cstimer/ static HTML directly — no Next, no API. From the Next route /cstimer, you wrap an extra Next page + iframe around this.' },
      zhHant: { label: '開啟 fork 內部頁', detail: 'fork 項目的內部頁面 (iframe src)。nginx 直接服 /tools/cstimer/ 靜態 HTML, 不打 Next, 不打 API。從 Next 路由 /cstimer 進來時再加一層 Next page + iframe 套娃。' }
},
];

// 写作约定(列表 TIMELINE + 日历 timeline_commits.json 同此): 内容面向访客(速拧玩家 / 普通访客),
// 不是开发日志。极简——title 点明用户能感知的变化, body 一句话, expand 两句内;
// 禁路由路径当主标识 / 行数 / 内部组件名 / 缩写黑话。繁体 zhHant 一律 OpenCC 生成,禁手敲。
export interface TLEntry {
  date: string;
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
    zhHant?: { title: string; body: string; expand: string };
}
export const TIMELINE: TLEntry[] = [
  {
    date: '2026-06-11',
    tag: 'feature',
    zh: {
      title: 'HTR 求解器完成，主流解法的每个阶段都能分析了',
      body: '分步求解器补上了最后一块 HTR，现在 CFOP、Roux、Petrus 等主流方法的每个阶段都能在站内分析。首页也新增「今日公示」标签，看近 48 小时新发布的比赛。',
      expand: 'HTR（斜角复原）是高级解法里的一步，全空间约 108 万个状态，和 DR 串起来能完整还原。至此各主流方法的所有阶段都有了求解器。',
    },
    en: {
      title: 'HTR solver complete — every major method step can now be analysed',
      body: 'The step-by-step solver added its last piece, HTR, so every stage of the major methods (CFOP, Roux, Petrus, etc.) can now be analysed on the site. The homepage also gained a "today" tab for competitions announced in the last 48 hours.',
      expand: 'HTR (half-turn reduction) is a step in advanced methods, spanning about 1.08 million states; chained with DR it solves the cube completely. Every stage of the major methods now has a solver.',
    },
      zhHant: { title: 'HTR 求解器完成，主流解法的每個階段都能分析了', body: '分步求解器補上了最後一塊 HTR，現在 CFOP、Roux、Petrus 等主流方法的每個階段都能在站內分析。首頁也新增「今日公示」標籤，看近 48 小時新發布的比賽。', expand: 'HTR（斜角復原）是高階解法裡的一步，全空間約 108 萬個狀態，和 DR 串起來能完整還原。至此各主流方法的所有階段都有了求解器。' }
},
  {
    date: '2026-06-09 ~ 06-10',
    tag: 'feature',
    zh: {
      title: '名次和玩出花：可以分解项目组合；计时器接入真实 WCA 打乱',
      body: '名次和现在能拆开看哪些项目是你的强项、哪些拖后腿，还能自选项目现算总分。计时器新增「用真实 WCA 打乱」练习，做完会自动标记，别人能看到这条打乱有多少人做过。',
      expand: '求解器这两天又补了 EOLine、DR、桥式第一步、Petrus 等阶段。三阶多盲的非官方平均成绩也接入了全站排名。',
    },
    en: {
      title: 'Sum-of-Ranks gets breakdowns; the timer can use real WCA scrambles',
      body: 'Sum-of-Ranks can now be broken apart to show which events are your strengths and which drag you down, and you can pick events to total live. The timer added a "real WCA scrambles" practice mode that auto-marks your solves, so others can see how many people attempted each scramble.',
      expand: 'The solver also gained several more stages (EOLine, DR, the first Roux block, Petrus). The unofficial mean for 3×3 multi-blind was surfaced in the site\'s rankings too.',
    },
      zhHant: { title: '名次和玩出花：可以分解項目組合；計時器接入真實 WCA 打亂', body: '名次和現在能拆開看哪些項目是你的強項、哪些拖後腿，還能自選項目現算總分。計時器新增「用真實 WCA 打亂」練習，做完會自動標記，別人能看到這條打亂有多少人做過。', expand: '求解器這兩天又補了 EOLine、DR、橋式第一步、Petrus 等階段。三階多盲的非官方平均成績也接入了全站排名。' }
},
  {
    date: '2026-06-08',
    tag: 'migration',
    zh: {
      title: '一天六件大事：英文网址去前缀、繁体中文全覆盖、桥式训练器上线',
      body: '同天六件事：(1) 英文网址去掉 /en 前缀；(2) 繁体中文全站补齐；(3) 当前标签 / 筛选 / 搜索都写进网址，刷新和分享能还原；(4) 比赛日历和 3D 地球合并成一页；(5) 桥式（Roux）训练器上线；(6) 名次和加「历史最高排名」。',
      expand: '繁体由简体自动转换生成、不再手敲。桥式训练器从开源项目完整移植，带 3D 渲染和中英双语。',
    },
    en: {
      title: 'Six big things in one day: bare English URLs, full Traditional Chinese, Roux trainer',
      body: 'Six things the same day: (1) English URLs drop the /en prefix; (2) Traditional Chinese is complete site-wide; (3) the current tab / filter / search now lives in the URL, so refresh and sharing restore state; (4) the competition calendar and 3D globe merged into one page; (5) the Roux trainer launched; (6) Sum-of-Ranks gained an all-time-best view.',
      expand: 'Traditional Chinese is auto-generated from Simplified rather than hand-typed. The Roux trainer is a full port of an open-source project, with 3D rendering and a bilingual UI.',
    },
      zhHant: { title: '一天六件大事：英文網址去字首、繁體中文全覆蓋、橋式訓練器上線', body: '同天六件事：(1) 英文網址去掉 /en 字首；(2) 繁體中文全站補齊；(3) 當前標籤 / 篩選 / 搜尋都寫進網址，重新整理和分享能還原；(4) 比賽日曆和 3D 地球合併成一頁；(5) 橋式（Roux）訓練器上線；(6) 名次和加「歷史最高排名」。', expand: '繁體由簡體自動轉換生成、不再手敲。橋式訓練器從開源專案完整移植，帶 3D 渲染和中英雙語。' }
},
  {
    date: '2026-06-06',
    tag: 'feature',
    zh: {
      title: '社区投稿系统、23 个趣味榜单、复盘支持多人联署',
      body: '(1) 社区长文投稿：访客可以写文章、配图、贴代码，经审核后发布；(2) 趣味统计加了 23 个好玩的榜单；(3) 复盘可以挂多个选手做联合复盘；(4) 排名页加「当期 / 累计」和按月份查看。',
      expand: '趣味统计取材自 cubingchina 并扩展，比如「拿过最多世界纪录的名字」「拿过最多国家纪录的国家」。',
    },
    en: {
      title: 'Community article publishing, 23 fun leaderboards, multi-cuber recon',
      body: '(1) Community long-form publishing: visitors can write articles with images and code, published after moderation; (2) the fun-stats page added 23 playful leaderboards; (3) recon can now attach multiple cubers for joint reviews; (4) the rankings page gained a period/cumulative toggle and a month view.',
      expand: 'The fun-stats leaderboards are sourced from cubingchina and expanded — e.g. the most common first name among world-record holders, or countries with the most national records.',
    },
      zhHant: { title: '社羣投稿系統、23 個趣味榜單、覆盤支援多人聯署', body: '(1) 社羣長文投稿：訪客可以寫文章、配圖、貼程式碼，經稽覈後釋出；(2) 趣味統計加了 23 個好玩的榜單；(3) 覆盤可以掛多個選手做聯合覆盤；(4) 排名頁加「當期 / 累計」和按月份檢視。', expand: '趣味統計取材自 cubingchina 並擴充套件，比如「拿過最多世界紀錄的名字」「拿過最多國家紀錄的國家」。' }
},
  {
    date: '2026-06-04',
    tag: 'dx',
    zh: {
      title: 'Python 彻底退出项目，比赛监控搬进主程序',
      body: '把最后几个 Python 脚本改写成 TypeScript，比赛监控也搬进了主后端。Python 至此完全退出项目。',
      expand: '比赛监控是五个后台任务，自动追踪新比赛发布、纪录变动、实时成绩等，错开启动、带超时保护。',
    },
    en: {
      title: 'Python fully retired; competition monitors moved into the main backend',
      body: 'The last few Python scripts were rewritten in TypeScript, and competition monitoring moved into the main backend. Python is now completely gone from the project.',
      expand: 'Competition monitoring is five background tasks tracking new comp announcements, record changes, live results, and more — staggered on startup with timeout protection.',
    },
      zhHant: { title: 'Python 徹底退出項目，比賽監控搬進主程式', body: '把最後幾個 Python 指令碼改寫成 TypeScript，比賽監控也搬進了主後端。Python 至此完全退出項目。', expand: '比賽監控是五個後臺任務，自動追蹤新比賽釋出、紀錄變動、實時成績等，錯開啟動、帶超時保護。' }
},
  {
    date: '2026-06-01',
    tag: 'feature',
    zh: {
      title: '计时器大改版：dctimer 极简风，Solo 和 Battle 合一；实时显示排名',
      body: '把「1v1 对战」并进计时器，一个页面既能单人练习也能双人对战，界面改成极简风格。登录后每出一个成绩，旁边实时显示它的世界 / 大洲 / 国家排名。',
      expand: '借鉴了知名极简计时器 dctimer 的风格。单人和对战共用同一套引擎，切换不重置。',
    },
    en: {
      title: 'Timer redesign: minimal dctimer style, Solo and Battle unified, live rank display',
      body: 'The "1v1 Battle" was merged into the timer — one page does both solo practice and head-to-head, with a minimal redesign. When signed in, each finished solve shows its live world / continental / national rank beside it.',
      expand: 'It borrows the style of dctimer, a well-known minimal timer. Solo and Battle share one engine, and switching modes doesn\'t reset it.',
    },
      zhHant: { title: '計時器大改版：dctimer 極簡風，Solo 和 Battle 合一；實時顯示排名', body: '把「1v1 對戰」並進計時器，一個頁面既能單人練習也能雙人對戰，介面改成極簡風格。登入後每出一個成績，旁邊實時顯示它的世界 / 大洲 / 國家排名。', expand: '借鑑了知名極簡計時器 dctimer 的風格。單人和對戰共用同一套引擎，切換不重置。' }
},
  {
    date: '2026-05-28 ~ 05-31',
    tag: 'feature',
    zh: {
      title: '全站桌宠、Rust 网页版求解器；求解引擎并入主仓库',
      body: '5-28 上线全站桌宠（可拖拽的小角色，集主题 / 语言 / 搜索于一身）+ 网页版交叉步求解器（多个朝向并行、算一个显示一个）。5-31 求解引擎并入主仓库，新增求解器进度看板。',
      expand: '桌宠取代了原来分散的语言、主题、搜索三个控件，后来还加了表演 PLL 公式的动画。',
    },
    en: {
      title: 'Site-wide desk pet, browser cross-step solver; solver engine vendored in',
      body: 'May 28: a site-wide desk pet (a draggable character combining theme / language / search) and a browser-based cross-step solver (several orientations in parallel, showing each solution as found). May 31: the solving engine was vendored into the main repo, with a solver progress dashboard.',
      expand: 'The desk pet replaced three separate widgets — language, theme, search — and later gained an animation that performs PLL algorithms.',
    },
      zhHant: { title: '全站桌寵、Rust 網頁版求解器；求解引擎併入主倉庫', body: '5-28 上線全站桌寵（可拖拽的小角色，集主題 / 語言 / 搜尋於一身）+ 網頁版交叉步求解器（多個朝向並行、算一個顯示一個）。5-31 求解引擎併入主倉庫，新增求解器進度看板。', expand: '桌寵取代了原來分散的語言、主題、搜尋三個控制元件，後來還加了表演 PLL 公式的動畫。' }
},
  {
    date: '2026-05-28',
    tag: 'infra',
    zh: {
      title: 'Vercel 用量骤降：把页面真正做成静态',
      body: '把大量固定页面从「每次访问都现算」改成「构建时生成好的静态页」，直接走 CDN、零计算。托管平台的函数调用和资源用量预期降到约四分之一。',
      expand: '根因是网站根布局在渲染时读了语言相关的请求信息，把整个页面树钉成了动态。把语言判断下移、根布局不碰动态接口后，页面才能静态生成。',
    },
    en: {
      title: 'Vercel usage drops sharply: making pages genuinely static',
      body: 'Many fixed pages moved from "recomputed on every visit" to "static pages generated at build time", served straight from the CDN with zero compute. Hosting function calls and resource usage are expected to drop to about a quarter.',
      expand: 'The root cause: the site\'s root layout read locale info during render, marking the whole page tree dynamic. Moving locale resolution down and keeping the root layout off dynamic APIs let pages prerender statically.',
    },
      zhHant: { title: 'Vercel 用量驟降：把頁面真正做成靜態', body: '把大量固定頁面從「每次訪問都現算」改成「構建時生成好的靜態頁」，直接走 CDN、零計算。託管平臺的函式呼叫和資源用量預期降到約四分之一。', expand: '根因是網站根佈局在渲染時讀了語言相關的請求資訊，把整個頁面樹釘成了動態。把語言判斷下移、根佈局不碰動態介面後，頁面才能靜態生成。' }
},
  {
    date: '2026-05-27',
    tag: 'migration',
    zh: {
      title: '主域正式从单页应用切换到 Next.js（Phase 4）',
      body: '主域 cuberoot.me 换了底层框架：从单页应用整体切到 Next.js，两条线路（自有服务器 + Vercel）跑同一份代码。旧站同期下线，全程零中断。',
      expand: '后端不变，只换前端框架。同一份代码自动部署到两处。',
    },
    en: {
      title: 'Main domain officially switched from SPA to Next.js (Phase 4)',
      body: 'The main domain cuberoot.me changed its underlying framework: it cut over from a single-page app to Next.js, with two lines (self-hosted server + Vercel) running the same code. The old site was retired at the same time, with zero downtime.',
      expand: 'The backend was unchanged — only the frontend framework. One codebase auto-deploys to both places.',
    },
      zhHant: { title: '主域正式從單頁應用切換到 Next.js（Phase 4）', body: '主域 cuberoot.me 換了底層框架：從單頁應用整體切到 Next.js，兩條線路（自有伺服器 + Vercel）跑同一份程式碼。舊站同期下線，全程零中斷。', expand: '後端不變，只換前端框架。同一份程式碼自動部署到兩處。' }
},
  {
    date: '2026-05-14',
    tag: 'feature',
    zh: {
      title: '同天五件事：虚拟魔方、比赛实时直播、深浅色切换、博客子域、克星查询搬上服务器',
      body: '同天五件：(1) 虚拟魔方 Playground（自由转动、回放、练公式、录制）；(2) 比赛实时直播页；(3) 全站深色 / 浅色 / 跟随系统主题切换；(4) 博客独立成子域；(5) 克星查询改到服务器端计算。',
      expand: '虚拟魔方移植自开源项目 cuber，用 three.js 渲染真立体魔方，配标准配色和键盘 / 触屏操作。',
    },
    en: {
      title: 'Five things one day: virtual cube, live results, light/dark themes, blog subdomain, nemesis goes server-side',
      body: 'Five things the same day: (1) a virtual cube Playground (turn freely, replay, drill algorithms, record); (2) a live competition results page; (3) site-wide dark / light / follow-system themes; (4) the blog split into its own subdomain; (5) the nemesis lookup moved to server-side computation.',
      expand: 'The virtual cube is ported from the open-source cuber, rendering a true 3D cube with three.js, with standard colors and keyboard / touch controls.',
    },
      zhHant: { title: '同天五件事：虛擬魔方、比賽實時直播、深淺色切換、部落格子域、剋星查詢搬上伺服器', body: '同天五件：(1) 虛擬魔方 Playground（自由轉動、回放、練公式、錄製）；(2) 比賽實時直播頁；(3) 全站深色 / 淺色 / 跟隨系統主題切換；(4) 部落格獨立成子域；(5) 剋星查詢改到伺服器端計算。', expand: '虛擬魔方移植自開源專案 cuber，用 three.js 渲染真立體魔方，配標準配色和鍵盤 / 觸屏操作。' }
},
  {
    date: '2026-05-15 ~ 05-24',
    tag: 'feature',
    zh: {
      title: '10 天密集冲刺：比赛实时直播、深度预测长文、全魔方种类、手机 App',
      body: '十天连上多块功能：(1) 比赛页接入官方实时直播和赛前心理表；(2) 一篇约 30 万字的三阶深度预测；(3) 虚拟魔方扩展到所有 WCA 项目；(4) 套壳成 iOS / Android App；(5) 全站搜索、百科、群论入门。',
      expand: '全站搜索覆盖比赛 / 选手 / 公式 / 文章 / 工具等十一类，用自带索引、不依赖外部服务。',
    },
    en: {
      title: '10-day burst: live results, a deep prediction essay, all puzzle types, mobile app',
      body: 'Ten days, several blocks of features: (1) the competition page gained official live results and a psych sheet; (2) a ~300,000-word deep 3×3 prediction; (3) the virtual cube expanded to every WCA event; (4) wrapped into iOS / Android apps; (5) site-wide search, an encyclopedia, a group-theory intro.',
      expand: 'Site-wide search covers eleven categories (comps / cubers / algorithms / articles / tools / etc.) using a built-in index with no external dependency.',
    },
      zhHant: { title: '10 天密集衝刺：比賽實時直播、深度預測長文、全魔方種類、手機 App', body: '十天連上多塊功能：(1) 比賽頁接入官方實時直播和賽前心理表；(2) 一篇約 30 萬字的三階深度預測；(3) 虛擬魔方擴充套件到所有 WCA 項目；(4) 套殼成 iOS / Android App；(5) 全站搜尋、百科、群論入門。', expand: '全站搜尋覆蓋比賽 / 選手 / 公式 / 文章 / 工具等十一類，用自帶索引、不依賴外部服務。' }
},
  {
    date: '2026-05-12',
    tag: 'dx',
    zh: {
      title: '手机、电脑、外网三端同时热重载；架构页从纯文字改成图文',
      body: '电脑、同 WiFi 手机、外网手机三端都能实时看到代码改动（热重载）。这个架构介绍页也在同一天从纯文字改成图文长版。',
      expand: '三端走不同反向代理但共用一份开发服务，本页第 9 节有完整推导。',
    },
    en: {
      title: 'Hot-reload on phone, desktop, and remote at once; architecture page goes illustrated',
      body: 'Desktop, a same-WiFi phone, and a phone on cellular all get live code-change reloading. This architecture page was also rewritten the same day from plain prose into an illustrated long-form.',
      expand: 'The three entries use different reverse proxies but share one dev server; Section 9 of this page has the full derivation.',
    },
      zhHant: { title: '手機、電腦、外網三端同時熱過載；架構頁從純文字改成圖文', body: '電腦、同 WiFi 手機、外網手機三端都能實時看到程式碼改動（熱過載）。這個架構介紹頁也在同一天從純文字改成圖文長版。', expand: '三端走不同反向代理但共用一份開發服務，本頁第 9 節有完整推導。' }
},
  {
    date: '2026-05-10',
    tag: 'feature',
    zh: {
      title: '换位公式分解器上线，帮盲拧和 FMC 选手找公式结构',
      body: '上线了换位（commutator）分解工具，把一条公式拆解成换位结构——盲拧和最少步数圈子的高频需求。同一天把站点导航改成后台可编辑。',
      expand: '换位分解以前得去外站。基础设施侧还上线了一个自写的轻量数据库迁移工具。',
    },
    en: {
      title: 'Commutator decomposition tool — helping blindfold and FMC cubers see algorithm structure',
      body: 'A commutator decomposition tool launched, breaking an algorithm into commutator structure — a high-demand need for blindfold and fewest-moves cubers. The same day the site navigation became backend-editable.',
      expand: 'Commutator decomposition previously required a third-party site. The infrastructure also gained a self-written lightweight database-migration tool.',
    },
      zhHant: { title: '換位公式分解器上線，幫盲擰和 FMC 選手找公式結構', body: '上線了換位（commutator）分解工具，把一條公式拆解成換位結構——盲擰和最少步數圈子的高頻需求。同一天把站點導航改成後臺可編輯。', expand: '換位分解以前得去外站。基礎設施側還上線了一個自寫的輕量資料庫遷移工具。' }
},
  {
    date: '2026-05-08',
    tag: 'feature',
    zh: {
      title: '单日上线七项：记忆训练、打乱工具、7 张历史统计页、公式识别路由',
      body: '一天七项：(1) 记忆训练中心 + 配色记忆训练；(2) 打乱工具中心 + 网页版求解器；(3) 七张历史统计页（大满贯 / 全部 / 当年 / 届别 / 成功率 / 全达成 / 名次和）；(4) 通用公式识别路由；(5) 编程入门站再加三种语言。',
      expand: '七张统计页背后是六张新数据库表，初次灌入五百多万行。',
    },
    en: {
      title: 'Seven things in one day: memory training, scramble tools, 7 history-stat pages, recognition route',
      body: 'Seven things in a day: (1) a memory-training hub + color-memory drill; (2) a scramble-tools hub + browser solver; (3) seven history-stat pages (grand slam / all / current year / by edition / success rate / all events done / sum of ranks); (4) a generic algorithm-recognition route; (5) three more languages in the programming hub.',
      expand: 'The seven stat pages are backed by six new database tables, with an initial load of over five million rows.',
    },
      zhHant: { title: '單日上線七項：記憶訓練、打亂工具、7 張歷史統計頁、公式識別路由', body: '一天七項：(1) 記憶訓練中心 + 配色記憶訓練；(2) 打亂工具中心 + 網頁版求解器；(3) 七張歷史統計頁（大滿貫 / 全部 / 當年 / 屆別 / 成功率 / 全達成 / 名次和）；(4) 通用公式識別路由；(5) 程式設計入門站再加三種語言。', expand: '七張統計頁背後是六張新資料庫表，初次灌入五百多萬行。' }
},
  {
    date: '2026-05-07',
    tag: 'feature',
    zh: {
      title: '「魔方 × 编程语言」入门站上线：9 种语言一次发布',
      body: '一次性上线了 9 种编程语言的入门页：C、C++、Go、Kotlin、TypeScript、Rust、Python、Zig、Swift，外加一个总入口和一个「五次平均」对比页。',
      expand: '每页用速拧场景当例子，比如「用这门语言算一组五次平均」。后来陆续加到 21 种语言 / 标记。',
    },
    en: {
      title: 'A "cubing × programming language" intro hub: 9 languages in one release',
      body: 'Nine programming-language intro pages launched at once: C, C++, Go, Kotlin, TypeScript, Rust, Python, Zig, Swift — plus a hub page and a "mean-of-5" comparison page.',
      expand: 'Each page uses speedcubing scenarios as examples, e.g. "computing a mean-of-5 in this language". More languages were added later, reaching 21 in total.',
    },
      zhHant: { title: '「魔方 × 程式語言」入門站上線：9 種語言一次釋出', body: '一次性上線了 9 種程式語言的入門頁：C、C++、Go、Kotlin、TypeScript、Rust、Python、Zig、Swift，外加一個總入口和一個「五次平均」對比頁。', expand: '每頁用速擰場景當例子，比如「用這門語言算一組五次平均」。後來陸續加到 21 種語言 / 標記。' }
},
  {
    date: '2026-05-06',
    tag: 'migration',
    zh: {
      title: '同一天完成三件迁移：换数据库、公式进库、卸掉 WordPress',
      body: '同一天三件迁移：数据库从 MariaDB 迁到 PostgreSQL、41 套公式从文件搬进数据库、卸掉 WordPress 和面板。服务器从此只剩 nginx、Node 和 PostgreSQL。',
      expand: '换库后公式可以直接在网页编辑，不用改代码重新部署。',
    },
    en: {
      title: 'Three migrations in one day: switch databases, move algorithms into the DB, drop WordPress',
      body: 'Three migrations the same day: the database moved from MariaDB to PostgreSQL, all 41 algorithm sets moved from files into the database, and WordPress and the control panel were removed. The server now runs only nginx, Node, and PostgreSQL.',
      expand: 'After the switch, algorithms can be edited right in the browser — no code change and redeploy needed.',
    },
      zhHant: { title: '同一天完成三件遷移：換資料庫、公式進庫、卸掉 WordPress', body: '同一天三件遷移：資料庫從 MariaDB 遷到 PostgreSQL、41 套公式從檔案搬進資料庫、卸掉 WordPress 和麵板。伺服器從此只剩 nginx、Node 和 PostgreSQL。', expand: '換庫後公式可以直接在網頁編輯，不用改程式碼重新部署。' }
},
  {
    date: '2026-05-03',
    tag: 'feature',
    zh: {
      title: '魔方图片编辑器等五个页面同日上线；魔方状态图改为服务器渲染',
      body: '同一天五个新页面：魔方状态图编辑器、花式图样库，以及平均成绩、打乱生成、今日等工具页。魔方状态图也改成由服务器统一渲染。',
      expand: '状态图改服务器渲染后，浏览器不用再现场计算贴片位置，统一生成并缓存。异形魔方也接入了统一的图片生成库。',
    },
    en: {
      title: 'A cube-image editor and four more pages the same day; cube state images move to server rendering',
      body: 'Five new pages the same day: a cube-state image editor, a fancy-patterns library, plus average, scramble-generator, and "today" tool pages. Cube state images also switched to unified server-side rendering.',
      expand: 'With server-side rendering, browsers no longer compute sticker positions live — everything is generated and cached. The odd-shaped puzzles were wired into the unified image library too.',
    },
      zhHant: { title: '魔方圖片編輯器等五個頁面同日上線；魔方狀態圖改為伺服器渲染', body: '同一天五個新頁面：魔方狀態圖編輯器、花式圖樣庫，以及平均成績、打亂生成、今日等工具頁。魔方狀態圖也改成由伺服器統一渲染。', expand: '狀態圖改伺服器渲染後，瀏覽器不用再現場計算貼片位置，統一生成並快取。異形魔方也接入了統一的圖片生成庫。' }
},
  {
    date: '2026-04-30 ~ 05-01',
    tag: 'feature',
    zh: {
      title: '项目理论极限预测页、公式查询库上线；比赛日历加列表视图',
      body: '4-30 上线「项目理论极限与预测」页，5-1 上线 3x3 公式查询库。同期比赛日历加了列表视图和时间范围过滤。',
      expand: '预测页用 WCA 历史数据估算每个项目的「理论极限」再外推。公式库覆盖 OLL / PLL / F2L。',
    },
    en: {
      title: 'Event theoretical-limit prediction page, an algorithm reference, and a calendar list view',
      body: '4-30 launched an event "theoretical limits and forecasts" page; 5-1 launched a 3×3 algorithm reference. The competition calendar also gained a list view and a date-range filter.',
      expand: 'The prediction page uses WCA history to estimate each event\'s "theoretical limit" and extrapolate. The reference covers OLL / PLL / F2L.',
    },
      zhHant: { title: '項目理論極限預測頁、公式查詢庫上線；比賽日曆加列表檢視', body: '4-30 上線「項目理論極限與預測」頁，5-1 上線 3x3 公式查詢庫。同期比賽日曆加了列表檢視和時間範圍過濾。', expand: '預測頁用 WCA 歷史資料估算每個項目的「理論極限」再外推。公式庫覆蓋 OLL / PLL / F2L。' }
},
  {
    date: '2026-04-26 ~ 27',
    tag: 'feature',
    zh: {
      title: '速拧计时器正式上线（TS 重写），第二天一天打了 116 个提交',
      body: '4-26 把计时器用 TypeScript 从零重写（打乱生成、2D 预览、直方图、跟 csTimer 互导、覆盖所有项目）。4-27 一天打了 116 个提交，加上盲拧、分阶段计时、智能魔方蓝牙、3D 预览、观察时间、分享链接、手机适配。',
      expand: '支持五种主流智能魔方的蓝牙连接。csTimer 嵌入仍保留。',
    },
    en: {
      title: 'The speedsolving timer launches (TS rewrite); 116 commits the next day',
      body: '4-26: the timer was rewritten from scratch in TypeScript (scramble generation, 2D preview, histogram, csTimer import/export, all events). 4-27: 116 commits in a day added blindfold, stage timing, smartcube Bluetooth, 3D preview, inspection, share links, and mobile adaptation.',
      expand: 'It supports Bluetooth for five mainstream smartcubes. The csTimer embed is still kept.',
    },
      zhHant: { title: '速擰計時器正式上線（TS 重寫），第二天一天打了 116 個提交', body: '4-26 把計時器用 TypeScript 從零重寫（打亂生成、2D 預覽、直方圖、跟 csTimer 互導、覆蓋所有項目）。4-27 一天打了 116 個提交，加上盲擰、分階段計時、智慧魔方藍芽、3D 預覽、觀察時間、分享連結、手機適配。', expand: '支援五種主流智慧魔方的藍芽連線。csTimer 嵌入仍保留。' }
},
  {
    date: '2026-04-24 ~ 25',
    tag: 'feature',
    zh: {
      title: '克星查询、马赛克生成器、WCA 选手主页等五页两天上线',
      body: '4-24 上线站点导航、魔方马赛克生成器、克星查询初版。4-25 克星查询完工，加上 WCA 选手主页查询和全球非官方纪录排名。',
      expand: '「克星」= 在某个项目、某片地区里，名次紧追你、还没超过你的那个人。选手主页查询带 28 万选手本地索引，20 毫秒出结果。',
    },
    en: {
      title: 'Nemesis lookup, mosaic generator, WCA person pages — five pages over two days',
      body: '4-24 launched site navigation, a cube-mosaic generator, and a first cut of the nemesis lookup. 4-25 completed the nemesis lookup and added WCA person-profile lookup and world unofficial-record rankings.',
      expand: 'The "nemesis" is the cuber ranked just behind you in an event and region who hasn\'t passed you yet. The profile lookup uses a 280k-cuber local index returning results in under 20 ms.',
    },
      zhHant: { title: '剋星查詢、馬賽克生成器、WCA 選手主頁等五頁兩天上線', body: '4-24 上線站點導航、魔方馬賽克生成器、剋星查詢初版。4-25 剋星查詢完工，加上 WCA 選手主頁查詢和全球非官方紀錄排名。', expand: '「剋星」= 在某個項目、某片地區裡，名次緊追你、還沒超過你的那個人。選手主頁查詢帶 28 萬選手本地索引，20 毫秒出結果。' }
},
  {
    date: '2026-04-22',
    tag: 'feature',
    zh: {
      title: '打乱难度分布统计页上线：看一个打乱有多「难」',
      body: '上线了打乱难度分布页，把每个项目几百万条打乱的难度统计成分布图，让你直观看到一个打乱「好不好上手」。',
      expand: '数据来自一个分析器，对每个项目跑了上百万条打乱，算出各阶段步数分布。后来也支持了异形魔方。',
    },
    en: {
      title: 'A scramble-difficulty distribution page: how "hard" a scramble is',
      body: 'A scramble-difficulty page launched, turning the difficulty of millions of scrambles per event into distribution charts so you can see at a glance how easy a scramble is to start.',
      expand: 'The data comes from an analyzer that ran over a million scrambles per event, computing per-stage move-count distributions. It later gained support for the odd-shaped puzzles.',
    },
      zhHant: { title: '打亂難度分佈統計頁上線：看一個打亂有多「難」', body: '上線了打亂難度分佈頁，把每個項目幾百萬條打亂的難度統計成分佈圖，讓你直觀看到一個打亂「好不好上手」。', expand: '資料來自一個分析器，對每個項目跑了上百萬條打亂，算出各階段步數分佈。後來也支援了異形魔方。' }
},
  {
    date: '2026-04-23',
    tag: 'feature',
    zh: {
      title: '公式教程上线，从静态文档变成可交互的教程站',
      body: '上线了公式教程站，把原本的静态文档做成可以浏览、检索、看案例图的交互式页面。',
      expand: '当时内容从 Word 文档解析而来，两周后才整体搬进数据库。',
    },
    en: {
      title: 'The algorithm tutorial launches — from static document to an interactive tutorial site',
      body: 'An algorithm-tutorial site launched, turning what used to be a static document into interactive pages you can browse, search, and view case images on.',
      expand: 'The content was initially parsed from a Word document, moving into the database two weeks later.',
    },
      zhHant: { title: '公式教程上線，從靜態文件變成可互動的教程站', body: '上線了公式教程站，把原本的靜態文件做成可以瀏覽、檢索、看案例圖的互動式頁面。', expand: '當時內容從 Word 文件解析而來，兩週後才整體搬進資料庫。' }
},
  {
    date: '2026-04-16 ~ 18',
    tag: 'feature',
    zh: {
      title: '3D 地球上的全球比赛地图，同日重写首页',
      body: '4-16 上线可旋转的 3D 地球，把未来比赛标在上面；同天重写了首页。4-17 ~ 18 继续加银河系背景、标记聚合和搜索。',
      expand: '这个 3D 地球标志着项目从「摆数据」走向「沉浸式可视化」。',
    },
    en: {
      title: 'A 3D globe map of competitions worldwide; the homepage rewritten the same day',
      body: '4-16 launched a rotatable 3D globe plotting upcoming competitions; the homepage was rewritten the same day. 4-17 ~ 18 added a Milky Way background, marker clustering, and search.',
      expand: 'The 3D globe marked the project\'s leap from "displaying data" to "immersive visualisation".',
    },
      zhHant: { title: '3D 地球上的全球比賽地圖，同日重寫首頁', body: '4-16 上線可旋轉的 3D 地球，把未來比賽標在上面；同天重寫了首頁。4-17 ~ 18 繼續加銀河系背景、標記聚合和搜尋。', expand: '這個 3D 地球標誌著項目從「擺資料」走向「沉浸式視覺化」。' }
},
  {
    date: '2026-04-06 ~ 16',
    tag: 'feature',
    zh: {
      title: '视频数帧工具上线：帮裁判和选手精确数到哪一帧',
      body: '从 4-6 起步、十天迭代成型的视频数帧工具——帮裁判和选手精确数到第几帧起表 / 停表。逐天补上硬件解码、缩略图、双指缩放、起表帧反推、视频诊断面板等。',
      expand: '视频帧率不稳、可变帧率、iOS Safari 兼容都是真实痛点。用浏览器的 WebCodecs 做硬件解码，实现零丢帧导出。',
    },
    en: {
      title: 'A video frame-counting tool: helping judges and cubers count to the exact frame',
      body: 'A video frame-counting tool, started 4-6 and matured over ten days — helping judges and cubers count to the exact start/stop frame. Day by day it gained hardware decoding, thumbnails, pinch zoom, start-frame back-calc, and a video diagnostics panel.',
      expand: 'Unstable frame rates, variable frame rate, and iOS Safari compatibility are real pain points. It uses the browser\'s WebCodecs for hardware decoding and zero-dropped-frame export.',
    },
      zhHant: { title: '影片數幀工具上線：幫裁判和選手精確數到哪一幀', body: '從 4-6 起步、十天迭代成型的影片數幀工具——幫裁判和選手精確數到第幾幀起表 / 停表。逐天補上硬體解碼、縮圖、雙指縮放、起表幀反推、影片診斷面板等。', expand: '影片幀率不穩、可變幀率、iOS Safari 相容都是真實痛點。用瀏覽器的 WebCodecs 做硬體解碼，實現零丟幀匯出。' }
},
  {
    date: '2026-04',
    tag: 'dx',
    zh: {
      title: '类型检查修好了：以前 typo 一直能通过检查',
      body: '修好了类型检查的一个隐患——之前的配置让检查静默空跑，写错的标识符永远能通过。',
      expand: '验证办法很直接：故意写一个不存在的标识符，跑检查看它会不会报错。修好后增量检查约 12 秒，持续集成里则清缓存做全量检查。',
    },
    en: {
      title: 'Type-checking fixed — typos used to pass silently',
      body: 'A type-checking blind spot was fixed: the previous config let the check silently no-op, so misspelled identifiers always passed.',
      expand: 'The test was straightforward: insert an identifier that doesn\'t exist and see whether the check errors. After the fix, incremental checks take about 12 seconds, and continuous integration runs a full check with the cache cleared.',
    },
      zhHant: { title: '型別檢查修好了：以前 typo 一直能透過檢查', body: '修好了型別檢查的一個隱患——之前的配置讓檢查靜默空跑，寫錯的識別符號永遠能透過。', expand: '驗證辦法很直接：故意寫一個不存在的識別符號，跑檢檢視它會不會報錯。修好後增量檢查約 12 秒，持續整合裡則清快取做全量檢查。' }
},
  {
    date: '2026-03-24',
    tag: 'migration',
    zh: {
      title: '后端 API 框架一天内从 Fastify 换成 Hono',
      body: '前一天刚把 Fastify 接好，第二天就整体换成了 Hono，22 个接口全部转过去。',
      expand: '那半个月后端换得很频繁：先从云数据库换成自建（3-04），再上 Fastify（3-23），隔天又换成 Hono（3-24）。',
    },
    en: {
      title: 'The backend API framework went from Fastify to Hono in a day',
      body: 'Fastify was wired up one day and replaced wholesale by Hono the next, with all 22 endpoints converted.',
      expand: 'The backend changed often that fortnight: from the cloud database to self-hosted (3-04), then Fastify (3-23), then Hono the next day (3-24).',
    },
      zhHant: { title: '後端 API 框架一天內從 Fastify 換成 Hono', body: '前一天剛把 Fastify 接好，第二天就整體換成了 Hono，22 個介面全部轉過去。', expand: '那半個月後端換得很頻繁：先從雲資料庫換成自建（3-04），再上 Fastify（3-23），隔天又換成 Hono（3-24）。' }
},
  {
    date: '2026-03-23',
    tag: 'migration',
    zh: {
      title: '项目最大跃变：jQuery 工具全部迁到 React + TypeScript monorepo',
      body: '把一堆 jQuery / 静态 HTML 的小工具整体迁到 React 19 + Vite + pnpm/Turbo 的 monorepo，同一天接入了魔方动画库 cubing.js。',
      expand: '前端一开始迁了 12 个工具页，后续半年涨到 24 个以上。接入 cubing.js 后所有动画统一交给它播放，不再手写魔方 SVG。这是项目结构最大的一次跃变。',
    },
    en: {
      title: 'The project\'s biggest leap: jQuery tools all migrated to a React + TypeScript monorepo',
      body: 'A pile of jQuery / static-HTML tools migrated wholesale onto a React 19 + Vite + pnpm/Turbo monorepo, and the cube-animation library cubing.js was adopted the same day.',
      expand: 'The frontend started with 12 tool pages and grew past 24 over six months. Once cubing.js landed, all animations went through it and hand-written cube SVG was retired — the biggest structural leap in the project.',
    },
      zhHant: { title: '項目最大躍變：jQuery 工具全部遷到 React + TypeScript monorepo', body: '把一堆 jQuery / 靜態 HTML 的小工具整體遷到 React 19 + Vite + pnpm/Turbo 的 monorepo，同一天接入了魔方動畫庫 cubing.js。', expand: '前端一開始遷了 12 個工具頁，後續半年漲到 24 個以上。接入 cubing.js 後所有動畫統一交給它播放，不再手寫魔方 SVG。這是項目結構最大的一次躍變。' }
},
  {
    date: '2026-03-21',
    tag: 'feature',
    zh: {
      title: '成绩分布可视化页上线：曲线、山脊图、多人对比',
      body: '上线了成绩分布页：分布曲线、直方图、山脊图、折线四种视图，可多人对比、缩放平移。',
      expand: '看整个选手群体的成绩分布——哪个区间人最多、进阶轨迹如何。多人对比能把你和顶级选手放一张图比。',
    },
    en: {
      title: 'A result-distribution visualisation page: curves, ridgelines, multi-cuber comparison',
      body: 'A result-distribution page launched with four views — distribution curve, histogram, ridgeline, line — with multi-cuber comparison and zoom/pan.',
      expand: 'It shows how results are distributed across the cuber population — where the mass sits, how skill progresses. Multi-cuber comparison puts you and top cubers on one chart.',
    },
      zhHant: { title: '成績分佈視覺化頁上線：曲線、山脊圖、多人對比', body: '上線了成績分佈頁：分佈曲線、直方圖、山脊圖、折線四種檢視，可多人對比、縮放平移。', expand: '看整個選手群體的成績分佈——哪個區間人最多、進階軌跡如何。多人對比能把你和頂級選手放一張圖比。' }
},
  {
    date: '2026-03-12 ~ 15',
    tag: 'feature',
    zh: {
      title: '第一波工具集成：成绩对比、公式训练器、csTimer、1v1 对战',
      body: '四天里集成了四个工具：HTH 成绩对比、公式训练器、csTimer、1v1 对战。',
      expand: '前两个来自社区开源项目，csTimer 整站自托管，1v1 对战也是移植来的。后来计算器和对战被重写成 React，公式训练器保留原样。',
    },
    en: {
      title: 'First wave of tool integrations: result comparison, alg trainer, csTimer, 1v1 battle',
      body: 'Four tools integrated in four days: HTH result comparison, an algorithm trainer, csTimer, and 1v1 battle.',
      expand: 'The first two come from community open-source projects; csTimer is self-hosted whole, and 1v1 battle was ported in too. The calculator and battle were later rewritten in React; the alg trainer was kept as-is.',
    },
      zhHant: { title: '第一波工具整合：成績對比、公式訓練器、csTimer、1v1 對戰', body: '四天裡整合了四個工具：HTH 成績對比、公式訓練器、csTimer、1v1 對戰。', expand: '前兩個來自社羣開源專案，csTimer 整站自託管，1v1 對戰也是移植來的。後來計算器和對戰被重寫成 React，公式訓練器保留原樣。' }
},
  {
    date: '2026-03-04',
    tag: 'migration',
    zh: {
      title: '后端从云数据库换成自己的服务器',
      body: '上线没几天的云数据库后端，换成了自己运维的一台服务器。第一次「自己管一台机器」。',
      expand: '原来的云数据库延迟高、配额复杂，不适合用户集中在一个地区的站点。这台机器后来一直用到现在。',
    },
    en: {
      title: 'Backend moved from a cloud database to a self-run server',
      body: 'The cloud-database backend, adopted only days earlier, was replaced by a self-run server — the first "running my own machine" moment.',
      expand: 'The cloud database had high latency and complicated quotas, a poor fit for a site whose users are concentrated in one region. This machine has been in use ever since.',
    },
      zhHant: { title: '後端從雲資料庫換成自己的伺服器', body: '上線沒幾天的雲資料庫後端，換成了自己運維的一臺伺服器。第一次「自己管一臺機器」。', expand: '原來的雲資料庫延遲高、配額複雜，不適合使用者集中在一個地區的站點。這臺機器後來一直用到現在。' }
},
  {
    date: '2026-02-27',
    tag: 'feature',
    zh: {
      title: '复盘功能上线 + WCA 账号登录',
      body: '复盘功能上线，同一天接入 WCA 账号登录。站点从「只能看」变成「能登录、能写」。',
      expand: '复盘是项目第一个需要登录和写入的功能，把站点从展示性质拉到协作性质。早期成绩库是静态文件，后来才进数据库。',
    },
    en: {
      title: 'Recon launches + WCA account login',
      body: 'The recon feature launched, with WCA account login the same day — the site went from "view-only" to "log in and contribute".',
      expand: 'Recon was the first feature needing login and writes, pulling the site from a showcase into a collaborative tool. The early result library was a static file, later moved into the database.',
    },
      zhHant: { title: '覆盤功能上線 + WCA 賬號登入', body: '覆盤功能上線，同一天接入 WCA 賬號登入。站點從「只能看」變成「能登入、能寫」。', expand: '覆盤是項目第一個需要登入和寫入的功能，把站點從展示性質拉到協作性質。早期成績庫是靜態檔案，後來才進資料庫。' }
},
  {
    date: '2026-02-26',
    tag: 'feature',
    zh: {
      title: '未来比赛追踪器上线',
      body: '上线了未来比赛列表：哪些大神会去哪场比赛，配现 / 前世界纪录标记。',
      expand: '数据来自 WCA 和 cubing.com（后者覆盖非官方比赛）。这是站点第一个「有时效性」的页面——不只看历史，还看未来。',
    },
    en: {
      title: 'Upcoming-competitions tracker launches',
      body: 'An upcoming-competitions list launched: which top cubers are attending which comps, with current / former world-record badges.',
      expand: 'Data comes from WCA and cubing.com (the latter covers unofficial comps). This was the site\'s first "time-sensitive" page — not just history, but a forward view.',
    },
      zhHant: { title: '未來比賽追蹤器上線', body: '上線了未來比賽列表：哪些大神會去哪場比賽，配現 / 前世界紀錄標記。', expand: '資料來自 WCA 和 cubing.com（後者覆蓋非官方比賽）。這是站點第一個「有時效性」的頁面——不只看歷史，還看未來。' }
},
  {
    date: '2026-02-18',
    tag: 'feature',
    zh: {
      title: '第一个真正的首页：复原器 + WCA 统计两张入口卡',
      body: '从单个 index.html 变成有真正「首页」的站点，两张入口卡：复原器和 WCA 统计。',
      expand: '同期把复原器的界面也翻成了中文。这是站点开始有「产品样子」的起点，后来所有入口卡都从这里长出来。',
    },
    en: {
      title: 'The first real homepage — Solver and WCA Stats cards',
      body: 'The site went from a single index.html to one with a real homepage and two entry cards: the solver and WCA stats.',
      expand: 'The solver\'s interface was translated to Chinese around the same time. This is when the site began to feel like a product; every later entry card grew out of this.',
    },
      zhHant: { title: '第一個真正的首頁：復原器 + WCA 統計兩張入口卡', body: '從單個 index.html 變成有真正「首頁」的站點，兩張入口卡：復原器和 WCA 統計。', expand: '同期把復原器的介面也翻成了中文。這是站點開始有「產品樣子」的起點，後來所有入口卡都從這裡長出來。' }
},
  {
    date: '2026-02-17',
    tag: 'infra',
    zh: {
      title: 'WCA 统计数据管道上线：每周自动抓取',
      body: '第一条自动化数据流水线：每周从 WCA 公开数据自动抓取、跑统计、产出结果。',
      expand: '最早是一套脚本，后来整体重写。当初的统计后来扩展到 80 多张统计页。',
    },
    en: {
      title: 'WCA statistics pipeline launches — auto-fetched weekly',
      body: 'The first automated data pipeline: every week it auto-fetches the WCA public data, runs statistics, and produces results.',
      expand: 'Originally a set of scripts, later fully rewritten. What started small grew into 80-plus stat pages.',
    },
      zhHant: { title: 'WCA 統計資料管道上線：每週自動抓取', body: '第一條自動化資料流水線：每週從 WCA 公開資料自動抓取、跑統計、產出結果。', expand: '最早是一套指令碼，後來整體重寫。當初的統計後來擴充套件到 80 多張統計頁。' }
},
  {
    date: '2025-12-13',
    tag: 'infra',
    zh: {
      title: '项目诞生：一个空的 index.html',
      body: '一个 repo、一个空的 index.html、一份 README，没了。',
      expand: '最初什么工具、后端、数据都没有，就是个壳。头两个月慢慢往里塞 fork 来的工具页，第一个有数据的功能要到 2026-02-17 才出现。',
    },
    en: {
      title: 'Day zero — one empty index.html',
      body: 'A repo, an empty index.html, a README. That\'s it.',
      expand: 'No tools, no backend, no data at first — just a shell. The first two months slowly added forked tool pages; the first feature with real data didn\'t arrive until 2026-02-17.',
    },
      zhHant: { title: '項目誕生：一個空的 index.html', body: '一個 repo、一個空的 index.html、一份 README，沒了。', expand: '最初什麼工具、後端、資料都沒有，就是個殼。頭兩個月慢慢往裡塞 fork 來的工具頁，第一個有資料的功能要到 2026-02-17 才出現。' }
},
];
