import { describe, expect, it } from 'vitest';
import { computeCalendarLayout, type ScheduleData } from '@/lib/comp-schedule';
import { formatCompDateTime, formatCubingDeadline } from '@/lib/wca-date';

const losAngeles = 'America/Los_Angeles';

describe('competition display time zone', () => {
  it('converts Beijing deadlines through midnight and applies DST on the competition date', () => {
    expect(formatCubingDeadline('2026-01-01 08:00:00', losAngeles)).toBe('2025-12-31 16:00');
    expect(formatCubingDeadline('2026-07-01 08:00:00', losAngeles)).toBe('2026-06-30 17:00');
    expect(formatCompDateTime('2026-01-01', losAngeles)).toBe('2026-01-01');
  });

  it('shows the entire round when the selected clock crosses midnight', () => {
    const schedule: ScheduleData = {
      startDate: '2026-12-31', numberOfDays: 1, venues: [], rounds: {},
      activities: [{
        id: 1, activityCode: '333-r1', name: 'Round 1', roomId: 1, roomName: '', roomColor: '',
        startTime: '2026-12-31T07:30:00Z', endTime: '2026-12-31T09:00:00Z',
      }],
    };
    expect(computeCalendarLayout(schedule, losAngeles)).toEqual({
      dayKeys: ['2026-12-30'], slotMinTime: '23:00:00', slotMaxTime: '26:00:00', overnight: true,
    });
    expect(computeCalendarLayout(schedule, 'Asia/Shanghai')).toEqual({
      dayKeys: ['2026-12-31'], slotMinTime: '15:00:00', slotMaxTime: '17:00:00', overnight: false,
    });
  });
});
