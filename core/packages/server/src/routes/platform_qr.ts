import { createHmac, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { requirePlatformAdmin, type PlatformActor } from '../platform/auth.js';
import { platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../platform/db.js';
import { badRequest, conflict, notFound, PlatformApiError } from '../platform/errors.js';
import { platformRouter, privateNoStore, publicCache } from '../platform/http.js';
import { approvedQrTarget, booleanField, enumField, integerField, isObject, objectField, pagination, readJsonObject, resourceId, stringField } from '../platform/validation.js';
import { getIp } from '../utils/analytics_helpers.js';

const SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN || 'https://cuberoot.me').replace(/\/+$/, '');
export const platformQrRoutes = platformRouter();

interface QrRow extends Record<string, unknown> {
  id: string; code: string; status: string; currentRevision: number;
  targetKind: 'internal_path' | 'external_url' | 'content'; targetValue: string; title: string;
}

async function findQr(identifier: string, activeOnly = false): Promise<QrRow> {
  const rows = await platformQuery<QrRow>(platformDb(), `
    SELECT qr.id::text, qr.code, qr.status, qr.current_revision AS "currentRevision",
      revision.target_kind AS "targetKind", revision.target_value AS "targetValue",
      COALESCE(NULLIF(revision.title_zh, ''), revision.title_en, qr.code) AS title,
      revision.title_zh AS "titleZh", revision.title_en AS "titleEn",
      qr.is_printed AS "isPrinted", qr.owner_user_id::text AS "ownerUserId",
      qr.created_at AS "createdAt", qr.updated_at AS "updatedAt"
    FROM platform_qr_codes qr JOIN platform_qr_revisions revision
      ON revision.qr_code_id = qr.id AND revision.revision = qr.current_revision
    WHERE (qr.code = $1 OR qr.id::text = $1) ${activeOnly ? "AND qr.status = 'active'" : ''}
  `, [identifier.toLowerCase()]);
  if (!rows[0]) notFound('QR code');
  return rows[0];
}

function scanSecret(): string {
  const secret = process.env.PLATFORM_QR_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new PlatformApiError('SERVICE_UNAVAILABLE', 503, 'QR scan hashing is not configured');
  }
  return secret || 'platform-qr-development-only';
}

async function recordScan(c: Parameters<typeof requirePlatformAdmin>[0], qr: QrRow): Promise<void> {
  const source = `${getIp(c)}\n${c.req.header('User-Agent') || 'unknown'}`;
  const visitorHash = createHmac('sha256', scanSecret()).update(source, 'utf8').digest('hex');
  await platformQuery(platformDb(), `
    INSERT INTO platform_qr_scans (qr_code_id, qr_revision, visitor_hash, user_id, coarse_context)
    VALUES ($1::uuid, $2, decode($3, 'hex'), NULL, '{"source":"qr"}'::jsonb)
    ON CONFLICT (qr_code_id, visitor_hash) DO UPDATE SET last_scanned_at = NOW(),
      scan_count = platform_qr_scans.scan_count + 1,
      user_id = COALESCE(platform_qr_scans.user_id, EXCLUDED.user_id)
  `, [qr.id, qr.currentRevision, visitorHash]);
}

platformQrRoutes.get('/qr/:code', async (c) => {
  const qr = await findQr(resourceId(c.req.param('code'), 'code'), true);
  await recordScan(c, qr);
  c.header('Cache-Control', 'no-store');
  return c.json(qr);
});

platformQrRoutes.get('/qr/:code/redirect', async (c) => {
  const qr = await findQr(resourceId(c.req.param('code'), 'code'), true);
  if (qr.targetKind === 'content') badRequest('Content QR codes do not redirect');
  await recordScan(c, qr);
  c.header('Cache-Control', 'no-store');
  return c.redirect(qr.targetKind === 'internal_path' ? `${SITE_ORIGIN}${qr.targetValue}` : qr.targetValue, 302);
});

