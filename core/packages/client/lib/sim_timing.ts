/** Shared /sim speed contract: one parsed formula token is one TPS beat. */
export const SIM_TICKS_PER_SECOND = 60;
export const SIM_MIN_TPS = 0.5;
export const SIM_MAX_TPS = 6;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function simSpeedToTicks(speed: number): number {
  const clamped = Math.min(100, Math.max(0, finiteOr(speed, 50)));
  return Math.round(120 - (clamped / 100) * 110);
}

export function simSpeedToTps(speed: number): number {
  return SIM_TICKS_PER_SECOND / simSpeedToTicks(speed);
}

export function simTpsToSpeed(tps: number): number {
  const clamped = Math.min(SIM_MAX_TPS, Math.max(SIM_MIN_TPS, finiteOr(tps, 1)));
  if (clamped === SIM_MIN_TPS) return 0;
  if (clamped === SIM_MAX_TPS) return 100;
  return (120 - SIM_TICKS_PER_SECOND / clamped) / 1.1;
}

export function simStepDurationMs(tps: number): number {
  const clamped = Math.min(SIM_MAX_TPS, Math.max(SIM_MIN_TPS, finiteOr(tps, 1)));
  return 1000 / clamped;
}

/** Convert real elapsed milliseconds to the engine's export-compatible 60 Hz ticks. */
export function elapsedMsToSimTicks(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return elapsedMs * SIM_TICKS_PER_SECOND / 1000;
}

export interface SimTimelineLeaf<TLeaf> {
  animLeaf: TLeaf;
  start: number;
  end: number;
}

/** cubing.js custom timeline with exactly one second per leaf; tempoScale supplies TPS. */
export function uniformSimTimeline<TLeaf>(leaves: readonly TLeaf[]): SimTimelineLeaf<TLeaf>[] {
  return leaves.map((animLeaf, index) => ({
    animLeaf,
    start: index * 1000,
    end: (index + 1) * 1000,
  }));
}
