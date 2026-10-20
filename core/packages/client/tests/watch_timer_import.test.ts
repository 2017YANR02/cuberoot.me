import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBObjectStore } from 'fake-indexeddb';
import { IndexedDbTimerStoreDriver, TimerRepository } from '../../app-ui/src/data/timer-repository';
import { decodeWatchTimerRecord, watchTimerSlot, type WatchTimerRecord } from '../../app-ui/src/watch-timer';

const env = { now: () => 1000, createId: () => 'phone-session', language: () => 'en' as const };
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('cuberoot-mobile');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
});
async function setup() {
  const driver = new IndexedDbTimerStoreDriver();
  const repo = new TimerRepository(driver, env);
  const data = await repo.load();
  const record: WatchTimerRecord = { version: 1, id: '8B7FF5B5-B7FA-4D6F-BC2C-755E1DAD445C',
    slot: watchTimerSlot(data, "R U R'"), ts: 500, timeMs: 12345, penalty: '+2', inspectionMs: 16000 };
  return { driver, repo, record };
}
describe('watch result import durability', () => {
  it('preserves original values, imports once across restart, and never overwrites phone edits or resurrects deletion', async () => {
    const { repo, driver, record } = await setup();
    const data = await repo.importWatchSolve(record);
    const solve = data.database.dataBySession['phone-session']['333']![0];
    expect(solve.id).toBe(`watch-${record.id}`);
    expect(solve.ts).toBe(500); expect(solve.timeMs).toBe(12345); expect(solve.penalty).toBe('+2');
    await repo.updateSolve('333', solve.id, { penalty: 'DNF' });
    const restarted = new TimerRepository(driver, env);
    expect((await restarted.importWatchSolve(record)).database.dataBySession['phone-session']['333']).toHaveLength(1);
    expect((await restarted.load()).database.dataBySession['phone-session']['333']![0].penalty).toBe('DNF');
    await restarted.deleteSolve('333', solve.id);
    expect((await restarted.importWatchSolve(record)).database.dataBySession['phone-session']['333']).toHaveLength(0);
  });
  it('applies ordered feedback without overwriting the solve or resurrecting deleted results', async () => {
    const { repo, record } = await setup();
    const first = await repo.importWatchSolve(record);
    const id = first.database.dataBySession['phone-session']['333']![0].id;
    await repo.updateSolve('333', id, { penalty: 'DNF' });
    await repo.importWatchSolve({ ...record, reconOk: true, reconRevision: 1 });
    await repo.importWatchSolve({ ...record, reconOk: false, reconRevision: 2 });
    await repo.importWatchSolve({ ...record, reconOk: true, reconRevision: 1 });
    let rows = (await repo.load()).database.dataBySession['phone-session']['333']!;
    expect(rows).toHaveLength(1); expect(rows[0].reconOk).toBe(false); expect(rows[0].penalty).toBe('DNF');
    await repo.importWatchSolve({ ...record, reconRevision: 3 });
    expect((await repo.load()).database.dataBySession['phone-session']['333']![0].reconOk).toBeUndefined();
    await repo.deleteSolve('333', id);
    rows = (await repo.importWatchSolve({ ...record, reconOk: true, reconRevision: 4 })).database.dataBySession['phone-session']['333']!;
    expect(rows).toHaveLength(0);
  });
  it('keeps receipt across import/restore and concurrent phone writes', async () => {
    const { repo, record } = await setup();
    const empty = await repo.exportJson();
    await Promise.all([repo.importWatchSolve(record), repo.addSolve({event:'333', timeMs:9000, penalty:'ok', scramble:'U'})]);
    expect((await repo.load()).database.dataBySession['phone-session']['333']).toHaveLength(2);
    await repo.importJson(empty);
    expect((await repo.importWatchSolve(record)).database.dataBySession['phone-session']['333'] ?? []).toHaveLength(0);
  });
  it('recovers a deleted group without changing current selection and reuses the recovery group', async () => {
    const { repo, record } = await setup();
    record.slot.sessionId = 'deleted-group';
    await repo.importWatchSolve(record);
    const next = await repo.importWatchSolve({...record, id:'other-watch-record'});
    expect(next.database.activeSessionId).toBe('phone-session');
    expect(next.database.sessions).toHaveLength(2);
    expect(next.database.dataBySession['watch-recovered-deleted-group']['333']).toHaveLength(2);
  });
  it('transaction failure commits neither receipt nor solve and permits retry', async () => {
    const { repo, driver, record } = await setup();
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value, key) {
      if (typeof key === 'string' && key.startsWith('receipt:')) {
        this.transaction.abort(); throw new Error('disk full');
      }
      return put.call(this, value, key);
    });
    await expect(repo.importWatchSolve(record)).rejects.toThrow();
    spy.mockRestore();
    expect(await driver.hasReceipt(`watch-${record.id}`)).toBe(false);
    expect((await repo.load()).database.dataBySession['phone-session']['333'] ?? []).toHaveLength(0);
    expect((await repo.importWatchSolve(record)).database.dataBySession['phone-session']['333']).toHaveLength(1);
  });
  it('rejects malformed / unsupported records', async () => {
    const { record } = await setup();
    expect(decodeWatchTimerRecord({...record, timeMs: NaN})).toBeNull();
    expect(decodeWatchTimerRecord({...record, slot:{...record.slot,event:'333fm'}})).toBeNull();
    expect(decodeWatchTimerRecord({...record, slot:{...record.slot,sessionId:'__proto__'}})).toBeNull();
    expect(decodeWatchTimerRecord({...record, moves:[{m:'U',ts:NaN}]})).toBeNull();
    expect(decodeWatchTimerRecord({...record, moves:[{m:'U',ts:10},{m:'U',ts:9}]})).toBeNull();
  });
  it('imports watch recordings into the existing Solve reconstruction fields without changing raw moves', async () => {
    const { repo, record } = await setup();
    record.slot.scramble = 'R'; record.timeMs = 500;
    record.moves = [{ m:'R', ts:0 },{ m:'R', ts:250 },{ m:'R', ts:500 }];
    record.device = { model:'gan-v4', name:'GAN16ui' };
    const data = await repo.importWatchSolve(record);
    const solve = data.database.dataBySession['phone-session']['333']![0];
    expect(solve.moves).toEqual(record.moves);
    expect(solve.device).toEqual(record.device);
    expect(solve.stageSegments?.solvedMs).toBe(500);
  });
});
