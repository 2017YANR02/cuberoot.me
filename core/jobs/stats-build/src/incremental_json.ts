import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface JsonReply {
  status?: number;
  etag?: string;
  lastModified?: string;
  body: unknown;
}
interface Snapshot extends JsonReply {
  version: 1;
  checkedAt: number;
  downloadedAt: number;
}

/** Persist body and validators together. A 304 is usable only with a valid body. */
export class IncrementalJson {
  readonly counts = { downloaded: 0, notModified: 0, reused: 0, deferred: 0, failed: 0 };
  private coldReads = 0;
  private reconciliations = 0;
  constructor(
    private directory: string,
    private request: (url: string, headers: Record<string, string>) => Promise<JsonReply>,
    private coldLimit = 100,
    private now: () => number = Date.now,
  ) {}

  async get<T>(url: string, valid: (body: unknown) => body is T, options: {
    minAgeMs?: number; forceAfterMs?: number; changed?: boolean;
  } = {}): Promise<T | undefined> {
    const path = join(this.directory, createHash('sha256').update(url).digest('hex') + '.json');
    let old: Snapshot | undefined;
    if (existsSync(path)) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
        if (parsed.version === 1 && Number.isFinite(parsed.checkedAt)
          && Number.isFinite(parsed.downloadedAt) && valid(parsed.body)) old = parsed;
      } catch { /* Corrupt/obsolete cache is a bounded cold read, never a 304 candidate. */ }
    }
    if (old && !options.changed && this.now() - old.checkedAt < (options.minAgeMs ?? 0)) {
      this.counts.reused += 1;
      return old.body as T;
    }
    // A lost Actions cache must not trigger hundreds of full WCIF downloads at once.
    if (!old && this.coldReads >= this.coldLimit) {
      this.counts.deferred += 1;
      return undefined;
    }
    if (!old) this.coldReads += 1;
    const force = old && this.now() - old.downloadedAt >= (options.forceAfterMs ?? Infinity);
    // Spread unconditional reconciliation over runs, even after a mass cache restore.
    if (old && force && this.reconciliations >= this.coldLimit) {
      this.counts.deferred += 1;
      return old.body as T;
    }
    if (force) this.reconciliations += 1;
    const headers: Record<string, string> = {};
    if (old && !force) {
      if (old.etag) headers['If-None-Match'] = old.etag;
      else if (old.lastModified) headers['If-Modified-Since'] = old.lastModified;
    }
    try {
      const reply = await this.request(url, headers);
      let next: Snapshot;
      if (reply.status === 304 && old && Object.keys(headers).length) {
        next = { ...old, checkedAt: this.now() };
        this.counts.notModified += 1;
      } else if (reply.status === 200 && valid(reply.body)) {
        next = { ...reply, version: 1, checkedAt: this.now(), downloadedAt: this.now() };
        this.counts.downloaded += 1;
      } else throw new Error(`HTTP ${reply.status ?? 'failure'} or invalid response`);
      mkdirSync(this.directory, { recursive: true });
      writeFileSync(path + '.tmp', JSON.stringify(next));
      renameSync(path + '.tmp', path);
      return next.body as T;
    } catch (error) {
      this.counts.failed += 1;
      console.warn(`[SYNC] ${url}: ${(error as Error).message}; keeping saved data`);
      return old?.body as T | undefined;
    }
  }
}
