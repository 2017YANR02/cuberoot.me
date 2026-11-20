import { MathUtils } from 'three';

export function createStickerHintFade(started: number, reducedMotion: boolean) {
  const fadeInMs = reducedMotion ? 0 : 200;
  const holdMs = 1150;
  const fadeOutMs = reducedMotion ? 0 : 260;
  let fadeAt = started + fadeInMs + holdMs;
  let fadeFrom = 1;
  let opacity = reducedMotion ? 1 : 0;

  return (now: number, dismiss = false) => {
    if (dismiss && now < fadeAt) {
      fadeAt = now;
      fadeFrom = opacity;
    }
    const fadingOut = now >= fadeAt;
    opacity = fadingOut
      ? fadeFrom * (fadeOutMs ? 1 - MathUtils.smoothstep(now, fadeAt, fadeAt + fadeOutMs) : 0)
      : fadeInMs ? MathUtils.smoothstep(now, started, started + fadeInMs) : 1;
    return { opacity, complete: fadingOut && opacity === 0 };
  };
}
