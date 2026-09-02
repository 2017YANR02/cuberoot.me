import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type postgres from 'postgres';
import { sql } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { checkRateLimit, requireAdmin } from '../utils/recon_helpers.js';

export const privateVaultRoutes = new Hono();

type Tx = postgres.TransactionSql;

const MAX_CIPHERTEXT_BYTES = 2 * 1024 * 1024;
const MAX_RECIPIENTS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const vaultBodyLimit = bodyLimit({
  maxSize: MAX_CIPHERTEXT_BYTES + 128 * 1024,
  onError: (c) => c.json({ error: 'payload too large' }, 413),
});

interface KeyRow {
  user_id: number | string;
  public_key: JsonWebKey;
  encrypted_private_key: Record<string, unknown>;
}

interface ItemRow {
  id: string;
  owner_user_id: number | string;
  owner_name: string;
  ciphertext: string;
  iv: string;
  version: number | string;
  updated_at: string;
  wrapped_key: string;
}

interface ShareRow {
  item_id: string;
  user_id: number | string;
  display_name: string;
  public_key: JsonWebKey;
}

interface AccessInput {
  userId: number;
  wrappedKey: string;
}

interface PrivateEnvelopeInput {
  version: number;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  recovery: {
    version: number;
    iv: string;
    ciphertext: string;
  };
}

interface VaultPublicKeyInput {
  kty: 'RSA';
  alg: 'RSA-OAEP-256';
  ext: true;
  e: 'AQAB';
  n: string;
}

function noStore(c: { header: (name: string, value: string) => void }): void {
  c.header('Cache-Control', 'no-store');
}

function isBase64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    && value.length % 4 === 0 && BASE64_RE.test(value);
}

function validPublicKey(value: unknown): value is VaultPublicKeyInput {
  if (!value || typeof value !== 'object') return false;
  const key = value as JsonWebKey;
  return key.kty === 'RSA' && key.alg === 'RSA-OAEP-256' && key.ext === true
    && key.e === 'AQAB' && isBase64Url(key.n, 800);
}

function isBase64Url(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function validPrivateEnvelope(value: unknown): value is PrivateEnvelopeInput {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  const recovery = envelope.recovery as Record<string, unknown> | null;
  return envelope.version === 1 && envelope.iterations === 600_000
    && isBase64(envelope.salt, 64) && isBase64(envelope.iv, 32)
    && isBase64(envelope.ciphertext, 16_384)
    && recovery?.version === 1 && isBase64(recovery.iv, 32)
    && isBase64(recovery.ciphertext, 16_384);
}

function parseAccesses(value: unknown, ownerUserId: number): AccessInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RECIPIENTS) return null;
  const accesses: AccessInput[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const userId = Number(item.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0 || seen.has(userId)
      || !isBase64(item.wrappedKey, 1024)) return null;
    seen.add(userId);
    accesses.push({ userId, wrappedKey: item.wrappedKey });
  }
  return seen.has(ownerUserId) ? accesses : null;
}

function parseItemBody(value: unknown, ownerUserId: number): {
  ciphertext: string;
  iv: string;
  accesses: AccessInput[];
  expectedVersion: number | null;
} | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (!isBase64(body.ciphertext, 2_800_000) || Buffer.byteLength(body.ciphertext, 'utf8') > MAX_CIPHERTEXT_BYTES
    || !isBase64(body.iv, 32)) return null;
  const accesses = parseAccesses(body.accesses, ownerUserId);
  if (!accesses) return null;
  const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
  if (expectedVersion != null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) return null;
  return { ciphertext: body.ciphertext, iv: body.iv, accesses, expectedVersion };
}

async function requireVaultOwner(c: Parameters<typeof requireAdmin>[0]): Promise<number> {
  await requireAdmin(c);
  return requireAppUserId(c);
}

async function recipientsExist(tx: Tx, accesses: AccessInput[]): Promise<boolean> {
  const ids = accesses.map((access) => access.userId);
  const rows = await tx<{ user_id: number | string }[]>`
    SELECT keys.user_id
     FROM vault_user_keys keys
     WHERE keys.user_id = ANY(${ids}::bigint[])`;
  return rows.length === ids.length;
}

