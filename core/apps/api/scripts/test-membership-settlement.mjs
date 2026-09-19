// Disposable PostgreSQL fixture only; never reads application DB environment/configuration.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = mkdtempSync('/tmp/cuberoot-membership-fixture-');
const data = join(fixtureRoot, 'data');
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close(error => error ? reject(error) : resolvePort(address.port));
  });
});
const command = (file, args, options = {}) => execFileSync(file, args, { cwd: apiRoot, stdio: 'inherit', ...options });
let started = false;
try {
  command('initdb', ['-D', data, '-A', 'trust', '-U', 'membership_fixture', '--no-locale', '--encoding=UTF8']);
  command('pg_ctl', ['-D', data, '-l', join(fixtureRoot, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${fixtureRoot}`, '-w', 'start']);
  started = true;
  command('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'membership_fixture', 'membership_payment_test']);
  command('pnpm', ['exec', 'vitest', 'run', 'tests/membership-settlement.test.ts', ...process.argv.slice(2)], {
    env: { ...process.env, MEMBERSHIP_TEST_DATABASE_URL: `postgres://membership_fixture@127.0.0.1:${port}/membership_payment_test` },
  });
} catch (error) {
  console.error('Membership fixture failed:', error.message);
  process.exitCode = typeof error.status === 'number' && error.status !== 0 ? error.status : 1;
} finally {
  if (started) {
    try { command('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']); }
    catch { process.exitCode = 1; }
  }
  console.log(`Isolated fixture data and logs retained at ${fixtureRoot}`);
}
