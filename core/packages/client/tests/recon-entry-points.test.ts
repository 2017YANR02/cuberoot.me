import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const listPage = readFileSync(join(CLIENT, 'app/[lang]/recon/page.tsx'), 'utf8');
const submitForm = readFileSync(join(CLIENT, 'app/[lang]/recon/submit/ReconSubmitForm.tsx'), 'utf8');

describe('reconstruction entry points', () => {
  it('places the add action beside the page title', () => {
    expect(listPage).toMatch(
      /<h1>\s*\{t\('recon\.title'\)\}\s*<Link href="\/recon\/submit"[\s\S]*?<Link\s+href="\/recon-about"/,
    );
    expect(listPage.match(/href="\/recon\/submit"/g)).toHaveLength(1);
  });

  it('defaults an untouched new solve to the signed-in WCA person', () => {
    expect(submitForm).toContain('solverUserTouched.current = true');
    expect(submitForm).toContain(
      'if (isEditing || fromId || !authUser?.wcaId || solverUserTouched.current) return;',
    );
    expect(submitForm).toMatch(
      /if \(prev\.person \|\| prev\.personId\) return prev;[\s\S]*?person: authUser\.name \|\| authUser\.wcaId,[\s\S]*?personId: authUser\.wcaId,/,
    );
  });

  it('persists typed solver names and shows submit failures in the page', () => {
    expect(submitForm).toMatch(/onChange=\{handleSolverPick\}\s+onQueryChange=\{handleSolverQueryChange\}\s+defaultQuery=\{form.person \|\| ''\}\s+allowFreeText/);
    expect(submitForm).toMatch(/const handleSolverQueryChange[\s\S]*?solverUserTouched.current = true;[\s\S]*?person: query, personId: '', personCountry: ''/);
    const submit = submitForm.slice(submitForm.indexOf('const handleSubmit ='), submitForm.indexOf('// Hand off the current scramble'));
    expect(submit).toContain("const person = form.person?.trim() ?? '';");
    expect(submit).toMatch(/if \(!person\) \{\s+setSubmitError/);
    expect(submit).toMatch(/const data: Partial<ReconSolve> = \{\s+\.\.\.form,\s+person,/);
    expect(submit).not.toMatch(/\balert\(/);
    expect(submitForm).toMatch(/submitError\?\.field === field && \([\s\S]*?role="alert"[\s\S]*?\{submitError.message\}/);
    expect(submitForm).toMatch(/renderSubmitError\('person'\)\}\s*<\/div>/);
    expect(submitForm).toMatch(/<EventSelect[^\n]+\n\s*\{renderSubmitError\('event'\)\}/);
    expect(submitForm).toContain("renderSubmitError('scramble')");
    expect(submitForm).toContain("renderSubmitError('solution')");
    expect(submitForm).toContain("renderSubmitError('dupReason')");
    expect(submitForm).toContain("getElementById('recon-submit-error')?.scrollIntoView");
    expect(submitForm).toContain("setSubmitError(error => error?.field === key");
    expect(submitForm).toContain("scrambleCheck.status === 'invalid' ? 'scramble' : 'solution'");
  });

  it('preserves the picked reconstructor country ahead of empty profile/cache fallbacks', () => {
    expect(submitForm).toContain('setPickedReconer(p)');
    expect(submitForm).toContain('setPickedReconer(null)');
    expect(submitForm).toMatch(/const reconerCountry = \(pickedReconer\?\.id === form.reconerId \? pickedReconer\?\.country_iso2 : ''\)[\s\S]*?\|\|.*authUser.country[\s\S]*?\|\| personFlagIso2/);
    expect(submitForm).not.toContain('setReconerCountry');
  });

  it('requires a solution only in full reconstruction mode before saving', () => {
    const submit = submitForm.slice(submitForm.indexOf('const handleSubmit ='));
    expect(submit).toMatch(/const solution = normalizeReconSolution\(form.solution \|\| ''\);\s+if \(!timingOnly && !solution.trim\(\)\) \{\s+setSubmitError\(\{ field: 'solution', message: tr\(\{ zh: '请填写解法。', en: 'Enter a solution\.' \}\) \}\);\s+return;\s+\}\s+const timingError/);
    expect(submit.indexOf('if (!timingOnly && !solution.trim())')).toBeLessThan(submit.indexOf('setSaving(true)'));
  });
});
