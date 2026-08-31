import { describe, expect, it } from 'vitest';

import { formatTimerTimingDisplay } from '@cuberoot/shared/timer';

const BASE = {
  displayMs: 12_345,
  hideTime: false,
  inspectionDisplayMs: 0,
  inspectionLimitSec: 15,
  lastPenalty: null,
  phase: 'idle',
  precision: 2,
  runningPrecision: 3,
  timingEnabled: true,
} as const;

describe('shared Solo timer timing display', () => {
  it('locks practice, ready, inspection and live-time display semantics', () => {
    expect(formatTimerTimingDisplay({ ...BASE, timingEnabled: false })).toBe('');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'ready' })).toBe('0.00');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'running' })).toBe('12.345');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'running', hideTime: true })).toBe('');
    expect(formatTimerTimingDisplay({
      ...BASE,
      phase: 'inspecting',
      inspectionDisplayMs: 16_001,
    })).toBe('+2');
  });

  it('uses result precision and preserves all three stopped penalties', () => {
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'stopped' })).toBe('12.34');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'stopped', precision: 3 })).toBe('12.345');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'stopped', lastPenalty: '+2' })).toBe('14.34+');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'stopped', lastPenalty: 'DNF' })).toBe('DNF');
    expect(formatTimerTimingDisplay({ ...BASE, phase: 'stopped', lastPenalty: 'DNS' })).toBe('DNS');
  });
});
