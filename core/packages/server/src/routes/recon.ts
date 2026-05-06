/**
 * Recon 核心 CRUD 路由（阶段 1-4）
 * 端点：list, get, add, update, delete, checkDuplicate, searchSolvers,
 *       comments CRUD, edits, history, wca-attempts, bili-cover, user-stats,
 *       list-persons, timer-sync
 * NOTE: 迁移自 PHP recon/api/index.php → Hono
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import {
  rowToJson, jsonToRow, validateRow,
  requireAuth, requireAdmin, checkRateLimit,
  buildInsert, buildUpdate, ADMIN_WCA_IDS,
} from '../utils/recon_helpers.js';
import { fetchCubingAttempts } from '../utils/cubing_proxy.js';

export const reconRoutes = new Hono();

/** 从 Hono Context 提取客户端 IP（Nginx 反代场景用 X-Real-IP） */
function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

// ==================== GET /api/recon/list ====================

// NOTE: 列表页只用以下字段（含搜索匹配 optimal_scramble/oll/pll/note）。
//       之前 SELECT * 把 solution（最大的字段，每条几百字节）等全拉过来，
//       响应 ~800 KB / 590 KB gzip，国内用户加载 10–30s。
//       瘦身后预计减半以上。详情页仍走 GET /api/recon/:id 拿全字段。
const LIST_COLUMNS = [
  'id', 'official', 'event', 'method', 'date',
  'comp', 'comp_wca_id', 'country',
  'round', 'solve_num',
  'person', 'person_id', 'person_country',
  'reconer', 'reconer_id',
  'value', 'raw_time', 'average', 'ao_type',
  'regional_single_record', 'regional_average_record', 'regional_aoxr_record',
  'stm', 'tps',
  'optimal_scramble', 'oll', 'pll', 'note',
].join(', ');

reconRoutes.get('/api/recon/list', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  const wcaId = c.req.query('wcaId');

  let rows: Record<string, unknown>[];
  if (wcaId) {
    rows = await query(`SELECT ${LIST_COLUMNS} FROM recons WHERE person_id = ? ORDER BY id DESC`, [wcaId]);
  } else {
    rows = await query(`SELECT ${LIST_COLUMNS} FROM recons ORDER BY id DESC`);
  }

  return c.json(rows.map(rowToJson));
});

// ==================== GET /api/recon/check-duplicate ====================
// NOTE: 放在 /:id 之前，否则 'check-duplicate' 会被当作 :id 参数

reconRoutes.get('/api/recon/check-duplicate', async (c) => {
  const comp = c.req.query('comp');
  const event = c.req.query('event');
  const personId = c.req.query('personId');
  const person = c.req.query('person');
  const round = c.req.query('round');
  const solveNum = c.req.query('solveNum');
  const excludeId = c.req.query('excludeId');

  if (!comp || !event || !round || !solveNum || (!personId && !person)) {
    return c.json({ exists: false });
  }

  let sql: string;
  const params: unknown[] = [];

  // NOTE: 优先用 person_id（WCA ID）匹配
  if (personId) {
    sql = 'SELECT id FROM recons WHERE comp = ? AND event = ? AND person_id = ? AND "round" = ? AND solve_num = ?';
    params.push(comp, event, personId, round, Number(solveNum));
  } else {
    sql = 'SELECT id FROM recons WHERE comp = ? AND event = ? AND person = ? AND "round" = ? AND solve_num = ?';
    params.push(comp, event, person, round, Number(solveNum));
  }

  // NOTE: 编辑模式排除自身
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(Number(excludeId));
  }

  sql += ' LIMIT 1';
  const rows = await query<{ id: number }>(sql, params);

  if (rows.length > 0) {
    return c.json({ exists: true, id: Number(rows[0].id) });
  }
  return c.json({ exists: false });
});

// ==================== GET /api/recon/search-solvers ====================

reconRoutes.get('/api/recon/search-solvers', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (q.length < 2) return c.json([]);

  // NOTE: 代理 WCA 搜索 API（前端无法直接跨域调用）
  try {
    const wcaUrl = `https://www.worldcubeassociation.org/api/v0/search/users?q=${encodeURIComponent(q)}&persons_table=true`;
    const res = await fetch(wcaUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return c.json({ error: 'WCA API unavailable' }, 502);
    }

    const data = await res.json() as { result: Array<{ name: string; country_iso2: string; wca_id: string }> };
    const results = (data.result ?? []).map(p => ({
      name: p.name ?? '',
      iso2: (p.country_iso2 ?? '').toLowerCase(),
      wcaId: p.wca_id ?? '',
    }));

    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(results);
  } catch {
    return c.json({ error: 'WCA API unavailable' }, 502);
  }
});

