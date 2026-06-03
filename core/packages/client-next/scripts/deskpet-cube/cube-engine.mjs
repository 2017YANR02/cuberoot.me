// Shared 3x3 cube engine for the DeskPet "cubing" (Cube Show) animations.
//
// Single source of truth for: WCA colour scheme, the 3x3x3 geometry, the 2.5D
// projection, SMIL keyframe generation, and the Clawd body shell. Every cubing
// SVG is generated from here so the cube is always a *standard 3x3* in standard
// colours and one consistent look. Output SVGs stay self-contained (the gallery
// renders them as <img>, which can't cross-reference files or run JS); they all
// flow from this one module.
//
// Look ("variant B"): flat nine-grid stickers inset in 3D FACE-SPACE (so seams
// stay dead-straight even on the foreshortened top) over a black cubie body, at
// .toFixed(3) precision (coarse rounding made the squashed top's seams wobble).
//
// Motion: every frame poses the whole cube with a 3x3 rotation matrix and may
// rotate a single layer (turn sim). The scene is a flat list of "elements" (each
// a 3D quad + outward normal + colour); rigid motions back each FACE with one
// black quad (cheap), turns back each facelet (so seams move with the layer).
// A motion builder returns { polys, anims, stats }; build-cubing.mjs maps each
// gallery file to one.

// ── WCA standard colour scheme. Mirrors lib/cube-colors.ts (CUBE_FILL). ──
export const WCA = Object.freeze({
  U: '#ffffff', D: '#fefe00', F: '#00d800', B: '#0000f2', R: '#ee0000', L: '#ffa100',
});
const BODY = '#0f0f12'; // cubie plastic — shows through the seams between stickers

// ── Geometry: unit cube, half-edge H, 3 cells per edge ──
const H = 1.5;
const STEP = (2 * H) / 3; // 1.0

// face = origin corner + two in-plane span vectors (one cell) + outward normal
const FACES = {
  U: { o: [-H,  H, -H], u: [1, 0, 0],  v: [0, 0, 1],  n: [0, 1, 0] },
  D: { o: [-H, -H,  H], u: [1, 0, 0],  v: [0, 0, -1], n: [0, -1, 0] },
  F: { o: [-H,  H,  H], u: [1, 0, 0],  v: [0, -1, 0], n: [0, 0, 1] },
  B: { o: [ H,  H, -H], u: [-1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] },
  R: { o: [ H,  H,  H], u: [0, 0, -1], v: [0, -1, 0], n: [1, 0, 0] },
  L: { o: [-H,  H, -H], u: [0, 0, 1],  v: [0, -1, 0], n: [-1, 0, 0] },
};
const FACE_LIST = ['U', 'D', 'F', 'B', 'L', 'R'];
const add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// ── 3x3 rotation matrices + helpers (cube poses & layer turns) ──
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const mv = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const ROT_AXIS = { x: rotX, y: rotY, z: rotZ };
const AXIS_IDX = { x: 0, y: 1, z: 2 };
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ── Projection: pose the cube with R, then a fixed downward tilt φ about X, then
//    orthographic to screen (SVG y is down), plus an optional screen offset. ──
export function makeView({ phi = 26, scale = 0.95, cx = 7.6, cy = 10.5, bias = 0.04 } = {}) {
  const ph = (phi * Math.PI) / 180;
  const cphi = Math.cos(ph), sphi = Math.sin(ph);
  return {
    project([x, y, z], R, off) {
      const [X, Y, Z] = mv(R, [x, y, z]);
      return [cx + X * scale + (off ? off[0] : 0), cy - (Y * cphi - Z * sphi) * scale + (off ? off[1] : 0)];
    },
    normalVisible(n, R) { const [, Y, Z] = mv(R, n); return Y * sphi + Z * cphi > bias; },
    depth([x, y, z], R) { const [, Y, Z] = mv(R, [x, y, z]); return Y * sphi + Z * cphi; },
  };
}

// ── Sticker look (variant B): inset in 3D face-space so the 9 quads form a
//    provably-regular grid; under the affine projection every seam is an exact
//    straight parallel line — no screen-space centroid rounding to wobble the
//    foreshortened top. Animate polygon `points` (linear interp of a 4-corner
//    quad is always a valid quad → never warps). ──
const INSET = 0.14; // seam width as a fraction of a cell (split half to each side)
const PREC = 3;     // .toFixed(3): at ~1px the squashed top's ~0.06px seams crawl

