import {
  createHangPlayController, createHangPlayRenderer, hangSettled, readHangLoop,
  type HangPlayEnv,
} from './deskpet-hang-play';

/** Passive offsets on the existing hang document. Never moves its host or tail. */
export function createDeskPetHangInteraction(options: {
  object: HTMLObjectElement;
  box: () => HangPlayEnv['box'];
  enabled: () => boolean;
  interruption: () => NonNullable<HangPlayEnv['stop']> | null;
}) {
  const brain = createHangPlayController();
  let renderer: ReturnType<typeof createHangPlayRenderer> | undefined;
  let svg: SVGSVGElement | undefined, disposed = false;
  let frame: number | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let last = performance.now(), lastPointer = -Infinity;
  let mouse: { x: number; y: number } | undefined;
  let requested: HangPlayEnv['stop'] = null;
  let lastBox: HangPlayEnv['box'] = { left: 0, top: 0, width: 640 };
  let lastLoop: HangPlayEnv['loop'] = { hc: 0, hb: 0, hsw: 0, hm: 1 };
  const clear = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timer); frame = undefined; timer = undefined;
  };
  const near = (box: HangPlayEnv['box']) => !!mouse && Math.hypot(
    mouse.x - box.left - box.width * .61, (mouse.y - box.top - box.width * .7) * 1.25,
  ) < box.width * 1.5;
  const tick = () => {
    if (disposed) return;
    clear();
    const now = performance.now(), elapsed = Math.min(250, Math.max(0, now - last)); last = now;
    const enabled = !!renderer && options.enabled();
    const stop = options.interruption();
    // Hard interrupts must win even during the brief drag-pose handoff.
    const interruption = stop === 'hard' ? stop : requested ?? stop;
    if (!brain.active && (!enabled || interruption)) { renderer?.reset(); requested = null; return; }
    const box = options.box();
    if (box.width > 0 && Number.isFinite(box.left + box.top + box.width)) lastBox = box;
    else if (!interruption) return;
    if (svg) { try { lastLoop = readHangLoop(svg); } catch { /* Last valid loop is sufficient to reset safely. */ } }
    const canStart = enabled && hangSettled(lastLoop);
    const count = brain.active ? 1 : Math.max(1, Math.ceil(elapsed / 50));
    for (let i = 0; i < count; i++) {
      const next = brain.step(interruption === 'hard' ? 0 : elapsed / count,
        { box: lastBox, loop: lastLoop, canStart, stop: interruption });
      if (next.active || next.events.some(event => event.type === 'end')) renderer?.render(next.pose);
      if (next.events.some(event => event.type === 'end')) {
        renderer?.reset(); requested = null;
        if (enabled && !interruption && near(lastBox)) timer = setTimeout(tick, 250);
        return;
      }
    }
    if (brain.active) frame = requestAnimationFrame(tick);
    else if (enabled && near(lastBox)) timer = setTimeout(tick, 250);
  };
  const stop = (kind: NonNullable<HangPlayEnv['stop']>) => {
    if (disposed) return;
    if (kind === 'hard') { brain.leave(); brain.busy(); }
    if (!brain.active) { clear(); renderer?.reset(); requested = null; return; }
    // A later soft request cannot turn a drag handoff back into watching.
    if (kind === 'hard' || requested !== 'drag') requested = kind;
    tick();
  };
  const load = () => {
    if (disposed) return;
    stop('hard'); renderer = undefined; svg = undefined;
    try {
      const element = options.object.contentDocument?.documentElement;
      if (!element || element.localName !== 'svg' || element.getAttribute('data-rootbeast-hang') !== 'rig'
        || element.getAttribute('data-hang-play') !== '1') return;
      svg = element as unknown as SVGSVGElement;
      // Map the 640-unit coordinate system to this object's actual CSS size.
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      renderer = createHangPlayRenderer(svg); renderer.reset();
    } catch { svg = undefined; renderer = undefined; }
  };
  const error = () => { stop('hard'); renderer = undefined; svg = undefined; };
  options.object.addEventListener('load', load); options.object.addEventListener('error', error); load();
  return {
    get active() { return brain.active; },
    get ready() { return !!renderer; },
    get mode() { return brain.mode; },
    pointer(x: number, y: number) {
      if (disposed || !Number.isFinite(x + y)) return;
      mouse = { x, y }; brain.pointer(x, y);
      if (brain.active) return;
      if (!renderer || !options.enabled()) { clear(); last = performance.now(); return; }
      const now = performance.now();
      if (now - lastPointer >= 16) { lastPointer = now; tick(); }
    },
    leave() { mouse = undefined; brain.leave(); if (brain.active) tick(); else clear(); },
    busy() { brain.busy(); if (brain.active) tick(); else clear(); },
    stop,
    dispose() {
      if (disposed) return;
      stop('hard'); disposed = true; clear(); renderer = undefined; svg = undefined;
      options.object.removeEventListener('load', load); options.object.removeEventListener('error', error);
    },
  };
}
