// Exit / entrance sequencing shared by every desk pet. Characters with
// dedicated clips (Root Beast) supply them through their theme; the others
// get conservative container motion around poses they already have.

export type DeskPetExitStyle = 'hop' | 'sleep';
export const DESKPET_EXIT_KEY = 'clawd-deskpet-exit';
export const parseExitStyle = (value: unknown): DeskPetExitStyle => (value === 'sleep' ? 'sleep' : 'hop');

export const GENERIC_HOP_MS = 650;
export const GENERIC_SLEEP_MS = 1400;
export const SLEEP_FADE_MS = 180;
export const GENERIC_ENTER_MS = 450;
// A pose that has not painted by then exits with the frame already on screen.
export const EXIT_STALL_MS = 600;

/**
 * Carries a hopping pet past the nearest edge (`dx` px, signed). Clips do
 * their own crouch, so the container waits for the takeoff; without a clip
 * the container also crouches and springs.
 */
export function exitHopKeyframes(dx: number, crouch: boolean): Keyframe[] {
  const tilt = dx < 0 ? -12 : 12;
  const launch = crouch ? .36 : .4;
  const apex = launch + (1 - launch) * .45;
  return [
    { offset: 0, transform: 'none', opacity: 1 },
    ...(crouch ? [{ offset: .22, transform: 'translateY(2%) scale(1.06,.9)', easing: 'cubic-bezier(.2,.8,.3,1)' }] : []),
    { offset: launch, transform: crouch ? 'translateY(-6%) scale(.96,1.05)' : 'none', easing: 'cubic-bezier(.25,.7,.45,1)' },
    { offset: apex, transform: `translate(${Math.round(dx * .42)}px,-16%) rotate(${tilt / 2}deg) scale(.94)`, easing: 'cubic-bezier(.5,0,.85,.45)' },
    { offset: .86, opacity: 1 },
    { offset: 1, transform: `translate(${Math.round(dx)}px,24%) rotate(${tilt}deg) scale(.72)`, opacity: 0 },
  ];
}

/** Last beat of a sleep exit: settle and fade once the pet is tucked in. */
export const exitFadeKeyframes = (): Keyframe[] => [
  { opacity: 1, transform: 'none' },
  { opacity: 0, transform: 'translateY(3%)' },
];

/** Reveal after being shown again. A clip carries its own motion. */
export function enterKeyframes(clip: boolean): Keyframe[] {
  return clip
    ? [{ offset: 0, opacity: 0 }, { offset: .16, opacity: 1 }, { offset: 1, opacity: 1 }]
    : [
      { offset: 0, opacity: 0, transform: 'translateY(10%) scale(.92)' },
      { offset: .6, opacity: 1, transform: 'translateY(-2%) scale(1.02)' },
      { offset: 1, opacity: 1, transform: 'none' },
    ];
}

export interface DeskPetExitPlan {
  /** Start the pose; call `ready` once its first frame is on screen (or it failed). */
  play: (ready: () => void) => void;
  /** Starts container motion together with the pose. */
  move?: () => void;
  holdMs: number;
  fade?: () => void;
  fadeMs: number;
  finish: () => void;
  stallMs?: number;
}

/**
 * Sequence one exit: pose → hold → optional fade → `finish`, exactly once.
 * A pose that never paints still finishes after `stallMs`. Returns a cancel
 * function that stops every timer without finishing.
 */
export function runDeskPetExit({ play, move, holdMs, fade, fadeMs, finish, stallMs = EXIT_STALL_MS }: DeskPetExitPlan) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let begun = false;
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    finish();
  };
  const begin = () => {
    if (begun || over) return;
    begun = true;
    clearTimeout(timer);
    move?.();
    timer = setTimeout(() => {
      if (!fadeMs) { end(); return; }
      fade?.();
      timer = setTimeout(end, fadeMs);
    }, holdMs);
  };
  timer = setTimeout(begin, stallMs);
  play(begin);
  return () => {
    over = true;
    clearTimeout(timer);
  };
}

const frames = new Map<string, Promise<Blob>>();
/**
 * Bytes for a one-shot frame, fetched once per page. Each play wraps them in
 * a new object URL so the SVG timeline starts from its first frame instead of
 * sharing an image that has already finished.
 */
export function loadMotionBlob(url: string) {
  let blob = frames.get(url);
  if (!blob) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error('Desk pet frame unavailable');
      return response.blob();
    });
    frames.set(url, request);
    request.catch(() => { if (frames.get(url) === request) frames.delete(url); });
    blob = request;
  }
  return blob;
}
