/** Restore the archived CLL source moves. Preview first; --apply uses ADMIN_API_KEY. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { preserveAlg } from './preserve-alg.mjs';
import { setTimeout } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '../../../../..');
const read = async (file) => JSON.parse(await readFile(resolve(root, file), 'utf8'));
const derived = await read('.tmp/best2x2/derived-site.json');
const original = await read('.tmp/best2x2/site-cll.json');
const imported = (await read('.tmp/best2x2/import.json')).sets.find((s) => s.slug === 'cll');
const url = 'https://api.cuberoot.me/v1/alg/sets/2x2/cll';
const get = async () => {
  const r = await fetch(`${url}?fresh=1&t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET ${r.status}`);
  return r.json();
};
if (process.argv.includes('--resume')) {
  const artifact = resolve(root, process.argv[process.argv.indexOf('--resume') + 1]);
  await applyPlan(JSON.parse(await readFile(artifact, 'utf8')), artifact);
  process.exit(0);
}
const before = await get();
const k = await puzzles['2x2x2'].kpuzzle();
const slots = derived.slots.filter((s) => s.sheet === 'CLL');
if (slots.length !== 40 || before.cases.length !== 40) throw new Error('Expected all 40 CLL cases');
const updates = [];
let inputs = 0;
for (const slot of slots) {
  const name = slot.site.find((ref) => ref.startsWith('cll/'))?.slice(4);
  const live = before.cases.find((c) => c.name === name);
  const baseline = imported.cases.find((c) => c.name === name);
  const old = original.cases.find((c) => c.name === name);
  if (!live || !baseline || !old) throw new Error(`Missing mapping: ${name}`);
  // Never overwrite changes made since the faulty import.
  if (live.setup !== baseline.setup || !isDeepStrictEqual(live.algs, baseline.algs)) {
    throw new Error(`Live data differs from archived import: ${name}`);
  }
  const valid = slot.algs.filter((a) => a.ok);
  const lead = valid.find((a) => a.row === slot.lead) ?? valid[0];
  if (!lead) throw new Error(`No validated source: ${name}`);
  const setup = new Alg(lead.alg).invert().toString();
  const sources = [lead, ...valid.filter((a) => a !== lead)].map((a) => ({ alg: a.alg }));
  sources.push(...old.algs.flat());
  const entries = new Map();
  for (const source of sources) {
    const entry = await preserveAlg(setup, source);
    if (!['', 'U ', 'U2 ', "U' "].some((prefix) => entry.alg === prefix + source.alg)) {
      throw new Error(`Source moves changed: ${name}`);
    }
    if (!k.defaultPattern().applyAlg(entry.setup ?? setup).applyAlg(entry.alg)
      .experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })) {
      throw new Error(`Invalid result: ${name}`);
    }
    // Preserve original source metadata when a sheet entry is identical.
    entries.set(entry.alg, { ...entries.get(entry.alg), ...entry });
    inputs++;
  }
  updates.push({ id: live.id, body: {
    caseName: live.name, subgroup: live.subgroup, setup,
    standard: live.standard ?? null, sticker: live.sticker,
    algs: [[...entries.values()]], oriNames: live.oriNames ?? null,
    trainerKey: live.trainerKey ?? null,
  } });
}
const sune = updates.find((u) => u.body.caseName === 'CLL Sune 6');
if (sune.body.algs[0][0].alg !== "R U R' U R U2 R'") throw new Error('Sune body changed');
const stats = { cases: updates.length, sourceInputs: inputs,
  algorithms: updates.reduce((n, u) => n + u.body.algs[0].length, 0),
  independentSetups: updates.reduce((n, u) => n + u.body.algs[0].filter((a) => a.setup).length, 0) };
await mkdir(resolve(root, '.tmp/png'), { recursive: true });
const artifact = resolve(root, `.tmp/png/cll-repair-${Date.now()}.json`);
await writeFile(artifact, JSON.stringify({ before, updates, stats }, null, 2) + '\n');
console.log(JSON.stringify({ artifact, ...stats, sune: sune.body.algs[0] }));
if (process.argv.includes('--apply')) {
  await applyPlan({ before, updates }, artifact);
}

async function applyPlan({ before, updates }, artifact) {
  if (!process.env.ADMIN_API_KEY) throw new Error('ADMIN_API_KEY required');
  const current = await get();
  for (const update of updates) {
    const actual = current.cases.find((c) => c.id === update.id);
    if (actual?.setup === update.body.setup && isDeepStrictEqual(actual.algs, update.body.algs)) continue;
    if (!isDeepStrictEqual(actual, before.cases.find((c) => c.id === update.id))) {
      throw new Error(`Concurrent edit: ${update.id}`);
    }
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(`${url}/cases/${update.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
        body: JSON.stringify(update.body),
      });
      if (r.ok) break;
      if (r.status !== 429 || attempt >= 12) throw new Error(`PUT case ${update.id}: ${r.status}`);
      console.log(`Rate limited at case ${update.id}; retrying in 30 seconds.`);
      await setTimeout(30000);
    }
    await setTimeout(1500);
  }
  const after = await get();
  for (const update of updates) {
    const actual = after.cases.find((c) => c.id === update.id);
    if (actual?.setup !== update.body.setup || !isDeepStrictEqual(actual?.algs, update.body.algs)) {
      throw new Error(`Readback mismatch: ${update.id}`);
    }
  }
  await writeFile(artifact.replace('.json', '-verified.json'), JSON.stringify(after, null, 2) + '\n');
  console.log('Applied and verified all 40 CLL cases.');
}
