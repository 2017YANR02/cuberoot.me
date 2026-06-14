import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, f, p, c } from '../_lib/stack_tool_types';

// ─── pnpm 11 ────────────────────────────────────────────────────────────────

export const PNPM: StackTool = {
  slug: 'pnpm',
  name: 'pnpm',
  version: '11.1.2',
  since: '2017-01',
  group: 'dev',
  accent: '#F69220',
  bright: '#FBB048',
  glyph: '⬢',
  floats: ['workspace', '--filter', 'content-addressable', 'hard-link', 'lockfile', 'dlx', 'pnpm-workspace.yaml', 'strict node_modules', '.pnpm/', 'workspace:*', 'store', 'monorepo'],
  zh: {
    tagline: '硬链接 + 内容寻址的 npm 替代品',
    role: 'cuberoot.me monorepo 的包管理器, 把 11 个 workspace 串成一棵共享树。',
    heroSub: <>npm / yarn 把 node_modules 摊得到处都是, 一份 lodash 在硬盘上躺一百份; pnpm 把所有版本去重存进一个全局 store, 项目目录里只留硬链接。结果是 <strong>装更快、占盘更少、phantom dependency 直接堵死</strong>。Zoltan Kochan 2017 年发了 v1, 八年后 11.x 已经是新项目和大型 monorepo 的默认选择。</>,
    whatDesc: <>pnpm 是个 <strong>包管理器</strong>, 接口跟 npm 几乎一样 (<code>install</code> / <code>add</code> / <code>run</code>), 内核做了三件事:把所有版本去重塞进全局 store、用硬链接把包接进项目、用<strong>严格 node_modules 布局</strong>禁止你引用没声明的依赖。这三件单独看都不算革命, 合起来就是 npm 多年解决不了的痛点。</>,
    historyDesc: <>2016 年 Rico Sta. Cruz 写了第一版原型 (灵感来自 Alexander Gugel 的 ied), 2017 年 1 月 npm 上首发, 同年 6 月 Zoltan Kochan 发布 v1。后面九年是稳步迭代:workspace、严格 node_modules、catalog、SQLite store, 没有任何一个 "大破大立" 版本, 但每个 major 都在挤性能或修正确性。</>,
    conceptsTitle: 'Store + 硬链接 + workspace 三板斧',
    conceptsDesc: <>pnpm 的可观察 CLI 跟 npm 几乎重叠, 不重叠的部分都来自三件事:<code>~/.local/share/pnpm/store</code> 全局存所有版本、项目里用<strong>硬链接 + symlink</strong> 接进来、<code>pnpm-workspace.yaml</code> 把多个包当一棵树管。</>,
    whyDesc: <>2026 年继续选 pnpm 而不是 npm / yarn / Bun, 不是因为 "更快几百毫秒", 而是<strong>占盘少一个数量级</strong>、<strong>phantom dep 直接报错</strong>、<strong>workspace + filter 是 monorepo 一等公民</strong>这三件事其它工具都还不齐。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Vue 生态全家桶 (Vite / Vitest / Nuxt) 全部 pnpm, Astro / Prisma / Remix / TanStack 也是。AI 一代工具 (Claude Code / Bun 自己的仓库) 大量切到 pnpm。本站 (cuberoot.me) 同样。</>,
    cuberootDesc: <>本仓库 <code>core/</code> 是 pnpm workspace 根, 11 个 package 共享一份 <code>pnpm-lock.yaml</code>。日常命令都走 <code>pnpm --filter @cuberoot/client …</code>, 而不是 <code>cd</code> 进子包。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>v11 (2026-04) 把 store 从 "一个包一个 JSON" 换成单一 SQLite 文件, 收紧 supply-chain 默认值, 强制要求 Node 22+。下一步 catalog / overrides 进一步标准化, 大型 monorepo 的依赖治理只会更省心。</>,
  },
  en: {
    tagline: 'A drop-in npm replacement, with a content-addressable store and hard links',
    role: 'Package manager for the cuberoot.me monorepo — stitches 11 workspaces into a shared tree.',
    heroSub: <>npm / yarn spread node_modules everywhere; a hundred copies of lodash on disk. pnpm dedupes every version into one global store and only puts hard links into project folders. Result: <strong>faster installs, an order-of-magnitude less disk, phantom dependencies blocked at the door.</strong> Zoltan Kochan shipped v1 in 2017; eight years later pnpm 11 is the default for new projects and large monorepos.</>,
    whatDesc: <>pnpm is a <strong>package manager</strong> with an interface almost identical to npm (<code>install</code> / <code>add</code> / <code>run</code>). The kernel does three things: dedupe every version into a global store, link packages into projects via hard links, and enforce a <strong>strict node_modules layout</strong> that forbids importing what you didn't declare. None is revolutionary alone — together they fix the npm pain points that lingered for years.</>,
    historyDesc: <>Rico Sta. Cruz drafted the prototype in 2016 (drawing on Alexander Gugel's ied); the first npm publish was January 2017, and Zoltan Kochan announced v1 in June 2017. Nine years of steady iteration since: workspaces, strict layout, catalog, an SQLite store — no scorched-earth majors, but every release squeezes perf or sharpens correctness.</>,
    conceptsTitle: 'Store + hard links + workspaces',
    conceptsDesc: <>The observable CLI mostly overlaps with npm; the deltas all come from three pieces: a global store at <code>~/.local/share/pnpm/store</code>, project trees stitched with <strong>hard links + symlinks</strong>, and <code>pnpm-workspace.yaml</code> turning a folder of packages into a single tree.</>,
    whyDesc: <>Picking pnpm over npm / yarn / Bun in 2026 is not about "a few hundred ms faster." It's the combination of <strong>order-of-magnitude less disk</strong>, <strong>phantom dependencies caught at install</strong>, and <strong>first-class workspace + filter</strong> that the others still don't match.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>The whole Vue ecosystem (Vite / Vitest / Nuxt) runs on pnpm. Astro / Prisma / Remix / TanStack too. The AI-tool generation (Claude Code, Bun's own repo) increasingly defaults to pnpm. So does this site.</>,
    cuberootDesc: <>This repo's <code>core/</code> is a pnpm workspace root — 11 packages sharing one <code>pnpm-lock.yaml</code>. Day-to-day commands run through <code>pnpm --filter @cuberoot/client …</code> instead of <code>cd</code>-ing into a sub-package.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>v11 (2026-04) replaces the "one JSON per package" store with a single SQLite file, tightens supply-chain defaults, and requires Node 22+. Next up: catalog / overrides standardizing further — dependency hygiene in large monorepos only gets easier from here.</>,
  },
  heroStats: [
    { num: '11', unit: '.1', zh: <>当前稳定 <em>2026-05 · 11.1.2</em></>, en: <>current stable <em>2026-05 · 11.1.2</em></>
    },
    { num: '~3', unit: 'x', zh: <>同条件下比 npm 快 <em>warm install ~755 ms</em></>, en: <>warm install vs npm <em>~755 ms</em></>
    },
    { num: '1', unit: 'x', zh: <>每个版本只存一份 <em>全局 store 去重</em></>, en: <>one copy per version <em>global store dedup</em></>
    },
    { num: '9', unit: 'y', zh: <>从 2017 至今 <em>稳步迭代,无大破大立</em></>, en: <>since 2017 <em>steady, no scorched-earth majors</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>pnpm 来自 2016 年 Rico Sta. Cruz 的一个原型, 灵感是 Alexander Gugel 2015 年的实验性 <em>ied</em>。问题非常具体:npm 当时把每个项目的每份依赖都 copy 进自家 node_modules, 一台机器装十个项目, lodash 在硬盘上就有十份。Zoltan Kochan 在这套原型上接手, 2017 年 1 月把第一版发上 npm, 6 月发布 v1, 从此 pnpm 成为常规可选项。</p>
        <p>核心想法朴素到反直觉:全机器只在一个地方存所有版本 (内容寻址 store), 项目里要哪个版本就<strong>硬链接</strong>过去。文件系统层面文件是同一份 inode, 占盘几乎为零;Node 看到的还是一个完整 node_modules 目录。再叠一层"严格布局" —— 只把声明过的依赖暴露在 node_modules 顶层, 没声明的连看都看不到 —— phantom dependency 这个折磨过整个生态的问题就此被堵死。</p>
        <p>2019 年 workspace 落地, pnpm 一下变成 monorepo 一等公民。2022 年 v7 把 monorepo 协议 (<code>workspace:*</code>) 标准化, 2024 年 v9 引入 catalog 把版本统一治理, 2026 年 v11 把内部 store 换成 SQLite。九年九个 major, 没有一次推翻自己。同期 npm 仍在追这套设计, yarn 内部分叉, Bun 起势但还不稳。pnpm 是目前最像"已经做完了"的那个。</p>
      </>
    ),
    en: (
      <>
        <p>pnpm started as a 2016 prototype by Rico Sta. Cruz, drawing on Alexander Gugel's 2015 experiment <em>ied</em>. The problem was sharply concrete: npm copied every dependency of every project into its own node_modules — install ten projects on one machine and lodash sat on disk ten times. Zoltan Kochan took the prototype forward, published the first version to npm in January 2017, and announced v1 in June 2017. From then on pnpm was a real option.</p>
        <p>The core idea is almost embarrassingly simple: store every version exactly once on the machine (a content-addressable store), and <strong>hard-link</strong> the right version into each project. At the filesystem level the files share an inode — disk cost is near zero — yet Node still sees a complete node_modules tree. Layer on a "strict layout" — only declared dependencies are visible at the top of node_modules, undeclared ones are invisible — and the phantom-dependency disease that haunted the whole ecosystem is blocked.</p>
        <p>Workspaces landed in 2019, instantly making pnpm a first-class monorepo tool. v7 (2022) standardized the <code>workspace:*</code> protocol; v9 (2024) introduced catalogs for unifying versions; v11 (2026) swapped the store backend to a single SQLite file. Nine majors in nine years, no rewrites. npm is still chasing the design, yarn forked internally, Bun is rising but unstable. pnpm is the one that looks most "done."</p>
      </>
    ),
  },
  history: [
    { year: '2015', zh: { title: <>ied 原型</>, desc: <>Alexander Gugel 写 <em>ied</em>:用 symlink + content-addressable store 重做 npm install。pnpm 的所有核心想法在这里出现。</> }, en: { title: <>The ied prototype</>, desc: <>Alexander Gugel writes <em>ied</em>: re-implement npm install via symlinks + a content-addressable store. Every core pnpm idea is already here.</> } },
    { year: '2016·01', zh: { title: <>pnpm 仓库初始 commit</>, desc: <>Rico Sta. Cruz 把 ied 的想法落到一个新仓库, 名字 "pnpm" = performant npm。</> }, en: { title: <>pnpm initial commit</>, desc: <>Rico Sta. Cruz reshapes ied's ideas into a new repo. The name "pnpm" = performant npm.</> } },
    { year: '2017·01', zh: { title: <>首次 npm 发布</>, desc: <>Zoltan Kochan 接手主维护, 把第一版发上 npm。开始有用户从 npm 切过来。</> }, en: { title: <>First npm publish</>, desc: <>Zoltan Kochan takes over as lead maintainer; first publish to npm. Early adopters start switching from npm.</> } },
    { year: '2017·06', zh: { title: <>v1.0</>, desc: <>Kochan 在 Medium 上正式宣布 pnpm 1.0。同时确立 "硬链接 + symlink + 严格 node_modules" 三件套。</> }, en: { title: <>v1.0</>, desc: <>Kochan announces pnpm 1.0 on Medium. The hard-link + symlink + strict node_modules trio is established as the design.</> } },
    { year: '2019·07', zh: { title: <>v4 — workspace</>, desc: <>原生 monorepo 支持落地。<code>pnpm-workspace.yaml</code> + <code>--filter</code> 一上线就把 Lerna 的活吃掉一半。</> }, en: { title: <>v4 — workspaces</>, desc: <>Native monorepo support lands. <code>pnpm-workspace.yaml</code> + <code>--filter</code> immediately eat half of Lerna's job.</> } },
    { year: '2020·10', zh: { title: <>v5 — 锁文件 v6</>, desc: <>lockfile 格式重写, 同一锁文件可被多版本 pnpm 读懂。这次升级让公司级 monorepo 敢全面切过来。</> }, en: { title: <>v5 — lockfile v6</>, desc: <>Lockfile format rewritten so the same file is forward/backward compatible across pnpm versions. The push that lets company-scale monorepos migrate.</> } },
    { year: '2022·02', zh: { title: <>v7 — workspace:* 协议</>, desc: <>跨包依赖正式有了协议:<code>"@cuberoot/shared": "workspace:*"</code>。配合 <code>pnpm publish</code> 自动改写, 发版工作流终于干净。</> }, en: { title: <>v7 — workspace:* protocol</>, desc: <>Cross-package deps get a real protocol: <code>"@cuberoot/shared": "workspace:*"</code>. Pair with <code>pnpm publish</code>'s auto-rewriting and the release flow finally feels clean.</> } },
    { year: '2023·05', zh: { title: <>v8 — node-linker=hoisted</>, desc: <>对那些被严格布局打挂的老库, 加 <code>node-linker=hoisted</code> 兜底, 保留 pnpm 优点的同时跟 npm 风格兼容。</> }, en: { title: <>v8 — node-linker=hoisted</>, desc: <>For legacy libs that the strict layout breaks, <code>node-linker=hoisted</code> offers a npm-style fallback while keeping pnpm's other benefits.</> } },
    { year: '2024·05', zh: { title: <>v9 — catalog</>, desc: <>catalog 把 monorepo 里 "20 个 package 都用 react@19" 这种版本统一治理交给一个中心配置。少写一堆重复 ^19。</> }, en: { title: <>v9 — catalog</>, desc: <>Catalog moves "20 packages all use react@19" into one central config. Stops repeating ^19 across every package.json.</> } },
    { year: '2025·03', zh: { title: <>v10 — supply-chain 收紧</>, desc: <>默认禁掉 lifecycle script 的隐式执行, 强制 hooks 显式 opt-in。后 supply-chain 攻击 (xz、event-stream) 时代的反应。</> }, en: { title: <>v10 — supply-chain hardening</>, desc: <>Lifecycle scripts no longer run by default; hooks must opt in explicitly. A response to the post-xz, post-event-stream era.</> } },
    { year: '2026·04', highlight: true, zh: { title: <>v11 — SQLite store</>, desc: <>store 从 "每个包一个 JSON" 换成单一 SQLite 文件, 元数据读取近乎瞬时。同时 ESM 分发、Node 22+ 强制、publish 不再 fallback 到 npm CLI。</> }, en: { title: <>v11 — SQLite store</>, desc: <>Store backend swapped from per-package JSON to a single SQLite file — metadata reads are near-instant. Plus ESM distribution, mandatory Node 22+, and no more npm-CLI fallback for publish.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>11.1.2 / 当前稳定</>, desc: <>2026-05 最新 patch。本仓库 <code>package.json</code> 的 <code>packageManager</code> 字段锁的就是这个版本。</> }, en: { title: <>11.1.2 / current stable</>, desc: <>Latest patch as of 2026-05. This repo's <code>package.json</code> pins exactly this version under <code>packageManager</code>.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>内容寻址全局 store</>, desc: <>所有包按 sha512 哈希存在 <code>~/.local/share/pnpm/store</code>。同一版本同一文件全机器只存一份。</> }, en: { title: <>Content-addressable global store</>, desc: <>Every package file is keyed by sha512 in <code>~/.local/share/pnpm/store</code>. A version's bytes exist exactly once per machine.</> }, code: <code>~/.local/share/pnpm/store/v3/{'\n'}  files/{'\n'}    a8/{'\n'}      d5e2f3...  {c('# react@19.2.0/index.js')}</code> },
    { tag: 'B', zh: { title: <>硬链接进项目</>, desc: <>store 里的文件用硬链接接进每个项目的 <code>node_modules/.pnpm/</code>, 项目顶层 <code>node_modules</code> 是 symlink 指过去。占盘几乎零。</> }, en: { title: <>Hard-link into the project</>, desc: <>Files are hard-linked from the store into each project's <code>node_modules/.pnpm/</code>; the top-level <code>node_modules</code> is symlinks pointing in. Disk cost ~0.</> }, code: <code>node_modules/{'\n'}  react -&gt; .pnpm/react@19.2.0/node_modules/react{'\n'}  .pnpm/{'\n'}    react@19.2.0/{'\n'}      node_modules/react/ {c('# hard links')}</code> },
    { tag: 'C', zh: { title: <>严格 node_modules 布局</>, desc: <>只把 <code>dependencies</code> 里声明的包暴露在顶层。没声明就 import 不到 —— phantom dependency 被堵死。</> }, en: { title: <>Strict node_modules layout</>, desc: <>Only packages listed in <code>dependencies</code> appear at the top of node_modules. Anything undeclared is unimportable — phantom deps are blocked.</> }, code: <code>{c('// package.json says: react only')}{'\n'}{k('import')} {v('foo')} {k('from')} {s('"lodash"')};{'\n'}{c('// ❌ ERR_MODULE_NOT_FOUND')}</code> },
    { tag: 'D', zh: { title: <>pnpm-workspace.yaml</>, desc: <>声明哪些子目录是 workspace 包。一个 lockfile 管所有, 跨包依赖用 <code>workspace:*</code> 协议。</> }, en: { title: <>pnpm-workspace.yaml</>, desc: <>Declare which subdirectories are workspace packages. One lockfile rules them all; cross-package deps use the <code>workspace:*</code> protocol.</> }, code: <code>{c('# pnpm-workspace.yaml')}{'\n'}{p('packages')}:{'\n'}  - {s("'packages/*'")}</code> },
    { tag: 'E', zh: { title: <>--filter 选包</>, desc: <>monorepo 里指定动作只对哪个 (或哪些) 包生效。最常用的 <code>--filter @org/client</code> 或 <code>--filter '...^@org/client'</code> (含依赖)。</> }, en: { title: <>--filter selectors</>, desc: <>In a monorepo, target a specific package (or set). Common forms: <code>--filter @org/client</code> or <code>--filter '...^@org/client'</code> to include its deps.</> }, code: <code>pnpm --filter @cuberoot/client {f('dev')}{'\n'}pnpm --filter {s('"./packages/*"')} {f('build')}</code> },
    { tag: 'F', zh: { title: <>workspace:* 协议</>, desc: <>跨包依赖写 <code>workspace:*</code>, 装包时连成 symlink, 发版时 pnpm 自动替换成真实版本号。</> }, en: { title: <>workspace:* protocol</>, desc: <>Cross-package deps spell <code>workspace:*</code> — at install time they're symlinked; at publish time pnpm rewrites them to a real version.</> }, code: <code>{c('// packages/server/package.json')}{'\n'}{p('"dependencies"')}: {'{'}{'\n'}  {p('"@cuberoot/shared"')}: {s('"workspace:*"')}{'\n'}{'}'}</code> },
    { tag: 'G', zh: { title: <>pnpm dlx</>, desc: <>对应 npm 的 <code>npx</code>。从 store 临时跑一个 CLI, 不污染当前 node_modules。比 npx 快, 因为命中 store 缓存。</> }, en: { title: <>pnpm dlx</>, desc: <>The <code>npx</code> equivalent. Runs a CLI temporarily out of the store without polluting node_modules. Faster than npx because the store is already warm.</> }, code: <code>pnpm dlx create-vite my-app{'\n'}pnpm dlx tsx {s('"./scripts/seed.ts"')}</code> },
    { tag: 'H', zh: { title: <>lockfile</>, desc: <><code>pnpm-lock.yaml</code> 比 npm 的 package-lock.json 紧凑得多:依赖图按 ID 去重存。同一 lockfile 多版本 pnpm 兼容读。</> }, en: { title: <>The lockfile</>, desc: <><code>pnpm-lock.yaml</code> is much tighter than npm's package-lock.json — the dep graph is deduped by ID. The same file is readable across pnpm majors.</> }, code: <code>{c('# pnpm-lock.yaml (excerpt)')}{'\n'}{p('packages')}:{'\n'}  {p('react@19.2.0')}:{'\n'}    {p('resolution')}:{'\n'}      {p('integrity')}: {v('sha512-...')}</code> },
    { tag: 'I', zh: { title: <>catalog (v9+)</>, desc: <>把 "20 个 package 都用 react@19" 这种统一版本提到一个中心配置。每个包 <code>package.json</code> 里只写 <code>"react": "catalog:"</code>。</> }, en: { title: <>catalog (v9+)</>, desc: <>Lift "20 packages all use react@19" into one central config. Each package.json then just writes <code>"react": "catalog:"</code>.</> }, code: <code>{c('# pnpm-workspace.yaml')}{'\n'}{p('catalog')}:{'\n'}  {p('react')}: {s('"^19.2.0"')}{'\n'}  {p('typescript')}: {s('"^5.7.0"')}</code> },
  ],
  whyCards: [
    { icon: '⬢', zh: { title: <>占盘少一个数量级</>, desc: <>同样十个 React 项目, npm 大概 1.2 GB, pnpm 大概 120 MB —— 同一份文件在 store 里只存一次, 项目里是硬链接。</> }, en: { title: <>An order of magnitude less disk</>, desc: <>Ten typical React projects: ~1.2 GB on npm, ~120 MB on pnpm — the same files live once in the store, projects just hard-link.</> }, code: <>{c('// 10 projects, same react@19')}{'\n'}{c('// npm:  10 × ~120 MB')}{'\n'}{c('// pnpm: 1 × ~120 MB')}</> },
    { icon: '⌬', zh: { title: <>warm install 快 ~3x</>, desc: <>第二次起所有包都已经在 store 里, install 基本就是建硬链接 + 写 symlink。2026 benchmark warm install ~755 ms。</> }, en: { title: <>~3x faster warm installs</>, desc: <>After the first run everything is already in the store. install becomes mostly "make hard links + write symlinks." 2026 benchmark: warm install ~755 ms.</> }, code: <>pnpm install   {c('// warm: ~755ms')}{'\n'}npm install    {c('// warm: ~2.4s')}</> },
    { icon: '⌁', zh: { title: <>phantom dependency 堵死</>, desc: <>npm 把所有依赖摊在顶层, 你 import 个没声明的包它也能跑。pnpm 严格布局直接让这种代码 install 后就跑不起来 —— 越早暴露越好。</> }, en: { title: <>Phantom dependencies blocked</>, desc: <>npm flattens everything to the top, so importing an undeclared dep happens to work. pnpm's strict layout makes such code fail right after install — the earliest exposure is the best.</> }, code: <>{c('// not in package.json')}{'\n'}{k('import')} {v('x')} {k('from')} {s('"some-pkg"')};{'\n'}{c('// ❌ at install time')}</> },
    { icon: '⎇', zh: { title: <>workspace 是一等公民</>, desc: <><code>pnpm-workspace.yaml</code> + <code>--filter</code> 让 monorepo 不再需要 Lerna / Nx 当外层包装。本仓库 11 个 workspace 全靠这套跑。</> }, en: { title: <>Workspaces, first-class</>, desc: <><code>pnpm-workspace.yaml</code> + <code>--filter</code> means monorepos no longer need Lerna / Nx as a wrapper. This repo's 11 workspaces ride exactly this stack.</> }, code: <>pnpm --filter @cuberoot/client {f('dev')}{'\n'}pnpm -r {f('typecheck')}</> },
    { icon: '⚙', zh: { title: <>CLI 跟 npm 几乎重叠</>, desc: <>从 npm 切到 pnpm 不用学新命令:<code>install</code> / <code>add</code> / <code>remove</code> / <code>run</code> / <code>exec</code> 全在。脑回路零迁移成本。</> }, en: { title: <>CLI nearly identical to npm</>, desc: <>Switching from npm requires no new vocabulary: <code>install</code> / <code>add</code> / <code>remove</code> / <code>run</code> / <code>exec</code> all behave the same. Zero retraining cost.</> }, code: <>pnpm add react react-dom{'\n'}pnpm run build{'\n'}pnpm exec tsc -b</> },
    { icon: '⌖', zh: { title: <>跨平台一致</>, desc: <>Windows / macOS / Linux 行为齐平 (Windows 上的硬链接 fallback 自动处理)。CI 跟本地几乎不会出 "我这儿能跑" 的差异。</> }, en: { title: <>Cross-platform parity</>, desc: <>Windows / macOS / Linux behave the same (hard-link fallback on Windows is handled automatically). CI vs. local "works on my machine" drift is rare.</> }, code: <>{c('// same lockfile, all 3 OSes')}{'\n'}{c('// CI passes ≈ local passes')}</> },
    { icon: '⏚', zh: { title: <>supply-chain 默认收紧</>, desc: <>v10 起 lifecycle script 不再隐式跑, hooks 显式 opt-in。后 xz / event-stream 时代的合理默认。</> }, en: { title: <>Tighter supply-chain defaults</>, desc: <>From v10, lifecycle scripts no longer run implicitly; hooks must opt in. A reasonable default in the post-xz, post-event-stream era.</> }, code: <>{c('// pnpm: install does not run')}{'\n'}{c('// postinstall by default now')}</> },
    { icon: '⚐', zh: { title: <>lockfile 紧凑可读</>, desc: <><code>pnpm-lock.yaml</code> 按包 ID 去重存依赖图, 比 npm 的 package-lock.json 小一个数量级, code review 时还能看懂。</> }, en: { title: <>Compact, readable lockfile</>, desc: <><code>pnpm-lock.yaml</code> stores the dep graph deduped by ID. An order of magnitude smaller than npm's package-lock.json, and still readable in code review.</> }, code: <>{c('// pnpm-lock.yaml: ~3k lines')}{'\n'}{c('// package-lock.json: ~30k lines')}</> },
  ],
  adopters: [
    { name: 'Vue / Vite / Vitest', href: 'https://vite.dev', highlight: true, zhNote: 'Evan You 全家桶, 全部 pnpm', enNote: "Evan You's whole stack, all pnpm" },
    { name: 'Nuxt', href: 'https://nuxt.com', highlight: true, zhNote: '官方 monorepo + 模板都 pnpm', enNote: 'Official monorepo + templates are pnpm' },
    { name: 'Astro', href: 'https://astro.build', zhNote: '官方仓库 + 入门模板 pnpm', enNote: 'Official repo and starter templates use pnpm' },
    { name: 'Prisma', href: 'https://prisma.io', zhNote: '官方推荐 pnpm workspace 接 Prisma client', enNote: 'Officially recommends pnpm workspaces for the client' },
    { name: 'Remix / React Router', href: 'https://remix.run', zhNote: 'v3 切了 pnpm + 单 lockfile', enNote: 'v3 migrated to pnpm + a single lockfile' },
    { name: 'TanStack', href: 'https://tanstack.com', zhNote: 'Query / Router / Start 全跑 pnpm', enNote: 'Query / Router / Start all run on pnpm' },
    { name: 'Bun (the repo)', href: 'https://github.com/oven-sh/bun', zhNote: 'Bun 自己的开发流也 pnpm', enNote: "Bun's own dev workflow uses pnpm" },
    { name: 'Logseq', href: 'https://logseq.com', zhNote: '本地优先笔记, monorepo on pnpm', enNote: 'Local-first notes, monorepo on pnpm' },
    { name: 'Lobe Chat', href: 'https://lobehub.com', zhNote: 'LLM 客户端, pnpm workspace', enNote: 'LLM client, pnpm workspaces' },
    { name: 'Shopify Hydrogen', href: 'https://hydrogen.shopify.dev', zhNote: '商家店面模板默认 pnpm', enNote: 'Storefront starter defaults to pnpm' },
    { name: 'Claude Code', href: 'https://github.com/anthropics/claude-code', zhNote: 'Anthropic CLI agent, pnpm 构建', enNote: 'Anthropic CLI agent, built with pnpm' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 core/ 即 pnpm workspace 根, 11 个包', enNote: 'This site — core/ is a pnpm workspace root with 11 packages' },
  ],
  outlook: [
    { tag: <>HOT · 2026-04</>, hot: true, big: true, zh: { title: <>v11 SQLite store</>, body: <><p>store 元数据从每个包一份 JSON 改成单一 SQLite 文件。读 metadata 不再要遍历几千个小文件, install 在 cold cache 下也明显变快。生态后续工具 (pnpm-stats、pnpm-list) 也能直接走 SQL 查询。</p><p>同时 v11 把 ESM 作为发行格式, Node 要求 22+, publish 不再 fallback 到 npm CLI。一次性把"包管理器自己背着 CommonJS + npm CLI" 这两根包袱卸了。</p></> }, en: { title: <>v11 SQLite store</>, body: <><p>Store metadata moves from per-package JSON files to a single SQLite database. No more walking thousands of tiny files for metadata reads; cold-cache install gets noticeably faster. Adjacent tools (pnpm-stats, pnpm-list) can now query the store with plain SQL.</p><p>v11 also ships ESM as the distribution format, requires Node 22+, and removes the npm-CLI fallback for publish. Two long-standing bags of weight — bundled CommonJS and the npm-CLI shim — both dropped in one cut.</p></> } },
    { tag: 'CATALOG', zh: { title: <>catalog 把版本统一治理</>, body: <><p>v9 引入的 catalog 在 2026 已是大型 monorepo 标配。"react@19 在 20 个包里写 20 遍" 这种重复终结, 升级一行改完。catalog 本身也开始有规范化提议进 npm / yarn 那边。</p></> }, en: { title: <>Catalog as version governance</>, body: <><p>Catalog (v9) is now standard in large monorepos by 2026. The "react@19 written 20 times across 20 packages" repetition ends; upgrades are a one-line change. There's even spec work to bring the catalog idea to npm / yarn.</p></> } },
    { tag: 'SUPPLY', zh: { title: <>supply-chain 收紧默认</>, body: <><p>v10 起 lifecycle script (<code>postinstall</code> 等) 默认不跑, 必须显式 opt-in。v11 进一步把 publish 流程的信任链做严。pnpm 在三大包管理器里对 supply-chain 攻击的态度最积极。</p></> }, en: { title: <>Supply-chain defaults tightened</>, body: <><p>Since v10, lifecycle scripts (<code>postinstall</code>, etc.) don't run by default; you opt in explicitly. v11 hardens the publish trust chain further. Among the three major package managers, pnpm has been the most proactive on supply-chain attacks.</p></> } },
    { tag: <>DATA</>, zh: { title: <>占有率持续上升</>, body: <><p>2026 上半年 pnpm 在新建 TS / Vue / React 项目里的占有率超过 50%, 在大型 monorepo 占有率第一。npm 仍是绝对下载量第一, 但增量市场基本被 pnpm 拿走。</p></> }, en: { title: <>Share keeps rising</>, body: <><p>In H1 2026, pnpm is the choice in over half of newly created TS / Vue / React projects, and is #1 for large monorepos. npm still leads in absolute downloads, but the growth share is going to pnpm.</p></> } },
    { tag: <>BUN</>, zh: { title: <>vs Bun 的分工正在浮现</>, body: <><p>Bun 想"包管理器 + runtime + bundler" 三合一, pnpm 只做包管理器。2026 的观察是:许多团队 runtime 跑 Bun, 但<strong>包管理仍用 pnpm</strong>, 因为 monorepo / workspace / catalog 这一套 Bun 还没追平。</p></> }, en: { title: <>The split with Bun emerges</>, body: <><p>Bun pitches a 3-in-1 (package manager + runtime + bundler); pnpm focuses only on package management. The 2026 pattern: many teams run Bun as their runtime but <strong>keep pnpm for package management</strong> — Bun hasn't caught up on monorepo / workspace / catalog yet.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本仓库根是一个静态 HTML 集合 (来自多个 fork), 真正的开发都在 <code>core/</code> 里。<code>core/</code> 是 pnpm workspace 根, <code>pnpm-workspace.yaml</code> 声明 <code>packages/*</code> 全部纳入。当前有 10 个 workspace:<code>@cuberoot/client</code> (主 SPA)、<code>@cuberoot/server</code> (Hono + PG API)、<code>@cuberoot/shared</code> (共享类型)、<code>@cuberoot/stats-build</code> (WCA 统计管道)、<code>@cuberoot/alg-build</code>、<code>@cuberoot/scramble-stats-build</code>、<code>@cuberoot/stack-kernel</code>、<code>@cuberoot/vendor-sr-puzzlegen</code>、<code>@cuberoot/visualcube</code>、<code>@cuberoot/wb-build</code>。</p>
        <p>跨包依赖一律走 <code>workspace:*</code>。比如 <code>@cuberoot/client</code> import <code>@cuberoot/shared</code> 的类型, package.json 写 <code>"@cuberoot/shared": "workspace:*"</code>, pnpm install 把它 symlink 进去 —— client 改 shared 里的代码立刻看见, 不需要 build 一遍。</p>
        <p>日常命令一律 <code>pnpm --filter @cuberoot/client …</code>, 不进子目录:<code>dev</code> 起 Vite (绑 127.0.0.1:5173), <code>typecheck</code> 是 <code>tsc -b</code> 增量, <code>build</code> 出 dist, <code>lint</code> 跑 ESLint。整库 typecheck 用 <code>pnpm -r typecheck</code> 递归。这些 script 由 turbo 编排, 自动并行 + 缓存 build 产物。</p>
        <p>有一条铁规:<strong><code>pnpm add</code> 必须在 <code>core/</code> 里跑</strong>, 不能在仓库根。仓库根没有 <code>pnpm-workspace.yaml</code>, 在那里 add 会生成一份错误的 lockfile, CI 立刻挂。这条规则写在项目 CLAUDE.md 里, 多 AI 并行时所有 agent 都得遵守。</p>
      </>
    ),
    en: (
      <>
        <p>The repo root is a collection of static HTML (from various forks); all real development lives under <code>core/</code>. <code>core/</code> is the pnpm workspace root — <code>pnpm-workspace.yaml</code> declares <code>packages/*</code> as members. There are 10 workspaces today: <code>@cuberoot/client</code> (the main SPA), <code>@cuberoot/server</code> (Hono + PG API), <code>@cuberoot/shared</code> (shared types), <code>@cuberoot/stats-build</code> (WCA stats pipeline), <code>@cuberoot/alg-build</code>, <code>@cuberoot/scramble-stats-build</code>, <code>@cuberoot/stack-kernel</code>, <code>@cuberoot/vendor-sr-puzzlegen</code>, <code>@cuberoot/visualcube</code>, <code>@cuberoot/wb-build</code>.</p>
        <p>Cross-package deps all use <code>workspace:*</code>. For example, <code>@cuberoot/client</code> imports types from <code>@cuberoot/shared</code> via <code>"@cuberoot/shared": "workspace:*"</code>. pnpm install symlinks it — edits to shared show up in client immediately, no rebuild step.</p>
        <p>Daily commands always run as <code>pnpm --filter @cuberoot/client …</code> without changing directories: <code>dev</code> starts Vite (bound to 127.0.0.1:5173), <code>typecheck</code> is an incremental <code>tsc -b</code>, <code>build</code> emits dist, <code>lint</code> runs ESLint. Whole-repo typecheck is <code>pnpm -r typecheck</code>. These scripts are orchestrated by turbo for parallelism + build-artifact caching.</p>
        <p>One hard rule: <strong><code>pnpm add</code> must run inside <code>core/</code></strong>, never from the repo root. The repo root has no <code>pnpm-workspace.yaml</code>; adding there produces a wrong lockfile and CI fails immediately. The rule is in the project's CLAUDE.md so every AI agent working in parallel respects it.</p>
      </>
    ),
  },
  links: [
    { label: 'pnpm.io', href: 'https://pnpm.io' },
    { label: 'GitHub · pnpm/pnpm', href: 'https://github.com/pnpm/pnpm' },
    { label: 'v11 announcement', href: 'https://pnpm.io/blog/releases/11.0' },
    { label: 'Motivation', href: 'https://pnpm.io/motivation' },
    { label: 'Workspaces', href: 'https://pnpm.io/workspaces' },
  ],
};

export default PNPM;
