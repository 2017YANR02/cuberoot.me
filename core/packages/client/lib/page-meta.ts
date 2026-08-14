import type { Metadata } from 'next';

// Per-route <title> and <meta name="description"> for the whole site.
//
// WHY THIS EXISTS: 180 of the 228 pages are 'use client', and a client component
// cannot export `metadata`. So every page set its tab title from the
// useDocumentTitle hook — after hydration, in the browser. The server HTML that
// crawlers, link unfurlers and AI assistants actually read carried NO <title> at
// all (measured: 0 of 202 sitemap URLs) and one identical site-wide description.
//
// The fix does not require splitting any page into server + client halves. A
// route's layout.tsx may be a server component even when its page.tsx is
// 'use client', and metadata declared in the layout applies to the page beneath
// it. So each route gets a three-line layout.tsx that calls pageMetadata('<route>')
// and renders children unchanged.
//
// The zh/en strings below were seeded from the existing useDocumentTitle calls;
// subpage browser titles use these page names without repeating the site brand.
// Adding a route: add an entry here, then create the layout.tsx (see any
// existing one). A route with no entry simply inherits the site-wide defaults,
// which is the old behaviour — never a crash.
//
// Language comes from the [lang] route param, NOT from the i18n singleton:
// tr()/useT() are client-only, and reading headers() here would opt the whole
// site out of static rendering.

export interface Msg { zh: string; en: string; }
export interface PageMetaEntry {
  title: Msg;
  /** Omit to inherit the site-wide description from app/layout.tsx. */
  description?: Msg;
}

const BRAND = 'CubeRoot';
const SEP = ' — ';
// Re-included on every openGraph object below: Next REPLACES the parent
// openGraph per segment rather than deep-merging, so a page that sets its own
// og:title without an image would lose the share thumbnail and unfurl as plain
// text (notably on WeChat).
const SHARE_IMAGE = '/icons/CubeRoot.png';

