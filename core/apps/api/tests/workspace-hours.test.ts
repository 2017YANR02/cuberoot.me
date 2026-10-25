import { expect, it } from 'vitest';
import { reportHoursInput } from '../src/workspace/report-hours';

it('accepts legacy reports and whole-hour intervals including midnight', () => {
  for (const input of [{}, { startHour: null, endHour: null }, { startHour: 0, endHour: 24 }, { startHour: 9, endHour: 18 }]) {
    expect(reportHoursInput.safeParse(input).success).toBe(true);
  }
});

it('rejects partial, reversed, fractional and out-of-day hours', () => {
  for (const input of [{ startHour: 9 }, { endHour: 18 }, { startHour: 9, endHour: 9 }, { startHour: 18, endHour: 9 }, { startHour: 9.5, endHour: 18 }, { startHour: -1, endHour: 18 }, { startHour: 23, endHour: 25 }]) {
    expect(reportHoursInput.safeParse(input).success).toBe(false);
  }
});
