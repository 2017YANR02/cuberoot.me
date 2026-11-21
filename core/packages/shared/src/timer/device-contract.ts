import type { ExternalTimerKind, ExternalTimerState } from './external/types';

/**
 * Runtime-neutral contract for timer hardware surfaces.
 *
 * Discovery, permissions, GATT and microphone APIs stay in host adapters.
 * This module only describes which real devices a host can expose and which
 * actions the timer UI may offer for each device.
 */

export type TimerDeviceKind = 'smart-cube' | 'smart-timer' | 'stackmat';

export const TIMER_DEVICE_CENTER_LABELS = {
  title: { zh: '计时设备', en: 'Timer devices' },
  menu: { zh: '可用计时设备', en: 'Available timer devices' },
  trigger: { zh: '设备', en: 'Devices' },
  connected: { zh: '已连接', en: 'Connected' },
  listening: { zh: '监听中', en: 'Listening' },
  'smart-cube': { zh: '智能魔方', en: 'Smart cube' },
  'smart-timer': { zh: '智能计时器', en: 'Smart timer' },
  stackmat: { zh: 'Stackmat', en: 'Stackmat' },
} as const;

export const TIMER_SMART_CUBE_DEVICE_COPY = {
  en: {
    macLabel: 'Cube MAC address',
    macHint: 'Enter the real Bluetooth MAC address shown for this cube on your Windows computer or in the manufacturer’s app. The name suffix is not a complete address.',
    macInvalid: 'Enter six colon-separated hex octets.',
    clearMac: 'Clear address',
    confirm: 'Confirm',
    battery: 'Battery',
    availableDevices: 'Available devices',
    cancel: 'Cancel',
    close: 'Close',
    connect: 'Connect',
    connected: 'Connected',
    connecting: 'Connecting…',
    connectionFailed: 'Connection failed',
    disconnect: 'Disconnect',
    lastMove: 'Last move',
    notConnected: 'Not connected',
    noDevices: 'No supported smart cubes found',
    resetFailed: 'Software state was reset, but writing to the device failed. Check the connection and retry.',
    resetGyroHint: 'Solve the cube and hold white on top and green in front, then reset the cube',
    resetState: 'Reset',
    retry: 'Retry connection',
    scanAgain: 'Scan again',
    scanning: 'Scanning…',
    signalGood: 'Good signal',
    signalLow: 'Weak signal',
    signalMedium: 'Fair signal',
    stateReset: 'State reset',
    title: 'Smart cube',
  },
  zh: {
    macLabel: '魔方 MAC 地址',
    macHint: '请输入在 Windows 电脑或厂商 App 中查到的这颗魔方的真实蓝牙 MAC 地址。名称末尾的四位字符不是完整地址。',
    macInvalid: '请输入六组用冒号分隔的两位十六进制数。',
    clearMac: '清除地址',
    confirm: '确定',
    battery: '电量',
    availableDevices: '可用设备',
    cancel: '取消',
    close: '关闭',
    connect: '连接',
    connected: '已连接',
    connecting: '连接中…',
    connectionFailed: '连接失败',
    disconnect: '断开',
    lastMove: '最近一步',
    notConnected: '未连接',
    noDevices: '未发现支持的智能魔方',
    resetFailed: '软件状态已重置，但设备回写失败，请检查连接后重试',
    resetGyroHint: '还原魔方并按白顶绿前握好，再重置魔方',
    resetState: '重置',
    retry: '重新连接',
    scanAgain: '重新扫描',
    scanning: '正在扫描…',
    signalGood: '信号良好',
    signalLow: '信号较弱',
    signalMedium: '信号一般',
    stateReset: '状态已重置',
    title: '智能魔方',
  },
} as const;

export function timerSmartCubeBatteryPercent(level?: number | null): number | null {
  return typeof level === 'number' && Number.isFinite(level) ? Math.round(Math.max(0, Math.min(100, level))) : null;
}

export function timerSmartCubeSignalLabel(rssi?: number | null): 'signalGood' | 'signalMedium' | 'signalLow' {
  if (rssi == null || rssi >= -60) return 'signalGood';
  return rssi >= -75 ? 'signalMedium' : 'signalLow';
}

