/**
 * Align all ZBLS cases for canonical display:
 *   1. Minus subgroups (A-/B-/.../X-): append `y'` to setup so the pair slot
 *      lands at FR (red+green) instead of FL (red+blue) for visual consistency.
 *   2. If the pair corner (UFR-home for + / UFL-home for -) is in the U layer,
 *      append an AUF (U / U2 / U') to setup so the corner ends up at the home
 *      position (UFR for +, UFL for -) — i.e., directly above the empty slot.
 *      After the y' rotation, this UFL appears as UFR in viewer frame.
 *   3. Each alg gets prefixed with the inverse rotation + inverse AUF so it
 *      still solves the (now display-canonical) case state.
 *
 * Pieces convention (cubing.js 3x3x3 KPattern):
 *   0=UFR, 1=UBR, 2=UBL, 3=UFL, 4=DFR, 5=DFL, 6=DBL, 7=DRB
 *
 * Solved Pair: skipped (pair already solved, no alignment needed).
 * Geng: treated as + subgroup (assume FR slot, UFR pair corner home).
 *
 * Output: C:/tmp/zbls_align.sql ready for `scp + psql -f`.
 */
import { cube3x3x3 } from 'cubing/puzzles';
import { writeFileSync } from 'node:fs';

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

// U-turn cycle on positions (from probe): U moves piece at pos 0 → pos 3,
// pos 3 → pos 2, pos 2 → pos 1, pos 1 → pos 0.
const U_NEXT = { 0: 3, 1: 0, 2: 1, 3: 2 };

/** AUF that, when appended to setup, brings piece at currentPos to targetPos. */
function computeAuf(currentPos, targetPos) {
  if (currentPos === targetPos) return '';
  let p = currentPos;
  const labels = ['U', 'U2', "U'"];
  for (let k = 0; k < 3; k++) {
    p = U_NEXT[p];
    if (p === targetPos) return labels[k];
  }
  return null;
}

const INVERT_AUF = { U: "U'", "U'": 'U', U2: 'U2', '': '' };

// Single-axis combiners: returns combined token, '' if cancels, or null if no combination.
const U_AXIS = { U: 1, "U'": -1, U2: 2 };
const Y_AXIS = { y: 1, "y'": -1, y2: 2 };
function combineSameAxis(a, b, axis) {
  if (!(a in axis) || !(b in axis)) return null;
  const sum = ((axis[a] + axis[b]) % 4 + 4) % 4;
  if (sum === 0) return '';
  const labels = axis === U_AXIS ? ['', 'U', 'U2', "U'"] : ['', 'y', 'y2', "y'"];
  return labels[sum];
}

/** Simplify prefix + alg: collapse adjacent same-axis tokens (U+U'=∅, U+U=U2, y+y'=∅...).
 *  Iterates from the LEFT until no more combinations possible (only first 2 tokens
 *  combine — once we hit a non-axis move like R, we stop). */
function simplifyAlgStart(algStr) {
  let tokens = algStr.trim().split(/\s+/).filter(Boolean);
  while (tokens.length >= 2) {
    const a = tokens[0];
    const b = tokens[1];
    let combined = combineSameAxis(a, b, U_AXIS);
    if (combined === null) combined = combineSameAxis(a, b, Y_AXIS);
    if (combined === null) break;
    if (combined === '') {
      tokens.splice(0, 2);
    } else {
      tokens[0] = combined;
      tokens.splice(1, 1);
    }
  }
  return tokens.join(' ');
}

async function fetchZblsCases() {
  const r = await fetch('https://www.cuberoot.me/api/alg/sets/3x3/zbls');
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  return await r.json();
}

