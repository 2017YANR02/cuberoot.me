// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { applyColorNeutral, createTimerStoreData, generateTimerScramble, isCnEligible, normalizeTimerColorNeutralMode, type TimerStoreData } from '@cuberoot/shared/timer';
import { TimerColorNeutralSetting } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

describe('shared color-neutral settings', () => {
  it('applies deterministic rotation to eligible generated scrambles only', async () => {
    const dependency = { generateCubingScramble: async () => 'R U', random: () => 0.6 };
    expect(await generateTimerScramble({ event: '333', cnMode: 'dual' }, dependency)).toMatchObject({ ok: true, scramble: 'x2 R U' });
    expect(await generateTimerScramble({ event: '333' }, dependency)).toMatchObject({ ok: true, scramble: 'R U' });
    expect(await generateTimerScramble({ event: '333bld', cnMode: 'dual' }, dependency)).toMatchObject({ ok: true, scramble: 'R U' });
    expect(await generateTimerScramble({ event: 'custom', cnMode: 'dual' }, dependency)).toMatchObject({ kind: 'manual', scramble: '' });
    expect(await generateTimerScramble({ event: '333', cnMode: 'dual' }, { ...dependency, generateCubingScramble: async () => '' })).toMatchObject({ ok: false, code: 'empty-result' });
    expect(isCnEligible('pll')).toBe(true);
    expect(isCnEligible('333bld')).toBe(false);
    expect(normalizeTimerColorNeutralMode('bad')).toBe('none');
    expect(Array.from({ length: 6 }, (_, i) => applyColorNeutral('R', 'six', () => i / 6))).toEqual(['R', 'x R', "x' R", 'x2 R', 'z R', "z' R"]);
  });

  it('offers the same four modes for an eligible trainer and no ineffective BLD control', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); const onChange = vi.fn();
    try {
      await act(async () => root.render(<TimerColorNeutralSetting event="pll" value="none" onChange={onChange} localize={copy => copy.en} />));
      const select = container.querySelector('select')!;
      expect([...select.options].map(option => option.value)).toEqual(['none', 'single', 'dual', 'six']);
      await act(async () => { select.value = 'dual'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(onChange).toHaveBeenCalledWith('dual');
      await act(async () => root.render(<TimerColorNeutralSetting event="333bld" value="dual" onChange={onChange} localize={copy => copy.en} />));
      expect(container.querySelector('select')).toBeNull();
    } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });

  it('defaults old imports to none, persists the choice and leaves stored scrambles intact', async () => {
    const original = createTimerStoreData(100, 'session');
    original.database.dataBySession.session = { '333': [{ id: 'solve', ts: 99, event: '333', timeMs: 9500, penalty: 'ok', scramble: 'R U' }] };
    let raw = JSON.parse(JSON.stringify(original)); delete raw.settings.cnMode;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(raw), readRecovery: async () => undefined,
      write: async (next: TimerStoreData) => { raw = structuredClone(next); },
      writeWithRecovery: async (next: TimerStoreData) => { raw = structuredClone(next); },
    };
    const env = { now: () => 100, createId: () => 'session', language: () => 'en' as const };
    const repo = new TimerRepository(driver, env);
    expect((await repo.load()).settings.cnMode).toBe('none');
    await repo.updateSettings({ cnMode: 'six' });
    const restored = await new TimerRepository(driver, env).load();
    expect(restored.settings.cnMode).toBe('six'); expect(restored.database).toEqual(original.database);
  });
});