function hexShade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const c = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
const SHADE = { U: 1, D: 1, F: 0.97, B: 0.97, R: 0.9, L: 0.9 }; // top brightest → 3D feel

const faceCorners = (face) => {
  const f = FACES[face]; const E = 3 * STEP; const p = f.o.slice();
  return [p, add(p, f.u, E), add(add(p, f.u, E), f.v, E), add(p, f.v, E)];
};
const cellInset = (f, i, j) => {
  const base = add(add(f.o.slice(), f.u, i * STEP), f.v, j * STEP);
  const lo = 0.5 * INSET, hi = 1 - 0.5 * INSET;
  return [[lo, lo], [hi, lo], [hi, hi], [lo, hi]].map(([cu, cv]) => add(add(base, f.u, cu * STEP), f.v, cv * STEP));
};

const fix = (v) => v.toFixed(PREC);
const ptsStr = (quad) => quad.map(([x, y]) => `${fix(x)},${fix(y)}`).join(' ');
const animAttr = (id, attr, dur, keyTimes, values, mode = 'linear') =>
  `      <animate xlink:href="#${id}" attributeName="${attr}" dur="${dur}" repeatCount="indefinite" calcMode="${mode}" keyTimes="${keyTimes}" values="${values}"/>`;

// ── Scene element: a 3D quad with an outward normal and a colour. `black` ones
//    are the cubie body; others are stickers. Elements are projected, culled by
//    normal, depth-sorted and emitted as polygons + SMIL by renderTrack. ──

// ── Solid-cubie model (layer turns only) ──
// Each of the 26 visible cubies is a real box of black plastic carrying an inset
// colour sticker on every exterior face. A turn rotates whole cubies, so the
// turning layer reads as a *solid slab* — coloured sides + black underside — and
// the gap it opens shows real 3-D surfaces (the lifted slab's underside, the
// inner corner), not a flat hole punched in the shell. This is exactly why a
// proper cube renderer (cubing.js et al.) turns look solid: volume, not
// paper-thin stickers. Rendered with renderTrack's 'depth' paint order; each
// sticker is nudged a hair out along its normal so it sorts just over its own
// cubie face. Rigid motions keep the cheap flat shell (rigidElems) — they never
// open a gap, so the extra volume would only cost bytes.
const GAP = 0.03; // half the black plastic gap between adjacent cubies
const STK = 0.04; // sticker inset from the cubie-face edge (variant-B border)
const HSZ = 0.5 - GAP; // cubie half-size (a cell half-extent is 0.5)
// Interior plastic, shaded per face orientation so an exposed wedge reads as a
// solid dark surface with form (lit top, dark underside) rather than a flat hole.
// Kept near the seam-black so a cubie's own border still matches the rigid shell.
const PLASTIC = '#16161c';
const PLASTIC_SHADE = { U: 1.7, D: 0.5, F: 1.1, B: 0.78, R: 0.9, L: 0.9 };
const FACE_DIRS = [
  { n: [1, 0, 0], f: 'R', a: 0 }, { n: [-1, 0, 0], f: 'L', a: 0 },
  { n: [0, 1, 0], f: 'U', a: 1 }, { n: [0, -1, 0], f: 'D', a: 1 },
  { n: [0, 0, 1], f: 'F', a: 2 }, { n: [0, 0, -1], f: 'B', a: 2 },
];
// the quad of one box face: face centre = c + n*h, spanned by the two axes ⟂ n
function boxFace(c, h, n, inset = 0) {
  const fc = add(c, n, h);
  const [u, v] = n[0] ? [[0, 1, 0], [0, 0, 1]] : n[1] ? [[1, 0, 0], [0, 0, 1]] : [[1, 0, 0], [0, 1, 0]];
  const s = h - inset;
  return [add(add(fc, u, -s), v, -s), add(add(fc, u, s), v, -s), add(add(fc, u, s), v, s), add(add(fc, u, -s), v, s)];
}
// 26 cubies; each = 6 black box faces + an inset sticker on each exterior face
function buildCubies(colors = WCA) {
  const cubies = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    if (!i && !j && !k) continue; // hidden centre cubie
    const c = [i * STEP, j * STEP, k * STEP], faces = [];
    for (const d of FACE_DIRS) {
      const ext = (d.n[0] && i === d.n[0]) || (d.n[1] && j === d.n[1]) || (d.n[2] && k === d.n[2]);
      faces.push({ quad: boxFace(c, HSZ, d.n), normal: d.n.slice(), color: hexShade(PLASTIC, PLASTIC_SHADE[d.f]), black: true });
      if (ext) faces.push({
        quad: boxFace(c, HSZ, d.n, STK).map((p) => add(p, d.n, 0.006)),
        normal: d.n.slice(), color: hexShade(colors[d.f], SHADE[d.f]),
      });
    }
    cubies.push({ center: c, faces });
  }
  return cubies;
}
const rotCubie = (cb, M) => ({
  center: mv(M, cb.center),
  faces: cb.faces.map((fa) => ({ quad: fa.quad.map((p) => mv(M, p)), normal: mv(M, fa.normal), color: fa.color, black: fa.black })),
});
const cubieElems = (cubies) => cubies.flatMap((cb) => cb.faces);

