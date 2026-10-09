import { vi } from 'vitest';

/** jsdom has no WebGL or constructable stylesheets. Keep the preview UI real. */
export const TwistyPlayer = vi.fn(function (options: Record<string, unknown>) {
  const player = document.createElement('div');
  player.dataset.testTwistyPlayer = '';
  player.dataset.visualization = String(options.visualization ?? '');
  Object.defineProperty(player, 'experimentalSetupAlg', {
    set(value: string) { player.dataset.scramble = value; },
  });
  return player;
});
