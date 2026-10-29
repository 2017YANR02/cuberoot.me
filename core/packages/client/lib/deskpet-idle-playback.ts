/** Pause only the idle document's running animations; preserve externally paused ones. */
export function createDeskPetIdlePlayback(object: HTMLObjectElement) {
  let svg: SVGSVGElement | undefined;
  const paused = new Set<Animation>();
  let pausedSmil = false, disposed = false;
  const sync = () => {
    if (disposed) return;
    try {
      const next = object.contentDocument?.documentElement;
      if (next !== svg) {
        paused.clear(); pausedSmil = false;
        svg = next?.localName === 'svg' ? next as unknown as SVGSVGElement : undefined;
      }
      if (!svg) return;
      const hidden = object.style.visibility === 'hidden' || object.ownerDocument.hidden;
      if (hidden) {
        for (const animation of svg.getAnimations?.({ subtree: true }) ?? []) {
          if (animation.playState === 'running' && !paused.has(animation)) {
            paused.add(animation); animation.pause();
          }
        }
        if (!pausedSmil && svg.animationsPaused && !svg.animationsPaused()) {
          svg.pauseAnimations(); pausedSmil = true;
        }
      } else {
        // Do not restore saved currentTime: legitimate idle restarts may reset it.
        for (const animation of paused) if (animation.playState === 'paused') animation.play();
        paused.clear();
        if (pausedSmil) { svg.unpauseAnimations(); pausedSmil = false; }
      }
    } catch { /* The decoded image remains the fallback for unavailable documents. */ }
  };
  const observer = new MutationObserver(sync);
  observer.observe(object, { attributes: true, attributeFilter: ['style'] });
  object.addEventListener('load', sync);
  object.ownerDocument.addEventListener('visibilitychange', sync);
  sync();
  return {
    sync,
    dispose() {
      if (disposed) return;
      object.style.visibility = 'hidden'; sync(); disposed = true;
      observer.disconnect(); object.removeEventListener('load', sync);
      object.ownerDocument.removeEventListener('visibilitychange', sync);
      paused.clear(); svg = undefined;
    },
  };
}
