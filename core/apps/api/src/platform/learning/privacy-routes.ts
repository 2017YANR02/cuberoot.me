import { requirePlatformActor, requirePlatformAdmin } from '../auth.js';
import { platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { badRequest, conflict, PlatformApiError } from '../errors.js';
import { privateNoStore } from '../http.js';
import { lockAnalyticsSubject } from '../product_analytics.js';
import { isObject, readJsonObject, enumField, stringField, isoTimestampField, pagination } from '../validation.js';
import { type Hono } from 'hono';

const ANALYTICS_DIMENSION_KEYS = new Set([
  'action',
  'contentType',
  'deviceClass',
  'entryPoint',
  'language',
  'resourceType',
  'result',
  'variant',
]);

function analyticsDimensions(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (!isObject(raw)) badRequest('dimensions must be an object');
  const entries = Object.entries(raw);
  if (entries.length > 8) badRequest('dimensions may contain at most 8 fields');
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (!ANALYTICS_DIMENSION_KEYS.has(key)) badRequest(`dimensions.${key} is not allowed`);
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0 || values.length > 10) badRequest(`dimensions.${key} has an invalid array length`);
    const safeValues = values.map((item) => {
      if (typeof item === 'boolean') return item;
      if (typeof item === 'number' && Number.isSafeInteger(item) && Math.abs(item) <= 1_000_000) return item;
      if (typeof item === 'string') {
        const text = item.trim();
        if (text && text.length <= 120 && !/[\u0000-\u001f\u007f]/.test(text)) return text;
      }
      badRequest(`dimensions.${key} contains an unsupported value`);
    });
    normalized[key] = Array.isArray(value) ? safeValues : safeValues[0];
  }
  return normalized;
}

