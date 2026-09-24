import { X509Certificate } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { Resolver } from 'node:dns/promises';

// Local proxies can synthesize 198.18/15 addresses. Verify public DNS independently.
const dns = new Resolver({ timeout: 5000, tries: 2 });
dns.setServers(['223.5.5.5', '1.1.1.1']);
import { allocate, authorizeScript, hostOf, idOf, nginx, origins, publicKey, sh, slug, userOf, validate, type Machine, type Registry } from './model.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { values: v, positionals } = parseArgs({ allowPositionals: true, options: {
  owner: { type: 'string' }, device: { type: 'string' }, os: { type: 'string' },
  id: { type: 'string' }, request: { type: 'string' }, out: { type: 'string' },
  registry: { type: 'string' }, check: { type: 'boolean' },
} });
const command = positionals[0] ?? 'help';
const registryPath = resolve(v.registry ?? resolve(root, 'ops/dev-preview/machines.json'));
const r: Registry = validate(JSON.parse(readFileSync(registryPath, 'utf8')));
const ssh = (script: string) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', r.adminSsh, 'bash -s'], { input: script, encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
const save = () => writeFileSync(registryPath, JSON.stringify(validate(r), null, 2) + '\n');
const machine = () => {
  const m = r.machines.find(m => idOf(m) === v.id);
  if (!m) throw Error('Specify a registered --id owner-device');
  return m;
};
function render(check = false) {
  if (v.registry) throw Error('Alternate registries are inspection/test inputs; cannot render production files');
  for (const [path, content] of [
    ['ops/nginx/dev-machines.conf', nginx(r)],
    ['core/packages/shared/src/dev-preview.ts', origins(r)],
  ]) {
    const file = resolve(root, path);
    if (check) { if (readFileSync(file, 'utf8') !== content) throw Error(`Generated file drift: ${path}`); }
    else writeFileSync(file, content);
  }
}
function plan(m: Machine) {
  return {
    id: idOf(m), url: `https://${hostOf(r, m)}/zh`, status: m.status,
    dns: { type: 'A', record: `dev-${idOf(m)}`, value: r.server, line: 'default', ttl: 600 },
    local: `127.0.0.1:${m.localPort}`, serverForward: `127.0.0.1:${m.remotePort}`,
    transport: m.transport, sshUser: m.transport === 'ssh' ? userOf(m) : undefined,
    certificate: m.certificate,
    steps: m.status === 'pending' ? ['client init', 'authorize public request', 'DNS A record', 'render and deploy HTTP challenge', 'certificate', 'activate and deploy', 'client configure and run/install', 'verify'] : [],
  };
}
async function main() {
  if (v.registry && ['register', 'render', 'activate'].includes(command)) throw Error('Alternate registry cannot change production artifacts');
  switch (command) {
    case 'help':
      console.log('Dev preview: plan | register --owner NAME --device DEVICE --os mac|windows | render [--check] | authorize --id ID --request FILE --out FILE | certificate --id ID | activate --id ID | verify --id ID | revoke --id ID\nRun from core: pnpm exec tsx scripts/dev-preview/cli.ts COMMAND\nFull workflow: docs/dev-preview-onboarding.md'); return;
    case 'plan': console.log(JSON.stringify(v.id ? plan(machine()) : r.machines.map(plan), null, 2)); return;
    case 'register': {
      const owner = slug(v.owner ?? ''), device = slug(v.device ?? '');
      if (!['mac', 'windows'].includes(v.os ?? '')) throw Error('--os mac|windows is required');
      const old = r.machines.find(m => idOf(m) === `${owner}-${device}`);
      if (old) {
        if (old.os !== v.os || old.status === 'revoked') throw Error('Existing/revoked identity differs; inspect before reusing');
        console.log(JSON.stringify(plan(old), null, 2)); return;
      }
      const listeners = ssh('ss -H -lnt').split('\n').flatMap(line => {
        const match = line.trim().split(/\s+/)[3]?.match(/:(\d+)$/); return match ? [Number(match[1])] : [];
      });
      const reserved = ssh('if [ -d /var/lib/cuberoot-dev/ports ]; then find /var/lib/cuberoot-dev/ports -maxdepth 1 -type f -printf "%f\\n"; fi').trim().split('\n').map(Number);
      const m: Machine = { owner, device, os: v.os as Machine['os'], transport: 'ssh', status: 'pending', localPort: 3000, remotePort: allocate(r, [...listeners, ...reserved]), certificate: `dev-${owner}-${device}`, aliases: [] };
      r.machines.push(m); save(); render(); console.log(JSON.stringify(plan(m), null, 2)); return;
    }
    case 'render': render(v.check); console.log(v.check ? 'Generated files match registry' : 'Generated nginx and shared origin list'); return;
    case 'authorize': {
      const m = machine();
      if (m.transport !== 'ssh' || m.status === 'revoked') throw Error('Only new, non-revoked SSH machines may be authorized');
      if (!v.request || !v.out) throw Error('--request and --out required');
      const request = JSON.parse(readFileSync(resolve(v.request), 'utf8'));
      if (request.id !== idOf(m)) throw Error('Public-key request belongs to a different device');
      const key = publicKey(request.publicKey);
      const hostKey = publicKey(ssh('cat /etc/ssh/ssh_host_ed25519_key.pub'));
      console.log(ssh(authorizeScript(m, key)).trim());
      writeFileSync(resolve(v.out), JSON.stringify({ version: 1, id: idOf(m), host: r.server, sshPort: 22, sshUser: userOf(m), localPort: m.localPort, remotePort: m.remotePort, url: `https://${hostOf(r, m)}/zh`, hostKey, publicKey: key }, null, 2) + '\n', { mode: 0o600 });
      console.log(`Connection profile (public data only): ${resolve(v.out)}`); return;
    }
    case 'certificate': {
      const m = machine(); if (m.status === 'revoked') throw Error('Device revoked');
      const host = hostOf(r, m), addresses = await dns.resolve4(host);
      if (!addresses.includes(r.server) || addresses.some(a => a !== r.server)) throw Error('DNS does not point exclusively to the preview server');
      const hosts = r.machines.filter(x => x.certificate === m.certificate && x.status !== 'revoked').flatMap(x => [hostOf(r, x), ...x.aliases.filter(a => a !== 'dev.cuberoot.me')]);
      console.log(ssh(`set -eu\nnginx -t\ncertbot certonly --webroot -w /www/wwwroot/cuberoot-spa --non-interactive --cert-name ${sh(m.certificate)} --expand --keep-until-expiring ${hosts.map(h => '-d ' + sh(h)).join(' ')}\n`)); return;
    }
    case 'activate': {
      const m = machine(); if (m.status === 'revoked') throw Error('Device revoked');
      const cert = new X509Certificate(ssh('cat /etc/letsencrypt/live/' + m.certificate + '/fullchain.pem'));
      if (!cert.checkHost(hostOf(r, m)) || Date.parse(cert.validTo) < Date.now() + 86_400_000) throw Error('Certificate missing hostname or expiring');
      m.status = 'active'; save(); render(); console.log('Ready to commit/push nginx and origin artifacts; activation still requires deployment'); return;
    }
    case 'revoke': {
      const m = machine(); if (m.transport !== 'ssh') throw Error('Legacy FRP must be revoked in its own configuration');
      // Revoke first, including established sessions, then remove public routing in the next deployment.
      console.log(ssh(`set -eu\nfile=/var/lib/cuberoot-dev/${idOf(m)}/authorized_keys\nif [ -f "$file" ]; then cp -p "$file" "$file.revoked-$(date +%s)"; : > "$file"; fi\nif id ${userOf(m)} >/dev/null 2>&1; then pkill -u ${userOf(m)} || test "$?" = 1; fi\necho 'Device access revoked; reserved port retained'\n`));
      m.status = 'revoked'; save(); if (!v.registry) render(); console.log('Deploy generated changes to remove nginx/CORS access; remove DNS through Aliyun'); return;
    }
    case 'verify': {
      const m = machine(), host = hostOf(r, m);
      if (m.status !== 'active') throw Error('Registry is not active');
      const addresses = await dns.resolve4(host);
      if (!addresses.includes(r.server)) throw Error('DNS mismatch');
      const htmlResponse = await fetch(`https://${host}/zh`, { signal: AbortSignal.timeout(45_000) });
      const html = await htmlResponse.text();
      if (htmlResponse.status !== 200 || !html.includes('CubeRoot')) throw Error(`Page failed: ${htmlResponse.status}`);
      const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(x => new URL(x[1].replaceAll('&amp;', '&'), `https://${host}`)).filter(u => u.origin === `https://${host}` && u.pathname.startsWith('/_next/'));
      if (!scripts.length) throw Error('No Next startup scripts found');
      // Bounded concurrency; check every script advertised by this HTML response.
      for (let i = 0; i < scripts.length; i += 4) await Promise.all(scripts.slice(i, i + 4).map(async url => {
        const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
        if (response.status !== 200 || !response.headers.get('content-type')?.includes('javascript')) throw Error(`Startup script failed: ${url} ${response.status}`);
        await response.arrayBuffer();
      }));
      const api = await fetch('https://api.cuberoot.me/v1/health', { method: 'OPTIONS', headers: { Origin: `https://${host}`, 'Access-Control-Request-Method': 'GET' }, signal: AbortSignal.timeout(15_000) });
      if (api.headers.get('access-control-allow-origin') !== `https://${host}`) throw Error('API origin not deployed yet');
      console.log(JSON.stringify({ id: idOf(m), url: `https://${host}/zh`, dns: addresses, page: 200, startupScripts: scripts.length, cors: 'passed', checkedAt: new Date().toISOString() }, null, 2)); return;
    }
    default: throw Error(`Unknown command: ${command}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
