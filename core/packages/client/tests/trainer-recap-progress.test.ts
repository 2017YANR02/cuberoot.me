import { describe, expect, it } from 'vitest';
import { completedRecapCount } from '@/lib/trainer-store';

describe('trainer recap completed count', () => {
  it('does not count the current case before the user advances', () => {
    expect(completedRecapCount({ pos: 1, total: 472 }, false)).toBe(0);
    expect(completedRecapCount({ pos: 2, total: 472 }, false)).toBe(1);
  });

  it('counts the final case only after the round is completed', () => {
    expect(completedRecapCount({ pos: 472, total: 472 }, false)).toBe(471);
    expect(completedRecapCount({ pos: 472, total: 472 }, true)).toBe(472);
  });

  it('matches three-case screens after advancing the whole screen', () => {
    expect(completedRecapCount({ pos: 1, total: 6 }, false)).toBe(0);
    expect(completedRecapCount({ pos: 4, total: 6 }, false)).toBe(3);
    expect(completedRecapCount({ pos: 4, total: 6 }, true)).toBe(6);
  });
});
