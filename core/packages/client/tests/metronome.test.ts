import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared metronome engine. The point of the scheduler is that beats land on the
// audio clock at exact intervals even when the JS timer that queues them fires
// raggedly — so the fake context here lets a test advance `currentTime` by hand
// and assert on the times passed to `osc.start()`.

const TIMER_KEY = 'cuberoot-timer.settings.v1';
const KEY = 'cuberoot.metronome.v1';

function makeLocalStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

class FakeParam {
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
}

class FakeOsc {
  frequency = new FakeParam();
  type = 'sine';
  connect(next: unknown) { return next; }
  start(t: number) { ctx.starts.push(t); }
  stop() { /* no-op */ }
}

class FakeGain {
  gain = new FakeParam();
  connect(next: unknown) { return next; }
}

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  starts: number[] = [];
  resumes = 0;
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
  addEventListener() { /* statechange — not exercised here */ }
  resume() { this.resumes += 1; this.state = 'running'; return Promise.resolve(); }
}

// Lifecycle listeners (visibilitychange / pageshow / pagehide / freeze / resume)
// are the whole recovery path after an app switch, so the harness records them
// and `fire()` replays one.
const listeners = new Map<string, Set<() => void>>();

function record(type: string, fn: () => void): void {
  let set = listeners.get(type);
  if (!set) { set = new Set(); listeners.set(type, set); }
  set.add(fn);
}

function fire(type: string): void {
  for (const fn of [...(listeners.get(type) ?? [])]) fn();
}

let ctx: FakeAudioContext;

// A hand-driven interval queue: `tickTimers()` runs every registered callback
// once, standing in for the lookahead timer without real time passing.
const timers = new Map<number, () => void>();
let nextTimerId = 1;

function tickTimers(): void {
  for (const fn of [...timers.values()]) fn();
}

const g = globalThis as unknown as Record<string, unknown>;

ctx = new FakeAudioContext();
g.localStorage = makeLocalStorage();
g.performance = { now: () => nowMs };
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => { /* no-op */ };
g.document = {
  visibilityState: 'visible',
  addEventListener: record,
};
g.window = {
  AudioContext: FakeAudioContext,
  addEventListener: record,
  removeEventListener(type: string, fn: () => void) { listeners.get(type)?.delete(fn); },
  setInterval(fn: () => void) { const id = nextTimerId++; timers.set(id, fn); return id; },
  clearInterval(id: number) { timers.delete(id); },
  setTimeout(fn: () => void) { const id = nextTimerId++; void fn; return id; },
  clearTimeout() { /* no-op */ },
};
// The engine constructs its context via `new Ctor()`; hand back the instance
// the test holds so assertions can read `starts`.
g.window = new Proxy(g.window as object, {
  get(target, prop) {
    if (prop === 'AudioContext') return function () { return ctx; };
    return Reflect.get(target, prop);
  },
});
g.AudioContext = FakeAudioContext;

let nowMs = 0;

const m = await import('@/lib/metronome');

/** Run the scheduler forward `seconds` in `step`-sized audio-clock advances. */
function advance(seconds: number, step = 0.025): void {
  const end = ctx.currentTime + seconds;
  while (ctx.currentTime < end) {
    ctx.currentTime = +(ctx.currentTime + step).toFixed(6);
    tickTimers();
  }
}

function gapsOf(times: number[]): number[] {
  return times.slice(1).map((t, i) => +(t - times[i]).toFixed(6));
}

function reset(): void {
  m.setMetronomeHold('timer', false);
  m.setMetronome({ on: false });
  m.resetTapTempo();
  ctx.starts.length = 0;
}

describe('metronome tempo conversion', () => {
  it('treats one beat as one turn', () => {
    expect(m.bpmToTps(120)).toBe(2);
    expect(m.bpmToTps(360)).toBe(6);
    expect(m.tpsToBpm(4)).toBe(240);
  });

  it('clamps to a range that covers real turning speeds', () => {
    expect(m.clampBpm(10)).toBe(m.BPM_MIN);
    expect(m.clampBpm(9999)).toBe(m.BPM_MAX);
    expect(m.BPM_MAX).toBeGreaterThanOrEqual(360); // 6 TPS must be reachable
    expect(m.clampBpm(Number.NaN)).toBe(120);
    expect(m.clampBpm(180.4)).toBe(180);
  });
});

describe('metronome scheduling', () => {
  beforeEach(reset);

  it('queues beats at exact intervals regardless of when the timer fires', () => {
    m.setMetronome({ bpm: 240 });
    m.setMetronome({ on: true });
    advance(2);
    const gaps = gapsOf(ctx.starts);
    expect(ctx.starts.length).toBeGreaterThan(4);
    expect([...new Set(gaps)]).toEqual([0.25]);
  });

  it('does not double-schedule a beat when start is requested twice', () => {
    m.setMetronome({ bpm: 120, on: true });
    m.setMetronome({ on: true });
    advance(2);
    expect(gapsOf(ctx.starts).every((g) => g > 0)).toBe(true);
  });

  it('stops queueing once switched off', () => {
    m.setMetronome({ bpm: 120, on: true });
    advance(1);
    const queuedWhileOn = ctx.starts.length;
    expect(queuedWhileOn).toBeGreaterThan(0);
    m.setMetronome({ on: false });
    advance(2);
    expect(ctx.starts.length).toBe(queuedWhileOn);
  });

  it('applies a tempo change without waiting out the old interval', () => {
    m.setMetronome({ bpm: 30, on: true }); // 2s between beats
    advance(0.1);
    m.setMetronome({ bpm: 240 });          // 0.25s between beats
    advance(1);
    const gaps = gapsOf(ctx.starts);
    // The already-queued slow beat may still be in flight, but nothing should
    // remain spaced at the old 2s interval once the new tempo takes hold.
    expect(gaps[gaps.length - 1]).toBeCloseTo(0.25, 6);
  });
});

