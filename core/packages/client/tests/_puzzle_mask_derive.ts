/**
 * Empirical derivation of the two mask tables. NOT a test file (no `.test.ts`),
 * imported by `tests/puzzle-mask.test.ts`, which re-derives on every run and
 * compares against the shipped tables in `lib/puzzle-image/data/*.json` — so a
 * renderer change breaks the test instead of silently corrupting masks. The
 * derivation lives in tests/, the tables live in lib/ (the app needs them at
 * runtime); nothing in either is hand-typed.
 *
 * Nothing here is hand-typed. Both tables come out of the state machines
 * themselves:
 *
 *  1. PIECE_GROUPS — seed the renderer's own state machine with identity sticker
 *     ids, apply each single generator, and record for every sticker WHICH
 *     generators move it. On a face-turn puzzle a piece is exactly the
 *     intersection of the layers containing it, so "set of generators that move
 *     me" is a piece fingerprint. Stickers that no generator moves are fixed
 *     centers → each is its own piece.
 *
 *  2. SR_INDEX_MAP — canonical sticker id → sr-puzzlegen (face, index). Derived
 *     by permutation conjugation, not by reading pixels: both libraries expose the
 *     same puzzle under the same WCA move names, so the physical correspondence φ
 *     is the unique bijection with  φ(π_c[p]) = π_s[φ(p)]  for every named
 *     generator (π[p] = sticker id sitting at position p after the move), plus
 *     face-consistency (a canonical face maps onto exactly one sr face).
 *     Uniqueness is asserted — if more than one φ satisfies it, the derivation is
 *     rejected rather than guessed.
 */
import { PyraminxState, pyraStickerId, PYRA_FACE_LABELS } from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import { SkewbState, skewbStickerId, SKEWB_FACE_LABELS } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { megaSolvedState, megaTurnFace, megaStickerId, MEGA_FACE_NAMES } from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import { doslice } from '@/app/[lang]/scramble/gen/_svg/nnn_sim';
import { cubeStickerIdFromPosit, CUBE_FACE_LETTERS } from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';
import { PyraminxSimulator } from 'sr-puzzlegen/dist/lib/simulator/pyraminx/pyraminxSimulator';
import { SkewbSimulator } from 'sr-puzzlegen/dist/lib/simulator/skewb/skewbSimulator';
import { MegaminxSimulator } from 'sr-puzzlegen/dist/lib/simulator/megaminx/megaminxSimulator';

/** π[p] = canonical sticker index sitting at position p after one application of the generator. */
export type Perm = number[];
export interface PuzzlePerms {
  /** number of stickers */
  n: number;
  /** canonical index → sticker id */
  id: (i: number) => string;
  /** index → face name */
  face: (i: number) => string;
  gens: Record<string, Perm>;
}

// ─── canonical (our renderers) ───────────────────────────────────────────

export function pyraPerms(): PuzzlePerms {
  const gens: Record<string, Perm> = {};
  const AXES = ['U', 'L', 'R', 'B'];
  AXES.forEach((name, axis) => {
    const st = new PyraminxState();
    st.turnBody(axis);
    gens[name] = st.image.flat();
    const tip = new PyraminxState();
    tip.turnTipOnly(axis);
    gens[name.toLowerCase()] = tip.image.flat();
  });
  return { n: 36, id: pyraStickerId, face: (i) => PYRA_FACE_LABELS[Math.floor(i / 9)], gens };
}

export function skewbPerms(): PuzzlePerms {
  const gens: Record<string, Perm> = {};
  ['R', 'U', 'L', 'B'].forEach((name, axis) => {
    const st = new SkewbState();
    st.turnOnce(axis);
    gens[name] = st.image.flat();
  });
  return { n: 30, id: skewbStickerId, face: (i) => SKEWB_FACE_LABELS[Math.floor(i / 5)], gens };
}

