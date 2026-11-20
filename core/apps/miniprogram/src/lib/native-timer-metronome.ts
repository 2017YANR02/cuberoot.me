import type { TimerPhase } from '@cuberoot/shared/timer/machine';
import {
  clampBpm, createTimerTapTempo, timerMetronomeActive, timerMetronomePulse,
  type TimerMetronomeSettings,
} from '@cuberoot/shared/timer/metronome-settings';
import { createNativeTimerPcmWave, nativeTimerAudioFiles, NATIVE_WAV_HEADER_BYTES } from './native-timer-sound';
import { miniProgramApi } from './platform';

const METRONOME_SAMPLE_RATE = 16000;
const LOOP_DURATION_SECONDS = 40;

/** A full clip of whole beat intervals keeps timing on the audio clock. */
export function renderNativeMetronomeWav(preference: number): ArrayBuffer {
  const interval = 60 / clampBpm(preference);
  const beats = Math.ceil(LOOP_DURATION_SECONDS / interval);
  const framesPerBeat = interval * METRONOME_SAMPLE_RATE;
  const wave = createNativeTimerPcmWave(Math.round(beats * framesPerBeat), METRONOME_SAMPLE_RATE);
  const { body, attack, frequency, gain } = timerMetronomePulse(interval, false);
  const pulseFrames = Math.floor(body * METRONOME_SAMPLE_RATE);
  for (let beat = 0; beat < beats; beat++) {
    const offset = NATIVE_WAV_HEADER_BYTES + Math.round(beat * framesPerBeat) * 2;
    for (let frame = 0; frame < pulseFrames; frame++) {
      const time = frame / METRONOME_SAMPLE_RATE;
      const envelope = Math.min(time / attack, (body - time) / (body - attack));
      const sample = Math.round(Math.sin(2 * Math.PI * frequency * time) * envelope * gain * 32767);
      wave.setInt16(offset + 2 * frame, sample, true);
    }
  }
  return wave.buffer;
}

type NativeMetronomeAudio = Pick<WechatMiniprogram.InnerAudioContext, 'src' | 'loop' | 'play' | 'destroy' | 'onError'>;
type NativeMetronomeApi = Parameters<typeof nativeTimerAudioFiles>[0] & {
  createInnerAudioContext(): NativeMetronomeAudio;
  getDeviceInfoSync?(): { platform?: string };
  getSystemInfoSync?(): { platform?: string };
};

export function nativeTimerMetronomeAvailable(api?: NativeMetronomeApi): boolean {
  try {
    const native: NativeMetronomeApi = api ?? miniProgramApi();
    const platform = native.getDeviceInfoSync?.()?.platform ?? native.getSystemInfoSync?.()?.platform;
    // Douyin Android shares a single underlying audio source across all native contexts.
    return platform?.toLowerCase() === 'ios' && typeof native.createInnerAudioContext === 'function'
      && !!nativeTimerAudioFiles(native);
  } catch { return false; }
}

export function createNativeTimerMetronome(
  getSettings: () => Pick<TimerMetronomeSettings, 'metronomeOn' | 'metronomeBpm'>,
  clock: { now(): number; isVisible(): boolean },
  api: NativeMetronomeApi = miniProgramApi(),
) {
  const tap = createTimerTapTempo(clock.now);
  let audio: NativeMetronomeAudio | undefined;
  let playingBpm: number | undefined;
  let clipBpm: number | undefined;
  let failedBpm: number | undefined;
  let disposed = false;

  function prepare(bpm: number) {
    const files = nativeTimerAudioFiles(api);
    if (!files) return;
    const { fs, path } = files;
    const file = `${path}/metronome.wav`;
    if (clipBpm !== bpm) {
      try { fs.mkdirSync(path); } catch { /* The directory may already exist. */ }
      fs.writeFileSync(file, renderNativeMetronomeWav(bpm));
      clipBpm = bpm;
    }
    return file;
  }

  function stop() {
    const previous = audio;
    audio = undefined;
    playingBpm = undefined;
    try { previous?.destroy(); } catch { /* Tearing down audio cannot affect the timer. */ }
  }

  return {
    warmup() {
      if (disposed || audio || !nativeTimerMetronomeAvailable(api)) return;
      failedBpm = undefined;
      try { prepare(clampBpm(getSettings().metronomeBpm)); } catch { /* Retry once on the active beat. */ }
    },
    sync(phase: TimerPhase) {
      const settings = getSettings();
      if (disposed || !clock.isVisible() || !timerMetronomeActive(phase, settings.metronomeOn)) {
        stop();
        failedBpm = undefined;
        return;
      }
      const bpm = clampBpm(settings.metronomeBpm);
      if (playingBpm === bpm || failedBpm === bpm || !nativeTimerMetronomeAvailable(api)) return;
      stop();
      try {
        const source = prepare(bpm);
        if (!source) return;
        const player = api.createInnerAudioContext();
        audio = player;
        playingBpm = bpm;
        player.onError(() => {
          if (audio !== player) return;
          failedBpm = bpm;
          stop();
        });
        player.loop = true;
        player.src = source;
        if (audio === player) player.play();
      } catch {
        failedBpm = bpm;
        stop();
      }
    },
    tapTempo: tap.tap,
    hide() { stop(); tap.reset(); failedBpm = undefined; },
    dispose() { disposed = true; stop(); tap.reset(); },
  };
}
