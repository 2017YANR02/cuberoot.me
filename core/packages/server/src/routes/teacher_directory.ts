/**
 * /teachers 公开名录。条目直接上线：本人可改自己的，管理员可改全部。
 * 将来如改成仅会员可投稿，只需收紧 requireDirectoryEditor 的非管理员分支。
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import {
  ADMIN_WCA_IDS,
  checkRateLimit,
  requireAdminOrApiKey,
  requireAuth,
  type WcaUser,
} from '../utils/recon_helpers.js';

export const teacherDirectoryRoutes = new Hono();

type EntryKind = 'teacher' | 'organization';
type TeachingMode = 'online' | 'in_person' | 'both';
type ImageKind = 'portrait' | 'organization' | 'teaching' | 'other';
interface DirectoryImage {
  id: number;
  kind: ImageKind;
  captionZh: string;
  captionEn: string;
}
const CONTACT_KEYS = [
  'wechat', 'qq', 'email', 'phone', 'youtube', 'bilibili', 'douyin', 'kuaishou',
  'xiaohongshu', 'wechatChannels', 'facebook', 'other',
] as const;
type ContactKey = typeof CONTACT_KEYS[number];
type DirectoryContacts = Partial<Record<ContactKey, string>>;
const URL_CONTACT_KEYS = new Set<ContactKey>([
  'youtube', 'bilibili', 'douyin', 'kuaishou', 'xiaohongshu', 'facebook',
]);

interface DirectoryDraft {
  kind: EntryKind;
  nameZh: string;
  nameEn: string;
  locationZh: string;
  locationEn: string;
  descriptionZh: string;
  descriptionEn: string;
  specialtiesZh: string[];
  specialtiesEn: string[];
  teachingMode: TeachingMode;
  contacts: DirectoryContacts;
  images: DirectoryImage[];
  contact: string;
  website: string;
  wcaId: string;
  isCurated: boolean;
  isVisible: boolean;
}

interface DirectoryRow {
  id: number | string;
  kind: EntryKind;
  name_zh: string;
  name_en: string;
  location_zh: string;
  location_en: string;
  description_zh: string;
  description_en: string;
  specialties_zh: string[] | null;
  specialties_en: string[] | null;
  teaching_mode: TeachingMode;
  contacts: DirectoryContacts | null;
  images: DirectoryImage[] | null;
  contact: string;
  website: string;
  wca_id: string | null;
  is_curated: boolean;
  is_visible: boolean;
  owner_key: string;
  owner_name: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, kind, name_zh, name_en, location_zh, location_en,
  description_zh, description_en, specialties_zh, specialties_en, teaching_mode,
  contacts, images, contact, website, wca_id, is_curated, is_visible, owner_key, owner_name, created_at, updated_at`;
const KINDS: readonly EntryKind[] = ['teacher', 'organization'];
const MODES: readonly TeachingMode[] = ['online', 'in_person', 'both'];
const IMAGE_KINDS: readonly ImageKind[] = ['portrait', 'organization', 'teaching', 'other'];

function noStore(c: { header: (key: string, value: string) => void }): void {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const tag = cleanText(item, 50);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length === 8) break;
  }
  return result;
}

function cleanContacts(value: unknown, legacyContact = ''): DirectoryContacts {
  const contacts: DirectoryContacts = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>;
    for (const key of CONTACT_KEYS) {
      const contactValue = cleanText(source[key], 500);
      if (contactValue) contacts[key] = contactValue;
    }
  }
  if (Object.keys(contacts).length === 0 && legacyContact) {
    contacts.other = cleanText(legacyContact, 500);
  }
  return contacts;
}

function cleanImages(value: unknown): DirectoryImage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: DirectoryImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const id = Number(source.id);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      kind: IMAGE_KINDS.includes(source.kind as ImageKind) ? source.kind as ImageKind : 'other',
      captionZh: cleanText(source.captionZh, 160),
      captionEn: cleanText(source.captionEn, 160),
    });
    if (result.length === 8) break;
  }
  return result;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readDraft(
  body: Partial<DirectoryDraft>,
  defaults?: { isVisible: boolean; contacts: DirectoryContacts; images: DirectoryImage[]; contact: string },
): DirectoryDraft {
  const wcaId = cleanText(body.wcaId, 20).toUpperCase();
  const rawContact = cleanText(body.contact, 300);
  const contacts = body.contacts === undefined && defaults
    ? cleanContacts(defaults.contacts, defaults.contact)
    : cleanContacts(body.contacts, rawContact);
  return {
    kind: KINDS.includes(body.kind as EntryKind) ? body.kind as EntryKind : 'teacher',
    nameZh: cleanText(body.nameZh, 160),
    nameEn: cleanText(body.nameEn, 160),
    locationZh: cleanText(body.locationZh, 160),
    locationEn: cleanText(body.locationEn, 160),
    descriptionZh: cleanText(body.descriptionZh, 2000),
    descriptionEn: cleanText(body.descriptionEn, 2000),
    specialtiesZh: cleanTags(body.specialtiesZh),
    specialtiesEn: cleanTags(body.specialtiesEn),
    teachingMode: MODES.includes(body.teachingMode as TeachingMode)
      ? body.teachingMode as TeachingMode
      : 'both',
    contacts,
    images: body.images === undefined && defaults ? cleanImages(defaults.images) : cleanImages(body.images),
    contact: rawContact || cleanText(Object.values(contacts)[0], 300),
    website: cleanText(body.website, 2000),
    wcaId,
    isCurated: body.isCurated === true,
    isVisible: typeof body.isVisible === 'boolean' ? body.isVisible : defaults?.isVisible ?? true,
  };
}

async function validateImageOwnership(
  images: DirectoryImage[],
  user: WcaUser,
  admin: boolean,
): Promise<string | null> {
  if (images.length === 0) return null;
  const placeholders = images.map(() => '?').join(', ');
  const rows = await query<{ id: number | string; owner_wca_id: string }>(
    `SELECT id, owner_wca_id FROM article_image WHERE id IN (${placeholders})`,
    images.map((image) => image.id),
  );
  if (rows.length !== images.length) return 'image_not_found';
  if (!admin && rows.some((row) => row.owner_wca_id !== user.wcaId)) return 'image_not_owned';
  return null;
}

function validateDraft(draft: DirectoryDraft): string | null {
  if (!draft.nameZh && !draft.nameEn) return 'name_required';
  if (!draft.descriptionZh && !draft.descriptionEn) return 'description_required';
  if (Object.keys(draft.contacts).length === 0 && !draft.website) return 'contact_required';
  if (draft.website && !isHttpUrl(draft.website)) return 'website_invalid';
  for (const key of URL_CONTACT_KEYS) {
    if (draft.contacts[key] && !isHttpUrl(draft.contacts[key])) return `${key}_invalid`;
  }
  if (draft.contacts.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contacts.email)) {
    return 'email_invalid';
  }
  if (draft.wcaId && !/^\d{4}[A-Z]{4}\d{2}$/.test(draft.wcaId)) return 'wca_id_invalid';
  return null;
}

function toJson(row: DirectoryRow, withOwner = false) {
  return {
    id: Number(row.id),
    kind: row.kind,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    locationZh: row.location_zh,
    locationEn: row.location_en,
    descriptionZh: row.description_zh,
    descriptionEn: row.description_en,
    specialtiesZh: row.specialties_zh ?? [],
    specialtiesEn: row.specialties_en ?? [],
    teachingMode: row.teaching_mode,
    contacts: cleanContacts(row.contacts, row.contact),
    images: cleanImages(row.images),
    contact: row.contact,
    website: row.website,
    wcaId: row.wca_id ?? '',
    isCurated: row.is_curated,
    isVisible: row.is_visible,
    ...(withOwner ? { ownerKey: row.owner_key, ownerName: row.owner_name } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireDirectoryEditor(c: Context): Promise<{ user: WcaUser; admin: boolean }> {
  if (c.req.header('X-Admin-Key')) {
    return { user: await requireAdminOrApiKey(c), admin: true };
  }
  const user = await requireAuth(c);
  return { user, admin: ADMIN_WCA_IDS.includes(user.wcaId) };
}

teacherDirectoryRoutes.get('/teachers', async (c) => {
  const rows = await query<DirectoryRow>(
    `SELECT ${COLUMNS} FROM teacher_directory_entries
     WHERE is_visible = TRUE
     ORDER BY is_curated DESC, created_at, id`,
  );
  if (rows.length === 0) noStore(c);
  else c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ entries: rows.map((row) => toJson(row)) });
});

teacherDirectoryRoutes.get('/teachers/mine', async (c) => {
  noStore(c);
  const user = await requireAuth(c);
  const rows = await query<DirectoryRow>(
    `SELECT ${COLUMNS} FROM teacher_directory_entries
     WHERE owner_key = ? ORDER BY updated_at DESC, id DESC`,
    [user.wcaId],
  );
  return c.json({ entries: rows.map((row) => toJson(row, true)) });
});

teacherDirectoryRoutes.post('/teachers', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const { user, admin } = await requireDirectoryEditor(c);
  const draft = readDraft(await c.req.json<Partial<DirectoryDraft>>());
  const error = validateDraft(draft) ?? await validateImageOwnership(draft.images, user, admin);
  if (error) return c.json({ error: 'Invalid directory entry', code: error }, 400);

  const rows = await query<DirectoryRow>(
    `INSERT INTO teacher_directory_entries
       (kind, name_zh, name_en, location_zh, location_en, description_zh, description_en,
        specialties_zh, specialties_en, teaching_mode, contacts, images, contact, website, wca_id,
        is_curated, is_visible, owner_key, owner_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?)
     RETURNING ${COLUMNS}`,
    [
      draft.kind, draft.nameZh, draft.nameEn, draft.locationZh, draft.locationEn,
      draft.descriptionZh, draft.descriptionEn, draft.specialtiesZh, draft.specialtiesEn,
      draft.teachingMode, draft.contacts, draft.images, draft.contact, draft.website, draft.wcaId || null,
      admin ? draft.isCurated : false, draft.isVisible, user.wcaId, user.name,
    ],
  );
  return c.json({ entry: toJson(rows[0], true) }, 201);
});

teacherDirectoryRoutes.put('/teachers/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const { user, admin } = await requireDirectoryEditor(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid entry id' }, 400);

  const existing = await query<DirectoryRow>(
    `SELECT ${COLUMNS} FROM teacher_directory_entries WHERE id = ?`,
    [id],
  );
  if (existing.length === 0) return c.json({ error: 'Directory entry not found' }, 404);
  if (!admin && existing[0].owner_key !== user.wcaId) {
    return c.json({ error: 'Cannot edit this directory entry' }, 403);
  }

  const draft = readDraft(await c.req.json<Partial<DirectoryDraft>>(), {
    isVisible: existing[0].is_visible,
    contacts: existing[0].contacts ?? {},
    images: existing[0].images ?? [],
    contact: existing[0].contact,
  });
  const error = validateDraft(draft) ?? await validateImageOwnership(draft.images, user, admin);
  if (error) return c.json({ error: 'Invalid directory entry', code: error }, 400);
  const rows = await query<DirectoryRow>(
    `UPDATE teacher_directory_entries SET
       kind = ?, name_zh = ?, name_en = ?, location_zh = ?, location_en = ?,
       description_zh = ?, description_en = ?, specialties_zh = ?::jsonb,
       specialties_en = ?::jsonb, teaching_mode = ?, contacts = ?::jsonb, images = ?::jsonb, contact = ?, website = ?,
       wca_id = ?, is_curated = ?, is_visible = ?
     WHERE id = ? RETURNING ${COLUMNS}`,
    [
      draft.kind, draft.nameZh, draft.nameEn, draft.locationZh, draft.locationEn,
      draft.descriptionZh, draft.descriptionEn, draft.specialtiesZh, draft.specialtiesEn,
      draft.teachingMode, draft.contacts, draft.images, draft.contact, draft.website, draft.wcaId || null,
      admin ? draft.isCurated : existing[0].is_curated, draft.isVisible, id,
    ],
  );
  return c.json({ entry: toJson(rows[0], true) });
});

teacherDirectoryRoutes.delete('/teachers/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  const { user, admin } = await requireDirectoryEditor(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid entry id' }, 400);
  const rows = await query<{ owner_key: string }>(
    'SELECT owner_key FROM teacher_directory_entries WHERE id = ?',
    [id],
  );
  if (rows.length === 0) return c.json({ error: 'Directory entry not found' }, 404);
  if (!admin && rows[0].owner_key !== user.wcaId) {
    return c.json({ error: 'Cannot delete this directory entry' }, 403);
  }
  await query('DELETE FROM teacher_directory_entries WHERE id = ?', [id]);
  return c.json({ ok: true });
});
