import { describe, expect, it } from 'vitest';
import { createDeskPetRoutineSession, deskPetLocalPeriod } from '../lib/deskpet-routine';

const at = (hour: number, minute = 0, day = 27) => new Date(2026, 9, day, hour, minute);
describe('visitor-local pet routine', () => {
  it.each([
    [11, 59, false, false], [12, 0, true, false], [13, 59, true, false], [14, 0, false, false],
    [20, 59, false, false], [21, 0, true, false], [22, 59, true, false], [23, 0, true, true],
    [0, 0, true, true], [6, 59, true, true], [7, 0, false, false],
  ])('%i:%i uses local calendar boundaries', (hour, minute, eligible, instant) => {
    expect(deskPetLocalPeriod(at(hour as number, minute as number))).toMatchObject({ eligible, instant });
  });
  it('keeps one night across midnight and does not reapply initial sleep at 23:00', () => {
    expect(deskPetLocalPeriod(at(23)).key).toBe(deskPetLocalPeriod(at(0, 0, 28)).key);
    const session = createDeskPetRoutineSession(); session.initialize(at(22));
    session.initialize(at(23));
    expect(session.decide(at(23), 'off', false, true)).toBe('drowsy');
  });
  it('initial late entry sleeps stably once; waking suppresses this same window', () => {
    const session = createDeskPetRoutineSession(); session.initialize(at(23));
    expect(session.decide(at(23), 'off', false, true)).toBe('asleep');
    session.started(at(23)); session.awake(at(23, 5));
    expect(session.decide(at(23, 6), 'off', false, true)).toBeNull();
    expect(session.decide(at(0, 10, 28), 'off', false, true)).toBeNull();
  });
  it('does not wake sleeping or a manually started preview when a period ends', () => {
    const session = createDeskPetRoutineSession(); session.initialize(at(12));
    expect(session.decide(at(14), 'asleep', true, false)).toBeNull();
    expect(session.decide(at(14), 'drowsy', false, false)).toBeNull();
    expect(session.decide(at(14), 'drowsy', true, false)).toBe('wake');
  });
});
