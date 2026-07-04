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
// GAP halved from the old 0.03 to 0.016 so the dark box faces of two adjacent
// cubies nearly meet: the same-face grout shrinks to ~0.032 (a thin dark line) and
// no longer lets the salmon background bleed through at rest (the seam-tone
// must-fix). The cubie boxes still strictly DON'T overlap (HSZ < 0.5), so the
// proven occlusion is untouched. The turn-opened gap (2*GAP) stays a visible dark
// recess; its real depth/form comes from the slab underside + dark core, not this.
const GAP = 0.016; // half the black plastic gap between adjacent cubies
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
// 26 cubies; each = 6 black box faces + an inset sticker on each exterior face.
// PLUS a 27th centre cubie kept as black-only "core" plastic. Normally hidden,
// it is exposed only through a turning layer's gap — so a gap shows a solid dark
// core (recessed plastic with form) instead of seeing straight through to the
// background. Its faces are exposure-culled like any other, so it costs nothing
// at rest and only appears where a turn opens it up. Exterior faces are tagged
// `ext` so the exposure cull never drops them (they're skin).
function buildCubies(colors = WCA) {
  const cubies = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const isCore = !i && !j && !k;
    const c = [i * STEP, j * STEP, k * STEP], faces = [];
    for (const d of FACE_DIRS) {
      const ext = (d.n[0] && i === d.n[0]) || (d.n[1] && j === d.n[1]) || (d.n[2] && k === d.n[2]);
      // Exterior cubie face = HSZ dark box face (its own dark plastic surface) +
      // an inset colour sticker 0.006 proud. The same-face grout between two
      // adjacent cubies is the thin GAP (now narrow; see GAP) so the dark box
      // faces nearly meet and the seam reads as dark recessed plastic, not the
      // salmon background. Interior walls also kept at HSZ for the turn-gap form.
      faces.push({ quad: boxFace(c, HSZ, d.n), normal: d.n.slice(), color: hexShade(PLASTIC, PLASTIC_SHADE[d.f]), black: true, ext: ext && !isCore });
      if (ext && !isCore) faces.push({
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
  faces: cb.faces.map((fa) => ({ quad: fa.quad.map((p) => mv(M, p)), normal: mv(M, fa.normal), color: fa.color, black: fa.black, ext: fa.ext })),
});
// Flatten cubies → faces, tagging each face with its parent cubie centre and the
// 3D centre of the face quad. Exposure culling (drop buried interior black faces)
// needs both: a face is buried iff another cubie sits flush against it.
const cubieElems = (cubies) => cubies.flatMap((cb) =>
  cb.faces.map((fa) => {
    const fc = [
      (fa.quad[0][0] + fa.quad[1][0] + fa.quad[2][0] + fa.quad[3][0]) / 4,
      (fa.quad[0][1] + fa.quad[1][1] + fa.quad[2][1] + fa.quad[3][1]) / 4,
      (fa.quad[0][2] + fa.quad[1][2] + fa.quad[2][2] + fa.quad[3][2]) / 4,
    ];
    return { ...fa, cubieCenter: cb.center, faceCenter: fc };
  }));

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
export const POSE_3Q = rotY(38 * DEG);

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
// frames:n, hold:n, q:1|2 (quarter turns — q:2 is a 180° double move) }]. Whole
// cubies rotate and settle permanently, so multi-move sequences (solves) stay
// correct, and a turning layer is always a solid slab.
export function turnFrames(moveScript, pose, { restFrames = 0 } = {}) {
  let cur = buildCubies();
  const frames = [];
  const push = (cubies) => frames.push({ elems: cubieElems(cubies), pose, off: null, centers: cubies.map((cb) => cb.center) });
  for (let r = 0; r < restFrames; r++) push(cur);
  for (const m of moveScript) {
    const { axis, layer, dir, frames: mf = 6, hold = 0, q = 1 } = m;
    const ai = AXIS_IDX[axis];
    const inLayer = (cb) => Math.round(cb.center[ai] / STEP) === layer;
    for (let f = 1; f <= mf; f++) {
      const Mx = ROT_AXIS[axis](dir * q * (Math.PI / 2) * easeInOut(f / mf));
      push(cur.map((cb) => (inLayer(cb) ? rotCubie(cb, Mx) : cb)));
    }
    const M90 = ROT_AXIS[axis]((dir * q * Math.PI) / 2);
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
  const view = makeView(vo);
  const poseAt = (t) => rotY(dir * TAU * turns * t);
  const r = renderTrack(poseFrames(poseAt, frames), view, { dur });
  return addClaws(r, clawSwipeEvents(poseAt, view, { pushes: Math.max(2, 2 * turns), durS: parseFloat(dur) }), dur);
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
  const view = makeView(vo);
  const total = steps * framesPerStep + 1;
  const events = clawSwipeEvents((t) => rotY(TAU * t), view, {
    times: Array.from({ length: steps }, (_, s) => (s * framesPerStep) / total),
    winFrac: (framesPerStep - 2) / total, durS: parseFloat(dur),
  });
  return addClaws(renderTrack(frames, view, { dur }), events, dur);
}

// gentle small-angle oscillation about vertical (lazy idle)
export function sway({ dur = '7s', frames = 48, amp = 22, view: vo = {} } = {}) {
  const view = makeView(vo);
  const poseAt = (t) => mul(POSE_3Q, rotY(amp * DEG * Math.sin(TAU * t)));
  const r = renderTrack(poseFrames(poseAt, frames), view, { dur });
  // pushes at the two velocity maxima (t≈0 and t≈0.5), one claw each way
  return addClaws(r, clawSwipeEvents(poseAt, view, { times: [0.03, 0.53], durS: parseFloat(dur) }), dur);
}

// oscillate between two faces
export function twoFaceSpin({ dur = '6s', frames = 48, a = -50, b = 50, view: vo = {} } = {}) {
  const mid = (a + b) / 2, half = (b - a) / 2;
  const view = makeView(vo);
  const poseAt = (t) => rotY((mid + half * Math.sin(TAU * t)) * DEG);
  const r = renderTrack(poseFrames(poseAt, frames), view, { dur });
  return addClaws(r, clawSwipeEvents(poseAt, view, { times: [0.02, 0.52], durS: parseFloat(dur) }), dur);
}

// flip about a horizontal axis (top tumbles over)
export function flip({ dur = '6s', frames = 40, axis = 'x', turns = 1, dir = 1, base = POSE_3Q, view: vo = {} } = {}) {
  const view = makeView({ scale: 0.8, ...vo });
  const poseAt = (t) => mul(ROT_AXIS[axis](dir * TAU * turns * t), base);
  const r = renderTrack(poseFrames(poseAt, frames), view, { dur });
  return addClaws(r, clawSwipeEvents(poseAt, view, { pushes: 2 * turns, durS: parseFloat(dur) }), dur);
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

// single / oscillating layer turn in an occlusion-friendly view.
// Routed through the FLIPBOOK renderer: a layer turn opens a non-convex gap, so a
// single fixed paint order is wrong mid-rotation; the flipbook draws every frame
// as its own correctly depth-sorted set (correct by construction).
// Frame track for a layerTurn config (exported so the verifier rebuilds the
// EXACT same frames the renderer consumes — no drift between build and verify).
const layerScript = (move, frames, mode) => mode === 'oscillate'
  ? [{ ...move, frames, hold: 3 }, { ...move, dir: -move.dir, frames, hold: 3 }]
  : [{ ...move, frames, hold: 3 }];
export function layerTurnFrames({ move = { axis: 'y', layer: 1, dir: 1 }, frames = 9, mode = 'oscillate', pose = POSE_3Q, rest = 4 } = {}) {
  return turnFrames(layerScript(move, frames, mode), pose, { restFrames: rest });
}
export function layerTurn({
  dur = '5s', move = { axis: 'y', layer: 1, dir: 1 }, frames = 9,
  mode = 'oscillate', pose = POSE_3Q, rest = 4, view: vo = {},
} = {}) {
  const script = layerScript(move, frames, mode);
  const view = makeView(vo);
  const r = renderFlip(turnFrames(script, pose, { restFrames: rest }), view, { dur });
  return addClaws(r, clawGripEvents(script, pose, view, { restFrames: rest }), dur);
}

// Notation demo: repeat one WCA move until the cube returns to solved so the
// loop is seamless — 4 reps for a quarter turn, 2 for a half turn (q:2). Same
// flipbook + claw-grip treatment as layerTurn; the claw re-grips each rep.
// `claw` assigns the move to ONE claw: it alone approaches/follows every rep,
// while the other claw holds the cube perfectly still (no waggle, no gestures —
// wrapSvg drops its .arm-* class via the returned stillClaw).
export function moveDemo({ dur, move, q = 1, frames, hold = 4, rest = 3, claw = null, pose = POSE_3Q, view: vo = {} } = {}) {
  const reps = q === 2 ? 2 : 4;
  const mf = frames ?? (q === 2 ? 13 : 9);
  const d = dur ?? (q === 2 ? '6s' : '8s');
  const script = Array.from({ length: reps }, () => ({ ...move, q, frames: mf, hold }));
  const view = makeView(vo);
  const r = renderFlip(turnFrames(script, pose, { restFrames: rest }), view, { dur: d });
  const out = addClaws(r, clawGripEvents(script, pose, view, { restFrames: rest, followFrac: q === 2 ? 0.6 : 0.75, forceClaw: claw }), d);
  return claw ? { ...out, stillClaw: claw === 'l' ? 'r' : 'l' } : out;
}

// scramble then solve (a move sequence then its inverse) — loops solved.
// FLIPBOOK renderer (see layerTurn): glitch-free occlusion across the whole turn.
export function solve({ dur = '11s', moves, framesPerMove = 4, pose = POSE_3Q, view: vo = {} } = {}) {
  const seq = moves || DEFAULT_SCRAMBLE;
  const script = seq.map((m) => ({ ...m, frames: framesPerMove, hold: 1 }))
    .concat(invert(seq).map((m) => ({ ...m, frames: framesPerMove, hold: 1 })));
  const view = makeView(vo);
  const r = renderFlip(turnFrames(script, pose, { restFrames: 4 }), view, { dur });
  return addClaws(r, clawGripEvents(script, pose, view, { restFrames: 4 }), dur);
}

// =====================================================================
// FLIPBOOK renderer (correct-by-construction occlusion).
//
// renderTrack keeps one stable element identity across the whole track and is
// forced to pick ONE document order; SMIL cannot reorder, so a non-convex
// mid-turn slab gets the wrong paint order on some frames. The flipbook trades
// that away: every frame is rendered as its OWN complete, independently
// depth-sorted set of <polygon>s, wrapped in a <g> that is only opacity:1 during
// that frame's time-slice (discrete SMIL). Because each frame is sorted on its
// own true depths, occlusion is right BY CONSTRUCTION — there is no shared order
// to be wrong. Cost: stepped motion (mitigated by more frames) + bytes
// (mitigated by dropping culled polys + gzip).
// =====================================================================

// ── exact per-pixel painter ordering helpers ──
// A centroid depth-sort is WRONG when two overlapping quads' depth order flips
// across their overlap (the slab juts out mid-turn): the farther-at-the-overlap
// quad must be drawn first regardless of which centroid is nearer. So we build a
// true partial order from per-pixel depth at the overlap and topologically sort.
function _bary(p, a, b, c) {
  const v0x = b[0] - a[0], v0y = b[1] - a[1];
  const v1x = c[0] - a[0], v1y = c[1] - a[1];
  const v2x = p[0] - a[0], v2y = p[1] - a[1];
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < 1e-12) return null;
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  const u = 1 - v - w;
  if (u < -1e-9 || v < -1e-9 || w < -1e-9) return null;
  return [u, v, w];
}
// depth of screen point p on a quad (corners q, per-corner depths d); null if off
function _quadDepthAt(p, q, d) {
  let b = _bary(p, q[0], q[1], q[2]);
  if (b) return b[0] * d[0] + b[1] * d[1] + b[2] * d[2];
  b = _bary(p, q[0], q[2], q[3]);
  if (b) return b[0] * d[0] + b[1] * d[2] + b[2] * d[3];
  return null;
}
function _bbox(q) {
  let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
  for (const [x, y] of q) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > e) e = y; }
  return [a, b, c, e];
}
// Sutherland–Hodgman: clip convex polygon `subject` against convex `clip`.
// Returns the (convex) intersection polygon (possibly empty). Both CCW or CW is
// fine as long as `clip` is convex (our quads are). Uses signed area sign of clip
// to orient the inside half-plane test.
function _clipPoly(subject, clip) {
  // determine clip winding (sign of its signed area)
  let area2 = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  const wind = area2 >= 0 ? 1 : -1; // +1 CCW
  let out = subject;
  for (let c = 0; c < clip.length; c++) {
    if (out.length === 0) break;
    const a = clip[c], b = clip[(c + 1) % clip.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const inside = (p) => wind * (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) >= -1e-12;
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prv = input[(i + input.length - 1) % input.length];
      const ci = inside(cur), pi = inside(prv);
      if (ci) {
        if (!pi) out.push(_lineIntersect(prv, cur, a, b));
        out.push(cur);
      } else if (pi) {
        out.push(_lineIntersect(prv, cur, a, b));
      }
    }
  }
  return out;
}
function _lineIntersect(p1, p2, p3, p4) {
  const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-15) return p2.slice();
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}
function _polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}
function _polyCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}
// Decide draw order for a pair (A,B) by EXACT polygon intersection. Compute the
// convex overlap region; if it has real area, compare each quad's true depth at
// the overlap centroid (and a few interior points to be safe). Returns -1 if A
// must be drawn BEFORE B (A is behind), +1 if A AFTER B (A nearer), 0 if no real
// area overlap (separated or mere edge touch → no constraint). For a cube of
// separated boxes the depth order is constant over the whole overlap, so the
// centroid sample is exact; we still sample the overlap's vertices to be robust.
function _pairOrder(A, B) {
  const ba = _bbox(A.quad), bb = _bbox(B.quad);
  if (ba[2] <= bb[0] + 1e-9 || bb[2] <= ba[0] + 1e-9 || ba[3] <= bb[1] + 1e-9 || bb[3] <= ba[1] + 1e-9) return 0;
  const inter = _clipPoly(A.quad, B.quad);
  if (inter.length < 3) return 0;
  if (_polyArea(inter) < 1e-7) return 0; // sliver / edge touch → no real overlap
  // sample points: centroid + each intersection vertex pulled slightly inward.
  const ctr = _polyCentroid(inter);
  const pts = [ctr];
  for (const v of inter) pts.push([(v[0] + ctr[0]) / 2, (v[1] + ctr[1]) / 2]);
  let nearA = 0, nearB = 0, maxSep = 0, maxSign = 0;
  for (const p of pts) {
    const da = _quadDepthAt(p, A.quad, A.dz);
    const db = _quadDepthAt(p, B.quad, B.dz);
    if (da === null || db === null) continue;
    const diff = da - db;
    if (diff > 1e-9) nearA++; else if (diff < -1e-9) nearB++;
    if (Math.abs(diff) > maxSep) { maxSep = Math.abs(diff); maxSign = Math.sign(diff); }
  }
  if (nearA === 0 && nearB === 0) return 0;
  const sign = (nearA === nearB) ? maxSign : (nearA > nearB ? 1 : -1);
  return sign > 0 ? 1 : -1; // +1: A nearer → A after B. -1: A farther → A before B.
}

