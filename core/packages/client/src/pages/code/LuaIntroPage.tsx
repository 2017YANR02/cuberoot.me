import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './lua_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const LUA_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <radialGradient id="lu-sky" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#2C2D72" />
        <stop offset="70%" stopColor="#1A1B4E" />
        <stop offset="100%" stopColor="#0A0B22" />
      </radialGradient>
      <radialGradient id="lu-moon" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#F4ECC8" />
        <stop offset="70%" stopColor="#E8E5D7" />
        <stop offset="100%" stopColor="#B8B5A8" />
      </radialGradient>
      <radialGradient id="lu-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F4ECC8" stopOpacity=".55" />
        <stop offset="60%" stopColor="#F4ECC8" stopOpacity=".10" />
        <stop offset="100%" stopColor="#F4ECC8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="128" cy="128" r="128" fill="url(#lu-sky)" />
    {/* outer ring */}
    <circle cx="128" cy="128" r="118" fill="none" stroke="#E8E5D7" strokeOpacity=".18" strokeWidth="1.5" />
    {/* moon halo */}
    <circle cx="128" cy="128" r="92" fill="url(#lu-glow)" />
    {/* moon body */}
    <circle cx="128" cy="128" r="62" fill="url(#lu-moon)" />
    {/* crater 1 */}
    <circle cx="108" cy="112" r="8" fill="#B8B5A8" opacity=".55" />
    <circle cx="146" cy="138" r="6" fill="#B8B5A8" opacity=".45" />
    <circle cx="138" cy="106" r="4" fill="#B8B5A8" opacity=".40" />
    <circle cx="116" cy="148" r="5" fill="#B8B5A8" opacity=".40" />
    {/* small stars */}
    <circle cx="40" cy="56" r="1.6" fill="#E8E5D7" opacity=".7" />
    <circle cx="208" cy="62" r="1.2" fill="#E8E5D7" opacity=".6" />
    <circle cx="62" cy="200" r="1.4" fill="#E8E5D7" opacity=".7" />
    <circle cx="200" cy="196" r="1.6" fill="#E8E5D7" opacity=".55" />
    <circle cx="220" cy="120" r="1" fill="#E8E5D7" opacity=".6" />
    <circle cx="38" cy="148" r="1" fill="#E8E5D7" opacity=".6" />
  </svg>
);

