import { describe, expect, it } from 'vitest';
import { defaultCompetitionNotificationPreferences as defaults, dueCompetitionReminders, matchesCompetitionAnnouncement,
  parseCompetitionNotificationPreferences, type CompetitionAnnouncement } from '@cuberoot/shared/competition-notifications';

const announcement: CompetitionAnnouncement = { id: 'Test2026', name: 'Test 2026', name_zh: null, country: 'cn', city: 'Shanghai',
  start_date: '2026-12-01', end_date: '2026-12-02', events: ['333'], announced_at: '2026-11-08T00:00:00Z' };
const registration = { id: announcement.id, name: announcement.name, cancelled_at: null,
  registration_open: '2026-11-08T18:00:00+08:00', registration_close: '2026-11-10T18:00:00+08:00' };
const open = Date.parse(registration.registration_open);

describe('competition subscription rules', () => {
  it('defaults to no notifications and validates without broadening malformed filters', () => {
    expect(parseCompetitionNotificationPreferences(defaults())).toEqual(defaults());
    const { systemPush, ...legacy } = defaults();
    expect(systemPush).toBe(false);
    expect(parseCompetitionNotificationPreferences(legacy)?.systemPush).toBe(false);
    expect(matchesCompetitionAnnouncement(defaults(), announcement, 'AS')).toBe(false);
    for (const patch of [{ systemPush: 1 }, { announcements: 1 }, { events: ['magic'] }, { events: ['333', '333'] },
      { regions: ['CN'] }, { regions: ['cn', 'cn'] }, { registrationOpenMinutes: -1 }, { registrationCloseMinutes: 10.1 }, { userId: 3 }]) {
      expect(parseCompetitionNotificationPreferences({ ...defaults(), ...patch })).toBeNull();
    }
  });
  it('matches the hosting region and at least one selected event', () => {
    const p = { ...defaults(), announcements: true, regions: ['AS'] };
    expect(matchesCompetitionAnnouncement(p, announcement, 'AS')).toBe(true);
    expect(matchesCompetitionAnnouncement(p, announcement, 'EU')).toBe(false);
    expect(matchesCompetitionAnnouncement({ ...p, regions: ['cn'] }, announcement)).toBe(true);
    expect(matchesCompetitionAnnouncement({ ...p, events: ['222'] }, announcement, 'AS')).toBe(false);
    expect(matchesCompetitionAnnouncement({ ...p, events: [] }, announcement, 'AS')).toBe(false);
  });
  it('uses absolute instants, separate opening/closing keys and a bounded recovery window', () => {
    const p = { ...defaults(), registrationOpenMinutes: 10 as const, registrationCloseMinutes: 60 as const };
    const due = dueCompetitionReminders(registration, p, open - 9 * 60_000, open - 86_400_000);
    expect(due).toEqual([{ kind: 'comp_registration_open', at: open, minutes: 10, fireAt: open - 600_000,
      key: `Test2026:comp_registration_open:${open}:10` }]);
    expect(dueCompetitionReminders(registration, p, open - 601_000, 0)).toEqual([]);
    expect(dueCompetitionReminders(registration, p, open, 0)).toEqual([]);
    const close = Date.parse(registration.registration_close);
    expect(dueCompetitionReminders(registration, p, close - 3_600_000, 0)[0].kind).toBe('comp_registration_close');
    expect(dueCompetitionReminders(registration, { ...p, registrationOpenMinutes: 0 }, open + 599_999, 0)).toHaveLength(1);
    expect(dueCompetitionReminders(registration, { ...p, registrationOpenMinutes: 0 }, open + 600_000, 0)).toEqual([]);
  });
  it('suppresses cancelled, invalid, expired and subscribed-after-trigger reminders', () => {
    const p = { ...defaults(), registrationOpenMinutes: 0 as const };
    for (const patch of [{ cancelled_at: '2026-11-07' }, { registration_open: null }, { registration_close: 'invalid' },
      { registration_close: registration.registration_open }]) {
      expect(dueCompetitionReminders({ ...registration, ...patch }, p, open, 0)).toEqual([]);
    }
    expect(dueCompetitionReminders(registration, p, open + 100, open + 1)).toEqual([]);
    expect(dueCompetitionReminders(registration, p, open, NaN)).toEqual([]);
    expect(dueCompetitionReminders(registration, defaults(), open, 0)).toEqual([]);
    const changed = { ...registration, registration_open: '2026-11-09T18:00:00+08:00' };
    expect(dueCompetitionReminders(changed, p, open, 0)).toEqual([]);
    expect(dueCompetitionReminders(changed, p, open + 86_400_000, 0)[0].key)
      .not.toBe(dueCompetitionReminders(registration, p, open, 0)[0].key);
  });
});
