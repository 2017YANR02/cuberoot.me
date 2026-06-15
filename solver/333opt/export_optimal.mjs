// Export optimal-scramble data for /timer's "WCA 真题: 原始/最优打乱" toggle.
//
// Joins out.0.csv (id,htm,solution) ⋈ wca_scrambles_split_mbf.csv (id → natural key + event) and emits,
// for the SAME-STATE events only, a CSV keyed by the WCA natural key that the server's wca_scrambles
// table also carries:
//
//   competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble
//
// optimal_scramble = invert(solution) — the shortest move sequence that reaches the SAME cube state as
// the original WCA scramble (since solution solves that state, its inverse builds it). |optimal| = htm
// = God's-number optimal, ≤ |original WCA scramble|.
//
// SAME-STATE events only: 333 / 333oh / 333ft / 333fm are plain face-turn scrambles, so the no-wide-move
// master scramble == the scramble the server serves == same state → the optimal scramble is a valid drop-in.
// 333bf / 333mbf are EXCLUDED: their WCA scrambles carry a wide-move orientation suffix that the master
// stripped, so our optimal is for a DIFFERENT state and would NOT reproduce the original blind scramble.
//
// Usage: node export_optimal.mjs            → writes wca_optimal.csv
//        node export_optimal.mjs --verify   → also state-checks a sample with cubing.js (scramble+solution=solved)
import { readFileSync, existsSync, createReadStream, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const OUT = resolve(__dirname, 'out.0.csv');
const META = process.env.META ? resolve(process.env.META) : 'D:/cube/scramble/wca_scramble/input/wca_scrambles_split_mbf.csv';
const DEST = resolve(__dirname, 'wca_optimal.csv');
const SAME_STATE = new Set(['333', '333oh', '333ft', '333fm']); // plain face-turn → optimal scramble is a valid drop-in
const verify = process.argv.includes('--verify');

// invert a face-turn (HTM) sequence: reverse order + invert each move (X↔X', X2↔X2).
const invertAlg = (alg) => alg.trim().split(/\s+/).filter(Boolean).reverse()
  .map((m) => m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'").join(' ');

// ---- 1. id -> solution from out.0.csv ----
if (!existsSync(OUT)) { console.error('out.0.csv 不存在,先跑 solve.mjs'); process.exit(1); }
const sol = new Map();
for (const l of readFileSync(OUT, 'utf8').split('\n')) {
  const p = l.split(',');
  if (p.length >= 3 && p[2]) sol.set(p[0], { htm: p[1], solution: p[2] });
}
console.log(`${sol.size} solved ids`);

// ---- 2. stream split_mbf.csv: for SAME-STATE events, emit natural key + optimal scramble ----
// cols: id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
const ws = createWriteStream(DEST, 'utf8');
ws.write('competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble\n');
let emitted = 0, skippedEvent = 0;
const byEvent = {};
const sample = []; // for --verify: {id, scramble, solution}
const wantSample = verify ? 12 : 0;
const rl = createInterface({ input: createReadStream(META, 'utf8'), crlfDelay: Infinity });
let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }
  if (!line) continue;
  const c = line.split(',');
  const id = c[0];
  const rec = sol.get(id);
  if (!rec) continue;                       // not solved (yet)
  const event = c[3];
  if (!SAME_STATE.has(event)) { skippedEvent++; continue; }
  const optimal = invertAlg(rec.solution);
  // natural key: competition_id(c2),event_id(c3),round_type_id(c4),group_id(c5),is_extra(c6),scramble_num(c7)
  ws.write(`${c[2]},${c[3]},${c[4]},${c[5]},${c[6]},${c[7]},${rec.htm},${optimal}\n`);
  emitted++;
  byEvent[event] = (byEvent[event] || 0) + 1;
  if (sample.length < wantSample) sample.push({ id, scramble: c[1], solution: rec.solution, optimal });
}
ws.end();
await new Promise((r) => ws.on('finish', r));
console.log(`wrote ${DEST}: ${emitted} rows (${JSON.stringify(byEvent)}), skipped ${skippedEvent} non-same-state`);

// ---- 3. optional: verify a sample with cubing.js (scramble + solution == solved) ----
if (verify && sample.length) {
  // cubing is ESM-only; its "exports" map isn't visible to CJS require.resolve, so import the real file.
  const puzzlesUrl = pathToFileURL(resolve(repoRoot, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href;
  const { cube3x3x3 } = await import(puzzlesUrl);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  let ok = 0;
  for (const s of sample) {
    // split_mbf scramble (c[1]) for same-state events == the plain WCA scramble
    const after = solved.applyAlg(s.scramble).applyAlg(s.solution);
    const isSolved = after.isIdentical(solved);
    // and the optimal scramble must reach the same state as the original scramble
    const sameState = solved.applyAlg(s.optimal).isIdentical(solved.applyAlg(s.scramble));
    if (isSolved && sameState) ok++;
    else console.log(`  [FAIL] id=${s.id} solved=${isSolved} sameState=${sameState} scr="${s.scramble}" sol="${s.solution}"`);
  }
  console.log(`verify: ${ok}/${sample.length} OK (scramble+solution=solved AND invert(solution)≡scramble)`);
}
