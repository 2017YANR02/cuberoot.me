import type { ShakeSnapshot } from './deskpet-shake';

/** Same-origin object document, not CSS variables on its parent or an <img>. */
export function createDizzyRenderer(options: {
  object: HTMLObjectElement;
  snapshot: () => ShakeSnapshot;
  reducedMotion: () => boolean;
  interrupted: () => boolean;
  onShow: () => void;
  onHandoff: () => void;
  onRest: () => void;
  onUnavailable: () => void;
}) {
  const object = options.object;
  let svg: SVGSVGElement | undefined;
  let shown = false;
  let settling = false;
  let disposed = false;
  let frame: number | undefined;
  let handoff: ReturnType<typeof setTimeout> | undefined;
  let blend: Animation | undefined;
  const playback = (running: boolean) => {
    if (!svg) return;
    const value = running ? 'running' : 'paused';
    svg.style.animationPlayState = value;
    for (const ring of svg.querySelectorAll<SVGElement>('.dz-ring')) ring.style.animationPlayState = value;
  };
  const stopFrame = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
  const stopBlend = () => { clearTimeout(handoff); handoff = undefined; blend?.cancel(); blend = undefined; };
  const hide = () => {
    stopFrame(); stopBlend(); playback(false);
    shown = false; object.style.visibility = 'hidden';
    settling = false;
  };
  const draw = (s: ShakeSnapshot) => {
    if (!svg) return;
    // These declarations live INSIDE the SVG document and inherit to its rig.
    svg.style.setProperty('--dizzy-level', Math.max(0, Math.min(1, s.level)).toFixed(6));
    svg.style.setProperty('--dizzy-accent', s.phase === 'recovering' ? '1' : '0');
    if (options.reducedMotion()) svg.setAttribute('data-dizzy-motion', 'reduce');
    else svg.removeAttribute('data-dizzy-motion');
  };
  const unavailable = () => {
    const wasShown = shown;
    hide(); svg = undefined;
    if (wasShown) options.onUnavailable();
  };
  const sync = () => {
    if (disposed) return;
    stopFrame();
    const s = options.snapshot();
    if (s.phase === 'idle' || options.interrupted()) {
      stopBlend(); playback(false);
      // Retain the final decoded vector until the replacement pose paints.
      if (shown && !settling) {
        settling = true;
        if (!options.interrupted()) draw(s);
        options.onRest();
      }
      return;
    }
    if (!svg) return; // Retain the current character while loading / after failure.
    draw(s); playback(true);
    settling = false;
    if (!shown) {
      shown = true;
      options.onShow();
      object.style.visibility = '';
      if (options.reducedMotion() || typeof object.animate !== 'function') options.onHandoff();
      else {
        // Blend the existing drag pose into the rig without changing its anchor.
        blend = object.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        handoff = setTimeout(() => {
          handoff = undefined; blend?.cancel(); blend = undefined;
          if (!disposed && shown && options.snapshot().phase !== 'idle') options.onHandoff();
        }, 160);
      }
    }
    frame = requestAnimationFrame(sync);
  };
  const load = () => {
    if (disposed) return;
    try {
      const root = object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg' || root.getAttribute('data-rootbeast-dizzy') !== 'loop') { unavailable(); return; }
      svg = root as unknown as SVGSVGElement;
      // Do this before revealing: the standalone file defaults to fully dizzy.
      svg.style.setProperty('--dizzy-level', '0');
      svg.style.setProperty('--dizzy-accent', '0');
      playback(false);
      sync();
    } catch { unavailable(); }
  };
  object.style.visibility = 'hidden';
  object.addEventListener('load', load);
  object.addEventListener('error', unavailable);
  load();
  return {
    sync, hide,
    get ready() { return !!svg; },
    get visible() { return shown; },
    dispose() {
      disposed = true; hide();
      object.removeEventListener('load', load);
      object.removeEventListener('error', unavailable);
      svg = undefined;
    },
  };
}

/** Restart the existing idle document at its matching first pose, without reload. */
export function restartIdleDocument(object: HTMLObjectElement | null) {
  try {
    const svg = object?.contentDocument?.documentElement as unknown as SVGSVGElement | undefined;
    svg?.setCurrentTime?.(0);
    for (const animation of svg?.getAnimations?.({ subtree: true }) ?? []) animation.currentTime = 0;
  } catch { /* The fresh decoded idle image remains the safe fallback. */ }
}
