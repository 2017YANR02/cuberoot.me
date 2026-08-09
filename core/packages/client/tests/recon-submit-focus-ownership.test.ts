import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const form = readFileSync(join(CLIENT, 'app/[lang]/recon/submit/ReconSubmitForm.tsx'), 'utf8');
const recordSelect = readFileSync(join(CLIENT, 'components/RecordSelect/RecordSelect.tsx'), 'utf8');

describe('mobile recon submit focus ownership', () => {
  it('focused async-filled fields are claimed before the first input event', () => {
    for (const setter of [
      'setTimeUserTouched(true)',
      'setSingleUserTouched(true)',
      'setAvgUserTouched(true)',
      'setSingleRecordUserTouched(true)',
      'setAverageRecordUserTouched(true)',
      'setScrambleUserTouched(true)',
      'setOptimalUserTouched(true)',
      'setMethodUserTouched(true)',
      'setCubeUserTouched(true)',
    ]) {
      expect(form, `${setter} must run from focus as well as change`).toContain(setter);
    }
    expect(form).toMatch(/onFocus=\{\(\) => \{\s*setTimeUserTouched\(true\)/);
    expect(form).toMatch(/onFocus=\{\(\) => \{\s*if \(singleAutoSource\) return;\s*setSingleUserTouched\(true\)/);
    expect(form).toMatch(/onFocus=\{\(\) => \{\s*if \(avgAutoSource\) return;\s*setAvgUserTouched\(true\)/);
  });

  it('RecordSelect exposes and forwards focus intent to its caller', () => {
    expect(recordSelect).toContain('onFocus?: () => void');
    expect(recordSelect).toMatch(/onFocus=\{e => \{\s*onFocus\?\.\(\)/);
  });
});
