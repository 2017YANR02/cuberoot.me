import { promises as fs } from 'node:fs';
import path from 'node:path';
import { requirePlatformActor, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, forbidden, notFound } from '../platform/errors.js';
import { createPlatformMediaToken, verifyPlatformMediaToken } from '../platform/media_access.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { DRIVE_STORAGE_ROOT } from '../utils/drive_storage.js';
import { checkRateLimit } from '../utils/recon_helpers.js';
import { receiveVideoUpload, storedVideoResponse, VideoUploadError } from '../utils/video_upload.js';

export const platformCompetitionEvidenceRoutes = platformRouter();
const DIRECTORY = path.join(DRIVE_STORAGE_ROOT, 'competition-evidence');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 64 * 1024 * 1024;
function uuid(value: string): string {
  if (!UUID.test(value)) badRequest('Invalid evidence or registration id');
  return value;
}
function filePath(id: string): string { return path.join(DIRECTORY, uuid(id)); }

async function access(db: PlatformDb, id: string, actor: PlatformActor, upload = false) {
  const [row] = await platformQuery(db, `SELECT r.user_id,r.status,s.supervisor_user_id,c.finalized_at,s.session_kind,
    (s.session_kind='self_service' AND EXISTS (SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id
      WHERE o.status='active' AND m.organization_id=c.organization_id AND m.user_id=$2
        AND m.role IN ('owner','admin') AND m.status='active')) AS organizer,
    EXISTS(SELECT 1 FROM platform_competition_disputes d WHERE d.registration_id=r.id AND d.resolved_at IS NULL) AS disputed
    FROM platform_event_registrations r JOIN platform_competition_sessions s ON s.id=r.competition_session_id
    JOIN platform_competitions c ON c.event_id=r.event_id WHERE r.id=$1::uuid`, [id, actor.userId]);
  if (!row) notFound('Registration');
  const participant = actor.userId != null && [Number(row.user_id),Number(row.supervisor_user_id)].includes(actor.userId);
  if (!participant && (upload || (!actor.isAdmin && !row.organizer))) forbidden('Competition evidence is restricted to authorized entrants and reviewers');
  if (upload && (!participant || !['confirmed','attended'].includes(String(row.status)) || row.finalized_at)) {
    conflict('Evidence can only be uploaded for an active registration before results are finalized');
  }
  return row;
}

const SELECT = `SELECT id::text,mime,size_bytes AS "sizeBytes",attempt_number AS "attemptNumber",created_at AS "createdAt",expires_at AS "expiresAt"
  FROM platform_competition_evidence WHERE registration_id=$1::uuid ORDER BY created_at`;

platformCompetitionEvidenceRoutes.get('/platform/competitions/registrations/:id/evidence', async(c) => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = uuid(c.req.param('id'));
  await access(platformDb(),id,actor);
  return c.json({evidence:await platformQuery(platformDb(),SELECT,[id])});
});

const uploading = new Set<number>();
platformCompetitionEvidenceRoutes.post('/platform/competitions/registrations/:id/evidence', async(c) => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = uuid(c.req.param('id'));
  const requestedAttempt = c.req.query('attemptNumber');
  if (requestedAttempt !== undefined && !/^[1-5]$/.test(requestedAttempt)) badRequest('Invalid attempt number');
  const attemptNumber = requestedAttempt === undefined ? null : Number(requestedAttempt);
  await access(platformDb(),id,actor,true);
  if (actor.userId == null) forbidden('An account is required');
  try { checkRateLimit(String(actor.userId), {bucket:'competition-evidence',max:6}); }
  catch { return c.json({error:'Upload limit reached'},429); }
  if (uploading.has(actor.userId) || uploading.size >= 4) return c.json({error:'Another upload is in progress. Retry shortly.'},429);
  uploading.add(actor.userId);
  let temporary: string | undefined;
  let stored: string | undefined;
  try {
    const received = await receiveVideoUpload(c.req.raw.body,DIRECTORY,MAX_BYTES);
    temporary = received.tempPath;
    const result = await platformTransaction(async(db) => {
      // Match finalization/dispute lock order, then recheck after the potentially long upload.
      await platformQuery(db, `SELECT c.event_id FROM platform_competitions c JOIN platform_event_registrations r ON r.event_id=c.event_id WHERE r.id=$1::uuid FOR UPDATE OF c`,[id]);
      await platformQuery(db, `SELECT id FROM platform_event_registrations WHERE id=$1::uuid FOR UPDATE`,[id]);
      const registration = await access(db,id,actor,true);
      if (attemptNumber !== null) {
        const [attempt] = await platformQuery(db, `SELECT attempt_number FROM platform_competition_attempts
          WHERE registration_id=$1::uuid AND attempt_number=$2`, [id, attemptNumber]);
        if (registration.session_kind !== 'self_service' || !attempt) badRequest('A clip must reference an issued self-service attempt');
      }
      const existing = await platformQuery(db,SELECT,[id]);
      if (existing.length >= 2) conflict('Each registration supports at most two evidence videos');
      stored = filePath(received.stem);
      await fs.rename(received.tempPath,stored);
      temporary = undefined;
      await platformQuery(db,`INSERT INTO platform_competition_evidence(id,registration_id,uploaded_by,mime,size_bytes,attempt_number)
        VALUES($1::uuid,$2::uuid,$3,$4,$5,$6)`,[received.stem,id,actor.userId,received.mime,received.sizeBytes,attemptNumber]);
      return await platformQuery(db,SELECT,[id]);
    });
    stored = undefined;
    return c.json({evidence:result},201);
  } catch(error) {
    if (error instanceof VideoUploadError) return c.json({error:error.message},error.status);
    throw error;
  } finally {
    uploading.delete(actor.userId);
    for (const item of [temporary,stored]) if (item) await fs.unlink(item).catch(() => {});
  }
});

