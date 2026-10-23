import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { REPO, FILES, check, run, pack, unpack, parseManifest, assertFresh, obsoleteAssets, type Manifest } from './common.ts';

import { endpoint, gh, api, release, upload, download } from './github.ts';
import { withLocalLock } from './local-lock.ts';

const scripts = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scripts, '../..');
function currentManifest(r: any): Manifest | undefined { return r.body ? parseManifest(JSON.parse(r.body)) : undefined; }
function stage(root: string, out: string) {
  const m = pack(root, out, run('git', ['rev-parse', 'HEAD']));
  const r = release(true);
  assertFresh(m, currentManifest(r));
  upload(r, join(out, m.archive.name), m.archive.name);
  const name = `candidate-${m.archive.sha256}.json`;
  upload(release(), join(out, name), name);
  return { m, name };
}
function sshConfig() {
  const host = process.env.WCA_SSH_HOST, key = process.env.WCA_SSH_KEY_FILE;
  check(host && /^[a-zA-Z0-9.@:-]+$/.test(host) && key, 'WCA_SSH_HOST and WCA_SSH_KEY_FILE required');
  return { host, options: ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3'] };
}
async function publish(candidate: string, out: string) {
  check(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'Publish WCA data', 'Production publish must use the serialized Publish WCA data workflow');
  const { host, options } = sshConfig();
  const remote = `/tmp/cuberoot-wca-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  check(/^\/tmp\/cuberoot-wca-\d+-\d+$/.test(remote), 'Invalid remote staging directory');
  const remoteRun = (args: string) => run('ssh', [...options, host, args], { timeout: 300_000 });
  remoteRun(`mkdir -m 700 -p ${remote}`);
  let committed = false;
  let activated = false;
  let commitUncertain = false;
  try {
    if (candidate === 'server') {
      const source = join(out, 'source');
      mkdirSync(join(source, 'nemesizer'), { recursive: true });
      for (const file of FILES) run('scp', [...options, `${host}:/www/wwwroot/toolkit/stats/${file}`, join(source, file)], { timeout: 120_000 });
      candidate = stage(source, out).name;
    }
    check(/^candidate-[a-f0-9]{64}\.json$/.test(candidate), 'Invalid candidate name');
    let r = release();
    const previousArchive = currentManifest(r)?.archive.name;
    const manifestPath = join(out, candidate);
    if (!existsSync(manifestPath)) download(r, candidate, manifestPath);
    const m = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
    check(candidate === `candidate-${m.archive.sha256}.json`, 'Candidate identity mismatch');
    assertFresh(m, currentManifest(r));
    const archive = join(out, m.archive.name);
    if (!existsSync(archive)) download(r, m.archive.name, archive);
    unpack(archive, m, join(out, 'verified'));
    run('scp', [...options, archive, manifestPath, join(scripts, 'common.ts'), join(scripts, 'deploy.ts'), `${host}:${remote}/`], { timeout: 180_000 });
    const deploy = (action: string) => remoteRun(`flock -w 120 /tmp/cuberoot-wca-data.lock node ${remote}/deploy.ts ${action} /www/wwwroot/toolkit/stats${action === 'activate' ? ` ${remote}/${m.archive.name} ${remote}/${candidate}` : action === 'finalize' ? ` ${m.archive.sha256}` : ''}`);
    // A prior interrupted publish may have switched live data without advancing the Release.
    // Recover to the last committed Release before accepting a new candidate.
    remoteRun(`node ${remote}/deploy.ts recover /www/wwwroot/toolkit/stats ${currentManifest(r)?.archive.sha256 ?? 'none'}`);
    console.log(deploy('activate'));
    activated = true;
    try {
      api(`${endpoint}/${r.id}`, { body: JSON.stringify({ ...m, ...(JSON.parse(r.body || '{}').statistics ? { statistics: JSON.parse(r.body).statistics } : {}) }, null, 2), draft: false, make_latest: 'false', name: 'Latest WCA data' });
    } catch (error) {
      // Network timeout can happen after GitHub committed the PATCH. Resolve before rollback.
      try { r = release(); } catch {
        commitUncertain = true;
        throw new Error('Release commit status is unknown; live data and recovery journal retained. Retry the publish workflow when GitHub is reachable.');
      }
      if (currentManifest(r)?.archive.sha256 !== m.archive.sha256) throw error;
    }
    committed = true;
    r = release();
    check(currentManifest(r)?.archive.sha256 === m.archive.sha256, 'Release commit verification failed');
    console.log(deploy('finalize'));
    // Delete only the previous current archive and this completed candidate. Concurrent
    // staged candidates belong to queued runs and must not be removed underneath them.
    for (const asset of obsoleteAssets(r.assets, m.archive.name, candidate, Date.now(), previousArchive)) gh(['api', `${endpoint}/assets/${asset.id}`, '--method', 'DELETE']);
    console.log(JSON.stringify({ release: r.html_url, archive: m.archive.name, exportDate: m.exportDate, generatedAt: m.generatedAt, files: m.files.length }));
  } catch (error) {
    if (activated && !committed && !commitUncertain) remoteRun(`node ${remote}/deploy.ts rollback /www/wwwroot/toolkit/stats`);
    throw error;
  } finally {
    remoteRun(`rm -rf -- ${remote}`);
  }
}
async function submit(source: string, out: string) {
  check(process.env.GITHUB_ACTIONS === 'true', 'Use the WCA generation workflow for submission');
  const { name } = stage(source, out);
  const request = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  check(/^\d+-\d+$/.test(request), 'Invalid workflow request identity');
  gh(['workflow', 'run', 'wca_data_release.yml', '--repo', REPO, '--ref', 'main', '-f', `candidate=${name}`, '-f', `request=${request}`]);
  const deadline = Date.now() + 45 * 60_000;
  while (Date.now() < deadline) {
    const runs = JSON.parse(gh(['run', 'list', '--repo', REPO, '--workflow', 'wca_data_release.yml', '--limit', '30', '--json', 'displayTitle,status,conclusion,url']));
    const found = runs.find((r: any) => r.displayTitle === `WCA data ${request}`);
    if (found?.status === 'completed') { check(found.conclusion === 'success', `Data publication failed: ${found.url}`); console.log(found.url); return; }
    await sleep(15_000);
  }
  throw new Error('WCA publication is still pending; inspect Publish WCA data before retrying');
}
function hydrate(target: string, out: string) {
  const tracked = run('git', ['ls-files', '--', ...FILES.map(f => `stats/${f}`)], { cwd: repoRoot });
  check(!tracked, 'Migrated files are still tracked; do not overwrite checkout data');
  const r = release(), m = currentManifest(r);
  check(m && !r.draft, 'No complete published dataset');
  const archive = join(out, m.archive.name);
  download(r, m.archive.name, archive);
  const extracted = join(out, 'verified');
  unpack(archive, m, extracted);
  // Download and verify everything before touching local files. Never link to another checkout.
  mkdirSync(target, { recursive: true });
  for (const file of FILES) { mkdirSync(dirname(join(target, file)), { recursive: true }); cpSync(join(extracted, file), `${join(target, file)}.next`); }
  for (const file of FILES) renameSync(`${join(target, file)}.next`, join(target, file));
  console.log(`Hydrated ${m.exportDate}: ${target}`);
}
const [command, argument] = process.argv.slice(2);
const out = mkdtempSync(join(tmpdir(), 'cuberoot-wca-'));
try {
  if (command === 'pack') console.log(JSON.stringify(pack(resolve(argument ?? 'stats'), out, run('git', ['rev-parse', 'HEAD'])), null, 2));
  else if (command === 'submit') await submit(resolve(argument ?? 'stats'), out);
  else if (command === 'publish') await publish(argument ?? 'server', out);
  else if (command === 'hydrate') {
    const target = resolve(argument ?? join(repoRoot, 'stats'));
    await withLocalLock(join(target, '.stats-release-base.json.lock'), () => hydrate(target, out));
  }
  else throw new Error('Usage: node scripts/wca-data/cli.ts pack|hydrate|submit|publish [directory|candidate]');
} finally { rmSync(out, { recursive: true, force: true }); }
