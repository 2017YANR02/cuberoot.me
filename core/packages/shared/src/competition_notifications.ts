import { RECORD_NOTIFICATION_EVENTS } from './record_notifications.js';

export const COMPETITION_REMINDER_MINUTES = [0, 10, 60, 1440] as const;
export type CompetitionReminderMinutes = typeof COMPETITION_REMINDER_MINUTES[number];
export interface CompetitionNotificationPreferences {
  announcements: boolean;
  events: string[];
  /** Host country/continent, unlike record subscriptions which filter the competitor. */
  regions: string[];
  registrationOpenMinutes: CompetitionReminderMinutes | null;
  registrationCloseMinutes: CompetitionReminderMinutes | null;
}
export function defaultCompetitionNotificationPreferences(): CompetitionNotificationPreferences {
  return { announcements: false, events: [...RECORD_NOTIFICATION_EVENTS], regions: [],
    registrationOpenMinutes: null, registrationCloseMinutes: null };
}
export function parseCompetitionNotificationPreferences(value: unknown): CompetitionNotificationPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ['announcements', 'events', 'regions', 'registrationOpenMinutes', 'registrationCloseMinutes'];
  const strings = (a: unknown, max: number): a is string[] => Array.isArray(a) && a.length <= max
    && a.every(x => typeof x === 'string') && new Set(a).size === a.length;
  const lead = (x: unknown): x is CompetitionReminderMinutes | null => x === null
    || (COMPETITION_REMINDER_MINUTES as readonly unknown[]).includes(x);
  if (Object.keys(v).some(k => !keys.includes(k)) || typeof v.announcements !== 'boolean'
    || !strings(v.events, RECORD_NOTIFICATION_EVENTS.length) || !v.events.every(x => (RECORD_NOTIFICATION_EVENTS as readonly string[]).includes(x))
    || !strings(v.regions, 256) || !v.regions.every(x => /^[a-z]{2}$/.test(x) || ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'].includes(x))
    || !lead(v.registrationOpenMinutes) || !lead(v.registrationCloseMinutes)) return null;
  return { announcements: v.announcements, events: [...v.events], regions: [...v.regions],
    registrationOpenMinutes: v.registrationOpenMinutes, registrationCloseMinutes: v.registrationCloseMinutes };
}

export interface CompetitionAnnouncement {
  id: string; name: string; name_zh: string | null; country: string; city: string;
  start_date: string; end_date: string; events: string[]; announced_at: string;
}
export function matchesCompetitionAnnouncement(p: CompetitionNotificationPreferences, c: CompetitionAnnouncement, continent?: string): boolean {
  return p.announcements && c.events.some(event => p.events.includes(event))
    && (!p.regions.length || p.regions.includes(c.country.toLowerCase()) || (!!continent && p.regions.includes(continent)));
}

export interface CompetitionRegistration {
  id: string; name: string;
  registration_open: string | null; registration_close: string | null;
  cancelled_at: string | null;
}
export const COMPETITION_REMINDER_GRACE_MS = 10 * 60_000;
export type CompetitionReminderKind = 'comp_registration_open' | 'comp_registration_close';
/** No local timezone arithmetic, historical replay, or late "in ten minutes" messages. */
export function dueCompetitionReminders(c: CompetitionRegistration, p: CompetitionNotificationPreferences, now: number, subscribedAt: number) {
  const open = c.registration_open ? Date.parse(c.registration_open) : NaN;
  const close = c.registration_close ? Date.parse(c.registration_close) : NaN;
  if (c.cancelled_at || !Number.isFinite(open) || !Number.isFinite(close) || close <= open || !Number.isFinite(subscribedAt)) return [];
  const milestones = [
    { kind: 'comp_registration_open' as const, at: open, minutes: p.registrationOpenMinutes },
    { kind: 'comp_registration_close' as const, at: close, minutes: p.registrationCloseMinutes },
  ];
  return milestones.flatMap(({ kind, at, minutes }) => {
    if (minutes === null) return [];
    const fireAt = at - minutes * 60_000;
    if (subscribedAt > fireAt || fireAt > now || now - fireAt >= COMPETITION_REMINDER_GRACE_MS
      || (minutes > 0 && now >= at) || (kind === 'comp_registration_open' && now >= close)) return [];
    return [{ kind, at, minutes, fireAt, key: `${c.id}:${kind}:${at}:${minutes}` }];
  });
}
