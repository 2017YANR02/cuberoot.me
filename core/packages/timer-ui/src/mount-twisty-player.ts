import type { TwistyPlayer, TwistyPlayerConfig } from 'cubing/twisty';

/** Shared lazy lifecycle for alg previews and the live Twizzle mirror. */
export async function mountTwistyPlayer(host: HTMLElement, config: TwistyPlayerConfig,
  options: { signal: AbortSignal; size?: number }) {
  const { TwistyPlayer } = await import('cubing/twisty');
  options.signal.throwIfAborted();
  const player = new TwistyPlayer(config);
  const resize = () => {
    const width = options.size ?? host.clientWidth;
    const height = options.size ?? host.clientHeight;
    if (width > 0 && height > 0) {
      player.style.width = `${width}px`;
      player.style.height = `${height}px`;
    }
  };
  resize();
  const observer = new ResizeObserver(resize);
  if (options.size === undefined) observer.observe(host);
  host.appendChild(player);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    player.pause();
    player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
    // cubing.js does not disconnect its scene listeners on DOM removal alone.
    void player.experimentalCurrentVantages().then(vantages => {
      for (const vantage of vantages) vantage.scene?.disconnect();
    });
    player.remove();
    options.signal.removeEventListener('abort', dispose);
  };
  options.signal.addEventListener('abort', dispose, { once: true });
  return { player, dispose };
}

export type MountedTwistyPlayer = Awaited<ReturnType<typeof mountTwistyPlayer>>;
export type { TwistyPlayer };
