// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTimerStoreData, initialTimerMachineState, normalizeTimerMetronomeSettings, parseInspectionBeepInput, type TimerStoreData } from '@cuberoot/shared/timer';
import { createMetronome } from '@cuberoot/timer-ui/metronome';
import { createTimerSoundFeedback } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('installed metronome and custom inspection cues', () => {
  it('warms suspended audio without starting beats and does not replay unsubscribed history', async () => {
    vi.useFakeTimers();
    let audioTime = 0;
    const resume = vi.fn(async () => undefined);
    vi.stubGlobal('AudioContext', class {
      state = 'suspended'; get currentTime() { return audioTime; } destination = {};
      resume = resume;
      close = async () => undefined;
      addEventListener() {}
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect: (gain: unknown) => gain, start() {}, stop() {} }; }
    });
    const engine = createMetronome({ initial: { bpm: 1800 } });
    const detach = engine.attach();
    engine.warmup();
    expect(resume).toHaveBeenCalledOnce();
    expect(engine.isMetronomeSounding()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    engine.setMetronomeHold('timer', true);
    for (let second = 1; second <= 60; second++) {
      audioTime = second;
      vi.advanceTimersByTime(1000);
    }
    const beat = vi.fn();
    const unsubscribe = engine.subscribeBeat(beat);
    vi.advanceTimersByTime(20);
    expect(beat).not.toHaveBeenCalled();
    unsubscribe(); detach();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules on the audio clock, keeps an existing hold, and fully detaches before remount', async () => {
    vi.useFakeTimers();
    const starts: number[] = []; const close = vi.fn(async () => undefined);
    vi.stubGlobal('AudioContext', class {
      state = 'running'; currentTime = 0; destination = {};
      addEventListener() {}
      close = close;
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect: (gain: unknown) => gain, start: (time: number) => starts.push(time), stop() {} }; }
    });
    const engine = createMetronome({ initial: { bpm: 600 } });
    let detach = engine.attach();
    engine.setMetronomeHold('timer', true);
    expect(starts[0]).toBeCloseTo(0.06);
    const count = starts.length;
    engine.setMetronomeHold('timer', true);
    expect(starts).toHaveLength(count);
    expect(engine.isMetronomeSounding()).toBe(true);
    detach();
    expect(engine.isMetronomeSounding()).toBe(false); expect(close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event('pageshow'));
    expect(starts).toHaveLength(count);
    detach = engine.attach(); engine.setMetronomeHold('timer', true);
    expect(starts.length).toBeGreaterThan(count);
    detach();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fires each configured inspection beep once, even when standard sounds are off', () => {
    vi.useFakeTimers();
    const sound = { play: vi.fn(), cancelVoice: vi.fn(), getInspectionBeepAt: () => [1, 5, 8], playInspectionBeep: vi.fn() };
    const feedback = createTimerSoundFeedback(sound);
    feedback.onTransition({ effects: ['inspection-started'], state: { ...initialTimerMachineState(), inspectionStartedAtMs: performance.now() } });
    vi.advanceTimersByTime(9000);
    expect(sound.playInspectionBeep).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1000); expect(sound.playInspectionBeep).toHaveBeenCalledTimes(3);
    feedback.onTransition({ effects: ['run-started'], state: initialTimerMachineState() });
    expect(vi.getTimerCount()).toBe(0); feedback.dispose();
  });

  it('migrates missing fields and persists normalized tempo and custom seconds', async () => {
    expect(parseInspectionBeepInput('5， 10 5, 60, 99, 0, 2.9, bad')).toEqual([2, 5, 10, 60]);
    expect(normalizeTimerMetronomeSettings({ metronomeBpm: Infinity, inspectionBeepAt: [2, '3', 2, -1] })).toEqual({ metronomeOn: false, metronomeBpm: 120, inspectionBeepAt: [2] });
    let raw = JSON.parse(JSON.stringify(createTimerStoreData(100, 'session')));
    delete raw.settings.metronomeOn; delete raw.settings.metronomeBpm; delete raw.settings.inspectionBeepAt;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(raw), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { raw = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { raw = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    expect((await repo.load()).settings).toMatchObject({ metronomeOn: false, metronomeBpm: 120, inspectionBeepAt: [] });
    await repo.updateSettings({ metronomeOn: true, metronomeBpm: 720, inspectionBeepAt: [5, 10] });
    expect((await new TimerRepository(driver, env).load()).settings).toMatchObject({ metronomeOn: true, metronomeBpm: 720, inspectionBeepAt: [5, 10] });
  });
});
