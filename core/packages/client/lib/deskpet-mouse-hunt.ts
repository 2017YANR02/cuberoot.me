// Root Beast mouse tease / stalk-pounce runtime.
//
// One static rig (rootbeast-hunt-rig.svg) is posed every frame from the same
// articulation as scripts/deskpet-rootbeast/character.mjs: the traced skin
// strips, the face projection, paw attachment and eye clearance are ported
// from that file unchanged, so every frame is the existing character, never a
// redraw. The asymmetric skin is never mirrored; turning uses the continuous
// yaw range 0–180° exactly like the gallery rig.
//
// Layers: brain (intent from cursor samples) → posture springs → feet
// (world-planted contacts, steps with arcs) → face (saccades, blinks,
// continuous expressions) → renderer (attribute transforms on the rig).
// Nothing here listens to the DOM, captures the pointer, prevents default
// or moves the system cursor: the host feeds samples and decides gates.

export type Point = readonly [number, number];
export type Joint = [number, number, number, number, number];
export type Bone = 'L' | 'R' | 'HL' | 'HR';
export const BONES: readonly Bone[] = ['L', 'R', 'HL', 'HR'];

export interface BodyPose {
  yaw: number; b: Joint; L: Joint; R: Joint; HL: Joint; HR: Joint; T: Joint;
  rx: number; ry: number; spin: number; zoom: number;
  /** 1 = the drawn side (faces left / the viewer); -1 = mirrored side (faces right).
   *  The √³ tail glyph and the pupil highlight are never mirrored. */
  side?: number;
  /** Narrowest side-face width (character.mjs uses .28); only a turn-around goes below. */
  sideMin?: number;
}
export interface FacePose {
  gx: number; gy: number; pupil: number;
  blink: number; smile: number; wide: number; squint: number;
  frown: number; raise: number;
  happy: number; focus: number; angry: number; pout: number; o: number; open: number;
  puff: number; cheeks: number;
}
export interface ShadowPose { x: number; scale: number; opacity: number }
export interface HuntPose { body: BodyPose; face: FacePose; shadow: ShadowPose }

// Placement shared by every Root Beast frame (character.mjs / rig.mjs).
export const PX = 320, PY = 520, PS = 0.73;

// ------------------------------------------------------------------ poses
// Base poses copied from character.mjs (same numbers, same names).
const base: BodyPose = {
  yaw: 28, b: [0, 0, 0, 1, 1],
  L: [-201, -58, 0, 1, 1], R: [40, -50, 0, 1.1, 1],
  HL: [-116, -70, 0, .8, .8], HR: [213, -84, 0, .9, 1.1],
  T: [145, -355, 0, 1, 1], rx: 0, ry: 0, spin: 0, zoom: 1,
};
const clone = (p: BodyPose): BodyPose => ({
  ...p, b: [...p.b] as Joint, L: [...p.L] as Joint, R: [...p.R] as Joint,
  HL: [...p.HL] as Joint, HR: [...p.HR] as Joint, T: [...p.T] as Joint,
});
export const SOURCE_POSES: Record<string, BodyPose> = {
  rest: base,
  stand: { ...base, yaw: 8, b: [0, -48, 0, .9, 1], L: [-195, -65, 30, .94, 1], R: [166, -65, -30, .94, 1], HL: [-92, -81, -7, 1.03, 1.18], HR: [105, -80, 7, 1.03, 1.18], T: [124, -336, 16, .9, .9] },
  low: { ...base, b: [0, 68, -3, 1.07, .74], L: [-237, -16, 50, 1.04, .8], R: [58, -7, 49, 1.04, .8], HL: [-107, -22, -28, .8, .65], HR: [244, -40, -36, .95, .85], T: [164, -352, 47, 1, 1] },
  side: { ...base, yaw: 72, b: [0, -5, -4, 1, .95], L: [-166, -48, 20, .8, 1], R: [-103, -27, -20, .96, 1], HL: [124, -62, -18, .76, .9], HR: [184, -35, 21, 1, 1], T: [197, -305, 31, 1, 1] },
  air: { ...base, yaw: 6, b: [0, -26, 0, .91, 1.01], L: [-200, -60, 75, .9, 1], R: [176, -60, -75, .9, 1], HL: [-101, -60, 27, .95, .9], HR: [126, -53, -27, .95, .9], T: [165, -360, -16, .9, .9], ry: -44 },
  bow: { ...base, yaw: 57, b: [-23, 43, -18, 1, .82], L: [-237, 1, 59, 1.1, .8], R: [-91, 22, 52, 1.1, .8], HL: [100, -106, -24, .85, 1.3], HR: [206, -119, -29, 1, 1.45], T: [147, -328, -14, 1, 1] },
};
export const restPose = (): BodyPose => clone(base);
export const neutralFace = (): FacePose => ({
  gx: 0, gy: 0, pupil: 1, blink: 0, smile: 0, wide: 0, squint: 0, frown: 0, raise: 0,
  happy: 0, focus: 0, angry: 0, pout: 0, o: 0, open: 0, puff: 0, cheeks: 0,
});

// ------------------------------------------------------------------ projection (character.mjs)
export function view(yaw: number, sideMin = .28) {
  const angle = Math.abs(yaw) * Math.PI / 180;
  const front = Math.max(.12, Math.abs(Math.cos(angle)) * 1.11);
  const side = Math.max(sideMin, 2.48 * Math.abs(Math.sin(angle)));
  const width = 386 * front + 124 * side;
  const ratio = side / front;
  const depth = ratio <= 1 ? ratio : 1 + .65 * Math.tanh((ratio - 1) / .65);
  const f = width / (386 + 124 * depth), s = f * depth;
  return { f, s, width, tx: -width / 2 + 248 * f, face: Math.abs(yaw) < 89 ? 1 : 0 };
}
type View = ReturnType<typeof view>;
const project = (x: number, v: View) => {
  const z = x + 248, u = Math.max(0, Math.min(1, (z - 341) / 90));
  const depth = z >= 431 ? z - 386 : 90 * (u ** 3 - u ** 4 / 2);
  return -v.width / 2 + v.f * z + (v.s - v.f) * depth;
};
const EDGES = [-248, 93, 108, 123, 138, 153, 168, 183, 262];
const rotate = (x: number, y: number, angle: number): [number, number] => {
  const r = angle * Math.PI / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
const bounds = (points: [number, number][]) => ({
  left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
  top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])),
});
// Samples of the traced paw outline used by character.mjs for eye clearance.
const PAW_CONTOUR: Point[] = [[23.9,-7.2],[36.4,-4.9],[46.3,3],[51.2,14.8],[50.4,27.2],[46.3,39.3],[39.4,50.3],[33.8,60.9],[28.9,72.6],[19,80.9],[6.9,84.7],[-5.6,85.9],[-18.4,85.9],[-30.9,84.3],[-42.2,78.7],[-49.8,68.5],[-50.9,56],[-46.8,43.9],[-39.2,33.7],[-29.4,25.3],[-18.8,18.5],[-7.8,11.7],[2.4,4.2],[11.5,-4.5]];

// Port of character.mjs resolvePose(): paws stay attached to the lower shell
// band and front paws keep clear of the eyes. Mutates and returns `state`.
export function resolveBody(state: BodyPose): BodyPose {
  const v = view(state.yaw, state.sideMin);
  const [bx, by, angle, sx, sy] = state.b;
  for (const bone of BONES) {
    const front = bone === 'L' || bone === 'R';
    const [px, py, rotation, scaleX, rawScaleY] = state[bone];
    const scaleY = Math.min(rawScaleY, 1);
    const wrist = rotate(front ? 28 * scaleX : 0, front ? 9 * scaleY : 0, rotation);
    const local = rotate(px + wrist[0] - bx, py + wrist[1] + 190 - by, -angle);
    const localX = Math.max(-v.width / 2 + 30, Math.min(v.width / 2 - 30, local[0] / sx));
    const localY = Math.max(100, Math.min(155, local[1] / sy));
    const anchor = rotate(localX * sx, localY * sy, angle);
    state[bone] = [anchor[0] + bx - wrist[0], anchor[1] + by - 190 - wrist[1], rotation, scaleX, scaleY];
  }
  if (!v.face) return state;
  const eyes = [-192, 45].map(eyeX => bounds([-37, 37].flatMap(dx => [-40, 40].map(dy => {
    const [x, y] = rotate(((eyeX + dx) * v.f + v.tx) * sx, (50 + dy) * sy, angle);
    return [x + bx, y + by - 190] as [number, number];
  }))));
  for (const bone of ['L', 'R'] as const) {
    const [px, py, rotation, scaleX, scaleY] = state[bone];
    const paw = bounds(PAW_CONTOUR.map(([x, y]) => {
      const [rx, ry] = rotate(x * scaleX, y * scaleY, rotation);
      return [px + rx, py + ry] as [number, number];
    }));
    const obstacles = eyes.filter(eye => paw.right > eye.left - 5 && paw.left < eye.right + 5 && paw.bottom > eye.top - 5 && paw.top < eye.bottom + 5);
    if (obstacles.length) state[bone] = [px, py + Math.max(...obstacles.map(eye => eye.bottom + 5 - paw.top)), rotation, scaleX, scaleY];
  }
  return state;
}

/** How far a front paw at its joint overlaps the eye-clearance boxes of resolveBody (0 = clear). */
export function eyeOverlap(state: BodyPose, bone: 'L' | 'R') {
  const v = view(state.yaw, state.sideMin);
  if (!v.face) return 0;
  const [bx, by, angle, sx, sy] = state.b;
  const [px, py, rotation, scaleX, scaleY] = state[bone];
  const paw = bounds(PAW_CONTOUR.map(([x, y]) => { const [rx, ry] = rotate(x * scaleX, y * scaleY, rotation); return [px + rx, py + ry] as [number, number]; }));
  let need = 0;
  for (const eyeX of [-192, 45]) {
    const eye = bounds([-37, 37].flatMap(dx => [-40, 40].map(dy => {
      const [x, y] = rotate(((eyeX + dx) * v.f + v.tx) * sx, (50 + dy) * sy, angle);
      return [x + bx, y + by - 190] as [number, number];
    })));
    if (paw.right > eye.left - 5 && paw.left < eye.right + 5 && paw.bottom > eye.top - 5 && paw.top < eye.bottom + 5) need = Math.max(need, eye.bottom + 5 - paw.top);
  }
  return need;
}

// Attachment limits used by resolveBody, exposed so feet can step before the
// clamp would drag a planted paw.
export function attachLocal(state: BodyPose, bone: Bone, px: number, py: number) {
  const v = view(state.yaw, state.sideMin);
  const [bx, by, angle, sx, sy] = state.b;
  const front = bone === 'L' || bone === 'R';
  const [, , rotation, scaleX, rawScaleY] = state[bone];
  const wrist = rotate(front ? 28 * scaleX : 0, front ? 9 * Math.min(rawScaleY, 1) : 0, rotation);
  const local = rotate(px + wrist[0] - bx, py + wrist[1] + 190 - by, -angle);
  return { x: local[0] / sx, y: local[1] / sy, halfWidth: v.width / 2 - 30 };
}

// ------------------------------------------------------------------ paw outlines
// <generated-geometry> by work/build-rig.mjs — stroked outer outlines in limb space.
const OUTLINE_PAW: readonly Point[] = [[-53.01,60.04],[-51.87,52.27],[-48.95,44.95],[-44.99,38.14],[-39.86,32.17],[-33.97,26.93],[-27.66,22.2],[-21.26,17.6],[-14.86,12.99],[-8.46,8.39],[-2.05,3.78],[4.35,-0.83],[10.79,-5.37],[18.12,-8.16],[25.98,-8.65],[33.76,-7.52],[40.9,-4.25],[46.84,0.9],[50.98,7.58],[52.82,15.2],[52.49,23.07],[51.06,30.82],[48.52,38.28],[45.03,45.35],[41.42,52.36],[37.81,59.37],[34.2,66.38],[30.43,73.3],[25.1,79.07],[18.33,83.06],[10.84,85.5],[3.08,86.87],[-4.77,87.62],[-12.66,87.76],[-20.54,87.5],[-28.35,86.46],[-35.89,84.19],[-42.74,80.33],[-48.4,74.86],[-51.81,67.81]];
const OUTLINE_PAWR: readonly Point[] = [[-54.03,60.43],[-52.87,52.51],[-49.89,45.06],[-45.86,38.12],[-40.63,32.03],[-34.62,26.69],[-28.19,21.87],[-21.67,17.18],[-15.14,12.48],[-8.62,7.79],[-2.09,3.09],[4.43,-1.6],[11,-6.23],[18.47,-9.07],[26.48,-9.58],[34.41,-8.42],[41.69,-5.09],[47.74,0.16],[51.96,6.97],[53.84,14.73],[53.5,22.76],[52.04,30.65],[49.45,38.25],[45.89,45.46],[42.21,52.61],[38.54,59.75],[34.86,66.9],[31.01,73.95],[25.59,79.84],[18.68,83.9],[11.05,86.38],[3.13,87.78],[-4.86,88.54],[-12.9,88.69],[-20.93,88.42],[-28.89,87.36],[-36.58,85.05],[-43.56,81.11],[-49.33,75.55],[-52.81,68.35]];
const OUTLINE_REAR: readonly Point[] = [[-46.91,23.2],[-46.02,17.95],[-43.62,12.89],[-39.93,8.16],[-35.21,3.82],[-29.85,-0.21],[-23.78,-3.8],[-17.05,-6.86],[-9.46,-8.92],[-1.28,-8.82],[5.92,-6.28],[11.79,-2.57],[16.73,1.67],[21.2,6.13],[25.27,10.74],[29.06,15.44],[32.26,20.32],[34.92,25.33],[37.57,30.34],[40.21,35.36],[42.86,40.37],[45.43,45.4],[46.85,50.61],[46.37,55.87],[42.81,60.61],[36.26,63.75],[28.54,65.62],[20.41,66.57],[12.15,66.71],[3.94,66.12],[-4.07,64.82],[-11.71,62.82],[-18.73,60.03],[-24.94,56.54],[-30.34,52.53],[-35.12,48.22],[-39.12,43.59],[-42.28,38.7],[-44.8,33.66],[-46.5,28.49]];
const OUTLINE_REARR: readonly Point[] = [[-48.09,24.02],[-47.17,18.64],[-44.71,13.45],[-40.92,8.6],[-36.09,4.15],[-30.59,0.03],[-24.37,-3.65],[-17.47,-6.8],[-9.69,-8.9],[-1.32,-8.8],[6.07,-6.2],[12.08,-2.39],[17.15,1.96],[21.73,6.52],[25.9,11.24],[29.79,16.06],[33.06,21.07],[35.79,26.2],[38.51,31.34],[41.22,36.48],[43.93,41.62],[46.57,46.78],[48.02,52.11],[47.53,57.51],[43.88,62.36],[37.16,65.58],[29.25,67.5],[20.92,68.48],[12.46,68.61],[4.04,68.01],[-4.17,66.68],[-12.01,64.63],[-19.2,61.77],[-25.56,58.19],[-31.1,54.08],[-36,49.66],[-40.1,44.92],[-43.34,39.91],[-45.92,34.74],[-47.66,29.44]];
// </generated-geometry>
const outlineOf = (bone: Bone) => bone === 'L' ? OUTLINE_PAW : bone === 'R' ? OUTLINE_PAWR : bone === 'HL' ? OUTLINE_REAR : OUTLINE_REARR;
/** Offset from a limb joint to its painted lowest point for a rotation/scale. */
export function lowestPoint(bone: Bone, angle: number, sx: number, sy: number) {
  const r = angle * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  let dy = -Infinity, dx = 0;
  for (const [x, y] of outlineOf(bone)) {
    const X = x * sx, Y = y * sy, wy = s * X + c * Y;
    if (wy > dy) { dy = wy; dx = c * X - s * Y; }
  }
  return { dx, dy };
}
/** Painted centre of a limb (for hit tests), relative to its joint. */
export function limbCentre(bone: Bone, angle: number, sx: number, sy: number): [number, number] {
  const o = outlineOf(bone);
  let x = 0, y = 0;
  for (const p of o) { x += p[0]; y += p[1]; }
  return rotate(x / o.length * sx, y / o.length * sy, angle);
}

