// Disposable PostgreSQL only. No application environment files, real credentials or network transports.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync('/tmp/cuberoot-email-code-fixture-');
const data = join(root, 'data');
const port = await new Promise((resolvePort, reject) => {
  const server = createServer(); server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(error => error ? reject(error) : resolvePort(address.port)); });
});
const fixtureEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: 'true', LC_ALL: 'C', LANG: 'C',
  DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'email_code_fixture', DB_PASS: '',
  JWT_SECRET: 'synthetic-email-code-fixture-jwt-key', AUTH_CODE_PEPPER: 'synthetic-email-code-fixture-pepper',
  RESEND_API_KEY: 'synthetic-no-real-provider', MAIL_FROM: 'Fixture <fixture@example.invalid>',
};
const run = (file, args, env = fixtureEnv) => execFileSync(file, args, { cwd: apiRoot, env, stdio: 'inherit' });
let started = false;
try {
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'email_code_fixture', '--no-locale', '--encoding=UTF8']);
  run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${root}`, '-w', 'start']); started = true;
  for (const name of ['email_code_test', 'identity_choice_test']) run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'email_code_fixture', name]);
  run('pnpm', ['exec', 'vitest', 'run', 'tests/email_code_auth_pg.test.ts', 'tests/email_transport.test.ts'], { ...fixtureEnv, DB_NAME: 'email_code_test', EMAIL_CODE_PG_TEST: '1' });
  run('pnpm', ['exec', 'vitest', 'run', 'tests/identity_choice_pg.test.ts'], { ...fixtureEnv, DB_NAME: 'identity_choice_test', IDENTITY_CHOICE_PG_TEST: '1' });
} catch (error) {
  console.error('Email-code fixture failed:', error.message);
  process.exitCode = typeof error.status === 'number' && error.status !== 0 ? error.status : 1;
} finally {
  if (started) { try { run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']); } catch { process.exitCode = 1; } }
  console.log(`Isolated fixture and logs retained at ${root}`);
}
