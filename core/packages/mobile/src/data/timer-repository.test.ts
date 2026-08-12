import { describe, expect, it } from 'vitest';

import { activeTimerSolves, type TimerStoreData } from '@cuberoot/shared/timer';
import {
  CorruptTimerStoreError,
  TimerRepository,
  type TimerStoreDriver,
} from './timer-repository';

class MemoryDriver implements TimerStoreDriver {
  data: TimerStoreData | unknown | undefined;

  async read(): Promise<unknown | undefined> {
    return structuredClone(this.data);
  }

  async write(data: TimerStoreData): Promise<void> {
    this.data = structuredClone(data);
  }
}

function repository(driver = new MemoryDriver()) {
  let now = 100;
  let id = 0;
  return {
    driver,
    repo: new TimerRepository(driver, {
      now: () => now++,
      createId: () => `id-${id++}`,
      language: () => 'en',
    }),
  };
}

describe('mobile timer repository contract', () => {
  it('creates and persists an empty store on first load', async () => {
    const { driver, repo } = repository();
    const data = await repo.load();
    expect(data.activeSessionId).toBe('id-0');
    expect(driver.data).toEqual(data);
  });

  it('serializes concurrent additions without losing a solve', async () => {
    const { repo } = repository();
    await Promise.all([
      repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' }),
      repo.addSolve({ timeMs: 2_000, penalty: '+2', scramble: 'U', event: '333' }),
    ]);
    expect(activeTimerSolves(await repo.load(), '333').map((solve) => solve.timeMs)).toEqual([1_000, 2_000]);
  });

  it('updates penalty/comment and deletes one solve', async () => {
    const { repo } = repository();
    let data = await repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    const solve = activeTimerSolves(data, '333')[0];
    data = await repo.updateSolve('333', solve.id, { penalty: 'DNF', comment: 'turn' });
    expect(activeTimerSolves(data, '333')[0]).toMatchObject({ penalty: 'DNF', comment: 'turn' });
    data = await repo.deleteSolve('333', solve.id);
    expect(activeTimerSolves(data, '333')).toEqual([]);
  });

  it('round-trips export/import and rejects corrupt data without overwriting it', async () => {
    const source = repository();
    await source.repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    const backup = await source.repo.exportJson();

    const target = repository();
    await target.repo.importJson(backup);
    expect(activeTimerSolves(await target.repo.load(), '333')).toHaveLength(1);
    const previous = structuredClone(target.driver.data);
    await expect(target.repo.importJson('{bad')).rejects.toBeInstanceOf(CorruptTimerStoreError);
    expect(target.driver.data).toEqual(previous);
  });

  it('rejects invalid persisted state instead of silently replacing it', async () => {
    const driver = new MemoryDriver();
    driver.data = { schemaVersion: 999 };
    const { repo } = repository(driver);
    await expect(repo.load()).rejects.toBeInstanceOf(CorruptTimerStoreError);
    expect(driver.data).toEqual({ schemaVersion: 999 });
  });

  it('validates setting ranges at the repository boundary', async () => {
    const { repo } = repository();
    await expect(repo.updateSettings({ holdMs: -1 })).rejects.toBeInstanceOf(CorruptTimerStoreError);
  });
});
