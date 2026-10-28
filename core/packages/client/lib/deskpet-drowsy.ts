// Root Beast "growing drowsiness" idle (困倦待机) runtime.
//
// One static rig (rootbeast-drowsy-rig.svg = the mouse-hunt rig plus hidden
// eyelid / yawn / face-pitch layers) is posed every frame. Body articulation,
// skin strips, paw attachment and eye clearance come from deskpet-mouse-hunt.ts
// (ported from scripts/deskpet-rootbeast/character.mjs), so every frame is the
// existing character, never a redraw. Stances and expression shapes reuse the
// gallery numbers: rest/sit poses, the dozing nod (24-dozing), the yawn mouth
// and closed-eye arc, and reachLeft/reachRight for the stretch.
//
// Layers: scheduler (three stages that deepen continuously, short clips with
// cooldowns and quiet pauses, finale) → channels (baseline from sleepiness +
// clips + blinks + breathing + gaze drift + perk overlay) → compose (channels →
// body/face pose) → renderer (attribute writes on the rig).
// Nothing here listens to the DOM or owns timers: the host calls step(dtMs),
// forwards interactions, and acts on the events.

import { BONES, createHuntRenderer, idlePoseAt, mulberry32, neutralFace, resolveBody, restPose, view } from './deskpet-mouse-hunt';
import type { BodyPose, FacePose, HuntPose, Joint } from './deskpet-mouse-hunt';

export const DROWSY_RIG_VERSION = '1';

// ------------------------------------------------------------------ pose types
export interface DrowsyFace {
  /** Eyelid closure per eye, 0 open … 1 closed (the gallery closed-eye arc). */
  lidL: number; lidR: number;
  /** Yawn mouth opening 0 … 1 (character.mjs mouths.yawn). */
  yawn: number;
  /** Mouth line weights toward the gallery "sleep" and "shy" shapes. */
  sleep: number; shy: number;
  /** Eyes + mouth shift down inside the shell while the head drops (rig units / 7). */
  pitch: number;
}
export interface DrowsyPose extends HuntPose { drowsy: DrowsyFace }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const fx = (v: number) => Math.round(v * 10000) / 10000;
const mixJoint = (a: Joint, b: Joint, t: number): Joint => a.map((v, i) => v + (b[i] - v) * t) as Joint;
const cloneBody = (p: BodyPose): BodyPose => ({
  ...p, b: [...p.b] as Joint, L: [...p.L] as Joint, R: [...p.R] as Joint,
  HL: [...p.HL] as Joint, HR: [...p.HR] as Joint, T: [...p.T] as Joint,
});
const lerpBody = (a: BodyPose, b: BodyPose, t: number): BodyPose => ({
  yaw: lerp(a.yaw, b.yaw, t), b: mixJoint(a.b, b.b, t), L: mixJoint(a.L, b.L, t), R: mixJoint(a.R, b.R, t),
  HL: mixJoint(a.HL, b.HL, t), HR: mixJoint(a.HR, b.HR, t), T: mixJoint(a.T, b.T, t),
  rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), spin: lerp(a.spin, b.spin, t), zoom: lerp(a.zoom, b.zoom, t),
});
const lerpFace = (a: FacePose, b: FacePose, t: number): FacePose => {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof FacePose)[]) out[k] = lerp(a[k], b[k], t);
  return out;
};
const lerpDrowsy = (a: DrowsyFace, b: DrowsyFace, t: number): DrowsyFace => {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof DrowsyFace)[]) out[k] = lerp(a[k], b[k], t);
  return out;
};
export const openDrowsyFace = (): DrowsyFace => ({ lidL: 0, lidR: 0, yawn: 0, sleep: 0, shy: 0, pitch: 0 });
export function lerpDrowsyPose(a: DrowsyPose, b: DrowsyPose, t: number): DrowsyPose {
  return {
    body: lerpBody(a.body, b.body, t), face: lerpFace(a.face, b.face, t), drowsy: lerpDrowsy(a.drowsy, b.drowsy, t),
    shadow: { x: lerp(a.shadow.x, b.shadow.x, t), scale: lerp(a.shadow.scale, b.shadow.scale, t), opacity: lerp(a.shadow.opacity, b.shadow.opacity, t) },
  };
}

// ------------------------------------------------------------------ renderer
// Closed eye of the gallery (character.mjs sleep/yawn eye): M-26 -4 Q0 24 26 -4,
// i.e. the parabola y = m - k (x/26)^2 with m 10, k 14. The upper lid edge uses
// the same family, descending from above the white (m -40) to that arc. A heavy
// lid stays a gentle arch / flat line (k -5 … 0); a dipping edge reads as a
// scowl, so it only bends into the closed arc over the last 40 %. The lower lid
// rises in the last quarter and, when shut, ends 1.5 units above the arc: two
// fills that only touch leave an antialiased hairline of eye white beyond the
// lash ends, so they overlap instead (the lash still lies on the gallery arc).
const LID_OVERLAP = 1.5;
export function lidGeometry(c: number) {
  const v = clamp01(c), bend = smoothstep((v - .6) / .4);
  const m = -40 + 50 * v ** .8, k = lerp(-5, 14, bend);
  const mL = v < .75 ? 50 : lerp(50, 10 - LID_OVERLAP, smoothstep((v - .75) / .25));
  const edge = (mm: number, kk: number) => { const y = mm - kk * (42 / 26) ** 2; return { y, cy: 2 * mm - y }; };
  const up = edge(m, k), low = edge(mL, 14);
  return {
    up: `M-42 -60H42V${fx(up.y)}Q0 ${fx(up.cy)} -42 ${fx(up.y)}Z`,
    low: `M-42 60H42V${fx(low.y)}Q0 ${fx(low.cy)} -42 ${fx(low.y)}Z`,
    lash: `M-26 ${fx(m - k)}Q0 ${fx(m + k)} 26 ${fx(m - k)}`,
    lashOpacity: smoothstep(v / .15), lashWidth: lerp(6, 8, bend),
  };
}
// Mouth line shapes as M x1 y1 Q cx cy x2 y2 + stroke width (character.mjs mouths; pout from the hunt rig).
const MOUTH = {
  neutral: [-17, 0, 0, 11, 17, 0, 7],
  sleep: [-12, 3, 0, 9, 12, 3, 6],
  shy: [-15, 1, 0, 17, 15, 1, 7],
  happy: [-24, -3, 0, 25, 24, -3, 9],
  pout: [-13, 8, 0, 1, 13, 8, 7],
};
const mixArr = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const quad = (p: number[]) => `M${fx(p[0])} ${fx(p[1])}Q${fx(p[2])} ${fx(p[3])} ${fx(p[4])} ${fx(p[5])}`;