// solved rigid scene: 6 face backings + 54 sticker insets (colour faces only).
function rigidElems(colors = WCA) {
  const elems = [];
  for (const face of FACE_LIST) {
    const f = FACES[face];
    elems.push({ quad: faceCorners(face), normal: f.n.slice(), color: BODY, black: true });
  }
  for (const face of FACE_LIST) {
    const f = FACES[face];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      elems.push({ quad: cellInset(f, i, j), normal: f.n.slice(), color: hexShade(colors[face], SHADE[face]) });
    }
  }
  return elems;
}

// ── The workhorse. frames[k] = { elems:[{quad,normal,color,black}], pose:R,
//    off:[dx,dy]|null }. Same element count/order every frame (stable identity).
//    Projects all elements across the track, culls by normal, depth-sorts (far→
//    near; black before sticker at equal depth so the body never hides its own
//    stickers), emits polygons + SMIL animates. ──
function renderTrack(frames, view, { dur = '9s', paint = 'blackFirst' } = {}) {
  const F = frames.length, N = frames[0].elems.length;
  const keyTimes = frames.map((_, k) => (k / (F - 1)).toFixed(4)).join(';');
  const stats = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, nan: false, minVis: 99, maxVis: 0 };

  const items = [];
  for (let idx = 0; idx < N; idx++) {
    const pts = [], vis = [], cols = [];
    for (let k = 0; k < F; k++) {
      const fr = frames[k], el = fr.elems[idx];
      const v = view.normalVisible(el.normal, fr.pose) ? 1 : 0;
      vis.push(v);
      const q = el.quad.map((p) => view.project(p, fr.pose, fr.off));
      if (v) for (const [sx, sy] of q) {
        if (Number.isNaN(sx) || Number.isNaN(sy)) stats.nan = true;
        stats.minX = Math.min(stats.minX, sx); stats.maxX = Math.max(stats.maxX, sx);
        stats.minY = Math.min(stats.minY, sy); stats.maxY = Math.max(stats.maxY, sy);
      }
      pts.push(ptsStr(q)); cols.push(el.color);
    }
    if (vis.every((v) => !v)) continue; // never seen → drop (smaller file)
    // Paint order is fixed by document order (SMIL can't reorder), so anchor each
    // element's depth at its first visible frame — which is the solved/settled rest
    // pose for everything seen at rest. That keeps the resting cube (the state on
    // screen between turns, and the most scrutinised) perfectly occluded; a turn's
    // brief mid-rotation overlaps may misorder, but those flash by.
    const repK = Math.max(0, vis.findIndex((v) => v));
    const fr = frames[repK], el = fr.elems[idx];
    const depth = el.quad.reduce((s, p) => s + view.depth(p, fr.pose), 0) / 4;
    items.push({ idx, pts, vis, cols, depth, black: !!el.black });
  }
  // per-frame visible sticker count (for the log / guard)
  const perFrameVis = new Array(F).fill(0);
  for (let k = 0; k < F; k++) for (const it of items) if (!it.black && it.vis[k]) perFrameVis[k]++;
  // Paint far→near. 'blackFirst' (rigid shell): all black backings, then all
  // stickers — a convex cube never overlaps its own front faces, and this keeps a
  // face's backing from covering its far-half stickers. 'depth' (solid cubies):
  // one interleaved depth sort, since a turning slab is non-convex and a black
  // cubie wall must be free to occlude a farther sticker; each sticker sits a hair
  // proud of its own face so it still sorts just above it.
  const byDepth = (a, b) => a.depth - b.depth;
  const ordered = paint === 'depth'
    ? items.slice().sort(byDepth)
    : items.filter((it) => it.black).sort(byDepth).concat(items.filter((it) => !it.black).sort(byDepth));

  const polyParts = [], animParts = [];
  for (const it of ordered) {
    const id = `p${it.idx}`;
    polyParts.push(`      <polygon id="${id}" points="${it.pts[0]}" fill="${it.cols[0]}" opacity="${it.vis[0]}"/>`);
    animParts.push(animAttr(id, 'points', dur, keyTimes, it.pts.join(';')));
    if (!it.vis.every((v) => v === 1)) animParts.push(animAttr(id, 'opacity', dur, keyTimes, it.vis.join(';'), 'discrete'));
    if (it.cols.some((c) => c !== it.cols[0])) animParts.push(animAttr(id, 'fill', dur, keyTimes, it.cols.join(';'), 'discrete'));
  }
  stats.minVis = Math.min(...perFrameVis);
  stats.maxVis = Math.max(...perFrameVis);
  return { polys: polyParts.join('\n'), anims: animParts.join('\n'), stats };
}

