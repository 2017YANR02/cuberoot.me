// Root Beast bottom-edge emerge: hidden at the bottom edge (the bottom-peek
// pose), the pet watches a teasing cursor, braces both front paws on the edge,
// pushes its body out, settles its weight, lets go one paw at a time and hands
// the standing pose to the existing mouse-hunt controller (chase or stalk).
// When nobody plays any more (before the hand-off, or after that hunt settles)
// it puts its paws back on the edge and lies back down into the peek.
//
// Nothing is redrawn. Every frame is posed on the unchanged hunt rig
// (rootbeast-hunt-rig.svg) with the hunt module's renderer, limb outlines, eye
// clearance, face (saccades, blinks, expression channels) and idle pose. The
// first frame is the bottom-peek rig's settled pose (numbers from
// build-bottom-peek.mjs), so swapping the two documents shows no change; the
// last frame is idle frame 0, which the hunt (or the site's idle) continues.
// Front paws stay pinned to the screen edge while the container rises.
//
// Like the hunt module this listens to nothing: the host feeds cursor samples,
// gates and the peek rig's loop state, and applies `liftPx` and the pose.

import {
  createFace, eyeOverlap, facePoint, HUNT_TUNING, idlePoseAt, lowestPoint, mulberry32, neutralFace, PS, PY, restPose,
  type BodyPose, type Bone, type FaceCmd, type FacePose, type HuntPose, type Joint,
} from './deskpet-mouse-hunt';

// ------------------------------------------------------------------ bottom-peek rig numbers
/** Settled values of rootbeast-bottom-peek-rig.svg (build-bottom-peek.mjs defaults). */
export const PEEK = {
  min: 358, max: 500, hardMin: 350, hardMax: 520, riseLine: 430, overlap: 1.5, ref: 460,
  // Joint x = x0 + xk·max(0, lg − lineRig(ref)); `contact` is the paw's painted lowest point below its joint.
  paws: {
    L: { x0: -303, xk: 0, angle: 0, sx: 1, sy: 1, contact: 87.7891 },
    R: { x0: 128, xk: -.3, angle: 4, sx: 1.05, sy: 1, contact: 87.9865 },
  },
  hind: { HL: [-100, -16, -8, .78, .55] as Joint, HR: [204, -17, 8, .88, .58] as Joint },
  tail: -4, pivot: [-90, 60] as [number, number], gazeY: -6,
};
export interface PeekLoopState { bl: number; gx: number; tl: number }
const lineRig = (y: number) => (y - PY) / PS;
const rot = (x: number, y: number, a: number): [number, number] => {
  const r = a * Math.PI / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const smoothstep = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt));
interface Spring { x: number; v: number }
const spring = (x = 0): Spring => ({ x, v: 0 });
function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) { s.v += (omega * omega * (target - s.x) - 2 * zeta * omega * s.v) * h; s.x += s.v * h; }
  return s.x;
}
/** CSS cubic-bezier timing; the peek rig pulls its body up with (.45,0,.3,1). */
const bezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  let t = clamp01(x);
  for (let i = 0; i < 8; i++) {
    const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x;
    const d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
    if (Math.abs(d) < 1e-6) break;
    t = clamp01(t - cx / d);
  }
  return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
};
const pullUp = bezier(.45, 0, .3, 1);

/** Contact-line geometry of the peek (rig units, container frame at the peek). */
export function peekGeometry(line: number) {
  const c = clamp(line, PEEK.hardMin, PEEK.hardMax);
  const rise = Math.max(0, PEEK.riseLine - c) / PS;   // the peek rig's own pull-up
  const e0 = lineRig(c);                             // the screen edge
  const lg = e0 + rise;                              // the edge in the risen body's frame
  return { line: c, rise, e0, lg, pivot: [PEEK.pivot[0], lg + PEEK.pivot[1]] as [number, number] };
}
type PeekGeo = ReturnType<typeof peekGeometry>;
function peekPaw(bone: 'L' | 'R', g: PeekGeo): Joint {
  const p = PEEK.paws[bone];
  return [p.x0 + p.xk * Math.max(0, g.lg - lineRig(PEEK.ref)), g.lg + PEEK.overlap / PS - p.contact, p.angle, p.sx, p.sy];
}
/** The peek rig's head tilt (.pk-head turns connector, tail and shell about a
 *  point below the face) as hunt-rig shell and tail joints. `roll` adds a turn
 *  about another point (the eye on the side the pet looks to), applied first. */
function headTilt(pivot: [number, number], tilt: number, tailAngle: number, roll = 0, rollAt: [number, number] = pivot): { b: Joint; T: Joint } {
  const map = (x: number, y: number): [number, number] => {
    const [rx, ry] = rot(x - rollAt[0], y - rollAt[1], roll);
    const [tx, ty] = rot(rollAt[0] + rx - pivot[0], rollAt[1] + ry - pivot[1], tilt);
    return [pivot[0] + tx, pivot[1] + ty];
  };
  const o = map(0, -190), t = map(145, -355);
  return { b: [o[0], o[1] + 190, tilt + roll, 1, 1], T: [t[0], t[1], tailAngle + tilt + roll, 1, 1] };
}
// Eye centres in the shell's frame at the rest yaw (face view f .9812, tx −17.995).
const EYE_X = { L: -192 * .9812 - 17.9951, R: 45 * .9812 - 17.9951 };
/** The bottom-peek rig's settled pose ("on", fully entered) for the hunt rig. */
export function peekPoseFor(line: number, loop: PeekLoopState = { bl: 0, gx: 0, tl: 0 }): HuntPose {
  const g = peekGeometry(line);
  const body = restPose();
  body.ry = -g.rise;
  body.L = peekPaw('L', g); body.R = peekPaw('R', g);
  body.HL = [...PEEK.hind.HL] as Joint; body.HR = [...PEEK.hind.HR] as Joint;
  const { b, T } = headTilt(g.pivot, loop.tl, PEEK.tail);
  body.b = b; body.T = T;
  return { body, face: { ...neutralFace(), gx: loop.gx, gy: PEEK.gazeY, blink: loop.bl }, shadow: { x: 0, scale: 1, opacity: 0 } };
}

