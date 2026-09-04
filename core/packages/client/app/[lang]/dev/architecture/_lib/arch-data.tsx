import type { ReactNode } from 'react';

export interface Mod {
  route: string;
  zh: string;
  en: string;
  origin: 'own' | 'port' | 'fork';
  upstream?: string; // owner/repo slug — port / fork only
}
export const BORROWED_MODULES: Mod[] = [
  { route: '/calc',            zh: 'HTH 计算',    en: 'HTH Calc',     origin: 'port', upstream: 'carykh/hthgrapher' },
  { route: '/timer?players=2', zh: '1v1',         en: 'Battle',       origin: 'port', upstream: 'MatteoColombo/cube_challenge_timer' },
  { route: '/mosaic',          zh: '马赛克',      en: 'Mosaic',       origin: 'port', upstream: 'Roman-/mosaic' },
  { route: '/cstimer',         zh: 'csTimer',     en: 'csTimer',      origin: 'fork', upstream: 'cs0x7f/cstimer' },
  { route: '/solver',          zh: '复原器',      en: 'Solver',       origin: 'fork', upstream: 'or18/RubiksSolverDemo' },
  { route: '/alg-trainers',    zh: '公式训练器',  en: 'Alg Trainers', origin: 'fork', upstream: 'mihlefeld/Alg-Trainers' },
  { route: '/blddb',           zh: '盲拧公式库',  en: 'BLDDB',        origin: 'fork', upstream: 'nbwzx/blddb' },
];

export interface Decision {
  topic: string;
  pick: string;
  alt: string;
  zh: string;
  en: string;
}
export const DECISIONS: Decision[] = [
  { topic: 'UI library',  pick: 'React',         alt: 'Vue / Svelte / Solid',  zh: '生态成熟，魔方相关组件容易接入，Web 与已安装客户端也能共享产品层。', en: 'A mature ecosystem, straightforward integration with cubing components, and a product layer shared by the web and installed clients.'
  },
  { topic: 'Framework',   pick: 'Next.js App Router', alt: 'Remix / TanStack Start / 纯 SPA', zh: '路由、静态生成、服务端渲染和流式响应在同一套约定里，且同一份 Web 代码可以走两条发布线路。', en: 'Routing, static generation, server rendering, and streaming share one convention, while the same web code can ship through two release paths.'
  },
  { topic: 'Bundler',     pick: 'Turbopack',        alt: 'Webpack / Vite',        zh: '跟随 Web 框架的默认构建链，开发和生产不维护两套打包配置。', en: 'Uses the web framework’s default build chain, avoiding separate development and production bundler configurations.'
  },
  { topic: 'Styling',     pick: '语义化 CSS + 主题 token', alt: '纯工具类 / CSS-in-JS', zh: '页面用可读的语义类名，颜色统一取主题变量，衍生色用 color-mix。', en: 'Pages use readable semantic class names, colors come from shared theme variables, and derived colors use color-mix.'
  },
  { topic: 'API server',  pick: 'Hono',             alt: 'Express / Fastify',     zh: 'TypeScript 友好，路由与中间件简洁，适合当前 API 的规模和部署方式。', en: 'TypeScript-friendly routes and middleware fit the current API size and deployment model.'
  },
  { topic: 'Database',    pick: 'PostgreSQL',    alt: 'MariaDB / MongoDB',     zh: '关系、事务、JSON 数据、窗口函数和部分索引能在同一个事实源里完成。', en: 'Relations, transactions, JSON data, window functions, and partial indexes live in one source of truth.'
  },
  { topic: 'Monorepo',    pick: 'pnpm + Turbo',     alt: '多个独立仓库', zh: '应用、共享包和离线任务在同一仓库协作，同时保持各自的构建与运行边界。', en: 'Applications, shared packages, and offline jobs collaborate in one repository while retaining distinct build and runtime boundaries.'
  },
  { topic: 'State mgmt',  pick: 'Zustand',          alt: 'Redux Toolkit / Jotai / Context', zh: '客户端内存和持久化状态使用小型 store，组件通过 selector 只订阅需要的切片。', en: 'Small stores hold in-memory and persisted client state; components subscribe only to the slices they need.'
},
  { topic: 'URL state',   pick: 'nuqs',             alt: '手写 history.pushState / router.replace / useState', zh: '页内"在哪个视图 / tab / 筛选 / 搜索"统一进 URL search params, 一处声明 useQueryState / useQueryStates。视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。替掉全站各写各的 history.pushState/replaceState + 手写 popstate;一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。', en: 'In-page "which view / tab / filter / search" lives in URL search params, declared once via useQueryState / useQueryStates. Views / tabs / modes / overlays push to history (back returns); filters / sort / search replace (no pile-up). Replaced the site-wide grab-bag of raw history.pushState/replaceState + hand-rolled popstate; a PreToolUse hook blocks at write time and a vitest guard backstops CI, with a few exemptions (maplibre, zustand data serialization).'
},
  { topic: 'Hosting',     pick: '双线路 Web + 独立 API', alt: '单一 Web 线路', zh: '同一份 Web 代码走两条发布线路，API 和静态资源保持稳定入口；详细容量与恢复边界放在基础设施页维护。', en: 'The same web code ships through two routes, while API and static assets keep stable entry points; capacity and recovery details live on the infrastructure page.'
  },
  { topic: 'Theme tokens', pick: 'CSS variables + color-mix', alt: '页面硬编码颜色', zh: '亮色、暗色和系统主题共用语义 token，页面只引用含义，不复制色值。', en: 'Light, dark, and system themes share semantic tokens; pages reference meaning instead of copying color values.'
},
];

export interface Detail {
  title: string;
  zh: ReactNode;
  en: ReactNode;
}
export const DETAILS: Detail[] = [
  {
    title: 'SharedArrayBuffer / COOP / COEP',
    zh: <><strong>/scramble/solver</strong> 运行求解器时需要 <code>SharedArrayBuffer</code>。隔离响应头只在这条路由启用，避免影响登录回调和其它页面。</>,
    en: <><strong>/scramble/solver</strong> needs <code>SharedArrayBuffer</code> for its solver. Isolation headers are limited to that route so sign-in callbacks and other pages stay unaffected.</>
},
  {
    title: 'apiUrl() 是唯一的 fetch 入口',
    zh: <>客户端不能硬编码 origin。<code>lib/api-base.ts</code> 的 <code>apiUrl()</code> 根据构建环境和可选公开配置选择入口；浏览器开发环境走站内重写，服务端和生产环境使用绝对地址。</>,
    en: <>Clients never hardcode an origin. <code>lib/api-base.ts</code> selects the entry from the build environment and optional public configuration; browser development uses the in-site rewrite, while server and production calls use an absolute URL.</>
},
  {
    title: 'cubing.js + sr-puzzlegen + visualcube 三件套',
    zh: <><strong>cubing.js</strong> 渲染动画 (TwistyPlayer)、跑 3x3 / 4x4 求解器。<strong>sr-puzzlegen</strong> 出 sq1 / megaminx / pyraminx / skewb 静态 SVG。<strong>visualcube</strong> 出 NxN 状态图 (F2L / OLL / PLL / ZBLL)。三者各管一块, <strong>禁止手写魔方 SVG</strong>。</>,
    en: <><strong>cubing.js</strong> for animation (TwistyPlayer) and 3x3/4x4 solvers. <strong>sr-puzzlegen</strong> for sq1 / megaminx / pyraminx / skewb SVGs. <strong>visualcube</strong> for NxN state images (F2L / OLL / PLL / ZBLL). Three libs, three lanes — <strong>hand-written cube SVG is banned</strong>.</>
},
  {
    title: 'i18n / English and Simplified Chinese',
    zh: <>长文和复用文案走 <code>t()</code> 与语言 JSON；组件内短文案走 <code>tr()</code>、<code>T</code> 或 <code>useT()</code>。页面不手写语言判断三元。WCA 比赛中文名由独立数据源维护。</>,
    en: <>Long-form and reused copy uses <code>t()</code> with locale JSON; short component copy uses <code>tr()</code>, <code>T</code>, or <code>useT()</code>. Pages do not hand-roll language ternaries. Chinese WCA competition names have their own data source.</>
},
  {
    title: 'Theme — dark / light / system 三态',
    zh: <>语义 token (<code>--background --foreground --muted-foreground --accent --signal-*</code>) 集中定义主题。衍生色用 <code>color-mix()</code>，系统、亮色和暗色通过同一套变量切换。</>,
    en: <>Semantic tokens (<code>--background --foreground --muted-foreground --accent --signal-*</code>) define the theme centrally. Derived colors use <code>color-mix()</code>, and system, light, and dark modes switch the same variable set.</>
},
  {
    title: 'WCA 统计的脆弱三角',
    zh: <>统计生成物需要 <code>core/jobs/stats-build</code> 的输出、<code>.github/workflows/stats.yml</code> 的传输清单和 <code>ops/sql/load.sql</code> 的装载清单保持一致。发布前的管道检查会对照这三段契约，防止产物生成后没有传输或装载。</>,
    en: <>Statistics artifacts require the output from <code>core/jobs/stats-build</code>, the transfer manifest in <code>.github/workflows/stats.yml</code>, and the load manifest in <code>ops/sql/load.sql</code> to stay aligned. A pre-release pipeline check compares all three contracts so generated artifacts are not skipped during transfer or loading.</>
},
  {
    title: 'fork / port / own 三种治理',
    zh: <><strong>fork</strong> 表示上游静态资源原样托管，只维护外层包装；<strong>port</strong> 表示在仓库内重写；<strong>own</strong> 表示自研。改 fork 或 port 前必须先确认上游边界。</>,
    en: <><strong>fork</strong> means upstream static assets are hosted as-is with only a local wrapper; <strong>port</strong> means rewritten in-repo; <strong>own</strong> means built here. Check the upstream boundary before changing a fork or port.</>
},
  {
    title: '状态管理 — Zustand(内存)+ nuqs(URL)',
    zh: <>客户端内存 / 持久化状态走 <strong>Zustand</strong>:<code>auth_store</code> (WCA OAuth 用户)、<code>settingsStore</code> (主题 / 语言, persist)、<code>sessionStore</code> (当前 solve 会话, persist)、<code>statsStore</code> (WCA stats 查询)、<code>trainerStore</code> (训练状态, persist)、<code>recon_store</code> (复盘缓存);页面级 store 跟着各自 page 走 (battle / calc / mosaic / viz)。模式统一:<code>create()</code> 返回 hook, 不用 Provider, 不写 reducer。<strong>URL 状态</strong>(在哪个视图 / tab / 筛选 / 搜索)统一走 <strong>nuqs</strong> 的 <code>useQueryState</code> 写进 query params — 刷新可恢复、能分享深链、前进后退正常:大视图 / tab / 模式 / 浮层 push 进历史(后退能返回), 筛选 / 排序 / 搜索 replace(不堆历史)。禁裸 <code>history.pushState/replaceState</code> + 手写 popstate, 一个 PreToolUse hook 写入即拦 + 一条 vitest 守卫在 CI 兜底, 仅 maplibre / zustand 数据序列化等少数处豁免。</>,
    en: <>In-memory / persisted client state uses <strong>Zustand</strong>: <code>auth_store</code> (WCA OAuth user), <code>settingsStore</code> (theme / lang, persisted), <code>sessionStore</code> (active solve session, persisted), <code>statsStore</code> (WCA stats query), <code>trainerStore</code> (drill state, persisted), <code>recon_store</code> (recon cache); page-local stores live next to their pages (battle / calc / mosaic / viz). One pattern throughout: <code>create()</code> returns a hook — no Provider, no reducer. <strong>URL state</strong> (which view / tab / filter / search) goes through <strong>nuqs</strong> <code>useQueryState</code> into the query params — survives refresh, shareable deep links, correct back/forward: big views / tabs / modes / overlays push to history (back returns), filters / sort / search replace (no history pile-up). Raw <code>history.pushState/replaceState</code> and hand-rolled popstate are banned — a PreToolUse hook blocks them at write time and a vitest guard backstops CI, with only a few exemptions (maplibre, zustand data serialization).</>
},
  {
    title: 'npm registry — 我们用 pnpm 但拉的是 npm',
    zh: <><code>pnpm</code> 是包管理客户端，依赖仍遵循 npm 的 <code>package.json</code>、语义化版本和 lockfile 协议。选择它是为了共享依赖存储和更顺手的 monorepo 工作流。</>,
    en: <><code>pnpm</code> is the package-manager client; dependencies still follow npm’s <code>package.json</code>, semantic-versioning, and lockfile protocols. It is used for its shared dependency store and monorepo workflow.</>
},
];

