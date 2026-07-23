/**
 * Recon 核心 CRUD 路由（阶段 1-4）
 * 端点：list, get, add, update, delete, checkDuplicate, searchSolvers,
 *       comments CRUD, edits, history, wca-attempts, bili-cover, user-stats,
 *       list-persons
 * NOTE: 迁移自 PHP recon/api/index.php → Hono
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import {
  rowToJson, jsonToRow, validateRow,
  requireAuth, requireAdmin, optionalAuth, checkRateLimit,
  buildInsert, buildUpdate, buildDuplicateQuery, DUP_REASONS, ADMIN_WCA_IDS,
} from '../utils/recon_helpers.js';
import { fetchCubingAttempts } from '../utils/cubing_proxy.js';
import { wcaIdToCubingSlug, nameToCubingSlug } from '@cuberoot/shared/cubing-slug';
import { notify, adminRecipients } from '../utils/notify.js';

export const reconRoutes = new Hono();

/** 通知用的 recon 抬头 + 站内链接。id 段即可打开详情页(前端 parseReconId 兼容 slug)。 */
async function reconNotifyMeta(reconId: number): Promise<{ title: string; link: string }> {
  const rows = await query<{ person: string | null; event: string | null; comp: string | null }>(
    'SELECT person, event, comp FROM recons WHERE id = ?', [reconId],
  );
  const r = rows[0];
  const title = [r?.person, r?.event, r?.comp].filter(Boolean).join(' ') || `#${reconId}`;
  return { title, link: `/recon/${reconId}` };
}

// ==================== GET /v1/recon/list ====================

// NOTE: 列表页只用以下字段（含搜索匹配 optimal_scramble/oll/pll/note）。
//       之前 SELECT * 把 solution（最大的字段，每条几百字节）等全拉过来，
//       响应 ~800 KB / 590 KB gzip，国内用户加载 10–30s。
//       瘦身后预计减半以上。详情页仍走 GET /v1/recon/:id 拿全字段。
const LIST_COLUMNS = [
  'id', 'official', 'event', 'method', 'date',
  'comp', 'comp_wca_id', 'country',
  'round', 'solve_num',
  'person', 'person_id', 'person_country', 'co_persons',
  'reconer', 'reconer_id',
  'value', 'raw_time', 'average', 'ao_type',
  'regional_single_record', 'regional_average_record', 'regional_aoxr_record',
  'stm', 'tps', 'visibility',
  // 多数解的打乱在 optimal_scramble；缺的（社区 Home 解等 ~234 条）落在 wca_scramble。
  // COALESCE 回退到 wca_scramble（仍以 optimal_scramble 列名出，客户端 optimalScramble||wcaScramble 无感），
  // 让卡片视图打乱图 + 搜索都拿得到打乱；只给缺 optimal 的行加数据，不对全表多带一列。
  "COALESCE(NULLIF(optimal_scramble, ''), wca_scramble) AS optimal_scramble", 'oll', 'pll', 'note',
  // 卡片视图缩略图用：有视频 → 取 B 站/YouTube 封面（多为空串，几乎不增 gzip）。
  'video_url',
].join(', ');

// 首页「今日复盘」卡片用:列表字段 + wca_scramble(打乱图回退) + created_at(分组用)。
const TODAY_COLUMNS = LIST_COLUMNS + ', wca_scramble, created_at';

// 个人主页用:列表字段 + 添加者(added_by/added_by_id 不在 LIST_COLUMNS,个人页要按添加者角色筛)。
// + video_url/caption 给「复用以前的填写」选择器做视频缩略图 + 标题(个人页忽略多余列)。
const PERSON_COLUMNS = LIST_COLUMNS + ', added_by, added_by_id, video_url, caption';

