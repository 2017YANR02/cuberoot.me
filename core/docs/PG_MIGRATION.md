# MariaDB → PostgreSQL 迁移 Plan

> **状态**: Draft, 等用户审阅
> **拟订时间**: 2026-05-06
> **目标**: 把生产 `recon_db` (MariaDB on cuberoot) 全量迁到 PostgreSQL,server 代码切到 PG driver,所有 11 张表无数据丢失上线

---

## 0. 背景 & 决策

### 为什么迁
- 之前为了上 `alg_submissions` 功能(已写完未部署)讨论过引入 PG。最终决定:**不引入第二种 DB**,把 `recon_db` 一次性 all-in PG。
- WCA 上游 dump 仍是 MySQL,跟本机迁移**无关**(那是只读分析用的 `wca_statistics`,在另一台进程上,不动)。

### 当前 server 代码涉及的 11 张表
(完整列表 + 字段见 [§ 2 Schema 翻译](#2-schema-翻译);行数 / 大小为 2026-05-06 实测)

| 表 | 用途 | 行数 | 数据 MB |
|---|---|---:|---:|
| `recons` | 还原数据主表(45+ 列,含 `alternatives` JSONB) | 2064 | 4.45 |
| `edit_history` | recon 字段编辑审计 | 97 | 0.06 |
| `wca_users` | OAuth token 缓存 | 58 | 0.02 |
| `wca_results_cache` | WCA 整轮成绩缓存(大 JSON payload) | 21 | 4.52 |
| `wca_scrambles_cache` | WCA 打乱缓存 | 18 | 1.52 |
| `edits` | recon 字段编辑当前快照 | 13 | 0.02 |
| `comments` | recon 评论 + pinned + parent | 5 | 0.02 |
| `cubing_attempts_cache` | cubing.com attempts 缓存 | 1 | 0.02 |
| `timer_sessions` | /timer 会话 JSON 存档 | 1 | 0.02 |
| `train_results` | 训练计时 | 0 | — |
| **`alg_submissions`** | 用户提交公式(本次新建) | — | — |

**全库 ~10 MB / 2300 行** —— pgloader 几秒搬完,真正的停服时间瓶颈是 GitHub Actions deploy(3-5 min build + rsync + pm2 restart)。

### 关键决策(待用户确认)

| 选项 | 推荐 | 备选 |
|---|---|---|
| **PG driver** | `postgres@^3`(porsager,性能最强、零依赖、JSONB/数组自动类型转换、tagged template 原生防注入) | `pg@^8`(node-postgres,老牌生态广) |
| **JSON 列** | **JSONB**(PG 推荐,索引/查询好,`alternatives` 直接对象返回省 JSON.parse) | 普通 `json` |
| **占位符策略** | **改写 query() helper 自动 `?` → `$N`**(代码改动最少) | 全文替换 SQL string |
| **PG 部署位置** | 跟 MariaDB 同机(cuberoot,共存) | 另起服务器 |
| **数据迁移工具** | **`pgloader`**(自动类型映射,业内标准) | 手写 dump→sed→psql 脚本 |
| **`alg_submissions` 何时建** | 在 PG schema 文件首次 CREATE 时一起建,**不在 MariaDB 上建** | (已否决) |
| **回滚策略** | 保留 MariaDB N 天(只读),代码部署回滚=回退 commit + 改 `.env` 切回 | 双轨(成本太高,不做) |

---

## 1. 工作量估计

| Phase | 内容 | 估时 |
|---|---|---|
| 0 | 选 driver + 本地装 PG + 创建空 `recon_db` | 0.5h |
| 1 | Schema 翻译(11 张表)+ 在本地 PG 跑一次 | 1.5h |
| 2 | 数据迁移脚本(pgloader 配置 + 试跑 + 校验)| 1.5h |
| 3 | server 代码改造(connection / placeholder / SQL 方言 13 处) | 3-4h |
| 4 | 本地测试(curl 所有 /api/recon/* + 跑 client 全流程) | 2h |
| 5 | 云服务器 cutover(装 PG + 迁数据 + 切 `.env` + 部署) | 1-2h |
| 6 | 观察期(MariaDB 留 read-only 备份 7-14 天) | 被动 |

**总计**: ~10-12h 主动工作,大概 1.5 个 dev day。

---

## 2. Schema 翻译

完整 PG schema 文件(待生成)将放在 `core/packages/server/src/db/schema.pg.sql`。下面给出所有 MariaDB → PG 的关键替换规则,然后逐表列出新 schema。

### MariaDB → PG 字段类型映射

| MariaDB | PostgreSQL | 备注 |
|---|---|---|
| `BIGINT AUTO_INCREMENT PRIMARY KEY` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | PG 14+ 推荐写法 |
| `TINYINT(1)` (boolean) | `BOOLEAN` | jsonToRow 里 `official ? 1 : 0` 改成传 boolean 即可 |
| `TINYINT` (-128~127 整数) | `SMALLINT` | PG 没有 1 字节整数;占用增 1 字节但少 |
| `INT UNSIGNED` | `INTEGER`(用 CHECK 加 ≥0 约束)或 `BIGINT` | PG 无 UNSIGNED |
| `VARCHAR(N)` | `VARCHAR(N)` | 一致 |
| `TEXT` | `TEXT` | 一致(PG TEXT 无大小限制,反而比 MariaDB 宽松) |
| `JSON` | `JSONB` | PG 推荐;查询/索引性能优于 `json` |
| `DECIMAL(8,3)` | `NUMERIC(8,3)` | 一致 |
| `DATE` | `DATE` | 一致 |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` | TZ 显式 |
| `TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP` | 用 trigger:`CREATE TRIGGER ... BEFORE UPDATE ... SET updated_at = NOW()` | PG 没有 ON UPDATE 内建语法 |
| `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` | `ENCODING 'UTF8' LC_COLLATE='C.UTF-8'` | 在 `CREATE DATABASE` 设 |
| `ENGINE=InnoDB` | (删除,PG 无引擎概念) | |

### 各表 PG schema (草稿,Phase 1 落地时再精细化)

```sql
-- 主表
CREATE TABLE recons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  official BOOLEAN NOT NULL DEFAULT FALSE,
  event VARCHAR(20),
  method VARCHAR(20),
  date DATE,
  comp VARCHAR(200),
  comp_wca_id VARCHAR(100),
  country VARCHAR(100),
  round VARCHAR(20),
  solve_num SMALLINT,
  person VARCHAR(100),
  person_id VARCHAR(20),
  person_country VARCHAR(10),
  reconer VARCHAR(100),
  reconer_id VARCHAR(20),
  value VARCHAR(20),
  raw_time NUMERIC(8,3),
  average NUMERIC(8,3),
  ao_type VARCHAR(50),
  regional_single_record VARCHAR(20),
  regional_average_record VARCHAR(20),
  regional_aoxr_record VARCHAR(20),
  stm INTEGER,
  tps NUMERIC(5,2),
  optimal_scramble TEXT,
  oll VARCHAR(100),
  pll VARCHAR(100),
  oll_short VARCHAR(50),
  pll_short VARCHAR(50),
  note TEXT,
  solution TEXT,
  wca_scramble TEXT,
  caption TEXT,
  cube VARCHAR(100),
  group_id VARCHAR(10),
  recon_date DATE,
  created_at INTEGER,         -- 现有用法是 unix epoch int,保留
  added_by VARCHAR(100),
  added_by_id VARCHAR(20),
  exec_time NUMERIC(8,3),
  memo_time NUMERIC(8,3),
  free_pair SMALLINT,
  y_rot SMALLINT,
  regrip SMALLINT,
  lockup SMALLINT,
  cross_type SMALLINT,
  cross_stm INTEGER,
  f2l INTEGER,
  ll INTEGER,
  s_move SMALLINT,
  cross_color CHAR(1),
  video_url TEXT,
  alternatives JSONB
);

CREATE TABLE comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recon_id BIGINT NOT NULL REFERENCES recons(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
  author_id VARCHAR(20) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_recon ON comments(recon_id);

CREATE TABLE edits (
  solve_id BIGINT PRIMARY KEY REFERENCES recons(id) ON DELETE CASCADE,
  fields JSONB NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE edit_history (
  id VARCHAR(40) PRIMARY KEY,    -- 现有是字符串(uuid 风格)
  solve_id BIGINT NOT NULL REFERENCES recons(id) ON DELETE CASCADE,
  before_snapshot JSONB,
  after_fields JSONB,
  edited_by VARCHAR(20),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wca_users (
  wca_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  access_token VARCHAR(500),
  refresh_token VARCHAR(500),
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cubing_attempts_cache (
  slug VARCHAR(100) NOT NULL,
  event VARCHAR(20) NOT NULL,
  round VARCHAR(20) NOT NULL,
  person_id VARCHAR(20) NOT NULL,
  attempts JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slug, event, round, person_id)
);

CREATE TABLE wca_results_cache (
  comp_id VARCHAR(100) NOT NULL,
  wca_event VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comp_id, wca_event)
);

CREATE TABLE wca_scrambles_cache (
  comp_id VARCHAR(100) PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE train_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  alg_set_id VARCHAR(50) NOT NULL,
  case_id VARCHAR(20) NOT NULL,
  time_ms INTEGER NOT NULL CHECK (time_ms >= 0),
  correct BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_train_user_set ON train_results(user_id, alg_set_id);
CREATE INDEX idx_train_user_case ON train_results(user_id, alg_set_id, case_id);

-- 新增(MariaDB 上从未建过)
CREATE TABLE alg_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  puzzle VARCHAR(20) NOT NULL,
  set_slug VARCHAR(100) NOT NULL,
  case_name VARCHAR(128) NOT NULL,
  alg TEXT NOT NULL,
  notes TEXT,
  author_id VARCHAR(20) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alg_set ON alg_submissions(puzzle, set_slug);

CREATE TABLE timer_sessions (
  wca_id VARCHAR(20) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  puzzle_id VARCHAR(50),
  solves JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wca_id, session_id)
);

-- ON UPDATE 触发器(对 wca_users / comments)
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wca_users_updated_at BEFORE UPDATE ON wca_users
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
```

> **Phase 1 输出**: 把上面整理成 `core/packages/server/src/db/schema.pg.sql`,本地 PG 跑通后 commit。

---

## 3. SQL 方言改写清单

按 Explore agent 调研结果,server 代码里需要改的 13 处:

| 文件:行号 | MariaDB 写法 | PG 写法 |
|---|---|---|
| recon_helpers.ts:329 (buildInsert) | `` `col` `` | `"col"` |
| recon_helpers.ts:343 (buildUpdate) | `` `col` = ? `` | `"col" = $N` |
| auth.ts:75,82,148 | `DATE_ADD(NOW(), INTERVAL ? SECOND)` | `NOW() + ($1 \|\| ' seconds')::interval` 或 `NOW() + make_interval(secs => $1)` |
| recon.ts:462,521,582 | `NOW() - INTERVAL ${N} DAY` | `NOW() - INTERVAL '${N} days'` |
| recon.ts:322 | `JSON_MERGE_PATCH(fields, VALUES(fields))` | `edits.fields \|\| EXCLUDED.fields` (jsonb 合并)或 `jsonb_strip_nulls(...)` |
| recon.ts:321,490,559,615,723 / auth.ts:73,147 | `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` | `INSERT ... ON CONFLICT (pk_cols) DO UPDATE SET col = EXCLUDED.col` |
| progress.ts:53 | `FROM_UNIXTIME(? / 1000)` | `to_timestamp($1::numeric / 1000.0)` |
| alg.ts:83 / recon.ts:202,782 | `result.insertId`(从 driver meta 读) | SQL 加 `RETURNING id`,然后从返回 rows[0].id 读 |
| connection.ts:25 | `Array.isArray(rows) ? [...rows] : rows`(剥 mariadb meta) | `pg` 直接返回 `result.rows` 数组 |

### 占位符 `?` → `$N` 的策略(driver = `postgres@^3`)

`postgres@^3` 主推 tagged template 写法:
```ts
const rows = await sql`SELECT * FROM recons WHERE id = ${id}`;
```
**但**重写 938 行 `recon.ts` 全部 SQL 等于多干一倍活,迁移阶段不做。本期采用 **`sql.unsafe(text, values)`**(仍走参数化,values 安全;只是 SQL 字符串是 plain string,跟当前用法 1:1 对应),并在 helper 内部转占位符:

```typescript
// 改造后 connection.ts (草稿)
import postgres from 'postgres';
const sql = postgres({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 10,
  idle_timeout: 60,
  transform: { undefined: null },  // 与 mariadb 行为对齐
});

function rewriteQ(s: string): string {
  let i = 0;
  return s.replace(/\?/g, () => `$${++i}`);
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  // sql.unsafe 接受 $1, $2 占位符,跟 pg 一样
  return await sql.unsafe(rewriteQ(text), params) as unknown as T[];
}

export const sqlTagged = sql;  // 以后想重写成 tagged template 时直接 export
```

这样 938 行 `recon.ts` 一行 SQL 都不用动,只改 `connection.ts` + `recon_helpers.ts` 反引号(13 处)。

> **风险**: SQL string 里若带字符串字面量 `'?'` 会被误替换。先 grep 一遍确认无字面量(快速肉眼审)。
>
> **后续优化**(非本期范围): `postgres@^3` 真正的优势在 tagged template + JSONB 自动类型转换。**`alternatives` JSONB 列读出来直接是 JS 对象/数组**,所以 `recon_helpers.ts:95` 那段 `JSON.parse` 兜底**这次迁移就直接删**。其它路由可以以后慢慢重写成 tagged template 风格。

### `result.insertId` 改造

3 处用法,统一加 `RETURNING id`:

```typescript
// 旧
const result = await query('INSERT INTO recons (...) VALUES (...)', [...]);
const id = (result as any).insertId;

// 新(query 已统一返回 rows)
const rows = await query<{ id: number }>('INSERT INTO recons (...) VALUES (...) RETURNING id', [...]);
const id = rows[0].id;
```

---

## 4. 数据迁移(pgloader)

`pgloader` 是 Common Lisp 工具,云服务器装一次即用。它会自动:
- MariaDB → PG 类型映射(包括 TINYINT(1) → BOOLEAN)
- 表结构迁移(若不预建 PG schema)
- 行级数据拷贝
- 处理字符集

**但**我们已经手写了 `schema.pg.sql`(理由:能控字段类型 + 顺手加 `alg_submissions` 等新表),所以让 pgloader **跳过 schema 创建**,只迁数据。

`migrate.load` 配置文件草稿:

```
LOAD DATABASE
  FROM mysql://recon_user:<password>@127.0.0.1:3306/recon_db
  INTO postgresql://recon_user:<password>@127.0.0.1:5432/recon_db

WITH include drop, create no tables, create no indexes,
     reset sequences, foreign keys, downcase identifiers,
     data only

ALTER SCHEMA 'recon_db' RENAME TO 'public'

SET work_mem to '128MB', maintenance_work_mem to '512MB'
;
```

跑法:
```bash
ssh root@cuberoot 'apt install -y pgloader && pgloader /root/migrate.load'
```

迁完用如下 sanity check:
```sql
-- 行数对账
SELECT 'recons' AS t, COUNT(*) FROM recons
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'edits', COUNT(*) FROM edits
-- ... 11 张表
;
```
拿这个数和 MariaDB 那边的数对比,**不一致就回退**。

---

## 5. Cutover 步骤(生产)

### 5.1 准备阶段(零停服,提前做)

1. 云服务器装 PG 16:`apt install postgresql-16 postgresql-contrib`
2. 创建 `recon_db` + `recon_user`(同名,密码同 MariaDB 那个,**写到 `.password.md`**)
3. 跑 `schema.pg.sql` 建空表
4. 跑 pgloader 试迁一次,记录行数,然后 `DROP DATABASE && CREATE DATABASE` 清掉(只是预热验证)

### 5.2 Cutover 窗口(预计 5-15 分钟停服)

用户:**选个低峰时段**(美东时间凌晨 / 中国白天?),执行:

```bash
# 1. 停 server,防止数据继续写入 MariaDB
ssh root@cuberoot 'pm2 stop core-api'

# 2. 第二次 pgloader,这次是真迁
ssh root@cuberoot 'pgloader /root/migrate.load'

# 3. 行数对账(本地 MariaDB / PG 双开终端)
ssh root@cuberoot 'mysql -u recon_user -p<pwd> recon_db -e "SELECT COUNT(*) FROM recons;"'
ssh root@cuberoot 'psql -U recon_user recon_db -c "SELECT COUNT(*) FROM recons;"'
# ...所有 11 张表

# 4. 改 .env(DB_HOST 同机,DB_PORT 5432,DB_USER/PASS/NAME 同名)
ssh root@cuberoot 'nano /root/core-api/.env'

# 5. push 切换到 PG driver 的 server 代码 → GitHub Actions 自动 build + rsync + pm2 restart
git push origin main
gh workflow run deploy_core.yml  # 如果 path filter 没触发

# 6. 验证(本地浏览器)
curl https://www.cuberoot.me/api/recon/list   # 应 200,带数据
curl https://www.cuberoot.me/api/health       # 应 200
```

### 5.3 观察期(1-2 周)+ MariaDB 下架

**观察期**(1-2 周):
- MariaDB 服务**保留**但不再写入(server `.env` 已切走)
- 每天扫一遍 `pm2 logs core-api` 是否有 PG 错误
- 任何 PG 上发现的 SQL 兼容 bug → 修代码 + push,**不**回滚到 MariaDB(那样会丢观察期内 PG 上的新数据)

**确认稳定后下架 MariaDB**(三步,顺序不能反):

```bash
# 1. dump 完整备份(留 6 个月作冷归档)
ssh root@cuberoot 'mysqldump -u recon_user -p"<密码>" --single-transaction --routines recon_db > /root/backups/recon_db_final_2026MMDD.sql && gzip /root/backups/recon_db_final_2026MMDD.sql'

# 2. 卸载 mariadb (释放 ~200MB + 不再听 3306)
ssh root@cuberoot 'systemctl stop mariadb && systemctl disable mariadb && apt purge -y mariadb-server mariadb-client mariadb-common && apt autoremove -y'

# 3. 把数据目录也清掉(默认在 /var/lib/mysql,可能有几百 MB)
ssh root@cuberoot 'rm -rf /var/lib/mysql /etc/mysql'
```

`/root/backups/recon_db_final_*.sql.gz` 留半年再删。期间如果想看老数据可以 `gunzip -c | head` 之类的临时翻一下。

---

## 6. 回滚预案

如果 cutover 后线上有 PG 不兼容的 SQL bug 没在测试发现:

```bash
# 1. 本地 git revert 切 driver 的那次 commit(或一系列 commits)
git revert <pg-driver-commit-sha>
git push

# 2. 改回 .env DB_PORT=3306 等
ssh root@cuberoot 'nano /root/core-api/.env'

# 3. workflow 自动重新部署旧版 server,接回 MariaDB
```

**条件**: MariaDB 还在跑、stop server 期间没有用户写入(否则 PG 那边有新数据,MariaDB 没有,回滚=丢数据)。

如果停服窗口很短(<5 分钟),回滚是安全的;如果停服后有用户写入再发现 bug,**只能往前修**,不能回滚。

---

## 7. Phase 工作分解(供执行参考)

每个 Phase 结尾我会暂停等用户审。

- [ ] **Phase 0** — 用户确认 driver 选 `pg`、JSON 用 JSONB、占位符走 helper rewrite
- [ ] **Phase 1** — 写 `schema.pg.sql`,本地装 PG + 起空 `recon_db`,跑 schema 通过
- [ ] **Phase 2** — 写 `migrate.load`,本地从 MariaDB(模拟)迁数据到本地 PG,行数对账通过
- [ ] **Phase 3** — 改 `connection.ts` + `recon_helpers.ts` + 13 处 SQL 方言。typecheck + 全 API 跑通
- [ ] **Phase 4** — playwright/curl 验证 client 主路径(/recon, /recon/submit, /alg, /timer)
- [ ] **Phase 5** — 云服务器 cutover(用户挑窗口)
- [ ] **Phase 6** — 7-14 天观察 + MariaDB 下架

---

## 8. 待确认问题(用户决策)

1. ~~**driver**~~: **`postgres@^3`**(已选定 2026-05-06)
2. ~~**JSON 列**~~: **JSONB**(已选定)
3. ~~**占位符**~~: **`sql.unsafe()` + helper rewrite**(已选定)
4. ~~**PG 部署位置**~~: **同机(cuberoot)**(已选定)
5. ~~**数据量级**~~: **全库 ~10 MB / 2300 行**(2026-05-06 实测,见 § 0)
6. **cutover 时段**: 用户挑(任意 5-15 分钟低活跃窗口)
7. ~~**alg_submissions 一起上线**~~: **是**(已选定)

只剩 6 待确认。
