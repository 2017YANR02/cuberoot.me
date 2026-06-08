'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './kotlin_intro.css';
import i18n from '@/i18n/i18n-client';

const KOTLIN_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="kl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7F52FF" />
        <stop offset="100%" stopColor="#C811E2" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#kl-grad)" />
    <path
      fill="#fff"
      d="M188 60H68v136h60l-60-68 60-68m0 0h60l-60 68 60 68h-60l-60-68z"
      opacity="0"
    />
    <polygon points="68,60 188,60 128,128" fill="#fff" />
    <polygon points="68,60 128,128 68,196" fill="#fff" />
    <polygon points="128,128 188,196 68,196" fill="#fff" />
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
    zh: { title: <>JetBrains 内部立项</>, desc: <>JetBrains 圣彼得堡团队启动一个内部项目，目标是给自家百万行级 IntelliJ IDEA 找一门"<strong>比 Java 好</strong>"但能 100% 与 Java 互操作的语言。代号取自圣彼得堡附近的<strong>科特林岛</strong>（Kotlin Island），与 Java 岛、Scala 岛遥相呼应。</> },
    en: { title: <>JetBrains kicks off the project</>, desc: <>The JetBrains team in St. Petersburg starts an internal project: find a language that is "<strong>better than Java</strong>" yet 100% interoperable with Java for their own million-line IntelliJ IDEA codebase. The codename is taken from <strong>Kotlin Island</strong> near St. Petersburg — echoing Java island and Scala island.</> },
  },
  {
    year: <>2011<small>·07</small></>,
    zh: { title: <>项目公开</>, desc: <>7 月 22 日，JetBrains 在 JVM Language Summit 上公开 Kotlin。第一次亮相就明确两条底线：<strong>静态类型</strong>、<strong>与 Java 互操作不打折</strong>。Java 圈反应平淡——又一个 JVM 上的"Better Java"，前面已经有 Scala / Groovy / Clojure。</> },
    en: { title: <>Public reveal</>, desc: <>July 22nd, JetBrains announces Kotlin at the JVM Language Summit. Two non-negotiables on day one: <strong>static typing</strong> and <strong>full Java interop</strong>. The Java world shrugs — yet another "Better Java" on the JVM, alongside Scala, Groovy and Clojure.</> },
  },
  {
    year: <>2012<small>·02</small></>,
    zh: { title: <>开源</>, desc: <>编译器代码以 Apache 2.0 协议放上 GitHub。这一步把 Kotlin 从"JetBrains 内部玩具"变成了一个真正的开源语言，外界可以贡献、可以审 commit。</> },
    en: { title: <>Open-sourced</>, desc: <>The compiler hits GitHub under Apache 2.0. This is the moment Kotlin stops being a JetBrains internal toy — outside contributors can read commits, file PRs, watch the language evolve in the open.</> },
  },
  {
    year: <>2016<small>·02·15</small></>, highlight: true,
    zh: { title: <>1.0 稳定版</>, desc: <>2 月 15 日，<strong>Kotlin 1.0</strong> 发布。从此向后兼容承诺生效：写 1.0 的代码，未来所有版本都能编。Andrey Breslav（首席语言设计师）的演讲主题：<em>"我们做了一门务实的语言，不是研究项目"</em>。</> },
    en: { title: <>1.0 ships stable</>, desc: <>February 15th: <strong>Kotlin 1.0</strong> arrives. Backward compatibility kicks in — code written for 1.0 will compile on every future version. Andrey Breslav (lead language designer) frames it as <em>"a pragmatic language, not a research project."</em></> },
  },
  {
    year: <>2017<small>·05</small></>, highlight: true,
    zh: { title: <>Google I/O — Android 一等公民</>, desc: <>5 月 17 日 Google I/O。<strong>Google 宣布 Kotlin 成为 Android 官方支持语言</strong>。这一刻 Kotlin 从"又一个 JVM 玩具"变成"地球上最大的移动平台的官方语言"。Android Studio 直接内置 Kotlin 工具链。</> },
    en: { title: <>Google I/O — first-class on Android</>, desc: <>May 17th, Google I/O. <strong>Google declares Kotlin an officially supported language for Android</strong>. Overnight, Kotlin goes from "another JVM toy" to "the official language of the largest mobile platform on Earth." Kotlin tooling is bundled into Android Studio.</> },
  },
  {
    year: <>2018<small>·10</small></>,
    zh: { title: <>1.3 — 协程稳定</>, desc: <>10 月 29 日 Kotlin 1.3 发布，<code>suspend</code> 关键字与协程库（<code>kotlinx.coroutines</code>）正式进入 stable。<strong>结构化并发</strong>这一概念被 Kotlin 团队推到主流：协程的生命周期由作用域管理，不会像 GoLang goroutine 那样泄漏。</> },
    en: { title: <>1.3 — coroutines stable</>, desc: <>October 29th, Kotlin 1.3. The <code>suspend</code> keyword and <code>kotlinx.coroutines</code> ship as stable. <strong>Structured concurrency</strong> — coroutine lifetimes scoped, no goroutine-style leaks — is popularised by the Kotlin team.</> },
  },
  {
    year: <>2019<small>·05</small></>, highlight: true,
    zh: { title: <>Google I/O — "Kotlin-first" for Android</>, desc: <>5 月 7 日 I/O 19。Google 正式表态：<strong>Android 开发推荐使用 Kotlin</strong>。所有官方文档、samples、教程切到 Kotlin。这是从"支持"到"主推"的质变。同年统计：50% 以上的 Android 专业开发者已用 Kotlin。</> },
    en: { title: <>Google I/O — Kotlin-first for Android</>, desc: <>May 7th, I/O 19. Google goes from "supported" to <strong>recommended</strong>: official docs, samples and tutorials all switch to Kotlin. By year-end surveys, over 50% of professional Android developers are on Kotlin.</> },
  },
  {
    year: <>2020<small>·08</small></>,
    zh: { title: <>Spring Framework 一等公民</>, desc: <>Spring 5 起为 Kotlin 提供官方扩展，2020 后整个 Spring 生态（Spring Boot / WebFlux / Data）原生支持 Kotlin DSL、null safety、协程。Kotlin 的影响力从 Android 客户端正式跨到了 JVM 服务端。</> },
    en: { title: <>Spring Framework first-class</>, desc: <>Spring 5 onwards ships official Kotlin extensions; by 2020 the whole Spring ecosystem (Boot / WebFlux / Data) supports Kotlin DSLs, null safety and coroutines natively. Kotlin's reach spreads from Android clients to JVM backends.</> },
  },
  {
    year: '2022',
    zh: { title: <>Compose Multiplatform alpha</>, desc: <>JetBrains 把 Google 的 Jetpack Compose（Android 声明式 UI）port 到桌面与 Web，命名 <strong>Compose Multiplatform</strong>。同一份 Kotlin <code>@Composable</code> 函数能在 Android / Desktop / Web 三端跑。</> },
    en: { title: <>Compose Multiplatform alpha</>, desc: <>JetBrains ports Google's Jetpack Compose (Android's declarative UI) to Desktop and Web as <strong>Compose Multiplatform</strong>. The same <code>@Composable</code> Kotlin function targets Android, Desktop and Web.</> },
  },
  {
    year: <>2023<small>·11</small></>, highlight: true,
    zh: { title: <>1.9.20 — Kotlin Multiplatform 稳定</>, desc: <>11 月 1 日。<strong>KMP（Kotlin Multiplatform）</strong>正式 stable。一份 Kotlin 共享层，分别编出 JVM bytecode（Android）/ native（iOS、Linux、macOS）/ JS（Web），共享业务逻辑、各端原生 UI——业界第一次有了"<em>不强迫统一 UI</em>"的跨平台方案。</> },
    en: { title: <>1.9.20 — Kotlin Multiplatform stable</>, desc: <>November 1st. <strong>KMP (Kotlin Multiplatform)</strong> goes stable. One Kotlin shared layer compiles to JVM bytecode (Android), native (iOS, Linux, macOS) and JS (Web). Share business logic, keep native UI per platform — the first cross-platform story that <em>doesn't force one UI to rule them all</em>.</> },
  },
  {
    year: <>2024<small>·05</small></>, highlight: true,
    zh: { title: <>Compose Multiplatform for iOS stable + K2 编译器</>, desc: <>5 月，<strong>Compose Multiplatform for iOS</strong> 进入 stable——一份 Kotlin Compose 同时跑 Android、iOS、桌面、Web。同年 Kotlin 2.0 发布，<strong>K2 编译器</strong>正式 stable，类型推断比 K1 快 ~2×、为 KMP 与未来语法演进打基础。</> },
    en: { title: <>Compose Multiplatform for iOS stable + K2 compiler</>, desc: <>May. <strong>Compose Multiplatform for iOS</strong> hits stable — one Kotlin Compose codebase running on Android, iOS, Desktop and Web. Kotlin 2.0 ships the same year with the <strong>K2 compiler</strong> stable; type inference roughly 2× faster than K1 and the foundation for KMP plus future syntax evolution.</> },
  },
  {
    year: '2025',
    zh: { title: <>2.x · KMP / Compose 全面铺开</>, desc: <>Kotlin 进入 2.x 时代。Cash App / Square 把核心交易共享层用 KMP；Netflix / Pinterest / Trello / Airbnb 的 Android 全 Kotlin。Spring Boot 3.x 文档把 Kotlin 与 Java 平起平坐。Compose for Web（基于 K/Wasm）落地，Kotlin 在浏览器里也开始<strong>吃 Wasm</strong>。</> },
    en: { title: <>2.x · KMP / Compose go mainstream</>, desc: <>Kotlin is squarely in 2.x. Cash App / Square move core transaction logic to KMP; Netflix / Pinterest / Trello / Airbnb run pure-Kotlin Android. Spring Boot 3.x docs put Kotlin on equal footing with Java. Compose for Web (built on K/Wasm) lands — Kotlin starts <strong>eating WebAssembly</strong> too.</> },
  },
];

