'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './sql_intro.css';
import i18n from '@/i18n/i18n-client';
// Stylized cylinder DB logo — three stacked ellipses with a SELECT wordmark
const SQL_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="sq-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4A8FC4" />
        <stop offset="100%" stopColor="#1E4868" />
      </linearGradient>
      <linearGradient id="sq-cyl" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#6FAEDB" />
        <stop offset="100%" stopColor="#336791" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#sq-grad)" />
    {/* DB cylinder body */}
    <path
      d="M64 76 L64 180 C64 192 92 200 128 200 C164 200 192 192 192 180 L192 76"
      fill="url(#sq-cyl)"
      stroke="#9FCBE8"
      strokeWidth="2"
    />
    {/* top ellipse */}
    <ellipse cx="128" cy="76" rx="64" ry="14" fill="#9FCBE8" stroke="#fff" strokeWidth="2" />
    {/* mid divider lines */}
    <path
      d="M64 110 C64 122 92 130 128 130 C164 130 192 122 192 110"
      fill="none" stroke="#9FCBE8" strokeWidth="2" opacity=".55"
    />
    <path
      d="M64 144 C64 156 92 164 128 164 C164 164 192 156 192 144"
      fill="none" stroke="#9FCBE8" strokeWidth="2" opacity=".4"
    />
    {/* SQL wordmark on top ellipse */}
    <text x="128" y="82" textAnchor="middle" fontFamily="Cascadia Code, monospace"
      fontSize="22" fontWeight="700" fill="#0A1014" letterSpacing="2">SQL</text>
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
    year: <>1970<small>·06</small></>, highlight: true,
    zh: { title: <>Codd 发表关系模型论文</>, desc: <>Edgar F. Codd 在 IBM San Jose 写出 <strong>"A Relational Model of Data for Large Shared Data Banks"</strong> (CACM 1970-06)。一篇 11 页论文把数据从层次/网状模型拉到关系代数。<em>SQL 之前还没有 SQL, 但这就是它的种子</em>。</> },
    en: { title: <>Codd publishes the relational model</>, desc: <>At IBM San Jose, Edgar F. Codd publishes <strong>"A Relational Model of Data for Large Shared Data Banks"</strong> (CACM, June 1970). Eleven pages lift data from hierarchical / network models into relational algebra. <em>No SQL yet — but this is its seed</em>.</> },
  },
  {
    year: <>1973<small>—74</small></>,
    zh: { title: <>System R · SEQUEL 被设计</>, desc: <>IBM <strong>System R</strong> 项目中, <strong>Donald Chamberlin</strong> 与 <strong>Raymond Boyce</strong> 设计 <strong>SEQUEL</strong> (Structured English Query Language)——一门给"非数学家也能查关系数据库"的语言。后来因商标冲突改名 <strong>SQL</strong>。Boyce 1974 年早逝, 35 岁。</> },
    en: { title: <>System R · SEQUEL is designed</>, desc: <>Inside IBM's <strong>System R</strong> project, <strong>Donald Chamberlin</strong> and <strong>Raymond Boyce</strong> design <strong>SEQUEL</strong> (Structured English Query Language) — a language to let non-mathematicians query relational data. Renamed <strong>SQL</strong> over a trademark clash. Boyce dies in 1974 at age 35.</> },
  },
  {
    year: '1979', highlight: true,
    zh: { title: <>Oracle V2 — 第一款商业 RDBMS</>, desc: <>Larry Ellison 创立的 <strong>Relational Software Inc.</strong> (后改名 Oracle) 卖出第一份商业关系数据库。<em>IBM 论文先发, 但 Oracle 先卖</em>——这条历史教训影响了整个软件商业模式。</> },
    en: { title: <>Oracle V2 — the first commercial RDBMS</>, desc: <>Larry Ellison's <strong>Relational Software Inc.</strong> (later renamed Oracle) ships the first commercial relational database. <em>IBM wrote the paper, Oracle sold the product</em> — a lesson in software commercialisation that echoed for decades.</> },
  },
  {
    year: '1986',
    zh: { title: <>ANSI SQL-86 标准</>, desc: <>SQL 第一次官方化, <strong>SQL-86</strong> 由 ANSI 发布, 同年成 ISO 标准。<em>统一是文字层面的</em>——各家方言已经分化, 标准只是把"最小公约数"写下来。</> },
    en: { title: <>ANSI SQL-86 standard</>, desc: <>SQL gets its first formal spec — <strong>SQL-86</strong> ratified by ANSI, then ISO the same year. <em>Standardisation only on paper</em> — vendor dialects had already forked; the standard codifies the lowest common denominator.</> },
  },
  {
    year: '1989',
    zh: { title: <>Microsoft SQL Server 1.0 (fork of Sybase)</>, desc: <>Microsoft 跟 <strong>Sybase</strong> 合作把 Unix 上的 Sybase SQL Server 移植到 OS/2, 这成了 <strong>Microsoft SQL Server</strong>。1993 年走上 Windows NT, 之后慢慢和 Sybase 分家, 自走 T-SQL 路线。<em>美企业 SQL 市场就此被它锁定 30 年</em>。</> },
    en: { title: <>Microsoft SQL Server 1.0 (a Sybase fork)</>, desc: <>Microsoft partners with <strong>Sybase</strong> to port Sybase SQL Server to OS/2; that becomes <strong>Microsoft SQL Server</strong>. It moves to Windows NT in 1993 and gradually splits from Sybase into its own T-SQL line. <em>It will lock up US enterprise SQL for the next three decades</em>.</> },
  },
  {
    year: '1992', highlight: true,
    zh: { title: <>SQL-92 — 至今多数人学的"基线"</>, desc: <><strong>SQL-92</strong> 是历史上影响最深的版本: <code>JOIN</code> 语法 (INNER / LEFT / RIGHT / FULL)、<code>VARCHAR</code>、<code>DATETIME</code>、<code>NULL</code> 三值逻辑都在这里落定。<em>2026 年了, 多数教材教的还是它</em>。</> },
    en: { title: <>SQL-92 — the baseline most people still learn</>, desc: <><strong>SQL-92</strong> is the most consequential version in history: explicit <code>JOIN</code> syntax (INNER / LEFT / RIGHT / FULL), <code>VARCHAR</code>, <code>DATETIME</code>, three-valued <code>NULL</code> logic all settle here. <em>Even in 2026, most textbooks still teach this version</em>.</> },
  },
  {
    year: <>1996<small>·07</small></>, highlight: true,
    zh: { title: <>PostgreSQL 1.0</>, desc: <>UC Berkeley 的 <strong>POSTGRES</strong> (Michael Stonebraker, 1986) 在 1995 年加上 SQL 接口、改名 <strong>Postgres95</strong>, 1996 年 7 月再改名 <strong>PostgreSQL</strong> 1.0。开源, BSD-style 协议。<em>30 年后, 它是开源 SQL 的事实之王</em>。</> },
    en: { title: <>PostgreSQL 1.0</>, desc: <>Michael Stonebraker's <strong>POSTGRES</strong> project at UC Berkeley (1986) gains a SQL frontend in 1995 — renamed <strong>Postgres95</strong> — and ships as <strong>PostgreSQL</strong> 1.0 in July 1996. Open source, BSD-style licence. <em>Thirty years later it is the de-facto king of open-source SQL</em>.</> },
  },
  {
    year: '1995',
    zh: { title: <>MySQL — Monty's database</>, desc: <>瑞典的 <strong>Michael "Monty" Widenius</strong> 把女儿 My 的名字给了这个数据库。前几年快、不带事务也不带 ACID 完整支持, 但<strong>Web 1.0 时代和 PHP 黏成一对</strong>。LAMP 栈里的 M 就是它。</> },
    en: { title: <>MySQL — Monty's database</>, desc: <>Sweden's <strong>Michael "Monty" Widenius</strong> names the database after his daughter My. Early MySQL is fast but lacks full transactions / ACID, yet it <strong>fuses with PHP through the Web-1.0 years</strong>. The "M" in LAMP is this.</> },
  },
  {
    year: '1999',
    zh: { title: <>SQL:1999 — CTE / 触发器 / OLAP / 正则</>, desc: <>大版本: <strong>递归 CTE</strong>、触发器、OLAP 聚合 (<code>ROLLUP</code> / <code>CUBE</code>)、正则、对象类型。<em>多数特性 vendor 早就有, 标准只是追认</em>。但<strong>递归 CTE</strong> 这条是真创新, 后来定义了一类查询的写法。</> },
    en: { title: <>SQL:1999 — CTEs, triggers, OLAP, regex</>, desc: <>A big version: <strong>recursive CTEs</strong>, triggers, OLAP aggregates (<code>ROLLUP</code> / <code>CUBE</code>), regex, object types. <em>Vendors had most of it; the standard merely caught up</em>. But <strong>recursive CTE</strong> was a genuine novelty and defined a whole shape of query.</> },
  },
  {
    year: <>2000<small>·08</small></>, highlight: true,
    zh: { title: <>SQLite 1.0 (D. Richard Hipp)</>, desc: <>D. Richard Hipp 在 <strong>Hwaci</strong> 公司给美军 DDG-79 战舰写嵌入式 SQL。<em>没有服务器, 整库一个文件, 公共领域协议</em>。后来变成<strong>地球上部署量最大的数据库</strong>: 每台手机、每个浏览器、每架飞机的电控里都有。</> },
    en: { title: <>SQLite 1.0 (D. Richard Hipp)</>, desc: <>D. Richard Hipp at <strong>Hwaci</strong> writes an embedded SQL engine for the US Navy's DDG-79 destroyer. <em>No server, one file per database, public-domain licence</em>. It quietly becomes the <strong>most-deployed database on Earth</strong> — every phone, every browser, every aircraft avionics box.</> },
  },
  {
    year: '2003', highlight: true,
    zh: { title: <>SQL:2003 — 窗口函数</>, desc: <><strong>窗口函数</strong> (<code>ROW_NUMBER() OVER ...</code>、<code>RANK</code>、<code>LAG</code>、<code>LEAD</code>、<code>SUM() OVER</code>) 进标准。<em>这是 SQL 现代化最关键的一步</em>: 在不破坏关系代数的前提下表达"看行 + 看邻居"。同年 XML 也进了标准。</> },
    en: { title: <>SQL:2003 — window functions</>, desc: <><strong>Window functions</strong> (<code>ROW_NUMBER() OVER ...</code>, <code>RANK</code>, <code>LAG</code>, <code>LEAD</code>, <code>SUM() OVER</code>) enter the standard. <em>This is SQL's single most modernising step</em>: expressing "look at this row plus its neighbours" without breaking relational algebra. XML also joins the spec the same year.</> },
  },
  {
    year: '2008',
    zh: { title: <>Sun 收购 MySQL / NoSQL 起浪</>, desc: <>Sun 以 <strong>10 亿美金</strong>收 MySQL AB。两年后 Oracle 又收 Sun。Monty 看不下去, fork 出 <strong>MariaDB</strong> (2009)。同期 <strong>NoSQL</strong> 浪起来了: MongoDB / Cassandra / Couchbase / Redis—— "<em>Schemas are dead</em>"。</> },
    en: { title: <>Sun acquires MySQL · the NoSQL wave</>, desc: <>Sun buys MySQL AB for <strong>$1B</strong>. Two years later Oracle buys Sun. Monty walks and forks <strong>MariaDB</strong> (2009). Meanwhile <strong>NoSQL</strong> takes off: MongoDB / Cassandra / Couchbase / Redis — "<em>Schemas are dead</em>" was the slogan.</> },
  },
  {
    year: '2012',
    zh: { title: <>Google Spanner — 分布式 SQL</>, desc: <>Google 公开 <strong>Spanner</strong> 论文: 全球分布式、强一致性 (TrueTime API)、SQL 接口。<em>"分布式只能 NoSQL"被这一篇打掉</em>。CockroachDB / TiDB / YugabyteDB 全部是这条线的开源回应。</> },
    en: { title: <>Google Spanner — distributed SQL</>, desc: <>Google publishes the <strong>Spanner</strong> paper: globally distributed, strongly consistent (TrueTime API), SQL frontend. <em>It debunks the "distributed means NoSQL" axiom</em>. CockroachDB / TiDB / YugabyteDB are all the open-source response to this thread.</> },
  },
  {
    year: '2014',
    zh: { title: <>Snowflake — 云仓库时代</>, desc: <>Snowflake 公开发布。<strong>存算分离、按秒计费、SQL 仓库</strong>——和传统 Teradata / Vertica 不同, 它从第一天就是云原生。后来 IPO 估值 ~700 亿。同期 BigQuery 已经在 Google 内部成熟。</> },
    en: { title: <>Snowflake — the cloud-warehouse era</>, desc: <>Snowflake goes public-cloud GA. <strong>Storage / compute separated, billed per second, SQL data warehouse</strong> — unlike legacy Teradata / Vertica, it's cloud-native from day one. IPOs at roughly $70B. BigQuery is maturing inside Google in the same window.</> },
  },
  {
    year: '2016',
    zh: { title: <>SQL:2016 + ClickHouse 开源</>, desc: <>标准侧: SQL:2016 加 <strong>JSON 路径</strong> + 行模式识别。开源侧: Yandex 把 <strong>ClickHouse</strong> 开源——列存 OLAP 引擎, 后来在日志 / 时序 / 实时分析里疯涨。</> },
    en: { title: <>SQL:2016 + ClickHouse open-sourced</>, desc: <>Standards side: SQL:2016 adds <strong>JSON path</strong> and row-pattern matching. Open-source side: Yandex open-sources <strong>ClickHouse</strong> — a columnar OLAP engine that will dominate logs, time series and realtime analytics in the years to come.</> },
  },
  {
    year: '2018', highlight: true,
    zh: { title: <>DuckDB 1.0 — pandas killer</>, desc: <>CWI 阿姆斯特丹的 Mark Raasveldt 和 Hannes Mühleisen 发布 <strong>DuckDB</strong>: 嵌入式列存分析 SQL, 像 SQLite 但为分析而生。<em>"用 DuckDB 替代 pandas 大半数据工作流"</em>成了 2024-2026 数据圈最大的共识转变。</> },
    en: { title: <>DuckDB 1.0 — the pandas killer</>, desc: <>Mark Raasveldt and Hannes Mühleisen at CWI Amsterdam release <strong>DuckDB</strong>: an embedded columnar analytical SQL engine — SQLite-shaped, but built for analytics. <em>"Replace most pandas workflows with DuckDB"</em> becomes the biggest 2024-2026 consensus shift in data tooling.</> },
  },
  {
    year: '2020',
    zh: { title: <>NoSQL → "把 SQL 加回来"</>, desc: <>2009-2014 的 "schemaless" 口号兑现得不好——程序员发现"<em>没 schema 就是把 schema 散在应用代码里</em>"。MongoDB 加 <strong>Aggregation Pipeline</strong> (像 SQL); Cassandra 给出 <strong>CQL</strong>; Kafka 出 <strong>ksqlDB</strong>。<em>SQL 没赢, 是没死</em>。</> },
    en: { title: <>NoSQL → "let's add SQL back"</>, desc: <>The 2009-2014 "schemaless" pitch ages badly — engineers realise "<em>no schema means schema scattered across application code</em>". MongoDB adds an <strong>Aggregation Pipeline</strong> (SQL-shaped); Cassandra ships <strong>CQL</strong>; Kafka ships <strong>ksqlDB</strong>. <em>SQL didn't win — it just refused to die</em>.</> },
  },
  {
    year: '2023',
    zh: { title: <>LLM 时代 — text → SQL</>, desc: <>GPT-4 + Claude + Gemini 把"自然语言查询"门槛降到接近零。BI 工具 (Mode、Hex、ChartDB) 都接了 LLM。<em>但生产环境里"LLM 直接写 SQL 上线"还很谨慎</em>——schema 注入 / 错查 / cost 都还在 trade-off。</> },
    en: { title: <>The LLM era — text → SQL</>, desc: <>GPT-4 / Claude / Gemini bring "natural-language to query" close to free. BI tools (Mode, Hex, ChartDB) plug LLMs in everywhere. <em>But "let the LLM write production SQL" is still handled gingerly</em> — schema leakage, wrong joins, runaway cost are all unresolved trade-offs.</> },
  },
  {
    year: '2026',
    zh: { title: <>56 岁的 SQL, 仍是数据层默认语</>, desc: <>2026 年现状: <strong>OLTP 看 PostgreSQL</strong>; <strong>分析看 ClickHouse / DuckDB / Snowflake / BigQuery</strong>; <strong>嵌入看 SQLite</strong>; 企业 legacy 看 Oracle / MS SQL。<em>SQL 不变, 引擎全换了</em>——这是它过去 56 年活下来的核心机制。</> },
    en: { title: <>SQL at 56 — still the default of the data layer</>, desc: <>State of the union, 2026: <strong>OLTP runs on PostgreSQL</strong>; <strong>analytics runs on ClickHouse / DuckDB / Snowflake / BigQuery</strong>; <strong>embedded runs on SQLite</strong>; enterprise legacy runs on Oracle / MS SQL. <em>SQL the language never changed; the engines underneath rotated entirely</em> — that is how it survived 56 years.</> },
  },
];

interface SqlCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const SQL_CARDS: SqlCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>SELECT</code> — 声明式核心</>, desc: <>SQL 是<strong>声明式</strong>: 你说<em>要什么</em>, 不写<em>怎么取</em>。查询优化器把 <code>SELECT</code> 翻成执行计划——50 年的研究都堆在这里。</> },
    en: { title: <><code>SELECT</code> — the declarative core</>, desc: <>SQL is <strong>declarative</strong>: you state <em>what</em> you want, not <em>how</em> to fetch it. The query optimiser turns <code>SELECT</code> into an execution plan — 50 years of database research piled into that translation.</> },
    code: (
      <code>
        <span className="cl-k">SELECT</span> name, country, single{'\n'}
        <span className="cl-k">FROM</span> wca_results{'\n'}
        <span className="cl-k">WHERE</span> event_id = <span className="cl-s">'333'</span>{'\n'}
        {'  '}<span className="cl-k">AND</span> single <span className="cl-k">IS NOT NULL</span>{'\n'}
        <span className="cl-k">ORDER BY</span> single <span className="cl-k">ASC</span>{'\n'}
        <span className="cl-k">LIMIT</span> <span className="cl-n">10</span>;
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>JOIN</code> — 关系代数的肉</>, desc: <>四种 join (INNER / LEFT / RIGHT / FULL) 加 SQL-92 显式语法。<strong>关系数据库的力量在 join</strong>: 范式拆表、跨表查询、所有指标都靠它。</> },
    en: { title: <><code>JOIN</code> — the meat of relational algebra</>, desc: <>Four joins (INNER / LEFT / RIGHT / FULL) plus SQL-92's explicit syntax. <strong>A relational database's power is in the join</strong>: normalised tables, cross-table queries, every metric ultimately rides on it.</> },
    code: (
      <code>
        <span className="cl-k">SELECT</span> p.name, c.name <span className="cl-k">AS</span> comp{'\n'}
        <span className="cl-k">FROM</span> persons p{'\n'}
        <span className="cl-k">JOIN</span> results r <span className="cl-k">ON</span> r.person_id = p.id{'\n'}
        <span className="cl-k">JOIN</span> competitions c <span className="cl-k">ON</span> c.id = r.comp_id{'\n'}
        <span className="cl-k">WHERE</span> p.country = <span className="cl-s">'CN'</span>;
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>GROUP BY</code> + <code>HAVING</code></>, desc: <>聚合的两步: 先 <strong>GROUP BY</strong> 分组, 再 <strong>HAVING</strong> 过滤分组结果 (区别于 <code>WHERE</code> 过滤行)。<em>新手最常混淆的也是这两个</em>。</> },
    en: { title: <><code>GROUP BY</code> + <code>HAVING</code></>, desc: <>Aggregation in two steps: <strong>GROUP BY</strong> groups, then <strong>HAVING</strong> filters those groups (distinct from <code>WHERE</code>, which filters rows). <em>This is the pair beginners conflate most often</em>.</> },
    code: (
      <code>
        <span className="cl-k">SELECT</span> country, <span className="cl-fn">count</span>(*) <span className="cl-k">AS</span> n{'\n'}
        <span className="cl-k">FROM</span> persons{'\n'}
        <span className="cl-k">GROUP BY</span> country{'\n'}
        <span className="cl-k">HAVING</span> <span className="cl-fn">count</span>(*) &gt; <span className="cl-n">1000</span>{'\n'}
        <span className="cl-k">ORDER BY</span> n <span className="cl-k">DESC</span>;
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>窗口函数 — SQL:2003 的礼物</>, desc: <><code>OVER (PARTITION BY ... ORDER BY ...)</code> 让"看自己 + 看邻居"成为一行 SQL。<strong>排名、累积、移动平均、前后行</strong>都是一行搞定——这是<em>SQL 现代化最关键的一步</em>。</> },
    en: { title: <>Window functions — the gift of SQL:2003</>, desc: <><code>OVER (PARTITION BY ... ORDER BY ...)</code> makes "look at self plus neighbours" a one-liner. <strong>Ranks, running totals, moving averages, previous/next rows</strong> — all collapse to one expression. <em>SQL's single most modernising feature</em>.</> },
    code: (
      <code>
        <span className="cl-k">SELECT</span> name, event, single,{'\n'}
        {'  '}<span className="cl-fn">ROW_NUMBER</span>() <span className="cl-k">OVER</span> ({'\n'}
        {'    '}<span className="cl-k">PARTITION BY</span> event{'\n'}
        {'    '}<span className="cl-k">ORDER BY</span> single <span className="cl-k">ASC</span>{'\n'}
        {'  '}) <span className="cl-k">AS</span> rk{'\n'}
        <span className="cl-k">FROM</span> wca_results;
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>CTE — <code>WITH ... AS</code></>, desc: <>把子查询提取成<strong>命名步骤</strong>, 链式可读, 还能<strong>递归</strong>(SQL:1999)。<em>"嵌套 5 层子查询"那种代码不该再存在</em>; 用 CTE 写成 5 个命名的 with 段。</> },
    en: { title: <>CTEs — <code>WITH ... AS</code></>, desc: <>Pulls subqueries into <strong>named steps</strong>, chains them readably, and supports <strong>recursion</strong> (SQL:1999). <em>"Five levels of nested subquery" is a code smell</em> — rewrite it as five named CTE blocks.</> },
    code: (
      <code>
        <span className="cl-k">WITH</span> top10 <span className="cl-k">AS</span> ({'\n'}
        {'  '}<span className="cl-k">SELECT</span> id, single <span className="cl-k">FROM</span> results{'\n'}
        {'  '}<span className="cl-k">ORDER BY</span> single <span className="cl-k">LIMIT</span> <span className="cl-n">10</span>{'\n'}
        ){'\n'}
        <span className="cl-k">SELECT</span> p.name, t.single{'\n'}
        <span className="cl-k">FROM</span> top10 t{'\n'}
        <span className="cl-k">JOIN</span> persons p <span className="cl-k">ON</span> p.id = t.id;
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>NULL — 三值逻辑陷阱</>, desc: <><code>NULL</code> 是"<strong>未知</strong>", 不是"空"。<code>NULL = NULL</code> 不为真, 而为 <strong>UNKNOWN</strong>。<code>WHERE x = NULL</code> 永远返回空集——必须用 <code>IS NULL</code>。<em>SQL 最常见的 bug 源头</em>。</> },
    en: { title: <>NULL — the three-valued logic trap</>, desc: <><code>NULL</code> means "<strong>unknown</strong>", not "empty". <code>NULL = NULL</code> is not true — it's <strong>UNKNOWN</strong>. <code>WHERE x = NULL</code> always returns no rows; you must use <code>IS NULL</code>. <em>The single largest source of SQL bugs</em>.</> },
    code: (
      <code>
        <span className="cl-c">-- Wrong: returns 0 rows</span>{'\n'}
        <span className="cl-k">SELECT</span> * <span className="cl-k">FROM</span> t <span className="cl-k">WHERE</span> x = <span className="cl-k">NULL</span>;{'\n\n'}
        <span className="cl-c">-- Correct:</span>{'\n'}
        <span className="cl-k">SELECT</span> * <span className="cl-k">FROM</span> t <span className="cl-k">WHERE</span> x <span className="cl-k">IS NULL</span>;
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>事务 / ACID</>, desc: <>SQL 数据库做<strong>事务</strong>: <code>BEGIN</code> / <code>COMMIT</code> / <code>ROLLBACK</code>。<strong>ACID</strong> (原子 / 一致 / 隔离 / 持久) 是 SQL 阵营的护城河, 也是 NoSQL 早期对手"<em>最终一致就够了</em>"的反义词。</> },
    en: { title: <>Transactions / ACID</>, desc: <>SQL databases offer real <strong>transactions</strong>: <code>BEGIN</code> / <code>COMMIT</code> / <code>ROLLBACK</code>. <strong>ACID</strong> (atomic / consistent / isolated / durable) is the SQL camp's moat — and the direct counterpoint to early NoSQL's "<em>eventually consistent is good enough</em>".</> },
    code: (
      <code>
        <span className="cl-k">BEGIN</span>;{'\n'}
        <span className="cl-k">UPDATE</span> accounts <span className="cl-k">SET</span> bal = bal - <span className="cl-n">100</span>{'\n'}
        {'  '}<span className="cl-k">WHERE</span> id = <span className="cl-s">'A'</span>;{'\n'}
        <span className="cl-k">UPDATE</span> accounts <span className="cl-k">SET</span> bal = bal + <span className="cl-n">100</span>{'\n'}
        {'  '}<span className="cl-k">WHERE</span> id = <span className="cl-s">'B'</span>;{'\n'}
        <span className="cl-k">COMMIT</span>;
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>索引 — 数据库的<em>真</em>魔法</>, desc: <>B-tree / hash / GIN / BRIN / 列存 / bitmap。<strong>同一句 SQL, 加对索引快 1000×</strong>。<em>这是写 SQL 之外最值得学的事</em>——<code>EXPLAIN</code> 看查询计划是 DBA 的 stethoscope。</> },
    en: { title: <>Indexes — the <em>actual</em> database magic</>, desc: <>B-tree / hash / GIN / BRIN / columnar / bitmap. <strong>The same SQL is 1000× faster with the right index</strong>. <em>The most valuable thing to learn beyond SQL itself</em> — <code>EXPLAIN</code> is the DBA's stethoscope.</> },
    code: (
      <code>
        <span className="cl-k">CREATE INDEX</span> idx_results_event_single{'\n'}
        {'  '}<span className="cl-k">ON</span> results (event_id, single){'\n'}
        {'  '}<span className="cl-k">WHERE</span> single <span className="cl-k">IS NOT NULL</span>;{'\n\n'}
        <span className="cl-k">EXPLAIN ANALYZE</span>{'\n'}
        <span className="cl-k">SELECT</span> ... <span className="cl-c">-- see the plan</span>
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
    icon: '⊟',
    zh: { title: <>声明式 — 优化器替你赌</>, desc: <>你写"<strong>我想要这堆行</strong>", 优化器决定<strong>用什么 join 顺序 / 哪个索引 / 内存还是磁盘</strong>。50 年的查询计划研究塞在 <code>SELECT</code> 这条线后面——<em>这是 SQL 比命令式 API 难替代的根本原因</em>。</> },
    en: { title: <>Declarative — let the optimiser bet for you</>, desc: <>You say "<strong>give me these rows</strong>"; the optimiser decides <strong>join order, index choice, memory vs spill</strong>. Fifty years of query-plan research live behind that single <code>SELECT</code> — <em>which is precisely why imperative APIs never managed to replace SQL</em>.</> },
    code: <><span className="cl-c">-- Same SQL, different engines:</span>{'\n'}<span className="cl-c">-- PostgreSQL: nested loop + index</span>{'\n'}<span className="cl-c">-- ClickHouse: parallel column scan</span>{'\n'}<span className="cl-c">-- DuckDB:     vectorized hash join</span>{'\n'}<span className="cl-c">-- Your SQL doesn't change.</span></>,
  },
  {
    icon: '⊞',
    zh: { title: <>关系模型 — 唯一<em>真正活下来</em>的数据范式</>, desc: <>层次 / 网状 / 对象 / 文档 / 图数据库都试过, <strong>关系范式 + SQL 是唯一跨 50 年没换掉的</strong>。原因: 它是<strong>数学定义</strong>(关系代数), 不是某家产品的实现。NoSQL 浪退后, 留下的是"<em>SQL 是必修</em>"的共识。</> },
    en: { title: <>The relational model — the only paradigm that lasted</>, desc: <>Hierarchical / network / object / document / graph databases all came and went; <strong>relational + SQL is the only paradigm intact across 50 years</strong>. The reason: it's a <strong>mathematical definition</strong> (relational algebra), not one product's implementation. After the NoSQL wave receded, the consensus left behind was "<em>SQL is non-optional</em>".</> },
    code: <><span className="cl-c">-- Codd 1970: relations + tuples</span>{'\n'}<span className="cl-c">-- ↓ 50 years</span>{'\n'}<span className="cl-c">-- 2026: still relations + tuples</span></>,
  },
  {
    icon: '⊜',
    zh: { title: <>一份语言, N 个引擎</>, desc: <><strong>同一句 SELECT</strong> 在 PostgreSQL (行存 OLTP) / ClickHouse (列存 OLAP) / SQLite (嵌入) / Spanner (分布) 跑都能出结果——<em>引擎换了, SQL 没变</em>。这是 SQL 作为"通用接口"的真力量。<strong>切引擎不用重写应用代码</strong>。</> },
    en: { title: <>One language, N engines</>, desc: <>The <strong>same SELECT</strong> runs against PostgreSQL (row-store OLTP) / ClickHouse (column-store OLAP) / SQLite (embedded) / Spanner (distributed) — <em>the engine changes, the SQL doesn't</em>. This is SQL's real power as a universal interface: <strong>swap engines without rewriting application code</strong>.</> },
    code: <><span className="cl-c">-- portable across:</span>{'\n'}<span className="cl-c">-- · PostgreSQL  (row OLTP)</span>{'\n'}<span className="cl-c">-- · ClickHouse  (column OLAP)</span>{'\n'}<span className="cl-c">-- · SQLite      (embedded)</span>{'\n'}<span className="cl-c">-- · DuckDB      (analytical)</span>{'\n'}<span className="cl-c">-- · BigQuery    (cloud DW)</span></>,
  },
  {
    icon: '⊛',
    zh: { title: <>NoSQL 的反向回流</>, desc: <>2009-2014 整波 NoSQL <strong>"打倒 schema"</strong>, 10 年后大家承认: <em>没 schema 不代表不要 schema, 只是把 schema 散在 application 代码里</em>。MongoDB 加 Aggregation Pipeline, Cassandra 出 CQL, ksqlDB 让 Kafka 也能 <code>SELECT</code>——<strong>SQL 不是赢家, 是无法逃脱的语言</strong>。</> },
    en: { title: <>NoSQL's quiet reversal</>, desc: <>The 2009-2014 NoSQL wave promised <strong>"death to schemas"</strong>. A decade later the consensus: <em>no schema doesn't mean no schema — it means the schema is scattered across application code</em>. MongoDB ships an Aggregation Pipeline, Cassandra ships CQL, ksqlDB lets you <code>SELECT</code> against Kafka — <strong>SQL didn't win the argument; it just refused to be left behind</strong>.</> },
    code: <><span className="cl-c">-- MongoDB Aggregation Pipeline</span>{'\n'}<span className="cl-c">-- looks suspiciously like SQL:</span>{'\n'}<span className="cl-c">db.x.aggregate([</span>{'\n'}<span className="cl-c">{'  '}{'{ $match:    { y: { $gt: 10 } } },'}</span>{'\n'}<span className="cl-c">{'  '}{'{ $group:    { _id: "$z", n: { $sum: 1 } } },'}</span>{'\n'}<span className="cl-c">{'  '}{'{ $sort:     { n: -1 } }'}</span>{'\n'}<span className="cl-c">])</span></>,
  },
  {
    icon: '⊠',
    zh: { title: <>"ORM 替代 SQL" → "SQL 替代 ORM"</>, desc: <>2010s 大家试 Hibernate / ActiveRecord / Django ORM / Eloquent——"<em>不用写 SQL 啦</em>"。2020s 大家又开始写原生 SQL: <strong>sqlc</strong> (Go), <strong>sqlx</strong> (Rust), <strong>Drizzle</strong> (TS), <strong>jOOQ</strong> (Java)。<em>潮水退两次, SQL 还在那</em>。</> },
    en: { title: <>"ORMs will replace SQL" → "SQL replaced the ORM"</>, desc: <>In the 2010s everyone tried Hibernate / ActiveRecord / Django ORM / Eloquent — "<em>finally no more SQL</em>". In the 2020s everyone is writing raw SQL again, just type-checked: <strong>sqlc</strong> (Go), <strong>sqlx</strong> (Rust), <strong>Drizzle</strong> (TS), <strong>jOOQ</strong> (Java). <em>The tide came in twice; the SQL was still there</em>.</> },
    code: <><span className="cl-c">-- 2014 (Hibernate):</span>{'\n'}<span className="cl-c">session.createCriteria(User.class)...</span>{'\n\n'}<span className="cl-c">-- 2026 (Drizzle / sqlc):</span>{'\n'}<span className="cl-c">-- write the SQL · get typed rows</span>{'\n'}<span className="cl-k">SELECT</span> id, name <span className="cl-k">FROM</span> users <span className="cl-k">WHERE</span> ...</>,
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
    href: 'https://www.postgresql.org', highlight: true,
    zhName: 'PostgreSQL', enName: 'PostgreSQL',
    zhNote: '开源 SQL 之王 · 1996—', enNote: 'King of open-source SQL · 1996—',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A1014"/><ellipse cx="50" cy="36" rx="28" ry="8" fill="none" stroke="#336791" strokeWidth="4"/><path d="M22 36 V64 Q22 76 50 76 Q78 76 78 64 V36" fill="none" stroke="#336791" strokeWidth="4"/></svg>,
  },
  {
    href: 'https://www.mysql.com', highlight: true,
    zhName: 'MySQL', enName: 'MySQL',
    zhNote: 'LAMP 时代的 M · Oracle 持有', enNote: 'The M in LAMP · owned by Oracle',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#00758F"/><path d="M22 64 Q34 38 50 50 Q60 58 70 38 Q80 30 86 36" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round"/><circle cx="48" cy="52" r="3" fill="#F29111"/></svg>,
  },
  {
    href: 'https://mariadb.org',
    zhName: 'MariaDB', enName: 'MariaDB',
    zhNote: 'Monty fork · 2009—', enNote: 'Monty fork · 2009—',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1F305F"/><path d="M22 70 Q30 30 50 32 Q72 34 78 70" stroke="#C9A55C" strokeWidth="4" fill="none"/><circle cx="50" cy="48" r="6" fill="#C9A55C"/></svg>,
  },
  {
    href: 'https://www.sqlite.org', highlight: true,
    zhName: 'SQLite', enName: 'SQLite',
    zhNote: '地球部署量最大', enNote: 'Most-deployed DB on Earth',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#003B57"/><path d="M30 28 H72 V42 H44 V58 H72 V72 H30 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://www.microsoft.com/sql-server',
    zhName: 'MS SQL Server', enName: 'MS SQL Server',
    zhNote: '企业 SQL · 1989—', enNote: 'Enterprise SQL · 1989—',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#A91D22"/><text x="50" y="60" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="monospace">MS</text></svg>,
  },
  {
    href: 'https://www.oracle.com/database/',
    zhName: 'Oracle DB', enName: 'Oracle DB',
    zhNote: '50 年企业堡垒', enNote: '50-year enterprise fortress',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#C74634"/><ellipse cx="50" cy="50" rx="32" ry="14" fill="none" stroke="#fff" strokeWidth="6"/></svg>,
  },
  {
    href: 'https://www.snowflake.com', highlight: true,
    zhName: 'Snowflake', enName: 'Snowflake',
    zhNote: '云数仓 · 2014—', enNote: 'Cloud DW · 2014—',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A1014"/><g stroke="#29B5E8" strokeWidth="3" strokeLinecap="round"><line x1="50" y1="18" x2="50" y2="82"/><line x1="22" y1="50" x2="78" y2="50"/><line x1="30" y1="30" x2="70" y2="70"/><line x1="70" y1="30" x2="30" y2="70"/></g></svg>,
  },
  {
    href: 'https://cloud.google.com/bigquery',
    zhName: 'BigQuery', enName: 'BigQuery',
    zhNote: 'Google · 无服务器仓库', enNote: 'Google · serverless warehouse',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0A1014"/><circle cx="50" cy="50" r="22" fill="none" stroke="#4285F4" strokeWidth="4"/><line x1="66" y1="66" x2="80" y2="80" stroke="#4285F4" strokeWidth="4" strokeLinecap="round"/></svg>,
  },
  {
    href: 'https://clickhouse.com', highlight: true,
    zhName: 'ClickHouse', enName: 'ClickHouse',
    zhNote: '列存 OLAP · Yandex', enNote: 'Columnar OLAP · Yandex',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FFCC00"/><g fill="#0A1014"><rect x="26" y="26" width="10" height="48"/><rect x="42" y="26" width="10" height="48"/><rect x="58" y="26" width="10" height="48"/><rect x="74" y="42" width="10" height="16"/></g></svg>,
  },
  {
    href: 'https://duckdb.org', highlight: true,
    zhName: 'DuckDB', enName: 'DuckDB',
    zhNote: '嵌入分析 · pandas killer', enNote: 'Embedded analytical · pandas killer',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#FFF000"/><circle cx="44" cy="44" r="20" fill="#0A1014"/><circle cx="50" cy="40" r="4" fill="#FFF000"/><path d="M58 44 Q72 48 70 60 Q66 70 50 70 L40 70 Q34 70 34 64" fill="none" stroke="#0A1014" strokeWidth="5" strokeLinecap="round"/></svg>,
  },
];

interface AdoptItem { name: string; zhDesc: string; enDesc: string }
const ADOPT_TOOLS: AdoptItem[] = [
  { name: 'psql',         zhDesc: 'PostgreSQL CLI',                enDesc: 'PostgreSQL CLI' },
  { name: 'pgAdmin',      zhDesc: 'PG GUI',                        enDesc: 'PG GUI' },
  { name: 'DBeaver',      zhDesc: '多引擎 GUI',                    enDesc: 'Multi-engine GUI' },
  { name: 'DataGrip',     zhDesc: 'JetBrains · 商业',              enDesc: 'JetBrains · commercial' },
  { name: 'dbt',          zhDesc: '数据转换框架',                  enDesc: 'Data transform framework' },
  { name: 'Hex / Mode',   zhDesc: 'SQL notebook BI',               enDesc: 'SQL notebook BI' },
  { name: 'sqlfluff',     zhDesc: 'SQL linter / formatter',        enDesc: 'SQL linter / formatter' },
  { name: 'pgBench',      zhDesc: 'PG 基准压测',                   enDesc: 'PG benchmark' },
  { name: 'Drizzle ORM',  zhDesc: 'TS · SQL-shaped',               enDesc: 'TS · SQL-shaped' },
  { name: 'sqlx (Rust)',  zhDesc: '编译期 SQL 校验',               enDesc: 'Compile-time SQL check' },
  { name: 'sqlc (Go)',    zhDesc: 'SQL → typed Go',                enDesc: 'SQL → typed Go' },
  { name: 'PostgREST',    zhDesc: 'PG → REST 自动',                enDesc: 'PG → REST auto-API' },
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
      title: <>LLM 直写 SQL — 还在等"真上线"</>,
      body: (<>
        <p>2023 起 LLM 写 SQL 已经很顺手, BI 工具 (Hex / Mode / ChartDB) 全接了。但<strong>"生产环境放手让 LLM 写"</strong>仍未到——三大门槛: <strong>schema 注入</strong> (上下文窗口塞不下大库)、<strong>错查</strong> (LLM 编不存在的表 / 列)、<strong>cost</strong> (LLM 不算执行计划, 一句 SQL 跑爆仓库)。</p>
        <p>2026 现状: <strong>"LLM 写候选 + 人审"</strong>是主流。Text-to-SQL 模型 (NSQL / Defog SQLCoder) 在窄场景准确率 ~85%, 跨库 / 复杂 join 还得人手把关。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="窄表 / 单库 (today)" en="Narrow schema / single DB (today)" /></span><span className="bar-val">~85%</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="复杂 join / 跨库 / 优化" en="Complex joins / cross-DB / tuned" /></span><span className="bar-val">~40%</span></div>
        </div>
      </>),
    },
    en: {
      title: <>LLM-written SQL — still not "production-ready"</>,
      body: (<>
        <p>Since 2023, LLMs write SQL surprisingly well, and every BI tool (Hex / Mode / ChartDB) plugs one in. But <strong>"let the LLM write production SQL unattended"</strong> hasn't landed — three blockers: <strong>schema injection</strong> (context windows can't hold large schemas), <strong>hallucinated queries</strong> (LLMs invent non-existent tables or columns), and <strong>cost</strong> (LLMs don't reason about query plans — one bad SQL can melt a warehouse).</p>
        <p>State of the art in 2026: <strong>"LLM drafts, human reviews"</strong> remains the norm. Text-to-SQL models (NSQL, Defog SQLCoder) hit ~85% accuracy on narrow schemas; complex joins / cross-DB / tuned queries still need humans.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Narrow schema / single DB (today)</span><span className="bar-val">~85%</span></div>
          <div className="bar bar-new"><span className="bar-label">Complex joins / cross-DB / tuned</span><span className="bar-val">~40%</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'DISTRIBUTED',
    zh: { title: <>分布式 SQL — Spanner 之后</>, body: <><p>CockroachDB / TiDB / YugabyteDB 把 Spanner 范式开源化, <strong>分布式强一致 + SQL 接口</strong>。2026 的真问题不是"<em>分布式能不能 SQL</em>", 而是"<strong>分布式 SQL 跑通货架的运维成本能不能压到 PG 同档</strong>"——还差一截。</p></> },
    en: { title: <>Distributed SQL — after Spanner</>, body: <><p>CockroachDB / TiDB / YugabyteDB open-source the Spanner pattern: <strong>distributed strong-consistency plus SQL frontend</strong>. The 2026 question isn't "<em>can it speak SQL</em>" — it's "<strong>can ops cost match plain Postgres</strong>" — and it doesn't quite yet.</p></> },
  },
  {
    tag: 'EMBED',
    zh: { title: <>DuckDB — 嵌入分析的回归</>, body: <><p>过去做分析得起一个 Snowflake / BQ 仓库。现在 <strong>DuckDB</strong> 直接在 laptop 上吞下 100 GB Parquet 跑 SQL, 比 pandas 快 10-100×。<strong>"小数据分析回到本地"</strong>是 2024-2026 数据栈最被低估的转向。</p></> },
    en: { title: <>DuckDB — embedded analytics returns</>, body: <><p>Analytics used to demand a Snowflake / BQ warehouse. Now <strong>DuckDB</strong> chews 100 GB of Parquet on a laptop and runs SQL 10-100× faster than pandas. <strong>"Small-data analytics moves back local"</strong> is the most under-discussed data-stack shift of 2024-2026.</p></> },
  },
];

export default function SqlIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'SQL : 56 年的声明式查询语言 — 数据层的默认语',
    'SQL : 56 years of declarative query — the data layer\'s default', "SQL : 56 年的宣告式查詢語言 — 資料層的預設語"
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .bar, .compare-col, .cmp-table tr, .ts-card, .anti-card, .split-col, .spotlight, .ai-takeaway, .quote-block, .qres, .dialect-wrap'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 5) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.anti-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 2) * 70}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--pg-bright)' : '';
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
      <div ref={rootRef} className="sql-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <defs>
                <linearGradient id="sq-nav" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A8FC4" />
                  <stop offset="100%" stopColor="#1E4868" />
                </linearGradient>
                <linearGradient id="sq-nav-cyl" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#6FAEDB" />
                  <stop offset="100%" stopColor="#336791" />
                </linearGradient>
              </defs>
              <rect width="256" height="256" rx="28" fill="url(#sq-nav)" />
              <path
                d="M64 76 L64 180 C64 192 92 200 128 200 C164 200 192 192 192 180 L192 76"
                fill="url(#sq-nav-cyl)"
                stroke="#9FCBE8"
                strokeWidth="3"
              />
              <ellipse cx="128" cy="76" rx="64" ry="14" fill="#9FCBE8" stroke="#fff" strokeWidth="2" />
            </svg>
            <span>SQL</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语言" en="Language" /></a></li>
            <li><a href="#dialects"><L zh="方言" en="Dialects" /></a></li>
            <li><a href="#anti"><L zh="反模式" en="Anti-Patterns" /></a></li>
            <li><a href="#workload"><L zh="OLTP/OLAP" en="Workloads" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#projects"><L zh="引擎" en="Engines" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1970 — 2026 · Codd · Chamberlin · Boyce · the relational lineage</div>
            <h1 className="hero-title">
              <span className="hero-name">SQL</span>
              <span className="hero-colon">:</span>
              <span className="hero-type">DeclarativeQuery</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>SQL <strong>不是通用编程语言, 是声明式查询语言</strong>——和 Bash 一同住在本站"<em>脚本 / 查询</em>"那一格, 而不是和 C/Rust/Java 同台。1970 年 Codd 的论文给出关系模型, 1974 年 IBM 的 Chamberlin &amp; Boyce 给出 SEQUEL, 1979 Oracle 卖出第一份。<strong>56 年了, 数据层默认还是它</strong>。</>}
                en={<>SQL is <strong>not a general-purpose programming language — it's a declarative query language</strong>. On this site it lives in the "<em>script / query</em>" bucket alongside Bash, not next to C / Rust / Java. Codd published the relational model in 1970, Chamberlin &amp; Boyce drafted SEQUEL at IBM in 1974, Oracle sold the first commercial RDBMS in 1979. <strong>Fifty-six years later, the data layer's default is still SQL</strong>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1970<small></small></span>
                <span className="stat-label"><L zh={<>Codd 论文<br /><em>关系模型 · CACM</em></>} en={<>Codd's paper<br /><em>relational model · CACM</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">56<small> yr</small></span>
                <span className="stat-label"><L zh={<>语言年龄<br /><em>1970 → 2026</em></>} en={<>Language age<br /><em>1970 → 2026</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">10+<small></small></span>
                <span className="stat-label"><L zh={<>主流引擎方言<br /><em>PG / MySQL / SQLite / DuckDB / ...</em></>} en={<>Major engine dialects<br /><em>PG / MySQL / SQLite / DuckDB / ...</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">#1<small></small></span>
                <span className="stat-label"><L zh={<>地球部署量数据库<br /><em>SQLite · 每台手机 / 浏览器</em></>} en={<>Most-deployed DB on Earth<br /><em>SQLite · every phone / browser</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              {SQL_LOGO_SVG}
            </div>
            <div className="hero-floats">
              <span className="float f1">SELECT *</span>
              <span className="float f2">{'JOIN ... ON'}</span>
              <span className="float f3">{'WHERE x IS NULL'}</span>
              <span className="float f4">GROUP BY</span>
              <span className="float f5">{'ROW_NUMBER() OVER'}</span>
              <span className="float f6">{'WITH cte AS'}</span>
              <span className="float f7">EXPLAIN ANALYZE</span>
              <span className="float f8">BEGIN; COMMIT;</span>
              <span className="float f9">CREATE INDEX</span>
              <span className="float f10">UPSERT</span>
              <span className="float f11">JSONB</span>
              <span className="float f12">{'PARTITION BY'}</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>SQL</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>SQL = <strong>Structured Query Language</strong>。1974 年 Donald Chamberlin 和 Raymond Boyce 在 IBM System R 设计的 <strong>SEQUEL</strong>, 后因商标改名 SQL。它<strong>不是图灵完备的通用语言</strong>(标准 SQL 不是), 而是一门给关系数据库的<strong>声明式查询语言</strong>: 你写"<em>我想要这堆行</em>", 引擎自己决定怎么取。</>}
                  en={<>SQL = <strong>Structured Query Language</strong>. Designed in 1974 by Donald Chamberlin and Raymond Boyce inside IBM's System R project as <strong>SEQUEL</strong>, renamed over a trademark conflict. It's <strong>not a Turing-complete general-purpose language</strong> (standard SQL isn't) — it's a <strong>declarative query language</strong> for relational databases: you write "<em>give me these rows</em>", the engine decides how to fetch them.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="声明式 · 不是命令式" en="Declarative · not imperative" />, tag: 'paradigm', p: <L zh={<>你说<strong>要什么</strong> (<code>SELECT</code> ... <code>WHERE</code>), <strong>不写</strong>怎么遍历 / 用哪个索引 / join 顺序。查询优化器替你赌——50 年研究都堆在这一步。</>} en={<>You state <strong>what</strong> (<code>SELECT</code> ... <code>WHERE</code>), you <strong>don't write</strong> the iteration, the index choice, or join order. The optimiser bets for you — fifty years of database research live in that translation.</>} /> },
                { h: <L zh="关系代数底子" en="Relational algebra under the hood" />, tag: 'model', p: <L zh={<>底层模型来自 1970 Codd 论文: <strong>关系</strong> (表) + <strong>元组</strong> (行) + <strong>投影 / 选择 / 连接 / 笛卡儿积</strong> 五种代数操作。SQL 是这套代数的<em>糖</em>。</>} en={<>The underlying model comes from Codd's 1970 paper: <strong>relations</strong> (tables), <strong>tuples</strong> (rows), and five algebraic operations — <strong>projection / selection / join / union / Cartesian product</strong>. SQL is <em>syntactic sugar</em> over that algebra.</>} /> },
                { h: <L zh="标准 vs 方言" en="Standard vs dialect" />, tag: 'spec', p: <L zh={<>ANSI / ISO 标准从 SQL-86 一路到 SQL:2023, 但<strong>没有一家引擎 100% 实现</strong>。<code>WITH</code> / 窗口函数 / JSON / 数组——各家进度不一, 这是<em>SQL 工程的真痛点</em>。</>} en={<>The ANSI / ISO standard runs from SQL-86 to SQL:2023, but <strong>no engine implements 100% of any version</strong>. CTEs, window functions, JSON, arrays — each vendor moves at its own pace. <em>This is the real day-to-day pain of SQL engineering</em>.</>} /> },
                { h: <L zh="不是通用语言" en="Not a general-purpose language" />, tag: 'scope', p: <L zh={<>SQL 本身不能写网页 / 控制硬件 / 跑 ML 训练。它和 <a href="/code/bash">Bash</a> 同列在"<em>script / query</em>"——专门干一类活, 干 50 年没换。<strong>站着不动也是一种本事</strong>。</>} en={<>SQL itself doesn't write web pages, drive hardware, or train ML. It sits beside <a href="/code/bash">Bash</a> in the "<em>script / query</em>" bucket — single-purpose, 50 years steady. <strong>Staying perfectly still for half a century is its own kind of skill</strong>.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            {/* Query-result aesthetic showcase */}
            <div className="qres">
              <pre className="qres-query">
                <span className="qres-prompt">postgres=&gt; </span>
                <span className="cl-k">SELECT</span> name, country, single
                {'\n              '}<span className="cl-k">FROM</span> wca_results
                {'\n              '}<span className="cl-k">WHERE</span> event_id = <span className="cl-s">'333'</span> <span className="cl-k">AND</span> single <span className="cl-k">IS NOT NULL</span>
                {'\n              '}<span className="cl-k">ORDER BY</span> single <span className="cl-k">LIMIT</span> <span className="cl-n">5</span>;
              </pre>
              <div className="qres-meta"><code>Time: 4.218 ms</code>  ·  <L zh="索引扫描 · idx_results_event_single" en="Index Scan · idx_results_event_single" /></div>
              <div className="qres-table-wrap">
                <table className="qres-table">
                  <thead><tr><th>name</th><th>country</th><th>single</th></tr></thead>
                  <tbody>
                    <tr><td>Yiheng Wang (王艺衡)</td><td>CN</td><td className="num">3.05</td></tr>
                    <tr><td>Max Park</td><td>US</td><td className="num">3.13</td></tr>
                    <tr><td>Xuanyi Geng (耿暄一)</td><td>CN</td><td className="num">3.47</td></tr>
                    <tr><td>Asher Kim-Magierek</td><td>US</td><td className="num">3.66</td></tr>
                    <tr><td>Tymon Kolasiński</td><td>PL</td><td className="num">3.79</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="qres-rowcount">(5 rows)</div>
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>56 年的 SQL 故事: 从 IBM San Jose 的一篇 1970 年论文出发, 走过 Oracle / Sybase / MSSQL 的商业战国、PostgreSQL / MySQL / SQLite 的开源三巨头、NoSQL 的反叛、Snowflake / BigQuery / ClickHouse / DuckDB 的分析回潮——<strong>语言变化很少, 引擎换了一茬又一茬</strong>。</>}
                en={<>Fifty-six years of SQL: from a 1970 paper at IBM San Jose, through the Oracle / Sybase / MSSQL commercial wars, the PostgreSQL / MySQL / SQLite open-source troika, the NoSQL revolt, and the Snowflake / BigQuery / ClickHouse / DuckDB analytics resurgence — <strong>the language barely moved, the engines underneath rotated entirely</strong>.</>}
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
              <h2 className="sec-title"><L zh="语言精要" en="Language Essentials" /> <code>: SqlAlphabet</code></h2>
              <p className="sec-desc"><L
                zh={<>8 张卡覆盖 SQL <strong>每个写查询的人都该熟悉的核心结构</strong>: <code>SELECT</code> 的声明式本质、四种 join、聚合两步、窗口函数、CTE、NULL 三值逻辑陷阱、事务、索引。<em>掌握这 8 个, 90% 日常查询写得动</em>。</>}
                en={<>Eight cards covering <strong>the core structures every SQL writer needs</strong>: the declarative essence of <code>SELECT</code>, the four joins, the two-step aggregate, window functions, CTEs, the NULL three-valued-logic trap, transactions, indexes. <em>Master these eight and 90% of daily queries are within reach</em>.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {SQL_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>SQL 不是<em>图灵完备</em>——但 PL/pgSQL 是</>} en={<>SQL itself isn't Turing-complete — but PL/pgSQL is</>} /></h3>
                <p><L
                  zh={<>纯 SQL <strong>(SQL-92 标准核心)</strong> 不是图灵完备语言, 没有循环 / 没有递归 (递归 CTE 是 SQL:1999 后加的限制版)。但每家引擎都有<strong>过程扩展</strong>: <code>PL/pgSQL</code> (PG)、<code>T-SQL</code> (MSSQL)、<code>PL/SQL</code> (Oracle)、SQLite 的 <code>WITH RECURSIVE</code>——这些<em>是</em>图灵完备的。<em>你写"SQL"时, 大概率在写其中某种方言的混合体</em>。</>}
                  en={<>Pure SQL <strong>(SQL-92 core)</strong> is not Turing-complete: no loops, no recursion (recursive CTE arrived in SQL:1999 in a restricted form). But every engine ships a <strong>procedural extension</strong>: <code>PL/pgSQL</code> (PG), <code>T-SQL</code> (MSSQL), <code>PL/SQL</code> (Oracle), SQLite's <code>WITH RECURSIVE</code> — and these <em>are</em> Turing-complete. <em>When you "write SQL", you almost always write some dialect mix of these</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>SQL 是标准, 方言是现实——这两者的距离, 是每个 SQL 工程师的日常。</>}
                  en={<>SQL is the standard; dialects are the reality — and the gap between them is every SQL engineer's daily job.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 04 Dialect Zoo */}
          <section className="section" id="dialects">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="方言动物园" en="The Dialect Zoo" /> <code>: DialectMatrix</code></h2>
              <p className="sec-desc"><L
                zh={<>"<em>我写的是 SQL</em>"——其实你写的是某家引擎的方言。10 个主流方言, 6 个特性, 看谁有什么。<strong>SQL 标准</strong>是地图; <strong>引擎方言</strong>才是地形。</>}
                en={<>"<em>I write SQL</em>" — really you write some engine's dialect. Ten major dialects, six features, what each one ships. The <strong>SQL standard</strong> is the map; <strong>engine dialects</strong> are the terrain.</>}
              /></p>
            </header>

            <div className="dialect-wrap">
              <table className="dialect-table">
                <thead>
                  <tr>
                    <th></th>
                    <th><L zh="窗口函数" en="Window fn" /></th>
                    <th>CTE</th>
                    <th><L zh="递归 CTE" en="Recursive CTE" /></th>
                    <th>JSON</th>
                    <th><L zh="数组" en="Arrays" /></th>
                    <th>JIT</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'ANSI SQL:2016', cells: ['yes', 'yes', 'yes', 'yes', 'yes', 'no'] },
                    { name: 'PostgreSQL', cells: ['yes', 'yes', 'yes', 'yes', 'yes', 'yes'] },
                    { name: 'MySQL 8.0+', cells: ['yes', 'yes', 'yes', 'yes', 'no', 'no'] },
                    { name: 'MariaDB 10.6+', cells: ['yes', 'yes', 'yes', 'yes', 'no', 'no'] },
                    { name: 'SQLite', cells: ['yes', 'yes', 'yes', 'yes', 'no', 'no'] },
                    { name: 'MS SQL Server', cells: ['yes', 'yes', 'yes', 'yes', 'no', 'no'] },
                    { name: 'Oracle', cells: ['yes', 'yes', 'yes', 'partial', 'no', 'yes'] },
                    { name: 'BigQuery', cells: ['yes', 'yes', 'yes', 'yes', 'yes', 'no'] },
                    { name: 'Snowflake', cells: ['yes', 'yes', 'yes', 'yes', 'partial', 'no'] },
                    { name: 'DuckDB', cells: ['yes', 'yes', 'yes', 'yes', 'yes', 'no'] },
                    { name: 'ClickHouse', cells: ['yes', 'yes', 'partial', 'yes', 'yes', 'no'] },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td>{row.name}</td>
                      {row.cells.map((c, j) => (
                        <td key={j} className={c === 'yes' ? 'dialect-yes' : c === 'partial' ? 'dialect-partial' : 'dialect-no'}>
                          {c === 'yes' ? '✓' : c === 'partial' ? 'partial' : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="sec-desc" style={{ marginTop: 32, fontSize: 14.5 }}>
              <L
                zh={<><em>口径说明</em>: "yes" = 标准语法直接可用; "partial" = 有但语法 / 边界与标准不同; "—" = 不支持原生 (可用 JSON 模拟数组等)。<strong>JIT 列</strong>指引擎自带 LLVM-级编译执行 (PostgreSQL 11+、Oracle 12c+ 有)。<em>2024-2026 状态, vendor 在追, 表会随时间松动</em>。</>}
                en={<><em>How to read</em>: "yes" = supported in standard syntax; "partial" = supported but with non-standard syntax or limits; "—" = not natively (often emulable via JSON etc.). The <strong>JIT column</strong> means engine-level LLVM-class compilation (PostgreSQL 11+, Oracle 12c+ ship it). <em>State as of 2024-2026 — vendors are still catching up and rows will shift</em>.</>}
              />
            </p>
          </section>

          {/* 05 Anti-Patterns */}
          <section className="section" id="anti">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="经典反模式" en="Famous Anti-Patterns" /> <code>: DontDoThis</code></h2>
              <p className="sec-desc"><L
                zh={<>SQL 50 年, <strong>反模式比正模式还稳定</strong>——每代新人都要踩一遍。这 6 个是<em>每个 DBA 看了想关电脑</em>的常见错误。</>}
                en={<>Fifty years on, <strong>SQL anti-patterns are more stable than its good patterns</strong> — every new engineer rediscovers them. These six are <em>the ones that make every DBA reach for the off switch</em>.</>}
              /></p>
            </header>

            <div className="anti-grid">
              {[
                {
                  h: <><code>SELECT *</code></>,
                  zh: <><strong>不在临时 ad-hoc 里用</strong>就 OK; 在生产代码 / view / 报表里用 = bug 源。新增列改变行宽、传到下游格式飞掉; 优化器拿不到列裁剪机会, 索引覆盖也用不上。<em>显式列名是底线</em>。</>,
                  en: <><strong>Fine for ad-hoc</strong>; fatal in production code, views, or reports. A new column breaks downstream consumers; the optimiser loses column pruning; covering indexes go to waste. <em>Listing columns is the floor</em>.</>,
                  zhHant: <><strong>不在臨時 ad-hoc 裡用</strong>就 OK; 在生產程式碼 / view / 報表裡用 = bug 源。新增列改變行寬、傳到下游格式飛掉; 最佳化器拿不到列裁剪機會, 索引覆蓋也用不上。<em>顯式列名是底線</em>。</>,
                },
                {
                  h: <>N+1 <L zh="查询" en="queries" /></>,
                  zh: <>"<em>循环里每行再查一次表</em>"。<strong>1 + N</strong> 次 round-trip, N=10000 时网络 RTT 就要你命。ORM 默认行为下最常见——一个 <code>JOIN</code> 解决, 或换 <code>WHERE id IN (...)</code> 批查。</>,
                  en: <>"<em>For each row, run another query</em>". <strong>1 + N</strong> round-trips; at N=10000, latency alone kills you. The single most common ORM-induced bug — fix with one <code>JOIN</code> or a batched <code>WHERE id IN (...)</code>.</>,
                  zhHant: <>"<em>迴圈裡每行再查一次表</em>"。<strong>1 + N</strong> 次 round-trip, N=10000 時網路 RTT 就要你命。ORM 預設行為下最常見——一個 <code>JOIN</code> 解決, 或換 <code>WHERE id IN (...)</code> 批查。</>,
                },
                {
                  h: <><code>OR</code> <L zh="在 WHERE 里" en="in WHERE" /></>,
                  zh: <><code>WHERE a = 1 OR b = 2</code>——很多优化器<strong>没法两个索引都用</strong>, 只能 fallback 到全表扫。改写为 <code>UNION ALL</code> 两段查询, 或加 <code>(a, b)</code> 复合索引常有奇效。</>,
                  en: <><code>WHERE a = 1 OR b = 2</code> — many optimisers <strong>can't use two indexes at once</strong> and fall back to a full scan. Rewriting as <code>UNION ALL</code> of two halves, or adding a composite <code>(a, b)</code> index, often unlocks speedup.</>,
                  zhHant: <><code>WHERE a = 1 OR b = 2</code>——很多最佳化器<strong>沒法兩個索引都用</strong>, 只能 fallback 到全表掃。改寫為 <code>UNION ALL</code> 兩段查詢, 或加 <code>(a, b)</code> 複合索引常有奇效。</>,
                },
                {
                  h: <><L zh="隐式类型转换" en="Implicit cast" /></>,
                  zh: <><code>WHERE id = '123'</code> 当 id 是 <code>INT</code>: 引擎按列做 <strong>cast(id AS TEXT)</strong>, <strong>索引失效</strong>。日期 / 字符集 / collation 都有类似坑。<em>类型严格写, 别赌引擎</em>。</>,
                  en: <><code>WHERE id = '123'</code> when id is <code>INT</code>: the engine often casts the column (<strong>cast(id AS TEXT)</strong>) and <strong>the index dies</strong>. Same trap with dates, charsets, collations. <em>Match types literally — don't gamble on the optimiser</em>.</>,
                  zhHant: <><code>WHERE id = '123'</code> 當 id 是 <code>INT</code>: 引擎按列做 <strong>cast(id AS TEXT)</strong>, <strong>索引失效</strong>。日期 / 字符集 / collation 都有類似坑。<em>型別嚴格寫, 別賭引擎</em>。</>,
                },
                {
                  h: <><code>GROUP BY 1, 2, 3</code></>,
                  zh: <>用<strong>序号</strong>而不是列名——<em>查询改了列顺序, 分组就静默错位</em>。审查时痛苦。ad-hoc 临时算个数还行, 生产 / 报表 / view 一律写列名。</>,
                  en: <>Using <strong>positional ordinals</strong> instead of column names — <em>change the column order and the grouping silently shifts</em>. Painful to review. Fine for one-off ad-hoc; never in production code, reports, or views.</>,
                  zhHant: <>用<strong>序號</strong>而不是列名——<em>查詢改了列順序, 分組就靜默錯位</em>。審查時痛苦。ad-hoc 臨時算個數還行, 生產 / 報表 / view 一律寫列名。</>,
                },
                {
                  h: <><code>NULL</code> <L zh="当空处理" en="treated as empty" /></>,
                  zh: <><code>COUNT(col)</code> 不数 NULL 但 <code>COUNT(*)</code> 数。<code>SUM</code> 把 NULL 当 0 跳过, 但 <code>col + 1</code> 当 col 是 NULL 时结果是 NULL。<em>三值逻辑是 SQL 最隐蔽的 bug 来源</em>; 显式 <code>COALESCE(col, 0)</code> 救命。</>,
                  en: <><code>COUNT(col)</code> ignores NULL but <code>COUNT(*)</code> doesn't. <code>SUM</code> silently skips NULLs, but <code>col + 1</code> on a NULL gives NULL. <em>Three-valued logic is the most invisible bug source in SQL</em>; explicit <code>COALESCE(col, 0)</code> is the antidote.</>,
                  zhHant: <><code>COUNT(col)</code> 不數 NULL 但 <code>COUNT(*)</code> 數。<code>SUM</code> 把 NULL 當 0 跳過, 但 <code>col + 1</code> 當 col 是 NULL 時結果是 NULL。<em>三值邏輯是 SQL 最隱蔽的 bug 來源</em>; 顯式 <code>COALESCE(col, 0)</code> 救命。</>,
                },
              ].map((a, i) => (
                <div className="anti-card" key={i}>
                  <div className="anti-h">{a.h}</div>
                  <p>{i18n.language === 'zh-Hant' ? (a.zhHant ?? a.zh) : (i18n.language.startsWith('zh') ? a.zh : a.en)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 06 OLTP vs OLAP */}
          <section className="section" id="workload">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="OLTP 与 OLAP — 两种工作负载" en="OLTP vs OLAP — two workloads" /> <code>: OneSqlTwoWorlds</code></h2>
              <p className="sec-desc"><L
                zh={<>同一门 SQL 跑在<strong>两种完全不同的引擎</strong>上: <strong>OLTP</strong>(在线事务处理)写多读少、单行查、毫秒级; <strong>OLAP</strong>(在线分析处理)读多写少、聚合查、扫数 GB。<em>引擎设计南辕北辙, 但 SQL 没变</em>——这是 SQL 真正了不起的地方。</>}
                en={<>One SQL, two utterly different engines. <strong>OLTP</strong> (online transactional) is write-heavy, single-row, millisecond-scale; <strong>OLAP</strong> (online analytical) is read-heavy, aggregation-heavy, scans gigabytes. <em>The engines diverge wildly, the SQL stays the same</em> — this is what makes SQL genuinely remarkable.</>}
              /></p>
            </header>

            <div className="split-grid">
              <div className="split-col oltp">
                <div className="split-tag">OLTP</div>
                <h3 className="split-h"><L zh="在线事务处理" en="Online Transactional" /></h3>
                <p><L
                  zh={<><strong>给应用用</strong>。"<em>给我 user 1234 的购物车</em>"。一次查询取几行, 频率高 (10⁴-10⁶ QPS), 强一致性, 严格 ACID。</>}
                  en={<><strong>For applications</strong>. "<em>Give me user 1234's cart</em>". A query touches a handful of rows; rate is 10⁴-10⁶ QPS; strong consistency; strict ACID.</>}
                /></p>
                <ul className="split-list">
                  <li><strong><L zh="存储" en="Storage" /></strong> — <L zh="行存 (一行连续放)" en="row-store (rows contiguous)" /></li>
                  <li><strong><L zh="索引" en="Indexes" /></strong> — B-tree</li>
                  <li><strong><L zh="代表" en="Representative" /></strong> — PostgreSQL, MySQL, Oracle, MSSQL, SQLite</li>
                  <li><strong><L zh="单查询体积" en="Per-query size" /></strong> — <L zh="行数 < 1000" en="rows < 1000" /></li>
                  <li><strong><L zh="延迟目标" en="Latency target" /></strong> — &lt; 10ms</li>
                  <li><strong>SQL</strong> — <L zh="SELECT 单表 + LIMIT, 大量 INSERT/UPDATE" en="SELECT single-table + LIMIT, lots of INSERT/UPDATE" /></li>
                </ul>
                <p><L
                  zh={<>典型查询: <code>SELECT * FROM users WHERE id = ?</code>。<strong>索引能定位单行, 整库可能上 TB 但单查询不扫整库</strong>。</>}
                  en={<>Typical query: <code>SELECT * FROM users WHERE id = ?</code>. <strong>An index pinpoints one row — the DB may be TBs but no single query scans the whole thing</strong>.</>}
                /></p>
              </div>

              <div className="split-col olap">
                <div className="split-tag">OLAP</div>
                <h3 className="split-h"><L zh="在线分析处理" en="Online Analytical" /></h3>
                <p><L
                  zh={<><strong>给分析师 / 报表 / ML 特征用</strong>。"<em>过去 30 天每个国家的销售总额</em>"。一次查询扫几十亿行, 频率低 (10⁰-10² QPS), 最终一致也无所谓。</>}
                  en={<><strong>For analysts, reports, ML features</strong>. "<em>Total sales by country, last 30 days</em>". A query scans billions of rows; rate is 10⁰-10² QPS; eventual consistency is acceptable.</>}
                /></p>
                <ul className="split-list">
                  <li><strong><L zh="存储" en="Storage" /></strong> — <L zh="列存 (一列连续放)" en="column-store (columns contiguous)" /></li>
                  <li><strong><L zh="索引" en="Indexes" /></strong> — <L zh="zone map / bitmap / 跳数据" en="zone maps / bitmaps / data skipping" /></li>
                  <li><strong><L zh="代表" en="Representative" /></strong> — ClickHouse, Snowflake, BigQuery, DuckDB, Redshift</li>
                  <li><strong><L zh="单查询体积" en="Per-query size" /></strong> — <L zh="行数 10⁶-10¹¹" en="rows 10⁶-10¹¹" /></li>
                  <li><strong><L zh="延迟目标" en="Latency target" /></strong> — <L zh="秒到分钟" en="seconds to minutes" /></li>
                  <li><strong>SQL</strong> — <L zh="SELECT 多表 + GROUP BY 大聚合, 偶尔批量 INSERT" en="SELECT multi-table + heavy GROUP BY, occasional bulk INSERT" /></li>
                </ul>
                <p><L
                  zh={<>典型查询: <code>SELECT country, SUM(amount) FROM sales WHERE date &gt;= ... GROUP BY country</code>。<strong>没索引能帮, 但列存让"<em>只读 country + amount 两列</em>"成本变 1/100</strong>。</>}
                  en={<>Typical query: <code>SELECT country, SUM(amount) FROM sales WHERE date &gt;= ... GROUP BY country</code>. <strong>No index helps — but columnar storage means "<em>read only the country and amount columns</em>" costs 1/100 of a row-store scan</strong>.</>}
                /></p>
              </div>
            </div>

            <div className="ai-takeaway">
              <p><strong><L zh="一句话: " en="In one line: " /></strong><L
                zh={<>OLTP 看 <strong>PostgreSQL / MySQL / SQLite</strong>; OLAP 看 <strong>ClickHouse / DuckDB / Snowflake / BigQuery</strong>。<em>选错引擎 = 性能差 100×</em>; 选对了, 同一句 SQL 就是同一句 SQL。</>}
                en={<>For OLTP, reach for <strong>PostgreSQL / MySQL / SQLite</strong>; for OLAP, reach for <strong>ClickHouse / DuckDB / Snowflake / BigQuery</strong>. <em>The wrong engine costs you 100× in performance</em>; the right one runs the same SQL you already wrote.</>}
              /></p>
            </div>
          </section>

          {/* 07 Why */}
          <section className="section section-ai" id="why">
            <header className="sec-head">
              <span className="sec-num ai-num">07</span>
              <h2 className="sec-title"><L zh="为何 SQL 不死" en="Why SQL Won't Die" /> <code>: WhySqlLasts</code></h2>
              <p className="sec-desc"><L
                zh={<>过去 25 年, "SQL 即将被替代"这种话听了至少 4 轮: 对象数据库、NoSQL、GraphQL、ORM 抽象。<strong>每一轮预测都没成</strong>——这一节讲<em>SQL 凭什么活下来</em>。</>}
                en={<>The past 25 years contain at least four predictions of SQL's imminent replacement: object databases, NoSQL, GraphQL, ORM abstractions. <strong>None landed</strong> — this section is about <em>why SQL keeps surviving</em>.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>SQL 不是因为它<em>好</em>而活下来——是因为它<strong>足够好且足够稳定</strong>。25 年来引擎从单机换到云换到列存换到分布式, SQL 这层接口几乎没动。换语言比换引擎贵 100 倍, <strong>整个数据栈都知道这一点</strong>。</>}
                en={<>SQL doesn't survive because it's <em>good</em> — it survives because it's <strong>good enough and stable enough</strong>. For 25 years engines moved from single-node to cloud to columnar to distributed, and the SQL interface barely flinched. Replacing the language costs 100× more than replacing the engine, and <strong>the whole data stack knows this</strong>.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author"><L zh="— 行业共识 (无单一作者)" en="— industry folk wisdom, paraphrased" /></span>
                <span className="quote-context"><L zh="50 年应用经验的总结" en="Distilled from 50 years of applied use" /></span>
              </footer>
            </blockquote>

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

            <div className="spotlight">
              <div className="spotlight-tag">SPOTLIGHT</div>
              <div className="spotlight-grid">
                <div>
                  <h3>Window functions <span className="spotlight-meta">— <L zh="SQL:2003 这一笔, 把 SQL 拽进现代" en="SQL:2003 — the feature that dragged SQL into the modern era" /></span></h3>
                  <p><L
                    zh={<>2003 之前, 算"<em>每个国家 top-3 选手</em>"得用<strong>关联子查询 + self-join</strong>, 一句 SQL 写 30 行还慢。窗口函数把它变成一行: <code>ROW_NUMBER() OVER (PARTITION BY country ORDER BY single)</code>, 配 <code>WHERE rk &lt;= 3</code>。<em>这是 SQL 现代化最关键的一步</em>。</>}
                    en={<>Before 2003, "<em>top 3 cubers per country</em>" required a <strong>correlated subquery plus self-join</strong> — thirty lines of SQL that ran slowly. Window functions collapse it to one line: <code>ROW_NUMBER() OVER (PARTITION BY country ORDER BY single)</code> with <code>WHERE rk &lt;= 3</code>. <em>SQL's single most modernising step</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><code>ROW_NUMBER()</code> — <L zh="行内序号, 同值也不同" en="row index, ties get different numbers" /></li>
                    <li><code>RANK()</code> — <L zh="同值同名次 · 名次跳" en="ties get same rank, with gaps" /></li>
                    <li><code>DENSE_RANK()</code> — <L zh="同值同名次 · 名次不跳" en="ties get same rank, no gaps" /></li>
                    <li><code>LAG / LEAD</code> — <L zh="前一行 / 后一行" en="previous / next row" /></li>
                    <li><code>SUM() OVER (...)</code> — <L zh="累积 / 移动平均" en="running totals / moving averages" /></li>
                    <li><code>FIRST_VALUE / LAST_VALUE</code> — <L zh="窗口边界值" en="window-edge values" /></li>
                  </ul>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"><L zh="-- 每个国家 333 单次 top 3" en="-- top-3 333 singles per country" /></span>{'\n'}
                    <span className="cl-k">WITH</span> ranked <span className="cl-k">AS</span> ({'\n'}
                    {'  '}<span className="cl-k">SELECT</span>{'\n'}
                    {'    '}name, country, single,{'\n'}
                    {'    '}<span className="cl-fn">ROW_NUMBER</span>() <span className="cl-k">OVER</span> ({'\n'}
                    {'      '}<span className="cl-k">PARTITION BY</span> country{'\n'}
                    {'      '}<span className="cl-k">ORDER BY</span> single <span className="cl-k">ASC</span>{'\n'}
                    {'    '}) <span className="cl-k">AS</span> rk{'\n'}
                    {'  '}<span className="cl-k">FROM</span> wca_results{'\n'}
                    {'  '}<span className="cl-k">WHERE</span> event_id = <span className="cl-s">'333'</span>{'\n'}
                    {'    '}<span className="cl-k">AND</span> single <span className="cl-k">IS NOT NULL</span>{'\n'}
                    ){'\n'}
                    <span className="cl-k">SELECT</span> * <span className="cl-k">FROM</span> ranked{'\n'}
                    <span className="cl-k">WHERE</span> rk &lt;= <span className="cl-n">3</span>{'\n'}
                    <span className="cl-k">ORDER BY</span> country, rk;
                  </code></pre>
                </div>
              </div>
            </div>
          </section>

          {/* 08 Engines */}
          <section className="section" id="projects">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="十大引擎" en="The Ten Engines" /> <code>: SqlEngines</code></h2>
              <p className="sec-desc"><L
                zh={<>SQL 的可怕之处不是它的语言, 是它的<strong>引擎多样性</strong>: 从 SQLite 几十 MB 嵌入式跑在每台 iPhone, 到 Snowflake / BigQuery 跑在多区域云上, <strong>同一门 SQL 横跨 10 个数量级的数据规模</strong>。</>}
                en={<>SQL's real strength isn't the language — it's the <strong>engine diversity</strong>. From SQLite at tens of megabytes embedded in every iPhone, to Snowflake and BigQuery spanning multi-region clouds, <strong>the same SQL covers ten orders of magnitude of data scale</strong>.</>}
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

            <div className="ai-tools" style={{ marginTop: 64 }}>
              <h3 className="ai-tools-h" style={{ fontFamily: 'var(--mono)', fontSize: 18, marginBottom: 24, color: 'var(--text)' }}>
                <L zh="2026 工具链 / 客户端 / 框架" en="2026 toolchain / clients / frameworks" />
              </h3>
              <div className="ai-tools-grid">
                {ADOPT_TOOLS.map((t, i) => (
                  <div className="ai-tool" key={i}>
                    <div className="ai-tool-name">{t.name}</div>
                    <div className="ai-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 09 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="SQL vs Python pandas vs MongoDB" en="SQL vs Python pandas vs MongoDB" /> <code>: HowItStacks</code></h2>
              <p className="sec-desc"><L
                zh={<>SQL 的真对手不是另一门 SQL——是<strong>不同的数据访问范式</strong>。Python <a href="/code/python">pandas</a> 是命令式数据帧, MongoDB 是文档查询。三种风格, 同样的"取数据"任务。</>}
                en={<>SQL's real competition isn't another SQL — it's <strong>different paradigms for getting at data</strong>. Python <a href="/code/python">pandas</a> is imperative dataframes; MongoDB is document queries. Three styles, the same "fetch data" task.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">SQL</th>
                  <th className="th-js">Python pandas</th>
                  <th className="th-sw">MongoDB</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="范式" en="Paradigm" />,
                    ts: <L zh="声明式 · 关系" en="Declarative · relational" />,
                    js: <L zh="命令式 · 数据帧" en="Imperative · dataframes" />,
                    sw: <L zh="文档 + Aggregation Pipeline" en="Document + Aggregation Pipeline" /> },
                  { k: <L zh="出身" en="Origin" />,
                    ts: <>IBM · 1974</>,
                    js: <>Wes McKinney · 2008</>,
                    sw: <>10gen / MongoDB Inc · 2009</> },
                  { k: <L zh="数据结构" en="Data structure" />,
                    ts: <L zh="表 (行 · 列 · 类型)" en="Tables (row × column × type)" />,
                    js: <code>DataFrame</code>,
                    sw: <L zh="BSON 文档 (类 JSON)" en="BSON documents (JSON-like)" /> },
                  { k: <L zh="schema" en="Schema" />,
                    ts: <L zh="强制 (DDL 定义)" en="Enforced (DDL-declared)" />,
                    js: <L zh="动态推断" en="Inferred dynamically" />,
                    sw: <L zh="无 / 可选" en="Optional / weak" /> },
                  { k: <L zh="JOIN" en="JOIN" />,
                    ts: <L zh="一等 · 4 种语义" en="First-class · 4 semantics" />,
                    js: <code>merge()</code>,
                    sw: <L zh="$lookup (晚加 · 慢)" en="$lookup (added late · slow)" /> },
                  { k: <L zh="聚合" en="Aggregation" />,
                    ts: <><code>GROUP BY</code> + <code>HAVING</code></>,
                    js: <code>groupby().agg()</code>,
                    sw: <code>$group</code> },
                  { k: <L zh="事务" en="Transactions" />,
                    ts: <L zh={<>原生 ACID</>} en={<>Native ACID</>} />,
                    js: <L zh="无 (单进程内存)" en="None (in-process memory)" />,
                    sw: <L zh="4.0+ 多文档事务" en="4.0+ multi-doc transactions" /> },
                  { k: <L zh="数据规模" en="Data scale" />,
                    ts: <L zh="byte → 多 TB" en="bytes → many TB" />,
                    js: <L zh="RAM (~10⁸ 行)" en="RAM-bound (~10⁸ rows)" />,
                    sw: <L zh="GB → TB · 分片可扩" en="GB → TB · shardable" /> },
                  { k: <L zh="互操作" en="Interop" />,
                    ts: <L zh="所有语言都有 client" en="Every language has a client" />,
                    js: <L zh="Python 生态深嵌" en="Deep in Python ecosystem" />,
                    sw: <L zh="JS / Python / Java 主流" en="JS / Python / Java widely" /> },
                  { k: <L zh="2026 用途" en="2026 usage" />,
                    ts: <L zh={<>OLTP + OLAP + 嵌入 + 数仓</>} en={<>OLTP + OLAP + embedded + warehouse</>} />,
                    js: <L zh="数据科学探索" en="Data-science exploration" />,
                    sw: <L zh="日志 / IoT / 配置 / cache" en="Logs / IoT / config / cache" /> },
                  { k: <L zh="趋势" en="Trend" />,
                    ts: <L zh={<><strong>稳</strong> · 50 年默认</>} en={<><strong>Steady</strong> · 50-year default</>} />,
                    js: <L zh={<>↘ <strong>DuckDB 蚕食</strong></>} en={<>↘ <strong>DuckDB eating into it</strong></>} />,
                    sw: <L zh={<>稳 · 加了 SQL-ish 接口</>} en={<>Steady · added SQL-ish interface</>} /> },
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
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: NextFiftyYears</code></h2>
              <p className="sec-desc"><L
                zh={<>56 岁的 SQL <strong>不会换语法</strong>——但它要适应的场景仍在变。LLM 帮人写查询、分布式 SQL 改 ops 模型、DuckDB 把分析拉回本地。<strong>SQL 不变, 周围一切都在变</strong>。</>}
                en={<>SQL at 56 <strong>won't change its syntax</strong> — but the surroundings keep moving. LLMs help humans write queries; distributed SQL reshapes the ops model; DuckDB pulls analytics back to the laptop. <strong>SQL stays still, everything around it moves</strong>.</>}
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

            <div className="ai-takeaway" style={{ marginTop: 48 }}>
              <p><strong><L zh="一句话: " en="In one line: " /></strong><L
                zh={<>SQL 不需要"未来"——它<strong>已经是数据层的默认语言, 用 56 年了, 大概还会用 56 年</strong>。新引擎得说 SQL, 新 BI 得吐 SQL, 连 NoSQL 都回头加 SQL。<em>它不是赢家, 它是基础设施</em>。</>}
                en={<>SQL doesn't need a "future" — it's <strong>already the data layer's default, 56 years deep, and likely good for another 56</strong>. New engines speak SQL, new BI tools emit SQL, even NoSQL came back and added SQL. <em>It isn't a winner — it's infrastructure</em>.</>}
              /></p>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="标准 / 参考" en="Standards / Reference" /></h4>
              <ul>
                <li><a href="https://en.wikipedia.org/wiki/SQL" target="_blank" rel="noopener"><L zh="Wikipedia: SQL (历史)" en="Wikipedia: SQL (history)" /></a></li>
                <li><a href="https://www.iso.org/standard/76583.html" target="_blank" rel="noopener">ISO · SQL:2016</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Edgar_F._Codd" target="_blank" rel="noopener">Codd 1970 (relational model)</a></li>
                <li><a href="https://en.wikipedia.org/wiki/Donald_D._Chamberlin" target="_blank" rel="noopener">Chamberlin · Boyce · SEQUEL</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="OLTP 引擎" en="OLTP Engines" /></h4>
              <ul>
                <li><a href="https://www.postgresql.org" target="_blank" rel="noopener">postgresql.org</a></li>
                <li><a href="https://www.postgresql.org/docs/" target="_blank" rel="noopener">PG docs</a></li>
                <li><a href="https://www.mysql.com" target="_blank" rel="noopener">mysql.com</a></li>
                <li><a href="https://mariadb.org" target="_blank" rel="noopener">mariadb.org</a></li>
                <li><a href="https://www.sqlite.org" target="_blank" rel="noopener">sqlite.org</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="OLAP / 分析" en="OLAP / Analytics" /></h4>
              <ul>
                <li><a href="https://duckdb.org" target="_blank" rel="noopener">duckdb.org</a></li>
                <li><a href="https://clickhouse.com" target="_blank" rel="noopener">clickhouse.com</a></li>
                <li><a href="https://www.snowflake.com" target="_blank" rel="noopener">snowflake.com</a></li>
                <li><a href="https://cloud.google.com/bigquery" target="_blank" rel="noopener">Google BigQuery</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="深入阅读" en="Deep Reading" /></h4>
              <ul>
                <li><a href="https://www.databass.dev/" target="_blank" rel="noopener">Database Internals (Petrov)</a></li>
                <li><a href="http://db.cs.berkeley.edu/papers/fntdb07-architecture.pdf" target="_blank" rel="noopener">Hellerstein · DB architecture</a></li>
                <li><a href="https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf" target="_blank" rel="noopener">Codd 1970 (PDF)</a></li>
                <li><a href="/code/python"><L zh="Python — pandas 对照" en="Python — pandas counterpoint" /></a></li>
                <li><a href="/code/javascript"><L zh="JavaScript — Drizzle / Prisma" en="JavaScript — Drizzle / Prisma" /></a></li>
                <li><a href="/code/rust"><L zh="Rust — sqlx / diesel" en="Rust — sqlx / diesel" /></a></li>
                <li><a href="/code/bash"><L zh="Bash — 同住 script/query 一格" en="Bash — same script/query bucket" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{SQL_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`SELECT 'still here' FROM sql_history;`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
