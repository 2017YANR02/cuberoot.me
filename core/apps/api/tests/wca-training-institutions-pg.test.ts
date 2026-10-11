import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The existing server-test job supplies this isolated loopback database.
const enabled = process.env.WCA_INSTITUTIONS_PG_TEST === '1'
  || (process.env.CI === 'true' && process.env.DB_NAME === 'cuberoot_test');
const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const institutionName = '上海魔方根科技有限公司';

describe.skipIf(!enabled)('training institution seed with the real deferred owner guard', () => {
  let admin: ReturnType<typeof postgres>;
  let db: ReturnType<typeof postgres>;
  let schema: string;

  beforeEach(async () => {
    const host = process.env.DB_HOST ?? '127.0.0.1';
    if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('Loopback PostgreSQL required');
    const options = {
      host, port: Number(process.env.DB_PORT ?? 5433),
      username: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev',
      database: process.env.DB_NAME ?? 'cuberoot_test', max: 1, onnotice: () => {},
    };
    schema = `institution_seed_${randomUUID().replaceAll('-', '')}`;
    admin = postgres(options);
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres({ ...options, connection: { search_path: schema } });
    await db.unsafe(`CREATE TABLE app_users (id BIGINT PRIMARY KEY, wca_id TEXT, merged_into_user_id BIGINT);
      CREATE TABLE wca_teacher_named_students (id UUID PRIMARY KEY, teacher_wca_id TEXT);
      CREATE TABLE wca_teachers (teacher_wca_id TEXT, student_wca_id TEXT);`);
    await db.unsafe(migration('0000_bootstrap_updated_at_function.sql'));
    const foundation = migration('0142_teaching_foundation.sql');
    await db.unsafe(foundation.slice(0, foundation.indexOf('CREATE TABLE student_profiles')));
    await db.unsafe(migration('0148_fix_teaching_owner_guard.sql'));
    await db.unsafe(foundation.slice(foundation.indexOf('CREATE CONSTRAINT TRIGGER organizations_require_active_owner')));
  });

  afterEach(async () => {
    await db?.end();
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  const apply = () => db.begin(async tx => {
    await tx.unsafe(migration('0269_wca_training_institutions.sql'));
  });

  it('commits a new institution with its existing real owner and student affiliations', async () => {
    await db`INSERT INTO app_users VALUES (1, '2017YANR02', NULL)`;
    await db`INSERT INTO wca_teachers VALUES ('2017YANR02', '2023GENG02'), ('2017YANR02', '2023GENG02')`;
    const namedStudent = randomUUID();
    await db`INSERT INTO wca_teacher_named_students VALUES (${namedStudent}, '2017YANR02')`;
    await apply();
    expect(await db`SELECT o.created_by_user_id, m.user_id, m.role, m.status, m.joined_at IS NOT NULL AS joined
      FROM organizations o JOIN organization_members m ON m.organization_id = o.id`).toEqual([
      { created_by_user_id: '1', user_id: '1', role: 'owner', status: 'active', joined: true },
    ]);
    expect(await db`SELECT COUNT(*)::int AS count FROM app_users`).toEqual([{ count: 1 }]);
    expect(await db`SELECT COUNT(*)::int AS count FROM wca_training_institutions`).toEqual([{ count: 1 }]);
    expect(await db`SELECT COUNT(*)::int AS count FROM wca_student_institutions`).toEqual([{ count: 2 }]);
    // The repair must not disable the protection that caught the original bug.
    await expect(db.begin(async tx => {
      await tx`UPDATE organization_members SET status = 'revoked'`;
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('reuses an existing organization without changing its owner or needing a new maintainer account', async () => {
    await db`INSERT INTO app_users VALUES (2, NULL, NULL)`;
    const existingId = randomUUID();
    await db.begin(async tx => {
      await tx`INSERT INTO organizations (id, slug, name, created_by_user_id)
        VALUES (${existingId}, 'existing-institution', ${institutionName}, 2)`;
      await tx`INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
        VALUES (${existingId}, 2, 'owner', 'active', NOW())`;
    });
    await apply();
    expect(await db`SELECT organization_id FROM wca_training_institutions`).toEqual([{ organization_id: existingId }]);
    expect(await db`SELECT user_id, role, status FROM organization_members`).toEqual([
      { user_id: '2', role: 'owner', status: 'active' },
    ]);
    expect(await db`SELECT COUNT(*)::int AS count FROM organizations`).toEqual([{ count: 1 }]);
  });

  it.each(['missing', 'merged'] as const)('rolls back when the maintainer account is %s', async state => {
    if (state === 'merged') await db`INSERT INTO app_users VALUES (1, '2017YANR02', 2), (2, NULL, NULL)`;
    await expect(apply()).rejects.toMatchObject({ code: 'P0002' });
    expect(await db`SELECT to_regclass('wca_training_institutions') AS relation`).toEqual([{ relation: null }]);
    expect(await db`SELECT COUNT(*)::int AS count FROM organizations`).toEqual([{ count: 0 }]);
  });
});
