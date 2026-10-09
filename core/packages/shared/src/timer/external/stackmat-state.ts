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
