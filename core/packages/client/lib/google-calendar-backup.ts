// Browser-only Google reads. No token is serialized, logged, or sent to CubeRoot.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { isCalendarHexColor, parseIcs, type ParsedIcsEvent } from '@cuberoot/shared/calendar';
import { isValidZone, wallToUtc } from '@cuberoot/shared/tz';
import { formatUntil } from '@cuberoot/shared/recur';
import { CALENDAR_COLOR_DEFS, GOOGLE_LABEL_COLORS } from './calendar-colors';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const ENTRY = 'cuberoot-google-calendar.json';
const MAX_BYTES = 100 * 1024 * 1024;
type Raw = Record<string, unknown>;
export interface GoogleCalendarEntry extends Raw {
  id: string; summary?: string; summaryOverride?: string; timeZone?: string;
  accessRole?: string; primary?: boolean; backgroundColor?: string; colorId?: string;
}
interface GoogleTime { date?: string; dateTime?: string; timeZone?: string }
interface GoogleEvent extends Raw {
  id: string; iCalUID?: string; recurringEventId?: string; originalStartTime?: GoogleTime;
  summary?: string; description?: string; location?: string; status?: string;
  start?: GoogleTime; end?: GoogleTime; recurrence?: string[]; colorId?: string; eventLabelId?: string;
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
}
interface Page extends Raw { items?: Raw[]; nextPageToken?: string }
export interface GoogleCalendarArchive {
  entry: GoogleCalendarEntry;
  calendar: Raw;
  /** Unfiltered responses, including fields CubeRoot does not yet render. */
  eventPages: Page[];
  labelEventPages: Page[];
}
export interface GoogleCalendarBackup {
  format: 'cuberoot-google-calendar'; version: 1; exportedAt: string;
  colors: Raw; settingsPages: Page[]; calendars: GoogleCalendarArchive[];
}
export interface GoogleImportSource {
  name: string; color: string; tz: string; events: ParsedIcsEvent[];
}
export interface GoogleImportReview {
  sources: GoogleImportSource[]; archived: number; cancelled: number; skipped: number;
  /** Kept in the file but cannot be restored as live CubeRoot functionality. */
  warnings: string[];
}

function record(v: unknown): v is Raw { return !!v && typeof v === 'object' && !Array.isArray(v); }
function fail(code: string): never { throw new Error(code); }

async function googleGet(token: string, path: string, params: Record<string, string>, signal: AbortSignal): Promise<Raw> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store', credentials: 'omit' });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000 * 2 ** attempt);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
      continue;
    }
    if (!r.ok) fail(r.status === 401 ? 'google_expired' : r.status === 403 ? 'google_access_denied' : `google_http_${r.status}`);
    const data: unknown = await r.json();
    if (!record(data)) fail('google_invalid_response');
    return data;
  }
}

async function pages(token: string, path: string, params: Record<string, string>, signal: AbortSignal): Promise<Page[]> {
  const out: Page[] = [], seen = new Set<string>();
  let pageToken = '';
  do {
    const page = await googleGet(token, path, { ...params, ...(pageToken ? { pageToken } : {}) }, signal) as Page;
    if (page.items != null && (!Array.isArray(page.items) || !page.items.every(record))) fail('google_invalid_response');
    out.push(page);
    pageToken = page.nextPageToken || '';
    if (pageToken && seen.has(pageToken)) fail('google_pagination_loop');
    seen.add(pageToken);
  } while (pageToken);
  return out;
}

export async function listGoogleCalendars(token: string, signal: AbortSignal): Promise<GoogleCalendarEntry[]> {
  return (await pages(token, 'users/me/calendarList', { maxResults: '250', showHidden: 'true' }, signal))
    .flatMap(p => p.items ?? []).map(e => {
      if (typeof e.id !== 'string') fail('google_invalid_response');
      return e as GoogleCalendarEntry;
    });
}

