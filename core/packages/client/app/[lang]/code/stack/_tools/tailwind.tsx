import type { StackTool } from '../_lib/stack_tool_types';
import { k, s, n, f, p, c } from '../_lib/stack_tool_types';

// ─── Tailwind CSS v4 ─────────────────────────────────────────────────────────

export const TAILWIND: StackTool = {
  slug: 'tailwind',
  name: 'Tailwind CSS',
  version: '4.3',
  since: '2017-11',
  group: 'frontend',
  accent: '#38BDF8',
  bright: '#7DD3FC',
  glyph: '≈',
  floats: ['utility-first', '@theme', '@import', 'preflight', 'Oxide', 'JIT', '@apply', 'container queries', 'arbitrary values', 'shadcn/ui', 'Headless UI', 'flex p-4'],
  zh: {
    tagline: 'Utility-first 的 CSS 框架',
    role: '装在 cuberoot.me 上,主要作 preflight 基础层 + 偶尔 utility 兜底。',
    heroSub: <>把"组件级 CSS"拆成原子 class —— <code>flex</code> <code>p-4</code> <code>rounded-lg</code> 直接拼在 JSX 上, 不再为命名 <code>.card-wrapper-inner</code> 头疼。Adam Wathan 2017 年在 Refactoring UI 写示例时顺手做的小工具, 九年后变成全球 top CSS 框架。</>,
    whatDesc: <>Tailwind 是一个 <strong>utility-first 的 CSS 框架</strong>:它不给你 <code>.btn</code> <code>.card</code> 这种语义化组件类, 而是给一大堆原子 class —— 一个 class 干一件事, 你在 markup 里组合。听起来像 inline style, 但带响应式 / hover / dark / 主题变量 / 设计系统约束。</>,
    historyDesc: <>从 2017 年 11 月 v0.1.0 alpha 一路走到 2025 年 1 月 v4.0 GA, 八年里 Tailwind 经历了三次重大跳跃:JIT 模式 (2021), CSS-first 配置 (2024), 以及用 Rust + Lightning CSS 重写的 Oxide 引擎。v4 的目标是"配置写在 CSS 里, 跑得更快, 安装更小"。</>,
    conceptsTitle: '原子 utility + @theme 配置',
    conceptsDesc: <>v4 的 API 比 v3 更"CSS 本位":配置写在 <code>@theme</code> directive 里、入口换成 <code>@import "tailwindcss"</code>, content 路径自动扫描。剩下的就是上百个 utility class 怎么组合。</>,
    whyDesc: <>选 Tailwind 不是因为它能让 CSS 写得更少 —— 实际上 class 字符串经常更长。选它的理由是<strong>命名摩擦消失</strong>、<strong>样式作用域不再撒野</strong>、以及 <strong>shadcn/ui 这套 2025 年的事实标准组件库</strong>就站在它上面。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>State of CSS 2025 调查里 Tailwind 排第一 (~ 71% framework 使用者选它, Bootstrap ~ 42%)。npm 周下载 9700 万, 是 Bootstrap 的 17 倍。GitHub / Vercel / Shopify / Stripe / OpenAI 的 production 站都用。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>v4 之后 Tailwind 的路线很清楚:把 "configuration in CSS" 推到极致, 让 container queries / @scope / color-mix 这些原生 CSS 新能力直接成为 utility。同时 shadcn/ui 生态把它和 Radix Primitives 绑成事实组件标准。</>,
  },
  en: {
    tagline: 'Utility-first CSS framework',
    role: "Installed on cuberoot.me, but mostly used as the preflight base layer with utility classes as an escape hatch.",
    heroSub: <>Break component-level CSS into atomic classes — <code>flex</code> <code>p-4</code> <code>rounded-lg</code> directly on the JSX, no more naming <code>.card-wrapper-inner</code>. Adam Wathan kicked it off in 2017 while writing Refactoring UI examples; nine years later it tops the State of CSS survey.</>,
    whatDesc: <>Tailwind is a <strong>utility-first CSS framework</strong>: instead of semantic component classes like <code>.btn</code> or <code>.card</code>, it gives you hundreds of atomic classes — one job each — and you compose them inline. Sounds like inline style, but with responsive / hover / dark / theme tokens / a design-system budget built in.</>,
    historyDesc: <>From v0.1.0 alpha in November 2017 to v4.0 GA in January 2025, Tailwind has had three big paradigm jumps: JIT mode (2021), CSS-first config (2024), and the Rust + Lightning CSS Oxide engine. v4's pitch: write config in CSS, build faster, install smaller.</>,
    conceptsTitle: 'Atomic utilities + @theme config',
    conceptsDesc: <>v4's API is more "CSS-native" than v3: config lives in a <code>@theme</code> directive, the entry becomes <code>@import "tailwindcss"</code>, and content paths are auto-detected. The rest is composing the hundreds of utilities.</>,
    whyDesc: <>You don't pick Tailwind because it writes less CSS — class strings are often longer. You pick it because <strong>naming friction disappears</strong>, <strong>style scopes stop leaking</strong>, and <strong>shadcn/ui — the de-facto 2025 component library</strong> — sits on top of it.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>State of CSS 2025 ranks Tailwind #1 (~71% of framework users; Bootstrap ~42%). 97M weekly npm downloads, about 17x Bootstrap. GitHub / Vercel / Shopify / Stripe / OpenAI all ship it in production.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Post-v4 the roadmap is clear: push "configuration in CSS" further, expose native CSS additions (container queries, @scope, color-mix) as first-class utilities. In parallel, the shadcn/ui ecosystem locks Tailwind + Radix Primitives together as the practical component standard.</>,
  },
  heroStats: [
    { num: '#1', zh: <>CSS 框架 <em>State of CSS 2025</em></>, en: <>CSS framework <em>State of CSS 2025</em></> },
    { num: '97', unit: 'M/wk', zh: <>npm 周下载 <em>2026-05, 是 Bootstrap 的 17 倍</em></>, en: <>weekly npm downloads <em>2026-05, 17x Bootstrap</em></>
    },
    { num: '8', unit: 'y', zh: <>2017 v0.1 至今 <em>从副产品到行业默认</em></>, en: <>since v0.1 in 2017 <em>from side-project to industry default</em></>
    },
    { num: '4', unit: '.3', zh: <>当前稳定版 <em>2026-05 · Oxide 引擎</em></>, en: <>current stable <em>2026-05 · Oxide engine</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>Tailwind 是 Adam Wathan 2017 年的"<strong>副产品</strong>"。当时他和 Steve Schoger 在写一本叫 Refactoring UI 的设计书, 书里要给所有 CSS 示例一个统一的 API —— 写习惯了"<code>.card</code> 加一个 <code>.card-large</code> modifier 加一个 <code>.card-large-blue</code> override"这种 BEM 写法的人都知道, 命名是 CSS 最大的认知负担。Wathan 抽了一周时间, 把所有"用来调一个属性的小 class"列出来, 给它们起名规则化的名字, 第一版叫 Mosaic CSS, 后来改名 Tailwind。</p>
        <p>2017 年 11 月 1 日 v0.1.0 alpha 公开。社区反应分两派 —— 一派说"这就是 inline style 的复辟, 你回到 1999 年了"; 另一派 (主要是 Laravel / Vue 圈) 一上手发现"原来不用想 class 名字, 写 markup 就是写样式", 直接被吃住。Wathan 自己开始把 Tailwind 当主业, 2020 年成立 Tailwind Labs 公司。</p>
        <p>之后是几次范式跳跃:2019 年 v1.0 正式 production-ready;2020 年 v2.0 加 dark mode + JIT 实验;2021 年 v3.0 把 JIT (just-in-time, 按需生成 utility) 设为默认, 同时引入 arbitrary values (<code>w-[137px]</code>);2025 年 1 月 v4.0 GA, 用 Rust 重写引擎 (代号 Oxide), 配置从 <code>tailwind.config.js</code> 搬到 CSS 的 <code>@theme</code> directive, 构建速度提 5 倍, 安装体积缩 5 倍。每次跳跃都有人喊"Tailwind 太复杂了/要被替代", 下一年 npm 数字继续涨。</p>
        <p>商业上 Wathan 没走 VC 路线, 靠 Tailwind UI / Tailwind Plus (付费组件 + 模板) + Refactoring UI 书撑 Tailwind Labs。这个"开源核心免费、增值组件库收费"的模式跟 Vercel / Supabase 不一样, 是 SaaS 时代少见的"我不要你的钱, 我要你的钱"。</p>
      </>
    ),
    en: (
      <>
        <p>Tailwind started as Adam Wathan's <strong>side-project byproduct</strong> in 2017. He and Steve Schoger were writing a design book called Refactoring UI and needed a unified CSS API across every example — anyone who has lived through "<code>.card</code> plus a <code>.card-large</code> modifier plus a <code>.card-large-blue</code> override" knows class naming is the single largest cognitive tax in CSS. Wathan took a week, listed every "tiny class that just tweaks one property," gave them mechanical names, and shipped it. The first name was Mosaic CSS, later renamed Tailwind.</p>
        <p>Public alpha was November 1, 2017 (v0.1.0). The reaction split: one camp called it "the return of inline style, welcome to 1999"; the other (mainly Laravel / Vue folks) tried it and discovered "I don't have to name a single class anymore — writing markup is writing styles." Wathan went full-time on Tailwind, and Tailwind Labs was incorporated in 2020.</p>
        <p>Then came the paradigm jumps: v1.0 production-ready in 2019; v2.0 in 2020 brought dark mode and the experimental JIT compiler; v3.0 in 2021 made JIT the default and introduced arbitrary values (<code>w-[137px]</code>); v4.0 GA in January 2025 — Rust-rewritten engine (codename Oxide), config moved from <code>tailwind.config.js</code> into the CSS <code>@theme</code> directive, 5x faster builds, 5x smaller install. Every jump came with a "Tailwind is too complex / about to be replaced" wave; the npm chart kept climbing.</p>
        <p>Commercially Wathan never took VC money. Tailwind Labs runs on Tailwind UI / Tailwind Plus (paid components + templates) and the Refactoring UI book. The "free open-source core, paid component library" model is a rare one in the SaaS era.</p>
      </>
    ),
  },
  history: [
    { year: '2017·11', zh: { title: <>v0.1.0 alpha</>, desc: <>11 月 1 日公开。当时叫 Tailwind, 用 PostCSS 插件链按需展开 utility, 名字从 Mosaic CSS 改来。</> }, en: { title: <>v0.1.0 alpha</>, desc: <>Public on November 1. PostCSS-plugin pipeline expanding utilities on demand. The name had just changed from Mosaic CSS to Tailwind.</> } },
    { year: '2019·05', zh: { title: <>v1.0 production-ready</>, desc: <>正式 GA, API 稳定。开始有 Laravel / Vue 圈实战项目落地。Refactoring UI 配套 Tailwind UI 同时上线, 商业模型成型。</> }, en: { title: <>v1.0 production-ready</>, desc: <>Official GA with stable API. Laravel / Vue communities start shipping real projects. Tailwind UI launches alongside the Refactoring UI book — the business model takes shape.</> } },
    { year: '2020·11', zh: { title: <>v2.0 + JIT 实验</>, desc: <>加 dark mode、增强 color palette、放出 JIT (just-in-time) 编译模式做实验。这是从"预生成所有 utility 文件巨大"到"按 markup 按需生成"的转折点。</> }, en: { title: <>v2.0 + JIT preview</>, desc: <>Adds dark mode, expands the palette, previews JIT (just-in-time) compilation. The turning point: from "pre-generate everything, huge bundle" to "scan markup, generate on demand."</> } },
    { year: '2021·12', zh: { title: <>v3.0 — JIT 默认</>, desc: <>JIT 成默认。引入 arbitrary values (<code>w-[137px]</code>) 让"必要时跳出设计系统"成本归零。dev build 一次性扫整个 codebase 用毫秒级。</> }, en: { title: <>v3.0 — JIT by default</>, desc: <>JIT becomes the default. Arbitrary values (<code>w-[137px]</code>) make "escape the design system when necessary" cost-free. Dev builds scan whole codebases in milliseconds.</> } },
    { year: '2023·07', zh: { title: <>v3.4 + container queries</>, desc: <>container queries 进 first-class utility。同时 shadcn/ui 出现, 把 Tailwind + Radix Primitives 组合成行业事实标准的组件库模式。</> }, en: { title: <>v3.4 + container queries</>, desc: <>Container queries become first-class utilities. shadcn/ui emerges around the same time, locking Tailwind + Radix Primitives in as the practical component library pattern.</> } },
    { year: '2024·03', zh: { title: <>v4 alpha — Oxide 公开</>, desc: <>v4 第一个 alpha 公开 Rust-based Oxide 引擎和 CSS-first 配置思路。tailwind.config.js 不再必需, <code>@theme</code> directive 直接在 CSS 里定义 token。</> }, en: { title: <>v4 alpha — Oxide unveiled</>, desc: <>First v4 alpha exposes the Rust-based Oxide engine and the CSS-first config direction. tailwind.config.js is no longer required; the <code>@theme</code> directive defines tokens inside CSS.</> } },
    { year: '2025·01', zh: { title: <>v4.0 GA</>, desc: <>1 月 22 日 v4.0 stable 发布。Oxide 引擎 + Lightning CSS, 完整 build 提速 5x, 增量 build 提速 100x, 安装体积缩 5x。<code>@import "tailwindcss"</code> 一行替代旧的三行 directive。</> }, en: { title: <>v4.0 GA</>, desc: <>January 22: v4.0 stable. Oxide engine + Lightning CSS — full builds 5x faster, incremental 100x faster, install footprint 5x smaller. One <code>@import "tailwindcss"</code> replaces the old three-line directive setup.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>v4.3 / 当前稳定</>, desc: <>2026-05 最新点 release, 加 scrollbar utility、mauve / olive / mist / taupe 调色板、<code>@container-size</code>。npm 周下载 9700 万, 是 Bootstrap 的 17 倍。</> }, en: { title: <>v4.3 / current stable</>, desc: <>Latest minor as of 2026-05: scrollbar utilities, new mauve / olive / mist / taupe palettes, <code>@container-size</code>. 97M weekly npm downloads, ~17x Bootstrap.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>Utility class</>, desc: <>每个 class 干一件事。组合即样式, 不再起 component 名。</> }, en: { title: <>Utility class</>, desc: <>One class, one job. Compose them inline; no component-class naming required.</> }, code: <code>&lt;{f('button')} {p('className')}={s('"flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white"')}&gt;{'\n'}  {s('Save')}{'\n'}&lt;/{f('button')}&gt;</code> },
    { tag: 'B', zh: { title: <>@import "tailwindcss"</>, desc: <>v4 入口一行搞定。替代 v3 三条 <code>@tailwind base/components/utilities</code>。</> }, en: { title: <>@import "tailwindcss"</>, desc: <>The v4 entry point — one line. Replaces v3's three <code>@tailwind base/components/utilities</code> directives.</> }, code: <code>{c('/* src/index.css */')}{'\n'}{k('@import')} {s('"tailwindcss"')};</code> },
    { tag: 'C', zh: { title: <>@theme directive</>, desc: <>v4 把 token 定义搬进 CSS。改一个 CSS custom property = 改整套设计 token。</> }, en: { title: <>@theme directive</>, desc: <>v4 moves tokens into CSS. Change one custom property and the design system updates.</> }, code: <code>{k('@theme')} {'{'}{'\n'}  --color-brand: {n('oklch(0.7 0.15 220)')};{'\n'}  --font-display: {s('"Inter Variable"')};{'\n'}  --spacing: {n('0.25rem')};{'\n'}{'}'}</code> },
    { tag: 'D', zh: { title: <>Preflight</>, desc: <>Tailwind 内置的 reset。把 <code>h1</code> 字号、列表标记等全清成中性, 跟 normalize.css 同款思路但更激进。</> }, en: { title: <>Preflight</>, desc: <>Tailwind's built-in reset. Strips <code>h1</code> sizes, list markers, etc. to neutral — same idea as normalize.css but more aggressive.</> }, code: <code>{c('/* preflight 自动: */')}{'\n'}h1, h2, p {'{'} margin: {n('0')}; {'}'}{'\n'}img {'{'} display: block; {'}'}</code> },
    { tag: 'E', zh: { title: <>Responsive prefix</>, desc: <>每个 utility 都可以加 <code>sm:</code> <code>md:</code> <code>lg:</code> 前缀做断点。比 media query 写得短。</> }, en: { title: <>Responsive prefix</>, desc: <>Every utility takes <code>sm:</code> / <code>md:</code> / <code>lg:</code> prefixes for breakpoints — shorter than writing media queries.</> }, code: <code>{p('className')}={s('"text-base md:text-lg lg:text-xl"')}</code> },
    { tag: 'F', zh: { title: <>State prefix</>, desc: <>hover / focus / active / disabled / dark / group-hover 等状态全部走前缀。</> }, en: { title: <>State prefix</>, desc: <>hover / focus / active / disabled / dark / group-hover and friends all live as prefixes.</> }, code: <code>{p('className')}={s('"bg-sky-500 hover:bg-sky-600 focus-visible:ring-2 dark:bg-sky-700"')}</code> },
    { tag: 'G', zh: { title: <>Arbitrary values</>, desc: <>方括号语法跳出设计系统约束, 临时一个具体值。<code>w-[137px]</code> <code>text-[#38BDF8]</code>。</> }, en: { title: <>Arbitrary values</>, desc: <>Bracket syntax to escape the design system when needed — <code>w-[137px]</code> / <code>text-[#38BDF8]</code>.</> }, code: <code>{p('className')}={s('"grid grid-cols-[auto_1fr_min-content] gap-[clamp(8px,2vw,24px)]"')}</code> },
    { tag: 'H', zh: { title: <>@apply</>, desc: <>把一串 utility 抽成语义化类。备用工具:大多数时候直接 utility 就够, @apply 只在重复 5 次以上才划算。</> }, en: { title: <>@apply</>, desc: <>Extract a string of utilities into a semantic class. A safety valve — most of the time you just inline; @apply pays off only at 5+ repetitions.</> }, code: <code>.btn-primary {'{'}{'\n'}  {k('@apply')} px-4 py-2 rounded-lg bg-sky-500 text-white;{'\n'}{'}'}</code> },
  ],
  whyCards: [
    { icon: '⚡', zh: { title: <>命名摩擦消失</>, desc: <>不用想 <code>.user-card</code> 还是 <code>.profile-card</code>。写 markup 就是写样式, 5 分钟一个新组件不再为 BEM 命名规则拉扯。</> }, en: { title: <>Naming friction gone</>, desc: <>No more deciding between <code>.user-card</code> and <code>.profile-card</code>. Writing markup is writing styles — a new component in 5 minutes without BEM-naming tug-of-war.</> }, code: <>{p('className')}={s('"p-4 rounded bg-white"')}</> },
    { icon: '⌬', zh: { title: <>样式作用域不撒野</>, desc: <>没有 global selector 跨页污染, 没有 CSS specificity 战争。删一个组件 = 删一段 markup, 不用担心遗留 dead CSS。</> }, en: { title: <>No leaking scopes</>, desc: <>No global selectors polluting other pages, no specificity wars. Deleting a component = deleting the markup; no dead CSS left behind.</> }, code: <>{c('// Delete markup,')}{'\n'}{c('// CSS goes too.')}</> },
    { icon: '⌖', zh: { title: <>设计系统的硬约束</>, desc: <>spacing scale (4 8 12 16 ...)、color palette、font scale 都进 <code>@theme</code>。想随便写 <code>p-3.5rem</code> 不行, 想保持视觉一致很容易。</> }, en: { title: <>Hard design-system rails</>, desc: <>Spacing scale (4 8 12 16 ...), color palette, font scale all live in <code>@theme</code>. Random <code>p-3.5rem</code> is locked out; visual consistency is the default.</> }, code: <>{p('className')}={s('"p-4 p-6 p-8"')}{'\n'}{c('// not p-3.5rem')}</> },
    { icon: '⌁', zh: { title: <>Oxide 编译快得离谱</>, desc: <>v4 的 Rust 引擎 + Lightning CSS, 完整 build 提速 5x, 增量 build 微秒级。1000 文件的 codebase 一次 dev rebuild &lt; 100ms。</> }, en: { title: <>Oxide is absurdly fast</>, desc: <>v4's Rust engine + Lightning CSS: 5x faster full builds, microsecond incrementals. A 1000-file codebase rebuilds in &lt; 100ms.</> }, code: <>{c('// v4 build')}{'\n'}{c('// 5x faster')}</> },
    { icon: '⎇', zh: { title: <>响应式 / hover / dark 一站式</>, desc: <>不写 media query 不写 :hover, 全走前缀。<code>md:hover:bg-sky-600</code> 就是"中等屏幕及以上 hover 时背景换色"。</> }, en: { title: <>Responsive / hover / dark in one</>, desc: <>No media queries, no :hover selectors — just prefixes. <code>md:hover:bg-sky-600</code> reads as "background swap on hover at md and up."</> }, code: <>{p('className')}={s('"md:hover:bg-sky-600"')}</> },
    { icon: '⌗', zh: { title: <>shadcn/ui 把它和 Radix 绑死</>, desc: <>2024-25 React 组件库的事实标准是 "shadcn/ui = Radix Primitives + Tailwind"。AI 工具一代默认输出这个组合, 复制粘贴即可用。</> }, en: { title: <>shadcn/ui locks it with Radix</>, desc: <>The de-facto 2024-25 React component pattern is "shadcn/ui = Radix Primitives + Tailwind." The AI tool generation defaults to this stack; copy-paste and ship.</> }, code: <>{c('// shadcn/ui CLI')}{'\n'}{c('// npx shadcn add card')}</> },
    { icon: '⛯', zh: { title: <>v4 的 CSS-first 配置</>, desc: <>tailwind.config.js 退场, token 全在 CSS 的 <code>@theme</code> 里。这意味着设计师能直接读懂配置, 不用学 JS 对象语法。</> }, en: { title: <>v4 CSS-first config</>, desc: <>tailwind.config.js retired; tokens live inside the CSS <code>@theme</code>. Designers can read the config without learning a JS object dialect.</> }, code: <>{k('@theme')} {'{ '}--color-brand: ...{' }'}</> },
    { icon: '⌥', zh: { title: <>AI 工具的母语</>, desc: <>Claude Code / Cursor / v0 / Bolt 在生成组件时几乎一边倒输出 Tailwind class。要求 LLM "用 Tailwind" 的代码比"用 CSS modules" 命中率显著更高。</> }, en: { title: <>AI tools' native dialect</>, desc: <>Claude Code / Cursor / v0 / Bolt overwhelmingly emit Tailwind classes when generating components. Asking an LLM for "Tailwind" yields cleaner output than asking for "CSS modules."</> }, code: <>{c('// Prompt: "card component"')}{'\n'}{c('// → Tailwind 95% of the time')}</> },
    { icon: '⏚', zh: { title: <>取舍清楚</>, desc: <>缺点也实在:class 字符串长、初看像"代码味"差。但工程权衡上, "样式作用域 + 删除友好 + 团队约束" 三件事的收益盖过观感成本。</> }, en: { title: <>Honest trade-offs</>, desc: <>Downsides are real: long class strings, "looks ugly" at first read. But the engineering wins — scoped styles, easy deletion, team-wide constraints — clear the aesthetic cost.</> }, code: <>{c('// long className')}{'\n'}{c('// short maintenance')}</> },
  ],
  adopters: [
    { name: 'GitHub', href: 'https://github.com', highlight: true, zhNote: '部分团队 / 产品页全 Tailwind', enNote: 'Some teams / marketing pages run entirely on Tailwind' },
    { name: 'Vercel', href: 'https://vercel.com', highlight: true, zhNote: '官网 + Next.js docs + 全部 templates', enNote: 'Marketing site, Next.js docs, every official template' },
    { name: 'Shopify', href: 'https://shopify.com', highlight: true, zhNote: 'Hydrogen + Polaris 之外的新页面默认 Tailwind', enNote: 'New pages outside Hydrogen + Polaris default to Tailwind' },
    { name: 'OpenAI', href: 'https://openai.com', zhNote: '官网 + ChatGPT 部分界面', enNote: 'Marketing site, parts of ChatGPT' },
    { name: 'Stripe', href: 'https://stripe.com', zhNote: '部分 docs / dashboard 页面', enNote: 'Sections of docs and dashboard' },
    { name: 'Linear', href: 'https://linear.app', zhNote: '内部 utility 层基于 Tailwind 思想', enNote: 'Internal utility layer inspired by Tailwind' },
    { name: 'shadcn/ui', href: 'https://ui.shadcn.com', highlight: true, zhNote: '2024-25 React 组件库事实标准, Tailwind + Radix', enNote: 'De-facto 2024-25 React component pattern, Tailwind + Radix' },
    { name: 'Headless UI', href: 'https://headlessui.com', zhNote: 'Tailwind Labs 自家无样式组件库', enNote: "Tailwind Labs' own unstyled component library" },
    { name: 'Vercel AI SDK docs', href: 'https://sdk.vercel.ai', zhNote: '官网与示例全 Tailwind', enNote: 'Docs and examples entirely Tailwind' },
    { name: 'Cursor', href: 'https://cursor.com', zhNote: '营销站 + 部分 IDE 界面', enNote: 'Marketing site + parts of the IDE UI' },
    { name: 'Loom', href: 'https://loom.com', zhNote: 'web app 大规模使用', enNote: 'Web app at scale' },
    { name: 'cuberoot.me', highlight: true, zhNote: '装了 v4, 主要作 preflight 基础层 + utility 兜底, 主样式仍是手写语义化 CSS', enNote: 'v4 installed, used mainly as preflight base layer + utility escape hatch; primary styling is hand-rolled semantic CSS' },
  ],
  outlook: [
    { tag: <>HOT · 2026-05</>, hot: true, big: true, zh: { title: <>v4.3 + Oxide 持续优化</>, body: <><p>v4.3 加 scrollbar utility、mauve / olive / mist / taupe 四套新的中性调色板, 还有 <code>@container-size</code>。Oxide 引擎本身继续优化, 增量 build 从 v4.0 的微秒级被压到几乎不可测。</p><p>更深一层意义:Tailwind 不再追"加多少新 utility", 而是追"原生 CSS 新能力上线多快变成 utility"。container queries / @scope / color-mix / oklch 都已经原生化。</p></> }, en: { title: <>v4.3 + ongoing Oxide tuning</>, body: <><p>v4.3 adds scrollbar utilities, four new neutralish palettes (mauve / olive / mist / taupe), and <code>@container-size</code>. The Oxide engine itself keeps tightening; incremental builds from microseconds in v4.0 are now effectively unmeasurable.</p><p>The deeper point: Tailwind no longer chases "how many new utilities" — it chases "how fast new native CSS features become utilities." Container queries / @scope / color-mix / oklch are all first-class now.</p></> } },
    { tag: 'SHADCN', zh: { title: <>shadcn/ui 锁定生态</>, body: <><p>2024-25 React 组件库的事实路径是 shadcn/ui:一个 CLI, <code>npx shadcn add button</code> 把 Tailwind + Radix Primitives 的源码拷进你的项目, 你直接改。这一套深度绑定 Tailwind 的设计 token + utility class 系统, 短期内没有竞品可替代。</p></> }, en: { title: <>shadcn/ui locks the ecosystem</>, body: <><p>The 2024-25 path for React component libraries is shadcn/ui: a CLI, <code>npx shadcn add button</code> drops Tailwind + Radix Primitives source straight into your project, you edit it. The whole approach is deeply bound to Tailwind's design tokens + utility classes — no near-term competitor.</p></> } },
    { tag: 'CSS-FIRST', zh: { title: <>配置写在 CSS 里</>, body: <><p>v4 把 <code>tailwind.config.js</code> 干掉, 全部 token 走 CSS 的 <code>@theme</code> directive。这一步让设计师能直接读懂配置, 让 token 跟 CSS custom property 同源, 让"主题切换"变成 <code>:root[data-theme=dark]</code> 一行。</p></> }, en: { title: <>Configuration inside CSS</>, body: <><p>v4 retires <code>tailwind.config.js</code> and moves every token into the CSS <code>@theme</code> directive. Designers read config directly, tokens share storage with CSS custom properties, and theme switching collapses to a one-line <code>:root[data-theme=dark]</code>.</p></> } },
    { tag: <>AI</>, zh: { title: <>AI 工具的默认输出</>, body: <><p>Claude Code / Cursor / v0 / Bolt 生成组件时几乎一边倒输出 Tailwind utility class。给 LLM 的训练数据里 Tailwind 样本远多于 CSS modules / vanilla-extract / Emotion, 这一轮 AI 浪潮把它的地位又加固一层。</p></> }, en: { title: <>The default output of AI tools</>, body: <><p>Claude Code / Cursor / v0 / Bolt almost unanimously emit Tailwind utility classes when generating components. LLM training corpora include far more Tailwind samples than CSS modules / vanilla-extract / Emotion, and the AI wave entrenched the framework further.</p></> } },
    { tag: <>DATA</>, zh: { title: <>State of CSS 第一名</>, body: <><p>State of CSS 2025 调查里, 2041 / 2863 (~71%) 的 framework 使用者选 Tailwind, Bootstrap ~ 42%。npm 周下载 9700 万, 是 Bootstrap 的 17 倍。同时 Tailwind Labs 商业可持续靠 Tailwind UI / Tailwind Plus 维持, 不烧 VC 钱。</p></> }, en: { title: <>State of CSS #1</>, body: <><p>State of CSS 2025: 2041 / 2863 (~71%) of framework users pick Tailwind; Bootstrap sits at ~42%. 97M weekly npm downloads, ~17x Bootstrap. Tailwind Labs stays commercially sustainable on Tailwind UI / Tailwind Plus — no VC burn.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>实话说:cuberoot.me 装了 Tailwind v4, 但<strong>几乎没在 JSX 里写 utility class</strong>。<code>packages/client/vite.config.ts</code> 里挂了 <code>@tailwindcss/vite</code> 插件, <code>src/index.css</code> 顶部一行 <code>@import "tailwindcss"</code>, 就这两处。</p>
        <p>Tailwind 在本站实际承担的角色是:(1) <strong>preflight 基础层</strong> —— 替代了 normalize.css 那一角, 把 <code>h1/h2/ul</code> 等的浏览器默认样式清成中性;(2) <strong>utility class 作为兜底逃生口</strong> —— 极少数地方写 <code>flex</code> <code>gap-2</code> 这种, 但不是主流。</p>
        <p>主样式是<strong>每页一份手写语义化 CSS</strong>:<code>compare.css</code> / <code>stack_landing.css</code> / <code>stack_intro.css</code> / <code>code_landing.css</code> ... 类名也是页面前缀化的 (<code>.compare-card</code> / <code>.stack-card-glyph</code> / <code>.code-landing-hero</code>), 而不是 <code>flex p-4 rounded-lg bg-sky-500</code> 这种 utility chain。原因很简单:本站的视觉风格 (黑底 / 沿用 cuber 配色 / 大量自绘装饰图) 跟 Tailwind 的设计 token scale 不重合, 强用 utility 反而写得更长。</p>
        <p>主题系统也<strong>没用</strong> Tailwind 的 <code>@theme</code> directive。颜色 token 走 shadcn 风格的 CSS custom property + <code>color-mix(in srgb, ...)</code> 衍生 (见 <code>theme-tokens</code> skill), 由 <code>:root[data-theme=dark]</code> / <code>:root[data-theme=light]</code> 两套覆盖切换。</p>
        <p>把 Tailwind 留着的理由:(1) preflight reset 很好用, 不想为这一角单独引 normalize.css;(2) 如果未来某页想用 shadcn/ui 组件, 已经有底子;(3) 偶尔需要"一次性写个小 flex 容器"时 utility 上手即用。但<strong>不要</strong>因为站点装了 Tailwind 就误以为这是"Tailwind 站"。</p>
      </>
    ),
    en: (
      <>
        <p>Straight up: cuberoot.me has Tailwind v4 installed, but <strong>almost no utility classes are written in the JSX</strong>. There are only two touch points — <code>@tailwindcss/vite</code> plugged into <code>packages/client/vite.config.ts</code>, and a single <code>@import "tailwindcss"</code> at the top of <code>src/index.css</code>.</p>
        <p>Tailwind's actual role on this site: (1) <strong>preflight base layer</strong> — taking over the normalize.css slot, neutralizing browser defaults on <code>h1/h2/ul</code> and friends; (2) <strong>utility class as an escape hatch</strong> — occasional <code>flex</code> / <code>gap-2</code> sprinkled in, but not the main pattern.</p>
        <p>Primary styling is <strong>hand-rolled semantic CSS, one file per page</strong>: <code>compare.css</code> / <code>stack_landing.css</code> / <code>stack_intro.css</code> / <code>code_landing.css</code> ... Class names are page-prefixed (<code>.compare-card</code> / <code>.stack-card-glyph</code> / <code>.code-landing-hero</code>) rather than <code>flex p-4 rounded-lg bg-sky-500</code> chains. The reason is simple: this site's visual language (black backgrounds, cuber-inspired palette, lots of hand-drawn decorative SVG) doesn't line up with Tailwind's token scale — forcing utility classes here would make markup longer, not shorter.</p>
        <p>The theme system also <strong>does not use</strong> Tailwind's <code>@theme</code> directive. Color tokens flow through shadcn-style CSS custom properties + <code>color-mix(in srgb, ...)</code> derivations (see the <code>theme-tokens</code> skill), and switch via <code>:root[data-theme=dark]</code> / <code>:root[data-theme=light]</code>.</p>
        <p>Reasons to keep Tailwind installed anyway: (1) preflight is a clean reset and not worth swapping out for normalize.css; (2) future pages might want shadcn/ui components and the foundation is already in place; (3) the utility escape hatch helps for the occasional one-off small flex container. But <strong>don't</strong> mistake "Tailwind installed" for "Tailwind site."</p>
      </>
    ),
  },
  links: [
    { label: 'tailwindcss.com', href: 'https://tailwindcss.com' },
    { label: 'GitHub · tailwindlabs/tailwindcss', href: 'https://github.com/tailwindlabs/tailwindcss' },
    { label: 'v4.0 announcement', href: 'https://tailwindcss.com/blog/tailwindcss-v4' },
    { label: 'v4.3 release notes', href: 'https://tailwindcss.com/blog/tailwindcss-v4-3' },
  ],
};

export default TAILWIND;
