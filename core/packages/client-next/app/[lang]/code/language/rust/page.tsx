'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './rust_intro.css';

const RUST_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <circle cx="128" cy="128" r="64" fill="none" stroke="#CE422B" strokeWidth="14" />
    <g fill="#CE422B">
      <rect x="120" y="14" width="16" height="32" rx="3" />
      <rect x="120" y="210" width="16" height="32" rx="3" />
      <rect x="14" y="120" width="32" height="16" rx="3" />
      <rect x="210" y="120" width="32" height="16" rx="3" />
      <rect x="120" y="14" width="16" height="32" rx="3" transform="rotate(45 128 128)" />
      <rect x="120" y="14" width="16" height="32" rx="3" transform="rotate(-45 128 128)" />
      <rect x="120" y="210" width="16" height="32" rx="3" transform="rotate(45 128 128)" />
      <rect x="120" y="210" width="16" height="32" rx="3" transform="rotate(-45 128 128)" />
    </g>
    <circle cx="128" cy="128" r="36" fill="#CE422B" />
    <text x="128" y="142" textAnchor="middle" fill="#fff" fontFamily="Georgia,serif" fontSize="44" fontWeight="700">R</text>
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
    year: '2006',
    zh: { title: <>Graydon Hoare 的业余项目</>, desc: <>Mozilla 工程师 <strong>Graydon Hoare</strong> 在自家时间开始写 Rust。起因据说是他公寓楼的电梯——一个用 C++ 写的嵌入式系统——又因内存错误重启了。他想：<em>这都 21 世纪了，写楼里电梯的语言怎么还能这么不靠谱？</em></> },
    en: { title: <>Graydon Hoare's side project</>, desc: <>Mozilla engineer <strong>Graydon Hoare</strong> begins Rust on his own time. Lore says it started after the elevator in his apartment building — an embedded C++ system — rebooted yet again from a memory bug. <em>"Why is the language we write elevators in still this fragile?"</em></> },
  },
  {
    year: '2009',
    zh: { title: <>Mozilla 正式接手赞助</>, desc: <>Mozilla 把 Rust 收编为正式研究项目，给 Graydon 配团队，目标是为下一代浏览器引擎 <strong>Servo</strong> 准备一门新语言。早期版本带 GC、带 green threads，跟今天的 Rust 几乎不像。</> },
    en: { title: <>Mozilla sponsors the project</>, desc: <>Mozilla makes Rust an official research project and assigns a team. The eventual goal: a new language for the next-generation browser engine, <strong>Servo</strong>. Early Rust looked nothing like today's — it had a GC and green threads.</> },
  },
  {
    year: <>2012<small>·01</small></>,
    zh: { title: <>0.1 公开发布</>, desc: <>第一个有版本号的编译器发布。语法离今天还有距离——但<strong>所有权 + 借用</strong>这条核心思路已经成型。GC 被逐步剥离，2013 年彻底废除，内存管理全部交给所有权系统。</> },
    en: { title: <>0.1 released</>, desc: <>The first numbered compiler ships. Syntax is far from final, but the core idea — <strong>ownership and borrowing</strong> — is taking shape. The GC is incrementally removed, finally dropped in 2013, with all memory management handed to the ownership system.</> },
  },
  {
    year: '2013',
    zh: { title: <>Graydon 离开 + 类型系统大改</>, desc: <>Graydon Hoare 退出 Rust 领导。2012-2015 三年里，类型系统几乎被推倒重来一次：所有权扩张、生命周期标注引入、green threads 被砍——为 1.0 做"瘦身"。</> },
    en: { title: <>Graydon steps down — type system overhaul</>, desc: <>Hoare leaves Rust leadership. From 2012 to 2015 the type system is essentially rebuilt: ownership generalised, lifetimes made explicit, green threads removed — all to slim the language down for 1.0.</> },
  },
  {
    year: <>2015<small>·04</small></>,
    zh: { title: <>Aaron Turon: 《Fearless Concurrency》</>, desc: <>1.0 发布前一个月，核心成员 Aaron Turon 发布博客《Fearless Concurrency with Rust》。"无所畏惧的并发"成了 Rust 最响亮的标语之一——所有权机制不只防内存错误，也顺手防住了数据竞争。</> },
    en: { title: <>Aaron Turon's "Fearless Concurrency"</>, desc: <>One month before 1.0, core team member Aaron Turon publishes <em>Fearless Concurrency with Rust</em>. The phrase becomes a defining slogan: ownership doesn't just stop memory bugs, it also rules out data races by construction.</> },
  },
  {
    year: <>2015<small>·05·15</small></>, highlight: true,
    zh: { title: <>1.0 稳定版</>, desc: <>Rust 团队官方宣布 <strong>Rust 1.0</strong>。从此以后所有发到 stable 的特性都进入"向后兼容承诺"。这一天被 Rust 社区当作生日——2025 年 Rust 庆祝 10 周年。Edition 2015 同步落地。</> },
    en: { title: <>1.0 stable</>, desc: <>The Rust team ships <strong>Rust 1.0</strong>. Every feature on stable is now under a backwards-compatibility promise. The Rust community treats this date as the language's birthday — celebrated as the 10-year anniversary in 2025. Edition 2015 lands alongside.</> },
  },
  {
    year: <>2018<small>·12</small></>,
    zh: { title: <>Edition 2018 + 模块系统大改</>, desc: <>Rust 1.31。第一次启用 Edition 机制：把"会破坏旧代码"的语法改进装在 Edition 里，旧 crate 留在 2015 不动，新 crate 升 2018，二者可以混链。模块路径、<code>async</code> 关键字预留，全在这一波。</> },
    en: { title: <>Edition 2018 + module system rework</>, desc: <>Rust 1.31. The Edition mechanism debuts: breaking syntax improvements ship in editions, old crates stay on 2015, new crates opt into 2018, and they link together cleanly. New module paths and the <code>async</code> keyword reservation arrive here.</> },
  },
  {
    year: <>2019<small>·11</small></>, highlight: true,
    zh: { title: <>1.39 — async/await 稳定</>, desc: <>11 月 7 日。<code>async fn</code> / <code>.await</code> 进入 stable Rust。运行时（tokio / async-std）由社区自由实现，标准库只定 <code>Future</code> trait。一夜之间 Rust 拿到了写高性能异步服务端的入场券。</> },
    en: { title: <>1.39 — async/await stabilised</>, desc: <>November 7. <code>async fn</code> / <code>.await</code> hit stable Rust. Runtimes (tokio, async-std) live in the ecosystem, while only the <code>Future</code> trait is in std. Overnight Rust becomes a viable choice for high-performance async server work.</> },
  },
  {
    year: <>2021<small>·02</small></>,
    zh: { title: <>Rust Foundation 成立</>, desc: <>2 月 8 日。Mozilla 2020 年裁员后，Rust 项目正式从 Mozilla 独立出来，成立 <strong>Rust Foundation</strong>。创始成员：AWS、Google、Microsoft、Mozilla、Huawei。从此 Rust 的命运不再和单一公司绑定。</> },
    en: { title: <>Rust Foundation founded</>, desc: <>February 8. After Mozilla's 2020 layoffs, Rust formally moves out of Mozilla into a new independent non-profit, the <strong>Rust Foundation</strong>. Founding corporate members: AWS, Google, Microsoft, Mozilla, Huawei. The language is no longer tied to a single company.</> },
  },
  {
    year: <>2021<small>·10</small></>,
    zh: { title: <>Edition 2021</>, desc: <>Rust 1.56。闭包按字段捕获、<code>IntoIterator</code> for arrays、<code>panic</code> 宏一致化等一打改进。Edition 节奏稳定为三年一次。</> },
    en: { title: <>Edition 2021</>, desc: <>Rust 1.56. Disjoint closure capture, <code>IntoIterator</code> for arrays, panic macro consistency, and a dozen smaller adjustments. The three-year edition cadence is now established.</> },
  },
  {
    year: <>2022<small>·12</small></>, highlight: true,
    zh: { title: <>Linux 内核 6.1 接受 Rust</>, desc: <>12 月 11 日。Linus Torvalds 把初始 Rust 基础设施合进 mainline。<strong>这是 Linux 内核三十多年来第一次接受 C 之外的语言</strong>。后续版本陆续加入更多子系统抽象和驱动。</> },
    en: { title: <>Linux kernel 6.1 accepts Rust</>, desc: <>December 11. Linus Torvalds merges initial Rust infrastructure into mainline. <strong>The Linux kernel admits a second language for the first time in three decades</strong>. Subsequent releases steadily add more subsystem abstractions and drivers.</> },
  },
  {
    year: <>2023<small>·08</small></>, highlight: true,
    zh: { title: <>Discord：从 Go 切到 Rust</>, desc: <>Discord 公开博客：他们的 Read States 服务从 Go 重写为 Rust，因为 Go GC 导致的<strong>每两分钟一次延迟尖刺</strong>无法解决。Rust 版本上线后 P99 延迟稳定在微秒级。这篇博客成了"Rust 替换 Go"最有名的实战参照。</> },
    en: { title: <>Discord rewrites Read States: Go → Rust</>, desc: <>Discord publishes a now-famous engineering blog: their Read States service moved from Go to Rust because Go's GC caused <strong>regular two-minute latency spikes</strong> they couldn't engineer away. After the Rust rewrite, P99 stays in microseconds. The post becomes the canonical "Rust replacing Go" reference.</> },
  },
  {
    year: <>2024<small>·02</small></>,
    zh: { title: <>Microsoft Azure CTO：禁止新 C/C++ 项目</>, desc: <>Mark Russinovich 公开宣布："新项目应该用 Rust 而不是 C/C++"。Windows 内核已有 <strong>DirectWriteCore（15 万行）+ Win32k/GDI</strong> 用 Rust 重写并随系统出货。"内存错误占 Microsoft 漏洞的 70%"是这条路线的依据。</> },
    en: { title: <>Microsoft Azure CTO bans new C/C++</>, desc: <>Mark Russinovich publicly states new projects should use Rust, not C/C++. Windows kernel ships with <strong>DirectWriteCore (~150K lines) plus Win32k/GDI Region</strong> rewritten in Rust. The driver: "memory errors account for ~70% of Microsoft security vulnerabilities."</> },
  },
  {
    year: <>2025<small>·02</small></>, highlight: true,
    zh: { title: <>Rust 1.85 + Edition 2024</>, desc: <>2 月发布。最大一次 Edition 改动——异步闭包、<code>let chains</code>、新版 lifetime 捕获规则。同年 5 月 Rust 庆祝 1.0 十周年。Stack Overflow 调研：连续 <strong>第 9 年</strong>登顶"最受推崇语言"。</> },
    en: { title: <>Rust 1.85 + Edition 2024</>, desc: <>February release. The largest Edition delta yet — async closures, <code>let</code> chains, new lifetime capture rules. May 2025 marks the 10-year anniversary of 1.0. Stack Overflow's 2024 survey: Rust takes the most-admired crown for a <strong>9th consecutive year</strong>.</> },
  },
];

interface RustCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const RUST_CARDS: RustCard[] = [
  {
    tag: 'A',
    zh: { title: <>所有权 <code>: ownership</code></>, desc: <>每个值有唯一 owner，owner 离开作用域 → 值释放。<strong>赋值默认是 move</strong>，原变量从此不可用。</> },
    en: { title: <>Ownership <code>: ownership</code></>, desc: <>Each value has exactly one owner. When the owner leaves scope, the value is dropped. <strong>Assignment is move</strong> by default — the previous binding becomes invalid.</> },
    code: (
      <code>
        <span className="cl-k">let</span> <span className="cl-v">s1</span> = <span className="cl-type">String</span>::<span className="cl-fn">from</span>(<span className="cl-s">"hi"</span>);{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">s2</span> = <span className="cl-v">s1</span>;        <span className="cl-c">// move</span>{'\n'}
        <span className="cl-c"><L zh={`// println!("{}", s1); ✘ 编译错`} en={`// println!("{}", s1); ✘ compile error`} /></span>{'\n'}
        <span className="cl-c"><L zh="// s1 已被移动给 s2" en="// s1 has been moved into s2" /></span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>借用 <code>: &amp; / &amp;mut</code></>, desc: <>多个 <code>&amp;T</code> <strong>或</strong>一个 <code>&amp;mut T</code>，二选一。这条独占规则杜绝数据竞争。</> },
    en: { title: <>Borrowing <code>: &amp; / &amp;mut</code></>, desc: <>Many <code>&amp;T</code> <strong>or</strong> exactly one <code>&amp;mut T</code>. That exclusivity rule statically forbids data races.</> },
    code: (
      <code>
        <span className="cl-k">let mut</span> <span className="cl-v">v</span> = <span className="cl-k">vec!</span>[<span className="cl-n">1</span>,<span className="cl-n">2</span>,<span className="cl-n">3</span>];{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">a</span> = &amp;<span className="cl-v">v</span>;{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">b</span> = &amp;<span className="cl-v">v</span>;     <span className="cl-c"><L zh="// ✓ 多个 &amp;" en="// ✓ many shared" /></span>{'\n'}
        <span className="cl-c"><L zh="// let c = &mut v; ✘ 已有不可变借用" en="// let c = &mut v; ✘ shared borrow exists" /></span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>生命周期 <code>: 'a</code></>, desc: <>引用必须比它指向的数据短命。绝大多数情况编译器自己推断，<code>'a</code> 标注只在签名歧义时才出现。</> },
    en: { title: <>Lifetimes <code>: 'a</code></>, desc: <>A reference must outlive nothing it points to. The compiler infers most lifetimes; <code>'a</code> annotations only show up when signatures need disambiguation.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">longest</span>&lt;<span className="cl-type">'a</span>&gt;({'\n'}
        {'  '}<span className="cl-v">x</span>: &amp;<span className="cl-type">'a str</span>,{'\n'}
        {'  '}<span className="cl-v">y</span>: &amp;<span className="cl-type">'a str</span>{'\n'}
        ) -&gt; &amp;<span className="cl-type">'a str</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">if</span> <span className="cl-v">x</span>.<span className="cl-fn">len</span>() &gt; <span className="cl-v">y</span>.<span className="cl-fn">len</span>() {'{ '}<span className="cl-v">x</span>{' } '}<span className="cl-k">else</span> {'{ '}<span className="cl-v">y</span>{' }'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Trait + 泛型</>, desc: <>Rust 没有继承，只有 trait + 泛型。trait 是"行为契约"，泛型在编译期被单态化展开。</> },
    en: { title: <>Traits + generics</>, desc: <>No inheritance — just traits and generics. A trait is a behaviour contract; generics monomorphise at compile time, so dispatch is static and inlinable.</> },
    code: (
      <code>
        <span className="cl-k">trait</span> <span className="cl-type">Area</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">fn</span> <span className="cl-fn">area</span>(&amp;<span className="cl-k">self</span>) -&gt; <span className="cl-type">f64</span>;{'\n'}
        {'}'}{'\n'}
        <span className="cl-k">struct</span> <span className="cl-type">Circle</span> {'{ '}<span className="cl-prop">r</span>: <span className="cl-type">f64</span>{' }'}{'\n'}
        <span className="cl-k">impl</span> <span className="cl-type">Area</span> <span className="cl-k">for</span> <span className="cl-type">Circle</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">fn</span> <span className="cl-fn">area</span>(&amp;<span className="cl-k">self</span>) -&gt; <span className="cl-type">f64</span> {'{'}{'\n'}
        {'    '}<span className="cl-n">3.14</span> * <span className="cl-k">self</span>.<span className="cl-prop">r</span> * <span className="cl-k">self</span>.<span className="cl-prop">r</span>{'\n'}
        {'  }'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Result + Option</>, desc: <>没有异常、没有 null。错误是值，缺失是值。<code>?</code> 操作符把"出错就提前返回"压成一个字符。</> },
    en: { title: <>Result + Option</>, desc: <>No exceptions, no null. Errors are values. Missing-ness is a value. The <code>?</code> operator collapses "propagate on error" into a single character.</> },
    code: (
      <code>
        <span className="cl-k">fn</span> <span className="cl-fn">read</span>(<span className="cl-v">p</span>: &amp;<span className="cl-type">str</span>) -&gt; <span className="cl-type">Result</span>&lt;<span className="cl-type">String</span>, <span className="cl-type">io</span>::<span className="cl-type">Error</span>&gt; {'{'}{'\n'}
        {'  '}<span className="cl-k">let mut</span> <span className="cl-v">f</span> = <span className="cl-type">File</span>::<span className="cl-fn">open</span>(<span className="cl-v">p</span>)?;   <span className="cl-c"><L zh="// 错就早退" en="// early-return on Err" /></span>{'\n'}
        {'  '}<span className="cl-k">let mut</span> <span className="cl-v">s</span> = <span className="cl-type">String</span>::<span className="cl-fn">new</span>();{'\n'}
        {'  '}<span className="cl-v">f</span>.<span className="cl-fn">read_to_string</span>(&amp;<span className="cl-k">mut</span> <span className="cl-v">s</span>)?;{'\n'}
        {'  '}<span className="cl-type">Ok</span>(<span className="cl-v">s</span>){'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>模式匹配 <code>: match</code></>, desc: <><code>match</code> 必须穷尽所有分支。配合 enum / Result / Option，几乎所有"忘了处理这种情况"都被编译器抓住。</> },
    en: { title: <>Pattern matching <code>: match</code></>, desc: <>Exhaustiveness is enforced. Combined with enums, <code>Result</code> and <code>Option</code>, "I forgot to handle case X" stops being possible.</> },
    code: (
      <code>
        <span className="cl-k">enum</span> <span className="cl-type">Shape</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">Circle</span>(<span className="cl-type">f64</span>),{'\n'}
        {'  '}<span className="cl-type">Square</span>(<span className="cl-type">f64</span>),{'\n'}
        {'}'}{'\n'}
        <span className="cl-k">match</span> <span className="cl-v">s</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">Shape</span>::<span className="cl-type">Circle</span>(<span className="cl-v">r</span>)  =&gt; <span className="cl-n">3.14</span>*<span className="cl-v">r</span>*<span className="cl-v">r</span>,{'\n'}
        {'  '}<span className="cl-type">Shape</span>::<span className="cl-type">Square</span>(<span className="cl-v">s</span>) =&gt; <span className="cl-v">s</span>*<span className="cl-v">s</span>,{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>async / await</>, desc: <>语法和 JS / C# 像，但<strong>运行时不内置</strong>——你选 tokio 还是 async-std 是库层决定。Future 是惰性的：<code>.await</code> 之前什么都不发生。</> },
    en: { title: <>async / await</>, desc: <>Syntax familiar from JS / C#, but <strong>no runtime is bundled</strong> — you pick tokio, async-std, or roll your own. Futures are lazy: nothing happens until <code>.await</code>.</> },
    code: (
      <code>
        <span className="cl-k">async fn</span> <span className="cl-fn">fetch</span>(<span className="cl-v">u</span>: &amp;<span className="cl-type">str</span>) -&gt; <span className="cl-type">Result</span>&lt;<span className="cl-type">String</span>&gt; {'{'}{'\n'}
        {'  '}<span className="cl-k">let</span> <span className="cl-v">r</span> = <span className="cl-fn">reqwest</span>::<span className="cl-fn">get</span>(<span className="cl-v">u</span>).<span className="cl-fn">await</span>?;{'\n'}
        {'  '}<span className="cl-type">Ok</span>(<span className="cl-v">r</span>.<span className="cl-fn">text</span>().<span className="cl-fn">await</span>?){'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>unsafe 块</>, desc: <>Rust 不天真地以为自己能解决所有问题——FFI、原始指针、SIMD 还得开 <code>unsafe</code>。但范围被框死在显式块内，审计起来比 C 整个文件都不安全要轻松一个量级。</> },
    en: { title: <>unsafe blocks</>, desc: <>Rust isn't naïve — FFI, raw pointers, and SIMD still need <code>unsafe</code>. But the unsafe surface is bounded inside explicit blocks, so audit cost is orders of magnitude smaller than auditing an entire C codebase.</> },
    code: (
      <code>
        <span className="cl-k">unsafe</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">let</span> <span className="cl-v">p</span> = <span className="cl-fn">libc</span>::<span className="cl-fn">malloc</span>(<span className="cl-n">128</span>);{'\n'}
        {'  '}<span className="cl-c"><L zh="// 这一段我自己负责" en="// I take responsibility here." /></span>{'\n'}
        {'  '}<span className="cl-fn">libc</span>::<span className="cl-fn">free</span>(<span className="cl-v">p</span>);{'\n'}
        {'}'}
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
    zh: { title: <>性能对位 C++</>, desc: <>没有 GC、没有 VM、没有运行时。LLVM 后端跟 Clang 共享。在 Pingora、ripgrep、Polars 这些实际负载上，Rust 跟 C++ 同档，比 Go / Python 高一到两个量级。</> },
    en: { title: <>Performance on par with C++</>, desc: <>No GC, no VM, no runtime. LLVM backend shared with Clang. On real workloads — Pingora, ripgrep, Polars — Rust runs neck-and-neck with C++, and one to two orders of magnitude faster than Go or Python.</> },
    code: <><span className="cl-c"><L zh="// 编译产物 = 一个静态二进制" en="// Output is one static binary." /></span>{'\n'}<span className="cl-c"><L zh="// 没有 libc 之外的依赖" en="// No deps beyond libc." /></span>{'\n'}<span className="cl-c"><L zh="// scp 过去就能跑" en="// scp it to a box and run." /></span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>内存安全在编译期</>, desc: <>use-after-free、double-free、悬垂指针、缓冲区溢出——C/C++ 三十年没解决的问题，Rust 在 <code>cargo build</code> 那一秒就拒绝你。Microsoft 数据：<strong>70%</strong> 的安全漏洞是内存错误。</> },
    en: { title: <>Memory safety at compile time</>, desc: <>Use-after-free, double-free, dangling pointers, buffer overflows — the bugs that have plagued C/C++ for thirty years are rejected by <code>cargo build</code> before you can ship. Microsoft's data: <strong>~70%</strong> of their security vulnerabilities are memory errors.</> },
    code: <><span className="cl-c">{'// error[E0382]: borrow of moved value'}</span>{'\n'}<span className="cl-c">{'//   --> src/main.rs:5:20'}</span>{'\n'}<span className="cl-c"><L zh="// 编译器替你抓住, 不让上线" en="// caught here, not in production" /></span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>无所畏惧的并发</>, desc: <><code>Send</code> / <code>Sync</code> 两个 trait 让"线程间能不能传"和"能不能共享"变成类型系统的问题。data race 在编译期就被堵死，不需要 Java 那种到处加 synchronized。</> },
    en: { title: <>Fearless concurrency</>, desc: <>Two marker traits, <code>Send</code> and <code>Sync</code>, turn "can this cross threads?" and "can this be shared?" into compile-time questions. Data races are ruled out statically — no <code>synchronized</code> sprinkles needed.</> },
    code: <><span className="cl-c"><L zh="// std::thread::spawn 要求 F: Send" en="// std::thread::spawn requires F: Send." /></span>{'\n'}<span className="cl-c"><L zh="// 你想跨线程传 Rc<T>? 编译器: 不行" en="// Tried to pass Rc<T>? Compiler: nope." /></span>{'\n'}<span className="cl-c"><L zh="// Rc 不是 Send, 用 Arc 去" en="// Use Arc instead." /></span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>cargo: 一统天下的工具链</>, desc: <>包管理、构建、测试、文档、benchmark、跨编译——一个 <code>cargo</code> 全部搞定。crates.io 中央仓库 + 语义化版本，没有 C++ 那种"手动管 100 个 CMake"的噩梦。</> },
    en: { title: <>cargo: one toolchain to rule them all</>, desc: <>Package management, build, test, docs, benchmarks, cross-compilation — one <code>cargo</code> command for all of it. crates.io as a central registry with semver. None of the "manage 100 CMake files by hand" pain of C++.</> },
    code: <>{'cargo new myproj\ncargo add tokio\ncargo test\ncargo doc --open'}</>,
  },
  {
    icon: '⌬',
    zh: { title: <>没有 null, 没有异常</>, desc: <><code>Option&lt;T&gt;</code> 强制处理空, <code>Result&lt;T,E&gt;</code> 强制处理错。<code>?</code> 操作符让错误传递像写 Python 一样轻；但你<strong>不可能</strong>"不小心忽略"一个错。</> },
    en: { title: <>No null, no exceptions</>, desc: <><code>Option&lt;T&gt;</code> forces handling of absent values; <code>Result&lt;T,E&gt;</code> forces handling of failure. The <code>?</code> operator makes propagation as light as Python, but you <strong>cannot</strong> silently swallow an error.</> },
    code: (
      <>
        <span className="cl-k">match</span> <span className="cl-fn">parse_int</span>(<span className="cl-v">s</span>) {'{'}{'\n'}
        {'  '}<span className="cl-type">Ok</span>(<span className="cl-v">n</span>)  =&gt; <span className="cl-fn">use_it</span>(<span className="cl-v">n</span>),{'\n'}
        {'  '}<span className="cl-type">Err</span>(<span className="cl-v">e</span>) =&gt; <span className="cl-fn">log</span>(<span className="cl-v">e</span>),{'\n'}
        {'}'}
      </>
    ),
  },
  {
    icon: '⌖',
    zh: { title: <>错误信息一流</>, desc: <>Rust 编译器报错带下划线、带 fix 建议、带相关文档链接。社区一句老梗："如果借用检查器骂你，照做就对了。"在新手友好度上 C++ 编译器报错完败。</> },
    en: { title: <>Best-in-class diagnostics</>, desc: <>Rust's compiler errors come with squigglies, suggested fixes, and links to relevant docs. Community wisdom: "If the borrow checker yells, do what it says." C++ template error messages cannot compete here.</> },
    code: <>{'error[E0596]: cannot borrow `v` as mutable\nhelp: consider changing this to be mutable\n  let mut v = ...\n      +++'}</>,
  },
  {
    icon: '⌗',
    zh: { title: <>WebAssembly 一等公民</>, desc: <><code>cargo build --target wasm32</code> 编译成 wasm。不带 GC、产物极小、加载快——<strong>Figma、1Password、Discord 桌面端</strong>都用 Rust + wasm 把性能关键路径搬进浏览器。</> },
    en: { title: <>WebAssembly first-class</>, desc: <><code>cargo build --target wasm32</code> compiles to wasm. No GC overhead, tiny binaries, fast load — <strong>Figma, 1Password, Discord desktop</strong> all use Rust + wasm to push performance-critical paths into the browser.</> },
    code: <><span className="cl-c"><L zh="// wasm-bindgen 把 Rust fn 暴露给 JS" en="// wasm-bindgen exposes Rust fns to JS" /></span>{'\n'}<span className="cl-c"><L zh="// 浏览器里跑得跟原生一样快" en="// runs at near-native speed in browsers" /></span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>FFI 友好 = 渐进采纳</>, desc: <>不需要全部重写。Mozilla / Dropbox / Cloudflare / Microsoft 都在已有 C++ 代码里<strong>夹一块 Rust</strong>用——通过 C ABI 互操。这条渐进路径是 Rust 在大公司能落地的关键。</> },
    en: { title: <>Friendly FFI = gradual adoption</>, desc: <>You don't need to rewrite everything. Mozilla, Dropbox, Cloudflare and Microsoft all <strong>embed Rust into existing C/C++ codebases</strong> via the C ABI. This incremental path is why Rust actually lands inside large companies.</> },
    code: (
      <>
        <span className="cl-k">extern</span> <span className="cl-s">"C"</span> <span className="cl-k">fn</span> <span className="cl-fn">my_export</span>() {'{'}{'\n'}
        {'  '}<span className="cl-c"><L zh="// 给 C/C++ 调" en="// callable from C/C++" /></span>{'\n'}
        {'}'}
      </>
    ),
  },
  {
    icon: '⚐',
    zh: { title: <>跨平台单二进制</>, desc: <>编译产物是一个静态二进制。没有 JVM、没有 Python 解释器、没有 node_modules。这就是为什么 ripgrep、fd、bat 装起来"下载就能跑"——而你装个 pylint 还得先建 venv。</> },
    en: { title: <>Cross-platform single binary</>, desc: <>The build artifact is a static binary. No JVM, no Python interpreter, no node_modules. This is why ripgrep, fd and bat install with "download and run" — while a Python linter still wants you to spin up a venv first.</> },
    code: <><span className="cl-c"><L zh="# 拷一个文件到服务器" en="# copy a single file" /></span>{'\n'}{'scp ./mybin user@host:~/\nssh user@host ./mybin'}</>,
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
    href: 'https://www.kernel.org',
    zhName: 'Linux Kernel', enName: 'Linux Kernel',
    zhNote: '6.1+ 接受 Rust · 2022-12', enNote: 'Rust merged in 6.1 · Dec 2022',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#000"/><ellipse cx="50" cy="55" rx="22" ry="28" fill="#fff"/><circle cx="42" cy="45" r="5" fill="#000"/><circle cx="58" cy="45" r="5" fill="#000"/><polygon points="44,60 56,60 50,72" fill="#FAA61A"/></svg>,
  },
  {
    href: 'https://www.microsoft.com/windows',
    zhName: 'Windows Kernel', enName: 'Windows Kernel',
    zhNote: 'DirectWriteCore · 15 万行 Rust', enNote: 'DirectWriteCore · ~150K LOC',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="38" height="38" fill="#F35325"/><rect x="52" y="10" width="38" height="38" fill="#81BC06"/><rect x="10" y="52" width="38" height="38" fill="#05A6F0"/><rect x="52" y="52" width="38" height="38" fill="#FFBA08"/></svg>,
  },
  {
    href: 'https://www.cloudflare.com',
    zhName: 'Cloudflare Pingora', enName: 'Cloudflare Pingora',
    zhNote: '每日 1T+ 请求 · CPU -70%', enNote: '1T+ req/day · -70% CPU',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#F38020"/><path d="M30 65 Q30 55 40 55 H70 Q80 55 80 45 Q80 35 70 35 H45 Q35 35 35 45" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://discord.com/blog/why-discord-is-switching-from-go-to-rust',
    zhName: 'Discord', enName: 'Discord',
    zhNote: 'Read States · Go → Rust', enNote: 'Read States · Go → Rust',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#5865F2"/><ellipse cx="38" cy="52" rx="6" ry="8" fill="#fff"/><ellipse cx="62" cy="52" rx="6" ry="8" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.dropbox.com',
    zhName: 'Dropbox', enName: 'Dropbox',
    zhNote: 'Magic Pocket 存储热路径', enNote: 'Magic Pocket hot path',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="20,30 50,15 80,30 50,45" fill="#0061FF"/><polygon points="20,55 50,40 80,55 50,70" fill="#0061FF"/><polygon points="20,30 50,45 50,70 20,55" fill="#0048CC"/><polygon points="80,30 50,45 50,70 80,55" fill="#0048CC"/></svg>,
  },
  {
    href: 'https://www.mozilla.org/firefox/',
    zhName: 'Firefox / Servo', enName: 'Firefox / Servo',
    zhNote: 'CSS 引擎 Quantum · 2017', enNote: 'CSS engine · Quantum 2017',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#FF7139"/><path d="M30 35 Q50 20 70 35 Q75 50 60 65 Q40 75 25 60 Q22 45 30 35" fill="#FFD735"/><circle cx="50" cy="50" r="14" fill="#FF7139"/></svg>,
  },
  {
    href: 'https://github.com/astral-sh/uv', highlight: true,
    zhName: 'uv (Astral)', enName: 'uv (Astral)',
    zhNote: 'Python 包管 · vs pip 100×', enNote: 'Python pkg mgr · 100× pip',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#261230"/><path d="M28 35 V60 Q28 75 42 75 Q56 75 56 60 V35 M62 35 L74 75" stroke="#DE5FE9" strokeWidth="6" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://github.com/astral-sh/ruff', highlight: true,
    zhName: 'Ruff (Astral)', enName: 'Ruff (Astral)',
    zhNote: 'Python lint · vs flake8 150×', enNote: 'Python lint · 150× flake8',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#261230"/><path d="M28 28 H50 Q66 28 66 42 Q66 54 52 56 L66 75 H56 L42 56 H38 V75 H28 Z" fill="#D7FF64"/></svg>,
  },
  {
    href: 'https://biomejs.dev', highlight: true,
    zhName: 'Biome', enName: 'Biome',
    zhNote: 'JS/TS 格式化 · vs Prettier 35×', enNote: 'JS/TS fmt · 35× Prettier',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#60A5FA"/><path d="M50 22 Q70 35 70 55 Q70 75 50 80 Q30 75 30 55 Q30 35 50 22 Z" fill="#fff"/><circle cx="50" cy="55" r="10" fill="#60A5FA"/></svg>,
  },
  {
    href: 'https://pola.rs', highlight: true,
    zhName: 'Polars', enName: 'Polars',
    zhNote: 'DataFrame · vs Pandas 30×', enNote: 'DataFrame · 30× Pandas',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#0075FF"/><circle cx="50" cy="50" r="22" fill="#FFD43B"/><rect x="30" y="48" width="40" height="4" fill="#0075FF"/><rect x="48" y="30" width="4" height="40" fill="#0075FF"/></svg>,
  },
  {
    href: 'https://github.com/BurntSushi/ripgrep',
    zhName: 'ripgrep', enName: 'ripgrep',
    zhNote: 'grep 替代 · 现代 CLI 标杆', enNote: 'grep replacement · CLI archetype',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="42" cy="42" r="22" fill="none" stroke="#FF6B35" strokeWidth="6"/><line x1="58" y1="58" x2="80" y2="80" stroke="#FF6B35" strokeWidth="8" strokeLinecap="round"/><text x="42" y="48" textAnchor="middle" fill="#FF6B35" fontFamily="monospace" fontSize="14" fontWeight="700">rg</text></svg>,
  },
  {
    href: 'https://deno.com',
    zhName: 'Deno', enName: 'Deno',
    zhNote: '运行时本体 100% Rust', enNote: 'JS runtime, written in Rust',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#fff"/><circle cx="62" cy="46" r="6" fill="#000"/><path d="M28 60 Q50 75 78 55" stroke="#000" strokeWidth="3" fill="none"/></svg>,
  },
];

interface RustTool { name: string; zhDesc: string; enDesc: string }
const RUST_TOOLS: RustTool[] = [
  { name: 'uv',        zhDesc: 'Python 包管 · vs pip 100×',     enDesc: 'Python pkg mgr · 100× pip' },
  { name: 'Ruff',      zhDesc: 'Python lint · vs flake8 150×',  enDesc: 'Python lint · 150× flake8' },
  { name: 'ty',        zhDesc: 'Astral Python 类型检查器',       enDesc: 'Astral Python type checker' },
  { name: 'Polars',    zhDesc: 'DataFrame · vs Pandas 30×',     enDesc: 'DataFrame · 30× Pandas' },
  { name: 'Biome',     zhDesc: 'JS/TS lint+fmt · vs ESLint 35×', enDesc: 'JS/TS lint+fmt · 35× ESLint' },
  { name: 'Oxc',       zhDesc: 'JS 解析器 · 给 Rolldown 用',     enDesc: 'JS parser · powers Rolldown' },
  { name: 'Rolldown',  zhDesc: 'Rollup Rust 重写 · Vite 8 默认', enDesc: 'Rollup successor · default in Vite 8' },
  { name: 'Turbopack', zhDesc: 'Vercel · Next.js bundler',       enDesc: 'Vercel · Next.js bundler' },
  { name: 'Rspack',    zhDesc: '字节 · webpack Rust 重写',       enDesc: 'ByteDance · webpack rewrite' },
  { name: 'SWC',       zhDesc: 'JS 编译 · Babel Rust 替代',      enDesc: 'JS compiler · Babel replacement' },
  { name: 'Pingora',   zhDesc: 'Cloudflare · 反向代理',          enDesc: 'Cloudflare reverse-proxy framework' },
  { name: 'tokio',     zhDesc: 'Rust 异步运行时事实标准',         enDesc: 'de-facto async runtime' },
  { name: 'ripgrep',   zhDesc: 'grep 替代 · CLI 标杆',           enDesc: 'grep replacement · CLI standard' },
  { name: 'fd',        zhDesc: 'find 替代 · 默认尊重 .gitignore', enDesc: 'find replacement · gitignore-aware' },
  { name: 'bat',       zhDesc: 'cat 替代 · 语法高亮',            enDesc: 'cat with syntax highlighting' },
  { name: 'eza',       zhDesc: 'ls 替代 · 带 git 状态',          enDesc: 'ls with git status' },
  { name: 'zoxide',    zhDesc: 'cd 替代 · 学习常去目录',         enDesc: 'cd that learns frequent paths' },
  { name: 'starship',  zhDesc: '跨 shell prompt · 极速启动',     enDesc: 'cross-shell prompt · instant startup' },
  { name: 'Tauri',     zhDesc: 'Electron 替代 · 二进制 10MB',    enDesc: 'Electron alternative · 10MB binary' },
  { name: 'Bevy',      zhDesc: '游戏引擎 · ECS 架构',            enDesc: 'Game engine · ECS architecture' },
  { name: 'Deno',      zhDesc: 'JS 运行时 · 100% Rust 写',       enDesc: 'JS runtime written in Rust' },
  { name: 'Wasmer',    zhDesc: '独立 WASM 运行时',               enDesc: 'Standalone WASM runtime' },
  { name: 'Pingap',    zhDesc: '基于 Pingora 的反代',            enDesc: 'Pingora-based reverse proxy' },
  { name: 'candle',    zhDesc: 'Hugging Face · ML 推理',         enDesc: 'Hugging Face · ML inference' },
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
    tag: <>HOT · 2025-02</>, hot: true, big: true,
    zh: {
      title: <>Edition 2024 + Rust 1.85</>,
      body: (<>
        <p>2025 年 2 月发布。最大一次 Edition 改动：<strong>async closures</strong> 稳定、<strong>let chains</strong>（<code>{'if let A = x && let B = y'}</code>）、新的 lifetime 捕获规则、<code>Future</code> trait 在 prelude 里。Edition 升级仍然是逐 crate 自由迁移，不破坏旧代码。</p>
        <p>核心心智不变，但日常写起来"少十几个 boilerplate"——这是社区呼声最大的一批改进。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">pip install (Python)</span><span className="bar-val">4.2s</span></div>
          <div className="bar bar-new"><span className="bar-label">uv pip install (Rust)</span><span className="bar-val">0.04s</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Edition 2024 + Rust 1.85</>,
      body: (<>
        <p>Released February 2025. The largest Edition delta yet: <strong>async closures</strong> stable, <strong>let chains</strong> (<code>{'if let A = x && let B = y'}</code>), revised lifetime capture rules, <code>Future</code> in the prelude. As always, edition upgrade is opt-in per crate — old code keeps working.</p>
        <p>The mental model didn't change, but day-to-day code shed a dozen pieces of boilerplate. This is the most-requested batch of improvements the community has gotten.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">pip install (Python)</span><span className="bar-val">4.2s</span></div>
          <div className="bar bar-new"><span className="bar-label">uv pip install (Rust)</span><span className="bar-val">0.04s</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'KERNEL',
    zh: { title: <>Linux 内核扩张</>, body: <><p>从 6.1 的初始基础设施到现在，Linux 内核的 Rust 子系统抽象逐步加进——网络驱动、文件系统、PCI 等。Linus 表态："只要不影响 C 部分，欢迎 Rust 接管新的子系统。"</p></> },
    en: { title: <>Linux kernel expansion</>, body: <><p>Since the 6.1 initial infrastructure, kernel-side Rust subsystems have gradually grown — network drivers, filesystems, PCI bindings. Linus' position: "as long as it doesn't break the C side, Rust is welcome to take new subsystems."</p></> },
  },
  {
    tag: 'WINDOWS',
    zh: { title: <>Microsoft 全面 Rust 化</>, body: <><p>Russinovich 多次重申"<strong>新项目应该用 Rust</strong>"。Windows 内核已落地 DirectWriteCore + Win32k/GDI Region。Hyper-V 的 ARM64 仿真器也开始用 Rust 出货。10 年内目标：把核心十亿行 C/C++ 中危险部分逐步迁走。</p></> },
    en: { title: <>Microsoft going all-in on Rust</>, body: <><p>Russinovich has reiterated it repeatedly: <strong>"new projects should use Rust."</strong> Windows kernel already ships DirectWriteCore and Win32k/GDI Region in Rust; the Hyper-V ARM64 emulator is going Rust too. The decade-scale goal: gradually migrate the dangerous portions of a billion lines of C/C++.</p></> },
  },
  {
    tag: 'DATA',
    zh: { title: <>Stack Overflow 9 年最受推崇</>, body: <><p>2016-2024 连续 9 年。2024 调研：<strong>83%</strong> 的现役 Rust 用户希望继续用，断崖领先所有其他语言。"最受推崇 ≠ 最常用"——但<em>用过且想继续用</em>这条指标是语言体验最直接的衡量。</p></> },
    en: { title: <>9 years most-admired on Stack Overflow</>, body: <><p>2016-2024, nine years running. The 2024 survey shows <strong>83%</strong> of current Rust users want to continue using it — a wide gap over every other language. "Most admired" isn't the same as "most used," but "people who've tried it want to keep using it" is the most direct indicator of language UX.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 基建持续 Rust 化</>, body: <><p>tokenizers / candle / vllm 内核 / Polars / DataFusion——AI 数据 / 推理栈底层正在快速 Rust 化。Python 仍是用户接口，但<strong>瓶颈热路径几乎都被 Rust 接管</strong>。</p></> },
    en: { title: <>AI infra continues going Rust</>, body: <><p>tokenizers / candle / vllm kernels / Polars / DataFusion — the AI data and inference stack is rapidly Rust-ifying underneath. Python remains the user-facing API, but <strong>the bottleneck hot paths are almost all under Rust now</strong>.</p></> },
  },
  {
    tag: 'FRONTEND',
    zh: { title: <>JS 工具链全面 Rust 化</>, body: <><p>Rolldown 1.0 RC（2026-01）替代 Rollup、Vite 8 默认接入。Oxc / SWC / Rspack / Turbopack / Biome 把 JS 工具链的速度从"秒级"压到"毫秒级"。Evan You 创办的 VoidZero 就是为这一波专门成立的。</p></> },
    en: { title: <>JS toolchain fully Rust-ified</>, body: <><p>Rolldown 1.0 RC (Jan 2026) takes over from Rollup; Vite 8 bundles it by default. Oxc / SWC / Rspack / Turbopack / Biome have collectively moved JS tooling from "seconds" to "milliseconds." Evan You founded VoidZero specifically for this rewrite wave.</p></> },
  },
];

export default function RustIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('Rust — 系统编程的现代答卷', 'Rust — A Modern Answer to Systems Programming');

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--ts-bright)' : '';
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
      <div ref={rootRef} className="rust-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <circle cx="128" cy="128" r="64" fill="none" stroke="#CE422B" strokeWidth="14" />
              <g fill="#CE422B">
                <rect x="120" y="14" width="16" height="32" rx="3" />
                <rect x="120" y="210" width="16" height="32" rx="3" />
                <rect x="14" y="120" width="32" height="16" rx="3" />
                <rect x="210" y="120" width="32" height="16" rx="3" />
                <rect x="120" y="14" width="16" height="32" rx="3" transform="rotate(45 128 128)" />
                <rect x="120" y="14" width="16" height="32" rx="3" transform="rotate(-45 128 128)" />
                <rect x="120" y="210" width="16" height="32" rx="3" transform="rotate(45 128 128)" />
                <rect x="120" y="210" width="16" height="32" rx="3" transform="rotate(-45 128 128)" />
              </g>
              <circle cx="128" cy="128" r="36" fill="#CE422B" />
              <text x="128" y="142" textAnchor="middle" fill="#fff" fontFamily="Georgia,serif" fontSize="44" fontWeight="700">R</text>
            </svg>
            <span>Rust</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": a guided tour" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语义" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Users" /></a></li>
            <li><a href="#ai"><L zh="大重写" en="Rewrite Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs C++/Go" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2006 — 2026 · Graydon Hoare · Mozilla → Rust Foundation</div>
            <h1 className="hero-title">
              <span className="hero-name">Rust</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">SystemsLang</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>让 C/C++ 三十年都没解决的内存安全问题，在<strong>编译期</strong>用一套所有权规则一次性了结；运行时不带 GC，不带 VM，跑得比 C++ 不慢，崩得比 C++ 少。这事曾被嘲为"借用检查器太烦了"。十一年后，从 Linux 内核到 Windows 内核到 Python 包管理器，半个工具链都在被它重写一遍。</>}
                en={<>A modern systems language that resolves three decades of C/C++ memory bugs in <strong>a single compile-time discipline called ownership</strong> — no garbage collector, no virtual machine, performance on par with C++. Once dismissed as "the borrow checker yells too much," eleven years later half the world's tooling — from the Linux kernel to Windows internals to Python's package manager — is being rewritten in it.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1.0<small></small></span>
                <span className="stat-label"><L zh={<>2015-05-15 稳定<br /><em>Mozilla 内孵化 9 年</em></>} en={<>Released 2015-05-15<br /><em>9 yrs incubation at Mozilla</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">9<small>yr</small></span>
                <span className="stat-label"><L zh={<>Stack Overflow 最受推崇<br /><em>2016-2024 连冠</em></>} en={<>Most-admired on Stack Overflow<br /><em>2016 — 2024 streak</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">4<small></small></span>
                <span className="stat-label"><L zh={<>主要 Edition<br /><em>2015 / 2018 / 2021 / 2024</em></>} en={<>Major editions<br /><em>2015 / 2018 / 2021 / 2024</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">100<small>×</small></span>
                <span className="stat-label"><L zh={<>uv vs pip 速度<br /><em>Python 包管理器</em></>} en={<>uv vs pip speedup<br /><em>Python package manager</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">{RUST_LOGO_SVG}</div>
            <div className="hero-floats">
              <span className="float f1">&amp;mut self</span>
              <span className="float f2">{'Result<T, E>'}</span>
              <span className="float f3">{'Option<T>'}</span>
              <span className="float f4">'static</span>
              <span className="float f5">trait Send</span>
              <span className="float f6">async fn</span>
              <span className="float f7">unsafe</span>
              <span className="float f8">{'Box<dyn>'}</span>
              <span className="float f9">match</span>
              <span className="float f10">impl Trait</span>
              <span className="float f11">{'Arc<Mutex>'}</span>
              <span className="float f12">cargo run</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Rust</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Rust 是一门<strong>编译型系统级语言</strong>，目标对位是 C 和 C++。它的核心赌注是一句话：<strong>"内存安全 + 数据竞争安全，全部在编译期完成，运行时不带 GC 也不带运行时。"</strong>这听起来像鱼与熊掌兼得，但通过一套叫"所有权"的规则，它做到了。</>}
                  en={<>Rust is a <strong>compiled systems language</strong> targeting the same ground as C and C++. Its central bet: <strong>"memory safety and data-race safety, statically, at compile time, with no garbage collector and no runtime."</strong> Three decades of "you can have safety or performance, pick one" gets traded for a discipline called ownership — and it works.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="所有权" en="Ownership" />, tag: 'ownership', p: <L zh={<>每个值在任意时刻只有<strong>一个</strong>所有者；所有者一离开作用域，值立刻被释放。不是 GC 在追，是编译器在数行号。</>} en={<>Every value has exactly <strong>one</strong> owner; the moment the owner leaves scope, the value is freed. Not a tracing GC — the compiler counts line numbers.</>} /> },
                { h: <L zh="借用检查" en="Borrow checker" />, tag: 'borrow', p: <L zh={<>多个不可变引用<strong>或</strong>一个可变引用——二选一。这条规则一刀切掉了所有"两个线程同时改一份数据"的崩法。</>} en={<>Either many shared <code>&amp;T</code> references <strong>or</strong> exactly one <code>&amp;mut T</code>. That single rule eliminates entire classes of "two threads writing the same memory" bugs.</>} /> },
                { h: <L zh="零成本抽象" en="Zero-cost abstractions" />, tag: 'zero-cost', p: <L zh={<>泛型、trait、迭代器、async/await——全部在编译期单态化展开。生成的机器码与你手写的 C 几乎一样紧。</>} en={<>Generics, traits, iterators, async/await — all monomorphised at compile time. The output binary is as tight as hand-written C.</>} /> },
                { h: <L zh="没有 null" en="No null" />, tag: 'no-null', p: <L zh={<>用 <code>Option&lt;T&gt;</code> 强制你显式处理"可能没有"。编译器不让你假装它不会是 None——Tony Hoare 那个十亿美元的错误从源头堵死。</>} en={<><code>Option&lt;T&gt;</code> forces you to handle "absent" explicitly. The compiler will not let you pretend a value can't be <code>None</code> — Tony Hoare's billion-dollar mistake closed at the source.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">user.cpp</span><span className="lang-tag js">C++</span></div>
                <pre className="code"><code>
                  <span className="cl-k">std</span>::<span className="cl-type">string</span>* <span className="cl-fn">make_user</span>() {'{'}{'\n'}
                  {'  '}<span className="cl-k">auto</span> <span className="cl-v">name</span> = <span className="cl-k">new</span> <span className="cl-k">std</span>::<span className="cl-type">string</span>(<span className="cl-s">"Graydon"</span>);{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">name</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 调用方" en="// caller" /></span>{'\n'}
                  <span className="cl-k">auto</span>* <span className="cl-v">u</span> = <span className="cl-fn">make_user</span>();{'\n'}
                  <span className="cl-fn">printf</span>(<span className="cl-s">"%s\n"</span>, <span className="cl-v">u</span>-&gt;<span className="cl-fn">c_str</span>());{'\n'}
                  <span className="cl-c"><L zh="// 忘了 delete u → 内存泄漏" en="// forgot to delete? leak." /></span>{'\n'}
                  <span className="cl-c"><L zh="// delete 两次 → use-after-free" en="// delete twice?      use-after-free." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 上线半年才被 fuzzer 抓住" en="// fuzzer finds it half a year later" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">user.rs</span><span className="lang-tag ts">Rust</span></div>
                <pre className="code"><code>
                  <span className="cl-k">fn</span> <span className="cl-fn">make_user</span>() -&gt; <span className="cl-type">String</span> {'{'}{'\n'}
                  {'  '}<span className="cl-type">String</span>::<span className="cl-fn">from</span>(<span className="cl-s">"Graydon"</span>){'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 调用方" en="// caller" /></span>{'\n'}
                  <span className="cl-k">let</span> <span className="cl-v">u</span> = <span className="cl-fn">make_user</span>();{'\n'}
                  <span className="cl-fn">println!</span>(<span className="cl-s">"{}"</span>, <span className="cl-v">u</span>);{'\n'}
                  <span className="cl-c"><L zh="// u 的所有权在这里" en="// u owns the String here." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 离开作用域 → 自动释放" en="// scope ends → freed automatically." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 编译器保证：不泄漏、不重释" en="// compiler guarantees no leak," /></span>{'\n'}
                  <span className="cl-c"><L zh="// 不需要 GC、不需要写 free" en="// no double free, no GC." /></span>
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
                zh={<>从 Graydon Hoare 一个人 2006 年的业余项目，到 Mozilla 资助、Servo 实战、1.0 稳定，再到 Linux 内核、Windows 内核陆续接受 Rust——一门"做对了的 C++"花了二十年。</>}
                en={<>From Graydon Hoare's 2006 side project, through Mozilla sponsorship and the Servo browser-engine experiment, to a 1.0 release that's now feeding kernels at Microsoft and Linus' tree — a "C++ done right" story spanning twenty years.</>}
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

          {/* 03 Essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="语言精要" en="Language essentials" /> <code>: RustEssentials</code></h2>
              <p className="sec-desc"><L
                zh={<>Rust 不是"加了类型的 C++"。它的核心抽象是另一套——所有权、借用、生命周期。掌握下面这八件套，等于读懂了 Rust 90% 的报错信息。</>}
                en={<>Rust isn't "C++ with types." Its fundamental abstractions are different: ownership, borrowing, lifetimes. Learn these eight pieces and 90% of Rust's compiler messages start to read like helpful advice.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {RUST_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>"借用检查器是老师"</>} en={<>"The borrow checker is a teacher"</>} /></h3>
                <p><L
                  zh={<>新手 Rust 第一周天天被借用检查器骂，第二周开始觉得"它说得对"，第三周写其他语言时下意识用 Rust 的脑子排查并发 bug。</>}
                  en={<>Week one with Rust: you fight the borrow checker. Week two: you start agreeing with it. Week three: you instinctively reach for ownership concepts when reasoning about concurrency in other languages.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>编译过 = 大概率跑得对</>}
                  en={<>If it compiles, it probably runs correctly.</>}
                /></em>"<L zh={<>——这是 Rust 用户最常引用的一句口号。</>} en={<> — the most-quoted Rust slogan, with surprising practical accuracy.</>} /></p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why use" /> <code>: WhyRust</code></h2>
              <p className="sec-desc"><L
                zh={<>不是因为它"更新"——它已经 11 岁了。是因为它在<strong>性能、安全、并发</strong>这个三角里第一次给出了不需要折中的答案。</>}
                en={<>Not because it's new — it's eleven years old. Because in the <strong>performance / safety / concurrency</strong> triangle, it's the first language that doesn't require you to trade one for another.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who's using it" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>从内核到浏览器到 CDN 到 Python 工具链——下面这 12 个项目里，多半是你每天间接用到的基础设施。</>}
                en={<>From kernels to browsers to CDNs to Python tooling — most of these twelve projects are infrastructure you're using right now without realising it.</>}
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

          {/* 06 Rewrite Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="Rust 重写工具链时代" en="The Rust rewrite era" /> <code>: TheRewriteEra</code></h2>
              <p className="sec-desc"><L
                zh={<>2023 年开始，一股"用 Rust 把现有工具重写一遍"的浪潮席卷整个生态。Python 包管理器、JS bundler、CSS 处理器、数据科学库、终端工具——成熟工具被一个个用 Rust 重做，单看速度提升 30×～100× 是常态。这不是炒作，是<strong>实际部署</strong>正在发生的事。</>}
                en={<>Starting around 2023, a wave of "Rust rewrites of mature tools" has reshaped entire ecosystems. Python package managers, JS bundlers, CSS processors, dataframe libraries, terminal utilities — established tools have been rewritten in Rust, and 30-100× speedups are routine. Not hype; <strong>actual production deployments</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>Microsoft 内部新启动的项目<strong>不应该</strong>再用 C 或 C++。我们应该用 Rust。内存安全错误占了我们已知漏洞的 70%——这条数据七年没变。我们不能继续把"程序员小心一点就好"当工程方案了。</>}
                en={<>New projects at Microsoft <strong>should not</strong> be starting in C or C++. They should be using Rust. Memory-safety errors account for ~70% of the security bugs we see, and that number has been stuck for seven years. We can't keep treating "the programmer just needs to be careful" as an engineering plan.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Mark Russinovich</span>
                <span className="quote-context"><L zh="Microsoft Azure CTO · 2023-09 · 2024 多次重申" en="Microsoft Azure CTO · 2023-09 · reaffirmed throughout 2024" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">100<small>×</small></div>
                <div className="ai-stat-h"><L zh="uv vs pip 速度" en="uv vs pip speedup" /></div>
                <p><L
                  zh={<>Astral 出品，热缓存下安装速度<strong>80-115×</strong> pip。一行 <code>uv pip install</code> 替掉 pip / virtualenv / pyenv / poetry / pipx 整套。Python 圈的"包管理器战争"基本结束了。</>}
                  en={<>Astral's package manager. With a warm cache, installs run <strong>80-115×</strong> faster than pip. A single <code>uv pip install</code> replaces pip / virtualenv / pyenv / poetry / pipx. Python's "package manager wars" are essentially over.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">70<small>%</small></div>
                <div className="ai-stat-h"><L zh="Pingora vs Nginx 资源" en="Pingora vs Nginx resources" /></div>
                <p><L
                  zh={<>Cloudflare 用 Rust 重写的 HTTP 代理，每天 <strong>1 万亿+</strong>请求。同等流量下 CPU 节省 70%、内存节省 67%。开源后已是 Rust 网络框架的明星项目。</>}
                  en={<>Cloudflare's Rust-based HTTP proxy now handles over <strong>1 trillion</strong> requests per day. Same traffic uses 70% less CPU and 67% less memory than the old setup. Open-sourced under Apache 2.0 in early 2024.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">9<small>yr</small></div>
                <div className="ai-stat-h"><L zh="Stack Overflow 最受推崇" en="Stack Overflow most-admired" /></div>
                <p><L
                  zh={<>从 2016 到 2024，Rust 连续 <strong>9 年</strong>蝉联 Stack Overflow Developer Survey 的"最爱用语言 / 最受推崇语言"。2024 调研：83% 用过的开发者想继续用。</>}
                  en={<>From 2016 to 2024, Rust has held the #1 spot on Stack Overflow's developer survey for "most loved" / "most admired" language for <strong>nine consecutive years</strong>. The 2024 survey: 83% of users want to keep using it.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>uv <span className="spotlight-meta">— <L zh="Astral 出品 · Python 包管 Rust 重写" en="Astral · Python package manager rewritten in Rust" /></span></h3>
                  <p><L
                    zh={<>2024 年初 Astral（Ruff 团队）发布 <strong>uv</strong>。它做的事和 pip 没区别——装包、解依赖、建 venv——但因为是 Rust 写的、并行下载、aggressive 缓存：</>}
                    en={<>In early 2024, Astral (the Ruff team) released <strong>uv</strong>. Functionally identical to pip — install packages, resolve dependencies, manage venvs — but written in Rust, with parallel downloads and aggressive caching:</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><L zh={<><strong>无缓存：8-10×</strong> 比 pip / pip-tools 快</>} en={<><strong>No cache: 8-10×</strong> faster than pip / pip-tools</>} /></li>
                    <li><L zh={<><strong>有缓存：80-115×</strong> 比 pip / pip-tools 快</>} en={<><strong>Warm cache: 80-115×</strong> faster than pip / pip-tools</>} /></li>
                    <li><L zh={<><strong>建 venv：80×</strong> 比 <code>python -m venv</code> 快</>} en={<><strong>venv creation: 80×</strong> faster than <code>python -m venv</code></>} /></li>
                    <li><L zh={<>一个静态二进制，<strong>不依赖 Rust 也不依赖 Python</strong> 就能装</>} en={<>Single static binary, <strong>installs without Rust or Python</strong> on host</>} /></li>
                    <li><L zh="同时替代 pip / pip-tools / pipx / poetry / pyenv / twine / virtualenv" en="Replaces pip / pip-tools / pipx / poetry / pyenv / twine / virtualenv" /></li>
                  </ul>
                  <p><L
                    zh={<>2026 年的 Python 圈，新项目几乎一边倒在用 uv。这是"Rust 把成熟生态重写一遍"最干净利落的一次胜利。</>}
                    en={<>By 2026, new Python projects overwhelmingly start with uv. It's the cleanest single example of "Rust rewriting an established ecosystem and winning."</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="# 安装 uv 本身" en="# install uv itself" /></span>{'\n'}
                    $ <span className="cl-fn">curl</span> -LsSf https://astral.sh/uv/install.sh | <span className="cl-fn">sh</span>{'\n\n'}
                    <span className="cl-c"><L zh="# 建项目, 装依赖" en="# create project, add deps" /></span>{'\n'}
                    $ <span className="cl-fn">uv</span> init myapp &amp;&amp; <span className="cl-k">cd</span> myapp{'\n'}
                    $ <span className="cl-fn">uv</span> add fastapi uvicorn{'\n'}
                    <span className="cl-c">{'  Resolved 24 packages in 12ms'}</span>{'\n'}
                    <span className="cl-c">{'  Installed 24 packages in 38ms'}</span>{'\n\n'}
                    <span className="cl-c"><L zh="# 对比: pip 同样操作" en="# compare: same operation with pip" /></span>{'\n'}
                    $ <span className="cl-fn">pip</span> install fastapi uvicorn{'\n'}
                    <span className="cl-c">{'  ... 4.2 seconds ...'}</span>{'\n\n'}
                    <span className="cl-c"><L zh="# 100× 不是吹的" en="# the 100× isn't marketing" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="Rust 重写工具链 · 当下最热的几十个项目" en="The Rust rewrite roster · two dozen tools currently reshaping their domains" /></h3>
              <div className="ai-tools-grid">
                {RUST_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">REVERSE</div>
                <h3><L zh="AI 基建底层也在 Rust 化" en="AI infrastructure is going Rust underneath" /></h3>
                <p><L
                  zh={<>大模型推理 / 数据流水线表面是 Python，<strong>底层热路径越来越多是 Rust</strong>。tokenizer (Hugging Face) / Polars / candle / vllm 的关键算子都在用 Rust 加速。</>}
                  en={<>Inference and data pipelines look like Python on the surface, but <strong>the hot paths are increasingly Rust</strong>. Hugging Face's tokenizers, Polars, candle, vllm's critical kernels — all leaning on Rust for the inner loop.</>}
                /></p>
                <p><L
                  zh={<>逻辑很简单：Python 写起来舒服，但要扛住 LLM 时代的算力 / 数据吞吐，必须把"内圈"换成不带 GC 不带 GIL 的语言。Go 因为带 GC 在尾延迟上吃亏（参见 Discord）；C++ 难维护、招人贵；Rust 是当下最好的中间选项。</>}
                  en={<>The reasoning is straightforward: Python is pleasant to write but cannot meet the throughput demands of LLM-era workloads. Go gets bitten by GC tail latency (see Discord). C++ is hard to maintain and expensive to staff for. Rust is the current best middle ground.</>}
                /></p>
                <p><L
                  zh={<>所以 AI 时代的格局是：<strong>外圈 Python 写 prompt 写胶水，内圈 Rust 扛性能</strong>。两者通过 PyO3 / maturin 用 FFI 衔接，对外一份 <code>pip install</code> 就用上。</>}
                  en={<>So the AI stack settles into a layered shape: <strong>Python on the outside for prompts and glue, Rust in the middle for performance.</strong> PyO3 + maturin handles the FFI seam; from the user's perspective it's still <code>pip install</code>.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 例: tokenizers (Hugging Face)" en="// Example: Hugging Face tokenizers" /></span>{'\n'}
                  <span className="cl-c"><L zh="// Python 用户:" en="// Python user:" /></span>{'\n'}
                  &gt;&gt;&gt; <span className="cl-k">from</span> tokenizers <span className="cl-k">import</span> Tokenizer{'\n'}
                  &gt;&gt;&gt; <span className="cl-v">tok</span> = <span className="cl-fn">Tokenizer</span>.<span className="cl-fn">from_pretrained</span>(<span className="cl-s">"bert-base-uncased"</span>){'\n'}
                  &gt;&gt;&gt; <span className="cl-v">tok</span>.<span className="cl-fn">encode</span>(<span className="cl-s">"hello"</span>).<span className="cl-prop">tokens</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 实际是 Rust 在干活:" en="// What's actually running:" /></span>{'\n'}
                  <span className="cl-k">use</span> tokenizers::<span className="cl-type">Tokenizer</span>;{'\n\n'}
                  <span className="cl-k">pub fn</span> <span className="cl-fn">encode</span>(<span className="cl-v">text</span>: &amp;<span className="cl-type">str</span>) -&gt; <span className="cl-type">Encoding</span> {'{'}{'\n'}
                  {'  '}<span className="cl-c"><L zh="// SIMD 加速 BPE" en="// SIMD-accelerated BPE" /></span>{'\n'}
                  {'  '}<span className="cl-c"><L zh="// 比 Python 实现 50-100× 快" en="// 50-100× faster than the pure-Python impl" /></span>{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 通过 PyO3 暴露给 Python" en="// Exposed to Python via PyO3." /></span>{'\n'}
                  <span className="cl-c"><L zh="// 用户感知不到底下是 Rust" en="// Users never realise the work is Rust." /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="用一句话总结：" en="One-line summary: " /></strong><L
                zh={<>Rust 不需要把 Python 替掉，它把 Python 调不动的那一层扛起来；不需要把 C++ 替掉，它替掉 C++ 那些"碰一下就崩"的部分；不需要把 Go 替掉，它替掉 Go 那些"GC 抖一下就 P99 飙"的服务。这是当下规模最大的一次系统软件重写浪潮。</>}
                en={<>Rust isn't trying to replace Python — it backstops the layers Python can't keep up with. It isn't trying to replace C++ — it replaces the parts of C++ that crash. It isn't trying to replace Go — it replaces the Go services where GC pauses tank the P99. This is the largest systems-software rewrite of our era, and it's well underway.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="Comparison" /> <code>: Rust vs C++ vs Go</code></h2>
              <p className="sec-desc"><L
                zh={<>三门语言的目标域有重叠也有错位。Rust 在<strong>系统级 + 服务端</strong>这个交集里挤掉了 C++ 和 Go 一部分场景。</>}
                en={<>The three languages overlap in some places and diverge in others. Where they overlap — <strong>systems and server-side</strong> — Rust has been quietly carving out territory from both C++ and Go.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-cpp">C++</th>
                  <th className="th-go">Go</th>
                  <th className="th-ts">Rust</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="内存管理" en="Memory mgmt" />, cpp: <L zh="手动 / RAII / smart ptr" en="Manual / RAII / smart ptr" />, go: <L zh="GC（暂停 ~ms）" en="GC (millisecond pauses)" />, ts: <L zh="所有权 + 借用，编译期" en="Ownership + borrow, compile-time" /> },
                  { k: <L zh="内存安全" en="Memory safety" />, cpp: <L zh="不保证" en="Not guaranteed" />, go: <L zh={<>除了 unsafe.Pointer 外保证</>} en={<>Yes, except <code>unsafe.Pointer</code></>} />, ts: <L zh="Safe 子集编译期保证" en="Statically guaranteed in safe subset" /> },
                  { k: <L zh="数据竞争" en="Data races" />, cpp: <L zh="不保证" en="Not prevented" />, go: <L zh="不保证（race detector 是工具不是规则）" en="Not prevented (race detector is a tool, not a rule)" />, ts: <L zh={<>编译期 <code>Send</code>/<code>Sync</code> 杜绝</>} en={<>Statically prevented via <code>Send</code>/<code>Sync</code></>} /> },
                  { k: <L zh="性能" en="Performance" />, cpp: <L zh="顶尖" en="Top tier" />, go: <L zh="中上（GC 拉低尾延迟）" en="Mid-high (GC affects tail latency)" />, ts: <L zh="顶尖，与 C++ 同档" en="Top tier, on par with C++" /> },
                  { k: <L zh="并发原语" en="Concurrency" />, cpp: <>std::thread + mutex</>, go: <L zh="goroutine + channel（一等公民）" en="Goroutine + channel (built-in)" />, ts: <>std::thread + async/await + channel</> },
                  { k: <L zh="异步运行时" en="Async runtime" />, cpp: <L zh="无统一标准" en="None standard" />, go: <L zh="内置（goroutine scheduler）" en="Built in (goroutine scheduler)" />, ts: <L zh="库选（tokio / async-std）" en="Library choice (tokio / async-std)" /> },
                  { k: <L zh="错误处理" en="Error handling" />, cpp: <L zh="异常 + 错误码混用" en="Mix of exceptions and codes" />, go: <><code>err != nil</code> <L zh="返回值" en="return values" /></>, ts: <><code>{'Result<T,E>'}</code> + <code>?</code></> },
                  { k: <L zh="泛型" en="Generics" />, cpp: <L zh="模板（强大但报错难懂）" en="Templates (powerful, terrible errors)" />, go: <L zh="1.18 起加上, 受限" en="Since 1.18, restricted" />, ts: <L zh="trait + 泛型 + 单态化" en="Traits + generics, monomorphised" /> },
                  { k: <L zh="编译速度" en="Compile speed" />, cpp: <L zh="慢（template 实例化）" en="Slow (template instantiation)" />, go: <L zh="极快" en="Very fast" />, ts: <L zh="慢（但比 C++ 好）" en="Slow (better than C++)" /> },
                  { k: <L zh="包管理" en="Package mgmt" />, cpp: <L zh="无统一标准（CMake/vcpkg/Conan）" en="No standard (CMake/vcpkg/Conan)" />, go: <><code>go mod</code> <L zh="内置" en="built-in" /></>, ts: <><code>cargo</code> + crates.io <L zh="内置" en="built-in" /></> },
                  { k: <L zh="学习曲线" en="Learning curve" />, cpp: <L zh="陡 + 长（30 年遗产）" en="Steep + long (30 yrs of legacy)" />, go: <L zh="非常平" en="Very gentle" />, ts: <L zh="陡（前 2 周）+ 中（生命周期）" en="Steep at first; lifetimes settle in" /> },
                  { k: <L zh="典型领域" en="Typical domains" />, cpp: <L zh="游戏引擎 / 金融 / 编译器" en="Game engines / finance / compilers" />, go: <L zh="云后端 / DevOps / CLI" en="Cloud backends / DevOps / CLI" />, ts: <L zh="系统 / 浏览器 / 工具链 / WASM" en="Systems / browsers / tooling / WASM" /> },
                  { k: <L zh="2026 招聘量" en="2026 hiring" />, cpp: <L zh="稳定但减" en="Steady, slowly shrinking" />, go: <L zh="稳定" en="Steady" />, ts: <L zh="持续上升 · 工资中位数高" en="Rising · median salary high" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.cpp}</td>
                    <td>{row.go}</td>
                    <td>{row.ts}</td>
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
                zh={<>Edition 2024 落地之后，Rust 进入"成熟期改进"阶段——async trait 完整化、const 泛型扩展、内核 / Windows 扩张、AI 基建持续 Rust 化。</>}
                en={<>Post-Edition 2024, Rust enters its "mature improvement" phase — async traits maturing, const generics expanding, more kernel and Windows surface area, and AI infrastructure continuing to be rewritten in it.</>}
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
                <li><a href="https://www.rust-lang.org" target="_blank" rel="noopener">rust-lang.org</a></li>
                <li><a href="https://doc.rust-lang.org/book/" target="_blank" rel="noopener">The Rust Book</a></li>
                <li><a href="https://doc.rust-lang.org/std/" target="_blank" rel="noopener"><L zh="std 文档" en="std reference" /></a></li>
                <li><a href="https://blog.rust-lang.org" target="_blank" rel="noopener"><L zh="官方博客" en="Official blog" /></a></li>
                <li><a href="https://crates.io" target="_blank" rel="noopener">crates.io</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key reads" /></h4>
              <ul>
                <li><a href="https://blog.rust-lang.org/2015/05/15/Rust-1.0/" target="_blank" rel="noopener">Announcing Rust 1.0</a></li>
                <li><a href="https://blog.rust-lang.org/2015/04/10/Fearless-Concurrency/" target="_blank" rel="noopener">Fearless Concurrency · Aaron Turon</a></li>
                <li><a href="https://discord.com/blog/why-discord-is-switching-from-go-to-rust" target="_blank" rel="noopener">Discord · Go → Rust</a></li>
                <li><a href="https://blog.cloudflare.com/how-we-built-pingora-the-proxy-that-connects-cloudflare-to-the-internet/" target="_blank" rel="noopener">Cloudflare Pingora</a></li>
                <li><a href="https://astral.sh/blog/uv" target="_blank" rel="noopener"><L zh="Astral · uv 发布" en="Astral · launching uv" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / data" /></h4>
              <ul>
                <li><a href="https://survey.stackoverflow.co/2024/" target="_blank" rel="noopener">Stack Overflow 2024</a></li>
                <li><a href="https://rustfoundation.org" target="_blank" rel="noopener">Rust Foundation</a></li>
                <li><a href="https://doc.rust-lang.org/edition-guide/" target="_blank" rel="noopener">Edition Guide</a></li>
                <li><a href="https://areweasyncyet.rs" target="_blank" rel="noopener">Are we async yet?</a></li>
                <li><a href="https://github.com/rust-lang/rust" target="_blank" rel="noopener">rust-lang/rust</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="重写浪潮" en="Rewrite wave" /></h4>
              <ul>
                <li><a href="https://github.com/astral-sh/uv" target="_blank" rel="noopener"><L zh="uv (pip 替代)" en="uv (pip replacement)" /></a></li>
                <li><a href="https://github.com/astral-sh/ruff" target="_blank" rel="noopener"><L zh="Ruff (flake8 替代)" en="Ruff (flake8 replacement)" /></a></li>
                <li><a href="https://biomejs.dev" target="_blank" rel="noopener"><L zh="Biome (Prettier 替代)" en="Biome (Prettier replacement)" /></a></li>
                <li><a href="https://pola.rs" target="_blank" rel="noopener"><L zh="Polars (Pandas 替代)" en="Polars (Pandas replacement)" /></a></li>
                <li><a href="https://github.com/cloudflare/pingora" target="_blank" rel="noopener"><L zh="Pingora (Nginx 替代)" en="Pingora (Nginx alt)" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">
                <svg viewBox="0 0 256 256" width="40" height="40">
                  <circle cx="128" cy="128" r="62" fill="none" stroke="#CE422B" strokeWidth="14" />
                  <g fill="#CE422B">
                    <rect x="120" y="14" width="16" height="32" rx="3" />
                    <rect x="120" y="210" width="16" height="32" rx="3" />
                    <rect x="14" y="120" width="32" height="16" rx="3" />
                    <rect x="210" y="120" width="32" height="16" rx="3" />
                  </g>
                  <circle cx="128" cy="128" r="36" fill="#CE422B" />
                  <text x="128" y="142" textAnchor="middle" fill="#fff" fontFamily="Georgia,serif" fontSize="44" fontWeight="700">R</text>
                </svg>
              </div>
              <p className="footer-line"><L zh="单页中文导览 · 资料截至 2026-05" en="Single-page bilingual tour · current as of 2026-05" /></p>
              <p className="footer-line dim"><code>{'let future: Result<Safe, !> = systems.rewrite()?;'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
