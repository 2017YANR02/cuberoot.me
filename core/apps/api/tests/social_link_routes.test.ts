import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  vi.stubEnv('WECHAT_LOGIN_APP_ID', 'test-wechat-app');
  vi.stubEnv('WECHAT_LOGIN_APP_SECRET', 'test-wechat-secret');
  return {
    requireAppUserId: vi.fn(),
    exchangeSocialCode: vi.fn(),
    findUserByIdentity: vi.fn(),
    addIdentity: vi.fn(),
    getIdentities: vi.fn(),
  };
});
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: {} }));
vi.mock('../src/utils/account.js', () => ({ ...mocks }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'test-social-state-secret' }));
vi.mock('../src/utils/social_login.js', async (original) => ({
  ...await original<typeof import('../src/utils/social_login.js')>(),
  exchangeSocialCode: mocks.exchangeSocialCode,
}));

import { accountAuthRoutes } from '../src/routes/account_auth.js';
import { signSocialState } from '../src/utils/social_login.js';

const app = new Hono().route('/v1', accountAuthRoutes);
const providerUid = 'verified-wechat-subject';

function authorize(intent: 'login' | 'link') {
  return app.request(`/v1/auth/social/authorize?provider=wechat&intent=${intent}`);
}

async function authorizationState(intent: 'login' | 'link') {
  const response = await authorize(intent);
  expect(response.status).toBe(200);
  const { url } = await response.json();
  const state = new URL(url).searchParams.get('state');
  expect(state).toBeTruthy();
  return state;
}

function complete(intent: 'login' | 'link', state: unknown) {
  const segment = intent === 'link' ? 'link/social' : 'social';
  return app.request(`/v1/auth/${segment}/wechat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'test-code', state }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAppUserId.mockResolvedValue(42);
  mocks.exchangeSocialCode.mockResolvedValue({ sub: providerUid });
  mocks.findUserByIdentity.mockResolvedValue(null);
  mocks.addIdentity.mockResolvedValue('ok');
  mocks.getIdentities.mockResolvedValue([{ provider: 'wechat', providerUid }]);
});

describe('social account binding', () => {
  it('requires a session for binding authorization and keeps sign-in authorization public', async () => {
    mocks.requireAppUserId.mockRejectedValue(new Error('Authentication required'));
    await authorizationState('login');
    expect(mocks.requireAppUserId).not.toHaveBeenCalled();
    const response = await authorize('link');
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('completes binding for the account that authorized it', async () => {
    const response = await complete('link', await authorizationState('link'));
    expect(response.status).toBe(200);
    expect(mocks.addIdentity).toHaveBeenCalledExactlyOnceWith(42, 'wechat', providerUid);
  });

  it('rejects an account change before checking the provider code or saving an identity', async () => {
    const state = await authorizationState('link');
    mocks.requireAppUserId.mockResolvedValue(43);
    expect((await complete('link', state)).status).toBe(400);
    expect(mocks.exchangeSocialCode).not.toHaveBeenCalled();
    expect(mocks.addIdentity).not.toHaveBeenCalled();
  });

  it('rejects mismatched intents and older binding states before checking the provider code', async () => {
    expect((await complete('login', await authorizationState('link'))).status).toBe(400);
    expect((await complete('link', await authorizationState('login'))).status).toBe(400);
    expect((await complete('link', signSocialState('wechat', 'link'))).status).toBe(400);
    expect(mocks.exchangeSocialCode).not.toHaveBeenCalled();
  });
});
