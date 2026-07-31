import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// 自动备份的触发计数器必须活过刷新。
//
// 回归的是一次真实的数据丢失:计数器原本是模块级 `let`,刷新即归零,于是「每
// 10 次写入备份一次」实际成了「一次页面会话里连续存够 10 次才备份」。开发时刷
// 新频繁,阈值几乎永远到不了,两个月只写下过一条备份。
//
// 「刷新」用 `vi.resetModules()` + 重新 import 模拟 —— 模块状态清空,而(假的)
// localStorage 原样保留,和真刷新一致。

function makeLocalStorage() {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) { map.set(k, v); },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
  };
}

const g = globalThis as unknown as {
  window?: unknown;
  localStorage?: ReturnType<typeof makeLocalStorage>;
};
g.window = { addEventListener() {} };
g.localStorage = makeLocalStorage();

const DB_KEY = 'cuberoot-timer.v3';
const SETTINGS_KEY = 'cuberoot-timer.settings.v1';
const COUNTER_KEY = 'cuberoot-timer.saveCounter';

type Db = typeof import('@/app/[lang]/timer/_lib/storage/db');

/** 重新加载 db 模块 = 模拟一次刷新。 */
async function reload(): Promise<Db> {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/storage/db');
}

function seedDb(): void {
  g.localStorage!.setItem(DB_KEY, JSON.stringify({
    version: 3,
    sessions: [{ id: 's1', name: 'Default', createdTs: 1 }],
    activeSessionId: 's1',
    dataBySession: { s1: {} },
  }));
}

function setAutoBackupEvery(n: number): void {
  g.localStorage!.setItem(SETTINGS_KEY, JSON.stringify({ autoBackupEvery: n }));
}

/** 备份是 fire-and-forget,让它的 promise 链跑完。 */
const settle = () => new Promise(r => setTimeout(r, 0));

// 备份落在 fake IDB 里,跨测试累积(连接被模块缓存,清库会挂起 —— 同
// timer-backup-idb.test.ts 的注释)。所以一律断言**增量**,不是总数。
let baseline = 0;
async function written(db: Db): Promise<number> {
  const n = (await db.listBackups()).length;
  const delta = n - baseline;
  baseline = n;
  return delta;
}

describe('auto-backup save counter', () => {
  beforeEach(async () => {
    g.localStorage!.clear();
    seedDb();
    setAutoBackupEvery(10);
    baseline = (await (await reload()).listBackups()).length;
  });

  it('survives a reload: 9 saves + refresh + 1 save writes a backup', async () => {
    let db = await reload();
    for (let i = 0; i < 9; i++) db.saveAll({});
    await settle();
    expect(await written(db)).toBe(0);

    db = await reload(); // 刷新
    db.saveAll({});      // 第 10 次写入
    await settle();

    expect(await written(db)).toBe(1);
    expect(g.localStorage!.getItem(COUNTER_KEY)).toBe('10');
  });

  it('counts every save, not every save since the last reload', async () => {
    let db!: Db;
    for (let i = 0; i < 25; i++) {
      db = await reload(); // 每存一次就刷新一次:旧实现在这里永远备份不了
      db.saveAll({});
      await settle();
    }
    expect(await written(db)).toBe(2); // 第 10 次和第 20 次
    expect(g.localStorage!.getItem(COUNTER_KEY)).toBe('25');
  });

  it('writes no backup when the setting is 0, but still counts', async () => {
    setAutoBackupEvery(0);
    const db = await reload();
    for (let i = 0; i < 12; i++) db.saveAll({});
    await settle();
    expect(await written(db)).toBe(0);
    expect(g.localStorage!.getItem(COUNTER_KEY)).toBe('12');
  });

  it('does not back up on every save when the counter is unreadable', async () => {
    const db = await reload();
    const real = g.localStorage!.getItem;
    g.localStorage!.getItem = function (k: string) {
      if (k === COUNTER_KEY) throw new Error('storage unavailable');
      return real.call(this, k);
    };
    try {
      for (let i = 0; i < 12; i++) db.saveAll({});
      await settle();
    } finally {
      g.localStorage!.getItem = real;
    }
    expect(await written(db)).toBe(0);
  });
});
