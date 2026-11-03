import type { AlgFile } from '../alg';
import { mergeAdjacentMoves, stm, toMoveStringStrict } from '../alg_notation';
import { primaryCaseName } from '../recon/alg_case_display';
import { algCaseDetailHref, buildCaseSlugMap } from '../recon/alg_case_link';
import { fromFaceletString, applyMoves, type CubeFaces } from '../timer/reconstruct/state';
import { isF2l, isOll, isSolved } from '../timer/reconstruct/cfop-detect';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { validateFacelet } from '../cube_facelet';

export type PhotoAlgSet = 'oll' | 'ollcp' | '1lll' | 'zbll' | 'coll' | 'pll';
export interface PhotoAlgMatch { set: PhotoAlgSet; name: string; caseName: string; caseId?: number; href: string; alg: string; body?: string; preAuf: string; postAuf: string; turns: number }
export interface PhotoAlgResult { set: PhotoAlgSet; status: 'found' | 'missing' | 'error'; match?: PhotoAlgMatch }
const AUFS = ['', 'U', 'U2', "U'"];
const AUF_MOVES = AUFS.map(a => parseScramble(a));

export function photoAlgSets(facelet: string): PhotoAlgSet[] {
  if (validateFacelet(facelet) !== null) return [];
  const state = fromFaceletString(facelet);
  if (!state || !isF2l(state) || isSolved(state)) return [];
  if (isOll(state)) return ['pll'];
  return [1, 3, 5, 7].every(i => state.U[i] === state.U[4]) ? ['zbll', 'oll', 'coll'] : ['ollcp', '1lll', 'oll'];
}

/** OLLCP/COLL finish with aligned corners and oriented edges, leaving EPLL. */
export function photoAlgGoal(set: PhotoAlgSet, state: CubeFaces): boolean {
  if (set === 'oll') return isOll(state);
  if (set === 'ollcp' || set === 'coll') return isOll(state) && (['F', 'R', 'B', 'L'] as const).every(f => state[f][0] === state[f][4] && state[f][2] === state[f][4]);
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
export function findPhotoAlg(facelet: string, set: PhotoAlgSet, file: AlgFile): PhotoAlgMatch | null {
  if (!photoAlgSets(facelet).includes(set)) return null;
  if (set === 'pll') {
    const alignment = photoAufOnly(facelet);
    if (alignment) return alignment;
  }
  const state = fromFaceletString(facelet)!;
  const opened = AUF_MOVES.map(moves => applyMoves(state, 3, moves));
  const slugs = buildCaseSlugMap(file.cases, set);
  for (const c of file.cases) for (const entry of c.algs.flat()) {
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
        return { set, name: set === 'ollcp' && !c.meta?.ollcp ? c.name : primaryCaseName('3x3', set, c), caseName: c.name,
          caseId: c.id, href: algCaseDetailHref('3x3', set, slug), alg, body, preAuf: AUFS[pre], postAuf: AUFS[post], turns: stm(alg) };
      }
    }
  }
  return null;
}
