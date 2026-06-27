'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './cpp_intro.css';

const CPP_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <path
      fill="#00599C"
      d="M128 12 L228 70 V186 L128 244 L28 186 V70 Z"
    />
    <path
      fill="#fff"
      d="M128 56 c-39.7 0-72 32.3-72 72 s32.3 72 72 72 c25.6 0 48-13.4 60.7-33.5 l-31.5-18 c-6 9.7-16.6 16.2-29.2 16.2 c-18.6 0-33.7-15.1-33.7-33.7 s15.1-33.7 33.7-33.7 c12.6 0 23.2 6.5 29.2 16.2 l31.5-18 C176 69.4 153.6 56 128 56 z"
    />
    <path fill="#fff" d="M188 116 H180 V108 H172 V116 H164 V124 H172 V132 H180 V124 H188 z" />
    <path fill="#fff" d="M214 116 H206 V108 H198 V116 H190 V124 H198 V132 H206 V124 H214 z" />
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
    year: '1979',
    zh: { title: <>"C with Classes" 起步</>, desc: <>Bjarne Stroustrup 在 Bell Labs 写博士论文时受 Simula 67 的类系统启发，决定给 C 加上类。最初叫 "C with Classes"。Stroustrup 想要的是 Simula 的表达力 + C 的运行时性能，<strong>"零开销抽象"</strong>这个口号也从此诞生。</> },
    en: { title: <>"C with Classes" begins</>, desc: <>At Bell Labs, Bjarne Stroustrup, inspired by Simula 67's class system from his PhD work, decided to bolt classes onto C. The first name was "C with Classes". Stroustrup wanted Simula's expressiveness with C's runtime speed — the <strong>"zero-overhead abstraction"</strong> creed was born here.</> },
  },
  {
    year: '1983',
    zh: { title: <>改名 C++</>, desc: <>同事 Rick Mascitti 起的名字——把 C 的"自增运算符" <code>++</code> 加到名字里，意思是"在 C 之上多走一步"。1985 年首本《The C++ Programming Language》出版，事实标准从此开始。</> },
    en: { title: <>Renamed to C++</>, desc: <>Rick Mascitti, a colleague, suggested the name — taking C's increment operator <code>++</code> as a play on "one step beyond C". The first edition of <em>The C++ Programming Language</em> shipped in 1985, kicking off the de-facto standard era.</> },
  },
  {
    year: <>1998<small>·09</small></>,
    zh: { title: <>C++98 — 第一个 ISO 标准</>, desc: <>9 月 1 日 ISO/IEC 14882:1998 通过。STL（容器 / 算法 / 迭代器三件套，作者 Alexander Stepanov）正式入标。从此 C++ 不再只是"AT&T 一家说了算"。</> },
    en: { title: <>C++98 — the first ISO standard</>, desc: <>September 1st: ISO/IEC 14882:1998 ratified. The STL — containers / algorithms / iterators, by Alexander Stepanov — became part of the standard. C++ stopped being "whatever AT&T says".</> },
  },
  {
    year: '2003',
    zh: { title: <>C++03 — 缺陷修订</>, desc: <>主要是 C++98 的 bug 修订版，没引入新特性，但把厂商分歧最大的几处含糊语义统一了。这之后 C++ 沉寂了将近十年——直到 C++11。</> },
    en: { title: <>C++03 — defect report</>, desc: <>Mostly a bug-fix release for C++98, no new features, but it pinned down the wording where vendors disagreed most. Then C++ went quiet for nearly a decade — until C++11 changed everything.</> },
  },
  {
    year: '2011', highlight: true,
    zh: { title: <>C++11 — "现代 C++"元年</>, desc: <>一次脱胎换骨。<code>auto</code> 类型推导、lambda、右值引用与 move 语义、<code>std::unique_ptr</code> / <code>shared_ptr</code> 智能指针、range-based for、<code>nullptr</code>、<code>std::thread</code>、变参模板……Stroustrup 自己的话："感觉像一门新语言。"</> },
    en: { title: <>C++11 — the modern era begins</>, desc: <>A wholesale reinvention. <code>auto</code> deduction, lambdas, rvalue references and move semantics, <code>std::unique_ptr</code> / <code>shared_ptr</code> smart pointers, range-based for, <code>nullptr</code>, <code>std::thread</code>, variadic templates… Stroustrup's own words: "It feels like a new language."</> },
  },
  {
    year: '2014',
    zh: { title: <>C++14 — 打磨 C++11</>, desc: <>泛型 lambda、<code>auto</code> 函数返回值、变量模板、<code>std::make_unique</code>。是 C++11 的"小升级版"，但写起来终于顺滑。</> },
    en: { title: <>C++14 — polishing C++11</>, desc: <>Generic lambdas, <code>auto</code> return-type deduction, variable templates, <code>std::make_unique</code>. A point release on top of C++11, but the code finally flowed naturally.</> },
  },
  {
    year: '2017',
    zh: { title: <>C++17 — 工程实用主义</>, desc: <>结构化绑定 <code>auto [a, b] = pair</code>、<code>std::optional</code> / <code>variant</code> / <code>any</code>、并行算法 <code>std::execution::par</code>、<code>if constexpr</code>、文件系统库。第一次让 C++ 在日常代码里手感接近 Python / Rust。</> },
    en: { title: <>C++17 — pragmatic engineering</>, desc: <>Structured bindings <code>auto [a, b] = pair</code>, <code>std::optional</code> / <code>variant</code> / <code>any</code>, parallel algorithms <code>std::execution::par</code>, <code>if constexpr</code>, the filesystem library. For the first time, day-to-day C++ code felt close to Python or Rust ergonomics.</> },
  },
  {
    year: '2020', highlight: true,
    zh: { title: <>C++20 — 四大革新</>, desc: <><strong>Concepts</strong>（泛型约束）、<strong>Modules</strong>（替代 <code>#include</code>）、<strong>Ranges</strong>（管道式集合操作）、<strong>Coroutines</strong>（协程）。这四件套改变了 C++ 的"长相"——模板报错从 30 行天书变成一句话，编译速度有了根本性提升的可能。</> },
    en: { title: <>C++20 — the big four</>, desc: <><strong>Concepts</strong> (generic constraints), <strong>Modules</strong> (replacing <code>#include</code>), <strong>Ranges</strong> (pipeline-style collections), <strong>Coroutines</strong>. These four reshape what C++ <em>looks like</em> — template errors go from 30-line incantations to a single sentence, and modules open the door to fundamentally faster builds.</> },
  },
  {
    year: '2023',
    zh: { title: <>C++23 — 巩固 C++20</>, desc: <><code>std::expected</code>（Rust 的 <code>Result</code> 风格错误处理）、<code>std::print</code>（Python 风格格式化输出）、<code>std::mdspan</code>（多维数组视图，给科学计算用）、<code>std::generator</code> 协程化迭代器。模块体系开始稳定。</> },
    en: { title: <>C++23 — consolidating C++20</>, desc: <><code>std::expected</code> (Rust-style <code>Result</code> error handling), <code>std::print</code> (Python-flavored formatted output), <code>std::mdspan</code> (multi-dimensional array views for scientific code), <code>std::generator</code> coroutine-backed iterators. Modules finally stabilizing in the wild.</> },
  },
  {
    year: '2024', highlight: true,
    zh: { title: <>白宫"用更安全的语言" + Profiles 反击</>, desc: <>2024-02 白宫 ONCD 发布报告，建议用 Rust / Swift 等内存安全语言替代 C / C++。Stroustrup 与 Herb Sutter 推 <strong>C++ Profiles</strong>——通过编译器开关启用安全子集（bounds / lifetime / null check），不破坏现有代码。NSA 内存安全报告同年也把 C++ 列在"不安全"一栏。</> },
    en: { title: <>The White House nudge + the Profiles answer</>, desc: <>February 2024: the White House ONCD recommends replacing C / C++ with memory-safe languages like Rust or Swift. Stroustrup and Herb Sutter respond with <strong>C++ Profiles</strong> — opt-in compiler-enforced safety subsets (bounds / lifetime / null checks) that don't break existing code. The NSA memory-safety report puts C++ in the "unsafe" column the same year.</> },
  },
  {
    year: '2025',
    zh: { title: <>TIOBE Top 3 + Google Rust 数据</>, desc: <>TIOBE 2025 排名：Python · C++ · C 三强争霸（Java 跌出前三）。Google 同年公布数据：Android 把新代码切到 Rust 后，<strong>内存相关 bug 下降 50%+</strong>。但 C++ 在 AI / 高性能 / 游戏 / 高频交易仍稳坐主场——Rust 抢的主要是<strong>新</strong>系统编程项目。</> },
    en: { title: <>TIOBE top 3 + Google's Rust data</>, desc: <>TIOBE 2025 ranking: Python · C++ · C round out the top three (Java drops out). Google publishes the data: after switching new Android code to Rust, <strong>memory-related bugs fell 50%+</strong>. Yet C++ retains its grip on AI / HPC / games / high-frequency trading — Rust is mainly winning <strong>new</strong> systems projects, not displacing the existing ones.</> },
  },
  {
    year: '2026', highlight: true,
    zh: { title: <>C++26 草案进行时</>, desc: <>静态反射（compile-time 反射）、合约 (Contracts)、<code>std::execution</code> 并发模型、Pattern matching。Stroustrup 在 2025 CppCon 演讲里说："C++ 才 46 岁，还在写最有挑战的代码。"</> },
    en: { title: <>C++26 in flight</>, desc: <>Static reflection (compile-time introspection), contracts, <code>std::execution</code> concurrency model, pattern matching. From Stroustrup's CppCon 2025 keynote: "C++ is 46 years old, and it's still writing the most challenging code in the world."</> },
  },
];

interface CppCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const CPP_CARDS: CppCard[] = [
  {
    tag: 'A',
    zh: { title: <>类与 RAII</>, desc: <>对象的"<strong>构造即资源获取，析构即资源释放</strong>"。无需 GC、无需 <code>try / finally</code>，作用域结束就清理。</> },
    en: { title: <>Classes & RAII</>, desc: <>"<strong>Resource acquisition is initialization</strong>" — destructors clean up at scope exit. No GC, no <code>try / finally</code>, just structured lifetimes.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">File</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">FILE</span>* <span className="cl-v">f</span>;{'\n'}
        <span className="cl-k">public</span>:{'\n'}
        {'  '}<span className="cl-fn">File</span>(<span className="cl-k">const char</span>* <span className="cl-v">p</span>){'\n'}
        {'    '}: <span className="cl-v">f</span>(<span className="cl-fn">fopen</span>(<span className="cl-v">p</span>, <span className="cl-s">"r"</span>)) {'{}'}{'\n'}
        {'  '}~<span className="cl-fn">File</span>() {'{ '}<span className="cl-fn">fclose</span>(<span className="cl-v">f</span>); {'}'}{'\n'}
        {'};'}{'\n\n'}
        <span className="cl-c">{'// 离开作用域 fclose 自动调用'}</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>模板与泛型</>, desc: <>编译期的代码生成器。一份代码给所有类型用，<strong>零运行时开销</strong>——和 Java 泛型的擦除完全不同。</> },
    en: { title: <>Templates & generics</>, desc: <>Compile-time code generation. One source, every type, <strong>zero runtime cost</strong> — unlike Java's type erasure.</> },
    code: (
      <code>
        <span className="cl-k">template</span> &lt;<span className="cl-k">typename</span> <span className="cl-type">T</span>&gt;{'\n'}
        <span className="cl-type">T</span> <span className="cl-fn">max</span>(<span className="cl-type">T</span> <span className="cl-v">a</span>, <span className="cl-type">T</span> <span className="cl-v">b</span>) {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">a</span> &gt; <span className="cl-v">b</span> ? <span className="cl-v">a</span> : <span className="cl-v">b</span>;{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-fn">max</span>(<span className="cl-n">3</span>, <span className="cl-n">7</span>);          <span className="cl-c">{'// T = int'}</span>{'\n'}
        <span className="cl-fn">max</span>(<span className="cl-n">3.14</span>, <span className="cl-n">2.71</span>);    <span className="cl-c">{'// T = double'}</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>智能指针</>, desc: <>不要再裸 <code>new</code> / <code>delete</code>。<code>unique_ptr</code> 独占、<code>shared_ptr</code> 共享、<code>weak_ptr</code> 弱引用——所有权由类型说话。</> },
    en: { title: <>Smart pointers</>, desc: <>Stop writing raw <code>new</code> / <code>delete</code>. <code>unique_ptr</code> for sole ownership, <code>shared_ptr</code> for shared, <code>weak_ptr</code> for non-owning — ownership becomes part of the type.</> },
    code: (
      <code>
        <span className="cl-k">auto</span> <span className="cl-v">p</span> ={'\n'}
        {'  '}<span className="cl-fn">std::make_unique</span>&lt;<span className="cl-type">User</span>&gt;(<span className="cl-s">"Bjarne"</span>);{'\n\n'}
        <span className="cl-c">{'// 离开作用域自动 delete'}</span>{'\n'}
        <span className="cl-c">{'// 不能拷贝, 只能 std::move'}</span>{'\n\n'}
        <span className="cl-k">auto</span> <span className="cl-v">q</span> = <span className="cl-fn">std::move</span>(<span className="cl-v">p</span>);{'\n'}
        <span className="cl-c">{'// p 现在是 nullptr'}</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Move 语义</>, desc: <>右值引用 <code>&amp;&amp;</code> 让"转移所有权"成为可表达的概念——比拷贝快几个数量级，避免不必要的内存分配。</> },
    en: { title: <>Move semantics</>, desc: <>Rvalue references <code>&amp;&amp;</code> make "transfer ownership" expressible — orders of magnitude faster than copying, avoiding allocations entirely.</> },
    code: (
      <code>
        <span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt; <span className="cl-v">a</span> = {'{ '}<span className="cl-n">1</span>, <span className="cl-n">2</span>, <span className="cl-n">3</span>{' };'}{'\n'}
        <span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt; <span className="cl-v">b</span> = <span className="cl-fn">std::move</span>(<span className="cl-v">a</span>);{'\n\n'}
        <span className="cl-c">{'// b 接管底层数组'}</span>{'\n'}
        <span className="cl-c">{'// a 变成空, 但合法'}</span>{'\n'}
        <span className="cl-c">{'// 没有拷贝百万元素'}</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Lambda</>, desc: <>C++11 才有的"匿名函数"。捕获列表 <code>[&amp;]</code> / <code>[=]</code> 决定按引用还是按值抓上下文，最终编译成一个匿名 functor。</> },
    en: { title: <>Lambdas</>, desc: <>Anonymous functions, since C++11. The capture list <code>[&amp;]</code> / <code>[=]</code> chooses by-reference vs by-value capture; the compiler emits an anonymous functor.</> },
    code: (
      <code>
        <span className="cl-k">int</span> <span className="cl-v">cutoff</span> = <span className="cl-n">10</span>;{'\n'}
        <span className="cl-k">auto</span> <span className="cl-v">small</span> = [<span className="cl-v">cutoff</span>](<span className="cl-k">int</span> <span className="cl-v">x</span>) {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">x</span> &lt; <span className="cl-v">cutoff</span>;{'\n'}
        {'};'}{'\n\n'}
        <span className="cl-fn">std::ranges::filter</span>(<span className="cl-v">v</span>, <span className="cl-v">small</span>);
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>STL 容器与算法</>, desc: <>Stepanov 设计的"<strong>容器 / 算法 / 迭代器</strong>"三件套。<code>vector</code> / <code>map</code> / <code>unordered_map</code> 配 <code>sort</code> / <code>find</code> / <code>transform</code>，再用迭代器粘起来。</> },
    en: { title: <>STL containers & algorithms</>, desc: <>Stepanov's "<strong>containers / algorithms / iterators</strong>" trio. <code>vector</code> / <code>map</code> / <code>unordered_map</code> coupled with <code>sort</code> / <code>find</code> / <code>transform</code>, glued together by iterators.</> },
    code: (
      <code>
        <span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt; <span className="cl-v">v</span> = {'{ '}<span className="cl-n">3</span>, <span className="cl-n">1</span>, <span className="cl-n">4</span>, <span className="cl-n">1</span>, <span className="cl-n">5</span>{' };'}{'\n'}
        <span className="cl-fn">std::sort</span>(<span className="cl-v">v</span>.<span className="cl-fn">begin</span>(), <span className="cl-v">v</span>.<span className="cl-fn">end</span>());{'\n\n'}
        <span className="cl-c">{'// C++20 ranges 风格'}</span>{'\n'}
        <span className="cl-fn">std::ranges::sort</span>(<span className="cl-v">v</span>);{'\n'}
        <span className="cl-k">auto</span> <span className="cl-v">it</span> = <span className="cl-fn">std::ranges::find</span>(<span className="cl-v">v</span>, <span className="cl-n">4</span>);
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>多继承 + 虚函数</>, desc: <>C++ 是少数允许多继承的主流语言。运行时多态靠 <code>virtual</code> 函数+虚表（vtable），编译期多态靠模板。两条路并存。</> },
    en: { title: <>Inheritance + virtual functions</>, desc: <>C++ is one of few mainstream languages that allows multiple inheritance. Runtime polymorphism via <code>virtual</code> functions and a vtable; compile-time polymorphism via templates. Both paths, side by side.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Shape</span> {'{'}{'\n'}
        <span className="cl-k">public</span>:{'\n'}
        {'  '}<span className="cl-k">virtual double</span> <span className="cl-fn">area</span>() <span className="cl-k">const</span> = <span className="cl-n">0</span>;{'\n'}
        {'  '}<span className="cl-k">virtual</span> ~<span className="cl-fn">Shape</span>() = <span className="cl-k">default</span>;{'\n'}
        {'};'}{'\n\n'}
        <span className="cl-k">class</span> <span className="cl-type">Circle</span> : <span className="cl-k">public</span> <span className="cl-type">Shape</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">double</span> <span className="cl-fn">area</span>() <span className="cl-k">const</span> <span className="cl-k">override</span>;{'\n'}
        {'};'}
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
    zh: { title: <>零开销抽象</>, desc: <>Stroustrup 立下的祖训："<strong>用不到的东西不付出代价；用得到的东西，手写汇编也不会更快</strong>。"模板、lambda、智能指针——抽象都在编译期消失，运行时 = 裸机性能。</> },
    en: { title: <>Zero-overhead abstraction</>, desc: <>Stroustrup's law: "<strong>What you don't use, you don't pay for. What you do use, you couldn't hand-code any faster.</strong>" Templates, lambdas, smart pointers — abstractions vanish at compile time; runtime equals bare metal.</> },
    code: <><span className="cl-k">auto</span> <span className="cl-v">f</span> = []({'..'}){'{...}'};{'\n'}<span className="cl-c">{'// inline 后等同手写 C'}</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>对硬件直接说话</>, desc: <>指针、内存布局、SIMD intrinsic、内联汇编——C++ 给你"低到看见 cache line"的控制力。这是为什么操作系统、编译器、数据库内核全是 C++。</> },
    en: { title: <>Speaks directly to hardware</>, desc: <>Pointers, memory layout, SIMD intrinsics, inline assembly — C++ gives you control "down to the cache line." That's why OS kernels, compilers, and database engines are all written in C++.</> },
    code: <><span className="cl-k">alignas</span>(<span className="cl-n">64</span>) <span className="cl-type">int</span> <span className="cl-v">buf</span>[<span className="cl-n">1024</span>];{'\n'}<span className="cl-c">{'// 对齐到 cache line'}</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>RAII = 没有 GC 也安全</>, desc: <>构造 / 析构成对出现，作用域结束就清理。<strong>资源泄漏 80% 不存在了</strong>，剩下 20% 用智能指针 + <code>std::unique_lock</code> 之类的 RAII 包装搞定。</> },
    en: { title: <>RAII = safety without GC</>, desc: <>Constructors and destructors pair up, cleanup happens at scope exit. <strong>80% of leaks just disappear</strong>; the remaining 20% are handled by smart pointers and RAII wrappers like <code>std::unique_lock</code>.</> },
    code: <><span className="cl-k">{'{'}</span>{'\n'}{'  '}<span className="cl-fn">std::lock_guard</span> <span className="cl-v">lk</span>(<span className="cl-v">m</span>);{'\n'}{'  '}<span className="cl-c">{'// ... critical'}</span>{'\n'}<span className="cl-k">{'}'}</span> <span className="cl-c">{'// 自动 unlock'}</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>STL — 工业级集合</>, desc: <>40 年打磨的算法库，<code>std::sort</code> 是 introsort（quicksort + heapsort 兜底），<code>unordered_map</code> 用 open addressing 还是 chaining 看实现。每个容器的复杂度在标准里<strong>白纸黑字写明</strong>。</> },
    en: { title: <>STL — battle-tested collections</>, desc: <>40 years of polish. <code>std::sort</code> is introsort (quicksort with heapsort fallback); <code>unordered_map</code> picks open addressing or chaining per implementation. Each container's complexity is <strong>guaranteed in writing</strong> by the standard.</> },
    code: <><span className="cl-fn">std::ranges::sort</span>(<span className="cl-v">v</span>);{'\n'}<span className="cl-c">{'// O(n log n), 标准担保'}</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>跨平台从一始至今</>, desc: <>Linux / Windows / macOS / iOS / Android / 嵌入式 / WASM——只要有 C 编译器的地方就有 C++。GCC、Clang、MSVC 三家主力编译器一致紧跟 ISO 标准。</> },
    en: { title: <>Cross-platform since day one</>, desc: <>Linux / Windows / macOS / iOS / Android / embedded / WebAssembly — wherever a C compiler exists, C++ follows. GCC, Clang, and MSVC track the ISO standard in lockstep.</> },
    code: <><span className="cl-c">{'// 同一份源码'}</span>{'\n'}<span className="cl-c">{'// gcc / clang / msvc'}</span>{'\n'}<span className="cl-c">{'// 全部能编'}</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>性能即正义</>, desc: <>高频交易要纳秒响应、游戏引擎要 60fps 物理模拟、AI 推理要榨干 GPU——这些场景<strong>非 C / C++ 不可</strong>。Python / Rust / Go 的性能再好，也是在 C++ 写的运行时上跑。</> },
    en: { title: <>Performance as a virtue</>, desc: <>HFT needs nanoseconds, game engines need 60fps physics, AI inference needs every GPU cycle — these scenarios are <strong>C / C++ only</strong>. Python / Rust / Go all run on top of C++-written runtimes.</> },
    code: <><span className="cl-c">{'// HFT 报单 < 500ns'}</span>{'\n'}<span className="cl-c">{'// PyTorch tensor op'}</span>{'\n'}<span className="cl-c">{'// V8 JIT compile'}</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>编译期算一切</>, desc: <><code>constexpr</code> / <code>consteval</code> / <code>concept</code> 让你在编译期算斐波那契、解 SQL、做类型推导。运行时只剩"把结果搬出去"——这是 Rust / Zig 都还在追的特性。</> },
    en: { title: <>Computed at compile time</>, desc: <><code>constexpr</code> / <code>consteval</code> / <code>concept</code> let you compute Fibonacci, parse SQL, or do type inference all at compile time. The runtime only "moves the result out" — a feature Rust and Zig are still chasing.</> },
    code: <><span className="cl-k">constexpr int</span> <span className="cl-v">fact</span>(<span className="cl-k">int</span> <span className="cl-v">n</span>){'\n'}{'  '}{'{ '}<span className="cl-k">return</span> <span className="cl-v">n</span> ? <span className="cl-v">n</span>*<span className="cl-fn">fact</span>(<span className="cl-v">n</span>-<span className="cl-n">1</span>) : <span className="cl-n">1</span>; {'}'}{'\n'}<span className="cl-c">{'// fact(10) 编译期算完'}</span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>生态体量无人能敌</>, desc: <>40 年累积的库：Boost / Eigen / OpenCV / Qt / Unreal / TBB / GoogleTest……加上整个 C 生态可以无缝调用。<strong>其他语言"绑定"的很多东西，C++ 是原生主场</strong>。</> },
    en: { title: <>Unmatched ecosystem depth</>, desc: <>Forty years of libraries: Boost / Eigen / OpenCV / Qt / Unreal / TBB / GoogleTest — plus the entire C ecosystem callable without friction. <strong>Things other languages "bind to", C++ owns natively</strong>.</> },
    code: <><span className="cl-c">{'// Eigen, OpenCV,'}</span>{'\n'}<span className="cl-c">{'// CUDA, MPI, Qt'}</span>{'\n'}<span className="cl-c">{'// 全部 first-party'}</span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>AI 时代 = C++ 时代</>, desc: <>PyTorch / TensorFlow / JAX 看似 Python，<strong>真正算 tensor 的全是 C++ 内核</strong>。CUDA kernel、libtorch、XLA、ONNX runtime——AI 越火，C++ 越被需要。</> },
    en: { title: <>The AI era = the C++ era</>, desc: <>PyTorch / TensorFlow / JAX look like Python, but <strong>the actual tensor math runs in C++ kernels</strong>. CUDA kernels, libtorch, XLA, ONNX runtime — the more AI booms, the more C++ is needed.</> },
    code: <><span className="cl-c">{'// torch._C → libtorch.so'}</span>{'\n'}<span className="cl-c">{'// XLA → C++ + LLVM IR'}</span>{'\n'}<span className="cl-c">{'// CUDA kernel = C++'}</span></>,
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
    href: 'https://pytorch.org', highlight: true,
    zhName: 'PyTorch', enName: 'PyTorch',
    zhNote: 'libtorch 内核 · 100% C++', enNote: 'libtorch core · 100% C++',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 8 C28 30 28 60 50 78 C72 60 72 30 50 8 Z" fill="#EE4C2C"/><circle cx="62" cy="22" r="5" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.tensorflow.org', highlight: true,
    zhName: 'TensorFlow', enName: 'TensorFlow',
    zhNote: 'C++ runtime · XLA', enNote: 'C++ runtime · XLA',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 8 L88 30 V70 L50 92 L12 70 V30 Z" fill="#FF6F00"/><path d="M50 25 L74 38 V58 L50 70 V52 L60 46 V42 L50 36 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.unrealengine.com', highlight: true,
    zhName: 'Unreal Engine 5', enName: 'Unreal Engine 5',
    zhNote: '游戏引擎 · 数百万行 C++', enNote: 'Game engine · millions of LOC',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#0E1128"/><path d="M50 18 C66 18 80 32 80 48 C80 66 66 80 50 80 C34 80 20 66 20 48 C20 32 34 18 50 18 Z" fill="none" stroke="#fff" strokeWidth="2"/><path d="M50 30 L62 58 H54 V70 L38 50 H46 V40 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.chromium.org',
    zhName: 'Chrome / Chromium', enName: 'Chrome / Chromium',
    zhNote: '浏览器内核 · Blink + V8', enNote: 'Browser core · Blink + V8',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#fff"/><circle cx="50" cy="50" r="18" fill="#1A73E8"/><path d="M50 5 L85 50 H62 L50 30 Z" fill="#EA4335"/><path d="M85 50 L62 92 L50 60 Z" fill="#FBBC04"/><path d="M50 95 L18 60 L50 50 Z" fill="#34A853"/></svg>,
  },
  {
    href: 'https://llvm.org', highlight: true,
    zhName: 'LLVM / Clang', enName: 'LLVM / Clang',
    zhNote: '编译器基础设施', enNote: 'Compiler infrastructure',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#262D3A"/><path d="M30 30 H45 V70 H30 Z M50 30 H62 L72 70 H58 Z M50 30 V44 H62 V30 Z" fill="#FFD43B"/></svg>,
  },
  {
    href: 'https://v8.dev',
    zhName: 'V8 (Node / Chrome)', enName: 'V8 (Node / Chrome)',
    zhNote: 'JS 引擎 · 90 万行 C++', enNote: 'JS engine · 900K LOC C++',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#4B8BF5"/><path d="M28 38 H42 L50 56 L58 38 H72 L52 78 H48 Z" fill="#fff"/><text x="50" y="32" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="monospace">8</text></svg>,
  },
  {
    href: 'https://www.adobe.com/products/photoshop.html',
    zhName: 'Photoshop', enName: 'Photoshop',
    zhNote: '图像处理 · 30+ 年 C++', enNote: 'Image processing · 30+ yrs C++',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="8" y="8" width="84" height="84" rx="14" fill="#001E36"/><text x="50" y="68" textAnchor="middle" fontSize="44" fontWeight="900" fill="#31A8FF" fontFamily="sans-serif">Ps</text></svg>,
  },
  {
    href: 'https://www.microsoft.com/microsoft-365',
    zhName: 'Microsoft Office', enName: 'Microsoft Office',
    zhNote: 'Word / Excel / PowerPoint', enNote: 'Word / Excel / PowerPoint',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M14 22 L60 12 V88 L14 78 Z" fill="#D83B01"/><path d="M60 26 H86 V74 H60 Z" fill="#fff" stroke="#D83B01" strokeWidth="2"/><text x="35" y="58" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="sans-serif">O</text></svg>,
  },
  {
    href: 'https://www.mongodb.com',
    zhName: 'MongoDB', enName: 'MongoDB',
    zhNote: '数据库内核 · C++', enNote: 'Database core · C++',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 8 C42 30 30 50 50 92 C70 50 58 30 50 8 Z" fill="#13AA52"/><path d="M50 92 V8" stroke="#fff" strokeWidth="1.5" opacity=".6"/></svg>,
  },
  {
    href: 'https://webkit.org',
    zhName: 'WebKit / Safari', enName: 'WebKit / Safari',
    zhNote: '浏览器内核 · Apple', enNote: 'Browser engine · Apple',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#1E88E5"/><path d="M50 12 L60 48 L88 50 L60 52 L50 88 L40 52 L12 50 L40 48 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://developer.nvidia.com/cuda-toolkit', highlight: true,
    zhName: 'CUDA', enName: 'CUDA',
    zhNote: 'NVIDIA GPU · C++ 扩展', enNote: 'NVIDIA GPU · C++ extension',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#76B900"/><path d="M28 30 L52 30 L72 50 L52 70 L28 70 L48 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://isocpp.org',
    zhName: 'ISO C++', enName: 'ISO C++',
    zhNote: '标准委员会 · WG21', enNote: 'Standards committee · WG21',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 8 L86 28 V72 L50 92 L14 72 V28 Z" fill="#00599C"/><path d="M50 28 c-12 0-22 10-22 22 s10 22 22 22 c8 0 15-4 18-10 l-10-6 c-2 3-5 5-8 5 c-6 0-11-5-11-11 s5-11 11-11 c3 0 6 2 8 5 l10-6 C65 32 58 28 50 28 z" fill="#fff"/><path d="M76 46 H72 V42 H68 V46 H64 V50 H68 V54 H72 V50 H76 z M88 46 H84 V42 H80 V46 H76 V50 H80 V54 H84 V50 H88 z" fill="#fff"/></svg>,
  },
];

interface AiTool { name: string; zhDesc: string; enDesc: string }
const AI_TOOLS: AiTool[] = [
  { name: 'libtorch',          zhDesc: 'PyTorch 的 C++ 内核',           enDesc: "PyTorch's C++ core" },
  { name: 'TensorFlow C++',    zhDesc: 'TF runtime / XLA 全 C++',        enDesc: 'TF runtime / XLA all C++' },
  { name: 'ONNX Runtime',      zhDesc: 'MS · 跨框架推理 · C++',          enDesc: 'MS · cross-framework inference · C++' },
  { name: 'CUDA / cuDNN',      zhDesc: 'NVIDIA GPU 计算栈',              enDesc: 'NVIDIA GPU compute stack' },
  { name: 'TensorRT',          zhDesc: 'NVIDIA · 推理优化器',            enDesc: 'NVIDIA · inference optimizer' },
  { name: 'llama.cpp',         zhDesc: '本地 LLM 推理 · 纯 C++',         enDesc: 'Local LLM inference · pure C++' },
  { name: 'ggml',              zhDesc: 'llama.cpp 张量库',               enDesc: "llama.cpp's tensor lib" },
  { name: 'whisper.cpp',       zhDesc: 'OpenAI Whisper · C++ port',      enDesc: 'OpenAI Whisper · C++ port' },
  { name: 'TVM',               zhDesc: '深度学习编译器 · C++',           enDesc: 'DL compiler · C++' },
  { name: 'JAX (XLA backend)', zhDesc: 'Google · XLA = C++',             enDesc: 'Google · XLA = C++' },
  { name: 'NCCL',              zhDesc: 'NVIDIA · 多卡通信库',            enDesc: 'NVIDIA · multi-GPU comm' },
  { name: 'FlashAttention',    zhDesc: 'CUDA / C++ kernel',              enDesc: 'CUDA / C++ kernel' },
  { name: 'vLLM kernels',      zhDesc: 'LLM 推理服务 · C++ kernel',      enDesc: 'LLM serving · C++ kernel' },
  { name: 'OpenCV',            zhDesc: '计算机视觉 · C++ 主体',          enDesc: 'CV library · C++ core' },
  { name: 'Eigen',             zhDesc: '线性代数 header-only',           enDesc: 'Linear algebra header-only' },
  { name: 'MLX (Apple)',       zhDesc: 'Apple Silicon · C++ + Metal',    enDesc: 'Apple Silicon · C++ + Metal' },
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
    tag: <>HOT · 2024-2026</>, hot: true, big: true,
    zh: {
      title: <>C++ Profiles — 安全性反击战</>,
      body: (<>
        <p>2024-02 白宫 ONCD 报告点名 C / C++ "内存不安全"。Stroustrup 与 Herb Sutter 联手推 <strong>Profiles</strong>：通过编译器开关启用安全子集（bounds / lifetime / null check），<strong>不破坏现有代码</strong>。目标是 C++26 / C++29 进标准。</p>
        <p>Stroustrup 自己的话：<em>"我们不需要把全人类 50 亿行 C++ 代码全推倒重来——我们需要让旧代码<strong>变安全</strong>。"</em></p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="裸 C++ (历史)" en="Raw C++ (legacy)" /></span><span className="bar-val">~70% mem bug</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="C++ Profiles + Rust" en="C++ Profiles + Rust" /></span><span className="bar-val">&lt; 5%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>C++ Profiles — the safety counter</>,
      body: (<>
        <p>February 2024: the White House ONCD report names C / C++ as "memory-unsafe". Stroustrup and Herb Sutter team up on <strong>Profiles</strong> — opt-in compiler-enforced safety subsets (bounds / lifetime / null) that <strong>don't break existing code</strong>. Targeting C++26 / C++29.</p>
        <p>Stroustrup's own words: <em>"We don't need to rewrite the world's 5 billion lines of C++. We need to make old code <strong>safe</strong>."</em></p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="裸 C++ (历史)" en="Raw C++ (legacy)" /></span><span className="bar-val">~70% mem bug</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="C++ Profiles + Rust" en="C++ Profiles + Rust" /></span><span className="bar-val">&lt; 5%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'C++26',
    zh: { title: <>静态反射进标准</>, body: <><p>编译期反射（compile-time reflection）历经十几年提案，C++26 终于正式入标。能在编译期遍历类的成员、生成序列化代码、做 ORM——再也不用宏黑魔法或 codegen 工具链。</p></> },
    en: { title: <>Static reflection lands</>, body: <><p>After more than a decade of proposals, compile-time reflection finally enters C++26. Walk class members at compile time, auto-generate serialization, do ORM — no more macro black magic or external codegen.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 内核 100% 是 C++</>, body: <><p>PyTorch / TensorFlow / JAX / vLLM / llama.cpp—Python 是面板，<strong>真正算的全是 C++ + CUDA</strong>。AI 越普及，C++ 在底层越被需要。"高级语言越多，C++ 的护城河越深。"</p></> },
    en: { title: <>AI kernels are 100% C++</>, body: <><p>PyTorch / TensorFlow / JAX / vLLM / llama.cpp — Python is the dashboard; <strong>the actual math is C++ + CUDA</strong>. The more pervasive AI gets, the more C++ is needed below. "More high-level languages above, deeper the C++ moat."</p></> },
  },
  {
    tag: 'RUST',
    zh: { title: <>与 Rust 共存</>, body: <><p>Google：Android 新代码切 Rust 后<strong>内存 bug 降 50%+</strong>。但 50 亿行存量 C++ 不会消失。Stroustrup 表态："Rust 是好语言，但 C++ 在 AI / 游戏 / HFT 仍是<strong>主场</strong>。" 双轨并存是未来 20 年的现实。</p></> },
    en: { title: <>Coexisting with Rust</>, body: <><p>Google: Android's new Rust code <strong>cut memory bugs 50%+</strong>. But 5 billion lines of legacy C++ aren't going anywhere. Stroustrup's take: "Rust is a fine language, but C++ remains the home field in AI / games / HFT." Dual tracks are the next 20 years' reality.</p></> },
  },
  {
    tag: 'BUILD',
    zh: { title: <>Modules 终于落地</>, body: <><p>C++20 引入的 module 体系（替代 <code>#include</code>）在 C++23 / C++26 终于编译器支持齐备。MSVC / GCC / Clang 都已支持，构建速度<strong>能快 5×~10×</strong>。</p></> },
    en: { title: <>Modules finally usable</>, body: <><p>The C++20 module system (replacing <code>#include</code>) is finally well-supported across MSVC / GCC / Clang in 2025. Build speed-ups in the <strong>5×–10×</strong> range are real.</p></> },
  },
  {
    tag: 'TIOBE',
    zh: { title: <>TIOBE 长期 Top 5</>, body: <><p>2025: Python · C++ · C 三强争霸；C++ 已经连续<strong>30+ 年</strong>稳坐 TIOBE 前五。GitHub 上 C++ 仓库年增量稳定在头部——比"老语言"想象中年轻得多。</p></> },
    en: { title: <>TIOBE perennial top 5</>, body: <><p>2025: Python · C++ · C lead the TIOBE chart; C++ has held a <strong>30+ year</strong> top-five streak. New C++ repo growth on GitHub stays among the leaders — far younger than the "legacy language" stereotype suggests.</p></> },
  },
];

export default function CppIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'C++ : Systems — 46 年仍是性能之王',
    'C++ : Systems — 46 Years and Still the King of Performance'
  );

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
      <div ref={rootRef} className="cpp-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <path fill="#00599C" d="M128 12 L228 70 V186 L128 244 L28 186 V70 Z" />
              <path fill="#fff" d="M128 56 c-39.7 0-72 32.3-72 72 s32.3 72 72 72 c25.6 0 48-13.4 60.7-33.5 l-31.5-18 c-6 9.7-16.6 16.2-29.2 16.2 c-18.6 0-33.7-15.1-33.7-33.7 s15.1-33.7 33.7-33.7 c12.6 0 23.2 6.5 29.2 16.2 l31.5-18 C176 69.4 153.6 56 128 56 z" />
              <path fill="#fff" d="M188 116 H180 V108 H172 V116 H164 V124 H172 V132 H180 V124 H188 z" />
              <path fill="#fff" d="M214 116 H206 V108 H198 V116 H190 V124 H198 V132 H206 V124 H214 z" />
            </svg>
            <span>C++</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="精要" en="Essence" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Rust" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1979 — 2026 · Bell Labs · Bjarne Stroustrup</div>
            <h1 className="hero-title">
              <span className="hero-name">C++</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">Systems</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>从 1979 年 Bell Labs 一个"给 C 加上类"的副业项目，到操作系统、浏览器、游戏引擎、数据库内核背后的<strong>性能之王</strong>。46 年过去——它是 PyTorch / TensorFlow 的真实算力，是 Chrome / V8 的引擎本体，是 Unreal Engine 5 / Photoshop / Office 的底盘。AI 越火，它越被需要。</>}
                en={<>From a 1979 Bell Labs side project to "add classes to C" — to the <strong>king of performance</strong> behind every OS, browser, game engine, and database. 46 years on, it is PyTorch / TensorFlow's actual compute, the engine of Chrome / V8, the chassis of Unreal Engine 5 / Photoshop / Office. The hotter AI gets, the more it is needed.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">46<small> yr</small></span>
                <span className="stat-label"><L zh={<>1979 — 2025<br /><em>Bell Labs · Bjarne Stroustrup</em></>} en={<>1979 — 2025<br /><em>Bell Labs · Bjarne Stroustrup</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">100<small>%</small></span>
                <span className="stat-label"><L zh={<>PyTorch / TF / JAX 内核<br /><em>Python 只是表皮</em></>} en={<>of PyTorch / TF / JAX kernels<br /><em>Python is just skin</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">5B<small>+</small></span>
                <span className="stat-label"><L zh={<>行存量 C++ 代码<br /><em>Chrome / Unreal / V8 / Office</em></>} en={<>lines of C++ code in production<br /><em>Chrome / Unreal / V8 / Office</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">26<small></small></span>
                <span className="stat-label"><L zh={<>C++26 进行时<br /><em>反射 / Profiles / 模式匹配</em></>} en={<>C++26 in motion<br /><em>reflection / profiles / patterns</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{CPP_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">{`std::vector<T>`}</span>
              <span className="float f2">unique_ptr</span>
              <span className="float f3">constexpr</span>
              <span className="float f4">auto&amp;</span>
              <span className="float f5">{`<<`}</span>
              <span className="float f6">RAII</span>
              <span className="float f7">{`->`}</span>
              <span className="float f8">virtual</span>
              <span className="float f9">noexcept</span>
              <span className="float f10">concept</span>
              <span className="float f11">{`std::move`}</span>
              <span className="float f12">consteval</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>C++</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>C++ 是一门<strong>多范式系统编程语言</strong>：过程式 / 面向对象 / 泛型 / 函数式都支持，但每条路径都坚守同一条祖训——<strong>"零开销抽象"</strong>。它不像 Python 那样强调"开发者爽"，也不像 Rust 那样强调"编译期阻止你犯错"——它强调"让你能<em>表达任何东西</em>，又不付出运行时代价"。</>}
                  en={<>C++ is a <strong>multi-paradigm systems language</strong>: procedural / object-oriented / generic / functional — all supported, all bound by one creed: <strong>"zero-overhead abstraction"</strong>. Unlike Python, it doesn't optimize for "developer joy"; unlike Rust, it doesn't try to "stop you compiling bad code". It optimizes for "<em>express anything</em>, with no runtime cost".</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="多范式" en="Multi-paradigm" />, tag: 'paradigms', p: <L zh={<>过程式 / OOP / 泛型 / 函数式 / 元编程一锅炖。同一份代码可以是 C 风格 <code>for</code>，也可以是 ranges 风格 pipeline。</>} en={<>Procedural / OOP / generic / functional / metaprogramming, all in one pot. The same code can be a C-style <code>for</code> loop or a ranges-style pipeline.</>} /> },
                { h: <L zh="零开销抽象" en="Zero overhead" />, tag: 'creed', p: <L zh={<>用不到的东西不付出代价；用得到的东西，手写汇编也不会更快。模板、lambda、智能指针在编译期消失，运行时 = 裸机。</>} en={<>What you don't use, you don't pay for. What you do, you couldn't hand-code any faster. Templates, lambdas, smart pointers vanish at compile time — runtime equals bare metal.</>} /> },
                { h: <L zh="贴近硬件" en="Close to hardware" />, tag: 'metal', p: <L zh={<>指针、内存布局、SIMD intrinsic、内联汇编都给你。<code>alignas</code> 让你对齐 cache line，<code>volatile</code> 让你直接 mmio。</>} en={<>Pointers, memory layout, SIMD intrinsics, inline assembly — all yours. <code>alignas</code> for cache lines, <code>volatile</code> for direct MMIO.</>} /> },
                { h: <L zh="兼容 C" en="C-compatible" />, tag: 'C ABI', p: <L zh={<>整个 C 生态可以无缝调用。这是为什么 Python / Node / Ruby 的 native 模块、所有 OS 的系统调用接口本质上都是 C++ 的"邻居"。</>} en={<>Every C library is callable, no glue required. This is why every "native module" in Python / Node / Ruby — and every OS syscall interface — is essentially C++'s next-door neighbor.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">old.cpp</span><span className="lang-tag js"><L zh="C++98" en="C++98" /></span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 老式 C++98 - 手动管理一切" en="// Old-school C++98 — manual everything" /></span>{'\n'}
                  <span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt;* <span className="cl-v">v</span> = <span className="cl-k">new</span> <span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt;();{'\n'}
                  <span className="cl-k">for</span> (<span className="cl-type">std::vector</span>&lt;<span className="cl-type">int</span>&gt;::<span className="cl-type">iterator</span> <span className="cl-v">it</span>{'\n'}
                  {'    '}= <span className="cl-v">v</span>-&gt;<span className="cl-fn">begin</span>(); <span className="cl-v">it</span> != <span className="cl-v">v</span>-&gt;<span className="cl-fn">end</span>(); ++<span className="cl-v">it</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-fn">std::cout</span> &lt;&lt; *<span className="cl-v">it</span> &lt;&lt; <span className="cl-s">" "</span>;{'\n'}
                  {'}'}{'\n'}
                  <span className="cl-k">delete</span> <span className="cl-v">v</span>; <span className="cl-c">{'// 忘了 = leak'}</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">modern.cpp</span><span className="lang-tag ts"><L zh="C++20" en="C++20" /></span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 现代 C++ - 几乎像 Python" en="// Modern C++ — feels almost Pythonic" /></span>{'\n'}
                  <span className="cl-k">auto</span> <span className="cl-v">v</span> = <span className="cl-type">std::vector</span>{'{ '}<span className="cl-n">3</span>, <span className="cl-n">1</span>, <span className="cl-n">4</span>, <span className="cl-n">1</span>, <span className="cl-n">5</span>{' };'}{'\n'}
                  <span className="cl-fn">std::ranges::sort</span>(<span className="cl-v">v</span>);{'\n\n'}
                  <span className="cl-k">for</span> (<span className="cl-k">auto</span> <span className="cl-v">x</span> : <span className="cl-v">v</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-fn">std::print</span>(<span className="cl-s">{`"{} "`}</span>, <span className="cl-v">x</span>);{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c">{'// RAII 自动清理'}</span>{'\n'}
                  <span className="cl-c">{'// 没有 new / delete'}</span>
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
                zh={<>从 Bell Labs 一个博士生想给 C 加上 Simula 类系统的念头，到 46 年后撑起大半个软件世界——C++ 不是一蹴而就的，它是 ISO 委员会几十年慢工细活磨出来的。</>}
                en={<>From a Bell Labs PhD student wanting Simula's class system in C, to holding up most of the software world 46 years later — C++ wasn't built overnight. It's the slow, deliberate work of an ISO committee decade after decade.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: TheCoreEight</code></h2>
              <p className="sec-desc"><L
                zh={<>C++ 的语言面非常宽——能写两本 1500 页的书都讲不完。但 80% 的现代代码用得到的，就是下面这八件套。掌握它们，你就能读懂 PyTorch / Chrome / Unreal 的源码大部分。</>}
                en={<>The C++ surface is huge — two 1,500-page books can't cover it. But 80% of modern code uses just these eight primitives. Master them and you can read most of PyTorch / Chrome / Unreal source.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {CPP_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="constexpr / concepts" en="constexpr / concepts" /></h3>
                <p><L
                  zh={<>第八件：<strong>编译期计算 + 概念约束</strong>。<code>constexpr</code> 把斐波那契算到编译期，<code>concept</code> 让模板报错从 30 行天书变一行白话。C++20 之后这两条改变了"模板 = 玄学"的旧印象。</>}
                  en={<>The eighth: <strong>compile-time computation + concept constraints</strong>. <code>constexpr</code> evaluates Fibonacci at compile time; <code>concept</code> turns 30-line template errors into one-line plain English. Since C++20, these two killed the "templates = black magic" reputation.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>给一个语言加上类型计算能力——它就不再只是语言，是一套元语言工具。</>}
                  en={<>Give a language type-level computation, and it stops being a language — it becomes a meta-language toolkit.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why C++" /> <code>: WhyCpp</code></h2>
              <p className="sec-desc"><L
                zh={<>不是所有项目都该用 C++。但当你需要"性能即正义"——操作系统、浏览器、AI 内核、游戏物理、高频交易——它仍然是不可替代的。</>}
                en={<>Not every project should use C++. But when "performance is justice" — OS kernels, browsers, AI cores, game physics, HFT — it remains irreplaceable.</>}
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
                zh={<>每天打开浏览器、跑 PyTorch 训练、玩 Unreal 游戏、在 Photoshop 修图——背后<strong>真正算的</strong>都是 C++。下面 12 个项目撑起了全球软件性能下限。</>}
                en={<>Every browser tab, every PyTorch run, every Unreal game session, every Photoshop edit — what's <strong>actually computing</strong> is C++. The 12 projects below set the global floor on software performance.</>}
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

          {/* 06 AI Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="AI 时代的" en="C++ in the" /> <code>: <L zh="C++" en="AI Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>2020 年代有个有趣的悖论：人们说 AI 会让"低级语言过时"。结果反过来了——AI 越火，对底层性能榨取就越凶，C++ 越被需要。这一章讲为什么 PyTorch / TensorFlow / JAX 表面是 Python，<strong>骨头里全是 C++</strong>。</>}
                en={<>The 2020s gave us a delicious paradox: people said AI would obsolete "low-level languages". The reverse happened — the hotter AI gets, the harder the bottom is squeezed for performance, the more C++ is needed. This chapter is why PyTorch / TensorFlow / JAX <em>look like</em> Python but <strong>are bone-deep C++</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>很多人以为高级语言越多 C++ 就越没人用——其实<strong>正相反</strong>。Python / JS / Julia 越火，它们对底层 native 库的依赖就越深。PyTorch、TensorFlow、NumPy、V8、Node、Chrome——所有这些"高级抽象"的真实算力都来自 C++。我们不是在让位，我们是在<strong>变成基础设施</strong>。</>}
                en={<>People think the more high-level languages there are, the less C++ is used — actually <strong>the opposite is true</strong>. The hotter Python / JS / Julia get, the deeper their dependence on native libraries. PyTorch, TensorFlow, NumPy, V8, Node, Chrome — the real compute behind all these "high-level abstractions" is C++. We're not retreating, we're <strong>becoming infrastructure</strong>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Bjarne Stroustrup</span>
                <span className="quote-context"><L zh="C++ 之父 · CppCon 2024 主题演讲" en="Creator of C++ · CppCon 2024 keynote" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">100<small>%</small></div>
                <div className="ai-stat-h"><L zh="PyTorch 张量内核" en="of PyTorch tensor kernels" /></div>
                <p><L
                  zh={<>你在 Jupyter 里写 <code>torch.matmul</code>，python 一行；下面 <code>torch._C</code> 直接进 <strong>libtorch.so</strong>，是 C++ 编出来的动态库；再往下是 CUDA kernel——还是 C++ 风格的语法。<strong>整条路径上 Python 只占 1%</strong>。</>}
                  en={<>You type <code>torch.matmul</code> in Jupyter — one Python line. Underneath, <code>torch._C</code> hops straight into <strong>libtorch.so</strong>, a C++-compiled shared object. One layer below, CUDA kernels — still C++-flavored syntax. <strong>Python is barely 1% of the call path</strong>.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">5B<small>+</small></div>
                <div className="ai-stat-h"><L zh="行存量 C++ 代码" en="lines of legacy C++ code" /></div>
                <p><L
                  zh={<>Chrome ~32M 行、Unreal Engine ~2M 行、Office ~50M 行、Photoshop ~15M 行——加起来全球至少<strong>50 亿行</strong>的 C++ 在 production。任何"换语言"的提议都要面对这个数字。</>}
                  en={<>Chrome ~32M lines, Unreal Engine ~2M, Office ~50M, Photoshop ~15M — at least <strong>5 billion lines</strong> of C++ in production worldwide. Any "switch the language" proposal has to confront that number first.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">3<small></small></div>
                <div className="ai-stat-h"><L zh="TIOBE 长期 Top 3" en="long-term TIOBE Top 3" /></div>
                <p><L
                  zh={<>2025 TIOBE：Python · C++ · C 三强争霸，Java 跌出前三。GitHub 数据：C++ 仓库年增量稳定头部，<strong>新项目占比反而比 2010 年代更高</strong>。看似"老语言"，实则一直在长。</>}
                  en={<>TIOBE 2025: Python · C++ · C take the top three; Java drops out. GitHub data: C++ repo growth holds in the leaderboard; <strong>the new-project share is actually higher than in the 2010s</strong>. Looks like a "legacy language", actually still growing.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>PyTorch <span className="spotlight-meta">— <L zh="Meta · 90% AI 研究的事实标准" en="Meta · de-facto standard for 90% of AI research" /></span></h3>
                  <p><L
                    zh={<>外界以为 PyTorch 是 Python 库——错。PyTorch 真正的本体是 <strong>libtorch</strong>，约 <strong>200 万行 C++ + CUDA</strong>。Python 这一层只是给研究员用的 wrapper，就像汽车的方向盘——好用，但不是发动机。</>}
                    en={<>People think PyTorch is a Python library — wrong. PyTorch's actual body is <strong>libtorch</strong>, roughly <strong>2M lines of C++ + CUDA</strong>. The Python layer is the steering wheel for researchers — convenient, but not the engine.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>ATen</strong> — <L zh="张量算子库 · 纯 C++ template" en="Tensor op library — pure C++ templates" /></li>
                    <li><strong>c10</strong> — <L zh="核心数据结构 (Tensor / Storage / Device)" en="Core data structures (Tensor / Storage / Device)" /></li>
                    <li><strong>CUDA kernels</strong> — <L zh="GPU 计算 · C++ 子集 + nvcc" en="GPU compute — C++ subset + nvcc" /></li>
                    <li><strong>JIT (TorchScript)</strong> — <L zh="C++ 写的 IR + 编译器" en="C++-written IR + compiler" /></li>
                  </ul>
                  <p><L
                    zh={<>ChatGPT 训练那 700 多块 H100、Sora 渲染那帧帧画面、每个跑在你笔记本上的 LLaMA fine-tune——本质都是<strong>这堆 C++ 代码在跑</strong>。</>}
                    en={<>The 700+ H100s training ChatGPT, every frame Sora renders, every LLaMA fine-tune on your laptop — at the bottom, <strong>this C++ code is running</strong>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// PyTorch C++ 内核大致长这样" en="// PyTorch's C++ core, roughly" /></span>{'\n'}
                    <span className="cl-k">template</span> &lt;<span className="cl-k">typename</span> <span className="cl-type">scalar_t</span>&gt;{'\n'}
                    <span className="cl-k">void</span> <span className="cl-fn">matmul_cuda_kernel</span>({'\n'}
                    {'  '}<span className="cl-k">const</span> <span className="cl-type">scalar_t</span>* <span className="cl-v">A</span>,{'\n'}
                    {'  '}<span className="cl-k">const</span> <span className="cl-type">scalar_t</span>* <span className="cl-v">B</span>,{'\n'}
                    {'  '}<span className="cl-type">scalar_t</span>* <span className="cl-v">C</span>,{'\n'}
                    {'  '}<span className="cl-k">int</span> <span className="cl-v">M</span>, <span className="cl-k">int</span> <span className="cl-v">N</span>, <span className="cl-k">int</span> <span className="cl-v">K</span>) {'{'}{'\n'}
                    {'  '}<span className="cl-c">{'// CUDA threads compute one tile'}</span>{'\n'}
                    {'  '}<span className="cl-c">{'// using shared memory + tensor cores'}</span>{'\n'}
                    {'  '}<span className="cl-c">{'// ...'}</span>{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// Python 看到的 torch.matmul" en="// What Python's torch.matmul" /></span>{'\n'}
                    <span className="cl-c"><L zh="// 最终调到的是这个 kernel" en="// actually dispatches to" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="AI 基础设施 · 几乎全是 C++" en="AI infrastructure · almost all C++" /></h3>
              <div className="ai-tools-grid">
                {AI_TOOLS.map((t, i) => (
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
                <h3><L zh="高级语言越多 ↔ C++ 越被需要" en="More high-level langs ↔ more C++ needed" /></h3>
                <p><L
                  zh={<>2010 年代 Python / Ruby / JS 起飞时，圈外人猜 C++ 会被淘汰。结果<strong>恰恰相反</strong>：每一门高级语言都需要"靠 C++ 写的 native 后端"才能跑得快。</>}
                  en={<>When Python / Ruby / JS took off in the 2010s, outsiders guessed C++ would die. <strong>The reverse happened</strong>: every high-level language needed a "C++-written native backend" to run fast.</>}
                /></p>
                <p><L
                  zh={<>Python 的 NumPy / Pandas / SciPy 全是 C / C++ 内核；Node 的 V8 是 C++ 写的；Ruby 的 YJIT 是 C 写的；Julia 的 LLVM JIT 是 C++ 写的；JavaScript 的 React Native 在原生端是 C++/Java/Swift——<strong>每一层"快"的来源都是 C++</strong>。</>}
                  en={<>Python's NumPy / Pandas / SciPy — C / C++ kernels. Node's V8 — C++. Ruby's YJIT — C. Julia's LLVM JIT — C++. React Native's bridge — C++/Java/Swift. <strong>Every layer of "fast" is C++</strong>.</>}
                /></p>
                <p><L
                  zh={<>所以 Stroustrup 的回应一直很平静：<em>"我们不是和 Rust / Python 竞争，我们是它们的<strong>底盘</strong>。" </em>——AI 大爆炸只让这个底盘更厚。</>}
                  en={<>So Stroustrup's response has always been calm: <em>"We're not competing with Rust / Python — we're their <strong>chassis</strong>." </em>The AI boom only thickens that chassis.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 你写的 Python:" en="// What you write in Python:" /></span>{'\n'}
                  <span className="cl-v">model</span> = <span className="cl-fn">torch</span>.<span className="cl-fn">nn</span>.<span className="cl-fn">Linear</span>(<span className="cl-n">512</span>, <span className="cl-n">10</span>){'\n'}
                  <span className="cl-v">y</span> = <span className="cl-fn">model</span>(<span className="cl-v">x</span>){'\n\n'}
                  <span className="cl-c"><L zh="// 实际跑的:" en="// What actually runs:" /></span>{'\n'}
                  <span className="cl-c">{'// torch.nn.Linear → torch._C →'}</span>{'\n'}
                  <span className="cl-c">{'// libtorch.so::Linear::forward (C++)'}</span>{'\n'}
                  <span className="cl-c">{'//   → ATen::mm (C++ template)'}</span>{'\n'}
                  <span className="cl-c">{'//     → cuBLAS::gemm (CUDA / C++)'}</span>{'\n'}
                  <span className="cl-c">{'//       → tensor cores (硅片)'}</span>{'\n\n'}
                  <span className="cl-c"><L zh="// Python 占 1 行;" en="// Python: 1 line." /></span>{'\n'}
                  <span className="cl-c"><L zh="// C++ + CUDA 占其它一切。" en="// C++ + CUDA: everything else." /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="用一句话总结：" en="Summary, one line: " /></strong><L
                zh={<>AI 不会让 C++ 退场，AI 让 C++ 成为<strong>更深的基础设施</strong>。Python 这个"操作面板"越大，下面的"C++ 引擎"就越关键。Stroustrup 的祖训"零开销抽象"——在 GPU 单核每飞秒都要算的时代，比 1979 年还要值钱。</>}
                en={<>AI doesn't retire C++ — AI turns C++ into <strong>deeper infrastructure</strong>. The bigger Python's dashboard, the more critical the C++ engine below. Stroustrup's creed of "zero-overhead abstraction" — in an era where every femtosecond of GPU time is counted — is worth more than it was in 1979.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Rust / C" /> <code>: ThreeWayCompare</code></h2>
              <p className="sec-desc"><L
                zh={<>三门同台竞技的系统编程语言。Rust 用编译期阻止你犯错，C 让你自己负责，C++ 给你"安全工具但不强制"。各有各的领地。</>}
                en={<>Three systems languages on the same field. Rust stops you at compile time; C makes you fully accountable; C++ gives you safety tools but doesn't enforce them. Each owns its territory.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js"><L zh="C" en="C" /></th>
                  <th className="th-ts"><L zh="C++" en="C++" /></th>
                  <th className="th-rust">Rust</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="诞生年" en="Year" />,                     c: '1972',                                        cpp: '1979',                                       rs: '2010' },
                  { k: <L zh="内存安全" en="Memory safety" />,             c: <L zh="无, 全靠开发者" en="None, on the dev" />, cpp: <L zh="RAII + smart ptr 大幅降低" en="RAII + smart ptr cuts most" />, rs: <L zh="编译期 borrow checker" en="Compile-time borrow checker" /> },
                  { k: <L zh="抽象能力" en="Abstraction" />,               c: <L zh="结构体 + 指针" en="Structs + pointers" />,   cpp: <L zh="OOP + 模板 + lambda + concept" en="OOP + templates + lambda + concept" />, rs: <L zh="trait + 泛型 + 枚举" en="traits + generics + enums" /> },
                  { k: <L zh="编译期计算" en="Compile-time eval" />,       c: <L zh="宏 (脏)" en="Macros (ugly)" />,           cpp: <code>constexpr / consteval</code>,             rs: <L zh="const fn (有限)" en="const fn (limited)" /> },
                  { k: <L zh="泛型" en="Generics" />,                     c: <L zh="无 (宏勉强模拟)" en="None (macros barely)" />, cpp: <L zh="模板 (Turing 完备)" en="Templates (Turing-complete)" />, rs: <L zh="trait 约束泛型" en="Trait-bounded generics" /> },
                  { k: <L zh="生态体量" en="Ecosystem" />,                 c: <L zh="50 年, 系统级" en="50 yrs, systems" />,   cpp: <L zh="40 年, 全栈巨" en="40 yrs, full-stack giant" />, rs: <L zh="15 年, 增长快" en="15 yrs, growing fast" /> },
                  { k: <L zh="编译速度" en="Compile speed" />,             c: <L zh="非常快" en="Very fast" />,                cpp: <L zh="慢 (模板/头文件)" en="Slow (templates/headers)" />, rs: <L zh="慢 (trait 检查)" en="Slow (trait checks)" /> },
                  { k: <L zh="运行性能" en="Runtime perf" />,             c: <L zh="裸机" en="Bare metal" />,                  cpp: <L zh="裸机 (零开销抽象)" en="Bare metal (zero-overhead)" />, rs: <L zh="裸机 (与 C/C++ 持平)" en="Bare metal (on par with C/C++)" /> },
                  { k: <L zh="并发模型" en="Concurrency" />,               c: <L zh="pthread" en="pthread" />,                  cpp: <code>std::thread / std::execution</code>,       rs: <L zh="async/await + Send/Sync" en="async/await + Send/Sync" /> },
                  { k: <L zh="主战场" en="Home turf" />,                   c: <L zh="OS 内核 / 嵌入式" en="OS kernels / embedded" />, cpp: <L zh="AI / 游戏 / 浏览器 / HFT" en="AI / games / browsers / HFT" />, rs: <L zh="新系统软件 / 加密 / Web 后端" en="New systems / crypto / web backends" /> },
                  { k: <L zh="存量代码" en="Legacy LOC" />,                c: <L zh="数百亿行" en="Tens of billions of lines" />, cpp: <L zh="50 亿行+" en="5B+ lines" />,                  rs: <L zh="数千万行 (新, 正在涨)" en="Tens of millions, growing" /> },
                  { k: <L zh="学习曲线" en="Learning curve" />,            c: <L zh="语法小, 陷阱多" en="Small grammar, many traps" />, cpp: <L zh="特性多, 风格分裂" en="Sprawling features, factional styles" />, rs: <L zh="borrow checker 高墙" en="Steep borrow-checker wall" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.c}</td>
                    <td>{row.cpp}</td>
                    <td>{row.rs}</td>
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
                zh={<>2024 年白宫一句"用更安全的语言"让外界以为 C++ 要退场。但 ISO 委员会同年加速推 Profiles，AI 又把它推到了基础设施的更深处——C++ 的下一个十年比想象中忙。</>}
                en={<>The 2024 White House nudge "use safer languages" made outsiders think C++ was exiting. But the ISO committee accelerated Profiles that same year, and AI pushed C++ deeper into infrastructure — the next decade is busier than it looks.</>}
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
                <li><a href="https://isocpp.org" target="_blank" rel="noopener">isocpp.org</a></li>
                <li><a href="https://en.cppreference.com" target="_blank" rel="noopener">cppreference.com</a></li>
                <li><a href="https://www.stroustrup.com" target="_blank" rel="noopener">Stroustrup's site</a></li>
                <li><a href="https://www.open-std.org/jtc1/sc22/wg21/" target="_blank" rel="noopener">WG21 (ISO 委员会 / committee)</a></li>
                <li><a href="https://godbolt.org" target="_blank" rel="noopener"><L zh="Compiler Explorer" en="Compiler Explorer" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="编译器" en="Compilers" /></h4>
              <ul>
                <li><a href="https://gcc.gnu.org" target="_blank" rel="noopener">GCC</a></li>
                <li><a href="https://clang.llvm.org" target="_blank" rel="noopener">Clang / LLVM</a></li>
                <li><a href="https://visualstudio.microsoft.com/vs/features/cplusplus/" target="_blank" rel="noopener">MSVC</a></li>
                <li><a href="https://cmake.org" target="_blank" rel="noopener">CMake</a></li>
                <li><a href="https://vcpkg.io" target="_blank" rel="noopener">vcpkg</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://www.stroustrup.com/P3466R0_safety.pdf" target="_blank" rel="noopener">Stroustrup · Safety Profiles</a></li>
                <li><a href="https://www.whitehouse.gov/oncd/briefing-room/2024/02/26/press-release-technical-report/" target="_blank" rel="noopener">White House · Memory Safety 2024</a></li>
                <li><a href="https://herbsutter.com" target="_blank" rel="noopener">Herb Sutter blog</a></li>
                <li><a href="https://www.amazon.com/dp/0321714113" target="_blank" rel="noopener">The C++ Programming Language</a></li>
                <li><a href="https://www.amazon.com/Effective-Modern-Specific-Ways-Improve/dp/1491903996" target="_blank" rel="noopener">Effective Modern C++</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 库" en="Ecosystem" /></h4>
              <ul>
                <li><a href="https://www.boost.org" target="_blank" rel="noopener">Boost</a></li>
                <li><a href="https://eigen.tuxfamily.org" target="_blank" rel="noopener">Eigen</a></li>
                <li><a href="https://opencv.org" target="_blank" rel="noopener">OpenCV</a></li>
                <li><a href="https://www.qt.io" target="_blank" rel="noopener">Qt</a></li>
                <li><a href="https://github.com/google/googletest" target="_blank" rel="noopener">GoogleTest</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{CPP_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`constexpr auto future = make_unique<Performance>();`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
