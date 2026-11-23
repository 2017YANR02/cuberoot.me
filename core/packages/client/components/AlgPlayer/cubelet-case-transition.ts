import { Color } from 'three';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';

const FADE_MS = 280;

function targetStickerColors(cube: Cube, homeIndex: number) {
  const { stickerSlots, staticSticker } = cube.instancedRenderer;
  const colors: [string, Color][] = [];
  stickerSlots.forEach((slot, index) => {
    if (slot.cubeletInitial !== homeIndex || !slot.visible) return;
    const color = new Color();
    staticSticker.getColorAt(index, color);
    colors.push([engineHomeSid(homeIndex, slot.face, cube.order), color]);
  });
  return colors;
}

function fade(
  setGrayAmount: (amount: number) => void, from: number, to: number, signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const started = performance.now();
    let frame: number;
    const finish = (complete: boolean) => {
      cancelAnimationFrame(frame);
      signal.removeEventListener('abort', abort);
      resolve(complete);
    };
    const abort = () => finish(false);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / FADE_MS);
      const eased = progress * progress * (3 - 2 * progress);
      setGrayAmount(from + (to - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish(true);
    };
    setGrayAmount(from);
    signal.addEventListener('abort', abort, { once: true });
    frame = requestAnimationFrame(tick);
  });
}

/** Switches the case while its target stickers are gray, with all geometry left visible. */
export async function transitionCubeletCase(
  cube: Cube, homeIndex: number, setup: string, signal: AbortSignal,
  setFadeColors: (colors?: Readonly<Record<string, string>>) => void,
): Promise<boolean> {
  if (signal.aborted || cube.twister.backlog || !cube.initials.has(homeIndex)) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cube.twister.setup(setup);
    return true;
  }
  const gray = new Color(FM_FIXED_COLOR[FM_IGNORED]!);
  const mixed = new Color();
  let colors = targetStickerColors(cube, homeIndex);
  const setGrayAmount = (amount: number) => {
    setFadeColors(Object.fromEntries(colors.map(([key, color]) => [key, mixed.copy(color).lerp(gray, amount).getStyle()])));
  };
  try {
    if (!await fade(setGrayAmount, 0, 1, signal)) return false;
    cube.twister.setup(setup);
    // Read the new step's base colors before drawing its gray-to-color transition.
    setFadeColors();
    colors = targetStickerColors(cube, homeIndex);
    return await fade(setGrayAmount, 1, 0, signal);
  } finally {
    setFadeColors();
  }
}