/** No date window, event-type filter, attendee limit, or field projection. */
export async function exportGoogleCalendars(token: string, entries: GoogleCalendarEntry[], signal: AbortSignal,
  progress: (done: number, total: number) => void): Promise<GoogleCalendarBackup> {
  if (!entries.length) fail('google_no_calendars');
  const colors = await googleGet(token, 'colors', {}, signal);
  const settingsPages = await pages(token, 'users/me/settings', { maxResults: '250' }, signal);
  const calendars: GoogleCalendarArchive[] = [];
  progress(0, entries.length);
  for (const entry of entries) {
    const path = `calendars/${encodeURIComponent(entry.id)}`;
    const calendar = await googleGet(token, path, {}, signal);
    const params = { maxResults: '2500', singleEvents: 'false', showDeleted: 'true', showHiddenInvitations: 'true' };
    const eventPages = await pages(token, `${path}/events`, params, signal);
    const labelEventPages = await pages(token, `${path}/events`, { ...params, eventLabelVersion: '1' }, signal);
    // A calendar edited between the two reads must be retried, never silently paired by position.
    const legacy = new Map(eventPages.flatMap(p => p.items ?? []).map(e => [e.id, e.etag]));
    const labeled = labelEventPages.flatMap(p => p.items ?? []);
    if (legacy.size !== labeled.length || labeled.some(e => !legacy.has(e.id) || legacy.get(e.id) !== e.etag)) fail('google_changed_during_export');
    if ((await googleGet(token, path, {}, signal)).etag !== calendar.etag) fail('google_changed_during_export');
    calendars.push({ entry, calendar, eventPages, labelEventPages });
    progress(calendars.length, entries.length);
  }
  return { format: 'cuberoot-google-calendar', version: 1, exportedAt: new Date().toISOString(), colors, settingsPages, calendars };
}

export function googleBackupFile(backup: GoogleCalendarBackup): File {
  const bytes = strToU8(JSON.stringify(backup));
  if (bytes.length > MAX_BYTES) fail('google_backup_too_large');
  const zip = zipSync({ [ENTRY]: bytes, 'README.txt': strToU8(
    'CubeRoot Google Calendar backup v1\nUpload this ZIP to CubeRoot Calendar.\n'
    + 'Raw API records preserve colors, labels, recurrence exceptions, reminders, attendees, conference data, attachment metadata/links and other returned fields.\n'
    + 'Does not include attachment file contents, Google Tasks, ACL/sharing permissions, inaccessible private data or permanently deleted data.\n'
    + 'Import restores supported personal events; it does not invite guests, recreate conferences or send notifications. Keep this file for fields not yet supported.\n'
    + 'Export is a point-in-time read, not ongoing sync. No access token is included.\n'
  ) });
  return new File([new Uint8Array(zip)], `google-calendar-${backup.exportedAt.slice(0, 10)}.zip`, { type: 'application/zip' });
}

export async function readGoogleBackup(file: File): Promise<GoogleCalendarBackup | null> {
  if (!/\.zip$/i.test(file.name)) return null;
  if (file.size > MAX_BYTES) fail('google_backup_too_large');
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: f => {
    if (f.name !== ENTRY) return false;
    if (f.size > MAX_BYTES) fail('google_backup_too_large');
    return true;
  } });
  if (!entries[ENTRY]) return null;
  const b: unknown = JSON.parse(strFromU8(entries[ENTRY]));
  if (!record(b) || b.format !== 'cuberoot-google-calendar' || b.version !== 1 || !Array.isArray(b.calendars)
    || !record(b.colors) || !Array.isArray(b.settingsPages) || typeof b.exportedAt !== 'string') fail('google_invalid_backup');
  const ids = new Set<string>();
  for (const c of b.calendars) {
    if (!record(c) || !record(c.entry) || typeof c.entry.id !== 'string' || !record(c.calendar)
      || !Array.isArray(c.eventPages) || !Array.isArray(c.labelEventPages) || ids.has(c.entry.id)) fail('google_invalid_backup');
    ids.add(c.entry.id);
    for (const group of [c.eventPages, c.labelEventPages]) {
      const eventIds = new Set<string>();
      for (const p of group) {
        if (!record(p) || (p.items != null && !Array.isArray(p.items))) fail('google_invalid_backup');
        for (const e of (p.items ?? []) as unknown[]) {
          if (!record(e) || typeof e.id !== 'string' || eventIds.has(e.id)) fail('google_invalid_backup');
          eventIds.add(e.id);
        }
      }
      if (!group.length || group.at(-1)?.nextPageToken) fail('google_incomplete_backup');
    }
    const legacyIds = new Set(c.eventPages.flatMap(p => p.items ?? []).map((e: Raw) => e.id));
    const labels = c.labelEventPages.flatMap(p => p.items ?? []);
    if (legacyIds.size !== labels.length || labels.some((e: Raw) => !legacyIds.has(e.id))) fail('google_incomplete_backup');
  }
  return b as unknown as GoogleCalendarBackup;
}

