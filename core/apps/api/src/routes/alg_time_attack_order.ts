import { Hono } from 'hono';
import { ALG_PUZZLES, getAlgSetMeta, type AlgPuzzle } from '@cuberoot/shared/alg';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';
import { normalizeCaseKeysForSet } from '../utils/sq1_cs.js';

export const algTimeAttackOrderRoutes = new Hono();

const MAX_KEYS = 5000;

function parseScope(raw: string | undefined): string | null {
  const scope = (raw ?? '').trim().toLowerCase();
  if (scope.length > 96 || /[\x00-\x1f\x7f]/.test(scope)) return null;
  return scope;
}

function validCaseKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 128
    && !/[\x00-\x1f]/.test(value);
}

function parseTarget(puzzleRaw: string | undefined, setRaw: string | undefined) {
  const puzzle = (puzzleRaw ?? '').trim().toLowerCase();
  const setSlug = (setRaw ?? '').trim().toLowerCase();
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return null;
  const algPuzzle = puzzle as AlgPuzzle;
  return getAlgSetMeta(algPuzzle, setSlug) ? { puzzle: algPuzzle, setSlug } : null;
}

interface OrderRow {
  case_keys: unknown;
  updated_at: string;
}

algTimeAttackOrderRoutes.get('/alg/time-attack-order/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const target = parseTarget(c.req.param('puzzle'), c.req.param('set'));
  const scope = parseScope(c.req.query('scope'));
  if (!target || scope === null) return c.json({ error: 'invalid target or scope' }, 400);

  const rows = await query<OrderRow>(
    `SELECT case_keys, updated_at
       FROM alg_chain_orders
      WHERE wca_id = ? AND puzzle = ? AND set_slug = ? AND scope = ?`,
    [authUser.wcaId, target.puzzle, target.setSlug, scope],
  );
  const row = rows[0];
  if (!row) return c.json({ keys: [], updatedAt: 0 });
  const keys = normalizeCaseKeysForSet(
    target.puzzle,
    target.setSlug,
    Array.isArray(row.case_keys) ? row.case_keys.filter(validCaseKey) : [],
  );
  return c.json({ keys, updatedAt: Number(row.updated_at) });
});

algTimeAttackOrderRoutes.put('/alg/time-attack-order/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const target = parseTarget(c.req.param('puzzle'), c.req.param('set'));
  const scope = parseScope(c.req.query('scope'));
  if (!target || scope === null) return c.json({ error: 'invalid target or scope' }, 400);

  let body: { keys?: unknown; updatedAt?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (!Array.isArray(body.keys) || body.keys.length === 0 || body.keys.length > MAX_KEYS) {
    return c.json({ error: 'keys required or too many keys' }, 400);
  }
  if (!body.keys.every(validCaseKey) || new Set(body.keys).size !== body.keys.length) {
    return c.json({ error: 'invalid or duplicate case key' }, 400);
  }
  const keys = normalizeCaseKeysForSet(target.puzzle, target.setSlug, body.keys);
  const now = Date.now();
  const rawUpdatedAt = body.updatedAt;
  const updatedAt = typeof rawUpdatedAt === 'number'
    && Number.isSafeInteger(rawUpdatedAt)
    && rawUpdatedAt > 0
    && rawUpdatedAt <= now + 300_000
    ? rawUpdatedAt
    : now;

  await query(
    `INSERT INTO alg_chain_orders (wca_id, puzzle, set_slug, scope, case_keys, updated_at)
     VALUES (?, ?, ?, ?, ?::jsonb, ?)
     ON CONFLICT (wca_id, puzzle, set_slug, scope) DO UPDATE
       SET case_keys = EXCLUDED.case_keys, updated_at = EXCLUDED.updated_at
     WHERE alg_chain_orders.updated_at <= EXCLUDED.updated_at`,
    [authUser.wcaId, target.puzzle, target.setSlug, scope, keys, updatedAt],
  );
  return c.json({ ok: true, updatedAt });
});
