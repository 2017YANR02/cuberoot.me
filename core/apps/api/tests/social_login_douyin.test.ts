import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Douyin website OAuth', () => {
  it('builds the official authorization URL and exchanges a code for UnionID', async () => {
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_KEY', 'site-client-key');
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_SECRET', 'site-client-secret');
    vi.stubEnv('PUBLIC_SITE_ORIGIN', 'https://cuberoot.me');
    vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        data: { access_token: 'access-token', open_id: 'open-id' },
      }))
      .mockResolvedValueOnce(Response.json({
        data: {
          union_id: 'union-id',
          nickname: 'CubeRoot',
          avatar: 'https://example.test/avatar.png',
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { exchangeSocialCode, socialAuthorizeUrl, socialLoginConfigured } = await import('../src/utils/social_login.js');
    expect(socialLoginConfigured('douyin')).toBe(true);

    const authorization = new URL(socialAuthorizeUrl('douyin', 'login')!);
    expect(authorization.origin).toBe('https://open.douyin.com');
    expect(authorization.pathname).toBe('/platform/oauth/connect/');
    expect(authorization.searchParams.get('client_key')).toBe('site-client-key');
    expect(authorization.searchParams.get('response_type')).toBe('code');
    expect(authorization.searchParams.get('scope')).toBe('user_info');
    expect(authorization.searchParams.get('redirect_uri')).toBe('https://cuberoot.me/auth/social/callback');
    expect(authorization.searchParams.get('state')).toBeTruthy();

    await expect(exchangeSocialCode('douyin', 'verified-code')).resolves.toEqual({
      sub: 'union-id',
      name: 'CubeRoot',
      avatar: 'https://example.test/avatar.png',
    });

    const [tokenUrl, tokenRequest] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://open.douyin.com/oauth/access_token/');
    expect(tokenRequest.method).toBe('POST');
    expect(new URLSearchParams(String(tokenRequest.body))).toEqual(new URLSearchParams({
      client_key: 'site-client-key',
      client_secret: 'site-client-secret',
      code: 'verified-code',
      grant_type: 'authorization_code',
    }));

    const [profileUrl, profileRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(profileUrl).toBe('https://open.douyin.com/oauth/userinfo/');
    expect(profileRequest.method).toBe('POST');
    expect(new URLSearchParams(String(profileRequest.body))).toEqual(new URLSearchParams({
      access_token: 'access-token',
      open_id: 'open-id',
    }));
  });

  it('refuses a website identity without UnionID', async () => {
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_KEY', 'site-client-key');
    vi.stubEnv('DOUYIN_LOGIN_CLIENT_SECRET', 'site-client-secret');
    vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ data: { access_token: 'access-token', open_id: 'open-id' } }))
      .mockResolvedValueOnce(Response.json({ data: { nickname: 'No UnionID' } })));

    const { exchangeSocialCode } = await import('../src/utils/social_login.js');
    await expect(exchangeSocialCode('douyin', 'verified-code')).rejects.toThrow('douyin unionid required');
  });
});