export type StageId = 'browser' | 'edge' | 'spa' | 'fetch' | 'api' | 'hono' | 'pg';

export interface Stage { id: StageId; zh: string; en: string; sub: string;
 }
export const TRACER_STAGES: Stage[] = [
  { id: 'browser', zh: '浏览器',           en: 'Browser',           sub: 'navigation + fetch'
},
  { id: 'edge',    zh: '交付入口',          en: 'Delivery entry',    sub: 'static + forward' },
  { id: 'spa',     zh: 'Web 前端',          en: 'Web frontend',      sub: 'App Router + RSC'
},
  { id: 'fetch',   zh: 'apiUrl()',          en: 'apiUrl()',          sub: 'shared API entry' },
  { id: 'api',     zh: 'HTTP 缓存',          en: 'HTTP cache',        sub: 'hit + miss' },
  { id: 'hono',    zh: 'Hono API',          en: 'Hono API',          sub: 'route + auth' },
  { id: 'pg',      zh: 'PostgreSQL',        en: 'PostgreSQL',        sub: 'query + transaction' },
];

export interface Pattern {
  id: string;
  zh: { label: string; detail: string };
  en: { label: string; detail: string };
  route: string;
  lit: StageId[];
  cacheHit: boolean;
  result: string;
}
export const TRACER_PATTERNS: Pattern[] = [
  {
    id: 'home',
    route: '/',
    lit: ['browser', 'edge', 'spa'],
    cacheHit: false,
    result: 'STATIC PAGE',
    zh: { label: '打开首页', detail: '首页可以直接使用预生成页面，浏览器再接管交互。只有需要动态数据的组件才会另外请求 API。' },
    en: { label: 'Open home', detail: 'The home page can use a pre-generated page directly, then the browser takes over interaction. Only components that need dynamic data make a separate API request.' }
},
  {
    id: 'recon-fresh',
    route: '/recon/abc',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api', 'hono', 'pg'],
    cacheHit: false,
    result: 'FULL DATA PATH',
    zh: { label: '首次打开复盘', detail: 'Web 页面返回后，浏览器通过 apiUrl() 请求复盘数据。未命中缓存时，请求继续经过 Hono 路由和 PostgreSQL，再把 JSON 返回页面。' },
    en: { label: 'First-time recon view', detail: 'After the web page returns, the browser requests reconstruction data through apiUrl(). On a cache miss, the request continues through the Hono route and PostgreSQL, then returns JSON to the page.' }
},
  {
    id: 'wca-cached',
    route: '/wca/results?show=persons',
    lit: ['browser', 'edge', 'spa', 'fetch', 'api'],
    cacheHit: true,
    result: 'CACHE RETURN',
    zh: { label: '回访 WCA 统计', detail: '可缓存的统计数据命中 HTTP 缓存时会直接返回 JSON，不再进入 Hono 和 PostgreSQL；未命中时才继续走完整数据路径。' },
    en: { label: 'Revisit WCA stat', detail: 'When cacheable statistics data hits the HTTP cache, JSON returns directly without reaching Hono or PostgreSQL. A miss continues through the full data path.' }
},
  {
    id: 'iframe-fork',
    route: '/tools/cstimer/index.html',
    lit: ['browser', 'edge'],
    cacheHit: false,
    result: 'STATIC ASSET',
    zh: { label: '打开 fork 内部页', detail: 'fork 的内部页面是静态资源，由交付入口直接返回，不进入 Web 前端或 API。站内入口只负责提供外层页面和 iframe。' },
    en: { label: 'Fork inner page', detail: 'The fork’s inner page is a static asset returned directly by the delivery entry, without entering the web frontend or API. The site route only provides the wrapper page and iframe.' }
},
];

// 写作约定(列表 TIMELINE + 日历 timeline_commits.json 同此): 日期只写单个完整 YYYY-MM-DD, 禁用范围或月份;
// 内容面向访客(速拧玩家 / 普通访客), 不是开发日志。极简——title 点明用户能感知的变化, body 一句话, expand 两句内;
// 禁路由路径当主标识 / 行数 / 内部组件名 / 缩写黑话。
type TimelineDate = `${number}-${number}-${number}`;

