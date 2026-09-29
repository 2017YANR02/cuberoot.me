import { describe, expect, it } from 'vitest';
import { meetingOccurrences, validateMeetingDraft, type MeetingPlan } from '@cuberoot/shared/meeting';

const plan: MeetingPlan = {
  id: 'test', code: '0427', title: 'Lesson', tz: 'America/Los_Angeles',
  start: Date.parse('2026-10-26T16:00:00Z'), end: Date.parse('2026-10-26T16:30:00Z'),
  rrule: 'FREQ=WEEKLY;COUNT=3', cancelled: false,
};
describe('meeting schedules', () => {
  it('keeps 09:00 local time across the autumn DST transition', () => {
    expect(meetingOccurrences(plan, Date.parse('2026-10-01'), Date.parse('2026-12-01')).map(row => new Date(row.start).toISOString()))
      .toEqual(['2026-10-26T16:00:00.000Z', '2026-11-02T17:00:00.000Z', '2026-11-09T17:00:00.000Z']);
  });
  it('includes a meeting in progress but excludes one ending at the window boundary', () => {
    expect(meetingOccurrences({ ...plan, rrule: '' }, plan.start + 1, plan.end + 1)).toHaveLength(1);
    expect(meetingOccurrences({ ...plan, rrule: '' }, plan.end, plan.end + 1)).toHaveLength(0);
  });
  it('does not resurrect cancelled series or restart COUNT in later windows', () => {
    expect(meetingOccurrences({ ...plan, cancelled: true }, plan.start, plan.end + 30 * 86400000)).toEqual([]);
    expect(meetingOccurrences(plan, Date.parse('2026-11-10'), Date.parse('2026-12-10'))).toEqual([]);
  });
  it('rejects invalid titles, time zones, durations and recurrence', () => {
    for (const change of [{ title: ' ' }, { title: 'x'.repeat(121) }, { tz: 'Invalid/Zone' },
      { end: plan.start }, { end: plan.start + 86400001 }, { start: NaN }, { rrule: 'FREQ=INVALID' }]) {
      expect(validateMeetingDraft({ ...plan, ...change })).toBeNull();
    }
    expect(validateMeetingDraft({ ...plan, title: ' Lesson ' })?.title).toBe('Lesson');
  });
});