export const PAGE_META: Record<string, PageMetaEntry> = {
  // The landing page is the only browser tab that keeps the site name.
  '': {
    title: {
      zh: 'CubeRoot',
      en: 'CubeRoot',
    },
    description: {
      zh: '魔方工具站:求解器、复盘、公式训练、打乱分析与 WCA 统计,中英双语,全部免费。',
      en: 'A speedcubing toolkit: puzzle solvers, solve reconstructions, algorithm trainers, scramble analysis and WCA statistics. Free, bilingual, no account needed.',
    },
  },
  '2x2x2': {
    title: { zh: '二阶实战解法查找器', en: '2×2 Practical Solution Finder' },
    description: {
      zh: '为任意二阶打乱搜索 CLL、EG、TCLL 与 LS 实战解法，比较底色、建面深度并按手感排序。',
      en: 'Find practical CLL, EG, TCLL, and LS solutions for any 2×2 scramble, with bottom-color and build-depth filters plus ergonomic ranking.',
    },
  },
  'about': {
    title: { zh: '关于', en: 'About' },
    description: {
      zh: '关于 CubeRoot:这个站是什么、由谁维护、数据从哪来。',
      en: 'About CubeRoot — what this site is, who maintains it, and where the data comes from.',
    },
  },
  'account': { title: { zh: '账号', en: 'Account' } },
  'privacy': {
    title: { zh: '移动端隐私政策', en: 'Mobile Privacy Policy' },
    description: {
      zh: 'CubeRoot Android 与 iOS App 的数据处理、备份、删除与联系说明。',
      en: 'How the CubeRoot Android and iOS apps handle local timer data, backups, deletion, and support requests.',
    },
  },
  // 'alg' 没有条目:/alg 不再是页面(next.config 直接 redirect 到 /alg/3x3),
  // 每个魔方页的标题由 alg/[puzzle]/layout.tsx 的 generateMetadata 逐个发。
  'alg-trainers': { title: { zh: '公式训练器', en: 'Alg Trainers' } },
  'alg/3bld': { title: { zh: '盲拧训练', en: '3BLD Trainer' } },
  'alg/3bld/2c2c': { title: { zh: '双角双角训练', en: '2-Corner / 2-Corner Trainer' } },
  'alg/3bld/2e2e': { title: { zh: '双棱双棱训练', en: '2-Edge / 2-Edge Trainer' } },
  'alg/3bld/lookup': {
    title: { zh: '盲拧公式查询', en: 'BLD Algorithm Lookup' },
    description: {
      zh: '查盲拧公式:三阶的棱角三循环、奇偶、翻角、翻棱、奇偶带翻,以及高阶的翼棱、角心、边心、中棱。每个 case 列出常用写法、换位子、起手与使用者,可左右镜像。',
      en: 'Look up BLD algorithms — 3BLD edge/corner 3-cycles, parity, corner twists, edge flips and LTCT, plus big-cube wings, X-centers, T-centers and midges. Every common writing of each case, with its commutator, thumb position and who uses it. Mirrors left/right.',
    },
  },
  'alg/3bld/tables': {
    title: { zh: '盲拧速查表', en: 'BLD Cheat Sheets' },
    description: {
      zh: '整表背用的盲拧速查表:全缓冲角块与棱块每个 case 一条推荐解,外加双棱双棱、多角翻、多棱翻、奇偶带翻、五循环等成组的表。',
      en: 'BLD cheat sheets for learning whole sets: one recommended algorithm per case for corners and edges from every buffer, plus the grouped 2e2e, multi-twist, multi-flip, LTCT and 5-style tables.',
    },
  },
  'alg/3bld/sheets': {
    title: { zh: '盲拧公式表名录', en: 'BLD Algorithm Sheets' },
    description: {
      zh: '盲拧选手公开的公式表汇总,带 WCA ID 与三盲 / 四盲单次成绩,可按成绩排序。',
      en: 'A directory of public BLD algorithm sheets by their authors, with WCA IDs and 3BLD / 4BLD singles, sortable by result.',
    },
  },
  'alg/3bld/comm': { title: { zh: '3BLD 公式库', en: '3BLD Commutator Library' } },
  'alg/3bld/corner': { title: { zh: '角块公式训练', en: 'Corner Algorithm Trainer' } },
  'alg/3bld/corner-float': { title: { zh: '角块浮动训练', en: 'Corner Float Trainer' } },
  'alg/3bld/edge': { title: { zh: '棱块公式训练', en: 'Edge Algorithm Trainer' } },
  'alg/3bld/edge-float': { title: { zh: '棱块浮动训练', en: 'Edge Float Trainer' } },
  'alg/3bld/flip': { title: { zh: '翻棱公式训练', en: 'Edge Flip Trainer' } },
  'alg/3bld/helper': { title: { zh: '读码还原助手', en: 'Read & Restore Helper' } },
  'alg/3bld/ltct': { title: { zh: '奇偶带翻训练', en: 'LTCT Parity-Twist Trainer' } },
  'alg/3bld/memo': { title: { zh: '盲拧记忆回想训练', en: '3BLD Memo Recall Trainer' } },
  'alg/3bld/parity': { title: { zh: '奇偶训练', en: 'Parity Trainer' } },
  'alg/3bld/readme': { title: { zh: '盲拧训练说明', en: '3BLD Guide' } },
  'alg/3bld/resources': { title: { zh: '盲拧资源', en: '3BLD Resources' } },
  'alg/3bld/timer': { title: { zh: '盲拧练习计时', en: 'BLD Practice Timer' } },
  'alg/3bld/twist': { title: { zh: '翻角公式训练', en: 'Corner Twist Trainer' } },
  'alg/commutator': { title: { zh: '换位子', en: 'Commutator' } },
  'alg/time-attack': {
    title: { zh: '公式连拧', en: 'Algorithm Time Attack' },
    description: {
      zh: '按自定义顺序连续练习公式库中的各种项目与公式集，只显示魔方图，支持分组练习与登录同步。',
      en: 'Drill every supported puzzle and algorithm set continuously in a custom order using diagrams only, with subset practice and signed-in sync.',
    },
  },
  'alg/3x3/notation': {
    title: { zh: '三阶中文转动记号', en: 'Chinese 3×3 Move Notation' },
    description: {
      zh: '三阶魔方傻瓜和紧凑中文转动记号速查，可直接切换并播放每种转动的模拟动画。',
      en: 'A visual guide to foolproof and compact Chinese 3×3 move notation, with an inline animated simulator for every move.',
    },
  },
  'alg/lsll': { title: { zh: 'LSLL 公式集', en: 'LSLL Algorithms' } },
  'alg/lsll/case': { title: { zh: 'LSLL 情况详情', en: 'LSLL Case Detail' } },
  'alg/lsll/route': { title: { zh: 'LSLL 路线详情', en: 'LSLL Route Detail' } },
  'alg/progress': { title: { zh: '学习进度', en: 'Progress' } },
  'alg/progress/cases': { title: { zh: '公式清单', en: 'Algorithm List' } },
  'alg/3x3/zbll/simple': {
    title: { zh: '简单 ZBLL', en: 'Simple ZBLL' },
    description: {
      zh: '适合开始学习的 ZBLL 情况:收录最优 HTM 不超过 10 步，以及四面合计至少有 4 组相邻同色、容易观察的情况。',
      en: 'An approachable ZBLL subset: cases with optimal HTM at most 10, plus visually clear cases with at least four adjacent same-colour pairs.',
    },
  },
  'alg/roux': { title: { zh: '桥式训练器', en: 'Roux Trainer' } },
  'alg/skewb-trainer': { title: { zh: 'Skewb 技巧训练', en: 'Skewb Skills' } },
  'algTrainer': { title: { zh: '公式训练器', en: 'Alg Trainer' } },
  'appearance': { title: { zh: '配色主题', en: 'Color Themes' } },
  'blddb': {
    title: { zh: 'BLDDB 盲拧公式库', en: 'BLDDB' },
    description: {
      zh: 'BLDDB 盲拧公式库:三阶角块 / 棱块全缓冲区三循环,翻色扭角,以及高阶盲拧的翼棱与中心块公式。',
      en: 'BLDDB — blindfolded algorithm database: 3-style corners and edges for every buffer, twists and flips, plus wings and centers for big BLD.',
    },
  },
  'calc': {
    title: { zh: '成绩计算器', en: 'Score Calculator' },
    description: {
      zh: '成绩计算器:模拟比赛轮次,估算平均与晋级概率。',
      en: 'Score calculator — simulate competition rounds and estimate averages and advancement odds.',
    },
  },
  'calc-about': { title: { zh: '成绩计算器说明', en: 'Score Calculator Guide' } },
  'calendar': {
    title: { zh: '日历', en: 'Calendar' },
    description: {
      zh: '个人日历:月周日视图、重复日程、提醒与参与者,支持按时区安排,并可生成只显示忙碌时段的公开链接。',
      en: 'A personal calendar with month, week and day views, recurring events, reminders and guests — time-zone aware, with an optional public link that can show busy times only.',
    },
  },
  'code': {
    title: { zh: '本站是怎么造的', en: 'How This Site Is Built' },
    description: {
      zh: '这个站是怎么造的:架构、求解器栈、分析器背后的算法,以及用到的语言与工具。',
      en: 'How this site is built — architecture, the solver stack, the algorithms behind the analyzers, and the languages and tools used.',
    },
  },
  'code/algorithms': { title: { zh: '算法导览', en: 'Algorithms' } },
  'code/algorithms/cfop-std-solver': { title: { zh: 'CFOP 多阶段求解器', en: 'CFOP multi-stage solver' } },
  'code/algorithms/gan-ble': { title: { zh: 'GAN 蓝牙协议与 AES 解密', en: 'GAN BLE protocol & AES' } },
  'code/algorithms/ida-star': { title: { zh: 'IDA* + 剪枝表', en: 'IDA* + prune tables' } },
  'code/algorithms/kociemba': { title: { zh: 'Kociemba 二阶段', en: 'Kociemba two-phase' } },
  'code/algorithms/min2phase': { title: { zh: 'min2phase', en: 'min2phase' } },
  'code/algorithms/webcodecs': { title: { zh: 'WebCodecs 帧精确解码', en: 'WebCodecs frame-accurate decoding' } },
  'code/api': { title: { zh: 'API 端点目录', en: 'API reference' } },
  'code/architecture': { title: { zh: '站点架构', en: 'Site Architecture' } },
  'code/architecture/decisions': { title: { zh: '技术决策', en: 'Technical Decisions' } },
  'code/architecture/flow': { title: { zh: '请求流程', en: 'Request Flow' } },
  'code/architecture/history': { title: { zh: '历程', en: 'History' } },
  'code/components': { title: { zh: '组件库', en: 'Components' } },
  'code/cubingchina': { title: { zh: '粗饼网 CubingChina : 中国 WCA 赛事平台 — Yii 1.1 上的报名 / 直播 / 成绩镜像', en: 'CubingChina : China\'s WCA competition platform — registration, live results and a WCA mirror on Yii 1.1' } },
  'code/dead-code': { title: { zh: '死代码守卫', en: 'Dead Code Guard' } },
  'code/fonts': { title: { zh: '字体', en: 'Fonts' } },
  'code/guards': { title: { zh: '约束守卫', en: 'Guards' } },
  'code/language': { title: { zh: '编程', en: 'Code' } },
  'code/language/bash': { title: { zh: 'Bash : 1989 Brian Fox · 装在每台机器上 · DevOps 默认胶水', en: 'Bash : 1989 Brian Fox · pre-installed everywhere · the DevOps default' } },
  'code/language/c': { title: { zh: 'C : 看不见的母语 — 53 年仍跑在一切之下', en: 'C : The Invisible Mother Tongue — 53 Years and Still Underneath It All' } },
  'code/language/compare': { title: { zh: '17 种语言, 一个 Ao5', en: 'One Ao5, Seventeen Languages' } },
  'code/language/cpp': { title: { zh: 'C++ : Systems — 46 年仍是性能之王', en: 'C++ : Systems — 46 Years and Still the King of Performance' } },
  'code/language/csharp': { title: { zh: 'C# : Hejlsberg 的第三门语言, .NET 的灵魂 — 26 年长青', en: 'C# : Hejlsberg\'s third language, soul of .NET — 26 years and counting' } },
  'code/language/css': { title: { zh: 'CSS : 30 年声明式样式语言 — 1994 CERN 提案到 2026 平台追上来', en: 'CSS : 30 years of declarative styling — from CERN 1994 to \'the platform caught up\'' } },
  'code/language/go': { title: { zh: 'Go — 简洁与并发', en: 'Go — Simplicity Meets Concurrency' } },
  'code/language/haskell': { title: { zh: 'Haskell : 纯函数 · 惰性 · 类型类 — 影响所有人, 自己不必爆款', en: 'Haskell : pure, lazy, type-classed — the language that quietly shaped everyone else' } },
  'code/language/html': { title: { zh: 'HTML : 不是编程语言, 但每个 UI 都从这里开始 — 1989→2026', en: 'HTML : not a programming language, but every UI starts here — 1989→2026' } },
  'code/language/java': { title: { zh: 'Java : Write Once, Run Anywhere — 30 年仍在 Top 3 的 JVM 故事', en: 'Java : Write Once, Run Anywhere — 30 years on, still top 3 on the JVM' } },
  'code/language/javascript': { title: { zh: 'JavaScript : TheLanguageOfTheWeb — 30 年的网页语言', en: 'JavaScript : TheLanguageOfTheWeb — Thirty Years of the Web' } },
  'code/language/katex': { title: { zh: 'KaTeX : 浏览器里 100× 速度的 LaTeX 数学渲染 — 2013→2026', en: 'KaTeX : LaTeX math in the browser at 100× MathJax speed — 2013→2026' } },
  'code/language/kotlin': { title: { zh: 'Kotlin : Better Java — 从 Android 一等公民到 Multiplatform 时代', en: 'Kotlin : Better Java — from Android first-class to the Multiplatform era' } },
  'code/language/latex': { title: { zh: 'LaTeX : 数学排版的事实标准 — 1978→2026', en: 'LaTeX : the de-facto standard for typesetting math — 1978→2026' } },
  'code/language/lua': { title: { zh: 'Lua : 200KB 嵌入式脚本 · 30 年活在所有东西里面', en: 'Lua : the 200KB embedded script that lives inside everything' } },
  'code/language/mojo': { title: { zh: 'Mojo : Python 语法 · C 速度 · MLIR IR — Lattner 的第三门语言', en: 'Mojo : Python syntax, C-class speed, MLIR IR — Lattner\'s third language' } },
  'code/language/php': { title: { zh: 'PHP : 仍跑着 75% 的网络 — Lerdorf 的简历计数器走过 30 年', en: 'PHP : still running 75% of the web — Lerdorf\'s resume counter, 30 years on' } },
  'code/language/powershell': { title: { zh: 'PowerShell : 2006 Jeffrey Snover · 对象管道 · Windows 自动化默认', en: 'PowerShell : 2006 Jeffrey Snover · object pipeline · Windows automation default' } },
  'code/language/python': { title: { zh: 'Python — AI 时代的胶水语言', en: 'Python — Glue of the AI Era' } },
  'code/language/ruby': { title: { zh: 'Ruby : 程序员幸福为本 · Matz / DHH / Shopify 的三十年', en: 'Ruby : Optimised for programmer happiness — three decades of Matz, DHH and Shopify' } },
  'code/language/rust': { title: { zh: 'Rust — 系统编程的现代答卷', en: 'Rust — A Modern Answer to Systems Programming' } },
  'code/language/scramble': { title: { zh: '17 种语言, 一个打乱解析器', en: 'One scramble parser, seventeen languages' } },
  'code/language/sql': { title: { zh: 'SQL : 56 年的声明式查询语言 — 数据层的默认语', en: 'SQL : 56 years of declarative query — the data layer\'s default' } },
  'code/language/swift': { title: { zh: 'Swift : 苹果生态的钦定语言', en: 'Swift : Apple Ecosystem’s Native Tongue' } },
  'code/language/ts': { title: { zh: 'TypeScript : JavaScript — AI 时代的事实标准', en: 'TypeScript : JavaScript — De Facto Language of the AI Era' } },
  'code/language/wasm': { title: { zh: 'WebAssembly — Web 的通用字节码', en: 'WebAssembly — A Universal Bytecode for the Web' } },
  'code/language/zig': { title: { zh: 'Zig : C — 给系统编程换个零隐藏的地基', en: 'Zig : C — A No-Hidden-Control-Flow Foundation for Systems' } },
  'code/llm': { title: { zh: '大模型', en: 'Large Language Models' } },
  'code/llm/fable': { title: { zh: 'Claude Fable 5', en: 'Claude Fable 5' } },
  'code/llm/sonnet-5': { title: { zh: 'Claude Sonnet 5', en: 'Claude Sonnet 5' } },
  'code/ops': { title: { zh: '运维', en: 'Ops' } },
  'code/schema': { title: { zh: '数据库 Schema', en: 'Database schema' } },
  'code/solvers': { title: { zh: '求解器', en: 'Solvers' } },
  'code/stack': { title: { zh: '技术栈', en: 'Stack' } },
  'code/tokens': { title: { zh: '设计令牌', en: 'Design Tokens' } },
  'code/utils': { title: { zh: '速查', en: 'Hooks & Utils' } },
  'code/wca-export': { title: { zh: 'WST 数据导出', en: 'WST Export' } },
  'code/wca-rest-api': { title: { zh: 'WCA REST API', en: 'WCA REST API' } },
  'code/wca-site': { title: { zh: 'WorldCubeAssociation.org : WCA 官网源码 — 2008 年起的 Rails 单体, 正迁往 Next.js', en: 'WorldCubeAssociation.org : the WCA\'s codebase — a Rails monolith since 2008, migrating to Next.js' } },
  'code/wcif': { title: { zh: 'WCIF', en: 'WCIF' } },
  'cross_trainer': { title: { zh: '十字训练', en: 'Cross Trainer' } },
  'cstimer': { title: { zh: 'csTimer', en: 'csTimer' } },
  'contests': {
    title: { zh: '比赛系统', en: 'Contests' },
    description: {
      zh: '创建比赛、管理项目与选手、录入现场成绩,并自动生成排名和纪录。',
      en: 'Create competitions, manage events and competitors, enter live results, and generate rankings and records.',
    },
  },
  'documentation': { title: { zh: '文档', en: 'Documentation' } },
  'docs': {
    title: { zh: '协作文档', en: 'Collaborative Docs' },
    description: { zh: '多人实时编辑、自动保存并按成员授权的在线文档。', en: 'Real-time collaborative documents with autosave and member permissions.' },
  },
  'docs/edit': { title: { zh: '编辑协作文档', en: 'Edit Collaborative Document' } },
  'sheets': {
    title: { zh: '协作表格', en: 'Collaborative Spreadsheets' },
    description: { zh: '实时共同编辑表格,支持公式、多人协作和 Excel 导入导出。', en: 'Edit spreadsheets together with formulas, live collaboration, and Excel import and export.' },
  },
  'sheets/edit': { title: { zh: '编辑协作表格', en: 'Edit Collaborative Spreadsheet' } },
  'eocross_trainer': { title: { zh: 'EO 十字训练', en: 'EOCross Trainer' } },
  'feedback': { title: { zh: '我的反馈', en: 'My feedback' } },
  'feedback/admin': { title: { zh: '反馈审核', en: 'Feedback' } },
  'forum': {
    title: { zh: '论坛', en: 'Forum' },
    description: {
      zh: '速拧论坛:提问、讨论、分享。',
      en: 'Speedcubing forum — ask, discuss, share.',
    },
  },
  'forum/new': { title: { zh: '发帖', en: 'New thread' } },
  'forum/review': { title: { zh: '论坛审核', en: 'Forum moderation' } },
  'forum/search': { title: { zh: '论坛搜索', en: 'Forum search' } },
  'frame-count': {
    title: { zh: '数帧', en: 'Frame Count' },
    description: {
      zh: '逐帧计时:从视频精确数帧,得出比裁判计时更细的用时。',
      en: 'Frame counting — measure solve times from video frame by frame, finer than a stackmat reading.',
    },
  },
  'frame-count-about': { title: { zh: '数帧工具说明', en: 'Frame Count Guide' } },
  'icon': { title: { zh: '图标', en: 'Icons' } },
  'math': {
    title: { zh: '魔方数学', en: 'Cubing Mathematics' },
    description: {
      zh: '魔方背后的数学:群论、上帝之数、概率分布与状态计数。',
      en: 'The mathematics behind twisty puzzles: group theory, God’s number, probability and state counting.',
    },
  },
  'math/demigod': { title: { zh: '半神之数 (Demigod\'s Number)', en: 'Demigod\'s Number' } },
  'math/god': {
    title: { zh: '上帝之数', en: 'God\'s Number' },
    description: {
      zh: '上帝之数:魔方群在半转与四分之一转度量下的直径,20 与 26 是怎么证出来的,以及其它 WCA 项目的对应结果。',
      en: 'God\'s Number — the diameter of the cube group in the half-turn and quarter-turn metrics, how the values 20 and 26 were proved, and the equivalent results for other WCA puzzles.',
    },
  },
  'math/group': {
    title: { zh: '群论', en: 'Group Theory' },
    description: {
      zh: '用魔方讲群论:从置换、陪集、Lagrange 定理一路到 Sylow 定理、Burnside 计数与特征标表,60 多节,每节配可交互图示。',
      en: 'Group theory taught through the Rubik\'s Cube — permutations, cosets and Lagrange, on through Sylow, Burnside counting, character tables and Cayley graphs. 60+ sections, each with interactive diagrams.',
    },
  },
  'math/kernel': { title: { zh: '群论内核', en: 'Group-theory kernel' } },
  'math/lsll': { title: { zh: 'LSLL 情况计数', en: 'Counting LSLL cases' } },
  'math/probability': {
    title: { zh: '情况概率与旋转对称', en: 'Case Probability & Symmetry' },
    description: {
      zh: '速拧概率:各种 skip 的机率、情况分布,以及这些数字背后的组合计算。',
      en: 'Speedcubing probability — skip chances, case distributions, and the combinatorics that produce them.',
    },
  },
  'math/unit-distance': { title: { zh: '单位距离问题', en: 'Unit Distance Problem' } },
  'meet': {
    title: { zh: '会议', en: 'Meeting' },
    // 不写人数:上限是服务端 MAX_MEET_PARTICIPANTS,静态 metadata 读不到 /video/config,
    // 抄一份进来就是第三处副本 —— 改了上限,页面正文跟着变而搜索结果和分享卡片还在承诺旧数字。
    description: {
      zh: '多人视频会议:建一场会,把链接发出去,1080p 画质,支持屏幕共享和文字聊天。',
      en: 'Group video meeting — start a room, share the link, 1080p with screen sharing and chat.',
    },
  },
  'membership': { title: { zh: '会员', en: 'Membership' } },
  'memo': { title: { zh: '盲拧记忆训练', en: 'Memory Training' } },
  'memo/colpi': { title: { zh: 'COLPI 编码', en: 'COLPI Lettering' } },
  'mosaic': {
    title: { zh: '马赛克', en: 'Mosaic' },
    description: {
      zh: '魔方马赛克生成器:把图片转成用魔方拼出的图案。',
      en: 'Mosaic builder — turn any image into a pattern built from cube faces.',
    },
  },
  'mosaic-about': { title: { zh: '魔方马赛克说明', en: 'Mosaic Guide' } },
  'nemesizer': { title: { zh: '宿敌', en: 'Nemesizer' } },
  'nemesizer-about': { title: { zh: 'Nemesizer 说明', en: 'Nemesizer Guide' } },
  'notifications': { title: { zh: '消息', en: 'Notifications' } },
  'paint': {
    title: { zh: '魔方图示绘制', en: 'Cube Diagram Editor' },
    description: {
      zh: '矢量画板:画魔方图示,可导出 SVG。',
      en: 'Vector editor for drawing cube diagrams, exportable as SVG.',
    },
  },
  'pairing_trainer': { title: { zh: '配对训练', en: 'Pairing Trainer' } },
  'predict': {
    title: { zh: '预判训练', en: 'Lookahead Challenge' },
    description: {
      zh: '预判训练:在打乱上练习提前看到下一步。',
      en: 'Lookahead trainer — practise seeing the next step before you finish the current one.',
    },
  },
  'quiz': {
    title: { zh: '魔方知识问答', en: 'Cubing Quiz' },
    description: {
      zh: '魔方知识问答:历史、WCA 规则、项目赛制、记号术语、解法、数学与装备,八类共百余道选择题和问答题,答完即给解析。',
      en: 'A cubing quiz — history, WCA regulations, events, notation, methods, maths and gear. Over a hundred multiple-choice and short-answer questions, each with an explanation.',
    },
  },
  'quiz/new': { title: { zh: '出一道题', en: 'Write a Quiz Question' } },
  'quiz/mine': { title: { zh: '我出的题', en: 'My Quiz Questions' } },
  'quiz/manage': { title: { zh: '社区题管理', en: 'Community Questions' } },
  'pseudo_pairing_trainer': { title: { zh: '伪配对训练', en: 'Pseudo Pairing Trainer' } },
  'pseudo_xcross_trainer': { title: { zh: '伪 XCross 训练', en: 'Pseudo XCross Trainer' } },
  'recon': {
    title: { zh: '复盘', en: 'Reconstructions' },
    description: {
      zh: '比赛复盘库:逐步还原选手的比赛解法,含打乱、解法、分步用时与方法拆解。',
      en: 'Solve reconstructions — competition solves rebuilt move by move, with scramble, solution, per-step timing and method breakdown.',
    },
  },
  'recon-about': { title: { zh: '复盘库说明', en: 'Recon Library Guide' } },
  'recon/submit': { title: { zh: '提交复盘', en: 'Submit Reconstruction' } },
  'recon/ground-truth': { title: { zh: '复盘测试样本', en: 'Reconstruction Test Corpus' } },
  'recon/submit-sketch': { title: { zh: '提交草稿', en: 'Submit Sketch' } },
  'regulation': {
    title: { zh: 'WCA 竞赛规则图解', en: 'WCA Regulations, Illustrated' },
    description: {
      zh: 'WCA 规则图解:官方每一条规则配图示与 3D 示例,一章一页,并附完整官方原文供引用。',
      en: 'The WCA Regulations, illustrated — every official article rewritten with diagrams and 3D examples, one page per article, plus the full official text for citation.',
    },
  },
  'regulation/full': {
    title: { zh: 'WCA 竞赛规则:完整原文', en: 'WCA Regulations: Full Official Text' },
    description: {
      zh: 'WCA 官方规则完整原文,可直接引用。',
      en: 'The complete official WCA Regulations, verbatim, for citation.',
    },
  },
  'regulation/news': { title: { zh: 'WCA 规则:最新动态', en: 'WCA Regulations: Updates' } },
  'scramble': {
    title: { zh: '打乱分析', en: 'Scramble Analysis' },
    description: {
      zh: '打乱分析中心:最优求解器、阶段难度统计、图案搜索,数据来自 WCA 真实打乱语料。',
      en: 'Scramble analysis — optimal solvers, per-step difficulty statistics and pattern search, computed over the WCA’s real scramble corpus.',
    },
  },
  'scramble/555-about': { title: { zh: '5×5 打乱方法', en: '5×5 Scramble Methods' } },
  'scramble/analyzer': { title: { zh: '求解', en: 'Solve' } },
  'scramble/batch-solver': { title: { zh: '批量求解器', en: 'Batch Solver' } },
  'scramble/gen': { title: { zh: '打乱生成器', en: 'Scramble Generator' } },
  'scramble/gen-about': { title: { zh: '打乱生成器说明', en: 'Scramble Generator Guide' } },
  'scramble/hardest': { title: { zh: '最难开局', en: 'Hardest openings' } },
  'scramble/mcc': { title: { zh: 'MCC (步数系数)', en: 'Movecount Coefficient' } },
  'scramble/pattern': { title: { zh: '图案', en: 'Patterns' } },
  'scramble/pattern/search': { title: { zh: '图案搜索', en: 'Pattern Search' } },
  // One route that dispatches on ?event= across ~28 puzzles, so the title has to
  // name the route, not a puzzle. (It used to say "Rubik's Clock Solver", picked
  // up from one of the sibling solver components.) Each solver still refines the
  // tab title at runtime, since the puzzle lives in a query param the server
  // metadata cannot see.
  'scramble/solver': {
    title: { zh: '魔方求解器', en: 'Puzzle Solver' },
    description: {
      zh: '输入打乱或在画板上画出当前状态,求最优解:三阶、二阶、斜转、金字塔、SQ1、魔表、枫叶及各种长方体与异形,共 28 种。',
      en: 'Enter a scramble or paint the current state and get an optimal solution — 3x3, 2x2, Skewb, Pyraminx, Square-1, Clock, Ivy, cuboids and other shape mods, 28 puzzles in all.',
    },
  },
  'scramble/stats': {
    title: { zh: '打乱统计', en: 'Scramble Statistics' },
    description: {
      zh: '打乱难度与步数分布:十字、F2L、EO、DR 等阶段的统计,以及各项目整解最优步数分布。',
      en: 'Scramble difficulty and move-count distributions — per-step statistics for cross, F2L, EO and DR, plus optimal solution lengths per event.',
    },
  },
  'scramble/sub-solver': { title: { zh: '子群求解器', en: 'Subsolver' } },
  'scramble/symmetry': { title: { zh: '对称型', en: 'Symmetry' } },
  'sim': {
    title: { zh: '魔方模拟器', en: 'Puzzle Simulator' },
    description: {
      zh: '魔方模拟器:28 种异形与 NxN 的 3D 模拟,可拖拽转动、播放解法。',
      en: '3D puzzle simulators for 28 puzzle types — drag to turn, play back solutions.',
    },
  },
  'sim/stages': { title: { zh: '阶段遮罩速查', en: 'Stage Masks' } },
  'site': { title: { zh: '网站导航', en: 'Sites Directory' } },
  'solver': { title: { zh: '求解器', en: 'Solver' } },
  'stroop': {
    title: { zh: 'Stroop 色词干扰测试', en: 'Stroop Colour Test' },
    description: {
      zh: 'Stroop 测试:报出每个格子的墨色而不是写的字,计时对比色块卡与干扰卡,量出自己的干扰量。',
      en: 'Stroop test — name the ink colour instead of reading the word, and time the patch card against the conflict card to measure your own interference.',
    },
  },
  'support': { title: { zh: '致谢', en: 'Acknowledgments' } },
  'timer': {
    title: { zh: '计时器', en: 'Timer' },
    description: {
      zh: '速拧计时器:WCA 标准打乱、智能魔方支持、分步分析与云端备份。',
      en: 'Speedcubing timer with WCA-standard scrambles, smart-cube support, step-by-step analysis and cloud backup.',
    },
  },
  'timer/marks': { title: { zh: '打乱足迹', en: 'Scramble Marks' } },
  'timezone': {
    title: { zh: '时区换算', en: 'Time Zone Converter' },
    description: {
      zh: '时区换算:填一个时刻,读出世界各地的对应时间,还能一眼找出跨时区都方便的通话时段,夏令时自动处理。',
      en: 'Convert one moment into local time anywhere in the world, and find the hours that work for everyone across time zones — daylight saving handled automatically.',
    },
  },
  'courses': {
    title: { zh: '课程', en: 'Courses' },
    description: {
      zh: '三阶魔方录播课教学方案:试听课、层先法与 CFOP,含时长、拍摄清单和逐节提词稿。',
      en: 'A recorded 3×3 cubing course covering trial lessons, the beginner method, and CFOP, with timings, shot lists, and complete scripts.',
    },
  },
  'teachers': {
    title: { zh: '魔方老师与培训机构', en: 'Cube Teachers & Schools' },
    description: {
      zh: '查找魔方老师与培训机构,了解教学方向、授课方式和联系信息;登录用户也可发布并维护自己的介绍。',
      en: 'Find cube teachers and training schools by specialty, teaching mode and location, or sign in to publish and maintain your own profile.',
    },
  },
  'tutorial': {
    title: { zh: '魔方教程', en: 'Cubing Tutorials' },
    description: {
      zh: '魔方教程:从入门还原到 CFOP、Roux 进阶,分类整理,配图与动画。',
      en: 'Cubing tutorials — from a first solve through CFOP and Roux, organised by topic, with diagrams and animations.',
    },
  },
  'wb': { title: { zh: '非官方纪录', en: 'World Bests' } },
  'wca': {
    title: { zh: 'WCA 统计', en: 'WCA Statistics' },
    description: {
      zh: 'WCA 统计:排名、纪录、名次和、比赛数据与可视化,基于 WCA 官方导出数据。',
      en: 'WCA statistics — rankings, records, sum of ranks, competition data and visualisations, derived from the official WCA export.',
    },
  },
  'wca/all-events-done': { title: { zh: '全项目达成', en: 'All Events Done' } },
  'wca/cohort-ranks': { title: { zh: '届别排名', en: 'Cohort Ranks' } },
  'wca/comp': { title: { zh: '比赛', en: 'Competitions' } },
  'wca/comp-about': { title: { zh: '加载任意比赛', en: 'Load any competition' } },
  'wca/comp/sources': { title: { zh: '数据源', en: 'Sources' } },
  'wca/comp/stats': { title: { zh: '日历统计', en: 'Calendar Stats' } },
  'wca/fun-stats': { title: { zh: '趣味统计', en: 'Fun Statistics' } },
  'wca/globe-about': { title: { zh: '地球视图说明', en: 'Globe Guide' } },
  'wca/grand-slam': { title: { zh: '大满贯', en: 'Grand Slam' } },
  'wca/kinch': {
    title: { zh: 'Kinch 综合分', en: 'Kinch Ranks' },
    description: {
      zh: '按世界、大洲或国家纪录计算 17 个现役 WCA 项目的综合分榜单与选手逐项明细。',
      en: 'Kinch all-round rankings and per-event scores across all 17 current WCA events, using world, continental or national records.',
    },
  },
  'wca/prediction': { title: { zh: '预测', en: 'Prediction' } },
  'wca/prediction-about': { title: { zh: '速拧极限预测说明', en: 'Speedcubing Prediction Guide' } },
  'wca/prediction/333': { title: { zh: '三阶成绩预测', en: '3×3 Prediction' } },
  'wca/prediction/lucky': { title: { zh: '幸运极限', en: 'Lucky Limit' } },
  'wca/records': { title: { zh: '纪录', en: 'Records' } },
  'wca/result-watch': { title: { zh: '成绩变更监控', en: 'Result Change Monitor' } },
  'wca/results': { title: { zh: '排名', en: 'Rankings' } },
  'wca/success-rate': { title: { zh: '完成率', en: 'Success Rate' } },
  'why-cube': {
    title: { zh: '玩魔方的好处', en: 'Why Learn the Cube' },
    description: {
      zh: '给家长和新手:玩魔方到底练了什么 —— 空间想象、记忆、专注与面对失败的能力。',
      en: 'For parents and newcomers: what solving a cube actually trains — spatial reasoning, memory, focus, and getting comfortable with failure.',
    },
  },
  'wiki': {
    title: { zh: '速拧术语表', en: 'Cubing Glossary' },
    description: {
      zh: '速拧术语表:中英对照,中文术语按社群实际用法而非直译。',
      en: 'Speedcubing glossary — bilingual, with Chinese terms as the community actually uses them rather than literal translations.',
    },
  },
  'xcross_pairing_trainer': { title: { zh: 'XCross 配对训练', en: 'XCross Pairing Trainer' } },
  'xcross_trainer': { title: { zh: 'XCross 训练', en: 'XCross Trainer' } },
  'xxcross_trainer': { title: { zh: 'XXCross 训练', en: 'XXCross Trainer' } },
};

