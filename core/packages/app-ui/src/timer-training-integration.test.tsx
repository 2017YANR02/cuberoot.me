// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTimerStoreData, decodeTimerStoreData, normalizeTimerTrainingSettings, parseTargetTime, type RoundConfig, type TimerStoreData, type TimerTrainingSettings } from '@cuberoot/shared/timer';
import { TimerGoalSettings, TimerRoundSettings, TimerRoundPanel, TimerTargetTime, useTimerRound } from '@cuberoot/timer-ui';
import { TimerRepository, type TimerStoreDriver } from './data/timer-repository';

class Driver implements TimerStoreDriver {
  data: unknown;
  async read() { return structuredClone(this.data); }
  async readRecovery() { return undefined; }
  async write(data: TimerStoreData) { this.data = structuredClone(data); }
  async writeWithRecovery(data: TimerStoreData) { await this.write(data); }
}
const environment = { now: () => 100, createId: () => 'session', language: () => 'en' as const };

describe('shared training settings and persisted runtime', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('reads old preferences without replacing solves and persists training across repository restart', async () => {
    const driver = new Driver();
    const legacy = createTimerStoreData(100, 'session');
    legacy.database.dataBySession.session = { '333': [{ id: 'solve', ts: 99, event: '333', timeMs: 9500, penalty: 'ok', scramble: 'R' }] };
    const raw = JSON.parse(JSON.stringify(legacy));
    delete raw.settings.round;
    delete raw.settings.targetMsByEvent;
    delete raw.settings.dailySolveGoal;
    driver.data = raw;
    const repo = new TimerRepository(driver, environment);
    const loaded = await repo.load();
    expect(loaded.settings.round.on).toBe(false);
    expect(loaded.settings.targetMsByEvent).toEqual({});
    expect(loaded.database).toEqual(legacy.database);
    const training: TimerTrainingSettings = {
      targetMsByEvent: { '333': 10_500, '222': 5_000 }, dailySolveGoal: 50,
      round: { on: true, format: 'ao5', cutoffMs: 10_000, cutoffAttempts: 2, limitMs: 60_000, cumulative: true },
    };
    await repo.updateSettings(training);
    const restarted = await new TimerRepository(driver, environment).load();
    expect(restarted.settings).toMatchObject(training);
    expect(restarted.database).toEqual(legacy.database);
    expect(decodeTimerStoreData(JSON.parse(JSON.stringify(restarted)))?.settings).toMatchObject(training);
  });

  it.each(['en', 'zh'] as const)('commits editable durations and exposes round fields only when enabled (%s)', async language => {
    let snapshot = createTimerStoreData(100, 'session').settings;
    function Harness() {
      const [settings, setSettings] = useState(snapshot);
      const update = (patch: Partial<TimerTrainingSettings>) => { snapshot = { ...snapshot, ...patch }; setSettings(snapshot); };
      return <>
        <TimerGoalSettings value={settings} event="333" onChange={update} localize={copy => copy[language]} />
        <TimerRoundSettings value={settings} onChange={patch => update({ round: { ...snapshot.round, ...patch } })} localize={copy => copy[language]} />
      </>;
    }
    await act(async () => root.render(<Harness />));
    const input = container.querySelector<HTMLInputElement>('[data-setting-id="settings.training.target-time"] input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1:02.50');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    expect(snapshot.targetMsByEvent['333']).toBe(62_500);
    expect(input.value).toBe('1:02.50');
    expect(container.querySelector('[data-setting-id="settings.training.round-format"]')).toBeNull();
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>('[data-setting-id="settings.training.round-enabled"] select')!;
      select.value = 'true';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(snapshot.round.on).toBe(true);
    expect(container.querySelectorAll('[data-setting-id^="settings.training.round-"]')).toHaveLength(5);
    expect(parseTargetTime('')).toBeNull();
  });

  it('renders the shared cutoff result and raw target delta', async () => {
    const config = { ...createTimerStoreData(100, 'session').settings.round, on: true, cutoffMs: 10_000 };
    const solves = [11_000, 12_000].map((timeMs, index) => ({ id: String(index), timeMs, ts: index, penalty: 'ok' as const, event: '333' as const, scramble: 'R' }));
    await act(async () => root.render(<>
      <TimerRoundPanel solves={solves} config={config} localize={copy => copy.en} />
      <TimerTargetTime targetMs={10_500} displayMs={11_234} localize={copy => copy.en} />
    </>));
    expect(container.textContent).toContain('cut');
    expect(container.querySelector('.target-delta')?.textContent).toBe('-0.73s');
    expect(container.querySelector('.timer-target-indicator')?.classList.contains('overshot')).toBe(true);
  });

  it('merges blur then selection on the latest queued round despite delayed persistence', async () => {
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    class DelayedDriver extends Driver {
      override async write(data: TimerStoreData) { await barrier; await super.write(data); }
    }
    const driver = new DelayedDriver();
    const initial = createTimerStoreData(100, 'session');
    initial.settings.round.on = true;
    driver.data = initial;
    const repository = new TimerRepository(driver, environment);
    const pending: Promise<void>[] = [];
    function Harness() {
      const [settings, setSettings] = useState(initial.settings);
      const onChange = (patch: Partial<RoundConfig>) => {
        pending.push(repository.updateSettings(current => ({ round: { ...current.round, ...patch } }))
          .then(data => { setSettings(data.settings); }));
      };
      return <TimerRoundSettings value={settings} onChange={onChange} localize={copy => copy.en} />;
    }
    await act(async () => root.render(<Harness />));
    const input = container.querySelector<HTMLInputElement>('[data-setting-id="settings.training.round-cutoff"] input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '12.5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      const select = container.querySelector<HTMLSelectElement>('[data-setting-id="settings.training.round-cumulative"] select')!;
      select.value = 'true';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(pending).toHaveLength(2);
    const limit = container.querySelector<HTMLInputElement>('[data-setting-id="settings.training.round-time-limit"] input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(limit, '1:30');
      limit.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { release(); await Promise.all(pending); });
    expect((await repository.load()).settings.round).toMatchObject({ cutoffMs: 12_500, cumulative: true });
    expect(input.value).toBe('0:12.50');
    expect(limit.value).toBe('1:30');
  });

  it('keeps new attempts after deleting old history and resets on data replacement', async () => {
    const config = { ...createTimerStoreData(100, 'session').settings.round, on: true };
    const make = (id: string) => ({ id, ts: 100, timeMs: 1000, penalty: 'ok' as const, event: '333' as const, scramble: 'R' });
    let result!: ReturnType<typeof useTimerRound>;
    function Harness({ ids }: { ids: string[] }) {
      result = useTimerRound(ids.map(make), config, 'session|333');
      return <span>{result.solves.map(solve => solve.id).join(',')}</span>;
    }
    await act(async () => root.render(<Harness ids={['old-a', 'old-b']} />));
    await act(async () => result.start());
    await act(async () => root.render(<Harness ids={['old-b', 'new']} />));
    expect(container.textContent).toBe('new');
    await act(async () => root.render(<Harness ids={['old-a', 'old-b', 'new']} />));
    expect(container.textContent).toBe('new');
    await act(async () => result.reset());
    expect(container.textContent).toBe('old-a,old-b,new');
  });

  it('rejects durations outside exact integer milliseconds', () => {
    expect(parseTargetTime('1e16')).toBeNull();
    expect(normalizeTimerTrainingSettings({ targetMsByEvent: { '333': 1e19 }, round: { limitMs: 1e19 } }))
      .toMatchObject({ targetMsByEvent: {}, round: { limitMs: null } });
  });

  it.each([{ format: ['ao5'] }, { format: {} }, { format: true }, { format: null }])('does not coerce malformed round formats (%j)', ({ format }) => {
    const result = normalizeTimerTrainingSettings({ round: { on: true, format } });
    expect(result.round.format).toBe('ao5');
    expect(typeof result.round.format).toBe('string');
  });
});
