import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importTransactionStart, refreshTable } from '../src/pg-refresh.js';
import { historicalRanksLoadSql } from '../src/historical-ranks-load.js';

const enabled = process.env.STATS_IMPORT_TEST_PG === '1';
const schema = `stats_import_${randomUUID().replaceAll('-', '')}`;
const gateNamespace = 724192;
let nextGate = Math.floor(Math.random() * 1_000_000);
let workDir: string;

// Execute the production psql artifact, including client-side COPY and capacity
// checks. The reviewed subprocess contract allows only this local test adapter.
function session(applicationName = schema, scoped = true) {
  const child = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    cwd: workDir,
    env: { ...process.env, PGAPPNAME: applicationName, PGCONNECT_TIMEOUT: '5',
      PGOPTIONS: `${scoped ? `-c search_path=${schema} ` : ''}-c statement_timeout=12000` },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  let error = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { error += String(chunk); });
  const done = new Promise<{ code: number | null; output: string; error: string }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => resolve({ code, output, error }));
  });
  void done.catch(() => {});
  return {
    send(sql: string) { child.stdin.write(`${sql}\n`); },
    finish(sql = '') { if (!child.stdin.writableEnded) child.stdin.end(`${sql}\n`); return done; },
    async marker(value: string) { await until(() => output.includes(value), `psql marker ${value}: ${error}`); },
  };
}

