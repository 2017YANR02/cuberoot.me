import { describe, expect, it } from 'vitest';

import {
  MAX_TIMER_BACKUP_BYTES,
  TIMER_SCRAMBLE_CLICK_ACTIONS,
  activeTimerSolves,
  createTimerManualEntryDraft,
  timerWcaCompetitionScrambleSlotIdentity,
  validateTimerManualEntry,
  type TimerDatabase,
  type TimerStoreData,
} from '@cuberoot/shared/timer';
import {
  CorruptTimerStoreError,
  TimerRepository,
  TimerSessionRepositoryError,
  type TimerStoreDriver,
} from './timer-repository';

class MemoryDriver implements TimerStoreDriver {
  data: TimerStoreData | unknown | undefined;
  recovery: unknown | undefined;
  failWrites = false;
  failWritesRemaining = 0;
  commitThenFailOnce = false;
  writeCount = 0;

  async read(): Promise<unknown | undefined> {
    return structuredClone(this.data);
  }

  async write(data: TimerStoreData): Promise<void> {
    if (this.failWrites) throw new Error('disk full');
    if (this.failWritesRemaining > 0) {
      this.failWritesRemaining -= 1;
      throw new Error('transient write failure');
    }
    this.writeCount += 1;
    this.data = structuredClone(data);
    if (this.commitThenFailOnce) {
      this.commitThenFailOnce = false;
      throw new Error('ambiguous write completion');
    }
  }

  async readRecovery(): Promise<unknown | undefined> {
    return structuredClone(this.recovery);
  }

