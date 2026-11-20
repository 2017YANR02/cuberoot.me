import { afterEach, expect, it, vi } from 'vitest';
import { initialTimerMachineState } from '@cuberoot/shared/timer/machine';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { createNativeTimerSound, nativeTimerSoundAvailable, nativeTimerVoiceAvailable, renderNativeTimerCueWav } from '../src/lib/native-timer-sound';
import { nativeTimerSettingPatch, nativeTimerSettingsModel } from '../src/lib/native-timer-settings';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('encodes shared lengths, inter-note gaps, and a decodable PCM WAV header', () => {
  const wave = new DataView(renderNativeTimerCueWav('warn-8'));
  expect(wave.getUint32(0)).toBe(0x52494646);
  expect(wave.getUint32(8)).toBe(0x57415645);
  expect(wave.getUint32(24, true)).toBe(24000);
  expect(wave.getUint32(40, true)).toBe((100 + 20 + 100) * 24 * 2);
  expect(wave.getInt16(44, true)).toBe(0);
  expect(wave.getInt16(44 + 110 * 24 * 2, true)).toBe(0);
  expect(wave.getInt16(44 + 130 * 24 * 2, true)).not.toBe(0);
});

it('dispatches the shared inspection schedule on one native player and clears it on hide', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  let ended!: WechatMiniprogram.OnEndedCallback;
  const context = {
    src: '', volume: 1, destroy: vi.fn(),
    onEnded: (fn: WechatMiniprogram.OnEndedCallback) => { ended = fn; }, onError: vi.fn(),
    play: vi.fn(() => context.src),
  };
  const createInnerAudioContext = vi.fn(() => context);
  const readSettings = () => ({ soundsEnabled: true, volume: 0.25, voiceInspection: 'none' as const, inspectionBeepAt: [8] });
  const audio = createNativeTimerSound(readSettings, { now: Date.now, isVisible: () => true, cueSource: cue => `${cue}.wav` }, { createInnerAudioContext });
  audio.onTransition({ effects: ['inspection-started'], state: { ...initialTimerMachineState(), inspectionStartedAtMs: 0 } });
  expect(context.play.mock.results.map(result => result.value)).toEqual(['inspection-start.wav']);
  expect(context.volume).toBe(0.25);
  ended({ errMsg: 'ended' });
  vi.advanceTimersByTime(8000);
  expect(context.play.mock.results.map(result => result.value)).toEqual(['inspection-start.wav', 'warn-8.wav']);
  ended({ errMsg: 'ended' });
  expect(context.play.mock.results.map(result => result.value)).toEqual(['inspection-start.wav', 'warn-8.wav', 'inspection-beep.wav']);
  expect(createInnerAudioContext).toHaveBeenCalledTimes(1);
  audio.hide();
  expect(context.destroy).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(4000);
  ended({ errMsg: 'ended' });
  expect(context.play).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
  audio.dispose();
});

it('allows opted-in custom beeps while ordinary cues are muted and honors master volume', () => {
  let volume = 0.5;
  const context = { src: '', volume, play: vi.fn(), destroy: vi.fn(), onEnded: vi.fn(), onError: vi.fn() };
  const readSettings = () => ({ soundsEnabled: false, volume, voiceInspection: 'none' as const, inspectionBeepAt: [] });
  const audio = createNativeTimerSound(readSettings, { now: Date.now, isVisible: () => true, cueSource: cue => `${cue}.wav` }, {
    createInnerAudioContext: () => context,
  });
  audio.onTransition({ effects: ['run-started'], state: initialTimerMachineState() });
  expect(context.play).not.toHaveBeenCalled();
  volume = 0;
  audio.playInspectionBeep();
  expect(context.play).not.toHaveBeenCalled();
  volume = 0.4;
  audio.playInspectionBeep();
  expect(context.play).toHaveBeenCalledOnce();
  expect(context).toMatchObject({ src: 'inspection-beep.wav', volume: 0.4 });
  audio.dispose();
});

it('writes playable clips into the private directory and reuses the prepared cue on transition', () => {
  const player = { src: '', volume: 1, play: vi.fn(), destroy: vi.fn(), onEnded: vi.fn(), onError: vi.fn() };
  const fs = { mkdirSync: vi.fn(), writeFileSync: vi.fn() };
  const api = {
    getEnvInfoSync: () => ({ common: { USER_DATA_PATH: 'ttfile://user' } }),
    env: { USER_DATA_PATH: 'legacy-file-directory' },
    getFileSystemManager: () => fs,
    createInnerAudioContext: () => player,
  };
  expect(nativeTimerSoundAvailable(api)).toBe(true);
  expect(nativeTimerSoundAvailable({ ...api, getFileSystemManager: undefined })).toBe(false);
  const audio = createNativeTimerSound(() => ({ soundsEnabled: true, volume: 0.5, voiceInspection: 'none', inspectionBeepAt: [] }), {
    now: Date.now, isVisible: () => true,
  }, api);
  audio.warmupSound();
  expect(fs.writeFileSync).toHaveBeenCalledWith('ttfile://user/timer-audio/start.wav', expect.any(ArrayBuffer));
  const count = fs.writeFileSync.mock.calls.length;
  audio.onTransition({ effects: ['run-started'], state: initialTimerMachineState() });
  expect(fs.writeFileSync).toHaveBeenCalledTimes(count);
  expect(player).toMatchObject({ src: 'ttfile://user/timer-audio/start.wav', volume: 0.5 });
  expect(player.play).toHaveBeenCalledOnce();
  audio.dispose();
});