reconRoutes.get('/recon/list', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  const wcaId = c.req.query('wcaId');
  const comp = c.req.query('comp');

  // 可见性:所有公开发现入口(社区总表 / 比赛页)一律只回 public;非公开(unlisted / private)
  // 不进任何列表,连本人也不在这些「发现」面上看到自己的(与 YouTube 一致:你的不公开视频不进
  // 公共推荐)。只有按选手定向查询(?wcaId,喂个人页 + 提交表单自动填充)才对本人放行自己的非公开。
  let rows: Record<string, unknown>[];
  if (wcaId) {
    const me = await optionalAuth(c);
    const visClause = me ? `(visibility = 'public' OR added_by_id = ?)` : `visibility = 'public'`;
    const params = me ? [wcaId, me.wcaId] : [wcaId];
    rows = await query(
      `SELECT ${LIST_COLUMNS} FROM recons WHERE person_id = ? AND ${visClause} ORDER BY id DESC`,
      params,
    );
  } else if (comp) {
    // 比赛页(/wca/comp)逐把成绩 → 复盘的跳转映射:只拉本场的公开复盘(comp_wca_id 命中)。
    rows = await query(
      `SELECT ${LIST_COLUMNS} FROM recons WHERE comp_wca_id = ? AND visibility = 'public' ORDER BY id DESC`,
      [comp],
    );
  } else {
    rows = await query(`SELECT ${LIST_COLUMNS} FROM recons WHERE visibility = 'public' ORDER BY id DESC`);
  }

  return c.json(rows.map(rowToJson));
});

// ==================== GET /v1/recon/:id/same-scramble ====================
// 同一打乱串的其它复盘(任意选手/项目),给详情页「相同打乱的复盘」用。
// 旧实现客户端拉全量 /list(~800KB)再过滤 → 慢且不进 SSR。此端点只回匹配行,
// 服务端按归一化打乱(trim + 多空白折一)比对,跟客户端 scrambleKey 同语义。
// 注:path depth 与 /recon/:id 不同,注册顺序无冲突。
reconRoutes.get('/recon/:id/same-scramble', async (c) => {
  const id = c.req.param('id');
  const norm = "regexp_replace(btrim(COALESCE(NULLIF(optimal_scramble, ''), wca_scramble)), '\\s+', ' ', 'g')";
  const rows = await query<Record<string, unknown>>(
    `WITH target AS (SELECT ${norm} AS k FROM recons WHERE id = ?)
     SELECT ${LIST_COLUMNS} FROM recons, target
     WHERE recons.id <> ?
       AND recons.visibility = 'public'
       AND target.k <> ''
       AND ${norm.replace(/optimal_scramble/g, 'recons.optimal_scramble').replace(/wca_scramble/g, 'recons.wca_scramble')} = target.k
     ORDER BY raw_time ASC NULLS LAST
     LIMIT 200`,
    [id, id],
  );
  // 可变数据,浏览器短缓存即可(SSR 已给首屏,客户端再刷新求新)。
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(rows.map(rowToJson));
});

// ==================== GET /v1/recon/person/:wcaId ====================
// 个人复盘主页:某选手参与的全部 recon——作为选手(person_id)、合作者(co_persons 含其 id)、
// 复盘者(reconer_id) 或 添加者(added_by_id)。客户端再按角色 tab 过滤。
// NOTE: co_persons 是 TEXT 存 JSON 数组;NULLIF 把空串挡掉(''::jsonb 会报错),
//       jsonb 数组 containment @> [{"id":...}] 命中任一合作者条目。
reconRoutes.get('/recon/person/:wcaId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  const wcaId = (c.req.param('wcaId') ?? '').trim();
  if (!wcaId) return c.json([]);
  const coMatch = JSON.stringify([{ id: wcaId }]);
  // 可见性:公开的全放行;非公开(unlisted / private)仅当查看者是添加者本人时才带出,
  // 让本人在自己的个人页看得到自己不公开列出 / 私享的复盘。
  const me = await optionalAuth(c);
  const visClause = me ? `(recons.visibility = 'public' OR recons.added_by_id = ?)` : `recons.visibility = 'public'`;
  const visParams = me ? [me.wcaId] : [];
  const rows = await query<Record<string, unknown>>(
    `SELECT ${PERSON_COLUMNS} FROM recons
     WHERE (person_id = ? OR reconer_id = ? OR added_by_id = ?
        OR NULLIF(co_persons, '')::jsonb @> ?::jsonb)
       AND ${visClause}
     ORDER BY id DESC`,
    [wcaId, wcaId, wcaId, coMatch, ...visParams],
  );
  return c.json(rows.map(rowToJson));
});

