import { createDecoder, feed } from '@cuberoot/shared/timer/external/stackmat-decoder';
import { STACKMAT_IDLE_SNAPSHOT, packetToPhase, phaseToTimerState, type StackmatPhase, type StackmatSnapshot } from '@cuberoot/shared/timer/external/stackmat-state';
import type { ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
import { miniProgramApi, isDouyinMiniProgram } from '../platform';
import { tr } from '../i18n';
import type { BleAbortSignal } from '../smart-cube/ble-api';

const SAMPLE_RATE = 44_100;
const DOUYIN_AUDIO_DURATION = 60_000;
type DouyinRecorderStart = (options: Omit<WechatMiniprogram.RecorderManagerStartOption, 'format'> & { format: 'pcm' }) => void;

export function nativeStackmatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'mic-not-supported') return tr({ en: 'Microphone capture is unavailable here.', zh: '当前环境无法使用麦克风' });
  if (/not declared in the privacy agreement/i.test(message)) return tr({ en: 'Microphone use has yet to be declared in this mini program’s privacy agreement.', zh: '小程序还未在隐私协议中声明麦克风用途' });
  if (/permission|auth(?:orize)? (?:deny|denied)|not authorized/i.test(message)) return tr({
    en: 'Microphone access was denied. Allow it in system or mini program permissions and retry.',
    zh: '麦克风权限被拒绝。请在系统或小程序权限设置中允许后重试。',
  });
  return tr({ en: `Mic error: ${message}`, zh: `麦克风启用失败：${message}` });
}

// The recorder is configured for signed 16-bit little-endian mono PCM.
export function createStackmatPcmReceiver(
  onEvent: (event: ExternalTimerEvent) => void,
  onSnapshot?: (snapshot: StackmatSnapshot) => void,
) {
  let decoder = createDecoder(SAMPLE_RATE);
  let phase: StackmatPhase = 'unknown';
  let tail: number | undefined;
  const receive = (buffer: ArrayBuffer): void => {
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
        if (!decoder.signalPresent && decoder.lastPacket && phase !== 'unknown') { phase = 'unknown'; onEvent({ state: 'DISCONNECT' }); }
        continue;
      }
      phase = packetToPhase(packet, phase);
      const state = phaseToTimerState(phase);
      if (state) onEvent({ state, solveTime: packet.totalMs });
    }
    const packet = decoder.lastPacket;
    onSnapshot?.({
      ...STACKMAT_IDLE_SNAPSHOT,
      phase: decoder.signalPresent ? phase : 'unknown',
      listening: true,
      ms: packet?.totalMs ?? 0,
      signalLevel: decoder.vu,
      signalPresent: decoder.signalPresent,
      noise: decoder.noise,
      stateByte: packet?.state ?? '',
      unit: packet?.unit ?? 0,
    });
  };
  return Object.assign(receive, {
    // Chunks within a native recording are contiguous. The next recording
    // starts a fresh byte/bit stream while the timer keeps its attempt state.
    newRecording() { decoder = createDecoder(SAMPLE_RATE); tail = undefined; },
  });
}

// RecorderManager has no documented off-listener API. Register one dispatcher
// for its lifetime, and replace only the session-owned callbacks.
let recorderInstance: WechatMiniprogram.RecorderManager | undefined;
let recorderStopping: Promise<void> | undefined;
let finishStopping: (() => void) | undefined;
let recorderCallbacks: { start(): void; stop(interrupted: boolean, duration?: number): void; error(error: { errMsg: string }): void; frame(result: { frameBuffer: ArrayBuffer }): void } | undefined;
function getRecorder() {
  if (!recorderInstance) {
    const recorder = miniProgramApi().getRecorderManager?.();
    if (!recorder || typeof recorder.onFrameRecorded !== 'function') throw new Error('mic-not-supported');
    recorder.onStart(() => recorderCallbacks?.start());
    recorder.onStop(result => { const stop = recorderCallbacks?.stop; clearRecorderOwner(); stop?.(false, result?.duration); });
    recorder.onError(error => { const onError = recorderCallbacks?.error; clearRecorderOwner(); onError?.(error); });
    recorder.onPause(() => recorderCallbacks?.stop(true));
    recorder.onInterruptionBegin?.(() => recorderCallbacks?.stop(true));
    recorder.onFrameRecorded(result => recorderCallbacks?.frame(result));
    recorderInstance = recorder;
  }
  return recorderInstance;
}

function clearRecorderOwner() {
  recorderCallbacks = undefined;
  finishStopping?.();
  finishStopping = undefined;
  recorderStopping = undefined;
}