// ------------------------------------------------------------------ peek rig DOM helpers (read-only except the loop clock)
/** True once the peek rig has fully entered: data-peek="on" and every progress property at 1. */
export function peekSettled(svg: SVGSVGElement) {
  const view = svg.ownerDocument.defaultView;
  if (!view || svg.getAttribute('data-peek') !== 'on') return false;
  const cs = view.getComputedStyle(svg);
  return ['--pk', '--pu', '--pb', '--pt'].every(name => parseFloat(cs.getPropertyValue(name)) >= .999);
}
/** The stay loop's current blink / glance / tilt values, as the rig draws them. */
export function readPeekLoop(svg: SVGSVGElement): PeekLoopState | null {
  const view = svg.ownerDocument.defaultView;
  if (!view) return null;
  const num = (el: Element | null, name: string) => el ? parseFloat(view.getComputedStyle(el).getPropertyValue(name)) : NaN;
  const bl = num(svg.querySelector('.pk-eye'), '--bl'), gx = num(svg.querySelector('.pk-pupil'), '--gx');
  const tl = num(svg.querySelector('.pk-head'), '--tl'), pm = num(svg, '--pm');
  if (![bl, gx, tl, pm].every(Number.isFinite)) return null;
  return { bl, gx: gx * pm, tl: tl * pm };   // --pm (reduced motion) mutes glance and tilt in the rig
}
/** Restart the stay loop at 0 s (eyes open and centred, no tilt) so a hand-back matches the last frame. */
export function restartPeekLoop(svg: SVGSVGElement) {
  for (const a of svg.getAnimations({ subtree: true })) if ((a as CSSAnimation).animationName?.startsWith('pk-')) a.currentTime = 0;
}

// ------------------------------------------------------------------ controller
export interface EmergeEnv {
  /** Container rect at its committed position (lift excluded), viewport px. */
  box: { left: number; top: number; width: number };
  /** The contact line the peek rig shows (--peek-y); read when the emerge starts. */
  line: number;
  /** Host gate: the peek is settled and nothing else owns the art. */
  canStart: boolean;
  /** Host request while active: 'soft' backs into hiding (or finishes standing once
   *  the push is past half way); 'drag' yields the position now and eases the pose
   *  to the drag first frame (≤ 0.28 s); 'hard' ends this frame. */
  stop?: 'soft' | 'drag' | 'hard' | null;
  /** Peek stay-loop values at the moment of takeover (readPeekLoop on the peek rig). */
  loop?: (() => PeekLoopState | null) | null;
  /** The hunt that followed an emerge has settled (standing on the edge) and nobody is playing:
   *  climb back down into the peek at `line`. `from` is the hunt's last drawn pose; the first frame
   *  repeats it and eases into idle frame 0 while it looks around. Read only while inactive. */
  resume?: { line: number; from?: HuntPose | null } | null;
}
export type EmergeEvent =
  /** anchorDropPx > 0 only for a resume: move the committed anchor down by it and show it back as
   *  liftPx in the same frame (nothing moves on screen; the peek anchor becomes the frame of reference). */
  | { type: 'start'; anchorDropPx: number }
  | { type: 'handoff'; liftPx: number; engage: { mode: 'chase' | 'stalk'; face: FacePose; interest: number }; idle: { time: number; gx: number; gy: number } }
  | { type: 'yield'; liftPx: number }
  | { type: 'end'; to: 'peek' | 'stand' | 'drag' | 'hard'; liftPx: number; inPeek: boolean };
export type EmergePhase = 'off' | 'watch' | 'return' | 'brace' | 'push' | 'retreat' | 'shift' | 'release' | 'linger' | 'regrip' | 'drop';
export interface EmergeFrame {
  active: boolean; phase: EmergePhase; pose: HuntPose; liftPx: number; interest: number; events: EmergeEvent[];
  debug: { U: number; Uf: number; lift: number; phaseT: number; cursor: [number, number] | null; planted: Partial<Record<Bone, [number, number]>> };
}

export const EMERGE_TUNING = {
  start: .3, emerge: .62,        // interest to start watching / to climb out (the hunt's notice starts at .3)
  watchMin: 1.3,                 // s of watching before bracing
  stalk: .35,                    // s the cursor has rested when the paws let go → stalk instead of chase
  brace: .24,                    // paws press, body dips
  push: [.44, .26],              // push duration = push[0] + push[1] × (rise / 160 rig units)
  shift: .2,                     // weight settles back over the hind legs
  step: .22, stepGap: .13,       // letting go: each front paw's step, and the delay of the second
  linger: .35,                   // standing with nobody to play with, before reaching back to the edge
  regripGap: .12,                // the far paw follows the near one back onto the edge
  retreat: [.32, .42],           // back down: retreat[0] + retreat[1] × (rise / 160 rig units)
  drop: .28,
  again: .5,                     // interest that brings it back up while lying back down
};

