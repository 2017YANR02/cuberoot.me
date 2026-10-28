// Full delivered contact range, including the viewport's reachable minimum 358.4.
export const BOTTOM_PEEK_MIN_LINE = 358;
export const BOTTOM_PEEK_MAX_LINE = 500;

export function bottomPeekViewport(width: number, height: number, visual?: {
  width: number; height: number; offsetLeft: number; offsetTop: number;
} | null) {
  if (visual && visual.width > 0 && visual.height > 0
    && Number.isFinite(visual.width + visual.height + visual.offsetLeft + visual.offsetTop)) {
    return { left: visual.offsetLeft, right: visual.offsetLeft + visual.width, bottom: visual.offsetTop + visual.height };
  }
  return { left: 0, right: width, bottom: height };
}

export type BottomPeekGeometry = { x: number; y: number; scaleX: number; scaleY: number; pixelSize: number };

/** Reach the same bottom anchor even when the pointer cannot leave the viewport.
 * Compensation is continuous, confined to the final edge band, and applied only
 * to pointer samples, never as an extra snap after release. */
export function bottomDragReach(pointerY: number, gripY: number, height: number, bottom: number, visibleFraction = .56) {
  if (!Number.isFinite(pointerY + gripY + height + bottom) || height <= 0 || gripY < 0 || gripY > height) return 0;
  const pixel = 1; // The last reachable CSS pixel is bottom - 1, not bottom.
  const extra = Math.max(0, gripY + pixel - height * visibleFraction);
  const band = Math.max(8, Math.min(height * .25, height - gripY));
  const t = Math.max(0, Math.min(1, (pointerY - (bottom - pixel - band)) / band));
  return extra * t * t * (3 - 2 * t);
}

export function bottomPeekLine(
  box: { top: number; left: number; width: number; height: number },
  viewport: { bottom: number; left: number; right: number },
  geometry?: BottomPeekGeometry,
) {
  if (box.height <= 0 || Math.abs(box.width - box.height) > .5) return undefined;
  const map = geometry ?? { x: box.left, y: box.top, scaleX: box.width / 640, scaleY: box.height / 640, pixelSize: 0 };
  if (!(map.scaleX > 0 && map.scaleY > 0) || !Number.isFinite(map.x + map.y + map.scaleX + map.scaleY + map.pixelSize)) return undefined;
  let line = (viewport.bottom - map.y) / map.scaleY;
  // Only forgive a lower-bound mismatch within one physical pixel. Keep the
  // delivered upper limit and side clipping strict; never widen the pose range.
  if (line < BOTTOM_PEEK_MIN_LINE && map.pixelSize > 0
    && (BOTTOM_PEEK_MIN_LINE - line) * map.scaleY <= map.pixelSize) line = BOTTOM_PEEK_MIN_LINE;
  // Below 430 the rig itself braces the paws and raises the body; never move the box.
  if (!Number.isFinite(line) || line < BOTTOM_PEEK_MIN_LINE || line > BOTTOM_PEEK_MAX_LINE) return undefined;
  // Keep both paws and the visible shell within the actual viewport, not a fake border.
  if (map.x + map.scaleX * 56 < viewport.left
    || map.x + map.scaleX * 524 > viewport.right) return undefined;
  return line;
}

