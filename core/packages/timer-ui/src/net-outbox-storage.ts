import { decodeNetOutboxEntry, type NetOutboxEntry, type NetOutboxStorage } from '@cuberoot/shared/timer';

/** Shared DOM host adapter. Per-entry transactions and Web Locks prevent tab-wide array clobbering. */
export function createNetOutboxStorage(): NetOutboxStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cuberoot-net-outbox-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('attempts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Pending result storage is blocked'));
  });
  const transaction = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, value: (result: T) => void) => void): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction('attempts', mode); let result: T;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Pending result storage failed'));
        operation(tx.objectStore('attempts'), value => { result = value; });
      });
    } finally { db.close(); }
  };
  return {
    load: () => transaction('readonly', (store, value) => { const read = store.getAll(); read.onsuccess = () => value(read.result); }),
    put: entry => transaction<NetOutboxEntry>('readwrite', (store, value) => {
      const read = store.get(entry.record.solve.id);
      read.onsuccess = () => {
        const previous = read.result === undefined ? undefined : decodeNetOutboxEntry(read.result);
        if (previous === null) { store.transaction.abort(); return; }
        const next = previous ? { ...entry, record: { ...previous.record,
          solve: { ...previous.record.solve, penalty: entry.record.solve.penalty } } } : entry;
        store.put(next, entry.record.solve.id); value(next);
      };
    }),
    update: entry => transaction<void>('readwrite', store => {
      const read = store.get(entry.record.solve.id);
      read.onsuccess = () => { if ((read.result as NetOutboxEntry | undefined)?.revision === entry.revision) store.put(entry, entry.record.solve.id); };
    }),
    remove: (id, revision) => transaction<void>('readwrite', store => {
      const read = store.get(id);
      read.onsuccess = () => { if ((read.result as NetOutboxEntry | undefined)?.revision === revision) store.delete(id); };
    }),
    exclusive: async work => {
      if (!navigator.locks) throw new Error('Exclusive pending-result recovery is unavailable');
      return await navigator.locks.request('cuberoot-net-outbox-v1', work);
    },
  };
}
