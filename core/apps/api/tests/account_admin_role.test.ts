import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

describe('account administrator role contract', () => {
  it('keeps the administrator role in migration, schema, and route contracts', async () => {
    const [migration, schema, route, readme] = await Promise.all([
      read('../migrations/0200_app_user_admin_role.sql'),
      read('../src/db/schema.pg.sql'),
      read('../src/routes/account_auth.ts'),
      read('../migrations/README.md'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE');
    expect(schema).toMatch(/\bis_admin\s+BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(route).toContain("accountAuthRoutes.patch('/auth/admin/users/:userId/admin'");
    expect(route).toContain('await requireAdmin(c)');
    expect(route).toContain('isRootAdmin');
    expect(readme).toContain('`0200_app_user_admin_role.sql`');
  });

  it('falls back to the linked WCA country when the account country is empty', async () => {
    const route = await read('../src/routes/account_auth.ts');

    expect(route).toContain('COALESCE(u.country_iso2, wca_country.iso2) AS country_iso2');
    expect(route).toContain('LEFT JOIN wca_persons wca_person ON wca_person.wca_id = u.wca_id');
    expect(route).toContain('LEFT JOIN wca_countries wca_country ON wca_country.id = wca_person.country_id');
  });
});
