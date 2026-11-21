import {
  BLUETOOTH_TIMER_DIALOG_COPY,
  BLUETOOTH_TIMER_KIND_LABELS,
  BLUETOOTH_TIMER_STATE_LABELS,
  bluetoothTimerMacInstructions,
  createTimerDeviceRegistry,
  TIMER_DEVICE_CENTER_LABELS,
  TIMER_DEVICE_REGISTRATIONS,
  TIMER_SMART_CUBE_DEVICE_COPY,
  timerSmartCubeBatteryPercent,
  timerSmartCubeSignalLabel,
} from '@cuberoot/shared/timer/device-contract';
import type { ExternalTimerKind, ExternalTimerState } from '@cuberoot/shared/timer/external/types';
import { STACKMAT_DIALOG_COPY, STACKMAT_HEALTH_LABELS, STACKMAT_IDLE_SNAPSHOT, STACKMAT_PHASE_LABELS, stackmatHealth, type StackmatSnapshot } from '@cuberoot/shared/timer/external/stackmat-state';
import { formatMs } from '@cuberoot/shared/timer/stats';
import { getMiniProgramLocale, tr, type MiniProgramLocale } from './i18n';
import type { SmartCubeSessionSnapshot } from './smart-cube/session';

export type NativeTimerDeviceKind = 'smart-cube' | 'smart-timer' | 'stackmat';

export interface NativeTimerDevicesState {
  bluetoothAvailable: boolean;
  busy: boolean;
  connecting?: boolean;
  cubeConnectingId?: string;
  cube?: Omit<SmartCubeSessionSnapshot, 'devices'> & Partial<Pick<SmartCubeSessionSnapshot, 'devices'>>;
  cubeConnected: boolean;
  canResetCube: boolean;
  calibrating: boolean;
  externalConnected: boolean;
  externalName: string;
  externalKind?: ExternalTimerKind;
  externalState?: ExternalTimerState;
  externalLastTime?: number;
  externalScan?: readonly { deviceId: string; deviceName: string }[];
  externalMac?: { name: string; value: string };
  stackmatAvailable?: boolean;
  stackmat?: StackmatSnapshot;
}

export function nativeTimerDeviceCenter(state: NativeTimerDevicesState, language = getMiniProgramLocale()) {
  const registry = createTimerDeviceRegistry({
    adapterIds: [...(state.bluetoothAvailable ? ['smart-cube', 'smart-timer'] : []), ...(state.stackmatAvailable ? ['stackmat'] : [])],
    registrations: TIMER_DEVICE_REGISTRATIONS,
  });
  const items: { id: string; kind: NativeTimerDeviceKind; label: string; active: boolean; detail: string; disabled: boolean }[] = registry.list().map(device => {
    const kind = device.kind;
    const stackmatActive = state.externalConnected && state.externalKind === 'stackmat-mic';
    const active = kind === 'smart-cube' ? state.cubeConnected : kind === 'stackmat' ? stackmatActive : state.externalConnected && !stackmatActive;
    const name = kind === 'smart-cube' ? state.cube?.deviceName : kind === 'smart-timer' ? state.externalName : '';
    const pairing = kind === 'smart-cube' && (state.cube?.phase === 'scanning' || state.cube?.phase === 'connecting');
    return {
      id: device.id,
      kind,
      label: tr(TIMER_DEVICE_CENTER_LABELS[kind], language),
      active,
      detail: active ? name || tr(TIMER_DEVICE_CENTER_LABELS[kind === 'stackmat' ? 'listening' : 'connected'], language)
        : pairing ? TIMER_SMART_CUBE_DEVICE_COPY[language].connecting : '',
      disabled: state.busy || state.connecting === true || pairing,
    };
  });
  // Match the shared device center's shortcut when exactly one cube adapter
  // offers management of its connected cube.
  const directKind = items.find(item => item.kind === 'smart-cube' && item.active && !item.disabled)?.kind;
  if (!state.stackmatAvailable) items.push({ id: 'stackmat-info', kind: 'stackmat', label: tr(TIMER_DEVICE_CENTER_LABELS.stackmat, language),
    active: false, detail: '', disabled: state.busy || state.connecting === true });
  return {
    items,
    directKind,
    visible: items.length > 0,
    active: items.some(item => item.active),
    title: tr(TIMER_DEVICE_CENTER_LABELS.title, language),
    menuLabel: tr(TIMER_DEVICE_CENTER_LABELS.menu, language),
    ariaLabel: tr(TIMER_DEVICE_CENTER_LABELS[directKind ?? 'title'], language),
  };
}

