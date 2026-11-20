import { describe, expect, it } from 'vitest';
import { FRONT_INDEX_FOLLOW } from '@/app/[lang]/sim/engine/hands/frontIndexFollow';
import { DOWN_INDEX_FOLLOW, DOWN_MIDDLE_FOLLOW } from '@/app/[lang]/sim/engine/hands/frontDownFollow';

// At constant layer speed, spikes in these angle derivatives cause visible shaking.
// These limits reject the independently fitted paths that originally caused it.
function derivatives(rows: readonly (readonly number[])[]) {
  let speed = 0, acceleration = 0;
  let previous: number[] | undefined;
  for (let i = 1; i < rows.length; i++) {
    const step = rows[i][0] - rows[i - 1][0];
    const velocity = rows[i].slice(1).map((value, c) => (value - rows[i - 1][c + 1]) / step);
    speed = Math.max(speed, ...velocity.map(Math.abs));
    if (previous) acceleration = Math.max(acceleration, ...velocity.map((value, c) => Math.abs(value - previous![c]) / step));
    previous = velocity;
  }
  return { speed, acceleration };
}

describe('F finger path continuity', () => {
  it('keeps the home index velocity and acceleration bounded', () => {
    const channels = Object.values(FRONT_INDEX_FOLLOW);
    const rows = channels[0].map((_, i) => [90 * i / (channels[0].length - 1), ...channels.map(channel => channel[i])]);
    const motion = derivatives(rows);
    expect(motion.speed).toBeLessThan(.06);
    expect(motion.acceleration).toBeLessThan(.08);
  });
  it('keeps the down index velocity and acceleration bounded', () => {
    const motion = derivatives(DOWN_INDEX_FOLLOW);
    expect(motion.speed).toBeLessThan(.04);
    expect(motion.acceleration).toBeLessThan(.02);
  });
  it('bounds the middle handoff path instead of accepting tiny angle spikes', () => {
    const motion = derivatives(DOWN_MIDDLE_FOLLOW);
    expect(motion.speed).toBeLessThan(.18);
    expect(motion.acceleration).toBeLessThan(.75);
  });
});
