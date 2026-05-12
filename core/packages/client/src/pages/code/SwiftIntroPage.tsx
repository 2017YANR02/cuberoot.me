import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './swift_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const SWIFT_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="swift-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F88A36" />
        <stop offset="100%" stopColor="#F05138" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="56" fill="url(#swift-grad)" />
    <path
      fill="#fff"
      d="M188 188c-22 13-52 14-82 1-24-10-44-29-56-46 6 5 14 10 22 14 32 18 64 17 86 5-32-25-59-58-79-86 4 4 8 7 13 11 19 15 49 34 60 40-22-23-41-52-40-51 35 35 67 55 67 55 1 1 1 2 2 3 1-2 1-5 2-7 3-22-3-46-19-65 36 22 58 63 49 99-1 4-1 7-2 10 3 4 6 9 8 14 16 22 12 46 10 41-8-19-23-13-23-13z"
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
    year: '2010',
    zh: { title: <>Chris Lattner 苹果内部立项</>, desc: <>LLVM 与 Clang 的总设计师 <strong>Chris Lattner</strong> 在苹果内部启动一个保密项目：替代被诟病已久的 Objective-C。第一年只有他一个人写，团队半年后才扩展到几人。</> },
    en: { title: <>Chris Lattner kicks off inside Apple</>, desc: <>LLVM/Clang architect <strong>Chris Lattner</strong> begins a secret project at Apple: a replacement for the long-criticised Objective-C. He writes alone for the first year; the team grows to a handful only six months in.</> },
  },
  {
    year: <>2014<small>·06</small></>,
    zh: { title: <>WWDC 公开发布 Swift 1.0</>, desc: <>6 月 2 日，WWDC keynote 上苹果突然公布 Swift。从内部立项到公开整整四年，外界毫无消息。同期发布了 Playgrounds 互动环境，号称"<strong>Objective-C without the C</strong>"。</> },
    en: { title: <>WWDC public unveiling — Swift 1.0</>, desc: <>June 2nd. Apple drops Swift on the WWDC keynote stage with zero prior leaks — four years of secrecy, broken in one demo. Playgrounds ship the same day. The pitch: <strong>"Objective-C without the C."</strong></> },
  },
  {
    year: <>2015<small>·12</small></>,
    zh: { title: <>开源 + 跨平台</>, desc: <>12 月 3 日，Swift 在 swift.org 开源（Apache 2.0），同时发布 Linux 版编译器。这是苹果第一次让自己的核心语言走出 Apple 生态——Swift 从此不再只属于 macOS / iOS。</> },
    en: { title: <>Open-sourced + Linux port</>, desc: <>December 3rd. Swift goes open source on swift.org under Apache 2.0, with a Linux toolchain on day one. The first time Apple let one of its core languages out of the Apple-platform sandbox.</> },
  },
  {
    year: <>2017<small>·01</small></>,
    zh: { title: <>Lattner 离开苹果 → Tesla</>, desc: <>1 月 10 日，Lattner 宣布离开苹果加入 Tesla 任 Autopilot 副总裁，半年后又离职。Swift 进入"创始人离去 + 委员会治理"阶段，由 Ted Kremenek 接任语言项目负责人。</> },
    en: { title: <>Lattner leaves Apple for Tesla</>, desc: <>January 10th. Lattner announces his move to Tesla as VP of Autopilot — and resigns six months later. Swift enters its "founder gone + committee governance" era, with Ted Kremenek leading the language.</> },
  },
  {
    year: <>2019<small>·03</small></>,
    zh: { title: <>5.0 — ABI 稳定</>, desc: <>3 月 25 日。Swift 5.0 把<strong>应用二进制接口</strong>稳定下来。从此 Swift 标准库可以打包进 macOS / iOS 系统镜像，App 不再需要每个都带一份 runtime——单 App 包减小 5MB+，启动速度也涨。</> },
    en: { title: <>5.0 — ABI stability</>, desc: <>March 25th. Swift 5.0 stabilises the <strong>application binary interface</strong>. The standard library can now ship as part of macOS / iOS — apps no longer bundle their own runtime. Per-app size drops 5MB+, launch speeds up.</> },
  },
  {
    year: <>2019<small>·06</small></>,
    zh: { title: <>SwiftUI 横空出世</>, desc: <>WWDC 19。基于<strong>结果构建器（result builders）</strong>的声明式 UI 框架登场，一夜把"全宇宙都用 storyboard 拖控件"的 UIKit 时代翻篇。SwiftUI 是 Swift 语言级别功能（不是普通库）的第一次大规模秀肌肉。</> },
    en: { title: <>SwiftUI debuts</>, desc: <>WWDC 19. A declarative UI framework built atop <strong>result builders</strong> ships overnight, ending the era of UIKit's storyboard-and-drag UI. SwiftUI is the first time a Swift <em>language feature</em> (not a library) was the headliner.</> },
  },
  {
    year: <>2021<small>·09</small></>,
    zh: { title: <>5.5 — async / await + actors</>, desc: <>9 月 20 日。Swift 5.5 把<strong>并发模型</strong>整体落地：<code>async</code> / <code>await</code>、<code>Task</code>、<code>actor</code> 关键字、结构化并发——一次性补齐这一层。actor 直接在语言层面提供"不会跨线程数据竞争"的承诺。</> },
    en: { title: <>5.5 — async/await + actors</>, desc: <>September 20th. Swift 5.5 lands an entire <strong>concurrency model</strong> at once: <code>async</code> / <code>await</code>, <code>Task</code>, the <code>actor</code> keyword, and structured concurrency. Actors guarantee "no cross-thread data races" at the language level.</> },
  },
  {
    year: <>2022<small>·01</small></>,
    zh: { title: <>Lattner 创立 Modular，做 Mojo</>, desc: <>离开 Tesla 后 Lattner 去了 Google Brain 主导 MLIR；2022 年自己创立 <strong>Modular</strong>，2023 推出 <strong>Mojo</strong>——一门语法像 Python、运行性能逼近 C 的 AI 语言，被业内视作"Swift 的下一代"。</> },
    en: { title: <>Lattner founds Modular — Mojo</>, desc: <>After Tesla and a stint at Google Brain on MLIR, Lattner founds <strong>Modular</strong> in 2022 and unveils <strong>Mojo</strong> in 2023 — a Python-syntax language with C-class performance, widely read as the spiritual successor to Swift.</> },
  },
  {
    year: <>2023<small>·09</small></>,
    zh: { title: <>5.9 — macros + ownership</>, desc: <>同一个版本里塞了两个大件：<strong>macros</strong>（编译期代码生成、由独立编译器进程执行）和<strong>ownership</strong>（<code>~Copyable</code>、<code>borrowing</code>、<code>consuming</code>，向 Rust 看齐）。Swift 从"Apple 生态语言"开始正式向"系统级语言"靠拢。</> },
    en: { title: <>5.9 — macros + ownership</>, desc: <>Two big features in one release: <strong>macros</strong> (compile-time code generation run in a separate compiler process) and <strong>ownership</strong> (<code>~Copyable</code>, <code>borrowing</code>, <code>consuming</code> — Rust-flavoured). Swift starts pivoting from "Apple's app language" to a serious systems language.</> },
  },
  {
    year: <>2024<small>·02</small></>,
    zh: { title: <>visionOS / Vision Pro 出货</>, desc: <>2 月 2 日 Vision Pro 发售。visionOS 把 Swift / SwiftUI / RealityKit 钦定为<strong>唯一官方应用栈</strong>——这是苹果第一次推出一个"<em>从底层到 UI 全部 Swift</em>"的平台。空间计算时代，Swift 是入场券。</> },
    en: { title: <>visionOS / Vision Pro launches</>, desc: <>February 2nd. Vision Pro ships, with visionOS pinning Swift / SwiftUI / RealityKit as the <strong>sole official app stack</strong>. Apple's first platform that's "<em>Swift top to bottom</em>" — in spatial computing, Swift is the entry ticket.</> },
  },
  {
    year: <>2024<small>·09</small></>,
    zh: { title: <>Swift 6.0 — 严格并发</>, desc: <>9 月 16 日。Swift 6 语言模式正式开关。编译器现在<strong>静态拒绝</strong>跨 actor 的数据竞争——你写完代码就拿到"无数据竞争"承诺，不需要靠运行时检测。同期：<strong>Foundation 用 Swift 重写</strong>，跨平台一份代码。</> },
    en: { title: <>Swift 6.0 — strict concurrency</>, desc: <>September 16th. Swift 6's language mode flips on. The compiler <strong>statically rejects</strong> cross-actor data races — you ship code with a "race-free" guarantee at compile time, not at runtime. Same year: <strong>Foundation rewritten in Swift</strong>, one codebase across platforms.</> },
  },
  {
    year: <>2025<small>·09</small></>, highlight: true,
    zh: { title: <>6.2 — Embedded Swift + 可移植并发</>, desc: <>9 月 15 日。Swift 6.2 进一步把语言推向"<strong>非 Apple</strong>"领域：Embedded Swift 子集允许在裸金属（无 OS、无堆分配）上跑——目标是嵌入式、物联网、内核模块。同时 Approachable Concurrency 让普通业务代码不用再写一堆 <code>@Sendable</code>。Swift 从一门"App 语言"长成"全栈语言"。</> },
    en: { title: <>6.2 — Embedded Swift + portable concurrency</>, desc: <>September 15th. Swift 6.2 pushes the language further into the <strong>non-Apple</strong> world: Embedded Swift subset runs on bare metal (no OS, no heap) — targeting embedded, IoT, kernel modules. Approachable Concurrency removes the <code>@Sendable</code> tax on everyday code. Swift grows from "the app language" into a full-stack one.</> },
  },
];

interface SwCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const SWIFT_CARDS: SwCard[] = [
  {
    tag: 'A',
    zh: { title: <>Optional · <code>?</code> 与 <code>!</code></>, desc: <>把"可能没有值"做进类型。<code>String?</code> ≠ <code>String</code>，编译器逼你解开。<strong>消灭 nil 异常</strong>从这一步开始。</> },
    en: { title: <>Optionals · <code>?</code> and <code>!</code></>, desc: <>"Maybe a value, maybe not" baked into the type. <code>String?</code> ≠ <code>String</code>; the compiler forces you to unwrap. <strong>Goodbye nil crashes.</strong></> },
    code: (
      <code>
        <span className="cl-k">let</span> <span className="cl-v">name</span>: <span className="cl-type">String</span>? = <span className="cl-fn">readLine</span>(){'\n\n'}
        <span className="cl-k">if let</span> <span className="cl-v">n</span> = <span className="cl-v">name</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">print</span>(<span className="cl-s">"Hello, "</span> + <span className="cl-v">n</span>){'\n'}
        {'} '}<span className="cl-k">else</span> {'{ '}<span className="cl-fn">print</span>(<span className="cl-s">"anon"</span>) {'}'}{'\n\n'}
        <span className="cl-c">{'// 简写: Optional chaining'}</span>{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">upper</span> = <span className="cl-v">name</span>?.<span className="cl-fn">uppercased</span>()
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>值类型 vs 引用类型</>, desc: <><code>struct</code> 是值——拷贝。<code>class</code> 是引用——共享。Swift 标准库 <strong>90%+</strong> 都是 struct，跟 Java / OC 反着来。</> },
    en: { title: <>Value vs reference</>, desc: <><code>struct</code> is a value — copied on assignment. <code>class</code> is a reference — shared. <strong>90%+</strong> of the Swift std lib is structs — the opposite of Java / Obj-C.</> },
    code: (
      <code>
        <span className="cl-k">struct</span> <span className="cl-type">Point</span> {'{ '}<span className="cl-k">var</span> <span className="cl-v">x</span>, <span className="cl-v">y</span>: <span className="cl-type">Int</span> {'}'}{'\n\n'}
        <span className="cl-k">var</span> <span className="cl-v">a</span> = <span className="cl-type">Point</span>(<span className="cl-v">x</span>: <span className="cl-n">1</span>, <span className="cl-v">y</span>: <span className="cl-n">2</span>){'\n'}
        <span className="cl-k">var</span> <span className="cl-v">b</span> = <span className="cl-v">a</span>            <span className="cl-c">{'// copy'}</span>{'\n'}
        <span className="cl-v">b</span>.<span className="cl-prop">x</span> = <span className="cl-n">99</span>{'\n'}
        <span className="cl-fn">print</span>(<span className="cl-v">a</span>.<span className="cl-prop">x</span>)         <span className="cl-c">{'// 1, not 99'}</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>面向协议</>, desc: <><code>protocol</code> 是 Swift 的"接口 + 类型类"。带默认实现、带关联类型，能横向给类型加能力——比传统继承灵活得多。</> },
    en: { title: <>Protocol-oriented</>, desc: <><code>protocol</code> is Swift's "interface + type class": default impls, associated types, horizontal capability composition — far more flexible than classical inheritance.</> },
    code: (
      <code>
        <span className="cl-k">protocol</span> <span className="cl-type">Greetable</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">var</span> <span className="cl-v">name</span>: <span className="cl-type">String</span> {'{ '}<span className="cl-k">get</span> {'}'}{'\n'}
        {'}'}{'\n'}
        <span className="cl-k">extension</span> <span className="cl-type">Greetable</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">func</span> <span className="cl-fn">hi</span>() {'{ '}<span className="cl-fn">print</span>(<span className="cl-s">"hi "</span> + <span className="cl-v">name</span>) {'}'}{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">struct</span> <span className="cl-type">User</span>: <span className="cl-type">Greetable</span> {'{ '}<span className="cl-k">let</span> <span className="cl-v">name</span>: <span className="cl-type">String</span> {'}'}{'\n'}
        <span className="cl-type">User</span>(<span className="cl-v">name</span>: <span className="cl-s">"Chris"</span>).<span className="cl-fn">hi</span>()
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>泛型</>, desc: <>对类型变量参数化。带 <code>where</code> 约束、带 <code>some</code> 不透明类型——一份函数 / 类型给所有类型用。</> },
    en: { title: <>Generics</>, desc: <>Parameterise over types. With <code>where</code> constraints and <code>some</code> opaque return types — one definition serves all the types.</> },
    code: (
      <code>
        <span className="cl-k">func</span> <span className="cl-fn">last</span>&lt;<span className="cl-type">T</span>&gt;(_ <span className="cl-v">arr</span>: [<span className="cl-type">T</span>]) -&gt; <span className="cl-type">T</span>? {'{'}{'\n'}
        {'  '}<span className="cl-k">return</span> <span className="cl-v">arr</span>.<span className="cl-prop">last</span>{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-fn">last</span>([<span className="cl-n">1</span>, <span className="cl-n">2</span>, <span className="cl-n">3</span>])    <span className="cl-c">{'// T = Int'}</span>{'\n'}
        <span className="cl-fn">last</span>([<span className="cl-s">"a"</span>, <span className="cl-s">"b"</span>])  <span className="cl-c">{'// T = String'}</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>闭包</>, desc: <>一等函数。trailing closure 让 DSL 写起来像普通块——SwiftUI 整套 UI 都靠它。</> },
    en: { title: <>Closures</>, desc: <>First-class functions. Trailing closures make DSLs read like normal blocks — all of SwiftUI is built on this.</> },
    code: (
      <code>
        <span className="cl-k">let</span> <span className="cl-v">nums</span> = [<span className="cl-n">3</span>, <span className="cl-n">1</span>, <span className="cl-n">4</span>, <span className="cl-n">1</span>, <span className="cl-n">5</span>]{'\n\n'}
        <span className="cl-k">let</span> <span className="cl-v">sorted</span> = <span className="cl-v">nums</span>.<span className="cl-fn">sorted</span> {'{ '}<span className="cl-v">$0</span> &gt; <span className="cl-v">$1</span> {'}'}{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">doubled</span> = <span className="cl-v">nums</span>.<span className="cl-fn">map</span> {'{ '}<span className="cl-v">$0</span> * <span className="cl-n">2</span> {'}'}{'\n'}
        <span className="cl-k">let</span> <span className="cl-v">total</span> = <span className="cl-v">nums</span>.<span className="cl-fn">reduce</span>(<span className="cl-n">0</span>, +)
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Result Builder</>, desc: <>把"块里写多个表达式"翻译成"调一个 build 函数"——SwiftUI 的 <code>VStack {'{ ... }'}</code> 之所以能那么写，全靠这个。</> },
    en: { title: <>Result builders</>, desc: <>Translate "a block with several expressions" into one call to a build function — the magic behind SwiftUI's <code>VStack {'{ ... }'}</code>.</> },
    code: (
      <code>
        <span className="cl-k">var</span> <span className="cl-v">body</span>: <span className="cl-k">some</span> <span className="cl-type">View</span> {'{'}{'\n'}
        {'  '}<span className="cl-type">VStack</span> {'{'}{'\n'}
        {'    '}<span className="cl-type">Text</span>(<span className="cl-s">"Hello"</span>){'\n'}
        {'    '}<span className="cl-type">Text</span>(<span className="cl-s">"Vision"</span>){'\n'}
        {'    '}<span className="cl-type">Button</span>(<span className="cl-s">"Tap"</span>) {'{ '}<span className="cl-fn">tap</span>() {'}'}{'\n'}
        {'  }'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>async / await</>, desc: <>线性写法、异步执行。Swift 5.5 一次性补齐"现代并发"——再也不用回调嵌套地狱。</> },
    en: { title: <>async / await</>, desc: <>Linear code, async execution. Swift 5.5 brought modern concurrency in one stroke — no more callback-pyramid hell.</> },
    code: (
      <code>
        <span className="cl-k">func</span> <span className="cl-fn">load</span>() <span className="cl-k">async throws</span> -&gt; <span className="cl-type">User</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">let</span> (<span className="cl-v">data</span>, _) = <span className="cl-k">try await</span>{'\n'}
        {'    '}<span className="cl-type">URLSession</span>.<span className="cl-prop">shared</span>.<span className="cl-fn">data</span>(<span className="cl-v">from</span>: <span className="cl-v">url</span>){'\n'}
        {'  '}<span className="cl-k">return try</span> <span className="cl-type">JSONDecoder</span>(){'\n'}
        {'    '}.<span className="cl-fn">decode</span>(<span className="cl-type">User</span>.<span className="cl-k">self</span>, <span className="cl-v">from</span>: <span className="cl-v">data</span>){'\n'}
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
    zh: { title: <>类型推断</>, desc: <>大多数局部变量你<strong>不用写</strong>类型。Swift 编译器从赋值的形状推。代码看起来像脚本，跑起来是编译型语言。</> },
    en: { title: <>Type inference</>, desc: <>You rarely write types for locals — the compiler infers from the assignment. Reads like a script, runs like a compiled language.</> },
    code: <><span className="cl-k">let</span> <span className="cl-v">x</span> = <span className="cl-n">42</span>          <span className="cl-c">{'// Int'}</span>{'\n'}<span className="cl-k">let</span> <span className="cl-v">name</span> = <span className="cl-s">"Chris"</span>   <span className="cl-c">{'// String'}</span>{'\n'}<span className="cl-k">let</span> <span className="cl-v">items</span> = [<span className="cl-n">1</span>, <span className="cl-n">2</span>, <span className="cl-n">3</span>] <span className="cl-c">{'// [Int]'}</span></>,
  },
  {
    icon: '⎇',
    zh: { title: <>消灭 nil 异常</>, desc: <>Swift 用 Optional 把"可能没有值"做进类型系统——Java / Obj-C 那种 NPE 在 Swift 里编译期就被挡。Apple 自己说，Swift 把崩溃率降了一个数量级。</> },
    en: { title: <>No more nil crashes</>, desc: <>Swift bakes "maybe-no-value" into the type system. The Java / Obj-C NPE simply doesn't compile here. Apple's internal data: Swift cut crash rates by an order of magnitude.</> },
    code: <><span className="cl-k">let</span> <span className="cl-v">u</span>: <span className="cl-type">User</span>? = <span className="cl-fn">find</span>(<span className="cl-n">42</span>){'\n'}<span className="cl-c">{'// u.name        ✘ compile error'}</span>{'\n'}<span className="cl-c">{'// u?.name       ✓ Optional<String>'}</span>{'\n'}<span className="cl-c">{'// u!.name       ✓ crash if nil'}</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>SwiftUI · 一份 UI 代码全平台</>, desc: <>iOS / iPadOS / macOS / watchOS / tvOS / visionOS——同一份 SwiftUI 描述，按平台特性自动适配。再也不需要"每个平台一份 UIKit"。</> },
    en: { title: <>SwiftUI — one UI codebase, every platform</>, desc: <>iOS, iPadOS, macOS, watchOS, tvOS, visionOS — one SwiftUI description, platform-specific adaptation automatic. The "one UIKit per platform" era is over.</> },
    code: <><span className="cl-type">Text</span>(<span className="cl-s">"Hello"</span>){'\n'}{'  '}.<span className="cl-fn">font</span>(.<span className="cl-prop">title</span>){'\n'}{'  '}.<span className="cl-fn">foregroundStyle</span>(.<span className="cl-prop">orange</span>){'\n'}<span className="cl-c">{'// 同一行在 6 个平台都跑'}</span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>性能贴近 C</>, desc: <>背靠 LLVM——同一套优化管线、同样能拿到 SIMD / 内联 / 死代码消除。Embedded Swift 子集甚至能跑在没有 OS 的裸金属上。</> },
    en: { title: <>Near-C performance</>, desc: <>Sits on LLVM: the same optimisation pipeline, the same SIMD / inlining / DCE. The Embedded Swift subset even runs on bare metal — no OS, no heap.</> },
    code: <><span className="cl-c">{'// LLVM-compiled, statically dispatched'}</span>{'\n'}<span className="cl-c">{'// generic specialisation'}</span>{'\n'}<span className="cl-c">{'// → comparable to hand-tuned C'}</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>静态并发安全</>, desc: <>Swift 6 的 actor + <code>Sendable</code> 约束让<strong>跨线程数据竞争</strong>在编译期就被拦下——这是 Java / C++ 没做到的事。</> },
    en: { title: <>Compile-time concurrency safety</>, desc: <>Swift 6's actors + <code>Sendable</code> reject <strong>cross-thread data races</strong> at compile time — something Java and C++ never managed.</> },
    code: <><span className="cl-k">actor</span> <span className="cl-type">Counter</span> {'{'}{'\n'}{'  '}<span className="cl-k">var</span> <span className="cl-v">n</span> = <span className="cl-n">0</span>{'\n'}{'  '}<span className="cl-k">func</span> <span className="cl-fn">inc</span>() {'{ '}<span className="cl-v">n</span> += <span className="cl-n">1</span> {'}'}{'\n'}{'}'}{'\n'}<span className="cl-c">{'// 跨线程访问? 编译器拒绝'}</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>语法清爽</>, desc: <>没有 Obj-C 的方括号呼叫，没有 C 头文件，没有分号——Swift 是"快意写代码"派。读和写都比前任轻不止一个量级。</> },
    en: { title: <>Clean syntax</>, desc: <>No Obj-C brackets, no C headers, no semicolons. Swift is "code without the noise" — far easier to read or write than its predecessor.</> },
    code: <><span className="cl-c">{'// Obj-C'}</span>{'\n'}<span className="cl-c">{'// [user setName:@"Chris"];'}</span>{'\n\n'}<span className="cl-c">{'// Swift'}</span>{'\n'}<span className="cl-v">user</span>.<span className="cl-prop">name</span> = <span className="cl-s">"Chris"</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>SwiftPM 一站式包管理</>, desc: <>Apple 官方包管理器内置，Xcode / VSCode / 命令行均可用。<code>Package.swift</code> 一文件搞定依赖、平台、target——不需要 CocoaPods 那样的第三方层。</> },
    en: { title: <>SwiftPM — one-stop packaging</>, desc: <>The official package manager, built in. Xcode, VS Code, CLI — all driven by a single <code>Package.swift</code> describing deps, platforms, targets. No CocoaPods middleman.</> },
    code: <><span className="cl-c">{'// Package.swift'}</span>{'\n'}<span className="cl-fn">dependencies</span>: [{'\n'}{'  '}.<span className="cl-fn">package</span>(<span className="cl-v">url</span>: <span className="cl-s">"…/vapor"</span>,{'\n'}{'    '}<span className="cl-v">from</span>: <span className="cl-s">"4.0.0"</span>),{'\n'}]</>,
  },
  {
    icon: '⏚',
    zh: { title: <>Playgrounds 即时反馈</>, desc: <>左边写代码、右边看结果——表达式逐行求值，迭代像写脚本。语言级支持，不是 IDE 插件。教学和原型都用它。</> },
    en: { title: <>Playgrounds — instant feedback</>, desc: <>Write on the left, see results on the right — every expression evaluated live. Language-level support, not an IDE add-on. Used for teaching and prototyping alike.</> },
    code: <><span className="cl-k">let</span> <span className="cl-v">x</span> = <span className="cl-n">2</span> + <span className="cl-n">3</span>          <span className="cl-c">{'// 5'}</span>{'\n'}<span className="cl-k">let</span> <span className="cl-v">cubed</span> = <span className="cl-v">x</span> * <span className="cl-v">x</span> * <span className="cl-v">x</span>  <span className="cl-c">{'// 125'}</span>{'\n'}<span className="cl-c">{'// 每行右侧实时显示值'}</span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>开源 + 跨平台</>, desc: <>swift.org · Apache 2.0。Linux / Windows / WASM 全有官方 toolchain——再不是只能写 macOS / iOS app 的"苹果方言"。</> },
    en: { title: <>Open source + cross-platform</>, desc: <>swift.org under Apache 2.0. Official toolchains for Linux, Windows, WebAssembly — no longer "Apple's dialect."</> },
    code: <><span className="cl-c">{'// macOS / iOS / iPadOS'}</span>{'\n'}<span className="cl-c">{'// watchOS / tvOS / visionOS'}</span>{'\n'}<span className="cl-c">{'// Linux / Windows / WASM'}</span>{'\n'}<span className="cl-c">{'// → 一份代码, 全平台编译'}</span></>,
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
    href: 'https://www.apple.com/apple-vision-pro/', highlight: true,
    zhName: 'visionOS', enName: 'visionOS',
    zhNote: 'Vision Pro · Swift 钦定语言', enNote: 'Vision Pro · Swift-only stack',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><defs><linearGradient id="vp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1A1A1A"/><stop offset="1" stopColor="#444"/></linearGradient></defs><ellipse cx="50" cy="50" rx="42" ry="26" fill="url(#vp)"/><ellipse cx="35" cy="50" rx="14" ry="12" fill="#0A0A0A"/><ellipse cx="65" cy="50" rx="14" ry="12" fill="#0A0A0A"/><ellipse cx="33" cy="46" rx="3" ry="2" fill="#5BA8FF"/><ellipse cx="67" cy="46" rx="3" ry="2" fill="#5BA8FF"/></svg>,
  },
  {
    href: 'https://developer.apple.com/xcode/swiftui/',
    zhName: 'SwiftUI', enName: 'SwiftUI',
    zhNote: '6 平台声明式 UI', enNote: '6-platform declarative UI',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="18" fill="#F05138"/><path d="M30 35 Q50 20 70 50 Q60 40 50 50 Q60 65 75 70 Q50 75 30 60 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://developer.apple.com/ios/',
    zhName: 'iOS apps', enName: 'iOS apps',
    zhNote: '~2M App Store 应用', enNote: '~2M App Store apps',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="20" y="6" width="60" height="88" rx="12" fill="#1A1A1A"/><rect x="24" y="14" width="52" height="68" rx="3" fill="#222"/><circle cx="50" cy="88" r="3" fill="#444"/><path d="M40 30 Q50 20 60 30 M40 40 Q50 30 60 40" stroke="#5BA8FF" strokeWidth="2" fill="none"/></svg>,
  },
  {
    href: 'https://developer.apple.com/watchos/',
    zhName: 'watchOS', enName: 'watchOS',
    zhNote: '全 SwiftUI 重构 (watchOS 7+)', enNote: 'Pure SwiftUI since watchOS 7',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="30" y="10" width="40" height="80" rx="12" fill="#1A1A1A"/><rect x="34" y="22" width="32" height="56" rx="6" fill="#0A0A0A"/><circle cx="50" cy="50" r="14" fill="none" stroke="#F05138" strokeWidth="3"/><circle cx="50" cy="50" r="3" fill="#F05138"/></svg>,
  },
  {
    href: 'https://developer.apple.com/macos/',
    zhName: 'macOS apps', enName: 'macOS apps',
    zhNote: 'Final Cut · Logic · Pages …', enNote: 'Final Cut · Logic · Pages …',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="20" width="80" height="55" rx="6" fill="#1A1A1A"/><rect x="14" y="24" width="72" height="44" rx="3" fill="#0A0A0A"/><rect x="40" y="75" width="20" height="6" fill="#1A1A1A"/><rect x="32" y="80" width="36" height="4" rx="2" fill="#444"/><circle cx="50" cy="46" r="10" fill="none" stroke="#F05138" strokeWidth="2.5"/></svg>,
  },
  {
    href: 'https://vapor.codes', highlight: true,
    zhName: 'Vapor', enName: 'Vapor',
    zhNote: 'Server-side Swift Web 框架', enNote: 'Server-side Swift web framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#0F1A2E"/><path d="M30 35 Q50 25 70 35 Q60 50 70 65 Q50 75 30 65 Q40 50 30 35 Z" fill="#5BA8FF"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>,
  },
  {
    href: 'https://hummingbird.codes',
    zhName: 'Hummingbird', enName: 'Hummingbird',
    zhNote: 'AWS Lambda 友好 · 极简框架', enNote: 'AWS Lambda-friendly · minimal',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#1A2E3A"/><path d="M30 60 Q40 40 55 45 Q70 50 75 35 Q72 60 55 60 Q40 65 30 60 Z" fill="#5BD8C8"/><circle cx="68" cy="40" r="2.5" fill="#0A0A0A"/></svg>,
  },
  {
    href: 'https://developer.apple.com/machine-learning/core-ml/',
    zhName: 'Core ML', enName: 'Core ML',
    zhNote: 'Apple 端上 ML · Swift 推理 API', enNote: 'On-device ML · Swift inference API',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="18" fill="#0A0A0A"/><path d="M30 50 Q40 30 50 50 Q60 70 70 50" stroke="#F05138" strokeWidth="3" fill="none"/><circle cx="30" cy="50" r="4" fill="#FA8072"/><circle cx="50" cy="50" r="4" fill="#FA8072"/><circle cx="70" cy="50" r="4" fill="#FA8072"/></svg>,
  },
  {
    href: 'https://developer.apple.com/metal/',
    zhName: 'Metal', enName: 'Metal',
    zhNote: 'Apple 图形 / GPU 计算 API', enNote: 'Apple GPU & graphics API',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><polygon points="50,8 88,30 88,70 50,92 12,70 12,30" fill="#1A1A1A" stroke="#F05138" strokeWidth="2"/><polygon points="50,28 70,40 70,60 50,72 30,60 30,40" fill="none" stroke="#FA8072" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://github.com/apple/swift-foundation',
    zhName: 'Swift Foundation', enName: 'Swift Foundation',
    zhNote: '2024 用 Swift 重写 · 跨平台', enNote: 'Rewritten in Swift, 2024 · cross-platform',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="18" fill="#0F1A2E"/><path d="M50 22 L75 38 V62 L50 78 L25 62 V38 Z" fill="none" stroke="#F05138" strokeWidth="3"/><circle cx="50" cy="50" r="8" fill="#F05138"/></svg>,
  },
  {
    href: 'https://github.com/apple/swift',
    zhName: 'swift.org', enName: 'swift.org',
    zhNote: 'Apache 2.0 · Linux / Windows / WASM', enNote: 'Apache 2.0 · Linux / Windows / WASM',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="18" fill="#F05138"/><path d="M28 32 Q50 22 70 50 Q58 40 48 50 Q58 65 75 70 Q50 75 28 60 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.modular.com/mojo',
    zhName: 'Mojo', enName: 'Mojo',
    zhNote: 'Lattner 离职后做的"Swift 后继"', enNote: "Lattner's spiritual sequel to Swift",
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#0A0A0A"/><path d="M28 70 V35 L42 55 L50 40 L58 55 L72 35 V70" stroke="#FF4500" strokeWidth="4" fill="none"/><circle cx="50" cy="22" r="4" fill="#FF4500"/></svg>,
  },
];

interface AiTool { name: string; zhDesc: string; enDesc: string }
const APPLE_TOOLS: AiTool[] = [
  { name: 'Xcode',                  zhDesc: 'Apple 官方 IDE · Swift 主战场', enDesc: 'Official Apple IDE · Swift home turf' },
  { name: 'SwiftUI',                zhDesc: '声明式 UI · 6 平台共享', enDesc: 'Declarative UI · 6 platforms' },
  { name: 'RealityKit',             zhDesc: 'AR / visionOS 渲染', enDesc: 'AR / visionOS renderer' },
  { name: 'Combine',                zhDesc: '响应式数据流', enDesc: 'Reactive streams' },
  { name: 'Core Data / SwiftData',  zhDesc: '本地持久化 · ORM', enDesc: 'Local persistence · ORM' },
  { name: 'Core ML',                zhDesc: '端上 ML 推理 API', enDesc: 'On-device ML inference API' },
  { name: 'Metal',                  zhDesc: '低级 GPU API · MLX 基底', enDesc: 'Low-level GPU API · MLX backbone' },
  { name: 'Vapor',                  zhDesc: '服务端 Swift Web 框架', enDesc: 'Server-side Swift web framework' },
  { name: 'Hummingbird',            zhDesc: 'AWS Lambda · 极简服务器', enDesc: 'AWS Lambda · minimal server' },
  { name: 'SwiftNIO',               zhDesc: 'Apple 异步网络库', enDesc: "Apple's async networking lib" },
  { name: 'AsyncHTTPClient',        zhDesc: 'NIO 之上的 HTTP 客户端', enDesc: 'HTTP client atop NIO' },
  { name: 'swift-package-manager', zhDesc: 'Apple 官方 · 内置依赖管理', enDesc: 'Built-in package manager' },
  { name: 'Swift Playgrounds',      zhDesc: 'iPad / Mac 教学环境', enDesc: 'iPad / Mac learning environment' },
  { name: 'XCTest',                 zhDesc: '官方单元测试', enDesc: 'Official unit testing' },
  { name: 'Swift Testing',          zhDesc: '2024 全新 macros 测试框架', enDesc: 'New macro-based testing, 2024' },
  { name: 'TipKit',                 zhDesc: 'iOS 17+ 应用内引导', enDesc: 'In-app tips, iOS 17+' },
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
    tag: <>HOT · 2025-09</>, hot: true, big: true,
    zh: {
      title: <>Embedded Swift / Swift 6.2</>,
      body: (<>
        <p>Swift 6.2 推出 <strong>Embedded Swift</strong>：一个语言子集，<strong>无 OS、无堆分配、无标准库依赖</strong>，能直接编进微控制器固件。Apple 自己已经在用——AirPods、Watch、车机系统的部分固件层从 C / C++ 切到了 Embedded Swift。</p>
        <p>意义：Swift 不再只是"App 语言"。从 Vision Pro 的空间 UI，一路下到 1KB 内存的 MCU——同一门语言的语义。这是过去十年 Rust 反复尝试做但没完全做成的事。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Swift 5.x runtime</span><span className="bar-val">~5MB</span></div>
          <div className="bar bar-new"><span className="bar-label">Embedded Swift</span><span className="bar-val">{'<200KB'}</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Embedded Swift / Swift 6.2</>,
      body: (<>
        <p>Swift 6.2 ships <strong>Embedded Swift</strong> — a language subset with <strong>no OS, no heap, no stdlib dependency</strong> — compilable straight into microcontroller firmware. Apple already uses it: parts of AirPods, Watch and CarPlay firmware moved from C/C++ to Embedded Swift.</p>
        <p>The point: Swift is no longer just "the app language." From Vision Pro's spatial UI all the way down to 1 KB-RAM MCUs, one language's semantics. Rust has been trying this for a decade; Swift just shipped it.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Swift 5.x runtime</span><span className="bar-val">~5MB</span></div>
          <div className="bar bar-new"><span className="bar-label">Embedded Swift</span><span className="bar-val">{'<200KB'}</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'SERVER',
    zh: { title: <>服务端 Swift</>, body: <><p>Vapor / Hummingbird 双框架已稳定，<strong>SwiftNIO</strong> 是 Apple 自家维护的异步网络底层。AWS Lambda 官方支持 Swift runtime——一段 Swift 函数冷启动 <strong>40 ms</strong>，比 Java 快 5 倍以上。</p></> },
    en: { title: <>Server-side Swift</>, body: <><p>Vapor / Hummingbird are mature; <strong>SwiftNIO</strong> is Apple-maintained async networking. AWS Lambda has an official Swift runtime — cold-start in <strong>40 ms</strong>, 5× faster than Java.</p></> },
  },
  {
    tag: 'WASM',
    zh: { title: <>WebAssembly · Swift on Web</>, body: <><p>SwiftWasm 项目把 Swift 编到 WebAssembly。结合 SwiftUI 描述层，未来的目标是<strong>一份 Swift 代码同时跑 iOS / 桌面 / 浏览器</strong>。Swift 6.2 起 WASM 是一等支持目标。</p></> },
    en: { title: <>WebAssembly · Swift on the web</>, body: <><p>SwiftWasm compiles Swift to WebAssembly. Combined with SwiftUI's description layer, the goal is <strong>one Swift codebase across iOS, desktop and the browser</strong>. WASM is a first-class target since Swift 6.2.</p></> },
  },
  {
    tag: 'ML',
    zh: { title: <>Apple ML 全栈 Swift</>, body: <><p>Core ML / Vision / Metal Performance Shaders / 新出的 <strong>MLX</strong>（Apple Silicon 端上数组框架）——Apple 整条端上 ML 栈都对外暴露 Swift API。在端上跑大模型，Swift 是事实标准。</p></> },
    en: { title: <>Apple's ML stack — all Swift</>, body: <><p>Core ML, Vision, Metal Performance Shaders, the newer <strong>MLX</strong> (Apple Silicon's array framework) — Apple's full on-device ML stack exposes Swift APIs. For on-device models, Swift is the de-facto standard.</p></> },
  },
  {
    tag: 'GOV',
    zh: { title: <>语言治理 — Swift Evolution</>, body: <><p>从 Lattner 一人主导，到现在的<strong>Swift Evolution 提案制</strong>：每个语言变更都走公开 RFC、社区评审、最终核心团队拍板。和 Rust RFC 流程几乎同构。</p></> },
    en: { title: <>Governance — Swift Evolution</>, body: <><p>From "Lattner decides" to <strong>Swift Evolution proposals</strong>: every change goes through a public RFC, community review and core-team approval. Structurally near-identical to Rust's RFC process.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>AI 时代下的位置</>, body: <><p>Swift 不像 TS / Python 那样在 LLM 训练数据里占大头，但它<strong>在 Apple 平台上是唯一选择</strong>——空间计算、端上 AI、所有 iOS 应用——这块"独占市场"AI 必须学会写 Swift。</p></> },
    en: { title: <>Position in the AI era</>, body: <><p>Swift's share of LLM training data is small compared to TS or Python, but on Apple platforms it is <strong>simply the only option</strong> — spatial computing, on-device AI, every iOS app. To touch this market, AI has to learn Swift.</p></> },
  },
];

export default function SwiftIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'Swift : 苹果生态的钦定语言'
      : 'Swift : Apple Ecosystem’s Native Tongue';
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
      <div ref={rootRef} className="swift-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="swift-nav-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F88A36" />
                  <stop offset="100%" stopColor="#F05138" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="56" fill="url(#swift-nav-grad)" />
              <path fill="#fff" d="M188 188c-22 13-52 14-82 1-24-10-44-29-56-46 6 5 14 10 22 14 32 18 64 17 86 5-32-25-59-58-79-86 4 4 8 7 13 11 19 15 49 34 60 40-22-23-41-52-40-51 35 35 67 55 67 55 1 1 1 2 2 3 1-2 1-5 2-7 3-22-3-46-19-65 36 22 58 63 49 99-1 4-1 7-2 10 3 4 6 9 8 14 16 22 12 46 10 41-8-19-23-13-23-13z" />
            </svg>
            <span>Swift</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="八件套" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#beyond"><L zh="出 Apple" en="Beyond Apple" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Kotlin" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2010 — 2026 · Apple · Chris Lattner</div>
            <h1 className="hero-title">
              <span className="hero-name">Swift</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">Apple</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>给 Apple 全栈生态写一门"<strong>现代 / 安全 / 高效</strong>"的语言——这是 Chris Lattner 在 2010 年立下的目标。十一年后的今天，从 Vision Pro 的空间 UI 到 AirPods 固件、从服务端的 Vapor 到 AWS Lambda 上 40ms 冷启动的函数，都在用 Swift。</>}
                en={<>One language for Apple's full stack — <strong>modern, safe, fast</strong> — was the goal Chris Lattner set in 2010. Eleven years later, Swift powers Vision Pro's spatial UI, AirPods firmware, server-side Vapor, and 40ms-cold-start AWS Lambda functions alike.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2014<small></small></span>
                <span className="stat-label"><L zh={<>WWDC 公开 · 11 年<br /><em>Lattner 内部立项 2010</em></>} en={<>WWDC unveil · 11 years on<br /><em>Lattner internal start 2010</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">5.9<small></small></span>
                <span className="stat-label"><L zh={<>引入 ownership · 2023<br /><em>~Copyable · borrowing · consuming</em></>} en={<>Ownership lands · 2023<br /><em>~Copyable · borrowing · consuming</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">→ Mojo<small></small></span>
                <span className="stat-label"><L zh={<>Lattner 离开后做的下一代<br /><em>Modular · Python 语法 · C 性能</em></>} en={<>Lattner's next-gen after leaving<br /><em>Modular · Python-syntax · C-class perf</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">visionOS<small></small></span>
                <span className="stat-label"><L zh={<>空间计算钦定语言<br /><em>Vision Pro · Swift-only stack</em></>} en={<>Spatial-computing native tongue<br /><em>Vision Pro · Swift-only stack</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{SWIFT_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">: String?</span>
              <span className="float f2">@MainActor</span>
              <span className="float f3">some View</span>
              <span className="float f4">async throws</span>
              <span className="float f5">Sendable</span>
              <span className="float f6">~Copyable</span>
              <span className="float f7">@resultBuilder</span>
              <span className="float f8">borrowing</span>
              <span className="float f9">guard let</span>
              <span className="float f10">struct Self</span>
              <span className="float f11">{'protocol P'}</span>
              <span className="float f12">{'actor Counter'}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Swift</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Swift 是 Apple 主导设计的一门<strong>编译型、静态类型、内存安全</strong>的通用语言。它替代了 Objective-C 在 Apple 平台的位置，又借 LLVM 把性能拉到接近 C 的水准。最初定位是"app 语言"，2024 起跨进了空间计算、嵌入式、服务端。</>}
                  en={<>Swift is a <strong>compiled, statically typed, memory-safe</strong> general-purpose language designed at Apple. It replaced Objective-C on Apple platforms while riding LLVM to near-C performance. Originally pitched as "the app language" — by 2024, it spans spatial computing, embedded, and server-side.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="编译型" en="Compiled" />, tag: 'LLVM', p: <L zh={<>Swift 程序经 <code>swiftc</code> 编译成原生机器码——同 LLVM 后端，与 C / C++ / Rust 共享一整套优化。性能不靠 JIT。</>} en={<>Compiled to native machine code via <code>swiftc</code> on the LLVM backend — sharing the optimisation pipeline with C / C++ / Rust. No JIT.</>} /> },
                { h: <L zh="内存安全" en="Memory-safe" />, tag: 'no-NPE', p: <L zh={<>Optional 把 nil 做进类型；ARC 自动管理引用；越界越权直接 trap。<strong>无 GC、无 nil 闪退</strong>。</>} en={<>Optionals encode nil into types; ARC handles reference counting; out-of-bounds traps. <strong>No GC, no NPE crashes.</strong></>} /> },
                { h: <L zh="协议优先" en="Protocol-first" />, tag: 'PoOP', p: <L zh={<>Apple 自己叫 "<em>protocol-oriented programming</em>"。<strong>类型横向组合能力</strong>，而不是纵向继承——struct + protocol 是 Swift 的常态。</>} en={<>Apple calls it "<em>protocol-oriented programming</em>". <strong>Compose capabilities horizontally</strong>, not by deep inheritance trees. Struct + protocol is the default shape.</>} /> },
                { h: <L zh="并发原生" en="Concurrency-native" />, tag: 'actor', p: <L zh={<>async/await 是语法关键字、<code>actor</code> 是语言级类型。Swift 6 让<strong>跨线程数据竞争</strong>在编译期就被拦下。</>} en={<>async/await are keywords, <code>actor</code> is a language-level kind. Swift 6 rejects <strong>cross-thread data races</strong> at compile time.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">User.m</span><span className="lang-tag js">Objective-C</span></div>
                <pre className="code"><code>
                  <span className="cl-c">{'// @interface User'}</span>{'\n'}
                  <span className="cl-c">{'//   @property NSString *name;'}</span>{'\n'}
                  <span className="cl-c">{'// @end'}</span>{'\n\n'}
                  <span className="cl-type">User</span> *<span className="cl-v">u</span> = [<span className="cl-type">User</span> <span className="cl-fn">new</span>];{'\n'}
                  <span className="cl-c"><L zh="// 拼写错了一个字母" en="// One typo" /></span>{'\n'}
                  [<span className="cl-v">u</span> <span className="cl-fn">setNaem</span>:<span className="cl-s">@"Chris"</span>];{'\n\n'}
                  <span className="cl-c">{'// → 运行时崩溃'}</span>{'\n'}
                  <span className="cl-c">{"// '-[User setNaem:]: unrecognized"}</span>{'\n'}
                  <span className="cl-c">{"//   selector sent to instance'"}</span>{'\n'}
                  <span className="cl-c"><L zh="// 上线后才发现" en="// Caught only in production" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">User.swift</span><span className="lang-tag ts">Swift</span></div>
                <pre className="code"><code>
                  <span className="cl-k">struct</span> <span className="cl-type">User</span> {'{'}{'\n'}
                  {'  '}<span className="cl-k">var</span> <span className="cl-v">name</span>: <span className="cl-type">String</span>{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-k">var</span> <span className="cl-v">u</span> = <span className="cl-type">User</span>(<span className="cl-v">name</span>: <span className="cl-s">""</span>){'\n'}
                  <span className="cl-c"><L zh="// 拼写错了一个字母" en="// One typo" /></span>{'\n'}
                  <span className="cl-v">u</span>.<span className="cl-err">naem</span> = <span className="cl-s">"Chris"</span>{'\n'}
                  <span className="cl-squiggle">  ~~~~</span>{'\n\n'}
                  <span className="cl-c">{"// ✘ Value of type 'User' has no"}</span>{'\n'}
                  <span className="cl-c">{"//   member 'naem'; did you mean 'name'?"}</span>{'\n'}
                  <span className="cl-c"><L zh="// 编辑器在你按下保存键之前就喊停" en="// Editor flags it before you save" /></span>
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
                zh={<>从 2010 Lattner 的一人秘密项目，到 2014 WWDC 突然亮相，再到 2024 visionOS 加冕、2025 嵌入式领域的拳头——Swift 走的是"小步快跑、稳定 ABI、再爆开"的曲线。</>}
                en={<>From Lattner's one-man secret in 2010, to a stealth WWDC unveil in 2014, to visionOS coronation in 2024 and an embedded-systems play in 2025 — Swift's arc is "iterate fast, stabilise the ABI, then explode outward."</>}
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

          {/* 03 Eight essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: SwiftEightPack</code></h2>
              <p className="sec-desc"><L
                zh={<>Swift 的语言面很厚——从底层 ownership 到顶层 result builder。但日常 90% 用得到的，就是下面这八件套。把这八件捋顺，你就能在 SwiftUI / Vapor / Embedded 任意一端写代码。</>}
                en={<>Swift's surface is broad — from low-level ownership to top-level result builders. But 90% of day-to-day code uses the eight building blocks below. Master them and you can ship in SwiftUI, Vapor or Embedded alike.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {SWIFT_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="actor — 并发原语" en="actor — concurrency primitive" /></h3>
                <p><L
                  zh={<>第八件套：<code>actor</code>。同一个 actor 内的状态<strong>串行化访问</strong>，跨 actor 必须 <code>await</code>。这把"线程安全"从"靠纪律"升级到"靠类型"。Swift 6 起强制开启。</>}
                  en={<>Eighth essential: the <code>actor</code>. State inside one actor is <strong>serially accessed</strong>; crossing actors requires <code>await</code>. This lifts "thread safety" from honor system to type system. Mandatory under Swift 6.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>跨线程数据竞争"在 Swift 6 不是 bug——是编译错误。</>}
                  en={<>A cross-thread data race" isn't a bug under Swift 6 — it's a compile error.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Swift" /> <code>: WhySwift</code></h2>
              <p className="sec-desc"><L
                zh={<>类型安全 + 性能 + 全栈一致——Swift 把 Apple 平台的所有需求拉到同一门语言里解决。下面九个理由从语言、生态、工具链三层叠出来。</>}
                en={<>Type safety + performance + cross-stack consistency — Swift folds the entire Apple-platform need into one language. Nine reasons stacked across language, ecosystem and tooling.</>}
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
                zh={<>Apple 自家整套——iOS / iPadOS / macOS / watchOS / tvOS / visionOS——加上服务端 Vapor、AWS Lambda、Apple 端上 ML 全栈。下面这 12 个项目，撑起了 Swift 在 2026 年的版图。</>}
                en={<>Apple's full set — iOS / iPadOS / macOS / watchOS / tvOS / visionOS — plus server-side Vapor, AWS Lambda, and Apple's on-device ML stack. The 12 below shape Swift's footprint in 2026.</>}
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

          {/* 06 Beyond Apple */}
          <section className="section section-ai" id="beyond">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="出 Apple " en="Beyond Apple " /> <code>: <L zh="Swift" en="Swift" /></code></h2>
              <p className="sec-desc"><L
                zh={<>很多人对 Swift 的印象停在"iOS app 语言"。事实是，过去四年 Swift 在<strong>三条非 Apple 战线</strong>同时推进：空间计算 / 服务端 / WebAssembly。这一章讲为什么 Swift 走出了 macOS / iOS。</>}
                en={<>Many still think of Swift as "the iOS app language." In fact, Swift has pushed on <strong>three non-Apple fronts</strong> in the last four years: spatial computing, server-side, and WebAssembly. This chapter is why Swift broke out of macOS / iOS.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我们设计 Swift 时，目标不是"做下一个 Objective-C"——而是<strong>做一门可以从 microcontroller 跑到 server，从空间 UI 跑到 ML 推理</strong>的语言。Apple 平台只是它最先<em>立足</em>的地方，不是它的<em>边界</em>。</>}
                en={<>When we designed Swift, the goal was never "the next Objective-C." It was a language that <strong>runs from microcontrollers to servers, from spatial UI to ML inference</strong>. Apple platforms were where it first <em>stood up</em> — not its <em>boundary</em>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Chris Lattner</span>
                <span className="quote-context"><L zh="Swift 之父 · 后任 Modular CEO · 2023" en="Swift's creator · later Modular CEO · 2023" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">visionOS</div>
                <div className="ai-stat-h"><L zh="Apple 空间计算钦定语言" en="Apple's spatial-computing native tongue" /></div>
                <p><L
                  zh={<>2024 年 Vision Pro 出货同时把 visionOS 钉死在 Swift / SwiftUI / RealityKit 上——这是苹果第一次推出"<strong>从底层到 UI 全部 Swift</strong>"的平台，没有 Obj-C 兼容层。空间计算时代，Swift 是入场券。</>}
                  en={<>Vision Pro shipped in 2024 with visionOS pinned to Swift / SwiftUI / RealityKit — Apple's first platform that's <strong>Swift top to bottom</strong>, with no Obj-C compatibility layer. In spatial computing, Swift is the entry ticket.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">40<small>ms</small></div>
                <div className="ai-stat-h"><L zh="AWS Lambda 冷启动" en="AWS Lambda cold-start" /></div>
                <p><L
                  zh={<>Vapor / Hummingbird 加 SwiftNIO，Swift 在服务端正式立住。AWS 官方 Swift runtime 上一段函数冷启动 <strong>~40ms</strong>，比 Java 快 5 倍以上、内存占用只有一半。</>}
                  en={<>Vapor / Hummingbird atop SwiftNIO put Swift firmly on the server. On AWS's official Swift runtime, a function cold-starts in <strong>~40ms</strong> — over 5× faster than Java, on roughly half the memory.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">{'<200'}<small>KB</small></div>
                <div className="ai-stat-h"><L zh="Embedded Swift 二进制" en="Embedded Swift binary" /></div>
                <p><L
                  zh={<>Swift 6.2 的 Embedded 子集去掉 stdlib、去掉 ARC heap，二进制压到 <strong>200KB 以下</strong>，能直接编进 MCU 固件。AirPods、Watch、车机的部分固件已切到这条路。</>}
                  en={<>Swift 6.2's Embedded subset drops the stdlib and ARC heap, squeezing binaries below <strong>200KB</strong> — small enough for MCU firmware. AirPods, Watch and CarPlay firmware have already moved over.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>visionOS <span className="spotlight-meta">— <L zh="Apple 空间计算钦定栈" en="Apple's spatial-computing official stack" /></span></h3>
                  <p><L
                    zh={<>2024-02 出货的 Vision Pro 把整个空间计算平台钉在 Swift 上：UI 层是 SwiftUI（声明式 + result builder）、3D 层是 RealityKit（ECS 架构）、底层是 Metal（GPU 着色）——三层全 Swift API，没有 Obj-C / C++ 兼容路。</>}
                    en={<>Vision Pro, shipped Feb 2024, pins the whole spatial-computing platform on Swift: UI in SwiftUI (declarative + result builders), 3D in RealityKit (ECS), GPU in Metal — all three layers exposed only as Swift APIs, no Obj-C / C++ shim.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>SwiftUI</strong> — <L zh="同一份 View 代码自动适配空间环境" en="The same View code auto-adapts to spatial context" /></li>
                    <li><strong>RealityKit</strong> — <L zh="Swift 写实体 + 组件 + 系统" en="Swift entities + components + systems" /></li>
                    <li><strong>ARKit / Vision</strong> — <L zh="姿态识别 / 房间扫描 全 Swift API" en="Hand tracking, room scan — all Swift APIs" /></li>
                  </ul>
                  <p><L
                    zh={<>从 visionOS 这一步开始，<strong>"会写 Swift" 等价于 "能造苹果新平台的应用"</strong>。Obj-C 在这条赛道里彻底退场。</>}
                    en={<>From visionOS onward, <strong>"knowing Swift" is equivalent to "able to ship apps on Apple's newest platform"</strong>. Obj-C is fully out of this race.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// visionOS 空间窗口的最小例子" en="// A minimal spatial window in visionOS" /></span>{'\n'}
                    <span className="cl-k">import</span> <span className="cl-type">SwiftUI</span>{'\n'}
                    <span className="cl-k">import</span> <span className="cl-type">RealityKit</span>{'\n\n'}
                    <span className="cl-k">@main</span>{'\n'}
                    <span className="cl-k">struct</span> <span className="cl-type">SpatialApp</span>: <span className="cl-type">App</span> {'{'}{'\n'}
                    {'  '}<span className="cl-k">var</span> <span className="cl-v">body</span>: <span className="cl-k">some</span> <span className="cl-type">Scene</span> {'{'}{'\n'}
                    {'    '}<span className="cl-type">WindowGroup</span> {'{'}{'\n'}
                    {'      '}<span className="cl-type">RealityView</span> {'{ '}<span className="cl-v">content</span> <span className="cl-k">in</span>{'\n'}
                    {'        '}<span className="cl-k">if let</span> <span className="cl-v">model</span> = <span className="cl-k">try</span>? <span className="cl-k">await</span>{'\n'}
                    {'          '}<span className="cl-type">Entity</span>(<span className="cl-v">named</span>: <span className="cl-s">"Cube"</span>) {'{'}{'\n'}
                    {'          '}<span className="cl-v">content</span>.<span className="cl-fn">add</span>(<span className="cl-v">model</span>){'\n'}
                    {'        }'}{'\n'}
                    {'      }'}{'\n'}
                    {'    }'}.<span className="cl-fn">windowStyle</span>(.<span className="cl-prop">volumetric</span>){'\n'}
                    {'  }'}{'\n'}
                    {'}'}
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="Apple 工具链 / 服务端 — Swift 生态全景" en="Apple toolchain / server — the Swift ecosystem at a glance" /></h3>
              <div className="ai-tools-grid">
                {APPLE_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag">SERVER + WASM</div>
                <h3><L zh="Vapor + AWS Lambda" en="Vapor + AWS Lambda" /></h3>
                <p><L
                  zh={<>"用 Swift 写后端"曾经听起来像玩笑——直到 Apple 把 SwiftNIO 开源、AWS 加了官方 Lambda runtime。今天的服务端 Swift 已经是<strong>正经选项</strong>。</>}
                  en={<>"Server-side Swift" used to sound like a joke — until Apple open-sourced SwiftNIO and AWS shipped an official Lambda runtime. Today, server-side Swift is a <strong>legitimate option</strong>.</>}
                /></p>
                <p><L
                  zh={<>Vapor 提供 Web 框架，Hummingbird 走极简路线（适合 Lambda），SwiftNIO 是底层异步网络。一段 Swift Lambda 函数冷启动 ~40ms、内存占用只有 Java 的一半——和 Go / Rust 一个量级。</>}
                  en={<>Vapor is the full web framework; Hummingbird stays minimal (Lambda-friendly); SwiftNIO is the async-networking foundation. A Swift Lambda cold-starts in ~40ms on half the memory of Java — same league as Go / Rust.</>}
                /></p>
                <p><L
                  zh={<>+ <strong>SwiftWasm</strong>：Swift 6.2 把 WebAssembly 列为一等支持目标。结合 SwiftUI，未来"<em>一份 Swift 代码同时跑 iOS / macOS / 浏览器</em>"不再是科幻。</>}
                  en={<>+ <strong>SwiftWasm</strong>: Swift 6.2 elevates WebAssembly to first-class. Paired with SwiftUI, "<em>one Swift codebase across iOS, macOS and the browser</em>" stops being sci-fi.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// Vapor — 一段路由像写 SwiftUI" en="// Vapor — routes that read like SwiftUI" /></span>{'\n'}
                  <span className="cl-k">import</span> <span className="cl-type">Vapor</span>{'\n\n'}
                  <span className="cl-k">func</span> <span className="cl-fn">routes</span>(_ <span className="cl-v">app</span>: <span className="cl-type">Application</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-v">app</span>.<span className="cl-fn">get</span>(<span className="cl-s">"hello"</span>) {'{ '}<span className="cl-v">req</span> <span className="cl-k">async</span> -&gt; <span className="cl-type">String</span> <span className="cl-k">in</span>{'\n'}
                  {'    '}<span className="cl-s">"Hello, Swift on Server!"</span>{'\n'}
                  {'  }'}{'\n\n'}
                  {'  '}<span className="cl-v">app</span>.<span className="cl-fn">get</span>(<span className="cl-s">"users"</span>, <span className="cl-s">":id"</span>) {'{'}{'\n'}
                  {'    '}<span className="cl-v">req</span> <span className="cl-k">async throws</span> -&gt; <span className="cl-type">User</span> <span className="cl-k">in</span>{'\n'}
                  {'    '}<span className="cl-k">guard let</span> <span className="cl-v">id</span> = <span className="cl-v">req</span>.<span className="cl-prop">parameters</span>{'\n'}
                  {'      '}.<span className="cl-fn">get</span>(<span className="cl-s">"id"</span>, <span className="cl-v">as</span>: <span className="cl-type">UUID</span>.<span className="cl-k">self</span>) <span className="cl-k">else</span> {'{'}{'\n'}
                  {'      '}<span className="cl-k">throw</span> <span className="cl-type">Abort</span>(.<span className="cl-prop">badRequest</span>){'\n'}
                  {'    }'}{'\n'}
                  {'    '}<span className="cl-k">return try await</span> <span className="cl-type">User</span>.<span className="cl-fn">find</span>(<span className="cl-v">id</span>){'\n'}
                  {'  }'}{'\n'}
                  {'}'}
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结：" en="One-line summary: " /></strong><L
                zh={<>Swift 不再是"app 语言"。从 200KB 的 MCU 固件到 visionOS 的空间窗口、再到 AWS Lambda 上 40ms 冷启动的服务函数，Swift 在 2026 年是 Apple 第一次<strong>认真做的全栈语言</strong>——也是十年前 Lattner 立项时的初衷。</>}
                en={<>Swift is no longer "the app language." From 200KB MCU firmware to visionOS spatial windows to 40ms-cold-start AWS Lambdas, by 2026 Swift is Apple's first <strong>serious full-stack language</strong> — exactly what Lattner pitched a decade ago.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Kotlin / Obj-C" /> <code>: ThreePillars</code></h2>
              <p className="sec-desc"><L
                zh={<>选 Apple 平台开发语言时，<strong>Swift 替代了 Objective-C</strong>；Android 那边 Kotlin 替代了 Java。两条曲线几乎平行，下面三栏一目了然。</>}
                en={<>Picking a language for Apple-platform work: <strong>Swift replaced Objective-C</strong>; on the Android side, Kotlin replaced Java. The two arcs run in parallel — three columns make it crystal clear.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Objective-C</th>
                  <th className="th-ts">Swift</th>
                  <th className="th-ts">Kotlin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="发布年" en="First release" />,            oc: '1984',                                                  sw: '2014',                                       kt: '2011' },
                  { k: <L zh="主导厂商" en="Steward" />,                  oc: <L zh="NeXT / Apple" en="NeXT / Apple" />,                sw: 'Apple',                                       kt: 'JetBrains / Google' },
                  { k: <L zh="主战场" en="Primary platform" />,           oc: <L zh="老 macOS / iOS · 已淘汰" en="Legacy macOS / iOS · phasing out" />, sw: <L zh="Apple 全栈 + 服务端 + 嵌入式" en="Apple full stack + server + embedded" />, kt: <L zh="Android + 服务端 + 多平台" en="Android + server + multiplatform" /> },
                  { k: <L zh="类型系统" en="Type system" />,               oc: <L zh="动态 + C 静态" en="Dynamic + C static" />,         sw: <L zh="静态 + 类型推断 + Optional" en="Static + inference + Optionals" />, kt: <L zh="静态 + 类型推断 + nullable" en="Static + inference + nullables" /> },
                  { k: <L zh="内存管理" en="Memory" />,                    oc: <L zh="ARC（手动期约束多）" en="ARC (lots of manual care)" />, sw: <L zh="ARC + 静态借用" en="ARC + static borrowing" />, kt: <L zh="JVM GC（KMP 走 ARC）" en="JVM GC (KMP uses ARC)" /> },
                  { k: <L zh="nil 处理" en="nil handling" />,              oc: <L zh="发消息给 nil 静默成功" en="Sending msg to nil is silent" />, sw: <code>String?</code>,                       kt: <code>String?</code> },
                  { k: <L zh="并发模型" en="Concurrency" />,                oc: <L zh="GCD · 回调地狱" en="GCD · callback hell" />,        sw: <L zh="async/await + actor (语言级)" en="async/await + actor (language-level)" />, kt: <L zh="协程 (库)" en="Coroutines (library)" /> },
                  { k: <L zh="UI 框架" en="UI" />,                         oc: <L zh="UIKit / AppKit (命令式)" en="UIKit / AppKit (imperative)" />, sw: <L zh="SwiftUI (声明式 · 6 平台)" en="SwiftUI (declarative · 6 platforms)" />, kt: <L zh="Jetpack Compose (声明式)" en="Jetpack Compose (declarative)" /> },
                  { k: <L zh="可读性" en="Readability" />,                  oc: <L zh="方括号 + 长选择子" en="Brackets + long selectors" />, sw: <L zh="紧凑、像 Python / Rust 中间路线" en="Compact, between Python and Rust" />, kt: <L zh="紧凑、Java 后辈" en="Compact, Java's successor" /> },
                  { k: <L zh="性能档位" en="Performance" />,                oc: <L zh="C 级（手动调优后）" en="C-class (after manual tuning)" />, sw: <L zh="近 C，LLVM 后端" en="Near-C, LLVM backend" />, kt: <L zh="JVM 级（KMP/Native 接近 C）" en="JVM-class (KMP/Native near C)" /> },
                  { k: <L zh="跨平台" en="Cross-platform" />,                oc: <L zh="只 Apple" en="Apple only" />,                      sw: <L zh="Apple 全栈 + Linux / Windows / WASM" en="Apple stack + Linux / Windows / WASM" />, kt: <L zh="JVM + KMP (iOS / Android / 桌面)" en="JVM + KMP (iOS / Android / desktop)" /> },
                  { k: <L zh="新平台地位" en="On Apple's newest platform" />, oc: <L zh="visionOS 上没位置" en="No place on visionOS" />,    sw: <L zh="visionOS 钦定" en="visionOS native" />, kt: <L zh="不适用" en="N/A" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.oc}</td>
                    <td>{row.sw}</td>
                    <td>{row.kt}</td>
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
                zh={<>2025-09 的 Swift 6.2 把语言推向"真正全栈"。下一步是嵌入式 + 服务端 + WASM 三线收口，再借 Apple 平台发新硬件的契机往外扩。</>}
                en={<>Swift 6.2 (Sept 2025) pushed the language to "truly full-stack." Next: tighten the embedded / server / WASM trio, then ride Apple's new-hardware launches to expand further.</>}
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
                <li><a href="https://www.swift.org" target="_blank" rel="noopener">swift.org</a></li>
                <li><a href="https://docs.swift.org/swift-book/" target="_blank" rel="noopener"><L zh="官方语言指南" en="The Swift Book" /></a></li>
                <li><a href="https://github.com/apple/swift" target="_blank" rel="noopener">apple/swift · GitHub</a></li>
                <li><a href="https://developer.apple.com/swift/" target="_blank" rel="noopener">developer.apple.com / swift</a></li>
                <li><a href="https://www.swift.org/blog/" target="_blank" rel="noopener"><L zh="Swift 官方博客" en="Swift blog" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://github.com/swiftlang/swift-evolution" target="_blank" rel="noopener">Swift Evolution Proposals</a></li>
                <li><a href="https://www.swift.org/documentation/articles/embedded-swift.html" target="_blank" rel="noopener">Embedded Swift</a></li>
                <li><a href="https://developer.apple.com/wwdc24/" target="_blank" rel="noopener">WWDC 2024 · Swift 6</a></li>
                <li><a href="https://swiftpackageindex.com" target="_blank" rel="noopener">Swift Package Index</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 服务端" en="Ecosystem / Server" /></h4>
              <ul>
                <li><a href="https://vapor.codes" target="_blank" rel="noopener">Vapor</a></li>
                <li><a href="https://hummingbird.codes" target="_blank" rel="noopener">Hummingbird</a></li>
                <li><a href="https://github.com/apple/swift-nio" target="_blank" rel="noopener">SwiftNIO</a></li>
                <li><a href="https://swiftwasm.org" target="_blank" rel="noopener">SwiftWasm</a></li>
                <li><a href="https://www.swiftbysundell.com" target="_blank" rel="noopener">Swift by Sundell</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="Apple 平台 SDK" en="Apple SDKs" /></h4>
              <ul>
                <li><a href="https://developer.apple.com/xcode/swiftui/" target="_blank" rel="noopener">SwiftUI</a></li>
                <li><a href="https://developer.apple.com/visionos/" target="_blank" rel="noopener">visionOS</a></li>
                <li><a href="https://developer.apple.com/documentation/realitykit" target="_blank" rel="noopener">RealityKit</a></li>
                <li><a href="https://developer.apple.com/documentation/coreml" target="_blank" rel="noopener">Core ML</a></li>
                <li><a href="https://github.com/ml-explore/mlx" target="_blank" rel="noopener">MLX</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{SWIFT_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`let future: some FullStack = await ecosystem`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
