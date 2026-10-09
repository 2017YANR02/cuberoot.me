import type { TimerPhase } from './machine';

export interface TimerDisplaySettings {
  compactScramble: boolean;
  hideAllUiWhileRunning: boolean;
}

export function normalizeTimerDisplaySettings(value: Partial<Record<keyof TimerDisplaySettings, unknown>> = {}): TimerDisplaySettings {
  return {
    compactScramble: value.compactScramble === true,
    hideAllUiWhileRunning: value.hideAllUiWhileRunning === true,
  };
}

/** Inspection and stopped results retain their controls, even with hide-all enabled. */
export function timerHidesRunningUi(phase: TimerPhase, settings: TimerDisplaySettings): boolean {
  return phase === 'running' && settings.hideAllUiWhileRunning;
}
