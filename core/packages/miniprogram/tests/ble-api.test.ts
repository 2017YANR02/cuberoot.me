import { describe, expect, it, vi } from 'vitest';

import {
  BleOperationAbortedError,
  BleOperationTimeoutError,
  BleResourceBusyError,
  claimBleResourceLease,
  invokeBle,
  invokeBleCleanupForLease,
  invokeBleForLease,
  invokeBleWithLateCleanup,
  invokeBleWithLateCleanupForLease,
  raceBleAbort,
  raceBleAbortWithLateCleanup,
  type BleAbortSignal,
} from '../src/lib/smart-cube/ble-api';

function cancellation(): { cancel(): void; signal: BleAbortSignal } {
  let aborted = false;
  const listeners = new Set<() => void>();
  return {
    cancel(): void {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener();
    },
    signal: {
      get aborted(): boolean {
        return aborted;
      },
      onAbort(listener): () => void {
        if (aborted) listener();
        else listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}

describe('raceBleAbortWithLateCleanup', () => {
  it('consumes a rejected operation when the signal is already aborted', async () => {
    const pending = cancellation();
    pending.cancel();
    const operation = Promise.reject(new Error('late BLE failure'));

    await expect(raceBleAbort(operation, pending.signal)).rejects
      .toBeInstanceOf(BleOperationAbortedError);
    await Promise.resolve();
  });

  it('closes a BLE resource that succeeds after cancellation', async () => {
    let resolveOperation!: (value: string) => void;
    const operation = new Promise<string>((resolve) => {
      resolveOperation = resolve;
    });
    const cleanup = vi.fn(async () => undefined);
    const pending = cancellation();

    const result = raceBleAbortWithLateCleanup(operation, pending.signal, cleanup);
    pending.cancel();

    await expect(result).rejects.toBeInstanceOf(BleOperationAbortedError);
    resolveOperation('connected');
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
  });

  it('does not clean up a resource that wins the cancellation race', async () => {
    const cleanup = vi.fn(async () => undefined);
    const pending = cancellation();

    await expect(raceBleAbortWithLateCleanup(
      Promise.resolve('connected'),
      pending.signal,
      cleanup,
    )).resolves.toBe('connected');
    expect(cleanup).not.toHaveBeenCalled();
  });
});

describe('invokeBle', () => {
  it('rejects when the native API never invokes success or fail', async () => {
    vi.useFakeTimers();
    try {
      const operation = invokeBle<string>(() => {}, 50);
      const rejection = expect(operation).rejects.toBeInstanceOf(BleOperationTimeoutError);

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('compensates a success callback that arrives after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let success: ((value: string) => void) | undefined;
      const cleanup = vi.fn(async () => undefined);
      const operation = invokeBleWithLateCleanup<string>(
        (callbacks) => {
          success = callbacks.success;
        },
        cleanup,
        50,
      );
      const rejection = expect(operation).rejects.toBeInstanceOf(BleOperationTimeoutError);

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(() => success?.('late')).not.toThrow();
      await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not clean up a duplicate success after a normal success', async () => {
    let success: ((value: string) => void) | undefined;
    const cleanup = vi.fn(async () => undefined);
    const operation = invokeBleWithLateCleanup<string>((callbacks) => {
      success = callbacks.success;
      callbacks.success?.('connected');
    }, cleanup);

    await expect(operation).resolves.toBe('connected');
    success?.('duplicate');
    await Promise.resolve();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('quarantines a timed-out native operation through its late cleanup', async () => {
    vi.useFakeTimers();
    try {
      const api = {};
      const oldLease = claimBleResourceLease(api);
      let oldSuccess: ((value: string) => void) | undefined;
      let cleanupSuccess: ((value: string) => void) | undefined;
      const oldCleanup = vi.fn(() => invokeBleCleanupForLease(oldLease, (callbacks) => {
        cleanupSuccess = callbacks.success;
      }));
      const oldOperation = invokeBleWithLateCleanupForLease<string>(
        oldLease,
        (callbacks) => {
          oldSuccess = callbacks.success;
        },
        oldCleanup,
        50,
      );
      const rejection = expect(oldOperation).rejects.toBeInstanceOf(BleOperationTimeoutError);

      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(() => claimBleResourceLease(api)).toThrow(BleResourceBusyError);

      oldSuccess?.('late');
      await Promise.resolve();
      expect(oldCleanup).toHaveBeenCalledOnce();
      expect(() => claimBleResourceLease(api)).toThrow(BleResourceBusyError);

      cleanupSuccess?.('closed');
      await Promise.resolve();
      expect(() => claimBleResourceLease(api)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not release a timed-out cleanup lease until the native callback settles', async () => {
    vi.useFakeTimers();
    try {
      const api = {};
      const lease = claimBleResourceLease(api);
      let cleanupSuccess: ((value: string) => void) | undefined;
      const cleanup = invokeBleCleanupForLease<string>(lease, (callbacks) => {
        cleanupSuccess = callbacks.success;
      });
      const rejection = expect(cleanup).rejects.toBeInstanceOf(BleOperationTimeoutError);

      await vi.advanceTimersByTimeAsync(2_000);
      await rejection;
      expect(() => claimBleResourceLease(api)).toThrow(BleResourceBusyError);

      cleanupSuccess?.('closed');
      await Promise.resolve();
      expect(() => claimBleResourceLease(api)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start native work for a stale lease', async () => {
    const api = {};
    const oldLease = claimBleResourceLease(api);
    claimBleResourceLease(api);
    const nativeStart = vi.fn();

    await expect(invokeBleForLease(oldLease, nativeStart)).rejects
      .toBeInstanceOf(BleOperationAbortedError);
    expect(nativeStart).not.toHaveBeenCalled();
  });
});