interface KtCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const KT_CARDS: KtCard[] = [
  {
    tag: 'A',
    zh: { title: <>Null safety <code>T?</code></>, desc: <>类型分两种：可空 <code>T?</code> 与不可空 <code>T</code>。NPE 在编译期就被挡。号称<strong>"消灭 Tony Hoare 那个十亿美元的错误"</strong>。</> },
    en: { title: <>Null safety <code>T?</code></>, desc: <>Two type families: nullable <code>T?</code> and non-null <code>T</code>. NPEs are caught at compile time — Kotlin's pitch as "killing Tony Hoare's <strong>billion-dollar mistake</strong>."</> },
    code: (
      <code>
        <span className="cl-k">val</span> <span className="cl-v">name</span>: <span className="cl-type">String</span> = <span className="cl-s">"Andrey"</span>{'\n'}
        <span className="cl-k">val</span> <span className="cl-v">middle</span>: <span className="cl-type">String?</span> = <span className="cl-k">null</span>{'\n\n'}
        <span className="cl-c">// name.length        // OK</span>{'\n'}
        <span className="cl-c">// middle.length      // ✘ compile error</span>{'\n'}
        <span className="cl-v">middle</span>?.<span className="cl-prop">length</span>      <span className="cl-c">// safe call</span>{'\n'}
        <span className="cl-v">middle</span> ?: <span className="cl-s">"-"</span>       <span className="cl-c">// elvis fallback</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>data class</code></>, desc: <>一行写出"值对象"：自动生成 <code>equals</code> / <code>hashCode</code> / <code>copy</code> / <code>toString</code> / 解构。比 Java 的 record 早 7 年。</> },
    en: { title: <><code>data class</code></>, desc: <>One line for a value object: <code>equals</code> / <code>hashCode</code> / <code>copy</code> / <code>toString</code> / destructuring all generated. Seven years before Java's record.</> },
    code: (
      <code>
        <span className="cl-k">data class</span> <span className="cl-type">User</span>(<span className="cl-k">val</span> <span className="cl-v">name</span>: <span className="cl-type">String</span>, <span className="cl-k">val</span> <span className="cl-v">age</span>: <span className="cl-type">Int</span>){'\n\n'}
        <span className="cl-k">val</span> <span className="cl-v">a</span> = <span className="cl-fn">User</span>(<span className="cl-s">"Andrey"</span>, <span className="cl-n">42</span>){'\n'}
        <span className="cl-k">val</span> <span className="cl-v">b</span> = <span className="cl-v">a</span>.<span className="cl-fn">copy</span>(<span className="cl-prop">age</span> = <span className="cl-n">43</span>){'\n'}
        <span className="cl-k">val</span> (<span className="cl-v">n</span>, <span className="cl-v">y</span>) = <span className="cl-v">b</span>           <span className="cl-c">// destructure</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>Extension 函数</>, desc: <>不用继承、不用包装类，给现有类型"<strong>外挂</strong>"方法。Kotlin 标准库的一半都是这样写的。</> },
    en: { title: <>Extension functions</>, desc: <>Add methods to existing types — no inheritance, no wrapper class. Half of Kotlin's stdlib is built this way.</> },
    code: (
      <code>
        <span className="cl-k">fun</span> <span className="cl-type">String</span>.<span className="cl-fn">isPalindrome</span>(): <span className="cl-type">Boolean</span> ={'\n'}
        {'  '}<span className="cl-k">this</span> == <span className="cl-k">this</span>.<span className="cl-fn">reversed</span>(){'\n\n'}
        <span className="cl-s">"abcba"</span>.<span className="cl-fn">isPalindrome</span>()    <span className="cl-c">// true</span>{'\n'}
        <span className="cl-s">"hello"</span>.<span className="cl-fn">isPalindrome</span>()    <span className="cl-c">// false</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>协程 <code>suspend</code> / <code>Flow</code></>, desc: <>用同步的写法跑异步。<code>suspend</code> 让函数可挂起；<code>Flow</code> 是冷流的响应式数据。结构化并发——作用域结束所有协程一起退场。</> },
    en: { title: <>Coroutines: <code>suspend</code> / <code>Flow</code></>, desc: <>Async written like sync. <code>suspend</code> functions can pause; <code>Flow</code> is a cold reactive stream. Structured concurrency: when the scope ends, every coroutine ends with it.</> },
    code: (
      <code>
        <span className="cl-k">suspend fun</span> <span className="cl-fn">fetch</span>(<span className="cl-v">url</span>: <span className="cl-type">String</span>): <span className="cl-type">String</span> ={'\n'}
        {'  '}<span className="cl-fn">httpClient</span>.<span className="cl-fn">get</span>(<span className="cl-v">url</span>).<span className="cl-fn">body</span>(){'\n\n'}
        <span className="cl-fn">coroutineScope</span> {'{'}{'\n'}
        {'  '}<span className="cl-k">val</span> <span className="cl-v">a</span> = <span className="cl-fn">async</span> {'{ '}<span className="cl-fn">fetch</span>(<span className="cl-s">"/u/1"</span>) {' }'}{'\n'}
        {'  '}<span className="cl-k">val</span> <span className="cl-v">b</span> = <span className="cl-fn">async</span> {'{ '}<span className="cl-fn">fetch</span>(<span className="cl-s">"/u/2"</span>) {' }'}{'\n'}
        {'  '}<span className="cl-fn">println</span>(<span className="cl-v">a</span>.<span className="cl-fn">await</span>() + <span className="cl-v">b</span>.<span className="cl-fn">await</span>()){'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>sealed class</code> + <code>when</code></>, desc: <>密封类把"所有可能的子类型"<strong>关在一个文件里</strong>。<code>when</code> 强制穷尽所有分支，漏一个编译就挂——代数数据类型的 OOP 表达。</> },
    en: { title: <><code>sealed class</code> + <code>when</code></>, desc: <>A sealed type confines <strong>all possible subtypes to one file</strong>. <code>when</code> forces exhaustive matching — miss a branch and the compile fails. ADTs in OOP clothing.</> },
    code: (
      <code>
        <span className="cl-k">sealed class</span> <span className="cl-type">Result</span>&lt;<span className="cl-k">out</span> <span className="cl-type">T</span>&gt; {'{'}{'\n'}
        {'  '}<span className="cl-k">data class</span> <span className="cl-type">Ok</span>&lt;<span className="cl-type">T</span>&gt;(<span className="cl-k">val</span> <span className="cl-v">v</span>: <span className="cl-type">T</span>) : <span className="cl-type">Result</span>&lt;<span className="cl-type">T</span>&gt;(){'\n'}
        {'  '}<span className="cl-k">data class</span> <span className="cl-type">Err</span>(<span className="cl-k">val</span> <span className="cl-v">e</span>: <span className="cl-type">Throwable</span>) : <span className="cl-type">Result</span>&lt;<span className="cl-k">Nothing</span>&gt;(){'\n'}
        {'}'}{'\n\n'}
        <span className="cl-k">when</span> (<span className="cl-v">r</span>) {'{'}{'\n'}
        {'  '}<span className="cl-k">is</span> <span className="cl-type">Result.Ok</span>  -&gt; <span className="cl-fn">show</span>(<span className="cl-v">r</span>.<span className="cl-prop">v</span>){'\n'}
        {'  '}<span className="cl-k">is</span> <span className="cl-type">Result.Err</span> -&gt; <span className="cl-fn">log</span>(<span className="cl-v">r</span>.<span className="cl-prop">e</span>){'\n'}
        <span className="cl-c">{'  // exhaustive — miss one ⇒ compile error'}</span>{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Lambda + DSL builder</>, desc: <>带接收者的 lambda（<code>T.() -&gt; Unit</code>）让 Kotlin 写起 DSL 像写 yaml。Gradle 的 build script、Compose 的 UI tree 都是这样跑出来的。</> },
    en: { title: <>Lambdas + DSL builders</>, desc: <>Lambdas with receivers (<code>T.() -&gt; Unit</code>) make Kotlin DSLs feel like YAML. Gradle's build scripts and Compose's UI trees are built on top of this trick.</> },
    code: (
      <code>
        <span className="cl-k">fun</span> <span className="cl-fn">html</span>(<span className="cl-v">block</span>: <span className="cl-type">Tag</span>.() -&gt; <span className="cl-type">Unit</span>) ={'\n'}
        {'  '}<span className="cl-type">Tag</span>(<span className="cl-s">"html"</span>).<span className="cl-fn">apply</span>(<span className="cl-v">block</span>){'\n\n'}
        <span className="cl-fn">html</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">body</span> {'{'}{'\n'}
        {'    '}<span className="cl-fn">h1</span> {'{ '}+<span className="cl-s">"Hello"</span> {' }'}{'\n'}
        {'  '}{'}'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>Inline / value class</>, desc: <>给基础类型套一个名字，但<strong>运行时零开销</strong>——编译完是原始类型。给 <code>UserId</code> / <code>Email</code> 这种"语义类型"用得最多。</> },
    en: { title: <>Inline / value class</>, desc: <>Wrap a primitive in a named type with <strong>zero runtime cost</strong> — compiled away to the underlying primitive. Perfect for "semantic types" like <code>UserId</code> or <code>Email</code>.</> },
    code: (
      <code>
        <span className="cl-k">@JvmInline</span>{'\n'}
        <span className="cl-k">value class</span> <span className="cl-type">UserId</span>(<span className="cl-k">val</span> <span className="cl-v">raw</span>: <span className="cl-type">Long</span>){'\n\n'}
        <span className="cl-k">fun</span> <span className="cl-fn">load</span>(<span className="cl-v">id</span>: <span className="cl-type">UserId</span>): <span className="cl-type">User</span>{'\n'}
        <span className="cl-c">{'// at JVM level: load(J)LUser; — pure long'}</span>
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
    zh: { title: <>100% Java 互操作</>, desc: <>任何 Java 库直接 <code>import</code>，反过来 Java 调 Kotlin 也可以。这点把 Scala / Clojure 等"清教徒派"语言甩在身后——你不用<strong>抛弃 23 年的 Java 生态</strong>来换语言。</> },
    en: { title: <>100% Java interop</>, desc: <>Any Java library imports directly; Java can call Kotlin back. This is what put Kotlin past Scala / Clojure: you don't have to <strong>throw out 23 years of Java ecosystem</strong> to switch.</> },
    code: <><span className="cl-k">import</span> com.google.gson.<span className="cl-type">Gson</span>{'\n'}<span className="cl-k">val</span> <span className="cl-v">json</span> = <span className="cl-fn">Gson</span>().<span className="cl-fn">toJson</span>(<span className="cl-v">obj</span>)</>,
  },
  {
    icon: '⎇',
    zh: { title: <>NPE 编译期消灭</>, desc: <><code>T?</code> 让 null 可见；非空类型不允许 null。Java 里靠运行时 NPE 才发现的 bug，Kotlin 在 IDE 里就喊停。Android 圈说"Kotlin 上线一年 NPE 直降 70%"不是夸张。</> },
    en: { title: <>NPEs caught at compile time</>, desc: <>Nullability is in the type. Bugs that show up as runtime NPE in Java get flagged in the IDE in Kotlin. The Android community's "70% drop in NPEs after a year of Kotlin" claim is not hype.</> },
    code: <><span className="cl-k">val</span> <span className="cl-v">x</span>: <span className="cl-type">String</span>  = <span className="cl-k">null</span>  <span className="cl-c">// ✘</span>{'\n'}<span className="cl-k">val</span> <span className="cl-v">y</span>: <span className="cl-type">String?</span> = <span className="cl-k">null</span>  <span className="cl-c">// OK</span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>Android 官方语言</>, desc: <>Google I/O 2017 起 Android 一等公民、2019 起官方推荐。Android Studio 内置完整 Kotlin 工具链。<strong>~80%+ 专业 Android 开发者</strong>用 Kotlin（Google 2024 数据）。</> },
    en: { title: <>Android's official language</>, desc: <>First-class on Android since I/O 2017, recommended since I/O 2019. Android Studio bundles the full Kotlin tool chain. <strong>80%+ of professional Android developers</strong> are on Kotlin (Google 2024 numbers).</> },
    code: <><span className="cl-c">// app/build.gradle.kts</span>{'\n'}<span className="cl-fn">plugins</span> {'{ '}<span className="cl-k">id</span>(<span className="cl-s">"org.jetbrains.kotlin.android"</span>) {' }'}</>,
  },
  {
    icon: '⚙',
    zh: { title: <>结构化协程</>, desc: <>挂起函数 + 作用域 = 不会泄漏的异步。比 Go 的 goroutine 多一层"父作用域结束、子协程一起取消"——这是结构化并发的发明地之一。</> },
    en: { title: <>Structured concurrency</>, desc: <>Suspend functions + scope = async without leaks. One step beyond Go's goroutines: "parent scope dies, all child coroutines die with it." Kotlin is one of the birthplaces of structured concurrency as a concept.</> },
    code: <><span className="cl-fn">coroutineScope</span> {'{'}{'\n'}{'  '}<span className="cl-fn">launch</span> {'{ '}<span className="cl-fn">fetch</span>() {' }'}{'\n'}{'  '}<span className="cl-fn">launch</span> {'{ '}<span className="cl-fn">save</span>() {' }'}{'\n'}{'}'}</>,
  },
  {
    icon: '⌬',
    zh: { title: <>Multiplatform：一份业务，多端跑</>, desc: <>KMP 把 Kotlin 编到 JVM bytecode / iOS native / JS / Wasm。<strong>共享业务逻辑，UI 各端原生</strong>——Cash App 把核心交易层 100% 跑在 KMP 上，iOS / Android 共享 80%+ 代码。</> },
    en: { title: <>Multiplatform: one logic, many targets</>, desc: <>KMP compiles Kotlin to JVM bytecode, iOS native, JS, and Wasm. <strong>Share business logic, keep UI native per platform</strong> — Cash App runs core transaction logic 100% on KMP with 80%+ code shared between iOS and Android.</> },
    code: <><span className="cl-c">// commonMain/UserRepo.kt</span>{'\n'}<span className="cl-k">expect class</span> <span className="cl-type">PlatformDb</span>{'\n'}<span className="cl-c">// androidMain / iosMain — actual</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>简洁但不"巫术"</>, desc: <>把 Java 的样板（getter / setter / equals / hashCode / final）扫掉。<strong>不像 Scala 那样把魔法堆到天上</strong>——Kotlin 的设计原则是"可读 &gt; 巧妙"，看了就懂。</> },
    en: { title: <>Concise without sorcery</>, desc: <>All the Java boilerplate (getters, setters, equals, hashCode, final) goes away. Yet <strong>unlike Scala</strong>, Kotlin doesn't pile on magic — the design principle is "readable beats clever."</> },
    code: <><span className="cl-k">data class</span> <span className="cl-type">P</span>(<span className="cl-k">val</span> <span className="cl-v">x</span>: <span className="cl-type">Int</span>, <span className="cl-k">val</span> <span className="cl-v">y</span>: <span className="cl-type">Int</span>){'\n'}<span className="cl-c">// 1 line ≈ 60 lines of Java</span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>函数式 + OOP 平等</>, desc: <>有 lambda、有 <code>map</code> / <code>filter</code> / <code>fold</code>、有不可变数据，但<strong>不强求</strong>函数式纯洁。需要 OOP 写 OOP，需要管道写管道——一门务实的语言。</> },
    en: { title: <>FP + OOP, equal partners</>, desc: <>Lambdas, <code>map</code> / <code>filter</code> / <code>fold</code>, immutable data are all there — but Kotlin <strong>doesn't enforce</strong> functional purity. OOP when you need OOP, pipelines when you need pipelines. A pragmatic language.</> },
    code: <><span className="cl-v">users</span>{'\n'}{'  '}.<span className="cl-fn">filter</span> {'{ '}<span className="cl-k">it</span>.<span className="cl-prop">age</span> &gt; <span className="cl-n">18</span> {' }'}{'\n'}{'  '}.<span className="cl-fn">map</span> {'{ '}<span className="cl-k">it</span>.<span className="cl-prop">name</span> {' }'}</>,
  },
  {
    icon: '⏚',
    zh: { title: <>JVM 字节码无开销</>, desc: <>Kotlin 编译产物就是普通 JVM bytecode，跑在任何 JVM 上、与 Java 类无差。<strong>没有运行时</strong>需要带——只有一个 ~1.5 MB 的 stdlib jar，混合到 Java 项目里几乎看不见。</> },
    en: { title: <>Plain JVM bytecode</>, desc: <>Kotlin compiles to ordinary JVM bytecode that runs on any JVM, indistinguishable from Java classes. <strong>No runtime to ship</strong> — just a ~1.5 MB stdlib jar that disappears into a Java project.</> },
    code: <><span className="cl-c">// .kt → .class → JVM</span>{'\n'}<span className="cl-c">// no Kotlin VM, no shim</span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>JetBrains 撑腰</>, desc: <>语言由<strong>世界上最好的 IDE 厂商</strong>设计、维护。IntelliJ / Android Studio 对 Kotlin 的支持永远是顶配——重命名、抽函数、跨语言重构都顺。这点 Scala / Clojure 没法比。</> },
    en: { title: <>Backed by JetBrains</>, desc: <>The language is designed and maintained by <strong>the best IDE vendor in the world</strong>. IntelliJ / Android Studio's Kotlin support is always best-in-class — rename, extract, cross-language refactor all just work. Nothing else on the JVM has this.</> },
    code: <><span className="cl-c">// rename across .kt + .java</span>{'\n'}<span className="cl-c">// in one shortcut, IDE-driven</span></>,
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
    href: 'https://developer.android.com/kotlin', highlight: true,
    zhName: 'Android', enName: 'Android',
    zhNote: 'Kotlin-first 自 2019', enNote: 'Kotlin-first since 2019',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M30 35 Q50 18 70 35 V62 H30 Z" fill="#3DDC84"/><circle cx="40" cy="45" r="2.5" fill="#fff"/><circle cx="60" cy="45" r="2.5" fill="#fff"/><line x1="32" y1="30" x2="36" y2="22" stroke="#3DDC84" strokeWidth="2.5" strokeLinecap="round"/><line x1="68" y1="30" x2="64" y2="22" stroke="#3DDC84" strokeWidth="2.5" strokeLinecap="round"/><rect x="22" y="40" width="6" height="20" rx="3" fill="#3DDC84"/><rect x="72" y="40" width="6" height="20" rx="3" fill="#3DDC84"/><rect x="36" y="65" width="6" height="14" rx="3" fill="#3DDC84"/><rect x="58" y="65" width="6" height="14" rx="3" fill="#3DDC84"/></svg>,
  },
  {
    href: 'https://www.jetbrains.com/idea/',
    zhName: 'IntelliJ IDEA', enName: 'IntelliJ IDEA',
    zhNote: 'Kotlin 的母舰 IDE', enNote: 'Birthplace IDE of Kotlin',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="8" fill="#000"/><path d="M28 28 H45 V42 H38 V58 H45 V72 H28 V58 H35 V42 H28 Z" fill="#fff"/><circle cx="68" cy="32" r="4" fill="#FE2857"/></svg>,
  },
  {
    href: 'https://spring.io',
    zhName: 'Spring', enName: 'Spring',
    zhNote: 'Kotlin 一等公民 (Boot 3.x)', enNote: 'First-class Kotlin (Boot 3.x)',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#6DB33F"/><path d="M30 30 Q50 20 75 30 Q60 35 50 50 Q40 65 30 75 Q35 55 30 30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://cash.app', highlight: true,
    zhName: 'Cash App', enName: 'Cash App',
    zhNote: 'KMP 共享 80%+ 业务逻辑', enNote: 'KMP shares 80%+ of business logic',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="22" fill="#00D632"/><path d="M50 26 Q60 26 66 32 L60 38 Q56 34 50 34 Q43 34 43 38 Q43 42 50 44 Q66 47 66 58 Q66 70 50 72 V78 H46 V72 Q38 70 32 64 L38 58 Q43 64 50 64 Q57 64 57 58 Q57 54 50 52 Q34 49 34 38 Q34 28 46 26 V20 H50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.netflix.com', highlight: true,
    zhName: 'Netflix', enName: 'Netflix',
    zhNote: 'Android 全 Kotlin', enNote: 'Android is all Kotlin',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="20" y="10" width="20" height="80" fill="#E50914"/><rect x="60" y="10" width="20" height="80" fill="#E50914"/><polygon points="22,10 38,10 80,90 64,90" fill="#831010"/></svg>,
  },
  {
    href: 'https://www.pinterest.com',
    zhName: 'Pinterest', enName: 'Pinterest',
    zhNote: 'Android Kotlin 化', enNote: 'Migrated Android to Kotlin',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#E60023"/><path d="M48 18 Q72 18 76 42 Q78 60 60 66 Q52 68 48 64 L44 80 Q42 86 38 88 Q36 78 38 70 L44 48 Q42 38 50 34 Q60 32 60 44 Q60 56 52 60 Q44 62 46 50" fill="#fff"/></svg>,
  },
  {
    href: 'https://trello.com',
    zhName: 'Trello', enName: 'Trello',
    zhNote: '早期 Kotlin 采用者', enNote: 'Early Kotlin adopter',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="8" y="8" width="84" height="84" rx="14" fill="#0079BF"/><rect x="20" y="20" width="24" height="50" rx="3" fill="#fff"/><rect x="56" y="20" width="24" height="34" rx="3" fill="#fff"/></svg>,
  },
  {
    href: 'https://airbnb.com',
    zhName: 'Airbnb', enName: 'Airbnb',
    zhNote: 'Android Kotlin · Mavericks 框架', enNote: 'Android Kotlin · Mavericks framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 12 C30 12 12 50 28 75 C36 88 50 90 50 75 C50 60 38 55 38 45 C38 35 43 28 50 28 C57 28 62 35 62 45 C62 55 50 60 50 75 C50 90 64 88 72 75 C88 50 70 12 50 12 Z" fill="#FF5A5F"/></svg>,
  },
  {
    href: 'https://gradle.org',
    zhName: 'Gradle', enName: 'Gradle',
    zhNote: 'Kotlin DSL 是默认构建脚本', enNote: 'Kotlin DSL is the default build script',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#02303A"/><path d="M22 50 L42 36 L48 42 L66 30 L70 38 L48 52 L42 46 L26 56 Z" fill="#02B9CD"/></svg>,
  },
  {
    href: 'https://www.jetbrains.com/compose-multiplatform/', highlight: true,
    zhName: 'Compose Multiplatform', enName: 'Compose Multiplatform',
    zhNote: 'Android+iOS+Desktop+Web 一份 UI', enNote: 'Android+iOS+Desktop+Web from one UI',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><defs><linearGradient id="cmp-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7F52FF"/><stop offset="100%" stopColor="#C811E2"/></linearGradient></defs><rect width="100" height="100" rx="20" fill="url(#cmp-g)"/><circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeWidth="3"/><circle cx="50" cy="50" r="10" fill="#fff"/></svg>,
  },
  {
    href: 'https://ktor.io',
    zhName: 'Ktor', enName: 'Ktor',
    zhNote: 'JetBrains 自家协程式 web 框架', enNote: 'JetBrains coroutine-native web framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#000"/><path d="M30 30 H40 V46 L60 30 H72 L52 50 L72 70 H60 L40 54 V70 H30 Z" fill="#7F52FF"/></svg>,
  },
  {
    href: 'https://github.com/JetBrains/kotlin',
    zhName: 'GitHub', enName: 'GitHub',
    zhNote: 'JetBrains/kotlin · 开源主仓', enNote: 'JetBrains/kotlin · main repo',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="45" fill="#181717"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 V73 C32 75 30 70 30 70 C28 66 26 65 26 65 C23 63 26 63 26 63 C29 63 31 66 31 66 C34 71 39 70 41 69 C42 67 43 65 44 64 C36 63 28 60 28 47 C28 43 29 40 31 38 C31 37 30 33 32 28 C32 28 35 27 41 31 C44 30 47 30 50 30 C53 30 56 30 59 31 C65 27 68 28 68 28 C70 33 69 37 69 38 C71 40 72 43 72 47 C72 60 64 63 56 64 C58 65 59 67 59 70 V80 C72 76 82 64 82 50 C82 32 68 18 50 18 Z" fill="#fff"/></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'Cash App',        zhDesc: 'Square · KMP 共享核心交易层', enDesc: 'Square · KMP-powered core' },
  { name: 'Netflix',         zhDesc: 'Android 全 Kotlin', enDesc: 'Android, all Kotlin' },
  { name: 'Pinterest',       zhDesc: 'Android Kotlin 化迁移', enDesc: 'Migrated Android to Kotlin' },
  { name: 'Trello',          zhDesc: 'Atlassian · 早期采用者', enDesc: 'Atlassian · early adopter' },
  { name: 'Airbnb',          zhDesc: 'Android · Mavericks', enDesc: 'Android · Mavericks' },
  { name: 'Uber',            zhDesc: 'Android Kotlin', enDesc: 'Android Kotlin' },
  { name: 'Slack (mobile)',  zhDesc: '客户端 Kotlin', enDesc: 'Mobile Kotlin' },
  { name: 'Gradle',          zhDesc: 'Kotlin DSL 默认构建脚本', enDesc: 'Kotlin DSL build scripts' },
  { name: 'Spring Boot',     zhDesc: 'Kotlin 与 Java 平起平坐', enDesc: 'Kotlin alongside Java' },
  { name: 'Ktor',            zhDesc: 'JetBrains 协程式 web 框架', enDesc: 'JetBrains coroutine web framework' },
  { name: 'IntelliJ IDEA',   zhDesc: '部分模块 Kotlin 自举', enDesc: 'Self-hosting modules in Kotlin' },
  { name: 'Android Studio',  zhDesc: '官方开发工具', enDesc: 'Official IDE' },
  { name: 'Coil / Ktor / Exposed', zhDesc: 'Kotlin-first 库矩阵', enDesc: 'Kotlin-first library suite' },
  { name: 'Arrow',           zhDesc: 'Kotlin 函数式扩展', enDesc: 'FP extensions for Kotlin' },
  { name: 'Compose for Web', zhDesc: 'K/Wasm · 浏览器原生', enDesc: 'K/Wasm · runs in the browser' },
  { name: 'Touchlab Kermit', zhDesc: 'KMP 多端日志库', enDesc: 'KMP cross-platform logging' },
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
    tag: <>HOT · 2024</>, hot: true, big: true,
    zh: {
      title: <>Compose Multiplatform for iOS — stable</>,
      body: (<>
        <p>JetBrains 2024 年 5 月正式宣布 <strong>Compose Multiplatform for iOS</strong> 进入 stable。意味着<strong>一份 Kotlin Compose 代码同时跑在 Android、iOS、桌面、Web</strong>——而且 UI 是声明式的，与 SwiftUI / Jetpack Compose 同代。</p>
        <p>对比 Flutter 的"Skia 自画 + Dart"或 React Native 的"JS 桥到原生 view"，Compose Multiplatform 走的是<strong>原生 + Kotlin 直编 native</strong>路线：iOS 上 Kotlin 编到 LLVM 直出原生二进制，UI 复用 Compose 渲染层。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">React Native (JS bridge)</span><span className="bar-val">~2 端</span></div>
          <div className="bar bar-new"><span className="bar-label">Compose Multiplatform</span><span className="bar-val">4 端</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Compose Multiplatform for iOS — stable</>,
      body: (<>
        <p>JetBrains officially shipped <strong>Compose Multiplatform for iOS</strong> as stable in May 2024. One <strong>Kotlin Compose codebase running on Android, iOS, Desktop and Web</strong> — declarative UI on par with SwiftUI / Jetpack Compose.</p>
        <p>Compared to Flutter's "Skia self-painted + Dart" or React Native's "JS bridge to native views," Compose Multiplatform takes the <strong>native-binary + Kotlin-to-LLVM</strong> route: on iOS, Kotlin compiles straight to native through LLVM, with the Compose renderer sitting on top.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">React Native (JS bridge)</span><span className="bar-val">~2 targets</span></div>
          <div className="bar bar-new"><span className="bar-label">Compose Multiplatform</span><span className="bar-val">4 targets</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'K2',
    zh: { title: <>K2 编译器 — ~2× 提速</>, body: <><p>2024 年 Kotlin 2.0 把 K2 编译器从 alpha 推到 stable。整套类型推断 / 解析重写，常见项目<strong>类型检查快约 2×</strong>，并为 KMP 多目标 + 未来语法演进打底。</p></> },
    en: { title: <>K2 compiler — ~2× faster</>, body: <><p>Kotlin 2.0 in 2024 promoted the K2 compiler from alpha to stable. Type inference / resolution were rewritten end-to-end, giving common projects <strong>~2× faster type checks</strong> and a foundation for KMP and future syntax growth.</p></> },
  },
  {
    tag: 'WASM',
    zh: { title: <>Compose for Web on K/Wasm</>, body: <><p>Kotlin/Wasm 是 KMP 第四个目标：浏览器里直接跑原生 Kotlin 编出来的 Wasm，性能直追原生。Compose for Web 在此之上叠声明式 UI——意味着 Kotlin 也开始<strong>吃 WebAssembly</strong>。</p></> },
    en: { title: <>Compose for Web on K/Wasm</>, body: <><p>Kotlin/Wasm is KMP's fourth target: native-compiled Kotlin runs inside the browser as WebAssembly, near-native performance. Compose for Web puts declarative UI on top — Kotlin <strong>eats WebAssembly</strong> too.</p></> },
  },
  {
    tag: 'ANDROID',
    zh: { title: <>~80%+ Android 开发者已用 Kotlin</>, body: <><p>Google 2024 数据：<strong>专业 Android 开发者中 80% 以上</strong>主要使用 Kotlin。Jetpack Compose（Android 声明式 UI）也是 Kotlin-only，逼着 Android 圈 100% Kotlin 化。</p></> },
    en: { title: <>80%+ of Android devs on Kotlin</>, body: <><p>Google 2024: <strong>over 80% of professional Android developers</strong> primarily use Kotlin. Jetpack Compose (Android's declarative UI) is Kotlin-only — pushing the Android world to full Kotlin.</p></> },
  },
  {
    tag: 'BACKEND',
    zh: { title: <>Spring Boot 3.x — Kotlin 与 Java 并列</>, body: <><p>Spring Boot 3 文档把 Kotlin 与 Java 视为同级——所有示例双语版本。Kotlin 协程接进 Spring WebFlux，反应式服务端可以用同步语法写。Ktor 与 http4k 在小而美的 JVM 服务端阵地里站住脚。</p></> },
    en: { title: <>Spring Boot 3.x — Kotlin = Java</>, body: <><p>Spring Boot 3 docs treat Kotlin as a peer of Java — every sample dual-coded. Kotlin coroutines plug into Spring WebFlux, reactive servers written in sync style. Ktor and http4k carve out the lightweight-JVM-server niche.</p></> },
  },
  {
    tag: 'KMP',
    zh: { title: <>KMP vs Flutter / RN 的拉锯</>, body: <><p>KMP 走"<strong>共享业务、UI 各端原生</strong>"，Flutter 走"<strong>统一 Skia 自画 UI</strong>"。前者改造成本低（已有 native app 局部接入即可），后者全新写更整齐。2025 大厂选型基本：<em>已有 Android+iOS app → KMP；从零做新产品 → Flutter</em>。</p></> },
    en: { title: <>KMP vs Flutter / RN tug-of-war</>, body: <><p>KMP says "<strong>share logic, native UI per platform</strong>"; Flutter says "<strong>one Skia-painted UI everywhere</strong>." KMP wins for incremental adoption (drop into existing apps); Flutter wins for greenfield uniformity. The 2025 split: <em>existing Android+iOS app → KMP; brand-new product → Flutter</em>.</p></> },
  },
];

export default function KotlinIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Kotlin : Better Java — 从 Android 一等公民到 Multiplatform 时代',
    'Kotlin : Better Java — from Android first-class to the Multiplatform era',
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
      <div ref={rootRef} className="kotlin-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="kl-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7F52FF" />
                  <stop offset="100%" stopColor="#C811E2" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#kl-nav)" />
              <polygon points="68,60 188,60 128,128" fill="#fff" />
              <polygon points="68,60 128,128 68,196" fill="#fff" />
              <polygon points="128,128 188,196 68,196" fill="#fff" />
            </svg>
            <span>Kotlin</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#ai"><L zh="多端时代" en="Multiplatform" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Java" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2010 — 2026 · JetBrains · St. Petersburg, Kotlin Island</div>
            <h1 className="hero-title">
              <span className="hero-name">Kotlin</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">BetterJava</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>给 JVM 一门"<strong>务实派</strong>"语言：保持 100% Java 互操作，但删掉所有样板、把 null safety 写进类型系统。十四年后，它是 Android 的官方语言、Cash App / Netflix / Spring 的母语，还把 Kotlin Multiplatform 做到了 Android+iOS+桌面+Web 一份代码同跑。</>}
                en={<>A <strong>pragmatic</strong> language for the JVM: keep 100% Java interop, strip the boilerplate, write null safety into the type system. Fourteen years later it is Android's official language, the native tongue of Cash App / Netflix / Spring, and the engine of Kotlin Multiplatform — Android + iOS + Desktop + Web from one codebase.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1.0<small></small></span>
                <span className="stat-label"><L zh={<>2016-02 稳定版<br /><em>backwards-compat 起锚</em></>} en={<>1.0 stable in Feb 2016<br /><em>backwards-compat anchor</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2019<small></small></span>
                <span className="stat-label"><L zh={<>Android Kotlin-first<br /><em>Google I/O 官方推荐</em></>} en={<>Android Kotlin-first<br /><em>Google I/O recommendation</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2024<small></small></span>
                <span className="stat-label"><L zh={<>KMP iOS 进入 stable<br /><em>4 端共享 Kotlin</em></>} en={<>KMP iOS hits stable<br /><em>4 targets, one Kotlin</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~2<small>×</small></span>
                <span className="stat-label"><L zh={<>K2 编译器加速<br /><em>2024 Kotlin 2.0</em></>} en={<>K2 compiler speed-up<br /><em>2024 Kotlin 2.0</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <div className="hero-cube-face f-front">{KOTLIN_LOGO_SVG}</div>
            </div>
            <div className="hero-floats">
              <span className="float f1">val</span>
              <span className="float f2">String?</span>
              <span className="float f3">data class</span>
              <span className="float f4">suspend fun</span>
              <span className="float f5">sealed</span>
              <span className="float f6">@Composable</span>
              <span className="float f7">expect / actual</span>
              <span className="float f8">by lazy</span>
              <span className="float f9">when {'{'} ... {'}'}</span>
              <span className="float f10">it</span>
              <span className="float f11">{'Flow<T>'}</span>
              <span className="float f12">coroutineScope</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Kotlin</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Kotlin 是 JetBrains 设计的<strong>静态类型 JVM 语言</strong>。它给自己的定位很简单：<em>替代 Java，但 100% 互操作</em>。可以一个项目里 Kotlin 与 Java 文件混着写、互相 <code>import</code>、共用 build。Kotlin 把 Java 23 年攒下来的样板（getter / setter / equals / final / NPE）扫掉，但不抛弃 JVM 生态——这是它"务实"的核心。</>}
                  en={<>Kotlin is a <strong>statically-typed JVM language</strong> from JetBrains. Its self-positioning is simple: <em>replace Java, but with 100% interop</em>. Mix Kotlin and Java files in one project, import each way, share builds. Kotlin sweeps away 23 years of Java boilerplate (getters, setters, equals, final, NPE) without throwing away the JVM ecosystem — that's the core of its "pragmatism."</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="JVM 兼容" en="JVM-compatible" />, tag: 'interop', p: <L zh={<>编出来的就是普通 JVM bytecode。任何 Java 类直接 <code>import</code>，反过来 Java 调 Kotlin 也行。<strong>不用换生态</strong>，逐文件迁移。</>} en={<>Compiles to plain JVM bytecode. Java classes import as-is, and Java can call Kotlin back. <strong>No ecosystem swap</strong> — migrate file by file.</>} /> },
                { h: <L zh="务实主义" en="Pragmatic" />, tag: 'pragmatic', p: <L zh={<>不像 Scala 把"漂亮的类型理论"堆上天。Kotlin 的设计准则是"<strong>可读 &gt; 巧妙</strong>"——只要 Java 程序员能看懂，宁愿砍掉花式特性。</>} en={<>Unlike Scala, Kotlin doesn't pile on type theory for elegance. Its design rule: "<strong>readable beats clever</strong>" — features get cut if a Java developer can't read them at a glance.</>} /> },
                { h: <L zh="多目标" en="Multi-target" />, tag: 'multiplatform', p: <L zh={<>同一份 Kotlin 源码可以编到 JVM bytecode（Android / 服务端）/ native（iOS / Linux / macOS）/ JS / Wasm。<strong>共享业务，UI 各端原生</strong>。</>} en={<>The same Kotlin source compiles to JVM bytecode (Android / backend), native (iOS / Linux / macOS), JS, or Wasm. <strong>Share logic, keep UI native per platform</strong>.</>} /> },
                { h: <L zh="编译期 Null-safe" en="Null-safe" />, tag: 'null-safe', p: <L zh={<><code>T?</code> 与 <code>T</code> 是<strong>两个不同类型</strong>。访问可空值必须用 <code>?.</code> / <code>?:</code> / <code>!!</code>。NPE 在 IDE 就喊停。</>} en={<><code>T?</code> and <code>T</code> are <strong>two distinct types</strong>. Reaching into a nullable requires <code>?.</code> / <code>?:</code> / <code>!!</code>. NPE flagged in the IDE before you save.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">User.java</span><span className="lang-tag js">Java</span></div>
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
                  <span className="cl-c"><L zh="// 60 行样板，IDE 自动生成 — 但还要维护" en="// 60 lines of boilerplate, IDE-generated — still has to be maintained" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">User.kt</span><span className="lang-tag ts">Kotlin</span></div>
                <pre className="code"><code>
                  <span className="cl-k">data class</span> <span className="cl-type">User</span>(<span className="cl-k">val</span> <span className="cl-v">name</span>: <span className="cl-type">String</span>, <span className="cl-k">val</span> <span className="cl-v">age</span>: <span className="cl-type">Int</span>){'\n\n'}
                  <span className="cl-c"><L zh="// 一行 — 自动生成 equals/hashCode/copy/toString/解构" en="// One line — equals/hashCode/copy/toString/destructure auto-generated" /></span>{'\n\n'}
                  <span className="cl-k">val</span> <span className="cl-v">a</span> = <span className="cl-fn">User</span>(<span className="cl-s">"Andrey"</span>, <span className="cl-n">42</span>){'\n'}
                  <span className="cl-k">val</span> <span className="cl-v">b</span> = <span className="cl-v">a</span>.<span className="cl-fn">copy</span>(<span className="cl-prop">age</span> = <span className="cl-n">43</span>){'\n'}
                  <span className="cl-k">val</span> (<span className="cl-v">n</span>, <span className="cl-v">y</span>) = <span className="cl-v">b</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 编出来的 .class 与 Java 互认 — 100% 互操作" en="// The .class is interop-compatible with Java — 100%" /></span>
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
                zh={<>从圣彼得堡 JetBrains 内部一个"自家用的 Better Java"项目，到 14 年后成为 Android 官方语言、KMP 撑起跨端共享层、Compose Multiplatform 把一份 UI 推到 4 端。</>}
                en={<>From an internal "Better Java for ourselves" project in St. Petersburg JetBrains to Android's official language, to KMP powering shared cross-platform layers and Compose Multiplatform putting one UI on four targets — 14 years.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: KotlinAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>Kotlin 的特性矩阵很大，但日常 90% 用得到的就是下面这八件套：null safety、data class、扩展函数、协程、sealed class、lambda + DSL、inline / value class、属性委托。</>}
                en={<>Kotlin has a wide feature matrix, but day-to-day 90% comes down to these eight: null safety, data classes, extension functions, coroutines, sealed classes, lambdas + DSL builders, inline / value classes, and property delegation.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {KT_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh="属性委托 by lazy" en="Delegated properties" /></h3>
                <p><L
                  zh={<>第八件：<code>by</code> 让属性的 get/set 委托给另一个对象。<code>by lazy</code> 写懒加载、<code>by Delegates.observable</code> 写监听、<code>by ViewModel()</code> 写 Android 注入——一行话搞定。</>}
                  en={<>The eighth: <code>by</code> delegates a property's getter/setter to another object. <code>by lazy</code> for lazy init, <code>by Delegates.observable</code> for change listeners, <code>by ViewModel()</code> for Android injection — all one-liners.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>务实主义不是少做事，是把样板代码从你眼前移走。</>}
                  en={<>Pragmatism isn't doing less — it's moving the boilerplate out of your line of sight.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Kotlin" /> <code>: WhyKotlin</code></h2>
              <p className="sec-desc"><L
                zh={<>JVM 上不缺"Better Java"——Scala / Groovy / Clojure 都试过。Kotlin 之所以胜出，是因为它每一项设计取舍都偏向<strong>能用、易迁、Java 程序员看得懂</strong>。</>}
                en={<>The JVM has no shortage of "Better Java" candidates — Scala, Groovy, Clojure all tried. Kotlin won because every design trade-off leaned toward <strong>usable, easy to migrate, readable to Java developers</strong>.</>}
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
                zh={<>从手机里的支付 app 到流媒体 Android 客户端，从 IDE 到 build 工具——Kotlin 已是 JVM 与 Android 世界的事实主流。下面 12 个项目代表了它的覆盖面。</>}
                en={<>From mobile payment apps to streaming Android clients, from IDEs to build tools — Kotlin is the de facto mainstream of the JVM and Android worlds. The 12 below sample its reach.</>}
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

          {/* 06 Multiplatform Era */}
          <section className="section section-ai" id="ai">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="Android 反向收编 +" en="Android takeover +" /> <code>: <L zh="Multiplatform 时代" en="Multiplatform Era" /></code></h2>
              <p className="sec-desc"><L
                zh={<>Kotlin 这一路有两次"杠杆时刻"。第一次是 2017 Google 把它吸进 Android，第二次是 2023 KMP / 2024 Compose Multiplatform iOS stable——一份 Kotlin 同时统治 Android+iOS+桌面+Web。这一章讲后者：<strong>Kotlin 已经从 Android 的语言变成跨端共享层的共同选择</strong>。</>}
                en={<>Kotlin had two leverage moments. First: Google adopting it into Android in 2017. Second: KMP in 2023 and Compose Multiplatform for iOS stable in 2024 — one Kotlin covering Android + iOS + Desktop + Web. This chapter is about the second leg: <strong>Kotlin has gone from "Android's language" to the shared cross-platform layer of choice</strong>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>当我们把 Kotlin 设计成"<strong>务实派</strong>"的时候，目标只有一个：让 Java 程序员看到代码<strong>不需要解释就能上手</strong>。研究型的语言可以漂亮、可以前卫，但日常 95% 的代码不需要花式——要的是<strong>清楚、互通、易迁移</strong>。Kotlin 走过的每一步都按这条原则去取舍。</>}
                en={<>When we set out to make Kotlin a <strong>pragmatic</strong> language, we had one goal: a Java developer should be able to read Kotlin code <strong>and just understand it</strong>, with no explanation. Research languages can be beautiful, can be avant-garde — but 95% of day-to-day code isn't fancy. It needs to be <strong>clear, interoperable, easy to migrate</strong>. Every Kotlin design trade-off has been made on that principle.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Andrey Breslav</span>
                <span className="quote-context"><L zh="Kotlin 首席语言设计师 (2010–2020) · KotlinConf" en="Kotlin Lead Language Designer (2010–2020) · KotlinConf" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">80<small>%+</small></div>
                <div className="ai-stat-h"><L zh="Android 专业开发者已用 Kotlin" en="of pro Android devs use Kotlin" /></div>
                <p><L
                  zh={<>Google 2024 数据：超过 <strong>80%</strong> 的专业 Android 开发者主要使用 Kotlin。Jetpack Compose（声明式 UI）也是 Kotlin-only——把整个 Android UI 圈推向 100% Kotlin 化。</>}
                  en={<>Google 2024: over <strong>80%</strong> of professional Android developers are primarily on Kotlin. Jetpack Compose is Kotlin-only — pulling the entire Android UI world toward fully Kotlin.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">4<small> targets</small></div>
                <div className="ai-stat-h"><L zh="Compose Multiplatform 同跑端数" en="Compose Multiplatform target count" /></div>
                <p><L
                  zh={<>2024-05 起 stable：<strong>Android · iOS · Desktop · Web</strong>。一份 Kotlin <code>@Composable</code>，四端 UI 同时给出。iOS 端走 Kotlin/Native 编 LLVM 直出二进制——不是 RN 那种 JS 桥。</>}
                  en={<>Stable since 2024-05: <strong>Android · iOS · Desktop · Web</strong>. One Kotlin <code>@Composable</code>, UI on all four. iOS uses Kotlin/Native compiling through LLVM to a real binary — not an RN-style JS bridge.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">~2<small>×</small></div>
                <div className="ai-stat-h"><L zh="K2 编译器加速" en="K2 compiler speed-up" /></div>
                <p><L
                  zh={<>2024 Kotlin 2.0 把 K2 编译器推 stable，整套类型推断 / 解析重写。常见项目<strong>类型检查约快 2×</strong>，并为 KMP 多目标 + 未来语法做 baseline。</>}
                  en={<>Kotlin 2.0 in 2024 promoted K2 to stable with a full rewrite of type inference and resolution. Common projects see <strong>~2× faster type checks</strong>, and K2 sets the baseline for KMP's multi-target growth.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Compose Multiplatform <span className="spotlight-meta">— <L zh="一份 UI 跑 4 端" en="One UI, four targets" /></span></h3>
                  <p><L
                    zh={<>JetBrains 把 Google 的 Jetpack Compose（Android 声明式 UI）port 到桌面、iOS、Web。同一份 Kotlin <code>@Composable</code> 函数，<strong>原生编译</strong>到不同平台：Android 走 JVM bytecode、iOS 走 Kotlin/Native + LLVM、桌面走 JVM、Web 走 K/Wasm。</>}
                    en={<>JetBrains ported Google's Jetpack Compose (Android's declarative UI) to Desktop, iOS, and Web. The same Kotlin <code>@Composable</code> function compiles <strong>natively</strong> per target: Android uses JVM bytecode; iOS uses Kotlin/Native through LLVM; Desktop runs JVM; Web runs K/Wasm.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Kotlin/JVM</strong> — <L zh="Android · 桌面 · 服务端" en="Android · Desktop · server" /></li>
                    <li><strong>Kotlin/Native</strong> — <L zh="iOS · macOS · Linux · Windows，编 LLVM 直出二进制" en="iOS · macOS · Linux · Windows — straight to LLVM binary" /></li>
                    <li><strong>Kotlin/Wasm</strong> — <L zh="浏览器原生，性能近原生" en="Browser-native, near-native performance" /></li>
                    <li><strong>expect / actual</strong> — <L zh="平台差异点显式声明，编译时归位" en="Per-platform differences declared explicitly, resolved at compile time" /></li>
                  </ul>
                  <p><L
                    zh={<>对比：<strong>Flutter</strong> 走"Skia 自画 + Dart"，<strong>React Native</strong> 走"JS 桥到原生 view"，Compose Multiplatform 走<strong>原生编译 + 共享渲染层</strong>。已有 native app 增量接入这条路最顺。</>}
                    en={<>Compare: <strong>Flutter</strong> goes "Skia self-painted + Dart"; <strong>React Native</strong> goes "JS bridge to native views"; Compose Multiplatform takes the <strong>native-binary + shared renderer</strong> route. Best fit for incremental adoption into existing apps.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="// commonMain — 一份 UI 给所有端" en="// commonMain — one UI, all targets" /></span>{'\n'}
                    <span className="cl-k">@Composable</span>{'\n'}
                    <span className="cl-k">fun</span> <span className="cl-fn">App</span>() {'{'}{'\n'}
                    {'  '}<span className="cl-k">var</span> <span className="cl-v">count</span> <span className="cl-k">by</span> <span className="cl-fn">remember</span> {'{ '}<span className="cl-fn">mutableStateOf</span>(<span className="cl-n">0</span>) {' }'}{'\n\n'}
                    {'  '}<span className="cl-fn">Column</span>(<span className="cl-fn">Modifier</span>.<span className="cl-fn">padding</span>(<span className="cl-n">16</span>.<span className="cl-prop">dp</span>)) {'{'}{'\n'}
                    {'    '}<span className="cl-fn">Text</span>(<span className="cl-s">"Clicked $count times"</span>){'\n'}
                    {'    '}<span className="cl-fn">Button</span>(<span className="cl-prop">onClick</span> = {'{ '}<span className="cl-v">count</span>++ {' }'}) {'{'}{'\n'}
                    {'      '}<span className="cl-fn">Text</span>(<span className="cl-s">"Click me"</span>){'\n'}
                    {'    '}{'}'}{'\n'}
                    {'  '}{'}'}{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c"><L zh="// 同一段代码 ─ Android / iOS / Desktop / Web" en="// Same code — Android / iOS / Desktop / Web" /></span>{'\n'}
                    <span className="cl-c"><L zh="// 各自原生编译, 没有桥" en="// Native compile per target, no bridge" /></span>
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
                <div className="ai-reverse-tag">KMP vs OTHERS</div>
                <h3><L zh="KMP vs Flutter / React Native" en="KMP vs Flutter / React Native" /></h3>
                <p><L
                  zh={<>三者都解"<strong>跨端共享代码</strong>"问题，但路径完全不同。</>}
                  en={<>All three solve <strong>"share code across platforms"</strong> — but along very different paths.</>}
                /></p>
                <p><L
                  zh={<><strong>Flutter</strong>（Google）：UI 用 Skia 自画，Dart 写一切。整齐、跨端一致，但 native look 永远差一口气；接进已有 native app 比较硬。</>}
                  en={<><strong>Flutter</strong> (Google): UI is Skia self-painted, Dart end to end. Uniform across platforms, but the "native feel" never quite arrives; hard to drop into an existing native app.</>}
                /></p>
                <p><L
                  zh={<><strong>React Native</strong>（Meta）：JS 写业务，桥过去调原生 view。UI 是真原生，但桥的开销与异步链路是甩不掉的痛点。</>}
                  en={<><strong>React Native</strong> (Meta): JS for business logic, bridge to native views. UI is genuinely native, but the bridge overhead and async chains never quite go away.</>}
                /></p>
                <p><L
                  zh={<><strong>KMP</strong>（JetBrains）：业务逻辑共享 Kotlin，编出 native 二进制；UI<strong>各端用各端的</strong>（Compose Multiplatform 是可选的统一选项）。最适合<strong>已有 Android+iOS app</strong>的渐进迁移——Cash App / Netflix 走的就是这条。</>}
                  en={<><strong>KMP</strong> (JetBrains): share Kotlin for business logic, compile to native binary; UI <strong>stays platform-native</strong> (Compose Multiplatform is an optional unifier). Best fit for <strong>existing Android+iOS apps</strong> migrating gradually — the Cash App / Netflix route.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// commonMain/UserRepo.kt" en="// commonMain/UserRepo.kt" /></span>{'\n'}
                  <span className="cl-k">expect class</span> <span className="cl-type">PlatformDb</span>(){'\n'}
                  <span className="cl-k">class</span> <span className="cl-type">UserRepo</span>(<span className="cl-k">val</span> <span className="cl-v">db</span>: <span className="cl-type">PlatformDb</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-k">suspend fun</span> <span className="cl-fn">fetch</span>(<span className="cl-v">id</span>: <span className="cl-type">Long</span>): <span className="cl-type">User</span> = ...{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// androidMain/PlatformDb.kt" en="// androidMain/PlatformDb.kt" /></span>{'\n'}
                  <span className="cl-k">actual class</span> <span className="cl-type">PlatformDb</span>(<span className="cl-k">val</span> <span className="cl-v">ctx</span>: <span className="cl-type">Context</span>){'\n\n'}
                  <span className="cl-c"><L zh="// iosMain/PlatformDb.kt" en="// iosMain/PlatformDb.kt" /></span>{'\n'}
                  <span className="cl-k">actual class</span> <span className="cl-type">PlatformDb</span>(<span className="cl-k">val</span> <span className="cl-v">store</span>: <span className="cl-type">NSUserDefaults</span>){'\n\n'}
                  <span className="cl-c"><L zh="// 业务逻辑 100% 共享, 平台细节各自 actual" en="// Business logic 100% shared; platform details actual'd per target" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结：" en="In one line: " /></strong><L
                zh={<>Kotlin 的两次"杠杆时刻"——2017 进 Android、2023 KMP / 2024 Compose iOS——把它从"JVM 上的 Better Java"推上了"<strong>跨端共享层的事实选择</strong>"。务实主义十四年磨成的优势，正在多端时代变现。</>}
                en={<>Kotlin's two leverage moments — 2017 (Android adoption) and 2023 KMP / 2024 Compose iOS stable — pushed it from "a Better Java for the JVM" to "<strong>the de-facto cross-platform shared layer</strong>." Fourteen years of pragmatism cashing in, in the multiplatform era.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Java / Swift */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Java / Swift" /> <code>: Kotlin vs Java vs Swift</code></h2>
              <p className="sec-desc"><L
                zh={<>Kotlin 在 JVM 端跟 <strong>Java</strong> 比，在 iOS 端跟 <strong>Swift</strong> 比。三者长得很像（都是静态类型 + null safety + 现代语法），但出身、生态、跨端故事差出一截。</>}
                en={<>On the JVM, Kotlin's foil is <strong>Java</strong>. On iOS, it's <strong>Swift</strong>. The three look surprisingly similar (statically typed, null-safe, modern syntax), but their lineage, ecosystem, and cross-platform stories diverge.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Java</th>
                  <th className="th-ts">Kotlin</th>
                  <th className="th-sw">Swift</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Sun · 1995</>,
                    ts: <>JetBrains · 2010</>,
                    sw: <>Apple · 2014</> },
                  { k: <L zh="主要平台" en="Primary platform" />,
                    js: <L zh="JVM (服务端 / Android)" en="JVM (server / Android)" />,
                    ts: <L zh="JVM / Android · KMP 跨端" en="JVM / Android · KMP cross-platform" />,
                    sw: <L zh="iOS / macOS / Apple" en="iOS / macOS / Apple" /> },
                  { k: <L zh="Null 安全" en="Null safety" />,
                    js: <L zh="到处可能 NPE" en="NPE everywhere" />,
                    ts: <><code>T?</code> / <code>T</code></>,
                    sw: <><code>T?</code> / <code>T</code></> },
                  { k: <L zh="数据类" en="Value class" />,
                    js: <L zh={<>Java 14 起有 <code>record</code></>} en={<>Java 14+ has <code>record</code></>} />,
                    ts: <><code>data class</code> · 2016 起</>,
                    sw: <><code>struct</code></> },
                  { k: <L zh="协程 / async" en="Coroutines / async" />,
                    js: <L zh={<>Java 21+ <code>virtual threads</code></>} en={<>Java 21+ virtual threads</>} />,
                    ts: <L zh={<><code>suspend</code> / <code>Flow</code> · 结构化并发</>} en={<><code>suspend</code> / <code>Flow</code> · structured concurrency</>} />,
                    sw: <><code>async / await</code> · <code>Task</code></> },
                  { k: <L zh="模式匹配" en="Pattern matching" />,
                    js: <L zh={<>Java 21+ <code>switch</code> 模式</>} en={<>Java 21+ switch patterns</>} />,
                    ts: <><code>when</code> · sealed 穷尽</>,
                    sw: <><code>switch</code> · enum + associated</> },
                  { k: <L zh="扩展函数" en="Extension methods" />,
                    js: <L zh="无（要包装类）" en="None (need wrapper classes)" />,
                    ts: <L zh={<><code>fun T.foo()</code></>} en={<><code>fun T.foo()</code></>} />,
                    sw: <L zh={<><code>extension</code></>} en={<><code>extension</code></>} /> },
                  { k: <L zh="互操作" en="Interop" />,
                    js: <L zh="JVM 一切 · 老牌" en="Everything on JVM · the elder" />,
                    ts: <L zh={<>Java <strong>100%</strong> 互通</>} en={<><strong>100%</strong> Java interop</>} />,
                    sw: <L zh={<>Objective-C <strong>100%</strong>，C/C++ 需 bridging header</>} en={<>100% Objective-C; C/C++ via bridging header</>} /> },
                  { k: <L zh="跨端故事" en="Cross-platform" />,
                    js: <L zh="JVM 内即跨端" en="Cross-platform within JVM only" />,
                    ts: <L zh="KMP · 4 端共享" en="KMP · 4 targets shared" />,
                    sw: <L zh="基本 Apple 内（Linux 实验）" en="Mostly Apple (Linux experimental)" /> },
                  { k: <L zh="样板代码" en="Boilerplate" />,
                    js: <L zh="多（getter/setter/equals）" en="High (getters / setters / equals)" />,
                    ts: <L zh="少（data class / val / Lambda）" en="Low (data class / val / lambdas)" />,
                    sw: <L zh="少（struct / 自动 init）" en="Low (struct / auto init)" /> },
                  { k: <L zh="UI 框架" en="UI framework" />,
                    js: <L zh="Swing · JavaFX · Android" en="Swing · JavaFX · Android" />,
                    ts: <L zh="Jetpack Compose · Compose MP" en="Jetpack Compose · Compose MP" />,
                    sw: <L zh="SwiftUI" en="SwiftUI" /> },
                  { k: <L zh="构建工具" en="Build tool" />,
                    js: <L zh="Maven / Gradle (Groovy)" en="Maven / Gradle (Groovy)" />,
                    ts: <L zh="Gradle Kotlin DSL" en="Gradle Kotlin DSL" />,
                    sw: <L zh="Xcode · SwiftPM" en="Xcode · SwiftPM" /> },
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
                zh={<>Compose Multiplatform iOS 已 stable、K2 编译器已 stable、Kotlin/Wasm 进入 KMP 第四目标——四条路径并行推进，下一阶段比的是<strong>谁的跨端故事更顺手</strong>。</>}
                en={<>Compose Multiplatform iOS is stable, the K2 compiler is stable, Kotlin/Wasm joins KMP as the fourth target — four lanes moving at once. The next round is "<strong>whose cross-platform story flows better</strong>."</>}
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
                <li><a href="https://kotlinlang.org" target="_blank" rel="noopener">kotlinlang.org</a></li>
                <li><a href="https://play.kotlinlang.org" target="_blank" rel="noopener"><L zh="在线 Playground" en="Playground" /></a></li>
                <li><a href="https://kotlinlang.org/docs/home.html" target="_blank" rel="noopener"><L zh="官方文档" en="Documentation" /></a></li>
                <li><a href="https://github.com/JetBrains/kotlin" target="_blank" rel="noopener">GitHub Repo</a></li>
                <li><a href="https://blog.jetbrains.com/kotlin/" target="_blank" rel="noopener"><L zh="官方博客" en="Blog" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://kotlinlang.org/docs/coroutines-guide.html" target="_blank" rel="noopener"><L zh="协程 Guide" en="Coroutines Guide" /></a></li>
                <li><a href="https://kotlinlang.org/docs/multiplatform.html" target="_blank" rel="noopener">Kotlin Multiplatform</a></li>
                <li><a href="https://www.jetbrains.com/compose-multiplatform/" target="_blank" rel="noopener">Compose Multiplatform</a></li>
                <li><a href="https://kotlinlang.org/docs/k2-compiler-migration-guide.html" target="_blank" rel="noopener">K2 Migration</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / Data" /></h4>
              <ul>
                <li><a href="https://developer.android.com/kotlin" target="_blank" rel="noopener">Android · Kotlin</a></li>
                <li><a href="https://spring.io/guides/tutorials/spring-boot-kotlin" target="_blank" rel="noopener">Spring Boot + Kotlin</a></li>
                <li><a href="https://ktor.io" target="_blank" rel="noopener">Ktor</a></li>
                <li><a href="https://kotlinlang.org/docs/wasm-overview.html" target="_blank" rel="noopener">Kotlin/Wasm</a></li>
                <li><a href="https://github.com/Kotlin/kotlinx.coroutines" target="_blank" rel="noopener">kotlinx.coroutines</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生产案例" en="Production Cases" /></h4>
              <ul>
                <li><a href="https://cashapp.github.io" target="_blank" rel="noopener">Cash App · KMP</a></li>
                <li><a href="https://netflixtechblog.com" target="_blank" rel="noopener">Netflix Tech Blog</a></li>
                <li><a href="https://medium.com/airbnb-engineering" target="_blank" rel="noopener">Airbnb Engineering</a></li>
                <li><a href="https://kotlinlang.org/lp/multiplatform/case-studies/" target="_blank" rel="noopener">KMP Case Studies</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{KOTLIN_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`val future: Deferred<Multiplatform> = async { ecosystem }`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
