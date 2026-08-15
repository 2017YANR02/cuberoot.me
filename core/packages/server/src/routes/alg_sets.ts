/**
 * Alg 公式库 (alg_sets / alg_cases) 路由 — DB 化的标准公式库,
 * 替代曾经的 41 个 `core/packages/shared/data/alg_*.json` 静态文件。
 *
 * 区分:
 *   - 这里(alg_sets.ts):**标准 case**(name / setup / standard / sticker / algs)
 *   - alg.ts(community submissions):**用户额外投稿**叠加在标准 case 之上
 *
 * 路径前缀 /v1/alg/sets/... 跟现有 /v1/alg/:puzzle/:set/submissions 不冲突。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';
import { syncMirrorAndLog, syncMirrorForCase } from '../utils/alg_mirror.js';
import { is3x3TopLayerSet } from '@cuberoot/shared';
import { startsWithYRotation } from '@cuberoot/shared/alg-notation';

export const algSetsRoutes = new Hono();

interface AlgSetRow {
  puzzle: string;
  set_slug: string;
  source: string | null;
  scraped_at: string | Date | null;
  updated_at: string | Date;
}
interface AlgCaseRow {
  id: number | string;
  puzzle: string;
  set_slug: string;
  position: number;
  name: string;
  number: number | null;
  subgroup: string;
  setup: string;
  standard: string | null;
  sticker: unknown;       // JSONB → driver 已反序列化为 JS object
  algs: unknown;
  ori_names: unknown;
  trainer_key: string | null;
  meta: unknown;          // AlgCaseMeta — 只有从站长 1LLL 表导入的 case 才有
  /** 镜像伙伴的 case id(issue #40 T5,0092 迁移加的列)。互指;自镜像指自己。 */
  mirror_case_id: number | string | null;
  updated_at: string | Date;
}

function caseRowToJson(c: AlgCaseRow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: Number(c.id),
    name: c.name,
    subgroup: c.subgroup,
    setup: c.setup,
    sticker: c.sticker,
    algs: c.algs,
  };
  if (c.number !== null) out.number = c.number;
  if (c.standard !== null) out.standard = c.standard;
  if (c.ori_names) out.oriNames = c.ori_names;
  if (c.trainer_key) out.trainerKey = c.trainer_key;
  if (c.meta) out.meta = c.meta;
  if (c.mirror_case_id != null) out.mirrorCaseId = Number(c.mirror_case_id);
  return out;
}

const CASE_NAME_MAX = 128;
const SUBGROUP_MAX = 64;
const TEXT_MAX = 4096;

function containsLeadingY(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsLeadingY);
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (typeof entry.alg === 'string' && startsWithYRotation(entry.alg))
    || (typeof entry.algHtml === 'string' && startsWithYRotation(entry.algHtml));
}

function validateCaseInput(puzzle: string, setSlug: string, body: {
  caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
  sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
}): { error?: string } {
  if (typeof body.caseName !== 'string' || !body.caseName.trim()) return { error: 'caseName required' };
  if (body.caseName.length > CASE_NAME_MAX) return { error: 'caseName too long' };
  if (body.subgroup !== undefined && typeof body.subgroup !== 'string') return { error: 'subgroup must be string' };
  if (body.subgroup && body.subgroup.length > SUBGROUP_MAX) return { error: 'subgroup too long' };
  if (body.setup !== undefined && typeof body.setup !== 'string') return { error: 'setup must be string' };
  if (body.setup && body.setup.length > TEXT_MAX) return { error: 'setup too long' };
  if (body.standard !== undefined && body.standard !== null && typeof body.standard !== 'string') return { error: 'standard must be string or null' };
  if (body.standard && body.standard.length > TEXT_MAX) return { error: 'standard too long' };
  if (!body.sticker || typeof body.sticker !== 'object') return { error: 'sticker required (object)' };
  if (!Array.isArray(body.algs)) return { error: 'algs must be array' };
  if (is3x3TopLayerSet(puzzle, setSlug)
    && ((typeof body.standard === 'string' && startsWithYRotation(body.standard)) || containsLeadingY(body.algs))) {
    return { error: 'leading_y_rotation' };
  }
  return {};
}

