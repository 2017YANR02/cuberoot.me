export const PLAYBACK_SPEEDS=[.25,.5,1] as const;
export type PlaybackSpeed=typeof PLAYBACK_SPEEDS[number];

/** Use one playback clock for selected video frames and cube interpolation.
 * Source frame selection is unchanged; slow motion only increases wall time. */
export function playbackTiming(sourceFps:number,speed:number=1) {
 const fps=Number.isFinite(sourceFps)&&sourceFps>0?Math.min(30,sourceFps):30;
 const rate=PLAYBACK_SPEEDS.includes(speed as PlaybackSpeed)?speed:1;
 return {frameIntervalMs:1000/fps/rate,transitionMs:100/rate};
}
