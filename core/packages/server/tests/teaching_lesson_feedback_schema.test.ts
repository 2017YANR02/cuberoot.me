import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

describe('teaching lesson feedback schema', () => {
  it('keeps migration 0154 represented in the canonical schema and migration ledger', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0154_teaching_lesson_feedback.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(migration.slice(migration.indexOf('CREATE TABLE lesson_feedback')).trim());
    expect(readme).toContain('0154_teaching_lesson_feedback.sql');
  });

  it('uses tenant-safe attendance identity and serializes per-student revisions', async () => {
    const migration = await read('../migrations/0154_teaching_lesson_feedback.sql');
    expect(migration).toContain(
      'FOREIGN KEY (organization_id, session_id, student_id)\n    REFERENCES attendance_records(organization_id, session_id, student_id)',
    );
    expect(migration).toContain(
      'UNIQUE (organization_id, session_id, student_id, revision)',
    );
    expect(migration).toContain('FOR UPDATE OF session, attendance');
    expect(migration.indexOf('FOR UPDATE OF session, attendance')).toBeLessThan(
      migration.indexOf('SELECT COALESCE(MAX(revision), 0) + 1'),
    );
    expect(migration).toContain("session_status <> 'completed'");
  });

  it('freezes feedback history while allowing only account-deletion anonymization', async () => {
    const migration = await read('../migrations/0154_teaching_lesson_feedback.sql');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE ON lesson_feedback');
    expect(migration).toContain("OLD.author_user_id IS NOT NULL");
    expect(migration).toContain("NEW.author_user_id IS NULL");
    expect(migration).toContain("to_jsonb(NEW) - 'author_user_id'");
    expect(migration).toContain("RAISE EXCEPTION 'lesson feedback is append-only'");
    expect(migration).toContain(
      "visibility = 'staff_only' AND published_at IS NULL",
    );
    expect(migration).toContain(
      "visibility <> 'staff_only' AND published_at IS NOT NULL",
    );
  });
});
