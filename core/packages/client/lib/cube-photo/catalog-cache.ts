import type { AlgFile } from '@cuberoot/shared/alg';
import type { PhotoAlgSet } from '@cuberoot/shared/cube-photo/lookup';

/** Short-lived page cache. Expiry uses the normal ETag-revalidating loader. */
export class PhotoCatalogCache<Set extends string = PhotoAlgSet> {
  private entries = new Map<Set, { promise: Promise<AlgFile>; expires: number }>();
  constructor(private fetch: (set: Set, fresh: boolean) => Promise<AlgFile>, private now = Date.now) {}

  load(set: Set, fresh = false): Promise<AlgFile> {
    const existing = this.entries.get(set);
    if (!fresh && existing && existing.expires > this.now()) return existing.promise;
    const entry: { promise: Promise<AlgFile>; expires: number } = {
      expires: Infinity,
      promise: Promise.resolve().then(() => this.fetch(set, fresh)).then(file => {
        entry.expires = this.now() + 30000;
        return file;
      }, error => {
        if (this.entries.get(set) === entry) this.entries.delete(set);
        throw error;
      }),
    };
    this.entries.set(set, entry);
    return entry.promise;
  }
}
