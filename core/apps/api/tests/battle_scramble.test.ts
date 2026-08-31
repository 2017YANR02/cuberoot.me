import { describe, expect, it } from 'vitest';

import { NET_EVENTS } from '@cuberoot/shared/timer';
import {
  generateNetBattleScramble,
  generateNetBattleScrambleForSlot,
} from '../src/utils/battle_scramble.js';

describe('authoritative online-battle scrambles', () => {
  it('reuses the shared timer generator for every exact online-battle event', async () => {
    for (const event of NET_EVENTS) {
      const scramble = await generateNetBattleScramble(event);
      expect(scramble.trim().length, event).toBeGreaterThan(0);
    }
  }, 30_000);

  it('coalesces simultaneous generation for one room/round/event slot', async () => {
    const first = generateNetBattleScrambleForSlot('0427:2:333', '333');
    const second = generateNetBattleScrambleForSlot('0427:2:333', '333');
    expect(second).toBe(first);
    await expect(first).resolves.toEqual(expect.any(String));
  });
});