// pleasant 3/4 resting pose (front + a side + top all visible)
const POSE_3Q = rotY(38 * DEG);

// ── Frame builders ──
// rigid pose track: whole cube posed by poseAt(t), solved scene shared each frame
function poseFrames(poseAt, frames, { offAt } = {}) {
  const elems = rigidElems();
  const out = [];
  for (let k = 0; k <= frames; k++) {
    const t = k / frames;
    out.push({ elems, pose: poseAt(t), off: offAt ? offAt(t) : null });
  }
  return out;
}

// layer-turn track. moveScript = [{ axis,'x'|'y'|'z', layer:-1|0|1, dir:±1,
// frames:n, hold:n }]. Whole cubies rotate and settle permanently, so multi-move
// sequences (solves) stay correct, and a turning layer is always a solid slab.
function turnFrames(moveScript, pose, { restFrames = 0 } = {}) {
  let cur = buildCubies();
  const frames = [];
  const push = (cubies) => frames.push({ elems: cubieElems(cubies), pose, off: null });
  for (let r = 0; r < restFrames; r++) push(cur);
  for (const m of moveScript) {
    const { axis, layer, dir, frames: mf = 6, hold = 0 } = m;
    const ai = AXIS_IDX[axis];
    const inLayer = (cb) => Math.round(cb.center[ai] / STEP) === layer;
    for (let f = 1; f <= mf; f++) {
      const Mx = ROT_AXIS[axis](dir * (Math.PI / 2) * easeInOut(f / mf));
      push(cur.map((cb) => (inLayer(cb) ? rotCubie(cb, Mx) : cb)));
    }
    const M90 = ROT_AXIS[axis]((dir * Math.PI) / 2);
    cur = cur.map((cb) => (inLayer(cb) ? rotCubie(cb, M90) : cb));
    for (let h = 0; h < hold; h++) push(cur);
  }
  for (let r = 0; r < restFrames; r++) push(cur);
  return frames;
}
const invert = (moves) => moves.slice().reverse().map((m) => ({ ...m, dir: -m.dir }));
const Mv = (axis, layer, dir) => ({ axis, layer, dir });
const DEFAULT_SCRAMBLE = [Mv('x', 1, 1), Mv('y', 1, -1), Mv('z', 1, 1), Mv('x', 1, -1), Mv('y', 1, 1)];

