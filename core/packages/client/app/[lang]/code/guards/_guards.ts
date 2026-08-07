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
  {
    id: 'comp-name-year',
    hook: 'block-comp-name-year-regex.ps1 → hook-detect-comp-year-regex.mjs',
    test: 'comp-year-single-source.test.ts',
    baseline: '0（3 份手抄 → 1 份）',
    zh: { title: '比赛名年号各剥各的', desc: '全站规则:比赛年份已经写在页面上(同行日期列 / 卡片日期 / 年份分组标题)时,比赛名里不再重复年号 —— 人物页成绩表原先是「夹江公开赛2026」压着「2026-07-25」(issue #65)。这条规则曾被三处各抄一份正则实现(CompCard、OngoingComps、CompDetailPage),口径互不相同还漏了人物页。现在唯一实现是 lib/comp-localize.ts 的 stripCompYear,调用点走 localizeCompName(…, { date }) 或 <CompCell date={…} />;CompCell 的 date 是必填(string | null),逼每个调用点表态 —— 页面没显示年份的地方(搜索下拉、无日期列的榜单)传 null 保留年号。再手搓「尾部四位年」正则直接红。' },
    en: { title: 'Comp-name year stripped ad hoc', desc: 'Site-wide rule: when the competition year is already on the page (same-row date column, card date, year group header), the comp name must not repeat it — the person page used to stack "夹江公开赛2026" right on top of "2026-07-25" (issue #65). The rule had three separate hand-written implementations (CompCard, OngoingComps, CompDetailPage), none of them agreeing and none covering the person page. The single implementation is now stripCompYear in lib/comp-localize.ts, reached via localizeCompName(…, { date }) or <CompCell date={…} />; CompCell’s date prop is required (string | null) so every call site takes a position — pass null where no year is shown (search dropdowns, tables without a date column) and the year stays. Hand-rolling a trailing-year regex turns CI red.' },
  },
  {
    id: 'recon-ground-truth',
    hook: 'recon-ground-truth-gate.ps1 → recon-ground-truth-gate.mjs',
    test: 'recon-ground-truth-gate.test.ts + recon_ground_truth.test.ts',
    baseline: '当前集合全量',
    zh: { title: '复盘 Ground Truth 未验证', desc: '管理员管理器是唯一手工入口，测试命令从公开导出生成供 Git 和 AI 审查的 JSON。Codex、Claude 命令 hook 与 Git pre-commit 三层拦截：提交复盘算法、陀螺仪、转体处理或 ground-truth 管道前，当前内容指纹必须对应一次全部 confirmed 样本测试通过记录；管理器新增样本并同步后，旧凭证立即失效。' },
    en: { title: 'Unverified reconstruction ground truth', desc: 'The admin manager is the only manual entry point; the test command generates the Git- and AI-reviewable JSON from its public export. Codex and Claude command hooks plus Git pre-commit require the exact current content fingerprint to have a successful run over every confirmed case before reconstruction logic, gyro, rotation handling or the ground-truth pipeline can be committed. Syncing a newly confirmed case immediately invalidates the old credential.' },
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
    id: 'results-url-null',
    test: 'wca-results-url-params.test.ts',
    zh: { title: 'URL 参数写 null 表示非默认值', desc: '/wca/results 有个 effect 把缺省的筛选参数补成派生值,而派生值不一定等于「写 null 想表达的意思」—— 实际踩过:「显示」toggle 的成绩态写成 show:null,派生规则却是缺省=选手,于是 toggle 点了立刻弹回、看着点不动。守卫从 effect 里现推受管键(show/type/country/gender/basis/year/month/q),禁止任何一个被写成 null,并锁死 update() 不做 `|| null` 折叠。' },
    en: { title: 'URL param set to null to mean a non-default', desc: '/wca/results has an effect that backfills missing filter params with their derived values — and the derived value isn’t necessarily what writing null was meant to express. Hit for real: the Show toggle wrote show:null for the Results state while the derivation defaults an absent param to Persons, so the toggle snapped straight back and looked dead. The guard re-derives the managed key set from the effect itself (show/type/country/gender/basis/year/month/q), forbids null for any of them, and pins update() against `|| null` collapsing.' },
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
    id: 'owner-key-not-wca-id',
    test: 'owner-key-not-wca-id.test.ts',
    zh: { title: '归属键当 WCA id 拼链接', desc: '站内「作者 / 贡献者 / 投稿者」字段存的是归属键 ownerKey:绑了 WCA 的账号是真 wca_id,没绑的是合成 `u<uid>`。拿它直接拼档案页 = 死链(issue #45:/recon 详情页把复盘者 u144 拼成 worldcubeassociation.org/persons/u144,WCA 官网 404;站内 /wca/persons/u144 同样查无此人)。出链判定收敛在两个入口 —— 站内走 PersonLink(非 WCA id 自动降级成纯文本),WCA 外链走 Discussion 的 AuthorName;谁再拿 authorId / addedById / reconerId 这类变量手搓 persons 链接直接红。' },
    en: { title: 'ownerKey used as a WCA id in links', desc: 'Author/contributor/submitter fields store the site-wide ownerKey: a real wca_id for WCA-linked accounts, a synthetic `u<uid>` otherwise. Formatting that straight into a profile URL yields a dead link (issue #45: the /recon detail page turned reconstructor u144 into worldcubeassociation.org/persons/u144, a 404 upstream — and /wca/persons/u144 is equally unknown here). Link decisions funnel through two entry points: PersonLink for internal links (non-WCA ids degrade to plain text) and Discussion’s AuthorName for the outbound WCA link; hand-rolling a persons URL from authorId / addedById / reconerId turns CI red.' },
  },
  {
    id: 'hash-nav-single-source',
    test: 'hash-nav-single-source.test.ts',
    zh: { title: 'hash 锚点滚动+高亮各写一份', desc: '「点某项 → URL 片段 → 滚到它并高亮」原本六处各手搓(/wiki 词条、person 两张成绩表、/alg 公式卡、/wca/prediction 项目段、论坛帖子),ByCompList/ByEventView 更是逐字复制。已抽成 useHashHighlight(差异点 resolve / reveal / linger / highlightClass / onScroll / deps 全作 options)。除该 hook 外任何文件再挂 hashchange 监听 = CI 红,指回 hook;OAuth 回调等另类用途走 ALLOWLIST + 理由。' },
    en: { title: 'Hand-rolled hash-anchor scroll+highlight', desc: '"Click a thing → URL fragment → scroll to it and highlight" was hand-rolled in six places (wiki entries, the two person result tables, alg cards, prediction event sections, forum posts) — ByCompList/ByEventView near-verbatim copies. Unified into useHashHighlight (differences are options: resolve / reveal / linger / highlightClass / onScroll / deps). Any file other than that hook adding a hashchange listener turns CI red and points back to it; genuinely different uses (OAuth callback, global infra) go through the ALLOWLIST with a reason.' },
  },
  {
    id: 'alg-thumb-corner-mask',
    test: 'alg-thumb-corner-mask.test.ts',
    zh: { title: '手搓顶层公式集缩略图遮罩', desc: '顶层公式集(COLL / CMLL,以及 ZBLL / 1LLL / OLLCP 那批同样用 coll 遮罩的二级选择卡)的图,视角 / 遮罩 / 侧环删灰(hideGreySides)一处定在 alg_thumb_plan 的 cubeThumbParams —— 列表、训练器选择面板、/recognize 题图、PDF 导出全从它取。谁再手写一个 <VisualCube view="pll" mask="coll">(训练器里真出现过一份),那张图就绕开删灰:同一个 case 列表里侧面干净、选择面板里却挂一圈灰格。alg_thumb_plan 之外写死 coll / cmll 遮罩 = CI 红;特例行内 allow-corner-mask 豁免。' },
    en: { title: 'Hand-rolled corner-LL thumbnail mask', desc: 'Last-layer sets (COLL / CMLL, plus the ZBLL / 1LLL / OLLCP second-level picker cards that use the same coll mask) get their view / mask / hidden grey rim (hideGreySides) from one place — cubeThumbParams in alg_thumb_plan — which the library list, the trainer picker, the /recognize prompts and the PDF export all read. Hand-rolling a `<VisualCube view="pll" mask="coll">` (one really did exist in the trainer) skips the grey-rim pass: the same case shows clean sides in the list and a ring of grey squares in the picker. A literal coll / cmll mask outside alg_thumb_plan turns CI red; exceptions take an inline allow-corner-mask.' },
  },
  {
    id: 'alg-thumb-render-plan',
    test: 'alg-thumb-render-plan.test.ts',
    zh: { title: '网页与 PDF 共用公式图渲染计划', desc: '公式库网页缩略图与 PDF 图统一先走 alg_thumb_plan:它一处决定拼图渲染器、视图、遮罩、SQ1 阶段与黑顶配色,CaseThumb 和 case_svg 只负责把同一个计划适配成 React 或 SVG。两个适配器里再次按 puzzle 分叉直接 CI 红;测试同时逐字比对 SQ1 各阶段的网页计划 SVG 与 PDF SVG。' },
    en: { title: 'Catalog and PDF share one case-image plan', desc: 'Catalog thumbnails and PDF images first go through alg_thumb_plan, the one place that chooses the puzzle renderer, view, mask, SQ1 stage and black-top scheme. CaseThumb and case_svg only adapt that same plan to React or SVG. Branching on puzzle again in either adapter turns CI red, while the test also byte-compares the planned and PDF SVG for every SQ1 stage.' },
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
    id: 'recon-open-prefetch',
    test: 'recon_open_prefetch.test.ts',
    zh: { title: '复盘打开路径:同一页 + 懒加载漂移', desc: '复盘报告必须渲染在成绩详情这一页上,不许退回「查看复盘」那第二次点击。同时守瀑布:整条链曾是三级串行的动态 import(1473ms),现在在详情挂载时并行预取 —— 复盘路径上任何 import() 出去的模块都必须在预取清单里,新加一个忘了预取直接红。' },
    en: { title: 'Reconstruction open path: same page + lazy-load drift', desc: 'The report must render on the solve detail page itself, never back behind a second «View reconstruction» click. It also guards the waterfall: the chain was once three serial dynamic imports (1473ms) and is now prefetched in parallel when the detail page mounts — every module the open path import()s must appear in the prefetch list, so adding one without prefetching it turns CI red.' },
  },
  {
    id: 'timer-solve-recap',
    test: 'timer_solve_recap.test.ts',
    zh: { title: '拧完那把的复盘 + 计时中的实时魔方', desc: '智能魔方停表后复盘就摊在计时页上(判据 shouldAutoRecap:只对录到动作流的成绩,开下一把即收起),报告仍是懒加载且魔方一连上就预取整条链。同一条还守住「计时中那颗实时魔方不被专注模式淡掉」——「隐藏全部界面」仍一票否决,以及那半屏不许把计时区挤出视口。' },
    en: { title: 'Post-solve reconstruction + the live cube while timing', desc: 'After a smart-cube solve the reconstruction opens right on the timer page (gated by shouldAutoRecap: turn-stream solves only, dismissed when the next solve starts), still lazily loaded with the whole chain prefetched as soon as a cube connects. The same file pins that the live cube is NOT faded out by distraction-free mode while timing (the explicit "hide all UI" setting still wins), and that the panel can never push the timing area out of the viewport.' },
  },
  {
    id: 'recon-report-layout',
    test: 'recon_report_layout.test.ts',
    zh: { title: '复盘报告的顺序 + 打乱只出现一次', desc: '报告先给回放和按步谱子(默认展开),质量分 / 分步分析表 / 四个总量整块排在后面 —— 不知道自己拧了什么之前,一张 5×7 的表读不出东西。打乱是谱子的第一行且用视角归一化后那条(和复制导出的逐字相同);智能魔方那把不再另摆一遍打乱和打乱图,手动计时的成绩照旧两样都有。' },
    en: { title: 'Reconstruction report order + the scramble appears once', desc: 'The report leads with the replay and the per-step move text (expanded by default); the quality score, step table and totals come after as one block — a 5×7 grid reads as nothing until you know what you turned. The scramble is the first line of that move text, in the normalized viewing frame (byte-identical to what the copy button exports); the smart-cube solve page no longer repeats the scramble or draws the scramble picture, while manually-timed solves keep both.' },
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
    id: 'page-metadata-coverage',
    test: 'page-metadata-coverage.test.ts',
    zh: { title: '路由缺页面标题', desc: '每个含 page.tsx 的路由必须在**自己目录**里有 metadata 来源(layout 调 pageMetadata、layout/page 自带 generateMetadata),祖先的不算;pageMetadata 的 key 必须真在 PAGE_META 里,PAGE_META 也不许留孤儿条目。漏配是静默的 —— 新页面会被 sitemap 自动扫进去(等于请爬虫来看),标题却不会自动有,当初全站 0 个 <title> 就是这么攒的。真拿不到 param 的哨兵壳走 ALLOWLIST(每条带理由)。' },
    en: { title: 'Route without a page title', desc: 'Every route with a page.tsx must declare metadata in its OWN directory (a layout calling pageMetadata, or generateMetadata in its layout/page) — inheriting from an ancestor does not count; a pageMetadata key must exist in PAGE_META, and PAGE_META may not keep orphan entries. Missing one fails silently: app/sitemap.ts auto-discovers the new route (inviting crawlers) while the title does not appear on its own — which is exactly how the site ended up with 0 titles site-wide. Sentinel shells that genuinely cannot see their param are exempted via an ALLOWLIST with reasons.' },
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
    id: 'one-credential-per-account',
    test: 'one_credential_per_account.test.ts',
    zh: { title: '一个账号只能绑一个邮箱 / 一个手机号', desc: '两条凭据同一套规矩,各铺三层:0078 / 0103 偏唯一索引(唯一真保证,挡并发)+ addIdentity 先行检查回 has-email / has-phone + 前端已有该凭据时不给绑定入口(改走「更换」)。重点守跨包字面量耦合 —— 服务端错误串和前端 authErrorText 的 includes() 靠同一句英文对上,改一边措辞前端就静默退化成把英文糊给用户。换绑那条出口也一并钉住:唯一的登录方式不许解绑,少了原地 UPDATE,只有手机号的账号就永远换不了号。' },
    en: { title: 'One email and one phone per account', desc: 'Both credentials follow the same rule, each enforced in three layers: the 0078 / 0103 partial unique indexes (the only real guarantee — they stop concurrent double-binds), an addIdentity pre-check returning has-email / has-phone, and the panel hiding the link entry once that credential exists (you use “Change” instead). Mainly guards a cross-package literal: the server error string and the client authErrorText includes() match on the same English sentence, so rewording one side silently degrades the UI into showing raw English. The change-in-place escape hatch is pinned too: your only login method cannot be unlinked, so without that in-place UPDATE an account holding just a phone number could never change it.' },
  },
  {
    id: 'wca-link-onboarding',
    test: 'wca_link_onboarding.test.ts',
    zh: { title: '注册后引导绑 WCA 只问新人', desc: '登录与注册合流后,只有服务端知道账号是不是刚建的 —— loginWithIdentity 回 isNew,四条合流的登录路(邮箱码 / 手机码 / Google / 国内三方)透传,前端只在 isNew && 还没绑 WCA 时插一步引导。两种坏法都不会有人报 bug:isNew 丢了 → 新人再也不被问;条件写成只看有没有绑 WCA → 老用户每次登录都被问一遍。另守两条:isNew 不进 365 天的 JWT(它只描述这一次请求),引导不给手填 WCA ID 的输入框(手填没有所有权证明,等于让人认领别人的成绩)。' },
    en: { title: 'WCA link onboarding asks new users only', desc: 'With sign-in and sign-up merged, only the server knows whether an account was just created — loginWithIdentity returns isNew, the four merged routes (email code / phone code / Google / Chinese socials) pass it through, and the client inserts the “do you have a WCA ID?” step only when isNew && not yet linked. Both failure modes are silent: lose isNew and new users stop being asked; key the check on hasWca alone and every unlinked returning user gets asked on every sign-in. Also guards two invariants: isNew never enters the 365-day JWT (it describes one request, not the session), and the prompt offers no free-text WCA ID field (typing one proves no ownership — it would let anyone claim someone else’s results).' },
  },
  {
    id: 'account-delete-coverage',
    test: 'account_delete.test.ts',
    zh: { title: '注销账号删干净', desc: '用户数据按归属键散在二十多张表里,彼此没有外键串起来 —— 漏一张,用户以为删干净了其实没有。守卫双向钉:两张清单(私有数据硬删 / 公开内容换墓碑键 deleted:<uid>)里的每个 (表, 列) 必须真实存在;反过来,schema 里**每张**带归属列的表都得表过态 —— 进清单,或进写明理由的豁免名单,新建一张带 wca_id 的表就会在这里红。另守三条:墓碑键塞得进最窄的 VARCHAR(20)(超了注销时事务直接抛)、注销不认 amr=email_code 的 grant(那口子是给重设密码开的,不给不可逆操作放行)、公开内容匿名化时姓名快照跟着清空(只换 id 不清名字等于没匿名)。' },
    en: { title: 'Account deletion actually deletes', desc: 'User data lives under the ownerKey across two dozen tables with no foreign keys tying them together — miss one and the user believes they are gone when they are not. The guard is bidirectional: every (table, column) in the two manifests (purge private data / swap public content to the tombstone key deleted:<uid>) must exist in the schema, and conversely every table in the schema carrying an owner column must have taken a position — in a manifest, or in an exemption list with a written reason, so adding a new wca_id table turns this red. It also pins three invariants: the tombstone key fits the narrowest VARCHAR(20) column (overflow would abort the deletion transaction), deletion does not honour the amr=email_code grant (that door exists for password resets, not for irreversible actions), and anonymizing clears the name snapshot alongside the id (swapping only the id anonymizes nothing).' },
  },
  {
    id: 'video-bitrate-sync',
    test: 'video-bitrate-sync.test.ts',
    zh: { title: '视频码率两处一致', desc: '视频通话的单路码率有两个副本:服务端 video_rooms.ts 的 PER_STREAM_MBPS 用来守带宽预算,客户端 video-room-api.ts 的 VIDEO_MAX_BITRATE 用来真发流,分属两个包谁也不 import 谁。分叉后失败是静默的 —— 客户端偏大则服务端低估占用、放进来的房间推爆实例峰值(全体卡顿而监控显示预算未满);客户端偏小则服务端高估、明明有带宽却回「视频带宽已满」。顺带钉住第三处:共用的 LIVEKIT_ROOM_OPTIONS(components/video/video-call.ts,/timer 对战房与 /meet 会议室同一份)的 videoEncoding 必须引用那个常量而不是就地写数字(写死了改常量不生效)。' },
    en: { title: 'Video bitrate agrees on both sides', desc: 'The per-stream bitrate for video calls exists twice: PER_STREAM_MBPS in the server’s video_rooms.ts guards the bandwidth budget, VIDEO_MAX_BITRATE in the client’s video-room-api.ts is what actually gets published — different packages, neither imports the other. Divergence fails silently: too high on the client and the server under-counts, admitting rooms that blow past the instance’s peak bandwidth (everyone stutters while the budget looks unused); too low and the server over-counts, refusing tokens with “video capacity full” while the server sits idle. It also pins a third site: videoEncoding in the shared LIVEKIT_ROOM_OPTIONS (components/video/video-call.ts, one copy for both the /timer battle room and /meet) must reference the constant rather than an inline number, since a hardcoded value makes changing the constant a no-op.' },
  },
  {
    id: 'meet-code-format',
    test: 'meet-code-format.test.ts',
    zh: { title: '会议码两处同一张表', desc: '/meet 会议室要登录才能用,但**进哪一间没有在册名单可查** —— 登录只决定「谁能用这个功能」,任何登录用户拿到码就能进那一间,所以 9 位 45 bit 的熵是房间层面唯一的防线。码由客户端生成、服务端用另写的一条正则校验,两边各持一份字符表(去掉了 0/1/I/O)。分叉的失败很怪:客户端多一个服务端不认的字符,平均每 9/32 次「新建会议」就撞一次 400,用户只觉得「有时候能建有时候不能」;客户端少字符则白白丢熵而毫无症状。守卫从服务端源码里抠出那条正则重建,逐字符对表,并钉住码长与熵下限。另守 normalizeMeetCode 的粘贴路径:整条邀请链接要从 ?room= 里挖,而**没有** room= 的链接必须判空 —— 硬过滤会把 "https://cuberoot.me/" 拼成 HTTPSCUBE 这个合法码,静默把人送进陌生人的房间。' },
    en: { title: 'Meeting codes share one alphabet', desc: 'A /meet room requires you to be signed in, but *which* room you land in has no roster behind it — being signed in gates the feature, not the room, so any signed-in holder of the code gets in and the 45 bits in a 9-character code are the only defence at the room level. The client generates codes and the server validates them with a separately-written regex, each holding its own copy of the alphabet (0/1/I/O removed). Divergence fails strangely: one extra character on the client and roughly 9-in-32 "new meeting" clicks hit a 400, which reads as "it works sometimes"; one missing character silently throws away entropy with no symptom at all. The guard rebuilds the server’s regex from its source and checks it character by character, and pins both the length and a floor on entropy. It also covers the paste path in normalizeMeetCode: a full invite link must be read from ?room=, and a link *without* room= must yield nothing — filtering it for legal characters turns "https://cuberoot.me/" into HTTPSCUBE, a perfectly valid code that would drop someone into a stranger’s room.' },
  },
  {
    id: 'meet-prejoin-join-button',
    test: 'meet-prejoin-join-button.test.ts',
    zh: { title: '进会议的按钮不能被自家 CSS 藏掉', desc: '/meet 入会前那一屏用的是 @livekit/components-react 的 PreJoin,而它把「进入会议」这个 submit 按钮和用户名输入框放在**同一个 <form> 里**。meet.css 想藏掉输入框(名字取自账号,改了不算数),写成了藏这个 form —— 于是按钮跟着一起没了。后果不是难看:join() 全站只有 PreJoin 的 onSubmit 一个调用方,按钮没了等于任何人在任何设备上都进不了会议,而 typecheck / eslint / vitest / knip 全绿,功能照常「部署成功」,只有真去点一次才发现。守卫从库的产物里认出按钮的父容器类名,再扫 meet.css 里所有 display:none 的选择器,落在祖先链任何一环上就红;库升级换了结构也会一起红。' },
    en: { title: 'Our CSS must not hide the button that enters a meeting', desc: '/meet’s pre-join screen is @livekit/components-react’s PreJoin, which puts the “Join” submit button and the username input inside the *same* <form>. meet.css meant to hide the input (the display name comes from the account, so editing it changes nothing) but targeted that form instead — taking the button with it. The consequence is not cosmetic: join() has exactly one caller, PreJoin’s onSubmit, so with no button nobody can enter a meeting on any device, while typecheck, eslint, vitest and knip all stay green and the feature still “deploys fine”. Only clicking it once reveals anything. The guard reads the button’s parent container class out of the library’s shipped bundle, then scans every display:none selector in meet.css and fails if one lands on any link of that ancestor chain — so a library restructure trips it too.' },
  },
  {
    id: 'meet-production-guards',
    test: 'meet-production-guards.test.ts',
    zh: { title: '会议上线的四条硬约束', desc: '/meet 的人数硬上限必须随 token 在首个参与者真正连接时原子建房,不能让只请求 token 的人批量停放零带宽空房;手机聊天和参与者面板必须相对 visualViewport 已缩小的会议台定位,不能被软键盘、全局通知条或安全区盖住;侧栏打开后控制条要提前切成图标档;连接、重连和断开提示必须全部走中英双语。四处跨越服务端、第三方组件 DOM 和响应式 CSS,任何一处退化都能在 typecheck 全绿时直接破坏线上使用。' },
    en: { title: 'Four hard constraints for production meetings', desc: '/meet must carry its hard participant cap in the token and create a room atomically only when the first participant really connects, rather than letting token-only requests park zero-bandwidth rooms; mobile chat and roster panels must be positioned against the visual-viewport-sized meeting stage so the keyboard, notice bar and safe area cannot cover them; opening a side panel must move the control bar to icon-only mode earlier; and connecting, reconnecting and disconnected states must all use the bilingual UI. These invariants cross the server, third-party component DOM and responsive CSS, so each can break production while typecheck remains green.' },
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
