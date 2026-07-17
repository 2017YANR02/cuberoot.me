/**
 * IndexedDB-backed timer auto-backups.
 *
 * 备份是整库 JSON 快照(最多保留 10 份),放 localStorage 会把 ~5MB 配额吃到
 * 只剩一口气,全站其它裸 setItem 跟着抛 QuotaExceededError(见 lib/safe-storage.ts
 * 的事故记录)。迁到 IndexedDB(配额=磁盘百分比,数百 MB 起)后 localStorage
 * 回到常年空旷。
 *
 * 首次任何备份操作前,把存量 localStorage `cuberoot-timer.backup.v1.*` 搬进来
 * (IDB 写成功后才删旧 key,搬一半失败不丢数据)。IndexedDB 不可用(隐私模式
 * 等)时这里 reject,由 db.ts 退回老的 localStorage 路径。
 *
 * 事务规则:每一步 await 之间都开新 transaction —— IDB 事务在回到事件循环后
 * 自动提交,跨 await 复用同一事务在真浏览器里会 TransactionInactiveError。
 */

export const BACKUP_LS_PREFIX = 'cuberoot-timer.backup.v1.';

const DB_NAME = 'cuberoot-timer-backups';
const STORE = 'backups'; // out-of-line key = ts(number),value = 整库 JSON 字符串

export interface IdbBackupEntry { ts: number; size: number; }

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
  dbPromise = p;
  p.catch(() => { dbPromise = null; }); // 失败不缓存,下次调用重试
  return p;
}

function reqp<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb request failed'));
  });
}

function backups(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

let migration: Promise<void> | null = null;

/** 一次性把 localStorage 里的存量备份搬进 IDB,成功写入后才删旧 key。 */
function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  if (migration) return migration;
  const p = (async () => {
    const found: Array<{ key: string; ts: number; json: string }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(BACKUP_LS_PREFIX)) continue;
        const ts = Number(k.slice(BACKUP_LS_PREFIX.length));
        const json = localStorage.getItem(k);
        if (Number.isFinite(ts) && json) found.push({ key: k, ts, json });
      }
    } catch { return; } // localStorage 不可用 → 没得迁
    if (found.length === 0) return;
    const st = backups(db, 'readwrite');
    await Promise.all(found.map(e => reqp(st.put(e.json, e.ts)))); // 同一事务内同步排队,安全
    for (const e of found) {
      try { localStorage.removeItem(e.key); } catch { /* ignore */ }
    }
  })();
  migration = p;
  p.catch(() => { migration = null; });
  return p;
}

/** 写入一份备份并轮换到最新 keep 份。 */
export async function idbBackupPut(ts: number, json: string, keep: number): Promise<void> {
  const db = await openDb();
  await migrateFromLocalStorage(db);
  await reqp(backups(db, 'readwrite').put(json, ts));
  const keys = await reqp(backups(db, 'readonly').getAllKeys()); // 升序 → 头部最旧
  const stale = keys.slice(0, Math.max(0, keys.length - keep));
  if (stale.length > 0) {
    const st = backups(db, 'readwrite');
    await Promise.all(stale.map(k => reqp(st.delete(k))));
  }
}

/** 全部备份,新 → 旧。 */
export async function idbBackupList(): Promise<IdbBackupEntry[]> {
  const db = await openDb();
  await migrateFromLocalStorage(db);
  const st = backups(db, 'readonly');
  const keysReq = reqp(st.getAllKeys());
  const valsReq = reqp(st.getAll());
  const [keys, vals] = await Promise.all([keysReq, valsReq]); // 两者都按 key 升序对齐
  return keys
    .map((k, i) => ({ ts: Number(k), size: typeof vals[i] === 'string' ? (vals[i] as string).length : 0 }))
    .sort((a, b) => b.ts - a.ts);
}

export async function idbBackupGet(ts: number): Promise<string | null> {
  const db = await openDb();
  await migrateFromLocalStorage(db);
  const v: unknown = await reqp(backups(db, 'readonly').get(ts));
  return typeof v === 'string' ? v : null;
}
