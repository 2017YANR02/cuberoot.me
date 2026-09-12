import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findUserByWcaId: vi.fn(), getUserById: vi.fn() }));
vi.mock('../src/utils/account.js', () => ({ ...mocks, ownerKey: (uid: number, wcaId?: string) => wcaId || 'u' + uid }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only', isRolePreviewActive: vi.fn() }));
import { authenticateUser } from '../src/utils/recon_helpers.js';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ me: { wca_id: '2017TEST01', name: 'Verified' } })));
});
afterEach(() => vi.unstubAllGlobals());
describe('legacy raw WCA credential cannot bypass first-account choice', () => {
  it('refuses a provider-verified token whose subject has no CubeRoot account', async () => {
    mocks.findUserByWcaId.mockResolvedValue(null);
    expect(await authenticateUser('Bearer unknown-provider-token')).toBeNull();
    expect(mocks.findUserByWcaId).toHaveBeenCalledWith('2017TEST01');
  });
  it('preserves raw-token compatibility for an already linked account with its canonical uid', async () => {
    mocks.findUserByWcaId.mockResolvedValue({ id: 42, wca_id: '2017TEST01' });
    expect(await authenticateUser('Bearer existing-provider-token')).toMatchObject({ uid: 42, realWcaId: '2017TEST01' });
  });
});
