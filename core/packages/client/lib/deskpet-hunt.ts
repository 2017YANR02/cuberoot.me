import { createHuntRenderer, createMouseHuntController, PS, type HuntEnv, type HuntPose } from './deskpet-mouse-hunt';
import { createBottomEmergeController, type EmergeFrame, type PeekLoopState } from './deskpet-bottom-emerge';

/** Host adapter for Claude's unchanged controller/rig. No input capture or focus. */
export function createDeskPetHunt(options: {
  object: HTMLObjectElement;
  box: () => HuntEnv['box'];
  travel: (box: HuntEnv['box']) => HuntEnv['travel'];
  canStart: () => boolean;
  interruption: () => 'soft' | 'hard' | null;
  idle: () => NonNullable<HuntEnv['idle']>;
  onStart: () => void;
  onTravel: (pixels: number, bodyOffset: number) => void;
  onCommit: (pixels: number) => void;
  onRest: () => void;
  bottom?: {
    peek: () => { line: number; loop: () => PeekLoopState | null } | undefined;
    canStart: () => boolean;
    suspend: (line: number) => void;
    restore: (line: number) => boolean;
    clear: () => void;
    onLift: (pixels: number) => void;
    onCommitLift: (pixels: number) => void;
    onDragRest: () => void;
  };
}) {
  const brain = createMouseHuntController();
  const emerge = createBottomEmergeController();
  let renderer: ReturnType<typeof createHuntRenderer> | undefined;
  let disposed = false, shown = false, last = performance.now(), lastPointerStep = -Infinity;
  let frame: number | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let committedBox: HuntEnv['box'] | undefined;
  let mouse: { x: number; y: number } | undefined;
  let requested: 'soft' | 'hard' | null = null, pending: (() => void) | undefined;
  let travel = 0;
  let lift = 0, emergeBox: HuntEnv['box'] | undefined, bottomLine: number | undefined;
  let fromBottom = false, lastPose: HuntPose | undefined;
  let grabPending = false;
  const active = () => brain.active || emerge.active;
  const clear = () => { if (frame !== undefined) cancelAnimationFrame(frame); clearTimeout(timer); frame = undefined; timer = undefined; };
  const near = (box: HuntEnv['box']) => !!mouse && Math.hypot(mouse.x - box.left - box.width * .42,
    (mouse.y - box.top - box.width * .59) * 1.25) < box.width * (options.bottom?.peek() ? 2.4 : 1.8);
  const environment = (box: HuntEnv['box']): HuntEnv => {
    const bounds = options.travel(box);
    if (fromBottom) {
      // Leave enough room for both paws when this round lies back down.
      bounds.min = Math.max(bounds.min, -box.left - 56 / 640 * box.width);
      bounds.max = Math.min(bounds.max, document.documentElement.clientWidth - box.left - 524 / 640 * box.width);
    }
    const canStart = !!renderer && options.canStart() && bounds.min <= 0 && bounds.max >= 0;
    return { box, travel: bounds, canStart, stop: requested ?? options.interruption(),
      idle: !brain.active && canStart && near(box) ? options.idle() : undefined };
  };
  const hide = () => { shown = false; options.object.style.visibility = 'hidden'; };
  const show = () => { shown = true; options.onStart(); options.object.style.visibility = ''; };
  const commitLift = (pixels: number) => { options.bottom?.onCommitLift(pixels); lift = 0; };
  const finishAction = (resume: boolean) => {
    const after = pending; pending = undefined;
    requested = null; grabPending = false; emergeBox = undefined;
    if (resume && !disposed) { after?.(); options.onRest(); }
  };
  const applyEmerge = (next: EmergeFrame) => {
    lastPose = next.pose;
    for (const event of next.events) {
      if (event.type === 'start') {
        if (event.anchorDropPx) {
          options.bottom?.onCommitLift(-event.anchorDropPx);
          emergeBox = options.box();
        }
        options.bottom?.suspend(bottomLine!); show();
      }
      if (event.type === 'yield') {
        commitLift(event.liftPx); emergeBox = options.box(); options.bottom?.clear();
      }
      if (event.type === 'handoff') {
        commitLift(event.liftPx); options.bottom?.clear();
        emergeBox = undefined; committedBox = options.box(); fromBottom = true;
        const env = environment(committedBox);
        env.canStart = !!renderer && !!options.bottom?.canStart();
        env.stop = requested ?? options.interruption(); env.idle = event.idle; env.engage = event.engage;
        const first = brain.step(0, env);
        if (first.active) { lastPose = first.pose; renderer?.render(first.pose); options.onTravel(first.travelPx, 0); }
        else {
          committedBox = undefined; fromBottom = false;
          if (!resumeBottom(next.pose)) { options.onCommit(0); finishAction(true); }
        }
        return;
      }
      if (event.type === 'end') {
        options.onCommit(0); commitLift(event.liftPx);
        fromBottom = false;
        if (event.to === 'peek' && bottomLine !== undefined) {
          hide();
          if (!options.bottom?.restore(bottomLine)) options.bottom?.clear();
          finishAction(true);
        } else {
          options.bottom?.clear();
          if (event.to === 'hard') hide();
          finishAction(event.to !== 'hard');
          if (event.to === 'drag') options.bottom?.onDragRest();
        }
        return;
      }
    }
    if (next.active) {
      renderer?.render(next.pose); lift = next.liftPx;
      options.bottom?.onLift(lift);
    }
  };
  const resumeBottom = (pose: HuntPose) => {
    if (!options.bottom || bottomLine === undefined || !options.bottom.canStart()) return false;
    const box = options.box(), bounds = options.travel(box);
    if (bounds.min > 0 || bounds.max < 0 || box.left + 56 / 640 * box.width < 0
      || box.left + 524 / 640 * box.width > document.documentElement.clientWidth) return false;
    emergeBox = box;
    const next = emerge.step(0, { box, line: bottomLine, canStart: true, resume: { line: bottomLine, from: pose } });
    applyEmerge(next); return next.active;
  };
  const end = (pixels: number, resume: boolean) => {
    clear(); options.onCommit(pixels); travel = 0; committedBox = undefined; requested = null;
    const returning = fromBottom && resume && !pending && lastPose && resumeBottom(lastPose);
    fromBottom = false;
    if (returning) { frame = requestAnimationFrame(() => tick()); return; }
    // Keep the settled vector until the next pose has decoded. Hard actions
    // own their fallback immediately; they must never wait for this handoff.
    if (!resume) hide();
    const after = pending; pending = undefined;
    if (resume && !disposed) { after?.(); options.onRest(); }
  };
  const tick = (forced?: 'hard') => {
    if (disposed) return;
    clear();
    const now = performance.now(), elapsed = Math.min(250, Math.max(0, now - last)); last = now;
    const box = committedBox ?? emergeBox ?? options.box();
    if (!(box.width > 0 && Number.isFinite(box.left + box.top + box.width))) return;
    const env = environment(box); if (forced) env.stop = forced;
    const peek = options.bottom?.peek();
    if (emerge.active || (!brain.active && renderer && peek && options.bottom?.canStart())) {
      const count = emerge.active || forced ? 1 : Math.max(1, Math.ceil(elapsed / 50));
      for (let i = 0; i < count; i++) {
        const next = emerge.step(forced ? 0 : elapsed / count, { box: emergeBox ?? box,
          line: emerge.active ? bottomLine ?? 0 : peek?.line ?? 0, canStart: !active() && !!peek && !!options.bottom?.canStart(),
          stop: forced ?? (grabPending ? 'drag' : requested ?? options.interruption()), loop: peek?.loop });
        if (next.events.some(event => event.type === 'start')) { bottomLine = peek!.line; emergeBox = box; }
        applyEmerge(next);
        if (next.events.length) break;
      }
      if (active()) frame = requestAnimationFrame(() => tick());
      else if (peek && near(box)) timer = setTimeout(() => tick(), 250);
      return;
    }
    // Controller caps dt at 50ms. Catch up the 250ms dormant poll in bounded
    // substeps, rather than silently making its timers run five times slower.
    const count = brain.active || forced ? 1 : Math.max(1, Math.ceil(elapsed / 50));
    for (let i = 0; i < count; i++) {
      const next = brain.step(forced ? 0 : elapsed / count, env);
      if (next.events.some(event => event.type === 'start')) {
        committedBox = box; show();
      }
      const finished = next.events.find(event => event.type === 'end');
      if (finished?.type === 'end') { if (env.stop) fromBottom = false; end(finished.travelPx, env.stop !== 'hard'); return; }
      if (next.active && renderer) {
        lastPose = next.pose; renderer.render(next.pose); travel = next.travelPx;
        options.onTravel(travel, next.pose.body.ry * PS * box.width / 640);
      }
    }
    if (brain.active) frame = requestAnimationFrame(() => tick());
    else if (renderer && env.canStart && near(box)) timer = setTimeout(() => tick(), 250);
  };
  const stop = (kind: 'soft' | 'hard', after?: () => void) => {
    if (disposed) return;
    if (!active()) { clear(); if (kind === 'hard') { brain.leave(); brain.busy(); emerge.leave(); emerge.busy(); pending = undefined; fromBottom = false; hide(); } after?.(); return; }
    requested = kind; pending = kind === 'hard' ? undefined : after;
    if (kind === 'hard') { brain.leave(); brain.busy(); emerge.leave(); emerge.busy(); fromBottom = false; tick('hard'); }
    else tick();
  };
  const load = () => {
    if (disposed) return;
    // A repeated load must not retain a controller posed against a new document.
    const wasActive = active();
    if (wasActive) stop('hard');
    try {
      const root = options.object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg' || root.getAttribute('data-rootbeast-hunt') !== 'rig'
        || root.getAttribute('data-hunt-version') !== '1') throw Error('Unavailable hunt rig');
      const svg = root as unknown as SVGSVGElement;
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      renderer = createHuntRenderer(svg); hide();
    } catch { renderer = undefined; hide(); }
    if (wasActive) options.onRest();
  };
  const error = () => { stop('hard'); renderer = undefined; hide(); options.onRest(); };
  options.object.style.visibility = 'hidden';
  options.object.addEventListener('load', load); options.object.addEventListener('error', error); load();
  return {
    get active() { return active(); },
    get emerging() { return emerge.active; },
    get phase() { return emerge.active ? emerge.phase : brain.mode; },
    get visible() { return shown; },
    get ready() { return !!renderer; },
    retire() { if (!active()) hide(); },
    grab() {
      if (!emerge.active) { stop('hard'); return; }
      clear(); pending = undefined; requested = null; fromBottom = false;
      grabPending = true;
      // yield commits the current lift before DeskPet samples its drag anchor.
      tick();
    },
    pointer(x: number, y: number) {
      if (disposed || !Number.isFinite(x + y)) return;
      mouse = { x, y }; brain.pointer(x, y); emerge.pointer(x, y);
      const now = performance.now();
      if (!active() && (!renderer || (!options.canStart() && !(options.bottom?.peek() && options.bottom.canStart())))) { clear(); last = now; return; }
      if (!active() && now - lastPointerStep >= 16) { lastPointerStep = now; tick(); }
    },
    busy() { brain.busy(); emerge.busy(); if (active()) tick(); else clear(); },
    leave() { mouse = undefined; brain.leave(); emerge.leave(); if (active()) tick(); else clear(); },
    stop,
    dispose() {
      if (disposed) return;
      stop('hard'); disposed = true; clear(); pending = undefined;
      // A hard interruption already commits travel; retain no stale translation.
      if (travel) options.onCommit(travel);
      hide(); renderer = undefined;
      options.object.removeEventListener('load', load); options.object.removeEventListener('error', error);
    },
  };
}
