/**
 * gen-net — derive each non-WCA puzzle's group-theoretic 2D-net source from
 * cubing.js, ONCE, and emit it as readable TypeScript under _svg/_nets/.
 *
 * The emitted file is the canonical, self-contained source: the puzzle as a
 * permutation group (orbits + generators in cycle notation, the natural
 * group-theory form) plus its net geometry. cubing.js is used here only to
 * extract + cross-check the permutations; it is NOT a runtime dependency of the
 * scramble-preview path.
 *
 * For every base generator we apply the bare token to the solved KPuzzle, read
 * back the resulting permutation + orientation, and decompose it into disjoint
 * cycles + a sparse orientation twist. Derived tokens (X', X2, megaminx X--)
 * are dropped from the source and re-checked to be exactly the group inverse /
 * power of their base. Finally the emitted group is replayed through our own
 * engine (lib/puzzle-group) and asserted equal to cubing.js's KPuzzle state +
 * colors over many random scrambles, so the hand-free source is provably faithful.
 *
 * Run:  npx tsx scripts/gen-net.ts <fto|baby_fto|master_tetraminx|kilominx|redi_cube|all>
 *       (from packages/client)
 */
import { puzzles } from 'cubing/puzzles';
import { randomScrambleForEvent } from 'cubing/scramble';
import { writeFileSync } from 'node:fs';
import { applyScramble, type PuzzleGroup } from '../lib/puzzle-group.ts';

// ── puzzle config ────────────────────────────────────────────────────────────
interface Cfg {
  constName: string;
  file: string;
  title: string;
  orbitRename: Record<string, string>; // cubing orbit name -> nice name (only "used" orbits)
  tokens: 'cubing' | 'kilominx';
  sampleN: number;
  /** a fixed, hand-chosen scramble (known tokens) to print a golden for the test */
  goldenScramble: string;
}
const PUZZLES: Record<string, Cfg> = {
  fto: {
    constName: 'FTO', file: 'fto.ts',
    title: 'FTO — Face-Turning Octahedron, face-turning group ⟨U,F,L,R,B,BL,BR,D⟩ (each turn order 3)',
    orbitRename: { C4RNER: 'corners', CENTERS: 'centers', EDGES: 'edges' },
    tokens: 'cubing', sampleN: 70,
    goldenScramble: 'R BL F U B L R BR D F BL U R B L F D BR U R F BL',
  },
  baby_fto: {
    constName: 'BABY_FTO', file: 'baby_fto.ts',
    title: 'Baby FTO — 2×2 Face-Turning Octahedron (corners + centers), each face turn order 3',
    orbitRename: { C4RNER: 'corners', CENTERS: 'centers' },
    tokens: 'cubing', sampleN: 150,
    goldenScramble: "U L F R U' L' F R BR U F R'",
  },
  master_tetraminx: {
    constName: 'MASTER_TETRAMINX', file: 'master_tetraminx.ts',
    title: 'Master Tetraminx — 4-layer face-turning tetrahedron (order-3 face + wide turns)',
    orbitRename: { EDGES: 'edges', EDGES2: 'wings', CORNERS: 'corners', CENTERS: 'centers' },
    tokens: 'cubing', sampleN: 150,
    goldenScramble: "U L R B u l r b U' L' R' B' u' l' r' b'",
  },
  kilominx: {
    constName: 'KILOMINX', file: 'kilominx.ts',
    title: 'Kilominx — corners-only megaminx (megaminx face-turn notation R++ / D-- / U)',
    orbitRename: { CORNERS: 'corners' },
    tokens: 'kilominx', sampleN: 0,
    goldenScramble:
      "R++ D-- R++ D-- R++ D-- R++ D-- R++ D-- U R-- D++ R-- D++ R-- D++ R-- D++ R-- D++ U'",
  },
  redi_cube: {
    constName: 'REDI_CUBE', file: 'redi_cube.ts',
    title: 'Redi Cube — corner-turning cube ⟨U,D,F,L,B,UR,UL⟩',
    orbitRename: { CORNERS: 'corners', EDGES: 'edges' },
    tokens: 'cubing', sampleN: 120,
    goldenScramble: "UR B U D F L UR' UL F' U' D' B'",
  },
};

