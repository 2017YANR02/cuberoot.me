/**
 * Pure alignment library — extracted from align_zbls.mjs so both the one-shot
 * UPDATE script (align_zbls.mjs) and the docx-scrape generator (gen_zbls_sql.mjs)
 * can share the AUF / y' / prefix-cancel logic.
 *
 * `alignSetupAndAlgs({ subgroup, setup, algs })` →
 *   { newSetup, newAlgs, auf, rotation } — or null if alignment fails / setup unparseable.
 *
 * Pieces convention (cubing.js 3x3x3 KPattern):
 *   0=UFR, 1=UBR, 2=UBL, 3=UFL, 4=DFR, 5=DFL, 6=DBL, 7=DRB
 */
import { cube3x3x3 } from 'cubing/puzzles';

const kpuzzle = await cube3x3x3.kpuzzle();
const SOLVED = kpuzzle.defaultPattern();

const U_NEXT = { 0: 3, 1: 0, 2: 1, 3: 2 };

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

const U_AXIS = { U: 1, "U'": -1, U2: 2 };
const Y_AXIS = { y: 1, "y'": -1, y2: 2 };
function combineSameAxis(a, b, axis) {
  if (!(a in axis) || !(b in axis)) return null;
  const sum = ((axis[a] + axis[b]) % 4 + 4) % 4;
  if (sum === 0) return '';
  const labels = axis === U_AXIS ? ['', 'U', 'U2', "U'"] : ['', 'y', 'y2', "y'"];
  return labels[sum];
}

export function simplifyAlgStart(algStr) {
  let tokens = algStr.trim().split(/\s+/).filter(Boolean);
  while (tokens.length >= 2) {
    const a = tokens[0], b = tokens[1];
    let combined = combineSameAxis(a, b, U_AXIS);
    if (combined === null) combined = combineSameAxis(a, b, Y_AXIS);
    if (combined === null) break;
    if (combined === '') tokens.splice(0, 2);
    else { tokens[0] = combined; tokens.splice(1, 1); }
  }
  return tokens.join(' ');
}

/**
 * Align one case for canonical FR display.
 *  algs is either a flat array of {alg,algHtml?} entries (typical for fresh scrape),
 *  or 2D `[[entries]]` (typical for DB rows where there's 1 orientation today).
 * Returns null on parse failure or if subgroup is Solved Pair (no alignment needed).
 */
export function alignCase({ subgroup, setup, algs, name = '?', id = '?' }) {
  if (!setup || !algs || !algs.length) return null;
  if (subgroup === 'Solved Pair') return null;

  // Normalize algs to flat array of entries
  const flatAlgs = Array.isArray(algs[0]) ? algs[0] : algs;

  const isMinus = subgroup.endsWith('-');
  const pairCornerHome = isMinus ? 3 : 0;

  let state;
  try { state = SOLVED.applyAlg(setup); } catch (e) {
    console.warn(`[skip] case ${id} (${subgroup} ${name}): setup parse failed: ${e.message}`);
    return null;
  }
  const corners = state.patternData.CORNERS.pieces;
  const currentPos = corners.indexOf(pairCornerHome);

  let auf = '';
  if (currentPos >= 0 && currentPos <= 3) {
    const c = computeAuf(currentPos, pairCornerHome);
    if (c === null) console.warn(`[warn] case ${id} (${subgroup} ${name}): can't AUF pos ${currentPos}→${pairCornerHome}`);
    else auf = c;
  }

  const rotation = isMinus ? "y'" : '';
  const newSetup = [setup, auf, rotation].filter(Boolean).join(' ');

  const rotInv = rotation === "y'" ? 'y' : '';
  const aufInv = INVERT_AUF[auf] || '';
  const prefix = [rotInv, aufInv].filter(Boolean).join(' ');

  const newAlgs = flatAlgs.map(a => {
    const rawAlg = prefix ? `${prefix} ${a.alg}` : a.alg;
    const out = { alg: simplifyAlgStart(rawAlg) };
    if (a.algHtml) {
      const rawHtml = prefix ? `${prefix} ${a.algHtml}` : a.algHtml;
      const htmlTokens = rawHtml.trim().split(/\s+/);
      if (htmlTokens.length >= 2 && !htmlTokens[1].includes('<')) {
        out.algHtml = simplifyAlgStart(rawHtml);
      } else {
        out.algHtml = rawHtml;
      }
    }
    return out;
  });

  return { newSetup, newAlgs, auf, rotation };
}
