import type {
  TimerDeviceConnectionEvent,
  TimerDeviceError,
} from '@cuberoot/shared/timer/device-contract';
import { describe, expect, it } from 'vitest';

describe('timer device lifecycle contract', () => {
  it('keeps reconnect events platform-neutral', () => {
    const event: TimerDeviceConnectionEvent = {
      kind: 'reconnecting',
      attempt: 2,
      maxAttempts: 5,
      delayMs: 2_000,
    };

    expect(event).toEqual({
      kind: 'reconnecting',
      attempt: 2,
      maxAttempts: 5,
      delayMs: 2_000,
    });
  });

  it('requires adapters to classify retryability with the error code', () => {
    const error: TimerDeviceError = {
      code: 'permission-denied',
      retryable: true,
    };

    const event: TimerDeviceConnectionEvent = { kind: 'error', error };
    expect(event.error.code).toBe('permission-denied');
    expect(event.error.retryable).toBe(true);
  });
});
