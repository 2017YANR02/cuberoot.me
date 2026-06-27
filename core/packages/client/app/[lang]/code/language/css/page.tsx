'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './css_intro.css';

/* CSS3 shield logo — pentagon similar to HTML5 but blue + "3" */
const CSS_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="css-shield" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#33A9DC" />
        <stop offset="100%" stopColor="#1572B6" />
      </linearGradient>
      <linearGradient id="css-shield-inner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1572B6" />
        <stop offset="100%" stopColor="#0B4A78" />
      </linearGradient>
    </defs>
    {/* Outer shield pentagon */}
    <path
      d="M40 28 L216 28 L200 220 L128 240 L56 220 Z"
      fill="url(#css-shield)"
    />
    {/* Inner shield (lighter on right half) */}
    <path
      d="M128 36 L128 232 L192 214 L206 36 Z"
      fill="url(#css-shield-inner)"
      opacity=".55"
    />
    {/* "3" */}
    <text
      x="128" y="160"
      textAnchor="middle"
      fontFamily="'Segoe UI', system-ui, sans-serif"
      fontSize="118"
      fontWeight="700"
      fill="#FFFFFF"
      letterSpacing="-4"
    >3</text>
    {/* "CSS" mark */}
    <text
      x="128" y="200"
      textAnchor="middle"
      fontFamily="'Cascadia Code', monospace"
      fontSize="22"
      fontWeight="600"
      fill="#E6F1F8"
      letterSpacing="2"
      opacity=".85"
    >CSS</text>
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
    year: <>1994<small>·10·10</small></>, highlight: true,
    zh: { title: <>Håkon Wium Lie 在 CERN 发起提议</>, desc: <>10 月 10 日, 在 CERN 工作的挪威人 <strong>Håkon Wium Lie</strong> 发出一封邮件, 题为 <strong>"Cascading HTML Style Sheets — a proposal"</strong>。当时的 Web 完全没有样式分层概念——HTML 自己控制外观、各浏览器各画各的。Lie 提出的<em>"层叠"</em>核心就是: <strong>页面作者、用户、浏览器</strong>各自定义样式, 再按优先级合并。<em>这是 CSS 整个语义模型的源头</em>。</> },
    en: { title: <>Håkon Wium Lie's proposal at CERN</>, desc: <>October 10. From CERN, Norwegian engineer <strong>Håkon Wium Lie</strong> sends out an email titled <strong>"Cascading HTML Style Sheets — a proposal"</strong>. The Web at the time had no notion of separated styling — HTML controlled its own look, browsers each painted differently. Lie's <em>"cascade"</em> idea was simple: <strong>author, user, browser</strong> each declare styles, merged by priority. <em>The semantic model of CSS as we know it starts here</em>.</> },
  },
  {
    year: <>1996<small>·12·17</small></>, highlight: true,
    zh: { title: <>CSS Level 1 — W3C 推荐标准</>, desc: <>1996 年底 W3C 把 CSS 1 推为正式 Recommendation。范围保守: <strong>字体、颜色、对齐、margin/padding、简单选择器</strong>。但<strong>关键一步迈出去了</strong>——样式跟结构正式分家。同期 Netscape 推 <em>JSSS (JavaScript Style Sheets)</em> 想另搞一套, 没成。</> },
    en: { title: <>CSS Level 1 — W3C Recommendation</>, desc: <>Late 1996: W3C ratifies CSS 1 as an official Recommendation. The scope is conservative: <strong>fonts, colours, alignment, margin/padding, simple selectors</strong>. But the structural break is done — <strong>style is separated from markup</strong>. Netscape briefly pushes <em>JSSS (JavaScript Style Sheets)</em> as a rival; it does not survive.</> },
  },
  {
    year: <>1998<small>·05</small></>,
    zh: { title: <>CSS 2 — 定位与媒体</>, desc: <>CSS 2 引入<strong>定位 (<code>position: absolute / relative / fixed</code>)、媒体类型 (<code>@media print</code>)、z-index、generated content (<code>::before / ::after</code>)</strong>。理论上漂亮——实际上<em>浏览器实现差到没法用</em>。这<strong>开启了"用 table 做布局"的黑暗 10 年</strong>: 嵌套 <code>&lt;table&gt;</code> + 1×1 透明 GIF 撑格子。</> },
    en: { title: <>CSS 2 — positioning and media</>, desc: <>CSS 2 brings <strong>positioning (<code>position: absolute / relative / fixed</code>), media types (<code>@media print</code>), z-index, generated content (<code>::before / ::after</code>)</strong>. Beautiful on paper — <em>but browser implementations were too broken to rely on</em>. This kicks off the <strong>dark decade of "table-based layout"</strong>: nested <code>&lt;table&gt;</code> + 1×1 transparent-GIF spacers.</> },
  },
  {
    year: <>2001<small>·08</small></>, highlight: true,
    zh: { title: <>IE 6 发布 — CSS 黑暗时代开启</>, desc: <>IE6 把<strong>broken box model</strong>带入主流, 自带专属 hack: <code>* html</code> 选择器只 IE6 看到、<code>_property</code> 下划线前缀也只 IE6 解析。前端工程师开始随身带"<em>conditional comments</em>" <code>&lt;!--[if lte IE 6]&gt;</code> 和一沓 hack 备忘录。<strong>这一段持续到 2010 年前后</strong>——MS 用了将近 10 年才认真升级 IE。</> },
    en: { title: <>IE 6 ships — the CSS dark age begins</>, desc: <>IE6 ships the <strong>broken box model</strong> as a mainstream default, plus its own proprietary hacks: <code>* html</code> selectors only IE6 sees, <code>_property</code> underscore-prefix only IE6 parses. Front-end engineers learn to carry <em>conditional comments</em> <code>&lt;!--[if lte IE 6]&gt;</code> and a thick pile of hack cheatsheets. <strong>This era runs until roughly 2010</strong> — Microsoft took nearly a decade to seriously update IE.</> },
  },
  {
    year: <>2003<small>·05</small></>,
    zh: { title: <>CSS Zen Garden 上线</>, desc: <>Dave Shea 做的 <strong>CSS Zen Garden</strong>: 同一份 HTML, 不同 CSS, <strong>外观天差地别</strong>。这个站点比任何文档都有说服力地证明了"<em>样式可以完全独立于结构</em>"。一代前端是看着 Zen Garden 学的 CSS。</> },
    en: { title: <>CSS Zen Garden launches</>, desc: <>Dave Shea's <strong>CSS Zen Garden</strong>: identical HTML, different CSS, <strong>radically different looks</strong>. The site argued more convincingly than any spec that "<em>style can be fully independent of structure</em>." A generation of front-end developers learns CSS by studying its submissions.</> },
  },
  {
    year: <>2005<small>—2010</small></>,
    zh: { title: <>CSS 3 模块化 — 不再有"单本 CSS3 规范"</>, desc: <>W3C 放弃"CSS 3 single document"思路, 改成<strong>按模块独立推进</strong>: Selectors Level 3、Color Level 3、Media Queries Level 3、Backgrounds &amp; Borders Level 3⋯⋯每个模块自己升级、自己进 CR/REC。<em>"CSS 3"从此只是一个营销词, 不是规范</em>。这套机制让 CSS 之后 15 年能持续演进而不再卡死。</> },
    en: { title: <>CSS 3 modularised — no more "single CSS3 spec"</>, desc: <>W3C abandons the "single CSS 3 document" plan and breaks the language into <strong>independent modules</strong>: Selectors L3, Color L3, Media Queries L3, Backgrounds &amp; Borders L3, and on. Each module ships its own Candidate / Recommendation. <em>"CSS 3" becomes a marketing label, not a spec</em>. This is what lets CSS evolve continuously for the next 15 years without log-jamming.</> },
  },
  {
    year: <>2009<small>·06</small></>,
    zh: { title: <>Media Queries Level 3</>, desc: <>响应式设计的<strong>技术起点</strong>: <code>@media (max-width: 768px)</code> 进 Recommendation。<strong>Ethan Marcotte 2010 年</strong>写《Responsive Web Design》一文把它推向主流。<em>"移动版网站"从单独域名 (m.example.com) 走向"同一份 HTML+CSS 自适应"</em>。</> },
    en: { title: <>Media Queries Level 3</>, desc: <>The <strong>technical seed of responsive design</strong>: <code>@media (max-width: 768px)</code> becomes a Recommendation. <strong>Ethan Marcotte's 2010 article "Responsive Web Design"</strong> takes it mainstream. <em>"Mobile sites" stop meaning a separate m.example.com domain and start meaning "one HTML + CSS that adapts."</em></> },
  },
  {
    year: <>2010<small>—2018</small></>,
    zh: { title: <>预处理器时代 — Sass / Less / Stylus</>, desc: <>CSS 自己 1996 就没有变量, 也没嵌套, 也没 mixin——前端社区<strong>自己造了一套</strong>。<strong>Sass (2007)</strong>、<strong>Less (2009)</strong>、<strong>Stylus (2010)</strong> 编译到 CSS。2015 年前后 <code>node-sass</code> + <code>gulp</code> + <code>grunt</code> 是标配。这段历史决定了后来 CSS 自己添加 <code>--var</code>、<code>@nest</code> 的优先级。</> },
    en: { title: <>The preprocessor era — Sass / Less / Stylus</>, desc: <>CSS itself had no variables, no nesting, no mixins since 1996 — so the community <strong>built its own</strong>. <strong>Sass (2007)</strong>, <strong>Less (2009)</strong>, <strong>Stylus (2010)</strong> compile down to CSS. Around 2015, <code>node-sass</code> + <code>gulp</code> + <code>grunt</code> was the standard front-end pipeline. This era shaped what CSS itself later prioritised — <code>--var</code>, <code>@nest</code>, the lot.</> },
  },
  {
    year: <>2012<small>·09</small></>,
    zh: { title: <>Flexbox 规范稳定</>, desc: <>Flexbox CR (Candidate Rec) 落地, 浏览器实现从 2013 (Chrome) → 2015 (Safari + IE 11) 陆续完成。<strong>"用 flex 写布局"</strong>从此可行——告别 <code>float</code> + <code>clearfix</code> 的祖传组合, 告别 <code>vertical-align: middle</code> 玄学。<em>这是布局第一次"<strong>语义对了</strong>"</em>。</> },
    en: { title: <>Flexbox stabilises</>, desc: <>Flexbox reaches Candidate Recommendation; browser support lands progressively from 2013 (Chrome) → 2015 (Safari + IE 11). <strong>"Layout with flex"</strong> is now possible — goodbye <code>float</code> + <code>clearfix</code>, goodbye <code>vertical-align: middle</code> astrology. <em>The first time layout has <strong>the right semantics</strong></em>.</> },
  },
  {
    year: <>2016<small>·09</small></>,
    zh: { title: <>CSS Custom Properties — 原生变量</>, desc: <>Chrome 49 (2016 春) → Firefox 31 → Safari 9.1, <strong>原生 CSS 变量</strong> <code>--var</code> + <code>var()</code> 落地。<strong>关键: 它们是真正的 runtime 值, 可以 JS 改、可以 <code>@media</code> 切</strong>——Sass 的编译期变量做不到这一点。从这一年开始, "Sass 还需要吗"的讨论开始升温。</> },
    en: { title: <>CSS Custom Properties — native variables</>, desc: <>Chrome 49 (early 2016) → Firefox 31 → Safari 9.1: <strong>native CSS variables</strong> with <code>--var</code> + <code>var()</code>. <strong>The key thing: these are real runtime values</strong>, mutable from JS, swappable inside <code>@media</code> — Sass's compile-time variables cannot do this. From here on, "do we still need Sass?" begins to be a fair question.</> },
  },
  {
    year: <>2017<small>·03</small></>, highlight: true,
    zh: { title: <>CSS Grid 同年四家浏览器全上 — "布局终于对了"</>, desc: <>2017 年 3 月: <strong>Firefox 52 → Chrome 57 → Safari 10.1 → Edge 16</strong>, 四家主流浏览器在<strong>同一个春天</strong>上线 Grid Layout。<em>这是 CSS 史上最齐整的一次集体出货</em>。<strong>"二维布局"第一次有了原生语义</strong>——之前所有"分栏"都是 hack。<em>Jen Simmons 那场"Everything You Know About Web Design Just Changed"演讲是节点</em>。</> },
    en: { title: <>CSS Grid lands in every browser the same year — "layout finally worked"</>, desc: <>March 2017: <strong>Firefox 52 → Chrome 57 → Safari 10.1 → Edge 16</strong>, all four major browsers shipping Grid Layout <strong>in the same spring</strong>. <em>The most synchronised release in CSS history</em>. <strong>Two-dimensional layout finally has native semantics</strong> — every "multi-column" layout before this was a hack. <em>Jen Simmons's "Everything You Know About Web Design Just Changed" talk marks the moment</em>.</> },
  },
  {
    year: <>2017<small>·11</small></>,
    zh: { title: <>Tailwind CSS — 实用优先派</>, desc: <>Adam Wathan 发布 Tailwind: <strong>"用类名当样式"</strong>。一时间引战——OOCSS / BEM 派觉得是回到 90 年代; 实用派觉得"<em>设计系统 = CSS 文件</em>"是终极答案。无论立场, Tailwind 把"<strong>工具优先</strong>"的 mindset 带回主流, 也直接影响了后面 CSS Modules / CSS-in-JS 的辩论走向。</> },
    en: { title: <>Tailwind CSS — utility-first</>, desc: <>Adam Wathan ships Tailwind: <strong>"use class names as styles"</strong>. Instantly polarising — OOCSS / BEM purists call it a regression to the 90s; the utility-first camp calls it the endgame: "<em>design system in your CSS file</em>." Whichever side, Tailwind drags the <strong>utility-first mindset</strong> back into the mainstream and directly shapes the later CSS Modules / CSS-in-JS debate.</> },
  },
  {
    year: <>2018<small>—2023</small></>,
    zh: { title: <>CSS-in-JS 的兴衰 — 平台追上来了</>, desc: <>styled-components (2016)、Emotion (2017) 把 CSS 写到 JS 里, 红了一阵。2020 后开始反思: <strong>runtime cost、SSR 麻烦、tree-shaking 弱</strong>。2024 前后 Tailwind + CSS Modules + 原生 CSS 卷土重来。<em>"<strong>平台追上来了</strong>" (the platform caught up) 是 2023-2025 前端的核心叙事</em>: <code>:has()</code>、container queries、嵌套、<code>color-mix</code>、scroll-driven animations——以前要靠 JS 的事情, 原生 CSS 全有了。</> },
    en: { title: <>The rise and fall of CSS-in-JS — the platform caught up</>, desc: <>styled-components (2016) and Emotion (2017) put CSS inside JS, and trend hard for a few years. Post-2020 the trade-offs surface: <strong>runtime cost, SSR pain, weak tree-shaking</strong>. Around 2024, Tailwind + CSS Modules + plain CSS reclaim the mainstream. <em>"<strong>The platform caught up</strong>" is the defining 2023-2025 narrative</em>: <code>:has()</code>, container queries, nesting, <code>color-mix</code>, scroll-driven animations — everything that used to need JS now runs in CSS.</> },
  },
  {
    year: <>2023<small>·02—08</small></>, highlight: true,
    zh: { title: <>容器查询 / <code>:has()</code> / 嵌套 — 同年三件大事</>, desc: <><strong>Container queries</strong> (Chrome 105 2022-08, Firefox 110 2023-02, Safari 16 2022-09): 元素自己根据<em>父容器</em>宽度调整, 而不是全局视口——<strong>等了 10 年的功能</strong>。<strong><code>:has()</code></strong> (Safari 15.4 2022-03, Chrome 105, Firefox 121 2023-12): <em>"父选择器"</em>, 一直被认为不可能实现, 终于上了。<strong>CSS Nesting</strong>: Sass 嵌套语法直接进原生 CSS。<em>这三件中任一件单独都是大事</em>, 2023 年它们一起来了。</> },
    en: { title: <>Container queries / <code>:has()</code> / nesting — three landmarks in one year</>, desc: <><strong>Container queries</strong> (Chrome 105 2022-08, Firefox 110 2023-02, Safari 16 2022-09): elements size themselves to a <em>parent container</em>, not the global viewport — <strong>a feature requested for a decade</strong>. <strong><code>:has()</code></strong> (Safari 15.4 2022-03, Chrome 105, Firefox 121 2023-12): <em>the "parent selector"</em>, long deemed unimplementable, finally ships. <strong>CSS Nesting</strong>: Sass-style nesting becomes native. <em>Any of these alone would be a landmark</em>; 2023 ships them together.</> },
  },
  {
    year: <>2024<small>·03</small></>,
    zh: { title: <>Scroll-driven animations — 不靠 JS 的滚动动画</>, desc: <>Chrome 115 (2023-07) → Firefox 127 (2024-06): <code>animation-timeline: scroll()</code> + <code>view-timeline</code>。<strong>滚动驱动 / 视图进入驱动的动画完全用 CSS 写</strong>, 不再依赖 IntersectionObserver + RAF。这条线还在演进, Safari 还没全跟上, 但路径已经清楚——<em>"动画 = 时间线 + 关键帧 + 触发器"</em>, 滚动只是其中一种触发器。</> },
    en: { title: <>Scroll-driven animations — no JS required</>, desc: <>Chrome 115 (2023-07) → Firefox 127 (2024-06): <code>animation-timeline: scroll()</code> and <code>view-timeline</code>. <strong>Scroll- and viewport-driven animations now run entirely in CSS</strong>, no IntersectionObserver + RAF needed. The work continues — Safari is still catching up — but the model is clear: <em>"animation = timeline + keyframes + trigger"</em>, and scroll is just one possible trigger.</> },
  },
  {
    year: <>2024<small>·09</small></>,
    zh: { title: <>View Transitions API — 跨页面动画原生化</>, desc: <>Chrome 111 (2023) 上 same-document, 2024 加 <strong>cross-document view transitions</strong>: 整页跳转也能有 SwiftUI 风的元素插值动画, <strong>不写一行 JS</strong>。Safari/Firefox 跟进中。这是"<em>CSS 抢回 SPA 框架地盘</em>"的明显信号——以前必须 React/Vue 才能做的 layout animation, 浏览器原生开始接管。</> },
    en: { title: <>View Transitions API — cross-page animation, natively</>, desc: <>Chrome 111 (2023) introduced same-document transitions; 2024 adds <strong>cross-document view transitions</strong>: a full-page navigation can now interpolate elements SwiftUI-style with <strong>not a line of JS</strong>. Safari and Firefox are following. A clear signal of "<em>CSS reclaiming SPA-framework territory</em>" — layout animations that used to require React / Vue are now a browser primitive.</> },
  },
  {
    year: <>2024<small>·12</small></>,
    zh: { title: <>Anchor Positioning — 元素互定位</>, desc: <>Chrome 125 上线 <code>anchor-name</code> + <code>position-anchor</code>: <strong>tooltip、popover、context menu 终于不用 JS 算坐标</strong>了。一个元素声明自己是 anchor, 另一个元素直接相对它定位, 浏览器处理滚动、缩放、视口边界检查。<em>"为什么要等 30 年才有这个" 的功能</em>。</> },
    en: { title: <>Anchor Positioning — elements positioned relative to each other</>, desc: <>Chrome 125 ships <code>anchor-name</code> + <code>position-anchor</code>: <strong>tooltips, popovers and context menus no longer need JS to compute coordinates</strong>. One element declares itself an anchor; another positions itself relative to it, with the browser handling scroll, zoom and viewport-edge clipping. <em>The kind of feature you wonder how the Web went 30 years without</em>.</> },
  },
  {
    year: <>2025<small>·06</small></>,
    zh: { title: <><code>@scope</code> 进入主流 — 局部样式不再靠工具链</>, desc: <>Chrome 118 (2023) 早就上了 <code>@scope</code>, 2025 年 Firefox/Safari 跟齐。<strong>样式作用域</strong>不再依赖 CSS Modules 编译 hash 或 BEM 命名规范——原生写 <code>@scope (.card) {'{'}…{'}'}</code> 就行。<em>这又是一个 "<strong>过去靠工具链, 现在原生</strong>" 的样本</em>。</> },
    en: { title: <><code>@scope</code> reaches mainstream — local styles without tooling</>, desc: <>Chrome 118 (2023) shipped <code>@scope</code> early; by 2025 Firefox and Safari are in line. <strong>Style scoping</strong> no longer depends on CSS-Modules hash compilation or BEM naming discipline — write <code>@scope (.card) {'{'}…{'}'}</code> directly. <em>Another textbook "<strong>was tooling, now native</strong>" case</em>.</> },
  },
  {
    year: <>2026<small>·now</small></>,
    zh: { title: <>30 岁的 CSS — 平台追上来了</>, desc: <>2026 的 CSS: <strong>变量、嵌套、容器查询、:has、scope、view transitions、scroll-driven animations、anchor positioning, OKLCH 色彩</strong>都是原生。Sass / styled-components 现在是<em>可选, 不再是必需</em>。Tailwind 仍因 DX 流行, 但<strong>底层平台已经够强</strong>。这一页是用 CSS 写的——它会画出 grid、container query、:has() 的实时 demo, 这<em>本身就是答案</em>。</> },
    en: { title: <>CSS at 30 — the platform caught up</>, desc: <>CSS in 2026: <strong>variables, nesting, container queries, :has, scope, view transitions, scroll-driven animations, anchor positioning, OKLCH colour</strong> — all native. Sass and styled-components are <em>optional, no longer required</em>. Tailwind stays popular for DX, but <strong>the underlying platform is finally strong enough on its own</strong>. This very page is written in CSS — its live grid / container-query / <code>:has()</code> demos are themselves the answer.</> },
  },
];

interface CssCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const CSS_CARDS: CssCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>cascade</code> + <code>specificity</code></>, desc: <>CSS 的"C": <strong>层叠</strong>。同一个属性多个选择器同时命中, 用<em>(行内, ID, 类/伪类/属性, 元素/伪元素)</em>四元组比大小, 大的赢。"<strong>!important</strong>"是核武器, <em>慎用</em>。</> },
    en: { title: <>Cascade + specificity</>, desc: <>The "C" in CSS: <strong>cascading</strong>. When multiple selectors hit the same property, an <em>(inline, ID, class/pseudo/attr, type/pseudo-elem)</em> tuple decides — higher wins. "<strong>!important</strong>" is the nuclear option, <em>use sparingly</em>.</> },
    code: (
      <code>
        <span className="cl-sel">.btn</span>          {'              '}<span className="cl-c">/* (0,0,1,0) */</span>{'\n'}
        <span className="cl-sel">#hero .btn</span>   {'              '}<span className="cl-c">/* (0,1,1,0) wins */</span>{'\n'}
        <span className="cl-sel">a:hover</span>      {'              '}<span className="cl-c">/* (0,0,1,1) */</span>{'\n'}
        <span className="cl-sel">[disabled]</span>   {'              '}<span className="cl-c">/* (0,0,1,0) */</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>box model</code> — content / padding / border / margin</>, desc: <>每个元素都是<strong>四层盒子</strong>。CSS 2 默认 <code>content-box</code> (宽度只算 content); 现代代码几乎都开 <code>box-sizing: border-box</code> 让宽度包含 padding+border——<em>这是 IE5 的"错误"行为, 2010 年后所有人都承认它更合理</em>。</> },
    en: { title: <>Box model — content / padding / border / margin</>, desc: <>Every element is a <strong>four-layer box</strong>. CSS 2 defaulted to <code>content-box</code> (width = content only); modern stylesheets nearly all flip to <code>box-sizing: border-box</code> so width includes padding+border — <em>the "wrong" IE5 behaviour everyone after 2010 admits was actually more sensible</em>.</> },
    code: (
      <code>
        <span className="cl-sel">*, *::before, *::after</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">box-sizing</span>: <span className="cl-v">border-box</span>;{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-c">/* width 360px = total · not content */</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>flexbox</code> — 一维布局</>, desc: <>2012 规范稳定, 2013-2015 浏览器跟齐。<strong>一根轴 + 主/交叉</strong>, 解决了"行内对齐", "等分剩余空间", "<em>垂直居中</em>"这三个 CSS 1.0 以来的顽固问题。</> },
    en: { title: <>Flexbox — one-dimensional layout</>, desc: <>Spec stabilised in 2012, browsers caught up 2013-2015. <strong>One axis + main/cross</strong>: it killed three of the oldest CSS pain points — inline alignment, splitting leftover space, <em>vertical centring</em>.</> },
    code: (
      <code>
        <span className="cl-sel">.row</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">display</span>: <span className="cl-v">flex</span>;{'\n'}
        {'  '}<span className="cl-prop">gap</span>: <span className="cl-n">12px</span>;{'\n'}
        {'  '}<span className="cl-prop">align-items</span>: <span className="cl-v">center</span>;{'\n'}
        {'  '}<span className="cl-prop">justify-content</span>: <span className="cl-v">space-between</span>;{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>grid</code> — 二维布局</>, desc: <>2017 同年四家浏览器集体上线, <strong>CSS 史最齐整一次出货</strong>。行列同时声明、命名网格区、自动放置——之前所有"<em>多栏</em>"都是 hack, Grid 之后才有"<strong>布局</strong>"这个词的本意。</> },
    en: { title: <>Grid — two-dimensional layout</>, desc: <>2017 saw all four major browsers ship Grid in the same year — <strong>the most synchronised release in CSS history</strong>. Rows + columns at once, named areas, auto-placement. Every "<em>multi-column</em>" before this was a hack; Grid is when the word "<strong>layout</strong>" finally meant what it says.</> },
    code: (
      <code>
        <span className="cl-sel">.page</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">display</span>: <span className="cl-v">grid</span>;{'\n'}
        {'  '}<span className="cl-prop">grid-template-columns</span>: <span className="cl-n">240px</span> <span className="cl-n">1fr</span>;{'\n'}
        {'  '}<span className="cl-prop">grid-template-rows</span>: <span className="cl-v">auto</span> <span className="cl-n">1fr</span> <span className="cl-v">auto</span>;{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>--var</code> — 自定义属性</>, desc: <>2016 起 Chrome / Firefox / Safari 全支持。<strong>真 runtime 值</strong>: JS 可改、<code>@media</code> 可覆盖、子树可继承——<em>Sass 编译期变量做不到</em>。也是 Houdini 的<strong>类型化基础</strong>。</> },
    en: { title: <>Custom properties (<code>--var</code>)</>, desc: <>Universally supported since 2016. <strong>True runtime values</strong>: mutable from JS, overridable inside <code>@media</code>, inherited through subtrees — <em>Sass compile-time variables cannot do this</em>. They are also the <strong>typed foundation</strong> of Houdini.</> },
    code: (
      <code>
        <span className="cl-sel">:root</span> {'{'} <span className="cl-prop">--accent</span>: <span className="cl-n">#1572B6</span>; {'}'}{'\n\n'}
        <span className="cl-sel">.btn</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">background</span>: <span className="cl-fn">var</span>(<span className="cl-prop">--accent</span>);{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-c">// runtime: el.style.setProperty('--accent', '#fff')</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>:has()</code> — "父选择器"</>, desc: <>20 多年里"<em>选父元素</em>"被认为不可能 (性能噩梦)。<strong>2022-2023 Safari/Chrome/Firefox 全部支持</strong>——浏览器找到了惰性求值的实现。<em>这是 CSS 选择器层面 10 年最大的进步</em>。</> },
    en: { title: <>The parent selector, <code>:has()</code></>, desc: <>For 20+ years, "select the parent" was considered impossible (performance horror). <strong>2022-2023 Safari / Chrome / Firefox all shipped it</strong> — browsers found a lazy-evaluation implementation. <em>The single biggest selector-level advance in a decade</em>.</> },
    code: (
      <code>
        <span className="cl-c">/* row with a checked child */</span>{'\n'}
        <span className="cl-sel">li:has(input:checked)</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">background</span>: <span className="cl-fn">color-mix</span>(<span className="cl-k">in</span> oklch, <span className="cl-v">accent</span> <span className="cl-n">15%</span>, <span className="cl-k">transparent</span>);{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <><code>@container</code> — 容器查询</>, desc: <>响应式的<strong>下一代</strong>: 元素根据"<em>父容器</em>"宽度自适应, 不是全局视口。同一个 Card 组件, 放侧边栏窄、放主区宽, 自己调布局——<strong>组件级响应式</strong>第一次有 native 实现。</> },
    en: { title: <>Container queries (<code>@container</code>)</>, desc: <>The <strong>next generation</strong> of responsive: elements react to <em>their parent container's</em> width, not the viewport. The same Card component is narrow in a sidebar, wide in the main column, and rearranges itself accordingly — the first <strong>component-level responsive</strong> primitive.</> },
    code: (
      <code>
        <span className="cl-sel">.card-wrap</span> {'{'} <span className="cl-prop">container-type</span>: <span className="cl-v">inline-size</span>; {'}'}{'\n\n'}
        <span className="cl-at">@container</span> (<span className="cl-prop">max-width</span>: <span className="cl-n">320px</span>) {'{'}{'\n'}
        {'  '}<span className="cl-sel">.card</span> {'{'} <span className="cl-prop">flex-direction</span>: <span className="cl-v">column</span>; {'}'}{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <><code>oklch()</code> / <code>color-mix()</code></>, desc: <><strong>感知均匀色彩空间</strong>登陆 CSS。RGB / HSL 在亮度感知上是扭曲的, OKLCH (L=亮度, C=色度, H=色相) 给设计系统真正可靠的"调亮 10%"。<em>2024 后被各大设计 token 系统接纳</em>。</> },
    en: { title: <><code>oklch()</code> / <code>color-mix()</code></>, desc: <><strong>Perceptually uniform colour</strong> arrives in CSS. RGB and HSL distort luminance; OKLCH (L = luminance, C = chroma, H = hue) finally gives design systems a reliable "lighten by 10%." <em>Adopted by major design-token systems through 2024-2025</em>.</> },
    code: (
      <code>
        <span className="cl-sel">:root</span> {'{'}{'\n'}
        {'  '}<span className="cl-prop">--blue-500</span>: <span className="cl-fn">oklch</span>(<span className="cl-n">50%</span> <span className="cl-n">0.20</span> <span className="cl-n">250</span>);{'\n'}
        {'  '}<span className="cl-prop">--blue-600</span>: <span className="cl-fn">color-mix</span>(<span className="cl-k">in</span> oklch, <span className="cl-fn">var</span>(<span className="cl-prop">--blue-500</span>), <span className="cl-k">black</span> <span className="cl-n">15%</span>);{'\n'}
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
    icon: '◐',
    zh: { title: <>"声明式"是优点不是缺点</>, desc: <>CSS 不告诉浏览器<em>怎么</em>排版, 只告诉它<em>想要什么</em>——剩下让排版引擎决定。看似不灵活, 实际是 30 年向后兼容、平台 portability、accessibility 的<strong>地基</strong>。<em>用过 Canvas 全手画的人最懂</em>。</> },
    en: { title: <>"Declarative" is the feature, not the flaw</>, desc: <>CSS doesn't tell the browser <em>how</em> to lay things out — only <em>what</em> the result should be, and lets the layout engine decide. It looks inflexible; in reality it's the <strong>foundation</strong> of 30 years of backward compatibility, platform portability and accessibility. <em>Anyone who has hand-drawn layout in Canvas understands</em>.</> },
    code: <><span className="cl-c">/* 浏览器决定怎么算; you say what */</span>{'\n'}<span className="cl-sel">.row</span> {'{'}{'\n'}  <span className="cl-prop">display</span>: <span className="cl-v">flex</span>;{'\n'}  <span className="cl-prop">gap</span>: <span className="cl-n">12px</span>;{'\n'}{'}'}</>,
  },
  {
    icon: '◇',
    zh: { title: <>性能由浏览器优化, 不靠手写</>, desc: <>排版 → 绘制 → 合成<strong>三阶段</strong>都由浏览器 GPU 加速。一句 <code>transform: translateZ(0)</code>就把元素丢到 GPU 层。比起 React/Canvas 手写虚拟 DOM diff, <strong>CSS 是性能杠杆</strong>——前提是<em>用对属性</em> (改 <code>transform</code> 而不是 <code>top</code>)。</> },
    en: { title: <>Performance is the browser's job, not yours</>, desc: <>The <strong>three-stage</strong> pipeline — layout, paint, composite — is all GPU-accelerated by the browser. A single <code>transform: translateZ(0)</code> hoists an element onto its own GPU layer. Compared to hand-rolled React/Canvas diffs, <strong>CSS is a performance lever</strong> — provided you <em>pick the right property</em> (mutate <code>transform</code>, not <code>top</code>).</>},
    code: <><span className="cl-c">/* GPU-composited */</span>{'\n'}<span className="cl-sel">.fly</span> {'{'} <span className="cl-prop">transform</span>: <span className="cl-fn">translateY</span>(<span className="cl-n">-10px</span>); {'}'}{'\n\n'}<span className="cl-c">/* relayout · slow */</span>{'\n'}<span className="cl-sel">.bad</span> {'{'} <span className="cl-prop">top</span>: <span className="cl-n">-10px</span>; {'}'}</>,
  },
  {
    icon: '◈',
    zh: { title: <>无障碍 / 系统偏好直接可用</>, desc: <><code>prefers-reduced-motion</code>、<code>prefers-color-scheme</code>、<code>prefers-contrast</code>——<strong>系统级用户偏好</strong>直接在 CSS 里查。不必读 navigator, 不必加 JS 监听。<em>用户开"减少动画"是真的有人会用</em>, 一行 CSS 就尊重了。</> },
    en: { title: <>Accessibility + OS preferences out of the box</>, desc: <><code>prefers-reduced-motion</code>, <code>prefers-color-scheme</code>, <code>prefers-contrast</code> — <strong>system-level user preferences</strong> are queryable directly from CSS. No navigator probing, no JS listeners. <em>Users really do toggle "reduce motion"</em>, and a single CSS rule respects it.</>},
    code: <><span className="cl-at">@media</span> (<span className="cl-prop">prefers-reduced-motion</span>: <span className="cl-v">reduce</span>) {'{'}{'\n'}  <span className="cl-sel">*</span> {'{'} <span className="cl-prop">animation-duration</span>: <span className="cl-n">0.01ms</span>!<span className="cl-k">important</span>; {'}'}{'\n'}{'}'}</>,
  },
  {
    icon: '◊',
    zh: { title: <>平台追上来了 — 不再需要轮子</>, desc: <>2015-2022 那一堆: <strong>Sass 变量 / styled-components / Modernizr / Animate.css / 各种 polyfill</strong>——<em>2026 年基本都不需要了</em>。原生 <code>--var</code>、<code>@scope</code>、<code>:has</code>、container queries、scroll animations 全都到位。<strong>"the platform caught up"</strong>是过去 3 年前端最干净的一句话。</>},
    en: { title: <>The platform caught up — fewer wheels to reinvent</>, desc: <>The 2015-2022 stack — <strong>Sass for variables, styled-components, Modernizr, Animate.css, polyfill soups</strong> — is <em>largely unneeded in 2026</em>. Native <code>--var</code>, <code>@scope</code>, <code>:has</code>, container queries, scroll animations have all landed. <strong>"The platform caught up"</strong> is the cleanest summary of the last three years in front-end.</>},
    code: <><span className="cl-c">/* 2018 — needed Sass */</span>{'\n'}<span className="cl-c">/* 2026 — native */</span>{'\n'}<span className="cl-sel">.card</span> {'{'}{'\n'}  <span className="cl-prop">--pad</span>: <span className="cl-n">16px</span>;{'\n'}  <span className="cl-prop">padding</span>: <span className="cl-fn">var</span>(<span className="cl-prop">--pad</span>);{'\n\n'}  <span className="cl-sel">& h2</span> {'{'} <span className="cl-prop">color</span>: <span className="cl-v">white</span>; {'}'}{'\n'}{'}'}</>,
  },
  {
    icon: '◉',
    zh: { title: <>30 年向后兼容</>, desc: <>1996 写的 CSS 1 代码<strong>今天仍能跑</strong>——浏览器不抛弃任何老规范。<em>这是 Web 平台的"超能力"</em>: 你的旧代码不需要维护就一直能用, 新代码 progressive enhancement 叠加。比任何"现代"语言更稳。</>},
    en: { title: <>30 years of backward compatibility</>, desc: <>CSS 1 code written in 1996 <strong>still runs today</strong> — no browser drops old specs. <em>This is the Web platform's superpower</em>: old code keeps working without maintenance, new features stack on through progressive enhancement. More stable than any "modern" language.</>},
    code: <><span className="cl-c">/* CSS 1 (1996) · still valid */</span>{'\n'}<span className="cl-sel">body</span> {'{'}{'\n'}  <span className="cl-prop">font-family</span>: <span className="cl-v">serif</span>;{'\n'}  <span className="cl-prop">color</span>: <span className="cl-n">#333</span>;{'\n'}{'}'}</>,
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
    href: 'https://www.w3.org/Style/CSS/', highlight: true,
    zhName: 'W3C CSSWG', enName: 'W3C CSSWG',
    zhNote: 'CSS 工作组 · 1997 起', enNote: 'CSS Working Group · since 1997',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#005A9C"/><text x="50" y="42" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="sans-serif">W3C</text><text x="50" y="68" textAnchor="middle" fill="#FFC857" fontSize="14" fontWeight="600" fontFamily="monospace">CSSWG</text></svg>,
  },
  {
    href: 'https://developer.mozilla.org/en-US/docs/Web/CSS', highlight: true,
    zhName: 'MDN', enName: 'MDN',
    zhNote: 'Mozilla 文档 · CSS 参考', enNote: 'Mozilla Docs · CSS reference',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M16 72 L16 28 L30 28 L40 50 L50 28 L60 50 L70 28 L84 28 L84 72 L70 72 L70 46 L60 70 L50 46 L40 70 L30 46 L30 72 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://web.dev/css/', highlight: true,
    zhName: 'web.dev', enName: 'web.dev',
    zhNote: 'Google · 现代 CSS 教学', enNote: 'Google · modern CSS curriculum',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A73E8"/><circle cx="50" cy="50" r="20" fill="none" stroke="#fff" strokeWidth="4"/><line x1="30" y1="50" x2="70" y2="50" stroke="#fff" strokeWidth="4"/><path d="M50 30 Q60 50 50 70 Q40 50 50 30" stroke="#fff" strokeWidth="3" fill="none"/></svg>,
  },
  {
    href: 'https://tailwindcss.com', highlight: true,
    zhName: 'Tailwind', enName: 'Tailwind',
    zhNote: '实用优先 · 2017 起', enNote: 'Utility-first · since 2017',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A1A2A"/><path d="M28 56 C30 44 38 38 50 38 C56 38 60 42 64 46 C66 48 70 50 74 50 C72 62 64 68 52 68 C46 68 42 64 38 60 C36 58 32 56 28 56 Z" fill="#38BDF8"/><path d="M16 76 C18 64 26 58 38 58 C44 58 48 62 52 66 C54 68 58 70 62 70 C60 82 52 88 40 88 C34 88 30 84 26 80 C24 78 20 76 16 76 Z" fill="#38BDF8" opacity=".75"/></svg>,
  },
  {
    href: 'https://sass-lang.com',
    zhName: 'Sass', enName: 'Sass',
    zhNote: '预处理器 · 2007', enNote: 'Preprocessor · 2007',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#CD6799"/><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="38" fontWeight="700" fontFamily="serif" fontStyle="italic">Sass</text></svg>,
  },
  {
    href: 'https://lesscss.org',
    zhName: 'Less', enName: 'Less',
    zhNote: '预处理器 · 2009', enNote: 'Preprocessor · 2009',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1D365D"/><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="700" fontFamily="sans-serif">Less</text></svg>,
  },
  {
    href: 'https://postcss.org',
    zhName: 'PostCSS', enName: 'PostCSS',
    zhNote: 'CSS AST · plugin 生态', enNote: 'CSS AST · plugin ecosystem',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#DD3A0A"/><path d="M50 18 L78 38 L68 70 L32 70 L22 38 Z" fill="none" stroke="#fff" strokeWidth="4"/><circle cx="50" cy="46" r="6" fill="#fff"/></svg>,
  },
  {
    href: 'https://styled-components.com',
    zhName: 'styled-components', enName: 'styled-components',
    zhNote: 'CSS-in-JS · 2016', enNote: 'CSS-in-JS · 2016',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F1115"/><polygon points="20,30 80,30 70,80 30,80" fill="none" stroke="#DB7093" strokeWidth="4"/><polygon points="35,42 65,42 60,68 40,68" fill="#DB7093"/></svg>,
  },
  {
    href: 'https://drafts.css-houdini.org',
    zhName: 'Houdini', enName: 'Houdini',
    zhNote: 'CSS 底层 API', enNote: 'Low-level CSS APIs',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1B1F2A"/><circle cx="50" cy="44" r="14" fill="none" stroke="#FFB347" strokeWidth="3"/><rect x="36" y="58" width="28" height="22" rx="3" fill="none" stroke="#FFB347" strokeWidth="3"/><line x1="44" y1="44" x2="44" y2="48" stroke="#FFB347" strokeWidth="2"/><line x1="56" y1="44" x2="56" y2="48" stroke="#FFB347" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://csszengarden.com',
    zhName: 'Zen Garden', enName: 'Zen Garden',
    zhNote: 'Dave Shea · 2003 经典', enNote: 'Dave Shea · 2003 classic',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#3D5A40"/><circle cx="50" cy="64" r="12" fill="#FFB347"/><path d="M30 64 Q50 30 70 64" fill="none" stroke="#fff" strokeWidth="3"/><line x1="20" y1="80" x2="80" y2="80" stroke="#fff" strokeWidth="2"/></svg>,
  },
  {
    href: 'https://csswizardry.com',
    zhName: 'CSS Wizardry', enName: 'CSS Wizardry',
    zhNote: 'Harry Roberts · 性能博客', enNote: 'Harry Roberts · perf blog',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0B0B0F"/><path d="M30 28 L70 28 L60 56 L70 72 L50 88 L30 72 L40 56 Z" fill="none" stroke="#33A9DC" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://every-layout.dev',
    zhName: 'Every Layout', enName: 'Every Layout',
    zhNote: 'Andy Bell · 内禀布局', enNote: 'Andy Bell · intrinsic layout',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FFCC00"/><rect x="20" y="20" width="60" height="20" rx="3" fill="#0B0B0F"/><rect x="20" y="48" width="28" height="32" rx="3" fill="#0B0B0F"/><rect x="52" y="48" width="28" height="32" rx="3" fill="#0B0B0F"/></svg>,
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
      title: <>Scroll-driven animations + View Transitions — SPA 框架的功能被原生收回</>,
      body: (<>
        <p>过去 10 年, 元素入场动画、滚动驱动视差、跨页面 morph 全靠 <strong>React / Vue / Framer Motion + IntersectionObserver + RAF</strong>。<strong>2024-2026</strong>: <code>animation-timeline</code> + <code>view-transition</code> 原生实现, <strong>一行 CSS 完成的事情, 比 JS 路线快 10×, 不闪烁, 不掉帧</strong>。Safari 还在跟, 但<strong>方向已经定了</strong>。</p>
        <p>意义: 这是 CSS 第一次<strong>真正反向收回</strong> SPA 框架做的事情——之前是 <code>:has()</code> 抢 JS query 的活, 现在是动画。<em>"the platform caught up" 不是口号, 是观察记录</em>。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="JS + IntersectionObserver (2018)" en="JS + IntersectionObserver (2018)" /></span><span className="bar-val">~5%</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="原生 animation-timeline (2026)" en="Native animation-timeline (2026)" /></span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Scroll-driven animations + view transitions — SPA-framework jobs reclaimed by the platform</>,
      body: (<>
        <p>For a decade, entry animations, scroll-driven parallax, and cross-page morphs all required <strong>React / Vue / Framer Motion + IntersectionObserver + RAF</strong>. <strong>2024-2026</strong>: <code>animation-timeline</code> + <code>view-transition</code> native — <strong>one CSS rule does the same job 10× faster, with no flicker, no jank</strong>. Safari is still catching up but <strong>the direction is settled</strong>.</p>
        <p>The bigger story: CSS is genuinely <strong>reclaiming territory</strong> from SPA frameworks for the first time. <code>:has()</code> took back DOM querying; now animation. <em>"The platform caught up" isn't a slogan, it's an observation</em>.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">JS + IntersectionObserver (2018)</span><span className="bar-val">~5%</span></div>
          <div className="bar bar-new"><span className="bar-label">Native animation-timeline (2026)</span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'ANCHOR',
    zh: { title: <>Anchor Positioning — tooltip / popover 终于不靠 JS</>, body: <><p>30 年的痛点: 想让 tooltip 跟着按钮、popover 自动避开视口边界——必须写 <code>getBoundingClientRect()</code> + <code>resize</code> 监听。<strong>Chrome 125 (2024-12) 上线 <code>anchor-name</code></strong>, Firefox/Safari 跟进中。<em>这是 CSS 用 30 年才补上的一块短板</em>。</p></> },
    en: { title: <>Anchor positioning — tooltips and popovers without JS</>, body: <><p>A 30-year pain point: making a tooltip follow a button, or having a popover dodge viewport edges, used to require <code>getBoundingClientRect()</code> + <code>resize</code> listeners. <strong>Chrome 125 (Dec 2024) ships <code>anchor-name</code></strong>, Firefox and Safari following. <em>A long-missing piece finally arriving</em>.</p></> },
  },
  {
    tag: 'HOUDINI',
    zh: { title: <>Houdini Paint API — CSS 的"插件"</>, body: <><p>过去 CSS 引擎对开发者是个<strong>黑盒</strong>。Houdini Paint / Layout API 把 <code>paint(myThing)</code> 暴露给 JS——<strong>用 JS 写 CSS 的画笔</strong>。canvas 风的图案、自定义 mask、过程纹理都能进 CSS。<em>规范完整, 浏览器实现进度不一</em>。</p></> },
    en: { title: <>Houdini Paint API — CSS plugins</>, body: <><p>The CSS engine used to be a <strong>black box</strong> to developers. The Houdini Paint and Layout APIs expose <code>paint(myThing)</code> to JS — <strong>JS becomes a brush for CSS</strong>. Canvas-style patterns, custom masks, procedural textures all become CSS. <em>The spec is full; browser implementations vary</em>.</p></> },
  },
  {
    tag: 'TYPED-OM',
    zh: { title: <>Typed OM + custom property types</>, body: <><p>CSS 一直是<strong>字符串</strong>: JS 读 <code>el.style.width</code> 得到 <code>"320px"</code>, 自己再切。<strong>Typed OM</strong> 把它变成 <code>CSSUnitValue(320, "px")</code>——可加可减可比较。配合 <code>@property</code> 给自定义属性<strong>类型 + 默认值 + 是否继承</strong>, CSS 第一次有了"<em>类型系统</em>"。</p></> },
    en: { title: <>Typed OM + typed custom properties</>, body: <><p>CSS has always been a <strong>string soup</strong>: JS reads <code>el.style.width</code> and gets <code>"320px"</code>, splits it by hand. The <strong>Typed OM</strong> makes it <code>CSSUnitValue(320, "px")</code> — addable, subtractable, comparable. Combined with <code>@property</code> giving custom properties <strong>types, defaults, and inheritance flags</strong>, CSS gains its first real "<em>type system</em>".</p></> },
  },
];

export default function CssIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);
  const [baTab, setBaTab] = useState<'clearfix' | 'cols' | 'cq' | 'centre'>('clearfix');

  useDocumentTitle(
    'CSS : 30 年声明式样式语言 — 1994 CERN 提案到 2026 平台追上来',
    "CSS : 30 years of declarative styling — from CERN 1994 to 'the platform caught up'"
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .ai-stat, .ai-tool, .quote-block, .demo, .turing-block, .spec-grid, .beforeafter'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.demo').forEach((el, i) => { el.style.transitionDelay = `${(i % 2) * 80}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--css-bright)' : '';
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

  /* Before/After content */
  const BA_CONTENT: Record<typeof baTab, {
    label: ReactNode;
    old: { name: string; era: string; code: ReactNode };
    nu:  { name: string; era: string; code: ReactNode };
  }> = {
    clearfix: {
      label: <L zh={<>清除浮动 — <code>clearfix</code> → <code>flex</code></>} en={<>Clearing floats — <code>clearfix</code> → <code>flex</code></>} />,
      old: { name: 'clearfix.css', era: '2007', code: (
        <code>
          <span className="cl-sel">.row</span> {'{'} <span className="cl-prop">overflow</span>: <span className="cl-v">hidden</span>; {'}'}{'\n'}
          <span className="cl-sel">.col</span> {'{'} <span className="cl-prop">float</span>: <span className="cl-v">left</span>; {'}'}{'\n'}
          <span className="cl-sel">.clearfix::after</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">content</span>: <span className="cl-s">""</span>;{'\n'}
          {'  '}<span className="cl-prop">display</span>: <span className="cl-v">table</span>;{'\n'}
          {'  '}<span className="cl-prop">clear</span>: <span className="cl-v">both</span>;{'\n'}
          {'}'}{'\n\n'}
          <span className="cl-c">/* 真实工程里还套 zoom:1 给 IE6 */</span>
        </code>
      )},
      nu: { name: 'flex.css', era: '2015+', code: (
        <code>
          <span className="cl-sel">.row</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">display</span>: <span className="cl-v">flex</span>;{'\n'}
          {'  '}<span className="cl-prop">gap</span>: <span className="cl-n">12px</span>;{'\n'}
          {'}'}{'\n\n'}
          <span className="cl-c">/* done. */</span>
        </code>
      )},
    },
    cols: {
      label: <L zh={<>多栏布局 — <code>float</code> 假分栏 → <code>grid</code></>} en={<>Multi-column — faux-columns → <code>grid</code></>} />,
      old: { name: 'faux-columns.css', era: '2004', code: (
        <code>
          <span className="cl-c">/* faux columns: background image gives bg color */</span>{'\n'}
          <span className="cl-sel">.container</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">background</span>: <span className="cl-fn">url</span>(<span className="cl-s">sidebar-bg.png</span>) <span className="cl-v">repeat-y</span>;{'\n'}
          {'}'}{'\n'}
          <span className="cl-sel">.aside</span> {'{'} <span className="cl-prop">float</span>: <span className="cl-v">left</span>; <span className="cl-prop">width</span>: <span className="cl-n">240px</span>; {'}'}{'\n'}
          <span className="cl-sel">.main</span>  {'{'} <span className="cl-prop">margin-left</span>: <span className="cl-n">240px</span>; {'}'}{'\n\n'}
          <span className="cl-c">/* and pray a A List Apart article fixes the bugs */</span>
        </code>
      )},
      nu: { name: 'grid.css', era: '2017+', code: (
        <code>
          <span className="cl-sel">.container</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">display</span>: <span className="cl-v">grid</span>;{'\n'}
          {'  '}<span className="cl-prop">grid-template-columns</span>: <span className="cl-n">240px</span> <span className="cl-n">1fr</span>;{'\n'}
          {'}'}
        </code>
      )},
    },
    cq: {
      label: <L zh={<>组件级响应式 — JS 测尺寸 → <code>@container</code></>} en={<>Component-level responsive — JS measure → <code>@container</code></>} />,
      old: { name: 'resize.js', era: '2014', code: (
        <code>
          <span className="cl-c">// listen to window AND ResizeObserver</span>{'\n'}
          <span className="cl-k">new</span> <span className="cl-fn">ResizeObserver</span>((entries) =&gt; {'{'}{'\n'}
          {'  '}<span className="cl-k">for</span> (<span className="cl-k">const</span> e <span className="cl-k">of</span> entries) {'{'}{'\n'}
          {'    '}<span className="cl-k">if</span> (e.contentRect.width &lt; <span className="cl-n">320</span>) {'{'}{'\n'}
          {'      '}e.target.<span className="cl-fn">classList</span>.<span className="cl-fn">add</span>(<span className="cl-s">'narrow'</span>);{'\n'}
          {'    '}{'}'}{'\n'}
          {'  '}{'}'}{'\n'}
          {'}'}).<span className="cl-fn">observe</span>(card);
        </code>
      )},
      nu: { name: 'container.css', era: '2023+', code: (
        <code>
          <span className="cl-sel">.card-wrap</span> {'{'} <span className="cl-prop">container-type</span>: <span className="cl-v">inline-size</span>; {'}'}{'\n\n'}
          <span className="cl-at">@container</span> (<span className="cl-prop">max-width</span>: <span className="cl-n">320px</span>) {'{'}{'\n'}
          {'  '}<span className="cl-sel">.card</span> {'{'} <span className="cl-prop">flex-direction</span>: <span className="cl-v">column</span>; {'}'}{'\n'}
          {'}'}
        </code>
      )},
    },
    centre: {
      label: <L zh={<>垂直居中 — 表格 / 负 margin → <code>place-items</code></>} en={<>Vertical centring — tables / negative-margin → <code>place-items</code></>} />,
      old: { name: 'center-2008.css', era: '2008', code: (
        <code>
          <span className="cl-c">/* center an unknown-size element */</span>{'\n'}
          <span className="cl-sel">.box</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">position</span>: <span className="cl-v">absolute</span>;{'\n'}
          {'  '}<span className="cl-prop">top</span>: <span className="cl-n">50%</span>; <span className="cl-prop">left</span>: <span className="cl-n">50%</span>;{'\n'}
          {'  '}<span className="cl-prop">width</span>: <span className="cl-n">240px</span>; <span className="cl-prop">height</span>: <span className="cl-n">120px</span>;{'\n'}
          {'  '}<span className="cl-prop">margin-top</span>: <span className="cl-n">-60px</span>;{'\n'}
          {'  '}<span className="cl-prop">margin-left</span>: <span className="cl-n">-120px</span>;{'\n'}
          {'}'}{'\n\n'}
          <span className="cl-c">/* only works if you know the size. */</span>
        </code>
      )},
      nu: { name: 'center-modern.css', era: '2017+', code: (
        <code>
          <span className="cl-sel">.parent</span> {'{'}{'\n'}
          {'  '}<span className="cl-prop">display</span>: <span className="cl-v">grid</span>;{'\n'}
          {'  '}<span className="cl-prop">place-items</span>: <span className="cl-v">center</span>;{'\n'}
          {'}'}{'\n\n'}
          <span className="cl-c">/* any size · any content · two lines */</span>
        </code>
      )},
    },
  };
  const baKeys: (keyof typeof BA_CONTENT)[] = ['clearfix', 'cols', 'cq', 'centre'];
  const baLabels: Record<typeof baTab, ReactNode> = {
    clearfix: <L zh="清除浮动" en="Clearfix" />,
    cols: <L zh="多栏布局" en="Multi-col" />,
    cq: <L zh="组件响应式" en="Component RWD" />,
    centre: <L zh="垂直居中" en="Centring" />,
  };

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="css-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="css-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#33A9DC" />
                  <stop offset="100%" stopColor="#0B4A78" />
                </linearGradient>
              </defs>
              <path d="M40 28 L216 28 L200 220 L128 240 L56 220 Z" fill="url(#css-nav)" />
              <text x="128" y="160" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="118" fontWeight="700" fill="#FFFFFF">3</text>
            </svg>
            <span>CSS</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#demos"><L zh="实时演示" en="Live Demos" /></a></li>
            <li><a href="#beforeafter"><L zh="2010 vs 2026" en="Before / After" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#turing"><L zh="图灵完备" en="Turing" /></a></li>
            <li><a href="#projects"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs JS" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1994 CERN proposal · CSS 1 1996 · CSS Grid 2017 · :has() 2023 · OKLCH 2024 · view transitions 2024</div>
            <h1 className="hero-title">
              <span className="hero-name">CSS</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">DeclarativeStyle</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>CSS 不是通用编程语言</strong>——它是 1994 年 Håkon Wium Lie 从 CERN 提出的<strong>声明式样式语言</strong>。30 年里它从 IE6 黑暗时代爬出来, 用 Flexbox / Grid / Custom Properties / <code>:has()</code> / 容器查询接连补齐了 Web 的层叠样式底座。2026 年它已经把 SPA 框架做过的不少事情<strong>原生收回</strong>——"the platform caught up"。<em>顺带一提它图灵完备</em>。</>}
                en={<><strong>CSS is not a general-purpose programming language</strong> — it is the <strong>declarative styling language</strong> Håkon Wium Lie proposed from CERN in 1994. In 30 years it climbed out of the IE6 dark age and, through Flexbox / Grid / Custom Properties / <code>:has()</code> / container queries, became the layered foundation of the Web's look. In 2026 it has natively <strong>reclaimed</strong> jobs SPA frameworks used to own — "the platform caught up." <em>It is also, incidentally, Turing-complete</em>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1994<small></small></span>
                <span className="stat-label"><L zh={<>10 月 10 日 CERN 提案<br /><em>Håkon Wium Lie</em></>} en={<>Oct 10 · CERN proposal<br /><em>Håkon Wium Lie</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">1996<small></small></span>
                <span className="stat-label"><L zh={<>CSS 1 W3C 推荐<br /><em>正式标准化</em></>} en={<>CSS 1 W3C REC<br /><em>first standard</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2017<small></small></span>
                <span className="stat-label"><L zh={<>CSS Grid 全浏览器<br /><em>"布局终于对了"</em></>} en={<>CSS Grid everywhere<br /><em>"layout finally worked"</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">30<small> yrs</small></span>
                <span className="stat-label"><L zh={<>仍在演进<br /><em>:has · @container · OKLCH</em></>} en={<>Still evolving<br /><em>:has · @container · OKLCH</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">{CSS_LOGO_SVG}</div>
            <div className="hero-floats">
              <span className="float f1">display: grid;</span>
              <span className="float f2">--accent</span>
              <span className="float f3">{':has(input:checked)'}</span>
              <span className="float f4">@container</span>
              <span className="float f5">oklch()</span>
              <span className="float f6">{'transform: translate3d'}</span>
              <span className="float f7">view-transition</span>
              <span className="float f8">{'animation-timeline: scroll()'}</span>
              <span className="float f9">flex: 1 1 0;</span>
              <span className="float f10">@scope</span>
              <span className="float f11">place-items: center</span>
              <span className="float f12">{'min(100%, 720px)'}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>CSS</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>CSS = <strong>Cascading Style Sheets</strong>, "层叠样式表"。它是 <strong>声明式 (declarative)</strong>: 你只描述<em>"想看到什么"</em>, 浏览器决定<em>怎么排</em>。它<strong>不是图灵机意义上的通用编程语言</strong>——但 (<a href="#turing">见 §07</a>) 它意外的<em>图灵完备</em>。</>}
                  en={<>CSS = <strong>Cascading Style Sheets</strong>. It is <strong>declarative</strong>: you describe <em>what you want to see</em>, the browser decides <em>how to arrange it</em>. It is <strong>not a general-purpose programming language</strong> in the Turing-machine sense — yet, surprisingly (<a href="#turing">see §07</a>), it is <em>Turing-complete</em>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="声明式, 不命令式" en="Declarative, not imperative" />, tag: 'paradigm', p: <L zh={<>不写循环、不写赋值。你说 <code>display: flex</code>, 浏览器自己排——<em>你描述目的, 不写过程</em>。这跟 SQL / HTML / Make 同一家族, 跟 JS / Python 完全不同。</>} en={<>No loops, no assignments. You say <code>display: flex</code> and the browser arranges things — <em>you describe the goal, not the steps</em>. Same family as SQL / HTML / Make; nothing like JS / Python.</>} /> },
                { h: <L zh="层叠 (cascading)" en="Cascading" />, tag: 'core', p: <L zh={<>同一属性多个规则都中, 用 <strong>(行内, ID, 类, 类型)</strong> 四元组比大小定胜负。<em>这一点是 CSS 名字的来源, 也是新手最常崩溃的地方</em>。</>} en={<>When multiple rules hit the same property, an <strong>(inline, ID, class, type)</strong> tuple decides which wins. <em>This is what the "C" stands for — and the most common stumbling block for newcomers</em>.</>} /> },
                { h: <L zh="作用于 DOM 树" en="Operates on the DOM" />, tag: 'scope', p: <L zh={<>CSS 只能<strong>对存在的元素</strong>说话。HTML 给结构, CSS 给外观, JS 给行为——<em>"内容 / 样式 / 行为"三分</em>是 Web 30 年的根。</>} en={<>CSS only speaks to elements that <strong>already exist</strong>. HTML provides structure, CSS provides look, JS provides behaviour — the <em>content / style / behaviour separation</em> is the Web's 30-year foundation.</>} /> },
                { h: <L zh="模块化演进" en="Modular evolution" />, tag: 'spec', p: <L zh={<>2005 起 W3C 放弃"单本 CSS 3 规范", 改成 <strong>Selectors L4 / Color L5 / Containment L3</strong> 等独立模块。<em>"CSS 3"是个标签, 不是版本</em>——这也是它能持续演进 20 年的原因。</>} en={<>Since 2005 the W3C abandoned a single CSS 3 spec, splitting it into <strong>Selectors L4, Color L5, Containment L3</strong> and friends. <em>"CSS 3" is a label, not a version</em> — which is why the language keeps moving 20 years on.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">layout.imperative.js</span><span className="lang-tag js">Imperative (JS)</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// 命令式: 你写每一步" en="// imperative: you write each step" /></span>{'\n'}
                  <span className="cl-k">const</span> row = document.<span className="cl-fn">querySelector</span>(<span className="cl-s">'.row'</span>);{'\n'}
                  <span className="cl-k">const</span> children = row.<span className="cl-fn">children</span>;{'\n'}
                  <span className="cl-k">const</span> width = row.<span className="cl-fn">offsetWidth</span>;{'\n'}
                  <span className="cl-k">const</span> per = width / children.length;{'\n'}
                  <span className="cl-k">for</span> (<span className="cl-k">let</span> i = <span className="cl-n">0</span>; i &lt; children.length; i++) {'{'}{'\n'}
                  {'  '}children[i].style.left = (i * per) + <span className="cl-s">'px'</span>;{'\n'}
                  {'  '}children[i].style.width = per + <span className="cl-s">'px'</span>;{'\n'}
                  {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="// resize? 自己再写一遍" en="// resize? do it all again" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">layout.css</span><span className="lang-tag ts">Declarative (CSS)</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="/* 声明式: 你说想要什么 */" en="/* declarative: say what you want */" /></span>{'\n'}
                  <span className="cl-sel">.row</span> {'{'}{'\n'}
                  {'  '}<span className="cl-prop">display</span>: <span className="cl-v">flex</span>;{'\n'}
                  {'  '}<span className="cl-prop">gap</span>: <span className="cl-n">12px</span>;{'\n'}
                  {'}'}{'\n'}
                  <span className="cl-sel">.row &gt; *</span> {'{'} <span className="cl-prop">flex</span>: <span className="cl-n">1</span>; {'}'}{'\n\n'}
                  <span className="cl-c"><L zh="/* resize 自适应, accessibility 自动" en="/* responsive · accessible · GPU-composited" /></span>{'\n'}
                  <span className="cl-c"><L zh="   GPU 合成 · 浏览器全包 */" en="   the browser handles it all */" /></span>
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
                zh={<>从 1994 年 Håkon Wium Lie 那封 CERN 邮件, 到 IE 6 的黑暗 10 年, 到 2017 春天四家浏览器同时给出 Grid, 到 2023 年容器查询 / <code>:has()</code> / 嵌套三连发——CSS 30 年是一条<strong>慢但不退</strong>的曲线。</>}
                en={<>From Håkon Wium Lie's 1994 CERN email, through the IE 6 dark decade, to the spring of 2017 when four browsers shipped Grid in the same season, to the 2023 trio of container queries / <code>:has()</code> / nesting — CSS's 30 years are a <strong>slow but unbroken</strong> curve.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: CssAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 CSS 的<strong>核心机制</strong>: 层叠/特异性、盒模型、Flex、Grid、自定义属性、<code>:has()</code>、容器查询、OKLCH 色彩。第 9 张是关于"<em>CSS 是不是一门语言</em>"的小卡片。</>}
                en={<>The eight cards below are CSS's <strong>core machinery</strong>: cascade/specificity, box model, flexbox, grid, custom properties, <code>:has()</code>, container queries, OKLCH colour. The ninth riffs on "<em>is CSS even a language?</em>"</>}
              /></p>
            </header>

            <div className="ts-grid">
              {CSS_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>"CSS 算编程语言吗?"</>} en={<>"Is CSS a programming language?"</>} /></h3>
                <p><L
                  zh={<>这是 Stack Overflow / Reddit 每年都吵一遍的话题。<strong>严格意义上 — 它是声明式 DSL, 不是通用编程语言</strong> (没有 IO、没有可变状态、没有抽象出 Turing 机器层)。但 (<a href="#turing">见 §07</a>) HTML+CSS 能编出 <strong>Rule 110</strong>——所以理论意义上它<em>图灵完备</em>。<strong>结论: 它是一门<em>语言</em>, 但不是<em>通用</em>编程语言</strong>。</>}
                  en={<>The Stack Overflow / Reddit perennial. <strong>Strictly — it's a declarative DSL, not a general-purpose programming language</strong> (no I/O, no mutable state, no built-in abstraction over a Turing machine). But (<a href="#turing">see §07</a>) HTML + CSS can encode <strong>Rule 110</strong>, so it is <em>Turing-complete</em> in the theoretical sense. <strong>Verdict: yes a language, no not a <em>general-purpose</em> one</strong>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>CSS 不是糟糕的编程语言, 它是优秀的样式语言。把它当编程语言批是搞错了类别。</>}
                  en={<>CSS isn't a bad programming language; it's a great styling language. Critiquing it as if it were a programming language is a category error.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Live Demos */}
          <section className="section" id="demos">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="实时演示" en="Live Demos" /> <code>: ItsActuallyCss</code></h2>
              <p className="sec-desc"><L
                zh={<>这一页的<strong>这一节是真的 CSS 在跑</strong>——不是截图, 不是代码块。打开 DevTools 改改 CSS, 都会实时变。<em>这一节的存在本身是论点: CSS 自己就能讲清自己</em>。</>}
                en={<>This section is <strong>actually running CSS</strong> — not screenshots, not code blocks. Open DevTools and tweak — it all updates live. <em>The existence of this section is itself the argument: CSS can demonstrate itself</em>.</>}
              /></p>
            </header>

            <div className="demo-grid">
              {/* Flexbox demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">flexbox.css</span><span className="lang-tag ts">flex</span></div>
                <div className="demo-stage">
                  <div className="demo-flex">
                    <div>flex: 1</div>
                    <div>flex: 2</div>
                    <div>flex: 1</div>
                  </div>
                </div>
                <pre className="demo-code">
                  <span className="cl-sel">.row</span> {'{'} <span className="cl-prop">display</span>: <span className="cl-v">flex</span>; <span className="cl-prop">gap</span>: <span className="cl-n">10px</span>; {'}'}{'\n'}
                  <span className="cl-sel">.row {'>'} *</span> {'{'} <span className="cl-prop">flex</span>: <span className="cl-n">1</span>; {'}'}{'\n'}
                  <span className="cl-sel">.row {'>'} *:nth-child(2)</span> {'{'} <span className="cl-prop">flex</span>: <span className="cl-n">2</span>; {'}'}
                </pre>
                <div className="demo-caption"><L zh={<><strong>Flex</strong>: 中间的格子拿 2 份, 两端各 1 份, 总宽度自适应父容器。<em>2012 规范, 2015 全浏览器, 至今最常用</em>。</>} en={<><strong>Flex</strong>: middle takes 2 parts, the sides 1 each, total adapts to the parent. <em>Spec 2012, universal 2015, still the daily-driver</em>.</>} /></div>
              </div>

              {/* Grid demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">grid.css</span><span className="lang-tag ts">grid</span></div>
                <div className="demo-stage">
                  <div className="demo-grid-stage">
                    <div>header</div>
                    <div>a</div>
                    <div>b</div>
                    <div>c</div>
                    <div>d</div>
                  </div>
                </div>
                <pre className="demo-code">
                  <span className="cl-sel">.page</span> {'{'}{'\n'}
                  {'  '}<span className="cl-prop">display</span>: <span className="cl-v">grid</span>;{'\n'}
                  {'  '}<span className="cl-prop">grid-template-columns</span>: <span className="cl-n">1fr</span> <span className="cl-n">2fr</span> <span className="cl-n">1fr</span>;{'\n'}
                  {'  '}<span className="cl-prop">grid-template-rows</span>: <span className="cl-n">60px</span> <span className="cl-n">60px</span>;{'\n'}
                  {'}'}{'\n'}
                  <span className="cl-sel">.page {'>'} :first-child</span> {'{'} <span className="cl-prop">grid-column</span>: <span className="cl-k">span</span> <span className="cl-n">3</span>; {'}'}
                </pre>
                <div className="demo-caption"><L zh={<><strong>Grid</strong>: 真正的二维布局, 行列同时声明。第一格 <code>span 3</code> 跨满三列。<em>2017 同年四家浏览器集体出货</em>。</>} en={<><strong>Grid</strong>: real 2-D layout — rows and columns at once. The first cell <code>span 3</code> covers the row. <em>All four browsers shipped this in the same 2017 spring</em>.</>} /></div>
              </div>

              {/* Container Query demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">container.css</span><span className="lang-tag ts">@container</span></div>
                <div className="demo-stage" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="demo-cq-wrap">
                    <div className="demo-cq">
                      <div className="demo-cq-img">A</div>
                      <div>
                        <div style={{ fontWeight: 600 }}><L zh="组件级响应式" en="Component-level responsive" /></div>
                        <div style={{ opacity: .85, fontSize: 11 }}><L zh="拖右边缘 → 窄到 320 以下变堆叠" en="Drag the right edge → narrows below 320 = stacks" /></div>
                      </div>
                    </div>
                  </div>
                  <div className="demo-cq-resize-hint"><L zh="↔ 拖右下角试试" en="↔ drag the bottom-right corner" /></div>
                </div>
                <pre className="demo-code">
                  <span className="cl-sel">.wrap</span> {'{'} <span className="cl-prop">container-type</span>: <span className="cl-v">inline-size</span>; {'}'}{'\n\n'}
                  <span className="cl-at">@container</span> (<span className="cl-prop">max-width</span>: <span className="cl-n">320px</span>) {'{'}{'\n'}
                  {'  '}<span className="cl-sel">.card</span> {'{'} <span className="cl-prop">flex-direction</span>: <span className="cl-v">column</span>; {'}'}{'\n'}
                  {'}'}
                </pre>
                <div className="demo-caption"><L zh={<><strong>容器查询</strong>: 不看视口, 看<em>父容器</em>宽度。拖一下右下角的 resize 把手, 看 demo 自己变。<em>2023 年浏览器全到位, 等了 10 年的功能</em>。</>} en={<><strong>Container queries</strong>: not viewport, the <em>parent container</em>'s width. Drag the bottom-right resize handle and watch it adapt. <em>Wide support arrived in 2023 — a 10-year wait</em>.</>} /></div>
              </div>

              {/* :has() demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">has.css</span><span className="lang-tag ts">:has()</span></div>
                <div className="demo-stage">
                  <div className="demo-has-list">
                    <label><input type="checkbox" className="demo-has-list-input" /> <L zh="选我 — 整行会变蓝" en="Tick me — the whole row turns blue" /></label>
                    <label><input type="checkbox" className="demo-has-list-input" /> <L zh="也可以选我" en="Or me" /></label>
                    <label><input type="checkbox" className="demo-has-list-input" /> <L zh="想选几个就选几个" en="As many as you like" /></label>
                  </div>
                </div>
                <pre className="demo-code">
                  <span className="cl-sel">label:has(input:checked)</span> {'{'}{'\n'}
                  {'  '}<span className="cl-prop">background</span>: <span className="cl-fn">linear-gradient</span>(<span className="cl-n">135deg</span>, <span className="cl-v">var</span>(<span className="cl-prop">--css</span>), <span className="cl-v">var</span>(<span className="cl-prop">--css-deep</span>));{'\n'}
                  {'  '}<span className="cl-prop">color</span>: <span className="cl-v">white</span>;{'\n'}
                  {'}'}
                </pre>
                <div className="demo-caption"><L zh={<><strong><code>:has()</code></strong>: <em>"父选择器"</em>——一直被认为不可能, 2022-2023 落地。这个 demo 没有一行 JS。<em>Click 一下 checkbox, 整个 <code>&lt;label&gt;</code> 变蓝</em>。</>} en={<><strong><code>:has()</code></strong>: <em>the "parent selector"</em> — long thought impossible, shipped 2022-2023. No JavaScript in this demo. <em>Tick a checkbox and watch the whole <code>&lt;label&gt;</code> recolour</em>.</>} /></div>
              </div>

              {/* Animation demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">anim.css</span><span className="lang-tag ts">@keyframes</span></div>
                <div className="demo-stage">
                  <div className="demo-anim-stage">
                    <div className="demo-anim" />
                    <div className="demo-anim" />
                    <div className="demo-anim" />
                  </div>
                </div>
                <pre className="demo-code">
                  <span className="cl-at">@keyframes</span> <span className="cl-fn">float</span> {'{'}{'\n'}
                  {'  '}<span className="cl-v">50%</span> {'{'} <span className="cl-prop">transform</span>: <span className="cl-fn">translateY</span>(<span className="cl-n">-18px</span>) <span className="cl-fn">scale</span>(<span className="cl-n">1.08</span>); {'}'}{'\n'}
                  {'}'}{'\n'}
                  <span className="cl-sel">.box</span> {'{'} <span className="cl-prop">animation</span>: <span className="cl-v">float</span> <span className="cl-n">3s</span> <span className="cl-v">ease-in-out</span> <span className="cl-v">infinite</span>; {'}'}
                </pre>
                <div className="demo-caption"><L zh={<><strong>关键帧动画</strong>: 三个方块, 一个浮动、一个圆形浮动、一个匀速旋转。<em>GPU 合成, 0 JS</em>——动画第一性就在 CSS。</>} en={<><strong>Keyframe animation</strong>: three boxes — one floats, one is round and floats, one spins. <em>GPU-composited, zero JS</em> — animation has always been CSS-native.</>} /></div>
              </div>

              {/* OKLCH color demo */}
              <div className="demo">
                <div className="demo-h"><span className="dot dot-ok" /><span className="filename">oklch.css</span><span className="lang-tag ts">color</span></div>
                <div className="demo-stage">
                  <div className="demo-color-row">
                    <div>50%</div>
                    <div>60%</div>
                    <div>70%</div>
                    <div>80%</div>
                    <div>30°</div>
                    <div>90°</div>
                    <div>150°</div>
                    <div>330°</div>
                  </div>
                </div>
                <pre className="demo-code">
                  <span className="cl-c">/* perceptually uniform · OKLCH */</span>{'\n'}
                  <span className="cl-sel">.s50</span> {'{'} <span className="cl-prop">background</span>: <span className="cl-fn">oklch</span>(<span className="cl-n">50%</span> <span className="cl-n">0.20</span> <span className="cl-n">250</span>); {'}'}{'\n'}
                  <span className="cl-sel">.s60</span> {'{'} <span className="cl-prop">background</span>: <span className="cl-fn">oklch</span>(<span className="cl-n">60%</span> <span className="cl-n">0.20</span> <span className="cl-n">250</span>); {'}'}{'\n'}
                  <span className="cl-c">/* +10% L = perceptual +10% lightness */</span>
                </pre>
                <div className="demo-caption"><L zh={<><strong>OKLCH</strong>: 感知均匀色彩, "L 加 10% = 真亮 10%"。HSL 做不到这件事 (HSL 50% 黄 vs 50% 蓝, 实际亮度差很多)。<em>设计系统 2024 后大量切到 OKLCH</em>。</>} en={<><strong>OKLCH</strong>: perceptually uniform — "+10% L = +10% visual brightness." HSL cannot do this (50% yellow ≠ 50% blue visually). <em>Design systems migrated heavily to OKLCH from 2024 onward</em>.</>} /></div>
              </div>
            </div>

            {/* Specificity calculator */}
            <header className="sec-head" style={{ marginBottom: 24 }}>
              <h2 className="sec-title" style={{ fontSize: 'clamp(24px, 3vw, 36px)' }}><L zh="特异性 (specificity) 计算器" en="Specificity calculator" /></h2>
              <p className="sec-desc"><L
                zh={<>CSS 选择器优先级 = <strong>(行内, ID, 类/伪类/属性, 元素/伪元素)</strong> 四元组, 从左往右<em>词典序</em>比较。</>}
                en={<>CSS selector precedence = the tuple <strong>(inline, ID, class/pseudo/attr, type/pseudo-elem)</strong>, compared <em>lexicographically</em> left-to-right.</>}
              /></p>
            </header>
            <div className="spec-grid">
              <div className="spec-h first"><L zh="选择器" en="Selector" /></div>
              <div className="spec-h">inline</div>
              <div className="spec-h">ID</div>
              <div className="spec-h">.cls / :ps / [attr]</div>
              <div className="spec-h">type / ::ps</div>

              <div className="spec-sel"><code>*</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><code>p</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num">1</div>

              <div className="spec-sel"><code>p::first-line</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num">2</div>

              <div className="spec-sel"><code>.btn</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num">1</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><code>a:hover</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num">1</div><div className="spec-num">1</div>

              <div className="spec-sel"><code>[type="text"]</code></div>
              <div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num">1</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><code>#hero .btn</code></div>
              <div className="spec-num zero">0</div><div className="spec-num hot">1</div><div className="spec-num">1</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><code>#hero #cta.btn:hover</code></div>
              <div className="spec-num zero">0</div><div className="spec-num hot">2</div><div className="spec-num">2</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><L zh={<>行内 <code>{'style="color:red"'}</code></>} en={<>inline <code>{'style="color:red"'}</code></>} /></div>
              <div className="spec-num hot">1</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div><div className="spec-num zero">0</div>

              <div className="spec-sel"><code>!important</code> <L zh="覆盖一切" en="overrides all" /></div>
              <div className="spec-num hot" style={{ gridColumn: 'span 4' }}><L zh="(独立维度 · 不在四元组内)" en="(separate axis · not part of the tuple)" /></div>
            </div>
          </section>

          {/* 05 Before / After */}
          <section className="section" id="beforeafter">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="2010 vs 2026" en="2010 vs 2026" /> <code>: BeforeAfter</code></h2>
              <p className="sec-desc"><L
                zh={<>CSS 30 年最有意思的故事是<strong>"以前要 hack, 现在一行"</strong>。下面 4 组对比, 同一目标, 上面是<em>2007-2014 年的真实代码</em>, 下面是<em>2017-2024 年的原生答案</em>。</>}
                en={<>CSS's most interesting 30-year story is <strong>"used to be a hack, now is one line."</strong> Four side-by-sides below: same goal, top is <em>actual code from 2007-2014</em>, bottom is the <em>native answer from 2017-2024</em>.</>}
              /></p>
            </header>

            <div className="beforeafter">
              <div className="beforeafter-controls">
                {baKeys.map((k) => (
                  <button
                    key={k}
                    className={`ba-tab${baTab === k ? ' active' : ''}`}
                    onClick={() => setBaTab(k)}
                    type="button"
                  >
                    {baLabels[k]}
                  </button>
                ))}
              </div>
              <p className="sec-desc" style={{ marginBottom: 18, fontSize: 15 }}>{BA_CONTENT[baTab].label}</p>
              <div className="beforeafter-grid">
                <div className="beforeafter-col old">
                  <div className="beforeafter-h old">
                    <span className="dot dot-warn" />
                    <span className="filename">{BA_CONTENT[baTab].old.name}</span>
                    <span className="era">{BA_CONTENT[baTab].old.era}</span>
                  </div>
                  <pre className="code">{BA_CONTENT[baTab].old.code}</pre>
                </div>
                <div className="beforeafter-col new">
                  <div className="beforeafter-h new">
                    <span className="dot dot-ok" />
                    <span className="filename">{BA_CONTENT[baTab].nu.name}</span>
                    <span className="era">{BA_CONTENT[baTab].nu.era}</span>
                  </div>
                  <pre className="code">{BA_CONTENT[baTab].nu.code}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* 06 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="为何值得花时间学透" en="Why CSS deserves real depth" /> <code>: WhyCss</code></h2>
              <p className="sec-desc"><L
                zh={<>"<em>CSS 就是改改颜色嘛</em>"是新人最常见的误解。<strong>深用 CSS 的人都知道</strong>: 它是声明式、是性能杠杆、是无障碍的入口、是 30 年向后兼容的活化石、也是 2026 年 Web 最有进步势头的一层。</>}
                en={<>"<em>It's just changing colours</em>" is the most common newcomer misread. <strong>People who use CSS deeply</strong> know it's declarative, a performance lever, the accessibility entry point, a 30-year-backward-compatible living layer, and the layer of the Web with the most momentum in 2026.</>}
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

          {/* 07 Turing-completeness */}
          <section className="section" id="turing">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="趣事" en="Aside" /> <code>: CssIsTuringComplete</code></h2>
              <p className="sec-desc"><L
                zh={<>是的, <strong>CSS 是图灵完备的</strong>——不是常规意义上, 而是<em>论文 + 可运行 demo 都有</em>的那种。</>}
                en={<>Yes — <strong>CSS is Turing-complete</strong> — not in the casual hand-wave sense, but in the <em>"paper exists, runnable demo exists"</em> sense.</>}
              /></p>
            </header>

            <div className="turing-block">
              <span className="turing-tag">TURING · RULE 110</span>
              <h3><L zh="HTML + CSS 可以模拟 Rule 110" en="HTML + CSS can simulate Rule 110" /></h3>
              <p><L
                zh={<>2011 年 <strong>Eli Fox-Epstein</strong> 给出 HTML+CSS 模拟 <em>Rule 110</em>元胞自动机的构造。<strong>Rule 110 在 2004 年被 Matthew Cook 证明图灵完备</strong>, 因此 HTML+CSS 也是图灵完备的。</>}
                en={<>In 2011, <strong>Eli Fox-Epstein</strong> demonstrated an HTML + CSS construction simulating the <em>Rule 110</em> cellular automaton. Since <strong>Rule 110 was proven Turing-complete by Matthew Cook in 2004</strong>, HTML + CSS is Turing-complete by reduction.</>}
              /></p>
              <p><L
                zh={<>关键机制: <code>:checked</code> 伪类记录"<strong>状态</strong>", <code>:hover</code> + <code>label[for]</code> 充当"<strong>触发器</strong>", 兄弟选择器 <code>~</code> 充当"<strong>邻居传播</strong>"。<em>每一次手动 hover/click 模拟一个时钟周期</em>——慢, 但是图灵完备的定义不要求快。</>}
                en={<>The trick: <code>:checked</code> stores <strong>state</strong>, <code>:hover</code> + <code>label[for]</code> provides the <strong>trigger</strong>, the sibling combinator <code>~</code> handles <strong>neighbour propagation</strong>. <em>Each manual hover/click simulates one clock tick</em> — slow, yes, but Turing-completeness does not require speed.</>}
              /></p>
              <p><L
                zh={<>意义有限实用价值 — <strong>没人会用 CSS 写斐波那契</strong>。但它说明 CSS 的表达能力<em>意外强大</em>, 也是"<em>CSS 算编程语言吗</em>"那场永恒论战里支持派的王牌。<strong>结论: 是一门完整的语言, 但是错的工具去做通用计算</strong>。</>}
                en={<>Of limited practical value — <strong>no one writes Fibonacci in CSS</strong>. But it shows CSS's expressive power is <em>quietly substantial</em>, and it's the supporters' trump card in the eternal "is CSS a programming language?" debate. <strong>Verdict: a complete language, but the wrong tool for general computation</strong>.</>}
              /></p>
            </div>
          </section>

          {/* 08 Ecosystem */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="生态 / 文档 / 工具" en="Ecosystem / Docs / Tools" /> <code>: Ecosystem</code></h2>
              <p className="sec-desc"><L
                zh={<>CSS 没有"一家公司"——它是 W3C CSSWG 主导, MDN + web.dev 教学, 周边工具链从 Sass 到 PostCSS 到 Tailwind。下面是 30 年生态里<strong>关键的几块</strong>。</>}
                en={<>CSS has no single owner — the W3C CSSWG drives the standard, MDN + web.dev teach it, the tool chain runs Sass → PostCSS → Tailwind. Below: <strong>the key pillars</strong> of CSS's 30-year ecosystem.</>}
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

          {/* 09 vs JS / HTML */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="对比" en="vs HTML / JS" /> <code>: CssVsTheRest</code></h2>
              <p className="sec-desc"><L
                zh={<>Web 三层: <a href="/code/html">HTML</a> 给结构、CSS 给外观、<a href="/code/javascript">JavaScript</a> (<a href="/code/ts">TS</a>) 给行为。<strong>每一层都是一门独立语言</strong>, 加起来形成"<em>渐进增强 / progressive enhancement</em>"——没 JS 仍能用, 没 CSS 仍能读。</>}
                en={<>The Web's three layers: <a href="/code/html">HTML</a> for structure, CSS for appearance, <a href="/code/javascript">JavaScript</a> (<a href="/code/ts">TS</a>) for behaviour. <strong>Each is its own language</strong>; together they form <em>progressive enhancement</em> — usable without JS, readable without CSS.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-old">HTML</th>
                  <th className="th-new">CSS</th>
                  <th className="th-rival">JavaScript</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    h: <>Tim Berners-Lee · 1991</>,
                    c: <>Håkon Wium Lie · 1994</>,
                    j: <>Brendan Eich · 1995</> },
                  { k: <L zh="范式" en="Paradigm" />,
                    h: <L zh="结构标记" en="Structural markup" />,
                    c: <L zh="声明式样式" en="Declarative styling" />,
                    j: <L zh="命令式 / 多范式" en="Imperative / multi-paradigm" /> },
                  { k: <L zh="图灵完备" en="Turing-complete" />,
                    h: <L zh="否 (纯标记)" en="No (pure markup)" />,
                    c: <L zh={<>是 (与 HTML 组合 · Rule 110)</>} en={<>Yes (combined with HTML · Rule 110)</>} />,
                    j: <L zh="是 (通用编程语言)" en="Yes (general-purpose)" /> },
                  { k: <L zh="演进节奏" en="Evolution pace" />,
                    h: <L zh="慢 · WHATWG living" en="Slow · WHATWG living standard" />,
                    c: <L zh={<>中 · 模块化 (Color L5, Selectors L4...)</>} en={<>Medium · modular (Color L5, Selectors L4...)</>} />,
                    j: <L zh="快 · TC39 一年一版" en="Fast · TC39 yearly" /> },
                  { k: <L zh="可变状态" en="Mutable state" />,
                    h: <L zh="无" en="None" />,
                    c: <L zh={<>无 (用户态: <code>:hover</code> / <code>:checked</code>)</>} en={<>None (user-driven: <code>:hover</code> / <code>:checked</code>)</>} />,
                    j: <L zh="完全可变 (heap / closures)" en="Fully mutable (heap / closures)" /> },
                  { k: <L zh="副作用 / IO" en="Side effects / IO" />,
                    h: <L zh="无 (浏览器解析)" en="None (browser parses)" />,
                    c: <L zh="无 (浏览器渲染)" en="None (browser renders)" />,
                    j: <L zh={<>有 (fetch / DOM / Worker...)</>} en={<>Yes (fetch / DOM / Worker...)</>} /> },
                  { k: <L zh="向后兼容" en="Backward compat" />,
                    h: <L zh="30+ 年, 严格不破" en="30+ years, never breaks" />,
                    c: <L zh="30 年, 严格不破" en="30 years, never breaks" />,
                    j: <L zh={<>严格不破 (但 TC39 偶有 deprecation)</>} en={<>Strict; occasional TC39 deprecations</>} /> },
                  { k: <L zh="GPU 加速" en="GPU-accelerated" />,
                    h: <L zh="—" en="—" />,
                    c: <L zh={<>原生 (<code>transform</code> / <code>filter</code>)</>} en={<>Native (<code>transform</code> / <code>filter</code>)</>} />,
                    j: <L zh="需手动 (canvas / WebGL / WebGPU)" en="Manual (canvas / WebGL / WebGPU)" /> },
                  { k: <L zh="无障碍 hook" en="Accessibility hooks" />,
                    h: <L zh="语义元素 · ARIA" en="Semantic elements + ARIA" />,
                    c: <L zh={<><code>prefers-*</code> 媒体查询</>} en={<><code>prefers-*</code> media queries</>} />,
                    j: <L zh={<>需手写 (focus / live regions)</>} en={<>Manual (focus / live regions)</>} /> },
                  { k: <L zh="文件大小" en="File size" />,
                    h: <L zh="小 · 直接 gzip" en="Small · direct gzip" />,
                    c: <L zh="中 · gzip 后通常 &lt; 100KB" en="Medium · &lt; 100KB gzipped typical" />,
                    j: <L zh="大 · 框架可几 MB" en="Large · frameworks reach MB" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.h}</td>
                    <td>{row.c}</td>
                    <td>{row.j}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 10 Outlook */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">10</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 年的 CSS: 平台追上来了, 但还在跑。Scroll-driven / View Transitions / Anchor / Houdini / Typed OM 是四个明确在路上的大方向, 每个都在<strong>把过去 JS 框架的活原生化</strong>。</>}
                en={<>CSS in 2026: the platform has caught up, but it's still moving. Scroll-driven animations, view transitions, anchor positioning, Houdini and the Typed OM are four directions on the visible road — each <strong>reclaiming work that JS frameworks used to own</strong>.</>}
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
                <li><a href="https://www.w3.org/Style/CSS/" target="_blank" rel="noopener">w3.org/Style/CSS</a></li>
                <li><a href="https://drafts.csswg.org/" target="_blank" rel="noopener">drafts.csswg.org</a></li>
                <li><a href="https://www.csswg.org/" target="_blank" rel="noopener">csswg.org</a></li>
                <li><a href="https://www.w3.org/TR/CSS/" target="_blank" rel="noopener"><L zh="W3C TR/CSS 索引" en="W3C TR/CSS index" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="教学 / 参考" en="Learning / Reference" /></h4>
              <ul>
                <li><a href="https://developer.mozilla.org/en-US/docs/Web/CSS" target="_blank" rel="noopener">MDN · CSS</a></li>
                <li><a href="https://web.dev/css/" target="_blank" rel="noopener">web.dev · CSS</a></li>
                <li><a href="https://web.dev/learn/css/" target="_blank" rel="noopener">Learn CSS</a></li>
                <li><a href="https://css-tricks.com" target="_blank" rel="noopener">css-tricks.com</a></li>
                <li><a href="https://every-layout.dev" target="_blank" rel="noopener">Every Layout</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 工具" en="Ecosystem / Tools" /></h4>
              <ul>
                <li><a href="https://drafts.css-houdini.org" target="_blank" rel="noopener">CSS Houdini drafts</a></li>
                <li><a href="https://tailwindcss.com" target="_blank" rel="noopener">Tailwind CSS</a></li>
                <li><a href="https://sass-lang.com" target="_blank" rel="noopener">Sass</a></li>
                <li><a href="https://postcss.org" target="_blank" rel="noopener">PostCSS</a></li>
                <li><a href="https://csszengarden.com" target="_blank" rel="noopener">CSS Zen Garden</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/html"><L zh="HTML — 兄弟语言" en="HTML — the sibling" /></a></li>
                <li><a href="/code/javascript"><L zh="JavaScript — 行为层" en="JavaScript — behaviour layer" /></a></li>
                <li><a href="/code/ts"><L zh="TypeScript — JS 加类型" en="TypeScript — JS with types" /></a></li>
                <li><a href="/code/architecture"><L zh="本站架构" en="This site's architecture" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{CSS_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`.body { animation: thirty-years 30s linear infinite; }`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
