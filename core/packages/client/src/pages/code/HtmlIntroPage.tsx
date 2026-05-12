import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './html_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const HTML_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="ht-shield" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FF7A52" />
        <stop offset="55%" stopColor="#E34F26" />
        <stop offset="100%" stopColor="#8A2C0F" />
      </linearGradient>
      <linearGradient id="ht-inner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#F06529" />
        <stop offset="100%" stopColor="#5A1A06" />
      </linearGradient>
    </defs>
    {/* pentagonal shield */}
    <path
      d="M28 24 L228 24 L210 220 L128 244 L46 220 Z"
      fill="url(#ht-shield)"
    />
    <path
      d="M48 38 L208 38 L193 208 L128 226 L63 208 Z"
      fill="url(#ht-inner)"
      opacity=".55"
    />
    {/* HTML5 "5" stylized — clean angle bracket "<>" core */}
    <g fill="#fff" fontFamily="'Cascadia Code', monospace" fontWeight="700">
      <text x="128" y="124" textAnchor="middle" fontSize="62" letterSpacing="-2">{'</>'}</text>
      <text x="128" y="184" textAnchor="middle" fontSize="56" letterSpacing="2">5</text>
    </g>
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
    year: <>1989<small>·03</small></>, highlight: true,
    zh: { title: <>Tim Berners-Lee 在 CERN 提交提案</>, desc: <><strong>"Information Management: A Proposal"</strong>——一张图、几页字, 把"超文本系统应该长什么样"讲清楚。这就是 web 的起点; 当时还没 HTML 这个名字, 但<em>所有后来的东西都从这页纸往下长</em>。</> },
    en: { title: <>Tim Berners-Lee submits the proposal at CERN</>, desc: <><strong>"Information Management: A Proposal"</strong> — a single diagram and a few pages of prose laying out what a hypertext system should look like. This is the seed of the web; HTML doesn't exist by name yet, but <em>everything that follows grows out of this page</em>.</> },
  },
  {
    year: <>1991<small>·08·06</small></>, highlight: true,
    zh: { title: <>第一个网站上线 — info.cern.ch</>, desc: <>TBL 把第一个网站部署到 CERN 一台 NeXT 工作站。<strong>22 个标签</strong>: <code>&lt;a&gt;</code>、<code>&lt;p&gt;</code>、<code>&lt;h1&gt;</code>~<code>&lt;h6&gt;</code>、<code>&lt;ul&gt;</code>……没有 CSS、没有 JS, 没有图片。<em>纯结构</em>。</> },
    en: { title: <>The first website goes live — info.cern.ch</>, desc: <>TBL deploys the first website on a NeXT workstation at CERN. <strong>22 tags</strong>: <code>&lt;a&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>, <code>&lt;ul&gt;</code>… No CSS, no JavaScript, no images. <em>Pure structure</em>.</> },
  },
  {
    year: '1993',
    zh: { title: <>NCSA Mosaic — 第一个真"浏览器"</>, desc: <>Marc Andreessen 在 Illinois 大学做出 <strong>Mosaic</strong>: 第一个能<strong>同页混排图文</strong>的图形浏览器。<code>&lt;img&gt;</code> 标签同年加入。web 第一次"好看"。Andreessen 一年后离校创办 Netscape。</> },
    en: { title: <>NCSA Mosaic — the first real browser</>, desc: <>Marc Andreessen builds <strong>Mosaic</strong> at the University of Illinois — the first graphical browser to <strong>show text and images on the same page</strong>. The <code>&lt;img&gt;</code> tag lands the same year. The web becomes "pretty." Andreessen leaves a year later to found Netscape.</> },
  },
  {
    year: '1994',
    zh: { title: <>Netscape Navigator + W3C 成立</>, desc: <>10 月 Netscape 1.0 发布, 一年内拿到 ~80% 浏览器市场。同月 TBL 在 MIT 创立 <strong>W3C</strong>, 想把 web 标准从单一厂商手里拉回中立——<em>这场拉扯持续了 25 年</em>。</> },
    en: { title: <>Netscape Navigator + W3C founded</>, desc: <>Netscape 1.0 ships in October and grabs ~80% browser share within a year. The same month, TBL founds <strong>W3C</strong> at MIT to pull web standards back to a neutral home — <em>a tug-of-war that lasts 25 years</em>.</> },
  },
  {
    year: '1995',
    zh: { title: <>HTML 2.0 — 第一份正式规范</>, desc: <>IETF RFC 1866 把 1993-95 的实际用法整理成<strong>第一份正式标准</strong>: 表单 (<code>&lt;form&gt;</code>)、图片、链接、表格 (后来)。同年: JavaScript (Brendan Eich, 10 天) + IE 1.0 + PHP——<em>web 平台所有支柱在一年内同时出现</em>。</> },
    en: { title: <>HTML 2.0 — first formal spec</>, desc: <>IETF RFC 1866 codifies the de-facto usage of 1993–95 as the <strong>first formal HTML standard</strong>: forms (<code>&lt;form&gt;</code>), images, links, tables (added soon after). Also in 1995: JavaScript (Brendan Eich, in 10 days), IE 1.0, PHP — <em>every pillar of the web platform arrives in one year</em>.</> },
  },
  {
    year: <>1997<small>·01</small></>,
    zh: { title: <>HTML 3.2 — W3C 接手 + 表格布局</>, desc: <>W3C 发布第一版自家规范: 表格 (<code>&lt;table&gt;</code>)、applet、字体标签、frames。<em>"用 table 排版"</em>从这里开始, 走了整整十年——也是后来 CSS 革命要纠正的对象。</> },
    en: { title: <>HTML 3.2 — W3C takes over + table layouts</>, desc: <>W3C ships its first own spec: tables (<code>&lt;table&gt;</code>), applets, font tags, frames. The era of <em>"layout with &lt;table&gt;"</em> begins here and runs a full decade — exactly what the later CSS revolution sets out to undo.</> },
  },
  {
    year: <>1999<small>·12</small></>,
    zh: { title: <>HTML 4.01 — 老 HTML 的终点</>, desc: <>结构 / 表现分离的第一步: <strong>推荐用 CSS 替代 <code>&lt;font&gt;</code> / <code>bgcolor</code></strong>。引入 <code>&lt;abbr&gt;</code>、<code>&lt;q&gt;</code>、<code>&lt;label&gt;</code> 等语义标签。<em>之后 10 年 HTML 主线停滞</em>——W3C 全力去做 XHTML 了。</> },
    en: { title: <>HTML 4.01 — the end of old HTML</>, desc: <>The first step toward separating structure from presentation: <strong>CSS recommended instead of <code>&lt;font&gt;</code> / <code>bgcolor</code></strong>. Semantic tags arrive: <code>&lt;abbr&gt;</code>, <code>&lt;q&gt;</code>, <code>&lt;label&gt;</code>. For the <em>next decade the HTML mainline stalls</em> while W3C bets everything on XHTML.</> },
  },
  {
    year: '2001',
    zh: { title: <>IE6 + 浏览器暗黑时代</>, desc: <>IE6 随 Windows XP 出货, 拿到 <strong>~95% 桌面浏览器份额</strong>, 微软<strong>解散 IE 团队</strong>停止更新——web 标准被冻在 2001 年。这段 7 年的"暗黑时代"让<em>所有人记住"垄断浏览器有多糟"</em>。</> },
    en: { title: <>IE6 + the browser dark age</>, desc: <>IE6 ships with Windows XP, claims <strong>~95% desktop browser share</strong>, and Microsoft <strong>disbands the IE team</strong> entirely. Web standards freeze at 2001 levels. The seven-year dark age burns into the industry's memory <em>just how bad a browser monopoly is</em>.</> },
  },
  {
    year: <>2000<small>~2009</small></>,
    zh: { title: <>XHTML 弯路 — XML 严格性的失败赌注</>, desc: <>W3C 押注 <strong>XHTML 2.0</strong>: XML 严格解析, 一个 <code>&lt;br&gt;</code> 不闭合整页报错。理论优美, 现实是<em>没人愿意用</em>——网页内容质量差, 太严会全 break。<strong>2009 年 W3C 正式放弃 XHTML 2.0</strong>。</> },
    en: { title: <>The XHTML detour — XML strictness as a failed bet</>, desc: <>W3C bets on <strong>XHTML 2.0</strong>: strict XML parsing — one unclosed <code>&lt;br&gt;</code> breaks the whole page. Elegant on paper, but real-world content is too messy and strict parsing <em>shatters everything</em>. <strong>W3C formally abandons XHTML 2.0 in 2009</strong>.</> },
  },
  {
    year: <>2004<small>·06</small></>, highlight: true,
    zh: { title: <>WHATWG 成立 — Apple/Mozilla/Opera 分裂</>, desc: <>W3C 拒绝继续演进 HTML, Apple / Mozilla / Opera 三家在 W3C 工作组会议上当场组建 <strong>WHATWG</strong> (Web Hypertext Application Technology Working Group), <strong>就地接手 HTML 演进</strong>。这是<em>开源标准从 W3C 实质性出走</em>的一刻。</> },
    en: { title: <>WHATWG forms — Apple/Mozilla/Opera break away</>, desc: <>W3C refuses to keep evolving HTML, so Apple, Mozilla and Opera form <strong>WHATWG</strong> (Web Hypertext Application Technology Working Group) on the spot at a W3C meeting and <strong>start evolving HTML themselves</strong>. The moment the open-standards body effectively <em>walks out on W3C</em>.</> },
  },
  {
    year: <>2004<small>·11</small></>,
    zh: { title: <>Firefox 1.0 — IE 第一个真挑战者</>, desc: <>Mozilla 从 Netscape 灰烬里重生, Firefox 1.0 4 年内拿到 ~30% 份额。<em>3 年内浏览器市场不再是单极</em>; 但 IE6 仍未死, 兼容性地狱要再过 5 年。</> },
    en: { title: <>Firefox 1.0 — IE's first real challenger</>, desc: <>Rebuilt from Netscape's ashes, Mozilla ships Firefox 1.0; within four years it holds ~30% share. <em>The browser market becomes multipolar for the first time</em> — but IE6 isn't dead and the compat hell will last five more years.</> },
  },
  {
    year: <>2004<small>·09</small></>,
    zh: { title: <><code>&lt;canvas&gt;</code> — Apple 在 Safari 偷偷加的</>, desc: <>Apple 给 Safari 2 加了 <code>&lt;canvas&gt;</code>, 给 macOS Dashboard widget 用——<strong>不告知, 不开会, 直接发</strong>。Mozilla 一个月内跟进。<em>HTML5 的第一块拼图: WHATWG 路线"先实现, 再标准化"</em>。</> },
    en: { title: <><code>&lt;canvas&gt;</code> — Apple ships it quietly in Safari</>, desc: <>Apple drops <code>&lt;canvas&gt;</code> into Safari 2 to power Dashboard widgets — <strong>no notice, no committee, just shipped</strong>. Mozilla follows within a month. <em>The first piece of HTML5: WHATWG's "implement first, standardise after" approach in action</em>.</> },
  },
  {
    year: <>2008<small>·09</small></>, highlight: true,
    zh: { title: <>Chrome 1.0 — 闸口被冲开</>, desc: <>Google 用 V8 + 多进程架构发布 Chrome。<em>性能比 IE6 / Firefox 高一个量级</em>, 一年内涨到 15% 份额, 4 年后超过 IE 成第一。<strong>IE 垄断的 8 年僵局至此真正结束</strong>。HTML5 的快车道也是从这里开始。</> },
    en: { title: <>Chrome 1.0 — the dam breaks</>, desc: <>Google ships Chrome with V8 and a multi-process architecture. <em>An order of magnitude faster than IE6 / Firefox</em>; within a year it holds 15% share, four years on it passes IE for #1. <strong>The 8-year IE monopoly stalemate is over</strong>. HTML5's fast lane starts here.</> },
  },
  {
    year: '2009',
    zh: { title: <><code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code> — Flash 的死刑预告</>, desc: <>WHATWG 写入 <code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code> 规范。Apple 同步在 iPhone 上拒绝 Flash——<em>原生媒体标签</em>从此成为 web 上播视频的唯一正经路。<strong>2017 Adobe 宣布 Flash 2020 EOL</strong>, 这条线从 2009 就埋好了。</> },
    en: { title: <><code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code> — Flash's death certificate</>, desc: <>WHATWG codifies <code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code>. Apple simultaneously rejects Flash on iPhone — <em>native media tags</em> become the only proper way to play video on the web. <strong>Adobe announces Flash EOL for 2020 in 2017</strong>, but the death warrant was signed in 2009.</> },
  },
  {
    year: '2011',
    zh: { title: <>WebKit 分化 — Safari / Chrome 同源</>, desc: <>Chrome 和 Safari 都用 WebKit 做渲染引擎。这一年 WebKit 推进 <code>&lt;details&gt;</code> / <code>&lt;summary&gt;</code>、CSS Grid 雏形、硬件加速合成。<em>"WebKit 是不是新 IE"的争论开始</em>; 2013 年 Google fork 出 Blink 才真正分家。</> },
    en: { title: <>WebKit consolidation — Safari / Chrome share an engine</>, desc: <>Both Chrome and Safari render with WebKit. The year sees <code>&lt;details&gt;</code> / <code>&lt;summary&gt;</code>, early CSS Grid, hardware-accelerated compositing. <em>The "is WebKit the new IE?" debate begins</em>; Google forks Blink out of WebKit in 2013 and the split becomes real.</> },
  },
  {
    year: <>2014<small>·10·28</small></>, highlight: true,
    zh: { title: <>HTML5 — 历经 6 年终于"完成"</>, desc: <>W3C 把 HTML5 标为 Recommendation。一长串新东西落地: <code>&lt;section&gt;</code> / <code>&lt;article&gt;</code> / <code>&lt;nav&gt;</code> / <code>&lt;header&gt;</code> / <code>&lt;footer&gt;</code> / <code>&lt;canvas&gt;</code> / <code>&lt;video&gt;</code> / <code>localStorage</code> / <code>WebSocket</code> / <code>Web Workers</code>。<strong>web 平台从"文档"正式变"应用"</strong>。</> },
    en: { title: <>HTML5 — finally "done" after six years</>, desc: <>W3C marks HTML5 as a Recommendation. A long list lands: <code>&lt;section&gt;</code> / <code>&lt;article&gt;</code> / <code>&lt;nav&gt;</code> / <code>&lt;header&gt;</code> / <code>&lt;footer&gt;</code> / <code>&lt;canvas&gt;</code> / <code>&lt;video&gt;</code> / <code>localStorage</code> / <code>WebSocket</code> / <code>Web Workers</code>. <strong>The web platform officially shifts from "documents" to "applications"</strong>.</> },
  },
  {
    year: '2014',
    zh: { title: <>Web Components + <code>&lt;picture&gt;</code> / srcset</>, desc: <>同一年: <strong>Custom Elements</strong> + Shadow DOM + HTML Templates 在 Chrome 落地——"<em>不靠框架自己定义元素</em>"; <code>&lt;picture&gt;</code> + <code>srcset</code> 把响应式图片标准化。两个都是 web 后 10 年的隐性主线。</> },
    en: { title: <>Web Components + <code>&lt;picture&gt;</code> / srcset</>, desc: <>The same year: <strong>Custom Elements</strong> + Shadow DOM + HTML Templates ship in Chrome — <em>defining your own elements without a framework</em>; <code>&lt;picture&gt;</code> + <code>srcset</code> standardise responsive images. Two quiet through-lines for the next decade of the web.</> },
  },
  {
    year: <>2019<small>·05·28</small></>, highlight: true,
    zh: { title: <>W3C 投降 — WHATWG 接管 HTML</>, desc: <>15 年对峙以这一天结束: W3C 和 WHATWG 联合公告, <strong>HTML 规范以 WHATWG 的 "Living Standard" 为<em>唯一</em>权威版本</strong>; W3C 不再独立维护 HTML 标准。<em>WHATWG 当年的"先实现再标准化"路线胜出</em>。</> },
    en: { title: <>W3C surrenders — WHATWG takes the HTML spec</>, desc: <>Fifteen years of standoff end on this date: W3C and WHATWG issue a joint statement — <strong>WHATWG's "Living Standard" is now the <em>sole</em> authoritative HTML spec</strong>; W3C no longer maintains a separate HTML standard. <em>WHATWG's "implement first, standardise after" approach wins</em>.</> },
  },
  {
    year: <>2020<small>·08</small></>,
    zh: { title: <>IE 11 EOL — 一个时代正式落幕</>, desc: <>微软宣布 365 系列 2021 停止支持 IE 11, Edge Legacy 2021 EOL。<strong>Edge Chromium</strong> 取而代之, 底层换成 Blink——IE 渲染引擎的 25 年走到头。<em>"IE 兼容性"从前端字典里消失</em>。</> },
    en: { title: <>IE 11 EOL — an era officially closes</>, desc: <>Microsoft announces Microsoft 365 will drop IE 11 in 2021 and ends Edge Legacy in 2021. <strong>Edge Chromium</strong> takes its place, now built on Blink. The IE rendering engine's 25-year run ends. <em>"IE compatibility" disappears from the front-end vocabulary</em>.</> },
  },
  {
    year: '2017',
    zh: { title: <>TBL 拿到 Turing Award</>, desc: <>ACM 把 2016 年度图灵奖 (2017 颁) 给 Tim Berners-Lee, 理由: <em>"发明 World Wide Web、第一个浏览器和让 web 扩展的基础协议与算法"</em>。<strong>HTML 终于从"草根工程"被正式承认为计算机科学的基础贡献</strong>。</> },
    en: { title: <>TBL receives the Turing Award</>, desc: <>ACM awards Tim Berners-Lee the 2016 Turing Award (presented in 2017) for <em>"inventing the World Wide Web, the first web browser, and the fundamental protocols and algorithms allowing the web to scale."</em> <strong>HTML is finally recognised in computer-science canon, not just engineering folklore</strong>.</> },
  },
  {
    year: '2022',
    zh: { title: <><code>&lt;dialog&gt;</code> 全平台落地</>, desc: <>2014 年规范, 经过 8 年, <strong>三大引擎 (Blink / WebKit / Gecko) 终于全部支持</strong>。原来要 ~150 行 JS + ARIA 才能做对的"模态对话框", 现在<code>&lt;dialog open&gt;</code>一行——<em>HTML 把以前 framework 的活拿回来</em>的第一步。</> },
    en: { title: <><code>&lt;dialog&gt;</code> goes cross-engine</>, desc: <>Specced in 2014, after eight years <strong>all three major engines (Blink / WebKit / Gecko) finally ship it</strong>. The modal dialog that used to take ~150 lines of JS + ARIA is now <code>&lt;dialog open&gt;</code> — <em>the first move in HTML clawing back work the framework era took</em>.</> },
  },
  {
    year: '2023',
    zh: { title: <>Declarative Shadow DOM + View Transitions</>, desc: <>两件大事: <strong>声明式 Shadow DOM</strong> (服务端渲染 Web Components 终于行) + <strong>View Transitions API</strong> (页面切换的 fade / morph 动画一个 CSS 属性搞定, 不再要 framework router)。两者都是<em>"还给 HTML 而非堆框架"</em>。</> },
    en: { title: <>Declarative Shadow DOM + View Transitions</>, desc: <>Two big ones: <strong>Declarative Shadow DOM</strong> (server-rendering Web Components finally works) + <strong>View Transitions API</strong> (page-transition fades / morphs as a single CSS property — no router framework needed). Both are <em>"give it back to HTML, not yet another framework"</em>.</> },
  },
  {
    year: <>2024<small>·04</small></>, highlight: true,
    zh: { title: <>Popover API — 全平台落地</>, desc: <><code>popover</code> 属性 + <code>popovertarget</code> 让<strong>原生气泡 / 菜单 / tooltip</strong>不用 JS、不用 z-index 战斗、自动 top-layer。Chrome 114 + Safari 17 + Firefox 125 同步支持。<em>这是 2024 年最大的"HTML 反吞 JS"的胜利</em>。</> },
    en: { title: <>Popover API — cross-browser</>, desc: <>The <code>popover</code> attribute + <code>popovertarget</code> give you <strong>native popups / menus / tooltips</strong> without JS, without z-index battles, with automatic top-layer. Chrome 114, Safari 17 and Firefox 125 ship in sync. <em>The biggest "HTML re-absorbs JS" win of 2024</em>.</> },
  },
  {
    year: '2025',
    zh: { title: <>Anchor Positioning + <code>&lt;selectlist&gt;</code></>, desc: <>CSS Anchor Positioning (Chrome 125+) 让 popover 自动跟随定位; <strong><code>&lt;selectlist&gt;</code></strong> / <code>&lt;selectmenu&gt;</code> 把<em>可完全样式化的 select 下拉</em>带进 HTML——25 年没人能优雅样式化的 <code>&lt;select&gt;</code> 终于松动。<em>UI 框架的下一个领域被 HTML 收走</em>。</> },
    en: { title: <>Anchor Positioning + <code>&lt;selectlist&gt;</code></>, desc: <>CSS Anchor Positioning (Chrome 125+) makes popovers track their trigger automatically; <strong><code>&lt;selectlist&gt;</code></strong> / <code>&lt;selectmenu&gt;</code> brings <em>fully styleable select dropdowns</em> into HTML — 25 years of un-stylable <code>&lt;select&gt;</code> finally cracks. <em>HTML reclaims another patch of UI-framework territory</em>.</> },
  },
  {
    year: '2026',
    zh: { title: <>HTML 的现状 — 35 岁, 仍在反吞 JS</>, desc: <>2026 年: <strong>HTML 不再发版本号</strong>, Living Standard 每天都在改; <code>&lt;dialog&gt;</code> / popover / anchor / view transitions 已是默认工具; <strong>declarative shadow DOM + custom elements</strong>让"框架-less 框架"真正可行。<em>HTML 不是"老技术", 它是 2026 年还在主动进化的少数语言之一</em>。</> },
    en: { title: <>HTML in 2026 — 35 years old, still re-absorbing JS</>, desc: <>2026: <strong>HTML no longer ships version numbers</strong> — the Living Standard changes daily; <code>&lt;dialog&gt;</code>, popover, anchor positioning and view transitions are default tooling; <strong>declarative shadow DOM + custom elements</strong> make the "framework-less framework" actually viable. <em>HTML isn't a "legacy tech" — it's one of the few languages in 2026 that's still actively evolving</em>.</> },
  },
];

interface TagThruHistory {
  year: ReactNode;
  tag: string;
  zhDesc: ReactNode;
  enDesc: ReactNode;
}
const TAGS_TIMELINE: TagThruHistory[] = [
  { year: '1991', tag: '<a>',        zhDesc: <>超链接, web 的<strong>核心动词</strong>。22 个原始标签里最重要的一个。</>, enDesc: <>The hyperlink — the web's <strong>core verb</strong>. The most important of the original 22 tags.</> },
  { year: '1993', tag: '<img>',      zhDesc: <>Mosaic 加, web 第一次"<strong>有图</strong>"。30 年后仍是页面带宽大头。</>, enDesc: <>Added in Mosaic — the web's first <strong>image support</strong>. Still dominates page bandwidth 30 years on.</> },
  { year: '1995', tag: '<form>',     zhDesc: <>HTML 2.0 把表单标准化。<strong>web app 的真起点</strong>——没有 form 就没有提交。</>, enDesc: <>HTML 2.0 standardises forms. The <strong>real birth of the web app</strong> — no form, no submit.</> },
  { year: '1997', tag: '<table>',    zhDesc: <>HTML 3.2 加表格。<em>之后被滥用为布局工具整整 10 年</em>, CSS Grid 才把它放回数据语义。</>, enDesc: <>HTML 3.2 ships tables. <em>Abused as a layout tool for an entire decade</em>, until CSS Grid puts it back in its data-semantic place.</> },
  { year: '1999', tag: '<iframe>',   zhDesc: <>嵌入另一个文档。25 年后仍是"<em>嵌第三方 widget</em>"唯一通用方案。</>, enDesc: <>Embed another document. Still the only general-purpose way to host <em>third-party widgets</em> 25 years later.</> },
  { year: '2004', tag: '<canvas>',   zhDesc: <>Apple 在 Safari 偷偷加, 给 widget 用。<strong>2D / WebGL 渲染</strong>的入口, 整个浏览器游戏生态的地基。</>, enDesc: <>Apple drops it into Safari for Dashboard widgets. Gateway to <strong>2D / WebGL rendering</strong> — the foundation of every browser game.</> },
  { year: '2009', tag: '<video>',    zhDesc: <>HTML5 媒体标签。<strong>Flash 的死亡判决书</strong>; codec 战争 (H.264 vs VP9 vs AV1) 至今没完。</>, enDesc: <>HTML5's media tag. <strong>Flash's death warrant</strong>; the codec war (H.264 vs VP9 vs AV1) still isn't over.</> },
  { year: '2011', tag: '<details>',  zhDesc: <>原生 accordion / disclosure widget。10 年的 jQuery toggle 一行 HTML 解决。</>, enDesc: <>Native accordion / disclosure widget. Replaces a decade of jQuery toggles with one HTML element.</> },
  { year: '2014', tag: '<picture>',  zhDesc: <>响应式图片 + <code>srcset</code>。"<em>Retina 屏给 2x, 手机给小图</em>"标准化, 不用 JS。</>, enDesc: <>Responsive images + <code>srcset</code>. Standardises <em>"2× for Retina, smaller for mobile"</em> with zero JS.</> },
  { year: '2014', tag: '<template>', zhDesc: <>解析但不渲染的 HTML 片段。<strong>Web Components 的克隆源</strong>; SSR + 客户端 hydrate 的官方机制。</>, enDesc: <>Parsed but not rendered HTML. <strong>The clone source for Web Components</strong>; the official SSR + hydration handle.</> },
  { year: '2014', tag: 'custom-elements', zhDesc: <>自定义元素 v1。<code>class extends HTMLElement</code>——<strong>不靠框架定义可复用组件</strong>。</>, enDesc: <>Custom Elements v1. <code>class extends HTMLElement</code> — <strong>reusable components with no framework</strong>.</> },
  { year: '2022', tag: '<dialog>',   zhDesc: <>原生模态对话框, 自动 top-layer + <code>::backdrop</code> + ESC 关闭。<em>替代 ~150 行 JS</em>。</>, enDesc: <>Native modal dialog with automatic top-layer + <code>::backdrop</code> + ESC-to-close. <em>Replaces ~150 lines of JS</em>.</> },
  { year: '2024', tag: 'popover',    zhDesc: <>HTML 属性, 不是新标签。任何元素加 <code>popover</code>——气泡 / tooltip / 菜单<strong>不用 JS</strong>。</>, enDesc: <>An HTML attribute, not a new tag. Any element can be a popover — bubbles, tooltips, menus <strong>without JS</strong>.</> },
  { year: '2025', tag: '<selectlist>', zhDesc: <>可完全样式化的 select。<strong>25 年来第一次<code>&lt;select&gt;</code>能 CSS</strong>——UI 库的下一片地。</>, enDesc: <>A fully styleable select. <strong>The first time in 25 years <code>&lt;select&gt;</code> bows to CSS</strong> — the next UI-library territory to fall.</> },
];

interface DemoBlock {
  zhTitle: ReactNode;
  enTitle: ReactNode;
  zhTag: ReactNode;
  enTag: ReactNode;
  goodDot?: boolean;
  src: ReactNode;
  rendered: ReactNode;
}

interface Surface {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const SURFACE_CARDS: Surface[] = [
  {
    tag: 'A',
    zh: { title: <><code>&lt;canvas&gt;</code> — 2D / WebGL / WebGPU</>, desc: <><strong>立即模式</strong>绘图。从 2D context 到 WebGL 到 WebGPU 全部挂在它上面——<em>浏览器里所有游戏 / 可视化 / 3D 渲染的根</em>。</> },
    en: { title: <><code>&lt;canvas&gt;</code> — 2D / WebGL / WebGPU</>, desc: <><strong>Immediate-mode</strong> drawing. 2D context, WebGL, and WebGPU all attach here — <em>the root of every game / visualisation / 3D renderer in the browser</em>.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;canvas</span> <span className="cl-attr">id</span>=<span className="cl-s">"c"</span> <span className="cl-attr">width</span>=<span className="cl-s">"512"</span> <span className="cl-attr">height</span>=<span className="cl-s">"512"</span><span className="cl-tag">&gt;</span>{'\n'}
        <span className="cl-tag">&lt;/canvas&gt;</span>{'\n\n'}
        <span className="cl-tag">&lt;script&gt;</span>{'\n'}
        {'  '}<span className="cl-k">const</span> gl = c.<span className="cl-fn">getContext</span>(<span className="cl-s">'webgl2'</span>);{'\n'}
        {'  '}<span className="cl-c">// or 'webgpu' on modern Chrome</span>{'\n'}
        <span className="cl-tag">&lt;/script&gt;</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code></>, desc: <>原生媒体。<strong>HLS / DASH 自适应流</strong>走 Media Source Extensions; <code>controls</code> 属性给你免费 UI。<em>Flash 之死</em>。</> },
    en: { title: <><code>&lt;video&gt;</code> / <code>&lt;audio&gt;</code></>, desc: <>Native media. <strong>HLS / DASH adaptive streaming</strong> via Media Source Extensions; the <code>controls</code> attribute hands you free UI. <em>What killed Flash</em>.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;video</span>{'\n'}
        {'  '}<span className="cl-attr">src</span>=<span className="cl-s">"clip.mp4"</span>{'\n'}
        {'  '}<span className="cl-attr">controls</span> <span className="cl-attr">muted</span> <span className="cl-attr">loop</span>{'\n'}
        {'  '}<span className="cl-attr">poster</span>=<span className="cl-s">"thumb.jpg"</span><span className="cl-tag">&gt;</span>{'\n'}
        <span className="cl-tag">&lt;/video&gt;</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>&lt;dialog&gt;</code> — 原生模态</>, desc: <>2022 全平台落地。自动 <strong>top-layer</strong>, ESC 关闭, <code>::backdrop</code> 伪元素, <code>showModal()</code> 焦点陷阱。<em>替代 ~150 行 JS</em>。</> },
    en: { title: <><code>&lt;dialog&gt;</code> — native modal</>, desc: <>Cross-engine in 2022. Auto <strong>top-layer</strong>, ESC-to-close, <code>::backdrop</code> pseudo-element, focus trap via <code>showModal()</code>. <em>Replaces ~150 lines of JS</em>.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;dialog</span> <span className="cl-attr">id</span>=<span className="cl-s">"d"</span><span className="cl-tag">&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;form</span> <span className="cl-attr">method</span>=<span className="cl-s">"dialog"</span><span className="cl-tag">&gt;</span>{'\n'}
        {'    '}<span className="cl-tag">&lt;button&gt;</span>OK<span className="cl-tag">&lt;/button&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;/form&gt;</span>{'\n'}
        <span className="cl-tag">&lt;/dialog&gt;</span>{'\n\n'}
        <span className="cl-tag">&lt;script&gt;</span>d.<span className="cl-fn">showModal</span>()<span className="cl-tag">&lt;/script&gt;</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <><code>&lt;details&gt;</code> / <code>&lt;summary&gt;</code></>, desc: <>原生可折叠 widget。<em>"jQuery toggle"</em>的杀手。可访问性自动正确; <code>open</code> 属性即状态。</> },
    en: { title: <><code>&lt;details&gt;</code> / <code>&lt;summary&gt;</code></>, desc: <>Native collapsible widget. The killer of the <em>jQuery toggle</em>. Accessibility comes for free; the <code>open</code> attribute is the state.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;details&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;summary&gt;</span>Read more<span className="cl-tag">&lt;/summary&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;p&gt;</span>Hidden until clicked.<span className="cl-tag">&lt;/p&gt;</span>{'\n'}
        <span className="cl-tag">&lt;/details&gt;</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <><code>&lt;picture&gt;</code> + srcset</>, desc: <>响应式图片标准。<strong>Retina 2x / 3x</strong>、不同视口下换源、<code>&lt;source&gt;</code> 多 format (avif → webp → jpg)。<em>不要再用 JS 切图</em>。</> },
    en: { title: <><code>&lt;picture&gt;</code> + srcset</>, desc: <>The responsive-image standard. <strong>Retina 2× / 3×</strong>, swap sources per viewport, multi-format <code>&lt;source&gt;</code> chains (avif → webp → jpg). <em>Stop switching images from JS</em>.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;picture&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;source</span> <span className="cl-attr">srcset</span>=<span className="cl-s">"hero.avif"</span> <span className="cl-attr">type</span>=<span className="cl-s">"image/avif"</span><span className="cl-tag">&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;source</span> <span className="cl-attr">srcset</span>=<span className="cl-s">"hero.webp"</span> <span className="cl-attr">type</span>=<span className="cl-s">"image/webp"</span><span className="cl-tag">&gt;</span>{'\n'}
        {'  '}<span className="cl-tag">&lt;img</span> <span className="cl-attr">src</span>=<span className="cl-s">"hero.jpg"</span> <span className="cl-attr">alt</span>=<span className="cl-s">"…"</span><span className="cl-tag">&gt;</span>{'\n'}
        <span className="cl-tag">&lt;/picture&gt;</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>Custom Elements + Shadow DOM</>, desc: <><strong>真"框架-less 框架"</strong>: <code>class extends HTMLElement</code>, 注册一次, 像 <code>&lt;div&gt;</code> 一样用。Shadow DOM 隔离样式; 2023 declarative 版本让 SSR 也行。</> },
    en: { title: <>Custom Elements + Shadow DOM</>, desc: <>The real <strong>framework-less framework</strong>: <code>class extends HTMLElement</code>, register once, use like any built-in tag. Shadow DOM isolates styles; the 2023 declarative variant unlocks SSR.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;script&gt;</span>{'\n'}
        <span className="cl-k">class</span> <span className="cl-type">XBadge</span> <span className="cl-k">extends</span> <span className="cl-type">HTMLElement</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">connectedCallback</span>(){'{'} <span className="cl-k">this</span>.textContent = <span className="cl-s">'!'</span> {'}'}{'\n'}
        {'}'}{'\n'}
        <span className="cl-fn">customElements</span>.<span className="cl-fn">define</span>(<span className="cl-s">'x-badge'</span>, <span className="cl-type">XBadge</span>);{'\n'}
        <span className="cl-tag">&lt;/script&gt;</span>{'\n'}
        <span className="cl-tag">&lt;x-badge&gt;&lt;/x-badge&gt;</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>Popover API</>, desc: <>2024 全平台。任意元素加 <code>popover</code> 属性, <code>popovertarget</code> 触发。<strong>自动 top-layer, 不打 z-index 仗</strong>; bubble / tooltip / menu 一并解决。</> },
    en: { title: <>Popover API</>, desc: <>Cross-browser in 2024. Add <code>popover</code> to any element, trigger via <code>popovertarget</code>. <strong>Automatic top-layer, no z-index battles</strong>; bubbles, tooltips and menus all in one mechanism.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;button</span> <span className="cl-attr">popovertarget</span>=<span className="cl-s">"menu"</span><span className="cl-tag">&gt;</span>Open<span className="cl-tag">&lt;/button&gt;</span>{'\n'}
        <span className="cl-tag">&lt;div</span> <span className="cl-attr">id</span>=<span className="cl-s">"menu"</span> <span className="cl-attr">popover</span><span className="cl-tag">&gt;</span>{'\n'}
        {'  '}I float above everything.{'\n'}
        <span className="cl-tag">&lt;/div&gt;</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>ARIA — 可访问性贴片</>, desc: <><strong>语义不够时</strong>的补丁: <code>role</code>、<code>aria-label</code>、<code>aria-expanded</code>……<em>"最好的 ARIA 是没有 ARIA"</em>——用对原生标签优先。</> },
    en: { title: <>ARIA — accessibility patching</>, desc: <>The patch layer for <strong>when native semantics aren't enough</strong>: <code>role</code>, <code>aria-label</code>, <code>aria-expanded</code>… <em>"The best ARIA is no ARIA"</em> — reach for the right native element first.</> },
    code: (
      <code>
        <span className="cl-tag">&lt;div</span>{'\n'}
        {'  '}<span className="cl-attr">role</span>=<span className="cl-s">"button"</span>{'\n'}
        {'  '}<span className="cl-attr">tabindex</span>=<span className="cl-s">"0"</span>{'\n'}
        {'  '}<span className="cl-attr">aria-pressed</span>=<span className="cl-s">"false"</span><span className="cl-tag">&gt;</span>{'\n'}
        {'  '}Toggle{'\n'}
        <span className="cl-tag">&lt;/div&gt;</span>{'\n\n'}
        <span className="cl-c">{'// vs just <button>: free + correct'}</span>
      </code>
    ),
  },
];

interface BrowserShareRow {
  year: string;
  zh?: ReactNode;
  en?: ReactNode;
  segs: { cls: string; pct: number; label: string }[];
}

// Rough but historically grounded global desktop browser share snapshots.
// Sourced from StatCounter / NetMarketShare / Wikipedia "Usage share of web browsers"
// (Apr-of-year). Numbers normalised to 100 with an "other" bucket.
const SHARE: BrowserShareRow[] = [
  { year: '1996', segs: [{ cls: 'ns', pct: 80, label: 'NN' }, { cls: 'ie', pct: 12, label: 'IE' }, { cls: 'ot', pct: 8, label: 'other' }] },
  { year: '1999', segs: [{ cls: 'ns', pct: 35, label: 'NN' }, { cls: 'ie', pct: 60, label: 'IE5' }, { cls: 'ot', pct: 5, label: '·' }] },
  { year: '2002', segs: [{ cls: 'ie', pct: 92, label: 'IE6' }, { cls: 'ns', pct: 4, label: 'NN' }, { cls: 'ot', pct: 4, label: '·' }] },
  { year: '2005', segs: [{ cls: 'ie', pct: 85, label: 'IE6' }, { cls: 'ff', pct: 11, label: 'FF' }, { cls: 'ot', pct: 4, label: 'op/sf' }] },
  { year: '2008', segs: [{ cls: 'ie', pct: 68, label: 'IE' }, { cls: 'ff', pct: 25, label: 'Firefox' }, { cls: 'sf', pct: 4, label: 'Safari' }, { cls: 'ot', pct: 3, label: '·' }] },
  { year: '2010', segs: [{ cls: 'ie', pct: 51, label: 'IE' }, { cls: 'ff', pct: 31, label: 'FF' }, { cls: 'cr', pct: 13, label: 'Chrome' }, { cls: 'sf', pct: 4, label: 'Safari' }, { cls: 'ot', pct: 1, label: '·' }] },
  { year: '2013', segs: [{ cls: 'cr', pct: 42, label: 'Chrome' }, { cls: 'ie', pct: 27, label: 'IE' }, { cls: 'ff', pct: 20, label: 'FF' }, { cls: 'sf', pct: 8, label: 'Safari' }, { cls: 'ot', pct: 3, label: '·' }] },
  { year: '2016', segs: [{ cls: 'cr', pct: 56, label: 'Chrome' }, { cls: 'ie', pct: 13, label: 'IE/Edge' }, { cls: 'ff', pct: 14, label: 'FF' }, { cls: 'sf', pct: 13, label: 'Safari' }, { cls: 'ot', pct: 4, label: '·' }] },
  { year: '2020', segs: [{ cls: 'cr', pct: 65, label: 'Chrome' }, { cls: 'sf', pct: 17, label: 'Safari' }, { cls: 'ff', pct: 8, label: 'FF' }, { cls: 'ed', pct: 5, label: 'Edge' }, { cls: 'ot', pct: 5, label: '·' }] },
  { year: '2023', segs: [{ cls: 'cr', pct: 64, label: 'Chrome' }, { cls: 'sf', pct: 19, label: 'Safari' }, { cls: 'ed', pct: 5, label: 'Edge' }, { cls: 'ff', pct: 3, label: 'FF' }, { cls: 'ot', pct: 9, label: '·' }] },
  { year: '2026', segs: [{ cls: 'cr', pct: 65, label: 'Chrome' }, { cls: 'sf', pct: 18, label: 'Safari' }, { cls: 'ed', pct: 5, label: 'Edge' }, { cls: 'ff', pct: 2, label: 'FF' }, { cls: 'ot', pct: 10, label: '·' }] },
];

const DEMO_SEMANTIC: DemoBlock = {
  zhTitle: <>语义化 HTML</>,
  enTitle: <>Semantic HTML</>,
  zhTag: <>每个标签都说明它是什么</>,
  enTag: <>Each tag declares what it is</>,
  goodDot: true,
  src: (
    <code>
      <span className="cl-tag">&lt;article&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;header</span> <span className="cl-attr">class</span>=<span className="cl-s">"demo-header"</span><span className="cl-tag">&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;h2&gt;</span>HTML reabsorbs JS<span className="cl-tag">&lt;/h2&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;time</span> <span className="cl-attr">datetime</span>=<span className="cl-s">"2026-04"</span><span className="cl-tag">&gt;</span>2026-04<span className="cl-tag">&lt;/time&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;/header&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;nav</span> <span className="cl-attr">class</span>=<span className="cl-s">"demo-nav"</span><span className="cl-tag">&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;a</span> <span className="cl-attr">href</span>=<span className="cl-s">"#"</span><span className="cl-tag">&gt;</span>spec<span className="cl-tag">&lt;/a&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;a</span> <span className="cl-attr">href</span>=<span className="cl-s">"#"</span><span className="cl-tag">&gt;</span>mdn<span className="cl-tag">&lt;/a&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;/nav&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;p&gt;</span>Popover, dialog, view transitions…<span className="cl-tag">&lt;/p&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;details&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;summary&gt;</span>One more thing<span className="cl-tag">&lt;/summary&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;p&gt;</span>Declarative shadow DOM.<span className="cl-tag">&lt;/p&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;/details&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;footer</span> <span className="cl-attr">class</span>=<span className="cl-s">"demo-footer"</span><span className="cl-tag">&gt;</span>CC-BY<span className="cl-tag">&lt;/footer&gt;</span>{'\n'}
      <span className="cl-tag">&lt;/article&gt;</span>
    </code>
  ),
  rendered: (
    <article>
      <header className="demo-header">
        <h2>HTML reabsorbs JS</h2>
        <time dateTime="2026-04">2026-04</time>
      </header>
      <nav className="demo-nav">
        <a href="#" onClick={(e) => e.preventDefault()}>spec</a>
        <a href="#" onClick={(e) => e.preventDefault()}>mdn</a>
      </nav>
      <p>Popover, dialog, view transitions all moved into the platform.</p>
      <details>
        <summary>One more thing</summary>
        <p>Declarative shadow DOM lets server-rendered Web Components hydrate cleanly.</p>
      </details>
      <footer className="demo-footer">CC-BY</footer>
    </article>
  ),
};

const DEMO_SOUP: DemoBlock = {
  zhTitle: <>Div soup — 反例</>,
  enTitle: <>Div soup — anti-pattern</>,
  zhTag: <>视觉一样, 语义为零</>,
  enTag: <>Looks the same, zero meaning</>,
  src: (
    <code>
      <span className="cl-tag">&lt;div</span> <span className="cl-attr">class</span>=<span className="cl-s">"div-soup"</span><span className="cl-tag">&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div</span> <span className="cl-attr">class</span>=<span className="cl-s">"h-fake"</span><span className="cl-tag">&gt;</span>HTML reabsorbs JS<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div</span> <span className="cl-attr">class</span>=<span className="cl-s">"nav-fake"</span><span className="cl-tag">&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;span&gt;</span>spec<span className="cl-tag">&lt;/span&gt;</span>{'\n'}
      {'    '}<span className="cl-tag">&lt;span&gt;</span>mdn<span className="cl-tag">&lt;/span&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div&gt;</span>Popover, dialog, view transitions…<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div&gt;</span>One more thing<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div&gt;</span>Declarative shadow DOM.<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      {'  '}<span className="cl-tag">&lt;div</span> <span className="cl-attr">class</span>=<span className="cl-s">"footer-fake"</span><span className="cl-tag">&gt;</span>CC-BY<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
      <span className="cl-tag">&lt;/div&gt;</span>
    </code>
  ),
  rendered: (
    <div className="div-soup">
      <div className="h-fake">HTML reabsorbs JS</div>
      <div className="nav-fake">
        <span>spec</span>
        <span>mdn</span>
      </div>
      <div>Popover, dialog, view transitions all moved into the platform.</div>
      <div>One more thing</div>
      <div>Declarative shadow DOM lets server-rendered Web Components hydrate cleanly.</div>
      <div className="footer-fake">CC-BY</div>
    </div>
  ),
};

interface WhyCard {
  icon: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const WHY_CARDS: WhyCard[] = [
  {
    icon: '⌬',
    zh: { title: <>语义就是免费的可访问性</>, desc: <>用对 <code>&lt;button&gt;</code> / <code>&lt;nav&gt;</code> / <code>&lt;h1&gt;</code>, 屏幕阅读器、键盘 tab、SEO 全部免费正确。<em>"最好的 ARIA 是没有 ARIA"</em>——大半 ARIA 属性都是<strong>div soup 在补救自己</strong>。</> },
    en: { title: <>Semantics give you accessibility for free</>, desc: <>Reach for <code>&lt;button&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;h1&gt;</code> and screen readers, keyboard tab order, SEO all come out correct for free. <em>"The best ARIA is no ARIA"</em> — most ARIA attributes are <strong>div soup patching itself</strong>.</> },
    code: <><span className="cl-tag">&lt;button&gt;</span>Save<span className="cl-tag">&lt;/button&gt;</span>  <span className="cl-c">// keyboard + AT free</span>{'\n'}<span className="cl-tag">&lt;div</span> <span className="cl-attr">role</span>=<span className="cl-s">"button"</span> <span className="cl-attr">tabindex</span>=<span className="cl-s">"0"</span><span className="cl-tag">&gt;</span>...<span className="cl-tag">&lt;/div&gt;</span>{'\n'}<span className="cl-c">// equivalent — only after 3 ARIA fixes</span></>,
  },
  {
    icon: '⊹',
    zh: { title: <>declarative &gt; imperative</>, desc: <>能用<strong>属性表达</strong>的状态, 别写 JS。<code>open</code> 属性 = <code>&lt;dialog&gt;</code> 状态; <code>popover</code> 属性 = 是不是 popover; <code>&lt;details open&gt;</code>。<em>HTML 反吞 JS 的核心机制</em>。</> },
    en: { title: <>Declarative beats imperative</>, desc: <>State you can <strong>express as an attribute</strong> shouldn't live in JS. <code>open</code> on <code>&lt;dialog&gt;</code> is its state; <code>popover</code> declares popover-ness; <code>&lt;details open&gt;</code>. <em>The core mechanism behind HTML re-absorbing JS</em>.</> },
    code: <><span className="cl-tag">&lt;dialog</span> <span className="cl-attr">open</span><span className="cl-tag">&gt;</span>...<span className="cl-tag">&lt;/dialog&gt;</span>{'\n'}<span className="cl-c">// vs: el.showModal(); + handlers</span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>没有 build step 也能跑</>, desc: <>HTML 是 web 上<strong>唯一</strong>不需要编译 / 转译 / 打包就能跑的语言。<em>"open file in browser, refresh"</em>——25 年没变过的反馈环。这是 TS / Rust / Swift 永远做不到的零门槛。</> },
    en: { title: <>No build step, ever</>, desc: <>HTML is the <strong>only</strong> web language that runs without compiling, transpiling, or bundling. <em>"Open the file in a browser, refresh"</em> — a feedback loop that has been unchanged for 25 years. TS / Rust / Swift will never offer that zero-friction.</> },
    code: <>$ open index.html{'\n'}<span className="cl-c"># done.</span></>,
  },
  {
    icon: '⌘',
    zh: { title: <>历史兼容是法则</>, desc: <>1991 年的 HTML 在 2026 的 Chrome 里<strong>仍然能跑</strong>。WHATWG 规范<em>明确禁止 break 旧内容</em>——这是 web 跟所有其他平台最大的不同。<strong>没有 deprecation cycle, 只有 "永远渲染"</strong>。</> },
    en: { title: <>Backward compat is a rule, not a preference</>, desc: <>1991 HTML still <strong>renders in 2026 Chrome</strong>. The WHATWG spec <em>explicitly forbids breaking old content</em> — the deepest difference between the web and every other platform. <strong>No deprecation cycle, only "renders forever"</strong>.</> },
    code: <><span className="cl-c">// info.cern.ch (1991) — still loads</span>{'\n'}<span className="cl-c">// no IE6 → Edge migration tax for HTML</span></>,
  },
  {
    icon: '⚛',
    zh: { title: <>Web Components — 框架-less 的真路径</>, desc: <>2014 specced, 2023 SSR 补齐 (declarative shadow DOM)。<strong>跨框架可复用</strong>: 一个 <code>&lt;x-rating&gt;</code> 同时在 React / Vue / 原生 HTML 项目里都能用。<em>从绑死 React 走出来的真出口</em>。</> },
    en: { title: <>Web Components — the framework-less escape hatch</>, desc: <>Specced in 2014, completed for SSR in 2023 (declarative shadow DOM). <strong>Cross-framework reusable</strong>: one <code>&lt;x-rating&gt;</code> runs in React, Vue and plain HTML alike. <em>The real exit ramp from React lock-in</em>.</> },
    code: <><span className="cl-tag">&lt;x-rating</span> <span className="cl-attr">value</span>=<span className="cl-s">"4.5"</span><span className="cl-tag">&gt;&lt;/x-rating&gt;</span>{'\n'}<span className="cl-c">// works in any framework</span></>,
  },
  {
    icon: '◇',
    zh: { title: <>microdata / JSON-LD — 机器可读 web</>, desc: <>HTML <strong>不只给人看</strong>: <code>itemscope</code> / <code>itemprop</code> 让 Google 抓 schema.org; JSON-LD 里嵌 <code>&lt;script type="application/ld+json"&gt;</code>。<em>AI 抓 web 时代</em>, 这层语义价值反而比 2015 还高。</> },
    en: { title: <>microdata / JSON-LD — machine-readable web</>, desc: <>HTML <strong>isn't only for humans</strong>: <code>itemscope</code> / <code>itemprop</code> let Google parse schema.org; JSON-LD ships inside <code>&lt;script type="application/ld+json"&gt;</code>. <em>In the AI-crawling era</em>, this semantic layer matters more than it did in 2015.</> },
    code: <><span className="cl-tag">&lt;script</span> <span className="cl-attr">type</span>=<span className="cl-s">"application/ld+json"</span><span className="cl-tag">&gt;</span>{'\n'}{'{'} <span className="cl-attr">"@type"</span>: <span className="cl-s">"Article"</span>, <span className="cl-attr">"headline"</span>: <span className="cl-s">"…"</span> {'}'}{'\n'}<span className="cl-tag">&lt;/script&gt;</span></>,
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
    href: 'https://html.spec.whatwg.org/', highlight: true,
    zhName: 'WHATWG', enName: 'WHATWG',
    zhNote: 'HTML Living Standard', enNote: 'HTML Living Standard',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><path d="M22 32 H38 L42 60 L50 32 H56 L64 60 L68 32 H84 L72 78 H60 L52 50 L44 78 H32 Z" fill="#E34F26"/></svg>,
  },
  {
    href: 'https://www.w3.org/', highlight: true,
    zhName: 'W3C', enName: 'W3C',
    zhNote: '同 web 的标准伙伴', enNote: 'Sibling standards body',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#005A9C"/><text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="700" fontFamily="monospace">W3C</text></svg>,
  },
  {
    href: 'https://developer.mozilla.org/en-US/docs/Web/HTML', highlight: true,
    zhName: 'MDN', enName: 'MDN',
    zhNote: 'HTML 文档的事实标准', enNote: 'De-facto HTML docs',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#000"/><path d="M20 30 L20 70 L30 70 L30 50 L40 70 L50 70 L50 30 L40 30 L40 56 L30 36 L20 36 Z M60 30 L60 70 L70 70 L70 56 L80 70 L80 30 L70 30 L70 50 L60 30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://web.dev/',
    zhName: 'web.dev', enName: 'web.dev',
    zhNote: 'Google · 现代 web 最佳实践', enNote: 'Google · modern web playbook',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A73E8"/><path d="M18 36 L30 70 L40 50 L50 70 L60 50 L70 70 L82 36" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://caniuse.com/',
    zhName: 'caniuse', enName: 'caniuse',
    zhNote: '兼容性矩阵 · 每天查', enNote: 'Compat matrix · daily lookup',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#222"/><text x="50" y="62" textAnchor="middle" fill="#5DDCAA" fontSize="38" fontWeight="700" fontFamily="monospace">?</text></svg>,
  },
  {
    href: 'https://validator.w3.org/',
    zhName: 'W3C Validator', enName: 'W3C Validator',
    zhNote: '页面合法性检查', enNote: 'Markup conformance checker',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><path d="M28 50 L44 66 L74 32" stroke="#5DDCAA" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://wave.webaim.org/',
    zhName: 'WAVE', enName: 'WAVE',
    zhNote: '可访问性扫描', enNote: 'Accessibility audit tool',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1F1F1F"/><path d="M16 60 Q30 30 50 60 T84 60" stroke="#FFB347" strokeWidth="5" fill="none" strokeLinecap="round"/><circle cx="50" cy="38" r="6" fill="#FFB347"/></svg>,
  },
  {
    href: 'https://www.chromium.org/blink/',
    zhName: 'Blink', enName: 'Blink',
    zhNote: 'Chrome / Edge 渲染引擎', enNote: 'Chrome / Edge engine',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><circle cx="50" cy="50" r="22" fill="none" stroke="#4285F4" strokeWidth="4"/><line x1="50" y1="28" x2="50" y2="50" stroke="#4285F4" strokeWidth="4" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://webkit.org/',
    zhName: 'WebKit', enName: 'WebKit',
    zhNote: 'Safari · Apple 渲染引擎', enNote: 'Safari · Apple engine',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><circle cx="50" cy="50" r="22" fill="none" stroke="#46AFE3" strokeWidth="4"/><path d="M50 28 A22 22 0 0 1 72 50" stroke="#46AFE3" strokeWidth="4" fill="none"/></svg>,
  },
  {
    href: 'https://hg.mozilla.org/mozilla-central/',
    zhName: 'Gecko', enName: 'Gecko',
    zhNote: 'Firefox · Mozilla 引擎', enNote: 'Firefox · Mozilla engine',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><path d="M50 22 C70 30 76 60 50 78 C24 60 30 30 50 22 Z" fill="none" stroke="#FF7A52" strokeWidth="4" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://html5test.co/',
    zhName: 'HTML5 Test', enName: 'HTML5 Test',
    zhNote: '功能支持评分', enNote: 'Feature support score',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0703"/><path d="M28 22 L72 22 L66 78 L50 84 L34 78 Z" fill="none" stroke="#E34F26" strokeWidth="4" strokeLinejoin="round"/><text x="50" y="62" textAnchor="middle" fill="#E34F26" fontSize="22" fontWeight="700" fontFamily="monospace">5</text></svg>,
  },
  {
    href: 'https://github.com/whatwg/html',
    zhName: 'whatwg/html', enName: 'whatwg/html',
    zhNote: '规范源, 持续开发中', enNote: 'Living spec source repo',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><path d="M50 18 C32 18 18 32 18 50 C18 64 27 76 40 80 C42 80 43 79 43 77 V70 C32 72 30 65 30 65 C28 60 26 59 26 59 C22 56 26 56 26 56 C30 56 32 60 32 60 C36 66 42 64 44 63 C44 60 46 58 47 57 C36 56 26 52 26 36 C26 32 28 28 32 25 C32 24 30 21 32 16 C32 16 36 16 43 21 C46 20 51 20 56 21 C63 16 67 16 67 16 C69 21 67 24 67 25 C71 28 73 32 73 36 C73 52 63 56 52 57 C54 58 56 61 56 65 V77 C56 79 57 80 59 80 C72 76 81 64 81 50 C81 32 67 18 50 18 Z" fill="#fff"/></svg>,
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
    tag: <>HOT · 2024+</>, hot: true, big: true,
    zh: {
      title: <>HTML 反吞 JS — 平台主旋律</>,
      body: (<>
        <p>2024 年后 HTML 加的几乎每样东西都是<strong>"以前必须写 JS 的事, 现在 1 个属性搞定"</strong>: popover、anchor positioning、view transitions、<code>&lt;dialog&gt;</code>、<code>&lt;selectlist&gt;</code>、scroll-driven animations。<em>30 年来第一次, HTML / CSS 的边界在主动外推</em>。</p>
        <p>结论: 2026 年起新页面要先问<em>"这个有没有原生 HTML 做"</em>, 再去引第三方库。<strong>React 时代的"重头自己写"心态对 2026 是负优化</strong>。</p>
      </>),
    },
    en: {
      title: <>HTML re-absorbs JS — the platform theme</>,
      body: (<>
        <p>Almost everything HTML has added since 2024 takes the form <strong>"a thing you used to need JS for, now an attribute"</strong>: popover, anchor positioning, view transitions, <code>&lt;dialog&gt;</code>, <code>&lt;selectlist&gt;</code>, scroll-driven animations. <em>For the first time in 30 years, the HTML/CSS boundary is pushing outward</em>.</p>
        <p>Practical takeaway: in 2026 new pages should first ask <em>"is there a native HTML feature for this?"</em> before pulling in a library. <strong>The React-era "write it all yourself" reflex is a regression here</strong>.</p>
      </>),
    },
  },
  {
    tag: 'STYLEABLE FORMS',
    zh: { title: <><code>&lt;selectlist&gt;</code> 全平台</>, body: <><p>2025 在 Chrome 落地, Safari / Firefox 跟进中。原生可完全样式化的下拉——<em>25 年来第一次 <code>&lt;select&gt;</code> 接受 CSS</em>。这之后, "<strong>用 div 重写下拉</strong>"这件事的 UI 库会大量退潮。</p></> },
    en: { title: <><code>&lt;selectlist&gt;</code> goes cross-engine</>, body: <><p>Shipped in Chrome in 2025, Safari and Firefox in progress. A fully styleable native dropdown — <em>the first time in 25 years that <code>&lt;select&gt;</code> accepts CSS</em>. After this, the wave of <strong>"div-based custom selects"</strong> in UI libraries will recede hard.</p></> },
  },
  {
    tag: 'ANCHOR',
    zh: { title: <>Anchor Positioning 2.0</>, body: <><p>2025 Chrome 落地, 2026 跨引擎进行中。<strong>popover / tooltip 自动跟元素</strong>, 不靠 JS 算位置, 不再 z-index 战争。<em>Floating UI、Popper.js 之类库将逐步退场</em>——它们 5 年前的存在理由消失了。</p></> },
    en: { title: <>Anchor Positioning 2.0</>, body: <><p>Chrome shipped it in 2025; cross-engine convergence is in progress for 2026. <strong>Popovers and tooltips track their anchor automatically</strong> — no JS positioning, no z-index battles. <em>Floating UI, Popper.js and friends will gradually fade</em> — the reason they existed five years ago has gone away.</p></> },
  },
  {
    tag: 'VIEW TRANSITIONS',
    zh: { title: <>跨页 View Transitions</>, body: <><p>2024 同页 view transitions 已经全平台; 2025+ 重点在<strong>跨文档导航 (MPA)</strong>——传统多页站第一次也能拿到 SPA 那种 fade/morph 动画, 不靠 router 框架。<em>SPA 的存在理由再被削一刀</em>。</p></> },
    en: { title: <>Cross-document view transitions</>, body: <><p>Same-document view transitions went cross-browser in 2024; 2025+ focuses on <strong>cross-document (MPA) navigation</strong> — classic multi-page sites get SPA-grade fade/morph transitions without a router framework. <em>Another reason for SPAs to exist gets carved away</em>.</p></> },
  },
];

export default function HtmlIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'HTML : 不是编程语言, 但每个 UI 都从这里开始 — 1989→2026'
      : 'HTML : not a programming language, but every UI starts here — 1989→2026';
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .compare-col, .cmp-table tr, .ts-card, .tag-card, .live-demo-col, .bwars-row, .spotlight, .ai-takeaway, .quote-block'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.tag-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.bwars-row').forEach((el, i) => { el.style.transitionDelay = `${i * 80}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--html-bright)' : '';
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
      <div ref={rootRef} className="html-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="ht-nav" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF7A52" />
                  <stop offset="100%" stopColor="#8A2C0F" />
                </linearGradient>
              </defs>
              <path d="M28 24 L228 24 L210 220 L128 244 L46 220 Z" fill="url(#ht-nav)" />
              <text x="128" y="148" textAnchor="middle" fontSize="84" fontWeight="700" fontFamily="'Cascadia Code', monospace" fill="#fff">{'</>'}</text>
            </svg>
            <span>HTML</span>
            <span className="nav-tag"><L zh=": markup, not code" en=": markup, not code" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#tags"><L zh="标签史" en="Tag Timeline" /></a></li>
            <li><a href="#system"><L zh="表面积" en="Surface" /></a></li>
            <li><a href="#demo"><L zh="语义演示" en="Live Demo" /></a></li>
            <li><a href="#wars"><L zh="浏览器战争" en="Browser Wars" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs CSS/JS" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1989 — 2026 · WHATWG Living Standard · Tim Berners-Lee · markup, not a programming language</div>
            <h1 className="hero-title">
              <span className="hero-name">HTML</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">{'<markup/>'}</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>HTML 不是编程语言, 是<em>标记语言</em></strong>——它没有变量、没有循环、不图灵完备。但 <strong>web 上每一个 UI 都从这里开始</strong>: 1991 年 TBL 在 CERN 部署第一个网站, 2026 年 popover / dialog / view transitions 仍在主动外推。<em>35 岁, 还在进化, 还在反吞 JS</em>。</>}
                en={<><strong>HTML isn't a programming language — it's <em>markup</em></strong>: no variables, no loops, not Turing-complete. But <strong>every UI on the web begins here</strong>: from TBL's first website at CERN in 1991 to popover / dialog / view transitions still pushing the platform outward in 2026. <em>Thirty-five years old, still evolving, still re-absorbing JS</em>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1989<small></small></span>
                <span className="stat-label"><L zh={<>TBL CERN 提案<br /><em>Information Management</em></>} en={<>TBL's CERN proposal<br /><em>Information Management</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">1991<small>·08·06</small></span>
                <span className="stat-label"><L zh={<>第一个网站<br /><em>info.cern.ch · 22 个标签</em></>} en={<>First website<br /><em>info.cern.ch · 22 tags</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2019<small></small></span>
                <span className="stat-label"><L zh={<>WHATWG 接管 HTML<br /><em>W3C 投降 · Living Standard</em></>} en={<>WHATWG takes HTML<br /><em>W3C surrenders · Living Standard</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">5B<small>+</small></span>
                <span className="stat-label"><L zh={<>仍在运行的 HTML 文档<br /><em>web 的物质底层</em></>} en={<>live HTML documents<br /><em>the web's physical substrate</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {HTML_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">{'<dialog>'}</span>
              <span className="float f2">{'<canvas>'}</span>
              <span className="float f3">popover</span>
              <span className="float f4">{'<picture srcset>'}</span>
              <span className="float f5">role="button"</span>
              <span className="float f6">Living Standard</span>
              <span className="float f7">{'<details>'}</span>
              <span className="float f8">{'<template>'}</span>
              <span className="float f9">view-transition-name</span>
              <span className="float f10">{'<x-rating>'}</span>
              <span className="float f11">{'<form method>'}</span>
              <span className="float f12">aria-expanded</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>HTML</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>HTML = <strong>HyperText Markup Language</strong>。<em>标记语言</em>——告诉浏览器"这块是<strong>什么</strong>" (标题 / 段落 / 链接), 不告诉它"<strong>怎么做</strong>"。<strong>不是编程语言</strong>: 没有变量、表达式、控制流、函数; 不图灵完备。但<em>每个 web UI 都从它开始</em>——CSS 说"怎么样", JS 说"怎么动", HTML 说"是什么"。</>}
                  en={<>HTML = <strong>HyperText Markup Language</strong>. A <em>markup</em> language — it tells the browser <strong>what</strong> a chunk is (heading / paragraph / link), not <strong>how to do</strong> anything. It is <strong>not a programming language</strong>: no variables, expressions, control flow or functions; not Turing-complete. But <em>every web UI starts here</em> — CSS handles "how it looks," JS handles "how it moves," HTML handles "what it is."</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="不是编程语言" en="Not a programming language" />, tag: 'markup', p: <L zh={<>无变量、无循环、无函数, 不图灵完备。<em>不能"运行 HTML"</em>; 它是<strong>声明性结构描述</strong>, 由浏览器解析成 DOM 后才被 CSS / JS 操作。这一点和 XML / Markdown / JSON 同源。</>} en={<>No variables, loops, or functions; not Turing-complete. You <em>don't "run HTML"</em> — it's a <strong>declarative structural description</strong> parsed into a DOM, then operated on by CSS and JS. The same family as XML / Markdown / JSON.</>} /> },
                { h: <L zh="Living Standard" en="Living Standard" />, tag: 'whatwg', p: <L zh={<>2019 起<strong>规范只在 WHATWG</strong> (Apple / Mozilla / Google / Microsoft 共管), 不再发版本号。<em>"HTML5" 是历史标签, 2026 实际叫"HTML"或"Living Standard"</em>。spec 每天都在 PR 进化。</>} en={<>Since 2019 the <strong>spec lives only at WHATWG</strong> (jointly run by Apple, Mozilla, Google, Microsoft) — no more version numbers. <em>"HTML5" is a historical label; in 2026 the spec is just "HTML" or "the Living Standard"</em>. PRs land daily.</>} /> },
                { h: <L zh="向后兼容是法则" en="Backward compat as a rule" />, tag: 'compat', p: <L zh={<><strong>1991 年的 HTML 在 2026 浏览器里仍然渲染</strong>。WHATWG 规范明确禁止 break 旧内容——这是 web 跟所有其他平台<em>结构性</em>的不同。没有 deprecation cycle, 只有"永远渲染"。</>} en={<><strong>1991 HTML still renders in a 2026 browser</strong>. The WHATWG spec explicitly forbids breaking old content — a <em>structural</em> difference between the web and every other platform. No deprecation cycle, only "renders forever."</>} /> },
                { h: <L zh="三件套之一" en="One-third of the triad" />, tag: 'web', p: <L zh={<>HTML / CSS / JS 是 web 的三角支柱。HTML = 结构, CSS (<a href="/code/language/css">/code/css</a>) = 表现, JS (<a href="/code/language/javascript">/code/javascript</a>) = 行为。<em>三者解耦是 1999 HTML 4.01 之后的设计共识</em>。</>} en={<>HTML / CSS / JS are the web's three-legged stool. HTML = structure, CSS (<a href="/code/language/css">/code/css</a>) = presentation, JS (<a href="/code/language/javascript">/code/javascript</a>) = behaviour. <em>Decoupling the three has been the design consensus since HTML 4.01 in 1999</em>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">first-page.html</span><span className="lang-tag js">1991</span></div>
                <pre className="code"><code>
                  <span className="cl-tag">&lt;TITLE&gt;</span>The WorldWideWeb project<span className="cl-tag">&lt;/TITLE&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;NEXTID</span> <span className="cl-attr">N</span>=<span className="cl-s">"55"</span><span className="cl-tag">&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;H1&gt;</span>World Wide Web<span className="cl-tag">&lt;/H1&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;A</span> <span className="cl-attr">NAME</span>=<span className="cl-s">"0"</span><span className="cl-tag">&gt;</span>The WorldWideWeb (W3) is a wide-area{'\n'}
                  hypermedia<span className="cl-tag">&lt;/A&gt;</span> information retrieval{'\n'}
                  initiative aiming to give universal{'\n'}
                  access to a large universe of documents.{'\n\n'}
                  <span className="cl-c"><L zh="# 22 个标签 · 大写 · 无 CSS · 无 JS" en="# 22 tags · uppercase · no CSS · no JS" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 2026 Chrome 打开仍然能渲染" en="# still renders in 2026 Chrome" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">modern-page.html</span><span className="lang-tag ts">2026</span></div>
                <pre className="code"><code>
                  <span className="cl-tag">&lt;!DOCTYPE</span> html<span className="cl-tag">&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;html</span> <span className="cl-attr">lang</span>=<span className="cl-s">"en"</span><span className="cl-tag">&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;head&gt;</span>{'\n'}
                  {'  '}<span className="cl-tag">&lt;meta</span> <span className="cl-attr">charset</span>=<span className="cl-s">"utf-8"</span><span className="cl-tag">&gt;</span>{'\n'}
                  {'  '}<span className="cl-tag">&lt;meta</span> <span className="cl-attr">name</span>=<span className="cl-s">"viewport"</span>{'\n'}
                  {'        '}<span className="cl-attr">content</span>=<span className="cl-s">"width=device-width"</span><span className="cl-tag">&gt;</span>{'\n'}
                  {'  '}<span className="cl-tag">&lt;title&gt;</span>HTML in 2026<span className="cl-tag">&lt;/title&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;/head&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;body&gt;</span>{'\n'}
                  {'  '}<span className="cl-tag">&lt;article&gt;</span>{'\n'}
                  {'    '}<span className="cl-tag">&lt;h1&gt;</span>HTML in 2026<span className="cl-tag">&lt;/h1&gt;</span>{'\n'}
                  {'    '}<span className="cl-tag">&lt;button</span> <span className="cl-attr">popovertarget</span>=<span className="cl-s">"m"</span><span className="cl-tag">&gt;</span>menu<span className="cl-tag">&lt;/button&gt;</span>{'\n'}
                  {'    '}<span className="cl-tag">&lt;div</span> <span className="cl-attr">id</span>=<span className="cl-s">"m"</span> <span className="cl-attr">popover</span><span className="cl-tag">&gt;</span>...<span className="cl-tag">&lt;/div&gt;</span>{'\n'}
                  {'  '}<span className="cl-tag">&lt;/article&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;/body&gt;</span>{'\n'}
                  <span className="cl-tag">&lt;/html&gt;</span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 1989 → 2026</code></h2>
              <p className="sec-desc"><L
                zh={<>HTML 的故事是 4 段叙事: <strong>诞生</strong> (1989-1995) → <strong>W3C 黄金期到 XHTML 弯路</strong> (1995-2008) → <strong>HTML5 + 浏览器战争</strong> (2008-2019) → <strong>WHATWG Living Standard + 反吞 JS</strong> (2019-2026)。</>}
                en={<>HTML's story breaks into four arcs: <strong>birth</strong> (1989–1995) → <strong>the W3C era, ending in the XHTML detour</strong> (1995–2008) → <strong>HTML5 + the browser wars</strong> (2008–2019) → <strong>WHATWG Living Standard + re-absorbing JS</strong> (2019–2026).</>}
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

          {/* 03 Tags through history */}
          <section className="section" id="tags">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="标签的演化" en="Tags Through History" /> <code>: TagTimeline</code></h2>
              <p className="sec-desc"><L
                zh={<>挑 14 个标签按出现年份排, 看 HTML 从<strong>"22 个标签的超文本"</strong>到<strong>"2024 popover 属性"</strong>这 35 年增量。<em>每个标签都对应一段产业史</em>。</>}
                en={<>Fourteen tags arranged by introduction year — the 35-year arc from <strong>"22 tags of hypertext"</strong> to <strong>"2024 popover attribute"</strong>. <em>Each tag carries a slice of industry history</em>.</>}
              /></p>
            </header>

            <div className="tags-grid">
              {TAGS_TIMELINE.map((t, i) => (
                <div className="tag-card" key={i}>
                  <div className="tag-card-yr">{t.year}</div>
                  <div className="tag-card-tag">tag</div>
                  <code>{t.tag}</code>
                  <p>{lang === 'zh' ? t.zhDesc : t.enDesc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 04 HTML5 surface area */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="HTML5 表面积" en="HTML5 Surface Area" /> <code>: PlatformAPI</code></h2>
              <p className="sec-desc"><L
                zh={<>"HTML" 这个词在 2026 早就不只是标签——它带上了 <strong>HTML5 时代的全部 API</strong>: canvas / 媒体 / dialog / details / custom elements / popover / ARIA。下面 8 张卡是 web UI 工程师每天都在用的<em>原生</em>表面。</>}
                en={<>By 2026 "HTML" means far more than tags — it carries the full <strong>HTML5-era API surface</strong>: canvas, media, dialog, details, custom elements, popover, ARIA. The eight cards below are the <em>native</em> surface web-UI engineers touch every day.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {SURFACE_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>语义 vs ARIA — 优先级清楚</>} en={<>Semantics vs ARIA — clear priority</>} /></h3>
                <p><L
                  zh={<>"5 大 ARIA 规则"<strong>第一条</strong>就是<em>"能用原生标签别加 ARIA"</em>。<code>&lt;button&gt;</code> 自带键盘 / 焦点 / 可访问名; <code>&lt;div role="button" tabindex="0"&gt;</code> 等价但需要 3 个属性。<em>ARIA 是补丁层, 不是结构层</em>。</>}
                  en={<>The first of the "5 rules of ARIA" is literally <em>"don't add ARIA if a native element does it"</em>. <code>&lt;button&gt;</code> brings keyboard, focus and an accessible name for free; <code>&lt;div role="button" tabindex="0"&gt;</code> is equivalent only after three attributes. <em>ARIA is a patch layer, not a structural one</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>第一条 ARIA 规则: 别用 ARIA。 — W3C ARIA Authoring Practices</>}
                  en={<>The first rule of ARIA is: don't use ARIA. — W3C ARIA Authoring Practices</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 05 Live semantic demo */}
          <section className="section" id="demo">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="语义 vs Div Soup" en="Semantic vs Div Soup" /> <code>: LiveDemo</code></h2>
              <p className="sec-desc"><L
                zh={<>这两块视觉上几乎一样, 但<strong>HTML 源大相径庭</strong>。左边屏幕阅读器读出来是<em>"文章, 标题, 时间, 导航, ..."</em>; 右边只读出<em>"section, section, ..."</em>——<strong>语义到语义零之间的差</strong>。这是真渲染, 不是截图。</>}
                en={<>The two boxes look almost identical, but the <strong>HTML behind them is wildly different</strong>. A screen reader reads the left as <em>"article, heading, time, navigation, ..."</em> and the right as <em>"section, section, ..."</em> — the gap between <strong>semantics and zero semantics</strong>. Live-rendered, not screenshots.</>}
              /></p>
            </header>

            <div className="live-demo">
              <div className="live-demo-col">
                <div className="live-demo-h">
                  <span className="dot dot-ok" />
                  <span>{lang === 'zh' ? DEMO_SEMANTIC.zhTitle : DEMO_SEMANTIC.enTitle}</span>
                  <em>{lang === 'zh' ? DEMO_SEMANTIC.zhTag : DEMO_SEMANTIC.enTag}</em>
                </div>
                <pre className="live-demo-src">{DEMO_SEMANTIC.src}</pre>
                <div className="live-demo-rendered">{DEMO_SEMANTIC.rendered}</div>
              </div>
              <div className="live-demo-col">
                <div className="live-demo-h">
                  <span className="dot dot-warn" />
                  <span>{lang === 'zh' ? DEMO_SOUP.zhTitle : DEMO_SOUP.enTitle}</span>
                  <em>{lang === 'zh' ? DEMO_SOUP.zhTag : DEMO_SOUP.enTag}</em>
                </div>
                <pre className="live-demo-src">{DEMO_SOUP.src}</pre>
                <div className="live-demo-rendered">{DEMO_SOUP.rendered}</div>
              </div>
            </div>
          </section>

          {/* 06 Browser Wars chart */}
          <section className="section section-ai" id="wars">
            <header className="sec-head">
              <span className="sec-num ai-num">06</span>
              <h2 className="sec-title"><L zh="浏览器战争" en="The Browser Wars" /> <code>: 1996 → 2026</code></h2>
              <p className="sec-desc"><L
                zh={<>HTML 的演化跟浏览器市场份额绑死: <strong>谁占主流, 谁决定能用什么标签</strong>。从 1996 NN 80% → 2002 IE6 92% → 2008 Chrome 来 → 2019 W3C 投降, <em>这条曲线就是 HTML 实际的演进速度</em>。</>}
                en={<>HTML's evolution is bolted to browser market share: <strong>whoever runs the dominant engine decides which tags you can actually ship</strong>. From NN's 80% in 1996 → IE6's 92% in 2002 → Chrome's arrival in 2008 → W3C's 2019 surrender, <em>this curve is HTML's real-world evolution rate</em>.</>}
              /></p>
            </header>

            <div className="bwars">
              <h3 className="bwars-h"><L zh="桌面浏览器份额 (估算 · StatCounter / Wikipedia 综合)" en="Desktop browser share (estimated · StatCounter / Wikipedia composite)" /></h3>
              <p className="bwars-sub"><L zh="每条 = 当年 4 月全球桌面份额快照; 横轴 0—100%" en="One row = April global desktop share snapshot; x-axis 0–100%" /></p>
              {SHARE.map((row) => (
                <div className="bwars-row" key={row.year}>
                  <div className="bwars-yr">{row.year}</div>
                  <div className="bwars-bar">
                    {row.segs.map((s, i) => (
                      <div
                        key={i}
                        className={`bwars-seg ${s.cls}`}
                        style={{ width: `${s.pct}%` }}
                        title={`${s.label} ${s.pct}%`}
                      >
                        {s.pct >= 11 ? `${s.label} ${s.pct}%` : ''}
                      </div>
                    ))}
                  </div>
                  <div className="bwars-tot">100%</div>
                </div>
              ))}
              <div className="bwars-legend">
                <span><i style={{ background: '#1B7AB8' }}></i> Netscape</span>
                <span><i style={{ background: '#006AB8' }}></i> IE</span>
                <span><i style={{ background: '#E66000' }}></i> Firefox</span>
                <span><i style={{ background: '#4285F4' }}></i> Chrome</span>
                <span><i style={{ background: '#1F8DD6' }}></i> Safari</span>
                <span><i style={{ background: '#0078D4' }}></i> Edge</span>
                <span><i style={{ background: '#555' }}></i> Opera / other</span>
              </div>
            </div>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我没把 web 申请专利, 没收一分钱版税。如果它当初变成私有技术, 我们今天根本不会有它——<strong>web 是因为开放才成为 web</strong>。HTML、URL、HTTP, 这三件事我都希望<em>永远没人独占</em>。</>}
                en={<>I never patented the web. I never charged royalties. If it had been proprietary, we wouldn't have it today — <strong>the web exists because it was open</strong>. HTML, URLs, HTTP — I wanted <em>nobody to ever own them</em>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Tim Berners-Lee</span>
                <span className="quote-context"><L zh="CERN · MIT · W3C 创始人 · 2017 Turing Award · 多次访谈综合" en="CERN · MIT · founder of W3C · 2017 Turing Award · composite from interviews" /></span>
              </footer>
            </blockquote>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>浏览器战争不是 HTML 的<em>背景</em>, 是它的<strong>引擎</strong>。每一次大版本——HTML 4、HTML5、Living Standard——都对应一次份额翻转: <strong>NN 倒下、IE 解散团队、Chrome 冲开闸门、W3C 投降</strong>。<em>市场份额决定规范, 不是反过来</em>。</>}
                en={<>The browser wars aren't HTML's <em>backdrop</em> — they're its <strong>engine</strong>. Every major version (HTML 4, HTML5, Living Standard) lines up with a share inversion: <strong>NN dies, IE freezes, Chrome cracks the dam, W3C surrenders</strong>. <em>Market share drives the spec, not the other way around</em>.</>}
              /></p>
            </div>
          </section>

          {/* 07 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="为何 HTML 仍然重要" en="Why HTML Still Matters" /> <code>: WhyHTML</code></h2>
              <p className="sec-desc"><L
                zh={<>"HTML 老技术、写写就好"是大部分初级前端的误解。<strong>2026 年的 HTML 是 web 平台主动外推的边界</strong>——popover / view transitions / declarative shadow DOM 全是<em>过去 3 年才落地</em>的。下面 6 张是真正的"为什么不能绕过它"。</>}
                en={<>"HTML is legacy, ship it and move on" — the standard junior-frontend mistake. <strong>HTML in 2026 is the actively expanding edge of the web platform</strong> — popover, view transitions, declarative shadow DOM all <em>landed in the last three years</em>. Six reasons below for why it can't be bypassed.</>}
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

          {/* 08 Ecosystem */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="生态 / 工具 / 引擎" en="Ecosystem / Tools / Engines" /> <code>: WebPlatform</code></h2>
              <p className="sec-desc"><L
                zh={<>HTML 不是"一个项目"——它是<strong>规范 + 三大引擎 + 文档 + 校验 + 兼容性数据</strong>构成的平台。这 12 个是 2026 年前端日常会用到的核心节点。</>}
                en={<>HTML isn't "a project" — it's a platform composed of <strong>the spec + three engines + docs + validators + compat data</strong>. These 12 nodes are the core daily-use anchors for front-end work in 2026.</>}
              /></p>
            </header>

            <div className="logo-grid">
              {PROJECTS.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target="_blank" rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 09 vs CSS / JS */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="对比" en="vs CSS / JavaScript" /> <code>: TheTriad</code></h2>
              <p className="sec-desc"><L
                zh={<>HTML / CSS / JS 在 web 上<strong>三足分工</strong>。把同一件事放在错误的层是 web 工程最常见的错: 比如<em>用 JS 切图代替 srcset</em>、<em>用 div + role 代替 button</em>、<em>用 CSS 隐藏代替 hidden 属性</em>。</>}
                en={<>HTML / CSS / JS form the web's <strong>three-legged stool</strong>. Putting the same job in the wrong layer is the single most common web-engineering mistake: <em>swapping images in JS instead of srcset</em>; <em>using div + role instead of button</em>; <em>hiding via CSS instead of the <code>hidden</code> attribute</em>.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">HTML</th>
                  <th className="th-js">CSS</th>
                  <th className="th-sw">JavaScript</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="范畴" en="Category" />,
                    ts: <L zh="标记语言 (markup)" en="Markup language" />,
                    js: <L zh="样式语言 (style sheet)" en="Style sheet language" />,
                    sw: <L zh="编程语言 (programming)" en="Programming language" /> },
                  { k: <L zh="管什么" en="Concern" />,
                    ts: <L zh={<>"<strong>是什么</strong>"</>} en={<><strong>What</strong> it is</>} />,
                    js: <L zh={<>"<strong>怎么样</strong>"</>} en={<><strong>How</strong> it looks</>} />,
                    sw: <L zh={<>"<strong>怎么动</strong>"</>} en={<><strong>How</strong> it behaves</>} /> },
                  { k: <L zh="出身" en="Origin" />,
                    ts: <L zh="TBL · 1989 CERN" en="TBL · 1989 CERN" />,
                    js: <L zh="Håkon Wium Lie · 1996" en="Håkon Wium Lie · 1996" />,
                    sw: <L zh="Brendan Eich · 1995 (10 天)" en="Brendan Eich · 1995 (10 days)" /> },
                  { k: <L zh="图灵完备?" en="Turing-complete?" />,
                    ts: <L zh="否" en="No" />,
                    js: <L zh={<>否 (理论上有 CSS3 Rule 110 trick, 但不是)</>} en={<>No (CSS3 Rule 110 hacks exist; doesn't count)</>} />,
                    sw: <L zh="是" en="Yes" /> },
                  { k: <L zh="解析模型" en="Parsing" />,
                    ts: <L zh={<>容错 HTML parser · <em>烂代码也渲染</em></>} en={<>Forgiving HTML parser · <em>broken markup still renders</em></>} />,
                    js: <L zh="级联 + 特异度" en="Cascade + specificity" />,
                    sw: <L zh="ECMAScript spec parser" en="ECMAScript spec parser" /> },
                  { k: <L zh="标准机构" en="Standards body" />,
                    ts: <L zh={<><strong>WHATWG</strong> (2019 后唯一)</>} en={<><strong>WHATWG</strong> (sole since 2019)</>} />,
                    js: <L zh="W3C CSSWG" en="W3C CSSWG" />,
                    sw: <L zh="TC39 (ECMA)" en="TC39 (ECMA)" /> },
                  { k: <L zh="版本号" en="Versioning" />,
                    ts: <L zh={<>无, "Living Standard"</>} en={<>None, "Living Standard"</>} />,
                    js: <L zh={<>无, modules / level-* 草案</>} en={<>None, level-* drafts</>} />,
                    sw: <L zh="年版本 (ES2024, ES2025…)" en="Year-versioned (ES2024, ES2025…)" /> },
                  { k: <L zh="向后兼容" en="Backward compat" />,
                    ts: <L zh={<><strong>规范禁止 break</strong></>} en={<><strong>Spec forbids breakage</strong></>} />,
                    js: <L zh="规范禁止 break" en="Spec forbids breakage" />,
                    sw: <L zh="规范禁止 break" en="Spec forbids breakage" /> },
                  { k: <L zh="构建工具" en="Build tooling" />,
                    ts: <L zh={<><strong>无, 直接跑</strong></>} en={<><strong>None, runs as-is</strong></>} />,
                    js: <L zh="Sass / PostCSS / Tailwind" en="Sass / PostCSS / Tailwind" />,
                    sw: <L zh="esbuild / Vite / Webpack / TS" en="esbuild / Vite / Webpack / TS" /> },
                  { k: <L zh="2024+ 趋势" en="2024+ direction" />,
                    ts: <L zh={<>反吞 JS · popover / dialog / view transitions</>} en={<>Re-absorbing JS · popover / dialog / view transitions</>} />,
                    js: <L zh="container queries · :has · nesting" en="Container queries · :has · nesting" />,
                    sw: <L zh={<>稳态 ES · 类型化 (TypeScript)</>} en={<>Stable ES · types via TypeScript</>} /> },
                  { k: <L zh="替代品 / 子集" en="Substitutes / subsets" />,
                    ts: <L zh="Markdown · MDX · JSX (编译目标)" en="Markdown · MDX · JSX (compile target)" />,
                    js: <L zh="无替代 · Tailwind 是工具不是替代" en="None · Tailwind is tooling not replacement" />,
                    sw: <L zh="TS / WASM / Dart" en="TS / WASM / Dart" /> },
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

          {/* 10 Future */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">10</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheNext5Years</code></h2>
              <p className="sec-desc"><L
                zh={<>2026 年的 HTML 不在"等下个版本"——它在<strong>主动吃 JS 的工作量</strong>。popover / anchor / view transitions / <code>&lt;selectlist&gt;</code> 这条线还会再走 3-5 年, 大量"必须用 React"的场景会回到原生。<em>这是 30 年来 HTML 第一次主动扩张</em>。</>}
                en={<>HTML in 2026 isn't "waiting for the next version" — it's <strong>actively claiming JS's workload</strong>. The popover / anchor / view transitions / <code>&lt;selectlist&gt;</code> line keeps running another 3-5 years; the "must use React" surface keeps shrinking back into the platform. <em>It's the first time in 30 years HTML is actively expanding</em>.</>}
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
                <li><a href="https://html.spec.whatwg.org/" target="_blank" rel="noopener">html.spec.whatwg.org</a></li>
                <li><a href="https://whatwg.org/" target="_blank" rel="noopener">whatwg.org</a></li>
                <li><a href="https://www.w3.org/TR/html52/" target="_blank" rel="noopener">w3.org/TR/html52</a></li>
                <li><a href="https://developer.mozilla.org/en-US/docs/Web/HTML" target="_blank" rel="noopener">MDN · HTML</a></li>
                <li><a href="https://github.com/whatwg/html" target="_blank" rel="noopener">whatwg/html (GitHub)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key Reading" /></h4>
              <ul>
                <li><a href="https://www.w3.org/History/1989/proposal.html" target="_blank" rel="noopener"><L zh="TBL 原始提案 (1989)" en="TBL's original proposal (1989)" /></a></li>
                <li><a href="https://info.cern.ch/hypertext/WWW/TheProject.html" target="_blank" rel="noopener"><L zh="第一个网站 (1991)" en="The first website (1991)" /></a></li>
                <li><a href="https://web.dev/learn/html" target="_blank" rel="noopener">web.dev/learn/html</a></li>
                <li><a href="https://www.w3.org/TR/wai-aria-practices-1.2/" target="_blank" rel="noopener">ARIA Authoring Practices</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具 / 引擎" en="Tools / Engines" /></h4>
              <ul>
                <li><a href="https://caniuse.com/" target="_blank" rel="noopener">caniuse.com</a></li>
                <li><a href="https://validator.w3.org/" target="_blank" rel="noopener">W3C Validator</a></li>
                <li><a href="https://wave.webaim.org/" target="_blank" rel="noopener">WAVE accessibility</a></li>
                <li><a href="https://www.chromium.org/blink/" target="_blank" rel="noopener">Blink (Chrome)</a></li>
                <li><a href="https://webkit.org/" target="_blank" rel="noopener">WebKit (Safari)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/css"><L zh="CSS — 表现层兄弟" en="CSS — the presentation sibling" /></a></li>
                <li><a href="/code/language/javascript"><L zh="JavaScript — 行为层兄弟" en="JavaScript — the behaviour sibling" /></a></li>
                <li><a href="/code/language/ts"><L zh="TypeScript — JS 的类型外衣" en="TypeScript — JS's type coat" /></a></li>
                <li><a href="/code/language"><L zh="返回语言索引" en="Back to language index" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{HTML_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{'<html lang="en"> <!-- not a programming language --> </html>'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
