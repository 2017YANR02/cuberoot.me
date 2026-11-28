export const PLAYBACK_SPEEDS=[.25,.5,1] as const;
export type PlaybackSpeed=typeof PLAYBACK_SPEEDS[number];

/** Cadence for sampled analysis and pose transitions outside file review. */
export function playbackTiming(sourceFps:number,speed:number=1) {
 const fps=Number.isFinite(sourceFps)&&sourceFps>0?Math.min(30,sourceFps):30;
 const rate=PLAYBACK_SPEEDS.includes(speed as PlaybackSpeed)?speed:1;
 return {frameIntervalMs:1000/fps/rate,transitionMs:100/rate};
}

/** Advances in source seconds, independent of the spacing between decoded frames. */
export class ReviewPlaybackClock {
  private timestamp = 0;
  private startedAt = 0;
  private rate: PlaybackSpeed = 1;

  start(timestamp: number, rate: PlaybackSpeed, now: number) {
    this.timestamp = timestamp;
    this.startedAt = now;
    this.rate = rate;
  }

  time(now: number): number {
    return this.timestamp + Math.max(0, now - this.startedAt) * this.rate / 1000;
  }

  delayUntil(timestamp: number, now: number): number {
    return Math.max(0, (timestamp - this.time(now)) * 1000 / this.rate);
  }
}
