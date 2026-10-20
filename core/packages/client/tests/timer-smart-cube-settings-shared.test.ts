// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TIMER_SMART_CUBE_SETTINGS, TIMER_SMART_CUBE_AUTO_READY_MODES, TIMER_SMART_CUBE_LIVE_VIEWS,
  createTimerStoreData, decodeTimerStoreData, normalizeTimerSmartCubeSettings, serializeTimerStoreData, parseTimerStoreJson,
} from '@cuberoot/shared/timer';
import { TimerSmartCubeSettingsFields, TIMER_SMART_CUBE_SETTING_FIELD_IDS, useAutoReady, type AutoReadyOpts } from '@cuberoot/timer-ui';
import { useAutoReady as webAutoReady } from '@/app/[lang]/timer/_lib/bluetooth/auto_ready';

describe('one smart-cube settings persistence contract', () => {
  it('supplies the exact Web defaults to new and old installed stores', () => {
    expect(DEFAULT_TIMER_SMART_CUBE_SETTINGS).toEqual({ bluetoothAutoReady: 'scrambled', liveCubeView: '3d', gyroEnabled: true, autoCalibrateGyro: true, recordGyro: true, autoRecap: true, autoOpenSolution: true });
    const old = createTimerStoreData(0, 'session');
    for (const key of Object.keys(DEFAULT_TIMER_SMART_CUBE_SETTINGS)) delete (old.settings as unknown as Record<string, unknown>)[key];
    expect(decodeTimerStoreData(old)?.settings).toMatchObject(DEFAULT_TIMER_SMART_CUBE_SETTINGS);
  });
  it('offers three modes and migrates retired off values in historical backups', () => {
    expect(TIMER_SMART_CUBE_AUTO_READY_MODES).toEqual(['scrambled', 'still', 'double-flick']);
    const data = createTimerStoreData(0, 'session');
    Object.assign(data.settings, { bluetoothAutoReady: 'off' });
    expect(parseTimerStoreJson(JSON.stringify(data))?.settings.bluetoothAutoReady).toBe('scrambled');
    expect(normalizeTimerSmartCubeSettings({ bluetoothAutoReady: 'off' }).bluetoothAutoReady).toBe('scrambled');
  });
  for (const bluetoothAutoReady of TIMER_SMART_CUBE_AUTO_READY_MODES) {
    for (const liveCubeView of TIMER_SMART_CUBE_LIVE_VIEWS) {
      for (const gyroEnabled of [false, true]) {
        for (const recordGyro of [false, true]) {
          for (const autoRecap of [false, true]) {
            for (const autoOpenSolution of [false, true]) {
              it(`round-trips ${bluetoothAutoReady}/${liveCubeView}/view-gyro=${gyroEnabled}/record-gyro=${recordGyro}/recap=${autoRecap}/solution=${autoOpenSolution}`, () => {
                const choice = { bluetoothAutoReady, liveCubeView, gyroEnabled, recordGyro, autoRecap, autoOpenSolution };
                const data = createTimerStoreData(0, 'session');
                Object.assign(data.settings, choice);
                expect(parseTimerStoreJson(serializeTimerStoreData(data))?.settings).toMatchObject({ ...choice, recordGyro: true });
                expect(normalizeTimerSmartCubeSettings(choice)).toEqual({ ...choice, recordGyro: true, autoCalibrateGyro: true });
              });
            }
          }
        }
      }
    }
  }
  it.each([false, true])('round-trips auto calibration=%s', autoCalibrateGyro => {
    const data = createTimerStoreData(0, 'session');
    data.settings.autoCalibrateGyro = autoCalibrateGyro;
    expect(parseTimerStoreJson(serializeTimerStoreData(data))?.settings.autoCalibrateGyro).toBe(autoCalibrateGyro);
    expect(normalizeTimerSmartCubeSettings({ autoCalibrateGyro }).autoCalibrateGyro).toBe(autoCalibrateGyro);
  });
  it.each([{ bluetoothAutoReady: 'other' }, { liveCubeView: 'other' }, { gyroEnabled: 'false' }, { autoCalibrateGyro: 'false' }, { recordGyro: 'false' }, { autoRecap: 0 }, { autoRecap: null }, { autoOpenSolution: 0 }, { autoOpenSolution: null }])('rejects explicit corrupt imported choices %j', (bad) => {
    const data = createTimerStoreData(0, 'session');
    Object.assign(data.settings, bad);
    expect(decodeTimerStoreData(data)).toBeNull();
  });
});

