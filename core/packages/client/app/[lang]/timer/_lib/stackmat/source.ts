/**
 * Stackmat (microphone) as an `ExternalTimerSource`.
 *
 * This is the audio pipeline that used to live inside `useStackmat`: mic
 * capture -> ScriptProcessor -> 1200-baud decoder -> phase machine. It is
 * framework-free; `./index.ts` wraps it in the React hook whose public API has
 * not changed. The reason it moved is the interface: a mic Stackmat, a GAN
 * Smart Timer and a QiYi Timer are the same thing to the UI — a device that
 * hands us a finished time — so they all implement `ExternalTimerSource`
 * (`../bluetooth/timer/types.ts`).
 *
 * Mic permission strategy (unchanged):
 *   - Nothing is requested until `connect()` runs, so the browser's "in use"
 *     indicator only appears once the user asks for it.
 *   - `connect()` rejects if getUserMedia is denied / there is no device / the
 *     page is not on HTTPS; `connected` stays false.
 *   - `disconnect()` stops the MediaStream tracks and closes the AudioContext.
 *
 * Phase machine (unchanged) and its mapping onto the shared vocabulary:
 *   'unknown'   listening, no valid packet yet    -> no event emitted
 *   'idle'      state byte ' '/'I' and time == 0  -> IDLE
 *   'one-hand'  state byte 'A' / 'L' / 'R'        -> HANDS_ON
 *   'starting'  state byte 'C' (both pads)        -> GET_SET
 *   'running'   state byte 'S'                    -> RUNNING
 *   'stopped'   ' '/'I' with time != 0 after run  -> STOPPED (+ solveTime)
 *
 * A Stackmat has no device-side inspection and no post-stop FINISHED state, so
 * `inspectTime`, `INSPECTION`, `HANDS_OFF`, `FINISHED` and `GAN_RESET` never
 * appear from this source.
 */

import {
  createExternalTimerBus,
  type ExternalTimerEvent,
  type ExternalTimerListener,
  type ExternalTimerSource,
  type ExternalTimerState,
} from '../bluetooth/timer/types';
import { createDecoder, feed } from './decoder';
import type { StackmatPacket } from './packet';

export type StackmatPhase =
  | 'unknown'
  | 'idle'
  | 'one-hand'
  | 'starting'
  | 'running'
  | 'stopped';

/** Everything the mic UI needs, sampled once per audio block. */
export interface StackmatSnapshot {
  phase: StackmatPhase;
  /** Total ms on the display; 0 while idle. */
  ms: number;
  listening: boolean;
  /** Smoothed input level 0..1, for the VU meter. */
  signalLevel: number;
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

/**
 * ScriptProcessorNode's event type isn't in every DOM lib we compile against.
 * Narrow alias so we never reach for `any`.
 */
interface AudioProcEvent {
  inputBuffer: { getChannelData(ch: number): Float32Array };
}

const IDLE_SNAPSHOT: StackmatSnapshot = {
  phase: 'unknown',
  ms: 0,
  listening: false,
  signalLevel: 0,
};

export function createStackmatMicSource(): StackmatMicSource {
  const bus = createExternalTimerBus();
  const snapshotListeners = new Set<(s: StackmatSnapshot) => void>();

  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let proc: ScriptProcessorNode | null = null;
  let mute: GainNode | null = null;

  let phase: StackmatPhase = 'unknown';
  let snap: StackmatSnapshot = IDLE_SNAPSHOT;
  let state: ExternalTimerState = 'DISCONNECT';
  let lastTimeMs = 0;

  const publishSnapshot = (next: StackmatSnapshot): void => {
    snap = next;
    for (const l of Array.from(snapshotListeners)) {
      try { l(next); } catch { /* a broken consumer must not kill the audio */ }
    }
  };

  const emit = (ev: ExternalTimerEvent): void => {
    state = ev.state;
    if (ev.state === 'STOPPED' && typeof ev.solveTime === 'number') lastTimeMs = ev.solveTime;
    bus.emit(ev);
  };

  const teardown = (): void => {
    if (proc) {
      proc.onaudioprocess = null;
      try { proc.disconnect(); } catch { /* noop */ }
      proc = null;
    }
    if (mute) {
      try { mute.disconnect(); } catch { /* noop */ }
      mute = null;
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { /* noop */ }
      sourceNode = null;
    }
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
    if (ctx) {
      try { void ctx.close(); } catch { /* noop */ }
      ctx = null;
    }
    // The DecoderState is owned by the onaudioprocess closure we just dropped,
    // so nulling `proc` above is what releases it.
    phase = 'unknown';
  };

  return {
    kind: 'stackmat-mic',
    deviceName: 'Stackmat (microphone)',
    get connected() { return stream !== null; },
    get state() { return state; },
    get lastTimeMs() { return lastTimeMs; },

    subscribe(listener: ExternalTimerListener): () => void {
      return bus.subscribe(listener);
    },

    snapshot(): StackmatSnapshot {
      return snap;
    },

    subscribeSnapshot(listener): () => void {
      snapshotListeners.add(listener);
      return () => { snapshotListeners.delete(listener); };
    },

    async connect(): Promise<void> {
      if (stream) return; // already listening
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('mic-not-supported');
      }

      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (err) {
        // Re-throw so the caller can show a UI message.
        throw err instanceof Error ? err : new Error(String(err));
      }
      stream = media;

      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        teardown();
        throw new Error('audio-not-supported');
      }
      const audioCtx = new Ctor();
      ctx = audioCtx;
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch { /* noop */ }
      }

      sourceNode = audioCtx.createMediaStreamSource(media);
      // ScriptProcessorNode: deprecated but reliable. 1024 samples ~= 23ms @ 44.1kHz.
      const node = audioCtx.createScriptProcessor(1024, 1, 1);
      proc = node;
      const dec = createDecoder(audioCtx.sampleRate);

      node.onaudioprocess = (ev: AudioProcEvent): void => {
        const ch = ev.inputBuffer.getChannelData(0);
        const pkt = feed(dec, ch);

        if (!pkt) {
          // No packet this block — only the level moved.
          publishSnapshot({ ...snap, listening: true, signalLevel: dec.level });
          return;
        }

        const nextPhase = packetToPhase(pkt, phase);
        const ms = nextPhase === 'idle' ? 0 : pkt.totalMs;
        const changed = nextPhase !== phase;
        phase = nextPhase;
        publishSnapshot({ phase: nextPhase, ms, listening: true, signalLevel: dec.level });

        if (!changed) return;
        const mapped = phaseToTimerState(nextPhase);
        if (!mapped) return;
        emit(mapped === 'STOPPED'
          ? { state: 'STOPPED', solveTime: pkt.totalMs }
          : { state: mapped });
      };

      sourceNode.connect(node);
      // Some browsers only run a ScriptProcessorNode when it reaches the
      // destination, so route through a silent gain instead of playing the
      // mic back out loud.
      mute = audioCtx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(audioCtx.destination);

      state = 'IDLE';
      publishSnapshot({ phase: 'unknown', ms: 0, listening: true, signalLevel: 0 });
    },

    async disconnect(): Promise<void> {
      const wasListening = stream !== null;
      teardown();
      publishSnapshot(IDLE_SNAPSHOT);
      if (wasListening) emit({ state: 'DISCONNECT' });
      else state = 'DISCONNECT';
    },
  };
}