// ── tiny 2×3 affine (SVG matrix(a,b,c,d,e,f): x'=a*x+c*y+e, y'=b*x+d*y+f) ──────
type M = number[];
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => {
  const [a, b, c, d, e, f] = m, [A, B, C, D, E, F] = n;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
};
const apply = (m: M, [x, y]: number[]): number[] => {
  const [a, b, c, d, e, f] = m; return [a * x + c * y + e, b * x + d * y + f];
};
function parseTransform(str: string): M {
  let m = ID;
  const re = /(translate|scale|rotate)\(([^)]*)\)/g;
  let g: RegExpExecArray | null;
  while ((g = re.exec(str))) {
    const args = g[2].split(/[\s,]+/).map(Number);
    let t: M = ID;
    if (g[1] === 'translate') t = [1, 0, 0, 1, args[0], args[1] || 0];
    else if (g[1] === 'scale') t = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
    else if (g[1] === 'rotate') { const r = (args[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); t = [c, s, -s, c, 0, 0]; }
    m = mul(m, t);
  }
  return m;
}
const normColor = (c: string): string => {
  const s = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return '#' + s.slice(1).toLowerCase();
  if (s.toLowerCase() === 'red') return '#ee0000';
  return s.toLowerCase();
};

// ── parsed facelet ────────────────────────────────────────────────────────────
interface Facelet { orbit: string; piece: number; orient: number; fill: string; pts: number[][]; }

function chunkPts(nums: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/** Parse the cubing.js net SVG into absolute-coordinate facelets, for all 3 layouts. */
function parseNet(svg: string): Facelet[] {
  const facelets: Facelet[] = [];
  const hasIdGroup = /<g id="\w+-l\d+-o\d+"/.test(svg);
  const hasFaceGroup = /<g id="[A-Za-z]+"\s+transform=/.test(svg);

  if (hasIdGroup) {
    // Format C (redi): per-facelet <g id="ORBIT-l-o" transform style="fill:..;"> wrapping
    // a <rect> or <polygon>. Ambient parent transforms are uniform translates → absorbed
    // by the bbox-derived viewBox, so we only honor the facelet group's own transform.
    const gre = /<g id="(\w+)-l(\d+)-o(\d+)"\s+transform="([^"]*)"\s+style="fill:\s*([^;]+);"\s*>([\s\S]*?)<\/g>/g;
    let gm: RegExpExecArray | null;
    while ((gm = gre.exec(svg))) {
      const mat = parseTransform(gm[4]);
      const inner = gm[6];
      let local: number[][] | null = null;
      const rect = /<rect[^>]*\bx="([\d.+\-eE]+)"[^>]*\by="([\d.+\-eE]+)"[^>]*\bwidth="([\d.+\-eE]+)"[^>]*\bheight="([\d.+\-eE]+)"/.exec(inner);
      if (rect) {
        const x = +rect[1], y = +rect[2], w = +rect[3], h = +rect[4];
        local = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      } else {
        const poly = /<polygon[^>]*\bpoints="([^"]+)"/.exec(inner);
        if (poly) local = chunkPts(poly[1].trim().split(/[\s,]+/).map(Number));
      }
      if (!local) throw new Error(`redi: no shape in group ${gm[1]}-l${gm[2]}-o${gm[3]}`);
      facelets.push({ orbit: gm[1], piece: +gm[2], orient: +gm[3], fill: normColor(gm[5]), pts: local.map((p) => apply(mat, p)) });
    }
  } else if (hasFaceGroup) {
    // Format A (fto / baby_fto): <g id="FACE" transform> groups with nested
    // <polygon id="ORBIT-l-o" style="fill:..;" [transform] points>.
    const gre = /<g id="([A-Za-z_]+)"\s+transform="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g;
    let gm: RegExpExecArray | null;
    while ((gm = gre.exec(svg))) {
      const gMat = parseTransform(gm[2]);
      const pre = /<polygon id="(\w+)-l(\d+)-o(\d+)"\s+style="fill:\s*([^;]+);"(?:\s+transform="([^"]*)")?\s+points="([^"]+)"/g;
      let pm: RegExpExecArray | null;
      while ((pm = pre.exec(gm[3]))) {
        const mat = pm[5] ? mul(gMat, parseTransform(pm[5])) : gMat;
        const pts = chunkPts(pm[6].trim().split(/[\s,]+/).map(Number)).map((p) => apply(mat, p));
        facelets.push({ orbit: pm[1], piece: +pm[2], orient: +pm[3], fill: normColor(pm[4]), pts });
      }
    }
  } else {
    // Format B (master_tetraminx / kilominx): flat <polygon id="ORBIT-l-o" class style points>,
    // absolute coordinates.
    const pre = /<polygon id="(\w+)-l(\d+)-o(\d+)"[^>]*style="fill:\s*([^";]+?)\s*"[^>]*points="([^"]+)"/g;
    let pm: RegExpExecArray | null;
    while ((pm = pre.exec(svg))) {
      const pts = chunkPts(pm[5].trim().split(/[\s,]+/).map(Number));
      facelets.push({ orbit: pm[1], piece: +pm[2], orient: +pm[3], fill: normColor(pm[4]), pts });
    }
  }
  if (!facelets.length) throw new Error('parseNet: no facelets parsed');
  return facelets;
}

