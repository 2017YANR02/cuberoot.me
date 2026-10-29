import type { MusicPlayerState } from './music-player';

/** Controls Claude v3 inside its same-origin SVG; no parent CSS / image reload. */
export function createMusicRenderer(options: {
  object: HTMLObjectElement;
  read: () => Pick<MusicPlayerState, 'playing' | 'currentId' | 'error'>;
  subscribe: (listener: () => void) => () => void;
  blocked: () => boolean;
  reducedMotion: () => boolean;
  onShow: () => void;
  onRest: () => void;
  onUnavailable: () => void;
}) {
  const object = options.object;
  let svg: SVGSVGElement | undefined;
  let disposed = false, shown = false, active = false, target = false;
  let changedSource = false;
  let lastId = options.read().currentId;
  let restTimer: ReturnType<typeof setTimeout> | undefined;
  let switchTimer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(restTimer); clearTimeout(switchTimer); restTimer = switchTimer = undefined; };
  const clock = (run: boolean) => {
    if (!svg) return;
    svg.style.animationPlayState = run ? 'running' : 'paused';
    for (const note of svg.querySelectorAll<SVGElement>('.mh-note')) note.style.animationPlayState = run ? 'running' : 'paused';
  };
  const motion = () => {
    if (options.reducedMotion()) svg?.setAttribute('data-music-motion', 'reduce');
    else svg?.removeAttribute('data-music-motion');
  };
  const reset = () => {
    if (!svg) return;
    svg.style.transition = 'none'; svg.style.setProperty('--mp', '0');
    svg.removeAttribute('data-music');
    void svg.getBoundingClientRect();
    svg.style.removeProperty('--mp'); svg.style.removeProperty('transition');
  };
  const suspend = () => {
    clear(); active = shown = target = changedSource = false;
    object.style.visibility = 'hidden'; reset(); clock(false);
  };
  const finish = () => {
    if (disposed || target || !active) return;
    clearTimeout(restTimer); restTimer = undefined; active = false; clock(false);
    options.onRest(); // Retain final SVG until the replacement pose decodes.
  };
  const transitionEnd = (event: Event) => {
    if ((event as TransitionEvent).propertyName !== '--mp' || target) return;
    try { if (Number(svg?.ownerDocument.defaultView?.getComputedStyle(svg).getPropertyValue('--mp')) <= .001) finish(); }
    catch { /* Bounded timer also works on browsers without transition events. */ }
  };
  const apply = (next: boolean) => {
    if (!svg || disposed) return;
    motion();
    if (next) {
      const resuming = !active;
      active = true;
      clearTimeout(restTimer); restTimer = undefined;
      if (!shown || resuming) { shown = true; options.onShow(); object.style.visibility = ''; }
      if (!target) { target = true; svg.setAttribute('data-music', 'on'); }
      clock(true);
    } else if (target) {
      target = false; svg.removeAttribute('data-music');
      clearTimeout(restTimer);
      restTimer = setTimeout(finish, options.reducedMotion() ? 350 : 1400);
    }
  };
  const sync = () => {
    if (disposed) return;
    const state = options.read(), changedTrack = state.currentId !== lastId;
    lastId = state.currentId;
    if (options.blocked()) { suspend(); return; }
    if (changedTrack && target) changedSource = true;
    if (state.playing && !state.error) {
      if (!changedTrack) changedSource = false;
      clearTimeout(switchTimer); switchTimer = undefined; apply(true);
    } else if (!state.error && target && (changedSource || switchTimer !== undefined)) {
      // A source switch can emit pause before its next actual playing event.
      // Bound this grace period; ordinary same-track user pause reverses now.
      if (switchTimer === undefined) switchTimer = setTimeout(() => {
        switchTimer = undefined; changedSource = false;
        if (!disposed && !options.read().playing) apply(false);
      }, 400);
    } else { clearTimeout(switchTimer); switchTimer = undefined; changedSource = false; apply(false); }
  };
  const unavailable = () => {
    const wasShown = shown; suspend();
    svg?.removeEventListener('transitionend', transitionEnd); svg = undefined;
    if (wasShown && !disposed) options.onUnavailable();
  };
  const load = () => {
    if (disposed) return;
    try {
      const root = object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg' || root.getAttribute('data-rootbeast-music') !== 'rig'
        || root.getAttribute('data-music-version') !== '3') { unavailable(); return; }
      svg?.removeEventListener('transitionend', transitionEnd);
      svg = root as unknown as SVGSVGElement;
      target = false; reset(); clock(false); svg.addEventListener('transitionend', transitionEnd); sync();
    } catch { unavailable(); }
  };
  object.style.visibility = 'hidden';
  const unsubscribe = options.subscribe(sync);
  object.addEventListener('load', load); object.addEventListener('error', unavailable); load();
  return {
    sync, suspend,
    get active() { return active; },
    get visible() { return shown; },
    dispose() {
      disposed = true; unsubscribe(); suspend();
      svg?.removeEventListener('transitionend', transitionEnd); svg = undefined;
      object.removeEventListener('load', load); object.removeEventListener('error', unavailable);
    },
  };
}
