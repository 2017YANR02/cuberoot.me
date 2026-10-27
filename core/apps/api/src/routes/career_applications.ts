import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { CAREER_POSITION_IDS } from '@cuberoot/shared/careers';
import { query } from '../db/connection.js';
import { requireAdmin, checkRateLimit } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';

export const careerApplicationRoutes = new Hono();
const requestSchema = z.object({
  id: z.string().uuid(), position: z.enum(CAREER_POSITION_IDS), city: z.literal('shanghai'),
  name: z.string().trim().min(1).max(100), phone: z.string().trim().min(3).max(32), email: z.string().trim().email().max(254),
  education: z.string().trim().max(100), experience: z.string().trim().max(200), channel: z.string().trim().max(100), consent: z.literal('yes'),
});
const MAX_RESUME = 5 * 1024 * 1024;
const MAX_PHOTO = 2 * 1024 * 1024;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeFilename(name: string): string { return name.replace(/[\x00-\x1f\x7f/\\]/g, '').slice(-200) || 'file'; }
function fileExt(file: File): string { return file.name.toLowerCase().split('.').pop() ?? ''; }
function validResume(bytes: Buffer, ext: string): boolean {
  if (ext === 'pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (ext === 'doc') return bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  if (ext === 'docx') return bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
  if (ext === 'txt') return !bytes.includes(0) && !bytes.toString('utf8').includes('\ufffd');
  return false;
}
function validPhoto(bytes: Buffer, ext: string): boolean {
  return (['jpg', 'jpeg'].includes(ext) && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) || (ext === 'png' && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
}
careerApplicationRoutes.use('/career-applications*', async (c, next) => { c.header('Cache-Control', 'no-store'); c.header('X-Robots-Tag', 'noindex, nofollow'); await next(); });
careerApplicationRoutes.get('/career-applications/status', async c => {
  checkRateLimit(getIp(c), { bucket: 'career-application-status', max: 30 });
  await query('SELECT 1 FROM career_applications LIMIT 1');
  return c.json({ available: true });
});
careerApplicationRoutes.post('/career-applications', bodyLimit({ maxSize: 8 * 1024 * 1024, onError: c => c.json({ error: 'Payload too large' }, 413) }), async c => {
  checkRateLimit(getIp(c), { bucket: 'career-application', max: 5 });
  let form: FormData;
  try { form = await c.req.formData(); } catch { return c.json({ error: 'Invalid application' }, 400); }
  const parsed = requestSchema.safeParse(Object.fromEntries(['id', 'position', 'city', 'name', 'phone', 'email', 'education', 'experience', 'channel', 'consent'].map(key => [key, form.get(key)])));
  const resume = form.get('resume'), photo = form.get('photo');
  if (!parsed.success || !(resume instanceof File) || resume.size < 1 || resume.size > MAX_RESUME || (photo !== null && (!(photo instanceof File) || photo.size < 1 || photo.size > MAX_PHOTO))) return c.json({ error: 'Invalid application or file size' }, 400);
  const resumeBytes = Buffer.from(await resume.arrayBuffer());
  const resumeExt = fileExt(resume);
  const photoFile = photo instanceof File ? photo : null;
  const photoBytes = photoFile ? Buffer.from(await photoFile.arrayBuffer()) : null;
  const photoExt = photoFile ? fileExt(photoFile) : null;
  if (!validResume(resumeBytes, resumeExt) || (photoFile && (!photoBytes || !photoExt || !validPhoto(photoBytes, photoExt)))) return c.json({ error: 'Invalid file format' }, 400);
  const data = parsed.data;
  const resumeName = safeFilename(resume.name), photoName = photoFile ? safeFilename(photoFile.name) : null;
  const hash = createHash('sha256').update(JSON.stringify({ ...data, resumeName, photoName })).update(resumeBytes).update(photoBytes ?? Buffer.alloc(0)).digest('hex');
  const rows = await query<{ payload_hash: string }>(`INSERT INTO career_applications (id, payload_hash, position_id, city, applicant_name, phone, email, education, experience, channel, resume_name, resume_ext, resume_data, photo_name, photo_ext, photo_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET id = career_applications.id RETURNING payload_hash`,
    [data.id, hash, data.position, data.city, data.name, data.phone, data.email, data.education, data.experience, data.channel, resumeName, resumeExt, resumeBytes, photoName, photoExt, photoBytes]);
  if (rows[0].payload_hash !== hash) return c.json({ error: 'Application ID already used' }, 409);
  return c.json({ ok: true }, 201);
});
careerApplicationRoutes.get('/career-applications', async c => {
  await requireAdmin(c);
  const offset = Number(c.req.query('offset') ?? '0');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return c.json({ error: 'Invalid offset' }, 400);
  const rows = await query(`SELECT id, position_id, city, applicant_name, phone, email, education, experience, channel, resume_name, photo_name, created_at FROM career_applications ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET ?`, [offset]);
  return c.json({ applications: rows.slice(0, 50), hasMore: rows.length > 50 });
});
careerApplicationRoutes.delete('/career-applications/:id', async c => {
  await requireAdmin(c);
  const id = c.req.param('id');
  if (!idPattern.test(id)) return c.json({ error: 'Not found' }, 404);
  await query('DELETE FROM career_applications WHERE id = ?', [id]);
  return c.json({ ok: true });
});
careerApplicationRoutes.get('/career-applications/:id/:file', async c => {
  await requireAdmin(c);
  const id = c.req.param('id'), kind = c.req.param('file');
  if (!idPattern.test(id) || !['resume', 'photo'].includes(kind)) return c.json({ error: 'Not found' }, 404);
  const rows = kind === 'resume' ? await query<{ data: Buffer; ext: string }>('SELECT resume_data AS data, resume_ext AS ext FROM career_applications WHERE id = ?', [id]) : await query<{ data: Buffer | null; ext: string | null }>('SELECT photo_data AS data, photo_ext AS ext FROM career_applications WHERE id = ?', [id]);
  if (!rows[0]?.data || !rows[0].ext) return c.json({ error: 'Not found' }, 404);
  c.header('Content-Type', 'application/octet-stream');
  c.header('Content-Disposition', `attachment; filename="${kind}.${rows[0].ext}"`);
  c.header('X-Content-Type-Options', 'nosniff');
  return c.body(new Uint8Array(rows[0].data));
});