export function createBottomPeekRenderer(options: {
  object: HTMLObjectElement;
  reducedMotion: () => boolean;
  onShow: () => void;
  onRest: () => void;
  onUnavailable: () => void;
  onPhase: (phase: 'peeking' | 'releasing' | undefined) => void;
}) {
  const object = options.object;
  let svg: SVGSVGElement | undefined;
  let phase: 'peeking' | 'releasing' | undefined;
  let shown = false, disposed = false, suspended = false;
  let contactLine: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { clearTimeout(timer); timer = undefined; };
  const setPhase = (next: typeof phase) => { phase = next; options.onPhase(next); };
  const motion = () => {
    if (options.reducedMotion()) svg?.setAttribute('data-peek-motion', 'reduce');
    else svg?.removeAttribute('data-peek-motion');
  };
  const finish = () => {
    if (disposed || phase !== 'releasing') return;
    stop(); setPhase(undefined); options.onRest();
  };
  const hide = () => {
    stop(); suspended = false; setPhase(undefined); svg?.setAttribute('data-peek', 'off');
    shown = false; object.style.visibility = 'hidden';
  };
  const unavailable = () => {
    const visible = shown; hide(); svg = undefined;
    if (visible && !disposed) options.onUnavailable();
  };
  const load = () => {
    if (disposed) return;
    try {
      const root = object.contentDocument?.documentElement;
      if (!root || root.localName !== 'svg' || root.getAttribute('data-rootbeast-peek') !== 'rig') { unavailable(); return; }
      svg = root as unknown as SVGSVGElement;
      // The inline preview sizes the SVG root itself. Do the same inside the
      // object document so its viewBox maps to the actual pet viewport, not 320px.
      svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
      if (contactLine !== undefined) svg.style.setProperty('--peek-y', contactLine.toFixed(6));
      // contentDocument can be ready before the object's final load event.
      // A repeated load must not turn off an already-entered pose.
      svg.setAttribute('data-peek', phase === 'peeking' ? 'on' : 'off'); motion();
    } catch { unavailable(); }
  };
  const line = (value: number, ease: boolean) => {
    if (!svg || value < BOTTOM_PEEK_MIN_LINE || value > BOTTOM_PEEK_MAX_LINE || !Number.isFinite(value)) return false;
    contactLine = value;
    if (ease) svg.setAttribute('data-peek-line', 'ease'); else svg.removeAttribute('data-peek-line');
    svg.style.setProperty('--peek-y', value.toFixed(6)); return true;
  };
  object.style.visibility = 'hidden';
  object.addEventListener('load', load); object.addEventListener('error', unavailable); load();
  return {
    get ready() { return !!svg; },
    get active() { return !!phase; },
    get peeking() { return phase === 'peeking'; },
    get visible() { return shown; },
    get document() { return svg; },
    get contactLine() { return contactLine; },
    suspend(value?: number) {
      if (!svg || (value !== undefined && !line(value, false))) return;
      stop(); setPhase('peeking'); svg.setAttribute('data-peek', 'on');
      suspended = true; shown = false; object.style.visibility = 'hidden';
    },
    resume(value: number) {
      if (!svg || !line(value, false)) return false;
      stop(); suspended = false; motion(); setPhase('peeking');
      svg.setAttribute('data-peek', 'on'); shown = true;
      options.onShow(); object.style.visibility = ''; return true;
    },
    geometry(pixelSize: number): BottomPeekGeometry | undefined {
      if (!svg || disposed || !(pixelSize > 0 && Number.isFinite(pixelSize))) return undefined;
      try {
        const box = object.getBoundingClientRect(), bounds = svg.getBoundingClientRect(), matrix = svg.getScreenCTM();
        if (!(box.width > 0 && box.height > 0 && bounds.width > 0 && bounds.height > 0)
          || !matrix || matrix.b !== 0 || matrix.c !== 0 || !(matrix.a > 0 && matrix.d > 0)) return undefined;
        return { x: box.left + matrix.e, y: box.top + matrix.f, scaleX: matrix.a, scaleY: matrix.d, pixelSize };
      } catch { return undefined; }
    },
    enter(value: number) {
      if (disposed || !line(value, shown)) return false;
      stop(); suspended = false; motion(); setPhase('peeking');
      if (!shown) {
        // Match Claude's preview: establish the off pose before the first on
        // style change. Hidden/just-loaded documents may not have resolved it.
        // Never snap a visible release that is being reversed midway.
        const transition = svg!.style.getPropertyValue('transition');
        const priority = svg!.style.getPropertyPriority('transition');
        svg!.style.setProperty('transition', 'none');
        svg!.setAttribute('data-peek', 'off');
        svg!.ownerDocument.defaultView?.getComputedStyle(svg!).getPropertyValue('--pk');
        if (transition) svg!.style.setProperty('transition', transition, priority);
        else svg!.style.removeProperty('transition');
        shown = true; options.onShow(); object.style.visibility = '';
      }
      svg!.setAttribute('data-peek', 'on'); return true;
    },
    updateLine(value: number) { return line(value, false); },
    release() {
      if (disposed || suspended || !phase || !svg) return;
      stop(); motion(); setPhase('releasing'); svg.setAttribute('data-peek', 'off');
      timer = setTimeout(finish, options.reducedMotion() ? 120 : 340);
    },
    hide,
    dispose() {
      disposed = true; hide(); svg = undefined;
      object.removeEventListener('load', load); object.removeEventListener('error', unavailable);
    },
  };
}