async function until(check: () => boolean | Promise<boolean>, message: string) {
  const deadline = Date.now() + 8_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${message}`);
    // Poll observed lock/marker state; a fixed delay never establishes readiness.
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}

async function run(sql: string, scoped = true) {
  const result = await session(schema, scoped).finish(sql);
  if (result.code !== 0) throw new Error(`psql failed (${result.code}): ${result.error}\n${result.output}`);
  return result.output.trim();
}

async function fixture(name: string, body: string) {
  await writeFile(join(workDir, name), body);
  return name;
}

async function refreshPeople(body = '1\tNew name\tA\n3\tNew person\tA\n', expectedRows = 2) {
  const file = await fixture(`persons_${randomUUID().replaceAll('-', '')}.copy.tsv`, body);
  return refreshTable({ table: 'wca_persons', columns: ['id', 'name', 'country_id'], keyColumns: ['id'], file, expectedRows });
}

const readJoined = `SELECT p.id,p.name,c.name,h.value FROM wca_persons p JOIN wca_countries c ON c.id=p.country_id JOIN historical_ranks_snapshot h ON h.person_id=p.id ORDER BY p.id;`;
const oldJoined = '1|Old name|Old country|10\n2|Removed person|Old country|20';
const newJoined = '1|New name|New country|11\n3|New person|New country|30';

async function bundle() {
  const countries = refreshTable({ table: 'wca_countries', columns: ['id', 'name'], keyColumns: ['id'], file: await fixture('countries.copy.tsv', 'A\tNew country\n'), expectedRows: 1 });
  const history = refreshTable({ table: 'historical_ranks_snapshot', columns: ['person_id', 'value'], keyColumns: ['person_id'], file: await fixture('history.copy.tsv', '1\t11\n3\t30\n'), expectedRows: 2 });
  return `${countries}\n${await refreshPeople()}\n${history}\nUPDATE meta_historical SET value='v2' WHERE key='last_imported_at';`;
}

describe.skipIf(!enabled)('real PostgreSQL stats imports preserve online reads and rollback', () => {
  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST ?? '')) throw new Error('Stats import tests require an explicit loopback PGHOST');
    if (!process.env.PGDATABASE || !process.env.PGUSER) throw new Error('Stats import tests require explicit PGDATABASE and PGUSER');
    workDir = await mkdtemp(join(tmpdir(), 'cuberoot-stats-import-'));
    await run(`CREATE SCHEMA ${schema};`, false);
    await run(`
      CREATE TABLE wca_countries(id text PRIMARY KEY,name text NOT NULL);
      CREATE TABLE wca_persons(id integer PRIMARY KEY,name text NOT NULL,country_id text NOT NULL REFERENCES wca_countries(id));
      CREATE TABLE historical_ranks_snapshot(person_id integer NOT NULL,value integer NOT NULL);
      CREATE INDEX history_lookup ON historical_ranks_snapshot(person_id);
      CREATE TABLE home_card_locks(key text PRIMARY KEY,locked boolean NOT NULL);
      CREATE TABLE meta_historical(key text PRIMARY KEY,value text NOT NULL);
      CREATE VIEW people_view AS SELECT id,name FROM wca_persons;
      GRANT SELECT ON wca_persons TO PUBLIC;
    `);
  });

  beforeEach(async () => {
    await run(`DELETE FROM historical_ranks_snapshot; DELETE FROM wca_persons; DELETE FROM wca_countries; DELETE FROM home_card_locks; DELETE FROM meta_historical;
      INSERT INTO wca_countries VALUES('A','Old country');
      INSERT INTO wca_persons VALUES(1,'Old name','A'),(2,'Removed person','A');
      INSERT INTO historical_ranks_snapshot VALUES(1,10),(2,20);
      INSERT INTO home_card_locks VALUES('comp-sim',true);
      INSERT INTO meta_historical VALUES('last_imported_at','v1');`);
  });

  afterAll(async () => {
    if (workDir) {
      await run(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`, false);
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('keeps 16 concurrent online reads and permission reads available throughout an uncommitted refresh', async () => {
    const gate = ++nextGate;
    const keeper = session();
    keeper.send(`SELECT pg_advisory_lock(${gateNamespace},${gate});\n\\echo LOCK_HELD`);
    await keeper.marker('LOCK_HELD');
    const loaderName = `${schema}_loader`;
    const loader = session(loaderName);
    // The importer timeout governs real table contention. Disable it only for
    // the test-owned latch after all production refresh SQL has executed.
    const result = loader.finish(`${importTransactionStart('stats_import_test')}\n${await bundle()}\nSET LOCAL lock_timeout='0';\nSELECT pg_advisory_lock(${gateNamespace},${gate});\nCOMMIT;`);
    try {
      await until(async () => (await run(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${loaderName}' AND l.locktype='advisory' AND NOT l.granted;`)) === '1', 'loader blocked on the explicit advisory gate');
      const readers = await Promise.all(Array.from({ length: 16 }, () => run(`SET statement_timeout='750ms'; ${readJoined} SELECT locked FROM home_card_locks WHERE key='comp-sim'; SELECT value FROM meta_historical WHERE key='last_imported_at';`)));
      for (const rows of readers) expect(rows).toBe(`${oldJoined}\nt\nv1`);
      expect(await run(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${loaderName}' AND l.mode='AccessExclusiveLock' AND l.relation IN ('wca_persons'::regclass,'wca_countries'::regclass,'historical_ranks_snapshot'::regclass);`)).toBe('0');
    } finally {
      await keeper.finish(`SELECT pg_advisory_unlock(${gateNamespace},${gate});`);
    }
    expect(await result).toMatchObject({ code: 0 });
    expect(await run(readJoined)).toBe(newJoined);
    expect(await run(`SELECT value FROM meta_historical WHERE key='last_imported_at';`)).toBe('v2');
  }, 30_000);

  it.each([
    ['invalid integer', 'invalid\tBad\tA\n', 1],
    ['malformed columns', '1\tBad\n', 1],
    ['duplicate key', '1\tFirst\tA\n1\tSecond\tA\n', 2],
    ['wrong row count', '1\tNew\tA\n', 2],
    ['foreign key violation', '1\tNew\tMissing country\n', 1],
  ] as const)('rolls back earlier imported tables and metadata after %s', async (_label, body, count) => {
    const countries = refreshTable({ table: 'wca_countries', columns: ['id', 'name'], keyColumns: ['id'], file: await fixture('rollback_country.copy.tsv', 'A\tNew country\n'), expectedRows: 1 });
    const outcome = await session().finish(`${importTransactionStart('stats_import_test')}\n${countries}\nUPDATE meta_historical SET value='v2';\n${await refreshPeople(body, count)}\nCOMMIT;`);
    expect(outcome.code).not.toBe(0);
    expect(await run(readJoined)).toBe(oldJoined);
    expect(await run('SELECT value FROM meta_historical;')).toBe('v1');
  });

  it('preserves unchanged row versions on repeat imports and table/view/prepared-query identity', async () => {
    const identitySql = `SELECT 'wca_persons'::regclass::oid,'people_view'::regclass::oid,relacl::text FROM pg_class WHERE oid='wca_persons'::regclass;`;
    const identity = await run(identitySql);
    const prepared = session();
    prepared.send('PREPARE read_people AS SELECT id,name FROM people_view ORDER BY id;\n\\echo PREPARED');
    await prepared.marker('PREPARED');
    try {
      await run(`${importTransactionStart('stats_import_test')}\n${await bundle()}\nCOMMIT;`);
      const versions = await run('SELECT id,xmin::text FROM wca_persons ORDER BY id;');
      const historyVersions = await run('SELECT person_id,xmin::text FROM historical_ranks_snapshot ORDER BY person_id;');
      await run(`${importTransactionStart('stats_import_test')}\n${await bundle()}\nCOMMIT;`);
      expect(await run('SELECT id,xmin::text FROM wca_persons ORDER BY id;')).toBe(versions);
      expect(await run('SELECT person_id,xmin::text FROM historical_ranks_snapshot ORDER BY person_id;')).toBe(historyVersions);
      expect(await run(identitySql)).toBe(identity);
      expect(await run(readJoined)).toBe(newJoined);
      const preparedResult = await prepared.finish('EXECUTE read_people;');
      expect(preparedResult.code).toBe(0);
      expect(preparedResult.output.trim()).toBe('PREPARED\n1|New name\n3|New person');
    } catch (error) {
      await prepared.finish();
      throw error;
    }
  });

  it('rejects duplicate live logical keys without a physical unique index and rolls back the entire batch', async () => {
    await run('INSERT INTO historical_ranks_snapshot VALUES(1,10);');
    const outcome = await session().finish(`${importTransactionStart('stats_import_test')}\n${await bundle()}\nCOMMIT;`);
    expect(outcome.code).not.toBe(0);
    expect(outcome.error).toContain('duplicate live keys');
    expect(await run('SELECT id,name FROM wca_persons ORDER BY id;')).toBe('1|Old name\n2|Removed person');
    expect(await run('SELECT value FROM meta_historical;')).toBe('v1');
    expect(await run('SELECT count(*) FROM historical_ranks_snapshot;')).toBe('3');
  });

  it('bootstraps empty tables, supports key-only tables, and rejects late SQL errors atomically', async () => {
    await run('CREATE TABLE IF NOT EXISTS import_keys(id integer PRIMARY KEY); DELETE FROM import_keys;');
    const keys = refreshTable({ table: 'import_keys', columns: ['id'], keyColumns: ['id'], file: await fixture('keys.copy.tsv', '1\n2\n'), expectedRows: 2 });
    await run(`${importTransactionStart('stats_import_test')}\n${keys}\nCOMMIT;`);
    expect(await run('SELECT id FROM import_keys ORDER BY id;')).toBe('1\n2');
    const outcome = await session().finish(`${importTransactionStart('stats_import_test')}\n${await bundle()}\nSELECT 1/0;\nCOMMIT;`);
    expect(outcome.code).not.toBe(0);
    expect(outcome.error).toContain('division by zero');
    expect(await run(readJoined)).toBe(oldJoined);
    expect(await run('SELECT value FROM meta_historical;')).toBe('v1');
  });

  it('executes the complete six-table historical-ranks artifact including a monthly table without a unique index', async () => {
    const artifactSchema = `${schema}_hr`;
    const inArtifact = (sql: string) => run(`SET search_path=${artifactSchema};\n${sql}`);
    await run(`CREATE SCHEMA ${artifactSchema};`, false);
    try {
      // Minimal real column types: especially nullable scores, dates, arrays and
      // the non-unique monthly lookup index. No application source dependency.
      await inArtifact(`
        CREATE TABLE wca_continents(id varchar(20) PRIMARY KEY,name varchar(50) NOT NULL);
        CREATE TABLE wca_countries(id varchar(50) PRIMARY KEY,iso2 varchar(2),name varchar(100) NOT NULL,continent_id varchar(20) NOT NULL);
        CREATE TABLE wca_persons(wca_id varchar(20) PRIMARY KEY,name varchar(200) NOT NULL,country_id varchar(50) NOT NULL,gender varchar(1) NOT NULL DEFAULT '');
        CREATE TABLE historical_ranks_snapshot(
          event_id varchar(20) NOT NULL,year smallint NOT NULL,wca_id varchar(20) NOT NULL,single integer,average integer,country_id varchar(50) NOT NULL,
          single_world_rank integer NOT NULL DEFAULT 0,single_country_rank integer NOT NULL DEFAULT 0,single_continent_rank integer NOT NULL DEFAULT 0,
          avg_world_rank integer NOT NULL DEFAULT 0,avg_country_rank integer NOT NULL DEFAULT 0,avg_continent_rank integer NOT NULL DEFAULT 0,
          best_single_comp_id varchar(40),best_single_date date,best_single_attempts integer[],best_average_comp_id varchar(40),best_average_date date,best_average_attempts integer[],
          PRIMARY KEY(event_id,year,wca_id));
        CREATE TABLE historical_ranks_monthly_snapshot(
          event_id varchar(20) NOT NULL,year smallint NOT NULL,month smallint NOT NULL,wca_id varchar(20) NOT NULL,single integer,average integer,country_id varchar(50) NOT NULL,
          single_world_rank integer NOT NULL DEFAULT 0,single_country_rank integer NOT NULL DEFAULT 0,single_continent_rank integer NOT NULL DEFAULT 0,
          avg_world_rank integer NOT NULL DEFAULT 0,avg_country_rank integer NOT NULL DEFAULT 0,avg_continent_rank integer NOT NULL DEFAULT 0);
        CREATE INDEX hrms_person ON historical_ranks_monthly_snapshot(wca_id,event_id,year,month);
        CREATE TABLE meta_historical(key varchar(50) PRIMARY KEY,value text NOT NULL,updated_at timestamptz DEFAULT NOW());
      `);
      await fixture('wca_continents.copy.tsv', '_Asia\tAsia\n');
      await fixture('wca_countries.copy.tsv', 'China\tCN\tChina\t_Asia\n');
      await fixture('wca_persons.copy.tsv', '2026TEST01\tOld person\tChina\tm\n');
      await fixture('historical_ranks_snapshot.copy.tsv', '333\t2026\t2026TEST01\t500\t\\N\tChina\t1\t1\t1\t0\t0\t0\tTest2026\t2026-09-11\t{500,600,700}\t\\N\t\\N\t\\N\n');
      await fixture('historical_ranks_monthly_snapshot.copy.tsv', '333\t2026\t9\t2026TEST01\t500\t\\N\tChina\t1\t1\t1\t0\t0\t0\n');
      const bestRow = `2026TEST01\t333\t${Array.from({ length: 6 }, () => '1\t500\t2026').join('\t')}\n`;
      await fixture('historical_best_ranks.copy.tsv', bestRow);
      const artifactFile = await fixture('historical_load.sql', historicalRanksLoadSql({ continents: 1, countries: 1, persons: 1, year: 1, month: 1, best: 1 }));
      const applyArtifact = () => inArtifact(`\\i ${artifactFile}`);
      await applyArtifact();
      expect(await inArtifact(`SELECT p.name,y.single,y.average IS NULL,y.best_single_date,y.best_single_attempts,m.single,b.s_world_rank FROM wca_persons p JOIN historical_ranks_snapshot y USING(wca_id) JOIN historical_ranks_monthly_snapshot m USING(wca_id) JOIN historical_best_ranks b USING(wca_id);`)).toBe('Old person|500|t|2026-09-11|{500,600,700}|500|1');
      expect(await inArtifact(`SELECT count(*) FROM pg_index WHERE indrelid='historical_ranks_monthly_snapshot'::regclass AND indisunique;`)).toBe('0');
      const initialMonthlyVersion = await inArtifact('SELECT xmin::text FROM historical_ranks_monthly_snapshot;');
      const snapshot = session();
      snapshot.send(`SET search_path=${artifactSchema}; BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT name FROM wca_persons;\n\\echo SNAPSHOT_READY`);
      await snapshot.marker('SNAPSHOT_READY');
      try {
        await fixture('wca_persons.copy.tsv', '2026TEST01\t新名字\tChina\tf\n');
        await applyArtifact();
        expect(await inArtifact('SELECT name,gender FROM wca_persons;')).toBe('新名字|f');
        expect(await inArtifact('SELECT xmin::text FROM historical_ranks_monthly_snapshot;')).toBe(initialMonthlyVersion);
        const held = await snapshot.finish('SELECT name FROM wca_persons; COMMIT;');
        expect(held.code).toBe(0);
        expect(held.output.trim()).toBe('Old person\nSNAPSHOT_READY\nOld person');
      } finally {
        await snapshot.finish('ROLLBACK;');
      }
      const metadata = await inArtifact('SELECT value FROM meta_historical;');
      await fixture('wca_persons.copy.tsv', '2026TEST01\tMust rollback\tChina\tm\n');
      await fixture('historical_best_ranks.copy.tsv', bestRow.replace('1\t500', 'invalid\t500'));
      const rejected = await session().finish(`SET search_path=${artifactSchema};\n\\i ${artifactFile}`);
      expect(rejected.code).not.toBe(0);
      expect(rejected.error).toContain('invalid input syntax for type integer');
      expect(await inArtifact('SELECT name FROM wca_persons;')).toBe('新名字');
      expect(await inArtifact('SELECT value FROM meta_historical;')).toBe(metadata);
    } finally {
      await run(`DROP SCHEMA ${artifactSchema} CASCADE;`, false);
    }
  }, 30_000);

  it('rejects insufficient disk capacity before touching committed rows', async () => {
    const refresh = await refreshPeople();
    // Fixture the measured free bytes, keeping the actual SQL admission formula.
    const constrained = refresh.replace(/^\\set import_available_bytes .*$/gm, '\\set import_available_bytes 0');
    const rejected = await session().finish(`${importTransactionStart('stats_import_test')}\n${constrained}\nCOMMIT;`);
    expect(rejected.code).not.toBe(0);
    expect(rejected.error).toContain('Insufficient disk space before staging');
    expect(await run(readJoined)).toBe(oldJoined);
  });

  it('physically releases the temporary heap before commit without truncating the live table or leaking planner settings', async () => {
    const refresh = await refreshPeople();
    const truncateStage = 'TRUNCATE pg_temp._refresh_wca_persons;';
    expect(refresh).toContain(truncateStage);
    const measured = refresh.replace(truncateStage, `
      SELECT set_config('cuberoot_test.stage_path',pg_relation_filepath('pg_temp._refresh_wca_persons'),true);
      SELECT set_config('cuberoot_test.stage_size',(pg_stat_file(current_setting('cuberoot_test.stage_path'))).size::text,true);
      ${truncateStage}`);
    for (const hashjoin of ['on', 'off']) {
      const before = await run('SELECT pg_relation_filepath(\'wca_persons\'),string_agg(id::text || \':\' || xmin::text,\',\' ORDER BY id) FROM wca_persons;');
      const outcome = await run(`${importTransactionStart('stats_import_test')}\nSET LOCAL enable_hashjoin=${hashjoin};\n${measured}
        SELECT 'stage_reclaimed=' || (current_setting('cuberoot_test.stage_size')::bigint > 0 AND (pg_stat_file(current_setting('cuberoot_test.stage_path'))).size = 0)::text;
        SELECT 'hashjoin=' || current_setting('enable_hashjoin');
        SELECT 'live_rows=' || count(*)::text FROM wca_persons;
        ROLLBACK;`);
      expect(outcome).toContain('stage_reclaimed=true');
      expect(outcome).toContain(`hashjoin=${hashjoin}`);
      expect(outcome).toContain('live_rows=2');
      expect(await run('SELECT pg_relation_filepath(\'wca_persons\'),string_agg(id::text || \':\' || xmin::text,\',\' ORDER BY id) FROM wca_persons;')).toBe(before);
      // Keep only this deliberately failing test session alive long enough to
      // inspect rollback. The production loader still uses ON_ERROR_STOP=1.
      const failed = await session().finish(`SET enable_hashjoin=${hashjoin};
        ${importTransactionStart('stats_import_test')}
        CREATE FUNCTION fail_stats_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced stats write failure'; END $$;
        CREATE TRIGGER fail_stats_update BEFORE UPDATE ON wca_persons FOR EACH ROW EXECUTE FUNCTION fail_stats_update();
        \\set ON_ERROR_STOP off
        ${refresh}
        ROLLBACK;
        \\set ON_ERROR_STOP on
        SELECT 'planner_after_error=' || current_setting('enable_hashjoin');`);
      expect(failed.code).toBe(0);
      expect(failed.error).toContain('forced stats write failure');
      expect(failed.output).toContain(`planner_after_error=${hashjoin}`);
      expect(await run(readJoined)).toBe(oldJoined);
    }
  });

  it('rejects a concurrent importer immediately and releases the transaction guard on rollback', async () => {
    const first = session();
    first.send(`${importTransactionStart('stats_import_test_first')}\n\\echo IMPORT_HELD`);
    await first.marker('IMPORT_HELD');
    try {
      const second = await session().finish(`SET statement_timeout='750ms';\n${importTransactionStart('stats_import_test_second')}\n${await refreshPeople()}\nCOMMIT;`);
      expect(second.code).not.toBe(0);
      expect(second.error).toContain('Another stats import is active');
      expect(second.error).not.toContain('statement timeout');
      expect(await run(readJoined)).toBe(oldJoined);
    } finally {
      await first.finish('ROLLBACK;');
    }
    await run(`${importTransactionStart('stats_import_test_third')}\n${await refreshPeople()}\nCOMMIT;`);
    expect(await run('SELECT count(*) FROM wca_persons;')).toBe('2');
  });
});
