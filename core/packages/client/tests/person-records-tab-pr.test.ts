import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('person records tab PR section', () => {
  it('uses the same historical PR ranks as the person summary and keeps the tab available without regional records', () => {
    const recordsTab = readFileSync(join(CLIENT, 'components/persons/sections/RecordsTab.tsx'), 'utf8');
    const personTabs = readFileSync(join(CLIENT, 'components/persons/sections/PersonTabs.tsx'), 'utf8');

    expect(recordsTab).toContain("t('历史个人纪录', 'History of Personal Records')");
    expect(recordsTab).toContain('computePrRank(official, comps)');
    expect(recordsTab).toMatch(/rank\?\.singleRank === 1 \|\| rank\?\.averageRank === 1/);
    expect(recordsTab).toContain("types ? r.regional_single_record : 'PR'");
    expect(recordsTab).toContain("types ? r.regional_average_record : 'PR'");
    expect(personTabs).toContain('r.best > 0 || r.average > 0');
  });
});
