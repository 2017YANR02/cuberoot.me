/** Opt-in, bounded scroll evidence. No network calls or page/input text capture. */
export type ScrollDiagnosticMode = 'original' | 'lighter' | 'no-blur' | 'no-image';
export const SCROLL_DIAGNOSTIC_ATTRIBUTE = 'data-scroll-diagnostic';
const MAX_GESTURES = 100;
const MAX_FRAMES = 6000;

export interface GestureEvidence {
  startMs: number; durationMs: number; dx: number; dy: number; moves: number;
  scrollTravel: number; availableUp: number; availableDown: number;
  cancelled: boolean; multiTouch: boolean; prevented: boolean;
  interactive: boolean; touchAction: string; target: string;
}

/** A clue, never a diagnosis: exclude taps, horizontal controls and page edges. */
export function isUnmovedSwipe(g: GestureEvidence): boolean {
  const room = g.dy < 0 ? g.availableDown : g.availableUp;
  return !g.multiTouch && !g.interactive && !g.cancelled
    && !/none|pan-x/.test(g.touchAction)
    && Math.abs(g.dy) >= 30 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3
    && room > 5 && g.scrollTravel < 2;
}

export function summarizeFrameGaps(gaps: readonly number[]) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const at = (p: number) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
  return { samples: gaps.length, medianMs: at(.5), p95Ms: at(.95), maxMs: sorted.at(-1) ?? null,
    over50Ms: gaps.filter(ms => ms > 50).length, over100Ms: gaps.filter(ms => ms > 100).length };
}

function describe(element: Element) {
  // CSS identifiers only; never id, label, textContent, href or form values.
  return `${element.tagName.toLowerCase()}${[...element.classList].filter(c => /^[a-zA-Z_-][\w-]{0,45}$/.test(c)).slice(0,3).map(c => `.${c}`).join('')}`;
}
function round(n: number) { return Math.round(n * 10) / 10; }
function filterOf(s: CSSStyleDeclaration) { return s.getPropertyValue('backdrop-filter') || s.getPropertyValue('-webkit-backdrop-filter'); }

function snapshot() {
  const root = document.documentElement;
  const body = getComputedStyle(document.body);
  const image = document.querySelector<HTMLImageElement>('.site-scenery img');
  const surfaces: { target: string; pseudo: string; filter: string; width: number; height: number }[] = [];
  // Setup-only style reads, never in touchmove/rAF. Bound pathological DOMs.
  const elements = [...document.querySelectorAll('body *')];
  let visibleGlass = 0;
  for (const element of elements.slice(0, 5000)) {
    if (element.closest('[data-scroll-diagnostic-ui]')) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) continue;
    for (const pseudo of ['', '::before', '::after']) {
      const s = getComputedStyle(element, pseudo || null);
      const filter = filterOf(s);
      if (!filter || filter === 'none' || s.visibility === 'hidden' || s.display === 'none'
        || (pseudo && (s.content === 'none' || s.content === 'normal'))) continue;
      visibleGlass++;
      if (surfaces.length < 40) surfaces.push({target: describe(element), pseudo, filter, width: round(rect.width), height: round(rect.height)});
    }
  }
  return { pathname: location.pathname, theme: root.dataset.theme ?? 'system', palette: root.dataset.palette ?? null,
    contrast: root.dataset.contrast ?? 'normal', scene: document.body.dataset.siteScenery ?? null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scale: window.visualViewport?.scale ?? 1,
      scrollX, scrollY, documentHeight: document.scrollingElement?.scrollHeight ?? 0,
      visualHeight: window.visualViewport?.height ?? null, visualOffsetTop: window.visualViewport?.offsetTop ?? null },
    image: image ? { width: image.naturalWidth, height: image.naturalHeight, loaded: image.complete && image.naturalWidth > 0 } : null,
    material: { blur: body.getPropertyValue('--glass-filter').trim(), surface: body.getPropertyValue('--glass-surface-bg').trim(),
      popover: body.getPropertyValue('--glass-popover-bg').trim(), refraction: body.getPropertyValue('--site-glass-refraction').trim(),
      sceneryOverlay: image ? getComputedStyle(image.parentElement!, '::after').backgroundImage : null },
    rootStyles: { overflow: body.overflow, touchAction: body.touchAction, filter: body.filter },
    visibleGlass, surfaces, inventoryTruncated: elements.length > 5000 || visibleGlass > surfaces.length };
}

