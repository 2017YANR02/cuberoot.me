// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTimerStoreData, initialTimerMachineState, normalizeTimerSoundSettings, type TimerMachineTransition, type TimerStoreData } from '@cuberoot/shared/timer';
import { createTimerSound, createTimerSoundFeedback, TimerSoundSettings } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared timer sound', () => {
  it('schedules inspection warnings once through holding, then clears on start, cancel and disposal', () => {
    vi.useFakeTimers();
    const sound = { play: vi.fn(), cancelVoice: vi.fn() };
    const feedback = createTimerSoundFeedback(sound);
    const transition = (effects: TimerMachineTransition['effects']): TimerMachineTransition => ({ effects, state: { ...initialTimerMachineState(), inspectionStartedAtMs: performance.now() } });
    feedback.onTransition(transition(['inspection-started']));
    vi.advanceTimersByTime(8000);
    feedback.onTransition(transition(['hold-started']));
    vi.advanceTimersByTime(5000);
    expect(sound.play.mock.calls.flat()).toEqual(['inspection-start', 'warn-8', 'warn-12']);
    feedback.onTransition(transition(['run-started']));
    vi.advanceTimersByTime(15000);
    expect(sound.play.mock.calls.flat()).toEqual(['inspection-start', 'warn-8', 'warn-12', 'start']);
    feedback.onTransition({ ...transition(['run-stopped']), solve: { timeMs: 1000, inspectionMs: 0, autoPenalty: 'ok' } });
    expect(sound.play).toHaveBeenLastCalledWith('stop');
    feedback.onTransition(transition(['inspection-started']));
    feedback.onTransition(transition(['arm-cancelled']));
    vi.advanceTimersByTime(15000);
    expect(sound.play).toHaveBeenLastCalledWith('inspection-start');
    feedback.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses current volume for speech, honors mute, and safely handles missing or failing audio', () => {
    let settings = normalizeTimerSoundSettings({ soundsEnabled: true, volume: 0.25, voiceInspection: 'en-female' });
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [{ lang: 'en-US', name: 'Samantha' }] });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const audio = createTimerSound(() => settings);
    audio.play('warn-8');
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.25, lang: 'en-US', text: '8 seconds' }));
    audio.cancelVoice(); audio.play('warn-8');
    expect(speak).toHaveBeenCalledTimes(2);
    settings = { ...settings, volume: 0 };
    audio.play('warn-12'); expect(speak).toHaveBeenCalledTimes(2);
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('AudioContext', class { createOscillator() { throw new Error('unavailable'); } close() { return Promise.resolve(); } });
    settings = { ...settings, volume: 1 };
    expect(() => audio.play('start')).not.toThrow();
    expect(audio.isVoiceAvailable()).toBe(false);
    audio.dispose();
  });

  it('disables unavailable voice, warms audio on opt-in, and renders the same saved controls', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); const warm = vi.fn(); const preview = vi.fn();
    function Harness() {
      const [value, setValue] = useState(normalizeTimerSoundSettings());
      return <TimerSoundSettings value={value} onChange={patch => setValue(current => ({ ...current, ...patch }))} localize={copy => copy.en} voiceAvailable={false} onWarmup={warm} onPreview={preview} />;
    }
    try {
      await act(async () => root.render(<Harness />));
      expect(container.querySelector('input')!.disabled).toBe(true);
      await act(async () => container.querySelector<HTMLButtonElement>('[data-setting-id="settings.sound.enabled"] button')!.click());
      expect(warm).toHaveBeenCalledOnce();
      expect(container.querySelector('input')!.disabled).toBe(false);
      expect(container.querySelector('select')!.disabled).toBe(true);
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Test"]')!.click());
      expect(preview).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); container.remove(); }
  });

  it('falls back when voices are missing or fail asynchronously, but never after cancellation', () => {
    const beep = vi.fn();
    vi.stubGlobal('AudioContext', class {
      state = 'running'; currentTime = 0; destination = {};
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect: (gain: unknown) => gain, start: beep, stop() {} }; }
      close() { return Promise.resolve(); }
    });
    const speak = vi.fn();
    const getVoices = vi.fn((): unknown[] => []);
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const audio = createTimerSound(() => normalizeTimerSoundSettings({ soundsEnabled: true, voiceInspection: 'en-female' }));
    audio.play('warn-8');
    expect(speak).not.toHaveBeenCalled(); expect(beep).toHaveBeenCalledTimes(2);
    getVoices.mockReturnValue([{ lang: 'en-US', name: 'Samantha' }]);
    audio.play('warn-8');
    speak.mock.calls[0][0].onerror({ error: 'synthesis-unavailable' });
    expect(beep).toHaveBeenCalledTimes(4);
    audio.play('warn-12');
    const queued = speak.mock.calls[1][0];
    audio.cancelVoice(); queued.onerror({ error: 'synthesis-unavailable' });
    expect(beep).toHaveBeenCalledTimes(4);
    audio.play('warn-12');
    const oldWarning = speak.mock.calls[2][0];
    const feedback = createTimerSoundFeedback(audio);
    feedback.onTransition({ effects: ['run-started'], state: initialTimerMachineState() });
    oldWarning.onerror({ error: 'synthesis-unavailable' });
    expect(beep).toHaveBeenCalledTimes(4);
    const oldStart = speak.mock.calls[3][0];
    feedback.onTransition({ effects: ['run-stopped'], state: initialTimerMachineState(), solve: { timeMs: 1000, inspectionMs: 0, autoPenalty: 'ok' } });
    expect(beep).toHaveBeenCalledTimes(6);
    oldStart.onerror({ error: 'synthesis-unavailable' });
    expect(beep).toHaveBeenCalledTimes(6);
    feedback.dispose();
    audio.dispose();
  });

  it('restores legacy sound defaults and persists all three preferences without changing solves', async () => {
    const original = createTimerStoreData(100, 'session');
    let raw = JSON.parse(JSON.stringify(original));
    delete raw.settings.soundsEnabled; delete raw.settings.volume; delete raw.settings.voiceInspection;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(raw), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { raw = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { raw = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    expect((await repo.load()).settings).toMatchObject(normalizeTimerSoundSettings());
    const prefs = { soundsEnabled: true, volume: 0.7, voiceInspection: 'zh-female' as const };
    await repo.updateSettings(prefs);
    const restored = await new TimerRepository(driver, env).load();
    expect(restored.settings).toMatchObject(prefs); expect(restored.database).toEqual(original.database);
  });
});
