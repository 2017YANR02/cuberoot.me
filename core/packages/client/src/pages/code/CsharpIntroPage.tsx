import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './csharp_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

// 256x256 official-purple logo with stylised C# glyph
const CS_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="cs-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8C66F2" />
        <stop offset="100%" stopColor="#2E1480" />
      </linearGradient>
      <linearGradient id="cs-c-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#D5C3FF" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="32" fill="url(#cs-grad)" />
    {/* C glyph */}
    <path
      d="M170 92 C158 80 142 74 124 74 C92 74 68 98 68 132 C68 166 92 190 124 190 C142 190 158 184 170 172"
      stroke="url(#cs-c-grad)"
      strokeWidth="20"
      fill="none"
      strokeLinecap="round"
    />
    {/* # — two horizontal bars + two vertical bars */}
    <g stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round">
      <line x1="178" y1="100" x2="226" y2="100" />
      <line x1="174" y1="138" x2="222" y2="138" />
      <line x1="192" y1="84" x2="184" y2="156" />
      <line x1="216" y1="84" x2="208" y2="156" />
    </g>
  </svg>
);

interface HistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

const HISTORY: HistoryItem[] = [
  {
    year: <>1996<small>·11</small></>,
    zh: { title: <>Anders Hejlsberg 离开 Borland 加入 Microsoft</>, desc: <>当时 Hejlsberg 是 <strong>Turbo Pascal</strong> 与 <strong>Delphi</strong> 的总设计师, 微软用据传 ~<strong>$3M 期权 + 千万级保留奖金</strong>把他从 Borland 挖走。Borland 起诉、和解, 微软留人——这是 .NET 故事的真正第 0 章。</> },
    en: { title: <>Anders Hejlsberg jumps from Borland to Microsoft</>, desc: <>Hejlsberg, then chief designer of <strong>Turbo Pascal</strong> and <strong>Delphi</strong>, is reportedly hired with ~<strong>$3M of options plus multi-million retention</strong>. Borland sues, settles, Microsoft keeps him — the actual Chapter 0 of the .NET story.</> },
  },
  {
    year: <>2000<small>·06·26</small></>, highlight: true,
    zh: { title: <>C# 在 PDC 2000 公开</>, desc: <>Microsoft Professional Developers Conference: Hejlsberg 主导的 <strong>"Project Cool"</strong> 正式亮相, 项目内部名 <strong>"COOL" (C-like Object Oriented Language)</strong>, 改名 <strong>C#</strong>。设计目标朴素到没法再朴素: "<em>给 Windows 一门像 Java 一样的现代托管语言, 但要快、要好用、要能调 COM</em>"。</> },
    en: { title: <>C# unveiled at PDC 2000</>, desc: <>At Microsoft's Professional Developers Conference, Hejlsberg's <strong>"Project Cool"</strong> goes public. The internal name was <strong>"COOL" (C-like Object Oriented Language)</strong>, renamed <strong>C#</strong>. The design brief is unembellished: "<em>give Windows a modern managed language like Java, but make it fast, ergonomic, and able to call into COM</em>".</> },
  },
  {
    year: <>2002<small>·02·13</small></>, highlight: true,
    zh: { title: <>.NET Framework 1.0 + C# 1.0 GA</>, desc: <>Visual Studio .NET 同日发布。<strong>CLR (Common Language Runtime)</strong>, JIT, GC, BCL 一次性铺好——比 Java 的 JIT 晚, 但<strong>泛型不是补丁、生命周期不是手贴, 一开始就是托管语言</strong>。<em>Windows-only · 但工业级生产力</em>。</> },
    en: { title: <>.NET Framework 1.0 + C# 1.0 GA</>, desc: <>Ships the same day as Visual Studio .NET. <strong>CLR (Common Language Runtime)</strong>, JIT, GC, BCL all show up in one slab — later than Java's JIT, but <strong>generics weren't bolted on, lifetimes weren't manual; it was a managed language from day one</strong>. <em>Windows-only · but production-grade out of the gate</em>.</> },
  },
  {
    year: <>2004<small>·06·30</small></>,
    zh: { title: <>Mono 1.0 — Linux/macOS 上的 .NET</>, desc: <>Miguel de Icaza (GNOME 创始人) 主导的 <strong>Mono 项目</strong> 1.0 发布: 在 Linux / macOS / BSD 上重写 CLR + BCL。<em>这一开口子, 让 C# 从 Windows 语言变成"理论上的跨平台"</em>; 真正落地要等 2014 微软自己接棒。</> },
    en: { title: <>Mono 1.0 — .NET on Linux/macOS</>, desc: <>Miguel de Icaza (founder of GNOME) ships <strong>Mono 1.0</strong>: a from-scratch reimplementation of CLR + BCL on Linux / macOS / BSD. <em>The crack that turned C# from a Windows language into a "cross-platform in theory" language</em>; the real cross-platform story has to wait for Microsoft itself in 2014.</> },
  },
  {
    year: <>2005<small>·11</small></>,
    zh: { title: <>C# 2.0 — 泛型 / iterator / nullable / partial</>, desc: <><strong>generics</strong> 不靠擦除 (Java 走的是擦除), CLR 层级实现, <code>List&lt;int&gt;</code> 就是真正的 <code>List&lt;int&gt;</code>; <code>yield return</code> 让 iterator 一行写完; <code>int?</code> nullable, <code>partial class</code> 让 designer 生成的 winforms 不再覆盖你的代码。</> },
    en: { title: <>C# 2.0 — generics / iterators / nullable / partial</>, desc: <><strong>Generics</strong> are reified at the CLR level (Java went with erasure); <code>List&lt;int&gt;</code> is genuinely <code>List&lt;int&gt;</code> at runtime. <code>yield return</code> turns iterators into one-liners; <code>int?</code> is nullable value types; <code>partial class</code> stops the WinForms designer from clobbering your code.</> },
  },
  {
    year: <>2007<small>·11</small></>, highlight: true,
    zh: { title: <>C# 3.0 / LINQ — 改变语言整张脸</>, desc: <>这是 C# 的<strong>第一次性格大改</strong>: <code>var</code>、lambda、扩展方法、对象初始化器、anonymous types、表达式树, <strong>全部为 LINQ 服务</strong>。<code>from x in xs where x &gt; 0 select x * 2</code> 直接写在语言里——SQL 在内存里, 集合代数变成日常工具。<em>10 年后 JavaScript / Java / Swift 才陆续抄齐</em>。</> },
    en: { title: <>C# 3.0 / LINQ — the personality shift</>, desc: <>The <strong>first identity rewrite</strong>: <code>var</code>, lambdas, extension methods, object initialisers, anonymous types, expression trees — <strong>all of it in service of LINQ</strong>. <code>from x in xs where x &gt; 0 select x * 2</code> sits inside the language. SQL-in-memory, set algebra as a daily tool. <em>JS, Java and Swift only caught up over the following decade</em>.</> },
  },
  {
    year: <>2010<small>·04</small></>,
    zh: { title: <>C# 4.0 — <code>dynamic</code> / 命名参数 / 协变逆变</>, desc: <><code>dynamic</code> 关键字接 DLR (Dynamic Language Runtime), 让 C# 能像 Python / Ruby 一样调动态对象; 命名参数和默认参数, 干掉了一半 method overload 样板。<em>这一版 C# 已经在 Java 前面两个版本</em>, 但还困在 Windows。</> },
    en: { title: <>C# 4.0 — <code>dynamic</code> / named args / variance</>, desc: <><code>dynamic</code> hooks into the DLR (Dynamic Language Runtime), letting C# call into Python / Ruby-style dynamic objects. Named and optional parameters wipe out half the overload boilerplate. <em>By this point C# is two versions ahead of Java</em> — but it's still stuck on Windows.</> },
  },
  {
    year: <>2012<small>·08</small></>, highlight: true,
    zh: { title: <>C# 5.0 — <code>async</code>/<code>await</code></>, desc: <>C# <strong>把 async/await 第一次推到主流</strong>: 用 state machine 重写 continuation-passing, 写起来跟同步代码一样。3 年后 <a href="/code/language/ts">TypeScript</a> 抄了它, 5 年后 JavaScript ES2017 抄了它, 之后 Python / Rust / Swift 全部跟上——<em>这是 C# 留给整个工业界最大的礼物</em>。</> },
    en: { title: <>C# 5.0 — <code>async</code>/<code>await</code></>, desc: <>C# <strong>brings async/await to the mainstream</strong>: a state-machine rewrite of continuation passing that reads like synchronous code. <a href="/code/language/ts">TypeScript</a> copies it three years later, JavaScript (ES2017) five years later, then Python, Rust, Swift all follow — <em>this is C#'s single biggest gift to the industry</em>.</> },
  },
  {
    year: <>2014<small>·04·03</small></>, highlight: true,
    zh: { title: <>Roslyn 开源 — 编译器即服务</>, desc: <>Microsoft Build 大会: <strong>整个 C# / VB.NET 编译器开源</strong> (Apache 2.0), 项目代号 Roslyn。"compiler-as-a-service" API 让 IDE、linter、code fix 第一次能复用官方语法树。<em>同一年, Satya Nadella 上任 CEO; 微软对开源的态度发生 180 度转向, 这是第一炮</em>。</> },
    en: { title: <>Roslyn open-sourced — the compiler as a service</>, desc: <>At Build 2014, <strong>the entire C# / VB.NET compiler goes open source</strong> (Apache 2.0), codenamed Roslyn. Its "compiler-as-a-service" API lets IDEs, linters and code-fixers reuse the official syntax tree for the first time. <em>The same year Satya Nadella takes over as CEO and Microsoft pivots 180 degrees on open source — this is the opening shot</em>.</> },
  },
  {
    year: <>2014<small>·11·12</small></>, highlight: true,
    zh: { title: <>.NET Core 宣布 — 跨平台 + 开源</>, desc: <>Connect(); 2014 大会: <strong>.NET Core 正式立项</strong>, MIT 许可, GitHub 公开, 目标 Windows / Linux / macOS。"Microsoft loves Linux"——Nadella 那条标语就是从这里开始的。<em>对 C# 来说: 终于不是 Windows 语言了</em>。</> },
    en: { title: <>.NET Core announced — cross-platform, open source</>, desc: <>At Connect(); 2014, <strong>.NET Core is officially launched</strong>: MIT licence, public on GitHub, targets Windows / Linux / macOS. "Microsoft loves Linux" — Nadella's slogan is born here. <em>For C# it means one thing: it is no longer a Windows language</em>.</> },
  },
  {
    year: <>2016<small>·06·27</small></>,
    zh: { title: <>.NET Core 1.0 GA + Xamarin 收购</>, desc: <>.NET Core 1.0 正式 release; 同年 2 月 Microsoft <strong>收购 Xamarin (Mono 的商业母公司)</strong>, Miguel de Icaza 进微软, Mono / Xamarin runtime 在公司内被吸收。<em>.NET 跨平台故事的两条线在这一年汇成一条</em>。</> },
    en: { title: <>.NET Core 1.0 GA + Xamarin acquisition</>, desc: <>.NET Core 1.0 ships. Earlier that February, Microsoft <strong>acquires Xamarin (the commercial parent of Mono)</strong>; Miguel de Icaza moves in-house, and the Mono / Xamarin runtimes are absorbed. <em>The two cross-platform tracks of .NET merge into one this year</em>.</> },
  },
  {
    year: <>2019<small>·09</small></>,
    zh: { title: <>C# 8.0 — nullable reference types + async streams</>, desc: <><strong>nullable reference types</strong> 在编译期把"NullReferenceException 之母"问题挡掉 (opt-in: <code>#nullable enable</code>); <code>IAsyncEnumerable&lt;T&gt;</code> + <code>await foreach</code> 把 async + iterator 焊在一起。<em>静态类型在工程上又往前一格</em>。</> },
    en: { title: <>C# 8.0 — nullable reference types + async streams</>, desc: <><strong>Nullable reference types</strong> catch "mother of all NullReferenceExceptions" at compile time (opt-in via <code>#nullable enable</code>); <code>IAsyncEnumerable&lt;T&gt;</code> + <code>await foreach</code> welds async to iterators. <em>Static typing takes one more practical step forward</em>.</> },
  },
  {
    year: <>2020<small>·11·10</small></>, highlight: true,
    zh: { title: <>.NET 5 — 三条线终于合并</>, desc: <>.NET Framework (Windows 经典) + .NET Core (跨平台) + Mono / Xamarin 三条线汇成<strong>一个 .NET</strong>。版本号跳过 4 (避开和 Framework 4.x 撞), 单 SDK, 单 runtime 家族。<em>这是 18 年来 .NET 的最大一次单步整合</em>。</> },
    en: { title: <>.NET 5 — three forks finally merge</>, desc: <>.NET Framework (classic Windows) + .NET Core (cross-platform) + Mono / Xamarin all collapse into <strong>a single .NET</strong>. Version 4 is skipped to avoid clashing with Framework 4.x. One SDK, one runtime family. <em>The biggest single-step consolidation .NET has had in 18 years</em>.</> },
  },
  {
    year: <>2020<small>·11</small></>,
    zh: { title: <>C# 9.0 — records / top-level / pattern matching</>, desc: <><code>record</code> 类型: 一行不可变值对象 + 自动 <code>Equals</code> / <code>GetHashCode</code>; top-level statements 让 hello world 变成两行; pattern matching 进入第二代 (<code>{'is { Prop: 1, Other: > 0 }'}</code>)。<em>C# 开始有"现代 ML 系语言"的味道</em>。</> },
    en: { title: <>C# 9.0 — records / top-level / pattern matching</>, desc: <><code>record</code> types: an immutable value object with auto <code>Equals</code> / <code>GetHashCode</code> in one line; top-level statements compress hello world to two lines; second-generation pattern matching (<code>{'is { Prop: 1, Other: > 0 }'}</code>). <em>C# starts to taste like a modern ML-flavoured language</em>.</> },
  },
  {
    year: <>2022<small>·11</small></>,
    zh: { title: <>.NET 7 — Native AOT (preview)</>, desc: <>Native AOT 把 .NET app 编译成<strong>单个 native binary</strong>, 无 JIT / 启动毫秒级 / 镜像更小——直对 Go 抢"<em>小服务 / CLI / container-first</em>"的地盘。语言不变, runtime 形态变了。</> },
    en: { title: <>.NET 7 — Native AOT (preview)</>, desc: <>Native AOT compiles a .NET app to <strong>a single native binary</strong>: no JIT, millisecond startup, smaller images — a direct play for Go's "<em>small services, CLIs, container-first</em>" territory. The language stays put; the runtime shape changes.</> },
  },
  {
    year: <>2023<small>·11·14</small></>, highlight: true,
    zh: { title: <>.NET 8 LTS — Native AOT GA · Blazor 全栈</>, desc: <>Native AOT 转 GA, ASP.NET Core Minimal API 完全支持; <strong>Blazor United</strong> 把 Server / WebAssembly 渲染模式合一, C# 可以从前端写到后端一条线。<em>LTS 版本, 这是过去 5 年企业大规模升级的真正基准</em>。</> },
    en: { title: <>.NET 8 LTS — Native AOT GA · Blazor full-stack</>, desc: <>Native AOT goes GA with full support in ASP.NET Core Minimal API; <strong>Blazor United</strong> unifies Server and WebAssembly rendering modes, letting one C# code path run end-to-end. <em>LTS — the version most enterprises actually base their migrations on for the next half-decade</em>.</> },
  },
  {
    year: <>2024<small>·11·12</small></>,
    zh: { title: <>.NET 9 — params collections / Span 提速</>, desc: <><code>params ReadOnlySpan&lt;T&gt;</code>: 调可变参数函数<strong>零分配</strong>; LINQ 的若干 hot path 改写, JIT 对 SIMD / loop unroll 更激进。<em>这是 "<strong>把 .NET 调到能跟 Rust 单核打</strong>" 这条路上的标志性一步</em>。</> },
    en: { title: <>.NET 9 — params collections / Span perf</>, desc: <><code>params ReadOnlySpan&lt;T&gt;</code> makes variadic calls <strong>zero-allocation</strong>; multiple LINQ hot paths get rewritten and the JIT pushes harder on SIMD and loop unrolling. <em>Another marker on the road of "<strong>tuning .NET until single-core perf goes head-to-head with Rust</strong>"</em>.</> },
  },
  {
    year: <>2025<small>·11·11</small></>, highlight: true,
    zh: { title: <>.NET 10 LTS — 当前的稳态</>, desc: <>新 LTS, C# 14: <code>field</code> 关键字让 property 写 backing-field 不再要手写; <code>extension</code> 类型预告 (Hejlsberg 当年 LINQ 的扩展方法 v2)。<strong>Native AOT 默认开启对部分模板</strong>, 容器镜像继续缩。Unity 6.1 跟上 .NET 9 LTS。<em>2026 年企业生产线就坐在这版上</em>。</> },
    en: { title: <>.NET 10 LTS — the present steady state</>, desc: <>New LTS, C# 14: the <code>field</code> keyword removes the boilerplate of manual backing fields for properties; <code>extension</code> types preview (Hejlsberg's extension methods v2 from the LINQ era). <strong>Native AOT becomes default in several templates</strong>, container images keep shrinking. Unity 6.1 catches up to .NET 9 LTS. <em>2026 enterprise production lines sit on this</em>.</> },
  },
  {
    year: '2026',
    zh: { title: <>26 岁 — top-5 全球, 企业 + 游戏 + 跨平台</>, desc: <>2026 年的 C# 现状: TIOBE / IEEE / RedMonk 长期<strong>top-5</strong>; 企业后端 (尤其北美 + 欧洲) 是稳态主力; <strong>Unity 仍是游戏行业 #1 脚本语言</strong> (大量统计长期给到 60–70% in-use rate); MAUI 让"一个 C# 写 4 个 OS"成为现实; Blazor / WASM 在前端继续上量。<em>Hejlsberg 自己 2012 已经把重心移向 <a href="/code/language/ts">TypeScript</a>, 但 C# 的产线已经能自跑</em>。</> },
    en: { title: <>26 years in — global top-5, enterprise + games + cross-platform</>, desc: <>C# in 2026: long-time <strong>top-5</strong> on TIOBE / IEEE / RedMonk; the steady backbone of enterprise back ends, especially in North America and Europe; <strong>Unity remains the #1 scripting language in the games industry</strong> (most surveys hover at a 60–70% in-use rate); MAUI delivers "one C# codebase, four OSes"; Blazor / WASM keeps climbing on the front end. <em>Hejlsberg shifted focus to <a href="/code/language/ts">TypeScript</a> back in 2012, but C# now sustains itself</em>.</> },
  },
];

interface CsCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const CS_CARDS: CsCard[] = [
  {
    tag: 'A',
    zh: { title: <>LINQ — <code>from / where / select</code></>, desc: <>LINQ 在 2007 年把<strong>查询语法塞进语言</strong>: 同一套 <code>where</code> / <code>select</code> / <code>group by</code>, 既能跑在内存中的 <code>List&lt;T&gt;</code>, 也能 translate 成 SQL 给 EF Core。<em>这是 C# 跟所有 Java/C++ 同辈拉开身位的那一脚</em>。</> },
    en: { title: <>LINQ — <code>from / where / select</code></>, desc: <>In 2007, LINQ pushed <strong>query syntax into the language itself</strong>: one <code>where</code> / <code>select</code> / <code>group by</code> set runs over in-memory <code>List&lt;T&gt;</code>, and translates to SQL via Entity Framework Core. <em>The move that pulled C# clear of its Java / C++ contemporaries</em>.</> },
    code: (
      <code>
        <span className="cl-k">var</span> adults = <span className="cl-k">from</span> p <span className="cl-k">in</span> people{'\n'}
        {'              '}<span className="cl-k">where</span> p.Age &gt;= <span className="cl-n">18</span>{'\n'}
        {'              '}<span className="cl-k">orderby</span> p.Name{'\n'}
        {'              '}<span className="cl-k">select</span> <span className="cl-k">new</span> {'{ '}p.Name, p.Age{' }'};{'\n\n'}
        <span className="cl-c">// fluent shape — same thing, no query syntax</span>{'\n'}
        <span className="cl-k">var</span> adults2 = people{'\n'}
        {'    '}.<span className="cl-fn">Where</span>(p =&gt; p.Age &gt;= <span className="cl-n">18</span>){'\n'}
        {'    '}.<span className="cl-fn">OrderBy</span>(p =&gt; p.Name){'\n'}
        {'    '}.<span className="cl-fn">Select</span>(p =&gt; <span className="cl-k">new</span> {'{ '}p.Name, p.Age{' }'});
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>async</code> / <code>await</code> — C# 的世界级输出</>, desc: <>2012 年 C# 5 第一次把 async/await 推到工业语言。<strong>看起来同步、底下是 state machine</strong>, 异步 IO 写起来跟同步无差。<em><a href="/code/language/ts">TypeScript</a> → JS → Python → Rust → Swift 都跟着抄</em>。</> },
    en: { title: <><code>async</code> / <code>await</code> — C#'s industry export</>, desc: <>C# 5 in 2012 brought async/await to a mainstream industrial language. <strong>It reads synchronously; underneath it's a state machine</strong>. Async I/O looks like sync I/O. <em><a href="/code/language/ts">TypeScript</a> → JS → Python → Rust → Swift all copied it</em>.</> },
    code: (
      <code>
        <span className="cl-k">async</span> <span className="cl-type">Task</span>&lt;<span className="cl-type">string</span>&gt; <span className="cl-fn">FetchAsync</span>(<span className="cl-type">string</span> url){'\n'}
        {'{'}{'\n'}
        {'    '}<span className="cl-k">using</span> <span className="cl-k">var</span> http = <span className="cl-k">new</span> <span className="cl-type">HttpClient</span>();{'\n'}
        {'    '}<span className="cl-k">var</span> resp = <span className="cl-k">await</span> http.<span className="cl-fn">GetAsync</span>(url);{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-k">await</span> resp.Content.<span className="cl-fn">ReadAsStringAsync</span>();{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>record</code> — 一行不可变值对象</>, desc: <>C# 9 (2020) 加的: <code>record</code> 给一行声明就自动来 <strong>Equals / GetHashCode / ToString / with-expression</strong>, value semantics 由 CLR 帮你算。<em>Kotlin <code>data class</code> 同档</em>。</> },
    en: { title: <><code>record</code> — immutable value object in one line</>, desc: <>C# 9 (2020): a single <code>record</code> declaration gives you <strong>Equals / GetHashCode / ToString / with-expressions</strong> for free, with value semantics handled by the CLR. <em>The peer to Kotlin's <code>data class</code></em>.</> },
    code: (
      <code>
        <span className="cl-k">public record</span> <span className="cl-type">Point</span>(<span className="cl-type">double</span> X, <span className="cl-type">double</span> Y);{'\n\n'}
        <span className="cl-k">var</span> a = <span className="cl-k">new</span> <span className="cl-type">Point</span>(<span className="cl-n">1</span>, <span className="cl-n">2</span>);{'\n'}
        <span className="cl-k">var</span> b = a <span className="cl-k">with</span> {'{ '}Y = <span className="cl-n">3</span>{' }'};{'\n'}
        <span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>(a == <span className="cl-k">new</span> <span className="cl-type">Point</span>(<span className="cl-n">1</span>,<span className="cl-n">2</span>)); <span className="cl-c">// True</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Pattern matching — 不止 switch</>, desc: <>C# 7 起的 switch expression + property pattern + relational pattern: <strong>switch 已不是分支语句, 是<em>表达式</em></strong>。配合 <code>record</code> 能写出近乎 ML / F# 的代数风格。</> },
    en: { title: <>Pattern matching — not just switch</>, desc: <>From C# 7 onward: switch expressions, property patterns, relational patterns. <strong>Switch is no longer a branching statement; it's an <em>expression</em></strong>. Combined with <code>record</code> you can write near-ML / F# style algebraic code.</> },
    code: (
      <code>
        <span className="cl-k">string</span> <span className="cl-fn">Classify</span>(<span className="cl-type">Point</span> p) =&gt; p <span className="cl-k">switch</span>{'\n'}
        {'{'}{'\n'}
        {'    '}(<span className="cl-n">0</span>, <span className="cl-n">0</span>)               =&gt; <span className="cl-s">"origin"</span>,{'\n'}
        {'    '}(<span className="cl-k">var</span> x, <span className="cl-n">0</span>)           =&gt; $<span className="cl-s">"x-axis @ {'{'}x{'}'}"</span>,{'\n'}
        {'    '}{'{ '}X: &gt; <span className="cl-n">0</span>, Y: &gt; <span className="cl-n">0</span> {'}'} =&gt; <span className="cl-s">"Q1"</span>,{'\n'}
        {'    '}_                    =&gt; <span className="cl-s">"elsewhere"</span>{'\n'}
        {'}'};
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Top-level statements — Hello world 两行</>, desc: <>C# 9 起, 文件第一行可以直接 <code>Console.WriteLine</code>, 不用 <code>class Program</code> + <code>static void Main</code>。<em>"<strong>给学生看的 first program</strong>"和 Python / JS 终于站到同一起跑线</em>。</> },
    en: { title: <>Top-level statements — two-line hello world</>, desc: <>From C# 9 a file can open with <code>Console.WriteLine</code> directly — no <code>class Program</code>, no <code>static void Main</code>. <em>The "<strong>first program a student sees</strong>" finally stands at the same starting line as Python or JS</em>.</> },
    code: (
      <code>
        <span className="cl-c">// Program.cs — the entire app</span>{'\n'}
        <span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>(<span className="cl-s">"Hello, C#"</span>);{'\n'}
        <span className="cl-k">var</span> name = <span className="cl-fn">Console</span>.<span className="cl-fn">ReadLine</span>();{'\n'}
        <span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>($<span className="cl-s">"Hi, {'{'}name{'}'}!"</span>);
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Nullable reference types</>, desc: <>opt-in <code>#nullable enable</code> 后, <code>string?</code> 跟 <code>string</code> 在编译期就是<strong>两个类型</strong>, 解引用前不检查直接编译报错。<em>把 NullReferenceException 这个 26 年老梗拆掉一半</em>。</> },
    en: { title: <>Nullable reference types</>, desc: <>Opt into <code>#nullable enable</code> and <code>string?</code> versus <code>string</code> become <strong>two different types</strong> at compile time; dereferencing without a check is a build error. <em>Cuts the 26-year-old NullReferenceException joke in half</em>.</> },
    code: (
      <code>
        <span className="cl-k">#nullable enable</span>{'\n\n'}
        <span className="cl-type">string</span>? <span className="cl-fn">Find</span>(<span className="cl-type">int</span> id) =&gt; <span className="cl-k">null</span>;{'\n\n'}
        <span className="cl-k">var</span> n = <span className="cl-fn">Find</span>(<span className="cl-n">7</span>);{'\n'}
        <span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>(n.<span className="cl-fn">Length</span>);   <span className="cl-c">// warn: possibly null</span>{'\n'}
        <span className="cl-k">if</span> (n <span className="cl-k">is not null</span>){'\n'}
        {'    '}<span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>(n.<span className="cl-fn">Length</span>); <span className="cl-c">// fine, flow-typed</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <><code>Span&lt;T&gt;</code> — 零分配栈缓冲</>, desc: <><code>Span&lt;T&gt;</code> / <code>Memory&lt;T&gt;</code> (.NET Core 2.1 起) 是 C# 的"<strong>系统编程出口</strong>": 栈上、零分配, 切片 string / byte 不拷贝。<em>2026 年大多 hot-path JSON parser、HTTP framing 都建在它上面</em>。</> },
    en: { title: <><code>Span&lt;T&gt;</code> — zero-alloc stack buffer</>, desc: <><code>Span&lt;T&gt;</code> / <code>Memory&lt;T&gt;</code> (since .NET Core 2.1) are C#'s <strong>systems-programming off-ramp</strong>: stack-allocated, zero-alloc, slice a string / byte buffer without copying. <em>By 2026 most hot-path JSON parsers and HTTP framing code is built on them</em>.</> },
    code: (
      <code>
        <span className="cl-k">static int</span> <span className="cl-fn">SumDigits</span>(<span className="cl-type">ReadOnlySpan</span>&lt;<span className="cl-type">char</span>&gt; s){'\n'}
        {'{'}{'\n'}
        {'    '}<span className="cl-k">int</span> sum = <span className="cl-n">0</span>;{'\n'}
        {'    '}<span className="cl-k">foreach</span> (<span className="cl-k">var</span> c <span className="cl-k">in</span> s) sum += c - <span className="cl-s">'0'</span>;{'\n'}
        {'    '}<span className="cl-k">return</span> sum;{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-fn">SumDigits</span>(<span className="cl-s">"12345"</span>.<span className="cl-fn">AsSpan</span>(<span className="cl-n">1</span>, <span className="cl-n">3</span>)); <span className="cl-c">// no alloc</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Source generators — 编译期元编程</>, desc: <>2020 起 Roslyn 提供 <strong>source generator</strong> API: 编译期读 AST → 生成新源文件 → 一起编译。<em>取代旧的 IL weaving 与运行时反射的 hot-path 代码</em>; JSON / gRPC / Regex / DI 框架都靠它把"反射税"零化。</> },
    en: { title: <>Source generators — compile-time metaprogramming</>, desc: <>From 2020, Roslyn exposes a <strong>source generator</strong> API: read the AST at compile time, emit new source files, compile together. <em>Replaces the old IL-weaving and runtime-reflection style for hot paths</em>; JSON, gRPC, Regex and DI frameworks all use it to zero the reflection tax.</> },
    code: (
      <code>
        <span className="cl-c">// JSON serializer, compile-time generated</span>{'\n'}
        [<span className="cl-attr">JsonSerializable</span>(<span className="cl-k">typeof</span>(<span className="cl-type">Point</span>))]{'\n'}
        <span className="cl-k">partial class</span> <span className="cl-type">MyJsonCtx</span> : <span className="cl-type">JsonSerializerContext</span> {'{ }'}{'\n\n'}
        <span className="cl-k">var</span> json = <span className="cl-type">JsonSerializer</span>.<span className="cl-fn">Serialize</span>({'\n'}
        {'    '}<span className="cl-k">new</span> <span className="cl-type">Point</span>(<span className="cl-n">1</span>, <span className="cl-n">2</span>), <span className="cl-type">MyJsonCtx</span>.Default.Point);
      </code>
    ),
  },
];

interface WhyCard {
  icon: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const WHY_CARDS: WhyCard[] = [
  {
    icon: '#',
    zh: { title: <>三条战线都站住</>, desc: <>很少有语言能<strong>同时</strong>在企业后端、游戏、跨平台移动端都是主力——C# 是。<strong>ASP.NET Core</strong> (企业 API)、<strong>Unity</strong> (~70% in-use 游戏行业)、<strong>MAUI / Avalonia</strong> (跨四个 OS), 一门语言全部覆盖。</> },
    en: { title: <>Holds three fronts at once</>, desc: <>Few languages anchor enterprise back ends, games and cross-platform mobile <strong>simultaneously</strong> — C# does. <strong>ASP.NET Core</strong> for enterprise APIs, <strong>Unity</strong> (~70% in-use across the games industry), <strong>MAUI / Avalonia</strong> across four OSes — one language, all three.</> },
    code: <><span className="cl-c">// asp.net core minimal api</span>{'\n'}<span className="cl-k">var</span> app = <span className="cl-type">WebApplication</span>.<span className="cl-fn">Create</span>(args);{'\n'}app.<span className="cl-fn">MapGet</span>(<span className="cl-s">"/"</span>, () =&gt; <span className="cl-s">"hi"</span>);{'\n'}app.<span className="cl-fn">Run</span>();</>,
  },
  {
    icon: '::',
    zh: { title: <>JIT + AOT + Native — 三种发布形态</>, desc: <>同一份 C# 可以 <strong>JIT (默认)</strong> 跑长寿服务、<strong>Tiered JIT</strong> 在 hot 路径再编译, 也能 <strong>Native AOT</strong> 出单 binary 拼 Go 启动速度。<em>这套 runtime 形态可选性, Java / Kotlin / Go 都没全</em>。</> },
    en: { title: <>JIT + AOT + Native — three deployment shapes</>, desc: <>One C# codebase can run as <strong>JIT (default)</strong> for long-lived services, <strong>Tiered JIT</strong> that recompiles hot paths, or <strong>Native AOT</strong> to a single binary with Go-class startup. <em>Java, Kotlin and Go each ship only part of this matrix</em>.</> },
    code: <><span className="cl-c"># build a tiny single-file native binary</span>{'\n'}<span className="cl-c">$ dotnet publish -c Release \</span>{'\n'}<span className="cl-c">    /p:PublishAot=true \</span>{'\n'}<span className="cl-c">    /p:StripSymbols=true</span></>,
  },
  {
    icon: '@',
    zh: { title: <>Roslyn — 编译器即服务</>, desc: <>2014 微软<strong>把 C# / VB.NET 整个编译器开源</strong>, 给的是 API 不是黑盒。每一条 squiggle、每一条 quick-fix、每一个 source generator 都是站在 Roslyn 上的<strong>第三方插件</strong>。<em>JetBrains Rider 跟 VS Code C# Dev Kit 都借这一手立起来</em>。</> },
    en: { title: <>Roslyn — compiler as a service</>, desc: <>In 2014 Microsoft <strong>open-sourced the entire C# / VB.NET compiler</strong> as an API, not a black box. Every squiggle, quick-fix and source generator is a <strong>third-party plugin riding on Roslyn</strong>. <em>JetBrains Rider and the VS Code C# Dev Kit are both built off this hand</em>.</> },
    code: <><span className="cl-c">// roslyn API, in C# itself</span>{'\n'}<span className="cl-k">var</span> tree = <span className="cl-type">CSharpSyntaxTree</span>.<span className="cl-fn">ParseText</span>(src);{'\n'}<span className="cl-k">var</span> root = <span className="cl-fn">await</span> tree.<span className="cl-fn">GetRootAsync</span>();{'\n'}<span className="cl-k">foreach</span> (<span className="cl-k">var</span> m <span className="cl-k">in</span> root.<span className="cl-fn">DescendantNodes</span>()) ...</>,
  },
  {
    icon: '&',
    zh: { title: <>Hejlsberg 履历 — 4 门语言 4 个时代</>, desc: <><strong>Turbo Pascal (1983) → Delphi (1995) → C# (2000) → <a href="/code/language/ts">TypeScript</a> (2012)</strong>。每一门都<strong>定义了一个时代的工具</strong>; 同一个人, 横跨 40 年的工业语言史——<em>这种连续战绩在语言设计圈是孤本</em>。</> },
    en: { title: <>Hejlsberg's track record — 4 languages, 4 eras</>, desc: <><strong>Turbo Pascal (1983) → Delphi (1995) → C# (2000) → <a href="/code/language/ts">TypeScript</a> (2012)</strong>. Each <strong>defined its era's tooling</strong>; one person spans 40 years of industrial language history — <em>a track record without peer in the field</em>.</> },
    code: <><span className="cl-c">// 1983  Turbo Pascal   — IDE + compiler for $49</span>{'\n'}<span className="cl-c">// 1995  Delphi         — RAD on Windows</span>{'\n'}<span className="cl-c">// 2000  C#             — managed code for the masses</span>{'\n'}<span className="cl-c">// 2012  TypeScript     — types for JavaScript</span></>,
  },
  {
    icon: '$',
    zh: { title: <>赚钱的语言</>, desc: <>2026 年 C# / .NET 在<strong>北美 + 欧洲 + 印度</strong>的招聘需求里跟 Java 同档, 平均薪资在<strong>所有静态语言里只比 Rust / Go 略低</strong>。Stack Overflow 调查多年 "<em>最常用 + 最高薪</em>" 重叠区。<em>不是 hype 语言, 是工资语言</em>。</> },
    en: { title: <>A paycheck language</>, desc: <>By 2026 C# / .NET sits alongside Java in hiring demand across <strong>North America, Europe and India</strong>, with average salaries <strong>only slightly behind Rust and Go among statically-typed languages</strong>. Stack Overflow's "<em>most-used × highest-paid</em>" overlap year after year. <em>Not a hype language; a paycheck language</em>.</> },
    code: <><span className="cl-c">// stackoverflow survey · 2024</span>{'\n'}<span className="cl-c">// C#  — top-5 most used · top-10 paid</span>{'\n'}<span className="cl-c">// .NET — top-3 web framework cohort</span></>,
  },
];

interface Project {
  href: string;
  zhName: string;
  enName: string;
  zhNote: string;
  enNote: string;
  highlight?: boolean;
  svg: ReactNode;
}

const PROJECTS: Project[] = [
  {
    href: 'https://unity.com', highlight: true,
    zhName: 'Unity', enName: 'Unity',
    zhNote: '游戏引擎 #1 · C# 脚本', enNote: '#1 game engine · C# scripting',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M50 18 L82 36 L82 64 L50 82 L18 64 L18 36 Z" stroke="#fff" strokeWidth="3" fill="none"/><path d="M50 18 V46 L26 60 M50 82 V54 L74 40 M18 36 L42 50 L18 64" stroke="#fff" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://dotnet.microsoft.com', highlight: true,
    zhName: '.NET', enName: '.NET',
    zhNote: 'Microsoft · CLR / BCL / SDK', enNote: 'Microsoft · CLR / BCL / SDK',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#512BD4"/><text x="50" y="60" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="monospace">.NET</text></svg>,
  },
  {
    href: 'https://github.com/dotnet/aspnetcore', highlight: true,
    zhName: 'ASP.NET Core', enName: 'ASP.NET Core',
    zhNote: '企业级 web · API · gRPC', enNote: 'Enterprise web · API · gRPC',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0826"/><circle cx="50" cy="50" r="22" fill="none" stroke="#8C66F2" strokeWidth="4"/><path d="M28 50 H72 M50 28 V72" stroke="#8C66F2" strokeWidth="3" strokeDasharray="3 3"/></svg>,
  },
  {
    href: 'https://github.com/dotnet/maui',
    zhName: '.NET MAUI', enName: '.NET MAUI',
    zhNote: 'iOS / Android / mac / Win', enNote: 'iOS / Android / mac / Win',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0E2E"/><rect x="22" y="28" width="20" height="44" rx="3" fill="none" stroke="#8C66F2" strokeWidth="3"/><rect x="50" y="28" width="32" height="32" rx="3" fill="none" stroke="#8C66F2" strokeWidth="3"/><rect x="50" y="64" width="32" height="8" rx="2" fill="#8C66F2"/></svg>,
  },
  {
    href: 'https://github.com/dotnet/aspnetcore/tree/main/src/Components',
    zhName: 'Blazor', enName: 'Blazor',
    zhNote: 'C# 跑 WebAssembly', enNote: 'C# in the browser via WASM',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#512BD4"/><path d="M30 30 L70 30 L70 50 L50 50 L50 70 L30 70 Z" fill="#fff"/><circle cx="68" cy="68" r="10" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/microsoft/vscode',
    zhName: 'VS Code', enName: 'VS Code',
    zhNote: 'Electron + TS · C# Dev Kit', enNote: 'Electron + TS · C# Dev Kit',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0078D4"/><path d="M68 18 L82 24 L82 76 L68 82 L30 56 L20 64 L16 60 L26 50 L16 40 L20 36 L30 44 L68 18 Z M68 32 L42 50 L68 68 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://github.com/PowerShell/PowerShell',
    zhName: 'PowerShell', enName: 'PowerShell',
    zhNote: '跨平台 shell · C# 写的', enNote: 'Cross-platform shell · written in C#',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#012456"/><text x="50" y="58" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">PS &gt;_</text></svg>,
  },
  {
    href: 'https://stackoverflow.com',
    zhName: 'Stack Overflow', enName: 'Stack Overflow',
    zhNote: '一直跑在 .NET / IIS', enNote: 'Famously runs on .NET / IIS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1B1B1B"/><path d="M30 70 H70 V64 H30 Z M32 56 L68 60 L67 54 L31 50 Z M36 42 L70 50 L71 44 L37 36 Z M42 30 L72 42 L74 36 L44 24 Z" fill="#F48024"/></svg>,
  },
  {
    href: 'https://github.com/JetBrains/Rider',
    zhName: 'Rider', enName: 'Rider',
    zhNote: 'JetBrains · 跨平台 IDE', enNote: 'JetBrains · cross-platform IDE',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M22 22 L46 22 L46 78 L22 78 Z M52 22 L78 22 L78 50 L52 50 Z" fill="#C90F5E"/><path d="M52 56 L78 56 L78 78 L52 78 Z" fill="#FCF84A"/></svg>,
  },
  {
    href: 'https://github.com/dotnet/efcore',
    zhName: 'EF Core', enName: 'EF Core',
    zhNote: 'ORM · LINQ → SQL', enNote: 'ORM · LINQ → SQL',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0826"/><ellipse cx="50" cy="32" rx="22" ry="8" fill="none" stroke="#8C66F2" strokeWidth="3"/><path d="M28 32 V58 C28 64 38 68 50 68 C62 68 72 64 72 58 V32" fill="none" stroke="#8C66F2" strokeWidth="3"/><line x1="28" y1="48" x2="72" y2="48" stroke="#8C66F2" strokeWidth="2" strokeDasharray="2 3"/></svg>,
  },
  {
    href: 'https://github.com/AvaloniaUI/Avalonia',
    zhName: 'Avalonia', enName: 'Avalonia',
    zhNote: '社区跨平台 GUI · WPF 继承者', enNote: 'Cross-platform GUI · WPF heir',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F0F1A"/><path d="M50 18 L82 78 L18 78 Z" fill="none" stroke="#8C66F2" strokeWidth="4"/><circle cx="50" cy="56" r="6" fill="#8C66F2"/></svg>,
  },
  {
    href: 'https://github.com/dotnet/roslyn',
    zhName: 'Roslyn', enName: 'Roslyn',
    zhNote: 'C# / VB 编译器 · 开源 2014', enNote: 'C# / VB compiler · OSS since 2014',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0E2E"/><text x="50" y="58" textAnchor="middle" fill="#8C66F2" fontSize="16" fontWeight="700" fontFamily="monospace">{`{ }`}</text></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'dotnet CLI',     zhDesc: '官方 build / run / test',         enDesc: 'Official build / run / test' },
  { name: 'NuGet',          zhDesc: '包管理器 · 6M+ 包',                enDesc: 'Package manager · 6M+ pkgs' },
  { name: 'Roslyn',         zhDesc: '官方 C# 编译器',                   enDesc: 'Official C# compiler' },
  { name: 'Native AOT',     zhDesc: '编译到 single binary',             enDesc: 'Compile to single binary' },
  { name: 'ASP.NET Core',   zhDesc: 'Web · API · gRPC · SignalR',       enDesc: 'Web · API · gRPC · SignalR' },
  { name: 'EF Core',        zhDesc: 'LINQ-driven ORM',                  enDesc: 'LINQ-driven ORM' },
  { name: 'Blazor',         zhDesc: 'WASM · Server · United',           enDesc: 'WASM · Server · United' },
  { name: 'MAUI',           zhDesc: '4-OS UI · Xamarin 继承者',         enDesc: '4-OS UI · Xamarin heir' },
  { name: 'xUnit · NUnit',  zhDesc: '测试框架双星',                     enDesc: 'Test framework duo' },
  { name: 'BenchmarkDotNet',zhDesc: '微基准事实标准',                   enDesc: 'Microbench de-facto standard' },
  { name: 'Serilog',        zhDesc: '结构化日志主力',                   enDesc: 'Structured logging mainstay' },
  { name: 'Polly',          zhDesc: 'retry / circuit-break',            enDesc: 'Retry / circuit-break' },
];

interface FutureCard {
  tag: ReactNode;
  hot?: boolean;
  big?: boolean;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const FUTURE_CARDS: FutureCard[] = [
  {
    tag: <>HOT · 2026+</>, hot: true, big: true,
    zh: {
      title: <>Native AOT 全线 — Go / Rust 的小服务地盘</>,
      body: (<>
        <p>.NET 8 起 Native AOT 转 GA, .NET 10 在多个官方模板里默认开启。<strong>启动从秒级降到毫秒级</strong>, 镜像从 ~70 MB 降到 ~10 MB, GC 还在但<strong>不分大 generation</strong>。</p>
        <p>含义: C# 第一次能<strong>正面拼 Go / Rust 在 container-first 微服务领域</strong>。大企业的 ASP.NET Core API + Lambda / Cloud Run 部署正在大规模迁过来——<em>不是替代 JIT, 是给"小、快、冷启动" 那一类应用补上一条路径</em>。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="JIT 启动 (.NET 7)" en="JIT cold start (.NET 7)" /></span><span className="bar-val">~700 ms</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="Native AOT (.NET 10)" en="Native AOT (.NET 10)" /></span><span className="bar-val">~20 ms</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Native AOT everywhere — coming for Go / Rust microservices</>,
      body: (<>
        <p>Native AOT went GA in .NET 8 and ships on-by-default in several .NET 10 templates. <strong>Startup drops from seconds to milliseconds</strong>, image size from ~70 MB to ~10 MB, and the GC is still there but <strong>without big generation pauses</strong>.</p>
        <p>What it means: C# can finally <strong>compete head-on with Go / Rust on container-first microservices</strong>. Big-shop ASP.NET Core APIs deployed to Lambda / Cloud Run are migrating in bulk — <em>not a replacement for JIT, just a new lane for "small, fast, cold-start" apps</em>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">JIT cold start (.NET 7)</span><span className="bar-val">~700 ms</span></div>
          <div className="bar bar-new"><span className="bar-label">Native AOT (.NET 10)</span><span className="bar-val">~20 ms</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'BLAZOR',
    zh: { title: <>Blazor United — C# 写全栈</>, body: <><p>.NET 8 起 Blazor 把 <strong>Server (SignalR over WebSocket)</strong> 和 <strong>WebAssembly (浏览器内 .NET)</strong> 两种渲染模式合一: 同一个 component, 服务端先渲染、客户端再 hydrate。<em>架构上接近 Next.js / Nuxt RSC, 但是 C#</em>。</p><p>意义: 不再"前端 TS + 后端 C#"两套, 一份 codebase 端到端。<strong>受众: 已经在 .NET 栈、不想再多养一个 JS 团队的企业</strong>。</p></> },
    en: { title: <>Blazor United — full-stack in C#</>, body: <><p>From .NET 8, Blazor merges its two rendering modes — <strong>Server (SignalR over WebSocket)</strong> and <strong>WebAssembly (.NET in the browser)</strong>. Components render server-side first, then hydrate client-side. <em>Architecturally close to Next.js / Nuxt with RSC, but in C#</em>.</p><p>Why it matters: no more "TS on the front, C# on the back" split — one codebase end-to-end. <strong>Audience: orgs already on the .NET stack who don't want to maintain a second JS team</strong>.</p></> },
  },
  {
    tag: 'MAUI',
    zh: { title: <>MAUI — 一份代码 4 个 OS</>, body: <><p>.NET MAUI = Xamarin.Forms 的继承者。<strong>iOS / Android / macOS (Catalyst) / Windows</strong> 一份 XAML + C# 出包。2024–2026 经历两轮"<em>稳定性整改</em>", 2026 年终于到能<strong>产线用</strong>的阶段。</p><p>对手: Flutter (Dart) / React Native (TS) / Avalonia (社区 C#)。<em>MAUI 的优势是<strong>"我已经会 C#"</strong>那一类工程师</em>, 不是 "新人入门容易"。</p></> },
    en: { title: <>MAUI — one codebase, four OSes</>, body: <><p>.NET MAUI is the Xamarin.Forms heir: one XAML + C# project building for <strong>iOS / Android / macOS (Catalyst) / Windows</strong>. Two rounds of "<em>stability cleanup</em>" through 2024–2026 finally bring it to <strong>production-ready</strong>.</p><p>Rivals: Flutter (Dart), React Native (TS), Avalonia (community C#). <em>MAUI's edge is the <strong>"I already know C#"</strong> engineer</em>, not "easy for newcomers."</p></> },
  },
  {
    tag: 'GAMES',
    zh: { title: <>Unity 不会走</>, body: <><p>Unity 危机 (2023 install-fee 风波) 让 Godot / Unreal 拿到了一部分迁出, 但<strong>Unity 在游戏行业的脚本份额 2026 仍然在 60–70%</strong>: 移动游戏几乎独占, indie / 中端 PC / VR / AR 也是默认起点。<em>这一块 C# 没有任何替代者在视野里</em>。</p></> },
    en: { title: <>Unity isn't going anywhere</>, body: <><p>Unity's 2023 install-fee crisis sent some studios to Godot or Unreal, but <strong>Unity still owns 60–70% scripting share in 2026</strong>: mobile games are near-monopoly, indie / mid-tier PC / VR / AR are still the default starting point. <em>No replacement for C# is visible on the horizon in this lane</em>.</p></> },
  },
  {
    tag: 'JAVA-RIVALRY',
    zh: { title: <>跟 Java 渐行渐远</>, body: <><p>2002 年 C# 跟 <a href="/code/language/java">Java</a> 是镜像兄弟, 2026 年是<strong>两个完全不同的语言</strong>: C# 走 record / pattern / async / span, Java 走 virtual threads / sealed / records (晚 5 年抄到 C#)。<em>哪边赢? 取决于你看哪一面</em>: Java 的服务器侧依然大、生态依然广; C# 的语言细节依然新、工具一体化依然强。</p></> },
    en: { title: <>Drifting away from Java</>, body: <><p>In 2002 C# and <a href="/code/language/java">Java</a> were mirror siblings; in 2026 they are <strong>two distinctly different languages</strong>. C# went all in on records, patterns, async, Span; Java's virtual threads / sealed types / records (five years late to C#) are catching up but never aligning. <em>Who wins? Depends which side you measure</em>: Java's server footprint and ecosystem are still vast; C#'s language pace and integrated tooling still lead.</p></> },
  },
  {
    tag: 'HEJLSBERG',
    zh: { title: <>Hejlsberg 自己 — 已在 TypeScript</>, body: <><p>有趣的注脚: <strong>2012 年 Hejlsberg 已经把主要精力转向了 <a href="/code/language/ts">TypeScript</a></strong>。他在微软的位置一直是"语言架构师", C# 的演化早就交给 Mads Torgaard 主导的 LDM 团队。<em>同一个人, 同时在主导 C# 1.0 和 TypeScript 1.0 之间的 12 年——这是工业语言史上非常少见的事</em>。</p></> },
    en: { title: <>Hejlsberg himself — already on TypeScript</>, body: <><p>An interesting footnote: <strong>by 2012 Hejlsberg had moved his main focus to <a href="/code/language/ts">TypeScript</a></strong>. His title at Microsoft is "language architect," and C#'s evolution has long been steered by the LDM team under Mads Torgaard. <em>One person stewarding both C# 1.0 and TypeScript 1.0 within twelve years is extraordinarily rare in industrial language history</em>.</p></> },
  },
];

export default function CsharpIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'C# : Hejlsberg 的第三门语言, .NET 的灵魂 — 26 年长青'
      : 'C# : Hejlsberg\'s third language, soul of .NET — 26 years and counting';
  }, [lang]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    const targets = root.querySelectorAll<HTMLElement>(
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .spotlight, .ai-reverse, .ai-takeaway, .quote-block, .uni-card, .tri-step, .dn-row'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ai-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.uni-card').forEach((el, i) => { el.style.transitionDelay = `${i * 100}ms`; });
    root.querySelectorAll<HTMLElement>('.tri-step').forEach((el, i) => { el.style.transitionDelay = `${i * 120}ms`; });
    root.querySelectorAll<HTMLElement>('.dn-row').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 40, 300)}ms`; });

    const floats = root.querySelectorAll<HTMLElement>('.float');
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);
    let raf = 0;
    const loop = () => {
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;
      floats.forEach((el, i) => {
        const depth = (i % 3 + 1) * 6;
        el.style.translate = `${tx * depth}px ${ty * depth}px`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const navLinks = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
    const setActive = () => {
      const y = window.scrollY + 120;
      let cur = sections[0]?.id;
      for (const s of sections) if (s.offsetTop <= y) cur = s.id;
      navLinks.forEach((a) => {
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--cs-bright)' : '';
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();

    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = id === 'top' ? root : root.querySelector('#' + id);
      if (target) {
        e.preventDefault();
        const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    return () => {
      io.disconnect();
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', setActive);
      cancelAnimationFrame(raf);
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
    };
  }, [lang]);

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="csharp-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="cs-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8C66F2" />
                  <stop offset="100%" stopColor="#2E1480" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#cs-nav)" />
              <path
                d="M170 92 C158 80 142 74 124 74 C92 74 68 98 68 132 C68 166 92 190 124 190 C142 190 158 184 170 172"
                stroke="#fff"
                strokeWidth="20"
                fill="none"
                strokeLinecap="round"
              />
              <g stroke="#fff" strokeWidth="9" strokeLinecap="round">
                <line x1="178" y1="100" x2="226" y2="100" />
                <line x1="174" y1="138" x2="222" y2="138" />
                <line x1="192" y1="84" x2="184" y2="156" />
                <line x1="216" y1="84" x2="208" y2="156" />
              </g>
            </svg>
            <span>C#</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#hejlsberg"><L zh="谱系" en="Lineage" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#dotnet"><L zh="运行时" en="Runtime" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#ecosystem"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Java" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2000 — 2026 · Microsoft · Anders Hejlsberg · managed code, then everywhere</div>
            <h1 className="hero-title">
              <span className="hero-name">C#</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">ManagedCode</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>Anders Hejlsberg 2000 年在微软<strong>用 Turbo Pascal / Delphi 那一代的肌肉记忆</strong>做出来的现代托管语言。25 年后, C# 仍在<strong>企业后端、Unity 游戏、跨平台 UI</strong>三条战线同时是主力——而<strong>async/await、LINQ、record</strong>这些早被全语言抄完的东西, 头一份就在这里。</>}
                en={<>Designed by Anders Hejlsberg at Microsoft in 2000 with <strong>the muscle memory of Turbo Pascal and Delphi</strong>. Twenty-five years on, C# still anchors <strong>enterprise back ends, Unity games, and cross-platform UI</strong> simultaneously — and the originals of <strong>async/await, LINQ and record</strong> that every other language eventually copied? They were first shipped here.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2000<small></small></span>
                <span className="stat-label"><L zh={<>6 月 26 日 PDC 公开<br /><em>C# 1.0 ships 2002</em></>} en={<>Announced at PDC, Jun 26<br /><em>C# 1.0 ships in 2002</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">14<small> versions</small></span>
                <span className="stat-label"><L zh={<>C# 1.0 → C# 14<br /><em>.NET 10 LTS, 2025-11</em></>} en={<>C# 1.0 → C# 14<br /><em>.NET 10 LTS, 2025-11</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~70<small>%</small></span>
                <span className="stat-label"><L zh={<>Unity 游戏脚本占比<br /><em>mobile games 接近独占</em></>} en={<>Unity scripting share<br /><em>near-monopoly on mobile</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">TOP<small> 5</small></span>
                <span className="stat-label"><L zh={<>TIOBE / IEEE / RedMonk<br /><em>多年长期 top-5</em></>} en={<>TIOBE / IEEE / RedMonk<br /><em>long-time top-5</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{CS_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">async/await</span>
              <span className="float f2">{'IEnumerable<T>'}</span>
              <span className="float f3">@parameter</span>
              <span className="float f4">record Point(x,y)</span>
              <span className="float f5">{'Span<byte>'}</span>
              <span className="float f6">LINQ from x in xs</span>
              <span className="float f7">.NET 10</span>
              <span className="float f8">Roslyn</span>
              <span className="float f9">Unity</span>
              <span className="float f10">Blazor WASM</span>
              <span className="float f11">PTX · ROCm</span>
              <span className="float f12">Native AOT</span>
            </div>
            <div className="scroll-cue">
              <span>scroll</span>
              <svg viewBox="0 0 12 24" width="12" height="24"><path d="M6 0v22M2 18l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </div>
          </section>

          {/* 01 What */}
          <section className="section" id="what">
            <header className="sec-head">
              <span className="sec-num">01</span>
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>C#</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>C# 是 <strong>Anders Hejlsberg 在 Microsoft 主持设计 (2000 公开, 2002 GA) 的静态类型、面向对象、组件式现代语言</strong>。出生时跟 Java 是镜像兄弟; 25 年下来变成<strong>三种发布形态 (JIT / Tiered / AOT)、四个 OS、三大战场</strong>都能站住的工业语言。</>}
                  en={<>C# is a <strong>statically typed, object-oriented, component-oriented modern language designed by Anders Hejlsberg at Microsoft (announced 2000, GA 2002)</strong>. Born as Java's mirror sibling; 25 years on, it ships in <strong>three deployment shapes (JIT / Tiered / AOT) on four OSes</strong>, anchoring three major industry fronts.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="托管 + 类型化" en="Managed + typed" />, tag: 'core', p: <L zh={<>CLR 上跑, <strong>GC + JIT + 反射 + 强类型</strong>。<em>2000 年还是稀有事</em>, 2026 年是基础线——但 C# 是这个基础线最早的几门工业语言之一。</>} en={<>Runs on the CLR with <strong>GC + JIT + reflection + strong types</strong>. <em>Rare in 2000</em>, baseline by 2026 — but C# was one of the very first industrial languages to standardise on it.</>} /> },
                { h: <L zh="LINQ + λ" en="LINQ + λ" />, tag: 'functional', p: <L zh={<>2007 年 C# 3 把<strong>查询语法塞进语言</strong>: <code>from</code> / <code>where</code> / <code>select</code> 原生关键字, 又能 fluent 链式调用。<em>同代 Java / C++ 没有任何一个能做到</em>。</>} en={<>In 2007, C# 3 baked <strong>query syntax into the language itself</strong>: <code>from</code> / <code>where</code> / <code>select</code> as native keywords, also usable as a fluent chain. <em>No same-era Java / C++ matched this</em>.</>} /> },
                { h: <L zh="async/await 原创" en="async/await origin" />, tag: 'concurrency', p: <L zh={<><strong>C# 5 (2012) 是 async/await 在工业语言里的第一次落地</strong>。3 年后 TypeScript 抄、5 年后 JS 抄、再往后 Python / Rust / Swift 全抄。<em>这是 C# 的最大输出</em>。</>} en={<><strong>C# 5 (2012) was the first industrial-language landing of async/await</strong>. TypeScript copied it 3 years later, JS 5 years later, then Python / Rust / Swift in turn. <em>C#'s largest export</em>.</>} /> },
                { h: <L zh="跨平台 (终于)" en="Cross-platform (finally)" />, tag: 'reach', p: <L zh={<>2014 年 .NET Core 把 C# 从 Windows-only 撬开, 2020 年 .NET 5 三条线汇合。<em>"<strong>C# 是 Windows 语言</strong>"这条 14 年的标签, 2026 年已经没人用</em>。</>} en={<>.NET Core in 2014 pried C# loose from Windows-only; .NET 5 in 2020 merged the three forks. <em>The 14-year-old "<strong>C# is a Windows language</strong>" label is no longer used in 2026</em>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">Hello.java</span><span className="lang-tag js">Java 7</span></div>
                <pre className="code"><code>
                  <span className="cl-k">public class</span> <span className="cl-type">Hello</span> {'{'}{'\n'}
                  {'    '}<span className="cl-k">public static void</span> <span className="cl-fn">main</span>(<span className="cl-type">String</span>[] args) {'{'}{'\n'}
                  {'        '}<span className="cl-type">List</span>&lt;<span className="cl-type">Integer</span>&gt; xs ={'\n'}
                  {'            '}<span className="cl-type">Arrays</span>.<span className="cl-fn">asList</span>(<span className="cl-n">1</span>,<span className="cl-n">2</span>,<span className="cl-n">3</span>,<span className="cl-n">4</span>);{'\n'}
                  {'        '}<span className="cl-k">int</span> sum = <span className="cl-n">0</span>;{'\n'}
                  {'        '}<span className="cl-k">for</span> (<span className="cl-k">int</span> x : xs){'\n'}
                  {'            '}<span className="cl-k">if</span> (x % <span className="cl-n">2</span> == <span className="cl-n">0</span>) sum += x * x;{'\n'}
                  {'        '}<span className="cl-fn">System</span>.<span className="cl-fn">out</span>.<span className="cl-fn">println</span>(sum);{'\n'}
                  {'    '}{'}'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// Java 7 时代: 三层嵌套 + 手写 for + 一行 println" en="// Java 7 era: three nesting levels + manual for + one println" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">Hello.cs</span><span className="lang-tag ts">C# (modern)</span></div>
                <pre className="code"><code>
                  <span className="cl-c">// top-level statements — no class boilerplate</span>{'\n'}
                  <span className="cl-k">int</span>[] xs = [<span className="cl-n">1</span>, <span className="cl-n">2</span>, <span className="cl-n">3</span>, <span className="cl-n">4</span>];{'\n\n'}
                  <span className="cl-k">var</span> sum = xs{'\n'}
                  {'    '}.<span className="cl-fn">Where</span>(x =&gt; x % <span className="cl-n">2</span> == <span className="cl-n">0</span>){'\n'}
                  {'    '}.<span className="cl-fn">Sum</span>(x =&gt; x * x);{'\n\n'}
                  <span className="cl-fn">Console</span>.<span className="cl-fn">WriteLine</span>(sum);{'\n\n'}
                  <span className="cl-c"><L zh="// 一个文件 = 整个程序" en="// one file = the entire program" /></span>{'\n'}
                  <span className="cl-c"><L zh="// LINQ + collection expression + top-level main" en="// LINQ + collection expression + top-level main" /></span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 Hejlsberg trilogy */}
          <section className="section" id="hejlsberg">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="Hejlsberg 谱系" en="The Hejlsberg lineage" /> <code>: 4 languages · 4 eras</code></h2>
              <p className="sec-desc"><L
                zh={<>一个人, 40 年, 4 门语言, <strong>每一门都改写了一个时代的工具栈</strong>: Turbo Pascal 教会一代人 "<em>编译器可以快</em>", Delphi 把 RAD 推广到 Windows, C# 是这一谱系的<strong>中心</strong>, TypeScript 接管了 JavaScript 时代。<em>语言设计界没有第二个人能写出同样的履历</em>。</>}
                en={<>One person, 40 years, four languages — and <strong>each redrew the tooling of its era</strong>. Turbo Pascal taught a generation that "<em>compilers can be fast</em>"; Delphi popularised RAD on Windows; C# is the <strong>centre</strong> of the lineage; TypeScript took over the JavaScript era. <em>No second name in language design carries a comparable resume</em>.</>}
              /></p>
            </header>

            <div className="trilogy">
              <div className="tri-step">
                <div className="tri-dot">1</div>
                <div className="tri-year">1983</div>
                <div className="tri-name">Turbo Pascal</div>
                <div className="tri-desc"><L
                  zh={<>$49 / 50KB IDE + 编译器。<em>"开发工具能廉价"的开端</em>。</>}
                  en={<>$49 / 50KB IDE + compiler. <em>The dawn of "developer tools can be cheap"</em>.</>}
                /></div>
              </div>
              <div className="tri-step">
                <div className="tri-dot">2</div>
                <div className="tri-year">1995</div>
                <div className="tri-name">Delphi</div>
                <div className="tri-desc"><L
                  zh={<>Windows 上的 RAD 视觉编程。<em>VB 的对手, 工程师爱它的那一面</em>。</>}
                  en={<>Visual RAD on Windows. <em>VB's rival, beloved by engineers</em>.</>}
                /></div>
              </div>
              <div className="tri-step tri-highlight">
                <div className="tri-dot">3</div>
                <div className="tri-year">2000</div>
                <div className="tri-name">C#</div>
                <div className="tri-desc"><L
                  zh={<><strong>这一页的主角</strong>。.NET 时代的标杆托管语言。</>}
                  en={<><strong>The subject of this page</strong>. The flagship managed language of the .NET era.</>}
                /></div>
              </div>
              <div className="tri-step">
                <div className="tri-dot">4</div>
                <div className="tri-year">2012</div>
                <div className="tri-name"><a href="/code/language/ts">TypeScript</a></div>
                <div className="tri-desc"><L
                  zh={<>给 JavaScript 加类型。<em>14 年后, 它跑赢了它的祖父 C#</em>。</>}
                  en={<>Types for JavaScript. <em>14 years on, it outgrew its grandparent C#</em>.</>}
                /></div>
              </div>
            </div>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>C# 设计的时候我们已经知道<strong>静态类型 + GC + JIT</strong> 是要付的"<em>启动慢、内存大</em>"的税。但 25 年下来回看, 当时的赌注是对的——这是<strong>大部分工业 app 的最优形态</strong>, 不是脚本语言, 不是 C/C++。后来在 TypeScript 我们再赌一次, 也是对的。</>}
                en={<>When we designed C# we already knew the price of <strong>static typing + GC + JIT</strong> was the "<em>slow startup, heavier memory</em>" tax. But looking back 25 years, the bet was right — it's the <strong>optimal shape for most industrial apps</strong>, not scripts and not C/C++. We made the same bet on TypeScript later, and that was right too.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Anders Hejlsberg</span>
                <span className="quote-context"><L zh="C# / TypeScript 设计师 · 多次访谈与 keynote · 综述" en="C# / TypeScript designer · paraphrased from interviews + keynotes" /></span>
              </footer>
            </blockquote>
          </section>

          {/* 03 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>26 年走过<strong>四个时代</strong>: <strong>.NET Framework</strong> 时代 (Windows-only, 2002–2014) → <strong>Mono / Xamarin</strong> 时代 (社区把 C# 抬下 Windows, 2004–2016) → <strong>.NET Core</strong> 时代 (微软自己跨平台, 2014–2020) → <strong>统一 .NET</strong> 时代 (2020 至今)。每一步都被刻在了语言版本号上。</>}
                en={<>Twenty-six years through <strong>four eras</strong>: <strong>.NET Framework</strong> (Windows-only, 2002–2014) → <strong>Mono / Xamarin</strong> (the community drag off Windows, 2004–2016) → <strong>.NET Core</strong> (Microsoft's own cross-platform run, 2014–2020) → <strong>Unified .NET</strong> (2020 onward). Each step is stamped on the language's version number.</>}
              /></p>
            </header>

            <ol className="timeline">
              {HISTORY.map((it, i) => (
                <li className={`tl-item${it.highlight ? ' highlight' : ''}`} key={i}>
                  <div className="tl-year">{it.year}</div>
                  <div className="tl-card">
                    <h3>{lang === 'zh' ? it.zh.title : it.en.title}</h3>
                    <p>{lang === 'zh' ? it.zh.desc : it.en.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 04 .NET Runtime ribbon */}
          <section className="section" id="dotnet">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh=".NET 大事件版本" en=".NET version ribbon" /> <code>: Framework · Core · Unified</code></h2>
              <p className="sec-desc"><L
                zh={<>C# 是语言, <strong>.NET 是它跑的家</strong>——但 .NET 自己 25 年里换了 3 张脸。下面一行一个版本, 只放<strong>真正改了游戏</strong>的那几个 (不是每个 minor release)。</>}
                en={<>C# is the language, <strong>.NET is the runtime it lives on</strong> — and .NET has worn three different faces over 25 years. One line per version below; only the ones that <strong>actually moved the game</strong>, not every minor.</>}
              /></p>
            </header>

            <div className="dotnet-ribbon">
              {[
                { name: '.NET Framework 1.0', date: '2002-02-13', tag: 'FX', note: <L zh={<>最早 GA · <code>CLR 1.0</code>, BCL · <strong>Windows only</strong></>} en={<>First GA · <code>CLR 1.0</code> + BCL · <strong>Windows only</strong></>} /> },
                { name: '.NET Framework 2.0', date: '2005-11-07', tag: 'FX', note: <L zh={<>generics · <code>nullable</code> · <em>真正能上规模</em>的第一版</>} en={<>Generics · <code>nullable</code> · <em>first version that genuinely scaled</em></>} /> },
                { name: '.NET Framework 3.5', date: '2007-11', tag: 'FX', highlight: true, note: <L zh={<>LINQ · WPF · WCF · <strong>大规模企业普及那一版</strong></>} en={<>LINQ · WPF · WCF · <strong>the version that took over enterprise</strong></>} /> },
                { name: '.NET Framework 4.5', date: '2012-08-15', tag: 'FX', note: <L zh={<><code>async/await</code> 来了 · <em>这之后语言走得快, 框架走得慢</em></>} en={<><code>async/await</code> arrives · <em>language pulls ahead, framework lags</em></>} /> },
                { name: 'Mono 1.0', date: '2004-06-30', tag: 'MN', note: <L zh={<>de Icaza 主导 · <em>Linux 上头一个能跑 C#</em></>} en={<>Led by de Icaza · <em>first place you could run C# on Linux</em></>} /> },
                { name: 'Xamarin 1.0', date: '2013', tag: 'MN', note: <L zh={<>Mono → 移动端商业化 · <em>2016 被微软收</em></>} en={<>Mono → commercial mobile · <em>acquired by Microsoft in 2016</em></>} /> },
                { name: '.NET Core 1.0', date: '2016-06-27', tag: 'CO', highlight: true, note: <L zh={<>MIT · GitHub 开源 · <strong>Linux / mac / Win</strong> · 第一个真跨平台</>} en={<>MIT · public GitHub · <strong>Linux / mac / Win</strong> · the first real cross-platform</>} /> },
                { name: '.NET Core 3.1', date: '2019-12-03', tag: 'CO', note: <L zh={<>LTS · <em>很多企业从 Framework 迁出去的目标版本</em></>} en={<>LTS · <em>the target version most enterprises migrated to from Framework</em></>} /> },
                { name: '.NET 5', date: '2020-11-10', tag: 'UN', highlight: true, note: <L zh={<>跳过 4 · <strong>Framework + Core + Mono 三条线合并</strong></>} en={<>Skips 4 · <strong>Framework + Core + Mono merge</strong></>} /> },
                { name: '.NET 6 LTS', date: '2021-11-08', tag: 'UN', note: <L zh={<>第一个 LTS · Minimal API · <code>global using</code> · <em>2024 之前的产线主力</em></>} en={<>First LTS · Minimal API · <code>global using</code> · <em>backbone of production lines through 2024</em></>} /> },
                { name: '.NET 7', date: '2022-11-08', tag: 'UN', note: <L zh={<>Native AOT preview · <em>开始拼 Go 的小服务地盘</em></>} en={<>Native AOT preview · <em>starts competing with Go on small services</em></>} /> },
                { name: '.NET 8 LTS', date: '2023-11-14', tag: 'UN', highlight: true, note: <L zh={<>Native AOT GA · Blazor United · <strong>2024–2025 LTS 主力</strong></>} en={<>Native AOT GA · Blazor United · <strong>the 2024–2025 LTS backbone</strong></>} /> },
                { name: '.NET 9', date: '2024-11-12', tag: 'UN', note: <L zh={<><code>params ReadOnlySpan</code> · LINQ 提速 · SIMD 进步</>} en={<><code>params ReadOnlySpan</code> · LINQ speedup · SIMD progress</>} /> },
                { name: '.NET 10 LTS', date: '2025-11-11', tag: 'UN', highlight: true, note: <L zh={<>C# 14 · <code>field</code> · <code>extension</code> preview · <strong>当下产线 LTS</strong></>} en={<>C# 14 · <code>field</code> · <code>extension</code> preview · <strong>current production LTS</strong></>} /> },
              ].map((row, i) => {
                const tagClass = row.tag === 'FX' ? 'dn-fx' : row.tag === 'MN' ? 'dn-mono' : row.tag === 'CO' ? 'dn-core' : 'dn-unified';
                const tagLabel = row.tag === 'FX' ? <L zh="Framework" en="Framework" /> : row.tag === 'MN' ? <L zh="Mono · 社区" en="Mono · community" /> : row.tag === 'CO' ? <L zh=".NET Core" en=".NET Core" /> : <L zh="统一 .NET" en="Unified .NET" />;
                return (
                  <div className={`dn-row${row.highlight ? ' dn-highlight' : ''}`} key={i}>
                    <div className="dn-name">{row.name}<span className="dn-date">{row.date}</span></div>
                    <div className="dn-note">{row.note}</div>
                    <div className={`dn-tag ${tagClass}`}>{tagLabel}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 05 Language essentials (cards) */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: CsharpAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>8 张卡 + 1 张回顾, 是 C# 真正<strong>跟其它工业语言拉开身位</strong>的那几条线: LINQ (2007 原创)、async/await (2012 原创)、record / pattern matching、top-level、nullable refs、Span&lt;T&gt; 系统编程出口、source generator 元编程。</>}
                en={<>Eight cards plus one wrap-up — the moves where C# <strong>genuinely pulled ahead</strong>: LINQ (2007 original), async/await (2012 original), records & pattern matching, top-level statements, nullable refs, the Span&lt;T&gt; systems-programming off-ramp, and source generators.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {CS_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>C# 14 (.NET 10) — 当下手里的语法</>} en={<>C# 14 (.NET 10) — what's in your hands today</>} /></h3>
                <p><L
                  zh={<>2025-11 出, 2028 LTS 支持期: <code>field</code> 关键字 (property 的隐藏 backing field 终于有名字了); <code>extension</code> 类型 preview (扩展方法 v2, 这次能加属性、静态成员、运算符); collection expressions 已经在 .NET 9 GA, .NET 10 全语言扩展; null check operator <code>!!</code> 经过多年反复, 仍然<em>未落地</em>——LDM 给的理由是"清晰度收益太小"。</>}
                  en={<>Released 2025-11, LTS support through 2028. The <code>field</code> keyword finally names the hidden backing field of a property; <code>extension</code> types preview (extension methods v2, this round adding properties, statics, operators); collection expressions GA'd in .NET 9 and are extended language-wide in .NET 10. The argument-null-check operator <code>!!</code> remains <em>unshipped</em> after years of debate — LDM's reason: "clarity gain is too small."</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>C# 的"加什么"和"<strong>不加什么</strong>"由 Mads Torgaard 的 Language Design Meeting (LDM) 全公开决定——每周三北美时间, 笔记发 GitHub。</>}
                  en={<>What goes in — and what <strong>doesn't</strong> — is decided in the open by Mads Torgaard's Language Design Meeting (LDM): Wednesdays NA time, notes pushed to GitHub.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 06 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why C#" /> <code>: WhyCsharp</code></h2>
              <p className="sec-desc"><L
                zh={<>C# 不是 hype 语言 (没有 Rust 的"零成本抽象"光环、没有 Mojo 的 35,000× 数字), 也不是 hello-world 语言 (有 LSP / Roslyn / CLR 三层基础设施撑着)。它是<strong>"用起来就回不去"</strong>那一类——typed + LINQ + async/await + Roslyn 一体, 是大多数工业 app 形态最舒服的那一档。</>}
                en={<>C# isn't a hype language (no Rust-grade "zero-cost abstraction" halo, no Mojo-grade 35,000× number) and isn't a hello-world language (it sits on three layers of LSP / Roslyn / CLR infrastructure). It's the <strong>"once you've used it, it's hard to leave"</strong> kind — typed + LINQ + async/await + Roslyn fused, the most comfortable rung for the majority of industrial-app shapes.</>}
              /></p>
            </header>

            <div className="why-grid">
              {WHY_CARDS.map((c, i) => (
                <div className="why-card" key={i}>
                  <div className="why-icon">{c.icon}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="why-code"><code>{c.code}</code></pre>
                </div>
              ))}
            </div>
          </section>

          {/* 07 Ecosystem split — three universes */}
          <section className="section section-ai" id="ecosystem">
            <header className="sec-head">
              <span className="sec-num ai-num">07</span>
              <h2 className="sec-title"><L zh="三个宇宙" en="Three universes" /> <code>: <L zh="同一门语言, 三种世界" en="One language, three worlds" /></code></h2>
              <p className="sec-desc"><L
                zh={<>C# 的特别之处: <strong>它生活在三个几乎不交流的开发者宇宙里</strong>。同一门语言, 一个人去做 Unity 游戏、一个人去做 ASP.NET Core API、一个人去做 MAUI 移动 app, <em>互相基本不会跨过去</em>——但他们都是 C# 开发者。</>}
                en={<>C# is unusual in that <strong>it lives in three developer universes that barely speak to each other</strong>. One person does Unity games, another writes ASP.NET Core APIs, a third builds MAUI mobile apps. <em>They rarely cross over</em> — yet all three are C# developers.</>}
              /></p>
            </header>

            <div className="universe">
              <div className="uni-card uni-unity">
                <div className="uni-icon">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="16,4 28,11 28,21 16,28 4,21 4,11" /></svg>
                </div>
                <h3><L zh="游戏 / Unity" en="Games / Unity" /></h3>
                <div className="uni-stat"><L zh="估占行业 60–70% 脚本份额" en="~60–70% scripting share" /></div>
                <p><L
                  zh={<>Unity 2005 上线时选了 C# 做脚本语言, 之后没退过。<strong>移动游戏几乎独占</strong>, 中端 PC / VR / AR / indie 都是默认起点。<em>Unreal 用 C++ / Blueprint, Godot 用 GDScript — 但 C# 的"<strong>一份脚本两小时上手</strong>"路径还没有真正的替代</em>。</>}
                  en={<>Unity picked C# as its scripting language in 2005 and never looked back. <strong>Near monopoly on mobile games</strong>; the default starting point for mid-tier PC, VR, AR and indie. <em>Unreal uses C++ / Blueprint, Godot uses GDScript — but C#'s "<strong>two-hour onboarding</strong>" path has no real replacement</em>.</>}
                /></p>
                <ul>
                  <li>Unity 6 · 2026</li>
                  <li>~70% market</li>
                  <li>scripts == hot reload</li>
                  <li>IL2CPP backend</li>
                </ul>
              </div>
              <div className="uni-card uni-web">
                <div className="uni-icon">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8 L28 8 L28 24 L4 24 Z M4 14 L28 14" /><circle cx="8" cy="11" r="1.2" fill="currentColor"/><circle cx="12" cy="11" r="1.2" fill="currentColor"/></svg>
                </div>
                <h3><L zh="企业 Web / ASP.NET Core" en="Enterprise web / ASP.NET Core" /></h3>
                <div className="uni-stat"><L zh="Top-3 web framework cohort" en="Top-3 web framework cohort" /></div>
                <p><L
                  zh={<>北美 + 欧洲 + 印度大型企业后端的<strong>稳态主力</strong>。Stack Overflow 自己跑在 .NET 上, Microsoft / Bing / Azure / LinkedIn 大量服务都是 ASP.NET Core; 银行 / 保险 / 政府 / 医疗 系统几乎被 .NET 6/8/10 LTS 包圆。<em>不刷屏不上热搜, 是钱的语言</em>。</>}
                  en={<>The <strong>steady backbone</strong> of large-enterprise back ends in North America, Europe and India. Stack Overflow famously runs on .NET; Microsoft / Bing / Azure / LinkedIn ship vast amounts of ASP.NET Core; banks, insurers, governments and healthcare systems sit on .NET 6/8/10 LTS. <em>Not splashy, not trending — paycheck language</em>.</>}
                /></p>
                <ul>
                  <li>ASP.NET Core</li>
                  <li>Minimal API · gRPC</li>
                  <li>EF Core · Dapper</li>
                  <li>Azure first-class</li>
                </ul>
              </div>
              <div className="uni-card uni-desktop">
                <div className="uni-icon">
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="8" width="20" height="14" rx="2" /><line x1="12" y1="26" x2="20" y2="26" /></svg>
                </div>
                <h3><L zh="桌面 + 跨平台 UI" en="Desktop + cross-platform UI" /></h3>
                <div className="uni-stat"><L zh="MAUI + Avalonia · 4-OS" en="MAUI + Avalonia · 4-OS" /></div>
                <p><L
                  zh={<>三条线并存: <strong>WPF / WinForms</strong> (Windows 经典, 仍然有几十万企业系统在维护)、<strong>MAUI</strong> (微软官方四 OS 跨平台, 2026 终于稳定)、<strong>Avalonia</strong> (社区主导, WPF API 复刻 + 跨平台, JetBrains Rider 自己就用它)。<em>不像 web 那么时髦, 但活路一直在</em>。</>}
                  en={<>Three threads coexist: <strong>WPF / WinForms</strong> (classic Windows, hundreds of thousands of enterprise systems still maintained), <strong>MAUI</strong> (Microsoft's official four-OS cross-platform, stable in 2026), <strong>Avalonia</strong> (community-led WPF-API clone + cross-platform; JetBrains Rider itself runs on it). <em>Less fashionable than web, but the lane is still open</em>.</>}
                /></p>
                <ul>
                  <li>WPF · WinForms</li>
                  <li>MAUI 4-OS</li>
                  <li>Avalonia OSS</li>
                  <li>Uno Platform</li>
                </ul>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Minimal API + Native AOT <span className="spotlight-meta">— <L zh="C# 的小服务新出口" en="C#'s new home for small services" /></span></h3>
                  <p><L
                    zh={<>2026 年这一段 hello-world: 一个文件、五行、单个 <strong>~10 MB native binary</strong>、冷启动 <strong>~20ms</strong>、不带 JIT 不带 GC pause。<em>这跟 5 年前的 ASP.NET 全家桶根本不像同一种语言</em>。</>}
                    en={<>The 2026 hello-world: one file, five lines, a single <strong>~10 MB native binary</strong>, <strong>~20 ms</strong> cold start, no JIT, no GC pause to speak of. <em>This barely looks like the ASP.NET monolith of five years ago</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Minimal API</strong> — <L zh="lambda 一行注册 endpoint" en="Lambda-style endpoint registration" /></li>
                    <li><strong>Native AOT</strong> — <L zh="编到单 binary, 无 JIT" en="Compiles to a single binary, no JIT" /></li>
                    <li><strong>System.Text.Json</strong> — <L zh="source-gen, 零反射" en="Source-generated, no reflection" /></li>
                    <li><strong>Trimming</strong> — <L zh="未引用的库代码消失" en="Unreferenced library code is removed" /></li>
                  </ul>
                  <p><L
                    zh={<>对手: Go / Rust 在 container-first 微服务。<em>不是替代 ASP.NET monolith, 是给 "小、冷启动、密集" 这一类应用一条新出路</em>。</>}
                    en={<>Rivals: Go and Rust in container-first microservices. <em>Not a replacement for the ASP.NET monolith — a new lane for "small, cold-start, density-sensitive" services</em>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// Program.cs — the entire microservice" en="// Program.cs — the entire microservice" /></span>{'\n'}
                    <span className="cl-k">using</span> <span className="cl-type">Microsoft</span>.<span className="cl-fn">AspNetCore</span>.<span className="cl-fn">Builder</span>;{'\n\n'}
                    <span className="cl-k">var</span> app = <span className="cl-type">WebApplication</span>.<span className="cl-fn">Create</span>(args);{'\n\n'}
                    app.<span className="cl-fn">MapGet</span>(<span className="cl-s">"/"</span>, () =&gt;{'\n'}
                    {'    '}<span className="cl-k">new</span> {'{ '}msg = <span className="cl-s">"hello, AOT"</span>{' }'});{'\n\n'}
                    app.<span className="cl-fn">MapGet</span>(<span className="cl-s">"/sum"</span>, (<span className="cl-k">int</span>[] xs) =&gt;{'\n'}
                    {'    '}xs.<span className="cl-fn">Sum</span>());{'\n\n'}
                    app.<span className="cl-fn">Run</span>();{'\n\n'}
                    <span className="cl-c"><L zh="// $ dotnet publish -c Release /p:PublishAot=true" en="// $ dotnet publish -c Release /p:PublishAot=true" /></span>{'\n'}
                    <span className="cl-c"><L zh="// → 10 MB · 20ms cold start · 0 JIT" en="// → 10 MB · 20ms cold start · 0 JIT" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">~70<small>%</small></div>
                <div className="ai-stat-h"><L zh="Unity 行业占有率" en="Unity industry share" /></div>
                <p><L
                  zh={<>多家行业调研 (Unity Technologies, GDC State of the Industry) 长期把 Unity 的活跃使用率放在 <strong>60–70%</strong>。<em>Unity 是 C# 真正的"<strong>到目前为止找不到替代</strong>"应用场景</em>: 移动游戏 95%+, indie / 中端 PC / VR / AR 一律默认。</>}
                  en={<>Multiple industry surveys (Unity Technologies, GDC State of the Industry) put Unity at <strong>60–70%</strong> active use year after year. <em>It is C#'s genuinely <strong>"no replacement yet"</strong> niche</em>: mobile games 95%+, with indie, mid-tier PC, VR and AR as defaults.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">~6M<small></small></div>
                <div className="ai-stat-h"><L zh="NuGet 包数量" en="NuGet packages" /></div>
                <p><L
                  zh={<>NuGet (.NET 的 npm) 2026 年公开包<strong>~6 million unique versions, ~400k unique packages</strong>。规模在 Maven Central (Java) / npm (JS) 之下, 但<strong>覆盖企业领域 (logging / DI / EF / web / cloud) 极完整</strong>。<em>不是包多吓人, 是 "每个企业 use case 都有现成轮子"</em>。</>}
                  en={<>By 2026 NuGet (.NET's npm) lists about <strong>6 million unique versions across ~400k unique packages</strong>. Smaller than Maven Central or npm, but <strong>extremely complete across the enterprise domain</strong> — logging, DI, EF, web, cloud. <em>It's not raw size, it's that "<strong>every enterprise use case has a ready wheel</strong>"</em>.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">3<small> targets</small></div>
                <div className="ai-stat-h"><L zh="JIT · Tiered · AOT 三种发布形态" en="JIT · Tiered · AOT — three deployment shapes" /></div>
                <p><L
                  zh={<>同一份 C# 源代码可以选择三种<strong>runtime 行为</strong>: 长寿服务用 <strong>JIT</strong>, hot 路径用 <strong>Tiered JIT</strong> 二次编译, 启动敏感的 lambda / CLI 用 <strong>Native AOT</strong>。<em>这种"<strong>同语言、三形态</strong>"的灵活度, Java / Kotlin / Go 都没有完整凑齐</em>。</>}
                  en={<>One C# source tree, three <strong>runtime behaviours</strong>: long-lived services use <strong>JIT</strong>, hot paths get re-tiered by <strong>Tiered JIT</strong>, startup-sensitive lambdas / CLIs use <strong>Native AOT</strong>. <em>That "<strong>same language, three shapes</strong>" flexibility — Java, Kotlin and Go each ship only part of it</em>.</>}
                /></p>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="2026 .NET 生态主力" en="2026 .NET ecosystem mainstays" /></h3>
              <div className="ai-tools-grid">
                {ADOPT_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">AI ERA</div>
                <h3><L zh="AI 写 C# — 训练料够, 但有坑" en="LLMs writing C# — plenty of data, with caveats" /></h3>
                <p><L
                  zh={<>C# / .NET <strong>不缺训练数据</strong> (GitHub 上 .NET 仓库百万级, Stack Overflow 上 C# tag 是 top-5), GPT / Claude 写 C# 流畅度<strong>近乎 Java / Python</strong>。但实际工作里有两个坑值得注意。</>}
                  en={<>C# / .NET <strong>has no shortage of training data</strong> — millions of .NET repos on GitHub and a top-5 Stack Overflow tag — and GPT / Claude write C# with <strong>fluency close to Java / Python</strong>. But two real-world traps stand out.</>}
                /></p>
                <p><L
                  zh={<>第一: <strong>模型常常默认 .NET Framework / Core 老版语法</strong> (因为训练料里旧代码多)。让它写 .NET 8/10 的 Minimal API / record / pattern, 经常需要明确告知版本。</>}
                  en={<>First: <strong>models often default to .NET Framework / older Core syntax</strong>, because the training corpus skews old. Getting them to produce .NET 8/10 Minimal API / records / patterns usually requires explicit version hints.</>}
                /></p>
                <p><L
                  zh={<>第二: <strong>Roslyn analyzer / source generator</strong> 这一层模型很难写对——这是 C# 真正的"AI 弱点": 元编程靠 LDM 的实时演进, 模型训练料 lag 12 个月起。<em>这块仍然是人写</em>。</>}
                  en={<>Second: <strong>Roslyn analyzers and source generators</strong> are where LLMs reliably stumble — C#'s real "AI weak spot." Metaprogramming evolves at the pace of the LDM, and the training corpus lags by 12+ months. <em>This layer is still hand-written</em>.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// ❌ LLM 默认这种 (老 .NET Core / Framework)" en="// ❌ LLM default (older .NET Core / Framework)" /></span>{'\n'}
                  <span className="cl-k">public class</span> <span className="cl-type">Startup</span> {'{'}{'\n'}
                  {'    '}<span className="cl-k">public void</span> <span className="cl-fn">ConfigureServices</span>(<span className="cl-type">IServiceCollection</span> s){'\n'}
                  {'    '}{'{'} ... {'}'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// ✅ 现代写法 (.NET 8/10 Minimal API)" en="// ✅ modern (.NET 8/10 Minimal API)" /></span>{'\n'}
                  <span className="cl-k">var</span> b = <span className="cl-type">WebApplication</span>.<span className="cl-fn">CreateBuilder</span>(args);{'\n'}
                  b.<span className="cl-fn">Services</span>.<span className="cl-fn">AddSingleton</span>&lt;<span className="cl-type">IFoo</span>, <span className="cl-type">Foo</span>&gt;();{'\n'}
                  <span className="cl-k">var</span> app = b.<span className="cl-fn">Build</span>();{'\n'}
                  app.<span className="cl-fn">MapGet</span>(<span className="cl-s">"/"</span>, (<span className="cl-type">IFoo</span> f) =&gt; f.<span className="cl-fn">Greet</span>());{'\n'}
                  app.<span className="cl-fn">Run</span>();
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>C# 是 <strong>2026 年企业 + 游戏 + 跨平台 UI 都能站住的少数语言之一</strong>。它不刷屏, 但它在产线上跑了 24 年, 而且<strong>2026 年的它跟 2002 年那个 Windows 语言已经不是同一门</strong>——Native AOT, Blazor United, MAUI, record, pattern, span, source generators 全部加上, <em>它在演化, 不在老去</em>。</>}
                en={<>C# is one of the few languages in 2026 that <strong>simultaneously anchors enterprise, games, and cross-platform UI</strong>. It doesn't go viral, but it has been in production for 24 years — and <strong>the 2026 version is not the 2002 Windows language</strong>. Native AOT, Blazor United, MAUI, records, patterns, Span&lt;T&gt;, source generators — <em>it's evolving, not aging</em>.</>}
              /></p>
            </div>
          </section>

          {/* 08 Adopters */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 12 张卡每一张都是 <strong>2026 年仍在产线上的项目</strong>: 自家 .NET / ASP.NET / Roslyn, Unity (脚本独占), Blazor (前端), VS Code / Rider (工具), PowerShell, Stack Overflow (公开案例), EF Core / Avalonia (生态)。</>}
                en={<>Twelve cards below, every one a project <strong>still in production in 2026</strong>: Microsoft's own .NET / ASP.NET / Roslyn, Unity (scripting monopoly), Blazor (front-end), VS Code / Rider (tooling), PowerShell, Stack Overflow (public case), EF Core / Avalonia (ecosystem).</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {PROJECTS.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target="_blank" rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 09 vs Java / Kotlin */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="对比" en="vs Java / Kotlin" /> <code>: Csharp vs Java vs Kotlin</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <a href="/code/language/java">Java</a> 是 25 年前的镜像兄弟, 跟 <a href="/code/language/kotlin">Kotlin</a> 是 2010 年后的"现代 JVM 同龄人"。这里把三者放同一张表里, 看哪些一致、哪些根本两个方向。</>}
                en={<>The mirror sibling of <a href="/code/language/java">Java</a> 25 years back, and the "modern JVM peer" of <a href="/code/language/kotlin">Kotlin</a> from the 2010s. Putting all three in one table makes alignment versus divergence obvious.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Java</th>
                  <th className="th-ts">C#</th>
                  <th className="th-sw">Kotlin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Sun · 1995</>,
                    ts: <>Microsoft · 2000</>,
                    sw: <>JetBrains · 2011</> },
                  { k: <L zh="设计师" en="Designer" />,
                    js: <>James Gosling</>,
                    ts: <>Anders Hejlsberg</>,
                    sw: <L zh="Andrey Breslav · JB 团队" en="Andrey Breslav · JB team" /> },
                  { k: <L zh="主要 runtime" en="Primary runtime" />,
                    js: <L zh="JVM (HotSpot / GraalVM)" en="JVM (HotSpot / GraalVM)" />,
                    ts: <L zh=".NET CLR (JIT / Tiered / AOT)" en=".NET CLR (JIT / Tiered / AOT)" />,
                    sw: <L zh="JVM 主 + Native / JS / WASM" en="JVM + Native / JS / WASM" /> },
                  { k: <L zh="泛型实现" en="Generics implementation" />,
                    js: <L zh="擦除 · runtime 不可见" en="Erasure · invisible at runtime" />,
                    ts: <L zh="具化 (reified) · CLR 层" en="Reified at the CLR" />,
                    sw: <L zh="擦除 (兼容 JVM) · inline reified" en="Erasure (JVM compat) · inline reified" /> },
                  { k: <L zh="LINQ-style 集合" en="LINQ-style collections" />,
                    js: <L zh="Stream API (Java 8) · 晚 7 年" en="Stream API (Java 8) · 7 yrs late" />,
                    ts: <L zh={<><strong>原创</strong> · 2007</>} en={<><strong>Originated it</strong> · 2007</>} />,
                    sw: <L zh="Sequence + 扩展函数 · 类似" en="Sequence + extension fns · similar" /> },
                  { k: <L zh="async/await" en="async/await" />,
                    js: <L zh="virtual threads (Java 21) · 不同模型" en="Virtual threads (Java 21) · different model" />,
                    ts: <L zh={<><strong>原创</strong> · 2012</>} en={<><strong>Originated it</strong> · 2012</>} />,
                    sw: <L zh="coroutines · 等价但更轻" en="Coroutines · equivalent, lighter" /> },
                  { k: <L zh="nullable" en="Nullability" />,
                    js: <L zh={<>Optional&lt;T&gt; · 不在类型系统</>} en={<>Optional&lt;T&gt; · not in type system</>} />,
                    ts: <L zh="opt-in #nullable · 类型级" en="Opt-in #nullable · type-level" />,
                    sw: <L zh={<><code>T?</code> <strong>默认</strong></>} en={<><code>T?</code> <strong>default</strong></>} /> },
                  { k: <L zh="record / data class" en="record / data class" />,
                    js: <L zh="record (Java 16) · 晚 5 年" en="record (Java 16) · 5 yrs late" />,
                    ts: <L zh={<><code>record</code> · 2020</>} en={<><code>record</code> · 2020</>} />,
                    sw: <L zh={<><code>data class</code> · 2016</>} en={<><code>data class</code> · 2016</>} /> },
                  { k: <L zh="Pattern matching" en="Pattern matching" />,
                    js: <L zh="2024 起逐步加" en="2024+ gradually added" />,
                    ts: <L zh="switch expression · 表达式级" en="switch expression · expression-level" />,
                    sw: <L zh="when 表达式" en="when expressions" /> },
                  { k: <L zh="编译期元编程" en="Compile-time metaprogramming" />,
                    js: <L zh="Annotation Processing · 古老" en="Annotation processing · ancient" />,
                    ts: <L zh="Roslyn source generators (2020)" en="Roslyn source generators (2020)" />,
                    sw: <L zh="KSP (Kotlin Symbol Processing)" en="KSP (Kotlin Symbol Processing)" /> },
                  { k: <L zh="移动端" en="Mobile" />,
                    js: <L zh="Android (历史)" en="Android (legacy)" />,
                    ts: <L zh="MAUI · Unity (游戏)" en="MAUI · Unity (games)" />,
                    sw: <L zh="Android 官方 + KMP iOS" en="Official Android + KMP iOS" /> },
                  { k: <L zh="跨平台 UI" en="Cross-platform UI" />,
                    js: <L zh="JavaFX (式微)" en="JavaFX (waning)" />,
                    ts: <L zh="MAUI + Avalonia + WPF/WinForms" en="MAUI + Avalonia + WPF/WinForms" />,
                    sw: <L zh="Compose Multiplatform" en="Compose Multiplatform" /> },
                  { k: <L zh="2026 主要使用方向" en="2026 dominant use" />,
                    js: <L zh="企业后端 / Android" en="Enterprise backend / Android" />,
                    ts: <L zh="企业 / 游戏 / 跨平台 UI 三向" en="Enterprise / games / cross-platform UI" />,
                    sw: <L zh="Android / Server-side (Spring Boot)" en="Android / server-side (Spring Boot)" /> },
                  { k: <L zh="开源" en="Open source" />,
                    js: <L zh="OpenJDK · GPL2 + CE" en="OpenJDK · GPL2 + CE" />,
                    ts: <L zh="Roslyn + .NET runtime · MIT" en="Roslyn + .NET runtime · MIT" />,
                    sw: <L zh="编译器 Apache 2.0" en="Compiler Apache 2.0" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.js}</td>
                    <td>{row.ts}</td>
                    <td>{row.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 10 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">10</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 年 C# 没有"<em>1.0 兴奋</em>", 也没有"<em>濒临淘汰</em>" — 它正在做的事是<strong>静悄悄把每一条工业战线再压实一道</strong>: Native AOT 抢小服务地盘、Blazor United 走全栈、MAUI 终于稳定、Unity 不动如山、Hejlsberg 自己在 TypeScript。</>}
                en={<>C# in 2026 has no "<em>1.0 hype</em>" and no "<em>about-to-die</em>" feel — what it's doing is <strong>quietly tightening every industrial front it already holds</strong>: Native AOT moving on small services, Blazor United going full-stack, MAUI finally stable, Unity unmoved, Hejlsberg himself off on TypeScript.</>}
              /></p>
            </header>

            <div className="future-grid">
              {FUTURE_CARDS.map((c, i) => (
                <div className={`future-card${c.big ? ' big' : ''}`} key={i}>
                  <div className={`future-tag${c.hot ? ' tag-hot' : ''}`}>{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  {lang === 'zh' ? c.zh.body : c.en.body}
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="官方资源" en="Official" /></h4>
              <ul>
                <li><a href="https://dotnet.microsoft.com" target="_blank" rel="noopener">dotnet.microsoft.com</a></li>
                <li><a href="https://learn.microsoft.com/dotnet/csharp/" target="_blank" rel="noopener"><L zh="C# 官方文档" en="C# documentation" /></a></li>
                <li><a href="https://github.com/dotnet" target="_blank" rel="noopener">github.com/dotnet</a></li>
                <li><a href="https://learn.microsoft.com/dotnet/" target="_blank" rel="noopener"><L zh=".NET 学习中心" en=".NET learning hub" /></a></li>
                <li><a href="https://devblogs.microsoft.com/dotnet/" target="_blank" rel="noopener"><L zh="官方博客" en=".NET dev blog" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://github.com/dotnet/roslyn" target="_blank" rel="noopener">Roslyn — compiler</a></li>
                <li><a href="https://github.com/dotnet/csharplang" target="_blank" rel="noopener">dotnet/csharplang · LDM</a></li>
                <li><a href="https://learn.microsoft.com/dotnet/csharp/whats-new/" target="_blank" rel="noopener"><L zh="C# 14 新特性" en="C# 14 what's new" /></a></li>
                <li><a href="https://learn.microsoft.com/dotnet/core/deploying/native-aot/" target="_blank" rel="noopener">Native AOT</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 工具" en="Ecosystem / Tools" /></h4>
              <ul>
                <li><a href="https://www.nuget.org" target="_blank" rel="noopener">NuGet · packages</a></li>
                <li><a href="https://github.com/dotnet/aspnetcore" target="_blank" rel="noopener">ASP.NET Core</a></li>
                <li><a href="https://github.com/dotnet/maui" target="_blank" rel="noopener">.NET MAUI</a></li>
                <li><a href="https://unity.com" target="_blank" rel="noopener">Unity</a></li>
                <li><a href="https://github.com/AvaloniaUI/Avalonia" target="_blank" rel="noopener">Avalonia UI</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/ts"><L zh="TypeScript — Hejlsberg 第四语言" en="TypeScript — Hejlsberg's fourth language" /></a></li>
                <li><a href="/code/language/java"><L zh="Java — 25 年前的镜像兄弟" en="Java — mirror sibling, 25 years on" /></a></li>
                <li><a href="/code/language/kotlin"><L zh="Kotlin — 现代 JVM 同代" en="Kotlin — modern JVM peer" /></a></li>
                <li><a href="/code/language/swift"><L zh="Swift — 苹果的 C# 答卷" en="Swift — Apple's answer to C#" /></a></li>
                <li><a href="/code/language/mojo"><L zh="Mojo — AI 时代的 Hejlsberg-代" en="Mojo — the AI-era equivalent" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{CS_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`Console.WriteLine("C#, still here.");`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
