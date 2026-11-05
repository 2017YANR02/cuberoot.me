import { Hono } from 'hono';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import { generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Doc as YDoc, Map as YMap, encodeStateAsUpdate } from 'yjs';
import { query } from '../db/connection.js';
import {
  ADMIN_WCA_IDS,
  authenticateUser,
  checkRateLimit,
  requireAdmin,
  requireAdminOrApiKey,
  requireAuth,
  type WcaUser,
} from '../utils/recon_helpers.js';
import { documentAccessFor, DOCUMENT_ACCESS_COLUMNS, resolveDocumentAccess, sharingJson, type DocumentAccess, type DocumentRole } from '../documents/access.js';
import { collaborativeDocuments } from '../documents/realtime.js';
import { getIp } from '../utils/analytics_helpers.js';

export const documentRoutes = new Hono();
const NO_STORE = 'no-store';
const MAX_DOCX_BYTES = 20 * 1024 * 1024;
const ROLES = new Set(['editor', 'commenter', 'viewer']);
const KINDS = new Set(['document', 'spreadsheet']);
const MAX_SPREADSHEET_CELLS = 100_000;
const MAX_SPREADSHEET_TEXT = 20_000_000;

type Role = DocumentRole;
type DocumentKind = 'document' | 'spreadsheet';
type DocumentRow = {
  id: string;
  title: string;
  kind: DocumentKind;
  owner_key: string;
  role: Role;
  created_at: Date | string;
  updated_at: Date | string;
};
type MemberRow = {
  user_key: string;
  role: Role;
  display_name: string | null;
  avatar_url: string | null;
  wca_id: string | null;
};
type SubscriptionRow = { subscribed: boolean; last_seen_at: Date | string };

function cleanTitle(value: unknown, fallback = 'Untitled document'): string {
  if (typeof value !== 'string') return fallback;
  const title = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240);
  return title || fallback;
}

function documentJson(row: DocumentRow) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    ownerKey: row.owner_key,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const accessFor = documentAccessFor;
async function canManage(documentId: string, user: WcaUser): Promise<boolean> {
  return (await accessFor(documentId, user))?.canManage ?? false;
}

function initialState(html: string): Uint8Array {
  const document = generateJSON(html, [StarterKit]);
  const ydoc = TiptapTransformer.toYdoc(document, 'default', [StarterKit]);
  return encodeStateAsUpdate(ydoc);
}

type InitialSheet = { name?: unknown; cells?: unknown };

function cleanSheetName(value: unknown, index: number): string {
  if (typeof value !== 'string') return `Sheet ${index + 1}`;
  return value.replace(/[\\/?*\[\]:\u0000-\u001f]/g, '').trim().slice(0, 100) || `Sheet ${index + 1}`;
}

function spreadsheetState(value: unknown): Uint8Array {
  const input = typeof value === 'object' && value ? value as { sheets?: unknown } : {};
  const inputSheets = Array.isArray(input.sheets) ? input.sheets.slice(0, 50) as InitialSheet[] : [];
  const sheets = inputSheets.length ? inputSheets : [{ name: 'Sheet 1', cells: {} }];
  const ydoc = new YDoc();
  const ySheets = ydoc.getArray<YMap<unknown>>('sheets');
  let totalCells = 0;
  let totalText = 0;
  const usedNames = new Set<string>();
  for (const [index, inputSheet] of sheets.entries()) {
    const sheet = new YMap<unknown>();
    const cells = new YMap<string>();
    const styles = new YMap<string>();
    const widths = new YMap<number>();
    const sourceCells = typeof inputSheet?.cells === 'object' && inputSheet.cells ? inputSheet.cells as Record<string, unknown> : {};
    let maxRow = 100;
    let maxColumn = 26;
    for (const [address, raw] of Object.entries(sourceCells)) {
      if (!/^[A-Z]{1,3}[1-9][0-9]{0,3}$/.test(address) || typeof raw !== 'string') continue;
      const match = /^([A-Z]+)(\d+)$/.exec(address)!;
      let column = 0;
      for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
      const row = Number(match[2]);
      if (column > 200 || row > 10_000) continue;
      totalCells += 1;
      if (totalCells > MAX_SPREADSHEET_CELLS) throw new Error('Spreadsheet exceeds 100,000 non-empty cells');
      totalText += raw.length;
      if (totalText > MAX_SPREADSHEET_TEXT) throw new Error('Spreadsheet text exceeds 20,000,000 characters');
      cells.set(address, raw.slice(0, 50_000));
      maxColumn = Math.max(maxColumn, column);
      maxRow = Math.max(maxRow, row);
    }
    const baseName = cleanSheetName(inputSheet?.name, index);
    let sheetName = baseName;
    let suffix = 2;
    while (usedNames.has(sheetName.toLocaleLowerCase())) sheetName = `${baseName.slice(0, 95)} ${suffix++}`;
    usedNames.add(sheetName.toLocaleLowerCase());
    sheet.set('id', crypto.randomUUID());
    sheet.set('name', sheetName);
    sheet.set('rowCount', maxRow);
    sheet.set('columnCount', maxColumn);
    sheet.set('cells', cells);
    sheet.set('styles', styles);
    sheet.set('widths', widths);
    ySheets.push([sheet]);
  }
  return encodeStateAsUpdate(ydoc);
}

