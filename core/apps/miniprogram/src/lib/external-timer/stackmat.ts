import { createDecoder, feed } from '@cuberoot/shared/timer/external/stackmat-decoder';
import { packetToPhase, phaseToTimerState, type StackmatPhase } from '@cuberoot/shared/timer/external/stackmat-state';
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import { miniProgramApi, isDouyinMiniProgram } from '../platform';
import { tr } from '../i18n';
import type { BleAbortSignal } from '../smart-cube/ble-api';

// WeChat delivers signed 16-bit little-endian mono PCM. Never feed compressed
// AAC/MP3 bytes into the Stackmat decoder. Recording stays on this device.
export function createStackmatPcmReceiver(onEvent: (event: ExternalTimerEvent) => void) {
  const decoder = createDecoder(44100);
  let phase: StackmatPhase = 'unknown';
  let tail: number | undefined;
  return (buffer: ArrayBuffer): void => {
    const incoming = new Uint8Array(buffer);
    const bytes = new Uint8Array(incoming.length + (tail === undefined ? 0 : 1));
    if (tail !== undefined) bytes[0] = tail;
    bytes.set(incoming, tail === undefined ? 0 : 1);
    tail = bytes.length % 2 ? bytes[bytes.length - 1] : undefined;
    const view = new DataView(bytes.buffer);
    // Small blocks preserve every state transition even when a native callback
    // batches several Stackmat packets. The decoder retains partial frames.
    for (let offset = 0; offset + 1 < bytes.length; offset += 512) {
      const count = Math.min(256, Math.floor((bytes.length - offset) / 2));
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) samples[i] = view.getInt16(offset + i * 2, true) / 32768;
      const packet = feed(decoder, samples);
      if (!packet) {
        if (!decoder.signalPresent && phase !== 'unknown') { phase = 'unknown'; onEvent({ state: 'DISCONNECT' }); }
        continue;
      }
      phase = packetToPhase(packet, phase);
      const state = phaseToTimerState(phase);
      if (state) onEvent({ state, solveTime: packet.totalMs });
    }
  };
}

// RecorderManager has no documented off-listener API. Register one dispatcher
// for its lifetime, and replace only the session-owned callbacks.
let recorderInstance: WechatMiniprogram.RecorderManager | undefined;
let recorderStopping: Promise<void> | undefined;
let finishStopping: (() => void) | undefined;
let recorderCallbacks: { start(): void; stop(interrupted?: boolean): void; error(error: { errMsg: string }): void; frame(result: { frameBuffer: ArrayBuffer }): void } | undefined;
function getRecorder() {
  if (!recorderInstance) {
    recorderInstance = miniProgramApi().getRecorderManager();
    recorderInstance.onStart(() => recorderCallbacks?.start());
    recorderInstance.onStop(() => { const stop = recorderCallbacks?.stop; finishStopping?.(); finishStopping = undefined; recorderStopping = undefined; stop?.(); });
    recorderInstance.onError(error => { finishStopping?.(); finishStopping = undefined; recorderStopping = undefined; recorderCallbacks?.error(error); });
    recorderInstance.onPause(() => recorderCallbacks?.stop(true));
    recorderInstance.onInterruptionBegin(() => recorderCallbacks?.stop(true));
    recorderInstance.onFrameRecorded(result => recorderCallbacks?.frame(result));
  }
  return recorderInstance;
}

export async function connectNativeStackmat(options: {
  signal?: BleAbortSignal;
  onEvent(event: ExternalTimerEvent): void;
  onDisconnect(): void;
}): Promise<{ deviceName: string; disconnect(): Promise<void> }> {
  if (isDouyinMiniProgram()) throw new Error(tr({ en: 'Stackmat PCM input is currently available in WeChat only.', zh: 'Stackmat PCM 输入目前仅适配微信小程序' }));
  if (recorderStopping) await Promise.race([recorderStopping, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RECORDER_STILL_STOPPING')), 2000))]);
  if (options.signal?.aborted) throw new Error('TIMER_CONNECTION_CANCELLED');
  const recorder = getRecorder();
  let offAbort = () => {};
  let requested = false;
  let closed = false;
  let started = false;
  const receive = createStackmatPcmReceiver(options.onEvent);
  const onFrame = (result: { frameBuffer: ArrayBuffer }): void => {
    if (!closed && started) receive(result.frameBuffer);
  };
  let rejectStart: (error: Error) => void = () => {};
  const disconnect = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    offAbort();
    recorderCallbacks = undefined;
    if (requested) {
      recorderStopping = new Promise<void>(resolve => { finishStopping = resolve; });
      recorder.stop();
    }
  };
  const onStop = (interrupted = false): void => {
    if (!interrupted) requested = false;
    if (closed) return;
    rejectStart(new Error('STACKMAT_RECORDING_INTERRUPTED'));
    void disconnect();
    options.onDisconnect();
  };
  const onError = (error: { errMsg: string }): void => {
    rejectStart(new Error(error.errMsg));
    requested = false;
    onStop();
  };
  let resolveStart: () => void = () => {};
  const onStart = (): void => { if (!closed) { started = true; resolveStart(); } };
  const timeout = setTimeout(() => onError({ errMsg: tr({ en: 'Microphone start timed out.', zh: '麦克风启动超时' }) }), 10000);
  try {
    await new Promise<void>((resolve, reject) => {
      resolveStart = resolve; rejectStart = reject;
      recorderCallbacks = { start: onStart, stop: onStop, error: onError, frame: onFrame };
      offAbort = options.signal?.onAbort(() => onError({ errMsg: 'TIMER_CONNECTION_CANCELLED' })) ?? offAbort;
      if (closed) return;
      requested = true;
      recorder.start({ format: 'PCM', sampleRate: 44100, numberOfChannels: 1, frameSize: 1, duration: 600000, audioSource: 'auto' });
    });
    clearTimeout(timeout);
    return { deviceName: 'Stackmat', disconnect };
  } catch (error) { await disconnect(); throw error; }
}
