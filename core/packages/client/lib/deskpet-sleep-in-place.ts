// Root Beast "falls asleep where it stands" (原地睡着) runtime.
//
// Continues from the drowsy idle's last pose (ready-for-bed) on the same rig
// (rootbeast-drowsy-rig.svg, drawn by createDrowsyRenderer): the lids close
// slowly, head and body relax, it lies down on the spot into the gallery
// sleeping pose (character.mjs "curl", 25-sleeping.svg) and keeps that loop's
// breathing. Only wake() — a click / press on the pet — wakes it; it rises
// straight back to the 01-idle first frame and hands the art back.
//
// There is deliberately no pointer-move input: moving or shaking the mouse
// near the pet cannot wake it. Nothing here listens to the DOM or owns timers;
// the host calls step(dtMs) and acts on the events.

import { createDrowsyRenderer, openDrowsyFace, readyPose } from './deskpet-drowsy';
import type { DrowsyFace, DrowsyPose } from './deskpet-drowsy';
import { idlePoseAt, mulberry32, neutralFace, resolveBody, restPose } from './deskpet-mouse-hunt';
import type { BodyPose, FacePose, Joint } from './deskpet-mouse-hunt';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const mixJoint = (a: Joint, b: Joint, t: number): Joint => a.map((v, i) => v + (b[i] - v) * t) as Joint;
const cloneBody = (p: BodyPose): BodyPose => ({
  ...p, b: [...p.b] as Joint, L: [...p.L] as Joint, R: [...p.R] as Joint,
  HL: [...p.HL] as Joint, HR: [...p.HR] as Joint, T: [...p.T] as Joint,
});
const lerpFace = (a: FacePose, b: FacePose, t: number): FacePose => {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof FacePose)[]) out[k] = lerp(a[k], b[k], t);
  return out;
};
// CSS ease-in-out, the per-segment curve of the gallery loops (character.mjs keyframes).
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

