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
    sql = 'SELECT id FROM recons WHERE comp = ? AND event = ? AND person_id = ? AND `round` = ? AND solve_num = ?';
    params.push(comp, event, personId, round, Number(solveNum));
  } else {
    sql = 'SELECT id FROM recons WHERE comp = ? AND event = ? AND person = ? AND `round` = ? AND solve_num = ?';
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
  }>(
    `SELECT id, recon_id, author_id, author_name, content, created_at, updated_at, pinned
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
  })));
});

// POST /api/recon/comments
reconRoutes.post('/api/recon/comments', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const body = await c.req.json<{ reconId?: number; content?: string }>();

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

  try {
    const result = await query(
      `INSERT INTO comments (recon_id, author_id, author_name, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [body.reconId, authUser.wcaId, authUser.name, content, Math.floor(Date.now() / 1000)]
    ) as unknown as { insertId: bigint };
    return c.json({ ok: true, id: Number(result.insertId) });
  } catch (e: unknown) {
    // NOTE: UNIQUE 约束冲突——该用户已对此复盘发表过评论
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'You have already commented on this recon' }, 409);
    }
    throw e;
  }
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

// DELETE /api/recon/comments/:id
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

  await query('DELETE FROM comments WHERE id = ?', [id]);
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
  const rows = await query<{ solve_id: string; fields: string }>(
    'SELECT solve_id, fields FROM edits'
  );
  // NOTE: 返回 {solveId: fields} 的 map（空时返回 {} 而非 []）
  const edits: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      edits[row.solve_id] = JSON.parse(String(row.fields));
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

  // NOTE: JSON_MERGE_PATCH 实现字段级合并（MariaDB 10.5+）
  await query(
    `INSERT INTO edits (solve_id, fields, edited_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE fields = JSON_MERGE_PATCH(fields, VALUES(fields)), edited_at = VALUES(edited_at)`,
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
     ON DUPLICATE KEY UPDATE solves = VALUES(solves), updated_at = VALUES(updated_at)`,
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

  // NOTE: 合并编辑覆盖层（与 PHP get action 一致）
  const edits = await query<{ fields: string }>(
    'SELECT fields FROM edits WHERE solve_id = ?', [id]
  );
  if (edits.length > 0) {
    try {
      const fields = JSON.parse(String(edits[0].fields)) as Record<string, unknown>;
      for (const [k, v] of Object.entries(fields)) {
        if (!k.startsWith('_')) result[k] = v;
      }
      result._edited = true;
    } catch {
      // NOTE: edits.fields 解析失败——跳过覆盖层，不阻塞主数据
      console.warn(`edits parse failed for solve_id=${id}`);
    }
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
  const result = await query(sql, values) as unknown as { insertId: bigint };
  body.id = Number(result.insertId);
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

