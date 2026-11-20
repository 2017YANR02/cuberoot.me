import type { ExternalTimerSource, ExternalTimerState } from './types';
import type { StackmatPacket } from './stackmat-packet';
export type StackmatPhase =
  | 'unknown'
  | 'idle'
  | 'one-hand'
  | 'starting'
  | 'running'
  | 'stopped';

/** One selectable audio input. */
export interface StackmatInputDevice {
  deviceId: string;
  label: string;
}

/** Everything the mic UI needs, sampled once per audio block. */
export interface StackmatSnapshot {
  phase: StackmatPhase;
  /** Total ms on the display; 0 while idle. */
  ms: number;
  listening: boolean;
  /** Smoothed input level 0..1, for the VU meter. */
  signalLevel: number;
  /** True once frames are decoding; false when the line has gone quiet. */
  signalPresent: boolean;
  /** Decoder noise estimate 0..1 — high means "something is there, but it isn't Stackmat". */
  noise: number;
  /** Raw state byte of the last valid frame; '' before the first one. */
  stateByte: string;
  /** Resolution the device reports: 1 = ms, 10 = centiseconds, 0 = unknown. */
  unit: 0 | 1 | 10;
  /** deviceId currently in use, '' when using the system default. */
  deviceId: string;
}

export const STACKMAT_IDLE_SNAPSHOT: Readonly<StackmatSnapshot> = {
  phase: 'unknown', ms: 0, listening: false, signalLevel: 0, signalPresent: false,
  noise: 0, stateByte: '', unit: 0, deviceId: '',
};

export function stackmatHealth(snapshot: Pick<StackmatSnapshot, 'listening' | 'signalPresent' | 'signalLevel'>) {
  if (!snapshot.listening) return 'off';
  if (snapshot.signalPresent) return 'ok';
  return snapshot.signalLevel < 0.02 ? 'silent' : 'wrong-signal';
}

export type StackmatHealth = ReturnType<typeof stackmatHealth>;

export const STACKMAT_HEALTH_LABELS = {
  off: { zh: '未监听', en: 'Not listening' },
  silent: { zh: '没有输入信号', en: 'No input signal' },
  'wrong-signal': { zh: '有声音，但不是 Stackmat 数据', en: 'Audio present, but not Stackmat data' },
  ok: { zh: '已连接，正在解码', en: 'Connected, decoding' },
} as const;

export const STACKMAT_PHASE_LABELS = {
  idle: { zh: '空闲', en: 'Idle' },
  'one-hand': { zh: '单手在垫上', en: 'One hand down' },
  starting: { zh: '双手就绪', en: 'Both hands, ready' },
  running: { zh: '计时中', en: 'Running' },
  stopped: { zh: '已停表', en: 'Stopped' },
  unknown: { zh: '—', en: '—' },
} as const satisfies Record<StackmatPhase, { zh: string; en: string }>;

export const STACKMAT_DIALOG_COPY = {
  title: { zh: 'Stackmat 计时器', en: 'Stackmat timer' },
  instructions: {
    zh: '用一根 3.5 mm 音频线把计时器的数据口接到设备的麦克风输入，本页直接解码它发出的信号，停表后自动记成绩。',
    en: 'Run a 3.5 mm cable from the timer’s data jack into your device’s microphone input. This page decodes the signal directly and records the solve when the timer stops.',
  },
  compatibility: {
    zh: '支持 Gen 3 / Gen 4，毫秒和百分秒两种固件都行，线的极性接反也能解。',
    en: 'Works with Gen 3 / Gen 4, both millisecond and centisecond firmwares, and with either cable polarity.',
  },
  level: { zh: '电平', en: 'Level' },
  state: { zh: '计时器状态', en: 'Timer state' },
  reading: { zh: '显示读数', en: 'Reading' },
  resolution: { zh: '精度', en: 'Resolution' },
  ms: { zh: '毫秒（Gen 4）', en: 'milliseconds (Gen 4)' },
  cs: { zh: '百分秒（Gen 3）', en: 'centiseconds (Gen 3)' },
  input: { zh: '输入设备', en: 'Input device' },
  defaultInput: { zh: '系统默认', en: 'System default' },
  start: { zh: '开始监听', en: 'Start listening' },
  starting: { zh: '正在启用…', en: 'Starting…' },
  stop: { zh: '停止监听', en: 'Stop listening' },
  close: { zh: '关闭', en: 'Close' },
  wrongSignal: {
    zh: '听到的多半是内置麦克风。在下面选中计时器所接的那个输入设备。',
    en: 'That is probably the built-in microphone. Pick the input the timer is plugged into below.',
  },
  silent: {
    zh: '检查：线是否插在麦克风/输入口（不是耳机口）、计时器是否开机、系统输入音量是否为 0。',
    en: 'Check: cable in the mic/line input (not the headphone jack), timer powered on, and system input volume above zero.',
  },
} as const;

export interface StackmatMicSource extends ExternalTimerSource {
  readonly kind: 'stackmat-mic';
  /** Current snapshot; cheap, safe to call in a render. */
  snapshot(): StackmatSnapshot;
  /**
   * Fires on EVERY audio block (~43 Hz at 44.1 kHz / 1024 samples), not just
   * on state changes, because the level meter has to keep moving. Consumers
   * are expected to coalesce (the React adapter drains onto rAF).
   */
  subscribeSnapshot(listener: (s: StackmatSnapshot) => void): () => void;
  /** Audio inputs to choose from. Labels are blank until mic permission exists. */
  listInputDevices(): Promise<StackmatInputDevice[]>;
  /** Connect, optionally pinning a specific input device. */
  connect(deviceId?: string): Promise<void>;
  /** The remembered device id ('' = system default). */
  readonly deviceId: string;
}

export function packetToPhase(pkt: StackmatPacket, prev: StackmatPhase): StackmatPhase {
  switch (pkt.state) {
    case 'S': return 'running';
    case 'C': return 'starting';
    case 'A':
    case 'L':
    case 'R': return 'one-hand';
    case ' ':
    case 'I':
      // ' ' after a run with non-zero time = stopped; otherwise idle.
      // Carry 'stopped' forward as long as we haven't moved to a hand-on state.
      if (prev === 'running' && pkt.totalMs > 0) return 'stopped';
      if (prev === 'stopped' && pkt.totalMs > 0) return 'stopped';
      return pkt.totalMs === 0 ? 'idle' : 'stopped';
    default: return prev;
  }
}

/** Phase -> shared vocabulary. 'unknown' has no counterpart: emit nothing. */
export function phaseToTimerState(phase: StackmatPhase): ExternalTimerState | null {
  switch (phase) {
    case 'idle': return 'IDLE';
    case 'one-hand': return 'HANDS_ON';
    case 'starting': return 'GET_SET';
    case 'running': return 'RUNNING';
    case 'stopped': return 'STOPPED';
    case 'unknown': return null;
  }
}
