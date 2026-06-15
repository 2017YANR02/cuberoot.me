import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c, t } from '../_lib/stack_tool_types';

// ─── Next.js 16 ─────────────────────────────────────────────────────────────

export const NEXT_JS: StackTool = {
  slug: 'next-js',
  name: 'Next.js',
  version: '16.2.6',
  since: '2016-10',
  group: 'frontend',
  accent: '#0070F3',
  bright: '#3B9EFF',
  glyph: '▲',
  floats: ['App Router', 'RSC', 'use client', 'use cache', 'Server Action', 'SSG', 'SSR', 'ISR', 'PPR', 'Turbopack', 'route.ts', 'layout'],
  zh: {
    tagline: 'React 之上的全栈框架',
    role: '本站现在整个跑在它上面。Phase 4 (2026-05) 把 SPA 切成 Next 16 App Router, ~128 个页面 SSG。',
    heroSub: <>React 只管 "组件怎么渲染", 路由、数据获取、打包、缓存、服务端渲染全留给你自己拼。Next.js 把这一整圈补齐成一个有约定的框架: 文件即路由、组件默认在服务端跑、<code>fetch</code> 自带缓存、一条命令出生产构建。2016 年它只是 "给 React 加个 SSR", 十年后已经是 React 官方文档首推的上手方式。</>,
    whatDesc: <>Next.js 是 Vercel (前身 ZEIT) 做的 React 全栈框架。它不替换 React, 而是<strong>把 React 缺的那半张图补全</strong>: 路由、服务端渲染、数据层、打包器、缓存策略、部署适配器。13 版起的 App Router 把 React Server Components 变成默认, 组件默认在服务端渲染、零 JS 下发, 需要交互的才标 <code>'use client'</code>。</>,
    historyDesc: <>从 2016 年 "给 React 加个 getInitialProps 做 SSR" 的小框架, 到 2025 年 Next 16 把 Turbopack 设成默认打包器、Cache Components 重写缓存模型, 十年。中间换过两次范式 (pages → app、Babel → SWC/Turbopack), 每次都踩着 React 团队的 RSC / Server Actions / Compiler 节奏走。</>,
    conceptsTitle: 'App Router 的几个原子',
    conceptsDesc: <>13 版后的 Next 几乎就是 "React Server Components 的官方运行时"。一组文件约定 (<code>page</code> / <code>layout</code> / <code>route</code>) + 两个指令 (<code>'use client'</code> / <code>'use cache'</code>) + 几种渲染时机, 剩下都是组合。</>,
    whyDesc: <>2026 年要做一个既要 SEO、又要交互、还要后端的站, Next.js 是阻力最小的那条: 一个仓库出前端 + 服务端 + 边缘函数, React 团队的新特性 (RSC / Compiler / Activity) 在这里第一时间能用。代价是 App Router 的心智模型不轻。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>OpenAI、Notion、TikTok、Twitch、Nike、Hulu 的网页端都跑 Next。Vercel 官方 showcase 里大半财富 500 的前端在它上面, React 官方文档把 "新项目" 默认指向 Next。</>,
    cuberootDesc: <>2026-05 的 Phase 4 把整站从 Vite SPA 切成 Next 16 App Router, client 现在是主工作区。同一份代码双线部署: 自有服务器的 systemd standalone + Vercel。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>Next 16 是 "Turbopack 默认 + 显式缓存" 这条路线的第一个 GA 节点。接下来 Cache Components 稳定化、Turbopack 文件系统缓存转正、React Compiler 默认开是 2026 的主线。</>,
  },
  en: {
    tagline: 'The full-stack framework on top of React',
    role: 'The whole site now runs on it. Phase 4 (2026-05) cut the SPA over to Next 16 App Router, ~128 pages prerendered.',
    heroSub: <>React only answers "how a component renders" — routing, data fetching, bundling, caching, server rendering are left for you to stitch. Next.js closes that whole loop into an opinionated framework: files are routes, components run on the server by default, <code>fetch</code> caches itself, one command produces a production build. In 2016 it was just "SSR for React"; a decade later it is the on-ramp React's own docs recommend.</>,
    whatDesc: <>Next.js is Vercel's (formerly ZEIT) full-stack React framework. It doesn't replace React — it <strong>fills in the half of the picture React leaves out</strong>: routing, server rendering, a data layer, the bundler, caching strategy, deploy adapters. Since v13 the App Router makes React Server Components the default: components render on the server and ship zero JS unless you mark them <code>'use client'</code>.</>,
    historyDesc: <>From a 2016 framework that just "added getInitialProps SSR to React" to Next 16 in 2025 making Turbopack the default bundler and rewriting caching as Cache Components — a decade. Two paradigm shifts along the way (pages → app, Babel → SWC/Turbopack), each riding React's RSC / Server Actions / Compiler cadence.</>,
    conceptsTitle: 'A few App Router atoms',
    conceptsDesc: <>Post-v13 Next is essentially "the official runtime for React Server Components". A set of file conventions (<code>page</code> / <code>layout</code> / <code>route</code>), two directives (<code>'use client'</code> / <code>'use cache'</code>), and a handful of render timings — everything else is composition.</>,
    whyDesc: <>To ship a site in 2026 that needs SEO, interactivity, and a backend at once, Next.js is the path of least resistance: one repo emits the frontend, the server, and edge functions, and React's newest features (RSC / Compiler / Activity) land here first. The cost is a non-trivial App Router mental model.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>OpenAI, Notion, TikTok, Twitch, Nike, and Hulu run their web frontends on Next. Vercel's showcase covers a large slice of Fortune-500 frontends, and React's docs point "new project" at Next by default.</>,
    cuberootDesc: <>Phase 4 (2026-05) cut the whole site from a Vite SPA to Next 16 App Router; client is now the primary workspace. The same code deploys two ways: a systemd standalone server on the VM, and Vercel.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Next 16 is the first GA waypoint on the "Turbopack default + explicit caching" path. Stabilizing Cache Components, promoting Turbopack filesystem caching, and turning the React Compiler on by default are the 2026 storyline.</>,
  },
  heroStats: [
    { num: '16', unit: '.2.6', zh: <>当前稳定版 <em>2026-05</em></>, en: <>current stable <em>2026-05</em></>
    },
    { num: '128', unit: '+', zh: <>本站 SSG 静态页 <em>切 CDN</em></>, en: <>prerendered pages on this site <em>CDN-served</em></>
    },
    { num: '10', unit: '×', zh: <>Fast Refresh 提速 (Turbopack) <em>官方数据</em></>, en: <>faster Fast Refresh via Turbopack <em>official</em></>
    },
    { num: '10', unit: 'y', zh: <>从 2016 至今 <em>React 首推框架</em></>, en: <>since 2016 <em>React's recommended start</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>2016 年 10 月 25 日, Guillermo Rauch 的公司 ZEIT 发布 Next.js 1.0。当时 React 生态做服务端渲染要手搓一堆: webpack 配置、react-router、数据预取、同构样板。Next 的卖点朴素到一句话: 把 <code>pages/</code> 目录里的文件当路由, 服务端先把 React 渲成 HTML 发出去, 客户端再 hydrate。零配置开箱即用。</p>
        <p>2022 年 10 月 Next 13 抛出 App Router (beta): <code>app/</code> 目录、React Server Components、嵌套 layout、Server Actions。这是 Next 第二次范式切换 —— 组件默认在服务端跑、默认不下发 JS, 需要交互才标 <code>'use client'</code>。2023 年 5 月 13.4 把 App Router 转正, 整个生态花了一年多才适应这套新心智。</p>
        <p>2025 年 10 月 21 日 Next 16 GA: Turbopack (Rust 写的打包器) 成为默认, dev Fast Refresh 快 10 倍、生产构建快 2-5 倍; Cache Components 用 <code>"use cache"</code> 指令把缓存从 "隐式默认" 改成 "显式 opt-in"; React Compiler 集成转稳定; <code>middleware.ts</code> 改名 <code>proxy.ts</code>; <code>next lint</code> 命令被删, 改直接调 ESLint。这是 Next 把过去几年实验特性一次收口的版本。</p>
      </>
    ),
    en: (
      <>
        <p>On 2016-10-25, Guillermo Rauch's company ZEIT released Next.js 1.0. Server rendering in the React ecosystem then meant hand-wiring a pile of things: webpack config, react-router, data prefetching, isomorphic boilerplate. Next's pitch was one sentence: treat files in <code>pages/</code> as routes, render React to HTML on the server, hydrate on the client. Zero config, batteries included.</p>
        <p>October 2022's Next 13 threw down the App Router (beta): the <code>app/</code> directory, React Server Components, nested layouts, Server Actions. That was Next's second paradigm shift — components run on the server and ship no JS by default; you opt into interactivity with <code>'use client'</code>. 13.4 (May 2023) made the App Router stable, and the ecosystem took over a year to internalize the new model.</p>
        <p>On 2025-10-21 Next 16 went GA: Turbopack (the Rust bundler) became the default, with 10× faster Fast Refresh and 2-5× faster production builds; Cache Components flipped caching from "implicit default" to explicit opt-in via the <code>"use cache"</code> directive; React Compiler integration went stable; <code>middleware.ts</code> was renamed <code>proxy.ts</code>; and the <code>next lint</code> command was removed in favor of calling ESLint directly. It's the release where Next reels in years of experiments at once.</p>
      </>
    ),
  },
  history: [
    { year: '2016·10', zh: { title: <>1.0 首发</>, desc: <>10 月 25 日 ZEIT 发布 Next.js。<code>pages/</code> 文件即路由 + 服务端渲染 + <code>getInitialProps</code> 数据预取, 零配置。"给 React 加个 SSR" 的最小框架。</> }, en: { title: <>1.0 ships</>, desc: <>October 25: ZEIT releases Next.js. <code>pages/</code> files as routes + server rendering + <code>getInitialProps</code> data fetching, zero config. The minimal "SSR for React" framework.</> } },
    { year: '2019·07', zh: { title: <>9 — API Routes</>, desc: <>动态路由段、API Routes、自动静态优化。9.3 (2020-03) 补上 <code>getStaticProps</code> / <code>getServerSideProps</code>, 数据获取模型定型, 这是 pages 时代的巅峰。</> }, en: { title: <>9 — API Routes</>, desc: <>Dynamic route segments, API Routes, automatic static optimization. 9.3 (2020-03) added <code>getStaticProps</code> / <code>getServerSideProps</code> — the data-fetching model crystallized. The peak of the pages era.</> } },
    { year: '2020·04', zh: { title: <>ZEIT 改名 Vercel</>, desc: <>公司更名 Vercel, Next.js 成为旗舰产品与商业模型的核心。框架与托管平台从此一体化演进。</> }, en: { title: <>ZEIT becomes Vercel</>, desc: <>The company renames to Vercel; Next.js becomes the flagship and the core of its business model. Framework and hosting platform evolve as one from here on.</> } },
    { year: '2021·10', zh: { title: <>12 — SWC 取代 Babel</>, desc: <>用 Rust 写的 SWC 替掉 Babel + Terser, 编译快 ~5 倍; Middleware (beta) 首次引入边缘逻辑。Next 第一次把 Rust 工具链塞进核心。</> }, en: { title: <>12 — SWC over Babel</>, desc: <>Rust-written SWC replaces Babel + Terser, ~5× faster compilation; Middleware (beta) introduces edge logic. The first time Next puts a Rust toolchain at its core.</> } },
    { year: '2022·10', zh: { title: <>13 — App Router (beta)</>, desc: <><code>app/</code> 目录、React Server Components、嵌套 layout、Turbopack alpha、新版 <code>next/image</code> 与 <code>next/font</code>。Next 第二次范式切换的起点。</> }, en: { title: <>13 — App Router (beta)</>, desc: <>The <code>app/</code> directory, React Server Components, nested layouts, Turbopack alpha, redesigned <code>next/image</code> and <code>next/font</code>. The start of Next's second paradigm shift.</> } },
    { year: '2023·10', zh: { title: <>14 — Server Actions 稳定</>, desc: <>Server Actions 转正, 表单变更不必再写 API 路由; Partial Prerendering (PPR) 预览。App Router 从 "能用" 走向 "该用"。</> }, en: { title: <>14 — Server Actions stable</>, desc: <>Server Actions go stable — form mutations no longer need API routes; Partial Prerendering (PPR) lands in preview. The App Router moves from "usable" to "the default".</> } },
    { year: '2024·10', zh: { title: <>15 — React 19 + 异步请求 API</>, desc: <>支持 React 19; <code>cookies()</code> / <code>headers()</code> / <code>params</code> 改成异步; 缓存语义翻转 —— 不再默认缓存。最低 Node 18。</> }, en: { title: <>15 — React 19 + async request APIs</>, desc: <>React 19 support; <code>cookies()</code> / <code>headers()</code> / <code>params</code> become async; caching semantics flip — no longer cached by default. Node 18 minimum.</> } },
    { year: '2025·10', highlight: true, zh: { title: <>16 — Turbopack 默认 + Cache Components</>, desc: <>10 月 21 日 GA。Turbopack 成默认打包器 (Fast Refresh 快 10 倍); Cache Components 用 <code>"use cache"</code> 把缓存改成显式 opt-in; React Compiler 稳定; <code>middleware.ts</code> → <code>proxy.ts</code>; 删 <code>next lint</code>; 最低 Node 20.9。</> }, en: { title: <>16 — Turbopack default + Cache Components</>, desc: <>October 21 GA. Turbopack becomes the default bundler (10× faster Fast Refresh); Cache Components make caching explicit opt-in via <code>"use cache"</code>; React Compiler goes stable; <code>middleware.ts</code> → <code>proxy.ts</code>; <code>next lint</code> removed; Node 20.9 minimum.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>16.2.6 / 当前稳定</>, desc: <>2026-05 最新点 release。npm 周下载约 900 万 (next 包), React 官方文档把 "新项目" 默认指向它。</> }, en: { title: <>16.2.6 / current stable</>, desc: <>Latest patch as of 2026-05. ~9M weekly downloads for the next package; React's own docs point "new project" at it by default.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>文件即路由 (app/)</>, desc: <>文件夹 = 路由段, 约定文件名定行为: <code>page.tsx</code> 出页面, <code>layout.tsx</code> 包裹子树, <code>route.ts</code> 出 API, <code>loading.tsx</code> 兜加载态。</> }, en: { title: <>Files as routes (app/)</>, desc: <>Folders = route segments; reserved filenames define behavior: <code>page.tsx</code> renders a page, <code>layout.tsx</code> wraps the subtree, <code>route.ts</code> is an API, <code>loading.tsx</code> covers the loading state.</> }, code: <code>{c('// app/[lang]/code/stack/[slug]/page.tsx')}{'\n'}{c('// -> /zh/code/stack/next-js')}{'\n'}app/{'\n'}  layout.tsx   {c('// 包裹整站')}{'\n'}  page.tsx     {c('// /')}{'\n'}  blog/{'\n'}    page.tsx   {c('// /blog')}</code> },
    { tag: 'B', zh: { title: <>Server Component 默认</>, desc: <>App Router 里组件默认在服务端渲染, 下发的是 HTML 不是 JS。要 state / effect / 事件才在文件顶写 <code>'use client'</code> 切到客户端。</> }, en: { title: <>Server Components by default</>, desc: <>In the App Router components render on the server by default — the client receives HTML, not JS. Add <code>'use client'</code> at the top of a file to opt into state / effects / events.</> }, code: <code>{c('// 默认 = Server Component, 0 KB JS')}{'\n'}{k('export')} {k('default')} {k('async')} {k('function')} {f('Page')}() {'{'}{'\n'}  {k('const')} {v('data')} = {k('await')} {f('fetch')}(...);{'\n'}  {k('return')} &lt;{t('Article')} {p('data')}={'{'}{v('data')}{'}'} /&gt;;{'\n'}{'}'}</code> },
    { tag: 'C', zh: { title: <>Server Actions</>, desc: <>标 <code>'use server'</code> 的函数, 客户端能直接调, 在服务端执行。表单变更、写数据库不必再开一条 API 路由。</> }, en: { title: <>Server Actions</>, desc: <>Functions marked <code>'use server'</code> are callable from the client but execute on the server. Form mutations and DB writes no longer need a separate API route.</> }, code: <code>{s("'use server'")};{'\n'}{k('export')} {k('async')} {k('function')} {f('save')}({v('form')}: {t('FormData')}) {'{'}{'\n'}  {k('await')} {v('db')}.{f('insert')}({v('form')});{'\n'}{'}'}</code> },
    { tag: 'D', zh: { title: <>四种渲染时机</>, desc: <>SSG (构建时) / SSR (请求时) / ISR (定时再生) / PPR (静态壳 + 动态洞)。同一份代码按数据需求自动选, 不用换框架。</> }, en: { title: <>Four render timings</>, desc: <>SSG (build time) / SSR (per request) / ISR (timed regeneration) / PPR (static shell + dynamic holes). The same code picks based on data needs — no framework swap.</> }, code: <code>{c('// 默认静态; 用了 await cookies() 就转动态')}{'\n'}{k('export')} {k('const')} {v('revalidate')} = {n('3600')}; {c('// ISR: 1h')}</code> },
    { tag: 'E', zh: { title: <>Cache Components ("use cache")</>, desc: <>16 版的新缓存模型。<code>"use cache"</code> 指令标在页面 / 组件 / 函数上, 编译器自动生成缓存键; <code>cacheLife</code> / <code>cacheTag</code> 控制时效与失效。</> }, en: { title: <>Cache Components ("use cache")</>, desc: <>The v16 caching model. The <code>"use cache"</code> directive marks a page / component / function and the compiler generates the cache key; <code>cacheLife</code> / <code>cacheTag</code> control lifetime and invalidation.</> }, code: <code>{k('async')} {k('function')} {f('getPosts')}() {'{'}{'\n'}  {s('"use cache"')};{'\n'}  {f('cacheTag')}({s('"posts"')});{'\n'}  {k('return')} {k('await')} {v('db')}.{f('posts')}();{'\n'}{'}'}</code> },
    { tag: 'F', zh: { title: <>Turbopack</>, desc: <>Rust 写的打包器, 16 版起 dev + build 都默认走它, 取代 webpack。Fast Refresh 快 10 倍, 生产构建快 2-5 倍。<code>next build --webpack</code> 可退回。</> }, en: { title: <>Turbopack</>, desc: <>The Rust bundler, default for dev and build since v16, replacing webpack. 10× faster Fast Refresh, 2-5× faster production builds. <code>next build --webpack</code> opts back out.</> }, code: <code>{c('// 16 版终端默认前缀:')}{'\n'}{c('//   ▲ Next.js 16 (Turbopack)')}{'\n'}{c('//   ✓ Compiled in 615ms')}</code> },
    { tag: 'G', zh: { title: <>异步数据 + 自动去重</>, desc: <>Server Component 直接 <code>async/await fetch</code>, 同一次渲染里相同请求自动去重、自动缓存。不再需要 <code>useEffect</code> + loading state 的客户端取数样板。</> }, en: { title: <>Async data + auto dedup</>, desc: <>Server Components <code>async/await fetch</code> directly; identical requests within one render are auto-deduped and cached. No more <code>useEffect</code> + loading-state client fetch boilerplate.</> }, code: <code>{k('const')} {v('a')} = {k('await')} {f('fetch')}({s('"/api/x"')});{'\n'}{k('const')} {v('b')} = {k('await')} {f('fetch')}({s('"/api/x"')}); {c('// 同一请求, 只打一次')}</code> },
    { tag: 'H', zh: { title: <>嵌套 layout</>, desc: <>每段路由可有自己的 <code>layout.tsx</code>, 跨导航持续挂载、不重渲染。配合 prefetch + 局部渲染, 页面切换只换变化的那块。</> }, en: { title: <>Nested layouts</>, desc: <>Each route segment can own a <code>layout.tsx</code> that stays mounted across navigation without re-rendering. With prefetch + partial rendering, a page change only swaps the part that differs.</> }, code: <code>{c('// app/[lang]/layout.tsx 包住所有 /zh/* 与 /en/*')}{'\n'}{c('// 切页时 layout 不卸载, 语言/主题状态保留')}</code> },
  ],
  whyCards: [
    { icon: '⬡', zh: { title: <>一个框架做全栈</>, desc: <>前端组件 + 服务端 route.ts + Server Actions + 边缘逻辑同仓库。不用再分前后端两个 repo 两套部署。</> }, en: { title: <>Full-stack in one framework</>, desc: <>Frontend components, server route.ts, Server Actions, and edge logic in one repo. No more split front/back repos and two deploy pipelines.</> }, code: <>{c('// app/api/x/route.ts  ← backend')}{'\n'}{c('// app/page.tsx        ← frontend')}</> },
    { icon: '◳', zh: { title: <>RSC = 更少客户端 JS</>, desc: <>服务端组件下发 HTML 不下发 JS。大段静态内容、第三方重库 (markdown 渲染、语法高亮) 留在服务端, 首屏 bundle 显著变小。</> }, en: { title: <>RSC = less client JS</>, desc: <>Server components ship HTML, not JS. Large static content and heavy third-party libs (markdown rendering, syntax highlighting) stay on the server, shrinking the first-paint bundle.</> }, code: <>{c('// 重库只在 server 跑, 不进 client bundle')}</> },
    { icon: '⌖', zh: { title: <>SEO / SSR 开箱</>, desc: <>服务端先吐完整 HTML, 爬虫与首屏都拿到内容; <code>generateMetadata</code> 出动态 <code>&lt;title&gt;</code> / OG。本站 sitemap / canonical 都走它。</> }, en: { title: <>SEO / SSR out of the box</>, desc: <>The server emits full HTML so crawlers and first paint both get content; <code>generateMetadata</code> produces dynamic <code>&lt;title&gt;</code> / OG tags. This site's sitemap / canonical run through it.</> }, code: <>{k('export')} {k('function')} {f('generateMetadata')}() {'{'} ... {'}'}</> },
    { icon: '⚡', zh: { title: <>Turbopack 快</>, desc: <>Rust 打包器默认开, dev 改一行 Fast Refresh 快 10 倍, 生产构建快 2-5 倍。大项目 dev 还能开文件系统缓存跨重启复用。</> }, en: { title: <>Turbopack is fast</>, desc: <>The Rust bundler is on by default — 10× faster Fast Refresh on edit, 2-5× faster production builds. Large projects can enable filesystem caching that survives restarts.</> }, code: <>{c('// ▲ Next.js 16 (Turbopack)')}</> },
    { icon: '◐', zh: { title: <>内置优化件</>, desc: <><code>next/image</code> 自动响应式 + 懒加载 + 格式转换, <code>next/font</code> 自托管字体免 CLS, <code>next/script</code> 控加载时机。这些以前都要手搓。</> }, en: { title: <>Built-in optimizers</>, desc: <><code>next/image</code> does responsive + lazy + format conversion, <code>next/font</code> self-hosts fonts to kill CLS, <code>next/script</code> controls load timing. All of this used to be hand-rolled.</> }, code: <>{k('import')} {v('Image')} {k('from')} {s('"next/image"')};</> },
    { icon: '⎈', zh: { title: <>部署不绑死 Vercel</>, desc: <>Vercel 是一等公民, 但 <code>output: 'standalone'</code> 出自带 node_modules 的 server bundle, 任意 Node 主机能跑。本站正是 Vercel + 自有 systemd 双线。</> }, en: { title: <>Not locked to Vercel</>, desc: <>Vercel is first-class, but <code>output: 'standalone'</code> emits a self-contained server bundle (with node_modules) that runs on any Node host. This site runs both Vercel and a self-hosted systemd server.</> }, code: <>{p('output')}: {s("'standalone'")}</> },
    { icon: '⊕', zh: { title: <>跟着 React 团队走</>, desc: <>RSC、Server Actions、React Compiler、Activity 这些新原语, Next 是它们最早的生产级运行时。React canary 的特性在这里第一时间能落地。</> }, en: { title: <>Tracks the React team</>, desc: <>RSC, Server Actions, the React Compiler, Activity — Next is the earliest production runtime for each. React canary features land here first.</> }, code: <>{c('// App Router 跑 React canary')}</> },
    { icon: '◷', zh: { title: <>缓存现在是显式的</>, desc: <>15 版翻转了 "默认缓存", 16 版 Cache Components 让你用 <code>"use cache"</code> 精确标哪段缓存、活多久、按什么 tag 失效。比旧版隐式魔法可控得多。</> }, en: { title: <>Caching is explicit now</>, desc: <>v15 flipped "cached by default"; v16 Cache Components let you mark exactly what caches with <code>"use cache"</code>, for how long, and on which tag to invalidate. Far more predictable than the old implicit magic.</> }, code: <>{f('revalidateTag')}({s("'posts'")}, {s("'max'")});</> },
  ],
  adopters: [
    { name: 'OpenAI', href: 'https://openai.com', highlight: true, zhNote: 'ChatGPT 及官网前端跑 Next', enNote: 'ChatGPT and the marketing site run Next' },
    { name: 'Notion', href: 'https://notion.so', highlight: true, zhNote: '营销站与文档前端', enNote: 'Marketing and docs frontend' },
    { name: 'TikTok', href: 'https://tiktok.com', zhNote: 'Web 端在 Next 上', enNote: 'Web frontend on Next' },
    { name: 'Twitch', href: 'https://twitch.tv', zhNote: '部分页面用 Next 渲染', enNote: 'Parts of the site rendered with Next' },
    { name: 'Nike', href: 'https://nike.com', zhNote: 'Vercel showcase 长期案例', enNote: 'Long-standing Vercel showcase case' },
    { name: 'Hulu', href: 'https://hulu.com', zhNote: '流媒体前端', enNote: 'Streaming frontend' },
    { name: 'Vercel', href: 'https://vercel.com', highlight: true, zhNote: 'Next.js 的母公司, 自家全站', enNote: "Next.js's parent company — its own whole site" },
    { name: 'Washington Post', href: 'https://washingtonpost.com', zhNote: '部分内容线用 Next', enNote: 'Parts of its content runs Next' },
    { name: 'Audible', href: 'https://audible.com', zhNote: 'Amazon 旗下, Next 前端', enNote: 'Amazon-owned, Next frontend' },
    { name: 'Linear', href: 'https://linear.app', zhNote: '营销站 + 文档 Next', enNote: 'Marketing site + docs on Next' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 Phase 4 起整站 Next 16 App Router', enNote: 'This site — whole thing on Next 16 App Router since Phase 4' },
  ],
  outlook: [
    { tag: <>HOT · 2025-10</>, hot: true, big: true, zh: { title: <>Cache Components 重写缓存</>, body: <><p>Next 16 把缓存从 "App Router 隐式默认" 改成 <code>"use cache"</code> 显式 opt-in。默认所有动态代码请求时执行, 想缓存的才标指令, 编译器自动生成缓存键。</p><p>这补完了 2023 年起的 Partial Prerendering 故事: 静态壳 + 动态洞不再二选一。接下来一年 Cache Components 会从 "可用" 走向稳定默认。</p></> }, en: { title: <>Cache Components rewrite caching</>, body: <><p>Next 16 flips caching from the App Router's implicit default to explicit opt-in via <code>"use cache"</code>. All dynamic code runs at request time by default; you mark what to cache and the compiler generates the key.</p><p>This completes the Partial Prerendering story begun in 2023: static shell + dynamic holes is no longer either/or. Over the next year Cache Components move from "available" to the stable default.</p></> } },
    { tag: 'TURBOPACK', big: true, zh: { title: <>Turbopack 成默认</>, body: <><p>16 版起 dev + build 都默认走 Rust 写的 Turbopack, 取代 webpack。Fast Refresh 快 10 倍, 生产构建快 2-5 倍。文件系统缓存 (beta) 让大项目跨重启复用编译产物。webpack 仍可 <code>--webpack</code> 退回, 但默认线已经切。</p></> }, en: { title: <>Turbopack becomes default</>, body: <><p>Since v16 both dev and build default to the Rust-written Turbopack, replacing webpack. 10× faster Fast Refresh, 2-5× faster builds. Filesystem caching (beta) lets large projects reuse compiler artifacts across restarts. webpack is still reachable via <code>--webpack</code>, but the default line has moved.</p></> } },
    { tag: 'COMPILER', zh: { title: <>React Compiler 稳定</>, body: <><p>跟随 React Compiler 1.0, Next 16 把 <code>reactCompiler</code> 选项从 experimental 提到稳定。它自动 memo 组件、消除多余重渲染, 零手写 <code>useMemo</code> / <code>useCallback</code>。默认还没开 (依赖 Babel, 构建会变慢), 但开关已就位。</p></> }, en: { title: <>React Compiler stable</>, body: <><p>Following React Compiler 1.0, Next 16 promotes the <code>reactCompiler</code> option from experimental to stable. It auto-memoizes components and eliminates needless re-renders with zero hand-written <code>useMemo</code> / <code>useCallback</code>. Not on by default yet (it relies on Babel and slows builds), but the switch is in place.</p></> } },
    { tag: 'MCP', zh: { title: <>DevTools MCP</>, body: <><p>16 版引入 Next.js DevTools MCP: 把路由 / 缓存 / 渲染行为、浏览器 + 服务端日志、错误栈喂给 AI agent。让 Claude Code 这类 agent 能直接在开发流里诊断 Next 应用的问题。</p></> }, en: { title: <>DevTools MCP</>, body: <><p>v16 introduces Next.js DevTools MCP: it feeds routing / caching / rendering behavior, browser + server logs, and error traces to AI agents. Agents like Claude Code can diagnose Next app issues directly inside the dev loop.</p></> } },
    { tag: 'BOUNDARY', zh: { title: <>边界:复杂度</>, body: <><p>App Router 的心智模型不轻: server / client 组件边界、缓存语义、什么时候静态什么时候动态, 上手有坡度。纯静态内容站或纯客户端工具, 一个 Vite SPA 往往更直接 —— 这也是本站 2023~2026 一直用 Vite 的原因。</p></> }, en: { title: <>Boundary: complexity</>, body: <><p>The App Router mental model isn't light: the server/client component boundary, caching semantics, when something is static vs dynamic — there's a learning curve. For a purely static content site or a pure client-side tool, a Vite SPA is often more direct — which is exactly why this site stayed on Vite from 2023 to 2026.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>2026-05 的 Phase 4 把整站从 Vite SPA 迁到 Next 16 App Router。<code>packages/client</code> (React 19.2 + App Router + Turbopack) 现在是主工作区, 旧的 Vite <code>packages/client</code> 退役只作本地兜底。语言走 <code>app/[lang]/</code> 动态段, ~128 组页面默认 SSG 切 CDN —— 根 <code>layout.tsx</code> 刻意不碰 <code>cookies()</code> / <code>headers()</code>, 全局组件不在 render 里调 <code>useSearchParams</code>, 否则整站会退回动态。</p>
        <p>同一份代码<strong>双线部署</strong>: 自有服务器上 <code>output: 'standalone'</code> 出自带 node_modules 的 server bundle, systemd 跑 <code>cuberoot-next</code> 反代 :3002; 另一条线走 Vercel。<code>next.config.ts</code> 里 standalone 用 <code>isProd &amp;&amp; !isVercel</code> 门控 —— dev 开它会让 Turbopack 每次改动都扫整个 monorepo node_modules 把 CPU 打满, Vercel 开它又撞它自家 Turbopack 的 manifest 解析 (vercel/next.js#88579)。</p>
        <p>几处真实坑都写在 config 里: <code>rewrites</code> 把 dev 的 <code>/v1/*</code> 反代到 <code>api.cuberoot.me</code> (本地开发不必跑后端、躲开 CORS); <code>/callback.html</code> 内部 rewrite 到 <code>/auth/callback</code> 保住 WCA OAuth 的精确 redirect_uri; COOP/COEP 头只发给真用 SharedArrayBuffer 的 <code>/scramble/solver</code> (全站发会把跨域的 WCA 头像 <code>&lt;img&gt;</code> 拦死); <code>dns.setDefaultResultOrder('ipv4first')</code> 修上游代理偶发的 IPv6 <code>ENOTFOUND</code>。</p>
        <p>边角: <code>optimizePackageImports</code> 给 three / maplibre-gl / katex 做按符号 tree-shake; <code>transpilePackages</code> 收 mp4box; cubing.js 的 search worker 因为 Turbopack 不产 worker-runtime-独立 bundle, 单独走一个 <code>/cubing-chunks/[...slug]</code> route handler 用 esbuild 在请求时打包。几十条 <code>redirects</code> (308) 兜住旧 URL 改名, 包括 <code>/code/ts</code> → <code>/code/language/ts</code> 这一批。</p>
      </>
    ),
    en: (
      <>
        <p>Phase 4 (2026-05) migrated the whole site from a Vite SPA to Next 16 App Router. <code>packages/client</code> (React 19.2 + App Router + Turbopack) is now the primary workspace; the old Vite <code>packages/client</code> is retired to a local fallback. Language is an <code>app/[lang]/</code> dynamic segment, and ~128 pages are SSG'd to the CDN by default — the root <code>layout.tsx</code> deliberately avoids <code>cookies()</code> / <code>headers()</code>, and global components never call <code>useSearchParams</code> in render, or the whole site would fall back to dynamic.</p>
        <p>The same code <strong>deploys two ways</strong>: on the VM, <code>output: 'standalone'</code> emits a server bundle (bundling node_modules) that systemd runs as <code>cuberoot-next</code> behind :3002; the other line is Vercel. In <code>next.config.ts</code>, standalone is gated by <code>isProd &amp;&amp; !isVercel</code> — enabling it in dev makes Turbopack walk the entire monorepo node_modules on every change and pegs the CPU, and enabling it on Vercel collides with their own Turbopack manifest resolution (vercel/next.js#88579).</p>
        <p>A few real quirks live in the config: <code>rewrites</code> proxies dev <code>/v1/*</code> to <code>api.cuberoot.me</code> (no local backend needed, dodges CORS); <code>/callback.html</code> internally rewrites to <code>/auth/callback</code> to preserve WCA OAuth's exact redirect_uri; COOP/COEP headers are sent only to <code>/scramble/solver</code>, which actually uses SharedArrayBuffer (site-wide would block cross-origin WCA avatar <code>&lt;img&gt;</code>); and <code>dns.setDefaultResultOrder('ipv4first')</code> fixes intermittent IPv6 <code>ENOTFOUND</code> on the upstream proxy.</p>
        <p>Edge bits: <code>optimizePackageImports</code> per-symbol tree-shakes three / maplibre-gl / katex; <code>transpilePackages</code> picks up mp4box; cubing.js's search worker — since Turbopack doesn't emit worker-runtime-independent bundles — goes through a dedicated <code>/cubing-chunks/[...slug]</code> route handler that esbuild-bundles it at request time. Dozens of <code>redirects</code> (308) cover legacy URL renames, including the <code>/code/ts</code> → <code>/code/language/ts</code> batch.</p>
      </>
    ),
  },
  links: [
    { label: 'nextjs.org', href: 'https://nextjs.org' },
    { label: 'GitHub · vercel/next.js', href: 'https://github.com/vercel/next.js' },
    { label: 'Next.js 16 announcement', href: 'https://nextjs.org/blog/next-16' },
    { label: 'App Router docs', href: 'https://nextjs.org/docs/app' },
    { label: 'Learn Next.js', href: 'https://nextjs.org/learn' },
  ],
};

export default NEXT_JS;
