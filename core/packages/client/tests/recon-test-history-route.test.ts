import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ role: vi.fn(), runs: vi.fn(), cases: vi.fn(), root: vi.fn(), spawn: vi.fn() }));
vi.mock('@/lib/page-admin-session', () => ({ verifyPageRole: mocks.role }));
vi.mock('@/lib/recon-test-history.server', () => ({ readTestRuns: mocks.runs, readRegressionCases: mocks.cases, findCheckoutRoot: mocks.root }));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawn }));
vi.mock('node:fs', async original => ({ ...await original<typeof import('node:fs')>(), readdirSync: () => [] }));
import { GET } from '@/app/api/admin/recon-tests/route';
beforeEach(() => { vi.clearAllMocks(); mocks.role.mockResolvedValue('admin'); mocks.root.mockReturnValue('/checkout'); mocks.runs.mockReturnValue([]); mocks.cases.mockReturnValue([]); mocks.spawn.mockReturnValue({ status: 0, stdout: 'abc\n' }); vi.stubEnv('NODE_ENV', 'development'); });
afterEach(() => vi.unstubAllEnvs());
const request = (token = 'admin') => new Request('http://localhost/api/admin/recon-tests', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
it('rejects unsigned and ordinary users without reading files', async () => {
  expect((await GET(request(''))).status).toBe(401);
  mocks.role.mockResolvedValue('user'); expect((await GET(request())).status).toBe(403);
  expect(mocks.runs).not.toHaveBeenCalled();
});
it('never exposes checkout files in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const response = await GET(request()); expect(await response.json()).toEqual({ runs: [], cases: [], scope: 'cloud' });
  expect(mocks.root).not.toHaveBeenCalled(); expect(mocks.runs).not.toHaveBeenCalled();
});
it('returns administrator local history uncached and distinguishes unavailable verification', async () => {
  const response = await GET(request()); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ runs: [], cases: [], scope: 'local', hasMore: false, currentFingerprint: 'abc' });
  mocks.role.mockRejectedValue(new Error('offline')); expect((await GET(request())).status).toBe(503);
});
