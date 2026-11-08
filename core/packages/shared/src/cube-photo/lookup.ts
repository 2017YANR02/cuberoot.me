import type { AlgEntry, AlgFile, AlgSticker } from '../alg';
import { mergeAdjacentMoves, stm, toMoveStringStrict } from '../alg_notation';
import { primaryCaseName } from '../recon/alg_case_display';
import { algCaseDetailHref, buildCaseSlugMap } from '../recon/alg_case_link';
import { fromFaceletString, toFaceletString, applyMoves, type CubeFaces } from '../timer/reconstruct/state';
import { isF2l, isOll, isSolved } from '../timer/reconstruct/cfop-detect';
import { stepSolvedInFrame } from '../timer/reconstruct/steps';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { cubieToFacelet, validateFacelet } from '../cube_facelet';
import { parseFourMoves, fourFaces, fourParity, fourLowerSolved, fourTopOriented, reduceFour } from './four';
import { pocketFaces, pocketSolved, pocketOriented } from './pocket';
import type { PhotoRecognition, RecoveredCorners, RecoveredState } from './recognize';

export const PHOTO_ALG_SETS = ['pll', 'oll', 'cmll', 'coll', 'ell', 'zbll', 'ollcp', '1lll'] as const;
export const POCKET_EXTENDED_PHOTO_ALG_SETS = ['tcll-plus', 'tcll-minus', 'teg2-plus', 'ls1', 'ls2', 'ls3', 'ls4', 'ls5', 'ls6', 'ls7', 'ls8', 'ls9'] as const;
export const POCKET_PHOTO_ALG_SETS = ['ortega-oll', 'cll', 'eg1', 'eg2', 'ortega-pbl', ...POCKET_EXTENDED_PHOTO_ALG_SETS] as const;
export const FOUR_PHOTO_ALG_SETS = ['oll-parity', 'pll-parity'] as const;
export type PhotoAlgSet = typeof FOUR_PHOTO_ALG_SETS[number] | typeof PHOTO_ALG_SETS[number] | typeof POCKET_PHOTO_ALG_SETS[number];
export interface PhotoAlgMatch { puzzle?: '2x2' | '3x3' | '4x4'; set: PhotoAlgSet; name: string; caseName: string; caseId?: number; href: string; alg: string; body?: string; preAuf: string; postAuf: string; turns: number; thumbnail?: { alg: string; setup?: string; sticker: AlgSticker } }
export interface PhotoAlgResult { set: PhotoAlgSet; status: 'found' | 'missing' | 'error'; match?: PhotoAlgMatch; alternatives?: PhotoAlgMatch[] }
export type PhotoAlgInput = string | RecoveredCorners | { candidates: RecoveredState[] };
const AUFS = ['', 'U', 'U2', "U'"];
const AUF_MOVES = AUFS.map(a => parseScramble(a));
type PreparedMoves = { body: string; moves: ReturnType<typeof parseScramble> };
const preparedMoves = new WeakMap<AlgEntry, { source: string; size: number; value: PreparedMoves | null }>();

/** Catalog entries survive across photos in the worker; parse each unchanged
 * notation once, including rejected entries. A refreshed catalog is a new key. */
function prepareMoves(entry: AlgEntry, size: number): PreparedMoves | null {
  const cached = preparedMoves.get(entry);
  if (cached?.source === entry.alg && cached.size === size) return cached.value;
  let value: PreparedMoves | null = null;
  try {
    const body = toMoveStringStrict(entry.alg);
    if (size === 4 && body) value = { body, moves: parseFourMoves(body) };
    else if (body && !body.split(/\s+/).some(token => !parseScramble(token).length)) value = { body, moves: parseScramble(body) };
  } catch { /* Unsupported notation must never become a guessed algorithm. */ }
  preparedMoves.set(entry, { source: entry.alg, size, value });
  return value;
}

/** Private simulation fixture: its edges are placeholders, never recovered evidence. */
function cornerSimulation(corners: RecoveredCorners): string {
  const cp = [...corners.cp, 4, 5, 6, 7], ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const odd = cp.reduce((sum, v, i) => sum + cp.slice(i + 1).filter(w => v > w).length, 0) % 2;
  if (odd) [ep[0], ep[1]] = [ep[1], ep[0]];
  return cubieToFacelet({ cp, co: [...corners.co, 0, 0, 0, 0], ep, eo: Array(12).fill(0) });
}

