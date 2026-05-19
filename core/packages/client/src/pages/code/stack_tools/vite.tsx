import type { StackTool } from '../stack_tool_types';
import { k, v, s, n, f, p, c } from '../stack_tool_types';

// ─── Vite 8 ─────────────────────────────────────────────────────────────────

export const VITE: StackTool = {
  slug: 'vite',
  name: 'Vite',
  version: '8.0',
  since: '2020-04',
  group: 'frontend',
  accent: '#646CFF',
  bright: '#8A8FFF',
  glyph: '⚡',
  floats: ['ESM', 'HMR', 'Rolldown', 'Rollup', 'esbuild', 'dev', 'build', 'plugin', 'import.meta', 'pre-bundle', 'SSR', 'lib'],
  zh: {
    tagline: '原生 ESM dev server + Rolldown 生产打包',
    role: '本站前端的开发服务器 + 生产打包器。dev 起 1s 内, build 出 80 个 hashed chunks。',
    heroSub: <>把"打包"这件事拆成两段:dev 不打包, 直接喂浏览器的原生 ESM, 改一行 100ms 内热替换;build 时才认真过一遍, 8.0 起这一遍由 Rust 写的 Rolldown 跑完。Evan You 2020 年顺手做出来的副产品, 六年后已经吃掉了 webpack 的半壁江山。</>,
    whatDesc: <>Vite 不是一个新的打包器, 它是<strong>两个打包器的拼装</strong>: dev 走原生 ESM + esbuild 预打包依赖, build 走 Rollup (Vite 8 起换成 Rolldown)。这个分裂在 2020 年看起来怪, 但它换来 webpack 时代不可想象的体验:开发起步 0.3s, 改文件到看见效果 100ms。</>,
    historyDesc: <>从 2020 年 4 月 Evan You 在做 Vue 3 时顺手抛出的 ESM dev server, 到 2026 年 Vite 8 用 Rolldown 把 dev / build 统一成一个 Rust 工具链, 六年。中间换了一次内核 (从 Vue-only 到框架无关)、换了一次范式 (esbuild → Rolldown), 用户基本没感觉到迁移成本 —— 这是它能赢的关键。</>,
    conceptsTitle: 'dev / build / plugin 三件套',
    conceptsDesc: <>API 表面比 webpack 小一个量级:一份 <code>vite.config.ts</code>, 一组 plugin hook (沿用 Rollup), 几个 <code>import.meta</code> 字段。剩下的都是这些原子的组合。</>,
    whyDesc: <>2026 年还要选打包器, Rolldown 内核 + 兼容 Rollup 插件 + sub-1s 冷启动三件凑齐的只有 Vite 一家。Webpack 在 CommonJS 边缘和插件深度上仍占优, Turbopack 跟 Next 绑死。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Vue / Svelte / Solid 三家创始人都把 Vite 当默认 build tool。Remix 2024 年从自己的 esbuild 方案切到 Vite, Storybook 9 默认 Vite。生态从框架蔓延到框架的工具链。</>,
    cuberootDesc: <>本站整个 SPA 跑在 Vite 8 上, dev server 写死 <code>127.0.0.1:5173</code> (Windows Chrome 默认 IPv6 打不开)。<code>serveRepoRoot</code> 自定义插件大约 30 行, dev 时把仓库根的 <code>/tools/</code> 和 <code>/stats/</code> 也 serve 出来。生产 build 由 Rolldown 出 ~80 个 hashed chunks, GH Actions rsync 到 nginx root。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>2025 年 VoidZero (a.k.a. Vite+) 公司成立, 把 Vite / Rolldown / Oxc / Oxlint 整成一家。Vite 8 是这条路线的第一个 GA 节点;接下来 Oxlint 替 ESLint、Rolldown 替 Rollup、Oxc 替 Babel 在 2026~2027 逐步发生。</>,
  },
  en: {
    tagline: 'Native ESM dev server + Rolldown production build',
    role: 'Dev server + production bundler for the SPA. Cold start under 1s; build emits ~80 hashed chunks.',
    heroSub: <>Split "bundling" into two halves: in dev, skip the bundler — feed the browser native ESM directly, hot-replace a single file in under 100ms; at build time, do the proper pass — and from Vite 8 that pass runs on Rolldown, written in Rust. A side project Evan You shipped in 2020 while building Vue 3; six years later it owns half of webpack's territory.</>,
    whatDesc: <>Vite isn't a new bundler — it's <strong>two bundlers stitched together</strong>: dev runs native ESM + esbuild dep pre-bundling, build runs Rollup (Rolldown from Vite 8). The split looked weird in 2020 but it bought experience webpack could never reach: 0.3s dev startup, 100ms edit-to-paint.</>,
    historyDesc: <>From an ESM dev server Evan You shipped on the side while building Vue 3 in April 2020, to Vite 8 in 2026 fusing dev + build into one Rust toolchain via Rolldown, six years. One core swap (Vue-only → framework-agnostic), one bundler swap (esbuild → Rolldown), and users barely felt either migration. That painless evolution is the whole story.</>,
    conceptsTitle: 'dev / build / plugin trio',
    conceptsDesc: <>API surface is an order of magnitude smaller than webpack's: one <code>vite.config.ts</code>, a Rollup-compatible plugin hook set, a handful of <code>import.meta</code> fields. Everything else is composition.</>,
    whyDesc: <>Picking a bundler in 2026, only Vite has all three: Rust core (Rolldown), Rollup-compatible plugin API, sub-1s cold start. Webpack still wins on CommonJS edges and plugin catalog depth; Turbopack is welded to Next.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>The Vue / Svelte / Solid creators all default to Vite as their build tool. Remix switched from its own esbuild setup to Vite in 2024; Storybook 9 defaults to Vite. The adoption spread from frameworks into the tooling around them.</>,
    cuberootDesc: <>The whole SPA runs on Vite 8. The dev server is pinned to <code>127.0.0.1:5173</code> (Windows Chrome won't open the default IPv6 bind). A ~30-line <code>serveRepoRoot</code> custom plugin serves the repo's <code>/tools/</code> and <code>/stats/</code> in dev. Production build emits ~80 hashed chunks via Rolldown; GH Actions rsync the output to nginx root.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>VoidZero (a.k.a. Vite+) was incorporated in 2025, folding Vite / Rolldown / Oxc / Oxlint under one roof. Vite 8 is the first GA waypoint on that roadmap; Oxlint replacing ESLint, Rolldown replacing Rollup, Oxc replacing Babel are the next 2026–2027 steps.</>,
  },
  heroStats: [
    { num: '8', unit: '.0', zh: <>当前稳定版 <em>2026-05 · 8.0.13</em></>, en: <>current stable <em>2026-05 · 8.0.13</em></> },
    { num: '0.3', unit: 's', zh: <>冷启动到能交互 <em>本站 SPA 实测</em></>, en: <>cold start to interactive <em>this SPA, measured</em></> },
    { num: '10', unit: '×', zh: <>生产 build 提速 (vs Vite 7) <em>Linear 报告</em></>, en: <>faster production builds vs Vite 7 <em>Linear report</em></> },
    { num: '6', unit: 'y', zh: <>从 2020 至今 <em>已成默认选择</em></>, en: <>since 2020 <em>now the default</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Vite 是 Evan You 2020 年 4 月 20 日发布的副产品。当时他在写 Vue 3, 自己跑 webpack-dev-server 的体感受不了 —— 项目稍微大一点冷启动就 30 秒, 改一行文件 HMR 走 2 秒。他抛出一个朴素的想法:"既然现代浏览器都支持原生 ESM, 那 dev 阶段干脆不打包, 让浏览器自己 import 不就好了?" 第三方依赖太碎太多, 用 Go 写的 esbuild 预扫一遍打成单文件即可。</p>
        <p>2021 年 2 月 Vite 2 把整个内核重写, 从 Vue-only 变成框架无关 —— React / Svelte / Lit / Preact 各自的 starter 都进了官方仓库, 插件 API 沿用 Rollup 这一手让生态门槛瞬间归零。这一刻 Vite 才真正成为通用工具。</p>
        <p>2024 年 5 月 ViteConf 宣布 Rolldown —— 一个 Rust 写的、Rollup-兼容 API 的下一代打包器, 长期替换 esbuild + Rollup 这两个 dev/prod 分裂的依赖。2026 年 3 月 Vite 8 GA, Rolldown 第一次成为 dev + build 都用的统一内核: dev 启动快 3 倍, 生产 build Linear 报告 46s → 6s。这是 Vite 第一次"不只是快, 而是甩开"。</p>
      </>
    ),
    en: (
      <>
        <p>Vite started as a side project Evan You shipped on 2020-04-20. He was building Vue 3 at the time and his own webpack-dev-server experience was painful — anything non-trivial took 30s to cold-start, and HMR took 2s per edit. He proposed something blunt: "Modern browsers ship native ESM, so in dev just don't bundle — let the browser import directly." Third-party deps are too fragmented, so a single esbuild (Go) pre-pass pre-bundles them.</p>
        <p>February 2021's Vite 2 rewrote the core: Vue-only → framework-agnostic. React / Svelte / Lit / Preact starters all landed in the official monorepo, and choosing to reuse Rollup's plugin API dropped the ecosystem barrier to zero. That release made Vite a general tool.</p>
        <p>May 2024 ViteConf announced Rolldown — a Rust, Rollup-API-compatible next-gen bundler meant to replace the esbuild + Rollup split for good. March 2026 Vite 8 GA shipped: Rolldown is the single core for dev and build; cold start is 3× faster and Linear reported their production build going 46s → 6s. The first time Vite went from "fast" to "not in the same league."</p>
      </>
    ),
  },
  history: [
    { year: '2020·04', zh: { title: <>0.x 首发</>, desc: <>4 月 20 日 Evan You 在 GitHub 公开 Vite 0.1, 当时只服务 Vue 3 单文件组件, 大约 1000 行代码。Twitter 上小范围讨论, 还没人意识到它会替代 webpack。</> }, en: { title: <>0.x first release</>, desc: <>April 20: Evan You publishes Vite 0.1 on GitHub — Vue 3 SFC only, ~1000 lines of code. A small Twitter discussion; nobody guesses it will displace webpack.</> } },
    { year: '2021·02', zh: { title: <>Vite 2 — 框架无关</>, desc: <>2 月 Vite 2 重写, 把内核与 Vue 解耦, 插件 API 直接复用 Rollup。React / Svelte / Lit / Preact / vanilla 五份 starter 同时进仓。</> }, en: { title: <>Vite 2 — framework-agnostic</>, desc: <>Vite 2 rewrites the core, decouples it from Vue, and reuses Rollup's plugin API verbatim. React / Svelte / Lit / Preact / vanilla starters all land at once.</> } },
    { year: '2022·07', zh: { title: <>Vite 3 — Node 14+</>, desc: <>Node 14 最低线, 新文档站, 默认 dev port 5173。这是 Vite 第一次进 "非 Next 的 React 新项目默认选择" 视野。</> }, en: { title: <>Vite 3 — Node 14+</>, desc: <>Node 14 baseline, new docs site, default dev port 5173. The first version where "new React project, not on Next" defaults to Vite.</> } },
    { year: '2023·12', zh: { title: <>Vite 5 — Vitest 1.0 同期</>, desc: <>Node 18+ 基线, env-mode hooks 定稿。Vitest 1.0 同日 GA, "Vite + Vitest" 单元测试栈被生态全面接受。</> }, en: { title: <>Vite 5 — alongside Vitest 1.0</>, desc: <>Node 18+ baseline, env-mode hooks finalized. Vitest 1.0 GA's the same day; "Vite + Vitest" becomes the accepted unit-test stack.</> } },
    { year: '2024·05', zh: { title: <>ViteConf — Rolldown 宣布</>, desc: <>Evan You 在 ViteConf 公布 Rolldown:Rust 写、Rollup 兼容、目标是统一 dev + build。"Vite 长期不再依赖 esbuild + Rollup" 这条路线第一次摊牌。</> }, en: { title: <>ViteConf — Rolldown announced</>, desc: <>At ViteConf, Evan You announces Rolldown: a Rust bundler with a Rollup-compatible API, aimed at unifying dev + build. Vite's long-term path off esbuild + Rollup is publicly laid out for the first time.</> } },
    { year: '2025·06', zh: { title: <>VoidZero / Vite+ 公司成立</>, desc: <>把 Vite、Rolldown、Oxc、Oxlint 几个独立项目合并到一个商业实体, 拿到一轮融资。Evan You 转任 CEO, 工具链整合从社区合作升级为公司产品。</> }, en: { title: <>VoidZero / Vite+ incorporated</>, desc: <>Vite, Rolldown, Oxc, and Oxlint consolidate under a single company; first funding round closes. Evan You becomes CEO. Toolchain consolidation upgrades from community collaboration to a product roadmap.</> } },
    { year: '2026·03', highlight: true, zh: { title: <>Vite 8 GA — Rolldown 上线</>, desc: <>3 月 12 日 8.0.0 GA。Rolldown 成为 dev + build 的统一内核, dev 启动快 3 倍, 生产 build Linear 实测 46s → 6s。这是 Vite 第一次"性能甩开"webpack 一个量级。</> }, en: { title: <>Vite 8 GA — Rolldown lands</>, desc: <>March 12: 8.0.0 GA. Rolldown becomes the single core for dev and build; cold start is 3× faster; Linear reports production build 46s → 6s. First time Vite is an order of magnitude ahead of webpack.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>8.0.13 / 当前稳定</>, desc: <>2026-05 最新点 release。npm 周下载约 4500 万 (vite 包), Storybook 9 / SvelteKit / Astro / Nuxt / Remix 全部默认走它。</> }, en: { title: <>8.0.13 / current stable</>, desc: <>Latest patch as of 2026-05. ~45M weekly downloads for the vite package; Storybook 9 / SvelteKit / Astro / Nuxt / Remix all default to it.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>vite.config.ts</>, desc: <>所有配置一个文件。<code>defineConfig</code> 给出全套 TS 类型, 编辑器自动补全。</> }, en: { title: <>vite.config.ts</>, desc: <>All config in one file. <code>defineConfig</code> provides full TS types and editor autocomplete.</> }, code: <code>{k('import')} {'{ '}{v('defineConfig')} {'}'} {k('from')} {s('"vite"')};{'\n'}{k('import')} {v('react')} {k('from')} {s('"@vitejs/plugin-react"')};{'\n\n'}{k('export')} {k('default')} {f('defineConfig')}({'{'}{'\n'}  {p('plugins')}: [{f('react')}()],{'\n'}  {p('server')}: {'{ '}{p('host')}: {s('"127.0.0.1"')}, {p('port')}: {n('5173')} {'}'},{'\n'}{'}'});</code> },
    { tag: 'B', zh: { title: <>原生 ESM dev server</>, desc: <>dev 不打包, 浏览器直接 import 你的源文件。改一行 → server 推一个 HMR 消息 → 浏览器更新, 100ms 内。</> }, en: { title: <>Native ESM dev server</>, desc: <>No bundling in dev — the browser imports your source files directly. Edit one line → server pushes an HMR message → browser updates, all under 100ms.</> }, code: <code>{c('// In browser devtools, Network panel:')}{'\n'}{c('// GET /src/App.tsx  -> 200 (transformed on demand)')}{'\n'}{c('// GET /src/utils/foo.ts -> 200 (separate request)')}</code> },
    { tag: 'C', zh: { title: <>HMR — import.meta.hot</>, desc: <>模块级别的热替换接口。组件层 HMR 由 React / Vue 插件自动接管, 手写也可以。</> }, en: { title: <>HMR — import.meta.hot</>, desc: <>Module-level hot-replacement API. Component-level HMR is handled automatically by the React / Vue plugins; manual use is also fine.</> }, code: <code>{k('if')} ({v('import')}.{p('meta')}.{p('hot')}) {'{'}{'\n'}  {v('import')}.{p('meta')}.{p('hot')}.{f('accept')}(({v('mod')}) =&gt; {'{'}{'\n'}    {c('// new module is ready')}{'\n'}  {'}'});{'\n'}{'}'}</code> },
    { tag: 'D', zh: { title: <>依赖预打包</>, desc: <>node_modules 里的依赖 dev 启动时用 esbuild 一次性打成单 ESM 文件, 浏览器不用并发请求几百个 .js 小碎片。</> }, en: { title: <>Dependency pre-bundling</>, desc: <>node_modules deps are pre-bundled into single ESM files by esbuild on dev start, so the browser doesn't fan out hundreds of small .js requests.</> }, code: <code>{c('// .vite/deps/react.js          (esbuild-bundled)')}{'\n'}{c('// .vite/deps/react-dom_client.js')}{'\n'}{c('// hash-keyed; reused on next dev start')}</code> },
    { tag: 'E', zh: { title: <>Rolldown — Vite 8 内核</>, desc: <>Rust 写、API 兼容 Rollup。dev 时替 esbuild 做依赖预打包, build 时替 Rollup 出生产 chunks。一个内核覆盖两端。</> }, en: { title: <>Rolldown — Vite 8 core</>, desc: <>Rust, Rollup-compatible API. Replaces esbuild for dev dep pre-bundling and replaces Rollup for production chunks. One core, both ends.</> }, code: <code>{c('// vite.config.ts — Vite 8 default')}{'\n'}{f('defineConfig')}({'{'}{'\n'}  {p('experimental')}: {'{ '}{p('rolldownDev')}: {k('true')} {'}'},{'\n'}{'}'});</code> },
    { tag: 'F', zh: { title: <>import.meta.env</>, desc: <>编译期注入的环境变量。<code>DEV</code> / <code>PROD</code> / <code>MODE</code> 永远准, 自定义变量按 <code>VITE_</code> 前缀。</> }, en: { title: <>import.meta.env</>, desc: <>Build-time-injected env vars. <code>DEV</code> / <code>PROD</code> / <code>MODE</code> are always accurate; custom vars use the <code>VITE_</code> prefix.</> }, code: <code>{k('const')} {v('base')} = {v('import')}.{p('meta')}.{p('env')}.{p('DEV')}{'\n'}  ? {s('"http://127.0.0.1:3001"')}{'\n'}  : {s('"https://api.cuberoot.me"')};</code> },
    { tag: 'G', zh: { title: <>插件 (Rollup 接口)</>, desc: <>沿用 Rollup 插件 hook (<code>resolveId</code> / <code>load</code> / <code>transform</code>), 额外加几个 Vite 专属 (<code>configureServer</code> / <code>handleHotUpdate</code>)。</> }, en: { title: <>Plugins (Rollup hooks)</>, desc: <>Reuses Rollup's plugin hooks (<code>resolveId</code> / <code>load</code> / <code>transform</code>) plus a few Vite-specific ones (<code>configureServer</code> / <code>handleHotUpdate</code>).</> }, code: <code>{k('function')} {f('serveRepoRoot')}() {'{'}{'\n'}  {k('return')} {'{'}{'\n'}    {p('name')}: {s('"serve-repo-root"')},{'\n'}    {f('configureServer')}({v('server')}) {'{'}{'\n'}      {v('server')}.{p('middlewares')}.{f('use')}({s('"/tools"')}, {v('handler')});{'\n'}    {'}'},{'\n'}  {'}'};{'\n'}{'}'}</code> },
    { tag: 'H', zh: { title: <>library mode</>, desc: <><code>build.lib</code> 让 Vite 出库代码 (esm + cjs + d.ts), 给你 publish 一个 npm 包用。@cuberoot/visualcube 走的就是这套。</> }, en: { title: <>library mode</>, desc: <><code>build.lib</code> emits library artifacts (esm + cjs + d.ts) for npm publish. @cuberoot/visualcube uses this exact path.</> }, code: <code>{p('build')}: {'{'}{'\n'}  {p('lib')}: {'{'}{'\n'}    {p('entry')}: {s('"src/index.ts"')},{'\n'}    {p('formats')}: [{s('"es"')}, {s('"cjs"')}],{'\n'}  {'}'},{'\n'}{'}'},</code> },
  ],
  whyCards: [
    { icon: '⚡', zh: { title: <>冷启动 0.3s</>, desc: <>不打包, 浏览器原生 import 源文件。本站 100 多个组件冷启动到能交互 ~300ms, webpack 同体量项目 8~15s 起步。</> }, en: { title: <>0.3s cold start</>, desc: <>No bundling — the browser imports source files natively. This site's 100+ components cold-start to interactive in ~300ms; an equivalent webpack project starts at 8–15s.</> }, code: <>{c('// vite dev')}{'\n'}{c('// ready in 287 ms')}</> },
    { icon: '⟲', zh: { title: <>HMR 100ms</>, desc: <>组件级热替换。改一个 useState 默认值, 不刷页面、不丢路由 state, 界面立刻变。</> }, en: { title: <>100ms HMR</>, desc: <>Component-level hot replacement. Change a useState default and the UI updates without a full reload or route-state loss.</> }, code: <>{c('// edit App.tsx')}{'\n'}{c('// [vite] hmr update /src/App.tsx')}</> },
    { icon: '⌬', zh: { title: <>插件 API 沿用 Rollup</>, desc: <>Rollup 十几年沉淀的插件生态原地可用。<code>vite-plugin-pwa</code> / <code>vite-plugin-svgr</code> / <code>vite-plugin-checker</code> 一行 install。</> }, en: { title: <>Plugin API reuses Rollup</>, desc: <>A decade of Rollup plugin ecosystem works as-is. <code>vite-plugin-pwa</code> / <code>vite-plugin-svgr</code> / <code>vite-plugin-checker</code> install in one line.</> }, code: <>{k('import')} {v('pwa')} {k('from')} {s('"vite-plugin-pwa"')};</> },
    { icon: '⚙', zh: { title: <>配置近乎为零</>, desc: <>新项目 <code>npm create vite</code>, 没有任何 config 就能跑。webpack 时代 200 行 config 写下来才有同等能力, 还得加 babel + ts-loader。</> }, en: { title: <>Near-zero config</>, desc: <>A new project runs from <code>npm create vite</code> with no config at all. Webpack needed 200 lines plus babel + ts-loader for the same baseline.</> }, code: <>{c('// vite.config.ts can be empty')}{'\n'}{c('// (or just plugins: [react()])')}</> },
    { icon: '⌗', zh: { title: <>Rolldown 让 build 也快</>, desc: <>Vite 8 之前 dev 飞快但 prod build 还得过 Rollup, 大项目要 1 分钟。Rolldown 上线后 Linear 实测 46s → 6s, 同一份代码同一份配置。</> }, en: { title: <>Rolldown makes builds fast too</>, desc: <>Pre-Vite-8, dev flew but prod build still ran on Rollup; large projects took a minute. Linear reported 46s → 6s after Rolldown, same code, same config.</> }, code: <>{c('// Vite 7 build: 46s')}{'\n'}{c('// Vite 8 build:  6s')}</> },
    { icon: '⌖', zh: { title: <>TS 一等公民</>, desc: <>.ts / .tsx 直接 import 不配 ts-loader, type-check 单独跑 <code>tsc -b</code>。<code>vite.config.ts</code> 本身就是 TS, 全程类型补全。</> }, en: { title: <>First-class TS</>, desc: <>.ts / .tsx import directly, no ts-loader. Type-check runs separately via <code>tsc -b</code>. <code>vite.config.ts</code> is itself TS, fully autocompleted.</> }, code: <>{c('// no @types/* gymnastics needed')}{'\n'}{k('import')} {v('foo')} {k('from')} {s('"./foo.ts"')};</> },
    { icon: '⏚', zh: { title: <>静态 SPA 最佳拍档</>, desc: <>build 出来就是一堆 hashed JS + CSS + 资源, 直接扔 nginx / GH Pages / CDN, 不需要 Node runtime。本站部署就是这条路。</> }, en: { title: <>Best fit for static SPAs</>, desc: <>The build output is hashed JS + CSS + assets — drop it on nginx / GH Pages / a CDN, no Node runtime required. This is exactly how the site is deployed.</> }, code: <>{c('// dist/assets/*.[hash].js')}{'\n'}{c('// dist/index.html')}</> },
    { icon: '⚐', zh: { title: <>SSR / lib / SPA 同一套配置</>, desc: <>SSR mode (<code>ssr</code> entry) / library mode (<code>build.lib</code>) / 默认 SPA 都是同一份 <code>vite.config.ts</code> 的小开关, 不必换打包器。</> }, en: { title: <>SSR / lib / SPA from one config</>, desc: <>SSR mode (<code>ssr</code> entry), library mode (<code>build.lib</code>), default SPA — all toggle inside the same <code>vite.config.ts</code>, no bundler swap.</> }, code: <>{p('build')}: {'{ '}{p('ssr')}: {s('"src/server.ts"')} {'}'}</> },
  ],
  adopters: [
    { name: 'Vue 3', href: 'https://vuejs.org', highlight: true, zhNote: '创始人的项目, 默认 build tool', enNote: "Creator's own project — default build tool" },
    { name: 'SvelteKit', href: 'https://kit.svelte.dev', highlight: true, zhNote: '官方 meta-framework 直接基于 Vite', enNote: 'Official meta-framework built on Vite' },
    { name: 'Astro', href: 'https://astro.build', highlight: true, zhNote: '内容站框架, build 系统是 Vite', enNote: 'Content-site framework; build system is Vite' },
    { name: 'Nuxt 3 / 4', href: 'https://nuxt.com', zhNote: 'Vue meta-framework, dev 默认 Vite', enNote: 'Vue meta-framework, Vite by default in dev' },
    { name: 'Remix', href: 'https://remix.run', zhNote: '2024 年从自家 esbuild 方案切到 Vite', enNote: 'Switched from its own esbuild setup to Vite in 2024' },
    { name: 'SolidStart', href: 'https://start.solidjs.com', zhNote: 'Solid 官方 meta-framework', enNote: 'Solid official meta-framework' },
    { name: 'Qwik', href: 'https://qwik.dev', zhNote: 'Resumable framework, Vite-based', enNote: 'Resumable framework on Vite' },
    { name: 'Storybook 9', href: 'https://storybook.js.org', zhNote: '2025 起默认 Vite', enNote: 'Default Vite since 2025' },
    { name: 'Vitest', href: 'https://vitest.dev', zhNote: '同班子的单测框架, 共享 transform pipeline', enNote: 'Same-team test runner, shares the transform pipeline' },
    { name: 'Lit', href: 'https://lit.dev', zhNote: 'Web Components 框架, starter 是 Vite', enNote: 'Web Components framework, starter is Vite' },
    { name: 'Cloudflare Pages', href: 'https://pages.cloudflare.com', zhNote: 'Framework preset 默认 Vite', enNote: 'Framework presets default to Vite' },
    { name: 'Linear', href: 'https://linear.app', zhNote: '工程团队在 talk 里报 build 时间', enNote: 'Engineering team reports build times in talks' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 SPA + dev server + 库代码全部 Vite 8', enNote: 'This site — SPA + dev server + library code all on Vite 8' },
  ],
  outlook: [
    { tag: <>HOT · 2026-03</>, hot: true, big: true, zh: { title: <>Rolldown 统一 dev + build</>, body: <><p>Vite 8 把 dev 的 esbuild + build 的 Rollup 同时换成 Rust 写的 Rolldown。一个内核两端用, dev 启动快 3 倍, 生产 build Linear 报告 46s → 6s。</p><p>更深一层意义:Vite 这六年的核心命题是 "dev 快 / build 慢" 的分裂, 这一刻终于补上。下一个版本可以聚焦真正的功能而不是性能差距。</p></> }, en: { title: <>Rolldown unifies dev + build</>, body: <><p>Vite 8 swaps both dev's esbuild and build's Rollup for Rust-written Rolldown. One core on both ends; 3× faster cold start; Linear reports production build going 46s → 6s.</p><p>The deeper point: Vite's six-year core tension was "dev fast, build slow." That gap is finally closed. The next version can target real features instead of perf parity.</p></> } },
    { tag: 'VOIDZERO', big: true, zh: { title: <>VoidZero 整合工具链</>, body: <><p>2025 年成立的公司把 Vite、Rolldown、Oxc (Rust JS 解析器)、Oxlint (Rust ESLint 替代) 整成一家。商业实体 + 一致的 Rust 内核, 2026~2027 会看到 Oxlint 替 ESLint、Oxc 替 Babel 在 Vite 默认管线里逐步发生。</p></> }, en: { title: <>VoidZero consolidates the toolchain</>, body: <><p>The company incorporated in 2025 folds Vite, Rolldown, Oxc (Rust JS parser), and Oxlint (Rust ESLint replacement) under one roof. A commercial entity with a consistent Rust core — expect Oxlint replacing ESLint and Oxc replacing Babel inside Vite's default pipeline over 2026–2027.</p></> } },
    { tag: 'ENV', zh: { title: <>Environment API</>, body: <><p>Vite 6 引入的 Environment API 让 dev server 同时跑多个目标 (browser + worker + SSR), 共享一份模块图。框架作者 (Nuxt / SvelteKit / Remix) 终于不用各自重写 dev 内核, 直接 declare environment。</p></> }, en: { title: <>Environment API</>, body: <><p>The Environment API introduced in Vite 6 lets the dev server target multiple environments (browser + worker + SSR) over one shared module graph. Framework authors (Nuxt / SvelteKit / Remix) no longer have to reimplement the dev core — they just declare environments.</p></> } },
    { tag: 'DATA', zh: { title: <>npm 周下载 4500 万</>, body: <><p>2026-05 数据:vite 包 ~4500 万周下载, vitest ~1500 万。webpack 仍是 ~3000 万, 但增长曲线已经反转 —— 新项目 95%+ 选 Vite。</p></> }, en: { title: <>45M weekly downloads</>, body: <><p>2026-05: ~45M weekly downloads for the vite package; vitest ~15M. Webpack still sits at ~30M, but the growth curve has inverted — over 95% of new projects pick Vite.</p></> } },
    { tag: 'NODE', zh: { title: <>边界:CommonJS 大项目</>, body: <><p>纯 CommonJS、海量旧依赖、奇怪 require 写法 (动态字符串拼接、条件 require) 的老项目, Vite 仍偶尔出怪事。webpack 在这种场景的灵活度暂时还无可替代。这是 Vite 八年没解决也大概率不会解决的一类边界。</p></> }, en: { title: <>Boundary: legacy CJS monoliths</>, body: <><p>Pure-CommonJS legacy codebases with weird require usage (dynamic string concatenation, conditional require) still occasionally surprise Vite. Webpack's flexibility there remains unmatched. This boundary is eight years old and unlikely to ever fully close.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本站 SPA 从 2023 年立项就跑在 Vite 上, 没有任何替换打算。<code>vite.config.ts</code> 大约 60 行: <code>@vitejs/plugin-react</code> + 一个自写的 <code>serveRepoRoot</code> 插件 (~30 行, dev 时把仓库根的 <code>/tools/</code> 和 <code>/stats/</code> 也 serve 出来, 这样 fork 来的 upstream 静态页能在本地一起跑)。</p>
        <p>dev server 死死绑 <code>127.0.0.1:5173</code>。Vite 默认绑 <code>[::1]</code> IPv6, Windows Chrome 经常打不开, 直接在 <code>vite.config.ts</code> 写死 <code>host: '127.0.0.1'</code>。HMR 跨设备调试时 (Tailscale 隧道 / 蜂窝走 dev.cuberoot.me) <code>clientPort</code> 不写, 让客户端从页面 URL 自己推导端口 — 这是三入口 (本机 / ts.net / 隧道域名) 各自正确的唯一办法, 写死任何一个都会其他两个挂。</p>
        <p>生产 build 由 Vite 8 / Rolldown 跑完, 出 ~80 个 hashed chunks。每个 page 通过 <code>React.lazy(() =&gt; import(...))</code> 自然切独立 chunk, Rolldown 把 cubing.js / three.js / mp4box.js 等大依赖各自拆出 vendor chunk。整站首屏 JS &lt; 80KB gzip, 工具页用到了才下对应 chunk。GH Actions <code>deploy_core</code> workflow rsync <code>dist/</code> 到 nginx root, 镜像 workflow 同步 GH Pages。</p>
        <p>边角:vite worker 配置让 <code>analyzer_worker.ts</code> / <code>scramble_cstimer_worker.ts</code> 等 worker 自动走独立 chunk + classic-worker 协议。<code>import.meta.env.DEV</code> 是切 dev/prod API base 的唯一信号 (不能用 <code>hostname === 'localhost'</code>, LAN / Tailscale / 隧道都不匹配)。<code>@cuberoot/visualcube</code> 通过 <code>build.lib</code> 单独 publish。</p>
      </>
    ),
    en: (
      <>
        <p>The SPA has been on Vite since its 2023 inception, with no plans to swap. <code>vite.config.ts</code> is ~60 lines: <code>@vitejs/plugin-react</code> plus a hand-written <code>serveRepoRoot</code> plugin (~30 lines) that exposes the repo's <code>/tools/</code> and <code>/stats/</code> during dev so the upstream fork static pages run locally alongside the SPA.</p>
        <p>The dev server is hard-pinned to <code>127.0.0.1:5173</code>. Vite's default <code>[::1]</code> IPv6 bind often refuses Windows Chrome connections, so <code>host: '127.0.0.1'</code> is fixed in <code>vite.config.ts</code>. For cross-device HMR (Tailscale tunnel, cellular via dev.cuberoot.me), <code>clientPort</code> is intentionally omitted — letting the client derive the port from the page URL is the only way all three entrypoints (localhost / ts.net / tunnel domain) work; hard-coding any of them breaks the other two.</p>
        <p>Production build runs through Vite 8 / Rolldown and emits ~80 hashed chunks. Each page is naturally code-split via <code>React.lazy(() =&gt; import(...))</code>; Rolldown extracts heavy deps (cubing.js, three.js, mp4box.js) into separate vendor chunks. First-paint JS is &lt; 80KB gzip; tool pages only fetch their chunk on navigation. The GH Actions <code>deploy_core</code> workflow rsyncs <code>dist/</code> to nginx root; the mirror workflow syncs GH Pages.</p>
        <p>Edge bits: the Vite worker config sends <code>analyzer_worker.ts</code> / <code>scramble_cstimer_worker.ts</code> through separate chunks with the classic-worker protocol. <code>import.meta.env.DEV</code> is the only signal that flips dev/prod API base (using <code>hostname === 'localhost'</code> would miss LAN / Tailscale / tunnel URLs). <code>@cuberoot/visualcube</code> is shipped via <code>build.lib</code> as its own npm package.</p>
      </>
    ),
  },
  links: [
    { label: 'vite.dev', href: 'https://vite.dev' },
    { label: 'GitHub · vitejs/vite', href: 'https://github.com/vitejs/vite' },
    { label: 'Vite 8 announcement', href: 'https://vite.dev/blog/announcing-vite8' },
    { label: 'Rolldown', href: 'https://rolldown.rs' },
    { label: 'VoidZero', href: 'https://voidzero.dev' },
  ],
};

export default VITE;
