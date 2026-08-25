import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function updatedAtFunction(source: string): string {
  const definition = source.match(
    /CREATE OR REPLACE FUNCTION trg_set_updated_at\(\) RETURNS TRIGGER AS \$\$[\s\S]*?\$\$ LANGUAGE plpgsql;/,
  );
  expect(definition, 'trg_set_updated_at definition must exist').not.toBeNull();
  return definition![0];
}

describe('teaching owner guard migrations', () => {
  it('bootstraps the canonical updated_at function before migration 0001', async () => {
    const [bootstrap, migration0001, migration0010, schema, readme, filenames] = await Promise.all([
      read('../migrations/0000_bootstrap_updated_at_function.sql'),
      read('../migrations/0001_nav_sites.sql'),
      read('../migrations/0010_ops_commands.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readdir(new URL('../migrations/', `${new URL('.', import.meta.url).href}`)),
    ]);

    expect(filenames.filter((filename) => filename.startsWith('0000_'))).toEqual([
      '0000_bootstrap_updated_at_function.sql',
    ]);
    expect(migration0001).toContain('EXECUTE FUNCTION trg_set_updated_at()');
    expect(updatedAtFunction(bootstrap)).toBe(updatedAtFunction(migration0010));
    expect(updatedAtFunction(schema)).toBe(updatedAtFunction(migration0010));
    expect(bootstrap).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(readme).toContain('0000_bootstrap_updated_at_function.sql');
    expect(readme).toContain('grandfathered bootstrap');
  });

  it('branches on the trigger table, then serializes owner checks per organization', async () => {
    const [migration, schema] = await Promise.all([
      read('../migrations/0148_fix_teaching_owner_guard.sql'),
      read('../src/db/schema.pg.sql'),
    ]);

    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(migration.trim());
    expect(migration).not.toMatch(/TG_TABLE_NAME\s*=\s*'organization_members'\s+AND/i);

    const organizationsBranch = migration.slice(
      migration.indexOf("IF TG_TABLE_NAME = 'organizations' THEN"),
      migration.indexOf("ELSIF TG_TABLE_NAME = 'organization_members' THEN"),
    );
    expect(organizationsBranch).toContain('check_organization_id := NEW.id');
    expect(organizationsBranch).not.toContain('NEW.organization_id');
    expect(organizationsBranch).not.toContain('OLD.organization_id');

    const memberBranch = migration.slice(
      migration.indexOf("ELSIF TG_TABLE_NAME = 'organization_members' THEN"),
      migration.indexOf('ELSE\n    RAISE EXCEPTION'),
    );
    expect(memberBranch).toContain("IF TG_OP = 'INSERT' THEN");
    expect(memberBranch).toContain('NEW.organization_id');
    expect(memberBranch).toContain('OLD.organization_id');
    expect(migration).toContain('IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN');

    const lockStart = migration.indexOf('PERFORM id');
    const lockEnd = migration.indexOf('FOR UPDATE;', lockStart);
    const firstOwnerCheck = migration.indexOf(
      'IF EXISTS (SELECT 1 FROM organizations WHERE id = check_organization_id) THEN',
      lockEnd,
    );
    expect(lockStart).toBeGreaterThan(-1);
    expect(lockEnd).toBeGreaterThan(lockStart);
    expect(firstOwnerCheck).toBeGreaterThan(lockEnd);

    const organizationLock = migration.slice(lockStart, lockEnd + 'FOR UPDATE;'.length);
    expect(organizationLock).toContain('WHERE id = check_organization_id');
    expect(organizationLock).toContain('OR id = moved_organization_id');
    expect(organizationLock).toContain('ORDER BY id');
    expect(organizationLock).toContain('FOR UPDATE;');
    expect(migration).toContain('IF moved_organization_id IS NOT NULL THEN');
  });
});