export function photoRecognitionSets(recognition: PhotoRecognition): PhotoAlgSet[] {
  if (recognition.puzzle === '2x2' || recognition.puzzle === '4x4') {
    const eligible = recognition.candidates.map(c => photoAlgSets(c.facelet));
    return eligible.length ? (recognition.puzzle === '4x4' ? FOUR_PHOTO_ALG_SETS : POCKET_PHOTO_ALG_SETS).filter(set => eligible.every(sets => sets.includes(set))) : [];
  }
  if (recognition.status === 'ok') return photoAlgSets(recognition.candidates[0].facelet);
  if (recognition.status === 'partial') {
    // A full-solve algorithm cannot solve two different starting states. Partial
    // goals can agree, but matchingPhotoAlgs must prove that for every completion.
    const eligible = recognition.candidates.map(c => photoAlgSets(c.facelet));
    return eligible.length ? PHOTO_ALG_SETS.filter(set => ['oll', 'cmll', 'coll', 'ollcp'].includes(set)
      && eligible.every(sets => sets.includes(set))) : [];
  }
  const corners = recognition.status === 'corners-only' && recognition.cornerCandidates?.[0];
  return corners && photoAlgSets(cornerSimulation(corners)).includes('cmll') ? ['cmll'] : [];
}

export function photoRecognitionInput(recognition: PhotoRecognition): PhotoAlgInput | undefined {
  if (recognition.status === 'ok') return recognition.candidates[0].facelet;
  if (recognition.status === 'partial') return { candidates: recognition.candidates };
  if (recognition.status === 'corners-only') return recognition.cornerCandidates?.[0];
}

export function photoAlgSets(facelet: string): PhotoAlgSet[] {
  if (facelet.length === 96) {
    const state = fourFaces(facelet);
    if (!state || !fourLowerSolved(state) || !fourParity(state)?.pll) return [];
    return fourTopOriented(state) ? ['pll-parity'] : ['oll-parity'];
  }
  if (facelet.length === 24) {
    const state = pocketFaces(facelet);
    if (!state || pocketSolved(state)) return [];
    if (state.D.filter(c => c === 'D').length === 3) return [...POCKET_EXTENDED_PHOTO_ALG_SETS];
    if (!state.D.every(c => c === 'D')) return [];
    return pocketOriented(state) ? ['cll', 'eg1', 'eg2', 'ortega-pbl'] : ['ortega-oll', 'cll', 'eg1', 'eg2'];
  }
  if (validateFacelet(facelet) !== null) return [];
  const state = fromFaceletString(facelet);
  if (!state || !isF2l(state) || isSolved(state)) return [];
  const sets: PhotoAlgSet[] = isOll(state) ? ['pll']
    : [1, 3, 5, 7].every(i => state.U[i] === state.U[4]) ? ['zbll', 'oll', 'coll'] : ['ollcp', '1lll', 'oll'];
  const cornersSolved = stepSolvedInFrame('cll', facelet);
  // EPLL (no flipped edges) already lives in PLL; the ELL catalog covers flips.
  if (cornersSolved && !sets.includes('pll')) sets.push('ell');
  else if (!cornersSolved) sets.push('cmll');
  return PHOTO_ALG_SETS.filter(set => sets.includes(set));
}

function topCornersSolved(state: CubeFaces): boolean {
  return [0, 2, 6, 8].every(i => state.U[i] === state.U[4])
    && (['F', 'R', 'B', 'L'] as const).every(f => state[f][0] === state[f][4] && state[f][2] === state[f][4]);
}

/** Use each set's own finish line. CMLL preserves Roux blocks, with M/LSE free. */
export function photoAlgGoal(set: PhotoAlgSet, state: CubeFaces): boolean {
  if (state.U.length === 16) {
    if (!reduceFour(state) || !fourLowerSolved(state) || !fourTopOriented(state)) return false;
    return set === 'oll-parity' || (set === 'pll-parity' && (['U', 'R', 'F', 'D', 'L', 'B'] as const).every(f => state[f].every(c => c === state[f][5])));
  }
  if (state.U.length === 4) return set === 'ortega-oll' ? pocketOriented(state) : pocketSolved(state);
  if (set === 'cmll') return stepSolvedInFrame('cmll', toFaceletString(state));
  if (!isF2l(state)) return false;
  if (set === 'oll') return isOll(state);
  if (set === 'ollcp' || set === 'coll') return isOll(state) && topCornersSolved(state);
  return isSolved(state);
}

