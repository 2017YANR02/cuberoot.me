export interface SnapshotRevision {
  readonly sequence: number;
}

/**
 * Coordinates asynchronous full-snapshot callbacks without knowing the
 * repository, snapshot schema, or UI runtime.
 *
 * Allocate the revision before applying an optimistic UI change. A successful
 * mutation may commit its returned snapshot only while its revision is still
 * latest. After a latest mutation fails, reloadIfLatest restores the canonical
 * persisted snapshot; both the reload request and its result are guarded so a
 * mutation started during recovery cannot be overwritten.
 */
export class LatestSnapshotGate<TSnapshot> {
  private sequence = 0;
  private latestRevision: SnapshotRevision | null = null;

  beginMutation(): SnapshotRevision {
    const revision = Object.freeze({ sequence: ++this.sequence });
    this.latestRevision = revision;
    return revision;
  }

  commitIfLatest(
    revision: SnapshotRevision,
    snapshot: TSnapshot,
    apply: (snapshot: TSnapshot) => void,
  ): boolean {
    if (this.latestRevision !== revision) return false;
    apply(snapshot);
    return true;
  }

  async reloadIfLatest(
    revision: SnapshotRevision,
    reload: () => Promise<TSnapshot>,
    apply: (snapshot: TSnapshot) => void,
  ): Promise<boolean> {
    if (this.latestRevision !== revision) return false;
    const snapshot = await reload();
    return this.commitIfLatest(revision, snapshot, apply);
  }
}
