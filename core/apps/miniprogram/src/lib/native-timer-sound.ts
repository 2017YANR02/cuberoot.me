import type { TimerMachineTransition } from '@cuberoot/shared/timer/machine';
import type { TimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import {
  TIMER_AUDIO_CUES,
  TIMER_AUDIO_NOTE_ATTACK_MS,
  TIMER_AUDIO_NOTE_GAIN,
  TIMER_AUDIO_NOTE_GAP_MS,
  TIMER_INSPECTION_BEEP,
  TIMER_INSPECTION_VOICE_PHRASES,
  createTimerSoundFeedback,
  isTimerInspectionVoiceCue,
  type TimerAudioCue,
  type TimerAudioNote,
  type TimerInspectionVoiceCue,
} from '@cuberoot/shared/timer/sound-feedback';
import { nativeUserDataPath, type NativeFileEnvironment } from './native-file-path';
import { isDouyinMiniProgram, miniProgramApi } from './platform';

export type NativeTimerCue = TimerAudioCue | 'inspection-beep';
const SAMPLE_RATE = 24000;
export const NATIVE_WAV_HEADER_BYTES = 44;

export function createNativeTimerPcmWave(samples: number, sampleRate: number): DataView<ArrayBuffer> {
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(NATIVE_WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646); // RIFF
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(8, 0x57415645); // WAVE
  view.setUint32(12, 0x666d7420); // fmt
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461); // data
  view.setUint32(40, dataBytes, true);
  return view;
}

/** Render the same cue notes and envelope as the Web Audio adapter, as PCM WAV. */
export function renderNativeTimerCueWav(cue: NativeTimerCue): ArrayBuffer {
  const notes: readonly TimerAudioNote[] = cue === 'inspection-beep' ? [TIMER_INSPECTION_BEEP] : TIMER_AUDIO_CUES[cue];
  const samplesPerMs = SAMPLE_RATE / 1000;
  const samples = (notes.reduce((duration, note) => duration + note.ms, 0)
    + (notes.length - 1) * TIMER_AUDIO_NOTE_GAP_MS) * samplesPerMs;
  const view = createNativeTimerPcmWave(samples, SAMPLE_RATE);

  let offset = NATIVE_WAV_HEADER_BYTES;
  for (const note of notes) {
    const attack = TIMER_AUDIO_NOTE_ATTACK_MS * samplesPerMs;
    const length = note.ms * samplesPerMs;
    for (let index = 0; index < length; index++) {
      const position = index * note.freq / SAMPLE_RATE;
      const wave = note.type === 'sawtooth' ? 2 * (position - Math.round(position)) : Math.sin(2 * Math.PI * position);
      const envelope = Math.min(index / attack, (length - index) / (length - attack));
      view.setInt16(offset + index * 2, Math.round(wave * envelope * TIMER_AUDIO_NOTE_GAIN * 32767), true);
    }
    offset += (length + TIMER_AUDIO_NOTE_GAP_MS * samplesPerMs) * 2;
  }
  return view.buffer;
}

type NativeSoundSettings = Pick<TimerStoreSettings, 'soundsEnabled' | 'volume' | 'inspectionBeepAt' | 'voiceInspection'>;
type VoiceVariant = Exclude<NativeSoundSettings['voiceInspection'], 'none'>;
type Playback = { cue: TimerInspectionVoiceCue; voice: VoiceVariant } | { cue: NativeTimerCue; voice?: never };
type NativeAudio = Pick<WechatMiniprogram.InnerAudioContext, 'src' | 'volume' | 'play' | 'destroy' | 'onEnded' | 'onError'>;
type NativeAudioFilesApi = NativeFileEnvironment & {
  getFileSystemManager?(): Pick<WechatMiniprogram.FileSystemManager, 'mkdirSync' | 'writeFileSync'>
    & Partial<Pick<WechatMiniprogram.FileSystemManager, 'readFileSync'>>;
};
type NativeAudioApi = NativeAudioFilesApi & { createInnerAudioContext(): NativeAudio };

export function nativeTimerAudioFiles(api: NativeAudioFilesApi) {
  const path = nativeUserDataPath(api);
  const fs = api.getFileSystemManager?.();
  if (path && typeof fs?.mkdirSync === 'function' && typeof fs.writeFileSync === 'function') return { fs, path: `${path}/timer-audio` };
}

export function nativeTimerSoundAvailable(api?: NativeAudioApi): boolean {
  try {
    const native = api ?? miniProgramApi();
    return typeof native.createInnerAudioContext === 'function' && !!nativeTimerAudioFiles(native);
  } catch { return false; }
}

export function nativeTimerVoiceAvailable(api?: NativeAudioApi): boolean {
  if (!isDouyinMiniProgram()) return false;
  try {
    const native = api ?? miniProgramApi();
    return typeof native.createInnerAudioContext === 'function'
      && typeof nativeTimerAudioFiles(native)?.fs.readFileSync === 'function';
  } catch { return false; }
}

