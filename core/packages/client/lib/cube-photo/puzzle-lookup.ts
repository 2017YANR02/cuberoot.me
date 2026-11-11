import { Alg } from 'cubing/alg';
import type { AlgFile } from '@cuberoot/shared/alg';
import { algCaseDetailHref, buildCaseSlugMap } from '@cuberoot/shared/recon/alg-case-link';
import { SkewbStateWCA } from '@cuberoot/shared/skewb-pyramid-svg';
import { toWca } from '@cuberoot/shared/skewb-notation';
import { PyraminxState } from '@cuberoot/puzzle-render-core/pyraminx-svg';
import { applySq1Scramble, applySq1Move, isSq1Solved, simplifySq1Alg, SQ1_TOKEN_RE, parseSq1Tokens, type Sq1State, type Sq1Token } from '@cuberoot/shared/sq1-notation';
import { COLOR_ORDER, type CubeColor } from '@cuberoot/shared/cube-photo/recognize';
import { PUZZLE_PHOTO_FACES, puzzlePhotoCells, SQ1_LAYER_SLOTS, SQ1_SIDE_SLOTS, type PhotoPuzzle } from './puzzle-geometry';
import type { PhotoCardMatch, PhotoCardResult } from './card-types';

export type PuzzlePhotoColors = Record<string, CubeColor[]>;
const CUBE_FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
const PYRA_FACES = ['F', 'D', 'L', 'R'];
const solvedSq1 = applySq1Scramble('');
const join = (...parts: string[]) => parts.filter(Boolean).join(' ');
const uniform = (rows: number[][]) => new Set(rows.map(r => r[0])).size === rows.length && rows.every(r => r.every(c => c === r[0]));