export function nativeTimerDeviceSelection(state: NativeTimerDevicesState, kind: unknown) {
  const item = nativeTimerDeviceCenter(state).items.find(candidate => candidate.kind === kind);
  if (!item || item.disabled) return;
  if (item.kind === 'smart-cube') return item.active ? 'manage-cube' : 'scan-cube';
  if (item.kind === 'stackmat') return item.active || !state.stackmatAvailable ? 'stackmat-info' : 'connect-stackmat';
  return item.active ? 'manage-timer' : 'connect-timer';
}

export function nativeStackmatManagement(state: NativeTimerDevicesState, language = getMiniProgramLocale()) {
  const listening = state.externalConnected && state.externalKind === 'stackmat-mic';
  const snapshot = state.stackmat ?? STACKMAT_IDLE_SNAPSHOT;
  const health = stackmatHealth({ ...snapshot, listening });
  return {
    listening, health, available: Boolean(state.stackmatAvailable), starting: !listening && Boolean(state.connecting),
    healthLabel: tr(STACKMAT_HEALTH_LABELS[health], language),
    phase: tr(STACKMAT_PHASE_LABELS[snapshot.phase], language),
    level: Math.max(0, Math.min(100, Math.round(snapshot.signalLevel * 100))),
    reading: snapshot.signalPresent ? formatMs(snapshot.ms) : '—',
    resolution: snapshot.unit ? tr(snapshot.unit === 1 ? STACKMAT_DIALOG_COPY.ms : STACKMAT_DIALOG_COPY.cs, language) : '',
    guidance: health === 'silent' ? tr(STACKMAT_DIALOG_COPY.silent, language) : health === 'wrong-signal'
      ? tr({ en: 'That is probably the built-in microphone. Connect the timer to the phone’s audio input.', zh: '听到的多半是内置麦克风。请把计时器接到手机的音频输入口。' }, language) : '',
    instructions: tr(STACKMAT_DIALOG_COPY.instructions, language),
    compatibility: tr(STACKMAT_DIALOG_COPY.compatibility, language),
    start: tr(state.connecting ? STACKMAT_DIALOG_COPY.starting : STACKMAT_DIALOG_COPY.start, language),
    stop: tr(STACKMAT_DIALOG_COPY.stop, language),
    close: tr(STACKMAT_DIALOG_COPY.close, language),
    levelLabel: tr(STACKMAT_DIALOG_COPY.level, language),
    stateLabel: tr(STACKMAT_DIALOG_COPY.state, language),
    readingLabel: tr(STACKMAT_DIALOG_COPY.reading, language),
    resolutionLabel: tr(STACKMAT_DIALOG_COPY.resolution, language),
    inputLabel: tr(STACKMAT_DIALOG_COPY.input, language),
    defaultInput: tr(STACKMAT_DIALOG_COPY.defaultInput, language),
    unavailable: tr({ en: 'Microphone capture is unavailable here.', zh: '当前环境无法使用麦克风' }, language),
  };
}

