import {
  createTimerDeviceRegistry,
  SMART_CUBE_TIMER_DEVICE_REGISTRATIONS,
} from '@cuberoot/shared/timer/device-contract';
import { describe, expect, it } from 'vitest';

describe('timer device registry', () => {
  it('only exposes registrations backed by host adapters', () => {
    const registry = createTimerDeviceRegistry({
      adapterIds: ['smart-cube'],
      registrations: [
        ...SMART_CUBE_TIMER_DEVICE_REGISTRATIONS,
        {
          id: 'stackmat',
          kind: 'stackmat',
          labelKey: 'stackmat',
          capabilities: { connect: true, autoTiming: true },
        },
      ],
    });

    expect(registry.list().map(({ id }) => id)).toEqual(['smart-cube']);
    expect(registry.get('stackmat')).toBeUndefined();
  });

  it('keeps capabilities attached to the visible registration', () => {
    const registry = createTimerDeviceRegistry({
      adapterIds: ['smart-cube'],
      registrations: SMART_CUBE_TIMER_DEVICE_REGISTRATIONS,
    });

    expect(registry.get('smart-cube')?.capabilities).toEqual({
      connect: true,
      disconnect: true,
      state: true,
      reset: true,
    });
  });
});