// ==================== GET /v1/recon/latest ====================
// 首页「今日复盘」用:取 id 最大(最新录入)的一条,含 solution 等全字段 + edits 覆盖层。
// NOTE: 必须先于 /:id 注册,否则 'latest' 会被当成 :id。
reconRoutes.get('/recon/latest', async (c) => {
  const rows = await query(`SELECT * FROM recons WHERE visibility = 'public' ORDER BY id DESC LIMIT 1`);
  if (rows.length === 0) {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(null);
  }
  const result = rowToJson(rows[0] as Record<string, unknown>);

  // 合并编辑覆盖层(同 /:id)
  const edits = await query<{ fields: Record<string, unknown> }>(
    'SELECT fields FROM edits WHERE solve_id = ?', [String((rows[0] as { id: unknown }).id)]
  );
  if (edits.length > 0 && edits[0].fields && typeof edits[0].fields === 'object') {
    for (const [k, v] of Object.entries(edits[0].fields)) {
      if (!k.startsWith('_')) result[k] = v;
    }
    result._edited = true;
  }

  c.header('Cache-Control', 'public, max-age=300');
  return c.json(result);
});

// ==================== GET /v1/recon/today ====================
// 首页「今日复盘」用:返回「最新录入那天」(按 created_at, 以 Asia/Shanghai 计日)的全部 recon,
// 最新在前。这样卡片永远有内容(最近一天),当天录入多条时前端可展开。
// created_at 全空的旧库回退到「最新一条」(按 id)。必须先于 /:id 注册。
reconRoutes.get('/recon/today', async (c) => {
  const dayExpr = `(to_timestamp(created_at) AT TIME ZONE 'Asia/Shanghai')::date`;
  const rows = await query<Record<string, unknown>>(
    `SELECT ${TODAY_COLUMNS} FROM recons
     WHERE created_at IS NOT NULL
       AND visibility = 'public'
       AND ${dayExpr} = (
         SELECT ${dayExpr} FROM recons
         WHERE created_at IS NOT NULL AND visibility = 'public'
         ORDER BY created_at DESC, id DESC LIMIT 1
       )
     ORDER BY created_at DESC, id DESC
     LIMIT 50`
  );
  if (rows.length === 0) {
    // created_at 全空的旧库:退回最新一条
    const fallback = await query<Record<string, unknown>>(`SELECT ${TODAY_COLUMNS} FROM recons WHERE visibility = 'public' ORDER BY id DESC LIMIT 1`);
    c.header('Cache-Control', 'public, max-age=300');
    return c.json(fallback.map(rowToJson));
  }
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(rows.map(rowToJson));
});

// ==================== GET /v1/recon/check-duplicate ====================
// NOTE: 放在 /:id 之前，否则 'check-duplicate' 会被当作 :id 参数

reconRoutes.get('/recon/check-duplicate', async (c) => {
  // 判重口径 = 同选手 + 同打乱(见 buildDuplicateQuery);与 POST/PUT 的拒绝逻辑同源,
  // 保证前端「已存在」提示和后端实际拒绝完全一致。
  const excludeId = c.req.query('excludeId');
  const dup = buildDuplicateQuery({
    person_id: c.req.query('personId'),
    person: c.req.query('person'),
    wca_scramble: c.req.query('wcaScramble'),
    optimal_scramble: c.req.query('optimalScramble'),
  }, excludeId ? Number(excludeId) : undefined);

  if (!dup) return c.json({ exists: false });

  const rows = await query<{ id: number }>(dup.sql, dup.params);
  if (rows.length > 0) {
    return c.json({ exists: true, id: Number(rows[0].id) });
  }
  return c.json({ exists: false });
});

// ==================== GET /v1/recon/search-solvers ====================

