import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './java_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const JAVA_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="ja-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E76F00" />
        <stop offset="100%" stopColor="#5382A1" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#ja-grad)" />
    {/* steam wisps */}
    <path d="M96 56 Q108 44 96 32 Q84 22 96 12" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
    <path d="M132 60 Q144 48 132 36 Q120 26 132 16" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
    <path d="M168 56 Q180 44 168 32 Q156 22 168 12" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
    {/* coffee cup body */}
    <path d="M64 84 H172 V152 Q172 188 134 188 H102 Q64 188 64 152 Z" fill="#fff" />
    {/* cup handle */}
    <path d="M172 100 Q204 100 204 130 Q204 160 172 160" stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" />
    {/* saucer */}
    <ellipse cx="118" cy="208" rx="80" ry="10" fill="#fff" opacity=".9" />
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
    year: '1991',
    zh: { title: <>Sun "Green Project" 起步</>, desc: <>Sun Microsystems 内部"Green Team"由 James Gosling 牵头，目标是给智能家电（机顶盒、互动电视）做一门"<strong>跨硬件运行</strong>"的语言。语言代号 <code>Oak</code>——Gosling 办公室窗外那棵橡树。智能电视计划胎死腹中，但语言活下来了。</> },
    en: { title: <>Sun's "Green Project" begins</>, desc: <>Inside Sun Microsystems, James Gosling leads the "Green Team" to build a language for smart appliances (set-top boxes, interactive TV) that <strong>runs across heterogeneous hardware</strong>. The codename is <code>Oak</code> — after the tree outside Gosling's window. The smart-TV product is stillborn; the language survives.</> },
  },
  {
    year: <>1994<small>·08</small></>,
    zh: { title: <>SunWorld 首次公开演示</>, desc: <>方向从机顶盒拐到 Web。Oak 这个名字被另一家公司注册了，Sun 团队在咖啡馆里想新名字——<strong>Java</strong>，印尼盛产咖啡的爪哇岛。"咖啡 + 跨硬件 + 网络"的故事开始有了形状。</> },
    en: { title: <>First public demo at SunWorld</>, desc: <>The pivot from set-top boxes to the Web. The name "Oak" was already trademarked, so the team brainstormed in a coffee shop and landed on <strong>Java</strong> — Indonesia's coffee island. "Coffee + cross-hardware + the network" starts to gel as a story.</> },
  },
  {
    year: <>1995<small>·05·23</small></>, highlight: true,
    zh: { title: <>Java 正式发布 + HotJava 浏览器</>, desc: <>5 月 23 日，Sun 正式宣布 Java。同时给出 <strong>HotJava</strong> 浏览器：网页里的 applet 可在客户端跑——"<strong>Write Once, Run Anywhere</strong>"成为标语。Netscape 当年就内置 Java applet 支持。</> },
    en: { title: <>Java officially launched + HotJava browser</>, desc: <>May 23rd, Sun unveils Java. Alongside it ships the <strong>HotJava</strong> browser, where in-page applets run client-side. "<strong>Write Once, Run Anywhere</strong>" becomes the slogan. Netscape bundles applet support that same year.</> },
  },
  {
    year: <>1996<small>·01</small></>,
    zh: { title: <>JDK 1.0</>, desc: <>第一个公开 JDK 发布。AWT、IO、网络栈、applet runtime 一起到位。当年的 Java 拼的是<strong>"用一份字节码跨平台跑"</strong>这个新鲜的承诺——彼时 PC 还在 Win3.1 / Win95 / Mac / 各种 Unix 之间撕扯。</> },
    en: { title: <>JDK 1.0</>, desc: <>The first public JDK ships with AWT, IO, networking and the applet runtime. The pitch is <strong>"one bytecode running everywhere"</strong> — a fresh promise at a time when PCs were splintered across Win 3.1 / Win 95 / Mac / various Unixes.</> },
  },
  {
    year: <>1998<small>·12</small></>,
    zh: { title: <>J2SE 1.2 — Swing + Collections</>, desc: <>Java 史上第一个"大版本"。<strong>Swing</strong> GUI 工具包替换粗糙的 AWT；<strong>Collections framework</strong>（<code>List</code> / <code>Map</code> / <code>Set</code> + 算法）——后来被几乎所有静态语言抄走的设计。"Java 2"品牌在此立起来。</> },
    en: { title: <>J2SE 1.2 — Swing + Collections</>, desc: <>Java's first "big" release. <strong>Swing</strong> replaces the crude AWT GUI toolkit; the <strong>Collections framework</strong> (<code>List</code> / <code>Map</code> / <code>Set</code> with algorithms) lands — a design later borrowed by nearly every statically-typed language. The "Java 2" brand is born.</> },
  },
  {
    year: <>2004<small>·09</small></>, highlight: true,
    zh: { title: <>J2SE 5.0 — 现代 Java 的基线</>, desc: <>一次性塞进<strong>泛型</strong>、<strong>autoboxing</strong>、<strong>枚举</strong>、<strong>注解</strong>、<strong>varargs</strong>、增强 <code>for</code>。Java 一夜从"啰嗦的 90 年代语言"跳到"工程主流"。日后 Spring / Hibernate / JUnit 都建立在这个基线之上。</> },
    en: { title: <>J2SE 5.0 — the modern Java baseline</>, desc: <>One release dropped <strong>generics</strong>, <strong>autoboxing</strong>, <strong>enums</strong>, <strong>annotations</strong>, <strong>varargs</strong> and the enhanced <code>for</code>. Java leapt from "verbose 90s language" to "engineering mainstream" overnight. Spring, Hibernate and JUnit are all built on top of this baseline.</> },
  },
  {
    year: <>2006<small>·11</small></>,
    zh: { title: <>开源 OpenJDK</>, desc: <>11 月，Sun 把 Java 编译器、HotSpot VM、类库以 GPL 协议放出，<strong>OpenJDK</strong> 项目成立。Java 从"Sun 的私产"变成开源资产，社区可以审 commit、贡献补丁——也为后来的 Linux 发行版自带 OpenJDK 铺路。</> },
    en: { title: <>Open-sourced as OpenJDK</>, desc: <>November. Sun releases the compiler, HotSpot VM and class libraries under GPL — the <strong>OpenJDK</strong> project is born. Java goes from "Sun's private asset" to an open one; the community can audit commits, file patches, and Linux distros can ship OpenJDK by default.</> },
  },
  {
    year: <>2008<small>·09</small></>,
    zh: { title: <>Android 1.0 — Java 进入手机</>, desc: <>Google 发布 Android 1.0。语法用 <strong>Java</strong>，但跑在自家 Dalvik VM 上、不直接走 JVM 字节码。这一刻 Java 跨进了移动平台——之后 ~10 年是 Android 的事实主语言（直到 2017 Kotlin 上位，详见 <a href="/code/kotlin">/code/kotlin</a>）。</> },
    en: { title: <>Android 1.0 — Java reaches mobile</>, desc: <>Google ships Android 1.0. The syntax is <strong>Java</strong>, but it runs on Dalvik VM rather than the JVM directly. This is the moment Java steps onto mobile — and stays the de-facto language of Android for ~10 years, until Kotlin's rise in 2017 (see <a href="/code/kotlin">/code/kotlin</a>).</> },
  },
  {
    year: <>2010<small>·01</small></>,
    zh: { title: <>Oracle 收购 Sun</>, desc: <>74 亿美元。Java 团队、HotSpot、Solaris 一起易主。同年 Oracle 起诉 Google，控告 Android 中 Java API 的使用——这场<strong>持续 10 年的官司</strong>最终在 2021 年由美国最高法院判 Google 合理使用。Java 治理风格从"Sun 学院派"变"Oracle 法务派"。</> },
    en: { title: <>Oracle acquires Sun</>, desc: <>$7.4 billion. The Java team, HotSpot and Solaris all change hands. Oracle promptly sues Google over Java API use in Android — a <strong>decade-long lawsuit</strong> the U.S. Supreme Court ultimately resolves in Google's favor (fair use) in 2021. Java governance turns from "Sun academic" to "Oracle legal."</> },
  },
  {
    year: <>2014<small>·03</small></>, highlight: true,
    zh: { title: <>Java 8 — Lambda + Streams + Optional</>, desc: <>3 月 18 日。<strong>函数式范式</strong>正式入语言：<code>(x) -&gt; x*2</code> lambda、<code>Stream</code> 管道、<code>Optional</code>、接口默认方法、新的 <code>java.time</code>。这是 Java 史上<strong>语言层面最大的一次现代化</strong>，规模相当于 JS 的 ES6。后来好多年 Java 8 是"事实标准"，今天还有大量企业代码停在这。</> },
    en: { title: <>Java 8 — lambdas, Streams, Optional</>, desc: <>March 18th. <strong>Functional-style</strong> lands in the language: <code>(x) -&gt; x*2</code> lambdas, <code>Stream</code> pipelines, <code>Optional</code>, default methods on interfaces, the new <code>java.time</code> API. This is the <strong>single biggest language-level modernisation</strong> in Java's history — comparable in scale to JS's ES6. Java 8 becomes the de-facto standard for years; plenty of enterprise code still sits on it today.</> },
  },
  {
    year: <>2017<small>·09</small></>,
    zh: { title: <>Java 9 — 模块系统 + 6 月节奏</>, desc: <>Project Jigsaw 落地，<strong>module-info.java</strong> 正式上线，JDK 自身被切成 ~70 个模块。同时改成<strong>每 6 个月一个新版本</strong>——当年争议很大（"小版本太多"），现在被证明是对的：语言演进节奏比 Sun 时代快得多。</> },
    en: { title: <>Java 9 — modules + 6-month cadence</>, desc: <>Project Jigsaw ships: <strong>module-info.java</strong> goes live, the JDK itself is sliced into ~70 modules. Simultaneously the cadence flips to <strong>a new release every six months</strong> — controversial then ("too many minor versions"), vindicated since: language evolution moves much faster than under Sun.</> },
  },
  {
    year: <>2018<small>·09</small></>,
    zh: { title: <>Java 11 LTS — <code>var</code> 上线</>, desc: <>第一个 LTS（长期支持）版本，企业大规模迁移目标。带来局部变量推断 <code>var</code>（不是 JS 那种 var）、HTTP/2 客户端、ZGC 实验态。<em>"Oracle JDK 商用付费、OpenJDK 免费"</em> 的格局也从这里开始。</> },
    en: { title: <>Java 11 LTS — <code>var</code> arrives</>, desc: <>The first LTS (Long-Term Support) release that enterprises migrate to en masse. Brings local-variable type inference <code>var</code> (not JS's var), an HTTP/2 client, and ZGC in preview. The split <em>"Oracle JDK paid, OpenJDK free"</em> begins here.</> },
  },
  {
    year: <>2017<small>·05</small></>,
    zh: { title: <>Google I/O — Kotlin first-class on Android</>, desc: <>Android 圈地震：Google 把 Kotlin 列为一等公民。Java 在 Android 上的份额开始让位。<em>这条线后来在 /code/kotlin 接着讲</em>。Java 在服务端、企业级反而更稳——一刀两段的故事。</> },
    en: { title: <>Google I/O — Kotlin first-class on Android</>, desc: <>An Android-world earthquake: Google promotes Kotlin to first-class status. Java's mobile share starts shrinking. <em>That thread continues over at /code/kotlin</em>. On the server / enterprise side, meanwhile, Java actually consolidates — a tale of two halves.</> },
  },
  {
    year: <>2021<small>·09</small></>, highlight: true,
    zh: { title: <>Java 17 LTS — 现代 Java 体感</>, desc: <>第二个广泛迁移的 LTS。带来 <strong>records</strong>（一行 data class）、<strong>sealed classes</strong>（密封继承）、<code>instanceof</code> 的<strong>模式匹配</strong>、文本块 <code>"""</code>。Java 第一次让人感觉"<em>写起来不那么憋了</em>"——很多 2014 来的 Kotlin / Scala 优势被搬回主线。</> },
    en: { title: <>Java 17 LTS — modern Java starts feeling ergonomic</>, desc: <>The second widely-adopted LTS. Brings <strong>records</strong> (one-line value classes), <strong>sealed classes</strong>, <strong>pattern matching for <code>instanceof</code></strong>, and text blocks <code>"""</code>. For the first time Java <em>doesn't feel cramped</em>; many wins that Kotlin / Scala had since 2014 land back in mainline Java.</> },
  },
  {
    year: <>2023<small>·09</small></>, highlight: true,
    zh: { title: <>Java 21 LTS — 虚拟线程 (Project Loom)</>, desc: <>21 LTS 是过去 10 年最重磅的一次更新。<strong>Virtual Threads</strong>（Project Loom）：JVM 自带 M:N 协程式线程，写同步代码、跑得像异步——<strong>不用 async/await、不污染函数颜色</strong>。叠加 switch 模式匹配、sequenced collections。Java 在高并发服务端拿回了被 Go 抢去的地盘。</> },
    en: { title: <>Java 21 LTS — virtual threads (Project Loom)</>, desc: <>The biggest single upgrade in a decade. <strong>Virtual threads</strong> (Project Loom): the JVM ships M:N coroutine-style threads — write synchronous code, run it asynchronously — <strong>no async/await, no function colouring</strong>. Plus pattern matching for <code>switch</code> and sequenced collections. Java wins back high-concurrency server territory previously ceded to Go.</> },
  },
  {
    year: <>2024<small>·09</small></>,
    zh: { title: <>Java 23 — 模式 / GC / FFM 持续推进</>, desc: <><strong>原始类型模式匹配</strong>稳定（<code>switch (x) {'{ case int i -> ... }'}</code>）；<strong>ZGC 默认走分代模式</strong>大幅降低大堆延迟；FFI（Project Panama 的 Foreign Function &amp; Memory API）正式 stable——替代 30 年的 JNI。<em>6 月节奏继续每年两个版本，工程上越来越像 Rust / Go 的小步快跑</em>。</> },
    en: { title: <>Java 23 — patterns, GC, FFM keep advancing</>, desc: <><strong>Primitive type patterns</strong> stable (<code>switch (x) {'{ case int i -> ... }'}</code>); <strong>ZGC's generational mode</strong> becomes default and slashes large-heap latency; the FFI (Project Panama's Foreign Function &amp; Memory API) ships stable, retiring 30 years of JNI. <em>Two releases a year continues; engineering feels increasingly like Rust / Go's incremental march</em>.</> },
  },
  {
    year: '2026',
    zh: { title: <>30 岁 · 仍在 Top 3</>, desc: <>TIOBE / RedMonk 排行榜 Java 长期位居<strong>前三</strong>。Spring Boot 是企业级 Java 的事实框架。JVM 是<strong>地球上被调优最多次的运行时</strong>——几十种 GC 选项、数十年 JIT 智慧。AI 代码生成对 Java 极其熟练，因为公开训练语料里 Java 占比巨大（GitHub 历年第 2 / 3 名语言）。</> },
    en: { title: <>30 years old, still top 3</>, desc: <>Java sits firmly in the <strong>top three</strong> on TIOBE / RedMonk year after year. Spring Boot is the de-facto enterprise Java framework. The JVM is <strong>the most-tuned runtime on the planet</strong> — dozens of GC choices, decades of JIT wisdom. AI code generation is fluent in Java because public training corpora are saturated with it (Java has been #2 or #3 on GitHub for years).</> },
  },
];

interface JaCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const JA_CARDS: JaCard[] = [
  {
    tag: 'A',
    zh: { title: <>Class &amp; Interface</>, desc: <>Java 是<strong>"类 + 接口"</strong>的纯 OOP 语言，没有自由函数。从 Java 8 起接口可以带 <code>default</code> 方法，等于把 Scala 的 trait 引了一半进来。</> },
    en: { title: <>Class &amp; interface</>, desc: <>Java is <strong>pure class+interface</strong> OOP — no free functions. Since Java 8, interfaces can carry <code>default</code> methods — half of Scala's trait pulled in.</> },
    code: (
      <code>
        <span className="cl-k">interface</span> <span className="cl-type">Greeter</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">String</span> <span className="cl-fn">hello</span>(<span className="cl-type">String</span> <span className="cl-v">name</span>);{'\n'}
        {'  '}<span className="cl-k">default</span> <span className="cl-type">String</span> <span className="cl-fn">shout</span>(<span className="cl-type">String</span> <span className="cl-v">n</span>) {'{'}{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-fn">hello</span>(<span className="cl-v">n</span>).<span className="cl-fn">toUpperCase</span>();{'\n'}
        {'  }'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>Generics <code>&lt;T&gt;</code></>, desc: <>Java 5 起的泛型，但是<strong>类型擦除</strong>实现：编译期检查、运行时只剩 <code>Object</code>。代价是无法 <code>new T()</code>、不能 <code>instanceof List&lt;String&gt;</code>——但保住了 JVM 字节码兼容。</> },
    en: { title: <>Generics <code>&lt;T&gt;</code></>, desc: <>Generics since Java 5, but with <strong>type erasure</strong>: checked at compile time, erased to <code>Object</code> at runtime. The cost: no <code>new T()</code>, no <code>instanceof List&lt;String&gt;</code> — the gain: full JVM bytecode compatibility.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Box</span>&lt;<span className="cl-type">T</span>&gt; {'{'}{'\n'}
        {'  '}<span className="cl-k">private</span> <span className="cl-type">T</span> <span className="cl-v">v</span>;{'\n'}
        {'  '}<span className="cl-k">public</span> <span className="cl-type">T</span> <span className="cl-fn">get</span>() {'{ '}<span className="cl-k">return</span> <span className="cl-v">v</span>; {'}'}{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-type">Box</span>&lt;<span className="cl-type">String</span>&gt; <span className="cl-v">b</span> = <span className="cl-k">new</span> <span className="cl-fn">Box</span>&lt;&gt;();{'\n'}
        <span className="cl-c">{'// runtime: just Box, T is erased'}</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>Lambda + Streams</>, desc: <>Java 8 起，<code>x -&gt; x*2</code> 是合法 lambda；<code>Stream</code> 给集合加了惰性管道（<code>filter</code> / <code>map</code> / <code>reduce</code> / <code>collect</code>）。<strong>不要在主线程跑 IO</strong>，但纯计算管道很顺手。</> },
    en: { title: <>Lambdas + Streams</>, desc: <>Since Java 8, <code>x -&gt; x*2</code> is a valid lambda; <code>Stream</code> adds lazy pipelines over collections (<code>filter</code> / <code>map</code> / <code>reduce</code> / <code>collect</code>). <strong>Not for blocking IO</strong>, but pure computation pipelines feel nice.</> },
    code: (
      <code>
        <span className="cl-k">var</span> <span className="cl-v">total</span> = <span className="cl-v">orders</span>.<span className="cl-fn">stream</span>(){'\n'}
        {'  '}.<span className="cl-fn">filter</span>(<span className="cl-v">o</span> -&gt; <span className="cl-v">o</span>.<span className="cl-fn">isPaid</span>()){'\n'}
        {'  '}.<span className="cl-fn">mapToInt</span>(<span className="cl-type">Order</span>::<span className="cl-fn">amount</span>){'\n'}
        {'  '}.<span className="cl-fn">sum</span>();
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>Optional&lt;T&gt;</code></>, desc: <>2014 起官方"<strong>不要 null</strong>"出口。返回值用 <code>Optional</code> 把缺失语义放进类型里——但<strong>不像 Kotlin</strong>，普通字段还是可以是 null，靠约定不靠类型系统。</> },
    en: { title: <><code>Optional&lt;T&gt;</code></>, desc: <>Java's 2014 "<strong>don't return null</strong>" escape hatch. Wrap missing values in <code>Optional</code> at the API boundary — but <strong>unlike Kotlin</strong>, ordinary fields can still be null. Convention, not type system.</> },
    code: (
      <code>
        <span className="cl-type">Optional</span>&lt;<span className="cl-type">User</span>&gt; <span className="cl-fn">find</span>(<span className="cl-type">long</span> <span className="cl-v">id</span>) {'{ ... }'}{'\n\n'}
        <span className="cl-fn">find</span>(<span className="cl-n">42</span>){'\n'}
        {'  '}.<span className="cl-fn">map</span>(<span className="cl-type">User</span>::<span className="cl-fn">name</span>){'\n'}
        {'  '}.<span className="cl-fn">orElse</span>(<span className="cl-s">"-"</span>);
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>record</code> (Java 14)</>, desc: <>一行写 value object：<strong>final 字段、equals / hashCode / toString / 访问器</strong>自动来。等价于 Kotlin 的 <code>data class</code>，慢了 7 年但终究到了。</> },
    en: { title: <><code>record</code> (Java 14)</>, desc: <>One line for a value object: <strong>final fields, equals / hashCode / toString and accessors all generated</strong>. The Java equivalent of Kotlin's <code>data class</code> — seven years late, but here.</> },
    code: (
      <code>
        <span className="cl-k">record</span> <span className="cl-type">Point</span>(<span className="cl-type">int</span> <span className="cl-v">x</span>, <span className="cl-type">int</span> <span className="cl-v">y</span>) {'{ }'}{'\n\n'}
        <span className="cl-k">var</span> <span className="cl-v">p</span> = <span className="cl-k">new</span> <span className="cl-fn">Point</span>(<span className="cl-n">3</span>, <span className="cl-n">4</span>);{'\n'}
        <span className="cl-v">p</span>.<span className="cl-fn">x</span>();         <span className="cl-c">// 3</span>{'\n'}
        <span className="cl-v">p</span>.<span className="cl-fn">toString</span>();  <span className="cl-c">// Point[x=3, y=4]</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>sealed</code> + pattern</>, desc: <>Java 17 起 <code>sealed</code> 把"所有合法子类型"约束在一个文件里，配合 <code>switch</code> 模式匹配，编译期穷尽性检查——<strong>ADT in OOP clothing</strong>。</> },
    en: { title: <><code>sealed</code> + pattern matching</>, desc: <>Since Java 17, <code>sealed</code> confines all legal subtypes to one file; combined with <code>switch</code> patterns, the compiler enforces exhaustiveness — <strong>ADT in OOP clothing</strong>.</> },
    code: (
      <code>
        <span className="cl-k">sealed interface</span> <span className="cl-type">Shape</span>{'\n'}
        {'  '}<span className="cl-k">permits</span> <span className="cl-type">Circle</span>, <span className="cl-type">Square</span> {'{ }'}{'\n\n'}
        <span className="cl-k">var</span> <span className="cl-v">area</span> = <span className="cl-k">switch</span> (<span className="cl-v">s</span>) {'{'}{'\n'}
        {'  '}<span className="cl-k">case</span> <span className="cl-type">Circle</span> <span className="cl-v">c</span>  -&gt; <span className="cl-v">c</span>.<span className="cl-fn">r</span>() * <span className="cl-v">c</span>.<span className="cl-fn">r</span>() * <span className="cl-n">3.14</span>;{'\n'}
        {'  '}<span className="cl-k">case</span> <span className="cl-type">Square</span> <span className="cl-v">q</span> -&gt; <span className="cl-v">q</span>.<span className="cl-fn">side</span>() * <span className="cl-v">q</span>.<span className="cl-fn">side</span>();{'\n'}
        {'}'};
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>Virtual Threads (Java 21)</>, desc: <>Project Loom 的果子：<strong>百万级线程，写同步语义</strong>，JVM 调度。<code>Thread.startVirtualThread</code> 直接起一个虚拟线程；阻塞 IO 自动 unmount，不烧 OS 线程。Java 在高并发服务端<strong>不再需要 reactor</strong>。</> },
    en: { title: <>Virtual threads (Java 21)</>, desc: <>The Project Loom payoff: <strong>millions of threads with sync semantics</strong>, JVM-scheduled. <code>Thread.startVirtualThread</code> spawns a virtual thread; blocking IO auto-unmounts, OS threads stay free. Java <strong>no longer needs reactor frameworks</strong> for high-concurrency servers.</> },
    code: (
      <code>
        <span className="cl-k">try</span> (<span className="cl-k">var</span> <span className="cl-v">e</span> = <span className="cl-type">Executors</span>.<span className="cl-fn">newVirtualThreadPerTaskExecutor</span>()) {'{'}{'\n'}
        {'  '}<span className="cl-type">IntStream</span>.<span className="cl-fn">range</span>(<span className="cl-n">0</span>, <span className="cl-n">1_000_000</span>).<span className="cl-fn">forEach</span>(<span className="cl-v">i</span> -&gt;{'\n'}
        {'    '}<span className="cl-v">e</span>.<span className="cl-fn">submit</span>(() -&gt; <span className="cl-fn">httpGet</span>(<span className="cl-s">"/u/"</span> + <span className="cl-v">i</span>))){'\n'}
        {'}'} <span className="cl-c">// 1M virtual threads, OK</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>JVM · GC · JIT</>, desc: <>Java 的真正护城河是<strong>运行时</strong>。HotSpot JIT 跑久了能逼近 C++；<strong>GC 选项 7+ 种</strong>（G1 / ZGC / Shenandoah / Parallel ...）；现成的火焰图、JFR、async-profiler 工具链。<em>地球上被调优最多次的运行时</em>。</> },
    en: { title: <>The JVM (HotSpot, GC, JIT)</>, desc: <>Java's real moat is the <strong>runtime</strong>. HotSpot's JIT, given enough time, approaches C++ throughput; <strong>seven-plus GCs</strong> to choose from (G1 / ZGC / Shenandoah / Parallel ...); flame graphs, JFR, async-profiler all out of the box. <em>The most-tuned runtime on the planet</em>.</> },
    code: (
      <code>
        <span className="cl-c">$ java -XX:+UseZGC -Xmx32g App</span>{'\n'}
        <span className="cl-c">$ jcmd &lt;pid&gt; JFR.start duration=60s</span>{'\n'}
        <span className="cl-c">$ jcmd &lt;pid&gt; GC.heap_info</span>
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
    icon: '⌁',
    zh: { title: <>JVM 是平台</>, desc: <>HotSpot 是<strong>地球上被调优最多次的运行时</strong>。GC 选 7+ 种、JIT 经 25 年磨；JFR / async-profiler / 火焰图工具链成熟到给同事一发就能定位 GC 抖动。<strong>语言是 Java，护城河是 JVM</strong>。</> },
    en: { title: <>The JVM is the platform</>, desc: <><strong>The most-tuned runtime in the world</strong>. Seven-plus GCs to pick, a 25-year-old JIT, an observability stack (JFR, async-profiler, flame graphs) mature enough that a single trace fingers a GC blip. <strong>The language is Java; the moat is the JVM.</strong></> },
    code: <><span className="cl-c">// pick a GC at launch</span>{'\n'}<span className="cl-c">java -XX:+UseZGC App</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>30 年向后兼容</>, desc: <>1996 写的 .class 文件今天还能在最新 JVM 跑（除了少数老 API 弃用）。这是 Java 工程界的<strong>"无可比拟的稳定性承诺"</strong>，企业敢把 20 年代码继续养在 Java 上的根本原因。</> },
    en: { title: <>30 years of backward compatibility</>, desc: <>A <code>.class</code> compiled in 1996 still runs on the latest JVM (modulo a handful of deprecated APIs). This is Java's <strong>unmatched stability promise</strong> — the reason enterprises trust 20-year-old codebases to keep paying rent in Java.</> },
    code: <><span className="cl-c">// jdk1.0 .class → java 23 — runs</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>企业级重力</>, desc: <>银行、政府、电信、能源、大型数据系统——<strong>关键业务大体仍在 JVM 上</strong>。Goldman Sachs 的 SecDB、Wall Street 几乎所有交易撮合、Apache Hadoop / Kafka / Spark / Cassandra 全是 Java。</> },
    en: { title: <>Enterprise gravity</>, desc: <>Banks, governments, telecoms, energy grids, large data systems — <strong>most mission-critical workloads still run on the JVM</strong>. Goldman Sachs' SecDB, virtually every Wall Street matching engine, Hadoop / Kafka / Spark / Cassandra — all Java.</> },
    code: <><span className="cl-c">// Kafka, Spark, Hadoop, Flink</span>{'\n'}<span className="cl-c">// → all JVM workloads</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>2017 后现代化加速</>, desc: <>Java 9 改成<strong>每 6 个月</strong>一个版本后，14 / 17 / 21 / 23 一路把 records、sealed、pattern matching、virtual threads 推上来。<em>"Java 八不变"</em>那个印象 2026 年早过时——<strong>21 LTS 才是当下基线</strong>。</> },
    en: { title: <>Modernisation since 2017</>, desc: <>Once Java 9 flipped to a <strong>six-month release cadence</strong>, versions 14 / 17 / 21 / 23 marched out records, sealed types, pattern matching and virtual threads. The "<em>Java 8 forever</em>" stereotype is years out of date — <strong>21 LTS is the current baseline</strong>.</> },
    code: <><span className="cl-c">// Java 21+: var, records,</span>{'\n'}<span className="cl-c">// sealed, switch patterns, vthreads</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>工具链成熟到顶</>, desc: <><strong>IntelliJ IDEA</strong>（JetBrains）几乎垄断了"地球上最好的语言重构体验"。<strong>Maven / Gradle</strong>是事实标准。<strong>Spring Boot</strong>是企业级 Java 的"Rails"，<strong>JUnit / Mockito / Testcontainers</strong>把测试链路打满。</> },
    en: { title: <>The tool chain is unmatched</>, desc: <><strong>IntelliJ IDEA</strong> (JetBrains) is widely considered the best language refactoring experience on Earth. <strong>Maven / Gradle</strong> are the de-facto build tools. <strong>Spring Boot</strong> is enterprise Java's "Rails"; <strong>JUnit / Mockito / Testcontainers</strong> blanket the testing layer.</> },
    code: <><span className="cl-c">// IntelliJ + Maven + Spring Boot</span>{'\n'}<span className="cl-c">// → 90% of Java shops, 2026</span></>,
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
    href: 'https://www.google.com', highlight: true,
    zhName: 'Google', enName: 'Google',
    zhNote: '搜索 / Android 早期', enNote: 'Search backend / early Android',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="none" stroke="#4285F4" strokeWidth="10"/><path d="M50 50 H88 A40 40 0 0 1 50 90 Z" fill="#34A853"/><path d="M50 50 V90 A40 40 0 0 1 14 64 Z" fill="#FBBC05"/><path d="M50 50 L14 64 A40 40 0 0 1 50 10 Z" fill="#EA4335"/><rect x="50" y="44" width="40" height="12" fill="#fff"/></svg>,
  },
  {
    href: 'https://aws.amazon.com', highlight: true,
    zhName: 'Amazon', enName: 'Amazon',
    zhNote: '海量后端 Java', enNote: 'Massive Java backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#232F3E"/><path d="M22 60 Q50 76 78 60" stroke="#FF9900" strokeWidth="6" fill="none" strokeLinecap="round"/><path d="M68 56 L80 60 L74 70" stroke="#FF9900" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><text x="50" y="48" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="sans-serif">a</text></svg>,
  },
  {
    href: 'https://netflix.com', highlight: true,
    zhName: 'Netflix', enName: 'Netflix',
    zhNote: '微服务架构 / Eureka / Hystrix', enNote: 'Microservices / Eureka / Hystrix',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="20" y="10" width="20" height="80" fill="#E50914"/><rect x="60" y="10" width="20" height="80" fill="#E50914"/><polygon points="22,10 38,10 80,90 64,90" fill="#831010"/></svg>,
  },
  {
    href: 'https://www.linkedin.com',
    zhName: 'LinkedIn', enName: 'LinkedIn',
    zhNote: 'Voldemort · Kafka 起源地', enNote: 'Voldemort · birthplace of Kafka',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A66C2"/><rect x="22" y="40" width="14" height="40" fill="#fff"/><circle cx="29" cy="28" r="7" fill="#fff"/><path d="M44 40 H58 V46 Q64 38 74 40 Q80 42 80 54 V80 H66 V58 Q66 50 60 50 Q54 50 54 58 V80 H44 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://twitter.com',
    zhName: 'Twitter / X', enName: 'Twitter / X',
    zhNote: '早期 Java · Finagle', enNote: 'Early Java · Finagle',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M22 22 L46 56 L22 78 H32 L51 62 L65 78 H80 L54 46 L77 22 H68 L50 40 L36 22 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://uber.com',
    zhName: 'Uber', enName: 'Uber',
    zhNote: '后端 + Android Java', enNote: 'Backend + Android Java',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><rect x="22" y="42" width="56" height="16" fill="#fff"/><text x="50" y="70" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="sans-serif">UBER</text></svg>,
  },
  {
    href: 'https://apple.com',
    zhName: 'Apple', enName: 'Apple',
    zhNote: 'iCloud 后端', enNote: 'iCloud backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M58 22 Q56 30 50 32 Q46 32 44 28 Q46 22 52 20 Q56 20 58 22 M70 56 Q70 46 78 40 Q72 32 60 32 Q52 32 48 36 Q44 32 36 32 Q22 34 20 54 Q20 76 32 84 Q38 86 44 82 Q48 80 52 80 Q56 80 60 82 Q66 86 72 84 Q80 78 84 66 Q76 64 70 56 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.spotify.com',
    zhName: 'Spotify', enName: 'Spotify',
    zhNote: 'JVM 微服务', enNote: 'JVM microservices',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#1DB954"/><path d="M28 42 Q50 36 74 46" stroke="#000" strokeWidth="5" fill="none" strokeLinecap="round"/><path d="M30 54 Q50 50 70 58" stroke="#000" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M32 66 Q50 62 66 68" stroke="#000" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://www.airbnb.com',
    zhName: 'Airbnb', enName: 'Airbnb',
    zhNote: '数据基础设施 Java', enNote: 'Data infrastructure in Java',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 C30 12 12 50 28 75 C36 88 50 90 50 75 C50 60 38 55 38 45 C38 35 43 28 50 28 C57 28 62 35 62 45 C62 55 50 60 50 75 C50 90 64 88 72 75 C88 50 70 12 50 12 Z" fill="#FF5A5F"/></svg>,
  },
  {
    href: 'https://www.goldmansachs.com', highlight: true,
    zhName: 'Goldman Sachs', enName: 'Goldman Sachs',
    zhNote: 'SecDB · Slang 跑在 JVM 上', enNote: 'SecDB · Slang on the JVM',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#7399C6"/><text x="50" y="44" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="serif">Goldman</text><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="serif">Sachs</text></svg>,
  },
  {
    href: 'https://www.minecraft.net', highlight: true,
    zhName: 'Minecraft', enName: 'Minecraft',
    zhNote: 'Java Edition · 原版游戏', enNote: 'Java Edition · the original',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="6" fill="#3B7B3B"/><rect x="20" y="20" width="20" height="20" fill="#5BAA5B"/><rect x="60" y="20" width="20" height="20" fill="#7AC97A"/><rect x="20" y="60" width="20" height="20" fill="#7AC97A"/><rect x="60" y="60" width="20" height="20" fill="#5BAA5B"/><rect x="40" y="40" width="20" height="20" fill="#8B5A2B"/></svg>,
  },
  {
    href: 'https://www.nasa.gov',
    zhName: 'NASA', enName: 'NASA',
    zhNote: '任务系统 Java', enNote: 'Mission systems in Java',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#0B3D91"/><path d="M22 50 Q50 28 78 50 Q70 56 60 54 Q50 50 40 56 Q30 60 22 50 Z" fill="#fff"/><circle cx="62" cy="42" r="3" fill="#FC3D21"/><text x="50" y="68" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="sans-serif">NASA</text></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'Spring Boot',     zhDesc: '企业 Java 的事实框架', enDesc: 'De-facto enterprise framework' },
  { name: 'Apache Kafka',    zhDesc: 'LinkedIn 起源 · 流处理之王', enDesc: 'Born at LinkedIn · stream king' },
  { name: 'Apache Spark',    zhDesc: 'Scala/Java · 大数据计算', enDesc: 'Scala/Java · big-data compute' },
  { name: 'Hadoop',          zhDesc: '分布式存储 + MapReduce', enDesc: 'HDFS + MapReduce' },
  { name: 'Cassandra',       zhDesc: 'Facebook 起源 · 宽列存储', enDesc: 'Born at FB · wide-column store' },
  { name: 'Elasticsearch',   zhDesc: '搜索引擎 · Lucene 之上', enDesc: 'Search engine · on Lucene' },
  { name: 'IntelliJ IDEA',   zhDesc: 'JetBrains · 顶配 IDE', enDesc: 'JetBrains · best-in-class IDE' },
  { name: 'Eclipse',         zhDesc: '老牌开源 IDE', enDesc: 'Veteran open-source IDE' },
  { name: 'Maven',           zhDesc: '20+ 年 build 标杆', enDesc: '20+ years of build tooling' },
  { name: 'Gradle',          zhDesc: '现代构建系统', enDesc: 'Modern JVM build system' },
  { name: 'JUnit',           zhDesc: 'xUnit 家族鼻祖', enDesc: 'Original xUnit framework' },
  { name: 'Hibernate',       zhDesc: 'JPA · ORM 之王', enDesc: 'JPA · the ORM standard' },
  { name: 'GraalVM',         zhDesc: 'AOT native image', enDesc: 'AOT native image' },
  { name: 'Quarkus',         zhDesc: '云原生 Java · 快启动', enDesc: 'Cloud-native fast-start Java' },
  { name: 'Micronaut',       zhDesc: 'AOT 编译期 DI', enDesc: 'Compile-time DI' },
  { name: 'LangChain4j',     zhDesc: 'Java 的 LLM 编排', enDesc: 'LLM orchestration for Java' },
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
    tag: <>HOT · 2023+</>, hot: true, big: true,
    zh: {
      title: <>Project Loom 成熟 — 虚拟线程 + 结构化并发</>,
      body: (<>
        <p>Java 21 的<strong>虚拟线程</strong>（Project Loom）已 stable，<strong>结构化并发</strong>（Project Loom 的姊妹项）在 Java 23 进入二次预览。意思是：写阻塞式同步代码、JVM 自动 M:N 调度，<strong>不需要 async/await、不污染函数颜色</strong>——Go 的 goroutine 模式，但带"父作用域结束即取消"的层级语义。</p>
        <p>结果是 Java 在<strong>高并发 web 服务端</strong>把 Go 抢去的地盘抢了一部分回来。Helidon Níma、Quarkus、新版 Spring 全面接 virtual threads。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Platform Threads (~OS 1:1)</span><span className="bar-val">~10k</span></div>
          <div className="bar bar-new"><span className="bar-label">Virtual Threads (Loom M:N)</span><span className="bar-val">~10M</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Project Loom matures — virtual threads + structured concurrency</>,
      body: (<>
        <p>Java 21's <strong>virtual threads</strong> (Project Loom) are stable; <strong>structured concurrency</strong> (Loom's sibling) is in second preview as of Java 23. Translation: write blocking synchronous code; the JVM does the M:N scheduling for you. <strong>No async/await, no function colouring</strong> — Go's goroutine model, with hierarchical "parent scope ends, all children cancel" semantics on top.</p>
        <p>The effect is that Java has clawed back a chunk of the <strong>high-concurrency server</strong> territory previously dominated by Go. Helidon Níma, Quarkus and modern Spring all wire virtual threads in.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Platform threads (~OS 1:1)</span><span className="bar-val">~10k</span></div>
          <div className="bar bar-new"><span className="bar-label">Virtual threads (Loom M:N)</span><span className="bar-val">~10M</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'VALHALLA',
    zh: { title: <>Project Valhalla — value classes</>, body: <><p>给 Java 加<strong>用户自定义的"原始类型"</strong>：<code>value record</code>、扁平内存布局、不带身份。意思是 <code>Point(double x, double y)</code> 数组真的能像 C 一样连续放——大型数值计算 / 游戏 / 科学计算的最后一块短板。当前 preview，2026/2027 见。</p></> },
    en: { title: <>Project Valhalla — value classes</>, body: <><p>Adds <strong>user-defined "primitive-like" types</strong> to Java: <code>value record</code>, flat memory layout, no identity. A <code>Point(double x, double y)</code> array can finally pack contiguously like C's — closing Java's last gap in heavy numerics / games / scientific computing. Currently in preview; expected 2026/2027.</p></> },
  },
  {
    tag: 'PANAMA',
    zh: { title: <>Project Panama — FFM</>, body: <><p>Java 22 起 <strong>Foreign Function &amp; Memory API</strong> 正式 stable，替代了 30 年的 JNI。直接调 C / Rust 库，不写中间桥层；<strong>同步零拷贝</strong>访问堆外内存。配合 <code>jextract</code> 自动生成 binding——Java 与 C 之间的"<strong>FFI 终于不疼</strong>"。</p></> },
    en: { title: <>Project Panama — FFM</>, body: <><p>Since Java 22, the <strong>Foreign Function &amp; Memory API</strong> is stable, retiring 30 years of JNI. Call C / Rust libraries directly, no shim layer; <strong>zero-copy</strong> off-heap memory access. Combined with <code>jextract</code> auto-generating bindings, Java↔C FFI <strong>finally stops hurting</strong>.</p></> },
  },
  {
    tag: 'GRAALVM',
    zh: { title: <>GraalVM Native Image — AOT 出手</>, body: <><p>Oracle 自家的 GraalVM 把 Java 应用 AOT 编译成<strong>静态二进制</strong>：启动 ms 级、内存 1/3、不带 JIT warmup——非常适合 serverless / CLI / 容器。代价是反射 / 动态加载需要提前注册。Quarkus / Micronaut / Spring Boot Native 已接进生产。</p></> },
    en: { title: <>GraalVM Native Image — AOT</>, body: <><p>Oracle's GraalVM AOT-compiles Java apps to a <strong>static native binary</strong>: millisecond startup, ~1/3 the memory, no JIT warmup — ideal for serverless / CLI / containers. The trade-off is that reflection and dynamic class loading must be registered ahead of time. Quarkus, Micronaut and Spring Boot Native already ship it to production.</p></> },
  },
];

export default function JavaIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'Java : Write Once, Run Anywhere — 30 年仍在 Top 3 的 JVM 故事'
      : 'Java : Write Once, Run Anywhere — 30 years on, still top 3 on the JVM';
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .spotlight, .ai-reverse, .ai-takeaway, .quote-block'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ai-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--java-bright)' : '';
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
  }, []);

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="java-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="ja-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E76F00" />
                  <stop offset="100%" stopColor="#5382A1" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#ja-nav)" />
              <path d="M96 56 Q108 44 96 32 Q84 22 96 12" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
              <path d="M132 60 Q144 48 132 36 Q120 26 132 16" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
              <path d="M168 56 Q180 44 168 32 Q156 22 168 12" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".85" />
              <path d="M64 84 H172 V152 Q172 188 134 188 H102 Q64 188 64 152 Z" fill="#fff" />
              <path d="M172 100 Q204 100 204 130 Q204 160 172 160" stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" />
            </svg>
            <span>Java</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="现代化" en="Modern Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Kotlin" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1991 — 2026 · Sun → Oracle · "Write Once, Run Anywhere"</div>
            <h1 className="hero-title">
              <span className="hero-name">Java</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">RunAnywhere</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>给地球上每一台机器装一个 <strong>JVM</strong>，写一份字节码就能跑——这是 1995 年的承诺。30 年后 Java 仍在 TIOBE / RedMonk 前三：Spring Boot 是企业级事实框架，HotSpot 是被调优最多次的运行时，Java 21 的虚拟线程让它在高并发服务端把地盘抢了回来。</>}
                en={<>Drop a <strong>JVM</strong> on every machine on Earth and the same bytecode runs everywhere — that was the 1995 promise. Thirty years on, Java still sits in the TIOBE / RedMonk top three: Spring Boot is the enterprise framework, HotSpot is the most-tuned runtime in computing, and Java 21's virtual threads have clawed back high-concurrency server territory.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1995<small></small></span>
                <span className="stat-label"><L zh={<>5 月 23 日 公开发布<br /><em>Sun · HotJava · WORA</em></>} en={<>Public launch May 23<br /><em>Sun · HotJava · WORA</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">21<small></small></span>
                <span className="stat-label"><L zh={<>当前 LTS · 2023-09<br /><em>Loom · pattern · sequenced</em></>} en={<>Current LTS · 2023-09<br /><em>Loom · pattern · sequenced</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~10<small>M</small></span>
                <span className="stat-label"><L zh={<>虚拟线程并发量级<br /><em>Project Loom</em></>} en={<>Virtual thread scale<br /><em>Project Loom</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">Top 3<small></small></span>
                <span className="stat-label"><L zh={<>TIOBE / RedMonk 排名<br /><em>30 年依然</em></>} en={<>TIOBE / RedMonk rank<br /><em>30 years in</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{JAVA_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">public static void</span>
              <span className="float f2">{'List<String>'}</span>
              <span className="float f3">record Point</span>
              <span className="float f4">var name</span>
              <span className="float f5">sealed</span>
              <span className="float f6">@Override</span>
              <span className="float f7">virtual thread</span>
              <span className="float f8">Stream.of</span>
              <span className="float f9">switch (x)</span>
              <span className="float f10">try-with-res</span>
              <span className="float f11">Optional&lt;T&gt;</span>
              <span className="float f12">HotSpot JIT</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Java</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Java 是<strong>1995 年由 Sun 推出的 OOP 静态语言 + 虚拟机平台</strong>。语言负责"写一份"，<strong>JVM</strong> 负责"哪都能跑"——把字节码与 OS / CPU 解耦。30 年下来，语言本身被现代化（lambda / records / sealed / virtual threads），JVM 则积累了地球上最深的 GC / JIT 工程沉淀。</>}
                  en={<>Java is a <strong>statically-typed OOP language plus virtual machine</strong>, born at Sun in 1995. The language is "write once"; the <strong>JVM</strong> is "run anywhere" — bytecode decoupled from OS and CPU. Three decades later the language has been modernised (lambdas, records, sealed types, virtual threads) while the JVM has accumulated the deepest GC / JIT engineering on the planet.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="JVM 字节码" en="JVM bytecode" />, tag: 'platform', p: <L zh={<>编译成 <code>.class</code>，跑在任何 JVM 上。Linux / macOS / Windows / 大型机一份代码——这条承诺 30 年没变过。</>} en={<>Compiles to <code>.class</code> bytecode, runs on any JVM. Linux / macOS / Windows / mainframe — one source. The 30-year-old promise still holds.</>} /> },
                { h: <L zh="纯 OOP" en="Pure OOP" />, tag: 'object-oriented', p: <L zh={<>一切都是 class（自由函数没有，只有 <code>static</code> 方法）。8 种<strong>原始类型</strong>是唯一例外。</>} en={<>Everything is a class — no free functions, only <code>static</code> methods. The eight <strong>primitives</strong> are the only exception.</>} /> },
                { h: <L zh="GC 自动内存" en="GC managed memory" />, tag: 'gc', p: <L zh={<>不写 <code>malloc/free</code>。<strong>7+ 种 GC 可选</strong>：G1 / ZGC / Shenandoah / Parallel ...，按场景选。低延迟服务用 ZGC 都能压到 ms 级停顿。</>} en={<>No <code>malloc/free</code>. <strong>Seven-plus GCs</strong> to choose from — G1, ZGC, Shenandoah, Parallel ... Low-latency servers can hit millisecond pauses with ZGC.</>} /> },
                { h: <L zh="编译期类型" en="Compile-time types" />, tag: 'static', p: <L zh={<>编译期检查所有类型。Java 5 起带泛型，但<strong>类型擦除</strong>（运行时 <code>List&lt;String&gt;</code> 等于 <code>List</code>）——为兼容 1.0 字节码付的代价。</>} en={<>All types checked at compile time. Generics since Java 5, but with <strong>type erasure</strong> (<code>List&lt;String&gt;</code> at runtime is just <code>List</code>) — the price of 1.0 bytecode compatibility.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">User.java</span><span className="lang-tag js">Java 8 era</span></div>
                <pre className="code"><code>
                  <span className="cl-k">public class</span> <span className="cl-type">User</span> {'{'}{'\n'}
                  {'  '}<span className="cl-k">private final</span> <span className="cl-type">String</span> <span className="cl-v">name</span>;{'\n'}
                  {'  '}<span className="cl-k">private final</span> <span className="cl-type">int</span> <span className="cl-v">age</span>;{'\n\n'}
                  {'  '}<span className="cl-k">public</span> <span className="cl-fn">User</span>(<span className="cl-type">String</span> <span className="cl-v">n</span>, <span className="cl-type">int</span> <span className="cl-v">a</span>) {'{'}{'\n'}
                  {'    '}<span className="cl-k">this</span>.<span className="cl-prop">name</span> = <span className="cl-v">n</span>; <span className="cl-k">this</span>.<span className="cl-prop">age</span> = <span className="cl-v">a</span>;{'\n'}
                  {'  }'}{'\n\n'}
                  {'  '}<span className="cl-k">public</span> <span className="cl-type">String</span> <span className="cl-fn">getName</span>() {'{ '}<span className="cl-k">return</span> <span className="cl-v">name</span>; {'}'}{'\n'}
                  {'  '}<span className="cl-k">public</span> <span className="cl-type">int</span> <span className="cl-fn">getAge</span>() {'{ '}<span className="cl-k">return</span> <span className="cl-v">age</span>; {'}'}{'\n\n'}
                  {'  '}<span className="cl-k">@Override</span> <span className="cl-k">public boolean</span> <span className="cl-fn">equals</span>(...) {'{ ... }'}{'\n'}
                  {'  '}<span className="cl-k">@Override</span> <span className="cl-k">public int</span> <span className="cl-fn">hashCode</span>() {'{ ... }'}{'\n'}
                  {'  '}<span className="cl-k">@Override</span> <span className="cl-k">public</span> <span className="cl-type">String</span> <span className="cl-fn">toString</span>() {'{ ... }'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// ~60 行样板 — 这是 8 时代 Java 的刻板印象" en="// ~60 lines of boilerplate — the Java 8 stereotype" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">User.java</span><span className="lang-tag ts">Java 21+</span></div>
                <pre className="code"><code>
                  <span className="cl-k">public record</span> <span className="cl-type">User</span>(<span className="cl-type">String</span> <span className="cl-v">name</span>, <span className="cl-type">int</span> <span className="cl-v">age</span>) {'{ }'}{'\n\n'}
                  <span className="cl-c"><L zh="// 一行 — equals/hashCode/toString/访问器自动来" en="// One line — equals/hashCode/toString/accessors auto-generated" /></span>{'\n\n'}
                  <span className="cl-k">var</span> <span className="cl-v">a</span> = <span className="cl-k">new</span> <span className="cl-fn">User</span>(<span className="cl-s">"Gosling"</span>, <span className="cl-n">70</span>);{'\n'}
                  <span className="cl-v">a</span>.<span className="cl-fn">name</span>();    <span className="cl-c">// "Gosling"</span>{'\n\n'}
                  <span className="cl-k">var</span> <span className="cl-v">grown</span> = <span className="cl-k">switch</span> (<span className="cl-v">a</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-k">case</span> <span className="cl-type">User</span>(<span className="cl-k">var</span> <span className="cl-v">n</span>, <span className="cl-k">var</span> <span className="cl-v">y</span>) <span className="cl-k">when</span> <span className="cl-v">y</span> &gt; <span className="cl-n">18</span> -&gt; <span className="cl-v">n</span>;{'\n'}
                  {'  '}<span className="cl-k">case</span> <span className="cl-type">User</span> <span className="cl-v">u</span> -&gt; <span className="cl-s">"minor"</span>;{'\n'}
                  {'}'};{'\n\n'}
                  <span className="cl-c"><L zh="// 30 年的现代化都在这里" en="// 30 years of modernisation, distilled" /></span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>Sun 一群人想给智能电视写个跨硬件的语言；35 年后它在银行核心系统、Android 服务端、大数据栈、Minecraft 里都活着。中间穿过 Sun 倒下、Oracle 收购、Android 起飞、Kotlin 接管移动端、Java 21 拿回服务端——一段不死鸟的曲线。</>}
                en={<>A handful of people at Sun wanted a cross-hardware language for smart TVs; thirty-five years later it's alive inside bank cores, Android servers, the entire big-data stack, and Minecraft. The arc passes through Sun's fall, Oracle's acquisition, the rise of Android, Kotlin taking mobile, and Java 21 reclaiming the server — a phoenix curve.</>}
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

          {/* 03 Language Essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: JavaAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>很多人对 Java 的印象停在 8 时代。下面 8 张卡是<strong>2026 年的 Java 21+ 体感</strong>：class &amp; interface、泛型、Streams、Optional、records、sealed + pattern、virtual threads、JVM。</>}
                en={<>Most people's mental model of Java is frozen at version 8. The eight cards below are <strong>Java 21+ as it actually feels in 2026</strong>: class &amp; interface, generics, Streams, Optional, records, sealed + pattern, virtual threads, the JVM itself.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {JA_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>checked exceptions — Java 的"棱角"</>} en={<>Checked exceptions — Java's quirk</>} /></h3>
                <p><L
                  zh={<>Java 强迫你<strong>在签名里声明会抛的异常</strong>（<code>throws IOException</code>），调用方必须 catch 或继续 throws。这条规则在 Kotlin / Scala / Python 都没有，是 Java 独家——<em>有人爱死、有人恨死</em>。lambdas 与 Streams 跟 checked exception 结合得不太舒服，是 Java 8 后的著名痛点。</>}
                  en={<>Java forces you to <strong>declare every checked exception in the method signature</strong> (<code>throws IOException</code>); callers must catch or rethrow. No other major language carries this rule — <em>some people love it, some loathe it</em>. The friction with lambdas and Streams is Java 8's most famous papercut.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>30 年了，每个 Java 程序员都跟 checked exception 打过架。</>}
                  en={<>Thirty years in, every Java developer has wrestled checked exceptions at least once.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Java" /> <code>: WhyJava</code></h2>
              <p className="sec-desc"><L
                zh={<>Java 不是最时髦的语言、也不是最简洁的；但当目标是<strong>大型代码库长期维护、关键系统稳定运行、团队规模一百人以上</strong>，Java 的工程性价比仍然顶级。</>}
                en={<>Java is neither the trendiest nor the terse-est language going. But when the goal is a <strong>large codebase maintained for decades, mission-critical systems running 24/7, teams of 100+</strong>, Java's engineering payoff is still top-tier.</>}
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

          {/* 05 Projects */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>从 Wall Street 撮合引擎到 Minecraft，从 Netflix 微服务到 NASA 任务系统——Java 在<strong>关键 / 大规模 / 长期</strong>这三件事上几乎无对手。下面 12 个项目随手一抓的样本。</>}
                en={<>From Wall Street matching engines to Minecraft, from Netflix microservices to NASA mission systems — when the brief is <strong>mission-critical, large-scale, long-lived</strong>, Java has few peers. The 12 below are a casual sampling.</>}
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

          {/* 06 Modern Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="现代化 +" en="Modernisation +" /> <code>: <L zh="AI 时代" en="The AI Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>大众心里那个"Java 8 啰嗦无趣"的标签早就过期了。从 2017 年 6 月节奏改革开始，Java 用 records / sealed / virtual threads / FFM 把过去 10 年欠下的现代特性补齐——<strong>当下的 Java = 21 LTS，不是 8</strong>。AI 时代代码生成对 Java 极其友好，因为公开训练语料里 Java 占比巨大。</>}
                en={<>The "Java 8 is verbose and dull" stereotype is years out of date. Since the 2017 cadence flip, Java has shipped records, sealed types, virtual threads and FFM — clearing the modernisation backlog. <strong>Java today = 21 LTS, not 8</strong>. AI code generation is extremely fluent in Java because public training corpora are saturated with it.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>Java 走过的每一步取舍都偏向<strong>稳定 &gt; 时髦</strong>。我们等了七年才加 lambda，等了二十年才加 records。但代价是：1996 年写的 .class 今天还能跑。<strong>30 年向后兼容</strong>不是吹的，是地球上最大的企业代码资产保护——这是任何一门"漂亮但断代"的语言换不来的。</>}
                en={<>Every Java design trade-off has leaned toward <strong>stability over fashion</strong>. We waited seven years to add lambdas, twenty for records. The reward: a <code>.class</code> compiled in 1996 still runs today. <strong>Thirty years of backward compatibility</strong> isn't marketing — it's the largest enterprise-codebase preservation effort on Earth, something no "pretty but breaking" language can buy.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— James Gosling</span>
                <span className="quote-context"><L zh="Java 之父 (Sun, 1991–2010) · 多次 keynote" en="Java's creator (Sun, 1991–2010) · paraphrased keynote" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">21<small> LTS</small></div>
                <div className="ai-stat-h"><L zh="当前 LTS — 不是 8" en="Current LTS — not 8" /></div>
                <p><L
                  zh={<>2023-09 发布。带<strong>虚拟线程</strong>、<strong>switch 模式</strong>、<strong>sequenced collections</strong>、generational ZGC。企业大规模迁移目标——Spring Boot 3 / Quarkus / Micronaut 全在 21 上。</>}
                  en={<>Shipped 2023-09. Brings <strong>virtual threads</strong>, <strong>switch patterns</strong>, <strong>sequenced collections</strong> and generational ZGC. The enterprise migration target — Spring Boot 3, Quarkus, Micronaut all sit on 21.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">~10<small>M</small></div>
                <div className="ai-stat-h"><L zh="虚拟线程并发量级" en="Virtual thread scale" /></div>
                <p><L
                  zh={<>Project Loom：单 JVM <strong>千万级虚拟线程</strong>，写同步代码、自动 M:N 调度。<strong>Java 在高并发服务端不再需要 reactor</strong>，把过去 5 年被 Go 抢去的那一部分地盘抢了回来。</>}
                  en={<>Project Loom: a single JVM handles <strong>~10M virtual threads</strong>, with synchronous code auto-scheduled M:N. <strong>Java no longer needs reactor frameworks</strong> for high-concurrency servers — territory previously ceded to Go is being reclaimed.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">Top 3<small></small></div>
                <div className="ai-stat-h"><L zh="TIOBE / RedMonk 长期排名" en="TIOBE / RedMonk standing" /></div>
                <p><L
                  zh={<>Java 已连续二十多年位列<strong>TIOBE / RedMonk 前三</strong>。GitHub 公开仓库里 Java 长期 Top 3 的语言地位让 AI 训练语料对它极其熟练——<strong>LLM 写 Java 几乎不出错</strong>。</>}
                  en={<>Java has held a <strong>top-three slot on TIOBE / RedMonk</strong> for 20+ years running. Its long-time top-three position in public GitHub repos saturates LLM training data — <strong>models write Java with very few mistakes</strong>.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Virtual Threads <span className="spotlight-meta">— <L zh="Java 21 · 高并发翻盘" en="Java 21 · the concurrency comeback" /></span></h3>
                  <p><L
                    zh={<>Project Loom 把<strong>线程从 OS 资源变成 JVM 资源</strong>：原来一台机器万把个线程到顶，现在百万级。语义不变——还是写同步代码、阻塞 IO 自然写——但底层 JVM 会在阻塞点 unmount 虚拟线程，把 OS 线程让给别人。</>}
                    en={<>Project Loom <strong>decouples threads from OS resources</strong>: where machines used to top out at ~10k threads, they now scale to millions. Semantics don't change — still synchronous code with natural blocking IO — but under the hood the JVM unmounts a virtual thread on every blocking call, returning the OS thread to the pool.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>M:N scheduler</strong> — <L zh="JVM 内部映射到少量平台线程" en="JVM maps virtual threads onto a small pool of platform threads" /></li>
                    <li><strong>Sync semantics</strong> — <L zh="不污染函数颜色（无 async/await）" en="No function colouring — no async/await" /></li>
                    <li><strong>Auto unmount</strong> — <L zh="阻塞 IO / Lock 时让出 OS 线程" en="Blocking IO / locks release the carrier OS thread" /></li>
                    <li><strong>Compatible</strong> — <L zh="跟 Thread API 一致, 现有代码无改动" en="Same Thread API; existing code unchanged" /></li>
                  </ul>
                  <p><L
                    zh={<>对比 Go 的 goroutine：Loom 多了<strong>结构化并发</strong>——父作用域结束子线程一起退场，避免泄漏。Helidon Níma、Quarkus、Spring Boot 都是 virtual-thread-first。</>}
                    en={<>Compared with Go's goroutines, Loom adds <strong>structured concurrency</strong> — children die with their parent scope, no leaks. Helidon Níma, Quarkus and Spring Boot are all virtual-thread-first.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// 一万个 IO 任务, 一个虚拟线程一个" en="// 10k IO tasks, one virtual thread each" /></span>{'\n'}
                    <span className="cl-k">try</span> (<span className="cl-k">var</span> <span className="cl-v">e</span> = <span className="cl-type">Executors</span>{'\n'}
                    {'    '}.<span className="cl-fn">newVirtualThreadPerTaskExecutor</span>()) {'{'}{'\n\n'}
                    {'  '}<span className="cl-type">List</span>&lt;<span className="cl-type">Future</span>&lt;<span className="cl-type">String</span>&gt;&gt; <span className="cl-v">fs</span> ={'\n'}
                    {'    '}<span className="cl-type">IntStream</span>.<span className="cl-fn">range</span>(<span className="cl-n">0</span>, <span className="cl-n">10_000</span>){'\n'}
                    {'      '}.<span className="cl-fn">mapToObj</span>(<span className="cl-v">i</span> -&gt; <span className="cl-v">e</span>.<span className="cl-fn">submit</span>(() -&gt;{'\n'}
                    {'        '}<span className="cl-fn">httpGet</span>(<span className="cl-s">"https://api/u/"</span> + <span className="cl-v">i</span>))){'\n'}
                    {'      '}.<span className="cl-fn">toList</span>();{'\n\n'}
                    {'  '}<span className="cl-k">for</span> (<span className="cl-k">var</span> <span className="cl-v">f</span> : <span className="cl-v">fs</span>) <span className="cl-fn">println</span>(<span className="cl-v">f</span>.<span className="cl-fn">get</span>());{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 写起来同步, 跑起来异步, 没有 async 字" en="// Reads sync, runs async, no async keyword" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="生产环境采用矩阵" en="Production adopters" /></h3>
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
                <h3><L zh="AI 时代的 Java — 训练语料的甜区" en="Java in the AI era — the training-data sweet spot" /></h3>
                <p><L
                  zh={<>大型语言模型对一门语言<strong>能写多准</strong>，几乎跟训练语料里这门语言的占比线性相关。Java 在 GitHub 公开仓库里长期 Top 3，企业内部又有海量没公开但风格一致的代码——LLM 写起 Java 出错率极低，<strong>"refactor + 让 AI 补齐"</strong> 这条路在 Java 上跑得最稳。</>}
                  en={<>How accurately a large language model writes a language is roughly linear in that language's share of the training corpus. Java has held a top-three slot in public GitHub repos for years, with enormous (and stylistically uniform) volumes of internal enterprise code on top — so LLM Java output is unusually accurate, and the <strong>"refactor + let the AI fill in"</strong> workflow runs especially smoothly on Java.</>}
                /></p>
                <p><L
                  zh={<>2026 年的工具链：<strong>Spring AI</strong>（Spring 项目对 LLM 的官方桥）、<strong>LangChain4j</strong>（LangChain 的 Java 端口）、<strong>Quarkus</strong> + <strong>Micronaut</strong> 的云原生 Java 套件——把"<em>Java 适合做后端 AI 服务</em>"这件事坐实。</>}
                  en={<>The 2026 tool chain: <strong>Spring AI</strong> (Spring's first-party LLM bridge), <strong>LangChain4j</strong> (a Java port of LangChain), and the <strong>Quarkus</strong> + <strong>Micronaut</strong> cloud-native Java stack — together they make "<em>Java for back-end AI services</em>" stick.</>}
                /></p>
                <p><L
                  zh={<>反直觉的事实：<strong>"Python 写脚本，Java 上生产"</strong>这条线在 AI 业务后端非常常见——原型在 Python / Jupyter 验证，落地服务用 Java，因为 GC / JIT / 工具链 / 团队规模都更扛得住。</>}
                  en={<>Counter-intuitive truth: <strong>"prototype in Python, ship in Java"</strong> is a common pattern in AI back-ends — prototype in Python / Jupyter, but the production service is Java, because GC / JIT / tooling / team scale all hold up better.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// Spring AI · 一段调 LLM 的 Java" en="// Spring AI · calling an LLM from Java" /></span>{'\n'}
                  <span className="cl-k">@Service</span>{'\n'}
                  <span className="cl-k">class</span> <span className="cl-type">ChatService</span> {'{'}{'\n'}
                  {'  '}<span className="cl-k">private final</span> <span className="cl-type">ChatClient</span> <span className="cl-v">ai</span>;{'\n\n'}
                  {'  '}<span className="cl-k">public</span> <span className="cl-type">String</span> <span className="cl-fn">summarise</span>(<span className="cl-type">String</span> <span className="cl-v">doc</span>) {'{'}{'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-v">ai</span>.<span className="cl-fn">prompt</span>(){'\n'}
                  {'      '}.<span className="cl-fn">user</span>(<span className="cl-v">u</span> -&gt; <span className="cl-v">u</span>.<span className="cl-fn">text</span>(<span className="cl-s">"summarise: "</span> + <span className="cl-v">doc</span>)){'\n'}
                  {'      '}.<span className="cl-fn">call</span>(){'\n'}
                  {'      '}.<span className="cl-fn">content</span>();{'\n'}
                  {'  }'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// LangChain4j 写法几乎一样" en="// LangChain4j syntax is nearly identical" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结：" en="In one line: " /></strong><L
                zh={<>Java 不是停在 8 时代的"老语言"。2026 年的 Java 21 = <strong>records + sealed + 虚拟线程 + 模式匹配 + FFM</strong>，加上 30 年累出来的<strong>JVM 护城河</strong>与<strong>AI 训练甜区</strong>——它仍然是大型工程的最优解之一。</>}
                en={<>Java is not the "old language stuck at 8" of common imagination. Java 21 in 2026 = <strong>records + sealed + virtual threads + pattern matching + FFM</strong>, plus thirty years of <strong>JVM moat</strong> and a <strong>training-data sweet spot</strong> for AI — still a top-tier choice for serious systems.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Kotlin / Go */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Kotlin / Go" /> <code>: Java vs Kotlin vs Go</code></h2>
              <p className="sec-desc"><L
                zh={<>同一个 JVM 上跟 <strong>Kotlin</strong> 比，跨进程模型跟 <strong>Go</strong> 比。Kotlin 是 Java 的"灵性继承人"——同 JVM、删样板；Go 是高并发服务端的另一条路——goroutine vs virtual threads。这一节把三者放在一张表里。</>}
                en={<>On the JVM, Java's foil is <strong>Kotlin</strong>. On the concurrency front, it's <strong>Go</strong>. Kotlin is Java's spiritual heir — same JVM, less ceremony; Go takes the other route to high-concurrency servers — goroutines vs virtual threads. The table puts all three side by side.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Java</th>
                  <th className="th-ts">Kotlin</th>
                  <th className="th-sw">Go</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Sun · 1995</>,
                    ts: <>JetBrains · 2010</>,
                    sw: <>Google · 2009</> },
                  { k: <L zh="主要平台" en="Primary platform" />,
                    js: <L zh="JVM · 服务端 / 大数据 / Android(老)" en="JVM · server / big data / legacy Android" />,
                    ts: <L zh="JVM / Android · KMP 跨端" en="JVM / Android · KMP cross-platform" />,
                    sw: <L zh="本地二进制 · 服务端 / CLI" en="Native binary · server / CLI" /> },
                  { k: <L zh="语法繁简" en="Syntax weight" />,
                    js: <L zh="历史样板多, 21+ 已大幅瘦身" en="Lots of legacy boilerplate; much trimmed in 21+" />,
                    ts: <L zh="精简, 删 Java 样板" en="Concise; Java boilerplate removed" />,
                    sw: <L zh="刻意简单 · 几乎没语法糖" en="Deliberately minimal · almost no sugar" /> },
                  { k: <L zh="Null 安全" en="Null safety" />,
                    js: <L zh={<>有 <code>Optional</code>, 字段仍可 null</>} en={<><code>Optional</code> at API; fields can still be null</>} />,
                    ts: <><code>T?</code> / <code>T</code></>,
                    sw: <L zh={<>无 — 用 zero value / <code>error</code></>} en={<>None — zero values + <code>error</code></>} /> },
                  { k: <L zh="数据类" en="Value type" />,
                    js: <><code>record</code> · 2020 起</>,
                    ts: <><code>data class</code> · 2016 起</>,
                    sw: <><code>struct</code></> },
                  { k: <L zh="并发模型" en="Concurrency" />,
                    js: <L zh={<><strong>Virtual threads</strong> · 21+ · M:N</>} en={<><strong>Virtual threads</strong> · 21+ · M:N</>} />,
                    ts: <L zh={<><code>suspend</code> / <code>Flow</code> · 结构化</>} en={<><code>suspend</code> / <code>Flow</code> · structured</>} />,
                    sw: <L zh="goroutine + channel · M:N" en="goroutines + channels · M:N" /> },
                  { k: <L zh="模式匹配" en="Pattern matching" />,
                    js: <L zh={<><code>switch</code> 模式 · 17+</>} en={<>Switch patterns · 17+</>} />,
                    ts: <><code>when</code> · sealed 穷尽</>,
                    sw: <L zh={<><code>switch</code> · 简单形态</>} en={<><code>switch</code> · simple form</>} /> },
                  { k: <L zh="泛型" en="Generics" />,
                    js: <L zh="类型擦除 (兼容代价)" en="Type erasure (compat trade-off)" />,
                    ts: <L zh="JVM 上同擦除 · reified 救场" en="Same erasure on JVM · reified to escape" />,
                    sw: <L zh={<>1.18+ 才加 · <code>any</code> / 泛型</>} en={<>Added in 1.18 · <code>any</code> / generics</>} /> },
                  { k: <L zh="启动速度" en="Startup" />,
                    js: <L zh="JVM 慢 · GraalVM Native 救场" en="Slow JVM · GraalVM Native fixes it" />,
                    ts: <L zh="同 JVM, 同样靠 native image" en="Same JVM; same native-image story" />,
                    sw: <L zh="即时启动 · 静态二进制" en="Instant · static binary" /> },
                  { k: <L zh="GC" en="GC" />,
                    js: <L zh={<><strong>7+ 种可选</strong> (G1/ZGC/...)</>} en={<><strong>7+ choices</strong> (G1/ZGC/...)</>} />,
                    ts: <L zh="同 JVM (共用)" en="JVM (shared)" />,
                    sw: <L zh="单一 GC · 低延迟优先" en="Single GC · low-latency tuned" /> },
                  { k: <L zh="互操作" en="Interop" />,
                    js: <L zh="JNI / Panama FFM (新)" en="JNI / Panama FFM (new)" />,
                    ts: <L zh={<>Java <strong>100%</strong></>} en={<><strong>100%</strong> Java interop</>} />,
                    sw: <L zh="cgo · 有开销" en="cgo · with overhead" /> },
                  { k: <L zh="生态深度" en="Ecosystem depth" />,
                    js: <L zh="30 年最深 · Spring/Hadoop/Kafka" en="30 years deep · Spring/Hadoop/Kafka" />,
                    ts: <L zh="JVM 全继承 + 自家 KMP" en="Inherits JVM + has KMP on top" />,
                    sw: <L zh="云原生主场 · k8s/docker" en="Cloud-native home · k8s/docker" /> },
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

          {/* 08 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>Loom 已 stable，Valhalla / Panama 在路上，GraalVM Native Image 把 Java 推进 serverless / 容器战场。Java 接下来 5 年的命题：<strong>把 30 年的工程沉淀，重新包装成 2030 年的语言</strong>。</>}
                en={<>Loom is stable, Valhalla and Panama are moving, GraalVM Native Image puts Java on the serverless / container battlefield. The next five-year project: <strong>repackage thirty years of engineering as a 2030-shaped language</strong>.</>}
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
                <li><a href="https://www.java.com" target="_blank" rel="noopener">java.com</a></li>
                <li><a href="https://openjdk.org" target="_blank" rel="noopener">OpenJDK</a></li>
                <li><a href="https://docs.oracle.com/en/java/" target="_blank" rel="noopener"><L zh="官方文档" en="Documentation" /></a></li>
                <li><a href="https://github.com/openjdk/jdk" target="_blank" rel="noopener">GitHub · openjdk/jdk</a></li>
                <li><a href="https://inside.java" target="_blank" rel="noopener"><L zh="官方博客 inside.java" en="Blog · inside.java" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://openjdk.org/projects/loom/" target="_blank" rel="noopener">Project Loom</a></li>
                <li><a href="https://openjdk.org/projects/valhalla/" target="_blank" rel="noopener">Project Valhalla</a></li>
                <li><a href="https://openjdk.org/projects/panama/" target="_blank" rel="noopener">Project Panama</a></li>
                <li><a href="https://openjdk.org/jeps/0" target="_blank" rel="noopener">JEPs index</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 工具" en="Ecosystem / Tools" /></h4>
              <ul>
                <li><a href="https://spring.io/projects/spring-boot" target="_blank" rel="noopener">Spring Boot</a></li>
                <li><a href="https://quarkus.io" target="_blank" rel="noopener">Quarkus</a></li>
                <li><a href="https://micronaut.io" target="_blank" rel="noopener">Micronaut</a></li>
                <li><a href="https://www.graalvm.org" target="_blank" rel="noopener">GraalVM</a></li>
                <li><a href="https://github.com/langchain4j/langchain4j" target="_blank" rel="noopener">LangChain4j</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生产案例" en="Production Cases" /></h4>
              <ul>
                <li><a href="https://netflixtechblog.com" target="_blank" rel="noopener">Netflix Tech Blog</a></li>
                <li><a href="https://engineering.linkedin.com" target="_blank" rel="noopener">LinkedIn Engineering</a></li>
                <li><a href="https://aws.amazon.com/corretto/" target="_blank" rel="noopener">Amazon Corretto</a></li>
                <li><a href="/code/kotlin"><L zh="Kotlin 章节 — 接力 Android" en="Kotlin chapter — picks up Android" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{JAVA_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`public static void main(String[] args) { /* still here */ }`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
