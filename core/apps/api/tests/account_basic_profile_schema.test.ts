import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

describe('account basic profile schema contract', () => {
  it('keeps migration 0186 represented in the schema snapshot and migration guide', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0186_account_basic_profile.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    for (const column of ['birth_date', 'gender', 'country_iso2']) {
      expect(migration).toContain(`ADD COLUMN ${column}`);
      expect(schema).toMatch(new RegExp(`\\b${column}\\s+`));
    }
    expect(migration).toContain("gender IN ('male', 'female', 'nonbinary', 'other', 'undisclosed')");
    expect(migration).toContain("to_regclass('public.wca_person_results_snapshot')");
    expect(readme).toContain('`0186_account_basic_profile.sql`');
  });
});