platformQrRoutes.get('/qr/:code/svg', async (c) => {
  const qr = await findQr(resourceId(c.req.param('code'), 'code'), true);
  const svg = await QRCode.toString(`${SITE_ORIGIN}/platform/qr/${encodeURIComponent(qr.code)}`, {
    type: 'svg', margin: 2, errorCorrectionLevel: 'M', width: 512,
  });
  c.header('Content-Type', 'image/svg+xml; charset=utf-8'); publicCache(c);
  return c.body(svg);
});

platformQrRoutes.get('/qr/:code/card', async (c) => {
  const qr = await findQr(resourceId(c.req.param('code'), 'code'), true);
  const dataUrl = await QRCode.toDataURL(`${SITE_ORIGIN}/platform/qr/${encodeURIComponent(qr.code)}`, { margin: 1, width: 520 });
  const title = String(qr.title).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="100%" height="100%" fill="white"/><image href="${dataUrl}" x="100" y="80" width="520" height="520"/><text x="360" y="680" text-anchor="middle" font-family="sans-serif" font-size="32" fill="black">${title}</text><text x="360" y="740" text-anchor="middle" font-family="monospace" font-size="20" fill="black">${qr.code}</text></svg>`;
  c.header('Content-Type', 'image/svg+xml; charset=utf-8'); publicCache(c);
  return c.body(svg);
});

platformQrRoutes.get('/admin/qr', async (c) => {
  await requirePlatformAdmin(c);
  const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `
    SELECT qr.id::text, qr.code, qr.status, qr.current_revision AS "currentRevision",
      qr.is_printed AS "isPrinted", revision.target_kind AS "targetKind",
      revision.target_value AS "targetValue", COALESCE(NULLIF(revision.title_zh, ''), revision.title_en, qr.code) AS title,
      COALESCE(scans.scan_count, 0)::text AS "scanCount", qr.updated_at AS "updatedAt"
    FROM platform_qr_codes qr JOIN platform_qr_revisions revision
      ON revision.qr_code_id = qr.id AND revision.revision = qr.current_revision
    LEFT JOIN (SELECT qr_code_id, SUM(scan_count) AS scan_count FROM platform_qr_scans GROUP BY qr_code_id) scans
      ON scans.qr_code_id = qr.id ORDER BY qr.created_at DESC, qr.id LIMIT $1 OFFSET $2`, [pageSize, offset]);
  privateNoStore(c); return c.json({ items: rows, page, pageSize });
});

platformQrRoutes.get('/admin/qr/stats', async (c) => {
  await requirePlatformAdmin(c);
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') || 30)));
  if (!Number.isSafeInteger(days)) badRequest('days must be an integer between 1 and 365');
  const rows = await platformQuery(platformDb(), `
    SELECT DATE_TRUNC('day', scan.last_scanned_at) AS day,
           SUM(scan.scan_count)::text AS "scanCount", COUNT(*)::text AS "uniqueVisitors"
    FROM platform_qr_scans scan WHERE scan.last_scanned_at >= NOW() - ($1::integer * INTERVAL '1 day')
    GROUP BY DATE_TRUNC('day', scan.last_scanned_at) ORDER BY day
  `, [days]);
  privateNoStore(c); return c.json({ items: rows, days });
});

type QrTemplateKind = 'prompt' | 'card';

function templateKindFromPath(value: string): QrTemplateKind {
  if (value === 'prompts') return 'prompt';
  if (value === 'cards') return 'card';
  notFound('QR template collection');
}

function parseTemplate(body: Record<string, unknown>, partial = false) {
  const templateKey = stringField(body, 'templateKey', {
    required: !partial, max: 120, pattern: /^[a-z0-9][a-z0-9_.-]{0,119}$/,
  });
  const nameZh = stringField(body, 'nameZh', { max: 160 });
  const nameEn = stringField(body, 'nameEn', { max: 160 });
  const sortOrder = integerField(body, 'sortOrder', { min: -1_000_000, max: 1_000_000 });
  const template = objectField(body, 'template', { required: !partial });
  if (!partial && !nameZh && !nameEn) badRequest('nameZh or nameEn is required');
  return { templateKey, nameZh, nameEn, sortOrder, template };
}

platformQrRoutes.get('/admin/qr/:collection{prompts|cards}', async (c) => {
  await requirePlatformAdmin(c);
  const kind = templateKindFromPath(c.req.param('collection'));
  const includeArchived = c.req.query('includeArchived') === 'true';
  const rows = await platformQuery(platformDb(), `
    SELECT id::text, template_key AS "templateKey", name_zh AS "nameZh", name_en AS "nameEn",
           template_kind AS "templateKind", status, sort_order AS "sortOrder", template,
           archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM platform_qr_templates WHERE template_kind = $1 AND ($2 OR status = 'active')
    ORDER BY sort_order, id
  `, [kind, includeArchived]);
  privateNoStore(c); return c.json({ items: rows });
});

platformQrRoutes.post('/admin/qr/:collection{prompts|cards}', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const body = await readJsonObject(c); const input = parseTemplate(body);
  const result = await withIdempotency(c, actor, `admin.qr.template.create:${kind}`, body, async (db) => {
    const rows = await platformQuery(db, `
      INSERT INTO platform_qr_templates (template_key, name_zh, name_en, template_kind, sort_order, template, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING id::text, template_key AS "templateKey", name_zh AS "nameZh", name_en AS "nameEn",
                template_kind AS "templateKind", status, sort_order AS "sortOrder", template
    `, [input.templateKey, input.nameZh ?? '', input.nameEn ?? '', kind, input.sortOrder ?? 0, JSON.stringify(input.template), actor.userId]);
    return { status: 201, body: rows[0]!, resourceType: 'platform_qr_template', resourceId: String(rows[0]!.id) };
  }); return sendMutation(c, result);
});

platformQrRoutes.patch('/admin/qr/:collection{prompts|cards}/:id', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const id = resourceId(c.req.param('id')); const body = await readJsonObject(c); const input = parseTemplate(body, true);
  if (Object.values(input).every((value) => value == null)) badRequest('No template fields were provided');
  const result = await withIdempotency(c, actor, `admin.qr.template.update:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `
      UPDATE platform_qr_templates SET template_key = COALESCE($3, template_key), name_zh = COALESCE($4, name_zh),
        name_en = COALESCE($5, name_en), sort_order = COALESCE($6, sort_order), template = COALESCE($7::jsonb, template)
      WHERE id = $1::uuid AND template_kind = $2
      RETURNING id::text, template_key AS "templateKey", name_zh AS "nameZh", name_en AS "nameEn",
                status, sort_order AS "sortOrder", template
    `, [id, kind, input.templateKey ?? null, input.nameZh ?? null, input.nameEn ?? null,
      input.sortOrder ?? null, input.template == null ? null : JSON.stringify(input.template)]);
    if (!rows[0]) notFound('QR template');
    if (!String(rows[0].nameZh || '') && !String(rows[0].nameEn || '')) badRequest('nameZh or nameEn is required');
    return { status: 200, body: rows[0]!, resourceType: 'platform_qr_template', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.delete('/admin/qr/:collection{prompts|cards}/:id', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const id = resourceId(c.req.param('id')); const body = {};
  const result = await withIdempotency(c, actor, `admin.qr.template.archive:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `UPDATE platform_qr_templates SET status = 'archived', archived_at = NOW()
      WHERE id = $1::uuid AND template_kind = $2 AND status = 'active' RETURNING id::text`, [id, kind]);
    if (!rows[0]) notFound('Active QR template');
    return { status: 200, body: { id, status: 'archived' }, resourceType: 'platform_qr_template', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.post('/admin/qr/:collection{prompts|cards}/:id/restore', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const id = resourceId(c.req.param('id')); const body = await readJsonObject(c);
  const result = await withIdempotency(c, actor, `admin.qr.template.restore:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `UPDATE platform_qr_templates SET status = 'active', archived_at = NULL
      WHERE id = $1::uuid AND template_kind = $2 AND status = 'archived' RETURNING id::text`, [id, kind]);
    if (!rows[0]) notFound('Archived QR template');
    return { status: 200, body: { id, status: 'active' }, resourceType: 'platform_qr_template', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.delete('/admin/qr/:collection{prompts|cards}/:id/purge', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const id = resourceId(c.req.param('id')); const body = {};
  const result = await withIdempotency(c, actor, `admin.qr.template.purge:${id}`, body, async (db) => {
    const references = await platformQuery<{ referenced: boolean }>(db, `
      SELECT EXISTS (SELECT 1 FROM platform_qr_card_jobs WHERE template_id = $1::uuid) AS referenced
    `, [id]);
    if (references[0]?.referenced) conflict('QR template is referenced by a card job and cannot be purged');
    const rows = await platformQuery(db, `DELETE FROM platform_qr_templates WHERE id = $1::uuid AND template_kind = $2 AND status = 'archived' RETURNING id::text`, [id, kind]);
    if (!rows[0]) notFound('Unreferenced archived QR template');
    return { status: 200, body: { id, purged: true }, resourceType: 'platform_qr_template', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.post('/admin/qr/:collection{prompts|cards}/reorder', async (c) => {
  const actor = await requirePlatformAdmin(c); const kind = templateKindFromPath(c.req.param('collection'));
  const body = await readJsonObject(c); const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length > 1000) badRequest('items must be an array');
  const items = rawItems.map((raw, index) => {
    if (!isObject(raw)) badRequest(`items[${index}] must be an object`);
    return { id: resourceId(String(raw.id ?? ''), `items[${index}].id`), sortOrder: integerField(raw, 'sortOrder', { required: true, min: -1_000_000, max: 1_000_000 })! };
  });
  const result = await withIdempotency(c, actor, `admin.qr.template.reorder:${kind}`, body, async (db) => {
    for (const item of items) {
      const changed = await platformQuery(db, `UPDATE platform_qr_templates SET sort_order = $3 WHERE id = $1::uuid AND template_kind = $2 RETURNING id::text`, [item.id, kind, item.sortOrder]);
      if (!changed[0]) notFound('QR template');
    }
    return { status: 200, body: { updated: items.length } };
  }); return sendMutation(c, result);
});

platformQrRoutes.get('/admin/qr/card-jobs', async (c) => {
  await requirePlatformAdmin(c); const { page, pageSize, offset } = pagination(c);
  const rows = await platformQuery(platformDb(), `SELECT id::text, template_id::text AS "templateId", status,
    request_snapshot AS "requestSnapshot", output_media_id::text AS "outputMediaId", failure_code AS "failureCode",
    created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt"
    FROM platform_qr_card_jobs ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
  privateNoStore(c); return c.json({ items: rows, page, pageSize });
});

platformQrRoutes.get('/admin/qr/card-jobs/:id', async (c) => {
  await requirePlatformAdmin(c); const id = resourceId(c.req.param('id'));
  const rows = await platformQuery(platformDb(), `SELECT id::text, template_id::text AS "templateId", status,
    request_snapshot AS "requestSnapshot", output_media_id::text AS "outputMediaId", failure_code AS "failureCode",
    created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt"
    FROM platform_qr_card_jobs WHERE id = $1::uuid`, [id]);
  if (!rows[0]) notFound('QR card job');
  privateNoStore(c); return c.json(rows[0]);
});

platformQrRoutes.post('/admin/qr/card-jobs', async (c) => {
  const actor = await requirePlatformAdmin(c); const body = await readJsonObject(c);
  const templateId = resourceId(stringField(body, 'templateId', { required: true, max: 128 })!, 'templateId');
  const request = objectField(body, 'request', { required: true })!;
  const result = await withIdempotency(c, actor, 'admin.qr.card-job.create', body, async (db) => {
    const rows = await platformQuery(db, `INSERT INTO platform_qr_card_jobs (requested_by_user_id, template_id, request_snapshot)
      SELECT $1, id, $3::jsonb FROM platform_qr_templates WHERE id = $2::uuid AND template_kind = 'card' AND status = 'active'
      RETURNING id::text, template_id::text AS "templateId", status, request_snapshot AS "requestSnapshot", created_at AS "createdAt"`,
    [actor.userId, templateId, JSON.stringify(request)]);
    if (!rows[0]) notFound('Active QR card template');
    return { status: 202, body: rows[0]!, resourceType: 'platform_qr_card_job', resourceId: String(rows[0]!.id) };
  }); return sendMutation(c, result);
});

platformQrRoutes.patch('/admin/qr/card-jobs/:id', async (c) => {
  const actor = await requirePlatformAdmin(c); const id = resourceId(c.req.param('id')); const body = await readJsonObject(c);
  const status = enumField(body, 'status', ['running', 'succeeded', 'failed', 'cancelled'] as const, { required: true })!;
  const outputMediaIdRaw = stringField(body, 'outputMediaId', { max: 128 });
  const outputMediaId = outputMediaIdRaw == null
    ? undefined
    : resourceId(outputMediaIdRaw, 'outputMediaId');
  const failureCode = stringField(body, 'failureCode', { max: 120 });
  if (status === 'succeeded' && !outputMediaId) badRequest('outputMediaId is required for a succeeded job');
  if (status === 'failed' && !failureCode) badRequest('failureCode is required for a failed job');
  const result = await withIdempotency(c, actor, `admin.qr.card-job.update:${id}`, body, async (db) => {
    const locked = await platformQuery<{ status: string }>(db, `SELECT status FROM platform_qr_card_jobs WHERE id = $1::uuid FOR UPDATE`, [id]);
    if (!locked[0]) notFound('QR card job');
    const allowed = (locked[0].status === 'queued' && ['running', 'cancelled'].includes(status))
      || (locked[0].status === 'running' && ['succeeded', 'failed', 'cancelled'].includes(status));
    if (!allowed) throw new PlatformApiError('INVALID_STATE', 409, 'Invalid QR card job status transition');
    if (status === 'succeeded') {
      const media = await platformQuery(db, `
        SELECT id FROM platform_media_assets
        WHERE id = $1::uuid AND status = 'ready' AND mime_type LIKE 'image/%'
        FOR SHARE
      `, [outputMediaId]);
      if (!media[0]) badRequest('outputMediaId must identify a ready image');
    }
    const rows = await platformQuery(db, `UPDATE platform_qr_card_jobs SET status = $2,
      started_at = CASE WHEN $2 = 'running' THEN NOW() ELSE started_at END,
      finished_at = CASE WHEN $2 IN ('succeeded','failed','cancelled') THEN NOW() ELSE NULL END,
      output_media_id = CASE WHEN $2 = 'succeeded' THEN $3::uuid ELSE NULL END,
      failure_code = CASE WHEN $2 = 'failed' THEN $4 ELSE NULL END
      WHERE id = $1::uuid RETURNING id::text, status, output_media_id::text AS "outputMediaId", failure_code AS "failureCode"`,
    [id, status, outputMediaId ?? null, failureCode ?? null]);
    return { status: 200, body: rows[0]!, resourceType: 'platform_qr_card_job', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.get('/admin/qr/:id', async (c) => {
  await requirePlatformAdmin(c);
  const qr = await findQr(resourceId(c.req.param('id')));
  const revisions = await platformQuery(platformDb(), `SELECT revision, target_kind AS "targetKind",
    target_value AS "targetValue", title_zh AS "titleZh", title_en AS "titleEn",
    approved_by_actor_key AS "approvedByActorKey", approved_at AS "approvedAt", created_at AS "createdAt"
    FROM platform_qr_revisions WHERE qr_code_id = $1::uuid ORDER BY revision DESC`, [qr.id]);
  privateNoStore(c); return c.json({ ...qr, revisions });
});

function parseRevision(body: Record<string, unknown>) {
  const requested = enumField(body, 'targetKind', ['internal_path', 'external_url', 'content'] as const);
  const raw = stringField(body, 'targetValue', { required: true, max: 4000 })!;
  const targetKind = requested ?? (raw.startsWith('/') ? 'internal_path' : 'external_url');
  const targetValue = targetKind === 'content' ? raw : approvedQrTarget(raw);
  if ((targetKind === 'internal_path') !== targetValue.startsWith('/')) badRequest('QR target kind does not match its value');
  return { targetKind, targetValue, titleZh: stringField(body, 'titleZh', { max: 240 }) ?? '',
    titleEn: stringField(body, 'titleEn', { max: 240 }) ?? '' };
}

async function insertRevision(db: PlatformDb, id: string, revisionNumber: number,
  revision: ReturnType<typeof parseRevision>, actor: PlatformActor): Promise<void> {
  await platformQuery(db, `INSERT INTO platform_qr_revisions (qr_code_id, revision, target_kind,
    target_value, title_zh, title_en, approved_by_user_id, approved_by_actor_key, approved_at, created_by_user_id)
    VALUES ($1::uuid, $2, $3, $4, $5, $6,
      CASE WHEN $3 = 'external_url' THEN $7 END, CASE WHEN $3 = 'external_url' THEN $8 END,
      CASE WHEN $3 = 'external_url' THEN NOW() END, $7)`,
  [id, revisionNumber, revision.targetKind, revision.targetValue, revision.titleZh, revision.titleEn, actor.userId, actor.ownerKey]);
}

platformQrRoutes.post('/admin/qr', async (c) => {
  const actor = await requirePlatformAdmin(c); const body = await readJsonObject(c); const revision = parseRevision(body);
  const requestedCode = stringField(body, 'code', { min: 6, max: 80, pattern: /^[a-z0-9][a-z0-9_-]{5,79}$/ });
  const count = integerField(body, 'count', { min: 1, max: 200 }) ?? 1;
  const prefix = (stringField(body, 'prefix', { min: 1, max: 48, pattern: /^[a-z0-9][a-z0-9_-]{0,47}$/ }) ?? 'qr').toLowerCase();
  if (requestedCode && count !== 1) badRequest('code cannot be combined with batch count');
  const isPrinted = booleanField(body, 'isPrinted') ?? false;
  const result = await withIdempotency(c, actor, 'admin.qr.create', body, async (db) => {
    const created: Record<string, unknown>[] = [];
    for (let index = 0; index < count; index += 1) {
      const code = (requestedCode ?? `${prefix}_${randomBytes(12).toString('hex')}`).toLowerCase();
      const rows = await platformQuery(db, `INSERT INTO platform_qr_codes
        (code, current_revision, is_printed, owner_user_id, created_by_user_id) VALUES ($1, 1, $2, $3, $3)
        RETURNING id::text, code, status, current_revision AS "currentRevision"`, [code, isPrinted, actor.userId]);
      const id = String(rows[0]!.id); await insertRevision(db, id, 1, revision, actor); created.push(rows[0]!);
    }
    const firstId = String(created[0]!.id);
    return { status: 201, body: count === 1 ? created[0]! : { items: created, count: created.length }, resourceType: 'qr_code', resourceId: firstId };
  }); return sendMutation(c, result);
});

platformQrRoutes.post('/admin/qr/:id/duplicate', async (c) => {
  const actor = await requirePlatformAdmin(c); const id = resourceId(c.req.param('id')); const body = await readJsonObject(c);
  const requestedCode = stringField(body, 'code', { min: 6, max: 80, pattern: /^[a-z0-9][a-z0-9_-]{5,79}$/ });
  const result = await withIdempotency(c, actor, `admin.qr.duplicate:${id}`, body, async (db) => {
    const source = await platformQuery<{
      target_kind: 'internal_path' | 'external_url' | 'content'; target_value: string; title_zh: string; title_en: string;
    }>(db, `SELECT r.target_kind, r.target_value, r.title_zh, r.title_en FROM platform_qr_codes q
      JOIN platform_qr_revisions r ON r.qr_code_id = q.id AND r.revision = q.current_revision
      WHERE q.id = $1::uuid`, [id]);
    if (!source[0]) notFound('QR code');
    const code = (requestedCode ?? `qr_${randomBytes(12).toString('hex')}`).toLowerCase();
    const rows = await platformQuery(db, `INSERT INTO platform_qr_codes (code, current_revision, owner_user_id, created_by_user_id)
      VALUES ($1, 1, $2, $2) RETURNING id::text, code, status, current_revision AS "currentRevision"`, [code, actor.userId]);
    const newId = String(rows[0]!.id);
    await insertRevision(db, newId, 1, {
      targetKind: source[0].target_kind, targetValue: source[0].target_value,
      titleZh: source[0].title_zh, titleEn: source[0].title_en,
    }, actor);
    return { status: 201, body: rows[0]!, resourceType: 'qr_code', resourceId: newId };
  }); return sendMutation(c, result);
});

platformQrRoutes.patch('/admin/qr/:id/disabled', async (c) => {
  const actor = await requirePlatformAdmin(c); const id = resourceId(c.req.param('id')); const body = await readJsonObject(c);
  const disabled = booleanField(body, 'disabled'); if (disabled == null) badRequest('disabled is required');
  const result = await withIdempotency(c, actor, `admin.qr.disabled:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `UPDATE platform_qr_codes SET status = $2,
      disabled_at = CASE WHEN $2 = 'disabled' THEN NOW() ELSE NULL END
      WHERE id = $1::uuid AND status <> 'archived'
      RETURNING id::text, code, status, disabled_at AS "disabledAt"`, [id, disabled ? 'disabled' : 'active']);
    if (!rows[0]) notFound('Non-archived QR code');
    return { status: 200, body: rows[0]!, resourceType: 'qr_code', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.delete('/admin/qr/:id', async (c) => {
  const actor = await requirePlatformAdmin(c); const id = resourceId(c.req.param('id')); const body = {};
  const result = await withIdempotency(c, actor, `admin.qr.archive:${id}`, body, async (db) => {
    const rows = await platformQuery(db, `UPDATE platform_qr_codes SET status = 'archived', archived_at = NOW()
      WHERE id = $1::uuid AND status <> 'archived' RETURNING id::text, code, status`, [id]);
    if (!rows[0]) notFound('Active QR code');
    return { status: 200, body: rows[0]!, resourceType: 'qr_code', resourceId: id };
  }); return sendMutation(c, result);
});

platformQrRoutes.patch('/admin/qr/:id', async (c) => {
  const actor = await requirePlatformAdmin(c); const id = resourceId(c.req.param('id')); const body = await readJsonObject(c);
  const status = enumField(body, 'status', ['active', 'disabled', 'archived'] as const);
  const code = stringField(body, 'code', { min: 6, max: 80, pattern: /^[a-z0-9][a-z0-9_-]{5,79}$/ });
  const isPrinted = booleanField(body, 'isPrinted'); const revision = body.targetValue == null ? null : parseRevision(body);
  if (status == null && code == null && isPrinted == null && revision == null) badRequest('No QR fields were provided');
  const result = await withIdempotency(c, actor, `admin.qr.update:${id}`, body, async (db) => {
    const locked = await platformQuery<{ current_revision: number; status: string }>(db,
      `SELECT current_revision, status FROM platform_qr_codes WHERE id = $1::uuid FOR UPDATE`, [id]);
    if (!locked[0]) notFound('QR code');
    if (locked[0].status === 'archived' && status && status !== 'archived') badRequest('Archived QR codes cannot be restored');
    const nextRevision = locked[0].current_revision + (revision ? 1 : 0);
    if (revision) await insertRevision(db, id, nextRevision, revision, actor);
    const rows = await platformQuery(db, `UPDATE platform_qr_codes SET current_revision = $2,
      status = COALESCE($3, status), code = COALESCE($4, code), is_printed = COALESCE($5, is_printed),
      disabled_at = CASE WHEN $3 = 'disabled' THEN NOW() WHEN $3 IS NOT NULL THEN NULL ELSE disabled_at END,
      archived_at = CASE WHEN $3 = 'archived' THEN NOW() ELSE archived_at END WHERE id = $1::uuid
      RETURNING id::text, code, status, current_revision AS "currentRevision", is_printed AS "isPrinted"`,
    [id, nextRevision, status ?? null, code?.toLowerCase() ?? null, isPrinted ?? null]);
    return { status: 200, body: rows[0]!, resourceType: 'qr_code', resourceId: id };
  }); return sendMutation(c, result);
});
