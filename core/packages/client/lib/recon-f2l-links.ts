import { loadAlg } from '@cuberoot/shared/alg';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { cubeColorGroups, crossColorFromReconText } from '@cuberoot/timer-ui/CubeColorChip';
import { applyMoves, applyScramble, type CubeFaces } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { f2lSlotFingerprint, isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { isCross } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { FACE_COLOR_KEY } from '@cuberoot/shared/timer/reconstruct/orient';
import { cleanForPlayer } from './recon-alg-utils';
import { algCaseDetailHref, buildCaseSlugMap } from './alg_case_link';

const color = (face: keyof CubeFaces) => FACE_COLOR_KEY[face][0].toUpperCase();
const rotate = (state: CubeFaces, alg: string) => applyMoves(state, 3, parseScramble(alg));
const slots = ['FR', 'FL', 'BR', 'BL'] as const;

/** Per-line, per-colour-pair links derived from the actual pre-line cube state. */
export async function reconF2lLinks(scramble: string, text: string): Promise<Map<number, Map<string, string>>> {
  const links = new Map<number, Map<string, string>>();
  if (!scramble.trim()) return links;
  const file = await loadAlg('3x3', 'f2l');
  const slugs = buildCaseSlugMap(file.cases, 'f2l');
  const hrefByState = new Map<string, Set<string>>();
  for (const c of file.cases) {
    const slug = c.id == null ? undefined : slugs.byId.get(c.id);
    if (!slug || !c.setup) continue;
    // Match the library's case setup, not algorithms that can solve multiple cases.
    const reference = applyScramble(3, c.setup);
    for (const auf of ['', 'U', 'U2', "U'"]) {
      const key = f2lSlotFingerprint(rotate(reference, auf), 'FR');
      if (!key) continue;
      const hrefs = hrefByState.get(key) ?? new Set<string>();
      hrefs.add(algCaseDetailHref('3x3', 'f2l', slug));
      hrefByState.set(key, hrefs);
    }
  }
  let state = applyScramble(3, cleanForPlayer(scramble));
  const explicitCross = crossColorFromReconText(text);
  for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
    const before = state;
    state = rotate(state, cleanForPlayer(line));
    const comment = line.indexOf('//');
    if (comment < 0) continue;
    const label = line.slice(comment + 2).trim();
    if (/\bx*cross\b/i.test(label)) continue;
    const pairs = cubeColorGroups(label).filter(group => group.colors.length === 2).map(group => group.colors);
    const genericF2l = /^F2L\s*$/i.test(label);
    if (!pairs.length && !genericF2l) continue;
    const orientations = CUBE_ORIENTATIONS.map(({ value }) => ({ value, faces: rotate(before, value) }));
    const cross = explicitCross ?? orientations.filter(({ faces }) => isCross(faces))
      .sort((a, b) => slots.filter(slot => isSlotSolved(b.faces, slot)).length - slots.filter(slot => isSlotSolved(a.faces, slot)).length)
      .map(({ faces }) => color(faces.D[4]))[0];
    if (!cross) continue;
    if (genericF2l && !pairs.length) {
      const afterOrientations = CUBE_ORIENTATIONS.map(({ value }) => rotate(state, value));
      for (const { faces } of orientations) {
        const after = afterOrientations.find(p => p.D[4] === faces.D[4] && p.F[4] === faces.F[4] && p.R[4] === faces.R[4]);
        if (color(faces.D[4]) === cross && !isSlotSolved(faces, 'FR') && after && isSlotSolved(after, 'FR')) {
          pairs.push(color(faces.F[4]) + color(faces.R[4]));
        }
      }
    }
    const lineLinks = new Map<string, string>();
    for (const pair of new Set(pairs)) {
      const canonical = orientations.find(({ faces }) => color(faces.D[4]) === cross &&
        pair.includes(color(faces.F[4])) && pair.includes(color(faces.R[4])))?.faces;
      if (!canonical || isSlotSolved(canonical, 'FR')) continue;
      const key = f2lSlotFingerprint(canonical, 'FR');
      const hrefs = key ? hrefByState.get(key) : undefined;
      if (hrefs?.size === 1) lineLinks.set(pair, [...hrefs][0]);
    }
    if (genericF2l && pairs.length === 1 && lineLinks.size === 1) lineLinks.set('F2L', [...lineLinks.values()][0]);
    if (lineLinks.size) links.set(lineIndex, lineLinks);
  }
  return links;
}