// GET /v1/alg/sets — 列所有 (puzzle, set_slug) + 每套 case 数(count)。
// count 是 /alg/progress 学习进度页的分母(已掌握 N / count);站内搜索忽略多余字段。
algSetsRoutes.get('/alg/sets', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<AlgSetRow & { count: number | string }>(
    `SELECT s.puzzle, s.set_slug, s.source, s.scraped_at, s.updated_at,
            COALESCE(cc.n, 0)::int AS count
       FROM alg_sets s
       LEFT JOIN (
         SELECT puzzle, set_slug, COUNT(*) AS n FROM alg_cases GROUP BY puzzle, set_slug
       ) cc ON cc.puzzle = s.puzzle AND cc.set_slug = s.set_slug
      ORDER BY s.puzzle, s.set_slug`
  );
  return c.json(rows.map(r => ({
    puzzle: r.puzzle,
    setSlug: r.set_slug,
    source: r.source,
    scrapedAt: r.scraped_at,
    updatedAt: r.updated_at,
    count: Number(r.count),
  })));
});

// GET /v1/alg/sets/:puzzle/:set — 完整 AlgFile JSON(跟旧 JSON 文件 1:1)
algSetsRoutes.get('/alg/sets/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');

  const sets = await query<AlgSetRow>(
    'SELECT * FROM alg_sets WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  if (sets.length === 0) return c.json({ error: 'Unknown alg set' }, 404);

  const cases = await query<AlgCaseRow>(
    'SELECT * FROM alg_cases WHERE puzzle = ? AND set_slug = ? ORDER BY position ASC',
    [puzzle, set],
  );

  const s = sets[0];
  return c.json({
    scrapedAt: s.scraped_at,
    source: s.source,
    puzzle: s.puzzle,
    set: s.set_slug,
    cases: cases.map(caseRowToJson),
  });
});

// POST /v1/alg/sets/:puzzle/:set/cases — admin 新增 case (append 到末尾)
algSetsRoutes.post('/alg/sets/:puzzle/:set/cases', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const body = await c.req.json<{
    caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
    sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
  }>();
  const v = validateCaseInput(puzzle, set, body);
  if (v.error) return c.json({ error: v.error }, 400);

  const sets = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM alg_sets WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  if (Number(sets[0].count) === 0) return c.json({ error: 'Unknown alg set' }, 404);

  const maxPos = await query<{ max: number | null }>(
    'SELECT MAX(position) AS max FROM alg_cases WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  const nextPos = (maxPos[0].max ?? -1) + 1;

  // postgres@3 自带 jsonb 序列化器 (jsonb 列 / 强 cast 时调 JSON.stringify),
  // 这里直接传对象,driver 单次 stringify 后 PG 解析成 jsonb 对象。
  // 之前手动 JSON.stringify 会被 driver 再编码一次,落地变 jsonb 字符串字面量。
  const inserted = await query<AlgCaseRow>(
    `INSERT INTO alg_cases (
      puzzle, set_slug, position, name, subgroup, setup, standard,
      sticker, algs, ori_names, trainer_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?)
    RETURNING *`,
    [
      puzzle, set, nextPos,
      body.caseName!.trim(), body.subgroup ?? '', body.setup ?? '', body.standard ?? null,
      body.sticker, body.algs,
      body.oriNames ?? null,
      body.trainerKey ?? null,
    ],
  );
  // 新 case 还没有镜像伙伴,这一步现在必然是空转 —— 留着是为了建链脚本跑完之后
  // 「新增 case 时顺手把伙伴那边补上」也能自动成立,不用再回来改一次路由。
  await syncMirrorAndLog(puzzle, set, Number(inserted[0].id));
  return c.json(caseRowToJson(inserted[0]));
});

