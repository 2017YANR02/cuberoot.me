/**
 * Recon 核心 CRUD 路由（阶段 1）
 * 端点：list, get, add, update, delete, checkDuplicate, searchSolvers
 * NOTE: 1:1 移植自 PHP recon/api/index.php 的 switch-case 结构
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/connection.js';
import {
  rowToJson, jsonToRow, validateRow,
  requireAuth, requireAdmin, checkRateLimit,
  buildInsert, buildUpdate, ADMIN_WCA_IDS,
} from '../utils/recon_helpers.js';

export async function reconRoutes(server: FastifyInstance) {

  // ==================== GET /api/recon/list ====================

  server.get<{
    Querystring: { wcaId?: string };
  }>('/api/recon/list', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    const { wcaId } = req.query;

    let rows: Record<string, unknown>[];
    if (wcaId) {
      rows = await query('SELECT * FROM recons WHERE person_id = ? ORDER BY id DESC', [wcaId]);
    } else {
      rows = await query('SELECT * FROM recons ORDER BY id DESC');
    }

    return rows.map(rowToJson);
  });

  // ==================== GET /api/recon/check-duplicate ====================
  // NOTE: 放在 /:id 之前，否则 'check-duplicate' 会被当作 :id 参数

  server.get<{
    Querystring: {
      comp?: string; event?: string; personId?: string;
      person?: string; round?: string; solveNum?: string; excludeId?: string;
    };
  }>('/api/recon/check-duplicate', async (req) => {
    const { comp, event, personId, person, round, solveNum, excludeId } = req.query;

    if (!comp || !event || !round || !solveNum || (!personId && !person)) {
      return { exists: false };
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
      return { exists: true, id: Number(rows[0].id) };
    }
    return { exists: false };
  });

  // ==================== GET /api/recon/search-solvers ====================

  server.get<{
    Querystring: { q?: string };
  }>('/api/recon/search-solvers', async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return [];

    // NOTE: 代理 WCA 搜索 API（前端无法直接跨域调用）
    // PHP 用文件缓存（24h），此处暂用直接转发（后续可加 Redis/内存缓存）
    try {
      const wcaUrl = `https://www.worldcubeassociation.org/api/v0/search/users?q=${encodeURIComponent(q)}&persons_table=true`;
      const res = await fetch(wcaUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        reply.code(502);
        return { error: 'WCA API unavailable' };
      }

      const data = await res.json() as { result: Array<{ name: string; country_iso2: string; wca_id: string }> };
      const results = (data.result ?? []).map(p => ({
        name: p.name ?? '',
        iso2: (p.country_iso2 ?? '').toLowerCase(),
        wcaId: p.wca_id ?? '',
      }));

      reply.header('Cache-Control', 'public, max-age=3600');
      return results;
    } catch {
      reply.code(502);
      return { error: 'WCA API unavailable' };
    }
  });

  // ==================== GET /api/recon/:id ====================

  server.get<{
    Params: { id: string };
  }>('/api/recon/:id', async (req, reply) => {
    const { id } = req.params;

    const rows = await query('SELECT * FROM recons WHERE id = ?', [id]);
    if (rows.length === 0) {
      reply.code(404);
      return { error: 'Not found' };
    }

    const result = rowToJson(rows[0] as Record<string, unknown>);

    // NOTE: 合并编辑覆盖层（与 PHP get action 一致）
    const edits = await query<{ fields: string }>(
      'SELECT fields FROM edits WHERE solve_id = ?', [id]
    );
    if (edits.length > 0) {
      const fields = JSON.parse(String(edits[0].fields)) as Record<string, unknown>;
      for (const [k, v] of Object.entries(fields)) {
        if (!k.startsWith('_')) result[k] = v;
      }
      result._edited = true;
    }

    return result;
  });

  // ==================== POST /api/recon ====================

  server.post('/api/recon', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const body = req.body as Record<string, unknown>;

    // NOTE: 服务端覆盖身份字段（不信任前端传值）
    body.addedBy = authUser.name;
    body.addedById = authUser.wcaId;
    body.createdAt = Math.floor(Date.now() / 1000);
    delete body.id; // NOTE: 由数据库 AUTO_INCREMENT 分配

    const row = jsonToRow(body);

    // NOTE: 校验
    const errors = validateRow(row);
    if (errors.length > 0) {
      reply.code(400);
      return { error: 'Validation failed', fields: errors };
    }

    const { sql, values } = buildInsert('recons', row);
    const result = await query(sql, values) as unknown as { insertId: bigint };
    body.id = Number(result.insertId);

    return body;
  });

  // ==================== PUT /api/recon/:id ====================

  server.put<{
    Params: { id: string };
  }>('/api/recon/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    // NOTE: 查找目标记录，验证权限
    const existing = await query<{ added_by_id: string }>(
      'SELECT added_by_id FROM recons WHERE id = ?', [id]
    );
    if (existing.length === 0) {
      reply.code(404);
      return { error: 'Not found' };
    }

    // NOTE: 非管理员只能更新自己的复盘
    if (!ADMIN_WCA_IDS.includes(authUser.wcaId)) {
      if ((existing[0].added_by_id ?? '') !== authUser.wcaId) {
        reply.code(403);
        return { error: 'Cannot edit others recon' };
      }
    }

    const row = jsonToRow(body);
    if (Object.keys(row).length === 0) {
      reply.code(400);
      return { error: 'No valid fields to update' };
    }

    const errors = validateRow(row);
    if (errors.length > 0) {
      reply.code(400);
      return { error: 'Validation failed', fields: errors };
    }

    const { sql, values } = buildUpdate('recons', row, 'id', id);
    await query(sql, values);

    return { ok: true };
  });

  // ==================== DELETE /api/recon/:id ====================

  server.delete<{
    Params: { id: string };
  }>('/api/recon/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const { id } = req.params;

    const existing = await query<{ added_by_id: string }>(
      'SELECT added_by_id FROM recons WHERE id = ?', [id]
    );
    if (existing.length === 0) {
      reply.code(404);
      return { error: 'Not found' };
    }

    // NOTE: 非管理员只能删自己的复盘
    if (!ADMIN_WCA_IDS.includes(authUser.wcaId)) {
      if ((existing[0].added_by_id ?? '') !== authUser.wcaId) {
        reply.code(403);
        return { error: 'Cannot delete others recon' };
      }
    }

    await query('DELETE FROM recons WHERE id = ?', [id]);
    return { ok: true };
  });

  // ==================== 阶段 2：评论系统 ====================

  // GET /api/recon/comments?reconId=xxx
  server.get<{
    Querystring: { reconId?: string };
  }>('/api/recon/comments', async (req, reply) => {
    const { reconId } = req.query;
    if (!reconId) {
      reply.code(400);
      return { error: 'reconId is required' };
    }
    const rows = await query<{
      id: number; recon_id: number; author_id: string; author_name: string;
      content: string; created_at: number; updated_at: number | null;
    }>(
      `SELECT id, recon_id, author_id, author_name, content, created_at, updated_at
       FROM comments WHERE recon_id = ? ORDER BY created_at ASC`, [reconId]
    );
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return rows.map(r => ({
      id: Number(r.id),
      reconId: Number(r.recon_id),
      authorId: r.author_id,
      authorName: r.author_name,
      content: r.content,
      createdAt: Number(r.created_at),
      updatedAt: r.updated_at ? Number(r.updated_at) : null,
    }));
  });

  // POST /api/recon/comments
  server.post('/api/recon/comments', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const body = req.body as { reconId?: number; content?: string };

    if (!body.reconId) {
      reply.code(400);
      return { error: 'reconId is required' };
    }
    const content = (body.content ?? '').trim();
    if (!content) {
      reply.code(400);
      return { error: 'content is required' };
    }
    if (content.length > 2000) {
      reply.code(400);
      return { error: 'content exceeds 2000 characters' };
    }

    try {
      const result = await query(
        `INSERT INTO comments (recon_id, author_id, author_name, content, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [body.reconId, authUser.wcaId, authUser.name, content, Math.floor(Date.now() / 1000)]
      ) as unknown as { insertId: bigint };
      return { ok: true, id: Number(result.insertId) };
    } catch (e: unknown) {
      // NOTE: UNIQUE 约束冲突——该用户已对此复盘发表过评论
      if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'ER_DUP_ENTRY') {
        reply.code(409);
        return { error: 'You have already commented on this recon' };
      }
      throw e;
    }
  });

  // PUT /api/recon/comments/:id
  server.put<{
    Params: { id: string };
  }>('/api/recon/comments/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const { id } = req.params;
    const body = req.body as { content?: string };
    const content = (body.content ?? '').trim();

    if (!content) {
      reply.code(400);
      return { error: 'content is required' };
    }
    if (content.length > 2000) {
      reply.code(400);
      return { error: 'content exceeds 2000 characters' };
    }

    // NOTE: 权限检查——本人或管理员
    const target = await query<{ author_id: string }>('SELECT author_id FROM comments WHERE id = ?', [id]);
    if (target.length === 0) {
      reply.code(404);
      return { error: 'Comment not found' };
    }
    if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && target[0].author_id !== authUser.wcaId) {
      reply.code(403);
      return { error: 'Cannot edit others comment' };
    }

    await query('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?',
      [content, Math.floor(Date.now() / 1000), id]);
    return { ok: true };
  });

  // DELETE /api/recon/comments/:id
  server.delete<{
    Params: { id: string };
  }>('/api/recon/comments/:id', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const { id } = req.params;

    const target = await query<{ author_id: string }>('SELECT author_id FROM comments WHERE id = ?', [id]);
    if (target.length === 0) {
      reply.code(404);
      return { error: 'Comment not found' };
    }
    if (!ADMIN_WCA_IDS.includes(authUser.wcaId) && target[0].author_id !== authUser.wcaId) {
      reply.code(403);
      return { error: 'Cannot delete others comment' };
    }

    await query('DELETE FROM comments WHERE id = ?', [id]);
    return { ok: true };
  });

  // ==================== 阶段 3：编辑覆盖 + 历史 ====================

  // GET /api/recon/edits
  server.get('/api/recon/edits', async () => {
    const rows = await query<{ solve_id: string; fields: string }>(
      'SELECT solve_id, fields FROM edits'
    );
    // NOTE: 返回 {solveId: fields} 的 map（空时返回 {} 而非 []）
    const edits: Record<string, unknown> = {};
    for (const row of rows) {
      edits[row.solve_id] = JSON.parse(String(row.fields));
    }
    return edits;
  });

  // POST /api/recon/save-edit
  server.post('/api/recon/save-edit', async (req, reply) => {
    checkRateLimit(req.ip);
    await requireAdmin(req);
    const body = req.body as { solveId?: string; fields?: Record<string, unknown> };
    const { solveId, fields } = body;

    if (!solveId) {
      reply.code(400);
      return { error: 'solveId is required' };
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

    return { ok: true };
  });

  // DELETE /api/recon/edit/:id
  server.delete<{
    Params: { id: string };
  }>('/api/recon/edit/:id', async (req) => {
    checkRateLimit(req.ip);
    await requireAdmin(req);
    await query('DELETE FROM edits WHERE solve_id = ?', [req.params.id]);
    return { ok: true };
  });

  // POST /api/recon/save-history
  server.post('/api/recon/save-history', async (req) => {
    checkRateLimit(req.ip);
    await requireAdmin(req);
    const body = req.body as {
      solveId?: string; before?: unknown; after?: unknown; editedBy?: string;
    };
    const now = Math.floor(Date.now() / 1000);
    // NOTE: 用时间戳+随机后缀生成唯一 ID
    const id = `${now}-${Math.random().toString(36).slice(2, 10)}`;

    await query(
      `INSERT INTO edit_history (id, solve_id, before_snapshot, after_fields, edited_by, edited_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, body.solveId ?? '', body.before ? JSON.stringify(body.before) : null,
       body.after ? JSON.stringify(body.after) : null, body.editedBy ?? '', now]
    );
    return { ok: true };
  });

  // GET /api/recon/history?id=xxx
  server.get<{
    Querystring: { id?: string };
  }>('/api/recon/history', async (req) => {
    const solveId = req.query.id ?? '';
    const rows = await query<{
      id: string; solve_id: string; before_snapshot: string | null;
      after_fields: string | null; edited_by: string; edited_at: number;
    }>(
      'SELECT * FROM edit_history WHERE solve_id = ? ORDER BY edited_at DESC LIMIT 20',
      [solveId]
    );
    return rows.map(r => ({
      id: r.id,
      solveId: r.solve_id,
      before: r.before_snapshot ? JSON.parse(r.before_snapshot) : null,
      after: r.after_fields ? JSON.parse(r.after_fields) : null,
      editedBy: r.edited_by,
      editedAt: Number(r.edited_at),
    }));
  });

  // ==================== 阶段 4：代理 + 统计 + Timer ====================

  // GET /api/recon/wca-attempts?compId=xxx&personId=xxx
  server.get<{
    Querystring: { compId?: string; personId?: string };
  }>('/api/recon/wca-attempts', async (req, reply) => {
    const { compId, personId } = req.query;
    if (!compId || !personId) {
      reply.code(400);
      return { error: 'compId and personId are required' };
    }

    try {
      const wcaUrl = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/results`;
      const res = await fetch(wcaUrl, {
        headers: { 'User-Agent': 'CubeRoot-Recon/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        reply.code(502);
        return { error: 'WCA API unavailable' };
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
      reply.header('Cache-Control', 'public, max-age=3600');
      return personData;
    } catch {
      reply.code(502);
      return { error: 'WCA API unavailable' };
    }
  });

  // GET /api/recon/bili-cover?bvid=xxx
  server.get<{
    Querystring: { bvid?: string };
  }>('/api/recon/bili-cover', async (req, reply) => {
    const bvid = req.query.bvid ?? '';
    if (!bvid || !/^BV[A-Za-z0-9]+$/.test(bvid)) {
      reply.code(400);
      return { error: 'Invalid bvid' };
    }

    try {
      const biliUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
      const res = await fetch(biliUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        reply.code(502);
        return { error: 'Bilibili API unavailable' };
      }

      const data = await res.json() as { data: { pic: string } };
      const pic = data?.data?.pic;
      if (!pic) {
        reply.code(404);
        return { error: 'Cover not found' };
      }

      // NOTE: 升级 http → https
      reply.header('Cache-Control', 'public, max-age=86400');
      return { pic: pic.replace('http://', 'https://') };
    } catch {
      reply.code(502);
      return { error: 'Bilibili API unavailable' };
    }
  });

  // GET /api/recon/user-stats?wcaId=xxx
  server.get<{
    Querystring: { wcaId?: string };
  }>('/api/recon/user-stats', async (req) => {
    const wcaId = (req.query.wcaId ?? '').trim();
    if (!wcaId) return { reconCount: 0, addedCount: 0 };

    const [reconRows, addedRows] = await Promise.all([
      query<{ c: number }>('SELECT COUNT(*) AS c FROM recons WHERE reconer_id = ?', [wcaId]),
      query<{ c: number }>('SELECT COUNT(*) AS c FROM recons WHERE added_by_id = ?', [wcaId]),
    ]);
    return {
      reconCount: Number(reconRows[0]?.c ?? 0),
      addedCount: Number(addedRows[0]?.c ?? 0),
    };
  });

  // GET /api/recon/list-persons
  server.get('/api/recon/list-persons', async (req, reply) => {
    const rows = await query(
      `SELECT person, person_id, MAX(person_country) AS person_country
       FROM recons WHERE person_id IS NOT NULL AND person IS NOT NULL
       GROUP BY person, person_id ORDER BY person`
    );
    reply.header('Cache-Control', 'public, max-age=300');
    return rows;
  });

  // GET /api/recon/timer-sync (拉取) + POST /api/recon/timer-sync (写入)
  server.get('/api/recon/timer-sync', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authUser = await requireAuth(req);
    const rows = await query<{
      session_id: string; puzzle_id: string; solves: string; updated_at: number;
    }>(
      'SELECT session_id, puzzle_id, solves, updated_at FROM timer_sessions WHERE wca_id = ?',
      [authUser.wcaId]
    );
    return rows.map(r => ({
      sessionId: r.session_id,
      puzzleId: r.puzzle_id,
      solves: JSON.parse(String(r.solves)),
      updatedAt: Number(r.updated_at),
    }));
  });

  server.post('/api/recon/timer-sync', async (req, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    checkRateLimit(req.ip);
    const authUser = await requireAuth(req);
    const body = req.body as { sessionId?: string; puzzleId?: string; solves?: unknown };

    if (!body.sessionId || !body.puzzleId) {
      reply.code(400);
      return { error: 'sessionId and puzzleId are required' };
    }

    const solvesJson = JSON.stringify(body.solves ?? []);
    // NOTE: 防止单次 payload 过大（限 500KB）
    if (Buffer.byteLength(solvesJson, 'utf8') > 512000) {
      reply.code(413);
      return { error: 'Payload too large (max 500KB)' };
    }

    const now = Math.floor(Date.now() / 1000);
    await query(
      `INSERT INTO timer_sessions (wca_id, session_id, puzzle_id, solves, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE solves = VALUES(solves), updated_at = VALUES(updated_at)`,
      [authUser.wcaId, body.sessionId, body.puzzleId, solvesJson, now]
    );
    return { ok: true, updatedAt: now };
  });
}
