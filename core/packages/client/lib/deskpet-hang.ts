// Hook coordinates come from Claude's delivered 640×640 rig, not its body center.
export const HANG_HOOK_Y = 170.48 / 640;
export const nearTopHang = (top: number, height: number, viewportTop = 0) =>
  top + height * HANG_HOOK_Y <= viewportTop + Math.max(24, height * .18);

/** One same-origin SVG document; on/off transitions reverse at their current pose. */
export function createHangRenderer(options: {
  object: HTMLObjectElement;
  reducedMotion: () => boolean;
  onShow: () => void;
  onRest: () => void;
  onUnavailable: () => void;
  onPhase: (phase: 'hanging' | 'releasing' | undefined) => void;
}) {
  const object = options.object;
  let svg: SVGSVGElement | undefined;
  let phase: 'hanging' | 'releasing' | undefined;
  let shown = false, disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { clearTimeout(timer); timer = undefined; };
  const setPhase = (next: typeof phase) => { phase = next; options.onPhase(next); };
  const playback = (run: boolean) => {
    if (!svg) return;
    svg.style.animationPlayState = run ? 'running' : 'paused';
    for (const eye of svg.querySelectorAll<SVGElement>('.hg-eye')) eye.style.animationPlayState = run ? 'running' : 'paused';
  };
  const motion = () => {
    if (options.reducedMotion()) svg?.setAttribute('data-hang-motion', 'reduce');
    else svg?.removeAttribute('data-hang-motion');
  };
  const hide = () => {
    stop(); setPhase(undefined); playback(false);
    svg?.setAttribute('data-hang', 'off');
    shown = false; object.style.visibility = 'hidden';
  };
  const unavailable = () => {
    const wasShown = shown; hide(); svg = undefined;
    if (wasShown && !disposed) options.onUnavailable();
  };
  const load = () => {
    if (disposed) return;
    try {
      const root = object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg' || root.getAttribute('data-rootbeast-hang') !== 'rig') { unavailable(); return; }
      svg = root as unknown as SVGSVGElement;
      motion(); svg.setAttribute('data-hang', phase === 'hanging' ? 'on' : 'off'); playback(!!phase);
    } catch { unavailable(); }
  };
  object.style.visibility = 'hidden';
  object.addEventListener('load', load); object.addEventListener('error', unavailable); load();
  return {
    get ready() { return !!svg; },
    get active() { return !!phase; },
    get hanging() { return phase === 'hanging'; },
    get visible() { return shown; },
    enter() {
      if (!svg || disposed) return false;
      stop(); motion(); setPhase('hanging');
      if (!shown) { shown = true; options.onShow(); object.style.visibility = ''; }
      playback(true); svg.setAttribute('data-hang', 'on'); return true;
    },
    release() {
      if (!svg || disposed || !phase) return;
      stop(); motion(); setPhase('releasing'); svg.setAttribute('data-hang', 'off');
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || phase !== 'releasing') return;
        setPhase(undefined); playback(false); options.onRest();
      }, options.reducedMotion() ? 120 : 340);
    },
    // Retain the decoded vector until an exit/rest replacement paints.
    interrupt() { stop(); setPhase(undefined); playback(false); },
    hide,
    dispose() {
      disposed = true; hide(); svg = undefined;
      object.removeEventListener('load', load); object.removeEventListener('error', unavailable);
    },
  };
}