  async writeWithRecovery(data: TimerStoreData, recovery: unknown): Promise<void> {
    if (this.failWrites) throw new Error('disk full');
    this.writeCount += 1;
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
    expect(data.database.activeSessionId).toBe('id-0');
    expect(data.settings.scrambleClickAction).toBe('copy');
    expect(data.settings).toMatchObject({ showCubePreview: true, prefer3D: false });
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

  it('retries one failed solve write without losing or duplicating the solve', async () => {
    const { driver, repo } = repository();
    await repo.load();
    driver.failWritesRemaining = 1;
    await repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    expect(activeTimerSolves(await repo.load(), '333')).toHaveLength(1);

    driver.commitThenFailOnce = true;
    await repo.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '333' });
    expect(activeTimerSolves(await repo.load(), '333').map((solve) => solve.timeMs)).toEqual([1_000, 2_000]);
  });

  it('can save once after a persistent failure is cleared', async () => {
    const { driver, repo } = repository();
    await repo.load();
    const solve = { timeMs: 1_000, penalty: 'ok' as const, scramble: 'R', event: '333' as const };
    driver.failWritesRemaining = 2;
    await expect(repo.addSolve(solve)).rejects.toThrow('transient write failure');

    await repo.addSolve(solve);
    expect(activeTimerSolves(await repo.load(), '333')).toHaveLength(1);
  });

  it('confirms a final ambiguous write before exposing a retry', async () => {
    const { driver, repo } = repository();
    await repo.load();
    driver.failWritesRemaining = 1;
    driver.commitThenFailOnce = true;

    await repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    expect(activeTimerSolves(await repo.load(), '333')).toHaveLength(1);
  });

  it('retries pending solves into their original sessions', async () => {
    const { driver, repo } = repository();
    const first = await repo.load();
    const firstId = first.database.activeSessionId;
    const second = await repo.createSession('Second', '222');
    const secondId = second.database.activeSessionId;
    const third = await repo.createSession('Third', '333oh');
    const thirdId = third.database.activeSessionId;

    driver.failWritesRemaining = 2;
    const firstSolve = { timeMs: 1_000, penalty: 'ok' as const, scramble: 'R', event: '333' as const };
    await expect(repo.addSolve(firstSolve, firstId)).rejects.toThrow('transient write failure');
    await repo.addSolve(firstSolve, firstId);
    await repo.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '222' }, secondId);

    const data = await repo.load();
    expect(data.database.activeSessionId).toBe(thirdId);
    expect(data.database.dataBySession[firstId]?.['333']).toHaveLength(1);
    expect(data.database.dataBySession[secondId]?.['222']).toHaveLength(1);
    expect(data.database.dataBySession[thirdId]?.['333']).toBeUndefined();
  });

  it('does not redirect a pending solve when its original session was deleted', async () => {
    const { repo } = repository();
    const first = await repo.load();
    const firstId = first.database.activeSessionId;
    await repo.createSession('Second', '222');
    await repo.deleteSession(firstId);

    await expect(repo.addSolve(
      { timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' },
      firstId,
    )).rejects.toMatchObject({ failure: 'unknown-session' });
  });

  it('round-trips the shared smart-cube reconstruction payload', async () => {
    const { repo } = repository();
    const stageSegments = {
      crossDoneMs: 300, f2lDoneMs: 700, ollDoneMs: 900, solvedMs: 1_000,
      crossMs: 300, f2lMs: 400, ollMs: 200, pllMs: 100,
      crossHtm: 4, f2lHtm: 8, ollHtm: 7, pllHtm: 11,
      crossSide: 'D-cross', ollCase: 'OLL skip', pllCase: 'PLL T',
    };
    await repo.addSolve({
      device: { model: 'gan-v4', name: 'GAN 16 ui' },
      event: '333',
      moves: [{ m: 'R', ts: 0 }, { m: "R'", ts: 1_000 }],
      penalty: 'ok',
      scramble: 'R',
      stageSegments,
      timeMs: 1_000,
    });

    expect(activeTimerSolves(await repo.load(), '333')[0]).toMatchObject({
      device: { model: 'gan-v4', name: 'GAN 16 ui' },
      moves: [{ m: 'R', ts: 0 }, { m: "R'", ts: 1_000 }],
      stageSegments,
    });
  });

  it('persists the exact reviewed WCA occurrence identity even when move text repeats', async () => {
    const { repo } = repository();
    const firstSlot = timerWcaCompetitionScrambleSlotIdentity({
      competitionId: 'BrockportBolt2025', eventId: '333', roundTypeId: '1',
      groupId: 'A', isExtra: false, scrambleNumber: 1,
    });
    const secondSlot = timerWcaCompetitionScrambleSlotIdentity({
      competitionId: 'BrockportBolt2025', eventId: '333', roundTypeId: '1',
      groupId: 'A', isExtra: false, scrambleNumber: 2,
    });
    expect(firstSlot).not.toBe(secondSlot);

    await repo.addSolve({
      timeMs: 1_234,
      penalty: 'ok',
      scramble: "R U R'",
      event: '333',
      scrambleSource: { kind: 'wca', identity: firstSlot },
    });
    const saved = activeTimerSolves(await repo.load(), '333')[0]!;
    expect(saved.scramble).toBe("R U R'");
    expect(saved.scrambleSource).toEqual({ kind: 'wca', identity: firstSlot });
    expect(saved.scrambleSource?.identity).not.toBe(secondSlot);
  });

  it('persists every shared manual-entry result shape without losing metadata', async () => {
    const { repo } = repository();
    const normal = validateTimerManualEntry({
      ...createTimerManualEntryDraft('333', "R U R'"),
      comment: 'judge note',
      penalty: 'DNS',
      time: '12.34',
    }).value;
    const fmc = validateTimerManualEntry({
      ...createTimerManualEntryDraft('333fm', "R U R' U'"),
      comment: 'transcribed',
      fmcSolution: "U R U' R'",
    }).value;
    const mbld = validateTimerManualEntry({
      ...createTimerManualEntryDraft('333mbld', 'multi scramble'),
      mbldAttempted: '2',
      mbldSolved: '1',
      time: '10:00',
    }).value;
    if (!normal || !fmc || !mbld) throw new Error('valid shared manual-entry fixture rejected');

    await repo.addSolve(normal);
    await repo.addSolve(fmc);
    await repo.addSolve(mbld);

    const data = await repo.load();
    expect(activeTimerSolves(data, '333')[0]).toMatchObject({
      comment: 'judge note',
      event: '333',
      penalty: 'DNS',
      scramble: "R U R'",
      timeMs: 12_340,
    });
    expect(activeTimerSolves(data, '333fm')[0]).toMatchObject({
      comment: "U R U' R'\ntranscribed",
      event: '333fm',
      penalty: 'ok',
      timeMs: 4_000,
    });
    expect(activeTimerSolves(data, '333mbld')[0]).toMatchObject({
      event: '333mbld',
      mbld: { solved: 1, attempted: 2 },
      penalty: 'DNF',
      timeMs: 600_000,
    });
  });

  it('persists a flat v1 app envelope as nested v2 on load', async () => {
    const driver = new MemoryDriver();
    driver.data = {
      schemaVersion: 1,
      sessions: [{ id: 'legacy', name: 'Legacy', createdTs: 1 }],
      activeSessionId: 'legacy',
      dataBySession: { legacy: {} },
      settings: { event: '333', inspectionSec: 0, holdMs: 300, language: 'en', theme: 'system' },
    };
    const { repo } = repository(driver);

    await expect(repo.load()).resolves.toMatchObject({ schemaVersion: 2, database: { version: 3 } });
    expect(driver.data).toMatchObject({ schemaVersion: 2, database: { version: 3 } });
    expect((driver.data as TimerStoreData).settings.statsRollingColumns).toEqual(['ao5', 'ao12']);
    expect((driver.data as TimerStoreData).settings.scrambleClickAction).toBe('copy');
    expect((driver.data as TimerStoreData).settings).toMatchObject({
      showCubePreview: true,
      prefer3D: false,
    });
  });

  it('updates penalty/comment and deletes one solve', async () => {
    const { repo } = repository();
    let data = await repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    const sessionId = data.database.activeSessionId;
    const solve = activeTimerSolves(data, '333')[0];
    data = await repo.updateSolve('333', solve.id, { penalty: 'DNF', comment: 'turn' });
    expect(activeTimerSolves(data, '333')[0]).toMatchObject({ penalty: 'DNF', comment: 'turn' });
    data = await repo.deleteSolve('333', solve.id);
    expect(activeTimerSolves(data, '333')).toEqual([]);
    data = await repo.restoreSolve(sessionId, solve);
    expect(activeTimerSolves(data, '333')).toEqual([solve]);
    await expect(repo.restoreSolve(sessionId, solve)).resolves.toEqual(data);
  });

  it('serializes field-level solve updates without reverting a sibling field', async () => {
    const { repo } = repository();
    const created = await repo.addSolve({ timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333' });
    const solve = activeTimerSolves(created, '333')[0];

    await Promise.all([
      repo.updateSolve('333', solve.id, { penalty: '+2' }),
      repo.updateSolve('333', solve.id, { comment: 'PB' }),
    ]);

    expect(activeTimerSolves(await repo.load(), '333')[0]).toMatchObject({
      comment: 'PB',
      penalty: '+2',
    });
  });

  it('clears only the requested event in the active session', async () => {
    const { repo } = repository();
    await repo.addSolve({ timeMs: 2_220, penalty: 'ok', scramble: "R U R'", event: '222' });
    let data = await repo.addSolve({ timeMs: 3_330, penalty: 'ok', scramble: 'R U', event: '333' });
    const activeSessionId = data.database.activeSessionId;

    data = await repo.clearSessionEvent(activeSessionId, '222');
    expect(activeTimerSolves(data, '222')).toEqual([]);
    expect(activeTimerSolves(data, '333').map((solve) => solve.timeMs)).toEqual([3_330]);

    const unchanged = await repo.clearSessionEvent(activeSessionId, '222');
    expect(activeTimerSolves(unchanged, '333').map((solve) => solve.timeMs)).toEqual([3_330]);
  });

  it('persists the active event and isolates solve mutations by event bucket', async () => {
    const { repo } = repository();
    await repo.updateSettings({
      event: '222',
      manualScrambles: "R U R'\nF2",
      scramble222Mode: 'wca',
      scramble222Type: 'eg1',
      genByStepsOn: true,
      genStepsMetric: 'qtm',
      genSteps: [10, 11, 12],
      scrambleClickAction: 'next',
    });
    await repo.addSolve({ timeMs: 2_220, penalty: 'ok', scramble: "R U R'", event: '222' });
    await repo.addSolve({ timeMs: 3_330, penalty: 'ok', scramble: 'R U', event: '333' });

    let data = await repo.load();
    expect(data.settings.event).toBe('222');
    expect(data.settings.manualScrambles).toBe("R U R'\nF2");
    expect(data.settings.scramble222Mode).toBe('wca');
    expect(data.settings.scramble222Type).toBe('eg1');
    expect(data.settings.genByStepsOn).toBe(true);
    expect(data.settings.genStepsMetric).toBe('qtm');
    expect(data.settings.genSteps).toEqual([10, 11, 12]);
    expect(data.settings.scrambleClickAction).toBe('next');
    expect(activeTimerSolves(data, '222').map((solve) => solve.timeMs)).toEqual([2_220]);
    expect(activeTimerSolves(data, '333').map((solve) => solve.timeMs)).toEqual([3_330]);

    const twoByTwo = activeTimerSolves(data, '222')[0];
    data = await repo.updateSolve(twoByTwo.event, twoByTwo.id, { penalty: '+2', comment: '222 only' });
    expect(activeTimerSolves(data, '222')[0]).toMatchObject({ penalty: '+2', comment: '222 only' });
    expect(activeTimerSolves(data, '333')[0].penalty).toBe('ok');
    expect(activeTimerSolves(data, '333')[0]).not.toHaveProperty('comment');

    data = await repo.deleteSolve(twoByTwo.event, twoByTwo.id);
    expect(activeTimerSolves(data, '222')).toEqual([]);
    expect(activeTimerSolves(data, '333')).toHaveLength(1);
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
    await expect(target.repo.importJson(backup)).resolves.toMatchObject({ schemaVersion: 2 });
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
    await expect(repo.updateSettings({ runningPrecision: 4 as 3 })).rejects.toBeInstanceOf(CorruptTimerStoreError);
    await expect(repo.updateSettings({ scrambleClickAction: 'invalid' as 'copy' }))
      .rejects.toBeInstanceOf(CorruptTimerStoreError);
    await expect(repo.updateSettings({ showCubePreview: 'yes' as unknown as boolean }))
      .rejects.toBeInstanceOf(CorruptTimerStoreError);
    await expect(repo.updateSettings({ prefer3D: 1 as unknown as boolean }))
      .rejects.toBeInstanceOf(CorruptTimerStoreError);
  });

  it('persists scramble preview visibility and 2D/3D preference independently', async () => {
    const { repo } = repository();
    await repo.updateSettings({ showCubePreview: false, prefer3D: true });
    await expect(repo.load()).resolves.toMatchObject({
      settings: { showCubePreview: false, prefer3D: true },
    });
    await repo.updateSettings({ showCubePreview: true });
    await expect(repo.load()).resolves.toMatchObject({
      settings: { showCubePreview: true, prefer3D: true },
    });
  });

  it('persists every shared scramble click action', async () => {
    const { repo } = repository();
    for (const scrambleClickAction of TIMER_SCRAMBLE_CLICK_ACTIONS) {
      await repo.updateSettings({ scrambleClickAction });
      await expect(repo.load()).resolves.toMatchObject({ settings: { scrambleClickAction } });
    }
  });

  it('persists all eight shared timing settings without a Mobile-only schema', async () => {
    const { repo } = repository();
    const data = await repo.updateSettings({
      timingEnabled: false,
      inspectionSec: 15,
      holdMs: 650,
      autoSessionForEvent: true,
      autoEventForSession: true,
      hideTime: true,
      runningPrecision: 1,
      precision: 2,
    });
    expect(data.settings).toMatchObject({
      timingEnabled: false,
      inspectionSec: 15,
      holdMs: 650,
      autoSessionForEvent: true,
      autoEventForSession: true,
      hideTime: true,
      runningPrecision: 1,
      precision: 2,
    });
    await expect(repo.load()).resolves.toMatchObject({ settings: data.settings });
  });

  it('persists and normalizes the same compact rolling-stat columns as the website', async () => {
    const { repo } = repository();
    const data = await repo.updateSettings({ statsRollingColumns: ['ao100', 'mo3'] });
    expect(data.settings.statsRollingColumns).toEqual(['mo3', 'ao100']);
    await expect(repo.load()).resolves.toMatchObject({
      settings: { statsRollingColumns: ['mo3', 'ao100'] },
    });

    const restoredDefaults = await repo.updateSettings({ statsRollingColumns: [] });
    expect(restoredDefaults.settings.statsRollingColumns).toEqual(['ao5', 'ao12']);
    await expect(repo.updateSettings({ statsRollingColumns: ['invalid' as 'ao5'] }))
      .rejects.toBeInstanceOf(CorruptTimerStoreError);
  });

  it('persists create/switch/rename/clear/delete with active fallback and event isolation', async () => {
    const { driver, repo } = repository();
    await repo.addSolve({ timeMs: 3_000, penalty: 'ok', scramble: 'R', event: '333' });
    const initial = await repo.load();
    const firstId = initial.database.activeSessionId;

    let data = await repo.createSession('  Pocket  ', '222');
    const pocketId = data.database.activeSessionId;
    expect(pocketId).not.toBe(firstId);
    expect(data.database.sessions.find((session) => session.id === pocketId)).toMatchObject({
      name: 'Pocket', event: '222',
    });
    expect(activeTimerSolves(data, '333')).toEqual([]);

    data = await repo.addSolve({ timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '222' });
    expect(activeTimerSolves(data, '222')).toHaveLength(1);
    data = await repo.activateSession(firstId);
    expect(data.database.activeSessionId).toBe(firstId);
    expect(activeTimerSolves(data, '333').map((solve) => solve.timeMs)).toEqual([3_000]);
    expect(activeTimerSolves(data, '222')).toEqual([]);

    data = await repo.renameSession(pocketId, '  Two by two  ');
    expect(data.database.sessions.find((session) => session.id === pocketId)?.name).toBe('Two by two');
    data = await repo.clearSession(pocketId);
    expect(data.database.dataBySession[pocketId]).toEqual({});

    await repo.activateSession(pocketId);
    data = await repo.deleteSession(pocketId);
    expect(data.database.activeSessionId).toBe(firstId);
    expect(data.database.sessions.map((session) => session.id)).toEqual([firstId]);
    expect(data.database.dataBySession).not.toHaveProperty(pocketId);

    const restarted = new TimerRepository(driver, {
      now: () => 999,
      createId: () => 'restart-id',
      language: () => 'en',
    });
    const restored = await restarted.load();
    expect(restored.database.activeSessionId).toBe(firstId);
    expect(activeTimerSolves(restored, '333').map((solve) => solve.timeMs)).toEqual([3_000]);
  });

  it('surfaces unknown/last-session/write failures without replacing valid data', async () => {
    const { driver, repo } = repository();
    const initial = await repo.load();
    const activeId = initial.database.activeSessionId;

    await expect(repo.activateSession('missing')).rejects.toMatchObject({
      failure: 'unknown-session',
    });
    await expect(repo.renameSession('missing', 'X')).rejects.toMatchObject({
      failure: 'unknown-session',
    });
    await expect(repo.deleteSession(activeId)).rejects.toMatchObject({
      failure: 'last-session',
    });
    expect(driver.data).toEqual(initial);

    driver.failWrites = true;
    await expect(repo.renameSession(activeId, 'Renamed')).rejects.toMatchObject({
      failure: 'write-failure',
    });
    expect(driver.data).toEqual(initial);
    await expect(repo.renameSession(activeId, 'Renamed')).rejects.toBeInstanceOf(
      TimerSessionRepositoryError,
    );
  });

  it('serializes concurrent session creates and an activate-then-add sequence', async () => {
    const { driver, repo } = repository();
    const initial = await repo.load();
    const firstId = initial.database.activeSessionId;

    await Promise.all([
      repo.createSession('Second', '222'),
      repo.createSession('Third', '333oh'),
    ]);
    let data = await repo.load();
    expect(data.database.sessions.map((session) => session.name)).toEqual([
      'Default', 'Second', 'Third',
    ]);
    expect(data.database.activeSessionId).toBe(
      data.database.sessions.find((session) => session.name === 'Third')?.id,
    );

    const writesBefore = driver.writeCount;
    const [, added, latest] = await Promise.all([
      repo.activateSession(firstId),
      repo.addSolve({ timeMs: 4_000, penalty: 'ok', scramble: 'F', event: '333' }),
      repo.load(),
    ]);
    expect(added.database.activeSessionId).toBe(firstId);
    expect(activeTimerSolves(added, '333').map((solve) => solve.timeMs)).toEqual([4_000]);
    expect(latest).toEqual(added);
    expect(driver.writeCount - writesBefore).toBe(2);
    data = await repo.load();
    expect(data).toEqual(added);
  });

  it('persists canonical association/select/activate-for-event semantics', async () => {
    const { driver, repo } = repository();
    let data = await repo.load();
    const firstId = data.database.activeSessionId;

    data = await repo.selectEvent('222');
    expect(data.settings.event).toBe('222');
    expect(data.database.sessions[0]?.event).toBe('222');
    const second = await repo.createSession('OH', '333oh');
    const secondId = second.database.activeSessionId;
    await repo.activateSession(firstId);

    const matched = await repo.activateSessionForEvent('333oh');
    expect(matched.sessionId).toBe(secondId);
    expect(matched.data.database.activeSessionId).toBe(secondId);
    const noMatch = await repo.activateSessionForEvent('fto');
    expect(noMatch.sessionId).toBeNull();
    expect(noMatch.data.database.activeSessionId).toBe(secondId);

    const restarted = new TimerRepository(driver, {
      now: () => 999,
      createId: () => 'restart-id',
      language: () => 'en',
    });
    const restored = await restarted.load();
    expect(restored.settings.event).toBe('222');
    expect(restored.database.activeSessionId).toBe(secondId);
    expect(restored.database.sessions.find((session) => session.id === firstId)?.event).toBe('222');
  });

  it('matches Web auto event/session coupling in one persisted transaction', async () => {
    const { repo } = repository();
    let data = await repo.load();
    const firstId = data.database.activeSessionId;
    await repo.setSessionEvent(firstId, '333');
    data = await repo.createSession('Pocket', '222');
    const pocketId = data.database.activeSessionId;

    await repo.updateSettings({
      autoSessionForEvent: true,
      autoEventForSession: true,
    });
    data = await repo.activateSession(firstId);
    expect(data.settings.event).toBe('333');
    data = await repo.activateSession(pocketId);
    expect(data.settings.event).toBe('222');

    data = await repo.selectEvent('333');
    expect(data.database.activeSessionId).toBe(firstId);
    expect(data.settings.event).toBe('333');

    data = await repo.selectEvent('fto');
    expect(data.database.activeSessionId).toBe(firstId);
    expect(data.database.sessions.find((session) => session.id === firstId)?.event).toBe('fto');
    expect(data.settings.event).toBe('fto');
  });

  it('moves a solve through the same shared operation and rejects stale ids', async () => {
    const { repo } = repository();
    let data = await repo.addSolve({
      timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333',
    });
    const sourceId = data.database.activeSessionId;
    const solveId = activeTimerSolves(data, '333')[0]!.id;
    data = await repo.createSession('Target', '333');
    const targetId = data.database.activeSessionId;
    await repo.activateSession(sourceId);

    data = await repo.moveSolveToSession(solveId, targetId);
    expect(activeTimerSolves(data, '333')).toEqual([]);
    expect(data.database.dataBySession[targetId]?.['333']?.[0]?.id).toBe(solveId);
    await expect(repo.moveSolveToSession('missing', targetId)).rejects.toMatchObject({
      failure: 'unknown-solve',
    });
  });
});
