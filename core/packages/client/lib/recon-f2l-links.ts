import { loadAlg } from '@cuberoot/shared/alg';
import { CUBE_ORIENTATIONS } from '@cuberoot/shared/timer';
import { Masking } from '@cuberoot/visualcube';
import { cubeColorGroups, crossColorFromReconText } from '@cuberoot/timer-ui/CubeColorChip';
import { applyMoves, applyScramble, type CubeFaces } from '@cuberoot/shared/timer/reconstruct/state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { f2lSlotFingerprint, isSlotSolved } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { isCross } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { FACE_COLOR_KEY } from '@cuberoot/shared/timer/reconstruct/orient';
import { cleanForPlayer, reconLineSetups } from './recon-alg-utils';
import { algCaseDetailHref, buildCaseSlugMap } from './alg_case_link';
import { maskedReconFacelets } from './recon-diagram-mask';
import { simplifyAlg } from './cube3';

const color = (face: keyof CubeFaces) => FACE_COLOR_KEY[face][0].toUpperCase();
const rotate = (state: CubeFaces, alg: string) => applyMoves(state, 3, parseScramble(alg));
const slots = ['FR', 'FL', 'BR', 'BL'] as const;

/** Restore a labelled stage boundary with a short insertion and its inverse.
 * The complete reconstruction remains equivalent; stored notation is untouched. */
