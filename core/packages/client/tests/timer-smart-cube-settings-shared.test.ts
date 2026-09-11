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
    expect(DEFAULT_TIMER_SMART_CUBE_SETTINGS).toEqual({ bluetoothAutoReady: 'scrambled', liveCubeView: '3d', recordGyro: true, autoRecap: true });
    const old = createTimerStoreData(0, 'session');
    for (const key of Object.keys(DEFAULT_TIMER_SMART_CUBE_SETTINGS)) delete (old.settings as unknown as Record<string, unknown>)[key];
    expect(decodeTimerStoreData(old)?.settings).toMatchObject(DEFAULT_TIMER_SMART_CUBE_SETTINGS);
  });
  for (const bluetoothAutoReady of TIMER_SMART_CUBE_AUTO_READY_MODES) {
    for (const liveCubeView of TIMER_SMART_CUBE_LIVE_VIEWS) {
      for (const recordGyro of [false, true]) {
        for (const autoRecap of [false, true]) {
          it(`round-trips ${bluetoothAutoReady}/${liveCubeView}/gyro=${recordGyro}/recap=${autoRecap}`, () => {
            const choice = { bluetoothAutoReady, liveCubeView, recordGyro, autoRecap };
            const data = createTimerStoreData(0, 'session');
            Object.assign(data.settings, choice);
            expect(parseTimerStoreJson(serializeTimerStoreData(data))?.settings).toMatchObject(choice);
            expect(normalizeTimerSmartCubeSettings(choice)).toEqual(choice);
          });
        }
      }
    }
  }
  it.each([{ bluetoothAutoReady: 'other' }, { liveCubeView: 'other' }, { recordGyro: 'false' }, { autoRecap: 0 }, { autoRecap: null }])('rejects explicit corrupt imported choices %j', (bad) => {
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
  it.each(['en', 'zh'] as const)('renders all four exact rows and every option, emitting only changed fields (%s)', async (lang) => {
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
    const [gyro, recap] = [...host.querySelectorAll('button')];
    await act(async () => gyro.click()); expect(onChange).toHaveBeenLastCalledWith({ recordGyro: false });
    await act(async () => recap.click()); expect(onChange).toHaveBeenLastCalledWith({ autoRecap: false });
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
  it('double flick accepts only the exact U inverse sequence, not other faces or half turns', async () => {
    const moves = stream(), onReady = vi.fn();
    await act(async () => root.render(createElement(Harness, { enabled: true, mode: 'double-flick', onReady, onMoveSubscriber: moves.subscribe })));
    for (const move of ['R', "R'", 'R', "R'", 'U2', 'U2', 'U', "U'"]) moves.emit(move);
    expect(onReady).not.toHaveBeenCalled();
    moves.emit('U'); moves.emit("U'"); expect(onReady).toHaveBeenCalledTimes(1);
    for (const move of ['U', "U'", 'U', "U'"]) moves.emit(move);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
  it.each(['still', 'double-flick'] as const)('rearms for a second complete solve and ignores gestures while covered/running (%s)', async (mode) => {
    const moves = stream(), onReady = vi.fn();
    const render = (enabled: boolean) => act(async () => root.render(createElement(Harness, { enabled, mode, onReady, onMoveSubscriber: moves.subscribe })));
    const gesture = async () => {
      for (const move of ['U', "U'", 'U', "U'"]) moves.emit(move);
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
