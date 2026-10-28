// Root Beast top-hang mouse play.
//
// While the pet hangs by its tail from the top edge (rootbeast-hang-rig.svg,
// data-hang="on"), a nearby mouse is first watched with the eyes, then the
// head (face shift + a small body tilt) follows in discrete, delayed
// re-orientations; the body only leans a little. Only when the mouse is
// inside what a front paw can reach by rotating at its own joint (no
// stretching: paw scale is never changed, the paw may shift at most
// HANG_PLAY_TUNING.ext rig units along its swing) does that paw swat at it,
// then swing back. Hit/miss reuse the hunt module's small reactions. When the
// mouse leaves, everything eases back to exactly the hang loop.
//
// Rig: rootbeast-hang-play-rig.svg = the hang rig unchanged + identity
// data-hp layers. Every value here is an offset on top of the rig's own CSS
// (hang progress, 4.8 s sway, blink), so rest = 0 = the original hang frame.
// The tail glyph and its hook point are outside every play layer: nothing
// here can move them. The container is never moved either.
//
// Reused from deskpet-mouse-hunt.ts (unchanged): createFace (85 ms saccades,
// blinks, expression channels), limbCentre (painted paw centre), the face
// renderer math and mouth/brow shapes (ported), the interest rule (ported),
// the hit/miss "react" expressions, mulberry32. Nothing here listens to the
// DOM, captures the pointer or moves the cursor; the host feeds samples.

import { createFace, limbCentre, mulberry32, neutralFace, PS, PX, PY, type FaceCmd, type FacePose } from './deskpet-mouse-hunt';

export type Paw = 'L' | 'R';
export interface PawPose { rot: number; ext: number; aim: number }
export interface HangPlayPose {
  /** deg about the √ vertex (145,-355): bar + body, never the tail. + swings the body left. */
  swing: number;
  /** deg about the body's hanging point (0,-190). + lowers the right side (head cocks right). */
  tilt: number;
  /** Face shift on the shell, rig units (head turn). */
  face: [number, number];
  /** Paw swing at its joint (deg, + = clockwise) and shift along it (rig units, ≤ ext). */
  paw: Record<Paw, PawPose>;
  /** Hind-leg dangle, deg. */
  hind: Record<Paw, number>;
  /** Expression channels of the hunt face; gx/gy are RELATIVE to the hang's own pupil offset (0 = hang default). */
  expr: FacePose;
}
/** Hang rig CSS state: --hc (deg), --hb, --hsw, --hm. */
export interface HangLoop { hc: number; hb: number; hsw: number; hm: number }
export interface HangPlayEnv {
  /** Container rect, viewport px (the hang position; width = height). */
  box: { left: number; top: number; width: number };
  /** Current hang rig state (readHangLoop), used for exact paw/eye positions. */
  loop: HangLoop;
  /** Host gate: hanging and fully settled, nothing else owns the art (see 接入说明). */
  canStart: boolean;
  /** 'soft' settles (≤ ~0.5 s), 'drag' yields within 0.2 s while the host already drags, 'hard' ends now. */
  stop?: 'soft' | 'drag' | 'hard' | null;
}
export type HangPlayEvent =
  | { type: 'start' }
  | { type: 'swipe'; paw: Paw }
  | { type: 'contact'; paw: Paw; hit: boolean }
  | { type: 'end'; to: 'rest' | 'drag' | 'hard' };
export interface ReachPlan { paw: Paw; rot: number; ext: number; aim: number; tilt: number; swing: number; miss: number }
export interface HangPlayFrame {
  active: boolean; pose: HangPlayPose; mode: string; sub: string; interest: number; events: HangPlayEvent[];
  debug: {
    cursor: [number, number] | null;          // rig units
    reach: ReachPlan | null;                  // best plan for the cursor right now
    reachable: boolean;
    paws: Record<Paw, [number, number]>;      // painted paw centres, rig units
    eyes: [number, number];                   // between the eyes, rig units
  };
}

// ------------------------------------------------------------------ geometry
/** Hook point on the 640 canvas (√ bar top centre), fixed in every pose. */
export const HANG_HOOK = { x: 463.85, y: 170.48 } as const;
export const viewportToRig = (box: HangPlayEnv['box'], x: number, y: number): [number, number] => {
  const s = box.width / 640;
  return [((x - box.left) / s - PX) / PS, ((y - box.top) / s - PY) / PS];
};
export const rigToViewport = (box: HangPlayEnv['box'], x: number, y: number): [number, number] => {
  const s = box.width / 640;
  return [box.left + (PX + PS * x) * s, box.top + (PY + PS * y) * s];
};
/** Rig units → viewport px for a container width. */
export const pxPerRig = (width: number) => width / 640 * PS;

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const DEG = Math.PI / 180;
const R = (deg: number): M => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return [c, s, -s, c, 0, 0]; };
const about = (x: number, y: number, m: M) => mul(mul(T(x, y), m), T(-x, -y));
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const invert = (m: M): M => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const wrap180 = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;