// colour-flicker track: pose static, sticker colours animate through `stages`.
function flickerFrames(stages, pose, framesPerStage = 1) {
  const backs = rigidElems().filter((e) => e.black);
  const cellTpl = rigidElems().filter((e) => !e.black);
  const frames = [];
  for (const stage of stages) {
    const elems = backs.concat(cellTpl.map((e, i) => ({ ...e, color: stage[i] || e.color })));
    for (let f = 0; f < framesPerStage; f++) frames.push({ elems, pose, off: null });
  }
  return frames;
}

// =====================================================================
// Motion builders — each returns { polys, anims, stats }.
// =====================================================================

export function spin({ dur = '9s', frames = 36, turns = 1, dir = 1, view: vo = {} } = {}) {
  return renderTrack(poseFrames((t) => rotY(dir * TAU * turns * t), frames), makeView(vo), { dur });
}
export const spinShowcase = spin; // alias for the existing a02-faceturn row

// eased spin that snaps through detents (ratchet)
export function spinSnap({ dur = '8s', steps = 8, framesPerStep = 5, view: vo = {} } = {}) {
  const elems = rigidElems();
  const frames = [];
  for (let s = 0; s < steps; s++) for (let f = 0; f < framesPerStep; f++) {
    const local = easeInOut(Math.min(1, f / Math.max(1, framesPerStep - 2)));
    frames.push({ elems, pose: rotY((TAU * (s + local)) / steps), off: null });
  }
  frames.push({ elems, pose: rotY(TAU), off: null });
  return renderTrack(frames, makeView(vo), { dur });
}

// gentle small-angle oscillation about vertical (lazy idle)
export function sway({ dur = '7s', frames = 48, amp = 22, view: vo = {} } = {}) {
  return renderTrack(poseFrames((t) => mul(POSE_3Q, rotY(amp * DEG * Math.sin(TAU * t))), frames), makeView(vo), { dur });
}

// oscillate between two faces
export function twoFaceSpin({ dur = '6s', frames = 48, a = -50, b = 50, view: vo = {} } = {}) {
  const mid = (a + b) / 2, half = (b - a) / 2;
  return renderTrack(poseFrames((t) => rotY((mid + half * Math.sin(TAU * t)) * DEG), frames), makeView(vo), { dur });
}

// flip about a horizontal axis (top tumbles over)
export function flip({ dur = '6s', frames = 40, axis = 'x', turns = 1, dir = 1, base = POSE_3Q, view: vo = {} } = {}) {
  return renderTrack(poseFrames((t) => mul(ROT_AXIS[axis](dir * TAU * turns * t), base), frames), makeView({ scale: 0.8, ...vo }), { dur });
}

// sideways tumble across the table: roll about Z while translating in screen x
export function roll({ dur = '7s', frames = 44, span = 1.3, turns = 1, view: vo = {} } = {}) {
  return renderTrack(
    poseFrames((t) => rotZ(-TAU * turns * t), frames, { offAt: (t) => [span * (t - 0.5) * 2, 0] }),
    makeView({ scale: 0.72, ...vo }), { dur },
  );
}

// stop-motion: hold a few posed frames, hard cuts
export function snapFrames({ dur = '6s', angles = [0, 35, 90, 145, 200, 270, 325, 360], framesPerHold = 3, view: vo = {} } = {}) {
  const elems = rigidElems();
  const frames = [];
  for (const a of angles) for (let f = 0; f < framesPerHold; f++) frames.push({ elems, pose: rotY(a * DEG), off: null });
  return renderTrack(frames, makeView(vo), { dur });
}

// single / oscillating layer turn in an occlusion-friendly view
export function layerTurn({
  dur = '5s', move = { axis: 'y', layer: 1, dir: 1 }, frames = 9,
  mode = 'oscillate', pose = POSE_3Q, rest = 4, view: vo = {},
} = {}) {
  const script = mode === 'oscillate'
    ? [{ ...move, frames, hold: 3 }, { ...move, dir: -move.dir, frames, hold: 3 }]
    : [{ ...move, frames, hold: 3 }];
  return renderTrack(turnFrames(script, pose, { restFrames: rest }), makeView(vo), { dur, paint: 'depth' });
}