// ── flat permutation helpers (for classification & cycle decomposition) ───────
interface Flat { perm: number[]; delta: number[]; }
function invertFlat({ perm, delta }: Flat, ori: number): Flat {
  const n = perm.length, inv = new Array(n), w = new Array(n);
  for (let i = 0; i < n; i++) inv[perm[i]] = i;
  for (let i = 0; i < n; i++) w[i] = ((-delta[inv[i]]) % ori + ori) % ori;
  return { perm: inv, delta: w };
}
function composeFlat(a: Flat, b: Flat, ori: number): Flat {
  // result = apply a then b: perm[i] = a.perm[b.perm[i]], delta[i] = a.delta[b.perm[i]] + b.delta[i]
  const n = a.perm.length, perm = new Array(n), delta = new Array(n);
  for (let i = 0; i < n; i++) { perm[i] = a.perm[b.perm[i]]; delta[i] = (a.delta[b.perm[i]] + b.delta[i]) % ori; }
  return { perm, delta };
}
function powFlat(a: Flat, p: number, ori: number): Flat {
  let base = a, e = Math.abs(p);
  if (p < 0) base = invertFlat(a, ori);
  let acc: Flat = { perm: a.perm.map((_, i) => i), delta: a.perm.map(() => 0) };
  for (let k = 0; k < e; k++) acc = composeFlat(acc, base, ori);
  return acc;
}
const flatEq = (a: Flat, b: Flat): boolean =>
  a.perm.length === b.perm.length && a.perm.every((v, i) => v === b.perm[i] && a.delta[i] === b.delta[i]);

/** Decompose a flat move on one orbit into disjoint cycles + sparse twist. */
function toCycles({ perm, delta }: Flat): { cycles: number[][]; twist: Record<number, number> } {
  const n = perm.length, seen = new Array(n).fill(false), cycles: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || perm[i] === i) { seen[i] = true; continue; }
    const cyc: number[] = [];
    let j = i;
    while (!seen[j]) { seen[j] = true; cyc.push(j); j = perm[j]; }
    if (cyc.length > 1) cycles.push(cyc);
  }
  const twist: Record<number, number> = {};
  for (let i = 0; i < n; i++) if (delta[i]) twist[i] = delta[i];
  return { cycles, twist };
}

// ── kilominx random-move scramble (mirrors lib/cubing-scramble randomMoveKilominxScramble) ──
function kilominxScramble(): string {
  const lines: string[] = [];
  for (let row = 0; row < 7; row++) {
    const t: string[] = [];
    for (let i = 0; i < 10; i++) t.push((i % 2 === 0 ? 'R' : 'D') + (Math.random() < 0.5 ? '++' : '--'));
    t.push(Math.random() < 0.5 ? 'U' : "U'");
    lines.push(t.join(' '));
  }
  return lines.join('\n');
}

// ── serialization ─────────────────────────────────────────────────────────────
const keyStr = (k: string): string => (/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k));
const round = (n: number): number => Math.round(n * 100) / 100;

