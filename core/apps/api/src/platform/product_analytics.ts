import { createHash } from 'node:crypto';
import { type AnalyticsAudience, type ProductAnalyticsEvent } from '@cuberoot/shared/product-analytics';
import { platformQuery, platformTransaction, type PlatformDb } from './db.js';

export interface AnalyticsSubject { userId: number | null; hash: string; audience: AnalyticsAudience }
export function analyticsSubject(userId: number | null, token: string, admin = false): AnalyticsSubject {
  return { userId, hash: createHash('sha256').update(token).digest('hex'), audience: userId == null ? 'anonymous' : admin ? 'admin' : 'member' };
}

/** Serializes legacy account consent writes; default Web ingestion does not use it. */
export async function lockAnalyticsSubject(db: PlatformDb, subject: Pick<AnalyticsSubject, 'userId' | 'hash'>): Promise<void> {
  await platformQuery(db, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    subject.userId == null ? `analytics:anonymous:${subject.hash}` : `analytics:user:${subject.userId}`,
  ]);
}

export async function recordAnalyticsBatch(subject: AnalyticsSubject, sessionId: string, events: ProductAnalyticsEvent[]): Promise<number> {
  return platformTransaction(async db => {
    await platformQuery(db, "SET LOCAL statement_timeout = '2s'");
    await platformQuery(db, "SET LOCAL lock_timeout = '250ms'");
    // A single statement is both atomic and idempotent across network retries.
    const rows = await platformQuery(db, `INSERT INTO platform_analytics_events
      (id, consent_id, user_id, anonymous_subject_hash, event_name, surface, dimensions, occurred_at, expires_at)
      SELECT (e->>'id')::uuid, $1::uuid, $2::bigint,
        CASE WHEN $2::bigint IS NULL THEN decode($3, 'hex') END,
        e->>'name', 'web',
        (e - 'id' - 'name' - 'occurredAt') || jsonb_build_object('sessionId', $4::text, 'audience', $5::text, 'schemaVersion', 1),
        (e->>'occurredAt')::timestamptz, NOW() + INTERVAL '30 days'
      FROM jsonb_array_elements($6::jsonb) e ON CONFLICT (id) DO NOTHING RETURNING id`,
    [null, subject.userId, subject.hash, sessionId, subject.audience, events]);
    return rows.length;
  });
}

/** Bounded cleanup; expired rows are also excluded from every report. */
export async function cleanupProductAnalytics(db: PlatformDb): Promise<void> {
  await platformQuery(db, `DELETE FROM platform_analytics_events WHERE id IN (
    SELECT id FROM platform_analytics_events WHERE expires_at <= NOW() ORDER BY expires_at LIMIT 5000)`);
}

export function startProductAnalyticsCleanup(db: PlatformDb): void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await cleanupProductAnalytics(db); }
    catch { console.error('[product-analytics] retention cleanup failed'); }
    finally { running = false; }
  };
  setInterval(() => { void run(); }, 60_000).unref();
}