privateVaultRoutes.get('/vault', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-read', max: 120 });
  const userId = await requireAppUserId(c);
  const [keyRows, itemRows, shareRows] = await Promise.all([
    sql<KeyRow[]>`
      SELECT user_id, public_key, encrypted_private_key
        FROM vault_user_keys
       WHERE user_id = ${userId}`,
    sql<ItemRow[]>`
      SELECT item.id, item.owner_user_id, owner.display_name AS owner_name,
             item.ciphertext, item.iv, item.version, item.updated_at, access.wrapped_key
        FROM vault_item_access access
        JOIN vault_items item ON item.id = access.item_id
        JOIN app_users owner ON owner.id = item.owner_user_id
       WHERE access.recipient_user_id = ${userId}
       ORDER BY item.updated_at DESC, item.id`,
    sql<ShareRow[]>`
      SELECT access.item_id, recipient.id AS user_id, recipient.display_name, keys.public_key
        FROM vault_item_access access
        JOIN vault_items item ON item.id = access.item_id
        JOIN app_users recipient ON recipient.id = access.recipient_user_id
        JOIN vault_user_keys keys ON keys.user_id = recipient.id
       WHERE item.owner_user_id = ${userId}
         AND access.recipient_user_id <> ${userId}
       ORDER BY lower(recipient.display_name), recipient.id`,
  ]);
  const shares = new Map<string, { userId: number; name: string; publicKey: JsonWebKey }[]>();
  for (const row of shareRows) {
    const list = shares.get(row.item_id) ?? [];
    list.push({ userId: Number(row.user_id), name: row.display_name, publicKey: row.public_key });
    shares.set(row.item_id, list);
  }
  return c.json({
    userId,
    keyProfile: keyRows[0] ? {
      publicKey: keyRows[0].public_key,
      encryptedPrivateKey: keyRows[0].encrypted_private_key,
    } : null,
    items: itemRows.map((row) => ({
      id: row.id,
      ownerUserId: Number(row.owner_user_id),
      ownerName: row.owner_name,
      ciphertext: row.ciphertext,
      iv: row.iv,
      version: Number(row.version),
      updatedAt: row.updated_at,
      wrappedKey: row.wrapped_key,
      shares: shares.get(row.id) ?? [],
    })),
  });
});

privateVaultRoutes.put('/vault/key', vaultBodyLimit, async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-write', max: 30 });
  const userId = await requireAppUserId(c);
  const body = await c.req.json<unknown>().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid key profile' }, 400);
  const input = body as Record<string, unknown>;
  if (!validPublicKey(input.publicKey) || !validPrivateEnvelope(input.encryptedPrivateKey)) {
    return c.json({ error: 'invalid key profile' }, 400);
  }
  const rows = await sql`
    INSERT INTO vault_user_keys (user_id, public_key, encrypted_private_key)
    VALUES (${userId}, ${sql.json({ ...input.publicKey })}, ${sql.json({ ...input.encryptedPrivateKey })})
    ON CONFLICT (user_id) DO UPDATE
      SET encrypted_private_key = EXCLUDED.encrypted_private_key
      WHERE vault_user_keys.public_key = EXCLUDED.public_key
        AND vault_user_keys.encrypted_private_key->'recovery' = EXCLUDED.encrypted_private_key->'recovery'
    RETURNING user_id`;
  if (!rows.length) return c.json({ error: 'vault key profile mismatch' }, 409);
  return c.json({ ok: true });
});

privateVaultRoutes.get('/vault/users', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-user-search', max: 60 });
  const ownerUserId = await requireVaultOwner(c);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (q.length < 2 && !/^\d+$/.test(q)) return c.json({ users: [] });
  const numericId = /^\d+$/.test(q) && Number.isSafeInteger(Number(q)) ? Number(q) : null;
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await sql<{
    id: number | string;
    display_name: string;
    wca_id: string | null;
    public_key: JsonWebKey | null;
  }[]>`
    SELECT users.id, users.display_name, users.wca_id, keys.public_key
     FROM app_users users
      LEFT JOIN vault_user_keys keys ON keys.user_id = users.id
     WHERE users.id <> ${ownerUserId}
       AND (
         (${numericId}::bigint IS NOT NULL AND users.id = ${numericId})
         OR users.display_name ILIKE ${like} ESCAPE '\\'
         OR users.wca_id ILIKE ${like} ESCAPE '\\'
       )
     ORDER BY CASE WHEN users.id = ${numericId} THEN 0 ELSE 1 END,
              CASE WHEN lower(users.display_name) = lower(${q}) THEN 0 ELSE 1 END,
              lower(users.display_name), users.id
     LIMIT 20`;
  return c.json({
    users: rows.map((row) => ({
      userId: Number(row.id),
      name: row.display_name,
      wcaId: row.wca_id,
      publicKey: row.public_key,
    })),
  });
});

