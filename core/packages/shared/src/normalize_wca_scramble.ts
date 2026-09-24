import { flattenAlg, tokenizeMoves } from './alg_notation';

type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];
const ROT_FACE_PERM: Record<string, Record<Face, Face>> = {
  x: { U: 'F', D: 'B', F: 'D', B: 'U', R: 'R', L: 'L' },
  x2: { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
  "x'": { U: 'B', D: 'F', F: 'U', B: 'D', R: 'R', L: 'L' },
  y: { U: 'U', D: 'D', F: 'R', B: 'L', R: 'B', L: 'F' },
  y2: { U: 'U', D: 'D', F: 'B', B: 'F', R: 'L', L: 'R' },
  "y'": { U: 'U', D: 'D', F: 'L', B: 'R', R: 'F', L: 'B' },
  z: { U: 'L', D: 'R', F: 'F', B: 'B', R: 'U', L: 'D' },
  z2: { U: 'D', D: 'U', F: 'F', B: 'B', R: 'L', L: 'R' },
  "z'": { U: 'R', D: 'L', F: 'F', B: 'B', R: 'D', L: 'U' },
};
const WIDE_DECOMP: Record<string, [string, string]> = {
  Uw: ['D', 'y'], Uw2: ['D2', 'y2'], "Uw'": ["D'", "y'"],
  Dw: ['U', "y'"], Dw2: ['U2', 'y2'], "Dw'": ["U'", 'y'],
  Fw: ['B', 'z'], Fw2: ['B2', 'z2'], "Fw'": ["B'", "z'"],
  Bw: ['F', "z'"], Bw2: ['F2', 'z2'], "Bw'": ["F'", 'z'],
  Rw: ['L', 'x'], Rw2: ['L2', 'x2'], "Rw'": ["L'", "x'"],
  Lw: ['R', "x'"], Lw2: ['R2', 'x2'], "Lw'": ["R'", 'x'],
  u: ['D', 'y'], u2: ['D2', 'y2'], "u'": ["D'", "y'"],
  d: ['U', "y'"], d2: ['U2', 'y2'], "d'": ["U'", 'y'],
  f: ['B', 'z'], f2: ['B2', 'z2'], "f'": ["B'", "z'"],
  b: ['F', "z'"], b2: ['F2', 'z2'], "b'": ["F'", 'z'],
  r: ['L', 'x'], r2: ['L2', 'x2'], "r'": ["L'", "x'"],
  l: ['R', "x'"], l2: ['R2', 'x2'], "l'": ["R'", 'x'],
};

function rotate(cur: Record<Face, Face>, token: string): Record<Face, Face> {
  const perm = ROT_FACE_PERM[token];
  const next = {} as Record<Face, Face>;
  for (const f of FACES) next[f] = cur[perm[f]];
  return next;
}

/** Reduce 3x3 wide turns and cube rotations to face turns in a fixed frame. */
export function normalizeWcaScramble(scramble: string): string | null {
  const out: string[] = [];
  let cur: Record<Face, Face> = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' };
  const { moves, junk } = tokenizeMoves(flattenAlg(scramble));
  if (junk.length) return null;
  for (const move of moves) {
    if (move.layer) return null;
    const quarter = ((move.amount % 4) + 4) % 4;
    if (!quarter) continue;
    const suffix = quarter === 2 ? '2' : quarter === 3 ? "'" : '';
    const token = `${move.family}${suffix}`;
    if (ROT_FACE_PERM[token]) { cur = rotate(cur, token); continue; }
    const wide = WIDE_DECOMP[token];
    if (wide) {
      out.push(cur[wide[0][0] as Face] + wide[0].slice(1));
      cur = rotate(cur, wide[1]);
      continue;
    }
    if (move.kind !== 'face' || !FACES.includes(move.family as Face)) return null;
    out.push(cur[move.family as Face] + suffix);
  }
  return out.join(' ');
}
