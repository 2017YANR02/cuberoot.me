import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn(), membership: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/membership.js', () => ({ hasActiveMembership: mocks.membership }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: async () => 1 }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: { req: { header: (key: string) => string | undefined } }) => {
    const role = c.req.header('Authorization');
    if (!role) throw new Error('Authentication required');
    return { wcaId: role, isAdmin: role === 'admin' };
  },
  optionalAuth: vi.fn(), requireAdmin: vi.fn(), checkRateLimit: vi.fn(),
}));

const root = mkdtempSync(path.join(tmpdir(), 'music-download-'));
vi.stubEnv('MUSIC_LIBRARY_ROOT', root);
vi.stubEnv('MUSIC_STORAGE_DIR', root);
const { musicRoutes } = await import('../src/routes/music.js');
const app = new Hono();
app.onError((error, c) => c.json({ error: error.message },
  error.message.includes('Authentication required') ? 401
    : error.message.includes('membership required') ? 403
      : error.message.includes('Validation') ? 400 : 500));
app.route('/v1', musicRoutes);

const id = 'a'.repeat(64);
const assetHash = 'b'.repeat(64);
const uploadedId = '11111111-1111-1111-1111-111111111111';
const bytes = '0123456789';
mkdirSync(path.join(root, 'tracks'));
mkdirSync(path.join(root, 'audio'));
for (const ext of ['mp3', 'm4a', 'flac', 'wav']) writeFileSync(path.join(root, `tracks/${assetHash}.${ext}`), bytes);
writeFileSync(path.join(root, `audio/${uploadedId}.mp3`), bytes);
const writeManifest = (src = `/music/library/tracks/${assetHash}.mp3`) => writeFileSync(
  path.join(root, 'manifest.v1.json'), JSON.stringify({ version: 1, tracks: [{ id, title: '音乐', src }] }),
);
const download = (collection: string, role?: string, method = 'GET', range?: string, trackId?: string) => app.request(
  `/v1/music/${collection}/${trackId || (collection === 'tracks' ? uploadedId : id)}/download`,
  { method, headers: { ...(role ? { Authorization: role } : {}), ...(range ? { Range: range } : {}) } },
);

beforeEach(() => {
  vi.clearAllMocks();
  writeManifest();
  mocks.membership.mockImplementation(async role => role === 'member');
  mocks.query.mockImplementation(async (sql: string) => sql.includes('FROM music_static_overrides') ? [] : [{
    id: uploadedId, status: 'published', audio_storage_key: `audio/${uploadedId}.mp3`,
    audio_size_bytes: bytes.length, audio_mime: 'audio/mpeg', audio_filename: '上传.mp3',
  }]);
});
afterAll(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

describe.each(['static-tracks', 'tracks'])('%s downloads', collection => {
  it.each(['GET', 'HEAD'])('rejects visitors and inactive members before accessing files (%s)', async method => {
    expect((await download(collection, undefined, method)).status).toBe(401);
    for (const role of ['ordinary', 'expired']) expect((await download(collection, role, method)).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(['member', 'admin'])('streams a complete attachment for %s without shared caching', async role => {
    const response = await download(collection, role);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-length')).toBe('10');
    expect(await response.text()).toBe(bytes);
    if (role === 'admin') expect(mocks.membership).not.toHaveBeenCalled();
  });

  it('supports HEAD, partial downloads and invalid Range responses', async () => {
    const head = await download(collection, 'member', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('10');
    expect(await head.text()).toBe('');
    const partial = await download(collection, 'member', 'GET', 'bytes=2-5');
    expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(partial.headers.get('cache-control')).toContain('no-store');
    expect(await partial.text()).toBe('2345');
    const invalid = await download(collection, 'member', 'HEAD', 'bytes=10-');
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects unavailable tracks even for administrators', async () => {
    mocks.query.mockResolvedValue([{ hidden: true, status: 'pending' }]);
    expect((await download(collection, 'admin')).status).toBe(404);
  });
});

describe('static-library lookup', () => {
  it.each([['mp3', 'audio/mpeg'], ['m4a', 'audio/mp4'], ['flac', 'audio/flac'], ['wav', 'audio/wav']])('resolves the generated %s asset independently of the source track id', async (ext, mime) => {
    writeManifest(`/music/library/tracks/${assetHash}.${ext}`);
    const response = await download('static-tracks', 'member', 'HEAD');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(mime);
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent(`音乐.${ext}`));
  });
  it('uses the administrator title override for the filename', async () => {
    mocks.query.mockResolvedValue([{ hidden: false, title: '新曲名' }]);
    const response = await download('static-tracks', 'member', 'HEAD');
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent('新曲名.mp3'));
  });
  it.each(['../../secret', 'https://example.com/audio.mp3', `/music/library/tracks/${'c'.repeat(64)}.mp3`])('rejects unsafe or missing assets: %s', async src => {
    writeManifest(src);
    expect((await download('static-tracks', 'admin')).status).toBe(404);
  });
  it('rejects ids absent from the manifest and invalid ids', async () => {
    expect((await download('static-tracks', 'admin', 'HEAD', undefined, 'c'.repeat(64))).status).toBe(404);
    expect((await download('static-tracks', 'admin', 'HEAD', undefined, 'invalid')).status).toBe(400);
  });
});