export const BLUETOOTH_TIMER_DIALOG_COPY = {
  title: { zh: '蓝牙智能计时器', en: 'Bluetooth smart timer' },
  instructions: {
    zh: '打开计时器蓝牙，点击搜索，然后选择 QY-Timer、QY-Adapter 或 GAN Timer。',
    en: 'Turn on the timer’s Bluetooth, search, then choose QY-Timer, QY-Adapter, or GAN Timer in the device picker.',
  },
  supported: {
    zh: '支持 GAN 智能计时器、奇艺智能计时器和奇艺转接器。停表后会自动记入当前项目。',
    en: 'Supports GAN Smart Timer, QiYi Timer, and QiYi Adapter. A stopped time is recorded in the current event automatically.',
  },
  connect: { zh: '搜索并连接', en: 'Search & connect' },
  connecting: { zh: '连接中…', en: 'Connecting…' },
  available: { zh: '可用计时器', en: 'Available timers' },
  notFound: { zh: '未找到计时器', en: 'No timer found' },
  searching: {
    zh: '正在搜索计时器…请唤醒计时器并保持靠近。',
    en: 'Searching for timers… Wake your timer and keep it nearby.',
  },
  device: { zh: '设备', en: 'Device' },
  state: { zh: '状态', en: 'State' },
  lastResult: { zh: '最近成绩', en: 'Last result' },
  connectedHelp: {
    zh: '现在直接使用计时器。停表时，设备读数会自动保存并换下一条打乱。',
    en: 'Use the timer normally. When it stops, the device reading is saved and the next scramble is loaded.',
  },
  macLabel: { zh: '计时器 MAC 地址', en: 'Timer MAC address' },
  clearMac: { zh: '清除地址', en: 'Clear address' },
  invalidMac: {
    zh: '请输入 6 组十六进制地址，例如 AA:BB:CC:DD:EE:FF。',
    en: 'Enter six hexadecimal pairs, for example AA:BB:CC:DD:EE:FF.',
  },
  macTip: {
    zh: '地址通常可在奇艺 App 的设备信息或计时器标签中找到。取消后不会建立一个无数据的连接。',
    en: 'The address is usually shown in the QiYi app device info or on the timer label. Cancelling will not create a silent connection.',
  },
  submitMac: { zh: '确定', en: 'Confirm' },
  cancelMac: { zh: '取消连接', en: 'Cancel connection' },
} as const;

export function bluetoothTimerMacInstructions(deviceName: string) {
  return {
    zh: `没有自动读到 ${deviceName || '奇艺计时器'} 的蓝牙地址，请输入设备的 MAC 地址。`,
    en: `The Bluetooth address for ${deviceName || 'the QiYi timer'} could not be detected. Enter its MAC address.`,
  };
}

export const BLUETOOTH_TIMER_KIND_LABELS = {
  'gan-timer': { zh: 'GAN 智能计时器', en: 'GAN Smart Timer' },
  'qiyi-timer': { zh: '奇艺智能计时器 / 转接器', en: 'QiYi Timer / Adapter' },
  'stackmat-mic': { zh: 'Stackmat', en: 'Stackmat' },
  unknown: { zh: '—', en: '—' },
} as const satisfies Record<ExternalTimerKind, { zh: string; en: string }>;

export const BLUETOOTH_TIMER_STATE_LABELS = {
  DISCONNECT: { zh: '未连接', en: 'Disconnected' },
  GET_SET: { zh: '已就绪', en: 'Ready' },
  HANDS_OFF: { zh: '手已离开', en: 'Hands off' },
  RUNNING: { zh: '计时中', en: 'Running' },
  STOPPED: { zh: '已停表', en: 'Stopped' },
  IDLE: { zh: '空闲', en: 'Idle' },
  HANDS_ON: { zh: '双手在垫上', en: 'Hands on' },
  FINISHED: { zh: '成绩已记录', en: 'Result recorded' },
  INSPECTION: { zh: '观察中', en: 'Inspection' },
  GAN_RESET: { zh: '已复位', en: 'Reset' },
} as const satisfies Record<ExternalTimerState, { zh: string; en: string }>;

