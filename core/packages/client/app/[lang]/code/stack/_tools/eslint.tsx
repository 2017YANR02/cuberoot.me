import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, f, p, c, t } from '../_lib/stack_tool_types';

// ─── ESLint 10 ──────────────────────────────────────────────────────────────

export const ESLINT: StackTool = {
  slug: 'eslint',
  name: 'ESLint',
  version: '10.4.0',
  since: '2013-06',
  group: 'dev',
  accent: '#4B32C3',
  bright: '#8B6FE8',
  glyph: '⬣',
  floats: ['AST', 'espree', 'flat config', 'no-unused-vars', '--fix', 'plugin', 'parser', 'rule', 'eslint.config.mjs', 'severity', 'ESTree', 'visitor'],
  zh: {
    tagline: '可插拔的 JavaScript 静态检查器',
    role: '本站 client 的代码检查。一条 flat config 规则: 强制 playwright 脚本走 headless.mjs 包装, 不直接 import 浏览器引擎。',
    heroSub: <>它不跑你的代码, 而是把代码解析成抽象语法树 (AST), 让每一条规则像访客一样遍历树、对不喜欢的节点报错。每条规则都可插拔、可配严重度、能自动修。2013 年 Nicholas Zakas 厌倦了 JSHint 的固定检查清单, 做了一个 "规则全部可配" 的 linter, 十三年后它是整个 JS/TS 生态事实上的唯一标准。</>,
    whatDesc: <>ESLint 是一个<strong>把源码解析成 AST、再用一组规则遍历它</strong>的静态分析工具。它的核心不是某套检查, 而是 "规则即插件" 这个架构: 每条规则订阅某些 AST 节点类型, 命中就报 warning / error, 可选地给出自动修复。语法解析交给 espree (默认) 或可换的 parser (TypeScript / Vue), 所以同一个引擎能检查任何方言。</>,
    historyDesc: <>从 2013 年 "比 JSHint 更可配" 的小工具, 到 2024 年 v9 把 flat config 设成默认、2026 年 v10 彻底删掉旧 eslintrc 体系, 十三年。中间它吞掉了 JSCS (格式化)、接管了 TSLint (TypeScript), 又主动把格式化规则让给 Prettier —— 一路做加法也做减法。</>,
    conceptsTitle: 'flat config 与规则模型',
    conceptsDesc: <>ESLint 的全部能力压在几个原子上: 一份 <code>eslint.config.mjs</code> (config 对象数组)、一个把代码变成 AST 的 parser、一组订阅节点的 rule、三档严重度。插件不过是 "一捆规则 + 可选 parser"。</>,
    whyDesc: <>2026 年要给 JS/TS 项目上静态检查, ESLint 仍是默认: 规则生态最全、编辑器集成最深、type-aware 检查靠 typescript-eslint 无可替代。新挑战者 Oxlint / Biome 用 Rust 抢速度, 但规则覆盖与可扩展性还差一截。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>几乎全部主流 JS/TS 仓库: TypeScript、VS Code、React、Vue、Babel、webpack 自己都用 ESLint 守门。Airbnb 的 config、typescript-eslint、eslint-plugin-react 是事实标准依赖。</>,
    cuberootDesc: <>本站 client 跑 ESLint 9.39 flat config, 但只立了一条规则 —— 把它当 "护栏" 而非 "风格警察"。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>v10 (2026-02) 是 "只剩 flat config" 的清算版本。接下来主线: 跟 Oxlint / Biome 的速度竞赛、language 插件 (原生检查 JSON / Markdown / CSS)、把格式化彻底交给 Prettier。</>,
  },
  en: {
    tagline: 'The pluggable JavaScript linter',
    role: "Code-checks the site's client. One flat-config rule: force playwright scripts through the headless.mjs wrapper instead of importing a browser engine directly.",
    heroSub: <>It doesn't run your code — it parses it into an abstract syntax tree (AST) and lets every rule walk the tree like a visitor, flagging the nodes it dislikes. Each rule is pluggable, has a configurable severity, and can auto-fix. In 2013 Nicholas Zakas, tired of JSHint's fixed checklist, built a linter where "every rule is configurable"; thirteen years later it's the de-facto single standard of the entire JS/TS ecosystem.</>,
    whatDesc: <>ESLint is a static analyzer that <strong>parses source into an AST and walks it with a set of rules</strong>. Its core isn't a particular set of checks — it's the "rule as plugin" architecture: each rule subscribes to certain AST node types, raises a warning / error on a hit, and optionally provides a fix. Parsing is delegated to espree (default) or a swappable parser (TypeScript / Vue), so one engine can lint any dialect.</>,
    historyDesc: <>From a 2013 tool that was "more configurable than JSHint" to v9 making flat config the default in 2024 and v10 removing the old eslintrc system entirely in 2026 — thirteen years. Along the way it absorbed JSCS (formatting), took over from TSLint (TypeScript), then deliberately ceded formatting rules to Prettier — adding and subtracting at once.</>,
    conceptsTitle: 'flat config and the rule model',
    conceptsDesc: <>ESLint's whole capability rests on a few atoms: an <code>eslint.config.mjs</code> (an array of config objects), a parser that turns code into an AST, a set of node-subscribing rules, three severity levels. A plugin is just "a bundle of rules + an optional parser".</>,
    whyDesc: <>To add static checking to a JS/TS project in 2026, ESLint is still the default: the broadest rule ecosystem, the deepest editor integration, and type-aware linting via typescript-eslint that nothing else matches. Newcomers Oxlint / Biome chase speed in Rust, but lag on rule coverage and extensibility.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Nearly every major JS/TS repo: TypeScript, VS Code, React, Vue, Babel, and webpack itself gate on ESLint. Airbnb's config, typescript-eslint, and eslint-plugin-react are de-facto standard deps.</>,
    cuberootDesc: <>The site's client runs ESLint 9.39 flat config, but with exactly one rule — treating it as a guardrail, not a style cop.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>v10 (2026-02) is the "flat config only" reckoning. The storyline ahead: a speed race against Oxlint / Biome, language plugins (native linting of JSON / Markdown / CSS), and ceding formatting to Prettier for good.</>,
  },
  heroStats: [
    { num: '10', unit: '.4.0', zh: <>当前稳定版 <em>2026-05</em></>, en: <>current stable <em>2026-05</em></>
    },
    { num: '50', unit: 'M+', zh: <>npm 周下载 <em>事实标准</em></>, en: <>weekly npm downloads <em>the de-facto standard</em></>
    },
    { num: '13', unit: 'y', zh: <>从 2013 至今 <em>JS linter 之王</em></>, en: <>since 2013 <em>king of JS linters</em></>
    },
    { num: '1', unit: '条', zh: <>本站立的规则数 <em>护栏不是风格警察</em></>, en: <>rules enabled here <em>guardrail, not style cop</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>2013 年 6 月, Nicholas C. Zakas 公开 ESLint。当时 JS 的 linter 是 JSHint / JSLint, 检查项基本写死, 想加一条自己的规则很难。Zakas 的想法是: 把代码先解析成 AST, 每条规则单独写成一个遍历 AST 的小模块, 全部可开可关、可配严重度。这个 "规则即插件" 的架构让生态能自己长规则, 而不是等核心团队加。</p>
        <p>之后十年它一路吞并: 2016 年起 eslint-plugin-react 让它能查 JSX, 2019 年 typescript-eslint 出现、TSLint 宣布弃用, ESLint 顺势成了 TypeScript 的官方 linter。2023 年 10 月它做了一个反直觉的决定 —— 把所有<strong>格式化 / 风格类规则标记为弃用</strong>, 明说 "格式化交给 Prettier, 我只管找 bug"。职责边界第一次划清。</p>
        <p>配置体系也换了血。2022 年 v8.21 引入 flat config (<code>eslint.config.js</code>): 用普通 JS 数组取代层层继承、魔法解析的 <code>.eslintrc</code>。2024 年 4 月 v9 把 flat config 设成默认, 2026 年 2 月 v10 彻底删掉 eslintrc 引擎 —— <code>--no-eslintrc</code> / <code>--env</code> 等老参数全部移除, 内置 formatter 也拆出去要单独装。v9.x 的支持在 2026-08-06 结束。</p>
      </>
    ),
    en: (
      <>
        <p>In June 2013, Nicholas C. Zakas published ESLint. The JS linters then were JSHint / JSLint, with largely hard-coded checks and no easy way to add your own rule. Zakas's idea: parse code into an AST first, write each rule as a small module that walks the AST, all toggleable with configurable severity. This "rule as plugin" architecture let the ecosystem grow rules itself instead of waiting on the core team.</p>
        <p>Over the next decade it kept absorbing: from 2016 eslint-plugin-react let it check JSX; in 2019 typescript-eslint arrived and TSLint announced deprecation, so ESLint became TypeScript's official linter too. In October 2023 it made a counter-intuitive call — marking all <strong>formatting / stylistic rules as deprecated</strong>, stating plainly "leave formatting to Prettier, I only hunt bugs". The first clean line drawn around its job.</p>
        <p>The config system was overhauled too. v8.21 (2022) introduced flat config (<code>eslint.config.js</code>): a plain JS array replacing the cascading, magic-resolution <code>.eslintrc</code>. v9 (April 2024) made flat config the default, and v10 (February 2026) removed the eslintrc engine entirely — old flags like <code>--no-eslintrc</code> / <code>--env</code> are gone, and built-in formatters are split out to install separately. v9.x support ends 2026-08-06.</p>
      </>
    ),
  },
  history: [
    { year: '2013·06', zh: { title: <>ESLint 诞生</>, desc: <>Nicholas Zakas 公开 ESLint。核心卖点: 代码先解析成 AST, 规则全部可插拔、可配, 跟 JSHint 写死的检查项划清界限。</> }, en: { title: <>ESLint is born</>, desc: <>Nicholas Zakas publishes ESLint. Core pitch: parse code to an AST, every rule pluggable and configurable — a clean break from JSHint's hard-coded checks.</> } },
    { year: '2015·07', zh: { title: <>1.0 — 规则 API 定型</>, desc: <>v1.0 稳定规则 API, 成为 ES6+ 时代的默认 linter。babel-eslint 让它能解析尚未标准化的语法。</> }, en: { title: <>1.0 — rule API settles</>, desc: <>v1.0 stabilizes the rule API and becomes the default linter for the ES6+ era. babel-eslint lets it parse not-yet-standard syntax.</> } },
    { year: '2019·01', zh: { title: <>接管 TypeScript</>, desc: <>typescript-eslint 项目成立, TSLint 同年宣布弃用。ESLint 加上 <code>@typescript-eslint/parser</code> 就能做 type-aware 检查, 一统 JS + TS。</> }, en: { title: <>Takes over TypeScript</>, desc: <>The typescript-eslint project launches; TSLint announces deprecation the same year. With <code>@typescript-eslint/parser</code>, ESLint does type-aware linting — unifying JS + TS.</> } },
    { year: '2021·10', zh: { title: <>8.0 — eslintrc 时代巅峰</>, desc: <>最后一个以 <code>.eslintrc</code> 为默认配置的大版本。ES2022 语法、新规则结构。此后所有演进都指向 flat config。</> }, en: { title: <>8.0 — peak of the eslintrc era</>, desc: <>The last major with <code>.eslintrc</code> as the default config. ES2022 syntax, new rule structure. Everything after points at flat config.</> } },
    { year: '2022·08', zh: { title: <>flat config 实验登场</>, desc: <>v8.21 引入 <code>eslint.config.js</code>: 普通 JS 数组取代层层继承 + 魔法解析的 <code>.eslintrc</code>。配置第一次变成 "就是一段代码"。</> }, en: { title: <>flat config arrives (experimental)</>, desc: <>v8.21 introduces <code>eslint.config.js</code>: a plain JS array replacing the cascading, magic-resolution <code>.eslintrc</code>. Config becomes "just code" for the first time.</> } },
    { year: '2023·10', zh: { title: <>格式化规则弃用</>, desc: <>官方把所有缩进 / 引号 / 分号类格式化规则标弃用, 明说交给 Prettier。残留风格规则迁去社区维护的 <code>@stylistic</code>。ESLint 收窄到 "只找 bug"。</> }, en: { title: <>Formatting rules deprecated</>, desc: <>The team deprecates all indent / quote / semicolon formatting rules, deferring to Prettier. Surviving stylistic rules move to the community-maintained <code>@stylistic</code>. ESLint narrows to "bug-finding only".</> } },
    { year: '2024·04', zh: { title: <>9.0 — flat config 默认</>, desc: <>flat config 成为默认配置格式, <code>.eslintrc</code> 退为兼容模式。整个生态开始迁配置文件。</> }, en: { title: <>9.0 — flat config default</>, desc: <>Flat config becomes the default format; <code>.eslintrc</code> drops to a compatibility mode. The whole ecosystem starts migrating config files.</> } },
    { year: '2026·02', highlight: true, zh: { title: <>10.0 — 删掉 eslintrc</>, desc: <>2 月 GA。eslintrc 引擎彻底移除 (<code>--no-eslintrc</code> / <code>--env</code> / <code>--rulesdir</code> 全删), 内置 formatter 拆成独立包, JSX 引用追踪修正, Program 节点 range 覆盖整段源码。v9.x 支持 2026-08-06 结束。</> }, en: { title: <>10.0 — eslintrc removed</>, desc: <>February GA. The eslintrc engine is fully removed (<code>--no-eslintrc</code> / <code>--env</code> / <code>--rulesdir</code> gone), built-in formatters split into separate packages, JSX reference tracking fixed, the Program node's range now spans the full source. v9.x support ends 2026-08-06.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>10.4.0 / 当前稳定</>, desc: <>2026-05 最新点 release。npm 周下载稳居 5000 万+, 仍是 JS/TS 静态检查无争议的默认。</> }, en: { title: <>10.4.0 / current stable</>, desc: <>Latest patch as of 2026-05. Holds 50M+ weekly npm downloads, still the uncontested default for JS/TS static checking.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>flat config 数组</>, desc: <>一份 <code>eslint.config.mjs</code> 导出 config 对象数组。每个对象用 <code>files</code> / <code>ignores</code> 限定范围, 给 <code>rules</code> / <code>plugins</code> / <code>languageOptions</code>。后面的对象覆盖前面的。</> }, en: { title: <>The flat config array</>, desc: <>One <code>eslint.config.mjs</code> exports an array of config objects. Each scopes itself with <code>files</code> / <code>ignores</code> and sets <code>rules</code> / <code>plugins</code> / <code>languageOptions</code>. Later objects override earlier ones.</> }, code: <code>{k('export')} {k('default')} [{'\n'}  {'{'} {p('files')}: [{s("'**/*.ts'")}], {p('rules')}: {'{ '}...{' }'} {'}'},{'\n'}  {'{'} {p('ignores')}: [{s("'.next/**'")}] {'}'},{'\n'}];</code> },
    { tag: 'B', zh: { title: <>规则 = AST 访客</>, desc: <>每条规则导出一个 <code>create(context)</code>, 返回 "节点类型 → 回调" 的映射。ESLint 遍历 AST, 进到对应节点就调你的回调, 你 <code>context.report()</code> 报错。</> }, en: { title: <>A rule = an AST visitor</>, desc: <>Each rule exports a <code>create(context)</code> returning a "node type → callback" map. ESLint walks the AST and calls your callback on matching nodes; you <code>context.report()</code> a problem.</> }, code: <code>{f('create')}({v('context')}) {'{'}{'\n'}  {k('return')} {'{'} {t('CallExpression')}({v('node')}) {'{'}{'\n'}    {v('context')}.{f('report')}({'{'} {v('node')}, {p('message')}: ... {'}'});{'\n'}  {'}'} {'}'};{'\n'}{'}'}</code> },
    { tag: 'C', zh: { title: <>AST (espree / ESTree)</>, desc: <>代码先被 parser 变成 ESTree 规范的语法树。<code>const x = 1</code> 变成 <code>VariableDeclaration</code> 套 <code>VariableDeclarator</code>。规则只跟这棵树打交道, 不碰原文。</> }, en: { title: <>The AST (espree / ESTree)</>, desc: <>Code is first turned into an ESTree-spec syntax tree by a parser. <code>const x = 1</code> becomes a <code>VariableDeclaration</code> wrapping a <code>VariableDeclarator</code>. Rules only ever touch the tree, not the raw text.</> }, code: <code>{c('// const x = 1  ->')}{'\n'}{c('// VariableDeclaration')}{'\n'}{c('//   VariableDeclarator')}{'\n'}{c('//     id: Identifier "x"')}{'\n'}{c('//     init: Literal 1')}</code> },
    { tag: 'D', zh: { title: <>插件 + 共享 config</>, desc: <>插件就是一捆规则 (可带 parser / processor)。<code>typescript-eslint</code>、<code>eslint-plugin-react</code>、<code>@next/eslint-plugin-next</code> 各自带几十条规则 + 一个 recommended 预设。</> }, en: { title: <>Plugins + shared configs</>, desc: <>A plugin is a bundle of rules (optionally a parser / processor). <code>typescript-eslint</code>, <code>eslint-plugin-react</code>, <code>@next/eslint-plugin-next</code> each ship dozens of rules + a recommended preset.</> }, code: <code>{k('import')} {v('tseslint')} {k('from')} {s("'typescript-eslint'")};{'\n'}{k('export')} {k('default')} {v('tseslint')}.{f('config')}({'\n'}  {v('tseslint')}.{p('configs')}.{p('recommended')},{'\n'});</code> },
    { tag: 'E', zh: { title: <>parser 可换</>, desc: <>默认 espree 只懂标准 JS。换 <code>@typescript-eslint/parser</code> 懂 TS, <code>vue-eslint-parser</code> 懂 <code>.vue</code>。同一个规则引擎因此能查任何方言。</> }, en: { title: <>Swappable parser</>, desc: <>The default espree only knows standard JS. Swap in <code>@typescript-eslint/parser</code> for TS, <code>vue-eslint-parser</code> for <code>.vue</code>. One rule engine, any dialect.</> }, code: <code>{p('languageOptions')}: {'{'}{'\n'}  {p('parser')}: {v('tsParser')},{'\n'}  {p('parserOptions')}: {'{ '}{p('project')}: {k('true')} {'}'},{'\n'}{'}'}</code> },
    { tag: 'F', zh: { title: <>--fix 自动修复</>, desc: <>规则可附带 fixer, 描述如何改写源码区间。<code>eslint --fix</code> 把所有安全修复一次落盘: 删未用 import、补分号、改引号。</> }, en: { title: <>--fix autofix</>, desc: <>A rule can attach a fixer describing how to rewrite a source range. <code>eslint --fix</code> applies all safe fixes at once: remove unused imports, add semicolons, normalize quotes.</> }, code: <code>{c('$ eslint . --fix')}{'\n'}{c('# 12 problems (0 errors, 12 fixed)')}</code> },
    { tag: 'G', zh: { title: <>三档严重度</>, desc: <><code>0/off</code> 关、<code>1/warn</code> 警告、<code>2/error</code> 报错 (退出码非 0, CI 红)。行内 <code>// eslint-disable-next-line</code> 可针对单行豁免。</> }, en: { title: <>Three severities</>, desc: <><code>0/off</code>, <code>1/warn</code>, <code>2/error</code> (non-zero exit, red CI). Inline <code>// eslint-disable-next-line</code> exempts a single line.</> }, code: <code>{p('rules')}: {'{'}{'\n'}  {s("'no-debugger'")}: {s("'error'")},{'\n'}  {s("'no-console'")}: {s("'warn'")},{'\n'}{'}'}</code> },
    { tag: 'H', zh: { title: <>type-aware 检查</>, desc: <>接上 TS 类型信息, 规则能查 "这个 Promise 没 await" / "比较两个永不相等的类型"。typescript-eslint 的 <code>no-floating-promises</code> 这类规则只有靠类型才做得到。</> }, en: { title: <>Type-aware checks</>, desc: <>Wired to TS type info, rules can catch "this Promise is never awaited" / "comparing two types that can never be equal". typescript-eslint rules like <code>no-floating-promises</code> are only possible with types.</> }, code: <code>{s("'@typescript-eslint/no-floating-promises'")}: {s("'error'")}</code> },
  ],
  whyCards: [
    { icon: '⬣', zh: { title: <>规则全可插拔</>, desc: <>基于 AST 的架构意味着任何能用语法树表达的检查都能写成规则。生态因此长出上万条规则, 不靠核心团队。</> }, en: { title: <>Every rule pluggable</>, desc: <>The AST-based architecture means any check expressible over a syntax tree can be a rule. The ecosystem grew tens of thousands of rules without the core team.</> }, code: <>{c('// 一条规则 = 一个 create(context)')}</> },
    { icon: '◆', zh: { title: <>事实标准</>, desc: <>整个 JS/TS 生态默认它。装任何框架的脚手架, 检查工具几乎一定是 ESLint, 团队不必再选型。</> }, en: { title: <>The de-facto standard</>, desc: <>The entire JS/TS ecosystem defaults to it. Scaffold any framework and the linter is almost certainly ESLint — no tool-selection debate.</> }, code: <>{c('// create-next-app 默认带 ESLint')}</> },
    { icon: '⌗', zh: { title: <>flat config 更简单</>, desc: <>config 就是一段 JS 数组, 能 import、能组合、能写逻辑。告别 <code>.eslintrc</code> 的 <code>extends</code> 继承链与魔法路径解析。</> }, en: { title: <>flat config is simpler</>, desc: <>Config is just a JS array — importable, composable, with real logic. Goodbye to <code>.eslintrc</code>'s <code>extends</code> chains and magic path resolution.</> }, code: <>{k('export')} {k('default')} [base, ...overrides];</> },
    { icon: '⌖', zh: { title: <>type-aware 无可替代</>, desc: <>接上 TS 类型信息, 能查纯语法看不出的 bug: 漏 await 的 Promise、永真比较、unsafe any 流动。typescript-eslint 这条线目前别家补不上。</> }, en: { title: <>Type-aware is unmatched</>, desc: <>Wired to TS types, it catches bugs syntax alone can't: un-awaited Promises, always-true comparisons, unsafe any flow. The typescript-eslint line is something rivals can't yet match.</> }, code: <>{c('// no-floating-promises 需要类型')}</> },
    { icon: '◉', zh: { title: <>编辑器实时</>, desc: <>VS Code ESLint 扩展边写边标红, 不必等跑命令。保存自动 <code>--fix</code>, 反馈环以秒计。</> }, en: { title: <>Real-time in the editor</>, desc: <>The VS Code ESLint extension underlines as you type — no need to run a command. <code>--fix</code> on save makes the feedback loop seconds long.</> }, code: <>{c('// editor.codeActionsOnSave')}{'\n'}{c('//   source.fixAll.eslint')}</> },
    { icon: '⟳', zh: { title: <>自动修一大半</>, desc: <>很多规则带 fixer, <code>--fix</code> 一把把删未用变量、整理 import 顺序、补缺失的 key 全做掉, 人只看剩下需要判断的那几条。</> }, en: { title: <>Auto-fixes most of it</>, desc: <>Many rules ship fixers; one <code>--fix</code> removes unused vars, sorts imports, adds missing keys, leaving humans only the few that need judgment.</> }, code: <>{c('$ eslint . --fix')}</> },
    { icon: '⊘', zh: { title: <>抓真 bug 不止风格</>, desc: <><code>no-unused-vars</code>、<code>react-hooks/exhaustive-deps</code>、<code>no-floating-promises</code> 抓的是会出错的逻辑, 不是缩进。格式化交给 Prettier, ESLint 专攻正确性。</> }, en: { title: <>Catches real bugs, not just style</>, desc: <><code>no-unused-vars</code>, <code>react-hooks/exhaustive-deps</code>, <code>no-floating-promises</code> catch buggy logic, not indentation. Formatting goes to Prettier; ESLint focuses on correctness.</> }, code: <>{c('// 漏依赖的 useEffect -> 报错')}</> },
    { icon: '⊞', zh: { title: <>框架专属插件</>, desc: <>React、Next、Vue、import、jsx-a11y 各有官方插件, 把框架特有的坑 (hook 规则、无障碍、循环依赖) 编码成规则集。</> }, en: { title: <>Framework plugins</>, desc: <>React, Next, Vue, import, jsx-a11y each have official plugins encoding framework-specific pitfalls (hook rules, a11y, circular deps) as rule sets.</> }, code: <>{c('// eslint-plugin-react-hooks')}{'\n'}{c('// @next/eslint-plugin-next')}</> },
  ],
  adopters: [
    { name: 'TypeScript', href: 'https://github.com/microsoft/TypeScript', highlight: true, zhNote: '微软, 自身仓库用 ESLint 守门', enNote: "Microsoft — its own repo gates on ESLint" },
    { name: 'VS Code', href: 'https://github.com/microsoft/vscode', highlight: true, zhNote: '官方 ESLint 扩展 + 自身用它', enNote: 'Official ESLint extension + uses it itself' },
    { name: 'React', href: 'https://github.com/facebook/react', zhNote: 'eslint-plugin-react-hooks 出自这里', enNote: 'eslint-plugin-react-hooks originates here' },
    { name: 'Next.js', href: 'https://nextjs.org', zhNote: '@next/eslint-plugin-next 官方插件', enNote: 'Official @next/eslint-plugin-next plugin' },
    { name: 'Vue', href: 'https://vuejs.org', zhNote: 'eslint-plugin-vue + vue-eslint-parser', enNote: 'eslint-plugin-vue + vue-eslint-parser' },
    { name: 'Airbnb', href: 'https://github.com/airbnb/javascript', zhNote: 'eslint-config-airbnb 一代风格基准', enNote: 'eslint-config-airbnb — a generational style baseline' },
    { name: 'typescript-eslint', href: 'https://typescript-eslint.io', highlight: true, zhNote: '把 ESLint 接上 TS 类型系统', enNote: 'Wires ESLint into the TS type system' },
    { name: 'Babel', href: 'https://babeljs.io', zhNote: '@babel/eslint-parser 解析前沿语法', enNote: '@babel/eslint-parser parses bleeding-edge syntax' },
    { name: 'Prettier', href: 'https://prettier.io', zhNote: '分工伙伴: 它管格式, ESLint 管 bug', enNote: 'Division of labor: it formats, ESLint finds bugs' },
    { name: 'Shopify', href: 'https://github.com/Shopify/web-configs', zhNote: '公开自家 ESLint config 套件', enNote: 'Publishes its own ESLint config suite' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 client flat config, 一条护栏规则', enNote: "This site — client flat config, one guardrail rule" },
  ],
  outlook: [
    { tag: <>HOT · 2026-02</>, hot: true, big: true, zh: { title: <>v10 只剩 flat config</>, body: <><p>v10 彻底删掉了 eslintrc 引擎: <code>--no-eslintrc</code> / <code>--env</code> / <code>--rulesdir</code> / <code>--ignore-path</code> 等老参数全部移除, <code>ESLINT_USE_FLAT_CONFIG</code> 环境变量不再被识别。内置 formatter (compact 等) 拆成独立 npm 包, 要用得单独装。</p><p>另外 JSX 引用追踪修正 (<code>&lt;Card&gt;</code> 现在算对变量的正常引用), Program 节点的 range 覆盖整段源码含首尾注释。v9.x 支持 2026-08-06 结束 —— 迁移窗口已开。</p></> }, en: { title: <>v10 is flat-config only</>, body: <><p>v10 removes the eslintrc engine for good: old flags (<code>--no-eslintrc</code> / <code>--env</code> / <code>--rulesdir</code> / <code>--ignore-path</code>) are gone, and <code>ESLINT_USE_FLAT_CONFIG</code> is no longer honored. Built-in formatters (compact, etc.) split into separate npm packages to install on demand.</p><p>It also fixes JSX reference tracking (<code>&lt;Card&gt;</code> now counts as a normal reference to the variable) and makes the Program node's range span the full source including leading/trailing comments. v9.x support ends 2026-08-06 — the migration window is open.</p></> } },
    { tag: 'SPEED', big: true, zh: { title: <>对决 Oxlint / Biome</>, body: <><p>Rust 写的 Oxlint (VoidZero) 和 Biome 用 "快 50-100 倍" 抢市场, 大 monorepo 上 ESLint 的 JS 单线程确实吃亏。ESLint 的回应是并行 lint + 更快的核心, 但短期内速度仍是它最被诟病的一面。</p></> }, en: { title: <>Facing Oxlint / Biome</>, body: <><p>Rust-written Oxlint (VoidZero) and Biome compete on being "50-100× faster"; on large monorepos ESLint's single-threaded JS does pay a price. ESLint's answer is parallel linting + a faster core, but speed remains its most-criticized edge near-term.</p></> } },
    { tag: 'LANGUAGES', zh: { title: <>language 插件</>, body: <><p>v9.6 起的 languages API 让 ESLint 不只是 JS linter: 通过 language 插件原生检查 JSON、Markdown、CSS。一个引擎检查整个仓库的多种文件类型, 而不是每种语言一个工具。</p></> }, en: { title: <>Language plugins</>, body: <><p>The languages API (since v9.6) makes ESLint more than a JS linter: language plugins natively lint JSON, Markdown, and CSS. One engine checks many file types across a repo instead of one tool per language.</p></> } },
    { tag: 'TYPES', zh: { title: <>type-aware 提速</>, body: <><p>typescript-eslint 的 <code>projectService</code> 让 type-aware 检查不必为每个文件重建 program, 大幅降低 "带类型的 lint" 的开销。这是 ESLint 守住 TS 高地的关键一步。</p></> }, en: { title: <>Faster type-aware linting</>, body: <><p>typescript-eslint's <code>projectService</code> avoids rebuilding a program per file, sharply cutting the cost of "linting with types". A key move for ESLint holding the TS high ground.</p></> } },
    { tag: 'BOUNDARY', zh: { title: <>边界:格式化不归它</>, body: <><p>2023 年起 ESLint 主动放弃格式化: 缩进 / 引号 / 分号交给 Prettier (或 <code>@stylistic</code>)。想用一个工具既查 bug 又排版的人会失望 —— 但这恰恰让两边都做得更好, 是有意为之的边界。</p></> }, en: { title: <>Boundary: formatting isn't its job</>, body: <><p>Since 2023 ESLint deliberately gave up formatting: indent / quotes / semicolons go to Prettier (or <code>@stylistic</code>). Anyone wanting one tool to both find bugs and format will be disappointed — but the split lets both sides do their job better. A deliberate boundary.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本站 client 跑 ESLint 9.39 的 flat config (<code>eslint.config.mjs</code>), 命令是 <code>pnpm --filter @cuberoot/client lint</code> → <code>eslint .</code>。但这份 config 刻意极简: 整个项目<strong>只立了一条规则</strong>。它不当风格警察 (格式靠约定 + Prettier 心智), 而是当一道护栏。</p>
        <p>那条规则是 <code>no-restricted-imports</code>: 禁止任何 <code>.mjs</code> / <code>.js</code> 脚本直接从 <code>@playwright/test</code> / <code>playwright</code> / <code>playwright-core</code> import <code>chromium</code> / <code>firefox</code> / <code>webkit</code>。所有 ad-hoc playwright 脚本必须走 <code>scripts/headless.mjs</code> 的 <code>withPage</code> 包装 —— 它把共享的 MCP 初始化脚本烤进去, 保证 MCP 跑和独立跑行为一致。唯一豁免是 <code>headless.mjs</code> 自己 (它的职责就是 import 浏览器引擎)。</p>
        <p>作用域故意收窄到 <code>**/*.{'{'}mjs,js{'}'}</code>: 没接 TS parser、没上 React 规则、没装 Next 插件。这是 "先立护栏、按需扩" 的取舍 —— 真正的类型与逻辑检查交给 tsgo typecheck, ESLint 现在只防一类具体的脚手架误用。要加 typescript-eslint / react-hooks 规则随时能补一个 config 对象。</p>
        <p>Next 16 删掉了 <code>next lint</code> 命令 (官方给了 <code>next-lint-to-eslint-cli</code> codemod), 改让你直接调 ESLint —— 本站本来就是 <code>eslint .</code>, 不受影响。ESLint v9.x 的支持 2026-08-06 到期, 升 v10 在排期里; 因为这份 config 早就是 flat、又没用任何格式化规则, 这次升级几乎零成本。</p>
      </>
    ),
    en: (
      <>
        <p>The site's client runs ESLint 9.39 flat config (<code>eslint.config.mjs</code>), invoked as <code>pnpm --filter @cuberoot/client lint</code> → <code>eslint .</code>. But that config is deliberately minimal: the entire project <strong>enables exactly one rule</strong>. It isn't a style cop (formatting is convention + a Prettier mindset) — it's a guardrail.</p>
        <p>That rule is <code>no-restricted-imports</code>: it forbids any <code>.mjs</code> / <code>.js</code> script from importing <code>chromium</code> / <code>firefox</code> / <code>webkit</code> directly from <code>@playwright/test</code> / <code>playwright</code> / <code>playwright-core</code>. Every ad-hoc playwright script must go through the <code>withPage</code> wrapper in <code>scripts/headless.mjs</code> — which bakes in the shared MCP init script so MCP and standalone runs behave identically. The one exemption is <code>headless.mjs</code> itself (importing a browser engine is its whole job).</p>
        <p>Scope is intentionally narrowed to <code>**/*.{'{'}mjs,js{'}'}</code>: no TS parser, no React rules, no Next plugin. It's a "guardrail first, expand on demand" trade-off — real type and logic checking is left to the tsgo typecheck, while ESLint guards only one concrete scaffolding misuse. Adding typescript-eslint / react-hooks rules is one more config object away.</p>
        <p>Next 16 removed the <code>next lint</code> command (it ships a <code>next-lint-to-eslint-cli</code> codemod) in favor of calling ESLint directly — the site already ran <code>eslint .</code>, so nothing to migrate. ESLint v9.x support expires 2026-08-06, so a bump to v10 is queued; because this config is already flat and uses no formatting rules, that upgrade is near-zero cost.</p>
      </>
    ),
  },
  links: [
    { label: 'eslint.org', href: 'https://eslint.org' },
    { label: 'GitHub · eslint/eslint', href: 'https://github.com/eslint/eslint' },
    { label: 'typescript-eslint', href: 'https://typescript-eslint.io' },
    { label: 'Configuration files (flat)', href: 'https://eslint.org/docs/latest/use/configure/configuration-files' },
    { label: 'Migrate to v10.x', href: 'https://eslint.org/docs/latest/use/migrate-to-10.0.0' },
  ],
};

export default ESLINT;
