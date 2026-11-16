/** Audit every stored set with --all, or one --set puzzle/set. --apply fills
 * missing marks on existing LR/orientation counterparts; conflicts remain untouched.
 * --check exits unsuccessfully if fillable omissions, mismatches or mapping issues remain.
 * --repair-inconsistent removes stale markup only (never changes moves), instead
 * --add-missing-lr --set puzzle/set explicitly adds validated missing LR entries.
 * --mirror-down-grip opts into the confirmed down-arrow hand-spacing convention.
 * of propagating marks. Reports and pre-write snapshots require ALG_BACKUP_DIR. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AlgFile } from '@cuberoot/shared/alg';
import { lrMirrorEntry, mirrorGensFor, planExistingLrAnnotationRepairs } from '@cuberoot/shared/alg-mirror';
import { algHtmlMatchesText, consistentAlgEntry, sanitizeAlgHtml } from '@cuberoot/shared/alg-html';
import { duplicateAlgKey } from '@cuberoot/shared/alg-notation';

const args = process.argv.slice(2);
const key = args.includes('--set') ? args[args.indexOf('--set') + 1] : '';
if (!args.includes('--all') && !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(key)) throw new Error('Specify --all or --set puzzle/set');
const apply = args.includes('--apply');
const check = args.includes('--check');
const addMissing = args.includes('--add-missing-lr');
if (addMissing && (!key || args.includes('--all') || args.includes('--repair-inconsistent'))) {
  throw new Error('--add-missing-lr requires a single explicit --set and cannot repair inconsistent text');
}
if (check && apply) throw new Error('Run --check separately after --apply');
const base = (process.env.ALG_API_BASE ?? 'https://api.cuberoot.me').replace(/\/$/, '');
const backup = process.env.ALG_BACKUP_DIR;
if (apply && (!process.env.ADMIN_API_KEY || !process.env.ALG_API_BASE || !backup)) {
  throw new Error('--apply requires ALG_API_BASE, ADMIN_API_KEY and ALG_BACKUP_DIR');
}
const canonical = (value: unknown): string => JSON.stringify(value, (key, v) =>
  key === 'algHtml' && typeof v === 'string' ? sanitizeAlgHtml(v)
    : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
async function read<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try { res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' }); }
    catch (error) {
      if (attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    if (attempt >= 2 || ![429, 502, 503, 504].includes(res.status)) throw new Error(`GET ${res.status}: ${url}`);
    await res.body?.cancel();
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
const sets = args.includes('--all')
  ? (await read<Array<{ puzzle: string; setSlug: string }>>(`${base}/v1/alg/sets`)).map(c => `${c.puzzle}/${c.setSlug}`)
  : [key];
const reports: unknown[] = [];
let unresolved = 0;
const started = Date.now();
if (backup) await mkdir(backup, { recursive: true });
for (const set of sets) {
  const url = `${base}/v1/alg/sets/${set}`;
  const before = await read<AlgFile>(url);
  const plan = planExistingLrAnnotationRepairs(before);
  const added: Array<{ from: number; to: number; alg: string }> = [];
  const skipped: Array<{ from: number; alg: string; reason: string }> = [];
  if (addMissing) {
    // Client validators use ESM-only cubing. Bundle this opt-in command with
    // esbuild (platform=node, format=esm, packages=external, css=empty) first.
    const { validatedMirrorEntry } = await import('./lib/alg-mirror-validation.mts');
    if (before.puzzle !== '3x3') throw new Error('Missing LR entry validation currently supports 3x3 only');
    for (const candidate of plan.missing) {
      if (!mirrorGensFor(candidate.entry.alg).includes('lr')) {
        skipped.push({ from: candidate.caseId, alg: candidate.entry.alg, reason: 'B-family mirror excluded by existing rule' });
        continue;
      }
      const mirrored = lrMirrorEntry(candidate.entry, { mirrorDownGrip: args.includes('--mirror-down-grip') });
      if (!mirrored) throw new Error(`case ${candidate.caseId}: cannot preserve all notation for ${candidate.entry.alg}`);
      const target = plan.cases.find(c => c.id === candidate.partnerId)!;
      const aligned = await validatedMirrorEntry(before.set, target, mirrored, candidate.targetOri);
      const list = target.algs[candidate.targetOri];
      if (list.some(e => duplicateAlgKey(e.alg) === duplicateAlgKey(aligned.alg))) throw new Error(`case ${target.id}: duplicate mirror after alignment`);
      list.push({ alg: aligned.alg, algHtml: aligned.algHtml, ...(candidate.entry.source ? { source: candidate.entry.source } : {}) });
      added.push({ from: candidate.caseId, to: target.id, alg: aligned.alg });
    }
    // New counterparts can reveal marks missing on existing AUF variants of
    // the original side. Use the same repair planner until the pair is stable.
    for (let pass = 0; ; pass++) {
      const checked = planExistingLrAnnotationRepairs({ ...before, cases: plan.cases });
      const issues = checked.notes.filter(note => !note.includes('no existing LR counterpart'));
      if (issues.length) throw new Error(issues.join('\n'));
      if (canonical(checked.cases) === canonical(plan.cases)) break;
      if (pass >= 4) throw new Error('LR annotation filling did not converge');
      plan.cases = checked.cases;
    }
  }
  if (args.includes('--repair-inconsistent')) {
    plan.cases = before.cases.map(c => ({ ...c, algs: c.algs.map(view => view.map(entry =>
      algHtmlMatchesText(entry.alg, entry.algHtml) ? entry : consistentAlgEntry(entry))) }));
  }
  const changes = plan.cases.filter((c, i) => canonical(c.algs) !== canonical(before.cases[i].algs));
  unresolved += changes.length + plan.coverage.mismatchedHtml
    + plan.notes.filter(note => !note.includes('no existing LR counterpart')).length
    + (plan.coverage.unsupported ? plan.coverage.fingerMarked : 0);
  const report = { set, mode: apply ? 'apply' : 'plan', ...plan.coverage,
    changed: changes.map(c => ({ id: c.id, name: c.name })), notes: plan.notes, added, skipped, applied: [] as number[] };
  reports.push(report);
  console.log(JSON.stringify(report));
  if (backup) await writeFile(resolve(backup, `${set.replace('/', '-')}-${started}.json`), JSON.stringify({ before, plan }, null, 2), { flag: 'wx' });
  if (apply && changes.length) {
    for (const c of changes) {
      const latest = await read<AlgFile>(url);
      const old = before.cases.find(row => row.id === c.id)!;
      const current = latest.cases.find(row => row.id === c.id);
      if (canonical(current) === canonical(c)) continue; // A newer server may already have synced this partner.
      if (canonical(current) !== canonical(old)) throw new Error(`case ${c.id} changed since planning; rerun`);
      const res = await fetch(`${url}/cases/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY! },
        body: JSON.stringify({ caseName: c.name, subgroup: c.subgroup, setup: c.setup,
          standard: c.standard ?? null, sticker: c.sticker, algs: c.algs,
          oriNames: c.oriNames ?? null, trainerKey: c.trainerKey ?? null }),
      });
      if (!res.ok) throw new Error(`case ${c.id}: PUT ${res.status}: ${await res.text()}`);
      report.applied.push(c.id);
      if (backup) await writeFile(resolve(backup, `report-${started}.json`), JSON.stringify(reports, null, 2));
    }
    const verified = await read<AlgFile>(url);
    for (const c of changes) {
      if (canonical(verified.cases.find(row => row.id === c.id)?.algs) !== canonical(c.algs)) throw new Error(`case ${c.id}: verification failed`);
    }
  }
  if (backup) await writeFile(resolve(backup, `report-${started}.json`), JSON.stringify(reports, null, 2));
}
console.log(JSON.stringify({ sets: reports.length, unresolved, report: backup ? resolve(backup, `report-${started}.json`) : null }));
if (check && unresolved) process.exitCode = 1;
