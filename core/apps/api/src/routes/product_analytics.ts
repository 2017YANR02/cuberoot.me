import { bodyLimit } from 'hono/body-limit';
import type { Context } from 'hono';
import { ANALYTICS_BATCH_SIZE, ANALYTICS_UUID, PRODUCT_ANALYTICS_POLICY, validAnalyticsEvent } from '@cuberoot/shared/product-analytics';
import { requirePlatformActor, requirePlatformAdmin } from '../platform/auth.js';
import { platformDb, platformQuery, platformTransaction } from '../platform/db.js';
import { badRequest, PlatformApiError } from '../platform/errors.js';
import { platformRouter, privateNoStore } from '../platform/http.js';
import { readJsonObject } from '../platform/validation.js';
import { analyticsConsentEnabled, analyticsSubject, latestAnalyticsConsent, recordAnalyticsBatch, setAnalyticsConsent } from '../platform/product_analytics.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, RateLimitError } from '../utils/rate_limit.js';

export const productAnalyticsRoutes = platformRouter();
productAnalyticsRoutes.use('/analytics/*', async (c, next) => { privateNoStore(c); await next(); });
productAnalyticsRoutes.use('/admin/product-analytics', async (c, next) => { privateNoStore(c); await next(); });
productAnalyticsRoutes.use('/analytics/*', bodyLimit({ maxSize: 24 * 1024, onError: c => c.json({ error: 'Payload too large' }, 413) }));
// Shed optional traffic instead of filling the business API's ten-connection pool.
let collecting = 0;
let reporting = false;
productAnalyticsRoutes.use('/analytics/*', async (c, next) => {
  if (collecting >= 2) return c.json({ error: 'Analytics busy' }, 503);
  collecting++;
  try { await next(); } finally { collecting--; }
});

async function subjectFrom(c: Context, body: Record<string, unknown>) {
  if (typeof body.subjectToken !== 'string' || !ANALYTICS_UUID.test(body.subjectToken)) badRequest('Invalid subject token');
  try { checkRateLimit(getIp(c), { bucket: 'product-analytics', max: 120 }); }
  catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    c.header('Retry-After', String(error.retryAfterSeconds));
    throw new PlatformApiError('RATE_LIMITED', 429, 'Analytics rate limit exceeded');
  }
  // Invalid credentials must not silently turn an account request into anonymous traffic.
  const actor = c.req.header('Authorization') ? await requirePlatformActor(c) : null;
  return analyticsSubject(actor?.userId ?? null, body.subjectToken, actor?.isAdmin);
}

productAnalyticsRoutes.post('/analytics/status', async c => {
  const body = await readJsonObject(c);
  const subject = await subjectFrom(c, body);
  return c.json({ enabled: analyticsConsentEnabled(await latestAnalyticsConsent(platformDb(), subject)), audience: subject.audience, policyVersion: PRODUCT_ANALYTICS_POLICY });
});

productAnalyticsRoutes.post('/analytics/consent', async c => {
  const body = await readJsonObject(c);
  const subject = await subjectFrom(c, body);
  if (typeof body.enabled !== 'boolean' || body.policyVersion !== PRODUCT_ANALYTICS_POLICY) badRequest('Explicit choice and current policy version required');
  await setAnalyticsConsent(subject, body.enabled);
  return c.json({ enabled: body.enabled, audience: subject.audience, policyVersion: PRODUCT_ANALYTICS_POLICY });
});

productAnalyticsRoutes.post('/analytics/events', async c => {
  const body = await readJsonObject(c);
  const subject = await subjectFrom(c, body);
  if (typeof body.sessionId !== 'string' || !ANALYTICS_UUID.test(body.sessionId)) badRequest('Invalid session');
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > ANALYTICS_BATCH_SIZE
    || !body.events.every(event => validAnalyticsEvent(event))) badRequest('Invalid analytics batch');
  return c.json({ accepted: await recordAnalyticsBatch(subject, body.sessionId, body.events) }, 202);
});

