import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createTimerStoreData } from '@cuberoot/shared/timer';
import { IndexedDbTimerStoreDriver } from './timer-repository';
afterEach(() => { vi.unstubAllGlobals(); });
it('checks restoration permission after opening IndexedDB, and before the first write', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const driver = new IndexedDbTimerStoreDriver();
  const original = createTimerStoreData(1, 'original', 'en');
  await driver.write(original);
  const replacement = createTimerStoreData(2, 'replacement', 'en');
  let allowed = true;
  const pending = driver.writeWithRecovery(replacement, original, () => allowed);
  allowed = false;
  await expect(pending).rejects.toThrow('cancelled');
  expect(await driver.read()).toEqual(original);
  expect(await driver.readRecovery()).toBeUndefined();
  await expect(driver.write(replacement, () => false)).rejects.toThrow('cancelled');
  expect(await driver.read()).toEqual(original);
});
it('backs up newly recorded solves at the configured interval and retains ten database-only snapshots', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const driver = new IndexedDbTimerStoreDriver();
  const data = createTimerStoreData(1, 'group', 'en'); data.settings.autoBackupEvery = 2;
  await driver.write(data);
  const add = async (n: number) => {
    data.database.dataBySession.group = { '333': Array.from({length:n}, (_,i) => ({id:String(i),event:'333' as const,timeMs:1000,penalty:'ok' as const,scramble:'R',ts:i})) };
    await driver.write(data);
  };
  await add(1); expect(await driver.listBackups()).toHaveLength(0);
  await add(2); expect(await driver.listBackups()).toHaveLength(1);
  for (let i=0;i<11;i++) await driver.createBackup(data);
  const entries = await driver.listBackups(); expect(entries).toHaveLength(10);
  const json = JSON.parse((await driver.readBackup(entries[0].key))!);
  expect(json).toEqual(data.database); expect(json.settings).toBeUndefined();
});
