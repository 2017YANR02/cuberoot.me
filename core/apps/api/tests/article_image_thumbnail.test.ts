import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), thumbnail: vi.fn(), eligible: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/image_thumbnail.js', () => ({ imageThumbnail: mocks.thumbnail, canThumbnailWebp: mocks.eligible, THUMBNAIL_WIDTHS: new Set([512, 1024]) }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: vi.fn(), requireAdmin: vi.fn(), authenticateUser: vi.fn(), checkRateLimit: vi.fn() }));
import { articleRoutes } from '../src/routes/article.js';
import { authenticateUser } from '../src/utils/recon_helpers.js';
const original = Buffer.from('original'), thumb = Buffer.from('thumb');
beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([{ data: original, mime: 'image/webp' }]); mocks.eligible.mockReturnValue(true); });
describe('article image delivery remains safe during thumbnail rollout', () => {
  it('checks gallery access before thumbnail lookup and never caches private or published gallery bytes', async () => {
    mocks.query.mockResolvedValue([{ data: original, mime: 'image/webp', owner_wca_id: '2000TEST01', gallery_status: 'private', gallery_public: false, gallery_attached: true }]);
    vi.mocked(authenticateUser).mockResolvedValue(null);
    const denied = await articleRoutes.request('/article/img/169/thumb/512?v=1');
    expect(denied.status).toBe(404);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    expect(mocks.thumbnail).not.toHaveBeenCalled();
    vi.mocked(authenticateUser).mockResolvedValue({ wcaId: '2000TEST01', name: 'Owner', isAdmin: false });
    expect((await articleRoutes.request('/article/img/169')).headers.get('cache-control')).toBe('no-store');
    mocks.query.mockResolvedValue([{ data: original, mime: 'image/webp', gallery_status: 'public', gallery_public: true }]);
    mocks.thumbnail.mockResolvedValue(thumb);
    const published = await articleRoutes.request('/article/img/169/thumb/512?v=1');
    expect(published.status).toBe(200);
    expect(published.headers.get('cache-control')).toBe('no-store');
  });
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