export function createDrowsyRenderer(svg: SVGSVGElement) {
  if (svg.getAttribute('data-rootbeast-drowsy') !== 'rig' || svg.getAttribute('data-drowsy-version') !== DROWSY_RIG_VERSION) {
    throw Error('drowsy rig missing or wrong version');
  }
  const hunt = createHuntRenderer(svg);
  const part = (name: string) => {
    const el = svg.querySelector<SVGGraphicsElement>(`[data-drowsy="${name}"]`);
    if (!el) throw Error(`drowsy rig part missing: ${name}`);
    return el;
  };
  const els = {
    lids: [part('lids-l'), part('lids-r')], up: [part('lid-up-l'), part('lid-up-r')],
    low: [part('lid-low-l'), part('lid-low-r')], lash: [part('lash-l'), part('lash-r')],
    pitch: part('face-pitch'), mouth: part('mouth'), yawn: part('yawn'),
  };
  const cache = new Map<string, string>();
  const attr = (el: Element, id: string, name: string, value: string) => {
    if (cache.get(id) === value) return;
    cache.set(id, value);
    el.setAttribute(name, value);
  };
  const render = (pose: DrowsyPose) => {
    hunt.render(pose);
    const { face, drowsy } = pose;
    // Happy ^ eyes (perk response) replace the open eye; lids give way first.
    const lidScale = 1 - smoothstep(face.smile / .6);
    [drowsy.lidL, drowsy.lidR].forEach((value, i) => {
      const c = clamp01(value) * lidScale;
      const g = lidGeometry(c);
      attr(els.lids[i], 'lids' + i, 'opacity', c > .002 ? '1' : '0');
      attr(els.up[i], 'up' + i, 'd', g.up);
      attr(els.low[i], 'low' + i, 'd', g.low);
      attr(els.lash[i], 'lash' + i, 'd', g.lash);
      attr(els.lash[i], 'lashO' + i, 'opacity', fx(c > .002 ? g.lashOpacity : 0).toString());
      attr(els.lash[i], 'lashW' + i, 'stroke-width', fx(g.lashWidth).toString());
    });
    attr(els.pitch, 'pitch', 'transform', `translate(0 ${fx(7 * clamp(drowsy.pitch, -.6, 1.4))})`);
    let shape = MOUTH.neutral.slice();
    const weights: [keyof typeof MOUTH, number][] = [['sleep', drowsy.sleep], ['shy', drowsy.shy], ['happy', face.happy], ['pout', face.pout]];
    for (const [name, w] of weights) if (w > 0) shape = mixArr(shape, MOUTH[name], clamp01(w));
    const yawn = clamp01(drowsy.yawn);
    attr(els.mouth, 'mouthD', 'd', quad(shape));
    attr(els.mouth, 'mouthW', 'stroke-width', fx(shape[6]).toString());
    attr(els.mouth, 'mouthO', 'opacity', fx(clamp01(1 - 4 * Math.max(yawn, face.open, face.o))).toString());
    attr(els.yawn, 'yawnT', 'transform', `scale(${fx(.5 + .5 * yawn)} ${fx(Math.max(.001, yawn))})`);
    attr(els.yawn, 'yawnO', 'opacity', yawn > .02 ? '1' : '0');
  };
  return { svg, render };
}

// ------------------------------------------------------------------ stances
// rest = 01-idle first frame (character.mjs rest); sit = character.mjs sit, the
// stance of the gallery yawning / dozing / waking scenes.
const SIT_SOURCE: Partial<BodyPose> = {
  yaw: 12, b: [0, 19, -2, .94, .97], L: [-205, -25, 0, .93, .94], R: [180, -38, 20, .93, .94],
  HL: [-167, -17, 57, 1.1, .8], HR: [140, -13, -57, 1.1, .8], T: [153, -343, 23, .9, .9],
};
// choreography.mjs reachLeft / reachRight: celebratory stretch beside the lower shell.
const REACH_L: Joint = [-210, -67, 75, .95, 1], REACH_R: Joint = [180, -67, -75, .95, 1];
export const REST_STANCE = (): BodyPose => resolveBody(restPose());
export const SIT_STANCE = (): BodyPose => resolveBody({ ...restPose(), ...SIT_SOURCE } as BodyPose);
const REST = REST_STANCE(), SIT = SIT_STANCE();

// Paw on the eye while rubbing (joint in rig units; oscillation added on top).
// Front paws normally keep clear of the eyes (character.mjs); a rubbing paw is
// the one deliberate exception and only reaches the lower half of that eye.
export const RUB = {
  L: [-250, -74, 140, .9, .9] as Joint,
  R: [96, -92, -150, .9, .9] as Joint,
};

