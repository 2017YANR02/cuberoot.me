import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { query } from '../db/connection.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { getIp } from '../utils/analytics_helpers.js';
import { hasActiveMembership } from '../utils/membership.js';
import {
  COVER_EXT,
  COVER_MAX_BYTES,
  MUSIC_EXT,
  MUSIC_MAX_BYTES,
  MUSIC_OWNER_QUOTA_BYTES,
  MusicUploadError,
  exceedsMusicOwnerQuota,
  receiveMusicFile,
  sniffMusicAudio,
  sniffMusicCover,
  storedMusicResponse,
} from '../utils/music_upload.js';
import { checkRateLimit, optionalAuth, requireAdmin, requireAuth } from '../utils/recon_helpers.js';

export const musicRoutes = new Hono();

const MUSIC_STORAGE_DIR = process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), '.music');
const MUSIC_TEMP_DIR = path.join(MUSIC_STORAGE_DIR, '.tmp');
const STORAGE_KEY_RE = /^(audio|covers)\/[0-9a-f-]{36}\.(mp3|m4a|flac|wav|jpg|png|webp)$/;
const STATIC_TRACK_ID_RE = /^[0-9a-f]{64}$/;
const TRACK_SELECT = `id, owner_user_id, title, artist, album, genre, lyrics_lrc,
  audio_storage_key, audio_mime, audio_size_bytes, audio_filename,
  cover_storage_key, cover_mime, status, review_note, created_at, updated_at, published_at`;
const STATIC_OVERRIDE_SELECT = 'track_id, title, artist, album, genre, hidden, updated_at';

type TrackStatus = 'pending' | 'published' | 'rejected';

interface MusicTrackRow {
  id: string;
  owner_user_id: number | string | null;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  lyrics_lrc: string | null;
  audio_storage_key: string;
  audio_mime: string;
  audio_size_bytes: number | string;
  audio_filename: string;
  cover_storage_key: string | null;
  cover_mime: string | null;
  status: TrackStatus;
  review_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
}

interface StaticTrackOverrideRow {
  track_id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  hidden: boolean;
  updated_at: Date | string;
}

function noStore(c: Context): void {
  c.header('Cache-Control', 'no-store');
}

function trackJson(row: MusicTrackRow, includePrivate = false): Record<string, unknown> {
  const published = row.status === 'published';
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    lyricsLrc: row.lyrics_lrc,
    audioMime: row.audio_mime,
    audioSizeBytes: Number(row.audio_size_bytes),
    audioFilename: row.audio_filename,
    status: row.status,
    reviewNote: includePrivate ? row.review_note : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    coverUrl: row.cover_storage_key && (published || includePrivate) ? `/v1/music/tracks/${row.id}/cover` : null,
    audioUrl: published ? `/v1/music/tracks/${row.id}/audio` : null,
    ...(includePrivate ? { ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id) } : {}),
  };
}

function requiredText(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Validation failed: ${name} is required`);
  const clean = value.trim();
  if (Buffer.byteLength(clean, 'utf8') > max) throw new Error(`Validation failed: ${name} is too long`);
  return clean;
}

function nullableText(value: unknown, name: string, max: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Validation failed: ${name} must be a string`);
  const clean = value.trim();
  if (Buffer.byteLength(clean, 'utf8') > max) throw new Error(`Validation failed: ${name} is too long`);
  return clean || null;
}

function staticOverrideJson(row: StaticTrackOverrideRow): Record<string, unknown> {
  return {
    id: row.track_id,
    ...(row.title !== null ? {
      title: row.title,
      artist: row.artist ?? '',
      album: row.album,
      genre: row.genre,
    } : {}),
    hidden: row.hidden,
    updatedAt: row.updated_at,
  };
}

function staticTrackId(value: string | undefined): string {
  if (!value || !STATIC_TRACK_ID_RE.test(value)) throw new Error('Validation failed: invalid static track id');
  return value;
}

