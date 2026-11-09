import { defaultCompetitionNotificationPreferences, dueCompetitionReminders, matchesCompetitionAnnouncement,
  parseCompetitionNotificationPreferences, type CompetitionAnnouncement, type CompetitionRegistration } from '@cuberoot/shared/competition-notifications';
import { query } from '../db/connection.js';
import { formatDateRangeIso } from '../monitors/config.js';
import { ISO2_TO_CR } from './record_format.js';
import { notify } from './notify.js';

const CONTINENTS: Record<string, string> = { AfR: 'AF', AsR: 'AS', ER: 'EU', NAR: 'NA', OcR: 'OC', SAR: 'SA' };
interface Subscriber { id: number; wca_id: string | null; lang: string | null; preferences: unknown; updated_at: string; followed_at?: number }
const owner = (u: Subscriber) => u.wca_id || `u${u.id}`;
const localized = (lang: string | null, zh: string, en: string) => lang === 'zh' ? zh : lang === 'en' ? en : `${zh}\n${en}`;

/** Reuses the existing paginated announcement snapshot; independent of Bark's enabled/absorbed state. */
export async function observeCompetitionAnnouncements(comps: CompetitionAnnouncement[]): Promise<void> {
  for (const comp of comps) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(comp.id) || !Number.isFinite(Date.parse(comp.announced_at))) continue;
    await query(`INSERT INTO competition_announcement_events (comp_id, payload, announced_at)
      VALUES (?, ?, ?) ON CONFLICT (comp_id) DO UPDATE SET payload = EXCLUDED.payload
      WHERE competition_announcement_events.processed_at IS NULL`, [comp.id, comp, comp.announced_at]);
  }
  // Only the current, successfully fetched non-cancelled snapshot can authorize delivery.
  // Missing/cancelled events wait for expiry, never replayed from stale payload alone.
  const current = new Set(comps.map(comp => comp.id));
  const pending = await query<{ comp_id: string; payload: CompetitionAnnouncement; announced_at: string }>(
    `SELECT comp_id, payload, announced_at FROM competition_announcement_events
     WHERE processed_at IS NULL AND announced_at > NOW() - INTERVAL '48 hours' ORDER BY announced_at`);
  for (const event of pending) {
    if (!current.has(event.comp_id)) continue;
    try {
      const subscribers = await query<Subscriber>(`SELECT u.id, u.wca_id, u.lang, p.preferences, p.updated_at
        FROM competition_notification_preferences p JOIN app_users u ON u.id = p.user_id
        WHERE p.updated_at <= ? AND u.created_at <= ? AND u.merged_into_user_id IS NULL`, [event.announced_at, event.announced_at]);
      const comp = event.payload;
      const continent = CONTINENTS[ISO2_TO_CR[comp.country.toUpperCase()]];
      for (const user of subscribers) {
        const prefs = parseCompetitionNotificationPreferences(user.preferences) ?? defaultCompetitionNotificationPreferences();
        if (!matchesCompetitionAnnouncement(prefs, comp, continent)) continue;
        const details = [formatDateRangeIso(comp.start_date, comp.end_date), comp.city, comp.country.toUpperCase()].filter(Boolean).join(' | ');
        await notify({ recipients: [owner(user)], kind: 'comp_announcement', actorKey: '', actorName: '',
          title: localized(user.lang, comp.name_zh || comp.name, comp.name), excerpt: details,
          link: `/wca/comp/${comp.id}`, dedupeKey: comp.id, email: false });
      }
      await query('UPDATE competition_announcement_events SET processed_at = NOW() WHERE comp_id = ?', [event.comp_id]);
    } catch (error) {
      console.warn('[competition-notifications] announcement pending:', event.comp_id, (error as Error).message);
    }
  }
  await query(`DELETE FROM competition_announcement_events WHERE announced_at < NOW() - INTERVAL '7 days'`);
}

/** A fresh public detail, never the daily catalog or a stale-on-error cache. */
export async function fetchCompetitionRegistration(compId: string): Promise<CompetitionRegistration> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(compId)) throw new Error('Invalid competition ID');
  const response = await fetch(`https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'cuberoot.me/competition-reminders' },
    signal: AbortSignal.timeout(10_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Competition detail HTTP ${response.status}`);
  const value = await response.json() as Record<string, unknown>;
  const dateOrNull = (x: unknown) => x === null || (typeof x === 'string' && Number.isFinite(Date.parse(x)));
  if (!value || value.id !== compId || typeof value.name !== 'string' || !dateOrNull(value.cancelled_at)
    || !dateOrNull(value.registration_open) || !dateOrNull(value.registration_close)) throw new Error('Invalid competition schedule');
  return { id: compId, name: value.name, cancelled_at: value.cancelled_at as string | null,
    registration_open: value.registration_open as string | null, registration_close: value.registration_close as string | null };
}