const FRONT = ['L', 'R'] as const, HIND = ['HL', 'HR'] as const, BONES: Bone[] = ['L', 'R', 'HL', 'HR'];
interface Hold { cx: number; cy: number; a: number; sx: number; sy: number }
interface Paw extends Hold {
  // Planted: painted lowest point in the screen frame (rig units) with the limb angle / scale.
  // A step swings it to another hold: the standing pose, or back to its grip on the edge.
  sw: { t: number; dur: number; lift: number; from: Hold; to: Hold } | null;
  grip: Hold;          // where it held the edge in the peek
  released: boolean;   // it let go of the edge (standing paw)
}

export function createBottomEmergeController(options: { seed?: number } = {}) {
  const rand = mulberry32(options.seed ?? 20261026);
  const face = createFace(rand);
  const fcmd: FaceCmd = { look: null, pursuit: true, noBlink: false, blinkNow: false, expr: {}, rate: {} };
  const REST = idlePoseAt(0).body;          // idle frame 0 = the hunt's takeover pose = drag frame 0
  let active = false, phase: EmergePhase = 'off', phaseT = 0, soft = false;
  let g = peekGeometry(PEEK.min), line = PEEK.min;
  // Vertical: U = body rise over the peek (screen frame). The container lift follows it,
  // lift = U × liftEnd / Uf, so the body stays inside the canvas and stands at rest at U = Uf.
  let U = 0, Uf = 1, liftEnd = 0, pushFrom = 0, pushDur = .6, dipFrom = 0;
  // tilt: the peek's own head tilt (about its pivot below the face); roll: the curious head turn
  // about the eye on the side it looks to (rollX = that pivot), so the other side lifts.
  const tilt = spring(), roll = spring(), rollX = spring(EYE_X.R), yaw = spring(28), up = spring(), sway = spring(), bob = spring();
  const tail = { x: spring(145), y: spring(-355), a: spring(0) };
  let tailNoise = 0, tailNoiseTarget = 0, tailNoiseT = 0, prevU = 0, prevVU = 0, press = 0, shadow = 0;
  const paws = {} as Record<'L' | 'R', Paw>;
  const hind = { HL: { k: 0, v: 0 }, HR: { k: 0, v: 0 } };   // 0 tucked (peek) … 1 standing; v = direction / duration
  let restContact = {} as Record<Bone, [number, number]>;  // standing contacts in the screen frame
  let base = { L: 0, R: 0 };                               // eye clearance of the peek itself
  let dropFrom: HuntPose | null = null, blendFrom: HuntPose | null = null;
  // input
  let px = { x: 0, y: 0, has: false }, present = false;
  let cursor: [number, number] | null = null, prev: [number, number] | null = null;
  let interest = 0, cursorSpeed = 0, stillT = 0, lastMoveT = -1e9, lastDirX = 0, awayT = 0, busyT = 0, cooldown = 0, now = 0;
  let glance = 0, glanceT = 0;
  let geo = { s: 1, left: 0, top: 0 };
  let events: EmergeEvent[] = [];
  let pose: HuntPose = peekPoseFor(line);

  const lift = () => (U + up.x) * liftEnd / Uf;
  // Screen frame W: rig units from the committed container's rig origin. Container frame C = W + (0, lift);
  // the rig's motion space = C − (rx, ry).
  const toW = (x: number, y: number): [number, number] => [((x - geo.left) / geo.s - 320) / PS, ((y - geo.top) / geo.s - PY) / PS];
  const head = (): [number, number] => { const [x, y] = facePoint(pose.body, -73.5, -140); return [x, y - lift()]; };
  const dist = () => { if (!cursor) return Infinity; const [hx, hy] = head(); return Math.hypot(cursor[0] - hx, (cursor[1] - hy) * 1.25) / HUNT_TUNING.shell; };
  const lookAt = (w: [number, number]): [number, number] => { const [hx, hy] = head(); return [9 * Math.tanh((w[0] - hx) / 150), 7 * Math.tanh((w[1] - hy) / 120)]; };
  const setPhase = (p: EmergePhase) => { phase = p; phaseT = 0; };

  // ---------------------------------------------------------------- limbs
  const contactJoint = (bone: Bone, cx: number, cy: number, a: number, sx: number, sy: number, p: BodyPose): Joint => {
    const lp = lowestPoint(bone, a, sx, sy);
    return [cx - lp.dx - p.rx, cy - lp.dy + lift() - p.ry, a, sx, sy];
  };
  function pawJoint(bone: 'L' | 'R', p: BodyPose): Joint {
    const w = paws[bone];
    if (!w.sw) {
      // Pressing squashes the paw about its contact (the peek rig's own 5 % press).
      return contactJoint(bone, w.cx, w.cy, w.a, w.sx * (1 + .025 * press), w.sy * (1 - .05 * press), p);
    }
    const s = w.sw, u = clamp01(s.t / s.dur), e = smoothstep(u), { from, to } = s;
    return contactJoint(bone, lerp(from.cx, to.cx, e), lerp(from.cy, to.cy, u) - s.lift * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** .85,
      lerp(from.a, to.a, e), lerp(from.sx, to.sx, e), lerp(from.sy, to.sy, e), p);
  }
  const standHold = (bone: 'L' | 'R'): Hold => { const r = REST[bone]; return { cx: restContact[bone][0], cy: restContact[bone][1], a: r[2], sx: r[3], sy: r[4] }; };
  function hindJoint(bone: 'HL' | 'HR', p: BodyPose): Joint {
    // Tucked under the shell (moves with the body) → standing (pinned to its contact), with a small arc.
    const k = smoothstep(hind[bone].k), r = REST[bone], [cx, cy] = restContact[bone];
    const stand = contactJoint(bone, cx, cy, r[2], r[3], r[4], p), tuck = PEEK.hind[bone];
    const j = tuck.map((v, i) => lerp(v, stand[i], k)) as Joint;
    j[1] -= 5 * Math.sin(Math.PI * k);
    return j;
  }
  /** Step a front paw to a hold: let go into the standing pose (release) or reach back to its grip (regrip). */
  function stepTo(bone: 'L' | 'R', toStand: boolean, liftH: number, dur = EMERGE_TUNING.step) {
    const w = paws[bone];
    if (w.sw) return;
    w.sw = { t: 0, dur, lift: liftH, from: { cx: w.cx, cy: w.cy, a: w.a, sx: w.sx, sy: w.sy }, to: toStand ? standHold(bone) : { ...w.grip } };
    w.released = toStand;
  }
  const gripping = () => FRONT.every(b => !paws[b].sw && !paws[b].released);
  function updateLimbs(dt: number) {
    for (const b of FRONT) {
      const s = paws[b].sw;
      if (!s) continue;
      s.t += dt;
      if (s.t >= s.dur) {
        Object.assign(paws[b], s.to, { sw: null });
        bob.v += 22; tail.a.v += (rand() - .5) * 22;
      }
    }
    for (const b of HIND) {
      const h = hind[b];
      if (!h.v) continue;
      h.k = clamp01(h.k + dt / h.v);
      if (h.k <= 0 || h.k >= 1) { if (h.k >= 1) bob.v += 10; h.v = 0; }
    }
  }

  // ---------------------------------------------------------------- start / end
  function begin(env: EmergeEnv, loop: PeekLoopState) {
    line = env.line; g = peekGeometry(line);
    pose = peekPoseFor(line, loop);
    const p = pose.body;
    U = 0; prevU = 0; prevVU = 0; press = 0; shadow = 0; soft = false; liftEnd = 0; Uf = 1;
    for (const s of [up, sway, bob, roll]) { s.x = 0; s.v = 0; }
    tilt.x = loop.tl; tilt.v = 0; yaw.x = 28; yaw.v = 0; rollX.x = EYE_X.R; rollX.v = 0;
    tail.x.x = p.T[0]; tail.y.x = p.T[1]; tail.a.x = p.T[2]; tail.x.v = tail.y.v = tail.a.v = 0;
    for (const b of FRONT) {
      const j = p[b], lp = lowestPoint(b, j[2], j[3], j[4]);
      const grip = { cx: j[0] + p.rx + lp.dx, cy: j[1] + p.ry + lp.dy, a: j[2], sx: j[3], sy: j[4] };
      paws[b] = { ...grip, grip, sw: null, released: false };
    }
    hind.HL = { k: 0, v: 0 }; hind.HR = { k: 0, v: 0 };
    // The near (right) front paw keeps its height: its standing contact on the edge fixes the final lift.
    const r = REST.R, lpR = lowestPoint('R', r[2], r[3], r[4]);
    liftEnd = r[1] + lpR.dy - paws.R.cy;
    Uf = liftEnd - g.rise;
    restContact = {} as Record<Bone, [number, number]>;
    for (const b of BONES) { const j = REST[b], lp = lowestPoint(b, j[2], j[3], j[4]); restContact[b] = [j[0] + lp.dx, j[1] + lp.dy - liftEnd]; }
    base = { L: eyeOverlap(p, 'L'), R: eyeOverlap(p, 'R') };
    face.reset({ ...neutralFace(), gx: loop.gx, gy: PEEK.gazeY, blink: loop.bl });
    glance = 0; glanceT = 0;
    active = true; setPhase('watch');
    events.push({ type: 'start', anchorDropPx: 0 });
  }
  /** After the hunt: standing on the edge in idle frame 0, `liftEnd` above the peek anchor at `line`. */
  function resume(env: EmergeEnv) {
    begin(env, { bl: 0, gx: 0, tl: 0 });
    events.length = 0;
    U = Uf; prevU = Uf; shadow = 1;
    for (const b of FRONT) Object.assign(paws[b], standHold(b), { released: true });
    hind.HL = { k: 1, v: 0 }; hind.HR = { k: 1, v: 0 };
    tail.x.x = 145; tail.y.x = -355; tail.a.x = 0;
    const from = env.resume?.from ?? null;
    face.reset(from ? { ...from.face } : neutralFace());
    // The hunt ran in between without this controller: start sensing afresh (an old sample would
    // read as a fast move, and an old still timer as a fresh rest).
    interest = 0; prev = null; cursor = null; cursorSpeed = 0; stillT = 0; lastMoveT = now - 1e3; lastDirX = 0; awayT = 0;
    const drop = liftEnd * PS * geo.s;
    geo = { ...geo, top: geo.top + drop };           // from now on the frame is the peek anchor
    // The hunt hands back within its own settle tolerance; ease from what is on screen.
    blendFrom = from && (from.body.side ?? 1) === 1 ? JSON.parse(JSON.stringify(from)) as HuntPose : null;
    setPhase('linger');
    pose = blendFrom ?? compose();
    events.push({ type: 'start', anchorDropPx: drop });
  }
  function finish(to: 'peek' | 'stand' | 'drag' | 'hard') {
    const inPeek = to === 'peek' || ((phase === 'watch' || phase === 'return' || phase === 'brace') && Math.abs(U + up.x) < 1);
    events.push({ type: 'end', to, liftPx: to === 'drag' || to === 'peek' ? 0 : lift() * PS * geo.s, inPeek });
    active = false; setPhase('off'); cooldown = 1.2; interest = Math.min(interest, .15);
  }

  // ---------------------------------------------------------------- sensing: the hunt's notice rules, measured from the peeking head
  function sense(dt: number) {
    prev = cursor;
    cursor = px.has && present ? toW(px.x, px.y) : null;
    const moved = prev && cursor ? Math.hypot(cursor[0] - prev[0], cursor[1] - prev[1]) : 0;
    const inst = dt > 0 ? moved / dt : 0;
    cursorSpeed = approach(cursorSpeed, inst, 8, dt);
    if (cursorSpeed < HUNT_TUNING.still) stillT += dt; else stillT = 0;
    if (inst > 60) lastMoveT = now;
    const d = dist();
    if (prev && cursor) {
      const vx = cursor[0] - prev[0];
      if (Math.abs(vx) / Math.max(dt, 1e-3) > 160) { const s = Math.sign(vx); if (lastDirX && s !== lastDirX && d < HUNT_TUNING.notice) interest += .1; lastDirX = s; }
    }
    if (cursor && d < HUNT_TUNING.notice) {
      const prox = 1 - d / HUNT_TUNING.notice;
      const stim = smoothstep((cursorSpeed - 40) / 320) * (1 - smoothstep((cursorSpeed - 2600) / 3000));
      interest += dt * stim * (.35 + 1.1 * prox) * (busyT > 0 ? .2 : 1);
      if (stillT > .3 && now - lastMoveT < 8) interest += dt * .25 * prox;
    }
    const watching = active && !!cursor && d < HUNT_TUNING.chase;
    interest -= dt * ((watching ? .04 : .16) + (cursor ? 0 : .5) + (d > HUNT_TUNING.release ? .35 : 0));
    interest = clamp01(interest);
    awayT = cursor && d < HUNT_TUNING.release ? 0 : awayT + dt;
    busyT -= dt;
  }

  // ---------------------------------------------------------------- behaviour
  /** Scale a head turn down until the fixed front paws come no closer to the eyes than in the peek itself. */
  function clearTurn(r: number, rx: number, y: number): [number, number] {
    const probe = (k: number) => {
      const test = { ...pose.body, b: headTilt(g.pivot, 0, PEEK.tail, r * k, [rx, -140]).b, yaw: 28 + (y - 28) * k };
      return Math.max(eyeOverlap(test, 'L') - base.L, eyeOverlap(test, 'R') - base.R);
    };
    let k = 1;
    for (let i = 0; i < 8 && probe(k) > .25; i++) k *= .65;
    return [r * k, 28 + (y - 28) * k];
  }
  const leavingNow = () => !cursor || awayT > .25 || dist() > HUNT_TUNING.release;
  const backOff = () => soft || busyT > 0 || leavingNow();
  // Somebody wants to play again while it is on its way back down.
  const playAgain = () => !soft && busyT <= 0 && !!cursor && !leavingNow() && interest > EMERGE_TUNING.again;
  const retreatFrom = () => { pushFrom = U; pushDur = EMERGE_TUNING.retreat[0] + EMERGE_TUNING.retreat[1] * clamp01(U / 160); setPhase('retreat'); };
  const pushOn = () => { pushFrom = U; pushDur = EMERGE_TUNING.push[0] + EMERGE_TUNING.push[1] * clamp01((Uf - U) / 160); setPhase('push'); };
  function think(dt: number) {
    const was = phase;
    const out = targets(dt);
    // On a phase change this frame's targets belong to the old phase: hold the peek-up where it is.
    if (phase !== was) { out.up = up.x; out.upRate = 20; }
    return out;
  }
  function targets(dt: number) {
    phaseT += dt;
    const c = cursor, d = dist();
    fcmd.noBlink = false; fcmd.blinkNow = false; fcmd.pursuit = true; fcmd.rate = {};
    fcmd.look = c ? lookAt(c) : [0, PEEK.gazeY];
    const out = { tilt: 0, yaw: 28, up: 0, upRate: phase === 'return' ? 8 : 5, roll: 0, rollX: rollX.x, sway: 0, bob: 0 };
    switch (phase) {
      case 'watch': {
        // Eyes first: look, glance aside, look again; the head turns toward it a beat later.
        fcmd.expr = { pupil: 1.04 + .1 * interest, focus: .15 + .35 * interest, wide: phaseT < .5 ? .22 : 0 }; fcmd.rate = { wide: 10 };
        glanceT -= dt;
        if (glanceT <= 0) { glance++; glanceT = glance % 2 ? .4 + rand() * .4 : .16 + rand() * .16; if (!(glance % 2) && rand() < .45) fcmd.blinkNow = true; }
        if (c && !(glance % 2)) { const [gx, gy] = lookAt(c); fcmd.look = [gx * .35, gy * .3 - 2]; }
        if (c && phaseT > .18) {
          const [hx, hy] = head(), dx = c[0] - hx, side = dx >= 0 ? 'R' : 'L';
          out.rollX = EYE_X[side];
          [out.roll, out.yaw] = clearTurn(5.5 * Math.tanh(dx / 170), out.rollX, 28 - 3.2 * Math.tanh(dx / 200));
          if (glance % 2 === 0) out.roll *= .45;                     // glancing aside, the head half returns
          out.up = 9 * clamp01((hy - c[1]) / 260) + 6 * interest;   // rises a little to see over the edge
        }
        // Getting ready: the paws start to grip the edge as the interest builds.
        press = approach(press, .4 * smoothstep((interest - .4) / .25), 6, dt);
        if (backOff() || (interest < .1 && phaseT > .8)) { setPhase('return'); break; }
        const ready = phaseT > EMERGE_TUNING.watchMin && glance >= 3 && !!c && d < HUNT_TUNING.chase;
        if (ready && (interest > EMERGE_TUNING.emerge || (stillT > .5 && interest > .42))) { dipFrom = up.x; setPhase('brace'); }
        break;
      }
      case 'return':
        fcmd.look = [0, PEEK.gazeY]; fcmd.expr = {}; fcmd.rate = { pupil: 9, focus: 9, wide: 9, squint: 9 };
        press = approach(press, 0, 10, dt);
        if (!soft && busyT <= 0 && c && !leavingNow() && interest > .5 && phaseT > .3) setPhase('watch');
        break;
      case 'brace':
        // Both paws press on the edge, the body dips, eyes locked on; the head straightens for the push.
        fcmd.noBlink = true; fcmd.expr = { pupil: 1.14, focus: .65, squint: .12 };
        press = Math.max(press, smoothstep(phaseT / (EMERGE_TUNING.brace * .7)));
        out.up = dipFrom - 5; out.upRate = 26;
        if (backOff()) { U += up.x; up.x = 0; up.v = 0; retreatFrom(); break; }
        if (phaseT >= EMERGE_TUNING.brace) { U += up.x; up.x = 0; up.v = 0; pushOn(); }
        break;
      case 'push': {
        fcmd.noBlink = true; fcmd.expr = { pupil: 1.12, focus: .55 };
        const u = clamp01(phaseT / pushDur);
        U = lerp(pushFrom, Uf, pullUp(u));
        press = Math.min(press, 1 - smoothstep(u / .35));
        // The hind legs come out from under the shell as it clears the edge.
        if (U / Uf > .6 && hind.HL.k < 1 && hind.HL.v <= 0) hind.HL.v = .22;
        if (U / Uf > .72 && hind.HR.k < 1 && hind.HR.v <= 0) hind.HR.v = .22;
        // Nobody to play with any more: the paws still hold the edge, so it lies back down from here.
        if (backOff()) { retreatFrom(); break; }
        if (u >= 1) { bob.v += 30; setPhase('shift'); }   // the body lands its weight on the edge
        break;
      }
      case 'retreat': {
        // Lie back down: the paws stay on the edge, the body sinks behind it, the hind legs tuck,
        // the shadow goes; it looks up over the edge again as in the peek.
        fcmd.expr = { pupil: 1.02 }; press = approach(press, 0, 12, dt);
        if (!c) fcmd.look = [0, PEEK.gazeY];
        const u = clamp01(phaseT / pushDur);
        U = lerp(pushFrom, 0, smoothstep(u));
        for (const b of HIND) if (hind[b].k > 0 && hind[b].v >= 0) hind[b].v = -.2;
        shadow = approach(shadow, 0, 9, dt);
        if (playAgain() && phaseT > .15) { pushOn(); break; }
        if (u >= 1 && !hind.HL.k && !hind.HR.k) { U = 0; setPhase('return'); }
        break;
      }
      case 'shift':
        // The centre of mass moves back over the hind legs (it sits back a little) before the hands let go.
        fcmd.expr = { pupil: 1.1, focus: .5 };
        for (const b of HIND) if (hind[b].k < 1 && hind[b].v <= 0) hind[b].v = .14;
        out.sway = 5 * smoothstep(phaseT / (EMERGE_TUNING.shift * .7)); out.bob = 3.5 * smoothstep(phaseT / EMERGE_TUNING.shift);
        if (backOff() && !soft) { retreatFrom(); break; }
        if (phaseT >= EMERGE_TUNING.shift && hind.HL.k >= 1 && hind.HR.k >= 1) setPhase('release');
        break;
      case 'release': {
        // Let go: the far paw first, then the near one; the body comes forward over them as they land.
        const staying = !backOff();
        if (staying) fcmd.expr = { pupil: 1.1, focus: .5 }; else { fcmd.expr = {}; fcmd.look = null; }
        if (!paws.L.released) stepTo('L', true, 16);
        if (phaseT >= EMERGE_TUNING.stepGap && !paws.R.released) stepTo('R', true, 12);
        const back = 1 - smoothstep((phaseT - .08) / (EMERGE_TUNING.stepGap + EMERGE_TUNING.step - .04));
        out.sway = 5 * back; out.bob = 3.5 * back;
        shadow = approach(shadow, 1, 7, dt);
        break;
      }
      case 'linger':
        // Standing on the edge and nobody plays: a short look around, then back to the edge.
        fcmd.expr = {}; fcmd.look = c && phaseT < .2 ? lookAt(c) : [0, 0];
        if (phaseT >= EMERGE_TUNING.linger && !playAgain()) setPhase('regrip');
        break;
      case 'regrip':
        // Hands back onto the edge where they held it: the near paw, then the far one reaching
        // forward; the body leans over them before it sinks.
        fcmd.expr = {}; fcmd.look = [0, PEEK.gazeY * .5];
        if (paws.R.released) stepTo('R', false, 12);
        if (phaseT >= EMERGE_TUNING.regripGap && paws.L.released) stepTo('L', false, 16, .24);
        out.sway = -4 * smoothstep(phaseT / .3);
        if (gripping()) { if (playAgain()) setPhase('shift'); else retreatFrom(); }
        break;
    }
    return out;
  }

  function updateBody(dt: number, t: ReturnType<typeof targets>) {
    const watching = phase === 'watch';
    stepSpring(tilt, t.tilt, watching ? 7 : 12, 1, dt);
    stepSpring(roll, t.roll, watching ? 6.5 : 11, 1, dt);
    stepSpring(rollX, t.rollX, 9, 1, dt);
    stepSpring(yaw, t.yaw, watching ? 6 : 12, 1, dt);
    stepSpring(up, t.up, t.upRate, 1, dt);
    stepSpring(sway, t.sway, 14, .75, dt);
    stepSpring(bob, t.bob, 20, .55, dt);
    updateLimbs(dt);
    // Tail: the peek's forward lean (turning with the head) while hidden, the rest pose once out;
    // springs let it lag the push and swing on the stops.
    const out = phase === 'shift' || phase === 'release' || phase === 'linger' || phase === 'regrip' ? 1 : clamp01(U / Uf);
    const peekTail = headFrame().T;
    tailNoiseT -= dt;
    if (tailNoiseT <= 0) { tailNoiseTarget = (rand() * 2 - 1) * (watching ? 3 : 1.2); tailNoiseT = .45 + rand() * .8; }
    tailNoise = approach(tailNoise, tailNoiseTarget, 6, dt);
    const vU = (U - prevU) / Math.max(dt, 1e-3);
    tail.a.v += (vU - prevVU) * .05;           // lags a sudden rise or stop
    prevU = U; prevVU = vU;
    const calm = phase === 'return' || phase === 'release' || phase === 'linger' || phase === 'regrip';
    stepSpring(tail.x, lerp(peekTail[0], 145, out), 16, .6, dt);
    stepSpring(tail.y, lerp(peekTail[1], -355, out), 16, .6, dt);
    stepSpring(tail.a, lerp(peekTail[2], 0, out) + (calm ? 0 : tailNoise), 12, .42, dt);
  }

  const headFrame = () => headTilt(g.pivot, tilt.x, PEEK.tail, roll.x, [rollX.x, -140]);
  function compose(): HuntPose {
    const body = restPose();
    body.yaw = yaw.x; body.rx = sway.x;
    body.ry = -g.rise - (U + up.x) + lift() + bob.x;
    body.b = headFrame().b;
    body.T = [tail.x.x, tail.y.x, clamp(tail.a.x, -30, 40), 1, 1];
    for (const b of FRONT) body[b] = pawJoint(b, body);
    for (const b of HIND) body[b] = hindJoint(b, body);
    return { body, face: { ...face.f }, shadow: { x: PS * body.rx * .4, scale: 1, opacity: shadow } };
  }

  /** Pose a → b by k (joints, root and shadow; the face runs on its own). */
  function mixPose(a: HuntPose, b: HuntPose, k: number): HuntPose {
    const body = { ...b.body };
    for (const key of ['yaw', 'rx', 'ry', 'spin', 'zoom'] as const) body[key] = lerp(a.body[key], b.body[key], k);
    for (const key of ['b', 'T', 'L', 'R', 'HL', 'HR'] as const) body[key] = a.body[key].map((v, i) => lerp(v, b.body[key][i], k)) as Joint;
    return { body, face: b.face, shadow: { x: lerp(a.shadow.x, b.shadow.x, k), scale: lerp(a.shadow.scale, b.shadow.scale, k), opacity: lerp(a.shadow.opacity, b.shadow.opacity, k) } };
  }

  // The start and end poses are exact; these gates let the motion converge before the sub-unit snap.
  function convergedToPeek() {
    const f = face.f;
    return Math.abs(tilt.x) < .03 && Math.abs(roll.x) < .03 && Math.abs(yaw.x - 28) < .03 && Math.abs(up.x) < .08 && U === 0 && Math.abs(bob.x) < .08 && Math.abs(sway.x) < .08
      && Math.abs(f.gx) < .12 && Math.abs(f.gy - PEEK.gazeY) < .12 && f.blink < .01 && Math.abs(f.pupil - 1) < .01 && f.focus < .01 && f.wide < .01 && f.squint < .01
      && !hind.HL.k && !hind.HR.k && press < .01 && Math.abs(tail.a.x - PEEK.tail) < .2 && Math.hypot(tail.x.x - 145, tail.y.x + 355) < .3;
  }
  function convergedToRest() {
    return !paws.L.sw && !paws.R.sw && paws.L.released && paws.R.released && hind.HL.k >= 1 && hind.HR.k >= 1 && U === Uf && Math.abs(up.x) < .01
      && Math.abs(bob.x) < .25 && Math.abs(sway.x) < .25 && Math.abs(bob.v) < 3 && Math.abs(sway.v) < 3
      && Math.abs(tilt.x) < .03 && Math.abs(roll.x) < .03 && Math.abs(yaw.x - 28) < .03 && Math.abs(tail.a.x) < .5 && Math.hypot(tail.x.x - 145, tail.y.x + 355) < .5 && shadow > .97;
  }

  function frame(): EmergeFrame {
    const planted: Partial<Record<Bone, [number, number]>> = {};
    if (active && !blendFrom) {   // while easing out of the hunt's last pose the paws settle (≤ its 2.5-unit tolerance)
      for (const b of FRONT) if (!paws[b].sw) planted[b] = [paws[b].cx, paws[b].cy];
      for (const b of HIND) if (hind[b].k >= 1) planted[b] = restContact[b];
    }
    return {
      active, phase, pose, liftPx: active ? lift() * PS * geo.s : 0, interest, events,
      debug: { U: U + up.x, Uf, lift: lift(), phaseT, cursor, planted },
    };
  }

  function drop(dt: number) {
    // Ease every joint to the rest pose (= drag frame 0) inside the container, like the peek's 340 ms let-go.
    phaseT += dt;
    const u = smoothstep(phaseT / EMERGE_TUNING.drop), from = dropFrom!, body = restPose();
    body.yaw = lerp(from.body.yaw, REST.yaw, u); body.rx = lerp(from.body.rx, 0, u); body.ry = lerp(from.body.ry, 0, u);
    for (const k of ['b', 'T', 'L', 'R', 'HL', 'HR'] as const) body[k] = from.body[k].map((v, i) => lerp(v, REST[k][i], u)) as Joint;
    const n = neutralFace(), f = { ...n };
    for (const k of Object.keys(n) as (keyof FacePose)[]) f[k] = lerp(from.face[k], n[k], u);
    pose = { body, face: f, shadow: { x: lerp(from.shadow.x, 0, u), scale: 1, opacity: lerp(from.shadow.opacity, 1, u) } };
    if (phaseT >= EMERGE_TUNING.drop) finish('drag');
  }

  return {
    face,
    /** Latest mouse position (viewport px). Passive pointermove, mouse pointers only. */
    pointer(x: number, y: number) { px = { x, y, has: true }; present = true; },
    /** The mouse left the window. */
    leave() { present = false; },
    /** A click or key press elsewhere: back off for a moment. */
    busy() { busyT = 2.5; interest *= .4; },
    get active() { return active; },
    get phase() { return phase; },
    step(dtMs: number, env: EmergeEnv): EmergeFrame {
      const dt = clamp(dtMs / 1000, 0, .05);
      now += dt; events = [];
      geo = { s: env.box.width / 640, left: env.box.left, top: env.box.top };
      sense(dt);
      if (!active) {
        cooldown -= dt;
        if (env.resume && env.canStart && !env.stop && env.resume.line >= PEEK.min && env.resume.line <= PEEK.max) {
          resume({ ...env, line: env.resume.line });
          return frame();   // idle frame 0, shown through liftPx on the lowered anchor
        }
        if (env.canStart && !env.stop && cooldown <= 0 && busyT <= 0 && cursor && interest > EMERGE_TUNING.start
          && env.line >= PEEK.min && env.line <= PEEK.max) {
          pose = peekPoseFor(env.line);
          if (dist() < HUNT_TUNING.notice) {
            // Take over between blinks: the hunt face resumes a blink only from its closing half.
            const loop = env.loop?.();
            if (loop && loop.bl <= .001) begin(env, loop);
          }
        }
        return frame();   // the takeover frame is exactly the peek on screen
      }
      if (env.stop === 'hard') { finish('hard'); return frame(); }
      if (env.stop === 'drag' && phase !== 'drop') {
        events.push({ type: 'yield', liftPx: lift() * PS * geo.s });
        dropFrom = JSON.parse(JSON.stringify(pose)) as HuntPose;
        liftEnd = 0; U = 0; up.x = 0; up.v = 0;   // the host committed the lift; the container frame is final
        setPhase('drop');
      }
      if (phase === 'drop') { drop(dt); return frame(); }
      if (env.stop === 'soft') soft = true;
      const targets = think(dt);
      updateBody(dt, targets);
      face.update(dt, fcmd);
      pose = compose();
      if (blendFrom) {
        if (phase === 'linger' && phaseT < EMERGE_TUNING.linger) pose = mixPose(blendFrom, pose, smoothstep(phaseT / EMERGE_TUNING.linger));
        else blendFrom = null;
      }
      if (phase === 'return' && phaseT > .2 && convergedToPeek()) {
        pose = peekPoseFor(line); finish('peek');
      } else if ((phase === 'release' && phaseT > .45 || phase === 'linger' && !blendFrom) && convergedToRest()) {
        const f = face.f, rest = (face: FacePose): HuntPose => ({ body: JSON.parse(JSON.stringify(REST)) as BodyPose, face, shadow: { x: 0, scale: 1, opacity: 1 } });
        if (phase === 'release' ? !backOff() : playAgain()) {
          // Standing with both paws let go: the hunt takes it from here (same pose, same frame).
          const look = { ...f, blink: 0 };
          pose = rest(look);
          events.push({ type: 'handoff', liftPx: liftEnd * PS * geo.s, engage: { mode: stillT > EMERGE_TUNING.stalk ? 'stalk' : 'chase', face: look, interest: Math.max(interest, .5) }, idle: { time: 0, gx: look.gx, gy: look.gy } });
          active = false; setPhase('off'); cooldown = 1.2; interest = Math.min(interest, .15);
        } else if (soft && Math.abs(f.gx) < .4 && Math.abs(f.gy) < .4 && f.focus < .03 && Math.abs(f.pupil - 1) < .03 && f.blink < .01) {
          // Another action needs the art: yield standing; the site's idle continues from frame 0.
          pose = rest(neutralFace());
          finish('stand');
        } else if (phase === 'release' && !soft) {
          // Nobody to play with: it will lie back down into hiding (linger → regrip → retreat).
          setPhase('linger');
        }
      }
      return frame();
    },
  };
}
