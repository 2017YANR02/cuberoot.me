import type { StackTool } from '../stack_tool_types';
import { k, v, s, f, p, c, t } from '../stack_tool_types';

// ─── Playwright ─────────────────────────────────────────────────────────────

export const PLAYWRIGHT: StackTool = {
  slug: 'playwright',
  name: 'Playwright',
  version: '1.60',
  since: '2020-01',
  group: 'dev',
  accent: '#2EAD33',
  bright: '#52CB58',
  glyph: '▶',
  floats: ['test()', 'expect()', 'page.click', 'locator', 'auto-wait', 'fixtures', 'trace viewer', 'codegen', 'Chromium', 'Firefox', 'WebKit', 'MCP'],
  zh: {
    tagline: '跨浏览器端到端测试 + 浏览器自动化',
    role: '本站 UI 回归测试 + AI agent 验证页面行为的主力工具。',
    heroSub: <>一套 API 同时驱动 Chromium / Firefox / WebKit, 自动等待元素就绪、自动重试断言、自动并行 worker。前 Puppeteer 团队 2019 从 Google 跳到 Microsoft 重做的产物, 这次把 Chrome 单一阵营变成三引擎统一。</>,
    whatDesc: <>Playwright 是 <strong>浏览器自动化框架</strong>, 不只是测试 runner。它既能跑 E2E 测试套, 也能当 scraping / RPA / AI agent 的浏览器后端。<code>@playwright/test</code> 是它自带的 test runner, 也是社区默认入口。</>,
    historyDesc: <>2019 Andrey Lushnikov / Joel Einbinder / Pavel Feldman 三个 Puppeteer 核心从 Google 转投 Microsoft, 2020 年 1 月公开发布 Playwright。设计目标:<strong>修 Puppeteer 设计上修不动的东西</strong> —— 跨浏览器、跨语言、auto-wait、isolated context、trace viewer。六年后它已是 E2E 默认选项。</>,
    conceptsTitle: '核心原语',
    conceptsDesc: <>API 表面其实小:<code>browser → context → page → locator</code>, 加 <code>expect()</code> 的 web-first 断言, 加 fixtures。其它都是组合。</>,
    whyDesc: <>2026 选 Playwright 不是因为它"新", 而是因为<strong>auto-wait 让 flaky 测试大幅减少</strong>、<strong>trace viewer 让排查可视化</strong>、<strong>三引擎同 API</strong> 让 WebKit / Firefox 真正能测。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>VS Code / GitHub / Microsoft Edge 团队自己吃自己狗粮。AI agent 一代 (Claude Code / Cursor / Anthropic MCP) 直接把 Playwright MCP 当浏览器后端。</>,
    cuberootDesc: <>本站用 Playwright 跑两件事:<strong>UI 回归测试</strong> (改 calc/* 后必跑 <code>tests/calc-interactions.mjs</code>) 和 <strong>Playwright MCP</strong> (开发期 ad-hoc 验证, 比如 "navigate 到 /code/stack 截图")。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>趋势:<strong>Playwright MCP 把测试框架变成 AI agent 工具</strong>;trace viewer + accessibility snapshot 成为 LLM 看页面的标准方式;Cypress 在 2024-2025 流量被反超后已没有回头路。</>,
  },
  en: {
    tagline: 'Cross-browser E2E testing + browser automation',
    role: 'UI regression suites + the browser backend AI agents drive to verify pages on this site.',
    heroSub: <>One API drives Chromium / Firefox / WebKit, with auto-waiting, retrying assertions, and parallel workers built in. Created by the ex-Puppeteer core team that moved from Google to Microsoft in 2019 — this time turning a Chrome-only project into a three-engine one.</>,
    whatDesc: <>Playwright is a <strong>browser automation framework</strong>, not just a test runner. It powers E2E test suites, but also serves as the browser backend for scraping / RPA / AI agents. <code>@playwright/test</code> is the bundled runner and the community default entry point.</>,
    historyDesc: <>In 2019 Andrey Lushnikov / Joel Einbinder / Pavel Feldman — the Puppeteer core — moved from Google to Microsoft. Playwright went public in January 2020. The design goal: <strong>fix what Puppeteer could not</strong> — cross-browser, cross-language, auto-wait, isolated contexts, trace viewer. Six years later it is the default E2E choice.</>,
    conceptsTitle: 'Core primitives',
    conceptsDesc: <>The API surface is actually small: <code>browser → context → page → locator</code>, plus <code>expect()</code> web-first assertions, plus fixtures. Everything else is composition.</>,
    whyDesc: <>Picking Playwright in 2026 is not because it is "new" — it is because <strong>auto-wait dramatically cuts flakiness</strong>, <strong>trace viewer makes debugging visual</strong>, and <strong>one API truly covers WebKit / Firefox / Chromium</strong>.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>VS Code / GitHub / the Microsoft Edge team eat their own dog food. The AI agent generation (Claude Code / Cursor / Anthropic MCP) wires Playwright MCP straight in as the browser backend.</>,
    cuberootDesc: <>This site uses Playwright two ways: <strong>UI regression suites</strong> (every calc/* edit must run <code>tests/calc-interactions.mjs</code>) and <strong>Playwright MCP</strong> for ad-hoc verification during development (for example, "navigate to /code/stack and screenshot the new cards").</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Trends: <strong>Playwright MCP turns the test framework into an AI agent tool</strong>; trace viewer + accessibility snapshot become the standard way an LLM reads a page; Cypress lost its lead in 2024–2025 and has not turned the curve around.</>,
  },
  heroStats: [
    { num: '3', zh: <>引擎同 API <em>Chromium / Firefox / WebKit</em></>, en: <>engines, one API <em>Chromium / Firefox / WebKit</em></> },
    { num: '#1', zh: <>npm 周下载量 E2E 框架 <em>2026</em></>, en: <>E2E framework by weekly npm downloads <em>2026</em></> },
    { num: '6', unit: 'y', zh: <>从 2020-01 至今 <em>已是默认选项</em></>, en: <>since 2020-01 <em>now the default</em></> },
    { num: '1', unit: '.60', zh: <>当前稳定版 <em>2026-05</em></>, en: <>current stable <em>2026-05</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Playwright 的故事其实是 Puppeteer 的下半场。2017 年 Andrey Lushnikov 在 Google Chrome 组做了 Puppeteer, 把 Chrome DevTools Protocol 包成 Node API。Puppeteer 在 E2E 圈很快变成主流, 但它有几个结构性问题:只能驱动 Chromium、没有官方 test runner、context 隔离不彻底、跨语言只能社区移植。这些问题在 Puppeteer 的设计里改不动。</p>
        <p>2019 年底, Lushnikov / Einbinder / Feldman 三个核心一起从 Google 跳到 Microsoft, 重新开了一个项目。2020 年 1 月 31 日 Playwright 公开发布, 目标是<strong>把 Puppeteer 解决不了的东西从头解决</strong>:三引擎同 API (CDP + Juggler + WebKit remote)、官方 test runner、auto-wait、context-level 隔离、trace viewer、Python / Java / .NET 一等支持。</p>
        <p>六年后, Playwright 在 npm 周下载量已超过 Cypress, 在 GitHub 星数追平。2024 年 Microsoft 又发了 Playwright MCP, 把它做成 Model Context Protocol 服务器, AI agent (Claude Code / Cursor 等) 直接通过 MCP 调浏览器, 看页面、点按钮、填表单。从测试工具到 agent 运行时的角色转变, 几乎是无缝的。</p>
      </>
    ),
    en: (
      <>
        <p>Playwright is really Puppeteer's second act. In 2017, Andrey Lushnikov built Puppeteer inside Google's Chrome team — a Node wrapper over the Chrome DevTools Protocol. Puppeteer quickly became the E2E default, but it had structural limits: Chromium-only, no official test runner, imperfect context isolation, cross-language only via community ports. None of these were fixable within Puppeteer's design.</p>
        <p>Late 2019, Lushnikov / Einbinder / Feldman — the core trio — moved from Google to Microsoft together and started fresh. Playwright launched publicly on January 31, 2020, aiming to <strong>solve what Puppeteer could not</strong>: three engines through one API (CDP + Juggler + WebKit remote), an official test runner, auto-wait, context-level isolation, the trace viewer, and first-class Python / Java / .NET bindings.</p>
        <p>Six years on, Playwright's weekly npm downloads have surpassed Cypress and its GitHub stars caught up. In 2024 Microsoft also shipped Playwright MCP, packaging it as a Model Context Protocol server — AI agents (Claude Code, Cursor, etc.) drive the browser through MCP to inspect pages, click buttons, fill forms. The pivot from test tool to agent runtime has been almost seamless.</p>
      </>
    ),
  },
  history: [
    { year: '2017·08', zh: { title: <>Puppeteer 发布 (前传)</>, desc: <>Andrey Lushnikov 在 Google Chrome 组做 Puppeteer, 把 CDP 包成 Node API。E2E 圈两年内被它占领, 但结构性问题埋下伏笔。</> }, en: { title: <>Puppeteer ships (prequel)</>, desc: <>Andrey Lushnikov builds Puppeteer inside Google's Chrome team — a Node wrapper over CDP. Within two years it dominates the E2E space, but the structural limits are baked in.</> } },
    { year: '2019·11', zh: { title: <>核心团队加入 Microsoft</>, desc: <>Lushnikov / Einbinder / Feldman 三人一起从 Google 离职, 加入 Microsoft Edge / Visual Studio 团队, 立项重写。</> }, en: { title: <>Core team joins Microsoft</>, desc: <>Lushnikov / Einbinder / Feldman leave Google together and join Microsoft (Edge / Visual Studio) to start the rewrite.</> } },
    { year: '2020·01', zh: { title: <>Playwright 1.0 公开</>, desc: <>1 月 31 日开源。第一版就支持 Chromium / Firefox / WebKit 三引擎、context 隔离、auto-wait, 这些都是 Puppeteer 一直缺的。</> }, en: { title: <>Playwright public release</>, desc: <>Open-sourced on January 31. The first release already supports Chromium / Firefox / WebKit, context isolation, and auto-wait — all the things Puppeteer never had.</> } },
    { year: '2020·07', zh: { title: <>Python / Java / .NET 一等公民</>, desc: <>不是社区移植, 是 Microsoft 官方维护。同一份功能集在四种语言上对齐, 这是 Selenium 之后第一个做到的。</> }, en: { title: <>Python / Java / .NET first-class</>, desc: <>Not community ports — officially maintained by Microsoft. The same feature set is aligned across four languages, the first time since Selenium.</> } },
    { year: '2021·05', zh: { title: <>@playwright/test 发布</>, desc: <>官方 test runner, 自带 fixtures / 并行 worker / 自动重试 / web-first 断言。从此 Playwright 不再依赖 Jest / Mocha。</> }, en: { title: <>@playwright/test ships</>, desc: <>The official test runner with fixtures, parallel workers, auto-retry, and web-first assertions. From here on, Playwright is independent of Jest / Mocha.</> } },
    { year: '2022·03', zh: { title: <>Trace Viewer GA</>, desc: <>跑失败的测试自动产出 <code>trace.zip</code>, 双击打开看每一帧 DOM 快照 + 网络 + console。把 "flaky 测试谁也修不了" 这件事变成 "看 trace 就知道"。</> }, en: { title: <>Trace Viewer GA</>, desc: <>Failed tests automatically emit a <code>trace.zip</code> — double-click to walk through every DOM snapshot, network event, and console line. Turns "flaky tests no one can fix" into "open the trace and see."</> } },
    { year: '2023·02', zh: { title: <>UI Mode</>, desc: <>本地开发期的可视化 runner:watch 模式 + 直接点单个测试 + 内嵌 trace viewer。开发体验追平 Cypress GUI。</> }, en: { title: <>UI Mode</>, desc: <>A visual runner for local dev: watch mode + click-to-run + embedded trace viewer. Closes the gap with Cypress's GUI.</> } },
    { year: '2023·10', zh: { title: <>下载量反超 Cypress</>, desc: <>npm 周下载首次超过 Cypress, 之后差距持续扩大。GitHub 星数也在 2024 追平。</> }, en: { title: <>Overtakes Cypress on npm</>, desc: <>Weekly npm downloads surpass Cypress for the first time, and the gap keeps widening. GitHub stars catch up by 2024.</> } },
    { year: '2024·12', highlight: true, zh: { title: <>Playwright MCP 发布</>, desc: <>Microsoft 官方 MCP 服务器, 把 Playwright 浏览器能力暴露给 LLM agent。Claude Code / Cursor 等直接用 accessibility snapshot 而不是截图来 "看" 页面。</> }, en: { title: <>Playwright MCP ships</>, desc: <>Microsoft's official MCP server — exposes Playwright's browser control to LLM agents. Claude Code / Cursor and others read pages via accessibility snapshots instead of screenshots.</> } },
    { year: '2025·06', zh: { title: <>1.50 + Component Testing GA</>, desc: <>组件级测试 (React / Vue / Svelte) 走 stable 通道, 取代之前的 experimental。从此一个工具同时覆盖 component + E2E。</> }, en: { title: <>1.50 + Component Testing GA</>, desc: <>Component testing (React / Vue / Svelte) graduates from experimental. One tool now covers both component and E2E tests.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>1.60 / 当前稳定</>, desc: <>2026-05 最新点 release。npm 周下载领先 E2E 框架第一档, MCP 已成为 AI agent 标配。</> }, en: { title: <>1.60 / current stable</>, desc: <>Latest patch in 2026-05. Leads the E2E category on weekly npm downloads; MCP is now standard issue for AI agents.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>test + expect</>, desc: <>测试是一个 async 函数, 拿 <code>page</code> fixture, 用 web-first 的 <code>expect</code> 做断言。</> }, en: { title: <>test + expect</>, desc: <>A test is an async function that takes the <code>page</code> fixture; assertions go through the web-first <code>expect</code>.</> }, code: <code>{f('test')}({s('"home loads"')}, {k('async')} ({'{'} {v('page')} {'}'}) =&gt; {'{'}{'\n'}  {k('await')} {v('page')}.{f('goto')}({s('"/"')});{'\n'}  {k('await')} {f('expect')}({v('page')}).{f('toHaveTitle')}(/cuberoot/);{'\n'}{'}'});</code> },
    { tag: 'B', zh: { title: <>Locator</>, desc: <>不立即执行, 表示"如何找到一个元素"。每次交互前重新查询, auto-wait 直到元素出现 / 可点。</> }, en: { title: <>Locator</>, desc: <>Lazy — it describes how to find an element, re-queried before every interaction and auto-waited until visible / actionable.</> }, code: <code>{k('const')} {v('btn')} = {v('page')}.{f('getByRole')}({s('"button"')}, {'{'} {p('name')}: {s('"Submit"')} {'}'});{'\n'}{k('await')} {v('btn')}.{f('click')}();</code> },
    { tag: 'C', zh: { title: <>Auto-wait</>, desc: <>所有交互方法 (click / fill / type) 内置等待 — 元素可见、稳定、能接收事件才执行。flaky 测试一大半被这一条干掉。</> }, en: { title: <>Auto-wait</>, desc: <>Every interaction (click / fill / type) waits internally — for visible, stable, and event-receivable before acting. Half of the flaky tests are killed by this alone.</> }, code: <code>{c('// no explicit wait needed')}{'\n'}{k('await')} {v('page')}.{f('click')}({s('"text=Save"')});</code> },
    { tag: 'D', zh: { title: <>Browser Context</>, desc: <>等价于一个隔离的"浏览器窗口剖面" — 独立 cookies / localStorage / 缓存。比 launch 一个新 browser 便宜两个数量级, 用来做多用户场景测试。</> }, en: { title: <>Browser context</>, desc: <>An isolated "browser profile" with its own cookies / localStorage / cache. Two orders of magnitude cheaper than launching a new browser; perfect for multi-user scenarios.</> }, code: <code>{k('const')} {v('ctx')} = {k('await')} {v('browser')}.{f('newContext')}();{'\n'}{k('const')} {v('page')} = {k('await')} {v('ctx')}.{f('newPage')}();</code> },
    { tag: 'E', zh: { title: <>Fixtures</>, desc: <>类似 Pytest fixture — 测试函数声明它需要什么, runner 自动注入 + 清理。可层叠、可 scope 到 worker / test。</> }, en: { title: <>Fixtures</>, desc: <>Pytest-style — a test declares what it needs, the runner injects + tears down. Stackable, scoped per worker / per test.</> }, code: <code>{k('export')} {k('const')} {v('test')} = {v('base')}.{f('extend')}&lt;{'{'} {p('cube')}: {t('Cube')} {'}'}&gt;({'{'}{'\n'}  {p('cube')}: {k('async')} ({'{}'}, {v('use')}) =&gt; {f('use')}({k('new')} {f('Cube')}()),{'\n'}{'}'});</code> },
    { tag: 'F', zh: { title: <>Network 拦截</>, desc: <><code>page.route</code> 在浏览器和服务器之间插一层, 可以 mock 任何 fetch / xhr。WCA OAuth 测试就靠这条让本地不真跳第三方。</> }, en: { title: <>Network interception</>, desc: <><code>page.route</code> sits between browser and network — mock any fetch / xhr. WCA OAuth tests use this to avoid real third-party hops in local runs.</> }, code: <code>{k('await')} {v('page')}.{f('route')}({s('"**/api/me"')}, {v('r')} =&gt;{'\n'}  {v('r')}.{f('fulfill')}({'{'} {p('json')}: {v('mockUser')} {'}'}));</code> },
    { tag: 'G', zh: { title: <>Trace Viewer</>, desc: <>每个失败测试产 <code>trace.zip</code>, 内含逐帧 DOM 快照、网络、console、actions 时间线。<code>npx playwright show-trace</code> 直接看。</> }, en: { title: <>Trace Viewer</>, desc: <>Every failing test emits <code>trace.zip</code> with per-action DOM snapshots, network log, console, and an action timeline. View it with <code>npx playwright show-trace</code>.</> }, code: <code>{c('// playwright.config.ts')}{'\n'}{p('use')}: {'{'} {p('trace')}: {s('"on-first-retry"')} {'}'}</code> },
    { tag: 'H', zh: { title: <>Codegen</>, desc: <><code>npx playwright codegen</code> 打开浏览器, 用户手动点, Playwright 同步生成测试代码。新人写第一个 spec 文件大幅降门槛。</> }, en: { title: <>Codegen</>, desc: <><code>npx playwright codegen</code> opens a browser; the user clicks, Playwright emits matching test code. The on-ramp for first-time authors collapses.</> }, code: <code>{c('# generate to file')}{'\n'}{v('npx')} playwright codegen {v('https://cuberoot.me')}</code> },
  ],
  whyCards: [
    { icon: '⚙', zh: { title: <>auto-wait 杀 flaky</>, desc: <>"点击之前等元素可见 + 稳定 + 能接收事件" 是默认行为。手写 <code>waitForSelector</code> / sleep 的需求大幅消失, flaky 测试少一个数量级。</> }, en: { title: <>Auto-wait kills flakes</>, desc: <>"Visible + stable + event-receivable before click" is the default. The need to hand-write <code>waitForSelector</code> / sleeps mostly evaporates; flaky tests drop by an order of magnitude.</> }, code: <>{k('await')} {v('page')}.{f('click')}({s('"#submit"')});</> },
    { icon: '⌬', zh: { title: <>三引擎统一 API</>, desc: <>一份测试代码同时跑 Chromium / Firefox / WebKit。WebKit 在 Mac / iOS 上的细节 bug 头一次能在 CI 里被测。</> }, en: { title: <>Three engines, one API</>, desc: <>The same code runs on Chromium / Firefox / WebKit. WebKit-specific Mac / iOS quirks can finally be caught in CI.</> }, code: <>{c('// playwright.config.ts')}{'\n'}{p('projects')}: [{s('"chromium"')}, {s('"firefox"')}, {s('"webkit"')}]</> },
    { icon: '❇', zh: { title: <>Trace Viewer</>, desc: <>失败测试的 <code>trace.zip</code> 把 "为什么挂" 从猜测变成证据。每一步的 DOM 快照都在, 跨进程定位时间能砍掉九成。</> }, en: { title: <>Trace Viewer</>, desc: <>The failing test's <code>trace.zip</code> turns "why did this fail" from guessing into evidence. With per-step DOM snapshots, time spent diagnosing across processes drops nine-tenths.</> }, code: <>{p('trace')}: {s('"retain-on-failure"')}</> },
    { icon: '∇', zh: { title: <>Locator 抽象</>, desc: <>Locator 是 "如何找", 不是 "现在的元素引用"。每次交互重新查询, 避开 stale element ref 这类经典 Selenium 病。</> }, en: { title: <>Locator abstraction</>, desc: <>A locator is "how to find," not "a current element reference." Each interaction re-queries, dodging the stale-element class of Selenium pain.</> }, code: <>{v('page')}.{f('getByRole')}({s('"button"')}, {'{'} {p('name')}: {s('"OK"')} {'}'})</> },
    { icon: '⚡', zh: { title: <>Context 比 Browser 便宜</>, desc: <>测试间隔离用 Context (毫秒), 不是新启动 Browser (秒级)。并行 worker 默认 CPU 核心数, 全套 200 个测试在笔记本上几十秒跑完。</> }, en: { title: <>Context cheaper than browser</>, desc: <>Isolation is via Context (milliseconds), not a fresh Browser (seconds). Parallel workers default to CPU count — 200-test suites finish in tens of seconds on a laptop.</> }, code: <>{k('const')} {v('ctx')} = {k('await')} {v('browser')}.{f('newContext')}();</> },
    { icon: '⧁', zh: { title: <>跨语言一等</>, desc: <>TS / JS / Python / Java / .NET 五种语言都是官方维护, 同一份能力集。Selenium 之后第一次有人把这件事做对。</> }, en: { title: <>First-class polyglot</>, desc: <>TS / JS / Python / Java / .NET — all officially maintained, with the same feature set. The first project since Selenium to do this properly.</> }, code: <>{c('# Python')}{'\n'}{k('async')} {k('with')} {f('async_playwright')}() {k('as')} pw:</> },
    { icon: '⌭', zh: { title: <>AI agent 标配</>, desc: <>Playwright MCP 把浏览器能力暴露为 MCP tools。Claude Code / Cursor 等 agent 直接调 <code>browser_navigate</code> / <code>browser_click</code> / <code>browser_snapshot</code>, 看 accessibility tree 而不是看截图。</> }, en: { title: <>Standard issue for AI agents</>, desc: <>Playwright MCP exposes browser control as MCP tools. Claude Code / Cursor and similar agents call <code>browser_navigate</code> / <code>browser_click</code> / <code>browser_snapshot</code> and read the accessibility tree instead of pixels.</> }, code: <>{v('npx')} @playwright/mcp@latest</> },
    { icon: '⌖', zh: { title: <>Codegen 降门槛</>, desc: <><code>playwright codegen</code> 录制用户操作变测试代码。新人写第一份 spec 不再需要先记一遍 selector 语法。</> }, en: { title: <>Codegen lowers the on-ramp</>, desc: <><code>playwright codegen</code> records user actions into test code. A new author's first spec no longer requires memorizing selector syntax up front.</> }, code: <>{v('npx')} playwright codegen {v('localhost:5173')}</> },
    { icon: '⦿', zh: { title: <>Microsoft 长期投入</>, desc: <>项目挂在 Microsoft 旗下, Edge / VS Code / GitHub 自己用, 路线图稳定到至少 2030。不是单点维护项目, 没有突然停更风险。</> }, en: { title: <>Microsoft-backed long term</>, desc: <>Owned by Microsoft, used by Edge / VS Code / GitHub themselves. The roadmap is stable through at least 2030 — no one-maintainer abandonment risk.</> }, code: <>{c('// github.com/microsoft/playwright')}</> },
  ],
  adopters: [
    { name: 'Microsoft (Edge / VS Code / GitHub)', highlight: true, zhNote: '亲爹 + 内部 CI 全在跑', enNote: 'The parent — internal CI all rides Playwright' },
    { name: 'Visual Studio Code', href: 'https://github.com/microsoft/vscode', highlight: true, zhNote: '编辑器自身 E2E 套件用 Playwright', enNote: 'The editor itself runs its E2E suite on Playwright' },
    { name: 'Playwright MCP', href: 'https://github.com/microsoft/playwright-mcp', highlight: true, zhNote: 'Microsoft 官方 MCP 服务器, AI agent 浏览器后端', enNote: 'Microsoft official MCP server — browser backend for AI agents' },
    { name: 'Anthropic Claude Code', href: 'https://github.com/anthropics/claude-code', highlight: true, zhNote: 'CLI agent 通过 Playwright MCP 看页面', enNote: 'CLI agent reads pages via Playwright MCP' },
    { name: 'Cursor', href: 'https://cursor.com', zhNote: 'AI IDE, 内置浏览器自动化', enNote: 'AI IDE with built-in browser automation' },
    { name: 'Vercel · Next.js', href: 'https://nextjs.org', zhNote: 'Next 官方 E2E 示例从 Cypress 换 Playwright', enNote: 'Next moved its official E2E examples from Cypress to Playwright' },
    { name: 'Disney+', zhNote: '流媒体 web 端跨浏览器回归测试', enNote: 'Streaming web client cross-browser regression suite' },
    { name: 'GitHub', href: 'https://github.com', zhNote: '主站 + Copilot web 端都跑 Playwright', enNote: 'Main site + Copilot web both run Playwright' },
    { name: 'GitLab', href: 'https://gitlab.com', zhNote: '从 Selenium 迁过来后大幅减速', enNote: 'Migrated off Selenium for major speed gains' },
    { name: 'Slack', href: 'https://slack.com', zhNote: 'web 端 E2E', enNote: 'Web client E2E' },
    { name: 'Adobe', zhNote: '多个 SaaS 产品 (Spark / Express 等)', enNote: 'Multiple SaaS products (Spark / Express, etc.)' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 calc / recon / code 回归测试 + MCP 验证', enNote: 'This site — regression suites + MCP verification' },
  ],
  outlook: [
    { tag: <>HOT · 2024-12</>, hot: true, big: true, zh: { title: <>Playwright MCP 改变定位</>, body: <><p>Microsoft 2024-12 官方发布 Playwright MCP。它不只是把测试 API 包成 MCP tool, 更重要的是把<strong>页面表达成 accessibility snapshot</strong>给 LLM, 而不是截图 — 模型直接读到结构化的 DOM 角色树, token 用量低 90%, 行为更确定。</p><p>这一脚把 Playwright 从"E2E 测试框架"扩展成"AI agent 标准浏览器后端"。Claude Code / Cursor / Anthropic 的 agent 应用全部默认走它。这不是新场景, 是新身份。</p></> }, en: { title: <>Playwright MCP changes the role</>, body: <><p>Microsoft shipped Playwright MCP officially in 2024-12. The interesting part is not wrapping the API as MCP tools — it is exposing pages as <strong>accessibility snapshots</strong> for the LLM rather than screenshots. The model reads a structured DOM-role tree, token cost drops ~90%, and behavior becomes more deterministic.</p><p>This pivots Playwright from "E2E test framework" into "the standard browser backend for AI agents." Claude Code / Cursor / Anthropic-style agent products default to it. It is not a new use case — it is a new identity.</p></> } },
    { tag: 'TRACE', zh: { title: <>Trace Viewer 成调试标准</>, body: <><p>失败测试自动产 <code>trace.zip</code> 这套 (DOM 快照 + 网络 + console + actions 时间线) 在 2025 已经是其它工具被对标的标杆。Cypress / Selenium / Puppeteer 都在补这个能力, 但都没追上原生集成度。</p></> }, en: { title: <>Trace Viewer is the new bar</>, body: <><p>The failing-test <code>trace.zip</code> (DOM snapshots + network + console + action timeline) is the standard the rest of the field is measured against in 2025. Cypress / Selenium / Puppeteer are all bolting on similar features, but none match the native integration.</p></> } },
    { tag: 'CYPRESS', zh: { title: <>Cypress 时代结束</>, body: <><p>2023-10 npm 下载量 Playwright 反超 Cypress, 至今差距持续扩大。Cypress 多 iframe / 跨 origin / 多 tab 的限制始终没修, 加上自家收费 dashboard 让社区不爽, 这两年大量项目迁过来。</p></> }, en: { title: <>The Cypress era is over</>, body: <><p>Playwright passed Cypress on weekly npm downloads in 2023-10 and the gap keeps widening. Cypress never fixed its multi-iframe / cross-origin / multi-tab limits, and its paid dashboard alienated the community; the migration wave has been steady for two years.</p></> } },
    { tag: <>COMPONENT</>, zh: { title: <>组件测试 GA</>, body: <><p>2025 起 React / Vue / Svelte 的 component testing 走 stable。一个工具同时覆盖 component + E2E + visual diff, 团队不需要再为这三件事各上一个栈。Vitest + Playwright 组合在 2026 已是默认。</p></> }, en: { title: <>Component testing GA</>, body: <><p>From 2025, component testing (React / Vue / Svelte) is stable. One tool covers component + E2E + visual diff — teams no longer maintain three separate stacks. Vitest + Playwright is the 2026 default pairing.</p></> } },
    { tag: <>DATA</>, zh: { title: <>npm 周下载第一档</>, body: <><p>2026-05 数据:<code>@playwright/test</code> 周下载约 1500 万, 在 E2E 框架里第一。Selenium WebDriver 大致同档但属于工具底层, Cypress 已掉到第二档, Puppeteer 主要被库内嵌使用。</p></> }, en: { title: <>npm top tier</>, body: <><p>As of 2026-05: <code>@playwright/test</code> sits around 15M weekly downloads, top of the E2E category. Selenium WebDriver is in the same tier but lives at a lower layer; Cypress is now a tier below; Puppeteer mostly appears as a transitive dep.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本站把 Playwright 用在两条线上。<strong>测试线</strong>:E2E 套件用 <code>pnpm playwright test</code> 跑, 覆盖 calc / recon / trainer 这些有交互的页面。最严格的一条规则是 — 任何 <code>pages/calc/*</code> 的编辑必须跑 <code>tests/calc-interactions.mjs</code> 一次, 不能采样不能跳。fixtures 走全集, 因为 calc 的 fixture 互相耦合, 采样会漏 bug。</p>
        <p><strong>Agent 线</strong>:开发期用 <strong>Playwright MCP</strong> 做 ad-hoc 验证。Claude Code 在改完 UI 后可以直接 <code>browser_navigate</code> 到 <code>http://127.0.0.1:5173/code/stack</code>, <code>browser_snapshot</code> 读 accessibility tree, 或者 <code>browser_take_screenshot</code> 给作者看视觉差异。这一套不强制 — 用户偏好是 "AI 别主动开浏览器, 我自己看", 所以 MCP 只在用户明确要求或无人值守任务时主动用。</p>
        <p>失败的截图 / 调试图 / 对比图统一落到 <code>.tmp/png/</code>, 不进仓库。MCP 报 "browser has been closed" 时先 <code>browser_close</code> 再重新 navigate, 不要试图复用挂掉的 session。<code>playwright/test</code> 的并行 worker 默认开满, 但跑 calc 套件时强制 <code>--workers=1</code>, 因为 fixture 共享 cube state。</p>
        <p>Trace Viewer 在 CI 上开 <code>retain-on-failure</code>, 失败的 trace artifact 会上传到 GitHub Actions, 用 <code>npx playwright show-trace trace.zip</code> 在本地复盘。这一条让远程 CI 失败不再需要 "我本地复现一下" — trace 已经把现场封装好了。</p>
      </>
    ),
    en: (
      <>
        <p>This site runs Playwright on two tracks. <strong>Test track</strong>: the E2E suite runs via <code>pnpm playwright test</code>, covering interactive pages like calc / recon / trainer. The strictest rule: any edit under <code>pages/calc/*</code> must run <code>tests/calc-interactions.mjs</code> once — no sampling, no skipping. Fixtures go in full because calc fixtures cross-couple and sampling hides bugs.</p>
        <p><strong>Agent track</strong>: during development, <strong>Playwright MCP</strong> handles ad-hoc verification. After a UI edit, Claude Code can <code>browser_navigate</code> to <code>http://127.0.0.1:5173/code/stack</code>, <code>browser_snapshot</code> to read the accessibility tree, or <code>browser_take_screenshot</code> to show visual diffs. This is opt-in — the author's preference is "do not auto-open browsers, I will look myself," so MCP only fires when explicitly asked or in unattended tasks.</p>
        <p>Screenshots / debug images / comparison shots all land in <code>.tmp/png/</code>, never in the repo. If MCP reports "browser has been closed," call <code>browser_close</code> first and then re-navigate — do not try to reuse a dead session. <code>playwright/test</code>'s parallel workers run at the default count, but the calc suite forces <code>--workers=1</code> because the fixture shares cube state.</p>
        <p>Trace Viewer is set to <code>retain-on-failure</code> in CI; failing trace artifacts upload to GitHub Actions and replay locally with <code>npx playwright show-trace trace.zip</code>. This rule alone removes the "let me reproduce on my machine" step — the trace already ships the scene.</p>
      </>
    ),
  },
  links: [
    { label: 'playwright.dev', href: 'https://playwright.dev' },
    { label: 'GitHub · microsoft/playwright', href: 'https://github.com/microsoft/playwright' },
    { label: 'Playwright MCP', href: 'https://github.com/microsoft/playwright-mcp' },
    { label: 'Release notes', href: 'https://playwright.dev/docs/release-notes' },
  ],
};
