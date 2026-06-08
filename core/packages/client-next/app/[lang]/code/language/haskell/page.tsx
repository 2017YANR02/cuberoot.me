'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './haskell_intro.css';
import i18n from '@/i18n/i18n-client';

/* Inline logo: the angle-arrow >λ= mark.
   No external assets — drawn from primitives only. */
const HASKELL_LOGO_SVG = (
  <svg viewBox="0 0 320 240">
    <defs>
      <linearGradient id="hs-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9D88D9" />
        <stop offset="100%" stopColor="#3D3258" />
      </linearGradient>
      <linearGradient id="hs-lambda" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#E0C8FF" />
        <stop offset="100%" stopColor="#5E5086" />
      </linearGradient>
    </defs>
    <rect width="320" height="240" rx="28" fill="url(#hs-grad)" />
    {/* the > stroke */}
    <path d="M30 30 L100 120 L30 210" stroke="url(#hs-lambda)" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    {/* the λ */}
    <path d="M110 30 L210 210" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
    <path d="M180 30 L120 150" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
    {/* the = (two parallel bars) */}
    <line x1="220" y1="110" x2="290" y2="110" stroke="#E0C8FF" strokeWidth="14" strokeLinecap="round" />
    <line x1="220" y1="150" x2="290" y2="150" stroke="#E0C8FF" strokeWidth="14" strokeLinecap="round" />
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
    year: '1985',
    zh: { title: <>Miranda 发布 — 前史</>, desc: <>David Turner 在 Kent 大学发布 <strong>Miranda</strong>: 惰性、纯函数、ML-风类型推断。1980 年代有<em>太多</em>类似的研究语言 (Miranda / Lazy ML / Orwell / Ponder / Alfl), 大家彼此重抄, 但<strong>互不兼容</strong>。整个学术圈意识到需要一门标准的、可以拿来教学和写论文的<strong>纯惰性 FP 语言</strong>。</> },
    en: { title: <>Miranda ships — the pre-history</>, desc: <>David Turner at Kent ships <strong>Miranda</strong>: lazy, pure, ML-style type inference. The 1980s had <em>too many</em> research languages of this shape (Miranda / Lazy ML / Orwell / Ponder / Alfl). They cross-pollinated heavily but <strong>could not share code</strong>. Academia realises it needs one standard <strong>pure-lazy functional language</strong> to teach, paper-share, and build on.</> },
  },
  {
    year: <>1987<small>·09</small></>, highlight: true,
    zh: { title: <>FPCA Portland — 委员会成立</>, desc: <>在 Portland 召开的 <strong>Functional Programming Languages &amp; Computer Architecture</strong> 会议上, 一群研究者 (Peyton Jones, Wadler, Hudak, Hammond, Augustsson...) 当场组了委员会, 任务: <strong>设计一门统一的开源纯惰性函数语言</strong>。命名以 <strong>Haskell Curry</strong> (组合逻辑奠基人, 1900-1982) 致敬。<em>历史上少有的"由委员会设计且没毁掉"的语言</em>。</> },
    en: { title: <>FPCA Portland — a committee is formed</>, desc: <>At the <strong>Functional Programming Languages &amp; Computer Architecture</strong> conference in Portland, a group of researchers (Peyton Jones, Wadler, Hudak, Hammond, Augustsson...) form a committee on the spot. The mission: <strong>design one unified, open, pure-lazy functional language</strong>. They name it after <strong>Haskell Curry</strong> (combinatory-logic founder, 1900-1982). <em>One of the rare "designed by committee" languages that didn't end in disaster</em>.</> },
  },
  {
    year: '1990',
    zh: { title: <>Haskell 1.0 发布</>, desc: <>正式 1.0 报告发布。早期版本曾叫 <strong>Haskell B</strong> (B 取自 Brouwer, 直觉主义逻辑学家), 后来去掉后缀。1.0 已经定下今天还在用的核心: <strong>type classes</strong> (Wadler 1989 设计)、ADT、模式匹配、惰性求值。<em>"用一门语言, 既能教编译原理, 又能教类型理论, 又能跑测试程序"</em>。</> },
    en: { title: <>Haskell 1.0 ships</>, desc: <>The formal 1.0 report appears. Early drafts were called <strong>Haskell B</strong> (B for Brouwer, the intuitionistic logician), the suffix later dropped. 1.0 already nails the core that survives today: <strong>type classes</strong> (Wadler's 1989 design), ADTs, pattern matching, lazy evaluation. <em>"One language that teaches compilers, type theory and runs real programs"</em>.</> },
  },
  {
    year: '1992',
    zh: { title: <>GHC 在 Glasgow 启动</>, desc: <>Simon Peyton Jones 和 Will Partain 在 Glasgow 启动 <strong>Glasgow Haskell Compiler</strong>。最早是研究编译器, 后来变成<strong>事实上的唯一实现</strong>——其它编译器 (HBC / nhc98 / yhc / UHC) 都被它压住, 接下来 30 年 GHC ≈ Haskell。</> },
    en: { title: <>GHC starts at Glasgow</>, desc: <>Simon Peyton Jones and Will Partain start the <strong>Glasgow Haskell Compiler</strong> in Glasgow. Begins as a research compiler, becomes <strong>the de-facto only implementation</strong> — every other compiler (HBC / nhc98 / yhc / UHC) is eclipsed. For the next 30 years, GHC ≈ Haskell.</> },
  },
  {
    year: '1992',
    zh: { title: <>Wadler 引入 monads</>, desc: <>Philip Wadler 把 <strong>Eugenio Moggi 1989</strong> 那篇 <em>"Notions of Computation and Monads"</em> 范畴论结构搬进函数式编程, 用来给纯语言加 IO / state / 异常 / 非确定性, 而<strong>不破坏 referential transparency</strong>。<strong>monad 此后成为 Haskell 的招牌</strong>; 也是它最被外人误读的概念。</> },
    en: { title: <>Wadler brings monads in</>, desc: <>Philip Wadler ports <strong>Eugenio Moggi's 1989</strong> paper <em>"Notions of Computation and Monads"</em> — a category-theoretic structure — into FP, using it to add IO / state / exceptions / non-determinism to a pure language <strong>without breaking referential transparency</strong>. <strong>Monads become Haskell's signature</strong>, and the concept most outsiders misread.</> },
  },
  {
    year: '1998',
    zh: { title: <>Haskell 98 — 第一份"稳定"标准</>, desc: <>委员会冻结一个版本叫 <strong>Haskell 98</strong>: <em>"教学和工业都能引用"</em>。之前每年都有改, 现在停了。从 1998 到 2010 整整 12 年, Haskell 98 是唯一公开标准——尽管 GHC 早已加了一堆扩展跑在 <code>{`{-# LANGUAGE ... #-}`}</code> 后面。</> },
    en: { title: <>Haskell 98 — the first "stable" standard</>, desc: <>The committee freezes a version called <strong>Haskell 98</strong>: <em>"a citation point for teaching and industry"</em>. After yearly revisions, the spec finally stops moving. For 12 years, 1998 → 2010, Haskell 98 is the only public standard — even as GHC pile on extensions behind <code>{`{-# LANGUAGE ... #-}`}</code> pragmas.</> },
  },
  {
    year: '2003',
    zh: { title: <>Pandoc · Xmonad — 走出学界</>, desc: <>三个项目让 Haskell 从纯学术语言变成"<strong>有人用它做真东西</strong>": John MacFarlane 写的 <strong>Pandoc</strong> (通用文档转换器, 后来成行业标配)、<strong>Xmonad</strong> (tiling 窗口管理器, &lt;1000 行)、<strong>Darcs</strong> (分布式 VCS)。从这里 Haskell 开始有"<em>能写出小而精的工具</em>"的口碑。</> },
    en: { title: <>Pandoc · Xmonad — out of academia</>, desc: <>Three projects move Haskell from pure-academic to "<strong>someone is actually shipping with this</strong>": John MacFarlane's <strong>Pandoc</strong> (universal document converter, soon an industry default), <strong>Xmonad</strong> (a tiling WM in &lt;1000 lines), and <strong>Darcs</strong> (a distributed VCS). The reputation as "<em>a language for small, precise tools</em>" starts here.</> },
  },
  {
    year: <>2007<small>·04</small></>, highlight: true,
    zh: { title: <>SPJ: "Avoid success at all costs"</>, desc: <>Simon Peyton Jones 在演讲里说了那句被反复引用、又被反复误读的名言: <strong>"<em>Avoid success at all costs</em>"</strong>。它的原意不是"别成功", 而是<strong>"别为了流行而牺牲研究目标"</strong>——保留破坏性变更的自由、保留语言演化的实验空间。<em>整门语言的气质由这一句确立</em>。</> },
    en: { title: <>SPJ: "Avoid success at all costs"</>, desc: <>Simon Peyton Jones drops the quote that gets repeated and misread forever: <strong>"<em>Avoid success at all costs</em>"</strong>. The real meaning is not "shun success" — it is <strong>"don't sacrifice the research agenda for popularity"</strong>: keep the freedom to break things, keep the space to experiment with the language. <em>That single line shapes the personality of the whole project</em>.</> },
  },
  {
    year: '2010',
    zh: { title: <>Haskell 2010 标准</>, desc: <>第二份标准: 把过去十几年最稳的几个 GHC 扩展 (FFI、空数据声明、hierarchical modules、do-and-if-then-else 语法松绑) 收编进来。<em>"小步, 慢, 稳"——这是 Haskell 标准化的标志节奏</em>; Haskell 2020 启动过, 但没出过定稿。</> },
    en: { title: <>Haskell 2010 standard</>, desc: <>The second standard: folds in the most stable GHC extensions of the prior decade (FFI, empty data decls, hierarchical modules, looser do/if-then-else syntax). <em>"Small steps, slow, stable" — this is the Haskell pace of standardisation</em>. A Haskell 2020 effort was opened but never finalised.</> },
  },
  {
    year: '2014',
    zh: { title: <>Stackage / Stack — 终于有靠谱构建</>, desc: <>FPComplete 推出 <strong>Stackage</strong> (一组经过同时间编译验证的包集合) + <strong>Stack</strong> 工具。<strong>"Cabal 地狱"的时代结束</strong>: 不同包之间 dependency hell 一直是 Haskell 入门的最大门槛, 这是第一个工业级解决方案。<em>Haskell 工具链历史的转折点</em>。</> },
    en: { title: <>Stackage / Stack — finally a sane build</>, desc: <>FPComplete ships <strong>Stackage</strong> (a coherently-compiled set of packages) and the <strong>Stack</strong> tool. <strong>The "Cabal hell" era ends</strong>: dependency hell had been Haskell's biggest onboarding wall, and this is its first industrial fix. <em>The turning point in Haskell's tooling history</em>.</> },
  },
  {
    year: '2017',
    zh: { title: <>Cardano 选 Haskell</>, desc: <>Charles Hoskinson 创立 <strong>IOHK / Input Output</strong>, 把 <strong>Cardano 区块链</strong>的核心用 Haskell 写——理由是<strong>"形式化验证友好"</strong>。这是 Haskell 第一次有<em>真正大规模商业项目</em>下注: 数百万行 Haskell 跑在生产链上, 智能合约用 <strong>Plutus</strong> (Haskell 子集) 写。<em>不管你怎么看 Cardano, 它把 Haskell 推上了 fintech / 区块链的版图</em>。</> },
    en: { title: <>Cardano picks Haskell</>, desc: <>Charles Hoskinson founds <strong>IOHK / Input Output</strong> and builds the <strong>Cardano blockchain</strong> in Haskell — chosen for <strong>"formal-verification friendliness"</strong>. The first <em>genuinely large commercial bet</em> on Haskell: millions of lines on a production chain, smart contracts in <strong>Plutus</strong> (a Haskell subset). <em>Whatever you think of Cardano, it puts Haskell on the fintech / crypto map</em>.</> },
  },
  {
    year: '2021', highlight: true,
    zh: { title: <>GHC 9.0 — Linear Types 进入 stdlib</>, desc: <>2021 年的 GHC 9.0 把 <strong>linear types</strong> (来自 Tweag 主导的 Linear Haskell 论文) 进了主线。<code>{`a %1 -> b`}</code> 语法表示函数<strong>必须 exactly once</strong> 使用参数——和 Rust 的 borrow 是<em>同一个理论问题, 不同实现</em>。Haskell 类型系统再一次走到工业语言<em>前面</em>。</> },
    en: { title: <>GHC 9.0 — Linear types in the main line</>, desc: <>GHC 9.0 lands <strong>linear types</strong> (from Tweag's Linear Haskell paper) in the main compiler. The syntax <code>{`a %1 -> b`}</code> says the function <strong>must use the argument exactly once</strong> — the same theoretical problem Rust's borrow checker solves, with a <em>different implementation</em>. Haskell's type system, once again, lands a feature <em>ahead</em> of mainstream industrial languages.</> },
  },
  {
    year: '2023',
    zh: { title: <>SPJ → Epic Games / Verse</>, desc: <>Simon Peyton Jones 从 Microsoft Research Cambridge (待了 22 年) 退休, 加入 <strong>Epic Games</strong> 设计 <strong>Verse</strong>——Fortnite 元宇宙的 dependently-typed FP 语言。SPJ 称之为"<em>把 Haskell 学到的所有东西放进游戏引擎</em>"。Haskell 影响开始<strong>具体地外溢</strong>: 不只是抽象继承, 是同一个设计师亲手在做下一步。</> },
    en: { title: <>SPJ → Epic Games / Verse</>, desc: <>Simon Peyton Jones retires from Microsoft Research Cambridge (after 22 years) and joins <strong>Epic Games</strong> to design <strong>Verse</strong> — a dependently-typed FP language for Fortnite's metaverse. He describes it as "<em>everything I learned from Haskell, in a game engine</em>". Haskell's influence spills outward <strong>concretely</strong>: not just inheritance through ideas, but the same designer building the next step.</> },
  },
  {
    year: '2024',
    zh: { title: <>GHC 9.10 — Dependent types 的开胃菜</>, desc: <>2024 年的 GHC 9.10 推进 <strong>visible forall</strong> 和 <strong>type-level abstractions</strong>: <em>朝 dependent types 又走一格</em>。Haskell 不会一夜变成 Agda/Idris, 但<strong>singletons + GADTs + type families</strong> 已经能在生产里做出"<em>类型层的小证明</em>"。语言形态仍在演化, 36 年没停。</> },
    en: { title: <>GHC 9.10 — appetiser for dependent types</>, desc: <>GHC 9.10 (2024) ships <strong>visible forall</strong> and stronger <strong>type-level abstraction</strong>: <em>one step closer to dependent types</em>. Haskell won't become Agda/Idris overnight, but <strong>singletons + GADTs + type families</strong> already let production code prove "<em>small theorems at the type level</em>". The language is still moving after 36 years.</> },
  },
  {
    year: '2026',
    zh: { title: <>36 岁, 仍是类型系统实验室</>, desc: <>2026 的 Haskell: <strong>没爆款, 没死, 也没改性格</strong>。Pandoc 仍然是 markdown 转换的事实标准; Cardano / Standard Chartered / Mercury / Tweag 等仍在生产里跑大量 Haskell; <strong>Pandoc + Stackage + cabal-install 的组合稳定运转</strong>。它没成为 Rust 那种工业新宠, 也没像 Lisp 那样退守教室——它<strong>就是函数式编程的 reference 实现</strong>, 一门<em>影响所有人但自己不必爆款</em>的语言。</> },
    en: { title: <>36 years in — still the type-system lab</>, desc: <>Haskell in 2026: <strong>no breakout hit, not dead, hasn't changed its personality</strong>. Pandoc is still the de-facto markdown converter; Cardano / Standard Chartered / Mercury / Tweag still run huge production Haskell; <strong>Pandoc + Stackage + cabal-install just works</strong>. It isn't Rust's industrial darling and it isn't Lisp's classroom-only retreat — Haskell <strong>is the reference implementation of functional programming</strong>, a language that <em>influences everyone without needing to be the breakout</em>.</> },
  },
];

interface HsCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const HS_CARDS: HsCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>::</code> — 类型签名先行</>, desc: <>Haskell 的<strong>第一行通常是类型, 不是代码</strong>。<code>::</code> 念作 "has type"。看类型已经能猜实现——这是"<em>类型驱动开发</em>"的母语。</> },
    en: { title: <><code>::</code> — type signature first</>, desc: <>The <strong>first line of a Haskell definition is usually its type, not its code</strong>. <code>::</code> reads "has type". You can often guess the implementation from the type — Haskell is the native tongue of <em>type-driven development</em>.</> },
    code: (
      <code>
        <span className="cl-fn">map</span> :: (<span className="cl-type">a</span> -&gt; <span className="cl-type">b</span>) -&gt; [<span className="cl-type">a</span>] -&gt; [<span className="cl-type">b</span>]{'\n'}
        <span className="cl-fn">map</span> _ []     = []{'\n'}
        <span className="cl-fn">map</span> f (x:xs) = f x : <span className="cl-fn">map</span> f xs
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>data</code> + 模式匹配 — ADT 在主流前 20 年</>, desc: <>代数数据类型 (ADT) + 模式匹配是 Haskell 的<strong>基本句法</strong>。比 Rust 的 <code>enum</code> 早 20 年, 比 Swift 的 <code>enum</code> 早 25 年, 比 TS 的 discriminated union 早 30 年。</> },
    en: { title: <><code>data</code> + pattern matching — ADTs, 20 years before the mainstream</>, desc: <>Algebraic data types + pattern matching are Haskell's <strong>basic syntax</strong>. They predate Rust's <code>enum</code> by 20 years, Swift's <code>enum</code> by 25, TypeScript's discriminated unions by 30.</> },
    code: (
      <code>
        <span className="cl-k">data</span> <span className="cl-type">Tree</span> a = <span className="cl-type">Leaf</span> | <span className="cl-type">Node</span> (<span className="cl-type">Tree</span> a) a (<span className="cl-type">Tree</span> a){'\n\n'}
        <span className="cl-fn">depth</span> :: <span className="cl-type">Tree</span> a -&gt; <span className="cl-type">Int</span>{'\n'}
        <span className="cl-fn">depth</span> <span className="cl-type">Leaf</span>         = <span className="cl-n">0</span>{'\n'}
        <span className="cl-fn">depth</span> (<span className="cl-type">Node</span> l _ r) = <span className="cl-n">1</span> + <span className="cl-fn">max</span> (<span className="cl-fn">depth</span> l) (<span className="cl-fn">depth</span> r)
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>class</code> — type classes</>, desc: <>Wadler 1989 的发明。一段定义说"<em>任何 a 只要满足 X 就能用</em>"。<strong>Rust 的 <code>trait</code>、Swift 的 <code>protocol</code>、Scala 的 implicit、Java 8 的 default method 全是它的后代</strong>。</> },
    en: { title: <><code>class</code> — type classes</>, desc: <>Wadler's 1989 invention. A definition that says "<em>any a works as long as it satisfies X</em>". <strong>Rust's <code>trait</code>, Swift's <code>protocol</code>, Scala's implicits, Java 8's default methods are all its descendants</strong>.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Eq</span> a <span className="cl-k">where</span>{'\n'}
        {'  '}(==) :: a -&gt; a -&gt; <span className="cl-type">Bool</span>{'\n\n'}
        <span className="cl-k">instance</span> <span className="cl-type">Eq</span> <span className="cl-type">Int</span> <span className="cl-k">where</span>{'\n'}
        {'  '}x == y = <span className="cl-fn">primIntEq</span> x y
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>List comprehension</>, desc: <>语法直接抄自<strong>数学的集合记号</strong>: <code>{`{ x² | x ∈ ℕ, x < 10 }`}</code>。Python 后来照抄了, 但 Haskell 是<em>把数学写到代码里这件事的源头</em>。</> },
    en: { title: <>List comprehensions</>, desc: <>The syntax is lifted directly from <strong>mathematical set-builder notation</strong>: <code>{`{ x² | x ∈ ℕ, x < 10 }`}</code>. Python later copied it, but Haskell is the <em>origin of writing maths-into-code</em>.</> },
    code: (
      <code>
        <span className="cl-fn">primes</span> = <span className="cl-fn">sieve</span> [<span className="cl-n">2</span>..]{'\n'}
        {'  '}<span className="cl-k">where</span>{'\n'}
        {'    '}<span className="cl-fn">sieve</span> (p:xs) ={'\n'}
        {'      '}p : <span className="cl-fn">sieve</span> [x | x &lt;- xs, x `<span className="cl-fn">mod</span>` p /= <span className="cl-n">0</span>]
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>Maybe</code> / <code>Either</code> — 没有 null</>, desc: <>"没找到" 用 <code>Maybe a</code> 表达, "出错了" 用 <code>Either e a</code> 表达。<strong>类型系统强制你处理两种情况</strong>。Tony Hoare 的 "billion-dollar mistake" 在 Haskell 里从来没存在过。</> },
    en: { title: <><code>Maybe</code> / <code>Either</code> — no null</>, desc: <>"Not found" is encoded as <code>Maybe a</code>, "failed" as <code>Either e a</code>. <strong>The type system makes you handle both arms</strong>. Tony Hoare's "billion-dollar mistake" never existed in Haskell.</> },
    code: (
      <code>
        <span className="cl-k">data</span> <span className="cl-type">Maybe</span> a = <span className="cl-type">Nothing</span> | <span className="cl-type">Just</span> a{'\n\n'}
        <span className="cl-fn">lookup</span> :: <span className="cl-type">Eq</span> k =&gt; k -&gt; [(k,v)] -&gt; <span className="cl-type">Maybe</span> v{'\n'}
        <span className="cl-fn">lookup</span> _ []          = <span className="cl-type">Nothing</span>{'\n'}
        <span className="cl-fn">lookup</span> k ((k',v):xs){'\n'}
        {'  '}| k == k'  = <span className="cl-type">Just</span> v{'\n'}
        {'  '}| <span className="cl-k">otherwise</span> = <span className="cl-fn">lookup</span> k xs
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>do</code> notation — 不止 IO</>, desc: <><code>do</code> 是 <strong>monad 的语法糖</strong>。它<em>不是 "命令式语句块"</em>——它是把 <code>(&gt;&gt;=)</code> 写得像命令式而已。同一个 <code>do</code> 模板能写 IO、Maybe、State、Parser、List。</> },
    en: { title: <><code>do</code> notation — not just IO</>, desc: <><code>do</code> is <strong>syntactic sugar for monads</strong>. It is <em>not</em> an "imperative block" — it just makes <code>(&gt;&gt;=)</code> read imperatively. The same <code>do</code> template covers IO, Maybe, State, Parser, List.</> },
    code: (
      <code>
        <span className="cl-fn">main</span> :: <span className="cl-type">IO</span> (){'\n'}
        <span className="cl-fn">main</span> = <span className="cl-k">do</span>{'\n'}
        {'  '}name &lt;- <span className="cl-fn">getLine</span>{'\n'}
        {'  '}<span className="cl-fn">putStrLn</span> (<span className="cl-s">"hi, "</span> ++ name){'\n'}
        {'  '}<span className="cl-fn">writeFile</span> <span className="cl-s">"log"</span> name
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>惰性求值 — <code>take 10 [1..]</code></>, desc: <>Haskell 默认<strong>每个表达式都是 thunk</strong>, 用到才算。这让<em>无穷列表 / 自引用结构 / 短路控制流</em>变成普通操作——<strong>但也是性能 bug 的母矿</strong>。当代 Haskell 提倡按需选用 <code>BangPatterns</code> / <code>StrictData</code>。</> },
    en: { title: <>Lazy evaluation — <code>take 10 [1..]</code></>, desc: <>By default <strong>every expression is a thunk</strong>, evaluated only when needed. That makes <em>infinite lists / self-referential structures / short-circuit control flow</em> ordinary — <strong>but it is also the source mine of perf bugs</strong>. Modern Haskell picks strictness deliberately with <code>BangPatterns</code> / <code>StrictData</code>.</> },
    code: (
      <code>
        <span className="cl-fn">fibs</span> :: [<span className="cl-type">Int</span>]{'\n'}
        <span className="cl-fn">fibs</span> = <span className="cl-n">0</span> : <span className="cl-n">1</span> : <span className="cl-fn">zipWith</span> (+) fibs (<span className="cl-fn">tail</span> fibs){'\n\n'}
        <span className="cl-c">-- self-reference + laziness</span>{'\n'}
        <span className="cl-fn">take</span> <span className="cl-n">10</span> fibs   <span className="cl-c">-- [0,1,1,2,3,5,8,13,21,34]</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Parser combinators</>, desc: <>不需要外部 parser generator (yacc/bison/antlr) ——<strong>parser 是值, 用函数组合写</strong>。Parsec / megaparsec 让<em>"一个生产级 parser ≤ 200 行"</em>变成常态。这一思路后来传到 nom (Rust) / parsy (Python) / fp-ts。</> },
    en: { title: <>Parser combinators</>, desc: <>No external parser generator (yacc/bison/antlr) needed — <strong>parsers are values, combined with functions</strong>. Parsec / megaparsec make <em>"a production-grade parser in ≤ 200 lines"</em> the norm. The idea later propagated to nom (Rust), parsy (Python), fp-ts.</> },
    code: (
      <code>
        <span className="cl-fn">number</span> :: <span className="cl-type">Parser</span> <span className="cl-type">Int</span>{'\n'}
        <span className="cl-fn">number</span> = <span className="cl-fn">read</span> &lt;$&gt; <span className="cl-fn">some</span> <span className="cl-fn">digit</span>{'\n\n'}
        <span className="cl-fn">pair</span> :: <span className="cl-type">Parser</span> (<span className="cl-type">Int</span>, <span className="cl-type">Int</span>){'\n'}
        <span className="cl-fn">pair</span> = (,) &lt;$&gt; number &lt;* <span className="cl-fn">char</span> <span className="cl-s">','</span>{'\n'}
        {'         '}&lt;*&gt; number
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
    icon: 'λ',
    zh: { title: <>类型说真话</>, desc: <>Haskell 的类型签名<strong>无副作用泄漏</strong>: 看到 <code>Int -&gt; Int</code> 就知道这函数<em>什么都不能做</em>除了纯计算。IO 必须出现在类型里, 想偷偷写日志? <strong>类型系统不让你</strong>。</> },
    en: { title: <>Types tell the truth</>, desc: <>Haskell type signatures <strong>can't hide side effects</strong>: a <code>Int -&gt; Int</code> can do <em>nothing</em> but pure computation. IO must show up in the type. Want to sneak a log in? <strong>The type system says no</strong>.</> },
    code: <><span className="cl-fn">add</span> :: <span className="cl-type">Int</span> -&gt; <span className="cl-type">Int</span> -&gt; <span className="cl-type">Int</span>{'\n'}<span className="cl-c">-- cannot do IO, cannot mutate, cannot throw</span></>,
  },
  {
    icon: '∀',
    zh: { title: <>"Theorems for free"</>, desc: <>Wadler 1989 论文标题。函数类型签名足够通用时, <strong>类型唯一决定行为</strong>: <code>{`forall a. [a] -> [a]`}</code> 只可能是 reverse / id / take 之类——<em>类型本身就在证明定理</em>。这是 Haskell 类型系统的本垒打。</> },
    en: { title: <>"Theorems for free"</>, desc: <>The title of Wadler's 1989 paper. When a type is general enough, <strong>the type uniquely determines the behaviour</strong>: <code>{`forall a. [a] -> [a]`}</code> can only be reverse / id / take. <em>The type signature itself proves a theorem</em>. This is Haskell's type-system home run.</> },
    code: <><span className="cl-fn">reverse</span> :: <span className="cl-k">forall</span> a. [a] -&gt; [a]{'\n'}<span className="cl-c">-- the type forbids depending on element values</span></>,
  },
  {
    icon: '⊕',
    zh: { title: <>Monads — 副作用作为<em>值</em></>, desc: <>IO / state / 异常 / 异步 / 解析 都被同一个抽象 (Monad) 统一。<strong>"做 IO" 不是一个动作, 是构造一个 IO 值, 由 runtime 在外层执行</strong>。这让<em>纯计算和效果可以放进同一个函数</em>而不互染。</> },
    en: { title: <>Monads — effects as <em>values</em></>, desc: <>IO / state / exceptions / async / parsing all live under one abstraction (Monad). <strong>"Doing IO" isn't an action — it's building an IO value, which the runtime executes at the edge</strong>. So <em>pure code and effects share one function</em> without contaminating each other.</> },
    code: <><span className="cl-fn">readBoth</span> :: <span className="cl-type">IO</span> (<span className="cl-type">String</span>, <span className="cl-type">String</span>){'\n'}<span className="cl-fn">readBoth</span> = (,) &lt;$&gt; <span className="cl-fn">readFile</span> <span className="cl-s">"a"</span>{'\n'}{'             '}&lt;*&gt; <span className="cl-fn">readFile</span> <span className="cl-s">"b"</span></>,
  },
  {
    icon: '≡',
    zh: { title: <>Referential transparency</>, desc: <>同一个表达式 <em>无论何时何地</em> 求值都给同一结果。这意味着<strong>测试天然好写、并行天然安全、refactor 不会引入隐性 bug</strong>。React 的 <code>useState</code> 心智模型、Redux 的 reducer 都<em>抄自这个性质</em>。</> },
    en: { title: <>Referential transparency</>, desc: <>The same expression yields the same value <em>any time, anywhere</em>. So <strong>tests are trivially writable, parallelism is safe by default, refactors don't ship hidden bugs</strong>. React's <code>useState</code> mental model and Redux reducers are <em>copies of this property</em>.</> },
    code: <><span className="cl-c">-- safe to memoise, safe to parallelise:</span>{'\n'}<span className="cl-fn">sum</span> [<span className="cl-n">1</span>..<span className="cl-n">1000000</span>] <span className="cl-c">-- always 500000500000</span></>,
  },
  {
    icon: '∇',
    zh: { title: <>GHC — 一个研究编译器, 同时是工业编译器</>, desc: <>GHC 30 年里既是类型系统研究的<strong>实验台</strong> (linear types / type families / GADTs / dependent-types 前驱), 又能编译 Pandoc / Cardano 这类生产代码。<em>很少有语言能在两边都站住</em>。</> },
    en: { title: <>GHC — research compiler and industrial compiler</>, desc: <>GHC has been both <strong>a 30-year type-system research lab</strong> (linear types, type families, GADTs, dependent-type precursors) and the production compiler behind Pandoc / Cardano. <em>Few languages stand on both legs</em>.</> },
    code: <><span className="cl-c">-- the same compiler runs:</span>{'\n'}<span className="cl-c">-- · a dependent-typed PhD thesis</span>{'\n'}<span className="cl-c">-- · Standard Chartered's exotic derivatives book</span></>,
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
    href: 'https://pandoc.org', highlight: true,
    zhName: 'Pandoc', enName: 'Pandoc',
    zhNote: '通用文档转换器 · John MacFarlane', enNote: 'Universal doc converter · John MacFarlane',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#3D3258"/><path d="M30 24 H58 L74 40 V76 H30 Z" fill="none" stroke="#E0C8FF" strokeWidth="4" strokeLinejoin="round"/><path d="M58 24 V40 H74" fill="none" stroke="#E0C8FF" strokeWidth="4"/><text x="50" y="68" textAnchor="middle" fill="#9D88D9" fontSize="14" fontWeight="700" fontFamily="monospace">P</text></svg>,
  },
  {
    href: 'https://cardano.org', highlight: true,
    zhName: 'Cardano', enName: 'Cardano',
    zhNote: '区块链 · 数百万行 Haskell · IOHK', enNote: 'Blockchain · millions of LOC · IOHK',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0033AD"/><g fill="#fff"><circle cx="50" cy="22" r="3"/><circle cx="50" cy="78" r="3"/><circle cx="28" cy="35" r="3"/><circle cx="72" cy="35" r="3"/><circle cx="28" cy="65" r="3"/><circle cx="72" cy="65" r="3"/><circle cx="20" cy="50" r="3"/><circle cx="80" cy="50" r="3"/><circle cx="50" cy="50" r="4"/></g></svg>,
  },
  {
    href: 'https://xmonad.org',
    zhName: 'Xmonad', enName: 'Xmonad',
    zhNote: 'Tiling 窗口管理器 · <1000 行', enNote: 'Tiling WM · <1000 LOC',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1530"/><rect x="20" y="20" width="26" height="26" fill="none" stroke="#9D88D9" strokeWidth="3"/><rect x="54" y="20" width="26" height="26" fill="none" stroke="#9D88D9" strokeWidth="3"/><rect x="20" y="54" width="26" height="26" fill="none" stroke="#9D88D9" strokeWidth="3"/><rect x="54" y="54" width="26" height="26" fill="#9D88D9"/></svg>,
  },
  {
    href: 'https://github.com/facebook/Haxl',
    zhName: 'Haxl · Meta Sigma', enName: 'Haxl · Meta Sigma',
    zhNote: '反垃圾邮件 · Meta 生产用', enNote: 'Anti-abuse · Meta production',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1877F2"/><text x="50" y="60" textAnchor="middle" fill="#fff" fontSize="36" fontWeight="700" fontFamily="serif">f</text></svg>,
  },
  {
    href: 'https://github.com/github/semantic',
    zhName: 'GitHub Semantic', enName: 'GitHub Semantic',
    zhNote: '代码语法分析 · 多语言 parser', enNote: 'Code analysis · multi-lang parsers',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.sc.com',
    zhName: 'Standard Chartered', enName: 'Standard Chartered',
    zhNote: 'Mu · 异国衍生品 · 几百万行', enNote: 'Mu · exotic derivatives · millions LOC',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0473EA"/><path d="M20 50 H80" stroke="#fff" strokeWidth="5"/><path d="M30 35 L70 35" stroke="#fff" strokeWidth="3"/><path d="M30 65 L70 65" stroke="#fff" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://mercury.com',
    zhName: 'Mercury (banking)', enName: 'Mercury (banking)',
    zhNote: '初创银行 · 后端 Haskell', enNote: 'Startup banking · Haskell backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E1116"/><circle cx="50" cy="50" r="22" fill="none" stroke="#5DDCAA" strokeWidth="4"/><line x1="50" y1="28" x2="50" y2="72" stroke="#5DDCAA" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://tweag.io',
    zhName: 'Tweag', enName: 'Tweag',
    zhNote: 'Modus Create · 工程顾问 · Linear Haskell', enNote: 'Engineering consultancy · Linear Haskell',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1F1147"/><path d="M25 30 L50 75 L75 30" fill="none" stroke="#FFB347" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://www.haskell.org',
    zhName: 'Mercury (ad tech)', enName: 'Mercury (ad tech)',
    zhNote: '澳大利亚 ad 平台 · 老 Haskell shop', enNote: 'Australian ad platform · early adopter',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#10141E"/><polyline points="20,72 40,40 60,55 80,28" stroke="#FFB347" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://hasura.io',
    zhName: 'Hasura', enName: 'Hasura',
    zhNote: 'GraphQL engine · 主要用 Haskell', enNote: 'GraphQL engine · mostly Haskell',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1EB4D4"/><path d="M30 30 L70 30 L60 50 L70 70 L30 70 L40 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://galois.com',
    zhName: 'Galois Inc.', enName: 'Galois Inc.',
    zhNote: '形式化验证 · 政府/国防合同', enNote: 'Formal verification · gov/defence',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F1E2D"/><circle cx="50" cy="50" r="22" fill="none" stroke="#9D88D9" strokeWidth="3"/><path d="M50 28 L50 50 L66 60" stroke="#9D88D9" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://www.haskell.org',
    zhName: 'hackage.haskell.org', enName: 'hackage.haskell.org',
    zhNote: '官方包仓库 · 20000+ 包', enNote: 'Canonical package archive · 20000+ pkgs',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1530"/><text x="50" y="62" textAnchor="middle" fill="#9D88D9" fontSize="44" fontWeight="700" fontFamily="serif">λ</text></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const TOOLS: AdoptItem[] = [
  { name: 'GHC',              zhDesc: 'Glasgow Haskell Compiler', enDesc: 'Glasgow Haskell Compiler' },
  { name: 'GHCup',            zhDesc: '版本管理 · 装 GHC/cabal', enDesc: 'Toolchain installer' },
  { name: 'cabal-install',    zhDesc: '官方包管理',                enDesc: 'Official package manager' },
  { name: 'Stack',            zhDesc: 'Stackage 上层 · 整合构建',  enDesc: 'Curated build over Stackage' },
  { name: 'Stackage',         zhDesc: '同时间编译验证的包集',      enDesc: 'Coherent package snapshots' },
  { name: 'HLS',              zhDesc: 'Haskell Language Server',  enDesc: 'Haskell Language Server' },
  { name: 'hlint',            zhDesc: 'Lint 工具',                 enDesc: 'Linter' },
  { name: 'ormolu',           zhDesc: '官方格式化',                enDesc: 'Standard formatter' },
  { name: 'QuickCheck',       zhDesc: '随机属性测试 · 始祖',       enDesc: 'Property-based testing · original' },
  { name: 'hspec / tasty',    zhDesc: '测试框架',                  enDesc: 'Test frameworks' },
  { name: 'megaparsec',       zhDesc: 'Parser combinator 现代版',  enDesc: 'Modern parser combinators' },
  { name: 'optparse-app',     zhDesc: 'CLI 参数解析 (Applicative)', enDesc: 'Applicative-style CLI args' },
  { name: 'aeson',            zhDesc: 'JSON · 性能最高',           enDesc: 'Fastest JSON library' },
  { name: 'text / bytestring',zhDesc: '高效字符串',                enDesc: 'Efficient string types' },
  { name: 'lens',             zhDesc: 'Record / 数据访问 DSL',      enDesc: 'Record / data access DSL' },
  { name: 'servant',          zhDesc: '类型层 HTTP API DSL',        enDesc: 'Type-level HTTP API DSL' },
];

interface InfluenceNode {
  name: string;
  zhTag: string;
  enTag: string;
  zhDesc: string;
  enDesc: string;
}

const INFLUENCED: InfluenceNode[] = [
  { name: 'Rust',         zhTag: 'trait', enTag: 'trait',
    zhDesc: 'type class 直接搬过来, 改名 trait', enDesc: 'type class lifted directly, renamed trait' },
  { name: 'Swift',        zhTag: 'protocol', enTag: 'protocol',
    zhDesc: 'Protocol-Oriented Programming = type class', enDesc: 'Protocol-Oriented Programming = type class' },
  { name: 'Scala',        zhTag: 'implicit / given', enTag: 'implicit / given',
    zhDesc: 'implicit param 是 type class instance', enDesc: 'implicit params are type class instances' },
  { name: 'TypeScript',   zhTag: 'HKT 讨论', enTag: 'HKT discussions',
    zhDesc: 'fp-ts 把 monad / functor 搬给 TS', enDesc: 'fp-ts ports monad/functor to TS' },
  { name: 'F#',           zhTag: 'ML/Haskell 混血', enTag: 'ML/Haskell hybrid',
    zhDesc: '.NET 上的函数式 · workflow = monad', enDesc: 'functional on .NET · workflow = monad' },
  { name: 'OCaml',        zhTag: 'mutual', enTag: 'mutual',
    zhDesc: '同代 ML 后裔 · 互相影响', enDesc: 'sibling ML descendant · mutual exchange' },
  { name: 'PureScript',   zhTag: '直接子代', enTag: 'direct descendant',
    zhDesc: 'Haskell 语法 · 编到 JS · 严格求值', enDesc: 'Haskell syntax · compiles to JS · strict' },
  { name: 'Elm',          zhTag: 'Haskell 简化版', enTag: 'simplified Haskell',
    zhDesc: '前端 FP · Redux 心智模型源头', enDesc: 'FP for web · ancestor of Redux mental model' },
  { name: 'React / Redux', zhTag: '心智模型', enTag: 'mental model',
    zhDesc: 'useState / reducer = pure function', enDesc: 'useState / reducer = pure function' },
  { name: 'Java 8+',      zhTag: 'lambda + Stream', enTag: 'lambda + Stream',
    zhDesc: 'Wadler 同时参与 GJ → Java 泛型', enDesc: 'Wadler also designed GJ → Java generics' },
  { name: 'Idris / Agda', zhTag: '依赖类型后继', enTag: 'dependent-type successors',
    zhDesc: '把 Haskell 的类型推到极限', enDesc: 'pushing Haskell types to the limit' },
  { name: 'Verse (Epic)', zhTag: '2023 · SPJ', enTag: '2023 · SPJ',
    zhDesc: 'SPJ 自己说: "Haskell 学到的全部"', enDesc: 'SPJ\'s own phrasing: "everything I learned from Haskell"' },
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
    tag: <>OPEN · 2026+</>, hot: true, big: true,
    zh: {
      title: <>Dependent types — 走没走到, 走到哪一步</>,
      body: (<>
        <p>Haskell 一直在<strong>"逼近 Idris / Agda 但不变成它们"</strong>这条狭路上走: <code>GADTs</code> (2007) → <code>TypeFamilies</code> (2008) → <code>DataKinds</code> (2012) → singletons → <code>visible forall</code> (2024)。每一步都换来"类型层做事的能力", 但不会把语法砸碎。</p>
        <p>2026 的状态: <strong>实用 dependent types 还差一步</strong>——能在类型里做点小证明 (<em>"这两个 vec 同长"</em>), 但还不够写 Coq 那种完整证明。<strong>路线图开着, 进度由 SPJ 退休后的核心组决定</strong>。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="GADTs + TypeFamilies (2024)" en="GADTs + TypeFamilies (2024)" /></span><span className="bar-val">70%</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="full dependent types (path)" en="full dependent types (the path)" /></span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Dependent types — how far, how fast</>,
      body: (<>
        <p>Haskell has been walking a narrow path of <strong>"approach Idris / Agda but don't become them"</strong>: <code>GADTs</code> (2007) → <code>TypeFamilies</code> (2008) → <code>DataKinds</code> (2012) → singletons → <code>visible forall</code> (2024). Each step adds "things you can do at the type level" without shattering the syntax.</p>
        <p>The 2026 state: <strong>practical dependent types are one step away</strong> — you can already prove small theorems in the type system (<em>"these two vectors are the same length"</em>), but not whole Coq-class proofs. <strong>The roadmap is open; the pace is set by the post-SPJ core team</strong>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">GADTs + TypeFamilies (2024)</span><span className="bar-val">70%</span></div>
          <div className="bar bar-new"><span className="bar-label">full dependent types (the path)</span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'RECORDS',
    zh: { title: <>Record 系统 — 永远的痛点</>, body: <><p>Haskell 一个<strong>历史包袱</strong>: 记录类型的字段名是<em>全局函数</em>, 不能在两个 record 用同名字段。社区用 <code>{`RecordWildCards`}</code> / <code>{`OverloadedRecordDot`}</code> / lens 各种 workaround 续命。<strong>2023 的 <code>OverloadedRecordDot</code></strong> 终于让 <code>foo.bar</code> 在 GHC 里工作——TS / Swift 二十年前就有的事。<em>"小步, 慢, 稳"的代价</em>。</p></> },
    en: { title: <>Records — the forever pain point</>, body: <><p>One Haskell <strong>legacy wart</strong>: record field names are <em>top-level functions</em>, so two records can't share a field name. The community has lived on <code>{`RecordWildCards`}</code> / <code>{`OverloadedRecordDot`}</code> / lenses to cope. <strong>2023's <code>OverloadedRecordDot</code></strong> finally made <code>foo.bar</code> work in GHC — twenty years after TS / Swift. <em>The price of "small steps, slow, stable"</em>.</p></> },
  },
  {
    tag: 'STRING',
    zh: { title: <>String 类型 — 老问题, 新方案</>, body: <><p>另一个老笑话: Haskell 有<strong>三种 string</strong>—— <code>String</code> (= <code>[Char]</code> 单链表, 慢)、<code>Text</code> (UTF-16 紧凑, 主推)、<code>ByteString</code> (字节数组, IO 用)。每个库都要决定接受哪种, 类型转换是新手第一道坎。<strong>2024 后的 <code>OsString</code></strong> 多了一种 platform-aware 类型——<em>"更慢, 更稳"</em>仍然适用。</p></> },
    en: { title: <>Strings — old joke, new fix</>, body: <><p>The other running joke: Haskell has <strong>three strings</strong> — <code>String</code> (= <code>[Char]</code>, a linked list, slow), <code>Text</code> (UTF-16, compact, recommended), <code>ByteString</code> (byte array, for IO). Every library picks which it accepts; conversion is a beginner's first cliff. <strong>2024's <code>OsString</code></strong> adds a platform-aware fourth — <em>"slower, more careful"</em> still applies.</p></> },
  },
  {
    tag: 'OUTLOOK',
    zh: { title: <>"影响所有人, 自己不必爆款"</>, body: <><p>2026 年的 Haskell <strong>不再要赢</strong>: type class 已经长在 Rust / Swift 里, FP 心智已经长在 React / Redux 里, parser combinator 已经长在 nom / parsy 里, monad 教学已经有几百篇博客。<strong>它该影响的早影响了</strong>。</p><p>剩下要做的事很清楚: <strong>把 GHC 当类型系统实验台跑下去</strong>、把 Pandoc / Cardano / Standard Chartered 这类生产用户照顾好。<em>"Avoid success at all costs" 当年是开玩笑, 36 年后真的实现了——而且活得很好</em>。</p></> },
    en: { title: <>"Influence everyone, don't be the breakout"</>, body: <><p>Haskell in 2026 <strong>doesn't need to win</strong>: type classes are already living inside Rust / Swift, FP mental models inside React / Redux, parser combinators inside nom / parsy, and there are a hundred blog posts on monads. <strong>Whatever it had to spread, it already spread</strong>.</p><p>What's left is clear: <strong>keep GHC running as a type-system laboratory</strong>, keep Pandoc / Cardano / Standard Chartered and their kin happy. <em>"Avoid success at all costs" was a joke in 2007; 36 years on it has literally come true — and the patient is doing fine</em>.</p></> },
  },
];

export default function HaskellIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Haskell : 纯函数 · 惰性 · 类型类 — 影响所有人, 自己不必爆款',
    'Haskell : pure, lazy, type-classed — the language that quietly shaped everyone else',
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .type-sig, .monad-block, .ai-takeaway, .quote-block, .influence-node'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ai-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.influence-node').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--hask-bright)' : '';
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
      <div ref={rootRef} className="haskell-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 320 240" width="36" height="27">
              <defs>
                <linearGradient id="hs-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9D88D9" />
                  <stop offset="100%" stopColor="#3D3258" />
                </linearGradient>
              </defs>
              <rect width="320" height="240" rx="28" fill="url(#hs-nav)" />
              <path d="M30 30 L100 120 L30 210" stroke="#E0C8FF" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M110 30 L210 210" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
              <path d="M180 30 L120 150" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
              <line x1="220" y1="110" x2="290" y2="110" stroke="#E0C8FF" strokeWidth="14" strokeLinecap="round" />
              <line x1="220" y1="150" x2="290" y2="150" stroke="#E0C8FF" strokeWidth="14" strokeLinecap="round" />
            </svg>
            <span>Haskell</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#influence"><L zh="影响" en="Influence" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs ML" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1987 — 2026 · Haskell Curry · Peyton Jones · Wadler · GHC · pure · lazy · type-classed</div>
            <h1 className="hero-title">
              <span className="hero-name">Haskell</span>
              <span className="hero-colon">=</span>
              <span className="hero-type">λ.types</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>1987 年由一群研究者在 Portland 用委员会方式设计的<strong>纯惰性函数语言</strong>, 命名致敬<strong>Haskell Curry</strong>。36 年后, 它<strong>从未爆款</strong>、却<strong>影响了所有人</strong>: Rust 的 trait、Swift 的 protocol、TypeScript 的 union、React 的 useState 心智模型, 全都从这里来。Pandoc / Cardano / Standard Chartered 在生产里跑它, GHC 仍是<strong>类型系统的实验台</strong>。</>}
                en={<>A <strong>pure, lazy, functional language</strong> designed by committee at Portland in 1987 and named after <strong>Haskell Curry</strong>. 36 years on it has <strong>never had a breakout hit</strong> — yet it <strong>quietly shaped everyone else</strong>: Rust's traits, Swift's protocols, TypeScript's unions, React's useState mental model. Pandoc / Cardano / Standard Chartered run it in production; GHC is still <strong>the laboratory of type-system research</strong>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1987<small></small></span>
                <span className="stat-label"><L zh={<>Portland · FPCA<br /><em>委员会立项</em></>} en={<>Portland · FPCA<br /><em>committee formed</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">36<small> yrs</small></span>
                <span className="stat-label"><L zh={<>持续演化<br /><em>1.0 (1990) → 2010 → GHC 9.10</em></>} en={<>still evolving<br /><em>1.0 (1990) → 2010 → GHC 9.10</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">20k<small>+</small></span>
                <span className="stat-label"><L zh={<>Hackage 上的包<br /><em>+ Stackage 同时间快照</em></>} en={<>packages on Hackage<br /><em>+ Stackage snapshots</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">12<small></small></span>
                <span className="stat-label"><L zh={<>它<em>影响过</em>的语言<br /><em>Rust · Swift · Scala · TS · F#...</em></>} en={<>languages it <em>influenced</em><br /><em>Rust · Swift · Scala · TS · F#...</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">{HASKELL_LOGO_SVG}</div>
            <div className="hero-floats">
              <span className="float f1">{`map :: (a -> b)`}</span>
              <span className="float f2">{`data Maybe a`}</span>
              <span className="float f3">do notation</span>
              <span className="float f4">type class</span>
              <span className="float f5">{`forall a. [a]`}</span>
              <span className="float f6">{`take 10 [1..]`}</span>
              <span className="float f7">IO ()</span>
              <span className="float f8">{`(>>=) :: m a -> (a -> m b)`}</span>
              <span className="float f9">{`Functor f`}</span>
              <span className="float f10">{`a %1 -> b`}</span>
              <span className="float f11">QuickCheck</span>
              <span className="float f12">{`{-# LANGUAGE GADTs #-}`}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Haskell</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Haskell 是 1987 年开始设计、1990 年发布 1.0 的<strong>纯函数 + 惰性求值 + 强静态类型</strong>编程语言, 由委员会设计, 取名自逻辑学家 <strong>Haskell Curry</strong>。和 ML / OCaml 同源, 但走得更激进: <strong>所有副作用进类型</strong>、<strong>默认惰性求值</strong>、<strong>type classes</strong> 让多态比 OOP 更强。</>}
                  en={<>Haskell is a <strong>pure-functional, lazy-evaluated, strongly statically typed</strong> language designed by committee starting in 1987, with 1.0 in 1990 and named after the logician <strong>Haskell Curry</strong>. It shares ancestry with ML / OCaml but pushes harder: <strong>all side effects in the type system</strong>, <strong>lazy by default</strong>, and <strong>type classes</strong> giving more polymorphism than OOP.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="纯函数 (pure)" en="Pure" />, tag: 'paradigm', p: <L zh={<>每个函数<strong>只看输入</strong>。同样的输入 → 同样的输出, 永远。<code>IO</code> 是<strong>值</strong>, 由 runtime 在 <code>main</code> 处执行——<em>不是动作, 是描述动作的数据</em>。</>} en={<>Every function <strong>sees only its inputs</strong>. Same input → same output, forever. <code>IO</code> is a <strong>value</strong>, executed by the runtime at <code>main</code> — <em>not an action, but data describing one</em>.</>} /> },
                { h: <L zh="惰性 (lazy)" en="Lazy" />, tag: 'evaluation', p: <L zh={<>表达式默认<strong>不算</strong>, 用到才算。允许<code>take 10 [1..]</code>这种<em>从无穷取 10 个</em>的写法; 也是新人最容易踩的<strong>性能陷阱</strong>来源。</>} en={<>Expressions are <strong>not evaluated</strong> until needed. Enables <code>take 10 [1..]</code> — <em>10 from an infinite stream</em> — and is also the largest <strong>perf-bug surface</strong> for newcomers.</>} /> },
                { h: <L zh="静态强类型" en="Static & strong typed" />, tag: 'types', p: <L zh={<><strong>Hindley-Milner</strong> 类型推断: 多数函数不写类型也能推出来。<strong>type classes</strong> + GADTs + type families 让类型层能<em>表达逻辑命题</em>——Rust trait 是这套的简化版。</>} en={<><strong>Hindley-Milner</strong> inference: most functions need no annotation. <strong>Type classes</strong> + GADTs + type families let the type layer <em>express logical propositions</em> — Rust's traits are a simplification.</>} /> },
                { h: <L zh="GHC = 实现" en="GHC = the implementation" />, tag: 'compiler', p: <L zh={<>过去 33 年实际上只有<strong>一个编译器</strong> (GHC, Glasgow), 既是工业级又是研究级。Cabal / Stack 管包, GHCup 装工具链——<em>"语言一份, 实现一份, 不分叉"</em>是 Haskell 的传统。</>} en={<>For 33 years there is essentially <strong>one compiler</strong> (GHC, Glasgow), serving both industry and research. Cabal / Stack handle packages, GHCup installs the toolchain — <em>"one spec, one impl, no fork"</em> is the Haskell tradition.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="type-sig">
              <pre>
                <span className="cl-fn">map</span> :: (<span className="cl-type">a</span> -&gt; <span className="cl-type">b</span>) -&gt; [<span className="cl-type">a</span>] -&gt; [<span className="cl-type">b</span>]
              </pre>
              <p>
                <L
                  zh={<><strong>读法</strong>: "<em>map 这个函数, 接收一个 <code>a -&gt; b</code> 的函数, 再接收一个 <code>a</code> 的列表, 返回一个 <code>b</code> 的列表</em>"。<strong>注意</strong>: <em>类型本身就告诉了你 map 在干什么</em>——给定这个签名, 实现几乎被锁死。这是 Haskell 与众不同的<strong>开发流程: 类型先行, 实现后到</strong>。</>}
                  en={<><strong>How to read it</strong>: "<em>map is a function taking an <code>a -&gt; b</code>, then an <code>[a]</code>, and returning an <code>[b]</code></em>." Notice that <em>the type alone tells you what map does</em> — given that signature, the implementation is almost forced. This is Haskell's distinctive <strong>workflow: type first, body second</strong>.</>}
                />
              </p>
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">sum.py</span><span className="lang-tag js">Python</span></div>
                <pre className="code"><code>
                  <span className="cl-k">def</span> <span className="cl-fn">total</span>(xs):{'\n'}
                  {'    '}s = <span className="cl-n">0</span>{'\n'}
                  {'    '}<span className="cl-k">for</span> x <span className="cl-k">in</span> xs:{'\n'}
                  {'        '}s += x{'\n'}
                  {'    '}<span className="cl-k">return</span> s{'\n\n'}
                  <span className="cl-c"><L zh="# 命令式 · 没类型 · null 随便混进来" en="# imperative · untyped · null can sneak in" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">Sum.hs</span><span className="lang-tag ts">Haskell</span></div>
                <pre className="code"><code>
                  <span className="cl-fn">total</span> :: <span className="cl-type">Num</span> a =&gt; [a] -&gt; a{'\n'}
                  <span className="cl-fn">total</span> = <span className="cl-fn">foldr</span> (+) <span className="cl-n">0</span>{'\n\n'}
                  <span className="cl-c"><L zh="-- 一行 · 类型层禁止 null · 自动多态" en="-- one line · null forbidden by types · auto-polymorphic" /></span>{'\n'}
                  <span className="cl-c"><L zh="-- 上面的 Num 是 type class 约束" en="-- the Num is a type class constraint" /></span>
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
                zh={<>从 1987 Portland 的委员会会议到 2026 的 GHC 9.10, Haskell 一直<strong>同时是研究语言和工业语言</strong>。这条线穿过 Wadler 的 monad 论文、Peyton Jones 的 GHC 30 年、Cardano 的工业下注、Tweag 的 Linear Haskell, 最后到 SPJ 转投 Epic 设计 Verse。</>}
                en={<>From the 1987 Portland committee meeting to GHC 9.10 in 2026, Haskell has always been <strong>simultaneously a research language and an industrial one</strong>. The line runs through Wadler's monad papers, Peyton Jones's 30-year GHC stewardship, Cardano's industrial bet, Tweag's Linear Haskell, and ends with SPJ moving to Epic to design Verse.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: HaskellAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 Haskell 跟其它语言<strong>最不一样的地方</strong>: 类型签名先行、ADT + 模式匹配、type classes、list comprehension、<code>Maybe</code> / <code>Either</code>、<code>do</code> 记法、惰性、parser combinator。第 9 张是<strong>"monad — show, don't lecture"</strong>。</>}
                en={<>The eight cards below are where Haskell <strong>differs hardest</strong> from everything else: type-signature-first, ADTs + pattern matching, type classes, list comprehensions, <code>Maybe</code> / <code>Either</code>, <code>do</code> notation, laziness, parser combinators. The ninth is <strong>"monad — show, don't lecture"</strong>.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {HS_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">μ</div>
                <h3><L zh={<>Monad — 看代码不讲道理</>} en={<>Monad — show, don't lecture</>} /></h3>
                <p><L
                  zh={<>"什么是 monad"这种问题在网上有 200 篇博客且全都互相矛盾。<strong>不如直接看一段</strong>: 下面这段 IO 代码不管你叫它"命令式"还是"monad", <em>都一样跑</em>。<code>do</code> 把 <code>(&gt;&gt;=)</code> 写得像顺序语句, 仅此而已。</>}
                  en={<>"What is a monad" has 200 mutually contradicting blog posts. <strong>Skip them — read code</strong>. The IO block below works whether you call it "imperative" or "monadic". <code>do</code> just makes <code>(&gt;&gt;=)</code> read as sequence; nothing more.</>}
                /></p>
                <pre className="ts-code">
                  <code>
                    <span className="cl-fn">greet</span> :: <span className="cl-type">IO</span> (){'\n'}
                    <span className="cl-fn">greet</span> = <span className="cl-k">do</span>{'\n'}
                    {'  '}name &lt;- <span className="cl-fn">getLine</span>{'\n'}
                    {'  '}<span className="cl-fn">putStrLn</span> (<span className="cl-s">"hi, "</span> ++ name)
                  </code>
                </pre>
                <p className="ts-callout-quote">"<em><L
                  zh={<>Monad 是<strong>什么</strong>不重要——重要的是 <code>do</code> 让所有"带上下文"的计算<strong>看起来一样</strong>。</>}
                  en={<>What a monad <strong>is</strong> doesn't matter — what matters is that <code>do</code> makes every "computation in a context" <strong>look the same</strong>.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Haskell" /> <code>: WhyHaskell</code></h2>
              <p className="sec-desc"><L
                zh={<>Haskell 不试图比 C 快, 也不试图比 Python 好上手——它瞄准的是<strong>"用类型说清楚正确性"</strong>。生产里用它的人, 都是看中这一点: <strong>refactor 不怕、并行不怕、null 不存在</strong>。</>}
                en={<>Haskell isn't trying to outrun C or to be friendlier than Python — it targets <strong>"correctness expressed via types"</strong>. People who pick it in production pick it for one thing: <strong>refactors stop scaring you, parallelism is safe, null never existed</strong>.</>}
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

          {/* 05 Adopters */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>Haskell 用户列表不长, 但<strong>每一个都极有分量</strong>。Pandoc 是 markdown 转换的事实标准, Cardano 把数百万行 Haskell 放进区块链, Standard Chartered 的衍生品定价系统是<em>世界上最大的 Haskell 商业代码库</em>。Meta 用 Haxl 做反垃圾邮件, GitHub 用 Semantic 解析 PR。</>}
                en={<>The Haskell user list is short but <strong>each entry carries weight</strong>. Pandoc is the de-facto markdown converter; Cardano runs millions of lines of Haskell on chain; Standard Chartered's derivatives book is <em>arguably the world's largest commercial Haskell codebase</em>. Meta uses Haxl for anti-abuse; GitHub uses Semantic for code parsing.</>}
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

          {/* 06 Influence */}
          <section className="section section-ai" id="influence">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="它影响了谁" en="What Haskell Shaped" /> <code>: TheRipple</code></h2>
              <p className="sec-desc"><L
                zh={<>这是这一页的<strong>核心</strong>: Haskell 自己从未爆款, 但<strong>它造就的概念已经在所有现代语言里</strong>——你今天在 Rust / Swift / TypeScript / React 里写的很多东西, 都是 Haskell 1990s 的研究成果改了名字。</>}
                en={<>This is the <strong>heart</strong> of the page: Haskell never had a breakout hit, but <strong>the concepts it pioneered now live inside every modern language</strong> — much of what you write today in Rust / Swift / TypeScript / React is 1990s Haskell research with a new name.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我们这门语言的<strong>设计哲学</strong>是 <em>"Avoid success at all costs"</em>——不是说"远离成功", 而是说<strong>"别为了大众接受度而牺牲掉做实验的自由"</strong>。Haskell 不是产品, 是研究语言。这个身份让我们做了过去 30 年别人不敢做的所有类型系统实验。</>}
                en={<>Our design philosophy is <em>"Avoid success at all costs"</em> — not "run from success", but <strong>"don't sacrifice the freedom to experiment for mass adoption"</strong>. Haskell isn't a product; it's a research language. That identity is what let us run the type-system experiments nobody else dared to run for 30 years.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Simon Peyton Jones</span>
                <span className="quote-context"><L zh="GHC lead 30+ 年 · Microsoft Research Cambridge · 现在 Epic Games / Verse · 多次访谈复述" en="GHC lead for 30+ years · MSR Cambridge · now Epic Games / Verse · paraphrased from interviews" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">12<small></small></div>
                <div className="ai-stat-h"><L zh="主流语言继承的特性数" en="Features now in mainstream languages" /></div>
                <p><L
                  zh={<>Type class → <strong>Rust trait / Swift protocol / Scala implicit</strong>; ADT + pattern match → <strong>Rust enum, Swift enum, TS union</strong>; list comprehension → <strong>Python</strong>; lambda → <strong>Java 8</strong>; Hindley-Milner inference → <strong>整个 ML 家族 + TS / Swift</strong>; lazy stream → <strong>Java Stream / C# IEnumerable</strong>。<em>清单还可以继续</em>。</>}
                  en={<>Type classes → <strong>Rust trait / Swift protocol / Scala implicit</strong>; ADTs + pattern match → <strong>Rust enum, Swift enum, TS union</strong>; list comprehensions → <strong>Python</strong>; lambdas → <strong>Java 8</strong>; Hindley-Milner inference → <strong>the entire ML family + TS / Swift</strong>; lazy streams → <strong>Java Stream / C# IEnumerable</strong>. <em>The list keeps going</em>.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">30+<small> yr</small></div>
                <div className="ai-stat-h"><L zh="GHC 持续作类型系统实验台" en="GHC, 30+ years as type-system lab" /></div>
                <p><L
                  zh={<>1992 起, GHC 是<strong>类型系统研究公认的主战场</strong>。GADTs (2007)、Type families (2008)、Data kinds (2012)、Type-in-type (2016)、Linear types (2021)、Visible forall (2024)——<strong>每一个特性的论文先发在 ICFP / POPL, 几个月后落进 GHC</strong>。这套节奏其它语言学不会。</>}
                  en={<>Since 1992 GHC has been <strong>the accepted main stage of type-system research</strong>. GADTs (2007), Type families (2008), Data kinds (2012), Type-in-type (2016), Linear types (2021), Visible forall (2024) — <strong>each feature lands as an ICFP / POPL paper first, in GHC months later</strong>. No other language matches the cadence.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">3<small> labs</small></div>
                <div className="ai-stat-h"><L zh="产业级 Haskell 据点" en="Industrial Haskell strongholds" /></div>
                <p><L
                  zh={<><strong>Standard Chartered</strong> (Strats / Mu, 衍生品)、<strong>IOHK / Cardano</strong> (区块链)、<strong>Tweag</strong> (工程顾问 + Linear Haskell)。三个加起来在生产里跑数千万行 Haskell, <em>每年贡献回 GHC 的稳定性补丁是 Haskell 生态健康的支柱</em>。</>}
                  en={<><strong>Standard Chartered</strong> (Strats / Mu, derivatives), <strong>IOHK / Cardano</strong> (blockchain), <strong>Tweag</strong> (consulting + Linear Haskell). Together they run tens of millions of lines of production Haskell, and <em>their annual stability patches to GHC are a pillar of the ecosystem's health</em>.</>}
                /></p>
              </div>
            </div>

            <div className="influence">
              <div className="influence-h"><L zh={<><strong>Haskell 影响的语言</strong> — 选 12 个最直接的</>} en={<><strong>What Haskell influenced</strong> — 12 of the most direct lines</>} /></div>
              <div className="influence-grid">
                {INFLUENCED.map((n, i) => (
                  <div className="influence-node" key={i}>
                    <div className="influence-node-name">{n.name}</div>
                    <div className="influence-node-tag">{lang === 'zh' ? n.zhTag : n.enTag}</div>
                    <div className="influence-node-desc">{lang === 'zh' ? n.zhDesc : n.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="monad-block">
              <div className="monad-text">
                <div className="monad-tag">SPJ → VERSE</div>
                <h3><L zh="SPJ 2023 加入 Epic Games" en="SPJ joins Epic Games (2023)" /></h3>
                <p><L
                  zh={<>2023 年, Simon Peyton Jones 从 Microsoft Research Cambridge 退休, 加入 Epic Games 设计 <strong>Verse</strong>——为 Fortnite 元宇宙做的 dependently-typed FP 语言。SPJ 自己的描述是: <em>"把 Haskell 学到的全部, 放进一个游戏引擎"</em>。</>}
                  en={<>In 2023 Simon Peyton Jones retired from Microsoft Research Cambridge and joined Epic Games to design <strong>Verse</strong> — a dependently-typed FP language for Fortnite's metaverse. His own description: <em>"everything I learned from Haskell, in one game engine"</em>.</>}
                /></p>
                <p><L
                  zh={<>这一步是 Haskell 影响的<strong>最具体证据</strong>: 不只是后继者抄概念, 而是<em>同一个人</em>把 30 年的研究直接带去下一个生态。Verse 跑在 Unreal Editor for Fortnite (UEFN), 已有几百万玩家间接使用它写的脚本——<strong>FP 比之前任何时候更接近终端用户</strong>。</>}
                  en={<>This is the <strong>most concrete evidence</strong> of Haskell's reach: not just successors copying ideas, but the <em>same person</em> carrying 30 years of research directly into a new ecosystem. Verse runs in Unreal Editor for Fortnite (UEFN); millions of players already use scripts written in it — <strong>FP is closer to end-users than at any point before</strong>.</>}
                /></p>
                <p><L
                  zh={<><em>"Avoid success at all costs"</em> 36 年后听起来像反讽——但 SPJ 用 Verse 给出的回答是: <strong>避免成功不是目的, 不被市场拖着走才是</strong>。30 年实验积累, 现在把它倒进千万人的生态。</>}
                  en={<><em>"Avoid success at all costs"</em> sounds ironic 36 years on — but SPJ's answer with Verse is: <strong>the point was never to avoid success, only to refuse the market's pull</strong>. 30 years of experimentation, now poured into a ten-million-user ecosystem.</>}
                /></p>
              </div>
              <div className="monad-code">
                <pre className="code"><code>
                  <span className="cl-c">-- Haskell (1990 →)</span>{'\n'}
                  <span className="cl-fn">map</span> :: (a -&gt; b) -&gt; [a] -&gt; [b]{'\n\n'}
                  <span className="cl-c">-- Rust (2015 →)</span>{'\n'}
                  <span className="cl-k">fn</span> <span className="cl-fn">map</span>&lt;A, B, F&gt;(xs: <span className="cl-type">Vec</span>&lt;A&gt;, f: F){'\n'}
                  {'  '}-&gt; <span className="cl-type">Vec</span>&lt;B&gt;{'\n'}
                  {'  '}<span className="cl-k">where</span> F: <span className="cl-type">Fn</span>(A) -&gt; B{'\n\n'}
                  <span className="cl-c">-- Swift (2014 →)</span>{'\n'}
                  <span className="cl-k">func</span> <span className="cl-fn">map</span>&lt;A, B&gt;(_ xs: [A],{'\n'}
                  {'  '}_ f: (A) -&gt; B) -&gt; [B]{'\n\n'}
                  <span className="cl-c">-- Verse (2023 →, SPJ)</span>{'\n'}
                  <span className="cl-fn">Map</span>(xs: []A, f: A -&gt; B) : []B{'\n\n'}
                  <span className="cl-c">-- the type signature literally travelled</span>{'\n'}
                  <span className="cl-c">-- 33 years across 4 languages</span>
                </code></pre>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="2026 工具链 / 库生态" en="2026 toolchain / ecosystem" /></h3>
              <div className="ai-tools-grid">
                {TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>Haskell <strong>从未赢得市场, 却赢得了所有继任者</strong>。Rust 的 trait、Swift 的 protocol、TS 的 union、React 的 useState——你能想到的现代语言特性, 1995 年的 Haskell 论文里基本都讨论过。<strong>这是它的胜利, 也是它的归宿</strong>。</>}
                en={<>Haskell <strong>never won the market, yet won every successor</strong>. Rust's traits, Swift's protocols, TS's unions, React's useState — basically every modern feature you'd point to was already discussed in a 1995 Haskell paper. <strong>That is its victory, and its place</strong>.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs ML / OCaml / F# */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs ML family" /> <code>: Haskell vs OCaml vs F#</code></h2>
              <p className="sec-desc"><L
                zh={<>常被混淆的三门 ML 家族语言。<strong>Haskell</strong> 纯惰性、type class; <strong>OCaml</strong> 严格求值、模块系统强、Jane Street 在用 (<em>不是 Haskell</em>, 常见误解); <strong>F#</strong> .NET 上的 OCaml/Haskell 混血。</>}
                en={<>Three ML-family languages people confuse. <strong>Haskell</strong>: pure-lazy, type classes. <strong>OCaml</strong>: strict, strong module system, Jane Street's language (<em>not Haskell</em> — common confusion). <strong>F#</strong>: an OCaml/Haskell hybrid on .NET.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">Haskell</th>
                  <th className="th-js">OCaml</th>
                  <th className="th-sw">F#</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    h: <>FPCA committee · 1987</>,
                    o: <>INRIA · 1996 (Caml 1985)</>,
                    f: <>Microsoft · 2005</> },
                  { k: <L zh="求值策略" en="Evaluation" />,
                    h: <L zh={<><strong>默认惰性</strong></>} en={<><strong>Lazy by default</strong></>} />,
                    o: <L zh="严格 (按需用 lazy)" en="Strict (opt-in lazy)" />,
                    f: <L zh="严格" en="Strict" /> },
                  { k: <L zh="纯度" en="Purity" />,
                    h: <L zh={<><strong>强制纯</strong> · IO 在类型里</>} en={<><strong>Pure-by-force</strong> · IO in types</>} />,
                    o: <L zh="允许副作用混在表达式里" en="side effects mixed in expressions" />,
                    f: <L zh="允许副作用" en="side effects allowed" /> },
                  { k: <L zh="多态机制" en="Polymorphism" />,
                    h: <><strong>type classes</strong> · ad-hoc + parametric</>,
                    o: <L zh={<>parametric · modules / functors 替代</>} en={<>parametric · modules/functors as substitute</>} />,
                    f: <L zh={<>type classes (部分) + .NET interfaces</>} en={<>type classes (partial) + .NET interfaces</>} /> },
                  { k: <L zh="主要使用者" en="Primary users" />,
                    h: <L zh={<>Pandoc · Cardano · Standard Chartered · Meta · Mercury</>} en={<>Pandoc · Cardano · Standard Chartered · Meta · Mercury</>} />,
                    o: <L zh={<><strong>Jane Street</strong> · MirageOS · Coq · Rust 编译器最初</>} en={<><strong>Jane Street</strong> · MirageOS · Coq · early Rust compiler</>} />,
                    f: <L zh={<>金融 · .NET 后端 · 数据科学</>} en={<>Finance · .NET back ends · data science</>} /> },
                  { k: <L zh="编译器" en="Compiler" />,
                    h: <>GHC <L zh="(几乎垄断)" en="(near-monopoly)" /></>,
                    o: <>ocamlopt</>,
                    f: <L zh="dotnet · F# 项目" en="dotnet · F# project" /> },
                  { k: <L zh="类型推断" en="Type inference" />,
                    h: <L zh={<>全局 HM · 写不写都行</>} en={<>Full HM · optional annotations</>} />,
                    o: <L zh={<>全局 HM · 模块边界要写</>} en={<>Full HM · module signatures required</>} />,
                    f: <L zh={<>HM · .NET 互操作处需 hint</>} en={<>HM · hints near .NET interop</>} /> },
                  { k: <L zh="并发模型" en="Concurrency" />,
                    h: <L zh={<>STM · async · GHC RTS</>} en={<>STM · async · GHC RTS</>} />,
                    o: <L zh={<>Domains (OCaml 5) · effect handlers</>} en={<>Domains (OCaml 5) · effect handlers</>} />,
                    f: <L zh={<>async · MailboxProcessor</>} en={<>async · MailboxProcessor</>} /> },
                  { k: <L zh="工具链" en="Toolchain" />,
                    h: <>GHCup · cabal · stack · HLS</>,
                    o: <>opam · dune · merlin</>,
                    f: <>dotnet · paket · Ionide</> },
                  { k: <L zh="语法风格" en="Syntax" />,
                    h: <L zh={<>缩进 + offside · 极简</>} en={<>Indent + offside · minimal</>} />,
                    o: <L zh={<>关键字 (let/in/end) · 重</>} en={<>Keyword-heavy (let/in/end)</>} />,
                    f: <L zh={<>缩进 · ML + .NET 风</>} en={<>Indent · ML + .NET flavour</>} /> },
                  { k: <L zh="社区气质" en="Community" />,
                    h: <L zh={<>研究 + 工业混合 · 论文味重</>} en={<>Research + industry · paper-heavy</>} />,
                    o: <L zh={<>务实工业向 · Jane Street 文化</>} en={<>Pragmatic industry · Jane Street culture</>} />,
                    f: <L zh={<>.NET 主流外的 alt 选择</>} en={<>The .NET-mainstream alternative</>} /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.h}</td>
                    <td>{row.o}</td>
                    <td>{row.f}</td>
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
                zh={<>2026 年的 Haskell 不再要赢得市场——它的核心问题改成了: <strong>dependent types 走到哪一步</strong>、<strong>record / string 这些历史包袱怎么了断</strong>、<strong>SPJ 退休后核心组怎么接力</strong>。所有问题都是<em>"研究语言怎么继续做研究"</em>的问题, 不是"怎么破圈"。</>}
                en={<>Haskell in 2026 is no longer trying to win the market — the open questions are: <strong>how far do dependent types reach</strong>; <strong>how to untangle the record / string legacy</strong>; <strong>who carries GHC after SPJ's generation</strong>. Every question is about <em>"how does a research language keep doing research"</em> — none about "how to break out".</>}
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
                <li><a href="https://www.haskell.org" target="_blank" rel="noopener">haskell.org</a></li>
                <li><a href="https://hackage.haskell.org" target="_blank" rel="noopener">hackage.haskell.org</a></li>
                <li><a href="https://www.stackage.org" target="_blank" rel="noopener">stackage.org</a></li>
                <li><a href="https://downloads.haskell.org/ghc/" target="_blank" rel="noopener">downloads.haskell.org/ghc/</a></li>
                <li><a href="https://www.haskell.org/ghcup/" target="_blank" rel="noopener">GHCup installer</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="GHC / 编译器" en="GHC / Compiler" /></h4>
              <ul>
                <li><a href="https://gitlab.haskell.org/ghc/ghc" target="_blank" rel="noopener">gitlab · ghc/ghc</a></li>
                <li><a href="https://www.haskell.org/cabal/" target="_blank" rel="noopener">cabal-install</a></li>
                <li><a href="https://haskellstack.org" target="_blank" rel="noopener">Stack</a></li>
                <li><a href="https://haskell-language-server.readthedocs.io" target="_blank" rel="noopener">HLS</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://www.microsoft.com/en-us/research/people/simonpj/" target="_blank" rel="noopener"><L zh="SPJ 论文集" en="SPJ papers" /></a></li>
                <li><a href="https://homepages.inf.ed.ac.uk/wadler/" target="_blank" rel="noopener"><L zh="Wadler 论文集" en="Wadler papers" /></a></li>
                <li><a href="http://book.realworldhaskell.org/" target="_blank" rel="noopener">Real World Haskell</a></li>
                <li><a href="https://haskellbook.com/" target="_blank" rel="noopener">Haskell Programming from First Principles</a></li>
                <li><a href="https://www.cis.upenn.edu/~cis1940/" target="_blank" rel="noopener">CIS 194 (UPenn)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/rust"><L zh="Rust — typeclass → trait" en="Rust — typeclass → trait" /></a></li>
                <li><a href="/code/language/swift"><L zh="Swift — typeclass → protocol" en="Swift — typeclass → protocol" /></a></li>
                <li><a href="/code/language/ts"><L zh="TypeScript — HKT 讨论" en="TypeScript — HKT discussions" /></a></li>
                <li><a href="/code/language/mojo"><L zh="Mojo — Lattner 第三门语言" en="Mojo — Lattner's third language" /></a></li>
                <li><a href="https://pandoc.org" target="_blank" rel="noopener">Pandoc — <L zh="Haskell 在做的事" en="Haskell at work" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{HASKELL_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`main = putStrLn "λ → trait → protocol → useState"`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
