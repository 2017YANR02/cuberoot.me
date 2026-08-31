import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const solo = readFileSync(
  new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
  'utf8',
);

describe('Web Timer scramble-context arm invalidation', () => {
  it('cancels holding, ready and inspection before replacing a scramble slot', () => {
    expect(solo).toMatch(
      /const applyScrambleHist = useCallback[\s\S]*?cancelArmForScrambleChangeRef\.current\(\);[\s\S]*?setScrambleHist\(next\)/,
    );
    expect(solo).toContain(
      'cancelArmForScrambleChangeRef.current = timer.cancelArm;',
    );
  });
});