// Smooth keyed value (monotone cubic, zero slope at the ends, holds outside).
type Key = readonly [number, number];
function keyed(keys: readonly Key[]) {
  const xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), n = keys.length, d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  const ms = xs.map((_, i) => {
    if (i === 0 || i === n - 1 || d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  return (t: number) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < t) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * ms[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * ms[i + 1];
  };
}
const bell = (t: number, a: number, peak: number, b: number) => t <= a || t >= b ? 0 : t < peak ? smoothstep((t - a) / (peak - a)) : 1 - smoothstep((t - peak) / (b - peak));

// ------------------------------------------------------------------ sleeping pose (25-sleeping.svg)
// character.mjs "curl" and choreography.mjs "sleeping": curl at 0 % and 100 %,
// the breath key at 48 %, 4.8 s loop, CSS ease-in-out per segment.
const CURL_SOURCE: Partial<BodyPose> = {
  yaw: 28, b: [0, 68, 0, 1.03, .78], L: [-206, -7, 52, 1, .6], R: [55, -3, 47, 1, .6],
  HL: [-90, -11, -10, .75, .5], HR: [207, -12, -14, .9, .55], T: [147, -267, 52, .72, .72], ry: 8,
};
const BREATH_SOURCE: Partial<BodyPose> = { b: [0, 65, 0, 1.034, .792], T: [147, -269, 54, .72, .72] };
export const SLEEP_LOOP_SECONDS = 4.8;
const curlPose = (extra: Partial<BodyPose> = {}) => resolveBody({ ...restPose(), ...CURL_SOURCE, ...extra } as BodyPose);
const CURL = curlPose(), CURL_IN = curlPose(BREATH_SOURCE);
export const CURL_STANCE = () => cloneBody(CURL);
const BONES5 = ['b', 'L', 'R', 'HL', 'HR', 'T'] as const;
/** Lying body at breath amount u (0 = exhaled curl, 1 = the gallery's inhale key; > 1 = a deeper sigh). */
export function sleepBody(u: number, tailFlick = 0): BodyPose {
  const p = cloneBody(CURL);
  for (const k of BONES5) p[k] = mixJoint(CURL[k], CURL_IN[k], u);
  p.T[2] += tailFlick;
  return p;
}
/** Body of 25-sleeping.svg at `seconds` into its loop. */
export function sleepingPoseAt(seconds: number): BodyPose {
  return sleepBody(galleryBreath(((seconds % SLEEP_LOOP_SECONDS) + SLEEP_LOOP_SECONDS) % SLEEP_LOOP_SECONDS / SLEEP_LOOP_SECONDS));
}
// Breath amount over one cycle (phase 0 … 1): up to the 48 % key, back down after it.
const galleryBreath = (phase: number) => phase < .48 ? easeInOutCss(phase / .48) : 1 - easeInOutCss((phase - .48) / .52);
/** Sleeping face: the gallery's closed-eye arcs and small sleep mouth. */
export const sleepFace = (): FacePose => neutralFace();
export const sleepDrowsyFace = (): DrowsyFace => ({ ...openDrowsyFace(), lidL: 1, lidR: 1, sleep: 1 });

// ------------------------------------------------------------------ snore "z z z"
// The gallery's zzz (build-rootbeast.mjs, used by 25-sleeping): per breath
// cycle (phase 0 … 1) each of the three z waits, rises 20 units while fading in
// over 11 % of the cycle, then drifts 14 across and 48 more up while fading out.
// z i keys at (12 + 14 i) %, (23 + 14 i) % and (60 + 10 i) %, CSS ease-in-out
// per segment, so they follow the breathing. The rig starts them above the
// middle of the head, clear of the √³ (see rootbeast-sleep-rig.svg), and glyphs
// and distances are both 1.8× the gallery's so they read at 176 px.
export const SNORE_SCALE = 1.8;
export interface SnoreZ { dx: number; dy: number; o: number }
export interface Snore { on: number; z: [SnoreZ, SnoreZ, SnoreZ] }
export interface SleepPose extends DrowsyPose { snore: Snore }
export const noSnore = (): Snore => ({ on: 0, z: [0, 1, 2].map(() => ({ dx: 0, dy: 0, o: 0 })) as Snore['z'] });
/** The three z at breath-cycle `phase`; `still` keeps them in place (reduced motion: they only fade). */
export function snoreAt(phase: number, still = false): Snore['z'] {
  return [0, 1, 2].map(i => {
    const a = (12 + 14 * i) / 100, b = (23 + 14 * i) / 100, c = (60 + 10 * i) / 100;
    let dx = 0, dy = 0, o = 0;
    if (phase >= a && phase < b) { const e = easeInOutCss((phase - a) / (b - a)); dy = -20 * e; o = e; }
    else if (phase >= b && phase < c) { const e = easeInOutCss((phase - b) / (c - b)); dx = 14 * e; dy = -20 - 48 * e; o = 1 - e; }
    else if (phase >= c) { dx = 14; dy = -68; }
    return still ? { dx: 0, dy: 0, o } : { dx: dx * SNORE_SCALE, dy: dy * SNORE_SCALE, o };
  }) as Snore['z'];
}
/** 25-sleeping at `seconds` into its 4.8 s loop as a full pose: body, closed eyes, and the three z. */
export function sleepingFrameAt(seconds: number): SleepPose {
  const phase = ((seconds % SLEEP_LOOP_SECONDS) + SLEEP_LOOP_SECONDS) % SLEEP_LOOP_SECONDS / SLEEP_LOOP_SECONDS;
  return { body: sleepingPoseAt(seconds), face: sleepFace(), drowsy: sleepDrowsyFace(), shadow: { x: 0, scale: 1, opacity: 1 }, snore: { on: 1, z: snoreAt(phase) } };
}

// ------------------------------------------------------------------ renderer
/** The drowsy renderer on the sleep rig (rootbeast-sleep-rig.svg = the drowsy rig + the snore
 *  layer), plus the snore z and one detail for long sleep: an eye whose lids are fully shut hides
 *  its eye white, exactly like 25-sleeping (closed-eye arc only). The white's own opacity is
 *  restored as soon as the lids open again. A pose without `snore` hides the z. */
export function createSleepRenderer(svg: SVGSVGElement) {
  if (svg.getAttribute('data-rootbeast-sleep') !== 'rig' || svg.getAttribute('data-sleep-version') !== '1') throw Error('sleep rig missing or wrong version');
  const base = createDrowsyRenderer(svg);
  const part = (sel: string) => {
    const el = svg.querySelector<SVGGraphicsElement>(sel);
    if (!el) throw Error(`rig part missing: ${sel}`);
    return el;
  };
  const whites = ['l', 'r'].map(s => part(`[data-hunt="open-${s}"]`));
  const zzz = part('[data-sleep="zzz"]'), zs = [0, 1, 2].map(i => part(`[data-sleep="z${i}"]`));
  const cache = new Map<string, string>();
  const attr = (el: Element, id: string, name: string, value: string) => {
    if (cache.get(id) === value) return;
    cache.set(id, value);
    el.setAttribute(name, value);
  };
  const fx = (v: number) => String(Math.round(v * 10000) / 10000);
  const saved: (string | null)[] = [null, null], hidden = [false, false];
  const render = (pose: DrowsyPose | SleepPose) => {
    base.render(pose);
    const snore = 'snore' in pose ? pose.snore : null, on = snore ? clamp01(snore.on) : 0;
    attr(zzz, 'zzz', 'opacity', on > .001 ? fx(on) : '0');
    zs.forEach((el, i) => {
      const z = snore?.z[i] ?? { dx: 0, dy: 0, o: 0 };
      attr(el, 'zt' + i, 'transform', `translate(${fx(z.dx)} ${fx(z.dy)})`);
      attr(el, 'zo' + i, 'opacity', fx(on > .001 ? clamp01(z.o) : 0));
    });
    [pose.drowsy.lidL, pose.drowsy.lidR].forEach((lid, i) => {
      const el = whites[i], shut = lid >= .999 && pose.face.smile < .01;
      if (shut) {
        // Remember what the hunt renderer last wrote, then hide.
        const cur = el.getAttribute('opacity');
        if (cur !== '0') saved[i] = cur;
        el.setAttribute('opacity', '0');
      } else if (hidden[i]) {
        if (saved[i] === null) el.removeAttribute('opacity'); else el.setAttribute('opacity', saved[i]!);
      }
      hidden[i] = shut;
    });
  };
  return { svg, render };
}

// ------------------------------------------------------------------ timelines
// Falling asleep (from the drowsy ready-for-bed pose): eyes close first (one
// last flutter), the head droops, then it lies down on the spot — front paws
// fold first, body follows, hind feet tuck, the tail settles last — a small
// settling bump, one deep breath, then the regular sleeping breath.
export const FALL_SECONDS = 7;
const FALL = {
  close: keyed([[0, 0], [1.0, .45], [1.45, .3], [2.6, 1]]),
  droopY: keyed([[0, 0], [1.4, 3], [2.6, 8], [3.6, 5], [5, 0]]),
  droopA: keyed([[0, 0], [2.6, 3.5], [3.8, 2], [5.2, 0]]),
  pitch: keyed([[0, 0], [2.4, .45], [3.6, .35], [5.4, 0]]),
  front: keyed([[2.3, 0], [3.2, .25], [4.3, .75], [5.0, 1]]),
  body: keyed([[2.5, 0], [3.4, .2], [4.6, .7], [5.4, .95], [6.0, 1]]),
  hind: keyed([[2.8, 0], [4.0, .4], [5.2, .9], [5.8, 1]]),
  tail: keyed([[3.2, 0], [4.6, .45], [6.2, 1]]),
  plop: keyed([[5.1, 0], [5.6, 3.5], [6.3, 0]]),
  breath: keyed([[5.6, 0], [6.6, 1]]),
};
export const FALL_MARKS = { eyesClosed: 2.6, lieDown: 2.3 };
// Waking (any time before awake): eyes open almost at once, it looks up, rises
// with a small lift and ends exactly on 01-idle's first frame.
export const WAKE_SECONDS = 1.4;
const WAKE = {
  open: keyed([[0, 0], [.08, 0], [.33, 1]]),
  front: keyed([[.1, 0], [.45, .5], [.85, .95], [1.05, 1]]),
  body: keyed([[.14, 0], [.55, .45], [.95, .92], [1.25, 1]]),
  hind: keyed([[.25, 0], [.7, .55], [1.1, .95], [1.3, 1]]),
  tail: keyed([[.2, 0], [.8, .6], [1.35, 1]]),
  lift: keyed([[0, 0], [.5, -2], [.85, -5], [1.25, 0]]),
  face: keyed([[.05, 0], [.5, .7], [1.2, 1]]),
  look: keyed([[.25, 0], [.45, 1], [.95, 1], [1.35, 0]]),
};
const IDLE0 = () => { const p = idlePoseAt(0); return { body: p.body, face: p.face }; };

// ------------------------------------------------------------------ controller
export type SleepPhase = 'off' | 'falling' | 'asleep' | 'waking';
export type SleepEvent =
  | { type: 'start'; asleep: boolean }
  | { type: 'lie-down' }
  | { type: 'eyes-closed' }
  | { type: 'asleep' }
  | { type: 'sigh' }
  | { type: 'wake'; from: Exclude<SleepPhase, 'off' | 'waking'> }
  | { type: 'awake'; pose: SleepPose }
  | { type: 'stop' };
export interface SleepFrame { active: boolean; phase: SleepPhase; time: number; asleepFor: number; pose: SleepPose; events: SleepEvent[] }
export interface SleepOptions { seed?: number; reducedMotion?: boolean }
export interface SleepStart {
  /** Pose on screen when sleep starts (the drowsy frame at / after ready-for-bed). Default: readyPose(1). */
  from?: DrowsyPose;
  /** Start already asleep (e.g. the page was reloaded while it slept). */
  asleep?: boolean;
}

export function createSleepController(options: SleepOptions = {}) {
  const rand = mulberry32(options.seed ?? 20261028);
  const reduced = !!options.reducedMotion;
  const pick = (a: number, b: number) => a + (b - a) * rand();
  let active = false, phase: SleepPhase = 'off', t = 0, asleepAt = 0;
  let from: DrowsyPose = readyPose(1), wakeFrom: SleepPose | null = null, look = { gx: 0, gy: -2 };
  let events: SleepEvent[] = [], marks = new Set<string>(), last: SleepPose | null = null;
  // Snore z follow the current breath cycle. They start with the first breath that begins after
  // falling asleep (so the first z rises from its own start) and fade in over a second.
  let snoreOn = 0, snoreArmed = false;
  // Breathing: one cycle at a time; the gallery cycle is amp 1 / 4.8 s. Cycles
  // vary a little, with an occasional deeper, slower sigh; the tail tip flicks rarely.
  const cycle = { t: 0, period: 6.2, amp: reduced ? 1.15 : 1.5, sigh: true };
  let breathOn = false, flickAt = 0, flickT = -1;
  const emit = (e: SleepEvent) => { events.push(e); };
  const nextCycle = () => {
    const sigh = !reduced && !cycle.sigh && rand() < .1;
    Object.assign(cycle, { t: 0, sigh, period: sigh ? pick(6, 6.8) : pick(4.5, 5.1), amp: sigh ? pick(1.45, 1.65) : (reduced ? .7 : pick(.88, 1.12)) });
    if (sigh) emit({ type: 'sigh' });
    if (phase === 'asleep') snoreArmed = true;
  };
  const breathAt = (dt: number) => {
    if (!breathOn) return 0;
    cycle.t += dt;
    if (cycle.t >= cycle.period) { cycle.t -= cycle.period; nextCycle(); }
    return cycle.amp * galleryBreath(cycle.t / cycle.period);
  };
  const flickAmount = (dt: number) => {
    if (reduced || phase !== 'asleep') return 0;
    if (flickT < 0 && t >= flickAt) flickT = 0;
    if (flickT < 0) return 0;
    flickT += dt;
    const v = 5 * bell(flickT, 0, .45, 1.3);
    if (flickT >= 1.3) { flickT = -1; flickAt = t + pick(50, 110); }
    return v;
  };

  function fallingPose(time: number, u: number): SleepPose {
    const f = from.body, body = cloneBody(f);
    // Head and body relax a little before it lies down.
    body.b[1] += FALL.droopY(time); body.b[2] += FALL.droopA(time); body.b[4] *= 1 - .015 * clamp01(FALL.droopY(time) / 8);
    const target = sleepBody(u * FALL.breath(time));
    target.b[1] += FALL.plop(time); target.b[4] *= 1 - .006 * FALL.plop(time);
    const sB = FALL.body(time);
    body.yaw = lerp(body.yaw, target.yaw, sB); body.ry = lerp(body.ry, target.ry, sB);
    body.rx = lerp(body.rx, target.rx, sB); body.spin = lerp(body.spin, target.spin, sB); body.zoom = lerp(body.zoom, target.zoom, sB);
    body.b = mixJoint(body.b, target.b, sB);
    body.L = mixJoint(f.L, target.L, FALL.front(time)); body.R = mixJoint(f.R, target.R, FALL.front(time));
    body.HL = mixJoint(f.HL, target.HL, FALL.hind(time)); body.HR = mixJoint(f.HR, target.HR, FALL.hind(time));
    body.T = mixJoint(body.T, target.T, FALL.tail(time));
    const w = smoothstep(time / 1.8);
    const face = lerpFace(from.face, sleepFace(), w);
    face.gy = lerp(from.face.gy, 3, smoothstep(time / 1.6)) * (1 - smoothstep((time - 2.6) / .8));
    const d = from.drowsy, c = FALL.close(time);
    const lidR = d.lidR + (1 - d.lidR) * FALL.close(time - .06);
    const drowsy: DrowsyFace = {
      lidL: d.lidL + (1 - d.lidL) * c, lidR, yawn: lerp(d.yawn, 0, smoothstep(time / .8)), shy: lerp(d.shy, 0, smoothstep(time / .8)),
      sleep: lerp(d.sleep, 1, smoothstep(time / 2)), pitch: lerp(d.pitch, 0, smoothstep(time / 1.2)) + FALL.pitch(time),
    };
    const shadow = { x: lerp(from.shadow.x, 0, sB), scale: lerp(from.shadow.scale, 1, sB), opacity: lerp(from.shadow.opacity, 1, sB) };
    return { body, face, drowsy, shadow, snore: noSnore() };
  }
  function asleepPose(u: number, flick: number, snore: Snore): SleepPose {
    return { body: sleepBody(u, flick), face: sleepFace(), drowsy: sleepDrowsyFace(), shadow: { x: 0, scale: 1, opacity: 1 }, snore };
  }
  function wakingPose(time: number): SleepPose {
    const p = wakeFrom!, idle = IDLE0(), body = cloneBody(p.body);
    const sB = WAKE.body(time);
    body.yaw = lerp(p.body.yaw, idle.body.yaw, sB); body.ry = lerp(p.body.ry, idle.body.ry, sB);
    body.rx = lerp(p.body.rx, idle.body.rx, sB); body.spin = lerp(p.body.spin, idle.body.spin, sB); body.zoom = lerp(p.body.zoom, idle.body.zoom, sB);
    body.b = mixJoint(p.body.b, idle.body.b, sB); body.b[1] += WAKE.lift(time);
    body.L = mixJoint(p.body.L, idle.body.L, WAKE.front(time)); body.R = mixJoint(p.body.R, idle.body.R, WAKE.front(time));
    body.HL = mixJoint(p.body.HL, idle.body.HL, WAKE.hind(time)); body.HR = mixJoint(p.body.HR, idle.body.HR, WAKE.hind(time));
    body.T = mixJoint(p.body.T, idle.body.T, WAKE.tail(time));
    const face = lerpFace(p.face, idle.face, WAKE.face(time));
    const lk = WAKE.look(time);
    face.gx = lerp(face.gx, look.gx, lk); face.gy = lerp(face.gy, look.gy, lk);
    face.wide = .3 * bell(time, .15, .35, .8); face.raise = .25 * bell(time, .12, .3, .6);
    // Eyes open almost at once; one quick blink (gallery 60 / 100 ms) before handing back.
    const open = WAKE.open(time), blink = time < .95 ? 0 : time < 1.01 ? (time - .95) / .06 : time < 1.11 ? 1 - (time - 1.01) / .1 : 0;
    const lid = (v: number) => clamp01(v * (1 - open) + blink * open);
    const d = p.drowsy;
    const drowsy: DrowsyFace = {
      lidL: lid(d.lidL), lidR: lid(d.lidR), yawn: lerp(d.yawn, 0, open), shy: lerp(d.shy, 0, open),
      sleep: lerp(d.sleep, 0, smoothstep(time / .45)), pitch: lerp(d.pitch, 0, smoothstep(time / .6)),
    };
    const shadow = { x: lerp(p.shadow.x, 0, sB), scale: lerp(p.shadow.scale, 1, sB), opacity: lerp(p.shadow.opacity, 1, sB) };
    // The z fade out within a quarter of a second of the click.
    const snore: Snore = { on: p.snore.on * (1 - smoothstep(time / .25)), z: p.snore.z };
    if (time >= WAKE_SECONDS) return { body: idle.body, face: idle.face, drowsy: openDrowsyFace(), shadow: { x: 0, scale: 1, opacity: 1 }, snore: noSnore() };
    return { body, face, drowsy, shadow, snore };
  }

  return {
    get active() { return active; },
    get phase() { return phase; },
    /** Begin falling asleep from the pose on screen (or start asleep). */
    start(opts: SleepStart = {}) {
      active = true; t = 0; events = []; marks = new Set(); wakeFrom = null; flickT = -1; snoreOn = 0; snoreArmed = false;
      from = opts.from ?? readyPose(1);
      flickAt = pick(40, 90);
      if (opts.asleep) {
        phase = 'asleep'; asleepAt = 0; breathOn = true;
        Object.assign(cycle, { t: rand() * 4.8, period: 4.8, amp: reduced ? .7 : 1, sigh: false });
      } else {
        phase = 'falling'; breathOn = false;
        Object.assign(cycle, { t: 0, period: 6.2, amp: reduced ? 1.15 : 1.5, sigh: true });
      }
      emit({ type: 'start', asleep: !!opts.asleep });
    },
    /** A click / press on the pet. Returns false when there is nothing to wake (already waking, awake or stopped). */
    wake(at?: { gx: number; gy: number }) {
      if (!active || (phase !== 'falling' && phase !== 'asleep')) return false;
      emit({ type: 'wake', from: phase });
      wakeFrom = last ?? (phase === 'asleep' ? asleepPose(0, 0, noSnore()) : { ...from, snore: noSnore() });
      look = at ? { gx: clamp(at.gx, -9, 9), gy: clamp(at.gy, -7, 7) } : { gx: 0, gy: -2 };
      phase = 'waking'; t = 0;
      return true;
    },
    /** Host takes the art back (e.g. a drag starts). */
    stop() { if (active) { active = false; phase = 'off'; emit({ type: 'stop' }); } },
    step(dtMs: number): SleepFrame {
      const dt = clamp(dtMs, 0, 100) / 1000;
      if (!active) {
        const out: SleepFrame = { active: false, phase, time: t, asleepFor: 0, pose: last ?? asleepPose(0, 0, noSnore()), events };
        events = [];
        return out;
      }
      t += dt;
      let pose: SleepPose;
      if (phase === 'falling') {
        // The breathing cycle starts as the body lands (first cycle = one deep breath) and never resets after.
        if (!breathOn && t >= 5.6) breathOn = true;
        const u = breathAt(dt);
        if (!marks.has('lie') && t >= FALL_MARKS.lieDown) { marks.add('lie'); emit({ type: 'lie-down' }); }
        if (!marks.has('eyes') && t >= FALL_MARKS.eyesClosed) { marks.add('eyes'); emit({ type: 'eyes-closed' }); }
        pose = fallingPose(Math.min(t, FALL_SECONDS), u);
        if (t >= FALL_SECONDS) { phase = 'asleep'; asleepAt = t; emit({ type: 'asleep' }); }
      } else if (phase === 'asleep') {
        const u = breathAt(dt);
        if (snoreArmed) snoreOn = Math.min(1, snoreOn + dt);
        pose = asleepPose(u, flickAmount(dt), { on: snoreOn, z: snoreAt(cycle.t / cycle.period, reduced) });
      } else {
        pose = wakingPose(Math.min(t, WAKE_SECONDS));
        if (t >= WAKE_SECONDS) { active = false; phase = 'off'; emit({ type: 'awake', pose }); }
      }
      last = pose;
      const out: SleepFrame = { active, phase, time: t, asleepFor: phase === 'asleep' ? t - asleepAt : 0, pose, events };
      events = [];
      return out;
    },
  };
}
export type SleepController = ReturnType<typeof createSleepController>;
