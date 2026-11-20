import { expect, it, vi } from 'vitest';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { initialTimerMachineState } from '@cuberoot/shared/timer/machine';
import { createNativeTimerMetronome, nativeTimerMetronomeAvailable, renderNativeMetronomeWav } from '../src/lib/native-timer-metronome';
import { createNativeTimerSound, NATIVE_WAV_HEADER_BYTES } from '../src/lib/native-timer-sound';
import { nativeTimerSettingPatch, nativeTimerSettingsModel } from '../src/lib/native-timer-settings';

function fixture(platform = 'ios') {
  const contexts: Array<{
    src: string; loop: boolean; volume: number;
    play: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>;
  }> = [];
  const fs = { mkdirSync: vi.fn(), writeFileSync: vi.fn() };
  const api = {
    getEnvInfoSync: () => ({ common: { USER_DATA_PATH: 'ttfile://user' } }),
    getSystemInfoSync: () => ({ platform }),
    getFileSystemManager: () => fs,
    createInnerAudioContext() {
      const audio = { src: '', loop: false, volume: 1, play: vi.fn(), destroy: vi.fn(), onError: vi.fn(), onEnded: vi.fn() };
      contexts.push(audio);
      return audio;
    },
  };
  return { api, contexts, fs };
}

it('renders a clip of complete audio-clock intervals with the canonical tempo limits', () => {
  for (const bpm of [30, 120, 123, 1800]) {
    const wave = new DataView(renderNativeMetronomeWav(bpm));
    const rate = 16000;
    const secondsPerBeat = 60 / bpm;
    const secondBeat = Math.round(secondsPerBeat * rate);
    const length = (wave.byteLength - NATIVE_WAV_HEADER_BYTES) / 2;
    const read = (frame: number) => wave.getInt16(NATIVE_WAV_HEADER_BYTES + 2 * frame, true);
    expect(wave.getUint32(24, true)).toBe(rate);
    expect(Math.abs(length - Math.ceil(40 / secondsPerBeat) * secondsPerBeat * rate)).toBeLessThanOrEqual(0.5);
    expect(read(secondBeat - 1)).toBe(0);
    expect(read(secondBeat + 2)).toBe(read(2));
    expect(read(2)).not.toBe(0);
  }
});

it('starts one iOS loop, holds it while timing, and allows an independent active sound cue', () => {
  const { api, contexts, fs } = fixture();
  const settings = { metronomeOn: true, metronomeBpm: 120, soundsEnabled: true, volume: 0.5, voiceInspection: 'none' as const, inspectionBeepAt: [] };
  let now = 1000;
  const clock = { now: () => now, isVisible: () => true };
  expect(nativeTimerMetronomeAvailable(api)).toBe(true);
  const click = createNativeTimerMetronome(() => settings, clock, api);
  const cues = createNativeTimerSound(() => settings, clock, api);
  click.warmup();
  click.sync('idle');
  expect(contexts).toHaveLength(0);
  click.sync('inspecting');
  expect(contexts[0]!.loop).toBe(true);
  expect(contexts[0]!.src).toBe('ttfile://user/timer-audio/metronome.wav');
  expect(contexts[0]!.play).toHaveBeenCalledOnce();
  click.sync('running');
  expect(contexts).toHaveLength(1);
  cues.onTransition({ state: initialTimerMachineState(), effects: ['run-started'] });
  expect(contexts).toHaveLength(2);
  expect(contexts[1]!.src).toBe('ttfile://user/timer-audio/start.wav');
  expect(contexts[0]!.destroy).not.toHaveBeenCalled();
  expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  click.sync('stopped');
  expect(contexts[0]!.destroy).toHaveBeenCalledOnce();
  expect(click.tapTempo()).toBeNull();
  now += 500;
  expect(click.tapTempo()).toBe(120);
  now += 3001;
  expect(click.tapTempo()).toBeNull();
  click.dispose();
  cues.dispose();
});

it('leaves Android’s single playback context available for sound cues', () => {
  const { api, contexts } = fixture('android');
  expect(nativeTimerMetronomeAvailable(api)).toBe(false);
  const player = createNativeTimerMetronome(() => ({ metronomeOn: true, metronomeBpm: 120 }), { now: Date.now, isVisible: () => true }, api);
  player.sync('running');
  expect(contexts).toHaveLength(0);
  player.dispose();
});

it('uses the shared preferences and refuses edits while metronome tempo is disabled', () => {
  const timer = { event: '333' as const, settings: createTimerStoreSettings(), currentSource: 'wca' as const, busy: false, solves: [] };
  expect(nativeTimerSettingsModel(timer).metronome).toBeUndefined();
  const context = { metronomeAvailable: true };
  expect(nativeTimerSettingsModel(timer, context, 'en').rows.find(row => row.key === 'metronomeBpm'))
    .toMatchObject({ disabled: true, label: 'Tempo', min: 30, max: 1800, valueText: '2.0 TPS · 120 BPM', tapLabel: 'Tap' });
  expect(nativeTimerSettingPatch(timer, 'sound', 'metronomeBpm', 150, context)).toBeUndefined();
  timer.settings.metronomeOn = true;
  expect(nativeTimerSettingPatch(timer, 'sound', 'metronomeBpm', 150, context)).toEqual({ metronomeBpm: 150 });
  expect(nativeTimerSettingPatch(timer, 'sound', 'metronomeBpm', 29, context)).toBeUndefined();
});