// Pivots of the play layers (rig units, body space at full hang).
const JOINT: [number, number] = [145, -355];          // √ vertex (hg-joint)
const HANG_POINT: [number, number] = [0, -190];       // body on the bar (hg-body / hg-breath)
const PAW_PIVOT: Record<Paw, [number, number]> = { L: [-180, -66], R: [150, -54] };          // .hg-pl/.hg-pr joints
const HIND_PIVOT: Record<Paw, [number, number]> = { L: [-101, -60], R: [126, -59.45] };      // .hg-hl/.hg-hr joints
const EYE_X = [-192, 45];

// The hang rig's CSS transforms (rootbeast-hang-rig.svg <style>), as numbers.
function hangCss(loop: HangLoop) {
  const hbc = clamp01(loop.hb), m = loop.hm;
  const hs = 2.2 * Math.sin(2 * loop.hc * DEG) * hbc * m;
  const hsl = 2.2 * Math.sin((2 * loop.hc - 50) * DEG) * hbc * m;
  const hl1 = Math.sin((2 * loop.hc - 100) * DEG) * hbc * m;
  const hk = 6 * Math.sin(loop.hsw * 720 * DEG) * (1 - loop.hsw) ** 2 * hbc * m;
  return {
    hbc, hl1,
    hbar: loop.hb * -41.31 + hs + hk,
    hbody: loop.hb * 38.31 + (hsl * .8 - hs - hk * .35),
    breath: .006 * Math.sin(2 * loop.hc * DEG) * hbc * m,
  };
}
type Css = ReturnType<typeof hangCss>;
const pawCss = (paw: Paw, c: Css): M => paw === 'L'
  ? mul(mul(T(-201 + c.hbc * 21, -58 + c.hbc * -8), R(c.hbc * 18 + c.hl1 * 5)), S(1 + c.hbc * -.08, 1))
  : mul(mul(T(40 + c.hbc * 110, -50 + c.hbc * -4), R(c.hbc * -16 + c.hl1 * 5)), S(1.1 + c.hbc * -.18, 1));
/** Body space (inside the tilt layer) → rig space. */
const bodyMatrix = (c: Css, swing: number, tilt: number): M =>
  mul(mul(mul(about(JOINT[0], JOINT[1], R(c.hbar)), about(JOINT[0], JOINT[1], R(swing))),
    about(HANG_POINT[0], HANG_POINT[1], R(c.hbody))), about(HANG_POINT[0], HANG_POINT[1], R(tilt)));
const reachMatrix = (paw: Paw, p: PawPose): M =>
  mul(T(p.ext * Math.cos(p.aim * DEG), p.ext * Math.sin(p.aim * DEG)), about(PAW_PIVOT[paw][0], PAW_PIVOT[paw][1], R(p.rot)));
// Painted centre of each paw in limb space (hunt module's traced outlines).
const PAW_CENTRE: Record<Paw, [number, number]> = { L: limbCentre('L', 0, 1, 1), R: limbCentre('R', 0, 1, 1) };

/** Painted paw centre (rig units) for a pose. */
export function pawCentre(loop: HangLoop, pose: Pick<HangPlayPose, 'swing' | 'tilt' | 'paw'>, paw: Paw) {
  const c = hangCss(loop);
  const m = mul(mul(bodyMatrix(c, pose.swing, pose.tilt), reachMatrix(paw, pose.paw[paw])), pawCss(paw, c));
  return apply(m, PAW_CENTRE[paw][0], PAW_CENTRE[paw][1]);
}
/** Midpoint between the eyes (rig units) for a pose. */
export function eyeMid(loop: HangLoop, pose: Pick<HangPlayPose, 'swing' | 'tilt' | 'face'>) {
  const c = hangCss(loop);
  const breath = mul(mul(T(HANG_POINT[0], HANG_POINT[1] + c.hbc * -15.6), S(1 + c.hbc * -.054, 1 + c.hbc * .006 + c.breath)), T(-HANG_POINT[0], -HANG_POINT[1]));
  const face = mul(mul(T(-17.9951 + c.hbc * 36.8104, 0), S(.9812 + c.hbc * .0736, 1)), T(pose.face[0], pose.face[1]));
  const m = mul(mul(bodyMatrix(c, pose.swing, pose.tilt), breath), face);
  const a = apply(m, EYE_X[0], -140), b = apply(m, EYE_X[1], -140);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
}

export const HANG_PLAY_TUNING = {
  shell: 500,                 // shell width, rig units (distance unit below)
  notice: 2.2, watch: 2.5, release: 2.9,   // × shell from the eyes, vertical counts 1.25×
  start: .3,                  // interest that starts the watch (hunt notice uses the same .3)
  limits: { L: [-40, 70], R: [-15, 60] } as Record<Paw, [number, number]>,  // paw swing at its joint, deg
  ext: 12,                    // max paw shift along its swing, rig units (no stretching)
  trigger: 46,                // planned paw-centre miss that starts a swat, rig units
  contact: 56,                // paw-centre distance that counts as caught, rig units
  lean: { tilt: 3, swing: 1.2 },   // largest body lean used for a swat, deg
  head: { x: 11, y: 5, tilt: 2.6, swing: .55 },   // watch amplitudes (rig units / deg)
};
const TN = HANG_PLAY_TUNING;