function processCase(c) {
  const { id, subgroup, setup, algs } = c;
  if (!setup || !algs || !algs.length) return null;
  if (subgroup === 'Solved Pair') return null;

  const isMinus = subgroup.endsWith('-');
  const pairCornerHome = isMinus ? 3 : 0;  // UFL for -, UFR for everything else

  let state;
  try {
    state = SOLVED.applyAlg(setup);
  } catch (e) {
    console.warn(`[skip] case ${id} (${subgroup} ${c.name}): setup parse failed: ${e.message}`);
    return null;
  }

  const corners = state.patternData.CORNERS.pieces;
  const currentPos = corners.indexOf(pairCornerHome);

  // AUF only if pair corner is in U layer (positions 0..3)
  let auf = '';
  if (currentPos >= 0 && currentPos <= 3) {
    const computed = computeAuf(currentPos, pairCornerHome);
    if (computed === null) {
      console.warn(`[warn] case ${id} (${subgroup} ${c.name}): can't compute AUF from pos ${currentPos} to ${pairCornerHome}`);
    } else {
      auf = computed;
    }
  }

  // Display rotation: minus subgroups have pair slot at FL. VisualCube's `y'` rotates
  // so that the FL slot (red+blue) lands at FR position with red+green visible (per
  // empirical test). Inverse for alg prefix is `y`.
  const rotation = isMinus ? "y'" : '';

  // Append AUF + rotation to setup (in original frame, AUF first then rotation)
  const newSetup = [setup, auf, rotation].filter(Boolean).join(' ');

  // Each alg gets prefixed with: inverse(rotation) + inverse(AUF)
  // (so when applied after the new setup, the prefixes cancel the appended bits and
  // the original alg solves the original setup state, which is what it was made for)
  const rotInv = rotation === "y'" ? 'y' : '';
  const aufInv = INVERT_AUF[auf] || '';
  const prefix = [rotInv, aufInv].filter(Boolean).join(' ');

  const newAlgs = (algs[0] || []).map(a => {
    const rawAlg = prefix ? `${prefix} ${a.alg}` : a.alg;
    const simplifiedAlg = simplifyAlgStart(rawAlg);
    const out = { alg: simplifiedAlg };
    if (a.algHtml) {
      // For algHtml, only simplify if prefix combines with the leading bare-text token;
      // if first token is wrapped in tags, just keep the raw concat (rare).
      const rawHtml = prefix ? `${prefix} ${a.algHtml}` : a.algHtml;
      // Simple heuristic: if leading-stripped HTML token == leading plain alg token, simplify works
      const htmlTokens = rawHtml.trim().split(/\s+/);
      if (htmlTokens.length >= 2 && !htmlTokens[1].includes('<')) {
        out.algHtml = simplifyAlgStart(rawHtml);
      } else {
        out.algHtml = rawHtml;
      }
    }
    return out;
  });

  // Skip if nothing changes
  if (newSetup === setup && JSON.stringify(newAlgs) === JSON.stringify(algs[0])) return null;

  return { id, oldSetup: setup, newSetup, oldAlgs: algs[0], newAlgs, auf, rotation, name: c.name, subgroup };
}

function pgQuote(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}
function pgJsonb(v) {
  if (v == null) return 'NULL';
  return `${pgQuote(JSON.stringify(v))}::jsonb`;
}

const data = await fetchZblsCases();
console.log(`Fetched ${data.cases.length} ZBLS cases`);

const updates = [];
const stats = { processed: 0, skipped: 0, addedAuf: 0, addedRotation: 0 };
for (const c of data.cases) {
  const result = processCase(c);
  if (!result) {
    stats.skipped++;
    continue;
  }
  stats.processed++;
  if (result.auf) stats.addedAuf++;
  if (result.rotation) stats.addedRotation++;
  updates.push(result);
}

console.log('Stats:', stats);
console.log(`\nFirst 5 changes:`);
for (const u of updates.slice(0, 5)) {
  console.log(`  ${u.subgroup} ${u.name} (id=${u.id}):`);
  console.log(`    setup: ${u.oldSetup} → ${u.newSetup}`);
  console.log(`    alg[0]: ${u.oldAlgs[0]?.alg} → ${u.newAlgs[0]?.alg}`);
}

let sql = `-- Generated by align_zbls.mjs at ${new Date().toISOString()}
-- Aligns ZBLS cases for canonical display (FR slot, UFR pair corner)
-- Setup: append AUF + y' for minus. Algs: prepend inverse rotation + inverse AUF.

BEGIN;
`;
for (const u of updates) {
  sql += `UPDATE alg_cases SET setup = ${pgQuote(u.newSetup)}, algs = ${pgJsonb([u.newAlgs])} WHERE id = ${u.id};\n`;
}
sql += `
SELECT 'aligned' AS stage, COUNT(*) AS n FROM alg_cases WHERE puzzle='3x3' AND set_slug='zbls';
COMMIT;
`;

writeFileSync('C:/tmp/zbls_align.sql', sql, 'utf-8');
console.log(`\nWrote C:/tmp/zbls_align.sql (${sql.length} bytes, ${updates.length} UPDATEs)`);
