/**
 * Shared tween timing for the non-NxN cuber engines (Ivy / Dino / Redi / SQ1).
 * They all animate on the one speed slider, so the frame count + duration curve
 * live here instead of on the NxN `CubeGroup` (which used to own them).
 *
 * `timing.frames` = frames per 90° turn (the speed knob writes it; mutable across
 * imports via the holder object). `tweenDuration` scales it sub-linearly by the
 * move magnitude `d` (in 90° units): 90° = frames, 180° ≈ 1.33×frames, 30° =
 * 0.5×frames. The NxN engine reads `timing.frames` too, so everything stays in
 * lockstep if the curve is retuned.
 */
export const timing = { frames: 30 };

export function tweenDuration(d: number): number {
  return timing.frames * (2 - 2 / (d + 1));
}
