import { describe, expect, it } from 'vitest';
import { C333_FIXED } from '@/app/[lang]/math/kernel/page';

describe('/math/kernel fixed-centre 3x3 group', () => {
  it('keeps the conventional face-turn group facts', () => {
    expect(C333_FIXED.order).toBe('43252003274489856000');
    expect(C333_FIXED.index).toBe('12');
    expect(C333_FIXED.orbits.map((orbit) => orbit.name)).toEqual(['CORNERS', 'EDGES']);
    expect(C333_FIXED.moveNames).toEqual(['L', 'R', 'D', 'U', 'B', 'F']);
  });
});