function evidenceBinding(registrationId: string) { return `competition-evidence:${registrationId}`; }

platformCompetitionEvidenceRoutes.get('/platform/competitions/evidence/:id/playback', async c => {
  privateNoStore(c);
  const actor = await requirePlatformActor(c);
  const id = uuid(c.req.param('id'));
  const [row] = await platformQuery(platformDb(), 'SELECT registration_id::text FROM platform_competition_evidence WHERE id=$1::uuid', [id]);
  if (!row) notFound('Evidence');
  const registrationId = String(row.registration_id);
  await access(platformDb(), registrationId, actor);
  const { token, expiresAt } = createPlatformMediaToken({ mediaId: id, binding: evidenceBinding(registrationId) });
  return c.json({ token, expiresAt });
});

platformCompetitionEvidenceRoutes.get('/platform/competitions/evidence/:id/content', async(c) => {
  privateNoStore(c);
  const token = c.req.query('token');
  const actor = token ? null : await requirePlatformActor(c);
  const id = uuid(c.req.param('id'));
  const [row] = await platformQuery(platformDb(),`SELECT registration_id::text,mime,size_bytes FROM platform_competition_evidence WHERE id=$1::uuid`,[id]);
  if (!row) notFound('Evidence');
  const registrationId = String(row.registration_id);
  if (actor) await access(platformDb(), registrationId, actor);
  else if (!token || !verifyPlatformMediaToken({ token, mediaId: id, binding: evidenceBinding(registrationId) })) forbidden('Playback link is invalid or expired');
  try { await fs.access(filePath(id)); } catch { notFound('Evidence file'); }
  const response = storedVideoResponse({filePath:filePath(id),mime:String(row.mime),size:Number(row.size_bytes),rangeHeader:c.req.header('Range'),headOnly:c.req.method==='HEAD'});
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('X-Content-Type-Options','nosniff');
  return response;
});

/** A pending dispute pauses retention. Lock the competition before evaluating the hold. */
export async function pruneCompetitionEvidence(): Promise<void> {
  const rows = await platformQuery(platformDb(),`SELECT id::text,registration_id::text FROM platform_competition_evidence WHERE expires_at<NOW() LIMIT 100`);
  for (const row of rows) await platformTransaction(async(db) => {
    await platformQuery(db,`SELECT c.event_id FROM platform_competitions c JOIN platform_event_registrations r ON r.event_id=c.event_id WHERE r.id=$1::uuid FOR UPDATE OF c`,[row.registration_id]);
    const removed = await platformQuery(db,`DELETE FROM platform_competition_evidence e WHERE e.id=$1::uuid AND e.expires_at<NOW()
      AND NOT EXISTS(SELECT 1 FROM platform_competition_disputes d WHERE d.registration_id=e.registration_id AND d.resolved_at IS NULL) RETURNING id::text`,[row.id]);
    if (removed.length) await fs.unlink(filePath(String(row.id))).catch((error:NodeJS.ErrnoException) => {if(error.code!=='ENOENT') throw error;});
  });
  // A process interruption between receiving bytes and committing metadata can leave an orphan.
  // Only this feature's UUID files older than retention are eligible; registered dispute evidence stays.
  const entries = await fs.readdir(DIRECTORY, {withFileTypes:true}).catch((error:NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const cutoff = Date.now() - 30 * 86400_000;
  for (const entry of entries) {
    const id = entry.name.endsWith('.part') ? entry.name.slice(0,-5) : entry.name;
    if (!entry.isFile() || !UUID.test(id)) continue;
    const candidate = path.join(DIRECTORY,entry.name);
    const info = await fs.stat(candidate).catch((error:NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!info || info.mtimeMs >= cutoff) continue;
    const retained = await platformQuery(platformDb(),'SELECT id FROM platform_competition_evidence WHERE id=$1::uuid',[id]);
    if (!retained.length) await fs.unlink(candidate).catch((error:NodeJS.ErrnoException) => {if(error.code!=='ENOENT') throw error;});
  }
}

let pruning = false;
setInterval(() => {
  if (pruning) return;
  pruning = true;
  void pruneCompetitionEvidence().catch(() => console.error('[competition] Evidence retention cleanup failed')).finally(() => {pruning=false;});
}, 3600_000).unref();
