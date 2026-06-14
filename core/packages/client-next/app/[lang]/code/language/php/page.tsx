'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './php_intro.css';
import i18n from '@/i18n/i18n-client';

/* Stylised <?php glyph — official PHP purple square + open-tag wordmark.
 * Elephant felt too cute for the comeback-story tone; the open tag is the
 * single most iconic PHP shape and pairs better with the rest of the site. */
const PHP_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="ph-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9D9FD9" />
        <stop offset="100%" stopColor="#4F518C" />
      </linearGradient>
      <radialGradient id="ph-inner" cx="50%" cy="42%" r="68%">
        <stop offset="0%" stopColor="#8A8DCB" />
        <stop offset="100%" stopColor="#4F518C" />
      </radialGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#ph-grad)" />
    {/* the famous purple ellipse */}
    <ellipse cx="128" cy="128" rx="100" ry="60" fill="url(#ph-inner)" opacity=".85" />
    <ellipse cx="128" cy="128" rx="100" ry="60" fill="none" stroke="#E6E5F2" strokeWidth="2" opacity=".35" />
    {/* PHP wordmark */}
    <text
      x="128"
      y="146"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="52"
      fontWeight="900"
      fontFamily="'Trebuchet MS', 'Helvetica Neue', sans-serif"
      letterSpacing="-2"
      style={{ paintOrder: 'stroke' }}
    >
      php
    </text>
    {/* open-tag accents */}
    <text x="34" y="62" fill="#E6E5F2" fontSize="22" fontWeight="700" fontFamily="monospace" opacity=".55">{'<?'}</text>
    <text x="200" y="222" fill="#E6E5F2" fontSize="22" fontWeight="700" fontFamily="monospace" opacity=".55">{'?>'}</text>
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
    year: '1994',
    zh: { title: <>Rasmus Lerdorf 写 "Personal Home Page Tools"</>, desc: <>格陵兰人 Rasmus Lerdorf 在加拿大用 C 写了一组 Perl 脚本的替代品, 目的只是<strong>统计自己个人主页上简历被看了多少次</strong>。第一个名字是 <code>PHP/FI</code> — Personal Home Page / Forms Interpreter。<em>没有人想过这东西会变成行业基础设施</em>。</> },
    en: { title: <>Rasmus Lerdorf writes "Personal Home Page Tools"</>, desc: <>Rasmus Lerdorf, in Canada, builds a set of CGI binaries in C as a replacement for a stack of Perl scripts. The only goal: <strong>count how many times his online resume gets viewed</strong>. The first name is <code>PHP/FI</code> — Personal Home Page / Forms Interpreter. <em>Nobody, including the author, imagines this turning into industrial infrastructure</em>.</> },
  },
  {
    year: <>1995<small>·06·08</small></>,
    zh: { title: <>第一次公开发布 — PHP Tools 1.0</>, desc: <>6 月 8 日, Lerdorf 把源码发到 <code>comp.infosystems.www.authoring.cgi</code>。功能极简: 表单变量、GuestBook、用 HTML 嵌入 SQL。<em>"PHP 之父"和 PHP 的官方诞生日就是这一天</em>。</> },
    en: { title: <>First public release — PHP Tools 1.0</>, desc: <>June 8: Lerdorf posts the source to <code>comp.infosystems.www.authoring.cgi</code>. The feature set is tiny — form variables, a guestbook, SQL embedded in HTML. <em>This is the day PHP officially exists; June 8 is the language's birthday</em>.</> },
  },
  {
    year: <>1997<small>·夏</small></>, highlight: true,
    zh: { title: <>Zeev Suraski + Andi Gutmans 重写解析器 → PHP 3</>, desc: <>两位以色列理工 (Technion) 学生为了一个电商作业, 觉得 PHP/FI 2 的解析器没法扩展, <strong>从零重写</strong>。Lerdorf 同意把他们的版本作为 PHP 3 正式发布。<strong>"PHP" 的含义从此改为递归缩写 <code>PHP: Hypertext Preprocessor</code></strong>。</> },
    en: { title: <>Zeev Suraski + Andi Gutmans rewrite the parser → PHP 3</>, desc: <>Two Technion (Israeli Institute of Technology) students, working on an e-commerce class project, decide PHP/FI 2's parser is unextensible and <strong>rewrite it from scratch</strong>. Lerdorf agrees to ship their rewrite as PHP 3. From this point on <strong>"PHP" is officially a recursive acronym: <code>PHP: Hypertext Preprocessor</code></strong>.</> },
  },
  {
    year: <>1999</>,
    zh: { title: <>Zend Engine → PHP 4</>, desc: <>Suraski + Gutmans 成立 Zend (Ze + nd), 公司化运营 PHP 引擎。PHP 4 引入<strong>编译到中间字节码 + ZE1 解释执行</strong>的两阶段模型, 性能大跳。<em>从这年起 PHP 真正能扛 LAMP 时代的负载</em>。</> },
    en: { title: <>Zend Engine ships → PHP 4</>, desc: <>Suraski and Gutmans found Zend (Ze + nd), commercialising the PHP engine. PHP 4 introduces a <strong>two-phase compile-to-bytecode plus ZE1 interpreter</strong> model; performance leaps. <em>From this point PHP can actually carry the load of the LAMP era</em>.</> },
  },
  {
    year: <>2004<small>·07·13</small></>,
    zh: { title: <>PHP 5 — 真 OOP 来了</>, desc: <>引入<strong>新版 Zend Engine 2 (ZE2)</strong>、真正的对象模型 (引用语义, 不再是值拷贝)、<code>try/catch</code> 异常、PDO 数据库抽象。PHP 终于像一门"现代"语言。<em>WordPress 1.0 也是这年发布</em>, 两条命运从此交织。</> },
    en: { title: <>PHP 5 — real OOP arrives</>, desc: <>Brings <strong>Zend Engine 2 (ZE2)</strong>, a proper object model (reference semantics, no longer value-copy), <code>try/catch</code> exceptions, and the PDO database abstraction. PHP finally looks like a "modern" language. <em>WordPress 1.0 also ships this year</em> — the two destinies become intertwined from here.</> },
  },
  {
    year: <>2011<small>·06</small></>,
    zh: { title: <>Laravel 1.0 — Taylor Otwell 出场</>, desc: <>26 岁的 Taylor Otwell 把 CodeIgniter 不爽的地方全重做了一遍, 起名 <strong>Laravel</strong>。Eloquent ORM / Blade 模板 / Artisan CLI 的组合让"<em>Rails 风的 PHP 开发</em>"第一次可用。<strong>5 年内吃掉了 Symfony 的午餐</strong>, 成为 PHP 默认全栈框架。</> },
    en: { title: <>Laravel 1.0 — Taylor Otwell appears</>, desc: <>26-year-old Taylor Otwell redoes everything he disliked about CodeIgniter, names the result <strong>Laravel</strong>. Eloquent ORM + Blade templates + the Artisan CLI together make <em>"Rails-style PHP"</em> usable for the first time. <strong>It eats Symfony's lunch within five years</strong> and becomes the default full-stack framework for PHP.</> },
  },
  {
    year: <>2012<small>·04·01</small></>, highlight: true,
    zh: { title: <>Eevee 写下 "PHP: a fractal of bad design"</>, desc: <>4 月 1 日, 程序员 <strong>Eevee</strong> 发表那篇<strong>互联网上最被引用的语言批判文章</strong>。指出 PHP 函数命名混乱 (<code>strlen</code> vs <code>str_replace</code>)、参数顺序不一致、隐式转换坑、<code>==</code> 行为反直觉。<em>这篇文章的力量是: 它不是错的</em>——它点中的每一处, 之后十年 PHP 都在认真修。</> },
    en: { title: <>Eevee writes "PHP: a fractal of bad design"</>, desc: <>April 1: programmer <strong>Eevee</strong> publishes <strong>the most-cited language critique on the internet</strong>. It catalogues PHP's inconsistent function names (<code>strlen</code> vs <code>str_replace</code>), erratic parameter order, implicit conversion pitfalls, and counter-intuitive <code>==</code> behaviour. <em>The post's force is that it isn't wrong</em> — every single thing it lists is something PHP would spend the next decade actually fixing.</> },
  },
  {
    year: <>2012<small>·03</small></>,
    zh: { title: <>Composer 公开发布</>, desc: <>Nils Adermann + Jordi Boggiano 发布 <strong>Composer</strong>, 配合 Packagist 仓库。这是 PHP 第一次拥有<strong>类 npm 的依赖管理</strong>: <code>composer.json</code>、<code>require</code>、自动加载。<em>之后 PHP 项目结构整个变样</em>——从一堆 include 散文件变成现代包式工程。</> },
    en: { title: <>Composer goes public</>, desc: <>Nils Adermann and Jordi Boggiano ship <strong>Composer</strong>, paired with the Packagist registry. For the first time PHP has <strong>npm-style dependency management</strong>: <code>composer.json</code>, <code>require</code>, autoload. <em>The shape of every PHP project changes</em> — from a pile of include files into proper packaged engineering.</> },
  },
  {
    year: <>2013<small>·03</small></>,
    zh: { title: <>Facebook 公开 HHVM + Hack</>, desc: <>Facebook 写了一个<strong>JIT 编译 PHP 的虚拟机 HHVM</strong> (HipHop VM), 比官方 PHP 5 快 2-9 倍。同时放出自己魔改的方言 <strong>Hack</strong> — 强类型、async/await、generics。<em>第一次, PHP 团队感到外部威胁</em>: 如果不快, Facebook 就走自己的路。</> },
    en: { title: <>Facebook open-sources HHVM + Hack</>, desc: <>Facebook releases <strong>HHVM (HipHop VM)</strong>, a JIT for PHP that runs 2-9× faster than official PHP 5. Alongside it, their modified dialect <strong>Hack</strong> — strong typing, async/await, generics. <em>For the first time the PHP team feels an external threat</em>: if PHP doesn't get fast, Facebook will fork.</> },
  },
  {
    year: <>2015<small>·12·03</small></>, highlight: true,
    zh: { title: <>PHP 7 发布 — 性能火箭</>, desc: <>俄国编译器工程师 <strong>Dmitry Stogov</strong> 在 PHP 内部主导 <code>phpng</code> 分支, 把 Zend Engine 的内存结构整个重设计 — value 用 zval 紧凑表示, refcount + GC 联动, 几乎所有热路径重写。<strong>结果: 2× WordPress 性能, 同时把 HHVM 反超</strong>。<em>PHP 6 因为 Unicode 重构失败被跳过, 直接到 7</em>。</> },
    en: { title: <>PHP 7 ships — the performance rocket</>, desc: <>Russian compiler engineer <strong>Dmitry Stogov</strong> drives the internal <code>phpng</code> branch, redesigning Zend Engine's memory representation — values become compact zvals, refcount and GC interlock, virtually every hot path is rewritten. <strong>Result: 2× WordPress throughput, and PHP overtakes HHVM</strong>. <em>PHP 6 was skipped entirely after its Unicode overhaul failed — the version number jumps straight from 5 to 7</em>.</> },
  },
  {
    year: <>2017</>,
    zh: { title: <>Facebook 放弃 PHP — Hack 走自己的路</>, desc: <>Facebook 宣布 <strong>HHVM 不再向 PHP 兼容</strong>, Hack 完全分裂成独立语言。<em>表面看是 PHP 输了</em>; 实际是 PHP 7 已经够快, Facebook 没必要再做"双向兼容"的苦工。<strong>PHP 阵营反而松了一口气</strong>: 没了 Facebook 的牵制, 可以放手做语言设计。</> },
    en: { title: <>Facebook walks away from PHP — Hack splits off</>, desc: <>Facebook announces <strong>HHVM will no longer maintain PHP compatibility</strong>; Hack becomes a fully separate language. <em>On the surface PHP "lost"</em>; in reality PHP 7 is fast enough that Facebook no longer needs to do the two-way compatibility work. <strong>The PHP camp actually exhales</strong>: with Facebook's gravity gone, the language team is free to design without that constraint.</> },
  },
  {
    year: <>2020<small>·11·26</small></>, highlight: true,
    zh: { title: <>PHP 8.0 — JIT + 现代语法大爆发</>, desc: <>这是 PHP 真正变现代的版本。<strong>JIT 编译器</strong>进 Zend Engine (Stogov 又是主力); <strong>named arguments</strong>、<strong><code>match</code> 表达式</strong>、<strong>属性 (PHP 风 annotations, <code>#[...]</code>)</strong>、<strong>constructor property promotion</strong>、<strong>nullsafe operator <code>?-&gt;</code></strong>、<strong>union types</strong>。<em>一次性把 PHP 拉到 2020 年</em>。</> },
    en: { title: <>PHP 8.0 — JIT plus a modern-syntax explosion</>, desc: <>The version that genuinely makes PHP modern. <strong>JIT compiler</strong> lands in Zend Engine (Stogov again leading); <strong>named arguments</strong>; the <strong><code>match</code> expression</strong>; <strong>attributes (PHP-flavoured annotations, <code>#[...]</code>)</strong>; <strong>constructor property promotion</strong>; the <strong>nullsafe <code>?-&gt;</code> operator</strong>; <strong>union types</strong>. <em>One release drags PHP fully into the 2020s</em>.</> },
  },
  {
    year: <>2021<small>·11</small></>,
    zh: { title: <>PHP Foundation 成立</>, desc: <>Nikita Popov (PHP 内部大动作 8 年主力) 宣布转岗去做 Rust, 引发 PHP "<em>谁来养核心维护者</em>" 危机。JetBrains + Automattic + Laravel + Symfony 等公司联合成立 <strong>PHP Foundation</strong>, 第一年 60 万美元雇全职贡献者。<strong>PHP 第一次有了一个正经的财务底座</strong>。</> },
    en: { title: <>The PHP Foundation is founded</>, desc: <>Nikita Popov (8 years as a core PHP contributor and feature lead) announces he's leaving for Rust work, triggering a "<em>who funds the maintainers</em>" crisis. JetBrains, Automattic, Laravel, Symfony and others jointly stand up the <strong>PHP Foundation</strong>, raising USD 600k in year one to pay full-time contributors. <strong>For the first time PHP has a real financial backbone</strong>.</> },
  },
  {
    year: <>2021<small>·11·25</small></>,
    zh: { title: <>PHP 8.1 — enums / readonly / fibers</>, desc: <><strong>真 enum</strong> (终于不再用 const 假装)、<strong>readonly</strong> 属性、<strong>first-class callable syntax</strong> <code>strlen(...)</code>、<strong>纤程 Fibers</strong> (协作式并发, 给 amphp / ReactPHP 真原语)、纯交集类型。</> },
    en: { title: <>PHP 8.1 — enums / readonly / fibers</>, desc: <><strong>Real enums</strong> (no more faking with consts); <strong>readonly</strong> properties; <strong>first-class callable syntax</strong> <code>strlen(...)</code>; <strong>Fibers</strong> (cooperative concurrency — a real primitive for amphp / ReactPHP); pure intersection types.</> },
  },
  {
    year: <>2023<small>·11·23</small></>,
    zh: { title: <>PHP 8.3 — typed class constants</>, desc: <>类常量终于能写类型: <code>const string VERSION = '1.0'</code>。<code>json_validate()</code> 进 stdlib, 不再人肉 <code>json_decode + last_error</code>。<code>#[\\Override]</code> 属性强制声明覆盖。</> },
    en: { title: <>PHP 8.3 — typed class constants</>, desc: <>Class constants finally get types: <code>const string VERSION = '1.0'</code>. <code>json_validate()</code> enters stdlib — no more hand-rolled <code>json_decode + last_error</code> checks. The <code>#[\\Override]</code> attribute makes method-override intent explicit.</> },
  },
  {
    year: <>2024<small>·11·21</small></>, highlight: true,
    zh: { title: <>PHP 8.4 — property hooks + asymmetric visibility</>, desc: <>这是<strong>过去十年最大的语法变化</strong>之一: <strong>property hooks</strong> (类似 C# 的 get/set 直接挂在属性上, 不再写 getter/setter) + <strong>不对称可见性</strong> (<code>public private(set) string $name</code>)。<em>PHP 终于像 C# 了</em>——这话十年前没人敢说。</> },
    en: { title: <>PHP 8.4 — property hooks + asymmetric visibility</>, desc: <>The <strong>biggest syntax change in a decade</strong>: <strong>property hooks</strong> (C#-style get/set attached directly to a property — no more getter/setter pairs) and <strong>asymmetric visibility</strong> (<code>public private(set) string $name</code>). <em>PHP finally reads like C#</em> — a sentence no one would have dared write ten years ago.</> },
  },
  {
    year: '2026',
    zh: { title: <>"PHP 已死" 第 30 年</>, desc: <>2026 年现状: <strong>W3Techs 服务器端语言份额 ~75%</strong>, 仍然是<strong>互联网部署最广的后端语言</strong>。WordPress 跑在 40%+ 的网站上、Wikipedia 每天数十亿请求走 MediaWiki/PHP, Shopify 早期、Slack、Etsy、Wikipedia、Slack 都是 PHP 起家。<strong>Laravel 是 PHP 的默认全栈框架</strong>。"PHP 已死"是它特有的、永远的迷因。</> },
    en: { title: <>"PHP is dead" — year 30</>, desc: <>2026 state: <strong>W3Techs server-side share around 75%</strong>, still the <strong>most-deployed backend language on the internet</strong>. WordPress runs 40%+ of all websites; Wikipedia's billions of daily requests go through MediaWiki/PHP; Slack, Etsy, Shopify and Wikipedia all grew up on PHP. <strong>Laravel is the default full-stack framework</strong>. "PHP is dead" is the language's own forever-meme — repeated for thirty years while market share doesn't budge.</> },
  },
];

interface PhpCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const PHP_CARDS: PhpCard[] = [
  {
    tag: 'A',
    zh: { title: <>开闭标签 — <code>{'<?php ?>'}</code></>, desc: <>PHP 是<strong>嵌入 HTML</strong>设计的: 不写 <code>{'<?php'}</code> 的文件全是 HTML, 写了就是代码。<em>这就是为什么 PHP 模板天然好写, 也是为什么 PHP 不像"正经"的脚本语言</em>。</> },
    en: { title: <>Open / close tags — <code>{'<?php ?>'}</code></>, desc: <>PHP is designed to <strong>embed inside HTML</strong>: anything outside <code>{'<?php'}</code> is HTML, anything inside is code. <em>This is why PHP templating feels effortless — and also why PHP doesn't read like a "proper" scripting language</em>.</> },
    code: (
      <code>
        {'<!DOCTYPE html>'}{'\n'}
        {'<h1>Hello, '}<span className="cl-k">{'<?='}</span> <span className="cl-v">$user</span>-&gt;name <span className="cl-k">{'?>'}</span>{'</h1>'}{'\n\n'}
        <span className="cl-k">{'<?php'}</span>{'\n'}
        <span className="cl-k">foreach</span> (<span className="cl-v">$posts</span> <span className="cl-k">as</span> <span className="cl-v">$p</span>) {'{'}{'\n'}
        {'    '}<span className="cl-k">echo</span> <span className="cl-v">$p</span>-&gt;title;{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>变量前缀 <code>$</code></>, desc: <>所有变量必须以 <code>$</code> 开头。<strong>历史原因</strong>: 受 Perl 影响, 区分变量和裸字符串以便嵌进 HTML / SQL。<em>没人特别喜欢, 但 30 年了改不动</em>。</> },
    en: { title: <>The <code>$</code> sigil</>, desc: <>Every variable starts with <code>$</code>. <strong>Why</strong>: a Perl inheritance — it distinguishes variables from bare words when interpolating into HTML / SQL. <em>Nobody particularly loves it, but 30 years later it's untouchable</em>.</> },
    code: (
      <code>
        <span className="cl-v">$name</span> = <span className="cl-s">"world"</span>;{'\n'}
        <span className="cl-k">echo</span> <span className="cl-s">"Hello, </span><span className="cl-v">$name</span><span className="cl-s">!"</span>;  <span className="cl-c">// interpolation</span>{'\n'}
        <span className="cl-k">echo</span> <span className="cl-s">{'"Hello, {'}</span><span className="cl-v">$user</span><span className="cl-s">{'->name}!"'}</span>;
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>类型声明 — 现代 PHP</>, desc: <>PHP 7+ 起<strong>可选静态类型</strong>: 参数、返回、属性都能标。8.0 加 union, 8.1 加 intersection, 8.3 加 typed class constants。<em>用上类型 + 严格模式后, PHP 跟 TS 差距没那么大了</em>。</> },
    en: { title: <>Type declarations — modern PHP</>, desc: <>From PHP 7+ <strong>optional static types</strong>: parameters, returns, and properties can be typed. 8.0 added unions, 8.1 intersections, 8.3 typed class constants. <em>With types and strict mode on, PHP isn't that far from TS</em>.</> },
    code: (
      <code>
        <span className="cl-k">declare</span>(strict_types=<span className="cl-n">1</span>);{'\n\n'}
        <span className="cl-k">function</span> <span className="cl-fn">total</span>(<span className="cl-type">array</span> <span className="cl-v">$items</span>): <span className="cl-type">int</span>{'\n'}
        {'{'}{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-fn">array_sum</span>(<span className="cl-v">$items</span>);{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>构造器属性提升</>, desc: <>PHP 8.0 加的语法糖, 直接在构造器签名里声明属性。<em>过去要写 30 行的 getter/setter, 现在 1 行</em>。</> },
    en: { title: <>Constructor property promotion</>, desc: <>Syntactic sugar added in PHP 8.0 — declare properties directly in the constructor signature. <em>Code that used to be 30 lines of getter/setter boilerplate becomes one line</em>.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Point</span> {'{'}{'\n'}
        {'    '}<span className="cl-k">public function</span> <span className="cl-fn">__construct</span>({'\n'}
        {'        '}<span className="cl-k">public readonly</span> <span className="cl-type">float</span> <span className="cl-v">$x</span>,{'\n'}
        {'        '}<span className="cl-k">public readonly</span> <span className="cl-type">float</span> <span className="cl-v">$y</span>,{'\n'}
        {'    '}) {'{}'}{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-v">$p</span> = <span className="cl-k">new</span> <span className="cl-type">Point</span>(x: <span className="cl-n">1.0</span>, y: <span className="cl-n">2.0</span>);
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>match</code> 表达式</>, desc: <>PHP 8.0 加的<strong>真表达式式分支</strong>: 不 fall-through、严格比较 (<code>===</code>)、有返回值。<em>取代了 <code>switch</code> 那个布满坑的老语法</em>。</> },
    en: { title: <>The <code>match</code> expression</>, desc: <>PHP 8.0 added <strong>a real expression-based branch</strong>: no fall-through, strict comparison (<code>===</code>), returns a value. <em>Effectively retires the legacy <code>switch</code> with all its pitfalls</em>.</> },
    code: (
      <code>
        <span className="cl-v">$status</span> = <span className="cl-k">match</span>(<span className="cl-v">$code</span>) {'{'}{'\n'}
        {'    '}<span className="cl-n">200</span>, <span className="cl-n">201</span> =&gt; <span className="cl-s">'ok'</span>,{'\n'}
        {'    '}<span className="cl-n">301</span>, <span className="cl-n">302</span> =&gt; <span className="cl-s">'redirect'</span>,{'\n'}
        {'    '}<span className="cl-n">404</span>          =&gt; <span className="cl-s">'not found'</span>,{'\n'}
        {'    '}<span className="cl-k">default</span>     =&gt; <span className="cl-s">'error'</span>,{'\n'}
        {'}'};
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Enums — 真枚举</>, desc: <>PHP 8.1 之前只能用 <code>const</code> 假装。8.1 加的<strong>backed enum</strong> 带值, <strong>纯 enum</strong> 不带值; 可以加方法, 实现 interface。<em>30 年的等待</em>。</> },
    en: { title: <>Enums — real ones</>, desc: <>Before PHP 8.1 you faked enums with consts. 8.1 brought <strong>backed enums</strong> (with a scalar value) and <strong>pure enums</strong>; both can carry methods and implement interfaces. <em>The 30-year wait</em>.</> },
    code: (
      <code>
        <span className="cl-k">enum</span> <span className="cl-type">Status</span>: <span className="cl-type">string</span> {'{'}{'\n'}
        {'    '}<span className="cl-k">case</span> Draft     = <span className="cl-s">'draft'</span>;{'\n'}
        {'    '}<span className="cl-k">case</span> Published = <span className="cl-s">'published'</span>;{'\n\n'}
        {'    '}<span className="cl-k">public function</span> <span className="cl-fn">label</span>(): <span className="cl-type">string</span>{'\n'}
        {'    '}{'{'} <span className="cl-k">return</span> <span className="cl-fn">ucfirst</span>(<span className="cl-v">$this</span>-&gt;value); {'}'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>Attributes — <code>#[...]</code> 注解</>, desc: <>PHP 8.0 把 doc-block 注解 (Symfony / Doctrine 多年的事实标准) 升级为<strong>原生语法</strong>。运行期可以反射读取, 是 Symfony Routing / Doctrine Mapping / Laravel 12 配置的统一形式。</> },
    en: { title: <>Attributes — <code>#[...]</code> annotations</>, desc: <>PHP 8.0 upgraded doc-block annotations (a de facto Symfony / Doctrine convention for years) into <strong>native syntax</strong>. Readable at runtime via reflection — the unified mechanism behind Symfony routing, Doctrine mapping, and Laravel 12 configuration.</> },
    code: (
      <code>
        <span className="cl-k">#[Route(</span><span className="cl-s">{"'/users/{id}'"}</span>, methods: [<span className="cl-s">'GET'</span>])]{'\n'}
        <span className="cl-k">public function</span> <span className="cl-fn">show</span>(<span className="cl-type">int</span> <span className="cl-v">$id</span>): <span className="cl-type">Response</span>{'\n'}
        {'{'}{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-v">$this</span>-&gt;<span className="cl-fn">render</span>(<span className="cl-v">$this</span>-&gt;repo-&gt;<span className="cl-fn">find</span>(<span className="cl-v">$id</span>));{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Property hooks (PHP 8.4)</>, desc: <>2024 年 11 月的 8.4 加的<strong>最大单一语法变化</strong>: 属性自带 get/set 钩子, <strong>不必再写一对 getter/setter</strong>。等价 C# 属性, Kotlin getter — 这是 PHP 把 Java 时代的 boilerplate 一次性扔掉的版本。</> },
    en: { title: <>Property hooks (PHP 8.4)</>, desc: <>The <strong>biggest single syntax change</strong> in November 2024's 8.4: properties carry their own get/set hooks; <strong>no more matched getter/setter pair</strong>. Equivalent to C# properties or Kotlin getters — this is the release where PHP finally drops Java-era boilerplate.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">User</span> {'{'}{'\n'}
        {'    '}<span className="cl-k">public</span> <span className="cl-type">string</span> <span className="cl-v">$fullName</span> {'{'}{'\n'}
        {'        '}<span className="cl-k">get</span> =&gt; <span className="cl-v">$this</span>-&gt;first . <span className="cl-s">' '</span> . <span className="cl-v">$this</span>-&gt;last;{'\n'}
        {'        '}<span className="cl-k">set</span>(<span className="cl-type">string</span> <span className="cl-v">$v</span>) {'{'}{'\n'}
        {'            '}[<span className="cl-v">$this</span>-&gt;first, <span className="cl-v">$this</span>-&gt;last] = <span className="cl-fn">explode</span>(<span className="cl-s">' '</span>, <span className="cl-v">$v</span>, <span className="cl-n">2</span>);{'\n'}
        {'        }'}{'\n'}
        {'    }'}{'\n'}
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
    icon: '∞',
    zh: { title: <>部署摩擦接近零</>, desc: <>PHP 在共享主机时代被打磨成<strong>世界上最容易部署的后端</strong>: FTP 一个 <code>.php</code> 文件, Apache / nginx / php-fpm 立刻服务。没有"启动进程"、没有"端口冲突"、没有"build step"。<em>"上传即上线"是 PHP 30 年没人能复制的护城河</em>。</> },
    en: { title: <>Near-zero deploy friction</>, desc: <>PHP was polished by the shared-hosting era into <strong>the easiest backend on Earth to deploy</strong>: FTP a <code>.php</code> file up, Apache / nginx / php-fpm serves it immediately. No process to start, no port conflicts, no build step. <em>"Upload it = it's live" is a moat nobody has replicated in 30 years</em>.</> },
    code: <><span className="cl-c"># scp index.php user@host:/var/www/</span>{'\n'}<span className="cl-c"># done. no daemon. no port. no build.</span></>,
  },
  {
    icon: '◆',
    zh: { title: <>共享无关 (shared-nothing)</>, desc: <>每个 PHP 请求<strong>从干净状态启动, 跑完就死</strong>。这听起来低效, 实际让<strong>横向扩展极简</strong>: 加机器 = 加吞吐。Node / Go 长进程模型有 memory leak / state corruption 的烦恼, PHP 没有。<em>每个请求 = 一次小程序</em>。</> },
    en: { title: <>Shared-nothing architecture</>, desc: <>Every PHP request <strong>boots from a clean slate and dies when it ends</strong>. Sounds wasteful — it's actually what makes <strong>horizontal scaling trivial</strong>: add a machine, add throughput. Node and Go's long-process models invite memory leaks and state corruption; PHP doesn't. <em>Every request is a tiny program</em>.</> },
    code: <><span className="cl-c">// request → fpm worker boots</span>{'\n'}<span className="cl-c">// → script runs → returns</span>{'\n'}<span className="cl-c">// → worker resets → next request</span></>,
  },
  {
    icon: '◬',
    zh: { title: <>Composer + Packagist 生态</>, desc: <>2012 年起 PHP 拥有<strong>真正的现代包管理</strong>: <code>composer require</code> + Packagist 上 40 万+ 包。<em>Laravel / Symfony / Doctrine / PHPUnit / Pest / Carbon / Guzzle</em> 等顶级库的质量, 跟同期 npm / Maven 完全可比。</> },
    en: { title: <>Composer + Packagist</>, desc: <>Since 2012 PHP has had <strong>genuinely modern package management</strong>: <code>composer require</code> plus 400k+ packages on Packagist. <em>Laravel, Symfony, Doctrine, PHPUnit, Pest, Carbon, Guzzle</em> — the top-tier libraries are quality-comparable to anything in the npm or Maven worlds.</> },
    code: <><span className="cl-c"># composer require guzzlehttp/guzzle</span>{'\n'}<span className="cl-c"># vendor/ + autoload — done.</span></>,
  },
  {
    icon: '↗',
    zh: { title: <>PHP 7+ 的真实速度</>, desc: <>PHP 5 时代慢是真的; PHP 7 之后<strong>对于业务后端速度足够</strong>: 跑 WordPress / Laravel 应用, PHP 8.x + JIT 在<strong>多数 Web 工作负载上和 Node / Python 一档, 慢于 Go / Java 但差距比想象小</strong>。<em>"PHP 慢"是 2012 年的事实, 2026 年的迷因</em>。</> },
    en: { title: <>The real speed of PHP 7+</>, desc: <>PHP 5 was genuinely slow; PHP 7 onwards is <strong>fast enough for business backends</strong>: running WordPress / Laravel, PHP 8.x with JIT lands <strong>in the same band as Node and Python for typical web loads</strong>, behind Go and Java but by less than people remember. <em>"PHP is slow" was a fact in 2012; in 2026 it's a meme</em>.</> },
    code: <><span className="cl-c">// WordPress · req/s · PHP 5.6 → 8.3</span>{'\n'}<span className="cl-c">// 5.6 : ~100  → 8.0 : ~280</span>{'\n'}<span className="cl-c">// 8.3 : ~340  (JIT on)</span></>,
  },
  {
    icon: '◯',
    zh: { title: <>WordPress / Wikipedia / Drupal 的根</>, desc: <><strong>40%+ 的全球网站跑在 WordPress 上</strong>, Wikipedia 跑在 MediaWiki/PHP 上, Drupal 仍在大企业内 portal 当道。<em>不是"PHP 上有这些项目"</em>——是"<strong>这些项目就是 PHP 的灵魂</strong>"。它们决定了 PHP 不可能死。</> },
    en: { title: <>The WordPress / Wikipedia / Drupal root</>, desc: <><strong>WordPress runs 40%+ of all websites</strong>, Wikipedia rides MediaWiki/PHP, Drupal still dominates enterprise portals. <em>It isn't "these projects happen to run on PHP"</em> — it's "<strong>these projects are PHP's soul</strong>." Their existence is why PHP cannot die.</> },
    code: <><span className="cl-c">// W3Techs (2026):</span>{'\n'}<span className="cl-c">// PHP    · 75% server-side</span>{'\n'}<span className="cl-c">// Node   · 4%</span>{'\n'}<span className="cl-c">// Python · 1.6%</span></>,
  },
  {
    icon: '★',
    zh: { title: <>Laravel — 2010 年代 PHP 的救赎</>, desc: <>没有 Laravel, PHP 在"现代 Web 框架"这条线上会输得很惨。Taylor Otwell 一个人 (后来加 Mohamed Said / Nuno Maduro 等) 把 PHP 拉回与 Rails / Django 同台。<strong>2026 年 Laravel 是事实上的 PHP 全栈默认</strong>, Symfony 退居"骨架库"。</> },
    en: { title: <>Laravel — PHP's redemption in the 2010s</>, desc: <>Without Laravel, PHP would have lost the "modern web framework" battle convincingly. Taylor Otwell alone (later joined by Mohamed Said and Nuno Maduro and others) dragged PHP back onto the same stage as Rails and Django. <strong>In 2026 Laravel is the de facto PHP full-stack default</strong>; Symfony has retreated to being "the skeleton library."</> },
    code: <><span className="cl-c">{"// Route::get('/users', UsersController::class);"}</span>{'\n'}<span className="cl-c">{"// Eloquent: User::where('active', true)->get();"}</span>{'\n'}<span className="cl-c">{'// php artisan migrate'}</span></>,
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
    href: 'https://wordpress.org', highlight: true,
    zhName: 'WordPress', enName: 'WordPress',
    zhNote: '40%+ 全球网站', enNote: '40%+ of all websites',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="44" fill="#21759B"/><path d="M28 38 L42 72 L48 56 L42 38 Z M52 38 L66 72 L72 38 Z M50 50 L52 38 L48 38 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.wikipedia.org', highlight: true,
    zhName: 'Wikipedia', enName: 'Wikipedia',
    zhNote: 'MediaWiki · 全球第 7 流量', enNote: 'MediaWiki · 7th-largest site',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#F5F5F5"/><text x="50" y="64" textAnchor="middle" fontSize="56" fontWeight="700" fontFamily="Georgia, serif" fill="#222">W</text></svg>,
  },
  {
    href: 'https://laravel.com', highlight: true,
    zhName: 'Laravel', enName: 'Laravel',
    zhNote: 'PHP 默认全栈框架', enNote: 'PHP default full-stack framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A0A0A"/><path d="M22 30 L50 14 L78 30 L78 70 L50 86 L22 70 Z" fill="none" stroke="#FF2D20" strokeWidth="4"/><path d="M22 30 L50 46 L78 30 M50 46 L50 86" stroke="#FF2D20" strokeWidth="4" fill="none"/></svg>,
  },
  {
    href: 'https://symfony.com', highlight: true,
    zhName: 'Symfony', enName: 'Symfony',
    zhNote: '企业级骨架 · Drupal 8+ 底座', enNote: 'Enterprise skeleton · powers Drupal 8+',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><circle cx="50" cy="50" r="32" fill="none" stroke="#fff" strokeWidth="4"/><path d="M40 38 Q50 30 60 38 Q60 50 50 50 Q40 50 40 62 Q50 70 60 62" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://www.drupal.org',
    zhName: 'Drupal', enName: 'Drupal',
    zhNote: '企业 / 政府 CMS', enNote: 'Enterprise + government CMS',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0678BE"/><path d="M50 16 L32 36 Q18 50 26 64 Q34 80 50 84 Q66 80 74 64 Q82 50 68 36 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://magento.com',
    zhName: 'Magento', enName: 'Magento',
    zhNote: 'Adobe Commerce · 电商', enNote: 'Adobe Commerce · e-commerce',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#F26322"/><path d="M50 20 L76 36 L76 70 L66 70 L66 44 L50 36 L34 44 L34 70 L24 70 L24 36 Z M50 50 L58 56 L58 70 L42 70 L42 56 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.mediawiki.org',
    zhName: 'MediaWiki', enName: 'MediaWiki',
    zhNote: 'Wikipedia 引擎', enNote: 'Wikipedia engine',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#36c"/><path d="M16 32 L26 32 L36 64 L46 32 L54 32 L64 64 L74 32 L84 32 L70 80 L60 80 L50 50 L40 80 L30 80 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.slack.com',
    zhName: 'Slack (起家)', enName: 'Slack (origin)',
    zhNote: 'Hack/HHVM · 仍是 PHP 后代', enNote: 'Hack/HHVM · still PHP-descended',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#4A154B"/><rect x="22" y="30" width="14" height="40" rx="7" fill="#36C5F0"/><rect x="30" y="22" width="40" height="14" rx="7" fill="#2EB67D"/><rect x="64" y="30" width="14" height="40" rx="7" fill="#ECB22E"/><rect x="30" y="64" width="40" height="14" rx="7" fill="#E01E5A"/></svg>,
  },
  {
    href: 'https://www.facebook.com',
    zhName: 'Facebook / Meta', enName: 'Facebook / Meta',
    zhNote: '现走 Hack · PHP 仍有遗产', enNote: 'Hack now · PHP legacy remains',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1877F2"/><path d="M58 84 V52 H70 L72 38 H58 V30 Q58 24 64 24 H72 V12 Q68 12 60 12 Q44 12 44 28 V38 H32 V52 H44 V84 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.shopify.com',
    zhName: 'Shopify (早期)', enName: 'Shopify (early)',
    zhNote: 'Ruby 化前 · PHP 起家', enNote: 'PHP roots, pre-Ruby',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#95BF47"/><path d="M50 20 Q40 22 36 32 L26 36 L34 80 L66 80 L74 36 L64 32 Q60 22 50 20 Z M50 26 Q56 28 60 36 L40 36 Q44 28 50 26 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.etsy.com',
    zhName: 'Etsy', enName: 'Etsy',
    zhNote: '手作电商 · PHP 大户', enNote: 'Handmade e-commerce · big PHP shop',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#F1641E"/><text x="50" y="68" textAnchor="middle" fontSize="48" fontWeight="700" fontFamily="Georgia, serif" fill="#fff" fontStyle="italic">E</text></svg>,
  },
  {
    href: 'https://www.php.net',
    zhName: 'PHP Foundation', enName: 'PHP Foundation',
    zhNote: '2021 · 维护者付费', enNote: 'Since 2021 · funds maintainers',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#777BB4"/><ellipse cx="50" cy="50" rx="38" ry="20" fill="#4F518C"/><text x="50" y="58" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Trebuchet MS, sans-serif" fill="#fff">php</text></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'Composer',     zhDesc: '包管理 · 2012',          enDesc: 'Package manager · 2012' },
  { name: 'Packagist',    zhDesc: '40 万+ 包仓库',          enDesc: '400k+ public packages' },
  { name: 'PHPUnit',      zhDesc: 'Sebastian Bergmann · 测试', enDesc: 'Sebastian Bergmann · testing' },
  { name: 'Pest',         zhDesc: '新派测试 · Laravel 偏爱',  enDesc: 'Newer testing · Laravel-favoured' },
  { name: 'PHPStan',      zhDesc: '静态分析 (Ondřej Mirtes)', enDesc: 'Static analysis (Ondřej Mirtes)' },
  { name: 'Psalm',        zhDesc: 'Vimeo 出品 · 类型检查',    enDesc: 'Vimeo-built · type checker' },
  { name: 'Rector',       zhDesc: '自动重构 · 升级 PHP 版本', enDesc: 'Automated refactor · version upgrades' },
  { name: 'Laravel',      zhDesc: '全栈 · Otwell 2011',     enDesc: 'Full-stack · Otwell 2011' },
  { name: 'Symfony',      zhDesc: '骨架 · Fabien Potencier', enDesc: 'Skeleton · Fabien Potencier' },
  { name: 'Doctrine ORM', zhDesc: 'Java JPA 风',            enDesc: 'JPA-flavoured ORM' },
  { name: 'Carbon',       zhDesc: '日期时间库 · DateTime 包装', enDesc: 'Date/time · DateTime wrapper' },
  { name: 'Guzzle',       zhDesc: 'HTTP client · PSR-7/18',  enDesc: 'HTTP client · PSR-7/18' },
  { name: 'amphp · ReactPHP', zhDesc: '协程 / 异步 · 用 Fibers', enDesc: 'Coroutines / async · uses Fibers' },
  { name: 'Roadrunner',   zhDesc: 'Go 写的 PHP 长进程服务器', enDesc: 'Go-built PHP long-running server' },
  { name: 'FrankenPHP',   zhDesc: 'Caddy + PHP 嵌入',       enDesc: 'Caddy + embedded PHP' },
  { name: 'Xdebug',       zhDesc: 'Derick Rethans · 调试器', enDesc: 'Derick Rethans · debugger' },
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
      title: <>"成熟、无聊、赚钱" — 这就是 PHP 现在的位置</>,
      body: (<>
        <p>2026 年 PHP 的状态可以一句话说完: <strong>语言已经现代化 (8.x = match / enum / readonly / property hooks), 生态完全自给 (Laravel + Composer), 部署最容易, 市场份额 ~75% 不动</strong>。它不再追时髦, 也不再被攻击——攻击它的论文从 2015 年起就停了, 因为<strong>具体批评的每一项 PHP 都修了</strong>。</p>
        <p>对一门语言而言, 这是最强的位置: <strong>不依赖热度的稳定盈利曲线</strong>。WordPress + Laravel + 大量传统企业 portal 提供持续薪资, 招聘市场永远有 PHP 岗位, 新版本每 11 月 (按 PHP RFC 流程) 准时发布。<em>"PHP 已死"的迷因还会再喊 30 年, 然后 W3Techs 数字依旧不动</em>。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="2010 年代各类替代者野心" en="2010s would-be replacements" /></span><span className="bar-val">~</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="PHP 实际部署份额 (2026)" en="PHP actual deploy share (2026)" /></span><span className="bar-val">~75%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>"Mature, boring, profitable" — PHP's current resting position</>,
      body: (<>
        <p>PHP in 2026 in one sentence: <strong>the language has fully modernised (8.x = match / enum / readonly / property hooks), the ecosystem is self-sufficient (Laravel + Composer), deployment is still the easiest, and market share holds steady around 75%</strong>. It no longer chases fashion and is no longer attacked — the critique pieces stopped around 2015 because <strong>every specific complaint has been fixed</strong>.</p>
        <p>For a language, this is the strongest possible position: <strong>a steady profit curve that doesn't depend on hype</strong>. WordPress, Laravel, and the enormous legacy of enterprise portals deliver continuous payroll; the hiring market always has PHP roles; new releases ship every November via the PHP RFC process. <em>The "PHP is dead" meme will run another thirty years while the W3Techs number refuses to move</em>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">2010s would-be replacements</span><span className="bar-val">~</span></div>
          <div className="bar bar-new"><span className="bar-label">PHP actual deploy share (2026)</span><span className="bar-val">~75%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'JIT v2',
    zh: { title: <>JIT 深度优化</>, body: <><p>PHP 8.0 的 JIT 对纯 CPU 数学加速明显, 但 Web 后端 (大头是 I/O) 提升小。后续版本在<strong>类型推断</strong>和<strong>方法内联</strong>上继续推, 8.4 起开始有可观察的 Laravel 应用延迟下降。<em>不会变成 V8, 但会接近 LuaJIT 那条曲线</em>。</p></> },
    en: { title: <>Deeper JIT optimisation</>, body: <><p>PHP 8.0's JIT helped CPU-bound math markedly, but web workloads (mostly I/O) saw little change. Subsequent releases keep pushing <strong>type inference</strong> and <strong>method inlining</strong>; from 8.4 onwards Laravel apps see measurable latency drops. <em>Not going to become V8 — but it will approach LuaJIT's trajectory</em>.</p></> },
  },
  {
    tag: 'FRAMEWORK',
    zh: { title: <>Laravel 不停吃份额</>, body: <><p>2026 年 Laravel 占 PHP 全栈新项目 <strong>80%+</strong> (Symfony 主要做骨架库 + Drupal 底座)。Inertia.js / Livewire 把 SPA 体验做到不用写 React; <strong>Filament</strong> 把后台一键搞定。<em>Laravel 不只是框架, 它在悄悄变成"PHP 的 Rails + Next.js 合体"</em>。</p></> },
    en: { title: <>Laravel keeps eating share</>, body: <><p>By 2026 Laravel powers <strong>80%+</strong> of new PHP full-stack projects (Symfony's remaining role: skeleton library + Drupal's core). Inertia.js and Livewire deliver the SPA experience without writing React; <strong>Filament</strong> turns admin panels into one command. <em>Laravel isn't just a framework — it's quietly becoming "PHP's combined Rails and Next.js"</em>.</p></> },
  },
  {
    tag: 'ASYNC',
    zh: { title: <>Fibers + Roadrunner / FrankenPHP</>, body: <><p>PHP 8.1 的 Fibers 给了 amphp / ReactPHP 真原语, 加上 <strong>Roadrunner</strong> (Go 写的常驻 PHP 服务器) 和 <strong>FrankenPHP</strong> (Caddy 嵌 PHP), <em>"长进程 PHP"</em> 第一次像 Node 一样可用。<strong>不是替代 fpm</strong>, 而是给需要 WebSocket / SSE / 长连接的场景一个像样的选项。</p></> },
    en: { title: <>Fibers + Roadrunner / FrankenPHP</>, body: <><p>PHP 8.1's Fibers gave amphp / ReactPHP a real primitive; together with <strong>Roadrunner</strong> (a Go-built resident PHP server) and <strong>FrankenPHP</strong> (Caddy with embedded PHP), <em>"long-running PHP"</em> is finally Node-like in usability. <strong>Not replacing fpm</strong> — but giving WebSocket / SSE / long-poll scenarios a real option.</p></> },
  },
];

export default function PhpIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'PHP : 仍跑着 75% 的网络 — Lerdorf 的简历计数器走过 30 年',
    'PHP : still running 75% of the web — Lerdorf\'s resume counter, 30 years on'
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .web-stat, .web-tool, .spotlight, .web-reverse, .web-takeaway, .quote-block, .perf-track, .share-row'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.web-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.perf-track').forEach((el, i) => { el.style.transitionDelay = `${i * 120}ms`; });
    root.querySelectorAll<HTMLElement>('.share-row').forEach((el, i) => { el.style.transitionDelay = `${i * 90}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--php-bright)' : '';
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
      <div ref={rootRef} className="php-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="ph-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9D9FD9" />
                  <stop offset="100%" stopColor="#4F518C" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#ph-nav)" />
              <ellipse cx="128" cy="128" rx="100" ry="60" fill="#4F518C" />
              <text x="128" y="148" textAnchor="middle" fill="#FFFFFF" fontSize="60" fontWeight="900" fontFamily="'Trebuchet MS', sans-serif" letterSpacing="-3">php</text>
            </svg>
            <span>PHP</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#web"><L zh="Web 份额" en="Web Share" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Others" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1994 — 2026 · Rasmus Lerdorf · Zeev Suraski · Dmitry Stogov · Taylor Otwell</div>
            <h1 className="hero-title">
              <span className="hero-name">PHP</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">TheWebItself</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>从 1994 年一个<strong>人肉简历计数器</strong>, 到 2026 年仍在跑<strong>75% 互联网服务器后端</strong>的语言。被嘲笑 "<em>fractal of bad design</em>" 之后, PHP 7 重写 Zend, PHP 8 加 JIT, 8.1 来了 enum + Fibers, 8.4 有了 property hooks——<strong>2010 年那篇毒辣批评指出的每一处, PHP 都修了</strong>。"PHP 已死" 的迷因还会再喊 30 年。</>}
                en={<>From a 1994 <strong>human-resume hit counter</strong> to 2026's <strong>75% of all server-side web</strong>. After being mocked as a "<em>fractal of bad design</em>," PHP 7 rewrote Zend, PHP 8 added a JIT, 8.1 brought enums and Fibers, 8.4 landed property hooks — <strong>every specific complaint in the 2010 critique has been fixed</strong>. The "PHP is dead" meme will keep going for another thirty years.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1995<small></small></span>
                <span className="stat-label"><L zh={<>6 月 8 日 首版<br /><em>Rasmus Lerdorf</em></>} en={<>First release · Jun 8<br /><em>Rasmus Lerdorf</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">~75<small>%</small></span>
                <span className="stat-label"><L zh={<>W3Techs server-side<br /><em>2026 当下份额</em></>} en={<>W3Techs server-side<br /><em>share in 2026</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">40<small>%+</small></span>
                <span className="stat-label"><L zh={<>WordPress 占全球网站<br /><em>跑在 PHP 上</em></>} en={<>WordPress / all websites<br /><em>runs on PHP</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">8.4<small></small></span>
                <span className="stat-label"><L zh={<>property hooks · 2024-11<br /><em>下一版 8.5 · 2026-11</em></>} en={<>property hooks · 2024-11<br /><em>next: 8.5 · 2026-11</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {PHP_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">{'<?php'}</span>
              <span className="float f2">$user-&gt;name</span>
              <span className="float f3">composer require</span>
              <span className="float f4">Eloquent::find</span>
              <span className="float f5">readonly string</span>
              <span className="float f6">match($code)</span>
              <span className="float f7">enum Status</span>
              <span className="float f8">#[Route]</span>
              <span className="float f9">Fibers · async</span>
              <span className="float f10">WordPress</span>
              <span className="float f11">Zend Engine</span>
              <span className="float f12">JIT · 8.0</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>PHP</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>PHP 是 <strong>1994 年由 Rasmus Lerdorf 发起的服务器端脚本语言</strong>, 现由 PHP Foundation + Zend 维护。设计起点低: <strong>统计个人主页访问</strong>。30 年后它成了<strong>互联网部署最广的后端语言</strong>——WordPress / Wikipedia / Drupal / Magento / 早期 Facebook 都是它的产物。</>}
                  en={<>PHP is a <strong>server-side scripting language started in 1994 by Rasmus Lerdorf</strong>, now maintained by the PHP Foundation and Zend. The original goal was tiny: <strong>track resume page hits</strong>. Thirty years later it is the <strong>most-deployed backend language on the internet</strong> — WordPress, Wikipedia, Drupal, Magento, early Facebook are all its descendants.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="嵌入 HTML 的根基" en="HTML-embedded by design" />, tag: 'syntax', p: <L zh={<>跟 Python / Ruby 不同, PHP 文件<strong>默认是 HTML</strong>, 写 <code>{'<?php'}</code> 才进入代码。<em>"模板就是代码, 代码就是模板"</em>——这是 PHP 1994 年最重要的设计决策。</>} en={<>Unlike Python or Ruby, a PHP file is <strong>HTML by default</strong>; you enter code with <code>{'<?php'}</code>. <em>"The template is the code, the code is the template"</em> — the most consequential design choice PHP made in 1994.</>} /> },
                { h: <L zh="Shared-nothing 请求模型" en="Shared-nothing per request" />, tag: 'runtime', p: <L zh={<>每个请求<strong>全新启动 → 跑完即死</strong>。看似低效, 实际<strong>横向扩展极简</strong>——没有 memory leak、没有进程状态、没有 warm-up。fpm 把这件事做到极致。</>} en={<>Each request <strong>boots fresh and dies on completion</strong>. Sounds wasteful — actually makes <strong>horizontal scaling trivial</strong>: no leaks, no shared state, no warm-up. php-fpm polishes this model to its limit.</>} /> },
                { h: <L zh="脚本到 OOP 的进化" en="From scripting to OOP" />, tag: 'evolution', p: <L zh={<>1995 = "FORM 处理"; 2004 PHP 5 = 真 OOP; 2015 PHP 7 = 性能翻倍; 2020 PHP 8 = JIT + 现代语法。<em>同一门语言走完三个时代而不死, 屈指可数</em>。</>} en={<>1995 = "form handling"; 2004 PHP 5 = real OOP; 2015 PHP 7 = perf doubled; 2020 PHP 8 = JIT + modern syntax. <em>Few languages walk through three eras of computing without dying</em>.</>} /> },
                { h: <L zh="Composer + Packagist 生态" en="Composer + Packagist" />, tag: 'ecosystem', p: <L zh={<><strong>40 万+ 包</strong>, 现代依赖管理 (2012 起)。<em>Laravel / Symfony / Doctrine / PHPUnit / Pest</em> 等顶级库质量与同期 npm / Maven 并列。</>} en={<><strong>400k+ packages</strong>, modern dependency management since 2012. <em>Laravel, Symfony, Doctrine, PHPUnit, Pest</em> are quality-comparable to top-tier npm / Maven libraries.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">legacy.php</span><span className="lang-tag js">PHP 5 · 2004</span></div>
                <pre className="code"><code>
                  <span className="cl-k">{'<?php'}</span>{'\n'}
                  <span className="cl-c">// the old style — global, untyped, fragile</span>{'\n'}
                  <span className="cl-k">function</span> <span className="cl-fn">find_user</span>(<span className="cl-v">$id</span>) {'{'}{'\n'}
                  {'    '}<span className="cl-k">global</span> <span className="cl-v">$db</span>;{'\n'}
                  {'    '}<span className="cl-v">$res</span> = <span className="cl-fn">mysql_query</span>({'\n'}
                  {'      '}<span className="cl-s">"SELECT * FROM users WHERE id="</span> . <span className="cl-v">$id</span>);{'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-fn">mysql_fetch_assoc</span>(<span className="cl-v">$res</span>);{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-v">$u</span> = <span className="cl-fn">find_user</span>(<span className="cl-v">$_GET</span>[<span className="cl-s">'id'</span>]);{'\n'}
                  <span className="cl-k">echo</span> <span className="cl-s">"Hello, "</span> . <span className="cl-v">$u</span>[<span className="cl-s">'name'</span>];{'\n'}
                  <span className="cl-c"><L zh="// 全局变量 + 字符串 SQL + 数组返回" en="// globals + string-built SQL + array return" /></span>{'\n'}
                  <span className="cl-c"><L zh="// SQL 注入门户大开" en="// SQL injection: wide open" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">modern.php</span><span className="lang-tag ts">PHP 8.4 · 2024</span></div>
                <pre className="code"><code>
                  <span className="cl-k">{'<?php'}</span>{'\n'}
                  <span className="cl-k">declare</span>(strict_types=<span className="cl-n">1</span>);{'\n\n'}
                  <span className="cl-k">final class</span> <span className="cl-type">UserRepository</span> {'{'}{'\n'}
                  {'    '}<span className="cl-k">public function</span> <span className="cl-fn">__construct</span>({'\n'}
                  {'        '}<span className="cl-k">private readonly</span> <span className="cl-type">PDO</span> <span className="cl-v">$db</span>,{'\n'}
                  {'    '}) {'{}'}{'\n\n'}
                  {'    '}<span className="cl-k">public function</span> <span className="cl-fn">find</span>(<span className="cl-type">int</span> <span className="cl-v">$id</span>): ?<span className="cl-type">User</span>{'\n'}
                  {'    '}{'{'}{'\n'}
                  {'        '}<span className="cl-v">$stmt</span> = <span className="cl-v">$this</span>-&gt;db-&gt;<span className="cl-fn">prepare</span>({'\n'}
                  {'          '}<span className="cl-s">'SELECT * FROM users WHERE id = :id'</span>);{'\n'}
                  {'        '}<span className="cl-v">$stmt</span>-&gt;<span className="cl-fn">execute</span>([<span className="cl-s">'id'</span> =&gt; <span className="cl-v">$id</span>]);{'\n'}
                  {'        '}<span className="cl-k">return</span> <span className="cl-v">$stmt</span>-&gt;<span className="cl-fn">fetchObject</span>(<span className="cl-type">User</span>::<span className="cl-k">class</span>) ?: <span className="cl-k">null</span>;{'\n'}
                  {'    '}{'}'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 类型 + readonly + prepared + 命名参数" en="// types + readonly + prepared + named params" /></span>
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
                zh={<>PHP 是<strong>少数 30 年没死、还在主流</strong>的语言之一。1994 个人项目, 1997 学生重写, 1999 商业引擎, 2004 真 OOP, 2012 Composer + Laravel + "fractal" 批评同时出现, 2015 PHP 7 大反击, 2020 PHP 8 JIT + 现代化, 2024 property hooks。<em>每个 10 年都有一次大动作, 这条曲线异常平稳</em>。</>}
                en={<>PHP is one of the few languages that <strong>survived 30 years and stayed mainstream</strong>. 1994 personal project, 1997 student rewrite, 1999 commercial engine, 2004 real OOP, 2012 (Composer + Laravel + the "fractal" essay all in one year), 2015 PHP 7's comeback, 2020 PHP 8's JIT + modernisation, 2024 property hooks. <em>One big leap every decade — an unusually steady curve</em>.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: PhpAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 PHP 现代化的核心: 嵌入 HTML、<code>$</code> 前缀、可选类型、构造器属性提升、<code>match</code>、enum、<code>#[Attributes]</code>、property hooks。第 9 张谈"<em>fractal of bad design</em>" 那篇文章, 以及之后 PHP 怎么一条条把它修掉的。</>}
                en={<>The eight cards below are the spine of modern PHP: HTML embedding, the <code>$</code> sigil, optional types, constructor property promotion, <code>match</code>, enums, <code>#[Attributes]</code>, property hooks. Card nine deals with the "<em>fractal of bad design</em>" essay and how PHP fixed it, item by item.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {PHP_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>"a fractal of bad design" — 后来呢?</>} en={<>"A fractal of bad design" — what happened next?</>} /></h3>
                <p><L
                  zh={<>2012 年 Eevee 那篇文章列了几十条 PHP 缺陷, 是<strong>2010 年代 PHP 嘲笑的总弹药库</strong>。十年后回看, 那篇文章点的<strong>大多数</strong>具体问题——函数命名混乱、参数顺序、<code>==</code> 行为、缺类型——<strong>PHP 7/8 全部修了</strong>: 类型声明、严格模式、<code>match</code>、enum、属性、property hooks。<em>这是少数"被毁灭性批评后真的改正"的语言案例</em>。</>}
                  en={<>Eevee's 2012 essay listed dozens of PHP defects and became <strong>the standard ammunition for 2010s PHP-bashing</strong>. Looking back, <strong>most</strong> of the concrete items it called out — inconsistent function names, parameter order, <code>==</code> behaviour, missing types — <strong>have been fixed in PHP 7/8</strong>: type declarations, strict mode, <code>match</code>, enums, attributes, property hooks. <em>One of the few languages that took a devastating critique and actually responded</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>The fractal essay was true in 2012, and it was the best thing that ever happened to PHP—because it gave the language a checklist.</>}
                  en={<>The fractal essay was true in 2012, and it was the best thing that ever happened to PHP — because it gave the language a checklist.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why PHP" /> <code>: WhyPHP</code></h2>
              <p className="sec-desc"><L
                zh={<>PHP 在 2026 年的价值<strong>不在新潮</strong>。它在<strong>"<em>把后端 Web 开发的成本/复杂度压到地板</em>"</strong>: 部署零门槛、shared-nothing 易扩展、Composer 生态自给、PHP 8.x 性能足以承载主流业务、Laravel 把 DX 拉到 Rails / Next.js 同档。</>}
                en={<>PHP's value in 2026 is <strong>not novelty</strong>. It is <strong>"<em>driving the cost and complexity of backend web work to the floor</em>"</strong>: zero-friction deploy, shared-nothing horizontal scaling, self-sufficient Composer ecosystem, PHP 8.x is fast enough for mainstream workloads, Laravel pulls DX up to Rails / Next.js parity.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: WebRunsOnPhp</code></h2>
              <p className="sec-desc"><L
                zh={<>PHP 的"用户名单"是<strong>互联网的相当一部分</strong>。WordPress (40%+ 站点)、Wikipedia (全球 Top 10 流量)、Drupal (政府 / 大企业 CMS)、Magento (电商)、Slack 起家、Facebook 起家、Etsy、Shopify 早期……<em>这不是"PHP 也有人用", 是"<strong>互联网相当大一部分就是 PHP 写的</strong>"</em>。</>}
                en={<>PHP's user list <strong>is a sizeable slice of the internet itself</strong>. WordPress (40%+ of sites), Wikipedia (top-10 traffic globally), Drupal (government / enterprise CMS), Magento (e-commerce), Slack's origin, Facebook's origin, Etsy, early Shopify… <em>this isn't "some sites use PHP" — it's "<strong>a meaningful portion of the internet was written in PHP</strong>"</em>.</>}
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

          {/* 06 Web Share + Perf Rocket */}
          <section className="section section-web" id="web">
            <header className="sec-head">
              <span className="sec-num web-num">06</span>
              <h2 className="sec-title"><L zh="Web 份额与性能" en="Web Share & Perf" /> <code>: <L zh="数字说话" en="The Numbers" /></code></h2>
              <p className="sec-desc"><L
                zh={<>这一节是<strong>反"PHP 已死"叙事的硬数字</strong>: W3Techs 服务器端语言份额, 跟<strong>PHP 5 → 7 → 8 性能曲线</strong>。这两条曲线分别说"<em>它仍占主导</em>"和"<em>它已经够快</em>"。</>}
                en={<>This section is <strong>the hard numbers against the "PHP is dead" narrative</strong>: W3Techs server-side language share, plus the <strong>PHP 5 → 7 → 8 performance curve</strong>. The two curves respectively say "<em>it still dominates</em>" and "<em>it's fast enough now</em>."</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我从来没有想过我在 1994 年那个周末写的东西会被这么多人用。<strong>PHP 是个意外</strong>——一开始它甚至不是一门语言, 只是一些 C 程序。它能活下来, 不是因为它设计得好, 是因为<strong>它解决了人在那一刻真要解决的问题</strong>: 让 HTML 动起来。</>}
                en={<>I never imagined that what I wrote that weekend in 1994 would be used by this many people. <strong>PHP was an accident</strong> — at the start it wasn't even a language, just some C programs. It survived not because it was well-designed, but because <strong>it solved the problem people actually had at that moment</strong>: making HTML come alive.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Rasmus Lerdorf</span>
                <span className="quote-context"><L zh="PHP 创始人 · 多次访谈口径" en="PHP creator · paraphrased across multiple interviews" /></span>
              </footer>
            </blockquote>

            <div className="web-stats">
              <div className="web-stat">
                <div className="web-stat-num">~75<small>%</small></div>
                <div className="web-stat-h"><L zh="W3Techs server-side 份额" en="W3Techs server-side share" /></div>
                <p><L
                  zh={<>2026 年 W3Techs 数据: <strong>所有已知服务器端语言的网站中, PHP 占 ~75%</strong>。第二名 Node.js ~4%, 之后 ASP.NET / Ruby / Python / Java 都个位数。<em>WordPress 一个项目就贡献了大头</em>, 但即便扣掉, PHP 仍是事实上的服务器端首位。</>}
                  en={<>W3Techs in 2026: <strong>among sites whose server-side language is detectable, PHP holds about 75%</strong>. Number two is Node.js around 4%, then ASP.NET / Ruby / Python / Java in low single digits. <em>WordPress alone contributes the bulk</em> — but even subtracting it, PHP remains the de facto server-side leader.</>}
                /></p>
              </div>
              <div className="web-stat">
                <div className="web-stat-num">2×<small></small></div>
                <div className="web-stat-h"><L zh="PHP 7 vs PHP 5 性能" en="PHP 7 vs PHP 5 throughput" /></div>
                <p><L
                  zh={<>2015 年 PHP 7 发布: <strong>WordPress 同一基准下大约 2× 5.6 的 req/s</strong>。Dmitry Stogov 主导的 phpng 重写 Zend Engine 内存模型, value 改紧凑 zval, refcount + GC 联动。<em>这一次大改让 PHP 反超 HHVM, Facebook 之后就放弃了 PHP-compat 路线</em>。</>}
                  en={<>PHP 7 in 2015 delivered <strong>around 2× the WordPress req/s of PHP 5.6 on the same benchmark</strong>. Dmitry Stogov's phpng branch redesigned Zend Engine's memory model — compact zvals, refcount and GC interlocked. <em>This rewrite overtook HHVM and led Facebook to drop PHP-compatibility from Hack's roadmap</em>.</>}
                /></p>
              </div>
              <div className="web-stat">
                <div className="web-stat-num">30<small>yr</small></div>
                <div className="web-stat-h"><L zh="语言年龄 · 不老不死" en="Language age · not dying" /></div>
                <p><L
                  zh={<>1995 → 2025 整整<strong>30 年</strong>。Perl / Ruby / PHP / Python / JS 中, <strong>PHP 是这一组里部署最广、还在涨语言版本</strong>的。每年 11 月按 RFC 流程出新版, 5 年周期废弃旧版, 节奏稳到无聊——<em>这正是它"成熟"的证据</em>。</>}
                  en={<>1995 → 2025: a clean <strong>30 years</strong>. Among Perl / Ruby / PHP / Python / JS, <strong>PHP is the most-deployed and the only one still cranking out new language versions</strong> with conviction. November releases on the RFC clock, 5-year deprecation cycle — <em>a cadence boring enough to be evidence of maturity</em>.</>}
                /></p>
              </div>
            </div>

            <div className="perf-rocket">
              <h3 className="perf-rocket-h"><L zh="PHP 5 → 7 → 8: 性能火箭" en="PHP 5 → 7 → 8: the performance rocket" /></h3>
              <p className="perf-rocket-sub"><L
                zh={<><strong>WordPress 同基准 req/s</strong>, 数字相对值; 反映 Zend Engine 改造 + JIT 引入的真实影响。Facebook 的 HHVM 压力 → Stogov 的 phpng → PHP 7 → JIT, 是这条曲线的故事。</>}
                en={<><strong>WordPress req/s, relative to PHP 5.6 = 1.0×</strong>; reflects Zend Engine's redesign and the introduction of JIT. The arc: Facebook's HHVM pressure → Stogov's phpng → PHP 7 → JIT.</>}
              /></p>
              <div className="perf-rocket-bars">
                {[
                  { tag: 'PHP 5.6', val: '1.0×',   w: 0.16 },
                  { tag: 'HHVM 3', val: '~3.5×',  w: 0.55 },
                  { tag: 'PHP 7.0', val: '~2.0×', w: 0.32 },
                  { tag: 'PHP 7.4', val: '~2.6×', w: 0.42 },
                  { tag: 'PHP 8.0 JIT', val: '~2.8×', w: 0.46 },
                  { tag: 'PHP 8.3 JIT', val: '~3.4×', w: 0.55 },
                ].map((p, i) => (
                  <div className="perf-row" key={i}>
                    <div className="perf-tag">{p.tag}</div>
                    <div className="perf-track" style={{ ['--perf-w' as never]: p.w } as React.CSSProperties}>
                      <div className="perf-fill" />
                    </div>
                    <div className="perf-val">{p.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="share-block">
              <h3 className="share-block-h"><L zh="服务器端语言份额 (W3Techs · 2026)" en="Server-side language share (W3Techs · 2026)" /></h3>
              <p className="share-block-sub"><L
                zh={<>"<em>使用 X 作为服务器端语言的网站占已知服务器端语言网站的比例</em>"。注意: <strong>所有竞争者加起来不到 PHP 一家</strong>。WordPress 是大头, 但扣掉 WP 后 PHP 仍是第一。</>}
                en={<>"<em>share of sites whose server-side language is X, among sites whose server-side language is detectable</em>." Note: <strong>every competitor combined still doesn't equal PHP alone</strong>. WordPress is the bulk, but even excluding it PHP stays in first place.</>}
              /></p>
              <div className="share-bars">
                {[
                  { name: 'PHP',     val: '~75%', w: 0.95, hi: true },
                  { name: 'Node.js', val: '~4%',  w: 0.06 },
                  { name: 'ASP.NET', val: '~6%',  w: 0.08 },
                  { name: 'Ruby',    val: '~5%',  w: 0.07 },
                  { name: 'Java',    val: '~2%',  w: 0.04 },
                  { name: 'Python',  val: '~1.6%', w: 0.03 },
                  { name: 'Go',      val: '<1%',  w: 0.02 },
                  { name: 'Scala / others', val: '<1%', w: 0.015 },
                ].map((s, i) => (
                  <div className={`share-row${s.hi ? '' : ' muted'}`} key={i} style={{ ['--share-w' as never]: s.w } as React.CSSProperties}>
                    <div className="share-name">{s.name}</div>
                    <div className="share-track"><div className="share-fill" /></div>
                    <div className="share-val">{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Laravel <span className="spotlight-meta">— <L zh="一个人改写了 PHP 的 DX 命运" en="one person rewrote PHP's DX fate" /></span></h3>
                  <p><L
                    zh={<>2011 年, 26 岁的 <strong>Taylor Otwell</strong> 不爽 CodeIgniter, 自己写了一套。15 年后, Laravel 是<strong>PHP 默认全栈框架</strong>: Eloquent ORM、Blade 模板、Artisan CLI、队列、广播、调度、邮件、文件、缓存——全套自带。<em>跟 Rails 同代, 但活到了 2026 年还在涨</em>。</>}
                    en={<>In 2011 a 26-year-old <strong>Taylor Otwell</strong> didn't like CodeIgniter, wrote his own. Fifteen years later, Laravel is <strong>PHP's default full-stack framework</strong>: Eloquent ORM, Blade templates, Artisan CLI, queues, broadcasting, scheduling, mail, file storage, cache — all batteries included. <em>Same generation as Rails, but still gaining mindshare in 2026</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Eloquent ORM</strong> — <L zh="ActiveRecord 风, 学 Rails" en="ActiveRecord-flavoured, Rails-derived" /></li>
                    <li><strong>Blade</strong> — <L zh="模板 + 缓存编译" en="templates + cached compilation" /></li>
                    <li><strong>Artisan</strong> — <L zh="CLI · php artisan make / migrate / serve" en="CLI · make / migrate / serve" /></li>
                    <li><strong>Livewire</strong> — <L zh="SPA 体验 · 不写 React" en="SPA without React" /></li>
                    <li><strong>Filament</strong> — <L zh="后台一键 (Laravel 11+ 大热)" en="instant admin panels (huge in Laravel 11+)" /></li>
                    <li><strong>Forge / Vapor</strong> — <L zh="官方部署平台" en="official deploy platforms" /></li>
                  </ul>
                  <p><L
                    zh={<>对比 Symfony: <strong>Symfony 是"骨架库" — 给框架作者用</strong>; <strong>Laravel 是产品 — 给应用作者用</strong>。Drupal 8+ 内部跑 Symfony 组件, Laravel 内部也复用一部分。<em>两者共存, 不替代</em>。</>}
                    en={<>vs Symfony: <strong>Symfony is a "skeleton library" — built for framework authors</strong>; <strong>Laravel is a product — built for application authors</strong>. Drupal 8+ runs Symfony components internally, and Laravel itself reuses a subset. <em>The two coexist, they don't compete</em>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c">// routes/web.php</span>{'\n'}
                    <span className="cl-type">Route</span>::<span className="cl-fn">get</span>(<span className="cl-s">{"'/posts/{post}'"}</span>,{'\n'}
                    {'    '}[<span className="cl-type">PostController</span>::<span className="cl-k">class</span>, <span className="cl-s">'show'</span>])-&gt;<span className="cl-fn">name</span>(<span className="cl-s">'posts.show'</span>);{'\n\n'}
                    <span className="cl-c">// app/Http/Controllers/PostController.php</span>{'\n'}
                    <span className="cl-k">final class</span> <span className="cl-type">PostController</span> {'{'}{'\n'}
                    {'    '}<span className="cl-k">public function</span> <span className="cl-fn">show</span>(<span className="cl-type">Post</span> <span className="cl-v">$post</span>): <span className="cl-type">View</span>{'\n'}
                    {'    '}{'{'}{'\n'}
                    {'        '}<span className="cl-k">return</span> <span className="cl-fn">view</span>(<span className="cl-s">'posts.show'</span>, [{'\n'}
                    {'            '}<span className="cl-s">'post'</span>     =&gt; <span className="cl-v">$post</span>,{'\n'}
                    {'            '}<span className="cl-s">'comments'</span> =&gt; <span className="cl-v">$post</span>-&gt;<span className="cl-fn">comments</span>()-&gt;<span className="cl-fn">latest</span>()-&gt;<span className="cl-fn">get</span>(),{'\n'}
                    {'        '}]);{'\n'}
                    {'    '}{'}'}{'\n'}
                    {'}'}{'\n\n'}
                    <span className="cl-c">// app/Models/Post.php</span>{'\n'}
                    <span className="cl-k">class</span> <span className="cl-type">Post</span> <span className="cl-k">extends</span> <span className="cl-type">Model</span> {'{'}{'\n'}
                    {'    '}<span className="cl-k">public function</span> <span className="cl-fn">comments</span>(): <span className="cl-type">HasMany</span>{'\n'}
                    {'    '}{'{'}{'\n'}
                    {'        '}<span className="cl-k">return</span> <span className="cl-v">$this</span>-&gt;<span className="cl-fn">hasMany</span>(<span className="cl-type">Comment</span>::<span className="cl-k">class</span>);{'\n'}
                    {'    '}{'}'}{'\n'}
                    {'}'}
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="web-tools">
              <h3 className="web-tools-h"><L zh="2026 PHP 工具链 / 库 / 生态" en="2026 PHP toolchain / libs / ecosystem" /></h3>
              <div className="web-tools-grid">
                {ADOPT_TOOLS.map((t, i) => (
                  <div className="web-tool" key={i}>
                    <div className="web-tool-name">{t.name}</div>
                    <div className="web-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="web-reverse">
              <div className="web-reverse-text">
                <div className="web-reverse-tag">COMEBACK STORY</div>
                <h3><L zh="HHVM 之后: PHP 7 是怎么活下来的" en="After HHVM: how PHP 7 survived" /></h3>
                <p><L
                  zh={<>2013 年 Facebook 公开 HHVM, 性能甩 PHP 5.6 两倍以上, 同时放出 Hack 方言。<strong>PHP 团队内部其实慌过</strong>——如果 Facebook 把 Hack 推成新标准, PHP 就成 "<em>HHVM 的旧版兼容层</em>"。</>}
                  en={<>In 2013 Facebook open-sourced HHVM — 2× faster than PHP 5.6 — and the Hack dialect alongside. <strong>The PHP team genuinely panicked internally</strong>: if Hack became the new standard, PHP risked being reduced to "<em>HHVM's legacy compatibility layer</em>".</>}
                /></p>
                <p><L
                  zh={<><strong>反应是 phpng 分支</strong>: Dmitry Stogov + Nikita Popov + Anatol Belski 重写 Zend Engine 的 zval 表示, 把对象布局压紧、refcount 与 GC 联动、所有热路径重新审视。<strong>2015 年发布 PHP 7, 性能 = 2× PHP 5, 反过来打 HHVM</strong>。</>}
                  en={<><strong>The response was the phpng branch</strong>: Dmitry Stogov + Nikita Popov + Anatol Belski rewrote zval, compacted object layouts, interlocked refcount and GC, and revisited every hot path. <strong>PHP 7 shipped in 2015 at 2× PHP 5's throughput and pushed back past HHVM</strong>.</>}
                /></p>
                <p><L
                  zh={<>2017 Facebook 宣布<strong>Hack 不再维持 PHP 兼容</strong>, 实际上承认 PHP 自己能跑了。<em>这是开源语言史上少有的"被大公司 fork 之后又赢回主线"的案例</em>——Lattner 的 Swift 都没做到 (ObjC 还是被替代了)。</>}
                  en={<>In 2017 Facebook announced <strong>Hack would no longer maintain PHP compatibility</strong> — a tacit admission that PHP could carry itself. <em>One of the rare cases in open-source history of a language being forked by a megacorp and then winning the trunk back</em>. Lattner's Swift didn't manage this (ObjC was still displaced).</>}
                /></p>
              </div>
              <div className="web-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// PHP 5.6 (2014)" en="// PHP 5.6 (2014)" /></span>{'\n'}
                  <span className="cl-c"><L zh="// zval = 56 bytes · refcount per value" en="// zval = 56 bytes · refcount per value" /></span>{'\n'}
                  <span className="cl-c"><L zh="// hashmap heavy · GC slow" en="// hashmap heavy · GC slow" /></span>{'\n\n'}
                  <span className="cl-c"><L zh="// phpng 重设计 → PHP 7 (2015)" en="// phpng redesign → PHP 7 (2015)" /></span>{'\n'}
                  <span className="cl-c"><L zh="// zval = 16 bytes · 紧凑 union" en="// zval = 16 bytes · compact union" /></span>{'\n'}
                  <span className="cl-c"><L zh="// refcount 移到对象级" en="// refcount moves to the object" /></span>{'\n'}
                  <span className="cl-c"><L zh="// hashmap 重写 · cache-friendly" en="// hashmap rewritten · cache-friendly" /></span>{'\n'}
                  <span className="cl-c">// — Dmitry Stogov</span>{'\n\n'}
                  <span className="cl-c"><L zh="// 结果: WordPress req/s ≈ 2.0×" en="// Result: WordPress req/s ≈ 2.0×" /></span>{'\n'}
                  <span className="cl-c"><L zh="// HHVM 由领先 → 落后 → 放弃 PHP 兼容" en="// HHVM: leads → falls behind → drops PHP compat" /></span>
                </code></pre>
              </div>
            </div>

            <div className="web-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>PHP 不在追时髦, 也不需要追。它是<strong>互联网部署最广的后端语言</strong>, 性能已经够、生态自给、语法现代化、维护组织 (PHP Foundation) 有钱付薪水。<em>"已死" 30 年了, 数字一直没动</em>。</>}
                en={<>PHP isn't chasing fashion and doesn't need to. It is the <strong>most-deployed backend language on the internet</strong>, fast enough, ecosystem self-sufficient, syntax modernised, maintained by a funded foundation. <em>"Dead" for thirty years — the numbers refuse to budge</em>.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Python / JS / Ruby */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Python / JS / Ruby" /> <code>: PHP vs the Web peers</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <strong>JavaScript</strong> 比 (<a href="/code/javascript">/code/javascript</a>): Web 上的同代对手, 一个跑浏览器一个跑服务器, 30 年并存。跟 <strong>Python</strong> 比 (<a href="/code/python">/code/python</a>): 同时代脚本语言, 走向完全不同——Python 进了数据/AI, PHP 留在 Web。跟 <strong>Ruby</strong> 比: 同时代 Web 语言, Rails 跟 Laravel 是同一种东西的不同实现。</>}
                en={<>Versus <strong>JavaScript</strong> (<a href="/code/javascript">/code/javascript</a>): the same-generation web peer — one in the browser, one on the server, coexisting for 30 years. Versus <strong>Python</strong> (<a href="/code/python">/code/python</a>): same-era scripting language, very different paths — Python went into data and AI, PHP stayed on the web. Versus <strong>Ruby</strong>: same-era web language, Rails and Laravel are the same idea in different implementations.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">PHP</th>
                  <th className="th-js">JavaScript / Node</th>
                  <th className="th-sw">Ruby (Rails)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    ts: <>Lerdorf · 1994</>,
                    js: <>Eich · 1995</>,
                    sw: <>Matsumoto · 1995</> },
                  { k: <L zh="设计目标" en="Original goal" />,
                    ts: <L zh="嵌 HTML 跑 CGI" en="Embed in HTML, run as CGI" />,
                    js: <L zh="浏览器交互" en="Browser interactivity" />,
                    sw: <L zh="程序员开心" en="Programmer happiness" /> },
                  { k: <L zh="运行模型" en="Runtime model" />,
                    ts: <L zh={<><strong>Shared-nothing</strong> · 每请求重启</>} en={<><strong>Shared-nothing</strong> · process-per-request</>} />,
                    js: <L zh="单进程事件循环" en="Single process · event loop" />,
                    sw: <L zh="Puma / Unicorn · 多进程" en="Puma / Unicorn · multi-process" /> },
                  { k: <L zh="部署摩擦" en="Deploy friction" />,
                    ts: <L zh={<><strong>近零</strong> · FTP 一个文件</>} en={<><strong>Near-zero</strong> · FTP a file</>} />,
                    js: <L zh="中 · 要 node + pm2" en="Medium · node + pm2 / docker" />,
                    sw: <L zh="中 · ruby + bundler + puma" en="Medium · ruby + bundler + puma" /> },
                  { k: <L zh="性能 (Web 后端)" en="Performance (web backend)" />,
                    ts: <L zh={<>PHP 8 JIT · 跟 Node 一档</>} en={<>PHP 8 JIT · same band as Node</>} />,
                    js: <L zh="V8 · 跟 PHP 一档" en="V8 · same band as PHP" />,
                    sw: <L zh="慢一点 · YJIT 拉近" en="A touch slower · YJIT closing gap" /> },
                  { k: <L zh="类型系统" en="Type system" />,
                    ts: <L zh={<>可选 · PHP 7+ · 8.x 现代</>} en={<>Optional · since PHP 7 · modern in 8.x</>} />,
                    js: <L zh={<>无 (TS 是另一门语言)</>} en={<>None (TS is a different language)</>} />,
                    sw: <L zh="Sorbet · RBS · 后加" en="Sorbet · RBS · bolted on" /> },
                  { k: <L zh="主框架" en="Main framework" />,
                    ts: <L zh="Laravel · Symfony" en="Laravel · Symfony" />,
                    js: <L zh="Express · NestJS · Next.js" en="Express · NestJS · Next.js" />,
                    sw: <L zh="Rails (统治)" en="Rails (dominant)" /> },
                  { k: <L zh="包管理" en="Package manager" />,
                    ts: <L zh={<>Composer (2012) · Packagist</>} en={<>Composer (2012) · Packagist</>} />,
                    js: <L zh="npm / pnpm / yarn" en="npm / pnpm / yarn" />,
                    sw: <L zh="Bundler · RubyGems" en="Bundler · RubyGems" /> },
                  { k: <L zh="Web 份额 (W3Techs 2026)" en="Web share (W3Techs 2026)" />,
                    ts: <L zh={<><strong>~75%</strong></>} en={<><strong>~75%</strong></>} />,
                    js: <L zh={<>~4% (服务端) · 100% (浏览器)</>} en={<>~4% (server) · 100% (browser)</>} />,
                    sw: <L zh={<>~5%</>} en={<>~5%</>} /> },
                  { k: <L zh="代表项目" en="Flagship projects" />,
                    ts: <L zh="WordPress · Wikipedia · Drupal" en="WordPress · Wikipedia · Drupal" />,
                    js: <L zh="React · 服务端: Vercel / Netlify" en="React · server: Vercel / Netlify" />,
                    sw: <L zh="GitHub · Shopify · Basecamp" en="GitHub · Shopify · Basecamp" /> },
                  { k: <L zh="并发模型" en="Concurrency model" />,
                    ts: <L zh={<>无 (但 Fibers 8.1+ · amphp / ReactPHP)</>} en={<>None (but Fibers 8.1+ · amphp / ReactPHP)</>} />,
                    js: <L zh="原生 async / Promise" en="Native async / Promise" />,
                    sw: <L zh="Fibers · Ractor · Async" en="Fibers · Ractor · Async" /> },
                  { k: <L zh="社区氛围" en="Community vibe" />,
                    ts: <L zh="工程实用 · 不追潮" en="Practical engineering · low hype" />,
                    js: <L zh="变化快 · 框架轮替" en="Fast-moving · framework churn" />,
                    sw: <L zh="DHH · Rails 统一" en="DHH · Rails-unified" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.ts}</td>
                    <td>{row.js}</td>
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
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheBoringFuture</code></h2>
              <p className="sec-desc"><L
                zh={<>PHP 的"前景"不像新语言那样靠下一个大动作。它是<strong>已经走到"成熟期"的语言</strong>: 每年 11 月一个新版本, 5 年生命周期, JIT 慢慢加深, Laravel 慢慢扩张, Fibers / Roadrunner / FrankenPHP 给"长进程 PHP" 一条体面的路线。<em>没什么戏剧, 这就是它的好</em>。</>}
                en={<>PHP's "outlook" doesn't depend on a next big move the way new languages do. It is <strong>a language in mature steady-state</strong>: a new minor every November, a 5-year lifecycle, JIT slowly deepening, Laravel slowly expanding, Fibers / Roadrunner / FrankenPHP giving "long-running PHP" a respectable path. <em>No drama — and that is its strength</em>.</>}
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
                <li><a href="https://www.php.net" target="_blank" rel="noopener">php.net</a></li>
                <li><a href="https://wiki.php.net" target="_blank" rel="noopener">wiki.php.net</a></li>
                <li><a href="https://github.com/php/php-src" target="_blank" rel="noopener">GitHub · php/php-src</a></li>
                <li><a href="https://www.php.net/manual/en/" target="_blank" rel="noopener"><L zh="官方手册" en="Manual" /></a></li>
                <li><a href="https://thephp.foundation" target="_blank" rel="noopener">PHP Foundation</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="框架" en="Frameworks" /></h4>
              <ul>
                <li><a href="https://laravel.com" target="_blank" rel="noopener">laravel.com</a></li>
                <li><a href="https://symfony.com" target="_blank" rel="noopener">symfony.com</a></li>
                <li><a href="https://www.drupal.org" target="_blank" rel="noopener">drupal.org</a></li>
                <li><a href="https://wordpress.org" target="_blank" rel="noopener">wordpress.org</a></li>
                <li><a href="https://filamentphp.com" target="_blank" rel="noopener">filamentphp.com</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="数据来源" en="Data Sources" /></h4>
              <ul>
                <li><a href="https://w3techs.com/technologies/overview/programming_language" target="_blank" rel="noopener">W3Techs · server-side</a></li>
                <li><a href="https://www.tiobe.com/tiobe-index/" target="_blank" rel="noopener">TIOBE Index</a></li>
                <li><a href="https://eev.ee/blog/2012/04/09/php-a-fractal-of-bad-design/" target="_blank" rel="noopener"><L zh={'Eevee · "fractal" 文'} en={'Eevee · "fractal" essay'} /></a></li>
                <li><a href="https://stitcher.io/blog/php-in-2024" target="_blank" rel="noopener">stitcher.io · PHP recent</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/javascript"><L zh="JavaScript — 浏览器对手" en="JavaScript — browser counterpart" /></a></li>
                <li><a href="/code/python"><L zh="Python — 同代脚本语言" en="Python — peer scripting language" /></a></li>
                <li><a href="/code/java"><L zh="Java — 企业 Web 旧霸主" en="Java — old enterprise web king" /></a></li>
                <li><a href="/code/c"><L zh="C — PHP 解释器的实现语言" en="C — what PHP itself is written in" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{PHP_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{'<?php echo "still here, 30 years on"; ?>'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