export function megaPerms(): PuzzlePerms {
  const gens: Record<string, Perm> = {};
  MEGA_FACE_NAMES.forEach((name, f) => {
    const st = megaSolvedState();
    megaTurnFace(st, f, 1);
    gens[name] = st.flat();
  });
  return { n: 132, id: megaStickerId, face: (i) => MEGA_FACE_NAMES[Math.floor(i / 11)], gens };
}

/**
 * NxN: generators are single slices `(face, depth)` — face turns alone cannot
 * separate the wings of an edge on N ≥ 4, and leave every odd-cube center fixed.
 *
 * depth is capped at N-2 on purpose: `doslice(f, N-1)` is the OPPOSITE face's
 * outer layer but does not spin that face, so its face stickers would read as
 * "not moved" and split a cubie's stickers apart. Every layer is still covered —
 * the opposite face contributes it at depth 0.
 */
export function cubePerms(N: number): PuzzlePerms {
  const n = 6 * N * N;
  const gens: Record<string, Perm> = {};
  for (let f = 0; f < 6; f++) {
    for (let d = 0; d <= N - 2; d++) {
      const posit = new Int32Array(n);
      for (let i = 0; i < n; i++) posit[i] = i;
      doslice(f, d, 1, N, posit);
      gens[`${CUBE_FACE_LETTERS[f]}${d}`] = Array.from(posit);
    }
  }
  return {
    n,
    id: (i) => cubeStickerIdFromPosit(N, i),
    face: (i) => CUBE_FACE_LETTERS[Math.floor(i / (N * N))],
    gens,
  };
}

// ─── piece groups ────────────────────────────────────────────────────────

/** Sticker s is moved by generator g iff it does not stay at its own position. */
function movedBy(perm: Perm, s: number): boolean {
  return perm[s] !== s;
}

/** Faces generator g spins in place (a sticker of face X lands on another slot of X). */
function selfSpunFaces(p: PuzzlePerms, g: string): Set<string> {
  const perm = p.gens[g];
  const out = new Set<string>();
  for (let pos = 0; pos < p.n; pos++) {
    const from = perm[pos];
    if (from !== pos && p.face(from) === p.face(pos)) out.add(p.face(pos));
  }
  return out;
}

/**
 * A piece is the intersection of the layers containing it, so "which layers am I
 * in" is a piece fingerprint. Layer membership is read off the permutations with
 * a 3-valued probe per generator, because "moved" alone is not the same as "in
 * the layer":
 *
 *   2 — g moves the sticker            ⇒ in layer(g)
 *   1 — g fixes it, but g spins its face in place ⇒ it is g's ROTATION AXIS point
 *       (an odd-cube face center, a megaminx center) ⇒ still in layer(g)
 *   0 — g fixes it and does not spin its face      ⇒ not in layer(g)
 *
 * Without state 1, U-center and D-center of a 3x3 are indistinguishable (both are
 * moved by exactly the four middle slices) and megaminx's 12 centers all collapse
 * into one "piece". With it, every puzzle here comes out at its true piece count.
 */
export function derivePieceGroups(p: PuzzlePerms): string[][] {
  const names = Object.keys(p.gens).sort();
  const spun = new Map(names.map((g) => [g, selfSpunFaces(p, g)]));
  const sig: string[] = [];
  for (let s = 0; s < p.n; s++) {
    sig[s] = names
      .map((g) => (movedBy(p.gens[g], s) ? '2' : spun.get(g)!.has(p.face(s)) ? '1' : '0'))
      .join('');
  }
  const buckets = new Map<string, number[]>();
  for (let s = 0; s < p.n; s++) {
    const arr = buckets.get(sig[s]) ?? [];
    arr.push(s);
    buckets.set(sig[s], arr);
  }
  const groups = [...buckets.values()].map((g) => g.map(p.id).sort());
  groups.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return groups;
}