// scramble then solve (a move sequence then its inverse) — loops solved
export function solve({ dur = '11s', moves, framesPerMove = 5, pose = POSE_3Q, view: vo = {} } = {}) {
  const seq = moves || DEFAULT_SCRAMBLE;
  const script = seq.map((m) => ({ ...m, frames: framesPerMove, hold: 1 }))
    .concat(invert(seq).map((m) => ({ ...m, frames: framesPerMove, hold: 1 })));
  return renderTrack(turnFrames(script, pose, { restFrames: 4 }), makeView(vo), { dur, paint: 'depth' });
}

// colour flicker: scramble the stickers then resolve to solved (reveal) or v.v.
export function flicker({ dur = '6s', stages = 7, reveal = true, framesPerStage = 3, pose = POSE_3Q, seed = 7, view: vo = {} } = {}) {
  const cells = rigidElems().filter((e) => !e.black);
  const solved = cells.map((e) => e.color);
  const palette = FACE_LIST.map((f) => hexShade(WCA[f], 0.95));
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const stageList = [];
  for (let st = 0; st < stages; st++) {
    const mix = reveal ? st / (stages - 1) : 1 - st / (stages - 1); // 0 scrambled .. 1 solved
    stageList.push(cells.map((_, i) => (rnd() < mix ? solved[i] : palette[Math.floor(rnd() * 6)])));
  }
  if (reveal) stageList[stageList.length - 1] = solved.slice(); else stageList[0] = solved.slice();
  return renderTrack(flickerFrames(stageList, pose, framesPerStage), makeView(vo), { dur });
}

// character beat: held cube (gentle pose) while the body emotes via a CSS mood
export function beat({ dur = '6s', frames = 36, motion = 'sway', amp = 14, turns = 1, view: vo = {} } = {}) {
  let poseAt;
  if (motion === 'spin') poseAt = (t) => rotY(TAU * turns * t);
  else if (motion === 'still') poseAt = () => POSE_3Q;
  else poseAt = (t) => mul(POSE_3Q, rotY(amp * DEG * Math.sin(TAU * t)));
  return renderTrack(poseFrames(poseAt, frames), makeView(vo), { dur });
}

// ── Bounds guard: keep the cube off Clawd's eyes (x ~4.5–10.5) and legs (y≥13). ──
export function assertClear(stats, label = 'cube') {
  const problems = [];
  if (stats.nan) problems.push('NaN coordinates');
  if (stats.minX <= 4.6) problems.push(`minX ${stats.minX.toFixed(2)} ≤ 4.6 (left eye)`);
  if (stats.maxX >= 10.4) problems.push(`maxX ${stats.maxX.toFixed(2)} ≥ 10.4 (right eye)`);
  if (stats.maxY >= 13) problems.push(`maxY ${stats.maxY.toFixed(2)} ≥ 13 (legs)`);
  if (problems.length) throw new Error(`[${label}] cube out of bounds: ${problems.join('; ')}`);
}

// ── Body-mood presets for character beats. Each adds @keyframes + a `.beat`
//    wrapper that transforms the whole figure (the cube rides along in the claws). ──
const MOODS = {
  jump: { css: `@keyframes beatJump { 0%,18%{transform:translateY(0);} 30%{transform:translateY(-3.2px) scaleY(1.04);} 46%{transform:translateY(0);} 58%{transform:translateY(-1.2px);} 70%,100%{transform:translateY(0);} }`, anim: 'beatJump 1.6s infinite ease-out' },
  cheer: { css: `@keyframes beatCheer { 0%,100%{transform:translateY(0) rotate(0);} 25%{transform:translateY(-1.4px) rotate(-2deg);} 75%{transform:translateY(-1.4px) rotate(2deg);} }`, anim: 'beatCheer 1.8s infinite ease-in-out' },
  dance: { css: `@keyframes beatDance { 0%,100%{transform:translateX(0) rotate(-3deg);} 50%{transform:translateX(0) rotate(3deg);} }`, anim: 'beatDance 1.2s infinite ease-in-out' },
  peek: { css: `@keyframes beatPeek { 0%,30%{transform:translateX(2.4px);} 50%,70%{transform:translateX(-2.4px);} 100%{transform:translateX(2.4px);} }`, anim: 'beatPeek 4s infinite ease-in-out' },
  startle: { css: `@keyframes beatStartle { 0%,12%{transform:translateY(0) scale(1);} 18%{transform:translateY(-2px) scale(1.05);} 26%{transform:translateY(0) scale(1);} 60%,100%{transform:translateY(0) scale(1);} }`, anim: 'beatStartle 2.4s infinite ease-out' },
  shy: { css: `@keyframes beatShy { 0%,100%{transform:translateX(0) rotate(0);} 40%,60%{transform:translateX(-1.6px) rotate(-3deg);} }`, anim: 'beatShy 3.4s infinite ease-in-out' },
};