const EVENT_COLORS = ['lavender', 'sage', 'grape', 'flamingo', 'banana', 'tangerine', 'peacock', 'graphite', 'blueberry', 'basil', 'tomato'];
function exactColor(value: unknown): string {
  if (typeof value !== 'string' || !isCalendarHexColor(value)) return '';
  return CALENDAR_COLOR_DEFS.find(c => c.hex.toLowerCase() === value.toLowerCase())?.key
    ?? (GOOGLE_LABEL_COLORS[value.toLowerCase()] ? `google:${value.toLowerCase()}` : value);
}
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r/g, '\\n');
function timeLine(name: string, time: GoogleTime | undefined): string {
  if (time?.date && /^\d{4}-\d{2}-\d{2}$/.test(time.date)) return `${name};VALUE=DATE:${time.date.replace(/-/g, '')}`;
  if (time?.dateTime && Number.isFinite(Date.parse(time.dateTime))) return `${name}:${formatUntil(Date.parse(time.dateTime))}`;
  return '';
}

/** Reuse the canonical ICS exception/cancellation parser, never flatten repeat series. */
export function reviewGoogleBackup(backup: GoogleCalendarBackup): GoogleImportReview {
  const sources: GoogleImportSource[] = [];
  const warnings = new Set<string>(['archive_only_fields']);
  let archived = 0, cancelled = 0, skipped = 0;
  for (const c of backup.calendars) {
    const tz = typeof c.calendar.timeZone === 'string' && isValidZone(c.calendar.timeZone) ? c.calendar.timeZone : c.entry.timeZone;
    if (!tz || !isValidZone(tz)) fail('google_invalid_timezone');
    const fallback = exactColor(c.entry.backgroundColor);
    if (!fallback) fail('google_missing_color');
    // Defaults 14/16 verified against Google's UI; custom hex remains exact and is never approximated.
    const color = c.entry.colorId === '14' && c.entry.backgroundColor?.toLowerCase() === '#9fe1e7' ? 'peacock'
      : c.entry.colorId === '16' && c.entry.backgroundColor?.toLowerCase() === '#4986e7' ? 'blueberry' : fallback;
    const calendarPalette = backup.colors.calendar;
    if (color === fallback && isCalendarHexColor(fallback) && record(calendarPalette)
      && Object.values(calendarPalette).some(v => record(v) && v.background === c.entry.backgroundColor)) {
      warnings.add('legacy_calendar_palette');
    }
    const labels = record(c.calendar.labelProperties) && Array.isArray(c.calendar.labelProperties.eventLabels)
      ? c.calendar.labelProperties.eventLabels.filter(record) : [];
    const labelEvents = new Map(c.labelEventPages.flatMap(p => p.items ?? []).map(e => [e.id, e]));
    const events = c.eventPages.flatMap(p => p.items ?? []) as GoogleEvent[];
    const masters = new Map(events.map(e => [e.id, e]));
    const unsupported = new Set<string>();
    for (const e of events) {
      if (!Array.isArray(e.recurrence)) continue;
      const rules = e.recurrence.filter(r => r.startsWith('RRULE:'));
      if (rules.length > 1 || e.recurrence.some(r => !/^(RRULE:|EXDATE[:;])/.test(r))
        || rules.some(r => /[\r\n]/.test(r) || r.slice(6).split(';').some(p => !/^(FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)|INTERVAL=\d+|COUNT=\d+|UNTIL=\d{8}(T\d{6}Z)?|BYDAY=[A-Z0-9,+-]+|BYMONTHDAY=[0-9,-]+|WKST=MO)$/.test(p))
          || Number(/COUNT=(\d+)/.exec(r)?.[1] ?? 0) > 2000)) unsupported.add(e.id);
    }
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0'];
    const sourceZones = new Map<string, string>();
    for (const e of events) {
      archived++;
      if (e.status === 'cancelled') cancelled++;
      if (unsupported.has(e.id) || (e.recurringEventId && unsupported.has(e.recurringEventId))) {
        skipped++; warnings.add('unsupported_recurrence'); continue;
      }
      const master = e.recurringEventId ? masters.get(e.recurringEventId) : e;
      const uid = master?.iCalUID || e.iCalUID || master?.id || e.id;
      const eventZone = e.start?.timeZone || master?.start?.timeZone || tz;
      if (!isValidZone(eventZone)) fail('google_invalid_timezone');
      if (e.start?.dateTime) sourceZones.set(`${uid}|${Date.parse(e.start.dateTime)}`, eventZone);
      else if (e.start?.date && /^\d{4}-\d{2}-\d{2}$/.test(e.start.date)) {
        const [y, mo, d] = e.start.date.split('-').map(Number);
        sourceZones.set(`${uid}|${wallToUtc(tz, { y, mo, d, h: 0, mi: 0, s: 0 }).getTime()}`, eventZone);
      }
      const start = timeLine('DTSTART', e.start ?? e.originalStartTime);
      const end = timeLine('DTEND', e.end);
      if (e.status === 'cancelled' && !e.recurringEventId) continue;
      if (!start || (e.status !== 'cancelled' && !end)) { skipped++; warnings.add('invalid_event'); continue; }
      let eventColor = e.colorId ? EVENT_COLORS[Number(e.colorId) - 1] : color;
      const labelId = labelEvents.get(e.id)?.eventLabelId;
      if (typeof labelId === 'string' && labelId) {
        eventColor = exactColor(labels.find(l => l.id === labelId)?.backgroundColor);
      }
      if (!eventColor) fail('google_missing_color');
      if ((e.summary?.length ?? 0) > 300 || (e.description?.length ?? 0) > 5000 || (e.location?.length ?? 0) > 300) {
        warnings.add('text_limits');
      }
      lines.push('BEGIN:VEVENT', `UID:${esc(uid)}`, start);
      if (end) lines.push(end);
      if (e.recurringEventId) {
        const original = timeLine('RECURRENCE-ID', e.originalStartTime);
        if (!original) fail('google_invalid_exception');
        lines.push(original);
      }
      if (e.status === 'cancelled') lines.push('STATUS:CANCELLED');
      lines.push(`SUMMARY:${esc(e.summary || '')}`, `DESCRIPTION:${esc(e.description || '')}`, `LOCATION:${esc(e.location || '')}`, `X-CUBEROOT-COLOR:${eventColor}`);
      for (const r of e.recurrence ?? []) {
        if (/[\r\n]/.test(r)) fail('google_invalid_recurrence');
        lines.push(r);
      }
      const defaults = c.entry.defaultReminders;
      const reminders = e.reminders?.useDefault ? (Array.isArray(defaults) ? defaults.filter(record) : []) : (e.reminders?.overrides ?? []);
      for (const r of reminders) {
        if (r.method !== 'popup') { warnings.add('reminder_methods'); continue; }
        if (typeof r.minutes !== 'number' || r.minutes < 0 || r.minutes > 40320) { warnings.add('reminder_limits'); continue; }
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${r.minutes}M`, 'END:VALARM');
      }
      if (reminders.length > 5) warnings.add('reminder_limits');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const parsed = parseIcs(lines.join('\r\n'), tz);
    // UTC DTSTARTs retain their event's own timezone for DST-aware recurrence expansion.
    for (const p of parsed) {
      p.tz = sourceZones.get(`${p.uid}|${p.start}`) || tz;
      if (p.exdates.length > 400) fail('google_exception_limit');
      if (p.start < 0 || p.end > 7258118400000 || p.end - p.start > 366 * 86400000) fail('google_time_limit');
    }
    sources.push({ name: c.entry.summaryOverride || c.entry.summary || c.entry.id, tz, color, events: parsed });
  }
  return { sources, archived, cancelled, skipped, warnings: [...warnings] };
}