/** A piece partition must be closed under every generator: g(piece) is a piece. */
export function pieceGroupsClosed(p: PuzzlePerms, groups: string[][]): boolean {
  const idToIdx = new Map<string, number>();
  for (let s = 0; s < p.n; s++) idToIdx.set(p.id(s), s);
  const blockOf = new Int32Array(p.n).fill(-1);
  groups.forEach((g, gi) => g.forEach((sid) => { blockOf[idToIdx.get(sid)!] = gi; }));
  if (blockOf.some((b) => b < 0)) return false;
  for (const perm of Object.values(p.gens)) {
    // move(s) = perm^-1(s): the position sticker s ends up at
    const inv = new Int32Array(p.n);
    for (let pos = 0; pos < p.n; pos++) inv[perm[pos]] = pos;
    for (const g of groups) {
      const targets = new Set(g.map((sid) => blockOf[inv[idToIdx.get(sid)!]]));
      if (targets.size !== 1) return false;
    }
  }
  return true;
}

// ─── sr-puzzlegen side ───────────────────────────────────────────────────

export interface SrPerms {
  n: number;
  /** flat sr index → [face, indexOnFace] */
  slot: (i: number) => [string, number];
  gens: Record<string, Perm>;
}

interface SrSim {
  setValue(face: string, index: number, value: string): void;
  getValues(): Record<string, string[]>;
  doTurn(label: string, reverse?: boolean): void;
}

/** Read sr's permutation for one turn label by seeding unique sticker labels. */
function srPermsFor(make: () => SrSim, faces: string[], perFace: number, turns: string[]): SrPerms {
  const n = faces.length * perFace;
  const flat = (face: string, i: number) => faces.indexOf(face) * perFace + i;
  const gens: Record<string, Perm> = {};
  for (const t of turns) {
    const sim = make();
    for (const f of faces) for (let i = 0; i < perFace; i++) sim.setValue(f, i, `${flat(f, i)}`);
    sim.doTurn(t);
    const vals = sim.getValues();
    const perm: Perm = new Array(n);
    for (const f of faces) {
      for (let i = 0; i < perFace; i++) perm[flat(f, i)] = parseInt(vals[f][i], 10);
    }
    gens[t] = perm;
  }
  return { n, slot: (i) => [faces[Math.floor(i / perFace)], i % perFace], gens };
}

export const SR_PYRA_FACES = ['top', 'left', 'right', 'back'];
export const SR_SKEWB_FACES = ['top', 'front', 'right', 'bottom', 'back', 'left'];
export const SR_MEGA_FACES = ['U', 'R', 'F', 'dr', 'dl', 'L', 'd', 'br', 'BR', 'BL', 'bl', 'b'];

export function srPyraPerms(): SrPerms {
  return srPermsFor(() => new PyraminxSimulator() as unknown as SrSim, SR_PYRA_FACES, 9,
    ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b']);
}
export function srSkewbPerms(): SrPerms {
  return srPermsFor(() => new SkewbSimulator() as unknown as SrSim, SR_SKEWB_FACES, 5,
    ['R', 'U', 'L', 'B']);
}
export function srMegaPerms(): SrPerms {
  return srPermsFor(() => new MegaminxSimulator() as unknown as SrSim, SR_MEGA_FACES, 11,
    SR_MEGA_FACES);
}

// ─── conjugation solver ──────────────────────────────────────────────────

function orbits(n: number, perms: Perm[]): number[][] {
  const seen = new Int32Array(n).fill(-1);
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] >= 0) continue;
    const oi = out.length;
    const q = [s];
    seen[s] = oi;
    const orb: number[] = [];
    while (q.length) {
      const x = q.pop()!;
      orb.push(x);
      for (const perm of perms) {
        for (const y of [perm[x], perm.indexOf(x)]) {
          if (seen[y] < 0) { seen[y] = oi; q.push(y); }
        }
      }
    }
    out.push(orb.sort((a, b) => a - b));
  }
  return out;
}

