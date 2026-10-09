// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useBluetoothCube, type BluetoothCubeHandle } from '@/lib/bluetooth';
import type { MiniProgramCubeBridgeCallbacks } from '@/lib/bluetooth/miniprogram_bridge';
import { applyMoves, solved, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import { parseScramble } from '@/app/[lang]/timer/_lib/cube/moves';
const bridge = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('@/lib/bluetooth/miniprogram_bridge', () => ({
  mayUseMiniProgramBridge: () => true,
  isMiniProgramWebView: () => true,
  connectMiniProgramCubeBridge: bridge.connect,
}));
it('calibrates without a Web GATT device and suppresses solved callbacks for another sink calibration', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let callbacks!: MiniProgramCubeBridgeCallbacks;
  const solvedState = toFaceletString(solved(3));
  const scrambled = toFaceletString(applyMoves(solved(3), 3, parseScramble('R U')));
  const onSolved = vi.fn();
  const resetDeviceState = vi.fn(async () => { callbacks.onState(solvedState); });
  bridge.connect.mockImplementation(async (cb: MiniProgramCubeBridgeCallbacks) => {
    callbacks = cb;
    return { brand: 'gan-v4', deviceName: 'GAN16ui', hasGyro: true, resetDeviceState,
      activate() { cb.onState(scrambled); }, disconnect() {} };
  });
  let cube!: BluetoothCubeHandle;
  function Harness() { cube = useBluetoothCube({ onSolved }); return null; }
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => { await cube.connect(); });
    expect(cube.solved).toBe(false);
    await act(async () => { await cube.resetDeviceState!(); });
    expect(resetDeviceState).toHaveBeenCalledOnce();
    expect(onSolved).not.toHaveBeenCalled();
    await act(async () => {
      callbacks.onState(scrambled);
      callbacks.onStatus({ type: 'status', phase: 'connected', calibrating: true });
      callbacks.onState(solvedState);
      callbacks.onStatus({ type: 'status', phase: 'connected', calibrating: false });
    });
    expect(onSolved).not.toHaveBeenCalled();
    // A replayed calibration snapshot remains marked after source status becomes idle.
    await act(async () => { callbacks.onState(scrambled); callbacks.onState(solvedState, true); });
    expect(onSolved).not.toHaveBeenCalled();
    // A rejected overlapping local request cannot clear the source's active calibration.
    resetDeviceState.mockImplementationOnce(async () => {
      callbacks.onStatus({ type: 'status', phase: 'connected', calibrating: true });
      throw new Error('Device calibration already in progress');
    });
    await act(async () => { await expect(cube.resetDeviceState!()).rejects.toThrow('in progress'); });
    await act(async () => { callbacks.onState(scrambled); callbacks.onState(solvedState); });
    expect(onSolved).not.toHaveBeenCalled();
    await act(async () => {
      callbacks.onStatus({ type: 'status', phase: 'connected', calibrating: false });
      callbacks.onState(scrambled); callbacks.onState(solvedState);
    });
    expect(onSolved).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); }
});