// NOTE: /:id 动态路由移到文件末尾——防止具名路由（/comments, /edits 等）被 :id 捕获
// （Hono LinearRouter 按注册顺序匹配，动态参数路由必须后于所有具名路由）

// ==================== 阶段 2：评论系统 ==

// GET /api/recon/comments?reconId=xxx
reconRoutes.get('/api/recon/comments', async (c) => {
  const reconId = c.req.query('reconId');
  if (!reconId) {
    return c.json({ error: 'reconId is required' }, 400);
  }
  const rows = await query<{
    id: number; recon_id: number; author_id: string; author_name: string;
    content: string; created_at: number; updated_at: number | null; pinned: number;
    parent_id: number | null;
  }>(
    `SELECT id, recon_id, author_id, author_name, content, created_at, updated_at, pinned, parent_id
     FROM comments WHERE recon_id = ? ORDER BY pinned DESC, created_at ASC`, [reconId]
  );
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.json(rows.map(r => ({
    id: Number(r.id),
    reconId: Number(r.recon_id),
    authorId: r.author_id,
    authorName: r.author_name,
    content: r.content,
    createdAt: Number(r.created_at),
    updatedAt: r.updated_at ? Number(r.updated_at) : null,
    pinned: !!r.pinned,
    parentId: r.parent_id != null ? Number(r.parent_id) : null,
  })));
});