async function createDocument(owner: WcaUser, title: string, kind: DocumentKind, state: Uint8Array) {
  const rows = await query<{ id: string }>(
    `WITH inserted AS (
       INSERT INTO collaborative_documents (title, kind, owner_key, ydoc_state)
       VALUES (?, ?, ?, ?) RETURNING id
     )
     INSERT INTO collaborative_document_members (document_id, user_key, role, added_by)
     SELECT id, ?, 'owner', ? FROM inserted
     RETURNING document_id AS id`,
    [title, kind, owner.wcaId, state, owner.wcaId, owner.wcaId],
  );
  return rows[0].id;
}

documentRoutes.get('/documents', async (c) => {
  c.header('Cache-Control', NO_STORE);
  const me = await requireAuth(c);
  const requestedKind = c.req.query('kind');
  const kind = requestedKind && KINDS.has(requestedKind) ? requestedKind as DocumentKind : null;
  const rows = await query<DocumentAccess>(
    `SELECT ${DOCUMENT_ACCESS_COLUMNS} FROM collaborative_documents d
     LEFT JOIN collaborative_document_members m ON m.document_id = d.id AND m.user_key = ?
     WHERE (m.user_key IS NOT NULL OR (d.general_access = 'admins' AND ?::boolean))
       AND (?::text IS NULL OR d.kind = ?)
     ORDER BY d.updated_at DESC`,
    [me.wcaId, me.isAdmin, kind, kind],
  );
  const documents = rows.map(row => resolveDocumentAccess(row, me)).filter(row => row !== null);
  return c.json({ documents: documents.map(documentJson) });
});

documentRoutes.post('/documents', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const me = await requireAdmin(c);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind as DocumentKind : 'document';
  let state: Uint8Array;
  try {
    state = kind === 'spreadsheet' ? spreadsheetState(body.spreadsheet) : initialState('<p></p>');
  } catch (cause) {
    return c.json({ error: cause instanceof Error ? cause.message : 'Invalid spreadsheet' }, 400);
  }
  const fallback = kind === 'spreadsheet' ? 'Untitled spreadsheet' : 'Untitled document';
  const id = await createDocument(me, cleanTitle(body.title, fallback), kind, state);
  return c.json({ id }, 201);
});

documentRoutes.post('/documents/import', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c));
  const caller = await requireAdminOrApiKey(c);
  const form = await c.req.parseBody({ all: false });
  const file = form.file;
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.docx')) {
    return c.json({ error: 'A .docx file is required' }, 400);
  }
  if (file.size === 0 || file.size > MAX_DOCX_BYTES) {
    return c.json({ error: 'DOCX must be between 1 byte and 20 MB' }, 400);
  }

  let owner = caller;
  if (caller.wcaId === '__api_key__') {
    const ownerKey = typeof form.ownerKey === 'string' ? form.ownerKey.trim() : '';
    if (!ADMIN_WCA_IDS.includes(ownerKey)) return c.json({ error: 'Valid admin ownerKey is required' }, 400);
    owner = { wcaId: ownerKey, name: ownerKey, isAdmin: true };
  }

  const converted = await mammoth.convertToHtml({ buffer: Buffer.from(await file.arrayBuffer()) });
  const safeHtml = sanitizeHtml(converted.value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img']),
    allowedAttributes: { a: ['href', 'name'], img: ['src', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'data'],
  });
  const fallback = file.name.replace(/\.docx$/i, '');
  const id = await createDocument(owner, cleanTitle(form.title, fallback), 'document', initialState(safeHtml || '<p></p>'));
  return c.json({ id, warnings: converted.messages.map((message) => message.message) }, 201);
});

