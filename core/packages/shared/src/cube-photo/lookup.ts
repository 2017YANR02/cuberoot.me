import type { AlgFile, AlgSticker } from '../alg';
import { mergeAdjacentMoves, stm, toMoveStringStrict } from '../alg_notation';
import { primaryCaseName } from '../recon/alg_case_display';
import { algCaseDetailHref, buildCaseSlugMap } from '../recon/alg_case_link';
import { fromFaceletString, toFaceletString, applyMoves, type CubeFaces } from '../timer/reconstruct/state';
import { isF2l, isOll, isSolved } from '../timer/reconstruct/cfop-detect';
import { stepSolvedInFrame } from '../timer/reconstruct/steps';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { cubieToFacelet, validateFacelet } from '../cube_facelet';
import type { PhotoRecognition, RecoveredCorners } from './recognize';

export const PHOTO_ALG_SETS = ['pll', 'oll', 'cmll', 'coll', 'ell', 'zbll', 'ollcp', '1lll'] as const;
export type PhotoAlgSet = typeof PHOTO_ALG_SETS[number];
export interface PhotoAlgMatch { set: PhotoAlgSet; name: string; caseName: string; caseId?: number; href: string; alg: string; body?: string; preAuf: string; postAuf: string; turns: number; thumbnail?: { alg: string; setup?: string; sticker: AlgSticker } }
export interface PhotoAlgResult { set: PhotoAlgSet; status: 'found' | 'missing' | 'error'; match?: PhotoAlgMatch; alternatives?: PhotoAlgMatch[] }
const AUFS = ['', 'U', 'U2', "U'"];
const AUF_MOVES = AUFS.map(a => parseScramble(a));

/** Private simulation fixture: its edges are placeholders, never recovered evidence. */
function cornerSimulation(corners: RecoveredCorners): string {
  const cp = [...corners.cp, 4, 5, 6, 7], ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const odd = cp.reduce((sum, v, i) => sum + cp.slice(i + 1).filter(w => v > w).length, 0) % 2;
  if (odd) [ep[0], ep[1]] = [ep[1], ep[0]];
  return cubieToFacelet({ cp, co: [...corners.co, 0, 0, 0, 0], ep, eo: Array(12).fill(0) });
}

export function photoRecognitionSets(recognition: PhotoRecognition): PhotoAlgSet[] {
  if (recognition.status === 'ok') return photoAlgSets(recognition.candidates[0].facelet);
  const corners = recognition.status === 'corners-only' && recognition.cornerCandidates?.[0];
  return corners && photoAlgSets(cornerSimulation(corners)).includes('cmll') ? ['cmll'] : [];
}

export function photoAlgSets(facelet: string): PhotoAlgSet[] {
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
export function findPhotoAlg(state: string | RecoveredCorners, set: PhotoAlgSet, file: AlgFile): PhotoAlgMatch | null {
  const first = matchingPhotoAlgs(state, set, file).next();
  return first.done ? null : first.value;
}

/** Other formulas for the same library case, each independently aligned and verified. */
export function findPhotoAlternatives(state: string | RecoveredCorners, match: PhotoAlgMatch, file: AlgFile): PhotoAlgMatch[] {
  return [...matchingPhotoAlgs(state, match.set, file, match)].filter(item => item.alg !== match.alg);
}

function* matchingPhotoAlgs(input: string | RecoveredCorners, set: PhotoAlgSet, file: AlgFile, selected?: PhotoAlgMatch): Generator<PhotoAlgMatch, void> {
  if (typeof input !== 'string' && set !== 'cmll') return;
  const facelet = typeof input === 'string' ? input : cornerSimulation(input);
  if (!photoAlgSets(facelet).includes(set)) return;
  if (set === 'pll') {
    const alignment = photoAufOnly(facelet);
    if (alignment) { yield alignment; return; }
  }
  const state = fromFaceletString(facelet)!;
  const opened = AUF_MOVES.map(moves => applyMoves(state, 3, moves));
  const slugs = buildCaseSlugMap(file.cases, set);
  const seen = new Set<string>();
  for (const c of file.cases) {
    if (selected && (selected.caseId != null ? c.id !== selected.caseId : c.name !== selected.caseName)) continue;
    entries: for (const entry of c.algs.flat()) {
      let body: string;
      try { body = toMoveStringStrict(entry.alg); } catch { continue; }
      if (!body || body.split(/\s+/).some(token => !parseScramble(token).length)) continue;
      const moves = parseScramble(body);
      for (let pre = 0; pre < 4; pre++) {
        const after = applyMoves(opened[pre], 3, moves);
        for (let post = 0; post < (set === 'oll' ? 1 : 4); post++) {
          if (!photoAlgGoal(set, applyMoves(after, 3, AUF_MOVES[post]))) continue;
          const alg = mergeAdjacentMoves([AUFS[pre], body, AUFS[post]].filter(Boolean).join(' '));
          const slug = c.id == null ? [...slugs.bySlug].find(([, value]) => value === c)?.[0] : slugs.byId.get(c.id);
          if (!slug) continue;
          // Preserve the two numeric parts of legacy OLLCP names ("OLLCP13 6").
          if (!seen.has(alg)) {
            seen.add(alg);
            yield { set, name: set === 'ollcp' && !c.meta?.ollcp ? c.name : primaryCaseName('3x3', set, c), caseName: c.name,
              caseId: c.id, href: algCaseDetailHref('3x3', set, slug), alg, body, preAuf: AUFS[pre], postAuf: AUFS[post], turns: stm(alg),
              thumbnail: { alg: body, setup: c.setup, sticker: c.sticker } };
          }
          // Each database entry needs one valid alignment, not four symmetry duplicates.
          continue entries;
        }
      }
    }
  }
}