// POST /api/recon/comments
reconRoutes.post('/api/recon/comments', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<{ reconId?: number; content?: string; parentId?: number | null }>();

  if (!body.reconId) {
    return c.json({ error: 'reconId is required' }, 400);
  }
  const content = (body.content ?? '').trim();
  if (!content) {
    return c.json({ error: 'content is required' }, 400);
  }
  if (content.length > 2000) {
    return c.json({ error: 'content exceeds 2000 characters' }, 400);
  }

  // NOTE: 回复模式 — 校验 parent 存在、属同 recon、且本身是顶层(单层嵌套,YouTube 风格)
  let parentId: number | null = null;
  if (body.parentId != null) {
    const parent = await query<{ recon_id: number; parent_id: number | null }>(
      'SELECT recon_id, parent_id FROM comments WHERE id = ?', [body.parentId]
    );
    if (parent.length === 0) {
      return c.json({ error: 'Parent comment not found' }, 400);
    }
    if (Number(parent[0].recon_id) !== Number(body.reconId)) {
      return c.json({ error: 'Parent comment does not belong to this recon' }, 400);
    }
    if (parent[0].parent_id != null) {
      return c.json({ error: 'Cannot reply to a reply (single-level threading)' }, 400);
    }
    parentId = Number(body.parentId);
  }

  const result = await query<{ id: number }>(
    `INSERT INTO comments (recon_id, author_id, author_name, content, created_at, parent_id)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [body.reconId, authUser.wcaId, authUser.name, content, Math.floor(Date.now() / 1000), parentId]
  );
  return c.json({ ok: true, id: Number(result[0].id) });
});

// PUT /api/recon/comments/:id
reconRoutes.put('/api/recon/comments/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ content?: string }>();
  const content = (body.content ?? '').trim();

  if (!content) {
    return c.json({ error: 'content is required' }, 400);
  }
  if (content.length > 2000) {
    return c.json({ error: 'content exceeds 2000 characters' }, 400);
  }

  // NOTE: 权限检查——本人或管理员
  const target = await query<{ author_id: string }>('SELECT author_id FROM comments WHERE id = ?', [id]);
  if (target.length === 0) {
    return c.json({ error: 'Comment not found' }, 404);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && target[0].author_id !== authUser.wcaId) {
    return c.json({ error: 'Cannot edit others comment' }, 403);
  }

  await query('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?',
    [content, Math.floor(Date.now() / 1000), id]);
  return c.json({ ok: true });
});

// DELETE /api/recon/comments/:id —— 删顶层评论时级联删所有回复
reconRoutes.delete('/api/recon/comments/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');

  const target = await query<{ author_id: string }>('SELECT author_id FROM comments WHERE id = ?', [id]);
  if (target.length === 0) {
    return c.json({ error: 'Comment not found' }, 404);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && target[0].author_id !== authUser.wcaId) {
    return c.json({ error: 'Cannot delete others comment' }, 403);
  }

  // 删自身 + 所有以此评论为 parent 的回复
  await query('DELETE FROM comments WHERE id = ? OR parent_id = ?', [id, id]);
  return c.json({ ok: true });
});

// PUT /api/recon/comments/:id/pin —— 管理员置顶 / 取消置顶（每条 recon 只允许一条置顶）
reconRoutes.put('/api/recon/comments/:id/pin', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId)) {
    return c.json({ error: 'Admin only' }, 403);
  }
  const id = c.req.param('id');
  const body = await c.req.json<{ pinned?: boolean }>();
  const pin = !!body.pinned;

  const target = await query<{ recon_id: number }>('SELECT recon_id FROM comments WHERE id = ?', [id]);
  if (target.length === 0) {
    return c.json({ error: 'Comment not found' }, 404);
  }

  if (pin) {
    // NOTE: 同一 recon 同时只允许一条置顶——先取消其他置顶
    await query(
      'UPDATE comments SET pinned = 0 WHERE recon_id = ? AND pinned = 1 AND id != ?',
      [target[0].recon_id, id]
    );
  }
  await query('UPDATE comments SET pinned = ? WHERE id = ?', [pin ? 1 : 0, id]);
  return c.json({ ok: true });
});

// ==================== 阶段 3：编辑覆盖 + 历史 ====================

// GET /api/recon/edits
reconRoutes.get('/api/recon/edits', async (c) => {
  const rows = await query<{ solve_id: string; fields: Record<string, unknown> | string }>(
    'SELECT solve_id, fields FROM edits'
  );
  // NOTE: 返回 {solveId: fields} 的 map (空时返回 {} 而非 []);PG JSONB 列由 driver 直接反序列化
  const edits: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      edits[row.solve_id] = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
    } catch {
      // NOTE: fields 损坏时跳过该条，不阻塞整个请求
      console.warn(`edits parse failed for solve_id=${row.solve_id}`);
    }
  }
  return c.json(edits);
});

// POST /api/recon/save-edit
reconRoutes.post('/api/recon/save-edit', async (c) => {
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  const body = await c.req.json<{ solveId?: string; fields?: Record<string, unknown> }>();
  const { solveId, fields } = body;

  if (!solveId) {
    return c.json({ error: 'solveId is required' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const enriched = { ...fields, _editedAt: now };
  const fieldsJson = JSON.stringify(enriched);

  // 字段级合并:PG jsonb || 是浅合并,右覆盖左(等价 MariaDB JSON_MERGE_PATCH 的扁平场景)
  await query(
    `INSERT INTO edits (solve_id, fields, edited_at) VALUES (?, ?::jsonb, ?)
     ON CONFLICT (solve_id) DO UPDATE SET
       fields = edits.fields || EXCLUDED.fields,
       edited_at = EXCLUDED.edited_at`,
    [solveId, fieldsJson, now]
  );

  // NOTE: 同步更新 recons 主表——只写非内部字段
  if (fields) {
    const publicFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!k.startsWith('_')) publicFields[k] = v;
    }
    if (Object.keys(publicFields).length > 0) {
      const row = jsonToRow(publicFields);
      if (Object.keys(row).length > 0) {
        const { sql, values } = buildUpdate('recons', row, 'id', solveId);
        await query(sql, values);
      }
    }
  }

  return c.json({ ok: true });
});

// DELETE /api/recon/edit/:id
reconRoutes.delete('/api/recon/edit/:id', async (c) => {
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  await query('DELETE FROM edits WHERE solve_id = ?', [c.req.param('id')]);
  return c.json({ ok: true });
});

// POST /api/recon/save-history
reconRoutes.post('/api/recon/save-history', async (c) => {
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  const body = await c.req.json<{
    solveId?: string; before?: unknown; after?: unknown; editedBy?: string;
  }>();
  const now = Math.floor(Date.now() / 1000);
  // NOTE: 用时间戳+随机后缀生成唯一 ID
  const id = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  await query(
    `INSERT INTO edit_history (id, solve_id, before_snapshot, after_fields, edited_by, edited_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, body.solveId ?? '', body.before ? JSON.stringify(body.before) : null,
     body.after ? JSON.stringify(body.after) : null, body.editedBy ?? '', now]
  );
  return c.json({ ok: true });
});

