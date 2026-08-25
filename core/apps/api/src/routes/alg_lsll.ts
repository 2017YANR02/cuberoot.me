/**
 * /v1/alg/lsll — LSLL(最后一槽 + 顶层)case 的整方 HTM 最优解。
 *   - GET /v1/alg/lsll/case/:key   — 单 case;未回填返 { status: 'pending' }
 *   - GET /v1/alg/lsll/htm?keys=   — 一批 case 只要步数(训练器挑 mid-AUF 用,见下)
 *   - GET /v1/alg/lsll/dist        — HTM 步数直方图 + 覆盖数(大类页 / case 页顶栏用)
 *
 * 数据来自本地管道 `solver/lsll`(cubeopt/h48 求解 → export_cases.mjs → update_lsll.ps1 增量灌),
 * 表 schema 见 migrations/0094_lsll_cases.sql。**只读**,没有写端点:公式库那套 admin 通道
 * 管的是人类公式(alg_cases),这张表是机器算出来的,重灌即真源。
 *
 * `exhaustive=false` 意味着只拿到**一条**最优解 —— `htm` 是确定的最优步数,但 `qtm` 只是这一条的,
 * 未必是所有最优解里最小的。原样透出去,由前端如实说明,别在这里粉饰。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';

export const algLsllRoutes = new Hono();

/** canonical key 的 base36 串(40bit ⇒ ≤ 8 字符);挡住乱七八糟的参数,别拿去查库。 */
const KEY_RE = /^[0-9a-z]{1,12}$/;

interface CaseRow {
  canonical_key: string;
  htm: number;
  qtm: number;
  exhaustive: boolean;
  optimal_algs: string[];
}

algLsllRoutes.get('/alg/lsll/case/:key', async (c) => {
  const key = c.req.param('key');
  if (!KEY_RE.test(key)) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.json({ error: 'bad key' }, 400);
  }
  const rows = await query<CaseRow>(
    'SELECT canonical_key, htm, qtm, exhaustive, optimal_algs FROM lsll_cases WHERE canonical_key = $1',
    [key],
  );
  const r = rows[0];
  if (!r) {
    // 还没回填(管道在跑;两批语料合起来覆盖全部 583,284 个)。**别缓存** —— 跑完就该立刻能看到。
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.json({ key, status: 'pending' });
  }
  // 确定性计算的结果,但会被阶段 2(并列全留)重灌 ⇒ 浏览器短、共享层长。
  c.header('Cache-Control', 'public, max-age=300, s-maxage=86400');
  return c.json({
    key: r.canonical_key,
    status: 'ok',
    htm: r.htm,
    qtm: r.qtm,
    exhaustive: r.exhaustive,
    algs: r.optimal_algs,
  });
});

/**
 * 一批 case 的 HTM,**只要步数不要解**。
 *
 * 训练器的两步路线要在一条路线的 ≤4 个 mid-AUF 变体里挑最短的那个 case(`lib/lsll/trainer-set`),
 * 一轮 302 条路线 ⇒ 最多 1,208 个 key。逐个打 `/case/:key` 是 1,208 个往返、还把用不上的
 * 那 3/4 条解一起拖下来 —— 所以单开这个口子:只回 `{ key: htm }`,客户端按 256 个一批切。
 *
 * 没回填到的 key **直接不出现在结果里**(不是 0、不是 null),调用方自己决定怎么退。
 */
const HTM_MAX_KEYS = 256;

algLsllRoutes.get('/alg/lsll/htm', async (c) => {
  const keys = (c.req.query('keys') ?? '').split(',').filter(Boolean);
  if (!keys.length || keys.length > HTM_MAX_KEYS || keys.some((k) => !KEY_RE.test(k))) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.json({ error: 'bad keys' }, 400);
  }
  const rows = await query<{ canonical_key: string; htm: number }>(
    // `::text[]` 不能省:sql.unsafe 不带类型提示,PG 推不出 $1 的元素类型会直接报错(同 cubing_live 那处)
    'SELECT canonical_key, htm FROM lsll_cases WHERE canonical_key = ANY($1::text[])',
    [[...new Set(keys)]],
  );
  const htm: Record<string, number> = {};
  for (const r of rows) htm[r.canonical_key] = r.htm;
  // 全查到 = 确定性结果,可长缓存;缺了谁说明管道还没跑到那儿,别把暂态钉进缓存。
  // 三元写一行:`tests/server-cache-headers.test.ts` 只扫含 Cache-Control 的那一行,拆行它就看不见 max-age。
  const complete = rows.length === new Set(keys).size;
  c.header('Cache-Control', complete ? 'public, max-age=300, s-maxage=86400' : 'no-cache, no-store, must-revalidate');
  return c.json({ htm });
});

algLsllRoutes.get('/alg/lsll/dist', async (c) => {
  const rows = await query<{ htm: number; n: string }>(
    'SELECT htm, count(*)::text AS n FROM lsll_cases GROUP BY htm ORDER BY htm',
  );
  if (!rows.length) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.json({ total: 0, counts: {} });
  }
  const counts: Record<number, number> = {};
  let total = 0;
  for (const r of rows) { counts[r.htm] = Number(r.n); total += Number(r.n); }
  c.header('Cache-Control', 'public, max-age=300, s-maxage=86400');
  return c.json({ total, counts });
});
