import { describe, expect, it } from 'vitest';
import { DAISY_CHALLENGE_PROMPT, DAISY_HINT_INTRO, LBL_STEPS } from '@/app/[lang]/tutorial/lbl/content';
import {
  buildDaisyPlayback,
  resolveDaisyScramble,
  selectBestDaisyFace,
  selectWhiteDaisyFace,
} from '@/lib/lbl-daisy';

describe('LBL daisy guided flow', () => {
  it('selects the shortest valid solver orientation and ignores unavailable faces', () => {
    expect(selectBestDaisyFace([11, 4, 0xffffffff, 2, Number.POSITIVE_INFINITY, 7])).toBe(3);
    expect(selectBestDaisyFace([0xffffffff, Number.POSITIVE_INFINITY, null, 0xffffffff, 0xffffffff, 0xffffffff])).toBeNull();
  });

  it('keeps the guided demo on white petals around the yellow center', () => {
    expect(selectWhiteDaisyFace([11, 4, 0xffffffff, 2, 0, 7])).toBe(0);
    expect(selectWhiteDaisyFace([0xffffffff, 11, 2, 0, 0, 7])).toBeNull();
  });

  it('uses a local scramble when the standard generator is unavailable', () => {
    expect(resolveDaisyScramble('', 'R U F')).toBe('R U F');
    expect(resolveDaisyScramble(null, 'R U F')).toBe('R U F');
    expect(resolveDaisyScramble('  U R  ', 'R U F')).toBe('U R');
  });

  it('folds leading whole-cube rotations into the playback setup', () => {
    expect(buildDaisyPlayback('R U F', "z2 y R U'"))
      .toEqual({ setup: 'R U F z2 y', alg: "R U'", displayAlg: "z2 y R U'" });
    expect(buildDaisyPlayback('R U F', "R U'"))
      .toEqual({ setup: 'R U F', alg: "R U'", displayAlg: "R U'" });
  });

  it('keeps the daisy challenge copy and state-specific examples available to the lesson', () => {
    const daisy = LBL_STEPS.find(step => step.id === 'daisy');
    expect(DAISY_CHALLENGE_PROMPT.zh).toBe('动用你聪明的脑袋，如何拼成这样一朵小花？');
    expect(DAISY_HINT_INTRO.zh).toContain('白棱');
    expect(daisy?.examples.map(example => example.title.en)).toEqual([
      'Middle: lift right',
      'Middle: top is occupied',
      'Middle: lift left',
      'Top: lower to middle',
      'Bottom: bring to middle',
      'White down: half turn',
    ]);
  });
});