productAnalyticsRoutes.get('/admin/product-analytics', async c => {
  await requirePlatformAdmin(c);
  const days = Number(c.req.query('days') ?? 28);
  const audience = c.req.query('audience') ?? 'public';
  if (![7, 14, 28, 30].includes(days) || !['public', 'anonymous', 'member', 'admin'].includes(audience)) badRequest('Invalid report filter');
  if (reporting) return c.json({ error: 'Analytics report busy' }, 503);
  reporting = true;
  try {
    return await platformTransaction(async db => {
      await platformQuery(db, 'SET TRANSACTION READ ONLY');
      await platformQuery(db, "SET LOCAL statement_timeout = '2s'");
      // Reports deliberately contain no subject IDs, account IDs or event payloads.
      const base = `WITH events AS (
        SELECT event_name, occurred_at, dimensions,
          CASE WHEN user_id IS NULL THEN 'session:' || (dimensions->>'sessionId') ELSE 'user:' || user_id::text END AS subject,
          dimensions->>'sessionId' AS session
        FROM platform_analytics_events WHERE surface = 'web' AND dimensions->>'schemaVersion' = '1'
          AND occurred_at >= NOW() - make_interval(days => $1) AND expires_at > NOW()
          AND (($2 = 'public' AND dimensions->>'audience' IN ('anonymous', 'member')) OR dimensions->>'audience' = $2)
      )`;
      const [summary, pages, entries, frequency] = await Promise.all([
        platformQuery(db, `${base} SELECT COUNT(*)::int AS events, COUNT(DISTINCT session)::int AS sessions,
          COUNT(DISTINCT subject) FILTER (WHERE dimensions->>'audience' <> 'anonymous')::int AS "accountUsers",
          COUNT(DISTINCT session) FILTER (WHERE dimensions->>'audience' = 'anonymous')::int AS "anonymousSessions",
          MIN(occurred_at) AS "firstEventAt", MAX(occurred_at) AS "lastEventAt" FROM events`, [days, audience]),
        platformQuery(db, `${base} SELECT dimensions->>'route' AS route, dimensions->>'feature' AS feature,
          dimensions->>'deviceClass' AS device, dimensions->>'language' AS language,
          COUNT(*) FILTER (WHERE event_name = 'web.page_view')::int AS views,
          COUNT(DISTINCT subject)::int AS subjects, COUNT(DISTINCT session)::int AS sessions,
          COUNT(DISTINCT session) FILTER (WHERE event_name = 'web.page_engaged')::int AS "engagedSessions",
          COUNT(DISTINCT session) FILTER (WHERE event_name = 'web.feature_use')::int AS "usingSessions",
          COUNT(DISTINCT subject) FILTER (WHERE event_name = 'web.feature_use')::int AS "usingSubjects",
          COUNT(*) FILTER (WHERE event_name = 'web.feature_use')::int AS uses
          FROM events WHERE event_name IN ('web.page_view', 'web.page_engaged', 'web.feature_use')
          GROUP BY 1,2,3,4 ORDER BY views DESC LIMIT 1000`, [days, audience]),
        platformQuery(db, `${base}, exposures AS (
          SELECT session, dimensions->>'viewId' AS view, dimensions->>'entryId' AS entry,
            dimensions->>'placement' AS placement, dimensions->>'layoutVersion' AS layout,
            dimensions->>'position' AS position, dimensions->>'deviceClass' AS device,
            MIN(occurred_at) AS exposed_at FROM events WHERE event_name = 'web.entry_impression' GROUP BY 1,2,3,4,5,6,7
        ), clicks AS (
          SELECT session, dimensions->>'viewId' AS view, dimensions->>'entryId' AS entry,
            dimensions->>'placement' AS placement, dimensions->>'layoutVersion' AS layout,
            dimensions->>'position' AS position, dimensions->>'deviceClass' AS device, MIN(occurred_at) AS clicked_at
          FROM events WHERE event_name = 'web.entry_click' GROUP BY 1,2,3,4,5,6,7
        ) SELECT e.entry, e.placement, e.layout, e.position, e.device, COUNT(*)::int AS impressions,
          COUNT(c.clicked_at)::int AS clicks,
          COUNT(*) FILTER (WHERE c.clicked_at IS NOT NULL AND EXISTS (
            SELECT 1 FROM events u WHERE u.event_name = 'web.feature_use' AND u.session = e.session
              AND u.dimensions->>'feature' = e.entry AND u.dimensions->>'entryPoint' IN ('home', 'search')
              AND u.dimensions->>'sourceViewId' = e.view AND u.dimensions->>'sourcePlacement' = e.placement
              AND u.dimensions->>'sourcePosition' = e.position
              AND u.occurred_at >= c.clicked_at AND u.occurred_at < c.clicked_at + INTERVAL '30 minutes'
          ))::int AS "usedAfterClick"
          FROM exposures e LEFT JOIN clicks c ON c.session = e.session AND c.view = e.view AND c.entry = e.entry AND c.placement = e.placement
            AND c.layout = e.layout AND c.position = e.position AND c.device = e.device AND c.clicked_at >= e.exposed_at
          GROUP BY 1,2,3,4,5 ORDER BY impressions DESC LIMIT 1000`, [days, audience]),
        platformQuery(db, `${base}, per_user AS (
          SELECT subject, dimensions->>'feature' AS feature,
            COUNT(DISTINCT (occurred_at AT TIME ZONE 'UTC')::date)::int AS days,
            COUNT(DISTINCT session)::int AS sessions
          FROM events WHERE event_name = 'web.feature_use' AND dimensions->>'audience' <> 'anonymous' GROUP BY 1,2
        ) SELECT feature, COUNT(*)::int AS users, ROUND(AVG(days), 2)::float AS "activeDaysPerUser",
          ROUND(AVG(sessions), 2)::float AS "sessionsPerUser" FROM per_user GROUP BY feature`, [days, audience]),
      ]);
      return c.json({ days, audience, timezone: 'UTC', coverage: 'opted_in_web_only', retentionDays: 30,
        truncated: pages.length === 1000 || entries.length === 1000, summary: summary[0], pages, entries, frequency });
    });
  } finally { reporting = false; }
});