documentRoutes.get('/documents/people', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-people', max: 60 });
  await requireAuth(c);
  const q = (c.req.query('q') || '').trim().slice(0, 40);
  if (q.length < 2) return c.json({ people: [] });
  const rows = await query<{ wca_id: string | null; uid: number; display_name: string; avatar_url: string | null }>(
    `SELECT wca_id, id AS uid, display_name, avatar_url FROM app_users
     WHERE display_name ILIKE ? OR wca_id ILIKE ?
     ORDER BY (wca_id IS NOT NULL) DESC, display_name
     LIMIT 8`,
    [`%${q}%`, `${q}%`],
  );
  return c.json({
    people: rows.map((row) => ({
      key: row.wca_id || `u${row.uid}`,
      name: row.display_name || row.wca_id || `u${row.uid}`,
      avatar: row.avatar_url || '',
      wcaId: row.wca_id || '',
    })),
  });
});

documentRoutes.get('/documents/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  const me = await authenticateUser(c.req.header('Authorization'));
  const doc = await accessFor(c.req.param('id'), me);
  if (!doc) return c.json({ error: 'Document not found' }, 404);
  const members = await query<MemberRow>(
    `SELECT m.user_key, m.role, u.display_name, u.avatar_url, u.wca_id
     FROM collaborative_document_members m
     LEFT JOIN LATERAL (
       SELECT display_name, avatar_url, wca_id
       FROM app_users
       WHERE m.user_key = COALESCE(wca_id, 'u' || id::text)
       ORDER BY updated_at DESC, id DESC
       LIMIT 1
     ) u ON TRUE
     WHERE m.document_id = ?
     ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, m.created_at`,
    [doc.id],
  );
  const subscriptions = me ? await query<SubscriptionRow>(
    `SELECT subscribed, last_seen_at FROM collaborative_document_subscriptions
     WHERE document_id = ? AND user_key = ?`,
    [doc.id, me.wcaId],
  ) : [];
  return c.json({
    document: documentJson(doc),
    canManage: doc.canManage,
    canExport: doc.canExport,
    sharing: sharingJson(doc),
    members: members.map((member) => ({
      key: member.user_key,
      name: member.display_name || member.wca_id || member.user_key,
      avatar: member.avatar_url || '',
      role: member.role,
    })),
    subscription: {
      subscribed: subscriptions[0]?.subscribed ?? false,
      lastSeenAt: subscriptions[0]?.last_seen_at ?? null,
    },
  });
});

documentRoutes.put('/documents/:id/subscription', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if (!(await accessFor(id, me))) return c.json({ error: 'Document not found' }, 404);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  if (typeof body.subscribed !== 'boolean') return c.json({ error: 'subscribed must be a boolean' }, 400);
  const rows = await query<SubscriptionRow>(
    `INSERT INTO collaborative_document_subscriptions (document_id, user_key, subscribed, last_seen_at)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT (document_id, user_key) DO UPDATE SET subscribed = EXCLUDED.subscribed, last_seen_at = NOW()
     RETURNING subscribed, last_seen_at`,
    [id, me.wcaId, body.subscribed],
  );
  return c.json({ subscribed: rows[0].subscribed, lastSeenAt: rows[0].last_seen_at });
});

documentRoutes.post('/documents/:id/seen', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-seen', max: 120 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if (!(await accessFor(id, me))) return c.json({ error: 'Document not found' }, 404);
  await query(
    `INSERT INTO collaborative_document_subscriptions (document_id, user_key, subscribed, last_seen_at)
     VALUES (?, ?, FALSE, NOW())
     ON CONFLICT (document_id, user_key) DO UPDATE SET last_seen_at = NOW()`,
    [id, me.wcaId],
  );
  return c.json({ ok: true });
});

documentRoutes.delete('/documents/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  // Ownership is checked in the delete itself; administrators have no bypass.
  // Foreign keys cascade to members and subscriptions. Delayed Yjs stores only
  // UPDATE existing rows, so they cannot recreate a deleted resource.
  const rows = await query<{ id: string }>(
    'DELETE FROM collaborative_documents WHERE id = ? AND owner_key = ? RETURNING id',
    [id, me.wcaId],
  );
  if (!rows.length) return c.json({ error: 'Document not found or not owned by you' }, 404);
  collaborativeDocuments.closeConnections(`document.${id}`);
  return c.json({ ok: true });
});

documentRoutes.patch('/documents/:id', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if ((await accessFor(id, me))?.role !== 'owner') return c.json({ error: 'Cannot edit document settings' }, 403);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const title = cleanTitle(body.title);
  await query('UPDATE collaborative_documents SET title = ? WHERE id = ?', [title, id]);
  return c.json({ ok: true, title });
});

