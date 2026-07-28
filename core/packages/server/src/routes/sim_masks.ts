/**
 * /v1/sim-masks — /sim 阶段遮罩下拉的管理员自定义(覆盖层 + 自建遮罩)。
 *   - GET    /v1/sim-masks            — 全表(public,60s cache),前端一次拉完自己按阶过滤
 *   - PUT    /v1/sim-masks            — admin upsert by maskKey(改标签 / 显隐 / 存自建遮罩)
 *   - PUT    /v1/sim-masks/reorder    — admin 重排,body { cubeSize, keys: string[] }(该阶全量)
 *   - DELETE /v1/sim-masks/:key       — admin 删(builtin 行 = 恢复代码默认;custom 行 = 删遮罩)
 *
 * 清单本体在客户端代码里,这里只存「管理员改过什么」;没有行 = 完全按代码默认渲染。
 * reorder 要求传该阶段全量 keys(与 pattern_examples 一致):position 只在有行时才生效,
 * 传半截会让没行的条目按代码顺序插在后面,顺序看着就不是管理员摆的那个。
 * Schema 见 migrations/0095_sim_masks.sql。
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const simMasksRoutes = new Hono();

/** 下拉里的阶段名(引擎阶段 / visualcube mask id)或自建遮罩 key(前缀 `preset:`)。 */
const KEY_RE = /^[A-Za-z0-9_:.-]{1,80}$/;
/** mask-core 贴纸清单:`U:0,2;F:3-5`(面序 U R F D L B),与 /sim ?stickeringMask= 同一份。 */
const SIDS_RE = /^(?:[URFDLB]:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?:;[URFDLB]:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)*$/;
const TREATMENTS = new Set(['regular', 'dim', 'ignored', 'outline']);
const KINDS = new Set(['builtin', 'custom']);
const LABEL_MAX = 60;
const SIZE_MIN = 2;
const SIZE_MAX = 9;

interface MaskRow {
  id: number | string;
  mask_key: string;
  kind: string;
  cube_size: number;
  position: number;
  hidden: boolean;
  label_en: string;
  label_zh: string;
  sids: string;
  pick: string;
  rest: string;
}

function rowToJson(r: MaskRow) {
  return {
    id: Number(r.id),
    maskKey: r.mask_key,
    kind: r.kind,
    cubeSize: Number(r.cube_size),
    position: Number(r.position),
    hidden: r.hidden,
    labelEn: r.label_en,
    labelZh: r.label_zh,
    sids: r.sids,
    pick: r.pick,
    rest: r.rest,
  };
}

interface MaskInput {
  maskKey?: unknown;
  kind?: unknown;
  cubeSize?: unknown;
  hidden?: unknown;
  labelEn?: unknown;
  labelZh?: unknown;
  sids?: unknown;
  pick?: unknown;
  rest?: unknown;
}

interface Normalized {
  maskKey: string; kind: 'builtin' | 'custom'; cubeSize: number; hidden: boolean;
  labelEn: string; labelZh: string; sids: string; pick: string; rest: string;
}

function normalize(b: MaskInput): { error: string } | { value: Normalized } {
  if (typeof b.maskKey !== 'string' || !KEY_RE.test(b.maskKey)) return { error: 'maskKey malformed' };
  const kind = typeof b.kind === 'string' && KINDS.has(b.kind) ? b.kind : 'builtin';
  const cubeSize = Number(b.cubeSize ?? 3);
  if (!Number.isInteger(cubeSize) || cubeSize < SIZE_MIN || cubeSize > SIZE_MAX) {
    return { error: `cubeSize must be ${SIZE_MIN}..${SIZE_MAX}` };
  }
  for (const k of ['labelEn', 'labelZh'] as const) {
    if (b[k] != null && typeof b[k] !== 'string') return { error: `${k} must be string` };
    if (((b[k] as string) ?? '').length > LABEL_MAX) return { error: `${k} too long (max ${LABEL_MAX})` };
  }
  const sids = typeof b.sids === 'string' ? b.sids.trim() : '';
  if (sids && !SIDS_RE.test(sids)) return { error: 'sids malformed' };
  // 自建遮罩没有贴纸清单 = 一枚都不亮,存了就是个死选项 —— 入口拦掉
  if (kind === 'custom' && !sids) return { error: 'sids required for custom masks' };
  const pick = typeof b.pick === 'string' && TREATMENTS.has(b.pick) ? b.pick : 'regular';
  const rest = typeof b.rest === 'string' && TREATMENTS.has(b.rest) ? b.rest : 'ignored';
  const labelEn = (((b.labelEn as string) ?? '')).trim();
  const labelZh = (((b.labelZh as string) ?? '')).trim();
  // 自建遮罩必须有名字(内置条目留空 = 沿用代码里的标签)
  if (kind === 'custom' && !labelEn && !labelZh) return { error: 'label required for custom masks' };
  return { value: { maskKey: b.maskKey, kind: kind as 'builtin' | 'custom', cubeSize, hidden: b.hidden === true, labelEn, labelZh, sids, pick, rest } };
}

