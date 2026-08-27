import { Hono, type Context } from 'hono';
import { isWcaIdFormat } from '@cuberoot/shared/account';
import {
  isPbRecordKey,
  isValidPbResultValue,
  type PbRecordType,
} from '@cuberoot/shared/pb';
import { getIp } from '../utils/analytics_helpers.js';
import { query, sql } from '../db/connection.js';
import { checkRateLimit, requireAuth } from '../utils/recon_helpers.js';

export const pbRoutes = new Hono();

const MAX_RECORDS_PER_USER = 2000;

interface AccountRow {
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  wca_id: string | null;
  is_public: boolean;
}

interface PbRow {
  id: number;
  event_id: string;
  record_type: PbRecordType;
  set_size: number;
  result_value: number;
  happened_on: string;
  cube_name: string;
  comments: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

interface LeaderboardRow extends AccountRow, PbRow {
  rank: number;
}

interface ParsedRecord {
  eventId: string;
  recordType: PbRecordType;
  setSize: number;
  resultValue: number;
  happenedOn: string;
  cubeName: string;
  comments: string;
}

function noStore(c: Context): void {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function parsePositiveInt(raw: string | undefined): number | null {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseRecordKey(eventRaw: unknown, typeRaw: unknown, sizeRaw: unknown): {
  eventId: string;
  recordType: PbRecordType;
  setSize: number;
} | null {
  const eventId = typeof eventRaw === 'string' ? eventRaw.trim() : '';
  const recordType = typeof typeRaw === 'string' ? typeRaw.trim() as PbRecordType : 'single';
  const setSize = Number(sizeRaw);
  if (!isPbRecordKey(eventId, recordType, setSize)) return null;
  return { eventId, recordType, setSize };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf())
    && date.toISOString().slice(0, 10) === value
    && value <= new Date().toISOString().slice(0, 10);
}

export function parsePbRecordBody(body: Record<string, unknown>): ParsedRecord | null {
  const key = parseRecordKey(body.eventId, body.recordType, body.setSize);
  if (!key) return null;
  const resultValue = Number(body.resultValue);
  const happenedOn = typeof body.happenedOn === 'string' ? body.happenedOn.trim() : '';
  if (!isValidPbResultValue(key.eventId, key.recordType, resultValue) || !isIsoDate(happenedOn)) return null;
  const cubeName = typeof body.cubeName === 'string' ? body.cubeName.trim() : '';
  const comments = typeof body.comments === 'string' ? body.comments.trim() : '';
  if (cubeName.length > 120 || comments.length > 1000) return null;
  return { ...key, resultValue, happenedOn, cubeName, comments };
}

function toRecord(row: PbRow) {
  return {
    id: Number(row.id),
    eventId: row.event_id,
    recordType: row.record_type,
    setSize: Number(row.set_size),
    resultValue: Number(row.result_value),
    happenedOn: row.happened_on,
    cubeName: row.cube_name,
    comments: row.comments,
    isCurrent: Boolean(row.is_current),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProfile(row: AccountRow) {
  return {
    userId: Number(row.user_id),
    name: row.display_name,
    avatar: row.avatar_url ?? '',
    wcaId: row.wca_id ?? '',
    isPublic: Boolean(row.is_public),
  };
}

async function accountForOwner(ownerKey: string): Promise<AccountRow | null> {
  const rows = await query<AccountRow>(
    `SELECT id AS user_id, display_name, avatar_url, wca_id,
            COALESCE(p.is_public, TRUE) AS is_public
       FROM app_users u
       LEFT JOIN pb_profiles p
         ON p.owner_key = COALESCE(NULLIF(u.wca_id, ''), 'u' || u.id::text)
      WHERE COALESCE(NULLIF(u.wca_id, ''), 'u' || u.id::text) = ?`,
    [ownerKey],
  );
  return rows[0] ?? null;
}

async function currentRecordsForOwner(ownerKey: string): Promise<PbRow[]> {
  return query<PbRow>(
    `SELECT id, event_id, record_type, set_size, result_value, happened_on,
            cube_name, comments, is_current, created_at, updated_at
       FROM pb_records
      WHERE owner_key = ? AND is_current = TRUE
      ORDER BY event_id, record_type, set_size`,
    [ownerKey],
  );
}

pbRoutes.get('/pb/me', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const account = await accountForOwner(authUser.wcaId);
  if (!account) return c.json({ error: 'account not found; sign in again' }, 409);
  const records = await query<PbRow>(
    `SELECT id, event_id, record_type, set_size, result_value, happened_on,
            cube_name, comments, is_current, created_at, updated_at
       FROM pb_records
      WHERE owner_key = ?
      ORDER BY event_id, record_type, set_size, happened_on DESC, id DESC`,
    [authUser.wcaId],
  );
  return c.json({ profile: toProfile(account), records: records.map(toRecord) });
});

pbRoutes.get('/pb/profile/:userId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const userId = parsePositiveInt(c.req.param('userId'));
  if (!userId) return c.json({ error: 'invalid user id' }, 400);
  const accounts = await query<AccountRow>(
    `SELECT u.id AS user_id, u.display_name, u.avatar_url, u.wca_id,
            COALESCE(p.is_public, TRUE) AS is_public
       FROM app_users u
       LEFT JOIN pb_profiles p
         ON p.owner_key = COALESCE(NULLIF(u.wca_id, ''), 'u' || u.id::text)
      WHERE u.id = ?`,
    [userId],
  );
  const account = accounts[0];
  if (!account || !account.is_public) return c.json({ error: 'profile not found' }, 404);
  const ownerKey = account.wca_id || `u${account.user_id}`;
  const records = await currentRecordsForOwner(ownerKey);
  return c.json({ profile: toProfile(account), records: records.map(toRecord) });
});

pbRoutes.get('/pb/person/:wcaId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const wcaId = c.req.param('wcaId').toUpperCase();
  if (!isWcaIdFormat(wcaId)) return c.json({ error: 'invalid WCA ID' }, 400);
  const account = await accountForOwner(wcaId);
  if (!account || !account.is_public) return c.json({ error: 'profile not found' }, 404);
  const records = await currentRecordsForOwner(wcaId);
  return c.json({ profile: toProfile(account), records: records.map(toRecord) });
});

pbRoutes.get('/pb/leaderboard', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const key = parseRecordKey(
    c.req.query('event'),
    c.req.query('type') ?? 'single',
    c.req.query('size') ?? '1',
  );
  if (!key) return c.json({ error: 'invalid leaderboard filter' }, 400);
  const requestedLimit = Number(c.req.query('limit') ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
  const rows = await query<LeaderboardRow>(
    `SELECT RANK() OVER (ORDER BY r.result_value)::int AS rank,
            u.id AS user_id, u.display_name, u.avatar_url, u.wca_id,
            TRUE AS is_public,
            r.id, r.event_id, r.record_type, r.set_size, r.result_value, r.happened_on,
            r.cube_name, r.comments, r.is_current, r.created_at, r.updated_at
       FROM pb_records r
       JOIN app_users u
         ON COALESCE(NULLIF(u.wca_id, ''), 'u' || u.id::text) = r.owner_key
       LEFT JOIN pb_profiles p ON p.owner_key = r.owner_key
      WHERE r.event_id = ? AND r.record_type = ? AND r.set_size = ?
        AND r.is_current = TRUE AND COALESCE(p.is_public, TRUE) = TRUE
      ORDER BY r.result_value, r.happened_on, r.id
      LIMIT ?`,
    [key.eventId, key.recordType, key.setSize, limit],
  );
  return c.json({
    filter: key,
    rows: rows.map((row) => ({ rank: Number(row.rank), profile: toProfile(row), record: toRecord(row) })),
  });
});

pbRoutes.put('/pb/profile', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let body: { isPublic?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (typeof body.isPublic !== 'boolean') return c.json({ error: 'isPublic must be boolean' }, 400);
  const account = await accountForOwner(authUser.wcaId);
  if (!account) return c.json({ error: 'account not found; sign in again' }, 409);
  await query(
    `INSERT INTO pb_profiles (owner_key, is_public)
     VALUES (?, ?)
     ON CONFLICT (owner_key) DO UPDATE SET is_public = EXCLUDED.is_public`,
    [authUser.wcaId, body.isPublic],
  );
  return c.json({ ok: true, isPublic: body.isPublic });
});

pbRoutes.post('/pb/records', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  let raw: Record<string, unknown>;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const body = parsePbRecordBody(raw);
  if (!body) return c.json({ error: 'invalid PB record' }, 400);
  const account = await accountForOwner(authUser.wcaId);
  if (!account) return c.json({ error: 'account not found; sign in again' }, 409);
  const countRows = await query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM pb_records WHERE owner_key = ?',
    [authUser.wcaId],
  );
  if ((countRows[0]?.n ?? 0) >= MAX_RECORDS_PER_USER) {
    return c.json({ error: 'PB record limit reached' }, 409);
  }

