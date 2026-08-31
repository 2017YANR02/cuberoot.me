import type { EventId } from './types';

/** Visit-local identity for a source whose raw configuration can be arbitrarily large. */
export interface TimerSourceRevision {
  readonly instanceId: string;
  readonly rawValue: string;
  readonly revision: number;
}

export function createTimerSourceRevision(
  instanceId: string,
  rawValue = '',
): TimerSourceRevision {
  if (!instanceId) throw new Error('timer source instance id is required');
  return { instanceId, rawValue, revision: 0 };
}

/** Same raw value keeps its identity; every actual change advances exactly once. */
export function advanceTimerSourceRevision(
  current: TimerSourceRevision,
  rawValue: string,
): TimerSourceRevision {
  if (rawValue === current.rawValue) return current;
  return {
    instanceId: current.instanceId,
    rawValue,
    revision: current.revision + 1,
  };
}

export function timerManualSourceIdentity(
  event: EventId,
  source: TimerSourceRevision,
): string {
  return `manual|${event}|${source.instanceId}|${source.revision}`;
}
