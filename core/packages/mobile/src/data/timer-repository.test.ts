import { describe, expect, it } from 'vitest';

import {
  MAX_TIMER_BACKUP_BYTES,
  activeTimerSolves,
  type TimerDatabase,
  type TimerStoreData,
} from '@cuberoot/shared/timer';
import {
  CorruptTimerStoreError,
  TimerRepository,
  type TimerStoreDriver,
} from './timer-repository';

class MemoryDriver implements TimerStoreDriver {
  data: TimerStoreData | unknown | undefined;
  recovery: unknown | undefined;

  async read(): Promise<unknown | undefined> {
    return structuredClone(this.data);
  }

  async write(data: TimerStoreData): Promise<void> {
    this.data = structuredClone(data);
  }

  async readRecovery(): Promise<unknown | undefined> {
    return structuredClone(this.recovery);
  }

  async writeWithRecovery(data: TimerStoreData, recovery: unknown): Promise<void> {
    this.recovery = structuredClone(recovery);
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
    await target.repo.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '333' });
    await target.repo.importJson(backup);
    expect(activeTimerSolves(await target.repo.load(), '333')).toHaveLength(1);
    expect(activeTimerSolves(target.driver.recovery as TimerStoreData, '333')[0].timeMs).toBe(2_000);
    const previous = structuredClone(target.driver.data);
    await expect(target.repo.importJson('{bad')).rejects.toBeInstanceOf(CorruptTimerStoreError);
    expect(target.driver.data).toEqual(previous);
  });

  it('previews website backups, preserves app preferences, and can undo an import', async () => {
    const target = repository();
    await target.repo.updateSettings({ language: 'zh', theme: 'dark' });
    await target.repo.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '333' });
    const websiteBackup: TimerDatabase = {
      version: 3,
      sessions: [{ id: 'web', name: 'Web', createdTs: 10 }],
      activeSessionId: 'web',
      dataBySession: {
        web: {
          '333': [{ id: 'web-solve', timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333', ts: 20 }],
        },
      },
    };

    await expect(target.repo.previewImport(JSON.stringify(websiteBackup))).resolves.toEqual({
      current: { sessionCount: 1, solveCount: 1 },
      incoming: { sessionCount: 1, solveCount: 1 },
    });
    const imported = await target.repo.importJson(JSON.stringify(websiteBackup));
    expect(imported.settings).toMatchObject({ language: 'zh', theme: 'dark' });
    expect(await target.repo.hasImportRecovery()).toBe(true);
    expect(activeTimerSolves(await target.repo.restoreImportRecovery(), '333')[0].timeMs).toBe(2_000);
    expect(await target.repo.hasImportRecovery()).toBe(false);
    await expect(target.repo.restoreImportRecovery()).rejects.toBeInstanceOf(CorruptTimerStoreError);
  });

  it('accepts a valid backup when the existing local state is corrupt', async () => {
    const source = repository();
    const backup = await source.repo.exportJson();
    const driver = new MemoryDriver();
    driver.data = { schemaVersion: 999 };
    const target = repository(driver);
    await expect(target.repo.importJson(backup)).resolves.toMatchObject({ schemaVersion: 1 });
    expect(driver.recovery).toEqual({ schemaVersion: 999 });
    expect(await target.repo.hasImportRecovery()).toBe(false);
  });

  it('rejects oversized backups before parsing or overwriting', async () => {
    const { driver, repo } = repository();
    await repo.load();
    const previous = structuredClone(driver.data);
    await expect(repo.importJson('x'.repeat(MAX_TIMER_BACKUP_BYTES + 1)))
      .rejects.toBeInstanceOf(CorruptTimerStoreError);
    expect(driver.data).toEqual(previous);
    expect(driver.recovery).toBeUndefined();
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
