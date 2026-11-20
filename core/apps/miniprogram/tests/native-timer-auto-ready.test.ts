import { afterEach, expect, it, vi } from 'vitest';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { createNativeTimerAutoReady, type NativeTimerAutoReadyState } from '../src/lib/native-timer-auto-ready';
import { nativeTimerSettingPatch, nativeTimerSettingsModel } from '../src/lib/native-timer-settings';

afterEach(() => vi.useRealTimers());

it('arms once after two seconds of actual movement and cancels when a sheet blocks the timer', () => {
  vi.useFakeTimers();
  const state: NativeTimerAutoReadyState = { phase: 'idle', blocked: false, canStart: true, preference: 'still' };
  const arm = vi.fn();
  const ready = createNativeTimerAutoReady(() => state, arm);
  ready.sync();
  vi.advanceTimersByTime(3000);
  expect(arm).not.toHaveBeenCalled();
  ready.move('U');
  vi.advanceTimersByTime(1500);
  ready.move('R');
  vi.advanceTimersByTime(1999);
  expect(arm).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(arm).toHaveBeenCalledOnce();
  ready.move('F');
  vi.advanceTimersByTime(2500);
  expect(arm).toHaveBeenCalledOnce();
  ready.reset();
  ready.move('L');
  state.blocked = true;
  ready.sync();
  vi.advanceTimersByTime(2500);
  expect(arm).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('uses only adjacent inverse quarter turns and gates them against phase and connection', () => {
  const state: NativeTimerAutoReadyState = { phase: 'stopped', blocked: false, canStart: true, preference: 'double-flick' };
  const arm = vi.fn();
  const ready = createNativeTimerAutoReady(() => state, arm);
  ready.move('U');
  ready.move('U2');
  ready.move("U'");
  ready.move('R');
  ready.move("F'");
  expect(arm).not.toHaveBeenCalled();
  ready.move('F');
  expect(arm).toHaveBeenCalledOnce();
  state.phase = 'running';
  ready.sync();
  ready.move('U');
  ready.move("U'");
  expect(arm).toHaveBeenCalledOnce();
  state.phase = 'idle';
  state.canStart = false;
  ready.move('R');
  ready.move("R'");
  expect(arm).toHaveBeenCalledOnce();
  state.canStart = true;
  ready.move('L');
  ready.move("L'");
  expect(arm).toHaveBeenCalledTimes(2);
});

it('only exposes the same three choices when the native transport consumes them', () => {
  const timer = { event: '333' as const, settings: createTimerStoreSettings(), currentSource: 'wca' as const, busy: false, solves: [] };
  expect(nativeTimerSettingsModel(timer).rows.find(row => row.key === 'bluetoothAutoReady')).toBeUndefined();
  const cap = { smartCubeReadyAvailable: true };
  expect(nativeTimerSettingsModel(timer, cap, 'en').rows.find(row => row.key === 'bluetoothAutoReady')).toMatchObject({
    labels: ['When scrambled', 'Idle for 2 seconds', "Turn and return (U U')"],
  });
  expect(nativeTimerSettingPatch(timer, 'smart-cube', 'bluetoothAutoReady', 2, cap)).toEqual({ bluetoothAutoReady: 'double-flick' });
  expect(nativeTimerSettingPatch(timer, 'smart-cube', 'bluetoothAutoReady', 2)).toBeUndefined();
});