// PUT /v1/alg/sets/:puzzle/:set/cases/:id — admin 编辑 case
algSetsRoutes.put('/alg/sets/:puzzle/:set/cases/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const body = await c.req.json<{
    caseName?: string; subgroup?: string; setup?: string; standard?: string | null;
    sticker?: unknown; algs?: unknown; oriNames?: unknown; trainerKey?: string | null;
  }>();
  const v = validateCaseInput(puzzle, set, body);
  if (v.error) return c.json({ error: v.error }, 400);

  // 见 POST 注释:对象直接传给 ?::jsonb,driver 序列化一次就够了
  const updated = await query<AlgCaseRow>(
    `UPDATE alg_cases SET
       name = ?, subgroup = ?, setup = ?, standard = ?,
       sticker = ?::jsonb, algs = ?::jsonb,
       ori_names = ?::jsonb, trainer_key = ?
     WHERE id = ? AND puzzle = ? AND set_slug = ?
     RETURNING *`,
    [
      body.caseName!.trim(), body.subgroup ?? '', body.setup ?? '', body.standard ?? null,
      body.sticker, body.algs,
      body.oriNames ?? null,
      body.trainerKey ?? null,
      id, puzzle, set,
    ],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  // 公式改了 → 伙伴那边的自动镜像份重算。case 内拖拽重排走的也是这条 PUT,
  // 所以 §5.5 的「排序传播」不需要单独端点:重算本来就按源顺序排。
  await syncMirrorAndLog(puzzle, set, id);
  return c.json(caseRowToJson(updated[0]));
});

// PUT /v1/alg/sets/:puzzle/:set/reorder — admin 重排 case 顺序
// body: { ids: number[] } —— 必须是该 set 下的全部 case id,新顺序。server 把 position 重写为 0..N-1。
// NOTE: 故意放 /reorder 而非 /cases/order,避免被 PUT /cases/:id 路由捕获(id="order"→NaN→invalid id 400)。
algSetsRoutes.put('/alg/sets/:puzzle/:set/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const body = await c.req.json<{ ids?: unknown }>();
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be array' }, 400);
  const ids: number[] = [];
  for (const x of body.ids) {
    const n = Number(x);
    if (!Number.isInteger(n) || n <= 0) return c.json({ error: 'ids must be positive integers' }, 400);
    ids.push(n);
  }
  if (new Set(ids).size !== ids.length) return c.json({ error: 'ids must be unique' }, 400);

  // 校验:ids 必须正好等于该 set 的全部 case id 集合(避免漏 case)
  const existing = await query<{ id: number | string }>(
    'SELECT id FROM alg_cases WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  const existingSet = new Set(existing.map(r => Number(r.id)));
  if (existingSet.size !== ids.length) {
    return c.json({ error: `expected ${existingSet.size} ids, got ${ids.length}` }, 400);
  }
  for (const id of ids) {
    if (!existingSet.has(id)) return c.json({ error: `id ${id} not in this set` }, 400);
  }

  // 单次 UPDATE FROM VALUES — N 个 UPDATE 合 1 个,200 case reorder 从 ~200ms 降到 ~5ms。
  const valuesSql = ids.map(() => '(?::bigint, ?::int)').join(', ');
  const params: unknown[] = [];
  ids.forEach((id, i) => { params.push(id, i); });
  params.push(puzzle, set);
  await query(
    `UPDATE alg_cases AS a SET position = v.pos
     FROM (VALUES ${valuesSql}) AS v(id, pos)
     WHERE a.id = v.id AND a.puzzle = ? AND a.set_slug = ?`,
    params,
  );

  return c.json({ ok: true });
});

