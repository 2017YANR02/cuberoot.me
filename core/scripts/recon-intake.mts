import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { ReconIntakeCase, ReconIntakeClaim, ReconIntakeRun } from '@cuberoot/shared/recon-ground-truth';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(core, '..');
const envFile = resolve(core, '.env.recon-intake.local');
const privateEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const origin = process.env.RECON_INTAKE_API_URL ?? privateEnv.RECON_INTAKE_API_URL ?? 'http://127.0.0.1:3011';
const key = process.env.ADMIN_API_KEY ?? privateEnv.ADMIN_API_KEY;
const [command = 'help', id] = process.argv.slice(2);
const work = resolve(root, '.tmp/recon-intake');
const fixturePath = resolve(core, 'packages/client/tests/fixtures/recon-intake.json');
const libraryPath = resolve(core, 'packages/client/tests/fixtures/recon-workbook/libraries.json');
const sha = (data: string) => createHash('sha256').update(data).digest('hex');
function write(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.' + randomUUID() + '.tmp';
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, path);
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  if (!key) throw new Error('Set ADMIN_API_KEY in core/.env.recon-intake.local or the environment');
  const url = new URL('/v1/recon-intake' + path, origin);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Remote API requires HTTPS');
  const response = await fetch(url, { method: body ? 'POST' : 'GET', redirect: 'error',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Intake API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
async function list(status: string) {
  const items: ReconIntakeCase[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await request<{ items: ReconIntakeCase[]; hasMore: boolean }>(`?status=${status}&offset=${offset}`);
    items.push(...page.items);
    if (!page.hasMore) break;
  }
  return items;
}
function localFile(name: string) {
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('A case UUID is required');
  return resolve(work, id, name);
}
function lease() {
  const claim: ReconIntakeClaim = JSON.parse(readFileSync(localFile('claim.json'), 'utf8'));
  if (claim.item.id !== id) throw new Error('Claim identity mismatch');
  return claim;
}
function binding(claim: ReconIntakeClaim) {
  return { leaseToken: claim.leaseToken, revision: claim.item.revision, contentHash: claim.item.contentHash };
}
async function exportActive() {
  const items = (await list('active')).filter(i => i.expected && i.approvedBy);
  write(fixturePath, { version: 1, cases: items.map(({ id, revision, contentHash, input, expected }) =>
    ({ id, revision, contentHash, input, expected })).sort((a, b) => a.id.localeCompare(b.id)) });
  return items.length;
}
function run(args: string[]) {
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: core, stdio: 'inherit', timeout: 600000, shell: process.platform === 'win32',
    // Local intake checks must not publish unrelated test history to production.
    env: { ...process.env, RECON_TEST_DISABLE_SYNC: '1',
      RECON_TEST_MAX_WORKERS: process.env.RECON_TEST_MAX_WORKERS ?? '2' },
  });
  if (result.status !== 0) throw new Error(`Command failed: pnpm ${args.join(' ')}`);
}
async function main() {
  if (command === 'help') {
    console.log('recon:intake list | show ID | claim ID | renew ID | check ID | publish ID | interrupt ID | export');
    console.log('check runs the candidate then existing regression gate; publish retries a saved result. See docs/recon-intake-workflow.md.');
    return;
  }
  if (command === 'list') {
    console.log(JSON.stringify((await list('todo')).map(i => ({ id: i.id, revision: i.revision,
      status: i.status, claimedBy: i.claimedBy, leaseUntil: i.leaseUntil, annotations: i.input.annotations })), null, 2));
    return;
  }
  if (command === 'export') {
    console.log(`Exported ${await exportActive()} active cases. Review and commit this snapshot with the rule change when publishing is authorized.`);
    return;
  }
  localFile('claim.json');
  if (command === 'show') {
    console.log(JSON.stringify(await request('/' + id), null, 2)); return;
  }
  if (command === 'claim') {
    const claim = await request<ReconIntakeClaim>(`/${id}/claim`, {});
    write(localFile('claim.json'), claim);
    console.log(`Claim saved: ${localFile('claim.json')}\nRevision ${claim.item.revision}; renew before ${claim.item.leaseUntil}`);
    return;
  }
  const claim = lease(), body = binding(claim);
  if (command === 'renew') {
    claim.item = await request(`/${id}/renew`, body);
    write(localFile('claim.json'), claim); console.log('Renewed until ' + claim.item.leaseUntil); return;
  }
  if (command === 'publish') {
    const report = JSON.parse(readFileSync(localFile('result.json'), 'utf8'));
    const saved = await request<ReconIntakeCase>(`/${id}/results`, report);
    console.log('Saved result: ' + saved.status); return;
  }
  if (command !== 'check' && command !== 'interrupt') throw new Error('Unknown command');
  await request(`/${id}/renew`, body);
  const report: ReconIntakeRun = { id: randomUUID(), status: 'interrupted', actual: null, errors: [],
    fingerprint: '0'.repeat(64), libraryHash: sha(readFileSync(libraryPath, 'utf8')), commit: '',
    regressionPassed: false };
  if (command === 'interrupt') report.errors.push('Processing stopped; original recording and local progress retained');
  else {
    write(localFile('progress.json'), { status: 'running', pid: process.pid, startedAt: new Date().toISOString(), ...body });
    try {
      run(['--filter', '@cuberoot/shared', 'build']);
      await exportActive();
      const { computeFingerprint } = await import('./recon-ground-truth-gate.mjs');
      report.fingerprint = computeFingerprint();
      report.commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
      const { checkReconIntake } = await import('../packages/client/lib/recon-intake-check.mts');
      const checked = await checkReconIntake(claim.item, JSON.parse(readFileSync(libraryPath, 'utf8')));
      report.actual = checked.actual; report.errors = checked.errors;
      if (!report.errors.length) {
        // A proposal still requires human review; no expected answer is rewritten.
        run(['exec', 'node', 'scripts/recon-ground-truth-gate.mjs', 'run', '--offline']);
        report.regressionPassed = true;
      }
      if (computeFingerprint() !== report.fingerprint) report.errors.push('Source changed during the run; retry on stable content');
      report.status = report.errors.length ? 'failed' : 'passed';
    } catch (error) { report.status = 'failed'; report.errors.push(String(error)); }
  }
  // Retain failures and network failures before attempting the API write.
  write(localFile('result.json'), { ...body, run: report });
  write(localFile('progress.json'), { status: report.status, finishedAt: new Date().toISOString() });
  const saved = await request<ReconIntakeCase>(`/${id}/results`, { ...body, run: report });
  console.log(`Result ${report.status}; queue status ${saved.status}; ${localFile('result.json')}`);
  if (report.status !== 'passed') process.exitCode = 1;
}
main().catch(error => { console.error(String(error)); process.exitCode = 1; });
