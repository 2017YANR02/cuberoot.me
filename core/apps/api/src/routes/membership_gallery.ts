import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAuth, requireAdmin, checkRateLimit } from '../utils/recon_helpers.js';
import { getIp } from '../utils/analytics_helpers.js';
import { hasActiveMembership } from '../utils/membership.js';
import { GALLERY_ACTIVE_OWNER, GALLERY_OWNER_JOIN } from '../utils/gallery.js';

export const membershipGalleryRoutes = new Hono();
membershipGalleryRoutes.use('/membership/gallery/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});

membershipGalleryRoutes.get('/membership/gallery', async c => {
  c.header('Cache-Control', 'no-store');
  const photos = await query<{ id: number | string; name: string; wca_id: string | null }>(`
    SELECT i.id, COALESCE(NULLIF(u.display_name, ''), u.wca_id, '') AS name, u.wca_id
    FROM article_image i JOIN app_users u ON ${GALLERY_OWNER_JOIN}
    WHERE i.gallery_status = 'public' AND ${GALLERY_ACTIVE_OWNER}
    ORDER BY i.gallery_reviewed_at DESC, i.id DESC`);
  return c.json({ photos: photos.map(p => ({ id: Number(p.id), memberName: p.name, wcaId: p.wca_id })) });
});

membershipGalleryRoutes.get('/membership/gallery/mine', async c => {
  const user = await requireAuth(c);
  const photos = await query<{ id: number | string; gallery_status: string }>(`
    SELECT i.id, i.gallery_status FROM article_image i
    JOIN app_users u ON ${GALLERY_OWNER_JOIN}
    WHERE UPPER(i.owner_wca_id) = ? AND i.gallery_status IS NOT NULL`, [user.wcaId.toUpperCase()]);
  return c.json({ photos: photos.map(p => ({ id: Number(p.id), status: p.gallery_status })) });
});

membershipGalleryRoutes.put('/membership/gallery/:id/visibility', async c => {
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const id = Number(c.req.param('id'));
  const { status } = await c.req.json<{ status?: unknown }>();
  if (!Number.isSafeInteger(id) || id <= 0 || (status !== 'private' && status !== 'pending')) {
    return c.json({ error: 'invalid gallery visibility' }, 400);
  }
  if (status === 'pending' && !user.isAdmin && !await hasActiveMembership(user.wcaId)) {
    return c.json({ error: 'active membership required' }, 403);
  }
  const rows = await query(`UPDATE article_image i
    SET gallery_status = ?, gallery_requested_at = CASE WHEN ? = 'pending' THEN NOW() ELSE NULL END,
        gallery_reviewed_at = NULL, gallery_reviewed_by = NULL
    WHERE i.id = ? AND UPPER(i.owner_wca_id) = ? AND i.gallery_status IS NOT NULL
      AND (? = 'private' OR i.gallery_status IN ('private', 'rejected'))
      AND EXISTS (SELECT 1 FROM app_users u WHERE ${GALLERY_OWNER_JOIN})
    RETURNING id`, [status, status, id, user.wcaId.toUpperCase(), status]);
  if (!rows.length) return c.json({ error: 'photo unavailable or status changed' }, 409);
  return c.json({ id, status });
});

membershipGalleryRoutes.get('/membership/gallery/review', async c => {
  await requireAdmin(c);
  const photos = await query<{ id: number | string; name: string; wca_id: string | null }>(`
    SELECT i.id, COALESCE(NULLIF(u.display_name, ''), u.wca_id, '') AS name, u.wca_id
    FROM article_image i JOIN app_users u ON ${GALLERY_OWNER_JOIN}
    WHERE i.gallery_status = 'pending' AND ${GALLERY_ACTIVE_OWNER}
    ORDER BY i.gallery_requested_at, i.id LIMIT 100`);
  return c.json({ photos: photos.map(p => ({ id: Number(p.id), memberName: p.name, wcaId: p.wca_id })) });
});

membershipGalleryRoutes.post('/membership/gallery/:id/review', async c => {
  checkRateLimit(getIp(c));
  const admin = await requireAdmin(c);
  const id = Number(c.req.param('id'));
  const { decision } = await c.req.json<{ decision?: unknown }>();
  if (!Number.isSafeInteger(id) || id <= 0 || (decision !== 'public' && decision !== 'rejected')) {
    return c.json({ error: 'invalid gallery decision' }, 400);
  }
  const rows = await query(`UPDATE article_image i
    SET gallery_status = ?, gallery_reviewed_at = NOW(), gallery_reviewed_by = ?
    WHERE i.id = ? AND i.gallery_status = 'pending'
      AND EXISTS (SELECT 1 FROM app_users u WHERE ${GALLERY_OWNER_JOIN} AND ${GALLERY_ACTIVE_OWNER})
    RETURNING id`, [decision, admin.wcaId, id]);
  if (!rows.length) return c.json({ error: 'request no longer pending' }, 409);
  return c.json({ id, status: decision });
});
