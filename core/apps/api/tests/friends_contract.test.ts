import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');
const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim();

describe('friends contract', () => {
  it('keeps the migration, schema snapshot, and migration ledger aligned', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0175_friends.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);

    expect(migration).not.toMatch(/^(?:BEGIN|COMMIT)\s*;/im);
    expect(migration).toContain('PRIMARY KEY (user_low_id, user_high_id)');
    expect(migration).toContain('CHECK (user_low_id < user_high_id)');
    expect(migration).toContain("status IN ('pending', 'accepted')");
    expect(migration).toContain("status = 'accepted' AND responded_at IS NOT NULL");
    expect(migration).toContain('PRIMARY KEY (blocker_user_id, blocked_user_id)');
    expect(migration).toContain('CHECK (blocker_user_id <> blocked_user_id)');
    for (const statement of migration.split(/(?=CREATE (?:TABLE|INDEX|TRIGGER))/).filter(Boolean)) {
      expect(normalizeSql(schema)).toContain(normalizeSql(statement));
    }
    expect(readme).toContain('`0175_friends.sql`');
  });

  it('serializes relationship writes and enforces block semantics', async () => {
    const route = await read('../src/routes/friends.ts');

    expect(route).toContain("friendRoutes.get('/friends'");
    expect(route).toContain("friendRoutes.get('/friends/search'");
    expect(route).toContain("friendRoutes.post('/friends/requests'");
    expect(route).toContain("friendRoutes.post('/friends/requests/:userId/accept'");
    expect(route).toContain("friendRoutes.delete('/friends/requests/:userId'");
    expect(route).toContain("friendRoutes.delete('/friends/:userId'");
    expect(route).toContain("friendRoutes.post('/friends/blocks'");
    expect(route).toContain("friendRoutes.delete('/friends/blocks/:userId'");
    expect(route).toContain('requireAppUserId(c)');
    expect(route).toContain('ORDER BY id\n     FOR UPDATE');
    expect(route).toContain('DELETE FROM user_friendships');
    expect(route).toContain("kind: 'friend_request'");
    expect(route).toContain("kind: 'friend_accepted'");
    expect(route).toContain("c.header('Cache-Control', 'no-store')");
  });
});
