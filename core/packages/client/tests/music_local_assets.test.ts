import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GET, HEAD } from '@/app/music/library/[...slug]/route';

const scratch = path.resolve(process.cwd(), '../../../.tmp/png');
mkdirSync(scratch, { recursive: true });
const root = mkdtempSync(path.join(scratch, 'music-assets-'));
const audio = `tracks/${'a'.repeat(64)}.mp3`;
const context = (relative: string) => ({ params: Promise.resolve({ slug: relative.split('/') }) });
const request = (range?: string) => new Request('http://localhost/music/library/file', {
  headers: range ? { Range: range } : {},
});

beforeAll(() => {
  mkdirSync(path.join(root, 'tracks'));
  writeFileSync(path.join(root, audio), '0123456789');
  writeFileSync(path.join(root, 'manifest.v1.json'), '{"version":1}');
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('local music assets', () => {
  it('is disabled in production and only serves generated paths in development', async () => {
    vi.stubEnv('MUSIC_LIBRARY_ROOT', root);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await GET(request(), context('manifest.v1.json'))).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'development');
    const manifest = await GET(request(), context('manifest.v1.json'));
    expect(await manifest.json()).toEqual({ version: 1 });
    expect(manifest.headers.get('cache-control')).toBe('no-store');
    for (const relative of ['../inventory/source-manifest.jsonl', 'tracks/raw.mp3', `lyrics/${'b'.repeat(64)}.lrc`]) {
      expect((await GET(request(), context(relative))).status).toBe(404);
    }
  });

  it('supports full audio, HEAD, closed, open and suffix ranges', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MUSIC_LIBRARY_ROOT', root);
    expect(await (await GET(request(), context(audio))).text()).toBe('0123456789');
    const head = await HEAD(new Request('http://localhost/file', { method: 'HEAD' }), context(audio));
    expect(head.headers.get('content-length')).toBe('10');
    expect(await head.text()).toBe('');
    for (const [range, body, contentRange] of [
      ['bytes=0-1', '01', 'bytes 0-1/10'], ['bytes=8-', '89', 'bytes 8-9/10'],
      ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10'],
    ]) {
      const response = await GET(request(range), context(audio));
      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe(contentRange);
      expect(await response.text()).toBe(body);
    }
    for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5', 'invalid']) {
      const response = await GET(request(range), context(audio));
      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe('bytes */10');
    }
  });
});
