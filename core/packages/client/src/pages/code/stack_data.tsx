import type { ReactNode } from 'react';

export interface StackHistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

export interface StackFeature {
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

export interface StackTool {
  slug: string;
  name: string;
  version: string;
  since: string;
  group: 'frontend' | 'backend' | 'edge';
  accent: string;
  glyph: ReactNode;
  zh: {
    tagline: string;
    role: string;
    intro: ReactNode;
    why: ReactNode;
    cuberoot: ReactNode;
  };
  en: {
    tagline: string;
    role: string;
    intro: ReactNode;
    why: ReactNode;
    cuberoot: ReactNode;
  };
  history: StackHistoryItem[];
  features: StackFeature[];
  snippet?: { lang: string; code: ReactNode };
  links: { label: string; href: string }[];
}

const REACT: StackTool = {
  slug: 'react',
  name: 'React',
  version: '19.2',
  since: '2013-05',
  group: 'frontend',
  accent: '#61DAFB',
  glyph: '⚛',
  zh: {
    tagline: '组件 + 虚拟 DOM 三十年',
    role: '渲染整个 SPA。24 个工具页全部跑在它的组件树上,路由 / Suspense / 懒加载分包都靠它。',
    intro: (
      <>
        <p>
          React 是 Jordan Walke 在 Facebook 写的一个内部库:把界面拆成组件,组件返回"应该长什么样",React 自己算
          diff 然后批量改 DOM。这一招让前端从"手动操控 DOM"切换到"声明式描述 UI",此后整个生态(Vue / Svelte /
          SolidJS / Qwik)都是同一棵思想树的不同分支。
        </p>
        <p>
          2019 年的 Hooks 是它第二次范式跳跃:函数组件 + <code>useState</code> / <code>useEffect</code> 取代了
          class,逻辑复用从 HOC / render-prop 套娃变成扁平的 import。2024 年的 React 19 是第三次:
          <code>Server Components</code> / <code>Actions</code> / <code>use()</code> 把"客户端 JS + 服务端 API"
          这条边界重新画了一遍。
        </p>
      </>
    ),
    why: (
      <p>
        Vue 的 SFC 更紧凑,Svelte 编译产物更小,但 React 的生态深度无人能比 —— cubing.js、
        react-three-fiber、几乎每个图表库 / 组件库,首个支持的框架都是 React。对于 cuberoot.me 这种 24 个
        工具页、依赖大量小众魔方相关库的站点,生态深度直接决定能不能拼出来。代价是包体大、运行时偏胖,
        但 Vite 8 + 代码分割能把它压到可接受。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          整个 <code>@cuberoot/client</code> 包是一棵 React 19 树。<code>react-router-dom</code> 7
          管 24+ 路由,每个 page 用 <code>lazy()</code> 切独立 chunk,<code>&lt;Suspense&gt;</code>
          兜底。Recon / Trainer / FrameCount 等重型工具用 <code>useTransition</code>
          把昂贵的 state 更新放进低优先级,输入不卡。
        </p>
        <p>
          因为是纯 SPA 部署,RSC / Actions 暂时没启用 —— nginx 直接吐静态文件,React 在浏览器接手。这套
          组合对小团队来说生命周期足够长:首屏 {'<'} 200ms,后续切路由瞬间。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Components + virtual DOM, three decades in',
    role: 'Renders the whole SPA — 24 tool pages all live inside one React tree, routing / Suspense / lazy chunks all hang off it.',
    intro: (
      <>
        <p>
          React started as an internal Facebook library by Jordan Walke. The trick: split the UI into
          components, let each return what it <em>should</em> look like, and let React diff and batch
          DOM mutations. That pivot — from "manually poke the DOM" to "declarative UI" — set the
          template for every modern framework (Vue / Svelte / SolidJS / Qwik are all branches of the
          same idea tree).
        </p>
        <p>
          Hooks (2019) was its second paradigm jump: function components + <code>useState</code> /
          <code>useEffect</code> retired classes, and reusing logic stopped meaning HOC / render-prop
          pyramids. React 19 (2024) is the third: <code>Server Components</code>, <code>Actions</code>,
          and <code>use()</code> redraw the line between client JS and server APIs.
        </p>
      </>
    ),
    why: (
      <p>
        Vue's SFCs are tighter and Svelte's compiled output is smaller, but React's ecosystem depth is
        unmatched — cubing.js, react-three-fiber, almost every chart and component library ships
        React bindings first. For a 24-route tool site leaning on niche cube libraries, ecosystem
        depth is the deciding factor. The cost is bundle weight and a heavier runtime, but Vite 8 +
        code-splitting bring it back into budget.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          The whole <code>@cuberoot/client</code> package is a single React 19 tree. <code>react-router-dom</code>
          {' '}7 routes the 24+ pages; each page is <code>lazy()</code>-loaded into its own chunk and wrapped in
          {' '}<code>&lt;Suspense&gt;</code>. Heavy tools like Recon / Trainer / FrameCount use <code>useTransition</code>
          {' '}to keep input responsive while expensive state updates run in the background.
        </p>
        <p>
          Pure SPA deploy — no RSC / Actions yet. nginx ships static files, React boots in the
          browser and takes over. The setup has a long shelf life for a tiny team: TTI under 200ms,
          route switches instant.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2013·05',
      zh: { title: 'JSConf 开源', desc: '5 月 29 日 Jordan Walke 在 JSConf US 公开发布。组件 + 虚拟 DOM 的范式当场让整个圈惊呼。' },
      en: { title: 'Open-sourced at JSConf', desc: 'May 29, JSConf US. The component + virtual-DOM model breaks the MVC mold the moment it lands.' },
    },
    {
      year: '2015·03',
      zh: { title: 'React Native', desc: '同一套组件思维落到 iOS / Android, "Learn once, write anywhere" 不只是口号。' },
      en: { title: 'React Native', desc: 'The same component mental model targets iOS/Android — validating "learn once, write anywhere."' },
    },
    {
      year: '2019·02',
      zh: { title: 'Hooks (16.8)', desc: 'useState / useEffect 让函数组件拿回 state, class 组件正式退场。逻辑复用从 HOC 套娃变成 import 一行。' },
      en: { title: 'Hooks (16.8)', desc: 'useState / useEffect put state back into function components and retire classes. Logic reuse becomes a flat import instead of an HOC/render-prop tower.' },
    },
    {
      year: '2020·10',
      zh: { title: '17 — 并发铺路', desc: '17 没有新 feature, 但是把 "渐进升级 + 多版本共存" 调通, 给后面的 Concurrent 模式开路。' },
      en: { title: '17 — paving for concurrent', desc: 'No new features. v17 is the "gradual upgrade + multi-version coexistence" release that quietly unlocks the concurrent era.' },
    },
    {
      year: '2024·12',
      zh: { title: '19.0 GA', desc: 'Actions / use() / ref-as-prop / 稳定的 Server Components。框架作者终于可以正式上 RSC。' },
      en: { title: '19.0 GA', desc: 'Actions, use(), ref-as-prop, stable React Server Components. Framework authors can finally adopt RSC for real.' },
    },
    {
      year: '2026·05', highlight: true,
      zh: { title: '19.2.6', desc: '当前稳定点。19.2 加了 <Activity> 暂停/恢复整棵子树、useEffectEvent 解决"非反应式回调依赖"老大难、Performance Tracks DevTools 集成。' },
      en: { title: '19.2.6', desc: 'Latest patch on the 19.2 line — <Activity> for pause/resume subtrees, useEffectEvent for non-reactive callback deps, and a unified Performance Tracks DevTools integration.' },
    },
  ],
  features: [
    {
      zh: { title: 'Hooks API', desc: 'useState / useEffect / useMemo / useTransition 让函数组件自带状态、副作用、并发提示。自定义 hook 把跨组件复用拉成一行 import。' },
      en: { title: 'Hooks API', desc: 'useState / useEffect / useMemo / useTransition give function components state, effects, and concurrency hints. Custom hooks turn cross-component logic reuse into a flat import.' },
    },
    {
      zh: { title: 'Concurrent + Suspense', desc: '调度器可以中断、暂停、恢复 render。<Suspense> 声明式等异步数据 / 代码分割,配合 useTransition 让昂贵更新不挡输入。' },
      en: { title: 'Concurrent + Suspense', desc: 'The scheduler can interrupt, pause, resume renders; <Suspense> declaratively waits on async data or code-split chunks. With useTransition, expensive updates stay off the input path.' },
    },
    {
      zh: { title: 'Server Components + Actions', desc: 'RSC 在服务端渲染、零 JS 下发。<form action={fn}> 调服务端函数自带 pending / error / optimistic state。把"前后端胶水代码"砍掉一大半。' },
      en: { title: 'Server Components + Actions', desc: 'RSC renders on the server with zero JS shipped. <form action={fn}> calls server functions with built-in pending / error / optimistic state. Cuts the typical client-server glue in half.' },
    },
    {
      zh: { title: 'ref-as-prop & use()', desc: '19 之后不再需要 forwardRef;use(promise) 在 render 内部直接 unwrap 异步值, Suspense 边界自动接管。模板代码继续减少。' },
      en: { title: 'ref-as-prop & use()', desc: 'forwardRef is no longer needed after 19; use(promise) unwraps async values inline inside render and hooks into the nearest Suspense boundary. Boilerplate keeps shrinking.' },
    },
  ],
  links: [
    { label: 'react.dev', href: 'https://react.dev' },
    { label: 'GitHub · facebook/react', href: 'https://github.com/facebook/react' },
    { label: 'React 19 announcement', href: 'https://react.dev/blog/2024/12/05/react-19' },
  ],
};

const VITE: StackTool = {
  slug: 'vite',
  name: 'Vite',
  version: '8.0',
  since: '2020-04',
  group: 'frontend',
  accent: '#646CFF',
  glyph: '⚡',
  zh: {
    tagline: '原生 ESM 起步,Rolldown 收官',
    role: '前端的构建 + dev server。冷启动一秒以内, HMR 即时, 生产构建用 Rolldown 把 24 页打包成几十个 hashed chunk。',
    intro: (
      <>
        <p>
          Vite 是 Evan You 2020 年 4 月在做 Vue 3 时顺手起的工具。核心赌注:浏览器既然原生支持
          ESM,dev 阶段就别再打包了,直接把 <code>.ts</code> / <code>.vue</code> 按需转成 ESM 喂给浏览器。
          首次启动从扫一遍依赖图变成 O(1),24 路由的项目冷启动 {'<'} 1 秒。
        </p>
        <p>
          v2 框架无关化,Rollup 兼容插件 API 让 React / Svelte / Lit 都能跑。2024 年宣布 Rolldown 作为长期目标,
          一份 Rust 实现把 esbuild (dev pre-bundle) + Rollup (prod) 这条历史包袱直接合并。Vite 8 (2026-03) 已经
          完成切换,prod 构建比 v7 快 10-30 倍。
        </p>
      </>
    ),
    why: (
      <p>
        Webpack 还能赢在最复杂的 legacy CommonJS 边角和最大的插件目录,Turbopack 抱紧 Next.js,
        但 Vite 是唯一一个 Rust 内核 (Rolldown) + 稳定 Rollup-compatible 插件 API 的现代打包器。对 cuberoot.me
        这种纯静态 SPA 部署,<code>build</code> 出来一堆 hashed asset,nginx 原样吐 —— 没有运行时,没有框架锁定。
        SSR / RSC 的生态确实比 Next + Turbopack 年轻,但本站根本不需要。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          Dev server 绑死 <code>127.0.0.1:5173</code> (Windows + IPv6 默认装不上,在 <code>vite.config.ts</code>
          {' '}里写死)。自写的 <code>serveRepoRoot</code> 插件让 dev 阶段直接服仓库根的 <code>/tools/</code> /
          {' '}<code>/stats/</code> 静态资源, 跟生产 nginx 的目录结构对齐, 省掉一套 alias。
        </p>
        <p>
          生产构建走 <code>pnpm --filter @cuberoot/client build</code>, Rolldown 出 ~80 个 chunk,
          每个 route 一个独立 bundle。Github Actions 把整包 rsync 到云服务器的 nginx 根目录, 后续就是
          静态资源 + 长 cache。Vite plugin 还兼掉了 dev/prod 的 HMR 三入口路径推导 (架构页第 9 节)。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Native ESM at the start, Rolldown at the finish',
    role: 'Frontend build + dev server. Cold start under a second, HMR instant; the prod build runs Rolldown to ship the 24-page SPA as dozens of hashed chunks.',
    intro: (
      <>
        <p>
          Evan You started Vite in April 2020 while finishing Vue 3. The core bet: browsers speak ESM
          natively, so the dev server shouldn't bundle at all — serve <code>.ts</code> / <code>.vue</code>
          on demand as ES modules and let the browser fetch the graph. Cold start drops from O(graph)
          to O(1); a 24-route SPA boots in well under a second.
        </p>
        <p>
          v2 became framework-agnostic with a Rollup-compatible plugin API, so React / Svelte / Lit
          all run. In 2024 Rolldown was announced as the long-term replacement — one Rust
          implementation that merges esbuild (dev pre-bundle) and Rollup (prod). Vite 8 (2026-03)
          completed the switch; prod builds are 10–30× faster than v7.
        </p>
      </>
    ),
    why: (
      <p>
        Webpack still wins the gnarliest legacy CommonJS edges and has the deepest plugin catalog;
        Turbopack ships tighter Next.js integration; but Vite is the only modern bundler with a Rust
        core (Rolldown) <em>and</em> a stable Rollup-compatible plugin API the existing ecosystem
        already speaks. For a static SPA like cuberoot.me, <code>build</code> drops a folder of
        hashed assets that nginx serves verbatim — no runtime, no framework lock-in. SSR + RSC story
        is younger than Next/Turbopack, but this site doesn't need it.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          Dev server is pinned to <code>127.0.0.1:5173</code> (Windows + IPv6 defaults don't connect; it's
          hard-coded in <code>vite.config.ts</code>). A small custom <code>serveRepoRoot</code> plugin makes
          the dev server expose the repo's <code>/tools/</code> and <code>/stats/</code> trees directly,
          matching the production nginx layout — no alias maze to maintain.
        </p>
        <p>
          Prod build is <code>pnpm --filter @cuberoot/client build</code>; Rolldown emits ~80 chunks,
          one per route. GitHub Actions rsyncs the output to the cloud VM's nginx root, and from there
          it's static assets + long cache. Vite plugins also take care of the dev/prod HMR triple-entry
          derivation (see architecture page §09).
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2020·04',
      zh: { title: '初版发布', desc: 'Evan You 写 Vue 3 时顺手做了个 Vue-only 的 ESM dev server, 跳过 bundle 直接用浏览器原生 module。' },
      en: { title: 'Initial release', desc: 'Evan You ships a Vue-only ESM dev server while finishing Vue 3 — skips bundling by leaning on native browser modules.' },
    },
    {
      year: '2021·02',
      zh: { title: 'Vite 2 框架无关', desc: '重写为框架无关 + Rollup-compatible 插件 API。React / Svelte / Lit / Preact 一夜之间都有了 starter。' },
      en: { title: 'Vite 2 — framework-agnostic', desc: 'Rewritten as framework-agnostic with a Rollup-compatible plugin API. React / Svelte / Lit / Preact starters arrive overnight.' },
    },
    {
      year: '2022·07',
      zh: { title: 'Vite 3', desc: 'Node 14+ 起步, 文档站重做。从这版起 "非 Next 的 React 项目默认用 Vite" 才稳定下来。' },
      en: { title: 'Vite 3', desc: 'Node 14+ baseline, new docs site. From here on, "non-Next React = Vite" cements as the default.' },
    },
    {
      year: '2024·05',
      zh: { title: 'Rolldown 揭幕', desc: 'ViteConf 上宣布 Rust 实现、Rollup-compatible 的 Rolldown 作为长期目标 —— 取代 esbuild + Rollup。' },
      en: { title: 'Rolldown unveiled', desc: 'At ViteConf, a Rust-based Rollup-compatible bundler is announced as the long-term replacement for esbuild + Rollup.' },
    },
    {
      year: '2025·06',
      zh: { title: 'VoidZero / Vite+', desc: 'Evan You 的公司把 Vite / Rolldown / Oxc / Oxlint 整合到一个 toolchain 组织下,统一 governance。' },
      en: { title: 'VoidZero / Vite+', desc: 'Evan You\'s company consolidates Vite, Rolldown, Oxc, and Oxlint into one toolchain org under unified governance.' },
    },
    {
      year: '2026·03', highlight: true,
      zh: { title: 'Vite 8', desc: 'Rolldown 成为 dev + prod 单一打包器。报道 dev 启动 3× / prod 构建 10-30× 加速 (Linear: 46s → 6s)。' },
      en: { title: 'Vite 8', desc: 'Rolldown becomes the single bundler for dev + prod. 3× faster dev start; 10–30× faster prod builds (Linear: 46s → 6s).' },
    },
  ],
  features: [
    {
      zh: { title: '原生 ESM dev server', desc: '源文件按需作为 ES module 直接吐给浏览器,HMR 用 WebSocket 推。冷启动 O(1) 而不是 O(依赖图大小)。' },
      en: { title: 'Native ESM dev server', desc: 'Source files are served on demand as ES modules; HMR is pushed over a WebSocket. Cold start is O(1) instead of O(graph).' },
    },
    {
      zh: { title: 'Rolldown 打包器 (v8)', desc: 'Rust 写的、Rollup API 兼容,同时承担 dev pre-bundle 和 prod build。彻底消灭早期 Vite 的 dev/prod skew 问题。' },
      en: { title: 'Rolldown bundler (v8)', desc: 'Rust-based, Rollup-API-compatible, doubles as the dev pre-bundler and prod bundler. Eliminates the esbuild/Rollup dev-vs-prod skew.' },
    },
    {
      zh: { title: 'vite.config.ts + 插件 API', desc: '类型化 config, Rollup 插件直接复用。本站的 serveRepoRoot 插件 30 行搞定 dev 阶段服 /tools / /stats。' },
      en: { title: 'vite.config.ts + plugin API', desc: 'Typed config, Rollup-compatible plugins reused as-is. cuberoot.me\'s serveRepoRoot plugin serves /tools/ and /stats/ in ~30 lines.' },
    },
    {
      zh: { title: 'Library / SSR 模式', desc: 'build.lib / ssrLoadModule / env-mode hook 让 "出个 npm 包 / 预渲染路由" 变成 config 标志, 而不是另一套 toolchain。' },
      en: { title: 'Library + SSR modes', desc: 'build.lib, ssrLoadModule, env-mode hooks make publishing a library or pre-rendering routes a config flag, not a separate toolchain.' },
    },
  ],
  links: [
    { label: 'vite.dev', href: 'https://vite.dev' },
    { label: 'GitHub · vitejs/vite', href: 'https://github.com/vitejs/vite' },
    { label: 'Vite 8 announcement', href: 'https://vite.dev/blog/announcing-vite8' },
  ],
};

const HONO: StackTool = {
  slug: 'hono',
  name: 'Hono',
  version: '4.12',
  since: '2022-01',
  group: 'backend',
  accent: '#FF5C00',
  glyph: '炎',
  zh: {
    tagline: 'TS 一等公民, ~14KB 核心',
    role: 'api.cuberoot.me 后面那个 Hono server。22 个端点全跑在它上面,nginx 反代过来直接进路由。',
    intro: (
      <>
        <p>
          Hono(日语 "炎",发音 ho-no)是 Yusuke Wada 2022 年初做的 TS-first web 框架。最初是 Cloudflare
          Workers 上的轻量路由,后来加了 Deno / Bun / Node / Lambda adapter, 一份 handler 可以跑在所有
          主流 JS 运行时上,核心只有 ~14KB。
        </p>
        <p>
          关键卖点不是性能(虽然也快), 是路由类型推断 —— 路径参数、validator、响应形状从声明走到客户端
          全部 typed。配合 RPC (<code>typeof app</code> 输出类型, <code>hc&lt;AppType&gt;</code> 输入,
          客户端 fetch 直接拿到完整签名), 后端改一行接口、前端立刻红波浪线。
        </p>
      </>
    ),
    why: (
      <p>
        Express 是 JS 时代的、没类型;Fastify 性能上去了但 schema-first 那套和 TS 推断顶得不爽,
        依赖也膨胀。Hono 声明式、TS 原生、bundle ~100KB —— 本站 2025-03-24 把 Fastify 24 小时内
        换成 Hono 就是因为这三条。同一套 Web Standards <code>Request</code> / <code>Response</code>
        API 在测试、Workers、Node 里全部一致。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          Hono 4 跑在 Node 22 LTS 上, pm2 cluster mode 1 个实例。nginx 把 api.cuberoot.me 反代到
          {' '}<code>127.0.0.1:3001</code>。22 个端点覆盖:WCA OAuth + session、recon / alg /
          training-data CRUD、WCA stats 读取、nemesizer。
        </p>
        <p>
          CORS allowlist 白名单写在 <code>core/packages/server/src/index.ts</code>。所有客户端调用
          走共享的 <code>apiUrl()</code> helper, 不硬编码 origin。生产部署用 GitHub Actions push
          源码,云服务器 <code>pnpm install --filter @cuberoot/server</code> + <code>pm2 reload</code>。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'TS-first, ~14KB core',
    role: 'The Hono server behind api.cuberoot.me — 22 endpoints, reverse-proxied by nginx straight into the router.',
    intro: (
      <>
        <p>
          Hono (Japanese 炎, "flame," pronounced ho-no) is Yusuke Wada's TS-first web framework, started in
          early 2022. It began as a tiny router for Cloudflare Workers, then grew Deno / Bun / Node /
          Lambda adapters — one handler runs on every major JS runtime, with a core of just ~14KB.
        </p>
        <p>
          The headline isn't raw speed (though it is fast). It's end-to-end routing type inference —
          path params, validators, and response shape are typed from server declaration all the way to
          the client. Hono RPC (<code>typeof app</code> exported, <code>hc&lt;AppType&gt;</code>
          consumed) means changing an endpoint signature lights up red squiggles in the frontend.
        </p>
      </>
    ),
    why: (
      <p>
        Express is the JS-era choice and untyped; Fastify is fast, but its schema-first style fights
        TS inference and pulls ~5MB of deps. Hono is declarative, TS-native, and the bundle stays
        under ~100KB — exactly why cuberoot.me swapped Fastify out for it within 24 hours on
        2025-03-24. The same Web Standards <code>Request</code> / <code>Response</code> API works
        identically in tests, Workers, and Node.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          Hono 4 runs on Node 22 LTS under pm2 (cluster mode, single instance). nginx
          reverse-proxies <code>api.cuberoot.me</code> to <code>127.0.0.1:3001</code>. 22 endpoints
          cover WCA OAuth + sessions, recon / alg / training-data CRUD, WCA stats reads, and the
          nemesizer service.
        </p>
        <p>
          The CORS allowlist lives in <code>core/packages/server/src/index.ts</code>. Client calls go
          through a shared <code>apiUrl()</code> helper — no hard-coded origins. Production deploys
          via GitHub Actions: source pushed, the VM runs <code>pnpm install --filter
          @cuberoot/server</code>, then <code>pm2 reload</code>.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2022·01',
      zh: { title: 'v0.0.1', desc: 'Cloudflare Workers 上的 TS 路由, ~10KB。Yusuke Wada 把"日语火焰字 炎"做成项目名。' },
      en: { title: 'v0.0.1', desc: 'A TS router for Cloudflare Workers, ~10KB. Yusuke Wada names it after 炎 (Japanese "flame").' },
    },
    {
      year: '2022·07',
      zh: { title: 'v1.x', desc: '路由 + 中间件 API 稳定。开始有 starter / 文档 / 第三方中间件生态。' },
      en: { title: 'v1.x', desc: 'Routing + middleware API stabilizes; starters, docs, and third-party middleware begin to form an ecosystem.' },
    },
    {
      year: '2023·02',
      zh: { title: 'v2 多运行时', desc: '加 Deno / Bun / Node / Lambda adapter。同一份 handler 可以跑在任何主流 JS runtime 上。' },
      en: { title: 'v2 — multi-runtime', desc: 'Deno / Bun / Node / Lambda adapters land. One handler now runs on every major JS runtime.' },
    },
    {
      year: '2023·05',
      zh: { title: 'v3 + RPC', desc: 'Stacks 模式 + Hono RPC (类型直接从服务端流到客户端 fetch)。' },
      en: { title: 'v3 + RPC', desc: 'Stacks pattern + Hono RPC — types flow straight from server declarations into the client fetch call.' },
    },
    {
      year: '2024·01',
      zh: { title: 'v4 重写', desc: 'JSX renderer / presets (hono/tiny, hono/quick) / RPC production-ready / JSR 发布。生产可用版本基本成型。' },
      en: { title: 'v4 rewrite', desc: 'JSX renderer, presets (hono/tiny, hono/quick), production-ready RPC, JSR publish. The production shape is essentially locked.' },
    },
    {
      year: '2026·05', highlight: true,
      zh: { title: 'v4.12.18', desc: '当前稳定。npm 周下载 ~2000 万,被 Cloudflare D1 / KV、Clerk、Unkey、cdnjs 用作骨架。' },
      en: { title: 'v4.12.18', desc: 'Current stable. ~20M weekly npm downloads. Used as the backbone of Cloudflare D1 / KV, Clerk, Unkey, and cdnjs.' },
    },
  ],
  features: [
    {
      zh: { title: 'TS-first 路由推断', desc: '路径参数、validator、响应形状端到端 typed。无 codegen, IDE 直接红波浪线。' },
      en: { title: 'TS-first routing inference', desc: 'Path params, validators, and response shape are inferred end-to-end. Zero codegen — IDE red squiggles all the way.' },
    },
    {
      zh: { title: '多运行时 adapter', desc: '一份 handler, 在 Workers / Deno / Bun / Node / Lambda / Lambda@Edge / Fastly 上都能跑。换运行时只换 main.ts 顶部一行。' },
      en: { title: 'Multi-runtime adapters', desc: 'One handler, runs on Workers / Deno / Bun / Node / Lambda / Lambda@Edge / Fastly. Switching runtimes is a one-line change at the top of main.ts.' },
    },
    {
      zh: { title: '~14KB 核心', desc: 'tree-shake 友好,中间件按需。热路径里没有依赖。基准测试比 Express 快 3-5×。' },
      en: { title: '~14KB core', desc: 'Tree-shakeable, middleware loaded only when used. No deps on the hot path. Benches 3–5× faster than Express.' },
    },
    {
      zh: { title: 'RPC 类型共享', desc: '服务端 export type AppType = typeof app;客户端 hc<AppType>(...) 直接拿到 typed fetch。无需 schema 二次声明。' },
      en: { title: 'RPC type-sharing', desc: 'Server: export type AppType = typeof app. Client: hc<AppType>(...) yields a typed fetch. No schema duplication.' },
    },
  ],
  links: [
    { label: 'hono.dev', href: 'https://hono.dev' },
    { label: 'GitHub · honojs/hono', href: 'https://github.com/honojs/hono' },
  ],
};

const NODE: StackTool = {
  slug: 'node',
  name: 'Node.js',
  version: '22 LTS',
  since: '2009-05',
  group: 'backend',
  accent: '#5FA04E',
  glyph: '⬢',
  zh: {
    tagline: 'Jod LTS,内置 fetch / test / watch',
    role: 'Hono server 跑的运行时。pm2 fork 出 Node 进程, V8 接管 JS, libuv 跑 event loop。整个后端就这一进程。',
    intro: (
      <>
        <p>
          Node.js 是 Ryan Dahl 2009 年在 JSConf EU 公布的:把 Chrome 的 V8 拉出来,套上 libuv 的 event loop,
          JavaScript 就能写服务端。17 年后,它仍是绝大多数 TypeScript 后端的默认运行时。
        </p>
        <p>
          Node 22 LTS 代号 <strong>"Jod"</strong>, 2024-04 发布,2024-10 进 LTS, Active 到 2026-10,
          Maintenance 到 2027-04。这一代的大动作:稳定 <code>--watch</code>、原生 test runner、
          {' '}<code>--run</code> 跑 package.json 脚本、实验性 type-stripping (直接跑 <code>.ts</code>)。
        </p>
      </>
    ),
    why: (
      <p>
        Bun 启动更快、Deno 更干净, 但生态成熟度还差一截:native module、pg 驱动、各种 observability
        agent 在 Bun / Deno 上仍踩坑。Node 22 LTS 给你 native fetch / test / watch、贴近规范的 ESM、
        2027 之前的安全更新窗口 —— pm2 cluster mode 还假设跑在 Node 上。本站后端是 22 个端点的中型
        API,稳定 {'>'} 极限性能。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          只有一个 Node 进程, 跑在云 VM 的 :3001 上, pm2 启停 + 守护。日志走 pm2-logrotate 落到
          {' '}<code>~/.pm2/logs/</code>, 系统重启后 systemd 拉起 pm2-runtime 自动恢复。
        </p>
        <p>
          dev 阶段在 Windows 用同一个 Node 22, <code>pnpm --filter @cuberoot/server dev</code> 用
          tsx 直接跑 <code>.ts</code>;生产把 <code>tsc</code> 出来的 <code>dist/</code> 喂给 Node。
          pg 客户端用 <code>postgres</code> (porsager/postgres) 而非 <code>pg</code>, 走 socket 连
          localhost PG。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Jod LTS — fetch / test / watch built in',
    role: 'The runtime the Hono server runs on. pm2 forks a Node process, V8 takes JS, libuv runs the event loop. That single process is the whole backend.',
    intro: (
      <>
        <p>
          Node.js was unveiled by Ryan Dahl at JSConf EU in 2009 — pull Chrome's V8 out, wrap it in
          libuv's event loop, write servers in JavaScript. Seventeen years later, it's still the
          default runtime for almost every TypeScript backend.
        </p>
        <p>
          Node 22 LTS, codename <strong>"Jod"</strong>, shipped 2024-04 and entered LTS 2024-10
          (Active through 2026-10, maintenance through 2027-04). The big moves this generation:
          stable <code>--watch</code>, a built-in test runner, <code>--run</code> for package.json
          scripts, and experimental type stripping that lets you run <code>.ts</code> files
          directly.
        </p>
      </>
    ),
    why: (
      <p>
        Bun has faster cold starts and Deno is cleaner, but ecosystem maturity still bites — native
        modules, pg drivers, and most observability agents have rough edges on Bun / Deno. Node 22
        LTS hands you native fetch / test / watch, near-spec ESM, and a security window stretching
        to 2027 — and pm2's cluster mode assumes it. For 22 endpoints of mid-traffic API, stability
        beats peak performance.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          Exactly one Node process runs on the cloud VM on port 3001, lifecycled by pm2. Logs go
          through pm2-logrotate into <code>~/.pm2/logs/</code>; after a reboot, systemd starts
          pm2-runtime, which restores the app list.
        </p>
        <p>
          Dev on Windows uses the same Node 22: <code>pnpm --filter @cuberoot/server dev</code>
          runs <code>.ts</code> directly via tsx. Production runs the <code>dist/</code> emitted
          by <code>tsc</code>. The Postgres client is <code>postgres</code> (porsager/postgres),
          not <code>pg</code>, and connects over a socket to local PG.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2009·05',
      zh: { title: '初版', desc: 'Ryan Dahl 在 JSConf EU 演讲: V8 + libuv = 一个新的服务端运行时。' },
      en: { title: 'First release', desc: 'Ryan Dahl unveils Node.js at JSConf EU — V8 + libuv = a new server-side runtime.' },
    },
    {
      year: '2013-15',
      zh: { title: '0.10 / io.js / 重新合并', desc: '社区分裂、io.js 分支、最终在 Node 4.0 合并。npm 同期成为世界最大包注册表。' },
      en: { title: '0.10 / io.js / reunify', desc: 'A community split spawned io.js; reunified at Node 4.0. npm meanwhile grew into the world\'s largest package registry.' },
    },
    {
      year: '2020·10',
      zh: { title: '15 — top-level await', desc: '顶层 await 落地, ESM 在 14/16 一路稳定。Node 真正变成 "ES module first"。' },
      en: { title: '15 — top-level await', desc: 'Top-level await lands; ESM stabilizes through 14/16. Node becomes truly ES-module-first.' },
    },
    {
      year: '2022·04',
      zh: { title: '18 LTS', desc: '原生 fetch / Web Streams / undici-based --test。再也不用 node-fetch。' },
      en: { title: '18 LTS', desc: 'Native fetch, Web Streams, undici-based --test. node-fetch finally retired.' },
    },
    {
      year: '2024·04',
      zh: { title: '22 LTS "Jod"', desc: '--run script runner、稳定 WebSocket client、require(esm) 解禁、实验性 --experimental-strip-types 直接跑 .ts。' },
      en: { title: '22 LTS "Jod"', desc: '--run script runner, stable WebSocket client, require(esm) unflagged, experimental --experimental-strip-types runs .ts directly.' },
    },
    {
      year: '2026·05', highlight: true,
      zh: { title: 'v22.22.3', desc: '当前 LTS 补丁。OpenSSL 3.5.6 + NSS 3.121 根证书刷新 + crypto null-ptr 修复。' },
      en: { title: 'v22.22.3', desc: 'Current LTS patch. OpenSSL 3.5.6 + NSS 3.121 root-cert refresh + a crypto null-ptr fix.' },
    },
  ],
  features: [
    {
      zh: { title: '--watch 模式', desc: '内置文件监听重启。dev 阶段不再装 nodemon, --watch src 一行搞定。' },
      en: { title: '--watch mode', desc: 'Built-in file watcher restarts on edit. No more nodemon — just --watch src.' },
    },
    {
      zh: { title: '原生 test runner', desc: 'node --test, TAP / spec reporter, 自带 mock / snapshot。小服务直接替掉 Vitest。' },
      en: { title: 'Native test runner', desc: 'node --test with TAP / spec reporters, mocks and snapshots built in. Small services can drop Vitest entirely.' },
    },
    {
      zh: { title: '--run 脚本', desc: 'node --run build 跑 package.json 脚本, 比 npm run 快 ~3×, 没有 npm 进程开销。' },
      en: { title: '--run', desc: 'node --run build executes a package.json script ~3× faster than npm run — skips the npm process entirely.' },
    },
    {
      zh: { title: '类型剥离', desc: 'node --experimental-strip-types api.ts 直接跑 TS, 不再需要 tsx / ts-node。type-only 项目 prod 也能省掉 tsc。' },
      en: { title: 'Type stripping', desc: 'node --experimental-strip-types api.ts runs TS directly — no tsx / ts-node needed. Type-only projects can even skip tsc in prod.' },
    },
  ],
  links: [
    { label: 'nodejs.org', href: 'https://nodejs.org' },
    { label: 'GitHub · nodejs/node', href: 'https://github.com/nodejs/node' },
    { label: 'Node 22.22.3 release notes', href: 'https://nodejs.org/en/blog/release/v22.22.3' },
  ],
};

const PM2: StackTool = {
  slug: 'pm2',
  name: 'pm2',
  version: '7.0',
  since: '2013-06',
  group: 'backend',
  accent: '#2B96EC',
  glyph: 'P2',
  zh: {
    tagline: '一个让 Node 不死的 daemon',
    role: '守护那一个 Hono Node 进程。挂了重启,重启了重连日志,机器重启后 systemd 自动拉起来。',
    intro: (
      <>
        <p>
          pm2 是 2013 年 Alexandre Strzelewicz / Unitech 写的 Node process manager。把 Node 进程
          daemonize, 挂了自动重启, 日志统一收集, 0 downtime reload, cluster mode 一行加多个 worker。
          后续做了 Keymetrics 的 SaaS 监控,但开源核心一直免费。
        </p>
        <p>
          解决的痛点很具体:你写完一个 Hono server, <code>node dist/index.js</code> 跑起来了,
          可是怎么开机自启?日志怎么轮转?进程挂了怎么办?怎么 reload 不中断?pm2 就是把这一坨
          摊在一个工具里。
        </p>
      </>
    ),
    why: (
      <p>
        systemd 一份 unit 一个服务很正确, 但每加一个 Node 应用都要写新 unit + 日志轮转 + reload 信号,
        蛇皮膏药。<code>forever</code> 不再维护。Docker 单进程跑一台机的 API 有点重。pm2 把
        cluster reload + 启动持久化 + <code>pm2 logs</code> / <code>pm2 monit</code> 打包成命令行,
        正好是 cuberoot.me 这种 "单机一个 Hono API" 的形状。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          配置在 <code>ecosystem.config.js</code>:一个 app 名 <code>cuberoot-api</code>,
          script <code>dist/index.js</code>, cluster mode 1 个 instance。<code>pm2 startup</code> +
          {' '}<code>pm2 save</code> 把它注册到 systemd, 重启自动拉。
        </p>
        <p>
          日志走 pm2-logrotate 落到 <code>~/.pm2/logs/cuberoot-api-{`{out,err}`}.log</code>,
          按 10MB 滚动, 保留 14 天。部署用 <code>pm2 reload cuberoot-api</code> 触发 graceful
          重启, 新进程起来再杀旧的, 不丢请求。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'A daemon that keeps Node alive',
    role: 'Babysits the single Hono Node process — restarts it on crash, reattaches logs, and survives VM reboots via systemd.',
    intro: (
      <>
        <p>
          pm2 is Alexandre Strzelewicz / Unitech's Node process manager, started in 2013. It
          daemonizes Node processes, auto-restarts on crash, aggregates logs, supports zero-downtime
          reload, and runs cluster mode with one flag. A Keymetrics SaaS monitoring layer was built
          on top later, but the open-source core has stayed free throughout.
        </p>
        <p>
          The pain point it solves is concrete: you wrote a Hono server, <code>node dist/index.js</code>
          works locally — but how does it survive a reboot? How are logs rotated? What if it
          crashes? How do you reload without dropping requests? pm2 piles all of that into one CLI.
        </p>
      </>
    ),
    why: (
      <p>
        Systemd one-unit-per-service is correct, but every new Node app means another unit + log
        rotation + reload signal — busywork. <code>forever</code> is unmaintained. Docker is heavy
        for a single-host API. pm2 packs cluster reload, boot persistence, and{' '}
        <code>pm2 logs</code> / <code>pm2 monit</code> into the CLI — exactly the shape of
        cuberoot.me's "one Hono API behind nginx" setup.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          The config lives in <code>ecosystem.config.js</code>: one app named{' '}
          <code>cuberoot-api</code>, script <code>dist/index.js</code>, cluster mode with one
          instance. <code>pm2 startup</code> + <code>pm2 save</code> register it with systemd so
          reboots restore it automatically.
        </p>
        <p>
          Logs are rotated by pm2-logrotate into{' '}
          <code>~/.pm2/logs/cuberoot-api-{`{out,err}`}.log</code> — 10MB rolls, 14-day retention.
          Deploys run <code>pm2 reload cuberoot-api</code> for graceful restart: the new worker boots
          before the old one dies, so no requests drop.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2013·06',
      zh: { title: 'v0.x', desc: '6 月 27 日首次发上 npm。"keep Node alive + auto-restart" 这个最小目标。' },
      en: { title: 'v0.x', desc: 'First npm publish on June 27. Minimal goal: keep Node alive + auto-restart.' },
    },
    {
      year: '2014',
      zh: { title: 'Cluster mode', desc: 'Node 自带 round-robin 负载均衡, pm2 加一层 graceful reload — 滚动重启不掉请求。' },
      en: { title: 'Cluster mode', desc: 'Node\'s built-in round-robin load balancer + a pm2 graceful-reload layer — workers cycle one at a time, no dropped requests.' },
    },
    {
      year: '2015',
      zh: { title: 'ecosystem.config.js', desc: '声明式描述多 app + 多 env, 部署不再依赖一长串命令行参数。' },
      en: { title: 'ecosystem.config.js', desc: 'Declarative multi-app + multi-env config. Deploys stop needing 20-flag command lines.' },
    },
    {
      year: '2017',
      zh: { title: 'pm2-runtime', desc: 'Docker 友好的 PID 1, 替代 daemon fork 模型。容器场景终于优雅。' },
      en: { title: 'pm2-runtime', desc: 'Docker-friendly PID 1 — replaces the daemonized fork model. Containers finally get a clean pm2 story.' },
    },
    {
      year: '2023·04',
      zh: { title: 'v5.0', desc: '内部现代化, Node 16+ 基线。文档站重做, 现代 ESM 工具链兼容。' },
      en: { title: 'v5.0', desc: 'Internals modernized, Node 16+ baseline. Docs revamp; modern ESM toolchain compatibility.' },
    },
    {
      year: '2025·05', highlight: true,
      zh: { title: 'v7.0 / 7.0.1', desc: 'Node 18+ 基线, 加 Bun runtime 支持, 内化 pm2-axon / pm2-io-agent 减少供应链表面积, 修若干 CVE。' },
      en: { title: 'v7.0 / 7.0.1', desc: 'Node 18+ baseline, adds Bun runtime support, internalizes pm2-axon / pm2-io-agent (smaller supply-chain surface), and patches several CVEs.' },
    },
  ],
  features: [
    {
      zh: { title: 'Cluster mode', desc: 'exec_mode: cluster fork N 个 worker, Node 自带轮询负载。pm2 reload 一个一个换 worker, 0 downtime。' },
      en: { title: 'Cluster mode', desc: 'exec_mode: cluster forks N workers behind Node\'s round-robin load balancer. pm2 reload cycles workers one at a time — zero downtime.' },
    },
    {
      zh: { title: '启动持久化', desc: 'pm2 startup + pm2 save 写一份 systemd unit, 重启后 app 列表自动恢复。无需每个 app 单独写 unit。' },
      en: { title: 'Persistent process tree', desc: 'pm2 startup + pm2 save generate a systemd unit that restores the app list on boot — no hand-written unit per app.' },
    },
    {
      zh: { title: '日志聚合', desc: '每个 app 的 stdout/stderr 都收到 ~/.pm2/logs/, pm2 logs --lines N 直接看, pm2-logrotate 模块管轮转。' },
      en: { title: 'Log aggregation', desc: 'Each app\'s stdout/stderr lands in ~/.pm2/logs/. pm2 logs --lines N reads them, pm2-logrotate handles rotation.' },
    },
    {
      zh: { title: 'Ecosystem 文件', desc: '一个 ecosystem.config.js 描述 apps, env per stage, instances, cwd, watchers。--env production 切环境块。' },
      en: { title: 'Ecosystem files', desc: 'One ecosystem.config.js describes apps, env per stage, instances, cwd, watchers. --env production swaps env blocks in place.' },
    },
  ],
  links: [
    { label: 'pm2.keymetrics.io', href: 'https://pm2.keymetrics.io' },
    { label: 'GitHub · Unitech/pm2', href: 'https://github.com/Unitech/pm2' },
  ],
};

const POSTGRES: StackTool = {
  slug: 'postgresql',
  name: 'PostgreSQL',
  version: '13',
  since: '1986',
  group: 'backend',
  accent: '#336791',
  glyph: 'Pg',
  zh: {
    tagline: '40 年的关系型 + 一切',
    role: '本站唯一一个数据库。recon / alg case 库 / training data / WCA stats 衍生数据全部在这台 PG 13 里。',
    intro: (
      <>
        <p>
          PostgreSQL 的血缘可以拉回到 1986 年 UC Berkeley 的 POSTGRES 项目, Michael Stonebraker 主持。
          原本叫 POSTGRES, 用的查询语言是 QUEL;1996 年改名 PostgreSQL, 换上 SQL, 开源,
          从此 30 年没换过名字。
        </p>
        <p>
          它比 MySQL / MariaDB 更接近"标准 SQL + 真正 ACID + 类型系统"那条路。jsonb / 数组 / 范围类型 /
          外表 / GIST / GIN / 全文搜索 / 窗口函数 / partial index / 真事务 DDL —— 一个引擎覆盖几乎
          一切 OLTP 工作负载, 不用挂第二个 store。
        </p>
      </>
    ),
    why: (
      <p>
        SQL 一致性、真事务 DDL、<code>jsonb</code> 让它的工作面比 MySQL/MariaDB 宽一档 —— 一个引擎
        同时处理关系表、JSON 文档、数组 / 范围类型, 不用额外起一套。扩展生态 (PostGIS / pg_trgm /
        pgvector) 让你在它内部成长, 而不是往外迁。本站 2026-05-06 从 MariaDB 整体迁过来,
        recon / alg / stats 三层代码全部简化了一档。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          单实例 PG 13 跑在云 VM 的 <code>:5432</code>。Hono 通过本地 socket 连, 无网络往返。
          四个主要负载:<code>recon_*</code> 表存复盘缓存, <code>alg_sets</code> /{' '}
          <code>alg_cases</code> 存 41 套公式库 (2026-05-06 从 JSON 迁过来),{' '}
          <code>training_*</code> 存训练数据, <code>wca_stats_extra</code> 等表存 WCA 统计衍生数据。
        </p>
        <p>
          PG 13 在 2025-11-13 到 EOL —— 13.23 是最后一个安全补丁。本站还没切到 PG 18, 因为现有 schema
          全靠 jsonb / window function / partial index 这几个 13 已经稳的特性, 升 18 没立即收益,
          风险大于收益。pg_dump 备份留兜底。
        </p>
      </>
    ),
  },
  en: {
    tagline: '40 years of relational + everything',
    role: 'The site\'s only database. recon / alg case library / training data / WCA stats derivatives all live in one PG 13.',
    intro: (
      <>
        <p>
          PostgreSQL traces back to UC Berkeley's POSTGRES project in 1986, led by Michael
          Stonebraker. Originally named POSTGRES and using the QUEL query language, it was renamed
          PostgreSQL in 1996 when SQL replaced QUEL and the codebase went open source — and hasn't
          changed names since.
        </p>
        <p>
          It hews closer than MySQL / MariaDB to "real SQL + real ACID + a real type system." jsonb,
          arrays, ranges, foreign tables, GIST / GIN, full-text search, window functions, partial
          indexes, transactional DDL — one engine covers almost any OLTP workload without a second
          store.
        </p>
      </>
    ),
    why: (
      <p>
        Strict SQL conformance, transactional DDL, and <code>jsonb</code> give PG a wider working
        envelope than MySQL/MariaDB — one engine handles relational rows, JSON documents, arrays,
        and ranges with no add-ons. The extension ecosystem (PostGIS, pg_trgm, pgvector) means you
        grow into it rather than out of it. This site migrated from MariaDB on 2026-05-06; recon,
        alg, and stats code all dropped a tier of complexity.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          A single PG 13 instance runs on the cloud VM on <code>:5432</code>. Hono connects over a
          local Unix socket — no network hop. Four major workloads: <code>recon_*</code> for recon
          caches, <code>alg_sets</code> / <code>alg_cases</code> for the 41 alg-set library
          (migrated from JSON on 2026-05-06), <code>training_*</code> for training data,{' '}
          <code>wca_stats_extra</code> et al. for WCA stats derivatives.
        </p>
        <p>
          PG 13 hit EOL on 2025-11-13 — 13.23 was the last security patch. The site hasn't moved to
          PG 18 yet because the current schema only relies on features stable since 13 (jsonb,
          window functions, partial indexes); the upgrade has no immediate payoff and a real risk
          surface. pg_dump nightly backups carry the fallback.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '1986',
      zh: { title: 'Berkeley POSTGRES', desc: 'Stonebraker 在 UC Berkeley 启动 POSTGRES, 把对象-关系思路带进来, 用 QUEL 查询语言。' },
      en: { title: 'Berkeley POSTGRES', desc: 'Stonebraker starts POSTGRES at UC Berkeley, introducing object-relational ideas under the QUEL query language.' },
    },
    {
      year: '1996',
      zh: { title: '改名 + SQL + 开源', desc: 'QUEL 换成 SQL, 项目改名 PostgreSQL, 走开源, 由全球开发者组维护。' },
      en: { title: 'Renamed, SQL, open-sourced', desc: 'QUEL replaced by SQL, project renamed PostgreSQL, governed by the global development group.' },
    },
    {
      year: '2000',
      zh: { title: '7.0 — WAL', desc: '写前日志 (Write-Ahead Logging) 落地, 之后所有复制 / 崩溃恢复都建在这之上。' },
      en: { title: '7.0 — WAL', desc: 'Write-Ahead Logging lands. Every later replication and crash-recovery feature builds on it.' },
    },
    {
      year: '2014',
      zh: { title: '9.4 jsonb', desc: '二进制 JSON 类型 + GIN 索引。Postgres 从此可以当文档库用, 不用挂 Mongo。' },
      en: { title: '9.4 jsonb', desc: 'Binary JSON columns + GIN indexes. PostgreSQL becomes a real document store — no Mongo bolt-on needed.' },
    },
    {
      year: '2017',
      zh: { title: '10 逻辑复制 + 声明式分区', desc: '原生逻辑复制取代 Slony / pglogical, 声明式分区让大表正经能拆。' },
      en: { title: '10 — logical replication + declarative partitioning', desc: 'Native logical replication retires Slony / pglogical; declarative partitioning makes splitting big tables ergonomic.' },
    },
    {
      year: '2020·09', highlight: true,
      zh: { title: 'PostgreSQL 13 GA', desc: 'B-tree dedup (重复 key 索引更小), 并行 VACUUM, incremental sort, OR 子句的扩展统计。本站现在用的就是这一代。' },
      en: { title: 'PostgreSQL 13 GA', desc: 'B-tree deduplication (smaller indexes on repeated keys), parallel VACUUM, incremental sort, extended statistics for OR clauses. This is the generation cuberoot.me runs.' },
    },
  ],
  features: [
    {
      zh: { title: 'jsonb + GIN', desc: '二进制 JSON 列 + GIN 索引: 任意 path query 都能走索引。recon 缓存就是 jsonb。' },
      en: { title: 'jsonb + GIN', desc: 'Binary JSON columns with GIN indexes: any path query can hit an index. The recon cache is a jsonb column.' },
    },
    {
      zh: { title: 'B-tree dedup', desc: '13 引入。重复 key 在叶子节点只存一份, 高基数低唯一性场景下索引体积大幅缩小。' },
      en: { title: 'B-tree deduplication', desc: 'Introduced in 13. Repeated keys collapse to a single leaf entry — indexes on high-volume low-unique columns shrink dramatically.' },
    },
    {
      zh: { title: '并行 VACUUM', desc: '13 起 VACUUM 可以并行处理多个索引。大表 vacuum 时间从小时降到分钟。' },
      en: { title: 'Parallel VACUUM', desc: 'From 13 onward VACUUM can process indexes in parallel — big-table vacuum drops from hours to minutes.' },
    },
    {
      zh: { title: '窗口函数 + partial index', desc: 'WCA stats 那 80+ 个分析直接靠窗口函数写;partial index 让 "只索引活跃行" 变成一行 SQL。' },
      en: { title: 'Window functions + partial indexes', desc: 'The 80+ WCA stats queries lean on window functions; partial indexes let "index only the active rows" be a one-liner.' },
    },
  ],
  links: [
    { label: 'postgresql.org', href: 'https://www.postgresql.org/' },
    { label: 'PostgreSQL 13 docs', href: 'https://www.postgresql.org/docs/13/' },
  ],
};

const PG_DUMP: StackTool = {
  slug: 'pg-dump',
  name: 'pg_dump',
  version: 'nightly',
  since: '1996',
  group: 'backend',
  accent: '#4F7FAF',
  glyph: '↧',
  zh: {
    tagline: '逻辑备份, 一份文件能跨版本',
    role: '夜里 03:00 UTC 跑一次, 把 PG 整库 dump 成单文件, 落到 /root/archive/, 留 30 天。这就是本站的唯一备份。',
    intro: (
      <>
        <p>
          <code>pg_dump</code> 是 PostgreSQL 自带的逻辑备份工具, 从 1996 年开源那一刻就在树里, Tom Lane /
          Peter Eisentraut 等核心 committer 长期维护。版本跟着 server 走 —— 13.x 时代 pg_dump 也是 13.x。
        </p>
        <p>
          逻辑备份的意思:dump 出来的是 <code>CREATE TABLE</code> + <code>COPY ...</code> 语句, 而不是
          数据块 bytes。代价是慢一点;好处是跨大版本 restore 也行, schema-level / table-level 切分自然。
          物理备份 (<code>pg_basebackup</code> / Barman) 更适合 PITR + 大库, 这台小机不需要。
        </p>
      </>
    ),
    why: (
      <p>
        pg_dump 的优势是 portable、跨版本宽容、自包含一文件。<code>pg_basebackup</code> 和 Barman
        做物理 / PITR 备份, 在大数据量下赢, 但成本是配置和必须用同款 server binary 才能 restore。
        cuberoot.me 这点数据 (recon + alg + training, 全部 {'<'} 1 GB) 一份夜间逻辑 dump 完全够用 —
        意外了拉 dump 文件、<code>pg_restore</code> 即可。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          systemd timer <code>pg-dump-recon.timer</code> 每天 <strong>03:00 UTC</strong> 触发,
          调对应的 <code>.service</code> 跑 <code>pg_dump -Fc cuberoot_db -f /root/archive/...</code>。
          自定义格式 <code>-Fc</code> 压缩 + 单文件, 之后想 <code>pg_restore</code> 选择性恢复非常方便。
        </p>
        <p>
          目录里的 dump 文件按日期命名 <code>YYYY-MM-DD.dump</code>, 保留 30 天滚动删除。脚本路径
          {' '}<code>/root/bin/pg_dump_recon.sh</code>。需要的话也能 scp 到本地 docker pg13 直接
          {' '}<code>pg_restore</code>, 跟生产环境完全一致。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Logical backup, version-tolerant single file',
    role: 'Runs nightly at 03:00 UTC, dumps the whole PG database to a single file in /root/archive/, 30-day rolling retention. That\'s the site\'s only backup.',
    intro: (
      <>
        <p>
          <code>pg_dump</code> is PostgreSQL's built-in logical backup tool, in the tree since the
          1996 open-source release and long maintained by core committers like Tom Lane and Peter
          Eisentraut. Its version tracks the server it ships with — on PG 13, pg_dump is also 13.x.
        </p>
        <p>
          "Logical" means the dump contains <code>CREATE TABLE</code> + <code>COPY ...</code>{' '}
          statements, not raw data pages. It's slower, but cross-major restores work, and
          schema / table-level slicing is natural. Physical backups (<code>pg_basebackup</code>,
          Barman) are better for PITR + big DBs, but cuberoot.me's single small instance doesn't
          need that.
        </p>
      </>
    ),
    why: (
      <p>
        pg_dump's strengths are portability, cross-version tolerance, and a self-contained file.
        Physical / PITR tools (pg_basebackup, Barman) win at scale but cost setup time and require a
        matching server binary to restore. cuberoot.me's total data (recon + alg + training, all
        under ~1 GB) fits nightly logical dumps with room to spare — recovery is "grab a file, run
        pg_restore".
      </p>
    ),
    cuberoot: (
      <>
        <p>
          A systemd timer <code>pg-dump-recon.timer</code> fires daily at <strong>03:00 UTC</strong>,
          triggering a sibling <code>.service</code> that runs{' '}
          <code>pg_dump -Fc cuberoot_db -f /root/archive/...</code>. Custom format{' '}
          <code>-Fc</code> means compressed, single file, and selective <code>pg_restore</code> later
          if needed.
        </p>
        <p>
          Files are named <code>YYYY-MM-DD.dump</code> with 30-day rolling retention. The script
          lives at <code>/root/bin/pg_dump_recon.sh</code>. When debugging, the dump scp's
          straight into the local docker PG 13 for a perfect-parity <code>pg_restore</code>.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '1996',
      zh: { title: '随 PG 开源诞生', desc: 'PostgreSQL 第一个 SQL 时代版本里, pg_dump 已经是 canonical logical dumper。' },
      en: { title: 'Born with PG\'s open source', desc: 'Ships with the first SQL-era PostgreSQL releases as the canonical logical dumper.' },
    },
    {
      year: '2002',
      zh: { title: '7.x — 自定义格式 -Fc', desc: '压缩、可选择性 restore、pg_restore 能 reorder。从此 dump 不再只是 .sql 大文件。' },
      en: { title: '7.x — custom format -Fc', desc: 'Compressed, selectable, pg_restore can reorder. The dump format stops being just a giant .sql file.' },
    },
    {
      year: '2010',
      zh: { title: '9.0 directory format -Fd', desc: '一文件/张表落到磁盘, 为后面的并行 dump 铺路。' },
      en: { title: '9.0 directory format -Fd', desc: 'One file per table on disk — sets up the later parallelism work.' },
    },
    {
      year: '2013',
      zh: { title: '9.3 并行 dump -j', desc: 'Directory 模式下 -j N 并行跑, 配合 9.2 的同步快照可以同时读多个表。' },
      en: { title: '9.3 parallel dump -j', desc: 'Directory-format jobs run concurrently with 9.2\'s synchronized snapshots — multiple tables dumped in parallel.' },
    },
    {
      year: '2017+',
      zh: { title: '10/11/12 选项精细化', desc: '--include-foreign-data / --extension / --no-publications 等细粒度过滤标志陆续加上。' },
      en: { title: '10/11/12 — finer selectors', desc: 'Object-filter flags like --include-foreign-data, --extension, --no-publications keep getting added.' },
    },
    {
      year: '2025·11', highlight: true,
      zh: { title: '13.23 — PG13 EOL', desc: '2025-11-13 PG 13 进入 EOL, 13.23 是最后一个公开安全补丁。pg_dump 13.x 跟着冻结。' },
      en: { title: '13.23 — PG13 EOL', desc: '2025-11-13 marks PG 13\'s EOL; 13.23 is the final public security patch. pg_dump 13.x freezes alongside it.' },
    },
  ],
  features: [
    {
      zh: { title: '自定义格式 -Fc', desc: '压缩 + 单文件, pg_restore 可以选择性 reorder / 跳过某些对象。最常用的 production 格式。' },
      en: { title: 'Custom format -Fc', desc: 'Compressed, single file. pg_restore can reorder or skip objects on restore. The default production format.' },
    },
    {
      zh: { title: '并行 directory -Fd -j N', desc: '一表一文件 + N 并发 worker。大库提速最直接的方式。' },
      en: { title: 'Parallel directory -Fd -j N', desc: 'One file per table + N concurrent workers. The most direct speedup for big databases.' },
    },
    {
      zh: { title: '按表 / 按 schema 选择', desc: '-t / -n 让你只 dump 你要的部分。例如调试时只拉 alg_cases 一张表。' },
      en: { title: 'Per-table / per-schema selection', desc: '-t / -n let you dump only what you need. E.g. pull just the alg_cases table while debugging.' },
    },
    {
      zh: { title: 'Schema-only / data-only', desc: '-s 只 dump DDL, -a 只 dump 数据。迁移 / 重建 / 比较 schema 时各用一种。' },
      en: { title: 'Schema-only / data-only', desc: '-s dumps DDL only, -a dumps data only. Migrations, rebuilds, and schema diffs each pick one.' },
    },
  ],
  links: [
    { label: 'pg_dump · PG 13 docs', href: 'https://www.postgresql.org/docs/13/app-pgdump.html' },
    { label: 'pg_dump · current docs', href: 'https://www.postgresql.org/docs/current/app-pgdump.html' },
  ],
};

const NGINX: StackTool = {
  slug: 'nginx',
  name: 'nginx',
  version: 'mainline 1.31',
  since: '2004-10',
  group: 'edge',
  accent: '#009639',
  glyph: 'n',
  zh: {
    tagline: '事件驱动, 这台机器的总入口',
    role: '云 VM :443 上的进程。同时承担静态 SPA 服、API 反代、TLS 终止、24h proxy_cache、COOP/COEP 注入。',
    intro: (
      <>
        <p>
          nginx 是 Igor Sysoev 2002 年开始写的 web server, 2004 年公开发布。当时 Apache 用每连接
          一线程的模型, c10k 上限明显, nginx 反着来:一个 worker 里跑 event loop, 一台机扛十万级
          并发不掉链子。这套架构至今没本质变过。
        </p>
        <p>
          静态服 / 反向代理 / TLS 终止 / cache / load balance / WebSocket 透传 / HTTP/2 / HTTP/3 都在
          一个二进制里。配置语法虽然 quirky, 但表达力够覆盖 90% 的边缘需求。
        </p>
      </>
    ),
    why: (
      <p>
        Apache 灵活但 per-connection 模型在高并发下拼不过事件驱动。Caddy 自动 TLS 漂亮, 但对
        复杂的 location-level 行为 (本站的 COOP/COEP 注入 / try_files / proxy_cache 白名单)
        配置语法没 nginx 表达力强。Traefik 是 reverse proxy 不是 web server。一台单机 + 一份
        nginx config 还是这种场景的最经济解。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          云 VM 上一个 nginx 同时做四件事: <strong>1)</strong> <code>cuberoot.me</code> 服 SPA 静态,
          <code>try_files</code> 兜底 <code>index.html</code> 给 React Router;
          <strong>2)</strong> <code>api.cuberoot.me</code> 反代 <code>:3001</code>, 加 24h{' '}
          <code>proxy_cache</code> (只缓存 <code>/v1/wca/*</code> 这类只读端点);
          <strong>3)</strong> 仅在 <code>/scramble/(solver|analyzer)</code> 这两条路径上注入{' '}
          <code>COOP=same-origin</code> + <code>COEP=require-corp</code>, 让 cubeopt-wasm 能用 SharedArrayBuffer;
          <strong>4)</strong> <code>cuberoot.me/blog/</code> alias 到归档目录。
        </p>
        <p>
          vhost 配置进 git (<code>ops/nginx/www.cuberoot.me.conf</code>), GH Actions push <code>ops/nginx/**</code>
          时自动 scp + <code>nginx -t</code> + reload, 失败回滚 <code>.bak</code>。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Event-driven — the only door into this machine',
    role: 'The :443 process on the cloud VM. Serves the static SPA, reverse-proxies the API, terminates TLS, runs 24h proxy_cache, and injects COOP/COEP on demand.',
    intro: (
      <>
        <p>
          nginx is Igor Sysoev's web server, started in 2002 and publicly released in 2004. Apache at
          the time used one thread per connection — the c10k ceiling was visible. nginx flipped it:
          one worker per CPU, all running an event loop, handling 100k+ concurrent connections per
          box. The architecture has barely changed since.
        </p>
        <p>
          Static file serving, reverse proxy, TLS termination, proxy_cache, load balancing,
          WebSocket pass-through, HTTP/2 and HTTP/3 — all in one binary. The config syntax is
          quirky but expressive enough for ~90% of edge needs.
        </p>
      </>
    ),
    why: (
      <p>
        Apache is flexible but its per-connection model doesn't compete with event-driven under
        load. Caddy's auto-TLS is delightful, but its config DSL isn't as expressive as nginx's for
        complex location-level behavior (cuberoot.me's COOP/COEP injection, try_files, proxy_cache
        allowlists). Traefik is a reverse proxy, not a web server. For a single-VM "nginx config in
        git" setup, nginx remains the cheapest answer.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          One nginx on the cloud VM does four jobs: <strong>1)</strong> <code>cuberoot.me</code>{' '}
          serves the SPA static bundle with <code>try_files</code> falling back to{' '}
          <code>index.html</code> for React Router. <strong>2)</strong> <code>api.cuberoot.me</code>{' '}
          reverse-proxies <code>:3001</code> with a 24h <code>proxy_cache</code> (allowlisted to
          read-only routes like <code>/v1/wca/*</code>). <strong>3)</strong> On just two routes —
          {' '}<code>/scramble/(solver|analyzer)</code> — it injects{' '}
          <code>COOP=same-origin</code> + <code>COEP=require-corp</code> so cubeopt-wasm can use
          SharedArrayBuffer. <strong>4)</strong> <code>cuberoot.me/blog/</code> aliases to the
          static archive directory.
        </p>
        <p>
          The vhost config lives in git (<code>ops/nginx/www.cuberoot.me.conf</code>); a GH Actions
          workflow scp's it on push to <code>ops/nginx/**</code>, runs <code>nginx -t</code> +
          reload, and rolls back to <code>.bak</code> on failure.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2004·10',
      zh: { title: '公开发布', desc: 'Igor Sysoev 把 nginx 开源, 主打事件驱动 worker 模型解决 c10k。Rambler 用作生产服务器。' },
      en: { title: 'Public release', desc: 'Igor Sysoev open-sources nginx with an event-driven worker model targeting the c10k problem. Rambler.ru runs it in production.' },
    },
    {
      year: '2011',
      zh: { title: 'NGINX, Inc.', desc: 'Sysoev 与合伙人成立公司, 开源核心继续免费, 商业版 NGINX Plus 并行存在。' },
      en: { title: 'NGINX, Inc.', desc: 'Sysoev and partners form a company; the open-source core stays free, NGINX Plus runs alongside as the commercial line.' },
    },
    {
      year: '2019',
      zh: { title: 'F5 收购', desc: 'F5 Networks 6.7 亿美元收购 NGINX, Inc., 开源治理整合到 F5 内部。' },
      en: { title: 'Acquired by F5', desc: 'F5 Networks acquires NGINX, Inc. for $670M; open-source governance folds into F5.' },
    },
    {
      year: '2023·05',
      zh: { title: 'HTTP/3 + QUIC', desc: '1.25 主线加 QUIC 支持。从 patch set 走到树内。' },
      en: { title: 'HTTP/3 + QUIC', desc: '1.25 mainline adds QUIC support — moves from a patch set into the tree.' },
    },
    {
      year: '2024·02', highlight: true,
      zh: { title: 'freenginx 分叉', desc: '长期维护者 Maxim Dounin 离开 F5, 起 freenginx 分支, 不再接受 F5 控制的安全标准。两条线并行。' },
      en: { title: 'freenginx fork', desc: 'Longtime maintainer Maxim Dounin leaves F5 and forks freenginx, rejecting F5\'s control over security policy. Two parallel lines.' },
    },
    {
      year: '2025-26',
      zh: { title: '主线持续推进', desc: '1.27 / 1.28 主线继续推, njs / dynamic module / HTTP/3 完善, 仍是 web 上跑得最多的 server 之一。' },
      en: { title: 'Mainline keeps shipping', desc: '1.27 / 1.28 mainline continues — njs, dynamic modules, HTTP/3 polish. Still one of the most-deployed web servers on the public internet.' },
    },
  ],
  features: [
    {
      zh: { title: '事件驱动 worker', desc: '每 CPU 一个 worker, 内部跑 epoll/kqueue, 一台机扛十万级并发。内存常驻几十 MB。' },
      en: { title: 'Event-driven worker', desc: 'One worker per CPU, each running epoll/kqueue. 100k+ concurrent connections per box; resident memory in the tens of MB.' },
    },
    {
      zh: { title: '反向代理 + 负载均衡', desc: 'upstream block + proxy_pass。upstream 内可以 round-robin / least_conn / ip_hash, keepalive 复用后端连接。' },
      en: { title: 'Reverse proxy + load balancing', desc: 'upstream + proxy_pass. Round-robin / least_conn / ip_hash inside upstream blocks; keepalive reuses backend connections.' },
    },
    {
      zh: { title: 'proxy_cache + stale', desc: '本地磁盘 / tmpfs 缓存上游响应, proxy_cache_use_stale 让上游挂掉时继续返回旧数据。本站给 WCA stats 加了 24h cache。' },
      en: { title: 'proxy_cache + stale', desc: 'Caches upstream responses to disk or tmpfs; proxy_cache_use_stale serves stale on upstream failure. cuberoot.me uses a 24h cache for WCA stats.' },
    },
    {
      zh: { title: '静态服 + try_files', desc: 'try_files $uri $uri/ /index.html 一行就完成 SPA fallback。 root + sendfile + open_file_cache 让静态文件单机吞吐很容易拉满。' },
      en: { title: 'Static serving + try_files', desc: 'try_files $uri $uri/ /index.html nails SPA fallback in one line. root + sendfile + open_file_cache trivially saturate disk throughput.' },
    },
  ],
  links: [
    { label: 'nginx.org', href: 'https://nginx.org' },
    { label: 'GitHub mirror · nginx/nginx', href: 'https://github.com/nginx/nginx' },
    { label: 'freenginx.org', href: 'https://freenginx.org' },
  ],
};

const CLOUDFLARE_DNS: StackTool = {
  slug: 'cloudflare-dns',
  name: 'Cloudflare DNS',
  version: 'authoritative',
  since: '2009-09',
  group: 'edge',
  accent: '#F38020',
  glyph: 'CF',
  zh: {
    tagline: '免费 anycast 权威 DNS',
    role: 'cuberoot.me 这个域的权威 NS。A / AAAA 记录把流量指向云 VM, 不开代理 (灰云), 只用 DNS 这一层。',
    intro: (
      <>
        <p>
          Cloudflare 2009 年 9 月成立 (Matthew Prince / Lee Holloway / Michelle Zatlyn),
          权威 DNS 一直是基础产品之一 —— 跟 2018 年和 APNIC 一起做的公共递归解析器
          {' '}<code>1.1.1.1</code> 是两个不同东西, 容易混。这里说的是 <strong>authoritative DNS</strong>:
          你把 NS 指过去, 它替你的域回应世界。
        </p>
        <p>
          特点是免费层就给真正的 anycast (现在 330+ PoP)、完整 API、DNSSEC 一键、CAA 直接编辑。
          Free 计划 2024-09 后新建 zone 限 200 条记录, 旧 zone 仍 1000, 对个人项目完全够。
        </p>
      </>
    ),
    why: (
      <p>
        AWS Route 53 按 zone 和 query 计费, 业余项目嫌麻烦。自建 BIND 在自家 VM 上, 那 DNS 跟 VM
        共生共死, 失去了 "DNS 应在 origin 之外" 的初衷。注册商自带 DNS (GoDaddy / Namecheap)
        没像样 API、anycast 差。Cloudflare 给 anycast、API、DNSSEC, 零成本, 还能选 "只做权威 DNS,
        不走代理" (grey cloud), 不被它的 WAF / 缓存策略夹在中间。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          <code>cuberoot.me</code> 整个 zone 托管在 Cloudflare DNS。所有记录都是 grey cloud (灰云,
          authoritative-only, no proxy):<code>A cuberoot.me → VM IP</code>、
          {' '}<code>A api.cuberoot.me → VM IP</code>、<code>A blog.cuberoot.me → VM IP</code>,
          MX / TXT / CAA 也都通过它管。
        </p>
        <p>
          Let's Encrypt 的 DNS-01 challenge 通过 Cloudflare API 自动写 <code>_acme-challenge</code>
          {' '}TXT 记录, acme.sh 调 <code>dns_cf</code> 插件搞定。整个 cert 链路里 Cloudflare 只露脸
          在写 TXT 那一步 —— 流量永远直连 cuberoot.me 这台 VM, 不绕境外 edge。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Free anycast authoritative DNS',
    role: 'Authoritative NS for the cuberoot.me zone. A / AAAA records point at the cloud VM. Grey-cloud only — no proxy, DNS layer only.',
    intro: (
      <>
        <p>
          Cloudflare was founded 2009-09 by Matthew Prince, Lee Holloway, and Michelle Zatlyn.
          Authoritative DNS has been a core product since day one — not to be confused with the{' '}
          <code>1.1.1.1</code> public recursive resolver launched 2018 with APNIC (different
          product). What's referenced here is <strong>authoritative DNS</strong>: point your NS at
          them, and they answer for your zone worldwide.
        </p>
        <p>
          The pitch is genuine anycast on the free tier (330+ PoPs as of 2026), a complete REST API,
          one-click DNSSEC, and direct CAA editing. The free plan capped new zones at 200 records
          after 2024-09 (legacy zones keep 1,000) — plenty for a personal project.
        </p>
      </>
    ),
    why: (
      <p>
        AWS Route 53 charges per zone and per query — fine at scale, friction for a hobby zone.
        Running BIND on your own VM defeats the point of "DNS should outlive the origin." Registrar
        DNS (GoDaddy, Namecheap) lacks a real API and has weak anycast. Cloudflare gives anycast,
        an API, and DNSSEC at zero cost — and you can pick grey-cloud (authoritative-only) and
        bypass their WAF / cache layer entirely.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          The full <code>cuberoot.me</code> zone is hosted on Cloudflare DNS. Every record is
          grey-cloud (authoritative only, no proxy): <code>A cuberoot.me → VM IP</code>,{' '}
          <code>A api.cuberoot.me → VM IP</code>, <code>A blog.cuberoot.me → VM IP</code>, with MX /
          TXT / CAA managed the same way.
        </p>
        <p>
          Let's Encrypt's DNS-01 challenge runs through the Cloudflare API to write{' '}
          <code>_acme-challenge</code> TXT records — acme.sh's <code>dns_cf</code> plugin handles
          it. Cloudflare's only role in the cert chain is that one TXT write; live traffic always
          flows directly from clients to the cuberoot.me VM, never through their edge.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2009·09',
      zh: { title: '公司成立', desc: 'Matthew Prince / Lee Holloway / Michelle Zatlyn 在 TechCrunch Disrupt 发布, 主打 DNS + 反向代理在一个小 anycast 网上。' },
      en: { title: 'Company founded', desc: 'Matthew Prince / Lee Holloway / Michelle Zatlyn launch at TechCrunch Disrupt, offering DNS + reverse proxy on a small anycast network.' },
    },
    {
      year: '2014',
      zh: { title: 'Universal SSL', desc: '所有客户 (包括免费层) 在 edge 自动拿到 TLS。HTTPS 普及率历史性拐点之一。' },
      en: { title: 'Universal SSL', desc: 'Free TLS at the edge for every customer, including the free tier — one of the historical inflection points in global HTTPS adoption.' },
    },
    {
      year: '2018·04·01',
      zh: { title: '1.1.1.1 公共解析器', desc: '愚人节那天发布, 跟 APNIC 联合, 主打 DoH / DoT + 隐私承诺。与权威 DNS 业务并行。' },
      en: { title: '1.1.1.1 resolver', desc: 'Launched on April 1st in partnership with APNIC; focused on DoH / DoT and a privacy commitment. Runs in parallel to the authoritative DNS business.' },
    },
    {
      year: '2019',
      zh: { title: 'IPO', desc: '纽交所上市 (NET), 之后大规模扩 anycast 网点和产品线。' },
      en: { title: 'IPO', desc: 'Lists on NYSE as NET; massive anycast buildout and product expansion follow.' },
    },
    {
      year: '2024·09',
      zh: { title: '免费 zone 记录上限调整', desc: '新建 free zone 限 200 条记录 (老 zone 仍 1000)。zone 数量不限。' },
      en: { title: 'Free-tier record cap', desc: 'New free zones capped at 200 DNS records (legacy zones keep 1,000). Zone count remains unlimited.' },
    },
    {
      year: '2026', highlight: true,
      zh: { title: 'anycast 330+ PoP', desc: '权威 DNS / 1.1.1.1 当前覆盖。1.1.1.1 一天解析 ~4.3 万亿次查询 (2025 Q 报告)。API 仍对 free zone 完全免费、无次数限制。' },
      en: { title: 'Anycast at 330+ PoPs', desc: 'Current footprint of both authoritative DNS and 1.1.1.1. The resolver answers ~4.3T queries/day per 2025 reporting. API stays free + unmetered on free zones.' },
    },
  ],
  features: [
    {
      zh: { title: 'Anycast NS', desc: 'NS 在每个 PoP 应答, 解析延迟全球都接近本地。免费层就用同一张网, 不是降级版。' },
      en: { title: 'Anycast NS', desc: 'Nameservers answer from the nearest PoP worldwide; resolution latency is near-local everywhere. The free tier rides the same network — not a downgraded copy.' },
    },
    {
      zh: { title: '免费 + 无限 zone', desc: 'free plan 可以建任意多 zone, 单 zone 限 200 条记录。个人项目 / 多域名管理足够。' },
      en: { title: 'Free + unlimited zones', desc: 'Free plan allows any number of zones; one zone is capped at 200 records. Plenty for personal projects or multi-domain management.' },
    },
    {
      zh: { title: 'DNSSEC 一键', desc: 'Dashboard 一个开关启用 DNSSEC, 自动管 KSK / ZSK 轮换。注册商那边粘一行 DS 记录就完。' },
      en: { title: 'One-click DNSSEC', desc: 'Toggle DNSSEC in the dashboard; KSK / ZSK rotation handled for you. Paste one DS record at the registrar and you\'re done.' },
    },
    {
      zh: { title: 'REST API + Terraform', desc: '每条记录都有 API 端点, 配合 Terraform provider 可以纯 GitOps 管 DNS。acme.sh dns_cf 插件就用这套 API 写 TXT。' },
      en: { title: 'REST API + Terraform', desc: 'Every record has an API endpoint; combined with the Terraform provider you can manage DNS as code. acme.sh\'s dns_cf plugin uses this API to write TXT challenges.' },
    },
  ],
  links: [
    { label: 'Cloudflare DNS · product page', href: 'https://www.cloudflare.com/application-services/products/dns/' },
    { label: 'DNS developer docs', href: 'https://developers.cloudflare.com/dns/' },
    { label: '1.1.1.1', href: 'https://1.1.1.1/' },
  ],
};

const LETSENCRYPT: StackTool = {
  slug: 'lets-encrypt',
  name: 'Let’s Encrypt',
  version: 'ACME v2',
  since: '2015-12',
  group: 'edge',
  accent: '#3777BE',
  glyph: 'LE',
  zh: {
    tagline: '免费 + 自动化 + 全球受信',
    role: '签 cuberoot.me / api.cuberoot.me / blog.cuberoot.me 三张证书。acme.sh + DNS-01 自动续, 系统 timer 守着到期日。',
    intro: (
      <>
        <p>
          Let's Encrypt 是 ISRG (Internet Security Research Group) 运营的免费证书颁发机构,
          创始团队来自 Mozilla / EFF / 密歇根大学等。2015-12-03 公开 beta, 2016-04-12 正式 GA。
          目标只有一个:让 HTTPS 没有金钱和操作成本两条门槛。
        </p>
        <p>
          技术核心是 ACME 协议 (RFC 8555, v2 起标准化), 一个客户端 → CA 的全自动握手协议:
          建账号、申请域、过 challenge、签发、续期。证书默认 90 天, 强制你每两个月自动跑一次,
          反向逼出 "automate or die" 的 DevOps 文化。
        </p>
      </>
    ),
    why: (
      <p>
        付费 CA (DigiCert / Sectigo) 一张证书 50-200 美元 / 年, 还要手动续 — ACME 全部自动化之后
        意义不大。ZeroSSL 也支持 ACME 但免费 tier 限 3 张、续期不全自动。自签证书任何非 curl
        客户端都拒。Let's Encrypt 是唯一一个 <strong>免费 + 自动化 + 全球受信 + 每天签千万张实战
        过</strong> 的选项。DNS-01 + acme.sh 让通配符 + 多子域一根 systemd timer 全包。
      </p>
    ),
    cuberoot: (
      <>
        <p>
          云 VM 上跑 acme.sh, 用 <code>dns_cf</code> 插件经 Cloudflare API 过 DNS-01 challenge,
          一次签下三张证书:<code>cuberoot.me</code> / <code>api.cuberoot.me</code> /
          {' '}<code>blog.cuberoot.me</code>。每张都是单 SAN, 不用通配符。
        </p>
        <p>
          续期由 systemd timer 每天检查一次, 离到期 30 天内自动续, 续完 reload nginx。整个流程不需要
          80 端口对外开 (DNS-01 在 DNS 那一层完成),也不需要停服务。证书路径
          {' '}<code>/etc/letsencrypt/live/&lt;domain&gt;/</code> nginx 直接引用。
        </p>
      </>
    ),
  },
  en: {
    tagline: 'Free, automated, globally trusted',
    role: 'Issues certs for cuberoot.me / api.cuberoot.me / blog.cuberoot.me. acme.sh + DNS-01, renewed automatically by a systemd timer.',
    intro: (
      <>
        <p>
          Let's Encrypt is the free CA run by ISRG (Internet Security Research Group). The founding
          team came from Mozilla, EFF, the University of Michigan, and elsewhere. Public beta on
          2015-12-03, GA on 2016-04-12. Single goal: take both the money and the operational
          friction out of HTTPS.
        </p>
        <p>
          The technical core is ACME (RFC 8555, standardized at v2): a fully automated client → CA
          handshake — register, request domains, pass a challenge, issue, renew. Default cert
          lifetime is 90 days, which forces an automated renewal every two months — quietly
          producing the "automate or die" devops culture HTTPS needed.
        </p>
      </>
    ),
    why: (
      <p>
        Paid CAs (DigiCert / Sectigo) charge $50–$200/yr per cert and still expect manual renewal —
        pointless once ACME automates rotation. ZeroSSL speaks ACME too but free tier caps at 3
        certs and renewals aren't fully automated without a paid plan. Self-signed certs fail any
        non-curl client. Let's Encrypt is the only option that's <strong>free, automated,
        ubiquitously trusted, and battle-tested at &gt;10M certs/day</strong>. DNS-01 + acme.sh
        covers wildcards and a subdomain fleet from a single systemd timer.
      </p>
    ),
    cuberoot: (
      <>
        <p>
          acme.sh runs on the cloud VM. The <code>dns_cf</code> plugin drives the DNS-01 challenge
          through the Cloudflare API, issuing three certs in one shot: <code>cuberoot.me</code>,{' '}
          <code>api.cuberoot.me</code>, and <code>blog.cuberoot.me</code> — each single-SAN, no
          wildcard required.
        </p>
        <p>
          A systemd timer checks daily for renewals; anything within 30 days of expiry is renewed
          and nginx reloads. The flow doesn't require port 80 open (DNS-01 happens at the DNS
          layer), nor any service downtime. Certs land in{' '}
          <code>/etc/letsencrypt/live/&lt;domain&gt;/</code> and nginx reads them directly.
        </p>
      </>
    ),
  },
  history: [
    {
      year: '2014',
      zh: { title: 'ISRG 成立', desc: '非营利组织成立, 目标:运营一个免费、自动化的 CA。Mozilla / EFF / 密歇根大学等组成创始团队。' },
      en: { title: 'ISRG founded', desc: 'A nonprofit forms with one goal: run a free, automated CA. Mozilla, EFF, University of Michigan and others on the founding team.' },
    },
    {
      year: '2015·12',
      zh: { title: 'Public beta', desc: '12 月 3 日开放公开 beta, 第一批公网受信证书签发。改变 HTTPS 的成本曲线。' },
      en: { title: 'Public beta', desc: 'December 3rd: the first publicly trusted certificates issued. The cost curve of HTTPS bends.' },
    },
    {
      year: '2018·03',
      zh: { title: 'ACME v2 + 通配符', desc: '协议标准化 (后来定为 RFC 8555), 通配符证书通过 DNS-01 challenge 上线。' },
      en: { title: 'ACME v2 + wildcards', desc: 'Protocol standardized (later RFC 8555); wildcard certs land via DNS-01 challenge.' },
    },
    {
      year: '2020·02',
      zh: { title: '十亿张累积', desc: 'GA 后 4 年, 累计签发证书超过 10 亿张。' },
      en: { title: 'One billion certs', desc: 'Four years post-GA, cumulative issuance crosses one billion.' },
    },
    {
      year: '2025·02',
      zh: { title: '6 天短证书 + IP SAN', desc: 'Short-lived 6-day cert + IP-address SAN profile 开始对早期接入者开放。' },
      en: { title: 'Six-day certs + IP SANs', desc: 'A short-lived 6-day profile + IP-address SAN support roll out to early adopters.' },
    },
    {
      year: '2025·12', highlight: true,
      zh: { title: '十周年 + 默认证书寿命 90 → 45', desc: '十周年路线图:默认证书寿命计划从 90 天降到 45 天, 短证书 (6 天) 进入 GA 通道。Q1 2026 公网占比 54.4%, 日签 ~1000 万张。' },
      en: { title: '10 years + default 90 → 45', desc: 'Anniversary roadmap: default cert lifetime moving from 90 → 45 days; the 6-day short-lived profile heading to GA. Q1 2026 share of public-web issuance: 54.4%, ~10M certs/day.' },
    },
  ],
  features: [
    {
      zh: { title: '90 天默认 (45 在路上)', desc: '默认证书寿命 90 天, 路线图降到 45。短寿命逼自动化, 同时压缩泄露窗口。' },
      en: { title: '90-day default (45 on the way)', desc: 'Default lifetime is 90 days, with a roadmap to 45. Short lifetimes force automation and shrink the exposure window.' },
    },
    {
      zh: { title: 'ACME 自动化', desc: 'certbot / acme.sh / lego / Caddy 都讲 ACME。一行 cron / systemd timer 就够。' },
      en: { title: 'ACME automation', desc: 'certbot / acme.sh / lego / Caddy all speak ACME. A single cron or systemd timer does the renewal.' },
    },
    {
      zh: { title: '通配符 via DNS-01', desc: '*.example.com 类证书必须走 DNS-01, 在 DNS 提供商 (这里是 Cloudflare) 写 TXT。不需要对外开 80。' },
      en: { title: 'Wildcards via DNS-01', desc: 'Wildcard certs require DNS-01 — write a TXT record at your DNS provider (Cloudflare here). No port 80 exposure needed.' },
    },
    {
      zh: { title: '免费、不限规模', desc: '不分商业 / 个人 / 大流量。靠赞助方资助 (Mozilla / Cisco / Akamai / OVH / AWS / Google 等)。' },
      en: { title: 'Free at any scale', desc: 'No business / personal / volume tiers. Funded by sponsors (Mozilla / Cisco / Akamai / OVH / AWS / Google and others).' },
    },
  ],
  links: [
    { label: 'letsencrypt.org', href: 'https://letsencrypt.org/' },
    { label: 'RFC 8555 · ACME', href: 'https://datatracker.ietf.org/doc/html/rfc8555' },
    { label: '90 → 45 day announcement', href: 'https://letsencrypt.org/2025/12/02/from-90-to-45' },
  ],
};

export const STACK_TOOLS: StackTool[] = [
  REACT,
  VITE,
  HONO,
  NODE,
  PM2,
  POSTGRES,
  PG_DUMP,
  NGINX,
  CLOUDFLARE_DNS,
  LETSENCRYPT,
];
