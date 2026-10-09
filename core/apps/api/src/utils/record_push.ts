import { randomBytes } from 'node:crypto';
import { query, withTransaction } from '../db/connection.js';
import { ApnsError, sendApnsRecord, type ApnsEnvironment } from './apns.js';
import { pushConfigured, type PushProvider } from './push_provider.js';
import { sendRecordPush } from './getui.js';

/** Inbox is the durable source. No replay before device opt-in or after an account switch. */
export async function sweepRecordPush(): Promise<void> {
  await query("DELETE FROM notification_push_devices WHERE refreshed_at < NOW() - INTERVAL '30 days'");
  await query(`DELETE FROM notification_push_deliveries p USING notifications n
    WHERE p.notification_id = n.id AND n.created_at < NOW() - INTERVAL '7 days'`);
  const targets = ['me.cuberoot.app', 'me.cuberoot.app.debug'].flatMap(app =>
    (['getui', 'apns'] as const).flatMap(provider =>
      (['sandbox', 'production'] as const).filter(environment => pushConfigured(app, provider, environment))
        .map(environment => [app, provider, environment])));
  if (!targets.length) return;
  const targetWhere = targets.map(() => '(d.app_id = ? AND d.provider = ? AND d.environment = ?)').join(' OR ');
  const targetValues = targets.flat();
  await query(`INSERT INTO notification_push_deliveries (notification_id, installation_id)
    SELECT n.id, d.installation_id FROM notification_push_devices d JOIN app_users u ON u.id = d.user_id
    JOIN notifications n ON n.user_key IN (u.wca_id, 'u' || u.id::text)
    WHERE n.kind = 'wca_record' AND n.created_at >= d.bound_at
      AND n.created_at > NOW() - INTERVAL '1 hour' AND d.refreshed_at > NOW() - INTERVAL '30 days'
      AND (${targetWhere})
    ON CONFLICT (notification_id, installation_id) DO NOTHING`, targetValues);
  // Hold the device lock through each bounded provider request: logout/rebind waits for
  // an in-flight send, then removes the device and all queued deliveries atomically.
  for (let index = 0; index < 30; index++) {
    const processed = await withTransaction(async run => {
      const rows = await run<{ id: number; installation_id: string; provider: PushProvider; environment: ApnsEnvironment; app_id: string; client_id: string; notification_id: number; title: string; excerpt: string; link: string; attempts: number }>(
        `SELECT p.id, d.installation_id, d.provider, d.environment, p.attempts, p.notification_id, d.app_id, d.client_id, n.title, n.excerpt, n.link
         FROM notification_push_deliveries p JOIN notification_push_devices d USING (installation_id)
         JOIN notifications n ON n.id = p.notification_id JOIN app_users u ON u.id = d.user_id
         WHERE p.accepted_at IS NULL AND p.attempts < 5 AND p.next_attempt_at <= NOW()
           AND n.created_at >= d.bound_at AND n.created_at > NOW() - INTERVAL '1 hour'
           AND n.user_key IN (u.wca_id, 'u' || u.id::text) AND d.refreshed_at > NOW() - INTERVAL '30 days'
           AND (${targetWhere})
         ORDER BY p.next_attempt_at LIMIT 1 FOR UPDATE OF p, d SKIP LOCKED`, targetValues);
      const row = rows[0];
      if (!row) return false;
      try {
        await (row.provider === 'apns'
          ? (appId: string, input: Parameters<typeof sendRecordPush>[1]) => sendApnsRecord(appId, row.environment, input)
          : sendRecordPush)(row.app_id, { clientId: row.client_id, requestId: randomBytes(16).toString('hex'),
          notificationId: Number(row.notification_id), title: row.title, excerpt: row.excerpt, link: row.link });
        await run('UPDATE notification_push_deliveries SET accepted_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = ?', [row.id]);
      } catch (error) {
        if (error instanceof ApnsError && error.invalidDevice) {
          await run('DELETE FROM notification_push_devices WHERE installation_id = ?', [row.installation_id]);
          return true;
        }
        // Keep diagnostic codes only; never persist provider response bodies/tokens/CIDs.
        const message = error instanceof ApnsError ? error.message : error instanceof Error && /^getui (?:HTTP|auth|push) \d+$/.test(error.message) ? error.message : 'Push attempt failed';
        await run(`UPDATE notification_push_deliveries SET attempts = ?, last_error = ?,
          next_attempt_at = NOW() + make_interval(secs => ?) WHERE id = ?`, [error instanceof ApnsError && !error.retryable ? 5 : row.attempts + 1, message, Math.min(900, 30 * 2 ** row.attempts), row.id]);
      }
      return true;
    });
    if (!processed) break;
  }
}

export function startRecordPushSweep(): void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void sweepRecordPush().catch(() => console.warn('[record-push] sweep failed')).finally(() => { running = false; });
  }, 30_000);
  timer.unref();
}