// project + cull + EXACT-order ONE frame into a list of {quad,color,depth,...}
// `front-facing` = normal points at camera; back-facing polys are dropped.
export function frameItems(frame, view) {
  // Exposure cull: a black box face is buried when another cubie sits flush
  // against it (neighbour centre is one STEP out along the face normal). Those
  // interior faces never show a pixel yet tangle in depth (black-on-black
  // z-fighting). We drop them. faceCentre + normal*STEP lands on the neighbour
  // centre iff buried; a small tolerance covers the mid-turn easing. Stickers and
  // exterior black faces are always kept. We need the per-frame cubie centres.
  const centers = frame.centers || null;
  const STEP_ = STEP; // 1.0
  const buried = (el) => {
    if (!el.black || el.ext || !centers || !el.faceCenter) return false; // exterior skin plates are never buried
    const n = el.normal, fc = el.faceCenter;
    // neighbour centre = faceCentre + n*(STEP - HSZ) = faceCentre + n*(0.5+GAP)
    const d = STEP_ - HSZ; // 0.5 + GAP
    const px = fc[0] + n[0] * d, py = fc[1] + n[1] * d, pz = fc[2] + n[2] * d;
    for (const c of centers) {
      const dx = c[0] - px, dy = c[1] - py, dz2 = c[2] - pz;
      if (dx * dx + dy * dy + dz2 * dz2 < 0.06 * 0.06) return true; // a cubie is flush → buried
    }
    return false;
  };
  const items = [];
  for (const el of frame.elems) {
    if (!view.normalVisible(el.normal, frame.pose)) continue; // back-facing → skip
    if (buried(el)) continue; // interior black face flush against a neighbour → skip
    const quad = el.quad.map((p) => view.project(p, frame.pose, frame.off));
    const dz = el.quad.map((p) => view.depth(p, frame.pose));
    const depth = (dz[0] + dz[1] + dz[2] + dz[3]) / 4;
    items.push({ quad, dz, depth, color: el.color, black: !!el.black, normal: el.normal });
  }
  const n = items.length;
  // First pass: cheap, stable centroid order (far→near). This is the order we
  // KEEP wherever two quads don't overlap (it's free), and a good starting point.
  for (let i = 0; i < n; i++) items[i]._k = i;
  items.sort((a, b) => (a.depth - b.depth) || ((a.black === b.black) ? 0 : (a.black ? -1 : 1)) || (a._k - b._k));

  // Build the must-precede graph from true overlap depth. edge u→v means u must
  // be painted before v (u is behind v at their overlap).
  const adj = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ord = _pairOrder(items[i], items[j]);
      if (ord === 0) continue;
      // ord<0: i before j ; ord>0: j before i
      const [u, v] = ord < 0 ? [i, j] : [j, i];
      adj[u].push(v); indeg[v]++;
    }
  }
  // Kahn topological sort; among ready nodes prefer the smaller centroid depth
  // (keeps motion/order stable & close to the natural far→near look).
  const ready = [];
  const pushReady = (x) => {
    // insertion by depth then original index (stable)
    let lo = 0, hi = ready.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const c = ready[mid];
      if (items[c].depth < items[x].depth || (items[c].depth === items[x].depth && c < x)) lo = mid + 1; else hi = mid;
    }
    ready.splice(lo, 0, x);
  };
  for (let i = 0; i < n; i++) if (indeg[i] === 0) pushReady(i);
  const order = [];
  while (ready.length) {
    const x = ready.shift();
    order.push(x);
    for (const v of adj[x]) if (--indeg[v] === 0) pushReady(v);
  }
  // If a cycle ever appears (shouldn't for separated solids), fall back to the
  // centroid order for the leftovers so we never drop polygons.
  if (order.length < n) {
    const seen = new Set(order);
    for (let i = 0; i < n; i++) if (!seen.has(i)) order.push(i);
  }
  return order.map((i) => items[i]);
}

