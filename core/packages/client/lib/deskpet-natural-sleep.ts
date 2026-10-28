import { createDrowsyController, type DrowsyOptions, type DrowsyPose } from './deskpet-drowsy';
import { createSleepController, createSleepRenderer } from './deskpet-sleep-in-place';

/** One renderer owns drowsiness and sleep; the host decides when to start. */
export function createDeskPetNaturalSleep(options: {
  object: HTMLObjectElement;
  canStart: () => boolean;
  reducedMotion: () => boolean;
  idle: () => { idleTime: number; gx: number; gy: number };
  onShow: () => void;
  onAwake: () => void;
  onUnavailable: () => void;
  /** Optional deterministic test/preview timing; the site does not set it. */
  timing?: DrowsyOptions['timing'];
}) {
  let renderer: ReturnType<typeof createSleepRenderer> | undefined;
  let drowsy: ReturnType<typeof createDrowsyController> | undefined;
  let sleep: ReturnType<typeof createSleepController> | undefined;
  let disposed = false, shown = false, paused = false;
  let frame: number | undefined, last = performance.now();
  let pose: DrowsyPose | undefined;
  let pendingNotice: { x: number; y: number } | undefined;
  const active = () => !!drowsy?.active || !!sleep?.active;
  const clear = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
  const hide = () => { shown = false; options.object.style.visibility = 'hidden'; };
  const stop = () => { clear(); pendingNotice = undefined; drowsy?.stop(); sleep?.stop(); paused = false; };
  const tick = () => {
    clear();
    if (disposed || paused || !renderer || !active()) return;
    const notice = pendingNotice; pendingNotice = undefined;
    if (notice && drowsy?.active) {
      // Read current geometry once per frame, after any drag/resize, not per event.
      const r = options.object.getBoundingClientRect();
      if (Math.hypot(notice.x - r.left - r.width * .42, (notice.y - r.top - r.height * .59) * 1.25) < r.width * 1.5) {
        drowsy.interact('notice', look(notice.x, notice.y, r));
      }
    }
    const now = performance.now(), elapsed = Math.min(100, Math.max(0, now - last)); last = now;
    // Both delivered controllers cap dt. Bound each step without changing their clocks.
    const steps = Math.max(1, Math.ceil(elapsed / 50));
    for (let i = 0; i < steps; i++) {
      if (drowsy?.active) {
        const next = drowsy.step(elapsed / steps); pose = next.pose;
        renderer.render(next.pose);
        const ready = next.events.find(event => event.type === 'ready-for-bed');
        if (ready?.type === 'ready-for-bed') {
          // Take the exact frame on screen, not a separately constructed ready pose.
          drowsy.stop(); sleep!.start({ from: next.pose });
          renderer.render(sleep!.step(0).pose);
        }
      } else if (sleep?.active) {
        const next = sleep.step(elapsed / steps); pose = next.pose; renderer.render(next.pose);
        if (next.events.some(event => event.type === 'awake')) { options.onAwake(); return; }
      }
    }
    if (active()) frame = requestAnimationFrame(tick);
  };
  const start = (mode: 'drowsy' | 'sleep' | 'asleep') => {
    if (disposed || !renderer || active() || !options.canStart()) return false;
    const reducedMotion = options.reducedMotion();
    drowsy = createDrowsyController({ reducedMotion, timing: options.timing });
    sleep = createSleepController({ reducedMotion });
    drowsy.start(options.idle()); pose = drowsy.step(0).pose;
    if (mode !== 'drowsy') {
      drowsy.stop(); sleep.start(mode === 'asleep' ? { asleep: true } : { from: pose });
      pose = sleep.step(0).pose;
    }
    paused = false; shown = true; last = performance.now();
    options.onShow(); options.object.style.visibility = ''; renderer.render(pose);
    frame = requestAnimationFrame(tick); return true;
  };
  const look = (x: number, y: number, r = options.object.getBoundingClientRect()) => {
    const dx = x - r.left - r.width * .42, dy = y - r.top - r.height * .59, distance = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, distance / 120);
    return { gx: dx / distance * 9 * scale, gy: dy / distance * 7 * scale };
  };
  const wake = (at?: { gx: number; gy: number }) => {
    pendingNotice = undefined;
    if (!active() || !sleep || !pose || disposed) return false;
    if (drowsy?.active) { drowsy.stop(); sleep.start({ from: pose }); }
    const changed = sleep.wake(at);
    if (changed && !paused) { clear(); last = performance.now(); frame = requestAnimationFrame(tick); }
    return changed;
  };
  const load = () => {
    if (disposed) return;
    // A replacement object document must not keep a controller bound to the old rig.
    const wasActive = active(); stop(); renderer = undefined; hide();
    try {
      const root = options.object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg') throw Error('Unavailable sleep rig');
      const svg = root as unknown as SVGSVGElement;
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      renderer = createSleepRenderer(svg);
    } catch { renderer = undefined; }
    if (wasActive) options.onUnavailable();
  };
  const error = () => { const wasActive = active(); stop(); hide(); renderer = undefined; if (wasActive) options.onUnavailable(); };
  options.object.style.visibility = 'hidden';
  options.object.addEventListener('load', load); options.object.addEventListener('error', error); load();
  return {
    get active() { return active(); },
    get visible() { return shown; },
    get ready() { return !!renderer; },
    get mode() { return drowsy?.active ? 'drowsy' : sleep?.phase ?? 'off'; },
    start, wake, stop,
    retire() { if (!active()) hide(); },
    contains(x: number, y: number) {
      if (!shown || !Number.isFinite(x + y)) return false;
      const object = options.object.getBoundingClientRect(), svg = options.object.contentDocument?.documentElement;
      // Exclude empty canvas and snoring marks. These bounds are in the object document's viewport.
      return ['shell', 'L', 'R', 'HL', 'HR', 'tail'].some(name => {
        const r = svg?.querySelector(`[data-hunt="${name}"]`)?.getBoundingClientRect();
        return !!r && r.width > 0 && r.height > 0 && x >= object.left + r.left && x <= object.left + r.right
          && y >= object.top + r.top && y <= object.top + r.bottom;
      });
    },
    tap(x: number, y: number) {
      if (disposed || !active()) return;
      pendingNotice = undefined;
      if (drowsy?.active) drowsy.interact('tap', look(x, y));
      else wake(look(x, y));
    },
    notice(x: number, y: number) {
      if (!drowsy?.active || disposed || paused || !Number.isFinite(x) || !Number.isFinite(y)) return;
      pendingNotice = { x, y };
    },
    pause() { if (!active()) return; pendingNotice = undefined; paused = true; clear(); },
    resume() { if (!active() || !paused || disposed) return; paused = false; last = performance.now(); frame = requestAnimationFrame(tick); },
    dispose() { if (disposed) return; stop(); disposed = true; hide(); renderer = undefined;
      options.object.removeEventListener('load', load); options.object.removeEventListener('error', error); },
  };
}