  const inserted = await sql.begin(async (tx) => {
    await tx`INSERT INTO pb_profiles (owner_key) VALUES (${authUser.wcaId}) ON CONFLICT DO NOTHING`;
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`${authUser.wcaId}:${body.eventId}:${body.recordType}:${body.setSize}`}))`;
    const current = await tx<{ id: number; result_value: number; happened_on: string }[]>`
      SELECT id, result_value, happened_on
        FROM pb_records
       WHERE owner_key = ${authUser.wcaId}
         AND event_id = ${body.eventId}
         AND record_type = ${body.recordType}
         AND set_size = ${body.setSize}
         AND is_current = TRUE
       FOR UPDATE`;
    const previous = current[0];
    if (previous && (
      body.resultValue >= Number(previous.result_value)
      || body.happenedOn < String(previous.happened_on)
    )) return null;
    if (previous) await tx`UPDATE pb_records SET is_current = FALSE WHERE id = ${previous.id}`;
    const rows = await tx<PbRow[]>`
      INSERT INTO pb_records (
        owner_key, event_id, record_type, set_size, result_value, happened_on,
        cube_name, comments, is_current
      ) VALUES (
        ${authUser.wcaId}, ${body.eventId}, ${body.recordType}, ${body.setSize},
        ${body.resultValue}, ${body.happenedOn}, ${body.cubeName}, ${body.comments}, TRUE
      )
      RETURNING id, event_id, record_type, set_size, result_value, happened_on,
                cube_name, comments, is_current, created_at, updated_at`;
    return rows[0] ?? null;
  });
  if (!inserted) {
    return c.json({ error: 'new PB must improve the current result without moving the date backwards' }, 409);
  }
  return c.json({ record: toRecord(inserted) }, 201);
});

pbRoutes.delete('/pb/records/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const authUser = await requireAuth(c);
  const id = parsePositiveInt(c.req.param('id'));
  if (!id) return c.json({ error: 'invalid id' }, 400);
  const deleted = await sql.begin(async (tx) => {
    const rows = await tx<Pick<PbRow, 'id' | 'event_id' | 'record_type' | 'set_size' | 'is_current'>[]>`
      DELETE FROM pb_records
       WHERE id = ${id} AND owner_key = ${authUser.wcaId}
       RETURNING id, event_id, record_type, set_size, is_current`;
    const row = rows[0];
    if (!row) return null;
    if (row.is_current) {
      await tx`
        UPDATE pb_records SET is_current = TRUE
         WHERE id = (
           SELECT id FROM pb_records
            WHERE owner_key = ${authUser.wcaId}
              AND event_id = ${row.event_id}
              AND record_type = ${row.record_type}
              AND set_size = ${row.set_size}
            ORDER BY result_value, happened_on DESC, id DESC
            LIMIT 1
         )`;
    }
    return row;
  });
  if (!deleted) return c.json({ error: 'record not found' }, 404);
  return c.json({ ok: true });
});