export interface ScrollDiagnosticReport {
  version: 1; mode: ScrollDiagnosticMode; startedAt: string; durationMs: number; stopReason: string;
  userAgent: string; environment: ReturnType<typeof snapshot>; setupMs: number;
  supportedEntries: string[]; observedEntries: string[];
  frames: ReturnType<typeof summarizeFrameGaps>; activeFrames: ReturnType<typeof summarizeFrameGaps>;
  gapsOver50: {atMs: number; gapMs: number; active: boolean}[];
  gestures: GestureEvidence[]; unmovedSwipes: number; scrollEvents: number; wheelEvents: number;
  pointerCancels: number; viewportResizes: number; marks: number[]; truncated: boolean;
  performanceEntries: { type: string; atMs: number; durationMs: number }[];
}

export function startScrollDiagnostic(mode: ScrollDiagnosticMode, onStop: (report: ScrollDiagnosticReport) => void) {
  const setupStart = performance.now();
  const oldMode = document.body.getAttribute(SCROLL_DIAGNOSTIC_ATTRIBUTE);
  document.body.setAttribute(SCROLL_DIAGNOSTIC_ATTRIBUTE, mode);
  const environment = snapshot();
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const frames: number[] = [], activeFrames: number[] = [];
  const gapsOver50: ScrollDiagnosticReport['gapsOver50'] = [];
  const gestures: GestureEvidence[] = [];
  const entries: ScrollDiagnosticReport['performanceEntries'] = [];
  const marks: number[] = [];
  const supported = typeof PerformanceObserver === 'undefined' ? [] : [...(PerformanceObserver.supportedEntryTypes ?? [])];
  const observed: string[] = [];
  const observers: PerformanceObserver[] = [];
  let ended = false, lastFrame = 0, lastActivity = -Infinity, frameId = 0;
  let scrollEvents = 0, wheelEvents = 0, pointerCancels = 0, viewportResizes = 0, truncated = false;
  type Active = { evidence: GestureEvidence; id: number; x: number; y: number;
    containers: { element: Element; last: number }[] };
  let active: Active | null = null;
  let settling: { gesture: Active; until: number } | null = null;
  const elapsed = () => round(performance.now() - start);
  const onUI = (target: EventTarget | null) => target instanceof Element && !!target.closest('[data-scroll-diagnostic-ui]');
  const sampleScroll = () => {
    // Native scrolling can reach the main thread just after touchend.
    if (settling && performance.now() > settling.until) settling = null;
    const gesture = active ?? settling?.gesture;
    if (!gesture) return;
    for (const item of gesture.containers) {
      const top = item.element.scrollTop;
      gesture.evidence.scrollTravel = round(gesture.evidence.scrollTravel + Math.abs(top - item.last));
      item.last = top;
    }
  };
  const finishGesture = (cancelled: boolean) => {
    if (!active) return;
    sampleScroll();
    const g = active.evidence;
    g.durationMs = elapsed() - g.startMs;
    g.cancelled = cancelled;
    g.scrollTravel = round(g.scrollTravel);
    if (gestures.length < MAX_GESTURES) gestures.push(g); else truncated = true;
    settling = { gesture: active, until: performance.now() + 250 };
    active = null;
  };
  const onStart = (event: TouchEvent) => {
    if (onUI(event.target)) return;
    if (active) { active.evidence.multiTouch = true; return; }
    sampleScroll(); settling = null;
    const touch = event.changedTouches[0];
    const target = event.target instanceof Element ? event.target : document.body;
    if (!touch) return;
    const containers: Active['containers'] = [];
    let node: Element | null = target, touchAction = '';
    while (node) {
      const style = getComputedStyle(node);
      if (style.touchAction && style.touchAction !== 'auto') touchAction += ` ${style.touchAction}`;
      if (node === document.scrollingElement || (/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight)) {
        containers.push({element: node, last: node.scrollTop});
      }
      node = node.parentElement;
    }
    const root = document.scrollingElement;
    if (root && !containers.some(c => c.element === root)) containers.push({element: root, last: root.scrollTop});
    const g: GestureEvidence = {startMs: elapsed(), durationMs: 0, dx: 0, dy: 0, moves: 0, scrollTravel: 0,
      availableUp: Math.max(0, ...containers.map(c => c.last)),
      availableDown: Math.max(0, ...containers.map(c => c.element.scrollHeight - c.element.clientHeight - c.last)),
      cancelled: false, multiTouch: event.touches.length > 1, prevented: false,
      interactive: !!target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]'),
      target: describe(target), touchAction: touchAction.trim() || 'auto'};
    active = {evidence:g, id:touch.identifier, x:touch.clientX, y:touch.clientY, containers};
    lastActivity = performance.now();
    queueMicrotask(() => { g.prevented ||= event.defaultPrevented; });
  };
  const onMove = (event: TouchEvent) => {
    if (!active) return;
    const touch = [...event.touches].find(t => t.identifier === active!.id);
    if (!touch) return;
    const g = active.evidence;
    const dx = touch.clientX - active.x, dy = touch.clientY - active.y;
    // Keep the largest excursion, so a swipe out and back does not become a tap.
    if (Math.abs(dx) > Math.abs(g.dx)) g.dx = round(dx);
    if (Math.abs(dy) > Math.abs(g.dy)) g.dy = round(dy);
    g.moves++; g.multiTouch ||= event.touches.length > 1;
    lastActivity = performance.now();
    queueMicrotask(() => { g.prevented ||= event.defaultPrevented; });
  };
  const onEnd = (event: TouchEvent) => {
    if (active && [...event.changedTouches].some(t => t.identifier === active!.id)) {
      finishGesture(event.type === 'touchcancel'); lastActivity = performance.now();
    }
  };
  const onScroll = (event: Event) => { if (!onUI(event.target)) { scrollEvents++; lastActivity = performance.now(); sampleScroll(); } };
  const onWheel = (event: Event) => { if (!onUI(event.target)) { wheelEvents++; lastActivity = performance.now(); } };
  const onPointerCancel = (event: Event) => { if (!onUI(event.target)) pointerCancels++; };
  const onResize = () => { viewportResizes++; };
  const listeners: [string, EventListener][] = [
    ['touchstart', onStart as EventListener], ['touchmove', onMove as EventListener],
    ['touchend', onEnd as EventListener], ['touchcancel', onEnd as EventListener],
    ['scroll', onScroll], ['wheel', onWheel], ['pointercancel', onPointerCancel],
  ];
  for (const [type, listener] of listeners) document.addEventListener(type, listener, {passive:true, capture:true});
  for (const type of ['longtask', 'long-animation-frame', 'event']) {
    if (!supported.includes(type)) continue;
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.startTime < start || ended) continue;
          if (type === 'event' && onUI((entry as PerformanceEventTiming).target)) continue;
          if (entries.length < 150) entries.push({type, atMs:round(entry.startTime-start), durationMs:round(entry.duration)});
          else truncated = true;
        }
      });
      observer.observe({type, buffered:false}); observers.push(observer); observed.push(type);
    } catch { /* Keep unsupported or rejected entry types explicit in the report. */ }
  }
  const stop = (reason = 'manual') => {
    if (ended) return;
    sampleScroll(); finishGesture(true); ended = true;
    cancelAnimationFrame(frameId); clearTimeout(timer);
    for (const [type, listener] of listeners) document.removeEventListener(type, listener, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.visualViewport?.removeEventListener('resize', onResize);
    for (const observer of observers) observer.disconnect();
    if (oldMode === null) document.body.removeAttribute(SCROLL_DIAGNOSTIC_ATTRIBUTE);
    else document.body.setAttribute(SCROLL_DIAGNOSTIC_ATTRIBUTE, oldMode);
    onStop({version:1, mode, startedAt, durationMs:elapsed(), stopReason:reason, userAgent:navigator.userAgent,
      environment, setupMs:round(start-setupStart), supportedEntries:supported, observedEntries:observed,
      frames:summarizeFrameGaps(frames), activeFrames:summarizeFrameGaps(activeFrames), gapsOver50,
      gestures, unmovedSwipes:gestures.filter(isUnmovedSwipe).length, scrollEvents, wheelEvents, pointerCancels,
      viewportResizes, marks, truncated, performanceEntries:entries});
  };
  const onVisibility = () => { if (document.hidden) stop('hidden'); };
  const onPageHide = () => stop('pagehide');
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.visualViewport?.addEventListener('resize', onResize);
  const frame = (time: number) => {
    if (ended) return;
    if (location.pathname !== environment.pathname) { stop('navigation'); return; }
    if (document.hidden) { stop('hidden'); return; }
    sampleScroll();
    if (lastFrame) {
      const gap = round(time-lastFrame), interacting = !!active || performance.now()-lastActivity < 1000;
      if (frames.length < MAX_FRAMES) { frames.push(gap); if (interacting) activeFrames.push(gap); } else truncated = true;
      if (gap > 50 && gapsOver50.length < 150) gapsOver50.push({atMs:round(time-start),gapMs:gap,active:interacting});
    }
    lastFrame = time; frameId = requestAnimationFrame(frame);
  };
  const timer = setTimeout(() => stop('timeout'), 30_000);
  frameId = requestAnimationFrame(frame);
  return {stop, mark: () => { if (!ended && marks.length < 30) marks.push(elapsed()); }};
}
