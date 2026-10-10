import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { IncrementalJson, type JsonReply } from '../src/incremental_json';

const valid = (body: unknown): body is string[] => Array.isArray(body) && body.every(v => typeof v === 'string');
const directory = () => mkdtempSync(join(tmpdir(), 'upcoming-http-'));
const reply = (body: unknown): JsonReply => ({ status: 200, etag: '"v1"', body });

describe('incremental response snapshots', () => {
  it('persists body with validators across runs and retains it on 304 or failure', async () => {
    const dir = directory();
    let time = 100;
    await new IncrementalJson(dir, async () => reply(['A']), 1, () => time).get('wcif/A', valid);
    const request = vi.fn(async (): Promise<JsonReply> => ({ status: 304, body: undefined }));
    const sync = new IncrementalJson(dir, request, 1, () => ++time);
    expect(await sync.get('wcif/A', valid)).toEqual(['A']);
    expect(request.mock.calls[0]).toEqual(['wcif/A', { 'If-None-Match': '"v1"' }]);
    request.mockResolvedValue({ status: 429, body: {} });
    expect(await sync.get('wcif/A', valid)).toEqual(['A']);
    request.mockResolvedValue(reply({ broken: true }));
    expect(await sync.get('wcif/A', valid)).toEqual(['A']);
    expect(JSON.parse(readFileSync(join(dir, readdirSync(dir)[0]!), 'utf8')).body).toEqual(['A']);
    expect(sync.counts).toEqual({ downloaded: 0, notModified: 1, reused: 0, deferred: 0, failed: 2 });
  });

  it('does not treat equal roster counts as equal contents; index changes bypass the reuse interval', async () => {
    const dir = directory();
    await new IncrementalJson(dir, async () => reply(['A']), 1, () => 100).get('wcif/A', valid);
    const request = vi.fn(async () => reply(['B']));
    const sync = new IncrementalJson(dir, request, 1, () => 101);
    expect(await sync.get('wcif/A', valid, { minAgeMs: 1000 })).toEqual(['A']);
    expect(request).not.toHaveBeenCalled();
    expect(await sync.get('wcif/A', valid, { minAgeMs: 1000, changed: true })).toEqual(['B']);
  });

  it('bounds cold recovery, treats corrupt caches as cold, and rejects 304 without a body', async () => {
    const dir = directory();
    await new IncrementalJson(dir, async () => reply(['A'])).get('wcif/A', valid);
    writeFileSync(join(dir, readdirSync(dir)[0]!), 'broken');
    const request = vi.fn(async (): Promise<JsonReply> => ({ status: 304, body: undefined }));
    const sync = new IncrementalJson(dir, request, 1);
    expect(await sync.get('wcif/A', valid)).toBeUndefined();
    expect(request.mock.calls[0]).toEqual(['wcif/A', {}]);
    expect(await sync.get('wcif/B', valid)).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sync.counts.failed).toBe(1);
    expect(sync.counts.deferred).toBe(1);
  });

  it('forces bounded rolling reconciliation even when validators never change', async () => {
    const dir = directory();
    const seed = new IncrementalJson(dir, async () => reply(['old']), 2, () => 0);
    await seed.get('wcif/A', valid); await seed.get('wcif/B', valid);
    const request = vi.fn(async () => reply(['new']));
    const sync = new IncrementalJson(dir, request, 1, () => 10);
    expect(await sync.get('wcif/A', valid, { forceAfterMs: 5 })).toEqual(['new']);
    expect(request.mock.calls[0]).toEqual(['wcif/A', {}]);
    expect(await sync.get('wcif/B', valid, { forceAfterMs: 5 })).toEqual(['old']);
    expect(request).toHaveBeenCalledTimes(1);
    const next = new IncrementalJson(dir, request, 1, () => 11);
    expect(await next.get('wcif/B', valid, { forceAfterMs: 5 })).toEqual(['new']);
  });
});
