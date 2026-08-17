import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const form = readFileSync(join(CLIENT, 'app/[lang]/recon/submit/ReconSubmitForm.tsx'), 'utf8');
const scrambleRegion = form.slice(
  form.indexOf('{/* 三类打乱共享一个输入区'),
  form.indexOf('{/* 同选手 + 同打乱'),
);

describe('recon submit scramble selector', () => {
  it('shows the three scramble sources in one selector and one textarea', () => {
    expect(scrambleRegion).toContain('value={scrambleField}');
    expect(scrambleRegion).toContain('<option value="wca">');
    expect(scrambleRegion).toContain('<option value="optimal">');
    expect(scrambleRegion).toContain('<option value="generic">');
    expect(scrambleRegion.match(/<textarea\b/g)).toHaveLength(1);
  });

  it('routes the picker and mobile keyboard through the active source', () => {
    expect(scrambleRegion).toContain('setScramblePickerFor(scrambleField)');
    expect(scrambleRegion).toContain('target={scrambleInputRef}');
    expect(scrambleRegion).toContain('updateActiveScramble(scrambleInputRef.current.value)');
  });

  it('keeps each source in its original form field when switching views', () => {
    expect(form).toContain("scrambleField === 'wca'\n    ? form.wcaScramble");
    expect(form).toContain("scrambleField === 'optimal'\n      ? form.optimalScramble");
    expect(form).toContain("else setField('scramble', value)");
    expect(scrambleRegion).toContain('setScrambleField(e.target.value as ScrambleField)');
  });
});
