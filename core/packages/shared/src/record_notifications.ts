import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';

export const RECORD_NOTIFICATION_LEVELS = ['WR', 'CR', 'NR', 'FWR'] as const;
export type RecordNotificationLevel = typeof RECORD_NOTIFICATION_LEVELS[number];
export const RECORD_NOTIFICATION_EVENTS = WCA_EVENT_ORDER.filter(
  id => !['333ft', '333mbo', 'magic', 'mmagic'].includes(id),
);
export interface RecordNotificationPreferences {
  levels: RecordNotificationLevel[];
  events: string[];
  types: ('single' | 'average')[];
  /** Lowercase ISO2 countries; uppercase continent codes match RegionPicker. Empty means all. */
  regions: string[];
}
export function defaultRecordNotificationPreferences(): RecordNotificationPreferences {
  return { levels: [], events: [...RECORD_NOTIFICATION_EVENTS], types: ['single', 'average'], regions: [] };
}

/** Reject invalid settings rather than silently broadening a subscription. */
export function parseRecordNotificationPreferences(value: unknown): RecordNotificationPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['levels', 'events', 'types', 'regions'].includes(key))) return null;
  const strings = (v: unknown, max: number): v is string[] => Array.isArray(v)
    && v.length <= max && v.every(item => typeof item === 'string') && new Set(v).size === v.length;
  if (!strings(input.levels, 4) || !input.levels.every(v => (RECORD_NOTIFICATION_LEVELS as readonly string[]).includes(v))
    || !strings(input.events, 17) || !input.events.every(v => (RECORD_NOTIFICATION_EVENTS as readonly string[]).includes(v))
    || !strings(input.types, 2) || !input.types.every(v => v === 'single' || v === 'average')
    || !strings(input.regions, 256) || !input.regions.every(v => /^[a-z]{2}$/.test(v) || ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'].includes(v))) return null;
  return { levels: [...input.levels] as RecordNotificationLevel[], events: [...input.events],
    types: [...input.types] as ('single' | 'average')[], regions: [...input.regions] };
}

export interface RecordNotificationCandidate {
  personWcaId: string;
  personIso2: string;
  eventId: string;
  type: 'single' | 'average';
  tag: string;
  attemptResult: number;
}

export function matchesRecordNotification(
  preferences: RecordNotificationPreferences,
  ownWcaId: string | null,
  record: RecordNotificationCandidate,
  continent?: string,
): boolean {
  if (!Number.isInteger(record.attemptResult) || record.attemptResult <= 0) return false;
  const level = ['AsR', 'ER', 'NAR', 'SAR', 'AfR', 'OcR'].includes(record.tag) ? 'CR' : record.tag;
  if (level !== 'PR' && !(RECORD_NOTIFICATION_LEVELS as readonly string[]).includes(level)) return false;
  if (ownWcaId && ownWcaId === record.personWcaId) return true;
  const levels: RecordNotificationLevel[] = level === 'WR' ? ['WR', 'CR', 'NR']
    : level === 'CR' ? ['CR', 'NR'] : level === 'NR' || level === 'FWR' ? [level] : [];
  return levels.some(candidate => preferences.levels.includes(candidate))
    && preferences.events.includes(record.eventId) && preferences.types.includes(record.type)
    && (preferences.regions.length === 0 || preferences.regions.includes(record.personIso2.toLowerCase())
      || (!!continent && preferences.regions.includes(continent)));
}
