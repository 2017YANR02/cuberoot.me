import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c } from '../_lib/stack_tool_types';

// ─── Vitest 4 ───────────────────────────────────────────────────────────────

export const VITEST: StackTool = {
  slug: 'vitest',
  name: 'Vitest',
  version: '4.1',
  since: '2021-12',
  group: 'dev',
  accent: '#6E9F18',
  bright: '#8DC73A',
  glyph: '✓',
  floats: ['describe', 'it', 'expect', 'vi.mock', 'vi.fn', 'beforeEach', 'snapshot', 'coverage', 'workers', 'browser-mode', 'in-source', 'toMatchScreenshot'],
  zh: {
    tagline: 'Vite 原生的下一代测试框架',
    role: '跑 unit / worker / 回归测试。utils 纯函数、worker 算法、analyzer baseline 全部交给它。',
    heroSub: <>把测试当 dev server 来跑:同一份 Vite config、同一套插件、同一份 ESM 转换。Anthony Fu 在 2021 年底开源,2024 年 1.0 GA,十八个月里把 Jest 的份额吃掉一大半。Vue / Nuxt 钦定, Astro / Solid 模板默认, 大量 React 项目从 Jest 迁过来。</>,
    whatDesc: <>Vitest 是一个<strong>Vite-native</strong> 的测试运行器。API 跟 Jest 高度兼容 (<code>describe / it / expect / vi.mock</code>), 但底下用 Vite 的 transform pipeline + worker threads, 不存在 Jest 那套额外的 Babel / ts-jest 转译税。改一个文件, 它只重跑相关测试, 反馈速度跟 dev server HMR 一档。</>,
    historyDesc: <>2021-12 第一个 0.0.0 发布, 当时只是 vite-node 旁边的一个 POC。半年内 Vue / Nuxt 把官方测试栈切过去, 2023-12 出 1.0 GA, 2024-07 出 2.0, 2025-01 3.0 重写 reporter, 2025-10 4.0 把 Browser Mode 稳定 + 加 <code>toMatchScreenshot</code> 视觉回归。每个 minor 都在啃 Jest 留下的 feature 坑。</>,
    conceptsTitle: '核心 API',
    conceptsDesc: <>Jest 用户可以零成本上手:断言、mock、生命周期钩子名字一模一样。差异主要在配置 (vite.config 接 test 字段) 和 ESM 行为 (不需要 transformIgnorePatterns 这种 hack)。</>,
    whyDesc: <>选 Vitest 而不是 Jest, 三件事:<strong>不用再配 ts-jest / babel-jest</strong>、<strong>跟 dev server 共用 transform</strong>、<strong>watch mode 反馈极快</strong>。最近一年又加上 Browser Mode 这条 Jest 永远做不出来的路线。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Vite / Vue / Nuxt 整个家族钦定;Anthony Fu 自己维护的 UnoCSS / Slidev / VueUse 全部用 Vitest;Astro / Solid / Qwik 的官方模板默认 Vitest;Vercel / Cloudflare 的 templates 改默认到 Vitest;Jest 项目 2024 起大量迁移过来。</>,
    cuberootDesc: <>cuberoot.me 的 <code>@cuberoot/client</code> 包用 Vitest 4 跑全集 (<code>pnpm --filter @cuberoot/client test</code>) 或 watch (<code>test:watch</code>)。utils 纯函数测试就放在源文件并排 (<code>src/utils/*.test.ts</code>);worker / 算法回归测试在 <code>tests/*.test.ts</code> + 一个 <code>_*_runner.cjs</code> (node:worker_threads + classic-worker globals shim)。CI 在 <code>.github/workflows/test.yml</code> PR + push main 触发。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>Browser Mode 稳定后, "组件测试 = 真浏览器跑" 第一次摆脱 jsdom 的不准。Visual regression 内置, 不再需要 Percy / Chromatic 这类外部服务。Compiler-aware 测试和 in-source testing 让单元测试边界继续向"靠近源码"那一侧推。</>,
  },
  en: {
    tagline: 'Next-gen test runner powered by Vite',
    role: 'Runs unit / worker / regression tests — utils pure functions, worker algorithms, analyzer baselines all live here.',
    heroSub: <>Treat tests like the dev server: same Vite config, same plugins, same ESM transform. Anthony Fu open-sourced it in late 2021, shipped 1.0 GA in 2024, and over eighteen months ate a large chunk of Jest's share. Vue / Nuxt make it official; Astro / Solid templates default to it; React projects migrate over from Jest in droves.</>,
    whatDesc: <>Vitest is a <strong>Vite-native</strong> test runner. The API is Jest-compatible (<code>describe / it / expect / vi.mock</code>), but underneath it's Vite's transform pipeline + worker threads — no Babel / ts-jest tax. Touch a file and only the affected tests re-run; the feedback loop feels like dev-server HMR.</>,
    historyDesc: <>0.0.0 shipped in 2021-12 as a POC sitting next to vite-node. Within months Vue / Nuxt switched their official test stack over; 1.0 GA hit in 2023-12, 2.0 in 2024-07, 3.0 reworked the reporter in 2025-01, 4.0 in 2025-10 stabilized Browser Mode and added <code>toMatchScreenshot</code> visual regression. Each minor chips away at Jest's remaining ground.</>,
    conceptsTitle: 'Core API',
    conceptsDesc: <>Jest users are at home immediately: assertions, mocks, lifecycle hooks all share names. The differences are mostly config (test field lives inside vite.config) and ESM behavior (no transformIgnorePatterns hack).</>,
    whyDesc: <>Picking Vitest over Jest comes down to three things: <strong>no more ts-jest / babel-jest config</strong>, <strong>shared transform pipeline with the dev server</strong>, <strong>blistering watch-mode feedback</strong>. Add Browser Mode — a road Jest will never walk — and the gap keeps widening.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>The whole Vite / Vue / Nuxt family makes it official; Anthony Fu's own UnoCSS / Slidev / VueUse all run on it; Astro / Solid / Qwik official templates default to it; Vercel / Cloudflare templates switched defaults; Jest projects have been migrating en masse since 2024.</>,
    cuberootDesc: <>cuberoot.me's <code>@cuberoot/client</code> package runs Vitest 4 — full suite via <code>pnpm --filter @cuberoot/client test</code>, watch via <code>test:watch</code>. Pure-function utils tests sit next to their source (<code>src/utils/*.test.ts</code>); worker / algorithm regression tests live in <code>tests/*.test.ts</code> with a companion <code>_*_runner.cjs</code> (node:worker_threads + a classic-worker globals shim). CI fires on PR + push to main via <code>.github/workflows/test.yml</code>.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>With Browser Mode stable, "component test = real browser" finally escapes jsdom's inaccuracies. Visual regression ships in the box, retiring the need for Percy / Chromatic-style services. Compiler-aware tests and in-source testing keep pushing the unit-test boundary closer to the source.</>,
  },
  heroStats: [
    { num: '4', unit: '.1', zh: <>当前稳定版 <em>2026-05 · 4.1.6</em></>, en: <>current stable <em>2026-05 · 4.1.6</em></> },
    { num: '5', unit: 'y', zh: <>从 2021-12 至今 <em>四个 major</em></>, en: <>since 2021-12 <em>four majors</em></> },
    { num: '#1', zh: <>Vite 生态默认测试器 <em>Vue / Nuxt 钦定</em></>, en: <>default runner in the Vite world <em>Vue / Nuxt official</em></> },
    { num: '60', unit: 'M+', zh: <>npm 周下载 <em>2026-05</em></>, en: <>weekly downloads on npm <em>2026-05</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Vitest 是 Anthony Fu 2021 年底起头的一个看起来很简单的项目:既然 Vite 在 dev / build 上已经把 ESM 处理、TS 转译、JSX 编译、HMR 全部解决了, 为什么测试还要再走一遍 Jest 那套独立的 Babel 转译? 直接复用 Vite 的 transform pipeline + 一层薄薄的运行器壳, 测试和 dev server 共用同一份配置、同一份转换。</p>
        <p>2021-12-03 第一个 0.0.0 发布到 npm 时它还只是 vite-node 旁边的实验。半年内 Vue / Nuxt 把官方测试栈切过去 —— 因为那边本来就是 Vite 用户, 用 Jest 还得维护一套独立配置, Vitest 一来这个负担直接消失。这一波直接把 Vitest 推进了主流视野。</p>
        <p>之后是 1.0 (2023-12) / 2.0 (2024-07) / 3.0 (2025-01) / 4.0 (2025-10) 四代。3.0 重写 reporter, 闪烁问题解决, 命令行输出稳定。4.0 把 Browser Mode 从 experimental 转 stable, 同时加 <code>toMatchScreenshot</code> 内置视觉回归 + Playwright traces 接入 —— 这两件 Jest 因为不跟 Vite 绑定永远做不出来。</p>
      </>
    ),
    en: (
      <>
        <p>Vitest started as a deceptively simple project by Anthony Fu in late 2021: Vite already solves ESM handling, TS transpilation, JSX, and HMR for dev / build, so why should tests run through a separate Jest Babel pipeline? Reuse Vite's transform pipeline, wrap a thin runner around it, and tests share configuration and transforms with the dev server.</p>
        <p>The first 0.0.0 hit npm on 2021-12-03 — still just an experiment sitting next to vite-node. Within months Vue / Nuxt switched their official test stack over: they were already Vite users, and maintaining a parallel Jest config was pure tax. Vitest erased that overhead and rode the Vue ecosystem straight into the mainstream.</p>
        <p>Then four majors: 1.0 (2023-12), 2.0 (2024-07), 3.0 (2025-01), 4.0 (2025-10). 3.0 reworked the reporter — flicker gone, CLI output stable. 4.0 promoted Browser Mode to stable, added <code>toMatchScreenshot</code> as built-in visual regression, and wired in Playwright traces — two features Jest can never ship without binding to Vite.</p>
      </>
    ),
  },
  history: [
    { year: '2021·12', zh: { title: <>0.0.0 公开</>, desc: <>12-03 第一版上 npm, 当时还只是 vite-node 旁边的 POC。Anthony Fu 同期还在维护 Vue / Nuxt / UnoCSS / Slidev, Vitest 借这波生态自然铺开。</> }, en: { title: <>0.0.0 ships</>, desc: <>Hits npm on 12-03 as a POC alongside vite-node. Anthony Fu was already maintaining Vue / Nuxt / UnoCSS / Slidev, so Vitest rode that ecosystem straight into adoption.</> } },
    { year: '2022·02', zh: { title: <>Vue / Nuxt 钦定</>, desc: <>Vue Test Utils 官方迁到 Vitest, Nuxt 模板默认 Vitest。Jest 在 Vue 圈快速退场。</> }, en: { title: <>Vue / Nuxt go official</>, desc: <>Vue Test Utils migrates to Vitest, Nuxt templates default to it. Jest rapidly exits the Vue world.</> } },
    { year: '2022·07', zh: { title: <>0.20 + 生态扩展</>, desc: <>Astro / SolidJS / Qwik 官方模板切换默认到 Vitest。Anthony Fu 在 Vue.js Conf 上演讲 "vite-node 是测试的未来"。</> }, en: { title: <>0.20 + ecosystem spread</>, desc: <>Astro / SolidJS / Qwik official templates default to Vitest. Anthony Fu's Vue.js Conf talk: "vite-node is the future of testing."</> } },
    { year: '2023·08', zh: { title: <>0.34 收尾</>, desc: <>0.x 系列最后一版, 为 1.0 收口。Workspace 支持、in-source testing、vi.hoisted 全部稳定。</> }, en: { title: <>0.34 freeze</>, desc: <>Final 0.x release, prepping for 1.0. Workspace support, in-source testing, vi.hoisted all stabilize.</> } },
    { year: '2023·12', zh: { title: <>1.0 GA</>, desc: <>12-04 GA。API 锁死, 不再 0.x 频繁 breaking。React / Svelte / Solid 项目大规模从 Jest 迁过来。</> }, en: { title: <>1.0 GA</>, desc: <>GA on 12-04. API frozen — no more 0.x churn. React / Svelte / Solid projects migrate over from Jest at scale.</> } },
    { year: '2024·07', zh: { title: <>2.0</>, desc: <>2.0 改进 reporter、加 onTestFinished / onTestFailed 钩子、稳定 expect.poll。Vite 5 / 6 全面对齐。</> }, en: { title: <>2.0</>, desc: <>2.0 lands reporter improvements, onTestFinished / onTestFailed hooks, stable expect.poll. Full alignment with Vite 5 / 6.</> } },
    { year: '2025·01', zh: { title: <>3.0 — reporter 重写</>, desc: <>1-16 上线。reporter 闪烁问题修复, workspace 配置合并进 vitest.config, 按行号过滤测试。public API (vitest/node) 重整。</> }, en: { title: <>3.0 — reporter rewrite</>, desc: <>Ships 1-16. Reporter flicker fixed, workspace config merged into vitest.config, filter tests by line number, public API (vitest/node) reorganized.</> } },
    { year: '2025·10', highlight: true, zh: { title: <>4.0 — Browser Mode stable</>, desc: <>10-22 GA。Browser Mode 从 experimental 转 stable, <code>toMatchScreenshot</code> 内置视觉回归, Playwright traces 接入。VoidZero 接管发行。</> }, en: { title: <>4.0 — Browser Mode stable</>, desc: <>10-22 GA. Browser Mode graduates to stable, <code>toMatchScreenshot</code> ships as built-in visual regression, Playwright traces wire in. VoidZero takes over distribution.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>4.1.6 / 当前稳定</>, desc: <>5-11 最新点 release。Compiler-aware 测试在路线图上, 5.0 beta 4-23 / 5-05 已发, 主线焦点回到性能。</> }, en: { title: <>4.1.6 / current stable</>, desc: <>Latest patch on 5-11. Compiler-aware testing is on the roadmap; 5.0 betas already out (4-23 / 5-05); main-line focus is back on perf.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>describe + it</>, desc: <>测试套件 + 测试用例。语义跟 Jest 一样, 直接复制 Jest 代码大多数能跑。</> }, en: { title: <>describe + it</>, desc: <>Test suite + test case. Identical semantics to Jest — most Jest code runs unchanged.</> }, code: <code>{f('describe')}({s('"add"')}, () =&gt; {'{'}{'\n'}  {f('it')}({s('"sums two numbers"')}, () =&gt; {'{'}{'\n'}    {f('expect')}({f('add')}({n('1')}, {n('2')})).{f('toBe')}({n('3')});{'\n'}  {'}'});{'\n'}{'}'});</code> },
    { tag: 'B', zh: { title: <>expect 断言</>, desc: <>toBe / toEqual / toMatchObject / toThrow 全套。analyzer 这类回归测试用 <code>toBe(具体数)</code> 锁死 baseline。</> }, en: { title: <>expect assertions</>, desc: <>The full kit: toBe / toEqual / toMatchObject / toThrow. Analyzer-style regression locks baselines with <code>toBe(specific value)</code>.</> }, code: <code>{f('expect')}({v('result')}).{f('toBe')}({n('42')});{'\n'}{f('expect')}({v('obj')}).{f('toMatchObject')}({'{ '}{p('id')}: {n('1')} {'}'});{'\n'}{f('expect')}(() =&gt; {f('boom')}()).{f('toThrow')}({s('/x/')});</code> },
    { tag: 'C', zh: { title: <>vi.fn / vi.mock</>, desc: <>函数 mock / 模块 mock。比 Jest 干净, 没有 transformIgnorePatterns 这种 ESM 陷阱。</> }, en: { title: <>vi.fn / vi.mock</>, desc: <>Function mocks / module mocks. Cleaner than Jest — no ESM trap like transformIgnorePatterns.</> }, code: <code>{k('const')} {v('spy')} = {v('vi')}.{f('fn')}();{'\n'}{v('vi')}.{f('mock')}({s('"./db"')}, () =&gt; ({'{ '}{p('save')}: {v('spy')} {'}'}));</code> },
    { tag: 'D', zh: { title: <>beforeEach / afterEach</>, desc: <>套件级 / 文件级 / 全局级生命周期钩子。每个 test 前 / 后跑一段, 用来重置 state。</> }, en: { title: <>beforeEach / afterEach</>, desc: <>Suite / file / global lifecycle hooks. Reset state before or after each test.</> }, code: <code>{f('beforeEach')}(() =&gt; {'{'}{'\n'}  {v('store')}.{f('clear')}();{'\n'}{'}'});</code> },
    { tag: 'E', zh: { title: <>snapshot</>, desc: <>toMatchSnapshot 记下当时的输出, 后续 diff。配合 -u 一键更新。改 baseline = review signal。</> }, en: { title: <>snapshot</>, desc: <>toMatchSnapshot freezes the current output and diffs later runs. -u updates them. Changing baselines is itself a review signal.</> }, code: <code>{f('expect')}({f('render')}({v('cube')})).{f('toMatchSnapshot')}();</code> },
    { tag: 'F', zh: { title: <>coverage</>, desc: <>V8 或 istanbul 两种 provider。<code>--coverage</code> 一开就出。V8 快但少几个边界, istanbul 准但慢一档。</> }, en: { title: <>coverage</>, desc: <>V8 or istanbul providers. Toggle with <code>--coverage</code>. V8 is fast but misses some edges; istanbul is accurate but slower.</> }, code: <code>{c('// vite.config.ts')}{'\n'}{p('test')}: {'{ '}{p('coverage')}: {'{ '}{p('provider')}: {s('"v8"')} {'} }'}</code> },
    { tag: 'G', zh: { title: <>workers</>, desc: <>测试默认在 worker threads 池里并行跑, CPU 满载。<code>--no-parallel</code> 退回单线程便于调试。</> }, en: { title: <>workers</>, desc: <>Tests default to a worker-thread pool, saturating CPU. <code>--no-parallel</code> falls back to single-threaded for debugging.</> }, code: <code>{c('// vite.config.ts')}{'\n'}{p('test')}: {'{ '}{p('pool')}: {s('"threads"')} {'}'}</code> },
    { tag: 'H', zh: { title: <>browser mode</>, desc: <>4.0 稳定。组件测试跑在真浏览器 (Playwright / WebdriverIO), 不再依赖 jsdom。<code>toMatchScreenshot</code> 内置视觉回归。</> }, en: { title: <>browser mode</>, desc: <>Stable since 4.0. Component tests run in a real browser (Playwright / WebdriverIO) — no more jsdom. <code>toMatchScreenshot</code> ships built-in visual regression.</> }, code: <code>{p('browser')}: {'{ '}{p('provider')}: {s('"playwright"')}, {p('instances')}: [{'{'}{p('browser')}: {s('"chromium"')}{'}'}] {'}'}</code> },
  ],
  whyCards: [
    { icon: '⚡', zh: { title: <>Vite transform 复用</>, desc: <>测试和 dev server 共用同一份 vite.config + 插件 + ESM transform。不存在 Jest 那套 babel-jest / ts-jest / transformIgnorePatterns 配置税。</> }, en: { title: <>Shared Vite transform</>, desc: <>Tests share vite.config + plugins + ESM transform with the dev server. No babel-jest / ts-jest / transformIgnorePatterns config tax.</> }, code: <>{c('// One vite.config.ts')}{'\n'}{c('// dev + test + build all use it')}</> },
    { icon: '⌬', zh: { title: <>Jest 兼容 API</>, desc: <>describe / it / expect / vi.mock 名字跟 Jest 完全一致。已有 Jest 测试 import 改一下即可跑通, 团队上手成本接近零。</> }, en: { title: <>Jest-compatible API</>, desc: <>describe / it / expect / vi.mock — identical names. Existing Jest tests usually just need their imports swapped.</> }, code: <>{k('import')} {'{'} {v('describe')}, {v('it')}, {v('expect')} {'}'} {k('from')} {s('"vitest"')};</> },
    { icon: '⚙', zh: { title: <>原生 ESM + TS</>, desc: <>TypeScript 不走 Babel / ts-jest, 直接 esbuild 转。<code>.ts</code> 测试零配置开跑, top-level await / dynamic import 全部支持。</> }, en: { title: <>Native ESM + TS</>, desc: <>TypeScript goes through esbuild, not Babel / ts-jest. <code>.ts</code> tests run with zero config; top-level await / dynamic import all just work.</> }, code: <>{k('await')} {f('import')}({s('"./worker"')});</> },
    { icon: '↻', zh: { title: <>watch mode 飞快</>, desc: <>改一个文件, 它顺着 Vite 的 module graph 找出受影响的测试, 只重跑那些。反馈跟 HMR 一档, 跟 Jest 全跑差几个数量级。</> }, en: { title: <>Blazing watch mode</>, desc: <>Touch a file: it walks Vite's module graph, picks the affected tests, reruns just those. HMR-class feedback — orders of magnitude faster than Jest's full reruns.</> }, code: <>$ vitest{'\n'}{c('// only affected tests rerun')}</> },
    { icon: '◉', zh: { title: <>Browser Mode</>, desc: <>4.0 稳定后, 组件测试可以跑在真 Chromium / Firefox / WebKit (走 Playwright)。配合 <code>toMatchScreenshot</code> 视觉回归。Jest 永远做不出。</> }, en: { title: <>Browser Mode</>, desc: <>Stable since 4.0: component tests run in real Chromium / Firefox / WebKit via Playwright. <code>toMatchScreenshot</code> ships built-in. Jest will never get here.</> }, code: <>{f('expect')}({v('page')}).{f('toMatchScreenshot')}();</> },
    { icon: '⊞', zh: { title: <>in-source testing</>, desc: <>测试可以直接写在被测文件底部 (<code>if (import.meta.vitest)</code>), 小函数不用单独建 .test.ts。生产构建会把这块 dead-code 干掉。</> }, en: { title: <>In-source testing</>, desc: <>Write tests at the bottom of the source file with <code>if (import.meta.vitest)</code>. Small helpers don't need a separate .test.ts. The production build dead-code-eliminates them.</> }, code: <>{k('if')} ({k('import')}.{p('meta')}.{v('vitest')}) {'{'}{'\n'}  {v('vitest')}.{f('test')}(...);{'\n'}{'}'}</> },
    { icon: '⌗', zh: { title: <>workspace + projects</>, desc: <>monorepo 一份配置, 多个 project 各自的 setup / 环境 / coverage。3.0 起 workspace 字段直接写在 vitest.config 里, 不再要独立文件。</> }, en: { title: <>Workspace + projects</>, desc: <>One config for a monorepo, with per-project setup / env / coverage. Since 3.0, the workspace field lives in vitest.config — no separate file.</> }, code: <>{p('test')}: {'{ '}{p('projects')}: [{s('"packages/*"')}] {'}'}</> },
    { icon: '⛯', zh: { title: <>baseline 即 review signal</>, desc: <>analyzer / scramble 这类回归测试用 <code>expect().toBe(具体数)</code> 锁死 baseline。改算法时主动改 baseline, 而不是放宽到 toBeGreaterThan 蒙混。</> }, en: { title: <>Baselines as review signal</>, desc: <>Regression tests for analyzer / scramble lock baselines with <code>expect().toBe(specific value)</code>. When the algorithm changes, change the baseline — don't loosen to toBeGreaterThan.</> }, code: <>{f('expect')}({v('totals')}.{p('cross')}).{f('toBe')}({n('1287')});</> },
    { icon: '⚐', zh: { title: <>worker / classic-worker 测得动</>, desc: <>本站 analyzer / scramble worker 测试走 node:worker_threads + classic-worker globals shim, 单个 <code>_*_runner.cjs</code> 把浏览器 worker API 桥接到 node 端。</> }, en: { title: <>Worker / classic-worker testable</>, desc: <>This site's analyzer / scramble worker tests run on node:worker_threads with a classic-worker globals shim — one <code>_*_runner.cjs</code> bridges the browser worker API into node.</> }, code: <>{k('const')} {v('w')} = {k('new')} {f('Worker')}({s('"./runner.cjs"')});</> },
  ],
  adopters: [
    { name: 'Vue.js', href: 'https://vuejs.org', highlight: true, zhNote: '官方测试栈, Vue Test Utils 基于 Vitest', enNote: 'Official test stack — Vue Test Utils built on Vitest' },
    { name: 'Nuxt', href: 'https://nuxt.com', highlight: true, zhNote: '模板默认, @nuxt/test-utils 基于 Vitest', enNote: 'Default in templates; @nuxt/test-utils sits on Vitest' },
    { name: 'Astro', href: 'https://astro.build', zhNote: '官方模板默认 Vitest', enNote: 'Default in official templates' },
    { name: 'SolidJS', href: 'https://www.solidjs.com', zhNote: '官方模板默认', enNote: 'Default in official templates' },
    { name: 'Qwik', href: 'https://qwik.dev', zhNote: '官方模板默认', enNote: 'Default in official templates' },
    { name: 'Slidev', href: 'https://sli.dev', zhNote: 'Anthony Fu 自有, 钦定 Vitest', enNote: "Anthony Fu's own project — Vitest in-house" },
    { name: 'UnoCSS', href: 'https://unocss.dev', zhNote: 'Anthony Fu 自有, 钦定 Vitest', enNote: "Anthony Fu's own project — Vitest in-house" },
    { name: 'VueUse', href: 'https://vueuse.org', zhNote: '所有 composable 测试跑 Vitest', enNote: 'Every composable tested with Vitest' },
    { name: 'Vercel templates', href: 'https://vercel.com/templates', zhNote: '前端 starter 默认改 Vitest', enNote: 'Frontend starters default to Vitest' },
    { name: 'Cloudflare Workers SDK', href: 'https://developers.cloudflare.com/workers/testing/vitest-integration/', zhNote: '@cloudflare/vitest-pool-workers 官方 pool', enNote: 'Official @cloudflare/vitest-pool-workers pool' },
    { name: 'Storybook', href: 'https://storybook.js.org', zhNote: '8.x 起 test runner 切到 Vitest', enNote: 'Test runner switched to Vitest in 8.x' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 utils + worker + analyzer 回归测试全跑 Vitest 4', enNote: 'This site — utils + worker + analyzer regression all on Vitest 4' },
  ],
  outlook: [
    { tag: <>HOT · 2025-10</>, hot: true, big: true, zh: { title: <>Browser Mode 稳定</>, body: <><p>4.0 把 Browser Mode 从 experimental 转 stable, 同时把 <code>toMatchScreenshot</code> 内置进来。组件测试第一次摆脱 jsdom 的不准 —— layout / canvas / WebGL / IntersectionObserver 这些 jsdom 永远 mock 不全的能力, 现在直接在真 Chromium 跑。</p><p>更深一层:Playwright traces 接入后, 失败的浏览器测试可以回放整个 DOM + 网络时间线。这一条 Jest 因为不绑 Vite / 不绑浏览器, 永远做不出。</p></> }, en: { title: <>Browser Mode goes stable</>, body: <><p>4.0 promotes Browser Mode to stable and ships <code>toMatchScreenshot</code> in the box. Component tests finally escape jsdom's inaccuracies — layout / canvas / WebGL / IntersectionObserver and other things jsdom can never fully mock now run in real Chromium.</p><p>Deeper: with Playwright traces wired in, a failing browser test replays the full DOM + network timeline. Jest, which is bound to neither Vite nor a browser, can never get here.</p></> } },
    { tag: 'VRT', zh: { title: <>视觉回归内置</>, body: <><p><code>toMatchScreenshot</code> 把视觉回归从外部服务 (Percy / Chromatic / Loki) 拉回测试运行器。对开源项目来说, 这意味着零成本拥有视觉回归 —— 不再依赖商业 SaaS 配额。</p></> }, en: { title: <>Visual regression in the box</>, body: <><p><code>toMatchScreenshot</code> pulls visual regression out of external services (Percy / Chromatic / Loki) and back into the test runner. For OSS projects this means zero-cost visual regression — no commercial SaaS quota to manage.</p></> } },
    { tag: 'COMPILER', zh: { title: <>React Compiler 共生</>, body: <><p>React Compiler 让 useMemo / useCallback 退场, 但同时也改变了组件 re-render 次数的语义。Vitest 在路线图里加 compiler-aware 测试模式, 让"组件 re-render 了几次"这类断言在 Compiler on/off 之间保持稳定。</p></> }, en: { title: <>Symbiosis with React Compiler</>, body: <><p>The React Compiler retires useMemo / useCallback while shifting the semantics of "how many times did this component re-render." Vitest's roadmap includes a compiler-aware test mode so re-render assertions stay stable across Compiler-on / Compiler-off.</p></> } },
    { tag: <>ECOSYSTEM</>, zh: { title: <>Jest 迁移仍在加速</>, body: <><p>2024 起 Vite-based 项目几乎一边倒迁 Vitest。Create React App 死后, React 项目要么走 Next.js (Jest), 要么走 Vite (Vitest)。Vite 这条路占新建项目的比例还在涨, 直接拉动 Vitest 份额。</p></> }, en: { title: <>Jest migration accelerates</>, body: <><p>Since 2024, Vite-based projects have moved to Vitest almost unanimously. With Create React App retired, React projects pick either Next.js (Jest) or Vite (Vitest). Vite's share of new projects keeps climbing, dragging Vitest along.</p></> } },
    { tag: <>DATA</>, zh: { title: <>npm 周下载 6000 万+</>, body: <><p>2026-05 数据:vitest 周下载 6000 万次量级, Jest 仍然更高但增速归零。在 Vite 用户中份额接近 100%。</p></> }, en: { title: <>60M+ weekly downloads</>, body: <><p>As of 2026-05: ~60M weekly downloads. Jest is still higher in absolute numbers but its growth has flatlined. Among Vite users, Vitest's share is effectively 100%.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p><code>@cuberoot/client</code> 用 Vitest 4 跑测试。两条入口:<code>pnpm --filter @cuberoot/client test</code> 跑全集 (CI 用), <code>test:watch</code> 留 dev 用。Vite 8 dev server 那份配置直接被 Vitest 复用, 不需要单独写 jest.config —— 这是选 Vitest 而不是 Jest 的核心动机。</p>
        <p>测试代码按用途分两类:</p>
        <p><strong>utils 纯函数</strong>:测试文件跟源文件并排, <code>src/utils/foo.ts</code> 旁边一份 <code>src/utils/foo.test.ts</code>。改源文件 watch mode 立刻重跑那一份。formatWcaResult / displayCuberName / scramble 解析这种 utility 都在这里。</p>
        <p><strong>worker / 算法回归</strong>:走 <code>tests/*.test.ts</code> + 一个配套 <code>_*_runner.cjs</code>。runner 用 <code>node:worker_threads</code> 启动, 在文件顶部 shim 浏览器 worker 的全局 (<code>self</code> / <code>postMessage</code> / <code>onmessage</code>), 然后 require 真正的 classic-worker 源文件。典型例子 <code>tests/analyzer_worker.test.ts</code> —— analyzer 在 node 端跑, 给一组 fixture scramble, 把 cross / F2L / OLL / PLL 的 fixed totals 用 <code>expect().toBe(具体数)</code> 锁死。改算法 = 主动改 baseline, 把它当一种 review signal, 而不是放宽到 <code>toBeGreaterThan</code> 蒙混。</p>
        <p>CI 在 <code>.github/workflows/test.yml</code>, PR + push main 时跑 typecheck + test 两步。改 worker / kociemba / scramble 生成器 / utils 必须配一组 fixture 测试 —— 改前先看现有 <code>tests/</code> 里同类怎么写, 不要从零起步。</p>
      </>
    ),
    en: (
      <>
        <p><code>@cuberoot/client</code> uses Vitest 4. Two entry points: <code>pnpm --filter @cuberoot/client test</code> for the full suite (CI uses this), <code>test:watch</code> for dev. Vitest reuses the Vite 8 dev-server config — there's no separate jest.config to maintain, which is the core reason we picked Vitest over Jest.</p>
        <p>Tests split into two flavors:</p>
        <p><strong>Pure-function utils</strong>: test files sit next to source — <code>src/utils/foo.ts</code> ships with <code>src/utils/foo.test.ts</code>. Edit the source and watch mode reruns just that file. formatWcaResult / displayCuberName / scramble parsing all live here.</p>
        <p><strong>Worker / algorithm regression</strong>: routed through <code>tests/*.test.ts</code> + a companion <code>_*_runner.cjs</code>. The runner spawns <code>node:worker_threads</code>, shims the browser worker globals (<code>self</code> / <code>postMessage</code> / <code>onmessage</code>) at the top, then requires the real classic-worker source. The canonical example is <code>tests/analyzer_worker.test.ts</code> — the analyzer runs in node against a fixture scramble set, and cross / F2L / OLL / PLL fixed totals are locked with <code>expect().toBe(specific number)</code>. When the algorithm changes, change the baseline — that's a review signal — never loosen to <code>toBeGreaterThan</code>.</p>
        <p>CI lives at <code>.github/workflows/test.yml</code> and runs typecheck + test on PR and push to main. Touching a worker / kociemba / scramble generator / util requires a fixture test set — read the existing <code>tests/</code> patterns before starting, don't reinvent.</p>
      </>
    ),
  },
  links: [
    { label: 'vitest.dev', href: 'https://vitest.dev' },
    { label: 'GitHub · vitest-dev/vitest', href: 'https://github.com/vitest-dev/vitest' },
    { label: 'Vitest 4.0 announcement', href: 'https://vitest.dev/blog/vitest-4' },
    { label: 'Vitest 3.0 announcement', href: 'https://vitest.dev/blog/vitest-3' },
  ],
};

export default VITEST;