/** PLL skip is absent from the 21-case library: only a final U adjustment remains. */
export function photoAufOnly(facelet: string): PhotoAlgMatch | null {
  if (!photoAlgSets(facelet).includes('pll')) return null;
  const state = fromFaceletString(facelet)!;
  for (let i = 1; i < 4; i++) if (isSolved(applyMoves(state, 3, AUF_MOVES[i]))) {
    return { set: 'pll', name: 'AUF', caseName: 'PLL skip', href: '/alg/3x3/pll', alg: AUFS[i], preAuf: '', postAuf: AUFS[i], turns: 1 };
  }
  return null;
}

/** One verified DB formula, respecting curated order; no generated substitute. Runs in a worker. */
export function findPhotoAlg(state: PhotoAlgInput, set: PhotoAlgSet, file: AlgFile): PhotoAlgMatch | null {
  const first = matchingPhotoAlgs(state, set, file).next();
  return first.done ? null : first.value;
}

/** Other formulas for the same library case, each independently aligned and verified. */
export function findPhotoAlternatives(state: PhotoAlgInput, match: PhotoAlgMatch, file: AlgFile): PhotoAlgMatch[] {
  return [...matchingPhotoAlgs(state, match.set, file, match)].filter(item => item.alg !== match.alg);
}

function* matchingPhotoAlgs(input: PhotoAlgInput, set: PhotoAlgSet, file: AlgFile, selected?: PhotoAlgMatch): Generator<PhotoAlgMatch, void> {
  if (typeof input !== 'string' && 'cp' in input && set !== 'cmll') return;
  const facelets = typeof input === 'string' ? [input] : 'cp' in input ? [cornerSimulation(input)] : input.candidates.map(c => c.facelet);
  if (!facelets.length || !facelets.every(facelet => photoAlgSets(facelet).includes(set))) return;
  const facelet = facelets[0];
  if (set === 'pll') {
    const alignment = photoAufOnly(facelet);
    if (alignment && facelets.every(f => isSolved(applyMoves(fromFaceletString(f)!, 3, parseScramble(alignment.alg))))) { yield alignment; return; }
  }
  const size = facelet.length === 96 ? 4 : facelet.length === 24 ? 2 : 3;
  const puzzle = size === 4 ? '4x4' : size === 2 ? '2x2' : '3x3';
  const decode = size === 4 ? fourFaces : size === 2 ? pocketFaces : fromFaceletString;
  const state = decode(facelet)!;
  const prefixes = size !== 3 ? ['', 'y', 'y2', "y'"].flatMap(rotation => AUFS.map(auf => [rotation, auf].filter(Boolean).join(' '))) : AUFS;
  const opened = prefixes.map(prefix => applyMoves(state, size, parseScramble(prefix)));
  const remaining = facelets.slice(1).map(f => decode(f)!);
  const slugs = buildCaseSlugMap(file.cases, set);
  const seen = new Set<string>();
  for (const c of file.cases) {
    if (selected && (selected.caseId != null ? c.id !== selected.caseId : c.name !== selected.caseName)) continue;
    entries: for (const entry of c.algs.flat()) {
      const prepared = prepareMoves(entry, size);
      if (!prepared) continue;
      const { body, moves } = prepared;
      for (let pre = 0; pre < opened.length; pre++) {
        const after = applyMoves(opened[pre], size, moves);
        for (let post = 0; post < (set === 'oll' ? 1 : 4); post++) {
          if (!photoAlgGoal(set, applyMoves(after, size, AUF_MOVES[post]))) continue;
          const alg = mergeAdjacentMoves([prefixes[pre], body, AUFS[post]].filter(Boolean).join(' '));
          if (!remaining.every(candidate => photoAlgGoal(set, applyMoves(candidate, size, size === 4 ? parseFourMoves(alg) : parseScramble(alg))))) continue;
          const slug = c.id == null ? [...slugs.bySlug].find(([, value]) => value === c)?.[0] : slugs.byId.get(c.id);
          if (!slug) continue;
          // Preserve the two numeric parts of legacy OLLCP names ("OLLCP13 6").
          if (!seen.has(alg)) {
            seen.add(alg);
            yield { puzzle, set, name: set === 'ollcp' && !c.meta?.ollcp ? c.name : primaryCaseName(puzzle, set, c), caseName: c.name,
              caseId: c.id, href: algCaseDetailHref(puzzle, set, slug), alg, body, preAuf: prefixes[pre], postAuf: AUFS[post], turns: stm(alg),
              thumbnail: { alg: body, setup: c.setup, sticker: c.sticker } };
          }
          // Each database entry needs one valid alignment, not four symmetry duplicates.
          continue entries;
        }
      }
    }
  }
}