export interface SrMapResult {
  /** canonical sticker id → [sr face, sr index] */
  map: Record<string, [string, number]>;
  /** canonical face → sr face */
  faceMap: Record<string, string>;
  /** how many bijections satisfied every constraint (must be 1) */
  solutions: number;
}

/**
 * Solve φ: canonical sticker → sr sticker with φ(π_c[p]) = π_s[φ(p)] for every
 * generator pair in `genMap`, plus face-consistency + bijectivity. Returns null
 * when there is no solution; `solutions > 1` means the constraints did not pin
 * the map and the caller must NOT ship it.
 */
export function deriveSrMap(c: PuzzlePerms, s: SrPerms, genMap: Record<string, string>): SrMapResult | null {
  const cGens = Object.keys(genMap);
  const cPerms = cGens.map((g) => c.gens[g]);
  const sPerms = cGens.map((g) => s.gens[genMap[g]]);
  if (cPerms.some((p) => !p) || sPerms.some((p) => !p)) throw new Error('bad genMap');
  const sInv = sPerms.map((p) => {
    const inv = new Array<number>(s.n);
    for (let i = 0; i < s.n; i++) inv[p[i]] = i;
    return inv;
  });

  const cOrbits = orbits(c.n, cPerms);
  const movable = cOrbits.filter((o) => o.length > 1);
  const fixed = cOrbits.filter((o) => o.length === 1).map((o) => o[0]);
  const sFixed = new Set<number>();
  for (let i = 0; i < s.n; i++) if (sPerms.every((p) => p[i] === i)) sFixed.add(i);

  /** Propagate φ over one canonical orbit from a seed; null on contradiction. */
  const propagate = (seedC: number, seedS: number, phi: Int32Array, used: Set<number>): boolean => {
    const stack = [seedC];
    if (used.has(seedS)) return false;
    phi[seedC] = seedS; used.add(seedS);
    while (stack.length) {
      const p = stack.pop()!;
      for (let k = 0; k < cPerms.length; k++) {
        const cq = cPerms[k][p];
        const sq = sPerms[k][phi[p]];
        if (phi[cq] < 0) {
          if (used.has(sq)) return false;
          phi[cq] = sq; used.add(sq); stack.push(cq);
        } else if (phi[cq] !== sq) return false;
        // inverse direction
        const cr = cPerms[k].indexOf(p);
        const sr = sInv[k][phi[p]];
        if (phi[cr] < 0) {
          if (used.has(sr)) return false;
          phi[cr] = sr; used.add(sr); stack.push(cr);
        } else if (phi[cr] !== sr) return false;
      }
    }
    return true;
  };

  const solutions: Int32Array[] = [];
  const seedCandidates = movable.map((o) => {
    const size = o.length;
    // candidate seeds must sit in an sr orbit of the same size
    const sOrbits = orbits(s.n, sPerms);
    return sOrbits.filter((so) => so.length === size).flat();
  });

  const rec = (oi: number, phi: Int32Array, used: Set<number>) => {
    if (solutions.length > 1) return;
    if (oi === movable.length) {
      // face consistency on the movable stickers
      const faceMap = new Map<string, string>();
      const faceRev = new Map<string, string>();
      for (let i = 0; i < c.n; i++) {
        if (phi[i] < 0) continue;
        const cf = c.face(i);
        const sf = s.slot(phi[i])[0];
        if (faceMap.has(cf) && faceMap.get(cf) !== sf) return;
        if (faceRev.has(sf) && faceRev.get(sf) !== cf) return;
        faceMap.set(cf, sf); faceRev.set(sf, cf);
      }
      // fixed stickers (centers): resolve by face, they carry no group information
      const full = Int32Array.from(phi);
      for (const cf of fixed) {
        const sf = faceMap.get(c.face(cf));
        if (!sf) return;
        const cand = [...sFixed].filter((i) => s.slot(i)[0] === sf && !used.has(i));
        if (cand.length !== 1) return;
        full[cf] = cand[0];
      }
      if (new Set(Array.from(full)).size !== c.n) return;
      // final: conjugation holds on every sticker
      for (let k = 0; k < cPerms.length; k++) {
        for (let p = 0; p < c.n; p++) {
          if (full[cPerms[k][p]] !== sPerms[k][full[p]]) return;
        }
      }
      solutions.push(full);
      return;
    }
    for (const seedS of seedCandidates[oi]) {
      const next = Int32Array.from(phi);
      const nextUsed = new Set(used);
      if (propagate(movable[oi][0], seedS, next, nextUsed)) rec(oi + 1, next, nextUsed);
      if (solutions.length > 1) return;
    }
  };

  const phi0 = new Int32Array(c.n).fill(-1);
  rec(0, phi0, new Set());

  if (solutions.length === 0) return null;
  const phi = solutions[0];
  const map: Record<string, [string, number]> = {};
  const faceMap: Record<string, string> = {};
  for (let i = 0; i < c.n; i++) {
    const [sf, si] = s.slot(phi[i]);
    map[c.id(i)] = [sf, si];
    faceMap[c.face(i)] = sf;
  }
  return { map, faceMap, solutions: solutions.length };
}

