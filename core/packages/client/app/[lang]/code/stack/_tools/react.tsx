import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c, t } from '../_lib/stack_tool_types';

// ─── React 19 ───────────────────────────────────────────────────────────────

export const REACT: StackTool = {
  slug: 'react',
  name: 'React',
  version: '19.2',
  since: '2013-05',
  group: 'frontend',
  accent: '#61DAFB',
  bright: '#9FE9FE',
  glyph: '⚛',
  floats: ['useState', 'useEffect', 'useTransition', '<Suspense>', 'JSX', 'fiber', 'reconciler', 'RSC', 'Actions', 'use()', 'ref-as-prop', '<Activity>'],
  zh: {
    tagline: '声明式 UI + 组件 + 虚拟 DOM',
    role: '渲染整个 SPA。24 个工具页全部跑在它的组件树上。',
    heroSub: <>把界面拆成组件,组件返回它<strong>应该长什么样</strong>,React 自己 diff 然后批量改 DOM。Jordan Walke 2013 年在 Facebook 抛出这一脚,十三年后,React 19 把客户端组件、并发渲染、服务端组件、Actions 全部装进同一棵树。</>,
    whatDesc: <>React 是一个 <strong>UI 库</strong>,不是框架。它只管 "组件 → DOM" 这一段,路由 / 数据 / 构建全部由生态补齐。这种克制是它能跨越 13 年依然主流的核心原因 —— 内核小,生态大,版本之间不大破不大立。</>,
    historyDesc: <>从 2013 年 JSConf 公开发布,到 2024 年 React 19 把 RSC / Actions 稳住,这条路上有几次范式跳跃:Hooks (2019)、Concurrent (2022)、Server Components (2024)。每次都有 "React 要死" 的声音,然后下一年 npm 数字告诉你它没事。</>,
    conceptsTitle: '组件 + Hooks 核心',
    conceptsDesc: <>React 的可观察 API 其实小:函数组件 + 一打 hook + JSX + Suspense + 几个 Server / Client 边界标记。剩下的都是这些原子的组合。</>,
    whyDesc: <>2026 年还选 React, 不是因为它"快"或"小", 而是因为它的<strong>生态深度</strong>、<strong>团队招聘面</strong>、<strong>未来路线</strong>三件事其它框架还赶不上。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>把"前端"和"React"基本画了等号的现实:全球 top 1000 网站里超过 40% 跑 React, AI 工具一代 (Claude Code / Cursor / v0 / Bolt) 的 UI 全部 React。</>,
    cuberootDesc: <>cuberoot.me 整个 <code>packages/client</code> 包就是一棵 React 19 树。24 个工具页用 <code>react-router-dom</code> 7 串起来, 每页 <code>lazy()</code> 切独立 chunk, <code>&lt;Suspense&gt;</code> 兜底加载态。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>React 19 不是终点。RSC 在 2026 终于在 Next / Remix 之外开始被中间件 / 框架原生支持;Compiler 把人写的优化代码全自动化;Native 平台 (React Native 0.80+ / VisionOS) 全面共用同一份组件代码。</>,
  },
  en: {
    tagline: 'Declarative UI, components, virtual DOM',
    role: 'Renders the whole SPA — 24 tool pages all live inside one React tree.',
    heroSub: <>Split the UI into components, let each return what it <strong>should</strong> look like, and let React diff and batch DOM mutations. Jordan Walke shipped that idea in 2013; thirteen years later React 19 packs client components, concurrent rendering, server components, and Actions into one tree.</>,
    whatDesc: <>React is a <strong>UI library</strong>, not a framework. It owns the "components → DOM" segment only — routing, data, build all live in the ecosystem. That restraint is exactly why it has stayed mainstream for thirteen years: small core, large ecosystem, no scorched-earth majors.</>,
    historyDesc: <>From its JSConf 2013 unveiling to React 19's stable RSC + Actions in 2024, there have been a few paradigm jumps: Hooks (2019), Concurrent (2022), Server Components (2024). Every cycle features a "React is dying" headline; every following year the npm chart says otherwise.</>,
    conceptsTitle: 'Components + Hooks core',
    conceptsDesc: <>React's observable API is actually small: function components + a dozen hooks + JSX + Suspense + a few server / client boundary markers. Everything else is composition.</>,
    whyDesc: <>Picking React in 2026 isn't because it's "fast" or "small" — it's because three things still beat alternatives: <strong>ecosystem depth</strong>, <strong>hiring pool</strong>, and <strong>roadmap</strong>.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>The reality is that "frontend" and "React" are roughly synonymous: over 40% of the global top-1000 sites run React, and the AI-tool generation (Claude Code / Cursor / v0 / Bolt) is React-only.</>,
    cuberootDesc: <>The whole <code>packages/client</code> package is a single React 19 tree. 24 tool pages are stitched together with <code>react-router-dom</code> 7; each is <code>lazy()</code>-loaded into its own chunk with <code>&lt;Suspense&gt;</code> covering the load.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>React 19 isn't the destination. RSC is finally being natively supported outside Next / Remix in 2026; the React Compiler automates the hand-written perf code; native targets (React Native 0.80+ / visionOS) share the same component model.</>,
  },
  heroStats: [
    { num: '#1', zh: <>前端框架月下载量 <em>npm trends 2026</em></>, en: <>frontend lib by monthly downloads <em>npm trends 2026</em></>
    },
    { num: '40', unit: '%', zh: <>全球 top 1000 网站使用 <em>HTTP Archive</em></>, en: <>of the global top-1000 sites <em>HTTP Archive</em></>
    },
    { num: '13', unit: 'y', zh: <>从 2013 至今 <em>13 年仍是主流</em></>, en: <>since 2013 <em>still mainstream</em></>
    },
    { num: '19', unit: '.2', zh: <>当前稳定版 <em>2026-05 · 19.2.6</em></>, en: <>current stable <em>2026-05 · 19.2.6</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>React 是 Jordan Walke 2011 年在 Facebook 内部做的一个库, 起源是 Facebook 广告组对那时的双向数据绑定 (Backbone / Angular 1) 失望透顶 —— 一个事件触发十几个组件来回 sync, 调起来跟 spaghetti 一样。Walke 抛出一个简单的设想:"如果每次更新就当作整个 UI 重新画一遍, 你只需要描述 <em>当前应该是什么样</em>, 而不是怎么从旧状态变到新状态, 会怎样?" 这个看似浪费的设想配上虚拟 DOM 的 diff 算法变成了可行方案。</p>
        <p>2013 年 5 月 29 日 JSConf US 公开发布。当场争议很大 —— 把 HTML 写进 JS, 大多数前端工程师觉得这是渎神。但 Facebook 内部数据 (Instagram 重写、Like 按钮 retrofit) 让外界看到:复杂应用里 React 的 mental model 反而<strong>更简单</strong>。</p>
        <p>之后是三次大跳跃:2015 年 React Native 把同一套组件思维带到原生平台;2019 年 Hooks 让函数组件接管状态, class 全面退场;2024 年 React 19 落地 Server Components + Actions, 重新画了 "客户端 JS + 服务端 API" 的边界。每次跳跃都引发 "React 复杂度太高 / 要被替代" 的舆论, 然后下一个版本继续向前走。</p>
      </>
    ),
    en: (
      <>
        <p>React started as an internal Facebook library by Jordan Walke around 2011. The trigger was the ads team's frustration with two-way binding (Backbone / Angular 1) — one event would trigger a dozen components to re-sync against each other, debugging it felt like untangling spaghetti. Walke proposed something almost naïve: "What if every update just re-renders the whole UI? You'd only describe <em>what it should look like now</em>, not how to get there." Paired with virtual-DOM diffing, the naïve idea became tractable.</p>
        <p>Public release was JSConf US, May 29, 2013. The reception was loud — putting HTML inside JS struck most frontend engineers as heresy. But the internal numbers (Instagram rewrite, Like-button retrofit) showed an inconvenient truth: in complex apps, React's mental model is <strong>simpler</strong>, not more complex.</p>
        <p>Then came three paradigm jumps: React Native (2015) brought the same component model to native; Hooks (2019) gave function components state and retired classes wholesale; React 19 (2024) shipped Server Components + Actions, redrawing the "client JS + server API" boundary. Each jump came with a "React is overcomplicated and about to be replaced" wave; each subsequent release shipped on.</p>
      </>
    ),
  },
  history: [
    { year: '2011', zh: { title: <>FB 内部立项</>, desc: <>Jordan Walke 在 Facebook 广告组做实验, 名字一度叫 FaxJS / BoltJS。核心:整个 UI 每次更新都"假装重画", 用虚拟 DOM diff 解决性能问题。</> }, en: { title: <>Internal project at FB</>, desc: <>Jordan Walke experiments inside Facebook's ads team. Codenames FaxJS / BoltJS. The core: pretend the whole UI re-renders, use virtual-DOM diffing to keep it cheap.</> } },
    { year: '2013·05', zh: { title: <>JSConf 公开发布</>, desc: <>5 月 29 日 JSConf US 公开。当场争议爆炸 —— 把 HTML 写进 JS 被骂"渎神"。但 Instagram 已用同款技术重写。</> }, en: { title: <>Open-sourced at JSConf</>, desc: <>May 29: JSConf US debut. Massive backlash on "HTML inside JS." Instagram had already been rewritten with the same technology.</> } },
    { year: '2014·05', zh: { title: <>0.10 + JSX 普及</>, desc: <>0.10 引入 keyed reconciliation。年底 Facebook 内部 Newsfeed 重构, 大量 React 上线, 外界第一次看到 React 在 production 量级的稳定性。</> }, en: { title: <>0.10 + JSX takes hold</>, desc: <>0.10 brings keyed reconciliation. By year-end, Facebook's Newsfeed rebuild lands on React in production — first wide proof of stability at scale.</> } },
    { year: '2015·03', zh: { title: <>React Native</>, desc: <>"Learn once, write anywhere" 落到 iOS / Android。同一套组件 mental model, native UIView / View 跟 web 共用一份 JSX。</> }, en: { title: <>React Native</>, desc: <>"Learn once, write anywhere" hits iOS / Android. Same component mental model, native UIView / View shares JSX with the web.</> } },
    { year: '2016·04', zh: { title: <>15.0 + fiber 准备</>, desc: <>15.0 重做核心 reconciler 接口, 为下一代 fiber (可中断、可优先级化) 架构铺路。Redux + React Router 同期普及。</> }, en: { title: <>15.0 + fiber prep</>, desc: <>15.0 reworks the reconciler interfaces, laying the rails for the next-gen fiber (interruptible, prioritized) architecture. Redux + React Router boom in parallel.</> } },
    { year: '2017·09', zh: { title: <>Fiber landed (16)</>, desc: <>16.0 把 fiber 上线 + 错误边界 + Fragment + Portal。从这版起 React 内部就能"中断当前渲染、切到更重要的工作"。</> }, en: { title: <>Fiber landed (16)</>, desc: <>16.0 ships fiber + error boundaries + Fragment + Portal. From here on, React can pause a render mid-tree and switch to higher-priority work.</> } },
    { year: '2019·02', zh: { title: <>Hooks (16.8)</>, desc: <>useState / useEffect 让函数组件拿回状态, 逻辑复用从 HOC / render-prop 套娃变成扁平 import。class 组件从这一刻起开始消失。</> }, en: { title: <>Hooks (16.8)</>, desc: <>useState / useEffect put state back into function components. Logic reuse becomes a flat import instead of HOC/render-prop towers. Classes start disappearing.</> } },
    { year: '2020·10', zh: { title: <>17.0 渐进升级</>, desc: <>17 没有新 feature, 但把"多版本 React 共存 + 渐进迁移"打通, 给后面的 Concurrent 模式开路。</> }, en: { title: <>17.0 gradual upgrade</>, desc: <>17 ships no new features; it nails "multiple React versions coexisting + gradual migration," paving the road for concurrent mode.</> } },
    { year: '2022·03', zh: { title: <>18.0 — Concurrent</>, desc: <>Concurrent Renderer GA。useTransition、自动批处理、Suspense for data 全部上线。从此 "用户输入永远不被昂贵 state 更新挡住" 是可达的。</> }, en: { title: <>18.0 — Concurrent</>, desc: <>Concurrent Renderer GA: useTransition, automatic batching, Suspense for data. From here, "user input never blocked by an expensive update" is achievable.</> } },
    { year: '2023·05', zh: { title: <>RSC + Next 13 落地</>, desc: <>Next.js 13.4 把 React Server Components 推进 production beta。"组件可以跑在服务器、零 JS 下发" 第一次大规模实战。</> }, en: { title: <>RSC + Next 13 land</>, desc: <>Next.js 13.4 ships React Server Components in production beta. "Components run on the server, zero JS shipped" sees its first large-scale battle test.</> } },
    { year: '2024·12', zh: { title: <>19.0 GA</>, desc: <>Actions / use() / ref-as-prop / stable RSC / async transitions。框架作者终于可以正式建议生产用 RSC。</> }, en: { title: <>19.0 GA</>, desc: <>Actions, use(), ref-as-prop, stable RSC, async transitions. Framework authors finally green-light production RSC.</> } },
    { year: '2025·10', highlight: true, zh: { title: <>19.2 — &lt;Activity&gt; + Compiler RC</>, desc: <>19.2 加 &lt;Activity&gt; 暂停 / 恢复子树、useEffectEvent、Performance Tracks。React Compiler 同期进 RC, 把 memoization 自动化。</> }, en: { title: <>19.2 — &lt;Activity&gt; + Compiler RC</>, desc: <>19.2 adds &lt;Activity&gt; (pause/resume subtrees), useEffectEvent, Performance Tracks. React Compiler hits RC in parallel — automatic memoization.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>19.2.6 / 当前稳定</>, desc: <>2026-05-06 最新点 release。npm 周下载 2.3 亿, GitHub 第三大仓库, 仍是新建项目的默认选择。</> }, en: { title: <>19.2.6 / current stable</>, desc: <>Latest patch on 2026-05-06. 230M weekly downloads on npm; third-largest repo on GitHub; still the default choice for new projects.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>函数组件</>, desc: <>组件是个返回 JSX 的函数。没有 class、没有 this。</> }, en: { title: <>Function component</>, desc: <>A component is a function that returns JSX. No class, no this.</> }, code: <code>{k('function')} {f('Card')}({'{ '}{p('title')}, {p('children')} {'}: { '}{p('title')}: {t('string')}; {p('children')}: {t('ReactNode')} {'}) {'}{'\n'}  {k('return')} (&lt;{f('article')}&gt;{'\n'}    &lt;{f('h2')}&gt;{'{'}title{'}'}&lt;/{f('h2')}&gt;{'\n'}    {'{'}children{'}'}{'\n'}  &lt;/{f('article')}&gt;);{'\n}'}</code> },
    { tag: 'B', zh: { title: <>useState</>, desc: <>组件局部状态。返回 [value, setter]。setter 会触发组件重渲染。</> }, en: { title: <>useState</>, desc: <>Component-local state. Returns [value, setter]; the setter schedules a re-render.</> }, code: <code>{k('const')} [{v('count')}, {v('setCount')}] = {f('useState')}({n('0')});{'\n\n'}&lt;{f('button')} {p('onClick')}={'{'}() =&gt; {f('setCount')}({v('count')} + {n('1')}){'}}'}&gt;{'\n'}  {v('count')}: {'{'}count{'}'}{'\n'}&lt;/{f('button')}&gt;</code> },
    { tag: 'C', zh: { title: <>useEffect</>, desc: <>"挂载后 / 依赖变化时" 跑一段副作用, 返回的清理函数在卸载时跑。</> }, en: { title: <>useEffect</>, desc: <>Run a side effect after mount or when deps change; return a cleanup that runs on unmount.</> }, code: <code>{f('useEffect')}(() =&gt; {'{'}{'\n'}  {k('const')} {v('id')} = {f('setInterval')}({v('tick')}, {n('1000')});{'\n'}  {k('return')} () =&gt; {f('clearInterval')}({v('id')});{'\n'}{'}'}, [{v('tick')}]);</code> },
    { tag: 'D', zh: { title: <>useMemo / useCallback</>, desc: <>对昂贵计算 / 子组件 prop 稳定性做手工 memoization。19.2 后 React Compiler 自动化了大半。</> }, en: { title: <>useMemo / useCallback</>, desc: <>Manual memoization for expensive compute / stable callback identity. The React Compiler (RC after 19.2) automates most of this.</> }, code: <code>{k('const')} {v('rows')} = {f('useMemo')}({'\n'}  () =&gt; {f('expensive')}({v('input')}),{'\n'}  [{v('input')}]{'\n'});</code> },
    { tag: 'E', zh: { title: <>useTransition</>, desc: <>把昂贵 state 更新标成"非紧急", 用户输入立刻响应、重的活儿在后台跑。</> }, en: { title: <>useTransition</>, desc: <>Mark an expensive state update as non-urgent — input stays responsive while the heavy work runs in the background.</> }, code: <code>{k('const')} [{v('pending')}, {v('start')}] = {f('useTransition')}();{'\n\n'}{f('start')}(() =&gt; {f('setFilter')}({v('next')}));{'\n'}{c('// pending = true 期间显示 spinner')}</code> },
    { tag: 'F', zh: { title: <>&lt;Suspense&gt;</>, desc: <>声明式 "等子树准备好"。配合 React.lazy 做代码分割, 配合 use(promise) 做数据加载。</> }, en: { title: <>&lt;Suspense&gt;</>, desc: <>Declaratively "wait until the subtree is ready." Pairs with React.lazy for code-split chunks and with use(promise) for data fetches.</> }, code: <code>&lt;{f('Suspense')} {p('fallback')}={'{<Spinner />}'}&gt;{'\n'}  &lt;{f('AsyncRoute')} /&gt;{'\n'}&lt;/{f('Suspense')}&gt;</code> },
    { tag: 'G', zh: { title: <>use()</>, desc: <>19 加的新原语。在 render 内直接 await 一个 promise 或读 Context, 由最近的 &lt;Suspense&gt; 边界接管挂起。</> }, en: { title: <>use()</>, desc: <>The new primitive in 19. Unwrap a promise or read context inline; the nearest &lt;Suspense&gt; handles the pending state.</> }, code: <code>{k('function')} {f('Profile')}({'{ '}{p('userPromise')} {'}'}) {'{'}{'\n'}  {k('const')} {v('user')} = {f('use')}({v('userPromise')});{'\n'}  {k('return')} &lt;{f('Card')} {p('name')}={'{'}user.name{'}'} /&gt;;{'\n'}{'}'}</code> },
    { tag: 'H', zh: { title: <>Actions + form</>, desc: <>&lt;form action={'{fn}'}&gt; 把表单提交直接绑到一个函数, 自带 pending / error / optimistic 状态。RSC 下 fn 可以跑在服务端。</> }, en: { title: <>Actions + form</>, desc: <>&lt;form action={'{fn}'}&gt; wires submission to a function with built-in pending / error / optimistic state. Under RSC, the function can run on the server.</> }, code: <code>&lt;{f('form')} {p('action')}={'{'}createTodo{'}'}&gt;{'\n'}  &lt;{f('input')} {p('name')}={s('"text"')} /&gt;{'\n'}  &lt;{f('SubmitButton')} /&gt;{'\n'}&lt;/{f('form')}&gt;</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>声明式心智模型</>, desc: <>只描述 "现在 UI 应该长什么样", 不写"怎么从 A 变到 B"。这一脚是 React 给前端最大贡献, Vue / Svelte / SolidJS 都从这里分叉。</> }, en: { title: <>Declarative mental model</>, desc: <>You describe what the UI should look like now — not how to get from A to B. React's most important contribution; Vue / Svelte / SolidJS all branch from here.</> }, code: <>{c('// React')}{'\n'}&lt;{f('Btn')} {p('disabled')}={'{!ok}'} /&gt;</> },
    { icon: '⌬', zh: { title: <>生态深度无人能比</>, desc: <>需要日期组件? 13 个候选。3D? react-three-fiber 早就把 Three.js 包好了。<strong>cubing.js</strong> 的官方 sample 也是 React。</> }, en: { title: <>Unmatched ecosystem depth</>, desc: <>Need a datepicker? 13 candidates. 3D? react-three-fiber wraps Three.js cleanly. <strong>cubing.js</strong> ships its sample integrations in React.</> }, code: <>{c('// One npm install')}{'\n'}{k('import')} {'{'} {v('TwistyPlayer')} {'}'} {k('from')} {s('"cubing/twisty"')};</> },
    { icon: '⎇', zh: { title: <>Hooks 抹平复用</>, desc: <>逻辑复用从 HOC 套娃变成 import 一个函数。<code>useDebounce</code> / <code>useLocalStorage</code> 这类小工具人人手写一份, 互相能直接抄。</> }, en: { title: <>Hooks flatten reuse</>, desc: <>Logic reuse becomes "import a function" instead of an HOC tower. Tiny utilities like <code>useDebounce</code> / <code>useLocalStorage</code> are universally hand-rollable.</> }, code: <>{k('const')} {v('debounced')} = {f('useDebounce')}({v('q')}, {n('300')});</> },
    { icon: '⌁', zh: { title: <>Concurrent 让重组件不卡输入</>, desc: <>useTransition / Suspense / 自动批处理让"打字时跑重 filter"这种场景体验跟用 native app 没差。Recon / Trainer 等本站重型工具就靠这套。</> }, en: { title: <>Concurrent keeps heavy components responsive</>, desc: <>useTransition, Suspense, automatic batching let "type while heavy filter runs" feel like a native app. Recon / Trainer on this site lean on it.</> }, code: <>{f('startTransition')}(() =&gt; {f('filter')}({v('input')}));</> },
    { icon: '⌖', zh: { title: <>类型系统配合极佳</>, desc: <>JSX 在 TS 5 下是一等公民。组件 props、children、ref、context 类型全部能推。整个 cuberoot.me 启用 strict mode 没有一个 any。</> }, en: { title: <>First-class TS</>, desc: <>JSX is first-class in TS 5. Component props, children, refs, context — all inferred. The cuberoot.me codebase runs strict mode with zero "any."</> }, code: <>{k('interface')} {t('Props')} {'{ '}{p('size')}: {t('number')} {'}'}</> },
    { icon: '⌗', zh: { title: <>AI 工具一代的母语</>, desc: <>Claude Code / Cursor / v0 / Bolt / Vercel AI SDK 生成 UI 时几乎一边倒选 React。给 LLM 一个"输出 React" 的任务比"输出 Svelte" 准确率高显著一档。</> }, en: { title: <>Lingua franca of AI tools</>, desc: <>Claude Code / Cursor / v0 / Bolt / Vercel AI SDK overwhelmingly emit React. Asking an LLM for "give me React" is noticeably more accurate than "give me Svelte."</> }, code: <>{c('// "Make a card component"')}{'\n'}{c('// LLMs 90%+ emit React')}</> },
    { icon: '⏚', zh: { title: <>未来路线明确</>, desc: <>React Compiler 让人不用再写 useMemo;Server Components 在框架层逐步落地;同一份组件代码跑 web + Native + visionOS。十年视角看, 这套规划比其它框架都长。</> }, en: { title: <>Clear roadmap</>, desc: <>React Compiler removes hand-rolled useMemo; Server Components are landing in more frameworks; the same components run on web + Native + visionOS. On a ten-year horizon, the plan is longer than any other framework's.</> }, code: <>{c('// Compiler RC after 19.2')}{'\n'}{c('// No more useMemo()')}</> },
    { icon: '⛯', zh: { title: <>从小项目到 1M 行都活</>, desc: <>VS Code 没用 React (用了自家 framework), 但 Slack / Asana / Linear / Notion / Discord 都是百万行 React。规模上限被实战验证。</> }, en: { title: <>Survives 1M-line codebases</>, desc: <>VS Code uses its own framework, but Slack / Asana / Linear / Notion / Discord all run million-line React codebases. The scaling ceiling is battle-tested.</> }, code: <>{c('// Linear: 1M+ LoC')}{'\n'}{c('// Discord: 2M+ LoC')}</> },
    { icon: '⚐', zh: { title: <>Native + Web 同一份组件</>, desc: <>React Native 0.80+ 的新架构 (Fabric / TurboModules) 让 iOS / Android / web 共用同一套 hook + 组件代码, 只换 host primitive。</> }, en: { title: <>Native + Web from one tree</>, desc: <>React Native 0.80+'s new architecture (Fabric / TurboModules) makes iOS / Android / web share the same hooks + components — only the host primitives swap.</> }, code: <>&lt;{f('View')} /&gt; {c('// native')}{'\n'}&lt;{f('div')} /&gt;  {c('// web')}</> },
  ],
  adopters: [
    { name: 'Meta (Facebook / Instagram / WhatsApp)', highlight: true, zhNote: '亲爹, 数百万行 React 在 production', enNote: 'The parent — millions of LoC in production' },
    { name: 'Vercel · Next.js', href: 'https://nextjs.org', highlight: true, zhNote: 'RSC 在这里首先跑通', enNote: 'Where RSC first shipped in production beta' },
    { name: 'Claude Code', href: 'https://github.com/anthropics/claude-code', highlight: true, zhNote: 'Anthropic CLI agent, TS + React + Ink', enNote: 'Anthropic CLI agent, TS + React + Ink' },
    { name: 'Cursor', href: 'https://cursor.com', highlight: true, zhNote: 'AI IDE, React + Electron', enNote: 'AI IDE, React + Electron' },
    { name: 'Vercel AI SDK', href: 'https://sdk.vercel.ai', zhNote: 'React 钦定 AI 框架', enNote: 'React-first AI framework' },
    { name: 'Linear', href: 'https://linear.app', zhNote: '百万行 React, 1px UI 精度', enNote: 'Million-line React, 1-pixel UI fidelity' },
    { name: 'Discord', href: 'https://discord.com', zhNote: '桌面端 Electron + React, 2亿 MAU', enNote: 'Electron + React desktop, 200M MAU' },
    { name: 'Notion', href: 'https://notion.so', zhNote: 'Block editor 内核都是 React', enNote: 'Block editor core is React' },
    { name: 'Shopify Hydrogen', href: 'https://hydrogen.shopify.dev', zhNote: 'RSC + Remix 商家店面框架', enNote: 'Storefront framework on RSC + Remix' },
    { name: 'Airbnb', href: 'https://airbnb.com', zhNote: '最早大规模拥抱者之一', enNote: 'Among the earliest large-scale adopters' },
    { name: 'Netflix', zhNote: 'TV 端 + web 端都跑 React Native + React', enNote: 'TV + web both ride React Native + React' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 24 个工具页全部 React 19', enNote: 'This site — all 24 tool pages on React 19' },
  ],
  outlook: [
    { tag: <>HOT · 2025-10</>, hot: true, big: true, zh: { title: <>React Compiler RC</>, body: <><p>Babel / SWC 插件, 在编译期分析组件函数, 把不该 re-render 的 hooks / 子组件自动 memoize。<strong>useMemo / useCallback 几乎可以从代码里删干净</strong>。</p><p>更深一层意义:React 这十几年里"手工性能优化"的代码量极大, 一旦 Compiler 全面落地, 这部分代码量退化为框架内部事。开发者写的是更接近 "纯描述" 的代码。</p></> }, en: { title: <>React Compiler RC</>, body: <><p>A Babel / SWC plugin that statically analyzes components and auto-memoizes the right hooks / children. <strong>useMemo / useCallback can be deleted from user code.</strong></p><p>The deeper point: hand-rolled perf code has been the single largest body of React work for a decade. Once the Compiler ships, it retreats into framework internals — what you write is closer to a pure description.</p></> } },
    { tag: 'RSC', zh: { title: <>Server Components 走出 Next</>, body: <><p>RSC 在 React 19 之前几乎只在 Next 13+ 看到。2026 年开始 Remix / TanStack Start / Waku 等都开始 native 支持。"组件可以跑在服务器、零 JS 下发" 这个能力从一个框架特权变成 React 通用能力。</p></> }, en: { title: <>RSC outside Next</>, body: <><p>Pre-19, you essentially only saw RSC inside Next 13+. From 2026, Remix / TanStack Start / Waku ship native RSC. "Run a component on the server, send zero JS" stops being a Next-only privilege.</p></> } },
    { tag: 'NATIVE', zh: { title: <>React Native 0.80+ 新架构</>, body: <><p>Fabric 渲染器 + TurboModules + Hermes 引擎成型。Native 端不再走 bridge, 调用 JS ↔ native 几乎是 sync。同一份 hooks 在 iOS / Android / visionOS / macOS 全部能跑。Expo SDK 53 让构建 / 发布也极简化。</p></> }, en: { title: <>React Native 0.80+ architecture</>, body: <><p>Fabric renderer + TurboModules + Hermes are now the default. Native no longer uses the bridge — JS ↔ native is near-synchronous. The same hooks run on iOS / Android / visionOS / macOS. Expo SDK 53 collapses build / release.</p></> } },
    { tag: <>AI</>, zh: { title: <>AI 工具一代的默认输出</>, body: <><p>Claude Code / Cursor / v0 / Bolt 在生成 UI 时几乎一边倒选 React。给 LLM 的训练数据里 React 例子最多, 生成的代码 IDE 上的红波浪线最少。React 借 AI 之力又巩固一轮地位。</p></> }, en: { title: <>The default output of the AI tool generation</>, body: <><p>Claude Code / Cursor / v0 / Bolt almost unanimously emit React when generating UI. LLM training data has the most React examples, and the produced code carries the fewest IDE red squiggles. React reaped another round of dominance via AI.</p></> } },
    { tag: <>DATA</>, zh: { title: <>npm 周下载 2.3 亿</>, body: <><p>2026-05 数据:react 包周下载 ~2.3 亿次, react-dom 同样级别。这个数字在前端框架里只有 Vue 能近一档 (~ 7000 万)。生态护城河仍在变深。</p></> }, en: { title: <>230M weekly downloads</>, body: <><p>As of 2026-05: ~230M weekly downloads for the react package, similar for react-dom. Only Vue comes within an order of magnitude (~70M). The ecosystem moat is still widening.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>整个 <code>packages/client</code> 包是一棵 React 19 的树, 跑在 Vite 8 dev server 后面。24+ 工具页通过 <code>react-router-dom</code> 7 路由, 每个 page 用 <code>React.lazy(() =&gt; import(...))</code> 切成独立的 chunk, 外面包一层 <code>&lt;Suspense fallback="..." /&gt;</code>。首屏只加载落地页的代码, 其它 24 页是惰性加载, 用到才下。</p>
        <p>重型工具页 (<code>Recon</code> / <code>Trainer</code> / <code>FrameCount</code> / <code>Scramble Analyzer</code>) 大量用 <code>useTransition</code> 把昂贵的 state 更新放进低优先级 transition —— 比如 FrameCount 解析视频帧时, 用户拖时间轴的 input 不会卡。<code>&lt;Suspense&gt;</code> 配合 <code>use()</code> 让数据加载状态变成声明式 —— "等数据 promise 解析", 而不是显式 isLoading 分支。</p>
        <p>RSC / Actions 暂时没启用, 因为本站是<strong>纯静态 SPA</strong> 部署 (nginx 直接吐 hashed assets), 没有 server-rendered HTML 这条路径。如果以后给某些工具页加 SSR 优化首屏, RSC 是首选路径 —— 但目前 TTI &lt; 200ms, 加 SSR 收益不大。</p>
        <p>StrictMode 全开, ESLint <code>react-hooks/exhaustive-deps</code> 严格执行, useEffect 依赖项漏写一行 CI 就挂。React 19 的 <code>react/jsx-runtime</code> 让所有页面不再需要 <code>import React</code>。整个 codebase strict-typed 零 any, Hono RPC 的端点类型直接通过 <code>hc&lt;AppType&gt;()</code> 流到 fetch 调用处。</p>
      </>
    ),
    en: (
      <>
        <p>The whole <code>packages/client</code> package is a single React 19 tree behind the Vite 8 dev server. 24+ tool pages route via <code>react-router-dom</code> 7; each page is <code>React.lazy(() =&gt; import(...))</code>-split into its own chunk and wrapped in <code>&lt;Suspense fallback="..." /&gt;</code>. The landing page is all that's loaded at first paint — every other route is lazy.</p>
        <p>Heavy tool pages (<code>Recon</code> / <code>Trainer</code> / <code>FrameCount</code> / <code>Scramble Analyzer</code>) lean on <code>useTransition</code> to mark expensive state updates as low priority. When FrameCount parses video frames, scrubbing the timeline never blocks. <code>&lt;Suspense&gt;</code> + <code>use()</code> turns data loading into a declarative "wait for the promise" rather than an explicit isLoading branch.</p>
        <p>RSC / Actions are intentionally not in use: cuberoot.me is a <strong>pure static SPA</strong> (nginx serves hashed assets). There's no server-rendered HTML path, so RSC's benefit is mostly theoretical. If a future tool page needs SSR for first-paint, RSC would be the obvious door — but TTI is already &lt; 200ms.</p>
        <p>StrictMode is on globally; ESLint's <code>react-hooks/exhaustive-deps</code> rule is enforced, so a missed dep in useEffect breaks CI. React 19's <code>react/jsx-runtime</code> means no file imports React explicitly. The whole codebase is strict-typed with zero "any" — Hono RPC types flow straight through <code>hc&lt;AppType&gt;()</code> to the fetch call site.</p>
      </>
    ),
  },
  links: [
    { label: 'react.dev', href: 'https://react.dev' },
    { label: 'GitHub · facebook/react', href: 'https://github.com/facebook/react' },
    { label: 'React 19 announcement', href: 'https://react.dev/blog/2024/12/05/react-19' },
    { label: 'React 19.2 release notes', href: 'https://react.dev/blog/2025/10/01/react-19-2' },
  ],
};


export default REACT;
