import { expect, it } from 'vitest';
import { playbackTiming, ReviewPlaybackClock } from '@/lib/video-recon/engine/playback-timing';

it('uses irregular source timestamps at quarter speed while analysis keeps its 30 fps cadence', () => {
  const clock = new ReviewPlaybackClock();
  clock.start(2, .25, 100);
  expect(clock.delayUntil(2.02, 100)).toBeCloseTo(80);
  expect(clock.delayUntil(2.075, 180)).toBeCloseTo(220);
  expect(clock.time(116)).toBeCloseTo(2.004);
  expect(playbackTiming(50).frameIntervalMs).toBeCloseTo(1000 / 30);

  const changeAt = 200;
  const cursor = clock.time(changeAt);
  clock.start(cursor, 1, changeAt);
  expect(clock.time(changeAt + 16)).toBeCloseTo(2.041);
  expect(clock.delayUntil(2.075, changeAt + 16)).toBeCloseTo(34);
});