export function expandReconCancellation(scramble: string, text: string, lineIndex: number): string | null {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (!line || !scramble.trim() || !/\/\/.*\bcancel\s+into\b/i.test(line)) return null;
  const next = lines.findIndex((value, index) => index > lineIndex && cleanForPlayer(value).trim());
  if (next < 0) return null;
  const label = line.slice(line.indexOf('//') + 2);
  const pairs = cubeColorGroups(label).filter(group => group.colors.length === 2).map(group => group.colors);
  const cross = crossColorFromReconText(text);
  const before = applyScramble(3, cleanForPlayer([scramble, ...lines.slice(0, lineIndex)].join('\n')));
  const state = rotate(before, cleanForPlayer(line));
  const orientation = CUBE_ORIENTATIONS.find(({ value }) => {
    const faces = rotate(before, value);
    return cross ? color(faces.D[4]) === cross : isCross(faces);
  });
  if (!orientation) return null;
  const prior = rotate(before, orientation.value);
  const preserved = slots.filter(slot => isSlotSolved(prior, slot));
  const required = slots.filter(slot => pairs.some(pair =>
    pair.includes(color(prior[slot[0] as keyof CubeFaces][4])) && pair.includes(color(prior[slot[1] as keyof CubeFaces][4]))));
  const crossStage = label.match(/\b(x*)cross\b/i);
  const targetCount = crossStage ? crossStage[1].length : Number(label.match(/\bF2L\s*([1-4])/i)?.[1] ?? preserved.length + 1);
  if (!required.length && !crossStage && !/\bF2L/i.test(label)) return null;
  const complete = (alg: string) => {
    const faces = rotate(rotate(state, alg), orientation.value);
    return isCross(faces) && [...preserved, ...required].every(slot => isSlotSolved(faces, slot))
      && slots.filter(slot => isSlotSolved(faces, slot)).length >= targetCount;
  };
  if (complete('')) return null;
  const moves = ['U', 'D', 'F', 'B', 'L', 'R'].flatMap(face => [face, `${face}'`, `${face}2`]);
  const candidates = [...moves, ...moves.flatMap(a => moves.filter(b => a[0] !== b[0]).map(b => `${a} ${b}`))];
  const insertion = candidates.find(complete);
  if (!insertion) return null;
  const inverse = insertion.split(' ').reverse().map(move => move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`).join(' ');
  const replaceMoves = (value: string, moves: string) => `${moves}${value.includes('//') ? ` ${value.slice(value.indexOf('//'))}` : ''}`;
  lines[lineIndex] = replaceMoves(line, `${cleanForPlayer(line)} ${insertion}`);
  lines[next] = replaceMoves(lines[next], simplifyAlg(`${inverse} ${cleanForPlayer(lines[next])}`));
  return lines.join('\n');
}

export interface ReconF2lAnnotations {
  links: Map<number, Map<string, string>>;
  diagrams: Map<number, { colors: string; facelets: string }[]>;
}

/** Per-line, per-colour-pair links derived from the actual pre-line cube state. */
export async function reconF2lLinks(scramble: string, text: string): Promise<Map<number, Map<string, string>>> {
  return (await reconF2lAnnotations(scramble, text)).links;
}

export async function reconF2lAnnotations(scramble: string, text: string, onDiagrams?: (diagrams: ReconF2lAnnotations['diagrams']) => void): Promise<ReconF2lAnnotations> {
  const links = new Map<number, Map<string, string>>();
  const diagrams: ReconF2lAnnotations['diagrams'] = new Map();
  if (!scramble.trim()) return { links, diagrams };
  const setups = reconLineSetups(scramble, text);
  let state = applyScramble(3, setups[0]);
  const explicitCross = crossColorFromReconText(text);
  for (const [lineIndex, line] of text.replace(/\r\n?/g, '\n').split('\n').entries()) {
    const before = state;
    const beforeSetup = setups[lineIndex];
    state = applyScramble(3, setups[lineIndex + 1]);
    const comment = line.indexOf('//');
    if (comment < 0) continue;
    const label = line.slice(comment + 2).trim();
    const crossLine = /\bx*cross\b/i.test(label);
    const pairs = cubeColorGroups(label).filter(group => group.colors.length === 2).map(group => group.colors);
    const genericF2l = /^F2L(?:[1-4])?\b/i.test(label);
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
      const orientation = orientations.find(({ faces }) => color(faces.D[4]) === cross &&
        pair.includes(color(faces.F[4])) && pair.includes(color(faces.R[4])));
      const canonical = orientation?.faces;
      if (orientation) {
        const facelets = maskedReconFacelets(beforeSetup, orientation.faces, Masking.PAIR);
        if (facelets) diagrams.set(lineIndex, [...(diagrams.get(lineIndex) ?? []), { colors: pair, facelets }]);
      }
      if (crossLine) continue;
      if (!canonical || isSlotSolved(canonical, 'FR')) continue;
      const key = f2lSlotFingerprint(canonical, 'FR');
      if (key) lineLinks.set(pair, key);
    }
    if (genericF2l && pairs.length === 1 && lineLinks.size === 1) lineLinks.set('F2L', [...lineLinks.values()][0]);
    if (lineLinks.size) links.set(lineIndex, lineLinks);
    const rowDiagrams = diagrams.get(lineIndex);
    if (rowDiagrams && rowDiagrams.length > 1) {
      // All masks describe the same pre-line state and grip. Union their
      // visible stickers so a multi-pair stage still has one thumbnail.
      diagrams.set(lineIndex, [{
        colors: rowDiagrams.map(item => item.colors).join('+'),
        facelets: [...rowDiagrams[0].facelets].map((color, index) =>
          rowDiagrams.find(item => item.facelets[index] !== 'd')?.facelets[index] ?? color,
        ).join(''),
      }]);
    }
  }
  // Drawing uses only the recorded state. Publish it before any library I/O;
  // the library is needed solely to turn fingerprints into case links.
  onDiagrams?.(diagrams);
  const indexCases = async (set: 'f2l' | 'adv-f2l') => {
    const file = await loadAlg('3x3', set);
    const slugs = buildCaseSlugMap(file.cases, set);
    const hrefByState = new Map<string, Set<string>>();
    for (const c of file.cases) {
      const slug = c.id == null ? undefined : slugs.byId.get(c.id);
      if (!slug || !c.setup) continue;
      // Case setup, not an algorithm that may solve several different cases.
      const reference = applyScramble(3, c.setup);
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const key = f2lSlotFingerprint(rotate(reference, auf), 'FR');
        if (!key) continue;
        const hrefs = hrefByState.get(key) ?? new Set<string>();
        hrefs.add(algCaseDetailHref('3x3', set, slug));
        hrefByState.set(key, hrefs);
      }
    }
    return hrefByState;
  };
  const standard = await indexCases('f2l');
  const needsAdvanced = [...links.values()].some(pairs => [...pairs.values()].some(key => !standard.has(key)));
  // Advanced lookup must not make already identified standard cases disappear.
  const advanced = needsAdvanced ? await indexCases('adv-f2l').catch(() => new Map<string, Set<string>>()) : new Map<string, Set<string>>();
  for (const [line, pairs] of links) {
    for (const [pair, key] of pairs) {
      const hrefs = standard.get(key) ?? advanced.get(key);
      if (hrefs?.size === 1) pairs.set(pair, [...hrefs][0]);
      else pairs.delete(pair);
    }
    if (!pairs.size) links.delete(line);
  }
  return { links, diagrams };
}
