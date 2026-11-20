import { describe, expect, it } from 'vitest';
import { STACKMAT_IDLE_SNAPSHOT } from '@cuberoot/shared/timer/external/stackmat-state';
import {
  nativeTimerDeviceCenter,
  nativeTimerDeviceManagement,
  nativeTimerDeviceSelection,
  type NativeTimerDevicesState,
} from '../src/lib/native-timer-devices';

function fixture(overrides: Partial<NativeTimerDevicesState> = {}): NativeTimerDevicesState {
  return {
    bluetoothAvailable: true,
    busy: false,
    cubeConnected: false,
    canResetCube: false,
    calibrating: false,
    externalConnected: false,
    externalName: '',
    ...overrides,
  };
}

describe('native timer device center', () => {
  it('lists native adapters and keeps the Stackmat information reachable', () => {
    const state = fixture();
    expect(nativeTimerDeviceCenter(state, 'zh').items.map(item => [item.kind, item.label])).toEqual([
      ['smart-cube', '智能魔方'],
      ['smart-timer', '智能计时器'],
      ['stackmat', 'Stackmat'],
    ]);
    expect(nativeTimerDeviceSelection(state, 'stackmat')).toBe('stackmat-info');
    expect(nativeTimerDeviceManagement(state, 'stackmat')).toMatchObject({ active: false, canDisconnect: false });
    expect(nativeTimerDeviceCenter(fixture({ bluetoothAvailable: false })).items.map(item => item.kind)).toEqual(['stackmat']);
  });

  it('distinguishes connection from management and uses the active-cube shortcut', () => {
    const cube = { phase: 'connected' as const, deviceName: 'GAN-i', battery: 0, lastMove: 'R', brand: 'gan-v4' as const, error: '' };
    const state = fixture({ cube, cubeConnected: true, canResetCube: true, externalConnected: true, externalName: 'Timer' });
    expect(nativeTimerDeviceCenter(state, 'en')).toMatchObject({
      directKind: 'smart-cube',
      active: true,
      ariaLabel: 'Smart cube',
    });
    expect(nativeTimerDeviceSelection(state, 'smart-cube')).toBe('manage-cube');
    expect(nativeTimerDeviceSelection(state, 'smart-timer')).toBe('manage-timer');
    expect(nativeTimerDeviceManagement(state, 'smart-cube', 'zh')).toMatchObject({
      deviceName: 'GAN-i',
      status: '已连接',
      battery: '0%',
      protocol: 'gan-v4',
      lastMove: 'R',
      canCalibrate: true,
      canDisconnect: true,
    });
    expect(nativeTimerDeviceSelection(fixture(), 'smart-cube')).toBe('scan-cube');
    expect(nativeTimerDeviceSelection(fixture(), 'smart-timer')).toBe('connect-timer');
  });

  it('guards stale taps and active-attempt device changes', () => {
    const state = fixture({ busy: true, cubeConnected: true, canResetCube: true });
    expect(nativeTimerDeviceCenter(state).directKind).toBeUndefined();
    expect(nativeTimerDeviceSelection(state, 'smart-cube')).toBeUndefined();
    expect(nativeTimerDeviceManagement(state, 'smart-cube')?.canDisconnect).toBe(false);
    expect(nativeTimerDeviceManagement(state, 'smart-cube')?.canCalibrate).toBe(false);
    expect(nativeTimerDeviceManagement(fixture({ calibrating: true, cubeConnected: true, canResetCube: true }), 'smart-cube')?.canCalibrate).toBe(false);
  });

  it('models discovery, manual MAC and connected timer details', () => {
    const externalScan = [{ deviceId: 'opaque', deviceName: 'QY-Adapter' }];
    expect(nativeTimerDeviceManagement(fixture({ externalScan }), 'smart-timer', 'zh')).toMatchObject({
      timerScanning: true, devices: externalScan, timerMac: null, timerDetails: null,
    });
    expect(nativeTimerDeviceManagement(fixture({ externalMac: { name: 'QY-Adapter', value: '' } }), 'smart-timer', 'zh')).toMatchObject({
      timerScanning: false, timerMac: { value: '', instructions: '没有自动读到 QY-Adapter 的蓝牙地址，请输入设备的 MAC 地址。' },
    });
    expect(nativeTimerDeviceManagement(fixture({
      externalConnected: true, externalKind: 'qiyi-timer', externalName: 'QY-Adapter', externalState: 'STOPPED', externalLastTime: 12345,
    }), 'smart-timer', 'en')).toMatchObject({
      deviceName: 'QY-Adapter', status: 'Connected', canDisconnect: true,
      timerDetails: { kind: 'QiYi Timer / Adapter', state: 'Stopped', lastResult: '12.34' },
    });
  });

  it('opens Stackmat in recorder-capable hosts and exposes the actual signal and reading', () => {
    const idle = fixture({ stackmatAvailable: true });
    expect(nativeTimerDeviceSelection(idle, 'stackmat')).toBe('connect-stackmat');
    const state = fixture({ stackmatAvailable: true, externalConnected: true, externalKind: 'stackmat-mic', stackmat: {
      ...STACKMAT_IDLE_SNAPSHOT, listening: true, signalLevel: 0.37, signalPresent: true, phase: 'stopped', unit: 1, ms: 12_345,
    } });
    expect(nativeTimerDeviceCenter(state, 'zh').items.map(item => [item.kind, item.active])).toEqual([
      ['smart-cube', false], ['smart-timer', false], ['stackmat', true],
    ]);
    expect(nativeTimerDeviceManagement(state, 'stackmat', 'zh')).toMatchObject({ stackmat: {
      listening: true, health: 'ok', level: 37, phase: '已停表', reading: '12.34', resolution: '毫秒（Gen 4）', defaultInput: '系统默认',
    } });
  });
});