async function gen(id: string): Promise<void> {
  const cfg = PUZZLES[id];
  if (!cfg) throw new Error('unknown puzzle ' + id);
  const loader = (puzzles as Record<string, { kpuzzle(): Promise<any>; svg(pattern?: unknown): Promise<string> }>)[id];
  const kp = await loader.kpuzzle();
  const svg = await loader.svg();

  // 1. parse net → facelets, used orbits, solvedColor
  const facelets = parseNet(svg);
  const usedOrig = [...new Set(facelets.map((f) => f.orbit))];
  for (const o of usedOrig) if (!cfg.orbitRename[o]) throw new Error(`${id}: orbit ${o} used in net but not renamed`);
  const orig2nice = cfg.orbitRename;
  const nice2orig: Record<string, string> = {};
  for (const [o, n] of Object.entries(orig2nice)) nice2orig[n] = o;

  const orbitSpec = kp.definition.orbits as { orbitName: string; numPieces: number; numOrientations: number }[];
  const specOf: Record<string, { size: number; ori: number }> = {};
  for (const o of orbitSpec) specOf[o.orbitName] = { size: o.numPieces, ori: o.numOrientations };

  // solvedColor[nice][piece][orient]
  const solvedColor: Record<string, string[][]> = {};
  for (const orig of usedOrig) {
    const nice = orig2nice[orig], spec = specOf[orig];
    solvedColor[nice] = Array.from({ length: spec.size }, () => new Array<string>(spec.ori).fill(''));
  }
  for (const f of facelets) solvedColor[orig2nice[f.orbit]][f.piece][f.orient] = f.fill;
  // A partial net (e.g. baby_fto draws each solid center only once, at o0) leaves
  // some (piece, orient) slots undrawn. Those orientations are visually identical
  // (single-color piece) — fill them with the piece's known color so the runtime
  // lookup never lands on undefined. The svg(pattern) cross-check below proves this
  // reproduces cubing.js's own renderer exactly.
  for (const [nice, table] of Object.entries(solvedColor)) {
    table.forEach((row, p) => {
      const known = row.find((c) => c);
      if (!known) throw new Error(`${id}: piece ${nice}[${p}] has no drawn sticker`);
      for (let r = 0; r < row.length; r++) if (!row[r]) row[r] = known;
    });
  }

  // 2. token alphabet
  const scrambles: string[] = [];
  if (cfg.tokens === 'kilominx') {
    for (let i = 0; i < 90; i++) scrambles.push(kilominxScramble());
  } else {
    for (let i = 0; i < cfg.sampleN; i++) scrambles.push((await randomScrambleForEvent(id)).toString());
  }
  const alphabet = [...new Set(scrambles.flatMap((s) => s.trim().split(/\s+/)).filter(Boolean))];

  // 3. transform of every token, via applyAlg from solved
  const flatOf = (token: string): Record<string, Flat> => {
    const pd = kp.defaultPattern().applyAlg(token).patternData as Record<string, { pieces: number[]; orientation: number[] }>;
    const out: Record<string, Flat> = {};
    for (const orig of usedOrig) out[orig] = { perm: pd[orig].pieces.slice(), delta: pd[orig].orientation.slice() };
    return out;
  };
  const trans: Record<string, Record<string, Flat>> = {};
  for (const t of alphabet) trans[t] = flatOf(t);

  // 4. classify base vs derived; mirror the engine's resolveToken rules + verify
  const inAlpha = new Set(alphabet);
  const isInverseTok = (t: string): string | null =>
    t.endsWith("'") && inAlpha.has(t.slice(0, -1)) ? t.slice(0, -1) : null;
  const isSquareTok = (t: string): string | null =>
    t.endsWith('2') && inAlpha.has(t.slice(0, -1)) ? t.slice(0, -1) : null;
  const isMinusTok = (t: string): string | null =>
    t.endsWith('--') && inAlpha.has(t.slice(0, -2) + '++') ? t.slice(0, -2) + '++' : null;

  const baseTokens: string[] = [];
  for (const t of alphabet) {
    const inv = isInverseTok(t), sq = isSquareTok(t), mn = isMinusTok(t);
    if (inv) {
      for (const orig of usedOrig) if (!flatEq(trans[t][orig], invertFlat(trans[inv][orig], specOf[orig].ori))) throw new Error(`${id}: ${t} ≠ (${inv})⁻¹ on ${orig}`);
    } else if (mn) {
      for (const orig of usedOrig) if (!flatEq(trans[t][orig], invertFlat(trans[mn][orig], specOf[orig].ori))) throw new Error(`${id}: ${t} ≠ (${mn})⁻¹ on ${orig}`);
    } else if (sq) {
      for (const orig of usedOrig) if (!flatEq(trans[t][orig], powFlat(trans[sq][orig], 2, specOf[orig].ori))) throw new Error(`${id}: ${t} ≠ (${sq})² on ${orig}`);
    } else {
      baseTokens.push(t);
    }
  }
  baseTokens.sort();

  // 5. build the PuzzleGroup (used orbits, renamed; base gens in cycle notation)
  const orbits: Record<string, { size: number; ori: number }> = {};
  for (const orig of usedOrig) orbits[orig2nice[orig]] = specOf[orig];
  const gens: Record<string, Record<string, { cycles: number[][]; twist?: Record<number, number> }>> = {};
  for (const t of baseTokens) {
    const gen: Record<string, { cycles: number[][]; twist?: Record<number, number> }> = {};
    for (const orig of usedOrig) {
      const { cycles, twist } = toCycles(trans[t][orig]);
      if (cycles.length || Object.keys(twist).length) {
        gen[orig2nice[orig]] = Object.keys(twist).length ? { cycles, twist } : { cycles };
      }
    }
    if (Object.keys(gen).length) gens[t] = gen;
  }
  const group: PuzzleGroup = { orbits, gens };

  // 6. end-to-end verify: our engine == cubing.js KPuzzle (state + colors)
  const cubingState = (scr: string): Record<string, { pieces: number[]; orientation: number[] }> => {
    let p = kp.defaultPattern();
    for (const tok of scr.trim().split(/\s+/)) if (tok) p = p.applyAlg(tok);
    return p.patternData;
  };
  for (const scr of scrambles) {
    const mine = applyScramble(group, scr);
    const theirs = cubingState(scr);
    for (const orig of usedOrig) {
      const nice = orig2nice[orig], spec = specOf[orig];
      for (let i = 0; i < spec.size; i++) {
        if (mine[nice].pieces[i] !== theirs[orig].pieces[i] || mine[nice].orient[i] !== theirs[orig].orientation[i])
          throw new Error(`${id}: STATE mismatch ${nice}[${i}] for "${scr.slice(0, 40)}…"`);
      }
    }
    // colors
    for (const f of facelets) {
      const nice = orig2nice[f.orbit], ori = specOf[f.orbit].ori;
      const q = mine[nice].pieces[f.piece], o = mine[nice].orient[f.piece];
      const c1 = solvedColor[nice][q][((f.orient - o) % ori + ori) % ori];
      const tq = theirs[f.orbit].pieces[f.piece], to = theirs[f.orbit].orientation[f.piece];
      const c2 = solvedColor[nice][tq][((f.orient - to) % ori + ori) % ori];
      if (c1 !== c2) throw new Error(`${id}: COLOR mismatch`);
    }
  }

  // (cubing.js's static svg(pattern) helper always renders the SOLVED net — it
  // ignores the pattern — so it can't be a rendering oracle. The state check above
  // is the rigorous guarantee: our engine reproduces cubing.js's KPuzzle pattern
  // exactly; the (netOri − orient) facelet formula is cubing's standard TwistyPlayer
  // convention. Rendering is additionally eyeballed in /scramble/gen.)

  // 7. geometry: bbox → viewBox, stroke proportional
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of facelets) for (const [x, y] of f.pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const w = maxX - minX, h = maxY - minY;
  const strokeWidth = Math.max(1, Math.round(Math.max(w, h) / 248));
  const pad = strokeWidth * 2;
  const viewBox = `${round(minX - pad)} ${round(minY - pad)} ${round(w + 2 * pad)} ${round(h + 2 * pad)}`;

  const netFacelets = facelets.map((f) => ({
    orbit: orig2nice[f.orbit], piece: f.piece, orient: f.orient,
    pts: f.pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' '),
  }));

  // 8. golden for the test
  const golden = (() => {
    const st = applyScramble(group, cfg.goldenScramble);
    return netFacelets.map((f) => {
      const ori = orbits[f.orbit].ori, s = st[f.orbit];
      const q = s.pieces[f.piece], o = s.orient[f.piece];
      return solvedColor[f.orbit][q][((f.orient - o) % ori + ori) % ori];
    }).join('|');
  })();

  // 9. emit
  const P = cfg.constName;
  const orbitLines = Object.entries(orbits).map(([n, s]) => `    ${keyStr(n)}: { size: ${s.size}, ori: ${s.ori} },`).join('\n');
  const genLines = baseTokens.filter((t) => gens[t]).map((t) => {
    const orbLines = Object.entries(gens[t]).map(([orb, act]) => {
      const cyc = `cycles: [${act.cycles.map((c) => `[${c.join(',')}]`).join(', ')}]`;
      const tw = act.twist ? `, twist: { ${Object.entries(act.twist).map(([k, v]) => `${k}: ${v}`).join(', ')} }` : '';
      return `      ${keyStr(orb)}: { ${cyc}${tw} },`;
    }).join('\n');
    return `    ${keyStr(t)}: {\n${orbLines}\n    },`;
  }).join('\n');

  const colorLines = Object.entries(solvedColor).map(([orb, table]) =>
    `    ${keyStr(orb)}: [${table.map((row) => `[${row.map((c) => JSON.stringify(c)).join(', ')}]`).join(', ')}],`).join('\n');
  const faceletLines = netFacelets.map((f) =>
    `    { orbit: ${JSON.stringify(f.orbit)}, piece: ${f.piece}, orient: ${f.orient}, pts: ${JSON.stringify(f.pts)} },`).join('\n');

  const out = `/**
 * ${cfg.title}.
 *
 * Group-theoretic source (orbits + generators in cycle notation) — the canonical,
 * self-contained definition of this puzzle's scramble-preview model. Derived once
 * from cubing.js by scripts/gen-net.ts and verified equal to cubing.js's KPuzzle
 * over random scrambles (state + every sticker color); cubing.js is NOT a runtime
 * dependency here. A scramble token resolves to a base generator raised to a power
 * (X' = inverse, X2 = square, X-- = (X++)⁻¹); see lib/puzzle-group.
 *
 * Orbits used in the 2D net: ${Object.keys(orbits).join(', ')}. Net geometry (polygon
 * coordinates) is plain data, extracted from cubing.js's own SVG net.
 */
import type { PuzzleGroup } from '@/lib/puzzle-group';
import type { PuzzleNet, PuzzleNetDef } from '../_net_render';

export const ${P}_GROUP: PuzzleGroup = {
  orbits: {
${orbitLines}
  },
  gens: {
${genLines}
  },
};

export const ${P}_NET: PuzzleNet = {
  viewBox: ${JSON.stringify(viewBox)},
  stroke: '#1a1a1a',
  strokeWidth: ${strokeWidth},
  solvedColor: {
${colorLines}
  },
  facelets: [
${faceletLines}
  ],
};

export const ${P}: PuzzleNetDef = { group: ${P}_GROUP, net: ${P}_NET };
`;
  const dest = `app/[lang]/scramble/gen/_svg/_nets/${cfg.file}`;
  writeFileSync(dest, out);
  console.log(`\nOK ${id} → ${dest}`);
  console.log(`  orbits=${Object.entries(orbits).map(([n, s]) => `${n}:${s.size}×${s.ori}`).join(' ')}`);
  console.log(`  base gens (${baseTokens.filter((t) => gens[t]).length}): ${baseTokens.filter((t) => gens[t]).join(' ')}`);
  console.log(`  derived tokens: ${alphabet.filter((t) => !gens[t]).sort().join(' ') || '(none)'}`);
  console.log(`  facelets=${netFacelets.length} viewBox="${viewBox}" stroke=${strokeWidth} colors=${Object.values(solvedColor).reduce((a, t) => a + new Set(t.flat()).size, 0)}`);
  console.log(`  verified: ${scrambles.length} scrambles — engine state == cubing.js KPuzzle (pieces+orientation)`);
  console.log(`  GOLDEN scramble: ${JSON.stringify(cfg.goldenScramble)}`);
  console.log(`  GOLDEN fills: ${golden}`);
}

(async () => {
  const which = process.argv[2] || 'all';
  const ids = which === 'all' ? Object.keys(PUZZLES) : [which];
  for (const id of ids) await gen(id);
  console.log('\nall done.');
})().catch((e) => { console.error(e); process.exit(1); });
