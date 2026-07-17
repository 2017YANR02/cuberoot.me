import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';

// timer 自动备份迁 IndexedDB(backup-idb.ts):存量 localStorage 备份一次性
// 搬入、push 轮换保留 10 份、restore 回读。测试按声明顺序串行,共享同一个
// fake IDB(连接被模块缓存,deleteDatabase 会被挂起,别在 beforeEach 清库)。

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
    _keys() { return [...map.keys()]; },
  };
}

const g = globalThis as unknown as { window?: unknown; localStorage?: ReturnType<typeof makeLocalStorage>; navigator?: unknown };
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const { pushBackup, listBackups, restoreBackup } = await import('@/app/[lang]/timer/_lib/storage/db');

const DB_KEY = 'cuberoot-timer.v3';

/** 造一份合法 v3 库并写进(假)localStorage,返回其 JSON。 */
function seedDb(marker: string): string {
  const db = {
    version: 3,
    sessions: [{ id: 's1', name: marker, createdTs: 1 }],
    activeSessionId: 's1',
    dataBySession: { s1: {} },
  };
  g.localStorage!.setItem(DB_KEY, JSON.stringify(db));
  return JSON.stringify(db);
}

describe('timer backups on IndexedDB', () => {
  it('migrates legacy localStorage backups into IDB and removes the keys', async () => {
    seedDb('m');
    g.localStorage!.setItem('cuberoot-timer.backup.v1.1000', '{"version":3,"legacy":1}');
    g.localStorage!.setItem('cuberoot-timer.backup.v1.2000', '{"version":3,"legacy":2}');

    const list = await listBackups();
    expect(list.map(e => e.ts)).toEqual([2000, 1000]);
    // 迁移完成,localStorage 里不再有备份 key
    expect(g.localStorage!._keys().some(k => k.startsWith('cuberoot-timer.backup.v1.'))).toBe(false);
    // key 是纯数字(IDB 条目),size 是字符长度
    expect(list[0].key).toBe('2000');
    expect(list[0].size).toBe('{"version":3,"legacy":2}'.length);
  });

  it('pushBackup rotates to the most-recent 10 entries', async () => {
    seedDb('rotate');
    let now = 10_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now++);
    try {
      for (let i = 0; i < 12; i++) await pushBackup();
    } finally {
      spy.mockRestore();
    }
    const list = await listBackups();
    expect(list.length).toBe(10);
    // 新 → 旧排序;迁移来的 1000/2000 和最旧的两份新 push 都被轮换掉
    // (ts 不逐一断言:fake-indexeddb 内部也会调 Date.now,mock 值被跳号消耗)
    const tss = list.map(e => e.ts);
    expect([...tss].sort((a, b) => b - a)).toEqual(tss);
    expect(tss.every(t => t >= 10_000)).toBe(true);
  });

  it('restoreBackup round-trips the snapshot', async () => {
    const snapshot = seedDb('precious');
    const spy = vi.spyOn(Date, 'now').mockReturnValue(20_000);
    try {
      await pushBackup();
    } finally {
      spy.mockRestore();
    }
    seedDb('overwritten'); // 模拟之后数据被改坏
    expect(g.localStorage!.getItem(DB_KEY)).not.toBe(snapshot);

    const ok = await restoreBackup('20000');
    expect(ok).toBe(true);
    expect(JSON.parse(g.localStorage!.getItem(DB_KEY) as string).sessions[0].name).toBe('precious');
  });

  it('restoreBackup returns false for unknown keys', async () => {
    expect(await restoreBackup('99999999')).toBe(false);
    expect(await restoreBackup('cuberoot-timer.backup.v1.404')).toBe(false);
  });
});
