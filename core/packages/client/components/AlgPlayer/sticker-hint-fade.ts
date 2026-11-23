import { Color, MathUtils } from 'three';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import type { CubeFace } from '@/lib/cube-colors';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';

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

export function animateStickerHint(onOpacity: (opacity: number) => void) {
  const started = performance.now();
  const fade = createStickerHintFade(started, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  onOpacity(fade(started).opacity);
  let frame = requestAnimationFrame(function update(now) {
    const { opacity, complete } = fade(now);
    onOpacity(opacity);
    if (!complete) frame = requestAnimationFrame(update);
  });
  return () => cancelAnimationFrame(frame);
}

export function dimStickerColors(stickers: readonly string[], orientation: string, opacity: number) {
  const colors = orientedCubeFaceColors(orientation);
  const gray = new Color(FM_FIXED_COLOR[FM_IGNORED]!);
  const color = new Color();
  return Object.fromEntries(stickers.map(sticker => [sticker,
    color.set(colors[sticker[0] as CubeFace]).lerp(gray, opacity).getStyle()]));
}
