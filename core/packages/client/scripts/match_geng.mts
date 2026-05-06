/**
 * Dry-run: match each Geng (耿暄一) ZBLS case to a standard A-X case.
 *
 * Strategy: apply inverse(standard) to a solved 3x3, then compare patterns
 * under (4 whole-cube y rotations) × (4 AUF U rotations) = 16 equivalence classes.
 * Geng's standard algs only use y (no x/z), so D stays down.
 *
 * Run from `core/packages/client/`:
 *   pnpm tsx scripts/match_geng.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import type { KPattern } from 'cubing/kpuzzle';

const kp = await cube3x3x3.kpuzzle();
const SOLVED = kp.defaultPattern();

function caseState(stdAlg: string, label = ''): KPattern | null {
  // Normalize for cubing.js parser:
  //  - strip docx gesture annotations (↓↑)
  //  - strip square-bracket suffixes [U'] / [U2] (docx AUF reminder, not a real move group)
  //  - insert space between adjacent face letters ("ML'" → "M L'", "FS" → "F S")
  const cleaned = stdAlg
    .replace(/[↓↑]/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\)([A-Za-z])/g, ') $1')
    .replace(/([RLUDFBMESrludfbxyz][2']*)([RLUDFBMESrludfbxyz])/g, '$1 $2');
  try {
    return SOLVED.applyAlg(new Alg(cleaned).invert());
  } catch (err) {
    console.warn(`  [skip] parse fail ${label}: "${stdAlg}" → "${cleaned}": ${(err as Error).message}`);
    return null;
  }
}

/** Fingerprint = CORNERS + EDGES pieces+orientation. CENTERS captured separately
 *  so we can detect cube y-rotation. */
function fingerprint(pat) {
  return JSON.stringify({
    cp: [...pat.patternData.CORNERS.pieces],
    co: [...pat.patternData.CORNERS.orientation],
    ep: [...pat.patternData.EDGES.pieces],
    eo: [...pat.patternData.EDGES.orientation],
    cc: [...pat.patternData.CENTERS.pieces],
  });
}

/** 16 variants: 4 cube rotations (y) × 4 AUF (U). */
function variants(pat) {
  const out = [];
  let cubeY = pat;
  for (let yy = 0; yy < 4; yy++) {
    let auf = cubeY;
    for (let uu = 0; uu < 4; uu++) {
      out.push({ pat: auf, y: yy, u: uu, fp: fingerprint(auf) });
      auf = auf.applyMove('U');
    }
    cubeY = cubeY.applyMove('y');
  }
  return out;
}

const DATA_FILE = path.resolve('../shared/data/alg_3x3_zbls.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

const stdCases = [], gengCases = [];
for (const c of data.cases) {
  if (c.subgroup === 'Geng (耿暄一)') gengCases.push(c);
  else stdCases.push(c);
}

// Index standard cases by raw fingerprint (no AUF/y enumeration on the std side
// — we enumerate on the Geng side since it has the rotation noise)
const stdIndex = new Map();
for (const c of stdCases) {
  if (!c.standard) continue;
  const pat = caseState(c.standard, c.name);
  if (!pat) continue;
  const fp = fingerprint(pat);
  if (!stdIndex.has(fp)) stdIndex.set(fp, []);
  stdIndex.get(fp).push(c);
}

console.log(`Std cases indexed: ${stdCases.length} (unique fps: ${stdIndex.size})`);
console.log(`Geng cases to match: ${gengCases.length}`);

let matchCount = 0;
const matches = [], unmatched = [], multi = [];
for (const g of gengCases) {
  const state = caseState(g.standard, g.name);
  if (!state) { unmatched.push(g.name + ' [parse-fail]'); continue; }
  const vs = variants(state);
  const hits = new Map();
  for (const v of vs) {
    const cands = stdIndex.get(v.fp);
    if (cands) {
      for (const c of cands) {
        const key = c.name;
        if (!hits.has(key)) hits.set(key, { std: c, y: v.y, u: v.u });
      }
    }
  }
  if (hits.size === 0) {
    unmatched.push(g.name);
  } else if (hits.size === 1) {
    const [{ std, y, u }] = hits.values();
    matchCount++;
    matches.push({ geng: g.name, std: std.name, sub: std.subgroup, y, u, alg: g.algs[0]?.[0]?.alg });
  } else {
    multi.push({ geng: g.name, hits: [...hits.values()].map(h => `${h.std.subgroup}:${h.std.name}(y${h.y}u${h.u})`) });
  }
}

console.log(`\nMatched (1 unique std): ${matchCount}`);
console.log(`Multi-match (ambiguous): ${multi.length}`);
console.log(`Unmatched: ${unmatched.length}`);

console.log('\nFirst 10 matches:');
for (const m of matches.slice(0, 10)) {
  console.log(`  ${m.geng}  →  ${m.sub}:${m.std}  (y=${m.y}, U=${m.u})`);
}

if (multi.length > 0) {
  console.log('\nFirst 5 ambiguous:');
  for (const m of multi.slice(0, 5)) console.log(`  ${m.geng}  →  ${m.hits.join(', ')}`);
}

if (unmatched.length > 0) {
  // Classify unmatched by whether LL-EO is solved (= ZBLS-shape) vs not (= different stage entirely).
  // After cube-y normalization, the U-layer edges should be slot indices 0..3 with orientation = 0.
  let llEoOk = 0, llEoBad = 0;
  for (const name of unmatched) {
    const g = gengCases.find(c => c.name === name);
    if (!g) continue;
    const pat = caseState(g.standard, '');
    if (!pat) continue;
    // Try every cube-y rotation; if any keeps all top-edge orientation = 0, it's ZBLS-shape.
    let p: KPattern = pat;
    let ok = false;
    for (let yy = 0; yy < 4; yy++) {
      const eo = [...p.patternData.EDGES.orientation];
      // Need to identify which edge slots are LL after normalization. For default 3x3 KPuzzle,
      // U-layer edges are typically pieces 0..3 in solved orientation; after non-D-axis moves,
      // those piece IDs may be in the bottom — we want the LL slot positions.
      // Simpler heuristic: count edges whose orientation == 1 (flipped). LL EO needs 0 flipped on U layer.
      // But "U layer" depends on orientation. Use: a piece is on U layer iff its position is one of the U-layer slot IDs.
      // For default KPuzzle, slots 0..3 are U layer. After cube-y rotation, those slot IDs still mean U layer.
      const llFlips = eo.slice(0, 4).filter(x => x === 1).length;
      if (llFlips === 0) { ok = true; break; }
      p = p.applyMove('y');
    }
    if (ok) llEoOk++; else llEoBad++;
  }
  console.log(`\nUnmatched diagnosis:`);
  console.log(`  LL-EO solved (genuinely ZBLS but didn't match): ${llEoOk}`);
  console.log(`  LL-EO unsolved (NOT ZBLS — wrong subgroup):    ${llEoBad}`);
}

// Also report y/u distribution for matches
const dist = new Map();
for (const m of matches) {
  const k = `y${m.y}u${m.u}`;
  dist.set(k, (dist.get(k) || 0) + 1);
}
console.log('\nMatch transform distribution:');
for (const [k, v] of [...dist.entries()].sort()) console.log(`  ${k}: ${v}`);
