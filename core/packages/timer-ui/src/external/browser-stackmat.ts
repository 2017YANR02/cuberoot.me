/**
 * Stackmat (microphone) as an `ExternalTimerSource`.
 *
 * Mic capture -> ScriptProcessor -> 1200-baud decoder (`./decoder.ts`, a port
 * of csTimer's) -> phase machine. Framework-free; `./index.ts` wraps it in a
 * React hook. A mic Stackmat, a GAN Smart Timer and a QiYi Timer are the same
 * thing to the UI — a device that hands us a finished time — so they all
 * implement `ExternalTimerSource` (`../bluetooth/timer/types.ts`).
 *
 * Input device selection: `connect(deviceId?)` takes an optional
 * `MediaDeviceInfo.deviceId`, and `listInputDevices()` enumerates the choices.
 * This matters more than it sounds — a laptop with a built-in mic will happily
 * hand you the built-in mic while the Stackmat is on a USB sound card, and the
 * page just looks broken. csTimer has the same dropdown for the same reason.
 * The chosen device is remembered in localStorage.
 *
 * Mic permission strategy:
 *   - Nothing is requested until `connect()` runs, so the browser's "in use"
 *     indicator only appears once the user asks for it.
 *   - `connect()` rejects if getUserMedia is denied / there is no device / the
 *     page is not on HTTPS; `connected` stays false.
 *   - Device *labels* are empty until permission has been granted once, which
 *     is why the picker is only useful after the first connect.
 *   - `disconnect()` stops the MediaStream tracks and closes the AudioContext.
 *
 * Phase machine and its mapping onto the shared vocabulary:
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

function persistItem(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
import {
  createExternalTimerBus,
  type ExternalTimerEvent,
  type ExternalTimerListener,
  type ExternalTimerState,
} from '@cuberoot/shared/timer/external/types';
import { createDecoder, feed } from '@cuberoot/shared/timer/external/stackmat-decoder';

export * from '@cuberoot/shared/timer/external/stackmat-state';
import { packetToPhase, phaseToTimerState, type StackmatPhase, type StackmatSnapshot, type StackmatInputDevice, type StackmatMicSource } from '@cuberoot/shared/timer/external/stackmat-state';

/**
 * ScriptProcessorNode's event type isn't in every DOM lib we compile against.
 * Narrow alias so we never reach for `any`.
 */
interface AudioProcEvent {
  inputBuffer: { getChannelData(ch: number): Float32Array };
}

const DEVICE_KEY = 'timer.stackmat.deviceId';

const IDLE_SNAPSHOT: StackmatSnapshot = {
  phase: 'unknown',
  ms: 0,
  listening: false,
  signalLevel: 0,
  signalPresent: false,
  noise: 0,
  stateByte: '',
  unit: 0,
  deviceId: '',
};

function loadDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(DEVICE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function createStackmatMicSource(): StackmatMicSource {
  const bus = createExternalTimerBus();
  const snapshotListeners = new Set<(s: StackmatSnapshot) => void>();

  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let proc: ScriptProcessorNode | null = null;
  let mute: GainNode | null = null;

  let generation = 0;
  let connecting = false;
  let phase: StackmatPhase = 'unknown';
  let snap: StackmatSnapshot = IDLE_SNAPSHOT;
  let state: ExternalTimerState = 'DISCONNECT';
  let lastTimeMs = 0;
  let deviceId = loadDeviceId();

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
    get deviceId() { return deviceId; },

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

    async listInputDevices(): Promise<StackmatInputDevice[]> {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        return all
          .filter(d => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `microphone ${i + 1}` }));
      } catch {
        return [];
      }
    },

    async connect(wantedDeviceId?: string): Promise<void> {
      if (stream || connecting) return; // already listening
      const token = ++generation;
      connecting = true;
      try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('mic-not-supported');
      }

      const useId = wantedDeviceId ?? deviceId;
      // The Stackmat signal IS the "noise" these filters exist to remove, and
      // browser AGC would fight the decoder's own. All three off, always.
      const openMic = (id: string): Promise<MediaStream> => {
        const audio: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        };
        if (id) audio.deviceId = { exact: id };
        return navigator.mediaDevices.getUserMedia({ audio });
      };

      let media: MediaStream;
      let fellBack = false;
      try {
        media = await openMic(useId);
      } catch (err) {
        if(token !== generation) return;
        // A remembered device can disappear (USB sound card unplugged). Fall
        // back to the default input rather than leaving a dead toggle.
        if (!useId) throw err instanceof Error ? err : new Error(String(err));
        try {
          media = await openMic('');
          fellBack = true;
          deviceId = '';
          persistItem(DEVICE_KEY, '');
        } catch {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
      if(token !== generation) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      if (!fellBack && wantedDeviceId !== undefined && wantedDeviceId !== deviceId) {
        deviceId = wantedDeviceId;
        persistItem(DEVICE_KEY, wantedDeviceId);
      }

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

      if(token !== generation) return;
      for (const track of media.getTracks()) track.onended = () => { if(token === generation) { generation++; connecting = false; teardown(); publishSnapshot({...IDLE_SNAPSHOT,deviceId}); emit({state:'DISCONNECT'}); } };
      sourceNode = audioCtx.createMediaStreamSource(media);
      // ScriptProcessorNode: deprecated but reliable. 1024 samples ~= 23ms @ 44.1kHz.
      const node = audioCtx.createScriptProcessor(1024, 1, 1);
      proc = node;
      const dec = createDecoder(audioCtx.sampleRate);

      node.onaudioprocess = (ev: AudioProcEvent): void => {
        const ch = ev.inputBuffer.getChannelData(0);
        const pkt = feed(dec, ch);

        if (!pkt) {
          // No packet this block — only the meters moved. If the line has gone
          // quiet, drop back to 'unknown' so the UI stops claiming a phase it
          // can no longer see.
          const lost = !dec.signalPresent && phase !== 'unknown';
          if (lost) phase = 'unknown';
          publishSnapshot({
            ...snap,
            phase,
            listening: true,
            signalLevel: dec.vu,
            signalPresent: dec.signalPresent,
            noise: dec.noise,
          });
          return;
        }

        const nextPhase = packetToPhase(pkt, phase);
        const ms = nextPhase === 'idle' ? 0 : pkt.totalMs;
        const changed = nextPhase !== phase;
        phase = nextPhase;
        publishSnapshot({
          phase: nextPhase,
          ms,
          listening: true,
          signalLevel: dec.vu,
          signalPresent: true,
          noise: dec.noise,
          stateByte: pkt.state,
          unit: pkt.unit,
          deviceId,
        });

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
      publishSnapshot({ ...IDLE_SNAPSHOT, listening: true, deviceId });
      } catch(error) { if(token === generation) teardown(); throw error; }
      finally { if(token === generation) connecting = false; }
    },

    async disconnect(): Promise<void> {
      generation++; connecting = false;
      const wasListening = stream !== null;
      teardown();
      publishSnapshot({ ...IDLE_SNAPSHOT, deviceId });
      if (wasListening) emit({ state: 'DISCONNECT' });
      else state = 'DISCONNECT';
    },
  };
}
