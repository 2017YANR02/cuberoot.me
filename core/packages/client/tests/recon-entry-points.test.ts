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
});
