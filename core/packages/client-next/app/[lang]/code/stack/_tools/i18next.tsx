import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c } from '../_lib/stack_tool_types';

// ─── i18next + react-i18next ─────────────────────────────────────────────────

export const I18NEXT: StackTool = {
  slug: 'i18next',
  name: 'i18next',
  version: '24.x + 15.x',
  since: '2011-08',
  group: 'frontend',
  accent: '#26C6DA',
  bright: '#7FE4EE',
  glyph: '⊕',
  floats: ['t(\'key\')', 'useTranslation', '<Trans>', 'i18n.changeLanguage', 'keys', 'interpolation', 'pluralization', 'namespace', 'fallback', 'LangToggle', 'zh.json', 'en.json'],
  zh: {
    tagline: 'JavaScript 世界的国际化事实标准',
    role: '整站中英双语主框架。两种 pattern 并存:大段文案走 t(\'key\') + en.json / zh.json, 组件内零散文案走 isZh ? \'X\' : \'Y\' 三元。LangToggle 每页右上角, 默认跟系统语言。',
    heroSub: <>把 UI 文案按 key 抽出来, 不同语言一份 JSON, <code>t(&apos;greet.hello&apos;)</code> 在 render 里直接取。Jan Mühlemann 2011 年起手, 14 年里 API 几乎没大变, 现在跨 React / Vue / Svelte / Node 都用得上。</>,
    whatDesc: <>i18next 是一个<strong>独立于框架的 i18n 内核</strong>, react-i18next 是它的 React 绑定。两者一起提供 <code>useTranslation</code> hook、<code>&lt;Trans&gt;</code> 组件、interpolation / plural / namespace / fallback / 懒加载 / SSR 兼容这一整套。够无聊, 因此够稳。</>,
    historyDesc: <>2011 年起手, 当时 JavaScript 国际化几乎是空白, 大家用各种 hack 拼字符串。i18next 走"key + namespace + interpolation + plural"全套, 一站式覆盖, 然后慢慢把 React / Vue / Angular 绑定全部补齐。Hooks API (2018) + Suspense 懒加载 (2020) + TypeScript 类型化 keys (2022) + React 19 兼容 (2024) 是几次主要跳跃。</>,
    conceptsTitle: 'useTranslation + JSON 资源',
    conceptsDesc: <>核心 API 小到一只手数得过来:<code>useTranslation()</code> 拿 <code>t</code>、<code>t(&apos;key&apos;, {`{ vars }`})</code> 取字符串、<code>&lt;Trans&gt;</code> 处理含 markup 的文本、<code>i18n.changeLanguage(lng)</code> 切语言。剩下都是 JSON 结构怎么排。</>,
    whyDesc: <>2026 年还选 i18next, 理由很无聊:<strong>14 年 API 几乎没大变</strong>、<strong>一份 zh.json + en.json 谁都看得懂</strong>、<strong>AI 工具一代默认输出它</strong>。竞品 (FormatJS / lingui / Polyglot) 不是消失就是占有率边缘化。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>i18next.com showcase 列出 Slack / Atlassian / SAP / Microsoft / Decathlon 等几百家。WCA 官网、cubing.com、speedcubedb 这类垂直社区也都用。本站 zh / en 双语全栈走它。</>,
    cuberootDesc: <>本站 init 在 <code>src/i18n/index.ts</code>, 资源在 <code>src/i18n/zh.json</code> + <code>src/i18n/en.json</code>。两种 pattern 并存:大段 / 跨页文案走 <code>t(&apos;key&apos;)</code>; 组件内零散一两句走 <code>isZh ? &apos;中文&apos; : &apos;EN&apos;</code> 三元。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>HOT:AI 翻译流水线 (DeepL / GPT-4) 直接对接 JSON, 类型化 keys 让 IDE 跳转就像 TS 类型一样, React Server Components 兼容在 react-i18next 16 alpha 落地, 移动端共用一份资源。</>,
  },
  en: {
    tagline: 'The de-facto i18n stack of JavaScript',
    role: 'The whole site\'s zh / en bilingual backbone. Two patterns coexist: long-form copy via t(\'key\') + en.json / zh.json, scattered in-component snippets via the inline isZh ? \'X\' : \'Y\' ternary. LangToggle sits top-right on every page, defaults to system language.',
    heroSub: <>Pull UI strings out by key, ship one JSON per language, fetch with <code>t(&apos;greet.hello&apos;)</code> at render time. Jan Mühlemann started it in 2011; fourteen years later the API has barely changed, and it ships across React / Vue / Svelte / Node.</>,
    whatDesc: <>i18next is a <strong>framework-agnostic i18n core</strong>, with react-i18next as its React binding. Together they provide the <code>useTranslation</code> hook, the <code>&lt;Trans&gt;</code> component, interpolation, pluralization, namespaces, fallbacks, lazy-loading, and SSR — the whole package. Boring on purpose, therefore stable.</>,
    historyDesc: <>2011: JS i18n was essentially empty, everyone hand-rolled string concat hacks. i18next shipped the full "key + namespace + interpolation + plural" stack at once, then filled in the React / Vue / Angular bindings. The hooks API (2018), Suspense lazy-loading (2020), type-safe keys (2022), and React 19 compat (2024) are the main paradigm jumps.</>,
    conceptsTitle: 'useTranslation + JSON resources',
    conceptsDesc: <>The observable API fits on one hand: <code>useTranslation()</code> returns <code>t</code>, <code>t(&apos;key&apos;, {`{ vars }`})</code> looks the string up, <code>&lt;Trans&gt;</code> handles markup-heavy text, <code>i18n.changeLanguage(lng)</code> switches. Everything else is how the JSON is laid out.</>,
    whyDesc: <>Picking i18next in 2026 is a boring choice for boring reasons: <strong>14 years of stable API</strong>, <strong>one zh.json + en.json any translator can edit</strong>, <strong>the AI tool generation emits it by default</strong>. Alternatives (FormatJS / lingui / Polyglot) have either disappeared or shrunk to niche.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>The i18next.com showcase lists hundreds — Slack, Atlassian, SAP, Microsoft, Decathlon. Vertical communities like the WCA, cubing.com, and speedcubedb run it too. This site\'s entire zh / en bilingual layer sits on top of it.</>,
    cuberootDesc: <>Init lives in <code>src/i18n/index.ts</code>; resources in <code>src/i18n/zh.json</code> + <code>src/i18n/en.json</code>. Two patterns coexist: long-form / cross-page copy via <code>t(&apos;key&apos;)</code>; one-off in-component lines via the inline <code>isZh ? &apos;Chinese&apos; : &apos;English&apos;</code> ternary.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>HOT: AI translation pipelines (DeepL / GPT-4) feed JSON directly; type-safe keys make IDE jump-to-definition behave like TS types; React Server Components compat is landing in react-i18next 16 alpha; mobile and web share one resource pool.</>,
  },
  heroStats: [
    { num: '10', unit: 'M/wk', zh: <>npm 周下载 <em>2026-05, react-i18next 同级</em></>, en: <>weekly npm downloads <em>2026-05, react-i18next is similar</em></>,
        zhHant: <>npm 周下載 <em>2026-05, react-i18next 同級</em></>
    },
    { num: '24', unit: '.x', zh: <>i18next 当前主版本 <em>react-i18next 15.x</em></>, en: <>i18next current major <em>react-i18next 15.x</em></>,
        zhHant: <>i18next 當前主版本 <em>react-i18next 15.x</em></>
    },
    { num: '2', unit: 'lng', zh: <>本站在用语言 <em>zh / en, 切换持久化</em></>, en: <>languages on this site <em>zh / en, persisted</em></>,
        zhHant: <>本站在用語言 <em>zh / en, 切換持久化</em></>
    },
    { num: '14', unit: 'y', zh: <>从 2011 起 <em>API 没大变</em></>, en: <>since 2011 <em>API barely shifted</em></>,
        zhHant: <>從 2011 起 <em>API 沒大變</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>i18next 是 Jan Mühlemann 2011 年 8 月放出的库, 起源很朴素 —— 当时 JavaScript 世界做国际化几乎是空白, 大家用各种 hack 拼字符串、塞 <code>data-i18n</code> 属性、手写 plural 规则。Mühlemann 把这些杂事归拢到一个 API 里:<strong>每条文案给一个 key, 不同语言一份资源 JSON, render 时 <code>t(&apos;key&apos;)</code> 取</strong>。配上 interpolation / plural / namespace / fallback 这套常规需求, 一站式覆盖。</p>
        <p>react-i18next 是 2017 年开始的 React 那一头的绑定, 提供 <code>withTranslation</code> HOC, 2018 年加 <code>useTranslation</code> hook 之后基本成了 React 圈的默认。<code>&lt;Trans&gt;</code> 组件处理含 markup / 嵌套组件的复杂文本, Suspense 兼容让翻译资源可以懒加载。React 19 + concurrent renderer 下也直接能用, 没有迁移负担。</p>
        <p>它跟 FormatJS / lingui / Polyglot 等竞品比, 最大的优势是<strong>够无聊</strong> —— API 14 年没大变, 写 zh.json + en.json 谁都看得懂, 不依赖 babel macro 也不依赖 IDE 插件。AI 工具一代生成 i18n 代码时几乎一边倒输出 i18next 风格, 训练数据里这种样本最多。这种"无聊"在工程上恰恰是护城河。</p>
      </>
    ),
    en: (
      <>
        <p>i18next is Jan Mühlemann&apos;s 2011 library. The trigger was mundane — JavaScript i18n was essentially a blank space at the time. Engineers hand-rolled string concatenation, peppered <code>data-i18n</code> attributes around, wrote plural rules by hand. Mühlemann pulled all of it into one API: <strong>every UI string gets a key, each language has its own JSON resource, and <code>t(&apos;key&apos;)</code> looks it up at render time</strong>. Plus interpolation, pluralization, namespaces, and fallbacks — full coverage in one library.</p>
        <p>react-i18next is the React binding, started in 2017 with a <code>withTranslation</code> HOC. The <code>useTranslation</code> hook in 2018 made it the de-facto React choice. The <code>&lt;Trans&gt;</code> component handles markup-heavy / nested-component strings; Suspense compat lets translation bundles lazy-load. It works out of the box on React 19 + the concurrent renderer — no migration tax.</p>
        <p>Against FormatJS / lingui / Polyglot and friends, its main advantage is being <strong>boring on purpose</strong> — the API has barely shifted in fourteen years, the JSON files any translator can edit, no babel macro or IDE plugin required. AI tools overwhelmingly emit i18next-flavoured code because that&apos;s what dominates training data. Boring is the moat.</p>
      </>
    ),
  },
  history: [
    { year: '2011·08', zh: { title: <>i18next v1 公开</>, desc: <>Jan Mühlemann 首发。最初目标:把"每条文案一个 key + 一份 JSON 资源 + interpolation + plural"打包成一个标准 API。</> }, en: { title: <>i18next v1 public</>, desc: <>Jan Mühlemann ships the first version. The pitch from day one: "one key per string + one JSON per language + interpolation + plural" as a single standard API.</> } },
    { year: '2013·06', zh: { title: <>引入 namespace</>, desc: <>0.x 阶段, 加入 namespace 机制, 让"按页 / 按模块切翻译资源"成为标配, 而不是一份巨大 JSON。</> }, en: { title: <>Namespaces introduced</>, desc: <>The 0.x line adds namespaces — translations split per page / module instead of one giant JSON.</> } },
    { year: '2015·07', zh: { title: <>i18next 5.0</>, desc: <>JSON 格式标准化, plural rule 全面对齐 CLDR, fallback 链可配置。第三方 backend (HTTP / Locize) plug-in 体系成型。</> }, en: { title: <>i18next 5.0</>, desc: <>JSON format standardized, plural rules fully aligned with CLDR, fallback chains made configurable. The third-party backend plug-in ecosystem (HTTP / Locize) takes shape.</> } },
    { year: '2017·05', zh: { title: <>react-i18next 7.x</>, desc: <>React 16 兼容版本上线, withTranslation HOC + Trans 组件。同期 cubing 社区开始用它做多语言 (cubing.com / WCA 官网)。</> }, en: { title: <>react-i18next 7.x</>, desc: <>React 16 compatible release with the withTranslation HOC and Trans component. The cubing community starts adopting it for multilingual sites (cubing.com / WCA).</> } },
    { year: '2018·12', zh: { title: <>Hooks API</>, desc: <>i18next 17 + react-i18next 10 引入 useTranslation hook。函数组件直接 <code>const {`{ t }`} = useTranslation()</code>, class 写法从此退场。</> }, en: { title: <>Hooks API</>, desc: <>i18next 17 + react-i18next 10 ship the useTranslation hook. Function components go straight to <code>const {`{ t }`} = useTranslation()</code>; the class API quietly retires.</> } },
    { year: '2020·03', zh: { title: <>&lt;Trans&gt; + Suspense</>, desc: <>react-i18next 11 让翻译资源懒加载走 Suspense fallback, &lt;Trans&gt; 组件优化嵌套 markup 处理, 支持 React.lazy 风格的按需加载。</> }, en: { title: <>&lt;Trans&gt; + Suspense</>, desc: <>react-i18next 11 wires translation bundle loading to Suspense fallbacks; &lt;Trans&gt; improves nested-markup handling and supports React.lazy-style on-demand loading.</> } },
    { year: '2022·09', zh: { title: <>类型化 keys</>, desc: <>i18next 22 + react-i18next 12 加 TypeScript 模块声明, 从 resources 自动推 keys。<code>t(&apos;foo.bar&apos;)</code> 在 IDE 里能跳定义、能补全、错 key 编译挂。</> }, en: { title: <>Type-safe keys</>, desc: <>i18next 22 + react-i18next 12 add TypeScript module augmentation; keys are inferred from resources. <code>t(&apos;foo.bar&apos;)</code> gets jump-to-definition, autocomplete, and compile errors on typos.</> } },
    { year: '2023·06', zh: { title: <>React 18 concurrent</>, desc: <>react-i18next 13 完整兼容 React 18 的 concurrent renderer。useTransition / Suspense for data 同框架内可用, 翻译资源加载不再阻塞 UI。</> }, en: { title: <>React 18 concurrent</>, desc: <>react-i18next 13 lands full React 18 concurrent compat. useTransition / Suspense for data work inside the framework; translation loads no longer block UI.</> } },
    { year: '2024·12', zh: { title: <>i18next 24 / react-i18next 15</>, desc: <>React 19 兼容, ref-as-prop / use() 钩子全部支持。本站 2025 年初切到这一版。</> }, en: { title: <>i18next 24 / react-i18next 15</>, desc: <>React 19 compatible, ref-as-prop / use() supported. This site moved to these versions in early 2025.</> } },
    { year: '2025·08', zh: { title: <>AI 翻译流水线</>, desc: <>DeepL / GPT-4 直接吃 JSON 输出 JSON 成主流, locize.com 加 LLM 译后审稿流程。Claude Code / Cursor 生成新 UI 时默认输出 i18next 样式。</> }, en: { title: <>AI translation pipelines</>, desc: <>DeepL / GPT-4 reading JSON and writing JSON becomes mainstream; locize.com adds LLM post-edit workflows. Claude Code / Cursor default to i18next-style output when generating new UI.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>当前状态</>, desc: <>i18next 24.x + react-i18next 15.x 是 React 19 项目的事实默认。RSC 兼容在 react-i18next 16 alpha, 但本站纯静态 SPA 暂用不上。</> }, en: { title: <>Current state</>, desc: <>i18next 24.x + react-i18next 15.x are the de-facto default for React 19 projects. RSC compat is in react-i18next 16 alpha; this site is a pure static SPA, so it doesn&apos;t matter yet.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>useTranslation()</>, desc: <>组件里拿 <code>t</code> 和 <code>i18n</code> 实例。最常用入口。</> }, en: { title: <>useTranslation()</>, desc: <>The standard entry point for components. Pulls <code>t</code> and the <code>i18n</code> instance.</> }, code: <code>{k('const')} {'{'} {v('t')}, {v('i18n')} {'}'} = {f('useTranslation')}();{'\n\n'}{k('return')} &lt;{f('h1')}&gt;{'{'}{f('t')}({s("'home.title'")}){'}'}&lt;/{f('h1')}&gt;;</code> },
    { tag: 'B', zh: { title: <>t(&apos;key&apos;) + JSON</>, desc: <>每条文案一个 key, 资源走 JSON。点号分层, 跟 namespace 配合做按页拆。</> }, en: { title: <>t(&apos;key&apos;) + JSON</>, desc: <>One key per string, JSON as the resource. Dotted paths nest; pair with namespaces to split by page.</> }, code: <code>{c('// en.json')}{'\n'}{'{'} {s('"home"')}: {'{'} {s('"title"')}: {s('"CubeRoot"')}, {s('"sub"')}: {s('"Trainer"')} {'}'} {'}'}{'\n\n'}{f('t')}({s("'home.title'")}){'   '}{c('// → "CubeRoot"')}</code> },
    { tag: 'C', zh: { title: <>Interpolation</>, desc: <>变量插值用 <code>{`{{name}}`}</code>。默认 HTML escape, 配合 React 已经是 escaped 的, 在 init 里关掉。</> }, en: { title: <>Interpolation</>, desc: <>Variables interpolate via <code>{`{{name}}`}</code>. HTML escape is on by default; turn it off in init since React already escapes.</> }, code: <code>{c('// en.json')}{'\n'}{s('"greet"')}: {s('"Hello, {{name}}!"')}{'\n\n'}{f('t')}({s("'greet'")}, {'{'} {p('name')}: {s("'Cuber'")} {'}'});{'\n'}{c('// → "Hello, Cuber!"')}</code> },
    { tag: 'D', zh: { title: <>Pluralization</>, desc: <>传 <code>count</code>, i18next 走 CLDR plural rule 选 <code>_one</code> / <code>_other</code> / <code>_few</code> 等后缀的 key。</> }, en: { title: <>Pluralization</>, desc: <>Pass <code>count</code> and i18next picks the right CLDR plural form — <code>_one</code> / <code>_other</code> / <code>_few</code> suffix variants.</> }, code: <code>{c('// en.json')}{'\n'}{s('"items_one"')}: {s('"{{count}} item"')},{'\n'}{s('"items_other"')}: {s('"{{count}} items"')}{'\n\n'}{f('t')}({s("'items'")}, {'{'} {p('count')}: {n('3')} {'}'});{'\n'}{c('// → "3 items"')}</code> },
    { tag: 'E', zh: { title: <>Namespace</>, desc: <>大项目按 namespace 拆资源, useTranslation 传 ns 名。本站 zh/en 各一份 translation, 没用多 namespace。</> }, en: { title: <>Namespace</>, desc: <>Split large projects by namespace; pass the ns name to useTranslation. This site keeps one translation per language — no extra namespaces.</> }, code: <code>{k('const')} {'{'} {v('t')} {'}'} = {f('useTranslation')}({s("'common'")});{'\n'}{c('// resources.en.common.* lookup')}</code> },
    { tag: 'F', zh: { title: <>&lt;Trans&gt; 组件</>, desc: <>文案里要嵌 React 组件 / 链接 / 样式时用。子节点按序号占位, t() 处理不了这种含 markup 的复杂场景。</> }, en: { title: <>&lt;Trans&gt; component</>, desc: <>Use when the string embeds React components / links / formatting. Children act as numbered placeholders — t() alone can&apos;t handle markup-laden strings.</> }, code: <code>&lt;{f('Trans')} {p('i18nKey')}={s('"agree"')}&gt;{'\n'}  I agree to the &lt;{f('a')} {p('href')}={s('"/tos"')}&gt;ToS&lt;/{f('a')}&gt;.{'\n'}&lt;/{f('Trans')}&gt;</code> },
    { tag: 'G', zh: { title: <>i18n.changeLanguage()</>, desc: <>切语言。本站 <code>LangToggle</code> 调它 + 同步 URL <code>?lang=zh/en</code> + 写 localStorage。</> }, en: { title: <>i18n.changeLanguage()</>, desc: <>Switches language. This site&apos;s <code>LangToggle</code> calls it + syncs the URL <code>?lang=zh/en</code> + persists to localStorage.</> }, code: <code>{v('i18n')}.{f('changeLanguage')}({s("'zh'")});{'\n'}{f('syncLangToUrl')}({s("'zh'")});{'\n'}{c('// → window.location.search = "?lang=zh"')}</code> },
    { tag: 'H', zh: { title: <>Inline isZh 三元</>, desc: <>本站第二种 pattern。零散一两句、不值得搬 JSON 的文案直接走三元。CLAUDE.md 写得明确:两种 pattern 并存是 OK 的。</> }, en: { title: <>The inline isZh ternary</>, desc: <>This site&apos;s second pattern. Scattered one-liners not worth lifting into JSON go through a ternary. CLAUDE.md says it plainly: two patterns coexist on purpose.</> }, code: <code>{k('const')} {'{'} {v('i18n')} {'}'} = {f('useTranslation')}();{'\n'}{k('const')} {v('isZh')} = {v('i18n')}.{p('language')}.{f('startsWith')}({s("'zh'")});{'\n\n'}{k('return')} &lt;{f('span')}&gt;{'{'}isZh ? {s("'中文'")} : {s("'English'")}{'}'}&lt;/{f('span')}&gt;;</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>够无聊</>, desc: <>14 年 API 几乎没大变。<code>t(&apos;key&apos;)</code> 跟 useTranslation 在 2018 年定型, 之后只增不变。AI 工具一代生成的 i18next 代码命中率高就靠这种稳定性。</> }, en: { title: <>Boring on purpose</>, desc: <>The API has barely moved in fourteen years. <code>t(&apos;key&apos;)</code> and useTranslation locked in around 2018; additions only, no breakage. That stability is exactly why AI tools emit it accurately.</> }, code: <>{c('// 2018')}{'\n'}{f('t')}({s("'home.title'")}){'\n'}{c('// 2026: same call')}</> },
    { icon: '⌬', zh: { title: <>一份 zh.json + en.json</>, desc: <>翻译者 / 翻译工具 / git diff / 平面比对工具全部能直读。不需要 babel macro, 不需要 IDE 插件, 文件结构跟人脑预期完全一致。</> }, en: { title: <>One zh.json + one en.json</>, desc: <>Translators, translation tools, git diff, side-by-side diff tools all parse it directly. No babel macro, no IDE plugin — the file shape matches what your brain expects.</> }, code: <>{'{'} {s('"home"')}: {'{'} {s('"title"')}: {s('"..."')} {'}'} {'}'}</> },
    { icon: '⎇', zh: { title: <>React 绑定一等公民</>, desc: <>useTranslation hook + &lt;Trans&gt; 组件双形态。短文案走 hook, 含 markup 的走 &lt;Trans&gt;, 不用 string concat 也不用 dangerouslySetInnerHTML。</> }, en: { title: <>First-class React binding</>, desc: <>The useTranslation hook + &lt;Trans&gt; component cover both shapes. Plain strings go through the hook, markup-heavy strings through &lt;Trans&gt; — no string concat, no dangerouslySetInnerHTML.</> }, code: <>&lt;{f('Trans')} {p('i18nKey')}={s('"agree"')} /&gt;</> },
    { icon: '⌁', zh: { title: <>Suspense 兼容</>, desc: <>翻译资源可以按需懒加载, &lt;Suspense fallback&gt; 兜底加载态。大型多语言站不用首屏全塞所有语言资源。</> }, en: { title: <>Suspense compat</>, desc: <>Translation bundles lazy-load; &lt;Suspense fallback&gt; covers the loading state. Large multilingual sites don&apos;t ship every language at first paint.</> }, code: <>&lt;{f('Suspense')} {p('fallback')}={'{<Spinner />}'}&gt;{'\n'}  &lt;{f('App')} /&gt;{'\n'}&lt;/{f('Suspense')}&gt;</> },
    { icon: '⌖', zh: { title: <>类型化 keys</>, desc: <>TypeScript 5 + i18next 22+ 把 keys 推成字面量联合类型。<code>t(&apos;foo.bar&apos;)</code> 在 IDE 里能跳定义、能补全、typo 编译挂。</> }, en: { title: <>Type-safe keys</>, desc: <>TypeScript 5 + i18next 22+ infer keys as literal union types. <code>t(&apos;foo.bar&apos;)</code> supports jump-to-definition, autocomplete, and compile-time errors on typos.</> }, code: <>{f('t')}({s("'home.tilte'")}) {c('// TS error')}</> },
    { icon: '⌗', zh: { title: <>不锁框架</>, desc: <>i18next 内核独立于框架。Vue / Svelte / Solid / Node / Electron 全都能用同一份资源。组件层换框架不用重做翻译。</> }, en: { title: <>Framework-agnostic core</>, desc: <>The i18next core is framework-independent. Vue / Svelte / Solid / Node / Electron all share the same resources. Switching component layers doesn&apos;t rewrite translations.</> }, code: <>{c('// Same JSON works in')}{'\n'}{c('// React / Vue / Node')}</> },
    { icon: '⛯', zh: { title: <>两种 pattern 并存 OK</>, desc: <>本站的真实做法:长段文案 / 跨页复用走 <code>t()</code>; 组件内零散一两句走 <code>isZh ? &apos;X&apos; : &apos;Y&apos;</code>。后者更短、改文案不跨文件, 利大于弊。</> }, en: { title: <>Two patterns coexist fine</>, desc: <>This site&apos;s actual practice: long-form / cross-page text via <code>t()</code>; one-off in-component lines via <code>isZh ? &apos;X&apos; : &apos;Y&apos;</code>. The ternary keeps edits local and the JSON less noisy — net win.</> }, code: <>{v('isZh')} ? {s("'保存'")} : {s("'Save'")}</> },
    { icon: '⏚', zh: { title: <>AI 工具一代的母语</>, desc: <>Claude Code / Cursor / v0 生成多语言 UI 时几乎默认输出 i18next。训练数据里它的样本数量碾压 FormatJS / lingui, 一次 prompt 命中率显著高一档。</> }, en: { title: <>Native dialect of AI tools</>, desc: <>Claude Code / Cursor / v0 default to i18next when generating multilingual UI. Training data has far more i18next samples than FormatJS / lingui, so single-prompt accuracy is noticeably higher.</> }, code: <>{c('// "Make this bilingual"')}{'\n'}{c('// → i18next 95% of the time')}</> },
    { icon: '⌥', zh: { title: <>SSR / RSC 路线明确</>, desc: <>Node 端独立运行, Next.js / Remix / Astro 都有官方 example。react-i18next 16 alpha 加 RSC 兼容。本站纯静态 SPA 暂用不上, 但路线在那。</> }, en: { title: <>Clear SSR / RSC path</>, desc: <>Runs standalone on Node; Next.js / Remix / Astro all have official examples. react-i18next 16 alpha adds RSC support. This site is a pure static SPA so it doesn&apos;t apply yet, but the path exists.</> }, code: <>{c('// react-i18next 16 alpha')}{'\n'}{c('// RSC compat in flight')}</> },
  ],
  adopters: [
    { name: 'Slack web', href: 'https://slack.com', highlight: true, zhNote: 'web 端整套国际化跑 i18next', enNote: 'Whole web client runs on i18next' },
    { name: 'Atlassian (Jira / Confluence)', href: 'https://atlassian.com', highlight: true, zhNote: '大型 SaaS, 多团队多 namespace 实战', enNote: 'Large SaaS, multi-team multi-namespace at scale' },
    { name: 'Webex', href: 'https://webex.com', zhNote: 'Cisco 协同套件 web 端', enNote: 'Cisco collaboration suite web client' },
    { name: 'SAP', href: 'https://sap.com', zhNote: '内部多个产品线', enNote: 'Internal across product lines' },
    { name: 'Microsoft', href: 'https://microsoft.com', zhNote: '内部多语言产品 (showcase 列出)', enNote: 'Multilingual products internally (per showcase)' },
    { name: 'Decathlon', href: 'https://decathlon.com', zhNote: '电商前端 i18n 主框架', enNote: 'E-commerce frontend i18n core' },
    { name: 'Strapi CMS', href: 'https://strapi.io', zhNote: '官网 + admin panel 都跑它', enNote: 'Marketing site + admin panel both ride it' },
    { name: 'cubing.com / WCA', href: 'https://cubing.com', zhNote: '魔方圈最大社区站, 多语言 UI', enNote: 'Largest cubing community site, multilingual UI' },
    { name: 'locize.com', href: 'https://locize.com', zhNote: 'i18next 作者自家的翻译管理平台', enNote: 'Translation-management platform by the i18next team' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 zh / en 双语全栈, 两种 pattern 并存', enNote: 'This site — full zh / en stack, both patterns in active use' },
  ],
  outlook: [
    { tag: <>HOT · 2025-08</>, hot: true, big: true, zh: { title: <>AI 翻译流水线吃 JSON</>, body: <><p>DeepL / GPT-4 / Claude 都已经支持直接吃 JSON 翻 JSON, locize.com 加 LLM 译后审稿。CI 里跑"en.json 改了 → 自动生成 zh.json 候选 → 人审 → 合并"成主流。i18next 的 JSON-first 设计正好对接。</p><p>更深一层意义:翻译这一行的工作流从"译者逐条翻"变成"LLM 起草 + 人审", 单位文案的边际成本压到几乎为零。多语言不再是大项目专利。</p></> }, en: { title: <>AI translation pipelines on JSON</>, body: <><p>DeepL / GPT-4 / Claude all accept JSON in and emit JSON out; locize.com adds LLM post-edit review. CI pipelines that say "en.json changed → auto-draft zh.json → human review → merge" are now standard. i18next&apos;s JSON-first design slots in cleanly.</p><p>The deeper point: translation workflows shifted from "translator does every line" to "LLM drafts, humans review." Marginal cost per string collapses, and multilingual stops being a big-project privilege.</p></> } },
    { tag: 'TYPE', zh: { title: <>类型化 keys 成默认</>, body: <><p>i18next 22+ 的 TypeScript 模块声明从 resources 推出字面量联合类型, <code>t(&apos;home.titlte&apos;)</code> 直接编译挂。IDE 跳定义、补全、refactor rename 全跟 TS 类型一样工作。2026 年新建项目几乎都开。</p></> }, en: { title: <>Type-safe keys as default</>, body: <><p>i18next 22+&apos;s TS module augmentation infers literal union types from resources, so <code>t(&apos;home.titlte&apos;)</code> fails to compile. Jump-to-definition, autocomplete, and refactor renames all behave like regular TS types. New projects in 2026 turn it on by default.</p></> } },
    { tag: 'RSC', zh: { title: <>React Server Components</>, body: <><p>react-i18next 16 alpha 加 RSC 兼容, 翻译查询可以跑在服务端、零 JS 下发翻译表。Next.js / Remix / TanStack Start 都有官方 example。本站纯静态 SPA 暂用不上, 但生态路线明确。</p></> }, en: { title: <>React Server Components</>, body: <><p>react-i18next 16 alpha ships RSC compat — translation lookups can run server-side and zero translation tables get shipped. Official examples in Next.js / Remix / TanStack Start. This site is a static SPA so it doesn&apos;t apply yet, but the ecosystem direction is clear.</p></> } },
    { tag: <>MOBILE</>, zh: { title: <>React Native 共用资源</>, body: <><p>同一份 zh.json / en.json 在 web 和 React Native 共用, 不用 maintain 两套翻译。Expo SDK 53+ 把 i18next 集成做成 starter 模板。多端一致性免费。</p></> }, en: { title: <>One resource pool for RN</>, body: <><p>The same zh.json / en.json work on both web and React Native — no duplicate translation maintenance. Expo SDK 53+ ships i18next integration as a starter template. Cross-platform consistency for free.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本站 zh / en 双语全栈跑在 i18next 24 + react-i18next 15 上, init 在 <code>src/i18n/index.ts</code>, 资源是<strong>客户端打包进 bundle 的两份 JSON</strong>:<code>src/i18n/zh.json</code> + <code>src/i18n/en.json</code>, 不走 HTTP backend 也不懒加载 (本站全部翻译加起来几十 KB, 不值得拆)。</p>
        <p>语言检测三层优先级:URL 参数 <code>?lang=zh/en</code> &gt; localStorage <code>trainer-lang</code> &gt; <code>navigator.language</code>。检测完会自动把 <code>?lang=</code> 追加到 URL 上 (replaceState, 不产生历史条目), 这样分享链接默认带语言。</p>
        <p><strong>两种 pattern 并存</strong> (CLAUDE.md 写得明确):</p>
        <p>(1) 大段 / 跨页复用文案 → <code>t(&apos;key&apos;)</code> + JSON。本站 trainer / recognize / wca stats 这类有大段说明文字的页面都走这个。</p>
        <p>(2) 组件内零散一两句、不值得搬 JSON 的文案 → <code>const {`{ i18n }`} = useTranslation(); const isZh = i18n.language.startsWith(&apos;zh&apos;); return isZh ? &apos;中文&apos; : &apos;EN&apos;;</code> 三元。本站 /code/* 这类带大段叙述的页面绝大多数走 inline 三元, 因为长段集中管理利于版本一致、改文案不跨文件。</p>
        <p>选 inline 三元的真正原因:小段文案搬到 JSON 反而散乱(改一处文案 → 改 JSX + 改 zh.json + 改 en.json = 三个文件 diff), 长段才值得集中管理。两套混用是<strong>工程权衡</strong>, 不是漏抽象。</p>
        <p><code>LangToggle</code> 组件每页右上角, 默认跟系统语言, 切换持久化到 <code>localStorage.trainer-lang</code> 并同步 URL <code>?lang=</code>。中文比赛名字独立走 <code>stats/comp_names_zh.json</code> (不在 i18next 资源里), 因为是 lookup 表不是 UI 文案 —— 见 <code>comp-names-zh</code> skill。</p>
      </>
    ),
    en: (
      <>
        <p>The full zh / en bilingual layer runs on i18next 24 + react-i18next 15. Init in <code>src/i18n/index.ts</code>; resources are <strong>two JSON files bundled into the client</strong>: <code>src/i18n/zh.json</code> + <code>src/i18n/en.json</code> — no HTTP backend, no lazy-loading (total translations on the site are a few dozen KB, not worth splitting).</p>
        <p>Language detection has three layers, in priority order: URL param <code>?lang=zh/en</code> &gt; localStorage <code>trainer-lang</code> &gt; <code>navigator.language</code>. After detection, <code>?lang=</code> is appended to the URL via replaceState (no history entry) so shared links carry the language.</p>
        <p><strong>Two patterns coexist on purpose</strong> (CLAUDE.md is explicit about this):</p>
        <p>(1) Long-form / cross-page copy → <code>t(&apos;key&apos;)</code> + JSON. trainer / recognize / wca stats — anywhere with substantial explanatory text — uses this.</p>
        <p>(2) Scattered in-component one-liners not worth lifting into JSON → <code>const {`{ i18n }`} = useTranslation(); const isZh = i18n.language.startsWith(&apos;zh&apos;); return isZh ? &apos;Chinese&apos; : &apos;EN&apos;;</code> ternary. The /code/* narrative pages mostly use inline ternaries, because edits stay in one file.</p>
        <p>Why the inline ternary at all: lifting tiny strings into JSON scatters edits across three files (JSX + zh.json + en.json) per copy change; only long-form material benefits from centralization. Mixing the two is an <strong>engineering trade-off</strong>, not a missing abstraction.</p>
        <p>The <code>LangToggle</code> component lives top-right on every page, defaults to system language, persists to <code>localStorage.trainer-lang</code> and syncs <code>?lang=</code> in the URL. Chinese competition names use a separate <code>stats/comp_names_zh.json</code> lookup table (not in the i18next resources) — see the <code>comp-names-zh</code> skill.</p>
      </>
    ),
  },
  links: [
    { label: 'i18next.com', href: 'https://www.i18next.com' },
    { label: 'react.i18next.com', href: 'https://react.i18next.com' },
    { label: 'GitHub · i18next/i18next', href: 'https://github.com/i18next/i18next' },
    { label: 'GitHub · i18next/react-i18next', href: 'https://github.com/i18next/react-i18next' },
  ],
};

export default I18NEXT;
