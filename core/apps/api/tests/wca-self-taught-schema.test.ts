import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

describe('WCA self-taught schema contract', () => {
  it('keeps explicit self-taught rows distinct from incomplete teacher rows', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0185_wca_self_taught.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    expect(migration).toContain('ALTER COLUMN teacher_wca_id DROP NOT NULL');
    expect(migration).toContain('ALTER COLUMN teacher_name DROP NOT NULL');
    expect(migration).toContain('(teacher_wca_id IS NULL AND teacher_name IS NULL)');
    expect(migration).toContain('(teacher_wca_id IS NOT NULL AND teacher_name IS NOT NULL)');
    expect(schema).toContain('teacher_wca_id VARCHAR(20),');
    expect(schema).toContain('teacher_name   VARCHAR(200),');
    expect(schema).toContain('(teacher_wca_id IS NULL AND teacher_name IS NULL)');
    expect(schema).toContain('(teacher_wca_id IS NOT NULL AND teacher_name IS NOT NULL)');
    expect(readme).toContain('`0185_wca_self_taught.sql`');
  });
});
