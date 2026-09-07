/** Plan a guarded data-only repair from the verified source-preserving import. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual as equal } from 'node:util';
import { puzzles } from 'cubing/puzzles';

const root = resolve(import.meta.dirname, '../../../../..');
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const get = async (slug) => {
  const response = await fetch(`https://api.cuberoot.me/v1/alg/sets/2x2/${slug}?fresh=1&t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`GET ${slug}: ${response.status}`);
  return response.json();
};
const same = (a, b) => a?.setup === b?.setup && equal(a?.algs, b?.algs);
const puzzle = await puzzles['2x2x2'].kpuzzle();
function verify(c) {
  for (const entry of c.algs.flat()) {
    if (!puzzle.defaultPattern().applyAlg(entry.setup ?? c.setup).applyAlg(entry.alg)
      .experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })) {
      throw new Error(`Unsolved: ${c.name}: ${entry.alg}`);
    }
  }
}

if (process.argv[2] === '--verify') {
  const plan = await read(process.argv[3]);
  const after = [];
  for (const before of plan.before) {
    const live = await get(before.set);
    if (live.cases.length !== before.cases.length) throw new Error(`Case count changed: ${before.set}`);
    for (const c of live.cases) {
      const update = plan.updates.find((u) => u.id === c.id);
      const expected = before.cases.find((b) => b.id === c.id);
      if (!expected || !equal(c, { ...expected, ...(update ? { setup: update.setup, algs: update.algs } : {}) })) {
        throw new Error(`Readback mismatch: ${before.set}/${c.name}`);
      }
      if (before.set !== 'ortega-oll') verify(c);
    }
    after.push(live);
    console.log(`Verified ${before.set}: ${live.cases.length} cases`);
  }
  await writeFile(resolve(root, process.argv[3].replace('.json', '-verified.json')), JSON.stringify(after, null, 2) + '\n');
  process.exit(0);
}

const corrected = await read(process.argv[2] ?? '.tmp/png/best2x2-preserved.json');
const imported = await read('.tmp/best2x2/import.json');
const derived = await read('.tmp/best2x2/derived-site.json');
if (corrected.sets.length !== 17) throw new Error('Expected all 17 imported sets');
const before = [];
const updates = [];
for (const set of corrected.sets) {
  const live = await get(set.slug);
  const archive = set.existing ? await read(`.tmp/best2x2/site-${set.slug}.json`) : null;
  const slots = derived.slots.filter((s) => s.sheet === set.sheet);
  before.push(live);
  if (live.cases.length !== set.cases.length) throw new Error(`Case count mismatch: ${set.slug}`);
  for (const target of set.cases) {
    const current = live.cases.find((c) => c.name === target.name);
    if (!current) throw new Error(`Missing case: ${set.slug}/${target.name}`);
    // CLL was already repaired with source metadata merged; retain that repair.
    if (set.slug === 'cll') { verify(current); continue; }
    const slot = slots[target.position];
    if (!slot) throw new Error(`Missing source slot: ${set.slug}/${target.name}`);
    const sources = [...slot.algs.filter((a) => a.ok).map((a) => a.alg),
      ...(archive?.cases.find((c) => c.name === target.existingName)?.algs.flat().map((a) => a.alg) ?? [])];
    for (const entry of target.algs.flat()) {
      if (!sources.some((source) => ['', 'U ', 'U2 ', "U' "].some((pre) => entry.alg === pre + source))) {
        throw new Error(`Source moves changed: ${set.slug}/${target.name}: ${entry.alg}`);
      }
    }
    verify(target);
    if (same(current, target)) continue;
    const baseline = imported.sets.find((s) => s.slug === set.slug)?.cases.find((c) => c.name === target.name);
    if (!same(current, baseline)) throw new Error(`Changed since import: ${set.slug}/${target.name}`);
    updates.push({ id: current.id, slug: set.slug, name: current.name,
      beforeSetup: current.setup, beforeAlgs: current.algs, setup: target.setup, algs: target.algs });
  }
}
before.push(await get('ortega-oll'));
const artifact = `.tmp/png/2x2-repair-${Date.now()}.json`;
const stats = { sets: before.length, cases: before.reduce((n, s) => n + s.cases.length, 0),
  changedSets: new Set(updates.map((u) => u.slug)).size, changedCases: updates.length,
  changedAlgorithms: updates.reduce((n, u) => n + u.algs.flat().length, 0) };
await writeFile(resolve(root, artifact), JSON.stringify({ before, updates, stats }, null, 2) + '\n');
// Quote SQL literals, including JSON, independently of shell quoting. One transaction
// locks and compares every target before any write; a concurrent edit aborts all writes.
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const sql = `BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TEMP TABLE repair_2x2 ON COMMIT DROP AS
SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(updates))}::jsonb)
AS x(id bigint, slug text, name text, "beforeSetup" text, "beforeAlgs" jsonb, setup text, algs jsonb);
SELECT count(*) AS locked FROM (SELECT c.id FROM alg_cases c JOIN repair_2x2 r ON c.id=r.id FOR UPDATE OF c) locked;
DO $$ BEGIN
IF (SELECT count(*) FROM alg_cases c JOIN repair_2x2 r ON c.id=r.id
WHERE c.puzzle='2x2' AND c.set_slug=r.slug AND c.name=r.name
AND c.setup=r."beforeSetup" AND c.algs=r."beforeAlgs") <> ${updates.length}
THEN RAISE EXCEPTION 'Concurrent edit: repair aborted'; END IF;
END $$;
UPDATE alg_cases c SET setup=r.setup, algs=r.algs FROM repair_2x2 r WHERE c.id=r.id;
COMMIT;
`;
await writeFile(resolve(root, artifact.replace('.json', '.sql')), sql);
console.log(JSON.stringify({ artifact, ...stats }));