// PUT /v1/alg/sets/:puzzle/:set/mirror-links — admin 建镜像链(issue #40 T5 §5.4)
//
// body: { links: [{ id, mirrorCaseId }], dryRun?: boolean }
//
// `links` 是该 set 的**全量**链表,不是增量:列出的建链,**没列出的一律置 NULL**。
// 这样同一份 `scripts/mirror-link-plan.mts` 的产物重跑多少遍结果都一样,也能靠「从表里拿掉」解链。
//
// 建完链立刻把整个 set 重算一遍公式 —— 生成条是链 + 原创条的函数,链变了公式就得跟着变,
// 而 syncMirrorForCase 平时只在单个 case 保存时触发,建链这一步没人替它跑。
//
// NOTE: 与 /reorder 同理放在 /cases/:id 之前,免得 id="mirror-links" 被那条路由吃掉。
algSetsRoutes.put('/alg/sets/:puzzle/:set/mirror-links', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const body = await c.req.json<{ links?: unknown; dryRun?: unknown }>();
  if (!Array.isArray(body.links)) return c.json({ error: 'links must be array' }, 400);

  const want = new Map<number, number>();
  for (const raw of body.links) {
    const l = raw as { id?: unknown; mirrorCaseId?: unknown };
    const id = Number(l.id);
    const mid = Number(l.mirrorCaseId);
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: `bad id ${String(l.id)}` }, 400);
    if (!Number.isInteger(mid) || mid <= 0) return c.json({ error: `bad mirrorCaseId for id ${id}` }, 400);
    if (want.has(id)) return c.json({ error: `duplicate id ${id}` }, 400);
    want.set(id, mid);
  }

  const rows = await query<{ id: number | string; mirror_case_id: number | string | null }>(
    'SELECT id, mirror_case_id FROM alg_cases WHERE puzzle = ? AND set_slug = ?',
    [puzzle, set],
  );
  if (rows.length === 0) return c.json({ error: 'set has no cases' }, 404);
  const have = new Map(rows.map(r => [Number(r.id), r.mirror_case_id == null ? null : Number(r.mirror_case_id)]));

  // 链必须互指。半条链会让一边生成、另一边不生成,是最难查的那种数据错 —— 入口就拦掉。
  for (const [id, mid] of want) {
    if (!have.has(id)) return c.json({ error: `id ${id} not in ${puzzle}/${set}` }, 400);
    if (!have.has(mid)) return c.json({ error: `mirrorCaseId ${mid} not in ${puzzle}/${set}` }, 400);
    if (want.get(mid) !== id) return c.json({ error: `link ${id}→${mid} is not mutual` }, 400);
  }

  const toSet = [...want].filter(([id, mid]) => have.get(id) !== mid);
  const toClear = [...have].filter(([id, mid]) => mid != null && !want.has(id)).map(([id]) => id);

  if (body.dryRun) {
    return c.json({
      ok: true, dryRun: true, cases: rows.length,
      wouldLink: toSet.length, wouldClear: toClear.length,
    });
  }

  if (toSet.length) {
    const valuesSql = toSet.map(() => '(?::bigint, ?::bigint)').join(', ');
    const params: unknown[] = [];
    for (const [id, mid] of toSet) params.push(id, mid);
    params.push(puzzle, set);
    await query(
      `UPDATE alg_cases AS a SET mirror_case_id = v.mid
       FROM (VALUES ${valuesSql}) AS v(id, mid)
       WHERE a.id = v.id AND a.puzzle = ? AND a.set_slug = ?`,
      params,
    );
  }
  if (toClear.length) {
    await query(
      `UPDATE alg_cases SET mirror_case_id = NULL
       WHERE puzzle = ? AND set_slug = ? AND id IN (${toClear.map(() => '?').join(', ')})`,
      [puzzle, set, ...toClear],
    );
  }

  // 一对只算一次 —— 从伙伴那边再算一遍结果相同,白跑一趟。没建链的也要算,那是「剥掉残留生成条」。
  const algsUpdated: number[] = [];
  const notes: string[] = [];
  const done = new Set<number>();
  for (const id of have.keys()) {
    if (done.has(id)) continue;
    done.add(id);
    const partner = want.get(id);
    if (partner != null) done.add(partner);
    const r = await syncMirrorForCase(puzzle, set, id);
    algsUpdated.push(...r.updated);
    notes.push(...r.notes);
  }

  return c.json({
    ok: true, cases: rows.length,
    linked: toSet.length, cleared: toClear.length,
    algsUpdated: algsUpdated.length, notes,
  });
});

// DELETE /v1/alg/sets/:puzzle/:set/cases/:id — admin 删 case
algSetsRoutes.delete('/alg/sets/:puzzle/:set/cases/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const puzzle = c.req.param('puzzle');
  const set = c.req.param('set');
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  // 伙伴 id 要在删之前问 —— 删完 `ON DELETE SET NULL` 就把那边的链抹掉了,再问就是 null。
  const deleted = await query<{ id: number | string; mirror_case_id: number | string | null }>(
    'DELETE FROM alg_cases WHERE id = ? AND puzzle = ? AND set_slug = ? RETURNING id, mirror_case_id',
    [id, puzzle, set],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);

  // 前伙伴那边留着一批指向已死 case 的生成公式。它的链此刻已被置 NULL,
  // 所以重算走的是「只剥不生成」那条路,正好把孤儿清掉。
  const exPartner = deleted[0].mirror_case_id == null ? null : Number(deleted[0].mirror_case_id);
  if (exPartner != null && exPartner !== id) await syncMirrorAndLog(puzzle, set, exPartner);

  return c.json({ ok: true });
});
