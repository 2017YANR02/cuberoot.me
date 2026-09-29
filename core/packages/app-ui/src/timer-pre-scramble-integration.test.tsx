// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyOrientationPrefix, CUBE_ORIENTATIONS, createTimerStoreData, normalizeTimerPreScrambleSettings, orientedFaceColors, preScrambleFor, type TimerStoreData } from '@cuberoot/shared/timer';
import { TimerPreScrambleSettings } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

describe('shared pre-scramble orientation', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('keeps all 24 orientations distinct and their color chips consistent with the labels', () => {
    expect(CUBE_ORIENTATIONS).toHaveLength(24);
    const states = CUBE_ORIENTATIONS.map(option => {
      const shown = orientedFaceColors(option.value);
      expect(option.label.startsWith(`(${shown.U}${shown.F})`)).toBe(true);
      return JSON.stringify(shown);
    });
    expect(new Set(states).size).toBe(24);
    expect(normalizeTimerPreScrambleSettings({ preScr: 'R U', preScrT: [] })).toEqual({ preScr: '', preScrT: 'z2' });
    expect(normalizeTimerPreScrambleSettings({ preScr: " x y' " }).preScr).toBe("x y'");
    expect(preScrambleFor('333', 'x', 'z2')).toBe('x');
    expect(preScrambleFor('pll', 'x', 'z2')).toBe('z2');
    expect(preScrambleFor('eg1', 'x', 'z2')).toBe('z2');
    expect(preScrambleFor('mega', 'x', 'z2')).toBe('');
    expect(applyOrientationPrefix('R U', preScrambleFor('pll', 'x', 'z2'))).toBe('z2 R U');
  });

  it.each(['en', 'zh'] as const)('selects ordinary and training orientation independently (%s)', async language => {
    let value = normalizeTimerPreScrambleSettings();
    function Harness() {
      const [settings, setSettings] = useState(value);
      return <TimerPreScrambleSettings value={settings} localize={copy => copy[language]}
        onChange={patch => { value = { ...value, ...patch }; setSettings(value); }} />;
    }
    await act(async () => root.render(<Harness />));
    const choose = async (id: string, label: string) => {
      await act(async () => container.querySelector<HTMLButtonElement>(`[data-setting-id="${id}"] button`)!.click());
      const options = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')];
      expect(options).toHaveLength(24);
      const option = options.find(node => node.textContent?.endsWith(label))!;
      expect(option).toBeDefined();
      await act(async () => option.click());
    };
    await choose('settings.scramble.pre-orientation', '(FD) x');
    expect(value).toEqual({ preScr: 'x', preScrT: 'z2' });
    await choose('settings.scramble.training-pre-orientation', '(UF)');
    expect(value).toEqual({ preScr: 'x', preScrT: '' });
  });

  it('loads old defaults and preserves canonical scramble text across preference saves and restart', async () => {
    const original = createTimerStoreData(100, 'session');
    original.database.dataBySession.session = { 'pll': [{ id: 'solve', ts: 99, event: 'pll', timeMs: 9500, penalty: 'ok', scramble: 'R U' }] };
    let raw = JSON.parse(JSON.stringify(original));
    delete raw.settings.preScr; delete raw.settings.preScrT;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(raw), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { raw = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { raw = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    expect((await repo.load()).settings).toMatchObject({ preScr: '', preScrT: 'z2' });
    await repo.updateSettings({ preScr: 'y', preScrT: 'x' });
    const reloaded = await new TimerRepository(driver, env).load();
    expect(reloaded.settings).toMatchObject({ preScr: 'y', preScrT: 'x' });
    expect(reloaded.database).toEqual(original.database);
  });
});