// GET /api/recon/history?id=xxx
reconRoutes.get('/api/recon/history', async (c) => {
  const solveId = c.req.query('id') ?? '';
  const rows = await query<{
    id: string; solve_id: string; before_snapshot: string | null;
    after_fields: string | null; edited_by: string; edited_at: number;
  }>(
    'SELECT * FROM edit_history WHERE solve_id = ? ORDER BY edited_at DESC LIMIT 20',
    [solveId]
  );
  return c.json(rows.map(r => {
    let before = null;
    let after = null;
    try { before = r.before_snapshot ? JSON.parse(r.before_snapshot) : null; } catch { /* skip */ }
    try { after = r.after_fields ? JSON.parse(r.after_fields) : null; } catch { /* skip */ }
    return {
      id: r.id,
      solveId: r.solve_id,
      before,
      after,
      editedBy: r.edited_by,
      editedAt: Number(r.edited_at),
    };
  }));
});

// ==================== 阶段 4：代理 + 统计 + Timer ====================

// GET /api/recon/wca-attempts?compId=xxx&personId=xxx
reconRoutes.get('/api/recon/wca-attempts', async (c) => {
  const compId = c.req.query('compId');
  const personId = c.req.query('personId');
  if (!compId || !personId) {
    return c.json({ error: 'compId and personId are required' }, 400);
  }

  try {
    const wcaUrl = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/results`;
    const res = await fetch(wcaUrl, {
      headers: { 'User-Agent': 'CubeRoot-Recon/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return c.json({ error: 'WCA API unavailable' }, 502);
    }

    const rawResults = await res.json() as Array<{
      wca_id: string; event_id: string; round_type_id: string; attempts: number[];
    }>;

    // NOTE: 按 wca_id 分组，与 PHP 静态文件格式对齐
    const compResults: Record<string, Record<string, { a: number[] }>> = {};
    for (const entry of rawResults) {
      if (!entry.wca_id || !entry.event_id || !entry.round_type_id || !entry.attempts?.length) continue;
      const key = `${entry.event_id}_${entry.round_type_id}`;
      if (!compResults[entry.wca_id]) compResults[entry.wca_id] = {};
      compResults[entry.wca_id][key] = { a: entry.attempts };
    }

    const personData = compResults[personId] ?? {};
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(personData);
  } catch {
    return c.json({ error: 'WCA API unavailable' }, 502);
  }
});

// GET /api/recon/cubing-attempts?slug=&event=&round=&personId= — 代理 cubing.com 实时直播成绩
// NOTE: 经验观察:cubing.com 数据要么全空要么全填,极少卡在中间态。所以
//   "attempts 全部非 null" 即可作为"该选手该轮已完赛"的判据,可安全长 TTL 缓存到 DB,
//   让第二位用户/设备在 WCA post 之前秒加载。
const CUBING_CACHE_TTL_DAYS = 7;

reconRoutes.get('/api/recon/cubing-attempts', async (c) => {
  const slug = c.req.query('slug') ?? '';
  const event = c.req.query('event') ?? '';
  const round = c.req.query('round') ?? '';
  const personId = c.req.query('personId') ?? '';
  if (!slug || !event || !round || !personId) {
    return c.json({ error: 'slug/event/round/personId required' }, 400);
  }
  if (!/^[A-Za-z0-9-]+$/.test(slug) || !/^[A-Za-z0-9]+$/.test(event) || !/^[A-Za-z0-9]+$/.test(round) || !/^[0-9]{4}[A-Z]{4}\d{2}$/.test(personId)) {
    return c.json({ error: 'invalid param format' }, 400);
  }

  // 1. 查缓存
  try {
    const rows = await query<{ attempts: string }>(
      `SELECT attempts FROM cubing_attempts_cache
        WHERE slug = ? AND event = ? AND round = ? AND person_id = ?
          AND fetched_at > NOW() - INTERVAL '${CUBING_CACHE_TTL_DAYS} days'`,
      [slug, event, round, personId],
    );
    if (rows[0]?.attempts) {
      c.header('Cache-Control', 'public, max-age=86400');
      c.header('X-Cache', 'HIT');
      return c.json({ attempts: JSON.parse(rows[0].attempts) });
    }
  } catch (err) {
    console.error('[cubing-attempts] cache read failed:', err);
  }

  // 2. miss → fetchCubingAttempts(内含 5min 内存缓存 + WS 拉取)
  let attempts: (number | null)[] | null;
  try {
    attempts = await fetchCubingAttempts(slug, event, round, personId);
  } catch (err) {
    console.error('[cubing-attempts] fetch failed:', err);
    return c.json({ error: 'cubing.com unreachable', detail: String((err as Error)?.message ?? err) }, 502);
  }

  // 3. 仅当"完赛"(数组非空且全部非 null)写库;部分填 / 全空保持短 TTL
  const isComplete = Array.isArray(attempts) && attempts.length >= 1 && attempts.every(v => v != null);
  if (isComplete) {
    try {
      await query(
        `INSERT INTO cubing_attempts_cache (slug, event, round, person_id, attempts)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (slug, event, round, person_id) DO UPDATE SET
           attempts = EXCLUDED.attempts,
           fetched_at = NOW()`,
        [slug, event, round, personId, JSON.stringify(attempts)],
      );
    } catch (err) {
      console.error('[cubing-attempts] cache write failed:', err);
    }
  }

  c.header('Cache-Control', isComplete ? 'public, max-age=86400' : 'public, max-age=60');
  c.header('X-Cache', 'MISS');
  return c.json({ attempts });
});

// NOTE: WCA 官方比赛 results / scrambles 已 posted 后基本 immutable —— DB write-through 缓存,
// 让"同轮次还原"在第二位用户/设备上秒加载。30 天 TTL 兼顾偶发的赛后修订(罚时/DNF 调整)。
const WCA_CACHE_TTL_DAYS = 30;

// GET /api/recon/wca-results?compId=&wcaEvent= — 缓存式代理 WCA results,client 替代直拉
reconRoutes.get('/api/recon/wca-results', async (c) => {
  const compId = c.req.query('compId') ?? '';
  const wcaEvent = c.req.query('wcaEvent') ?? '';
  if (!compId || !wcaEvent) return c.json({ error: 'compId/wcaEvent required' }, 400);
  if (!/^[A-Za-z0-9_-]+$/.test(compId) || !/^[A-Za-z0-9]+$/.test(wcaEvent)) {
    return c.json({ error: 'invalid param format' }, 400);
  }

  // 1. 查缓存
  try {
    const rows = await query<{ payload: string }>(
      `SELECT payload FROM wca_results_cache
        WHERE comp_id = ? AND wca_event = ?
          AND fetched_at > NOW() - INTERVAL '${WCA_CACHE_TTL_DAYS} days'`,
      [compId, wcaEvent],
    );
    if (rows[0]?.payload) {
      c.header('Cache-Control', 'public, max-age=86400');
      c.header('X-Cache', 'HIT');
      return c.body(rows[0].payload, 200, { 'Content-Type': 'application/json' });
    }
  } catch (err) {
    console.error('[wca-results] cache read failed:', err);
  }

  // 2. miss → 上游拉
  const url = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/results/${encodeURIComponent(wcaEvent)}`;
  let upstream: { id: unknown; rounds: { results: unknown[] }[] } | null = null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CubeRoot-Recon/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return c.json({ error: 'WCA API unavailable', status: res.status }, 502);
    upstream = await res.json();
  } catch (err) {
    console.error('[wca-results] fetch failed:', err);
    return c.json({ error: 'WCA API unreachable', detail: String((err as Error)?.message ?? err) }, 502);
  }
  if (!upstream || !Array.isArray(upstream.rounds)) {
    return c.json({ error: 'WCA API malformed' }, 502);
  }

  // 3. 仅当有任意一轮含 results 才写库,避免缓存"未 posted"的空响应
  const hasAny = upstream.rounds.some(r => Array.isArray(r.results) && r.results.length > 0);
  const payload = JSON.stringify(upstream);
  if (hasAny) {
    try {
      await query(
        `INSERT INTO wca_results_cache (comp_id, wca_event, payload)
         VALUES (?, ?, ?)
         ON CONFLICT (comp_id, wca_event) DO UPDATE SET
           payload = EXCLUDED.payload,
           fetched_at = NOW()`,
        [compId, wcaEvent, payload],
      );
    } catch (err) {
      console.error('[wca-results] cache write failed:', err);
    }
  }

  c.header('Cache-Control', hasAny ? 'public, max-age=86400' : 'public, max-age=60');
  c.header('X-Cache', 'MISS');
  return c.body(payload, 200, { 'Content-Type': 'application/json' });
});