export async function connectNativeStackmat(options: {
  signal?: BleAbortSignal;
  onEvent(event: ExternalTimerEvent): void;
  onSnapshot?(snapshot: StackmatSnapshot): void;
  onDisconnect(error?: Error): void;
}): Promise<{ deviceName: string; disconnect(): Promise<void> }> {
  const douyin = isDouyinMiniProgram();
  if (recorderStopping) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([recorderStopping, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('RECORDER_STILL_STOPPING')), 2000); })]); }
    finally { clearTimeout(timer); }
  }
  if (recorderCallbacks) throw new Error('RECORDER_ALREADY_ACTIVE');
  if (options.signal?.aborted) throw new Error('TIMER_CONNECTION_CANCELLED');
  const recorder = getRecorder();
  let offAbort = () => {};
  let requested = false;
  let closed = false;
  let started = false;
  let startedAt = 0;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let frameTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const receive = createStackmatPcmReceiver(options.onEvent, options.onSnapshot);
  const onFrame = (result: { frameBuffer: ArrayBuffer }): void => {
    if (closed || !started || !result.frameBuffer?.byteLength) return;
    if (frameTimer !== undefined) { clearTimeout(frameTimer); frameTimer = undefined; }
    receive(result.frameBuffer);
  };
  let rejectStart: (error: Error) => void = () => {};
  const disconnect = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    clearTimeout(startupTimer);
    clearTimeout(frameTimer);
    clearTimeout(restartTimer);
    offAbort();
    if (!requested) recorderCallbacks = undefined;
    if (requested) {
      recorderStopping = new Promise<void>(resolve => { finishStopping = resolve; });
      recorder.stop();
    }
  };
  const onStop = (interrupted: boolean, duration?: number): void => {
    if (!interrupted) requested = false;
    if (closed) return;
    const elapsed = duration ?? Date.now() - startedAt;
    if (douyin && !interrupted && started && elapsed >= DOUYIN_AUDIO_DURATION - 500) {
      started = false;
      clearTimeout(frameTimer);
      recorderCallbacks = callbacks;
      restartTimer = setTimeout(() => {
        receive.newRecording();
        startRecording();
      }, 0);
      return;
    }
    cancel(new Error(tr({ en: 'Microphone listening was interrupted.', zh: '麦克风监听已中断' })));
  };
  const onError = (error: { errMsg: string }): void => {
    requested = false;
    cancel(new Error(error.errMsg));
  };
  let resolveStart: () => void = () => {};
  const onStart = (): void => {
    if (closed) { recorder.stop(); return; }
    if (started) return;
    started = true;
    startedAt = Date.now();
    clearTimeout(startupTimer);
    if (douyin) frameTimer = setTimeout(() => cancel(new Error(tr({
      en: 'The microphone did not provide PCM audio. Reconnect the input and try again.',
      zh: '麦克风未返回 PCM 音频，请重新连接输入设备后重试。',
    }))), 5_000);
    resolveStart();
  };
  const cancel = (error: Error, notify = true): void => {
    if (closed) return;
    rejectStart(error);
    void disconnect();
    if (notify) options.onDisconnect(error);
  };
  const callbacks = { start: onStart, stop: onStop, error: onError, frame: onFrame };
  const startRecording = () => {
    startupTimer = setTimeout(() => cancel(new Error(tr({ en: 'Microphone start timed out.', zh: '麦克风启动超时' }))), douyin ? 30_000 : 10_000);
    requested = true;
    try {
      if (douyin) {
        // The native Typings model WeChat's uppercase PCM option.
        const start = recorder.start as unknown as DouyinRecorderStart;
        start.call(recorder, { format: 'pcm', sampleRate: SAMPLE_RATE, numberOfChannels: 1, encodeBitRate: 128_000, frameSize: 1, duration: DOUYIN_AUDIO_DURATION });
      } else {
        recorder.start({ format: 'PCM', sampleRate: SAMPLE_RATE, numberOfChannels: 1, frameSize: 1, duration: 600_000, audioSource: 'auto' });
      }
    } catch (error) {
      requested = false;
      cancel(error instanceof Error ? error : new Error(String(error)));
    }
  };
  try {
    await new Promise<void>((resolve, reject) => {
      resolveStart = resolve; rejectStart = reject;
      recorderCallbacks = callbacks;
      offAbort = options.signal?.onAbort(() => cancel(new Error('TIMER_CONNECTION_CANCELLED'), false)) ?? offAbort;
      if (!closed) startRecording();
    });
    return { deviceName: 'Stackmat', disconnect };
  } catch (error) { await disconnect(); throw error; }
}
