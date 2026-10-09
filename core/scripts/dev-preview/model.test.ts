import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { allocate, authorizeScript, hostOf, nginx, origins, publicKey, sshBlock, validate, type Registry, type Machine } from './model.ts';
import { launchAgentXml, taskXml } from './autostart.ts';

const registry = (): Registry => JSON.parse(readFileSync(new URL('../../../ops/dev-preview/machines.json', import.meta.url), 'utf8'));
const candidate = (): Machine => ({ owner: 'xiaoming', device: 'macbook-pro', os: 'mac', transport: 'ssh', status: 'pending', localPort: 3000, remotePort: 7105, certificate: 'dev-xiaoming-macbook-pro', aliases: [] });
test('allocation preserves existing, live, and revoked reservations', () => {
  const r = registry(); assert.equal(allocate(r), 7105);
  const m = candidate(); m.status = 'revoked'; r.machines.push(m);
  assert.equal(allocate(r, [7106, 7107]), 7108);
});
test('rejects injection, ambiguous identities, invalid ports and duplicate hostnames', () => {
  for (const value of ['A', '../name', 'a;id', 'a\nb', '-x', '张三']) {
    const r = registry(); const m = candidate(); m.owner = value; r.machines.push(m); assert.throws(() => validate(r));
  }
  const r = registry(); r.machines.push({ ...candidate(), remotePort: 7102 }); assert.throws(() => validate(r));
  const r2 = registry(); r2.machines.push({ ...candidate(), aliases: ['dev.cuberoot.me'] }); assert.throws(() => validate(r2));
});
test('pending machines expose only certificate validation; activation and revocation affect all artifacts', () => {
  const r = registry(), m = candidate(); r.machines.push(m); validate(r);
  assert.match(nginx(r), /dev-xiaoming-macbook-pro\.cuberoot\.me/);
  assert.ok(!nginx(r).includes('/live/dev-xiaoming-macbook-pro/'));
  assert.ok(!origins(r).includes('xiaoming'));
  m.status = 'active'; assert.ok(nginx(r).includes('127.0.0.1:7105'));
  assert.ok(origins(r).includes(hostOf(r, m)));
  m.status = 'revoked'; assert.ok(!nginx(r).includes('xiaoming')); assert.ok(!origins(r).includes('xiaoming'));
});
test('checked-in nginx and shared allowlist are generated from the registry', () => {
  const r = validate(registry());
  assert.equal(readFileSync(new URL('../../../ops/nginx/dev-machines.conf', import.meta.url), 'utf8'), nginx(r));
  assert.equal(readFileSync(new URL('../../packages/shared/src/dev-preview.ts', import.meta.url), 'utf8'), origins(r));
});
test('client creates a private per-device key once and rejects a mismatched connection profile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cuberoot-dev-test-'));
  const cli = fileURLToPath(new URL('./client.ts', import.meta.url));
  try {
    const args = [cli, 'init', '--id', 'test-laptop', '--state', dir];
    execFileSync(process.execPath, args, { stdio: 'pipe' });
    const first = readFileSync(join(dir, 'id_ed25519'));
    execFileSync(process.execPath, args, { stdio: 'pipe' });
    assert.deepEqual(readFileSync(join(dir, 'id_ed25519')), first);
    const request = JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8'));
    assert.equal(request.id, 'test-laptop'); assert.ok(!JSON.stringify(request).includes('PRIVATE'));
    const key = publicKey(request.publicKey); assert.equal(key.split(' ')[0], 'ssh-ed25519');
    assert.throws(() => publicKey('ssh-ed25519 invalid'));
    const script = authorizeScript(candidate(), key);
    assert.ok(script.includes('permitlisten="127.0.0.1:7105"'));
    assert.ok(sshBlock(candidate()).includes('MaxSessions 0')); assert.ok(sshBlock(candidate()).includes('AllowTcpForwarding remote'));
    if (process.platform !== 'win32') assert.equal(spawnSync('bash', ['-n'], { input: script }).status, 0);
    const invalid = join(dir, 'invalid.json'); writeFileSync(invalid, JSON.stringify({ version: 1, id: 'someone-else' }));
    const result = spawnSync(process.execPath, [cli, 'configure', '--id', 'test-laptop', '--state', dir, '--profile', invalid, '--repo', dir], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Invalid connection profile/); assert.ok(!existsSync(join(dir, 'profile.json')));
  } finally { rmSync(dir, { recursive: true }); }
});
test('native OS accepts generated login startup definitions', { skip: !['darwin', 'win32'].includes(process.platform) }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cuberoot-startup-test-'));
  const task = `CubeRootDev-ci-${process.pid}`;
  try {
    if (process.platform === 'darwin') {
      const file = join(dir, 'test.plist');
      writeFileSync(file, launchAgentXml('me.cuberoot.dev.test', process.execPath, ['--version'], '/usr/bin:/bin', dir));
      execFileSync('plutil', ['-lint', file], { stdio: 'pipe' });
      const decoded = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }));
      assert.deepEqual(decoded.ProgramArguments, [process.execPath, '--version']);
    } else {
      const user = execFileSync('whoami.exe', [], { encoding: 'utf8' }).trim(), file = join(dir, 'test.xml');
      writeFileSync(file, '\ufeff' + taskXml(process.execPath, ['--version'], user, dir), 'utf16le');
      execFileSync('schtasks.exe', ['/Create', '/TN', task, '/XML', file, '/F'], { stdio: 'pipe' });
      const data = execFileSync('schtasks.exe', ['/Query', '/TN', task, '/XML'], { encoding: 'utf8' });
      assert.match(data, /<ExecutionTimeLimit>PT0S<\/ExecutionTimeLimit>/);
      assert.match(data, /<LogonType>InteractiveToken<\/LogonType>/);
    }
  } finally {
    if (process.platform === 'win32') spawnSync('schtasks.exe', ['/Delete', '/TN', task, '/F']);
    rmSync(dir, { recursive: true });
  }
});