export async function sweepCompetitionRegistrationReminders(): Promise<void> {
  const candidates = await query<{ comp_id: string }>(`SELECT DISTINCT f.comp_id, c.checked_at
    FROM comp_follows f JOIN app_users u ON f.wca_id IN (u.wca_id, 'u' || u.id::text)
    JOIN competition_notification_preferences p ON p.user_id = u.id
    LEFT JOIN competition_registration_checks c ON c.comp_id = f.comp_id
    WHERE u.merged_into_user_id IS NULL
      AND (p.preferences->>'registrationOpenMinutes' IS NOT NULL OR p.preferences->>'registrationCloseMinutes' IS NOT NULL)
      AND (c.next_check_at IS NULL OR c.next_check_at <= NOW())
    ORDER BY c.checked_at ASC NULLS FIRST, f.comp_id LIMIT 30`);
  for (const { comp_id: compId } of candidates) {
    // Fair scheduling persists across restarts. A failed source check retries in one minute.
    await query(`INSERT INTO competition_registration_checks (comp_id, checked_at, next_check_at)
      VALUES (?, NOW(), NOW() + INTERVAL '1 minute') ON CONFLICT (comp_id) DO UPDATE
      SET checked_at = NOW(), next_check_at = NOW() + INTERVAL '1 minute'`, [compId]);
    try {
      const comp = await fetchCompetitionRegistration(compId);
      // Re-read after the network request: unfollow/disable while fetching takes effect.
      const subscribers = await query<Subscriber>(`SELECT u.id, u.wca_id, u.lang, p.preferences, p.updated_at, f.created_at AS followed_at
        FROM comp_follows f JOIN app_users u ON f.wca_id IN (u.wca_id, 'u' || u.id::text)
        JOIN competition_notification_preferences p ON p.user_id = u.id
        WHERE f.comp_id = ? AND u.merged_into_user_id IS NULL`, [compId]);
      const now = Date.now();
      let nextCheck = now + 5 * 60_000;
      for (const user of subscribers) {
        const prefs = parseCompetitionNotificationPreferences(user.preferences);
        if (!prefs) continue;
        const since = Math.max(Number(user.followed_at), Date.parse(user.updated_at));
        for (const reminder of dueCompetitionReminders(comp, prefs, now, since)) {
          const when = new Date(reminder.at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
          const open = reminder.kind === 'comp_registration_open';
          await notify({ recipients: [owner(user)], kind: reminder.kind, actorKey: '', actorName: '',
            title: comp.name, excerpt: localized(user.lang,
              `${open ? '报名开放' : '报名截止'}：${when}`, `${open ? 'Registration opens' : 'Registration closes'}: ${when}`),
            link: `/wca/comp/${compId}`, dedupeKey: reminder.key, email: false });
        }
        for (const [date, lead] of [[comp.registration_open, prefs.registrationOpenMinutes],
          [comp.registration_close, prefs.registrationCloseMinutes]] as const) {
          if (!date || lead === null) continue;
          const fireAt = Date.parse(date) - lead * 60_000;
          if (fireAt > now) nextCheck = Math.min(nextCheck, fireAt);
        }
      }
      await query('UPDATE competition_registration_checks SET next_check_at = ? WHERE comp_id = ?', [new Date(nextCheck).toISOString(), compId]);
    } catch (error) {
      console.warn('[competition-notifications] registration check pending:', compId, (error as Error).message);
    }
  }
  await query(`DELETE FROM competition_registration_checks c WHERE NOT EXISTS (SELECT 1 FROM comp_follows f WHERE f.comp_id = c.comp_id)`);
}

export function startCompetitionRegistrationReminders(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void sweepCompetitionRegistrationReminders().catch(error => console.warn('[competition-notifications] sweep failed:', (error as Error).message))
      .finally(() => { running = false; });
  };
  setTimeout(run, 120_000).unref();
  setInterval(run, 60_000).unref();
}