export function registerPrivacyRoutes(platformLearningRoutes: Hono): void {
  platformLearningRoutes.get('/me/privacy/consents', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery(platformDb(), `
      SELECT DISTINCT ON (purpose) id::text, purpose, status,
             policy_version AS "policyVersion", source, decided_at AS "decidedAt",
             expires_at AS "expiresAt"
      FROM platform_privacy_consents
      WHERE user_id = $1
      ORDER BY purpose, decided_at DESC, id DESC
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows });
  });

  platformLearningRoutes.post('/me/privacy/consents', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const purpose = enumField(body, 'purpose', ['analytics', 'marketing'] as const, { required: true })!;
    const status = enumField(body, 'status', ['granted', 'denied', 'withdrawn'] as const, { required: true })!;
    const policyVersion = stringField(body, 'policyVersion', { required: true, max: 40, pattern: /^[A-Za-z0-9_.-]+$/ })!;
    const source = stringField(body, 'source', { max: 40, pattern: /^[A-Za-z0-9_.-]+$/ }) ?? 'account';
    const expiresAt = isoTimestampField(body, 'expiresAt');
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) badRequest('expiresAt must be in the future');
    if (status !== 'granted' && expiresAt != null) badRequest('Only granted consent may have expiresAt');
    const result = await withIdempotency(c, actor, `learning.privacy.consent:${purpose}`, body, async (db) => {
      if (purpose === 'analytics') await lockAnalyticsSubject(db, { userId: actor.userId, hash: '' });
      const previous = await platformQuery<{ id: string; status: string }>(db, `
        SELECT id::text, status FROM platform_privacy_consents
        WHERE user_id = $1 AND purpose = $2
        ORDER BY decided_at DESC, id DESC LIMIT 1 FOR UPDATE
      `, [actor.userId, purpose]);
      if (status === 'withdrawn' && previous[0]?.status !== 'granted') {
        conflict('Only an active granted consent can be withdrawn');
      }
      const rows = await platformQuery(db, `
        INSERT INTO platform_privacy_consents (
          user_id, purpose, status, policy_version, source, expires_at, supersedes_consent_id, decided_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, clock_timestamp())
        RETURNING id::text, purpose, status, policy_version AS "policyVersion",
                  source, decided_at AS "decidedAt", expires_at AS "expiresAt"
      `, [actor.userId, purpose, status, policyVersion, source, status === 'granted' ? expiresAt ?? null : null,
        previous[0]?.id ?? null]);
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, 'learning.privacy.consent', 'platform_privacy_consent', $3, 'allowed', $4::jsonb)
      `, [actor.userId, actor.ownerKey, rows[0]!.id, { purpose, status, policyVersion }]);
      return {
        status: 201,
        body: rows[0]!,
        resourceType: 'platform_privacy_consent',
        resourceId: String(rows[0]!.id),
      };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.post('/analytics', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const eventName = stringField(body, 'eventName', {
      required: true,
      max: 80,
      pattern: /^[a-z][a-z0-9_.-]{0,79}$/,
    })!;
    const surface = stringField(body, 'surface', {
      required: true,
      max: 80,
      pattern: /^[a-z0-9/_-]{1,80}$/,
    })!;
    const dimensions = analyticsDimensions(body.dimensions);
    const request = { eventName, surface, dimensions };
    const result = await withIdempotency(c, actor, `learning.analytics:${eventName}`, request, async (db) => {
      await lockAnalyticsSubject(db, { userId: actor.userId, hash: '' });
      const consents = await platformQuery<{ id: string; status: string; active: boolean }>(db, `
        SELECT id::text, status, (expires_at IS NULL OR expires_at > NOW()) AS active
        FROM platform_privacy_consents
        WHERE user_id = $1 AND purpose = 'analytics'
        ORDER BY decided_at DESC, id DESC LIMIT 1
      `, [actor.userId]);
      if (consents[0]?.status !== 'granted' || !consents[0].active) {
        throw new PlatformApiError('FORBIDDEN', 403, 'Active analytics consent is required');
      }
      const rows = await platformQuery(db, `
        INSERT INTO platform_analytics_events (
          consent_id, user_id, event_name, surface, dimensions, expires_at
        ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, NOW() + INTERVAL '30 days')
        RETURNING id::text, occurred_at AS "occurredAt", expires_at AS "expiresAt"
      `, [consents[0].id, actor.userId, eventName, surface, dimensions]);
      return {
        status: 202,
        body: rows[0]!,
        resourceType: 'platform_analytics_event',
        resourceId: String(rows[0]!.id),
      };
    });
    return sendMutation(c, result);
  });

  platformLearningRoutes.get('/admin/retention-jobs', async (c) => {
    await requirePlatformAdmin(c);
    const { page, pageSize, offset } = pagination(c);
    const rows = await platformQuery(platformDb(), `
      SELECT id::text, data_class AS "dataClass", cutoff_at AS "cutoffAt", status,
             rows_affected AS "rowsAffected", failure_code AS "failureCode",
             created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt"
      FROM platform_retention_jobs
      ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    privateNoStore(c);
    return c.json({ items: rows, page, pageSize });
  });

  platformLearningRoutes.post('/admin/retention-jobs', async (c) => {
    const actor = await requirePlatformAdmin(c);
    const body = await readJsonObject(c);
    const dataClass = enumField(body, 'dataClass', [
      'analytics_events',
      'qr_scans',
      'idempotency',
      'outbox_payloads',
      'shipping_addresses',
    ] as const, { required: true })!;
    const cutoffAt = isoTimestampField(body, 'cutoffAt');
    if (!cutoffAt) badRequest('cutoffAt is required');
    if (Date.parse(cutoffAt) > Date.now()) badRequest('cutoffAt must not be in the future');
    const result = await withIdempotency(c, actor, `learning.retention:${dataClass}`, body, async (db) => {
      const jobs = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_retention_jobs (
          data_class, cutoff_at, status, requested_by_user_id, started_at
        ) VALUES ($1, $2, 'running', $3, NOW()) RETURNING id::text
      `, [dataClass, cutoffAt, actor.userId]);
      const jobId = jobs[0]!.id;
      const statements: Record<typeof dataClass, string> = {
        analytics_events: `DELETE FROM platform_analytics_events WHERE expires_at <= $1 AND expires_at <= NOW() RETURNING id`,
        qr_scans: `DELETE FROM platform_qr_scans WHERE last_scanned_at <= $1 RETURNING id`,
        idempotency: `DELETE FROM platform_idempotency_requests WHERE expires_at <= $1 AND state IN ('completed','failed') RETURNING id`,
        outbox_payloads: `DELETE FROM platform_outbox_events WHERE created_at <= $1 AND status IN ('delivered','dead_letter') RETURNING id`,
        shipping_addresses: `DELETE FROM platform_shipping_addresses WHERE archived_at IS NOT NULL AND archived_at <= $1 RETURNING id`,
      };
      const removed = await platformQuery(db, statements[dataClass], [cutoffAt]);
      await platformQuery(db, `
        UPDATE platform_retention_jobs
        SET status = 'succeeded', rows_affected = $2, finished_at = NOW()
        WHERE id = $1::uuid
      `, [jobId, removed.length]);
      await platformQuery(db, `
        INSERT INTO platform_audit_events (
          actor_user_id, actor_key, action, resource_type, resource_id, outcome, metadata
        ) VALUES ($1, $2, 'learning.retention.run', 'platform_retention_job', $3, 'allowed', $4::jsonb)
      `, [actor.userId, actor.ownerKey, jobId, { dataClass, rowsAffected: removed.length }]);
      return {
        status: 200,
        body: { id: jobId, dataClass, cutoffAt, status: 'succeeded', rowsAffected: removed.length },
        resourceType: 'platform_retention_job',
        resourceId: jobId,
      };
    });
    return sendMutation(c, result);
  });
}
