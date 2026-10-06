/** Own even tracks whose permission prompt completes after the room has gone away. */
export function createVideoMediaSession<T extends { stop(): void }>(adapter: {
  acquire(kind: 'camera' | 'microphone'): Promise<T>;
  publish(track: T): Promise<unknown>;
  unpublish(track: T): Promise<unknown>;
  error(): void;
  busy(kind: 'camera' | 'microphone', value: boolean): void;
}) {
  type Kind = 'camera' | 'microphone';
  const tracks = new Map<Kind, T>();
  const revisions = { camera: 0, microphone: 0 };
  let disposed = false;
  const release = (track: T) => { track.stop(); void adapter.unpublish(track).catch(() => undefined); };
  return {
    async enable(kind: Kind, enabled: boolean) {
      if (disposed) return;
      const revision = ++revisions[kind];
      const previous = tracks.get(kind);
      if (previous) { tracks.delete(kind); release(previous); }
      if (!enabled) { adapter.busy(kind, false); return; }
      adapter.busy(kind, true);
      let track: T | undefined;
      try {
        track = await adapter.acquire(kind);
        if (disposed || revisions[kind] !== revision) { track.stop(); return; }
        tracks.set(kind, track);
        await adapter.publish(track);
        if (disposed || revisions[kind] !== revision) release(track);
      } catch {
        if (track) { release(track); if (tracks.get(kind) === track) tracks.delete(kind); }
        if (!disposed && revisions[kind] === revision) adapter.error();
      } finally {
        if (!disposed && revisions[kind] === revision) adapter.busy(kind, false);
      }
    },
    dispose() {
      disposed = true;
      for (const track of tracks.values()) release(track);
      tracks.clear();
    },
  };
}