/** A connected item opens a status panel. Only its explicit action disconnects. */
export function nativeTimerDeviceManagement(
  state: NativeTimerDevicesState,
  kind: NativeTimerDeviceKind,
  language: MiniProgramLocale = getMiniProgramLocale(),
) {
  const item = nativeTimerDeviceCenter(state, language).items.find(candidate => candidate.kind === kind);
  if (!item) return;
  const cube = kind === 'smart-cube' ? state.cube : undefined;
  const cubeCopy = TIMER_SMART_CUBE_DEVICE_COPY[language];
  const battery = timerSmartCubeBatteryPercent(cube?.battery);
  const timerScan = kind === 'smart-timer' ? state.externalScan : undefined;
  const timerMac = kind === 'smart-timer' ? state.externalMac : undefined;
  const searching = kind === 'smart-cube' && (cube?.phase === 'scanning' || cube?.phase === 'connecting');
  const status = item.active ? tr(TIMER_DEVICE_CENTER_LABELS.connected, language)
    : tr({ en: 'Disconnected', zh: '已断开' }, language);
  return {
    kind,
    title: kind === 'smart-timer' ? tr(BLUETOOTH_TIMER_DIALOG_COPY.title, language)
      : kind === 'stackmat' ? tr(STACKMAT_DIALOG_COPY.title, language) : item.label,
    deviceName: item.detail,
    active: item.active,
    searching,
    // The transport retains the scanning phase while its finished results are selectable.
    scanning: kind === 'smart-cube' && Boolean(state.connecting) && !state.cubeConnectingId && cube?.phase !== 'connecting',
    timerScanning: timerScan !== undefined && !state.connecting,
    connecting: kind === 'smart-cube' ? Boolean(state.cubeConnectingId) || cube?.phase === 'connecting' : state.connecting,
    devices: cube?.devices?.map(device => ({
      ...device, signal: cubeCopy[timerSmartCubeSignalLabel(device.rssi)], connecting: device.deviceId === state.cubeConnectingId,
    })) ?? timerScan ?? [],
    stackmat: kind === 'stackmat' ? nativeStackmatManagement(state, language) : null,
    timerMac: timerMac ? { value: timerMac.value, instructions: tr(bluetoothTimerMacInstructions(timerMac.name), language) } : null,
    timerDetails: kind === 'smart-timer' && item.active ? {
      kind: tr(BLUETOOTH_TIMER_KIND_LABELS[state.externalKind ?? 'unknown'], language),
      state: tr(BLUETOOTH_TIMER_STATE_LABELS[state.externalState ?? 'IDLE'], language),
      lastResult: state.externalLastTime && state.externalLastTime > 0 ? formatMs(state.externalLastTime) : '—',
    } : null,
    status,
    error: cube?.error ?? '',
    battery: battery === null ? '' : `${battery}%`,
    batteryPercent: battery,
    protocol: cube?.brand ?? '',
    lastMove: cube?.lastMove ?? '',
    canDisconnect: item.active && !item.disabled,
    supportsCalibrate: kind === 'smart-cube' && item.active && state.canResetCube,
    canCalibrate: kind === 'smart-cube' && item.active && !item.disabled && state.canResetCube && !state.calibrating,
    calibrating: kind === 'smart-cube' && state.calibrating,
    copy: {
      battery: cubeCopy.battery,
      close: cubeCopy.close,
      connectionFailed: cubeCopy.connectionFailed,
      protocol: tr({ en: 'Protocol', zh: '协议' }, language),
      lastMove: cubeCopy.lastMove,
      disconnect: cubeCopy.disconnect,
      calibrate: cubeCopy.resetState,
      availableDevices: cubeCopy.availableDevices,
      scanning: cubeCopy.scanning,
      connecting: cubeCopy.connecting,
      scanAgain: cubeCopy.scanAgain,
      noDevices: cubeCopy.noDevices,
      connect: cubeCopy.connect,
      search: tr(BLUETOOTH_TIMER_DIALOG_COPY.connect, language),
      timerConnecting: tr(BLUETOOTH_TIMER_DIALOG_COPY.connecting, language),
      timerInstructions: tr(BLUETOOTH_TIMER_DIALOG_COPY.instructions, language),
      timerSupported: tr(BLUETOOTH_TIMER_DIALOG_COPY.supported, language),
      availableTimers: tr(BLUETOOTH_TIMER_DIALOG_COPY.available, language),
      searchingTimers: tr(BLUETOOTH_TIMER_DIALOG_COPY.searching, language),
      timerDevice: tr(BLUETOOTH_TIMER_DIALOG_COPY.device, language),
      timerState: tr(BLUETOOTH_TIMER_DIALOG_COPY.state, language),
      timerLastResult: tr(BLUETOOTH_TIMER_DIALOG_COPY.lastResult, language),
      timerConnectedHelp: tr(BLUETOOTH_TIMER_DIALOG_COPY.connectedHelp, language),
      timerMacLabel: tr(BLUETOOTH_TIMER_DIALOG_COPY.macLabel, language),
      timerClearMac: tr(BLUETOOTH_TIMER_DIALOG_COPY.clearMac, language),
      timerMacTip: tr(BLUETOOTH_TIMER_DIALOG_COPY.macTip, language),
      timerSubmitMac: tr(BLUETOOTH_TIMER_DIALOG_COPY.submitMac, language),
      timerCancelMac: tr(BLUETOOTH_TIMER_DIALOG_COPY.cancelMac, language),
    },
  };
}
