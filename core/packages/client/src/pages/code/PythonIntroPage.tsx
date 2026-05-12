import { useEffect, useRef, useContext, createContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './python_intro.css';

type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
const useLang = () => useContext(LangCtx);

function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useLang() === 'zh' ? zh : en}</>;
}

const PY_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="py-blue-logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5A9FD4" /><stop offset="1" stopColor="#306998" />
      </linearGradient>
      <linearGradient id="py-yellow-logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFE873" /><stop offset="1" stopColor="#FFD43B" />
      </linearGradient>
    </defs>
    <path fill="url(#py-blue-logo)" d="M127 22c-44 0-41 19-41 19v20h42v6H64s-28-3-28 41 25 42 25 42h22v-25s-1-25 24-25h42s24 0 24-23V45s4-23-46-23zm-23 13a8 8 0 1 1 0 15 8 8 0 0 1 0-15z" />
    <path fill="url(#py-yellow-logo)" d="M129 234c44 0 41-19 41-19v-20h-42v-6h64s28 3 28-41-25-42-25-42h-22v25s1 25-24 25h-42s-24 0-24 23v40s-4 23 46 23zm23-13a8 8 0 1 1 0-15 8 8 0 0 1 0 15z" />
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
    year: <>1989<small>·12</small></>,
    zh: { title: <>圣诞假期的副业</>, desc: <>Guido van Rossum 在荷兰 CWI 研究所工作，圣诞假期办公室关门，他想"找个项目消磨一周"。受教学语言 ABC 启发，开始写一门可读性优先、类型动态、带 <code>__init__</code> 之类便利特性的语言。名字取自 BBC 喜剧《Monty Python's Flying Circus》——和蛇没关系。</> },
    en: { title: <>The Christmas hobby project</>, desc: <>Guido van Rossum, at the CWI research institute in the Netherlands, wanted "a project to keep me occupied during the week around Christmas" while the office was closed. Inspired by the teaching language ABC, he started a readability-first, dynamically typed language with niceties like <code>__init__</code>. The name comes from the BBC sketch show <em>Monty Python's Flying Circus</em> — nothing to do with the snake.</> },
  },
  {
    year: <>1991<small>·02</small></>,
    zh: { title: <>0.9.0 首发于 alt.sources</>, desc: <>2 月 20 日，Guido 把第一个公开版本贴到 Usenet 新闻组 <code>alt.sources</code>。已经具备类、异常、函数、模块、字典、列表——除了缩进语法，今天看依然眼熟。</> },
    en: { title: <>0.9.0 ships on alt.sources</>, desc: <>February 20. Guido posts the first public release to the Usenet newsgroup <code>alt.sources</code>. It already has classes, exceptions, functions, modules, dictionaries, lists — modern Python, minus a few syntax sugars.</> },
  },
  {
    year: <>2000<small>·10</small></>,
    zh: { title: <>2.0 — 列表推导 + GC</>, desc: <>10 月 16 日 Python 2.0。引入<strong>列表推导</strong>（借 Haskell 的 syntax）、循环引用 GC、Unicode 支持。开发流程也彻底社区化，从此不再是"Guido 一个人写"。</> },
    en: { title: <>2.0 — list comprehensions + GC</>, desc: <>October 16, Python 2.0. Introduces <strong>list comprehensions</strong> (syntax borrowed from Haskell), a cycle-detecting garbage collector, and Unicode support. Development moves to a fully community-backed process — no longer "Guido alone."</> },
  },
  {
    year: '2005',
    zh: { title: <>NumPy 诞生 · 科学 Python 起航</>, desc: <>Travis Oliphant 把 Numeric 和 numarray 两个早期数值库合并为 <strong>NumPy</strong>，给 Python 一个真正高效的多维数组。这一刻起，物理、生物、金融的科学计算开始集体迁移到 Python——为十年后的深度学习浪潮埋好基建。</> },
    en: { title: <>NumPy is born — scientific Python takes off</>, desc: <>Travis Oliphant merges Numeric and numarray into <strong>NumPy</strong>, giving Python a truly efficient n-dimensional array. From this moment, physics, biology, and finance researchers begin migrating to Python en masse — laying the foundation for the deep-learning wave a decade later.</> },
  },
  {
    year: '2008',
    zh: { title: <>pandas 立项 · 数据科学开端</>, desc: <>Wes McKinney 在量化基金 AQR 受不了用 Excel + R 的折磨，开始写 <strong>pandas</strong>——一个仿 R DataFrame、跑在 NumPy 之上的表格数据库。2009 年 0.1 上 PyPI。今天全球 80% 的数据分析代码绕不开它。</> },
    en: { title: <>pandas — the data-science gateway</>, desc: <>Wes McKinney, frustrated with Excel + R at the hedge fund AQR, starts <strong>pandas</strong> — an R-style DataFrame on top of NumPy. Released to PyPI as 0.1 in 2009. Today roughly 80% of all data-analysis code on Earth touches it.</> },
  },
  {
    year: <>2008<small>·12</small></>,
    zh: { title: <>3.0 — 故意打破后向兼容</>, desc: <>12 月 3 日 Python 3.0（"Py3K"）发布。<code>print</code> 从语句改成函数、字符串默认 Unicode、整数除法 <code>/</code> 改语义——<em>故意</em>不向后兼容，为修长期的设计债。代价是社区被劈成两半，整整 12 年才汇流。</> },
    en: { title: <>3.0 — intentionally backward-incompatible</>, desc: <>December 3. Python 3.0 ("Py3K") is the first <em>deliberate</em> backward-incompatible release: <code>print</code> becomes a function, strings default to Unicode, integer division <code>/</code> changes semantics. The community splits in two; reunification takes 12 years.</> },
  },
  {
    year: '2014',
    zh: { title: <>Project Jupyter — IPython 进化</>, desc: <>Fernando Pérez 在博士读期间（2001）写的交互式 shell <code>IPython</code>，2011 年长出浏览器 Notebook 形态，2014 年正式独立成 <strong>Jupyter</strong>（名字暗指 Julia / Python / R）。"代码 + 文字 + 图表"的可执行论文形式从此成为科学界标准——GitHub 上有近 1000 万个 <code>.ipynb</code>。</> },
    en: { title: <>Project Jupyter — IPython evolves</>, desc: <>The interactive shell <strong>IPython</strong>, created by Fernando Pérez during a 2001 PhD afternoon, grows a browser notebook in 2011 and forks into <strong>Project Jupyter</strong> in 2014 (the name nods to Julia / Python / R). "Code + prose + figures" as an executable paper becomes the science-world default — GitHub now hosts ~10 million <code>.ipynb</code> files.</> },
  },
  {
    year: <>2015<small>·09</small></>,
    zh: { title: <>3.5 — type hints (PEP 484)</>, desc: <>9 月 13 日。Guido 亲自推动 <strong>PEP 484</strong> 落地：<code>def f(x: int) -&gt; str:</code>。这是被很多人骂"Python 也要走 Java 老路"的争议特性，但十年后它撑起了 mypy / pyright / IDE 智能补全 / FastAPI / pydantic / LangChain——type hints 是 2015 年最被低估的决定。</> },
    en: { title: <>3.5 — type hints (PEP 484)</>, desc: <>September 13. Guido personally drives <strong>PEP 484</strong>: <code>def f(x: int) -&gt; str:</code>. Mocked at the time as "Python turning into Java," it underpins mypy, pyright, FastAPI, pydantic, and LangChain a decade later. PEP 484 is the most underrated Python decision of the 2010s.</> },
  },
  {
    year: '2016',
    zh: { title: <>PyTorch 1.0 / TensorFlow 流行</>, desc: <>2015 年 Google 开源 TensorFlow，2016 年底 Meta（当时还叫 Facebook）开源 <strong>PyTorch</strong>。两者都把 Python 当首选 API。深度学习从此和 Python 绑死——研究员只想写 NumPy 风格的代码，不想写 C++ 模板。</> },
    en: { title: <>PyTorch / TensorFlow lock in Python</>, desc: <>Google open-sources TensorFlow in 2015; Facebook open-sources <strong>PyTorch</strong> in late 2016. Both pick Python as the primary API. Deep learning becomes synonymous with Python — researchers want NumPy-style code, not C++ templates.</> },
  },
  {
    year: <>2018<small>·07</small></>,
    zh: { title: <>Guido 卸任 BDFL</>, desc: <>7 月 12 日。PEP 572（赋值表达式 <code>:=</code>）社区争吵激烈，Guido 留了一封"我累了，不想再为一个 PEP 苦战"的告别信，正式卸任 <em>Benevolent Dictator For Life</em>。年底社区投票成立 <strong>Steering Council</strong> 五人理事会，Guido 第一年仍在席。</> },
    en: { title: <>Guido steps down as BDFL</>, desc: <>July 12. After the bruising PEP 572 fight (the walrus operator <code>:=</code>), Guido resigns as <em>Benevolent Dictator For Life</em> with a tired farewell. By December the community votes to install a five-seat <strong>Steering Council</strong>. Guido remains a member for the first year.</> },
  },
  {
    year: <>2020<small>·01</small></>,
    zh: { title: <>Python 2 EOL</>, desc: <>1 月 1 日。Python 2.7 正式停更，pythonclock.org 倒数到 0。从 3.0 发布到 2 EOL，过渡花了整整 12 年——这场分裂留下深刻教训：以后 Python 再也没敢搞过破坏性更新。</> },
    en: { title: <>Python 2 EOL</>, desc: <>January 1. Python 2.7 is officially end-of-life; the pythonclock.org countdown hits zero. From the 3.0 release to 2 EOL: 12 years. Lesson learned — Python has not attempted a breaking release since.</> },
  },
  {
    year: '2021',
    zh: { title: <>Microsoft 雇 Guido · Faster CPython 立项</>, desc: <>Guido 退休后被微软请回，组 Mark Shannon 领衔的 <strong>Faster CPython</strong> 团队。目标：5 年内让 Python 快 5 倍。3.11（2022）落地第一波——<strong>~25% 平均提速</strong>，部分场景 60%。后续版本继续加 specializing interpreter、JIT。</> },
    en: { title: <>Microsoft hires Guido · Faster CPython</>, desc: <>Microsoft brings Guido out of retirement to lead the <strong>Faster CPython</strong> team under Mark Shannon. Goal: 5× speedup over five releases. Python 3.11 (2022) lands the first installment — <strong>~25% average</strong>, up to 60% in some workloads.</> },
  },
  {
    year: <>2023<small>·07</small></>, highlight: true,
    zh: { title: <>PEP 703 通过 — GIL 可以被关</>, desc: <>Sam Gross 提出 <strong>PEP 703</strong>：把 30 年没动过的 <em>Global Interpreter Lock</em> 变成可选。Steering Council 7 月正式接受。这是 Python 历史上最大的内部改造之一——多核时代终于看到曙光。</> },
    en: { title: <>PEP 703 accepted — GIL becomes optional</>, desc: <>Sam Gross's <strong>PEP 703</strong> proposes making the 30-year-old Global Interpreter Lock optional, via biased reference counting and fine-grained locking. The Steering Council formally accepts it in July. The biggest internal CPython refactor in its history.</> },
  },
  {
    year: <>2024<small>·10</small></>, highlight: true,
    zh: { title: <>3.13 — 实验性 free-threaded build</>, desc: <>10 月发布的 Python 3.13 第一次内置 <code>python3.13t</code>（带 <code>t</code> 即"threaded"），可关 GIL 跑真正的多线程并行。代价：单线程慢 ~40%。这是个 5 年大工程的起点，3.14 / 3.15 会逐步把单线程性能补回来。</> },
    en: { title: <>3.13 — experimental free-threaded build</>, desc: <>October. Python 3.13 ships with the first official <code>python3.13t</code> ("threaded") binary, GIL disabled, true multi-threaded parallelism. The cost: ~40% slower single-threaded — to be recovered in 3.14 / 3.15 over a five-year roadmap.</> },
  },
  {
    year: '2025', highlight: true,
    zh: { title: <>SO #2 已用语言 · GitHub #2 贡献者</>, desc: <>Stack Overflow 2025 调研：Python 同比增长 <strong>+7 个百分点</strong>，五年来最猛单年涨幅；GitHub Octoverse 2025：TypeScript 以约 <strong>4.2 万贡献者</strong>之差反超 Python，但 Python 同比仍 <strong>+48%</strong>——<em>不是 Python 萎了，是 AI 时代两强并起</em>。</> },
    en: { title: <>SO #2 used · GitHub #2 contributors</>, desc: <>Stack Overflow 2025: Python <strong>+7 percentage points</strong> year-on-year — the largest single-year jump in a decade. GitHub Octoverse 2025: TypeScript narrowly overtakes Python by ~<strong>42k contributors</strong>, with Python still up <strong>+48% YoY</strong>. <em>Python isn't shrinking — the AI era simply has two winners now.</em></> },
  },
];

interface PyCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const PY_CARDS: PyCard[] = [
  {
    tag: 'A',
    zh: { title: <>动态类型 + duck typing</>, desc: <>变量没有类型；函数不挑参数类型。能调对方法就放过。</> },
    en: { title: <>Dynamic typing + duck typing</>, desc: <>Variables have no types; functions don't filter arguments by type. If the right method exists, it works.</> },
    code: (
      <code>
        <span className="cl-k">def</span> <span className="cl-fn">quack</span>(<span className="cl-v">x</span>):{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-v">x</span>.<span className="cl-fn">quack</span>(){'\n\n'}
        <span className="cl-c"><L zh="# 鸭子可以是真鸭子" en="# A duck works," /></span>{'\n'}
        <span className="cl-c"><L zh="# 也可以是任何有 .quack() 的东西" en="# so does anything with .quack()" /></span>{'\n'}
        <span className="cl-c"><L zh="# 不需要继承 Duck 基类" en="# No need to inherit from Duck" /></span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>列表 / 字典 / 集合推导</>, desc: <>一行表达"过滤 + 变换 + 收集"，比 <code>map</code> + <code>filter</code> 可读得多。</> },
    en: { title: <>List / dict / set comprehensions</>, desc: <>One line for "filter + transform + collect" — far more readable than nested <code>map</code> + <code>filter</code>.</> },
    code: (
      <code>
        <span className="cl-v">squares</span> = [<span className="cl-v">x</span>**<span className="cl-n">2</span> <span className="cl-k">for</span> <span className="cl-v">x</span> <span className="cl-k">in</span> <span className="cl-fn">range</span>(<span className="cl-n">10</span>) <span className="cl-k">if</span> <span className="cl-v">x</span>%<span className="cl-n">2</span>]{'\n'}
        <span className="cl-c"># [1, 9, 25, 49, 81]</span>{'\n\n'}
        <span className="cl-v">name_to_id</span> = {'{'}{'\n'}
        {'    '}<span className="cl-v">u</span>.<span className="cl-prop">name</span>: <span className="cl-v">u</span>.<span className="cl-prop">id</span>{'\n'}
        {'    '}<span className="cl-k">for</span> <span className="cl-v">u</span> <span className="cl-k">in</span> <span className="cl-v">users</span>{'\n'}
        {'    '}<span className="cl-k">if</span> <span className="cl-v">u</span>.<span className="cl-prop">active</span>{'\n'}
        {'}'}
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>装饰器 <code>@</code></>, desc: <>用一个高阶函数包另一个函数，就地改写它的行为。Flask / FastAPI / pytest 整套生态都靠这个。</> },
    en: { title: <>Decorators <code>@</code></>, desc: <>A higher-order function that wraps another function in place. Flask, FastAPI, and pytest are built around this single idea.</> },
    code: (
      <code>
        <span className="cl-deco">@app.route</span>(<span className="cl-s">"/api/users"</span>){'\n'}
        <span className="cl-deco">@cache</span>(<span className="cl-prop">ttl</span>=<span className="cl-n">60</span>){'\n'}
        <span className="cl-k">def</span> <span className="cl-fn">list_users</span>():{'\n'}
        {'    '}<span className="cl-k">return</span> <span className="cl-v">db</span>.<span className="cl-fn">query</span>(<span className="cl-type">User</span>).<span className="cl-fn">all</span>(){'\n\n'}
        <span className="cl-c"><L zh="# 一行加路由, 一行加缓存" en="# One line for routing, one for cache" /></span>{'\n'}
        <span className="cl-c"><L zh="# 没有 XML 配置, 没有继承 Servlet" en="# No XML config, no Servlet base class" /></span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>上下文管理器 <code>with</code></>, desc: <>资源借用 + 必释放，写错都难。文件、锁、事务、临时目录、HTTP 会话——全这一套。</> },
    en: { title: <>Context managers <code>with</code></>, desc: <>Acquire-then-release made hard to get wrong. Files, locks, transactions, temp directories, HTTP sessions — all use the same pattern.</> },
    code: (
      <code>
        <span className="cl-k">with</span> <span className="cl-fn">open</span>(<span className="cl-s">"x.txt"</span>) <span className="cl-k">as</span> <span className="cl-v">f</span>:{'\n'}
        {'    '}<span className="cl-v">data</span> = <span className="cl-v">f</span>.<span className="cl-fn">read</span>(){'\n'}
        <span className="cl-c"><L zh="# 出 with 块自动 close, 哪怕异常" en="# Auto-close on exit, even on exception" /></span>{'\n\n'}
        <span className="cl-k">with</span> <span className="cl-v">db</span>.<span className="cl-fn">transaction</span>():{'\n'}
        {'    '}<span className="cl-v">db</span>.<span className="cl-fn">execute</span>(...){'\n'}
        <span className="cl-c"><L zh="# 异常 = rollback, 正常 = commit" en="# exception = rollback, normal = commit" /></span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>生成器 + iterator</>, desc: <><code>yield</code> 把函数变成可暂停的迭代源。处理流式数据 / 大文件 / 无限序列时不爆内存。</> },
    en: { title: <>Generators + iterators</>, desc: <><code>yield</code> turns a function into a pausable iterator. Streaming data, huge files, infinite sequences — never blow up memory.</> },
    code: (
      <code>
        <span className="cl-k">def</span> <span className="cl-fn">read_lines</span>(<span className="cl-v">path</span>):{'\n'}
        {'    '}<span className="cl-k">with</span> <span className="cl-fn">open</span>(<span className="cl-v">path</span>) <span className="cl-k">as</span> <span className="cl-v">f</span>:{'\n'}
        {'        '}<span className="cl-k">for</span> <span className="cl-v">line</span> <span className="cl-k">in</span> <span className="cl-v">f</span>:{'\n'}
        {'            '}<span className="cl-k">yield</span> <span className="cl-v">line</span>.<span className="cl-fn">strip</span>(){'\n\n'}
        <span className="cl-c"><L zh="# 100GB 日志也只占几 KB 内存" en="# A 100GB log uses just a few KB" /></span>{'\n'}
        <span className="cl-k">for</span> <span className="cl-v">line</span> <span className="cl-k">in</span> <span className="cl-fn">read_lines</span>(<span className="cl-s">"huge.log"</span>):{'\n'}
        {'    '}<span className="cl-fn">process</span>(<span className="cl-v">line</span>)
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>type hints (3.5+)</>, desc: <>可选注解，运行时不强制，但 mypy / pyright / IDE 都吃。pydantic / FastAPI 还能在运行时把它当 schema 用。</> },
    en: { title: <>Type hints (3.5+)</>, desc: <>Optional annotations, not enforced at runtime, but consumed by mypy / pyright / IDEs. pydantic and FastAPI also use them as a schema.</> },
    code: (
      <code>
        <span className="cl-k">def</span> <span className="cl-fn">greet</span>(<span className="cl-v">name</span>: <span className="cl-type">str</span>, <span className="cl-v">n</span>: <span className="cl-type">int</span> = <span className="cl-n">1</span>) -&gt; <span className="cl-type">list</span>[<span className="cl-type">str</span>]:{'\n'}
        {'    '}<span className="cl-k">return</span> [<span className="cl-fn">f</span><span className="cl-s">"hello {'{name}'}"</span>] * <span className="cl-v">n</span>{'\n\n'}
        <span className="cl-c"><L zh="# IDE 跳转 / 补全 / 报错全靠它" en="# Drives go-to-def, autocomplete, errors" /></span>{'\n'}
        <span className="cl-c"># PEP 484 (3.5) → 585 (3.9) → 695 (3.12)</span>{'\n'}
        <span className="cl-c"><L zh="# 历经十年成事实标准" en="# A decade-long path to de-facto standard" /></span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>dataclass / 不可变</>, desc: <>3.7 起内置。不用再写一遍 <code>__init__</code> / <code>__repr__</code> / <code>__eq__</code>。</> },
    en: { title: <>dataclasses · immutable</>, desc: <>Built in since 3.7. No more hand-writing <code>__init__</code> / <code>__repr__</code> / <code>__eq__</code>.</> },
    code: (
      <code>
        <span className="cl-k">from</span> <span className="cl-type">dataclasses</span> <span className="cl-k">import</span> <span className="cl-fn">dataclass</span>{'\n\n'}
        <span className="cl-deco">@dataclass</span>(<span className="cl-prop">frozen</span>=<span className="cl-k">True</span>){'\n'}
        <span className="cl-k">class</span> <span className="cl-type">User</span>:{'\n'}
        {'    '}<span className="cl-prop">name</span>: <span className="cl-type">str</span>{'\n'}
        {'    '}<span className="cl-prop">age</span>: <span className="cl-type">int</span> = <span className="cl-n">0</span>{'\n\n'}
        <span className="cl-v">u</span> = <span className="cl-fn">User</span>(<span className="cl-s">"Anders"</span>, <span className="cl-n">64</span>){'\n'}
        <span className="cl-c"><L zh="# 自动有 .__init__ / __eq__ / __hash__" en="# Auto __init__ / __eq__ / __hash__" /></span>{'\n'}
        <span className="cl-c"><L zh="# frozen=True → 不可变" en="# frozen=True → immutable" /></span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>async / await</>, desc: <>3.5 起的协程语法。一个事件循环里跑成千上万的并发 IO，不用线程不用进程。FastAPI / aiohttp / Playwright Python 全靠它。</> },
    en: { title: <>async / await</>, desc: <>Coroutine syntax since 3.5. One event loop drives thousands of concurrent IO operations — no threads, no processes. FastAPI, aiohttp, Playwright Python all rely on it.</> },
    code: (
      <code>
        <span className="cl-k">async def</span> <span className="cl-fn">fetch</span>(<span className="cl-v">url</span>):{'\n'}
        {'    '}<span className="cl-k">async with</span> <span className="cl-v">session</span>.<span className="cl-fn">get</span>(<span className="cl-v">url</span>) <span className="cl-k">as</span> <span className="cl-v">r</span>:{'\n'}
        {'        '}<span className="cl-k">return</span> <span className="cl-k">await</span> <span className="cl-v">r</span>.<span className="cl-fn">text</span>(){'\n\n'}
        <span className="cl-v">results</span> = <span className="cl-k">await</span> <span className="cl-fn">asyncio</span>.<span className="cl-fn">gather</span>(*[{'\n'}
        {'    '}<span className="cl-fn">fetch</span>(<span className="cl-v">u</span>) <span className="cl-k">for</span> <span className="cl-v">u</span> <span className="cl-k">in</span> <span className="cl-v">urls</span>{'\n'}
        ]){'\n'}
        <span className="cl-c"><L zh="# 1000 个请求并发, 一个进程" en="# 1000 concurrent requests, one process" /></span>
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
    zh: { title: <>15 分钟从想法到结果</>, desc: <>没有项目脚手架、没有编译、没有类型推导。想数一下 100GB 日志里 IP 出现频次？四行 <code>collections.Counter</code>。原型阶段的 Python 几乎没竞争对手。</> },
    en: { title: <>Idea to result in 15 minutes</>, desc: <>No project scaffold, no compile step, no type-system gymnastics. Want the top 10 IPs in a 100GB log? Four lines using <code>collections.Counter</code>. Few languages can match Python at the prototype stage.</> },
    code: <><span className="cl-k">from</span> <span className="cl-type">collections</span> <span className="cl-k">import</span> <span className="cl-fn">Counter</span>{'\n'}<span className="cl-fn">Counter</span>(<span className="cl-fn">open</span>(<span className="cl-v">f</span>)).<span className="cl-fn">most_common</span>(<span className="cl-n">10</span>)</>,
  },
  {
    icon: '⎇',
    zh: { title: <>可读如伪代码</>, desc: <>Python 长得像可执行的伪代码。Guido 的设计原则——"代码读的次数远多于写的次数"——让它成为算法书 / CS101 / 论文 example 的事实标准。</> },
    en: { title: <>Reads like pseudocode</>, desc: <>Python looks like executable pseudocode. Guido's principle — "code is read more often than written" — is why algorithm textbooks, CS101 courses, and academic paper appendices use it.</> },
    code: <><span className="cl-k">if</span> <span className="cl-v">x</span> <span className="cl-k">in</span> <span className="cl-v">cache</span>:{'\n'}{'    '}<span className="cl-k">return</span> <span className="cl-v">cache</span>[<span className="cl-v">x</span>]{'\n'}<span className="cl-c"><L zh="# 没有人需要解释这是什么" en="# Needs no further explanation" /></span></>,
  },
  {
    icon: '⛯',
    zh: { title: <>科学/数据/AI 头牌</>, desc: <>NumPy / pandas / SciPy / scikit-learn / matplotlib / PyTorch / JAX / Hugging Face——全是 Python first。这条壕沟过去 20 年累出来的，短期不会被任何后来者填平。</> },
    en: { title: <>King of science / data / AI</>, desc: <>NumPy, pandas, SciPy, scikit-learn, matplotlib, PyTorch, JAX, Hugging Face — all Python first. A 20-year moat that no newcomer will fill in the short term.</> },
    code: <><span className="cl-k">import</span> <span className="cl-type">torch</span>{'\n'}<span className="cl-v">model</span> = <span className="cl-fn">AutoModel</span>.<span className="cl-fn">from_pretrained</span>(...){'\n'}<span className="cl-c"><L zh="# 三行就能跑起一个 7B 模型" en="# 3 lines to load and run a 7B model" /></span></>,
  },
  {
    icon: '⚙',
    zh: { title: <>胶水语言 — C/C++/Rust 的友好脸</>, desc: <>慢的部分扔给 C 扩展、Cython、PyO3。Python 当外层 API、底层用任何快语言写。NumPy / PyTorch / pandas 都是这套——用 Python 写 80% 代码，跑 100% C 速度。</> },
    en: { title: <>Glue language to C / C++ / Rust</>, desc: <>Slow code paths offload to C extensions, Cython, or PyO3. Python is the API surface; the hot loops run in any fast language. NumPy, PyTorch, pandas all do this — write 80% in Python, run at 100% native speed.</> },
    code: <><span className="cl-c"><L zh="# 表面是 Python:" en="# On the surface — Python:" /></span>{'\n'}<span className="cl-v">a</span> @ <span className="cl-v">b</span>{'\n'}<span className="cl-c"><L zh="# 底下是 BLAS / cuBLAS / Metal" en="# Underneath — BLAS / cuBLAS / Metal" /></span></>,
  },
  {
    icon: '⌬',
    zh: { title: <>PyPI · 60 万 + 包</>, desc: <>从 OCR 到比特币、从遗传算法到 LaTeX 渲染——你想得到的领域 PyPI 上都有人写过。<code>pip install</code> 一行就完事；<code>uv</code> 来了之后比 npm 还快。</> },
    en: { title: <>PyPI · 600k+ packages</>, desc: <>From OCR to Bitcoin, from genetic algorithms to LaTeX rendering — whatever your domain, someone has shipped a PyPI package. <code>pip install</code> handles it; with <code>uv</code> it's now faster than npm.</> },
    code: <>pip install requests pandas torch{'\n'}<span className="cl-c"><L zh="# 三行装好爬虫 + 表格 + AI 框架" en="# Scraper + tables + AI in three packages" /></span></>,
  },
  {
    icon: '⌖',
    zh: { title: <>教育/科普通用语</>, desc: <>MIT / 伯克利 / 清华的 CS 入门课基本都用 Python。《Automate the Boring Stuff》是会计师都能读的编程书。会写代码 ≈ 会写 Python，已经成了一代人的默认。</> },
    en: { title: <>The teaching lingua franca</>, desc: <>MIT, Berkeley, and most major CS programs use Python as their first language. <em>Automate the Boring Stuff</em> is the book your accountant cousin can read. "Learning to code" essentially means learning Python for an entire generation.</> },
    code: <><span className="cl-c"><L zh="# 第一节课就能让初中生写出" en="# Day-one program for a 7th grader:" /></span>{'\n'}<span className="cl-fn">print</span>(<span className="cl-s">"Hello, world!"</span>){'\n'}<span className="cl-c"><L zh="# 不用解释 main / class / public" en="# No need to explain main / class / public" /></span></>,
  },
  {
    icon: '⌗',
    zh: { title: <>跨平台原生</>, desc: <>同一份 <code>.py</code> 在 Linux / macOS / Windows / BSD / 树莓派 / 树莓派 Zero / iOS（Pyto）几乎都能跑。脚本类工具不用打包多份二进制。</> },
    en: { title: <>Cross-platform native</>, desc: <>The same <code>.py</code> runs on Linux, macOS, Windows, BSD, Raspberry Pi, even iOS via Pyto. For scripting tools you don't ship multiple binaries.</> },
    code: <><span className="cl-c"><L zh="# macOS 写好" en="# Author on macOS" /></span>{'\n'}<span className="cl-c"><L zh="# Windows 同事 clone 直接跑" en="# Coworker clones on Windows" /></span>{'\n'}<span className="cl-c"><L zh="# Linux 服务器 systemd 部署" en="# Deploy to Linux via systemd" /></span>{'\n'}<span className="cl-c"><L zh="# 一份代码三处用" en="# One source, three platforms" /></span></>,
  },
  {
    icon: '⏚',
    zh: { title: <>REPL — 即写即问</>, desc: <><code>python</code> 一回车就是交互式环境。不知道一个对象长什么样？<code>dir(x)</code>。Jupyter / IPython 把这一文化推到极致——分析数据时你 80% 时间在 REPL。</> },
    en: { title: <>The REPL — ask the program</>, desc: <>Type <code>python</code> and you're in an interactive shell. Don't know an object? <code>dir(x)</code>. IPython and Jupyter doubled down on this culture — analysts spend 80% of their time in the REPL.</> },
    code: <>&gt;&gt;&gt; <span className="cl-fn">dir</span>(<span className="cl-v">obj</span>){'\n'}&gt;&gt;&gt; <span className="cl-fn">help</span>(<span className="cl-v">x</span>){'\n'}<span className="cl-c"><L zh="# 不用查文档, 对象自己说" en="# Don't look it up — ask the object" /></span></>,
  },
  {
    icon: '⚐',
    zh: { title: <>社区 / PSF 治理稳</>, desc: <>Steering Council 五人理事会一年一选。PEP 流程透明、争议公开。30 多年没分裂、没大撕、没"谁谁愤而 fork"——这在开源世界本身就是异类。</> },
    en: { title: <>Stable governance via PSF</>, desc: <>A five-seat Steering Council, elected annually. Public PEP discussions. 30+ years without a fork, schism, or "founder leaves in protest" — almost unheard of in open source.</> },
    code: <><span className="cl-c"><L zh="# 任何人都可以提 PEP" en="# Anyone can submit a PEP" /></span>{'\n'}<span className="cl-c"><L zh="# 大变化必须走完讨论流程" en="# Big changes go through full debate" /></span>{'\n'}<span className="cl-c"><L zh="# 没有'创始人一句话定生死'" en="# No 'founder veto' any more" /></span></>,
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
    zhNote: 'Meta · 63% AI 模型用它训', enNote: 'Meta · 63% of training',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="32" r="6" fill="#EE4C2C"/><path d="M50 18 C30 18 18 38 18 58 C18 78 32 92 50 92 C68 92 82 78 82 58 C82 38 70 18 50 18 Z M50 30 C62 30 70 44 70 58 C70 70 60 80 50 80 C40 80 30 70 30 58 C30 44 38 30 50 30 Z" fill="#EE4C2C"/></svg>,
  },
  {
    href: 'https://huggingface.co', highlight: true,
    zhName: 'Hugging Face', enName: 'Hugging Face',
    zhNote: '100 万+ 开源模型 hub', enNote: '1M+ open-source models',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#FFD43B"/><circle cx="38" cy="46" r="4" fill="#000"/><circle cx="62" cy="46" r="4" fill="#000"/><path d="M30 60 Q50 75 70 60" stroke="#000" strokeWidth="3" fill="none"/><circle cx="22" cy="62" r="6" fill="#FF9D45" opacity=".8"/><circle cx="78" cy="62" r="6" fill="#FF9D45" opacity=".8"/></svg>,
  },
  {
    href: 'https://www.tensorflow.org', highlight: true,
    zhName: 'TensorFlow', enName: 'TensorFlow',
    zhNote: 'Google · DL 框架', enNote: 'Google · DL framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 10 L80 28 L80 72 L50 90 L20 72 L20 28 Z" fill="#FF6F00"/><path d="M50 10 L50 90 M20 28 L80 72" stroke="#fff" strokeWidth="3" fill="none"/><text x="50" y="58" fontFamily="monospace" fontSize="22" fontWeight="bold" textAnchor="middle" fill="#fff">TF</text></svg>,
  },
  {
    href: 'https://jax.readthedocs.io', highlight: true,
    zhName: 'JAX', enName: 'JAX',
    zhNote: 'Google · NumPy + autograd + XLA', enNote: 'Google · NumPy + autograd + XLA',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#5E97F6"/><text x="50" y="62" fontFamily="monospace" fontSize="32" fontWeight="bold" textAnchor="middle" fill="#fff">JAX</text></svg>,
  },
  {
    href: 'https://numpy.org',
    zhName: 'NumPy', enName: 'NumPy',
    zhNote: '2005 起 · 数值数组', enNote: '2005 · numerical arrays',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><path d="M50 10 L82 28 V68 L50 86 L18 68 V28 Z" fill="#4DABCF"/><text x="50" y="60" fontFamily="monospace" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#013243">NumPy</text></svg>,
  },
  {
    href: 'https://pandas.pydata.org',
    zhName: 'pandas', enName: 'pandas',
    zhNote: 'Wes McKinney · DataFrame', enNote: 'Wes McKinney · DataFrame',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="20" y="20" width="14" height="60" fill="#130754"/><rect x="42" y="35" width="14" height="45" fill="#130754"/><rect x="64" y="20" width="14" height="60" fill="#FFCA00"/></svg>,
  },
  {
    href: 'https://jupyter.org',
    zhName: 'Jupyter', enName: 'Jupyter',
    zhNote: '浏览器 notebook · ~10M repos', enNote: 'Browser notebooks · ~10M repos',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="30" cy="30" r="8" fill="#F37726"/><circle cx="70" cy="30" r="8" fill="#F37726"/><circle cx="50" cy="80" r="8" fill="#F37726"/><path d="M20 55 Q50 75 80 55" stroke="#F37726" strokeWidth="6" fill="none"/></svg>,
  },
  {
    href: 'https://scikit-learn.org',
    zhName: 'scikit-learn', enName: 'scikit-learn',
    zhNote: '经典 ML · 一行装上随机森林', enNote: 'Classical ML · one-line classifiers',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#F89939"/><text x="50" y="58" fontFamily="monospace" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#3499CD">sklearn</text></svg>,
  },
  {
    href: 'https://fastapi.tiangolo.com',
    zhName: 'FastAPI', enName: 'FastAPI',
    zhNote: 'type hints 驱动的现代 API 框架', enNote: 'Type-hint-driven API framework',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#009688"/><path d="M55 22 L35 55 H50 L40 78 L65 45 H50 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.djangoproject.com',
    zhName: 'Django', enName: 'Django',
    zhNote: 'Instagram / Pinterest 后端', enNote: 'Instagram, Pinterest back-ends',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect x="10" y="10" width="80" height="80" rx="8" fill="#092E20"/><text x="50" y="60" fontFamily="serif" fontSize="28" fontWeight="bold" fontStyle="italic" textAnchor="middle" fill="#fff">Dj</text></svg>,
  },
  {
    href: 'https://www.langchain.com',
    zhName: 'LangChain', enName: 'LangChain',
    zhNote: 'LLM 应用编排 · Python 原生', enNote: 'LLM orchestration · Python-native',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#1C3D2E"/><path d="M28 40 L42 40 L42 30 L58 50 L42 70 L42 60 L28 60 Z M72 60 L58 60 L58 70 L42 50 L58 30 L58 40 L72 40 Z" fill="#3CDC9D"/></svg>,
  },
  {
    href: 'https://www.python.org/about/success/usa/',
    zhName: 'NASA / CERN', enName: 'NASA / CERN',
    zhNote: '航天器 / 粒子加速器分析', enNote: 'Spacecraft / particle accel. analysis',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><circle cx="50" cy="50" r="40" fill="#0B3D91"/><circle cx="50" cy="50" r="30" fill="#fff"/><circle cx="50" cy="50" r="20" fill="#FC3D21"/><text x="50" y="56" fontFamily="monospace" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#fff">NASA</text></svg>,
  },
];

interface AiTool { name: string; zhDesc: string; enDesc: string }
const AI_TOOLS: AiTool[] = [
  { name: 'PyTorch',                    zhDesc: 'Meta · 训练事实标准',                  enDesc: 'Meta · de-facto training framework' },
  { name: 'TensorFlow / Keras',         zhDesc: 'Google · 工业部署份额',               enDesc: 'Google · industrial deployment' },
  { name: 'JAX / Flax',                 zhDesc: 'Google DeepMind · TPU 主力',          enDesc: 'Google DeepMind · TPU-native' },
  { name: 'Hugging Face Transformers',  zhDesc: '100 万+ 开源模型',                     enDesc: '1M+ open-source models' },
  { name: 'LangChain',                  zhDesc: 'LLM 应用编排',                         enDesc: 'LLM application orchestration' },
  { name: 'LlamaIndex',                 zhDesc: 'RAG / 知识检索',                       enDesc: 'RAG / knowledge retrieval' },
  { name: 'vLLM',                       zhDesc: '高吞吐 LLM 推理引擎',                  enDesc: 'High-throughput LLM inference' },
  { name: 'DSPy',                       zhDesc: 'Stanford · prompt 编程框架',           enDesc: 'Stanford · prompt programming' },
  { name: 'scikit-learn',               zhDesc: '经典 ML · 老但依然好用',                enDesc: 'Classical ML · still the workhorse' },
  { name: 'XGBoost / LightGBM',         zhDesc: '梯度提升树 · Kaggle 神器',              enDesc: 'Gradient boosting · Kaggle weapon' },
  { name: 'NumPy / SciPy',              zhDesc: '所有数值库的根基',                      enDesc: 'Foundation of every numerical lib' },
  { name: 'pandas / Polars',            zhDesc: 'DataFrame · Polars 是 Rust 后端',     enDesc: 'DataFrame · Polars has Rust core' },
  { name: 'Jupyter / IPython',          zhDesc: '交互式分析 · 论文复现',                 enDesc: 'Interactive analysis · paper repro' },
  { name: 'matplotlib / Plotly / seaborn', zhDesc: '可视化三件套',                      enDesc: 'Visualization trio' },
  { name: 'FastAPI / pydantic',         zhDesc: 'type hints 驱动的 LLM API 服务',       enDesc: 'Type-hint-driven LLM API services' },
  { name: 'openai / anthropic SDK',     zhDesc: '大模型官方 Python 客户端',              enDesc: 'Official Python clients' },
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
    tag: <>HOT · 2024-10</>, hot: true, big: true,
    zh: {
      title: <>PEP 703 / 自由线程 Python</>,
      body: (<>
        <p>30 年的 GIL 终于看见出口。Sam Gross 的 PEP 703 把 reference counting 改成 biased、给每个 mutable 对象加细粒度锁，最终允许真正的多线程并行。<strong>3.13 实验、3.14 改进、3.15+ 默认可用</strong>——5 年级别的内部改造。</p>
        <p>代价：单线程慢 ~40%（已在快速改善中）。但对 ML 推理 / 数值并行 / 服务器多核场景是质变——以前必须 multiprocessing 复制 GB 级模型，未来一个进程就能跑满 64 核。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">3.12 GIL · 多线程 CPU 并行</span><span className="bar-val">×1</span></div>
          <div className="bar bar-new"><span className="bar-label">3.13t no-GIL · 8 核加速</span><span className="bar-val">×6-8</span></div>
        </div>
      </>),
    },
    en: {
      title: <>PEP 703 / Free-threaded Python</>,
      body: (<>
        <p>Three decades of GIL finally see an exit. Sam Gross's PEP 703 introduces biased reference counting and per-object fine-grained locking, enabling true multi-threaded parallelism. <strong>3.13 experimental, 3.14 maturing, 3.15+ default-capable</strong> — a five-year refactor.</p>
        <p>Cost: ~40% slower single-threaded today (improving fast). But for ML inference, numerical parallelism, and many-core servers it's a phase change — instead of multiprocessing-cloning a multi-GB model, one process can saturate 64 cores.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">3.12 GIL · multi-thread CPU</span><span className="bar-val">×1</span></div>
          <div className="bar bar-new"><span className="bar-label">3.13t no-GIL · 8 cores</span><span className="bar-val">×6-8</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'SPEED',
    zh: { title: <>Faster CPython · 5 年 5×</>, body: <><p>Mark Shannon 领的 Microsoft 团队目标：3.10 → 3.15 累计提速 5×。3.11 已交付 ~25%、3.12 / 3.13 继续累加 specializing interpreter、tier-2 优化器、JIT 雏形。<em>不需要改任何用户代码</em>。</p></> },
    en: { title: <>Faster CPython · 5× over 5 years</>, body: <><p>Mark Shannon's Microsoft team aims for cumulative 5× speedup from 3.10 to 3.15. 3.11 delivered ~25%; 3.12 / 3.13 build on the specializing interpreter, tier-2 optimizer, and a JIT prototype. <em>No code changes required from users.</em></p></> },
  },
  {
    tag: 'RUST',
    zh: { title: <>Astral · OpenAI 收购 · uv / ruff</>, body: <><p>2026-03 OpenAI 收购 Astral，把 <strong>uv</strong>（包管理器，比 pip 快 80×）和 <strong>ruff</strong>（linter，比 Flake8 快 100×）正式接到 Codex 团队。Python 工具链的 Rust 化基本不可逆。</p></> },
    en: { title: <>Astral acquired by OpenAI · uv / ruff</>, body: <><p>March 2026: OpenAI acquires Astral, folding <strong>uv</strong> (80× faster than pip) and <strong>ruff</strong> (100× faster than Flake8) into the Codex team. Rustification of Python tooling is now effectively irreversible.</p></> },
  },
  {
    tag: 'DATA',
    zh: { title: <>Stack Overflow 2025: +7pp</>, body: <><p>2025 年 Python 单年涨 7 个百分点——五年来最大单年涨幅，由 AI 浪潮直接驱动。81% 开发者在用 AI 工具，所有 AI 工具的 SDK 都把 Python 摆在第一位。</p></> },
    en: { title: <>SO 2025 · +7pp</>, body: <><p>Python's largest single-year jump in a decade, driven directly by the AI wave. With 81% of developers using AI tooling and every AI SDK leading with a Python client, the funnel converges on Python.</p></> },
  },
  {
    tag: 'AI',
    zh: { title: <>研究 → 工程的桥梁稳了</>, body: <><p>过去研究员写 PyTorch、工程师重写成 C++ 部署。今天 <code>torch.compile</code> + vLLM / TensorRT-LLM 让 PyTorch 直接吃到生产。"研究语言 = 工程语言"——这是 Python 最深的护城河。</p></> },
    en: { title: <>Research-to-production bridge stable</>, body: <><p>Researchers used to write PyTorch and engineers rewrote it in C++ for production. With <code>torch.compile</code> + vLLM / TensorRT-LLM, PyTorch runs as-is in production. "Research language = engineering language" — Python's deepest moat.</p></> },
  },
  {
    tag: 'EDU',
    zh: { title: <>下一代程序员的母语</>, body: <><p>美国 / 欧洲 CS101 普遍用 Python；中国信息学奥赛 NOI 已加入 Python；MIT 6.0001 / Berkeley CS61A 都换了。每一波"学编程"的新人，第一个 Hello World 大概率是 <code>print()</code>。</p></> },
    en: { title: <>The next generation's first language</>, body: <><p>US and European CS101 courses are largely Python; China's NOI olympiad now accepts Python; MIT 6.0001 and Berkeley CS61A are both Python-based. Whoever learns to code next, their first <code>Hello, world!</code> is most likely <code>print()</code>.</p></> },
  },
];

export default function PythonIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'Python — AI 时代的胶水语言'
      : 'Python — Glue of the AI Era';
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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--py-bright)' : '';
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
      <div ref={rootRef} className="python-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="py-blue-nav" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#5A9FD4" /><stop offset="1" stopColor="#306998" />
                </linearGradient>
                <linearGradient id="py-yellow-nav" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FFE873" /><stop offset="1" stopColor="#FFD43B" />
                </linearGradient>
              </defs>
              <path fill="url(#py-blue-nav)" d="M127 22c-44 0-41 19-41 19v20h42v6H64s-28-3-28 41 25 42 25 42h22v-25s-1-25 24-25h42s24 0 24-23V45s4-23-46-23zm-23 13a8 8 0 1 1 0 15 8 8 0 0 1 0-15z" />
              <path fill="url(#py-yellow-nav)" d="M129 234c44 0 41-19 41-19v-20h-42v-6h64s28 3 28-41-25-42-25-42h-22v25s1 25-24 25h-42s-24 0-24 23v40s-4 23 46 23zm23-13a8 8 0 1 1 0-15 8 8 0 0 1 0 15z" />
            </svg>
            <span>Python</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="精要" en="Essentials" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="谁用" en="Users" /></a></li>
            <li><a href="#ai"><L zh="AI 时代" en="AI Era" /></a></li>
            <li><a href="#vs"><L zh="对比" en="Compare" /></a></li>
            <li><a href="#future"><L zh="前景" en="Future" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1989 — 2026 · CWI / PSF · Guido van Rossum</div>
            <h1 className="hero-title">
              <span className="hero-name">Python</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">batteries included</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>1989 年圣诞假期一个荷兰人写来打发时间的"业余项目"，35 年后撑起全球 AI / 数据科学 / 教学的<strong>半壁江山</strong>——从你电脑里的爬虫脚本，到 ChatGPT 训练用的 PyTorch，再到 NASA 控制土星探测器的代码，全是同一门语言。</>}
                en={<>A side project Guido van Rossum started during the 1989 Christmas holidays "to keep me occupied." Thirty-five years later, it powers <strong>half of the world's</strong> AI research, data analysis, and CS education — from your shell scripts to the PyTorch code that trained ChatGPT, to the Python modules onboard NASA spacecraft.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">63<small>%</small></span>
                <span className="stat-label"><L zh={<>AI 模型用 PyTorch 训<br /><em>Linux Foundation 2024</em></>} en={<>AI models on PyTorch<br /><em>Linux Foundation 2024</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">+7<small>pp</small></span>
                <span className="stat-label"><L zh={<>2024 → 2025 单年涨幅<br /><em>Stack Overflow Survey</em></>} en={<>2024 → 2025 single-year jump<br /><em>Stack Overflow Survey</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">#2<small></small></span>
                <span className="stat-label"><L zh={<>GitHub 贡献者排行<br /><em>TS 反超 +42k · Octoverse 2025</em></>} en={<>GitHub contributors rank<br /><em>TS overtook by +42k · Octoverse 2025</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">PEP<small>703</small></span>
                <span className="stat-label"><L zh={<>摆脱 GIL 锁实验启动<br /><em>3.13t · 2024-10</em></>} en={<>GIL is now optional<br /><em>3.13t · Oct 2024</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {PY_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">def __init__</span>
              <span className="float f2">import this</span>
              <span className="float f3">async def</span>
              <span className="float f4">@dataclass</span>
              <span className="float f5">yield from</span>
              <span className="float f6">list[int]</span>
              <span className="float f7">with open</span>
              <span className="float f8">lambda x:</span>
              <span className="float f9">f"hello"</span>
              <span className="float f10">match x:</span>
              <span className="float f11">*args, **kw</span>
              <span className="float f12">{': -> None'}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>Python</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Python 是一门<strong>动态类型、解释执行、缩进表达块结构</strong>的通用编程语言。它不是为某个领域而生，但在过去三十年里它顺次拿下了脚本工具、Web 后端、运维自动化、科学计算、深度学习、大模型时代——从未真正退过场。</>}
                  en={<>Python is a <strong>dynamically typed, interpreted, indentation-structured</strong> general-purpose language. It was not built for any single domain, yet over three decades it has captured scripting, web back-ends, automation, scientific computing, deep learning, and the LLM era — without ever truly retreating from any of them.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="动态类型" en="Dynamic typing" />, tag: 'duck typing', p: <L zh={<>"如果它走起来像鸭子，叫起来像鸭子，那它就是鸭子"——变量不绑定类型，只看运行时行为是否对得上。代价是错误推迟到运行；收益是写起来极快。</>} en={<>"If it walks like a duck and quacks like a duck, it's a duck." Variables don't carry types — only the runtime behavior matters. The cost is errors deferred to runtime; the gain is speed of expression.</>} /> },
                { h: <L zh="缩进即语法" en="Indentation as syntax" />, tag: 'off-side rule', p: <L zh={<>没有大括号也没有 <code>begin/end</code>。代码块靠四个空格的缩进表达。强迫所有 Python 代码长得差不多——风格之争从源头被掐死。</>} en={<>No braces, no <code>begin/end</code>. Code blocks are expressed by 4-space indentation. Every Python file ends up looking similar — style debates die at the source.</>} /> },
                { h: <L zh="解释执行" en="Interpreted" />, tag: 'no compile step', p: <L zh={<>不需要单独的编译步骤，<code>python foo.py</code> 直接跑。CPython 把源码先编译成字节码（<code>.pyc</code>）再由虚拟机解释执行——慢，但即改即用。</>} en={<>Run <code>python foo.py</code> directly. CPython compiles source to bytecode (<code>.pyc</code>) and runs it on a VM — slower, but instant edit-and-go.</>} /> },
                { h: <L zh="电池齐全" en="Batteries included" />, tag: 'stdlib first', p: <L zh={<>标准库覆盖文件 / 网络 / JSON / 加密 / 子进程 / 测试 / GUI——装好就能用。这一哲学是 Guido 1990 年代定的，30 年没变。</>} en={<>The standard library covers files, networking, JSON, crypto, subprocess, testing, GUI — usable out of the box. A philosophy Guido fixed in the 1990s and 30 years haven't changed.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">word_count.c</span><span className="lang-tag c-lang">C</span></div>
                <pre className="code"><code>
                  <span className="cl-c"><L zh="// C: 120 行 + malloc / free / 哈希表" en="// C: 120 lines + malloc / free / hashtable" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 还要小心 segfault" en="// Watch out for segfaults" /></span>{'\n'}
                  <span className="cl-k">#include</span> &lt;<span className="cl-s">stdio.h</span>&gt;{'\n'}
                  <span className="cl-k">#include</span> &lt;<span className="cl-s">stdlib.h</span>&gt;{'\n'}
                  <span className="cl-k">#include</span> &lt;<span className="cl-s">string.h</span>&gt;{'\n\n'}
                  <span className="cl-c"><L zh="// ... 自己写哈希表 ..." en="// ... roll your own hashtable ..." /></span>{'\n'}
                  <span className="cl-c"><L zh="// ... fopen / fgets / 切词 ..." en="// ... fopen / fgets / tokenize ..." /></span>{'\n'}
                  <span className="cl-c"><L zh="// ... 排序输出 ..." en="// ... sort and print ..." /></span>{'\n'}
                  <span className="cl-c"><L zh="// ... 别忘了 free ..." en="// ... don't forget to free() ..." /></span>{'\n\n'}
                  <span className="cl-c"><L zh="// 编译: gcc -O2 word_count.c" en="// gcc -O2 word_count.c" /></span>{'\n'}
                  <span className="cl-c"><L zh="// 100MB 文本 ≈ 0.8s" en="// 100MB text ≈ 0.8s" /></span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">word_count.py</span><span className="lang-tag py">Python</span></div>
                <pre className="code"><code>
                  <span className="cl-k">from</span> <span className="cl-type">collections</span> <span className="cl-k">import</span> <span className="cl-fn">Counter</span>{'\n\n'}
                  <span className="cl-v">words</span> = <span className="cl-fn">open</span>(<span className="cl-s">"book.txt"</span>).<span className="cl-fn">read</span>().<span className="cl-fn">split</span>(){'\n'}
                  <span className="cl-k">for</span> <span className="cl-v">w</span>, <span className="cl-v">n</span> <span className="cl-k">in</span> <span className="cl-fn">Counter</span>(<span className="cl-v">words</span>).<span className="cl-fn">most_common</span>(<span className="cl-n">10</span>):{'\n'}
                  {'    '}<span className="cl-fn">print</span>(<span className="cl-v">w</span>, <span className="cl-v">n</span>){'\n\n'}
                  <span className="cl-c"><L zh="# 4 行 · 直接跑 · 100MB ≈ 5s" en="# 4 lines · runs as-is · 100MB ≈ 5s" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 速度差 6×, 代码差 30×" en="# 6× slower, 30× shorter" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 在 99% 的脚本场景里, Python 赢" en="# For 99% of scripts, Python wins" /></span>
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
                zh={<>从一个荷兰人圣诞假期消遣的副业，到全球教学语言、AI 时代头牌——35 年里发生了什么。</>}
                en={<>From a Dutchman's Christmas hobby to the universal teaching language and the AI era's headline tongue — what happened in 35 years.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language essentials" /> <code>: PythonAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>Python 的"工程级特性"基本都是从 1.0 时代慢慢加进来的。下面这八件套，是写任何中型 Python 项目都绕不过去的核心。</>}
                en={<>Python's "engineering-grade" features were grafted in slowly across versions. The eight items below are the core that any non-trivial Python project relies on.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {PY_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何要用" en="Why use" /> <code>: WhyPython</code></h2>
              <p className="sec-desc"><L
                zh={<>Python 不是最快的、不是最严谨的、不是最酷的——但在"想清楚一件事 → 跑出结果"这条路径上，它的总耗时多年都是最低。</>}
                en={<>Python is not the fastest, the most rigorous, or the trendiest. But on the path from idea to result, its total elapsed time has been the shortest for years.</>}
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
              <h2 className="sec-title"><L zh="谁在用" en="Who uses it" /> <code>: ProductionUsers</code></h2>
              <p className="sec-desc"><L
                zh={<>Python 是 AI 实验室的母语、是数据团队的默认 SQL 替代、是天文台的脚本桥梁、是 NASA 的子模块、是 Instagram 的后端。下面 12 个项目，跨度从大模型到 Web 框架到数据可视化。</>}
                en={<>Python is the lingua franca of AI labs, the SQL-replacement of choice for data teams, the script glue at observatories, a NASA submodule, and the Instagram back-end. The 12 projects below span LLM frameworks, web stacks, and scientific visualization.</>}
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
              <h2 className="sec-title"><L zh="AI / 数据科学时代" en="The AI / data-science era" /> <code>: Python</code></h2>
              <p className="sec-desc"><L
                zh={<>2010 年代被 Google / Facebook 选中以后，Python 在科学计算这条路上越走越窄、越走越深。今天全球 AI 研究员的母语、几乎所有大模型训练 / 推理框架的 API、Jupyter 论文复现的事实标准——三件事都是它。</>}
                en={<>After being chosen by Google and Meta in the 2010s, Python's path through scientific computing narrowed and deepened. Today it is the native tongue of AI researchers, the API of nearly every training and inference framework, and the de-facto reproducible-paper format via Jupyter — three roles in one language.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>Python 之所以在科学计算和 AI 里赢，是因为它<strong>不强迫你写一种特定的代码风格</strong>。你可以一行行 hack 出原型，也可以一层层抽象到工业级。研究员要的是离他们脑中数学最近的语言；他们不在乎 GIL 和速度，因为 NumPy 已经把热点都送到 C 里去了。</>}
                en={<>Python won in scientific computing and AI because it <strong>does not force a single coding style</strong>. You can hack a prototype line by line, or layer abstractions up to industrial grade. Researchers want a language as close as possible to the math in their head; they don't care about the GIL or single-thread speed because NumPy already pushes the hot loops down to C.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author"><L zh="— Guido van Rossum (复述)" en="— Guido van Rossum (paraphrased)" /></span>
                <span className="quote-context"><L zh="Python 之父 · Microsoft Faster CPython · 2022" en="Python's creator · Microsoft Faster CPython · 2022" /></span>
              </footer>
            </blockquote>

            <div className="ai-stats">
              <div className="ai-stat">
                <div className="ai-stat-num">63<small>%</small></div>
                <div className="ai-stat-h"><L zh="AI 模型在 PyTorch 上训" en="of AI models trained on PyTorch" /></div>
                <p><L
                  zh={<>Linux Foundation 2024 调研：<strong>63%</strong> 的训练管线、<strong>70%</strong> 的研究实现、<strong>55%+</strong> 的 NeurIPS/ICML 论文用 PyTorch；TensorFlow / JAX 分剩下的份。三者都是 Python first。</>}
                  en={<>Linux Foundation 2024 survey: <strong>63%</strong> of training pipelines, <strong>70%</strong> of research implementations, and <strong>55%+</strong> of NeurIPS/ICML papers use PyTorch. TensorFlow and JAX share the rest. All three are Python first.</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">~10<small>M</small></div>
                <div className="ai-stat-h"><L zh="Jupyter notebooks 公开仓" en="public Jupyter notebooks" /></div>
                <p><L
                  zh={<>GitHub 上有近 1000 万个 <code>.ipynb</code>。论文复现、教程、Kaggle 题解、AI 教程——基本都长这个样。<em>Nature</em> 2021 把 Jupyter 列入"改变科学的十大代码"。</>}
                  en={<>GitHub holds nearly 10 million <code>.ipynb</code> files: paper reproductions, tutorials, Kaggle solutions, AI primers — almost all of them. <em>Nature</em> in 2021 listed Jupyter among the "ten codes that transformed science."</>}
                /></p>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-num">+7<small>pp</small></div>
                <div className="ai-stat-h"><L zh="2025 单年增幅" en="single-year jump in 2025" /></div>
                <p><L
                  zh={<>Stack Overflow 2025 调研：Python 同比 +7 个百分点，是十年来单年最大涨幅。原因明摆——AI 浪潮把所有想沾点深度学习的人推到 Python 这边。</>}
                  en={<>Stack Overflow 2025: Python grew by <strong>+7 percentage points</strong> year-on-year — its largest single-year jump in a decade. The cause is obvious: the AI wave funneled everyone wanting to touch ML toward Python.</>}
                /></p>
              </div>
            </div>

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>PyTorch <span className="spotlight-meta">— Meta · Linux Foundation</span></h3>
                  <p><L
                    zh={<>2016 年底 Facebook AI Research 开源，原本是给内部研究员的"NumPy + autograd"实验。2018 后逐渐压过 TensorFlow，成为深度学习圈第一框架。2022 年捐给 Linux Foundation 独立治理。</>}
                    en={<>Open-sourced by Facebook AI Research in late 2016 as an internal "NumPy + autograd" experiment. Overtook TensorFlow in popularity by 2018; donated to the Linux Foundation in 2022 for independent governance.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong><L zh="动态图" en="Dynamic graph" /></strong> — <L zh="写出来什么就跑什么，调试像普通 Python" en="what you write is what runs; debugging feels like normal Python" /></li>
                    <li><strong>autograd</strong> — <L zh="自动求导，张量自带梯度回路" en="automatic differentiation; tensors carry a gradient tape" /></li>
                    <li><strong>torch.compile</strong> — <L zh="2.0 起的 JIT 编译，速度直追手写 CUDA" en="JIT compilation in 2.0+, approaching hand-written CUDA" /></li>
                    <li><strong><L zh="5 万亿次推理 / 天" en="5T inferences / day" /></strong> — <L zh="跑在 50+ Meta 数据中心" en="across 50+ Meta data centers" /></li>
                  </ul>
                  <p><L
                    zh={<>"研究员把脑子里的 paper 直接翻成 PyTorch；工程师把 PyTorch 直接 ship 到生产"——Hugging Face 上 100 万+ 模型，绝大多数权重都是 <code>.pt</code>。</>}
                    en={<>"Researchers translate papers in their head straight into PyTorch; engineers ship that PyTorch to production." Of 1M+ models on Hugging Face, the vast majority are <code>.pt</code> weights.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="# 三行训练一个简单模型" en="# A complete training loop in three blocks" /></span>{'\n'}
                    <span className="cl-k">import</span> <span className="cl-type">torch</span>{'\n'}
                    <span className="cl-k">import</span> <span className="cl-type">torch.nn</span> <span className="cl-k">as</span> <span className="cl-type">nn</span>{'\n\n'}
                    <span className="cl-v">model</span> = <span className="cl-fn">nn</span>.<span className="cl-fn">Sequential</span>({'\n'}
                    {'    '}<span className="cl-fn">nn</span>.<span className="cl-fn">Linear</span>(<span className="cl-n">784</span>, <span className="cl-n">128</span>),{'\n'}
                    {'    '}<span className="cl-fn">nn</span>.<span className="cl-fn">ReLU</span>(),{'\n'}
                    {'    '}<span className="cl-fn">nn</span>.<span className="cl-fn">Linear</span>(<span className="cl-n">128</span>, <span className="cl-n">10</span>),{'\n'}
                    ){'\n'}
                    <span className="cl-v">opt</span> = <span className="cl-fn">torch</span>.<span className="cl-fn">optim</span>.<span className="cl-fn">Adam</span>(<span className="cl-v">model</span>.<span className="cl-fn">parameters</span>()){'\n\n'}
                    <span className="cl-k">for</span> <span className="cl-v">x</span>, <span className="cl-v">y</span> <span className="cl-k">in</span> <span className="cl-v">loader</span>:{'\n'}
                    {'    '}<span className="cl-v">loss</span> = <span className="cl-fn">F</span>.<span className="cl-fn">cross_entropy</span>(<span className="cl-v">model</span>(<span className="cl-v">x</span>), <span className="cl-v">y</span>){'\n'}
                    {'    '}<span className="cl-v">loss</span>.<span className="cl-fn">backward</span>(){'\n'}
                    {'    '}<span className="cl-v">opt</span>.<span className="cl-fn">step</span>(){'\n\n'}
                    <span className="cl-c"><L zh="# 这就是 90% 深度学习代码长的样子" en="# 90% of deep-learning code looks like this" /></span>{'\n'}
                    <span className="cl-c"><L zh="# 论文里能直接抄, 工业里能 ship" en="# Copy from a paper, ship to production" /></span>
                  </code></pre>
                </div>
              </div>
            </div>

            <div className="ai-tools">
              <h3 className="ai-tools-h"><L zh="AI / 数据栈 · Python first 的事实" en="AI / data stack · Python first, by default" /></h3>
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
                <div className="ai-reverse-tag">CAVEAT</div>
                <h3><L zh="工具链被 Rust 蚕食" en="Tooling rewritten in Rust" /></h3>
                <p><L
                  zh={<>Python 不是全胜。<strong>过去三年 Python 工具链一层一层被 Rust 重写</strong>——结果反过来加固了 Python 应用层的护城河，但也暴露了"纯 Python 写工具"模式的极限。</>}
                  en={<>Python is not winning everything. <strong>Over the past three years, layer after layer of Python tooling has been rewritten in Rust</strong> — paradoxically reinforcing the application-layer Python moat while exposing the limits of "tooling written in pure Python."</>}
                /></p>
                <p><L
                  zh={<>Astral 公司（OpenAI 2026 已收购）开源的 <strong>ruff</strong> 把 Flake8 + Black + isort + pyupgrade + pydocstyle 这一打 linter / formatter 用 Rust 重写为单个二进制——快几十到几百倍；<strong>uv</strong> 重写了 pip / pip-tools / virtualenv / pipx / poetry / pyenv，跑得比 npm 还快。</>}
                  en={<>Astral (acquired by OpenAI in March 2026) ships <strong>ruff</strong>, a single Rust binary that replaces Flake8, Black, isort, pyupgrade, and pydocstyle — tens to hundreds of times faster. <strong>uv</strong> rewrites pip, pip-tools, virtualenv, pipx, poetry, and pyenv, and runs faster than npm.</>}
                /></p>
                <p><L
                  zh={<>另一边 <strong>Polars</strong>（Rust 写的 DataFrame）正在挑 pandas 的位置；<strong>Pydantic v2</strong> 把核心校验循环搬进 Rust 后快了 5-50 倍。<em>结论是：底层 hot path 越来越属于 Rust，但用户面对的 API 还是 Python——这恰恰证明 Python 作为"科学应用层语言"的位置稳固。</em></>}
                  en={<>Elsewhere, <strong>Polars</strong> (Rust DataFrame) is encroaching on pandas; <strong>Pydantic v2</strong> moved its validation core into Rust for a 5–50× speedup. <em>The pattern: hot paths increasingly belong to Rust, but the user-facing API stays Python — exactly which proves Python's role as the "scientific application layer" is secure.</em></>}
                /></p>
              </div>
              <div className="ai-reverse-code">
                <pre className="code"><code>
                  <span className="cl-c"><L zh="# 装 / 同步 / 跑一个项目, 全用 uv:" en="# Install / sync / run a project with uv:" /></span>{'\n'}
                  $ <span className="cl-fn">uv</span> init my-llm-app{'\n'}
                  $ <span className="cl-fn">uv</span> add torch transformers fastapi{'\n'}
                  $ <span className="cl-fn">uv</span> sync          <span className="cl-c"><L zh="# 比 pip 快 80×" en="# 80× faster than pip" /></span>{'\n'}
                  $ <span className="cl-fn">uv</span> run main.py{'\n\n'}
                  <span className="cl-c"><L zh="# lint + format, 全用 ruff:" en="# Lint + format, all in ruff:" /></span>{'\n'}
                  $ <span className="cl-fn">ruff</span> check . --fix{'\n'}
                  $ <span className="cl-fn">ruff</span> format .{'\n'}
                  <span className="cl-c"><L zh="# Black + isort + flake8 + pyupgrade" en="# Replaces Black + isort + flake8 + pyupgrade" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 之前要 4 个工具串起来跑十几秒" en="# Used to require 4 tools in sequence," /></span>{'\n'}
                  <span className="cl-c"><L zh="# 现在一个二进制, 不到 1 秒" en="# now one binary in under a second." /></span>{'\n\n'}
                  <span className="cl-c"><L zh="# 表面: 你写的还是 .py" en="# On the surface — still your .py files" /></span>{'\n'}
                  <span className="cl-c"><L zh="# 底下: 工具全是 Rust" en="# Underneath — the toolchain is Rust now" /></span>
                </code></pre>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="用一句话总结：" en="Bottom line: " /></strong><L
                zh={<>AI 浪潮没有动摇 Python 的位置，反而把它推到生涯最高点。Rust 在抢 Python 的工具链，TypeScript 在抢 GitHub 第一——但<em>你跑模型 / 写 paper / 教学生</em>这三件事，没有任何短期挑战者能换掉 Python。</>}
                en={<>the AI wave did not erode Python's position — it pushed Python to its career peak. Rust is taking the toolchain, TypeScript is taking GitHub's #1 slot, but for <em>training models, writing papers, and teaching beginners</em> there is no near-term challenger.</>}
              /></p>
            </div>
          </section>

          {/* 07 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="对比" en="Compare" /> <code>: Python / JS / R</code></h2>
              <p className="sec-desc"><L
                zh={<>三门"动态、解释、广泛使用"的语言，但生态走的是完全不同的路。</>}
                en={<>Three "dynamic, interpreted, broadly used" languages, but their ecosystems took completely different paths.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-py">Python</th>
                  <th className="th-js">JavaScript</th>
                  <th className="th-r">R</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="诞生" en="Born" />,                     py: <L zh="1991 · Guido" en="1991 · Guido" />,            js: <L zh="1995 · Brendan Eich · 10 天" en="1995 · Brendan Eich · 10 days" />, r: <L zh="1993 · 奥克兰大学" en="1993 · Univ. of Auckland" /> },
                  { k: <L zh="主战场" en="Primary domain" />,         py: <L zh="AI / 数据 / 脚本 / 后端 / 教学" en="AI / data / scripting / back-end / teaching" />, js: <L zh="浏览器 + Node 后端 + 跨端" en="Browser + Node + cross-platform" />, r: <L zh="统计 / 学术绘图" en="Statistics / academic plotting" /> },
                  { k: <L zh="类型系统" en="Typing" />,                py: <L zh="动态 · 可选 type hints" en="Dynamic · optional type hints" />, js: <L zh="动态 · TS 提供静态层" en="Dynamic · TS adds static layer" />, r: <L zh="动态 · 极弱" en="Dynamic · very weak" /> },
                  { k: <L zh="语法风格" en="Style" />,                  py: <L zh="缩进 · 可读如伪代码" en="Indent · pseudocode-readable" />, js: <L zh="大括号 · 灵活但坑多" en="Braces · flexible but prone to traps" />, r: <><code>&lt;-</code> <L zh="赋值 · 公式 DSL" en="assign · formula DSL" /></> },
                  { k: <L zh="包管理" en="Package mgr" />,             py: <L zh="pip / uv · PyPI 60 万+" en="pip / uv · 600k+ on PyPI" />, js: <L zh="npm · 200 万+" en="npm · 2M+" />, r: <L zh="CRAN · 2 万+ 学术" en="CRAN · 20k+ academic" /> },
                  { k: <L zh="数据 / 数值" en="Numerics" />,             py: <>NumPy / pandas / Polars</>, js: <L zh="danfo.js / arquero (后起)" en="danfo.js / arquero (catching up)" />, r: <L zh={<><strong>原生</strong>，data.frame 在语言里</>} en={<><strong>Built-in</strong> — data.frame in core</>} /> },
                  { k: <L zh="深度学习" en="Deep learning" />,          py: <L zh="PyTorch / TF / JAX 全在这" en="PyTorch / TF / JAX live here" />, js: <L zh="TensorFlow.js / ONNX (推理为主)" en="TensorFlow.js / ONNX (inference)" />, r: <L zh="keras 通过 Python 桥" en="keras through a Python bridge" /> },
                  { k: <L zh="统计建模" en="Stat modeling" />,          py: <>statsmodels / pingouin</>, js: <L zh="~无" en="~none" />, r: <L zh={<><strong>领先</strong> · ggplot / lme4 / Stan</>} en={<><strong>Lead</strong> · ggplot / lme4 / Stan</>} /> },
                  { k: <L zh="Notebook 文化" en="Notebook culture" />, py: <L zh="Jupyter (~10M repos)" en="Jupyter (~10M repos)" />, js: <L zh="Observable / Deno notebook" en="Observable / Deno notebooks" />, r: <>R Markdown / Quarto</> },
                  { k: <L zh="性能" en="Performance" />,                py: <L zh="解释 · 慢 · CPython 3.13 实验关 GIL" en="Interpreted · slow · 3.13t experimental no-GIL" />, js: <L zh="V8 JIT · 单线程模型" en="V8 JIT · single-threaded model" />, r: <L zh="解释 · 慢 · 很少作热点" en="Interpreted · slow · rarely a hot path" /> },
                  { k: <L zh="2025 排名" en="2025 ranking" />,          py: <L zh="SO 二、Octoverse 二" en="SO #2, Octoverse #2" />, js: <L zh="SO 一" en="SO #1" />, r: <L zh="下滑中, 学术围墙内还稳" en="Sliding · still strong inside academia" /> },
                  { k: <L zh="AI 时代地位" en="AI-era role" />,          py: <L zh={<><strong>研究 / 训练 / 推理母语</strong></>} en={<><strong>Native tongue of research / training / inference</strong></>} />, js: <L zh="应用层 / 前端 / Agent 工具" en="App layer / front-end / agent tools" />, r: <L zh="统计推断仍在" en="Statistical inference still relevant" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.py}</td>
                    <td>{row.js}</td>
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
              <h2 className="sec-title"><L zh="前景" en="The road ahead" /> <code>: TheRoadAhead</code></h2>
              <p className="sec-desc"><L
                zh={<>三个大方向同时在开：把 GIL 拆掉、把 CPython 加速、把工具链交给 Rust。每一项都是 5 年级别的工程。</>}
                en={<>Three big tracks are running in parallel: dismantling the GIL, accelerating CPython, and handing the toolchain to Rust. Each is a five-year project.</>}
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
                <li><a href="https://www.python.org" target="_blank" rel="noopener">python.org</a></li>
                <li><a href="https://docs.python.org/3/" target="_blank" rel="noopener"><L zh="Python 3 文档" en="Python 3 docs" /></a></li>
                <li><a href="https://peps.python.org/" target="_blank" rel="noopener"><L zh="PEP 索引" en="PEP index" /></a></li>
                <li><a href="https://github.com/python/cpython" target="_blank" rel="noopener"><L zh="CPython 源码" en="CPython source" /></a></li>
                <li><a href="https://www.python.org/psf/" target="_blank" rel="noopener"><L zh="Python 软件基金会" en="Python Software Foundation" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="关键阅读" en="Key reading" /></h4>
              <ul>
                <li><a href="https://peps.python.org/pep-0008/" target="_blank" rel="noopener"><L zh="PEP 8 · 风格指南" en="PEP 8 · style guide" /></a></li>
                <li><a href="https://peps.python.org/pep-0020/" target="_blank" rel="noopener">PEP 20 · The Zen of Python</a></li>
                <li><a href="https://peps.python.org/pep-0484/" target="_blank" rel="noopener"><L zh="PEP 484 · Type Hints" en="PEP 484 · type hints" /></a></li>
                <li><a href="https://peps.python.org/pep-0703/" target="_blank" rel="noopener"><L zh="PEP 703 · 关 GIL" en="PEP 703 · disabling the GIL" /></a></li>
                <li><a href="https://docs.python.org/3/whatsnew/3.13.html" target="_blank" rel="noopener">What's New in 3.13</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="生态 / 数据" en="Ecosystem / data" /></h4>
              <ul>
                <li><a href="https://pypi.org" target="_blank" rel="noopener"><L zh="PyPI · 包仓库" en="PyPI · package index" /></a></li>
                <li><a href="https://numpy.org" target="_blank" rel="noopener">NumPy</a></li>
                <li><a href="https://pandas.pydata.org" target="_blank" rel="noopener">pandas</a></li>
                <li><a href="https://jupyter.org" target="_blank" rel="noopener">Project Jupyter</a></li>
                <li><a href="https://survey.stackoverflow.co/2025" target="_blank" rel="noopener"><L zh="SO Survey 2025" en="Stack Overflow Survey 2025" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="AI / 工具链" en="AI / tooling" /></h4>
              <ul>
                <li><a href="https://pytorch.org" target="_blank" rel="noopener">PyTorch</a></li>
                <li><a href="https://huggingface.co" target="_blank" rel="noopener">Hugging Face</a></li>
                <li><a href="https://github.com/astral-sh/uv" target="_blank" rel="noopener">uv (Astral)</a></li>
                <li><a href="https://github.com/astral-sh/ruff" target="_blank" rel="noopener">ruff (Astral)</a></li>
                <li><a href="https://fastapi.tiangolo.com" target="_blank" rel="noopener">FastAPI</a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{PY_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>import antigravity  # noqa</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