// ── Clawd body shell: torso/eyes/legs/arms copied verbatim from the original
//    native art (one pixel unchanged). Cube polys go inside .breathe (after the
//    arms → reads as held in front); SMIL animates sit in a trailing <g>. An
//    optional `mood` adds a body-wide CSS beat for the a09/a10 characters. ──
export function wrapSvg({ polys, anims, label = 'cube', mood = null }) {
  const m = mood && MOODS[mood];
  const moodCss = m ? `\n      ${m.css}\n      .beat { transform-box: view-box; transform-origin: 7.5px 12px; animation: ${m.anim}; }` : '';
  const openBeat = m ? '<g class="beat">' : '';
  const closeBeat = m ? '</g>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-15 -25 45 45" width="500" height="500">
  <!--
    ${label} — Clawd holding a standard 3x3 cube (WCA colours).
    Generated by scripts/deskpet-cube. Do not hand-edit; edit the engine/config and rebuild.
  -->
  <defs>
    <style>
      #ground-shadow { transform-box: view-box; transform-origin: 7.5px 15.5px; animation: sh1 8s infinite ease-in-out; }
      .breathe { transform-box: view-box; transform-origin: 7.5px 13px; animation: br1 8s infinite ease-in-out; }
      .arm-l { transform-box: fill-box; transform-origin: 100% 50%; animation: arml1 8s infinite ease-in-out; }
      .arm-r { transform-box: fill-box; transform-origin: 0% 50%; animation: armr1 8s infinite ease-in-out; }
      .eyes { transform-box: view-box; transform-origin: 7.5px 9px; animation: ey1 8s infinite ease-in-out; }
      @keyframes sh1 { 0%,100%{opacity:.5;transform:scaleX(1);} 50%{opacity:.46;transform:scaleX(.97);} }
      @keyframes br1 { 0%,100%{transform:scale(1,1) translateY(0);} 50%{transform:scale(1.008,.992) translateY(.12px);} }
      @keyframes arml1 { 0%,100%{transform:rotate(8deg) translateY(-.1px);} 50%{transform:rotate(11deg) translateY(.05px);} }
      @keyframes armr1 { 0%,100%{transform:rotate(-8deg) translateY(-.1px);} 50%{transform:rotate(-11deg) translateY(.05px);} }
      @keyframes ey1 { 0%,100%{transform:translateX(.18px);} 25%{transform:translateX(.05px);} 50%{transform:translateX(-.18px);} 75%{transform:translateX(.05px);} }${moodCss}
    </style>
  </defs>

  <rect id="ground-shadow" x="3" y="15" width="9" height="1" fill="#000" opacity="0.5"/>

  ${openBeat}<g fill="#DE886D">
    <rect x="3" y="13" width="1" height="2"/><rect x="5" y="13" width="1" height="2"/>
    <rect x="9" y="13" width="1" height="2"/><rect x="11" y="13" width="1" height="2"/>
  </g>

  <g class="breathe">
    <rect x="2" y="6" width="11" height="7" fill="#DE886D"/>
    <g class="eyes" fill="#000">
      <rect x="4" y="8" width="1" height="2"/>
      <rect x="10" y="8" width="1" height="2"/>
    </g>
    <g class="arm-l" fill="#DE886D"><rect x="0" y="10.2" width="2" height="2"/><rect x="1.6" y="10.6" width="2" height="1.3"/></g>
    <g class="arm-r" fill="#DE886D"><rect x="13" y="10.2" width="2" height="2"/><rect x="11.4" y="10.6" width="2" height="1.3"/></g>

    <!-- ===== standard 3x3 cube ===== -->
    <g id="cube">
${polys}
    </g>
  </g>${closeBeat}

  <g>
${anims}
  </g>
</svg>
`;
}