privateVaultRoutes.post('/vault/items', vaultBodyLimit, async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-write', max: 30 });
  const ownerUserId = await requireVaultOwner(c);
  const input = parseItemBody(await c.req.json<unknown>().catch(() => null), ownerUserId);
  if (!input || input.expectedVersion != null) return c.json({ error: 'invalid encrypted item' }, 400);
  const result = await sql.begin(async (tx) => {
    if (!await recipientsExist(tx, input.accesses)) return null;
    const rows = await tx<{ id: string; version: number | string; updated_at: string }[]>`
      INSERT INTO vault_items (owner_user_id, ciphertext, iv, byte_size)
      VALUES (${ownerUserId}, ${input.ciphertext}, ${input.iv}, ${Buffer.byteLength(input.ciphertext, 'utf8')})
      RETURNING id, version, updated_at`;
    for (const access of input.accesses) {
      await tx`
        INSERT INTO vault_item_access (item_id, recipient_user_id, wrapped_key)
        VALUES (${rows[0].id}, ${access.userId}, ${access.wrappedKey})`;
    }
    return rows[0];
  });
  if (!result) return c.json({ error: 'recipient is unavailable' }, 409);
  return c.json({ id: result.id, version: Number(result.version), updatedAt: result.updated_at }, 201);
});

privateVaultRoutes.put('/vault/items/:id', vaultBodyLimit, async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-write', max: 30 });
  const ownerUserId = await requireVaultOwner(c);
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'invalid item id' }, 400);
  const input = parseItemBody(await c.req.json<unknown>().catch(() => null), ownerUserId);
  if (!input || input.expectedVersion == null) return c.json({ error: 'invalid encrypted item' }, 400);
  const result = await sql.begin(async (tx) => {
    const current = await tx<{ version: number | string }[]>`
      SELECT version FROM vault_items
       WHERE id = ${id} AND owner_user_id = ${ownerUserId}
       FOR UPDATE`;
    if (!current.length) return { state: 'missing' as const };
    if (Number(current[0].version) !== input.expectedVersion) return { state: 'conflict' as const };
    if (!await recipientsExist(tx, input.accesses)) return { state: 'recipient' as const };
    const rows = await tx<{ version: number | string; updated_at: string }[]>`
      UPDATE vault_items
         SET ciphertext = ${input.ciphertext}, iv = ${input.iv},
             byte_size = ${Buffer.byteLength(input.ciphertext, 'utf8')}, version = version + 1
       WHERE id = ${id}
       RETURNING version, updated_at`;
    await tx`DELETE FROM vault_item_access WHERE item_id = ${id}`;
    for (const access of input.accesses) {
      await tx`
        INSERT INTO vault_item_access (item_id, recipient_user_id, wrapped_key)
        VALUES (${id}, ${access.userId}, ${access.wrappedKey})`;
    }
    return { state: 'ok' as const, row: rows[0] };
  });
  if (result.state === 'missing') return c.json({ error: 'item not found' }, 404);
  if (result.state === 'conflict') return c.json({ error: 'item changed in another tab' }, 409);
  if (result.state === 'recipient') return c.json({ error: 'recipient is unavailable' }, 409);
  return c.json({ version: Number(result.row.version), updatedAt: result.row.updated_at });
});

privateVaultRoutes.delete('/vault/items/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'private-vault-write', max: 30 });
  const ownerUserId = await requireVaultOwner(c);
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) return c.json({ error: 'invalid item id' }, 400);
  const rows = await sql`
    DELETE FROM vault_items
     WHERE id = ${id} AND owner_user_id = ${ownerUserId}
     RETURNING id`;
  if (!rows.length) return c.json({ error: 'item not found' }, 404);
  return c.json({ ok: true });
});