const LUA_LOGO_NAV = (
  <svg viewBox="0 0 256 256" width="28" height="28">
    <defs>
      <radialGradient id="lu-nav-sky" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#2C2D72" />
        <stop offset="100%" stopColor="#0A0B22" />
      </radialGradient>
      <radialGradient id="lu-nav-moon" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#F4ECC8" />
        <stop offset="100%" stopColor="#B8B5A8" />
      </radialGradient>
    </defs>
    <circle cx="128" cy="128" r="128" fill="url(#lu-nav-sky)" />
    <circle cx="128" cy="128" r="64" fill="url(#lu-nav-moon)" />
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
    year: <>1993<small>·07</small></>, highlight: true,
    zh: { title: <>诞生于 PUC-Rio</>, desc: <>巴西里约热内卢的<strong>天主教大学 (PUC-Rio)</strong>, Roberto Ierusalimschy、Luiz Henrique de Figueiredo、Waldemar Celes 三人组在 Tecgraf 实验室造出 <strong>Lua 1.0</strong>。背景: 80 年代巴西<strong>禁止进口商业软件</strong>, 高校自己写工具——Lua 是这条限制的副产品。<em>moon in Portuguese</em>。</> },
    en: { title: <>Born at PUC-Rio</>, desc: <>At the <strong>Pontifical Catholic University of Rio de Janeiro</strong>'s Tecgraf lab, Roberto Ierusalimschy, Luiz Henrique de Figueiredo and Waldemar Celes ship <strong>Lua 1.0</strong>. Context: Brazil's 80s <strong>ban on imported commercial software</strong> forced universities to write their own tooling — Lua is a byproduct of that restriction. <em>"Lua" is Portuguese for moon</em>.</> },
  },
  {
    year: '1995',
    zh: { title: <>Lua 2.0 — 设计哲学定型</>, desc: <>"<strong>language as a library</strong>" 这条核心定下来: Lua <em>不试图统治你的程序</em>, 它是你 C 程序里的一个 .a 文件。配置文件、脚本钩子、内嵌求值——这些用例从此长在 Lua 的基因里。</> },
    en: { title: <>Lua 2.0 — design philosophy locks in</>, desc: <>The "<strong>language as a library</strong>" principle crystallises: Lua <em>doesn't try to own your program</em> — it's a <code>.a</code> file inside your C application. Config files, scripted hooks, embedded evaluators: these use cases are baked into Lua's DNA from here onward.</> },
  },
  {
    year: <>1996<small>·12</small></>,
    zh: { title: <>Dr. Dobb's 文章 — 走出巴西</>, desc: <>Ierusalimschy 等人在 <strong>Dr. Dobb's Journal</strong> 发文介绍 Lua, 英语圈第一次知道这门小语言。游戏开发者很快读到——这是 LucasArts / Bioware 等把 Lua 嵌进引擎的<strong>种子时刻</strong>。</> },
    en: { title: <>Dr. Dobb's article — Lua leaves Brazil</>, desc: <>The team publishes Lua in <strong>Dr. Dobb's Journal</strong>, the English-speaking world's first proper look at it. Game developers read it almost immediately — the <strong>seed moment</strong> for LucasArts, Bioware and others embedding Lua into their engines.</> },
  },
  {
    year: '2003',
    zh: { title: <>Lua 5.0 — 现代 Lua 的起点</>, desc: <>引入<strong>词法作用域 closure</strong>、<strong>coroutine</strong>、<strong>真函数式 metatable</strong>。这一版之后语言"成形"了——之后 20 年的核心几乎不动, 改的是边角。<em>许多老的 Lua 教材其实在描述 5.0</em>。</> },
    en: { title: <>Lua 5.0 — the start of modern Lua</>, desc: <>This release brings <strong>lexically-scoped closures</strong>, <strong>coroutines</strong>, and a <strong>truly functional metatable model</strong>. After 5.0 the language is "shaped" — the next 20 years touch the corners, not the core. <em>Many older Lua books are still describing 5.0</em>.</> },
  },
  {
    year: <>2004<small>·11</small></>, highlight: true,
    zh: { title: <>World of Warcraft 上线 — Lua 进千万人客户端</>, desc: <>Blizzard 把 <strong>Lua 嵌进 WoW 客户端</strong>, 整个 UI + addon 系统用 Lua 写。<strong>WoW addon</strong> 一夜让 Lua 成为<strong>世界上间接用户最多的脚本语言之一</strong>: 几千万玩家 + 几万开发者。</> },
    en: { title: <>World of Warcraft ships — Lua reaches tens of millions</>, desc: <>Blizzard embeds <strong>Lua inside the WoW client</strong>; the entire UI + addon system runs on it. <strong>WoW addons</strong> turn Lua overnight into <strong>one of the world's most-indirectly-used scripting languages</strong>: tens of millions of players, tens of thousands of addon authors.</> },
  },
  {
    year: <>2005<small>·05</small></>, highlight: true,
    zh: { title: <>LuaJIT 上线 — Mike Pall 一人作品</>, desc: <>奥地利程序员 <strong>Mike Pall</strong> 发布 <strong>LuaJIT 1.0</strong>: 给 Lua 加 trace-based JIT, 性能跨数量级提升。后续 LuaJIT 2 在数值循环上<strong>能跑赢 V8 / JVM</strong>——<em>这在脚本语言里是异常稀有的</em>。Lua 5.1 兼容这条线由此锁死。</> },
    en: { title: <>LuaJIT lands — a one-man project</>, desc: <>Austrian programmer <strong>Mike Pall</strong> releases <strong>LuaJIT 1.0</strong>: a trace-based JIT for Lua, jumping performance by orders of magnitude. LuaJIT 2 later <strong>matches or beats V8 / JVM on numeric loops</strong> — <em>extraordinarily rare for a scripting language</em>. From here on, the "Lua 5.1 compat" line is locked.</> },
  },
  {
    year: '2006',
    zh: { title: <>Lua 5.1 — 长期之锚</>, desc: <>5.1 看起来只是版本号 +0.1, 实际成了 Lua 史上<strong>影响最大的一个版本</strong>。<strong>LuaJIT 永远 5.1 兼容</strong>; OpenResty / Redis / 游戏引擎 / Roblox Luau 都钉在 5.1 ABI 上。<em>5.1 不是"老版本", 是事实标准</em>。</> },
    en: { title: <>Lua 5.1 — the long-term anchor</>, desc: <>5.1 looks like a +0.1 release; it became the <strong>most influential version</strong> in Lua's history. <strong>LuaJIT is permanently 5.1-compatible</strong>; OpenResty, Redis, game engines, and Roblox's Luau all pin themselves to the 5.1 ABI. <em>5.1 isn't "the old version" — it's the de-facto standard</em>.</> },
  },
  {
    year: '2008',
    zh: { title: <>Adobe Lightroom — Lua 写桌面 app</>, desc: <>Adobe 公开 Lightroom 的 UI 层<strong>大部分是 Lua 写的</strong> (Lightroom SDK 也是 Lua)。这是<strong>"Lua 不只是游戏脚本"</strong>最有力的早期证据——专业桌面软件能整面 ship。</> },
    en: { title: <>Adobe Lightroom — desktop apps in Lua</>, desc: <>Adobe reveals that Lightroom's UI layer is <strong>largely written in Lua</strong> (the Lightroom SDK is Lua too). This is the strongest early evidence that <strong>"Lua isn't just for game scripts"</strong> — full professional desktop software ships on it.</> },
  },
  {
    year: '2011',
    zh: { title: <>Lua 5.2 — 分叉的起点</>, desc: <>5.2 改 <code>setfenv</code>、加 <code>goto</code>、改 <code>__pairs</code>。社区<strong>分裂</strong>: LuaJIT 留 5.1, 主线走 5.2。从这刻起 "<em>Lua 5.x</em>" 不再是一个单一标签——选哪条线决定你的库生态。</> },
    en: { title: <>Lua 5.2 — the fork begins</>, desc: <>5.2 reworks <code>setfenv</code>, adds <code>goto</code>, changes <code>__pairs</code>. The community <strong>splits</strong>: LuaJIT stays on 5.1, mainline moves to 5.2. From this point on, "<em>Lua 5.x</em>" is no longer a single label — which line you pick determines your library ecosystem.</> },
  },
  {
    year: <>2011<small>·11</small></>, highlight: true,
    zh: { title: <>OpenResty 1.0 — agentzh 把 Nginx 变成 Lua 平台</>, desc: <>章亦春 (<strong>agentzh</strong>) 发布 <strong>OpenResty</strong>: Nginx + LuaJIT, 在 worker 里跑 Lua 协程。<strong>Cloudflare 边缘多年跑这一套</strong>; 国内淘宝 / B 站 / 知乎 早期网关也是。<em>Lua 第一次进"互联网基础设施"层</em>。</> },
    en: { title: <>OpenResty 1.0 — agentzh turns Nginx into a Lua platform</>, desc: <>Yichun Zhang (<strong>agentzh</strong>) releases <strong>OpenResty</strong>: Nginx plus LuaJIT, running Lua coroutines inside worker processes. <strong>Cloudflare ran this stack at the edge for years</strong>; many large Chinese sites' early gateways did too. <em>Lua's first move into "internet infrastructure"</em>.</> },
  },
  {
    year: <>2012<small>·06</small></>, highlight: true,
    zh: { title: <>Redis 2.6 — <code>EVAL</code> 让 Lua 跑进世界最大缓存</>, desc: <>antirez (Salvatore Sanfilippo) 在 Redis 2.6 加 <code>EVAL</code>, <strong>Lua 成了 Redis 内嵌的脚本语言</strong>。原子化复合操作的口子从此打开——亿万 web 后端默默调过 <code>redis.call</code>。<em>Lua 选中的原因? 嵌入轻、零依赖、行为确定</em>。</> },
    en: { title: <>Redis 2.6 — <code>EVAL</code> puts Lua inside the world's most-used cache</>, desc: <>antirez (Salvatore Sanfilippo) adds <code>EVAL</code> in Redis 2.6, making <strong>Lua the embedded scripting language of Redis</strong>. This is the open door for atomic compound operations — hundreds of millions of web back ends quietly call <code>redis.call</code>. <em>Why Lua? Tiny to embed, zero deps, deterministic</em>.</> },
  },
  {
    year: '2015',
    zh: { title: <>Lua 5.3 — 整数类型上线</>, desc: <><strong>5.3 把整数加回来</strong> (此前 Lua 只有 double)。<code>//</code>、位运算 <code>&amp; | ~ &lt;&lt;</code>、字符串打包。重要但 LuaJIT <strong>没跟</strong>——5.1 vs 5.3 的鸿沟拉得更深。</> },
    en: { title: <>Lua 5.3 — integers return</>, desc: <><strong>5.3 brings native integers back</strong> (previously Lua had only doubles). Floor-division <code>//</code>, bitwise <code>&amp; | ~ &lt;&lt;</code>, string packing. Important — but LuaJIT <strong>doesn't follow</strong>, deepening the 5.1-vs-5.3 split.</> },
  },
  {
    year: '2015',
    zh: { title: <>Mike Pall 退场公告</>, desc: <>LuaJIT 作者 Mike Pall <strong>公开宣布退出主导开发</strong>, 寻找接班人。社区震动: 一个能跟 V8 比性能的项目, <em>从头到尾几乎都是他一个人写的</em>。后续 fork (luajit2 OpenResty 维护、moonjit 等) 接力, 主线 LuaJIT 至今仍由社区维护更新。</> },
    en: { title: <>Mike Pall steps back</>, desc: <>LuaJIT's author Mike Pall <strong>publicly announces stepping away from leading development</strong>, looking for a successor. The community is shaken: a project competitive with V8 in performance was <em>written, essentially end-to-end, by one person</em>. Forks pick up the slack (OpenResty's <code>luajit2</code>, moonjit, etc.); mainline LuaJIT is still maintained by the community today.</> },
  },
  {
    year: '2017',
    zh: { title: <>Defold / Love2D 巩固独立游戏阵地</>, desc: <>King 把内部引擎 <strong>Defold</strong> 开源 (Lua 脚本); <strong>Love2D</strong> 持续被独立游戏开发者使用。加上 <strong>Garry's Mod</strong> + <strong>Factorio</strong> mod, "<em>Lua = 游戏脚本事实标准</em>"被进一步钉死。</> },
    en: { title: <>Defold / Love2D consolidate the indie-game position</>, desc: <>King open-sources its internal engine <strong>Defold</strong> (Lua-scripted); <strong>Love2D</strong> stays a fixture of indie game dev. Together with <strong>Garry's Mod</strong> and <strong>Factorio</strong> mods, "<em>Lua = de-facto game-scripting language</em>" is nailed down.</> },
  },
  {
    year: <>2019<small>·02</small></>, highlight: true,
    zh: { title: <>Roblox 公开 Luau — Lua 的 typed fork</>, desc: <>Roblox 把内部 Lua fork 改名 <strong>Luau</strong> 并<strong>开源</strong>: 加渐进类型、加沙盒、移除 <code>loadstring</code> 等危险操作。<strong>Roblox 日活 ~7000 万玩家, 数百万开发者</strong>——Luau 是<strong>世界上活跃用户数最大的 Lua 方言</strong>。</> },
    en: { title: <>Roblox open-sources Luau — typed Lua fork</>, desc: <>Roblox renames its internal Lua fork to <strong>Luau</strong> and <strong>open-sources it</strong>: gradual typing, sandboxing, removal of dangerous features like <code>loadstring</code>. <strong>Roblox has ~70M daily players and millions of developers</strong> — Luau is the <strong>most-active Lua dialect on Earth by user count</strong>.</> },
  },
  {
    year: <>2019<small>·11</small></>, highlight: true,
    zh: { title: <>Neovim 0.4 — Lua 成一等公民</>, desc: <>Neovim (Vim 的 2014 fork) 在 0.4 放出 <strong>嵌入 Lua 5.1</strong>。Bram Moolenaar 都承认过 "<em>VimL 设计糟</em>"; Neovim 团队用 LuaJIT 把这页翻过去。从此 <strong>nvim 配置 / 插件首选 Lua</strong>, VimL → Lua 的迁移浪潮启动。</> },
    en: { title: <>Neovim 0.4 — Lua becomes first-class</>, desc: <>Neovim (the 2014 Vim fork) ships <strong>embedded Lua 5.1</strong> in 0.4. Even Bram Moolenaar admitted "<em>VimL was a bad design</em>"; the Neovim team uses LuaJIT to turn the page. From here on <strong>nvim configs and plugins prefer Lua</strong>, and the VimL → Lua migration takes off.</> },
  },
  {
    year: <>2020<small>·06</small></>,
    zh: { title: <>Lua 5.4 — to-be-closed 变量</>, desc: <>5.4 加 <strong><code>&lt;close&gt;</code> 属性</strong> (RAII 风作用域结束自动 close)、改 GC 为分代式。语言层第一次有"<em>资源管理</em>"语义。但 LuaJIT <strong>仍然</strong>只跟 5.1——分裂继续。</> },
    en: { title: <>Lua 5.4 — to-be-closed variables</>, desc: <>5.4 adds <strong><code>&lt;close&gt;</code> attributes</strong> (RAII-style auto-close at scope end) and switches to a generational GC. The first time Lua has language-level <em>resource management</em> semantics. But LuaJIT <strong>still</strong> stays on 5.1 — the split continues.</> },
  },
  {
    year: <>2020<small>·07</small></>,
    zh: { title: <>Neovim 0.5 + lua-first 插件浪潮</>, desc: <>0.5 放出完整 <code>vim.api</code> Lua 表面, <strong>telescope.nvim</strong> / <strong>nvim-treesitter</strong> / <strong>lazy.nvim</strong> 这一批 Lua-only 插件冒出来。两年内 Neovim 插件主流变成<strong>纯 Lua</strong>。</> },
    en: { title: <>Neovim 0.5 + the lua-first plugin wave</>, desc: <>0.5 ships the full <code>vim.api</code> Lua surface. <strong>telescope.nvim</strong>, <strong>nvim-treesitter</strong>, <strong>lazy.nvim</strong> — a wave of Lua-only plugins emerges. Within two years, mainstream Neovim plugins are <strong>pure Lua</strong>.</> },
  },
  {
    year: <>2022<small>·04</small></>,
    zh: { title: <>Redis 7.0 — Functions 上线, EVAL 被边缘化讨论</>, desc: <>Redis 加 <strong>Functions</strong> (持久化 Lua 函数), 一度有讨论"<em>EVAL 何时弃用</em>"。社区反弹强烈——Lua 早已嵌进无数生产代码。最终 <strong>Redis 7.4 把 Lua 重新定位为一等公民</strong>, 跟 Functions 并存。</> },
    en: { title: <>Redis 7.0 — Functions land, EVAL deprecation chatter</>, desc: <>Redis adds <strong>Functions</strong> (persistent Lua functions); there's brief discussion of "<em>when does EVAL get deprecated</em>." Community pushback is strong — Lua is already embedded in countless production codebases. <strong>Redis 7.4 ends up restoring Lua to first-class status</strong>, side by side with Functions.</> },
  },
  {
    year: <>2023<small>·05</small></>,
    zh: { title: <>Lua 5.4.6 + LuaJIT 2.1 final release candidates</>, desc: <>主线 Lua 进入 <strong>"<em>小修小补</em>"</strong> 稳态; LuaJIT 2.1 终于打出正式 RC, 性能微调。Lua 在 2023 年是<strong>"成熟到边边都收拾完"</strong>的状态——这是嵌入式语言<strong>最幸福的形态</strong>。</> },
    en: { title: <>Lua 5.4.6 + LuaJIT 2.1 final RCs</>, desc: <>Mainline Lua enters its <strong>"<em>small polishing</em>"</strong> steady state; LuaJIT 2.1 finally cuts an official RC with performance fine-tuning. In 2023, Lua is in a <strong>"so mature even the corners are tidied"</strong> shape — the <strong>happiest possible state</strong> for an embedded language.</> },
  },
  {
    year: '2026',
    zh: { title: <>33 岁 — 在数千万嵌入位上跑着</>, desc: <>2026 年的 Lua 现状: 主线 5.4 稳定; LuaJIT 2.1 由社区 + OpenResty fork 维护; Luau 是<strong>最活跃方言</strong> (Roblox 数千万日活); Neovim 是 Lua 的<strong>新身份门面</strong>; Redis / OpenResty / WoW / Factorio / Lightroom 老阵地不动。<strong>Lua 不抢风头, 它住在每个东西里面</strong>。</> },
    en: { title: <>33 years in — running in tens of millions of embedded slots</>, desc: <>Lua in 2026: mainline 5.4 stable; LuaJIT 2.1 maintained by community + OpenResty's fork; Luau is the <strong>most active dialect</strong> (Roblox's tens of millions of dailies); Neovim is Lua's <strong>new public face</strong>; Redis / OpenResty / WoW / Factorio / Lightroom keep humming. <strong>Lua doesn't seek the spotlight — it lives inside everything else</strong>.</> },
  },
];

interface MoCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const LANG_CARDS: MoCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>table</code> — <strong>唯一</strong>的数据结构</>, desc: <>Lua 只有一种复合类型: <strong>table</strong>。它<strong>同时</strong>是数组、字典、对象、namespace、module。<em>把全部精力压在一个数据结构上, 优化得很扎实</em>。</> },
    en: { title: <><code>table</code> — the <strong>only</strong> data structure</>, desc: <>Lua has exactly one composite type: <strong>table</strong>. It is <strong>simultaneously</strong> array, dict, object, namespace, and module. <em>Pouring all design effort into one data structure pays off — it's polished hard</em>.</> },
    code: (
      <code>
        <span className="cl-k">local</span> <span className="cl-v">t</span> = {'{'}{'\n'}
        {'    '}<span className="cl-c">-- array part</span>{'\n'}
        {'    '}<span className="cl-s">"hello"</span>, <span className="cl-s">"world"</span>,{'\n'}
        {'    '}<span className="cl-c">-- hash part</span>{'\n'}
        {'    '}<span className="cl-prop">name</span> = <span className="cl-s">"lua"</span>,{'\n'}
        {'    '}<span className="cl-prop">year</span> = <span className="cl-n">1993</span>,{'\n'}
        {'}'}{'\n\n'}
        <span className="cl-fn">print</span>(<span className="cl-v">t</span>[<span className="cl-n">1</span>], <span className="cl-v">t</span>.name)
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>metatable</code> — 一切高级抽象的根</>, desc: <>OOP、运算符重载、读写代理、继承——全部由 <strong>metatable</strong> 一套机制实现。<code>__index</code>、<code>__newindex</code>、<code>__add</code> 等元方法是 Lua 的<strong>底层魔法</strong>。</> },
    en: { title: <><code>metatable</code> — the root of every abstraction</>, desc: <>OOP, operator overloading, read/write proxies, inheritance — all done by <strong>metatables</strong>. <code>__index</code>, <code>__newindex</code>, <code>__add</code> and friends are Lua's <strong>underlying magic</strong>.</> },
    code: (
      <code>
        <span className="cl-k">local</span> <span className="cl-v">Vec</span> = {'{}'}{'\n'}
        <span className="cl-v">Vec</span>.<span className="cl-prop">__index</span> = <span className="cl-v">Vec</span>{'\n'}
        <span className="cl-v">Vec</span>.<span className="cl-prop">__add</span> = <span className="cl-k">function</span>(<span className="cl-v">a</span>,<span className="cl-v">b</span>){'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-fn">setmetatable</span>({'{'}<span className="cl-v">a.x</span>+<span className="cl-v">b.x</span>{'}'}, <span className="cl-v">Vec</span>){'\n'}
        <span className="cl-k">end</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>coroutine</code> — 协程一等公民</>, desc: <><strong>1993 年</strong>就有协程的脚本语言。<code>coroutine.create / yield / resume</code> 三件套, <em>无 OS 线程开销</em>。OpenResty 的并发模型核心就是 Lua 协程。</> },
    en: { title: <><code>coroutine</code> — first-class since day one</>, desc: <>A scripting language with coroutines <strong>since 1993</strong>. <code>coroutine.create / yield / resume</code> — three primitives, <em>no OS-thread overhead</em>. OpenResty's concurrency model is built on these.</> },
    code: (
      <code>
        <span className="cl-k">local</span> <span className="cl-v">co</span> = <span className="cl-fn">coroutine.create</span>(<span className="cl-k">function</span>(){'\n'}
        {'    '}<span className="cl-k">for</span> <span className="cl-v">i</span>=<span className="cl-n">1</span>,<span className="cl-n">3</span> <span className="cl-k">do</span>{'\n'}
        {'        '}<span className="cl-fn">coroutine.yield</span>(<span className="cl-v">i</span>){'\n'}
        {'    '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>){'\n\n'}
        <span className="cl-fn">print</span>(<span className="cl-fn">coroutine.resume</span>(<span className="cl-v">co</span>))  <span className="cl-c">-- true 1</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>closure — 词法捕获 + upvalue</>, desc: <>从 5.0 起 Lua 是<strong>真正的词法作用域</strong>语言, closure 捕获 <strong>upvalue</strong>。函数是一等值, 可塞 table、可作返回、可当参数。<em>函数式风的工具基本都齐</em>。</> },
    en: { title: <>closure — lexical capture via upvalues</>, desc: <>Since 5.0 Lua has been <strong>truly lexically scoped</strong>; closures capture <strong>upvalues</strong>. Functions are first-class values — store in tables, return, pass around. <em>Most functional-style tooling is here</em>.</> },
    code: (
      <code>
        <span className="cl-k">local function</span> <span className="cl-fn">counter</span>(){'\n'}
        {'    '}<span className="cl-k">local</span> <span className="cl-v">n</span> = <span className="cl-n">0</span>{'\n'}
        {'    '}<span className="cl-k">return function</span>(){'\n'}
        {'        '}<span className="cl-v">n</span> = <span className="cl-v">n</span> + <span className="cl-n">1</span>{'\n'}
        {'        '}<span className="cl-k">return</span> <span className="cl-v">n</span>{'\n'}
        {'    '}<span className="cl-k">end</span>{'\n'}
        <span className="cl-k">end</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>OOP — 朴素到优雅</>, desc: <>Lua <strong>没有 class 关键字</strong>。OOP = table + metatable + <code>:</code> 语法糖 (self 注入)。<em>20 行就能教会一个新手 OOP 怎么"长出来"</em>。各引擎各自约定一种, 没有标准, 也不需要标准。</> },
    en: { title: <>OOP — trivially elegant</>, desc: <>Lua has <strong>no <code>class</code> keyword</strong>. OOP = table + metatable + the <code>:</code> sugar (implicit self). <em>20 lines is enough to show a beginner how OOP "grows out" of the primitives</em>. Every engine picks its own idiom; no standard, none needed.</> },
    code: (
      <code>
        <span className="cl-k">local</span> <span className="cl-v">Dog</span> = {'{}'}{'\n'}
        <span className="cl-v">Dog</span>.<span className="cl-prop">__index</span> = <span className="cl-v">Dog</span>{'\n\n'}
        <span className="cl-k">function</span> <span className="cl-v">Dog</span>.<span className="cl-fn">new</span>(<span className="cl-v">name</span>){'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-fn">setmetatable</span>({'{'}<span className="cl-prop">name</span>=<span className="cl-v">name</span>{'}'}, <span className="cl-v">Dog</span>){'\n'}
        <span className="cl-k">end</span>{'\n\n'}
        <span className="cl-k">function</span> <span className="cl-v">Dog</span><span className="cl-fn">:bark</span>() <span className="cl-fn">print</span>(<span className="cl-k">self</span>.name) <span className="cl-k">end</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>require</code> + <code>package.path</code></>, desc: <>模块系统极简: <code>require "foo"</code> 沿 <code>package.path</code> 查 <code>?.lua</code>, 加载、缓存、返回。<strong>没有 npm-级别复杂度</strong>。LuaRocks 是社区<em>事实包管理</em>但不强制——很多项目仍 vendor 整个文件。</> },
    en: { title: <><code>require</code> + <code>package.path</code></>, desc: <>The module system is minimal: <code>require "foo"</code> searches <code>package.path</code> for <code>?.lua</code>, loads, caches, returns. <strong>None of npm's complexity</strong>. LuaRocks is the community's <em>de-facto package manager</em> but never mandatory — many projects still vendor entire files.</> },
    code: (
      <code>
        <span className="cl-c">-- foo.lua</span>{'\n'}
        <span className="cl-k">local</span> <span className="cl-v">M</span> = {'{}'}{'\n'}
        <span className="cl-k">function</span> <span className="cl-v">M</span>.<span className="cl-fn">hello</span>() <span className="cl-k">return</span> <span className="cl-s">"hi"</span> <span className="cl-k">end</span>{'\n'}
        <span className="cl-k">return</span> <span className="cl-v">M</span>{'\n\n'}
        <span className="cl-c">-- main.lua</span>{'\n'}
        <span className="cl-k">local</span> <span className="cl-v">foo</span> = <span className="cl-fn">require</span> <span className="cl-s">"foo"</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>类型: 仅 <strong>8 个</strong></>, desc: <><code>nil / boolean / number / string / function / userdata / thread / table</code>——<strong>就这 8 个</strong>。<em>整个语言能在两页纸讲完</em>。Luau 在此基础上加了渐进类型, 但<strong>核心 Lua 保持纯净</strong>。</> },
    en: { title: <>Types: just <strong>8</strong></>, desc: <><code>nil / boolean / number / string / function / userdata / thread / table</code> — <strong>that's all</strong>. <em>The entire language fits on two pages</em>. Luau layers gradual types on top, but <strong>core Lua stays pure</strong>.</> },
    code: (
      <code>
        <span className="cl-fn">print</span>(<span className="cl-fn">type</span>(<span className="cl-k">nil</span>))       <span className="cl-c">-- nil</span>{'\n'}
        <span className="cl-fn">print</span>(<span className="cl-fn">type</span>(<span className="cl-k">true</span>))     <span className="cl-c">-- boolean</span>{'\n'}
        <span className="cl-fn">print</span>(<span className="cl-fn">type</span>(<span className="cl-n">1</span>))         <span className="cl-c">-- number</span>{'\n'}
        <span className="cl-fn">print</span>(<span className="cl-fn">type</span>({'{'}{'}'}))        <span className="cl-c">-- table</span>{'\n'}
        <span className="cl-fn">print</span>(<span className="cl-fn">type</span>(<span className="cl-fn">print</span>))     <span className="cl-c">-- function</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>C ABI — 嵌入易如反掌</>, desc: <><strong>Lua 是为嵌进 C 程序设计</strong>。<code>lua_State*</code>、<code>lua_push*</code> / <code>lua_to*</code> 栈机, 整个 API <strong>极简且稳定</strong>——这是 WoW / Redis / Nginx / Lightroom 都选 Lua 的核心原因。</> },
    en: { title: <>C ABI — embedding is trivial</>, desc: <><strong>Lua is designed to be embedded inside C programs</strong>. <code>lua_State*</code>, <code>lua_push*</code> / <code>lua_to*</code> stack ops — the API is <strong>tiny and stable</strong>. This is the core reason WoW / Redis / Nginx / Lightroom all chose Lua.</> },
    code: (
      <code>
        <span className="cl-c">// C side</span>{'\n'}
        <span className="cl-type">lua_State</span> *<span className="cl-v">L</span> = <span className="cl-fn">luaL_newstate</span>();{'\n'}
        <span className="cl-fn">luaL_openlibs</span>(<span className="cl-v">L</span>);{'\n'}
        <span className="cl-fn">luaL_dostring</span>(<span className="cl-v">L</span>, <span className="cl-s">"print('hi')"</span>);{'\n'}
        <span className="cl-fn">lua_close</span>(<span className="cl-v">L</span>);
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
    icon: '⊙',
    zh: { title: <>200 KB — 整个解释器装一只小包里</>, desc: <>Lua 5.4 编译后<strong>核心约 200 KB</strong> (Python 3 嵌入式构建 ~10-30 MB, Node ~50+ MB)。<em>不是"轻量级"修辞——是真的小到可以塞硬件配置面板里</em>。这是它能进 WoW 客户端、嵌入式设备、Redis worker 的<strong>第一前提</strong>。</> },
    en: { title: <>200 KB — the entire interpreter fits in a small package</>, desc: <>Compiled Lua 5.4 is roughly <strong>200 KB of core</strong> (embeddable Python 3 builds run ~10-30 MB, Node ~50+ MB). <em>Not a "lightweight" rhetorical flourish — small enough to literally fit inside hardware config panels</em>. This is the <strong>precondition</strong> for it to sit inside the WoW client, embedded devices, Redis workers.</> },
    code: <><span className="cl-c">-- lua-5.4.6 source</span>{'\n'}<span className="cl-c">-- ~30 .c files</span>{'\n'}<span className="cl-c">-- 0 external deps</span>{'\n'}<span className="cl-c">-- builds on ANY C89 compiler</span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>零依赖 — 任何 C 编译器都能编</>, desc: <>Lua 严格用 <strong>ANSI C89</strong>, <strong>不依赖 POSIX、不依赖 libc 高级功能</strong>。从 mainframe 到嵌入式 RTOS, 只要能跑 C 就能跑 Lua。<em>这是"language as a library"的硬条件</em>。</> },
    en: { title: <>Zero deps — builds on any C compiler</>, desc: <>Lua uses strict <strong>ANSI C89</strong>, with <strong>no POSIX requirement</strong> and no fancy libc dependencies. From mainframe to embedded RTOS, anywhere C runs, Lua runs. <em>This is the hard precondition behind "language as a library"</em>.</> },
    code: <><span className="cl-c">// embed in 3 lines</span>{'\n'}<span className="cl-c">// no autoconf · no cmake</span>{'\n'}<span className="cl-c">// gcc *.c -o lua</span></>,
  },
  {
    icon: '◐',
    zh: { title: <>嵌入哲学 — <em>你嵌 Lua, 不是 Lua 嵌你</em></>, desc: <>Python / Node 的设计是"<strong>我管运行时, 你写脚本</strong>"; Lua 反过来——<strong>你的 C 程序是宿主, Lua 进来给你扩展力</strong>。这条哲学决定了 30 年间它<strong>住在每个游戏引擎、每个数据库、每个编辑器里面</strong>。</> },
    en: { title: <>Embedding philosophy — <em>you embed Lua, not the other way around</em></>, desc: <>Python and Node's design is "<strong>we own the runtime, you write scripts</strong>." Lua flips that — <strong>your C program is the host, Lua plugs in for extension power</strong>. This philosophy is why, for 30 years, it has lived <strong>inside every game engine, database, and editor</strong>.</> },
    code: <><span className="cl-c">// 你的 C app</span>{'\n'}<span className="cl-c">//   ├── 业务逻辑 (C)</span>{'\n'}<span className="cl-c">//   └── lua_State (脚本钩子)</span></>,
  },
  {
    icon: '◑',
    zh: { title: <>LuaJIT — 一人作品 vs V8</>, desc: <>Mike Pall 写的 <strong>LuaJIT</strong> 在数值循环上能<strong>跑赢 V8 / JVM</strong>——脚本语言里这是异常稀有现象。trace-based JIT + 极简 IR + 死磕底层。<em>一个奥地利人, 几年, 把 JS 工业军团比下去</em>。</> },
    en: { title: <>LuaJIT — one person vs V8</>, desc: <>Mike Pall's <strong>LuaJIT</strong> beats V8 / JVM on numeric loops — vanishingly rare for a scripting language. Trace-based JIT, minimal IR, obsessive low-level work. <em>One Austrian developer, a few years, outdoing the JS industrial complex</em>.</> },
    code: <><span className="cl-c">-- LuaJIT 2.1 (5.1 compat)</span>{'\n'}<span className="cl-c">-- trace JIT · loop hot-path</span>{'\n'}<span className="cl-c">-- C FFI for zero-cost interop</span></>,
  },
  {
    icon: '◯',
    zh: { title: <>"5.1 永生" — 兼容性的祝福与诅咒</>, desc: <>LuaJIT 钉 5.1, 整个嵌入式 / 网关 / 游戏圈跟着钉 5.1。<strong>10 年前的脚本现在还能跑</strong>——这是<strong>祝福</strong>。但 5.3 整数、5.4 RAII 在这条线上<strong>永远拿不到</strong>——这是<strong>诅咒</strong>。Lua 社区两线并行已成事实, 不再期待统一。</> },
    en: { title: <>"5.1 lives forever" — compatibility's blessing and curse</>, desc: <>LuaJIT freezes 5.1, so the embedded / gateway / game world freezes 5.1 too. <strong>Ten-year-old scripts still run</strong> — the <strong>blessing</strong>. But 5.3 integers and 5.4 RAII <strong>never reach this line</strong> — the <strong>curse</strong>. The Lua community accepts the two-track reality; nobody expects reunification anymore.</> },
    code: <><span className="cl-c">-- 5.1 line · OpenResty · WoW · Redis</span>{'\n'}<span className="cl-c">-- 5.4 line · neovim host · mainline embed</span>{'\n'}<span className="cl-c">-- both alive · both maintained</span></>,
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
    href: 'https://www.roblox.com', highlight: true,
    zhName: 'Roblox · Luau', enName: 'Roblox · Luau',
    zhNote: '~7000 万日活 · Lua 方言', enNote: '~70M DAU · Lua dialect',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F1318"/><rect x="22" y="22" width="56" height="56" rx="6" fill="#fff" transform="rotate(10 50 50)"/><rect x="40" y="40" width="20" height="20" fill="#0F1318" transform="rotate(10 50 50)"/></svg>,
  },
  {
    href: 'https://worldofwarcraft.com', highlight: true,
    zhName: 'World of Warcraft', enName: 'World of Warcraft',
    zhNote: 'UI + addon 全是 Lua', enNote: 'Entire UI + addons in Lua',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0E0C"/><path d="M30 30 L40 70 L50 40 L60 70 L70 30" stroke="#F4ECC8" strokeWidth="4" fill="none" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://redis.io', highlight: true,
    zhName: 'Redis', enName: 'Redis',
    zhNote: 'EVAL · 内嵌脚本', enNote: 'EVAL · embedded scripts',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F0F0F"/><path d="M22 36 L50 26 L78 36 L50 46 Z M22 50 L50 40 L78 50 L50 60 Z M22 64 L50 54 L78 64 L50 74 Z" fill="#DC382C"/></svg>,
  },
  {
    href: 'https://neovim.io', highlight: true,
    zhName: 'Neovim', enName: 'Neovim',
    zhNote: 'Lua 一等 · 插件首选', enNote: 'Lua-first · preferred for plugins',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F1419"/><path d="M28 22 L28 78 L40 78 L40 44 L60 78 L72 78 L72 22 L60 22 L60 56 L40 22 Z" fill="#7BD0A8"/></svg>,
  },
  {
    href: 'https://openresty.org', highlight: true,
    zhName: 'OpenResty', enName: 'OpenResty',
    zhNote: 'Nginx + LuaJIT · 边缘网关', enNote: 'Nginx + LuaJIT · edge gateway',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A1A12"/><circle cx="50" cy="50" r="26" fill="none" stroke="#5BC979" strokeWidth="4"/><path d="M50 30 L50 70 M30 50 L70 50" stroke="#5BC979" strokeWidth="3"/></svg>,
  },
  {
    href: 'https://luajit.org',
    zhName: 'LuaJIT', enName: 'LuaJIT',
    zhNote: 'Mike Pall · 跨界性能怪兽', enNote: 'Mike Pall · cross-class perf beast',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A0E22"/><text x="50" y="60" textAnchor="middle" fill="#F4ECC8" fontSize="22" fontWeight="700" fontFamily="monospace">JIT</text></svg>,
  },
  {
    href: 'https://www.adobe.com/products/photoshop-lightroom.html',
    zhName: 'Adobe Lightroom', enName: 'Adobe Lightroom',
    zhNote: 'UI 大半 Lua · SDK 是 Lua', enNote: 'UI mostly Lua · SDK is Lua',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#001E36"/><text x="50" y="62" textAnchor="middle" fill="#31A8FF" fontSize="28" fontWeight="800" fontFamily="sans-serif">Lr</text></svg>,
  },
  {
    href: 'https://www.factorio.com',
    zhName: 'Factorio', enName: 'Factorio',
    zhNote: '整套 mod API · Lua', enNote: 'Full mod API · Lua',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1410"/><rect x="22" y="42" width="56" height="16" fill="#E89A4A"/><circle cx="32" cy="50" r="5" fill="#1A1410"/><circle cx="50" cy="50" r="5" fill="#1A1410"/><circle cx="68" cy="50" r="5" fill="#1A1410"/></svg>,
  },
  {
    href: 'https://gmod.facepunch.com',
    zhName: "Garry's Mod", enName: "Garry's Mod",
    zhNote: '所有 game mode · Lua', enNote: 'Every gamemode · Lua',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1F2A35"/><circle cx="50" cy="50" r="24" fill="none" stroke="#F4ECC8" strokeWidth="4"/><text x="50" y="58" textAnchor="middle" fill="#F4ECC8" fontSize="20" fontWeight="700" fontFamily="monospace">gm</text></svg>,
  },
  {
    href: 'https://defold.com',
    zhName: 'Defold', enName: 'Defold',
    zhNote: '免费 2D 引擎 · King', enNote: 'Free 2D engine · King',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#101820"/><polygon points="30,30 70,30 70,70 50,82 30,70" fill="none" stroke="#5BC9D6" strokeWidth="3" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://love2d.org',
    zhName: 'Love2D', enName: 'Love2D',
    zhNote: '独立游戏 · Lua framework', enNote: 'Indie games · Lua framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#E64980"/><path d="M30 42 C30 32 40 28 50 38 C60 28 70 32 70 42 C70 56 50 72 50 72 C50 72 30 56 30 42 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.wireshark.org',
    zhName: 'Wireshark', enName: 'Wireshark',
    zhNote: '协议解析器 · Lua dissector', enNote: 'Protocol dissectors · Lua',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A3A5C"/><path d="M20 60 L30 50 L40 60 L50 40 L60 60 L70 50 L80 60" stroke="#5BC9D6" strokeWidth="4" fill="none" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const EMBED_TOOLS: AdoptItem[] = [
  { name: 'LuaRocks',     zhDesc: '社区包管理器',          enDesc: 'Community package manager' },
  { name: 'LuaJIT 2.1',   zhDesc: '5.1 兼容 · trace JIT',  enDesc: '5.1 compat · trace JIT' },
  { name: 'OpenResty',    zhDesc: 'Nginx + Lua · 网关',    enDesc: 'Nginx + Lua · gateway' },
  { name: 'Luau',         zhDesc: 'Roblox · 渐进类型',     enDesc: 'Roblox · gradual typing' },
  { name: 'Fennel',       zhDesc: 'Lisp 风方言 → Lua',     enDesc: 'Lisp-flavoured dialect → Lua' },
  { name: 'Teal',         zhDesc: '静态类型 Lua',          enDesc: 'Statically-typed Lua' },
  { name: 'Moonscript',   zhDesc: 'CoffeeScript 风 → Lua', enDesc: 'CoffeeScript-style → Lua' },
  { name: 'lua-language-server', zhDesc: 'LSP 实现 (sumneko)', enDesc: 'LSP impl (sumneko)' },
  { name: 'Penlight',     zhDesc: '通用工具库 (stdlib+)',  enDesc: 'General utility library' },
  { name: 'busted',       zhDesc: '测试框架',              enDesc: 'Testing framework' },
  { name: 'lapis',        zhDesc: 'Web 框架 (OpenResty)',  enDesc: 'Web framework (OpenResty)' },
  { name: 'TIC-80 / PICO-8', zhDesc: '幻想 console · Lua', enDesc: 'Fantasy consoles · Lua' },
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
      title: <>Luau 的崛起 — 类型化 Lua 是不是未来?</>,
      body: (<>
        <p>Roblox 的 <strong>Luau</strong> 给 Lua 加<strong>渐进类型</strong>、加沙盒、移除危险操作 (<code>loadstring</code>、<code>setfenv</code>)。它<strong>不是</strong>分裂主线——而是给"<em>需要类型的 Lua 用户</em>" 一个完整答案。日活规模 <strong>~7000 万</strong>, 数百万开发者在写。</p>
        <p>意义: Lua 主线一直回避加类型 (Roberto 明确表态)。Luau 让"想要类型的人"另立一支, 主线保持纯净。<em>这是 BDFL 语言设计的成熟形态</em>: 不"all things to all people", 让方言去满足子需求。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="主线 Lua 加类型 (历来拒绝)" en="Mainline Lua adopting types (historically refused)" /></span><span className="bar-val">~0%</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="Luau 接管类型需求" en="Luau owns the typed-Lua niche" /></span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Luau's rise — is typed Lua the future?</>,
      body: (<>
        <p>Roblox's <strong>Luau</strong> adds <strong>gradual typing</strong>, sandboxing, and removes dangerous primitives (<code>loadstring</code>, <code>setfenv</code>). It <strong>doesn't</strong> fork mainline — it gives "<em>Lua users who need types</em>" a complete answer. <strong>~70M daily players</strong>, millions of developers writing it.</p>
        <p>The significance: mainline Lua has long refused to add typing (Roberto has said so explicitly). Luau lets the "I want types" crowd live in its own branch while mainline stays pure. <em>This is the mature form of BDFL language design</em>: don't be all things to all people; let dialects satisfy subsets.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Mainline Lua adopting types (refused)</span><span className="bar-val">~0%</span></div>
          <div className="bar bar-new"><span className="bar-label">Luau owns the typed-Lua niche</span><span className="bar-val">100%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'NVIM',
    zh: { title: <>Neovim — Lua 的"新身份"</>, body: <><p>过去 30 年 Lua 的<strong>大众形象</strong>都是"游戏引擎里的脚本"。2020 年后 Neovim 把它推上<strong>开发者工具桌面</strong>——<code>~/.config/nvim/init.lua</code> 已经是数百万开发者每天写的文件。这是 Lua <strong>身份的扩展</strong>: 从游戏圈走到编辑器圈。</p></> },
    en: { title: <>Neovim — Lua's "new identity"</>, body: <><p>For 30 years Lua's <strong>public face</strong> was "game-engine scripting." Post-2020, Neovim moves it onto <strong>the developer's desktop</strong> — <code>~/.config/nvim/init.lua</code> is now a file millions of devs touch daily. This is an <strong>identity extension</strong> for Lua: from game world to editor world.</p></> },
  },
  {
    tag: 'LUAJIT',
    zh: { title: <>LuaJIT 的接班问题</>, body: <><p>Mike Pall 2015 年退后, LuaJIT 没有出现真正的"<em>下一个 Mike Pall</em>"。社区维护稳定但<strong>大改革停摆</strong>。OpenResty 的 luajit2 fork 补一些, moonjit 试过更激进的改, 主线仍是事实标准。<em>能不能在 GPU / WASM 等新目标上跟上, 是开放问题</em>。</p></> },
    en: { title: <>LuaJIT's succession problem</>, body: <><p>Since Mike Pall stepped back in 2015, no <em>"next Mike Pall"</em> has emerged. Maintenance is stable but <strong>large-scale evolution has stalled</strong>. OpenResty's <code>luajit2</code> fork patches some gaps, moonjit tried bolder changes; mainline still rules as the standard. <em>Whether it keeps up with new targets (GPU, WASM) is an open question</em>.</p></> },
  },
  {
    tag: 'EMBED',
    zh: { title: <>嵌入位仍在长 — IoT / 边缘</>, body: <><p>Lua 的<strong>200 KB + 零依赖</strong>属性在 2026 年比 1996 年更值钱: ESP32 / RP2040 等小芯片直接跑 Lua, 路由器 / 工业控制器把 Lua 作配置层。<strong>"language as a library" 是个永不过时的市场</strong>——而 Lua 在这块没有真正的对手 (MicroPython 体积大数倍)。</p></> },
    en: { title: <>Embedded niche keeps growing — IoT / edge</>, body: <><p>Lua's <strong>200 KB + zero deps</strong> profile is more valuable in 2026 than it was in 1996: ESP32 / RP2040-class chips run Lua directly; routers and industrial controllers use it as their config layer. <strong>"Language as a library" is a market that never goes out of style</strong> — and Lua has no real rival there (MicroPython is several times bigger).</p></> },
  },
];

export default function LuaIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'Lua : 200KB 嵌入式脚本 · 30 年活在所有东西里面'
      : 'Lua : the 200KB embedded script that lives inside everything';
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .embed-stat, .embed-tool, .spotlight, .embed-reverse, .embed-takeaway, .quote-block, .size-row, .jit-card'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 50, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.embed-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });
    root.querySelectorAll<HTMLElement>('.size-row').forEach((el, i) => { el.style.transitionDelay = `${i * 100}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--moon-warm)' : '';
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
      <div ref={rootRef} className="lua-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            {LUA_LOGO_NAV}
            <span>Lua</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Adopters" /></a></li>
            <li><a href="#embed"><L zh="嵌入" en="Embedded" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs Python" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1993 — 2026 · PUC-Rio · Roberto Ierusalimschy · "moon" in Portuguese</div>
            <h1 className="hero-title">
              <span className="hero-name">Lua</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">200KB</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>1993 年生于巴西 PUC-Rio, 设计目标朴素到挑衅: <strong>整个语言塞进 200KB</strong>, <strong>只用 C89</strong>, <strong>零外部依赖</strong>。33 年后 Lua 住在<strong>每个游戏引擎、每个数据库、每个编辑器</strong>里——<em>它不抢风头, 它住在所有东西里面</em>。</>}
                en={<>Born in 1993 at PUC-Rio in Brazil, the design goal was almost provocatively simple: <strong>fit the language in 200 KB</strong>, <strong>use only C89</strong>, <strong>zero external dependencies</strong>. 33 years on, Lua lives inside <strong>every game engine, every database, every editor</strong> — <em>it doesn't seek the spotlight, it lives inside everything</em>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1993<small></small></span>
                <span className="stat-label"><L zh={<>PUC-Rio · 巴西<br /><em>软件进口禁令的副产物</em></>} en={<>PUC-Rio · Brazil<br /><em>byproduct of an import ban</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">200<small>KB</small></span>
                <span className="stat-label"><L zh={<>核心解释器尺寸<br /><em>Python 嵌入式 ~50×</em></>} en={<>core interpreter size<br /><em>~50× smaller than embeddable Python</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">8<small> types</small></span>
                <span className="stat-label"><L zh={<>全部值类型 · 就这 8 个<br /><em>nil / bool / num / str / fn / userdata / thread / table</em></>} en={<>all value types · just 8<br /><em>nil / bool / num / str / fn / userdata / thread / table</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">70M<small> DAU</small></span>
                <span className="stat-label"><L zh={<>Roblox Luau 日活<br /><em>Lua 最大活跃方言</em></>} en={<>Roblox Luau daily<br /><em>Lua's largest active dialect</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {LUA_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">local t = {'{}'}</span>
              <span className="float f2">metatable</span>
              <span className="float f3">coroutine.yield</span>
              <span className="float f4">require "foo"</span>
              <span className="float f5">__index</span>
              <span className="float f6">lua_State *L</span>
              <span className="float f7">LuaJIT 2.1</span>
              <span className="float f8">5.1 forever</span>
              <span className="float f9">setmetatable</span>
              <span className="float f10">function() end</span>
              <span className="float f11">redis.call</span>
              <span className="float f12">nvim init.lua</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Lua</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Lua 是 <strong>1993 年 PUC-Rio 三人组造的嵌入式脚本语言</strong>: Roberto Ierusalimschy、Luiz Henrique de Figueiredo、Waldemar Celes。设计目标三句话讲完——<strong>"小、嵌得进 C、跑得动"</strong>。<em>语言本身是一本 ~250 页书能讲完的工具</em>; 它的厉害<strong>不在语言, 在它住在多少程序里</strong>。</>}
                  en={<>Lua is the <strong>embedded scripting language built by three PUC-Rio researchers in 1993</strong>: Roberto Ierusalimschy, Luiz Henrique de Figueiredo, Waldemar Celes. The design fits in three words — <strong>"small, embeddable, fast."</strong> <em>The language itself fits in a 250-page book</em>; its power <strong>isn't in the language, it's in how many programs it lives inside</strong>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="语言即库" en="Language as a library" />, tag: 'philosophy', p: <L zh={<>Lua 是个 <strong>.a 静态库</strong>, 你的 C 程序 link 进去就能跑脚本。<em>不是"Lua 调你"; 是"你嵌 Lua"</em>。这条 1993 年的设计哲学决定了它 30 年的命运。</>} en={<>Lua is a <strong>.a static library</strong> you link into your C program to get scripting. <em>Not "Lua calls you"; you embed Lua</em>. This 1993 design philosophy shaped 30 years of where it ended up.</>} /> },
                { h: <L zh="动态类型 · 8 种值" en="Dynamic · 8 value types" />, tag: 'types', p: <L zh={<>动态类型, 值类型仅 8 种: <code>nil / boolean / number / string / function / userdata / thread / table</code>。<strong>table 一个顶七个</strong>——数组、字典、对象、namespace、module 全是它。</>} en={<>Dynamically typed, exactly 8 value types: <code>nil / boolean / number / string / function / userdata / thread / table</code>. <strong>table does the work of seven</strong> — arrays, dicts, objects, namespaces, modules all collapse into it.</>} /> },
                { h: <L zh="GC + 协程" en="GC + coroutines" />, tag: 'runtime', p: <L zh={<>增量 GC (5.4 起分代式), <strong>1993 年就有的协程</strong> (<code>yield / resume</code>)。<em>无 OS 线程开销的并发原语</em>——OpenResty 整个并发模型站在这上面。</>} en={<>Incremental GC (generational since 5.4), <strong>coroutines since 1993</strong> (<code>yield / resume</code>). <em>Concurrency primitives without OS-thread cost</em> — OpenResty's entire concurrency model sits on these.</>} /> },
                { h: <L zh="ANSI C89 编译" en="Builds with ANSI C89" />, tag: 'portable', p: <L zh={<>整个解释器 ~30 个 <code>.c</code> 文件, 严格 <strong>ANSI C89</strong>, 不依赖 POSIX。<em>能跑 C 的地方就能跑 Lua</em>——这是它能进 PS3 / 路由器 / ESP32 的基础。</>} en={<>The whole interpreter is ~30 <code>.c</code> files, strict <strong>ANSI C89</strong>, no POSIX dependency. <em>Anywhere C runs, Lua runs</em> — the precondition for it landing on PS3s, routers, ESP32s.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">embed.py</span><span className="lang-tag js">CPython embed</span></div>
                <pre className="code"><code>
                  <span className="cl-c">// C side</span>{'\n'}
                  <span className="cl-c">// link libpython3 (~30 MB)</span>{'\n'}
                  <span className="cl-c">// + libffi · + libssl · + libz · ...</span>{'\n\n'}
                  <span className="cl-fn">Py_Initialize</span>();{'\n'}
                  <span className="cl-fn">PyRun_SimpleString</span>(<span className="cl-s">"print('hi')"</span>);{'\n'}
                  <span className="cl-fn">Py_Finalize</span>();{'\n\n'}
                  <span className="cl-c">// runtime: ~10-30 MB resident</span>{'\n'}
                  <span className="cl-c">// startup: hundreds of ms</span>{'\n'}
                  <span className="cl-c">// 不适合塞进游戏 frame · 路由器 · MCU</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">embed.c</span><span className="lang-tag ts">Lua embed</span></div>
                <pre className="code"><code>
                  <span className="cl-c">// C side · 5 行就完事</span>{'\n'}
                  <span className="cl-c">// link liblua (~200 KB)</span>{'\n'}
                  <span className="cl-c">// 0 外部依赖</span>{'\n\n'}
                  <span className="cl-type">lua_State</span> *<span className="cl-v">L</span> = <span className="cl-fn">luaL_newstate</span>();{'\n'}
                  <span className="cl-fn">luaL_openlibs</span>(<span className="cl-v">L</span>);{'\n'}
                  <span className="cl-fn">luaL_dostring</span>(<span className="cl-v">L</span>, <span className="cl-s">"print('hi')"</span>);{'\n'}
                  <span className="cl-fn">lua_close</span>(<span className="cl-v">L</span>);{'\n\n'}
                  <span className="cl-c">// runtime: ~200 KB resident</span>{'\n'}
                  <span className="cl-c">// startup: microseconds</span>{'\n'}
                  <span className="cl-c">// WoW client · Redis · Nginx · ESP32 都靠这套</span>
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
                zh={<>33 年, 从巴西大学一间小实验室到 70M Roblox 日活——Lua 没有"<em>明星时刻</em>", 它是<strong>慢工出细活</strong>的样本。每一年都安静往前走一步, 然后某天发现<strong>它已经住在你每天用的所有东西里</strong>。</>}
                en={<>33 years, from a small Brazilian university lab to 70 million Roblox dailies — Lua has no "<em>star moment</em>"; it's a textbook case of <strong>quiet, steady progress</strong>. One step a year, then one day you notice <strong>it's already inside everything you use daily</strong>.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: LuaAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>8 张卡讲 Lua 跟其它语言<strong>最不一样的地方</strong>: <code>table</code> 当一切、metatable 当根、coroutine、closure、朴素 OOP、<code>require</code>、8 个类型、C ABI。第 9 张是<strong>"Python 超集"的反面</strong>: Lua 不试图替代 Python, 它选了完全相反的赛道。</>}
                en={<>Eight cards covering where Lua <strong>differs hardest</strong>: <code>table</code> as everything, metatables as the root, coroutines, closures, plain-text OOP, <code>require</code>, 8 value types, the C ABI. The ninth covers what makes Lua <strong>the anti-Python</strong>: it doesn't try to replace Python, it picked the opposite track.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {LANG_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>反 Python 哲学 — 故意不长大</>} en={<>The anti-Python philosophy — refusing to grow</>} /></h3>
                <p><L
                  zh={<>Python 30 年膨胀到 stdlib 上千万行、关键字几十个、PEP 几百条。Lua 30 年? <strong>关键字仍 22 个, 核心 stdlib 仍 ~200 KB</strong>。<em>Roberto 多次明确拒绝把语言"现代化"</em>: 不加类, 不加类型, 不加 async/await。这是 <strong>BDFL 主动选择不长大</strong>——保住嵌入位才是身份。</>}
                  en={<>Python has bloated over 30 years to millions of lines of stdlib, dozens of keywords, hundreds of PEPs. Lua over 30 years? <strong>Still 22 keywords, still ~200 KB of core stdlib</strong>. <em>Roberto has repeatedly refused to "modernise" the language</em> — no classes, no types, no async/await. A <strong>BDFL who deliberately chose not to grow</strong>, because guarding the embedded niche is the identity.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>把 Lua 加到不像 Lua 的样子, 我宁可不加。</>}
                  en={<>I'd rather not add it than make Lua look like not-Lua.</>}
                /></em>" — Roberto Ierusalimschy, paraphrased from talks</p>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why Lua" /> <code>: WhyLua</code></h2>
              <p className="sec-desc"><L
                zh={<>选 Lua 跟选 Python / Node 的<strong>决策维度不一样</strong>。Python 比生态; Lua 比"<strong>能不能塞进我的 C 程序</strong>"。这块没有第二选——Lua 在嵌入位上<strong>事实垄断 30 年</strong>。</>}
                en={<>The decision axes for picking Lua are <strong>different from those for Python or Node</strong>. Python is picked for ecosystem; Lua is picked for "<strong>can I fit it inside my C program?</strong>" There's no second option — Lua has been the <strong>de-facto monopolist on the embedded slot for 30 years</strong>.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who's Using" /> <code>: EmbeddedHallOfFame</code></h2>
              <p className="sec-desc"><L
                zh={<>Lua 的<strong>名单不夸张</strong>: 它确实住在你每天用的所有东西里。从 Roblox 到 WoW、Redis 到 Nginx、Neovim 到 Lightroom——<strong>嵌入式语言的名人堂</strong>。每一个都是真用户, 用了多年, 没在炒作。</>}
                en={<>Lua's roster is <strong>genuinely impressive</strong>: it really does live inside everything you use daily. From Roblox to WoW, Redis to Nginx, Neovim to Lightroom — the <strong>embedded-language hall of fame</strong>. Every entry is a real user, multi-year, no marketing fluff.</>}
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

          {/* 06 Embedded Era */}
          <section className="section section-embed" id="embed">
            <header className="sec-head">
              <span className="sec-num embed-num">06</span>
              <h2 className="sec-title"><L zh="嵌入哲学" en="The Embedded Philosophy" /> <code>: <L zh="200KB 装下一门语言" en="200KB FitsAWholeLang" /></code></h2>
              <p className="sec-desc"><L
                zh={<>这一节是 Lua 的<strong>灵魂</strong>。30 年前 PUC-Rio 三人组做了一个朴素决定——<strong>不试图替代任何语言, 只做"宿主程序里的脚本层"</strong>。这个决定让 Lua <em>赢下了一整个 niche</em>: 嵌入位。30 年没人能撼动。</>}
                en={<>This section is Lua's <strong>soul</strong>. Thirty years ago, three PUC-Rio researchers made one austere decision — <strong>don't try to replace any language; just be "the scripting layer inside someone's host program"</strong>. That decision let Lua <em>own an entire niche</em>: the embedded slot. 30 years, no one's dislodged it.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我们从一开始就<strong>不想做"独立的"语言</strong>。Lua 的家是别人的程序——游戏引擎、数据库、配置面板。语言要小、要快、要能用一行 C 把脚本塞进去。我们做了这 30 年, <strong>没改这个决定</strong>。</>}
                en={<>From the very start, we <strong>didn't want to build a "standalone" language</strong>. Lua's home is somebody else's program — a game engine, a database, a config panel. The language has to stay small, fast, and embeddable with one line of C. We've been doing this for 30 years, and <strong>we haven't reversed that decision</strong>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Roberto Ierusalimschy</span>
                <span className="quote-context"><L zh="Lua 主设计师 · PUC-Rio · 多次访谈 paraphrase" en="Lua's lead designer · PUC-Rio · paraphrased from many interviews" /></span>
              </footer>
            </blockquote>

            {/* The signature visualization — interpreter size comparison */}
            <div className="size-bars">
              <h3 className="size-bars-h"><L zh="解释器尺寸对比 — 200 KB vs 一切" en="Interpreter size: 200 KB vs the rest" /></h3>
              <p className="size-bars-sub"><L zh="// 嵌入式构建 · 核心解释器 + 基础 stdlib" en="// embedded build · core interpreter + minimal stdlib" /></p>
              {[
                { name: 'Lua 5.4',       val: 200,     label: '~200 KB',   lua: true },
                { name: 'LuaJIT 2.1',    val: 500,     label: '~500 KB' },
                { name: 'MicroPython',   val: 600,     label: '~600 KB' },
                { name: 'Duktape (JS)',  val: 700,     label: '~700 KB' },
                { name: 'QuickJS',       val: 1200,    label: '~1.2 MB' },
                { name: 'Wren',          val: 350,     label: '~350 KB' },
                { name: 'CPython (embed)', val: 12000, label: '~12-30 MB' },
                { name: 'Node.js (V8)',  val: 50000,   label: '~50+ MB' },
              ].map((row, i) => (
                <div className={`size-row${row.lua ? ' lua' : ''}`} key={i}>
                  <div className="size-name">{row.name}</div>
                  <div className="size-track">
                    <div className="size-fill" style={{ width: `${Math.min(100, (Math.log10(row.val) - 1.5) * 28)}%` }} />
                  </div>
                  <div className="size-val">{row.label}</div>
                </div>
              ))}
            </div>

            <div className="embed-stats">
              <div className="embed-stat">
                <div className="embed-stat-num">200<small> KB</small></div>
                <div className="embed-stat-h"><L zh="核心解释器尺寸" en="Core interpreter size" /></div>
                <p><L
                  zh={<>Lua 5.4 编译后整个核心约 <strong>200 KB</strong>——可以塞进 80 年代级别的硬件。这不是"<em>轻量级</em>"修辞, 是<strong>架构决策</strong>: 解释器 + 词法 + 语法 + GC + stdlib 全部加起来 ~30 个 <code>.c</code> 文件。<em>看完源码不需要一周</em>。</>}
                  en={<>Compiled Lua 5.4's core is roughly <strong>200 KB</strong> — small enough for 1980s-class hardware. Not a <em>"lightweight" slogan</em>, an <strong>architecture decision</strong>: interpreter + lexer + parser + GC + stdlib together are ~30 <code>.c</code> files. <em>You can read the entire source in under a week</em>.</>}
                /></p>
              </div>
              <div className="embed-stat">
                <div className="embed-stat-num">22<small></small></div>
                <div className="embed-stat-h"><L zh="保留关键字总数" en="Reserved keywords total" /></div>
                <p><L
                  zh={<><strong>22 个关键字</strong>就讲完整门 Lua: <code>and / break / do / else / elseif / end / false / for / function / goto / if / in / local / nil / not / or / repeat / return / then / true / until / while</code>。<em>Python 30+, JS 60+, Rust 50+</em>——Lua 30 年没膨胀。</>}
                  en={<>The whole of Lua fits in <strong>22 keywords</strong>: <code>and / break / do / else / elseif / end / false / for / function / goto / if / in / local / nil / not / or / repeat / return / then / true / until / while</code>. <em>Python has 30+, JS 60+, Rust 50+</em>. Lua hasn't grown in 30 years.</>}
                /></p>
              </div>
              <div className="embed-stat">
                <div className="embed-stat-num">0<small> deps</small></div>
                <div className="embed-stat-h"><L zh="外部依赖" en="External dependencies" /></div>
                <p><L
                  zh={<>构建 Lua 不需要 autoconf、不需要 cmake、不需要 libffi、不需要任何东西。<code>gcc *.c -o lua</code>。<em>能跑 C89 的地方就能跑 Lua</em>: 大型机、嵌入式 RTOS、PS3、ESP32、路由器固件。<strong>这是它住进每个东西的"硬条件"</strong>。</>}
                  en={<>Building Lua requires no autoconf, no cmake, no libffi, nothing. <code>gcc *.c -o lua</code>. <em>Anywhere C89 runs, Lua runs</em>: mainframes, embedded RTOSes, PS3s, ESP32s, router firmware. <strong>The hard precondition for living inside everything</strong>.</>}
                /></p>
              </div>
            </div>

            {/* LuaJIT dedicated callout */}
            <div className="jit-card">
              <h3>LuaJIT — <L zh="脚本语言里的异常值" en="the scripting-language outlier" /><small><L zh="// Mike Pall · 一人作品" en="// Mike Pall · solo project" /></small></h3>
              <p><L
                zh={<>2005 年, 奥地利程序员 <strong>Mike Pall</strong> 一个人写出 <strong>LuaJIT</strong>: trace-based JIT + 极简 IR + 高度手工调优。<em>这是 Lua 故事里最反常的一段</em>——一个工业级 JIT, 整个由一个人写出来, 性能在数值循环上<strong>能跑赢 Google 几百人写的 V8</strong>。</>}
                en={<>In 2005, Austrian developer <strong>Mike Pall</strong> single-handedly built <strong>LuaJIT</strong>: a trace-based JIT, a minimal IR, hand-tuned to the metal. <em>The most extraordinary part of the Lua story</em> — an industrial-grade JIT, end-to-end written by one person, that <strong>beats Google's hundred-engineer V8 on numeric loops</strong>.</>}
              /></p>
              <p><L
                zh={<>LuaJIT 锁在 <strong>Lua 5.1 兼容</strong>——这是它的祝福也是诅咒。祝福: <strong>整个嵌入式 / 网关 / 游戏圈都跟着锁 5.1</strong>, ABI 稳定 20 年。诅咒: Lua 5.3 的整数、5.4 的 <code>&lt;close&gt;</code> 永远拿不到。OpenResty 维护的 <code>luajit2</code> fork 在主线补丁基础上加企业级修复, 是 2026 年事实活跃版本之一。</>}
                en={<>LuaJIT is pinned to <strong>Lua 5.1 compatibility</strong> — both its blessing and curse. Blessing: <strong>the entire embedded / gateway / game world is pinned with it</strong>, giving 20-year ABI stability. Curse: 5.3's integers and 5.4's <code>&lt;close&gt;</code> never reach this line. OpenResty's <code>luajit2</code> fork patches on top with enterprise fixes — one of the de-facto active variants in 2026.</>}
              /></p>
              <p><L
                zh={<>2015 年 Mike Pall 公开表态<strong>退出主导开发</strong>找接班人。十年过去, <em>没有真正的"下一个 Mike Pall"</em>——这是 LuaJIT 长期最大的不确定性。但项目仍由社区维护, 2023 年才打出官方 2.1 RC。<strong>一人作品的命运永远悬在那里</strong>。</>}
                en={<>In 2015, Mike Pall publicly <strong>stepped away from leading development</strong> to search for a successor. Ten years on, <em>no real "next Mike Pall" has appeared</em> — LuaJIT's biggest long-term uncertainty. But the community maintains it; an official 2.1 RC only landed in 2023. <strong>The fate of a one-person project always hangs in the air</strong>.</>}
              /></p>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3><L zh={<>Redis EVAL — Lua 进世界最大缓存</>} en={<>Redis EVAL — Lua inside the world's largest cache</>} /> <span className="spotlight-meta">— 2012</span></h3>
                  <p><L
                    zh={<>2012 年 antirez 给 Redis 加 <code>EVAL</code>——<strong>把 Lua 当作内嵌脚本语言</strong>。这一个动作让 Lua 通过 Redis <em>静悄悄进了几亿个 web 后端</em>。每次 <code>redis.call</code> 都是 Lua VM 在跑。</>}
                    en={<>In 2012 antirez added <code>EVAL</code> to Redis — making <strong>Lua its embedded scripting language</strong>. That single move quietly carried Lua <em>into hundreds of millions of web back ends</em> through Redis. Every <code>redis.call</code> is a Lua VM running.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>atomicity</strong> — <L zh="一个 EVAL 是一次 Redis 原子操作" en="one EVAL is one atomic Redis op" /></li>
                    <li><strong>200 KB embed</strong> — <L zh="Redis 二进制几乎没变胖" en="Redis binary barely grew" /></li>
                    <li><strong>deterministic</strong> — <L zh="同输入 → 同输出, 适合 replication" en="same input → same output, replication-safe" /></li>
                    <li><strong>Functions (7.0)</strong> — <L zh="持久化版 EVAL · Lua 仍是底层" en="persistent EVAL · still Lua underneath" /></li>
                  </ul>
                  <p><L
                    zh={<>2022 年 Redis 7.0 一度讨论"<em>EVAL 是否弃用</em>", 社区反弹强烈; <strong>Redis 7.4 把 Lua 重新定位为一等公民</strong>, 跟 Functions 并存。<em>嵌入式语言的位置一旦坐稳, 几乎拔不掉</em>。</>}
                    en={<>Redis 7.0 in 2022 briefly floated "<em>should EVAL be deprecated?</em>"; community pushback was fierce. <strong>Redis 7.4 restored Lua to first-class status</strong> alongside Functions. <em>Once an embedded language is entrenched, it's almost impossible to unseat</em>.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c">-- Redis EVAL · atomic compare-and-set</span>{'\n'}
                    <span className="cl-k">local</span> <span className="cl-v">cur</span> = <span className="cl-fn">redis.call</span>(<span className="cl-s">"GET"</span>, <span className="cl-v">KEYS</span>[<span className="cl-n">1</span>]){'\n'}
                    <span className="cl-k">if</span> <span className="cl-v">cur</span> == <span className="cl-v">ARGV</span>[<span className="cl-n">1</span>] <span className="cl-k">then</span>{'\n'}
                    {'    '}<span className="cl-fn">redis.call</span>(<span className="cl-s">"SET"</span>, <span className="cl-v">KEYS</span>[<span className="cl-n">1</span>], <span className="cl-v">ARGV</span>[<span className="cl-n">2</span>]){'\n'}
                    {'    '}<span className="cl-k">return</span> <span className="cl-n">1</span>{'\n'}
                    <span className="cl-k">else</span>{'\n'}
                    {'    '}<span className="cl-k">return</span> <span className="cl-n">0</span>{'\n'}
                    <span className="cl-k">end</span>{'\n\n'}
                    <span className="cl-c"># client side</span>{'\n'}
                    <span className="cl-c"># EVAL "..." 1 mykey oldval newval</span>{'\n'}
                    <span className="cl-c"># → 1 (swapped) or 0 (skipped)</span>{'\n\n'}
                    <span className="cl-c">-- 一个 EVAL = 一次原子操作</span>{'\n'}
                    <span className="cl-c">-- 几亿 web 后端默默调过</span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="embed-tools">
              <h3 className="embed-tools-h"><L zh="2026 生态 / 工具 / 方言" en="2026 ecosystem / tools / dialects" /></h3>
              <div className="embed-tools-grid">
                {EMBED_TOOLS.map((t, i) => (
                  <div className="embed-tool" key={i}>
                    <div className="embed-tool-name">{t.name}</div>
                    <div className="embed-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="embed-reverse">
              <div className="embed-reverse-text">
                <div className="embed-reverse-tag">NEOVIM</div>
                <h3><L zh="VimL → Lua — 编辑器圈的 Lua 时刻" en="VimL → Lua — Lua's editor moment" /></h3>
                <p><L
                  zh={<>2014 年 Neovim 从 Vim fork, 2019 年放出嵌入 Lua 5.1。这步动作<strong>改了 Lua 的公共身份</strong>: 过去 30 年它的形象是"<em>游戏里的脚本</em>"; 2020 年后变成"<em>开发者每天写的 init.lua</em>"。</>}
                  en={<>Neovim forked from Vim in 2014; 2019's release added embedded Lua 5.1. That single move <strong>reshaped Lua's public identity</strong>: for 30 years it was "<em>game-engine scripting</em>"; from 2020 it's "<em>the init.lua every developer touches daily</em>".</>}
                /></p>
                <p><L
                  zh={<>2020-2026 的<strong>插件浪潮</strong>: <code>telescope.nvim</code> (模糊搜索)、<code>nvim-treesitter</code> (语法树)、<code>lazy.nvim</code> (插件管理)、<code>nvim-lspconfig</code> (LSP)——全是 <strong>纯 Lua</strong>。VimScript 沦为遗产, Vim 9.0 出 Vim9script 也救不回来。</>}
                  en={<>The <strong>2020-2026 plugin wave</strong>: <code>telescope.nvim</code> (fuzzy finder), <code>nvim-treesitter</code> (syntax trees), <code>lazy.nvim</code> (plugin manager), <code>nvim-lspconfig</code> (LSP) — all <strong>pure Lua</strong>. VimScript is legacy; not even Vim 9.0's Vim9script can pull it back.</>}
                /></p>
                <p><L
                  zh={<>有趣的是: Neovim 嵌的<strong>是 LuaJIT</strong> (5.1 兼容), 不是主线 5.4。<em>"5.1 永生"现象在 2026 年又一次被钉死</em>: 主线版本永远走不进 LuaJIT 生态。</>}
                  en={<>An interesting wrinkle: Neovim embeds <strong>LuaJIT</strong> (5.1-compat), not mainline 5.4. <em>The "5.1 lives forever" pattern is reinforced again</em>: mainline versions never make it into the LuaJIT ecosystem.</>}
                /></p>
              </div>
              <div className="embed-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c">-- ~/.config/nvim/init.lua</span>{'\n'}
                  <span className="cl-c">-- 一个文件取代了几百行 .vimrc</span>{'\n\n'}
                  <span className="cl-k">local</span> <span className="cl-v">vim</span> = <span className="cl-v">vim</span>{'\n'}
                  <span className="cl-v">vim</span>.<span className="cl-prop">opt</span>.number = <span className="cl-k">true</span>{'\n'}
                  <span className="cl-v">vim</span>.<span className="cl-prop">opt</span>.tabstop = <span className="cl-n">4</span>{'\n\n'}
                  <span className="cl-c">-- LSP: 一行启动 rust-analyzer</span>{'\n'}
                  <span className="cl-fn">require</span>(<span className="cl-s">"lspconfig"</span>).<span className="cl-v">rust_analyzer</span>.<span className="cl-fn">setup</span>{'{}'}{'\n\n'}
                  <span className="cl-c">-- 快捷键: Lua 表 + 函数</span>{'\n'}
                  <span className="cl-v">vim</span>.<span className="cl-prop">keymap</span>.<span className="cl-fn">set</span>(<span className="cl-s">"n"</span>, <span className="cl-s">"&lt;leader&gt;ff"</span>,{'\n'}
                  {'    '}<span className="cl-fn">require</span>(<span className="cl-s">"telescope.builtin"</span>).<span className="cl-fn">find_files</span>){'\n\n'}
                  <span className="cl-c">-- 整个配置可以热重载</span>{'\n'}
                  <span className="cl-c">-- 这是 VimL 30 年做不到的</span>
                </code></pre>
              </div>
            </div>

            <div className="embed-takeaway">
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>Lua <strong>不是 "<em>下一代 Python</em>"</strong>, 也不是 "<em>更快的 JavaScript</em>"——它是<strong>"住在你 C 程序里的脚本"</strong> 这个 niche 的事实垄断者。30 年没人撼动, 33 岁仍在长。</>}
                en={<>Lua isn't <strong>"<em>the next Python</em>"</strong> or "<em>a faster JavaScript</em>" — it's the <strong>de-facto monopolist of "scripting that lives inside your C program."</strong> Untouched for 30 years; still growing at 33.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs Python / JS */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="vs Python / JS" /> <code>: Lua vs Python vs JS</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <a href="/code/language/python">Python</a> 比: Lua 是 Python 的<strong>反面</strong>——故意小, 故意 niche。跟 <a href="/code/language/javascript">JS</a> 比: 都是 1990 年代生的动态脚本, 但 JS 把生态压到浏览器, Lua 压到嵌入。跟 <a href="/code/language/c">C</a> 比: Lua 的家就是 C, <em>共生关系不是替代关系</em>。</>}
                en={<>Versus <a href="/code/language/python">Python</a>: Lua is Python's <strong>opposite</strong> — deliberately small, deliberately niche. Versus <a href="/code/language/javascript">JS</a>: both are 90s dynamic scripts, but JS bet on browsers while Lua bet on embedding. Versus <a href="/code/language/c">C</a>: Lua's home <em>is</em> C — a symbiosis, not a replacement.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-js">Python</th>
                  <th className="th-ts">Lua</th>
                  <th className="th-sw">JavaScript</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    js: <>Guido · 1991</>,
                    ts: <>PUC-Rio · 1993</>,
                    sw: <>Brendan Eich · 1995</> },
                  { k: <L zh="设计师" en="Designer" />,
                    js: <>Guido van Rossum</>,
                    ts: <>R. Ierusalimschy + 2</>,
                    sw: <>Brendan Eich</> },
                  { k: <L zh="设计目标" en="Design goal" />,
                    js: <L zh="可读 · 通用脚本" en="Readability · general scripting" />,
                    ts: <L zh="嵌进 C · 小 · 可移植" en="Embed in C · small · portable" />,
                    sw: <L zh="浏览器表单胶水" en="Browser form glue" /> },
                  { k: <L zh="核心大小" en="Core size" />,
                    js: <L zh={<>嵌入式 ~10-30 MB</>} en={<>Embeddable ~10-30 MB</>} />,
                    ts: <L zh={<><strong>~200 KB</strong></>} en={<><strong>~200 KB</strong></>} />,
                    sw: <L zh={<>V8 ~50+ MB · QuickJS ~1 MB</>} en={<>V8 ~50+ MB · QuickJS ~1 MB</>} /> },
                  { k: <L zh="关键字数" en="Keyword count" />,
                    js: <>~35</>,
                    ts: <strong>22</strong>,
                    sw: <>~60</> },
                  { k: <L zh="数据结构" en="Data structures" />,
                    js: <L zh="list / dict / tuple / set / ..." en="list / dict / tuple / set / ..." />,
                    ts: <L zh={<><strong>table 一个顶七个</strong></>} en={<><strong>table does it all</strong></>} />,
                    sw: <L zh="Array / Object / Map / Set / ..." en="Array / Object / Map / Set / ..." /> },
                  { k: <L zh="OOP" en="OOP" />,
                    js: <L zh="class 关键字" en="class keyword" />,
                    ts: <L zh={<>metatable 拼出来 · 无关键字</>} en={<>built from metatables · no keyword</>} />,
                    sw: <L zh="class (ES6) + prototype" en="class (ES6) + prototype" /> },
                  { k: <L zh="协程" en="Coroutines" />,
                    js: <L zh={<>asyncio (后加) · generators</>} en={<>asyncio (retrofitted) · generators</>} />,
                    ts: <L zh={<><strong>1993 起一等公民</strong></>} en={<><strong>first-class since 1993</strong></>} />,
                    sw: <L zh="async/await (ES2017)" en="async/await (ES2017)" /> },
                  { k: <L zh="性能 (typed loop)" en="Performance (typed loop)" />,
                    js: <L zh={<>CPython 慢 · PyPy 中等</>} en={<>CPython slow · PyPy mid</>} />,
                    ts: <L zh={<><strong>LuaJIT 跟 V8 同档</strong></>} en={<><strong>LuaJIT on par with V8</strong></>} />,
                    sw: <L zh="V8 · 最强 JIT 之一" en="V8 · one of the best JITs" /> },
                  { k: <L zh="嵌入易度" en="Embedding ease" />,
                    js: <L zh={<>难 · libpython 巨大</>} en={<>Hard · libpython is huge</>} />,
                    ts: <L zh={<><strong>5 行 C 搞定 · 200 KB</strong></>} en={<><strong>5 lines of C · 200 KB</strong></>} />,
                    sw: <L zh="QuickJS 可以 · V8 不可能" en="QuickJS yes · V8 no way" /> },
                  { k: <L zh="生态规模" en="Ecosystem size" />,
                    js: <L zh="PyPI ~50 万包" en="PyPI ~500k packages" />,
                    ts: <L zh={<>LuaRocks ~5000 · vendor 居多</>} en={<>LuaRocks ~5k · vendoring is common</>} />,
                    sw: <L zh="npm ~250 万包" en="npm ~2.5M packages" /> },
                  { k: <L zh="典型场景" en="Typical use" />,
                    js: <L zh="数据 · ML · web · 脚本" en="Data · ML · web · scripts" />,
                    ts: <L zh={<><strong>游戏脚本 · 配置 · 嵌入</strong></>} en={<><strong>Game scripts · config · embedded</strong></>} />,
                    sw: <L zh="浏览器 · Node · 全栈" en="Browsers · Node · full-stack" /> },
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
                zh={<>Lua 2026 年的<strong>核心问题不是"<em>怎么发展</em>", 是"<em>谁能撼动嵌入位</em>"</strong>。30 年没有真威胁。主线 5.4 稳定, LuaJIT 接班悬而未决, Luau 接管类型化需求, Neovim 把它推上新一代开发者桌面。<em>这是一门已经赢过的语言, 在守自己赢来的地</em>。</>}
                en={<>Lua's 2026 question isn't <strong>"<em>how to evolve</em>"; it's "<em>who could possibly unseat it from the embedded slot</em>"</strong>. No real threat in 30 years. Mainline 5.4 stable, LuaJIT's succession unresolved, Luau owning the typed-Lua niche, Neovim pushing it onto a new generation of developer desktops. <em>This is a language that already won — now it's holding the ground it won</em>.</>}
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
                <li><a href="https://www.lua.org" target="_blank" rel="noopener">lua.org</a></li>
                <li><a href="https://www.lua.org/pil/" target="_blank" rel="noopener">Programming in Lua</a></li>
                <li><a href="https://www.lua.org/manual/5.4/" target="_blank" rel="noopener">Reference Manual 5.4</a></li>
                <li><a href="https://github.com/lua/lua" target="_blank" rel="noopener">GitHub · lua/lua</a></li>
                <li><a href="https://www.lua.org/wshop.html" target="_blank" rel="noopener">Lua Workshop</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="LuaJIT / 方言" en="LuaJIT / Dialects" /></h4>
              <ul>
                <li><a href="https://luajit.org" target="_blank" rel="noopener">luajit.org</a></li>
                <li><a href="https://github.com/LuaJIT/LuaJIT" target="_blank" rel="noopener">github · LuaJIT/LuaJIT</a></li>
                <li><a href="https://github.com/openresty/luajit2" target="_blank" rel="noopener">openresty/luajit2</a></li>
                <li><a href="https://luau.org" target="_blank" rel="noopener">luau.org (Roblox)</a></li>
                <li><a href="https://github.com/luau-lang/luau" target="_blank" rel="noopener">github · luau-lang/luau</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 嵌入" en="Ecosystem / Embed" /></h4>
              <ul>
                <li><a href="https://openresty.org" target="_blank" rel="noopener">openresty.org</a></li>
                <li><a href="https://neovim.io" target="_blank" rel="noopener">neovim.io</a></li>
                <li><a href="https://luarocks.org" target="_blank" rel="noopener">LuaRocks</a></li>
                <li><a href="https://love2d.org" target="_blank" rel="noopener">Love2D</a></li>
                <li><a href="https://defold.com" target="_blank" rel="noopener">Defold</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/python"><L zh="Python — Lua 的反面" en="Python — Lua's opposite" /></a></li>
                <li><a href="/code/language/c"><L zh="C — Lua 的家" en="C — Lua's home" /></a></li>
                <li><a href="/code/language/javascript"><L zh="JavaScript — 同代脚本" en="JavaScript — same-era script" /></a></li>
                <li><a href="/code/language/rust"><L zh="Rust — 系统语言对照" en="Rust — systems-lang contrast" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{LUA_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`-- "lua" is Portuguese for moon`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
