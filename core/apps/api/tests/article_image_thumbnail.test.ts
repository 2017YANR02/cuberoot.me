import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), thumbnail: vi.fn(), eligible: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/image_thumbnail.js', () => ({ imageThumbnail: mocks.thumbnail, canThumbnailWebp: mocks.eligible, THUMBNAIL_WIDTHS: new Set([512, 1024]) }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn(), requireAdmin: vi.fn(), authenticateUser: vi.fn(), checkRateLimit: vi.fn() }));
import { articleRoutes } from '../src/routes/article.js';
const original = Buffer.from('original'), thumb = Buffer.from('thumb');
beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([{ data: original, mime: 'image/webp' }]); mocks.eligible.mockReturnValue(true); });
describe('article image delivery remains safe during thumbnail rollout', () => {
  it('retains the original endpoint and caches successful fixed variants separately', async () => {
    const raw = await articleRoutes.request('/article/img/169');
    expect(Buffer.from(await raw.arrayBuffer())).toEqual(original);
    expect(raw.headers.get('cache-control')).toContain('immutable');
    expect(mocks.thumbnail).not.toHaveBeenCalled();
    mocks.thumbnail.mockResolvedValue(thumb);
    const resized = await articleRoutes.request('/article/img/169/thumb/512?v=1');
    expect(Buffer.from(await resized.arrayBuffer())).toEqual(thumb);
    expect(resized.headers.get('content-type')).toBe('image/webp');
    expect(resized.headers.get('cache-control')).toContain('immutable');
  });
  it('never caches temporary conversion failure, but keeps original caching for ineligible images', async () => {
    mocks.thumbnail.mockResolvedValue(null);
    const fallback = await articleRoutes.request('/article/img/169/thumb/512?v=1');
    expect(Buffer.from(await fallback.arrayBuffer())).toEqual(original);
    expect(fallback.headers.get('cache-control')).toBe('no-store');
    mocks.eligible.mockReturnValue(false);
    const preserved = await articleRoutes.request('/article/img/169/thumb/512?v=1');
    expect(Buffer.from(await preserved.arrayBuffer())).toEqual(original);
    expect(preserved.headers.get('cache-control')).toContain('immutable');
    expect(mocks.thumbnail).toHaveBeenCalledTimes(1);
  });
  it('validates existence before cache lookup and never caches unsupported variants', async () => {
    mocks.query.mockResolvedValueOnce([]);
    expect((await articleRoutes.request('/article/img/169/thumb/512?v=1')).status).toBe(404);
    for (const path of ['/article/img/169/thumb/999999?v=1', '/article/img/169/thumb/512?v=2', '/article/img/169/thumb/512']) {
      const response = await articleRoutes.request(path);
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(mocks.thumbnail).not.toHaveBeenCalled();
  });
});