export interface TLEntry {
  date: TimelineDate;
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
export const TIMELINE: TLEntry[] = ([
  {
    date: '2026-08-25',
    tag: 'migration',
    zh: {
      title: '核心工作区按运行边界重组',
      body: 'API、移动应用、小程序、求解服务与离线任务分别归入应用、共享包和任务目录。',
      expand: '部署流程、构建路径与边界守卫同步调整，前端、服务端和生成任务不再借用彼此的源码入口。',
    },
    en: {
      title: 'The core workspace is reorganized by runtime boundary',
      body: 'The API, mobile app, Mini Program, solver service and offline jobs now live under dedicated app, package and job areas.',
      expand: 'Deployment workflows, build paths and boundary checks move with them so the front end, server and generated jobs no longer borrow one another\'s source entry points.',
    },
  },
  {
    date: '2026-08-25',
    tag: 'feature',
    zh: {
      title: '云端三阶最优求解升级至 opt8',
      body: '云端使用约 7.8 GB 的 opt8 表求最少步解，用户无需在本机下载大表。',
      expand: '制表进度会实时显示，任务完成后仍沿用原有队列、结果与分享流程。',
    },
    en: {
      title: 'Cloud optimal 3x3 solving upgrades to opt8',
      body: 'The cloud service uses an approximately 7.8 GB opt8 table for fewest-move solutions without requiring a local table download.',
      expand: 'Table-generation progress is shown live, while completed jobs retain the existing queue, result and sharing flow.',
    },
  },
  {
    date: '2026-08-26',
    tag: 'feature',
    zh: {
      title: '站点目录改为主题优先筛选',
      body: '网站导航先按内容主题归类，再用魔方项目与关键词缩小工具和资料范围。',
      expand: '主题、项目和搜索条件共享同一套筛选状态，链接打开后可直接还原当前视图。',
    },
    en: {
      title: 'The site directory adopts topic-first filtering',
      body: 'Navigation groups resources by topic first, then narrows tools and references by puzzle event and keyword.',
      expand: 'Topics, events and search share one filter state so opening a link can restore the same view.',
    },
  },
  {
    date: '2026-08-24',
    tag: 'infra',
    zh: {
      title: '公开基础设施说明页上线',
      body: '网站、API、静态资源、移动端与离线任务的运行边界集中公开说明。',
      expand: '页面同时梳理部署路径、缓存职责和生成物来源，便于核对每项能力由哪个运行单元负责。',
    },
    en: {
      title: 'A public infrastructure profile launches',
      body: 'The runtime boundaries for the website, API, static assets, mobile apps and offline jobs are documented in one place.',
      expand: 'It also maps deployment paths, cache responsibilities and generated-data sources to the runtime unit that owns each capability.',
    },
  },
  {
    date: '2026-08-23',
    tag: 'feature',
    zh: {
      title: '统一魔方转动记号指南上线',
      body: '不同魔方的转动符号、读法与示例集中到同一套双语指南。',
      expand: '指南继续加入模拟器驱动的交互训练与共享钟表盘，让阅读、演示和练习使用同一套动作语义。',
    },
    en: {
      title: 'A unified puzzle move-notation guide launches',
      body: 'Move symbols, readings and examples for different puzzles are collected in one bilingual guide.',
      expand: 'Simulator-driven drills and a shared clock board then let reading, demonstrations and practice use the same move semantics.',
    },
  },
  {
    date: '2026-08-22',
    tag: 'migration',
    zh: {
      title: '教学 Platform 完整并入主站',
      body: '组织、课程、学员和运营工作台统一进入主站，独立前端停止承担现役功能。',
      expand: '搜索、登录态、语言与深链一并复用主站能力，减少两套前端之间的重复维护。',
    },
    en: {
      title: 'The teaching Platform moves fully into the main site',
      body: 'Organization, course, learner and operations workspaces now live in the main site, retiring the standalone front end from active use.',
      expand: 'Search, identity, language and deep links reuse the main-site foundation, reducing duplicate maintenance across two front ends.',
    },
  },
  {
    date: '2026-08-21',
    tag: 'feature',
    zh: {
      title: '成绩计算器支持分享直播',
      body: '房主分享链接后，观众可只读查看比赛成绩，并在房主继续录入时收到后续更新。',
      expand: '比赛成绩与选手资料也能直接带入计算器，直播、核分和赛后查看使用同一份结果。',
    },
    en: {
      title: 'The score calculator supports shareable live results',
      body: 'After a host shares a link, viewers can follow results read-only and receive later scores as the host enters them.',
      expand: 'Competition results and competitor details can also open directly in the calculator so live scoring, verification and review use the same result set.',
    },
  },
  {
    date: '2026-08-21',
    tag: 'feature',
    zh: {
      title: '对色与邻色测试上线',
      body: '训练者可独立练习中心色对应关系与相邻色方向判断。',
      expand: '题目、作答反馈和连续训练流程复用站内训练框架，手机端也保持紧凑操作。',
    },
    en: {
      title: 'Color and adjacent-color quizzes launch',
      body: 'Solvers can practise opposite-center relationships and adjacent-color orientation as focused drills.',
      expand: 'Questions, answer feedback and continuous practice reuse the site training framework with compact mobile controls.',
    },
  },
  {
    date: '2026-08-20',
    tag: 'feature',
    zh: {
      title: 'WCA 比赛模拟器上线',
      body: '用户可按比赛项目、轮次和赛制模拟晋级过程与最终排名。',
      expand: '模拟结果沿用真实比赛的成绩格式与晋级规则，适合赛前预演和赛制理解。',
    },
    en: {
      title: 'The WCA competition simulator launches',
      body: 'Users can simulate advancement and final standings by event, round and competition format.',
      expand: 'Results follow real competition formatting and advancement rules for pre-event rehearsal and format exploration.',
    },
  },
  {
    date: '2026-08-20',
    tag: 'feature',
    zh: {
      title: '社区动态与公开反馈流上线',
      body: '论坛帖子、短视频和公开反馈可在统一信息流中浏览。',
      expand: '固定链接与可交互统计随后接入，用户能从汇总直接进入对应内容。',
    },
    en: {
      title: 'Community activity and the public feedback feed launch',
      body: 'Forum posts, short videos and public feedback can be browsed in unified activity feeds.',
      expand: 'Permalinks and interactive statistics then connect summaries directly to their matching content.',
    },
  },
  {
    date: '2026-08-19',
    tag: 'feature',
    zh: {
      title: '老师直播脚本库上线',
      body: '老师可保存、整理并复用自己的结构化直播脚本。',
      expand: '公开脚本页保留分段结构与作者归属，方便课前准备、直播展示和课后分享。',
    },
    en: {
      title: 'The teacher livestream script library launches',
      body: 'Teachers can save, organize and reuse their own structured livestream scripts.',
      expand: 'Public script pages preserve section structure and authorship for preparation, live presentation and later sharing.',
    },
  },
  {
    date: '2026-08-19',
    tag: 'feature',
    zh: {
      title: 'WCA 并列领奖台与 H2H 查询上线',
      body: '统计页可查看单次和平均并列领奖台，比赛中心也能发现采用 H2H 赛制的比赛。',
      expand: '统计覆盖所有符合条件的轮次，H2H 标识复用项目图标体系展示在比赛信息中。',
    },
    en: {
      title: 'WCA tied podiums and H2H discovery launch',
      body: 'Statistics show tied single and average podiums, while the competition center can discover events using the H2H format.',
      expand: 'The statistics cover every eligible round, and H2H status appears in competition details through the shared event-icon system.',
    },
  },
  {
    date: '2026-08-17',
    tag: 'feature',
    zh: {
      title: '教学管理形成完整工作流',
      body: '组织、校区、班级、课包、课次、训练与证据记录在主站串联起来。',
      expand: '随后加入请假补课、课时退回与冲正、周报、家校沟通、经营概览和审计记录。',
    },
    en: {
      title: 'Teaching management becomes an end-to-end workflow',
      body: 'Organizations, campuses, groups, lesson packages, sessions, training and evidence records connect across the main site.',
      expand: 'Leave and makeup handling, credit refunds and reversals, weekly reports, family conversations, operations summaries and audit records follow.',
    },
  },
  {
    date: '2026-08-17',
    tag: 'feature',
    zh: {
      title: '成果展示页上线',
      body: '求解器、模拟器、复盘、统计与原创研究成果在双语页面集中呈现。',
      expand: '每项成果都连接到可验证的产品页面或数据证据，首页也提供统一入口。',
    },
    en: {
      title: 'The achievements showcase launches',
      body: 'Solvers, simulators, reconstruction, statistics and original research are collected in one bilingual showcase.',
      expand: 'Each achievement links to verifiable product or data evidence, with a shared entry point from the home page.',
    },
  },
  {
    date: '2026-08-17',
    tag: 'feature',
    zh: {
      title: '师资资料支持履历与多图展示',
      body: '老师可在独立编辑页维护履历、分类照片、排序与公开状态。',
      expand: '公开目录使用封面与图库呈现资料，并在上传和展示两端校验图片归属。',
    },
    en: {
      title: 'Teacher profiles gain resume and multi-photo presentation',
      body: 'Teachers can manage resume details, categorized photos, ordering and visibility on a dedicated editor page.',
      expand: 'The public directory presents a cover and gallery while validating image ownership during upload and display.',
    },
  },
  {
    date: '2026-08-17',
    tag: 'feature',
    zh: {
      title: '微信小程序接入多品牌智能魔方',
      body: '小程序计时器支持 GAN、GoCube、Giiker 与魔域设备的蓝牙连接。',
      expand: '共享协议与原生桥接覆盖扫描、配对、状态同步和断线恢复，使网页与小程序沿用一致的设备语义。',
    },
    en: {
      title: 'The WeChat Mini Program connects multiple smart-cube brands',
      body: 'Its timer supports Bluetooth connections for GAN, GoCube, Giiker and MoYu devices.',
      expand: 'Shared protocols and the native bridge cover scanning, pairing, state sync and reconnection so web and Mini Program clients use consistent device semantics.',
    },
  },
  {
    date: '2026-08-16',
    tag: 'migration',
    zh: {
      title: '开发入口改名为 Dev',
      body: '原来的 /code 全系列页面迁到 /dev，首页中英文名称同步改为 Dev / 开发。',
      expand: '架构、语言、算法、运维和组件等子页一起迁移，站点地图、页面标题与维护技能也使用同一个新路径。',
    },
    en: {
      title: 'The development hub becomes Dev',
      body: 'The entire /code route family moves to /dev, while the home-page label becomes Dev in English and 开发 in Chinese.',
      expand: 'Architecture, language, algorithm, operations and component pages move together, with sitemap, metadata and maintenance skills following the same path.',
    },
  },
  {
    date: '2026-08-16',
    tag: 'feature',
    zh: {
      title: '微信小程序计时器完成首个可用版本',
      body: '小程序复用网站计时核心，支持打乱、观察、计时、+2 / DNF 与本地成绩历史。',
      expand: '域名、应用身份和开发工具流程同步接好，让网页与小程序保持相同的计时行为。',
    },
    en: {
      title: 'The WeChat Mini Program timer reaches its first usable release',
      body: 'It reuses the web timing core for scrambles, inspection, timing, +2 / DNF and local solve history.',
      expand: 'Domain, app identity and developer-tool setup are connected so the web and Mini Program share the same timing behaviour.',
    },
  },
  {
    date: '2026-08-15',
    tag: 'feature',
    zh: {
      title: 'SQ1 工具扩展为完整工作区',
      body: '形状命名、公式训练、检查、导入、计数、奇偶练习与可视化集中到同一套 SQ1 工具中。',
      expand: '所有页面共用规范形状名、解析器和状态显示，并与 Squanmate 的命名对齐。',
    },
    en: {
      title: 'Square-1 tools grow into a complete workspace',
      body: 'Shape naming, algorithm training, inspection, import, counting, parity drills and visualization now live in one Square-1 toolkit.',
      expand: 'Every page shares canonical shape names, parsing and state display, aligned with Squanmate terminology.',
    },
  },
  {
    date: '2026-08-07',
    tag: 'feature',
    zh: {
      title: '比赛与排名工具连续扩展',
      body: 'Kinch 排名、自办比赛、纪录地点排行与逐层查看陆续上线。',
      expand: '比赛系统可管理项目、选手和成绩；WCA 排名页则支持按项目筛选、搜索与分页查看。',
    },
    en: {
      title: 'Competition and ranking tools expand',
      body: 'Kinch rankings, self-run competitions, record-place rankings and drill-down views launch in sequence.',
      expand: 'The competition system manages events, competitors and results, while WCA ranking views support event filters, search and pagination.',
    },
  },
  {
    date: '2026-08-13',
    tag: 'feature',
    zh: {
      title: '课程平台与师资目录上线',
      body: '课程页集中展示录播课方案和试听内容，师资目录把老师与培训机构接到选手资料。',
      expand: '试听介绍可由后台编辑，并提供中文内容同步成自然英文的维护流程。',
    },
    en: {
      title: 'Courses and the teacher directory launch',
      body: 'Courses bring recorded lesson plans and trial material together, while the directory connects teachers and schools to person profiles.',
      expand: 'Trial introductions are admin-editable and include a workflow for syncing Chinese content into natural English.',
    },
  },
  {
    date: '2026-08-13',
    tag: 'feature',
    zh: {
      title: '协作文档与表格上线',
      body: '站内新增多人实时编辑的文档和电子表格，支持自动保存与成员权限。',
      expand: '列表页负责创建和管理内容，独立编辑页承载实时协作。',
    },
    en: {
      title: 'Collaborative documents and spreadsheets launch',
      body: 'The site gains real-time multi-user documents and spreadsheets with autosave and member permissions.',
      expand: 'List pages create and manage content, while dedicated editor pages host the live collaboration experience.',
    },
  },
  {
    date: '2026-08-11',
    tag: 'feature',
    zh: {
      title: '公式学习加入识别指南、记号页与计时挑战',
      body: '案例可切到简洁模式，识别页补上分步指南，三阶记号与公式连锁训练也有了独立入口。',
      expand: '公式连锁随后演进为计时挑战，让识别、回忆和连续执行形成一条训练路径。',
    },
    en: {
      title: 'Algorithm learning gains guides, notation and timed challenges',
      body: 'Cases gain a compact mode, recognition pages add step-by-step guides, and 3x3 notation and algorithm chains receive dedicated entries.',
      expand: 'Algorithm chains then evolve into a timed challenge that connects recognition, recall and continuous execution.',
    },
  },
  {
    date: '2026-08-12',
    tag: 'feature',
    zh: {
      title: 'Android 离线计时器完成基础版本',
      body: '移动应用以 Capacitor 承载共用计时状态，离线支持打乱、观察、成绩历史与会话。',
      expand: '应用图标、隐私页、打包配置和发布前校验一起落地。',
    },
    en: {
      title: 'The Android offline timer reaches its foundation release',
      body: 'A Capacitor app hosts the shared timer state with offline scrambles, inspection, solve history and sessions.',
      expand: 'App icons, privacy information, packaging configuration and pre-release checks land together.',
    },
  },
  {
    date: '2026-08-04',
    tag: 'feature',
    zh: {
      title: '视频会议与对战通话上线',
      body: '独立会议房间支持创建、加入和邀请，计时器在线对战也能直接发起视频通话。',
      expand: '随后补上登录门槛与二维码邀请，会议入口保持适合手机操作。',
    },
    en: {
      title: 'Video rooms and battle calls launch',
      body: 'Standalone rooms support creating, joining and inviting, and online timer battles can start a video call directly.',
      expand: 'Sign-in requirements and QR invitations follow, with the room entry kept mobile-friendly.',
    },
  },
  {
    date: '2026-07-31',
    tag: 'feature',
    zh: {
      title: '魔方知识问答上线',
      body: '问答页提供基础与进阶题目，按主题检验规则、历史、公式与赛事知识。',
      expand: '登录用户随后可以创建题目、管理自己的投稿并继续扩充题库。',
    },
    en: {
      title: 'The cubing knowledge quiz launches',
      body: 'Basic and advanced questions test knowledge of regulations, history, algorithms and competitions by topic.',
      expand: 'Signed-in users can then create questions, manage their submissions and grow the question bank.',
    },
  },
  {
    date: '2026-08-01',
    tag: 'feature',
    zh: {
      title: '日历与时区工具上线',
      body: '个人日历支持月、周、日视图与公开分享，时区页可换算时间并生成 Discord 时间戳。',
      expand: '日历随后加入 Google 日历导入、整批撤销、重复日程和只展示忙碌时段的分享链接。',
    },
    en: {
      title: 'Calendar and time-zone tools launch',
      body: 'The personal calendar offers month, week and day views with sharing, while time-zone conversion can generate Discord timestamps.',
      expand: 'Google Calendar import, batch undo, recurring events and busy-only public links follow.',
    },
  },
  {
    date: '2026-07-31',
    tag: 'feature',
    zh: {
      title: '盲拧公式工具集中上线',
      body: 'BLDDB 接入站内，三盲公式查询、表格与抓握辅助使用同一套盲拧数据。',
      expand: '可按缓冲块和体系查公式，也能把编码与训练表整理成更适合日常练习的形式。',
    },
    en: {
      title: 'Blindfolded algorithm tools launch together',
      body: 'BLDDB joins the site, with native 3BLD lookup, sheets and grip aids sharing the same blindfolded data.',
      expand: 'Algorithms can be browsed by buffer and method, while lettering and drill sheets are organized for daily practice.',
    },
  },
  {
    date: '2026-07-30',
    tag: 'migration',
    zh: {
      title: '魔方伴图工作台并入模拟器',
      body: '原来的 VisualCube 工作台迁到模拟器的阶段页面，批量伴图入口同步退役。',
      expand: '静态图、展开图、俯视图与阶段预览由站内统一渲染入口承载。',
    },
    en: {
      title: 'The cube-image workbench moves into the simulator',
      body: 'The former VisualCube workbench moves to the simulator stage page, and the batch companion-image entry retires.',
      expand: 'Static states, nets, plan views and stage previews now share one site-owned rendering entry.',
    },
  },
  {
    date: '2026-07-29',
    tag: 'feature',
    zh: {
      title: '/stroop 色词干扰测试上线',
      body: '新增 /stroop：屏幕给出一个颜色词，要求按它实际的墨色而非词义作答，用来练识别与反应的抗干扰能力。',
      expand: '卡片只用魔方的六种配色，计时与判定复用速拧计时器的引擎。',
    },
    en: {
      title: 'A /stroop interference test launches',
      body: 'The new /stroop page shows a colour word and asks you to answer by the ink it is printed in rather than the word itself, training recognition under interference.',
      expand: 'Cards are inked only in the six cube colours, and timing and judging reuse the speedcubing timer engine.',
    }
},
  {
    date: '2026-07-26',
    tag: 'feature',
    zh: {
      title: '/predict 预判训练器上线',
      body: '新增 /predict：给出打乱和一段公式，问你执行后某个位置会是什么颜色，训练盲拧和 F2L 的预判能力。可以自己输入公式，答完能在三维魔方上回放，点任一步骤即可跳到那一步。',
      expand: '未提问的格子会按阶段遮罩调暗，只留下问题涉及的贴纸保持原色。',
    },
    en: {
      title: 'The /predict lookahead trainer launches',
      body: 'The new /predict page gives you a scramble and an algorithm and asks what colour a given spot ends up, training the lookahead used in blindfolded solving and F2L. You can type your own algorithm, replay the answer on a 3D cube, and click any move to scrub to that step.',
      expand: 'Facelets the question does not name are dimmed by the stage mask, leaving only the relevant stickers at full colour.',
    }
},
  {
    date: '2026-07-26',
    tag: 'feature',
    zh: {
      title: '全站悬浮节拍器，桌宠一键唤出',
      body: '节拍器从计时器内部搬出来，成为全站悬浮工具，任何页面都能从桌宠打开，切走再切回来也不会静音。',
      expand: '上限提到每秒 30 拍，够练最快的手法节奏。',
    },
    en: {
      title: 'A site-wide floating metronome, opened from the desk pet',
      body: 'The metronome moved out of the timer into a floating site-wide tool that any page can open from the desk pet, and it keeps ticking after you switch away and back.',
      expand: 'Its ceiling was raised to 30 ticks per second, fast enough for the quickest fingertrick drills.',
    }
},
  {
    date: '2026-07-26',
    tag: 'feature',
    zh: {
      title: '十字与 XCross 精确穷举分布上线',
      body: '打乱难度库补上十字与 XCross 的精确步数分布：不再抽样估计，而是穷举全部状态算出来，并单列出最难的一批状态供练习。',
      expand: '与流传的表格逐格核对后，纠正了伪十字一栏的几个错误数字。',
    },
    en: {
      title: 'Exhaustive Cross and XCross distributions launch',
      body: 'The scramble-difficulty library gained exact move-count distributions for Cross and XCross — computed by exhausting every state rather than sampled — plus a listing of the hardest states to practise on.',
      expand: 'Checking them cell by cell against the circulated spreadsheet corrected several wrong numbers in its pseudo-cross column.',
    }
},
  {
    date: '2026-07-24',
    tag: 'feature',
    zh: {
      title: '涂色求解扩展到二阶、斜转、金字塔与 SQ1',
      body: '求解器的“照着实物涂色”入口从三阶推广到二阶、斜转、金字塔与 SQ1，并默认换成可拖动的三维模型，比平面展开图更好对照手里的魔方。',
      expand: '四种三维板共用同一套外壳与手势，转动惯性和自动旋转与 /sim 一致。',
    },
    en: {
      title: 'Paint-a-state solving extends to 2x2, Skewb, Pyraminx and Square-1',
      body: 'The solver’s "paint what you are holding" entry expanded from 3x3 to 2x2, Skewb, Pyraminx and Square-1, and now defaults to a draggable 3D model that is easier to match against the puzzle in your hands than a flat net.',
      expand: 'All four 3D boards share one shell and one gesture layer, with the same inertia and auto-rotate as /sim.',
    }
},
  {
    date: '2026-07-27',
    tag: 'infra',
    zh: {
      title: '全站加载优化与页面标题补齐',
      body: '一轮加载审计：字体与第三方脚本改为自托管，对战视图和弹窗改按需加载，公式库缩略图不再逐张请求而由页面本地绘制；同时给每个路由补上标题与描述，并由测试卡住新增路由。',
      expand: '求解器的十字提示表从一次性 30MB 改为按需下载并在空闲时预取，进度可见。',
    },
    en: {
      title: 'A site-wide load pass, and a title for every page',
      body: 'A load audit: fonts and vendor scripts became self-hosted, battle views and modals load on demand, and algorithm-library thumbnails are drawn by the page instead of fetched one by one. Every route also gained a title and description, enforced by a test that fails on any new route without one.',
      expand: 'The solver’s cross-hint tables dropped from a 30MB upfront payload to an on-demand download with visible progress, prefetched while idle.',
    }
},
  {
    date: '2026-07-23',
    tag: 'feature',
    zh: {
      title: 'LSLL 公式库上线，全部 583,284 个状态附最优解',
      body: '新增 LSLL（最后一个角块槽 + 顶层一起解）公式库与配套数学页，可按一步解和两步解两种路线浏览；批量求解管线跑完全部 583,284 个状态，每个案例页都给出最优解长度与解法。',
      expand: '训练器按“轮”推进，一轮 302 个案例、共 494 轮，进度按范围分别记录，才能真正把这个量级刷完。',
    },
    en: {
      title: 'An LSLL library launches, with optimal solutions for all 583,284 states',
      body: 'A new library for LSLL (last slot and last layer together) launched with a companion maths page, browsable as one-look or two-look routes; a batch pipeline solved all 583,284 states, so every case page shows its optimal length and solution.',
      expand: 'The trainer works in rounds — 302 cases each, 494 rounds in all — recording progress per scope so a set this size can actually be finished.',
    }
},
  {
    date: '2026-07-25',
    tag: 'feature',
    zh: {
      title: '魔表最优求解器与交互式表盘上线',
      body: '新增魔表求解页：可在二维表盘上直接拨出手里的状态，求解器用纯 TypeScript 实现，给出的是可证明最优的解法，不是启发式近似。',
      expand: '同期接入 WCA 真题语料，算出魔表打乱的难度分布。',
    },
    en: {
      title: 'An optimal Rubik’s Clock solver and board launch',
      body: 'A new Clock page lets you dial in the state you are holding on an interactive 2D board; the solver is written in pure TypeScript and returns a provably optimal solution rather than a heuristic approximation.',
      expand: 'The same work fed the WCA scramble corpus through it to produce a difficulty distribution for Clock.',
    }
},
  {
    date: '2026-07-25',
    tag: 'feature',
    zh: {
      title: '日掩纪录榜上线，纪录按规则 9i2 判定',
      body: '新增日掩纪录榜：收录那些当天成绩本可成纪录、却被同日更快成绩掩过而未被认定的项目。比赛结果、首页快讯与纪录浮层统一按规则 9i2 判定同日成绩。',
      expand: '被掩的成绩单列出选手、成绩与所在比赛三列，同一天内顺序稳定。',
    },
    en: {
      title: 'A keatoned-records board launches, adjudicated by Regulation 9i2',
      body: 'A new leaderboard collects results that would have been records but were beaten by a faster same-day result and so never counted. Competition results, the homepage feed and the rank overlay all apply Regulation 9i2 to same-day results.',
      expand: 'The occulting result is broken out into its own person, result and competition columns, with a stable order within a single date.',
    }
},
  {
    date: '2026-07-24',
    tag: 'feature',
    zh: {
      title: '计时器接入蓝牙智能魔方与智能计时器',
      body: '速拧计时器可以连蓝牙智能魔方与 MoYu32 智能计时器，还能用手机陀螺仪把魔方姿态映射到三维视图；同时补上 DNS、多盲与最少步成绩录入、模拟一整轮比赛和按键自定义。',
      expand: '蓝牙驱动逐字节对照 csTimer 做了一致性测试，保证同一颗魔方两边解出的状态相同。',
    },
    en: {
      title: 'The timer connects Bluetooth smart cubes and smart timers',
      body: 'The speedcubing timer can pair with Bluetooth smart cubes and MoYu32 smart timers, and can map a phone’s gyroscope onto a 3D view of the cube. It also gained DNS / multi-blind / fewest-moves result entry, whole-round simulation and rebindable keys.',
      expand: 'The Bluetooth drivers are checked byte for byte against csTimer, so the same cube decodes to the same state on both.',
    }
},
  {
    date: '2026-07-24',
    tag: 'feature',
    zh: {
      title: '公式训练器加间隔重复记忆系统',
      body: '训练器按记忆强度安排复习：练熟的公式间隔拉长，生疏的优先回来，进度可按公式集或整体重置，也能跨设备同步。',
      expand: '通过一次即默认记为已掌握，标记只保留“已掌握”和“生疏”两档。',
    },
    en: {
      title: 'The algorithm trainer gains spaced repetition',
      body: 'The trainer now schedules review by memory strength: algorithms you know come back less often, shaky ones come back first, and progress can be reset per set or entirely and syncs across devices.',
      expand: 'Passing a case marks it mastered by default, leaving just two marks — mastered and shaky.',
    }
},
  {
    date: '2026-07-24',
    tag: 'feature',
    zh: {
      title: '图案搜索与对称类型浏览上线',
      body: '新增 /scramble/pattern/search：按 Cube Explorer 的图案编辑器复刻，指定想要的花样即可求出到达它的打乱；同时新增 /scramble/symmetry，按对称类型浏览状态。',
      expand: '图案范例可由管理员在页面上直接增删，不必改代码。',
    },
    en: {
      title: 'Pattern search and a symmetry explorer launch',
      body: '/scramble/pattern/search ports Cube Explorer’s pattern editor: describe the picture you want and it finds a scramble that reaches it. /scramble/symmetry launched alongside it to browse states by symmetry type.',
      expand: 'The pattern examples are editable in-page by an admin, with no code change needed.',
    }
},
  {
    date: '2026-07-23',
    tag: 'feature',
    zh: {
      title: '跨设备在线对战房间上线',
      body: '计时器对战从同机双人扩展为在线房间：不同设备各自加入，房主统一开始，每人可选自己的项目，玩家条始终可见。后续支持邀请链接直接进房和房内改名。',
      expand: '房间用 WCA 身份显示玩家，重名会被拒绝，未登录也能加入。',
    },
    en: {
      title: 'Cross-device online battle rooms launch',
      body: 'Timer battles grew from two players on one machine into online rooms: devices join separately, the host starts everyone together, each player picks their own event, and the player bar stays visible. Joining straight from an invite link and renaming in the room followed.',
      expand: 'Rooms show players by WCA identity and reject duplicate names, while logged-out players can still join.',
    }
},
  {
    date: '2026-07-23',
    tag: 'feature',
    zh: {
      title: '全站社交分享卡片上线',
      body: '复盘、比赛、选手等页面分享到社交平台时会带上标题、说明和预览图，不再是一条光秃秃的链接。',
      expand: '同期给复盘加了公开、不公开、私密三档可见性。',
    },
    en: {
      title: 'Site-wide social share cards launch',
      body: 'Sharing a recon, competition or person page now carries a title, description and preview image instead of a bare link.',
      expand: 'Recons gained public, unlisted and private visibility in the same pass.',
    }
},
  {
    date: '2026-07-21',
    tag: 'migration',
    zh: {
      title: '/sim 伴图改由自有引擎矢量导出',
      body: '虚拟魔方旁边的示意图不再交给外部渲染库，改由本站三维引擎直接导出矢量图，展开图、俯视图、半透明图、贴纸遮罩与箭头都在同一套几何里生成，和屏幕上转到的角度完全一致。',
      expand: '导出走解析式消隐，画面顺序精确、无锯齿；SQ1 的贴纸遮罩是旧渲染库本来做不到的。',
    },
    en: {
      title: '/sim companion images move onto our own vector export',
      body: 'The diagram beside the virtual cube is no longer handed to an outside rendering library — our 3D engine exports the vector image directly, generating nets, plan views, translucent views, sticker masks and arrows from one geometry that matches the angle on screen exactly.',
      expand: 'The export uses analytic hidden-surface removal, so ordering is exact and edges are clean; masking Square-1 stickers is something the old library could never do.',
    }
},
  {
    date: '2026-07-20',
    tag: 'feature',
    zh: {
      title: '步数系数计算器与批量求解器上线',
      body: '新增 /scramble/mcc，按步数系数衡量一条公式的执行难度，页内说明评分模型；同时新增批量求解与子步求解两页，可一次跑一批打乱。',
      expand: '账户管理同期合并为独立的 /account 页，登录与账号设置不再是弹窗。',
    },
    en: {
      title: 'A movecount-coefficient calculator and batch solvers launch',
      body: '/scramble/mcc scores how hard an algorithm is to execute by movecount coefficient and explains the model in-page; a batch solver and a subsolver launched alongside it to run a whole set of scrambles at once.',
      expand: 'Account management consolidated into a standalone /account page in the same pass, so signing in and account settings are no longer modals.',
    }
},
  {
    date: '2026-07-19',
    tag: 'feature',
    zh: {
      title: '公式训练器加在线协作房间',
      body: '训练器复习模式支持多人同房：一条复习队列在房间内共享，谁做完哪个案例其他人就不会重复，一轮结束统一提示。可用房间码或二维码邀请。',
      expand: '队列由服务端原子分发，同时点同一个案例也不会重复发题。',
    },
    en: {
      title: 'The algorithm trainer gains online co-op rooms',
      body: 'Recap mode can now be shared by several people in one room: they work through a single review queue, cases claimed by one person are not repeated for the others, and the round ends for everyone together. Rooms are joined by code or QR.',
      expand: 'The queue is handed out atomically by the server, so simultaneous taps cannot serve the same case twice.',
    }
},
  {
    date: '2026-07-17',
    tag: 'feature',
    zh: {
      title: '跨公式集学习进度总览上线',
      body: '新增 /alg/progress，把各公式集的已掌握、生疏与未学数量汇总在一页，也会显示在自己的主页上；同期在 /dev 新增 WCA 官网、CubingChina 两篇项目介绍。',
      expand: '总览可以下钻到具体是哪些公式，并直接开始针对生疏项的训练。',
    },
    en: {
      title: 'A cross-set learning-progress overview launches',
      body: 'The new /alg/progress page gathers mastered, shaky and unlearned counts across every algorithm set into one view, also surfaced on your own hub. Profiles of the WCA website and CubingChina launched alongside it under /dev.',
      expand: 'The overview drills down to the individual algorithms behind each count and starts a session on the shaky ones.',
    }
},
  {
    date: '2026-07-16',
    tag: 'feature',
    zh: {
      title: '/icon 图标画廊上线，/math/probability 概率页上线',
      body: '新增 /icon 图标画廊，收录站内全部魔方图标，可搜索、点击直接下载；新增 /math/probability 页，交互演示公式情形概率与旋转对称。',
      expand: '图标画廊单一数据源，站内其余图标引用同一份 SVG，杜绝各处各画一份走样。',
    },
    en: {
      title: 'An /icon gallery and a /math/probability page launch',
      body: 'A new /icon gallery collects every cube icon on the site, searchable and click-to-download; a new /math/probability page interactively demos case probability and rotational symmetry.',
      expand: 'The icon gallery is a single source of truth — every other icon on the site references the same SVGs, so no page can drift with its own hand-drawn copy.',
    }
},
  {
    date: '2026-07-16',
    tag: 'feature',
    zh: {
      title: '/sim 加阶段染色遮罩与齿轮魔方模拟器',
      body: '虚拟魔方 /sim 新增阶段染色（按 OLL / PLL / F2L 等训练阶段把无关块调暗，类似 Twizzle）；同时新增齿轮魔方（Gear Cube）模拟器，支持拖拽转动和打乱。',
      expand: '齿轮魔方引擎基于带齿轮联动的三阶状态模型，转动会带动相邻层同步转半格。',
    },
    en: {
      title: '/sim gains stage-stickering masks and a Gear Cube simulator',
      body: 'The virtual cube /sim added stage stickering (dims pieces irrelevant to a training stage like OLL/PLL/F2L, Twizzle-style) and a Gear Cube simulator with drag-to-turn and scrambling.',
      expand: 'The Gear Cube engine models geared 3x3 state where a turn drives the linked adjacent layer through a synchronized half-step.',
    }
},
  {
    date: '2026-07-14',
    tag: 'feature',
    zh: {
      title: '站内通知系统上线',
      body: '新增站内通知：复盘收到评论、回复或另解时提醒作者，论坛帖子被回复也会提醒；通知同步邮件推送，按收件人语言本地化，可在设置里关闭邮件。',
      expand: '桌宠肩上挂蓝色角标提示未读通知，点开查看后台清零。',
    },
    en: {
      title: 'A site-wide notification system launches',
      body: 'New in-site notifications: recon authors are alerted on comments, replies, and alternative solutions, and forum threads notify on replies; notifications also push matching emails, localized per recipient, with an opt-out in settings.',
      expand: 'The desk pet shows a blue badge for unread notifications, clearing once opened.',
    }
},
  {
    date: '2026-07-15',
    tag: 'dx',
    zh: {
      title: '公式训练器完全迁入 /alg',
      body: '旧的独立公式训练器路由退役，功能全部并入公式库 /alg 内的训练模式，公式库和训练不再是两套界面。',
      expand: '',
    },
    en: {
      title: 'The algorithm trainer fully migrates into /alg',
      body: 'The old standalone trainer route was retired; its features moved entirely into the training mode built into the algorithm library /alg, so the library and trainer are no longer two separate UIs.',
      expand: '',
    }
},
  {
    date: '2026-07-13',
    tag: 'feature',
    zh: {
      title: '图像编辑器并入 /sim，打乱库加两个案例画廊',
      body: '独立的魔方图像编辑器页并入虚拟魔方 /sim 的图像面板，共用同一份公式和配色；打乱难度库新增二阶首面案例画廊和金字塔 V 形案例画廊。',
      expand: '',
    },
    en: {
      title: 'The image editor merges into /sim; two new case galleries land in scramble stats',
      body: 'The standalone cube-image editor page merged into the virtual cube /sim\'s image panel, sharing its algorithm and colour scheme; the scramble-difficulty library gained a 2x2 first-face case gallery and a Pyraminx V-shape case gallery.',
      expand: '',
    }
},
  {
    date: '2026-07-13',
    tag: 'migration',
    zh: {
      title: '1LLL 公式表并入公式库',
      body: '把最后一层公式表（5059 条）从外部表格迁移进站内公式库数据库，统一记号、补齐镜像 / 逆解关系和收尾 AUF，成为一等公民数据。',
      expand: '迁移过程中顺带修正了 4 条表格里的错误公式，并统一了公式的旋转规范化写法。',
    },
    en: {
      title: '1LLL algorithms migrate into the algorithm database',
      body: 'The last-layer algorithm sheet (5,059 rows) was migrated from an external spreadsheet into the site\'s algorithm database, unifying notation and filling in mirror/inverse relations and finishing AUF as first-class data.',
      expand: 'The migration also fixed 4 corrupted algorithms found in the sheet and standardized how algorithms are rotation-normalized.',
    }
},
  {
    date: '2026-07-12',
    tag: 'feature',
    zh: {
      title: '登录改版：邮箱密码登录，登录弹窗重做',
      body: '账号系统新增邮箱 + 密码登录方式；登录弹窗改版成业界标准布局（邮箱优先，第三方登录作为按钮排在下方）。',
      expand: '',
    },
    en: {
      title: 'Login revamp: email/password sign-in, redesigned modal',
      body: 'The account system added email + password sign-in; the login modal was redesigned to an industry-standard layout (email-primary, social sign-in as buttons below).',
      expand: '',
    }
},
  {
    date: '2026-07-09',
    tag: 'feature',
    zh: {
      title: '上线 /forum 社区论坛，长文板块并入',
      body: '上线一个 speedsolving 风格的社区论坛 /forum，支持发帖、回复、板块归类和全文搜索；原来的长文 /article 全部迁成论坛主题帖，/article 退役。',
      expand: '回复和帖子编辑用富文本编辑器，单帖支持约 5 万字长文；帖子按板块组织，可全文搜索。',
    },
    en: {
      title: 'A community forum /forum launches; long-form posts fold in',
      body: 'A speedsolving-style community forum /forum launched with threads, replies, boards, and full-text search; the former long-form /article posts were all migrated into forum threads, and /article was retired.',
      expand: 'Replies and post edits use a rich-text editor supporting posts up to ~50k characters; threads are organised by board and full-text searchable.',
    }
},
  {
    date: '2026-07-04',
    tag: 'feature',
    zh: {
      title: '上线内部账号系统与第三方登录',
      body: '新增自有账号体系：邮箱 / 手机验证码登录、一个账号可绑定多种身份；同时接入 Google、Apple、微信、QQ、支付宝等第三方登录。',
      expand: '登录框用 Apple 风格分段验证码输入；第三方登录用无状态签名 state，能扛浏览器上下文切换，未配置的登录方式自动隐藏。',
    },
    en: {
      title: 'An internal account system with third-party sign-in',
      body: 'A first-party account system landed: email / phone-code login with several identities linkable to one account, alongside Google, Apple, WeChat, QQ, and Alipay sign-in.',
      expand: 'The login modal uses an Apple-style segmented code input; social login uses a stateless signed state that survives browser context switches, and unconfigured methods hide automatically.',
    }
},
  {
    date: '2026-07-04',
    tag: 'feature',
    zh: {
      title: '/sim 加可开关的写实指法手模',
      body: '虚拟魔方 /sim 新增一套 3x3 指法手模(设置开关)：GLTF 蒙皮骨骼手，按真实指法逐招转动、换握，随手指避让不穿模。',
      expand: '手模从程序化网格换成 WebXR 蒙皮模型，带运行时烘焙皮肤、指甲床和分手握姿标记；指法规范覆盖钩、连拨、推等记号。',
    },
    en: {
      title: '/sim gains a realistic fingertrick hand model (toggle)',
      body: 'The virtual cube /sim added a 3x3 fingertrick hand model (settings toggle): a GLTF skinned-mesh pair of hands that turn and regrip move-by-move to real fingering, dodging without clipping the cube.',
      expand: 'The hands moved from a procedural mesh to a WebXR skinned model with runtime-baked skin, nail beds, and per-hand grip marks; the fingering spec covers hooks, double flicks, and push notation.',
    }
},
  {
    date: '2026-06-23',
    tag: 'feature',
    zh: {
      title: '/sim 重做渲染：群论内核驱动，新增镜面魔方等多种类型',
      body: '虚拟魔方 /sim 引入通用的群论渲染内核，在原有基础上新增自有引擎的金字塔、五魔方、斜转、直升机、Dino、Redi、FTO（面转八面体）和镜面魔方，并配一个可自定义切割面的 Puzzle Cuts 编辑器。',
      expand: '群论内核把魔方定义成轨道加生成元，渲染、转动和打乱推导通用化；镜面魔方按非均匀块建模、绕中心轴转动，可单色金属或贴标准配色。',
    },
    en: {
      title: '/sim rendering reworked: a group-theory kernel, new puzzle types including the Mirror Cube',
      body: 'The virtual cube /sim gained a general group-theory rendering kernel and, on top of the existing puzzles, in-house engines for Pyraminx, Megaminx, Skewb, Helicopter, Dino, Redi, FTO (face-turning octahedron), and the Mirror Cube — plus a Puzzle Cuts editor for defining custom cut planes.',
      expand: 'The kernel models a puzzle as orbits plus generators, generalising rendering, turning, and scramble derivation; the Mirror Cube is modelled as non-uniform blocks turning about the core axis, in monochrome metal or standard colours.',
    }
},
  {
    date: '2026-06-24',
    tag: 'feature',
    zh: {
      title: 'WCA 规则页加官方全文逐字镜像和更新动态',
      body: '在图解版 WCA 规则的基础上，新增按官方原文逐字镜像的全文页 /regulation/full，以及一个汇总官方规则改动的「更新动态」页。',
      expand: '全文页覆盖 762 条规则、中英对照，按 CC BY 3.0 镜像；官方规则一变，自动开 PR 同步。',
    },
    en: {
      title: 'Regulation pages gain a verbatim official full-text mirror and a What\'s New view',
      body: 'On top of the illustrated WCA Regulations, a verbatim full-text mirror /regulation/full was added, along with a "What\'s New" page summarising changes to the official regulations.',
      expand: 'The full-text page covers 762 clauses bilingually under CC BY 3.0; when the official regulations change, a sync PR opens automatically.',
    }
},
  {
    date: '2026-06-20',
    tag: 'feature',
    zh: {
      title: '非 WCA 异形魔方求解器批量上线',
      body: '一批非 WCA 异形魔方接入了求解器和打乱难度分布：地板、二三阶塔、八数码 / 15 数码、UFO、魔表、钻石、齿轮、立方体魔方（3x3x4 到 3x3x7）、Square-2 等。能整解到最优就给最优，否则给近最优。',
      expand: '全部纯 TypeScript：小状态空间用整图 BFS、中等用单实例 IDA*、大的用离线预算表。同期还上线了纯 TS 的三阶 STM（含中层转）整解引擎。',
    },
    en: {
      title: 'A fleet of non-WCA puzzle solvers launches',
      body: 'A batch of non-WCA puzzles gained solvers and scramble-difficulty distributions: Floppy, 2x2x3 tower, 8- and 15-puzzle, UFO, Cmetrick, Diamond, Gear, the cuboids (3x3x4 through 3x3x7), Square-2, and more. Where a puzzle can be solved optimally it is; otherwise it is near-optimal.',
      expand: 'All in pure TypeScript: full-graph BFS for small state spaces, single-instance IDA* for medium ones, offline budget tables for large ones. A pure-TS 3x3 STM (slice-turn) optimal engine landed in the same window.',
    }
},
  {
    date: '2026-06-22',
    tag: 'dx',
    zh: {
      title: '开发者板块 /dev 扩充：协议、API、数据库、约束守卫',
      body: '开发者板块新增多页：智能魔方蓝牙协议（GAN BLE + AES）、WebCodecs、后端 API 参考、数据库 schema，以及索引项目全部约束守卫的 /dev/guards 和死代码看板。',
      expand: '这些页带 CI 漂移检测，源码改了不同步就报红；约束守卫页把写入即拦的 hook 和 CI 棘轮统一列出来。',
    },
    en: {
      title: 'The /dev developer section expands: protocols, API, database, guardrails',
      body: 'The developer section added several pages: the smartcube Bluetooth protocol (GAN BLE + AES), WebCodecs, a backend API reference, the database schema, plus a /dev/guards page indexing every project guardrail and a dead-code dashboard.',
      expand: 'These pages carry CI drift detection — change the source without updating them and the build goes red; the guards page lists the write-time hooks and CI ratchets together.',
    }
},
  {
    date: '2026-06-22',
    tag: 'feature',
    zh: {
      title: 'WCA 统计入口拆成四张卡；排名加名字分布和筛选',
      body: '首页把原来单张「WCA 统计」入口拆成比赛、排名、纪录、统计四张直达卡。排名页加了选手名字的分布与 A-Z 名录、性别筛选、大洲筛选和各国柱状竞速。',
      expand: '原 /wca/historical 并入 /wca/results；名字分布可按词数或字符长度切换，点开能看各区间的国家构成。',
    },
    en: {
      title: 'The WCA hub splits into four entry cards; rankings gain name distribution and filters',
      body: 'The homepage split the single "WCA Stats" entry into four direct cards: competitions, rankings, records, and stats. The rankings page added a distribution of cuber names with an A-Z directory, gender and continent filters, and a per-country bar chart race.',
      expand: 'The former /wca/historical was merged into /wca/results; the name distribution toggles between word count and character length, and each bin opens to show its country breakdown.',
    }
},
  {
    date: '2026-06-16',
    tag: 'feature',
    zh: {
      title: 'Square-1 接入按 WCA 计步的整解最优求解器',
      body: 'Square-1 接入了按 WCA 计步（12c4）的整解最优求解器，把每条打乱算到最优步数；打乱难度页随之改用精确最优分布。选手主页同期加了纪录、锦标赛领奖台、杂项三个标签。',
      expand: '求解器用 IDA* 加两阶段查表，对最难的一批打乱（278 条）做并行搜索全部算出最优。',
    },
    en: {
      title: 'Square-1 gains a WCA-metric optimal solver',
      body: 'Square-1 gained an optimal solver under the WCA move metric (12c4), computing the optimal length for every scramble; the difficulty page switched to the exact-optimal distribution. Person pages added records, championship-podium, and misc tabs around the same time.',
      expand: 'The solver uses IDA* with two-phase lookup tables, solving even the hardest batch (278 scrambles) optimally via parallel search.',
    }
},
  {
    date: '2026-06-15',
    tag: 'feature',
    zh: {
      title: '矢量绘图编辑器 /paint 上线',
      body: '上线一个类 Illustrator 的矢量绘图编辑器，支持画布、图层、撤销快照，登录后可把作品存进云端图库。同期打乱页加了云端最优求解，免去下载大剪枝表。',
      expand: '编辑器自写，工具栏带键盘快捷键；云端求解走服务端常驻进程，带内存保护和排队。',
    },
    en: {
      title: 'A vector drawing editor /paint launches',
      body: 'An Illustrator-style vector drawing editor launched, with a canvas, layers, and undo snapshots, plus a cloud library for saved work once signed in. The scramble page also gained a cloud-side optimal solve, removing the need to download a large pruning table.',
      expand: 'The editor is hand-written with keyboard shortcuts; the cloud solve runs as a resident server process with memory protection and queueing.',
    }
},
  {
    date: '2026-06-14',
    tag: 'migration',
    zh: {
      title: '移除繁体中文（只留简体 + 英文）；退役 Vite / Capacitor 旧前端',
      body: '全站移除繁体中文，只服简体中文和英文；同时彻底删除已退役的 Vite 前端和 Capacitor 手机壳。',
      expand: '文案统一走翻译入口，并加写入即拦的守卫，禁止再手敲繁体或在组件里内联语言三元。',
    },
    en: {
      title: 'Traditional Chinese removed (Simplified + English only); the Vite / Capacitor frontend retired',
      body: 'Traditional Chinese was removed site-wide, leaving Simplified Chinese and English; the retired Vite frontend and Capacitor mobile shell were deleted at the same time.',
      expand: 'Text now goes through one translation entry point, with a write-time guard banning hand-typed Traditional characters and inline language ternaries in components.',
    }
},
  {
    date: '2026-06-12',
    tag: 'feature',
    zh: {
      title: '赞助墙 /support 和会员订阅 /membership 上线',
      body: '上线赞助墙 /support（展示赞助者、捐赠入口、后台增删改）和会员订阅 /membership。同期加了关注选手成绩变更的监控页。',
      expand: 'support 和 membership 的数据都进数据库、后台可编辑；成绩变更监控定时比对官方数据，并在选手页展示改动。',
    },
    en: {
      title: 'A sponsor wall /support and a membership subscription /membership launch',
      body: 'A sponsor wall /support (sponsor list, donation entry, admin CRUD) and a membership subscription /membership launched. A monitor page for watched cubers\' result changes was added around the same time.',
      expand: 'Both support and membership are database-backed and admin-editable; the result-change monitor periodically diffs the official data and surfaces changes on person pages.',
    }
},
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
    }
},
  {
    date: '2026-06-09',
    tag: 'feature',
    zh: {
      title: '名次和可拆分到各项目；计时器接入真实 WCA 打乱',
      body: '名次和现在能拆开看哪些项目是强项、哪些落后，并可自选项目实时计算总分。计时器新增「用真实 WCA 打乱」练习模式，完成后自动标记，他人可看到这条打乱被多少人做过。',
      expand: '求解器这两天又补了 EOLine、DR、桥式第一步、Petrus 等阶段。三阶多盲的非官方平均成绩也接入了全站排名。',
    },
    en: {
      title: 'Sum-of-Ranks gets breakdowns; the timer can use real WCA scrambles',
      body: 'Sum-of-Ranks can now be broken apart to show which events are your strengths and which drag you down, and you can pick events to total live. The timer added a "real WCA scrambles" practice mode that auto-marks your solves, so others can see how many people attempted each scramble.',
      expand: 'The solver also gained several more stages (EOLine, DR, the first Roux block, Petrus). The unofficial mean for 3×3 multi-blind was surfaced in the site\'s rankings too.',
    }
},
  {
    date: '2026-06-08',
    tag: 'migration',
    zh: {
      title: '英文网址去前缀、繁体中文全覆盖、桥式训练器上线',
      body: '英文网址去掉 /en 前缀 + 繁体中文全站补齐 + 当前标签 / 筛选 / 搜索写进网址(刷新和分享可还原)+ 比赛日历与 3D 地球合并成一页 + 桥式(Roux)训练器上线 + 名次和加「历史最高排名」。',
      expand: '繁体由简体自动转换生成、不再手敲。桥式训练器从开源项目完整移植，带 3D 渲染和中英双语。',
    },
    en: {
      title: 'Bare English URLs, full Traditional Chinese, Roux trainer',
      body: 'English URLs drop the /en prefix; Traditional Chinese is complete site-wide; the current tab / filter / search now lives in the URL, so refresh and sharing restore state; the competition calendar and 3D globe merged into one page; the Roux trainer launched; Sum-of-Ranks gained an all-time-best view.',
      expand: 'Traditional Chinese is auto-generated from Simplified rather than hand-typed. The Roux trainer is a full port of an open-source project, with 3D rendering and a bilingual UI.',
    }
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
    }
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
    }
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
    }
},
  {
    date: '2026-05-28',
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
    }
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
    }
},
  {
    date: '2026-05-27',
    tag: 'migration',
    zh: {
      title: '主域从单页应用切换到 Next.js（Phase 4）',
      body: '主域 cuberoot.me 换了底层框架：从单页应用整体切到 Next.js，两条线路（自有服务器 + Vercel）跑同一份代码。旧站同期下线，全程零中断。',
      expand: '后端不变，只换前端框架。同一份代码自动部署到两处。',
    },
    en: {
      title: 'Main domain switched from SPA to Next.js (Phase 4)',
      body: 'The main domain cuberoot.me changed its underlying framework: it cut over from a single-page app to Next.js, with two lines (self-hosted server + Vercel) running the same code. The old site was retired at the same time, with zero downtime.',
      expand: 'The backend was unchanged — only the frontend framework. One codebase auto-deploys to both places.',
    }
},
  {
    date: '2026-05-14',
    tag: 'feature',
    zh: {
      title: '虚拟魔方、比赛实时直播、深浅色切换、博客子域、克星查询搬上服务器',
      body: '虚拟魔方 Playground(自由转动、回放、练公式、录制)+ 比赛实时直播页 + 全站深色 / 浅色 / 跟随系统主题切换 + 博客独立成子域 + 克星查询改到服务器端计算。',
      expand: '虚拟魔方移植自开源项目 cuber，用 three.js 渲染真立体魔方，配标准配色和键盘 / 触屏操作。',
    },
    en: {
      title: 'Virtual cube, live results, light/dark themes, blog subdomain, nemesis goes server-side',
      body: 'A virtual cube Playground (turn freely, replay, drill algorithms, record); a live competition results page; site-wide dark / light / follow-system themes; the blog split into its own subdomain; the nemesis lookup moved to server-side computation.',
      expand: 'The virtual cube is ported from the open-source cuber, rendering a true 3D cube with three.js, with standard colors and keyboard / touch controls.',
    }
},
  {
    date: '2026-05-15',
    tag: 'feature',
    zh: {
      title: '比赛实时直播、深度预测长文、虚拟魔方覆盖全项目、手机 App',
      body: '比赛页接入官方实时直播和赛前心理表 + 一篇约 30 万字的三阶深度预测 + 虚拟魔方扩展到所有 WCA 项目 + 套壳成 iOS / Android App + 全站搜索、百科、群论入门。',
      expand: '全站搜索覆盖比赛 / 选手 / 公式 / 文章 / 工具等十一类，用自带索引、不依赖外部服务。',
    },
    en: {
      title: 'Live results, a deep prediction essay, all puzzle types, mobile app',
      body: 'The competition page gained official live results and a psych sheet; a ~300,000-word deep 3×3 prediction; the virtual cube expanded to every WCA event; wrapped into iOS / Android apps; site-wide search, an encyclopedia, a group-theory intro.',
      expand: 'Site-wide search covers eleven categories (comps / cubers / algorithms / articles / tools / etc.) using a built-in index with no external dependency.',
    }
},
  {
    date: '2026-05-12',
    tag: 'dx',
    zh: {
      title: '手机、电脑、外网三端同时热重载；架构页从纯文字改成图文',
      body: '电脑、同 WiFi 手机、外网手机三端都能实时看到代码改动（热重载）。这个架构介绍页也在同一天从纯文字改成图文长版。',
      expand: '三端走不同反向代理但共用一份开发服务，概览页「开发环境」一节有说明。',
    },
    en: {
      title: 'Hot-reload on phone, desktop, and remote at once; architecture page goes illustrated',
      body: 'Desktop, a same-WiFi phone, and a phone on cellular all get live code-change reloading. This architecture page was also rewritten the same day from plain prose into an illustrated long-form.',
      expand: 'The three entries use different reverse proxies but share one dev server; Section 9 of this page has the full derivation.',
    }
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
    }
},
  {
    date: '2026-05-08',
    tag: 'feature',
    zh: {
      title: '记忆训练、打乱工具、7 张历史统计页、公式识别路由上线',
      body: '记忆训练中心 + 配色记忆训练 + 打乱工具中心 + 网页版求解器 + 七张历史统计页(大满贯 / 全部 / 当年 / 届别 / 成功率 / 全达成 / 名次和)+ 通用公式识别路由 + 编程入门站再加三种语言。',
      expand: '七张统计页背后是六张新数据库表，初次灌入五百多万行。',
    },
    en: {
      title: 'Memory training, scramble tools, 7 history-stat pages, recognition route',
      body: 'A memory-training hub + color-memory drill; a scramble-tools hub + browser solver; seven history-stat pages (grand slam / all / current year / by edition / success rate / all events done / sum of ranks); a generic algorithm-recognition route; three more languages in the programming hub.',
      expand: 'The seven stat pages are backed by six new database tables, with an initial load of over five million rows.',
    }
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
    }
},
  {
    date: '2026-05-06',
    tag: 'migration',
    zh: {
      title: '数据库迁 PostgreSQL、公式进库、卸掉 WordPress 同日完成',
      body: '数据库从 MariaDB 迁到 PostgreSQL + 41 套公式从文件搬进数据库 + 卸掉 WordPress 和面板。服务器从此只剩 nginx、Node 和 PostgreSQL。',
      expand: '换库后公式可以直接在网页编辑，不用改代码重新部署。',
    },
    en: {
      title: 'Database moved to PostgreSQL, algorithms into the DB, WordPress dropped — same day',
      body: 'The database moved from MariaDB to PostgreSQL; all 41 algorithm sets moved from files into the database; WordPress and the control panel were removed. The server now runs only nginx, Node, and PostgreSQL.',
      expand: 'After the switch, algorithms can be edited right in the browser — no code change and redeploy needed.',
    }
},
  {
    date: '2026-05-03',
    tag: 'feature',
    zh: {
      title: '魔方图片编辑器、图样库、平均成绩等工具页上线；魔方状态图改为服务器渲染',
      body: '同日上线魔方状态图编辑器、花式图样库，以及平均成绩、打乱生成、今日等工具页。魔方状态图也改成由服务器统一渲染。',
      expand: '状态图改服务器渲染后，浏览器不用再现场计算贴片位置，统一生成并缓存。异形魔方也接入了统一的图片生成库。',
    },
    en: {
      title: 'Cube-image editor, patterns library, average and more tool pages; cube state images move to server rendering',
      body: 'Launched the same day: a cube-state image editor, a fancy-patterns library, plus average, scramble-generator, and "today" tool pages. Cube state images also switched to unified server-side rendering.',
      expand: 'With server-side rendering, browsers no longer compute sticker positions live — everything is generated and cached. The odd-shaped puzzles were wired into the unified image library too.',
    }
},
  {
    date: '2026-04-30',
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
    }
},
  {
    date: '2026-04-26',
    tag: 'feature',
    zh: {
      title: '速拧计时器重写上线（TypeScript），次日补齐盲拧 / 蓝牙 / 3D',
      body: '4-26 把计时器用 TypeScript 从零重写（打乱生成、2D 预览、直方图、跟 csTimer 互导、覆盖所有项目）。4-27 补上盲拧、分阶段计时、智能魔方蓝牙、3D 预览、观察时间、分享链接、手机适配。',
      expand: '支持五种主流智能魔方的蓝牙连接。csTimer 嵌入仍保留。',
    },
    en: {
      title: 'The speedsolving timer relaunches (TS rewrite); blindfold / Bluetooth / 3D added next day',
      body: '4-26: the timer was rewritten from scratch in TypeScript (scramble generation, 2D preview, histogram, csTimer import/export, all events). 4-27 added blindfold, stage timing, smartcube Bluetooth, 3D preview, inspection, share links, and mobile adaptation.',
      expand: 'It supports Bluetooth for five mainstream smartcubes. The csTimer embed is still kept.',
    }
},
  {
    date: '2026-04-24',
    tag: 'feature',
    zh: {
      title: '克星查询、马赛克生成器、WCA 选手主页上线',
      body: '4-24 上线站点导航、魔方马赛克生成器、克星查询初版。4-25 克星查询完工，加上 WCA 选手主页查询和全球非官方纪录排名。',
      expand: '「克星」= 在某个项目、某片地区里，名次紧追你、还没超过你的那个人。选手主页查询带 28 万选手本地索引，20 毫秒出结果。',
    },
    en: {
      title: 'Nemesis lookup, mosaic generator, WCA person pages',
      body: '4-24 launched site navigation, a cube-mosaic generator, and a first cut of the nemesis lookup. 4-25 completed the nemesis lookup and added WCA person-profile lookup and world unofficial-record rankings.',
      expand: 'The "nemesis" is the cuber ranked just behind you in an event and region who hasn\'t passed you yet. The profile lookup uses a 280k-cuber local index returning results in under 20 ms.',
    }
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
    }
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
    }
},
  {
    date: '2026-04-16',
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
    }
},
  {
    date: '2026-04-06',
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
    }
},
  {
    date: '2026-04-20',
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
    }
},
  {
    date: '2026-03-24',
    tag: 'migration',
    zh: {
      title: '后端 API 框架一天内从 Fastify 换成 Hono',
      body: '接入 Fastify 当天即整体改用 Hono，22 个接口全部迁移过去。',
      expand: '那半个月后端调整频繁：先从云数据库迁到自建（3-04），再接入 Fastify（3-23），隔天改用 Hono（3-24）。',
    },
    en: {
      title: 'The backend API framework went from Fastify to Hono in a day',
      body: 'Fastify was wired up and replaced wholesale by Hono the same day, with all 22 endpoints migrated.',
      expand: 'The backend changed often that fortnight: from the cloud database to self-hosted (3-04), then Fastify (3-23), then Hono the next day (3-24).',
    }
},
  {
    date: '2026-03-23',
    tag: 'migration',
    zh: {
      title: 'jQuery 工具整体迁到 React + TypeScript monorepo',
      body: '把一批 jQuery / 静态 HTML 的小工具整体迁到 React 19 + Vite + pnpm/Turbo 的 monorepo，同一天接入了魔方动画库 cubing.js。',
      expand: '前端一开始迁了 12 个工具页，后续半年涨到 24 个以上。接入 cubing.js 后所有动画统一交给它播放，不再手写魔方 SVG。这是项目结构变动最大的一次。',
    },
    en: {
      title: 'jQuery tools migrated wholesale to a React + TypeScript monorepo',
      body: 'A set of jQuery / static-HTML tools migrated wholesale onto a React 19 + Vite + pnpm/Turbo monorepo, and the cube-animation library cubing.js was adopted the same day.',
      expand: 'The frontend started with 12 tool pages and grew past 24 over six months. Once cubing.js landed, all animations went through it and hand-written cube SVG was retired — the largest structural change in the project.',
    }
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
    }
},
  {
    date: '2026-03-12',
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
},
] satisfies TLEntry[]).sort((a, b) => b.date.localeCompare(a.date));
