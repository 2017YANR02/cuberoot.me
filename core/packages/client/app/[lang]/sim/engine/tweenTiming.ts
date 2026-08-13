/**
 * Shared tween timing for the non-NxN cuber engines (Ivy / Dino / Redi / SQ1).
 * They all animate on the one speed slider, so the nominal tick count lives here
 * instead of on the NxN `CubeGroup` (which used to own it).
 *
 * `timing.frames` is retained as the export-compatible name, but now means 60 Hz
 * nominal ticks per formula token. Live animation advances those ticks from real
 * elapsed milliseconds, so monitor refresh rate cannot change TPS. Formula tokens
 * always use the full value; `tweenDuration` remains only for partial drag settling.
 */
export const timing = { frames: 30 };

export function tweenDuration(d: number): number {
  return timing.frames * (2 - 2 / (d + 1));
}
