import { describe, expect, it } from 'vitest';

import { LatestSnapshotGate } from './latest-snapshot-gate';

interface Snapshot {
  manualScrambles: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('latest snapshot gate', () => {
  it('does not let an older full snapshot overwrite a newer optimistic value', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const first = deferred<Snapshot>();
    const second = deferred<Snapshot>();
    let rendered: Snapshot = { manualScrambles: 'initial' };
    const apply = (snapshot: Snapshot) => { rendered = snapshot; };

    const firstRevision = gate.beginMutation();
    const firstCallback = first.promise.then((snapshot) => (
      gate.commitIfLatest(firstRevision, snapshot, apply)
    ));

    rendered = { manualScrambles: 'NEW MANUAL QUEUE' };
    const secondRevision = gate.beginMutation();
    const secondCallback = second.promise.then((snapshot) => (
      gate.commitIfLatest(secondRevision, snapshot, apply)
    ));

    first.resolve({ manualScrambles: 'stale full snapshot' });
    await expect(firstCallback).resolves.toBe(false);
    expect(rendered.manualScrambles).toBe('NEW MANUAL QUEUE');

    second.resolve({ manualScrambles: 'NEW MANUAL QUEUE' });
    await expect(secondCallback).resolves.toBe(true);
    expect(rendered.manualScrambles).toBe('NEW MANUAL QUEUE');
  });

  it('rejects an older success callback that arrives after the latest success', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const older = deferred<Snapshot>();
    const latest = deferred<Snapshot>();
    let rendered: Snapshot = { manualScrambles: 'initial' };
    const apply = (snapshot: Snapshot) => { rendered = snapshot; };

    const olderRevision = gate.beginMutation();
    const olderCallback = older.promise.then((snapshot) => (
      gate.commitIfLatest(olderRevision, snapshot, apply)
    ));
    const latestRevision = gate.beginMutation();
    const latestCallback = latest.promise.then((snapshot) => (
      gate.commitIfLatest(latestRevision, snapshot, apply)
    ));

    latest.resolve({ manualScrambles: 'latest' });
    await expect(latestCallback).resolves.toBe(true);
    older.resolve({ manualScrambles: 'older callback arrived last' });
    await expect(olderCallback).resolves.toBe(false);
    expect(rendered.manualScrambles).toBe('latest');
  });

  it('ignores an older failure instead of reloading over a newer mutation', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const olderRevision = gate.beginMutation();
    gate.beginMutation();
    let reloads = 0;

    await expect(gate.reloadIfLatest(
      olderRevision,
      async () => {
        reloads += 1;
        return { manualScrambles: 'disk' };
      },
      () => undefined,
    )).resolves.toBe(false);
    expect(reloads).toBe(0);
  });

  it('reloads the canonical snapshot after the latest mutation fails', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const revision = gate.beginMutation();
    let rendered: Snapshot = { manualScrambles: 'optimistic' };

    await expect(gate.reloadIfLatest(
      revision,
      async () => ({ manualScrambles: 'canonical disk value' }),
      (snapshot) => { rendered = snapshot; },
    )).resolves.toBe(true);
    expect(rendered.manualScrambles).toBe('canonical disk value');
  });

  it('drops a reload result when a newer mutation starts while reload is pending', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const reload = deferred<Snapshot>();
    const failedRevision = gate.beginMutation();
    let rendered: Snapshot = { manualScrambles: 'optimistic first' };

    const recovery = gate.reloadIfLatest(
      failedRevision,
      () => reload.promise,
      (snapshot) => { rendered = snapshot; },
    );

    gate.beginMutation();
    rendered = { manualScrambles: 'optimistic second' };
    reload.resolve({ manualScrambles: 'stale reload' });

    await expect(recovery).resolves.toBe(false);
    expect(rendered.manualScrambles).toBe('optimistic second');
  });

  it('propagates a latest reload failure without applying a fabricated snapshot', async () => {
    const gate = new LatestSnapshotGate<Snapshot>();
    const revision = gate.beginMutation();
    let applied = false;

    await expect(gate.reloadIfLatest(
      revision,
      async () => { throw new Error('read failed'); },
      () => { applied = true; },
    )).rejects.toThrow('read failed');
    expect(applied).toBe(false);
  });
});
