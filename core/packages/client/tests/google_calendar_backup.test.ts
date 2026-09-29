import { afterEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { exportGoogleCalendars, googleBackupFile, readGoogleBackup, reviewGoogleBackup, listGoogleCalendars,
  type GoogleCalendarBackup } from '@/lib/google-calendar-backup';
import { expandOccurrences } from '@cuberoot/shared/recur';

const baseEvent = { id: 'master', iCalUID: 'series@google.com', etag: 'v1', status: 'confirmed', summary: 'Meeting',
  start: { dateTime: '2026-10-25T09:00:00-07:00', timeZone: 'America/Los_Angeles' },
  end: { dateTime: '2026-10-25T10:00:00-07:00' }, recurrence: ['RRULE:FREQ=WEEKLY;COUNT=4'],
  colorId: '5', attendees: [{ email: 'fixture@example.invalid', responseStatus: 'accepted' }],
  attachments: [{ fileUrl: 'https://example.invalid/file', title: 'File' }],
  conferenceData: { entryPoints: [{ uri: 'https://example.invalid/meeting' }] },
  extendedProperties: { private: { extra: 'keep me' } }, reminders: { useDefault: true },
};
function backup(): GoogleCalendarBackup {
  const events = [baseEvent,
    { id: 'moved', iCalUID: baseEvent.iCalUID, etag: 'v2', status: 'confirmed', recurringEventId: 'master',
      originalStartTime: { dateTime: '2026-11-01T09:00:00-08:00' },
      start: { dateTime: '2026-11-01T14:00:00-08:00', timeZone: 'America/Los_Angeles' }, end: { dateTime: '2026-11-01T15:00:00-08:00' },
      summary: 'Moved', colorId: '3' },
    { id: 'cancelled', etag: 'v3', status: 'cancelled', recurringEventId: 'master', originalStartTime: { dateTime: '2026-11-08T09:00:00-08:00' } },
    { id: 'dead', etag: 'v4', status: 'cancelled' },
    { id: 'allday', etag: 'v5', iCalUID: 'allday', summary: 'Trip', start: { date: '2026-12-31' }, end: { date: '2027-01-03' } },
  ];
  return { format: 'cuberoot-google-calendar', version: 1, exportedAt: '2026-09-28T00:00:00.000Z', colors: { event: { '5': { background: '#fbd75b' } } },
    settingsPages: [{ items: [{ id: 'timezone', value: 'America/Los_Angeles' }] }],
    calendars: [{ entry: { id: 'primary@example.invalid', summary: 'Work', timeZone: 'America/Los_Angeles', backgroundColor: '#9fe1e7', colorId: '14', defaultReminders: [{ method: 'popup', minutes: 15 }] },
      calendar: { etag: 'calendar-1', timeZone: 'America/Los_Angeles', labelProperties: { eventLabels: [{ id: 'custom', backgroundColor: '#1256AB', name: 'Custom' }] } },
      eventPages: [{ items: events }], labelEventPages: [{ items: events.map(e => ({ ...e, ...(e.id === 'moved' ? { eventLabelId: 'custom' } : {}) })) }] }],
  };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('complete Google file backup', () => {
  it('round-trips all raw fields, metadata, cancellations, settings and both color representations', async () => {
    const b = backup();
    expect(await readGoogleBackup(googleBackupFile(b))).toEqual(b);
    const review = reviewGoogleBackup(b);
    expect([review.archived, review.cancelled, review.skipped]).toEqual([5, 2, 0]);
    expect(review.sources[0].events).toHaveLength(3);
    expect(review.sources[0].color).toBe('peacock');
    expect(review.sources[0].events.find(e => e.title === 'Moved')?.color).toBe('#1256AB');
    expect(review.sources[0].events.find(e => e.title === 'Trip')?.color).toBe('peacock');
    const master = review.sources[0].events.find(e => e.title === 'Meeting')!;
    expect(master.reminders).toEqual([15]);
    expect(master.tz).toBe('America/Los_Angeles');
    expect(master.color).toBe('banana');
    expect(master.exdates).toEqual([Date.parse('2026-11-08T17:00:00Z'), Date.parse('2026-11-01T17:00:00Z')].sort((a,b)=>a-b));
    const occurrences = expandOccurrences({ ...master, durationMs: master.end - master.start, from: master.start, to: Date.parse('2026-12-01T00:00:00Z') });
    expect(occurrences).toEqual([Date.parse('2026-10-25T16:00:00Z'), Date.parse('2026-11-15T17:00:00Z')]);
  });
  it('does not manufacture an event from unsupported recurrence and retains raw data', () => {
    const b = backup(); b.calendars[0].eventPages[0].items![0] = { ...baseEvent, recurrence: ['RRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO'] };
    const r = reviewGoogleBackup(b);
    expect(r.skipped).toBe(3); expect(r.warnings).toContain('unsupported_recurrence');
    expect(r.sources[0].events.map(e => e.title)).toEqual(['Trip']);
  });
  it('refuses a label whose exact color is missing, rather than guessing', () => {
    const b = backup(); b.calendars[0].calendar.labelProperties = {};
    expect(() => reviewGoogleBackup(b)).toThrow('google_missing_color');
  });
  it('keeps custom calendar hex and applies it to inherited event colors', () => {
    const b = backup(); b.calendars[0].entry.backgroundColor = '#012345';
    const r = reviewGoogleBackup(b);
    expect(r.sources[0].color).toBe('#012345');
    expect(r.sources[0].events.find(e => e.title === 'Trip')?.color).toBe('#012345');
  });
  it('reports long text and unsupported reminder methods without deleting them from the archive', () => {
    const b = backup(); b.calendars[0].eventPages[0].items![0] = { ...baseEvent, description: 'x'.repeat(5100), reminders: { overrides: [{ method: 'email', minutes: 10 }] } };
    const r = reviewGoogleBackup(b);
    expect(r.warnings).toContain('text_limits'); expect(r.warnings).toContain('reminder_methods');
    expect(b.calendars[0].eventPages[0].items![0].description).toHaveLength(5100);
  });
  it('recognizes ordinary Google ZIP as a legacy import', async () => {
    const f = new File([new Uint8Array(zipSync({ 'a.ics': strToU8('BEGIN:VCALENDAR') }))], 'calendar.zip');
    expect(await readGoogleBackup(f)).toBeNull();
  });
  it.each(['version', 'duplicate', 'incomplete', 'labels'])('rejects corrupt or partial backup: %s', async mode => {
    const b = backup();
    if (mode === 'version') Object.assign(b, { version: 2 });
    if (mode === 'duplicate') b.calendars.push(b.calendars[0]);
    if (mode === 'incomplete') b.calendars[0].eventPages[0].nextPageToken = 'missing';
    if (mode === 'labels') b.calendars[0].labelEventPages[0].items = [];
    await expect(readGoogleBackup(googleBackupFile(b))).rejects.toThrow(/google_(invalid|incomplete)_backup/);
  });
  it('reads all pages including an empty intermediate page, only GETs fixed Google origin, and never serializes a token', async () => {
    const b = backup(), c = b.calendars[0];
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL, init: RequestInit) => {
      calls.push(url);
      expect(url.origin).toBe('https://www.googleapis.com'); expect(init.method ?? 'GET').toBe('GET');
      expect(init.headers).toEqual({ Authorization: 'Bearer secret-fixture' });
      let result: unknown;
      if (url.pathname.endsWith('/calendarList')) result = url.searchParams.has('pageToken') ? { items: [c.entry] } : { items: [], nextPageToken: 'next' };
      else if (url.pathname.endsWith('/colors')) result = b.colors;
      else if (url.pathname.endsWith('/settings')) result = b.settingsPages[0];
      else if (url.pathname.endsWith('/events')) {
        expect(url.searchParams.get('singleEvents')).toBe('false');
        expect(url.searchParams.get('showDeleted')).toBe('true');
        expect(url.searchParams.has('timeMin')).toBe(false); expect(url.searchParams.has('fields')).toBe(false);
        result = url.searchParams.get('eventLabelVersion') ? c.labelEventPages[0] : c.eventPages[0];
      } else result = c.calendar;
      return new Response(JSON.stringify(result));
    }));
    const signal = new AbortController().signal;
    const entries = await listGoogleCalendars('secret-fixture', signal);
    expect(entries).toEqual([c.entry]);
    const result = await exportGoogleCalendars('secret-fixture', entries, signal, vi.fn());
    expect(result.calendars[0]).toEqual(c); expect(JSON.stringify(result)).not.toContain('secret-fixture');
    expect(calls).toHaveLength(8);
  });
  it('rejects denied permission instead of returning an empty successful export', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    await expect(listGoogleCalendars('x', new AbortController().signal)).rejects.toThrow('google_access_denied');
  });
  it('rejects changed event snapshots', async () => {
    const c = backup().calendars[0];
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname.endsWith('/events')
      ? (url.searchParams.has('eventLabelVersion') ? { items: [] } : c.eventPages[0]) : c.calendar))));
    await expect(exportGoogleCalendars('x', [c.entry], new AbortController().signal, vi.fn())).rejects.toThrow('google_changed_during_export');
  });
});