function parsedMoves(puzzle: PhotoPuzzle, text: string): string[] | null {
  try {
    const expanded = new Alg(puzzle === 'skewb' ? toWca(text, 'sarah') : text).expand().toString().trim();
    const tokens = expanded ? expanded.split(/\s+/) : [];
    const pattern = puzzle === 'skewb' ? /^(UL|UR|[RULBFDxyz])(\d*)('?)$/ : /^[ULRBulrb]'?$/;
    return tokens.length && tokens.length <= 250 && tokens.every(t => pattern.test(t)) ? tokens : null;
  } catch { return null; }
}

const skewbRotations = (() => {
  const rotations = [''];
  const seen = new Set([JSON.stringify(new SkewbStateWCA().image)]);
  for (let i = 0; i < rotations.length; i++) for (const turn of ['x', 'y', 'z']) {
    const alg = join(rotations[i], turn), state = new SkewbStateWCA(); state.applyAlgorithm(alg);
    const key = JSON.stringify(state.image);
    if (!seen.has(key)) { seen.add(key); rotations.push(alg); }
  }
  return rotations;
})();

/** No state-space search or solver tables: only simulate existing catalog formulas. */
function matchSkewb(colors: PuzzlePhotoColors, body: string): { pre: string; post: string } | null {
  const tokens = parsedMoves('skewb', body);
  if (!tokens) return null;
  for (const pre of skewbRotations) {
    const state = new SkewbStateWCA();
    state.image = CUBE_FACES.map(f => colors[f].map(c => COLOR_ORDER.indexOf(c)));
    state.applyAlgorithm(pre);
    for (const token of tokens) state.applyMove(token);
    if (uniform(state.image)) return { pre, post: '' };
  }
  return null;
}

function matchPyra(colors: PuzzlePhotoColors, body: string): { pre: string; post: string } | null {
  const tokens = body ? parsedMoves('pyraminx', body) : [];
  if (!tokens) return null;
  for (const pre of ['', 'U', "U'"]) {
    const state = new PyraminxState();
    // The engine only permutes entries, so color ids can replace sticker ids here.
    state.image = PYRA_FACES.map(f => colors[f].map(c => COLOR_ORDER.indexOf(c)));
    state.applyAlgorithm(pre);
    for (const token of tokens) state.applyMove(token);
    const core = state.image.map(row => row.filter((_, i) => i % 3 !== 0));
    if (!uniform(core)) continue;
    const expected = core.map(row => row[0]);
    const post: string[] = [];
    for (let axis = 0; axis < 4; axis++) {
      const marker = new PyraminxState(); marker.turnTipOnly(axis);
      const slots = marker.image.flatMap((row, f) => row.flatMap((v, s) => v !== f * 9 + s ? [[f, s]] : []));
      const matches = () => slots.every(([f, s]) => state.image[f][s] === expected[f]);
      let turns = 0;
      while (turns < 3 && !matches()) { state.turnTipOnly(axis); turns++; }
      if (!matches()) return null;
      if (turns) post.push('ulrb'[axis] + (turns === 2 ? "'" : ''));
    }
    if (uniform(state.image)) return { pre, post: post.join(' ') };
  }
  return null;
}

/** Solved slot -> its position on each photographed side. */
const SQ1_PIECE_SIDES = new Map<number, string[]>();
for (const face of ['F', 'R', 'B', 'L']) SQ1_SIDE_SLOTS[face].forEach(slot => {
  const piece = solvedSq1.pieces[slot];
  SQ1_PIECE_SIDES.set(piece, [...(SQ1_PIECE_SIDES.get(piece) ?? []), face]);
});

/** Recover every piece from top/bottom color plus its one/two side colors. */
export function recoverPhotoSq1(colors: PuzzlePhotoColors): Sq1State | null {
  if (!completePhotoColors('sq1', colors)) return null;
  if (!colors.U.every(c => c === colors.U[0]) || !colors.D.every(c => c === colors.D[0])) return null;
  const scheme: Record<string, CubeColor> = { U: colors.U[0], D: colors.D[0], F: colors.F[3], R: colors.R[3], B: colors.B[4], L: colors.L[3] };
  if (new Set(Object.values(scheme)).size !== 6) return null;
  const sliceSolved = colors.F[4] === scheme.F;
  if (colors.F[4] !== (sliceSolved ? scheme.F : scheme.B) || colors.B[3] !== (sliceSolved ? scheme.B : scheme.F)
    || colors.R[4] !== scheme.R || colors.L[4] !== scheme.L) return null;
  const pieces = [...solvedSq1.pieces], used = new Set<number>();
  for (const face of ['U', 'D'] as const) for (const slot of SQ1_LAYER_SLOTS[face]) {
    const home = solvedSq1.pieces[slot];
    const sideFaces = SQ1_PIECE_SIDES.get(home)!;
    const observed = sideFaces.map(side => {
      const index = SQ1_SIDE_SLOTS[side].indexOf(slot);
      return colors[side][index < 3 ? index : index + 2];
    });
    const candidates = [...SQ1_PIECE_SIDES].filter(([piece, sides]) => (piece < 8) === (face === 'U') && sides.length === sideFaces.length
      && sides.every(side => observed.includes(scheme[side])));
    if (candidates.length !== 1 || used.has(candidates[0][0])) return null;
    const piece = candidates[0][0]; used.add(piece);
    // A physical corner cannot have its two side stickers mirrored.
    if (sideFaces.length === 2) {
      const ring = ['F', 'R', 'B', 'L'];
      const start = ring.findIndex(side => sideFaces.includes(side) && sideFaces.includes(ring[(ring.indexOf(side) + 1) % 4]));
      const source = SQ1_PIECE_SIDES.get(piece)!;
      const sourceStart = ring.findIndex(side => source.includes(side) && source.includes(ring[(ring.indexOf(side) + 1) % 4]));
      if (observed[sideFaces.indexOf(ring[start])] !== scheme[ring[sourceStart]]) return null;
    }
    solvedSq1.pieces.forEach((id, i) => { if (id === home) pieces[i] = piece; });
  }
  return { pieces, sliceSolved };
}

function sq1Tokens(text: string): Sq1Token[] | null {
  const clean = text.replace(/\/\/[^\n]*/g, ' ');
  if (clean.replace(new RegExp(SQ1_TOKEN_RE.source, 'g'), '').trim()) return null;
  const tokens = parseSq1Tokens(clean);
  return tokens.length > 0 && tokens.length <= 250 ? tokens : null;
}
function applySq1Checked(initial: Sq1State, tokens: Sq1Token[]): Sq1State | null {
  let state = initial;
  for (const token of tokens) {
    const p = state.pieces;
    if (token.kind === 'slice' && (p[0] === p[11] || p[5] === p[6] || p[12] === p[23] || p[17] === p[18])) return null;
    state = applySq1Move(state, token);
  }
  return state;
}
function sq1Alignment(state: Sq1State): string | null {
  for (let top = -5; top <= 6; top++) {
    const upper = applySq1Move(state, { kind: 'turn', top, bot: 0 });
    const expected = state.smallSliceFlipped ? solvedSq1.pieces.slice(12).map((_, i) => solvedSq1.pieces[12 + (i + 6) % 12]) : solvedSq1.pieces.slice(0, 12);
    if (!upper.pieces.slice(0, 12).every((v, i) => v === expected[i])) continue;
    for (let bot = -5; bot <= 6; bot++) if (isSq1Solved(applySq1Move(upper, { kind: 'turn', top: 0, bot }))) return top || bot ? `(${top}, ${bot})` : '';
  }
  return null;
}
function matchSq1(state: Sq1State, body: string): { pre: string; post: string } | null {
  const tokens = sq1Tokens(body);
  if (!tokens) return null;
  // 144 bounded alignments, never an optimal-solver/table search.
  for (const top of [0, 3, -3, 6, 1, -1, 2, -2, 4, -4, 5, -5]) for (const bot of [0, 3, -3, 6, 1, -1, 2, -2, 4, -4, 5, -5]) {
    const after = applySq1Checked(applySq1Move(state, { kind: 'turn', top, bot }), tokens);
    if (!after) continue;
    const post = sq1Alignment(after);
    if (post !== null) return { pre: top || bot ? `(${top}, ${bot})` : '', post };
  }
  return null;
}

export function completePhotoColors(puzzle: PhotoPuzzle, colors: PuzzlePhotoColors): boolean {
  return PUZZLE_PHOTO_FACES[puzzle].every(face => colors[face]?.length === puzzlePhotoCells(puzzle, face).length && colors[face].every(c => COLOR_ORDER.includes(c)));
}
export function photoPuzzleSolved(puzzle: PhotoPuzzle, colors: PuzzlePhotoColors): boolean {
  if (!completePhotoColors(puzzle, colors)) return false;
  if (puzzle === 'sq1') { const state = recoverPhotoSq1(colors); return !!state && isSq1Solved(state); }
  return uniform(PUZZLE_PHOTO_FACES[puzzle].map(f => colors[f].map(c => COLOR_ORDER.indexOf(c))));
}

/** AUF and independent Pyraminx tips do not require a catalog case. */
export function puzzlePhotoAdjustment(puzzle: PhotoPuzzle, colors: PuzzlePhotoColors): PhotoCardResult | null {
  if (!completePhotoColors(puzzle, colors) || puzzle === 'skewb') return null;
  const state = puzzle === 'sq1' ? recoverPhotoSq1(colors) : null;
  const alignment = puzzle === 'pyraminx' ? matchPyra(colors, '') : state ? { pre: '', post: sq1Alignment(state) } : null;
  if (!alignment || alignment.post === null) return null;
  const alg = join(alignment.pre, alignment.post);
  if (!alg) return null;
  const set = puzzle === 'sq1' ? 'pbl' : 'l3e';
  return { set, status: 'found', alternatives: [], match: {
    puzzle, set, name: puzzle === 'sq1' ? 'AUF' : alg, caseName: 'AUF', href: `/alg/${puzzle}/${set}`,
    alg, preAuf: alignment.pre, postAuf: alignment.post, turns: puzzle === 'sq1' ? 0 : alg.split(/\s+/).length,
  } };
}

export function findPuzzlePhotoAlgs(puzzle: PhotoPuzzle, colors: PuzzlePhotoColors, file: AlgFile): PhotoCardResult {
  const result: PhotoCardResult = { set: file.set, status: 'missing' };
  if (file.puzzle !== puzzle || !completePhotoColors(puzzle, colors)) return result;
  const sq1 = puzzle === 'sq1' ? recoverPhotoSq1(colors) : null;
  if (puzzle === 'sq1' && !sq1) return result;
  const slugs = buildCaseSlugMap(file.cases, file.set);
  for (const c of file.cases) {
    const matches: PhotoCardMatch[] = [];
    const seen = new Set<string>();
    for (const entry of c.algs.flat()) {
      const alignment = puzzle === 'skewb' ? matchSkewb(colors, entry.alg) : puzzle === 'pyraminx' ? matchPyra(colors, entry.alg) : matchSq1(sq1!, entry.alg);
      if (!alignment) continue;
      const slug = c.id == null ? [...slugs.bySlug].find(([, value]) => value === c)?.[0] : slugs.byId.get(c.id);
      if (!slug) continue;
      const raw = join(alignment.pre, entry.alg, alignment.post), alg = puzzle === 'sq1' ? simplifySq1Alg(raw, 'wca') : raw;
      if (seen.has(alg)) continue;
      seen.add(alg);
      matches.push({ puzzle, set: file.set, name: c.name, caseName: c.name, caseId: c.id,
        href: algCaseDetailHref(puzzle, file.set, slug), alg, body: entry.alg, preAuf: alignment.pre, postAuf: alignment.post,
        turns: puzzle === 'sq1' ? parseSq1Tokens(alg).filter(t => t.kind === 'slice').length : parsedMoves(puzzle, alg)?.filter(t => !/^[xyz]/.test(t)).length ?? 0,
        thumbnail: { alg: entry.alg, setup: puzzle === 'skewb' ? undefined : c.setup, sticker: c.sticker } });
    }
    if (matches.length) return { set: file.set, status: 'found', match: matches[0], alternatives: matches.slice(1) };
  }
  return result;
}
