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
}