describe('metronome survives leaving and returning to the page', () => {
  beforeEach(reset);

  it('rebuilds the transport after a pagehide/pageshow round trip', () => {
    m.setMetronome({ bpm: 120, on: true });
    advance(1);
    expect(ctx.starts.length).toBeGreaterThan(0);

    fire('pagehide');           // bfcache / app switch tears the scheduler down
    ctx.starts.length = 0;
    advance(2);
    expect(ctx.starts.length).toBe(0);

    fire('pageshow');           // coming back must bring the ticks back
    advance(2);
    expect(ctx.starts.length).toBeGreaterThan(0);
  });

  it('recovers the same way after a freeze/resume round trip', () => {
    m.setMetronome({ bpm: 120, on: true });
    advance(1);
    fire('freeze');
    ctx.starts.length = 0;
    advance(2);
    expect(ctx.starts.length).toBe(0);
    fire('resume');
    advance(2);
    expect(ctx.starts.length).toBeGreaterThan(0);
  });

  it('resumes a context the browser parked while the tab was away', () => {
    m.setMetronome({ bpm: 120, on: true });
    advance(1);
    ctx.state = 'suspended';    // OS/browser suspended the audio clock
    ctx.resumes = 0;
    fire('visibilitychange');
    expect(ctx.resumes).toBeGreaterThan(0);
    expect(ctx.state).toBe('running');
  });

  it('stays off when the page comes back and nothing was sounding', () => {
    fire('pageshow');
    advance(2);
    expect(ctx.starts.length).toBe(0);
  });
});

describe('metronome holds', () => {
  beforeEach(reset);

  it('sounds while a hold is active even though the user switch is off', () => {
    expect(m.isMetronomeSounding()).toBe(false);
    m.setMetronomeHold('timer', true);
    expect(m.isMetronomeSounding()).toBe(true);
    advance(1);
    expect(ctx.starts.length).toBeGreaterThan(0);
  });

  it('releasing a hold does not stop a metronome the user switched on', () => {
    m.setMetronome({ on: true });
    m.setMetronomeHold('timer', true);
    m.setMetronomeHold('timer', false);
    expect(m.isMetronomeSounding()).toBe(true);
    ctx.starts.length = 0;
    advance(1);
    expect(ctx.starts.length).toBeGreaterThan(0);
  });

  it('keeps sounding until every hold is released', () => {
    m.setMetronomeHold('timer', true);
    m.setMetronomeHold('trainer', true);
    m.setMetronomeHold('timer', false);
    expect(m.isMetronomeSounding()).toBe(true);
    m.setMetronomeHold('trainer', false);
    expect(m.isMetronomeSounding()).toBe(false);
  });

  it('leaves the user switch untouched across a hold cycle', () => {
    m.setMetronomeHold('timer', true);
    m.setMetronomeHold('timer', false);
    expect(m.getMetronomeState().on).toBe(false);
  });
});

describe('tap tempo', () => {
  beforeEach(() => { reset(); nowMs = 0; });

  it('returns nothing on the first tap of a run', () => {
    expect(m.tapTempo()).toBeNull();
  });

  it('averages the tapped interval', () => {
    m.tapTempo();            // t=0
    nowMs = 500; m.tapTempo();
    nowMs = 1000;
    expect(m.tapTempo()).toBe(120); // 500ms apart → 120 BPM
  });

  it('starts a fresh run after a long pause', () => {
    m.tapTempo();
    nowMs = 500; m.tapTempo();
    nowMs = 9000;                    // > 3s gap
    expect(m.tapTempo()).toBeNull(); // treated as the first tap again
  });

  it('clamps an implausibly fast tap run', () => {
    m.tapTempo();
    nowMs = 10; m.tapTempo();        // 10ms → 6000 BPM
    expect(m.tapTempo()).toBeLessThanOrEqual(m.BPM_MAX);
  });
});

describe('metronome persistence', () => {
  /** Re-run the module against a given localStorage so its load path executes again. */
  async function loadWith(seed: Record<string, string>) {
    g.localStorage = makeLocalStorage(seed);
    vi.resetModules();
    return import('@/lib/metronome');
  }

  it('restores tempo but never auto-starts on load', async () => {
    const fresh = await loadWith({ [KEY]: JSON.stringify({ bpm: 300, accent: 4, on: true }) });
    expect(fresh.getMetronomeState().bpm).toBe(300);
    expect(fresh.getMetronomeState().accent).toBe(4);
    expect(fresh.getMetronomeState().on).toBe(false);
  });

  it('picks up the tempo the timer page used to own', async () => {
    const fresh = await loadWith({ [TIMER_KEY]: JSON.stringify({ metronomeBpm: 96 }) });
    expect(fresh.getMetronomeState().bpm).toBe(96);
  });

  it('ignores a junk accent value', async () => {
    const fresh = await loadWith({ [KEY]: JSON.stringify({ bpm: 120, accent: 7 }) });
    expect(m.ACCENT_CHOICES).not.toContain(7);
    expect(fresh.getMetronomeState().accent).toBe(0);
  });
});