export type TimerDeviceConnectionPhase =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type TimerDeviceErrorCode =
  | 'permission-denied'
  | 'bluetooth-unavailable'
  | 'device-not-found'
  | 'connection-failed'
  | 'protocol-error'
  | 'disconnected'
  | 'timeout'
  | 'cancelled'
  | 'unknown';

export interface TimerDeviceError {
  code: TimerDeviceErrorCode;
  message?: string;
  retryable: boolean;
}

export type TimerDeviceConnectionEvent =
  | { kind: 'disconnected'; reason: 'gatt-lost' | 'manual' }
  | { kind: 'reconnecting'; attempt: number; maxAttempts: number; delayMs: number }
  | { kind: 'reconnected' }
  | { kind: 'reconnect-failed'; attempts: number }
  | { kind: 'error'; error: TimerDeviceError };

export interface TimerDeviceAvailableDevice {
  id: string;
  name: string;
  rssi?: number;
}

export interface TimerDeviceSnapshot {
  battery?: number | null;
  deviceName?: string | null;
  hasGyro?: boolean;
  lastMove?: string | null;
  phase: TimerDeviceConnectionPhase;
  protocol?: string | null;
  solved?: boolean | null;
}

export type TimerDeviceCapability =
  | 'scan'
  | 'connect'
  | 'disconnect'
  | 'state'
  | 'gyro'
  | 'reset'
  | 'autoTiming';

export type TimerDeviceCapabilities = Readonly<
  Partial<Record<TimerDeviceCapability, boolean>>
>;

/** A device entry that is backed by a host adapter in the current runtime. */
export interface TimerDeviceRegistration {
  capabilities: TimerDeviceCapabilities;
  id: string;
  kind: TimerDeviceKind;
  /** Stable localization key; user-facing copy belongs to the host/UI. */
  labelKey: string;
}

/**
 * The host reports adapter ids rather than handing platform objects to the
 * shared layer. An id absent from this set is never rendered as an entry.
 */
export interface TimerDeviceRegistryInput {
  adapterIds: readonly string[];
  registrations: readonly TimerDeviceRegistration[];
}

export interface TimerDeviceRegistry {
  get(id: string): TimerDeviceRegistration | undefined;
  list(): readonly TimerDeviceRegistration[];
}

function uniqueIds(ids: readonly string[]): ReadonlySet<string> {
  return new Set(ids);
}

/**
 * Build the visible device registry for one host.
 *
 * Registrations are deliberately filtered by adapter id. This prevents a
 * shared UI from displaying smart timers or Stackmat controls before that
 * host has a real transport/permission adapter for them.
 */
export function createTimerDeviceRegistry({
  adapterIds,
  registrations,
}: TimerDeviceRegistryInput): TimerDeviceRegistry {
  const available = uniqueIds(adapterIds);
  const visible = registrations.filter((registration) => available.has(registration.id));
  const byId = new Map(visible.map((registration) => [registration.id, registration]));

  return {
    get: (id) => byId.get(id),
    list: () => visible,
  };
}

/**
 * Canonical registrations for the currently supported smart-cube family.
 * Transport implementations opt in by returning the corresponding id.
 */
export const SMART_CUBE_TIMER_DEVICE_REGISTRATIONS: readonly TimerDeviceRegistration[] = [
  {
    id: 'smart-cube',
    kind: 'smart-cube',
    labelKey: 'smartCube',
    capabilities: {
      connect: true,
      disconnect: true,
      state: true,
      reset: true,
    },
  },
];

export const TIMER_DEVICE_REGISTRATIONS: readonly TimerDeviceRegistration[] = [
  ...SMART_CUBE_TIMER_DEVICE_REGISTRATIONS,
  {
    id: 'smart-timer',
    kind: 'smart-timer',
    labelKey: 'smartTimer',
    capabilities: { connect: true, disconnect: true, autoTiming: true },
  },
  {
    id: 'stackmat',
    kind: 'stackmat',
    labelKey: 'stackmat',
    capabilities: { connect: true, disconnect: true, autoTiming: true },
  },
];