function createNativeCueSource(api: NativeAudioApi) {
  const written = new Map<NativeTimerCue, string>();
  return (cue: NativeTimerCue): string | undefined => {
    const previous = written.get(cue);
    if (previous) return previous;
    const files = nativeTimerAudioFiles(api);
    if (!files) return;
    const { fs, path } = files;
    const file = `${path}/${cue}.wav`;
    try { fs.mkdirSync(path); }
    catch { /* Existing directories are expected and the file write checks access. */ }
    fs.writeFileSync(file, renderNativeTimerCueWav(cue));
    written.set(cue, file);
    return file;
  };
}

function createNativeVoiceSource(api: NativeAudioApi) {
  const written = new Map<string, string>();
  return (cue: TimerInspectionVoiceCue, voice: VoiceVariant): string | undefined => {
    const name = `${voice}-${cue}.mp3`;
    const previous = written.get(name);
    if (previous) return previous;
    try {
      const files = nativeTimerAudioFiles(api);
      if (!files) return;
      const { fs, path } = files;
      const data = fs.readFileSync?.(`assets/timer-voice/${name}`);
      if (typeof data === 'string' || !data?.byteLength) return;
      try { fs.mkdirSync(path); }
      catch { /* The note player may have already created the directory. */ }
      const file = `${path}/${name}`;
      fs.writeFileSync(file, data);
      written.set(name, file);
      return file;
    } catch { return undefined; }
  };
}

/** One native player for both bundled speech and generated tones. */
export function createNativeTimerSound(
  getSettings: () => NativeSoundSettings,
  options: { now(): number; isVisible(): boolean; cueSource?(cue: NativeTimerCue): string | undefined },
  api: NativeAudioApi = miniProgramApi(),
) {
  const cueSource = options.cueSource ?? createNativeCueSource(api);
  const voiceSource = nativeTimerVoiceAvailable(api) ? createNativeVoiceSource(api) : undefined;
  let context: NativeAudio | undefined;
  let queued: Playback[] = [];
  let active: Playback | undefined;
  let disposed = false;

  function releaseContext() {
    const audio = context;
    context = undefined;
    active = undefined;
    try { audio?.destroy(); }
    catch { /* Playback teardown must not affect the timer. */ }
  }

  function finish(audio: NativeAudio, failed: boolean) {
    if (context !== audio || !active) return;
    if (failed && active.voice) queued.unshift({ cue: active.cue });
    active = undefined;
    playNext();
  }

  function playNext() {
    if (active) return;
    if (disposed || !options.isVisible()) { queued.length = 0; return; }
    while (queued.length > 0) {
      const request = queued.shift()!;
      const { cue, voice } = request;
      try {
        const { soundsEnabled, volume } = getSettings();
        if ((cue !== 'inspection-beep' && !soundsEnabled) || volume <= 0) continue;
        const speech = voice ? voiceSource?.(cue, voice) : undefined;
        const source = speech ?? cueSource(cue);
        if (!source) continue;
        if (!context) {
          const audio = api.createInnerAudioContext();
          context = audio;
          audio.onEnded(() => finish(audio, false));
          audio.onError(() => finish(audio, true));
        }
        const audio = context;
        const playback = speech ? request : { cue };
        active = playback;
        audio.volume = volume;
        audio.src = source;
        if (active === playback) audio.play();
        return;
      } catch {
        const interruptedSpeech = active?.voice;
        releaseContext();
        if (interruptedSpeech) queued.unshift({ cue });
      }
    }
  }

  function play(cue: NativeTimerCue) {
    if (disposed || !options.isVisible()) return;
    const { voiceInspection } = getSettings();
    const speech = voiceSource && voiceInspection !== 'none' && cue !== 'inspection-beep' && isTimerInspectionVoiceCue(cue);
    queued.push(speech ? { cue, voice: voiceInspection } : { cue });
    playNext();
  }

  const feedback = createTimerSoundFeedback({
    play,
    cancelVoice() {
      queued = queued.filter(clip => !clip.voice);
      if (!active?.voice) return;
      releaseContext();
      playNext();
    },
    getInspectionBeepAt: () => getSettings().inspectionBeepAt,
    playInspectionBeep: () => play('inspection-beep'),
  }, options);

  function hide() {
    queued.length = 0;
    releaseContext();
    feedback.dispose();
  }

  return {
    onTransition(result: TimerMachineTransition) {
      if (!disposed && options.isVisible()) feedback.onTransition(result);
    },
    warmupSound() {
      if (disposed) return;
      try {
        for (const cue of Object.keys(TIMER_AUDIO_CUES) as TimerAudioCue[]) cueSource(cue);
        cueSource('inspection-beep');
        const { voiceInspection } = getSettings();
        if (voiceSource && voiceInspection !== 'none') {
          for (const cue of Object.keys(TIMER_INSPECTION_VOICE_PHRASES) as TimerInspectionVoiceCue[]) {
            voiceSource(cue, voiceInspection);
          }
        }
      } catch { /* Only audio playback is affected when the cache cannot be created. */ }
    },
    playInspectionBeep: () => play('inspection-beep'),
    playStartPreview: () => play('start'),
    hide,
    dispose() { disposed = true; hide(); },
  };
}
