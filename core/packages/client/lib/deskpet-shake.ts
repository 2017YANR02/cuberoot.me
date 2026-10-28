/** Gesture detection and recovery timing only. No artwork or position animation. */
export const DESKPET_SHAKE_DEFAULTS = Object.freeze({
  windowMs: 900,
  minLegPx: 24,
  legWidthRatio: .14,
  minTravelPx: 144,
  travelWidthRatio: .85,
  minSpeedPxPerSecond: 650,
  minReversals: 3,
  reverseCosine: .55,
  stopGapMs: 280,
  recoveryMs: 3000,
  reentryMs: 180,
});
export type DeskPetShakeConfig = { -readonly [Key in keyof typeof DESKPET_SHAKE_DEFAULTS]: number };
export interface ShakePoint { x: number; y: number; t: number }
export type ShakePhase = 'idle' | 'dizzy' | 'recovering';
export interface ShakeSnapshot {
  phase: ShakePhase;
  /** Continuous envelope, including when rapid shaking resumes during recovery. */
  level: number;
  recoveryProgress: number;
  /** The future SVG adapter must use static feedback instead of swirling. */
  reducedMotion: boolean;
}
export interface ShakeClock {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
}
const smooth = (t: number) => { const p = Math.min(1, Math.max(0, t)); return p * p * (3 - 2 * p); };

/** Confirm a reversal only after traversing a full leg back from its extreme. */
export function createShakeDetector(overrides: Partial<DeskPetShakeConfig> = {}) {
  const config = { ...DESKPET_SHAKE_DEFAULTS, ...overrides };
  let origin: ShakePoint | undefined;
  let extreme: ShakePoint | undefined;
  let last: ShakePoint | undefined;
  let direction: { x: number; y: number } | undefined;
  let turns: { t: number; distance: number }[] = [];
  let width = 0;
  const reset = () => { origin = extreme = last = undefined; direction = undefined; turns = []; };
  const start = (point: ShakePoint, petWidth: number) => {
    reset();
    if (![point.x, point.y, point.t].every(Number.isFinite)) return;
    width = Number.isFinite(petWidth) ? Math.max(0, petWidth) : 0;
    origin = extreme = last = point;
  };
  const move = (point: ShakePoint) => {
    if (![point.x, point.y, point.t].every(Number.isFinite)) return false;
    if (!last || !origin || !extreme) return false;
    if (point.t <= last.t) return false;
    if (point.t - last.t > config.windowMs) { start(point, width); return false; }
    last = point;
    const leg = Math.max(config.minLegPx, width * config.legWidthRatio);
    if (!direction) {
      const dx = point.x - origin.x, dy = point.y - origin.y, distance = Math.hypot(dx, dy);
      if (distance < leg) return false;
      direction = { x: dx / distance, y: dy / distance }; extreme = point;
      return false;
    }
    const dx = point.x - extreme.x, dy = point.y - extreme.y;
    const projected = dx * direction.x + dy * direction.y;
    if (projected >= 0) { extreme = point; return false; }
    const backwards = -projected, distanceBack = Math.hypot(dx, dy);
    if (backwards < leg || backwards / distanceBack < config.reverseCosine) return false;
    const distance = Math.hypot(extreme.x - origin.x, extreme.y - origin.y);
    const elapsed = extreme.t - origin.t;
    const fast = elapsed > 0 && distance / elapsed * 1000 >= config.minSpeedPxPerSecond;
    if (!fast) turns = [];
    else turns.push({ t: point.t, distance });
    turns = turns.filter(turn => point.t - turn.t <= config.windowMs);
    // Bound memory even for synthetic high-frequency input.
    if (turns.length > 32) turns = turns.slice(-32);
    origin = extreme;
    direction = { x: dx / distanceBack, y: dy / distanceBack };
    extreme = point;
    const travel = turns.reduce((sum, turn) => sum + turn.distance, 0) + distanceBack;
    return fast && turns.length >= config.minReversals
      && travel >= Math.max(config.minTravelPx, width * config.travelWidthRatio);
  };
  return { start, move, reset };
}

/**
 * pointerup stops sampling only. Silence between qualified reversals starts the
 * same recovery whether the mouse button remains held or has been released.
 * A renderer can sample snapshot() every frame; no replacement art is supplied.
 */
export function createDeskPetShakeController(options: {
  config?: Partial<DeskPetShakeConfig>;
  clock?: ShakeClock;
  reducedMotion?: boolean;
  onChange?: (snapshot: ShakeSnapshot) => void;
} = {}) {
  const config = { ...DESKPET_SHAKE_DEFAULTS, ...options.config };
  const clock = options.clock ?? {
    now: () => performance.now(),
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  };
  const detector = createShakeDetector(config);
  let pointer: number | undefined;
  let phase: ShakePhase = 'idle';
  let phaseStart = 0;
  let fromLevel = 0;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let recoverTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const snapshot = (): ShakeSnapshot => {
    const elapsed = Math.max(0, clock.now() - phaseStart);
    const progress = phase === 'recovering' ? Math.min(1, elapsed / config.recoveryMs) : 0;
    return {
      phase,
      level: phase === 'idle' ? 0 : phase === 'dizzy'
        ? fromLevel + (1 - fromLevel) * smooth(elapsed / config.reentryMs)
        : fromLevel * (1 - smooth(progress)),
      recoveryProgress: progress,
      reducedMotion: !!options.reducedMotion,
    };
  };
  const notify = () => { if (!disposed) options.onChange?.(snapshot()); };
  const clear = () => {
    if (stopTimer !== undefined) clock.clearTimeout(stopTimer);
    if (recoverTimer !== undefined) clock.clearTimeout(recoverTimer);
    stopTimer = recoverTimer = undefined;
  };
  const cancel = () => {
    clear(); pointer = undefined; detector.reset();
    const changed = phase !== 'idle'; phase = 'idle'; fromLevel = 0;
    if (changed) notify();
  };
  const pulse = () => {
    const current = snapshot().level;
    clear();
    if (phase !== 'dizzy') {
      phase = 'dizzy'; phaseStart = clock.now(); fromLevel = current;
      notify();
    }
    stopTimer = clock.setTimeout(() => {
      stopTimer = undefined;
      fromLevel = snapshot().level;
      phase = 'recovering'; phaseStart = clock.now(); notify();
      recoverTimer = clock.setTimeout(() => {
        recoverTimer = undefined; phase = 'idle'; fromLevel = 0; notify();
      }, config.recoveryMs);
    }, config.stopGapMs);
  };
  return {
    begin(pointerId: number, point: ShakePoint, petWidth: number) {
      if (disposed) return;
      pointer = pointerId; detector.start(point, petWidth);
    },
    move(pointerId: number, point: ShakePoint) {
      if (disposed || pointer !== pointerId) return false;
      if (!detector.move(point)) return false;
      pulse(); return true;
    },
    end(pointerId: number) {
      if (pointer !== pointerId) return;
      pointer = undefined; detector.reset(); // Deliberately leave both phase timers intact.
    },
    snapshot,
    cancel,
    dispose() { disposed = true; cancel(); },
  };
}