/** Canonical face adjacency: A is adjacent to B iff turning A moves a sticker on B. */
export function faceAdjacency(p: PuzzlePerms): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [g, perm] of Object.entries(p.gens)) {
    const adj = new Set<string>();
    for (let i = 0; i < p.n; i++) {
      if (perm[i] !== i) adj.add(p.face(i));
    }
    adj.delete(g);
    out[g] = [...adj].sort();
  }
  return out;
}

function srFaceAdjacency(s: SrPerms): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [g, perm] of Object.entries(s.gens)) {
    const adj = new Set<string>();
    for (let i = 0; i < s.n; i++) if (perm[i] !== i) adj.add(s.slot(i)[0]);
    adj.delete(g);
    out[g] = [...adj].sort();
  }
  return out;
}

/**
 * Megaminx face-name maps are not shared between the two libraries (tnoodle:
 * U BL BR R F L D DR DBR B DBL DL — sr: U R F dr dl L d br BR BL bl b), so the
 * generator correspondence itself has to be derived. Anchor: both libraries call
 * the up face `U` and the front face `F` (tnoodle draws exactly those two labels
 * on its net; sr's default view puts them there) — from that anchor the
 * dodecahedral adjacency graph admits only the rotation and its mirror image, and
 * the mirror cannot conjugate a clockwise turn to a clockwise turn, so the
 * sticker-level solve rejects it.
 */
export function deriveMegaGenMap(c: PuzzlePerms, s: SrPerms): Record<string, string>[] {
  const cAdj = faceAdjacency(c);
  const sAdj = srFaceAdjacency(s);
  const cFaces = Object.keys(cAdj);
  const sFaces = Object.keys(sAdj);
  const out: Record<string, string>[] = [];
  const psi: Record<string, string> = { U: 'U', F: 'F' };

  const ok = (a: string, b: string, m: Record<string, string>): boolean => {
    // partial adjacency check
    for (const [ca, sa] of Object.entries(m)) {
      const cAdjacent = cAdj[a].includes(ca);
      const sAdjacent = sAdj[b].includes(sa);
      if (cAdjacent !== sAdjacent) return false;
    }
    return true;
  };
  const rec = (m: Record<string, string>) => {
    const remaining = cFaces.filter((f) => !(f in m));
    if (remaining.length === 0) { out.push({ ...m }); return; }
    const a = remaining[0];
    for (const b of sFaces) {
      if (Object.values(m).includes(b)) continue;
      if (!ok(a, b, m)) continue;
      rec({ ...m, [a]: b });
    }
  };
  if (!ok('U', 'U', {}) || !ok('F', 'F', { U: 'U' })) return [];
  rec(psi);
  return out;
}
