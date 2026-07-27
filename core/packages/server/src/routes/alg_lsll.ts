/**
 * /v1/alg/lsll — LSLL(最后一槽 + 顶层)case 的整方 HTM 最优解。
 *   - GET /v1/alg/lsll/case/:key   — 单 case;未回填返 { status: 'pending' }
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
    // 还没回填(管道在跑 / 不在这一轮的 148,384 个里)。**别缓存** —— 跑完就该立刻能看到。
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