// ------------------------------------------------------------------ renderer
const fx = (v: number) => Math.round(v * 10000) / 10000;
const jointAttr = (j: Joint) => `translate(${fx(j[0])} ${fx(j[1])}) rotate(${fx(j[2])}) scale(${fx(j[3])} ${fx(j[4])})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
// Mouth line shapes as M x1 y1 Q cx cy x2 y2 + stroke width (character.mjs mouths).
const MOUTH = {
  neutral: [-17, 0, 0, 11, 17, 0, 7],
  happy: [-24, -3, 0, 25, 24, -3, 9],
  focus: [-17, 5, 0, 5, 17, 5, 7],
  angry: [-24, 10, 0, -11, 24, 10, 8],
  pout: [-13, 8, 0, 1, 13, 8, 7],
};
const BROW = {
  base: { l: [-25, -56, 0, -60, 25, -56], r: [-25, -56, 0, -60, 25, -56] },
  angry: { l: [-30, -50, -2.5, -40, 25, -30], r: [-25, -30, 2.5, -40, 30, -50] },
  raise: { l: [-25, -55, 0, -70, 25, -55], r: [-25, -55, 0, -70, 25, -55] },
};
const quad = (p: number[]) => `M${fx(p[0])} ${fx(p[1])}Q${fx(p[2])} ${fx(p[3])} ${fx(p[4])} ${fx(p[5])}`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createHuntRenderer(svg: SVGSVGElement) {
  const part = (name: string) => {
    const el = svg.querySelector<SVGGraphicsElement>(`[data-hunt="${name}"]`);
    if (!el) throw Error(`hunt rig part missing: ${name}`);
    return el;
  };
  const els = {
    motion: part('motion'), connector: part('connector'), tail: part('tail'), tailFlip: part('tail-flip'), shell: part('shell'),
    L: part('L'), R: part('R'), HL: part('HL'), HR: part('HR'),
    strips: EDGES.slice(0, -1).map((_, i) => part(`strip${i}`)),
    faceView: part('face-view'), face: part('face'), shadow: part('shadow'),
    lid: [part('lid-l'), part('lid-r')], open: [part('open-l'), part('open-r')],
    pupil: [part('pupil-l'), part('pupil-r')], smile: [part('smile-l'), part('smile-r')],
    brow: [part('brow-l'), part('brow-r')],
    mouthLine: part('mouth-line'), mouthOpen: part('mouth-open'), mouthO: part('mouth-o'),
    puff: part('puff'), cheeks: part('cheeks'),
  };
  // Skip unchanged attribute writes (one cache key per element attribute).
  const cache = new Map<string, string>();
  const attr = (el: Element, id: string, name: string, value: string) => {
    if (cache.get(id) === value) return;
    cache.set(id, value);
    el.setAttribute(name, value);
  };
  let lastView = '', previousAngle: number | undefined;
  const render = ({ body, face, shadow }: HuntPose) => {
    // The mirrored side flips the whole articulated body about the ground point;
    // the tail glyph and the pupils are flipped back so √³ and the eye highlight read as drawn.
    const side = body.side === -1 ? -1 : 1;
    attr(els.motion, 'motion', 'transform', `${side < 0 ? 'scale(-1 1) ' : ''}translate(${fx(body.rx)} ${fx(body.ry - 190)}) rotate(${fx(body.spin)}) scale(${fx(body.zoom)}) translate(0 190)`);
    attr(els.tailFlip, 'tailFlip', 'transform', side < 0 ? 'scale(-1 1)' : 'scale(1 1)');
    const cx = body.b[0], cy = -190 + body.b[1], dx = body.T[0] - cx, dy = body.T[1] - cy;
    let direction = Math.atan2(dy, dx) * 180 / Math.PI;
    if (previousAngle !== undefined) {
      while (direction - previousAngle > 180) direction -= 360;
      while (direction - previousAngle < -180) direction += 360;
    }
    previousAngle = direction;
    attr(els.connector, 'connector', 'transform', `translate(${fx(cx)} ${fx(cy)}) rotate(${fx(direction)}) scale(${fx(Math.hypot(dx, dy) / 100)} 1)`);
    attr(els.tail, 'tail', 'transform', jointAttr(body.T));
    for (const bone of BONES) attr(els[bone], bone, 'transform', jointAttr(body[bone]));
    const [bx, by, ba, bsx, bsy] = body.b;
    attr(els.shell, 'shell', 'transform', `translate(${fx(bx)} ${fx(by - 190)}) rotate(${fx(ba)}) scale(${fx(bsx)} ${fx(bsy)}) translate(0 190)`);
    const viewKey = body.yaw + '/' + (body.sideMin ?? .28);
    if (viewKey !== lastView) {
      lastView = viewKey;
      const v = view(body.yaw, body.sideMin);
      EDGES.slice(0, -1).forEach((left, i) => {
        const right = EDGES[i + 1];
        const sx = (project(right, v) - project(left, v)) / (right - left);
        attr(els.strips[i], 'strip' + i, 'transform', `matrix(${fx(sx)},0,0,1,${fx(project(left, v) - sx * left)},0)`);
      });
      attr(els.faceView, 'faceView', 'transform', `matrix(${fx(v.f)},0,0,1,${fx(v.tx)},0)`);
      attr(els.face, 'faceOpacity', 'opacity', String(v.face));
    }
    // Eyes: lid closes like the gallery blink (scale 1 → .05); happy eyes
    // squeeze the open eye before the ^ arc takes over.
    const smile = clamp01(face.smile);
    const lid = 1 - .95 * clamp01(face.blink);
    const openY = (1 - .15 * clamp01(face.squint)) * (1 - .92 * smile);
    const openX = 1 + .13 * clamp01(face.wide);
    const arc = clamp01((smile - .45) / .4);
    for (let i = 0; i < 2; i++) {
      attr(els.lid[i], 'lid' + i, 'transform', `scale(1 ${fx(lid)})`);
      attr(els.open[i], 'open' + i, 'transform', `scale(${fx(openX)} ${fx(openY)})`);
      attr(els.open[i], 'openO' + i, 'opacity', fx(1 - arc).toString());
      attr(els.smile[i], 'smile' + i, 'opacity', fx(arc).toString());
      // face.gx is in screen terms; inside the mirrored body it is negated, and the pupil itself is flipped back.
      attr(els.pupil[i], 'pupil' + i, 'transform', `translate(${fx(side * face.gx)} ${fx(face.gy)}) scale(${fx(side * face.pupil)} ${fx(face.pupil)})`);
      const eye = i ? 'r' : 'l';
      const brow = BROW.base[eye].map((v, k) => v + clamp01(face.frown) * (BROW.angry[eye][k] - v) + clamp01(face.raise) * (BROW.raise[eye][k] - v));
      attr(els.brow[i], 'brow' + i, 'd', quad(brow));
      attr(els.brow[i], 'browO' + i, 'opacity', fx(clamp01(1.6 * Math.max(face.frown, face.raise))).toString());
    }
    // Mouth: one continuous line between the gallery shapes, plus the open
    // bite and the small surprised "o", which replace the line.
    let shape = MOUTH.neutral.slice();
    const weights: [keyof typeof MOUTH, number][] = [['happy', face.happy], ['focus', face.focus], ['angry', face.angry], ['pout', face.pout]];
    for (const [name, w] of weights) if (w > 0) shape = mix(shape, MOUTH[name], clamp01(w));
    const open = clamp01(face.open), o = clamp01(face.o);
    attr(els.mouthLine, 'mouthD', 'd', quad(shape));
    attr(els.mouthLine, 'mouthW', 'stroke-width', fx(shape[6]).toString());
    // The line returns only once the open shapes are nearly gone (no muddy overlap).
    attr(els.mouthLine, 'mouthO', 'opacity', fx(clamp01(1 - 4 * Math.max(open, o))).toString());
    attr(els.mouthOpen, 'openT', 'transform', `scale(${fx(.55 + .45 * open)} ${fx(Math.max(.001, open))})`);
    attr(els.mouthOpen, 'openOp', 'opacity', open > .02 ? '1' : '0');
    attr(els.mouthO, 'oT', 'transform', 'translate(0 5) scale(.55) translate(0 -5)');
    attr(els.mouthO, 'oOp', 'opacity', fx(smoothstep((o - .2) / .3)).toString());
    attr(els.puff, 'puff', 'opacity', fx(clamp01(face.puff)).toString());
    attr(els.cheeks, 'cheeks', 'opacity', fx(.72 * clamp01(face.cheeks)).toString());
    attr(els.shadow, 'shadow', 'transform', `translate(${fx(320 + shadow.x)} 557) scale(${fx(shadow.scale)} 1) translate(-320 -557)`);
    attr(els.shadow, 'shadowO', 'opacity', fx(clamp01(shadow.opacity)).toString());
  };
  return { svg, render };
}

// ================================================================== motion helpers
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 2;
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt));
interface Spring { x: number; v: number }
const spring = (x = 0): Spring => ({ x, v: 0 });
/** Damped spring (zeta < 1 overshoots); sub-stepped semi-implicit Euler. */
function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (omega * omega * (target - s.x) - 2 * zeta * omega * s.v) * h;
    s.x += s.v * h;
  }
  return s.x;
}
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================== stances
// Ground-standing layouts at three continuous yaws. Values come from the
// gallery poses (rest; side as used by the walk at yaw 57; the front views of
// stand/air) with the paws put back on the ground. `g` is each paw's painted
// lowest point, which differs per paw because the ground has depth.
interface FootHome { x: number; a: number; sx: number; sy: number; g: number }
interface Stance { yaw: number; b: Joint; T: Joint; feet: Record<Bone, FootHome> }
const STANCE_REST: Stance = {
  yaw: 28, b: [0, 0, 0, 1, 1], T: [145, -355, 0, 1, 1],
  feet: { L: { x: -201, a: 0, sx: 1, sy: 1, g: 30 }, R: { x: 40, a: 0, sx: 1.1, sy: 1, g: 39 },
    HL: { x: -116, a: 0, sx: .8, sy: .8, g: -17 }, HR: { x: 213, a: 0, sx: .9, sy: 1, g: -15 } },
};
const STANCE_LEFT: Stance = {
  yaw: 52, b: [0, -3, -2, 1, .98], T: [188, -318, 24, 1, 1],
  feet: { L: { x: -176, a: 10, sx: .86, sy: 1, g: 30 }, R: { x: -104, a: -6, sx: .96, sy: 1, g: 47 },
    HL: { x: 118, a: -10, sx: .78, sy: .9, g: -6 }, HR: { x: 180, a: 12, sx: 1, sy: 1, g: 12 } },
};
const STANCE_FRONT: Stance = {
  yaw: 6, b: [0, 0, 0, 1, 1], T: [128, -350, 6, .95, .95],
  feet: { L: { x: -174, a: 0, sx: .96, sy: 1, g: 30 }, R: { x: 138, a: 0, sx: .96, sy: 1, g: 33 },
    HL: { x: -90, a: 0, sx: .85, sy: .85, g: -15 }, HR: { x: 110, a: 0, sx: .88, sy: .95, g: -9 } },
};
const mixJoint = (a: Joint, b: Joint, t: number) => a.map((v, i) => lerp(v, b[i], t)) as Joint;
const mixFoot = (a: FootHome, b: FootHome, t: number): FootHome => ({ x: lerp(a.x, b.x, t), a: lerp(a.a, b.a, t), sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t), g: lerp(a.g, b.g, t) });
/** phi: -1 faces left (3/4 profile), 0 = rest, +1 faces the viewer/right. */
export const yawOf = (phi: number) => phi <= 0 ? lerp(STANCE_REST.yaw, STANCE_LEFT.yaw, -phi) : lerp(STANCE_REST.yaw, STANCE_FRONT.yaw, phi);
function stanceAt(phi: number): Stance {
  const other = phi < 0 ? STANCE_LEFT : STANCE_FRONT, t = Math.abs(phi);
  const feet = {} as Record<Bone, FootHome>;
  for (const k of BONES) feet[k] = mixFoot(STANCE_REST.feet[k], other.feet[k], t);
  return { yaw: yawOf(phi), b: mixJoint(STANCE_REST.b, other.b, t), T: mixJoint(STANCE_REST.T, other.T, t), feet };
}

// ================================================================== body + feet
type FootMode = 'plant' | 'swing' | 'free';
interface Foot {
  bone: Bone; mode: FootMode;
  cx: number; cy: number;          // contact (painted lowest point) in world, root-independent x
  a: number; sx: number; sy: number; // world angle and limb scale
  // swing
  x0: number; y0: number; x1: number; y1: number; t: number; dur: number; lift: number; hold: number;
  // free: joint in model space
  jx: number; jy: number; ja: number;
  plantedAt: number;
}
export interface BodyState {
  X: number; vX: number;          // root world x (rig units) and velocity
  side: number;                   // 1 drawn side, -1 mirrored side (faces right)
  phi: Spring; crouch: Spring; lean: Spring; tilt: Spring; bob: Spring; sway: Spring; squash: Spring;
  ry: number; vy: number; spin: Spring; airborne: boolean;
  feet: Record<Bone, Foot>;
  tail: { x: Spring; y: Spring; a: Spring };
  pose: BodyPose;
}

// Model → world (relative to the root) for the motion wrapper of the rig.
function motionPoint(p: BodyPose, x: number, y: number): [number, number] {
  const [qx, qy] = rotate(x * p.zoom, (y + 190) * p.zoom, p.spin);
  return [qx + p.rx, qy + p.ry - 190];
}
function motionInverse(p: BodyPose, x: number, y: number): [number, number] {
  const [qx, qy] = rotate(x - p.rx, y - p.ry + 190, -p.spin);
  return [qx / p.zoom, qy / p.zoom - 190];
}
/** Shell-space point (face coordinates before the face projection) → world relative to root. */
function shellPoint(p: BodyPose, x: number, y: number): [number, number] {
  const [bx, by, ba, bsx, bsy] = p.b;
  const [rx, ry] = rotate(x * bsx, (y + 190) * bsy, ba);
  return motionPoint(p, rx + bx, ry + by - 190);
}
export function facePoint(p: BodyPose, x: number, y: number): [number, number] {
  const v = view(p.yaw, p.sideMin);
  return shellPoint(p, x * v.f + v.tx, y);
}

// Flight layouts (model space, facing left in the body's own frame; the
// mirrored side reuses them). Paws stay inside the attachment band; the clamp
// in resolveBody keeps them on the shell even at full reach.
type FlightKey = Record<Bone, Joint>;
const FLIGHT: Record<'takeoff' | 'mid' | 'preland', FlightKey> = {
  takeoff: { L: [-226, -92, 72, .9, 1], R: [-158, -74, 60, .92, 1], HL: [150, -44, -38, .8, .9], HR: [214, -28, -44, .95, 1] },
  mid: { L: [-240, -66, 60, .9, 1], R: [-170, -54, 52, .92, 1], HL: [140, -58, -22, .8, .9], HR: [202, -44, -26, .95, 1] },
  preland: { L: [-232, -40, 34, .9, 1], R: [-166, -34, 28, .94, 1], HL: [124, -66, -6, .78, .9], HR: [186, -52, -6, 1, 1] },
};
// Mid-turn tuck: symmetric about the ground point, so the mirrored side (with
// L/R swapped) draws the same paws in the same places at the switch.
const TUCK: FlightKey = { L: [-125, -62, 18, .92, 1], R: [125, -62, -18, .92, 1], HL: [-85, -72, -8, .82, .85], HR: [85, -72, 8, .82, .85] };
const mixKey = (a: FlightKey, b: FlightKey, t: number) => {
  const out = {} as FlightKey;
  for (const k of BONES) out[k] = mixJoint(a[k], b[k], t);
  return out;
};

export type JumpKind = 'pounce' | 'hop' | 'swat';
export interface ContactInfo { kind: JumpKind | 'bite'; paws: [number, number][]; mouth: [number, number] }
export interface BodyCmd {
  /** Facing in the body's own frame: -1 = 3/4 profile, 0 = rest. */
  phi: number;
  /** Drawn side: 1 faces left (or the rest pose), -1 faces right. A change triggers a hop-turn. */
  side: number;
  turnRate: number; crouch: number; lean: number; tilt: number;
  v: number; gait: 'walk' | 'stalk' | 'still'; freeze: boolean; holdPaw: boolean;
  tread: number;                  // 0..1 hind-paw treading before a pounce
  tail: 'calm' | 'alert' | 'twitch' | 'lash' | 'wag' | 'low'; tailAmount: number;
  precise: boolean;               // settle every paw exactly onto its home (before handing back to the idle)
}
export const defaultCmd = (): BodyCmd => ({ phi: 0, side: 1, turnRate: 7, crouch: 0, lean: 0, tilt: 0, v: 0, gait: 'still', freeze: false, holdPaw: false, tread: 0, tail: 'calm', tailAmount: 0, precise: false });
// Small yaw changes (glances) leave the paws where they are, like the idle;
// only a real turn moves the paw homes.
const footBlend = (phi: number) => smoothstep((Math.abs(phi) - .2) / .8);
function homeStance(phi: number): Stance {
  const s = stanceAt(phi);
  const other = phi < 0 ? STANCE_LEFT : STANCE_FRONT, t = footBlend(phi);
  for (const k of BONES) s.feet[k] = mixFoot(STANCE_REST.feet[k], other.feet[k], t);
  return s;
}
const SWAP: Record<Bone, Bone> = { L: 'R', R: 'L', HL: 'HR', HR: 'HL' };

/** Body, feet and tail simulation in rig units. World x is the root travel.
 *  The body is simulated in its own frame (it always faces local left); `side`
 *  maps that frame onto the screen, so facing right is the mirrored side. */
export function createBody(rand: () => number) {
  const newFoot = (bone: Bone): Foot => {
    const h = STANCE_REST.feet[bone];
    const lp = lowestPoint(bone, h.a, h.sx, Math.min(h.sy, 1));
    return { bone, mode: 'plant', cx: h.x + lp.dx, cy: h.g, a: h.a, sx: h.sx, sy: Math.min(h.sy, 1), x0: 0, y0: 0, x1: 0, y1: 0, t: 0, dur: 0, lift: 0, hold: 0, jx: 0, jy: 0, ja: 0, plantedAt: 0 };
  };
  const st: BodyState = {
    X: 0, vX: 0, side: 1, phi: spring(0), crouch: spring(0), lean: spring(0), tilt: spring(0), bob: spring(0), sway: spring(0), squash: spring(0),
    ry: 0, vy: 0, spin: spring(0), airborne: false,
    feet: { L: newFoot('L'), R: newFoot('R'), HL: newFoot('HL'), HR: newFoot('HR') },
    tail: { x: spring(145), y: spring(-355), a: spring(0) },
    pose: resolveBody(restPose()),
  };
  // World x ↔ the body's own frame (relative to the root).
  const toLocal = (wx: number) => st.side * (wx - st.X);
  const toWorld = (lx: number) => st.X + st.side * lx;
  let seq = 0, time = 0, lastStep = -1, treadClock = 0, treadNext: Bone = 'HL', prevVL = 0, prevVY = 0;
  let bounds = { min: -Infinity, max: Infinity };
  let tailNoise = 0, tailNoiseTarget = 0, tailNoiseTimer = 0, lashTimer = 0, lashSign = 1;
  let slip = 0;               // largest correction the attachment clamp applied to a planted paw (QA)
  type Jump = { kind: JumpKind | 'turn'; dir: number; phase: 'dip' | 'push' | 'flight' | 'land'; t: number; dip: number; push: number; flight: number;
    vx0: number; vy0: number; g: number; freed: boolean; contactDone: boolean; landT: number;
    // turn only
    side0: number; side1: number; phi0: number; phi1: number; yaw0: number; yaw1: number; from: FlightKey | null; swapped: boolean };
  let jump: Jump | null = null;
  let turnYaw: number | null = null;   // yaw override while turning around
  let onContact: ((info: ContactInfo) => void) | null = null;
  let onJumpEnd: (() => void) | null = null;
  let bite: { t: number; dur: number; dir: number; snapped: boolean; swipe: boolean; swiped: boolean } | null = null;
  let onBite: ((info: ContactInfo) => void) | null = null;
  let biteOpen = 0;

  // In its own frame the body always faces left.
  const D = -1;
  const homeOf = (bone: Bone, stance: Stance) => {
    const h = stance.feet[bone];
    const front = bone === 'L' || bone === 'R';
    // Crouching folds the paws a little and draws them under the body.
    const c = clamp01(st.crouch.x);
    return { x: h.x + (front ? D * 8 * c : -D * 6 * c), a: h.a + (front ? -D * 16 : D * 10) * c, sx: h.sx, sy: Math.min(h.sy, 1) * (1 - .06 * c), g: h.g };
  };
  function plant(f: Foot, x: number, y: number) { f.mode = 'plant'; f.cx = x; f.cy = y; f.plantedAt = time; }
  function startSwing(f: Foot, tx: number, ty: number, dur: number, lift: number) {
    f.mode = 'swing'; f.x0 = f.cx; f.y0 = f.cy; f.x1 = tx; f.y1 = ty; f.t = 0; f.dur = dur; f.lift = lift; f.hold = 0;
  }
  function toFree(f: Foot) { const j = st.pose[f.bone]; f.mode = 'free'; f.jx = j[0]; f.jy = j[1]; f.ja = j[2]; f.sx = j[3]; f.sy = j[4]; }
  // A planted / swinging paw's joint in the body frame, from its world contact.
  const plantedLocal = (f: Foot) => { const lp = lowestPoint(f.bone, f.a, f.sx, f.sy); return motionInverse(st.pose, toLocal(f.cx) - lp.dx, f.cy - lp.dy); };

  function planSteps(stance: Stance, aim: Stance, cmd: BodyCmd) {
    if (cmd.freeze) return;
    const feet = BONES.map(b => st.feet[b]);
    const swinging = feet.some(f => f.mode === 'swing');
    // Plan with the intended speed: when a paw holds the body back, the next
    // steps must still be sized for where it is trying to go.
    const vPlan = Math.abs(cmd.v) > Math.abs(st.vX) && !cmd.freeze ? cmd.v * .7 + st.vX * .3 : st.vX;
    const vLoc = st.side * vPlan;
    const speed = Math.abs(vPlan);
    // Contact error measured with the home paw angle: a planted paw rolls to that
    // angle about its contact, so only the contact position needs a step.
    const err = (f: Foot) => { const h = homeOf(f.bone, stance); return toWorld(h.x + lowestPoint(f.bone, h.a, h.sx, h.sy).dx) - f.cx; };
    // Touchdown target ahead of the home by the lead, kept inside the paw's reach
    // at touchdown time so the attachment clamp never has to drag it.
    const target = (f: Foot, lead: number, dur: number) => {
      const h = homeOf(f.bone, aim);
      const lp = lowestPoint(f.bone, h.a, h.sx, h.sy);
      let jl = h.x + vLoc * lead;
      const atTouch = jl - vLoc * dur;
      const probe = { ...st.pose, [f.bone]: [atTouch, h.g - lp.dy, h.a, h.sx, h.sy] } as BodyPose;
      const local = attachLocal(probe, f.bone, atTouch, h.g - lp.dy);
      const limit = local.halfWidth - 16;
      if (local.x > limit) jl -= (local.x - limit) * st.pose.b[3];
      if (local.x < -limit) jl += (-limit - local.x) * st.pose.b[3];
      return toWorld(jl + lp.dx);
    };
    const ground = (f: Foot) => homeOf(f.bone, aim).g;
    if (cmd.gait === 'stalk') {
      // Four-beat creep (near hind, near fore, far hind, far fore): low, careful
      // steps; the next paw lifts only when the last is past mid-swing.
      const order: Bone[] = ['HL', 'L', 'HR', 'R'];
      const prev = st.feet[order[(seq + 3) % 4]];
      if (prev.mode === 'swing' && prev.t / prev.dur < .46) return;
      if (time - lastStep < .07) return;
      for (let k = 0; k < 4; k++) {
        const b = order[(seq + k) % 4], f = st.feet[b];
        if (f.mode !== 'plant' || Math.abs(err(f)) < 9) continue;
        const dur = .23 + rand() * .06;
        startSwing(f, target(f, dur * 2.2, dur), ground(f), dur, 6 + rand() * 3.5);
        seq = (seq + k + 1) % 4; lastStep = time;
        break;
      }
      return;
    }
    const turning = Math.abs(st.phi.v) > 1.2;
    const walking = (cmd.gait === 'walk' && speed > 18) || turning;
    // A trailing paw at the end of its reach steps first, whatever the pattern.
    const nSwing = feet.filter(f => f.mode === 'swing').length;
    if (nSwing < 2 && speed > 10) {
      for (const f of feet) {
        if (f.mode !== 'plant') continue;
        const [lx, ly] = plantedLocal(f);
        const local = attachLocal(st.pose, f.bone, lx, ly);
        const trailing = vLoc < 0 ? local.x : -local.x;
        if (trailing > local.halfWidth - 30) {
          const dur = clamp(.28 - speed * .0004, .14, .26);
          startSwing(f, target(f, dur * 1.55, dur), ground(f), dur, clamp(10 + speed * .03, 10, 20));
          lastStep = time;
          return;
        }
      }
    }
    const dur = walking ? clamp(.3 - speed * .00045, .14, .28) : .2;
    const lift = walking ? clamp(11 + speed * .03, 11, 22) : 9;
    const thresh = walking ? clamp(14 + speed * .07, 16, 40) : cmd.precise ? 2 : 12;
    if (walking) {
      // Diagonal pairs alternate; the next pair may lift once the last is nearly down.
      const groups: Bone[][] = [['L', 'HR'], ['R', 'HL']];
      const busy = groups.map(g => g.some(b => st.feet[b].mode === 'swing'));
      const progress = (g: Bone[]) => Math.min(...g.map(b => { const f = st.feet[b]; return f.mode === 'swing' ? f.t / f.dur : 1; }));
      const order = Math.max(...groups[0].map(b => Math.abs(err(st.feet[b])))) >= Math.max(...groups[1].map(b => Math.abs(err(st.feet[b])))) ? [0, 1] : [1, 0];
      for (const i of order) {
        if (busy[i]) continue;
        const other = 1 - i;
        if (busy[other] && progress(groups[other]) < .78) continue;
        if (time - lastStep < dur * .5) continue;
        const errs = groups[i].map(b => Math.abs(err(st.feet[b])));
        if (Math.max(...errs) < thresh) continue;
        for (const b of groups[i]) {
          const f = st.feet[b];
          if (f.mode !== 'plant' || Math.abs(err(f)) < thresh * .3) continue;
          startSwing(f, target(f, dur * 1.55, dur), ground(f), dur * (.94 + rand() * .12), lift * (.9 + rand() * .2));
        }
        lastStep = time;
        break;
      }
      return;
    }
    // Settling in place: one paw at a time, largest error first.
    if (swinging || time - lastStep < .06) return;
    const errAll = (f: Foot) => Math.max(Math.abs(err(f)), cmd.precise ? Math.abs(f.cy - ground(f)) * 3 : 0);
    const c = feet.filter(f => f.mode === 'plant').map(f => ({ f, e: errAll(f) })).sort((a, b) => b.e - a.e)[0];
    if (c && c.e > thresh) {
      startSwing(c.f, target(c.f, 0, dur), ground(c.f), dur * (.9 + rand() * .2), lift);
      lastStep = time;
    }
  }

  function updateFeet(stance: Stance, cmd: BodyCmd, dt: number) {
    for (const b of BONES) {
      const f = st.feet[b];
      const h = homeOf(b, stance);
      const front = b === 'L' || b === 'R';
      if (f.mode === 'plant') {
        // A planted paw may roll about its contact as the posture changes; it never slides.
        f.a = approach(f.a, h.a, 5, dt); f.sx = approach(f.sx, h.sx, 5, dt); f.sy = approach(f.sy, h.sy, 5, dt);
      } else if (f.mode === 'swing') {
        const u0 = f.t / f.dur;
        const holding = cmd.freeze && cmd.holdPaw && u0 > .4 && u0 < .62;
        if (!holding) f.t += dt * (cmd.freeze && !cmd.holdPaw ? 1.4 : 1);
        const u = clamp01(f.t / f.dur);
        const s = cmd.gait === 'stalk' ? easeOut(smoothstep(u)) : smoothstep(u);
        f.cx = lerp(f.x0, f.x1, s);
        f.cy = lerp(f.y0, f.y1, u) - f.lift * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** .85;
        const d = Math.abs(f.x1 - f.x0) > 3 ? st.side * Math.sign(f.x1 - f.x0) : 0;   // step direction in the body frame
        f.a = approach(f.a, h.a + (front ? d * 13 : -d * 8) * Math.sin(Math.PI * u), 14, dt);
        f.sx = approach(f.sx, h.sx, 8, dt); f.sy = approach(f.sy, h.sy, 8, dt);
        if (u >= 1) {
          plant(f, f.x1, f.y1);
          st.bob.v += (cmd.gait === 'stalk' ? 10 : 24) * (front ? 1 : .7);
          st.tail.a.v += (rand() - .5) * 26;
        }
      }
    }
    // Hind treading before a pounce: alternate hind paws lift a little in place.
    if (cmd.tread > 0 && !jump) {
      treadClock -= dt;
      if (treadClock <= 0) {
        const f = st.feet[treadNext];
        if (f.mode === 'plant') { startSwing(f, f.cx, f.cy, .13, 5 + 5 * cmd.tread); st.sway.v += (treadNext === 'HL' ? -1 : 1) * 40 * cmd.tread; }
        treadNext = treadNext === 'HL' ? 'HR' : 'HL';
        treadClock = .15 + rand() * .07;
      }
    }
  }

  function composePose(stance: Stance, cmd: BodyCmd, dt: number) {
    const p = st.pose;
    const c = st.crouch.x, lean = st.lean.x, left = Math.max(0, -st.phi.x);
    p.yaw = turnYaw ?? yawOf(clamp(st.phi.x, -1, 1));
    p.side = st.side;
    // Turning through the front view: the face, tail and paws centre on the
    // ground point and the side face narrows, so both sides draw alike at the switch.
    const w = turnYaw === null ? 0 : 1 - smoothstep(turnYaw / 18);
    p.sideMin = lerp(.28, .1, w);
    const vc = view(p.yaw, p.sideMin);
    p.b = [
      lerp(stance.b[0] + D * 22 * lean + st.sway.x, -(vc.tx + vc.f * -73.5), w),
      stance.b[1] + 34 * c + st.bob.x,
      (stance.b[2] - 6 * c * left + 4.5 * lean * D + st.tilt.x) * (1 - w),
      stance.b[3] * (1 + .03 * c + .5 * st.squash.x),
      stance.b[4] * (1 - .07 * c - st.squash.x),
    ];
    p.rx = 0; p.ry = st.ry; p.spin = st.spin.x * (1 - w); p.zoom = 1;
    // Tail: posture target, behaviour overlay, then springs so it lags the body.
    const T = stance.T;
    const vLoc = st.side * st.vX;
    let ta = T[2] + 16 * c, tx = T[0], ty = T[1] + 22 * c;
    tailNoiseTimer -= dt;
    if (tailNoiseTimer <= 0) {
      const amount = cmd.tail === 'twitch' ? 7 : cmd.tail === 'alert' ? 3 : cmd.tail === 'low' ? 2 : 1.2;
      tailNoiseTarget = (rand() * 2 - 1) * amount * (cmd.tailAmount || 1);
      tailNoiseTimer = cmd.tail === 'twitch' ? .1 + rand() * .22 : .5 + rand() * .9;
    }
    tailNoise = approach(tailNoise, tailNoiseTarget, cmd.tail === 'twitch' ? 24 : 6, dt);
    ta += tailNoise;
    if (cmd.tail === 'wag') ta += (Math.sin(time * Math.PI * 2 * 2.3) * 15 - 6) * cmd.tailAmount;
    if (cmd.tail === 'low') { ta += 8 * cmd.tailAmount; ty += 8 * cmd.tailAmount; }
    if (cmd.tail === 'lash') {
      lashTimer -= dt;
      if (lashTimer <= 0) { lashSign = -lashSign; lashTimer = .17 + rand() * .12; st.tail.a.v += lashSign * 240 * cmd.tailAmount; }
    }
    ta += clamp(-vLoc * .02, -8, 8);
    st.tail.a.v -= (vLoc - prevVL) * .06 + (st.vy - prevVY) * .035;
    prevVL = vLoc; prevVY = st.vy;
    tx += p.b[0] * .9; ty += p.b[1] * .9;
    stepSpring(st.tail.x, tx, 16, .6, dt); stepSpring(st.tail.y, ty, 16, .6, dt); stepSpring(st.tail.a, ta, 12, .42, dt);
    p.T = [lerp(st.tail.x.x, 0, w), st.tail.y.x, lerp(clamp(st.tail.a.x, -40, 56), 0, w), T[3], T[4]];
    // Planted and swinging paws are positioned from their world contact: the
    // painted lowest point sits on the ground and stays put while planted.
    const wanted: Partial<Record<Bone, [number, number]>> = {};
    for (const b of BONES) {
      const f = st.feet[b];
      if (f.mode === 'free') { p[b] = [f.jx, f.jy, f.ja, f.sx, f.sy]; continue; }
      const [jx, jy] = plantedLocal(f);
      p[b] = [jx, jy, f.a - p.spin, f.sx, f.sy];
      if (f.mode === 'plant') wanted[b] = [jx, jy];
    }
    // The shell may lean, crouch and sway, but never so far that a planted paw
    // leaves its attachment band: shift the shell back instead of dragging the paw.
    for (let pass = 0; pass < 4; pass++) {
      let push = 0, lift = 0, lower = 0;
      for (const b of BONES) {
        if (st.feet[b].mode !== 'plant') continue;
        const local = attachLocal(p, b, p[b][0], p[b][1]);
        const lim = local.halfWidth - 2;
        if (local.x > lim) push = Math.max(push, (local.x - lim) * p.b[3]);
        if (local.x < -lim) push = Math.min(push, (-lim - local.x) * -p.b[3]);
        if (local.y < 101) lift = Math.max(lift, (101 - local.y) * p.b[4]);
        if (local.y > 154) lower = Math.max(lower, (local.y - 154) * p.b[4]);
      }
      // A planted front paw must not sit inside the eye clearance either (the
      // clamp would push it into the ground): raise the shell over it.
      for (const b of ['L', 'R'] as const) if (st.feet[b].mode === 'plant') lift = Math.max(lift, eyeOverlap(p, b));
      if (!push && !lift && !lower) break;
      // Raising for one paw while lowering for another: the tilt is too steep; ease it.
      if (lift && lower) { p.b[2] *= .6; p.b[0] -= D * 4 * lean; continue; }
      p.b[0] += push; p.b[1] += lower - lift;
    }
    resolveBody(p);
    slip = 0;
    for (const b of BONES) { const wv = wanted[b]; if (wv) slip = Math.max(slip, Math.hypot(p[b][0] - wv[0], p[b][1] - wv[1])); }
    return p;
  }

  function hitInfo(kind: JumpKind | 'bite'): ContactInfo {
    const p = st.pose;
    const paws = (['L', 'R'] as const).map(b => {
      const j = p[b];
      const c = limbCentre(b, j[2], j[3], j[4]);
      const [x, y] = motionPoint(p, j[0] + c[0], j[1] + c[1]);
      return [toWorld(x), y] as [number, number];
    });
    const [mx, my] = facePoint(p, -74, -112);
    return { kind, paws, mouth: [toWorld(mx), my] };
  }

  function updateJump(dt: number, cmd: BodyCmd) {
    if (!jump) return;
    const j = jump;
    j.t += dt;
    const setFree = (k: FlightKey, rate: number, bones: readonly Bone[]) => {
      for (const b of bones) {
        const f = st.feet[b];
        if (f.mode !== 'free') continue;
        const t = k[b];
        f.jx = approach(f.jx, t[0], rate, dt); f.jy = approach(f.jy, t[1], rate, dt); f.ja = approach(f.ja, t[2], rate, dt);
        f.sx = approach(f.sx, t[3], rate, dt); f.sy = approach(f.sy, Math.min(1, t[4]), rate, dt);
      }
    };
    // In its own frame the body leaps toward local left: nose up at take-off, down for the landing.
    const turn = j.kind === 'turn';
    const spinUp = turn ? 0 : j.kind === 'swat' ? 4 : 9, spinDown = turn ? 0 : j.kind === 'swat' ? -3 : -10;
    const stance = homeStance(st.phi.x);
    const touch = (b: Bone, g: number) => {
      const f = st.feet[b];
      const lp = lowestPoint(b, f.ja + st.pose.spin, f.sx, f.sy);
      const [wx, wy] = motionPoint(st.pose, f.jx, f.jy);
      return { lp, wx, wy, hit: wy + lp.dy >= g - .5 };
    };
    const plantFree = (f: Foot, c: ReturnType<typeof touch>, g: number) => { f.a = f.ja + st.pose.spin; plant(f, toWorld(c.wx + c.lp.dx), g); };
    if (j.phase === 'dip') {
      cmd.crouch = Math.max(cmd.crouch, turn ? .5 : .8); cmd.lean = turn ? 0 : -.35;
      if (j.t >= j.dip) { j.phase = 'push'; j.t = 0; }
      return;
    }
    if (j.phase === 'push') {
      if (!j.freed) {
        j.freed = true;
        if (turn) { for (const b of BONES) toFree(st.feet[b]); j.from = { L: [...st.pose.L], R: [...st.pose.R], HL: [...st.pose.HL], HR: [...st.pose.HR] } as FlightKey; }
        else { toFree(st.feet.L); toFree(st.feet.R); }
      }
      const u = clamp01(j.t / j.push);
      cmd.crouch = lerp(Math.max(cmd.crouch, turn ? .45 : .7), .05, u); cmd.lean = turn ? 0 : lerp(-.3, .25, u);
      st.vX = lerp(st.vX, j.vx0, u); st.vy = lerp(0, j.vy0, u);
      st.ry = Math.min(0, st.ry + st.vy * dt);
      if (!turn) {
        setFree(FLIGHT.takeoff, 24, ['L', 'R']);
        stepSpring(st.spin, spinUp, 18, .8, dt);
        // Hind paws push until they reach the end of their reach, then leave the ground.
        for (const b of ['HL', 'HR'] as const) {
          const f = st.feet[b];
          if (f.mode !== 'plant') continue;
          const [mx, my] = plantedLocal(f);
          const local = attachLocal(st.pose, b, mx, my);
          if (Math.abs(local.x) > local.halfWidth - 8 || local.y > 150) toFree(f);
        }
      }
      if (u >= 1) { toFree(st.feet.HL); toFree(st.feet.HR); j.phase = 'flight'; j.t = 0; st.airborne = true; }
      return;
    }
    if (j.phase === 'flight') {
      st.vy += j.g * dt; st.ry += st.vy * dt; st.vX = j.vx0;
      const p = clamp01(j.t / j.flight);
      cmd.crouch = .05;
      if (turn) {
        // Hop-turn: rotate to the front view, switch side at the top, rotate on to the new facing.
        if (p < .5) { turnYaw = lerp(j.yaw0, 0, smoothstep(p / .5)); }
        else {
          if (!j.swapped) {
            // The tuck is symmetric: swapping L/R under the mirror keeps every paw in place.
            j.swapped = true; st.side = j.side1;
            const feet = st.feet;
            const old = { L: { ...feet.L }, R: { ...feet.R }, HL: { ...feet.HL }, HR: { ...feet.HR } };
            for (const b of BONES) { const o = old[SWAP[b]]; Object.assign(feet[b], { jx: -o.jx, jy: o.jy, ja: -o.ja, sx: o.sx, sy: o.sy, bone: b }); }
            st.phi.x = j.phi1; st.phi.v = 0;
            st.tail.x.x = -st.tail.x.x; st.tail.x.v = -st.tail.x.v; st.tail.a.x = -st.tail.a.x; st.tail.a.v = -st.tail.a.v;
            st.sway.x = -st.sway.x; st.sway.v = -st.sway.v; st.tilt.x = -st.tilt.x; st.tilt.v = -st.tilt.v;
          }
          turnYaw = lerp(0, j.yaw1, smoothstep((p - .5) / .5));
        }
        const land = homeStance(j.phi1);
        const landKey = {} as FlightKey;
        for (const b of BONES) { const h = land.feet[b]; const lp = lowestPoint(b, h.a, h.sx, h.sy); landKey[b] = [h.x, h.g - lp.dy - 6, h.a, h.sx, h.sy]; }
        const k = p < .5 ? mixKey(j.from!, TUCK, smoothstep(p / .5)) : mixKey(TUCK, landKey, smoothstep((p - .5) / .5));
        for (const b of BONES) { const f = st.feet[b]; const t = k[b]; f.jx = t[0]; f.jy = t[1]; f.ja = t[2]; f.sx = t[3]; f.sy = Math.min(1, t[4]); }
        if (p >= 1 || (st.vy > 0 && st.ry >= 0)) { st.ry = Math.min(st.ry, 0); turnYaw = null; j.phase = 'land'; j.landT = 0; }
        return;
      }
      cmd.lean = lerp(.25, .1, p);
      const k = p < .5 ? mixKey(FLIGHT.takeoff, FLIGHT.mid, smoothstep(p / .5)) : mixKey(FLIGHT.mid, FLIGHT.preland, smoothstep((p - .5) / .5));
      setFree(k, 16, BONES);
      stepSpring(st.spin, lerp(spinUp, spinDown, smoothstep(p)), 14, .9, dt);
      if (j.kind === 'swat' && !j.contactDone && st.vy >= 0) { j.contactDone = true; onContact?.(hitInfo('swat')); }
      if (st.vy > 0) {
        for (const b of ['L', 'R'] as const) {
          const f = st.feet[b];
          if (f.mode !== 'free') continue;
          const c = touch(b, stance.feet[b].g);
          if (!c.hit) continue;
          plantFree(f, c, stance.feet[b].g);
          if (!j.contactDone) { j.contactDone = true; onContact?.(hitInfo(j.kind as JumpKind)); }
          if (j.phase === 'flight') { j.phase = 'land'; j.landT = 0; }
        }
        if (j.phase === 'flight' && st.ry >= 0) {
          st.ry = 0; j.phase = 'land'; j.landT = 0;
          if (!j.contactDone) { j.contactDone = true; onContact?.(hitInfo(j.kind as JumpKind)); }
        }
      }
      return;
    }
    // land: the remaining fall is absorbed by the legs, front paws already down.
    j.landT += dt;
    if (st.ry < 0) {
      st.vy += j.g * .55 * dt; st.ry += st.vy * dt;
      if (st.ry >= 0) { st.bob.v += Math.min(st.vy, 900) * .1; st.squash.v += turn ? .25 : .5; st.ry = 0; st.vy = 0; }
    }
    st.vX = approach(st.vX, 0, 9, dt);
    const cushion = turn ? .3 : .55;
    cmd.crouch = Math.max(cmd.crouch, j.landT < .16 ? cushion : lerp(cushion, cmd.crouch, smoothstep((j.landT - .16) / .3)));
    if (!turn) cmd.lean = Math.max(cmd.lean, .15 * (1 - smoothstep(j.landT / .4)));
    stepSpring(st.spin, 0, 13, .62, dt);
    for (const b of ['L', 'R'] as const) {
      const f = st.feet[b];
      if (f.mode !== 'free') continue;
      const g = stance.feet[b].g;
      const c = touch(b, g);
      // Bring the second front paw straight down onto its ground.
      f.jy += Math.min(g - (c.wy + c.lp.dy), 900 * dt);
      const c2 = touch(b, g);
      if (c2.hit) plantFree(f, c2, g);
    }
    for (const b of ['HL', 'HR'] as const) {
      const f = st.feet[b];
      if (f.mode !== 'free') continue;
      const h = homeOf(b, stance);
      const lp0 = lowestPoint(b, h.a, h.sx, h.sy);
      const [hx, hy] = motionInverse(st.pose, h.x, h.g - lp0.dy);
      const rate = j.landT < .05 ? 6 : 15;
      f.jx = approach(f.jx, hx, rate, dt); f.jy = approach(f.jy, hy, rate, dt); f.ja = approach(f.ja, h.a - st.pose.spin, rate, dt);
      f.sx = approach(f.sx, h.sx, rate, dt); f.sy = approach(f.sy, h.sy, rate, dt);
      const c = touch(b, h.g);
      if ((c.hit && j.landT > .06) || j.landT > .34) { plantFree(f, c, h.g); st.bob.v += 8; }
    }
    st.airborne = st.ry < 0;
    if (BONES.every(b => st.feet[b].mode === 'plant') && st.ry >= 0 && Math.abs(st.spin.x) < .8 && j.landT > (turn ? .16 : .28)) {
      jump = null; st.airborne = false; turnYaw = null;
      const end = onJumpEnd; onJumpEnd = null; onContact = null; end?.();
    }
  }

  function updateBite(dt: number, cmd: BodyCmd) {
    if (!bite) { biteOpen = approach(biteOpen, 0, 18, dt); return; }
    bite.t += dt;
    const u = bite.t / bite.dur;
    // Wind up, lunge the head (shell) forward over planted paws, snap shut, recover.
    if (u < .2) { cmd.lean = lerp(cmd.lean, -.4, smoothstep(u / .2)); biteOpen = approach(biteOpen, .12, 20, dt); }
    else if (u < .46) {
      const k = smoothstep((u - .2) / .26);
      cmd.lean = lerp(-.4, 1.4, k); cmd.crouch = Math.max(cmd.crouch, .25 * k); cmd.tilt += 2 * k * D;
      biteOpen = approach(biteOpen, 1, 30, dt);
    } else if (u < .56) {
      cmd.lean = 1.4; cmd.tilt += 2 * D; biteOpen = approach(biteOpen, 0, 70, dt);
      if (!bite.snapped && u >= .5) { bite.snapped = true; onBite?.(hitInfo('bite')); }
    } else { cmd.lean = lerp(1.4, cmd.lean, smoothstep((u - .56) / .44)); biteOpen = approach(biteOpen, 0, 30, dt); }
    if (bite.swipe && !bite.swiped && u > .22 && st.feet.L.mode === 'plant') {
      bite.swiped = true;
      const f = st.feet.L;
      startSwing(f, f.cx + bite.dir * 24, f.cy, bite.dur * .36, 20);
    }
    if (u >= 1) { bite = null; onBite = null; }
  }

  function startTurn(side1: number, phi1: number) {
    const yaw0 = yawOf(clamp(st.phi.x, -1, 1)), yaw1 = yawOf(phi1);
    const flight = .3, apex = 34, push = .06;
    const a = apex / (1 + 2 * push / flight);
    jump = { kind: 'turn', dir: -side1, phase: 'dip', t: 0, dip: .07, push, flight, vx0: 0, vy0: -4 * a / flight, g: 8 * a / (flight * flight),
      freed: false, contactDone: true, landT: 0, side0: st.side, side1, phi0: st.phi.x, phi1, yaw0, yaw1, from: null, swapped: false };
    bite = null; onBite = null;
  }

  function update(dt: number, cmd: BodyCmd) {
    time += dt;
    // Facing the other way needs the mirrored side: turn around with a small hop.
    if (!jump && !bite && cmd.side !== st.side && !st.airborne) startTurn(cmd.side, cmd.phi);
    updateJump(dt, cmd);
    updateBite(dt, cmd);
    if (!jump || jump.kind !== 'turn') stepSpring(st.phi, cmd.phi, cmd.turnRate, 1, dt);
    stepSpring(st.crouch, cmd.crouch, jump ? 24 : 9, 1, dt);
    stepSpring(st.lean, cmd.lean, bite ? 28 : 9, bite ? .78 : 1, dt);
    stepSpring(st.tilt, cmd.tilt, 8, .8, dt);
    stepSpring(st.bob, 0, 20, .55, dt);
    stepSpring(st.sway, 0, 14, .7, dt);
    stepSpring(st.squash, 0, 22, .45, dt);
    if (!jump) stepSpring(st.spin, 0, 14, .9, dt);
    const phi = clamp(st.phi.x, -1, 1);
    const stance = homeStance(phi);
    if (!jump || jump.phase === 'dip') {
      const accel = cmd.gait === 'stalk' ? 420 : 900;
      const target = cmd.freeze || jump ? 0 : cmd.v;
      st.vX += clamp(target - st.vX, -accel * dt, accel * dt);
      // Never outrun a planted paw: slow down when one nears the end of its band.
      const vLoc = st.side * st.vX;
      for (const b of BONES) {
        const f = st.feet[b];
        if (f.mode !== 'plant') continue;
        const [lx, ly] = plantedLocal(f);
        const local = attachLocal(st.pose, b, lx, ly);
        const over = vLoc < 0 ? local.x - (local.halfWidth - 14) : -(local.halfWidth - 14) - local.x;
        if (over > 0) st.vX *= Math.max(0, 1 - over / 16);
      }
    }
    let nx = st.X + st.vX * dt;
    if (nx < bounds.min || nx > bounds.max) { nx = clamp(nx, bounds.min, bounds.max); st.vX = 0; }
    st.X = nx;
    if (!st.airborne && (!jump || jump.phase === 'dip') && !(jump && jump.kind === 'turn')) planSteps(stance, homeStance(clamp(lerp(phi, cmd.phi, .6), -1, 1)), cmd);
    updateFeet(stance, cmd, dt);
    return composePose(stanceAt(phi), cmd, dt);
  }

  return {
    st,
    get time() { return time; },
    get jumping() { return !!jump && jump.kind !== 'turn'; },
    get turning() { return !!jump && jump.kind === 'turn'; },
    get jumpPhase() { return jump?.phase ?? null; },
    get biting() { return !!bite; },
    get mouthOpen() { return biteOpen; },
    get slip() { return slip; },
    get stepping() { return BONES.some(b => st.feet[b].mode === 'swing'); },
    setBounds(min: number, max: number) { bounds = { min, max }; },
    update, hitInfo,
    /** Start a jump (screen direction `dir`) whose front paws land at world x `targetX` (a swat peaks there instead). */
    jump(kind: JumpKind, dir: number, targetX: number, height: number, contact: (info: ContactInfo) => void, end: () => void) {
      // Pounce/hop: the leading front paw lands at targetX. Swat: it passes it at the top of the leap.
      const fk = FLIGHT[kind === 'swat' ? 'mid' : 'preland'];
      const pawOffset = fk.L[0] * .7 + fk.R[0] * .3 - 16;   // body frame, ahead of the root
      let dx = (targetX - toWorld(pawOffset)) * (kind === 'swat' ? 2 : 1);
      if (Math.sign(dx) !== dir) dx = dir * 24;
      const reach = kind === 'pounce' ? 460 : kind === 'hop' ? 300 : 380;
      dx = clamp(dx, -reach, reach);
      dx = clamp(st.X + dx, bounds.min, bounds.max) - st.X;
      const dist = Math.abs(dx);
      // Low, fast arcs: a pounce is a lunge, not a float.
      const apex = kind === 'swat' ? clamp(height, 50, 170) : kind === 'hop' ? clamp(26 + dist * .12 + Math.max(0, height - 40) * .5, 30, 80) : clamp(24 + dist * .13 + Math.max(0, height - 40) * .6, 40, 140);
      const flight = kind === 'swat' ? clamp(.26 + apex / 1000, .3, .44) : clamp(.2 + dist / 2400 + apex / 2000, .24, .4);
      const push = kind === 'hop' ? .08 : .1;
      // The push already rises (vy ramps up); size the ballistic part so the total apex is as planned.
      const a = apex / (1 + 2 * push / flight);
      jump = { kind, dir, phase: kind === 'pounce' ? 'push' : 'dip', t: 0, dip: kind === 'pounce' ? 0 : .11, push, flight,
        vx0: dx / (flight + push * .5 + .06), vy0: -4 * a / flight, g: 8 * a / (flight * flight), freed: false, contactDone: false, landT: 0,
        side0: st.side, side1: st.side, phi0: st.phi.x, phi1: st.phi.x, yaw0: 0, yaw1: 0, from: null, swapped: false };
      onContact = contact; onJumpEnd = end;
    },
    bite(dir: number, swipe: boolean, snap: (info: ContactInfo) => void) {
      bite = { t: 0, dur: .62 + rand() * .1, dir, snapped: false, swipe, swiped: false };
      onBite = snap;
    },
    /** Drop any action at once; airborne paws are planted where they are. */
    cancelActions() {
      if (jump?.kind === 'turn' && !jump.swapped) turnYaw = null;
      jump = null; bite = null; onContact = null; onJumpEnd = null; onBite = null; turnYaw = null;
      st.airborne = false; st.ry = 0; st.vy = 0;
      const stance = homeStance(st.phi.x);
      for (const b of BONES) {
        const f = st.feet[b];
        if (f.mode === 'plant') continue;
        const j = st.pose[b], lp = lowestPoint(b, j[2], j[3], j[4]);
        f.a = j[2]; f.sx = j[3]; f.sy = j[4];
        plant(f, toWorld(j[0] + lp.dx), stance.feet[b].g);
      }
    },
    /** Initialise from the idle's current pose so the takeover is seamless. */
    reset(pose: BodyPose) {
      st.X = 0; st.vX = 0; st.ry = 0; st.vy = 0; st.airborne = false; st.side = 1; jump = null; bite = null; turnYaw = null; prevVL = 0; prevVY = 0;
      st.phi.x = pose.yaw >= 28 ? -(pose.yaw - 28) / (STANCE_LEFT.yaw - 28) : (28 - pose.yaw) / (28 - STANCE_FRONT.yaw); st.phi.v = 0;
      for (const s of [st.crouch, st.lean, st.tilt, st.sway, st.squash, st.spin]) { s.x = 0; s.v = 0; }
      st.bob.x = pose.b[1]; st.bob.v = 0;
      st.tail.x.x = pose.T[0]; st.tail.y.x = pose.T[1]; st.tail.a.x = pose.T[2];
      st.tail.x.v = st.tail.y.v = st.tail.a.v = 0;
      for (const b of BONES) {
        const j = pose[b], f = st.feet[b];
        const sy = Math.min(j[4], 1), lp = lowestPoint(b, j[2], j[3], sy);
        f.mode = 'plant'; f.a = j[2]; f.sx = j[3]; f.sy = sy; f.cx = j[0] + lp.dx; f.cy = j[1] + lp.dy; f.plantedAt = time;
      }
      st.pose = resolveBody(JSON.parse(JSON.stringify(pose)) as BodyPose);
      st.pose.side = 1;
    },
    /** Screen x of a point in the body frame (relative to the root). */
    toWorld,
  };
}
export type HuntBody = ReturnType<typeof createBody>;
// ================================================================== idle pose (01-idle.svg)
// The idle loop's own keyframes (choreography.mjs "idle", 5.4 s, CSS
// ease-in-out per segment) so a takeover starts from the frame on screen.
const IDLE_KEYS: [number, Partial<BodyPose>][] = [
  [0, {}], [24, { b: [0, -3, 0, 1, 1.008], T: [145, -355, -3, 1, 1] }], [28, { yaw: 22 }], [55, { yaw: 22 }],
  [60, { yaw: 32, T: [145, -355, 4, 1, 1] }], [82, { yaw: 32 }], [88, {}], [100, {}],
];
export const IDLE_SECONDS = 5.4;
const cubicBezierY = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x;
    const d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
    if (Math.abs(d) < 1e-6) break;
    t = clamp01(t - cx / d);
  }
  return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
};
const easeInOutCss = cubicBezierY(.42, 0, .58, 1);
const lerpPose = (a: BodyPose, b: BodyPose, t: number): BodyPose => ({
  yaw: lerp(a.yaw, b.yaw, t), b: mixJoint(a.b, b.b, t), L: mixJoint(a.L, b.L, t), R: mixJoint(a.R, b.R, t),
  HL: mixJoint(a.HL, b.HL, t), HR: mixJoint(a.HR, b.HR, t), T: mixJoint(a.T, b.T, t),
  rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), spin: lerp(a.spin, b.spin, t), zoom: lerp(a.zoom, b.zoom, t),
});
/** Body and face of 01-idle.svg at `seconds` into its loop (gaze excluded: the site drives the pupils). */
export function idlePoseAt(seconds: number): { body: BodyPose; face: FacePose } {
  const pct = ((seconds % IDLE_SECONDS) + IDLE_SECONDS) % IDLE_SECONDS / IDLE_SECONDS * 100;
  let i = 0;
  while (i < IDLE_KEYS.length - 2 && IDLE_KEYS[i + 1][0] <= pct) i++;
  const [t0, a] = IDLE_KEYS[i], [t1, b] = IDLE_KEYS[i + 1];
  const pa = resolveBody({ ...restPose(), ...a } as BodyPose), pb = resolveBody({ ...restPose(), ...b } as BodyPose);
  const body = lerpPose(pa, pb, easeInOutCss((pct - t0) / (t1 - t0)));
  const face = neutralFace();
  if (pct >= 60 && pct < 84) { face.happy = 1; face.cheeks = 1; }
  for (const at of [23, 76]) {
    const d = pct - at, close = 6 / IDLE_SECONDS, open = 16 / IDLE_SECONDS;
    if (d >= 0 && d < close) face.blink = d / close;
    else if (d >= close && d < open) face.blink = 1 - (d - close) / (open - close);
  }
  return { body, face };
}

// ================================================================== face
type Channel = Exclude<keyof FacePose, 'gx' | 'gy' | 'blink'>;
const CHANNELS: Channel[] = ['pupil', 'smile', 'wide', 'squint', 'frown', 'raise', 'happy', 'focus', 'angry', 'pout', 'o', 'open', 'puff', 'cheeks'];
export interface FaceCmd {
  look: [number, number] | null;  // pupil target offset (eye units) or null to centre
  pursuit: boolean;               // follow a slowly moving target smoothly instead of saccades only
  noBlink: boolean; blinkNow: boolean;
  expr: Partial<Record<Channel, number>>; rate: Partial<Record<Channel, number>>;
}
export function createFace(rand: () => number) {
  const f = neutralFace();
  let sacc: { x0: number; y0: number; x1: number; y1: number; t: number; delay: number } | null = null;
  let blinkT = -1, nextBlink = 1.6 + rand() * 3, doubleBlink = false;
  return {
    f,
    reset(face: FacePose) { Object.assign(f, face); sacc = null; blinkT = face.blink > 0 ? .06 * face.blink : -1; },
    update(dt: number, cmd: FaceCmd) {
      // Gaze: 85 ms saccades with a short latency; smooth pursuit for small slow moves.
      const tx = cmd.look ? clamp(cmd.look[0], -9, 9) : 0, ty = cmd.look ? clamp(cmd.look[1], -7, 7) : 0;
      if (sacc) {
        sacc.t += dt;
        if (sacc.t > sacc.delay) {
          const u = clamp01((sacc.t - sacc.delay) / .085);
          f.gx = lerp(sacc.x0, sacc.x1, u); f.gy = lerp(sacc.y0, sacc.y1, u);
          if (u >= 1) sacc = null;
        }
      } else {
        const d = Math.hypot(tx - f.gx, ty - f.gy);
        if (d > 1.7) sacc = { x0: f.gx, y0: f.gy, x1: tx, y1: ty, t: 0, delay: .04 + rand() * .07 };
        else if (cmd.pursuit) { f.gx = approach(f.gx, tx, 9, dt); f.gy = approach(f.gy, ty, 9, dt); }
      }
      // Blinks: 60 ms close, 100 ms open; none while staring at prey.
      if (blinkT < 0) {
        nextBlink -= dt;
        if (cmd.blinkNow || (nextBlink <= 0 && !cmd.noBlink)) { blinkT = 0; doubleBlink = !cmd.blinkNow && rand() < .15; nextBlink = 2.2 + rand() * 3.6; }
      }
      if (blinkT >= 0) {
        blinkT += dt;
        f.blink = blinkT < .06 ? blinkT / .06 : blinkT < .16 ? 1 - (blinkT - .06) / .1 : 0;
        if (blinkT >= .16) { blinkT = doubleBlink ? -0.0001 : -1; if (doubleBlink) { doubleBlink = false; blinkT = 0; } }
      }
      for (const c of CHANNELS) {
        const target = cmd.expr[c] ?? (c === 'pupil' ? 1 : 0);
        f[c] = approach(f[c], target, cmd.rate[c] ?? 7, dt);
      }
      return f;
    },
  };
}

// ================================================================== brain + public controller
export interface HuntEnv {
  /** Container rect at its committed position (travel excluded), viewport px. */
  box: { left: number; top: number; width: number };
  /** Allowed root travel in px relative to the committed box (keeps the pet out of edge zones). */
  travel: { min: number; max: number };
  /** Host gate: the hunt may take over the art now (idle, not dragged, no music…). */
  canStart: boolean;
  /** Host request while active: 'soft' settles back to rest (≤ ~0.5 s), 'hard' ends at once. */
  stop?: 'soft' | 'hard' | null;
  /** Idle loop time and site pupil offset at the moment of takeover. */
  idle?: { time: number; gx: number; gy: number };
  /** Begin already engaged, skipping the notice glances: the host played its own
   *  approach (the bottom-edge emerge). Read only when the hunt starts. */
  engage?: { mode: 'chase' | 'stalk'; face?: FacePose; interest?: number } | null;
}
export type HuntEvent =
  | { type: 'start' }
  | { type: 'contact'; kind: string; hit: boolean }
  | { type: 'outcome'; hit: boolean }
  | { type: 'end'; travelPx: number };
export interface HuntFrame {
  active: boolean; pose: HuntPose; travelPx: number;
  mode: string; sub: string; interest: number; events: HuntEvent[];
  debug: { slip: number; X: number; cursor: [number, number] | null; hit?: ContactInfo & { cursor: [number, number]; result: boolean } };
}
interface Cursor { x: number; y: number; t: number }

export const HUNT_TUNING = {
  shell: 500,            // shell width in rig units, the distance unit below
  notice: 2.6, chase: 2.3, release: 3.3,   // × shell, elliptical (vertical counts 1.25×)
  boutTravel: 7,         // × shell of travel per bout before it loses interest
  still: 38,             // rig units/s below which the cursor counts as still
};

export function createMouseHuntController(options: { seed?: number } = {}) {
  const rand = mulberry32(options.seed ?? 20261025);
  const body = createBody(rand);
  const face = createFace(rand);
  const cmd = defaultCmd();
  const fcmd: FaceCmd = { look: null, pursuit: true, noBlink: false, blinkNow: false, expr: {}, rate: {} };
  const U = HUNT_TUNING.shell;
  let active = false, mode = 'off', sub = '', subT = 0, subDur = 0, modeT = 0;
  let interest = 0, stillT = 0, cursorSpeed = 0, lastDirX = 0, present = false, lastMoveT = -1e9;
  let now = 0;
  let cursor: Cursor | null = null, prevCursor: Cursor | null = null;
  let px = { x: 0, y: 0, t: 0, has: false };
  let busyT = 0, cooldown = 0, satisfied = false, attempts = 0, boutTravel = 0, lastX = 0, glance = 0, glanceT = 0;
  let facing = -1, pendingDir = 0, pendingT = 0;
  let plan: { kind: 'pounce' | 'hop' | 'swat' | 'bite'; tx: number; ty: number; dist: number } | null = null;
  let outcome: boolean | null = null, lastHit: HuntFrame['debug']['hit'];
  let goal = 0, moving = false, burstT = 0, tentative = false, tiltT = 0, tiltSide = 0;
  let freezes = 0, pauseIn = 1.5, standoff = 150, creepBurst = 0, creepSpeed = 70, holdPaw = false;
  let events: HuntEvent[] = [];
  let soft = false;
  let geo = { s: 1, left: 0, top: 0 };
  const pxPerRu = () => geo.s * PS;

  const toWorld = (x: number, y: number): [number, number] => [((x - geo.left) / geo.s - PX) / PS, ((y - geo.top) / geo.s - PY) / PS];
  const head = () => { const [x, y] = facePoint(body.st.pose, -73.5, -140); return [body.toWorld(x), y] as [number, number]; };
  // The leading edge of the shell at mouth height (the body faces left in its own frame).
  const snapPoint = () => { const p = body.st.pose, v = view(p.yaw, p.sideMin); const [x, y] = shellPoint(p, -v.width / 2, -112); return [body.toWorld(x), y] as [number, number]; };
  const frontEdge = (_dir: number) => snapPoint()[0];
  const ground = () => 30;
  const setSub = (s: string, dur = 0) => { sub = s; subT = 0; subDur = dur; };
  const setMode = (m: string, s = '', dur = 0) => { mode = m; modeT = 0; setSub(s, dur); };
  const lookAt = (wx: number, wy: number): [number, number] => {
    const [hx, hy] = head();
    return [9 * Math.tanh((wx - hx) / 150), 7 * Math.tanh((wy - hy) / 120)];
  };
  const dist = () => {
    if (!cursor) return Infinity;
    const [hx, hy] = head();
    return Math.hypot(cursor.x - hx, (cursor.y - hy) * 1.25) / U;
  };
  const turnToward = (wx: number, hysteresis = 50) => {
    const [hx] = head();
    const want = wx < hx - hysteresis ? -1 : wx > hx + hysteresis ? 1 : facing;
    if (want !== facing && want !== 0 && pendingDir !== want) { pendingDir = want; pendingT = .13 + rand() * .12; }
    if (want === facing) pendingDir = 0;
  };
  // Screen facing → body command: facing right is the mirrored side in profile.
  const faceCmd = (f: number) => { cmd.side = f > 0 ? -1 : 1; cmd.phi = f === 0 ? 0 : -1; };
  const turned = () => !body.turning && body.st.side === (facing > 0 ? -1 : 1) && Math.abs(body.st.phi.x - (facing === 0 ? 0 : -1)) < .35;

  function begin(env: HuntEnv) {
    const idle = idlePoseAt(env.idle?.time ?? 0);
    body.reset(idle.body);
    face.reset({ ...idle.face, gx: env.idle?.gx ?? 0, gy: env.idle?.gy ?? 0 });
    active = true; soft = false; boutTravel = 0; lastX = 0; attempts = 0; satisfied = false;
    facing = 0; pendingDir = 0;
    events.push({ type: 'start' });
  }
  // Engaged start: the host already watched the cursor with the pet (begin() posed it).
  function enter(e: NonNullable<HuntEnv['engage']>) {
    if (e.face) face.reset({ ...e.face });
    interest = Math.max(interest, clamp01(e.interest ?? .6));
    if (e.mode === 'stalk') startStalk();
    else { setMode('chase', 'track'); pauseIn = 1 + rand() * 1.4; standoff = 110 + rand() * 90; goal = body.st.X; moving = false; }
  }
  function finish() {
    events.push({ type: 'end', travelPx: body.st.X * pxPerRu() });
    active = false; setMode('off');
    cooldown = 1.2; interest = Math.min(interest, .12);
  }
  function hitTest(info: ContactInfo): boolean {
    if (!cursor || !present) { lastHit = { ...info, cursor: [NaN, NaN], result: false }; return false; }
    const c: [number, number] = [cursor.x, cursor.y];
    const near = (p: [number, number], r: number) => Math.hypot(c[0] - p[0], c[1] - p[1]) < r;
    const [a, b] = info.paws;
    const segT = clamp01(((c[0] - a[0]) * (b[0] - a[0]) + (c[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1));
    const seg = Math.hypot(c[0] - lerp(a[0], b[0], segT), c[1] - lerp(a[1], b[1], segT));
    // Under the paws also counts: a cursor resting just below the contact line.
    const under = c[1] > ground() - 10 && c[1] < ground() + 70 && c[0] > Math.min(a[0], b[0]) - 40 && c[0] < Math.max(a[0], b[0]) + 40;
    const snap = snapPoint();
    const result = info.kind === 'bite'
      ? near(info.mouth, 66) || near(snap, 96)
      : near(a, 62) || near(b, 62) || seg < 46 || near(info.mouth, 62) || near(snap, 72) || (info.kind !== 'swat' && under);
    lastHit = { ...info, cursor: c, result };
    return result;
  }

  // ---------------------------------------------------------------- per-mode behaviour
  function think(dt: number) {
    const d = dist();
    const [hx] = head();
    const c = cursor;
    const near = c && present;
    const gnd = ground();
    const h = c ? gnd - c.y : 0;                     // cursor height above the ground line
    const dir = facing || (c && c.x > hx ? 1 : -1);
    const fe = frontEdge(dir);
    const ahead = c ? (c.x - fe) * dir : 0;          // distance in front of the front edge
    // defaults for this frame
    cmd.gait = 'still'; cmd.freeze = false; cmd.holdPaw = false; cmd.tread = 0; cmd.v = 0; cmd.turnRate = 7;
    cmd.crouch = 0; cmd.lean = 0; cmd.tilt = 0;
    cmd.tail = 'calm'; cmd.tailAmount = 1; cmd.precise = mode === 'settle' || soft;
    fcmd.noBlink = false; fcmd.blinkNow = false; fcmd.pursuit = true; fcmd.rate = {};
    const look = (x: number, y: number) => { fcmd.look = lookAt(x, y); };
    const lookCursor = () => { if (c) look(c.x, c.y); };
    const tiltUp = c ? clamp(h / 420, -.4, 1) * 4 : 0;   // body frame: positive lifts the nose
    subT += dt; modeT += dt;
    if (pendingDir) { pendingT -= dt; if (pendingT <= 0) { facing = pendingDir; pendingDir = 0; } }
    faceCmd(facing);
    const leaving = !near || d > HUNT_TUNING.release;

    if (soft) {
      // Quick settle requested by the host.
      fcmd.look = null; fcmd.expr = {}; fcmd.rate = { smile: 12, frown: 12, cheeks: 10, pout: 12, puff: 12, wide: 12, raise: 12 };
      faceCmd(0); cmd.turnRate = 12; cmd.crouch = 0; cmd.lean = 0; cmd.tilt = 0;
      return;
    }

    if (mode === 'notice') {
      // Eyes first: a few looks before the body commits.
      cmd.crouch = .14; cmd.tail = 'alert'; cmd.tilt = tiltUp * .5;
      fcmd.expr = { pupil: 1.05 + .08 * interest, focus: .25 };
      glanceT -= dt;
      if (glanceT <= 0) {
        glance++;
        glanceT = glance % 2 ? .38 + rand() * .4 : .16 + rand() * .16;
        if (!(glance % 2) && rand() < .45) fcmd.blinkNow = true;
      }
      if (glance % 2 || !c) lookCursor(); else if (c) { const [gx, gy] = lookAt(c.x, c.y); fcmd.look = [gx * .35, gy * .3 + 1]; }
      if (c && glance >= 1) turnToward(c.x, 90);
      if (leaving && modeT > .5) { setMode('settle'); return; }
      if (interest < .1 && modeT > 1) { setMode('settle'); return; }
      if (glance >= 3 && c) {
        // A resting cursor is prey to stalk; a moving one is a toy to chase.
        if (stillT > .45 && !satisfied && interest > .15) startStalk();
        else if (stillT <= .45 && interest > .42) { setMode('chase', 'track'); pauseIn = 1 + rand() * 1.4; standoff = 110 + rand() * 90; goal = body.st.X; moving = false; }
      }
      return;
    }

    if (mode === 'chase') {
      cmd.tail = interest > .7 ? 'twitch' : 'alert';
      fcmd.expr = { pupil: 1.08 + .1 * interest, focus: .55 };
      lookCursor();
      if (sub !== 'strike') {
        if (leaving) { if (modeT > .3) setMode('settle'); return; }
        if (boutTravel > HUNT_TUNING.boutTravel * U) { interest = Math.min(interest, .2); setMode('settle'); return; }
        if (stillT > .65 && !satisfied && cooldown <= 0) { startStalk(); return; }
      }
      cooldown -= dt;
      if (sub === 'track') {
        if (c) turnToward(c.x);
        cmd.crouch = .24; cmd.tilt = tiltUp;
        if (c && turned()) {
          // The eyes follow every wiggle; the body repositions in deliberate
          // bursts toward a smoothed goal, with a hesitant first step sometimes.
          const raw = c.x - dir * (standoff + (Math.abs(fe - body.st.X)));
          goal = approach(goal, raw, 2.4, dt);
          const err = goal - body.st.X;
          if (!moving && Math.abs(err) > 70) { moving = true; burstT = 0; tentative = rand() < .35; }
          if (moving && Math.abs(err) < 24) moving = false;
          let v = 0;
          if (moving) {
            burstT += dt;
            const vmax = 230 + 170 * interest;
            v = clamp(err * 2.5, -vmax, vmax);
            if (Math.sign(v) !== dir) v = clamp(v, -90, 90);   // back off a little without turning
            v *= tentative ? lerp(.35, 1, smoothstep((burstT - .15) / .35)) : smoothstep(burstT / .18);
          }
          cmd.v = v; cmd.gait = 'walk';
          cmd.lean = clamp(v * dir / 900, -.1, .3) + clamp((c.x - hx) * dir / 2600, -.08, .12);
          pauseIn -= dt * (moving ? 1 : .5);
        }
        const catchable = cursorSpeed < 2200;
        if (c && cooldown <= 0 && catchable && turned() && ahead > -70 && ahead < (moving ? 300 : 360) && h > -60 && h < 320) {
          const kind = strikeKind(ahead, h);
          if (kind) { startStrike(kind); return; }
        }
        if (pauseIn <= 0) { setSub('pause', .35 + rand() * .55); pauseIn = 1 + rand() * 1.6; }
        return;
      }
      if (sub === 'pause') {
        // Stop, judge the distance: a curious head tilt and a little weight shift.
        cmd.crouch = .36; cmd.tail = 'twitch';
        // Discrete curious tilts: settle on one side, hold, maybe switch.
        tiltT -= dt;
        if (tiltT <= 0) { tiltSide = rand() < .5 ? -tiltSide || 1 : 0; tiltT = .28 + rand() * .3; }
        cmd.tilt = tiltUp + tiltSide * 3.2;
        cmd.tread = subT > subDur * .5 && rand() < .3 ? .4 : 0;
        if (c) turnToward(c.x, 90);
        if (subT > subDur) {
          tiltSide = 0; standoff = 100 + rand() * 100;
          // A pause often ends in a strike when the toy is within reach.
          if (c && cooldown <= 0 && cursorSpeed < 2200 && turned() && ahead > -60 && ahead < 380 && h > -60 && h < 320 && rand() < .65) { const kind = strikeKind(ahead, h); if (kind) { startStrike(kind); return; } }
          setSub('track');
        }
        return;
      }
      if (sub === 'strike') {
        cmd.crouch = .2;
        // A hop bites in the air: the mouth opens on the way and snaps at contact.
        if (plan && plan.kind !== 'bite') { const flying = body.jumpPhase === 'flight' || body.jumpPhase === 'push'; fcmd.expr = { ...fcmd.expr, open: flying ? .85 : 0 }; fcmd.rate = { open: flying ? 16 : 45 }; }
        return;
      }
      if (sub === 'react') {
        if (outcome) { fcmd.expr = { smile: .85, cheeks: .7, happy: .8, pupil: 1 }; fcmd.rate = { smile: 14 }; cmd.tail = 'wag'; cmd.tailAmount = .7; }
        else { fcmd.expr = { focus: .7, squint: .3, pupil: 1.05 }; cmd.tail = 'lash'; cmd.tailAmount = .4; if (subT < dt * 1.5) fcmd.blinkNow = true; }
        cmd.crouch = .25;
        if (subT > subDur) { setSub('track'); cooldown = .7 + rand() * .8; standoff = 120 + rand() * 90; }
        return;
      }
      return;
    }

    if (mode === 'stalk') {
      const t = plan;
      const prey = c && near;
      if (sub === 'fixate' || sub === 'creep' || sub === 'freeze') {
        // Prey moved a lot or left before the charge: reassess instead of pouncing.
        if (!prey || d > HUNT_TUNING.release) { setMode('settle'); return; }
        if (t && c && Math.hypot(c.x - t.tx, c.y - t.ty) > 140) { setMode('chase', 'pause', .3 + rand() * .3); return; }
      }
      if (sub === 'fixate') {
        cmd.freeze = true; cmd.crouch = .55; cmd.tail = 'low'; cmd.tailAmount = .7; cmd.tilt = tiltUp * .6;
        fcmd.noBlink = true; fcmd.expr = { pupil: 1.16, focus: .9, squint: .2 }; fcmd.rate = { pupil: 3 };
        lookCursor();
        if (c) turnToward(c.x, 30);
        if (subT > subDur && turned()) { setSub('creep'); creepBurst = .9 + rand() * .8; }
        return;
      }
      if (sub === 'creep' || sub === 'freeze') {
        cmd.crouch = .78; cmd.tail = 'low'; cmd.tailAmount = 1; cmd.lean = .22; cmd.gait = 'stalk'; cmd.tilt = tiltUp * .5;
        fcmd.noBlink = true; fcmd.expr = { pupil: 1.18, focus: 1, squint: .25 };
        lookCursor();
        if (c) turnToward(c.x, 30);
        const want = t ? t.dist : 260;
        if (sub === 'creep') {
          if (!turned()) { cmd.freeze = true; return; }
          // Quicker while far, slowing as the gap closes.
          if (ahead > want + 30) cmd.v = dir * creepSpeed * clamp(.6 + (ahead - want) / 500, .6, 1.25);
          else if (ahead < 60) cmd.v = -dir * 50;                // too close: back off a little
          creepBurst -= dt;
          if (creepBurst <= 0 && ahead > want + 150 && freezes < 2) { setSub('freeze', .25 + rand() * .3); holdPaw = rand() < .5; freezes++; }
          else if (ahead <= want + 30 && ahead >= 60) setSub('gather', .6 + rand() * .4);
        } else {
          cmd.freeze = true; cmd.holdPaw = holdPaw; cmd.tail = 'twitch'; cmd.tailAmount = .6;
          if (subT > subDur) { setSub('creep'); creepBurst = .9 + rand() * .8; }
        }
        return;
      }
      if (sub === 'gather') {
        // Weight back, hind paws tread, tail tip flicks, then go.
        cmd.freeze = true; cmd.crouch = 1; cmd.lean = -.42; cmd.tread = subT > .12 ? .9 : 0; cmd.tail = 'twitch'; cmd.tailAmount = 1.2;
        cmd.tilt = tiltUp * .4;
        fcmd.noBlink = true; fcmd.expr = { pupil: 1.2, focus: 1, squint: .3 };
        lookCursor();
        if (subT > subDur && !body.stepping) launch();
        return;
      }
      if (sub === 'air') {
        cmd.tail = 'alert'; fcmd.noBlink = true;
        fcmd.expr = { pupil: 1.15, focus: .4, wide: .3, open: 0 };
        if (t) look(t.tx, t.ty);
        return;
      }
      if (sub === 'hit') { hitBeat(dt); return; }
      if (sub === 'miss') { missBeat(dt); return; }
      return;
    }

    if (mode === 'settle') {
      cmd.crouch = 0; cmd.lean = 0; cmd.tilt = 0;
      fcmd.expr = {}; fcmd.rate = { smile: 5, cheeks: 3, frown: 4, pout: 4, puff: 5 };
      if (modeT < .55 && c) lookCursor(); else fcmd.look = null;
      if (modeT > .35) faceCmd(0);
      // Interest can return while settling.
      if (near && d < HUNT_TUNING.chase && interest > .5 && modeT > .3 && cooldown <= 0) { setMode('chase', 'track'); pauseIn = .8 + rand(); }
      return;
    }
  }

  function startStalk() {
    if (!cursor) return;
    setMode('stalk', 'fixate', .45 + rand() * .35);
    // A toy above the face is leapt at from closer, so the leap is mostly upward.
    const high = ground() - cursor.y > 175;
    plan = { kind: 'pounce', tx: cursor.x, ty: cursor.y, dist: high ? 120 + rand() * 60 : 270 + rand() * 160 };
    freezes = 0;
    creepSpeed = 130 + rand() * 30;
    outcome = null;
  }
  // Reach of the existing body: the face (mouth height ≈ 140 rig units above the
  // floor) bites what is in front of it; a hop lands paws and face on a low or
  // face-high toy; only a toy above the head calls for a leap with raised paws.
  function strikeKind(ahead: number, h: number): 'bite' | 'hop' | 'swat' | null {
    if (h >= 200) return ahead < 190 ? 'swat' : null;   // a high toy is leapt at only from close by
    if (ahead < 125 && h > 40) return 'bite';
    return 'hop';
  }
  function startStrike(kind: 'bite' | 'hop' | 'swat') {
    if (!cursor) return;
    setSub('strike');
    outcome = null;
    const dir = facing;
    const done = () => { setSub('react', outcome ? .55 : .35); };
    if (kind === 'bite') {
      body.bite(dir, rand() < .5, info => { outcome = hitTest(info); events.push({ type: 'contact', kind: 'bite', hit: outcome }); });
      // The bite has no end callback: check its flag in step().
      plan = { kind, tx: cursor.x, ty: cursor.y, dist: 0 };
      return;
    }
    plan = { kind, tx: cursor.x, ty: cursor.y, dist: 0 };
    const h = ground() - cursor.y;
    body.jump(kind, dir, cursor.x, kind === 'swat' ? h - 70 : h, info => { outcome = hitTest(info); events.push({ type: 'contact', kind, hit: outcome }); }, done);
  }
  function launch() {
    if (!cursor || !plan) { setMode('settle'); return; }
    const dir = facing;
    const h = ground() - plan.ty;
    // Face-high or lower: land on it (paws and face arrive together); higher: leap with raised paws.
    const high = h > 175;
    setSub('air');
    attempts++;
    body.jump(high ? 'swat' : 'pounce', dir, plan.tx, high ? h - 70 : h, info => {
      outcome = hitTest(info);
      events.push({ type: 'contact', kind: high ? 'swat' : 'pounce', hit: outcome });
    }, () => { events.push({ type: 'outcome', hit: !!outcome }); setSub(outcome ? 'hit' : 'miss'); if (outcome) satisfied = true; });
  }

  function hitBeat(dt: number) {
    const t = subT;
    const c = cursor;
    cmd.freeze = true;
    if (t < .5) {
      // Pin: lean over the paws and look down to check.
      cmd.crouch = .5; cmd.lean = .35; cmd.tail = 'low'; cmd.tailAmount = .5;
      fcmd.look = [3 * (facing || -1), 7]; fcmd.pursuit = false; fcmd.noBlink = true;
      fcmd.expr = { pupil: 1.12, focus: .6, wide: .15 };
    } else if (t < .78) {
      cmd.crouch = .45; cmd.lean = .4; cmd.tilt = -3;
      fcmd.look = [-2 * facing, 6]; fcmd.expr = { pupil: 1.05, focus: .3 };
      if (t - dt < .5) fcmd.blinkNow = true;
    } else if (t < 2.05) {
      cmd.crouch = .22; cmd.lean = .1; cmd.tail = 'wag'; cmd.tailAmount = 1;
      fcmd.look = [0, 1];
      fcmd.expr = { smile: 1, cheeks: 1, happy: 1, pupil: 1 }; fcmd.rate = { smile: 9, cheeks: 5, happy: 8 };
      if ((t - dt < .9 && t >= .9) || (t - dt < 1.25 && t >= 1.25)) body.st.bob.v -= 90;
    } else if (t < 2.6) {
      cmd.crouch = .1; cmd.tail = 'wag'; cmd.tailAmount = .4;
      fcmd.expr = { cheeks: .5, happy: .6 }; fcmd.rate = { smile: 6, cheeks: 2, happy: 3 };
      if (c) fcmd.look = lookAt(c.x, c.y);
    } else {
      cooldown = 1.4;
      if (cursor && present && dist() < HUNT_TUNING.chase && cursorSpeed > HUNT_TUNING.still) setMode('chase', 'pause', .5);
      else setMode('settle');
    }

  }
  function missBeat(dt: number) {
    const t = subT;
    const c = cursor;
    cmd.freeze = t < .55;
    if (t < .36) {
      // Stunned for a moment: wide eyes, small "o", looking at the empty paws.
      cmd.crouch = .5; cmd.lean = .3;
      fcmd.look = [3 * (facing || -1), 6.5]; fcmd.pursuit = false; fcmd.noBlink = true;
      fcmd.expr = { wide: .9, pupil: .84, raise: .5, o: .55 }; fcmd.rate = { wide: 18, raise: 14, o: 14, pupil: 10 };
    } else if (t < .58) {
      cmd.crouch = .4;
      if (t - dt < .36) fcmd.blinkNow = true;
      fcmd.expr = { wide: .3, pupil: .95, raise: .2 }; fcmd.rate = { wide: 8, raise: 8, o: 12 };
      if (c) { fcmd.look = lookAt(c.x, c.y); turnToward(c.x, 60); }
    } else if (t < 1.4) {
      // Realises it missed: a frown builds; cheeks puff; tail flicks; one paw stamps.
      cmd.crouch = .3; cmd.tail = 'lash'; cmd.tailAmount = .75;
      if (c) { fcmd.look = lookAt(c.x, c.y); turnToward(c.x, 60); }
      fcmd.expr = { frown: .62, squint: .55, pout: 1, puff: t > .85 ? .85 : 0, pupil: 1 };
      fcmd.rate = { frown: 3.2, squint: 3, pout: 5, puff: 7 };
      if (t - dt < .95 && t >= .95) stamp();
    } else if (t < 2.05) {
      // "Hmph": glance away, then back.
      cmd.crouch = .22; cmd.tilt = 3; cmd.tail = 'lash'; cmd.tailAmount = .4;
      fcmd.expr = { frown: .55, squint: .45, pout: .9, puff: .5 };
      if (t < 1.72) fcmd.look = [5 * -facing, -1]; else if (c) fcmd.look = lookAt(c.x, c.y);
    } else if (t < 2.65) {
      cmd.crouch = .15; cmd.tail = 'calm';
      fcmd.expr = { frown: .3, squint: .2, pout: .4 }; fcmd.rate = { frown: 2.5, pout: 2.5, puff: 4 };
      if (c) fcmd.look = lookAt(c.x, c.y);
    } else {
      cooldown = .9;
      if (cursor && present && dist() < HUNT_TUNING.chase) {
        if (cursorSpeed > HUNT_TUNING.still * 2) setMode('chase', 'pause', .4);
        else if (attempts < 2 && stillT > .5) startStalk();
        else setMode('settle');
      } else setMode('settle');
    }

  }
  function stamp() {
    const f = body.st.feet[facing < 0 ? 'L' : 'R'];
    if (f.mode !== 'plant') return;
    f.mode = 'swing'; f.x0 = f.cx; f.y0 = f.cy; f.x1 = f.cx; f.y1 = f.cy; f.t = 0; f.dur = .2; f.lift = 16; f.hold = 0;
  }

  // ---------------------------------------------------------------- interest
  function sense(dt: number) {
    if (!px.has) { cursor = null; present = false; }
    else {
      const [x, y] = toWorld(px.x, px.y);
      prevCursor = cursor;
      cursor = { x, y, t: px.t };
    }
    const moved = prevCursor && cursor ? Math.hypot(cursor.x - prevCursor.x, cursor.y - prevCursor.y) : 0;
    const instSpeed = dt > 0 ? moved / dt : 0;
    cursorSpeed = approach(cursorSpeed, instSpeed, 8, dt);
    if (cursorSpeed < HUNT_TUNING.still) stillT += dt; else stillT = 0;
    if (instSpeed > 60) lastMoveT = now;
    if (prevCursor && cursor) {
      const vx = cursor.x - prevCursor.x;
      if (Math.abs(vx) / Math.max(dt, 1e-3) > 160) {
        const s = Math.sign(vx);
        if (lastDirX && s !== lastDirX && dist() < HUNT_TUNING.notice) interest += .1;
        lastDirX = s;
      }
    }
    const d = dist();
    if (present && cursor && d < HUNT_TUNING.notice) {
      const prox = 1 - d / HUNT_TUNING.notice;
      const s = cursorSpeed;
      // Teasing speeds count; a fast straight pass barely registers.
      const stim = smoothstep((s - 40) / 320) * (1 - smoothstep((s - 2600) / 3000));
      interest += dt * stim * (.35 + 1.1 * prox) * (busyT > 0 ? .2 : 1);
      // A cursor that came to rest nearby is interesting too (for a while).
      if (stillT > .3 && now - lastMoveT < 8 && !satisfied) interest += dt * .25 * prox;
    }
    // Watching a nearby cursor keeps the interest up; leaving or distance drains it.
    const watching = active && present && d < HUNT_TUNING.chase && !satisfied;
    interest -= dt * ((watching ? .04 : .16) + (present ? 0 : .5) + (d > HUNT_TUNING.release ? .35 : 0));
    interest = clamp01(interest);
    if (satisfied && cursorSpeed > 300) satisfied = false;
    busyT -= dt;
  }

  // ---------------------------------------------------------------- public
  return {
    body, face,
    /** Latest mouse position (viewport px). Call from a passive pointermove listener for mouse pointers only. */
    pointer(x: number, y: number) { px = { x, y, t: now, has: true }; present = true; },
    /** The mouse left the window. */
    leave() { present = false; },
    /** The user clicked or typed elsewhere: back off for a moment. */
    busy() { busyT = 2.5; interest *= .4; if (active && (mode === 'notice' || mode === 'chase')) setMode('settle'); },
    get active() { return active; },
    get mode() { return mode; },
    step(dtMs: number, env: HuntEnv): HuntFrame {
      const dt = clamp(dtMs / 1000, 0, .05);
      now += dt;
      events = [];
      geo = { s: env.box.width / 640, left: env.box.left, top: env.box.top };
      body.setBounds(env.travel.min / pxPerRu(), env.travel.max / pxPerRu());
      sense(dt);
      cooldown -= active ? 0 : dt;
      if (!active) {
        const engage = env.engage;
        if (env.canStart && !env.stop && present && cursor
          && (engage || (cooldown <= 0 && busyT <= 0 && interest > .3 && dist() < HUNT_TUNING.notice))) {
          begin(env);
          if (engage) enter(engage);
          else { setMode('notice'); glance = 0; glanceT = 0; }
        }
      } else if (env.stop === 'hard') {
        body.cancelActions(); finish();
      } else if (env.stop === 'soft' && !soft) {
        // Let a leap or turn already in the air finish; then settle back to rest.
        soft = true; setMode('settle');
      }
      if (active) {
        think(dt);
        if (sub === 'strike' && plan?.kind === 'bite' && !body.biting) setSub('react', outcome ? .55 : .4);
        const pose = body.update(dt, cmd);
        boutTravel += Math.abs(body.st.X - lastX); lastX = body.st.X;
        face.update(dt, fcmd);
        face.f.open = Math.max(face.f.open, body.mouthOpen);
        if (mode === 'settle' && settled()) finish();
        return frame(pose);
      }
      return frame(body.st.pose);
    },
  };

  function settled() {
    const st = body.st;
    if (body.jumping || body.turning || body.biting || body.stepping || st.side !== 1) return false;
    if (Math.abs(st.phi.x) > .015 || Math.abs(st.phi.v) > .05) return false;
    for (const s of [st.crouch, st.lean, st.tilt, st.bob, st.sway, st.squash, st.spin]) if (Math.abs(s.x) > .02 + (s === st.bob || s === st.sway ? .3 : 0) || Math.abs(s.v) > .5) return false;
    const f = face.f;
    if (Math.abs(f.gx) > .4 || Math.abs(f.gy) > .4 || f.smile > .03 || f.frown > .03 || f.cheeks > .03 || f.happy > .03 || f.pout > .03 || f.puff > .03 || f.wide > .03 || f.blink > .01) return false;
    const stance = homeStance(0);
    for (const b of BONES) {
      const ft = st.feet[b];
      const h = stance.feet[b];
      const lp = lowestPoint(b, ft.a, ft.sx, ft.sy);
      if (Math.abs(ft.cx - lp.dx - st.X - h.x) > 2.5 || Math.abs(ft.cy - h.g) > 1.5) return false;
    }
    return true;
  }
  function frame(pose: BodyPose): HuntFrame {
    const height = Math.max(0, -pose.ry);
    return {
      active, travelPx: active ? body.st.X * pxPerRu() : 0, mode, sub, interest, events,
      pose: { body: pose, face: { ...face.f }, shadow: { x: PS * pose.b[0] * .4, scale: 1 - height / 520, opacity: 1 - height / 420 } },
      debug: { slip: body.slip, X: body.st.X, cursor: cursor && present ? [cursor.x, cursor.y] : null, hit: lastHit },
    };
  }
}