// Render a frame track as a flipbook. Returns { polys, anims, stats, frameItems }.
// `frameItems` (array of per-frame ordered item lists) is handed to the verifier
// so it checks the EXACT polygons + EXACT order the SVG paints.
export function renderFlip(frames, view, { dur = '9s' } = {}) {
  const F = frames.length;
  const stats = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, nan: false, minVis: 99, maxVis: 0 };

  // 1) Compute each frame's ordered, projected, depth-sorted polygon list.
  const perItems = [];
  for (let k = 0; k < F; k++) {
    const items = frameItems(frames[k], view);
    perItems.push(items);
    let visCount = 0;
    for (const it of items) {
      if (!it.black) visCount++;
      for (const [sx, sy] of it.quad) {
        if (Number.isNaN(sx) || Number.isNaN(sy)) stats.nan = true;
        stats.minX = Math.min(stats.minX, sx); stats.maxX = Math.max(stats.maxX, sx);
        stats.minY = Math.min(stats.minY, sy); stats.maxY = Math.max(stats.maxY, sy);
      }
    }
    stats.minVis = Math.min(stats.minVis, visCount);
    stats.maxVis = Math.max(stats.maxVis, visCount);
  }

  // 2) Serialize each frame to its body string, then COALESCE byte-identical
  //    consecutive frames (rest/settled holds are identical) into one shared <g>.
  //    A group covers a contiguous run of frame indices; its body is emitted once
  //    and shown across all those slots. This is a pure size win — the painted
  //    polygons+order per frame are unchanged. (We coalesce only *consecutive*
  //    equal frames so each group maps to one contiguous time-slice, keeping the
  //    discrete-opacity schedule and the verifier's frame→group map trivial.)
  const bodyOf = (items) => items.map((it) => `      <polygon points="${ptsStr(it.quad)}" fill="${it.color}"/>`).join('\n');
  const bodies = perItems.map(bodyOf);
  const groups = []; // { body, start, end }  end exclusive
  for (let k = 0; k < F; k++) {
    const last = groups[groups.length - 1];
    if (last && bodies[k] === last.body) { last.end = k + 1; }
    else groups.push({ body: bodies[k], start: k, end: k + 1 });
  }

  // 3) Discrete time grid over [0,1]; slot k spans [k/F,(k+1)/F). A group active
  //    over [start,end) turns on at start/F and off at end/F. We emit a COMPACT
  //    opacity track: only the on/off transition keyTimes for that group, not one
  //    keyTime per frame. (group 0, which includes the rest at t=0, also closes
  //    the loop: it's on at t=0 and back on at t=1.)
  const frameToGroup = new Array(F);
  groups.forEach((g, gi) => { for (let k = g.start; k < g.end; k++) frameToGroup[k] = gi; });
  const t = (slot) => (slot / F).toFixed(5);
  const polyParts = [];
  const animParts = [];
  groups.forEach((g, gi) => {
    const gid = `f${gi}`;
    const initOn = g.start === 0; // group covering t=0 starts visible
    polyParts.push(`    <g id="${gid}" opacity="${initOn ? '1' : '0'}">\n${g.body}\n    </g>`);
    // compact discrete schedule: keyTimes at 0, start, end (and 1). values are the
    // group's opacity in each interval. Always include 0 and 1 endpoints.
    const kts = [], vals = [];
    const on = (slot) => slot >= g.start && slot < g.end;
    // walk transition points: 0, start, end, F (=1). Dedup.
    const cuts = Array.from(new Set([0, g.start, g.end, F])).sort((a, b) => a - b);
    for (let ci = 0; ci < cuts.length; ci++) {
      const slot = cuts[ci];
      kts.push(t(slot));
      // value that takes effect AT this keyTime and holds until the next: opacity
      // during [slot, nextcut) = on(slot) ? 1 : 0. The very last keyTime (t=1)
      // just needs to match the loop start (slot 0) so the wrap is seamless.
      const valSlot = slot >= F ? 0 : slot;
      vals.push(on(valSlot) ? '1' : '0');
    }
    animParts.push(
      `      <animate xlink:href="#${gid}" attributeName="opacity" dur="${dur}" repeatCount="indefinite" calcMode="discrete" keyTimes="${kts.join(';')}" values="${vals.join(';')}"/>`);
  });

  return { polys: polyParts.join('\n'), anims: animParts.join('\n'), stats, frameItems: perItems, groups, frameToGroup };
}