const COLS = 'id, mask_key, kind, cube_size, position, hidden, label_en, label_zh, sids, pick, rest';

// GET /v1/sim-masks — 全表(public)
simMasksRoutes.get('/sim-masks', async (c) => {
  c.header('Cache-Control', 'public, max-age=60');
  const rows = await query<MaskRow>(`SELECT ${COLS} FROM sim_masks ORDER BY cube_size, position, id`);
  return c.json(rows.map(rowToJson));
});

// PUT /v1/sim-masks/reorder — body { cubeSize, keys: string[] }(该阶全量,顺序即 position)
// 放在 upsert 之后无所谓(路径不同),但放在 /:key 之前避免被 DELETE 之外的通配捕获。
simMasksRoutes.put('/sim-masks/reorder', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const body = await c.req.json<{ cubeSize?: unknown; keys?: unknown }>();
  const cubeSize = Number(body.cubeSize ?? 3);
  if (!Number.isInteger(cubeSize) || cubeSize < SIZE_MIN || cubeSize > SIZE_MAX) {
    return c.json({ error: `cubeSize must be ${SIZE_MIN}..${SIZE_MAX}` }, 400);
  }
  if (!Array.isArray(body.keys) || body.keys.length === 0) return c.json({ error: 'keys must be a non-empty array' }, 400);
  const keys: string[] = [];
  for (const x of body.keys) {
    if (typeof x !== 'string' || !KEY_RE.test(x)) return c.json({ error: 'keys malformed' }, 400);
    keys.push(x);
  }
  if (new Set(keys).size !== keys.length) return c.json({ error: 'keys must be unique' }, 400);

  // 没行的条目先建一行纯覆盖(标签空 = 用代码默认),这样整段顺序才由表说话。
  const valuesSql = keys.map(() => '(?, ?::int, ?::int)').join(', ');
  const params: unknown[] = [];
  keys.forEach((k, i) => { params.push(k, cubeSize, i); });
  await query(
    `INSERT INTO sim_masks (mask_key, cube_size, position)
     VALUES ${valuesSql}
     ON CONFLICT (mask_key) DO UPDATE SET position = EXCLUDED.position, updated_at = NOW()`,
    params,
  );
  return c.json({ ok: true, count: keys.length });
});

// PUT /v1/sim-masks — upsert by mask_key(admin)
simMasksRoutes.put('/sim-masks', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const n = normalize(await c.req.json<MaskInput>());
  if ('error' in n) return c.json({ error: n.error }, 400);
  const v = n.value;

  // position 一律不碰(新行 -1 = 还没排过,老行保持):排序是 /reorder 的专属职责,
  // 否则「藏一下」这种纯覆盖写入会把条目挪位置。
  const rows = await query<MaskRow>(
    `INSERT INTO sim_masks (mask_key, kind, cube_size, hidden, label_en, label_zh, sids, pick, rest)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (mask_key) DO UPDATE SET
       kind = EXCLUDED.kind, cube_size = EXCLUDED.cube_size, hidden = EXCLUDED.hidden,
       label_en = EXCLUDED.label_en, label_zh = EXCLUDED.label_zh,
       sids = EXCLUDED.sids, pick = EXCLUDED.pick, rest = EXCLUDED.rest, updated_at = NOW()
     RETURNING ${COLS}`,
    [v.maskKey, v.kind, v.cubeSize, v.hidden, v.labelEn, v.labelZh, v.sids, v.pick, v.rest],
  );
  return c.json(rowToJson(rows[0]));
});

// DELETE /v1/sim-masks/:key — builtin 行 = 恢复代码默认;custom 行 = 删掉这条自建遮罩
simMasksRoutes.delete('/sim-masks/:key', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const key = decodeURIComponent(c.req.param('key'));
  if (!KEY_RE.test(key)) return c.json({ error: 'maskKey malformed' }, 400);
  const deleted = await query<{ id: number | string }>(
    'DELETE FROM sim_masks WHERE mask_key = ? RETURNING id', [key],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
