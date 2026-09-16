import { createHash } from 'node:crypto';
import { defaultRecordNotificationPreferences, matchesRecordNotification, parseRecordNotificationPreferences,
  type RecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
import { query, withTransaction } from '../db/connection.js';
import type { InferredRecord } from '../routes/cubing_live.js';
import { formatInferred } from '../routes/wca_recent_records.js';
import { ISO2_TO_CR } from './record_format.js';
import { notify } from './notify.js';

const CONTINENT_BY_RECORD: Record<string, string> = { AfR: 'AF', AsR: 'AS', ER: 'EU', NAR: 'NA', OcR: 'OC', SAR: 'SA' };
interface Subscriber {
  id: number; wca_id: string | null; lang: string | null;
  preferences: RecordNotificationPreferences | null;
  created_at: string; updated_at: string | null;
}

/** Source/tag changes must not turn the same achieved result into another notification. */
export function recordNotificationKey(record: InferredRecord): string {
  return createHash('sha256').update(JSON.stringify([
    record.compId, record.eventId, record.roundId, record.personWcaId || record.personName,
    record.type, record.attemptResult,
  ])).digest('hex');
}

/** Reuses the competition prewarmer and its adjudicated records; never scrapes another feed. */
export async function observeRecordNotifications(compId: string, records: InferredRecord[]): Promise<void> {
  await withTransaction(async tx => {
    const first = await tx<{ comp_id: string }>(
      'INSERT INTO record_notification_snapshots (comp_id) VALUES (?) ON CONFLICT DO NOTHING RETURNING comp_id', [compId],
    );
    // Serializes first-snapshot detection and event writes across overlapping warmers/processes.
    await tx('SELECT comp_id FROM record_notification_snapshots WHERE comp_id = ? FOR UPDATE', [compId]);
    for (const record of records) {
      await tx(
        `INSERT INTO record_notification_events (event_key, comp_id, payload, delivered)
         VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [recordNotificationKey(record), compId, record, first.length > 0],
      );
    }
  });
  await deliverRecordNotifications(compId);
}

export async function deliverRecordNotifications(compId: string): Promise<void> {
  const pending = await query<{ event_key: string; payload: InferredRecord; observed_at: string }>(
    `SELECT event_key, payload, observed_at FROM record_notification_events
     WHERE comp_id = ? AND NOT delivered ORDER BY observed_at, event_key`, [compId],
  );
  if (!pending.length) return;
  const subscribers = await query<Subscriber>(
    `SELECT u.id, u.wca_id, u.lang, u.created_at, p.preferences, p.updated_at
     FROM app_users u LEFT JOIN record_notification_preferences p ON p.user_id = u.id
     WHERE u.wca_id IS NOT NULL OR p.user_id IS NOT NULL`,
  );
  for (const item of pending) {
    const record = item.payload;
    const continent = CONTINENT_BY_RECORD[ISO2_TO_CR[record.personIso2.toUpperCase()]];
    const recipients = subscribers.filter(user => {
      if (Date.parse(user.created_at) > Date.parse(item.observed_at)) return false;
      const own = !!user.wca_id && user.wca_id === record.personWcaId;
      if (!own && user.updated_at && Date.parse(user.updated_at) > Date.parse(item.observed_at)) return false;
      const prefs = parseRecordNotificationPreferences(user.preferences) ?? defaultRecordNotificationPreferences();
      return matchesRecordNotification(prefs, user.wca_id, record, continent);
    });
    if (recipients.length) {
      // Each achievement has its own dedupe key; the other PR is delivered from its own event.
      const formatted = await formatInferred({ ...record, companionPr: undefined });
      if (!formatted.cn || !formatted.en) throw new Error(`Empty record notification: ${item.event_key}`);
      for (const user of recipients) {
        const excerpt = user.lang === 'zh' ? formatted.cn : user.lang === 'en' ? formatted.en : `${formatted.cn}\n${formatted.en}`;
        await notify({
          recipients: [user.wca_id || `u${user.id}`], kind: 'wca_record', actorKey: '', actorName: '',
          title: record.compNameEn, excerpt, dedupeKey: item.event_key,
          link: `/wca/comp/${encodeURIComponent(record.compId)}?event=${encodeURIComponent(record.eventId)}`,
        });
      }
    }
    await query('UPDATE record_notification_events SET delivered = TRUE WHERE event_key = ?', [item.event_key]);
  }
}
