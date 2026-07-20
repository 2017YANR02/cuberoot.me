// Data for /code/guards, shared with tests/code-guards-drift.test.ts (which keeps this
// honest: every guard test must carry a `guard-registry` marker comment, and every test
// filename referenced below must carry that same marker — see that test file for the
// exact contract). Edit this file, not duplicated data in page.tsx.

export interface PairedGuard {
  id: string;
  hook: string;
  test: string;
  baseline: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

export const PAIRED_GUARDS: PairedGuard[] = [
  {
    id: 'checkbox',
    hook: 'block-raw-checkbox.ps1',
    test: 'no-raw-checkbox.test.ts',
    baseline: '0（113→0）',
    zh: { title: '裸 checkbox', desc: '禁 <input type="checkbox">,布尔开关统一走 BoolToggle（左滑钮 + 右文字）。多选网格/列表例外,行内 allow-checkbox 豁免。' },
    en: { title: 'Raw checkbox', desc: 'No bare <input type="checkbox"> — boolean toggles go through BoolToggle (left switch + right label). Multi-select grids are exempt via inline allow-checkbox.' },
  },
  {
    id: 'static-onclick',
    hook: 'block-static-onclick-button.ps1',
    test: 'no-static-element-onclick-button.test.ts',
    baseline: '45 ↓',
    zh: { title: '假按钮（静态元素 onClick）', desc: '<div>/<span> 挂 onClick 当按钮 —— iOS Safari（实测 iOS 26）不可靠把 tap 合成 click,选择器点不动,:hover 还伪装成"已选中"。必须真 <button> 或 role="button" + tabIndex + onKeyDown。' },
    en: { title: 'Fake buttons (onClick on static tags)', desc: '<div>/<span> with onClick as a button — iOS Safari (tested on iOS 26) doesn’t reliably synthesize tap→click, leaving pickers untappable while :hover fakes "selected". Must be a real <button> or role="button" + tabIndex + onKeyDown.' },
  },
  {
    id: 'button-nav',
    hook: 'block-button-navigation.ps1',
    test: 'no-button-navigation.test.ts',
    baseline: '0',
    zh: { title: '按钮当链接', desc: 'onClick 里直接 router.push/replace 当导航 —— 中键/Ctrl 点开新标签页失效,复制链接、SEO、爬虫可达全丢。站内跳转一律真 <a> / AppLink。' },
    en: { title: 'Buttons as links', desc: 'onClick calling router.push/replace as navigation breaks middle-click/Ctrl-click new-tab, copy-link, SEO and crawlers. Internal navigation must be a real <a> / AppLink.' },
  },
  {
    id: 'raw-history',
    hook: 'block-raw-history-url-state.ps1',
    test: 'url-state-no-raw-history.test.ts',
    baseline: '0',
    zh: { title: '裸 history.pushState / popstate', desc: '页内 URL 状态一律走 nuqs（useQueryState）,禁手写 history.pushState/replaceState + popstate 监听。maplibre / canvas / zustand 等重组件走 ALLOWLIST 豁免。' },
    en: { title: 'Raw history.pushState / popstate', desc: 'Page-level URL state goes through nuqs (useQueryState) — no hand-rolled history.pushState/replaceState + popstate listeners. Heavy components (maplibre, canvas, zustand stores) are exempted via an ALLOWLIST.' },
  },
  {
    id: 'ime-input',
    hook: 'block-nuqs-ime-input.mjs',
    test: 'ime-safe-search-input.test.ts',
    baseline: '0',
    zh: { title: 'IME 不安全的搜索框', desc: '<input>/<textarea> 的 value 直接绑 nuqs 状态,每次按键写回 URL 会打断中文/日文输入法合成。统一走 <SearchInput>(已内置 composition 处理)。' },
    en: { title: 'IME-unsafe search input', desc: 'An <input>/<textarea> with its value bound directly to a nuqs state writes back to the URL on every keystroke, breaking CJK input-method composition. Use <SearchInput> (composition handling built in).' },
  },
  {
    id: 'anchored-panel',
    hook: 'block-unclamped-anchored-panel.ps1 → hook-detect-unclamped-anchored-panel.mjs',
    test: 'anchored-panel-clamp.test.ts',
    baseline: '21 ↓',
    zh: { title: '锚定下拉面板未钳视口', desc: '挂在触发钮下方的浮层(position:absolute + top:~100%)在触发钮靠右时右缘越出视口被裁(issue #29 首页两个 picker 手机端被切)。新面板必须挂 usePanelClamp 并在 CSS 注明 anchored-panel: clamped,或确证安全注明 anchored-panel: safe;两侧钉死 / width:100% 的形态自动豁免。运行时实测走 audit:overflow 的 popup pass。' },
    en: { title: 'Anchored panel without viewport clamp', desc: 'A panel anchored under its trigger (position:absolute + top:~100%) gets clipped at the right viewport edge when the trigger sits near it (issue #29: both homepage pickers on phones). New panels must wire usePanelClamp and declare anchored-panel: clamped in the CSS (or anchored-panel: safe with a reason); left+right-pinned / width:100% shapes are auto-exempt. Runtime verification via the audit:overflow popup pass.' },
  },
  {
    id: 'raw-localstorage',
    hook: 'block-raw-localstorage-setitem.ps1',
    test: 'no-raw-localstorage-setitem.test.ts',
    baseline: '0（95→0）',
    zh: { title: '裸 localStorage.setItem', desc: '禁裸 localStorage.setItem / window.localStorage.setItem —— 线上源的 ~5MB 配额常被 timer 自动备份塞满,裸写在事件处理器里抛 QuotaExceededError 会把后续状态更新一起炸掉(2026-07 trainer 全选线上点了没反应就是这个)。一律走 lib/safe-storage 的 persistItem(捕获配额错、驱逐可再生缓存后重试、永不抛)。自带驱逐-重试循环的兜底行内 allow-raw-localstorage 豁免。' },
    en: { title: 'Raw localStorage.setItem', desc: 'No bare localStorage.setItem / window.localStorage.setItem — the origin’s ~5MB quota is routinely packed by timer auto-backups, so a raw write throws QuotaExceededError inside an event handler and takes the following state update down with it (that’s exactly why trainer select-all silently did nothing on prod in 2026-07). All writes funnel through lib/safe-storage’s persistItem (catches the quota error, evicts regenerable caches, retries, never throws). Fallbacks with their own evict-retry loop are exempt via inline allow-raw-localstorage.' },
  },
  {
    id: 'traditional',
    hook: 'block-handwritten-trad.ps1 → hook-detect-traditional.mjs',
    test: 'i18n-removal-guard.test.ts + i18n-no-isz-text-ternary.test.ts',
    baseline: '0（419→0）',
    zh: { title: '手写繁体 / 内联语言三元', desc: '全站只服 en + 简体。禁手敲繁体字(繁体走 OpenCC 生成器),禁残留 zh-Hant 标识符,禁新写 isZh 驱动的内联中英文案三元(一边中文一边英文那种写法)—— 一律 tr() / <T> / useT() / t() 收口。' },
    en: { title: 'Handwritten Traditional / inline language ternary', desc: 'The site serves only en + Simplified. No hand-typed Traditional characters (generated via OpenCC), no leftover zh-Hant identifiers, no new isZh-driven inline ternary that branches directly between a CJK string and an English string — all text funnels through tr() / <T> / useT() / t().' },
  },
  {
    id: 'forwarded-for',
    hook: 'block-server-forwarded-for.ps1 → hook-detect-server-forwarded-for.mjs',
    test: 'server-no-forwarded-for.test.ts',
    baseline: '0（21→0）',
    zh: { title: '可伪造 X-Forwarded-For 作 IP', desc: '禁在 server 源码读取 X-Forwarded-For 头作请求 IP 来源 —— XFF 由客户端自填,谁都能伪造 → IP / visitor_id / 国家 spoofing、绕限流、污染统计。请求 IP 统一走 getIp(c)(utils/analytics_helpers.ts 单一源,只读 nginx 写入的可信 x-real-ip);原来 21 个 route 各抄一份带 XFF 回退的本地 getIp,已收敛成这一份。确有正当用途(仅记录原始 XFF 链、绝不用于身份判定)行内 allow-forwarded-for 豁免。' },
    en: { title: 'Forgeable X-Forwarded-For as IP', desc: 'No reading the X-Forwarded-For header as the request IP source in server code — XFF is client-set and anyone can forge it → IP / visitor_id / country spoofing, rate-limit bypass, polluted analytics. Request IP funnels through getIp(c) (utils/analytics_helpers.ts, the single source, reads only nginx’s trusted x-real-ip); 21 routes each had their own local getIp with an XFF fallback, now collapsed to this one. Genuine uses (logging the raw XFF chain, never for identity) are exempt via inline allow-forwarded-for.' },
  },
];

export interface CiGuard {
  id: string;
  test: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

export const CI_GUARDS_UI: CiGuard[] = [
  {
    id: 'cubing-term-blacklist',
    test: 'i18n-cubing-term-blacklist.test.ts',
    zh: { title: '魔方术语错译', desc: 'AI 写双语文案按通用语感直译魔方黑话(Overwork≠劳累义直译、Commutator≠通用数学直译、Finger Trick≠逐字直译),语法全对但社区不这么说 —— 正确译法依次为「复用 / 换位子 / 指法」。权威译法单一源 = /wiki 的 glossary.json(713 条中英对照);本守卫锁已修正错译的黑名单,发现新错译修完即加入。豁免行内 allow-cubing-term。' },
    en: { title: 'Cubing term mistranslations', desc: 'AI-written bilingual copy tends to translate cubing jargon literally (Overwork, Commutator, Finger Trick rendered as generic Chinese) — grammatical but not what the community says; the approved terms are 复用 / 换位子 / 指法. The single source of approved translations is the /wiki glossary.json (713 EN/ZH entries); this guard locks a blacklist of corrected mistranslations, growing as new ones get fixed. Inline allow-cubing-term to exempt.' },
  },
  {
    id: 'sort-arrow',
    test: 'sort-arrow-unified.test.ts',
    zh: { title: '自造排序箭头', desc: '禁 JSX 渲染 <ChevronsUpDown>(双向 ^v),表头排序指示统一走 SortArrow(↑/↓ 贴文字右侧,仅当前排序列显示)。' },
    en: { title: 'Hand-rolled sort glyph', desc: 'No JSX rendering of <ChevronsUpDown> (the bidirectional ^v) — table header sort indicators go through SortArrow (↑/↓ beside the label, shown only on the active column).' },
  },
  {
    id: 'css-bare-interactive',
    test: 'css-no-bare-interactive-descendant.test.ts',
    zh: { title: '容器后代裸交互选择器', desc: '禁 .容器 button/input/select/textarea {} 这类选择器 —— 特异性 0-1-1 压过共享组件自身的 0-1-0,塞进 ClearButton / PillToggle / Picker 会被无声压变形(本仓两次实际踩坑)。目标元素须加专属角色 class。' },
    en: { title: 'Bare-interactive descendant selectors', desc: 'No `.container button/input/select/textarea {}` selectors — specificity 0-1-1 silently crushes a shared component’s own 0-1-0 class the moment one is dropped inside (hit twice for real here). Target elements need a dedicated role class instead.' },
  },
  {
    id: 'pilltoggle-fit',
    test: 'pilltoggle-default-fit.test.ts',
    zh: { title: 'PillToggle 默认宽度', desc: '锁住 PillToggle 两根支柱:基类 min-width:0(默认贴合文字)+ 两个隐形 ghost span(按更长标签预留宽度,切换不跳变),防止哪天被悄悄改回固定宽度。' },
    en: { title: 'PillToggle default width', desc: 'Locks two pillars of PillToggle: the base class keeps min-width:0 (hugs its label by default) and renders two invisible ghost spans that reserve the longer label’s width so toggling never jumps — guards against either silently regressing.' },
  },
  {
    id: 'fixed-width-dropdown',
    test: 'no-fixed-width-dropdown-root.test.ts',
    zh: { title: '下拉 root 死宽无 max-width', desc: '下拉 / 选择器 / 触发器的 root(类名以 -picker / -trigger / -dropdown / -combobox 结尾)禁写死宽 width ≥ 120px 而不配 max-width —— 塞进能被压窄的筛选栏 flex 列会窄屏溢出、压到相邻控件(国家框 .region-picker 220px 实测踩过)。root 应 width:100% / fit-content,或同规则块补 max-width:100%;真定尺小部件行内 allow-fixed-width 豁免。全机制经验式检查走 pnpm audit:overflow。' },
    en: { title: 'Fixed-width dropdown root without max-width', desc: 'A dropdown/picker/trigger root (class ending in -picker / -trigger / -dropdown / -combobox) can’t set a fixed width ≥ 120px without max-width — dropped into a squeezable filter-bar flex column it overflows on mobile and overlaps the next control (hit for real with the 220px .region-picker country box). Use width:100% / fit-content, or add max-width:100% in the same rule; genuinely fixed-size widgets exempt via inline allow-fixed-width. The full-mechanism empirical check is pnpm audit:overflow.' },
  },
  {
    id: 'solver-shared-base',
    test: 'scramble-solver-shared-base.test.ts',
    zh: { title: 'scramble/solver 复制粘贴求解器页', desc: '/scramble/solver 的单行 puzzle-optimal 求解器页(28 个)一律走共享基座 PuzzleSolverPage(config 驱动的 SolverSpec + 一行渲染),禁再各自手搓 SolveState / reqRef / renderSingle 那套 ~130 行样板。新写的 _*Solver.tsx 没 import PuzzleSolverPage → 集合变化直接红;真异形(自定义 UI,现只剩 Cube3 / Sq1)加进 BESPOKE 白名单当 review 信号。' },
    en: { title: 'scramble/solver copy-paste solver pages', desc: 'The single-line puzzle-optimal solver pages under /scramble/solver (28 of them) go through the shared PuzzleSolverPage base (config-driven SolverSpec + one-line render) — no more hand-rolled SolveState / reqRef / renderSingle (~130 lines each). A new _*Solver.tsx not importing PuzzleSolverPage changes the set and turns CI red; genuinely bespoke ones (custom UI — only Cube3 / Sq1 remain) join the BESPOKE allowlist as a review signal.' },
  },
  {
    id: 'hash-nav-single-source',
    test: 'hash-nav-single-source.test.ts',
    zh: { title: 'hash 锚点滚动+高亮各写一份', desc: '「点某项 → URL 片段 → 滚到它并高亮」原本六处各手搓(/wiki 词条、person 两张成绩表、/alg 公式卡、/wca/prediction 项目段、论坛帖子),ByCompList/ByEventView 更是逐字复制。已抽成 useHashHighlight(差异点 resolve / reveal / linger / highlightClass / onScroll / deps 全作 options)。除该 hook 外任何文件再挂 hashchange 监听 = CI 红,指回 hook;OAuth 回调等另类用途走 ALLOWLIST + 理由。' },
    en: { title: 'Hand-rolled hash-anchor scroll+highlight', desc: '"Click a thing → URL fragment → scroll to it and highlight" was hand-rolled in six places (wiki entries, the two person result tables, alg cards, prediction event sections, forum posts) — ByCompList/ByEventView near-verbatim copies. Unified into useHashHighlight (differences are options: resolve / reveal / linger / highlightClass / onScroll / deps). Any file other than that hook adding a hashchange listener turns CI red and points back to it; genuinely different uses (OAuth callback, global infra) go through the ALLOWLIST with a reason.' },
  },
];

export const CI_GUARDS_DRIFT: CiGuard[] = [
  {
    id: 'catalog-sync',
    test: 'code-catalog-sync.test.ts',
    zh: { title: '/code/components + /code/utils 登记表漂移', desc: 'hooks/ 里每个导出的 use* hook 必须在 /code/utils 登记表里出现;两个登记表写的 import 路径必须在磁盘上真实存在。漏登记或路径改名各自直接红。' },
    en: { title: '/code/components + /code/utils registry drift', desc: 'Every exported use* hook in hooks/ must appear in the /code/utils catalog; every import path either catalog references must resolve on disk. Forgetting to register or a stale renamed path both turn CI red.' },
  },
  {
    id: 'tokens-drift',
    test: 'code-tokens-drift.test.ts',
    zh: { title: '/code/tokens 数值漂移', desc: '/code/tokens 页面手工抄了 globals.css 的颜色值做展示,这条测试逐条重新对比 —— globals.css 改了令牌却忘了同步页面,直接红。' },
    en: { title: '/code/tokens value drift', desc: '/code/tokens hand-mirrors color values from globals.css for display. This re-diffs every value — change a token in globals.css without updating the page and CI goes red.' },
  },
  {
    id: 'schema-api-drift',
    test: 'code-schema-api-drift.test.ts',
    zh: { title: '/code/schema + /code/api 快照漂移', desc: '/code/schema 的迁移台账须列全 packages/server/migrations 下每个文件;/code/api 的路由清单须等于 server/src/index.ts 里 app.route(‘/v1’, …) 实际挂载的路由。各自漏一条都红。' },
    en: { title: '/code/schema + /code/api snapshot drift', desc: '/code/schema’s migration ledger must list every file in packages/server/migrations; /code/api’s manifest must equal the routes actually mounted via app.route(‘/v1’, …) in server/src/index.ts. Missing either turns CI red.' },
  },
  {
    id: 'solvers-fleet-sync',
    test: 'code-solvers-fleet-sync.test.ts',
    zh: { title: '/code/solvers 舰队表漂移', desc: '/code/solvers 的 NONWCA_TS 表必须与 CSTIMER_SOLVABLE_IDS(真实“已可解”集合)完全一致;还没做的 PLANNED 列表不能跟已可解的撞车。' },
    en: { title: '/code/solvers fleet table drift', desc: '/code/solvers’ NONWCA_TS table must exactly equal CSTIMER_SOLVABLE_IDS (the real "already solvable" set); the not-yet-built PLANNED list must be disjoint from it.' },
  },
  {
    id: 'param-shell-sentinel',
    test: 'dynamic-param-shell-sentinel.test.ts',
    zh: { title: '无界客户端壳 [param] 页哨兵', desc: '无界 id 的纯客户端壳 [param] 页(数据全在浏览器拉)禁用老的 on-demand 模型(dynamicParams=true),必须走单一预生成哨兵壳(dynamicParams=false + generateStaticParams 返 [\'_\'] + next.config rewrite),否则爬虫 / 部署后扫全量按 id 逐个现跑 Function(2026-07-10 comp[slug] 真炸过 Function Invocations spike)。allowlist 只放真 SEO 页 + bounded id 页。' },
    en: { title: 'Unbounded client-shell [param] page sentinel', desc: 'An unbounded pure client-shell [param] page (all data fetched in the browser) can’t use the old on-demand model (dynamicParams=true) — it must ship as ONE prerendered sentinel shell (dynamicParams=false + generateStaticParams -> [\'_\'] + a next.config rewrite), or a crawler / post-deploy sweep renders a Function per id (comp[slug] caused a real Function Invocations spike on 2026-07-10). The allowlist holds only real-SEO and bounded-id pages.' },
  },
  {
    id: 'guards-drift',
    test: 'code-guards-drift.test.ts',
    zh: { title: '/code/guards 自身漂移', desc: '这页也是一份手工快照,所以也有自己的漂移守卫:每个带 guard-registry 标记注释的 CI 测试必须在这页列出,这页列出的每个测试必须真的存在且带标记。新增一对守卫忘了登记 → 直接红。' },
    en: { title: '/code/guards self-drift', desc: 'This page is itself a hand-maintained snapshot, so it gets its own drift guard: every CI test carrying a guard-registry marker comment must be listed here, and every test listed here must actually exist and carry that marker. Add a new guard pair and forget to register it → CI red.' },
  },
];

export const CI_GUARDS_API: CiGuard[] = [
  {
    id: 'cache-headers',
    test: 'server-cache-headers.test.ts',
    zh: { title: 'API 缓存头分层', desc: '可变数据端点禁止给浏览器层发 > 600s 的 max-age(2026-06-10 真撞过:重灌窗口的暂态 null 被浏览器钉了一天)。要长缓存只能走 s-maxage(nginx 共享层),例外须进 IMMUTABLE_ALLOWLIST。' },
    en: { title: 'API cache header layering', desc: 'Mutable-data endpoints can’t ship a browser-layer max-age > 600s (hit for real on 2026-06-10: a transient null during a reload window got pinned by the browser for a day). Long caching only via s-maxage (the nginx shared layer); exceptions must join IMMUTABLE_ALLOWLIST.' },
  },
  {
    id: 'one-email-per-account',
    test: 'one_email_per_account.test.ts',
    zh: { title: '一个账号只能绑一个邮箱', desc: '约束铺三层:0078 偏唯一索引(唯一真保证,挡并发)+ addIdentity 先行检查回 has-email + 前端已有邮箱时不给绑定入口。重点守跨包字面量耦合 —— 服务端错误串和前端 authErrorText 的 includes() 靠同一句英文对上,改一边措辞前端就静默退化成把英文糊给用户。' },
    en: { title: 'One email per account', desc: 'Enforced in three layers: the 0078 partial unique index (the only real guarantee — it stops concurrent double-binds), an addIdentity pre-check returning has-email, and the panel hiding the link entry once an email exists. Mainly guards a cross-package literal: the server error string and the client authErrorText includes() match on the same English sentence, so rewording one side silently degrades the UI into showing raw English.' },
  },
];

export interface ProcessGuard {
  id: string;
  hook: string;
  matcher: string;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

export const PROCESS_GUARDS: ProcessGuard[] = [
  {
    id: 'browser-launch',
    hook: 'guard-browser-launch.mjs',
    matcher: 'Bash | PowerShell',
    zh: { title: 'Ad-hoc Playwright 起浏览器', desc: 'AI 自起的 WebKit/Firefox/Chromium 脚本(不走 MCP)起浏览器前必须先禁 WebRTC,没禁直接拦。' },
    en: { title: 'Ad-hoc Playwright browser launch', desc: 'AI-launched WebKit/Firefox/Chromium scripts (not via MCP) must disable WebRTC before launching — blocked if they don’t.' },
  },
  {
    id: 'webkit-webrtc',
    hook: 'block-webkit-no-webrtc.ps1',
    matcher: 'Edit | Write | MultiEdit',
    zh: { title: '写入态 WebRTC 检测', desc: '写入 .launch( 调用时静态扫描,没带 WebRTC 禁用同样拦 —— 与上面的运行态检测同一份 kill,双保险。' },
    en: { title: 'Write-time WebRTC check', desc: 'Statically scans a written .launch( call — missing the WebRTC kill is blocked the same way, a belt-and-suspenders pair with the runtime check above.' },
  },
  {
    id: 'next-build-dev',
    hook: 'block-next-build-while-dev.ps1',
    matcher: 'Bash | PowerShell',
    zh: { title: 'dev 时禁 next build', desc: 'dev server 在跑时 build 和 dev 共用 .next/,并发写会撕裂 manifest JSON → 全站 500。dev 活着就拦 build。' },
    en: { title: 'No next build while dev runs', desc: 'build and dev share .next/ — concurrent writes tear the manifest JSON and 500 the whole site. Blocked whenever dev is alive.' },
  },
  {
    id: 'repo-image-write',
    hook: 'block-repo-image-write.ps1',
    matcher: 'Bash | PowerShell',
    zh: { title: 'AI 产物落仓库根', desc: 'AI 自己生成的截图 / 调试图 / 对比图写进仓库根或其他工作区路径直接拦,必须落 .tmp/png/。' },
    en: { title: 'AI artifacts landing in the repo', desc: 'AI-generated screenshots / debug images / comparisons written to the repo root or other workspace paths are blocked — they must land in .tmp/png/.' },
  },
  {
    id: 'redirect-screenshot',
    hook: 'redirect-screenshot.ps1',
    matcher: 'mcp__playwright__browser_take_screenshot',
    zh: { title: 'Playwright MCP 截图重定向', desc: '不是拦,是改:playwright MCP 的截图调用自动重写输出路径到 .tmp/png/,不用等写入态规则去抓。' },
    en: { title: 'Playwright MCP screenshot redirect', desc: 'Not a block — a rewrite: playwright MCP screenshot calls have their output path silently redirected to .tmp/png/ before the write-time rule would even need to catch it.' },
  },
];