function pick(lang: string): 'zh' | 'en' {
  return lang === 'zh' ? 'zh' : 'en';
}

/** Build a Metadata object from an entry — shared by pageMetadata and callers
 *  that derive entries from their own data (e.g. the regulation chapters). */
export function metadataFromEntry(entry: PageMetaEntry, lang: string): Metadata {
  const l = pick(lang);
  const page = entry.title[l].trim();
  const title = page || BRAND;
  const shareTitle = page && page !== BRAND ? `${BRAND}${SEP}${page}` : BRAND;
  const description = entry.description?.[l];
  return {
    title,
    ...(description ? { description } : {}),
    openGraph: {
      title: shareTitle,
      ...(description ? { description } : {}),
      type: 'website',
      siteName: BRAND,
      images: [{ url: SHARE_IMAGE, width: 640, height: 640, alt: BRAND }],
    },
    twitter: {
      card: 'summary',
      title: shareTitle,
      ...(description ? { description } : {}),
      images: [SHARE_IMAGE],
    },
  };
}

/** generateMetadata factory for a static route. Usage in <route>/layout.tsx:
 *    export const generateMetadata = pageMetadata('math/group');
 */
export function pageMetadata(route: string) {
  return async function generateMetadata({ params }: {
    params: Promise<{ lang: string }>;
  }): Promise<Metadata> {
    const entry = PAGE_META[route];
    if (!entry) return {};
    const { lang } = await params;
    return metadataFromEntry(entry, lang);
  };
}
