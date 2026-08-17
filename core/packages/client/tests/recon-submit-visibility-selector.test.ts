import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const form = readFileSync(join(CLIENT, 'app/[lang]/recon/submit/ReconSubmitForm.tsx'), 'utf8');
const visibilityRegion = form.slice(
  form.indexOf('{/* 可见性:下拉选择'),
  form.indexOf('{/* Submit buttons */'),
);

describe('recon submit visibility selector', () => {
  it('uses one select for all three persisted visibility values', () => {
    expect(visibilityRegion.match(/<select\b/g)).toHaveLength(1);
    expect(visibilityRegion).toContain("value={form.visibility ?? 'public'}");
    expect(visibilityRegion).toContain("setField('visibility', e.target.value as ReconSolve['visibility'])");
    expect(form).toContain("{ value: 'public'");
    expect(form).toContain("{ value: 'unlisted'");
    expect(form).toContain("{ value: 'private'");
  });

  it('shows only the selected option description below the menu', () => {
    expect(form).toContain('const activeVisibility = VISIBILITY_OPTIONS.find(');
    expect(visibilityRegion).toContain('{tr(activeVisibility.desc)}');
    expect(visibilityRegion).not.toContain('role="radiogroup"');
    expect(visibilityRegion).not.toContain('role="radio"');
  });
});
