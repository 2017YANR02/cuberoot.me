import { formatInspectionDisplay } from './inspection';
import type { TimerPhase } from './machine';
import { formatMs } from './stats';
import type { TimerTimingSettings } from './settings-contract';
import type { Penalty } from './types';

export interface TimerTimingDisplayInput extends Pick<
  TimerTimingSettings,
  'timingEnabled' | 'hideTime' | 'runningPrecision' | 'precision'
> {
  displayMs: number;
  inspectionDisplayMs: number;
  inspectionLimitSec: number;
  lastPenalty: Penalty | null;
  phase: TimerPhase;
}

/**
 * Canonical Solo timer readout shared by Web and native App hosts. The timer
 * machine owns phase/time; this function owns the exact visible string for
 * practice mode, inspection, live precision, hidden live time and penalties.
 */
export function formatTimerTimingDisplay(input: TimerTimingDisplayInput): string {
  if (!input.timingEnabled) return '';
  if (input.phase === 'inspecting') {
    return formatInspectionDisplay(input.inspectionDisplayMs, input.inspectionLimitSec);
  }
  if (input.phase === 'ready') return formatMs(0, input.precision);
  if (input.phase === 'running') {
    return input.hideTime ? '' : formatMs(input.displayMs, input.runningPrecision);
  }
  if (input.phase === 'stopped' && input.lastPenalty === 'DNS') return 'DNS';
  if (input.phase === 'stopped' && input.lastPenalty === 'DNF') return 'DNF';
  if (input.phase === 'stopped' && input.lastPenalty === '+2') {
    return `${formatMs(input.displayMs + 2_000, input.precision)}+`;
  }
  return formatMs(input.displayMs, input.precision);
}
