import { Hono } from 'hono';
import { ALG_PUZZLES, getAlgSetMeta, type AlgPuzzle } from '@cuberoot/shared/alg';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';

export const algPreferredAlgsRoutes = new Hono();

const MAX_ITEMS = 5000;

function parseTarget(puzzleRaw: string | undefined, setRaw: string | undefined) {
  const puzzle = (puzzleRaw ?? '').trim().toLowerCase();
  const setSlug = (setRaw ?? '').trim().toLowerCase();
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return null;
  const algPuzzle = puzzle as AlgPuzzle;
  return getAlgSetMeta(algPuzzle, setSlug) ? { puzzle: algPuzzle, setSlug } : null;
}

function parseItems(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_ITEMS) return null;
  const items: Record<string, string> = {};
  for (const [slot, ref] of entries) {
    if (slot.length < 1 || slot.length > 192 || /[\x00-\x1f\x7f]/.test(slot)) return null;
    if (typeof ref !== 'string' || ref.length < 1 || ref.length > 4096 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(ref)) return null;
    items[slot] = ref;
  }
  return items;
}

interface PreferredRow {
  items: unknown;
  updated_at: string;
}

algPreferredAlgsRoutes.get('/alg/preferred-algs/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const target = parseTarget(c.req.param('puzzle'), c.req.param('set'));
  if (!target) return c.json({ error: 'invalid target' }, 400);

  const rows = await query<PreferredRow>(
    `SELECT items, updated_at
       FROM alg_preferred_algs
      WHERE wca_id = ? AND puzzle = ? AND set_slug = ?`,
    [authUser.wcaId, target.puzzle, target.setSlug],
  );
  const row = rows[0];
  if (!row) return c.json({ items: {}, updatedAt: 0 });
  return c.json({ items: parseItems(row.items) ?? {}, updatedAt: Number(row.updated_at) });
});

algPreferredAlgsRoutes.put('/alg/preferred-algs/:puzzle/:set', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const target = parseTarget(c.req.param('puzzle'), c.req.param('set'));
  if (!target) return c.json({ error: 'invalid target' }, 400);

  let body: { items?: unknown; updatedAt?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const items = parseItems(body.items);
  if (!items) return c.json({ error: 'invalid or too many preferred algorithms' }, 400);

  const now = Date.now();
  const updatedAt = typeof body.updatedAt === 'number'
    && Number.isSafeInteger(body.updatedAt)
    && body.updatedAt > 0
    && body.updatedAt <= now + 300_000
    ? body.updatedAt
    : now;

  await query(
    `INSERT INTO alg_preferred_algs (wca_id, puzzle, set_slug, items, updated_at)
     VALUES (?, ?, ?, ?::jsonb, ?)
     ON CONFLICT (wca_id, puzzle, set_slug) DO UPDATE
       SET items = EXCLUDED.items, updated_at = EXCLUDED.updated_at
     WHERE alg_preferred_algs.updated_at <= EXCLUDED.updated_at`,
    [authUser.wcaId, target.puzzle, target.setSlug, items, updatedAt],
  );
  return c.json({ ok: true, updatedAt });
});
