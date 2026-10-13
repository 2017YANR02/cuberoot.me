import { Hono, type Context } from 'hono';
import { readFile } from 'node:fs/promises';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { ORDER_CASH_FLOW_SQL } from '../platform/cash_flow.js';

// The hourly monitor owns collection. Requests here only read its last snapshot.
async function trafficSnapshot() {
  try {
    const raw = JSON.parse(await readFile(process.env.TRAFFIC_REPORT_PATH || '/root/core-api/data/traffic-report.json', 'utf8'));
    if (!Number.isFinite(Date.parse(raw.windowStart)) || !Number.isFinite(Date.parse(raw.windowEnd)) || !Array.isArray(raw.sources)) return null;
    const sources = raw.sources.filter((s: { source: string }) => ['nginx', 'next', 'api', 'vercel'].includes(s.source)).map((s: Record<string, unknown>) => {
      if (!['observed', 'no_matching_requests', 'not_connected'].includes(String(s.coverage))) throw new Error('Invalid coverage');
      for (const key of ['requests', 'pageCandidates', 'unexpected5xx']) {
        if (!Number.isSafeInteger(s[key]) || Number(s[key]) < 0) throw new Error('Invalid count');
      }
      // Deliberately exclude source attribution, routes, referrers and raw logs.
      return { source: s.source, coverage: s.coverage, requests: s.requests, pageCandidates: s.pageCandidates, unexpected5xx: s.unexpected5xx };
    });
    return { windowStart: raw.windowStart, windowEnd: raw.windowEnd, stale: Date.now() - Date.parse(raw.windowEnd) > 3 * 3600_000, sources };
  } catch { return null; }
}

export function createAdminDashboardRoutes(options: {
  authorize?: (c: Context) => Promise<unknown>;
  runQuery?: typeof query;
} = {}) {
  const routes = new Hono();
  const runQuery = options.runQuery ?? query;
  routes.get('/admin/dashboard', async c => {
    c.header('Cache-Control', 'private, no-store');
    await (options.authorize ?? requireAdminOrApiKey)(c);
    const days = Number(c.req.query('days') ?? 30);
    if (![7, 30, 90].includes(days)) return c.json({ error: 'Invalid days' }, 400);
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1)).toISOString().slice(0, 10);
    const [pending, revenue, sponsors, traffic] = await Promise.allSettled([
      runQuery<{ feedback: number; threads: number; posts: number; reports: number; sponsorClaims: number }>(`SELECT
        (SELECT COUNT(*)::int FROM feedback WHERE status IN ('new','triaged')) AS feedback,
        (SELECT COUNT(*)::int FROM forum_threads t WHERE t.status='pending' AND NOT t.is_deleted
          AND EXISTS (SELECT 1 FROM forum_posts p WHERE p.thread_id=t.id)) AS threads,
        (SELECT COUNT(*)::int FROM forum_posts p JOIN forum_threads t ON t.id=p.thread_id
          WHERE p.status='pending' AND NOT p.is_deleted AND t.status='approved' AND NOT t.is_deleted) AS posts,
        (SELECT COUNT(*)::int FROM forum_reports r JOIN forum_posts p ON p.id=r.post_id
          JOIN forum_threads t ON t.id=p.thread_id WHERE r.resolved_at IS NULL) AS reports,
        (SELECT COUNT(*)::int FROM sponsor_claims WHERE status='pending') AS "sponsorClaims"`),
      // Cash-flow dates, not order creation dates. Refunded orders retain their original receipt.
      // Keep PG numeric sums as decimal strings to avoid losing minor-unit precision.
      runQuery<{ date: string; currency: string; receivedMinor: string; refundedMinor: string }>(`WITH bounds AS (
        SELECT ?::date AT TIME ZONE 'UTC' AS start_at, (?::date + 1) AT TIME ZONE 'UTC' AS end_at)
        SELECT (occurred_at AT TIME ZONE 'UTC')::date::text AS date, currency,
        SUM(paid)::text AS "receivedMinor", SUM(refunded)::text AS "refundedMinor"
        FROM (${ORDER_CASH_FLOW_SQL}) flows GROUP BY date, currency ORDER BY date, currency`, [from, to]),
      // Sponsors store cumulative amounts without a payment date; never invent a daily trend.
      runQuery<{ currency: string; amount: string }>('SELECT currency, SUM(amount)::text AS amount FROM sponsors GROUP BY currency ORDER BY currency'),
      trafficSnapshot(),
    ]);
    return c.json({ from, to, timeZone: 'UTC', updatedAt: now.toISOString(),
      pending: pending.status === 'fulfilled' ? pending.value[0] ?? null : null,
      revenue: revenue.status === 'fulfilled' ? revenue.value : null,
      sponsors: sponsors.status === 'fulfilled' ? sponsors.value : null,
      traffic: traffic.status === 'fulfilled' ? traffic.value : null,
    });
  });
  return routes;
}

export const adminDashboardRoutes = createAdminDashboardRoutes();
