import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tables = process.argv.slice(2);
if (tables.length === 0) {
  throw new Error('No tables given. Usage: pnpm --filter @cuberoot/server seed:local <table> [table ...]');
}
for (const table of tables) {
  if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`Invalid table name: ${table}`);
}

// Keep the existing credential source. Never print the password or remote command.
let password = process.env.PROD_PG_PASS;
if (!password) {
  const secretFile = resolve(repoRoot, '.password.md');
  if (existsSync(secretFile)) password = readFileSync(secretFile, 'utf8').match(/recon_user.{0,10}?(\d{5,})/)?.[1];
}
if (!password) throw new Error('Prod PG password not found. Set PROD_PG_PASS or configure .password.md');

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
function done(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolveDone, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => code === 0 ? resolveDone() : reject(new Error(`${child.spawnfile} failed (${code ?? signal})`)));
  });
}

async function main(): Promise<void> {
  const remote = `PGPASSWORD=${quote(password!)} pg_dump -U recon_user -h 127.0.0.1 -d cuberoot_db --clean --if-exists --no-owner --no-privileges ${tables.flatMap(table => ['-t', table]).map(quote).join(' ')}`;
  console.log(`Pulling ${tables.join(', ')} from prod (cuberoot_db) -> local pg13/cuberoot_db ...`);
  const ssh = spawn('ssh', ['root@cuberoot', remote], { stdio: ['ignore', 'pipe', 'inherit'] });
  const docker = spawn('docker', ['exec', '-i', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-q'], { stdio: ['pipe', 'inherit', 'inherit'] });
  ssh.stdout.pipe(docker.stdin);
  await Promise.all([done(ssh), done(docker)]);
  console.log('Done. Row counts in pg13:');
  for (const table of tables) {
    const child = spawn('docker', ['exec', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-tAc', `select '${table}='||count(*) from ${table};`], { stdio: 'inherit' });
    await done(child);
  }
}
void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