reconRoutes.get('/recon/search-solvers', async (c) => {
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

// ==================== GET /v1/recon/method-cube-history ====================
// 某选手在某项目下,过往复盘用过的方法 / 魔方——去重、按最近一次(id 降序)优先排序。
// /recon/submit 表单用于把 方法/魔方 两个输入框变成"该选手该项目历史值"下拉,
// 首项(最近一次)作为默认填充值。

reconRoutes.get('/recon/method-cube-history', async (c) => {
  const wcaId = (c.req.query('wcaId') ?? '').trim();
  const event = (c.req.query('event') ?? '').trim();
  if (!wcaId || !event) return c.json({ methods: [], cubes: [] });

  const rows = await query<{ method: string | null; cube: string | null }>(
    `SELECT method, cube FROM recons WHERE person_id = ? AND event = ? ORDER BY id DESC`,
    [wcaId, event],
  );

  const methods: string[] = [];
  const cubes: string[] = [];
  const methodSeen = new Set<string>();
  const cubeSeen = new Set<string>();
  for (const r of rows) {
    const m = (r.method ?? '').trim();
    if (m && !methodSeen.has(m)) { methodSeen.add(m); methods.push(m); }
    const cb = (r.cube ?? '').trim();
    if (cb && !cubeSeen.has(cb)) { cubeSeen.add(cb); cubes.push(cb); }
  }

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ methods, cubes });
});

// NOTE: /:id 动态路由移到文件末尾——防止具名路由（/comments, /edits 等）被 :id 捕获
// （Hono LinearRouter 按注册顺序匹配，动态参数路由必须后于所有具名路由）

// ==================== 阶段 2：评论系统 ==