// Build the solve frame-track (scramble → inverse) — same script as solve(), but
// returns the raw frames so renderFlip / the verifier can consume them.
export function solveFrames({ moves, framesPerMove = 4, pose = POSE_3Q, restFrames = 4 } = {}) {
  const seq = moves || DEFAULT_SCRAMBLE;
  const script = seq.map((m) => ({ ...m, frames: framesPerMove, hold: 1 }))
    .concat(invert(seq).map((m) => ({ ...m, frames: framesPerMove, hold: 1 })));
  return turnFrames(script, pose, { restFrames });
}

// Flipbook solve builder — drop-in replacement for solve() that is glitch-free.
export function solveFlip({ dur = '9s', moves, framesPerMove = 4, restFrames = 4, pose = POSE_3Q, view: vo = {} } = {}) {
  const frames = solveFrames({ moves, framesPerMove, pose, restFrames });
  return renderFlip(frames, makeView(vo), { dur });
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

// =====================================================================
// Claw gestures — Clawd actually turns the cube with its own claws.
//
// Hard constraint (user 2026-06-02): Clawd has NO arms and NO fingers. The
// "hands" are the two native 2×2 claw nubs on the body sides; interaction is
// limited to simple translates of those nubs (reach in, touch, retreat). No
// articulated limbs, no grafted digits. The nubs are painted AFTER the cube
// (identical at rest — nothing overlaps — but a reaching claw draws over the
// cube and reads as gripping it).
//
// Two gesture builders produce per-claw SMIL translate tracks on the same dur
// as the cube's own animation, so claw and cube stay frame-locked:
//   clawGripEvents  — replays the exact turnFrames cubie sim; per move it picks
//                     a front-facing sticker on the turning layer (biased to
//                     the claw's side, away from the eye band) and rides that
//                     point's projected path for the first ~half of the 90°.
//   clawSwipeEvents — for rigid whole-cube motions: computes the true projected
//                     surface velocity at a near-surface marker and sweeps a
//                     claw along it (spinning-a-globe pushes).
// =====================================================================

const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const transpose = (M) => M[0].map((_, j) => M.map((r) => r[j]));
const quadCenter3 = (q) => [
  (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
  (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
  (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4,
];
// reach point of each native claw nub at its authored position (inner edge)
const CLAW_TIP = { l: [3.5, 11.25], r: [11.5, 11.25] };

// Holding pose: the claws REST ON the cube (tips overlapping its lower-left /
// lower-right), not parked at the shoulders — Clawd visibly holds the cube at
// all times; gestures swing out from and return to this grip. Derived from the
// rendered track's screen bbox so it adapts to each file's view/scale, clamped
// below the eye band and above the legs.
export function clawHoldFromStats(stats) {
  const tipY = Math.max(10.9, Math.min(11.95, stats.maxY - 0.75));
  const lx = Math.min(stats.minX + 0.95, 6.5);
  const rx = Math.max(stats.maxX - 0.95, 8.7);
  return { l: [lx - CLAW_TIP.l[0], tipY - CLAW_TIP.l[1]], r: [rx - CLAW_TIP.r[0], tipY - CLAW_TIP.r[1]] };
}

// Per move: choose a grip sticker on the turning layer and sample its projected
// path while the layer rotates. Returns [{ claw:'l'|'r', samples:[[t,x,y],…] }]
// with t as fractions of the loop, aligned to turnFrames' slot timeline.
function clawGripEvents(script, pose, view, { restFrames = 0, followFrac = 0.75, forceClaw = null } = {}) {
  const total = 2 * restFrames + script.reduce((s, m) => s + (m.frames ?? 6) + (m.hold ?? 0), 0);
  const [CX] = view.project([0, 0, 0], IDENT, null);
  let cur = buildCubies();
  let slot = restFrames;
  const events = [];
  for (const m of script) {
    const { axis, layer, dir, frames: mf = 6, hold = 0, q = 1 } = m;
    const ai = AXIS_IDX[axis];
    const inLayer = (cb) => Math.round(cb.center[ai] / STEP) === layer;
    // best front-facing sticker: outboard toward a claw, near the camera, and
    // penalised hard above y≈10 so a reaching claw stays out of the eye band.
    let best = null;
    for (const cb of cur) {
      if (!inLayer(cb)) continue;
      for (const fa of cb.faces) {
        if (fa.black || !view.normalVisible(fa.normal, pose)) continue;
        const fc = quadCenter3(fa.quad);
        const [px, py] = view.project(fc, pose, null);
        const depth = view.depth(fc, pose);
        for (const side of forceClaw ? [forceClaw === 'r' ? 1 : -1] : [1, -1]) {
          const score = side * (px - CX) + 1.2 * depth - 1.5 * Math.max(0, 10.1 - py);
          if (!best || score > best.score) best = { score, side, fc };
        }
      }
    }
    if (best) {
      const claw = best.side > 0 ? 'r' : 'l';
      const nf = Math.max(2, Math.round(mf * followFrac));
      // contact just before the first turn frame shows, then ride the point
      const samples = [[(slot - 0.2) / total, ...view.project(best.fc, pose, null)]];
      for (let f = 1; f <= nf; f++) {
        const M = ROT_AXIS[axis](dir * q * (Math.PI / 2) * easeInOut(f / mf));
        samples.push([(slot + f - 0.5) / total, ...view.project(mv(M, best.fc), pose, null)]);
      }
      events.push({ claw, samples });
    }
    const M90 = ROT_AXIS[axis]((dir * q * Math.PI) / 2);
    cur = cur.map((cb) => (inLayer(cb) ? rotCubie(cb, M90) : cb));
    slot += mf + hold;
  }
  return events;
}

// Rigid-motion pushes: at each push time, project a fixed near-surface marker a
// hair apart in time to get the true on-screen surface velocity, then sweep a
// claw along it through the cube's lower half (below the eye band).
function clawSwipeEvents(poseAt, view, { times, pushes = 2, phase = 0.02, winFrac, durS = 8 } = {}) {
  const w = winFrac ?? Math.max(0.05, 0.55 / durS);
  const tcs = times || Array.from({ length: pushes }, (_, i) => i / pushes + phase);
  const clampY = (y) => Math.min(12.4, Math.max(10.3, y));
  const events = [];
  for (const tc of tcs) {
    const R = poseAt(tc), Rt = transpose(R);
    const vel = (Q) => {
      const P = mv(Rt, Q); // marker fixed in posed (screen-facing) space
      const p0 = view.project(P, R, null);
      const p1 = view.project(P, poseAt(tc + 0.008), null);
      return { p0, vx: p1[0] - p0[0], vy: p1[1] - p0[1] };
    };
    let { p0, vx, vy } = vel([0, -0.7, 1.35]); // front face, below centre
    let len = Math.hypot(vx, vy);
    if (len < 1e-4) continue;
    vx /= len; vy /= len;
    let claw, L;
    if (Math.abs(vx) >= 0.55) {
      claw = vx > 0 ? 'l' : 'r'; // push from behind the motion
      L = 2.4;
    } else {
      // mostly vertical (tumbles): flick the near-right shoulder of the cube
      ({ p0, vx, vy } = vel([1.05, -0.4, 1.05]));
      len = Math.hypot(vx, vy);
      if (len < 1e-4) continue;
      vx /= len; vy /= len;
      claw = 'r';
      L = 1.7;
    }
    const cy0 = clampY(p0[1]);
    events.push({ claw, samples: [
      [tc, p0[0] - vx * L / 2, clampY(cy0 - vy * L / 2)],
      [tc + w, p0[0] + vx * L / 2, clampY(cy0 + vy * L / 2)],
    ] });
  }
  return events;
}

// Merge one claw's gestures into a single SMIL translate track: hold → approach
// → contact/follow → retreat → hold. Rest value 0,0 = the HOLDING pose (claws
// on the cube), so between gestures the claw keeps gripping. Overlapping
// gestures chain directly (the claw flows from one grip point to the next).
function clawSmil(events, dur, hold) {
  const durS = parseFloat(dur) || 8;
  const aF = 0.45 / durS, rF = 0.5 / durS; // approach / retreat, in loop fractions
  const parts = [];
  for (const claw of ['l', 'r']) {
    const evs = events.filter((e) => e.claw === claw).sort((a, b) => a.samples[0][0] - b.samples[0][0]);
    if (!evs.length) continue;
    const tip = [CLAW_TIP[claw][0] + hold[claw][0], CLAW_TIP[claw][1] + hold[claw][1]];
    const keys = [[0, 0, 0]];
    for (const ev of evs) {
      const t0 = Math.max(ev.samples[0][0], 0.015);
      const tA = t0 - aF;
      // the approach swallows any retreat/hold keys it overlaps
      while (keys.length > 1 && keys[keys.length - 1][0] >= tA - 1e-4) keys.pop();
      const last = keys[keys.length - 1];
      if (last[1] === 0 && last[2] === 0 && tA > last[0] + 1e-4) keys.push([tA, 0, 0]);
      for (const [t, x, y] of ev.samples) {
        const ct = Math.max(t, keys[keys.length - 1][0] + 1e-4);
        if (ct >= 0.995) break;
        keys.push([ct, x - tip[0], y - tip[1]]);
      }
      keys.push([Math.min(keys[keys.length - 1][0] + rF, 0.998), 0, 0]);
    }
    if (keys[keys.length - 1][0] < 1) keys.push([1, 0, 0]);
    const kts = [], vals = [];
    let prev = -1;
    for (const [t, x, y] of keys) {
      const rt = Math.min(1, Math.max(0, t));
      if (+rt.toFixed(4) <= prev) continue;
      prev = +rt.toFixed(4);
      kts.push(rt.toFixed(4)); vals.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    // keyTimes must end exactly at 1 (last kept key is always the rest pose)
    kts[kts.length - 1] = '1'; vals[vals.length - 1] = '0.00 0.00';
    parts.push(`      <animateTransform xlink:href="#claw-${claw}" attributeName="transform" type="translate" dur="${dur}" repeatCount="indefinite" calcMode="linear" keyTimes="${kts.join(';')}" values="${vals.join(';')}"/>`);
  }
  return parts.join('\n');
}

function addClaws(r, events, dur) {
  const hold = clawHoldFromStats(r.stats);
  const smil = clawSmil(events, dur, hold);
  return { ...r, clawHold: hold, anims: smil ? `${r.anims}\n${smil}` : r.anims };
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

// ── Clawd body shell: torso/eyes/legs copied verbatim from the original native
//    art. The claw nubs are painted AFTER the cube and REST IN A HOLDING POSE:
//    a static per-file translate (clawHold) puts each tip on the cube's lower
//    corners, so Clawd is always holding the cube. On top of that, #claw-l/-r
//    are the SMIL gesture targets (translate relative to the hold) and the
//    inner .arm-* run a constant alternating wrist waggle (rotation about the
//    body-side edge — the "wrist"). SMIL animates sit in a trailing <g>. An
//    optional `mood` adds a body-wide CSS beat for the a09/a10 characters. ──
// The claws are the same salmon as the torso, and the holding pose overlaps it —
// invisible tone-on-tone. Recolouring the WHOLE claw reads as a plank across the
// body, so only the pincer TIP segment gets a deeper shade + a 0.25 dark outline
// (like a real crab's dark pincer tips): the visible element is a small dark tip
// gripping the cube's lower corner, while the arm segment stays body-salmon and
// melts into the torso exactly like the native side nubs.
const CLAW_FILL = '#C96A47';
const CLAW_EDGE = '#8A4630';
const HOLD_DEFAULT = { l: [1.4, 0.5], r: [-1.4, 0.5] };
export function wrapSvg({ polys, anims, label = 'cube', mood = null, clawHold = HOLD_DEFAULT, stillClaw = null }) {
  const m = mood && MOODS[mood];
  const hold = (c) => `translate(${clawHold[c][0].toFixed(2)},${clawHold[c][1].toFixed(2)})`;
  // stillClaw (notation demos): that claw just holds — no wrist waggle class, and
  // moveDemo routes all grip gestures to the other claw, so it never moves at all.
  const armCls = (c) => (stillClaw === c ? '' : ` class="arm-${c}"`);
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
      .arm-l { transform-box: fill-box; transform-origin: 0% 50%; animation: arml1 2.4s infinite ease-in-out; }
      .arm-r { transform-box: fill-box; transform-origin: 100% 50%; animation: armr1 2.4s infinite ease-in-out -1.2s; }
      .eyes { transform-box: view-box; transform-origin: 7.5px 9px; animation: ey1 8s infinite ease-in-out; }
      @keyframes sh1 { 0%,100%{opacity:.5;transform:scaleX(1);} 50%{opacity:.46;transform:scaleX(.97);} }
      @keyframes br1 { 0%,100%{transform:scale(1,1) translateY(0);} 50%{transform:scale(1.008,.992) translateY(.12px);} }
      @keyframes arml1 { 0%,100%{transform:rotate(11deg);} 50%{transform:rotate(-11deg);} }
      @keyframes armr1 { 0%,100%{transform:rotate(-11deg);} 50%{transform:rotate(11deg);} }
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
    <!-- ===== standard 3x3 cube ===== -->
    <g id="cube">
${polys}
    </g>

    <g transform="${hold('l')}"><g id="claw-l"><g${armCls('l')}><rect x="0" y="10.2" width="2" height="2" fill="#DE886D"/><rect x="1.35" y="10.35" width="2.5" height="1.8" fill="${CLAW_EDGE}"/><rect x="1.6" y="10.6" width="2" height="1.3" fill="${CLAW_FILL}"/></g></g></g>
    <g transform="${hold('r')}"><g id="claw-r"><g${armCls('r')}><rect x="13" y="10.2" width="2" height="2" fill="#DE886D"/><rect x="11.15" y="10.35" width="2.5" height="1.8" fill="${CLAW_EDGE}"/><rect x="11.4" y="10.6" width="2" height="1.3" fill="${CLAW_FILL}"/></g></g></g>
    <!-- eyes stay topmost: a same-colour claw crossing the face must never blank one out -->
    <g class="eyes" fill="#000">
      <rect x="4" y="8" width="1" height="2"/>
      <rect x="10" y="8" width="1" height="2"/>
    </g>
  </g>${closeBeat}

  <g>
${anims}
  </g>
</svg>
`;
}
