import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { REPO, check, run } from './common.ts';
import { endpoint, gh, api, release, upload, download } from './github.ts';
import { withLocalLock } from './local-lock.ts';
import { BASELINE, inventory, patch, applyPatch, owns, archiveDescriptor, packSnapshot, unpackSnapshot, validate, hashFile, type Owner, type Inventory, type Archive } from './snapshot.ts';
const scripts = dirname(fileURLToPath(import.meta.url)), repoRoot = resolve(scripts, '../..');
function descriptor(r: any): Archive | undefined { const a = JSON.parse(r.body || '{}').statistics; return a ? archiveDescriptor(a) : undefined; }
async function fetchCurrent(out: string) {
  const r = release(), a = descriptor(r); check(a && !r.draft, 'Statistics Release is not initialized');
  const file = join(out, a.name); download(r, a.name, file);
  const dest = join(out, 'current'); const m = await unpackSnapshot(file, dest, a); check(m.kind === 'snapshot', 'Invalid current snapshot'); return { r, a, m, root: join(dest, 'data') };
}
function saveBase(target: string, m: Inventory) { mkdirSync(target, { recursive: true }); writeFileSync(join(target, BASELINE + '.next'), JSON.stringify(m)); renameSync(join(target, BASELINE + '.next'), join(target, BASELINE)); }
async function hydrate(target: string, out: string, replace: boolean) {
  const { m, root } = await fetchCurrent(out);
  check(!replace || process.env.GITHUB_ACTIONS === 'true', 'Replacement hydration is CI-only; local hydration preserves existing work');
  for (const f of m.files) if (!replace && existsSync(join(target, f.path))) check(await hashFile(join(target, f.path)) === f.sha256, `Local file differs: ${f.path}; preserve it before hydrating`);
  for (const f of m.files) { mkdirSync(dirname(join(target, f.path)), { recursive: true }); cpSync(join(root, f.path), join(target, f.path) + '.next'); renameSync(join(target, f.path) + '.next', join(target, f.path)); }
  saveBase(target, m); console.log(`Hydrated ${m.files.length} verified statistics files`);
}
async function submit(owner: Owner, target: string, out: string) {
  check(existsSync(join(target, BASELINE)), 'Statistics baseline missing: hydrate this checkout before computing, or restore its recorded publication baseline');
  const base = validate(JSON.parse(readFileSync(join(target, BASELINE), 'utf8')));
  const next = await inventory(target, run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }));
  const changes = patch(base, next, owner); check(changes.owner && ['wca', 'upcoming', 'elevations', 'scramble', 'world-bests'].includes(owner), 'Invalid owner');
  if (!changes.changes!.length) { console.log('No statistics changes to publish'); return; }
  const a = await packSnapshot(target, changes, out); upload(release(), join(out, a.name), a.name);
  const request = `stats-${Date.now()}-${process.pid}`;
  gh(['workflow', 'run', 'wca_data_release.yml', '--repo', REPO, '--ref', 'main', '-f', `candidate=${a.name}`, '-f', `request=${request}`]);
  const deadline = Date.now() + 60 * 60_000;
  while (Date.now() < deadline) {
    const runs = JSON.parse(gh(['run', 'list', '--repo', REPO, '--workflow', 'wca_data_release.yml', '--limit', '50', '--json', 'displayTitle,status,conclusion,url']));
    const found = runs.find((r: any) => r.displayTitle === `WCA data ${request}`);
    if (found?.status === 'completed') {
      check(found.conclusion === 'success', `Statistics publication failed; baseline retained: ${found.url}`);
      const files = [...base.files.filter(f => !owns(owner, f.path)), ...next.files.filter(f => owns(owner, f.path))].sort((a, b) => a.path.localeCompare(b.path));
      saveBase(target, { ...base, generatedAt: next.generatedAt, sourceCommit: next.sourceCommit, files }); console.log(found.url); return;
    }
    await sleep(15000);
  }
  throw new Error('Statistics publication is pending; baseline retained. Inspect Publish WCA data before retrying.');
}
async function publish(candidate: string, out: string) {
  check(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_WORKFLOW === 'Publish WCA data', 'Use the serialized statistics publication workflow');
  const host = process.env.WCA_SSH_HOST, key = process.env.WCA_SSH_KEY_FILE;
  check(host && /^[a-zA-Z0-9.@:-]+$/.test(host) && key, 'SSH configuration required');
  const options = ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3'];
  const remote = `/tmp/cuberoot-statistics-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  check(/^\/tmp\/cuberoot-statistics-\d+-\d+$/.test(remote), 'Invalid staging path');
  const ssh = (command: string) => run('ssh', [...options, host, command], { timeout: 600000 });
  const scp = (args: string[]) => run('scp', [...options, ...args], { timeout: 600000 });
  ssh(`mkdir -m 700 -p ${remote}`);
  scp(['common.ts', 'snapshot.ts', 'snapshot-deploy.ts', 'snapshot-cli.ts', 'github.ts', 'local-lock.ts'].map(n => join(scripts, n)).concat(`${host}:${remote}/`));
  let r = release(), committed = false, activated = false, uncertain = false;
  const old = descriptor(r);
  const deploy = (action: string, args = '') => ssh(`flock -w 120 /tmp/cuberoot-wca-data.lock node ${remote}/snapshot-deploy.ts ${action} /www/wwwroot/toolkit/stats ${args}`);
  try {
    deploy('recover', old?.sha256 ?? 'none');
    let a: Archive;
    if (candidate === 'statistics-server') {
      check(!old, 'Statistics snapshot already initialized; use an owner patch');
      const commit = run('git', ['rev-parse', 'HEAD']);
      ssh(`node ${remote}/snapshot-cli.ts export-server ${remote}/export ${commit}`);
      scp([`${host}:${remote}/export/descriptor.json`, join(out, 'descriptor.json')]);
      a = archiveDescriptor(JSON.parse(readFileSync(join(out, 'descriptor.json'), 'utf8')));
      scp([`${host}:${remote}/export/${a.name}`, join(out, a.name)]);
      await unpackSnapshot(join(out, a.name), join(out, 'bootstrap-verified'), a);
    } else {
      check(/^stats-patch-[a-f0-9]{64}\.tgz$/.test(candidate), 'Invalid statistics candidate');
      const current = await fetchCurrent(out); check(current.a.sha256 === old?.sha256, 'Release changed before publication');
      const file = join(out, candidate); download(r, candidate, file);
      check(await hashFile(file) === candidate.slice(12, -4), 'Candidate hash mismatch');
      const extracted = join(out, 'patch'); const change = await unpackSnapshot(file, extracted);
      applyPatch(current.root, current.m, change, extracted);
      if (change.changes!.some(c => ['all_past_comps.json', 'all_upcoming_comps.json'].includes(c.path))) {
        rmSync(join(current.root, 'comp_calendar'), { recursive: true, force: true });
        run(join(repoRoot, 'core/node_modules/.bin/tsx'), [join(repoRoot, 'core/jobs/stats-build/src/bin/build_calendar_comps.ts')], { cwd: join(repoRoot, 'core'), env: { ...process.env, STATS_OUTPUT_DIR: current.root } });
      }
      const m = await inventory(current.root, change.sourceCommit);
      a = await packSnapshot(current.root, m, out);
    }
    upload(release(), join(out, a.name), a.name);
    writeFileSync(join(out, 'descriptor.json'), JSON.stringify(a));
    scp([join(out, a.name), join(out, 'descriptor.json'), `${host}:${remote}/`]);
    deploy('activate', `${remote}/${a.name} ${remote}/descriptor.json ${old?.sha256 ?? 'none'}`); activated = true;
    try { api(`${endpoint}/${r.id}`, { body: JSON.stringify({ ...JSON.parse(r.body), statistics: a }, null, 2) }); }
    catch (error) {
      try { r = release(); } catch { uncertain = true; throw new Error('Release commit status unknown; keep live snapshot and journal for recovery'); }
      if (descriptor(r)?.sha256 !== a.sha256) throw error;
    }
    committed = true; r = release(); check(descriptor(r)?.sha256 === a.sha256, 'Statistics Release commit mismatch');
    deploy('finalize', a.sha256);
    for (const asset of r.assets) {
      const obsoleteSnapshot = /^stats-snapshot-[a-f0-9]{64}\.tgz$/.test(asset.name) && asset.name !== a.name;
      const obsoletePatch = /^stats-patch-[a-f0-9]{64}\.tgz$/.test(asset.name) && (asset.name === candidate || Date.now() - Date.parse(asset.created_at) > 7 * 86400000);
      if (obsoleteSnapshot || obsoletePatch) gh(['api', `${endpoint}/assets/${asset.id}`, '--method', 'DELETE']);
    }
    console.log(`Published ${a.name}; one current statistics snapshot retained`);
  } catch (error) { if (activated && !committed && !uncertain) deploy('rollback'); throw error; }
  finally { ssh(`rm -r -- ${remote}`); }
}
const [command, arg, extra] = process.argv.slice(2);
const out = mkdtempSync(join(tmpdir(), 'cuberoot-statistics-'));
try {
  if (command === 'hydrate' || command === 'hydrate-ci') {
    const target = resolve(arg ?? join(repoRoot, 'stats'));
    await withLocalLock(join(target, BASELINE + '.lock'), () => hydrate(target, out, command === 'hydrate-ci'));
  } else if (command === 'submit') {
    const target = resolve(extra ?? join(repoRoot, 'stats'));
    await withLocalLock(join(target, BASELINE + '.lock'), () => submit(arg as Owner, target, out));
  }
  else if (command === 'publish') await publish(arg, out);
  else if (command === 'export-server') {
    check(/^\/tmp\/cuberoot-statistics-\d+-\d+$/.test(scripts) && arg === join(scripts, 'export'), 'Export is only for the server adoption workflow');
    mkdirSync(arg, { recursive: true }); const source = '/www/wwwroot/toolkit/stats';
    const m = await inventory(source, extra); const a = await packSnapshot(source, m, arg); writeFileSync(join(arg, 'descriptor.json'), JSON.stringify(a));
  } else throw new Error('Usage: snapshot-cli.ts hydrate|hydrate-ci|submit OWNER|publish CANDIDATE');
} finally { rmSync(out, { recursive: true, force: true }); }
