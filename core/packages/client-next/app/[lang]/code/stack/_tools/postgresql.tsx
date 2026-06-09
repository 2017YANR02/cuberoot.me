import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, c, t } from '../_lib/stack_tool_types';

// ─── PostgreSQL 13 ──────────────────────────────────────────────────────────

export const POSTGRES: StackTool = {
  slug: 'postgresql',
  name: 'PostgreSQL',
  version: '13',
  since: '1986',
  group: 'backend',
  accent: '#336791',
  bright: '#4F8BC2',
  glyph: 'Pg',
  floats: ['SELECT', 'jsonb', 'WAL', 'MVCC', 'GIN', 'CTE', 'VACUUM', 'WINDOW', 'LATERAL', 'pgvector', 'ON CONFLICT', 'EXPLAIN'],
  zh: {
    tagline: '对象关系型 + 文档 + 数组 一锅端',
    role: '主库。recon 缓存 / 41 套 alg 公式 / 训练数据 / WCA 衍生统计全部落 PG 13。',
    heroSub: <>1986 年伯克利的研究项目, 2026 年仍是新项目最稳的默认 SQL 选择。Stonebraker 把对象关系模型塞进 SQL, 之后三十年社区把 jsonb、数组、窗口、CTE、并行、逻辑复制一项项加上来 —— 一个引擎吃下关系、文档、向量三种工作负载。</>,
    whatDesc: <>PostgreSQL 是一个 <strong>对象关系型数据库</strong>。它不是 NoSQL, 也不是云原生新派, 而是经过 40 年迭代的传统 SQL 引擎 —— 但传统不等于守旧:jsonb 让它能当文档库用, pgvector 让它能当向量库用, GIN / GiST 索引让它能跑全文检索, 一个引擎就把多模数据吞下来。</>,
    historyDesc: <>从 1986 年伯克利 POSTGRES 到 2025 年 PG 18, 几个关键节点:1996 SQL 化 + 开源、2000 WAL、2014 jsonb、2017 逻辑复制、2020 PG 13、2023 pgvector 把它拽进 AI 时代。每一个 major 都向后兼容十几年, 升级风险低到反常。</>,
    conceptsTitle: 'SQL + 扩展',
    conceptsDesc: <>把 PG 的特性挑出来看, 主要分三组:严格的 SQL 语义 (transactional DDL / window / CTE / LATERAL)、半结构化 (jsonb + GIN)、并发 (MVCC + parallel VACUUM + 索引去重)。三组组合起来覆盖了绝大多数业务场景。</>,
    whyDesc: <>选 PG 不是因为它快 —— 单点写入未必跑得过 MySQL。选它是因为它 <strong>严格</strong>、<strong>多模</strong>、<strong>扩展强</strong>:transactional DDL 让 migration 安全, jsonb / 数组 / 范围一个引擎搞定, PostGIS / pgvector / pg_trgm 让需求从地理到 AI 一站式。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Apple 自爆几十个 PG 集群、Stripe 把支付核心放在 PG 上、Reddit / GitLab / Instacart 全是百万 QPS 量级 PG, Supabase / Neon / Crunchy 这一代 SaaS 直接把 PG 当产品卖。</>,
    cuberootDesc: <>cuberoot.me 跑一个 PG 13 实例, Hono 走 Unix socket 连接 (省一跳网络)。四组负载:<code>recon_*</code> 缓存 (jsonb 列)、<code>alg_sets</code> / <code>alg_cases</code> 41 套公式库、<code>training_*</code> 训练数据、<code>wca_stats_extra</code> 等 WCA 统计衍生表。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>PG 18 (2025-09) 加 async I/O + OAuth + 虚拟生成列, PG 17 之前的 incremental backup / JSON_TABLE 也才稳。pgvector 让 PG 直接吃 AI workload, 不需要再拉一个向量库。PG 13 这条线 2025-11 已 EOL, cuberoot.me 因 schema 只用 13 之前的特性, 暂未升。</>,
  },
  en: {
    tagline: 'Object-relational + document + array, one engine',
    role: 'Primary store. Recon caches, the 41-set alg library, training data, and WCA stats derivatives all live in PG 13.',
    heroSub: <>A 1986 Berkeley research project that is still the safest default SQL choice for new work in 2026. Stonebraker bolted an object-relational model onto SQL; the next three decades added jsonb, arrays, windows, CTEs, parallel queries, logical replication — one engine that swallows relational, document, and vector workloads together.</>,
    whatDesc: <>PostgreSQL is an <strong>object-relational database</strong>. It is neither NoSQL nor a cloud-native upstart — it is a traditional SQL engine refined for forty years. "Traditional" here is not "stale": jsonb makes it a document store, pgvector makes it a vector store, GIN / GiST drive full-text search. One engine, multi-model data.</>,
    historyDesc: <>From Berkeley POSTGRES (1986) to PG 18 (2025), the load-bearing waypoints: 1996 SQL + open source, 2000 WAL, 2014 jsonb, 2017 logical replication, 2020 PG 13, 2023 pgvector pulls PG into the AI era. Each major is backwards-compatible across a decade plus — upgrade risk is unusually low.</>,
    conceptsTitle: 'SQL + extensions',
    conceptsDesc: <>PG's surface area splits roughly three ways: strict SQL semantics (transactional DDL, windows, CTE, LATERAL); semi-structured (jsonb + GIN); concurrency (MVCC, parallel VACUUM, B-tree dedup). Combined, they cover the vast majority of business workloads.</>,
    whyDesc: <>You don't pick PG because it's fast — single-row write throughput won't beat MySQL. You pick it because it is <strong>strict</strong>, <strong>multi-model</strong>, and <strong>extensible</strong>: transactional DDL makes migrations safe, jsonb / arrays / ranges live in one engine, and PostGIS / pgvector / pg_trgm cover geo to AI without leaving the database.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Apple has publicly confirmed dozens of PG clusters; Stripe runs payments on PG; Reddit / GitLab / Instacart all push million-QPS PG. Supabase / Neon / Crunchy literally sell PG as the product.</>,
    cuberootDesc: <>cuberoot.me runs a single PG 13 instance; Hono connects over Unix socket (one fewer network hop). Four workloads share it: <code>recon_*</code> caches (jsonb columns), the <code>alg_sets</code> / <code>alg_cases</code> 41-set library, <code>training_*</code> training data, and <code>wca_stats_extra</code>-family WCA derivatives.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>PG 18 (2025-09) lands async I/O, OAuth, and virtual generated columns; PG 17's incremental backup + JSON_TABLE only just stabilised. pgvector lets PG absorb AI workloads without a separate vector DB. The PG 13 line went EOL 2025-11; cuberoot.me hasn't moved yet because the schema only uses features stable since 13.</>,
  },
  heroStats: [
    { num: '40', unit: 'y', zh: <>自 1986 伯克利至今 <em>Stonebraker 项目</em></>, en: <>since Berkeley 1986 <em>Stonebraker project</em></>,
        zhHant: <>自 1986 伯克利至今 <em>Stonebraker 項目</em></>
    },
    { num: '13', zh: <>本站运行版本 <em>2026-05 · cuberoot.me</em></>, en: <>version running on this site <em>2026-05 · cuberoot.me</em></>,
        zhHant: <>本站執行版本 <em>2026-05 · cuberoot.me</em></>
    },
    { num: '18', unit: '.1', zh: <>家族最新稳定 <em>2025-11-13 release</em></>, en: <>latest stable in family <em>2025-11-13 release</em></>,
        zhHant: <>家族最新穩定 <em>2025-11-13 release</em></>
    },
    { num: '13', unit: '.23', zh: <>13 线最终版 + EOL <em>2025-11-13</em></>, en: <>final 13.x + EOL <em>2025-11-13</em></>,
        zhHant: <>13 線最終版 + EOL <em>2025-11-13</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>PostgreSQL 起源是 1986 年伯克利的 POSTGRES 项目, Michael Stonebraker 想在关系数据库上加"对象"特性 —— 自定义类型、继承、过程性查询。当时查询语言叫 QUEL, 不是 SQL。这版本完全是学术 demo, 性能能用但不快, 商业化分支被卖给了 Illustra (后并入 Informix)。</p>
        <p>1996 年是真正的转折:Andrew Yu / Jolly Chen 把 QUEL 换成 SQL, 名字改成 PostgreSQL, 6.0 开源发布。从此进入 community 模式, 没有公司控股 —— 这一点在数据库圈极罕见, 也是它后来稳定的根基。2000 年 7.0 加 WAL (Write-Ahead Log), 给后面所有的复制 / PITR / 备份铺底。</p>
        <p>之后是慢慢加 feature:2010 流复制、2014 jsonb (Postgres 从此当文档库用)、2017 逻辑复制 + 声明式分区、2020 PG 13、2023 pgvector 把 PG 拽进 AI 时代。每一个 major 都向后兼容很长一段时间 —— PG 13 的协议跟 PG 9.x 还能互通。这种保守是它能在 2026 年仍被新项目首选的关键原因。</p>
      </>
    ),
    en: (
      <>
        <p>PostgreSQL began as Berkeley's POSTGRES project in 1986, Michael Stonebraker's attempt to graft "object" features (custom types, inheritance, procedural queries) onto a relational database. The query language was QUEL, not SQL. The original was an academic demo — usable but not fast — and the commercial fork was sold to Illustra (later folded into Informix).</p>
        <p>The real pivot came in 1996, when Andrew Yu and Jolly Chen swapped QUEL for SQL, renamed the project PostgreSQL, and shipped 6.0 under an open-source licence. From that moment it ran on community governance — no single corporate owner — which is rare in databases and is the root of its long-term stability. 7.0 (2000) introduced WAL (Write-Ahead Logging), the foundation for all later replication, PITR, and backup work.</p>
        <p>The rest is steady, additive growth: 2010 streaming replication, 2014 jsonb (PG turns into a document store), 2017 logical replication + declarative partitioning, 2020 PG 13, 2023 pgvector pulls PG into the AI era. Every major stays wire-compatible for over a decade — a PG 13 client still talks to a PG 9.x server. That conservatism is exactly why PG remains the default in 2026.</p>
      </>
    ),
  },
  history: [
    { year: '1986', zh: { title: <>伯克利 POSTGRES 立项</>, desc: <>Stonebraker 在 UC Berkeley 做对象关系数据库实验。查询语言是 QUEL 不是 SQL。学术 demo, 商业分支 Illustra 后并 Informix。</> }, en: { title: <>Berkeley POSTGRES begins</>, desc: <>Stonebraker prototypes an object-relational DB at UC Berkeley. Query language is QUEL, not SQL. Academic demo; commercial fork (Illustra) later folds into Informix.</> } },
    { year: '1996', zh: { title: <>SQL 化 + 改名 PostgreSQL</>, desc: <>Andrew Yu / Jolly Chen 把 QUEL 换成 SQL, 改名 PostgreSQL, 6.0 开源发布。community 治理从此定型, 没有公司控股。pg_dump 也在这个时间点随首版 SQL 工具集发布。</> }, en: { title: <>SQL + renamed PostgreSQL</>, desc: <>Andrew Yu and Jolly Chen swap QUEL for SQL and rename it PostgreSQL; 6.0 ships open-source. Community governance — no corporate owner — sets the long-term tone. pg_dump ships alongside the first SQL-era toolset.</> } },
    { year: '2000', zh: { title: <>7.0 加 WAL</>, desc: <>Write-Ahead Log 落地。崩溃恢复 / point-in-time recovery / 物理复制全部以它为基础。这是 PG 第一次有"数据库级"可靠性。</> }, en: { title: <>7.0 ships WAL</>, desc: <>Write-Ahead Logging lands. Crash recovery, point-in-time recovery, and physical replication all build on it. The first release where PG has true database-grade durability.</> } },
    { year: '2010', zh: { title: <>9.0 流复制 + hot standby</>, desc: <>Streaming replication + hot standby 正式 GA。从此 PG 高可用是开箱即用, 不再依赖第三方 (Slony / Bucardo)。</> }, en: { title: <>9.0 streaming replication + hot standby</>, desc: <>Streaming replication and hot standby reach GA. High availability is now built in — no more relying on Slony / Bucardo.</> } },
    { year: '2014', zh: { title: <>9.4 jsonb + GIN</>, desc: <>jsonb 二进制 JSON 列 + GIN 索引上线。从这天起 Postgres 是一个真正能当文档库用的关系数据库, MongoDB 的 unique value proposition 被吃掉一大块。</> }, en: { title: <>9.4 jsonb + GIN</>, desc: <>The jsonb binary JSON column type and the GIN index ship together. From here, PG is a genuine document store wearing a relational coat — and a major chunk of MongoDB's value proposition is absorbed.</> } },
    { year: '2017', zh: { title: <>10 逻辑复制 + 声明式分区</>, desc: <>原生 logical replication 让跨主版本升级 / 选择性表复制成立。声明式分区也终结了 Postgres 长年靠 inheritance 模拟分区的尴尬。</> }, en: { title: <>10 logical replication + declarative partitioning</>, desc: <>Native logical replication enables major-version upgrades and selective table replication. Declarative partitioning ends years of inheritance-based hacks.</> } },
    { year: '2020·09', highlight: true, zh: { title: <>PG 13 GA</>, desc: <>2020-09-24 发布。亮点:B-tree 去重把索引体积砍 30~50%, 并行 VACUUM, incremental sort, OR 子句下的 extended statistics。cuberoot.me 至今仍跑这版。</> }, en: { title: <>PG 13 GA</>, desc: <>Released 2020-09-24. Highlights: B-tree deduplication shrinks indexes 30–50%, parallel VACUUM, incremental sort, extended statistics for OR clauses. cuberoot.me still runs this line.</> } },
    { year: '2023·08', zh: { title: <>pgvector 0.5 + AI</>, desc: <>pgvector 把向量列 + ANN 索引 (HNSW / IVFFlat) 标准化, PG 直接变 LLM RAG 后端的默认选项之一。Supabase / Neon 全部接入。</> }, en: { title: <>pgvector 0.5 + AI</>, desc: <>pgvector standardises vector columns + ANN indexes (HNSW / IVFFlat). PG immediately becomes one of the default backends for LLM RAG. Supabase / Neon all integrate it.</> } },
    { year: '2024·09', zh: { title: <>PG 17</>, desc: <>2024-09-26 GA。incremental backup (pg_basebackup), JSON_TABLE 标准函数, MERGE 在 RETURNING 上加强。逻辑复制可以从 standby 起。</> }, en: { title: <>PG 17</>, desc: <>GA 2024-09-26. Incremental backups in pg_basebackup, the standard JSON_TABLE function, MERGE gains RETURNING support, logical replication can start from a standby.</> } },
    { year: '2025·09', zh: { title: <>PG 18</>, desc: <>2025-09-25 GA。async I/O 把读吞吐再翻一档, OAuth 进 server, virtual generated columns, EXPLAIN 默认带 buffers。家族当前最新。</> }, en: { title: <>PG 18</>, desc: <>GA 2025-09-25. Async I/O lifts read throughput another tier, OAuth lands server-side, virtual generated columns ship, EXPLAIN includes buffers by default. Current family head.</> } },
    { year: '2025·11', highlight: true, zh: { title: <>13.23 / 13 EOL</>, desc: <>2025-11-13 发布的 13.23 是 13 线最后一个 release — 同日 PG 13 正式 EOL。之后 13 不再有官方 security patch。cuberoot.me 跑的就是这个版本号。</> }, en: { title: <>13.23 / PG 13 EOL</>, desc: <>13.23 (2025-11-13) is the final release on the 13 line — the same date marks the official EOL of PG 13. No further upstream security patches. This is exactly the version running on cuberoot.me.</> } },
    { year: '2026·05', zh: { title: <>cuberoot.me 仍在 13</>, desc: <>2026-05-06 把后端从 MariaDB 迁到 PG 13, 不上 18 是因为现 schema 只用 13 之前已稳的特性, 升级回报 ≈ 0, 风险 &gt; 0。pg_dump nightly 兜底。</> }, en: { title: <>cuberoot.me still on 13</>, desc: <>Backend migrated from MariaDB to PG 13 on 2026-05-06. Not on 18 because the schema only uses features stable since 13 — upgrade payoff ≈ 0, risk &gt; 0. Nightly pg_dump as a safety net.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>jsonb + GIN</>, desc: <>jsonb 列 + GIN 索引让"半结构化字段"也能毫秒命中, 不用每改一次 schema 就跑 ALTER TABLE。</> }, en: { title: <>jsonb + GIN</>, desc: <>A jsonb column plus a GIN index lets semi-structured fields hit sub-millisecond lookups without ALTER TABLE on every schema change.</> }, code: <code>{k('CREATE TABLE')} {v('recon_cache')} ({'\n'}  {v('id')}     {t('bigserial')} {k('PRIMARY KEY')},{'\n'}  {v('payload')} {t('jsonb')} {k('NOT NULL')}{'\n'});{'\n\n'}{k('CREATE INDEX')} {k('ON')} {v('recon_cache')} {k('USING')} {f('GIN')} ({v('payload')});{'\n\n'}{k('SELECT')} * {k('FROM')} {v('recon_cache')}{'\n'}{k('WHERE')} {v('payload')} @&gt; {s("'{\"event\": \"333\"}'")}::{t('jsonb')};</code> },
    { tag: 'B', zh: { title: <>窗口函数</>, desc: <>OVER (PARTITION BY ... ORDER BY ...) 让"每个分组的第 N 名 / 移动平均"一条 SQL 写完, 不用 self-join。</> }, en: { title: <>Window functions</>, desc: <>OVER (PARTITION BY ... ORDER BY ...) handles "Nth row per group" or "moving average" in a single statement — no self-join needed.</> }, code: <code>{k('SELECT')} {v('person_id')}, {v('event_id')}, {v('best')},{'\n'}  {f('row_number')}() {k('OVER')} ({'\n'}    {k('PARTITION BY')} {v('event_id')}{'\n'}    {k('ORDER BY')} {v('best')} {k('ASC')}{'\n'}  ) {k('AS')} {v('rk')}{'\n'}{k('FROM')} {v('results')}{'\n'}{k('WHERE')} {v('best')} &gt; {n('0')};</code> },
    { tag: 'C', zh: { title: <>部分索引</>, desc: <>WHERE 条件下的索引。只索引 active / non-null 行, 索引体积小一个数量级, 命中率高。</> }, en: { title: <>Partial index</>, desc: <>An index with a WHERE clause. You index only active / non-null rows — order-of-magnitude smaller index, faster lookups.</> }, code: <code>{k('CREATE INDEX')} {v('idx_open_comps')}{'\n'}  {k('ON')} {v('competitions')} ({v('start_date')}){'\n'}  {k('WHERE')} {v('end_date')} &gt;= {f('CURRENT_DATE')};</code> },
    { tag: 'D', zh: { title: <>CTE / 递归 CTE</>, desc: <>WITH 把查询切成段, RECURSIVE 让树 / 图遍历用纯 SQL 表达。读起来比一坨 subquery 清楚得多。</> }, en: { title: <>CTE / recursive CTE</>, desc: <>WITH splits a query into named steps; RECURSIVE expresses tree / graph traversal in plain SQL. Vastly more readable than nested subqueries.</> }, code: <code>{k('WITH RECURSIVE')} {v('chain')}({v('id')}, {v('parent')}) {k('AS')} ({'\n'}  {k('SELECT')} {v('id')}, {v('parent_id')} {k('FROM')} {v('alg_cases')}{'\n'}  {k('WHERE')} {v('id')} = {n('42')}{'\n'}  {k('UNION ALL')}{'\n'}  {k('SELECT')} {v('a')}.{v('id')}, {v('a')}.{v('parent_id')}{'\n'}  {k('FROM')} {v('alg_cases')} {v('a')} {k('JOIN')} {v('chain')} {v('c')}{'\n'}  {k('ON')} {v('a')}.{v('id')} = {v('c')}.{v('parent')}{'\n'}){'\n'}{k('SELECT')} * {k('FROM')} {v('chain')};</code> },
    { tag: 'E', zh: { title: <>事务性 DDL</>, desc: <>ALTER TABLE / CREATE INDEX 全部能进事务。migration 失败可 ROLLBACK, 不会留半张表。MySQL / MariaDB 至今做不到。</> }, en: { title: <>Transactional DDL</>, desc: <>ALTER TABLE / CREATE INDEX run inside a transaction. A failed migration ROLLBACKs cleanly — no half-applied schemas. MySQL / MariaDB still can't.</> }, code: <code>{k('BEGIN')};{'\n'}{k('ALTER TABLE')} {v('recon')} {k('ADD COLUMN')} {v('notes')} {t('text')};{'\n'}{k('CREATE INDEX')} {k('ON')} {v('recon')} ({v('competition_id')});{'\n'}{k('COMMIT')};  {c('-- 全成功才生效')}</code> },
    { tag: 'F', zh: { title: <>LATERAL JOIN</>, desc: <>LATERAL 让右侧子查询能引用左侧每一行 —— 适合"每个 user 的最近 3 条记录"这种 top-N-per-group。</> }, en: { title: <>LATERAL JOIN</>, desc: <>LATERAL lets the right-hand subquery reference each left-hand row — exactly the shape of "top-N rows per group."</> }, code: <code>{k('SELECT')} {v('u')}.{v('id')}, {v('r')}.{v('best')}{'\n'}{k('FROM')} {v('users')} {v('u')}{'\n'}{k('JOIN LATERAL')} ({'\n'}  {k('SELECT')} {v('best')} {k('FROM')} {v('results')} {v('r')}{'\n'}  {k('WHERE')} {v('r')}.{v('user_id')} = {v('u')}.{v('id')}{'\n'}  {k('ORDER BY')} {v('best')} {k('LIMIT')} {n('3')}{'\n'}) {v('r')} {k('ON')} {k('true')};</code> },
    { tag: 'G', zh: { title: <>ON CONFLICT (UPSERT)</>, desc: <>INSERT ... ON CONFLICT DO UPDATE 一行解决 "存在就更新, 不存在就插", 不用 SELECT + UPDATE + INSERT 三段 retry。</> }, en: { title: <>ON CONFLICT (UPSERT)</>, desc: <>INSERT ... ON CONFLICT DO UPDATE collapses "update if it exists, insert otherwise" into one statement — no SELECT + UPDATE + INSERT retry dance.</> }, code: <code>{k('INSERT INTO')} {v('alg_cases')} ({v('set_id')}, {v('name')}, {v('alg')}){'\n'}{k('VALUES')} ({n('5')}, {s("'OLL-21'")}, {s("'R U R\\' U R U2 R\\''")}){'\n'}{k('ON CONFLICT')} ({v('set_id')}, {v('name')}) {k('DO UPDATE')}{'\n'}  {k('SET')} {v('alg')} = {k('EXCLUDED')}.{v('alg')};</code> },
    { tag: 'H', zh: { title: <>生成列</>, desc: <>STORED generated column 让派生字段在写入时算好, 读时零成本。PG 18 加了 VIRTUAL, 读时算, 不占行宽。</> }, en: { title: <>Generated columns</>, desc: <>STORED generated columns precompute derived fields at write time — zero read overhead. PG 18 adds VIRTUAL (computed on read, no row-width cost).</> }, code: <code>{k('CREATE TABLE')} {v('times')} ({'\n'}  {v('cs')}  {t('int')},{'\n'}  {v('sec')} {t('numeric')}{'\n'}    {k('GENERATED ALWAYS AS')} ({v('cs')} / {n('100.0')}){'\n'}    {k('STORED')}{'\n'});</code> },
  ],
  whyCards: [
    { icon: '⚖', zh: { title: <>严格的 SQL 语义</>, desc: <>PG 默认严格:NULL = NULL 不为真、类型转换不会偷偷给你 silent truncate、unique 约束就是 unique。MySQL/MariaDB 那套 "宽容" 在 PG 这里全是 error。</> }, en: { title: <>Strict SQL semantics</>, desc: <>PG defaults to strict: NULL = NULL is not true, type coercion never silently truncates, unique means unique. MySQL/MariaDB's "lenient" behaviour is just an error here.</> }, code: <>{k('SELECT')} {n('1')} = {k('NULL')}; {c('-- → NULL')}</> },
    { icon: '⛁', zh: { title: <>多模一锅端</>, desc: <>关系 + jsonb + 数组 + 范围类型 + tsvector 全文 + pgvector 向量。一个连接池吃下 5 种数据模型, 不需要架第二个引擎。</> }, en: { title: <>Multi-model under one engine</>, desc: <>Relational + jsonb + arrays + range types + tsvector full-text + pgvector vectors. One connection pool handles five data models — no second engine.</> }, code: <>{v('tags')} {t('text[]')},{'\n'}{v('payload')} {t('jsonb')},{'\n'}{v('emb')} {t('vector(1536)')}</> },
    { icon: '⌬', zh: { title: <>扩展生态</>, desc: <>PostGIS (地理)、pg_trgm (模糊搜索)、pgvector (向量)、pg_stat_statements (性能)、TimescaleDB (时序) ... 想要的功能基本一个 CREATE EXTENSION 解决。</> }, en: { title: <>Extension ecosystem</>, desc: <>PostGIS (geo), pg_trgm (fuzzy search), pgvector (vector), pg_stat_statements (perf), TimescaleDB (time series) — whatever you need is one CREATE EXTENSION away.</> }, code: <>{k('CREATE EXTENSION')} {v('pg_trgm')};</> },
    { icon: '⏚', zh: { title: <>事务性 DDL = 安全 migration</>, desc: <>BEGIN ... ALTER ... COMMIT, 失败整体 rollback。schema 变更不再是"半成品状态" 的来源, 这一点上 MySQL/MariaDB 落后一个时代。</> }, en: { title: <>Transactional DDL = safe migrations</>, desc: <>BEGIN ... ALTER ... COMMIT — fail and the whole change rolls back. Schema changes stop being a source of half-applied state. MySQL/MariaDB lag a generation here.</> }, code: <>{k('BEGIN')}; {k('ALTER TABLE')} ...; {k('COMMIT')};</> },
    { icon: '⚙', zh: { title: <>MVCC 并发</>, desc: <>读不阻塞写, 写不阻塞读。VACUUM 在 PG 13 后并行 + 加快, 长事务造成的 bloat 在合理 workload 下基本不需要操心。</> }, en: { title: <>MVCC concurrency</>, desc: <>Reads don't block writes; writes don't block reads. VACUUM is parallel in PG 13+ and substantially faster — bloat from long transactions stops being a routine worry.</> }, code: <>{c('-- 写入不挡住读取')}{'\n'}{k('BEGIN')}; {k('UPDATE')} ...;</> },
    { icon: '⊕', zh: { title: <>向后兼容长</>, desc: <>PG 13 的 client 能连 PG 18 server, PG 18 的 dump 文件能 restore 到 PG 13 (在该 schema 兼容范围内)。这种保守让企业敢长期押注。</> }, en: { title: <>Long backwards-compatibility</>, desc: <>A PG 13 client connects to a PG 18 server; a PG 18 dump restores into PG 13 (within the schema-compatible subset). That conservatism is exactly why enterprises pick PG long-term.</> }, code: <>{c('-- pg_dump 13 → pg_restore 18 OK')}</> },
    { icon: '⚐', zh: { title: <>免费 + 社区治理</>, desc: <>PostgreSQL 没有"公司主导"的复杂性 (跟 MySQL 卖给 Oracle 后那种焦虑相反)。许可证 PostgreSQL License (BSD-like), 不带任何 GPL 传染性。</> }, en: { title: <>Free + community-governed</>, desc: <>No corporate-owner anxiety (unlike MySQL after Oracle). PostgreSQL License is BSD-like, no GPL-style copyleft to worry about.</> }, code: <>{c('-- PostgreSQL License: BSD-like')}</> },
    { icon: '⌗', zh: { title: <>AI-friendly</>, desc: <>pgvector 让 PG 直接当向量库, embedding + 关系数据同库同事务。Supabase / Neon / Vercel Postgres 全部把 PG + pgvector 作为 RAG 默认底座。</> }, en: { title: <>AI-friendly</>, desc: <>pgvector turns PG into a vector store: embeddings and relational data share one DB, one transaction. Supabase / Neon / Vercel Postgres all default to PG + pgvector for RAG.</> }, code: <>{v('emb')} {t('vector(1536)')},{'\n'}{k('CREATE INDEX')} {k('USING')} {v('hnsw')} ({v('emb')})</> },
    { icon: '⛯', zh: { title: <>从 100 KB 到 PB 都活</>, desc: <>cuberoot.me 的 PG 才几百 MB; Stripe / Apple 的 PG 是 PB 级。同一个引擎, 调参数 + 加扩展就能撑住六个量级的数据规模。</> }, en: { title: <>From 100 KB to PB</>, desc: <>cuberoot.me's PG is a few hundred MB; Stripe / Apple run PB-scale PG. Same engine — tune parameters and add extensions, and it handles six orders of magnitude.</> }, code: <>{c('-- 6 orders of magnitude, same engine')}</> },
  ],
  adopters: [
    { name: 'Apple', highlight: true, zhNote: '官方披露数十个 PG 集群, 内部多个核心服务', enNote: 'Publicly disclosed dozens of PG clusters across core services' },
    { name: 'Stripe', href: 'https://stripe.com', highlight: true, zhNote: '支付核心数据落在 PG', enNote: 'Payments core data lives on PG' },
    { name: 'Reddit', href: 'https://reddit.com', zhNote: '社区帖 / 评论核心库', enNote: 'Posts + comments core data store' },
    { name: 'GitLab', href: 'https://gitlab.com', highlight: true, zhNote: '整个 GitLab.com SaaS 后端单点 PG', enNote: 'Entire GitLab.com SaaS backend on PG' },
    { name: 'Instacart', href: 'https://instacart.com', zhNote: '订单 + 库存核心 PG', enNote: 'Orders + inventory on PG' },
    { name: 'Coinbase', href: 'https://coinbase.com', zhNote: '交易记录 + 用户数据', enNote: 'Trade history + user data' },
    { name: 'Heroku Postgres', href: 'https://www.heroku.com/postgres', zhNote: '最早把 PG 当 PaaS 卖的厂商', enNote: 'The original PG-as-PaaS vendor' },
    { name: 'Supabase', href: 'https://supabase.com', highlight: true, zhNote: '直接把 PG 当产品卖, Firebase 替代', enNote: 'Sells PG as the product — the Firebase alternative' },
    { name: 'Neon', href: 'https://neon.tech', zhNote: 'Serverless PG, 分支 + 分支合并', enNote: 'Serverless PG with branching + merge' },
    { name: 'Crunchy Data', href: 'https://www.crunchydata.com', zhNote: '企业级 PG 厂, K8s operator', enNote: 'Enterprise PG vendor; Kubernetes operator' },
    { name: 'Citus · Azure Cosmos for PG', href: 'https://www.citusdata.com', zhNote: '分布式 PG, 微软收购后并入 Azure', enNote: 'Distributed PG, acquired by Microsoft, now in Azure' },
    { name: 'cuberoot.me', highlight: true, zhNote: '单实例 PG 13, recon / alg / training / wca 四类数据共享', enNote: 'Single PG 13 instance — recon, alg, training, and WCA data share it' },
  ],
  outlook: [
    { tag: <>HOT · 2025-09</>, hot: true, big: true, zh: { title: <>PG 18 异步 I/O 落地</>, body: <><p>PG 18 把异步 I/O (io_uring on Linux) 接进 storage 层。读路径吞吐再翻一档, 尤其顺序扫 + index scan。OLTP workload 收益不大, 但分析型 / 数据仓库式 PG 用法直接收益。</p><p>同版还加了 OAuth 服务端集成 (PG 自己能当 OAuth resource server)、虚拟生成列 (不占行宽)、EXPLAIN 默认带 buffer 计数。</p></> }, en: { title: <>PG 18 async I/O</>, body: <><p>PG 18 wires async I/O (io_uring on Linux) into the storage layer. Read throughput jumps another tier — sequential scans and index scans benefit most. OLTP gains little; analytical / warehouse-style PG sees a real boost.</p><p>Same release: server-side OAuth (PG can act as the OAuth resource server), virtual generated columns (zero row-width cost), and EXPLAIN includes buffers by default.</p></> } },
    { tag: 'EOL', zh: { title: <>PG 13 在 2025-11 已 EOL</>, body: <><p>13.23 (2025-11-13) 是 13 线最后一个 release, 同日 PG 13 进入 community EOL。之后任何 CVE 都不会有官方 patch。Production 上还跑 13 的方案是:订阅 EDB / Crunchy 的扩展支持, 或迁版本 (建议 17+)。</p><p>cuberoot.me 仍在 13:数据量小、schema 简单、nightly pg_dump 兜底, 升级回报极有限, 风险 &gt; 0。</p></> }, en: { title: <>PG 13 EOL as of 2025-11</>, body: <><p>13.23 (2025-11-13) was the final release on the 13 line, and the same date marked community EOL. No further upstream patches for CVEs. Options for production on 13: pay for extended support (EDB / Crunchy) or upgrade (17+ recommended).</p><p>cuberoot.me sticks with 13: small data, simple schema, nightly pg_dump as a safety net — upgrade payoff is marginal and risk &gt; 0.</p></> } },
    { tag: 'AI', zh: { title: <>pgvector 把 PG 变 RAG 底座</>, body: <><p>2023 起 pgvector 把 HNSW / IVFFlat ANN 索引标准化, 之后 Supabase / Neon / Vercel Postgres / Aiven 全部 default 启用。RAG 应用不再需要拉个独立向量库 (Pinecone / Qdrant), embedding + 业务关系数据同库同事务。</p></> }, en: { title: <>pgvector turns PG into a RAG backbone</>, body: <><p>Since 2023, pgvector standardised HNSW / IVFFlat ANN indexing; Supabase / Neon / Vercel Postgres / Aiven all ship it by default. RAG apps no longer need a separate vector DB (Pinecone / Qdrant) — embeddings and relational data share one DB, one transaction.</p></> } },
    { tag: 'OPS', zh: { title: <>逻辑复制 + incremental backup</>, body: <><p>PG 16 之后 logical replication 支持从 standby 起、双向流, 跨主版本升级方案越来越成熟。PG 17 加的 incremental backup 把全量 + 增量 pg_basebackup 工作流补齐, 大型 PG 集群 (几 TB+) 备份成本掉一个数量级。</p></> }, en: { title: <>Logical replication + incremental backup</>, body: <><p>Logical replication since PG 16 supports starting from a standby and bidirectional flow; cross-major-version upgrade plans are now solid. PG 17's incremental backup completes the full + incremental pg_basebackup workflow, cutting backup cost for multi-TB clusters by an order of magnitude.</p></> } },
    { tag: 'DATA', zh: { title: <>市场份额仍在涨</>, body: <><p>Stack Overflow 2025 调查里 PG 第三年蝉联 "most admired + most desired" 双榜首。DB-Engines ranking 中 PG 与 MySQL 的差距继续缩小, 在新项目 (greenfield) 段 PG 已经反超。</p></> }, en: { title: <>Market share still growing</>, body: <><p>Stack Overflow's 2025 survey ranked PG #1 on both "most admired" and "most desired" for the third year running. On DB-Engines, PG's gap with MySQL keeps shrinking, and on greenfield projects PG is already ahead.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 后端跑一个 PG 13 实例, 监听本地 :5432 + Unix socket。Hono 端用 Unix socket 连接 (省一跳网络栈, 单条 query 延迟 &lt; 1ms)。2026-05-06 从 MariaDB 整体迁过来, 同时把 41 套公式从 JSON 文件搬进 <code>alg_sets</code> / <code>alg_cases</code> 两张表 — 公式数据从此 schema-validated, 不再是手动维护的 JSON。</p>
        <p>四组负载共享一个实例:<code>recon_*</code> 表存 SameRound 缓存 (jsonb 列存原始 cubing.com response, GIN 索引按 round_id 命中);<code>alg_sets</code> / <code>alg_cases</code> 是 41 套公式库 (admin 通过 X-Admin-Key 改);<code>training_*</code> 存训练记录 + 设置;<code>wca_stats_extra</code> + <code>historical_ranks</code> 等 stats-build 周更的衍生表 (CI build → scp tsv → \copy load.sql)。</p>
        <p>没上 PG 17 / 18 是有意的:现 schema 全部用 PG 13 之前已稳的特性 (jsonb / GIN / 部分索引 / CTE / 事务性 DDL), 没用 17 的 JSON_TABLE 也没用 18 的 async I/O。升级 4 个 major 需要 stop downtime + dump/restore (或 pg_upgrade), 回报极有限, 不值得。PG 13 是 2025-11 EOL 后第一年 — 真出 CVE 再考虑跳一档。</p>
        <p>备份走 systemd timer: <code>pg-dump-recon.timer</code> 每天 03:00 UTC 触发 <code>pg-dump-recon.service</code>, 跑 <code>pg_dump -Fc cuberoot_db -f /root/archive/&lt;date&gt;.dump</code>, 滚动保留 30 天。脚本 <code>/root/bin/pg_dump_recon.sh</code> 详见下一卡 (pg_dump)。</p>
      </>
    ),
    en: (
      <>
        <p>The backend runs a single PG 13 instance on the cloud VM, listening on :5432 and a Unix socket. Hono connects over the Unix socket — one fewer network hop, sub-millisecond per-query overhead. The migration from MariaDB landed 2026-05-06; the same migration moved the 41 alg sets from JSON files into the <code>alg_sets</code> / <code>alg_cases</code> tables — alg data is finally schema-validated rather than hand-maintained JSON.</p>
        <p>Four workloads share the instance: <code>recon_*</code> caches the SameRound layer (jsonb column for raw cubing.com responses, GIN index keyed by round_id); <code>alg_sets</code> / <code>alg_cases</code> is the 41-set alg library (admins write via X-Admin-Key); <code>training_*</code> stores training runs + settings; <code>wca_stats_extra</code>, <code>historical_ranks</code>, and similar derivatives come from the weekly stats-build pipeline (CI build → scp tsv → \copy via load.sql).</p>
        <p>Staying on PG 13 is deliberate. The schema only uses features stable since 13 (jsonb / GIN / partial indexes / CTE / transactional DDL); nothing touches 17's JSON_TABLE or 18's async I/O. Skipping four majors needs a stop-the-world dump/restore (or pg_upgrade) — the payoff doesn't justify the downtime. PG 13 reached EOL in 2025-11, so a future CVE would force the issue, but until then 13 is fine.</p>
        <p>Backups go through systemd timers. <code>pg-dump-recon.timer</code> fires daily at 03:00 UTC and triggers <code>pg-dump-recon.service</code>, which runs <code>pg_dump -Fc cuberoot_db -f /root/archive/&lt;date&gt;.dump</code> on a 30-day rolling window. The script lives at <code>/root/bin/pg_dump_recon.sh</code> — see the pg_dump card next door.</p>
      </>
    ),
  },
  links: [
    { label: 'postgresql.org', href: 'https://www.postgresql.org' },
    { label: 'PG 13 release notes', href: 'https://www.postgresql.org/docs/release/13.0/' },
    { label: 'PG 18 announcement', href: 'https://www.postgresql.org/about/news/postgresql-18-released-3142/' },
    { label: 'Versioning policy', href: 'https://www.postgresql.org/support/versioning/' },
  ],
};

export default POSTGRES;
