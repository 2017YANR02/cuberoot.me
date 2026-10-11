import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildCalendarData, calendarWindow, type CalendarManifest, type CalendarMonth } from '@cuberoot/shared/competition-calendar';
import type { PastCompRecord, UpcomingCompRecord } from '@cuberoot/shared';
import { countryToIso2 } from '@cuberoot/shared/country-flag';
const root = fileURLToPath(new URL('../../../../stats/', import.meta.url));
const read = (file: string) => JSON.parse(readFileSync(root + file, 'utf8'));
const past: PastCompRecord[] = read('all_past_comps.json');
const upcoming: UpcomingCompRecord[] = read('all_upcoming_comps.json');
const ids = new Set(upcoming.map(c => c.id));
const historical = past.filter(c => !ids.has(c.id));
const all = [...upcoming, ...historical.map(c => ({ ...c, country: countryToIso2(c.country).toUpperCase() || c.country }))];
const manifest: CalendarManifest = read('comp_calendar/index.json');
describe('complete calendar window transport', () => {
  it('matches every record in every visible month, including adjacent grid days', () => {
    const generated = buildCalendarData(past, upcoming);
    expect(Object.keys(manifest.months)).toEqual(Object.keys(generated.months));
    for (const [month, hash] of Object.entries(manifest.months)) {
      const shard: CalendarMonth = read(`comp_calendar/${month}.json`);
      const [start, end] = calendarWindow(month);
      const intersects = (c: PastCompRecord | UpcomingCompRecord) => c.start_date <= end && (c.end_date || c.start_date) >= start;
      const expected = { past: historical.filter(intersects), upcoming: upcoming.filter(intersects) };
      expect({ past: shard.past, upcoming: shard.upcoming }, month).toEqual(expected);
      expect(generated.months[month], month).toEqual(expected);
      expect(shard.contentHash, month).toBe(hash);
      expect(createHash('sha256').update(JSON.stringify(expected)).digest('hex').slice(0, 16), month).toBe(hash);
    }
    const { months: _, version: __, ...summary } = manifest;
    expect(summary).toEqual(generated.summary);
  });
  it('retains global first appearances and country options across the entire merged directory', () => {
    const sorted = [...all].sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const [country, id] of Object.entries(manifest.firstCountry)) expect(sorted.find(c => c.country.toUpperCase() === country)?.id).toBe(id);
    for (const [event, id] of Object.entries(manifest.firstEvent)) expect(sorted.find(c => c.events.includes(event))?.id).toBe(id);
    expect(new Set(manifest.countryOptions)).toEqual(new Set(all.map(c => c.country)));
    expect(manifest.yearMonths['1982']).toContain(6);
    expect(manifest.firstCountry.HU).toBe('WC1982');
  });
  it('includes cross-year competitions and rejects duplicates within a source', () => {
    const row = { ...past[0], id: 'CrossYear', start_date: '2025-12-31', end_date: '2026-01-02' };
    const result = buildCalendarData([row], []);
    expect(result.months['2026-01'].past).toEqual([row]);
    expect(result.months['2025-12'].past).toEqual([row]);
    expect(() => buildCalendarData([row, row], [])).toThrow('duplicate');
    expect(buildCalendarData([row], [{ ...upcoming[0], id: row.id, start_date: row.start_date, end_date: row.end_date }]).months['2026-01'].past).toEqual([]);
  });
});
