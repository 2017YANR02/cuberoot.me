// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTimerStoreData, normalizeTimerDisplaySettings, timerHidesRunningUi, type TimerPhase, type TimerStoreData } from '@cuberoot/shared/timer';
import { TimerDisplaySettings, TimerPillToggle, TimerScrambleStrip } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

describe('shared display preferences', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('migrates old settings, preserves solves, and restores both preferences after restart', async () => {
    const original = createTimerStoreData(100, 'session');
    original.database.dataBySession.session = { '333': [{ id: 'solve', ts: 99, event: '333', timeMs: 9500, penalty: 'ok', scramble: 'R' }] };
    let raw = JSON.parse(JSON.stringify(original));
    delete raw.settings.compactScramble; delete raw.settings.hideAllUiWhileRunning;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(raw), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { raw = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { raw = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    expect((await repo.load()).settings).toMatchObject({ compactScramble: false, hideAllUiWhileRunning: false });
    await repo.updateSettings({ compactScramble: true, hideAllUiWhileRunning: true });
    const reloaded = await new TimerRepository(driver, env).load();
    expect(reloaded.settings).toMatchObject({ compactScramble: true, hideAllUiWhileRunning: true });
    expect(reloaded.database).toEqual(original.database);
    expect(normalizeTimerDisplaySettings({ compactScramble: 'true', hideAllUiWhileRunning: 1 })).toEqual({ compactScramble: false, hideAllUiWhileRunning: false });
  });

  it.each(['en', 'zh'] as const)('updates the shared scramble and hides only during a running solve (%s)', async language => {
    let value = normalizeTimerDisplaySettings();
    function Harness() {
      const [settings, setSettings] = useState(value);
      return <>
        <TimerDisplaySettings value={settings} localize={copy => copy[language]}
          onChange={patch => { value = { ...value, ...patch }; setSettings(value); }}
          renderBooleanControl={({ label, ...props }) => <TimerPillToggle ariaLabel={label} {...props} />} />
        <TimerScrambleStrip compact={settings.compactScramble} scramble="R U R'" copiedLabel="Copied" verificationLabels={{ copiedCorrection: 'Copied' }} />
      </>;
    }
    await act(async () => root.render(<Harness />));
    const toggle = (id: string) => container.querySelector<HTMLButtonElement>(`[data-setting-id="${id}"] button`)!;
    await act(async () => toggle('settings.appearance.compact-scramble').click());
    expect(container.querySelector('.scramble-strip')?.classList.contains('compact')).toBe(true);
    await act(async () => toggle('settings.appearance.hide-all-while-running').click());
    for (const phase of ['idle', 'inspecting', 'holding', 'ready', 'running', 'stopped'] as TimerPhase[]) {
      expect(timerHidesRunningUi(phase, value)).toBe(phase === 'running');
    }
    await act(async () => toggle('settings.appearance.hide-all-while-running').click());
    expect(timerHidesRunningUi('running', value)).toBe(false);
  });

  it('wires both hosts to the common visibility rule without changing timer geometry', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const css = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timer-workspace.css')), 'utf8');
    expect(app).toContain('timerHidesRunningUi(timer.machine.phase, store.settings)');
    expect(app).toContain('compact={store!.settings.compactScramble}');
    expect(app).toMatch(/<div className="surface-chrome">\s*<TimerGoalProgress[\s\S]*?<TimerRoundPanel[\s\S]*?<\/div>/);
    const rule = css.slice(0, css.indexOf('/* Web and installed'));
    for (const target of ['.surface-chrome', '.timer-workspace-panel', '.shell-rail > *', '[data-timer-hide-while-running]']) expect(rule).toContain(target);
    expect(rule).toContain('visibility: hidden');
    expect(rule).not.toContain('display: none');
    expect(rule).not.toContain('@media');
  });
});
