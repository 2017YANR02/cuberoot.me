import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './c_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const C_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <rect width="256" height="256" rx="28" fill="#03579B" />
    <path
      fill="#A8B9CC"
      d="M128 36c-22 0-43 9-58 25-15 15-22 36-22 67s7 52 22 67c15 16 36 25 58 25 30 0 55-13 70-37l-26-15c-9 14-25 22-44 22-14 0-26-5-36-15-9-9-14-23-14-47s5-38 14-47c10-10 22-15 36-15 19 0 35 8 44 22l26-15c-15-24-40-37-70-37z"
    />
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
    year: '1966',
    zh: { title: <>BCPL — 起点</>, desc: <>英国剑桥的 Martin Richards 设计 BCPL，"基础组合编程语言"。结构简单、无类型，主要用于写编译器和系统工具。它是 C 的祖父。</> },
    en: { title: <>BCPL — the origin</>, desc: <>Cambridge's Martin Richards designs BCPL, the "Basic Combined Programming Language." Simple, typeless, mostly used to write compilers and systems tools. C's grandfather.</> },
  },
  {
    year: '1969',
    zh: { title: <>B 诞生于 Bell Labs</>, desc: <>Ken Thompson 把 BCPL 砍简后写出 B，用在 PDP-7 上的 Unix 早期实现。仍然无类型，所有变量都是机器字。</> },
    en: { title: <>B at Bell Labs</>, desc: <>Ken Thompson trims BCPL down to B for the early PDP-7 Unix. Still typeless — every variable is a machine word.</> },
  },
  {
    year: '1971',
    zh: { title: <>NB —— "新 B"</>, desc: <>Dennis Ritchie 为了用上 PDP-11 的字节寻址，给 B 加 <code>char</code> 类型，称作 NB（New B）。这是第一次"类型"概念进入这条语言血脉。</> },
    en: { title: <>NB — "New B"</>, desc: <>Dennis Ritchie adds a <code>char</code> type to B so it can use the PDP-11's byte addressing, calling it NB (New B). The first time "types" enter this lineage.</> },
  },
  {
    year: <>1972</>, highlight: true,
    zh: { title: <>C 在 Bell Labs 诞生</>, desc: <>Ritchie 给 NB 加上指针、数组、结构体，重写编译器，把语言改名 <strong>C</strong>。这一年 C 在 PDP-11 上完成自举。"最具创造性的时期"——Ritchie 自己说的。</> },
    en: { title: <>C is born at Bell Labs</>, desc: <>Ritchie adds pointers, arrays, and structs to NB, rewrites the compiler, renames it <strong>C</strong>. C bootstraps itself on the PDP-11. "The most creative period," in Ritchie's own words.</> },
  },
  {
    year: '1973',
    zh: { title: <>Unix 内核用 C 重写</>, desc: <>Thompson 和 Ritchie 把 Unix V4 的内核从汇编 + B 改写成 C。一个操作系统第一次用<strong>高级语言</strong>实现——这件事的历史影响怎么估都不过分。</> },
    en: { title: <>Unix kernel rewritten in C</>, desc: <>Thompson and Ritchie rewrite the Unix V4 kernel from assembly + B into C. The first time an OS is implemented in a <strong>high-level language</strong> — you cannot overestimate this moment.</> },
  },
  {
    year: '1978',
    zh: { title: <>K&R 第一版书</>, desc: <>Brian Kernighan + Dennis Ritchie 出版 <em>The C Programming Language</em>。封面那本薄薄的白皮书定义了"K&R C"——在标准化之前的事实标准。<code>hello, world</code> 也是从这本书出来的。</> },
    en: { title: <>K&R first edition</>, desc: <>Brian Kernighan + Dennis Ritchie publish <em>The C Programming Language</em>. That thin white book defines "K&R C" — the de-facto standard before formal standardization. <code>hello, world</code> traces back to this book.</> },
  },
  {
    year: '1983',
    zh: { title: <>ANSI X3J11 委员会成立</>, desc: <>美国国家标准协会启动 X3J11 委员会，历时 6 年把 K&R C 标准化。同年 Bjarne Stroustrup 在 Bell Labs 完成 "C with Classes" — 即将改名 C++。</> },
    en: { title: <>ANSI X3J11 starts</>, desc: <>The American National Standards Institute starts X3J11, a six-year effort to formalize K&R C. The same year Bjarne Stroustrup wraps up "C with Classes" at Bell Labs — soon to be renamed C++.</> },
  },
  {
    year: '1987',
    zh: { title: <>GCC 1.0 — 自由软件的引擎</>, desc: <>3 月 22 日，Richard Stallman 发布 GNU C Compiler 第一版。从此 C 不再被某家公司绑定，整个开源运动有了能自我编译的工具链——Linux 五年后由此长出。</> },
    en: { title: <>GCC 1.0 — engine of free software</>, desc: <>March 22nd: Richard Stallman releases the first GNU C Compiler. C is no longer tied to any single vendor; the whole open-source movement now has a self-hosting toolchain. Linux grows out of this five years later.</> },
  },
  {
    year: '1989/90',
    zh: { title: <>ANSI C / C89 / C90</>, desc: <>1989 年 ANSI 通过 X3.159-1989；1990 年 ISO 几乎照搬定为 ISO/IEC 9899:1990。从此 C 有了第一个国际标准——直到今天，"会写 C89"还是大多数嵌入式岗位的要求。</> },
    en: { title: <>ANSI C / C89 / C90</>, desc: <>ANSI ratifies X3.159-1989 in 1989; ISO adopts it almost verbatim as ISO/IEC 9899:1990. C now has its first international standard. To this day "I can write C89" is still a job requirement for most embedded jobs.</> },
  },
  {
    year: '1991',
    zh: { title: <>Linus 用 C 写 Linux</>, desc: <>赫尔辛基大学的 Linus Torvalds 在芬兰发出那封"我在做一个免费操作系统（只是 hobby，不会很大很专业）"的邮件。语言选择：C。三十多年后，<strong>3300 万行 C</strong>在你身边的每一台 Android 手机、每一台云服务器里跑着。</> },
    en: { title: <>Linus writes Linux in C</>, desc: <>Linus Torvalds at the University of Helsinki posts that "I'm doing a free operating system (just a hobby, won't be big and professional)" mail. Language choice: C. Three decades later, <strong>33 million lines of C</strong> run inside every Android phone and every cloud VM near you.</> },
  },
  {
    year: '1999',
    zh: { title: <>C99 — 现代化第一步</>, desc: <>ISO/IEC 9899:1999。引入 <code>//</code> 单行注释、<code>inline</code> 函数、变长数组（VLA）、复合字面量、<code>long long</code>、<code>&lt;stdint.h&gt;</code>、designated initializers。今天写 C 的人几乎全活在 C99 之上。</> },
    en: { title: <>C99 — the modern leap</>, desc: <>ISO/IEC 9899:1999. <code>//</code> line comments, <code>inline</code> functions, variable-length arrays, compound literals, <code>long long</code>, <code>&lt;stdint.h&gt;</code>, designated initializers. Almost everyone writing C today lives on or above C99.</> },
  },
  {
    year: '2007',
    zh: { title: <>Clang / LLVM 登场</>, desc: <>苹果资助 Chris Lattner 的 LLVM 项目，Clang 作为 C / C++ / Objective-C 前端开源发布。模块化、错误信息友好、构建快——动摇了 GCC 二十年的垄断。今天 macOS 系统编译器、iOS / Xcode、Tesla 自动驾驶 C 代码，都走 Clang。</> },
    en: { title: <>Clang / LLVM arrives</>, desc: <>Apple funds Chris Lattner's LLVM project; Clang ships open-source as a C / C++ / Objective-C frontend. Modular, friendly diagnostics, fast builds — it shakes GCC's twenty-year monopoly. Today macOS, iOS / Xcode, and Tesla's autonomy stack all compile through Clang.</> },
  },
  {
    year: '2011',
    zh: { title: <>C11 — 抓追赶</>, desc: <>ISO/IEC 9899:2011（12 月 8 日发布）。<code>_Atomic</code>、线程支持（<code>&lt;threads.h&gt;</code>）、<code>_Generic</code>、匿名结构 / 联合、<code>_Static_assert</code>。多核时代终于在标准里有了名分。</> },
    en: { title: <>C11 — catching up</>, desc: <>ISO/IEC 9899:2011 (December 8th). <code>_Atomic</code>, threads (<code>&lt;threads.h&gt;</code>), <code>_Generic</code>, anonymous structs/unions, <code>_Static_assert</code>. The multi-core era finally has a place in the standard.</> },
  },
  {
    year: '2018',
    zh: { title: <>C17 — 修订维护版</>, desc: <>ISO/IEC 9899:2018。无新特性，只修 C11 的缺陷报告。社区俗称"C17"，编译器 <code>-std=c17</code> 即此。它的存在主要是为了让 C20 / C23 起步时有个干净的基线。</> },
    en: { title: <>C17 — maintenance release</>, desc: <>ISO/IEC 9899:2018. No new features, only defect-report fixes against C11. Known as "C17"; <code>-std=c17</code> targets it. Mostly there to give C20 / C23 a clean baseline to build on.</> },
  },
  {
    year: <>2024<small>·02</small></>, highlight: true,
    zh: { title: <>C23 — 53 年后还在前进</>, desc: <>ISO/IEC 9899:2024，2 月 22 日发布。引入 <code>nullptr</code>、<code>true</code>/<code>false</code> 关键字、<code>typeof</code>、<code>auto</code>（C++ 风格类型推断）、二进制字面量 <code>0b</code>、属性 <code>[[nodiscard]]</code>、UTF-8 字符串。一门 53 岁的语言，仍然在认真演化。</> },
    en: { title: <>C23 — still moving at 53</>, desc: <>ISO/IEC 9899:2024, published February 22nd. Brings <code>nullptr</code>, real <code>true</code>/<code>false</code> keywords, <code>typeof</code>, <code>auto</code> (C++-style type inference), binary literals <code>0b</code>, attributes like <code>[[nodiscard]]</code>, UTF-8 strings. A 53-year-old language still evolving in earnest.</> },
  },
  {
    year: '2026', highlight: true,
    zh: { title: <>看不见的母语</>, desc: <>TIOBE 2026：C 在第 #1~#2 之间徘徊（与 Python 互换）；Linux 内核 <strong>3300 万行 C</strong>；GPU 驱动、CUDA runtime、cuDNN、Python C 扩展、PostgreSQL / Redis / SQLite / Nginx——AI 模型每跑一次 forward 都至少经过这一打 C 写的库。<strong>看不见，但永远在那里。</strong></> },
    en: { title: <>The invisible mother tongue</>, desc: <>TIOBE 2026: C trades #1 / #2 with Python every other month; Linux kernel <strong>33M lines of C</strong>; GPU drivers, CUDA runtime, cuDNN, every Python C-extension, PostgreSQL / Redis / SQLite / Nginx — every AI model forward pass goes through this stack of C libraries. <strong>Invisible, but always there.</strong></> },
  },
];

interface CCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const C_CARDS: CCard[] = [
  {
    tag: 'A',
    zh: { title: <>指针</>, desc: <>变量是<strong>地址</strong>。一切从这里开始：链表、树、回调、引用、运行时多态、内存共享 —— 没有指针的高级语言能做的事，C 都用指针做。</> },
    en: { title: <>Pointers</>, desc: <>A variable is an <strong>address</strong>. Everything starts here: linked lists, trees, callbacks, references, runtime polymorphism, shared memory — anything other languages give you implicitly, C does explicitly with pointers.</> },
    code: (
      <code>
        <span className="cl-type">int</span> <span className="cl-v">x</span> = <span className="cl-n">42</span>;{'\n'}
        <span className="cl-type">int</span> *<span className="cl-v">p</span> = &amp;<span className="cl-v">x</span>;{'\n'}
        <span className="cl-c">// p 指向 x 的地址</span>{'\n\n'}
        *<span className="cl-v">p</span> = <span className="cl-n">100</span>;{'\n'}
        <span className="cl-c">// 通过指针写入 → x 现在是 100</span>{'\n\n'}
        <span className="cl-fn">printf</span>(<span className="cl-s">"%d\n"</span>, <span className="cl-v">x</span>);
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>数组 ≈ 指针</>, desc: <>数组名衰减为指向首元素的指针。<code>a[i]</code> 和 <code>*(a + i)</code> 严格等价 —— 这是 C 最迷人也最折磨初学者的设计之一。</> },
    en: { title: <>Arrays ≈ pointers</>, desc: <>An array name decays to a pointer to its first element. <code>a[i]</code> and <code>*(a + i)</code> are strictly equivalent — one of C's most elegant and most punishing design decisions.</> },
    code: (
      <code>
        <span className="cl-type">int</span> <span className="cl-v">a</span>[<span className="cl-n">5</span>] = {'{'}<span className="cl-n">10</span>, <span className="cl-n">20</span>, <span className="cl-n">30</span>, <span className="cl-n">40</span>, <span className="cl-n">50</span>{'};'}{'\n\n'}
        <span className="cl-v">a</span>[<span className="cl-n">2</span>]      <span className="cl-c">// 30</span>{'\n'}
        *(<span className="cl-v">a</span> + <span className="cl-n">2</span>)  <span className="cl-c">// 30 — 同义</span>{'\n'}
        <span className="cl-n">2</span>[<span className="cl-v">a</span>]      <span className="cl-c">// 30 — 也合法 (!)</span>{'\n\n'}
        <span className="cl-c">// sizeof(a) = 20 (5*4)</span>{'\n'}
        <span className="cl-c">// 但传入函数后退化为指针</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>结构体</>, desc: <><code>struct</code> 是 C 唯一的"复合类型"。它没有方法、没有继承——但 Linux 内核就靠 struct + 函数指针表达"面向对象"。</> },
    en: { title: <>Structs</>, desc: <><code>struct</code> is C's only composite type. No methods, no inheritance — yet the Linux kernel models "object orientation" with structs full of function pointers.</> },
    code: (
      <code>
        <span className="cl-k">struct</span> <span className="cl-type">Point</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">double</span> <span className="cl-prop">x</span>, <span className="cl-prop">y</span>;{'\n'}
        {'};'}{'\n\n'}
        <span className="cl-k">struct</span> <span className="cl-type">Point</span> <span className="cl-v">p</span> = {'{ '}<span className="cl-n">3.0</span>, <span className="cl-n">4.0</span> {'};'}{'\n'}
        <span className="cl-c">// C99 designated initializer:</span>{'\n'}
        <span className="cl-k">struct</span> <span className="cl-type">Point</span> <span className="cl-v">q</span> = {'{ .'}<span className="cl-prop">x</span> = <span className="cl-n">1</span>, .<span className="cl-prop">y</span> = <span className="cl-n">2</span> {'};'}{'\n\n'}
        <span className="cl-fn">printf</span>(<span className="cl-s">"%g\n"</span>, <span className="cl-v">p</span>.<span className="cl-prop">x</span>);
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>函数指针</>, desc: <>函数也是地址。把它存进变量、传给别人、丢进数组——这就是 C 表达"回调 / 策略 / 虚函数表"的方式。signal handler、qsort、Linux file_operations 都靠它。</> },
    en: { title: <>Function pointers</>, desc: <>Functions are addresses too. Store them, pass them, table them — this is how C expresses "callbacks / strategies / vtables." signal handlers, qsort, the Linux file_operations table all rest on this.</> },
    code: (
      <code>
        <span className="cl-type">int</span> <span className="cl-fn">add</span>(<span className="cl-type">int</span> <span className="cl-v">a</span>, <span className="cl-type">int</span> <span className="cl-v">b</span>) {'{ '}<span className="cl-k">return</span> <span className="cl-v">a</span>+<span className="cl-v">b</span>; {'}'}{'\n\n'}
        <span className="cl-type">int</span> (*<span className="cl-v">op</span>)(<span className="cl-type">int</span>, <span className="cl-type">int</span>) = <span className="cl-fn">add</span>;{'\n'}
        <span className="cl-fn">op</span>(<span className="cl-n">2</span>, <span className="cl-n">3</span>);  <span className="cl-c">// → 5</span>{'\n\n'}
        <span className="cl-c">// qsort 接受比较函数指针</span>{'\n'}
        <span className="cl-fn">qsort</span>(<span className="cl-v">arr</span>, <span className="cl-v">n</span>, <span className="cl-k">sizeof</span>(<span className="cl-type">int</span>), <span className="cl-fn">cmp</span>);
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>预处理宏</>, desc: <>编译之前，文本被 <code>cpp</code> 先扫一遍：<code>#include</code> 把头文件原样贴进来，<code>#define</code> 字面替换。这是 C 的"元编程"——粗暴但极其灵活。</> },
    en: { title: <>The preprocessor</>, desc: <>Before compilation, <code>cpp</code> walks the text: <code>#include</code> pastes a header verbatim, <code>#define</code> performs literal substitution. C's "metaprogramming" — crude but extraordinarily flexible.</> },
    code: (
      <code>
        <span className="cl-pre">#define</span> <span className="cl-type">MAX</span>(<span className="cl-v">a</span>,<span className="cl-v">b</span>) ((<span className="cl-v">a</span>) &gt; (<span className="cl-v">b</span>) ? (<span className="cl-v">a</span>) : (<span className="cl-v">b</span>)){'\n\n'}
        <span className="cl-fn">MAX</span>(<span className="cl-n">3</span>, <span className="cl-n">7</span>)        <span className="cl-c">// → 7</span>{'\n'}
        <span className="cl-fn">MAX</span>(<span className="cl-v">x</span>++, <span className="cl-v">y</span>++)    <span className="cl-c">// 双重副作用 ⚠</span>{'\n\n'}
        <span className="cl-pre">#ifdef</span> <span className="cl-type">__linux__</span>{'\n'}
        {'  '}<span className="cl-c">// 仅 Linux 编译</span>{'\n'}
        <span className="cl-pre">#endif</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>动态内存</>, desc: <><code>malloc</code> 要、<code>free</code> 还。C 不替你管 —— 自由也带<strong>责任</strong>：忘还 = 内存泄漏，还重了 = double free，还了又用 = use-after-free。这套 trinity 是无数 CVE 的源头。</> },
    en: { title: <>Manual memory</>, desc: <><code>malloc</code> takes, <code>free</code> returns. C does not babysit — freedom plus <strong>responsibility</strong>. Forget to free → leak; free twice → double-free; use after free → UAF. This trinity is the source of countless CVEs.</> },
    code: (
      <code>
        <span className="cl-type">int</span> *<span className="cl-v">arr</span> = <span className="cl-fn">malloc</span>(<span className="cl-n">100</span> * <span className="cl-k">sizeof</span>(<span className="cl-type">int</span>));{'\n'}
        <span className="cl-k">if</span> (!<span className="cl-v">arr</span>) <span className="cl-k">return</span> <span className="cl-type">ENOMEM</span>;{'\n\n'}
        <span className="cl-c">// ... 用 arr ...</span>{'\n\n'}
        <span className="cl-fn">free</span>(<span className="cl-v">arr</span>);{'\n'}
        <span className="cl-v">arr</span> = <span className="cl-k">NULL</span>;  <span className="cl-c">// 防 UAF 的好习惯</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>链接 · extern · static</>, desc: <>每个 <code>.c</code> 单独编译成 <code>.o</code>，链接器用名字把符号拼起来。<code>extern</code> = "在别处定义"；<code>static</code> = "本文件私有"。这套五十年没变的契约让 C 至今能给所有语言当 ABI。</> },
    en: { title: <>Linking · extern · static</>, desc: <>Each <code>.c</code> compiles to its own <code>.o</code>; the linker stitches symbols together by name. <code>extern</code> = "defined elsewhere"; <code>static</code> = "private to this file." This 50-year-old contract is why C is still the universal ABI for every other language.</> },
    code: (
      <code>
        <span className="cl-c">// math.c</span>{'\n'}
        <span className="cl-type">double</span> <span className="cl-fn">G</span> = <span className="cl-n">9.8</span>;{'\n'}
        <span className="cl-k">static</span> <span className="cl-type">int</span> <span className="cl-fn">helper</span>(<span className="cl-v">x</span>) {'{ ... }'}{'\n\n'}
        <span className="cl-c">// main.c</span>{'\n'}
        <span className="cl-k">extern</span> <span className="cl-type">double</span> <span className="cl-v">G</span>;{'\n'}
        <span className="cl-c">// helper 在这里看不见</span>
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
    icon: '⚡',
    zh: { title: <>跑得快，永远地快</>, desc: <>没有运行时、没有 GC、没有虚拟机。一行 C 代码翻译出来的机器码就是你能想象到的最少指令。性能上限就是 CPU 本身。</> },
    en: { title: <>Fast, always fast</>, desc: <>No runtime, no GC, no VM. A line of C compiles to roughly the minimum machine instructions you can imagine. The ceiling is the CPU itself.</> },
    code: <><span className="cl-c">// gcc -O3 main.c</span>{'\n'}<span className="cl-c">// → 直接出汇编，零开销</span></>,
  },
  {
    icon: '◎',
    zh: { title: <>抽象成本几乎为零</>, desc: <>C 的抽象（函数、结构体、指针）在汇编层面几乎没有"额外开销"。Bjarne 那句"零开销原则"其实是从 C 这里继承到 C++ 的。</> },
    en: { title: <>Zero-cost abstraction, literally</>, desc: <>C's abstractions — functions, structs, pointers — cost essentially nothing at the assembly level. Bjarne's "zero-overhead principle" was inherited from C.</> },
    code: <><span className="cl-c">{'// struct Point { double x, y; };'}</span>{'\n'}<span className="cl-c">// 内存布局 = 16 字节, 对齐到 8</span>{'\n'}<span className="cl-c">// 没有 vtable, 没有 header</span></>,
  },
  {
    icon: '⛓',
    zh: { title: <>跨平台 ABI</>, desc: <>C 的函数调用约定是<strong>所有语言的</strong>互操作语言。Python 调 NumPy、Rust 调系统 API、Go 用 cgo、Node 写 native module —— 中间都站着 C ABI。</> },
    en: { title: <>The universal ABI</>, desc: <>C's calling convention is the lingua franca every language uses to talk to every other language. Python ↔ NumPy, Rust ↔ system APIs, Go's cgo, Node native modules — all sit on top of the C ABI.</> },
    code: <><span className="cl-c">// extern "C" — 用来对接</span>{'\n'}<span className="cl-c">// Rust / C++ / Swift / Zig</span>{'\n'}<span className="cl-c">// 都得发出 C 兼容符号</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>底层就是它的舞台</>, desc: <>OS 内核、设备驱动、文件系统、bootloader、microcontroller、DSP、电源管理芯片——能直接操作内存、寄存器、中断的语言不多，C 是工业标准的那一个。</> },
    en: { title: <>Made for the metal</>, desc: <>Kernels, device drivers, filesystems, bootloaders, microcontrollers, DSPs, power management chips — few languages let you touch memory, registers, and interrupts directly. C is the industrial standard.</> },
    code: <><span className="cl-c">// volatile uint32_t *GPIO_OUT</span>{'\n'}<span className="cl-c">//   = (uint32_t*)0x4002'0014;</span>{'\n'}<span className="cl-c">// *GPIO_OUT |= 1 &lt;&lt; 5;  // LED 亮</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>编译器无所不在</>, desc: <>从 8 位单片机到超算，每一颗能跑代码的芯片几乎都有 C 编译器。GCC + Clang 两套自由工具链支持上百种架构 —— 没有第二门语言能做到。</> },
    en: { title: <>Compilers everywhere</>, desc: <>From 8-bit MCUs to supercomputers, virtually every chip that runs code has a C compiler. GCC + Clang together cover hundreds of architectures — no other language comes close.</> },
    code: <><span className="cl-c">// avr-gcc, arm-none-eabi-gcc</span>{'\n'}<span className="cl-c">// riscv64-gcc, xtensa-gcc...</span>{'\n'}<span className="cl-c">// 你说出芯片名, 它有 C 编译器</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>语言极小，可全装在脑子里</>, desc: <>K&R 那本书 272 页讲完整门语言。32 个关键字、几十个标准库函数。学 C 不是学语法，是学"机器是怎么想的"——这一课迟早要补。</> },
    en: { title: <>Small enough to fit in your head</>, desc: <>K&R covers the entire language in 272 pages. 32 keywords, a few dozen standard-library functions. Learning C isn't learning syntax — it's learning how the machine thinks. A lesson nobody in our craft can really skip.</> },
    code: <><span className="cl-c">// 32 keywords total:</span>{'\n'}<span className="cl-c">// auto break case char const ...</span>{'\n'}<span className="cl-c">// while (没了)</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>Undefined Behavior 的代价与自由</>, desc: <>越界访问、空指针解引用、有符号溢出 —— C 标准都说成 "undefined behavior"。这给编译器极大优化空间，也给程序员极大尾部风险。这是这门语言<strong>最锋利的边</strong>。</> },
    en: { title: <>The blade of Undefined Behavior</>, desc: <>Out-of-bounds access, null deref, signed overflow — all "undefined behavior" per the standard. This gives compilers room to optimize aggressively and gives programmers astonishing tail risk. C's <strong>sharpest edge</strong>.</> },
    code: <><span className="cl-c">// int x = INT_MAX + 1; // UB</span>{'\n'}<span className="cl-c">// 编译器假设永远不发生</span>{'\n'}<span className="cl-c">// 然后基于此优化, 出 bug 时</span>{'\n'}<span className="cl-c">// 行为完全不可预测</span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>53 年没断的代码遗产</>, desc: <>1973 写的 Unix 工具，今天 <code>gcc -std=c89</code> 还能编。Linux v0.01（1991）用现在的 GCC 还能跑起来。这种向后兼容是<strong>整个软件文明的地基</strong>。</> },
    en: { title: <>53 years of unbroken legacy</>, desc: <>Unix tools written in 1973 still compile today under <code>gcc -std=c89</code>. Linux v0.01 (1991) still boots under modern GCC. This kind of backward compatibility is <strong>foundational to software civilization</strong>.</> },
    code: <><span className="cl-c">// gcc -std=c89 1973_unix_tool.c</span>{'\n'}<span className="cl-c">// → 跑得好好的</span></>,
  },
  {
    icon: '⌁',
    zh: { title: <>AI 算力栈的最底层</>, desc: <>NVIDIA 驱动 / cuBLAS / cuDNN / NCCL / TensorRT / FFmpeg / OpenBLAS / MKL —— GPU 上的<strong>每一次矩阵乘法</strong>，最终经过的都是 C/C++ 写的 kernel 调用。Python 只是上面的薄壳。</> },
    en: { title: <>The bottom of the AI stack</>, desc: <>NVIDIA driver / cuBLAS / cuDNN / NCCL / TensorRT / FFmpeg / OpenBLAS / MKL — <strong>every matrix multiply</strong> on a GPU eventually flows through kernels written in C / C++. Python is the thin glue on top.</> },
    code: <><span className="cl-c">// torch.matmul(a, b)</span>{'\n'}<span className="cl-c">//   ↓ Python C API</span>{'\n'}<span className="cl-c">//   ↓ libtorch (C++)</span>{'\n'}<span className="cl-c">//   ↓ cuBLAS (C)</span>{'\n'}<span className="cl-c">//   ↓ CUDA driver (C/asm)</span></>,
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
    href: 'https://kernel.org', highlight: true,
    zhName: 'Linux Kernel', enName: 'Linux Kernel',
    zhNote: '3300 万行 C · Linus 1991', enNote: '33M lines of C · Linus 1991',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="55" r="35" fill="#000"/><ellipse cx="42" cy="48" rx="6" ry="9" fill="#fff"/><ellipse cx="58" cy="48" rx="6" ry="9" fill="#fff"/><circle cx="42" cy="50" r="3" fill="#000"/><circle cx="58" cy="50" r="3" fill="#000"/><path d="M40 25 Q50 12 60 25 L55 30 Q50 22 45 30 Z" fill="#FCC624"/><path d="M40 70 Q50 78 60 70" stroke="#FCC624" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://www.postgresql.org', highlight: true,
    zhName: 'PostgreSQL', enName: 'PostgreSQL',
    zhNote: '1.4M 行 C · 关系型数据库黄金标准', enNote: '1.4M lines of C · gold-standard RDBMS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><ellipse cx="50" cy="50" rx="40" ry="38" fill="#336791"/><path d="M30 35 Q50 20 70 35 Q72 60 60 75 Q50 80 40 75 Q28 60 30 35 Z" fill="none" stroke="#fff" strokeWidth="2.5"/><circle cx="42" cy="44" r="3" fill="#fff"/><circle cx="58" cy="44" r="3" fill="#fff"/><path d="M40 60 Q50 68 60 60" stroke="#fff" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://redis.io', highlight: true,
    zhName: 'Redis', enName: 'Redis',
    zhNote: '内存数据库 · ~200K 行 C', enNote: 'In-memory store · ~200K lines C',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M15 35 L50 18 L85 35 L85 65 L50 82 L15 65 Z" fill="#DC382D"/><path d="M15 35 L50 52 L85 35" stroke="#fff" strokeWidth="2" fill="none"/><path d="M15 50 L50 67 L85 50" stroke="#fff" strokeWidth="2" fill="none" opacity=".7"/></svg>,
  },
  {
    href: 'https://www.sqlite.org',
    zhName: 'SQLite', enName: 'SQLite',
    zhNote: '~150K 行 C · 跑在地球上每一台设备', enNote: '~150K lines C · on every device on Earth',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M20 28 L70 28 Q80 28 80 38 L80 78 Q80 88 70 88 L20 88 Q10 88 10 78 L10 38 Q10 28 20 28 Z" fill="#003B57"/><path d="M28 42 Q40 38 55 42 Q70 47 75 60 Q60 55 45 60 Q30 65 28 42 Z" fill="#fff"/><circle cx="35" cy="50" r="2" fill="#003B57"/></svg>,
  },
  {
    href: 'https://www.python.org', highlight: true,
    zhName: 'CPython', enName: 'CPython',
    zhNote: 'Python 官方实现 · ~600K 行 C', enNote: 'Official Python · ~600K lines C',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 Q35 12 30 22 L30 38 L52 38 L52 42 L22 42 Q12 42 12 56 L12 68 Q12 78 22 78 L32 78 L32 65 Q32 58 40 58 L62 58 Q72 58 72 48 L72 22 Q72 12 50 12 Z" fill="#3776AB"/><path d="M50 88 Q65 88 70 78 L70 62 L48 62 L48 58 L78 58 Q88 58 88 44 L88 32 Q88 22 78 22 L68 22 L68 35 Q68 42 60 42 L38 42 Q28 42 28 52 L28 78 Q28 88 50 88 Z" fill="#FFD43B"/><circle cx="40" cy="22" r="3" fill="#fff"/><circle cx="60" cy="78" r="3" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.ffmpeg.org', highlight: true,
    zhName: 'FFmpeg', enName: 'FFmpeg',
    zhNote: '视频解码 · ~1M 行 C · AI 训练流水线必备', enNote: 'Video codec · ~1M lines C · AI training pipeline staple',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="8" y="20" width="84" height="60" rx="4" fill="#5cb85c"/><path d="M30 35 L30 65 L60 50 Z" fill="#fff"/><circle cx="78" cy="35" r="4" fill="#fff"/></svg>,
  },
  {
    href: 'https://nginx.org',
    zhName: 'Nginx', enName: 'Nginx',
    zhNote: '~150K 行 C · 半个互联网的 Web 入口', enNote: '~150K lines C · half the internet\'s edge',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 8 L88 30 L88 70 L50 92 L12 70 L12 30 Z" fill="#009639"/><path d="M30 32 L30 68 L36 68 L36 44 L62 68 L70 68 L70 32 L64 32 L64 56 L38 32 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://git-scm.com',
    zhName: 'Git', enName: 'Git',
    zhNote: '~250K 行 C · Linus 2005 用 C 写的 VCS', enNote: '~250K lines C · Linus\' VCS, 2005',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 10 L90 50 L50 90 L10 50 Z" fill="#F05032"/><circle cx="32" cy="50" r="6" fill="#fff"/><circle cx="50" cy="32" r="6" fill="#fff"/><circle cx="68" cy="50" r="6" fill="#fff"/><path d="M32 50 L50 32 L68 50 L50 68 Z" stroke="#fff" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://developer.nvidia.com/cuda-toolkit', highlight: true,
    zhName: 'CUDA', enName: 'CUDA',
    zhNote: 'GPU 计算栈 · driver/runtime/cuBLAS/cuDNN', enNote: 'GPU stack · driver/runtime/cuBLAS/cuDNN',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M30 18 L70 18 L82 50 L70 82 L30 82 L18 50 Z" fill="#76B900"/><path d="M40 35 L60 35 L65 50 L60 65 L40 65 L35 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.openbsd.org',
    zhName: 'OpenBSD / FreeBSD', enName: 'OpenBSD / FreeBSD',
    zhNote: 'BSD Unix 全家 · 纯 C', enNote: 'BSD Unix family · pure C',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#AB2B28"/><path d="M30 30 Q50 18 70 30 Q72 50 60 65 Q50 70 40 65 Q28 50 30 30 Z" fill="#fff"/><circle cx="42" cy="40" r="3" fill="#000"/><circle cx="58" cy="40" r="3" fill="#000"/><path d="M40 55 Q50 60 60 55" stroke="#000" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://www.gnu.org/software/gcc/',
    zhName: 'GCC', enName: 'GCC',
    zhNote: '~15M 行 · C 自身的编译器', enNote: '~15M lines · C\'s own compiler',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#A42E2B"/><text x="50" y="62" textAnchor="middle" fontSize="32" fontWeight="700" fontFamily="monospace" fill="#fff">GCC</text></svg>,
  },
  {
    href: 'https://www.lua.org',
    zhName: 'Lua / PHP / Ruby', enName: 'Lua / PHP / Ruby',
    zhNote: '解释器全是 C 实现', enNote: 'Interpreters all implemented in C',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="42" fill="#000080"/><circle cx="50" cy="50" r="28" fill="#fff"/><circle cx="65" cy="35" r="6" fill="#000080"/><text x="50" y="58" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="monospace" fill="#000080">Lua</text></svg>,
  },
];

interface CTool { name: string; zhDesc: string; enDesc: string }
const C_TOOLS: CTool[] = [
  { name: 'GCC',           zhDesc: 'GNU 编译器 · 跨百种架构', enDesc: 'GNU Compiler · 100+ archs' },
  { name: 'Clang / LLVM',  zhDesc: 'Apple/LLVM 系编译器', enDesc: 'Apple/LLVM compiler' },
  { name: 'MSVC',          zhDesc: '微软 Visual C 编译器', enDesc: 'Microsoft Visual C' },
  { name: 'TCC',           zhDesc: '小型快速 C 编译器', enDesc: 'Tiny C Compiler · fast' },
  { name: 'GDB',           zhDesc: 'GNU 调试器 · C 源调试事实标准', enDesc: 'GNU debugger · de-facto C debugger' },
  { name: 'LLDB',          zhDesc: 'LLVM 系调试器 · macOS 默认', enDesc: 'LLVM debugger · macOS default' },
  { name: 'Valgrind',      zhDesc: '内存错误 / 泄漏检测', enDesc: 'Memory error / leak detection' },
  { name: 'AddressSanitizer', zhDesc: 'Clang/GCC -fsanitize=address', enDesc: 'Clang/GCC -fsanitize=address' },
  { name: 'Make',          zhDesc: '1976 Unix 经典 build 工具', enDesc: 'Classic 1976 Unix build tool' },
  { name: 'CMake',         zhDesc: '跨平台构建系统生成器', enDesc: 'Cross-platform build generator' },
  { name: 'Meson / Ninja', zhDesc: '现代快速构建系统', enDesc: 'Modern fast build systems' },
  { name: 'cppcheck',      zhDesc: '静态分析 · C/C++', enDesc: 'Static analyzer · C/C++' },
  { name: 'clang-format',  zhDesc: '官方代码格式化', enDesc: 'Official formatter' },
  { name: 'clang-tidy',    zhDesc: 'lint + 现代化重写', enDesc: 'Linter + modernization' },
  { name: 'glibc / musl',  zhDesc: 'C 标准库的两大实现', enDesc: 'Two major C stdlib implementations' },
  { name: 'compiler-rt',   zhDesc: 'LLVM 运行时支持库', enDesc: 'LLVM runtime support library' },
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
    tag: <>2024-02 · ISO/IEC 9899:2024</>, hot: true, big: true,
    zh: {
      title: <>C23 — 53 年的一门语言还在长进</>,
      body: (<>
        <p>53 年，一门语言能保持每 5~10 年一次主版本演化已是奇迹。C23 不只是修修补补：<code>nullptr</code>、<code>true</code>/<code>false</code> 终于成关键字、<code>typeof</code> 变为标准、<code>auto</code> 拿去做类型推断、二进制字面量 <code>0b1010</code>、<code>[[nodiscard]]</code> 属性、UTF-8 字符串字面量。</p>
        <p>更重要的是态度：标准委员会还在严肃地把 C 往现代化推。这与"C 已死"的论调差出一个时代。GCC 14 / Clang 18+ 已经支持大部分 C23。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">C99 (1999)</span><span className="bar-val">~25 年前</span></div>
          <div className="bar bar-new"><span className="bar-label">C23 (2024)</span><span className="bar-val">at age 53</span></div>
        </div>
      </>),
    },
    en: {
      title: <>C23 — still growing at 53</>,
      body: (<>
        <p>For a language to land a major revision every 5-10 years across 53 years is itself a miracle. C23 is not just patches: <code>nullptr</code>, real <code>true</code>/<code>false</code> keywords, standardized <code>typeof</code>, <code>auto</code> repurposed for type inference, binary literals <code>0b1010</code>, <code>[[nodiscard]]</code> attributes, UTF-8 string literals.</p>
        <p>What matters more is the attitude: the committee is still seriously modernizing C. That cuts against every "C is dead" take. GCC 14 / Clang 18+ already implement most of C23.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">C99 (1999)</span><span className="bar-val">~25 yrs ago</span></div>
          <div className="bar bar-new"><span className="bar-label">C23 (2024)</span><span className="bar-val">at age 53</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'KERNEL',
    zh: { title: <>Linux 仍是 C 的，但 Rust 在敲门</>, body: <><p>Linux 6.1（2022-12）首次接受 Rust 模块。到 2025 末 Rust 部分约 60 万行——<strong>Rust 占比仍 &lt; 2%</strong>。Linus 立场："C 仍然是 Linux 的语言。我们只是允许新的驱动用 Rust 写。"</p><p>意味着：未来 10~20 年内核里，C 仍是绝对主导。</p></> },
    en: { title: <>Linux is still C — Rust knocking</>, body: <><p>Linux 6.1 (Dec 2022) accepted Rust modules. By late 2025 the Rust portion is ~600K lines — still <strong>under 2%</strong>. Linus' stance: "C remains the language of Linux. We're just letting new drivers be written in Rust."</p><p>Translation: for the next 10-20 years inside the kernel, C is still dominant.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 推理栈底层全是 C/C++</>, body: <><p>NVIDIA driver、CUDA runtime、cuBLAS、cuDNN、NCCL、TensorRT —— 加上 OpenBLAS、MKL、FFmpeg —— 整个 GPU 计算栈往下挖三层就是 C。</p><p><strong>结论</strong>：每跑一次 GPT、每生成一帧视频、每播一段 YouTube，最终走过的都是几代 C 程序员留下的代码。</p></> },
    en: { title: <>AI inference's bottom is all C/C++</>, body: <><p>NVIDIA driver, CUDA runtime, cuBLAS, cuDNN, NCCL, TensorRT — plus OpenBLAS, MKL, FFmpeg — three layers down the GPU stack and you are firmly in C.</p><p><strong>So</strong>: every GPT call, every generated video frame, every YouTube playback ultimately runs through code left by generations of C programmers.</p></> },
  },
  {
    tag: 'EMBEDDED',
    zh: { title: <>嵌入式 / IoT — C 的私有领地</>, body: <><p>从 8051 / AVR / STM32 / ESP32 到汽车 ECU、火箭飞控、心脏起搏器 —— 凡是"芯片直接跑代码、没操作系统或只有 RTOS"的场合，C 至今 95%+ 占比。Rust 在这里在追，但工具链 / 认证 / 厂商 SDK 还是 C 一统天下。</p></> },
    en: { title: <>Embedded / IoT — C's private kingdom</>, body: <><p>8051 / AVR / STM32 / ESP32, automotive ECUs, rocket flight controllers, pacemakers — anywhere "chip runs code directly, no OS or just an RTOS" — C still owns 95%+. Rust is chasing, but toolchains / certifications / vendor SDKs still all default to C.</p></> },
  },
  {
    tag: 'DATA',
    zh: { title: <>TIOBE: #1 / #2 拉锯</>, body: <><p>2024-2025：Python 与 C 在 TIOBE 第一二名间反复换位。这是一门 53 岁的语言能拿到的<strong>最佳排名</strong>。</p><p>意味着：C 没在变冷门，它只是太基础以至于"还在那里跑"被忽略。</p></> },
    en: { title: <>TIOBE: trading #1 / #2</>, body: <><p>2024-2025: Python and C swap the top two slots repeatedly on TIOBE. For a 53-year-old language this is roughly the <strong>best chart you can ask for</strong>.</p><p>Read it correctly: C isn't fading — it's so foundational it gets overlooked because "it's just running."</p></> },
  },
  {
    tag: 'AI · 反向',
    zh: { title: <>LLM 写 C 越来越靠谱</>, body: <><p>C 公开代码量极大（Linux + glibc + 数千开源项目），LLM 训练数据足够。再加上 C 标准很稳——给 AI 写"C89/C99 的 driver"比写小众语言准确得多。</p><p>底层 + AI 时代的组合：人类越来越少手写 C，但<strong>AI 帮你写 C</strong> 的能力反而越来越强。</p></> },
    en: { title: <>LLMs writing C, surprisingly well</>, body: <><p>C has a vast public code corpus (Linux + glibc + thousands of OSS projects); LLMs have ample training data. Plus the standard barely moves — asking AI for "a C89/C99 driver" is far more accurate than for niche languages.</p><p>The combination: humans hand-write less and less C, while <strong>AI's ability to write C for you</strong> keeps improving.</p></> },
  },
];

export default function CIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'C : 看不见的母语 — 53 年仍跑在一切之下'
      : 'C : The Invisible Mother Tongue — 53 Years and Still Underneath It All';
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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--c-bright)' : '';
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
      <div ref={rootRef} className="c-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <rect width="256" height="256" rx="28" fill="#03579B" />
              <path fill="#A8B9CC" d="M128 36c-22 0-43 9-58 25-15 15-22 36-22 67s7 52 22 67c15 16 36 25 58 25 30 0 55-13 70-37l-26-15c-9 14-25 22-44 22-14 0-26-5-36-15-9-9-14-23-14-47s5-38 14-47c10-10 22-15 36-15 19 0 35 8 44 22l26-15c-15-24-40-37-70-37z" />
            </svg>
            <span>C</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="精要" en="Core" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs C++ / Rust" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1972 — 2026 · Bell Labs · Dennis Ritchie (1941—2011)</div>
            <h1 className="hero-title">
              <span className="hero-name">C</span>
              <span className="hero-colon">:</span>
              <span className="hero-type"><L zh="看不见的母语" en="invisible mother tongue" /></span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>1972 年 Dennis Ritchie 在 Bell Labs 把 B 改造成 C，给即将到来的 Unix 准备一门"能写 OS 的高级语言"。53 年后，<strong>每一台手机、每一台云服务器、每一颗 GPU、每一次 AI 推理</strong>底下都是它在跑——只是你看不见。</>}
                en={<>In 1972 Dennis Ritchie reshaped B into C at Bell Labs to give the upcoming Unix "a high-level language fit for writing an OS." 53 years later <strong>every phone, every cloud VM, every GPU, every AI inference</strong> still runs on it underneath — you just don't see it.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1972<small></small></span>
                <span className="stat-label"><L zh={<>Bell Labs 诞生<br /><em>53 年至今</em></>} en={<>born at Bell Labs<br /><em>53 years and counting</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">33<small>M</small></span>
                <span className="stat-label"><L zh={<>Linux 内核 C 行数<br /><em>kernel.org · 2025</em></>} en={<>lines of C in Linux<br /><em>kernel.org · 2025</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">#1<small>~2</small></span>
                <span className="stat-label"><L zh={<>TIOBE 长期 #1 / #2<br /><em>与 Python 互换</em></>} en={<>TIOBE long-term #1 / #2<br /><em>swapping with Python</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">100<small>%</small></span>
                <span className="stat-label"><L zh={<>所有 OS 内核都用 C<br /><em>Linux/BSD/XNU/Windows</em></>} en={<>of OS kernels use C<br /><em>Linux/BSD/XNU/Windows</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{C_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">int *p</span>
              <span className="float f2">malloc()</span>
              <span className="float f3">struct</span>
              <span className="float f4">#include</span>
              <span className="float f5">extern</span>
              <span className="float f6">sizeof</span>
              <span className="float f7">void *</span>
              <span className="float f8">char[]</span>
              <span className="float f9">free()</span>
              <span className="float f10">NULL</span>
              <span className="float f11">{'a[i] == *(a+i)'}</span>
              <span className="float f12">0xCAFEBABE</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>C</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>C 是一门<strong>"系统级"</strong>语言：贴近硬件、运行时几乎为零、需要程序员自己管理内存。它不替你想任何复杂事——这恰恰是它能跑在 8 位单片机和超算之间所有缝隙里的原因。</>}
                  en={<>C is a <strong>systems language</strong>: close to the hardware, near-zero runtime, manual memory management. It does not think for you — which is exactly why it fits everywhere between an 8-bit MCU and a supercomputer.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="贴近硬件" en="Close to the metal" />, tag: 'low-level', p: <L zh={<>指针、地址、字节大小、对齐 —— 全部直接暴露。你写的每一行 C 几乎都对应几条机器指令。</>} en={<>Pointers, addresses, byte sizes, alignment — all exposed. Each line of C maps almost one-to-one to machine instructions.</>} /> },
                { h: <L zh="零运行时" en="No runtime" />, tag: 'no-rt', p: <L zh={<>没有 GC、没有 VM、没有反射。一段 C 程序可以小到 4 KB 的固件，也可以撑起整个内核。运行时<strong>看不见</strong>。</>} en={<>No GC, no VM, no reflection. A C program can be a 4 KB firmware blob or a kernel — the runtime is <strong>invisible</strong>.</>} /> },
                { h: <L zh="手动内存管理" en="Manual memory" />, tag: 'malloc/free', p: <L zh={<>谁分配、谁释放。这种自由让性能见顶；这种自由也是大部分 CVE 的源头。Rust 出现就是为了买回这份保险。</>} en={<>You allocate, you free. This freedom buys peak performance — and most of the CVEs in software history. Rust exists to buy that insurance back.</>} /> },
                { h: <L zh="所有语言的 ABI" en="The universal ABI" />, tag: 'extern "C"', p: <L zh={<>Python、Rust、Go、Swift、Zig、Java JNI —— 跨语言调用一律走 C ABI。一门 53 年的"地基语言"。</>} en={<>Python, Rust, Go, Swift, Zig, Java JNI — every cross-language call rides on the C ABI. A 53-year-old foundation language.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">naive.py</span><span className="lang-tag js">Python</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="# 100 万次浮点加法" en="# 1M float additions" /></span>{'\n'}
                  <span className="cl-k">def</span> <span className="cl-fn">sum_array</span>(<span className="cl-v">arr</span>):{'\n'}
                  {'    '}<span className="cl-v">total</span> = <span className="cl-n">0.0</span>{'\n'}
                  {'    '}<span className="cl-k">for</span> <span className="cl-v">x</span> <span className="cl-k">in</span> <span className="cl-v">arr</span>:{'\n'}
                  {'        '}<span className="cl-v">total</span> += <span className="cl-v">x</span>{'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-v">total</span>{'\n\n'}
                  <span className="cl-c"><L zh="# 解释器 + 装箱整数 + 引用计数" en="# interpreter + boxed ints + refcount" /></span>{'\n'}
                  <span className="cl-c">{'# → ~200 ms / 1M elems'}</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">fast.c</span><span className="lang-tag ts">C</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 100 万次浮点加法" en="// 1M float additions" /></span>{'\n'}
                  <span className="cl-type">double</span> <span className="cl-fn">sum_array</span>(<span className="cl-type">double</span> *<span className="cl-v">arr</span>, <span className="cl-type">size_t</span> <span className="cl-v">n</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-type">double</span> <span className="cl-v">total</span> = <span className="cl-n">0</span>;{'\n'}
                  {'  '}<span className="cl-k">for</span> (<span className="cl-type">size_t</span> <span className="cl-v">i</span> = <span className="cl-n">0</span>; <span className="cl-v">i</span> &lt; <span className="cl-v">n</span>; ++<span className="cl-v">i</span>){'\n'}
                  {'    '}<span className="cl-v">total</span> += <span className="cl-v">arr</span>[<span className="cl-v">i</span>];{'\n'}
                  {'  '}<span className="cl-k">return</span> <span className="cl-v">total</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// gcc -O3 自动向量化为 AVX" en="// gcc -O3 auto-vectorizes to AVX" /></span>{'\n'}
                  <span className="cl-c">{'// → ~0.3 ms — 600× faster'}</span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 1966 — 2026</code></h2>
              <p className="sec-desc"><L
                zh={<>从 BCPL 到 B，到 NB，到 C 在 PDP-11 上自举，到 K&R 那本白皮书，到 ANSI 标准，到 Linux，到 C23 —— 一条没断过的链。</>}
                en={<>BCPL → B → NB → C self-hosting on a PDP-11 → the K&R white book → ANSI standardization → Linux → C23. An unbroken chain.</>}
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

          {/* 03 Core 8 */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="语言精要" en="The Core" /> <code>: TheEightThings</code></h2>
              <p className="sec-desc"><L
                zh={<>C 一共只有 32 个关键字，K&R 用 272 页就把它讲完。日常 90% 的代码就是下面这八件套——指针、数组、结构体、函数指针、预处理、动态内存、链接、和那条让人又爱又怕的 undefined behavior。</>}
                en={<>C has just 32 keywords; K&R covers the whole language in 272 pages. 90% of day-to-day code uses the eight primitives below — pointers, arrays, structs, function pointers, the preprocessor, manual memory, linkage, and that beloved-and-feared monster: undefined behavior.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {C_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">⚠</div>
                <h3><L zh="Undefined Behavior" en="Undefined Behavior" /></h3>
                <p><L
                  zh={<>越界访问、有符号溢出、空指针解引用、数据竞争 —— 标准都说"行为未定义"。编译器假设它们永远不发生，按这个前提疯狂优化。</>}
                  en={<>Out-of-bounds reads, signed overflow, null deref, data races — all "undefined" per the standard. Compilers assume they never occur and optimize aggressively on that premise.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>UB 不是 bug，是一种契约。打破契约的代价是宇宙允许的任何事。</>}
                  en={<>UB isn't a bug — it's a contract. Breaking the contract costs anything the universe allows.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要懂 C" en="Why C" /> <code>: WhyC</code></h2>
              <p className="sec-desc"><L
                zh={<>就算你不直接写 C，也得知道 C 是什么——因为你天天写的 Python / JS / Rust / Go，下面跑的都是 C。</>}
                en={<>Even if you don't write C, you should know what C is — because the Python / JS / Rust / Go you write every day all run on top of C.</>}
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
                zh={<>列一下你今天每一次"开机 / 联网 / 看视频 / 用 AI"经过的 C 代码——下面这 12 个项目几乎覆盖了一切。</>}
                en={<>Every "boot / connect / play video / use AI" you do today flows through these 12 projects. Together they cover nearly everything.</>}
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
              <h2 className="sec-title"><L zh="AI 时代下的" en="C in the" /> <code>: <L zh="C" en="AI Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>AI 时代风口上的语言是 Python / TypeScript。但你以为 AI 真在用 Python？不——AI 在用 <strong>C 写的库</strong>，Python 只是壳。这一章讲："看不见的母语"是怎么撑起整个 AI 计算栈的。</>}
                en={<>The languages on the AI hype train are Python and TypeScript. But you think AI runs on Python? It doesn't — AI runs on <strong>libraries written in C</strong>; Python is just glue. This chapter is about how the invisible mother tongue holds up the entire AI compute stack.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>UNIX 哲学是<strong>由 C 表达出来的</strong>——简洁、组合、贴近机器、不替你做决定。这套哲学过去 50 年没变过；它适用于操作系统、适用于编译器、适用于数据库、也适用于<strong>今天 AI 模型在 GPU 上每一次矩阵乘法</strong>。</>}
                en={<>The Unix philosophy is <strong>expressed in C</strong> — be simple, be composable, be close to the machine, don't think for the user. That philosophy hasn't changed in 50 years. It worked for operating systems, for compilers, for databases — and for <strong>every matrix multiply an AI model performs on a GPU today</strong>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Dennis Ritchie (1941—2011)</span>
                <span className="quote-context"><L zh="C 之父 / Unix 联合创造者 / 图灵奖 1983" en="Father of C / Unix co-creator / Turing Award 1983" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">33<small>M</small></div>
                <div className="ai-stat-h"><L zh="Linux 内核 C 代码量" en="Lines of C in the Linux kernel" /></div>
                <p><L
                  zh={<>2025 年的 Linux 主线（kernel.org）约 <strong>3300~4000 万行</strong>，95% 以上是 C。Rust 模块虽然进入 6.1 已三年多，目前仍 &lt; 2%。地球上每台 Android 手机、每台 SteamDeck、几乎每台云 VM 都跑这一坨 C。</>}
                  en={<>Linux mainline (kernel.org) is ~<strong>33-40M lines</strong> as of 2025; over 95% is C. Rust modules have been in since 6.1 (three+ years now), still under 2%. Every Android phone, every SteamDeck, nearly every cloud VM on Earth runs this pile of C.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">100<small>%</small></div>
                <div className="ai-stat-h"><L zh="GPU 计算栈底层全是 C/C++" en="of the GPU stack is C/C++" /></div>
                <p><L
                  zh={<>NVIDIA driver、CUDA runtime、cuBLAS、cuDNN、NCCL、TensorRT —— 没有任何一层是 Python 的。每次 PyTorch 调 <code>matmul</code>，最终都掉进一段几代 C 程序员留下的 kernel。</>}
                  en={<>NVIDIA driver, CUDA runtime, cuBLAS, cuDNN, NCCL, TensorRT — not a single layer is Python. Every PyTorch <code>matmul</code> call eventually drops into a kernel left behind by generations of C programmers.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">#1<small>~2</small></div>
                <div className="ai-stat-h"><L zh="TIOBE 长期 #1 / #2" en="TIOBE long-term #1 / #2" /></div>
                <p><L
                  zh={<>2024-2025 TIOBE：C 与 Python 在第一二名间反复换位。一门 53 岁的语言，<strong>没在退场</strong>——它太基础以至于"还在那里跑"经常被忽略。</>}
                  en={<>2024-2025 TIOBE: C and Python keep trading the top two slots. At 53, this language <strong>isn't leaving</strong> — it's so foundational its presence gets overlooked because "it's just running."</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Linux Kernel <span className="spotlight-meta">— <L zh="GitHub 上最大开源项目之一" en="one of GitHub's largest OSS projects" /></span></h3>
                  <p><L
                    zh={<>Linus Torvalds 1991 在赫尔辛基用 C 起步，今天 <strong>~3300 万行 C</strong>，每年 7~8 万次 commit、上千开发者贡献。它是 Android、ChromeOS、SteamDeck、AWS / GCP / Azure 几乎所有 Linux VM、绝大多数嵌入式设备 —— 你说出名字的几乎所有"运行 Linux 的东西"。</>}
                    en={<>Linus Torvalds started writing it in C from a dorm in Helsinki, 1991. Today <strong>~33M lines of C</strong>, 70-80K commits a year, thousands of contributors. It runs Android, ChromeOS, SteamDeck, almost every Linux VM on AWS / GCP / Azure, and most embedded devices — every "thing that runs Linux" you can name.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>kernel/</strong> — <L zh="调度 / 中断 / 同步原语 · 全 C" en="scheduling / interrupts / sync primitives — all C" /></li>
                    <li><strong>mm/</strong> — <L zh="内存管理 · 全 C" en="memory management — all C" /></li>
                    <li><strong>fs/</strong> — <L zh="文件系统 · ext4 / btrfs / xfs 全 C" en="filesystems — ext4 / btrfs / xfs all C" /></li>
                    <li><strong>drivers/</strong> — <L zh="占内核 60%+ 行数 · 几乎全 C" en="60%+ of kernel LOC — almost entirely C" /></li>
                    <li><strong>rust/</strong> — <L zh="新增 Rust 抽象层 · &lt; 2% · 还在试水" en="new Rust abstractions — under 2%, still experimental" /></li>
                  </ul>
                  <p><L
                    zh={<>换句话说：<strong>你这台设备上的"操作系统"，本质上是一段 53 年没断过的 C 代码</strong>。</>}
                    en={<>In other words: <strong>the "operating system" on your device is essentially 53 years of unbroken C code</strong>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// linux/kernel/sched/core.c — 简化" en="// linux/kernel/sched/core.c — simplified" /></span>{'\n'}
                    <span className="cl-k">struct</span> <span className="cl-type">task_struct</span> {'{'}{'\n'}
                    {'  '}<span className="cl-k">volatile</span> <span className="cl-type">long</span> <span className="cl-prop">state</span>;{'\n'}
                    {'  '}<span className="cl-type">void</span> *<span className="cl-prop">stack</span>;{'\n'}
                    {'  '}<span className="cl-type">unsigned</span> <span className="cl-type">int</span> <span className="cl-prop">cpu</span>;{'\n'}
                    {'  '}<span className="cl-k">struct</span> <span className="cl-type">mm_struct</span> *<span className="cl-prop">mm</span>;{'\n'}
                    {'  '}<span className="cl-k">struct</span> <span className="cl-type">files_struct</span> *<span className="cl-prop">files</span>;{'\n'}
                    {'  '}<span className="cl-c">// ... 数百字段 ...</span>{'\n'}
                    {'};'}{'\n\n'}
                    <span className="cl-k">static</span> <span className="cl-type">void</span> <span className="cl-fn">__schedule</span>(<span className="cl-type">bool</span> <span className="cl-v">preempt</span>) {'{'}{'\n'}
                    {'  '}<span className="cl-k">struct</span> <span className="cl-type">task_struct</span> *<span className="cl-v">prev</span>, *<span className="cl-v">next</span>;{'\n'}
                    {'  '}<span className="cl-c">// 选下一个要跑的任务</span>{'\n'}
                    {'  '}<span className="cl-v">next</span> = <span className="cl-fn">pick_next_task</span>(<span className="cl-v">rq</span>, <span className="cl-v">prev</span>);{'\n'}
                    {'  '}<span className="cl-fn">context_switch</span>(<span className="cl-v">rq</span>, <span className="cl-v">prev</span>, <span className="cl-v">next</span>);{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 这就是你电脑此刻在跑的代码" en="// This is the code your machine is running" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="C 工具链 · 工业级稳定" en="C toolchain · industrial-grade and stable" /></h3>
              <div className="ai-tools-grid">
                {C_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">DEEP</div>
                <h3><L zh="一次 GPU 矩阵乘法的完整路径" en="The full path of one GPU matmul" /></h3>
                <p><L
                  zh={<>Python 写 <code>torch.matmul(a, b)</code>，一行——但底下穿过的层数让人头皮发麻。</>}
                  en={<>You write <code>torch.matmul(a, b)</code> in Python, one line — but the stack underneath is dizzying.</>}
                /></p>
                <p><L
                  zh={<>每一层都是几代 C / C++ 程序员留下的工程。AI 模型每跑一次 forward，就在重走这条几十年累积出来的路径。</>}
                  en={<>Every layer is engineering left by generations of C / C++ programmers. Each AI forward pass re-traces this decades-old path.</>}
                /></p>
                <p><L
                  zh={<>"AI 时代不需要 C" 是个流量话术。事实是：<strong>AI 时代之所以能跑得起来，正因为这底下 53 年的 C 代码够稳</strong>。</>}
                  en={<>"The AI era doesn't need C" makes for a tidy headline. The truth: <strong>the AI era runs at all because the 53 years of C underneath are stable</strong>.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// Python 你看到的:" en="// What Python shows you:" /></span>{'\n'}
                  <span className="cl-v">y</span> = <span className="cl-fn">torch</span>.<span className="cl-fn">matmul</span>(<span className="cl-v">a</span>, <span className="cl-v">b</span>){'\n\n'}
                  <span className="cl-c">{'// ↓ Python C API (C — CPython)'}</span>{'\n'}
                  <span className="cl-c">{'// ↓ libtorch (C++ — pybind11)'}</span>{'\n'}
                  <span className="cl-c">{'// ↓ ATen dispatcher (C++)'}</span>{'\n'}
                  <span className="cl-c">{'// ↓ cuBLAS gemm kernel (C)'}</span>{'\n'}
                  <span className="cl-c">{'// ↓ CUDA driver (C / asm)'}</span>{'\n'}
                  <span className="cl-c">{'// ↓ NVIDIA GPU SM tensor core'}</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 6 层下来, 真正算的那段是 C" en="// 6 layers down, the actual math is C" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 你写的 Python 只是触发器" en="// Your Python is just the trigger" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结：" en="Summary, one line: " /></strong><L
                zh={<>C 不是 AI 时代的过去式，C 是<strong>让 AI 时代成立的基础设施</strong>。每一次 GPT 回答、每一段视频生成、每一颗芯片唤起、每一次内核中断响应——背后都是它在跑。</>}
                en={<>C isn't the AI era's past tense — C is the <strong>infrastructure that lets the AI era exist</strong>. Every GPT response, every video generation, every chip waking up, every kernel interrupt — it's all running on it.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs" /> <code>: C vs C++ vs Rust</code></h2>
              <p className="sec-desc"><L
                zh={<>C 是地基，C++ 是在地基上加抽象，Rust 是把地基重新浇成内存安全。三者面对的是同一类问题——"系统级编程"——但路径完全不同。</>}
                en={<>C is the foundation; C++ piles abstraction on top of that foundation; Rust re-pours the foundation as memory-safe concrete. All three target the same class of problems — systems programming — but they take very different paths.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">C</th>
                  <th className="th-ts">C++</th>
                  <th className="th-ts">Rust</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="诞生年" en="Born" />, c: '1972', cpp: '1985', r: '2010' },
                  { k: <L zh="设计目标" en="Design goal" />, c: <L zh="写 OS" en="Write an OS" />, cpp: <L zh="C + 类 + 模板" en="C + classes + templates" />, r: <L zh="安全 + 系统级" en="Safety + systems" /> },
                  { k: <L zh="内存管理" en="Memory" />, c: <L zh="手动 malloc/free" en="manual malloc/free" />, cpp: <L zh="手动 / RAII / smart ptr" en="manual / RAII / smart ptrs" />, r: <L zh="编译期 borrow checker" en="compile-time borrow checker" /> },
                  { k: <L zh="内存安全" en="Memory safety" />, c: <L zh="无 — 全靠程序员" en="None — programmer's job" />, cpp: <L zh="部分 — 智能指针 / RAII" en="Partial — smart ptrs / RAII" />, r: <L zh="编译期保证" en="Compile-time guaranteed" /> },
                  { k: <L zh="抽象层级" en="Abstraction level" />, c: <L zh="极低 · 32 关键字" en="Very low · 32 keywords" />, cpp: <L zh="高 · OOP + 模板 + concepts" en="High · OOP + templates + concepts" />, r: <L zh="中高 · trait + generics" en="Medium-high · traits + generics" /> },
                  { k: <L zh="编译速度" en="Build speed" />, c: <L zh="极快" en="Very fast" />, cpp: <L zh="慢 · 模板拖累" en="Slow · template bloat" />, r: <L zh="慢 · 借用检查 + LLVM" en="Slow · borrow check + LLVM" /> },
                  { k: <L zh="学习曲线" en="Learning curve" />, c: <L zh="语法易, 用对难" en="Easy syntax, hard to use right" />, cpp: <L zh="陡 · 几十年的特性堆叠" en="Steep · decades of features" />, r: <L zh="陡 · 借用检查初期挫败" en="Steep · borrow checker frustration" /> },
                  { k: <L zh="OS 内核 / 驱动" en="OS kernel / drivers" />, c: <L zh="事实标准" en="De facto standard" />, cpp: <L zh="少 · 内核多禁用" en="Rare · banned in many kernels" />, r: <L zh="Linux 6.1 起接受" en="Linux 6.1+ accepts it" /> },
                  { k: <L zh="嵌入式 / MCU" en="Embedded / MCU" />, c: <L zh="95%+" en="95%+" />, cpp: <L zh="部分 (RTOS / 汽车)" en="Some (RTOS / automotive)" />, r: <L zh="增长中, 还小" en="Growing, still small" /> },
                  { k: <L zh="ABI 通用性" en="ABI universality" />, c: <L zh="所有语言互通的事实标准" en="Lingua franca for all languages" />, cpp: <L zh="差 · name mangling 各异" en="Poor · name mangling varies" />, r: <L zh={<>需 <code>extern "C"</code></>} en={<>Needs <code>extern "C"</code></>} /> },
                  { k: <L zh="主要风险" en="Main risk" />, c: <L zh="UB / 内存错误" en="UB / memory errors" />, cpp: <L zh="C 的风险 + 复杂度爆炸" en="All C risks + complexity blowup" />, r: <L zh="编译器与你斗智斗勇" en="Fighting the compiler" /> },
                  { k: <L zh="2026 现状" en="2026 status" />, c: <L zh="不可替代的地基" en="Irreplaceable foundation" />, cpp: <L zh="游戏 / 浏览器 / 高频交易" en="Games / browsers / HFT" />, r: <L zh="新写系统级时的首选" en="Default for new systems work" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.c}</td>
                    <td>{row.cpp}</td>
                    <td>{row.r}</td>
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
                zh={<>"C 会被 Rust 替代吗？" 短期：不会。中期：在新写的代码里 Rust 会越写越多，但<strong>巨量 C 资产存量在那</strong>，迁移成本极高。一门 53 年的语言不会因为有更好的替代品就消失，它会变成"基础设施"——和钢筋水泥一样基础，一样不被讨论。</>}
                en={<>"Will C be replaced by Rust?" Short term: no. Medium term: more new code will be Rust, but <strong>the gigantic existing C codebase isn't going anywhere</strong>; migration cost is astronomical. A 53-year-old language doesn't vanish because something better appears — it becomes infrastructure, as foundational and as undiscussed as rebar.</>}
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
                <li><a href="https://www.iso.org/standard/82075.html" target="_blank" rel="noopener">ISO/IEC 9899:2024 (C23)</a></li>
                <li><a href="https://www.open-std.org/jtc1/sc22/wg14/" target="_blank" rel="noopener">WG14 — C 标准委员会</a></li>
                <li><a href="https://gcc.gnu.org" target="_blank" rel="noopener">GCC</a></li>
                <li><a href="https://clang.llvm.org" target="_blank" rel="noopener">Clang / LLVM</a></li>
                <li><a href="https://en.cppreference.com/w/c" target="_blank" rel="noopener">cppreference · C</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="经典阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://www.nokia.com/bell-labs/about/dennis-m-ritchie/chist.pdf" target="_blank" rel="noopener">Ritchie · Development of C</a></li>
                <li><a href="https://en.wikipedia.org/wiki/The_C_Programming_Language" target="_blank" rel="noopener">K&R · The C Programming Language</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Dennis_Ritchie" target="_blank" rel="noopener">Dennis Ritchie · Wikipedia</a></li>
                <li><a href="https://en.wikipedia.org/wiki/C_(programming_language)" target="_blank" rel="noopener">C · Wikipedia</a></li>
                <li><a href="https://blog.regehr.org/archives/213" target="_blank" rel="noopener">A Guide to Undefined Behavior</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / Data" /></h4>
              <ul>
                <li><a href="https://www.tiobe.com/tiobe-index/c/" target="_blank" rel="noopener">TIOBE · C</a></li>
                <li><a href="https://www.kernel.org" target="_blank" rel="noopener">kernel.org</a></li>
                <li><a href="https://www.postgresql.org" target="_blank" rel="noopener">PostgreSQL</a></li>
                <li><a href="https://redis.io" target="_blank" rel="noopener">Redis</a></li>
                <li><a href="https://sqlite.org" target="_blank" rel="noopener">SQLite</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="AI 计算栈" en="AI Compute Stack" /></h4>
              <ul>
                <li><a href="https://developer.nvidia.com/cuda-toolkit" target="_blank" rel="noopener">CUDA Toolkit</a></li>
                <li><a href="https://developer.nvidia.com/cudnn" target="_blank" rel="noopener">cuDNN</a></li>
                <li><a href="https://developer.nvidia.com/cublas" target="_blank" rel="noopener">cuBLAS</a></li>
                <li><a href="https://www.openblas.net" target="_blank" rel="noopener">OpenBLAS</a></li>
                <li><a href="https://ffmpeg.org" target="_blank" rel="noopener">FFmpeg</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{C_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`int main(void) { return 0; }`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
