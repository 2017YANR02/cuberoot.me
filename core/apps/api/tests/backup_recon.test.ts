import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const root = resolve(import.meta.dirname, '../../../..');
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'backup-recon-')); const bin = join(dir, 'bin'); const archive = join(dir, 'archive'); mkdirSync(bin); mkdirSync(archive);
  // macOS has no util-linux flock; the production host uses the actual command.
  writeFileSync(join(bin, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  writeFileSync(join(bin, 'pg_dump'), '#!/bin/sh\ncat "$FIXTURE_SQL"\nexit "${FIXTURE_EXIT:-0}"\n', { mode: 0o700 });
  const sql = join(dir, 'fixture.sql'); writeFileSync(sql, `${randomBytes(4096).toString('hex')}\n-- PostgreSQL database dump complete\n`);
  const envFile = join(dir, 'runtime.env'); writeFileSync(envFile, 'DB_PASS=fixture-secret\n');
  for (const day of ['01', '02', '03']) {
    writeFileSync(join(archive, `pg-recon-2020-01-${day}.sql.gz`), `old-${day}`); writeFileSync(join(archive, `env-2020-01-${day}`), 'old-env');
  }
  const run = (extra: Record<string,string> = {}) => spawnSync('bash', [join(root, 'ops/bin/pg-dump-recon.sh')], {
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PGPASSWORD: 'fixture-secret', CUBEROOT_BACKUP_DIR: archive, CUBEROOT_DB_ENV_FILE: envFile, FIXTURE_SQL: sql, ...extra },
  }); return { run, archive, sql };
}
describe('database backup safety', () => {
  it('retains two successful dates and matching private configuration', () => {
    const f = fixture(); const result = f.run(); expect(result.status, result.stderr).toBe(0);
    const names = readdirSync(f.archive); const dumps = names.filter(n => n.endsWith('.sql.gz'));
    expect(dumps).toHaveLength(2); expect(dumps).toContain('pg-recon-2020-01-03.sql.gz'); expect(names.filter(n => n.startsWith('env-'))).toHaveLength(2);
    const latest = dumps.find(n => !n.includes('2020-'))!; expect(statSync(join(f.archive, latest)).mode & 0o777).toBe(0o600); expect(result.stdout).not.toContain('fixture-secret');
  });
  it('does not prune when pg_dump fails after substantial output', () => {
    const f = fixture(); const before = readdirSync(f.archive); expect(f.run({ FIXTURE_EXIT: '7' }).status).not.toBe(0);
    expect(readdirSync(f.archive).filter(n => n !== '.pg-dump-recon.lock')).toEqual(before);
    expect(readFileSync(join(f.archive, 'pg-recon-2020-01-01.sql.gz'), 'utf8')).toBe('old-01');
  });
  it('rejects incomplete output even with exit zero', () => {
    const f = fixture(); writeFileSync(f.sql, randomBytes(4096).toString('hex')); expect(f.run().status).not.toBe(0);
    expect(readdirSync(f.archive).filter(n => n.endsWith('.sql.gz'))).toHaveLength(3);
  });
  it('preserves backups when the configuration cannot be copied', () => {
    const f = fixture(); expect(f.run({ CUBEROOT_DB_ENV_FILE: '/does-not-exist' }).status).not.toBe(0);
    expect(readdirSync(f.archive).filter(n => n.endsWith('.sql.gz'))).toHaveLength(3);
  });
});
