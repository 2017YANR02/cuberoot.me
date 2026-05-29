import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, p, c, t } from '../_lib/stack_tool_types';

// ─── React Native 0.85 ──────────────────────────────────────────────────────

export const REACT_NATIVE: StackTool = {
  slug: 'react-native',
  name: 'React Native',
  version: '0.85.3',
  since: '2015-03',
  group: 'frontend',
  accent: '#149ECA',
  bright: '#5BC8EE',
  glyph: '◫',
  floats: ['<View>', '<Text>', 'JSI', 'Fabric', 'TurboModules', 'Hermes', 'Metro', 'Yoga', 'bridgeless', 'Codegen', 'New Arch', 'Expo'],
  zh: {
    tagline: '用 React 写真原生 App',
    role: '本站没用它 —— 移动端走 Capacitor 套壳。这页讲它是什么、为什么这套 web-first 工具链选了另一条路。',
    heroSub: <>同一套 React 组件思维, 渲染出来的不是 DOM 而是真正的 iOS <code>UIView</code> 与 Android <code>View</code>。<code>&lt;View&gt;</code> / <code>&lt;Text&gt;</code> 背后是原生控件, 布局用 Flexbox (Yoga 引擎), 逻辑跑在 JS 引擎里通过桥接调原生。2015 年 Facebook 把它开源, "learn once, write anywhere" 让前端工程师第一次能直接做原生 App。</>,
    whatDesc: <>React Native 让你<strong>用 React 的组件与 hooks 写出渲染成原生控件的 App</strong>。它不是把网页塞进 webview —— <code>&lt;View&gt;</code> 映射到真正的 <code>UIView</code> / <code>android.view</code>, 滚动、手势、动画都是平台原生的。JS 逻辑与原生 UI 之间靠一层接口通信; 新架构 (Fabric + TurboModules + JSI) 把这层从 2015 年的异步 JSON 桥换成了直接的同步调用。</>,
    historyDesc: <>从 2015 年 F8 开源、"用 JS 写原生" 震动前端圈, 到 2024 年 0.76 把新架构设成默认、2025 年 0.82 彻底删掉旧桥, 十一年。中间经历了一次完整的底层重写 (桥 → JSI)、一个自研 JS 引擎 (Hermes), 以及把推荐入口让给 Expo。</>,
    conceptsTitle: '新架构的几块',
    conceptsDesc: <>React Native 的核心是 "React 组件 → 原生控件" 这条映射, 加上让 JS 与原生通信的那层。新架构 (0.76+) 把它拆成 Fabric (渲染) / TurboModules (原生模块) / JSI (调用接口) / Codegen (类型生成) 四块。</>,
    whyDesc: <>要一套代码同时出 iOS + Android 的真原生 App、又想复用 React 团队的人和心智, RN 仍是覆盖面最广的选择。Meta / Microsoft / Shopify 在押注它。代价是: 跨原生平台的边角永远要碰平台代码, 纯内容类 App 用 webview 套壳往往更省。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Facebook / Instagram / Messenger 自家在用; Microsoft 把 Office / Teams / Xbox 甚至 Windows 都接了 RN; Shopify 整个移动端押在 RN 上, Discord iOS、Coinbase、Bloomberg 同样。</>,
    cuberootDesc: <>本站<strong>刻意没选 RN</strong>。iOS / Android 套壳走 Capacitor —— 同一份 Next.js / React web 代码塞进原生 webview, 不维护第二套原生 UI。下面讲这个取舍, 以及什么情况下会翻盘。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>0.82 (2025-10) 是 "只剩新架构" 的里程碑, 旧桥彻底退场。接下来主线: Hermes V1 引擎、React 19 并发上原生、Expo 成官方默认框架。</>,
  },
  en: {
    tagline: 'Real native apps, written in React',
    role: "The site doesn't use it — mobile goes through a Capacitor shell. This page covers what it is and why this web-first toolchain took a different road.",
    heroSub: <>The same React component thinking, but what renders isn't the DOM — it's actual iOS <code>UIView</code>s and Android <code>View</code>s. <code>&lt;View&gt;</code> / <code>&lt;Text&gt;</code> back onto native widgets, layout is Flexbox (the Yoga engine), and logic runs in a JS engine that calls native through a bridging layer. When Facebook open-sourced it in 2015, "learn once, write anywhere" let frontend engineers build native apps for the first time.</>,
    whatDesc: <>React Native lets you <strong>write apps with React components and hooks that render to native widgets</strong>. It is not a webpage in a webview — <code>&lt;View&gt;</code> maps to a real <code>UIView</code> / <code>android.view</code>, and scrolling, gestures, and animations are platform-native. JS logic and native UI talk over an interface layer; the New Architecture (Fabric + TurboModules + JSI) replaced 2015's async JSON bridge with direct synchronous calls.</>,
    historyDesc: <>From the 2015 F8 open-sourcing — "native in JS" shaking the frontend world — to 0.76 making the New Architecture the default in 2024 and 0.82 removing the old bridge in 2025, eleven years. Along the way: a full low-level rewrite (bridge → JSI), a purpose-built JS engine (Hermes), and handing the recommended on-ramp to Expo.</>,
    conceptsTitle: 'Pieces of the New Architecture',
    conceptsDesc: <>RN's core is the "React component → native widget" mapping plus the layer letting JS talk to native. The New Architecture (0.76+) splits that into four: Fabric (rendering) / TurboModules (native modules) / JSI (the call interface) / Codegen (type generation).</>,
    whyDesc: <>To ship one codebase as genuinely native iOS + Android apps while reusing React's people and mental model, RN remains the broadest option. Meta / Microsoft / Shopify are betting on it. The cost: cross-platform native edges always force you into platform code, and pure content apps are often cheaper in a webview shell.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Facebook / Instagram / Messenger run it in-house; Microsoft wired Office / Teams / Xbox and even Windows to RN; Shopify bet its entire mobile stack on RN, as did Discord iOS, Coinbase, and Bloomberg.</>,
    cuberootDesc: <>This site <strong>deliberately did not pick RN</strong>. The iOS / Android shell is Capacitor — the same Next.js / React web code dropped into a native webview, with no second native UI to maintain. Below: the trade-off, and the line where it would flip.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>0.82 (2025-10) is the "New Architecture only" milestone, with the old bridge fully gone. Ahead: the Hermes V1 engine, React 19 concurrency on native, and Expo becoming the official default framework.</>,
  },
  heroStats: [
    { num: '0.85', unit: '.3', zh: <>当前稳定版 <em>2026-05</em></>, en: <>current stable <em>2026-05</em></> },
    { num: '2', unit: '端', zh: <>一套代码 iOS + Android <em>外加 RN Web</em></>, en: <>platforms from one codebase <em>plus RN Web</em></> },
    { num: '11', unit: 'y', zh: <>从 2015 至今 <em>跨端老将</em></>, en: <>since 2015 <em>a cross-platform veteran</em></> },
    { num: '0.76', unit: '', zh: <>新架构成默认起点 <em>2024-10</em></>, en: <>New Architecture default from <em>2024-10</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>2015 年 1 月, Facebook 在 React.js Conf 上演示 React Native; 3 月在 F8 大会开源 (先 iOS), 9 月补上 Android。它的命题不是 "一次写到处跑", 而是 "learn once, write anywhere" —— 同一套 React 心智, 在每个平台写各自原生的那部分。<code>&lt;View&gt;</code> 渲染成真 <code>UIView</code>, 不是 DOM 也不是 webview。</p>
        <p>早期架构有个隐患: JS 与原生之间隔着一座<strong>异步 JSON 桥</strong>, 所有调用要序列化、排队、跨线程, 快速滚动列表或复杂动画会卡。2018 年 Facebook 公开了重写计划 —— Fabric (新渲染器)、TurboModules (按需加载的原生模块)、JSI (JS 直接持有原生对象的同步接口), 目标是干掉这座桥。同期 2019 年发布 Hermes: 一个专为 RN 优化、预编译字节码、启动快内存省的 JS 引擎。</p>
        <p>这场重写花了好几年逐步落地。2024 年 10 月 0.76 把<strong>新架构设成默认</strong>; 2025 年 6 月 0.80 冻结旧架构; 2025 年 10 月 0.82 成为<strong>第一个只跑新架构</strong>的版本, 旧桥代码彻底删除; 2026 年 2 月 0.84 把 Hermes V1 设默认; 2026 年 4 月 0.85 带来新动画后端。同时 Meta 把新项目的推荐入口正式让给 Expo。</p>
      </>
    ),
    en: (
      <>
        <p>In January 2015, Facebook demoed React Native at React.js Conf; in March it open-sourced it at F8 (iOS first), with Android following in September. Its thesis wasn't "write once, run everywhere" but "learn once, write anywhere" — the same React mindset, writing each platform's native parts. <code>&lt;View&gt;</code> renders to a real <code>UIView</code>, not the DOM and not a webview.</p>
        <p>The early architecture had a flaw: between JS and native sat an <strong>async JSON bridge</strong> — every call serialized, queued, and crossed threads, so fast-scrolling lists or complex animations stuttered. In 2018 Facebook published the rewrite plan — Fabric (a new renderer), TurboModules (lazily-loaded native modules), JSI (a synchronous interface letting JS hold native objects directly) — aimed at killing that bridge. Alongside, 2019 brought Hermes: a JS engine purpose-built for RN with precompiled bytecode, fast startup, and low memory.</p>
        <p>That rewrite landed incrementally over years. October 2024's 0.76 made the <strong>New Architecture the default</strong>; June 2025's 0.80 froze the legacy architecture; October 2025's 0.82 became the <strong>first New-Architecture-only</strong> release with the old bridge code removed; February 2026's 0.84 set Hermes V1 as default; April 2026's 0.85 brought a new animation backend. Meanwhile Meta officially handed the recommended on-ramp for new projects to Expo.</p>
      </>
    ),
  },
  history: [
    { year: '2015·03', zh: { title: <>F8 开源</>, desc: <>1 月 React.js Conf 演示, 3 月 F8 开源 (iOS), 9 月补 Android。"learn once, write anywhere" 让前端第一次能直接做原生 App。</> }, en: { title: <>Open-sourced at F8</>, desc: <>Demoed at React.js Conf in January, open-sourced at F8 (iOS) in March, Android in September. "Learn once, write anywhere" lets frontend engineers build native apps for the first time.</> } },
    { year: '2017·xx', zh: { title: <>生态起飞 + Expo</>, desc: <>社区爆发, Expo 出现把 "免 Xcode/Android Studio 起步" 做成托管工作流。RN 成为创业公司做双端 App 的默认选择之一。</> }, en: { title: <>Ecosystem takes off + Expo</>, desc: <>The community explodes; Expo emerges, turning "start without Xcode/Android Studio" into a managed workflow. RN becomes a default choice for startups shipping both platforms.</> } },
    { year: '2018·06', zh: { title: <>宣布重写架构</>, desc: <>Facebook 公开 Fabric / TurboModules / JSI 计划: 干掉异步 JSON 桥, 让 JS 直接同步调原生。RN 史上最大的一次底层改造启动。</> }, en: { title: <>Re-architecture announced</>, desc: <>Facebook reveals the Fabric / TurboModules / JSI plan: kill the async JSON bridge, let JS call native synchronously. The largest low-level overhaul in RN's history begins.</> } },
    { year: '2019·07', zh: { title: <>Hermes 引擎</>, desc: <>发布 Hermes: 专为 RN 优化的 JS 引擎, 预编译字节码、启动快、内存省, 尤其改善低端 Android 的冷启动。</> }, en: { title: <>The Hermes engine</>, desc: <>Hermes ships: a JS engine tuned for RN with precompiled bytecode, fast startup, and low memory — notably improving cold start on low-end Android.</> } },
    { year: '2024·10', zh: { title: <>0.76 — 新架构默认</>, desc: <>Fabric 渲染器 + TurboModules + bridgeless 成为默认。酝酿六年的重写第一次成为所有人的默认路径。</> }, en: { title: <>0.76 — New Architecture default</>, desc: <>The Fabric renderer + TurboModules + bridgeless become the default. Six years of rewrite finally become everyone's default path.</> } },
    { year: '2025·06', zh: { title: <>0.80 — 冻结旧架构</>, desc: <>旧架构进入冻结、不再加新功能, React 19.1。明确信号: 生态该全面迁到新架构了。</> }, en: { title: <>0.80 — legacy frozen</>, desc: <>The legacy architecture is frozen — no new features — alongside React 19.1. A clear signal: time for the ecosystem to fully migrate.</> } },
    { year: '2025·10', zh: { title: <>0.82 — 只剩新架构</>, desc: <>第一个只跑新架构的版本, 旧桥代码彻底删除。十年的桥接架构正式退场。</> }, en: { title: <>0.82 — New Architecture only</>, desc: <>The first release running solely on the New Architecture; the old bridge code is removed for good. A decade of bridge architecture officially retires.</> } },
    { year: '2026·02', zh: { title: <>0.84 — Hermes V1</>, desc: <>Hermes V1 成为默认引擎, 性能与兼容性再上一层; React 19.2 特性同期跟进。</> }, en: { title: <>0.84 — Hermes V1</>, desc: <>Hermes V1 becomes the default engine, stepping up performance and compatibility; React 19.2 features follow.</> } },
    { year: '2026·04', highlight: true, zh: { title: <>0.85 — 新动画后端</>, desc: <>新动画后端 + Jest preset 独立包。当前线 0.85.3 (2026-05), 全面 New Arch + Hermes V1 + React 19。</> }, en: { title: <>0.85 — new animation backend</>, desc: <>A new animation backend + a standalone Jest preset package. Current line is 0.85.3 (2026-05) — fully New Arch + Hermes V1 + React 19.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>组件 → 原生控件</>, desc: <><code>&lt;View&gt;</code> / <code>&lt;Text&gt;</code> / <code>&lt;Image&gt;</code> 不是 HTML, 它们映射到真正的 <code>UIView</code> / <code>android.view</code>。没有 DOM, 没有 CSS, 样式是 JS 对象 + Flexbox。</> }, en: { title: <>Components → native widgets</>, desc: <><code>&lt;View&gt;</code> / <code>&lt;Text&gt;</code> / <code>&lt;Image&gt;</code> aren't HTML — they map to real <code>UIView</code> / <code>android.view</code>. No DOM, no CSS; styles are JS objects + Flexbox.</> }, code: <code>{k('import')} {'{ '}{v('View')}, {v('Text')} {'}'} {k('from')} {s("'react-native'")};{'\n\n'}&lt;{t('View')} {p('style')}={'{{ '}{p('padding')}: {n('16')} {'}}'}&gt;{'\n'}  &lt;{t('Text')}&gt;Hello&lt;/{t('Text')}&gt;{'\n'}&lt;/{t('View')}&gt;</code> },
    { tag: 'B', zh: { title: <>JSI + bridgeless</>, desc: <>新架构的核心。JS 通过 JSI 直接持有 C++/原生对象的引用, 同步调用、零序列化, 取代旧的异步 JSON 桥。卡顿的根源被拔掉。</> }, en: { title: <>JSI + bridgeless</>, desc: <>The New Architecture's core. JS holds references to C++/native objects directly via JSI — synchronous, zero serialization — replacing the old async JSON bridge. The root cause of jank is pulled out.</> }, code: <code>{c('// 旧: JS --(JSON 序列化, 异步)--> 原生')}{'\n'}{c('// 新: JS --(JSI, 同步直调)----> 原生')}</code> },
    { tag: 'C', zh: { title: <>Fabric 渲染器</>, desc: <>C++ 写的新渲染器, 跨平台共享一棵 shadow tree, 支持 React 18 并发特性。布局、提交、挂载在 C++ 层完成, 比旧渲染器一致且快。</> }, en: { title: <>The Fabric renderer</>, desc: <>A C++ renderer sharing one shadow tree across platforms and supporting React 18 concurrent features. Layout, commit, and mount happen in C++ — more consistent and faster than the old renderer.</> }, code: <code>{c('// shadow tree 在 C++ 层, iOS/Android 共用')}</code> },
    { tag: 'D', zh: { title: <>TurboModules</>, desc: <>原生模块按需懒加载, 不再启动时全量初始化。接口由 Codegen 从 TS 类型生成, JS 调原生有静态类型保证。</> }, en: { title: <>TurboModules</>, desc: <>Native modules load lazily instead of all at startup. Their interfaces are generated by Codegen from TS types, so JS-to-native calls are statically typed.</> }, code: <code>{k('export')} {k('interface')} {t('Spec')} {k('extends')} {t('TurboModule')} {'{'}{'\n'}  {f('getCount')}(): {t('number')};{'\n'}{'}'}</code> },
    { tag: 'E', zh: { title: <>Hermes 引擎</>, desc: <>RN 自研的 JS 引擎。把 JS 预编译成字节码随包发, 省掉运行时解析, 启动更快、内存更低。0.84 起 Hermes V1 默认。</> }, en: { title: <>The Hermes engine</>, desc: <>RN's purpose-built JS engine. It precompiles JS to bytecode shipped with the app, skipping runtime parsing for faster startup and lower memory. Hermes V1 is default from 0.84.</> }, code: <code>{c('// metro 出包时把 JS -> Hermes 字节码 (.hbc)')}</code> },
    { tag: 'F', zh: { title: <>Metro 打包器</>, desc: <>RN 专用的 JS 打包器, 增量编译 + 快速刷新 (Fast Refresh)。改组件保存即热替换, 不丢导航状态。</> }, en: { title: <>The Metro bundler</>, desc: <>RN's dedicated JS bundler — incremental compilation + Fast Refresh. Edit a component, save, and it hot-replaces without losing navigation state.</> }, code: <code>{c('$ npx react-native start  # Metro dev server')}</code> },
    { tag: 'G', zh: { title: <>Yoga 布局</>, desc: <>C++ 写的跨平台 Flexbox 引擎。RN 的样式没有 CSS, 全靠 Yoga 把 flex 属性算成每个原生控件的 frame。Web 上的 Flexbox 直觉直接迁过来。</> }, en: { title: <>Yoga layout</>, desc: <>A C++ cross-platform Flexbox engine. RN has no CSS — Yoga turns flex props into each native widget's frame. Your web Flexbox intuition carries over directly.</> }, code: <code>{p('style')}: {'{ '}{p('flex')}: {n('1')}, {p('flexDirection')}: {s("'row'")} {'}'}</code> },
    { tag: 'H', zh: { title: <>Expo 框架</>, desc: <>RN 之上的 "电池全包" 框架: 免原生工具链起步、OTA 热更新、一堆封装好的原生 API。Meta 现在把新项目默认指向 Expo。</> }, en: { title: <>The Expo framework</>, desc: <>A "batteries-included" framework on top of RN: start without a native toolchain, OTA updates, a pile of wrapped native APIs. Meta now points new projects at Expo by default.</> }, code: <code>{c('$ npx create-expo-app')}</code> },
  ],
  whyCards: [
    { icon: '◫', zh: { title: <>一套代码两端</>, desc: <>iOS + Android 共享绝大部分 JS, 平台差异处用 <code>Platform.select</code> 或 <code>.ios.tsx</code> / <code>.android.tsx</code> 分文件。再加 RN Web 还能出网页。</> }, en: { title: <>One codebase, two platforms</>, desc: <>iOS + Android share most JS; platform differences use <code>Platform.select</code> or split <code>.ios.tsx</code> / <code>.android.tsx</code> files. With RN Web you also get a web build.</> }, code: <>{v('Platform')}.{f('select')}({'{ '}{p('ios')}: a, {p('android')}: b {'}'})</> },
    { icon: '◉', zh: { title: <>真原生 UI</>, desc: <>不是 webview。滚动、键盘、手势、转场都是平台原生控件, 60fps、平台手感, 用户感觉不到是 JS 写的。</> }, en: { title: <>Genuinely native UI</>, desc: <>Not a webview. Scrolling, keyboard, gestures, transitions are all native widgets — 60fps, platform feel, users can't tell it's written in JS.</> }, code: <>{c('// <FlatList> = 原生 UITableView / RecyclerView')}</> },
    { icon: '⚛', zh: { title: <>就是 React</>, desc: <>组件、hooks、props、context 全部一样, 状态管理 (Zustand / Redux) 直接复用。web React 工程师几天就能上手原生。</> }, en: { title: <>It's just React</>, desc: <>Components, hooks, props, context are identical; state libs (Zustand / Redux) reuse directly. A web React engineer is productive on native in days.</> }, code: <>{k('const')} [{v('n')}, {v('setN')}] = {f('useState')}({n('0')});</> },
    { icon: '⊞', zh: { title: <>巨头背书</>, desc: <>Meta 自家在用, Microsoft 把 RN 推到 Windows / Office / Xbox, Shopify 整个移动端押在它上。生态与长期维护有保障。</> }, en: { title: <>Big-tech backing</>, desc: <>Meta uses it in-house, Microsoft extends RN to Windows / Office / Xbox, Shopify bet its whole mobile stack on it. Ecosystem and long-term maintenance are secure.</> }, code: <>{c('// react-native-windows, react-native-macos')}</> },
    { icon: '⟳', zh: { title: <>Fast Refresh + OTA</>, desc: <>改 JS 保存即热替换, 反馈环跟 web 一样快。配合 Expo / CodePush 还能跳过应用商店审核直接 OTA 推 JS 更新。</> }, en: { title: <>Fast Refresh + OTA</>, desc: <>Edit JS, save, hot-replace — a web-fast feedback loop. With Expo / CodePush you can OTA-push JS updates without an app-store review.</> }, code: <>{c('// 改一行 -> 模拟器立刻更新, 不重装')}</> },
    { icon: '⌗', zh: { title: <>新架构去掉了桥</>, desc: <>JSI 让 JS 同步直调原生, 消除旧桥的序列化开销; Fabric 上 React 并发渲染。0.82 起旧桥彻底没了, 性能天花板抬高一档。</> }, en: { title: <>The New Architecture drops the bridge</>, desc: <>JSI lets JS call native synchronously, removing the old bridge's serialization cost; React renders concurrently on Fabric. From 0.82 the old bridge is gone — the performance ceiling rises a notch.</> }, code: <>{c('// bridgeless: 无 batched async queue')}</> },
    { icon: '◐', zh: { title: <>Hermes 启动省</>, desc: <>预编译字节码随包发, 省掉运行时解析 JS。低端 Android 冷启动与内存占用明显改善, 这是 web 在 webview 里拿不到的。</> }, en: { title: <>Hermes is lean at startup</>, desc: <>Precompiled bytecode ships with the app, skipping runtime JS parsing. Cold start and memory on low-end Android improve markedly — something a webview can't match.</> }, code: <>{c('// app bundle 里是 .hbc 字节码')}</> },
    { icon: '⎇', zh: { title: <>随时下沉到原生</>, desc: <>性能关键或平台独有功能, 写一个原生模块 (TurboModule) 暴露给 JS。不被框架锁死, 这是 webview 套壳给不了的逃生口。</> }, en: { title: <>Drop to native anytime</>, desc: <>For perf-critical or platform-only features, write a native module (TurboModule) exposed to JS. You're not boxed in by the framework — an escape hatch a webview shell can't offer.</> }, code: <>{c('// ios/MyModule.mm + Codegen spec')}</> },
  ],
  adopters: [
    { name: 'Meta', href: 'https://www.facebook.com', highlight: true, zhNote: 'Facebook / Instagram / Messenger 部分界面', enNote: 'Parts of Facebook / Instagram / Messenger' },
    { name: 'Microsoft', href: 'https://github.com/microsoft/react-native-windows', highlight: true, zhNote: 'Office / Teams / Xbox + RN-Windows/macOS', enNote: 'Office / Teams / Xbox + RN-Windows/macOS' },
    { name: 'Shopify', href: 'https://shopify.engineering', highlight: true, zhNote: '整个移动端押在 RN 上', enNote: 'Its entire mobile stack is on RN' },
    { name: 'Discord', href: 'https://discord.com', zhNote: 'iOS App 长期用 RN', enNote: 'iOS app has long used RN' },
    { name: 'Coinbase', href: 'https://www.coinbase.com', zhNote: '从原生迁到 RN', enNote: 'Migrated from native to RN' },
    { name: 'Bloomberg', href: 'https://www.bloomberg.com', zhNote: '消费者 App 用 RN 重写', enNote: 'Rebuilt its consumer app with RN' },
    { name: 'Tesla', href: 'https://www.tesla.com', zhNote: '车主 App 用 RN', enNote: 'Owner app on RN' },
    { name: 'Expo', href: 'https://expo.dev', highlight: true, zhNote: 'RN 之上的官方推荐框架', enNote: 'The officially recommended framework on RN' },
    { name: 'Wix', href: 'https://www.wix.com', zhNote: '早期重度用户 + 开源大量 RN 库', enNote: 'Early heavy user, open-sourced many RN libs' },
    { name: 'Mercari', href: 'https://www.mercari.com', zhNote: '日本二手电商 RN 重写', enNote: 'Japanese resale app rebuilt with RN' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站没用 RN —— 走 Capacitor 套壳, 见 §06', enNote: 'This site does NOT use RN — Capacitor shell instead, see §06' },
  ],
  outlook: [
    { tag: <>HOT · 2025-10</>, hot: true, big: true, zh: { title: <>0.82 只剩新架构</>, body: <><p>0.82 成为第一个只跑新架构的版本: Fabric + TurboModules + JSI + bridgeless 全默认, 旧桥代码彻底删除。困扰 RN 十年的异步桥卡顿问题, 从架构层面被消掉。</p><p>对生态的意义: 所有库都得迁到新架构 (大部分已完成), 不再背两套兼容包袱。RN 这十年最大的一次技术债清算到此收口。</p></> }, en: { title: <>0.82 is New-Architecture-only</>, body: <><p>0.82 is the first release running solely on the New Architecture: Fabric + TurboModules + JSI + bridgeless all default, old bridge code removed. The async-bridge jank that dogged RN for a decade is eliminated at the architecture level.</p><p>For the ecosystem: every library must migrate to the New Architecture (most already have), shedding the dual-compat burden. RN's biggest tech-debt reckoning of the decade closes here.</p></> } },
    { tag: 'HERMES', big: true, zh: { title: <>Hermes V1</>, body: <><p>0.84 把 Hermes V1 设为默认引擎。作为专为 RN 写的 JS 引擎, 它在启动时间、内存占用、字节码体积上持续压低, 尤其撑住低端 Android 的体验 —— 这是 webview 方案天然拿不到的优势。</p></> }, en: { title: <>Hermes V1</>, body: <><p>0.84 makes Hermes V1 the default engine. As a JS engine written for RN, it keeps driving down startup time, memory, and bytecode size, especially holding up the low-end Android experience — an edge a webview approach can't get for free.</p></> } },
    { tag: 'EXPO', zh: { title: <>Expo 成官方默认</>, body: <><p>Meta 现在把新项目的推荐入口正式指向 Expo: 托管工作流、OTA 更新、一整套封装好的原生 API。"裸 RN" 退为高级路径, 多数新 App 从 Expo 起步。</p></> }, en: { title: <>Expo as the official default</>, body: <><p>Meta now points the recommended on-ramp for new projects at Expo: a managed workflow, OTA updates, a full set of wrapped native APIs. "Bare RN" recedes to an advanced path; most new apps start from Expo.</p></> } },
    { tag: 'REACT19', zh: { title: <>React 19 上原生</>, body: <><p>Fabric 渲染器支持 React 18/19 的并发特性, 0.83 起跟进 React 19.2。Suspense、transitions、并发渲染这些 web 上的能力正逐步在原生侧可用。</p></> }, en: { title: <>React 19 on native</>, body: <><p>The Fabric renderer supports React 18/19 concurrent features, with 0.83 tracking React 19.2. Suspense, transitions, concurrent rendering — web-side capabilities — are becoming available natively.</p></> } },
    { tag: 'BOUNDARY', zh: { title: <>边界:何时不用它</>, body: <><p>纯内容 / 工具类 App (像本站这种已经在 web 跑得很好的), 用 webview 套壳 (Capacitor) 往往更省: 不重写 UI、不重新接 WASM 与 worker 管线。RN 的价值在需要真原生性能、原生手感、深度系统集成时才兑现 —— 跨不过这条线就别为它付重写成本。</p></> }, en: { title: <>Boundary: when not to use it</>, body: <><p>For pure content / tool apps (like this site, which already runs well on the web), a webview shell (Capacitor) is often cheaper: no UI rewrite, no re-wiring the WASM and worker pipeline. RN's value cashes in only when you need true native performance, native feel, or deep system integration — below that line, don't pay the rewrite cost.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>把话说在前面: 本站<strong>没有用 React Native</strong>。移动端 (iOS / Android) 走的是 Capacitor —— 把同一份 Next.js / React web 应用塞进一个原生 webview 壳里, 由 <code>mobile_build.yml</code> 的双 runner CI 出 APK + IPA。一套 web 代码, 不维护第二套原生 UI。</p>
        <p>为什么是 Capacitor 不是 RN: 本站是<strong>内容与工具密集型</strong> —— frame-count 的 WebCodecs 解码管线、cubing.js 的 3D 魔方、cubeopt-wasm 的 WASM solver、一堆 worker, 这些本来就在浏览器里跑得很好。换 RN 意味着把每一个页面的 UI 用原生组件重写一遍, 再把整条 WASM / worker 管线重新接到原生侧 —— 对一个 web-first 工具站, 这笔重写成本换不回等价收益。webview 套壳是务实的那一边。</p>
        <p>什么情况下会翻盘: 如果哪天要做一个<strong>真正吃原生能力</strong>的功能 —— 比如后台常驻的蓝牙智能魔方计时 (需要原生 BLE + 后台任务)、原生级手势 / 触觉反馈、或对启动时间 / 内存极度敏感的场景 —— RN 的 JSI + 原生模块会明显赢过 webview。那条线就是这个决定可能反转的地方; 目前还没有功能跨过去。</p>
        <p>所以这一页跟 Bun / Obsidian / uv 同类: "认真评估过、当下有意识地没选" 的条目, 不是 "还没听说"。把取舍写清楚, 比假装它在用更诚实。</p>
      </>
    ),
    en: (
      <>
        <p>Up front: this site <strong>does not use React Native</strong>. Mobile (iOS / Android) goes through Capacitor — the same Next.js / React web app dropped into a native webview shell, with <code>mobile_build.yml</code>'s dual-runner CI producing the APK + IPA. One web codebase, no second native UI to maintain.</p>
        <p>Why Capacitor over RN: the site is <strong>content- and tool-heavy</strong> — frame-count's WebCodecs decode pipeline, cubing.js 3D cubes, cubeopt-wasm's WASM solver, a pile of workers — all of which already run well in the browser. Switching to RN would mean rewriting every page's UI in native components and re-wiring the entire WASM / worker pipeline to the native side. For a web-first toolkit, that rewrite doesn't buy back equivalent value. The webview shell is the pragmatic side.</p>
        <p>Where it would flip: the day a feature <strong>genuinely needs native capability</strong> — say a background-resident Bluetooth smartcube timer (native BLE + background tasks), native-grade gestures / haptics, or something extremely sensitive to startup time / memory — RN's JSI + native modules would clearly beat a webview. That line is where this decision could reverse; nothing has crossed it yet.</p>
        <p>So this page is the same genre as Bun / Obsidian / uv: a "seriously evaluated, consciously not chosen for now" entry, not a "haven't heard of it" one. Writing the trade-off down is more honest than pretending it's in use.</p>
      </>
    ),
  },
  links: [
    { label: 'reactnative.dev', href: 'https://reactnative.dev' },
    { label: 'GitHub · facebook/react-native', href: 'https://github.com/facebook/react-native' },
    { label: 'The New Architecture', href: 'https://reactnative.dev/architecture/landing-page' },
    { label: 'Expo', href: 'https://expo.dev' },
    { label: 'Hermes', href: 'https://github.com/facebook/hermes' },
  ],
};

export default REACT_NATIVE;
