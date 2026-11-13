import { resolveSimMoveDurationScale } from '@/components/AlgPlayer/player-setup';
import { F2L_INTRO_SEGMENTS, LBL_INTRO_SEGMENTS } from '../data/lbl-intro';

export const INTRO_CROSS_MS = 7200;
export const INTRO_SPLIT_MS = 1200;
export const INTRO_COMPARE_AT = INTRO_CROSS_MS + INTRO_SPLIT_MS;
export const introEase = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

type Shot = {
  kind: 'inspect' | 'split' | 'reveal' | 'orbit' | 'focus' | 'move' | 'hold' | 'finish';
  start: number; duration: number; phase: number; piece: number; step: number;
  yaw: number; fromYaw: number; move?: number;
};

/** A single schedule describes playback and seeking, including observation pauses. */
export function createIntroTimeline(method: 'lbl' | 'f2l', comparison: boolean) {
  const pairs = method === 'f2l';
  const segments = pairs ? F2L_INTRO_SEGMENTS : LBL_INTRO_SEGMENTS;
  const moveMs = comparison ? 650 : 350;
  const shots: Shot[] = [];
  let start = 0, phase = 0, piece = 0, step = 0, yaw = 0;
  const add = (kind: Shot['kind'], duration: number, extra: Partial<Shot> = {}) => {
    shots.push({ kind, start, duration, phase, piece, step, yaw, fromYaw: yaw, ...extra });
    start += duration;
  };
  add('inspect', INTRO_CROSS_MS);
  if (comparison) add('split', INTRO_SPLIT_MS);
  for (const group of pairs ? [0] : [0, 4]) {
    phase = group === 0 ? 1 : 3;
    add('reveal', 1800);
    for (let index = group; index < group + 4; index++) {
      const segment = segments[index];
      if (segment.yaw !== yaw) add('orbit', 1600, { yaw: segment.yaw });
      yaw = segment.yaw;
      piece = index;
      add('focus', 3000);
      for (const move of segment.alg.split(/\s+/)) {
        add('move', moveMs * resolveSimMoveDurationScale('3x3', move), { move: step });
        step++;
      }
      add('hold', 1000);
    }
    if (!pairs && group === 0) { phase = 2; add('inspect', INTRO_CROSS_MS); }
  }
  phase = 4;
  add('finish', 5000, { yaw: (pairs ? -2 : -4) * Math.PI });
  return { shots, duration: start, moveMs, pairs };
}

export function introFrame(timeline: ReturnType<typeof createIntroTimeline>, time: number, reduced: boolean) {
  const t = Math.max(0, Math.min(time, timeline.duration));
  const shot = timeline.shots.find(item => t < item.start + item.duration) ?? timeline.shots[timeline.shots.length - 1];
  const elapsed = t - shot.start;
  let yaw = shot.yaw, pitch = 0;
  if (shot.kind === 'inspect') {
    const arc = reduced ? 0 : introEase((elapsed - 1000) / 1500) - introEase((elapsed - 4500) / 1800);
    pitch = -1.4 * arc;
    yaw += shot.phase === 2 ? .45 * arc : 0;
  } else if (shot.kind === 'orbit' || shot.kind === 'finish') {
    const fraction = reduced ? 1 : introEase(shot.kind === 'finish' ? (elapsed - 1500) / 1600 : elapsed / shot.duration);
    yaw = shot.fromYaw + (shot.yaw - shot.fromYaw) * fraction;
  }
  const reveal = shot.kind === 'reveal' ? introEase(elapsed / 1400) : 1;
  const cornerAlpha = shot.phase === 0 ? 0 : shot.phase === 1 ? reveal : 1;
  const edgeAlpha = timeline.pairs ? cornerAlpha : shot.phase < 3 ? 0 : shot.phase === 3 ? reveal : 1;
  const pulse = !reduced && shot.kind === 'focus' ? (1 + Math.cos(elapsed * Math.PI * 2 / 1000)) / 2 : 1;
  return { time: t, phase: shot.phase, piece: shot.piece, step: shot.step, move: shot.move, yaw, pitch, cornerAlpha, edgeAlpha, pulse };
}

export const INTRO_VIDEO_DURATION = Math.max(createIntroTimeline('lbl', true).duration, createIntroTimeline('f2l', true).duration);