// GET /api/recon/wca-scrambles?compId= — 缓存式代理 WCA scrambles
reconRoutes.get('/api/recon/wca-scrambles', async (c) => {
  const compId = c.req.query('compId') ?? '';
  if (!compId) return c.json({ error: 'compId required' }, 400);
  if (!/^[A-Za-z0-9_-]+$/.test(compId)) return c.json({ error: 'invalid compId' }, 400);

  try {
    const rows = await query<{ payload: string }>(
      `SELECT payload FROM wca_scrambles_cache
        WHERE comp_id = ?
          AND fetched_at > NOW() - INTERVAL '${WCA_CACHE_TTL_DAYS} days'`,
      [compId],
    );
    if (rows[0]?.payload) {
      c.header('Cache-Control', 'public, max-age=86400');
      c.header('X-Cache', 'HIT');
      return c.body(rows[0].payload, 200, { 'Content-Type': 'application/json' });
    }
  } catch (err) {
    console.error('[wca-scrambles] cache read failed:', err);
  }

  const url = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/scrambles`;
  let upstream: unknown[] | null = null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CubeRoot-Recon/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return c.json({ error: 'WCA API unavailable', status: res.status }, 502);
    upstream = await res.json();
  } catch (err) {
    console.error('[wca-scrambles] fetch failed:', err);
    return c.json({ error: 'WCA API unreachable', detail: String((err as Error)?.message ?? err) }, 502);
  }
  if (!Array.isArray(upstream)) return c.json({ error: 'WCA API malformed' }, 502);

  const payload = JSON.stringify(upstream);
  if (upstream.length > 0) {
    try {
      await query(
        `INSERT INTO wca_scrambles_cache (comp_id, payload)
         VALUES (?, ?)
         ON CONFLICT (comp_id) DO UPDATE SET
           payload = EXCLUDED.payload,
           fetched_at = NOW()`,
        [compId, payload],
      );
    } catch (err) {
      console.error('[wca-scrambles] cache write failed:', err);
    }
  }

  c.header('Cache-Control', upstream.length > 0 ? 'public, max-age=86400' : 'public, max-age=60');
  c.header('X-Cache', 'MISS');
  return c.body(payload, 200, { 'Content-Type': 'application/json' });
});

// GET /api/recon/bili-cover?bvid=xxx
reconRoutes.get('/api/recon/bili-cover', async (c) => {
  const bvid = c.req.query('bvid') ?? '';
  if (!bvid || !/^BV[A-Za-z0-9]+$/.test(bvid)) {
    return c.json({ error: 'Invalid bvid' }, 400);
  }

  try {
    const biliUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const res = await fetch(biliUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return c.json({ error: 'Bilibili API unavailable' }, 502);
    }

    const data = await res.json() as { data: { pic: string } };
    const pic = data?.data?.pic;
    if (!pic) {
      return c.json({ error: 'Cover not found' }, 404);
    }

    // NOTE: 升级 http → https
    c.header('Cache-Control', 'public, max-age=86400');
    return c.json({ pic: pic.replace('http://', 'https://') });
  } catch {
    return c.json({ error: 'Bilibili API unavailable' }, 502);
  }
});

// GET /api/recon/user-stats?wcaId=xxx
reconRoutes.get('/api/recon/user-stats', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim();
  if (!wcaId) return c.json({ reconCount: 0, addedCount: 0 });

  const [reconRows, addedRows] = await Promise.all([
    query<{ c: number }>('SELECT COUNT(*) AS c FROM recons WHERE reconer_id = ?', [wcaId]),
    query<{ c: number }>('SELECT COUNT(*) AS c FROM recons WHERE added_by_id = ?', [wcaId]),
  ]);
  return c.json({
    reconCount: Number(reconRows[0]?.c ?? 0),
    addedCount: Number(addedRows[0]?.c ?? 0),
  });
});

// GET /api/recon/list-persons
reconRoutes.get('/api/recon/list-persons', async (c) => {
  const rows = await query(
    `SELECT person, person_id, MAX(person_country) AS person_country
     FROM recons WHERE person_id IS NOT NULL AND person IS NOT NULL
     GROUP BY person, person_id ORDER BY person`
  );
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(rows);
});

// GET /api/recon/timer-sync (拉取) + POST /api/recon/timer-sync (写入)
reconRoutes.get('/api/recon/timer-sync', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  const authUser = await requireAuth(c);
  const rows = await query<{
    session_id: string; puzzle_id: string; solves: string; updated_at: number;
  }>(
    'SELECT session_id, puzzle_id, solves, updated_at FROM timer_sessions WHERE wca_id = ?',
    [authUser.wcaId]
  );
  return c.json(rows.map(r => ({
    sessionId: r.session_id,
    puzzleId: r.puzzle_id,
    solves: JSON.parse(String(r.solves)),
    updatedAt: Number(r.updated_at),
  })));
});

reconRoutes.post('/api/recon/timer-sync', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<{ sessionId?: string; puzzleId?: string; solves?: unknown }>();

  if (!body.sessionId || !body.puzzleId) {
    return c.json({ error: 'sessionId and puzzleId are required' }, 400);
  }

  const solvesJson = JSON.stringify(body.solves ?? []);
  // NOTE: 防止单次 payload 过大（限 500KB）
  if (Buffer.byteLength(solvesJson, 'utf8') > 512000) {
    return c.json({ error: 'Payload too large (max 500KB)' }, 413);
  }

  const now = Math.floor(Date.now() / 1000);
  await query(
    `INSERT INTO timer_sessions (wca_id, session_id, puzzle_id, solves, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (wca_id, session_id, puzzle_id) DO UPDATE SET
       solves = EXCLUDED.solves,
       updated_at = EXCLUDED.updated_at`,
    [authUser.wcaId, body.sessionId, body.puzzleId, solvesJson, now]
  );
  return c.json({ ok: true, updatedAt: now });
});

// ==================== 动态参数路由（必须在所有具名路由之后注册） ====================
// NOTE: /:id 会匹配任何 /api/recon/xxx 路径，所以具名路由必须先注册

// GET /api/recon/:id — 获取单条复盘
reconRoutes.get('/api/recon/:id', async (c) => {
  const id = c.req.param('id');

  const rows = await query('SELECT * FROM recons WHERE id = ?', [id]);
  if (rows.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  const result = rowToJson(rows[0] as Record<string, unknown>);

  // 合并编辑覆盖层(PG JSONB driver 已经反序列化为 JS object)
  const edits = await query<{ fields: Record<string, unknown> }>(
    'SELECT fields FROM edits WHERE solve_id = ?', [id]
  );
  if (edits.length > 0 && edits[0].fields && typeof edits[0].fields === 'object') {
    for (const [k, v] of Object.entries(edits[0].fields)) {
      if (!k.startsWith('_')) result[k] = v;
    }
    result._edited = true;
  }

  return c.json(result);
});

// POST /api/recon — 新增复盘
reconRoutes.post('/api/recon', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<Record<string, unknown>>();

  body.addedBy = authUser.name;
  body.addedById = authUser.wcaId;
  body.createdAt = Math.floor(Date.now() / 1000);
  delete body.id;

  const row = jsonToRow(body);
  const errors = validateRow(row);
  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', fields: errors }, 400);
  }

  const { sql, values } = buildInsert('recons', row);
  const inserted = await query<{ id: number }>(sql + ' RETURNING id', values);
  body.id = Number(inserted[0].id);
  return c.json(body);
});

// PUT /api/recon/:id — 更新复盘
reconRoutes.put('/api/recon/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await query<{ added_by_id: string }>(
    'SELECT added_by_id FROM recons WHERE id = ?', [id]
  );
  if (existing.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId)) {
    if ((existing[0].added_by_id ?? '') !== authUser.wcaId) {
      return c.json({ error: 'Cannot edit others recon' }, 403);
    }
  }

  const row = jsonToRow(body);
  if (Object.keys(row).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }
  const errs = validateRow(row);
  if (errs.length > 0) {
    return c.json({ error: 'Validation failed', fields: errs }, 400);
  }

  const { sql, values } = buildUpdate('recons', row, 'id', id);
  await query(sql, values);
  return c.json({ ok: true });
});

// DELETE /api/recon/:id — 删除复盘
reconRoutes.delete('/api/recon/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');

  const existing = await query<{ added_by_id: string }>(
    'SELECT added_by_id FROM recons WHERE id = ?', [id]
  );
  if (existing.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId)) {
    if ((existing[0].added_by_id ?? '') !== authUser.wcaId) {
      return c.json({ error: 'Cannot delete others recon' }, 403);
    }
  }

  await query('DELETE FROM recons WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ==================== Alternatives (另解) ====================
// 任何登录用户都可以给 parent solve 投另解;每条另解只有作者(addedById)和 admin 能改/删。
// 存储:recons.alternatives JSON 列,数组 [{solution, addedById, addedBy, createdAt}, ...]。
// 操作单元用数组下标(0-based),不分配独立 id。

interface AlternativeEntry {
  solution: string;
  addedById: string;
  addedBy: string;
  createdAt: number;
}

async function loadAlternatives(id: string): Promise<AlternativeEntry[] | null> {
  const rows = await query<{ alternatives: string | null }>(
    'SELECT alternatives FROM recons WHERE id = ?', [id]
  );
  if (rows.length === 0) return null;
  const raw = rows[0].alternatives;
  if (raw == null) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as AlternativeEntry[]; } catch { return []; }
  }
  return Array.isArray(raw) ? raw as AlternativeEntry[] : [];
}

async function saveAlternatives(id: string, alts: AlternativeEntry[]): Promise<void> {
  await query('UPDATE recons SET alternatives = ? WHERE id = ?', [JSON.stringify(alts), id]);
}

// POST /api/recon/:id/alternatives — 追加一条另解
reconRoutes.post('/api/recon/:id/alternatives', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ solution?: string }>();
  const solution = (body.solution ?? '').trim();
  if (!solution) return c.json({ error: 'solution required' }, 400);
  if (Buffer.byteLength(solution, 'utf8') > 65535) return c.json({ error: 'solution too long' }, 400);

  const alts = await loadAlternatives(id);
  if (alts == null) return c.json({ error: 'Not found' }, 404);

  alts.push({
    solution,
    addedById: authUser.wcaId,
    addedBy: authUser.name,
    createdAt: Math.floor(Date.now() / 1000),
  });
  await saveAlternatives(id, alts);
  return c.json({ alternatives: alts });
});

// PUT /api/recon/:id/alternatives/:idx — 改某条另解
reconRoutes.put('/api/recon/:id/alternatives/:idx', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');
  const idx = Number(c.req.param('idx'));
  const body = await c.req.json<{ solution?: string }>();
  const solution = (body.solution ?? '').trim();
  if (!solution) return c.json({ error: 'solution required' }, 400);
  if (Buffer.byteLength(solution, 'utf8') > 65535) return c.json({ error: 'solution too long' }, 400);

  const alts = await loadAlternatives(id);
  if (alts == null) return c.json({ error: 'Not found' }, 404);
  if (!Number.isInteger(idx) || idx < 0 || idx >= alts.length) {
    return c.json({ error: 'Invalid alternative index' }, 400);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && alts[idx].addedById !== authUser.wcaId) {
    return c.json({ error: 'Cannot edit others alternative' }, 403);
  }

  alts[idx] = { ...alts[idx], solution };
  await saveAlternatives(id, alts);
  return c.json({ alternatives: alts });
});

// DELETE /api/recon/:id/alternatives/:idx — 删某条另解
reconRoutes.delete('/api/recon/:id/alternatives/:idx', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = c.req.param('id');
  const idx = Number(c.req.param('idx'));

  const alts = await loadAlternatives(id);
  if (alts == null) return c.json({ error: 'Not found' }, 404);
  if (!Number.isInteger(idx) || idx < 0 || idx >= alts.length) {
    return c.json({ error: 'Invalid alternative index' }, 400);
  }
  if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && alts[idx].addedById !== authUser.wcaId) {
    return c.json({ error: 'Cannot delete others alternative' }, 403);
  }

  alts.splice(idx, 1);
  await saveAlternatives(id, alts);
  return c.json({ alternatives: alts });
});