documentRoutes.put('/documents/:id/sharing', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  const access = await accessFor(id, me);
  if (!access?.canManage) return c.json({ error: 'Cannot manage document sharing' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body.access !== 'string' || typeof body.role !== 'string'
    || !['restricted', 'admins', 'anyone'].includes(body.access) || !ROLES.has(body.role)) {
    return c.json({ error: 'Invalid sharing settings' }, 400);
  }
  const owner = access.role === 'owner';
  const flags = ['editorsCanShare', 'editorsCanExport', 'viewersCanExport'] as const;
  const current = sharingJson(access);
  for (const flag of flags) {
    if (body[flag] !== undefined && typeof body[flag] !== 'boolean') return c.json({ error: 'Invalid sharing settings' }, 400);
    if (!owner && body[flag] !== undefined && body[flag] !== current[flag]) return c.json({ error: 'Only the owner can change sharing restrictions' }, 403);
  }
  if (owner) {
    await query(`UPDATE collaborative_documents SET general_access = ?, general_role = ?,
      editors_can_share = ?, editors_can_export = ?, viewers_can_export = ? WHERE id = ?`,
      [body.access, body.role, body.editorsCanShare ?? current.editorsCanShare,
        body.editorsCanExport ?? current.editorsCanExport, body.viewersCanExport ?? current.viewersCanExport, id]);
  } else {
    // Delegates never rewrite owner-only flags, even if those flags changed
    // between the authorization read and this write.
    const updated = await query(`UPDATE collaborative_documents SET general_access = ?, general_role = ?
      WHERE id = ? AND editors_can_share = TRUE RETURNING id`, [body.access, body.role, id]);
    if (!updated.length) return c.json({ error: 'Cannot manage document sharing' }, 403);
  }
  collaborativeDocuments.closeConnections(`document.${id}`);
  return c.json({ ok: true });
});

documentRoutes.post('/documents/:id/members', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if (!(await canManage(id, me))) return c.json({ error: 'Cannot manage document members' }, 403);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const userKey = typeof body.userKey === 'string' ? body.userKey.trim().slice(0, 20) : '';
  const role = typeof body.role === 'string' && ROLES.has(body.role) ? body.role : 'editor';
  if (!userKey || userKey === me.wcaId) return c.json({ error: 'Choose another registered user' }, 400);
  const users = await query<{ found: boolean }>(
    `SELECT TRUE AS found FROM app_users WHERE COALESCE(wca_id, 'u' || id::text) = ? LIMIT 1`,
    [userKey],
  );
  if (!users.length) return c.json({ error: 'User not found' }, 404);
  await query(
    `INSERT INTO collaborative_document_members (document_id, user_key, role, added_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (document_id, user_key) DO UPDATE SET role = EXCLUDED.role, added_by = EXCLUDED.added_by
     WHERE collaborative_document_members.role <> 'owner'`,
    [id, userKey, role, me.wcaId],
  );
  collaborativeDocuments.closeConnections(`document.${id}`);
  return c.json({ ok: true });
});

documentRoutes.patch('/documents/:id/members/:userKey', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if (!(await canManage(id, me))) return c.json({ error: 'Cannot manage document members' }, 403);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  if (typeof body.role !== 'string' || !ROLES.has(body.role)) return c.json({ error: 'Invalid member role' }, 400);
  const rows = await query(
    `UPDATE collaborative_document_members SET role = ?
     WHERE document_id = ? AND user_key = ? AND role <> 'owner' RETURNING user_key`,
    [body.role, id, c.req.param('userKey')],
  );
  if (rows.length) collaborativeDocuments.closeConnections(`document.${id}`);
  return rows.length ? c.json({ ok: true }) : c.json({ error: 'Member not found' }, 404);
});

documentRoutes.delete('/documents/:id/members/:userKey', async (c) => {
  c.header('Cache-Control', NO_STORE);
  checkRateLimit(getIp(c), { bucket: 'document-write', max: 60 });
  const me = await requireAuth(c);
  const id = c.req.param('id');
  if (!(await canManage(id, me))) return c.json({ error: 'Cannot manage document members' }, 403);
  const rows = await query(
    `DELETE FROM collaborative_document_members
     WHERE document_id = ? AND user_key = ? AND role <> 'owner' RETURNING user_key`,
    [id, c.req.param('userKey')],
  );
  return rows.length ? c.json({ ok: true }) : c.json({ error: 'Member not found' }, 404);
});
