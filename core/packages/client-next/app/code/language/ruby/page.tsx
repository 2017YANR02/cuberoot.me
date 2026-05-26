'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './ruby_intro.css';

const RUBY_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="rb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E84B3F" />
        <stop offset="100%" stopColor="#8C1E1A" />
      </linearGradient>
      <linearGradient id="rb-facet-top" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#FFD2C8" />
        <stop offset="100%" stopColor="#E84B3F" />
      </linearGradient>
      <linearGradient id="rb-facet-left" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CC342D" />
        <stop offset="100%" stopColor="#8C1E1A" />
      </linearGradient>
      <linearGradient id="rb-facet-right" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#A82822" />
        <stop offset="100%" stopColor="#5C1310" />
      </linearGradient>
      <linearGradient id="rb-facet-front" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#E84B3F" />
        <stop offset="100%" stopColor="#7A1612" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#rb-grad)" />
    {/* faceted gem — table on top, four crown facets, two pavilion facets */}
    <polygon points="60,86 196,86 168,58 88,58" fill="url(#rb-facet-top)" stroke="#FFE3DC" strokeWidth="0.5" />
    <polygon points="60,86 88,58 60,58" fill="#9A2521" />
    <polygon points="196,86 168,58 196,58" fill="#7A1A17" />
    <polygon points="60,86 128,206 60,140" fill="url(#rb-facet-left)" />
    <polygon points="196,86 128,206 196,140" fill="url(#rb-facet-right)" />
    <polygon points="60,86 196,86 128,206" fill="url(#rb-facet-front)" />
    <polygon points="60,140 128,206 60,86" fill="none" stroke="#FFB5A7" strokeWidth="0.6" opacity=".4" />
    <polygon points="196,140 128,206 196,86" fill="none" stroke="#FFB5A7" strokeWidth="0.6" opacity=".4" />
    {/* highlight on table */}
    <polygon points="78,76 108,68 116,72 96,80" fill="#FFE3DC" opacity=".55" />
    <polygon points="148,72 168,68 172,72 160,76" fill="#FFE3DC" opacity=".35" />
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
    year: '1993',
    zh: { title: <>松本行弘 (Matz) 开始动手</>, desc: <>2 月, <strong>Yukihiro "Matz" Matsumoto</strong> 在日本筑波某栋楼里和同事吃午饭, 聊起"应该有一门给程序员的<em>面向对象脚本语言</em>"。他不喜欢 Perl 的丑、不满意 Python 的"过于克制", 决定自己写。<em>名字取自一位同事的生日石</em>。</> },
    en: { title: <>Yukihiro "Matz" Matsumoto starts hacking</>, desc: <>February, in Tsukuba, Japan: over lunch with a colleague <strong>Yukihiro "Matz" Matsumoto</strong> mused that there should be an <em>object-oriented scripting language</em> aimed at programmers. He didn't like Perl's ugliness or what he saw as Python's over-restraint, so he started writing one. <em>The name comes from a colleague's birthstone</em>.</> },
  },
  {
    year: <>1995<small>·12·21</small></>, highlight: true,
    zh: { title: <>Ruby 0.95 — 第一次公开发布</>, desc: <>12 月 21 日, Matz 把 Ruby 0.95 贴到 fj.sources Usenet 组。早期完全是日本社区驱动, <strong>文档英文几乎没有, 邮件列表全日文</strong>。这种"<em>语言诞生在非英语世界</em>"的事情在 PL 史上极少见。</> },
    en: { title: <>Ruby 0.95 — first public release</>, desc: <>December 21: Matz drops Ruby 0.95 on the fj.sources Usenet group. Early development is entirely Japanese: <strong>almost no English docs, mailing lists entirely in Japanese</strong>. A language born outside the anglosphere is exceedingly rare in PL history.</> },
  },
  {
    year: <>1999<small>·10</small></>,
    zh: { title: <>《オブジェクト指向スクリプト言語 Ruby》</>, desc: <>Matz 与石塚圭树合著的<strong>第一本 Ruby 书</strong>出版, 仍是日语。Ruby 在日本已有数千用户; 海外几乎没人听说过——这种<strong>"日本国民语言"</strong>状态会持续到 2000 年代初。</> },
    en: { title: <>The first Ruby book, in Japanese</>, desc: <>Matz and Keiju Ishitsuka publish "Object-Oriented Scripting Language Ruby." Ruby has thousands of users in Japan; abroad nobody has heard of it. The <strong>"Japan-only language"</strong> phase holds well into the early 2000s.</> },
  },
  {
    year: '2000',
    zh: { title: <>《Programming Ruby》(Pickaxe)</>, desc: <>Dave Thomas 和 Andy Hunt 出版<strong>第一本英文 Ruby 书</strong>, 封面那把鹤嘴锄成了俚称 <em>"Pickaxe"</em>。<strong>这本书把 Ruby 带出日本</strong>——之后几年北美 Ruby 用户数从几十涨到几千。Pragmatic Programmer 系列由此立起来。</> },
    en: { title: <>"Programming Ruby" — the Pickaxe book</>, desc: <>Dave Thomas and Andy Hunt publish the <strong>first English-language Ruby book</strong>; the pickaxe on the cover gives it the nickname. <strong>This book carries Ruby out of Japan</strong>; North American users grow from dozens to thousands over the next few years. The Pragmatic Programmer series is built on its back.</> },
  },
  {
    year: '2003',
    zh: { title: <>Ruby 1.8 — 长期稳态版</>, desc: <>1.8 是后来好几年的<strong>事实标准</strong>。M17N (多字节字符串) 还没进, Unicode 处理一直是 Ruby 早期的痛点之一——这要等到 2007 年的 1.9。</> },
    en: { title: <>Ruby 1.8 — the long-lived stable line</>, desc: <>1.8 becomes the <strong>de-facto standard</strong> for the next several years. M17N (multi-byte strings) hasn't landed yet, and Unicode handling stays a sore spot in early Ruby — that wait runs to 1.9 in 2007.</> },
  },
  {
    year: <>2004<small>·07·24</small></>, highlight: true,
    zh: { title: <>DHH 发布 Rails 第一版</>, desc: <>丹麦人 <strong>David Heinemeier Hansson</strong> (DHH) 从他在 37signals 写的 Basecamp 项目里<strong>抽出 Ruby on Rails</strong> 0.5, 7 月 24 日开源。这是 Ruby 命运的转折点——<em>但当时谁都不知道</em>。</> },
    en: { title: <>DHH releases Ruby on Rails</>, desc: <>Danish developer <strong>David Heinemeier Hansson</strong> (DHH) <strong>extracts Ruby on Rails</strong> 0.5 from the Basecamp app he wrote inside 37signals and open-sources it on July 24. This is the inflection point for Ruby — <em>though nobody knew it at the time</em>.</> },
  },
  {
    year: <>2005<small>·07</small></>,
    zh: { title: <>"15-minute blog" 视频</>, desc: <>DHH 录的<strong>"15 分钟做完一个博客"</strong>视频在网上疯传, 跟当时 Java/Struts 那种 30 个 XML 配置文件形成视觉冲击。<em>Convention over configuration</em> 一夜成口号; Ruby 下载量翻番。</> },
    en: { title: <>The "Blog in 15 minutes" screencast</>, desc: <>DHH's <strong>"build a blog in 15 minutes"</strong> screencast spreads everywhere; the contrast with Java/Struts' 30-XML-file ceremony lands hard. <em>Convention over configuration</em> goes viral overnight; Ruby downloads double.</> },
  },
  {
    year: <>2005<small>·12·13</small></>, highlight: true,
    zh: { title: <>Rails 1.0 发布</>, desc: <>12 月 13 日 Rails 1.0。RJS、ActiveRecord、generators、acts_as_* DSL 全套到位。<strong>2005–2010 整整五年, Rails 是 startup 默认 stack</strong>: Twitter、GitHub、Shopify、Airbnb、Hulu、Groupon、SoundCloud、Kickstarter——全部从 Rails 起家。</> },
    en: { title: <>Rails 1.0 ships</>, desc: <>December 13, Rails 1.0. RJS, ActiveRecord, generators, the <code>acts_as_*</code> DSL cluster — all in. <strong>For the next five years Rails is the default startup stack</strong>: Twitter, GitHub, Shopify, Airbnb, Hulu, Groupon, SoundCloud, Kickstarter — all built on Rails first.</> },
  },
  {
    year: '2007',
    zh: { title: <>Ruby 1.9 — YARV 字节码 VM</>, desc: <>笹田耕一写的 <strong>YARV</strong> 字节码虚拟机替换掉 1.8 的 AST walker。性能大幅提升, 同时上 <strong>M17N</strong> (per-string 编码), Unicode 痛点终结。<em>但 1.9 兼容性变化大, 1.8 → 1.9 升级在社区里痛了好几年</em>。</> },
    en: { title: <>Ruby 1.9 — the YARV bytecode VM</>, desc: <>Koichi Sasada's <strong>YARV</strong> bytecode VM replaces 1.8's AST walker. Big speedup, plus <strong>M17N</strong> (per-string encodings) — the Unicode pain ends. <em>But 1.9 breaks compatibility enough that the 1.8 → 1.9 migration drags on in the community for years</em>.</> },
  },
  {
    year: <>2008<small>·05</small></>,
    zh: { title: <>Twitter 的 Ruby 危机</>, desc: <>Twitter 的 Rails 单体在 World Cup / 选举夜被流量打挂, "<strong>fail whale</strong>" 成了互联网梗。<em>Ruby/Rails 扩不了大流量</em>的说法从这里开始, 后来被严重夸大——真相是<strong>当时 Ruby GC + 单进程模型 + 早期 ORM 不适合 fan-out 写</strong>, 跟语言关系小。</> },
    en: { title: <>The Twitter scaling crisis</>, desc: <>Twitter's Rails monolith collapses under World Cup / election-night load; the <strong>"fail whale"</strong> becomes an internet meme. The "<em>Ruby/Rails can't scale</em>" narrative starts here — heavily overblown later. The real cause was <strong>Ruby's GC + single-process model + early-ORM patterns being wrong for fan-out write workloads</strong>, not the language.</> },
  },
  {
    year: <>2011<small>·04</small></>,
    zh: { title: <>Twitter 迁出 Ruby (部分)</>, desc: <>Twitter 把搜索后端从 Ruby/Rails 重写为 <strong>Scala + JVM</strong> (Finagle / Storm 一套)。前端长期仍是 Rails——这一段历史在媒体上被压缩成<strong>"Twitter 放弃了 Ruby"</strong>, 其实是分层迁移, 整整持续了 5 年。</> },
    en: { title: <>Twitter migrates off Ruby (partially)</>, desc: <>Twitter rewrites its search back end from Ruby/Rails to <strong>Scala on the JVM</strong> (Finagle / Storm). The front end stays Rails for years afterwards. Media compresses this into <strong>"Twitter abandoned Ruby,"</strong> but it was a layered migration that took five full years.</> },
  },
  {
    year: '2013',
    zh: { title: <>Ruby 2.0 — keyword args + frozen strings 预演</>, desc: <>2.0 加 <code>**kwargs</code>、<code>frozen_string_literal</code> magic comment、refinements 实验, 同时性能继续提升。Ruby 2.x 是<strong>"安稳生长"</strong>的十年, 没大新闻但 GC / IO / threading 不断改。</> },
    en: { title: <>Ruby 2.0 — keyword args + frozen-string lead-in</>, desc: <>2.0 ships <code>**kwargs</code>, the <code>frozen_string_literal</code> magic comment and experimental refinements; perf keeps creeping up. Ruby 2.x is a decade of <strong>"steady growth"</strong> — few headlines, but constant work on GC, IO and threading.</> },
  },
  {
    year: '2014',
    zh: { title: <>Node / Go / Elixir 抢风头</>, desc: <>JavaScript 后端 (Node.js)、Go 服务、Elixir/Phoenix 开始抢"<em>新潮的脚本/Web 后端</em>"的位置。Rails 给人的感觉变成"<strong>稳但旧</strong>"。<em>Hacker News 上每年都有"Rails 死了吗"的帖子。</em></> },
    en: { title: <>Node / Go / Elixir steal the new-shiny crown</>, desc: <>JavaScript on the server (Node.js), Go services, and Elixir/Phoenix start owning the "<em>fashionable web back end</em>" slot. Rails starts to feel <strong>"stable but dated."</strong> <em>"Is Rails dead?" becomes an annual Hacker News thread</em>.</> },
  },
  {
    year: '2015',
    zh: { title: <>GitHub 仍在 Rails 上, Shopify 接过 Ruby 旗帜</>, desc: <>GitHub 的整个产品仍是 Rails 单体; Shopify 把 Ruby/Rails 当核心战略, 开始大规模招 Ruby committer。<strong>Shopify 接过 Ruby 的"主要赞助商"位置</strong>——这一接就接到了 2026。</> },
    en: { title: <>GitHub still on Rails; Shopify picks up the torch</>, desc: <>GitHub's product is still a Rails monolith; Shopify makes Ruby/Rails core strategy and starts hiring Ruby committers en masse. <strong>Shopify takes over as Ruby's principal corporate patron</strong> — a role it still holds in 2026.</> },
  },
  {
    year: <>2018<small>·12·25</small></>,
    zh: { title: <>Ruby 2.6 — JIT 进 stdlib (MJIT)</>, desc: <>圣诞节惯例 release: Matz 每年 12 月 25 日 ship 一个 Ruby (一种文化仪式)。2.6 把 <strong>MJIT</strong> (Vladimir Makarov 写的 method-based JIT) 合进主干, 第一次"<em>Ruby 能 JIT</em>"。但纯 Ruby 工作负载提升有限——为下一代 YJIT 铺路。</> },
    en: { title: <>Ruby 2.6 — MJIT lands in stdlib</>, desc: <>The Christmas-release ritual: every December 25, Matz ships a Ruby. 2.6 merges <strong>MJIT</strong> (Vladimir Makarov's method-based JIT) into the trunk — the first time <em>"Ruby can JIT"</em>. The speedup on pure-Ruby workloads is modest, but it lays the groundwork for the next JIT.</> },
  },
  {
    year: <>2020<small>·12·25</small></>, highlight: true,
    zh: { title: <>Ruby 3.0 — "3x3" 兑现</>, desc: <>Ruby 3.0 圣诞 ship。Matz 2015 年公开放出的目标 <strong>"Ruby 3 比 Ruby 2.0 快 3 倍"</strong>在 optcarrot 等 benchmark 上达成。同时引入 <strong>Ractor</strong> (无 GIL 并发 actor) 和 <strong>Fiber.scheduler</strong>。</> },
    en: { title: <>Ruby 3.0 — the "3x3" goal delivered</>, desc: <>Christmas 2020. The <strong>"Ruby 3 should be 3× faster than Ruby 2.0"</strong> target Matz set publicly in 2015 is met on benchmarks like optcarrot. <strong>Ractor</strong> (GIL-free actor concurrency) and <strong>Fiber.scheduler</strong> arrive in the same release.</> },
  },
  {
    year: <>2021<small>·12·25</small></>, highlight: true,
    zh: { title: <>YJIT 上线 — Shopify 出手</>, desc: <>Shopify 的 <strong>Maxime Chevalier-Boisvert</strong> (前蒙特利尔大学 Basilisk JIT) 写的 <strong>YJIT</strong> 进 Ruby 3.1。Basic block versioning 路线, <strong>Rails 工作负载快约 2×</strong>。 Ruby 历史上第一次性能跟 V8 / PyPy 同台被认真讨论。</> },
    en: { title: <>YJIT lands — Shopify steps up</>, desc: <><strong>Maxime Chevalier-Boisvert</strong> (formerly Université de Montréal, Basilisk JIT) joins Shopify and ships <strong>YJIT</strong> in Ruby 3.1. Basic-block versioning approach; <strong>~2× faster on Rails workloads</strong>. It's the first time Ruby's perf gets seriously compared to V8 / PyPy in the same room.</> },
  },
  {
    year: <>2022<small>·12·25</small></>,
    zh: { title: <>Ruby 3.2 — YJIT 改 Rust + 默认开启</>, desc: <>YJIT 整个 backend 用 <strong>Rust 重写</strong> (Ruby 史上第一次主线代码引入 Rust), 同时默认开启。Shopify 内部把 YJIT 推到 100% 生产流量, 公开<strong>~9% CPU 节省</strong>——按他们的规模就是每年几千万美元。</> },
    en: { title: <>Ruby 3.2 — YJIT rewritten in Rust, on by default</>, desc: <>YJIT's whole back end gets <strong>rewritten in Rust</strong> (Rust enters Ruby's mainline for the first time), and is on by default. Shopify rolls YJIT to 100% production and reports <strong>~9% CPU savings</strong> — at their scale, tens of millions of dollars a year.</> },
  },
  {
    year: <>2023<small>·12·25</small></>,
    zh: { title: <>Ruby 3.3 — YJIT 又快一截 / Prism parser</>, desc: <>YJIT 继续优化 (Lazy basic block + side-exits 改进), Rails 上多 15%。<strong>Prism</strong> parser 替代 25 年的老 parse.y, 给 LSP / 代码分析工具补上现代化前端。</> },
    en: { title: <>Ruby 3.3 — YJIT faster again, Prism parser</>, desc: <>More YJIT optimisations (lazy basic blocks, better side exits): another ~15% on Rails. <strong>Prism</strong> replaces the 25-year-old parse.y, finally giving LSPs and analysis tools a modern front end.</> },
  },
  {
    year: <>2024<small>·11·08</small></>, highlight: true,
    zh: { title: <>Rails 8 — "No PaaS Required"</>, desc: <>11 月 8 日 DHH 在 Rails World 发布 <strong>Rails 8</strong>: <strong>Solid Queue / Solid Cache / Solid Cable</strong>——用 Postgres 替代 Redis / Sidekiq / ActionCable Redis 依赖。理念明白: <strong>"<em>反碎片化</em>", 一个 Postgres 起步, 不再下载 5 个外部服务</strong>。Kamal 2 把部署也吃了。</> },
    en: { title: <>Rails 8 — "No PaaS Required"</>, desc: <>November 8, Rails World: DHH ships <strong>Rails 8</strong>. The headline is <strong>Solid Queue / Solid Cache / Solid Cable</strong> — Postgres replaces Redis / Sidekiq / Redis-backed ActionCable. The message is unmistakable: <strong>anti-fragmentation, one Postgres to start, no five-service shopping list</strong>. Kamal 2 swallows deployment too.</> },
  },
  {
    year: <>2024<small>·12·25</small></>,
    zh: { title: <>Ruby 3.4 — YJIT 默认 + namespace 实验</>, desc: <>YJIT 现在<strong>所有人开机就开</strong>, 不再是 opt-in。实验性 <code>Namespace</code> 模块进 trunk——这是 Ruby 第一次有"<em>真正模块隔离</em>", 解决大型应用 monkey-patch 冲突。</> },
    en: { title: <>Ruby 3.4 — YJIT default, Namespace experiment</>, desc: <>YJIT is now <strong>on for everyone by default</strong>, no longer opt-in. The experimental <code>Namespace</code> module lands on trunk — Ruby's first try at <em>real module isolation</em>, aimed at the monkey-patch collisions in big apps.</> },
  },
  {
    year: '2025',
    zh: { title: <>DHH 撤掉 TypeScript / 推 Hotwire</>, desc: <>DHH 多次公开声明 37signals 内部"<strong>去 TypeScript</strong>", 论点: TS 检查的错没 RuboCop / 测试好。同时 Hotwire (<strong>Turbo + Stimulus + Strada</strong>) 在 Hey / Basecamp 上跑成熟, 成为 "<em>Rails 反 SPA 答案</em>"。<em>这一切都在<strong>反主流</strong>风口上, DHH 招黑也招爱</em>。</> },
    en: { title: <>DHH drops TypeScript, doubles down on Hotwire</>, desc: <>DHH says publicly, several times, that 37signals is <strong>removing TypeScript</strong>; the claim is that the errors TS catches are caught better by RuboCop and tests. Hotwire (<strong>Turbo + Stimulus + Strada</strong>) matures on Hey and Basecamp as Rails's <em>"anti-SPA answer"</em>. <em>All of this is loudly counter-mainstream — DHH attracts equal parts hate and devotion</em>.</> },
  },
  {
    year: '2026',
    zh: { title: <>33 岁的 Ruby — 一个不死的 niche 王者</>, desc: <>2026 现状: <strong>GitHub 仍是 Rails 单体</strong>, Shopify 跑着<strong>~$5B 年营收的 Rails app</strong>, Stripe 内部大量 Ruby, Coinbase / Square / Instacart 仍然 Rails 起家。<em>"Rails 死了"已经吵了 15 年, 但每年 Ruby 都有一笔大 release</em>。性能不再是话题; 招聘市场是<strong>真实痛点</strong>——年轻人都去学 TS / Go / Rust。</> },
    en: { title: <>Ruby at 33 — the niche king that won't die</>, desc: <>State of play in 2026: <strong>GitHub is still a Rails monolith</strong>, Shopify runs a <strong>Rails app on ~$5B annual GMV-driven revenue</strong>, Stripe uses Ruby heavily, and Coinbase / Square / Instacart all started on Rails. <em>"Rails is dead" is a 15-year-old argument and every year Ruby ships a real release</em>. Performance has stopped being the issue; the <strong>job market is the real soft spot</strong> — younger developers reach for TS / Go / Rust first.</> },
  },
];

interface MoCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const MO_CARDS: MoCard[] = [
  {
    tag: 'A',
    zh: { title: <>Everything is an Object</>, desc: <>Ruby 比 Java / Python 更<strong>纯</strong>面向对象——<code>1</code>、<code>nil</code>、<code>true</code>、<code>class</code> 本身全是对象, 全有方法。<code>1.times</code>、<code>nil.to_s</code>、<code>Class.new</code> 都合法。</> },
    en: { title: <>Everything is an Object</>, desc: <>Ruby is <strong>more purely</strong> object-oriented than Java or Python — <code>1</code>, <code>nil</code>, <code>true</code>, and <code>class</code> itself are all objects with methods. <code>1.times</code>, <code>nil.to_s</code>, <code>Class.new</code> are all legal.</> },
    code: (
      <code>
        <span className="cl-n">5</span>.<span className="cl-fn">times</span> {'{ |i|'} <span className="cl-fn">puts</span> i {'}'}{'\n\n'}
        <span className="cl-fn">puts</span> <span className="cl-n">5</span>.<span className="cl-fn">class</span>          <span className="cl-c"># =&gt; Integer</span>{'\n'}
        <span className="cl-fn">puts</span> <span className="cl-n">5</span>.<span className="cl-fn">class</span>.<span className="cl-fn">class</span>    <span className="cl-c"># =&gt; Class</span>{'\n'}
        <span className="cl-fn">puts</span> <span className="cl-k">nil</span>.<span className="cl-fn">to_s</span>          <span className="cl-c"># =&gt; ""</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>Blocks &amp; <code>yield</code></>, desc: <>方法可以<strong>接一个匿名代码块</strong> (<code>{'{ ... }'}</code> 或 <code>do ... end</code>), 用 <code>yield</code> 调用。这是 Ruby 控制流的<strong>核心机制</strong>: <code>each</code> / <code>map</code> / <code>open</code> / <code>transaction</code> 全靠 block。</> },
    en: { title: <>Blocks and <code>yield</code></>, desc: <>Any method can take an <strong>anonymous code block</strong> (<code>{'{ ... }'}</code> or <code>do ... end</code>) and invoke it via <code>yield</code>. This is Ruby's <strong>core control-flow mechanism</strong> — <code>each</code> / <code>map</code> / <code>open</code> / <code>transaction</code> all ride on blocks.</> },
    code: (
      <code>
        <span className="cl-k">def</span> <span className="cl-fn">retry_3x</span>{'\n'}
        {'  '}<span className="cl-n">3</span>.<span className="cl-fn">times</span> <span className="cl-k">do</span>{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-k">yield</span>{'\n'}
        {'  '}<span className="cl-k">rescue</span>; <span className="cl-k">next</span>{'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>{'\n\n'}
        <span className="cl-fn">retry_3x</span> {'{'} <span className="cl-fn">fetch</span>(url) {'}'}
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>Symbols — <code>:name</code></>, desc: <>Symbol 是<strong>不可变、单例化的标识符</strong>。<code>:name</code> 全局只有一个实例, 哈希查表比 String 快。Rails 的 hash 参数全用 symbol key: <code>{`User.where(name: "Alice")`}</code>。</> },
    en: { title: <>Symbols — <code>:name</code></>, desc: <>A Symbol is an <strong>immutable, interned identifier</strong>. <code>:name</code> has exactly one instance globally; hash lookup is faster than with Strings. Rails uses symbol keys everywhere: <code>{`User.where(name: "Alice")`}</code>.</> },
    code: (
      <code>
        h = {'{'} <span className="cl-sym">name</span>: <span className="cl-s">"Alice"</span>, <span className="cl-sym">role</span>: <span className="cl-sym">:admin</span> {'}'}{'\n'}
        h[<span className="cl-sym">:role</span>] == <span className="cl-sym">:admin</span>   <span className="cl-c"># identity compare</span>{'\n\n'}
        <span className="cl-sym">:foo</span>.<span className="cl-fn">object_id</span> =={'\n'}
        {'  '}<span className="cl-sym">:foo</span>.<span className="cl-fn">object_id</span>      <span className="cl-c"># true — interned</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>method_missing</code> — 元编程</>, desc: <>对象收到没定义的方法时 Ruby 调 <code>method_missing</code>。<strong>ActiveRecord 的 <code>find_by_email</code> / <code>find_by_age_and_role</code> 全靠它</strong>。威力巨大, 滥用也是 Rails 慢的原因之一——后来很多用 <code>define_method</code> 替代。</> },
    en: { title: <><code>method_missing</code> — runtime metaprogramming</>, desc: <>When an object receives an undefined method, Ruby calls <code>method_missing</code>. <strong>ActiveRecord's <code>find_by_email</code> / <code>find_by_age_and_role</code> all hang off this hook</strong>. Hugely powerful — and a known cause of Rails slowness, so many modern uses switched to <code>define_method</code> at boot.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Lazy</span>{'\n'}
        {'  '}<span className="cl-k">def</span> <span className="cl-fn">method_missing</span>(name, *args){'\n'}
        {'    '}<span className="cl-fn">puts</span> <span className="cl-s">"called #{'{'}name{'}'}"</span>{'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>{'\n\n'}
        <span className="cl-type">Lazy</span>.<span className="cl-fn">new</span>.<span className="cl-fn">foo</span>(<span className="cl-n">1</span>)   <span className="cl-c"># called foo</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Open classes / Monkey patching</>, desc: <>Ruby 允许<strong>给任何已有类加方法</strong>, 包括 <code>String</code> / <code>Integer</code>。Rails 的 <code>2.days.ago</code> 就是给 <code>Integer</code> 加 <code>days</code>。<em>双刃剑</em>: 优雅但能让两个 gem 互撞——所以 2024 年的 Namespace 实验在做"<strong>受控隔离</strong>"。</> },
    en: { title: <>Open classes &amp; monkey patching</>, desc: <>Ruby lets you <strong>add methods to any existing class</strong>, including core ones like <code>String</code> / <code>Integer</code>. Rails's <code>2.days.ago</code> is a method added to <code>Integer</code>. <em>Double-edged</em>: elegant, but two gems can collide — hence the 2024 Namespace experiment aimed at <strong>controlled isolation</strong>.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Integer</span>{'\n'}
        {'  '}<span className="cl-k">def</span> <span className="cl-fn">days</span>{'\n'}
        {'    '}self * <span className="cl-n">86_400</span>{'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>{'\n\n'}
        <span className="cl-fn">puts</span> <span className="cl-n">2</span>.<span className="cl-fn">days</span>   <span className="cl-c"># =&gt; 172800</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Modules &amp; <code>include</code> — mixin 继承</>, desc: <>Ruby <strong>不支持多继承</strong>, 但用 <strong>module + include</strong> 模拟。<code>Enumerable</code> 是个 module, 任何实现 <code>each</code> 的类 include 它就免费拿到 <code>map / select / reduce</code>——<em>所谓"protocol via mixin"</em>。</> },
    en: { title: <>Modules and <code>include</code> — mixin composition</>, desc: <>Ruby <strong>has no multiple inheritance</strong> — instead, <strong>modules + include</strong> deliver the same goal. <code>Enumerable</code> is a module: any class that implements <code>each</code> can <code>include</code> it and gets <code>map / select / reduce</code> for free — <em>"protocol via mixin"</em>.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Deck</span>{'\n'}
        {'  '}<span className="cl-k">include</span> <span className="cl-type">Enumerable</span>{'\n\n'}
        {'  '}<span className="cl-k">def</span> <span className="cl-fn">each</span>{'\n'}
        {'    '}<span className="cl-k">yield</span> <span className="cl-s">"♠A"</span>; <span className="cl-k">yield</span> <span className="cl-s">"♥K"</span>{'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>{'\n\n'}
        <span className="cl-type">Deck</span>.<span className="cl-fn">new</span>.<span className="cl-fn">map</span>(&:<span className="cl-fn">downcase</span>)
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>DSL — 内嵌领域语言</>, desc: <>Ruby <strong>语法噪音极少</strong> (圆括号常省、block 直接接、运算符可重载), 是<em>写 DSL 的天堂</em>。Rails routing、RSpec、Capistrano、Sinatra 全是 DSL——读起来像配置, 跑起来是 Ruby。</> },
    en: { title: <>DSLs — domain-specific languages embedded in Ruby</>, desc: <>Ruby has <strong>extremely low syntax noise</strong> (optional parens, trailing blocks, overloadable operators), making it a <em>DSL paradise</em>. Rails routing, RSpec, Capistrano, Sinatra — all DSLs. They read like config; they're actually Ruby code.</> },
    code: (
      <code>
        <span className="cl-c"># RSpec — looks like English</span>{'\n'}
        <span className="cl-fn">describe</span> <span className="cl-type">User</span> <span className="cl-k">do</span>{'\n'}
        {'  '}<span className="cl-fn">it</span> <span className="cl-s">"has a name"</span> <span className="cl-k">do</span>{'\n'}
        {'    '}<span className="cl-fn">expect</span>(user.name).<span className="cl-fn">to</span> <span className="cl-fn">eq</span>(<span className="cl-s">"Alice"</span>){'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <><code>define_method</code> — 启动时合成</>, desc: <>启动期用 <code>define_method</code> 动态<strong>生成方法</strong>, 比 <code>method_missing</code> 快得多——因为<strong>方法真的存在</strong>, 走正常 inline cache。<em>Rails 现代风格: 元编程, 但启动时定死</em>。</> },
    en: { title: <><code>define_method</code> — synthesise methods at boot</>, desc: <>Use <code>define_method</code> to <strong>generate methods at startup</strong>. Much faster than <code>method_missing</code> because the methods <strong>actually exist</strong> and hit the normal inline cache. <em>Modern Rails idiom: metaprogramming, but resolved at boot</em>.</> },
    code: (
      <code>
        <span className="cl-k">class</span> <span className="cl-type">Role</span>{'\n'}
        {'  '}%i[admin editor viewer].<span className="cl-fn">each</span> <span className="cl-k">do</span> |r|{'\n'}
        {'    '}<span className="cl-fn">define_method</span>(<span className="cl-s">"#{'{'}r{'}'}?"</span>) <span className="cl-k">do</span>{'\n'}
        {'      '}@role == r{'\n'}
        {'    '}<span className="cl-k">end</span>{'\n'}
        {'  '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>
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
    icon: '◇',
    zh: { title: <>Programmer happiness — Matz 的明确目标</>, desc: <>Matz 自己反复说: Ruby 的设计目标是<strong>"让程序员高兴"</strong>。<em>这是 PL 史上罕见的把"主观体验"写进设计文档的语言</em>。Ruby 不追求最快、不追求最严格——追求<strong>读起来舒服</strong>, 然后剩下的让 YJIT 来管。</> },
    en: { title: <>Programmer happiness — Matz's explicit goal</>, desc: <>Matz says it repeatedly: Ruby is designed to <strong>"make programmers happy."</strong> <em>This is rare in PL history — a language whose stated design value is a subjective feeling</em>. Ruby doesn't aim for the fastest or the strictest; it aims to <strong>read well</strong>, and lets YJIT handle the rest.</> },
    code: <><span className="cl-c"># Matz, repeatedly:</span>{'\n'}<span className="cl-c"># "Ruby is designed to make</span>{'\n'}<span className="cl-c">#  programmers happy."</span></>,
  },
  {
    icon: '◈',
    zh: { title: <>读起来像英语</>, desc: <>Ruby 让<strong>方法链像句子</strong>: <code>{`5.times { ... }`}</code>、<code>users.select &.active?</code>、<code>article.published?</code>。这种"<em>fluent</em>"风格被 RSpec、Sidekiq、ActiveRecord 推到极致——<strong>非程序员都能猜出 Ruby 代码在干嘛</strong>。</> },
    en: { title: <>Code that reads like English</>, desc: <>Ruby makes <strong>method chains read like sentences</strong>: <code>{`5.times { ... }`}</code>, <code>users.select &.active?</code>, <code>article.published?</code>. The "fluent" style is pushed to its limit by RSpec, Sidekiq and ActiveRecord — <strong>non-programmers can often guess what Ruby code is doing</strong>.</> },
    code: <>users.<span className="cl-fn">where</span>(<span className="cl-sym">active</span>: <span className="cl-k">true</span>){'\n'}{'     '}.<span className="cl-fn">order</span>(<span className="cl-sym">:created_at</span>){'\n'}{'     '}.<span className="cl-fn">limit</span>(<span className="cl-n">10</span>){'\n'}{'     '}.<span className="cl-fn">map</span>(&:<span className="cl-fn">email</span>)</>,
  },
  {
    icon: '◉',
    zh: { title: <>Convention over configuration — Rails 哲学</>, desc: <>DHH 在 2004 年把"<strong>大多数项目长得差不多, 别让每个程序员重新发明目录结构</strong>"做成核心理念。<code>app/models</code>、<code>app/controllers</code>、命名规则……跟着 Rails 走就能跑。<em>这种"专家把默认值选好"哲学影响了之后所有 web 框架</em>。</> },
    en: { title: <>Convention over configuration</>, desc: <>DHH baked the principle <strong>"most apps look alike — stop reinventing directory structures"</strong> into Rails in 2004. <code>app/models</code>, <code>app/controllers</code>, naming rules — follow the conventions and the framework works. <em>The "experts picked the defaults" idea then influenced essentially every web framework that came after</em>.</> },
    code: <><span className="cl-c"># Rails: zero config needed</span>{'\n'}<span className="cl-k">class</span> <span className="cl-type">Article</span> &lt; <span className="cl-type">ApplicationRecord</span>{'\n'}{'  '}<span className="cl-fn">belongs_to</span> <span className="cl-sym">:author</span>{'\n'}{'  '}<span className="cl-fn">has_many</span>   <span className="cl-sym">:comments</span>{'\n'}<span className="cl-k">end</span></>,
  },
  {
    icon: '◊',
    zh: { title: <>The Majestic Monolith — 反碎片化</>, desc: <>DHH 公开反对微服务: <strong>"小团队跑 micro-services 是自找麻烦"</strong>。GitHub 是 Rails 单体, Shopify 是 Rails 单体, Basecamp 是 Rails 单体——<em>三家年营收 $1B+ 都跑在"被嘲笑了 10 年"的单体上</em>。Rails 8 的 Solid Queue/Cache 把"<strong>Postgres 起步, 不下载 Redis</strong>"做成默认。</> },
    en: { title: <>The Majestic Monolith — anti-fragmentation</>, desc: <>DHH publicly opposes microservices: <strong>"small teams running micro-services are courting pain."</strong> GitHub is a Rails monolith. Shopify is a Rails monolith. Basecamp is a Rails monolith — <em>three $1B+ companies running on the architecture HN has been mocking for ten years</em>. Rails 8's Solid Queue / Cache makes <strong>"start with Postgres, don't install Redis"</strong> the default.</> },
    code: <><span className="cl-c"># Rails 8 defaults — no Redis</span>{'\n'}<span className="cl-c"># Solid Queue · DB-backed jobs</span>{'\n'}<span className="cl-c"># Solid Cache · DB-backed cache</span>{'\n'}<span className="cl-c"># Solid Cable · DB-backed pubsub</span></>,
  },
  {
    icon: '◆',
    zh: { title: <>Shopify 接过编译器</>, desc: <>2015 起 Shopify 把 Ruby/Rails 当核心战略, 现在有<strong>~1500 个 Ruby 工程师</strong>, 资助 <strong>YJIT、TruffleRuby、Sorbet、Tapioca</strong>。Maxime Chevalier-Boisvert (YJIT) 全职在 Shopify。<em>Ruby 是少数"<strong>有一家上市公司认真供养</strong>"的脚本语言</em>——Python 没有, JS 也只有 Node 基金会。</> },
    en: { title: <>Shopify carries the compiler</>, desc: <>Since 2015 Shopify has made Ruby/Rails core strategy and now employs <strong>~1500 Ruby engineers</strong>, sponsoring <strong>YJIT, TruffleRuby, Sorbet and Tapioca</strong>. Maxime Chevalier-Boisvert (YJIT) works on it full-time at Shopify. <em>Ruby is one of the few scripting languages with a <strong>seriously committed public-company patron</strong></em> — Python doesn't, JS only has the Node foundation.</> },
    code: <><span className="cl-c"># Shopify-backed projects:</span>{'\n'}<span className="cl-c"># · YJIT          (the JIT)</span>{'\n'}<span className="cl-c"># · Sorbet        (gradual types)</span>{'\n'}<span className="cl-c"># · Tapioca       (RBI generator)</span>{'\n'}<span className="cl-c"># · TruffleRuby   (GraalVM-based)</span></>,
  },
  {
    icon: '◐',
    zh: { title: <>Hotwire — Rails 的反 SPA 答案</>, desc: <>2020 年 37signals 开源 <strong>Hotwire</strong> (Turbo + Stimulus): 服务端渲染 HTML, 用 WebSocket 局部 patch DOM。<em>"<strong>不用 React 也能做现代 UX</strong>"</em>——成立。Hey、Basecamp、GitHub (部分) 都在跑。<em>这套思路又被 HTMX 在 2023 年抢成主流叙事</em>。</> },
    en: { title: <>Hotwire — Rails's anti-SPA answer</>, desc: <>In 2020 37signals open-sourced <strong>Hotwire</strong> (Turbo + Stimulus): server-rendered HTML patched into the DOM over WebSocket. The claim <strong>"you don't need React to ship modern UX"</strong> turns out to be defensible. Hey, Basecamp and parts of GitHub run on it. <em>HTMX then borrowed the same idea and stole the headline narrative in 2023</em>.</> },
    code: <><span className="cl-c"># turbo_stream — patch DOM</span>{'\n'}<span className="cl-fn">turbo_stream</span>.<span className="cl-fn">append</span>(<span className="cl-s">"comments"</span>,{'\n'}{'  '}<span className="cl-fn">partial</span>: <span className="cl-s">"comment"</span>,{'\n'}{'  '}<span className="cl-fn">locals</span>: {'{'} <span className="cl-fn">comment</span>: c {'}'}{')'}</>,
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
    href: 'https://github.com', highlight: true,
    zhName: 'GitHub', enName: 'GitHub',
    zhNote: '17 年 Rails 单体 · 至今', enNote: '17-year Rails monolith · still',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0D1117"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://shopify.com', highlight: true,
    zhName: 'Shopify', enName: 'Shopify',
    zhNote: 'Rails · YJIT 出资方', enNote: 'Rails · YJIT sponsor',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#95BF47"/><path d="M68 30 C66 27 62 26 60 26 L58 22 C56 18 52 18 50 20 L48 22 C46 22 44 22 42 24 L30 30 L34 80 L70 76 L68 30 Z M50 26 C52 26 54 28 54 30 L50 32 V26 Z" fill="#fff"/><text x="50" y="62" textAnchor="middle" fill="#5E8E3E" fontSize="18" fontWeight="700" fontFamily="serif">S</text></svg>,
  },
  {
    href: 'https://stripe.com', highlight: true,
    zhName: 'Stripe', enName: 'Stripe',
    zhNote: '后端大量 Ruby + Sorbet', enNote: 'Heavy Ruby + Sorbet backend',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#635BFF"/><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="700" fontFamily="sans-serif" letterSpacing="-1">S</text></svg>,
  },
  {
    href: 'https://basecamp.com', highlight: true,
    zhName: '37signals', enName: '37signals',
    zhNote: 'Rails 的家 · Basecamp / Hey', enNote: 'Home of Rails · Basecamp / Hey',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1C1C1C"/><text x="50" y="60" textAnchor="middle" fill="#F5D90A" fontSize="32" fontWeight="700" fontFamily="serif">37</text></svg>,
  },
  {
    href: 'https://airbnb.com',
    zhName: 'Airbnb', enName: 'Airbnb',
    zhNote: 'Rails 起家 · 部分迁出', enNote: 'Rails-born · partial exit',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FF5A5F"/><path d="M50 22 C42 36 28 60 28 70 C28 78 35 82 42 78 C46 76 48 72 50 68 C52 72 54 76 58 78 C65 82 72 78 72 70 C72 60 58 36 50 22 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://gitlab.com',
    zhName: 'GitLab', enName: 'GitLab',
    zhNote: 'Rails 单体 · 自托管', enNote: 'Rails monolith · self-hostable',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FC6D26"/><path d="M50 78 L30 50 L36 30 L42 48 H58 L64 30 L70 50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://coinbase.com',
    zhName: 'Coinbase', enName: 'Coinbase',
    zhNote: 'Rails 起家', enNote: 'Rails-born',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0052FF"/><circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeWidth="5"/><rect x="42" y="42" width="16" height="16" fill="#fff"/></svg>,
  },
  {
    href: 'https://square.com',
    zhName: 'Square', enName: 'Square',
    zhNote: 'Rails + Sorbet', enNote: 'Rails + Sorbet',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#3E4348"/><rect x="28" y="28" width="44" height="44" rx="6" fill="#fff"/><rect x="42" y="42" width="16" height="16" fill="#3E4348"/></svg>,
  },
  {
    href: 'https://instacart.com',
    zhName: 'Instacart', enName: 'Instacart',
    zhNote: 'Rails 单体 · 上市公司', enNote: 'Rails monolith · public co.',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0AAD0A"/><path d="M30 26 H70 L62 64 H38 Z" fill="#fff"/><circle cx="40" cy="76" r="6" fill="#fff"/><circle cx="62" cy="76" r="6" fill="#fff"/></svg>,
  },
  {
    href: 'https://soundcloud.com',
    zhName: 'SoundCloud', enName: 'SoundCloud',
    zhNote: 'Rails 起家', enNote: 'Rails-born',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FF5500"/><path d="M22 60 V72 H26 V58 Z M30 56 V72 H34 V52 Z M38 50 V72 H42 V46 Z M46 44 V72 H50 V40 Z M54 40 V72 H78 C84 72 84 56 78 56 C78 50 64 48 54 40 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://hey.com',
    zhName: 'Hey · Email', enName: 'Hey · Email',
    zhNote: '37signals 邮件 · Hotwire 全栈', enNote: '37signals mail · Hotwire-driven',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#5522FA"/><text x="50" y="64" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="700" fontFamily="sans-serif">HEY</text></svg>,
  },
  {
    href: 'https://rubygems.org',
    zhName: 'RubyGems', enName: 'RubyGems',
    zhNote: '17 万个 gem · ~200B 下载', enNote: '170k gems · ~200B downloads',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0A0D"/><polygon points="50,20 78,40 50,80 22,40" fill="#CC342D" stroke="#FFB5A7" strokeWidth="1.5"/><polygon points="50,20 78,40 22,40" fill="#E84B3F" opacity=".7"/></svg>,
  },
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
      title: <>YJIT 与 Rails 8 的并行红利</>,
      body: (<>
        <p>2026 年 Ruby 的<strong>性能问题已经不是问题</strong>——YJIT 默认开, Rails 工作负载比 2.7 时代快 <strong>2.5x+</strong>。Shopify 内部公布<strong>~9% CPU 节省</strong>跑在 100% 生产流量上, Rails 8 的 Solid Queue/Cache 把外部依赖砍掉, 单 Postgres 就能起步。</p>
        <p>这两件事合起来意味着 Ruby <strong>不再是"性能差但优雅的小型语言"</strong>。对中型业务 (10–1000 工程师) 来说 Rails 的<em>单体 + Hotwire + YJIT</em>组合是 2026 年最少零件的全栈方案。</p>
        <div className="perf-chart">
          <div className="perf-chart-h"><L zh="Rails 真实负载相对速度 (Ruby 2.7 = 100)" en="Rails workload relative perf (Ruby 2.7 = 100)" /></div>
          <div className="perf-row"><span className="perf-name">Ruby 2.7</span><div className="perf-bar b-65" /><span className="perf-val">100</span></div>
          <div className="perf-row"><span className="perf-name">Ruby 3.0</span><div className="perf-bar b-100" /><span className="perf-val">~135</span></div>
          <div className="perf-row"><span className="perf-name">3.2 + YJIT</span><div className="perf-bar b-160" /><span className="perf-val">~210</span></div>
          <div className="perf-row"><span className="perf-name">3.4 + YJIT</span><div className="perf-bar b-160" /><span className="perf-val">~250</span></div>
        </div>
      </>),
    },
    en: {
      title: <>YJIT + Rails 8 — a compounding tailwind</>,
      body: (<>
        <p>Ruby's <strong>perf story is no longer a story</strong> in 2026 — YJIT is default, Rails workloads run <strong>2.5×+</strong> faster than they did on 2.7. Shopify reports <strong>~9% CPU savings</strong> at 100% production traffic, and Rails 8's Solid Queue / Cache strip external dependencies — a single Postgres is enough to ship.</p>
        <p>Combined, that means Ruby <strong>is no longer "the elegant but slow small language."</strong> For mid-sized businesses (10–1000 engineers), the <em>monolith + Hotwire + YJIT</em> stack is the lowest-moving-parts full-stack option of 2026.</p>
        <div className="perf-chart">
          <div className="perf-chart-h">Rails workload relative perf (Ruby 2.7 = 100)</div>
          <div className="perf-row"><span className="perf-name">Ruby 2.7</span><div className="perf-bar b-65" /><span className="perf-val">100</span></div>
          <div className="perf-row"><span className="perf-name">Ruby 3.0</span><div className="perf-bar b-100" /><span className="perf-val">~135</span></div>
          <div className="perf-row"><span className="perf-name">3.2 + YJIT</span><div className="perf-bar b-160" /><span className="perf-val">~210</span></div>
          <div className="perf-row"><span className="perf-name">3.4 + YJIT</span><div className="perf-bar b-160" /><span className="perf-val">~250</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'TYPES',
    zh: { title: <>Sorbet / RBS — 渐进类型的两条路</>, body: <><p>Ruby 2.0 起就讨论"是否要静态类型"。两条线在跑: <strong>Sorbet</strong> (Stripe 出品, 单独 type checker, <code>.rbi</code> 文件) 和 <strong>RBS</strong> (官方, Ruby 3.0 入 stdlib, <code>.rbs</code> 文件)。<em>2026 现状: 两者并存, Stripe / Shopify 用 Sorbet, 普通 gem 给 RBS sig 多一些</em>。Ruby 没有要变成 TypeScript——<strong>Matz 反复声明: 类型是 optional, 不进语法</strong>。</p></> },
    en: { title: <>Sorbet vs RBS — two roads to gradual typing</>, body: <><p>"Should Ruby get static types?" has been argued since 2.0. Two parallel efforts: <strong>Sorbet</strong> (Stripe, separate type checker, <code>.rbi</code> files) and <strong>RBS</strong> (official, in stdlib since Ruby 3.0, <code>.rbs</code> files). <em>State in 2026: both coexist; Stripe / Shopify use Sorbet, the general gem ecosystem favours shipping RBS sigs</em>. Ruby is not turning into TypeScript — <strong>Matz keeps saying types are optional and never enter the syntax</strong>.</p></> },
  },
  {
    tag: 'CONCURRENCY',
    zh: { title: <>Ractor 和真并行</>, body: <><p>Ruby 历史上一直背着 <strong>GVL</strong> (Global VM Lock, 类似 Python GIL): 同一进程一个核。Ruby 3.0 引入 <strong>Ractor</strong> (actor 模型, 各自有 GC heap), 理论上可以多核。<em>但 2026 年 Ractor 仍是<strong>实验性</strong>——很多 gem 不 ractor-safe</em>。<strong>主流并发解法仍是多进程 (puma / unicorn fork) + Fiber-based IO</strong>。</p></> },
    en: { title: <>Ractor &amp; true parallelism</>, body: <><p>Ruby has lived with the <strong>GVL</strong> (Global VM Lock — Python's GIL by another name): one core per process. Ruby 3.0 introduced <strong>Ractor</strong>, an actor model with per-Ractor GC heaps, theoretically enabling multi-core. <em>In 2026 Ractor is still <strong>experimental</strong> — many gems aren't ractor-safe</em>. <strong>The mainstream concurrency story is still multi-process (puma / unicorn fork) + Fiber-based IO</strong>.</p></> },
  },
  {
    tag: 'JOB MARKET',
    zh: { title: <>真正的软肋: 招聘市场</>, body: <><p>性能、生态、稳定性都不是 2026 年 Ruby 的问题——<strong>招聘是</strong>。年轻工程师默认学 TS / Go / Rust, Ruby/Rails 职位增长曲线在<em>横盘 5 年</em>。<strong>Stack Overflow 2025 调查: Ruby 仍在 top-20 most-loved, 但 most-wanted 排名持续下降</strong>。讽刺的是, <em>会 Ruby 的人在市场上反而稀缺, 工资比平均高</em>——但新人不愿意学。</p></> },
    en: { title: <>The real soft spot: the hiring market</>, body: <><p>Performance, ecosystem, stability — none of those are Ruby's problems in 2026. <strong>Hiring is</strong>. Younger engineers default to TS / Go / Rust; the Ruby/Rails job-listings curve has been flat for <em>five years</em>. <strong>Stack Overflow 2025 survey: Ruby still ranks in the top-20 most-loved, but its most-wanted ranking has steadily fallen</strong>. Ironically, <em>Ruby-fluent people are scarce on the market and command above-average pay</em> — but new entrants aren't learning it.</p></> },
  },
];

export default function RubyIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Ruby : 程序员幸福为本 · Matz / DHH / Shopify 的三十年',
    'Ruby : Optimised for programmer happiness — three decades of Matz, DHH and Shopify',
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .spotlight, .ai-reverse, .ai-takeaway, .quote-block, .stack-row, .perf-bar'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.ai-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.stack-row').forEach((el, i) => { el.style.transitionDelay = `${i * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.perf-bar').forEach((el, i) => { el.style.transitionDelay = `${i * 90}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--ruby-bright)' : '';
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
      <div ref={rootRef} className="ruby-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="rb-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E84B3F" />
                  <stop offset="100%" stopColor="#8C1E1A" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#rb-nav)" />
              <polygon points="60,86 196,86 168,58 88,58" fill="#FFD2C8" opacity=".9" />
              <polygon points="60,86 128,206 60,140" fill="#9A2521" />
              <polygon points="196,86 128,206 196,140" fill="#5C1310" />
              <polygon points="60,86 196,86 128,206" fill="#CC342D" />
            </svg>
            <span>Ruby</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#dhh"><L zh="DHH" en="DHH" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Python" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1993 — 2026 · Matz (Yukihiro Matsumoto) · Rails · Shopify · YJIT</div>
            <h1 className="hero-title">
              <span className="hero-name">Ruby</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">happiness</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>一门<strong>把"程序员幸福"明文写进设计目标</strong>的脚本语言。1995 年从日本筑波寄出, 2004 年靠 Rails 打开全球 Web 2.0, 2021 年靠 Shopify 的 YJIT 重新拿回性能话语权——<strong>33 岁的 Ruby 没火过最大的火, 但也没死过</strong>。GitHub / Shopify / Stripe / 37signals 仍跑在 Rails 上。</>}
                en={<>A scripting language that <strong>writes "programmer happiness" into its design goals</strong>. Shipped from Tsukuba, Japan in 1995; rode Rails into Web 2.0 dominance in 2004; reclaimed its perf credentials in 2021 via Shopify's YJIT. <strong>At 33, Ruby has never been the hottest language alive — and has never died</strong>. GitHub, Shopify, Stripe and 37signals all still run on Rails.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1995<small></small></span>
                <span className="stat-label"><L zh={<>12 月 21 日 首次公开<br /><em>0.95 · fj.sources</em></>} en={<>0.95 released Dec 21<br /><em>fj.sources, Japan</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">170k<small> gems</small></span>
                <span className="stat-label"><L zh={<>RubyGems 包总数<br /><em>~200B 下载累计</em></>} en={<>Packages on RubyGems<br /><em>~200B downloads total</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2.5<small>×</small></span>
                <span className="stat-label"><L zh={<>3.4+YJIT vs 2.7<br /><em>Rails 工作负载</em></>} en={<>3.4 + YJIT vs 2.7<br /><em>Rails workloads</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">$5B<small>+</small></span>
                <span className="stat-label"><L zh={<>Shopify 年收入<br /><em>跑在 Rails 单体上</em></>} en={<>Shopify annual revenue<br /><em>on a Rails monolith</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {RUBY_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">5.times do</span>
              <span className="float f2">{':symbol'}</span>
              <span className="float f3">method_missing</span>
              <span className="float f4">do |x| ... end</span>
              <span className="float f5">attr_accessor</span>
              <span className="float f6">{'@@class_var'}</span>
              <span className="float f7">module Enumerable</span>
              <span className="float f8">{'puts "hello"'}</span>
              <span className="float f9">{'belongs_to :user'}</span>
              <span className="float f10">{'2.days.ago'}</span>
              <span className="float f11">{'&:to_s'}</span>
              <span className="float f12">yield</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Ruby</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Ruby 是 <strong>1993 年由日本程序员松本行弘 (Matz) 设计、1995 年公开发布的面向对象脚本语言</strong>。<strong>纯 OO</strong> (一切是对象)、<strong>动态类型</strong>、<strong>block + 元编程</strong>三个特征塑造了它的所有 idiom。1995–2004 在日本社区静静生长, 2004 年 DHH 用它写出 <strong>Rails</strong> 之后, Ruby 才走向世界。</>}
                  en={<>Ruby is an <strong>object-oriented scripting language designed by Japanese programmer Yukihiro "Matz" Matsumoto in 1993, released publicly in 1995</strong>. Three traits shape every Ruby idiom: <strong>pure OO</strong> (everything is an object), <strong>dynamic typing</strong>, and <strong>blocks + metaprogramming</strong>. It grew quietly in Japan from 1995 to 2004; it went global only after DHH built <strong>Rails</strong> on top of it.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="纯面向对象" en="Pure object-oriented" />, tag: 'paradigm', p: <L zh={<>比 Java / Python <strong>更彻底</strong>: <code>1</code>、<code>nil</code>、<code>true</code>、class 本体全是对象。没有 primitive 跟 object 的二分——<strong>nothing escapes object model</strong>。</>} en={<><strong>More radical</strong> than Java or Python: <code>1</code>, <code>nil</code>, <code>true</code>, and classes themselves are all objects. There is no primitive/object split — <strong>nothing escapes the object model</strong>.</>} /> },
                { h: <L zh="动态类型 · 鸭子" en="Dynamic / duck-typed" />, tag: 'types', p: <L zh={<><strong>编译期完全不查类型</strong>; <em>"会叫就当鸭"</em>。Sorbet / RBS 是<strong>可选</strong>的旁路标注, 不进语言核心——Matz 多次声明类型永远 optional。</>} en={<><strong>No type-check at compile time</strong>; <em>"if it quacks, it's a duck."</em> Sorbet / RBS provide optional side-loaded annotations, but never enter the language proper — Matz keeps saying types stay optional.</>} /> },
                { h: <L zh="Block 是核心" en="Blocks at the core" />, tag: 'control', p: <L zh={<><code>{`5.times { ... }`}</code>、<code>{`File.open(...) do |f| ... end`}</code>——<strong>方法接 block 是 Ruby 控制流的主轴</strong>。其它语言要 closure / lambda 多写几行, Ruby 一笔带过。</>} en={<><code>{`5.times { ... }`}</code>, <code>{`File.open(...) do |f| ... end`}</code> — <strong>methods taking a block is the spine of Ruby's control flow</strong>. Where other languages need explicit closures or lambdas, Ruby gets it in one stroke.</>} /> },
                { h: <L zh="MRI · YARV · YJIT" en="MRI · YARV · YJIT" />, tag: 'runtime', p: <L zh={<>官方实现 <strong>MRI</strong> (Matz's Ruby Interpreter) → 2007 改 <strong>YARV</strong> bytecode VM → 2021 加 <strong>YJIT</strong> (Shopify 写的 in-process JIT)。<em>3.4 起 YJIT 默认开</em>, 2026 年 Ruby 不再"<strong>慢</strong>"。</>} en={<>The official implementation is <strong>MRI</strong> (Matz's Ruby Interpreter) → <strong>YARV</strong> bytecode VM (2007) → <strong>YJIT</strong> (Shopify's in-process JIT, 2021). <em>Default-on from 3.4</em> — in 2026 Ruby is no longer <strong>"the slow one."</strong></>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">user_list.java</span><span className="lang-tag js">Java</span></div>
                <pre className="code"><code>
                  <span className="cl-k">List</span>&lt;<span className="cl-type">String</span>&gt; emails = <span className="cl-k">new</span> <span className="cl-type">ArrayList</span>&lt;&gt;();{'\n'}
                  <span className="cl-k">for</span> (<span className="cl-type">User</span> u : users) {'{'}{'\n'}
                  {'    '}<span className="cl-k">if</span> (u.<span className="cl-fn">isActive</span>()) {'{'}{'\n'}
                  {'        '}emails.<span className="cl-fn">add</span>(u.<span className="cl-fn">getEmail</span>().<span className="cl-fn">toLowerCase</span>());{'\n'}
                  {'    '}{'}'}{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// 7 行 · 类型样板 · null check 自己来" en="// 7 lines · typing ceremony · null checks on you" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">user_list.rb</span><span className="lang-tag ts">Ruby</span></div>
                <pre className="code"><code>
                  emails = users.<span className="cl-fn">select</span>(&:<span className="cl-fn">active?</span>){'\n'}
                  {'              '}.<span className="cl-fn">map</span>(&:<span className="cl-fn">email</span>){'\n'}
                  {'              '}.<span className="cl-fn">map</span>(&:<span className="cl-fn">downcase</span>){'\n\n'}
                  <span className="cl-c"><L zh="# 3 行 · 链式可读 · 没样板" en="# 3 lines · fluent · zero ceremony" /></span>{'\n'}
                  <span className="cl-c"><L zh="# &:method 是 symbol-to-proc, Ruby 招牌" en="# &:method is symbol-to-proc, signature Ruby" /></span>
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
                zh={<>Ruby 走过<strong>三个明显阶段</strong>: <em>1993–2003 日本国民期</em> (Matz 单干, 全日文社区); <em>2004–2013 Rails 黄金期</em> (DHH 把 Ruby 推向世界, Twitter / GitHub / Shopify 起家); <em>2014–2026 Shopify 时代</em> (新框架冷落了 Rails, 但 Shopify 接过编译器, YJIT + Rails 8 让 Ruby 重新成熟)。</>}
                en={<>Ruby has three clear eras: <em>1993–2003 the Japan-only years</em> (Matz alone, Japanese-language community); <em>2004–2013 the Rails golden age</em> (DHH carries Ruby out of Japan; Twitter / GitHub / Shopify are born on Rails); <em>2014–2026 the Shopify era</em> (newer frameworks steal mindshare, but Shopify picks up the compiler — YJIT and Rails 8 give Ruby a mature second wind).</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: RubyAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 Ruby 跟其它语言<strong>最不一样的部分</strong>: 纯 OO、block + yield、symbol、<code>method_missing</code>、monkey patching、module mixin、DSL、<code>define_method</code>。第 9 张是 Matz 的设计哲学。</>}
                en={<>The eight cards below are where Ruby <strong>diverges hardest</strong> from other languages on this site: pure OO, blocks + yield, symbols, <code>method_missing</code>, monkey patching, module mixins, DSLs, <code>define_method</code>. The ninth card is the Matz philosophy that links them.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {MO_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>Matz 哲学 — Programmer Happiness</>} en={<>The Matz Philosophy — Programmer Happiness</>} /></h3>
                <p><L
                  zh={<>这八条 idiom 不是孤立的——它们共同服务 Matz 一句口号: <strong>"<em>Ruby is designed for programmer happiness</em>"</strong>。Symbol 让 hash key 简洁; block 让回调读起来像句子; monkey patch 让你能改任何东西; DSL 让配置变成 Ruby 代码。<em>这种"<strong>主观体验优先</strong>"在 PL 史上稀有, 也是 Ruby 30 年没死的真正原因</em>。</>}
                  en={<>None of those eight idioms stand alone — they all serve one Matz line: <strong>"<em>Ruby is designed for programmer happiness</em>."</strong> Symbols make hash keys terse; blocks make callbacks read like sentences; monkey patching lets you reshape anything; DSLs let configuration <em>be</em> Ruby. <em>This "<strong>subjective experience first</strong>" stance is rare in PL history, and it's the real reason Ruby has refused to die for thirty years</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>Ruby 不是为机器设计的, 也不是为业务设计的——它是为<strong>人</strong>设计的。</>}
                  en={<>Ruby is not designed for the machine, and not for the business — it's designed for the <strong>human</strong>.</>}
                /></em>" — Matz</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Ruby" /> <code>: WhyRuby</code></h2>
              <p className="sec-desc"><L
                zh={<>Ruby 在 2026 年不再是"最热"也不是"最快", 但有六件事让它在<strong>中型业务 web 开发</strong>这个具体细分里仍是<strong>最少零件的解</strong>: Matz 哲学、读起来像英语、convention over config、Majestic Monolith、Shopify 当 patron、Hotwire 反 SPA。</>}
                en={<>Ruby in 2026 isn't the hottest or the fastest, but six things keep it the <strong>lowest-moving-parts answer</strong> for <strong>mid-sized business web development</strong>: the Matz philosophy, English-like reading, convention over config, the Majestic Monolith, Shopify as patron, and Hotwire as the anti-SPA play.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: RubyInProduction</code></h2>
              <p className="sec-desc"><L
                zh={<>"<em>Ruby 没人用了</em>"的传言每年都有, 但<strong>2026 年的现实是</strong>: GitHub 是 Rails 单体, Shopify 跑 $5B+ 营收的 Rails app, Stripe 后端大量 Ruby, Coinbase / Square / Instacart / GitLab / Airbnb / SoundCloud 全是 Rails 起家。下表 12 个都<strong>不是历史名单</strong>——都在今天产生收入。</>}
                en={<>The "Ruby is dead" rumour is an annual tradition, but the <strong>2026 reality</strong>: GitHub is a Rails monolith; Shopify runs a Rails app behind $5B+ revenue; Stripe leans heavily on Ruby; Coinbase / Square / Instacart / GitLab / Airbnb / SoundCloud were all born on Rails. None of the twelve below is a <strong>historical list</strong> — they all generate revenue today.</>}
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

          {/* 06 DHH / Rails / 37signals */}
          <section className="section section-ai" id="dhh">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="DHH 与 Rails 信条" en="DHH &amp; the Rails Doctrine" /> <code>: <L zh="一个人, 一套立场" en="One Man, One Stance" /></code></h2>
              <p className="sec-desc"><L
                zh={<>Ruby 这门语言 = Matz。Ruby <strong>的命运</strong> = DHH。<strong>David Heinemeier Hansson</strong>不是 Ruby 的设计者, 但他用 Rails 把 Ruby 推向了全世界, 然后用<em>反主流</em>的姿态守了它 20 年。<strong>没有他, Ruby 至今仍是日本人的小众语言</strong>。本节专门讲他和他的一套立场——这套立场是 Rails 路线图的真正驱动力。</>}
                en={<>The Ruby <em>language</em> is Matz. Ruby's <strong>destiny</strong> is DHH. <strong>David Heinemeier Hansson</strong> didn't design Ruby, but he carried it out to the world via Rails, then defended it for twenty years with one of the most counter-mainstream stances in the industry. <strong>Without DHH, Ruby would still be a quiet Japanese language</strong>. This section is about him and his positions — they are the real driver of the Rails roadmap.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>大多数小公司不需要 micro-services、不需要 Kubernetes、不需要 React、不需要 GraphQL、不需要 TypeScript。它们需要的是<strong>一个能让 5 个人在 5 年内做出真正产品的 stack</strong>。Rails 一直是这个 stack——我们只是不断把<em>不必要的东西踢出去</em>。</>}
                en={<>Most small companies do not need micro-services, do not need Kubernetes, do not need React, do not need GraphQL, do not need TypeScript. What they need is <strong>a stack that lets five people ship a real product over five years</strong>. Rails has always been that stack — we just keep <em>throwing out the unnecessary pieces</em>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— David Heinemeier Hansson (DHH)</span>
                <span className="quote-context"><L zh="37signals 联合创始人 · Rails 作者 · 多次访谈合成" en="Co-founder, 37signals · creator of Rails · paraphrased from interviews" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">2004<small></small></div>
                <div className="ai-stat-h"><L zh="Rails 公开发布" en="Rails goes public" /></div>
                <p><L
                  zh={<>DHH 从 Basecamp 抽出 Rails 0.5, 7 月 24 日开源——<strong>没经过任何公司审批, 没融资, 没 marketing</strong>。一个丹麦人, 一个 Apple 笔记本, 一个 Rails screencast 视频, 引发了 2005–2010 整整五年的 web 范式革命。</>}
                  en={<>DHH extracted Rails 0.5 from Basecamp and open-sourced it on July 24 — <strong>no corporate approval, no funding, no marketing team</strong>. One Danish developer, one Apple laptop, one screencast, and a five-year revolution (2005–2010) in web development followed.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">20<small> yrs</small></div>
                <div className="ai-stat-h"><L zh="一份代码, 一个公司" en="One codebase, one company" /></div>
                <p><L
                  zh={<>DHH 没离开过 37signals, 没融过 VC, 没卖过公司。<strong>Basecamp + Hey 两个产品养出一家盈利公司, 全栈 Rails, 远程, 小团队</strong>。这种"<em>反硅谷剧本</em>"自身就是一种存在主义声明——你<em>可以</em>不当独角兽。</>}
                  en={<>DHH never left 37signals, never raised VC, never sold the company. <strong>Basecamp and Hey support a profitable business — full-stack Rails, remote, small team</strong>. The "<em>anti-Silicon-Valley playbook</em>" is itself a statement: you <em>don't have to</em> be a unicorn.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">No<small> JS framework</small></div>
                <div className="ai-stat-h"><L zh="Hotwire — 反 SPA 立场" en="Hotwire — anti-SPA" /></div>
                <p><L
                  zh={<>2020 年 37signals 开源 Hotwire (Turbo + Stimulus): <strong>服务端渲染 HTML, WebSocket 局部 patch DOM, 几乎不写 JS</strong>。Hey.com、Basecamp 4 都跑在它上。<em>"用 React 才能做现代 UX"这一假设第一次被反驳得有底气</em>。</>}
                  en={<>In 2020 37signals open-sourced Hotwire (Turbo + Stimulus): <strong>render HTML on the server, patch the DOM over WebSocket, write almost no JS</strong>. Hey.com and Basecamp 4 are both built on it. <em>The assumption "you need React for modern UX" got a serious rebuttal for the first time</em>.</>}
                /></p>
              </div>
            </div>

            {/* DHH stack diagram */}
            <div className="spotlight">
              <div className="spotlight-tag">37SIGNALS STACK · 2026</div>
              <div className="spotlight-grid">
                <div>
                  <h3><L zh="37signals 在用 / 不在用" en="What 37signals uses / refuses" /></h3>
                  <p><L
                    zh={<>下面这张表是 37signals (Basecamp + Hey) 的<strong>真实 stack</strong>。每一行的"<em>不在用</em>"都是 DHH 公开吵过的——这不是省略, 是<strong>立场</strong>。</>}
                    en={<>Here is the <strong>actual stack</strong> at 37signals (Basecamp + Hey). Every "<em>removed</em>" entry is something DHH has publicly argued about — these are not omissions, they are <strong>positions</strong>.</>}
                  /></p>
                  <p><L
                    zh={<>Rails 8 在 2024 年公开把 <strong>Solid Queue / Solid Cache / Solid Cable</strong> 做成默认, <em>明文目标是删除 Redis 依赖</em>。Kamal 2 把 Heroku-class 部署降到一台裸 Docker 机器。<strong>每一步都在执行"少一层"</strong>。</>}
                    en={<>Rails 8 (2024) makes <strong>Solid Queue / Solid Cache / Solid Cable</strong> default — explicitly to <em>remove the Redis dependency</em>. Kamal 2 brings Heroku-class deployment down to a bare Docker host. <strong>Each release is executing "one less layer"</strong>.</>}
                  /></p>
                </div>
                <div className="stack" style={{ margin: 0 }}>
                  <div className="stack-row kept">
                    <div className="stack-label"><span className="stack-bullet">+</span>Rails 8</div>
                    <div className="stack-content"><L zh="单体 · 服务端渲染" en="Monolith · server-rendered" /></div>
                  </div>
                  <div className="stack-row kept">
                    <div className="stack-label"><span className="stack-bullet">+</span>Postgres</div>
                    <div className="stack-content"><L zh="一切数据 · 含 cache / queue" en="All data · incl. cache / queue" /></div>
                  </div>
                  <div className="stack-row kept">
                    <div className="stack-label"><span className="stack-bullet">+</span>Hotwire</div>
                    <div className="stack-content"><code>turbo</code> + <code>stimulus</code></div>
                  </div>
                  <div className="stack-row kept">
                    <div className="stack-label"><span className="stack-bullet">+</span>Kamal 2</div>
                    <div className="stack-content"><L zh="裸 Docker 部署 · 取代 Heroku 类" en="Bare Docker · replaces PaaS" /></div>
                  </div>
                  <div className="stack-row killed">
                    <div className="stack-label"><span className="stack-bullet">−</span>Redis</div>
                    <div className="stack-content"><L zh="Rails 8 已替换" en="Replaced in Rails 8" /></div>
                  </div>
                  <div className="stack-row killed">
                    <div className="stack-label"><span className="stack-bullet">−</span>TypeScript</div>
                    <div className="stack-content"><L zh="2025 撤掉 · 改用测试 + RuboCop" en="Removed 2025 · tests + RuboCop instead" /></div>
                  </div>
                  <div className="stack-row killed">
                    <div className="stack-label"><span className="stack-bullet">−</span>React / SPA</div>
                    <div className="stack-content"><L zh="从未引入 · Hotwire 替代" en="Never adopted · Hotwire instead" /></div>
                  </div>
                  <div className="stack-row killed">
                    <div className="stack-label"><span className="stack-bullet">−</span>K8s</div>
                    <div className="stack-content"><L zh="从未引入 · Kamal 已够" en="Never adopted · Kamal suffices" /></div>
                  </div>
                  <div className="stack-row killed">
                    <div className="stack-label"><span className="stack-bullet">−</span>Microservices</div>
                    <div className="stack-content"><L zh="DHH 公开反对 · 单体" en="DHH publicly opposes · monolith" /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* "Twitter migration" myth */}
            <div className="ai-reverse">
              <div className="ai-reverse-text">
                <div className="ai-reverse-tag"><L zh="迷思" en="MYTH" /></div>
                <h3><L zh="Twitter 当年是因为 Ruby 慢才迁走的 — 没那么简单" en="Twitter left Ruby because it was slow — not really" /></h3>
                <p><L
                  zh={<>2008 年 Twitter 的 "<strong>fail whale</strong>" 出名之后, "Ruby 扩不了" 成了主流叙事——但这是个被高度简化的故事。<strong>真实情况</strong>: Twitter 2011 年起把<strong>搜索后端</strong>从 Ruby 迁到 Scala (Finagle / Storm), <em>前端 Web 层留 Rails 直到 2020 年代</em>。整段迁移耗时近十年。</>}
                  en={<>After Twitter's <strong>"fail whale"</strong> went viral in 2008, "Ruby can't scale" became the dominant narrative — but the real story is much more layered. <strong>What actually happened</strong>: Twitter migrated its <strong>search back end</strong> to Scala (Finagle / Storm) starting in 2011, while <em>the front-end web stayed on Rails into the 2020s</em>. The whole migration took close to a decade.</>}
                /></p>
                <p><L
                  zh={<>瓶颈是 <strong>Ruby 1.8 的 mark-and-sweep GC</strong>、<strong>单进程模型</strong>, 还有<strong>早期 ActiveRecord 的 N+1 + fan-out 写</strong>——是当时的<strong>整套实现</strong>不适合 100M tweet/day, 跟 "Ruby 这门语言" 关系小。<em>Ruby 1.9 的 YARV + 后来的 generational GC 解决了一大半</em>。</>}
                  en={<>The bottlenecks were <strong>Ruby 1.8's mark-and-sweep GC</strong>, the <strong>single-process model</strong>, and <strong>early ActiveRecord's N+1 + fan-out write patterns</strong> — the <strong>implementation choices of that era</strong> didn't fit 100M tweets/day; that has little to do with "the Ruby language." <em>YARV in 1.9 and generational GC later fixed most of it</em>.</>}
                /></p>
                <p><L
                  zh={<>对比: <strong>GitHub 同期 (2008–2020) 单 Rails 实例处理了与 Twitter 同量级流量</strong>, 一直没有"迁出"叙事——因为 GitHub 的工作负载 (Git push / PR) 跟 Twitter 的 fan-out 推送本质不同。一句"Ruby 慢"掩盖了所有架构差异。</>}
                  en={<>Compare: <strong>GitHub over the same window (2008–2020) handled Twitter-class traffic on a Rails monolith</strong>, with no "we left Ruby" narrative — because GitHub's workload (git pushes, PRs) is fundamentally different from Twitter's fan-out timeline writes. A simple "Ruby is slow" line hides every one of those architectural differences.</>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="# Twitter 迁移真相: 分层 + 渐进" en="# Twitter migration truth: layered + gradual" /></span>{'\n\n'}
                  <span className="cl-c">2008  fail whale meme</span>{'\n'}
                  <span className="cl-c">2011  search backend → Scala</span>{'\n'}
                  <span className="cl-c">2013  some services    → Scala</span>{'\n'}
                  <span className="cl-c">2015  Ruby still front-end</span>{'\n'}
                  <span className="cl-c">2020  Rails finally retired</span>{'\n'}
                  <span className="cl-c">2022  Elon takeover, infra cut</span>{'\n\n'}
                  <span className="cl-c"><L zh="# 同期 GitHub: 单 Rails 撑全站" en="# Same window, GitHub: one Rails, full site" /></span>{'\n'}
                  <span className="cl-c">2008  Rails 2 monolith</span>{'\n'}
                  <span className="cl-c">2015  &nbsp;same monolith, 100x traffic</span>{'\n'}
                  <span className="cl-c">2026  &nbsp;still Rails</span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>DHH 让 Ruby 走向世界, 然后<strong>用"反主流"姿态守了它 20 年</strong>。微服务时代他做单体, React 时代他做服务端渲染, TypeScript 时代他撤掉 TS——他错或者对都不重要, 重要的是<strong>他给 Ruby 一直保持了一条<em>非主流但成立</em>的演化方向</strong>, 而 Ruby 也没在每个潮流里迷路。</>}
                en={<>DHH carried Ruby out to the world, then <strong>defended it for twenty years with a counter-mainstream stance</strong>. In the microservices era he doubled down on monolith; in the React era he doubled down on server-render; in the TypeScript era he removed TS. Whether he is right or wrong matters less than this: <strong>he has kept Ruby evolving in a <em>non-mainstream but coherent</em> direction</strong>, and the language hasn't been lost in each fashion cycle.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Python / JavaScript */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Python / JavaScript" /> <code>: Ruby vs Python vs JS</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <strong>Python</strong> 比 (<a href="/code/python">/code/python</a>): 同代 (1991 vs 1995) 的 OO 脚本语言, 选了不同的设计 trade-off。跟 <strong>JavaScript</strong> 比 (<a href="/code/javascript">/code/javascript</a>): Web 后端的<em>主要竞争对手</em>——Node 在 2014 起抢走了"<strong>新潮 web 后端</strong>"位置, 但 Ruby/Rails 在<em>业务复杂度高的中型应用</em>仍占优势。</>}
                en={<>Versus <strong>Python</strong> (<a href="/code/python">/code/python</a>): a sibling scripting language (1991 vs 1995) that picked different design trade-offs. Versus <strong>JavaScript</strong> (<a href="/code/javascript">/code/javascript</a>): its main web-backend competitor — Node took the "<strong>fashionable web back end</strong>" slot from 2014 onward, but Rails still wins on <em>business-complex mid-sized apps</em>.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Python</th>
                  <th className="th-ts">Ruby</th>
                  <th className="th-sw">JavaScript</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Guido · 1991</>,
                    ts: <>Matz · 1995-12-21 · 日本 / Japan</>,
                    sw: <>Eich · 1995-05 · 10 days</> },
                  { k: <L zh="设计哲学" en="Design ethos" />,
                    js: <L zh={<>"应有一种明显的方式" (Zen)</>} en={<>"One obvious way" (Zen)</>} />,
                    ts: <L zh={<><strong>程序员幸福</strong> (Matz)</>} en={<><strong>Programmer happiness</strong> (Matz)</>} />,
                    sw: <L zh={<>"刚好够用就 ship" (10 天)</>} en={<>"Ship the thing in 10 days"</>} /> },
                  { k: <L zh="语法风格" en="Syntax flavour" />,
                    js: <L zh="强缩进 · 单种风格" en="Strict indent · one style" />,
                    ts: <L zh={<>极少标点 · 多种 idiom 共存</>} en={<>Minimal punctuation · multiple idioms allowed</>} />,
                    sw: <L zh="C 系花括号" en="C-family braces" /> },
                  { k: <L zh="块 / 闭包" en="Blocks / closures" />,
                    js: <L zh={<>有 lambda / def · 但<em>不是核心</em></>} en={<>Has lambdas / def — but <em>not central</em></>} />,
                    ts: <L zh={<><strong>block 是核心</strong> · do...end / {`{}`}</>} en={<><strong>Blocks are central</strong> · do...end / {`{}`}</>} />,
                    sw: <L zh={<><code>{`() => {}`}</code> · 一等公民</>} en={<><code>{`() => {}`}</code> · first-class</>} /> },
                  { k: <L zh="一切是对象" en="Everything is an object" />,
                    js: <L zh={<>差不多 · 但 <code>int</code> 是 C 级 box</>} en={<>Mostly · but ints are C-boxed</>} />,
                    ts: <L zh={<><strong>纯</strong> · 1.times / nil.to_s</>} en={<><strong>Purely</strong> · 1.times / nil.to_s</>} />,
                    sw: <L zh="原始值 vs Object 分离" en="Primitives vs Objects split" /> },
                  { k: <L zh="元编程" en="Metaprogramming" />,
                    js: <L zh="较弱 · decorator + descriptor" en="Modest · decorators + descriptors" />,
                    ts: <L zh={<><strong>极强</strong> · method_missing / define_method / open classes</>} en={<><strong>Extreme</strong> · method_missing / define_method / open classes</>} />,
                    sw: <L zh="Proxy · prototype 修改" en="Proxy · prototype mutation" /> },
                  { k: <L zh="并发" en="Concurrency" />,
                    js: <L zh={<>GIL · multiprocessing 多 · asyncio</>} en={<>GIL · multiprocessing · asyncio</>} />,
                    ts: <L zh={<><strong>GVL</strong> · 多进程 + Fiber · Ractor 实验</>} en={<><strong>GVL</strong> · multi-process + Fibers · experimental Ractor</>} />,
                    sw: <L zh="单线程事件循环 · worker_threads" en="Single-thread event loop · worker_threads" /> },
                  { k: <L zh="性能 (2026)" en="Performance (2026)" />,
                    js: <L zh={<>CPython 慢 · 3.13 free-threaded 实验</>} en={<>CPython slow · 3.13 free-threaded experiment</>} />,
                    ts: <L zh={<>YJIT 默认 · <strong>~2.5× vs Ruby 2.7</strong></>} en={<>YJIT default · <strong>~2.5× vs Ruby 2.7</strong></>} />,
                    sw: <L zh="V8 JIT · 长期领先" en="V8 JIT · perennial leader" /> },
                  { k: <L zh="Web 框架" en="Web framework" />,
                    js: <L zh="Django · Flask · FastAPI" en="Django · Flask · FastAPI" />,
                    ts: <L zh={<><strong>Rails 8</strong> (霸主) · Sinatra · Hanami</>} en={<><strong>Rails 8</strong> (dominant) · Sinatra · Hanami</>} />,
                    sw: <L zh="Express · Next · Hono · Remix" en="Express · Next · Hono · Remix" /> },
                  { k: <L zh="包管理" en="Package manager" />,
                    js: <L zh="pip + venv + poetry" en="pip + venv + poetry" />,
                    ts: <L zh={<><strong>Bundler</strong> (自带 · 标杆)</>} en={<><strong>Bundler</strong> (built-in, canonical)</>} />,
                    sw: <L zh="npm / pnpm / yarn / bun" en="npm / pnpm / yarn / bun" /> },
                  { k: <L zh="类型系统" en="Type system" />,
                    js: <L zh={<>mypy / Pyright · optional</>} en={<>mypy / Pyright · optional</>} />,
                    ts: <L zh={<>Sorbet / RBS · optional · <em>永不进语言</em></>} en={<>Sorbet / RBS · optional · <em>never in core</em></>} />,
                    sw: <L zh="TypeScript · 准必装" en="TypeScript · near-mandatory" /> },
                  { k: <L zh="主要受众" en="Primary audience" />,
                    js: <L zh="数据 · ML · 脚本 · DevOps" en="Data · ML · scripts · DevOps" />,
                    ts: <L zh={<><strong>中型业务 web 后端</strong></>} en={<><strong>Mid-sized business web back end</strong></>} />,
                    sw: <L zh="前端 · 全栈 · serverless" en="Frontend · full-stack · serverless" /> },
                  { k: <L zh="开源治理" en="Governance" />,
                    js: <L zh="PSF · BDFL 退休 · 委员会" en="PSF · ex-BDFL · steering council" />,
                    ts: <L zh={<>Matz BDFL + ruby-core + Shopify $</>} en={<>Matz BDFL + ruby-core + Shopify $</>} />,
                    sw: <L zh="TC39 委员会 · 多方厂商" en="TC39 committee · multi-vendor" /> },
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
                zh={<>Ruby 在 2026 年的<strong>真问题</strong>不再是性能 (YJIT 解决了), 也不是稳定性 (33 岁了, 库都成熟), 而是 <strong>下一代工程师不来学</strong>。下面四张卡分别讨论<em>性能红利</em>、<em>类型系统两条路</em>、<em>并发 Ractor 之惑</em>、<em>招聘市场的真伤</em>。</>}
                en={<>Ruby's real 2026 problem is no longer performance (YJIT solved it) or stability (the language is 33; libraries are mature). It's that <strong>the next generation isn't learning it</strong>. The four cards below tackle <em>the perf tailwind</em>, <em>two parallel type efforts</em>, <em>the Ractor concurrency puzzle</em>, and <em>the hiring-market soft spot</em>.</>}
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
                <li><a href="https://www.ruby-lang.org" target="_blank" rel="noopener">ruby-lang.org</a></li>
                <li><a href="https://rubyonrails.org" target="_blank" rel="noopener">rubyonrails.org</a></li>
                <li><a href="https://github.com/ruby/ruby" target="_blank" rel="noopener">GitHub · ruby/ruby</a></li>
                <li><a href="https://github.com/rails/rails" target="_blank" rel="noopener">GitHub · rails/rails</a></li>
                <li><a href="https://rubygems.org" target="_blank" rel="noopener">RubyGems</a></li>
                <li><a href="https://docs.ruby-lang.org" target="_blank" rel="noopener"><L zh="官方文档" en="Documentation" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://world.hey.com/dhh" target="_blank" rel="noopener">DHH · world.hey.com</a></li>
                <li><a href="https://rubyonrails.org/doctrine" target="_blank" rel="noopener"><L zh="Rails Doctrine" en="The Rails Doctrine" /></a></li>
                <li><a href="https://pragprog.com/titles/ruby5/programming-ruby-3-3-5e/" target="_blank" rel="noopener">Programming Ruby (Pickaxe)</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Yukihiro_Matsumoto" target="_blank" rel="noopener"><L zh="Matz 维基词条" en="Matz on Wikipedia" /></a></li>
                <li><a href="https://shopify.engineering/ruby-yjit-is-production-ready" target="_blank" rel="noopener">Shopify YJIT post</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 工具" en="Ecosystem / Tools" /></h4>
              <ul>
                <li><a href="https://hotwired.dev" target="_blank" rel="noopener">Hotwire</a></li>
                <li><a href="https://kamal-deploy.org" target="_blank" rel="noopener">Kamal</a></li>
                <li><a href="https://sorbet.org" target="_blank" rel="noopener">Sorbet (Stripe)</a></li>
                <li><a href="https://github.com/Shopify/ruby-lsp" target="_blank" rel="noopener">Ruby LSP</a></li>
                <li><a href="https://rspec.info" target="_blank" rel="noopener">RSpec</a></li>
                <li><a href="https://sidekiq.org" target="_blank" rel="noopener">Sidekiq</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/python"><L zh="Python — 同代脚本语言" en="Python — sibling scripting language" /></a></li>
                <li><a href="/code/javascript"><L zh="JavaScript — Web 后端对手" en="JavaScript — web back-end rival" /></a></li>
                <li><a href="/code/rust"><L zh="Rust — YJIT 后端语言" en="Rust — the YJIT back-end language" /></a></li>
                <li><a href="/code/ts"><L zh="TypeScript — DHH 公开撤掉" en="TypeScript — what DHH dropped" /></a></li>
                <li><a href="/code/java"><L zh="Java — Twitter 的 JVM 出口" en="Java — Twitter's JVM exit" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{RUBY_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`puts "Hello, programmer happiness"`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