function uploadFilename(value: string | undefined, title: string, extension: string): string {
  const candidate = path.basename(value || title).replace(/[\r\n"\\/]/g, '_').trim();
  const stem = candidate.replace(/\.[^.]+$/, '').slice(0, 220) || 'track';
  return `${stem}.${extension}`;
}

function storedPath(storageKey: string): string | null {
  if (!STORAGE_KEY_RE.test(storageKey)) return null;
  const resolved = path.resolve(MUSIC_STORAGE_DIR, ...storageKey.split('/'));
  const root = path.resolve(MUSIC_STORAGE_DIR) + path.sep;
  return resolved.startsWith(root) ? resolved : null;
}

async function memberIdentity(c: Context): Promise<{ userId: number; isAdmin: boolean }> {
  const user = await requireAuth(c);
  if (!user.isAdmin && !(await hasActiveMembership(user.wcaId))) {
    throw new Error('Music membership required');
  }
  return { userId: await requireAppUserId(c), isAdmin: user.isAdmin };
}

async function rowById(id: string | undefined): Promise<MusicTrackRow | null> {
  if (!id) return null;
  const rows = await query<MusicTrackRow>(`SELECT ${TRACK_SELECT} FROM music_tracks WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

async function ownerAudioBytes(userId: number): Promise<number> {
  const rows = await query<{ total: number | string }>(
    'SELECT COALESCE(SUM(audio_size_bytes), 0) AS total FROM music_tracks WHERE owner_user_id = ?',
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function serveAudio(c: Context, headOnly: boolean, attachment: boolean): Promise<Response> {
  if (attachment) await memberIdentity(c);
  const row = await rowById(c.req.param('id'));
  if (!row || row.status !== 'published') return c.json({ error: 'Not found' }, 404);
  const filePath = storedPath(row.audio_storage_key);
  if (!filePath) return c.json({ error: 'Not found' }, 404);
  const stat = await fs.stat(filePath).catch(() => null);
  const size = Number(row.audio_size_bytes);
  if (!stat?.isFile()) return c.json({ error: 'Not found' }, 404);
  if (!Number.isSafeInteger(size) || size <= 0 || stat.size !== size) {
    return c.json({ error: 'Music storage mismatch' }, 500);
  }
  return storedMusicResponse({
    filePath,
    mime: row.audio_mime,
    size,
    rangeHeader: c.req.header('range'),
    headOnly,
    filename: row.audio_filename,
    attachment,
  });
}

async function serveCover(c: Context, headOnly: boolean): Promise<Response> {
  const row = await rowById(c.req.param('id'));
  if (!row?.cover_storage_key || !row.cover_mime) return c.json({ error: 'Not found' }, 404);
  let allowed = row.status === 'published';
  if (!allowed) {
    const me = await optionalAuth(c);
    if (me) {
      const userId = await requireAppUserId(c);
      allowed = me.isAdmin || Number(row.owner_user_id) === userId;
    }
  }
  if (!allowed) return c.json({ error: 'Not found' }, 404);
  const filePath = storedPath(row.cover_storage_key);
  if (!filePath) return c.json({ error: 'Not found' }, 404);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return c.json({ error: 'Not found' }, 404);
  c.header('Cache-Control', row.status === 'published' ? 'public, max-age=300, s-maxage=300' : 'no-store');
  c.header('Content-Length', String(stat.size));
  c.header('Content-Type', row.cover_mime);
  c.header('X-Content-Type-Options', 'nosniff');
  if (headOnly) return c.body(null);
  return c.body(await fs.readFile(filePath));
}

musicRoutes.get('/music/tracks', async (c) => {
  c.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  const rows = await query<MusicTrackRow>(
    `SELECT ${TRACK_SELECT} FROM music_tracks WHERE status = 'published' ORDER BY published_at DESC, created_at DESC`,
  );
  return c.json({ tracks: rows.map((row) => trackJson(row)) });
});

musicRoutes.get('/music/static-overrides', async (c) => {
  noStore(c);
  const rows = await query<StaticTrackOverrideRow>(`SELECT ${STATIC_OVERRIDE_SELECT} FROM music_static_overrides`);
  return c.json({ tracks: rows.map(staticOverrideJson) });
});

musicRoutes.get('/music/me/tracks', async (c) => {
  noStore(c);
  const { userId } = await memberIdentity(c);
  const rows = await query<MusicTrackRow>(
    `SELECT ${TRACK_SELECT} FROM music_tracks WHERE owner_user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  return c.json({ tracks: rows.map((row) => trackJson(row, true)) });
});

musicRoutes.post('/music/tracks', async (c) => {
  noStore(c);
  const { userId } = await memberIdentity(c);
  checkRateLimit(getIp(c), { bucket: 'music-upload', max: 6 });
  const title = requiredText(c.req.query('title'), 'title', 300);
  const artist = nullableText(c.req.query('artist'), 'artist', 300) ?? '';
  const album = nullableText(c.req.query('album'), 'album', 300);
  const genre = nullableText(c.req.query('genre'), 'genre', 100);
  const lyrics = nullableText(c.req.query('lyricsLrc'), 'lyricsLrc', 64 * 1024);
  const contentLength = Number(c.req.header('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MUSIC_MAX_BYTES) {
    return c.json({ error: 'audio file too large' }, 413);
  }
  const storedBefore = await ownerAudioBytes(userId);
  if (storedBefore >= MUSIC_OWNER_QUOTA_BYTES
    || (contentLength > 0 && exceedsMusicOwnerQuota(storedBefore, contentLength))) {
    return c.json({ error: 'music storage quota exceeded' }, 413);
  }

  let received;
  try {
    received = await receiveMusicFile(c.req.raw.body, MUSIC_TEMP_DIR, MUSIC_MAX_BYTES, sniffMusicAudio, 'audio');
  } catch (error) {
    if (error instanceof MusicUploadError) return c.json({ error: error.message }, error.status);
    throw error;
  }
  const storedAfter = await ownerAudioBytes(userId);
  if (exceedsMusicOwnerQuota(storedAfter, received.sizeBytes)) {
    await fs.unlink(received.tempPath).catch(() => {});
    return c.json({ error: 'music storage quota exceeded' }, 413);
  }
  const extension = MUSIC_EXT[received.mime];
  const id = randomUUID();
  const storageKey = `audio/${id}.${extension}`;
  const finalPath = storedPath(storageKey);
  if (!finalPath) throw new Error('Music storage path rejected');
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.rename(received.tempPath, finalPath);
  try {
    const rows = await query<MusicTrackRow>(
      `INSERT INTO music_tracks
        (id, owner_user_id, title, artist, album, genre, lyrics_lrc, audio_storage_key,
         audio_mime, audio_size_bytes, audio_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${TRACK_SELECT}`,
      [id, userId, title, artist, album, genre, lyrics, storageKey, received.mime,
        received.sizeBytes, uploadFilename(c.req.query('filename'), title, extension)],
    );
    return c.json({ track: trackJson(rows[0], true) }, 201);
  } catch (error) {
    await fs.unlink(finalPath).catch(() => {});
    throw error;
  }
});

musicRoutes.put('/music/tracks/:id/cover', async (c) => {
  noStore(c);
  const identity = await memberIdentity(c);
  checkRateLimit(getIp(c), { bucket: 'music-cover', max: 12 });
  const row = await rowById(c.req.param('id'));
  if (!row || (!identity.isAdmin && (Number(row.owner_user_id) !== identity.userId || row.status !== 'pending'))) {
    return c.json({ error: 'Not found' }, 404);
  }
  const contentLength = Number(c.req.header('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > COVER_MAX_BYTES) {
    return c.json({ error: 'cover file too large' }, 413);
  }
  let received;
  try {
    received = await receiveMusicFile(c.req.raw.body, MUSIC_TEMP_DIR, COVER_MAX_BYTES, sniffMusicCover, 'cover');
  } catch (error) {
    if (error instanceof MusicUploadError) return c.json({ error: error.message }, error.status);
    throw error;
  }
  const storageKey = `covers/${randomUUID()}.${COVER_EXT[received.mime]}`;
  const finalPath = storedPath(storageKey);
  if (!finalPath) throw new Error('Music storage path rejected');
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.rename(received.tempPath, finalPath);
  try {
    const rows = await query<MusicTrackRow>(
      `UPDATE music_tracks SET cover_storage_key = ?, cover_mime = ? WHERE id = ? RETURNING ${TRACK_SELECT}`,
      [storageKey, received.mime, row.id],
    );
    if (row.cover_storage_key) {
      const oldPath = storedPath(row.cover_storage_key);
      if (oldPath) await fs.unlink(oldPath).catch(() => {});
    }
    return c.json({ track: trackJson(rows[0], true) });
  } catch (error) {
    await fs.unlink(finalPath).catch(() => {});
    throw error;
  }
});

musicRoutes.patch('/music/tracks/:id', async (c) => {
  noStore(c);
  const { userId } = await memberIdentity(c);
  const row = await rowById(c.req.param('id'));
  if (!row || Number(row.owner_user_id) !== userId || row.status !== 'pending') {
    return c.json({ error: 'Not found' }, 404);
  }
  const body = await c.req.json<Record<string, unknown>>();
  const fields: string[] = [];
  const values: unknown[] = [];
  const specs = [
    ['title', 'title', 300, true], ['artist', 'artist', 300, false],
    ['album', 'album', 300, false], ['genre', 'genre', 100, false],
    ['lyricsLrc', 'lyrics_lrc', 64 * 1024, false],
  ] as const;
  for (const [key, column, max, required] of specs) {
    if (!(key in body)) continue;
    fields.push(`${column} = ?`);
    values.push(required ? requiredText(body[key], key, max) : nullableText(body[key], key, max) ?? (key === 'artist' ? '' : null));
  }
  if (!fields.length) return c.json({ error: 'Validation failed: no editable fields' }, 400);
  const rows = await query<MusicTrackRow>(
    `UPDATE music_tracks SET ${fields.join(', ')} WHERE id = ? RETURNING ${TRACK_SELECT}`,
    [...values, row.id],
  );
  return c.json({ track: trackJson(rows[0], true) });
});

musicRoutes.get('/music/tracks/:id/audio', (c) => serveAudio(c, false, false));
musicRoutes.on('HEAD', '/music/tracks/:id/audio', (c) => serveAudio(c, true, false));
musicRoutes.get('/music/tracks/:id/download', (c) => serveAudio(c, false, true));
musicRoutes.on('HEAD', '/music/tracks/:id/download', (c) => serveAudio(c, true, true));
musicRoutes.get('/music/tracks/:id/cover', (c) => serveCover(c, false));
musicRoutes.on('HEAD', '/music/tracks/:id/cover', (c) => serveCover(c, true));

musicRoutes.get('/music/admin/tracks', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const rows = await query<MusicTrackRow>(`SELECT ${TRACK_SELECT} FROM music_tracks ORDER BY created_at DESC`);
  return c.json({ tracks: rows.map((row) => trackJson(row, true)) });
});

musicRoutes.patch('/music/admin/static-tracks/:id', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const id = staticTrackId(c.req.param('id'));
  const body = await c.req.json<Record<string, unknown>>();
  const hidden = body.hidden;
  if (typeof hidden !== 'boolean') {
    return c.json({ error: 'Validation failed: hidden must be a boolean' }, 400);
  }
  const rows = await query<StaticTrackOverrideRow>(
    `INSERT INTO music_static_overrides (track_id, title, artist, album, genre, hidden)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (track_id) DO UPDATE SET
       title = EXCLUDED.title, artist = EXCLUDED.artist, album = EXCLUDED.album,
       genre = EXCLUDED.genre, hidden = EXCLUDED.hidden
     RETURNING ${STATIC_OVERRIDE_SELECT}`,
    [id, requiredText(body.title, 'title', 300), nullableText(body.artist, 'artist', 300) ?? '',
      nullableText(body.album, 'album', 300), nullableText(body.genre, 'genre', 100), hidden],
  );
  return c.json({ track: staticOverrideJson(rows[0]) });
});

musicRoutes.delete('/music/admin/static-tracks/:id', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const id = staticTrackId(c.req.param('id'));
  const rows = await query<StaticTrackOverrideRow>(
    `INSERT INTO music_static_overrides (track_id, hidden) VALUES (?, TRUE)
     ON CONFLICT (track_id) DO UPDATE SET hidden = TRUE
     RETURNING ${STATIC_OVERRIDE_SELECT}`,
    [id],
  );
  return c.json({ track: staticOverrideJson(rows[0]) });
});

musicRoutes.patch('/music/admin/tracks/:id', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const body = await c.req.json<Record<string, unknown>>();
  const fields: string[] = [];
  const values: unknown[] = [];
  const specs = [
    ['title', 'title', 300, true], ['artist', 'artist', 300, false],
    ['album', 'album', 300, false], ['genre', 'genre', 100, false],
    ['lyricsLrc', 'lyrics_lrc', 64 * 1024, false], ['reviewNote', 'review_note', 1000, false],
  ] as const;
  for (const [key, column, max, required] of specs) {
    if (!(key in body)) continue;
    fields.push(`${column} = ?`);
    values.push(required ? requiredText(body[key], key, max) : nullableText(body[key], key, max) ?? (key === 'artist' ? '' : null));
  }
  if ('status' in body) {
    if (!['pending', 'published', 'rejected'].includes(String(body.status))) {
      return c.json({ error: 'Validation failed: invalid status' }, 400);
    }
    fields.push('status = ?', "published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, NOW()) ELSE NULL END");
    values.push(body.status, body.status);
  }
  if (!fields.length) return c.json({ error: 'Validation failed: no editable fields' }, 400);
  values.push(c.req.param('id'));
  const rows = await query<MusicTrackRow>(
    `UPDATE music_tracks SET ${fields.join(', ')} WHERE id = ? RETURNING ${TRACK_SELECT}`,
    values,
  );
  if (!rows.length) return c.json({ error: 'Not found' }, 404);
  return c.json({ track: trackJson(rows[0], true) });
});

musicRoutes.delete('/music/admin/tracks/:id', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const rows = await query<MusicTrackRow>(
    `DELETE FROM music_tracks WHERE id = ? RETURNING ${TRACK_SELECT}`,
    [c.req.param('id')],
  );
  if (!rows.length) return c.json({ error: 'Not found' }, 404);
  for (const key of [rows[0].audio_storage_key, rows[0].cover_storage_key]) {
    if (!key) continue;
    const filePath = storedPath(key);
    if (filePath) await fs.unlink(filePath).catch(() => {});
  }
  return c.json({ ok: true });
});
