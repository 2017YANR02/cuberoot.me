export type Profile = 'constant' | 'jitter' | 'batch-four' | 'first-delay' | 'last-delay'
  | 'latency-ramp' | 'burst' | 'no-device-clock';
export interface Scenario {
  id: string;
  family: 'drift' | 'transport' | 'session-age' | 'threshold' | 'fallback' | 'numeric-origin';
  drift: number;
  durationMs: number;
  preRollMs: number;
  profile: Profile;
  seed: number;
  terminalExtraMs?: number;
  stepMs?: number;
  deviceOriginMs?: number;
  wallOriginMs?: number;
}
export interface TimingEvent {
  index: number;
  realMs: number;
  arrivalMs: number;
  deviceMs: number | null;
  localObservationMs: number | null;
  inSolve: boolean;
}

// Monotonic host clock for CubeRoot; Date.now domain for the actual csTimer code.
export const MONOTONIC_ORIGIN_MS = 100_000;
export const WALL_ORIGIN_MS = 1_700_000_000_000;
export const DEVICE_ORIGIN_MS = 1_000_000;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function eventsFor(scenario: Scenario): TimingEvent[] {
  const rng = random(scenario.seed);
  const stepMs = scenario.stepMs ?? 100;
  const end = scenario.preRollMs + scenario.durationMs;
  // Integer ppm avoids binary floating-point half-tick rounding changing when
  // an origin is added. Quantize the elapsed counter before translating it.
  const ratePpm = 1_000_000 + Math.round(scenario.drift * 1_000_000);
  if (scenario.preRollMs % stepMs || end % stepMs) throw new Error('Scenario endpoints must be on the move grid');
  const count = end / stepMs + 1;
  let previousArrival = -Infinity;
  return Array.from({ length: count }, (_, index) => {
    const realMs = index * stepMs;
    const relative = realMs - scenario.preRollMs;
    let delay = 20;
    if (scenario.profile === 'jitter') delay = 8 + Math.floor(rng() * 93);
    if (scenario.profile === 'first-delay' && relative === 0) delay += 100;
    if (scenario.profile === 'last-delay' && realMs === end) delay += 100;
    if (scenario.profile === 'latency-ramp') delay += Math.max(0, relative) / scenario.durationMs * 100;
    if (scenario.profile === 'burst' && relative === scenario.durationMs / 2) delay += 250;
    if (realMs === end) delay += scenario.terminalExtraMs ?? 0;
    let observation = true;
    let receiveRealMs = realMs;
    if (scenario.profile === 'batch-four') {
      const lastInBatch = Math.min(Math.floor(index / 4) * 4 + 3, count - 1);
      receiveRealMs = lastInBatch * stepMs;
      observation = index === lastInBatch;
    }
    // Ordered delivery: a blocked notification also holds up later notifications.
    const arrivalMs = Math.max(previousArrival, receiveRealMs + delay);
    previousArrival = arrivalMs;
    return {
      index, realMs, arrivalMs,
      deviceMs: scenario.profile === 'no-device-clock' ? null
        : (scenario.deviceOriginMs ?? DEVICE_ORIGIN_MS) + Math.round(realMs * ratePpm / 1_000_000),
      localObservationMs: observation ? arrivalMs : null,
      inSolve: realMs >= scenario.preRollMs,
    };
  });
}

export function scenarios(): Scenario[] {
  const result: Scenario[] = [];
  const drifts = [-0.05, -0.007, -0.001, 0, 0.001, 0.007, 0.05];
  const durations = [5000, 10000, 30000, 60000];
  const profiles: Profile[] = ['constant', 'jitter', 'batch-four', 'first-delay', 'last-delay', 'latency-ramp', 'burst'];
  for (const drift of drifts) for (const durationMs of durations) for (const profile of profiles) {
    for (let seed = 1; seed <= (profile === 'jitter' ? 8 : 1); seed++) {
      result.push({
        id: `${profile}/${drift}/${durationMs}/${seed}`,
        family: profile === 'constant' ? 'drift' : 'transport',
        drift, durationMs, preRollMs: 0, profile, seed,
      });
    }
  }
  for (const drift of [-0.05, -0.007, 0.007, 0.05]) {
    for (const preRollMs of [10000, 30000, 40000, 275000, 280000, 285700, 285800, 290000, 600000]) {
      result.push({ id: `age/${drift}/${preRollMs}`, family: 'session-age', drift,
        durationMs: 10000, preRollMs, profile: 'constant', seed: 1 });
    }
  }
  for (const terminalExtraMs of [1999, 2000, 2001, 2500]) {
    result.push({ id: `threshold/${terminalExtraMs}`, family: 'threshold', drift: 0,
      durationMs: 10000, preRollMs: 0, profile: 'constant', seed: 1, terminalExtraMs });
  }
  for (const terminalExtraMs of [0, 100, 2500]) {
    result.push({ id: `fallback/${terminalExtraMs}`, family: 'fallback', drift: 0,
      durationMs: 10000, preRollMs: 0, profile: 'no-device-clock', seed: 1, terminalExtraMs });
  }
  // Translation of a clock's origin must not change its measured intervals.
  // Include a near-uint32-limit device counter without actually wrapping it.
  for (const deviceOriginMs of [0, 1_000_000, 4_000_000_000]) for (const wallOriginMs of [0, WALL_ORIGIN_MS]) {
    result.push({ id: `origin/${deviceOriginMs}/${wallOriginMs}`, family: 'numeric-origin',
      drift: 0.007, durationMs: 10000, preRollMs: 600000, profile: 'constant', seed: 1,
      deviceOriginMs, wallOriginMs });
  }
  return result;
}