/** Reads the hang rig's CSS state from its root <svg> (registered custom properties). */
export function readHangLoop(svg: Element): HangLoop {
  const cs = getComputedStyle(svg);
  const num = (name: string, fallback: number) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };
  return { hc: num('--hc', 0), hb: num('--hb', 0), hsw: num('--hsw', 0), hm: num('--hm', 1) };
}
/** Fully hung: the 2.4 s hook-on (incl. its damped sway) has finished. */
export const hangSettled = (loop: HangLoop) => loop.hb > .999 && loop.hb < 1.001 && loop.hsw > .999;

export const restPlayPose = (): HangPlayPose => ({
  swing: 0, tilt: 0, face: [0, 0],
  paw: { L: { rot: 0, ext: 0, aim: 0 }, R: { rot: 0, ext: 0, aim: 0 } },
  hind: { L: 0, R: 0 },
  expr: { ...neutralFace() },
});

// ------------------------------------------------------------------ renderer
const fx = (v: number) => Math.round(v * 10000) / 10000;
// Mouth/brow shapes of the hunt renderer (character.mjs mouths), unchanged.
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
const mixArr = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** Writes a pose onto rootbeast-hang-play-rig.svg (root must carry data-hang-play="1"). */
export function createHangPlayRenderer(svg: Element) {
  const part = (name: string) => {
    const el = svg.querySelector(`[data-hp="${name}"]`);
    if (!el) throw Error(`hang play rig part missing: ${name}`);
    return el;
  };
  const els = {
    swingBar: part('swing-bar'), swingBody: part('swing-body'), tilt: part('tilt'), face: part('face-shift'),
    reach: { L: part('reach-l'), R: part('reach-r') }, hind: { L: part('dangle-hl'), R: part('dangle-hr') },
    lid: [part('lid-l'), part('lid-r')], open: [part('open-l'), part('open-r')], pupil: [part('pupil-l'), part('pupil-r')],
    smile: [part('smile-l'), part('smile-r')], brow: [part('brow-l'), part('brow-r')],
    mouthLine: part('mouth-line'), mouthOpen: part('mouth-open'), mouthO: part('mouth-o'), puff: part('puff'), cheeks: part('cheeks'),
  };
  const cache = new Map<string, string>();
  const attr = (el: Element, id: string, name: string, value: string) => {
    if (cache.get(id) === value) return;
    cache.set(id, value);
    el.setAttribute(name, value);
  };
  const render = (pose: HangPlayPose) => {
    const swing = `rotate(${fx(pose.swing)} ${JOINT[0]} ${JOINT[1]})`;
    attr(els.swingBar, 'swingBar', 'transform', swing);
    attr(els.swingBody, 'swingBody', 'transform', swing);
    attr(els.tilt, 'tilt', 'transform', `rotate(${fx(pose.tilt)} ${HANG_POINT[0]} ${HANG_POINT[1]})`);
    attr(els.face, 'face', 'transform', `translate(${fx(pose.face[0])} ${fx(pose.face[1])})`);
    for (const paw of ['L', 'R'] as const) {
      const p = pose.paw[paw], [px, py] = PAW_PIVOT[paw];
      attr(els.reach[paw], 'reach' + paw, 'transform',
        `translate(${fx(p.ext * Math.cos(p.aim * DEG))} ${fx(p.ext * Math.sin(p.aim * DEG))}) rotate(${fx(p.rot)} ${px} ${py})`);
      const [hx, hy] = HIND_PIVOT[paw];
      attr(els.hind[paw], 'hind' + paw, 'transform', `rotate(${fx(pose.hind[paw])} ${hx} ${hy})`);
    }
    // Face: the hunt renderer's eye/mouth math (side = 1).
    const face = pose.expr;
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
      attr(els.pupil[i], 'pupil' + i, 'transform', `translate(${fx(face.gx)} ${fx(face.gy)}) scale(${fx(face.pupil)} ${fx(face.pupil)})`);
      const eye = i ? 'r' : 'l';
      const brow = BROW.base[eye].map((v, k) => v + clamp01(face.frown) * (BROW.angry[eye][k] - v) + clamp01(face.raise) * (BROW.raise[eye][k] - v));
      attr(els.brow[i], 'brow' + i, 'd', quad(brow));
      attr(els.brow[i], 'browO' + i, 'opacity', fx(clamp01(1.6 * Math.max(face.frown, face.raise))).toString());
    }
    let shape = MOUTH.neutral.slice();
    const weights: [keyof typeof MOUTH, number][] = [['happy', face.happy], ['focus', face.focus], ['angry', face.angry], ['pout', face.pout]];
    for (const [name, w] of weights) if (w > 0) shape = mixArr(shape, MOUTH[name], clamp01(w));
    const open = clamp01(face.open), o = clamp01(face.o);
    attr(els.mouthLine, 'mouthD', 'd', quad(shape));
    attr(els.mouthLine, 'mouthW', 'stroke-width', fx(shape[6]).toString());
    attr(els.mouthLine, 'mouthO', 'opacity', fx(clamp01(1 - 4 * Math.max(open, o))).toString());
    attr(els.mouthOpen, 'openT', 'transform', `scale(${fx(.55 + .45 * open)} ${fx(Math.max(.001, open))})`);
    attr(els.mouthOpen, 'openOp', 'opacity', open > .02 ? '1' : '0');
    attr(els.mouthO, 'oT', 'transform', 'translate(0 5) scale(.55) translate(0 -5)');
    attr(els.mouthO, 'oOp', 'opacity', fx(smoothstep((o - .2) / .3)).toString());
    attr(els.puff, 'puff', 'opacity', fx(clamp01(face.puff)).toString());
    attr(els.cheeks, 'cheeks', 'opacity', fx(.72 * clamp01(face.cheeks)).toString());
  };
  return { svg, render, reset: () => render(restPlayPose()) };
}