describe('shared smart-cube controls and auto-ready subscription', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
  it.each(['en', 'zh'] as const)('renders all six exact rows and every option, emitting only changed fields (%s)', async (lang) => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(TimerSmartCubeSettingsFields, {
      value: DEFAULT_TIMER_SMART_CUBE_SETTINGS, localize: (copy) => copy[lang], onChange,
      renderBooleanControl: ({ label, value, onChange: toggle }) => createElement('button', { type: 'button', role: 'switch', 'aria-checked': value, 'aria-label': label, onClick: () => toggle(!value) }),
    })));
    expect([...host.querySelectorAll<HTMLElement>('[data-setting-id]')].map((row) => row.dataset.settingId)).toEqual(TIMER_SMART_CUBE_SETTING_FIELD_IDS);
    const [ready, view] = [...host.querySelectorAll('select')];
    expect([...ready.options].map((option) => option.value)).toEqual(TIMER_SMART_CUBE_AUTO_READY_MODES);
    expect([...view.options].map((option) => option.value)).toEqual(TIMER_SMART_CUBE_LIVE_VIEWS);
    for (const value of TIMER_SMART_CUBE_AUTO_READY_MODES) {
      await act(async () => { ready.value = value; ready.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(onChange).toHaveBeenLastCalledWith({ bluetoothAutoReady: value });
    }
    for (const value of TIMER_SMART_CUBE_LIVE_VIEWS) {
      await act(async () => { view.value = value; view.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(onChange).toHaveBeenLastCalledWith({ liveCubeView: value });
    }
    const [viewGyro, calibration, recap, solution] = [...host.querySelectorAll('button')];
    expect(host.textContent).toContain(lang === 'zh'
      ? '仅桌面窗口自动展开，移动端请手动打开解法。'
      : 'Auto-opens on desktop only; open solutions manually on mobile.');
    await act(async () => viewGyro.click()); expect(onChange).toHaveBeenLastCalledWith({ gyroEnabled: false });
    await act(async () => calibration.click()); expect(onChange).toHaveBeenLastCalledWith({ autoCalibrateGyro: false });
    expect(host.textContent).not.toContain('记录姿态用于回放');
    await act(async () => recap.click()); expect(onChange).toHaveBeenLastCalledWith({ autoRecap: false });
    await act(async () => solution.click()); expect(onChange).toHaveBeenLastCalledWith({ autoOpenSolution: false });
  });
  it('retains the Web hook as the identical shared implementation', () => { expect(webAutoReady).toBe(useAutoReady); });

  function Harness(opts: AutoReadyOpts) { useAutoReady(opts); return null; }
  function stream() {
    let listener: ((move: string, ts: number) => void) | undefined;
    const off = vi.fn(() => { listener = undefined; });
    return { subscribe: (cb: (move: string, ts: number) => void) => { listener = cb; return off; }, off, emit: (move: string) => listener?.(move, 100) };
  }
  it('still requires a move, resets the exact 2-second timer, and fires once per enabled lifetime', async () => {
    const moves = stream(), onReady = vi.fn();
    await act(async () => root.render(createElement(Harness, { enabled: true, mode: 'still', onReady, onMoveSubscriber: moves.subscribe })));
    await act(async () => vi.advanceTimersByTime(3_000)); expect(onReady).not.toHaveBeenCalled();
    moves.emit('R'); await act(async () => vi.advanceTimersByTime(1_999)); expect(onReady).not.toHaveBeenCalled();
    moves.emit('U'); await act(async () => vi.advanceTimersByTime(1_999)); expect(onReady).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1)); expect(onReady).toHaveBeenCalledTimes(1);
    moves.emit('R'); await act(async () => vi.advanceTimersByTime(4_000)); expect(onReady).toHaveBeenCalledTimes(1);
  });
  it('cancels still readiness on disable, then rearms only after a new move', async () => {
    const moves = stream(), onReady = vi.fn();
    const render = (enabled: boolean) => act(async () => root.render(createElement(Harness, { enabled, mode: 'still', onReady, onMoveSubscriber: moves.subscribe })));
    await render(true); moves.emit('R'); await render(false);
    await act(async () => vi.advanceTimersByTime(3_000)); expect(onReady).not.toHaveBeenCalled(); expect(moves.off).toHaveBeenCalledTimes(1);
    await render(true); await act(async () => vi.advanceTimersByTime(3_000)); expect(onReady).not.toHaveBeenCalled();
    moves.emit('U'); await act(async () => vi.advanceTimersByTime(2_000)); expect(onReady).toHaveBeenCalledTimes(1);
  });
  it.each(['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'Rw', 'u'].flatMap(face => [face, `${face}'`]))('accepts one inverse layer pair in either direction (%s)', async first => {
    const moves = stream(), onReady = vi.fn();
    await act(async () => root.render(createElement(Harness, { enabled: true, mode: 'double-flick', onReady, onMoveSubscriber: moves.subscribe })));
    const inverse = first.endsWith("'") ? first.slice(0, -1) : `${first}'`;
    moves.emit(first); expect(onReady).not.toHaveBeenCalled();
    moves.emit(inverse); expect(onReady).toHaveBeenCalledTimes(1);
    moves.emit(first); moves.emit(inverse); expect(onReady).toHaveBeenCalledTimes(1);
  });
  it('rejects different faces, repeated turns, half turns and rotations, then accepts a new pair', async () => {
    const moves = stream(), onReady = vi.fn();
    await act(async () => root.render(createElement(Harness, { enabled: true, mode: 'double-flick', onReady, onMoveSubscriber: moves.subscribe })));
    for (const move of ['R', "U'", "U'", 'U2', 'U2', 'R', 'x', "R'", 'U R', "R' U'", 'invalid', 'F']) moves.emit(move);
    expect(onReady).not.toHaveBeenCalled();
    moves.emit("F'"); expect(onReady).toHaveBeenCalledTimes(1);
  });
  it('does not carry half a gesture across disabled or covered attempts', async () => {
    const moves = stream(), onReady = vi.fn();
    const render = (enabled: boolean) => act(async () => root.render(createElement(Harness, { enabled, mode: 'double-flick', onReady, onMoveSubscriber: moves.subscribe })));
    await render(true); moves.emit('U');
    await render(false); await render(true); moves.emit("U'");
    expect(onReady).not.toHaveBeenCalled();
    moves.emit('U'); expect(onReady).toHaveBeenCalledTimes(1);
  });
  it.each(['still', 'double-flick'] as const)('rearms for a second complete solve and ignores gestures while covered/running (%s)', async (mode) => {
    const moves = stream(), onReady = vi.fn();
    const render = (enabled: boolean) => act(async () => root.render(createElement(Harness, { enabled, mode, onReady, onMoveSubscriber: moves.subscribe })));
    const gesture = async () => {
      for (const move of ['U', "U'"]) moves.emit(move);
      await act(async () => vi.advanceTimersByTime(2_000));
    };
    await render(false); // History/settings are covering the timer.
    await gesture(); expect(onReady).toHaveBeenCalledTimes(0);
    await render(true); // First armable attempt.
    await gesture(); expect(onReady).toHaveBeenCalledTimes(1);
    await render(false); // Ready/running: solving turns cannot consume next readiness.
    await gesture(); expect(onReady).toHaveBeenCalledTimes(1);
    await render(true); // Next scramble, stopped/idle again.
    await act(async () => vi.advanceTimersByTime(3_000)); expect(onReady).toHaveBeenCalledTimes(1);
    await gesture(); expect(onReady).toHaveBeenCalledTimes(2);
    await render(false);
    await gesture(); expect(onReady).toHaveBeenCalledTimes(2);
    expect(moves.off).toHaveBeenCalledTimes(2);
  });
});