// GET /v1/recon/comments?reconId=xxx
reconRoutes.get('/recon/comments', async (c) => {
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

// POST /v1/recon/comments
reconRoutes.post('/recon/comments', async (c) => {
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

  // 通知:被回复者收「回复」,管理员收「新评论」。两者互斥去重(admin 恰是被回复者时只收回复)。
  // 整段 best-effort —— 通知挂了不能连累已经落库的评论。
  try {
    const { title, link } = await reconNotifyMeta(Number(body.reconId));
    let parentAuthor: string | null = null;
    if (parentId != null) {
      const rows = await query<{ author_id: string }>(
        'SELECT author_id FROM comments WHERE id = ?', [parentId]
      );
      parentAuthor = rows[0]?.author_id ?? null;
    }
    const base = { actorKey: authUser.wcaId, actorName: authUser.name, title, excerpt: content, link };
    if (parentAuthor) {
      await notify({ ...base, kind: 'recon_reply', recipients: [parentAuthor] });
    }
    await notify({
      ...base,
      kind: 'recon_comment',
      recipients: adminRecipients().filter((a) => a !== parentAuthor),
    });
  } catch (e) {
    console.warn('[recon] comment notify failed:', (e as Error).message);
  }

  return c.json({ ok: true, id: Number(result[0].id) });
});

// PUT /v1/recon/comments/:id
reconRoutes.put('/recon/comments/:id', async (c) => {
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

// DELETE /v1/recon/comments/:id —— 删顶层评论时级联删所有回复
reconRoutes.delete('/recon/comments/:id', async (c) => {
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

// PUT /v1/recon/comments/:id/pin —— 管理员置顶 / 取消置顶（每条 recon 只允许一条置顶）
reconRoutes.put('/recon/comments/:id/pin', async (c) => {
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

// GET /v1/recon/edits
reconRoutes.get('/recon/edits', async (c) => {
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

// POST /v1/recon/save-edit
reconRoutes.post('/recon/save-edit', async (c) => {
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  const body = await c.req.json<{ solveId?: string; fields?: Record<string, unknown> }>();
  const { solveId, fields } = body;

  if (!solveId) {
    return c.json({ error: 'solveId is required' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const enriched = { ...fields, _editedAt: now };

  // 字段级合并:PG jsonb || 是浅合并,右覆盖左(等价 MariaDB JSON_MERGE_PATCH 的扁平场景)
  // postgres@3 自带 jsonb 序列化器,这里直接传对象,driver 单次 stringify 即可。
  // 之前手动 JSON.stringify 会被 driver 再编码一次,落地变 jsonb 字符串字面量。
  await query(
    `INSERT INTO edits (solve_id, fields, edited_at) VALUES (?, ?::jsonb, ?)
     ON CONFLICT (solve_id) DO UPDATE SET
       fields = edits.fields || EXCLUDED.fields,
       edited_at = EXCLUDED.edited_at`,
    [solveId, enriched, now]
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

// DELETE /v1/recon/edit/:id
reconRoutes.delete('/recon/edit/:id', async (c) => {
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  await query('DELETE FROM edits WHERE solve_id = ?', [c.req.param('id')]);
  return c.json({ ok: true });
});

// POST /v1/recon/save-history
reconRoutes.post('/recon/save-history', async (c) => {
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

// GET /v1/recon/history?id=xxx
reconRoutes.get('/recon/history', async (c) => {
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

// GET /v1/recon/wca-attempts?compId=xxx&personId=xxx
reconRoutes.get('/recon/wca-attempts', async (c) => {
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

// GET /v1/recon/cubing-attempts?slug=&event=&round=&personId= — 代理 cubing.com 实时直播成绩
// NOTE: 经验观察:cubing.com 数据要么全空要么全填,极少卡在中间态。所以
//   "attempts 全部非 null" 即可作为"该选手该轮已完赛"的判据,可安全长 TTL 缓存到 DB,
//   让第二位用户/设备在 WCA post 之前秒加载。
const CUBING_CACHE_TTL_DAYS = 7;

reconRoutes.get('/recon/cubing-attempts', async (c) => {
  // 优先 compId(WCA 比赛 ID,无横杠):服务端按真实比赛名推 cubing slug,避免无横杠 ID 反推
  // 把内部大写词误拆(GuangzhouGraDUAL3x3I2026 → Guangzhou-Gra-DUAL-... → cubing.com 404)。
  // 仍接受 legacy slug 参数(部署滚动期内未刷新的旧客户端兜底)。
  const compId = c.req.query('compId') ?? '';
  const slugParam = c.req.query('slug') ?? '';
  const event = c.req.query('event') ?? '';
  const round = c.req.query('round') ?? '';
  const personId = c.req.query('personId') ?? '';
  if ((!compId && !slugParam) || !event || !round || !personId) {
    return c.json({ error: 'compId|slug/event/round/personId required' }, 400);
  }
  if ((compId && !/^[A-Za-z0-9]+$/.test(compId)) || (slugParam && !/^[A-Za-z0-9-]+$/.test(slugParam))
      || !/^[A-Za-z0-9]+$/.test(event) || !/^[A-Za-z0-9]+$/.test(round) || !/^[0-9]{4}[A-Z]{4}\d{2}$/.test(personId)) {
    return c.json({ error: 'invalid param format' }, 400);
  }

  // compId → 真实比赛名(本地 WCA dump)→ slug;拿不到名退回启发式;无 compId 用 legacy slug。
  let slug = slugParam;
  if (compId) {
    let name: string | undefined;
    try {
      const rows = await query<{ name: string }>(
        `SELECT name FROM wca_competitions WHERE id = ? LIMIT 1`, [compId],
      );
      name = rows[0]?.name;
    } catch (err) {
      console.error('[cubing-attempts] comp name lookup failed:', err);
    }
    slug = name ? nameToCubingSlug(name) : wcaIdToCubingSlug(compId);
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

// NOTE: WCA 官方比赛 results 已 posted 后基本 immutable —— DB write-through 缓存,
// 让"同轮次还原"在第二位用户/设备上秒加载。30 天 TTL 兼顾偶发的赛后修订(罚时/DNF 调整)。
const WCA_CACHE_TTL_DAYS = 30;

// GET /v1/recon/wca-results?compId=&wcaEvent= — 缓存式代理 WCA results,client 替代直拉
reconRoutes.get('/recon/wca-results', async (c) => {
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

// GET /v1/recon/bili-cover?bvid=xxx
reconRoutes.get('/recon/bili-cover', async (c) => {
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

// GET /v1/recon/douyin-cover?url=https://v.douyin.com/xxx  (或 ?awemeId=123)
// 抖音封面无直链规律,且 share 页是反爬 JS-VM 挑战页,只能服务端代理:
//   1. 短链 v.douyin.com/xxx → 跟 302 Location 取 aweme_id
//   2. www.douyin.com 的 aweme detail web API(免签名)→ 取 origin_cover(首帧)
// 失败一律回 4xx/5xx,client 退回打乱图(与 B 站封面同款降级)。
const DOUYIN_HOST = /(?:^|\.)(douyin\.com|iesdouyin\.com)$/i;
const DOUYIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
function awemeIdFromUrl(u: string): string | null {
  const m = u.match(/(?:video|note|share\/video|share\/slides)\/(\d{6,})/)
    ?? u.match(/[?&](?:item_ids|aweme_id|modal_id|vid)=(\d{6,})/);
  return m ? m[1] : null;
}
reconRoutes.get('/recon/douyin-cover', async (c) => {
  let awemeId = (c.req.query('awemeId') ?? '').trim();
  const url = (c.req.query('url') ?? '').trim();

  try {
    if (!awemeId && url) {
      // SSRF 防护:只允许抖音域名
      let host = '';
      try { host = new URL(url).hostname; } catch { return c.json({ error: 'Invalid url' }, 400); }
      if (!DOUYIN_HOST.test(host)) return c.json({ error: 'Not a douyin url' }, 400);

      awemeId = awemeIdFromUrl(url) ?? '';
      if (!awemeId) {
        // 短链 v.douyin.com/xxx 不含 id,跟一跳 302 拿真实 URL
        const r = await fetch(url, {
          redirect: 'manual',
          headers: { 'User-Agent': DOUYIN_UA },
          signal: AbortSignal.timeout(8000),
        });
        const loc = r.headers.get('location') ?? '';
        awemeId = awemeIdFromUrl(loc) ?? '';
      }
    }
    if (!awemeId || !/^\d{6,}$/.test(awemeId)) {
      return c.json({ error: 'Invalid douyin url' }, 400);
    }

    const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${awemeId}&device_platform=webapp&aid=6383`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': DOUYIN_UA, 'Referer': 'https://www.douyin.com/' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return c.json({ error: 'Douyin API unavailable' }, 502);

    const data = await res.json() as {
      aweme_detail?: { video?: Record<string, { url_list?: string[] }> };
    };
    const v = data?.aweme_detail?.video;
    // origin_cover = 视频首帧(最像缩略图);cover/cover_original_scale 兜底
    const pic = v?.origin_cover?.url_list?.[0]
      ?? v?.cover?.url_list?.[0]
      ?? v?.cover_original_scale?.url_list?.[0];
    if (!pic) return c.json({ error: 'Cover not found' }, 404);

    c.header('Cache-Control', 'public, max-age=86400');
    return c.json({ pic: pic.replace('http://', 'https://') });
  } catch {
    return c.json({ error: 'Douyin API unavailable' }, 502);
  }
});

// GET /v1/recon/resolve-shorturl?url=https://b23.tv/xxx
// 服务端 fetch 不 follow redirect,读 Location 头返回真实 URL
// client 端没法跨域 follow,所以必须服务端代理
reconRoutes.get('/recon/resolve-shorturl', async (c) => {
  const shortUrl = c.req.query('url') ?? '';
  // 只允许 b23.tv (B 站短链);别的短链服务以后要支持再加白名单
  if (!shortUrl || !/^https?:\/\/b23\.tv\//i.test(shortUrl)) {
    return c.json({ error: 'Invalid short url' }, 400);
  }

  try {
    const res = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    const location = res.headers.get('location');
    if (!location) {
      return c.json({ error: 'No redirect' }, 502);
    }
    c.header('Cache-Control', 'public, max-age=86400');
    return c.json({ url: location });
  } catch {
    return c.json({ error: 'Resolve failed' }, 502);
  }
});

// GET /v1/recon/user-stats?wcaId=xxx
reconRoutes.get('/recon/user-stats', async (c) => {
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

// GET /v1/recon/list-persons
reconRoutes.get('/recon/list-persons', async (c) => {
  const rows = await query(
    `SELECT person, person_id, MAX(person_country) AS person_country
     FROM recons WHERE person_id IS NOT NULL AND person IS NOT NULL
     GROUP BY person, person_id ORDER BY person`
  );
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(rows);
});

// ==================== 动态参数路由（必须在所有具名路由之后注册） ====================
// NOTE: /:id 会匹配任何 /v1/recon/xxx 路径，所以具名路由必须先注册

// GET /v1/recon/:id — 获取单条复盘
reconRoutes.get('/recon/:id', async (c) => {
  const id = c.req.param('id');

  const rows = await query('SELECT * FROM recons WHERE id = ?', [id]);
  if (rows.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  // 私享(private):仅添加者本人 + 管理员可取,其余人 403(且携 private 标记,让详情页
  // SSR 能区分「私享」与「不存在」——私享渲染登录门,不存在走 404)。public / unlisted 放行。
  const raw = rows[0] as Record<string, unknown>;
  if (raw.visibility === 'private') {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    const me = await optionalAuth(c);
    const isOwner = !!me && (me.wcaId === raw.added_by_id || ADMIN_WCA_IDS.includes(me.wcaId));
    if (!isOwner) {
      return c.json({ error: 'This reconstruction is private', private: true }, 403);
    }
  }

  const result = rowToJson(raw);

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

// POST /v1/recon — 新增复盘
reconRoutes.post('/recon', async (c) => {
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

  // 同选手 + 同打乱:允许提交,但必须带合法 dup_reason 说明原因(重复打乱 / 不同比赛),
  // 否则拒收(前端 check-duplicate 同口径预警 + 弹出二选一选择器)。占位打乱已在 buildDuplicateQuery 豁免。
  const dup = buildDuplicateQuery(row);
  if (dup) {
    const existing = await query<{ id: number }>(dup.sql, dup.params);
    if (existing.length > 0 && !(DUP_REASONS as readonly string[]).includes(String(row.dup_reason ?? ''))) {
      const dupId = Number(existing[0].id);
      return c.json({
        error: `Duplicate: same player + scramble as reconstruction #${dupId}. Pick a reason to confirm.`,
        existingId: dupId,
        needsReason: true,
      }, 409);
    }
  }

  const { sql, values } = buildInsert('recons', row);
  const inserted = await query<{ id: number }>(sql + ' RETURNING id', values);
  body.id = Number(inserted[0].id);
  return c.json(body);
});

// PUT /v1/recon/:id — 更新复盘
reconRoutes.put('/recon/:id', async (c) => {
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

  // 编辑成与别的复盘同选手 + 同打乱:同样允许,但需合法 dup_reason;排除自身。
  // NOTE: 仅当本次 PUT 带了选手与打乱字段时才判(buildDuplicateQuery 缺字段返回 null)。
  const dup = buildDuplicateQuery(row, Number(id));
  if (dup) {
    const existing = await query<{ id: number }>(dup.sql, dup.params);
    if (existing.length > 0 && !(DUP_REASONS as readonly string[]).includes(String(row.dup_reason ?? ''))) {
      const dupId = Number(existing[0].id);
      return c.json({
        error: `Duplicate: same player + scramble as reconstruction #${dupId}. Pick a reason to confirm.`,
        existingId: dupId,
        needsReason: true,
      }, 409);
    }
  }

  const { sql, values } = buildUpdate('recons', row, 'id', id);
  await query(sql, values);
  return c.json({ ok: true });
});

// DELETE /v1/recon/:id — 删除复盘
reconRoutes.delete('/recon/:id', async (c) => {
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

// POST /v1/recon/:id/alternatives — 追加一条另解
reconRoutes.post('/recon/:id/alternatives', async (c) => {
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

  // 另解没有「被回复者」,只通知管理员。best-effort,不连累已保存的另解。
  try {
    const { title, link } = await reconNotifyMeta(Number(id));
    await notify({
      recipients: adminRecipients(),
      kind: 'recon_alt',
      actorKey: authUser.wcaId,
      actorName: authUser.name,
      title,
      excerpt: solution,
      link,
    });
  } catch (e) {
    console.warn('[recon] alternative notify failed:', (e as Error).message);
  }

  return c.json({ alternatives: alts });
});

// PUT /v1/recon/:id/alternatives/:idx — 改某条另解
reconRoutes.put('/recon/:id/alternatives/:idx', async (c) => {
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

// DELETE /v1/recon/:id/alternatives/:idx — 删某条另解
reconRoutes.delete('/recon/:id/alternatives/:idx', async (c) => {
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