// ------------------------------------------------------------------ springs
interface Spring { x: number; v: number }
const spring = (): Spring => ({ x: 0, v: 0 });
function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += (omega * omega * (target - s.x) - 2 * zeta * omega * s.v) * h; s.x += s.v * h; }
  return s.x;
}

// ------------------------------------------------------------------ controller
type Phase = 'wind' | 'strike' | 'hold' | 'back';
interface Swipe { paw: Paw; phase: Phase; t: number; dur: number; from: PawPose; to: PawPose; target: PawPose; lean: { tilt: number; swing: number }; hit: boolean | null; dx: number }
const ZERO_PAW = (): PawPose => ({ rot: 0, ext: 0, aim: 0 });
const mixPaw = (a: PawPose, b: PawPose, t: number): PawPose => ({ rot: lerp(a.rot, b.rot, t), ext: lerp(a.ext, b.ext, t), aim: b.ext > a.ext ? b.aim : a.aim });
const easeOutQuad = (t: number) => 1 - (1 - clamp01(t)) ** 2;
const easeInOut = (t: number) => { const x = clamp01(t); return x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; };
const easeOutBack = (t: number) => { const x = clamp01(t), c1 = 1.15, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

export function createHangPlayController(options: { seed?: number } = {}) {
  const rand = mulberry32(options.seed ?? 20261026);
  const face = createFace(rand);
  const fcmd: FaceCmd = { look: null, pursuit: true, noBlink: true, blinkNow: false, expr: {}, rate: {} };
  const U = TN.shell;
  let active = false, mode = 'off', sub = '', modeT = 0, now = 0, soft = false;
  let interest = 0, stillT = 0, speed = 0, lastDirX = 0, present = false, lastMoveT = -1e9, busyT = 0, cooldown = 0;
  let px = { x: 0, y: 0, has: false };
  let cursor: [number, number] | null = null, prevCursor: [number, number] | null = null, lastSeen: [number, number] | null = null;
  let vel: [number, number] = [0, 0];
  let geo: HangPlayEnv['box'] = { left: 0, top: 0, width: 640 };
  let loop: HangLoop = { hc: 0, hb: 1, hsw: 1, hm: 1 };
  let css = hangCss(loop);
  let glance = 0, glanceT = 0, awayT = 0, boredT = 0, calmBlink = false, tired = false;
  let head = { fx: 0, fy: 0, tilt: 0, swing: 0 }, headWant: typeof head | null = null, headDelay = 0;
  const fxS = spring(), fyS = spring(), tiltS = spring(), swingS = spring(), hindL = spring(), hindR = spring();
  let swipe: Swipe | null = null, swipeCool = 0, swipes = 0, satisfied: [number, number] | null = null, satisfiedTravel = 0;
  let react: { hit: boolean; t: number; dur: number } | null = null;
  let probe: ReachPlan | null = null, wasReachable = false, enteredT = -1e9, readyT = 0;
  let yieldFrom: HangPlayPose | null = null, yieldT = 0;
  let events: HangPlayEvent[] = [];
  let lastPose = restPlayPose();

  const restLook = (): [number, number] => [-2 * css.hbc, -5 * css.hbc];   // the rig's own pupil offset
  const currentPaw = (paw: Paw): PawPose => swipe && swipe.paw === paw ? swipePaw(swipe) : ZERO_PAW();
  const poseNow = (): HangPlayPose => ({
    swing: swingS.x, tilt: tiltS.x, face: [fxS.x, fyS.x],
    paw: { L: currentPaw('L'), R: currentPaw('R') }, hind: { L: hindL.x, R: hindR.x },
    expr: { ...face.f, gx: face.f.gx - restLook()[0], gy: face.f.gy - restLook()[1] },
  });
  const eyes = () => eyeMid(loop, { swing: swingS.x, tilt: tiltS.x, face: [fxS.x, fyS.x] });
  const dist = () => {
    if (!cursor || !present) return Infinity;
    const [ex, ey] = eyes();
    return Math.hypot(cursor[0] - ex, (cursor[1] - ey) * 1.25) / U;
  };
  // Pupil target (eye units) — the hunt module's lookAt mapping.
  const lookAt = (p: [number, number]): [number, number] => {
    const [ex, ey] = eyes();
    return [9 * Math.tanh((p[0] - ex) / 150), 7 * Math.tanh((p[1] - ey) / 120)];
  };

  // Best way for either paw to reach a rig point, with at most a slight lean.
  function aim(paw: Paw, t: [number, number], tilt: number, swing: number) {
    const tb = apply(invert(bodyMatrix(css, swing, tilt)), t[0], t[1]);
    const P = PAW_PIVOT[paw];
    const c0 = apply(pawCss(paw, css), PAW_CENTRE[paw][0], PAW_CENTRE[paw][1]);
    const r0 = Math.hypot(c0[0] - P[0], c0[1] - P[1]);
    const a0 = Math.atan2(c0[1] - P[1], c0[0] - P[0]) / DEG;
    const aT = Math.atan2(tb[1] - P[1], tb[0] - P[0]) / DEG;
    const [lo, hi] = TN.limits[paw];
    const rot = clamp(wrap180(aT - a0), lo, hi);
    const a1 = a0 + rot, ext = clamp(Math.hypot(tb[0] - P[0], tb[1] - P[1]) - r0, 0, TN.ext);
    const cx = P[0] + (r0 + ext) * Math.cos(a1 * DEG), cy = P[1] + (r0 + ext) * Math.sin(a1 * DEG);
    return { paw, rot, ext, aim: a1, tilt, swing, miss: Math.hypot(tb[0] - cx, tb[1] - cy) };
  }
  function plan(t: [number, number]): ReachPlan {
    let best: ReachPlan | null = null, bestCost = Infinity;
    for (const paw of ['L', 'R'] as const) for (const tilt of [-TN.lean.tilt, 0, TN.lean.tilt]) for (const swing of [-TN.lean.swing, 0, TN.lean.swing]) {
      const p = aim(paw, t, tilt, swing);
      const cost = p.miss + 4 * (Math.abs(tilt) / TN.lean.tilt + Math.abs(swing) / TN.lean.swing);
      if (cost < bestCost) { bestCost = cost; best = p; }
    }
    return best!;
  }

  function swipePaw(s: Swipe): PawPose {
    const u = s.t / s.dur;
    if (s.phase === 'wind') return mixPaw(s.from, s.to, easeInOut(u));
    if (s.phase === 'strike') return mixPaw(s.from, s.to, easeOutQuad(u));
    if (s.phase === 'hold') return mixPaw(s.from, s.to, smoothstep(u));
    // back: slight overshoot past rest, then settle (no snap)
    const k = easeOutBack(u);
    return { rot: lerp(s.from.rot, 0, k), ext: lerp(s.from.ext, 0, clamp01(k)), aim: s.from.aim };
  }
  function setPhase(s: Swipe, phase: Phase, dur: number, to: PawPose) {
    s.from = swipePaw(s); s.phase = phase; s.t = 0; s.dur = dur; s.to = to;
  }
  function launch(p: ReachPlan) {
    // Cock the paw back a little against the swat, then strike.
    const toward = Math.sign(p.rot) || 1;
    const cocked = { rot: -toward * 10, ext: 0, aim: p.aim };
    swipe = { paw: p.paw, phase: 'wind', t: 0, dur: .07 + rand() * .03, from: ZERO_PAW(), to: cocked,
      target: { rot: p.rot, ext: p.ext, aim: p.aim }, lean: { tilt: p.tilt, swing: p.swing }, hit: null, dx: 0 };
    const c0 = pawCentre(loop, { swing: swingS.x, tilt: tiltS.x, paw: { L: ZERO_PAW(), R: ZERO_PAW(), [p.paw]: swipe.target } }, p.paw);
    const r0 = pawCentre(loop, { swing: swingS.x, tilt: tiltS.x, paw: { L: ZERO_PAW(), R: ZERO_PAW() } }, p.paw);
    swipe.dx = c0[0] - r0[0];
    swipes++;
    events.push({ type: 'swipe', paw: p.paw });
  }
  function contact(hit: boolean) {
    if (!swipe || swipe.hit !== null) return;
    swipe.hit = hit;
    events.push({ type: 'contact', paw: swipe.paw, hit });
    react = { hit, t: 0, dur: hit ? .55 : .4 };   // hunt "react": .55 s hit, .35–.4 s miss
    if (hit) { satisfied = cursor ? [cursor[0], cursor[1]] : null; satisfiedTravel = 0; hindL.v += 60; hindR.v -= 60; }
  }
  function stepSwipe(dt: number) {
    const s = swipe!;
    s.t += dt;
    if (s.phase === 'wind' && s.t >= s.dur) {
      // A swat carries a little past its aim (≤ 8°, inside the joint limits), then settles on it.
      const [lo, hi] = TN.limits[s.paw], past = clamp((s.target.rot - s.to.rot) * .25, -8, 8);
      setPhase(s, 'strike', .12 + rand() * .03, { ...s.target, rot: clamp(s.target.rot + past, lo, hi) });
      // Reaction of the hanging body: it swings a little away from the swat.
      swingS.v += clamp(s.dx / 80, -1, 1) * 3;
    } else if (s.phase === 'strike') {
      if (s.t / s.dur > .45) testContact();
      if (s.t >= s.dur) setPhase(s, 'hold', .1, s.target);
    } else if (s.phase === 'hold') {
      testContact();
      if (s.t >= s.dur) {
        if (s.hit === null) contact(false);
        if (s.hit && s.dur < .2) { s.t = 0; s.dur = .22; s.from = swipePaw(s); s.to = { ...s.target, rot: s.target.rot - Math.sign(s.target.rot || 1) * 6 }; return; }  // grab: curl in a little
        setPhase(s, 'back', .36 + rand() * .06, ZERO_PAW());
      }
    } else if (s.phase === 'back' && s.t >= s.dur) {
      // Each further swat gets its own short reaction delay.
      swipe = null; swipeCool = .45 + rand() * .45 + (s.hit ? .5 : 0); readyT = .1 + rand() * .2;
    }
  }
  function testContact() {
    const s = swipe!;
    if (s.hit !== null || !cursor || !present) return;
    const pose = { swing: swingS.x, tilt: tiltS.x, paw: { L: ZERO_PAW(), R: ZERO_PAW(), [s.paw]: swipePaw(s) } };
    const c = pawCentre(loop, pose, s.paw);
    if (Math.hypot(cursor[0] - c[0], cursor[1] - c[1]) <= TN.contact) contact(true);
  }

  function begin() {
    active = true; soft = false; mode = 'watch'; sub = 'look'; modeT = 0;
    glance = 0; glanceT = 0; awayT = 0; boredT = 0; tired = false; swipes = 0; swipeCool = .2; satisfied = null; react = null;
    head = { fx: 0, fy: 0, tilt: 0, swing: 0 }; headWant = null;
    for (const s of [fxS, fyS, tiltS, swingS, hindL, hindR]) { s.x = 0; s.v = 0; }
    face.reset({ ...neutralFace(), gx: restLook()[0], gy: restLook()[1] });
    events.push({ type: 'start' });
  }
  function finish(to: 'rest' | 'drag' | 'hard') {
    active = false; mode = 'off'; sub = ''; swipe = null; react = null; yieldFrom = null;
    for (const s of [fxS, fyS, tiltS, swingS, hindL, hindR]) { s.x = 0; s.v = 0; }
    face.reset({ ...neutralFace(), gx: restLook()[0], gy: restLook()[1] });
    lastPose = restPlayPose();
    cooldown = Math.max(cooldown, to === 'rest' ? 1 : 1.5); interest = Math.min(interest, .12);   // a tired rest (6 s) is kept
    events.push({ type: 'end', to });
  }
  const setMode = (m: string, s = '') => { mode = m; sub = s; modeT = 0; calmBlink = false; };

  function sense(dt: number) {
    if (!px.has) { cursor = null; present = false; }
    else { prevCursor = cursor; cursor = viewportToRig(geo, px.x, px.y); }
    const moved = prevCursor && cursor ? Math.hypot(cursor[0] - prevCursor[0], cursor[1] - prevCursor[1]) : 0;
    const inst = dt > 0 ? moved / dt : 0;
    speed = speed + (inst - speed) * (1 - Math.exp(-8 * dt));
    if (prevCursor && cursor && dt > 0) for (const i of [0, 1]) vel[i] += ((cursor[i] - prevCursor[i]) / dt - vel[i]) * (1 - Math.exp(-10 * dt));
    if (speed < 38) stillT += dt; else stillT = 0;
    if (inst > 60) lastMoveT = now;
    if (prevCursor && cursor && Math.abs(cursor[0] - prevCursor[0]) / Math.max(dt, 1e-3) > 160) {
      const s = Math.sign(cursor[0] - prevCursor[0]);
      if (lastDirX && s !== lastDirX && dist() < TN.notice) interest += .1;
      lastDirX = s;
    }
    if (cursor && present) lastSeen = [cursor[0], cursor[1]];
    // The hunt module's interest rule (teasing speeds count; fast straight passes barely do).
    const d = dist();
    if (present && cursor && d < TN.notice) {
      const prox = 1 - d / TN.notice;
      const stim = smoothstep((speed - 40) / 320) * (1 - smoothstep((speed - 2600) / 3000));
      interest += dt * stim * (.35 + 1.1 * prox) * (busyT > 0 ? .2 : 1);
      if (stillT > .3 && now - lastMoveT < 8 && !satisfied) interest += dt * .25 * prox;
    }
    const watching = active && present && d < TN.watch;
    interest -= dt * ((watching ? .04 : .16) + (present ? 0 : .5) + (d > TN.release ? .35 : 0));
    interest = clamp01(interest);
    // Caught it: a resting mouse is not swatted again; once it moves on (or keeps wriggling) it is fair game.
    if (satisfied) satisfiedTravel += moved;
    if (satisfied && cursor && (Math.hypot(cursor[0] - satisfied[0], cursor[1] - satisfied[1]) > 90 || speed > 400 || satisfiedTravel > 150)) satisfied = null;
    busyT -= dt;
  }

  function think(dt: number) {
    modeT += dt;
    fcmd.noBlink = true; fcmd.blinkNow = false; fcmd.pursuit = true; fcmd.rate = {};
    const c = cursor && present ? cursor : null;
    const d = dist();
    probe = c ? plan(c) : null;
    const reachable = !!probe && probe.miss <= TN.trigger;
    if (reachable && !wasReachable) { enteredT = now; readyT = .1 + rand() * .2; }
    wasReachable = reachable;
    if (react) { react.t += dt; if (react.t > react.dur) react = null; }
    swipeCool -= dt;

    if (mode === 'settle') {
      sub = 'calm';
      fcmd.expr = {}; fcmd.rate = soft ? { smile: 18, cheeks: 18, frown: 18, pout: 18, puff: 18, focus: 18, pupil: 18, squint: 18, happy: 18, wide: 18, open: 18, o: 18, raise: 18 } : { smile: 5, cheeks: 3, frown: 4, pout: 4, puff: 5, focus: 4, pupil: 4 };
      // A last look where the mouse went, then back to the hang's own gaze.
      fcmd.look = !soft && modeT < .45 && lastSeen ? lookAt(lastSeen) : restLook();
      if (!soft && modeT > .55 && !calmBlink) { fcmd.blinkNow = true; calmBlink = true; }
      head = { fx: 0, fy: 0, tilt: 0, swing: 0 }; headWant = null;
      if (swipe && swipe.phase !== 'back') setPhase(swipe, 'back', .3, ZERO_PAW());
      if (!soft && !tired && c && d < TN.watch && interest > .45 && modeT > .3 && busyT <= 0) { setMode('watch', 'look'); glanceT = 0; }
      return;
    }

    // ---- watch: eyes first, head after, body barely
    const near = probe ? clamp01(1 - (probe.miss - TN.trigger) / 90) : 0;
    const focused = !!swipe || near > .3 || speed > 900;
    glanceT -= dt;
    if (glanceT <= 0) {
      glance++;
      glanceT = glance % 2 ? .55 + rand() * .9 : .16 + rand() * .14;
      if (!(glance % 2) && !focused && rand() < .45) fcmd.blinkNow = true;
    }
    const looking = glance % 2 === 1 || focused;
    if (c) {
      const l = lookAt(c), r = restLook();
      fcmd.look = looking ? l : [l[0] * .3 + r[0] * .5, l[1] * .25 + r[1] * .6];
      // Head follows the eyes in discrete, delayed re-orientations (not frame by frame).
      if (looking) {
        const [ex, ey] = eyes(), dx = c[0] - ex, dy = c[1] - ey;
        const want = { fx: TN.head.x * Math.tanh(dx / 300), fy: TN.head.y * Math.tanh(dy / 260), tilt: TN.head.tilt * Math.tanh(dx / 340), swing: -TN.head.swing * Math.tanh(dx / 500) };
        const far = Math.abs(want.fx - head.fx) > 3 || Math.abs(want.fy - head.fy) > 2 || Math.abs(want.tilt - head.tilt) > .9;
        if (far && !headWant) { headWant = want; headDelay = .14 + rand() * .16; }
        if (headWant) { headWant = want; headDelay -= dt; if (headDelay <= 0) { head = headWant; headWant = null; } }
      }
    }
    sub = swipe && swipe.hit === null ? 'swat' : react ? (react.hit ? 'caught' : 'missed') : swipe ? 'swat' : near > .3 ? 'ready' : looking ? 'look' : 'glance';
    fcmd.expr = { pupil: 1.03 + .06 * interest + .12 * near, focus: .2 + .45 * near };
    fcmd.rate = { pupil: 5, focus: 6 };
    if (swipe && (swipe.phase === 'wind' || swipe.phase === 'strike')) { fcmd.expr = { pupil: 1.18, focus: .8, open: .3 }; fcmd.rate = { open: 22, pupil: 10 }; }
    if (react) {
      // The hunt module's "react" after a strike: caught → happy squint + blush; missed → blink, focus, a small pout.
      if (react.hit) { fcmd.expr = { smile: .85, cheeks: .7, happy: .8, pupil: 1 }; fcmd.rate = { smile: 14 }; }
      else { fcmd.expr = { focus: .7, squint: .3, pupil: 1.05, pout: .3 }; fcmd.rate = { pout: 6 }; if (react.t < dt * 1.5) fcmd.blinkNow = true; }
    }

    // Swat only what a paw can reach; never at a resting cursor twice; not when it streaks past.
    if (!swipe && reachable) {
      readyT -= dt;
      const fresh = now - lastMoveT < 1 || now - enteredT < .7;
      if (readyT <= 0 && swipeCool <= 0 && !satisfied && fresh && speed < 2400 && swipes < 6 && !soft) {
        const lead: [number, number] = [c![0] + clamp(vel[0] * .12, -80, 80), c![1] + clamp(vel[1] * .12, -80, 80)];
        const p = plan(lead);
        launch(p.miss <= TN.contact ? p : probe!);
      }
    }
    // A mouse resting nearby gets boring sooner than one being waved about.
    if (swipe || reachable && !satisfied) boredT = 0; else boredT += dt * (stillT > 2 ? 3 : 1);

    // Leaving: the mouse left / went far, interest ran out, or it got bored of teasing out of reach.
    if (!c || d > TN.release) awayT += dt; else awayT = 0;
    if (!swipe && (awayT > .35 || interest < .06 || boredT > 16 || swipes >= 6 && !react)) {
      // Tired of it: a longer rest before the next bout.
      if (boredT > 16 || swipes >= 6) { interest = Math.min(interest, .05); cooldown = 6; tired = true; }
      setMode('settle');
    }
  }

  function moveBody(dt: number) {
    const k = soft ? 3.5 : 1;   // a host 'soft' stop settles within ~0.5 s
    // A gentle pendulum while watching; well damped while calming down.
    let tiltGoal = head.tilt, swingGoal = head.swing, tiltW = 7, swingW = 2.6, swingZ = mode === 'settle' ? .85 : .45;
    if (swipe && swipe.phase !== 'back') { tiltGoal = swipe.lean.tilt; swingGoal = swipe.lean.swing; tiltW = 14; swingW = 6; swingZ = .5; }
    const kf = Math.min(k, 2.6);
    stepSpring(fxS, head.fx, 7.5 * kf, .9, dt);
    stepSpring(fyS, head.fy, 7.5 * kf, .9, dt);
    stepSpring(tiltS, tiltGoal, tiltW * k, .85, dt);
    stepSpring(swingS, swingGoal, swingW * k, soft ? 1 : swingZ, dt);
    // Hind legs dangle behind the body's swing (secondary motion only).
    const hz = mode === 'settle' ? .7 : .35;
    const drive = soft ? 0 : 1;
    stepSpring(hindL, clamp(-swingS.v * .9 * drive, -8, 8), 8 * Math.min(k, 2), hz, dt);
    stepSpring(hindR, clamp(-swingS.v * .75 * drive, -8, 8), 8 * Math.min(k, 2), hz, dt);
  }

  function settled() {
    if (swipe || react) return false;
    for (const s of [fxS, fyS]) if (Math.abs(s.x) > .05 || Math.abs(s.v) > .3) return false;
    // .05° about the √ vertex moves the feet < .1 px at the largest size.
    for (const s of [tiltS, swingS, hindL, hindR]) if (Math.abs(s.x) > .05 || Math.abs(s.v) > .3) return false;
    const f = face.f, r = restLook();
    if (Math.abs(f.gx - r[0]) > .05 || Math.abs(f.gy - r[1]) > .05 || f.blink > .005 || Math.abs(f.pupil - 1) > .01) return false;
    for (const k of ['smile', 'wide', 'squint', 'frown', 'raise', 'happy', 'focus', 'angry', 'pout', 'o', 'open', 'puff', 'cheeks'] as const) if (f[k] > .01) return false;
    return true;
  }

  function frame(): HangPlayFrame {
    const pose = lastPose;
    const reachable = !!probe && probe.miss <= TN.trigger;
    return {
      active, pose, mode, sub, interest, events,
      debug: {
        cursor: cursor && present ? [cursor[0], cursor[1]] : null, reach: probe, reachable,
        paws: { L: pawCentre(loop, pose, 'L'), R: pawCentre(loop, pose, 'R') }, eyes: eyeMid(loop, pose),
      },
    };
  }

  return {
    face,
    /** Latest mouse position (viewport px). Passive pointermove, pointerType 'mouse' only. */
    pointer(x: number, y: number) { px = { x, y, has: true }; present = true; },
    /** The mouse left the window / the window lost focus. */
    leave() { present = false; },
    /** The user clicked or typed elsewhere: back off for a moment (as the hunt module). */
    busy() { busyT = 2.5; interest *= .4; if (active && mode === 'watch') setMode('settle'); },
    get active() { return active; },
    get mode() { return mode; },
    /** Reach plan for a viewport point at the current pose (for overlays and checks). */
    probe(box: HangPlayEnv['box'], x: number, y: number) { geo = box; return plan(viewportToRig(box, x, y)); },
    step(dtMs: number, env: HangPlayEnv): HangPlayFrame {
      const dt = clamp(dtMs / 1000, 0, .05);
      now += dt; events = [];
      geo = env.box; loop = env.loop; css = hangCss(loop);
      sense(dt);
      if (!active) {
        cooldown -= dt;
        probe = cursor && present ? plan(cursor) : null;
        if (env.canStart && !env.stop && cooldown <= 0 && busyT <= 0 && present && cursor && interest > TN.start && dist() < TN.notice) begin();
        else return frame();
      }
      if (env.stop === 'hard') { finish('hard'); return frame(); }
      if (env.stop === 'drag' && mode !== 'yield') {
        // The host already moves the container with the mouse; just let go of the pose quickly.
        yieldFrom = poseNow(); yieldT = 0; setMode('yield', 'let-go'); swipe = null; react = null;
      } else if (env.stop === 'soft' && !soft && mode !== 'yield') { soft = true; setMode('settle'); }
      if (mode === 'yield') {
        yieldT += dt;
        const u = smoothstep(yieldT / .2), a = yieldFrom!, z = restPlayPose();
        const mixN = (p: number, q: number) => lerp(p, q, u);
        const expr = { ...z.expr };
        for (const key of Object.keys(expr) as (keyof FacePose)[]) expr[key] = mixN(a.expr[key], z.expr[key]);
        lastPose = {
          swing: mixN(a.swing, 0), tilt: mixN(a.tilt, 0), face: [mixN(a.face[0], 0), mixN(a.face[1], 0)],
          paw: { L: { ...a.paw.L, rot: mixN(a.paw.L.rot, 0), ext: mixN(a.paw.L.ext, 0) }, R: { ...a.paw.R, rot: mixN(a.paw.R.rot, 0), ext: mixN(a.paw.R.ext, 0) } },
          hind: { L: mixN(a.hind.L, 0), R: mixN(a.hind.R, 0) }, expr,
        };
        if (yieldT >= .2) finish('drag');
        return frame();
      }
      think(dt);
      if (swipe) stepSwipe(dt);
      moveBody(dt);
      face.update(dt, fcmd);
      lastPose = poseNow();
      if (mode === 'settle' && settled()) finish('rest');
      return frame();
    },
  };
}