// Attachment clamp of resolveBody without the eye clearance (used only for a rubbing paw).
const rotate = (x: number, y: number, angle: number): [number, number] => {
  const r = angle * Math.PI / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
function attachOnly(state: BodyPose, joint: Joint, front: boolean): Joint {
  const v = view(state.yaw, state.sideMin);
  const [bx, by, angle, sx, sy] = state.b;
  const [px, py, rotation, scaleX, rawScaleY] = joint;
  const scaleY = Math.min(rawScaleY, 1);
  const wrist = rotate(front ? 28 * scaleX : 0, front ? 9 * scaleY : 0, rotation);
  const local = rotate(px + wrist[0] - bx, py + wrist[1] + 190 - by, -angle);
  const localX = clamp(local[0] / sx, -v.width / 2 + 30, v.width / 2 - 30);
  const localY = clamp(local[1] / sy, 100, 155);
  const anchor = rotate(localX * sx, localY * sy, angle);
  return [anchor[0] + bx - wrist[0], anchor[1] + by - 190 - wrist[1], rotation, scaleX, scaleY];
}

// ------------------------------------------------------------------ channels
export const CHANNELS = [
  'sit', 'sitR', 'step', 'nod', 'lift', 'sway', 'sink', 'tail', 'tailWag', 'reach', 'rubL', 'rubR', 'rubPhase',
  'droop', 'closeL', 'closeR', 'alert', 'gx', 'gy', 'pupil',
  'yawn', 'sleepMouth', 'shy', 'happy', 'smile', 'cheeks', 'wide', 'raise', 'o', 'pout', 'pitch', 'breath',
] as const;
export type Channel = typeof CHANNELS[number];
export type Channels = Record<Channel, number>;
export const zeroChannels = (): Channels => Object.fromEntries(CHANNELS.map(c => [c, 0])) as Channels;
/** Combined by maximum instead of sum. */
const MAX_CHANNELS = new Set<Channel>(['closeL', 'closeR', 'alert']);
/** Absolute values a clip may set (posture, oscillator phase). */
const SET_CHANNELS = new Set<Channel>(['sit', 'sitR', 'rubPhase']);

// Clockwise shell tilt of the dozing scene (b angle +7 … +12 while sinking).
const NOD_ANGLE = 9;
export interface ComposeOptions { reducedMotion?: boolean }
/** Channels → full pose. Pure; also used by previews and checks. */
export function composePose(ch: Channels, opts: ComposeOptions = {}): DrowsyPose {
  const motion = opts.reducedMotion ? .25 : 1;
  const body = lerpBody(REST, SIT, clamp01(ch.sit));
  body.R = mixJoint(REST.R, SIT.R, smoothstep(ch.sitR));
  // Stepping paw (sit down / stand up) lifts on a short arc.
  body.R[1] -= 34 * ch.step; body.R[2] -= 16 * ch.step;
  const b = body.b;
  const nod = ch.nod * motion, lift = ch.lift * motion, breath = ch.breath;
  // Dozing nod (24-dozing: by +24, tilt, squash at full depth); lift = stretch tall.
  b[1] += 24 * nod + ch.sink * motion - 16 * lift + 1.6 * breath;
  b[2] += NOD_ANGLE * nod + ch.sway * motion;
  b[3] *= 1 + .012 * nod - .012 * lift;
  b[4] *= 1 - .055 * nod + .04 * lift + .008 * breath;
  const T = body.T;
  T[2] += 18 * ch.tail + ch.tailWag + 1.5 * breath; T[1] += 12 * ch.tail; T[3] *= 1 - .05 * ch.tail; T[4] *= 1 - .05 * ch.tail;
  const reach = clamp01(ch.reach) * motion;
  if (reach > 0) { body.L = mixJoint(body.L, REACH_L, reach); body.R = mixJoint(body.R, REACH_R, reach); }
  const rubs: ['L' | 'R', number][] = [['L', clamp01(ch.rubL) * motion], ['R', clamp01(ch.rubR) * motion]];
  const osc = (k: number): Joint => [5 * Math.sin(ch.rubPhase) * k, 4 * Math.cos(ch.rubPhase) * k, 5 * Math.sin(ch.rubPhase + .6) * k, 0, 0];
  for (const [bone, w] of rubs) if (w > 0) {
    const target = RUB[bone].map((v, i) => v + osc(smoothstep((w - .7) / .3))[i]) as Joint;
    body[bone] = mixJoint(body[bone], target, smoothstep(w));
  }
  const pre = cloneBody(body);
  resolveBody(body);
  // Feet that are not moving stay exactly where they stand: the shell's sink,
  // tilt and breathing must not drag a planted paw through the attachment
  // clamp (sliding feet). Stance and step positions come from resolved
  // stances already; only reaching / rubbing paws take the resolved pose.
  const moving = { L: Math.max(reach, rubs[0][1]), R: Math.max(reach, rubs[1][1]), HL: 0, HR: 0 };
  for (const bone of BONES) body[bone] = mixJoint(pre[bone], body[bone], smoothstep(moving[bone]));
  for (const [bone, w] of rubs) if (w > 0) {
    // Blend from the eye-cleared pose into the uncleared rub so the paw slides onto the eye, never pops.
    body[bone] = mixJoint(body[bone], attachOnly(pre, pre[bone], true), smoothstep((w - .25) / .5));
  }
  const face = neutralFace();
  face.gx = clamp(ch.gx, -9, 9); face.gy = clamp(ch.gy, -7, 7); face.pupil = 1 + ch.pupil;
  face.wide = clamp01(ch.wide); face.raise = clamp01(ch.raise); face.o = clamp01(ch.o);
  face.happy = clamp01(ch.happy); face.smile = clamp01(ch.smile); face.cheeks = clamp01(ch.cheeks); face.pout = clamp01(ch.pout);
  const lid = (close: number) => { const d = clamp01(ch.droop); return (d + (1 - d) * clamp01(close)) * (1 - clamp01(ch.alert)); };
  const drowsy: DrowsyFace = {
    lidL: lid(ch.closeL), lidR: lid(ch.closeR), yawn: clamp01(ch.yawn),
    sleep: clamp01(ch.sleepMouth), shy: clamp01(ch.shy), pitch: ch.pitch + .9 * nod,
  };
  return { body, face, drowsy, shadow: { x: 0, scale: 1 + .015 * nod, opacity: 1 } };
}

// ------------------------------------------------------------------ clips
// A clip is a short motion: keyed channel offsets that start and end at 0, so
// any order of clips meets the baseline at every seam. Interpolation is
// monotone cubic (no overshoot, zero slope at the ends).
type Key = readonly [number, number];
class Track {
  private xs: number[]; private ys: number[]; private ms: number[];
  constructor(keys: readonly Key[]) {
    const k = [...keys].sort((a, b) => a[0] - b[0]);
    this.xs = k.map(p => p[0]); this.ys = k.map(p => p[1]);
    const n = k.length, d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((this.ys[i + 1] - this.ys[i]) / Math.max(1e-6, this.xs[i + 1] - this.xs[i]));
    this.ms = this.xs.map((_, i) => {
      if (i === 0 || i === n - 1) return 0;
      if (d[i - 1] * d[i] <= 0) return 0;
      const w1 = 2 * (this.xs[i + 1] - this.xs[i]) + (this.xs[i] - this.xs[i - 1]);
      const w2 = (this.xs[i + 1] - this.xs[i]) + 2 * (this.xs[i] - this.xs[i - 1]);
      return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    });
  }
  at(t: number) {
    const { xs, ys, ms } = this, n = xs.length;
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (xs[i + 1] < t) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * ms[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * ms[i + 1];
  }
}
type TrackSpec = Partial<Record<Channel | 'close', readonly Key[]>>;
export interface Clip {
  name: string; dur: number; t: number;
  tracks: [Channel | 'close', Track][];
  /** Extra per-frame writes (oscillators, absolute posture). */
  extra?: (t: number, ch: Channels) => void;
  /** Posture state after the clip (sit transitions). */
  posture?: number;
  /** Posture motion cannot be interrupted midway; faces still respond. */
  atomic?: boolean;
  /** Blinks are suppressed (the clip drives the lids itself). */
  noBlink?: boolean;
  /** Fired when the clip completes (finale step markers). */
  marker?: 'ready';
}
function clip(name: string, dur: number, spec: TrackSpec, more: Partial<Clip> = {}): Clip {
  return { name, dur, t: 0, tracks: Object.entries(spec).map(([c, keys]) => [c as Channel | 'close', new Track(keys!)]), ...more };
}
function applyClip(c: Clip, t: number, w: number, ch: Channels, bodyW = w) {
  if (w <= 0 && bodyW <= 0) return;
  for (const [name, track] of c.tracks) {
    const v = track.at(t);
    const write = (k: Channel) => {
      const weight = BODY_CHANNELS.has(k) ? bodyW : w;
      if (MAX_CHANNELS.has(k)) ch[k] = Math.max(ch[k], v * weight);
      else ch[k] += v * weight;
    };
    if (name === 'close') { write('closeL'); write('closeR'); } else write(name);
  }
  if (c.extra) {
    const tmp = zeroChannels();
    c.extra(t, tmp);
    for (const k of CHANNELS) {
      if (tmp[k] === 0 && !SET_CHANNELS.has(k)) continue;
      if (SET_CHANNELS.has(k)) { if (k === 'rubPhase') ch[k] = tmp[k]; continue; }
      const weight = BODY_CHANNELS.has(k) ? bodyW : w;
      if (MAX_CHANNELS.has(k)) ch[k] = Math.max(ch[k], tmp[k] * weight); else ch[k] += tmp[k] * weight;
    }
  }
}
const BODY_CHANNELS = new Set<Channel>(['nod', 'lift', 'sway', 'sink', 'tail', 'tailWag', 'reach', 'rubL', 'rubR']);

type Rand = () => number;
const pick = (r: Rand, a: number, b: number) => a + (b - a) * r();
const sign = (r: Rand) => (r() < .5 ? -1 : 1);

// Clip factories. `L` = sleepiness 0 … 1 shapes depth and speed.
export const CLIPS = {
  pause(r: Rand, L: number, dur = pick(r, 3.5, 8) * (1 + .5 * L)): Clip {
    // Quiet hold: breathing, blinks and gaze drift only, sometimes one tiny shift of weight.
    const v = r(), spec: TrackSpec = {};
    if (v < .3) spec.sway = [[0, 0], [dur * .5, sign(r) * pick(r, .4, .9)], [dur, 0]];
    else if (v < .5) spec.tailWag = [[0, 0], [dur * .35, pick(r, 3, 6)], [dur * .55, 0], [dur, 0]];
    else if (v < .62 && L > .3) spec.nod = [[0, 0], [dur * .55, pick(r, .06, .14)], [dur, 0]];
    return clip('pause', dur, spec);
  },
  look(r: Rand, L: number): Clip {
    const s = sign(r), a = s * pick(r, 5, 8), dur = pick(r, 3.2, 5) * (1 + .3 * L), back = r() < .5;
    return clip('look', dur, {
      gx: [[0, 0], [.35, a], [dur * .45, a], ...(back ? [[dur * .55, -a * .6], [dur * .8, -a * .6]] as Key[] : []), [dur, 0]],
      gy: [[0, 0], [.35, -2], [dur - .5, -1], [dur, 0]],
      droop: [[0, 0], [.4, -.08 * (1 - L)], [dur - .6, -.05], [dur, 0]],
      sway: [[0, 0], [dur * .4, s * -.8], [dur, 0]],
    });
  },
  slowBlink(r: Rand, L: number): Clip {
    const c = .2 + .12 * L, o = .38 + .3 * L, h = pick(r, .06, .2), gap = pick(r, .25, .5);
    const t1 = c + h + o + gap, dur = t1 + c + h + o;
    return clip('slow-blink', dur, {
      close: [[0, 0], [c, 1], [c + h, 1], [c + h + o, 0], [t1, 0], [t1 + c, 1], [t1 + c + h, 1], [dur, 0]],
      nod: [[0, 0], [dur * .5, .05], [dur, 0]],
    }, { noBlink: true });
  },
  heavyBlink(r: Rand, L: number): Clip {
    const c = .3 + .2 * L, hold = pick(r, .6, 1.4) * (.6 + L), o = .55 + .5 * L, dur = c + hold + o + .3;
    return clip('heavy-blink', dur, {
      close: [[0, 0], [c, 1], [c + hold, 1], [c + hold + o, 0], [dur, 0]],
      nod: [[0, 0], [c + hold * .8, pick(r, .1, .22)], [c + hold + o, .04], [dur, 0]],
      droop: [[0, 0], [c + hold + o, .06], [dur, 0]],
    }, { noBlink: true });
  },
  yawn(r: Rand, L: number, big = false): Clip {
    const s = big ? 1 : pick(r, .7, .9), dur = (big ? 4.8 : pick(r, 3.4, 4)) * (1 + .15 * L);
    const k = dur / 4;
    return clip(big ? 'big-yawn' : 'yawn', dur, {
      close: [[0, 0], [.45 * k, .25], [.9 * k, 1], [2.55 * k, 1], [3.15 * k, .35], [dur, 0]],
      yawn: [[0, 0], [.5 * k, .12], [1.0 * k, .72 * s], [1.45 * k, .95 * s], [2.2 * k, s], [2.6 * k, .45 * s], [2.9 * k, 0], [dur, 0]],
      lift: [[0, 0], [.6 * k, .2], [1.25 * k, .6 * s], [2.2 * k, .7 * s], [2.85 * k, .05], [dur, 0]],
      nod: [[0, 0], [1.2 * k, -.15], [2.2 * k, -.2], [2.95 * k, .12], [dur, 0]],
      pitch: [[0, 0], [1.4 * k, -.35], [2.3 * k, -.35], [3 * k, 0], [dur, 0]],
      tail: [[0, 0], [1.4 * k, -.35], [2.4 * k, -.35], [3.1 * k, .1], [dur, 0]],
      sleepMouth: [[0, 0], [2.75 * k, 0], [3.05 * k, .5], [3.4 * k, .2], [dur, 0]],
      ...(big ? { reach: [[0, 0], [1.0 * k, .55], [2.2 * k, .8], [2.9 * k, .1], [dur, 0]] as Key[] } : {}),
    }, { noBlink: true });
  },
  nod(r: Rand, L: number): Clip {
    const depth = pick(r, .45, .8) * (.8 + .4 * L), down = pick(r, 1.6, 2.8) * (1 + .3 * L);
    const variant = r() < .62 ? 'snap' : 'slow', shake = variant === 'snap' && r() < .3;
    const tc = down + (variant === 'snap' ? .28 : 1.2), dur = tc + pick(r, 1.3, 2) + (shake ? .7 : 0);
    const spec: TrackSpec = {
      nod: variant === 'snap'
        ? [[0, 0], [down * .55, depth * .45], [down, depth], [down + .28, -.16], [down + .8, -.05], [dur, 0]]
        : [[0, 0], [down * .6, depth * .55], [down, depth], [tc, .12], [dur, 0]],
      close: variant === 'snap'
        ? [[0, 0], [down * .7, .85], [down, .95], [down + .2, 0], [dur, 0]]
        : [[0, 0], [down * .7, .8], [down + .3, .9], [tc + .4, .2], [dur, 0]],
      sink: [[0, 0], [down, 2], [dur, 0]],
      tail: [[0, 0], [down, .3], [tc, 0], [dur, 0]],
    };
    if (variant === 'snap') {
      spec.alert = [[0, 0], [down, 0], [down + .2, .6], [down + .9, .45], [dur, 0]];
      spec.raise = [[0, 0], [down, 0], [down + .18, .45], [down + .6, 0], [dur, 0]];
      spec.gy = [[0, 0], [down, 3], [down + .25, -2], [dur, 0]];
    }
    if (shake) {
      const t0 = tc + .25;
      spec.sway = [[0, 0], [t0, 0], [t0 + .14, 2.6], [t0 + .3, -2.6], [t0 + .46, 1.6], [t0 + .62, 0], [dur, 0]];
    }
    return clip(variant === 'snap' ? 'nod-catch' : 'nod-slow', dur, spec, { noBlink: true });
  },
  rub(r: Rand, L: number, side: 'L' | 'R' = r() < .65 ? 'L' : 'R'): Clip {
    // Sleepier = slower reach and a longer rub.
    const up = .65 + .15 * L, rubT = pick(r, 1.3, 2) * (.85 + .3 * L), dur = up + rubT + .9 + .35, f = pick(r, 2.1, 2.7), sgn = side === 'L' ? -1 : 1;
    const own = side === 'L' ? 'closeL' : 'closeR', other = side === 'L' ? 'closeR' : 'closeL';
    return clip('rub-eyes-' + side, dur, {
      [side === 'L' ? 'rubL' : 'rubR']: [[0, 0], [up, 1], [up + rubT, 1], [up + rubT + .8, 0], [dur, 0]],
      [own]: [[0, 0], [up * .7, 1], [up + rubT + .3, 1], [up + rubT + .9, 0], [dur, 0]],
      [other]: [[0, 0], [up, .45], [up + rubT, .5], [dur, 0]],
      sway: [[0, 0], [up, sgn * 1.6], [up + rubT, sgn * 1.2], [dur, 0]],
      nod: [[0, 0], [up, .12], [up + rubT, .16], [dur, 0]],
      pout: [[0, 0], [up, .45], [up + rubT, .45], [up + rubT + .5, 0], [dur, 0]],
    }, { noBlink: true, extra: (t, ch) => { ch.rubPhase = 2 * Math.PI * f * Math.max(0, t - up * .8); } });
  },
  sway(r: Rand, L: number): Clip {
    const a = sign(r) * pick(r, 1.8, 3), dur = pick(r, 4.5, 7);
    return clip('sway', dur, {
      sway: [[0, 0], [dur * .3, a], [dur * .65, -a * .55], [dur, 0]],
      nod: [[0, 0], [dur * .45, .18 + .1 * L], [dur, 0]],
      droop: [[0, 0], [dur * .45, .1], [dur, 0]],
      tailWag: [[0, 0], [dur * .3, -a], [dur * .65, a * .5], [dur, 0]],
    });
  },
  shakeOff(r: Rand): Clip {
    const dur = pick(r, 1.9, 2.4), s = sign(r);
    return clip('shake-off', dur, {
      sway: [[0, 0], [.18, s * 3.2], [.36, -s * 3.2], [.54, s * 2], [.72, -s * 1], [.95, 0], [dur, 0]],
      alert: [[0, 0], [.25, .65], [1.1, .5], [dur, 0]],
      wide: [[0, 0], [.3, .25], [.9, 0], [dur, 0]],
      close: [[0, .0], [.05, .4], [.25, 0], [dur, 0]],
      nod: [[0, 0], [.3, -.12], [1.2, -.05], [dur, 0]],
    }, { noBlink: true });
  },
  doze(r: Rand, L: number): Clip {
    const hold = pick(r, 3, 7) * (.7 + .5 * L), sinkT = pick(r, 2.2, 3.6), depth = pick(r, .7, 1);
    const v = r(), variant = v < .45 ? 'jolt' : v < .8 ? 'slow' : 'deep';
    const J = sinkT + hold, spec: TrackSpec = {
      close: [[0, 0], [1.1, 1], [J, 1]],
      nod: [[0, 0], [sinkT * .4, depth * .3], [sinkT, depth * .8], [J, depth]],
      sink: [[0, 0], [J, 3]],
      tail: [[0, 0], [J, .35]],
      sleepMouth: [[0, 0], [sinkT, .25], [J, .3]],
    };
    let dur: number;
    const push = (k: Channel | 'close', keys: Key[]) => { spec[k] = [...(spec[k] ?? [[0, 0]]), ...keys]; };
    if (variant === 'jolt') {
      // Short burst of wakefulness, then the heaviness creeps back.
      dur = J + pick(r, 3.2, 4.2);
      const a = sign(r) * pick(r, 4, 7);
      push('nod', [[J + .22, -.25], [J + 1.2, -.12], [J + 2.4, .25], [dur, 0]]);
      push('close', [[J + .18, 0], [J + 1.4, 0], [J + 2.6, .45], [dur, 0]]);
      push('sink', [[J + .3, -2], [dur, 0]]);
      push('tail', [[J + .3, -.2], [dur, 0]]);
      push('sleepMouth', [[J + .2, 0], [dur, 0]]);
      spec.alert = [[0, 0], [J, 0], [J + .16, .75], [J + 1.1, .6], [J + 2.4, .1], [dur, 0]];
      spec.raise = [[0, 0], [J, 0], [J + .14, .55], [J + .55, 0], [dur, 0]];
      spec.gx = [[0, 0], [J + .3, 0], [J + .42, a], [J + .9, a], [J + 1.05, -a * .7], [J + 1.5, -a * .7], [J + 2.2, 0], [dur, 0]];
      spec.gy = [[0, 0], [J, 2], [J + .3, -2], [J + 2, 0], [dur, 0]];
    } else if (variant === 'slow') {
      dur = J + pick(r, 2.2, 3);
      push('nod', [[J + 1.8, .1], [dur, 0]]);
      push('close', [[J + .4, 1], [J + 1.8, .15], [dur, 0]]);
      push('sink', [[dur, 0]]); push('tail', [[dur, 0]]); push('sleepMouth', [[dur, 0]]);
    } else {
      // Sinks a little deeper, a slow breath, then lifts barely enough to settle.
      dur = J + pick(r, 2.6, 3.4);
      push('nod', [[J + 1, Math.min(1.15, depth + .12)], [dur, 0]]);
      push('close', [[J + 1.6, 1], [dur, 0]]);
      push('sink', [[J + 1, 4], [dur, 0]]); push('tail', [[dur, 0]]); push('sleepMouth', [[J + 1, .35], [dur, 0]]);
    }
    return clip('doze-' + variant, dur, spec, { noBlink: true });
  },
  sitDown(): Clip {
    const dur = 2.6;
    return clip('sit-down', dur, {
      step: [[0, 0], [.55, 0], [.85, 1], [1.35, .9], [1.7, 0], [dur, 0]],
      sink: [[0, 0], [.4, -2], [1.4, 7], [1.95, 1.5], [dur, 0]],
      nod: [[0, 0], [1.2, .12], [dur, 0]],
      tail: [[0, 0], [1.3, -.25], [2.1, .1], [dur, 0]],
      close: [[0, 0], [1.6, 0], [1.8, 1], [1.95, 1], [2.3, 0], [dur, 0]],
    }, {
      atomic: true, posture: 1, noBlink: true,
      extra: (t, ch) => { ch.sit = smoothstep((t - .3) / 1.9); ch.sitR = clamp01((t - .55) / 1.1); },
    });
  },
  standUp(): Clip {
    const dur = 2.5;
    return clip('stand-up', dur, {
      step: [[0, 0], [.6, 0], [.9, 1], [1.35, .9], [1.7, 0], [dur, 0]],
      lift: [[0, 0], [.5, .15], [1.0, .45], [1.7, .2], [dur, 0]],
      sink: [[0, 0], [.35, 4], [.7, 0], [dur, 0]],
      nod: [[0, 0], [.4, .15], [1.4, -.05], [dur, 0]],
      tail: [[0, 0], [1.1, -.3], [dur, 0]],
    }, {
      atomic: true, posture: 0, noBlink: true,
      extra: (t, ch) => { ch.sit = 1 - smoothstep((t - .35) / 1.8); ch.sitR = 1 - clamp01((t - .6) / 1.1); },
    });
  },
  /** Finale: look toward the bed and hold; completes with the ready marker. */
  lookToBed(r: Rand, side: number): Clip {
    const dur = pick(r, 2.6, 3.2);
    return clip('look-to-bed', dur, {
      sway: [[0, 0], [1.4, side * 1.2], [dur, 0]],
      nod: [[0, 0], [1.2, -.08], [dur, 0]],
      close: [[0, 0], [1.5, 0], [1.75, 1], [1.95, 1], [2.4, 0], [dur, 0]],
    }, { noBlink: true });
  },
  hold(dur: number, marker?: 'ready'): Clip { return clip('hold', dur, {}, marker ? { marker } : {}); },
  joltLite(r: Rand): Clip {
    const dur = pick(r, 1.8, 2.2);
    return clip('rouse', dur, {
      nod: [[0, 0], [.35, -.18], [1.2, -.08], [dur, 0]],
      alert: [[0, 0], [.3, .55], [1.1, .35], [dur, 0]],
      close: [[0, 0], [1.2, 0], [1.4, 1], [1.55, 1], [dur, 0]],
      gy: [[0, 0], [.4, -1], [dur, 0]],
    }, { noBlink: true });
  },
};

// ------------------------------------------------------------------ baseline
// Sleepiness 0 … 1 shapes the resting state continuously, so stage changes
// never jump: lids, gaze, head, tail, mouth, breathing and blink tempo.
const table = (keys: readonly Key[]) => { const t = new Track(keys); return (x: number) => t.at(x); };
const DROOP = table([[0, 0], [.08, .04], [.33, .2], [.45, .36], [.66, .5], [.82, .64], [1, .74]]);
const NOD_BASE = table([[0, 0], [.33, .03], [.66, .1], [1, .24]]);
const SLEEP_MOUTH = table([[0, 0], [.3, .12], [.5, .45], [.8, .85], [1, 1]]);
export interface Baseline { droop: number; nod: number; sink: number; tail: number; sleepMouth: number; gx: number; gy: number; pitch: number }
const BASE_KEYS: (keyof Baseline)[] = ['droop', 'nod', 'sink', 'tail', 'sleepMouth', 'gx', 'gy', 'pitch'];
/** Resting state at sleepiness `level`; `ready` = standing, decided to go to bed (heavy lids, looking toward the bed). */
export function baselineAt(level: number, ready = 0, bedSide = 1): Baseline {
  const L = clamp01(level);
  const s: Baseline = { droop: DROOP(L), nod: NOD_BASE(L), sink: 3 * L, tail: .65 * L, sleepMouth: SLEEP_MOUTH(L), gx: 0, gy: 4.5 * L, pitch: .3 * L };
  if (ready <= 0) return s;
  const r: Baseline = { droop: .56, nod: .04, sink: 1, tail: .5, sleepMouth: .8, gx: 3 * bedSide, gy: 3, pitch: .15 };
  const t = smoothstep(ready);
  for (const k of BASE_KEYS) s[k] = lerp(s[k], r[k], t);
  return s;
}

// ------------------------------------------------------------------ timing
export interface DrowsyTiming { stage1: number; stage2: number; stage3: number }
/** Stage lengths in seconds of uninterrupted drowsiness (interaction pauses the clock). */
export const DROWSY_PRESETS: Record<'short' | 'default' | 'long' | 'check', DrowsyTiming> = {
  short: { stage1: 100, stage2: 120, stage3: 100 },
  default: { stage1: 150, stage2: 180, stage3: 165 },
  long: { stage1: 215, stage2: 265, stage3: 250 },
  /** Compressed stages for inspection only (clips keep normal speed). */
  check: { stage1: 26, stage2: 32, stage3: 28 },
};
export const STAGE_LEVEL = [0, 1 / 3, 2 / 3, 1];
/** Fixed sleepiness of the single-stage loops (stage previews). */
export const LOOP_LEVEL = [0, .17, .5, .84];

// ------------------------------------------------------------------ controller
export type DrowsyStage = 1 | 2 | 3;
export type DrowsyPhase = 'off' | 'stage' | 'finale' | 'ready';
export type InteractKind = 'notice' | 'tap';
export type DrowsyEvent =
  | { type: 'start'; stage: DrowsyStage; level: number }
  | { type: 'stage'; stage: DrowsyStage }
  | { type: 'action'; name: string; duration: number }
  | { type: 'perk'; kind: InteractKind }
  | { type: 'calm' }
  | { type: 'finale'; short: boolean }
  | { type: 'finale-cancel' }
  | { type: 'ready-for-bed'; repeat: boolean; side: number; pose: DrowsyPose }
  | { type: 'stop' };
export interface DrowsyFrame {
  active: boolean; phase: DrowsyPhase; stage: DrowsyStage; level: number;
  action: string | null; perk: number; pose: DrowsyPose; events: DrowsyEvent[];
}
export interface DrowsyOptions {
  seed?: number;
  timing?: keyof typeof DROWSY_PRESETS | DrowsyTiming;
  /** Run one stage forever (stage previews): fixed sleepiness, no progression, no finale. */
  loopStage?: DrowsyStage;
  /** Direction of the bed for the closing look: -1 left, 1 right (screen). */
  bedSide?: number;
  /** Seconds after an interaction calms down before sleepiness may advance again. */
  grace?: number;
  reducedMotion?: boolean;
}
export interface StartOptions {
  /** Take over from 01-idle at this loop time (s) and current pupil offset (±9/±7). */
  idleTime?: number; gx?: number; gy?: number;
  /** Resume at a stage/level (e.g. after the host interrupted); posture restarts standing. */
  stage?: DrowsyStage; level?: number;
}
export type PerformName = 'slow-blink' | 'heavy-blink' | 'look' | 'yawn' | 'big-yawn' | 'sway' | 'nod' | 'rub-eyes-L' | 'rub-eyes-R' | 'shake-off' | 'doze';
// Clip families for cooldowns ("rub-eyes-L" and "rub-eyes-R" are one rub).
const family = (name: string) => name === 'big-yawn' ? 'yawn' : name.replace(/-(L|R|jolt|slow|deep|catch)$/, '');

export function createDrowsyController(options: DrowsyOptions = {}) {
  const rand = mulberry32(options.seed ?? 20261027);
  const timing: DrowsyTiming = typeof options.timing === 'object' ? options.timing : DROWSY_PRESETS[options.timing ?? 'default'];
  const durs = [timing.stage1, timing.stage2, timing.stage3];
  const loop = options.loopStage;
  const grace = options.grace ?? 6;
  const reduced = !!options.reducedMotion;
  let bedSide = options.bedSide === -1 ? -1 : 1;

  let active = false, phase: DrowsyPhase = 'off', stage: DrowsyStage = 1, stageTime = 0, posture = 0;
  let clock = 0, main: Clip | null = null, queue: Clip[] = [];
  let stood = false, readyMix = 0, needShort = false, finales = 0, readyCount = 0, pendingReady = false;
  const fading: { c: Clip; t: number; w: number }[] = [];
  const lastAt = new Map<string, number>();
  let lastName = '', lastWasPause = true;
  let events: DrowsyEvent[] = [];
  let intro: { from: DrowsyPose; t: number; dur: number } | null = null;
  // Perk = response to the player: fast attack, held while attention lasts, slow release.
  const perk = { p: 0, hold: 0, kind: 'notice' as InteractKind, t: 99, lookX: 0, lookY: -2, lookSet: false, calmAt: -1e9, on: false };
  let breathPhase = 0, blinkT = -1, nextBlink = 2, blinkLag = 0;
  let blinkShape = { c: .15, h: .05, o: .25 };
  const gaze = { x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 1, dur: .2, next: 2 };
  let lastPose: DrowsyPose | null = null;

  const level = () => loop ? LOOP_LEVEL[loop] : clamp01(STAGE_LEVEL[stage - 1] + clamp01(stageTime / durs[stage - 1]) / 3);
  const emit = (e: DrowsyEvent) => { events.push(e); };
  const since = (name: string) => clock - (lastAt.get(name) ?? -1e9);
  const quiet = () => !perk.on && perk.p === 0 && clock - perk.calmAt > grace;

  function startClip(c: Clip) {
    main = c; c.t = 0;
    lastWasPause = c.name === 'pause' || c.name === 'hold';
    if (!lastWasPause) { lastAt.set(family(c.name), clock); lastName = c.name; }
    if (c.name === 'look-to-bed') stood = true;
    emit({ type: 'action', name: c.name, duration: c.dur });
  }
  type Entry = [number, () => Clip];
  function choose(entries: Entry[]): Clip {
    const live = entries.filter(e => e[0] > 0);
    let x = rand() * live.reduce((a, e) => a + e[0], 0);
    for (const [w, make] of live) { x -= w; if (x <= 0) return make(); }
    return live[live.length - 1][1]();
  }
  const lookToward = (side: number) => {
    const dur = pick(rand, 3, 4.5), a = side * pick(rand, 2, 4);
    return clip('look', dur, { gx: [[0, 0], [.6, a], [dur - .7, a], [dur, 0]], droop: [[0, 0], [.6, -.06], [dur - .6, -.03], [dur, 0]] });
  };
  function nextClip(): Clip {
    const L = level();
    // Quiet pauses between most motions.
    if (!lastWasPause && rand() < (stood ? .85 : .72)) return CLIPS.pause(rand, L, pick(rand, 1.4, 4.5) * (1 + .6 * L));
    const not = (name: string) => !lastName.startsWith(name);
    const s = stood ? 0 : loop ?? stage;
    if (s === 0) return choose([   // standing, ready for bed: calm waiting, nothing that sits or dozes
      [3, () => CLIPS.pause(rand, .8, pick(rand, 4, 9))],
      [not('slow-blink') ? 1.6 : 0, () => CLIPS.slowBlink(rand, .7)],
      [not('heavy-blink') ? 1 : 0, () => CLIPS.heavyBlink(rand, .5)],
      [not('look') ? 1.4 : 0, () => lookToward(bedSide)],
      [not('sway') ? .8 : 0, () => CLIPS.sway(rand, .4)],
      [since('yawn') > 60 ? .5 : 0, () => CLIPS.yawn(rand, .7)],
    ]);
    if (s === 1) return choose([   // a little sleepy
      [2.6, () => CLIPS.pause(rand, L)],
      [not('look') ? 2.2 : 0, () => CLIPS.look(rand, L)],
      [not('slow-blink') ? 2.1 : 0, () => CLIPS.slowBlink(rand, L)],
      [since('yawn') > 58 && clock > 25 ? 1 : 0, () => CLIPS.yawn(rand, L)],
      [not('sway') ? .7 : 0, () => CLIPS.sway(rand, L * .5)],
      [L > .2 && not('heavy-blink') ? 1 : 0, () => CLIPS.heavyBlink(rand, L * .6)],
    ]);
    if (s === 2) return choose([   // clearly sleepy
      [2.4, () => CLIPS.pause(rand, L)],
      [since('nod') > 14 ? 2.2 + 2 * (L - .33) : 0, () => CLIPS.nod(rand, L)],
      [since('rub-eyes') > 24 && !reduced ? 1.5 : 0, () => CLIPS.rub(rand, L)],
      [since('yawn') > 52 ? 1.1 : 0, () => CLIPS.yawn(rand, L, rand() < .3 && !reduced)],
      [not('heavy-blink') ? 1.7 : 0, () => CLIPS.heavyBlink(rand, L)],
      [not('sway') ? 1.1 : 0, () => CLIPS.sway(rand, L)],
      [since('shake-off') > 40 ? .55 : 0, () => CLIPS.shakeOff(rand)],
      [not('look') ? .7 : 0, () => CLIPS.look(rand, L)],
    ]);
    return choose([                // very sleepy
      [2.2, () => CLIPS.pause(rand, L, pick(rand, 5, 11))],
      [since('doze') > 5 ? 3.2 : 0, () => CLIPS.doze(rand, L)],
      [since('nod') > 18 ? 1.3 : 0, () => CLIPS.nod(rand, L)],
      [since('rub-eyes') > 40 && !reduced ? .6 : 0, () => CLIPS.rub(rand, L)],
      [since('yawn') > 75 ? .7 : 0, () => CLIPS.yawn(rand, L, rand() < .4 && !reduced)],
      [not('heavy-blink') ? 1 : 0, () => CLIPS.heavyBlink(rand, L)],
      [not('sway') ? .6 : 0, () => CLIPS.sway(rand, L)],
    ]);
  }

  function beginFinale(short: boolean) {
    phase = 'finale'; needShort = false;
    if (short) queue = [];
    else if (finales === 0) {
      // Rouse a little, one big stretching yawn, rub the eyes, get up.
      queue = [CLIPS.joltLite(rand), CLIPS.yawn(rand, 1, !reduced), CLIPS.pause(rand, 1, .6)];
      if (!reduced) queue.push(CLIPS.rub(rand, 1, rand() < .5 ? 'L' : 'R'));
    } else queue = [CLIPS.slowBlink(rand, 1), CLIPS.pause(rand, 1, 1)];   // retry after being roused: no second big yawn
    if (posture > .5) queue.push(CLIPS.standUp());
    queue.push(CLIPS.lookToBed(rand, bedSide), CLIPS.hold(1.2, 'ready'));
    finales++;
    emit({ type: 'finale', short });
  }
  function finishMain() {
    const c = main!;
    main = null;
    if (c.posture !== undefined) posture = c.posture;
    if (c.name === 'stand-up') stood = true;
    if (c.marker === 'ready') { phase = 'ready'; pendingReady = true; }
  }
  function rouse() {
    // Freeze the running clip and fade it out; an atomic posture move (sit down / stand up) completes.
    if (main && !main.atomic) { fading.push({ c: main, t: main.t, w: 1 }); main = null; }
    if (phase === 'finale') emit({ type: 'finale-cancel' });
    queue = [];
    if (phase !== 'off') phase = 'stage';
    // Already up (or getting up): afterwards only the short look-toward-bed close repeats.
    if (stood || main?.name === 'stand-up') needShort = true;
  }

  function channelsNow(dt: number): Channels {
    const L = level();
    readyMix = stood ? Math.min(1, readyMix + dt / 1.8) : 0;
    const base = baselineAt(L, loop ? 0 : readyMix, bedSide);
    const ch = zeroChannels();
    ch.sit = posture; ch.sitR = posture;
    ch.droop = base.droop; ch.nod = base.nod; ch.sink = base.sink; ch.tail = base.tail;
    ch.sleepMouth = base.sleepMouth; ch.gx = base.gx; ch.gy = base.gy; ch.pitch = base.pitch;
    const p = perk.p;
    if (main) {
      if (main.atomic && main.extra) { const tmp = zeroChannels(); main.extra(main.t, tmp); ch.sit = tmp.sit; ch.sitR = tmp.sitR; }
      applyClip(main, main.t, 1 - p, ch, main.atomic ? 1 : 1 - p);
    }
    for (const f of fading) applyClip(f.c, f.t, f.w * (1 - p), ch);
    // Blinks: slower and longer as sleepiness grows; quick ones while roused.
    const noBlink = (!!main?.noBlink && p < .5) || p > .6;
    if (blinkT < 0) {
      nextBlink -= dt;
      if (nextBlink <= 0 && !noBlink) {
        blinkT = 0; blinkLag = rand() < .25 ? pick(rand, .03, .07) : 0;
        blinkShape = p > .3 ? { c: .06, h: 0, o: .1 }
          : { c: .14 + .16 * L + pick(rand, -.02, .03), h: .03 + .25 * L * rand(), o: .2 + .38 * L + pick(rand, -.03, .06) };
        nextBlink = pick(rand, 3, 6.5) * (1 + .35 * L);
      }
    }
    if (blinkT >= 0) {
      blinkT += dt;
      const { c, h, o } = blinkShape;
      const shape = (t: number) => t < 0 ? 0 : t < c ? smoothstep(t / c) : t < c + h ? 1 : t < c + h + o ? 1 - smoothstep((t - c - h) / o) : 0;
      ch.closeL = Math.max(ch.closeL, shape(blinkT)); ch.closeR = Math.max(ch.closeR, shape(blinkT - blinkLag));
      if (blinkT > c + h + o + blinkLag) blinkT = -1;
    }
    // Gaze drift: slower glides as the eyes get heavy.
    gaze.next -= dt;
    if (gaze.next <= 0) {
      gaze.fromX = gaze.x; gaze.fromY = gaze.y;
      gaze.toX = pick(rand, -4, 4) * (1 - .5 * L); gaze.toY = pick(rand, -1.5, 1.5);
      gaze.t = 0; gaze.dur = .1 + .35 * L; gaze.next = pick(rand, 2.5, 6) * (1 + .4 * L);
    }
    gaze.t += dt;
    const g = smoothstep(gaze.t / gaze.dur);
    gaze.x = lerp(gaze.fromX, gaze.toX, g); gaze.y = lerp(gaze.fromY, gaze.toY, g);
    ch.gx += gaze.x; ch.gy += gaze.y;
    // Breathing: slower and a little deeper with sleepiness (continuous phase, never reset).
    breathPhase += dt * 2 * Math.PI / (3.6 + 1.5 * L);
    ch.breath = Math.sin(breathPhase) * (.6 + .8 * L);
    if (p > 0) {
      const tap = perk.kind === 'tap';
      ch.alert = Math.max(ch.alert, p * (tap ? 1 : .85));
      ch.nod = lerp(ch.nod, -.1, p); ch.sink = lerp(ch.sink, -2, p); ch.tail = lerp(ch.tail, -.35, p);
      ch.closeL *= 1 - p; ch.closeR *= 1 - p; ch.sleepMouth *= 1 - p; ch.yawn *= 1 - p; ch.pitch = lerp(ch.pitch, -.1, p);
      ch.gx = lerp(ch.gx, perk.lookX, p); ch.gy = lerp(ch.gy, perk.lookY, p);
      if (tap) {
        // Startle (wide eyes, raised brows, small "o"), then a happy squint at the player.
        const t = perk.t, startle = smoothstep(t / .1) * (1 - smoothstep((t - .3) / .3));
        const happy = smoothstep((t - .4) / .3) * (1 - smoothstep((t - 1.5) / .6));
        ch.wide += .5 * startle; ch.raise += .65 * startle; ch.o += startle;
        ch.smile += .9 * happy * p; ch.happy += .85 * happy * p; ch.cheeks += .8 * happy * p;
        ch.lift += .15 * startle;
      } else ch.shy += .35 * p;
    }
    return ch;
  }

  return {
    get active() { return active; },
    get phase() { return phase; },
    get stage() { return stage; },
    get level() { return level(); },
    /** Begin (or resume) the drowsy idle; the first 1.5 s blend from the idle frame on screen. */
    start(opts: StartOptions = {}) {
      active = true; clock = 0; main = null; queue = []; fading.length = 0;
      stood = false; readyMix = 0; needShort = false; finales = 0; readyCount = 0; pendingReady = false;
      stage = loop ?? opts.stage ?? 1;
      stageTime = loop ? 0 : clamp((opts.level ?? STAGE_LEVEL[stage - 1]) - STAGE_LEVEL[stage - 1], 0, 1 / 3) * 3 * durs[stage - 1];
      phase = 'stage'; posture = 0; lastName = ''; lastWasPause = true; lastAt.clear();
      Object.assign(perk, { p: 0, hold: 0, t: 99, on: false, lookSet: false, calmAt: -1e9 });
      const idle = idlePoseAt(opts.idleTime ?? 0);
      idle.face.gx = opts.gx ?? 0; idle.face.gy = opts.gy ?? 0;
      intro = { from: { body: idle.body, face: idle.face, drowsy: openDrowsyFace(), shadow: { x: 0, scale: 1, opacity: 1 } }, t: 0, dur: 1.5 };
      if (stage >= 2 && !reduced) queue.push(CLIPS.pause(rand, level(), 1.6), CLIPS.sitDown());
      nextBlink = pick(rand, 1.5, 3); gaze.next = pick(rand, 1, 2.5);
      emit({ type: 'start', stage, level: level() });
    },
    /** Host takes the art back (drag, exit, another animation). */
    stop() { if (active) { active = false; phase = 'off'; emit({ type: 'stop' }); } },
    /** Player attention: 'notice' (pointer near / hovering; repeat while it lasts) or 'tap' (click / tap). */
    interact(kind: InteractKind, look?: { gx: number; gy: number }) {
      if (!active) return;
      if (look) { perk.lookX = clamp(look.gx, -9, 9); perk.lookY = clamp(look.gy, -7, 7); perk.lookSet = true; }
      else if (!perk.lookSet) { perk.lookX = 0; perk.lookY = -2; }
      if (!perk.on) rouse();
      if (!perk.on || kind === 'tap') {
        if (kind === 'tap') { perk.kind = 'tap'; perk.t = 0; } else if (!perk.on && perk.p === 0) { perk.kind = 'notice'; perk.t = 0; }
        emit({ type: 'perk', kind });
      }
      perk.on = true;
      perk.hold = Math.max(perk.hold, kind === 'tap' ? 2.2 : 1.2);
    },
    setBedSide(side: number) { bedSide = side < 0 ? -1 : 1; },
    /** Preview / inspection: play one named motion next (a running pause gives way). Posture moves are not offered. */
    perform(name: PerformName) {
      if (!active || phase !== 'stage' || perk.p > 0) return false;
      const L = level(), make: Record<PerformName, () => Clip> = {
        'slow-blink': () => CLIPS.slowBlink(rand, L), 'heavy-blink': () => CLIPS.heavyBlink(rand, L), look: () => CLIPS.look(rand, L),
        yawn: () => CLIPS.yawn(rand, L), 'big-yawn': () => CLIPS.yawn(rand, L, !reduced), sway: () => CLIPS.sway(rand, L),
        nod: () => CLIPS.nod(rand, L), 'rub-eyes-L': () => CLIPS.rub(rand, L, 'L'), 'rub-eyes-R': () => CLIPS.rub(rand, L, 'R'),
        'shake-off': () => CLIPS.shakeOff(rand), doze: () => CLIPS.doze(rand, L),
      };
      if (!make[name]) return false;
      queue.unshift(make[name]());
      if (main?.name === 'pause') { fading.push({ c: main, t: main.t, w: 1 }); main = null; }
      return true;
    },
    step(dtMs: number): DrowsyFrame {
      const dt = clamp(dtMs, 0, 100) / 1000;
      if (!active) {
        const out: DrowsyFrame = { active: false, phase, stage, level: level(), action: null, perk: 0, pose: lastPose ?? composePose(zeroChannels()), events };
        events = [];
        return out;
      }
      clock += dt;
      if (perk.on) {
        perk.t += dt; perk.hold -= dt;
        perk.p = Math.min(1, perk.p + dt / .22);
        if (perk.hold <= 0) { perk.on = false; perk.lookSet = false; }
      } else if (perk.p > 0) {
        perk.t += dt;
        perk.p = Math.max(0, perk.p - dt / 3.4);
        if (perk.p === 0) {
          perk.calmAt = clock; emit({ type: 'calm' });
          if (level() > .4 && !stood && rand() < .5) queue.unshift(CLIPS.heavyBlink(rand, level()));   // the heaviness comes back
        }
      }
      // Sleepiness advances only while nobody is playing with it.
      if (!loop && phase === 'stage' && quiet()) stageTime += dt;
      for (let i = fading.length - 1; i >= 0; i--) { fading[i].w -= dt / .4; if (fading[i].w <= 0) fading.splice(i, 1); }
      if (main) { main.t += dt; if (main.t >= main.dur) finishMain(); }
      if (!main && !loop && phase === 'stage' && !queue.length && quiet()) {
        if (stage === 1 && stageTime >= durs[0]) {
          stage = 2; stageTime = 0; emit({ type: 'stage', stage });
          if (!reduced) queue.push(CLIPS.sitDown());
        } else if (stage === 2 && stageTime >= durs[1]) {
          stage = 3; stageTime = 0; emit({ type: 'stage', stage });
          queue.push(CLIPS.doze(rand, level()));
        } else if (stage === 3 && stageTime >= durs[2] && !stood) beginFinale(false);
        else if (needShort) beginFinale(true);
      }
      if (!main && perk.p < .3) startClip(queue.length ? queue.shift()! : nextClip());
      const ch = channelsNow(dt);
      let pose = composePose(ch, { reducedMotion: reduced });
      if (intro) {
        intro.t += dt;
        pose = lerpDrowsyPose(intro.from, pose, smoothstep(intro.t / intro.dur));
        if (intro.t >= intro.dur) intro = null;
      }
      lastPose = pose;
      if (pendingReady) {
        pendingReady = false;
        emit({ type: 'ready-for-bed', repeat: readyCount > 0, side: bedSide, pose });
        readyCount++;
      }
      const out: DrowsyFrame = { active, phase, stage, level: level(), action: main?.name ?? null, perk: perk.p, pose, events };
      events = [];
      return out;
    },
  };
}
export type DrowsyController = ReturnType<typeof createDrowsyController>;

/** Final pose family at "ready for bed": rest stance (01-idle footing), heavy lids, gaze toward the bed. */
export function readyPose(side = 1): DrowsyPose {
  const base = baselineAt(1, 1, side), ch = zeroChannels();
  for (const k of BASE_KEYS) ch[k] = base[k];
  return composePose(ch);
}