it('uses canonical sound controls and blocks unavailable speech', () => {
  const timer = { event: '333' as const, settings: createTimerStoreSettings(), currentSource: 'wca' as const, busy: false, solves: [] };
  expect(nativeTimerSettingsModel(timer).rows.some(row => row.category === 'sound')).toBe(false);
  const context = { soundAvailable: true };
  const rows = nativeTimerSettingsModel(timer, context, 'en').rows.filter(row => row.category === 'sound');
  expect(rows).toMatchObject([
    { key: 'soundsEnabled', label: 'Sounds', checked: false },
    { key: 'volume', valueText: '50%', previewDisabled: true },
    { key: 'voiceInspection', hint: 'Voice unavailable on this device', disabled: true },
    { key: 'inspectionBeepAt', label: 'Beep at (sec)', kind: 'text', previewDisabled: false },
  ]);
  expect(nativeTimerSettingPatch(timer, 'sound', 'voiceInspection', 1, context)).toBeUndefined();
  expect(nativeTimerSettingPatch(timer, 'sound', 'inspectionBeepAt', '12,5,5，1,61', context)).toEqual({ inspectionBeepAt: [1, 5, 12] });
  const enabledTimer = { ...timer, settings: { ...timer.settings, soundsEnabled: true } };
  const voiceContext = { ...context, voiceAvailable: true };
  const voiceRow = nativeTimerSettingsModel(enabledTimer, voiceContext, 'en').rows.find(row => row.key === 'voiceInspection');
  expect(voiceRow).toMatchObject({ disabled: false });
  expect(voiceRow).not.toHaveProperty('hint');
  expect(nativeTimerSettingPatch(enabledTimer, 'sound', 'voiceInspection', 4, voiceContext)).toEqual({ voiceInspection: 'zh-female' });
});

it('uses packaged speech for inspection, falls back on audio errors, and cancels warnings when the run starts', () => {
  vi.stubGlobal('__MINI_PROGRAM_TARGET__', 'douyin');
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const players: ReturnType<typeof player>[] = [];
  const played: string[] = [];
  function player() {
    return {
      src: '', volume: 1, destroy: vi.fn(),
      ended: (_result: WechatMiniprogram.GeneralCallbackResult) => {},
      failed: (_result: WechatMiniprogram.InnerAudioContextOnErrorListenerResult) => {},
      onEnded(fn: WechatMiniprogram.OnEndedCallback) { this.ended = fn; },
      onError(fn: WechatMiniprogram.InnerAudioContextOnErrorCallback) { this.failed = fn; },
      play() { played.push(this.src); },
    };
  }
  const data = new ArrayBuffer(10);
  const fs = { mkdirSync: vi.fn(), readFileSync: vi.fn(() => data), writeFileSync: vi.fn() };
  const api = {
    env: { USER_DATA_PATH: 'ttfile://user' },
    getFileSystemManager: () => fs,
    createInnerAudioContext() {
      expect(players.filter(audio => audio.destroy.mock.calls.length === 0)).toHaveLength(0);
      const audio = player();
      players.push(audio);
      return audio;
    },
  };
  expect(nativeTimerVoiceAvailable(api)).toBe(true);
  const audio = createNativeTimerSound(() => ({ soundsEnabled: true, volume: 0.5, voiceInspection: 'zh-female', inspectionBeepAt: [] }), {
    now: Date.now, isVisible: () => true, cueSource: cue => `${cue}.wav`,
  }, api);
  const state = { ...initialTimerMachineState(), inspectionStartedAtMs: 0 };
  audio.onTransition({ effects: ['inspection-started'], state });
  expect(fs.readFileSync).toHaveBeenCalledWith('assets/timer-voice/zh-female-inspection-start.mp3');
  expect(fs.writeFileSync).toHaveBeenCalledWith('ttfile://user/timer-audio/zh-female-inspection-start.mp3', data);
  const ended = { errMsg: 'ended' };
  const failed = { errCode: 10003 as const, errMsg: 'decode error' };
  players[0].ended(ended);
  vi.advanceTimersByTime(8000);
  players[0].failed(failed);
  expect(played.at(-1)).toBe('warn-8.wav');
  players[0].ended(ended);
  vi.advanceTimersByTime(4000);
  audio.onTransition({ effects: ['run-started'], state });
  expect(players).toHaveLength(2);
  expect(players[0].destroy).toHaveBeenCalledOnce();
  expect(played.map(path => path.split('/').at(-1))).toEqual([
    'zh-female-inspection-start.mp3', 'zh-female-warn-8.mp3', 'warn-8.wav', 'zh-female-warn-12.mp3', 'zh-female-start.mp3',
  ]);
  players[0].failed(failed);
  expect(played).toHaveLength(5);
  audio.dispose();
  expect(vi.getTimerCount()).toBe(0);
});
